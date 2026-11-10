import { describe, expect, it, vi } from 'vitest';

// The import conversation's own module comes along for its first state;
// these keep its app-side imports off a test with no window.
vi.mock('../helper/loggerHelpers', () => {
    return { appError: vi.fn() };
});
vi.mock('../setting/bible-setting/bibleImportRequestHelpers', () => {
    return { requestBibleImport: vi.fn() };
});
vi.mock('../setting/settingHelpers', () => {
    return { openBibleSetting: vi.fn() };
});
vi.mock('../server/appProvider', () => {
    return { default: { browserUtils: { openExternalURL: vi.fn() } } };
});
vi.mock('./mcpClient', () => {
    return {
        callTool: vi.fn(),
        parseToolJson: (text: string) => {
            try {
                return JSON.parse(text);
            } catch (_error) {
                return null;
            }
        },
    };
});

import {
    BIBLE_IMPORT_STEP_TOOL_NAME,
    findBibleImportState,
} from './bibleImportChatHelpers';
import {
    VERSE_FIND_STEP_TOOL_NAME,
    VERSE_FIND_TOOL_NAME,
    answerVerseFindOffline,
    cutHeadStartVerse,
    genVerseChangeBibleAction,
    genVerseHeadStart,
    describeVerseOpened,
    readVerseFindThread,
    readVerseFindTypedPick,
    runVerseFindStep,
    toVerseFindAsk,
    EVERY_VERSE_LABEL,
    MORE_VERSES_LABEL,
    genVerseBrowseAction,
} from './verseFindChatHelpers';

const BIBLES = {
    bible: 'KJV',
    bibles: [
        { key: 'KJV', title: 'King James Version' },
        { key: 'SMOV', title: 'Sample Old Version' },
        { key: 'OTV', title: 'Other Test Version 1910' },
    ],
};

function genCall(answer: unknown) {
    return vi.fn(async (_name: string, _args: any) => {
        if (answer instanceof Error) {
            throw answer;
        }
        return JSON.stringify(answer);
    });
}

describe('which Bible', () => {
    it('lists the Bibles, the one in Find first and marked', async () => {
        const call = genCall(BIBLES);
        const answer = await runVerseFindStep(
            { step: 'bible', preferred: 'SMOV', isFromFind: true },
            call,
        );
        expect(call).toHaveBeenCalledWith(VERSE_FIND_TOOL_NAME, {});
        expect(answer.text).toContain('Which Bible should I search?');
        expect(answer.verseFind).toBeUndefined();
        expect(
            answer.actions?.map((action) => {
                return action.label;
            }),
        ).toEqual([
            'SMOV — Sample Old Version (the one in Find)',
            'KJV — King James Version',
            'OTV — Other Test Version 1910',
        ]);
        expect(answer.actions?.[0]).toMatchObject({
            toolName: VERSE_FIND_STEP_TOOL_NAME,
            args: { step: 'remember', bible: 'SMOV' },
        });
    });

    // A verse too long for the head start is cut at a word break and says
    // so; one with no break near the end loses only a half cluster -- a
    // joining sign with nothing under it (U+17D2 here, the script's own
    // subscript sign, written by code point as the confinement rule asks).
    it('cuts a long verse at a word break, never inside a cluster', () => {
        const words = Array.from({ length: 40 }, (_item, index) => {
            return `word${index}`;
        }).join(' ');
        const cut = cutHeadStartVerse(words);
        expect(cut.endsWith('…')).toBe(true);
        expect(cut.length).toBeLessThanOrEqual(161);
        expect(words.startsWith(cut.slice(0, -1))).toBe(true);
        expect(words.charAt(cut.length - 1)).toBe(' ');
        const zeroWidthJoined = words.replaceAll(' ', '​');
        expect(
            zeroWidthJoined.charAt(
                cutHeadStartVerse(zeroWidthJoined).length - 1,
            ),
        ).toBe('​');
        const stacker = String.fromCodePoint(0x17d2);
        const unbroken = 'a'.repeat(159) + stacker + 'b'.repeat(20);
        expect(cutHeadStartVerse(unbroken)).toBe(`${'a'.repeat(159)}…`);
        expect(cutHeadStartVerse('short verse')).toBe('short verse');
    });

    // In a window shown in another language, that language's whole Bibles
    // come right after the one asked for, its parts next: only ten are
    // buttons, and in the install order they had all gone to English ones.
    it('offers the window language’s Bibles first', async () => {
        const many = {
            bible: 'B01',
            bibles: [
                ...Array.from({ length: 10 }, (_item, index) => {
                    const key = `B${String(index + 1).padStart(2, '0')}`;
                    return { key, title: `English ${key}`, locale: 'en-US' };
                }),
                {
                    key: 'XNT',
                    title: 'New Testament',
                    locale: 'xx-XX',
                    books: 27,
                },
                { key: 'XOLD', title: 'Old Version', locale: 'xx-XX' },
                { key: 'XNEW', title: 'New Version', locale: 'xx' },
            ],
        };
        const labelsIn = async (langCode: string) => {
            const answer = await runVerseFindStep(
                { step: 'bible' },
                genCall(many),
                langCode,
            );
            return (answer.actions ?? []).map((action) => {
                return action.label.split(' — ')[0];
            });
        };
        expect(await labelsIn('xx')).toEqual([
            'B01',
            'XOLD',
            'XNEW',
            'XNT',
            'B02',
            'B03',
            'B04',
            'B05',
            'B06',
            'B07',
        ]);
        // English keeps the order the Bibles came in.
        expect(await labelsIn('en')).toEqual(
            many.bibles.slice(0, 10).map((bible) => bible.key),
        );
    });

    it('marks nothing when Find did not ask', async () => {
        const answer = await runVerseFindStep(
            { step: 'bible', preferred: 'OTV' },
            genCall(BIBLES),
        );
        expect(answer.actions?.[0].label).toBe('OTV — Other Test Version 1910');
    });

    it('goes straight on with the only Bible there is', async () => {
        const answer = await runVerseFindStep(
            { step: 'bible' },
            genCall({ bible: 'KJV', bibles: [BIBLES.bibles[0]] }),
        );
        expect(answer.text).toContain('one Bible on this computer');
        expect(answer.text).toContain('What do you remember');
        expect(answer.verseFind).toBe('KJV');
    });

    it('offers the import when no Bible is installed', async () => {
        const answer = await runVerseFindStep(
            { step: 'bible' },
            genCall(
                new Error(
                    'No Bible is installed on this computer, so there is ' +
                        'nothing to search.',
                ),
            ),
        );
        expect(answer.actions).toEqual([
            {
                label: 'Import a Bible for me',
                toolName: BIBLE_IMPORT_STEP_TOOL_NAME,
                args: findBibleImportState([], 'Import bible'),
            },
        ]);
    });

    it('says the app could not be read, never the tool’s words', async () => {
        const answer = await runVerseFindStep(
            { step: 'bible' },
            genCall(new Error('The app has no open page matching "x.html"')),
        );
        expect(answer.text).not.toContain('x.html');
        expect(answer.text).toContain('main window');
    });
});

