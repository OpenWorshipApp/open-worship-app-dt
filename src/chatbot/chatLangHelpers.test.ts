import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, test, vi } from 'vitest';

import {
    listLangPackageCodes,
    toLangPackageDir,
} from '../test-setup/langPackageDirs';

import {
    DEFAULT_CHAT_LANG_CODE,
    detectTypedLanguage,
    getAppLangCode,
    getAssistantLanguage,
    listAssistantLanguages,
    pickReplyLanguage,
} from './chatLangHelpers';

afterEach(() => {
    vi.unstubAllGlobals();
});

// The language packages, found by their folders: every one with an
// `assistant.json` is a language the help window speaks.
const PACKAGE_CODE_LIST = listLangPackageCodes({
    fileName: 'assistant.json',
});

function stubHtmlLang(lang: string) {
    vi.stubGlobal('document', { documentElement: { lang } });
}

describe('the languages are the files beside the language packages', () => {
    test('every package with an assistant.json is a language here', () => {
        const codeList = listAssistantLanguages().map((language) => {
            return language.code;
        });
        expect([...codeList].sort()).toEqual([...PACKAGE_CODE_LIST].sort());
        expect(codeList).toContain(DEFAULT_CHAT_LANG_CODE);
    });

    test('a code nothing claims is English', () => {
        expect(getAssistantLanguage('xx').code).toBe(DEFAULT_CHAT_LANG_CODE);
    });
});

describe('getAppLangCode', () => {
    test('a node test with no document is English', () => {
        expect(getAppLangCode()).toBe('en');
    });

    test('reads the language the window was loaded in', () => {
        for (const code of PACKAGE_CODE_LIST) {
            stubHtmlLang(code);
            expect(getAppLangCode()).toBe(code);
            stubHtmlLang(`${code}-XX`);
            expect(getAppLangCode()).toBe(code);
        }
    });

    test('a language with no package here is English', () => {
        stubHtmlLang('xx');
        expect(getAppLangCode()).toBe('en');
        stubHtmlLang('xx-YY');
        expect(getAppLangCode()).toBe('en');
    });

    // 2026-11-05, the robot run over every app language: a window shown in a
    // language with a dictionary and a `typed.json` but no `assistant.json`
    // answered every pressed question in English.
    test('a language installed with only its typed.json is the app language', () => {
        // Packages only: a data-only folder (a typed.json and no dictionary)
        // is never installed, so its code stays English.
        const packageCodeList = listLangPackageCodes();
        const typedOnlyCodeList = listLangPackageCodes({
            fileName: 'typed.json',
        }).filter((code) => {
            return (
                packageCodeList.includes(code) &&
                !PACKAGE_CODE_LIST.includes(code)
            );
        });
        for (const code of typedOnlyCodeList) {
            const typed = JSON.parse(
                fs.readFileSync(
                    path.join(toLangPackageDir(code), 'typed.json'),
                    'utf8',
                ),
            ) as Record<string, unknown>;
            stubHtmlLang(`${code}-XX`);
            const appLangCode = getAppLangCode();
            // The code its own typed.json names it by (a folder may name
            // its language by another code).
            expect(Object.keys(typed)).toContain(appLangCode);
            expect(getAssistantLanguage(appLangCode).code).toBe(appLangCode);
            expect(pickReplyLanguage('', { isPressed: true })).toBe(
                appLangCode,
            );
        }
    });
});

describe('detectTypedLanguage', () => {
    test('words too few to say are no language at all', () => {
        expect(detectTypedLanguage('yes')).toBeNull();
        expect(detectTypedLanguage('ok thanks')).toBeNull();
        expect(detectTypedLanguage('John 3:16')).toBeNull();
        expect(detectTypedLanguage('F5')).toBeNull();
        expect(detectTypedLanguage('https://example.com/song')).toBeNull();
    });
});

describe('pickReplyLanguage', () => {
    // The people this is for read the language their app is in; a doubt
    // always goes that way.
    test('a short reply keeps the app language', () => {
        expect(pickReplyLanguage('ok', { appLangCode: 'xx' })).toBe('xx');
        expect(pickReplyLanguage('yes', { appLangCode: 'xx' })).toBe('xx');
    });

    test('a pressed chip is the app’s words, not theirs', () => {
        expect(
            pickReplyLanguage('How do I present a Bible verse?', {
                appLangCode: 'xx',
                isPressed: true,
            }),
        ).toBe('xx');
    });
});
