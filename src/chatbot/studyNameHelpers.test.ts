import { describe, expect, it } from 'vitest';

import {
    type StudyNameGuideType,
    type StudyNameSlipType,
    type StudyNameVerseType,
    countStudyWordPlaces,
    findStudyWordVariants,
    listStudyNameLetterPlaces,
    listStudyNameOtherLetters,
    listStudyNameSlips,
    listStudyNameSpellings,
    listStudyNameWords,
    listStudyPassageNames,
    pairStudyBoldSpans,
    readStudyQuoteVerses,
    repairStudyNameSpellings,
    toStudyNameGuide,
    toStudyNameVersesText,
} from './studyNameHelpers';

// A made-up language written in one Unicode block whose vowels are signs on
// its letters: its letters, vowel signs and digits made by code point, so no
// word of any language is written here.
function letter(index: number) {
    return String.fromCodePoint(0x1000 + index);
}
const VOWEL_I = String.fromCodePoint(0x102d);
const VOWEL_II = String.fromCodePoint(0x102e);
const VOWEL_U = String.fromCodePoint(0x102f);
// A sign that is no vowel: it joins a letter to the next.
const VIRAMA = String.fromCodePoint(0x1039);
// A sign any writer may put on or leave off.
const ACUTE = String.fromCodePoint(0x0301);
// The invisible gap a Bible's text puts between words.
const GAP = String.fromCodePoint(0x200b);

function toScriptDigits(text: string) {
    return text.replace(/\d/g, (digit) => {
        return String.fromCodePoint(0x1040 + Number(digit));
    });
}

// The Bible's words for three places and a people, and the ways a
// translation or a list of church words writes them otherwise.
const ZENON = `${letter(0)}${VOWEL_I}${letter(1)}${letter(2)}${VOWEL_U}`;
const ZENON_SLIP = `${letter(0)}${VOWEL_II}${letter(1)}${letter(2)}${VOWEL_U}`;
const ZENON_TWO_SLIPS = `${letter(0)}${VOWEL_II}${letter(1)}${letter(2)}${VOWEL_I}`;
const QALIM = `${letter(3)}${VOWEL_U}${letter(4)}${letter(5)}${VOWEL_I}`;
const VORDAN = `${letter(6)}${VOWEL_U}${letter(7)}${VOWEL_I}${letter(8)}`;
const PHARISEES = `${letter(9)}${VOWEL_I}${letter(10)}${letter(11)}${VOWEL_I}`;
const PHARISEES_LISTED = `${letter(9)}${VOWEL_II}${letter(10)}${letter(11)}${VOWEL_I}`;
const PHARISEES_JOINED = `${letter(9)}${VIRAMA}${letter(10)}${letter(11)}${VOWEL_I}`;
// Words of the verses that are no name.
const FILLER_A = `${letter(12)}${letter(13)}`;
const FILLER_B = `${letter(14)}${VOWEL_U}${letter(15)}${letter(16)}`;
const FILLER_C = `${letter(17)}${letter(18)}${VOWEL_I}${letter(19)}`;

const ENGLISH_PASSAGE = [
    '> **John 3:22-26** (KJV)',
    '>',
    '> **22** After these things came Jesus and his disciples into the ' +
        'land of Judea; and the Pharisees saw him.',
    '>',
    '> **23** And John also was baptizing in Zenon near to Qalim, ' +
        'because there was much water there.',
    '>',
    '> **24** For John was not yet cast into prison.',
    '>',
    '> **26** And they came unto John, and said unto him, Rabbi, he ' +
        'that was with thee beyond Vordan.',
].join('\n');

const VERSE_22 = `${FILLER_A} ${FILLER_B}${GAP}${PHARISEES} ${FILLER_A}`;
const VERSE_23 = `${FILLER_A}${GAP}${ZENON} ${FILLER_A} ${QALIM}.`;
const VERSE_24 = `${FILLER_A} ${FILLER_C}`;
const VERSE_26 = `${FILLER_A} ${FILLER_B} ${VORDAN}`;
const QUOTED_PASSAGE = [
    `> **${FILLER_A} ${toScriptDigits('3:22-26')}** (ZB)`,
    '>',
    `> **${toScriptDigits('22')}** ${VERSE_22}`,
    '>',
    `> **${toScriptDigits('23')}** ${VERSE_23}`,
    '>',
    `> **${toScriptDigits('24')}** ${VERSE_24}`,
    '>',
    `> **${toScriptDigits('26')}** ${VERSE_26}`,
].join('\n');

