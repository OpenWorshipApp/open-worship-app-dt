// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const cacheStores: Map<string, unknown>[] = [];
    const globalCacheStore = new Map<string, unknown>();
    const titleTextMap = new Map<string, any>();

    class MockCacheManager<T> {
        private readonly store = new Map<string, T>();

        constructor(_ttl: number) {
            cacheStores.push(this.store as Map<string, unknown>);
        }

        async get(key: string) {
            return this.store.has(key) ? this.store.get(key) : null;
        }

        async has(key: string) {
            return this.store.has(key);
        }

        async set(key: string, value: T) {
            this.store.set(key, value);
        }
    }

    class MockBibleItem {
        bibleKey: string;
        target: {
            bookKey: string;
            chapter: number;
            verseEnd: number;
            verseStart: number;
        };
        private readonly titleOverride?: string;

        constructor(
            bibleKey: string,
            bookKey: string,
            chapter: number,
            verseStart: number,
            verseEnd: number,
            titleOverride?: string,
        ) {
            this.bibleKey = bibleKey;
            this.target = { bookKey, chapter, verseEnd, verseStart };
            this.titleOverride = titleOverride;
        }

        async toTitle() {
            return (
                this.titleOverride ??
                `${this.target.bookKey} ${this.target.chapter}:${this.target.verseStart}-${this.target.verseEnd}`
            );
        }
    }

    const buildBibleItem = (
        bibleKey: string,
        bookKey: string,
        chapter: number,
        verseStart: number,
        verseEnd: number,
        titleOverride?: string,
    ) =>
        new MockBibleItem(
            bibleKey,
            bookKey,
            chapter,
            verseStart,
            verseEnd,
            titleOverride,
        );

    const fromDataMock = vi.fn(
        (
            bibleKey: string,
            bookKey: string,
            chapter: number,
            verseStart: number,
            verseEnd: number,
        ) => buildBibleItem(bibleKey, bookKey, chapter, verseStart, verseEnd),
    );
    const fromTitleTextMock = vi.fn(
        async (bibleKey: string, titleText: string) => {
            return titleTextMap.get(`${bibleKey}:${titleText}`) ?? null;
        },
    );

    return {
        MockCacheManager,
        appLogMock: vi.fn(),
        bookToKeyMock: vi.fn(),
        buildBibleItem,
        cacheStores,
        fromDataMock,
        fromLocaleNumMock: vi.fn(),
        fromStringNumMock: vi.fn(),
        fromTitleTextMock,
        getAllLocalBibleInfoListMock: vi.fn(),
        getBibleInfoMock: vi.fn(),
        getBibleModelInfoMock: vi.fn(),
        getChapterDataMock: vi.fn(),
        getFontFamilyByLocaleMock: vi.fn(),
        getLangDataAsyncMock: vi.fn(),
        getModelChapterCountMock: vi.fn(),
        getSettingMock: vi.fn(),
        getVersesMock: vi.fn(),
        globalCacheManager1M: {
            get: vi.fn(async (key: string) => {
                return globalCacheStore.has(key)
                    ? globalCacheStore.get(key)
                    : null;
            }),
            has: vi.fn(async (key: string) => globalCacheStore.has(key)),
            set: vi.fn(async (key: string, value: unknown) => {
                globalCacheStore.set(key, value);
            }),
        },
        globalCacheStore,
        keyToBookMock: vi.fn(),
        reset() {
            cacheStores.length = 0;
            globalCacheStore.clear();
            titleTextMap.clear();
        },
        setSettingMock: vi.fn(),
        titleTextMap,
        toLocaleNumMock: vi.fn(),
        toStringNumMock: vi.fn(),
        toVerseFullKeyFormatMock: vi.fn(
            (bookKey: string, chapter: number, verseStart: number | string) => {
                return `${bookKey} ${chapter}:${verseStart}`;
            },
        ),
        unlockingMock: vi.fn(
            async (_key: string, callback: () => Promise<unknown>) => {
                return callback();
            },
        ),
    };
});

