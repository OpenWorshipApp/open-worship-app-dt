import type {
    BibleBookType,
    LanguageDataType,
    LocaleType,
} from '../../langHelpers';

import englishBibleBooks from '../en/bibleBooks.json';
import { genFontsData, type LangFontsFileType } from './langFontFaces';

export type { LangFontsFileType } from './langFontFaces';

// The ONE way a language is made (2026-11-05, the user: _make all
// non-english languages be treated equally base on language data_, then
// _khmer and french will be the template to others_). A language is its
// folder of DATA, `src/lang/data/online/<code>/` -- the files and what each
// one means are listed in `./README.md` -- and this turns that folder into
// the app's `LanguageDataType`. Nothing here names a language: what one
// language does differently (Khmer's digits, fonts and book names, French's
// search letters) is a file in its folder, and a language without that file
// gets the plain behaviour.
//
// Called by the plugin build (`extra-work/build-lang-plugins.mjs`, which
// imports each file the folder has) and by the vitest stand-in
// (`../../langSourceFiles.vitest.ts`, which globs them). Bundled into every
// language's plugin, so it imports nothing but types from the app.

// `meta.json`: the manifest.
export type LangMetaFileType = {
    locale: string;
    order?: number;
    name: string;
    nativeName: string;
    version: string;
    // Written right to left; absent means left to right.
    direction?: 'rtl';
    // The language's own web editor, offered beside the app's.
    editorLink?: string;
    description?: string;
};

// `script.json`: how the language is written. Every pattern is a regular
// expression source matching ONE letter (`u` flag).
export type LangScriptFileType = {
    // A letter of its own script: text holding one is this language's.
    scriptPattern?: string;
    // ...unless it also holds one of these (Chinese: Han, but no kana).
    notScriptPattern?: string;
    // Words are not separated by spaces; a word ends with a zero-width space.
    isUnspaced?: boolean;
    // Its own digits, 0 to 9.
    digits?: string[];
    // Invisible marks dropped from text before it is compared.
    ignoredPattern?: string;
    // A preview drops the spaces typed only to help line breaks.
    previewIgnoresSpaces?: boolean;
    // The letters a Bible search keeps (after lower-casing); anything else
    // is a word break.
    findingLetterPattern?: string;
    // The faces each operating system ships for the script.
    systemFonts?: Partial<Record<'windows' | 'mac' | 'linux', string[]>>;
};

// `words.json`: the language's little words, as a Bible search uses them.
export type LangWordsFileType = {
    // Too common to search by.
    stopWords?: string[];
    // Say "the book" before a book's name ("in Genesis").
    bookMarkerWords?: string[];
    // Words of ASKING put in front of what a person remembers.
    findFrameWords?: string[];
};

// `bibleReference.json`: how a Bible reference is written.
export type LangBibleReferenceFileType = {
    chapterVerseSeparators?: string[];
    // A numbered book written "<name><word><digit>" ("Peter the 1st") is
    // also found as "<digit> <name>".
    bookOrdinalWord?: string;
};

type CrossRefBundleType = { filePath: string; fileName: string | null };

/** What a language folder holds, each file as its importer read it. */
export type LangFolderType = {
    langCode: string;
    meta: LangMetaFileType;
    dictionary: Record<string, string>;
    flagSVG: string;
    script?: LangScriptFileType;
    words?: LangWordsFileType;
    bibleBooks?: BibleBookType[];
    bibleKeyMap?: Record<string, string>;
    bibleReference?: LangBibleReferenceFileType;
    // `bb-cr.gz.bundle`: its own Bible cross-references.
    crossRefBundle?: CrossRefBundleType;
    // `location-name-map-data/`: its names and places for the lookup.
    lookupDataUrls?: { namesMap: string; locationsMap: string };
    fonts?: LangFontsFileType;
    // Each `fonts.json` file, resolved to the address it is served at.
    fontUrls?: Record<string, string>;
    // `openLyricPlugin.ts`: its song plugin, the one part that is code.
    OpenLyricPlugin?: new () => object;
};

