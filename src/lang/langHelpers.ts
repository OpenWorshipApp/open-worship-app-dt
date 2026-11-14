import type { AppProviderType, MessageEventType } from '../server/appProvider';
import type { AnyObjectType } from '../helper/typeHelpers';
import appProvider from '../server/appProvider';
import { unlocking } from '../server/unlockingHelpers';
import { globalCacheManager10Seconds } from '../others/CacheManager';
import { useAppStateAsync } from '../helper/appHooks';
import { BibleCrossRefBundleReader } from './BibleCrossRefBundleReader';
import SettingManager from '../helper/SettingManager';
import type { Editor, OpenLyric, OpenLyricMarkdownManager } from 'open-lyric';
import { resolveGzBundleFilePath } from './gzBundleFilePath';

import languageNameFileMap from './data/en/language-names.json';
import localesFile from './data/en/locales.json';
import englishMetaFile from './data/en/meta.json';
import type { LangPluginType } from '../../electron/langPluginProtocol';
import { genLangFontData, type LangFontDataType } from './langFontDataHelpers';
import {
    ensureLangPlugins,
    getEnabledLangPlugins,
    getLoadedLangPlugins,
    loadLangPluginData,
    setLangPluginsPrepare,
} from './langPluginRegistry';

export { ensureLangPlugins } from './langPluginRegistry';

export const DEFAULT_LANG_CODE = 'en';
export const DEFAULT_LOCALE: LocaleType = 'en-US';

// English is the app's own, the default and the fallback. Every other language
// is a PLUGIN (2026-11-04, the user: _… are modular, only English is built
// in_; `electron/langPluginProtocol.ts`): found at runtime in
// `electron-build/lang` or `<data folder>/lang` through `appProvider.langUtils`
// (`langPluginRegistry.ts`), its code loaded only when that language is asked
// for, and never named here -- nothing outside `src/lang/data` carries a word
// of it. Every window's boot awaits `ensureLangPlugins()` before it reads the
// locale, so the lists below are known by the time anything renders.
const ENGLISH_LOCALE: LocaleType =
    (englishMetaFile as { locale?: LocaleType }).locale ?? 'en-US';

// Worked out again only when the plugin list is read again: `tran` asks for
// the current locale on every call.
let supportedCache: {
    pluginList: LangPluginType[] | null;
    langCodes: string[];
    locales: LocaleType[];
} | null = null;
function getSupportedCache() {
    const pluginList = getLoadedLangPlugins();
    if (supportedCache?.pluginList !== pluginList) {
        // A plugin whose locale the world table does not know cannot be told
        // apart from a typo: it is left out rather than guessed at.
        const enabledList = getEnabledLangPlugins().filter((plugin) => {
            return getLangCode(plugin.locale as LocaleType) === plugin.langCode;
        });
        supportedCache = {
            pluginList,
            langCodes: [
                DEFAULT_LANG_CODE,
                ...enabledList.map((plugin) => plugin.langCode),
            ],
            locales: [
                ENGLISH_LOCALE,
                ...enabledList.map((plugin) => plugin.locale as LocaleType),
            ],
        };
    }
    return supportedCache;
}

/** The languages this window can be shown in, English first, by code. */
export function getSupportedLangCodes(): string[] {
    return getSupportedCache().langCodes;
}

/** The same languages, by each one's own locale. */
export function getSupportedLocales(): LocaleType[] {
    return getSupportedCache().locales;
}

/** Every installed language plugin, on or off, once the list is read. */
export function getInstalledLangPlugins(): LangPluginType[] {
    return getLoadedLangPlugins() ?? [];
}

// The app's own table of the world's locales, locale tag -> language code:
// English's DATA (`data/en/locales.json`), like the names beside it, so a
// Bible of a language that is not installed still has its language. An
// INSTALLED language needs no row: its own `meta.json` says its locale
// (`getLangCode`), so adding a language is its folder alone. What a SONG's
// `- Locales:` may name is open-lyric's rule (`data/en/open-lyric-locales.json`,
// the song checker's), not this.
export const allLocalesMap = localesFile.locales;

// Written right to left: the table's (`data/en/locales.json`), and an
// installed language whose `meta.json` says `"direction": "rtl"`.
export const rtlLangs: readonly string[] = localesFile.rightToLeft;