// A guide's names by hand, each with one verse: name, verse, its words.
function genVerseMap(entryList: [name: string, key: string, text: string][]) {
    return new Map(
        entryList.map(([name, key, text]): [string, StudyNameVerseType[]] => {
            return [name, [{ key, text, words: [] }]];
        }),
    );
}

function genParts(quoted: string | null = QUOTED_PASSAGE) {
    return [
        { kind: 'text', text: '# The New Birth\n' },
        { kind: 'passage', text: ENGLISH_PASSAGE, quoted },
        { kind: 'text', text: '## Places\nZenon near Qalim.\n' },
    ];
}

describe('readStudyQuoteVerses', () => {
    it('reads each verse by its number in 0-9, whatever digits the Bible writes', () => {
        const verseMap = readStudyQuoteVerses(QUOTED_PASSAGE);
        expect([...verseMap.keys()]).toEqual(['22', '23', '24', '26']);
        expect(verseMap.get('23')).toBe(VERSE_23);
    });

    it('reads a verse across chapters by its chapter and verse, and nothing else', () => {
        const verseMap = readStudyQuoteVerses(
            '> **John 3:36-4:1** (KJV)\n>\n> **3:36** He that believeth.\n' +
                'A line of words.\n> **4.1** When therefore the Lord knew.',
        );
        expect([...verseMap.entries()]).toEqual([
            ['3:36', 'He that believeth.'],
            ['4:1', 'When therefore the Lord knew.'],
        ]);
    });
});

describe('listStudyPassageNames', () => {
    it('is each word written with a capital inside a sentence, with every verse it is in', () => {
        const nameMap = listStudyPassageNames(
            readStudyQuoteVerses(ENGLISH_PASSAGE),
        );
        expect(
            Object.fromEntries(
                [...nameMap.entries()].map(([name, keySet]) => {
                    return [name, [...keySet]];
                }),
            ),
        ).toEqual({
            Jesus: ['22'],
            Judea: ['22'],
            Pharisees: ['22'],
            John: ['23', '24', '26'],
            Zenon: ['23'],
            Qalim: ['23'],
            Rabbi: ['26'],
            Vordan: ['26'],
        });
    });

    it('leaves out a word starting a sentence, one also written small, a pronoun, a note and capitals', () => {
        const nameMap = listStudyPassageNames(
            new Map([
                [
                    '1',
                    'NOW THERE was a man; Then came the Water [Deut. 18:18.] to Zenon.',
                ],
                ['2', 'And the water was there, for Whom John sent.'],
                ['3', "He came to John's house."],
            ]),
        );
        expect([...nameMap.keys()]).toEqual(['Zenon', 'John']);
        expect([...(nameMap.get('John') ?? [])]).toEqual(['2', '3']);
    });
});

