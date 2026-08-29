import type { AppProviderType, MessageEventType } from '../server/appProvider';
import type { AnyObjectType } from '../helper/typeHelpers';
import appProvider from '../server/appProvider';
import { unlocking } from '../server/unlockingHelpers';
import { globalCacheManager10Seconds } from '../others/CacheManager';
import { useAppStateAsync } from '../helper/appHooks';
import { BibleCrossRefBundleReader } from './BibleCrossRefBundleReader';
import { getSetting, setSetting } from '../helper/settingHelpers';
import type { Editor, OpenLyric, OpenLyricMarkdownManager } from 'open-lyric';
import { resolveGzBundleFilePath } from './gzBundleFilePath';

const LANGUAGE_LOCALE_SETTING_NAME = 'language-locale';
export const DEFAULT_LANG_CODE = 'en';
export const supportedLangCodes = [DEFAULT_LANG_CODE, 'km'];
export const DEFAULT_LOCALE: LocaleType = 'en-US';
export const supportedLocales = [DEFAULT_LOCALE, 'km-KH'];

export const allLocalesMap = {
    arc: 'arc',
    'af-ZA': 'af',
    'am-ET': 'am',
    'ar-AE': 'ar',
    'ar-BH': 'ar',
    'ar-DZ': 'ar',
    'ar-EG': 'ar',
    'ar-IQ': 'ar',
    'ar-JO': 'ar',
    'ar-KW': 'ar',
    'ar-LB': 'ar',
    'ar-LY': 'ar',
    'ar-MA': 'ar',
    'arn-CL': 'arn',
    'ar-OM': 'ar',
    'ar-QA': 'ar',
    'ar-SA': 'ar',
    'ar-SD': 'ar',
    'ar-SY': 'ar',
    'ar-TN': 'ar',
    'ar-YE': 'ar',
    'as-IN': 'as',
    'az-az': 'az',
    'az-Cyrl-AZ': 'az',
    'az-Latn-AZ': 'az',
    'ba-RU': 'ba',
    'be-BY': 'be',
    'bg-BG': 'bg',
    'bn-BD': 'bn',
    'bn-IN': 'bn',
    'bo-CN': 'bo',
    'br-FR': 'br',
    'bs-Cyrl-BA': 'bs',
    'bs-Latn-BA': 'bs',
    'ca-ES': 'ca',
    'co-FR': 'co',
    'cs-CZ': 'cs',
    'cy-GB': 'cy',
    'da-DK': 'da',
    'de-AT': 'de',
    'de-CH': 'de',
    'de-DE': 'de',
    'de-LI': 'de',
    'de-LU': 'de',
    'dsb-DE': 'dsb',
    'dv-MV': 'dv',
    'el-CY': 'el',
    'el-GR': 'el',
    'en-029': 'en',
    'en-AU': 'en',
    'en-BZ': 'en',
    'en-CA': 'en',
    'en-cb': 'en',
    'en-GB': 'en',
    'en-IE': 'en',
    'en-IN': 'en',
    'en-JM': 'en',
    'en-MT': 'en',
    'en-MY': 'en',
    'en-NZ': 'en',
    'en-PH': 'en',
    'en-SG': 'en',
    'en-TT': 'en',
    'en-US': 'en',
    'en-ZA': 'en',
    'en-ZW': 'en',
    'es-AR': 'es',
    'es-BO': 'es',
    'es-CL': 'es',
    'es-CO': 'es',
    'es-CR': 'es',
    'es-DO': 'es',
    'es-EC': 'es',
    'es-ES': 'es',
    'es-GT': 'es',
    'es-HN': 'es',
    'es-MX': 'es',
    'es-NI': 'es',
    'es-PA': 'es',
    'es-PE': 'es',
    'es-PR': 'es',
    'es-PY': 'es',
    'es-SV': 'es',
    'es-US': 'es',
    'es-UY': 'es',
    'es-VE': 'es',
    'et-EE': 'et',
    'eu-ES': 'eu',
    'fa-IR': 'fa',
    'fi-FI': 'fi',
    'fil-PH': 'fil',
    'fo-FO': 'fo',
    'fr-BE': 'fr',
    'fr-CA': 'fr',
    'fr-CH': 'fr',
    'fr-FR': 'fr',
    'fr-LU': 'fr',
    'fr-MC': 'fr',
    'fy-NL': 'fy',
    'ga-IE': 'ga',
    'gd-GB': 'gd',
    'gd-ie': 'gd',
    'gl-ES': 'gl',
    'gsw-FR': 'gsw',
    'gu-IN': 'gu',
    'ha-Latn-NG': 'ha',
    'he-IL': 'he',
    'hi-IN': 'hi',
    'hr-BA': 'hr',
    'hr-HR': 'hr',
    'hsb-DE': 'hsb',
    'hu-HU': 'hu',
    'hy-AM': 'hy',
    'id-ID': 'id',
    'ig-NG': 'ig',
    'ii-CN': 'ii',
    'in-ID': 'in',
    'is-IS': 'is',
    'it-CH': 'it',
    'it-IT': 'it',
    'iu-Cans-CA': 'iu',
    'iu-Latn-CA': 'iu',
    'iw-IL': 'iw',
    'ja-JP': 'ja',
    'ka-GE': 'ka',
    'kk-KZ': 'kk',
    'kl-GL': 'kl',
    'km-KH': 'km',
    'kn-IN': 'kn',
    'kok-IN': 'kok',
    'ko-KR': 'ko',
    'ky-KG': 'ky',
    'lb-LU': 'lb',
    'lo-LA': 'lo',
    'lt-LT': 'lt',
    'lv-LV': 'lv',
    'mi-NZ': 'mi',
    'mk-MK': 'mk',
    'ml-IN': 'ml',
    'mn-MN': 'mn',
    'mn-Mong-CN': 'mn',
    'moh-CA': 'moh',
    'mr-IN': 'mr',
    'ms-BN': 'ms',
    'ms-MY': 'ms',
    'mt-MT': 'mt',
    'nb-NO': 'nb',
    'ne-NP': 'ne',
    'nl-BE': 'nl',
    'nl-NL': 'nl',
    'nn-NO': 'nn',
    'no-no': 'no',
    'nso-ZA': 'nso',
    'oc-FR': 'oc',
    'or-IN': 'or',
    'pa-IN': 'pa',
    'pl-PL': 'pl',
    'prs-AF': 'prs',
    'ps-AF': 'ps',
    'pt-BR': 'pt',
    'pt-PT': 'pt',
    'qut-GT': 'qut',
    'quz-BO': 'quz',
    'quz-EC': 'quz',
    'quz-PE': 'quz',
    'rm-CH': 'rm',
    'ro-mo': 'ro',
    'ro-RO': 'ro',
    'ru-mo': 'ru',
    'ru-RU': 'ru',
    'rw-RW': 'rw',
    'sah-RU': 'sah',
    'sa-IN': 'sa',
    'se-FI': 'se',
    'se-NO': 'se',
    'se-SE': 'se',
    'si-LK': 'si',
    'sk-SK': 'sk',
    'sl-SI': 'sl',
    'sma-NO': 'sma',
    'sma-SE': 'sma',
    'smj-NO': 'smj',
    'smj-SE': 'smj',
    'smn-FI': 'smn',
    'sms-FI': 'sms',
    'sq-AL': 'sq',
    'sr-BA': 'sr',
    'sr-CS': 'sr',
    'sr-Cyrl-BA': 'sr',
    'sr-Cyrl-CS': 'sr',
    'sr-Cyrl-ME': 'sr',
    'sr-Cyrl-RS': 'sr',
    'sr-Latn-BA': 'sr',
    'sr-Latn-CS': 'sr',
    'sr-Latn-ME': 'sr',
    'sr-Latn-RS': 'sr',
    'sr-ME': 'sr',
    'sr-RS': 'sr',
    'sr-sp': 'sr',
    'sv-FI': 'sv',
    'sv-SE': 'sv',
    'sw-KE': 'sw',
    'syr-SY': 'syr',
    'ta-IN': 'ta',
    'te-IN': 'te',
    'tg-Cyrl-TJ': 'tg',
    'th-TH': 'th',
    'tk-TM': 'tk',
    'tlh-QS': 'tlh',
    'tn-ZA': 'tn',
    'tr-TR': 'tr',
    'tt-RU': 'tt',
    'tzm-Latn-DZ': 'tzm',
    'ug-CN': 'ug',
    'uk-UA': 'uk',
    'ur-PK': 'ur',
    'uz-Cyrl-UZ': 'uz',
    'uz-Latn-UZ': 'uz',
    'uz-uz': 'uz',
    'vi-VN': 'vi',
    'wo-SN': 'wo',
    'xh-ZA': 'xh',
    'yo-NG': 'yo',
    'zh-CN': 'zh',
    'zh-HK': 'zh',
    'zh-MO': 'zh',
    'zh-SG': 'zh',
    'zh-TW': 'zh',
    'zu-ZA': 'zu',
} as const;

