// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { FontListType } from '../server/appProvider';

const fake = vi.hoisted(() => ({
    system: { isWindows: true, isMac: false },
    // The real getFontFamilyMapByNodeFont contract: a family -> weights map,
    // or null when the installed list cannot be read.
    getFonts: vi.fn(async (): Promise<FontListType | null> => ({
        Primary: [],
        Secondary: [],
    })),
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
                    glyph === '✝'
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
        expect(resolver.splitByFont('A✝ B', FONT_SPEC)).toEqual([
            { text: 'A', fontFamily: 'Primary' },
            { text: '✝', fontFamily: 'Secondary' },
            { text: ' B', fontFamily: 'Primary' },
        ]);
        const measuredCount = measureText.mock.calls.length;
        expect(resolver.splitByFont('A✝ B', FONT_SPEC)).toEqual([
            { text: 'A', fontFamily: 'Primary' },
            { text: '✝', fontFamily: 'Secondary' },
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

    // The browser's own fallback, glyph by glyph: the first family in the
    // font's list that has the glyph draws it; the generic monospace and
    // serif have every glyph; nothing else does.
    function emulateFontFallback(
        glyphWidthMap: Record<string, Record<string, number>>,
    ) {
        return (text: string) => {
            const fontFamilyList = (canvasContext.font.split(/px\s+/)[1] ?? '')
                .split(',')
                .map((family) => {
                    return family.trim().replaceAll('"', '');
                });
            let width = 0;
            for (const glyph of text) {
                let glyphWidth = 13;
                for (const family of fontFamilyList) {
                    if (family === 'monospace' || family === 'serif') {
                        glyphWidth = family === 'monospace' ? 9 : 11;
                        break;
                    }
                    const known = glyphWidthMap[family]?.[glyph];
                    if (known !== undefined) {
                        glyphWidth = known;
                        break;
                    }
                }
                width += glyphWidth;
            }
            return {
                width,
                fontBoundingBoxAscent: 25,
                fontBoundingBoxDescent: 6,
            };
        };
    }

    test('falls back to the first installed font that has the glyph when none matches the drawn width', async () => {
        fake.getFonts.mockResolvedValueOnce({
            Primary: [],
            Secondary: [],
            Tertiary: [],
        });
        measureText.mockImplementation(
            emulateFontFallback({
                Primary: { A: 10, ' ': 4 },
                // a web font the system does not have installed
                Missing: { '✝': 12 },
                Tertiary: { A: 9 },
                Secondary: { '✝': 8 },
            }),
        );
        const resolver = new PptxFontResolver();
        await resolver.init();
        const spec = {
            ...FONT_SPEC,
            familyList: '"Primary", "Missing", "Tertiary", "Secondary"',
        };
        expect(resolver.splitByFont('A✝', spec)).toEqual([
            { text: 'A', fontFamily: 'Primary' },
            { text: '✝', fontFamily: 'Secondary' },
        ]);
        // a glyph no installed font has stays with the primary font
        expect(resolver.splitByFont('A♪', spec)).toEqual([
            { text: 'A', fontFamily: 'Primary' },
            { text: '♪', fontFamily: 'Primary' },
        ]);
    });

    test('counts every family as installed while the installed list is unknown', async () => {
        const unloaded = new PptxFontResolver();
        expect(unloaded.resolvePrimaryFamily('"Missing", serif')).toBe(
            'Missing',
        );
        fake.getFonts.mockResolvedValueOnce(null);
        const unreadable = new PptxFontResolver();
        await unreadable.init();
        expect(unreadable.resolvePrimaryFamily('"Missing", serif')).toBe(
            'Missing',
        );
    });

    test('refuses to measure without a canvas context', () => {
        getContextSpy.mockReturnValue(null);
        expect(() => new PptxFontResolver()).toThrow(
            'Unable to measure text: no canvas context',
        );
    });
});