const WESTERN_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const ZERO_WIDTH_SPACE = '\u200B';
const EDGE_ZERO_WIDTH_SPACES_PATTERN = /^\u200B+|\u200B+$/g;
const WHITE_SPACES_PATTERN = /\s+/g;

// As every package's: a key in any letter case finds its label.
function sanitizeTranKey(key: string) {
    return key.trim().toLowerCase();
}

// One pass, refusing two keys that sanitize alike (the second would
// silently win).
function genDictionary(translations: Record<string, string>) {
    const sanitizedDictionary: Record<string, string> = {};
    const duplicateKeys: string[] = [];
    for (const [key, value] of Object.entries(translations)) {
        const sanitizedKey = sanitizeTranKey(key);
        if (Object.hasOwn(sanitizedDictionary, sanitizedKey)) {
            duplicateKeys.push(key);
        }
        sanitizedDictionary[sanitizedKey] = value;
    }
    if (duplicateKeys.length > 0) {
        throw new Error(
            'Duplicate translation keys found after sanitization: ' +
                duplicateKeys.join(', '),
        );
    }
    return sanitizedDictionary;
}

function toRegExp(source: string | undefined, flags = 'u') {
    return typeof source === 'string' && source !== ''
        ? new RegExp(source, flags)
        : null;
}