export const rtlLangs = ['arc', 'ar', 'he', 'fa', 'ur', 'ps', 'dv'] as const;

export const languageNameMap: { [key: string]: string } = {
    ab: 'Abkhazian (Abkhazia)',
    aa: 'Afar (Afar)',
    af: 'Afrikaans',
    ak: 'Akan',
    sq: 'Albanian (Shqip)',
    am: 'Amharic (አማርኛ)',
    ar: 'Arabic (العربية)',
    an: 'Aragonese (Aragonés)',
    hy: 'Armenian (Հայերեն)',
    as: 'Assamese (অসমীয়া)',
    av: 'Avaric (Авар)',
    ae: 'Avestan (أفستائية)',
    ay: 'Aymara (Aymara)',
    az: 'Azerbaijani (Azərbaycan dili)',
    bm: 'Bambara (Bamanankan)',
    ba: 'Bashkir (Башҡортса)',
    eu: 'Basque (Euskara)',
    be: 'Belarusian (Беларуская)',
    bn: 'Bengali (বাংলা)',
    bi: 'Bislama (Bislama)',
    bs: 'Bosnian (Bosanski)',
    br: 'Breton (Brezhoneg)',
    bg: 'Bulgarian (Български)',
    my: 'Burmese (ဗမာစာ)',
    ca: 'Catalan, Valencian (Català, Valencià)',
    ch: 'Chamorro (Chamoru)',
    ce: 'Chechen (Нохчийн)',
    ny: 'Chichewa, Chewa, Nyanja (Chichewa)',
    zh: 'Chinese (中文)',
    cu: 'Church Slavonic, Old Slavonic, Old Church Slavonic (Церковнословенский)',
    cv: 'Chuvash (Чӑваш)',
    kw: 'Cornish (Kernewek)',
    co: 'Corsican (Corsu)',
    cr: 'Cree (ᓀᐦᐃᔭᐤ)',
    hr: 'Croatian (Hrvatski)',
    cs: 'Czech (Čeština)',
    da: 'Danish (Dansk)',
    dv: 'Divehi, Dhivehi, Maldivian (ދިވެހި)',
    nl: 'Dutch, Flemish (Nederlands, Vlaams)',
    dz: 'Dzongkha (རྫོང་ཁ)',
    en: 'English',
    eo: 'Esperanto',
    et: 'Estonian (Eesti)',
    ee: 'Ewe',
    fo: 'Faroese (Føroyskt)',
    fj: 'Fijian (Na Vosa Vakaviti)',
    fi: 'Finnish (Suomi)',
    fr: 'French (Français)',
    fy: 'Western Frisian (Frysk)',
    ff: 'Fulah (Fulfulde)',
    gd: 'Gaelic, Scottish Gaelic (Gàidhlig)',
    gl: 'Galician (Galego)',
    lg: 'Ganda (Oluganda)',
    ka: 'Georgian (ქართული)',
    de: 'German (Deutsch)',
    el: 'Greek, Modern (1453–) (Ελληνικά)',
    kl: 'Kalaallisut, Greenlandic (Kalaallisut)',
    gn: "Guarani (Aña ñe'ẽ)",
    gu: 'Gujarati (ગુજરાતી)',
    ht: 'Haitian, Haitian Creole (Kreyòl Ayisyen)',
    ha: 'Hausa',
    he: 'Hebrew (עברית)',
    hz: 'Herero (Otjiherero)',
    hi: 'Hindi (हिन्दी)',
    ho: 'Hiri Motu',
    hu: 'Hungarian (Magyar)',
    is: 'Icelandic (Íslenska)',
    io: 'Ido',
    ig: 'Igbo',
    id: 'Indonesian (Bahasa Indonesia)',
    ia: 'Interlingua (International Auxiliary Language Association)',
    ie: 'Interlingue, Occidental',
    iu: 'Inuktitut (ᐃᓄᒃᑎᑐᑦ)',
    ik: 'Inupiaq (Iñupiatun)',
    ga: 'Irish (Gaeilge)',
    it: 'Italian (Italiano)',
    ja: 'Japanese (日本語)',
    jv: 'Javanese (Basa Jawa)',
    kn: 'Kannada (ಕನ್ನಡ)',
    kr: 'Kanuri (Kanuri)',
    ks: 'Kashmiri (कश्मीरी)',
    kk: 'Kazakh (Қазақ)',
    km: 'Khmer (ភាសាខ្មែរ)',
    ki: 'Kikuyu, Gikuyu (Gikuyu)',
    rw: 'Kinyarwanda (Ikinyarwanda)',
    ky: 'Kyrgyz, Kirghiz (Кыргызча)',
    kv: 'Komi (Коми)',
    kg: 'Kongo (Kikongo)',
    ko: 'Korean (한국어)',
    kj: 'Kuanyama, Kwanyama (Kuanyama)',
    ku: 'Kurdish (Kurdî)',
    lo: 'Lao (ພາສາລາວ)',
    la: 'Latin (Latina)',
    lv: 'Latvian (Latviešu)',
    li: 'Limburgan, Limburger, Limburgish (Limburgs)',
    ln: 'Lingala',
    lt: 'Lithuanian (Lietuvių)',
    lu: 'Luba-Katanga (Tshiluba)',
    lb: 'Luxembourgish, Letzeburgesch (Lëtzebuergesch)',
    mk: 'Macedonian (Македонски)',
    mg: 'Malagasy',
    ms: 'Malay (Bahasa Melayu)',
    ml: 'Malayalam (മലയാളം)',
    mt: 'Maltese (Malti)',
    gv: 'Manx (Gaelg)',
    mi: 'Maori (Māori)',
    mr: 'Marathi (मराठी)',
    mh: 'Marshallese (M̧ajeļ)',
    mn: 'Mongolian (Монгол)',
    na: 'Nauru (Nauruan)',
    nv: 'Navajo, Navaho (Diné Bizaad)',
    nd: 'North Ndebele (Sindebele)',
    nr: 'South Ndebele (SiNdebele)',
    ng: 'Ndonga (Oshindonga)',
    ne: 'Nepali (नेपाली)',
    no: 'Norwegian (Norsk)',
    nb: 'Norwegian Bokmål (Norsk Bokmål)',
    nn: 'Norwegian Nynorsk (Norsk Nynorsk)',
    oc: 'Occitan',
    oj: 'Ojibwa (ᐊᓂᔭᐦᑖᑯᓯᐣ)',
    or: 'Oriya (ଓଡ଼ିଆ)',
    om: 'Oromo (Afaan Oromoo)',
    os: 'Ossetian, Ossetic (Ирон)',
    pi: 'Pali (पाळि)',
    ps: 'Pashto, Pushto (پښتو)',
    fa: 'Persian (فارسی)',
    pl: 'Polish (Polski)',
    pt: 'Portuguese (Português)',
    pa: 'Punjabi, Panjabi (ਪੰਜਾਬੀ)',
    qu: 'Quechua (Runa Simi)',
    ro: 'Romanian, Moldavian, Moldovan (Română)',
    rm: 'Romansh (Rumantsch)',
    rn: 'Rundi (Ikirundi)',
    ru: 'Russian (Русский)',
    se: 'Northern Sami (Davvisámegiella)',
    sm: 'Samoan (Gagana Samoa)',
    sg: 'Sango (Sängö)',
    sa: 'Sanskrit (संस्कृतम्)',
    sc: 'Sardinian (Sardu)',
    sr: 'Serbian (Српски)',
    sn: 'Shona',
    sd: 'Sindhi (سنڌي)',
    si: 'Sinhala, Sinhalese (සිංහල)',
    sk: 'Slovak (Slovenčina)',
    sl: 'Slovenian (Slovenščina)',
    so: 'Somali (Soomaali)',
    st: 'Southern Sotho (Sesotho)',
    es: 'Spanish, Castilian (Español)',
    su: 'Sundanese (Basa Sunda)',
    sw: 'Swahili (Kiswahili)',
    ss: 'Swati (SiSwati)',
    sv: 'Swedish (Svenska)',
    tl: 'Tagalog (Wikang Tagalog)',
    ty: 'Tahitian (Reo Tahiti)',
    tg: 'Tajik (Тоҷикӣ)',
    ta: 'Tamil (தமிழ்)',
    tt: 'Tatar (Татар)',
    te: 'Telugu (తెలుగు)',
    th: 'Thai (ไทย)',
    bo: 'Tibetan (བོད་ཡིག)',
    ti: 'Tigrinya (ትግርኛ)',
    to: 'Tonga (Tonga Islands)',
    ts: 'Tsonga (Xitsonga)',
    tn: 'Tswana (Setswana)',
    tr: 'Turkish (Türkçe)',
    tk: 'Turkmen (Türkmençe)',
    tw: 'Twi',
    ug: 'Uighur, Uyghur (ئۇيغۇرچە)',
    uk: 'Ukrainian (Українська)',
    ur: 'Urdu (اردو)',
    uz: 'Uzbek (Oʻzbek)',
    ve: 'Venda (TshiVenḓa)',
    vi: 'Vietnamese (Tiếng Việt)',
    vo: 'Volapük (Volapük)',
    wa: 'Walloon (Walon)',
    cy: 'Welsh (Cymraeg)',
    wo: 'Wolof',
    xh: 'Xhosa',
    ii: 'Sichuan Yi, Nuosu (四川彝语)',
    yi: 'Yiddish (ייִדיש)',
    yo: 'Yoruba (Yorùbá)',
    za: 'Zhuang, Chuang (壮语)',
    zu: 'Zulu (isiZulu)',
};