vi.mock('./bibleInfoHelpers', () => ({
    bookToKey: mocks.bookToKeyMock,
    getBibleInfo: mocks.getBibleInfoMock,
    getChapterData: mocks.getChapterDataMock,
    getVerses: mocks.getVersesMock,
    keyToBook: mocks.keyToBookMock,
    toVerseFullKeyFormat: mocks.toVerseFullKeyFormatMock,
}));

vi.mock('../../lang/langHelpers', () => ({
    DEFAULT_LOCALE: 'en-US',
    fromLocaleNum: mocks.fromLocaleNumMock,
    fromStringNum: mocks.fromStringNumMock,
    getFontFamilyByLocale: mocks.getFontFamilyByLocaleMock,
    getLangDataAsync: mocks.getLangDataAsyncMock,
    toLocaleNum: mocks.toLocaleNumMock,
    toStringNum: mocks.toStringNumMock,
}));

vi.mock('../debuggerHelpers', async () => {
    const React = await import('react');
    return {
        useAppEffect: React.useEffect,
        useAppStateAsync: (
            factory: () => Promise<unknown>,
            deps: unknown[],
        ) => {
            const [value, setValue] = React.useState<unknown>(undefined);
            React.useEffect(() => {
                let active = true;
                Promise.resolve(factory()).then((nextValue) => {
                    if (active) {
                        setValue(nextValue);
                    }
                });
                return () => {
                    active = false;
                };
            }, deps);
            return [value];
        },
    };
});

vi.mock('../../bible-list/BibleItem', () => ({
    default: class BibleItem {
        static readonly fromData = mocks.fromDataMock;
        static readonly fromTitleText = mocks.fromTitleTextMock;
    },
}));

vi.mock('./bibleLogicHelpers1', () => ({
    getModelChapterCount: mocks.getModelChapterCountMock,
}));

vi.mock('../../others/CacheManager', () => ({
    default: mocks.MockCacheManager,
    globalCacheManager1M: mocks.globalCacheManager1M,
}));

vi.mock('./bibleDownloadHelpers', () => ({
    getAllLocalBibleInfoList: mocks.getAllLocalBibleInfoListMock,
}));

vi.mock('../../server/unlockingHelpers', () => ({
    unlocking: mocks.unlockingMock,
}));

vi.mock('../settingHelpers', () => ({
    getSetting: mocks.getSettingMock,
    setSetting: mocks.setSettingMock,
}));

vi.mock('../loggerHelpers', () => ({
    appLog: mocks.appLogMock,
}));

vi.mock('./bibleModelHelpers', () => ({
    getBibleModelInfo: mocks.getBibleModelInfoMock,
    modelNewLinerInfo: ['GEN 1:3'],
}));

async function loadModule() {
    return await import('./bibleLogicHelpers2');
}