/** The installed language (on or off) a locale is, by its own `meta.json`. */
function findInstalledPluginByLocale(locale: string) {
    return getInstalledLangPlugins().find((plugin) => {
        return plugin.locale === locale;
    });
}

// Every language's English name (`data/en/language-names.json`, English's
// own data), for a Bible's language and the like; a language's own name for
// itself is the installed language's (`getLanguageTitle`).
export const languageNameMap: { [key: string]: string } = languageNameFileMap;

export const reversedLocalesMap: { [key: string]: string } = Object.fromEntries(
    Object.entries(allLocalesMap).map(([key, value]) => [value, key]),
);

export function getLangCode(locale: LocaleType): string | null {
    return (
        (allLocalesMap as Record<string, string>)[locale] ??
        findInstalledPluginByLocale(locale)?.langCode ??
        null
    );
}

export type BibleBookType = {
    keys: string[];
    books: string[];
};

export type LocaleType = keyof typeof allLocalesMap;
export type LanguageDataType = {
    packageDir: string;
    version: string;
    locale: LocaleType;
    langCode: string;
    editorLink?: string;
    bibleBooks: BibleBookType[];
    checkIsThisLang: (text: string) => boolean;
    getFontFamilyFiles?: () => string[];
    genCss: () => string;
    fontFamily?: string;
    globalFontFamily?: string;
    stickyNoteFontFamily?: string;
    numList: string[];
    dictionary: AnyObjectType;
    name: string;
    /**
     * The language's name written in ITS OWN language — its own word for
     * itself, not its English name.
     *
     * The language picker must stay legible to someone who cannot read the
     * locale currently in force, which is exactly the person who needs it: a
     * mis-click or a shared machine leaves them in a script they do not read,
     * and a list translated into that script offers them no way back. So the
     * picker renders THIS, never `tran(name)`.
     *
     * Optional so a language package that predates it still loads; the picker
     * falls back to `name`, which is at least Latin script.
     */
    nativeName?: string;
    flagSVG: string;
    getBibleKeyNameMap: () => {
        [key: string]: string;
    };
    getLookupData?: (_args: {
        readJsonFile: (url: string) => Promise<any>;
        packageDir: string;
    }) => Promise<{
        namesMap: AnyObjectType;
        locationsMap: AnyObjectType;
    } | null>;
    /**
     * The dataset's own version numbers, read WITHOUT loading the dataset.
     *
     * The derived lookup index is cached on disk, and the only cheap way to tell
     * a cache built from an older dataset apart is to ask the package what its
     * maps are stamped with. A package that cannot answer (or predates this)
     * leaves the cache keyed on the app version alone.
     */
    getLookupDataVersion?: (_args: {
        readJsonFileVersion: (url: string) => Promise<number | null>;
        packageDir: string;
    }) => Promise<{
        namesMap: number;
        locationsMap: number;
    } | null>;
    sanitizeText: (text: string) => string;
    sanitizePreviewText: (text: string) => string;
    sanitizeFindingText: (text: string) => string;
    stopWords: string[];
    // A Bible search (`owa_find_verse`, 2026-10-22): the words that say
    // "the book" before a book's name ("in Genesis"), so the name is the book
    // to search and not a word of the verse; and the words of ASKING a person
    // puts in front of what they remember ("the story of", "search"), taken
    // off the front only.
    bookMarkerWords?: string[];
    findFrameWords?: string[];
    trimText: (text: string) => string;
    endWord: (text: string) => string;
    extraBibleContextMenuItems: (
        bibleItem: AnyObjectType,
        appProvider: AppProviderType,
    ) => any[];
    bibleAudioAvailable: boolean;
    sanitizeTranKey: (key: string) => string;
    transformBibleBookName: (bookName: string) => string[];
    getBibleCrossRefBundleFilePath: (
        resolveGzBundleFilePath: (bundle: {
            filePath: string;
            fileName: string | null;
        }) => string,
    ) => string;
    initOpenLyricPlugins?: (data: {
        editor?: Editor;
        openLyric?: OpenLyric;
        openLyricMarkdownManager?: OpenLyricMarkdownManager;
        // The window's own `open-lyric/internal`: a language plugin's Open
        // Lyric half registers into THIS registry, never a copy of its own
        // (`electron/client/langUtils.ts`).
        openLyricInternal?: object;
        genOpenLyricFontFaces: (
            fontFacesList: OpenLyricFontFace,
            fontFaceData: {
                title: string;
                fontFaces: string[];
                indexRange: number;
            },
        ) => {
            title: string;
            fontFaces: string[];
            indexRange: number;
        }[];
    }) => void;
};

