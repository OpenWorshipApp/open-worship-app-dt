// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    locale: 'en-US',
    isDev: true,
    send: vi.fn(),
    listen: vi.fn(),
    remove: vi.fn(),
    open: vi.fn(),
    cache: new Map<string, unknown>(),
    readerPaths: [] as string[],
    closed: vi.fn(),
    getVerse: vi.fn(() => ['GEN 1:1']),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: {
            get isDev() {
                return h.isDev;
            },
        },
        messageUtils: {
            sendData: h.send,
            listenForData: h.listen,
            removeListener: h.remove,
        },
        browserUtils: { openExternalURL: h.open },
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
    useAppStateAsync: () => [undefined],
    useAppEffect: vi.fn(),
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
vi.mock('./BibleCrossRefBundleReader', () => ({
    BibleCrossRefBundleReader: class {
        constructor(path: string) {
            h.readerPaths.push(path);
        }
        close() {
            h.closed();
        }
        getVerse = h.getVerse;
    },
}));
vi.mock('./gzBundleFilePath', () => ({
    resolveGzBundleFilePath: () => '/bundles/en.gz',
}));

import {
    checkHasLangPackage,
    findOtherLangPackage,
} from '../test-setup/langPackageDirs';
import {
    allLocalesMap,
    checkIsRtl,
    checkIsStopWord,
    checkIsValidLangCode,
    checkIsValidLocale,
    fromLocaleNum,
    fromStringNum,
    getCurrentLocale,
    getFontFamilyByLocale,
    getLangCode,
    getLangData,
    getLangDataAsync,
    getLangDataByCodeAsync,
    getLocalBibleCrossRef,
    initLangCss,
    quickEndWord,
    quickTrimText,
    registerLangAppMenuClicked,
    sanitizeFindingText,
    sanitizePreviewText,
    setAppMenuItems,
    setCurrentLocale,
    toLocaleNum,
    toStringNum,
    tran,
    type LocaleType,
} from './langHelpers';

beforeEach(() => {
    h.locale = 'en-US';
    h.isDev = true;
    h.send.mockClear();
    h.listen.mockClear();
    h.remove.mockClear();
    h.open.mockClear();
    h.cache.clear();
    h.readerPaths.length = 0;
    h.closed.mockClear();
    h.getVerse.mockClear();
});

test('locale validation and picker fallback keep the current locale usable', () => {
    // A code is valid when its package is installed: English always is,
    // and a code no package has never is.
    expect(checkIsValidLangCode('en')).toBe(true);
    expect(checkIsValidLangCode('xx')).toBe(false);
    expect(checkIsValidLocale('en-GB')).toBe(true);
    expect(checkIsValidLocale('made-up')).toBe(false);
    expect(getLangCode('fr-CA')).toBe('fr');
    expect(getLangCode('made-up' as LocaleType)).toBeNull();
    expect(checkIsRtl('ar-EG')).toBe(true);
    expect(checkIsRtl('en-US')).toBe(false);
    setCurrentLocale('fr-FR');
    expect(getCurrentLocale()).toBe('fr-FR');
    setCurrentLocale('made-up' as LocaleType);
    expect(getCurrentLocale()).toBe('en-US');
});

test('one English package serves multiple English locales and registers its CSS once', async () => {
    expect(await getLangDataByCodeAsync('unknown')).toBeNull();
    expect(await getLangDataAsync('unknown' as LocaleType)).toBeNull();
    const en = await getLangDataAsync('en-GB');
    expect(en?.langCode).toBe('en');
    expect(getLangData('en-GB')).toBe(en);
    expect(getLangData('en-US')).toBe(en);
    expect(await getLangDataByCodeAsync('en')).toBe(en);
    const style = document.querySelector('style#lang-en');
    expect(style).not.toBeNull();
    initLangCss(en!);
    expect(document.querySelectorAll('style#lang-en')).toHaveLength(1);
});

