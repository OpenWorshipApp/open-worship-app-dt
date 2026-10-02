import { checkIsBookAvailable } from '../helper/bible-helpers/bibleInfoHelpers';
import {
    genBookMatches,
    genChapterMatches,
} from '../helper/bible-helpers/bibleLogicHelpers1';
import type { ExtractedBibleResult } from '../helper/bible-helpers/bibleLogicHelpers2';

/**
 * Which book the book list highlights, and so which one Enter picks: the first
 * book the bible HAS, not the first row. A New-Testament-only bible lists
 * Genesis..Malachi disabled, and with row 0 the only candidate nothing was
 * highlighted, so Enter chose nothing.
 */
export function findDefaultBookIndex(
    matchedBooks: readonly { isAvailable: boolean }[],
) {
    return matchedBooks.findIndex((matchBook) => {
        return matchBook.isAvailable;
    });
}

export type LookupEnterPickType =
    { kind: 'book'; book: string } | { kind: 'chapter'; chapter: number };

/**
 * What Enter in the reference box picks for the text the box holds: the option
 * the book or chapter list highlights for that text, or nothing once the text
 * is already a passage.
 *
 * Worked out from the TEXT, never read off the lists on screen. Those are drawn
 * from an editing result that resolves after the keystroke -- and during a fast
 * burst only the newest request's result is ever applied -- so the list up when
 * Enter lands can be the previous text's. A fast `Genesis 1:1-31` + Enter from
 * Luke's chapter list pressed Luke's chapter 1, and the box became `Luke 1:`.
 */
export async function genLookupEnterPick(
    bibleKey: string,
    result: ExtractedBibleResult,
): Promise<LookupEnterPickType | null> {
    if (result.bibleItem !== null) {
        return null;
    }
    if (result.bookKey === null) {
        const matchedBooks = await genBookMatches(bibleKey, {
            guessingBook: result.guessingBook ?? '',
        });
        if (matchedBooks === null) {
            return null;
        }
        const index = findDefaultBookIndex(matchedBooks);
        return index === -1
            ? null
            : { kind: 'book', book: matchedBooks[index].book };
    }
    // A book and a chapter that still name no passage: no list is up.
    if (result.chapter !== null) {
        return null;
    }
    // The chapter list draws nothing for a book this bible lacks.
    if (!(await checkIsBookAvailable(bibleKey, result.bookKey))) {
        return null;
    }
    // The list's first option: its Introduction entry is drawn apart, and an
    // exact chapter is sorted to the front.
    const [chapterMatch] = await genChapterMatches(
        bibleKey,
        result.bookKey,
        result.guessingChapter,
    );
    return chapterMatch === undefined
        ? null
        : { kind: 'chapter', chapter: chapterMatch.chapter };
}