type CustomMenuItemType = {
    label: string;
    // Optional because a submenu PARENT is not clickable — it only groups the
    // items under it (see a language's own `online/<code>/appMenus.json`). Matches the
    // electron-side `CustomMenuItemType`, which also has it optional.
    clickData?: AnyObjectType;
    accelerator?: string;
    submenu?: CustomMenuItemType[];
    // `formatMenuItems` spreads the item into the electron template, so the
    // native checkbox rendering comes for free. `checked` is only read when
    // `type` is `'checkbox'`.
    type?: 'checkbox';
    checked?: boolean;
};
export type CustomMenusDataType = {
    tools?: CustomMenuItemType[];
    // Renderer-contributed **File** menu entries (Export/Import Data). Same
    // mechanism as `tools`, so the label is translated where `tran` works.
    file?: CustomMenuItemType[];
    // The top-level **Insert** menu, owned entirely by the slide editor. The
    // menu itself only exists while something contributes to it.
    insert?: CustomMenuItemType[];
    // Renderer-contributed **View** entries: the per-widget open/close
    // checkboxes and `Reset Widgets Size`. See `resize-actor/widgetAppMenuHelpers`.
    view?: CustomMenuItemType[];
    // Renderer-contributed Help entries, such as the current page's tips.
    help?: CustomMenuItemType[];
};

export function checkIsValidLangCode(text: string) {
    return getSupportedLangCodes().includes(text);
}
export function checkIsValidLocale(text: string) {
    return (
        Object.hasOwn(allLocalesMap, text) ||
        findInstalledPluginByLocale(text) !== undefined
    );
}

// This computer's, whatever data folder is open (`COMPUTER_SETTING_NAME_LIST`).
export const LOCALE_SETTING_NAME = 'language-locale';
let localeSettingManager: SettingManager<LocaleType> | null = null;
/**
 * Built on first use, NOT at module load. This module sits inside the
 * `SettingManager` -> `appLocalStorage` -> `fileHelpers` -> `FileSource` ->
 * `FileSourceMetaManager` -> `langHelpers` import cycle, so when
 * `SettingManager` is the module that starts the cycle, a top-level `new` here
 * reaches the class while it is still in its temporal dead zone and throws
 * "default is not a constructor".
 */
function getLocaleSettingManager() {
    localeSettingManager ??= new SettingManager<LocaleType>({
        settingName: LOCALE_SETTING_NAME,
        defaultValue: DEFAULT_LOCALE,
        isErrorToDefault: true,
        validate: checkIsValidLocale,
    });
    return localeSettingManager;
}
export function getCurrentLocale(): LocaleType {
    return toAvailableLocale(getLocaleSettingManager().getSetting());
}

/**
 * A language turned off or deleted reads as English (2026-11-04, the user:
 * _when language plugin is deleted then should fallback to english if the
 * language selected_) -- once this window knows its languages; before that
 * the stored one stands, so a boot that reads it early loses nothing.
 */
function toAvailableLocale(locale: LocaleType): LocaleType {
    if (locale === DEFAULT_LOCALE || getLoadedLangPlugins() === null) {
        return locale;
    }
    const langCode = getLangCode(locale);
    if (langCode === null || getSupportedLangCodes().includes(langCode)) {
        return locale;
    }
    return DEFAULT_LOCALE;
}
export function setCurrentLocale(locale: LocaleType) {
    // Coerced BEFORE the manager sees it: `setSetting` throws on an invalid
    // value, and this is called from the language picker, which has always
    // silently fallen back rather than failing.
    if (!checkIsValidLocale(locale)) {
        locale = DEFAULT_LOCALE;
    }
    getLocaleSettingManager().setSetting(locale);
}

const langCache = new Map<string, LanguageDataType>();
export function getLangData(langCodeOrLocale: string) {
    return langCache.get(langCodeOrLocale) ?? null;
}

export function initLangCss(
    langData: Pick<LanguageDataType, 'langCode' | 'genCss'>,
) {
    const elementId = `lang-${langData.langCode}`;
    let styleElement = document.querySelector(`style#${elementId}`);
    if (styleElement === null) {
        styleElement = document.createElement('style');
        styleElement.id = elementId;
        document.head.appendChild(styleElement);
    }
    styleElement.innerHTML = langData.genCss();
}

