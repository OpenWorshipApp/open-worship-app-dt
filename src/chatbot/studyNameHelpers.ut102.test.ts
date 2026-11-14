import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    type StudyNameGuideType,
    type StudyNameWordsType,
    countStudyWordPlaces,
    listStudyNameOtherLetters,
    listStudyNameSlips,
    listStudyNameWords,
    readStudyQuoteVerses,
    toStudyNameGuide,
} from './studyNameHelpers';

// A made-up language written in one Unicode block whose vowels are signs on
// its letters, made by code point so no word of any language is written here
// (the fixture of `studyNameHelpers.test.ts`, copied).
function letter(index: number) {
    return String.fromCodePoint(0x1000 + index);
}
const VOWEL_I = String.fromCodePoint(0x102d);
const VOWEL_II = String.fromCodePoint(0x102e);
const VOWEL_U = String.fromCodePoint(0x102f);
const DOT_BELOW = String.fromCodePoint(0x1037);
// A letter with its vowel sign written as ONE character, and the two it is
// made of.
const LETTER_U = String.fromCodePoint(0x1025);
const LETTER_UU = String.fromCodePoint(0x1026);

function toScriptDigits(text: string) {
    return text.replace(/\d/g, (digit) => {
        return String.fromCodePoint(0x1040 + Number(digit));
    });
}

const ZENON = `${letter(0)}${VOWEL_I}${letter(1)}${letter(2)}${VOWEL_U}`;
const ZENON_SLIP = `${letter(0)}${VOWEL_II}${letter(1)}${letter(2)}${VOWEL_U}`;
const QALIM = `${letter(3)}${VOWEL_U}${letter(4)}${letter(5)}${VOWEL_I}`;
const VORDAN = `${letter(6)}${VOWEL_U}${letter(7)}${VOWEL_I}${letter(8)}`;
const PHARISEES = `${letter(9)}${VOWEL_I}${letter(10)}${letter(11)}${VOWEL_I}`;
const PHARISEES_LISTED = `${letter(9)}${VOWEL_II}${letter(10)}${letter(11)}${VOWEL_I}`;
const FILLER_A = `${letter(12)}${letter(13)}`;
const FILLER_B = `${letter(14)}${VOWEL_U}${letter(15)}${letter(16)}`;
const FILLER_C = `${letter(17)}${letter(18)}${VOWEL_I}${letter(19)}`;
// Three letters and no vowel sign: no word a name check reads.
const BARE_WORD = `${letter(24)}${letter(25)}${letter(26)}`;
// Two letters, and the same a vowel sign apart.
const SHORT_WORD = `${letter(12)}${VOWEL_I}${letter(13)}`;
const SHORT_SLIP = `${letter(12)}${VOWEL_II}${letter(13)}`;

const ENGLISH_PASSAGE = [
    '> **John 3:22-26** (KJV)',
    '>',
    '> **22** After these things came Jesus and his disciples into the ' +
        'land of Judea; and the Pharisees saw him.',
    '>',
    '> **23** And John also was baptizing in Zenon near to Qalim, ' +
        'because there was much water there.',
    '>',
    '> **26** And they came unto John, and said unto him, Rabbi, he ' +
        'that was with thee beyond Vordan.',
].join('\n');

const VERSE_22 = `${FILLER_A} ${FILLER_B} ${PHARISEES} ${FILLER_A}`;
const VERSE_23 = `${FILLER_A} ${ZENON} ${FILLER_A} ${QALIM}.`;
const VERSE_26 = `${FILLER_A} ${FILLER_C} ${VORDAN}`;

function genQuoted(withVerse26 = true) {
    return [
        `> **${FILLER_A} ${toScriptDigits('3:22-26')}** (ZB)`,
        '>',
        `> **${toScriptDigits('22')}** ${VERSE_22}`,
        '>',
        `> **${toScriptDigits('23')}** ${VERSE_23}`,
        ...(withVerse26
            ? ['>', `> **${toScriptDigits('26')}** ${VERSE_26}`]
            : []),
    ].join('\n');
}

function genParts(quoted: string) {
    return [{ kind: 'passage', text: ENGLISH_PASSAGE, quoted }];
}

