/**
 * The pure half of the chat box's Bible input aid (2026-10-18): what a
 * reference being typed is made of, and which books it could be.
 *
 * The ask box helps a volunteer type a passage the way the Reader's reference
 * box does -- book, then chapter, then verse -- in the language their Bible
 * is written in. The app side (`agentBibleSuggestHelpers.ts`) adds the
 * installed Bible's names, chapter counts, verse counts and digits; this
 * module reads the draft and matches names, so every rule is testable with no
 * app. The window's own routing is `bibleInputSuggestHelpers.ts`.
 *
 * Pure. Zero-width spaces (Khmer keyboards) are taken out first.
 */

export type BibleBookOptionType = {
    bookKey: string;
    /** The book's name in the Bible being read. */
    name: string;
    /** Its English name, for the second line. */
    englishName: string;
};

export type BibleReferencePrefixType = {
    /** What is before the first digit: a book name, or part of one. */
    bookPart: string;
    /** The digits before the colon, as typed (any script). */
    chapterDigits: string;
    /** The digits after the colon, as typed (any script). */
    verseDigits: string;
    hasColon: boolean;
    hasDigits: boolean;
};

const ZERO_WIDTH_PATTERN = /\p{Cf}/gu;

/** The draft as it is read: no zero-width characters, one space each. */
export function toReferenceDraft(text: string) {
    return text.replace(ZERO_WIDTH_PATTERN, '').replace(/\s+/g, ' ').trim();
}

/** `John 3:16`, `យ៉ូហាន ៣:១៦`, `1 John 4` -- a reference being typed. */
export function readBibleReferencePrefix(
    text: string,
): BibleReferencePrefixType {
    const plain = toReferenceDraft(text);
    // A NUMBERED BOOK opens with a digit too (`1 John 4`, `2 Kings 5`): the
    // ordinal belongs to the name, and the chapter is the first digit after
    // it. Without this, `1 John 4` read as no book and chapter `1John4`.
    const leadingOrdinal = /^\p{Nd}{1,3}\s*(?=\p{L})/u.exec(plain);
    const searchFrom = leadingOrdinal === null ? 0 : leadingOrdinal[0].length;
    const restText = plain.slice(searchFrom);
    const digitInRest = restText.search(/\p{Nd}/u);
    const digitAt = digitInRest === -1 ? -1 : searchFrom + digitInRest;
    if (digitAt === -1) {
        return {
            bookPart: plain,
            chapterDigits: '',
            verseDigits: '',
            hasColon: false,
            hasDigits: false,
        };
    }
    const bookPart = plain.slice(0, digitAt).trim();
    const rest = plain.slice(digitAt);
    const colonAt = rest.search(/[:៖]/u);
    if (colonAt === -1) {
        return {
            bookPart,
            chapterDigits: rest.replace(/\s+/g, ''),
            verseDigits: '',
            hasColon: false,
            hasDigits: true,
        };
    }
    return {
        bookPart,
        chapterDigits: rest.slice(0, colonAt).replace(/\s+/g, ''),
        verseDigits: rest.slice(colonAt + 1).replace(/\s+/g, ''),
        hasColon: true,
        hasDigits: true,
    };
}

/** A name compared without case, spaces or dots: `1 john`, `1John`. */
export function toCompactBookName(text: string) {
    return text
        .toLowerCase()
        .normalize('NFKC')
        .replaceAll(/[\s.]+/g, '');
}

/**
 * The books the typed words could be, the exact name first, then every name
 * starting with them. `Jo` is John, Job, Joel, Jonah and Joshua at once, and
 * the person picks -- the same rule `resolveBookKey` uses, but a LIST.
 */
export function matchBibleBooks(
    bookPart: string,
    bookList: readonly BibleBookOptionType[],
) {
    const wanted = toCompactBookName(bookPart);
    if (wanted.length === 0) {
        return [];
    }
    const exact = bookList.filter((book) => {
        return (
            book.bookKey.toLowerCase() === wanted ||
            toCompactBookName(book.name) === wanted ||
            toCompactBookName(book.englishName) === wanted
        );
    });
    if (exact.length > 0) {
        return exact;
    }
    return bookList.filter((book) => {
        return (
            book.bookKey.toLowerCase().startsWith(wanted) ||
            toCompactBookName(book.name).startsWith(wanted) ||
            toCompactBookName(book.englishName).startsWith(wanted)
        );
    });
}

/**
 * The numbers a typed prefix could still become: all of `1..max` when nothing
 * has been typed, else those written with it (`1` -> 1, 10-19). The digits
 * are ASCII here; the app side has already read the Bible's own digits.
 */
export function listNumberPrefixMatches(typedDigits: string, max: number) {
    const prefix = typedDigits.replaceAll(/[^\d]/g, '');
    const all: number[] = [];
    for (let value = 1; value <= max; value++) {
        if (prefix.length === 0 || String(value).startsWith(prefix)) {
            all.push(value);
        }
    }
    return all;
}
