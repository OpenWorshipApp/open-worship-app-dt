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
    splitGraphemes,
} from './pptxFontHelpers';

describe('parseFontFamilyList', () => {
    test('reads a computed font-family the way CSS does', () => {
        expect(parseFontFamilyList('Moul')).toEqual(['Moul']);
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
        expect(parseFontFamilyList(`'Khmer OS, Bold', serif`)).toEqual([
            'Khmer OS, Bold',
            'serif',
        ]);
        expect(parseFontFamilyList('')).toEqual([]);
    });

    test('knows the generic names that stand for a platform font', () => {
        expect(checkIsGenericFontFamily('system-ui')).toBe(true);
        expect(checkIsGenericFontFamily('Sans-Serif')).toBe(true);
        expect(checkIsGenericFontFamily('Battambang')).toBe(false);
    });
});

describe('splitGraphemes', () => {
    test('never breaks a Khmer cluster', () => {
        // ស្រី: a base, a coeng subscript and a vowel sign, one cluster
        expect(splitGraphemes('ស្រី')).toHaveLength(1);
        expect(splitGraphemes('ab ស្រី')).toEqual(['a', 'b', ' ', 'ស្រី']);
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
        // Battambang 105px on a 141.75px line: PowerPoint drew 101px, the
        // browser 104px
        expect(
            calcPptxFirstBaseline(141.75, 105, {
                ascent: 128.2,
                descent: 61.5,
            }),
        ).toBeCloseTo(101.05, 1);
        // Moul 75px: 72.6px in PowerPoint
        expect(
            calcPptxFirstBaseline(101.25, 75, {
                ascent: 91.55,
                descent: 43.95,
            }),
        ).toBeCloseTo(72.2, 1);
    });
});
