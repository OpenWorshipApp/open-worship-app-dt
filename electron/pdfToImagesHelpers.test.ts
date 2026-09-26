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

import { pdfToImages } from './pdfToImagesHelpers';

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
