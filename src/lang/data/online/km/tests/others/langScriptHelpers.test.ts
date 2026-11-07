// Khmer's own script facts (`../../../../script.json`) as the text code reads
// them (`src/others/langScriptHelpers.ts`): its letters name the Khmer locale.
// Its subscript sign joining the letter after it is a property of the script
// (`src/helper/scriptClusterHelpers.ts`), held here on Khmer words.
import { describe, expect, test } from 'vitest';

import {
    checkEndsWithInvisibleStacker,
    trimTrailingInvisibleStackers,
} from '../../../../../../helper/scriptClusterHelpers';
import {
    findScriptLocale,
    listScriptSystemFonts,
} from '../../../../../../others/langScriptHelpers';

const KHMER_COENG = '្';

describe('langScriptHelpers in Khmer', () => {
    test('a Khmer run is tagged with the Khmer locale', () => {
        expect(findScriptLocale('ព្រះគុណ')).toBe('km-KH');
        expect(findScriptLocale('Amazing ព្រះគុណ')).toBe('km-KH');
    });

    test('every system offers its own Khmer faces as fallbacks', () => {
        expect(listScriptSystemFonts('windows')).toContain('Khmer UI');
        expect(listScriptSystemFonts('mac')).toContain('Khmer MN');
        expect(listScriptSystemFonts('linux')).toContain('Noto Sans Khmer');
    });

    test('a coeng at the end is a joiner and is trimmed away', () => {
        expect(checkEndsWithInvisibleStacker(`ក${KHMER_COENG}`)).toBe(true);
        expect(checkEndsWithInvisibleStacker('ក្ស')).toBe(false);
        expect(trimTrailingInvisibleStackers(`ក្សត${KHMER_COENG}`)).toBe(
            'ក្សត',
        );
        expect(
            trimTrailingInvisibleStackers(`ក${KHMER_COENG}${KHMER_COENG}`),
        ).toBe('ក');
    });
});