describe('what they remember', () => {
    it('asks it with the Bible stamped on the answer', async () => {
        const answer = await runVerseFindStep({
            step: 'remember',
            bible: 'KJV',
            title: 'King James Version',
        });
        expect(answer.text).toContain('**KJV — King James Version**');
        expect(answer.verseFind).toBe('KJV');
        expect(answer.actions).toEqual([
            {
                label: 'Search another Bible',
                toolName: VERSE_FIND_STEP_TOOL_NAME,
                args: { step: 'bible', current: 'KJV' },
            },
        ]);
    });

    it('keeps the tab searching until the line is about the app', () => {
        const messages = [
            { author: 'bot' as const, verseFind: 'KJV' },
            {
                author: 'bot' as const,
                isFollowUp: true as const,
            },
        ];
        expect(readVerseFindThread(messages, 'love enemies pray')).toBe('KJV');
        expect(
            readVerseFindThread(messages, 'no, it is a verse about sheep'),
        ).toBe('KJV');
        expect(
            readVerseFindThread(messages, 'put it on the screen'),
        ).toBeNull();
        expect(readVerseFindThread(messages, 'How do I save it?')).toBeNull();
        expect(readVerseFindThread(messages, '/commands')).toBeNull();
        expect(
            readVerseFindThread(
                [...messages, { author: 'bot' as const }],
                'love enemies',
            ),
        ).toBeNull();
    });

    it('asks the model with the Bible named in the ask', () => {
        const ask = toVerseFindAsk('  love enemies ', 'SMOV');
        expect(ask.startsWith('love enemies\n\n')).toBe(true);
        expect(ask).toContain('"SMOV"');
        expect(ask).toContain(VERSE_FIND_TOOL_NAME);
    });
});

describe('the verses found', () => {
    it('says what a press opened, in words', () => {
        expect(
            describeVerseOpened(
                JSON.stringify({ opened: 'John 3:16', bible: 'KJV' }),
            ),
        ).toBe(
            '**Look at the app window.** John 3:16 (KJV) is open in the ' +
                'Bible Lookup. Nothing went on a screen.',
        );
        expect(describeVerseOpened('nope')).toContain('could not open');
    });
});

describe('the head start', () => {
    it('leaves out a search that failed', async () => {
        const parts = await genVerseHeadStart(
            'love enemies',
            'KJV',
            null,
            genCall(new Error('The app did not answer.')),
        );
        expect(parts).toEqual([]);
    });
});

