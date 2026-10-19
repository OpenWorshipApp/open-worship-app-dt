import { setChatTranslator } from './chatTranHelpers';
import {
    DEFAULT_LANG_CODE,
    getCurrentLocale,
    getLangData,
    tranByLangData,
} from '../lang/langHelpers';
import appProvider from '../server/appProvider';
import { getAssistantLanguage } from './chatLangHelpers';

// The CSS variable `chatWindowShared.scss` puts in every font stack of the
// two AI windows, ahead of the system faces: a language whose letters the
// signage and system faces lack (Khmer) is drawn in the face its pack ships,
// the one the rest of the app draws it in, and Latin keeps the window's own.
export const CHAT_LANG_FONT_VARIABLE = '--chat-lang-font';

/**
 * The language's own face as the AI Chat window hands it to a site: its
 * name, the pack's @font-face sheet (for the files) and the script pattern
 * (for the letters it is for). Null for a language with no face of its own.
 */
export function readChatWindowLanguageFont() {
    const langData = getLangData(getCurrentLocale());
    if (
        langData === null ||
        langData.fontFamily === undefined ||
        langData.fontFamily === ''
    ) {
        return null;
    }
    return {
        family: langData.fontFamily,
        css: langData.genCss(),
        scriptPatternSource: getAssistantLanguage(langData.langCode)
            .scriptPattern.source,
    };
}

/**
 * The window's words and lettering in the language it was LOADED in, for
 * the help window and the AI Chat window alike. Called from `init`'s
 * callback, once the language has loaded.
 *
 * Not the app's `tran()`, which reads the setting on every call: a language
 * clicked in Settings changes the setting before Apply reloads the windows,
 * and this window would then ask for a dictionary it never loaded -- and
 * throw. A key the dictionary lacks still throws in dev, like `tran()`.
 */
export function plugChatWindowLanguage() {
    const locale = getCurrentLocale();
    const langData = getLangData(locale);
    setChatTranslator(
        (text) => {
            if (langData === null || langData.langCode === DEFAULT_LANG_CODE) {
                return text;
            }
            const value = langData.dictionary[langData.sanitizeTranKey(text)];
            if (value !== undefined) {
                return value;
            }
            if (appProvider.systemUtils.isDev) {
                throw new Error(
                    `Translation for text "${text}" not found in locale ` +
                        `${locale}.`,
                );
            }
            return text;
        },
        (text) => {
            return tranByLangData(langData, text);
        },
    );
    const fontFamily = langData?.fontFamily;
    if (fontFamily !== undefined && fontFamily !== '') {
        document.documentElement.style.setProperty(
            CHAT_LANG_FONT_VARIABLE,
            fontFamily,
        );
    }
}