export function genLangData(folder: LangFolderType): LanguageDataType {
    const { langCode, meta, script, words, bibleReference, fonts } = folder;
    const locale = meta.locale as LocaleType;
    const numList = script?.digits ?? WESTERN_DIGITS;

    const scriptRegExp = toRegExp(script?.scriptPattern);
    const notScriptRegExp = toRegExp(script?.notScriptPattern);
    const ignoredRegExp = toRegExp(script?.ignoredPattern, 'gu');
    // Every non-space that is not a letter search keeps.
    const notFindingLetterRegExp =
        typeof script?.findingLetterPattern === 'string'
            ? new RegExp(`(?!${script.findingLetterPattern})\\S`, 'gu')
            : null;

    const trimText = script?.isUnspaced
        ? (text: string) => {
              return text.trim().replaceAll(EDGE_ZERO_WIDTH_SPACES_PATTERN, '');
          }
        : (text: string) => {
              return text.trim();
          };
    const wordEnd = script?.isUnspaced ? ZERO_WIDTH_SPACE : ' ';
    const sanitizeText = (text: string) => {
        return ignoredRegExp === null ? text : text.replace(ignoredRegExp, '');
    };
    const bookOrdinalWord = bibleReference?.bookOrdinalWord;

    const fontsData =
        fonts === undefined ? null : genFontsData(fonts, folder.fontUrls ?? {});
    const { OpenLyricPlugin, lookupDataUrls, crossRefBundle } = folder;

    const langData: LanguageDataType = {
        packageDir: '',
        version: meta.version,
        locale,
        langCode,
        editorLink: meta.editorLink,
        bibleBooks: folder.bibleBooks ?? englishBibleBooks,
        getBibleKeyNameMap: () => {
            return folder.bibleKeyMap ?? {};
        },
        // A Latin-script language has no pattern: no test here tells it
        // apart from English, and claiming English text would move it off
        // the default language.
        checkIsThisLang: (text: string) => {
            return (
                scriptRegExp !== null &&
                scriptRegExp.test(text) &&
                !(notScriptRegExp?.test(text) ?? false)
            );
        },
        genCss: () => {
            return fontsData?.css ?? '';
        },
        numList,
        dictionary: genDictionary(folder.dictionary),
        name: meta.name,
        nativeName: meta.nativeName,
        flagSVG: folder.flagSVG.trim(),
        sanitizeText,
        sanitizePreviewText: (text: string) => {
            return sanitizeText(
                script?.previewIgnoresSpaces ? text.replaceAll(' ', '') : text,
            );
        },
        sanitizeFindingText: (text: string) => {
            const lowerText = text.normalize('NFC').toLocaleLowerCase(locale);
            if (notFindingLetterRegExp === null) {
                return lowerText.trim();
            }
            return trimText(
                lowerText
                    .replace(notFindingLetterRegExp, ' ')
                    .replaceAll(WHITE_SPACES_PATTERN, ' '),
            );
        },
        stopWords: words?.stopWords ?? [],
        bookMarkerWords: words?.bookMarkerWords,
        findFrameWords: words?.findFrameWords,
        trimText,
        endWord: (text: string) => {
            return text + wordEnd;
        },
        extraBibleContextMenuItems: (_bibleItem, _appProvider) => {
            return [];
        },
        bibleAudioAvailable: false,
        sanitizeTranKey,
        transformBibleBookName: (bookName: string) => {
            if (bookOrdinalWord === undefined) {
                return [bookName];
            }
            // "<name><word><digit>" is also "<digit> <name>".
            const trimmedName = bookName.trim();
            const [name, digit] = trimmedName.split(bookOrdinalWord);
            if (
                digit !== undefined &&
                numList.includes(digit.trim()) &&
                name.trim().length > 0
            ) {
                return [trimmedName, `${digit.trim()} ${name.trim()}`];
            }
            return [trimmedName];
        },
        // Without a bundle of its own the app reads English's.
        getBibleCrossRefBundleFilePath(resolveGzBundleFilePath) {
            return crossRefBundle === undefined
                ? ''
                : resolveGzBundleFilePath(crossRefBundle);
        },
    };
    if (fontsData !== null && fonts !== undefined) {
        langData.getFontFamilyFiles = () => {
            return fontsData.fileUrls;
        };
        langData.fontFamily = fonts.uiFamily;
        langData.globalFontFamily = fonts.family;
        langData.stickyNoteFontFamily = fonts.stickyNote?.family;
    }
    if (lookupDataUrls !== undefined) {
        langData.getLookupDataVersion = async ({ readJsonFileVersion }) => {
            const [namesMap, locationsMap] = await Promise.all([
                readJsonFileVersion(lookupDataUrls.namesMap),
                readJsonFileVersion(lookupDataUrls.locationsMap),
            ]);
            if (namesMap === null || locationsMap === null) {
                return null;
            }
            return { namesMap, locationsMap };
        };
        langData.getLookupData = async ({ readJsonFile }) => {
            try {
                const namesMap = await readJsonFile(lookupDataUrls.namesMap);
                const locationsMap = await readJsonFile(
                    lookupDataUrls.locationsMap,
                );
                return { namesMap, locationsMap };
            } catch (error) {
                console.error(error);
                return null;
            }
        };
    }
    if (OpenLyricPlugin !== undefined || fonts !== undefined) {
        langData.initOpenLyricPlugins = ({
            editor,
            openLyric,
            openLyricMarkdownManager,
            genOpenLyricFontFaces,
        }) => {
            if (OpenLyricPlugin !== undefined) {
                editor?.addPlugin(locale, new OpenLyricPlugin() as any);
            }
            if (fonts === undefined) {
                return;
            }
            const option = {
                title: meta.name,
                fontFaces: [fonts.uiFamily],
                indexRange: fonts.songOrder ?? 0,
            };
            if (openLyric !== undefined) {
                openLyric.fontFaces = genOpenLyricFontFaces(
                    (openLyric.fontFaces as any) ?? [],
                    { ...option },
                );
            }
            if (openLyricMarkdownManager !== undefined) {
                openLyricMarkdownManager.fontFaces = genOpenLyricFontFaces(
                    (openLyricMarkdownManager.fontFaces as any) ?? [],
                    { ...option },
                );
            }
        };
    }
    return langData;
}