describe('with no assistant', () => {
    it('searches the words and offers each verse', async () => {
        const call = genCall({
            bible: 'KJV',
            of: 2,
            total: 40,
            verses: [
                {
                    key: 'MAT 5:44',
                    ref: 'Matthew 5:44',
                    text: 'Love your enemies',
                    hits: 2,
                },
            ],
        });
        const answer = await answerVerseFindOffline(
            'love enemies',
            'KJV',
            call,
        );
        expect(call).toHaveBeenCalledWith(VERSE_FIND_TOOL_NAME, {
            bible: 'KJV',
            words: 'love enemies',
        });
        expect(answer.text).toContain(
            '- **Matthew 5:44** _(2 of 2 words)_ — Love your enemies',
        );
        expect(answer.text).toContain('40 verses have some of them');
        expect(answer.text).toContain('search by meaning');
        expect(answer.actions?.[0].args).toEqual({
            bible: 'KJV',
            open: 'MAT 5:44',
        });
        expect(answer.verseFind).toBe('KJV');
    });

    it('names the words the Bible does not have, and the Google link', async () => {
        const answer = await answerVerseFindOffline(
            'lover enemy',
            'KJV',
            genCall({ bible: 'KJV', verses: [], notInBible: ['lover'] }),
        );
        expect(answer.text).toContain('No verse in KJV');
        expect(answer.text).toContain('not in it at all: lover');
        expect(answer.links).toEqual([
            'https://www.google.com/search?q=bible+verse+lover+enemy',
        ]);
        expect(answer.actions?.[0]).toMatchObject({
            label: 'Search another Bible',
            args: { step: 'bible', current: 'KJV', words: 'lover enemy' },
        });
        expect(answer.verseFind).toBe('KJV');
    });
});

// The user's ask, 2026-10-17: searching a Bible in one language, they should
// be able to change to English.
describe('changing the Bible', () => {
    const FOUND = [
        { key: 'JHN 14:6', ref: 'John 14:6' },
        { key: 'JHN 21:17', ref: 'John 21:17' },
    ];

    it('carries only what a search can take, once, five at most', () => {
        const action = genVerseChangeBibleAction('KJV', 'x'.repeat(500), [
            ...FOUND,
            FOUND[0],
            { key: 'X'.repeat(40), ref: 'Long 1:1' },
            { key: 'PSA 23:1' } as any,
            { key: 'PSA 23:2', ref: 'Psalms 23:2', text: 'He maketh' },
            { key: 'PSA 23:3', ref: 'Psalms 23:3' },
            { key: 'PSA 23:4', ref: 'Psalms 23:4' },
            { key: 'PSA 23:5', ref: 'Psalms 23:5' },
        ]);
        expect(action.args.words).toHaveLength(200);
        expect(action.args.verses).toEqual([
            ...FOUND,
            { key: 'PSA 23:2', ref: 'Psalms 23:2' },
            { key: 'PSA 23:3', ref: 'Psalms 23:3' },
            { key: 'PSA 23:4', ref: 'Psalms 23:4' },
        ]);
    });

    it('lists every Bible but the one searched, carrying it all', async () => {
        const answer = await runVerseFindStep(
            {
                step: 'bible',
                current: 'SMOV',
                words: 'the way',
                verses: [FOUND[0]],
            },
            genCall(BIBLES),
        );
        expect(answer.text).toContain(
            'Which Bible should I show the verse in?',
        );
        expect(answer.actions).toEqual([
            {
                label: 'KJV — King James Version',
                toolName: VERSE_FIND_STEP_TOOL_NAME,
                args: {
                    step: 'remember',
                    bible: 'KJV',
                    title: 'King James Version',
                    words: 'the way',
                    verses: [FOUND[0]],
                },
            },
            {
                label: 'OTV — Other Test Version 1910',
                toolName: VERSE_FIND_STEP_TOOL_NAME,
                args: {
                    step: 'remember',
                    bible: 'OTV',
                    title: 'Other Test Version 1910',
                    words: 'the way',
                    verses: [FOUND[0]],
                },
            },
        ]);
        // Words typed instead of a pick go on searching the one searched.
        expect(answer.verseFind).toBe('SMOV');
        // And a typed pick carries the same.
        expect(
            readVerseFindTypedPick(
                [{ author: 'bot' as const, actions: answer.actions }],
                'otv',
            ),
        ).toMatchObject({ bible: 'OTV', verses: [FOUND[0]] });
        const several = await runVerseFindStep(
            { step: 'bible', current: 'KJV', verses: FOUND },
            genCall(BIBLES),
        );
        expect(several.text).toContain(
            'Which Bible should I show the verses in?',
        );
        const none = await runVerseFindStep(
            { step: 'bible', current: 'KJV', words: 'the way' },
            genCall(BIBLES),
        );
        expect(none.text).toContain('Which Bible should I search?');
    });

    it('offers the import when the one searched is all there is', async () => {
        const answer = await runVerseFindStep(
            { step: 'bible', current: 'KJV', verses: FOUND },
            genCall({ bible: 'KJV', bibles: [BIBLES.bibles[0]] }),
        );
        expect(answer.text).toContain('KJV is the only Bible on this computer');
        expect(answer.actions).toEqual([
            {
                label: 'Import a Bible for me',
                toolName: BIBLE_IMPORT_STEP_TOOL_NAME,
                args: findBibleImportState([], 'Import bible'),
            },
        ]);
        expect(answer.verseFind).toBe('KJV');
    });

    it('asks what they remember when the verses cannot be read', async () => {
        const answer = await runVerseFindStep(
            { step: 'remember', bible: 'OTV', verses: FOUND },
            genCall(new Error('The app did not answer.')),
        );
        expect(answer.text).toContain('I could not read those verses in OTV.');
        expect(answer.text).toContain('What do you remember');
        expect(answer.verseFind).toBe('OTV');
    });
});

