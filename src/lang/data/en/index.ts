import {
    DEFAULT_LANG_CODE,
    DEFAULT_LOCALE,
    genOpenLyricFontFaces,
    type LanguageDataType,
} from '../../langHelpers';

import bibleBooks from './bibleBooks.json';
import bbCR from './bb-cr.gz.bundle';
import locationsMapUrl from './location-name-map-data/locationsMap.json?url';
import namesMapUrl from './location-name-map-data/namesMap.json?url';
import { getFontFamilies } from '../../../server/fontHelpers';
import { handleError } from '../../../helper/errorHelpers';

const lang: LanguageDataType = {
    packageDir: __dirname,
    version: '0.0.1',
    locale: DEFAULT_LOCALE,
    langCode: DEFAULT_LANG_CODE,
    bibleBooks,
    checkIsThisLang: () => {
        return true;
    },
    genCss: () => {
        return '';
    },
    numList: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    dictionary: {},
    name: 'English',
    nativeName: 'English',
    flagSVG: `<svg xmlns="http://www.w3.org/2000/svg" id="flag-icons-gb" viewBox="0 0 640 480">
    <path fill="#012169" d="M0 0h640v480H0z"/>
    <path fill="#FFF" d="m75 0 244 181L562 0h78v62L400 241l240 178v61h-80L320 301 81 480H0v-60l239-178L0 64V0h75z"/>
    <path fill="#C8102E" d="m424 281 216 159v40L369 281h55zm-184 20 6 35L54 480H0l240-179zM640 0v3L391 191l2-44L590 0h50zM0 0l239 176h-60L0 42V0z"/>
    <path fill="#FFF" d="M241 0v480h160V0H241zM0 160v160h640V160H0z"/>
    <path fill="#C8102E" d="M0 193v96h640v-96H0zM273 0v480h96V0h-96z"/>
  </svg>
  `,
    sanitizeText: (text: string) => {
        return text;
    },
    sanitizePreviewText: (text: string) => {
        return text;
    },
    sanitizeFindingText: (text) => {
        return text
            .toLowerCase()
            .replaceAll(/[^a-z0-9 ]/g, ' ')
            .replaceAll(/\s+/g, ' ')
            .trim();
    },
    stopWords: [
        'a',
        'an',
        'and',
        'are',
        'as',
        'at',
        'be',
        'by',
        'for',
        'from',
        'has',
        'he',
        'in',
        'is',
        'it',
        'its',
        'of',
        'on',
        'that',
        'the',
        'to',
        'was',
        'were',
        'will',
        'with',
        'there',
        'before',
        'which',
    ],
    trimText: (text: string) => {
        return text.trim();
    },
    endWord: (text: string) => {
        return text + ' ';
    },
    extraBibleContextMenuItems: (_bibleItem, _appProvider) => {
        return [];
    },
    bibleAudioAvailable: true,
    sanitizeTranKey(key: string) {
        return key;
    },
    transformBibleBookName(bookName: string) {
        return [bookName];
    },
    getBibleCrossRefBundleFilePath(resolveGzBundleFilePath) {
        return resolveGzBundleFilePath(bbCR);
    },
    async getLookupDataVersion({ readJsonFileVersion }) {
        const [namesMap, locationsMap] = await Promise.all([
            readJsonFileVersion(namesMapUrl),
            readJsonFileVersion(locationsMapUrl),
        ]);
        if (namesMap === null || locationsMap === null) {
            return null;
        }
        return { namesMap, locationsMap };
    },
    async getLookupData({ readJsonFile }) {
        try {
            const namesMap = await readJsonFile(namesMapUrl);
            const locationsMap = await readJsonFile(locationsMapUrl);
            return { namesMap, locationsMap };
        } catch (error) {
            handleError(error);
            return null;
        }
    },
    initOpenLyricPlugins: ({ openLyric, openLyricMarkdownManager }) => {
        getFontFamilies().then((fontFamilies) => {
            if (openLyric !== undefined) {
                const newFontFaces = genOpenLyricFontFaces(
                    (openLyric.fontFaces as any) ?? [],
                    {
                        title: 'System',
                        fontFaces: fontFamilies,
                        indexRange: 2,
                    },
                );
                openLyric.fontFaces = newFontFaces;
            }
            if (openLyricMarkdownManager !== undefined) {
                const newFontFaces = genOpenLyricFontFaces(
                    (openLyricMarkdownManager.fontFaces as any) ?? [],
                    {
                        title: 'System',
                        fontFaces: fontFamilies,
                        indexRange: 2,
                    },
                );
                openLyricMarkdownManager.fontFaces = newFontFaces;
            }
        });
    },
};

export default lang;
