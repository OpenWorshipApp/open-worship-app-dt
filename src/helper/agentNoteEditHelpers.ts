/**
 * The app side of `owa_note_edit`: ONE Bible note read as numbered blocks and
 * changed part by part, its formatting kept (2026-11-07, the user, with a
 * note row's menu open: _add `Open in Chatbot` for bible-note … goal: chatbot
 * can help modify and answer everything on bible-note_). The rules are pure
 * in `agentNoteBlockHelpers.ts`; this file reads, resolves verses and writes.
 *
 * ## Where a change goes
 *
 * Into the note's EDITING HISTORY, never the file -- the way the note window
 * writes its own typing, and the way a song or a slide document changed by
 * the assistant is left: unsaved, the window's **Save** keeps it, **Undo
 * Saved Change** walks it back. The note is read from that history's head,
 * so what somebody typed and has not saved is what is changed. An open note
 * window is told (`notifyNoteHeadChanged`) and shows the change at once --
 * the file did not change, so its own watch would never hear it.
 *
 * A TITLE is the list's (the row shows the saved file, and Edit Title saves
 * at once), so a new title is saved to the file, as Edit Title does.
 *
 * ## The undo
 *
 * Every change is backed up first (`runWithAgentBackup`): the head as it was
 * -- or, for a note no window ever wrote a history for, the file's state
 * taken AS the head, so an undo puts that back rather than leaving the
 * change -- and the file too when a title changes. No backup, no change.
 *
 * ## Which notes
 *
 * A `.own` file in a Bible Notes folder (any folder session) and a note in it
 * that is not a verse's marks. The help window resolves the note the
 * conversation is about to its path and id; a path from anywhere else is
 * refused.
 */
import { dirSourceSettingNames } from './constants';
import { handleError } from './errorHelpers';
import {
    fsCheckFileExist,
    fsReadFile,
    pathBasename,
} from '../server/fileHelpers';
import { findSessionIdByFilePath } from '../media-sessions/folderSessionPathHelpers';
import { checkIsBibleNoteFileName } from '../bible-list/note/bibleNotePreviewHelpers';
import { notifyNoteHeadChanged } from '../bible-list/note/noteHeadChangeHelpers';
import {
    type AgentResultType,
    type AgentRestoreType,
    NoBackupError,
    genUndoField,
    runWithAgentBackup,
    snapshotAgentEditing,
    snapshotAgentFile,
} from './agentBackupHelpers';
import {
    type NoteEditChangeType,
    type NoteVerseType,
    applyNoteEdit,
    collectNewNoteVerseRefs,
    genNoteContentHash,
    readNoteBlocks,
} from './agentNoteBlockHelpers';

export type AgentNoteEditRequestType = {
    action?: unknown;
    filePath?: unknown;
    noteId?: unknown;
    from?: unknown;
    hash?: unknown;
    title?: unknown;
    bible?: unknown;
    changes?: unknown;
};

const NOTE_EDITABLE_KIND = 'note' as const;
const UNTITLED_NOTE_NAME = 'Unnamed';
const MAX_NEW_VERSES = 20;

function fail(reason: string): AgentResultType {
    return { isError: true, reason };
}

function toNoteName(title: unknown) {
    return typeof title === 'string' && title.trim() !== ''
        ? title.trim()
        : UNTITLED_NOTE_NAME;
}

async function getNoteClass() {
    return (await import('../bible-list/note/Note')).default;
}

