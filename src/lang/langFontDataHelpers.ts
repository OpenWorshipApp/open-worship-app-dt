import type { LanguageDataType } from './langHelpers';
import {
    LANG_PLUGIN_FACTS_FILE_NAME,
    type LangPluginType,
} from '../../electron/langPluginProtocol';
import {
    applyLangOpenLyricFontFaces,
    genFontsData,
    listLangFontFileNames,
    type LangFontsFileType,
} from './data/online/langFontFaces';

// A language's FONTS without the language (EN-59, 2026-11-10). Every screen
// window registers every enabled language's `@font-face` rules at boot, and
// a song previewer and every font list do the same -- and until this, each
// of them loaded the whole plugin to read them: its dictionary, Bible names,
// song plugin and all, 1.4-2.1 MB of heap a language for as long as the
// window lived, to register about 2 KB of CSS (none at all for a language
// that ships no fonts). The plugin build now writes `langFacts.json`
// (`extra-work/build-lang-plugins.mjs`), which rides along with the plugin
// list, and this turns it into the slice of `LanguageDataType` those callers
// read -- the same CSS the plugin's factory would give, from the same
// generator (`./data/online/langFontFaces.ts`). A leaf: types and that
// generator only.

/** `langFacts.json`, as the plugin build writes it. */
export type LangFactsType = {
    // The package's own `fonts.json`, or null when it ships no fonts.
    fonts: LangFontsFileType | null;
    // Each file `fonts.json` names -> where the build put it, relative to the
    // plugin's folder (`assets/<name>-<hash>.ttf`).
    fontFiles?: Record<string, string>;
    // It ships a names-lookup dataset (`location-name-map-data/`).
    hasLookupData?: boolean;
};

/** What a window needs of a language to DRAW it, and nothing more. */
export type LangFontDataType = Pick<
    LanguageDataType,
    | 'langCode'
    | 'name'
    | 'genCss'
    | 'getFontFamilyFiles'
    | 'fontFamily'
    | 'globalFontFamily'
    | 'stickyNoteFontFamily'
    | 'initOpenLyricPlugins'
>;

function checkIsFontsFile(value: unknown): value is LangFontsFileType {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const fonts = value as Partial<LangFontsFileType>;
    return (
        typeof fonts.uiFamily === 'string' &&
        typeof fonts.family === 'string' &&
        Array.isArray(fonts.faces) &&
        fonts.faces.length > 0
    );
}

/**
 * The plugin's `langFacts.json`, or null when it has none: a plugin built
 * before the file existed, or one whose file does not read as one -- either
 * is loaded whole, the way it always was.
 */
export function readLangFacts(
    plugin: Pick<LangPluginType, 'inlineFiles'>,
): LangFactsType | null {
    const facts = plugin.inlineFiles?.[LANG_PLUGIN_FACTS_FILE_NAME];
    if (typeof facts !== 'object' || facts === null || !('fonts' in facts)) {
        return null;
    }
    const { fonts } = facts as { fonts: unknown };
    if (fonts !== null && !checkIsFontsFile(fonts)) {
        return null;
    }
    return facts as LangFactsType;
}

/**
 * A language's fonts as its plugin's factory would give them, with each file
 * served from `assetBaseUrl` (the plugin's folder, as the window reaches it:
 * `owa://local/@lang/<code>/` in the app, the Screen Mirror server's own
 * address in a browser). Null when the plugin carries no usable facts, so the
 * caller loads it instead; a facts file naming a font the build did not map
 * is not usable either.
 */
export function genLangFontData(
    plugin: Pick<LangPluginType, 'langCode' | 'name' | 'inlineFiles'>,
    assetBaseUrl: string,
): LangFontDataType | null {
    const facts = readLangFacts(plugin);
    if (facts === null) {
        return null;
    }
    const { langCode, name } = plugin;
    const { fonts } = facts;
    if (fonts === null) {
        return {
            langCode,
            name,
            genCss: () => {
                return '';
            },
        };
    }
    const fontFiles = facts.fontFiles ?? {};
    const fontUrls: Record<string, string> = {};
    for (const fileName of listLangFontFileNames(fonts)) {
        const relativePath = fontFiles[fileName];
        if (typeof relativePath !== 'string') {
            return null;
        }
        fontUrls[fileName] = new URL(relativePath, assetBaseUrl).href;
    }
    const fontsData = genFontsData(fonts, fontUrls);
    return {
        langCode,
        name,
        genCss: () => {
            return fontsData.css;
        },
        getFontFamilyFiles: () => {
            return fontsData.fileUrls;
        },
        fontFamily: fonts.uiFamily,
        globalFontFamily: fonts.family,
        stickyNoteFontFamily: fonts.stickyNote?.family,
        // The font half of the factory's own: a song previewer adds no song
        // plugin (that is the Lyric Editor's, which loads the language).
        initOpenLyricPlugins: (data) => {
            applyLangOpenLyricFontFaces(fonts, name, {
                openLyric: data.openLyric as { fontFaces: any } | undefined,
                openLyricMarkdownManager: data.openLyricMarkdownManager as
                    { fontFaces: any } | undefined,
                genOpenLyricFontFaces: data.genOpenLyricFontFaces,
            });
        },
    };
}
