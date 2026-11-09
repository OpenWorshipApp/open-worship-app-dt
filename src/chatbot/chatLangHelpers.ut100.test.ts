import { afterEach, describe, expect, test, vi } from 'vitest';

// The help window's languages read from language files this file makes up
// (codes `xx`, `yy`, `zz`, `ww`, `vv`, `uu`; ASCII data): a pattern a file
// got wrong is left out and the rest kept, a look-alike that is no pair is
// dropped, and a package whose folder its own `typed.json` does not name is
// answered as the first of its rows by `order`. The installed files are this
// file's own fake store.
vi.mock('../lang/langFileStore', () => {
    const fileMap: Record<string, { langCode: string; file: unknown }[]> = {
        'assistant.json': [
            {
                langCode: 'en',
                file: {
                    name: 'English',
                    nativeName: 'English',
                    scriptPattern: '[A-Za-z]',
                },
            },
            {
                langCode: 'xx',
                file: {
                    name: 'Xxish',
                    nativeName: 'Xxish',
                    scriptPattern: '[A-Za-z]',
                    // The first does not compile.
                    verseAsks: ['(?<words>unclosed', '^seek (?<words>.+)$'],
                    langInstallAsks: ['[', '^fetch (?<language>.+)$'],
                    lookAlikes: [['ab', 'cd'], ['e'], ['f', 'gh'], ['i', 'i']],
                },
            },
        ],
        'typed.json': [
            {
                // A folder named by none of its rows: the first by order.
                langCode: 'yy',
                file: {
                    zz: {
                        name: 'Zzish',
                        nativeName: 'Zzish',
                        script: 'Latin',
                        words: 'zo za',
                        order: 5,
                    },
                    vv: {
                        name: 'Vvish',
                        nativeName: 'Vvish',
                        script: 'Latin',
                        words: 'vo va',
                    },
                    ww: {
                        name: 'Wwish',
                        nativeName: 'Wwish',
                        script: 'Latin',
                        words: 'wo wa',
                        order: 2,
                    },
                },
            },
            {
                // A folder that names itself keeps its own code.
                langCode: 'uu',
                file: {
                    tt: {
                        name: 'Ttish',
                        nativeName: 'Ttish',
                        script: 'Latin',
                        order: 1,
                    },
                    uu: {
                        name: 'Uuish',
                        nativeName: 'Uuish',
                        script: 'Latin',
                        order: 9,
                    },
                },
            },
        ],
    };
    return {
        listLangFiles: (fileName: string) => fileMap[fileName] ?? [],
    };
});

import {
    checkHasLanguageWord,
    getAppLangCode,
    getAssistantLanguage,
    listLookAlikePairs,
} from './chatLangHelpers';

afterEach(() => {
    vi.unstubAllGlobals();
});

function stubHtmlLang(lang: string) {
    vi.stubGlobal('document', { documentElement: { lang } });
}

describe('a language file read at load', () => {
    test('a pattern it got wrong is left out, the rest of its list kept', () => {
        const language = getAssistantLanguage('xx');
        expect(language.code).toBe('xx');
        expect(
            language.verseAskPatterns.map((pattern) => {
                return pattern.source;
            }),
        ).toEqual(['^seek (?<words>.+)$']);
        expect(
            language.langInstallAskPatterns.map((pattern) => {
                return pattern.source;
            }),
        ).toEqual(['^fetch (?<language>.+)$']);
    });

    test('only two different letters of one length are a look-alike pair', () => {
        expect(listLookAlikePairs()).toEqual([['ab', 'cd']]);
    });
});

describe('a window shown in a language with no assistant file', () => {
    test('is the first of the rows of its folder by order when the folder names none', () => {
        stubHtmlLang('yy-YY');
        expect(getAppLangCode()).toBe('ww');
    });

    test('is its own row when the folder names itself, whatever the order', () => {
        stubHtmlLang('uu');
        expect(getAppLangCode()).toBe('uu');
    });
});

describe('checkHasLanguageWord', () => {
    test('an empty word in a list is no word, never a match everywhere', () => {
        const english = getAssistantLanguage('en');
        expect(checkHasLanguageWord('a plain line', english, [''])).toBe(false);
        expect(
            checkHasLanguageWord('a plain line', english, ['', 'plain']),
        ).toBe(true);
    });
});
