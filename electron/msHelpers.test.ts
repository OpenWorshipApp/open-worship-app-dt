import path from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import enFonts from '../src/lang/data/en/fonts.json';

const {
    exportPptx,
    getSlidesCount,
    getPptxVersion,
    exportDocx,
    getDocxVersion,
    toUnpackedPath,
    readFileSync,
    writeFileSync,
} = vi.hoisted(() => ({
    exportPptx: vi.fn(),
    getSlidesCount: vi.fn(),
    getPptxVersion: vi.fn(),
    exportDocx: vi.fn(),
    getDocxVersion: vi.fn(),
    toUnpackedPath: vi.fn(() => '/unpacked-root'),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
}));

vi.mock('node:fs', () => ({ readFileSync, writeFileSync }));

// The converters' package names since 86e75ddb ("upgraded modules").
vi.mock('pptx-to-html-conv', () => ({
    exportPptx,
    getSlidesCount,
    getVersion: getPptxVersion,
}));
vi.mock('docx-to-html-conv', () => ({
    exportDocx,
    getVersion: getDocxVersion,
}));
vi.mock('./electronHelpers', () => ({
    isWindows: false,
    toUnpackedPath,
}));

import {
    docxToHtmls,
    getBinaryPath,
    getDocxToHtmlsVersion,
    getPptxSlidesCount,
    getPptxToHtmlsVersion,
    pptxToHtmls,
} from './msHelpers';

const EOT2TTF_PATH = path.resolve(
    '/unpacked-root',
    'ms-helpers',
    'tools',
    'eot2ttf',
    'eot2ttf',
);

describe('msHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    test('resolves the eot2ttf helper inside the unpacked bin-helper dir', () => {
        expect(getBinaryPath()).toEqual({ eot2ttfPath: EOT2TTF_PATH });
    });

    test('counts slides through the pptx converter', () => {
        getSlidesCount.mockReturnValue(12);

        expect(getPptxSlidesCount('/slides/deck.pptx')).toBe(12);
        expect(getSlidesCount).toHaveBeenCalledWith('/slides/deck.pptx');
    });

    const INFO_PATH = path.resolve('/slides/deck-htmls', 'info.json');

    function readStamped() {
        expect(writeFileSync).toHaveBeenCalledTimes(1);
        const [filePath, text] = writeFileSync.mock.calls[0];
        expect(filePath).toBe(INFO_PATH);
        return JSON.parse(text);
    }

    test('converts PPTX decks with the eot2ttf helper, backgrounds kept by default', () => {
        readFileSync.mockReturnValue('{"toolVersion":"1.1.0"}');

        expect(
            pptxToHtmls({
                filePath: '/slides/deck.pptx',
                outDir: '/slides/deck-htmls',
            }),
        ).toBe(true);

        // A face of the deck the computer lacks falls to the app's default
        // face -- English's, named in its package alone -- which the
        // converter puts in front of each generic family.
        expect(exportPptx).toHaveBeenCalledWith(
            '/slides/deck.pptx',
            '/slides/deck-htmls',
            EOT2TTF_PATH,
            false,
            enFonts.uiFamily,
        );
        expect(readStamped()).toEqual({
            toolVersion: '1.1.0',
            noBackground: false,
        });
    });

    test('builds a deck without backgrounds when asked, and says so in its info.json', () => {
        // The converter writes the file with a byte-order mark.
        readFileSync.mockReturnValue('\uFEFF{"toolVersion":"1.1.0"}');

        expect(
            pptxToHtmls({
                filePath: '/slides/deck.pptx',
                outDir: '/slides/deck-htmls',
                noBackground: true,
            }),
        ).toBe(true);

        expect(exportPptx).toHaveBeenCalledWith(
            '/slides/deck.pptx',
            '/slides/deck-htmls',
            EOT2TTF_PATH,
            true,
            enFonts.uiFamily,
        );
        expect(readFileSync).toHaveBeenCalledWith(INFO_PATH, 'utf8');
        expect(readStamped()).toEqual({
            toolVersion: '1.1.0',
            noBackground: true,
        });
    });

    test('anything but a real true over IPC is the default', () => {
        readFileSync.mockReturnValue('{}');

        pptxToHtmls({
            filePath: '/slides/deck.pptx',
            outDir: '/slides/deck-htmls',
            noBackground: 'yes' as any,
        });

        expect(exportPptx.mock.calls[0][3]).toBe(false);
        expect(readStamped()).toEqual({ noBackground: false });
    });

    test('a conversion that left no readable info.json is a failed one', () => {
        readFileSync.mockImplementation(() => {
            throw new Error('ENOENT');
        });

        expect(
            pptxToHtmls({
                filePath: '/slides/deck.pptx',
                outDir: '/slides/deck-htmls',
                noBackground: true,
            }),
        ).toBe(false);
        expect(writeFileSync).not.toHaveBeenCalled();
    });

    test('reports a failed PPTX conversion instead of throwing', () => {
        exportPptx.mockImplementation(() => {
            throw new Error('broken deck');
        });

        expect(
            pptxToHtmls({
                filePath: '/slides/deck.pptx',
                outDir: '/slides/deck-htmls',
            }),
        ).toBe(false);
    });

    test('gets the PPTX converter version', () => {
        getPptxVersion.mockReturnValue('2.0.0');

        expect(getPptxToHtmlsVersion()).toBe('2.0.0');
    });

    test('converts DOCX documents', () => {
        expect(
            docxToHtmls({
                filePath: '/docs/handout.docx',
                outDir: '/docs/handout-docx-htmls',
            }),
        ).toBe(true);

        expect(exportDocx).toHaveBeenCalledWith(
            '/docs/handout.docx',
            '/docs/handout-docx-htmls',
        );
    });

    test('reports a failed DOCX conversion instead of throwing', () => {
        exportDocx.mockImplementation(() => {
            throw new Error('broken document');
        });

        expect(
            docxToHtmls({
                filePath: '/docs/handout.docx',
                outDir: '/docs/handout-docx-htmls',
            }),
        ).toBe(false);
    });

    test('gets the DOCX converter version', () => {
        getDocxVersion.mockReturnValue('1.0.0');

        expect(getDocxToHtmlsVersion()).toBe('1.0.0');
    });
});
