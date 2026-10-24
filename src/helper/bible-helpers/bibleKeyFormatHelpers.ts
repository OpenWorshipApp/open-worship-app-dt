/**
 * How a bible reference is spelled as a key: `JHN 3`, `JHN 3:16-18` and,
 * across chapters, `JHN 1:2-3:4`.
 *
 * A leaf module on purpose. These are pure string formatters, but they used to
 * live in `bibleInfoHelpers`, which reaches the bible database and the app
 * provider — so anything that only wanted to name a verse paid for that whole
 * graph at import time. `bibleInfoHelpers` re-exports them, so every existing
 * caller is unaffected.
 */

export function toChapterFullKeyFormat(
    bookKey: string,
    chapter: string | number,
) {
    return `${bookKey} ${chapter}`;
}

export function toVerseFullKeyFormat(
    bookKey: string,
    chapter: string | number,
    verseStart: string | number,
    verseEnd?: string | number,
    // Written only when it names ANOTHER chapter; `verseEnd` is then that
    // chapter's, and is always spelled out (`JHN 1:4-3:4`, never `1:4-3:`).
    chapterEnd?: string | number | null,
) {
    if (
        chapterEnd !== undefined &&
        chapterEnd !== null &&
        `${chapterEnd}` !== `${chapter}`
    ) {
        return (
            `${toChapterFullKeyFormat(bookKey, chapter)}:${verseStart}` +
            `-${chapterEnd}:${verseEnd ?? verseStart}`
        );
    }
    verseEnd ??= verseStart;
    verseEnd = verseEnd === verseStart ? '' : '-' + verseEnd;
    return `${toChapterFullKeyFormat(bookKey, chapter)}:${verseStart}${verseEnd}`;
}