async function fetchLangData(
    langCode: string,
): Promise<LanguageDataType | null> {
    if (langCode === DEFAULT_LANG_CODE) {
        return (await import('./data/en/index')).default;
    }
    await ensureLangPlugins();
    if (!getSupportedLangCodes().includes(langCode)) {
        return null;
    }
    try {
        return (await loadLangPluginData(langCode)) ?? null;
    } catch (error) {
        // A broken plugin is a language that is not there, never a blank page.
        console.error(`Failed to load the "${langCode}" language:`, error);
        return null;
    }
}

/**
 * ONE language package, addressed by its code.
 *
 * The point of not going through `getAllLangsAsync` is that this imports a
 * single language chunk: anything that only needs, say, the lookup dataset of
 * the language the user picked must not pay to import every other language's
 * module for nothing.
 */
export async function getLangDataByCodeAsync(
    langCode: string,
): Promise<LanguageDataType | null> {
    const cachedLangData = langCache.get(langCode);
    if (cachedLangData !== undefined) {
        return cachedLangData;
    }
    const langData = await fetchLangData(langCode);
    if (langData === null) {
        return null;
    }
    putLangData(langCode, langData);
    return langData;
}

function putLangData(langCode: string, langData: LanguageDataType) {
    langCache.set(langData.locale, langData);
    langCache.set(langCode, langData);
    initLangCss(langData);
}

// The stored language, installed or turned on in any window, is loaded here
// BEFORE this window takes the new list (`setLangPluginsPrepare` says why):
// `getCurrentLocale` names it from then on, and `tran` must find it loaded.
// Straight through the provider -- `fetchLangData` awaits the list being
// prepared. One language, the one in force; nothing else is read.
async function prepareStoredLocale(list: LangPluginType[]) {
    const locale = getLocaleSettingManager().getSetting();
    if (locale === DEFAULT_LOCALE || langCache.has(locale)) {
        return;
    }
    const langCode = getLangCode(locale);
    const isTaken = list.some((plugin) => {
        return (
            plugin.isEnabled &&
            plugin.langCode === langCode &&
            getLangCode(plugin.locale as LocaleType) === langCode
        );
    });
    if (langCode === null || !isTaken) {
        return;
    }
    const langData = await loadLangPluginData(langCode);
    if (!langData) {
        return;
    }
    putLangData(langCode, langData);
    langCache.set(locale, langData);
}
setLangPluginsPrepare(prepareStoredLocale);

export async function getLangDataAsync(
    locale: LocaleType,
): Promise<LanguageDataType | null> {
    const cachedLangData = langCache.get(locale);
    if (cachedLangData !== undefined) {
        return cachedLangData;
    }
    const langCode = getLangCode(locale);
    if (langCode === null) {
        return null;
    }
    const langData = await getLangDataByCodeAsync(langCode);
    if (langData === null) {
        return null;
    }
    // The REQUESTED locale, which is not necessarily the package's own: every
    // `en-*` resolves to the same English package, and each has to hit the cache
    // under the key it was asked for.
    langCache.set(locale, langData);
    return langData;
}

export async function getAllLangsAsync() {
    await ensureLangPlugins();
    const allLangData = await Promise.all(
        getSupportedLangCodes().map((langCode) => fetchLangData(langCode)),
    );
    return allLangData.filter((data) => data !== null);
}

