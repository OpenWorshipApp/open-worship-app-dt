import { describe, expect, test } from 'vitest';

import kjvBibleConfig from '../helper/bible-helpers/kjvBibleConfig.json';
import {
    BIBLE_LIST_PASTE_LEAD,
    checkHasBibleListPasteLead,
    checkMayBeBibleListPaste,
    MAX_PASTE_PASSAGE_COUNT,
    readBibleListPaste,
    toEnglishBibleListPasteLead,
    toValidBibleListPicks,
} from './bibleListPasteHelpers';
import {
    checkIsBibleListHowTo,
    readBibleListRequest,
} from './bibleListAskHelpers';
import {
    genStudyBookNames,
    type StudyBookNamesType,
} from './studyVerseCheckHelpers';

// What `owa_bible_suggest books` answers on a machine with the KJV and a
// Bible of a made-up language, whose every book name is its English one
// with an X in front.
const bookKeys = kjvBibleConfig.bookKeysOrder;
const english = bookKeys.map((key) => {
    return (kjvBibleConfig.keyBookMap as Record<string, string>)[key];
});
const NAMES = genStudyBookNames({
    kind: 'books',
    bookKeys,
    english,
    bibles: [
        { keys: ['KJV'], locale: 'en', books: english },
        {
            keys: ['XXB'],
            locale: 'xx',
            books: english.map((name) => {
                return `X${name.replace(/\s+/g, '').toLowerCase()}`;
            }),
        },
    ],
}) as StudyBookNamesType;

function read(text: string, options = {}) {
    return readBibleListPaste(text, NAMES, {
        installedKeys: ['KJV', 'XXB'],
        ...options,
    });
}

function toReferences(text: string) {
    return read(text)?.passages.map((one) => {
        return one.version === null
            ? one.reference
            : `${one.reference} [${one.version}]`;
    });
}

describe('the request a sentence makes, its passages marked', () => {
    test.each([
        ['Add §', { listName: null, isNewList: false, isListNamed: false }],
        ['Save §.', { listName: null, isNewList: false, isListNamed: false }],
        [
            'add bible item §',
            { listName: null, isNewList: false, isListNamed: true },
        ],
        [
            'Add these to my Bibles list:',
            { listName: null, isNewList: false, isListNamed: true },
        ],
        [
            'Please add all of these verses to the Easter list',
            { listName: 'Easter', isNewList: false, isListNamed: true },
        ],
        [
            'Can you save § and § to the list called "Christmas"?',
            { listName: 'Christmas', isNewList: false, isListNamed: true },
        ],
        [
            'Add the verses from this paragraph to my Bible list',
            { listName: null, isNewList: false, isListNamed: true },
        ],
        [
            '§ - add it to my list',
            { listName: null, isNewList: false, isListNamed: true },
        ],
        [
            'Make a new Bible list called Easter with these',
            { listName: 'Easter', isNewList: true, isListNamed: true },
        ],
        [
            'Make a new Bible list called Easter with §',
            { listName: 'Easter', isNewList: true, isListNamed: true },
        ],
        // EC-703: who it is for, and a `for` the passages finish.
        [
            'add bible items for me for: §',
            { listName: null, isNewList: false, isListNamed: true },
        ],
        [
            'add bible items for me: §',
            { listName: null, isNewList: false, isListNamed: true },
        ],
        [
            'Add § for me',
            { listName: null, isNewList: false, isListNamed: false },
        ],
        [
            'save § to my Bibles list for us',
            { listName: null, isNewList: false, isListNamed: true },
        ],
    ])('%s', (sentence, expected) => {
        expect(readBibleListRequest(sentence)).toEqual(expected);
    });

    test.each([
        'How do I add § to my list?',
        'Put § on the screen',
        'Add § to my running order',
        'Add § under each line',
        'Add a verse about love',
        'Add',
        'Show me §',
        'We should add § to our memory work',
    ])('not a request: %s', (sentence) => {
        expect(readBibleListRequest(sentence)).toBeNull();
    });

    test('a how-to is told apart', () => {
        expect(checkIsBibleListHowTo('How do I add § to my list?')).toBe(true);
        expect(checkIsBibleListHowTo('Add § to my list')).toBe(false);
    });
});

