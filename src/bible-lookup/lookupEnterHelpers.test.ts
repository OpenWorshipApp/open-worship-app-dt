import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    parseChapter: vi.fn(),
    toInputText: vi.fn(),
    toTrailingReference: vi.fn(),
    checkIsCrossChapterTarget: vi.fn(),
    checkIsBookAvailable: vi.fn(),
    keyToBook: vi.fn(),
    genBookMatches: vi.fn(),
    genChapterMatches: vi.fn(),
}));

vi.mock('../helper/bible-helpers/bibleLogicHelpers2', () => ({
    parseChapterFromGuessing: h.parseChapter,
    toInputText: h.toInputText,
    toTrailingReference: h.toTrailingReference,
}));
vi.mock('../helper/bible-helpers/bibleTargetHelpers', () => ({
    checkIsCrossChapterTarget: h.checkIsCrossChapterTarget,
}));
vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    checkIsBookAvailable: h.checkIsBookAvailable,
    keyToBook: h.keyToBook,
}));
vi.mock('../helper/bible-helpers/bibleLogicHelpers1', () => ({
    genBookMatches: h.genBookMatches,
    genChapterMatches: h.genChapterMatches,
}));

import {
    genBookPickInputText,
    genChapterPickInputText,
    genLookupTabCompletionText,
} from './lookupEnterHelpers';

function genEditingResult({
    oldInputText,
    bookKey = null as string | null,
    guessingBook = null as string | null,
    guessingChapter = null as number | null,
    chapter = null as number | null,
    bibleItem = null as any,
}: {
    oldInputText: string;
    bookKey?: string | null;
    guessingBook?: string | null;
    guessingChapter?: number | null;
    chapter?: number | null;
    bibleItem?: any;
}) {
    return {
        result: {
            bookKey,
            guessingBook,
            guessingChapter,
            chapter,
            bibleItem,
        },
        bibleKey: 'en',
        inputText: oldInputText,
        oldInputText,
        time: 0,
    } as any;
}

beforeEach(() => {
    h.parseChapter.mockReset().mockResolvedValue(null);
    h.toInputText
        .mockReset()
        .mockImplementation(
            async (_bibleKey: string, book = '', chapter: any = null) =>
                chapter == null ? `${book} ` : `${book} ${chapter}`,
        );
    h.toTrailingReference.mockReset().mockReturnValue(null);
    h.checkIsCrossChapterTarget.mockReset().mockReturnValue(false);
    h.checkIsBookAvailable.mockReset().mockResolvedValue(true);
    h.keyToBook
        .mockReset()
        .mockImplementation(
            async (_bibleKey: string, bookKey: string) =>
                (({ GEN: 'Genesis', PSA: 'Psalms' }) as any)[bookKey] ??
                bookKey,
        );
    h.genBookMatches.mockReset().mockResolvedValue([]);
    h.genChapterMatches.mockReset().mockResolvedValue([]);
});

describe('genLookupTabCompletionText', () => {
    it('does nothing for a blank box', async () => {
        const result = genEditingResult({ oldInputText: '   ' });
        expect(await genLookupTabCompletionText('en', result)).toBeNull();
        expect(h.genBookMatches).not.toHaveBeenCalled();
    });

    it('appends a dash to a single verse to start a range', async () => {
        const result = genEditingResult({
            oldInputText: 'John 3:16',
            bibleItem: { target: { verseStart: 16, verseEnd: 16 } },
        });
        expect(await genLookupTabCompletionText('en', result)).toBe(
            'John 3:16-',
        );
        expect(h.checkIsCrossChapterTarget).toHaveBeenCalled();
    });

    it('leaves a completed verse range alone', async () => {
        const result = genEditingResult({
            oldInputText: 'John 3:16-18',
            bibleItem: { target: { verseStart: 16, verseEnd: 18 } },
        });
        expect(await genLookupTabCompletionText('en', result)).toBeNull();
    });

    it('leaves a cross-chapter passage alone though its verses match', async () => {
        h.checkIsCrossChapterTarget.mockReturnValue(true);
        const result = genEditingResult({
            oldInputText: 'John 1:2-3:2',
            bibleItem: {
                target: {
                    chapter: 1,
                    verseStart: 2,
                    verseEnd: 2,
                    chapterEnd: 3,
                },
            },
        });
        expect(await genLookupTabCompletionText('en', result)).toBeNull();
    });

    it('appends a colon to a typed book and chapter', async () => {
        h.parseChapter.mockResolvedValue(23);
        const result = genEditingResult({
            oldInputText: 'Psalm 23',
            bookKey: 'PSA',
            guessingChapter: 23,
        });
        expect(await genLookupTabCompletionText('en', result)).toBe(
            'Psalm 23:',
        );
        expect(h.parseChapter).toHaveBeenCalledWith('en', 'PSA', 23);
    });

    it('completes a partial book name to the first available match', async () => {
        h.genBookMatches.mockResolvedValue([
            { book: 'Genesis', isAvailable: false },
            { book: 'Matthew', isAvailable: true },
        ]);
        const result = genEditingResult({
            oldInputText: 'Matt',
            guessingBook: 'Matt',
        });
        // The first book the bible HAS is the pick: a New-Testament-only
        // bible lists Genesis..Malachi disabled.
        expect(await genLookupTabCompletionText('en', result)).toBe('Matthew ');
        expect(h.toInputText).toHaveBeenCalledWith('en', 'Matthew');
    });

    it('keeps a trailing reference typed after an unknown book', async () => {
        h.genBookMatches.mockResolvedValue([
            { book: 'Psalms', isAvailable: true },
        ]);
        h.toTrailingReference.mockReturnValue('23:1');
        const result = genEditingResult({
            oldInputText: 'Ps 23:1',
            guessingBook: 'Ps 23:1',
        });
        expect(await genLookupTabCompletionText('en', result)).toBe(
            'Psalms 23:1',
        );
        expect(h.toTrailingReference).toHaveBeenCalledWith('Ps 23:1');
    });

    it('completes to the first chapter of a resolved book', async () => {
        h.genChapterMatches.mockResolvedValue([{ chapter: 1 }]);
        const result = genEditingResult({
            oldInputText: 'Genesis',
            bookKey: 'GEN',
        });
        expect(await genLookupTabCompletionText('en', result)).toBe(
            'Genesis 1:',
        );
        expect(h.keyToBook).toHaveBeenCalledWith('en', 'GEN');
        expect(h.toInputText).toHaveBeenCalledWith('en', 'Genesis', 1);
    });

    it('does nothing once the book and chapter are settled', async () => {
        const result = genEditingResult({
            oldInputText: 'Genesis 3',
            bookKey: 'GEN',
            chapter: 3,
        });
        expect(await genLookupTabCompletionText('en', result)).toBeNull();
        expect(h.genChapterMatches).not.toHaveBeenCalled();
    });
});

describe('genBookPickInputText', () => {
    it('writes the book name and keeps a trailing reference', async () => {
        h.toTrailingReference.mockReturnValue('23:1');
        expect(await genBookPickInputText('en', 'Psalms', 'Ps 23:1')).toBe(
            'Psalms 23:1',
        );
        h.toTrailingReference.mockReturnValue(null);
        expect(await genBookPickInputText('en', 'Psalms', null)).toBe(
            'Psalms ',
        );
    });
});

describe('genChapterPickInputText', () => {
    it('writes the book and chapter with a colon', async () => {
        expect(await genChapterPickInputText('en', 'GEN', 3)).toBe(
            'Genesis 3:',
        );
    });
});