// The renderers that call this render CONTENT in a language other than their
// own UI locale (lyric slides, bible notes), and that content asks for the
// language's font by name — e.g. the `app-<Family>` frozen into open-lyric's
// generated markup. So the `@font-face` rules have to be registered here too,
// not only for the locale the window's UI happens to use: the screen window
// loads no locale of its own, and a missing face silently falls back to a
// system font with other metrics, which reflows and clips the whole slide.
//
// What it registers is each language's FONTS, read off the plugin list
// (`langFacts.json`, `langFontDataHelpers.ts`) -- no plugin is loaded for it
// (EN-59): a screen window, the Presenter's first song and every font list
// had each loaded every enabled language whole, dictionary and all, and kept
// it, for about 2 KB of CSS a language. A language this window has already
// loaded for real is used as it is; a plugin built before the facts file
// existed is loaded, as it always was.
//
// ONE registration per window, shared by every caller: open-lyric awaits this
// before each song it builds, and rewriting a `<style>` of `@font-face` rules
// re-creates those faces for the whole window. A failed attempt is forgotten,
// so the next caller tries again. A language installed, turned on or off
// since is read again: the answer is kept for the plugin list it was read
// from, and every font list in the window lists the ENABLED packages.
async function fetchLangFontData(
    langCode: string,
): Promise<LangFontDataType | null> {
    const loadedLangData = langCache.get(langCode);
    if (langCode === DEFAULT_LANG_CODE || loadedLangData !== undefined) {
        return loadedLangData ?? fetchLangData(langCode);
    }
    const plugin = getEnabledLangPlugins().find((item) => {
        return item.langCode === langCode;
    });
    const assetBaseUrl = appProvider.langUtils?.getLangAssetBaseUrl?.(langCode);
    if (plugin !== undefined && assetBaseUrl !== undefined) {
        try {
            const fontData = genLangFontData(plugin, assetBaseUrl);
            if (fontData !== null) {
                return fontData;
            }
        } catch (error) {
            console.error(`The "${langCode}" language's fonts:`, error);
        }
    }
    return fetchLangData(langCode);
}

async function getAllLangFontDataAsync() {
    await ensureLangPlugins();
    const allFontData = await Promise.all(
        getSupportedLangCodes().map((langCode) => {
            return fetchLangFontData(langCode);
        }),
    );
    return allFontData.filter((data) => {
        return data !== null;
    });
}

let allLangCssPromise: Promise<LangFontDataType[]> | null = null;
let allLangCssPluginList: ReturnType<typeof getLoadedLangPlugins> | undefined;
export function initAllLangCss() {
    if (
        allLangCssPromise !== null &&
        allLangCssPluginList !== undefined &&
        allLangCssPluginList !== getLoadedLangPlugins()
    ) {
        // Undefined while the new read runs, so callers meanwhile share it.
        allLangCssPromise = null;
        allLangCssPluginList = undefined;
    }
    allLangCssPromise ??= getAllLangFontDataAsync()
        .then((allLangData) => {
            for (const langData of allLangData) {
                initLangCss(langData);
            }
            allLangCssPluginList = getLoadedLangPlugins();
            return allLangData;
        })
        .catch((error) => {
            allLangCssPromise = null;
            throw error;
        });
    return allLangCssPromise;
}

/**
 * What a language's dictionary itself HOLDS for a label, else `undefined` --
 * the one test of "translated" every lookup shares.
 *
 * Read as the dictionary's OWN key, never through `dictionary[key]` alone: a
 * plugin's dictionary is the plugin's object, and Hebrew 0.0.2's was a Proxy
 * answering every key it lacked with the key itself, so its windows showed
 * English and dev never threw (2026-11-04, the user: _non-translated should
 * fail the app (on dev), only prod allow english fallback_). Whether a label
 * falls back is the APP's call, made by the caller. It also keeps a key such
 * as `constructor` from reading the object's prototype.
 */
export function readTranValue(
    langData: LanguageDataType,
    text: string,
): string | undefined {
    const { dictionary } = langData;
    const sanitizedKey = langData.sanitizeTranKey(text);
    if (!Object.hasOwn(dictionary, sanitizedKey)) {
        return undefined;
    }
    const value = dictionary[sanitizedKey];
    return typeof value === 'string' ? value : undefined;
}

function getDictValue(
    langData: LanguageDataType,
    text: string,
    currentLocale: LocaleType,
) {
    const value = readTranValue(langData, text);
    if (value === undefined) {
        if (appProvider.systemUtils.isDev) {
            throw new Error(
                `Translation for text "${text}" not found in ` +
                    `locale ${currentLocale}.`,
            );
        }
        return text;
    }
    return value;
}
// e.g. " a b " => "a b", but " a  b " => "a  b ", to preserve multiple spaces
// in the middle
const regex = /^([ \n]*)([^ \n].+[^ \n])([ \n]*)$/;
export function tran(...args: any[]): string {
    const text = args[0];
    if (Array.isArray(text)) {
        args = args.slice(1);
        const translated = text.map((t) => tran(t));
        // translated=['a ', ' b'] & args[1] => 'a 1 b'
        return translated.reduce((prev, curr, index) => {
            return prev + curr + (args[index] ?? '');
        }, '');
    }
    if (typeof text !== 'string') {
        return `${text}`;
    }
    const currentLocale = getCurrentLocale();
    if (currentLocale === DEFAULT_LOCALE) {
        return text;
    }
    const langData = getLangData(currentLocale);
    if (langData === null) {
        if (appProvider.systemUtils.isDev) {
            throw new Error(
                `Language data for locale ${currentLocale} not found when ` +
                    `translating text.`,
            );
        }
        return text;
    }
    if (readTranValue(langData, text) === undefined) {
        if (appProvider.systemUtils.isDev) {
            throw new Error(
                `Translation for text "${text}" not found in ` +
                    `locale ${currentLocale}.`,
            );
        }
        return text;
    }
    if (regex.test(text)) {
        const translated = text.replace(
            regex,
            (_match: string, p1: string, matchText: string, p2: string) => {
                const value = getDictValue(langData, matchText, currentLocale);
                return `${p1}${value}${p2}`;
            },
        );
        return translated;
    }
    const value = getDictValue(langData, text, currentLocale);
    return value;
}

