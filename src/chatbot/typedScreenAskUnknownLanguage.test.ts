import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ScreenAskWordsType } from './typedScreenAskHelpers';

// EC-614: a line typed in a language no installed package can name -- a
// fifth of the asks written blind -- read with two made-up installed
// languages, so that no language is named here. Their words are nonsense,
// written the way a package writes them.
type MadeUpLanguageType = {
    code: string;
    scriptPattern: RegExp | null;
    screenAskWords: ScreenAskWordsType | null;
};

const state = vi.hoisted(() => {
    return {
        typedCode: null as string | null,
        languageList: [] as MadeUpLanguageType[],
    };
});

vi.mock('./chatLangHelpers', async (importOriginal) => {
    return {
        ...(await importOriginal<object>()),
        detectTypedLanguage: () => state.typedCode,
        getAppLangCode: () => 'en',
        getAssistantLanguage: (code: string) => {
            return (
                state.languageList.find((language) => {
                    return language.code === code;
                }) ?? { code: 'en', scriptPattern: null, screenAskWords: null }
            );
        },
        listAssistantLanguages: () => [],
        listTypedLanguages: () => state.languageList,
    };
});

import { readScreenAsk } from './typedScreenAskHelpers';

beforeEach(() => {
    state.typedCode = 'other';
    state.languageList = [
        {
            code: 'xx',
            scriptPattern: null,
            screenAskWords: {
                howTo: ['quomx'],
                screen: ['zorp*'],
                transition: ['flazz*'],
                exclude: ['songx*'],
            },
        },
        {
            code: 'yy',
            scriptPattern: null,
            screenAskWords: {
                howTo: ['plimx … stepx*'],
                screen: ['skreen*'],
                lock: ['lokx*'],
            },
        },
    ];
});

describe('readScreenAsk, a line no installed language names', () => {
    it('is a how-to when any installed language says so', () => {
        // English alone reads its "transition": a how-to naming the
        // transition by the English word had gone to the screens.
        expect(readScreenAsk('zeddo transition off', 'presenter')).toBe(
            'transition',
        );
        expect(readScreenAsk('quomx transition off', 'presenter')).toBe(null);
        expect(
            readScreenAsk('plimx me the stepxes transition', 'presenter'),
        ).toBe(null);
    });

    it('is not stopped by another subject of an installed language', () => {
        // One language's word for a song is another's word for a thing.
        expect(readScreenAsk('songx transition off', 'presenter')).toBe(
            'transition',
        );
    });

    it('is still read by every installed language', () => {
        expect(readScreenAsk('flazz now', 'presenter')).toBe('transition');
        expect(readScreenAsk('lokx skreen 2', 'presenter')).toBe('lock');
    });
});

describe('readScreenAsk, a line taken for a language', () => {
    it('is stopped by its own how-to and subjects', () => {
        state.typedCode = 'xx';
        expect(readScreenAsk('quomx flazz', 'presenter')).toBe(null);
        expect(readScreenAsk('songx flazz', 'presenter')).toBe(null);
        expect(readScreenAsk('flazz now', 'presenter')).toBe('transition');
    });

    // The language a line is taken for can be the wrong one: a how-to
    // taken for English, or for a neighbour, names the transition by a
    // word that reads alone.
    it('is stopped by any installed language’s how-to', () => {
        state.typedCode = 'xx';
        expect(readScreenAsk('plimx the stepx flazz', 'presenter')).toBe(null);
        state.typedCode = 'en';
        expect(readScreenAsk('zeddo transition off', 'presenter')).toBe(
            'transition',
        );
        expect(readScreenAsk('quomx transition off', 'presenter')).toBe(null);
    });

    it('is not stopped by a neighbour’s other subject', () => {
        state.typedCode = 'yy';
        expect(readScreenAsk('songx lokx skreen 2', 'presenter')).toBe('lock');
    });
});
