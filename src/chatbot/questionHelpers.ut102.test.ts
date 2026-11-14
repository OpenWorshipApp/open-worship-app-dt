import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The corpus in a window whose language is not English: a word typed alone
// in it is offered jobs only when the corpus is translated into it, and a
// translation that fails to load leaves the English questions working.
// The window's language, the language a line is typed in, and the store's
// answer are whatever a test says; the corpus itself is the real one.
const { state } = vi.hoisted(() => ({
    state: {
        langCode: 'en',
        detected: null as string | null,
        loadLangFile: null as
            null | ((langCode: string, fileName: string) => Promise<unknown>),
    },
}));

vi.mock('./chatLangHelpers', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        getAppLangCode: () => state.langCode,
        detectTypedLanguage: () => state.detected,
    };
});

vi.mock('../lang/langFileStore', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        loadLangFile: (langCode: string, fileName: string) => {
            if (state.loadLangFile === null) {
                return actual.loadLangFile(langCode, fileName);
            }
            return state.loadLangFile(langCode, fileName);
        },
    };
});

const MATCH_PATH = '../../tools/owa-devtools-mcp/questionMatch.mjs';

async function loadFresh() {
    vi.resetModules();
    return await import('./questionHelpers');
}

beforeEach(() => {
    state.langCode = 'en';
    state.detected = null;
    state.loadLangFile = null;
});

afterEach(() => {
    vi.doUnmock(MATCH_PATH);
});

describe('genTopicChoices in a window of another language', () => {
    test('a word typed in the window language with no translated corpus is offered nothing', async () => {
        state.langCode = 'xx';
        state.detected = 'xx';
        const loadLangFile = vi.fn(async () => null);
        state.loadLangFile = loadLangFile;
        const questions = await loadFresh();
        expect(await questions.genTopicChoices('lyric', 'presenter')).toEqual(
            [],
        );
        expect(loadLangFile).toHaveBeenCalledWith('xx', 'questions.json');
    });

    test('with the corpus translated into it, the jobs are offered in its words', async () => {
        state.langCode = 'xx';
        state.detected = 'xx';
        state.loadLangFile = async () => ({
            questions: {
                'presenter.making.new-lyric': {
                    en: 'How do I make a new song?',
                    text: 'Invented words for a new song',
                },
            },
        });
        const questions = await loadFresh();
        const choices = await questions.genTopicChoices('lyric', 'presenter');
        expect(choices.length).toBeGreaterThanOrEqual(2);
        expect(choices).toContain('Invented words for a new song');
        expect(choices).not.toContain('How do I make a new song?');
    });

    test('a line typed in a language other than the window one is offered nothing', async () => {
        state.langCode = 'xx';
        state.detected = 'yy';
        const loadLangFile = vi.fn(async () => ({}));
        state.loadLangFile = loadLangFile;
        const questions = await loadFresh();
        expect(await questions.genTopicChoices('lyric', 'presenter')).toEqual(
            [],
        );
        // Decided before the corpus is ever read.
        expect(loadLangFile).not.toHaveBeenCalled();
    });

    test('a translation that fails to load keeps the English questions', async () => {
        state.langCode = 'xx';
        state.loadLangFile = async () => {
            throw new Error('the plugin file is gone');
        };
        const questions = await loadFresh();
        const suggestions = await questions.suggestQuestions(
            'song',
            'presenter',
        );
        expect(suggestions.length).toBeGreaterThan(0);
        expect(
            suggestions.every((row) => {
                // Nothing translated: each row's words are its English.
                return row.textEn === row.text;
            }),
        ).toBe(true);
        // English typed in it: the corpus is English, so the jobs are there.
        const choices = await questions.genTopicChoices('lyric', 'presenter');
        expect(choices).toContain('How do I make a new song?');
    });
});

describe('genTopicChoices with no corpus', () => {
    test('an English word is offered nothing when the ranking never arrives', async () => {
        vi.doMock(MATCH_PATH, () => {
            throw new Error('the chunk failed to load');
        });
        const questions = await loadFresh();
        expect(await questions.genTopicChoices('lyric', 'presenter')).toEqual(
            [],
        );
    });
});