export const reversedLocalesMap: { [key: string]: string } = Object.fromEntries(
    Object.entries(allLocalesMap).map(([key, value]) => [value, key]),
);

export function getLangCode(locale: LocaleType): string | null {
    return (allLocalesMap as any)[locale] ?? null;
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
    customMenusData?: CustomMenusDataType;
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
     * The language's name written in ITS OWN language — `ខ្មែរ`, not `Khmer`.
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
    // items under it (see the Khmer Tools entry in `data/km`). Matches the
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
};

export function checkIsValidLangCode(text: string) {
    return supportedLangCodes.includes(text as any);
}
export function checkIsValidLocale(text: string) {
    return !!(allLocalesMap as any)[text];
}

export function getCurrentLocale(): LocaleType {
    const locale = getSetting(LANGUAGE_LOCALE_SETTING_NAME) ?? DEFAULT_LOCALE;
    if (checkIsValidLocale(locale)) {
        return locale as LocaleType;
    }
    return DEFAULT_LOCALE;
}
export function setCurrentLocale(locale: LocaleType) {
    if (!checkIsValidLocale(locale)) {
        locale = DEFAULT_LOCALE;
    }
    setSetting(LANGUAGE_LOCALE_SETTING_NAME, locale);
}

const langCache = new Map<string, LanguageDataType>();
export function getLangData(langCodeOrLocale: string) {
    return langCache.get(langCodeOrLocale) ?? null;
}