describe('bibleLogicHelpers2', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        vi.resetModules();
        mocks.reset();

        mocks.bookToKeyMock.mockImplementation(
            async (_bibleKey: string, book: string) => {
                const normalized = book.toLowerCase();
                if (normalized === 'john' || normalized === 'jhn') {
                    return 'JHN';
                }
                if (normalized === 'jude') {
                    return 'JUD';
                }
                return null;
            },
        );
        mocks.keyToBookMock.mockImplementation(
            async (_bibleKey: string, bookKey: string) => {
                if (bookKey === 'JHN') {
                    return 'John';
                }
                if (bookKey === 'JUD') {
                    return 'Jude';
                }
                return null;
            },
        );
        mocks.getBibleInfoMock.mockResolvedValue({
            keyBookMap: {
                JHN: 'John',
                JUD: 'Jude',
            },
            locale: 'km-KH',
            numList: ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'],
        });
        mocks.fromStringNumMock.mockImplementation(
            (numList: string[], localeNum: string) => {
                const digits = numList.reduce<Record<string, string>>(
                    (map, value, index) => {
                        map[value] = `${index}`;
                        return map;
                    },
                    {},
                );
                const normalized = localeNum
                    .split('')
                    .map((char) => digits[char] ?? char)
                    .join('');
                const parsed = Number.parseInt(normalized, 10);
                return Number.isNaN(parsed) ? null : parsed;
            },
        );
        mocks.toStringNumMock.mockImplementation(
            (numList: string[], value: number) => {
                return `${value}`
                    .split('')
                    .map((digit) => numList[Number.parseInt(digit, 10)])
                    .join('');
            },
        );
        mocks.fromLocaleNumMock.mockImplementation(
            async (_locale: string, localeNum: string) => {
                if (localeNum === '12') {
                    return 12;
                }
                return null;
            },
        );
        mocks.toLocaleNumMock.mockImplementation(
            async (locale: string, value: number) => {
                return `${locale}:${value}`;
            },
        );
        mocks.getFontFamilyByLocaleMock.mockImplementation(
            (locale: string) => `font:${locale}`,
        );
        mocks.getLangDataAsyncMock.mockImplementation(
            async (locale: string) => {
                if (locale === 'km-KH') {
                    return {
                        fontFamily: 'Khmer Font',
                        sanitizeText: (text: string) =>
                            text.replaceAll('.', ':'),
                        transformBibleBookName: (text: string) => [text],
                    };
                }
                if (locale === 'en-US') {
                    return {
                        fontFamily: 'English Font',
                        sanitizeText: (text: string) => text,
                        transformBibleBookName: (text: string) => [text],
                    };
                }
                return null;
            },
        );
        mocks.getModelChapterCountMock.mockImplementation((bookKey: string) => {
            if (bookKey === 'JUD') {
                return 1;
            }
            if (bookKey === 'JHN') {
                return 21;
            }
            return 0;
        });
        mocks.getAllLocalBibleInfoListMock.mockResolvedValue([
            { key: 'KJV' },
            { key: 'ESV' },
        ]);
        mocks.getSettingMock.mockReturnValue(undefined);
        mocks.getBibleModelInfoMock.mockReturnValue({
            oneChapterBooks: ['JUD'],
        });
        mocks.getVersesMock.mockImplementation(
            async (_bibleKey: string, _bookKey: string, chapter: number) => {
                if (chapter === 3) {
                    return { 1: 'v1', 2: 'v2', 3: 'v3', 4: 'v4' };
                }
                if (chapter === 1) {
                    return { 1: 'v1', 2: 'v2', 3: 'v3' };
                }
                if (chapter === 2) {
                    return { 1: 'v1', 2: 'v2', 3: 'v3' };
                }
                return null;
            },
        );
        mocks.getChapterDataMock.mockResolvedValue(null);
        mocks.fromDataMock.mockImplementation(
            (
                bibleKey: string,
                bookKey: string,
                chapter: number,
                verseStart: number,
                verseEnd: number,
            ) =>
                mocks.buildBibleItem(
                    bibleKey,
                    bookKey,
                    chapter,
                    verseStart,
                    verseEnd,
                ),
        );
        mocks.fromTitleTextMock.mockImplementation(
            async (bibleKey: string, titleText: string) => {
                return (
                    mocks.titleTextMap.get(`${bibleKey}:${titleText}`) ?? null
                );
            },
        );

        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(async () => {
        if (root) {
            await act(async () => {
                root?.unmount();
            });
            root = null;
        }
        container?.remove();
        container = null;
    });

    test('formats input text and resolves locale and language metadata', async () => {
        const module = await loadModule();

        expect(await module.toInputText('KJV')).toBe('');
        expect(await module.toInputText('KJV', 'Jude')).toBe('Jude ១:');
        expect(await module.toInputText('KJV', 'John', 3)).toBe('John ៣');
        expect(await module.toInputText('KJV', 'John', 3, 16)).toBe(
            'John ៣:១៦',
        );
        expect(await module.toInputText('KJV', 'John', 3, 16, 18)).toBe(
            'John ៣:១៦',
        );
        expect(await module.toInputText('KJV', 'John', 3, 16, 16)).toBe(
            'John ៣:១៦-១៦',
        );

        mocks.getBibleInfoMock.mockResolvedValueOnce(null);
        expect(await module.getBibleLocale('missing')).toBe('en');
        expect(await module.getBibleLocale('KJV')).toBe('km-KH');

        mocks.getLangDataAsyncMock
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
                fontFamily: 'Fallback Font',
                sanitizeText: (text: string) => text,
                transformBibleBookName: (text: string) => [text],
            });
        expect(await module.getLangDataFromBibleKey('KJV')).toEqual({
            fontFamily: 'Fallback Font',
            sanitizeText: expect.any(Function),
            transformBibleBookName: expect.any(Function),
        });
    });

    test('converts locale numbers, caches font families, and resolves async hook values', async () => {
        const module = await loadModule();
        const updates: Array<{
            font: ReturnType<typeof module.useBibleFontFamily>;
            localeNum: ReturnType<typeof module.useToLocaleNumBible>;
            parsedNum: ReturnType<typeof module.useFromLocaleNumBible>;
        }> = [];

        expect(await module.getBibleFontFamily('')).toBe('font:en-US');
        expect(await module.getBibleFontFamily('KJV')).toBe('font:km-KH');
        expect(await module.getBibleFontFamily('KJV')).toBe('font:km-KH');

        expect(await module.toLocaleNumBible('KJV', 3)).toBe('៣');
        expect(await module.toLocaleNumBible('KJV', 3)).toBe('៣');
        expect(await module.toLocaleNumBible('KJV', null)).toBeNull();

        mocks.getBibleInfoMock
            .mockResolvedValueOnce({ locale: 'en-US' })
            .mockResolvedValueOnce({ locale: 'en-US' });
        expect(await module.toLocaleNumBible('WEB', 12)).toBe('en-US:12');

        expect(await module.fromLocaleNumBible('KJV', '៣')).toBe(3);
        mocks.getBibleInfoMock.mockResolvedValueOnce({ locale: 'en-US' });
        expect(await module.fromLocaleNumBible('WEB', '12')).toBe(12);
        mocks.getBibleInfoMock.mockResolvedValueOnce({ locale: 'en-US' });
        expect(await module.fromLocaleNumBible('WEB', 'verse 99')).toBe(99);

        function HookHarness() {
            const font = module.useBibleFontFamily('KJV');
            const localeNum = module.useToLocaleNumBible('KJV', 3);
            const parsedNum = module.useFromLocaleNumBible('KJV', '៣');

            useEffect(() => {
                updates.push({ font, localeNum, parsedNum });
            }, [font, localeNum, parsedNum]);

            return null;
        }

        await act(async () => {
            if (!container) {
                throw new Error('Missing container');
            }
            root = createRoot(container);
            root.render(<HookHarness />);
        });
        await act(async () => {
            await Promise.resolve();
        });

        expect(updates.at(-1)).toEqual({
            font: 'font:km-KH',
            localeNum: '៣',
            parsedNum: 3,
        });
    });

    test('builds extracted bible defaults, parses chapters, and counts verses with caching', async () => {
        const module = await loadModule();

        expect(module.genExtractedBible()).toEqual({
            bibleItem: null,
            bookKey: null,
            chapter: null,
            guessingBook: null,
            guessingChapter: null,
        });

        expect(await module.parseChapterFromGuessing('KJV', 'JHN', '៣')).toBe(
            3,
        );
        expect(
            await module.parseChapterFromGuessing('KJV', 'JHN', '២២'),
        ).toBeNull();

        expect(await module.getVersesCount('KJV', 'JHN', 3)).toBe(4);
        expect(await module.getVersesCount('KJV', 'JHN', 3)).toBe(4);
        expect(mocks.getVersesMock).toHaveBeenCalledTimes(1);

        mocks.getVersesMock.mockResolvedValueOnce(null);
        expect(await module.getVersesCount('KJV', 'JHN', 99)).toBeNull();
    });

    test('extracts bible titles from direct verse strings and bible-key-prefixed text', async () => {
        const module = await loadModule();

        expect(await module.extractBibleTitle('KJV', '')).toEqual({
            bibleKey: 'KJV',
            inputText: '',
            oldInputText: '',
            result: module.genExtractedBible(),
            time: expect.any(Number),
        });

        mocks.getVersesMock.mockImplementationOnce(async () => {
            return Object.fromEntries(
                Array.from({ length: 20 }, (_, index) => {
                    return [`${index + 1}`, `v${index + 1}`];
                }),
            );
        });
        const direct = await module.extractBibleTitle('KJV', '  John  3.16 ');
        expect(direct.bibleKey).toBe('KJV');
        expect(direct.result.bookKey).toBe('JHN');
        expect(direct.result.bibleItem?.target).toEqual({
            bookKey: 'JHN',
            chapter: 3,
            verseEnd: 16,
            verseStart: 16,
        });

        const prefixed = await module.extractBibleTitle(
            'KJV',
            '(ESV) John 3:16',
        );
        expect(prefixed.bibleKey).toBe('ESV');
        expect(prefixed.result.bibleItem?.bibleKey).toBe('ESV');

        const keyed = await module.extractBibleTitle('KJV', 'JHN 3:16-17');
        expect(keyed.result.bibleItem?.target.verseEnd).toBe(17);

        const unknown = await module.extractBibleTitle('KJV', 'Unknown Book');
        expect(unknown.result.guessingBook).toBe('Unknown Book');
        expect(unknown.inputText).toBe('');
    });

    test('falls back to transformed bible book name candidates', async () => {
        const module = await loadModule();

        mocks.getLangDataAsyncMock.mockImplementation(
            async (locale: string) => {
                if (locale === 'km-KH') {
                    return {
                        fontFamily: 'Khmer Font',
                        sanitizeText: (text: string) => text,
                        transformBibleBookName: (text: string) => [
                            text,
                            'John',
                        ],
                    };
                }
                return null;
            },
        );

        const extracted = await module.extractBibleTitle(
            'KJV',
            'Translated John 3:2',
        );

        expect(extracted.result.bookKey).toBe('JHN');
        expect(extracted.result.bibleItem?.target).toEqual({
            bookKey: 'JHN',
            chapter: 3,
            verseEnd: 2,
            verseStart: 2,
        });
    });

    test('creates extra bible items for broken chapter ranges', async () => {
        const module = await loadModule();
        mocks.fromDataMock.mockImplementation(
            (
                bibleKey: string,
                bookKey: string,
                chapter: number,
                verseStart: number,
                verseEnd: number,
            ) =>
                mocks.buildBibleItem(
                    bibleKey,
                    bookKey,
                    chapter,
                    verseStart,
                    verseEnd,
                    'John 1:1-3',
                ),
        );
        mocks.titleTextMap.set(
            'KJV:John 2:1-3',
            mocks.buildBibleItem('KJV', 'JHN', 2, 1, 3, 'John 2:1-3'),
        );

        const extracted = await module.extractBibleTitle('KJV', 'John 1:1-2:3');
        expect(extracted.result.extraBibleItems).toHaveLength(1);
        expect(extracted.result.extraBibleItems?.[0]?.target).toEqual({
            bookKey: 'JHN',
            chapter: 2,
            verseEnd: 3,
            verseStart: 1,
        });
    });

    test('persists newline settings and checks model and chapter newline markers', async () => {
        const module = await loadModule();

        expect(module.getShouldModelNewLine()).toBe(true);
        module.setShouldModelNewLine(false);
        expect(mocks.setSettingMock).toHaveBeenCalledWith(
            'view-should-model-new-line',
            'false',
        );

        mocks.getSettingMock.mockReturnValueOnce('false');
        expect(await module.checkShouldNewLineModel('KJV', 'GEN', 1, 3)).toBe(
            false,
        );

        mocks.getChapterDataMock.mockResolvedValueOnce({
            newLines: ['GEN 1:3'],
        });
        expect(await module.checkShouldNewLineModel('KJV', 'GEN', 1, 3)).toBe(
            false,
        );

        mocks.getChapterDataMock.mockResolvedValueOnce({ newLines: [] });
        expect(await module.checkShouldNewLineModel('KJV', 'GEN', 1, 3)).toBe(
            true,
        );

        mocks.getChapterDataMock.mockResolvedValueOnce({
            newLines: ['GEN 1:3'],
        });
        expect(await module.checkShouldNewLine('KJV', 'GEN', 1, 3)).toBe(true);
        mocks.getChapterDataMock.mockResolvedValueOnce({ newLines: [] });
        expect(await module.checkShouldNewLine('KJV', 'GEN', 1, 1)).toBe(false);
    });
});
