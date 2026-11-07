import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { genPagePartNote } from '../../tools/owa-devtools-mcp/manualPage.mjs';

// The corpus is loaded once per window and held, so every test that needs a
// corpus in a different state -- one that failed to load, one in another
// language -- takes a FRESH copy of the module (`loadFresh`). The mock below
// closes over `state` alone, so a fresh copy reads whatever the test set; a
// chunk that fails to arrive is a `vi.doMock` of that test's own, undone
// after it (a mocked module's result outlives `vi.resetModules`).
const { state } = vi.hoisted(() => ({
    state: { langCode: 'en' },
}));

// The window's language is its `<html lang>`; here it is whatever a test
// says, including one the corpus has no translation for.
vi.mock('./chatLangHelpers', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return { ...actual, getAppLangCode: () => state.langCode };
});

import {
    clipKnownPage,
    clipKnownPageParts,
    FALLBACK_STARTERS,
    genKnownQuestionHint,
    readWholePage,
    toStarterQuestion,
} from './questionHelpers';

const TAIL_NOTE =
    '\n…(the page goes on: open it with owa_help_page for the rest)';

const MATCH_PATH = '../../tools/owa-devtools-mcp/questionMatch.mjs';

async function loadFresh() {
    vi.resetModules();
    return await import('./questionHelpers');
}

// The ranking is its own chunk, fetched on the first keystroke: it can fail
// to arrive.
function breakChunk(chunkPath: string, reason: string) {
    vi.doMock(chunkPath, () => {
        throw new Error(reason);
    });
}

beforeEach(() => {
    state.langCode = 'en';
});

afterEach(() => {
    vi.doUnmock(MATCH_PATH);
});

describe('a corpus that never arrives', () => {
    test('suggests nothing, lists nothing, and the chips fall back to the copy', async () => {
        breakChunk(MATCH_PATH, 'the chunk failed to load');
        const questions = await loadFresh();
        expect(await questions.suggestQuestions('song', 'presenter')).toEqual(
            [],
        );
        expect(await questions.getAllQuestions('presenter')).toEqual([]);
        expect(
            await questions.genFollowUpQuestions('song', 'presenter'),
        ).toEqual([]);
        expect(
            await questions.findKnownQuestion(
                'Where do I type John 3:16?',
                'presenter',
            ),
        ).toBeNull();
        // The empty window still offers what it can answer.
        expect(await questions.getStarterQuestions('reader', 2)).toEqual(
            FALLBACK_STARTERS.reader.slice(0, 2).map(toStarterQuestion),
        );
        expect(await questions.getStarterQuestions('presenter')).toEqual([
            {
                text: 'How do I present a Bible verse?',
                isTemplate: false,
            },
            { text: 'How do I add a background?', isTemplate: false },
            {
                text: 'Can you make a song from words I paste in?',
                isTemplate: false,
            },
            {
                text: 'Create a lyric file for song "Amazing Grace"',
                isTemplate: true,
            },
        ]);
    });
});

describe('the corpus in the window’s language', () => {
    test('a language the questions are not translated into keeps the English ones', async () => {
        state.langCode = 'xx';
        const questions = await loadFresh();
        const chips = await questions.getStarterQuestions('presenter');
        expect(chips.map((chip) => chip.text)).toEqual(
            FALLBACK_STARTERS.presenter.map((one) => {
                return toStarterQuestion(one).text;
            }),
        );
        expect(chips.some((chip) => chip.textEn !== undefined)).toBe(false);
        // The corpus itself loaded: the box still gets suggestions.
        expect(
            (await questions.suggestQuestions('song', 'presenter')).length,
        ).toBeGreaterThan(0);
    });
});

describe('a known page too long to ride whole', () => {
    test('a control named in its opening rides the opening, saying it goes on', () => {
        const lines = ['# W-90 — A long page', '', '1. Press **Clear All**.'];
        while (lines.join('\n').length < 7000) {
            lines.push(`${lines.length}. Another step of the long page.`);
        }
        const page = lines.join('\n');
        const parts = clipKnownPageParts(page, 'Clear All');
        expect(parts.mode).toBe('head');
        expect(parts.text).toBe(page.slice(0, 6000).trimEnd() + TAIL_NOTE);
        expect(clipKnownPage(page, 'Clear All')).toBe(parts.text);
        // A short page rides whole, whatever is named.
        expect(clipKnownPage('# Short\n\n1. Press **Clear All**.', 'x')).toBe(
            '# Short\n\n1. Press **Clear All**.',
        );
    });
});

describe('a page read whole, part by part', () => {
    test('a part that comes back empty leaves what came before, still saying it goes on', async () => {
        const first = `# W-42 — Help\n\n1. Step one.${genPagePartNote(1, 3)}`;
        const readPage = vi.fn(async (_id: string, part?: number) => {
            return part === undefined ? first : '   ';
        });
        expect(await readWholePage('W-42', readPage)).toBe(first);
        expect(readPage.mock.calls).toEqual([['W-42'], ['W-42', 2]]);
    });
});

describe('the hint for a known question', () => {
    const baseRow = {
        id: 'p.s.q',
        text: 'How do I write the links file?',
        kind: 'howto',
        focus: null,
        page: 'p',
        pageLabel: 'Presenter',
        section: 's',
        sectionLabel: 'S',
    };

    test('a part ending on a colon with no list after it is quoted by itself', () => {
        const page = [
            '# W-37 — Links',
            '',
            'Write it as a list of entries, each with a title to read and a url to open:',
            '',
            'Then save the file next to the chapter.',
        ].join('\n');
        const hint = genKnownQuestionHint(
            {
                ...baseRow,
                resources: {
                    recipe: 'W-37',
                    passage: 'Write it as a list of entries',
                },
            } as any,
            { pageText: page },
        )!;
        const quotedFirst = hint
            .split('quoted first and by itself:\n\n')[1]
            .split('\n\nThe guide page, put here')[0];
        expect(quotedFirst).toBe(
            'Write it as a list of entries, each with a title to read and a ' +
                'url to open:',
        );
        // What it does introduce rides with it.
        const listed = genKnownQuestionHint(
            {
                ...baseRow,
                resources: {
                    recipe: 'W-37',
                    passage: 'Write it as a list of entries',
                },
            } as any,
            {
                pageText: page.replace(
                    'Then save',
                    '- title: John 3\n\nThen save',
                ),
            },
        )!;
        expect(
            listed
                .split('quoted first and by itself:\n\n')[1]
                .split('\n\nThe guide page, put here')[0],
        ).toContain('- title: John 3');
    });
});
