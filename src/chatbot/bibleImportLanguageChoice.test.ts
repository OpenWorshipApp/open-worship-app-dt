import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The languages the Bible import's language question offers, read off what
// is installed: every language found the same way, none named here. The
// installed languages and the app's are this file's own made-up ones.
const state = vi.hoisted(() => {
    return {
        appLangCode: 'en',
        assistantList: [] as {
            code: string;
            name: string;
            nativeName: string;
        }[],
        typedList: [] as { code: string; name: string; nativeName: string }[],
    };
});

vi.mock('../helper/loggerHelpers', () => {
    return { appError: vi.fn() };
});
vi.mock('./mcpClient', () => {
    return {
        callTool: vi.fn(),
        parseToolJson: (text: string) => JSON.parse(text),
    };
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
    return {
        ...(await importOriginal<object>()),
        getAppLangCode: () => state.appLangCode,
        listAssistantLanguages: () => state.assistantList,
        listTypedLanguages: () => state.typedList,
    };
});

import {
    listLanguageChoiceNames,
    tranBibleImportLabel,
} from './bibleImportChatHelpers';
import { setChatTranslator } from './chatTranHelpers';

function genLanguage(code: string, name: string) {
    return { code, name, nativeName: `${name} in its own words` };
}

beforeEach(() => {
    state.appLangCode = 'en';
    state.assistantList = [genLanguage('yy', 'Yish')];
    state.typedList = [
        genLanguage('xx', 'Xish'),
        genLanguage('zz', 'Zish'),
        genLanguage('ww', 'Wish'),
    ];
});

afterEach(() => {
    const identity = (text: string) => {
        return text;
    };
    setChatTranslator(identity, identity);
});

describe('listLanguageChoiceNames', () => {
    it('puts the app language first, English second, then the others, four at most', () => {
        state.appLangCode = 'zz';
        expect(listLanguageChoiceNames()).toEqual([
            'Zish',
            'English',
            'Yish',
            'Xish',
        ]);
    });

    it('in an English app, English then the installed ones in their order', () => {
        expect(listLanguageChoiceNames()).toEqual([
            'English',
            'Yish',
            'Xish',
            'Zish',
        ]);
    });

    it('offers English alone when nothing else is installed', () => {
        state.assistantList = [];
        state.typedList = [];
        expect(listLanguageChoiceNames()).toEqual(['English']);
        // An app language that is not installed adds no button.
        state.appLangCode = 'qq';
        expect(listLanguageChoiceNames()).toEqual(['English']);
    });

    it('names a language once, by its first list, and skips one with no name', () => {
        state.assistantList = [genLanguage('xx', 'Xish')];
        state.typedList = [
            genLanguage('xx', 'Xish typed'),
            genLanguage('vv', ''),
            genLanguage('zz', 'Zish'),
        ];
        expect(listLanguageChoiceNames()).toEqual(['English', 'Xish', 'Zish']);
    });
});

// How a language's name is drawn in a window of another language is
// `toShownLanguageName`'s (`chatLangHelpers.ts`), which reads the window's
// own language; this node test's window is English.
describe('tranBibleImportLabel on a language button', () => {
    it('in an English window, an installed language keeps its English name', () => {
        const translate = (text: string) => {
            return `T(${text})`;
        };
        setChatTranslator(translate, translate);
        expect(tranBibleImportLabel('Xish')).toBe('Xish');
        expect(tranBibleImportLabel('Zish')).toBe('Zish');
    });

    it('leaves a label that names no installed language to the dictionary', () => {
        const translate = (text: string) => {
            return text === 'Cancel' ? 'CANCEL-T' : text;
        };
        setChatTranslator(translate, translate);
        expect(tranBibleImportLabel('Cancel')).toBe('CANCEL-T');
        expect(tranBibleImportLabel('Klingon')).toBe('Klingon');
    });
});
