// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import {
    DESTRUCTIVE_LABEL_PATTERNS,
    PRESS_GUARD_SOURCE,
    checkIsDestructiveLabelText,
    findKeyRefusal,
    findPressRefusal,
    genDestructiveLabelRule,
    toComparableLabel,
} from './destructiveLabel.mjs';
import { listLangPacks, readLangPackDictionary } from './langPacks.mjs';

// The app's REAL dictionaries, not a fixture: the rule is derived from them,
// and a translation added or changed tomorrow is exactly what these must keep
// up with. In the app the rule is built from English and the languages
// INSTALLED -- one or two (`langPacks.mjs`) -- so each language is held to
// the rule of an app with it alone installed. English alone is the rule with
// no dictionaries at all.
const RULE_CASE_LIST = listLangPacks().map((pack) => {
    const dictionary = readLangPackDictionary(pack);
    return {
        code: pack.code,
        dictionary,
        rule: genDestructiveLabelRule({
            dictionaries: { [pack.code]: dictionary },
        }),
    };
});
// Every one of those installed at once: what the page half and the phrase
// pruning are checked against.
const REAL_RULE = genDestructiveLabelRule({
    dictionaries: Object.fromEntries(
        RULE_CASE_LIST.map(({ code, dictionary }) => {
            return [code, dictionary];
        }),
    ),
});
const ENGLISH_RULE = genDestructiveLabelRule({ dictionaries: {} });
// Every language package's dictionary but English's -- none in an
// English-only tree; a language's own facts are its package's tests.
const OTHER_DICTIONARY_LIST = RULE_CASE_LIST.map(({ dictionary }) => {
    return dictionary;
});

