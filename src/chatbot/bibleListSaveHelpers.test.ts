import { describe, expect, test } from 'vitest';

import kjvBibleConfig from '../helper/bible-helpers/kjvBibleConfig.json';
import type { BibleListPickType } from './bibleListPasteHelpers';
import {
    BIBLE_LIST_PICK_TOOL_NAME,
    genBibleListPickActions,
    genBibleListPickText,
    genBibleListSavedLines,
    nameBibleListRangePick,
    readBibleListPasteAsk,
    readSavedBibleListTitles,
    readVersionRefusal,
    saveBibleListPassages,
    toBibleListSaveAsk,
    toValidBibleListPickArgs,
    type CallToolJsonType,
} from './bibleListSaveHelpers';

const bookKeys = kjvBibleConfig.bookKeysOrder;
const english = bookKeys.map((key) => {
    return (kjvBibleConfig.keyBookMap as Record<string, string>)[key];
});
const BOOKS_ANSWER = {
    kind: 'books',
    bookKeys,
    english,
    bibles: [{ keys: ['KJV'], locale: 'en', books: english }],
};

// A Bibles list held in memory, answering `owa_bible_item` and `owa_undo`
// the way the app does, with only the KJV installed.
function genFakeTools(titles: string[] = []) {
    const calls: { name: string; args: Record<string, unknown> }[] = [];
    const held = [...titles];
    let nextId = 1;
    const callToolJson: CallToolJsonType = async (name, args) => {
        calls.push({ name, args });
        if (name === 'owa_bible_suggest') {
            return BOOKS_ANSWER;
        }
        if (name === 'owa_undo') {
            held.pop();
            return { undone: true };
        }
        if (name === 'owa_present_bible') {
            if (args.reference === 'GEN 1') {
                return { reference: 'Genesis 1:1-31', version: 'KJV' };
            }
            if (args.reference === 'GEN 1:2-31') {
                return { reference: 'Genesis 1:2-31', version: 'KJV' };
            }
            if (args.reference === 'GEN 1:31') {
                return { reference: 'Genesis 1:31', version: 'KJV' };
            }
            throw new Error('"x" could not be read as a passage in KJV.');
        }
        if (args.action === 'list') {
            return {
                lists: [
                    {
                        name: 'Default',
                        items: held.map((title) => ({ title })),
                    },
                ],
            };
        }
        const version = String(args.version ?? 'KJV');
        if (version.toUpperCase() !== 'KJV') {
            throw new Error(
                `No Bible version called "${version}" is installed. Use one of the installed ones. Installed versions: KJV.`,
            );
        }
        if (String(args.reference).startsWith('HEZ')) {
            throw new Error(
                '"HEZ 1" could not be read as a passage in any installed version.',
            );
        }
        if (args.reference === 'BUSY') {
            throw new Error('Too many changes in a minute.');
        }
        const title = `(KJV) ${String(args.reference)}`;
        held.push(title);
        return { added: title, undoId: `add-${nextId++}` };
    };
    return { calls, callToolJson };
}

