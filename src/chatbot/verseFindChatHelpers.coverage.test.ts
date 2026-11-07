import { describe, expect, test, vi } from 'vitest';

// The verse finder's quieter corners: a computer with many Bibles, a page of
// verses that could not be read, the head start told to the model, and how a
// found verse is recognised in an answer. Every tool answer is handed in
// (`call`), so nothing here needs a running app.
const { mocks } = vi.hoisted(() => ({
    mocks: {
        appError: vi.fn(),
        requestBibleImport: vi.fn(),
        openBibleSetting: vi.fn(),
        openExternalURL: vi.fn(),
    },
}));

// The import conversation comes along for its first step (no Bible at
// all); these keep its app-side imports off a suite with no window.
vi.mock('../helper/loggerHelpers', () => ({
    appError: (...args: any[]) => mocks.appError(...args),
}));
vi.mock('../setting/bible-setting/bibleImportRequestHelpers', () => ({
    requestBibleImport: (...args: any[]) => mocks.requestBibleImport(...args),
}));
vi.mock('../setting/settingHelpers', () => ({
    openBibleSetting: (...args: any[]) => mocks.openBibleSetting(...args),
}));
vi.mock('../server/appProvider', () => ({
    default: {
        browserUtils: {
            openExternalURL: (...args: any[]) => mocks.openExternalURL(...args),
        },
    },
}));
vi.mock('./mcpClient', () => ({
    callTool: async () => {
        throw new Error('no tool host in this suite');
    },
    parseToolJson: (text: string) => {
        try {
            return JSON.parse(text);
        } catch (_error) {
            return null;
        }
    },
}));

import {
    VERSE_FIND_STEP_TOOL_NAME,
    VERSE_FIND_TOOL_NAME,
    answerVerseFindOffline,
    genVerseBrowseAction,
    genVerseChangeBibleAction,
    genVerseHeadStart,
    genVerseHeadStartAnswer,
    pickNamedVerses,
    readFoundPassages,
    runVerseFindStep,
    toVerseHeadStartAsk,
} from './verseFindChatHelpers';

function genCall(answer: unknown) {
    return vi.fn(async (_name: string, _args: any) => {
        if (answer instanceof Error) {
            throw answer;
        }
        return JSON.stringify(answer);
    });
}

// A search for "flood": where the story is told, and how many verses in
// each book hold the word.
const FLOOD_RESULT = {
    bible: 'KJV',
    total: 74,
    verses: [
        {
            key: 'GEN 7:17',
            ref: 'Genesis 7:17',
            text: 'And the flood was forty days upon the earth',
        },
        {
            key: 'MAT 24:39',
            ref: 'Matthew 24:39',
            text: 'And knew not until the flood came',
        },
    ],
    passages: [
        {
            key: 'GEN 8',
            ref: 'Genesis 7-9',
            // The title its Bible gives it; a symbol stands in for the
            // Bible's own words.
            title: '✝ 7-9',
        },
    ],
    byBook: [
        { book: 'Genesis', verses: 40 },
        { book: 'Matthew', verses: 2 },
        // No book: no count for it.
        { verses: 3 },
    ],
};

describe('which Bible, on a computer with many', () => {
    test('ten buttons, and the rest named for typing', async () => {
        const bibles = Array.from({ length: 12 }, (_, index) => {
            return { key: `B${index + 1}`, title: `Bible ${index + 1}` };
        });
        const answer = await runVerseFindStep(
            { step: 'bible' },
            genCall({ bible: 'B1', bibles }),
        );
        expect(answer.actions).toHaveLength(10);
        expect(answer.actions?.[0]).toMatchObject({
            label: 'B1 — Bible 1',
            toolName: VERSE_FIND_STEP_TOOL_NAME,
            args: { step: 'remember', bible: 'B1' },
        });
        expect(answer.text).toBe(
            '**Which Bible should I search?** Pick one below. Or type the ' +
                'short name of another one: B11, B12.',
        );
    });
});

