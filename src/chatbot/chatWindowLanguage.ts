import { setChatTranslator } from './chatTranHelpers';
import {
    DEFAULT_LANG_CODE,
    getCurrentLocale,
    getLangData,
    tranByLangData,
} from '../lang/langHelpers';
import appProvider from '../server/appProvider';
import { getAssistantLanguage } from './chatLangHelpers';
import { sanitizeCssValue } from '../helper/sanitizeHelpers';
import { getAppFontFamily } from '../setting/appFontSettingHelpers';

// The CSS variable `chatWindowShared.scss` puts in every font stack of the
// two AI windows, ahead of the system faces: a language whose letters the
// signage and system faces lack (Khmer) is drawn in the face its pack ships,
// the one the rest of the app draws it in, and Latin keeps the window's own.
export const CHAT_LANG_FONT_VARIABLE = '--chat-lang-font';

// The face the user picked in Settings → General → Font Family, when one is
// picked (`appFontSettingHelpers.ts`). boot.ts's `initFontFamily()` writes it
// as `* { font-family }`, and a universal rule loses to EVERY class stack of
// these windows (reported 2026-10-20: a custom font had no effect on the
// chatbot or AI Chat page, tab titles included) -- so here it heads every
// `--chat-font-*` stack itself as `--chat-app-font`.
export const CHAT_APP_FONT_VARIABLE = '--chat-app-font';

/**
 * The chosen app face read once and handed to BOTH things that ask -- the
 * window's `<html>` (for the stacks) and the caller (the AI Chat window
 * names it in front of a guest site's body list). Never throws: this
 * lettering is a nicety, and a font scan failing must not break a window.
 */
export async function readChatWindowAppFontFamily() {
    try {
        return await getAppFontFamily();
    } catch (_error) {
        return null;
    }
}

/**
 * Settings → General's Font Family onto this window's `<html>`; the stacks
 * in `chatWindowShared.scss` take it from there. Fire-and-forget from the
 * window's entry, as boot.ts's own `initFontFamily()` is.
 */
export async function plugChatWindowAppFont() {
    const fontFamily = await readChatWindowAppFontFamily();
    if (fontFamily === null) {
        return;
    }
    document.documentElement.style.setProperty(
        CHAT_APP_FONT_VARIABLE,
        `'${sanitizeCssValue(fontFamily)}'`,
    );
}

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