describe('saving passages to a Bibles list (EC-626)', () => {
    test('each in the Bible written beside it, a repeat taken back', async () => {
        const { calls, callToolJson } = genFakeTools(['(KJV) JHN 3:16']);
        const saved = await saveBibleListPassages(
            callToolJson,
            [
                { written: 'John 3:15', reference: 'JHN 3:15', version: 'kjv' },
                { written: 'John 3:16', reference: 'JHN 3:16', version: null },
                { written: 'Psalm 23', reference: 'PSA 23', version: null },
                { written: 'Psalm 23', reference: 'PSA 23', version: null },
            ],
            {
                listName: null,
                pageArgs: {},
                savedBefore: await readSavedBibleListTitles(
                    callToolJson,
                    null,
                    {},
                ),
            },
        );
        expect(saved).toEqual({
            savedTitles: ['(KJV) JHN 3:15', '(KJV) PSA 23'],
            changeIds: ['add-1', 'add-3'],
            alreadySaved: ['(KJV) JHN 3:16', '(KJV) PSA 23'],
            unreadable: [],
            notSaved: [],
            picks: [],
        });
        expect(calls[1]).toEqual({
            name: 'owa_bible_item',
            args: { action: 'add', reference: 'JHN 3:15', version: 'kjv' },
        });
        expect(calls[2].args).not.toHaveProperty('version');
        expect(
            calls.filter((one) => {
                return one.name === 'owa_undo';
            }),
        ).toHaveLength(2);
    });

    test('a Bible that is not installed is asked about, with the ones that are', async () => {
        const { callToolJson } = genFakeTools();
        const saved = await saveBibleListPassages(
            callToolJson,
            [
                { written: 'John 3', reference: 'JHN 3', version: 'niv' },
                { written: 'Hezekiah 1', reference: 'HEZ 1', version: null },
                { written: 'Ruth 1', reference: 'BUSY', version: null },
            ],
            {
                listName: 'Easter',
                pageArgs: { page: 'reader.html' },
                savedBefore: [],
            },
        );
        expect(saved.picks).toEqual([
            {
                kind: 'version',
                written: 'John 3',
                missingVersion: 'niv',
                choices: [{ label: 'KJV', reference: 'JHN 3', version: 'KJV' }],
            },
        ]);
        expect(saved.unreadable).toEqual(['Hezekiah 1']);
        expect(saved.notSaved).toEqual(['Ruth 1']);
        expect(genBibleListPickText(saved.picks[0])).toBe(
            'No Bible called “niv” is installed. Which Bible should I save John 3 in?',
        );
    });

    test('the refusal is read for its Bible and the installed ones', () => {
        expect(
            readVersionRefusal(
                'No Bible version called "NIV" is installed. Installed versions: KJV, Amplified.',
            ),
        ).toEqual({ version: 'NIV', installed: ['KJV', 'Amplified'] });
        expect(
            readVersionRefusal('No Bible version called "NIV" is installed.'),
        ).toEqual({
            version: 'NIV',
            installed: [],
        });
        // The tool's own words, a sentence between the two.
        expect(
            readVersionRefusal(
                'No Bible version called "niv" is installed. Use one of the ' +
                    'installed ones, named under versions, or leave version ' +
                    'out to use the one the Bible Lookup is on. Installed ' +
                    'versions: KJV, Holy Bible.',
            ),
        ).toEqual({ version: 'niv', installed: ['KJV', 'Holy Bible'] });
        expect(readVersionRefusal('Too many changes.')).toBeNull();
    });

    test('a list that cannot be read holds nothing yet', async () => {
        expect(
            await readSavedBibleListTitles(
                async () => {
                    throw new Error('No list called "Default".');
                },
                null,
                {},
            ),
        ).toEqual([]);
    });
});

describe('what the answer says', () => {
    test('made, saved, kept out, unread, not saved and left over', () => {
        expect(
            genBibleListSavedLines(
                {
                    savedTitles: ['John 3:16', 'Romans 8:28'],
                    alreadySaved: ['Psalm 23'],
                    unreadable: ['Hezekiah 3:5'],
                    notSaved: ['Ruth 1'],
                },
                'Easter',
                { isMadeList: true, overflow: ['Acts 2:1', 'Acts 2:2'] },
            ),
        ).toEqual([
            'I made “Easter” for you. It is in Bibles now.',
            'Saved to the Bibles list “Easter”: John 3:16, Romans 8:28.',
            'Psalm 23 is in the Bibles list “Easter” already, so it is not saved twice.',
            'These could not be read as a passage in any installed Bible: Hezekiah 3:5.',
            'I could not save Ruth 1 just now.',
            'I save up to 20 passages at a time. These were not saved: Acts 2:1, Acts 2:2. Send them again and I will save them.',
        ]);
        expect(
            genBibleListSavedLines(
                {
                    savedTitles: ['John 3:16'],
                    alreadySaved: ['Psalm 23'],
                    unreadable: [],
                    notSaved: [],
                },
                null,
            ),
        ).toEqual([
            'Saved John 3:16 to your Bibles list.',
            'Psalm 23 is in your Bibles list already, so it is not saved twice.',
        ]);
    });
});

const RANGE_PICK: BibleListPickType = {
    kind: 'range',
    written: 'GEN 1:2-',
    choices: [
        { label: 'GEN 1:2-', reference: 'GEN 1:2-', version: null },
        { label: 'GEN 1:2', reference: 'GEN 1:2', version: null },
    ],
};

