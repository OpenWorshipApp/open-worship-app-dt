import { tran } from '../../lang/langHelpers';
import { unlocking } from '../../server/unlockingHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import Note from './Note';
import NoteItem from './NoteItem';
import {
    type VerseCommentType,
    type VerseHighlightColorKeyType,
    type VerseHighlightType,
} from './noteItemHelpers';

/**
 * Everything needed to file a mark against one verse, in the three forms the
 * note file wants it:
 *
 * - `verseKey` (`(KJV) GEN 22:1`) identifies the verse item. It carries the
 *   bible key because the character offsets of a mark only mean anything against
 *   one translation's text.
 * - `shortVerse` (`GEN 22:1`) becomes the item's `content`, which is what makes
 *   the existing note-to-verse index light the verse number up.
 * - `title` (`(KJV) Genesis 22:1`) is the row label, localized.
 */
export type VerseAnchorType = {
    verseKey: string;
    shortVerse: string;
    title: string;
};

/**
 * Every write is a whole-file read-modify-write with no locking of its own, and
 * `Note` has no in-memory singleton — six rapid swatch clicks would be six
 * overlapping round trips, of which five would be lost. Keyed by file path so
 * two different note files still save in parallel.
 */
function toNoteLockKey(filePath: string) {
    return `verse-annotation > ${filePath}`;
}

export type VerseHighlightRefType = {
    filePath: string;
    noteItemId: number;
    highlight: VerseHighlightType;
};
export type VerseCommentRefType = {
    filePath: string;
    noteItemId: number;
    comment: VerseCommentType;
};
/** Every mark on one verse, gathered from every note file. */
export type VerseAnnotationsType = {
    highlights: VerseHighlightRefType[];
    comments: VerseCommentRefType[];
};
/** `"(KJV) GEN 22:1": { highlights: [...], comments: [...] }` */
export type VerseAnnotationsMapType = Record<string, VerseAnnotationsType>;

export type NewVerseAnnotationType = {
    start: number;
    end: number;
    text: string;
};

/** Where a just-written mark ended up, so its editor can be opened on it. */
export type SavedAnnotationRefType = {
    filePath: string;
    noteItemId: number;
    annotationId: string;
};

function genAnnotationBase({ start, end, text }: NewVerseAnnotationType) {
    const nowText = new Date().toISOString();
    return {
        id: crypto.randomUUID(),
        start,
        end,
        text,
        createdAt: nowText,
        updatedAt: nowText,
    };
}

/**
 * Marks are always filed in the Default note file, which `getDefault` creates
 * when it is missing. One verse item per verse: a second mark on a verse joins
 * the item already there rather than starting another one.
 */
async function addToDefaultVerseItem(
    anchor: VerseAnchorType,
    mutate: (noteItem: NoteItem) => void,
) {
    const note = await Note.getDefault();
    if (note === null) {
        showSimpleToast(
            tran('Saving Verse Mark'),
            tran('Bible notes directory is not set'),
        );
        return null;
    }
    return await unlocking(toNoteLockKey(note.filePath), async () => {
        // Re-read INSIDE the lock: `getDefault` resolved before the queue, so
        // by the time this runs another rapid swatch click may already have
        // added the verse item this one is about to add a second time.
        const lockedNote = (await Note.fromFilePath(note.filePath)) ?? note;
        return await addToVerseItem(lockedNote, anchor, mutate);
    });
}

async function addToVerseItem(
    note: Note,
    anchor: VerseAnchorType,
    mutate: (noteItem: NoteItem) => void,
) {
    const existingNoteItem =
        note.items.find((noteItem) => {
            return (
                noteItem.isVerseItem && noteItem.verseKey === anchor.verseKey
            );
        }) ?? null;
    if (existingNoteItem !== null) {
        mutate(existingNoteItem);
        // Silent: the non-silent path polls the DOM for seconds and scrolls the
        // Bible Notes list to the item. Worth it once, when the verse first
        // appears in the list; not on every mark added to it afterwards.
        const isSaved = await note.updateAndSaveNoteItem(
            existingNoteItem,
            true,
        );
        return isSaved
            ? { filePath: note.filePath, noteItemId: existingNoteItem.id }
            : null;
    }
    const jsonData = NoteItem.genNewVerseJsonData(
        anchor.verseKey,
        anchor.title,
        anchor.shortVerse,
    );
    // Assigned here as well as inside `addNoteItem`, which computes the same
    // `maxItemId + 1` on its own COPY of the item — this is the only way the
    // caller learns which id the new verse item got.
    const noteItemId = note.maxItemId + 1;
    jsonData.metadata.id = noteItemId;
    const newNoteItem = new NoteItem(jsonData, note.filePath);
    mutate(newNoteItem);
    const isSaved = await note.addAndSaveNoteItem(newNoteItem);
    return isSaved ? { filePath: note.filePath, noteItemId } : null;
}