/** The note file and note asked for, or why not. */
async function findNote(request: AgentNoteEditRequestType) {
    const filePath = request.filePath;
    if (
        typeof filePath !== 'string' ||
        !checkIsBibleNoteFileName(filePath) ||
        findSessionIdByFilePath(dirSourceSettingNames.BIBLE_NOTES, filePath) ===
            null
    ) {
        return toFailure(
            'That is not a notes file of the Bible Notes panel. Open the note ' +
                'with Open in Chatbot on its row.',
        );
    }
    if (!(await fsCheckFileExist(filePath))) {
        return toFailure(`"${pathBasename(filePath)}" is not there any more.`);
    }
    const noteId = request.noteId;
    if (!Number.isSafeInteger(noteId) || (noteId as number) < 0) {
        return toFailure('Which note of the file: `noteId` is a note number.');
    }
    const Note = await getNoteClass();
    // The note as its window has it: unsaved typing included.
    const note = await Note.fromFilePathEditing(filePath);
    const noteItem = note?.getItemById(noteId as number) ?? null;
    if (note === null || noteItem === null) {
        return toFailure(
            'That note is not in the file any more: it was removed or moved ' +
                'to another file.',
        );
    }
    if (noteItem.isVerseItem) {
        return toFailure(
            "This is a verse's highlights and comments, not a note: change " +
                'those in the Bible Reader.',
        );
    }
    return {
        found: { Note, note, noteItem, filePath, noteId: noteId as number },
    };
}

function toFailure(reason: string) {
    return { failure: fail(reason) };
}

async function handleRead(request: AgentNoteEditRequestType) {
    const lookedUp = await findNote(request);
    if ('failure' in lookedUp) {
        return lookedUp.failure;
    }
    const { noteItem, filePath } = lookedUp.found;
    const read = readNoteBlocks(
        noteItem.content,
        Number.isInteger(request.from) ? (request.from as number) : 1,
    );
    if (read === null) {
        return fail(
            'This note is kept in an older form that cannot be read here. ' +
                'Ask the person to open it in its own window once.',
        );
    }
    return {
        name: toNoteName(noteItem.title),
        file: pathBasename(filePath).replace(/\.own$/i, ''),
        ...read,
    };
}

/**
 * New verses resolved from the installed Bibles -- the lookup's version first,
 * or the one asked for -- as the editor keeps them: "(KJV) John 3:16", the
 * reference as that Bible writes it, the verse words, its font.
 */
async function resolveVerses(refs: string[], bible: string | null) {
    const verseMap = new Map<string, NoteVerseType>();
    if (refs.length === 0) {
        return verseMap;
    }
    const { resolveVersionOrder, resolveBibleItem } =
        await import('./agentBibleHelpers');
    const resolved = await resolveVersionOrder(bible);
    if (!('order' in resolved)) {
        throw new Error(String(resolved.reason ?? 'No Bible to read.'));
    }
    const { getBibleFontFamily } =
        await import('./bible-helpers/bibleStyleHelpers');
    for (const ref of refs.slice(0, MAX_NEW_VERSES)) {
        const bibleItem = await resolveBibleItem(ref, resolved.order);
        if (bibleItem === null) {
            continue;
        }
        const fontFamily = await getBibleFontFamily(bibleItem.bibleKey);
        verseMap.set(ref, {
            mentionName: await bibleItem.toTitleWithBibleKey(),
            shownText: await bibleItem.toTitle(),
            verseText: await bibleItem.toText(),
            style: fontFamily ? `font-family: ${fontFamily};` : '',
        });
    }
    return verseMap;
}

/**
 * The head as it is now, for the undo. A note no window ever wrote a history
 * for has none -- its head IS the file -- and that state is kept as the head,
 * or an undo would have nothing to put back over this change.
 */
async function snapshotNoteHead(filePath: string): Promise<AgentRestoreType> {
    const editing = await snapshotAgentEditing(NOTE_EDITABLE_KIND, filePath);
    if (editing !== null) {
        return editing;
    }
    return {
        type: 'editing',
        kind: NOTE_EDITABLE_KIND,
        filePath,
        text: JSON.stringify(JSON.parse(await fsReadFile(filePath)), null, 2),
    };
}

function toChanges(value: unknown): NoteEditChangeType[] | null {
    if (value === undefined) {
        return [];
    }
    return Array.isArray(value) ? (value as NoteEditChangeType[]) : null;
}