export function initLangCss(langData: LanguageDataType) {
    const elementId = `lang-${langData.langCode}`;
    let styleElement = document.querySelector(`style#${elementId}`);
    if (styleElement === null) {
        styleElement = document.createElement('style');
        styleElement.id = elementId;
        document.head.appendChild(styleElement);
    }
    styleElement.innerHTML = langData.genCss();
}

async function fetchLangData(langCode: string) {
    if (!supportedLangCodes.includes(langCode)) {
        // TODO: implement loading language data from server
        return null;
    }
    const module = await import(`./data/${langCode}/index.ts`);
    return module.default as LanguageDataType;
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
    langCache.set(langData.locale, langData);
    langCache.set(langCode, langData);
    initLangCss(langData);
    return langData;
}

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
    const allLangData = await Promise.all(
        supportedLangCodes.map((langCode) => fetchLangData(langCode)),
    );
    return allLangData.filter((data) => data !== null);
}

// The renderers that call this render CONTENT in a language other than their
// own UI locale (lyric slides, bible notes), and that content asks for the
// language's font by name — e.g. the `app-Battambang` frozen into open-lyric's
// generated markup. So the `@font-face` rules have to be registered here too,
// not only for the locale the window's UI happens to use: the screen window
// loads no locale of its own, and a missing face silently falls back to a
// system font whose wider metrics reflow and clip the whole slide.
// The modules are already loaded at this point, so this costs nothing extra.
export async function initAllLangCss() {
    const allLangData = await getAllLangsAsync();
    for (const langData of allLangData) {
        initLangCss(langData);
    }
    return allLangData;
}

