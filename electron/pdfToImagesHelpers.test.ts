import { beforeEach, expect, test, vi } from 'vitest';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { executeMock, rmSyncMock } = vi.hoisted(() => ({
    executeMock: vi.fn(),
    rmSyncMock: vi.fn(),
}));

vi.mock('./electronHelpers', () => ({
    unlocking: (_key: string, callback: () => unknown) => callback(),
}));
vi.mock('./processHelpers', () => ({ execute: executeMock }));
vi.mock('node:fs', () => ({ rmSync: rmSyncMock }));

import {
    PDF_CHAT_CACHE_DIR,
    getPagesCount,
    pdfToChatPages,
    pdfToImages,
} from './pdfToImagesHelpers';

beforeEach(() => {
    vi.clearAllMocks();
});

test('converts a long PDF in fresh, sequential page batches', async () => {
    executeMock
        .mockResolvedValueOnce({
            isSuccessful: true,
            pageCount: 25,
            filePaths: Array.from(
                { length: 12 },
                (_, i) => `/out/page-${i}.png`,
            ),
        })
        .mockResolvedValueOnce({
            isSuccessful: true,
            pageCount: 25,
            filePaths: Array.from(
                { length: 12 },
                (_, i) => `/out/page-${i + 12}.png`,
            ),
        })
        .mockResolvedValueOnce({
            isSuccessful: true,
            pageCount: 25,
            filePaths: ['/out/page-24.png'],
        });

    const onProgress = vi.fn();
    const result = await pdfToImages(
        '/docs/long.pdf',
        '/out',
        1920,
        true,
        onProgress,
    );

    expect(result.isSuccessful).toBe(true);
    expect(result.filePaths).toHaveLength(25);
    expect(executeMock.mock.calls.map((call) => call[1].startPage)).toEqual([
        0, 12, 24,
    ]);
    expect(executeMock.mock.calls.map((call) => call[1].endPage)).toEqual([
        12, 24, 36,
    ]);
    expect(rmSyncMock).not.toHaveBeenCalled();
    expect(onProgress.mock.calls).toEqual([
        [12, 25],
        [24, 25],
        [25, 25],
    ]);
});

test('removes earlier batches when a later batch fails', async () => {
    executeMock
        .mockResolvedValueOnce({
            isSuccessful: true,
            pageCount: 13,
            filePaths: Array.from(
                { length: 12 },
                (_, i) => `/out/page-${i}.png`,
            ),
        })
        .mockResolvedValueOnce({
            isSuccessful: false,
            message: 'malloc failed',
        });

    const result = await pdfToImages('/docs/failing.pdf', '/out', 1920, true);

    expect(result).toEqual({
        isSuccessful: false,
        message: 'malloc failed',
    });
    expect(rmSyncMock).toHaveBeenCalledTimes(12);
    expect(rmSyncMock).toHaveBeenCalledWith('/out/page-0.png', { force: true });
});

test('rejects a page count that changes between batches', async () => {
    executeMock
        .mockResolvedValueOnce({
            isSuccessful: true,
            pageCount: 13,
            filePaths: Array.from({ length: 12 }, (_, i) => `/out/${i}.png`),
        })
        .mockResolvedValueOnce({
            isSuccessful: true,
            pageCount: 14,
            filePaths: ['/out/12.png', '/out/13.png'],
        });
    rmSyncMock.mockImplementationOnce(() => {
        throw new Error('already removed');
    });

    await expect(
        pdfToImages('/docs/changing.pdf', '/out', 800, true),
    ).resolves.toEqual({
        isSuccessful: false,
        message: 'PDF page count changed during conversion',
    });
    expect(rmSyncMock).toHaveBeenCalledTimes(12);
});

