// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    checkHasLangPackage,
    listLangPackageCodes,
    toLangPackageDir,
} from '../test-setup/langPackageDirs';

// `langHelpers` against the REAL language packages, whichever are on disk:
// the shared CSS registration, the package list, and the fallbacks for a
// locale no package serves. A case about one language's own behaviour is in
// that package's `tests/lang/langHelpers.test.ts`. Its own app-side imports
// are mocked here, in this file only.
const h = vi.hoisted(() => {
    return {
        locale: 'en-US',
        isDev: true,
        sendData: vi.fn(),
        listenForData: vi.fn(),
        removeListener: vi.fn(),
        openExternalURL: vi.fn(),
        handleError: vi.fn(),
        cache: new Map<string, unknown>(),
        readers: [] as { path: string; isClosed: boolean }[],
        asyncState: undefined as unknown,
        asyncCalls: [] as { callee: () => unknown; deps: unknown[] }[],
    };
});

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: {
            get isDev() {
                return h.isDev;
            },
        },
        messageUtils: {
            sendData: (...args: unknown[]) => h.sendData(...args),
            listenForData: (...args: unknown[]) => h.listenForData(...args),
            removeListener: (...args: unknown[]) => h.removeListener(...args),
        },
        browserUtils: {
            openExternalURL: (url: string) => h.openExternalURL(url),
        },
    },
}));
vi.mock('../helper/SettingManager', () => ({
    default: class {
        getSetting() {
            return h.locale;
        }
        setSetting(value: string) {
            h.locale = value;
        }
    },
}));
vi.mock('../helper/appHooks', () => ({
    useAppStateAsync: (callee: () => unknown, deps: unknown[]) => {
        h.asyncCalls.push({ callee, deps });
        return [h.asyncState];
    },
}));
vi.mock('../server/unlockingHelpers', () => ({
    unlocking: async (_key: string, run: () => Promise<unknown>) => run(),
}));
vi.mock('../others/CacheManager', () => ({
    globalCacheManager10Seconds: {
        get: async (key: string) => h.cache.get(key),
        set: async (key: string, value: unknown) => {
            h.cache.set(key, value);
        },
    },
}));
vi.mock('../server/fontHelpers', () => ({ getFontFamilies: async () => [] }));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('./BibleCrossRefBundleReader', () => ({
    BibleCrossRefBundleReader: class {
        record: { path: string; isClosed: boolean };
        constructor(path: string) {
            this.record = { path, isClosed: false };
            h.readers.push(this.record);
        }
        close() {
            this.record.isClosed = true;
        }
        getVerse(bookKey: string, chapter: number, verse: number) {
            return [`${this.record.path}#${bookKey} ${chapter}:${verse}`];
        }
    },
}));
vi.mock('./gzBundleFilePath', () => ({
    resolveGzBundleFilePath: (bundle: { filePath: string }) => {
        return bundle.filePath;
    },
}));

import {
    allLocalesMap,
    checkIsRtl,
    checkIsStopWord,
    fromLocaleNum,
    genOpenLyricFontFaces,
    getAllLangsAsync,
    getBookMarkerWords,
    getFindFrameWords,
    getFontFamilyByLocale,
    getLangData,
    getLangDataAsync,
    getLanguageTitle,
    getLocalBibleCrossRef,
    initAllLangCss,
    quickEndWord,
    quickTrimText,
    sanitizeFindingText,
    sanitizePreviewText,
    toLocaleNum,
    type LocaleType,
} from './langHelpers';
import { reloadLangPlugins } from './langPluginRegistry';

const UNKNOWN = 'made-up' as LocaleType;

// The packages on disk, in the language picker's order: English first, then
// by their `meta.json` order, then by code.
const PACKAGE_LIST = listLangPackageCodes()
    .map((langCode) => {
        const meta = JSON.parse(
            readFileSync(
                path.join(toLangPackageDir(langCode), 'meta.json'),
                'utf-8',
            ),
        ) as { locale: string; order?: number };
        return { langCode, locale: meta.locale, order: meta.order };
    })
    .sort((a, b) => {
        if (a.langCode === 'en' || b.langCode === 'en') {
            return a.langCode === 'en' ? -1 : 1;
        }
        return (
            (a.order ?? Number.MAX_SAFE_INTEGER) -
                (b.order ?? Number.MAX_SAFE_INTEGER) ||
            a.langCode.localeCompare(b.langCode)
        );
    });

// A real locale of the world table whose language has no package on disk.
const NO_PACKAGE_LOCALE = (Object.keys(allLocalesMap) as LocaleType[]).find(
    (locale) => {
        return (
            locale.includes('-') && !checkHasLangPackage(allLocalesMap[locale])
        );
    },
)!;

beforeEach(async () => {
    h.locale = 'en-US';
    h.isDev = true;
    h.cache.clear();
    h.readers.length = 0;
    h.asyncState = undefined;
    h.asyncCalls.length = 0;
    await getLangDataAsync('en-US');
});