/**
 * `tran`, but into a NAMED language instead of the interface locale.
 *
 * For text that describes CONTENT the user chose a language for separately from
 * the UI — the names-and-locations lookup is the case this exists for: its
 * records may be in one language while the menus around them are English, and a record's
 * category then has to read in the language of the record, not of the menu.
 *
 * Unlike `tran` it does NOT throw on a missing key in dev. The interface locale
 * is guaranteed to translate every string the app renders; a language picked for
 * its DATA is not, and a package that ships a dataset without a complete UI
 * dictionary must degrade to English rather than blank the panel.
 */
export function tranByLangData(
    langData: LanguageDataType | null | undefined,
    text: string,
): string {
    if (
        langData === null ||
        langData === undefined ||
        langData.langCode === DEFAULT_LANG_CODE
    ) {
        return text;
    }
    return readTranValue(langData, text) ?? text;
}

export function toStringNum(numList: string[], n: number): string {
    return `${n}`
        .split('')
        .map((n1) => {
            return numList[Number.parseInt(n1)];
        })
        .join('');
}

export async function toLocaleNum(locale: LocaleType, n: number) {
    const langData = await getLangDataAsync(locale);
    if (langData === null) {
        return `${n}`;
    }
    const numList = langData.numList;
    return toStringNum(numList, n);
}

export function fromStringNum(numList: string[], localeNum: string) {
    const nString = `${localeNum}`
        .split('')
        .map((n) => {
            const ind = numList.indexOf(n);
            if (ind > -1) {
                return ind;
            }
            return n;
        })
        .join('');
    if (Number.isNaN(Number.parseInt(nString))) {
        return null;
    }
    return Number.parseInt(nString);
}

export async function fromLocaleNum(locale: LocaleType, localeNum: string) {
    const langData = await getLangDataAsync(locale);
    if (langData === null) {
        return null;
    }
    const numList = langData.numList;
    return fromStringNum(numList, localeNum);
}

export async function sanitizePreviewText(locale: LocaleType, text: string) {
    let langData = await getLangDataAsync(locale);
    langData ??= await getLangDataAsync(DEFAULT_LOCALE);
    if (langData === null) {
        return text;
    }
    return langData.sanitizePreviewText(text);
}

export async function sanitizeFindingText(locale: LocaleType, text: string) {
    let langData = await getLangDataAsync(locale);
    langData ??= await getLangDataAsync(DEFAULT_LOCALE);
    if (langData === null) {
        return text;
    }
    return langData.sanitizeFindingText(text);
}

export function quickTrimText(locale: LocaleType, text: string) {
    const langData = getLangData(locale);
    if (langData === null) {
        return text;
    }
    return langData.trimText(text);
}

export function checkIsStopWord(locale: LocaleType, text: string) {
    const langData = getLangData(locale);
    if (langData === null) {
        return false;
    }
    return langData.stopWords.includes(text);
}

export function getBookMarkerWords(locale: LocaleType) {
    return getLangData(locale)?.bookMarkerWords ?? [];
}

export function getFindFrameWords(locale: LocaleType) {
    return getLangData(locale)?.findFrameWords ?? [];
}

export function quickEndWord(locale: LocaleType, text: string) {
    const langData = getLangData(locale);
    if (langData === null) {
        return text;
    }
    const trimText = langData.trimText(text);
    if (trimText === '') {
        return '';
    }
    return langData.endWord(trimText);
}

