import { describe, expect, test, vi } from 'vitest';

vi.mock('../server/fontHelpers', () => ({
    getFontFamilyMapByNodeFont: vi.fn(async () => null),
}));
vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isWindows: true, isMac: false, isLinux: false },
    },
}));

import {
    calcPptxFirstBaseline,
    checkIsGenericFontFamily,
    parseFontFamilyList,
} from './pptxFontHelpers';

describe('parseFontFamilyList', () => {
    test('reads a computed font-family the way CSS does', () => {
        expect(parseFontFamilyList('MadeUpSans')).toEqual(['MadeUpSans']);
        expect(
            parseFontFamilyList(
                'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
            ),
        ).toEqual([
            'system-ui',
            '-apple-system',
            'Segoe UI',
            'Roboto',
            'sans-serif',
        ]);
        expect(parseFontFamilyList(`'Made Up, Bold', serif`)).toEqual([
            'Made Up, Bold',
            'serif',
        ]);
        expect(parseFontFamilyList('')).toEqual([]);
    });

    test('knows the generic names that stand for a platform font', () => {
        expect(checkIsGenericFontFamily('system-ui')).toBe(true);
        expect(checkIsGenericFontFamily('Sans-Serif')).toBe(true);
        expect(checkIsGenericFontFamily('Made Up Sans')).toBe(false);
    });
});

describe('calcPptxFirstBaseline', () => {
    // Measured against PowerPoint 16, 2026-09-21, at the 1.35 line height
    // every text item uses.
    test('a font that fits its line sits at 75% of it', () => {
        // Arial 100px: PowerPoint drew the baseline 101px down a 135px line
        expect(
            calcPptxFirstBaseline(135, 100, { ascent: 90.5, descent: 21.2 }),
        ).toBeCloseTo(101.25, 2);
        // Segoe UI is taller but still fits: the same 101px
        expect(
            calcPptxFirstBaseline(135, 100, { ascent: 107.9, descent: 25.1 }),
        ).toBeCloseTo(101.25, 2);
    });

    test('a font taller than its line is centered and lifted 3%', () => {
        // A language's own tall face, 105px on a 141.75px line: PowerPoint drew 101px, the
        // browser 104px
        expect(
            calcPptxFirstBaseline(141.75, 105, {
                ascent: 128.2,
                descent: 61.5,
            }),
        ).toBeCloseTo(101.05, 1);
        // Another such face, 75px: 72.6px in PowerPoint
        expect(
            calcPptxFirstBaseline(101.25, 75, {
                ascent: 91.55,
                descent: 43.95,
            }),
        ).toBeCloseTo(72.2, 1);
    });
});
