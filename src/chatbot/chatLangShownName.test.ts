// @vitest-environment jsdom
// A language's name as the help window shows it -- every language but
// English the same way (2026-11-09, the user: _all languages development,
// except english, should be treated the same way_). Loops over whatever
// packages the checkout has, so it holds with none of them too.
import { afterEach, describe, expect, test } from 'vitest';

import {
    DEFAULT_CHAT_LANG_CODE,
    getAppLangCode,
    listAssistantLanguages,
    listTypedLanguages,
    toShownLanguageName,
} from './chatLangHelpers';

const OTHER_LANGUAGE_LIST = [
    ...listAssistantLanguages(),
    ...listTypedLanguages(),
].filter((language) => {
    return (
        language.code !== DEFAULT_CHAT_LANG_CODE &&
        language.nativeName.length > 0
    );
});

function setWindowLanguage(code: string) {
    document.documentElement.lang = code;
}

afterEach(() => {
    setWindowLanguage('');
});

describe('toShownLanguageName', () => {
    test('English keeps its own name in an English window', () => {
        setWindowLanguage(DEFAULT_CHAT_LANG_CODE);
        expect(toShownLanguageName(DEFAULT_CHAT_LANG_CODE, 'English')).toBe(
            'English',
        );
    });

    test('in an English window any other language is its English name', () => {
        setWindowLanguage(DEFAULT_CHAT_LANG_CODE);
        expect(toShownLanguageName('xx', 'Xxlang')).toBe('Xxlang');
        for (const language of OTHER_LANGUAGE_LIST) {
            expect(toShownLanguageName(language.code, language.name)).toBe(
                language.name,
            );
        }
    });

    test('the window language is drawn in its own words, every one alike', () => {
        let checked = 0;
        for (const language of OTHER_LANGUAGE_LIST) {
            setWindowLanguage(language.code);
            if (getAppLangCode() !== language.code) {
                continue;
            }
            checked += 1;
            expect(toShownLanguageName(language.code, language.name)).toBe(
                language.nativeName,
            );
        }
        expect(checked > 0).toBe(OTHER_LANGUAGE_LIST.length > 0);
    });

    test('another language in a non-English window: the locale names it, or English does', () => {
        const [windowLanguage] = OTHER_LANGUAGE_LIST.filter((language) => {
            setWindowLanguage(language.code);
            return getAppLangCode() === language.code;
        });
        if (windowLanguage === undefined) {
            return;
        }
        setWindowLanguage(windowLanguage.code);
        const shown = toShownLanguageName('xx', 'Xxlang');
        // `xx` is a code no locale names: the English name stands.
        expect(shown).toBe('Xxlang');
        const named = new Intl.DisplayNames([windowLanguage.code], {
            type: 'language',
        }).of('de');
        expect(toShownLanguageName('de', 'German')).toBe(
            named !== undefined && named !== 'de' ? named : 'German',
        );
    });
});