test('English search cleanup, word endings and number conversion use the loaded package', async () => {
    await getLangDataAsync('en-US');
    expect(await sanitizePreviewText('en-US', '  Hello  ')).toBe('  Hello  ');
    expect(await sanitizeFindingText('en-US', 'Hello, WORLD!')).toBe(
        'hello world',
    );
    expect(quickTrimText('en-US', '  Hello  ')).toBe('Hello');
    expect(quickEndWord('en-US', ' Hello ')).toBe('Hello ');
    expect(quickEndWord('en-US', '  ')).toBe('');
    expect(checkIsStopWord('en-US', 'the')).toBe(true);
    expect(checkIsStopWord('en-US', 'sanctuary')).toBe(false);
    expect(toStringNum(['⓪', '①', '②', '③'], 203)).toBe('②⓪③');
    expect(fromStringNum(['⓪', '①', '②', '③'], '②⓪③')).toBe(203);
    expect(fromStringNum(['⓪', '①'], 'words')).toBeNull();
    expect(await toLocaleNum('en-GB', 245)).toBe('245');
    expect(await fromLocaleNum('en-GB', '245')).toBe(245);
});

test('translation preserves English and interpolates fragments', () => {
    expect(tran('Save')).toBe('Save');
    expect(tran(['There are ', ' people'], 3)).toBe('There are 3 people');
    expect(tran(42)).toBe('42');
});

// A language found on disk whose data this window never loaded.
const otherPackage = findOtherLangPackage();
test.runIf(otherPackage !== null)(
    'a language on disk with its data unloaded throws in dev only',
    () => {
        h.locale = otherPackage!.locale as LocaleType;
        expect(() => tran('Missing key')).toThrow(
            `Language data for locale ${otherPackage!.locale}`,
        );
        h.isDev = false;
        expect(tran('Missing key')).toBe('Missing key');
    },
);

// A stored locale whose language is not on disk (deleted, or never there)
// reads as English, even in dev.
const absentLocale = Object.entries(allLocalesMap).find(([, langCode]) => {
    return langCode !== 'en' && !checkHasLangPackage(langCode);
})?.[0];
test('a language that is not on disk reads as English, even in dev', () => {
    expect(absentLocale).toBeDefined();
    h.locale = absentLocale as LocaleType;
    expect(tran('Missing key')).toBe('Missing key');
});

test('local cross-reference reader reuses one bundle and the menu listener cleans up', async () => {
    const verse = { bookKey: 'GEN', chapter: 1, verse: 1 };
    expect(await getLocalBibleCrossRef('en-US', verse)).toEqual(['GEN 1:1']);
    expect(await getLocalBibleCrossRef('en-GB', verse)).toEqual(['GEN 1:1']);
    expect(h.readerPaths).toEqual(['/bundles/en.gz']);
    expect(h.getVerse).toHaveBeenCalledWith('GEN', 1, 1);

    const stop = registerLangAppMenuClicked();
    expect(h.listen).toHaveBeenCalledWith(
        'app:main:menu-item-clicked',
        expect.any(Function),
    );
    const listener = h.listen.mock.calls.at(-1)![1];
    listener({}, { openExternalUrl: 'https://example.test/help' });
    expect(h.open).toHaveBeenCalledWith('https://example.test/help');
    stop();
    expect(h.remove).toHaveBeenCalledWith(
        'app:main:menu-item-clicked',
        listener,
    );
    setAppMenuItems('test', { help: [] });
    expect(h.send).toHaveBeenCalledWith('main:app:set-menu-items', {
        key: 'test',
        menusData: { help: [] },
        options: undefined,
    });
});

test('font lookup caches the package value for later requests', async () => {
    const first = await getFontFamilyByLocale('en-US');
    expect(h.cache.has('FontFamilyLocale:en-US')).toBe(true);
    expect(await getFontFamilyByLocale('en-US')).toBe(first);
});
