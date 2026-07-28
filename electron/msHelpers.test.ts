import path from 'node:path';
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
    isWindows: false,
    toUnpackedPath,
    unlocking,
}));

import {
    countSlides,
    docxToHtmls,
    getDocxToHtmlsVersion,
    getPptxToHtmlsVersion,
    pptxToHtmls,
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
            modulePath: path.resolve(
                '/unpacked-root',
                'node-api-dotnet',
                'net8.0',
            ),
            binaryPath: path.resolve('/unpacked-root', 'ms-helpers', 'Helper'),
            dotnetPath: path.resolve('/unpacked-root', 'dotnet-bin'),
        });
    });

    test('drops stale count entries instead of serving them', async () => {
        vi.useFakeTimers();
        try {
            execute.mockResolvedValueOnce(12).mockResolvedValueOnce(null);

            await expect(countSlides('/slides/stale.pptx')).resolves.toBe(12);
            vi.advanceTimersByTime(1000 * 3 + 1);
            // The stale entry is deleted, so a failed re-count returns null
            // instead of the old cached value.
            await expect(countSlides('/slides/stale.pptx')).resolves.toBeNull();

            expect(execute).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });

    test('removes slide background through the worker script', async () => {
        execute.mockResolvedValue(1);

        await expect(removeSlideBackground('/slides/test.pptx')).resolves.toBe(
            1,
        );

        expect(execute).toHaveBeenCalledWith('remove-ms-pp-slides-bg.js', {
            filePath: '/slides/test.pptx',
            modulePath: path.resolve(
                '/unpacked-root',
                'node-api-dotnet',
                'net8.0',
            ),
            binaryPath: path.resolve('/unpacked-root', 'ms-helpers', 'Helper'),
            dotnetPath: path.resolve('/unpacked-root', 'dotnet-bin'),
        });
    });

    test('converts DOCX documents through the worker script', async () => {
        execute.mockResolvedValue({ isSuccessful: true });

        await expect(
            docxToHtmls({
                filePath: '/docs/handout.docx',
                outDir: '/docs/handout-docx-htmls',
            }),
        ).resolves.toEqual({ isSuccessful: true });

        expect(execute).toHaveBeenCalledWith('docx-to-htmls.js', {
            filePath: '/docs/handout.docx',
            outputDirectory: '/docs/handout-docx-htmls',
            modulePath: path.resolve(
                '/unpacked-root',
                'node-api-dotnet',
                'net8.0',
            ),
            binaryPath: path.resolve('/unpacked-root', 'ms-helpers', 'Helper'),
            dotnetPath: path.resolve('/unpacked-root', 'dotnet-bin'),
        });
    });

    test('gets the DOCX converter version through the worker script', async () => {
        execute.mockResolvedValue({ version: '1.0.0' });

        await expect(getDocxToHtmlsVersion({})).resolves.toEqual({
            version: '1.0.0',
        });

        expect(execute).toHaveBeenCalledWith('get-docx-to-htmls-version.js', {
            modulePath: path.resolve(
                '/unpacked-root',
                'node-api-dotnet',
                'net8.0',
            ),
            binaryPath: path.resolve('/unpacked-root', 'ms-helpers', 'Helper'),
            dotnetPath: path.resolve('/unpacked-root', 'dotnet-bin'),
        });
    });
    test('converts PPTX decks through the worker script', async () => {
        execute.mockResolvedValue({ isSuccessful: true });

        await expect(
            pptxToHtmls({
                filePath: '/slides/deck.pptx',
                outDir: '/slides/deck-htmls',
            }),
        ).resolves.toEqual({ isSuccessful: true });

        expect(execute).toHaveBeenCalledWith('pptx-to-htmls.js', {
            filePath: '/slides/deck.pptx',
            outputDirectory: '/slides/deck-htmls',
            eot2ttfPath: path.resolve(
                '/unpacked-root',
                'ms-helpers',
                'tools',
                'eot2ttf',
                'eot2ttf',
            ),
            modulePath: path.resolve(
                '/unpacked-root',
                'node-api-dotnet',
                'net8.0',
            ),
            binaryPath: path.resolve('/unpacked-root', 'ms-helpers', 'Helper'),
            dotnetPath: path.resolve('/unpacked-root', 'dotnet-bin'),
        });
        // one conversion at a time per deck
        expect(unlocking).toHaveBeenCalledWith(
            '/slides/deck.pptx',
            expect.any(Function),
        );
    });

    test('gets the PPTX converter version through the worker script', async () => {
        execute.mockResolvedValue({ version: '2.0.0' });

        await expect(getPptxToHtmlsVersion({})).resolves.toEqual({
            version: '2.0.0',
        });

        expect(execute).toHaveBeenCalledWith('get-pptx-to-htmls-version.js', {
            eot2ttfPath: path.resolve(
                '/unpacked-root',
                'ms-helpers',
                'tools',
                'eot2ttf',
                'eot2ttf',
            ),
            modulePath: path.resolve(
                '/unpacked-root',
                'node-api-dotnet',
                'net8.0',
            ),
            binaryPath: path.resolve('/unpacked-root', 'ms-helpers', 'Helper'),
            dotnetPath: path.resolve('/unpacked-root', 'dotnet-bin'),
        });
    });
});
