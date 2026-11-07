// @vitest-environment jsdom

import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

// `langHelpers` against the REAL Khmer package: `tran` translating and
// throwing, the package cache, Khmer digits and text helpers, its font, its
// name, its cross-reference bundle and its Tools menu. Moved here from
// `src/lang/langHelpers.packages.test.ts`, which keeps the cases every package
// shares. Its own app-side imports are mocked here, in this file only.
const h = vi.hoisted(() => {
    return {
        locale: 'km-KH',
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

vi.mock('../../../../../../server/appProvider', () => ({
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
vi.mock('../../../../../../helper/SettingManager', () => ({
    default: class {
        getSetting() {
            return h.locale;
        }
        setSetting(value: string) {
            h.locale = value;
        }
    },
}));
vi.mock('../../../../../../helper/appHooks', () => ({
    useAppStateAsync: (callee: () => unknown, deps: unknown[]) => {
        h.asyncCalls.push({ callee, deps });
        return [h.asyncState];
    },
}));
vi.mock('../../../../../../server/unlockingHelpers', () => ({
    unlocking: async (_key: string, run: () => Promise<unknown>) => run(),
}));
vi.mock('../../../../../../others/CacheManager', () => ({
    globalCacheManager10Seconds: {
        get: async (key: string) => h.cache.get(key),
        set: async (key: string, value: unknown) => {
            h.cache.set(key, value);
        },
    },
}));
vi.mock('../../../../../../server/fontHelpers', () => ({
    getFontFamilies: async () => [],
}));
vi.mock('../../../../../../helper/errorHelpers', () => ({
    handleError: h.handleError,
}));
vi.mock('../../../../../BibleCrossRefBundleReader', () => ({
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
vi.mock('../../../../../gzBundleFilePath', () => ({
    resolveGzBundleFilePath: (bundle: { filePath: string }) => {
        return bundle.filePath;
    },
}));

import {
    checkIsStopWord,
    ensureLangPlugins,
    fromLocaleNum,
    getBookMarkerWords,
    getFindFrameWords,
    getFontFamilyByLocale,
    getLangData,
    getLangDataAsync,
    getLanguageTitle,
    getLocalBibleCrossRef,
    initLangAppMenu,
    quickEndWord,
    quickTrimText,
    sanitizeFindingText,
    sanitizePreviewText,
    toLocaleNum,
    tran,
    useFontFamilyByLocale,
} from '../../../../../langHelpers';

const ZWSP = '​';

// The first load builds the package from its folder -- the dictionary, the
// fonts, the song plugin -- which took past the 10 s hook default with the
// whole suite holding every core; every load after it is the cached one.
beforeAll(async () => {
    await getLangDataAsync('km-KH');
}, 60000);

beforeEach(async () => {
    h.locale = 'km-KH';
    h.isDev = true;
    h.cache.clear();
    h.readers.length = 0;
    h.asyncState = undefined;
    h.asyncCalls.length = 0;
    await getLangDataAsync('km-KH');
});

describe('tran in Khmer', () => {
    test('translates a label, whatever its case', () => {
        expect(tran('Reader')).toBe('អានព្រះគម្ពីរ');
        expect(tran('reader')).toBe('អានព្រះគម្ពីរ');
    });

    test('keeps the spaces and line breaks around a label', () => {
        expect(tran('  Reader \n')).toBe('  អានព្រះគម្ពីរ \n');
    });

    test('translates a label too short to have padding', () => {
        expect(tran('No')).toBe('ទេ');
        expect(tran('Ok')).toBe('យល់ព្រម');
    });

    test('joins translated fragments around their values', () => {
        expect(tran(['Ok', 'No'], ' / ')).toBe('យល់ព្រម / ទេ');
    });

    test('throws in dev on a label with no Khmer', () => {
        expect(() => tran('A label nobody translated')).toThrow(
            'Translation for text "A label nobody translated" not found in ' +
                'locale km-KH.',
        );
    });

    test('falls back to the English label in a packaged build', () => {
        h.isDev = false;
        expect(tran('A label nobody translated')).toBe(
            'A label nobody translated',
        );
    });
});

describe('the language package cache', () => {
    test('answers a locale and its code with the one Khmer package', async () => {
        const khmer = await getLangDataAsync('km-KH');
        expect(khmer?.langCode).toBe('km');
        expect(await getLangDataAsync('km-KH')).toBe(khmer);
        expect(getLangData('km')).toBe(khmer);
        expect(getLangData('km-KH')).toBe(khmer);
    });
});

describe('Khmer numbers and text', () => {
    test('converts numbers to and from Khmer digits', async () => {
        expect(await toLocaleNum('km-KH', 2026)).toBe('២០២៦');
        expect(await fromLocaleNum('km-KH', '២០២៦')).toBe(2026);
        expect(await fromLocaleNum('km-KH', 'ខ')).toBeNull();
    });
    test('cleans preview and finding text with the Khmer rules', async () => {
        expect(await sanitizePreviewText('km-KH', `ក ខ${ZWSP}`)).toBe('កខ');
        expect(await sanitizeFindingText('km-KH', 'ព្រះ, យេស៊ូ!')).toBe(
            'ព្រះ យេស៊ូ',
        );
    });
    test('trims and ends Khmer words with the zero-width space', () => {
        expect(quickTrimText('km-KH', ` ${ZWSP}សួស្តី${ZWSP} `)).toBe('សួស្តី');
        expect(quickEndWord('km-KH', ' សួស្តី ')).toBe(`សួស្តី${ZWSP}`);
        expect(quickEndWord('km-KH', ` ${ZWSP} `)).toBe('');
    });
    test('reads the Khmer Bible search words', () => {
        expect(checkIsStopWord('km-KH', 'និង')).toBe(true);
        expect(checkIsStopWord('km-KH', 'ព្រះ')).toBe(false);
        expect(getBookMarkerWords('km-KH')).toContain('ក្នុង');
        expect(getFindFrameWords('km-KH')).toContain('ស្វែងរក');
    });
});

describe('fonts per locale', () => {
    test('answers the Khmer font and keeps it for the next ask', async () => {
        expect(await getFontFamilyByLocale('km-KH')).toBe('app-Battambang');
        expect(h.cache.get('FontFamilyLocale:km-KH')).toBe('app-Battambang');
        h.cache.set('FontFamilyLocale:km-KH', 'cached-face');
        expect(await getFontFamilyByLocale('km-KH')).toBe('cached-face');
    });
    test('useFontFamilyByLocale reads it per locale', async () => {
        h.asyncState = 'app-Battambang';
        expect(useFontFamilyByLocale('km-KH')).toBe('app-Battambang');
        const [{ callee, deps }] = h.asyncCalls;
        expect(deps).toEqual(['km-KH']);
        await expect(callee()).resolves.toBe('app-Battambang');

        h.asyncState = null;
        expect(useFontFamilyByLocale('km-KH')).toBeUndefined();
    });
});

describe('getLanguageTitle', () => {
    // The app's own table is English; Khmer's own name for itself is the
    // installed Khmer's (its `meta.json`), here the package of the checkout.
    test('names Khmer from its code or its locale, in its own words once installed', async () => {
        await ensureLangPlugins();
        expect(getLanguageTitle({ langCode: 'km' })).toBe('Khmer (ខ្មែរ)');
        expect(getLanguageTitle({ locale: 'km-KH' })).toBe('Khmer (ខ្មែរ)');
        expect(getLanguageTitle({ locale: 'km-KH' }, true)).toBe(
            'Khmer (ខ្មែរ) <km-KH>',
        );
    });
});

describe('getLocalBibleCrossRef', () => {
    const verse = { bookKey: 'JHN', chapter: 3, verse: 16 };

    test('keeps one bundle open, and closes it for another language', async () => {
        const [khmer] = (await getLocalBibleCrossRef('km-KH', verse))!;
        expect(khmer).toMatch(/km\/bb-cr\.gz\.bundle#JHN 3:16$/);
        await getLocalBibleCrossRef('km-KH', verse);
        expect(h.readers).toHaveLength(1);

        const [english] = (await getLocalBibleCrossRef('en-US', verse))!;
        expect(english).toMatch(/en\/bb-cr\.gz\.bundle#JHN 3:16$/);
        expect(h.readers).toHaveLength(2);
        expect(h.readers[0].isClosed).toBe(true);
        expect(h.readers[1].isClosed).toBe(false);
    });
});

describe('initLangAppMenu', () => {
    test('contributes the Khmer Tools links to the Tools menu', async () => {
        await initLangAppMenu();
        expect(h.sendData).toHaveBeenCalledOnce();
        const [channel, payload] = h.sendData.mock.calls[0] as any[];
        expect(channel).toBe('main:app:set-menu-items');
        expect(payload.key).toBe('lang');
        expect(payload.options).toBeUndefined();
        const khmerTools = payload.menusData.tools.find((item: any) => {
            return item.label === 'Khmer Tools';
        });
        expect(
            khmerTools.submenu.map((item: any) => {
                return [item.label, item.clickData.openExternalUrl];
            }),
        ).toEqual([
            ['Editor', 'https://editor-km.openworship.app'],
            ['Open Lyric', 'https://lyric-km.openworship.app'],
            ['BibleNote', 'https://biblenote-km.openworship.app'],
        ]);
    });
});