describe('toStudyNameGuide', () => {
    it('tells a church word as the passage writes it when one vowel sign is written otherwise', () => {
        const guide = toStudyNameGuide(genParts(), {
            Pharisees: PHARISEES_LISTED,
            'Son of Man': FILLER_C,
        });
        expect(guide.terms).toEqual({
            Pharisees: PHARISEES,
            'Son of Man': FILLER_C,
        });
        expect([...guide.spellingMap.entries()]).toEqual([
            ['Pharisees', PHARISEES],
        ]);
    });

    it('keeps a church word the passage writes as it is, a sign any writer may leave off aside', () => {
        const withAccent = `${letter(9)}${ACUTE}${VOWEL_I}${letter(10)}${letter(11)}${VOWEL_I}`;
        const guide = toStudyNameGuide(genParts(), { Pharisees: withAccent });
        expect(guide.terms).toEqual({ Pharisees: withAccent });
        expect(guide.spellingMap.get('Pharisees')).toBe(withAccent);
    });

    it('never takes a verse’s letters that are no word of it, a short word, or one with another sign', () => {
        const glued = genParts(
            QUOTED_PASSAGE.replace(
                `${GAP}${PHARISEES} `,
                `${PHARISEES}${FILLER_A}`,
            ),
        );
        expect(
            toStudyNameGuide(glued, { Pharisees: PHARISEES_LISTED }).terms,
        ).toEqual({ Pharisees: PHARISEES_LISTED });
        const shortWord = `${letter(9)}${VOWEL_II}${letter(10)}`;
        const shortParts = genParts(
            QUOTED_PASSAGE.replace(
                PHARISEES,
                `${letter(9)}${VOWEL_I}${letter(10)}`,
            ),
        );
        expect(
            toStudyNameGuide(shortParts, { Pharisees: shortWord }).terms,
        ).toEqual({ Pharisees: shortWord });
        expect(
            toStudyNameGuide(genParts(), { Pharisees: PHARISEES_JOINED }).terms,
        ).toEqual({ Pharisees: PHARISEES_JOINED });
    });

    it('gives each name the passage writes in a verse or two, and no church word gives, its verses as the Bible quoted writes them', () => {
        const guide = toStudyNameGuide(genParts(), {
            Pharisees: PHARISEES,
            Jesus: FILLER_C,
        });
        expect([...guide.verseMap.keys()]).toEqual([
            'Judea',
            'Zenon',
            'Qalim',
            'Rabbi',
            'Vordan',
        ]);
        // The verse's own words of three letters or more with a vowel sign:
        // the filler words are in other verses too, or too short.
        expect(guide.verseMap.get('Zenon')).toEqual([
            {
                key: '23',
                text: `${FILLER_A}${ZENON} ${FILLER_A} ${QALIM}.`,
                words: [ZENON, QALIM],
            },
        ]);
        expect(guide.verseMap.get('Vordan')?.[0].words).toEqual([VORDAN]);
        expect(guide.wordSet.has(PHARISEES)).toBe(true);
    });

    it('is empty with no passage quoted in the language, its church words as they were', () => {
        const terms = { Pharisees: PHARISEES_LISTED };
        const guide = toStudyNameGuide(genParts(null), terms);
        expect(guide.verseMap.size).toBe(0);
        expect(guide.spellingMap.size).toBe(0);
        expect(guide.terms).toEqual(terms);
        expect(guide.terms).not.toBe(terms);
    });
});

describe('toStudyNameVersesText', () => {
    const guide = toStudyNameGuide(genParts(), { Pharisees: PHARISEES });

    it('shows each name the words use with its verse as the Bible quoted writes it, a verse once', () => {
        expect(
            toStudyNameVersesText(
                'Baptizing in Zenon near Qalim, then beyond Vordan.',
                guide,
                'Scriptish',
            ),
        ).toBe(
            ' Write each name of a person or a place as the Scriptish ' +
                'Bible writes it in its verse: Zenon, Qalim -- verse 23: ' +
                `"${FILLER_A}${ZENON} ${FILLER_A} ${QALIM}."; Vordan -- ` +
                `verse 26: "${VERSE_26}".`,
        );
    });

    it('says nothing for words that use none of them, or with no guide', () => {
        expect(toStudyNameVersesText('A night talk.', guide, 'Scriptish')).toBe(
            '',
        );
        expect(toStudyNameVersesText('In Zenon.', null, 'Scriptish')).toBe('');
        // A name inside a longer word is not the name.
        expect(
            toStudyNameVersesText('Zenons and Qalimite.', guide, 'Scriptish'),
        ).toBe('');
    });

    it('shows four verses and 900 letters at most', () => {
        const many: StudyNameGuideType = {
            ...guide,
            verseMap: genVerseMap([
                ['Aname', '1', 'v'],
                ['Bname', '2', 'v'],
                ['Cname', '3', 'v'],
                ['Dname', '4', 'v'],
                ['Ename', '5', 'v'],
            ]),
        };
        const shown = toStudyNameVersesText(
            'Aname Bname Cname Dname Ename',
            many,
            'Scriptish',
        );
        expect(shown).toContain('Dname -- verse 4');
        expect(shown).not.toContain('Ename');
        // Two of these are more than 900 letters; the short one still fits.
        const longVerse = 'words '.repeat(100);
        const long: StudyNameGuideType = {
            ...guide,
            verseMap: genVerseMap([
                ['Aname', '1', longVerse],
                ['Bname', '2', longVerse],
                ['Cname', '3', 'short'],
            ]),
        };
        const fitted = toStudyNameVersesText(
            'Aname Bname Cname',
            long,
            'Scriptish',
        );
        expect(fitted).toContain('Aname -- verse 1');
        expect(fitted).not.toContain('Bname');
        expect(fitted).toContain('Cname -- verse 3: "short"');
    });

    it('names, asked again, the words written another way than their verse', () => {
        expect(
            toStudyNameVersesText('In Zenon.', guide, 'Scriptish', [
                { written: ZENON_SLIP, spelling: ZENON, key: '23' },
            ]),
        ).toContain(
            ` Your last translation wrote these another way than their ` +
                `verse: "${ZENON_SLIP}" (verse 23 writes "${ZENON}"); write ` +
                'each name as its verse does.',
        );
    });
});

