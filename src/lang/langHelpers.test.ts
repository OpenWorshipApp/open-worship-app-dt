// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const cacheStore = new Map<string, unknown>();
    const hookState = { value: 'hook-font-family' as string | undefined };
    const appProviderMock = {
        systemUtils: {
            isDev: false,
        },
    };

    return {
        appProviderMock,
        cacheStore,
        hookState,
        cacheGetMock: vi.fn(async (key: string) => {
            return cacheStore.get(key);
        }),
        cacheSetMock: vi.fn(async (key: string, value: unknown) => {
            cacheStore.set(key, value);
        }),
        unlockingMock: vi.fn(
            async (_key: string, callback: () => unknown) => await callback(),
        ),
        useAppStateAsyncMock: vi.fn(() => [hookState.value]),
    };
});

vi.mock('../server/appProvider', () => ({
    default: mocks.appProviderMock,
}));

vi.mock('../server/unlockingHelpers', () => ({
    unlocking: mocks.unlockingMock,
}));

vi.mock('../others/CacheManager', () => ({
    globalCacheManager1M: {
        get: mocks.cacheGetMock,
        set: mocks.cacheSetMock,
    },
}));

vi.mock('../helper/debuggerHelpers', () => ({
    useAppStateAsync: mocks.useAppStateAsyncMock,
}));

async function loadLangHelpers() {
    return await import('./langHelpers');
}

