import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const cacheStores: Map<string, unknown>[] = [];

    class MockCacheManager<T> {
        private readonly store = new Map<string, T>();

        constructor(_ttl: number) {
            cacheStores.push(this.store as Map<string, unknown>);
        }

        async get(key: string) {
            return this.store.has(key) ? this.store.get(key) : null;
        }

        async set(key: string, value: T) {
            this.store.set(key, value);
        }

        async delete(key: string) {
            this.store.delete(key);
        }
    }

    return {
        MockCacheManager,
        bibleDataReadMock: vi.fn(),
        bibleKeyToXMLFilePathMock: vi.fn(),
        cacheStores,
        checkIsRtlMock: vi.fn(),
        freezeObjectMock: vi.fn((value: object) => Object.freeze(value)),
        fromLocaleNumBibleMock: vi.fn(),
        fsCheckFileExistMock: vi.fn(),
        getBibleModelInfoMock: vi.fn(),
        getModelChapterCountMock: vi.fn(),
        getVersesCountMock: vi.fn(),
        reset() {
            cacheStores.length = 0;
        },
        toBibleFileNameMock: vi.fn(),
    };
});

vi.mock('./bibleLogicHelpers1', () => ({
    getModelChapterCount: mocks.getModelChapterCountMock,
    toBibleFileName: mocks.toBibleFileNameMock,
}));

vi.mock('../../setting/bible-setting/bibleXMLJsonDataHelpers', () => ({
    bibleKeyToXMLFilePath: mocks.bibleKeyToXMLFilePathMock,
}));

vi.mock('./BibleDataReader', () => ({
    bibleDataReader: {
        readBibleData: mocks.bibleDataReadMock,
    },
}));

vi.mock('../../server/fileHelpers', () => ({
    fsCheckFileExist: mocks.fsCheckFileExistMock,
}));

vi.mock('../../others/CacheManager', () => ({
    default: mocks.MockCacheManager,
}));

vi.mock('../helpers', () => ({
    freezeObject: mocks.freezeObjectMock,
}));

vi.mock('../../lang/langHelpers', () => ({
    checkIsRtl: mocks.checkIsRtlMock,
}));

vi.mock('./bibleLogicHelpers2', () => ({
    fromLocaleNumBible: mocks.fromLocaleNumBibleMock,
    getVersesCount: mocks.getVersesCountMock,
}));

vi.mock('./bibleModelHelpers', () => ({
    getBibleModelInfo: mocks.getBibleModelInfoMock,
}));

async function loadModule() {
    return await import('./bibleInfoHelpers');
}