describe('listStudyNameSpellings', () => {
    const guide = toStudyNameGuide(genParts(), {
        Pharisees: PHARISEES_LISTED,
    });

    it('is the church word for each name the words use, as the Bible quoted writes it', () => {
        expect(listStudyNameSpellings('A Pharisee came.', guide)).toEqual([
            PHARISEES,
        ]);
        expect(listStudyNameSpellings('The Pharisees came.', guide)).toEqual([
            PHARISEES,
        ]);
        expect(listStudyNameSpellings('A teacher came.', guide)).toEqual([]);
        expect(listStudyNameSpellings('A Pharisee came.', null)).toEqual([]);
    });
});

describe('repairStudyNameSpellings', () => {
    it('writes a name with one vowel sign written otherwise as the Bible does, wherever it is', () => {
        const text = `${FILLER_A}${PHARISEES_LISTED} ${FILLER_B}\n* **${PHARISEES_LISTED}**: ${FILLER_C}`;
        expect(repairStudyNameSpellings(text, [PHARISEES])).toEqual({
            text: `${FILLER_A}${PHARISEES} ${FILLER_B}\n* **${PHARISEES}**: ${FILLER_C}`,
            repaired: [
                [PHARISEES_LISTED, PHARISEES],
                [PHARISEES_LISTED, PHARISEES],
            ],
        });
    });

    it('leaves the name as written, two vowel signs otherwise, another sign, and one with an accent', () => {
        const twoSlips = `${letter(9)}${VOWEL_II}${letter(10)}${letter(11)}${VOWEL_II}`;
        const withAccent = `${letter(9)}${VOWEL_I}${ACUTE}${letter(10)}${letter(11)}${VOWEL_I}`;
        const text = `${PHARISEES} ${twoSlips} ${PHARISEES_JOINED} ${withAccent}`;
        expect(repairStudyNameSpellings(text, [PHARISEES])).toEqual({
            text,
            repaired: [],
        });
    });

    it('takes no word of fewer than three letters or with no vowel sign', () => {
        const short = `${letter(9)}${VOWEL_I}${letter(10)}`;
        const plain = `${letter(9)}${letter(10)}${letter(11)}`;
        const text = `${letter(9)}${VOWEL_II}${letter(10)} ${plain}`;
        expect(repairStudyNameSpellings(text, [short, plain])).toEqual({
            text,
            repaired: [],
        });
        expect(repairStudyNameSpellings('Pharisees', [])).toEqual({
            text: 'Pharisees',
            repaired: [],
        });
    });
});

