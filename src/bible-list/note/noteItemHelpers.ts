export type NoteItemMetadataType = {
    id: number;
    createdAt: Date;
    updatedAt: Date;
    isOpened?: boolean;
};

/**
 * The fixed highlighter palette. Fixed, not free-form, because each colour is
 * painted through the CSS Custom Highlight API and therefore needs its own
 * `::highlight(...)` rule in the stylesheet — see `BibleViewComp.scss`. Adding a
 * colour means adding a rule; nothing else.
 */
export const VERSE_HIGHLIGHT_COLOR_KEYS = [
    'yellow',
    'green',
    'blue',
    'pink',
    'orange',
    'purple',
] as const;
export type VerseHighlightColorKeyType =
    (typeof VERSE_HIGHLIGHT_COLOR_KEYS)[number];

/**
 * One mark on a run of characters inside a single verse.
 *
 * `start`/`end` are character offsets into the verse's RENDERED text — the
 * concatenated text nodes of the `[data-bible-verse-key]` element — so they are
 * specific to one translation, which is why a verse item is keyed by
 * `bibleVersesKey` (`(KJV) GEN 22:1`) and not by the translation-independent
 * `kjvBibleVersesKey`.
 *
 * `text` is a snapshot of the marked words. It is never used to re-locate the
 * mark, only to label it in the Bible Notes tree, where showing the words beats
 * showing a pair of numbers.
 */
export type VerseAnnotationBaseType = {
    id: string;
    start: number;
    end: number;
    text: string;
    createdAt: string;
    updatedAt: string;
};
export type VerseHighlightType = VerseAnnotationBaseType & {
    color: VerseHighlightColorKeyType;
};
export type VerseCommentType = VerseAnnotationBaseType & {
    comment: string;
};

/**
 * A note item is EITHER an ordinary bible note (rich text edited by the
 * `bible-note` package) OR a verse item — the marks made on one verse. The
 * discriminator is `verseKey`: an item without one is an ordinary note and
 * behaves exactly as it always did.
 *
 * Both live in the same `items` array of the same `.note` file on purpose: that
 * is what puts the marks in the Bible Notes panel beside the notes, and it hands
 * them the file's existing save, watch, archive and backup machinery for free.
 */
export type NoteItemType = {
    title: string;
    content: string;
    metadata: NoteItemMetadataType;
    verseKey?: string;
    highlights?: VerseHighlightType[];
    comments?: VerseCommentType[];
};

function checkIsValidAnnotationBase(value: any) {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof value.id === 'string' &&
        value.id !== '' &&
        typeof value.start === 'number' &&
        typeof value.end === 'number' &&
        value.start >= 0 &&
        value.end > value.start &&
        typeof value.text === 'string'
    );
}

// Dropped one by one rather than failing the whole item: a single unreadable
// mark must not cost the user the rest of the verse's marks, let alone make the
// note file throw on load.
function toValidAnnotations<T extends VerseAnnotationBaseType>(
    value: any,
    checkIsValidExtra: (item: any) => boolean,
): T[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((item: any) => {
        return checkIsValidAnnotationBase(item) && checkIsValidExtra(item);
    });
}

export function toValidVerseHighlights(value: any): VerseHighlightType[] {
    return toValidAnnotations<VerseHighlightType>(value, (item) => {
        return VERSE_HIGHLIGHT_COLOR_KEYS.includes(item.color);
    });
}

export function toValidVerseComments(value: any): VerseCommentType[] {
    return toValidAnnotations<VerseCommentType>(value, (item) => {
        return typeof item.comment === 'string';
    });
}