describe('bibleInfoHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        mocks.reset();

        mocks.getModelChapterCountMock.mockImplementation((bookKey: string) => {
            return bookKey === 'REV' ? 22 : 50;
        });
        mocks.toBibleFileNameMock.mockImplementation((bookKey: string, chapter: number) => {
            return `file:${bookKey}.${chapter}`;
        });
        mocks.bibleKeyToXMLFilePathMock.mockResolvedValue(null);
        mocks.fsCheckFileExistMock.mockResolvedValue(false);
        mocks.checkIsRtlMock.mockReturnValue(true);
        mocks.fromLocaleNumBibleMock.mockImplementation(async (_bibleKey: string, localeNum: string) => {
            if (localeNum === '២') {
                return 2;
            }
            return null;
        });
        mocks.getVersesCountMock.mockResolvedValue(36);
        mocks.getBibleModelInfoMock.mockReturnValue({
            apocryphalBooks: ['TOB'],
            bookKeysOld: ['GEN', 'EXO'],
        });
    });

    test('maps bible books and chapters from the loaded bible info', async () => {
        const info = {
            booksAvailable: ['GEN', 'EXO'],
            keyBookMap: {
                EXO: 'Exodus',
                GEN: 'Genesis',
                TI2: '២ Timothy',
            },
            locale: 'km-KH',
        };
        mocks.bibleDataReadMock.mockResolvedValue(info);

        const module = await loadModule();
        expect(await module.checkIsBookAvailable('KJV', 'GEN')).toBe(true);
        expect(await module.checkIsBookAvailable('KJV', 'REV')).toBe(false);
        expect(await module.getBookKVList('KJV')).toEqual(info.keyBookMap);
        expect(await module.keyToBook('KJV', 'GEN')).toBe('Genesis');
        expect(await module.keyToBook('KJV', 'REV')).toBeNull();

        const bookVKList = await module.getBookVKList('KJV');
        expect(bookVKList).toMatchObject({
            Exodus: 'EXO',
            Genesis: 'GEN',
            genesis: 'GEN',
        });
        expect(bookVKList?.['2 Timothy']).toBe('TI2');

        expect(await module.bookToKey('KJV', 'genesis')).toBe('GEN');
        expect(await module.getChapterCount('KJV', 'Genesis')).toBe(50);
        expect(await module.getChapterCount('KJV', 'Missing')).toBeNull();
    });

    test('reads chapter data, verses, and xml bible availability', async () => {
        const chapterData = {
            title: 'Genesis 1',
            verses: {
                1: 'In the beginning',
                2: 'And the earth',
            },
        };
        mocks.bibleDataReadMock.mockResolvedValue(chapterData);

        const module = await loadModule();
        expect(await module.getChapterData('KJV', 'GEN', 1)).toEqual(chapterData);
        expect(await module.getChapterData('KJV', 'GEN', 51)).toBeNull();
        expect(await module.getVerses('KJV', 'GEN', 1)).toEqual(chapterData.verses);

        mocks.bibleKeyToXMLFilePathMock.mockResolvedValueOnce('/xml/kjv.xml');
        mocks.fsCheckFileExistMock.mockResolvedValueOnce(true);
        expect(await module.checkIsBibleXML('KJV')).toBe(true);

        mocks.bibleKeyToXMLFilePathMock.mockResolvedValueOnce('/xml/missing.xml');
        mocks.fsCheckFileExistMock.mockResolvedValueOnce(false);
        expect(await module.checkIsBibleXML('KJV')).toBe(false);
    });

    test('caches bible info, exposes model metadata, and formats verse keys', async () => {
        const firstInfo = {
            booksAvailable: ['GEN'],
            key: 'KJV',
            keyBookMap: { GEN: 'Genesis' },
            locale: 'he-IL',
            title: 'KJV',
        };
        const secondInfo = {
            booksAvailable: ['EXO'],
            key: 'KJV',
            keyBookMap: { EXO: 'Exodus' },
            locale: 'en-US',
            title: 'KJV2',
        };
        mocks.bibleDataReadMock
            .mockResolvedValueOnce(firstInfo)
            .mockResolvedValueOnce(secondInfo);

        const module = await loadModule();
        expect(module.checkIsOldTestament('GEN')).toBe(true);
        expect(module.checkIsOldTestament('MAT')).toBe(false);
        expect(module.checkIsApocrypha('TOB')).toBe(true);
        expect(module.checkIsApocrypha('GEN')).toBe(false);

        expect(await module.getBibleInfo('KJV')).toEqual(firstInfo);
        expect(await module.getBibleInfo('KJV')).toEqual(firstInfo);
        expect(mocks.bibleDataReadMock).toHaveBeenCalledTimes(1);
        expect(mocks.freezeObjectMock).toHaveBeenCalledWith(firstInfo);

        expect(await module.getBibleInfo('KJV', true)).toEqual(secondInfo);
        expect(mocks.bibleDataReadMock).toHaveBeenCalledTimes(2);

        expect(await module.getBibleInfoIsRtl('KJV')).toBe(true);
        mocks.bibleDataReadMock.mockResolvedValueOnce(null);
        expect(await module.getBibleInfoIsRtl('WEB')).toBe(false);

        expect(module.toChapterFullKeyFormat('GEN', 1)).toBe('GEN 1');
        expect(module.toVerseFullKeyFormat('GEN', 1, 1)).toBe('GEN 1:1');
        expect(module.toVerseFullKeyFormat('GEN', 1, 1, 3)).toBe('GEN 1:1-3');
    });

    test('parses verse keys including trailing-dash ranges', async () => {
        const module = await loadModule();

        expect(await module.fromVerseKey('KJV', 'bad-format')).toBeNull();
        expect(await module.fromVerseKey('KJV', 'JHN 18:33-35')).toEqual({
            bookKey: 'JHN',
            chapter: 18,
            verseEnd: 35,
            verseStart: 33,
        });
        expect(await module.fromVerseKey('KJV', 'JHN 18:33-')).toEqual({
            bookKey: 'JHN',
            chapter: 18,
            verseEnd: 36,
            verseStart: 33,
        });

        mocks.getVersesCountMock.mockResolvedValueOnce(null);
        expect(await module.fromVerseKey('KJV', 'JHN 18:33-')).toBeNull();
    });
});