describe('listStudyNameSlips', () => {
    const guide = toStudyNameGuide(genParts(), { Pharisees: PHARISEES });

    it('names a shown verse’s word written with one vowel sign otherwise, once, with its verse', () => {
        expect(
            listStudyNameSlips(
                'Baptizing in Zenon near Qalim.',
                `${FILLER_A}${ZENON_SLIP} ${QALIM}, ${ZENON_SLIP}.`,
                guide,
            ),
        ).toEqual([{ written: ZENON_SLIP, spelling: ZENON, key: '23' }]);
    });

    it('is none for a word as the verse writes it, two signs otherwise, or names the words do not use', () => {
        expect(
            listStudyNameSlips('In Zenon.', `${FILLER_A}${ZENON}`, guide),
        ).toEqual([]);
        expect(listStudyNameSlips('In Zenon.', ZENON_TWO_SLIPS, guide)).toEqual(
            [],
        );
        expect(listStudyNameSlips('By night.', ZENON_SLIP, guide)).toEqual([]);
        expect(listStudyNameSlips('In Zenon.', ZENON_SLIP, null)).toEqual([]);
    });

    it('is none for a word the passages write themselves', () => {
        const parts = genParts(
            QUOTED_PASSAGE.replace(VERSE_24, `${VERSE_24} ${ZENON_SLIP}`),
        );
        const withWord = toStudyNameGuide(parts, {});
        expect(listStudyNameSlips('In Zenon.', ZENON_SLIP, withWord)).toEqual(
            [],
        );
    });

    it('names eight at most', () => {
        const wordList = Array.from({ length: 10 }, (_none, index) => {
            return `${letter(20 + index)}${VOWEL_I}${letter(1)}${letter(2)}`;
        });
        const many: StudyNameGuideType = {
            ...guide,
            verseMap: new Map([
                ['Zenon', [{ key: '23', text: 'v', words: wordList }]],
            ]),
        };
        const translated = wordList
            .map((word) => {
                return word.replace(VOWEL_I, VOWEL_II);
            })
            .join(' ');
        expect(listStudyNameSlips('In Zenon.', translated, many)).toHaveLength(
            8,
        );
    });
});

describe('countStudyWordPlaces', () => {
    it('counts each place a text writes a word, glued to the letters round it too', () => {
        expect(
            countStudyWordPlaces(
                `${FILLER_A}${ZENON} ${ZENON}, ${QALIM}${ZENON}.`,
                ZENON,
            ),
        ).toBe(3);
    });

    it('counts no place written with other vowel signs, and nothing of no word', () => {
        expect(
            countStudyWordPlaces(`${ZENON_SLIP} ${ZENON_TWO_SLIPS}`, ZENON),
        ).toBe(0);
        expect(countStudyWordPlaces(ZENON, '')).toBe(0);
    });

    it('reads past a sign any writer may leave off and an invisible gap', () => {
        const written =
            `${letter(0)}${VOWEL_I}${GAP}${letter(1)}${ACUTE}` +
            `${letter(2)}${VOWEL_U}`;
        expect(countStudyWordPlaces(written, ZENON)).toBe(1);
        expect(countStudyWordPlaces(ZENON, `${ZENON}${GAP}`)).toBe(1);
    });
});

describe('findStudyWordVariants', () => {
    it('finds where a text writes a word as it is, or with the vowel signs of one letter otherwise', () => {
        const at = FILLER_A.length + 1;
        const next = at + ZENON.length + 1;
        expect(
            findStudyWordVariants(
                `${FILLER_A} ${ZENON} ${ZENON_SLIP} ${ZENON_TWO_SLIPS}`,
                ZENON,
            ),
        ).toEqual([
            { start: at, end: at + ZENON.length, changed: 0 },
            { start: next, end: next + ZENON_SLIP.length, changed: 1 },
        ]);
    });

    it('ends a place before the invisible gap after it, and finds nothing of no word', () => {
        expect(
            findStudyWordVariants(`${ZENON_SLIP}${GAP}${FILLER_A}`, ZENON),
        ).toEqual([{ start: 0, end: ZENON_SLIP.length, changed: 1 }]);
        expect(findStudyWordVariants(ZENON, '')).toEqual([]);
        expect(findStudyWordVariants(QALIM, ZENON)).toEqual([]);
    });
});

