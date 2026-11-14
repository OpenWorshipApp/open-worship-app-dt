import { describe, expect, test } from 'vitest';

import {
    checkIsBibleListRowFree,
    checkIsBibleListSaveFollowUp,
    checkIsBibleListSaveLine,
    findCarriedBibleListRequest,
    genBibleListSaveHint,
    readCarriedBibleListRequest,
    checkIsSavedAlready,
    readBibleListTitles,
    checkIsUnreadableReference,
    genDefaultBibleListName,
    readBibleListAsk,
    readReferenceList,
} from './bibleListAskHelpers';
import { genMadeUndoAction } from './documentCreateHelpers';

describe('passages saved to a Bibles list, or a new list', () => {
    test('the asks the baseline run answered wrongly', () => {
        expect(readBibleListAsk('Save John 3:16 to my Bible list.')).toEqual({
            listName: null,
            isNewList: false,
            references: ['John 3:16'],
        });
        expect(
            readBibleListAsk(
                'Make a new Bible list called Easter with John 20:1-18 and ' +
                    '1 Corinthians 15:3-8.',
            ),
        ).toEqual({
            listName: 'Easter',
            isNewList: true,
            references: ['John 20:1-18', '1 Corinthians 15:3-8'],
        });
    });

    test('the other ways a person says it', () => {
        expect(
            readBibleListAsk(
                'Please add Romans 8:28 and Psalm 23 to my Bibles',
            ),
        ).toEqual({
            listName: null,
            isNewList: false,
            references: ['Romans 8:28', 'Psalm 23'],
        });
        expect(
            readBibleListAsk('Put Song of Solomon 2:4 in the Wedding list'),
        ).toEqual({
            listName: 'Wedding',
            isNewList: false,
            references: ['Song of Solomon 2:4'],
        });
        expect(
            readBibleListAsk(
                'Save Isaiah 9:6, Luke 2:11 to the list called "Christmas"',
            ),
        ).toEqual({
            listName: 'Christmas',
            isNewList: false,
            references: ['Isaiah 9:6', 'Luke 2:11'],
        });
        expect(
            readBibleListAsk('Can you create a verse list for Easter?'),
        ).toEqual({ listName: 'Easter', isNewList: true, references: [] });
        expect(
            readBibleListAsk(
                'Create a Bible list named Youth: John 3:16; 1 John 4:8',
            ),
        ).toEqual({
            listName: 'Youth',
            isNewList: true,
            references: ['John 3:16', '1 John 4:8'],
        });
        expect(readBibleListAsk('Make a new bible list')).toEqual({
            listName: null,
            isNewList: true,
            references: [],
        });
    });

    test('anything it cannot read whole is the assistant’s', () => {
        for (const text of [
            'How do I save a verse to my Bible list?',
            'Where is my Bible list?',
            'Save the verse about love to my Bible list',
            'Make a bible list of my favourite verses',
            'Make a new Bible list called Easter with the resurrection verses',
            'Add John 3:16 to my running order',
            'Save John 3:16',
            'Make a new running order',
            '/save John 3:16',
            '',
        ]) {
            expect(readBibleListAsk(text)).toBeNull();
        }
    });
});

describe('references as people write them', () => {
    test('split on commas, semicolons and "and"', () => {
        expect(
            readReferenceList('John 3:16, Romans 8:28 and Psalm 23.'),
        ).toEqual(['John 3:16', 'Romans 8:28', 'Psalm 23']);
        expect(
            readReferenceList('1 Corinthians 15:3-8 & 2 Kings 2:11'),
        ).toEqual(['1 Corinthians 15:3-8', '2 Kings 2:11']);
    });

    test('a part that is no reference makes none of it one', () => {
        expect(readReferenceList('John 3:16 and the Lord’s Prayer')).toBeNull();
        expect(readReferenceList('three verses')).toBeNull();
        expect(readReferenceList('')).toBeNull();
    });
});

test('a new list with no name gets the day it is made', () => {
    expect(genDefaultBibleListName(new Date(2026, 10, 12))).toBe(
        'Verses 2026-11-12',
    );
});

describe('Undo this change under passages saved', () => {
    test('the list made goes back last, after every passage', () => {
        expect(
            genMadeUndoAction('Easter', ['add-1', 'add-2'], 'made-1'),
        ).toEqual({
            label: 'Undo this change',
            toolName: 'lyric-undo',
            args: {
                id: 'add-2',
                name: 'Easter',
                ids: ['made-1', 'add-1', 'add-2'],
                madeId: 'made-1',
            },
        });
    });

    test('one passage saved: its own id alone', () => {
        expect(genMadeUndoAction('Default', ['add-1'], null)).toEqual({
            label: 'Undo this change',
            toolName: 'lyric-undo',
            args: { id: 'add-1', name: 'Default' },
        });
    });

    test('nothing changed, no button', () => {
        expect(genMadeUndoAction('Default', [], null)).toBeNull();
    });

    test('a passage no Bible reads is told apart from a list refused', () => {
        expect(
            checkIsUnreadableReference(
                '"Hezekiah 3:1" could not be read as a passage in any ' +
                    'installed version.',
            ),
        ).toBe(true);
        expect(
            checkIsUnreadableReference('There is no Bibles list called "X".'),
        ).toBe(false);
    });
});