describe('every verse with their words', () => {
    const page = (from: number, next?: number) => {
        return {
            bible: 'KJV',
            total: 10,
            ...(from > 0 ? { from } : {}),
            verses: Array.from({ length: from === 0 ? 8 : 2 }, (_, index) => {
                const verse = from + index + 1;
                return {
                    key: `JHN 10:${verse}`,
                    ref: `John 10:${verse}`,
                    text: 'the shepherd',
                };
            }),
            ...(next === undefined ? {} : { next }),
            passages: [{ ref: 'John 10', key: 'JHN 10', verses: 10 }],
        };
    };

    it('is a step of its own, a page at a time, with no model', async () => {
        const action = genVerseBrowseAction('KJV', ' shepherd ');
        expect(action).toEqual({
            label: EVERY_VERSE_LABEL,
            toolName: VERSE_FIND_STEP_TOOL_NAME,
            args: { step: 'more', bible: 'KJV', words: 'shepherd', from: 0 },
        });
        const call = genCall(page(0, 8));
        const answer = await runVerseFindStep(action.args as any, call);
        expect(call).toHaveBeenCalledWith(VERSE_FIND_TOOL_NAME, {
            bible: 'KJV',
            words: 'shepherd',
            from: 0,
        });
        expect(answer.text).toContain(
            'Verses 1 to 8 of 10 in KJV that have your words:',
        );
        expect(answer.text).toContain('These words gather in **John 10**.');
        expect(answer.verseFind).toBe('KJV');
        const more = answer.actions?.find((one) => {
            return one.label === MORE_VERSES_LABEL;
        });
        expect(more?.args).toEqual({
            step: 'more',
            bible: 'KJV',
            words: 'shepherd',
            from: 8,
        });
        // Five buttons to open, then the next page, then another Bible.
        expect(answer.actions).toHaveLength(7);
    });

    it('says when that was every verse, or all a search reaches', async () => {
        const last = await runVerseFindStep(
            { step: 'more', bible: 'KJV', words: 'shepherd', from: 8 },
            genCall(page(8)),
        );
        expect(last.text).toContain('Verses 9 to 10 of 10');
        expect(last.text).toContain(
            'That is every verse in KJV with those words.',
        );
        expect(
            last.actions?.some((one) => {
                return one.label === MORE_VERSES_LABEL;
            }),
        ).toBe(false);
        const none = await runVerseFindStep(
            { step: 'more', bible: 'KJV', words: 'shepherd', from: 300 },
            genCall({ bible: 'KJV', total: 400, verses: [] }),
        );
        expect(none.text).toBe('No more verses in KJV have those words.');
    });

    // Found by UT-89b (2026-11-03): a page that could not be READ said "No
    // more verses in KJV have those words" -- right under "Verses 1 to 8 of
    // 10". It says the search failed, and the same press tries again.
    it('says a page that could not be read failed, and offers it again', async () => {
        for (const call of [
            genCall(new Error('The tool host stopped.')),
            vi.fn(async (_name: string, _args: any) => {
                return 'The tool host stopped.';
            }),
        ]) {
            const answer = await runVerseFindStep(
                { step: 'more', bible: 'KJV', words: 'shepherd', from: 8 },
                call,
            );
            expect(answer.text).toBe(
                'I could not search the Bible just now. Make sure the main ' +
                    'window is open, then type the words again.',
            );
            expect(answer.actions).toEqual([
                genVerseBrowseAction('KJV', 'shepherd', 8),
                genVerseChangeBibleAction('KJV', 'shepherd'),
            ]);
            expect(answer.verseFind).toBe('KJV');
        }
    });
});
