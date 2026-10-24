import {
    checkIsBookAvailable,
    keyToBook,
} from '../helper/bible-helpers/bibleInfoHelpers';
import {
    genBookMatches,
    genChapterMatches,
} from '../helper/bible-helpers/bibleLogicHelpers1';
import {
    parseChapterFromGuessing,
    toInputText,
    toTrailingReference,
    type EditingResultType,
    type ExtractedBibleResult,
} from '../helper/bible-helpers/bibleLogicHelpers2';
import { checkIsCrossChapterTarget } from '../helper/bible-helpers/bibleTargetHelpers';

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

/**
 * The reference-box text a book pick writes: the book's own name, with a
 * "23:1" typed after a book that matched nothing kept instead of dropped.
 */
export async function genBookPickInputText(
    bibleKey: string,
    newBook: string,
    guessingBook: string | null,
): Promise<string> {
    const newText = await toInputText(bibleKey, newBook);
    const trailingReference = toTrailingReference(guessingBook);
    return trailingReference !== null && newText.endsWith(' ')
        ? `${newText}${trailingReference}`
        : newText;
}

export async function genChapterPickInputText(
    bibleKey: string,
    bookKey: string,
    newChapter: number,
): Promise<string> {
    const book = await keyToBook(bibleKey, bookKey);
    const newText = await toInputText(bibleKey, book, newChapter);
    return `${newText}:`;
}

/**
 * What Tab in the reference box completes the typed text to, or null when
 * there is nothing to complete. Tab is the box's autocomplete and never moves
 * focus away mid-typing; it completes as far as the text can go:
 * - `John 3:16` -> `John 3:16-` (a single verse steps into a range)
 * - `Psalm 23`  -> `Psalm 23:` (a resolved chapter steps to its verses)
 * - `Matt` / `Matthew` -> the book or chapter option Enter would pick
 */
export async function genLookupTabCompletionText(
    bibleKey: string,
    editingResult: EditingResultType,
): Promise<string | null> {
    const { result, oldInputText } = editingResult;
    const { bookKey, guessingBook, guessingChapter, bibleItem } = result;
    // Nothing typed at all: the book list answers a guessing text, and an
    // empty box is not a completion attempt.
    if (oldInputText.trim() === '') {
        return null;
    }
    if (bibleItem !== null) {
        // `John 1:2-3:2` already has its end, its verses only look the same.
        return !checkIsCrossChapterTarget(bibleItem.target) &&
            bibleItem.target.verseStart === bibleItem.target.verseEnd
            ? `${oldInputText}-`
            : null;
    }
    if (bookKey !== null && guessingChapter !== null) {
        const chapter = await parseChapterFromGuessing(
            bibleKey,
            bookKey,
            guessingChapter,
        );
        if (chapter !== null) {
            return `${oldInputText}:`;
        }
    }
    const pick = await genLookupEnterPick(bibleKey, result);
    if (pick === null) {
        return null;
    }
    if (pick.kind === 'book') {
        return genBookPickInputText(bibleKey, pick.book, guessingBook);
    }
    if (bookKey === null) {
        // Unreachable: a chapter pick exists only with a resolved book.
        return null;
    }
    return genChapterPickInputText(bibleKey, bookKey, pick.chapter);
}
