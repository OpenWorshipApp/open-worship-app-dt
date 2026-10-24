/**
 * What the Bible Reader is ON when a Resources file is handed to the
 * assistant -- the passage a person was reading when they pressed the 🤖 on
 * a row of that panel.
 *
 * 2026-10-22, the user's goal with a picture of the panel, `MAT.18.pdf`'s 🤖
 * circled, under a Reader open on Matthew 18:15-17: _make the chatbot
 * smarter to interact with user for the selected resource file_. The tab it
 * opened offered verses 1, 2 and 3 of a chapter they were reading verses 15
 * to 17 of: the file crossed, what they were reading did not.
 *
 * A leaf with no imports, like `lookupAskHelpers.ts`: the panel writes it
 * without pulling the chat into the Reader, and the same check reads it back
 * in the chat and off a saved conversation.
 */

export type ResourceReadingType = {
    // The book and chapter the Reader is on: `MAT`, 18.
    bookKey: string;
    chapter: number;
    // The verses chosen inside that chapter. Absent when the pane is on a
    // passage that runs into another chapter, or when the file belongs to
    // the whole book -- the chapter is all that is then worth saying.
    verseStart?: number;
    verseEnd?: number;
    // The passage as the Reader titles it, in its Bible's own words and
    // digits: `ម៉ាថាយ ១៨:១៥-១៧`.
    title: string;
    bibleKey?: string;
};

// The same shapes the rest of the chat trusts: a book code (`MAT`, `1CH`), a
// Bible's short name (no space, no quote), a title that is one line.
const BOOK_KEY_PATTERN = /^[1-4A-Z][A-Z0-9]{2}$/;
const BIBLE_KEY_PATTERN = /^[^\s"“”]{1,24}$/u;
const MAX_TITLE_CHARS = 120;
// No book has more chapters (Psalms, 150) or a chapter more verses (Psalm
// 119, 176) than these; anything past them was not written by the Reader.
const MAX_CHAPTER = 200;
const MAX_VERSE = 200;

function toWholeNumber(value: unknown, max: number) {
    return typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= 0 &&
        value <= max
        ? value
        : null;
}

/**
 * The reading as it may be trusted, or null: every field checked and copied
 * by name, so a hand-edited setting cannot carry anything else along. A
 * verse range that does not read forwards is dropped and the chapter kept.
 */
export function toValidResourceReading(raw: any): ResourceReadingType | null {
    const chapter = toWholeNumber(raw?.chapter, MAX_CHAPTER);
    if (
        typeof raw?.bookKey !== 'string' ||
        !BOOK_KEY_PATTERN.test(raw.bookKey) ||
        chapter === null ||
        typeof raw.title !== 'string'
    ) {
        return null;
    }
    const title = raw.title.replaceAll(/\s+/g, ' ').trim();
    if (title.length === 0) {
        return null;
    }
    const verseStart = toWholeNumber(raw.verseStart, MAX_VERSE);
    const verseEnd = toWholeNumber(raw.verseEnd, MAX_VERSE);
    return {
        bookKey: raw.bookKey,
        chapter,
        ...(verseStart !== null &&
        verseEnd !== null &&
        verseStart >= 1 &&
        verseEnd >= verseStart
            ? { verseStart, verseEnd }
            : {}),
        title: title.slice(0, MAX_TITLE_CHARS),
        ...(typeof raw.bibleKey === 'string' &&
        BIBLE_KEY_PATTERN.test(raw.bibleKey)
            ? { bibleKey: raw.bibleKey }
            : {}),
    };
}