function checkIsEnglishDestructiveKey(key) {
    const comparable = toComparableLabel(key);
    return DESTRUCTIVE_LABEL_PATTERNS.some((pattern) => {
        return pattern.test(comparable);
    });
}

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('checkIsDestructiveLabelText, in English', () => {
    // Every one of these was a way past the old interlock: the matcher folds
    // the spacing before it compares, and the patterns did not.
    it('refuses what cannot be undone however it is spaced or dressed', () => {
        for (const label of [
            'Clear All',
            'Clear  All',
            'CLEAR-ALL',
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

    it('leaves the ordinary controls alone', () => {
        for (const label of [
            'Clear Long Text [F9]',
            'Clear Slide [F8]',
            'Clear',
            'Reset Widgets Size',
            'Undelete',
            'Preset',
            'Removed',
            'Toggle showing screen [F5]',
        ]) {
            expect(checkIsDestructiveLabelText(label, ENGLISH_RULE), label).toBe(
                false,
            );
        }
    });

    it('refuses nothing without a rule', () => {
        expect(checkIsDestructiveLabelText('Delete', null)).toBe(false);
    });
});

describe('the rule, derived from the app dictionary', () => {
    // The finding that started this: 41 destructive labels had translations
    // in an installed language and not one was refused.
    it('refuses the translation of every destructive label', () => {
        for (const { code, dictionary, rule } of RULE_CASE_LIST) {
            // Once, not per entry: a translation the dictionary also gives an
            // ordinary label is left to the app's own confirm (the test below).
            const allowedComparableSet = new Set(
                Object.entries(dictionary)
                    .filter(([key]) => {
                        return !checkIsEnglishDestructiveKey(key);
                    })
                    .map(([, text]) => {
                        return toComparableLabel(text);
                    }),
            );
            const missedList = Object.entries(dictionary).filter(([key, value]) => {
                const comparable = toComparableLabel(value);
                return (
                    checkIsEnglishDestructiveKey(key) &&
                    comparable.length <= 60 &&
                    !allowedComparableSet.has(comparable) &&
                    !checkIsDestructiveLabelText(value, rule)
                );
            });
            expect(missedList, code).toEqual([]);
            expect(
                checkIsDestructiveLabelText(dictionary['move to trash'], rule),
                code,
            ).toBe(true);
            expect(
                checkIsDestructiveLabelText(dictionary['clear all'], rule),
                code,
            ).toBe(true);
            expect(
                checkIsDestructiveLabelText(`${dictionary['clear all']} [F6]`, rule),
                code,
            ).toBe(true);
        }
    });

    // The other half, and the one a firewall usually gets wrong: an ordinary
    // control refused is a tool the model learns to route around.
    it('refuses no translation of an ordinary label', () => {
        for (const { code, dictionary, rule } of RULE_CASE_LIST) {
            const refusedList = Object.entries(dictionary).filter(([key, value]) => {
                return (
                    !checkIsEnglishDestructiveKey(key) &&
                    checkIsDestructiveLabelText(value, rule)
                );
            });
            expect(refusedList, code).toEqual([]);
        }
    });

    // A language written with spaces must never have a word caught inside a
    // longer one -- "Undelete" is the English case of the same mistake.
    it('never finds a word inside a longer word of a spaced script', () => {
        const rule = genDestructiveLabelRule({
            dictionaries: { xx: { delete: 'Zorbat', ok: 'Fine' } },
        });
        expect(checkIsDestructiveLabelText('Zorbat', rule)).toBe(true);
        expect(checkIsDestructiveLabelText('Zorbat (3)', rule)).toBe(true);
        expect(checkIsDestructiveLabelText('Zorbatika', rule)).toBe(false);
    });

    // A longer phrase the shorter one already refuses is not carried -- and
    // what it would have refused still is (2026-11-04: 5 085 characters, over
    // the cap, became 4 307 with the same refusals).
    it('carries no phrase the rest of the rule already refuses', () => {
        const rule = genDestructiveLabelRule({
            dictionaries: {
                xx: {
                    delete: 'zap',
                    'delete item': 'zap item',
                    'delete it all now': 'all zap now',
                    'erase a word': 'zapper',
                    ok: 'fine',
                },
            },
        });
        expect(rule.containPhrases).toEqual(['zap', 'zapper']);
        for (const label of ['zap item', 'all zap now', 'zapper', 'zap']) {
            expect(checkIsDestructiveLabelText(label, rule)).toBe(true);
        }
        expect(checkIsDestructiveLabelText('fine', rule)).toBe(false);
        // Every phrase the real dictionaries call destructive is still refused.
        const fullContainList = [];
        for (const dictionary of OTHER_DICTIONARY_LIST) {
            for (const [key, value] of Object.entries(dictionary)) {
                const comparable = toComparableLabel(value);
                if (
                    checkIsEnglishDestructiveKey(key) &&
                    comparable.length > 0 &&
                    comparable.length <= 60 &&
                    !REAL_RULE.exactPhrases.includes(comparable)
                ) {
                    fullContainList.push(comparable);
                }
            }
        }
        const missedList = fullContainList.filter((phrase) => {
            return (
                REAL_RULE.containPhrases.some((kept) => {
                    return phrase.includes(kept);
                }) && !checkIsDestructiveLabelText(phrase, REAL_RULE)
            );
        });
        expect(missedList).toEqual([]);
    });

    // 4 000 until 2026-10-16, when the help window's own words joined the
    // dictionary in the languages then translated (its "Moving your song to
    // the trash" lines, "Clear all chats…"): 3 915 to 4 665. Still a few kilobytes of
    // JSON a press carries to the page, read by no model. Per language since
    // 2026-11-04: an app carries the rule of the languages it has installed.
    it('stays small enough to ride every press', () => {
        expect(RULE_CASE_LIST.length).toBe(OTHER_DICTIONARY_LIST.length);
        for (const { code, rule } of RULE_CASE_LIST) {
            expect(JSON.stringify(rule).length, code).toBeLessThan(5000);
        }
    });
});

describe('the guard the page is sent', () => {
    // The page receives these functions as TEXT. A module variable one of them
    // leant on would be a ReferenceError there and nowhere in a unit test.
    it('is the same functions, and needs nothing from this module', () => {
        const page = new Function(`return (${PRESS_GUARD_SOURCE})`)();
        for (const label of [
            'Clear All',
            'Clear Long Text [F9]',
            'Undelete',
            ...OTHER_DICTIONARY_LIST.flatMap((dictionary) => {
                return [
                    dictionary['move to trash'],
                    dictionary['clear long text'],
                ].filter(Boolean);
            }),
        ]) {
            expect(page.checkIsDestructiveLabelText(label, REAL_RULE), label).toBe(
                checkIsDestructiveLabelText(label, REAL_RULE),
            );
        }
        document.body.innerHTML = '<button title="Delete">x</button>';
        expect(
            page.findPressRefusal(document.querySelector('button'), REAL_RULE),
        ).toEqual({ refused: 'destructive', label: 'Delete' });
    });
});

describe('findPressRefusal', () => {
    it('reads a title that says what the button text does not', () => {
        document.body.innerHTML = '<button title="Delete this preset">✕</button>';
        expect(
            findPressRefusal(document.querySelector('button'), REAL_RULE),
        ).toEqual({ refused: 'destructive', label: 'Delete this preset' });
    });

    // A row or a slide card carries content. A hymn saying "remove my sin"
    // must not make its own card unpressable.
    it('does not read the text of something that is not a control', () => {
        document.body.innerHTML =
            '<div aria-label="Slide 3: Amazing Grace">Remove my sin</div>';
        expect(
            findPressRefusal(document.querySelector('div'), REAL_RULE),
        ).toBeNull();
    });

    it('does not read a picker by every option it offers', () => {
        document.body.innerHTML =
            '<select><option>Keep</option><option>Delete</option></select>';
        expect(
            findPressRefusal(document.querySelector('select'), REAL_RULE),
        ).toBeNull();
    });

    // "Click Delete, then Yes" must not confirm its own dialog, in any
    // language -- which is also what stands behind a translation the rule
    // cannot tell from an allowed control.
    it('never answers a question the app is asking', () => {
        document.body.innerHTML =
            '<div id="modal-container" class="modal-container--blocking">' +
            '<div id="app-confirm-popup"><button id="yes">Yes</button></div>' +
            '</div><button id="other">Yes</button>';
        expect(
            findPressRefusal(document.getElementById('yes'), REAL_RULE),
        ).toEqual({ refused: 'question' });
        expect(
            findPressRefusal(document.getElementById('other'), REAL_RULE),
        ).toBeNull();
    });
});

describe('findKeyRefusal', () => {
    // A key has no label, so it is as destructive as the control whose title
    // names it: F6 is Clear All, F9 is Clear Long Text.
    it('judges a key by the control whose title names it', () => {
        document.body.innerHTML =
            '<button title="Clear All [F6]">A</button>' +
            '<button title="Clear Long Text [F9]">B</button>';
        expect(findKeyRefusal({ label: 'F6' }, REAL_RULE, document)).toEqual({
            refused: 'destructive',
            label: 'Clear All [F6]',
        });
        expect(findKeyRefusal({ label: 'F9' }, REAL_RULE, document)).toBeNull();
    });

    it('refuses a key by its own name, and nothing it cannot read', () => {
        expect(findKeyRefusal({ label: 'Delete' }, REAL_RULE, document)).toEqual(
            { refused: 'destructive', label: 'Delete' },
        );
        expect(findKeyRefusal({ label: 'F6' }, REAL_RULE, document)).toBeNull();
        expect(findKeyRefusal(null, REAL_RULE, document)).toBeNull();
    });
});
