import { beforeEach, describe, expect, test, vi } from 'vitest';

// What every reader answers for a Bible whose data is not there, and the book
// names the locale-number pass must leave as they are.
const mocks = vi.hoisted(() => ({
    readBibleData: vi.fn(),
    getModelChapterCount: vi.fn(),
    toBibleFileName: vi.fn(),
    fromLocaleNumBible: vi.fn(),
    getBibleModelInfo: vi.fn(),
}));

vi.mock('./bibleLogicHelpers1', () => ({
    getModelChapterCount: mocks.getModelChapterCount,
    toBibleFileName: mocks.toBibleFileName,
}));
vi.mock('../../setting/bible-setting/bibleXMLJsonDataHelpers', () => ({
    bibleKeyToXMLFilePath: async () => null,
}));
vi.mock('./BibleDataReader', () => ({
    bibleDataReader: { readBibleData: mocks.readBibleData },
}));
vi.mock('../../server/fileHelpers', () => ({
    fsCheckFileExist: async () => false,
}));
vi.mock('../../others/CacheManager', () => ({
    default: class {
        private readonly store = new Map<string, unknown>();
        async get(key: string) {
            return this.store.get(key) ?? null;
        }
        async set(key: string, value: unknown) {
            this.store.set(key, value);
        }
        async delete(key: string) {
            this.store.delete(key);
        }
    },
}));
vi.mock('../helpers', () => ({
    freezeObject: (value: object) => Object.freeze(value),
}));
vi.mock('../../lang/langHelpers', () => ({ checkIsRtl: () => false }));
vi.mock('./bibleLogicHelpers2', () => ({
    fromLocaleNumBible: mocks.fromLocaleNumBible,
    getVersesCount: async () => null,
}));
vi.mock('./bibleModelHelpers', () => ({
    getBibleModelInfo: mocks.getBibleModelInfo,
}));

import {
    bookToKey,
    checkIsApocrypha,
    checkIsBookAvailable,
    getBookKVList,
    getBookVKList,
    getChapterCount,
    getChapterData,
    getVerses,
    keyToBook,
} from './bibleInfoHelpers';

beforeEach(() => {
    mocks.getModelChapterCount.mockReturnValue(50);
    mocks.toBibleFileName.mockImplementation(
        (bookKey: string, chapter: number) => `${bookKey}.${chapter}`,
    );
    mocks.fromLocaleNumBible.mockImplementation(
        async (_bibleKey: string, localeNum: string) => {
            // A Bible's own digit two, as a made-up numbering writes it.
            return localeNum === '２' ? 2 : null;
        },
    );
    mocks.getBibleModelInfo.mockReturnValue({ bookKeysOld: ['GEN'] });
});

describe('a Bible whose info cannot be read', () => {
    test('has no books, no names and no chapters', async () => {
        mocks.readBibleData.mockResolvedValue(null);
        expect(await checkIsBookAvailable('GONE', 'GEN')).toBe(false);
        expect(await getBookKVList('GONE')).toBeNull();
        expect(await keyToBook('GONE', 'GEN')).toBeNull();
        expect(await getBookVKList('GONE')).toBeNull();
        expect(await bookToKey('GONE', 'Genesis')).toBeNull();
        expect(await getChapterCount('GONE', 'Genesis')).toBeNull();
        expect(mocks.readBibleData).toHaveBeenCalledWith('GONE', '_info');
        expect(mocks.getModelChapterCount).not.toHaveBeenCalled();
    });

    test('has no chapter data either', async () => {
        mocks.readBibleData.mockResolvedValue(null);
        expect(await getChapterData('GONE', 'GEN', 1)).toBeNull();
        expect(await getVerses('GONE', 'GEN', 1)).toBeNull();
        expect(mocks.readBibleData).toHaveBeenCalledWith('GONE', 'GEN.1');
    });
});

describe('getBookVKList', () => {
    test('rewrites a leading locale number but keeps a leading word', async () => {
        mocks.readBibleData.mockResolvedValue({
            booksAvailable: ['SNG', 'TI2'],
            keyBookMap: { SNG: 'Song of Songs', TI2: '２ ✠✠' },
            locale: 'xx',
        });
        const bookVKList = await getBookVKList('XXSV');
        expect(bookVKList).toEqual({
            'Song of Songs': 'SNG',
            'song of songs': 'SNG',
            '２ ✠✠': 'TI2',
            '2 ✠✠': 'TI2',
        });
        expect(await bookToKey('XXSV', 'Song Of Songs')).toBe('SNG');
        expect(mocks.fromLocaleNumBible).toHaveBeenCalledWith('XXSV', 'Song');
    });
});

describe('checkIsApocrypha', () => {
    test('is false for every book of a model without apocrypha', () => {
        expect(checkIsApocrypha('TOB')).toBe(false);
        mocks.getBibleModelInfo.mockReturnValue({
            bookKeysOld: ['GEN'],
            apocryphalBooks: ['TOB'],
        });
        expect(checkIsApocrypha('TOB')).toBe(true);
    });
});
