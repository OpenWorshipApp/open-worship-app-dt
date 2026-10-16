import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const cacheStores: Map<string, unknown>[] = [];

    class MockCacheManager<T> {
        private readonly store = new Map<string, T>();

        constructor(_ttl: number) {
            cacheStores.push(this.store as Map<string, unknown>);
        }

        async get(key: string) {
            return this.store.has(key) ? (this.store.get(key) as T) : null;
        }

        async set(key: string, value: T) {
            this.store.set(key, value);
        }
    }

    return {
        MockCacheManager,
        cacheStores,
        checkShouldNewLineMock: vi.fn(),
        checkShouldNewLineModelMock: vi.fn(),
        getBibleInfoIsRtlMock: vi.fn(),
        getBibleInfoMock: vi.fn(),
        getBibleModelInfoMock: vi.fn(),
        getCustomVerseTextMock: vi.fn(),
        getLangDataFromBibleKeyMock: vi.fn(),
        getModelChapterCountMock: vi.fn(),
        getModelKeyBookMapMock: vi.fn(),
        getNewLineTitlesHtmlTextMock: vi.fn(),
        getVersesMock: vi.fn(),
        keyToBookMock: vi.fn(),
        reset() {
            cacheStores.length = 0;
        },
        toLocaleNumBibleMock: vi.fn(),
        unlockingMock: vi.fn(
            async (_key: string, callback: () => Promise<unknown>) => {
                return callback();
            },
        ),
    };
});

// The key spelling is the real one: it is a pure leaf, and every key and
// title this module writes is spelled by it.
vi.mock('../helper/bible-helpers/bibleInfoHelpers', async () => {
    const keyFormatHelpers = await vi.importActual<
        typeof import('../helper/bible-helpers/bibleKeyFormatHelpers')
    >('../helper/bible-helpers/bibleKeyFormatHelpers');
    return {
        getBibleInfo: mocks.getBibleInfoMock,
        getBibleInfoIsRtl: mocks.getBibleInfoIsRtlMock,
        getVerses: mocks.getVersesMock,
        keyToBook: mocks.keyToBookMock,
        toVerseFullKeyFormat: keyFormatHelpers.toVerseFullKeyFormat,
    };
});

vi.mock('../helper/bible-helpers/bibleLogicHelpers1', () => ({
    getModelChapterCount: mocks.getModelChapterCountMock,
    getModelKeyBookMap: mocks.getModelKeyBookMapMock,
}));

vi.mock('../helper/bible-helpers/bibleLogicHelpers2', () => ({
    checkShouldNewLine: mocks.checkShouldNewLineMock,
    checkShouldNewLineModel: mocks.checkShouldNewLineModelMock,
    toLocaleNumBible: mocks.toLocaleNumBibleMock,
}));

vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    getLangDataFromBibleKey: mocks.getLangDataFromBibleKeyMock,
}));

vi.mock('../helper/bible-helpers/bibleLogicHelpers3', () => ({
    getCustomVerseText: mocks.getCustomVerseTextMock,
    getNewLineTitlesHtmlText: mocks.getNewLineTitlesHtmlTextMock,
}));

vi.mock('../helper/bible-helpers/bibleModelHelpers', () => ({
    getBibleModelInfo: mocks.getBibleModelInfoMock,
}));

vi.mock('../others/CacheManager', () => ({
    default: mocks.MockCacheManager,
}));

vi.mock('../server/unlockingHelpers', () => ({
    unlocking: mocks.unlockingMock,
}));

const loadHelper = async () => {
    return (await import('./bibleRenderHelpers')).bibleRenderHelper;
};