export async function getFontFamilyByLocale(locale: LocaleType) {
    const key = `FontFamilyLocale:${locale}`;
    return await unlocking(key, async () => {
        const cachedFontFamily = await globalCacheManager10Seconds.get(key);
        if (cachedFontFamily) {
            return cachedFontFamily;
        }
        const langData = await getLangDataAsync(locale);
        if (langData === null) {
            return undefined;
        }
        await globalCacheManager10Seconds.set(key, langData.fontFamily);
        return langData.fontFamily;
    });
}
export function useFontFamilyByLocale(locale: LocaleType): string | undefined {
    const [fontFamily] = useAppStateAsync(() => {
        return getFontFamilyByLocale(locale);
    }, [locale]);
    return fontFamily ?? undefined;
}

export function checkIsRtl(locale: LocaleType) {
    const langCode = getLangCode(locale);
    if (langCode === null) {
        return false;
    }
    return (
        rtlLangs.includes(langCode) ||
        getInstalledLangPlugins().some((plugin) => {
            return plugin.langCode === langCode && plugin.direction === 'rtl';
        })
    );
}

// Built on first use: only a code the table above does not list needs it.
let fallbackLanguageNames: Intl.DisplayNames | null = null;
/**
 * A language the table above does not list, named by the platform -- in English,
 * like the table. A bible file can carry an ISO 639-2/3 code such as `arc`
 * (Aramaic), and the version menu headed that group `Unknown <arc>`.
 */
function getFallbackLanguageName(code: string): string | null {
    if (code === '') {
        return null;
    }
    try {
        fallbackLanguageNames ??= new Intl.DisplayNames(['en'], {
            type: 'language',
        });
        const name = fallbackLanguageNames.of(code);
        // A code the platform does not know either comes back as itself.
        return name && name !== code ? name : null;
    } catch {
        // Not a well-formed language tag.
        return null;
    }
}

export function getLanguageTitle(
    { locale, langCode }: { locale?: LocaleType; langCode?: string | null },
    isWithLocale = false,
) {
    if (!locale && !langCode) {
        return 'Unknown';
    }
    langCode ??= getLangCode(locale as LocaleType);
    let languageName: string;
    if (langCode !== null && langCode in languageNameMap) {
        languageName = languageNameMap[langCode];
    } else {
        languageName =
            getFallbackLanguageName(langCode ?? locale ?? '') ?? 'Unknown';
    }
    // A language's own name for itself is ITS data, from the installed
    // language (2026-11-04: only English ships); the app's table is English.
    const nativeName = getEnabledLangPlugins().find((plugin) => {
        return plugin.langCode === langCode;
    })?.nativeName;
    if (nativeName && nativeName !== languageName) {
        languageName += ` (${nativeName})`;
    }
    if (locale !== undefined) {
        languageName += isWithLocale ? ` <${locale}>` : '';
    }
    return languageName;
}

// Constructing a BibleCrossRefBundleReader costs an fd open plus a ~1MB
// synchronous index read per call, so keep a single-entry cache (most
// sessions use one bundle) and reuse it while the path matches.
let cachedCrossRefReader: {
    bundleFilePath: string;
    reader: BibleCrossRefBundleReader;
} | null = null;
function getBibleCrossRefBundleReader(bundleFilePath: string) {
    if (cachedCrossRefReader?.bundleFilePath === bundleFilePath) {
        return cachedCrossRefReader.reader;
    }
    cachedCrossRefReader?.reader.close();
    cachedCrossRefReader = null;
    const reader = new BibleCrossRefBundleReader(bundleFilePath);
    cachedCrossRefReader = { bundleFilePath, reader };
    return reader;
}

export async function getLocalBibleCrossRef(
    locale: LocaleType,
    targetVerse: {
        bookKey: string;
        chapter: number;
        verse: number;
    },
) {
    const langData = await getLangDataAsync(locale);
    if (langData === null) {
        return null;
    }
    const bundleFilePath = langData.getBibleCrossRefBundleFilePath(
        resolveGzBundleFilePath,
    );
    // A language plugin may ship no bundle of its own; the caller then reads
    // English's.
    if (!bundleFilePath) {
        return null;
    }
    const db = getBibleCrossRefBundleReader(bundleFilePath);
    return db.getVerse(
        targetVerse.bookKey,
        targetVerse.chapter,
        targetVerse.verse,
    );
}

