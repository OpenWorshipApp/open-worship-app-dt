import { beforeEach, expect, test, vi } from 'vitest';

const { executeMock, rmSyncMock } = vi.hoisted(() => ({
    executeMock: vi.fn(),
    rmSyncMock: vi.fn(),
}));

vi.mock('./electronHelpers', () => ({
    unlocking: (_key: string, callback: () => unknown) => callback(),
}));
vi.mock('./processHelpers', () => ({ execute: executeMock }));
vi.mock('node:fs', () => ({ rmSync: rmSyncMock }));

import { getPagesCount, pdfToImages } from './pdfToImagesHelpers';

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
