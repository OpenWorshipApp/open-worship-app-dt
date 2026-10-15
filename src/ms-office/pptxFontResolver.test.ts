// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const fake = vi.hoisted(() => ({
    system: { isWindows: true, isMac: false },
    getFonts: vi.fn(async () => ({ Primary: {}, Secondary: {} })),
}));

vi.mock('../server/fontHelpers', () => ({
    getFontFamilyMapByNodeFont: fake.getFonts,
}));
vi.mock('../server/appProvider', () => ({
    default: { systemUtils: fake.system },
}));

import { PptxFontResolver, type PptxFontSpecType } from './pptxFontHelpers';

const FONT_SPEC: PptxFontSpecType = {
    familyList: '"Primary", "Secondary", serif',
    size: 32,
    weight: '400',
    style: 'normal',
};

describe('PPTX font resolution', () => {
    let measureText: ReturnType<typeof vi.fn>;
    let canvasContext: { font: string; measureText: typeof measureText };
    let getContextSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        fake.system.isWindows = true;
        fake.system.isMac = false;
        fake.getFonts.mockClear();
        measureText = vi.fn((text: string) => {
            const familyList = canvasContext.font.split(/px\s+/)[1] ?? '';
            let width = 0;
            for (const glyph of text) {
                if (glyph === ' ') {
                    width += 4;
                } else if (
                    familyList.includes('"Primary"') &&
                    (glyph === 'A' || glyph === 'B')
                ) {
                    width += 10;
                } else if (
                    familyList.includes('"Secondary"') &&
                    glyph === 'Ω'
                ) {
                    width += 8;
                } else if (familyList.includes('monospace')) {
                    width += 9;
                } else if (familyList.includes('serif')) {
                    width += 11;
                } else {
                    width += 13;
                }
            }
            return {
                width,
                fontBoundingBoxAscent: 25,
                fontBoundingBoxDescent: 6,
            };
        });
        canvasContext = { font: '', measureText };
        getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, 'getContext')
            .mockReturnValue(
                canvasContext as unknown as CanvasRenderingContext2D,
            );
    });
    afterEach(() => {
        getContextSpy.mockRestore();
    });

    test('chooses an installed family after a missing one and maps generics', async () => {
        const resolver = new PptxFontResolver();
        await resolver.init();
        expect(fake.getFonts).toHaveBeenCalledOnce();
        expect(
            resolver.resolvePrimaryFamily('"Missing", "Primary", serif'),
        ).toBe('Primary');
        expect(resolver.resolvePrimaryFamily('sans-serif')).toBe('Arial');
        expect(resolver.resolvePrimaryFamily('"Missing"')).toBe(
            'Times New Roman',
        );
    });

    test('splits a line where its primary font lacks a glyph', async () => {
        const resolver = new PptxFontResolver();
        await resolver.init();
        expect(resolver.splitByFont('AΩ B', FONT_SPEC)).toEqual([
            { text: 'A', fontFamily: 'Primary' },
            { text: 'Ω', fontFamily: 'Secondary' },
            { text: ' B', fontFamily: 'Primary' },
        ]);
        const measuredCount = measureText.mock.calls.length;
        expect(resolver.splitByFont('AΩ B', FONT_SPEC)).toEqual([
            { text: 'A', fontFamily: 'Primary' },
            { text: 'Ω', fontFamily: 'Secondary' },
            { text: ' B', fontFamily: 'Primary' },
        ]);
        expect(measureText).toHaveBeenCalledTimes(measuredCount);
    });

    test('keeps whitespace with its line and returns browser font metrics', async () => {
        const resolver = new PptxFontResolver();
        await resolver.init();
        expect(resolver.splitByFont('A B', FONT_SPEC)).toEqual([
            { text: 'A B', fontFamily: 'Primary' },
        ]);
        expect(resolver.getMetrics(FONT_SPEC)).toEqual({
            ascent: 25,
            descent: 6,
        });
    });

    test('uses each platform’s generic font mapping', () => {
        fake.system.isWindows = false;
        fake.system.isMac = true;
        expect(new PptxFontResolver().resolvePrimaryFamily('system-ui')).toBe(
            'Helvetica Neue',
        );
        fake.system.isMac = false;
        expect(new PptxFontResolver().resolvePrimaryFamily('system-ui')).toBe(
            'DejaVu Sans',
        );
    });
});
