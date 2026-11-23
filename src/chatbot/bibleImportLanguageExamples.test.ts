import { beforeEach, describe, expect, test, vi } from 'vitest';

// The installed languages, as the two lists hand them out; invented names,
// so no language is named here.
const { state } = vi.hoisted(() => ({
    state: { languages: [] as any[] },
}));

vi.mock('../helper/loggerHelpers', () => {
    return { appError: vi.fn() };
});
vi.mock('./mcpClient', () => {
    return { callTool: vi.fn(), parseToolJson: JSON.parse };
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
vi.mock('./chatLangHelpers', async (importOriginal) => {
    const original = await importOriginal<any>();
    return {
        ...original,
        listAssistantLanguages: () => state.languages,
        listTypedLanguages: () => [],
    };
});

import { genLanguageExampleWords } from './bibleImportChatHelpers';

function language(name: string, nativeName: string, isLatinScript: boolean) {
    return { code: name.toLowerCase(), name, nativeName, isLatinScript };
}

beforeEach(() => {
    state.languages = [];
});

describe('genLanguageExampleWords (F-30)', () => {
    test('English alone: three different English names, none of them Thai', () => {
        expect(genLanguageExampleWords()).toEqual({
            name: 'Spanish',
            nativeName: 'French',
            otherNativeName: 'German',
        });
    });

    test('one language installed: its own name, then an English stand-in', () => {
        state.languages = [language('Zedish', 'Zedtongue', false)];
        expect(genLanguageExampleWords()).toEqual({
            name: 'Zedish',
            nativeName: 'Zedtongue',
            otherNativeName: 'Spanish',
        });
    });

    test('two installed: a non-Latin one first, a Latin one beside it', () => {
        state.languages = [
            language('Latish', 'Latword', true),
            language('Zedish', 'Zedtongue', false),
        ];
        expect(genLanguageExampleWords()).toEqual({
            name: 'Zedish',
            nativeName: 'Zedtongue',
            otherNativeName: 'Latword',
        });
    });

    test('a language named Thai is not used, the sentences already say it', () => {
        state.languages = [language('Thai', 'Thaiword', false)];
        expect(genLanguageExampleWords().name).toBe('Spanish');
    });
});
