// Khmer text in a PowerPoint export (`src/ms-office/pptxFontHelpers.ts`): a
// syllable with a subscript consonant is one cluster, measured and re-fonted
// whole (an invisible stacker, `src/helper/scriptClusterHelpers.ts`).
import { describe, expect, test, vi } from 'vitest';

vi.mock('../../../../../../server/fontHelpers', () => ({
    getFontFamilyMapByNodeFont: vi.fn(async () => null),
}));
vi.mock('../../../../../../server/appProvider', () => ({
    default: {
        systemUtils: { isWindows: true, isMac: false, isLinux: false },
    },
}));

import { splitGraphemes } from '../../../../../../ms-office/pptxFontHelpers';

describe('splitGraphemes', () => {
    test('never breaks a Khmer cluster', () => {
        // A base, a coeng subscript and a vowel sign, one cluster.
        expect(splitGraphemes('ស្រី')).toHaveLength(1);
        expect(splitGraphemes('ab ស្រី')).toEqual(['a', 'b', ' ', 'ស្រី']);
    });
});
