import { describe, expect, it } from 'vitest';

import {
    listAroundOtherTestament,
    listPassageCrossRefThemes,
    toCrossRefSpan,
    toPassageCrossRefs,
    toPlainThemeTitle,
} from './agentCrossRefHelpers';

// 2026-10-23: the French bundle writes an apostrophe as an entity, and the
// help window draws text.
describe('a theme title as text', () => {
    it('reads entities and drops tags', () => {
        expect(
            toPlainThemeTitle('Profanation du corps et de l&#39;armure'),
        ).toBe('Profanation du corps et de l’armure');
        expect(toPlainThemeTitle('A &amp; B &lt;C&gt; &#x41;')).toBe(
            'A & B <C> A',
        );
        expect(toPlainThemeTitle('<b>Noé</b> et l&apos;arche')).toBe(
            'Noé et l’arche',
        );
        // Nothing to do, and an entity nobody knows, stay as they are.
        expect(toPlainThemeTitle('សត្វព្រាប')).toBe('សត្វព្រាប');
        expect(toPlainThemeTitle('&bogus; &#0;')).toBe('&bogus; &#0;');
    });
});

const BOOK_ORDER = [
    'GEN',
    'EXO',
    'LEV',
    'DEU',
    '1SA',
    'PSA',
    'ISA',
    'JER',
    'MAT',
    'LUK',
    'ROM',
    'HEB',
    '1PE',
    '2PE',
];

// As the bundle gives Genesis 8:1, 8:21 and 8:22, cut short.
const GENESIS_8 = [
    {
        verse: 'GEN 8:1',
        themes: [
            {
                title: 'God Remembering His People in Mercy',
                verses: ['GEN 19:29', 'EXO 2:24', '1SA 1:19'],
            },
            {
                title: 'Waters Subsiding and Deliverance',
                verses: ['GEN 8:3', 'GEN 8:5', 'PSA 104:7-9'],
            },
            {
                title: "God's Covenant Faithfulness to Noah",
                verses: ['GEN 9:15-16', 'HEB 11:7', '1PE 3:20', '2PE 2:5'],
            },
        ],
    },
    {
        verse: 'GEN 8:21',
        themes: [
            {
                title: "God's Acceptance of Sacrificial Offerings",
                verses: ['LEV 1:9', 'LEV 1:13'],
            },
            {
                title: "The Wickedness of Man's Heart from Youth",
                verses: ['GEN 6:5', 'JER 17:9', 'ROM 3:23'],
            },
            {
                title: "God's Promise Not to Destroy the Earth Again",
                verses: ['GEN 9:11', 'GEN 9:15', 'ISA 54:9', '2PE 3:7'],
            },
        ],
    },
    {
        verse: 'GEN 8:22',
        themes: [
            {
                title: "God's Covenant Promise of Earth's Continuity",
                verses: ['GEN 9:11', 'GEN 9:15', 'ISA 54:9', 'JER 33:20'],
            },
        ],
    },
];

describe('toCrossRefSpan', () => {
    it('reads a verse, a range and a range over chapters', () => {
        expect(toCrossRefSpan('GEN 9:15')).toEqual({
            bookKey: 'GEN',
            chapter: 9,
            verse: 15,
            endChapter: 9,
            endVerse: 15,
        });
        expect(toCrossRefSpan('PSA 107:25-29')?.endVerse).toBe(29);
        expect(toCrossRefSpan('JHN 18:33-19:16')).toMatchObject({
            chapter: 18,
            endChapter: 19,
            endVerse: 16,
        });
        expect(toCrossRefSpan('Genesis')).toBeNull();
    });
});

