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
import { loadTranBundle } from './tran.mjs';

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

    it('leaves the ordinary controls alone', () => {
        for (const label of [
            'Clear Bible [F9]',
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
    // The finding that started this: 41 destructive labels had Khmer
    // translations and not one was refused.
    it('refuses the translation of every destructive label', () => {
        // Once, not per entry: a translation the dictionary also gives an
        // ordinary label is left to the app's own confirm (the test below).
        const allowedComparableSet = new Set(
            Object.entries(KHMER)
                .filter(([key]) => {
                    return !checkIsEnglishDestructiveKey(key);
                })
                .map(([, text]) => {
                    return toComparableLabel(text);
                }),
        );
        const missedList = Object.entries(KHMER).filter(([key, value]) => {
            const comparable = toComparableLabel(value);
            return (
                checkIsEnglishDestructiveKey(key) &&
                comparable.length <= 60 &&
                !allowedComparableSet.has(comparable) &&
                !checkIsDestructiveLabelText(value, REAL_RULE)
            );
        });
        expect(missedList).toEqual([]);
        expect(
            checkIsDestructiveLabelText(KHMER['move to trash'], REAL_RULE),
        ).toBe(true);
        expect(checkIsDestructiveLabelText(KHMER['clear all'], REAL_RULE)).toBe(
            true,
        );
        expect(
            checkIsDestructiveLabelText(`${KHMER['clear all']} [F6]`, REAL_RULE),
        ).toBe(true);
    });

    // The other half, and the one a firewall usually gets wrong: an ordinary
    // control refused is a tool the model learns to route around.
    it('refuses no translation of an ordinary label', () => {
        const refusedList = Object.entries(KHMER).filter(([key, value]) => {
            return (
                !checkIsEnglishDestructiveKey(key) &&
                checkIsDestructiveLabelText(value, REAL_RULE)
            );
        });
        expect(refusedList).toEqual([]);
    });

    // `លុបព្រះគម្ពីរ` is both Delete Bible and Clear Bible. The window cannot
    // tell them apart, so the allowed reading wins and the app's own confirm
    // stands behind the other.
    it('leaves a translation shared with an allowed control to the app', () => {
        expect(KHMER['clear bible']).toBe(KHMER['delete bible']);
        expect(
            checkIsDestructiveLabelText(`${KHMER['clear bible']} [F9]`, REAL_RULE),
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

    // A language written with spaces must never have a word caught inside a
    // longer one -- "Undelete" is the English case of the same mistake.
    it('never finds a word inside a longer word of a spaced script', () => {
        const rule = genDestructiveLabelRule({
            dictionaries: { fr: { delete: 'Supprimer', ok: 'Valider' } },
        });
        expect(checkIsDestructiveLabelText('Supprimer', rule)).toBe(true);
        expect(checkIsDestructiveLabelText('Supprimer (3)', rule)).toBe(true);
        expect(checkIsDestructiveLabelText('Supprimerai', rule)).toBe(false);
    });

    it('stays small enough to ride every press', () => {
        expect(JSON.stringify(REAL_RULE).length).toBeLessThan(4000);
    });
});

describe('the guard the page is sent', () => {
    // The page receives these functions as TEXT. A module variable one of them
    // leant on would be a ReferenceError there and nowhere in a unit test.
    it('is the same functions, and needs nothing from this module', () => {
        const page = new Function(`return (${PRESS_GUARD_SOURCE})`)();
        for (const label of [
            'Clear All',
            'Clear Bible [F9]',
            'Undelete',
            KHMER['move to trash'],
            KHMER['clear bible'],
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
    // names it: F6 is Clear All, F9 is Clear Bible.
    it('judges a key by the control whose title names it', () => {
        document.body.innerHTML =
            '<button title="Clear All [F6]">A</button>' +
            '<button title="Clear Bible [F9]">B</button>';
        expect(findKeyRefusal({ label: 'F6' }, REAL_RULE, document)).toEqual({
            refused: 'destructive',
            label: 'Clear All [F6]',
        });
        expect(findKeyRefusal({ label: 'F9' }, REAL_RULE, document)).toBeNull();
    });

    it('reads that title in the language it is written in', () => {
        document.body.innerHTML = `<button title="${KHMER['clear all']} [F6]">A</button>`;
        expect(
            findKeyRefusal({ label: 'F6' }, REAL_RULE, document)?.refused,
        ).toBe('destructive');
    });

    it('refuses a key by its own name, and nothing it cannot read', () => {
        expect(findKeyRefusal({ label: 'Delete' }, REAL_RULE, document)).toEqual(
            { refused: 'destructive', label: 'Delete' },
        );
        expect(findKeyRefusal({ label: 'F6' }, REAL_RULE, document)).toBeNull();
        expect(findKeyRefusal(null, REAL_RULE, document)).toBeNull();
    });
});