describe('an unclear passage asked about with buttons', () => {
    test('an open range named as its Bible names it', async () => {
        const { callToolJson } = genFakeTools();
        const named = await nameBibleListRangePick(callToolJson, RANGE_PICK);
        expect(
            named.choices.map((one) => {
                return [one.label, one.reference];
            }),
        ).toEqual([
            ['Genesis 1:2-31', 'GEN 1:2-31'],
            ['Genesis 1:2', 'GEN 1:2'],
        ]);
        // From the chapter's last verse, the one verse it is.
        const last = await nameBibleListRangePick(callToolJson, {
            ...RANGE_PICK,
            choices: [
                { label: 'GEN 1:31-', reference: 'GEN 1:31-', version: null },
                { label: 'GEN 1:31', reference: 'GEN 1:31', version: null },
            ],
        });
        expect(last.choices[0]).toMatchObject({
            label: 'Genesis 1:31',
            reference: 'GEN 1:31',
        });
        // Past the chapter's end: left as written.
        const past = {
            ...RANGE_PICK,
            choices: [
                { label: 'GEN 1:40-', reference: 'GEN 1:40-', version: null },
                RANGE_PICK.choices[1],
            ],
        };
        expect(await nameBibleListRangePick(callToolJson, past)).toBe(past);
        expect(genBibleListPickText(named)).toBe(
            'Which do you mean by “GEN 1:2-”? Press one and I will save it.',
        );
        // Left as written when the Bible cannot be read.
        const unread = {
            ...RANGE_PICK,
            choices: [
                { ...RANGE_PICK.choices[0], reference: 'x' },
                RANGE_PICK.choices[1],
            ],
        };
        expect(await nameBibleListRangePick(callToolJson, unread)).toBe(unread);
        const book: BibleListPickType = { ...RANGE_PICK, kind: 'book' };
        expect(await nameBibleListRangePick(callToolJson, book)).toBe(book);
    });

    test('a button a choice, then Skip, each carrying the rest', () => {
        const rest: BibleListPickType[] = [
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
        ];
        const actions = genBibleListPickActions(
            RANGE_PICK,
            rest,
            'Easter',
            'reader.html',
        );
        expect(
            actions.map((one) => {
                return [one.label, one.isData === true, one.toolName];
            }),
        ).toEqual([
            ['GEN 1:2-', true, BIBLE_LIST_PICK_TOOL_NAME],
            ['GEN 1:2', true, BIBLE_LIST_PICK_TOOL_NAME],
            ['Skip', false, BIBLE_LIST_PICK_TOOL_NAME],
        ]);
        expect(toValidBibleListPickArgs(actions[0].args)).toEqual({
            choice: RANGE_PICK.choices[0],
            list: 'Easter',
            page: 'reader.html',
            rest,
        });
        expect(toValidBibleListPickArgs(actions[2].args)).toEqual({
            choice: null,
            list: 'Easter',
            page: 'reader.html',
            rest,
        });
        // Two choices of one label are one button.
        expect(
            genBibleListPickActions(
                {
                    ...RANGE_PICK,
                    choices: [RANGE_PICK.choices[0], RANGE_PICK.choices[0]],
                },
                [],
                null,
            ),
        ).toHaveLength(2);
    });

    test('a pressed button read back field by field', () => {
        const choice = {
            label: 'John 3:16',
            reference: 'JHN 3:16',
            version: null,
        };
        expect(
            toValidBibleListPickArgs({ choice, list: null, rest: 'x' }),
        ).toEqual({
            choice,
            list: null,
            rest: [],
        });
        for (const args of [
            null,
            'x',
            { choice, list: 5, rest: [] },
            { choice, list: '', rest: [] },
            { choice, list: 'x'.repeat(121), rest: [] },
            { choice, list: null, page: 'presenter.html', rest: [] },
            { choice: { label: 'x' }, list: null, rest: [] },
        ]) {
            expect(toValidBibleListPickArgs(args)).toBeNull();
        }
    });
});

describe('reading what was typed', () => {
    test('off the installed Bibles, or undefined when they cannot be read', async () => {
        const { callToolJson } = genFakeTools();
        expect(
            await readBibleListPasteAsk(
                callToolJson,
                'Add these to my Bibles list:\nJohn 3:16\nRomans 8:28 (kjv)',
            ),
        ).toMatchObject({
            listName: null,
            isListNamed: true,
            passages: [
                { reference: 'JHN 3:16', version: null },
                { reference: 'ROM 8:28', version: 'kjv' },
            ],
        });
        expect(
            await readBibleListPasteAsk(callToolJson, 'Show me John 3:16'),
        ).toBeNull();
        expect(
            await readBibleListPasteAsk(async () => {
                throw new Error('The tool host is down.');
            }, 'Add John 3:16'),
        ).toBeUndefined();
        expect(
            await readBibleListPasteAsk(async () => {
                return null;
            }, 'Add John 3:16'),
        ).toBeUndefined();
    });

    test("the older reader's answer in the same shape", () => {
        expect(
            toBibleListSaveAsk({
                listName: 'Easter',
                isNewList: true,
                references: ['John 3:16'],
            }),
        ).toEqual({
            listName: 'Easter',
            isNewList: true,
            isListNamed: true,
            passages: [
                { written: 'John 3:16', reference: 'John 3:16', version: null },
            ],
            picks: [],
            unreadable: [],
            overflow: [],
        });
        expect(toBibleListSaveAsk(null)).toBeNull();
    });
});
