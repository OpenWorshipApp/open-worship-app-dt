// @vitest-environment jsdom
// The Khmer cases of `tools/owa-devtools-mcp/destructiveLabel.test.mjs`, kept with the
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

describe('the rule, derived from the app dictionary', () => {

    // `លុបផ្ទៃខាងក្រោយ` is both Remove Background and Clear Background. The
    // window cannot tell them apart, so the allowed reading wins and the
    // app's own confirm stands behind the other.
    it('leaves a translation shared with an allowed control to the app', () => {
        expect(KHMER['clear background']).toBe(KHMER['remove background']);
        expect(
            checkIsDestructiveLabelText(
                `${KHMER['clear background']} [F7]`,
                REAL_RULE,
            ),
        ).toBe(false);
        expect(checkIsDestructiveLabelText(KHMER.clear, REAL_RULE)).toBe(false);
    });

    it('keeps a phrase found inside an ordinary sentence to a whole label', () => {
        const rule = genDestructiveLabelRule({
            dictionaries: {
                km: {
                    'sign out': 'ចាកចេញពីគណនី',
                    'signed out from songselect': 'បានចាកចេញពីគណនី SongSelect',
                },
            },
        });
        expect(rule.exactPhrases).toContain('ចាកចេញពីគណនី');
        expect(checkIsDestructiveLabelText('ចាកចេញពីគណនី', rule)).toBe(true);
        expect(
            checkIsDestructiveLabelText('បានចាកចេញពីគណនី SongSelect', rule),
        ).toBe(false);
    });
});

describe("the rule, derived from the app dictionary", () => {

    // Until 2026-10-13 the F9 button was Clear Bible, and its Khmer was
    // Delete Bible's too. It is Clear Long Text now, with words of its own:
    // the ordinary press stays ordinary, and the phrase it left behind is
    // Delete Bible's alone, so it is refused.
    it('refuses a translation once no allowed control shares it', () => {
        expect(KHMER['clear long text']).toBeTruthy();
        expect(KHMER['clear long text']).not.toBe(KHMER['delete bible']);
        expect(
            checkIsDestructiveLabelText(
                `${KHMER['clear long text']} [F9]`,
                REAL_RULE,
            ),
        ).toBe(false);
        expect(
            checkIsDestructiveLabelText(KHMER['delete bible'], REAL_RULE),
        ).toBe(true);
    });
});

describe("findPressRefusal", () => {

    it('reads a context menu item in the language it is written in', () => {
        document.body.innerHTML =
            `<div class="app-context-menu-item" title="${KHMER['move to trash']}">` +
            `<div>${KHMER['move to trash']}</div></div>`;
        expect(
            findPressRefusal(
                document.querySelector('.app-context-menu-item'),
                REAL_RULE,
            )?.refused,
        ).toBe('destructive');
    });
});

describe("findKeyRefusal", () => {

    it('reads that title in the language it is written in', () => {
        document.body.innerHTML = `<button title="${KHMER['clear all']} [F6]">A</button>`;
        expect(
            findKeyRefusal({ label: 'F6' }, REAL_RULE, document)?.refused,
        ).toBe('destructive');
    });
});

// From `tools/owa-devtools-mcp/destructiveLabel.coverage.test.mjs`.
describe('genDestructiveLabelRule', () => {
    // English is the patterns' job, a language with no dictionary loaded has
    // nothing to give, and only a string is a translation.
    it('reads only the translated strings of the other languages', () => {
        const rule = genDestructiveLabelRule({
            dictionaries: {
                en: { Delete: 'Supprimer' },
                fr: null,
                xx: 'not a dictionary',
                km: {
                    'Move to Trash': 'ផ្លាស់ទីទៅធុងសំរាម',
                    'Delete All': ['លុបទាំងអស់'],
                    'Clear Long Text': 'សម្អាតអត្ថបទវែង',
                    Count: 3,
                },
            },
        });
        expect(rule.containPhrases).toEqual(['ផ្លាស់ទីទៅធុងសំរាម']);
        expect(rule.exactPhrases).toEqual([]);
        expect(rule.patterns.length).toBeGreaterThan(0);
        expect(rule.patterns[0]).toEqual({ source: '\\bdelete\\b', flags: 'i' });
    });
});
