import type { LanguageDataType } from './langHelpers';

// The app's own face on every page that boots (2026-11-06, the user: _use
// en's font-family as default app. add selected language's font-family, when
// available_, the language FIRST: `app-<Family>, app-Google-Sans, …`).
// English's Google Sans is the default (`data/en/fonts.json`); a language with
// a face of its own goes in front of it, so its letters -- and, where that
// face has them, its Latin ones -- are drawn the way the rest of the app draws
// it, and whatever it lacks falls through to Google Sans, then the system.
//
// Set on `<html>` as a variable too: the chat windows' class stacks and the
// markdown preview's body name it (`chatWindowShared.scss`,
// `MarkdownPreviewAppComp.scss`), which no inherited `body` font reaches.
// A leaf module: `boot.ts` imports it.
export const APP_FONT_FAMILY_VARIABLE = '--app-font-family';

// What stands behind the app's faces when a letter is in neither: Bootstrap's
// own system stack, and the bare system face for a page without Bootstrap.
const APP_FONT_FALLBACK = 'var(--bs-body-font-family, system-ui, sans-serif)';

type FontLangDataType = Pick<LanguageDataType, 'fontFamily'> | null;

/** The selected language's face, then the default language's, once each. */
export function genAppFontFamilyList(
    langData: FontLangDataType,
    defaultLangData: FontLangDataType,
): string {
    const fontFamilyList = [langData?.fontFamily, defaultLangData?.fontFamily];
    return Array.from(
        new Set(
            fontFamilyList.filter((fontFamily): fontFamily is string => {
                return typeof fontFamily === 'string' && fontFamily !== '';
            }),
        ),
    ).join(', ');
}

/**
 * The list onto this page: the variable on `<html>` and the stack on `body`,
 * inline, as the language's face always was. A face picked in Settings ->
 * General -> Font Family still wins: `boot.ts` writes it on every element.
 */
export function applyAppFontFamily(fontFamilyList: string) {
    const rootStyle = document.documentElement.style;
    if (fontFamilyList === '') {
        rootStyle.removeProperty(APP_FONT_FAMILY_VARIABLE);
        document.body.style.fontFamily = '';
        return;
    }
    rootStyle.setProperty(APP_FONT_FAMILY_VARIABLE, fontFamilyList);
    document.body.style.fontFamily =
        `var(${APP_FONT_FAMILY_VARIABLE}), ` + APP_FONT_FALLBACK;
}
