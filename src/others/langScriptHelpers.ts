// What each language package says about the SCRIPT it is written in
// (`src/lang/data/online/<code>/script.json`), for code that cuts, measures or tags
// text whatever language that text is in: which language a PowerPoint run
// is, and which of the computer's own fonts draw that script. (Which letters make one cluster is a property of the script, not of a
// language: `src/helper/scriptClusterHelpers.ts`.)
//
// No language is named here: a package that writes in a script of its own
// brings the file, and one that does not (or is not installed) adds nothing.
// Every file is a few bytes and comes with the language plugin list
// (`langFileStore.ts`), so each answer is synchronous once the window has
// started. A leaf: no app imports.

import {
    getLangFile,
    getLangFilesVersion,
    listLangFiles,
} from '../lang/langFileStore';

type LangScriptFileType = {
    // A letter of the language's own script, as a regular expression source.
    scriptPattern?: string;
    // Letters that say the text is ANOTHER language written partly in the
    // same script (Japanese kana beside the Han letters Chinese is written
    // in): text holding one is not this language's.
    notScriptPattern?: string;
    // The faces each operating system ships for the script, tried as
    // fallbacks when a document's own face lacks a letter.
    systemFonts?: Partial<Record<SystemFontPlatformType, string[]>>;
};

export type SystemFontPlatformType = 'windows' | 'mac' | 'linux';

function listScriptFiles() {
    return listLangFiles<LangScriptFileType>('script.json');
}

function toScriptPattern(source: string | undefined) {
    if (typeof source !== 'string' || source === '') {
        return null;
    }
    try {
        return new RegExp(source, 'u');
    } catch (_error) {
        // One bad file must not take the export down with it.
        return null;
    }
}

// Worked out again only when the languages this window has change.
let scriptLocaleCache: {
    version: number;
    list: { pattern: RegExp; notPattern: RegExp | null; locale: string }[];
} | null = null;
function getScriptLocaleList() {
    const version = getLangFilesVersion();
    if (scriptLocaleCache?.version === version) {
        return scriptLocaleCache.list;
    }
    const list = listScriptFiles()
        .flatMap(({ langCode, file }) => {
            const pattern = toScriptPattern(file.scriptPattern);
            const meta = getLangFile<{ locale?: string; order?: number }>(
                langCode,
                'meta.json',
            );
            const locale = meta?.locale;
            if (pattern === null || typeof locale !== 'string') {
                return [];
            }
            return [
                {
                    pattern,
                    notPattern: toScriptPattern(file.notScriptPattern),
                    locale,
                    order:
                        typeof meta?.order === 'number'
                            ? meta.order
                            : Number.MAX_SAFE_INTEGER,
                },
            ];
        })
        // The store lists languages by code; languages that share a script
        // answer in the PICKER's order (`meta.json`'s `order`). By code, a
        // language added later whose code sorts first (one more Cyrillic
        // language) took every line of that script from the one before it.
        .sort((one, other) => {
            return one.order - other.order;
        });
    scriptLocaleCache = { version, list };
    return list;
}

/**
 * The locale of the installed language whose own script `text` is written
 * in, or null when it holds no letter of any such script. Languages that
 * share a script answer in the language picker's order: the first one
 * installed.
 */
export function findScriptLocale(text: string): string | null {
    return (
        getScriptLocaleList().find(({ pattern, notPattern }) => {
            return pattern.test(text) && !notPattern?.test(text);
        })?.locale ?? null
    );
}

/**
 * The faces every installed package says `platform` ships for its script,
 * in package order, each once.
 */
export function listScriptSystemFonts(platform: SystemFontPlatformType) {
    return [
        ...new Set(
            listScriptFiles().flatMap(({ file }) => {
                const fontList = file.systemFonts?.[platform];
                return Array.isArray(fontList)
                    ? fontList.filter((font) => {
                          return typeof font === 'string' && font !== '';
                      })
                    : [];
            }),
        ),
    ];
}