describe('passages pasted, typed or written in a paragraph', () => {
    test('a messy list: versions, an open range, a book two could be', () => {
        const read1 = read(
            [
                'Add these to my Bibles list:',
                'John 3:15 (kjv)',
                '    GEN 1:2-',
                'Kings 3:5',
                '  [XXB] Romans 8:28',
            ].join('\n'),
        );
        expect(read1).toEqual({
            listName: null,
            isNewList: false,
            isListNamed: true,
            passages: [
                { written: 'John 3:15', reference: 'JHN 3:15', version: 'kjv' },
                {
                    written: 'Romans 8:28',
                    reference: 'ROM 8:28',
                    version: 'XXB',
                },
            ],
            picks: [
                {
                    kind: 'range',
                    written: 'GEN 1:2-',
                    choices: [
                        {
                            label: 'GEN 1:2-',
                            reference: 'GEN 1:2-',
                            version: null,
                        },
                        {
                            label: 'GEN 1:2',
                            reference: 'GEN 1:2',
                            version: null,
                        },
                    ],
                },
                {
                    kind: 'book',
                    written: 'Kings 3:5',
                    choices: [
                        {
                            label: '1 Kings 3:5',
                            reference: '1KI 3:5',
                            version: null,
                        },
                        {
                            label: '2 Kings 3:5',
                            reference: '2KI 3:5',
                            version: null,
                        },
                    ],
                },
            ],
            unreadable: [],
            overflow: [],
        });
    });

    test('a bare request names no list', () => {
        expect(read('Add John 3:16')).toMatchObject({
            listName: null,
            isListNamed: false,
            passages: [{ reference: 'JHN 3:16' }],
        });
        expect(read('add bible item john 3:16')).toMatchObject({
            isListNamed: true,
            passages: [{ reference: 'JHN 3:16' }],
        });
    });

    test('the request under the list, or the list under a new list', () => {
        expect(
            toReferences('John 3:16\nRomans 8:28\n\nsave these to my list'),
        ).toEqual(['JHN 3:16', 'ROM 8:28']);
        expect(
            read(
                'Make a new Bible list called Easter with these:\n' +
                    'John 20:1-18\n1 Corinthians 15:3-8',
            ),
        ).toMatchObject({
            listName: 'Easter',
            isNewList: true,
            passages: [
                { reference: 'JHN 20:1-18' },
                { reference: '1CO 15:3-8' },
            ],
        });
    });

    test('a paragraph: its passages, not its other numbers', () => {
        expect(
            read(
                'Last Sunday at 10:30 am we read John 3:16 and Romans 8:28, ' +
                    'sang 2 hymns, and the pastor closed with Psalm 23. We ' +
                    'read Acts 2 times. Please add the verses from this ' +
                    'paragraph to the Easter list.',
            ),
        ).toMatchObject({
            listName: 'Easter',
            passages: [
                { reference: 'JHN 3:16' },
                { reference: 'ROM 8:28' },
                { reference: 'PSA 23' },
            ],
            unreadable: [],
        });
    });

    // EC-760: a sermon's paragraph pasted under the Bibles panel's line.
    test('a whole chapter the sentence goes on after, its book written in full', () => {
        expect(
            toReferences(
                'Add these to my Bibles list: this Sunday we will read ' +
                    'Psalm 23 together, and Genesis 1 tells us who made it all.',
            ),
        ).toEqual(['PSA 23', 'GEN 1']);
    });

    test('a book whose name is an everyday word, a lower case name or a short form stays words before a chapter and more words', () => {
        for (const words of [
            'We read Acts 2 times',
            'Numbers 3 more came',
            'Job 2 offers came in',
            'Mark 4 people down',
            'we will read psalm 23 together',
            'we will read Ps 23 together',
        ]) {
            expect(
                read(
                    `Add the verses in this text to my Bibles list: ${words}.`,
                ),
                words,
            ).toBeNull();
        }
    });

    test('a paragraph asks about a book several could be, never a time', () => {
        const read1 = read(
            'The meeting is at Room 10:30 and we studied Kings 3:5. Save ' +
                'these to my list.',
        );
        expect(read1?.passages).toEqual([]);
        expect(read1?.unreadable).toEqual([]);
        expect(read1?.picks.map((pick) => pick.written)).toEqual(['Kings 3:5']);
    });

    test('a second passage of the same book', () => {
        expect(
            toReferences(
                'Save John 3:16, 18; 4:1 and Romans 5:8; 8:1, 1 John 4:8 ' +
                    'to my list',
            ),
        ).toEqual([
            'JHN 3:16',
            'JHN 3:18',
            'JHN 4:1',
            'ROM 5:8',
            'ROM 8:1',
            '1JN 4:8',
        ]);
        expect(
            toReferences('Add these\nJohn 3:16, 18-20\nPsalm 23, 24'),
        ).toEqual(['JHN 3:16', 'JHN 3:18-20', 'PSA 23', 'PSA 24']);
    });

    test('ranges, across chapters, spaced, a dash before the words', () => {
        expect(
            toReferences(
                [
                    'Add these:',
                    'John 3:16-18',
                    'John 3:16-4:2',
                    'John 3:16 - 18',
                    'John 3:16 - For God so loved the world',
                    'John 3.16',
                ].join('\n'),
            ),
        ).toEqual([
            'JHN 3:16-18',
            'JHN 3:16-4:2',
            'JHN 3:16-18',
            'JHN 3:16',
            'JHN 3:16',
        ]);
    });

    test('versions before, after, in any case, or over the lines under', () => {
        expect(
            toReferences(
                [
                    'Add these to my list',
                    '(ESV) John 3:16',
                    'John 3:17 NIV',
                    '[nkjv] Romans 8:28',
                    'Romans 8:29 - kjv',
                    '',
                    'NIV',
                    'Psalm 23:1',
                    'Psalm 23:2 (ESV)',
                    '',
                    'Psalm 23:3',
                ].join('\n'),
            ),
        ).toEqual([
            'JHN 3:16 [ESV]',
            'JHN 3:17 [NIV]',
            'ROM 8:28 [nkjv]',
            'ROM 8:29 [kjv]',
            'PSA 23:1 [NIV]',
            'PSA 23:2 [ESV]',
            'PSA 23:3',
        ]);
    });

    test('a bracketed word that is no version is left alone', () => {
        expect(toReferences('Add these\nJohn 3:16 (optional)')).toEqual([
            'JHN 3:16',
        ]);
    });

    test("a list's bullets, numbers and a verse's words", () => {
        expect(
            toReferences(
                [
                    'Add these to the list',
                    '- John 3:16 For God so loved the world',
                    '* Romans 8:28',
                    '1. 1 John 4:8',
                    '2) Psalm 23',
                    '• JHN 3',
                    '[x] Jn 1:1',
                ].join('\n'),
            ),
        ).toEqual([
            'JHN 3:16',
            'ROM 8:28',
            '1JN 4:8',
            'PSA 23',
            'JHN 3',
            'JHN 1:1',
        ]);
    });

    test('a book in another Bible is read in that Bible', () => {
        expect(toReferences('Add Xjohn 3:16 and Xpsalms 23')).toEqual([
            'JHN 3:16 [XXB]',
            'PSA 23 [XXB]',
        ]);
    });

    test('what is unread, and what is asked', () => {
        const read1 = read(
            [
                'Add these',
                'Hezekiah 3:16',
                'Psalm 1-3',
                'Ph 4:13',
                'John 3:16',
            ].join('\n'),
        );
        expect(read1?.passages).toEqual([
            { written: 'John 3:16', reference: 'JHN 3:16', version: null },
        ]);
        expect(read1?.unreadable).toEqual(['Hezekiah 3:16', 'Psalm 1-3']);
        expect(read1?.picks).toEqual([
            {
                kind: 'book',
                written: 'Ph 4:13',
                choices: [
                    {
                        label: 'Philippians 4:13',
                        reference: 'PHP 4:13',
                        version: null,
                    },
                    {
                        label: 'Philemon 4:13',
                        reference: 'PHM 4:13',
                        version: null,
                    },
                ],
            },
        ]);
    });

    test('a version on a pick goes with its choices', () => {
        expect(read('Add GEN 1:2- (niv)')?.picks[0].choices).toEqual([
            { label: 'GEN 1:2-', reference: 'GEN 1:2-', version: 'niv' },
            { label: 'GEN 1:2', reference: 'GEN 1:2', version: 'niv' },
        ]);
    });

    test('past the cap is said as not saved', () => {
        const lines = Array.from({ length: 23 }, (_, index) => {
            return `Psalm 119:${index + 1}`;
        });
        const read1 = read(['Add these', ...lines].join('\n'));
        expect(read1?.passages).toHaveLength(MAX_PASTE_PASSAGE_COUNT);
        expect(read1?.overflow).toEqual([
            'Psalm 119:21',
            'Psalm 119:22',
            'Psalm 119:23',
        ]);
    });

    test.each([
        'How do I add John 3:16 to my list?',
        'Put John 3:16 on the screen',
        'Add John 3:16 to my running order',
        'Add a verse about love',
        'Show me John 3:16',
        '/add John 3:16',
        'John 3:16\nRomans 8:28',
        'Add 3 more minutes',
        'Add 10:30 to the countdown',
        'Save 10:30 to my list',
        'We read John 3:16. How do I save it to my list?',
    ])('asks for nothing of the kind: %s', (text) => {
        expect(read(text)).toBeNull();
    });

    test("another language's request, read by its own words", () => {
        const asked: string[] = [];
        const read1 = read('Zorp blik John 3:16\nRomans 8:28', {
            readTypedRequest: (text: string) => {
                asked.push(text);
                return { listName: 'Zed', isNewList: false, isListNamed: true };
            },
        });
        expect(asked).toEqual(['Zorp blik John 3:16']);
        expect(read1).toMatchObject({
            listName: 'Zed',
            passages: [{ reference: 'JHN 3:16' }, { reference: 'ROM 8:28' }],
        });
    });

    // 2026-11-14, EC-703: the line a model put on the screen instead.
    test.each([
        ['add bible items for me for:\njohn 3:16 gen 1', true],
        ['add bible items for me for: john 3:16 gen 1', true],
        ['add bible items for me: john 3:16, gen 1', true],
        ['save bible items john 3:16 gen 1', true],
        ['add to my bible list: john 3:16 gen 1', true],
        ['add these bible verses: john 3:16 gen 1', false],
        ['add john 3:16 and gen 1', false],
        ['Save John 3:16 (kjv) gen 1', false],
    ])('a short name in lower case after a passage: %s', (text, isNamed) => {
        const read1 = read(text);
        expect(read1).toMatchObject({ listName: null, isListNamed: isNamed });
        expect(
            read1?.passages.map((one) => {
                return one.reference;
            }),
        ).toEqual(['JHN 3:16', 'GEN 1']);
    });

    test('a short name in lower case: a list, a verse, never a word', () => {
        expect(toReferences('gen 1\nps 23\nadd these')).toEqual([
            'GEN 1',
            'PSA 23',
        ]);
        expect(toReferences('please add gen 1:1 for me')).toEqual(['GEN 1:1']);
        expect(
            toReferences('add john 3:16 gen 1 ps 23 to my bibles list'),
        ).toEqual(['JHN 3:16', 'GEN 1', 'PSA 23']);
        // A chapter alone, said first in a sentence; an everyday word.
        expect(read('add gen 1')).toBeNull();
        expect(read('add john 3:16 is 53 times')).toBeNull();
        expect(
            read('I want to add john 3:16 so 2 people can read it'),
        ).toBeNull();
    });

    test('passages alone under a question that asked to save them', () => {
        const carriedRequest = {
            listName: 'Easter',
            isNewList: false,
            isListNamed: true,
        };
        expect(read('John 3:16', { carriedRequest })).toMatchObject({
            listName: 'Easter',
            passages: [{ reference: 'JHN 3:16' }],
        });
        // Words beside them are a question of their own.
        expect(
            read('Put John 3:16 on the screen', { carriedRequest }),
        ).toBeNull();
        expect(read('John 3:16')).toBeNull();
    });

    test('worth reading the book names for', () => {
        expect(checkMayBeBibleListPaste('Add John 3:16')).toBe(true);
        expect(checkMayBeBibleListPaste('John 3:16')).toBe(false);
        expect(checkMayBeBibleListPaste('John 3:16', true)).toBe(true);
        expect(checkMayBeBibleListPaste('Add these')).toBe(false);
        expect(checkMayBeBibleListPaste('/add John 3:16')).toBe(false);
        expect(checkMayBeBibleListPaste(`add ${'x'.repeat(7000)} 3`)).toBe(
            false,
        );
    });
});