describe('initAllLangCss', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    // First in the file: the registration is shared for the whole window once
    // it succeeds, so its retry can only be seen before that.
    test('forgets a failed registration, then registers every language once', async () => {
        // Every package imported first: a package's own module (an Open
        // Lyric plugin) may read the document while it loads, and the one
        // read that fails here must be the registration's.
        await getAllLangsAsync();
        const querySelector = document.querySelector.bind(document);
        vi.spyOn(document, 'querySelector').mockImplementationOnce(() => {
            throw new Error('document is gone');
        });
        await expect(initAllLangCss()).rejects.toThrow('document is gone');

        vi.mocked(document.querySelector).mockImplementation(querySelector);
        // Each style has to be written by the registration itself.
        document.head
            .querySelectorAll('style[id^="lang-"]')
            .forEach((style) => {
                style.remove();
            });
        const retry = initAllLangCss();
        const allLangData = await retry;
        expect(
            allLangData.map((langData) => {
                return langData.langCode;
            }),
        ).toEqual(
            PACKAGE_LIST.map(({ langCode }) => {
                return langCode;
            }),
        );
        for (const langData of allLangData) {
            const styleList = document.head.querySelectorAll(
                `style#lang-${langData.langCode}`,
            );
            expect(styleList).toHaveLength(1);
            expect(styleList[0].innerHTML).toBe(langData.genCss());
        }
        // Shared from now on: no second rewrite of the font faces.
        expect(initAllLangCss()).toBe(retry);
        // ...until the languages are read again (one installed, turned on
        // or off): the font lists must hold every ENABLED package. Read
        // once, the callers meanwhile sharing it.
        await reloadLangPlugins();
        const again = initAllLangCss();
        expect(again).not.toBe(retry);
        expect(initAllLangCss()).toBe(again);
        await again;
        expect(initAllLangCss()).toBe(again);
        // Every package there is is loaded: past the 10 s default while the
        // whole suite holds every core.
    }, 60_000);
});

describe('the language package cache', () => {
    test('keeps nothing for a language that has no package', async () => {
        expect(await getLangDataAsync(NO_PACKAGE_LOCALE)).toBeNull();
        expect(getLangData(NO_PACKAGE_LOCALE)).toBeNull();
        expect(getLangData(allLocalesMap[NO_PACKAGE_LOCALE])).toBeNull();
        expect(await getLangDataAsync(UNKNOWN)).toBeNull();
        expect(getLangData(UNKNOWN)).toBeNull();
    });
    test('getAllLangsAsync loads every supported package in order', async () => {
        const all = await getAllLangsAsync();
        expect(
            all.map((langData) => {
                return langData.locale;
            }),
        ).toEqual(
            PACKAGE_LIST.map(({ locale }) => {
                return locale;
            }),
        );
    }, 60_000);
});

describe('numbers and text for a locale with no package', () => {
    test('a locale with no package keeps plain digits', async () => {
        expect(await toLocaleNum(UNKNOWN, 7)).toBe('7');
        expect(await fromLocaleNum(UNKNOWN, '7')).toBeNull();
    });
    test('an unknown locale is cleaned with the English rules', async () => {
        expect(await sanitizePreviewText(UNKNOWN, ' A b ')).toBe(' A b ');
        expect(await sanitizeFindingText(UNKNOWN, 'Hello, WORLD!')).toBe(
            'hello world',
        );
    });
    test('a locale with no package leaves words as they are', () => {
        expect(quickTrimText(UNKNOWN, ' x ')).toBe(' x ');
        expect(quickEndWord(UNKNOWN, ' x ')).toBe(' x ');
        expect(checkIsStopWord(UNKNOWN, 'the')).toBe(false);
        expect(getBookMarkerWords(UNKNOWN)).toEqual([]);
        expect(getFindFrameWords(UNKNOWN)).toEqual([]);
        expect(checkIsRtl(UNKNOWN)).toBe(false);
    });
});

describe('fonts per locale', () => {
    test('a locale with no package has no font, and nothing is kept', async () => {
        expect(await getFontFamilyByLocale(UNKNOWN)).toBeUndefined();
        expect(h.cache.has(`FontFamilyLocale:${UNKNOWN}`)).toBe(false);
    });
});

describe('getLanguageTitle', () => {
    test('nothing to name is Unknown', () => {
        expect(getLanguageTitle({})).toBe('Unknown');
        expect(getLanguageTitle({ locale: undefined, langCode: null })).toBe(
            'Unknown',
        );
    });
    test('an empty code beside a locale is Unknown, with the locale when asked', () => {
        expect(
            getLanguageTitle(
                { locale: 'qqq' as LocaleType, langCode: '' },
                true,
            ),
        ).toBe('Unknown <qqq>');
    });
});

describe('getLocalBibleCrossRef', () => {
    const verse = { bookKey: 'JHN', chapter: 3, verse: 16 };

    test('a locale with no package has no cross references', async () => {
        expect(await getLocalBibleCrossRef(UNKNOWN, verse)).toBeNull();
        expect(h.readers).toHaveLength(0);
    });
});

describe('genOpenLyricFontFaces', () => {
    test('adds a group and keeps the groups in index order', () => {
        expect(
            genOpenLyricFontFaces(
                [
                    { title: 'System', fontFaces: ['Arial'], indexRange: 3 },
                    { title: 'Default', fontFaces: ['serif'], indexRange: 0 },
                ],
                {
                    title: 'Extra',
                    fontFaces: ['app-xx-face'],
                    indexRange: 2,
                },
            ).map((item) => {
                return item.title;
            }),
        ).toEqual(['Default', 'Extra', 'System']);
    });

    test('replaces a group of the same title instead of adding a second one', () => {
        expect(
            genOpenLyricFontFaces(
                [{ title: 'Extra', fontFaces: ['old-face'], indexRange: 2 }],
                {
                    title: 'Extra',
                    fontFaces: ['app-xx-face'],
                    indexRange: 2,
                },
            ),
        ).toEqual([
            { title: 'Extra', fontFaces: ['app-xx-face'], indexRange: 2 },
        ]);
    });
});
