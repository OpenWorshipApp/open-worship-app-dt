// @vitest-environment jsdom
// The French cases of `tools/owa-devtools-mcp/destructiveLabel.test.mjs`, kept with the
// language's package so the language and its tests come and go together.
// They run against the same modules, which name no language.
import { beforeEach, describe, expect, it } from 'vitest';

import {
    DESTRUCTIVE_LABEL_PATTERNS,
    PRESS_GUARD_SOURCE,
    checkIsDestructiveLabelText,
    findKeyRefusal,
    findPressRefusal,
    genDestructiveLabelRule,
    toComparableLabel,
} from '../../../../../../../../tools/owa-devtools-mcp/destructiveLabel.mjs';
import { loadTranBundle } from '../../../../../../../../tools/owa-devtools-mcp/tran.mjs';

// The app's REAL dictionary, not a fixture: the rule is derived from it, and a
// translation added or changed tomorrow is exactly what these must keep up
// with. English alone is the rule with no dictionaries at all.
const REAL_BUNDLE = loadTranBundle();
const REAL_RULE = genDestructiveLabelRule(REAL_BUNDLE);
const ENGLISH_RULE = genDestructiveLabelRule({ dictionaries: {} });
const KHMER = REAL_BUNDLE.dictionaries.km ?? {};

function checkIsEnglishDestructiveKey(key) {
    const comparable = toComparableLabel(key);
    return DESTRUCTIVE_LABEL_PATTERNS.some((pattern) => {
        return pattern.test(comparable);
    });
}

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('toComparableLabel', () => {
    it('reads a label the way the matcher that presses it does', () => {
        expect(toComparableLabel('Clear All')).toBe('clear all');
        expect(toComparableLabel('  Clear   All  ')).toBe('clear all');
        expect(toComparableLabel('Clear All [F6]')).toBe('clear all');
        expect(toComparableLabel('Ｄｅｌｅｔｅ')).toBe(
            'delete',
        );
        expect(toComparableLabel('Del​ete')).toBe('delete');
        expect(toComparableLabel('🗑 Move to Trash…')).toBe('move to trash');
    });
});

describe('checkIsDestructiveLabelText, in English', () => {
    // Every one of these was a way past the old interlock: the matcher folds
    // the spacing before it compares, and the patterns did not.
    it('refuses what cannot be undone however it is spaced or dressed', () => {
        for (const label of [
            'Clear All',
            'Clear  All',
            'CLEAR-ALL',
            'Ｄｅｌｅｔｅ',
            'Del​ete',
            'Move to Trash…',
            '🗑 Move to Trash',
            'Clear All [F6]',
            'Sign out',
            'Log  Out',
            'Discard Changed',
        ]) {
            expect(checkIsDestructiveLabelText(label, ENGLISH_RULE), label).toBe(
                true,
            );
        }
    });
});