describe('a pick as a saved button carries it', () => {
    test('checked field by field', () => {
        expect(
            toValidBibleListPicks([
                {
                    kind: 'range',
                    written: 'GEN 1:2-',
                    choices: [
                        { label: 'Genesis 1:2-31', reference: 'GEN 1:2-' },
                        { label: 'x', reference: 'GEN 1:2', version: 5 },
                        {
                            label: 'Genesis 1:2',
                            reference: 'GEN 1:2',
                            version: 'KJV',
                        },
                    ],
                },
                { kind: 'book', written: 'Kings 3:5', choices: [] },
                'nothing',
            ]),
        ).toEqual([
            {
                kind: 'range',
                written: 'GEN 1:2-',
                choices: [
                    {
                        label: 'Genesis 1:2-31',
                        reference: 'GEN 1:2-',
                        version: null,
                    },
                    {
                        label: 'Genesis 1:2',
                        reference: 'GEN 1:2',
                        version: 'KJV',
                    },
                ],
            },
        ]);
        expect(toValidBibleListPicks(null)).toEqual([]);
    });

    test('a Bible asked about keeps the one that is not installed', () => {
        const choices = [{ label: 'KJV', reference: 'JHN 3', version: 'KJV' }];
        expect(
            toValidBibleListPicks([
                {
                    kind: 'version',
                    written: 'John 3',
                    missingVersion: 'niv',
                    choices,
                },
                { kind: 'version', written: 'John 3', choices },
            ]),
        ).toEqual([
            {
                kind: 'version',
                written: 'John 3',
                missingVersion: 'niv',
                choices,
            },
        ]);
    });
});