// EC-560: a river the passage names in one verse, as the Bible quoted
// writes it -- four letters, a sign on the first -- and as a translation's
// own words write it with a letter fewer and a vowel in place of the sign.
const DOT_BELOW = String.fromCodePoint(0x1037);
const ASAT = String.fromCodePoint(0x103a);
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

describe('listStudyNameWords', () => {
    it('is, for each name, the words of three letters or more in the verses giving it and in few others', () => {
        const words = listStudyNameWords(
            readStudyQuoteVerses(ENGLISH_PASSAGE),
            readStudyQuoteVerses(QUOTED_PASSAGE),
        );
        expect(words.nameMap.get('Zenon')).toEqual([
            { word: ZENON, key: '23' },
            { word: QALIM, key: '23' },
        ]);
        // In verse 26 alone, or in 26 and one verse more.
        expect(words.nameMap.get('Vordan')).toEqual([
            { word: FILLER_B, key: '26' },
            { word: VORDAN, key: '26' },
        ]);
        // In three verses, which no word of three letters is in the most
        // of; and a word of two letters is too short to tell.
        expect(words.nameMap.has('John')).toBe(false);
        expect(words.wordSet.has(FILLER_A)).toBe(true);
        expect(words.wordSet.has(VORDAN)).toBe(true);
    });

    it('is none with no name or no verse quoted', () => {
        expect(
            listStudyNameWords(new Map(), readStudyQuoteVerses(QUOTED_PASSAGE))
                .nameMap.size,
        ).toBe(0);
        expect(
            listStudyNameWords(
                readStudyQuoteVerses(ENGLISH_PASSAGE),
                new Map(),
            ),
        ).toEqual({ nameMap: new Map(), wordSet: new Set() });
    });
});

describe('listStudyNameLetterPlaces', () => {
    it('finds the word as it is, and with the vowel signs of one letter otherwise', () => {
        const at = FILLER_A.length + 1;
        expect(
            listStudyNameLetterPlaces(`${FILLER_A} ${RIVER}`, RIVER),
        ).toEqual([
            { start: at, end: at + RIVER.length, kind: 'same', rate: 1 },
        ]);
        const vowelSlip = RIVER.replace(VOWEL_U, VOWEL_I);
        expect(listStudyNameLetterPlaces(vowelSlip, RIVER)).toEqual([
            { start: 0, end: vowelSlip.length, kind: 'vowel', rate: 1 },
        ]);
    });

    it('takes the word written without any of its signs as the word itself', () => {
        const bare = `${letter(20)}${letter(21)}${letter(22)}${letter(23)}`;
        expect(listStudyNameLetterPlaces(bare, RIVER)).toEqual([
            { start: 0, end: bare.length, kind: 'same', rate: 1 },
        ]);
    });

    it('finds other letters coming close, the closest first, never across a word gap', () => {
        // Three of its four letters, in order, written in three: 6 of 7.
        const [first] = listStudyNameLetterPlaces(
            `${FILLER_A} ${RIVER_SLIP}`,
            RIVER,
        );
        expect(first).toEqual({
            start: FILLER_A.length + 1,
            end: FILLER_A.length + 1 + RIVER_SLIP.length,
            kind: 'other',
            rate: 6 / 7,
        });
        // The same letters with another sign that is no vowel.
        const otherSign = RIVER.replace(DOT_BELOW, ASAT);
        expect(listStudyNameLetterPlaces(otherSign, RIVER)[0]).toEqual({
            start: 0,
            end: otherSign.length,
            kind: 'other',
            rate: 1,
        });
        const apart = `${letter(20)} ${letter(22)}${VOWEL_U}${letter(23)}`;
        expect(listStudyNameLetterPlaces(apart, RIVER)).toEqual([]);
        expect(listStudyNameLetterPlaces(FILLER_C, RIVER)).toEqual([]);
        expect(listStudyNameLetterPlaces(RIVER, FILLER_A)).toEqual([]);
    });
});