describe('the study name guide, the rest (UT-102)', () => {
    it('reads a letter written whole with its vowel sign as the two it is made of', () => {
        const whole = `${letter(3)}${LETTER_UU}${letter(4)}`;
        const parts = `${letter(3)}${LETTER_U}${VOWEL_II}${letter(4)}`;
        expect(countStudyWordPlaces(`${FILLER_A} ${whole}`, parts)).toBe(1);
        expect(countStudyWordPlaces(`${FILLER_A} ${parts}`, whole)).toBe(1);
        // Another vowel sign on that letter is no place of it.
        const other = `${letter(3)}${LETTER_U}${VOWEL_I}${VOWEL_I}${letter(4)}`;
        expect(countStudyWordPlaces(other, whole)).toBe(0);
    });

    it('leaves a church word listed with no letters as it was, unspelled', () => {
        const blank = toStudyNameGuide(genParts(genQuoted()), {
            Pharisees: '',
        });
        expect(blank.terms).toEqual({ Pharisees: '' });
        expect(blank.spellingMap.has('Pharisees')).toBe(false);
        // Listed with letters, the verse's own spelling is taken.
        const listed = toStudyNameGuide(genParts(genQuoted()), {
            Pharisees: PHARISEES_LISTED,
        });
        expect(listed.spellingMap.get('Pharisees')).toBe(PHARISEES);
    });

    it('gives no verse to a name whose verse the translation did not quote', () => {
        const whole = toStudyNameGuide(genParts(genQuoted()), {});
        expect(whole.verseMap.get('Vordan')).toEqual([
            { key: '26', text: VERSE_26, words: [FILLER_C, VORDAN] },
        ]);
        const short = toStudyNameGuide(genParts(genQuoted(false)), {});
        expect(short.verseMap.has('Vordan')).toBe(false);
        expect(short.verseMap.has('Zenon')).toBe(true);
    });

    it('reads no slip off a verse word too short or with no vowel sign', () => {
        const guide: StudyNameGuideType = {
            verseMap: new Map([
                [
                    'Zenon',
                    [
                        {
                            key: '23',
                            text: VERSE_23,
                            words: [SHORT_WORD, BARE_WORD, ZENON],
                        },
                    ],
                ],
            ]),
            spellingMap: new Map(),
            terms: {},
            wordSet: new Set(),
            nameWords: { nameMap: new Map(), wordSet: new Set() },
        };
        // The two-letter word is written a vowel sign apart too: too short
        // to be read, only the name is named.
        const translated = `${SHORT_SLIP} ${BARE_WORD} ${ZENON_SLIP}`;
        expect(listStudyNameSlips('Near Zenon.', translated, guide)).toEqual([
            { written: ZENON_SLIP, spelling: ZENON, key: '23' },
        ]);
    });
});

// The river of `studyNameHelpers.test.ts`: its verse's word, and the
// translation's word with other letters for it.
const RIVER =
    `${letter(20)}${DOT_BELOW}${letter(21)}` +
    `${letter(22)}${VOWEL_U}${letter(23)}`;
const RIVER_SLIP = `${letter(20)}${VOWEL_I}${letter(22)}${VOWEL_U}${letter(23)}`;
const RIVER_ENGLISH = readStudyQuoteVerses(
    '> **5** And they crossed the Rivon by night.\n>\n' +
        '> **6** And they slept there.',
);
const RIVER_TARGET = readStudyQuoteVerses(
    `> **5** ${FILLER_A} ${RIVER} ${FILLER_C}\n>\n` +
        `> **6** ${FILLER_A} ${FILLER_B}`,
);

describe('a name written with other letters, the rest (UT-102)', () => {
    const checkIsAny = () => {
        return true;
    };

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('names a place two names come to once, for the first', () => {
        const words = listStudyNameWords(RIVER_ENGLISH, RIVER_TARGET);
        const riverWords = words.nameMap.get('Rivon')!;
        expect(riverWords).toBeDefined();
        const both: StudyNameWordsType = {
            ...words,
            nameMap: new Map([
                ['Rivon', riverWords],
                ['Rivonite', riverWords],
            ]),
        };
        expect(
            listStudyNameOtherLetters(
                'The Rivon and a Rivonite.',
                RIVER_SLIP,
                both,
                checkIsAny,
            ),
        ).toEqual([
            {
                name: 'Rivon',
                start: 0,
                end: RIVER_SLIP.length,
                spelling: RIVER,
                key: '5',
            },
        ]);
    });

    it('takes every place as whole words where the platform breaks no words', async () => {
        vi.resetModules();
        const fresh = await import('./studyNameHelpers');
        vi.stubGlobal(
            'Intl',
            Object.create(Intl, { Segmenter: { value: undefined } }),
        );
        const words = fresh.listStudyNameWords(RIVER_ENGLISH, RIVER_TARGET);
        expect(
            fresh.listStudyNameOtherLetters(
                'Rivon',
                RIVER_SLIP,
                words,
                checkIsAny,
            ),
        ).toEqual([
            {
                name: 'Rivon',
                start: 0,
                end: RIVER_SLIP.length,
                spelling: RIVER,
                key: '5',
            },
        ]);
    });
});