test('rejects malformed and incomplete conversion results', async () => {
    executeMock.mockResolvedValueOnce({
        isSuccessful: true,
        pageCount: 2,
        filePaths: ['/out/0.png'],
    });

    await expect(
        pdfToImages('/docs/incomplete.pdf', '/out', 800, true),
    ).resolves.toEqual({
        isSuccessful: false,
        message: 'PDF conversion returned an incomplete batch',
    });

    executeMock.mockResolvedValueOnce({
        isSuccessful: true,
        pageCount: Number.NaN,
        filePaths: [],
    });
    await expect(
        pdfToImages('/docs/malformed.pdf', '/out', 800, true),
    ).resolves.toEqual({
        isSuccessful: false,
        message: 'PDF page count changed during conversion',
    });
});

test('reuses recent conversions and evicts the least-recently-used fourth entry', async () => {
    executeMock.mockImplementation(async (_script, options) => ({
        isSuccessful: true,
        pageCount: 1,
        filePaths: [`${options.filePath}.png`],
    }));

    for (const name of ['a', 'b', 'c']) {
        await pdfToImages(`/docs/${name}.pdf`, '/out', 800, true);
    }
    const onProgress = vi.fn();
    await pdfToImages('/docs/a.pdf', '/out', 800, false, onProgress);
    await pdfToImages('/docs/d.pdf', '/out', 800, true);
    await pdfToImages('/docs/b.pdf', '/out', 800, false);

    expect(onProgress).toHaveBeenCalledWith(1, 1);
    expect(executeMock).toHaveBeenCalledTimes(5);
    expect(executeMock.mock.calls.at(-1)?.[1].filePath).toBe('/docs/b.pdf');
});

test('caches non-null page counts only while they are fresh', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T12:00:00Z'));
    executeMock.mockResolvedValueOnce(7).mockResolvedValueOnce(8);

    await expect(getPagesCount('/docs/count.pdf')).resolves.toBe(7);
    await expect(getPagesCount('/docs/count.pdf')).resolves.toBe(7);
    vi.advanceTimersByTime(3001);
    await expect(getPagesCount('/docs/count.pdf')).resolves.toBe(8);

    executeMock.mockResolvedValue(null);
    await expect(getPagesCount('/docs/null.pdf')).resolves.toBeNull();
    await expect(getPagesCount('/docs/null.pdf')).resolves.toBeNull();
    expect(executeMock).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
});

test('reuses a complete chatbot PDF render until the source changes', async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), 'owa-pdf-chat-source-'));
    const sourcePath = join(sourceDir, 'JHN.3.pdf');
    const rendered = {
        isSuccessful: true,
        pageCount: 4,
        startPage: 0,
        dataUrls: ['data:image/png;base64,cGFnZQ=='],
        pageTexts: [{ page: 1, text: 'page text' }],
    };
    await rm(PDF_CHAT_CACHE_DIR, { recursive: true, force: true });
    await writeFile(sourcePath, 'first PDF bytes');
    executeMock.mockResolvedValue(rendered);

    try {
        await expect(
            pdfToChatPages(sourcePath, undefined, undefined, 2200, true),
        ).resolves.toMatchObject({ cacheHit: false, pageCount: 4 });
        await expect(
            pdfToChatPages(sourcePath, undefined, undefined, 2200, true),
        ).resolves.toMatchObject({ cacheHit: true, pageCount: 4 });
        expect(executeMock).toHaveBeenCalledTimes(1);

        await writeFile(sourcePath, 'changed PDF bytes with a new size');
        await expect(
            pdfToChatPages(sourcePath, undefined, undefined, 2200, true),
        ).resolves.toMatchObject({ cacheHit: false, pageCount: 4 });
        expect(executeMock).toHaveBeenCalledTimes(2);
        expect(executeMock).toHaveBeenLastCalledWith(
            'pdf-to-chat-images.mjs',
            expect.objectContaining({
                filePath: sourcePath,
                allPages: true,
                longEdge: 2200,
            }),
        );
    } finally {
        await rm(sourceDir, { recursive: true, force: true });
        await rm(PDF_CHAT_CACHE_DIR, { recursive: true, force: true });
    }
});

const RENDERED_PAGES = {
    isSuccessful: true,
    pageCount: 4,
    startPage: 0,
    dataUrls: ['data:image/png;base64,cGFnZQ=='],
};

