// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { loadSourceLangData } from '../../langSourceFiles';
import localesFile from '../en/locales.json';

// Every language but English (`src/lang/data/online/<code>/`, found by its
// folder): installed from the catalog, never built into the app, each one a
// folder of DATA that the one factory, `onlineLangPackage.ts`, turns into the
// package (the layout: `README.md` beside this file). That every dictionary
// carries every key the app names is `tranKeyCoverage.test.ts`'s; this holds
// the rest of the folder. With no language left, only the picker check below
// runs.

// A sentence long enough to hold letters of the language's own script.
const SCRIPT_SAMPLE_KEY =
    'Search for your language by its name, in English or in its own words, then install it.';
// Scripts written right to left.
const RTL_SCRIPT_PATTERN =
    /[\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}]/u;

type MetaType = {
    locale: string;
    order: number;
    name: string;
    nativeName: string;
    version: string;
    description: string;
    direction?: string;
};

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));

const META_MAP = import.meta.glob<MetaType>('./*/meta.json', {
    eager: true,
    import: 'default',
});
const DICTIONARY_MAP = import.meta.glob<Record<string, string>>(
    './*/dictionary.json',
    { eager: true, import: 'default' },
);
const PACKAGE_META_MAP = import.meta.glob<MetaType>('../*/meta.json', {
    eager: true,
    import: 'default',
});

// A package is a folder with a `dictionary.json`; one without is data
// waiting for its labels, read by nothing.
const langCodes = Object.keys(DICTIONARY_MAP)
    .map((filePath) => filePath.split('/')[1])
    .sort();

// English's table of the world's locales (`en/locales.json`): locale ->
// language code, and the languages written right to left.
const APP_LOCALE_MAP: Record<string, string> = localesFile.locales;
const RTL_LANG_CODE_LIST: string[] = localesFile.rightToLeft;

describe.each(langCodes)('the online language "%s"', (langCode) => {
    const meta = META_MAP[`./${langCode}/meta.json`];
    const translations = DICTIONARY_MAP[`./${langCode}/dictionary.json`];

    test('its meta.json is a manifest of its own locale', () => {
        expect(meta).toBeDefined();
        expect(meta.locale.split('-')[0]).toBe(langCode);
        // English's table need not name it -- an installed language brings
        // its locale with it (`getLangCode`) -- but a row it has is this one.
        if (Object.hasOwn(APP_LOCALE_MAP, meta.locale)) {
            expect(APP_LOCALE_MAP[meta.locale]).toBe(langCode);
        }
        expect(Number.isFinite(meta.order)).toBe(true);
        for (const field of ['name', 'nativeName', 'version', 'description']) {
            expect(typeof meta[field as keyof MetaType]).toBe('string');
            expect(meta[field as keyof MetaType]).not.toBe('');
        }
    });

    test('its dictionary has a label for every key, placeholders kept', () => {
        expect(translations).toBeDefined();
        const problems = Object.entries(translations).flatMap(
            ([key, value]) => {
                if (typeof value !== 'string' || value.trim() === '') {
                    return [`${key}: empty`];
                }
                // The app fills `{count}` in AFTER translating: one lost or
                // renamed shows the braces to the person.
                const toPlaceholders = (text: string) => {
                    return (text.match(/\{\w+\}/g) ?? []).sort().join(' ');
                };
                return toPlaceholders(key) === toPlaceholders(value)
                    ? []
                    : [`${key}: placeholders ${toPlaceholders(value)}`];
            },
        );
        expect(problems).toEqual([]);
    });

    test('its package is what the manifest says, with no English fallback', async () => {
        const langData = (await loadSourceLangData(langCode))!;
        expect(langData.langCode).toBe(langCode);
        expect(langData.locale).toBe(meta.locale);
        expect(langData.name).toBe(meta.name);
        expect(langData.nativeName).toBe(meta.nativeName);
        expect(langData.version).toBe(meta.version);

        const { dictionary, sanitizeTranKey } = langData;
        expect(dictionary[sanitizeTranKey('  Languages ')]).toBe(
            translations.Languages,
        );
        expect(dictionary[sanitizeTranKey('languages')]).toBe(
            translations.Languages,
        );
        // A key it lacks is undefined, so `tran()` throws in dev
        // (`onlineLanguagesTran.test.ts`).
        expect(
            dictionary[sanitizeTranKey('A label no dictionary has')],
        ).toBeUndefined();
    });

    test('it claims text of its own script only, and ends words its way', async () => {
        const langData = (await loadSourceLangData(langCode))!;
        expect(langData.checkIsThisLang(SCRIPT_SAMPLE_KEY)).toBe(false);
        if (!/\p{Script=Latin}/u.test(meta.nativeName)) {
            expect(
                langData.checkIsThisLang(translations[SCRIPT_SAMPLE_KEY]),
            ).toBe(true);
        }
        const word = translations.Languages;
        expect(langData.endWord(word)).not.toBe(word);
        expect(langData.trimText(langData.endWord(word))).toBe(word);
    });

    test('a right-to-left script says so in its manifest', () => {
        // `direction` is what the app reads for an installed language
        // (`checkIsRtl`); English's table may name it too, never otherwise.
        const isRtlScript = RTL_SCRIPT_PATTERN.test(meta.nativeName);
        expect(meta.direction === 'rtl').toBe(isRtlScript);
        if (RTL_LANG_CODE_LIST.includes(langCode)) {
            expect(isRtlScript).toBe(true);
        }
    });

    test('its flag is a plain drawing', () => {
        const flagSVG = readFileSync(
            path.join(THIS_DIR, langCode, 'flag.svg'),
            'utf-8',
        );
        expect(flagSVG).toMatch(
            /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]* viewBox="0 0 640 480"[^>]*>/,
        );
        expect(flagSVG).not.toMatch(/<script|<foreignObject|\son\w+=/i);
        // A link may point inside the drawing (`#a`), never out of it.
        expect(flagSVG).not.toMatch(/href="(?!#)/i);
    });
});

test('no two languages share a place in the picker', () => {
    const orderList = [
        ...Object.values(PACKAGE_META_MAP),
        ...Object.values(META_MAP),
    ].map((meta) => meta.order);
    expect(new Set(orderList).size).toBe(orderList.length);
});
