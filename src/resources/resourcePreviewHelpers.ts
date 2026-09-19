import { checkIsBibleNoteFileName } from '../bible-list/note/bibleNotePreviewHelpers';
import {
    toValidVerseComments,
    toValidVerseHighlights,
    toVerseBibleKey,
    type VerseHighlightColorKeyType,
} from '../bible-list/note/noteItemHelpers';
import { checkIsMarkdownPreviewFileName } from '../markdown-preview/markdownPreviewParamHelpers';
import { fsGetFileSize, fsReadFile } from '../server/fileHelpers';

/**
 * The files this panel shows INSIDE the app instead of handing them to the
 * operating system -- which, for a `.own`, has no application to hand it to.
 *
 *  - `note`: a bible note file. Its row opens to what is inside it -- its
 *    notes, each opening in the Bible Note window read-only, and the verses
 *    marked in it with their highlights and comments.
 *  - `markdown`: opens in the Markdown Preview window.
 *
 * Decided by the NAME, unlike a link list: both formats are this app's own
 * (or plain text), so the extension is a promise the content can keep, and a
 * file that turns out unreadable says so where it is opened.
 */
export type ResourcePreviewKindType = 'note' | 'markdown';

export function toResourcePreviewKind(
    fileFullName: string,
): ResourcePreviewKindType | null {
    if (checkIsBibleNoteFileName(fileFullName)) {
        return 'note';
    }
    if (checkIsMarkdownPreviewFileName(fileFullName)) {
        return 'markdown';
    }
    return null;
}

/** One ordinary note inside a note file: what a row needs, and no more. */
export type ResourceNoteRowType = { kind: 'note'; id: number; title: string };

export type ResourceVerseHighlightType = {
    id: string;
    text: string;
    color: VerseHighlightColorKeyType;
};
export type ResourceVerseCommentType = {
    id: string;
    text: string;
    comment: string;
};

/**
 * One marked verse inside a note file -- the highlights and comments made on
 * it -- as the Bible Notes panel lists it, less the offsets, which only mean
 * anything to the painter in the reader.
 */
export type ResourceVerseRowType = {
    kind: 'verse';
    id: number;
    /** `(KJV) Genesis 22:1`, localized when the mark was made. */
    title: string;
    /** `(KJV) GEN 22:1`: the verse a press opens. */
    verseKey: string;
    /** `KJV`, so the words are set in that bible's own face. */
    bibleKey: string;
    /** Folded or open, as the file's own Bible Notes panel last left it. */
    isOpened: boolean;
    highlights: ResourceVerseHighlightType[];
    comments: ResourceVerseCommentType[];
};

/** Everything in a note file, in the file's own order. */
export type ResourceNoteItemType = ResourceNoteRowType | ResourceVerseRowType;

export type ResourceNoteItemsFailureType =
    'not-a-note' | 'too-large' | 'unreadable';

export type ResourceNoteItemsResultType = {
    items: ResourceNoteItemType[];
    failureReason: ResourceNoteItemsFailureType | null;
};

/**
 * Past this the file's SIZE is read and nothing else. A note carrying drawings
 * is legitimately a few megabytes, and `JSON.parse` has no incremental mode:
 * the list below is built from a full parse, which on the machines this app
 * targets must never be of an arbitrarily large file sitting in somebody's
 * folder under a `.own` name.
 */
export const MAX_RESOURCE_NOTE_FILE_SIZE = 16 * 1024 * 1024;

function genFailure(
    failureReason: ResourceNoteItemsFailureType,
): ResourceNoteItemsResultType {
    return { items: [], failureReason };
}

function toResourceVerseRow(item: any): ResourceVerseRowType | null {
    // The marks are normalized exactly as `NoteItem.validate` does: one
    // malformed mark is dropped on its own.
    const highlights = toValidVerseHighlights(item.highlights).map(
        ({ id, text, color }) => {
            return { id, text, color };
        },
    );
    const comments = toValidVerseComments(item.comments).map(
        ({ id, text, comment }) => {
            return { id, text, comment };
        },
    );
    // A verse with nothing left on it is one the Bible Notes panel deletes; a
    // row here with nothing under it would say nothing.
    if (highlights.length + comments.length === 0) {
        return null;
    }
    return {
        kind: 'verse',
        id: item.metadata.id,
        title: typeof item.title === 'string' ? item.title : '',
        verseKey: item.verseKey,
        bibleKey: toVerseBibleKey(item.verseKey) ?? '',
        isOpened: item.metadata.isOpened === true,
        highlights,
        comments,
    };
}

/**
 * What one note file's text holds. Pure. Keeps a note's id and title and a
 * mark's words -- a note's content, which is most of the file, is dropped with
 * the parse, so a row that stays open holds short strings rather than notes.
 *
 * The shape checked is what `NoteItem.validate` requires of an item, so a note
 * offered here is one the Bible Note window will actually open.
 */
export function parseResourceNoteItems(
    text: string,
): ResourceNoteItemsResultType {
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        data = null;
    }
    if (!Array.isArray(data?.items)) {
        return genFailure('not-a-note');
    }
    const items: ResourceNoteItemType[] = [];
    for (const item of data.items) {
        if (
            typeof item !== 'object' ||
            item === null ||
            typeof item.metadata?.id !== 'number' ||
            typeof item.content !== 'string'
        ) {
            continue;
        }
        // A verse item: the highlights and comments kept on one verse.
        if (typeof item.verseKey === 'string') {
            const verseRow = toResourceVerseRow(item);
            if (verseRow !== null) {
                items.push(verseRow);
            }
            continue;
        }
        items.push({
            kind: 'note',
            id: item.metadata.id,
            title: typeof item.title === 'string' ? item.title : '',
        });
    }
    return { items, failureReason: null };
}

/**
 * Read on demand -- the row reads its file when it is first opened, never as
 * it appears -- and never cached: re-reading on the next open is what shows a
 * note added since. Never throws.
 */
export async function readResourceNoteItems(
    filePath: string,
): Promise<ResourceNoteItemsResultType> {
    try {
        // The size FIRST: the point of the cap is not to read the bytes.
        if ((await fsGetFileSize(filePath)) > MAX_RESOURCE_NOTE_FILE_SIZE) {
            return genFailure('too-large');
        }
        return parseResourceNoteItems(await fsReadFile(filePath));
    } catch {
        return genFailure('unreadable');
    }
}
