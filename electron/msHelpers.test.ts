import path from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    exportPptx,
    getSlidesCount,
    getPptxVersion,
    exportDocx,
    getDocxVersion,
    toUnpackedPath,
} = vi.hoisted(() => ({
    exportPptx: vi.fn(),
    getSlidesCount: vi.fn(),
    getPptxVersion: vi.fn(),
    exportDocx: vi.fn(),
    getDocxVersion: vi.fn(),
    toUnpackedPath: vi.fn(() => '/unpacked-root'),
}));

vi.mock('pptx-to-html', () => ({
    exportPptx,
    getSlidesCount,
    getVersion: getPptxVersion,
}));
vi.mock('docx-to-html', () => ({
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

    test('converts PPTX decks with the eot2ttf helper', () => {
        expect(
            pptxToHtmls({
                filePath: '/slides/deck.pptx',
                outDir: '/slides/deck-htmls',
            }),
        ).toBe(true);

        expect(exportPptx).toHaveBeenCalledWith(
            '/slides/deck.pptx',
            '/slides/deck-htmls',
            EOT2TTF_PATH,
        );
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