describe('toPassageCrossRefs', () => {
    it('puts first what most of the passage leads to, and leaves the passage out', () => {
        const found = toPassageCrossRefs(GENESIS_8, {
            passageKey: 'GEN 8:1-22',
            bookOrder: BOOK_ORDER,
        });
        expect(found.verseCount).toBe(3);
        expect(found.themeCount).toBe(7);
        // GEN 8:3 and 8:5 are the passage itself.
        expect(found.referenceCount).toBe(21);
        // Genesis 9:15 is led to by 8:1 (as 9:15-16), 8:21 and 8:22.
        expect(found.mostCited.slice(0, 3)).toEqual([
            { key: 'GEN 9:15-16', from: ['1', '21', '22'] },
            { key: 'GEN 9:11', from: ['21', '22'] },
            { key: 'ISA 54:9', from: ['21', '22'] },
        ]);
        expect(
            found.mostCited.every((one) => {
                return one.from.length >= 2;
            }),
        ).toBe(true);
    });

    it('names where the other Testament speaks of it, the most led to first', () => {
        const found = toPassageCrossRefs(GENESIS_8, {
            passageKey: 'GEN 8:1-22',
            bookOrder: BOOK_ORDER,
        });
        expect(found.otherTestamentName).toBe('New Testament');
        expect(
            found.otherTestament.map((one) => {
                return one.key;
            }),
            // Each led to by one verse here: then the Bible's order.
        ).toEqual(['ROM 3:23', 'HEB 11:7', '1PE 3:20', '2PE 2:5', '2PE 3:7']);
    });

    it('turns round for a passage of the New Testament', () => {
        const found = toPassageCrossRefs(
            [
                {
                    verse: 'MAT 18:16',
                    themes: [
                        {
                            title: 'Two or three witnesses',
                            verses: ['DEU 19:15', '2PE 1:16'],
                        },
                    ],
                },
            ],
            { passageKey: 'MAT 18:15-17', bookOrder: BOOK_ORDER },
        );
        expect(found.otherTestamentName).toBe('Old Testament');
        expect(found.otherTestament).toEqual([
            { key: 'DEU 19:15', from: ['16'] },
        ]);
    });

    it('lists one verse’s references in its own order', () => {
        const found = toPassageCrossRefs([GENESIS_8[1]], {
            passageKey: 'GEN 8:21',
            bookOrder: BOOK_ORDER,
            maxCited: 4,
        });
        expect(
            found.mostCited.map((one) => {
                return one.key;
            }),
        ).toEqual(['LEV 1:9', 'LEV 1:13', 'GEN 6:5', 'JER 17:9']);
    });

    it('keeps each verse’s first themes, bounded', () => {
        const found = toPassageCrossRefs(GENESIS_8, {
            passageKey: 'GEN 8:1-22',
            bookOrder: BOOK_ORDER,
            maxThemesPerVerse: 1,
            maxRefsPerTheme: 2,
        });
        expect(found.byVerse).toEqual([
            {
                verse: '1',
                themes: [
                    {
                        theme: 'God Remembering His People in Mercy',
                        refs: ['GEN 19:29', 'EXO 2:24'],
                    },
                ],
            },
            {
                verse: '21',
                themes: [
                    {
                        theme: "God's Acceptance of Sacrificial Offerings",
                        refs: ['LEV 1:9', 'LEV 1:13'],
                    },
                ],
            },
            {
                verse: '22',
                themes: [
                    {
                        theme: "God's Covenant Promise of Earth's Continuity",
                        refs: ['GEN 9:11', 'GEN 9:15'],
                    },
                ],
            },
        ]);
    });

    it('names a verse by chapter and verse in a passage over chapters', () => {
        const found = toPassageCrossRefs(
            [
                {
                    verse: 'GEN 8:22',
                    themes: [{ title: 'Seasons', verses: ['JER 33:20'] }],
                },
                {
                    verse: 'GEN 9:1',
                    themes: [{ title: 'Be fruitful', verses: ['GEN 1:28'] }],
                },
            ],
            { passageKey: 'GEN 8:20-9:17', bookOrder: BOOK_ORDER },
        );
        expect(
            found.byVerse.map((one) => {
                return one.verse;
            }),
        ).toEqual(['8:22', '9:1']);
    });

    it('skips what is not a reference or a book it knows', () => {
        const found = toPassageCrossRefs(
            [
                {
                    verse: 'GEN 8:1',
                    themes: [
                        { title: 'Odd', verses: ['Genesis', 'XYZ 1:1', 3] },
                        { title: 42, verses: ['GEN 9:1'] },
                    ] as any,
                },
            ],
            { passageKey: 'GEN 8:1', bookOrder: BOOK_ORDER },
        );
        expect(found.themeCount).toBe(1);
        expect(found.referenceCount).toBe(0);
        expect(found.byVerse).toEqual([]);
    });
});

describe('listAroundOtherTestament', () => {
    it('adds what the other Testament says of the story around it', () => {
        const around = [
            {
                verse: 'GEN 7:1',
                themes: [
                    {
                        title: 'The days of Noah',
                        verses: ['MAT 24:37-39', 'LUK 17:26-27', 'HEB 11:7'],
                    },
                ],
            },
            {
                verse: 'GEN 7:23',
                themes: [
                    {
                        title: 'Judgment by water',
                        verses: ['MAT 24:39', '2PE 3:6', 'GEN 8:1'],
                    },
                ],
            },
        ];
        const found = listAroundOtherTestament(around, {
            passageKey: 'GEN 8:1-22',
            bookOrder: BOOK_ORDER,
            // Already said of the passage itself.
            shownKeys: ['HEB 11:7', '2PE 2:5'],
        });
        // Matthew 24:37-39 and 24:39 are one saying; Hebrews 11:7 is left
        // out, the passage already names it; Genesis is no other Testament.
        expect(
            found.map((one) => {
                return one.key;
            }),
        ).toEqual(['MAT 24:37-39', 'LUK 17:26-27', '2PE 3:6']);
        // Named by chapter and verse, however short the passage.
        expect(found[0].from).toEqual(['7:1', '7:23']);
    });
});

describe('overlapping references', () => {
    it('are one span, led to from all their verses', () => {
        const found = toPassageCrossRefs(
            [
                {
                    verse: 'GEN 7:1',
                    themes: [
                        { title: 'a', verses: ['LUK 17:27', 'MAT 24:38'] },
                    ],
                },
                {
                    verse: 'GEN 7:2',
                    themes: [
                        { title: 'b', verses: ['LUK 17:26-27', 'MAT 24:40'] },
                    ],
                },
            ],
            { passageKey: 'GEN 7:1-24', bookOrder: BOOK_ORDER },
        );
        expect(found.mostCited).toEqual([
            { key: 'LUK 17:26-27', from: ['1', '2'] },
        ]);
        // Touching is not overlapping.
        expect(
            found.otherTestament.map((one) => {
                return one.key;
            }),
        ).toEqual(['LUK 17:26-27', 'MAT 24:38', 'MAT 24:40']);
    });
});

describe('listPassageCrossRefThemes', () => {
    it('lists every theme with its verse, the passage left out', () => {
        const themes = listPassageCrossRefThemes(GENESIS_8, 'GEN 8:1-22');
        expect(themes).toHaveLength(7);
        expect(themes[1]).toEqual({
            verse: '1',
            theme: 'Waters Subsiding and Deliverance',
            refs: ['PSA 104:7-9'],
        });
    });
});
