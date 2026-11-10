import type { FontListType } from '../server/appProvider';
import type { LanguageDataType } from './langHelpers';
import { initAllLangCss } from './langHelpers';

/**
 * The fonts the app's LANGUAGE PACKAGES ship -- English's Google Sans and
 * each installed language's own faces, a sticky-note hand among them --
 * for every font picker (2026-11-09, the user: _app's font-family (from
 * language packages) should be available in everywhere of selecting
 * font-family_). They are not installed on the computer, so the system list
 * the pickers read never had them, while a slide, a quick text or a Bible
 * in the language was already drawn with them.
 *
 * Read off the `@font-face` rules each package already registers
 * (`genFontsData`), so a package needs nothing new to be listed: a family
 * by the name a document asks for, with the weights it ships. Left out are
 * the app's own `app-…` aliases and the look-alikes -- a `local(…)` alias
 * for another design, which is a name, not a font of the package's.
 */

const FONT_FACE_PATTERN = /@font-face\s*\{([^}]*)\}/g;
const WEIGHT_NAME_MAP: Record<string, string> = {
    normal: '400',
    bold: '700',
};

function readDeclaration(block: string, property: string) {
    const match = new RegExp(`${property}\\s*:\\s*([^;]+);`).exec(block);
    return match === null ? null : match[1].trim();
}