async function withSourcePdf(run: (sourcePath: string) => Promise<void>) {
    const sourceDir = await mkdtemp(join(tmpdir(), 'owa-pdf-chat-source-'));
    const sourcePath = join(sourceDir, 'notes.pdf');
    await writeFile(sourcePath, 'PDF bytes');
    await rm(PDF_CHAT_CACHE_DIR, { recursive: true, force: true });
    try {
        await run(sourcePath);
    } finally {
        await rm(sourceDir, { recursive: true, force: true });
        await rm(PDF_CHAT_CACHE_DIR, { recursive: true, force: true });
    }
}

test('renders a PDF it cannot look at without the cache', async () => {
    const answer = { isSuccessful: false, message: 'File not found' };
    executeMock.mockResolvedValue(answer);
    const missingPath = join(tmpdir(), 'owa-no-such-folder', 'gone.pdf');

    await expect(pdfToChatPages(missingPath, 2, 3)).resolves.toEqual(answer);
    expect(executeMock).toHaveBeenCalledExactlyOnceWith(
        'pdf-to-chat-images.mjs',
        {
            filePath: missingPath,
            startPage: 2,
            maxPages: 3,
            longEdge: undefined,
            allPages: undefined,
        },
    );
});

test('keeps neither a failed render nor one too big to hold', async () => {
    await withSourcePdf(async (sourcePath) => {
        executeMock.mockResolvedValue({
            isSuccessful: false,
            message: 'damaged PDF',
        });
        await expect(pdfToChatPages(sourcePath)).resolves.toEqual({
            isSuccessful: false,
            message: 'damaged PDF',
            cacheHit: false,
        });
        await expect(pdfToChatPages(sourcePath)).resolves.toMatchObject({
            cacheHit: false,
        });
        expect(executeMock).toHaveBeenCalledTimes(2);

        executeMock.mockResolvedValue({
            ...RENDERED_PAGES,
            dataUrls: [`data:image/png;base64,${'A'.repeat(32 * 1024 * 1024)}`],
        });
        await expect(pdfToChatPages(sourcePath)).resolves.toMatchObject({
            cacheHit: false,
        });
        await expect(pdfToChatPages(sourcePath)).resolves.toMatchObject({
            cacheHit: false,
        });
        expect(executeMock).toHaveBeenCalledTimes(4);
        await expect(readdir(PDF_CHAT_CACHE_DIR)).rejects.toMatchObject({
            code: 'ENOENT',
        });
    });
});

test('renders again over a damaged cache entry, and keeps the new one', async () => {
    await withSourcePdf(async (sourcePath) => {
        executeMock.mockResolvedValue(RENDERED_PAGES);
        await pdfToChatPages(sourcePath);
        const [entryName] = await readdir(PDF_CHAT_CACHE_DIR);
        const entryPath = join(PDF_CHAT_CACHE_DIR, entryName);

        for (const damaged of ['not json', 'null', '{"isSuccessful":true}']) {
            await writeFile(entryPath, damaged);
            await expect(pdfToChatPages(sourcePath)).resolves.toMatchObject({
                cacheHit: false,
                pageCount: 4,
            });
        }
        expect(executeMock).toHaveBeenCalledTimes(4);
        await expect(pdfToChatPages(sourcePath)).resolves.toMatchObject({
            cacheHit: true,
        });
        expect(executeMock).toHaveBeenCalledTimes(4);
    });
});

test('still answers when the cache folder cannot be made', async () => {
    await withSourcePdf(async (sourcePath) => {
        // A file sits where the cache folder should be.
        await writeFile(PDF_CHAT_CACHE_DIR, 'in the way');
        executeMock.mockResolvedValue(RENDERED_PAGES);
        await expect(pdfToChatPages(sourcePath)).resolves.toMatchObject({
            cacheHit: false,
            pageCount: 4,
        });
        await expect(pdfToChatPages(sourcePath)).resolves.toMatchObject({
            cacheHit: false,
        });
        expect(executeMock).toHaveBeenCalledTimes(2);
        expect(await readFile(PDF_CHAT_CACHE_DIR, 'utf8')).toBe('in the way');
    });
});
