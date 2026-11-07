import type { LocaleType } from '../lang/langHelpers';
import {
    DEFAULT_LOCALE,
    getLangDataByCodeAsync,
    getLanguageTitle,
    getSupportedLangCodes,
    reversedLocalesMap,
    toLocaleNum,
} from '../lang/langHelpers';
import type {
    LongTextColumnInputType,
    LongTextLanguageType,
    LongTextResolvedLanguageType,
    LongTextScreenRowType,
} from './foregroundLongTextHelpers';
import { genLongTextScreenTexts } from './foregroundLongTextHelpers';

// What Long Text Show needs of a LANGUAGE: the list to pick from, the name to
// show for a code, and the locale its column is drawn in -- which is what
// brings the column its font, its reading direction and its own digits.

export function toLongTextLanguageLabel(langCode: string) {
    return `${langCode.toUpperCase()} - ${getLanguageTitle({ langCode })}`;
}

let langCodeListCache: {
    supportedLangCodes: string[];
    langCodes: string[];
} | null = null;
/**
 * Every language a column can be in: the ones the app speaks first (they are
 * the ones a church here sings in), then the rest by name. Built on first use
 * and kept until the app's own languages change (one installed or turned off
 * in Settings > Languages) -- the rest is a table that never does.
 */
export function getLongTextLangCodes() {
    const supportedLangCodes = getSupportedLangCodes();
    if (langCodeListCache?.supportedLangCodes === supportedLangCodes) {
        return langCodeListCache.langCodes;
    }
    const otherLangCodes = Object.keys(reversedLocalesMap)
        .filter((langCode) => {
            return !supportedLangCodes.includes(langCode);
        })
        .sort((langCode1, langCode2) => {
            return getLanguageTitle({ langCode: langCode1 }).localeCompare(
                getLanguageTitle({ langCode: langCode2 }),
            );
        });
    const langCodes = [...supportedLangCodes, ...otherLangCodes];
    langCodeListCache = { supportedLangCodes, langCodes };
    return langCodes;
}

/**
 * The locale a language's column is drawn in. A language the app has a
 * package for reads in that package's own (its `meta.json` locale, with its
 * font and its digits); for any other, the table's locale of that language is enough
 * for what the screen takes from it, which is the reading direction.
 */
export async function toLongTextLocale(langCode: string): Promise<LocaleType> {
    const langData = await getLangDataByCodeAsync(langCode);
    return (
        langData?.locale ??
        (reversedLocalesMap[langCode] as LocaleType | undefined) ??
        DEFAULT_LOCALE
    );
}

/**
 * One language of a text that passed its check, as the column to put up: its
 * screen rows -- a line each in Atom mode -- and each one's number in the
 * language's own digits, counted on through the whole text.
 */
export async function genLongTextColumnInput(
    language: LongTextLanguageType,
    resolved: LongTextResolvedLanguageType,
    rowIndexes: number[],
    screenRows: LongTextScreenRowType[],
): Promise<LongTextColumnInputType> {
    const locale = await toLongTextLocale(language.langCode);
    const texts = genLongTextScreenTexts(resolved, rowIndexes, screenRows);
    const nums = await Promise.all(
        texts.map((_, index) => {
            return toLocaleNum(locale, index + 1);
        }),
    );
    return {
        langCode: language.langCode,
        locale,
        title: resolved.title,
        texts,
        nums,
        ...(language.style === undefined ? {} : { style: language.style }),
    };
}
