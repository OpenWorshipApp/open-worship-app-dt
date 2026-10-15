import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
    getBibleInfo: vi.fn(),
    getOnlineBibleInfoList: vi.fn(),
    toLocaleNumBible: vi.fn(),
}));

vi.mock('./bibleInfoHelpers', () => ({
    checkIsBookAvailable: vi.fn(),
    getBibleInfo: fixture.getBibleInfo,
    getChapterData: vi.fn(),
}));
vi.mock('./bibleDownloadHelpers', () => ({
    getOnlineBibleInfoList: fixture.getOnlineBibleInfoList,
}));
vi.mock('../appHooks', () => ({ useAppEffectAsync: vi.fn() }));
vi.mock('./bibleLogicHelpers2', () => ({
    toLocaleNumBible: fixture.toLocaleNumBible,
}));
vi.mock('./bibleModelHelpers', () => ({
    getBibleModelInfo: () => ({
        keyBookMap: { GEN: 'Genesis', EXO: 'Exodus', '1TI': '1 Timothy' },
        books: {
            GEN: { chapterCount: 2 },
            EXO: { chapterCount: 1 },
            '1TI': { chapterCount: 3 },
        },
        bookKeysOrder: ['GEN', 'EXO', '1TI'],
    }),
}));

import {
    fromBibleFileName,
    genBookMatches,
    genChapterMatches,
    getBibleInfoWithStatusList,
    getModelChapterCount,
    getModelKeyBookMap,
    toBibleFileName,
    toChapterList,
} from './bibleLogicHelpers1';

beforeEach(() => {
    vi.clearAllMocks();
    fixture.getBibleInfo.mockImplementation(async (key: string) =>
        key === 'MISSING'
            ? null
            : {
                  keyBookMap: {
                      GEN: 'Genesis',
                      EXO: 'Exodus',
                      '1TI': 'First Timothy',
                  },
                  booksAvailable: ['GEN', '1TI'],
              },
    );
    fixture.toLocaleNumBible.mockImplementation(
        async (_key: string, num: number) => `${num}`,
    );
    fixture.getOnlineBibleInfoList.mockResolvedValue([
        { key: 'KJV' },
        { key: 'MISSING' },
    ]);
});

describe('Bible book, chapter and file-name lookup', () => {
    it('ranks a localized book prefix and marks installed books', async () => {
        expect(await genBookMatches('KJV', { guessingBook: 'Gen' })).toEqual([
            {
                bibleKey: 'KJV',
                bookKey: 'GEN',
                book: 'Genesis',
                modelBook: 'Genesis',
                isAvailable: true,
            },
        ]);
        expect(
            await genBookMatches('KJV', { guessingBook: 'Exo' }),
        ).toMatchObject([{ bookKey: 'EXO', isAvailable: false }]);
    });

    it('recovers when a numbered book is typed with its number last', async () => {
        expect(
            await genBookMatches('KJV', { guessingBook: 'Timothy1' }),
        ).toMatchObject([{ bookKey: '1TI', book: 'First Timothy' }]);
        expect(await genBookMatches('KJV', { guessingBook: 'ZZZ' })).toEqual(
            [],
        );
        fixture.getBibleInfo.mockResolvedValueOnce(null);
        expect(
            await genBookMatches('MISSING', { guessingBook: 'Genesis' }),
        ).toBeNull();
    });

    it('offers all chapters or narrows to a typed chapter number', async () => {
        expect(await genChapterMatches('KJV', 'GEN', null)).toEqual([
            { chapter: 1, chapterLocaleString: '1' },
            { chapter: 2, chapterLocaleString: '2' },
        ]);
        expect(await genChapterMatches('KJV', 'GEN', '2')).toEqual([
            { chapter: 2, chapterLocaleString: '2' },
        ]);
        expect(getModelChapterCount('1TI')).toBe(3);
        expect(getModelKeyBookMap()).toMatchObject({ GEN: 'Genesis' });
    });

    it('builds localized chapter titles and returns null for an unavailable Bible', async () => {
        expect(await Promise.all(toChapterList('KJV', 'GEN'))).toEqual([
            'Genesis 1',
            'Genesis 2',
        ]);
        fixture.getBibleInfo.mockResolvedValueOnce(null);
        expect(await Promise.all(toChapterList('MISSING', 'EXO'))).toEqual([
            null,
        ]);
    });

    it('converts chapter file names and refuses an out-of-range chapter', () => {
        expect(toBibleFileName('GEN', 1)).toBe('0000-GEN.1');
        expect(toBibleFileName('EXO', 1)).toBe('0002-EXO.1');
        expect(fromBibleFileName('0002-EXO.1')).toEqual({
            bookKey: 'EXO',
            chapterNum: 1,
        });
        expect(fromBibleFileName('wrong-name')).toBeNull();
        expect(() => toBibleFileName('GEN', 3)).toThrow(
            'Invalid chapter number',
        );
    });

    it('reports which online versions are installed', async () => {
        const rows = await getBibleInfoWithStatusList();
        expect(rows[0].slice(0, 2)).toEqual(['KJV', true]);
        expect(rows[1].slice(0, 2)).toEqual(['MISSING', false]);
        fixture.getOnlineBibleInfoList.mockResolvedValueOnce(null);
        expect(await getBibleInfoWithStatusList()).toEqual([]);
    });
});