// The line Add Bible Item → Open in Chatbot puts in the box (EC-760).
describe('a text pasted under the line the Bibles panel put in the box', () => {
    const SHOWN_LEAD = 'Xadd xthe xpassages xto xmy xlist:';

    test('the line is a request to save to the Bibles list by itself', () => {
        expect(
            readBibleListRequest(BIBLE_LIST_PASTE_LEAD.replace(/:$/u, '')),
        ).toEqual({ listName: null, isNewList: false, isListNamed: true });
    });

    test('a paragraph under it: every passage in it, none of its sentences a request', () => {
        const text =
            `${BIBLE_LIST_PASTE_LEAD}\n` +
            'This morning we heard the reading. Jesus said in John 3:16 ' +
            'that God loved the world, and Paul wrote Romans 8:28 to ' +
            'the church. We closed with Psalm 23.';
        expect(checkMayBeBibleListPaste(text)).toBe(true);
        expect(read(text)).toMatchObject({
            listName: null,
            isNewList: false,
            isListNamed: true,
        });
        expect(toReferences(text)).toEqual(['JHN 3:16', 'ROM 8:28', 'PSA 23']);
    });

    test('a list pasted under it, a Bible beside a passage', () => {
        const text = `${BIBLE_LIST_PASTE_LEAD}\n- John 3:16 (kjv)\n- Xgenesis 1:1`;
        // A book only one Bible names is that Bible's.
        expect(toReferences(text)).toEqual(['JHN 3:16 [kjv]', 'GEN 1:1 [XXB]']);
    });

    test('the line alone, nothing pasted under it, is no passage to save', () => {
        expect(read(BIBLE_LIST_PASTE_LEAD)).toBeNull();
        expect(read(`${BIBLE_LIST_PASTE_LEAD}\nNothing here yet.`)).toBeNull();
    });

    test("the line in the window's language is read as the English one", () => {
        const text = `${SHOWN_LEAD}\nXjohn 3:16 xand Xpsalms 23.`;
        expect(toEnglishBibleListPasteLead(text, SHOWN_LEAD)).toBe(
            `${BIBLE_LIST_PASTE_LEAD}\n\nXjohn 3:16 xand Xpsalms 23.`,
        );
        expect(checkHasBibleListPasteLead(text, SHOWN_LEAD)).toBe(true);
        const english = toEnglishBibleListPasteLead(text, SHOWN_LEAD);
        expect(checkMayBeBibleListPaste(english)).toBe(true);
        expect(toReferences(english)).toEqual([
            'JHN 3:16 [XXB]',
            'PSA 23 [XXB]',
        ]);
        // Read as typed, the window's line asks for nothing.
        expect(read(text)).toBeNull();
    });

    test('a text with no such line, or the line changed, is left as it is', () => {
        const text = 'Xadd xthese: Xjohn 3:16';
        expect(toEnglishBibleListPasteLead(text, SHOWN_LEAD)).toBe(text);
        expect(checkHasBibleListPasteLead(text, SHOWN_LEAD)).toBe(false);
        // The English line is the English line, in any window.
        const english = `${BIBLE_LIST_PASTE_LEAD}\nJohn 3:16`;
        expect(toEnglishBibleListPasteLead(english, SHOWN_LEAD)).toBe(english);
        expect(checkHasBibleListPasteLead(english, SHOWN_LEAD)).toBe(true);
        expect(
            toEnglishBibleListPasteLead(english, BIBLE_LIST_PASTE_LEAD),
        ).toBe(english);
        expect(toEnglishBibleListPasteLead(text, '  ')).toBe(text);
    });
});
