import { beforeEach, describe, expect, it, vi } from 'vitest';

// A model with a book long enough for two-digit chapters, and a Bible that
// names only some of the model's books.
const fixture = vi.hoisted(() => ({
    getBibleInfo: vi.fn(),
    toLocaleNumBible: vi.fn(),
}));

vi.mock('./bibleInfoHelpers', () => ({
    checkIsBookAvailable: async () => true,
    getBibleInfo: fixture.getBibleInfo,
    getChapterData: async () => null,
}));
vi.mock('./bibleDownloadHelpers', () => ({
    getOnlineBibleInfoList: async () => null,
}));
vi.mock('../appHooks', () => ({ useAppEffectAsync: () => {} }));
vi.mock('./bibleLogicHelpers2', () => ({
    toLocaleNumBible: fixture.toLocaleNumBible,
}));
vi.mock('./bibleModelHelpers', () => ({
    getBibleModelInfo: () => ({
        keyBookMap: { GEN: 'Genesis', EXO: 'Exodus', '1TI': '1 Timothy' },
        books: {
            GEN: { chapterCount: 12 },
            EXO: { chapterCount: 3 },
            '1TI': { chapterCount: 6 },
        },
        bookKeysOrder: ['GEN', 'EXO', '1TI'],
    }),
}));

import {
    genBookMatches,
    genChapterMatches,
    toBibleFileName,
} from './bibleLogicHelpers1';

beforeEach(() => {
    fixture.getBibleInfo.mockResolvedValue({
        // This Bible has no name of its own for 1 Timothy.
        keyBookMap: { GEN: 'Genesis', EXO: 'Exodus' },
        booksAvailable: ['GEN', 'EXO'],
    });
    fixture.toLocaleNumBible.mockImplementation(
        async (_bibleKey: string, num: number) => `${num}`,
    );
});

describe('genChapterMatches', () => {
    it('puts the chapter typed exactly ahead of those that merely contain it', async () => {
        const matches = await genChapterMatches('KJV', 'GEN', '12');
        const chapters = matches.map((match) => match.chapter);
        expect(chapters[0]).toBe(12);
        expect(chapters.slice(1).sort((a, b) => a - b)).toEqual([1, 2]);
    });

    it('keeps an exact first chapter first', async () => {
        const matches = await genChapterMatches('KJV', 'GEN', '1');
        expect(matches.map((match) => match.chapter)).toEqual([1, 10, 11, 12]);
    });
});

describe('genBookMatches', () => {
    it('names a book the Bible does not translate by the model', async () => {
        expect(await genBookMatches('KJV', { guessingBook: '1 Tim' })).toEqual([
            {
                bibleKey: 'KJV',
                bookKey: '1TI',
                book: '1 Timothy',
                modelBook: '1 Timothy',
                isAvailable: false,
            },
        ]);
    });

    it('falls back to a book that contains the typed letters anywhere', async () => {
        expect(await genBookMatches('KJV', { guessingBook: 'xodu' })).toEqual([
            {
                bibleKey: 'KJV',
                bookKey: 'EXO',
                book: 'Exodus',
                modelBook: 'Exodus',
                isAvailable: true,
            },
        ]);
    });
});

describe('toBibleFileName', () => {
    it('files a chapter-0 introduction beside its book’s first chapter', () => {
        expect(toBibleFileName('GEN', 0)).toBe('0000-GEN.0');
        expect(toBibleFileName('GEN', 1)).toBe('0000-GEN.1');
        expect(toBibleFileName('EXO', 0)).toBe('0012-EXO.0');
        expect(toBibleFileName('1TI', 2)).toBe('0016-1TI.2');
    });
});