describe('langHelpers', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        vi.doUnmock('./data/en/index.ts');
        vi.doUnmock('./data/km/index.ts');
        localStorage.clear();
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        mocks.cacheStore.clear();
        mocks.hookState.value = 'hook-font-family';
        mocks.appProviderMock.systemUtils.isDev = false;
        mocks.useAppStateAsyncMock.mockImplementation(() => {
            return [mocks.hookState.value];
        });
        mocks.unlockingMock.mockImplementation(
            async (_key: string, callback: () => unknown) => {
                return await callback();
            },
        );
        mocks.cacheGetMock.mockImplementation(async (key: string) => {
            return mocks.cacheStore.get(key);
        });
        mocks.cacheSetMock.mockImplementation(
            async (key: string, value: unknown) => {
                mocks.cacheStore.set(key, value);
            },
        );
    });

    test('validates locale helpers and current locale storage', async () => {
        const {
            DEFAULT_LOCALE,
            reversedLocalesMap,
            checkIsValidLangCode,
            checkIsValidLocale,
            getCurrentLocale,
            getLangCode,
            setCurrentLocale,
        } = await loadLangHelpers();

        expect(DEFAULT_LOCALE).toBe('en-US');
        expect(getLangCode('km-KH')).toBe('km');
        expect(getLangCode('missing-locale' as any)).toBeNull();
        expect(reversedLocalesMap.km).toBe('km-KH');
        expect(checkIsValidLangCode('km')).toBe(true);
        expect(checkIsValidLangCode('fr')).toBe(false);
        expect(checkIsValidLocale('en-US')).toBe(true);
        expect(checkIsValidLocale('missing-locale')).toBe(false);
        expect(getCurrentLocale()).toBe('en-US');

        localStorage.setItem('language-locale', 'missing-locale');
        expect(getCurrentLocale()).toBe('en-US');

        setCurrentLocale('km-KH');
        expect(localStorage.getItem('language-locale')).toBe('km-KH');

        setCurrentLocale('missing-locale' as any);
        expect(localStorage.getItem('language-locale')).toBe('en-US');
    });

    test('loads language data, caches it, and injects css once', async () => {
        const { getLangData, getLangDataAsync } = await loadLangHelpers();

        const langData = await getLangDataAsync('km-KH');

        expect(langData?.langCode).toBe('km');
        expect(langData?.fontFamily).toBe('km-font-family');
        expect(getLangData('km-KH')).toBe(langData);
        expect(getLangData('km')).toBe(langData);
        expect(document.head.querySelectorAll('style#lang-km')).toHaveLength(1);
        expect(document.head.querySelector('style#lang-km')?.innerHTML).toContain(
            'km-font-family',
        );

        const cachedLangData = await getLangDataAsync('km-KH');

        expect(cachedLangData).toBe(langData);
        expect(document.head.querySelectorAll('style#lang-km')).toHaveLength(1);
    });

    test('returns all included languages and skips missing locale modules', async () => {
        const { getAllLangsAsync, getLangData, getLangDataAsync } =
            await loadLangHelpers();

        expect(await getLangDataAsync('fr-FR' as any)).toBeNull();
        expect(await getLangDataAsync('missing-locale' as any)).toBeNull();
        expect(getLangData('fr-FR')).toBeNull();

        const langs = await getAllLangsAsync();

        expect(langs).toHaveLength(2);
        expect(
            langs
                .map((lang) => lang.langCode)
                .sort((left, right) => left.localeCompare(right)),
        ).toEqual(['en', 'km']);
    });

    test('translates values, preserves outer spacing, and supports template arrays', async () => {
        const { getLangDataAsync, setCurrentLocale, tran } =
            await loadLangHelpers();

        expect(tran('Open PPTX')).toBe('Open PPTX');

        await getLangDataAsync('km-KH');
        setCurrentLocale('km-KH');

        expect(tran('Open PPTX')).toBe('បើក PPTX');
        expect(tran('x')).toBe('x');
        expect(tran(' Open PPTX ')).toBe(' បើក PPTX ');
        expect(
            tran(['Open PPTX', 'No Compatible Update Found'], '', ' :: '),
        ).toBe('បើក PPTX :: មិនមានការធ្វើបច្ចុប្បន្នភាពដែលអាចប្រើបាន');
        expect(tran(123)).toBe('123');
    });

    test('handles missing language data and missing translations in dev and non-dev modes', async () => {
        const { getLangDataAsync, setCurrentLocale, tran } =
            await loadLangHelpers();

        setCurrentLocale('km-KH');
        expect(tran('Open PPTX')).toBe('Open PPTX');

        mocks.appProviderMock.systemUtils.isDev = true;
        expect(() => tran('Open PPTX')).toThrow(
            'Language data for locale km-KH not found when translating text.',
        );

        mocks.appProviderMock.systemUtils.isDev = false;
        await getLangDataAsync('km-KH');
        expect(tran('Missing Phrase')).toBe('Missing Phrase');

        mocks.appProviderMock.systemUtils.isDev = true;
        expect(() => tran('Missing Phrase')).toThrow(
            'Translation for text "Missing Phrase" not found in locale km-KH.',
        );
    });

    test('covers nested translation lookup branches with a custom language module', async () => {
        vi.doMock('./data/km/index.ts', () => ({
            default: {
                locale: 'km-KH',
                langCode: 'km',
                genCss: () => '',
                numList: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
                dictionary: {
                    A: 'Alpha',
                    ' Open PPTX ': 'Outer Translation',
                },
                name: 'Mock Khmer',
                flagSVG: '',
                sanitizeText: (text: string) => text,
                sanitizePreviewText: (text: string) => text,
                sanitizeFindingText: (text: string) => text,
                stopWords: [],
                trimText: (text: string) => text.trim(),
                endWord: (text: string) => `${text}!`,
                extraBibleContextMenuItems: () => [],
                bibleAudioAvailable: false,
                sanitizeTranKey: (key: string) => key,
                transformBibleBookName: (bookName: string) => [bookName],
            },
        }));

        const { getLangDataAsync, setCurrentLocale, tran } =
            await loadLangHelpers();

        await getLangDataAsync('km-KH');
        setCurrentLocale('km-KH');

        expect(tran('A')).toBe('Alpha');
        expect(tran(' Open PPTX ')).toBe(' Open PPTX ');

        mocks.appProviderMock.systemUtils.isDev = true;
        expect(() => tran(' Open PPTX ')).toThrow(
            'Translation for text "Open PPTX" not found in locale km-KH.',
        );
    });

    test('converts numbers to and from locale digits', async () => {
        const { fromLocaleNum, fromStringNum, toLocaleNum, toStringNum } =
            await loadLangHelpers();

        expect(
            toStringNum(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'], 907),
        ).toBe('jah');
        expect(await toLocaleNum('km-KH', 907)).toBe('៩០៧');
        expect(await toLocaleNum('fr-FR' as any, 42)).toBe('42');
        expect(
            fromStringNum(['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'], '៩០៧'),
        ).toBe(907);
        expect(fromStringNum(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], 'abc')).toBeNull();
        expect(await fromLocaleNum('km-KH', '៩០៧')).toBe(907);
        expect(await fromLocaleNum('fr-FR' as any, '42')).toBeNull();
    });

    test('sanitizes preview and finding text and uses cached language helpers when available', async () => {
        const {
            checkIsStopWord,
            getLangDataAsync,
            quickEndWord,
            quickTrimText,
            sanitizeFindingText,
            sanitizePreviewText,
        } = await loadLangHelpers();

        await getLangDataAsync('km-KH');

        expect(await sanitizePreviewText('km-KH', ' ក ខ​ ')).toBe('កខ');
        expect(await sanitizeFindingText('km-KH', 'កa ខ1')).toBe('ក ខ');
        expect(await sanitizePreviewText('fr-FR' as any, ' A B ')).toBe(' A B ');
        expect(await sanitizeFindingText('fr-FR' as any, 'Hello, World!')).toBe(
            'hello world',
        );
        expect(quickTrimText('km-KH', ' ​សួស្តី​ ')).toBe('សួស្តី');
        expect(quickTrimText('fr-FR' as any, ' x ')).toBe(' x ');
        expect(checkIsStopWord('en-US', 'and')).toBe(true);
        expect(checkIsStopWord('fr-FR' as any, 'and')).toBe(false);
        expect(quickEndWord('km-KH', ' ​សួស្តី​ ')).toBe('សួស្តី​');
        expect(quickEndWord('km-KH', '   ')).toBe('');
        expect(quickEndWord('fr-FR' as any, ' x ')).toBe(' x ');
    });

    test('returns the original text when fallback language data is also unavailable', async () => {
        vi.doMock('./data/en/index.ts', () => ({
            default: null,
        }));

        const { sanitizeFindingText, sanitizePreviewText } =
            await loadLangHelpers();

        expect(await sanitizePreviewText('fr-FR' as any, ' A B ')).toBe(' A B ');
        expect(await sanitizeFindingText('fr-FR' as any, 'Hello, World!')).toBe(
            'Hello, World!',
        );
    });

    test('caches font family lookups and formats rtl and language titles', async () => {
        const {
            checkIsRtl,
            getFontFamilyByLocale,
            getLanguageTitle,
            useFontFamilyByLocale,
        } = await loadLangHelpers();

        expect(await getFontFamilyByLocale('km-KH')).toBe('km-font-family');
        expect(mocks.cacheSetMock).toHaveBeenCalledWith(
            'FontFamilyLocale:km-KH',
            'km-font-family',
        );

        mocks.cacheSetMock.mockClear();
        expect(await getFontFamilyByLocale('km-KH')).toBe('km-font-family');
        expect(mocks.cacheSetMock).not.toHaveBeenCalled();
        expect(await getFontFamilyByLocale('fr-FR' as any)).toBeUndefined();

        mocks.hookState.value = 'hook-value';
        mocks.useAppStateAsyncMock.mockImplementation((getter: () => unknown) => {
            getter();
            return [mocks.hookState.value];
        });
        expect(useFontFamilyByLocale('km-KH')).toBe('hook-value');
        expect(mocks.useAppStateAsyncMock).toHaveBeenCalledTimes(1);
        expect(checkIsRtl('ar-SA')).toBe(true);
        expect(checkIsRtl('km-KH')).toBe(false);
        expect(checkIsRtl('missing-locale' as any)).toBe(false);
        expect(getLanguageTitle({})).toBe('Unknown');
        expect(getLanguageTitle({ langCode: 'km' })).toBe('Khmer (ភាសាខ្មែរ)');
        expect(getLanguageTitle({ locale: 'km-KH' }, true)).toBe(
            'Khmer (ភាសាខ្មែរ) <km-KH>',
        );
        expect(getLanguageTitle({ langCode: 'zz' })).toBe('Unknown');
    });
});