function getDictValue(
    langData: LanguageDataType,
    text: string,
    currentLocale: LocaleType,
) {
    const { dictionary } = langData;
    const sanitizedKey = langData.sanitizeTranKey(text);
    if (dictionary[sanitizedKey] === undefined) {
        if (appProvider.systemUtils.isDev) {
            throw new Error(
                `Translation for text "${text}" not found in ` +
                    `locale ${currentLocale}.`,
            );
        }
        return text;
    }
    return dictionary[sanitizedKey];
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
            return prev + (args[index] ?? '') + curr;
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
    const dictionary = langData.dictionary;
    const sanitizedKey = langData.sanitizeTranKey(text);
    if (dictionary[sanitizedKey] === undefined) {
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
 * records may be Khmer while the menus around them are English, and a record's
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
    const sanitizedKey = langData.sanitizeTranKey(text);
    return langData.dictionary[sanitizedKey] ?? text;
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
    return rtlLangs.includes(langCode as any);
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
    if (langCode === null || !(langCode in languageNameMap)) {
        languageName = 'Unknown';
    } else {
        languageName = languageNameMap[langCode];
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
) {
    appProvider.messageUtils.sendData('main:app:set-menu-items', {
        key,
        menusData,
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

export async function initLangAppMenu() {
    const menusData: AnyObjectType = {};
    const langDataList = await getAllLangsAsync();
    for (const langData of langDataList) {
        const customMenusData = langData.customMenusData ?? {};
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
