// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        locale: 'en-US',
        isDev: true,
        langDataMap: {} as Record<string, any>,
    },
    mocks: {
        getAppFontFamily: vi.fn(),
    },
}));

// The real `langHelpers` -- its `tranByLangData` is the lenient translator
// this window plugs in -- with only the two reads of the loaded language
// pointed at the packs each test hands it.
vi.mock('../lang/langHelpers', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        getCurrentLocale: () => state.locale,
        getLangData: (locale: string) => state.langDataMap[locale] ?? null,
    };
});
vi.mock('../server/appProvider', () => ({
    default: {
        isPageScreen: false,
        isPageReader: false,
        systemUtils: {
            get isDev() {
                return state.isDev;
            },
        },
        messageUtils: { sendData: () => {}, listenForData: () => {} },
        appInfo: { version: '1.0.0' },
        pathUtils: { sep: '/', join: (...parts: string[]) => parts.join('/') },
        fileUtils: { watch: () => {} },
    },
}));
// Pulled in by the real `langHelpers` through `SettingManager`; nothing here
// reads a setting.
vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        defaultStorageDirPath: '/data',
        localStorageDir: '/data/local-storage',
        getItem: () => null,
        setItem: () => {},
    },
}));
vi.mock('../setting/appFontSettingHelpers', () => ({
    getAppFontFamily: mocks.getAppFontFamily,
}));

import {
    CHAT_APP_FONT_VARIABLE,
    CHAT_LANG_FONT_VARIABLE,
    plugChatWindowAppFont,
    plugChatWindowLanguage,
    readChatWindowAppFontFamily,
    readChatWindowLanguageFont,
} from './chatWindowLanguage';
import { setChatTranslator, tran, tranLabel } from './chatTranHelpers';

// Language packs that stand for any, as the window holds one once `init`
// has loaded it: their words are placeholders, so these tests name no
// language (a real pack's own dictionary is read by its package's tests,
// `src/lang/data/online/<code>/tests/chatbot/chatWindowLanguage*.test.ts`), keyed
// the way every pack sanitises its keys.
function genLangData(
    langCode: string,
    locale: string,
    extra: Record<string, unknown> = {},
) {
    return {
        langCode,
        locale,
        dictionary: {
            send: `Send (${langCode})`,
            'new chat': `New chat (${langCode})`,
        },
        sanitizeTranKey: (key: string) => key.trim().toLowerCase(),
        genCss: () => `@font-face { font-family: ${langCode}-face; }`,
        ...extra,
    };
}

const firstLangData = genLangData('xx', 'xx-XX');
const secondLangData = genLangData('yy', 'yy-YY');
const englishLangData = {
    langCode: 'en',
    locale: 'en-US',
    dictionary: {},
    sanitizeTranKey: (key: string) => key.trim().toLowerCase(),
    genCss: () => '',
};

function readRootVariable(name: string) {
    return document.documentElement.style.getPropertyValue(name);
}

beforeEach(() => {
    state.locale = 'en-US';
    state.isDev = true;
    state.langDataMap = {
        'xx-XX': firstLangData,
        'yy-YY': secondLangData,
        'en-US': englishLangData,
    };
});

afterEach(() => {
    setChatTranslator(
        (text) => text,
        (text) => text,
    );
    document.documentElement.style.removeProperty(CHAT_LANG_FONT_VARIABLE);
    document.documentElement.style.removeProperty(CHAT_APP_FONT_VARIABLE);
});

describe('the window’s words in the language it was loaded in', () => {
    test('a key the dictionary lacks THROWS in dev, naming it and the locale', () => {
        state.locale = 'xx-XX';
        plugChatWindowLanguage();
        expect(tran('  send ')).toBe('Send (xx)');
        expect(() => tran('Words no dictionary has')).toThrow(
            'Translation for text "Words no dictionary has" not found in ' +
                'locale xx-XX.',
        );
        // A label that may or may not be one never throws: its own words.
        expect(tranLabel('Words no dictionary has')).toBe(
            'Words no dictionary has',
        );
    });

    test('a packaged window shows the English words instead of throwing', () => {
        state.locale = 'xx-XX';
        state.isDev = false;
        plugChatWindowLanguage();
        expect(tran('Words no dictionary has')).toBe('Words no dictionary has');
    });

    test('pinned to the language it was LOADED in, not the setting now', () => {
        state.locale = 'xx-XX';
        plugChatWindowLanguage();
        // A language clicked in Settings before Apply changes the setting;
        // this window keeps asking the dictionary it loaded.
        state.locale = 'yy-YY';
        expect(tran('Send')).toBe('Send (xx)');
        expect(tranLabel('New chat')).toBe('New chat (xx)');
    });

    test('English, and a language never loaded, pass the words through', () => {
        state.locale = 'en-US';
        plugChatWindowLanguage();
        expect(tran('Words no dictionary has')).toBe('Words no dictionary has');
        expect(tranLabel('Send')).toBe('Send');
        state.locale = 'xx-XX';
        state.langDataMap = {};
        plugChatWindowLanguage();
        expect(tran('Words no dictionary has')).toBe('Words no dictionary has');
        expect(tranLabel('Send')).toBe('Send');
        expect(readRootVariable(CHAT_LANG_FONT_VARIABLE)).toBe('');
    });
});

describe('the language’s own face, as the AI Chat window hands it to a site', () => {
    test('none for a language without a face, an empty one, or none loaded', () => {
        state.locale = 'xx-XX';
        expect(readChatWindowLanguageFont()).toBeNull();
        state.langDataMap['xx-XX'] = { ...firstLangData, fontFamily: '' };
        expect(readChatWindowLanguageFont()).toBeNull();
        state.locale = 'yy-YY';
        state.langDataMap = {};
        expect(readChatWindowLanguageFont()).toBeNull();
    });
});

describe('the face picked in Settings → General → Font Family', () => {
    test('heads every stack, quoted, with nothing that breaks out of CSS', async () => {
        mocks.getAppFontFamily.mockResolvedValue('Noto Sans"; color: red');
        await plugChatWindowAppFont();
        expect(readRootVariable(CHAT_APP_FONT_VARIABLE)).toBe(
            "'Noto Sans color: red'",
        );
    });

    test('nothing picked leaves the window’s own faces alone', async () => {
        mocks.getAppFontFamily.mockResolvedValue(null);
        await plugChatWindowAppFont();
        expect(readRootVariable(CHAT_APP_FONT_VARIABLE)).toBe('');
    });

    test('a font scan that fails is no face, never a broken window', async () => {
        mocks.getAppFontFamily.mockRejectedValue(new Error('scan failed'));
        await expect(readChatWindowAppFontFamily()).resolves.toBeNull();
        await plugChatWindowAppFont();
        expect(readRootVariable(CHAT_APP_FONT_VARIABLE)).toBe('');
        mocks.getAppFontFamily.mockResolvedValue('Noto Serif');
        await expect(readChatWindowAppFontFamily()).resolves.toBe('Noto Serif');
    });
});
