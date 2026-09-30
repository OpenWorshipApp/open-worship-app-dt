import { rmSync } from 'node:fs';

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
