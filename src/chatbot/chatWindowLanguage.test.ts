// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The two AI windows' words and lettering, plugged in once the language has
// loaded. The language pack, the setting store's font and the dev flag are
// stood in for; the chatbot's own translator is the real one, so what the
// windows will say is read back through it.
const { langState, appProviderMock, fontState } = vi.hoisted(() => ({
    langState: {
        locale: 'xx-XX',
        langData: null as any,
    },
    appProviderMock: { systemUtils: { isDev: false } },
    fontState: {
        fontFamily: null as string | null,
        isThrowing: false,
    },
}));

vi.mock('../lang/langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    getCurrentLocale: () => langState.locale,
    getLangData: (locale: string) => {
        return locale === langState.locale ? langState.langData : null;
    },
    tranByLangData: (langData: any, text: string) => {
        return langData?.dictionary?.[text] ?? `${text} (as is)`;
    },
    // As the real one: only what the dictionary itself holds.
    readTranValue: (langData: any, text: string) => {
        const key = langData.sanitizeTranKey(text);
        return Object.hasOwn(langData.dictionary, key)
            ? langData.dictionary[key]
            : undefined;
    },
}));
vi.mock('../server/appProvider', () => ({ default: appProviderMock }));
vi.mock('../setting/appFontSettingHelpers', () => ({
    getAppFontFamily: async () => {
        if (fontState.isThrowing) {
            throw new Error('font scan failed');
        }
        return fontState.fontFamily;
    },
}));

import { setChatTranslator, tran } from './chatTranHelpers';
import {
    CHAT_APP_FONT_VARIABLE,
    plugChatWindowAppFont,
    plugChatWindowLanguage,
    readChatWindowAppFontFamily,
} from './chatWindowLanguage';

// A language pack that stands for any: its words are placeholders, so these
// tests name no language (a real pack's own are its package's tests).
function genLangData() {
    return {
        langCode: 'xx',
        fontFamily: 'Placeholder Face',
        dictionary: { Send: 'Send (xx)' },
        sanitizeTranKey: (text: string) => {
            return text.trim();
        },
        genCss: () => {
            return '@font-face { font-family: Placeholder Face; }';
        },
    };
}

function readRootProperty(name: string) {
    return document.documentElement.style.getPropertyValue(name);
}

beforeEach(() => {
    langState.locale = 'xx-XX';
    langState.langData = genLangData();
    appProviderMock.systemUtils.isDev = false;
    fontState.fontFamily = null;
    fontState.isThrowing = false;
    document.documentElement.style.removeProperty(CHAT_APP_FONT_VARIABLE);
});
afterEach(() => {
    // The translator is module state: the next test starts from none.
    setChatTranslator(
        (text) => {
            return text;
        },
        (text) => {
            return text;
        },
    );
});

describe('the face picked in Settings', () => {
    test('is read, and a scan that fails is no face at all', async () => {
        fontState.fontFamily = 'Noto Serif';
        expect(await readChatWindowAppFontFamily()).toBe('Noto Serif');
        fontState.isThrowing = true;
        expect(await readChatWindowAppFontFamily()).toBeNull();
    });

    test('heads the window’s stacks, quoted and with nothing to break out', async () => {
        fontState.fontFamily = "Evil'; } body { color: red";
        await plugChatWindowAppFont();
        expect(readRootProperty(CHAT_APP_FONT_VARIABLE)).toBe(
            "'Evil  body  color: red'",
        );
    });

    test('with no face picked the stacks are left as they are', async () => {
        await plugChatWindowAppFont();
        expect(readRootProperty(CHAT_APP_FONT_VARIABLE)).toBe('');
    });
});

describe('plugChatWindowLanguage', () => {
    test('a missing word throws in development and stays English otherwise', () => {
        plugChatWindowLanguage();
        expect(tran('Never translated')).toBe('Never translated');
        appProviderMock.systemUtils.isDev = true;
        expect(() => {
            return tran('Never translated');
        }).toThrow(
            'Translation for text "Never translated" not found in locale xx-XX.',
        );
    });
});