describe('a page of every verse that could not be read', () => {
    test('keeps the search in that Bible and never shows the tool’s words', async () => {
        const answer = await runVerseFindStep(
            { step: 'more', bible: 'KJV', words: 'shepherd', from: 8 },
            genCall(new Error('The tool host stopped.')),
        );
        expect(answer.text).not.toContain('tool host');
        // The same page offered again, then another Bible.
        expect(answer.actions).toEqual([
            genVerseBrowseAction('KJV', 'shepherd', 8),
            genVerseChangeBibleAction('KJV', 'shepherd'),
        ]);
        expect(answer.verseFind).toBe('KJV');
    });
});

describe('the head start, as the model is told it', () => {
    test('names where the words gather and how many each book holds', async () => {
        const call = genCall(FLOOD_RESULT);
        const parts = await genVerseHeadStart('flood', 'KJV', null, call);
        expect(call).toHaveBeenCalledWith(VERSE_FIND_TOOL_NAME, {
            bible: 'KJV',
            words: 'flood',
        });
        expect(parts).toHaveLength(1);
        expect(parts[0].byBook).toBe('Genesis 40, Matthew 2');
        const ask = toVerseHeadStartAsk(parts);
        expect(ask).toContain(
            '  Where these words gather (a story is told there): Genesis ' +
                '7-9 (title: ✝ 7-9)',
        );
        expect(ask).toContain(
            '  74 verses hold them in all; by book: Genesis 40, Matthew 2',
        );
    });

    test('a passage with no title of its own is named by its reference alone', async () => {
        const parts = await genVerseHeadStart(
            'flood',
            'KJV',
            null,
            genCall({
                ...FLOOD_RESULT,
                passages: [{ key: 'GEN 8', ref: 'Genesis 7-9' }],
                byBook: [],
            }),
        );
        const ask = toVerseHeadStartAsk(parts);
        expect(ask).toContain(
            '(a story is told there): Genesis 7-9\n  74 verses hold them in ' +
                'all\n',
        );
        expect(ask).not.toContain('by book');
    });
});

describe('the head start as the answer', () => {
    test('a passage both searches found is opened once, ahead of the verses', async () => {
        const call = genCall(FLOOD_RESULT);
        const parts = await genVerseHeadStart('flood', 'KJV', 'flood', call);
        expect(parts).toHaveLength(2);
        const answer = genVerseHeadStartAnswer(parts, 'flood', 'KJV')!;
        const opened = (answer.actions ?? [])
            .filter((action) => action.toolName === VERSE_FIND_TOOL_NAME)
            .map((action) => action.args?.open);
        expect(opened).toEqual(['GEN 8', 'GEN 7:17', 'MAT 24:39']);
        expect(answer.verseFind).toBe('KJV');
    });
});

describe('a found verse named in an answer', () => {
    test('a passage whose own title carries no chapter is named by its reference', () => {
        const found = readFoundPassages(
            {
                passages: [
                    { key: 'GEN 8', ref: 'Genesis 7-9', title: 'The Flood' },
                ],
            },
            'KJV',
        );
        expect(
            pickNamedVerses(found, 'It is told in Genesis 7-9.', 'KJV').map(
                (verse) => verse.key,
            ),
        ).toEqual(['GEN 8']);
        expect(
            pickNamedVerses(found, 'Read Genesis 12 instead.', 'KJV'),
        ).toEqual([]);
    });
});

describe('with no assistant, and no search either', () => {
    test('says the Bible could not be searched, never the tool’s words', async () => {
        const answer = await answerVerseFindOffline(
            'love your enemies',
            'KJV',
            genCall(new Error('The app has no open page matching')),
        );
        expect(answer).toEqual({
            text:
                'I could not search the Bible just now. Make sure the main ' +
                'window is open, then type the words again.',
            verseFind: 'KJV',
        });
    });
});