/** Every `@font-face` of a sheet: its family unquoted, its `src`, weight. */
function readFontFaces(css: string) {
    const faces: { family: string; src: string; weight: string }[] = [];
    for (const [, block] of css.matchAll(FONT_FACE_PATTERN)) {
        const rawFamily = readDeclaration(block, 'font-family');
        if (rawFamily === null) {
            continue;
        }
        const rawWeight = readDeclaration(block, 'font-weight') ?? 'normal';
        faces.push({
            family: rawFamily.replaceAll(/^["']|["']$/g, '').trim(),
            src: readDeclaration(block, 'src') ?? '',
            weight: WEIGHT_NAME_MAP[rawWeight] ?? rawWeight,
        });
    }
    return faces;
}

/** The app's own face of a language (`app-Google-Sans`, `app-<Family>`). */
export function checkIsAppFontFamily(family: string) {
    return family.startsWith('app-');
}

/**
 * The same families, the app's own ones (`app-…`) first (2026-11-09, the
 * user: _app's font-family should be on top_), each group in its order.
 */
function toAppFamiliesFirst<T>(entries: [string, T][]): [string, T][] {
    return [
        ...entries.filter(([family]) => {
            return checkIsAppFontFamily(family);
        }),
        ...entries.filter(([family]) => {
            return !checkIsAppFontFamily(family);
        }),
    ];
}

/**
 * `{ family: weights }` of the faces a package's CSS registers: its `app-…`
 * face first, then its real name and its sticky-note hand. A look-alike (a
 * `local(…)` alias for another design) is a name, not a font of the
 * package's, and is left out.
 */
export function parseLangFontFaces(css: string): FontListType {
    const fontList: FontListType = {};
    for (const { family, src, weight } of readFontFaces(css)) {
        if (family === '' || src.includes('local(')) {
            continue;
        }
        const weights = (fontList[family] ??= []);
        if (!weights.includes(weight)) {
            weights.push(weight);
        }
    }
    for (const weights of Object.values(fontList)) {
        weights.sort((a, b) => {
            return Number(a) - Number(b);
        });
    }
    return Object.fromEntries(toAppFamiliesFirst(Object.entries(fontList)));
}

/**
 * A language's `@font-face` sheet. A package whose sheet cannot be read
 * loses only its own fonts: an editor that lists every language's must
 * still open.
 */
function readLangCss(langData: Pick<LanguageDataType, 'genCss'>) {
    if (typeof langData.genCss !== 'function') {
        return '';
    }
    try {
        return langData.genCss();
    } catch (error) {
        console.error(error);
        return '';
    }
}

function readLangFamilies(langData: Pick<LanguageDataType, 'genCss'>) {
    return Object.keys(parseLangFontFaces(readLangCss(langData)));
}

/**
 * The Bible Note editor's font box (`editorExtraFontFamilies`, pairs of
 * `[family, languageCode]`): every enabled package's fonts, each language's
 * `app-…` face first. The FIRST pair of a language is what the editor
 * switches pasted text in that language to, and notes already store that
 * face. Before this, the box listed only those faces. The box itself sorts
 * its fonts by name (`bible-note`'s `getFontFamilyOptions`), which puts the
 * `app-…` ones at its top.
 */
export function genLangEditorFontFamilies(
    langDataList: readonly Pick<
        LanguageDataType,
        'fontFamily' | 'langCode' | 'genCss'
    >[],
): [string, string][] {
    const pairs: [string, string][] = [];
    const add = (family: string, langCode: string) => {
        const isKnown = pairs.some(([known]) => {
            return known === family;
        });
        if (!isKnown) {
            pairs.push([family, langCode]);
        }
    };
    for (const langData of langDataList) {
        if (langData.fontFamily) {
            add(langData.fontFamily, langData.langCode);
        }
    }
    for (const langData of langDataList) {
        for (const family of readLangFamilies(langData)) {
            add(family, langData.langCode);
        }
    }
    return pairs;
}

/**
 * The sticky-note font picker of the Bible Note editor: every enabled
 * package's fonts -- the `app-…` faces first, then each package's
 * sticky-note hand (what the picker is for), then the rest.
 */
export function genLangStickyNoteFontFamilies(
    langDataList: readonly Pick<
        LanguageDataType,
        'stickyNoteFontFamily' | 'genCss'
    >[],
) {
    const familyList = langDataList.flatMap(readLangFamilies);
    const familySet = new Set(familyList.filter(checkIsAppFontFamily));
    for (const langData of langDataList) {
        if (langData.stickyNoteFontFamily) {
            familySet.add(langData.stickyNoteFontFamily);
        }
    }
    for (const family of familyList) {
        familySet.add(family);
    }
    return [...familySet];
}

type OpenLyricFontFaceSectionType = {
    title: string;
    fontFaces: string[];
    indexRange: number;
};

function checkIsFontFaceSection(
    item: unknown,
): item is OpenLyricFontFaceSectionType {
    return typeof item === 'object' && item !== null && 'title' in item;
}

/**
 * A song's font list (the Lyric Editor's, a song previewer's), with every
 * enabled package's fonts in that language's own section, its `app-…` face
 * first. Those sections come before every other (the computer's `System`
 * among them) and in the packages' order, English's first. Until then, a
 * package listed only its `app-…` face, at its `songOrder`, and English
 * listed nothing. open-lyric drops a name an earlier section already lists.
 */
export function genLangOpenLyricFontFaces(
    fontFacesList: unknown,
    langDataList: readonly Pick<LanguageDataType, 'name' | 'genCss'>[],
) {
    const sections: unknown[] = Array.isArray(fontFacesList)
        ? [...fontFacesList]
        : [];
    langDataList.forEach((langData, langIndex) => {
        const families = readLangFamilies(langData);
        if (families.length === 0) {
            return;
        }
        // Below every other section's (0 and up), in the packages' order.
        const indexRange = langIndex - langDataList.length;
        const index = sections.findIndex((item) => {
            return checkIsFontFaceSection(item) && item.title === langData.name;
        });
        if (index === -1) {
            sections.push({
                title: langData.name,
                fontFaces: families,
                indexRange,
            } satisfies OpenLyricFontFaceSectionType);
            return;
        }
        const section = sections[index] as OpenLyricFontFaceSectionType;
        const known = Array.isArray(section.fontFaces) ? section.fontFaces : [];
        sections[index] = {
            ...section,
            fontFaces: [
                ...families,
                ...known.filter((family) => {
                    return !families.includes(family);
                }),
            ],
            indexRange,
        };
    });
    const toIndexRange = (item: unknown) => {
        return checkIsFontFaceSection(item) ? (item.indexRange ?? 0) : 0;
    };
    return sections.sort((one, other) => {
        return toIndexRange(one) - toIndexRange(other);
    });
}

/**
 * Every enabled language's fonts, every package's `app-…` face first, their
 * faces registered in THIS window as they are read -- so the family picked
 * is drawn here at once, the way the screen window (`screen.tsx`) has always
 * registered them.
 */
export async function getLangFontList(): Promise<FontListType> {
    const fontList: FontListType = {};
    try {
        for (const langData of (await initAllLangCss()) ?? []) {
            for (const [family, weights] of Object.entries(
                parseLangFontFaces(readLangCss(langData)),
            )) {
                const known = (fontList[family] ??= []);
                for (const weight of weights) {
                    if (!known.includes(weight)) {
                        known.push(weight);
                    }
                }
            }
        }
    } catch (error) {
        // A language that would not load costs its fonts, never the picker.
        console.error(error);
    }
    return Object.fromEntries(toAppFamiliesFirst(Object.entries(fontList)));
}

/**
 * The picker's list: the packages' fonts first, then the computer's. A
 * family both have keeps the package's weights -- its `@font-face` is what
 * the app draws that name with.
 */
export function mergeLangFontList(
    langFontList: FontListType,
    systemFontList: FontListType | null,
): FontListType | null {
    if (systemFontList === null && Object.keys(langFontList).length === 0) {
        return null;
    }
    const merged: FontListType = { ...langFontList };
    for (const [family, weights] of Object.entries(systemFontList ?? {})) {
        if (merged[family] === undefined) {
            merged[family] = weights;
        }
    }
    return merged;
}