test("the corpus's own fill-in row is done by the window, any other row is the guide's", () => {
    expect(checkIsBibleListRowFree(null)).toBe(true);
    expect(
        checkIsBibleListRowFree({ resources: { tools: ['owa_bible_item'] } }),
    ).toBe(true);
    expect(
        checkIsBibleListRowFree({ resources: { recipe: 'W-11' } as any }),
    ).toBe(false);
    // The row as the corpus files it, asked as it stands.
    expect(readBibleListAsk('Save John 3:16 to my Bibles list')).toEqual({
        listName: null,
        isNewList: false,
        references: ['John 3:16'],
    });
});

describe('a passage the list holds already is not saved twice', () => {
    const listed = {
        where: 'Presenter',
        lists: [
            {
                name: 'Default',
                count: 2,
                items: [
                    { id: 1, title: '(KJV) John 3:16' },
                    { id: 2, title: '(KJV) Psalm 23:1-6' },
                ],
            },
        ],
    };

    test('the titles are read off the list', () => {
        expect(readBibleListTitles(listed)).toEqual([
            '(KJV) John 3:16',
            '(KJV) Psalm 23:1-6',
        ]);
        expect(readBibleListTitles(null)).toEqual([]);
    });

    test('the same passage in the same Bible is a repeat', () => {
        const titles = readBibleListTitles(listed);
        expect(checkIsSavedAlready('(KJV) John 3:16', titles)).toBe(true);
        expect(checkIsSavedAlready('(kjv)  John 3:16', titles)).toBe(true);
        expect(checkIsSavedAlready('(KJV) John 3:17', titles)).toBe(false);
        // Another Bible's John 3:16 is another passage.
        expect(checkIsSavedAlready('(ESV) John 3:16', titles)).toBe(false);
        expect(checkIsSavedAlready('', titles)).toBe(false);
    });
});

// 2026-11-14, EC-703: a model asked to add Bible items put one on the screen.
describe('the words typed ask to save Bible items, never to show them', () => {
    test.each([
        'add bible items for me for:\njohn 3:16 gen 1',
        'Save John 3:16 as a Bible item',
        'please put Romans 8:28 in my Bibles list',
        'Add Psalm 23 to the bible list called Easter',
    ])('save: %s', (text) => {
        expect(checkIsBibleListSaveLine(text)).toBe(true);
    });

    test.each([
        'Put John 3:16 on the screen',
        'add John 3:16 to my bible items and show it',
        'Add Psalm 23 to my running order',
        'add john 3:16',
        'Open my Bibles list',
        '',
    ])('not: %s', (text) => {
        expect(checkIsBibleListSaveLine(text)).toBe(false);
    });
});

// EC-703: the model's own option "John 3:16" under such a question put the
// verse on the screen.
describe('a reply under a question that asked to save Bible items', () => {
    const asked =
        'add a bible item for me: the verse where God so loved the world';

    test('goes on with the save unless it names the screen', () => {
        expect(checkIsBibleListSaveFollowUp('John 3:16', asked)).toBe(true);
        expect(checkIsBibleListSaveFollowUp('yes', asked)).toBe(true);
        expect(
            checkIsBibleListSaveFollowUp('show it on the screen', asked),
        ).toBe(false);
        expect(checkIsBibleListSaveFollowUp('put it up', asked)).toBe(false);
        expect(checkIsBibleListSaveFollowUp('John 3:16', 'hello')).toBe(false);
        expect(checkIsBibleListSaveFollowUp('John 3:16', null)).toBe(false);
    });

    test('carries its list, never a new one again', () => {
        expect(readCarriedBibleListRequest(asked)).toEqual({
            listName: null,
            isNewList: false,
            isListNamed: true,
        });
        expect(
            readCarriedBibleListRequest(
                'Add these bible items to the Easter list: the love verses',
            ),
        ).toEqual({ listName: 'Easter', isNewList: false, isListNamed: true });
        expect(readCarriedBibleListRequest('Put John 3:16 up')).toBeNull();
    });

    test('a model is told to offer the passage, never the screen', () => {
        expect(genBibleListSaveHint(asked)).toContain('OPTIONS');
        expect(genBibleListSaveHint('Put John 3:16 on the screen')).toBeNull();
    });

    test('only while no answer since saved anything', () => {
        const answer = { author: 'bot', text: 'Which verse?' };
        expect(
            findCarriedBibleListRequest([
                { author: 'you', text: asked },
                answer,
            ]),
        ).toMatchObject({ isListNamed: true });
        expect(
            findCarriedBibleListRequest([
                { author: 'you', text: asked },
                {
                    ...answer,
                    actions: [{ label: 'Undo this change' }],
                },
            ]),
        ).toBeNull();
        expect(
            findCarriedBibleListRequest([{ author: 'you', text: asked }]),
        ).toBeNull();
        expect(
            findCarriedBibleListRequest([
                { author: 'you', text: 'hello' },
                answer,
            ]),
        ).toBeNull();
    });
});
