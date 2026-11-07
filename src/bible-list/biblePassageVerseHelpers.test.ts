import { beforeEach, describe, expect, test, vi } from 'vitest';
import type BibleItem from './BibleItem';

const h = vi.hoisted(() => ({
    getVerses: vi.fn(),
    toast: vi.fn(),
}));

vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    getVerses: h.getVerses,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: h.toast }));

import { readBiblePassageVerses } from './biblePassageVerseHelpers';

const CHAPTERS: Record<string, Record<number, Record<string, string>>> = {
    A: {
        1: { '1': 'a1:1', '2': 'a1:2', '3': ' a1:3 ' },
        2: { '1': 'a2:1', '2': 'a2:2' },
    },
    // One verse more in chapter 1 than A: the passage's own version decides
    // where a chapter it runs on through ends.
    B: {
        1: { '1': 'b1:1', '2': 'b1:2', '3': 'b1:3', '4': 'b1:4' },
        2: { '1': 'b2:1', '2': 'b2:2' },
    },
};

function passage(target: Partial<BibleItem['target']>): BibleItem {
    return {
        isError: false,
        target: {
            bookKey: 'GEN',
            chapter: 1,
            verseStart: 1,
            verseEnd: 1,
            ...target,
        },
    } as BibleItem;
}

beforeEach(() => {
    vi.clearAllMocks();
    h.getVerses.mockImplementation(
        async (bibleKey: string, _bookKey: string, chapter: number) =>
            CHAPTERS[bibleKey]?.[chapter] ?? null,
    );
});

describe('readBiblePassageVerses', () => {
    test('every verse in order, with one trimmed text per version', async () => {
        const verses = await readBiblePassageVerses(
            passage({ verseStart: 2, verseEnd: 3 }),
            ['A', 'B'],
            'Title',
        );
        expect(verses).toEqual([
            { chapter: 1, verse: 2, textList: ['a1:2', 'b1:2'] },
            { chapter: 1, verse: 3, textList: ['a1:3', 'b1:3'] },
        ]);
        // Each chapter is read once per version.
        expect(h.getVerses).toHaveBeenCalledTimes(2);
    });

    test('across chapters, the first version counts where a chapter ends', async () => {
        const verses = await readBiblePassageVerses(
            passage({ verseStart: 3, chapterEnd: 2, verseEnd: 1 }),
            ['A', 'B'],
            'Title',
        );
        expect(verses).toEqual([
            { chapter: 1, verse: 3, textList: ['a1:3', 'b1:3'] },
            { chapter: 2, verse: 1, textList: ['a2:1', 'b2:1'] },
        ]);
    });

    test('a version lacking a verse is named under the caller title, and nothing comes back', async () => {
        expect(
            await readBiblePassageVerses(
                passage({ verseStart: 3, verseEnd: 4 }),
                ['B', 'A'],
                'Create Lyric',
            ),
        ).toBeNull();
        expect(h.toast).toHaveBeenCalledExactlyOnceWith(
            'Create Lyric',
            'Bible passage is unavailable in: A',
        );
    });

    test('a missing chapter, or a verse only of spaces, is unavailable too', async () => {
        h.getVerses.mockResolvedValueOnce(null);
        expect(
            await readBiblePassageVerses(passage({}), ['A'], 'T'),
        ).toBeNull();
        h.getVerses.mockResolvedValueOnce({ '1': '   ' });
        expect(
            await readBiblePassageVerses(passage({}), ['A'], 'T'),
        ).toBeNull();
        expect(h.toast).toHaveBeenCalledTimes(2);
    });

    test('a passage that cannot be read throws before reading anything', async () => {
        for (const item of [
            { ...passage({}), isError: true } as BibleItem,
            passage({ verseStart: 3, verseEnd: 2 }),
            passage({ verseStart: Number.NaN }),
        ]) {
            await expect(
                readBiblePassageVerses(item, ['A'], 'T'),
            ).rejects.toThrow('Bible passage is unavailable');
        }
        expect(h.getVerses).not.toHaveBeenCalled();
    });
});
