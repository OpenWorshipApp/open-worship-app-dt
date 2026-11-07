// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The two AI windows' words and lettering, plugged in once the language has
// loaded. The language pack, the setting store's font and the dev flag are
// stood in for; the chatbot's own translator is the real one, so what the
// windows will say is read back through it.
const { langState, appProviderMock, fontState } = vi.hoisted(() => ({
    langState: {
        locale: 'km-KH',
        langData: null as any,
    },
    appProviderMock: { systemUtils: { isDev: false } },
    fontState: {
        fontFamily: null as string | null,
        isThrowing: false,
    },
}));

vi.mock('../../../../../langHelpers', () => ({
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
vi.mock('../../../../../../server/appProvider', () => ({
    default: appProviderMock,
}));
vi.mock('../../../../../../setting/appFontSettingHelpers', () => ({
    getAppFontFamily: async () => {
        if (fontState.isThrowing) {
            throw new Error('font scan failed');
        }
        return fontState.fontFamily;
    },
}));

import {
    setChatTranslator,
    tran,
    tranLabel,
} from '../../../../../../chatbot/chatTranHelpers';
import {
    CHAT_APP_FONT_VARIABLE,
    CHAT_LANG_FONT_VARIABLE,
    plugChatWindowLanguage,
    readChatWindowLanguageFont,
} from '../../../../../../chatbot/chatWindowLanguage';

function genKhmerData(fontFamily = 'Battambang') {
    return {
        langCode: 'km',
        fontFamily,
        dictionary: { Send: 'ផ្ញើ', Stop: 'ឈប់' },
        sanitizeTranKey: (text: string) => {
            return text.trim();
        },
        genCss: () => {
            return '@font-face { font-family: Battambang; }';
        },
    };
}

function readRootProperty(name: string) {
    return document.documentElement.style.getPropertyValue(name);
}

beforeEach(() => {
    langState.locale = 'km-KH';
    langState.langData = genKhmerData();
    appProviderMock.systemUtils.isDev = false;
    fontState.fontFamily = null;
    fontState.isThrowing = false;
    document.documentElement.style.removeProperty(CHAT_APP_FONT_VARIABLE);
    document.documentElement.style.removeProperty(CHAT_LANG_FONT_VARIABLE);
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

describe('the language’s own face', () => {
    test('is handed over with its sheet and the letters it is for', () => {
        const font = readChatWindowLanguageFont();
        expect(font).toEqual({
            family: 'Battambang',
            css: '@font-face { font-family: Battambang; }',
            scriptPatternSource: expect.any(String),
        });
        expect(new RegExp(font!.scriptPatternSource, 'u').test('ផ្ញើ')).toBe(
            true,
        );
        expect(new RegExp(font!.scriptPatternSource, 'u').test('Send')).toBe(
            false,
        );
    });

    test('a language with no face of its own, or no pack, has none', () => {
        langState.langData = genKhmerData('');
        expect(readChatWindowLanguageFont()).toBeNull();
        langState.langData = { ...genKhmerData(), fontFamily: undefined };
        expect(readChatWindowLanguageFont()).toBeNull();
        langState.langData = null;
        expect(readChatWindowLanguageFont()).toBeNull();
    });
});

describe('plugChatWindowLanguage', () => {
    test('the window speaks the language it was loaded in, in its face', () => {
        plugChatWindowLanguage();
        expect(tran('Send')).toBe('ផ្ញើ');
        expect(tran('  Stop ')).toBe('ឈប់');
        // A label is translated leniently, through the pack's own reading.
        expect(tranLabel('Stop')).toBe('ឈប់');
        expect(tranLabel('Unknown label')).toBe('Unknown label (as is)');
        expect(readRootProperty(CHAT_LANG_FONT_VARIABLE)).toBe('Battambang');
    });

    test('English, or no pack at all, is said as written and draws no face', () => {
        langState.locale = 'en-US';
        langState.langData = {
            ...genKhmerData(),
            langCode: 'en',
            fontFamily: '',
        };
        appProviderMock.systemUtils.isDev = true;
        plugChatWindowLanguage();
        expect(tran('Never translated')).toBe('Never translated');
        expect(readRootProperty(CHAT_LANG_FONT_VARIABLE)).toBe('');

        langState.langData = null;
        plugChatWindowLanguage();
        expect(tran('Send')).toBe('Send');
    });
});
