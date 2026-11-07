import { describe, expect, test } from 'vitest';

import { genStudyVersesAnswer, listStudyVerses } from './wordStudyHelpers';

// **Study the words** where a record is odd: a passage with no key to read
// it by, a psalm's title numbered 0, and a passage none of whose words could
// be read. (A Thai verse, whose first "words" are one long run, is in
// `src/lang/data/tests/`.)

// A passage card titled as its Bible titles it; a symbol stands in for the
// Bible's own words.
const ASK = {
    kind: 'verse' as const,
    target: 'GEN 1:1-2',
    title: '✝ 1:1-2',
    bibleKey: 'XX',
};

describe('the verses of a record', () => {
    test('a passage with no key it can be read by is left out, and a verse 0 is no verse', () => {
        const verses = listStudyVerses({
            kind: 'verse',
            passages: [
                { ref: 'Psalms 23', text: '(1): The LORD is my shepherd' },
                { key: 'Psalm 23', text: '(1): The LORD is my shepherd' },
                {
                    key: 'PSA 23:1-2',
                    ref: 'Psalms 23:1-2',
                    // Some Bibles number a psalm's title as its verse 0.
                    text:
                        '(0): A Psalm of David. (1): The LORD is my ' +
                        'shepherd; I shall not want. (2): He maketh me to ' +
                        'lie down',
                },
            ],
        });
        expect(
            verses.map((verse) => {
                return [verse.key, verse.ref, verse.text];
            }),
        ).toEqual([
            [
                'PSA 23:1',
                'Psalms 23:1',
                'The LORD is my shepherd; I shall not want.',
            ],
            ['PSA 23:2', 'Psalms 23:2', 'He maketh me to lie down'],
        ]);
    });
});

describe('a passage with no words read', () => {
    test('says the words could not be read, and offers no button', () => {
        expect(genStudyVersesAnswer(ASK, [])).toEqual({
            text: 'I could not read the words of ✝ 1:1-2 just now.',
            actions: [],
        });
    });
});