/**
 * Edit a mark in whatever note file holds it — the tree can act on any file, not
 * just the Default one.
 *
 * A verse item that loses its last mark is deleted rather than left behind: an
 * empty one shows in the Bible Notes tree as a verse with nothing under it, and
 * would go on marking the verse number for a verse that carries nothing.
 */
async function updateVerseItem(
    filePath: string,
    noteItemId: number,
    mutate: (noteItem: NoteItem) => boolean,
) {
    return await unlocking(toNoteLockKey(filePath), async () => {
        return await updateVerseItemLocked(filePath, noteItemId, mutate);
    });
}

async function updateVerseItemLocked(
    filePath: string,
    noteItemId: number,
    mutate: (noteItem: NoteItem) => boolean,
) {
    const note = await Note.fromFilePath(filePath);
    if (note === null) {
        return false;
    }
    const noteItem = note.getItemById(noteItemId);
    if (noteItem === null || !noteItem.isVerseItem) {
        return false;
    }
    if (!mutate(noteItem)) {
        return false;
    }
    if (noteItem.annotationCount === 0) {
        return await note.deleteNoteItem(noteItem);
    }
    return await note.updateAndSaveNoteItem(noteItem, true);
}

export async function addVerseHighlight(
    anchor: VerseAnchorType,
    newAnnotation: NewVerseAnnotationType,
    color: VerseHighlightColorKeyType,
): Promise<SavedAnnotationRefType | null> {
    const annotation = { ...genAnnotationBase(newAnnotation), color };
    const saved = await addToDefaultVerseItem(anchor, (noteItem) => {
        noteItem.highlights = [...noteItem.highlights, annotation];
    });
    return saved === null ? null : { ...saved, annotationId: annotation.id };
}

/** Returns where the comment landed, so the caller can open its editor on it. */
export async function addVerseComment(
    anchor: VerseAnchorType,
    newAnnotation: NewVerseAnnotationType,
    comment = '',
): Promise<SavedAnnotationRefType | null> {
    const annotation = { ...genAnnotationBase(newAnnotation), comment };
    const saved = await addToDefaultVerseItem(anchor, (noteItem) => {
        noteItem.comments = [...noteItem.comments, annotation];
    });
    return saved === null ? null : { ...saved, annotationId: annotation.id };
}

export async function updateVerseComment(
    filePath: string,
    noteItemId: number,
    commentId: string,
    comment: string,
) {
    return await updateVerseItem(filePath, noteItemId, (noteItem) => {
        const existing = noteItem.comments.find((item) => {
            return item.id === commentId;
        });
        if (existing === undefined || existing.comment === comment) {
            return false;
        }
        noteItem.comments = noteItem.comments.map((item) => {
            if (item.id !== commentId) {
                return item;
            }
            return { ...item, comment, updatedAt: new Date().toISOString() };
        });
        return true;
    });
}

export async function updateVerseHighlightColor(
    filePath: string,
    noteItemId: number,
    highlightId: string,
    color: VerseHighlightColorKeyType,
) {
    return await updateVerseItem(filePath, noteItemId, (noteItem) => {
        const existing = noteItem.highlights.find((item) => {
            return item.id === highlightId;
        });
        if (existing === undefined || existing.color === color) {
            return false;
        }
        noteItem.highlights = noteItem.highlights.map((item) => {
            if (item.id !== highlightId) {
                return item;
            }
            return { ...item, color, updatedAt: new Date().toISOString() };
        });
        return true;
    });
}

/** Removes a highlight or a comment — one id space is searched for both. */
export async function removeVerseAnnotation(
    filePath: string,
    noteItemId: number,
    annotationId: string,
) {
    return await updateVerseItem(filePath, noteItemId, (noteItem) => {
        const highlights = noteItem.highlights.filter((item) => {
            return item.id !== annotationId;
        });
        const comments = noteItem.comments.filter((item) => {
            return item.id !== annotationId;
        });
        if (
            highlights.length === noteItem.highlights.length &&
            comments.length === noteItem.comments.length
        ) {
            return false;
        }
        noteItem.highlights = highlights;
        noteItem.comments = comments;
        return true;
    });
}