describe('listStudyNameOtherLetters', () => {
    const words = listStudyNameWords(RIVER_ENGLISH, RIVER_TARGET);
    const checkIsAny = () => {
        return true;
    };

    it('names a name the words standing for it write with other letters, beside its verse’s word', () => {
        expect(
            listStudyNameOtherLetters('Rivon', RIVER_SLIP, words, checkIsAny),
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

    it('is none for a name written as its verse writes it, glued to other words too, or a vowel sign apart', () => {
        expect(
            listStudyNameOtherLetters(
                'The Rivon',
                `${FILLER_A}${RIVER}`,
                words,
                checkIsAny,
            ),
        ).toEqual([]);
        expect(
            listStudyNameOtherLetters(
                'Rivon',
                RIVER.replace(VOWEL_U, VOWEL_I),
                words,
                checkIsAny,
            ),
        ).toEqual([]);
    });

    it('is none for words naming no name, a place no replace takes, or a word the verses write', () => {
        expect(
            listStudyNameOtherLetters(
                'The river',
                RIVER_SLIP,
                words,
                checkIsAny,
            ),
        ).toEqual([]);
        expect(
            listStudyNameOtherLetters('Rivon', RIVER_SLIP, words, () => {
                return false;
            }),
        ).toEqual([]);
        expect(
            listStudyNameOtherLetters('Rivon', RIVER_SLIP, words, checkIsAny),
        ).toHaveLength(1);
        expect(
            listStudyNameOtherLetters(
                'Rivon',
                RIVER_SLIP,
                { ...words, wordSet: new Set([RIVER_SLIP]) },
                checkIsAny,
            ),
        ).toEqual([]);
    });
});

describe('pairStudyBoldSpans', () => {
    it('pairs bold spans in their order when both bold as many, where the translation’s words start', () => {
        expect(
            pairStudyBoldSpans(
                '* **Rivon**: a river.\n* **Zenon**: a town.',
                '* **Ab**: x.\n* **Cd**: y.',
            ),
        ).toEqual([
            { english: 'Rivon', span: { text: 'Ab', start: 4 } },
            { english: 'Zenon', span: { text: 'Cd', start: 17 } },
        ]);
    });

    it('pairs them line by line, in lines bolding as many, when the whole bolds otherwise', () => {
        expect(
            pairStudyBoldSpans(
                '**Rivon** and **Zenon**.\n**Night** came.',
                '**Ab** **Cd**.\nEf.',
            ),
        ).toEqual([
            { english: 'Rivon', span: { text: 'Ab', start: 2 } },
            { english: 'Zenon', span: { text: 'Cd', start: 9 } },
        ]);
    });

    it('leaves a quoted line’s bold out, and pairs nothing when neither tells', () => {
        expect(
            pairStudyBoldSpans(
                '> **5** And Rivon.\n**Rivon**',
                '> **5** Ab.\n**Cd**',
            ),
        ).toEqual([{ english: 'Rivon', span: { text: 'Cd', start: 14 } }]);
        expect(
            pairStudyBoldSpans('**Rivon** **Zenon**', '**Ab**\n\nCd'),
        ).toEqual([]);
    });
});

// EC-561: the river of EC-560 in a translation's new words, named in its
// part's retry with its English name.
const RIVER_PARTS = [
    {
        kind: 'passage',
        text:
            '> **5** And they crossed the Rivon by night.\n>\n' +
            '> **6** And they slept there.',
        quoted:
            `> **5** ${FILLER_A} ${RIVER} ${FILLER_C}\n>\n` +
            `> **6** ${FILLER_A} ${FILLER_B}`,
    },
];
const RIVER_OTHER_SLIP: StudyNameSlipType = {
    written: RIVER_SLIP,
    spelling: RIVER,
    key: '5',
    name: 'Rivon',
};

describe('a name a new translation writes with other letters (EC-561)', () => {
    const guide = toStudyNameGuide(RIVER_PARTS, {});

    it('is read once for the job: the words that may write each name, unless asked not to', () => {
        expect(guide.nameWords.nameMap.get('Rivon')).toEqual(
            listStudyNameWords(RIVER_ENGLISH, RIVER_TARGET).nameMap.get(
                'Rivon',
            ),
        );
        expect(
            toStudyNameGuide(RIVER_PARTS, {}, false).nameWords.nameMap.size,
        ).toBe(0);
        expect(
            toStudyNameGuide(genParts(null), {}).nameWords.nameMap.size,
        ).toBe(0);
    });

    it('is named for the retry, read off the bold span in the place of the English name', () => {
        expect(
            listStudyNameSlips(
                '* **Rivon**: the river.',
                `* **${RIVER_SLIP}**: ${FILLER_A}`,
                guide,
            ),
        ).toEqual([RIVER_OTHER_SLIP]);
    });

    it('is not named written as its verse writes it, out of bold, unpaired, or with no name words read', () => {
        expect(
            listStudyNameSlips(
                '* **Rivon**: the river.',
                `* **${RIVER}**: ${FILLER_A}`,
                guide,
            ),
        ).toEqual([]);
        expect(
            listStudyNameSlips('The Rivon.', `${RIVER_SLIP}.`, guide),
        ).toEqual([]);
        expect(
            listStudyNameSlips(
                '* **Rivon**: the river.\n* **Night**: dark.',
                `* **${RIVER_SLIP}**: ${FILLER_A}`,
                guide,
            ),
        ).toEqual([]);
        expect(
            listStudyNameSlips(
                '* **Rivon**: the river.',
                `* **${RIVER_SLIP}**: ${FILLER_A}`,
                toStudyNameGuide(RIVER_PARTS, {}, false),
            ),
        ).toEqual([]);
    });

    it('is told in the retry with its English name, even with no verse shown', () => {
        const slipText =
            ' Your last translation wrote these another way than their ' +
            `verse: Rivon as "${RIVER_SLIP}" (verse 5 writes "${RIVER}", ` +
            'if that word is Rivon); write each name as its verse does.';
        const shown = toStudyNameVersesText(
            '* **Rivon**: the river.',
            guide,
            'Scriptish',
            [RIVER_OTHER_SLIP],
        );
        expect(shown).toContain('Rivon -- verse 5:');
        expect(shown.endsWith(slipText)).toBe(true);
        expect(
            toStudyNameVersesText('A night talk.', guide, 'Scriptish', [
                RIVER_OTHER_SLIP,
            ]),
        ).toBe(slipText);
        expect(toStudyNameVersesText('A night talk.', guide, 'Scriptish')).toBe(
            '',
        );
    });
});

// A made-up language written in Latin letters, whose words the platform's
// word breaking reads at its spaces: the river's verse writes it
// "brovanek".
describe('listStudyNameOtherLetters, whole words only (EC-561)', () => {
    const words = listStudyNameWords(
        RIVER_ENGLISH,
        readStudyQuoteVerses(
            '> **5** Hortle brovanek quolm\n>\n> **6** Hortle glamph',
        ),
    );
    const checkIsAny = () => {
        return true;
    };

    it('names a whole word, at 0.75 when it is all the words standing for the name', () => {
        expect(
            listStudyNameOtherLetters('Rivon', 'brovanix', words, checkIsAny),
        ).toEqual([
            { name: 'Rivon', start: 0, end: 8, spelling: 'brovanek', key: '5' },
        ]);
    });

    it('never a place cutting a word, nor one beside other words under 0.8', () => {
        expect(
            listStudyNameOtherLetters('Rivon', 'brovanixso', words, checkIsAny),
        ).toEqual([]);
        expect(
            listStudyNameOtherLetters(
                'Rivon',
                'Zastle brovanix',
                words,
                checkIsAny,
            ),
        ).toEqual([]);
        expect(
            listStudyNameOtherLetters(
                'Rivon',
                'Zastle brovanuk',
                words,
                checkIsAny,
            ),
        ).toEqual([
            {
                name: 'Rivon',
                start: 7,
                end: 15,
                spelling: 'brovanek',
                key: '5',
            },
        ]);
    });
});