async function handleEdit(request: AgentNoteEditRequestType) {
    const lookedUp = await findNote(request);
    if ('failure' in lookedUp) {
        return lookedUp.failure;
    }
    const { Note, note, noteItem, filePath, noteId } = lookedUp.found;
    const changes = toChanges(request.changes);
    if (changes === null) {
        return fail('`changes` is a list of changes.');
    }
    const title = typeof request.title === 'string' ? request.title : null;
    if (changes.length === 0 && title === null) {
        return fail('Nothing to change: give `changes` or `title`.');
    }
    // Block numbers mean the note as it was READ: typed into since, they
    // may point at other words.
    if (
        typeof request.hash === 'string' &&
        request.hash !== '' &&
        request.hash !== genNoteContentHash(noteItem.content)
    ) {
        return fail(
            'The note changed since it was read (somebody is typing in it): ' +
                'read it again, then make the change.',
        );
    }
    const bible =
        typeof request.bible === 'string' && request.bible.trim() !== ''
            ? request.bible.trim()
            : null;
    let verseMap: Map<string, NoteVerseType>;
    try {
        verseMap = await resolveVerses(
            collectNewNoteVerseRefs(noteItem.content, changes),
            bible,
        );
    } catch (error: any) {
        return fail(String(error?.message ?? error));
    }
    const result = applyNoteEdit({
        content: noteItem.content,
        changes,
        title,
        verseMap,
    });
    if ('reason' in result) {
        return fail(result.reason);
    }
    const name = toNoteName(result.title ?? noteItem.title);
    if (!result.isChanged) {
        return {
            name,
            isChanged: false,
            hash: genNoteContentHash(noteItem.content),
            summary: 'Nothing was different from what the note says.',
        };
    }
    const isContentChanged = result.content !== noteItem.content;
    const restores: AgentRestoreType[] = [];
    if (isContentChanged) {
        restores.push(await snapshotNoteHead(filePath));
    }
    if (result.title !== null) {
        restores.push(await snapshotAgentFile(filePath, NOTE_EDITABLE_KIND));
    }
    try {
        const { meta } = await runWithAgentBackup(
            `Changed the Bible note "${name}" (${result.summary})`,
            restores,
            async () => {
                if (isContentChanged) {
                    noteItem.content = result.content;
                    // Onto the head as it is NOW, as the note window writes.
                    await note.addItemEditingHistory(noteItem);
                }
                if (result.title !== null) {
                    // The list's own way: the saved file, at once.
                    const savedNote = await Note.fromFilePath(filePath);
                    const savedItem = savedNote?.getItemById(noteId) ?? null;
                    if (savedNote === null || savedItem === null) {
                        throw new Error(
                            'The note could not be read to rename.',
                        );
                    }
                    savedItem.title = result.title;
                    savedNote.updateNoteItem(savedItem, true);
                    if (!(await savedNote.save())) {
                        throw new Error('The notes file could not be saved.');
                    }
                }
            },
        );
        notifyNoteHeadChanged(filePath);
        return {
            name,
            isChanged: true,
            hash: genNoteContentHash(result.content),
            summary: result.summary,
            isSaved: false,
            ...genUndoField(meta),
        };
    } catch (error: any) {
        if (error instanceof NoBackupError) {
            return fail(error.message);
        }
        handleError(error);
        return fail(
            `The change could not be finished: ${String(error?.message ?? error)}` +
                ' Anything it did get to do can be put back with owa_undo.',
        );
    }
}

/**
 * One request from `owa_note_edit`. Always answers with a plain object and
 * never throws: the caller is a page expression whose only channel back is a
 * DOM event.
 */
export async function handleAgentNoteEditRequest(
    request: AgentNoteEditRequestType,
): Promise<AgentResultType> {
    try {
        const action = String(request?.action ?? '');
        if (action === 'read') {
            return await handleRead(request);
        }
        if (action === 'edit') {
            return await handleEdit(request);
        }
        return fail('Unknown action. Use read or edit.');
    } catch (error: any) {
        handleError(error);
        return fail(String(error?.message ?? error));
    }
}
