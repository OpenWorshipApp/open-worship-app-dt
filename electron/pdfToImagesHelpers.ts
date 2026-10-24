import { createHash } from 'node:crypto';
import { rmSync } from 'node:fs';
import {
    mkdir,
    readFile,
    readdir,
    rename,
    rm,
    stat,
    writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { unlocking } from './electronHelpers';
import { execute } from './processHelpers';

type PdfImagePreviewDataType = {
    isSuccessful: boolean;
    message?: string;
    filePaths?: string[];
    pageCount?: number;
};

const PAGES_PER_BATCH = 12;

function genImage(
    filePath: string,
    outDir: string,
    width: number,
    startPage: number,
) {
    return execute<PdfImagePreviewDataType>('pdf-to-images.mjs', {
        filePath,
        outDir,
        width,
        startPage,
        endPage: startPage + PAGES_PER_BATCH,
    });
}

async function genImagesInBatches(
    filePath: string,
    outDir: string,
    width: number,
    onProgress?: (completed: number, total: number) => void,
): Promise<PdfImagePreviewDataType> {
    const filePaths: string[] = [];
    let pageCount: number | undefined;
    try {
        for (
            let startPage = 0;
            pageCount === undefined || startPage < pageCount;
            startPage += PAGES_PER_BATCH
        ) {
            // execute() starts a fresh child process. Its MuPDF heap is freed
            // after each batch, even when the PDF contains many large pages.
            const batch = await genImage(filePath, outDir, width, startPage);
            if (!batch.isSuccessful) {
                throw new Error(batch.message ?? 'PDF conversion failed');
            }
            if (
                !Number.isInteger(batch.pageCount) ||
                batch.pageCount! < 0 ||
                (pageCount !== undefined && batch.pageCount !== pageCount)
            ) {
                throw new Error('PDF page count changed during conversion');
            }
            const expectedPages = Math.min(
                PAGES_PER_BATCH,
                batch.pageCount! - startPage,
            );
            if (batch.filePaths?.length !== expectedPages) {
                throw new Error('PDF conversion returned an incomplete batch');
            }
            filePaths.push(...batch.filePaths);
            pageCount = batch.pageCount;
            onProgress?.(filePaths.length, pageCount!);
        }
        return { isSuccessful: true, filePaths };
    } catch (error) {
        for (const imagePath of filePaths) {
            try {
                rmSync(imagePath, { force: true });
            } catch {
                // Preserve the conversion error even if a preview was removed.
            }
        }
        return {
            isSuccessful: false,
            message: error instanceof Error ? error.message : String(error),
        };
    }
}

// A small LRU: caching every converted PDF forever grows memory unbounded,
// so keep only the few most recently used results.
const DATA_MAP_MAX_SIZE = 3;
const dataMap = new Map<string, PdfImagePreviewDataType>();
function setCachedData(filePath: string, data: PdfImagePreviewDataType) {
    // Re-inserting moves the key to the end, so the first key is always the
    // least recently used one.
    dataMap.delete(filePath);
    dataMap.set(filePath, data);
    while (dataMap.size > DATA_MAP_MAX_SIZE) {
        const oldestKey = dataMap.keys().next().value;
        if (oldestKey === undefined) {
            break;
        }
        dataMap.delete(oldestKey);
    }
}
export function pdfToImages(
    filePath: string,
    outDir: string,
    width: number,
    isForce: boolean,
    onProgress?: (completed: number, total: number) => void,
) {
    return unlocking<PdfImagePreviewDataType>(filePath, async () => {
        if (isForce) {
            dataMap.delete(filePath);
        }
        const cachedData = dataMap.get(filePath);
        if (cachedData !== undefined) {
            setCachedData(filePath, cachedData);
            onProgress?.(
                cachedData.filePaths?.length ?? 0,
                cachedData.filePaths?.length ?? 0,
            );
            return cachedData;
        }
        const data = await genImagesInBatches(
            filePath,
            outDir,
            width,
            onProgress,
        );
        if (data.isSuccessful) {
            setCachedData(filePath, data);
        }
        return data;
    });
}

type PdfChatPagesDataType = {
    isSuccessful: boolean;
    message?: string;
    pageCount?: number;
    startPage?: number;
    pageTexts?: { page: number; text: string | null }[];
    dataUrls?: string[];
    cacheHit?: boolean;
};

const PDF_CHAT_CACHE_VERSION = 1;
const PDF_CHAT_CACHE_MAX_ENTRIES = 8;
const PDF_CHAT_CACHE_MAX_ENTRY_BYTES = 32 * 1024 * 1024;
const PDF_CHAT_CACHE_MAX_TOTAL_BYTES = 64 * 1024 * 1024;
export const PDF_CHAT_CACHE_DIR = join(
    tmpdir(),
    process.env.VITEST
        ? `open-worship-pdf-chat-cache-test-${process.pid.toString()}`
        : 'open-worship-pdf-chat-cache',
);

function checkIsPdfChatPagesData(
    value: unknown,
): value is PdfChatPagesDataType {
    if (value === null || typeof value !== 'object') return false;
    const result = value as PdfChatPagesDataType;
    return (
        result.isSuccessful === true &&
        Number.isInteger(result.pageCount) &&
        Number.isInteger(result.startPage) &&
        Array.isArray(result.dataUrls) &&
        result.dataUrls.every((dataUrl) => {
            return /^data:image\/(?:png|jpeg);base64,/.test(dataUrl);
        }) &&
        (result.pageTexts === undefined || Array.isArray(result.pageTexts))
    );
}

async function toPdfChatCachePath(
    filePath: string,
    options: {
        startPage?: number;
        maxPages?: number;
        longEdge?: number;
        allPages?: boolean;
    },
) {
    const source = await stat(filePath);
    const key = JSON.stringify({
        version: PDF_CHAT_CACHE_VERSION,
        filePath,
        size: source.size,
        modified: source.mtimeMs,
        ...options,
    });
    return join(
        PDF_CHAT_CACHE_DIR,
        `${createHash('sha256').update(key).digest('hex')}.json`,
    );
}

async function trimPdfChatCache() {
    try {
        const entries = (
            await readdir(PDF_CHAT_CACHE_DIR, {
                withFileTypes: true,
            })
        ).filter((entry) => {
            return entry.isFile() && /^[a-f0-9]{64}\.json$/.test(entry.name);
        });
        const dated = await Promise.all(
            entries.map(async (entry) => {
                const filePath = join(PDF_CHAT_CACHE_DIR, entry.name);
                const info = await stat(filePath);
                return {
                    filePath,
                    modified: info.mtimeMs,
                    size: info.size,
                };
            }),
        );
        dated.sort((a, b) => b.modified - a.modified);
        let keptBytes = 0;
        await Promise.all(
            dated.flatMap((entry, index) => {
                keptBytes += entry.size;
                return index >= PDF_CHAT_CACHE_MAX_ENTRIES ||
                    keptBytes > PDF_CHAT_CACHE_MAX_TOTAL_BYTES
                    ? [rm(entry.filePath, { force: true })]
                    : [];
            }),
        );
    } catch (_error) {
        // A cache is an optimization: a read must still work without it.
    }
}

async function readCachedPdfChatPages(cachePath: string) {
    try {
        const parsed: unknown = JSON.parse(await readFile(cachePath, 'utf8'));
        return checkIsPdfChatPagesData(parsed)
            ? { ...parsed, cacheHit: true }
            : null;
    } catch (_error) {
        await rm(cachePath, { force: true }).catch(() => undefined);
        return null;
    }
}

async function writeCachedPdfChatPages(
    cachePath: string,
    result: PdfChatPagesDataType,
) {
    if (!checkIsPdfChatPagesData(result)) return;
    const serialized = JSON.stringify(result);
    if (
        Buffer.byteLength(serialized, 'utf8') > PDF_CHAT_CACHE_MAX_ENTRY_BYTES
    ) {
        return;
    }
    const tempPath = `${cachePath}.${process.pid.toString()}.tmp`;
    try {
        await mkdir(PDF_CHAT_CACHE_DIR, { recursive: true });
        await writeFile(tempPath, serialized, 'utf8');
        await rename(tempPath, cachePath);
        await trimPdfChatCache();
    } catch (_error) {
        await rm(tempPath, { force: true }).catch(() => undefined);
    }
}

/**
 * Pages of a PDF as pictures for the help window's assistant to read
 * (`pdf-to-chat-images.mjs`): handed back as data URLs. Successful results
 * are cached in the OS temporary folder by source fingerprint and render
 * options, so a verse-by-verse chapter reading does not render the same PDF
 * again. The bounded cache is disposable and never sits beside user files.
 */
export async function pdfToChatPages(
    filePath: string,
    // The script's own defaults when left out: from the first page, as many
    // as a question may carry.
    startPage?: number,
    maxPages?: number,
    longEdge?: number,
    allPages?: boolean,
) {
    const options = {
        filePath,
        startPage,
        maxPages,
        longEdge,
        allPages,
    };
    let cachePath: string | null = null;
    try {
        cachePath = await toPdfChatCachePath(filePath, options);
    } catch (_error) {
        // The renderer gives the useful file-open error below.
    }
    if (cachePath === null) {
        return await execute<PdfChatPagesDataType>(
            'pdf-to-chat-images.mjs',
            options,
        );
    }
    return await unlocking(`pdf-chat-cache:${cachePath}`, async () => {
        const cached = await readCachedPdfChatPages(cachePath);
        if (cached !== null) return cached;
        const result = await execute<PdfChatPagesDataType>(
            'pdf-to-chat-images.mjs',
            options,
        );
        await writeCachedPdfChatPages(cachePath, result);
        return { ...result, cacheHit: false };
    });
}

const COUNT_FRESH_MILLISECONDS = 1000 * 3;
const countMap = new Map<string, { date: number; count: number }>();
function deleteStaleCounts() {
    const now = Date.now();
    for (const [key, value] of countMap) {
        if (now - value.date > COUNT_FRESH_MILLISECONDS) {
            countMap.delete(key);
        }
    }
}
export async function getPagesCount(filePath: string) {
    return unlocking<number | null>(`count-pages-${filePath}`, async () => {
        deleteStaleCounts();
        if (!countMap.has(filePath)) {
            const count = await execute<number | null>('count-pdf-pages.mjs', {
                filePath,
            });
            if (count !== null) {
                countMap.set(filePath, { count, date: Date.now() });
            }
        }
        const data = countMap.get(filePath);
        if (data) {
            return data.count;
        }
        return null;
    });
}