describe('bibleRenderHelper', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        mocks.reset();

        mocks.keyToBookMock.mockResolvedValue('Genesis');
        mocks.getModelKeyBookMapMock.mockReturnValue({
            GEN: 'Genesis Model',
            REV: 'Revelation Model',
        });
        mocks.toLocaleNumBibleMock.mockImplementation(
            async (_bibleKey: string, value: number) => `${value}`,
        );
        mocks.getBibleInfoIsRtlMock.mockResolvedValue(false);
        mocks.getLangDataFromBibleKeyMock.mockResolvedValue({
            fontFamily: 'Khmer System',
            locale: 'km-KH',
        });
        mocks.checkShouldNewLineMock.mockImplementation(
            async (
                _bibleKey: string,
                _bookKey: string,
                _chapter: number,
                verse: number,
            ) => verse === 2,
        );
        mocks.checkShouldNewLineModelMock.mockImplementation(
            async (
                _bibleKey: string,
                _bookKey: string,
                _chapter: number,
                verse: number,
            ) => verse === 3,
        );
        mocks.getNewLineTitlesHtmlTextMock.mockImplementation(
            async (
                _bibleKey: string,
                _bookKey: string,
                _chapter: number,
                verse: number,
            ) => `Title ${verse}`,
        );
        mocks.getCustomVerseTextMock.mockImplementation(
            async (
                _bibleKey: string,
                _bookKey: string,
                _chapter: number,
                verse: number,
            ) => {
                return verse === 2 ? 'Custom verse' : null;
            },
        );
        mocks.getVersesMock.mockImplementation(
            async (_bibleKey: string, _bookKey: string, chapter: number) => {
                if (chapter === 1) {
                    return {
                        1: 'In the beginning',
                        2: 'The earth',
                        3: 'Light',
                    };
                }
                if (chapter === 2) {
                    return {
                        1: 'Alpha',
                        2: 'Beta',
                        3: 'Gamma',
                        4: 'Delta',
                        5: 'Omega',
                    };
                }
                return null;
            },
        );
        mocks.getBibleInfoMock.mockResolvedValue({ name: 'Sample Bible' });
        mocks.getBibleModelInfoMock.mockReturnValue({
            bookKeysOrder: ['GEN', 'REV'],
        });
        mocks.getModelChapterCountMock.mockImplementation((bookKey: string) => {
            return bookKey === 'REV' ? 2 : 1;
        });
    });

    test('formats and parses bible verse keys and queue keys', async () => {
        const bibleRenderHelper = await loadHelper();
        const target = {
            bookKey: 'GEN',
            chapter: 1,
            verseStart: 1,
            verseEnd: 3,
        };

        expect(bibleRenderHelper.toKJVBibleVersesKey(target)).toBe('GEN 1:1-3');
        expect(
            bibleRenderHelper.toKJVBibleVersesKey({
                ...target,
                verseEnd: 5,
                chapterEnd: 2,
            }),
        ).toBe('GEN 1:1-2:5');
        expect(
            bibleRenderHelper.toKJVBibleVersesKey({ ...target, chapterEnd: 1 }),
        ).toBe('GEN 1:1-3');
        expect(
            bibleRenderHelper.toKJVBibleVersesKey({
                ...target,
                verseEnd: 1,
            }),
        ).toBe('GEN 1:1');
        expect(bibleRenderHelper.toBibleVersesKey('WEB', target)).toBe(
            '(WEB) GEN 1:1-3',
        );
        expect(bibleRenderHelper.fromKJVBibleVersesKey('REV 22:21')).toEqual({
            bookKey: 'REV',
            chapter: 22,
            verseEnd: 21,
            verseStart: 21,
        });
        // Across chapters, and a second chapter that is the same one.
        expect(bibleRenderHelper.fromKJVBibleVersesKey('JHN 1:2-3:4')).toEqual({
            bookKey: 'JHN',
            chapter: 1,
            verseStart: 2,
            verseEnd: 4,
            chapterEnd: 3,
        });
        expect(bibleRenderHelper.fromKJVBibleVersesKey('JHN 1:2-1:4')).toEqual({
            bookKey: 'JHN',
            chapter: 1,
            verseStart: 2,
            verseEnd: 4,
        });
        expect(
            bibleRenderHelper.fromBibleVerseKey('(KJV) JHN 18:33-19:16'),
        ).toEqual({
            bibleKey: 'KJV',
            bookKey: 'JHN',
            chapter: 18,
            verseStart: 33,
            verseEnd: 16,
            chapterEnd: 19,
        });
        expect(bibleRenderHelper.fromBibleVerseKey('(KJV) GEN 1:1-3')).toEqual({
            bibleKey: 'KJV',
            bookKey: 'GEN',
            chapter: 1,
            verseEnd: 3,
            verseStart: 1,
        });
        expect(bibleRenderHelper.toTitleQueueKey('(KJV) GEN 1:1-3')).toBe(
            'title > (KJV) GEN 1:1-3',
        );
        expect(
            bibleRenderHelper.toVerseTextListQueueKey('(KJV) GEN 1:1-3'),
        ).toBe('text > (KJV) GEN 1:1-3');
    });

    test('renders localized titles, falls back to model book names, and reuses cached titles', async () => {
        const bibleRenderHelper = await loadHelper();
        const target = {
            bookKey: 'GEN',
            chapter: 1,
            verseStart: 1,
            verseEnd: 3,
        };
        const crossTarget = { ...target, verseEnd: 5, chapterEnd: 2 };

        expect(await bibleRenderHelper.toTitle('KJV', target)).toBe(
            'Genesis 1:1-3',
        );
        mocks.toLocaleNumBibleMock.mockClear();
        expect(await bibleRenderHelper.toTitle('KJV', crossTarget)).toBe(
            'Genesis 1:1-2:5',
        );
        expect(mocks.toLocaleNumBibleMock).toHaveBeenCalledTimes(4);
        expect(await bibleRenderHelper.toTitle('KJV', crossTarget)).toBe(
            'Genesis 1:1-2:5',
        );
        expect(mocks.toLocaleNumBibleMock).toHaveBeenCalledTimes(4);
        expect(
            await bibleRenderHelper.toTitleParts('KJV', crossTarget),
        ).toEqual({
            book: 'Genesis',
            chapter: '1',
            verseStart: '1',
            verseEnd: '5',
            chapterEnd: '2',
        });
        expect(
            (await bibleRenderHelper.toTitleParts('KJV', target)).chapterEnd,
        ).toBeNull();

        mocks.keyToBookMock.mockResolvedValueOnce(null);
        expect(await bibleRenderHelper.toLocaleBook('KJV', 'GEN')).toBe(
            'Genesis Model',
        );
    });

    test('builds verse text lists with verse metadata and supports skip-extra behavior', async () => {
        const bibleRenderHelper = await loadHelper();
        const target = {
            bookKey: 'GEN',
            chapter: 1,
            verseStart: 1,
            verseEnd: 3,
        };

        expect(
            await bibleRenderHelper.getVerseTextExtra('KJV', 'GEN', 1, 2, true),
        ).toEqual({
            customText: null,
            isModelNewLine: false,
            isNewLine: false,
            newLineTitlesHtmlText: null,
        });

        const verseTextList = await bibleRenderHelper.toVerseTextList(
            'KJV',
            target,
        );
        expect(verseTextList).toEqual([
            {
                bibleKey: 'KJV',
                bibleVersesKey: '(KJV) GEN 1:1',
                bookKey: 'GEN',
                chapter: 1,
                customText: null,
                isFirst: true,
                isLast: false,
                isChapterStart: false,
                localeChapter: '1',
                isModelNewLine: false,
                isNewLine: true,
                isRtl: false,
                kjvBibleVersesKey: 'GEN 1:1',
                locale: 'km-KH',
                localeVerse: '1',
                newLineTitlesHtmlText: 'Title 1',
                style: { fontFamily: 'Khmer System' },
                text: 'In the beginning',
                verse: 1,
            },
            {
                bibleKey: 'KJV',
                bibleVersesKey: '(KJV) GEN 1:2',
                bookKey: 'GEN',
                chapter: 1,
                customText: 'Custom verse',
                isFirst: false,
                isLast: false,
                isChapterStart: false,
                localeChapter: '1',
                isModelNewLine: false,
                isNewLine: true,
                isRtl: false,
                kjvBibleVersesKey: 'GEN 1:2',
                locale: 'km-KH',
                localeVerse: '2',
                newLineTitlesHtmlText: 'Title 2',
                style: { fontFamily: 'Khmer System' },
                text: 'The earth',
                verse: 2,
            },
            {
                bibleKey: 'KJV',
                bibleVersesKey: '(KJV) GEN 1:3',
                bookKey: 'GEN',
                chapter: 1,
                customText: null,
                isFirst: false,
                isLast: true,
                isChapterStart: false,
                localeChapter: '1',
                isModelNewLine: true,
                isNewLine: false,
                isRtl: false,
                kjvBibleVersesKey: 'GEN 1:3',
                locale: 'km-KH',
                localeVerse: '3',
                newLineTitlesHtmlText: 'Title 3',
                style: { fontFamily: 'Khmer System' },
                text: 'Light',
                verse: 3,
            },
        ]);

        mocks.getVersesMock.mockResolvedValueOnce(null);
        expect(
            await bibleRenderHelper.toVerseTextList('KJV', target, true),
        ).toBeNull();
    });

    test('walks a passage across chapters, or only the chapters asked for', async () => {
        const bibleRenderHelper = await loadHelper();
        const crossTarget = {
            bookKey: 'GEN',
            chapter: 1,
            verseStart: 2,
            verseEnd: 3,
            chapterEnd: 2,
        };
        const toSummary = (list: any[] | null) => {
            return list?.map((verseInfo) => {
                return [
                    verseInfo.kjvBibleVersesKey,
                    verseInfo.isFirst,
                    verseInfo.isLast,
                    verseInfo.isChapterStart,
                    verseInfo.localeChapter,
                ].join(' ');
            });
        };
        expect(
            toSummary(
                await bibleRenderHelper.toVerseTextList(
                    'KJV',
                    crossTarget,
                    true,
                ),
            ),
        ).toEqual([
            'GEN 1:2 true false true 1',
            'GEN 1:3 false false false 1',
            'GEN 2:1 false false true 2',
            'GEN 2:2 false false false 2',
            'GEN 2:3 false true false 2',
        ]);
        expect(
            toSummary(
                await bibleRenderHelper.toVerseTextList(
                    'KJV',
                    crossTarget,
                    true,
                    {
                        start: 0,
                        count: 1,
                    },
                ),
            ),
        ).toEqual(['GEN 1:2 true false true 1', 'GEN 1:3 false false false 1']);
        // A later window reads its own chapter only.
        mocks.getVersesMock.mockClear();
        expect(
            toSummary(
                await bibleRenderHelper.toVerseTextList(
                    'KJV',
                    crossTarget,
                    true,
                    {
                        start: 1,
                        count: 1,
                    },
                ),
            ),
        ).toEqual([
            'GEN 2:1 false false true 2',
            'GEN 2:2 false false false 2',
            'GEN 2:3 false true false 2',
        ]);
        expect(mocks.getVersesMock).toHaveBeenCalledTimes(1);
        expect(mocks.getVersesMock).toHaveBeenCalledWith('KJV', 'GEN', 2);
        // A chapter the bible lacks ends the passage there: chapter 2 is a
        // middle one now, read whole, and chapter 3 does not exist.
        expect(
            toSummary(
                await bibleRenderHelper.toVerseTextList(
                    'KJV',
                    { ...crossTarget, chapterEnd: 3 },
                    true,
                ),
            ),
        ).toHaveLength(7);
    });

    test('copies a passage across chapters under a title per chapter', async () => {
        const bibleRenderHelper = await loadHelper();
        const crossTarget = {
            bookKey: 'GEN',
            chapter: 1,
            verseStart: 2,
            verseEnd: 3,
            chapterEnd: 2,
        };
        expect(await bibleRenderHelper.toText('KJV', crossTarget, true)).toBe(
            'Genesis 1:2-3\n(2): The earth (3): Light\n' +
                'Genesis 2:1-3\n(1): Alpha (2): Beta (3): Gamma',
        );
        expect(
            await bibleRenderHelper.toText('KJV', crossTarget, true, 1),
        ).toBe('Genesis 1:2-3\n(2): The earth (3): Light');
        expect(
            await bibleRenderHelper.toTextSectionList('KJV', crossTarget, true),
        ).toEqual([
            {
                chapter: 1,
                localeChapter: '1',
                title: 'Genesis 1:2-3',
                text: '(2): The earth (3): Light',
            },
            {
                chapter: 2,
                localeChapter: '2',
                title: 'Genesis 2:1-3',
                text: '(1): Alpha (2): Beta (3): Gamma',
            },
        ]);
    });

    test('jumps to the chapter after where a passage ENDS', async () => {
        const bibleRenderHelper = await loadHelper();
        mocks.getModelChapterCountMock.mockReturnValue(50);
        expect(
            await bibleRenderHelper.getJumpingChapter(
                'KJV',
                {
                    bookKey: 'GEN',
                    chapter: 1,
                    verseStart: 2,
                    verseEnd: 3,
                    chapterEnd: 2,
                },
                true,
            ),
        ).toEqual({ bookKey: 'GEN', chapter: 3, verseStart: 1, verseEnd: 1 });
        expect(
            await bibleRenderHelper.getJumpingChapter(
                'KJV',
                {
                    bookKey: 'GEN',
                    chapter: 2,
                    verseStart: 2,
                    verseEnd: 3,
                    chapterEnd: 3,
                },
                false,
            ),
        ).toEqual({ bookKey: 'GEN', chapter: 1, verseStart: 1, verseEnd: 3 });
    });

    test('computes jumping chapters and renders text fallbacks', async () => {
        const bibleRenderHelper = await loadHelper();
        const target = {
            bookKey: 'GEN',
            chapter: 1,
            verseStart: 1,
            verseEnd: 3,
        };

        mocks.getBibleInfoMock.mockResolvedValueOnce(null);
        expect(
            await bibleRenderHelper.getJumpingChapter('KJV', target, true),
        ).toBeNull();

        expect(
            await bibleRenderHelper.getJumpingChapter('KJV', target, false),
        ).toEqual({
            bookKey: 'REV',
            chapter: 2,
            verseEnd: 5,
            verseStart: 1,
        });
        expect(
            await bibleRenderHelper.getJumpingChapter(
                'KJV',
                { bookKey: 'REV', chapter: 2, verseStart: 1, verseEnd: 5 },
                true,
            ),
        ).toEqual({
            bookKey: 'GEN',
            chapter: 1,
            verseEnd: 3,
            verseStart: 1,
        });
        // Across a book boundary the verse count is read from the book jumped
        // TO, never the one left behind (Obadiah 1 came out as 1-17).
        mocks.getVersesMock.mockClear();
        await bibleRenderHelper.getJumpingChapter('KJV', target, false);
        expect(mocks.getVersesMock).toHaveBeenLastCalledWith('KJV', 'REV', 2);

        const toVerseTextListSpy = vi.spyOn(
            bibleRenderHelper,
            'toVerseTextList',
        );
        toVerseTextListSpy.mockResolvedValueOnce(null);
        expect(await bibleRenderHelper.toText('KJV', target, true)).toBe(
            '😟Unable to render text for (KJV) GEN 1:1-3',
        );

        toVerseTextListSpy.mockResolvedValueOnce([
            { localeVerse: '1', text: 'In the beginning' },
            { localeVerse: '2', text: 'The earth' },
        ] as any);
        expect(await bibleRenderHelper.toText('KJV', target)).toBe(
            '(1): In the beginning (2): The earth',
        );
    });
});
