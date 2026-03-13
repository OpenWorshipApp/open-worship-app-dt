import { beforeEach, describe, expect, test, vi } from 'vitest';

const { execute, unlocking, toUnpackedPath } = vi.hoisted(() => ({
    execute: vi.fn(),
    unlocking: vi.fn(async (_key: string, callback: () => unknown) => {
        return await callback();
    }),
    toUnpackedPath: vi.fn(() => '/unpacked-root'),
}));

vi.mock('./processHelpers', () => ({ execute }));
vi.mock('./electronHelpers', () => ({
    toUnpackedPath,
    unlocking,
}));

import {
    countSlides,
    exportBibleMSWord,
    removeSlideBackground,
} from './msHelpers';

describe('msHelpers', () => {
    beforeEach(() => {
        execute.mockReset();
        unlocking.mockClear();
    });

    test('counts slides and caches repeated requests briefly', async () => {
        execute.mockResolvedValue(12);

        await expect(countSlides('/slides/test.pptx')).resolves.toBe(12);
        await expect(countSlides('/slides/test.pptx')).resolves.toBe(12);

        expect(execute).toHaveBeenCalledTimes(1);
        expect(execute).toHaveBeenCalledWith('count-ms-pp-slides.js', {
            filePath: '/slides/test.pptx',
            modulePath: '/unpacked-root/node-api-dotnet/net8.0',
            binaryPath: '/unpacked-root/ms-helpers/Helper',
            dotnetPath: '/unpacked-root/dotnet-bin',
        });
    });

    test('removes slide background through the worker script', async () => {
        execute.mockResolvedValue(1);

        await expect(removeSlideBackground('/slides/test.pptx')).resolves.toBe(
            1,
        );

        expect(execute).toHaveBeenCalledWith('remove-ms-pp-slides-bg.js', {
            filePath: '/slides/test.pptx',
            modulePath: '/unpacked-root/node-api-dotnet/net8.0',
            binaryPath: '/unpacked-root/ms-helpers/Helper',
            dotnetPath: '/unpacked-root/dotnet-bin',
        });
    });

    test('exports Bible content through the Word worker script', async () => {
        execute.mockResolvedValue(1);
        const rows = [{ verse: 'John 3:16' }];

        await expect(exportBibleMSWord('/tmp/bible.docx', rows)).resolves.toBe(
            1,
        );

        expect(execute).toHaveBeenCalledWith('export-bible-ms-word.js', {
            filePath: '/tmp/bible.docx',
            data: rows,
            modulePath: '/unpacked-root/node-api-dotnet/net8.0',
            binaryPath: '/unpacked-root/ms-helpers/Helper',
            dotnetPath: '/unpacked-root/dotnet-bin',
        });
    });
});