export function registerAppMenuClicked<T>(
    handler: (event: MessageEventType, data: T) => void,
) {
    appProvider.messageUtils.listenForData(
        'app:main:menu-item-clicked',
        handler,
    );
    return () => {
        appProvider.messageUtils.removeListener(
            'app:main:menu-item-clicked',
            handler,
        );
    };
}

export type AppMenuItemsOptionsType = {
    /**
     * Send the click to the window the user is LOOKING AT, not to the one that
     * registered the items.
     *
     * For anything route-scoped the default is right: only the registrant has a
     * handler for its own `clickData`. But the native menu keeps ONE entry per
     * key, so a key every window contributes -- an app-wide feature like the
     * presenting control or the assistant -- is owned by whichever window
     * happened to load last, and every other one's press is dropped by its own
     * `getIsWindowFocused()` guard. Opening Settings used to take
     * *Tools → Start Controlling* away from the presenter for exactly that
     * reason.
     */
    isRoutedToFocusedWindow?: boolean;
    /**
     * Send the click to EVERY window, each of which decides by its own page
     * whether it has anything to do with it. Help → Tips of the Day opens the
     * tip of every page that is open, not only the one in front (2026-10-23,
     * the user: _open `Help` menubar, when click show in all pages_). Wins
     * over `isRoutedToFocusedWindow`.
     */
    isSentToAllWindows?: boolean;
};

/**
 * Contribute this window's items to the native menu, or pass `null` to withdraw
 * them.
 *
 * Withdrawing matters for anything route-scoped: the native menu is global and
 * outlives the page, so items left behind after a route change keep showing but
 * their clicks land in a renderer that no longer listens.
 */
export function setAppMenuItems(
    key: string,
    menusData: CustomMenusDataType | null,
    options?: AppMenuItemsOptionsType,
) {
    appProvider.messageUtils.sendData('main:app:set-menu-items', {
        key,
        menusData,
        options,
    });
}

function handleLangAppMenusClick(
    _event: any,
    clickData: { openExternalUrl?: string },
) {
    const { openExternalUrl } = clickData ?? {};
    if (openExternalUrl) {
        appProvider.browserUtils.openExternalURL(openExternalUrl);
    }
}

// Separate from `initLangAppMenu` so the caller can unregister it: the async
// menu build cannot be undone from an effect cleanup, but a listener left
// behind by StrictMode's double mount would open every tools link twice.
export function registerLangAppMenuClicked() {
    return registerAppMenuClicked(handleLangAppMenusClick);
}

// A language's menu items are its plugin's `appMenus.json` (copied from
// `online/<code>/appMenus.json`), NOT in its package: this runs on every page of
// the main window, and the packages are hundreds of KB each (one with an
// `openLyricPlugin.ts` also brings the open-lyric plugin). The plugin list carries the file inline.
export async function initLangAppMenu() {
    await ensureLangPlugins();
    const enabledLangCodes = getSupportedLangCodes();
    const menusData: AnyObjectType = {};
    const customMenusDataList = getEnabledLangPlugins()
        .filter((plugin) => {
            return enabledLangCodes.includes(plugin.langCode);
        })
        .flatMap((plugin) => {
            const appMenus = plugin.inlineFiles['appMenus.json'];
            return appMenus && typeof appMenus === 'object'
                ? [appMenus as CustomMenusDataType]
                : [];
        });
    for (const customMenusData of customMenusDataList) {
        Object.entries(customMenusData).forEach(([key, value]) => {
            menusData[key] ??= [];
            menusData[key] = menusData[key].concat(value);
        });
    }
    setAppMenuItems('lang', menusData as CustomMenusDataType);
}

type OpenLyricFontFace = {
    title: string;
    fontFaces: string[];
    indexRange: number;
}[];
export function genOpenLyricFontFaces(
    fontFacesList: OpenLyricFontFace,
    fontFaceData: {
        title: string;
        fontFaces: string[];
        indexRange: number;
    },
) {
    const fontFaceMap = Object.fromEntries(
        fontFacesList.map((item) => {
            return [item.title, item];
        }),
    );
    fontFaceMap[fontFaceData.title] = fontFaceData;
    const newFontFacesList = Object.values(fontFaceMap);
    return newFontFacesList.sort((a, b) => {
        return a.indexRange - b.indexRange;
    });
}
