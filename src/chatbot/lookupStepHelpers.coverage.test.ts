import { describe, expect, test } from 'vitest';

import {
    genCrossRefsAnswer,
    genRelatedAnswer,
    genVersesAnswer,
} from './lookupStepHelpers';

// The lookup card's buttons where the record repeats itself or is missing a
// part: two places of one name, a quoted verse with no key, and a reference
// both cited and "around". (An installed Bible with nothing to tell its
// language by is in a language package's own tests.)

const RUTH = {
    kind: 'name' as const,
    target: 'ruth',
    title: 'Ruth',
};

const GEN_8 = {
    kind: 'verse' as const,
    target: 'GEN 8:1-22',
    title: 'Genesis 8:1-22',
    bibleKey: 'KJV',
};

function toLabels(actions: { label: string }[]) {
    return actions.map((action) => {
        return action.label;
    });
}

describe('two buttons that would read the same', () => {
    test('are one: two places of one name are a single button', () => {
        const answer = genRelatedAnswer(RUTH, {
            places: [
                { id: 'bethlehem-judah', name: 'Bethlehem' },
                { id: 'moab', name: 'Moab' },
                { id: 'bethlehem-zebulun', name: 'Bethlehem' },
            ],
        });
        expect(toLabels(answer.actions)).toEqual(['Bethlehem', 'Moab']);
        // The one kept is the first the record lists.
        expect(answer.actions[0].args.ask.target).toBe('bethlehem-judah');
    });
});

describe('its verses, when one of them has no key', () => {
    test('the verse with no key is no button, and the count says how many there are', () => {
        const answer = genVersesAnswer(RUTH, {
            bible: 'KJV',
            verseCount: 12,
            quoted: [
                { ref: 'Ruth 1:16' },
                { key: 'RUT 1:4', ref: 'Ruth 1:4' },
                { key: 'RUT 4:13', title: 'Ruth 4:13' },
            ],
        });
        expect(toLabels(answer.actions)).toEqual(['Ruth 1:4', 'Ruth 4:13']);
        expect(answer.actions[0].args.ask).toEqual({
            kind: 'verse',
            target: 'RUT 1:4',
            title: 'Ruth 1:4',
            bibleKey: 'KJV',
        });
        expect(answer.text).toBe(
            'Verses about Ruth. Press one to read it with me. The names ' +
                'lookup lists 12 verses; these are the first 2.',
        );
    });
});

describe('related verses named twice', () => {
    test('a reference both most cited and about the chapters around is one button', () => {
        const answer = genCrossRefsAnswer(GEN_8, {
            bible: 'KJV',
            crossRefs: {
                referenceCount: 40,
                otherTestamentName: 'New Testament',
                mostCited: [{ key: 'HEB 11:7', title: 'Hebrews 11:7' }],
                otherTestamentAround: [
                    { key: 'HEB 11:7', title: 'Hebrews 11:7' },
                    { key: 'LUK 17:26', title: 'Luke 17:26' },
                ],
            },
        });
        expect(toLabels(answer.actions)).toEqual([
            'Hebrews 11:7',
            'Luke 17:26',
        ]);
        expect(answer.text).toContain(
            '**In the New Testament, about the chapters around it**\n' +
                '- **Hebrews 11:7**\n- **Luke 17:26**',
        );
    });
});
