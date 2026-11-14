// @vitest-environment jsdom
// The Bible import's language question, in a window shown in EVERY language
// whose package is in the checkout -- one rule, every language the same way
// (2026-11-09, the user: _all languages development, except english, should
// be treated the same way_). Until then its buttons were three languages
// named in code whatever was installed. Seen live in English, Khmer and
// Haitian Creole windows; this holds the same rule for all of them, and
// holds with no package at all.
//
// A window is shown in a language the way boot does it: `<html lang>` set to
// that package's own `meta.json` locale (`nb-NO`, `fil-PH`, `zh-CN` ...).
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import {
    listLanguageChoiceNames,
    tranBibleImportLabel,
} from '../../../../chatbot/bibleImportChatHelpers';
import {
    DEFAULT_CHAT_LANG_CODE,
    getAppLangCode,
    getAssistantLanguage,
    listAssistantLanguages,
    listTypedLanguages,
} from '../../../../chatbot/chatLangHelpers';
import {
    listLangPackageCodes,
    toLangPackageDir,
} from '../../../../test-setup/langPackageDirs';

const PACKAGE_LIST = listLangPackageCodes({ isEnglishIncluded: false }).map(
    (folderCode) => {
        const { locale } = JSON.parse(
            readFileSync(
                path.join(toLangPackageDir(folderCode), 'meta.json'),
                'utf8',
            ),
        );
        return [folderCode, String(locale)] as const;
    },
);

// How many buttons a window offers: its own language, English and the other
// installed ones, four at most.
const INSTALLED_COUNT = new Set(
    [...listAssistantLanguages(), ...listTypedLanguages()]
        .filter((language) => {
            return language.name.length > 0;
        })
        .map((language) => {
            return language.code;
        }),
).size;
const BUTTON_COUNT = Math.min(
    4,
    INSTALLED_COUNT + (INSTALLED_COUNT > 0 ? 0 : 1),
);

function showWindowIn(locale: string) {
    document.documentElement.lang = locale;
}

afterEach(() => {
    showWindowIn('');
});

describe('the Bible import language buttons, in every window language', () => {
    test('in an English window: English first', () => {
        showWindowIn('en-US');
        const names = listLanguageChoiceNames();
        expect(names[0]).toBe('English');
        expect(names).toHaveLength(BUTTON_COUNT);
    });

    test.each(PACKAGE_LIST)(
        'a window in %s (%s): its own language first, in its own words, then English',
        (_folderCode, locale) => {
            showWindowIn(locale);
            const appCode = getAppLangCode();
            // Every package can be the window's language.
            expect(appCode).not.toBe(DEFAULT_CHAT_LANG_CODE);
            const language = getAssistantLanguage(appCode);
            const names = listLanguageChoiceNames();
            expect(names[0]).toBe(language.name);
            expect(names[1]).toBe('English');
            expect(names).toHaveLength(BUTTON_COUNT);
            expect(new Set(names).size).toBe(names.length);
            expect(tranBibleImportLabel(names[0])).toBe(
                language.nativeName.length > 0
                    ? language.nativeName
                    : language.name,
            );
        },
    );
});
