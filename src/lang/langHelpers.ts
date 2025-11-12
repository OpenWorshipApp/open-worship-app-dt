import { handleError } from '../helper/errorHelpers';
import { getSetting, setSetting } from '../helper/settingHelpers';
import { AppProviderType } from '../server/appProvider';
import { AnyObjectType } from '../helper/typeHelpers';

import kmLangData from './data/km';
import enLangData from './data/en';

export const DEFAULT_LOCALE = 'en-US';

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

export const langDataMap: { [key: string]: LanguageDataType } = {
    km: kmLangData,
    en: enLangData,
};

export const langCodes = ['km', 'en'] as const;
export type LocaleType = keyof typeof allLocalesMap;
export type LanguageDataType = {
    locale: LocaleType;
    langCode: string;
    dirPath?: string;
    genCss: () => string;
    fontFamily: string;
    numList: string[];
    dictionary: AnyObjectType;
    name: string;
    flagSVG: string;
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
};

const LANGUAGE_LOCALE_SETTING_NAME = 'language-locale';

export const defaultLocale: LocaleType = 'en-US';
let currentLocale: LocaleType = defaultLocale;
export function setCurrentLocale(locale: LocaleType) {
    if (!checkIsValidLocale(locale)) {
        locale = defaultLocale;
    }
    setSetting(LANGUAGE_LOCALE_SETTING_NAME, locale);
    currentLocale = locale;
}
export function checkIsValidLangCode(text: string) {
    return langCodes.includes(text as any);
}
export function checkIsValidLocale(text: string) {
    return !!(allLocalesMap as any)[text];
}
export function getCurrentLocale(): LocaleType {
    const locale = getSetting(LANGUAGE_LOCALE_SETTING_NAME) ?? 'en-US';
    if (checkIsValidLocale(locale)) {
        return locale as LocaleType;
    }
    return 'en-US';
}

const cache = new Map<string, LanguageDataType | null>();
export function getLang(langCodeOrLocale: string) {
    // TODO: change to completely locale
    const langCode = checkIsValidLocale(langCodeOrLocale)
        ? getLangCode(langCodeOrLocale as any)
        : langCodeOrLocale;
    return cache.get(langCode ?? langCodeOrLocale) ?? null;
}

export function getLangDataByLocaleOrByLangCode(
    localeOrLangCode: string,
): LanguageDataType | null {
    return (
        langDataMap[localeOrLangCode] ??
        langDataMap[allLocalesMap[localeOrLangCode as LocaleType] ?? ''] ??
        null
    );
}

export async function getLangAsync(locale: LocaleType, isForce = false) {
    if (!cache.has(locale)) {
        try {
            const langData = getLangDataByLocaleOrByLangCode(locale);
            cache.set(locale, langData);
            let langCode = getLangCode(locale);
            if (langCode === null && isForce) {
                langCode = getLangCode(defaultLocale);
            }
            if (langCode === 'km' && langData !== null) {
                // TODO: implement downloadable lang package
                langData.dirPath = '/fonts/km/Battambang';
            }
            if (langCode !== null) {
                cache.set(langCode, langData);
                if (langData !== null) {
                    const elementID = `lang-${langCode}`;
                    let styleElement = document.querySelector(
                        `style#${elementID}`,
                    );
                    if (styleElement === null) {
                        styleElement = document.createElement('style');
                        styleElement.id = elementID;
                        document.head.appendChild(styleElement);
                    }
                    styleElement.innerHTML = langData.genCss();
                }
            }
        } catch (error) {
            handleError(error);
        }
    }
    return getLang(locale);
}
export function getCurrentLangAsync() {
    return getLangAsync(getCurrentLocale());
}
export function getAllLangsAsync() {
    return Object.values(langDataMap);
}

export function tran(text: string) {
    const langData = getLang(currentLocale);
    if (langData === null) {
        return text;
    }
    const dictionary = langData.dictionary;
    return dictionary[text] ?? text;
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
    const langData = await getLangAsync(locale);
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
    const langData = await getLangAsync(locale);
    if (langData === null) {
        return null;
    }
    const numList = langData.numList;
    return fromStringNum(numList, localeNum);
}

export async function sanitizePreviewText(locale: LocaleType, text: string) {
    let langData = await getLangAsync(locale);
    langData ??= await getLangAsync(defaultLocale);
    if (langData === null) {
        return text;
    }
    return langData.sanitizePreviewText(text);
}

export async function sanitizeFindingText(locale: LocaleType, text: string) {
    let langData = await getLangAsync(locale);
    langData ??= await getLangAsync(defaultLocale);
    if (langData === null) {
        return text;
    }
    return langData.sanitizeFindingText(text);
}

export function quickTrimText(locale: LocaleType, text: string) {
    const langData = getLang(locale);
    if (langData === null) {
        return text;
    }
    return langData.trimText(text);
}

export function checkIsStopWord(locale: LocaleType, text: string) {
    const langData = getLang(locale);
    if (langData === null) {
        return false;
    }
    return langData.stopWords.includes(text);
}

export function quickEndWord(locale: LocaleType, text: string) {
    const langData = getLang(locale);
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
    const langData = await getLangAsync(locale);
    if (langData === null) {
        return '';
    }
    return langData.fontFamily;
}

export function checkIsRtl(locale: LocaleType) {
    const langCode = getLangCode(locale);
    if (langCode === null) {
        return false;
    }
    return rtlLangs.includes(langCode as any);
}
