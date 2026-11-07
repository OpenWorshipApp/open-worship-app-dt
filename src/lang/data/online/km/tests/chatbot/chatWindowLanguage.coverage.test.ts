// @vitest-environment jsdom

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { readSourceDictionary } from '../../../../../../../tools/owa-devtools-mcp/langPacks.mjs';

// The help window's words in Khmer through the REAL `langHelpers` -- its
// `tranByLangData` is the lenient translator this window plugs in -- with
// only the two reads of the loaded language pointed at this package's own
// dictionary. Moved out of `src/chatbot/chatWindowLanguage.ut99.test.ts`
// (it reads this package); `chatWindowLanguage.test.ts` beside it stands
// the whole `langHelpers` in.
const { state } = vi.hoisted(() => ({
    state: {
        locale: 'en-US',
        langDataMap: {} as Record<string, any>,
    },
}));

vi.mock('../../../../../langHelpers', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        getCurrentLocale: () => state.locale,
        getLangData: (locale: string) => state.langDataMap[locale] ?? null,
    };
});
vi.mock('../../../../../../server/appProvider', () => ({
    default: {
        isPageScreen: false,
        isPageReader: false,
        systemUtils: { isDev: true },
        messageUtils: { sendData: () => {}, listenForData: () => {} },
        appInfo: { version: '1.0.0' },
        pathUtils: { sep: '/', join: (...parts: string[]) => parts.join('/') },
        fileUtils: { watch: () => {} },
    },
}));
// Pulled in by the real `langHelpers` through `SettingManager`; nothing here
// reads a setting.
vi.mock('../../../../../../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        defaultStorageDirPath: '/data',
        localStorageDir: '/data/local-storage',
        getItem: () => null,
        setItem: () => {},
    },
}));
vi.mock('../../../../../../setting/appFontSettingHelpers', () => ({
    getAppFontFamily: async () => null,
}));

import {
    CHAT_LANG_FONT_VARIABLE,
    plugChatWindowLanguage,
} from '../../../../../../chatbot/chatWindowLanguage';
import {
    setChatTranslator,
    tran,
    tranLabel,
} from '../../../../../../chatbot/chatTranHelpers';

// This package's REAL dictionary, its `dictionary.json` (as
// `chatTranLabels.test.ts` reads it, so its fonts and editor plugins are not
// loaded for a test of words), sanitised the way every pack sanitises its
// keys.
const PACKAGE_DIR = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
);
const khmerLangData = {
    langCode: 'km',
    locale: 'km-KH',
    dictionary: readSourceDictionary(PACKAGE_DIR),
    sanitizeTranKey: (key: string) => key.trim().toLowerCase(),
    genCss: () => '@font-face { font-family: km-face; }',
    fontFamily: 'app-Battambang',
};

beforeEach(() => {
    state.locale = 'km-KH';
    state.langDataMap = { 'km-KH': khmerLangData };
});

afterEach(() => {
    setChatTranslator(
        (text) => text,
        (text) => text,
    );
    document.documentElement.style.removeProperty(CHAT_LANG_FONT_VARIABLE);
});

describe('the window’s words in Khmer', () => {
    test('the real dictionary, and its face on <html>', () => {
        plugChatWindowLanguage();
        expect(tran('Send')).toBe('ផ្ញើ');
        expect(tran('New chat')).toBe('ការសន្ទនាថ្មី');
        // Matched the way the pack sanitises a key.
        expect(tran('  send ')).toBe('ផ្ញើ');
        expect(tranLabel('New chat')).toBe('ការសន្ទនាថ្មី');
        expect(
            document.documentElement.style.getPropertyValue(
                CHAT_LANG_FONT_VARIABLE,
            ),
        ).toBe('app-Battambang');
    });
});
