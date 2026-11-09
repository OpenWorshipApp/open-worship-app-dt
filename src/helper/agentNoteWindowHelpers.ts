/**
 * Opens ONE Bible note's own window for `owa_note_edit`, which reads and
 * changes a note only there, through its editor (2026-11-08, the user:
 * _bible-note chatbot should depend on bible-note UI controller_). Run in the
 * main window, the way a note row's **Open** opens it; the note is checked
 * first -- a notes file of a Bible Notes folder, the note in it, and not a
 * verse's marks, which has no editor -- so no window opens on anything else.
 */
import { dirSourceSettingNames } from './constants';
import { fsCheckFileExist, pathBasename } from '../server/fileHelpers';
import { findSessionIdByFilePath } from '../media-sessions/folderSessionPathHelpers';
import { checkIsBibleNoteFileName } from '../bible-list/note/bibleNotePreviewHelpers';
import type { AgentResultType } from './agentBackupHelpers';

function fail(reason: string): AgentResultType {
    return { isError: true, reason };
}

export type AgentNoteWindowRequestType = {
    filePath?: unknown;
    noteId?: unknown;
};

/** One request; answers with a plain object and never throws. */
export async function handleAgentNoteWindowRequest(
    request: AgentNoteWindowRequestType,
): Promise<AgentResultType> {
    try {
        const { filePath, noteId } = request ?? {};
        if (
            typeof filePath !== 'string' ||
            !checkIsBibleNoteFileName(filePath) ||
            findSessionIdByFilePath(
                dirSourceSettingNames.BIBLE_NOTES,
                filePath,
            ) === null
        ) {
            return fail(
                'That is not a notes file of the Bible Notes panel. Open the ' +
                    'note with Open in Chatbot on its row.',
            );
        }
        if (!Number.isSafeInteger(noteId) || (noteId as number) < 0) {
            return fail('Which note of the file: `noteId` is a note number.');
        }
        if (!(await fsCheckFileExist(filePath))) {
            return fail(`"${pathBasename(filePath)}" is not there any more.`);
        }
        const Note = (await import('../bible-list/note/Note')).default;
        const note = await Note.fromFilePath(filePath);
        const noteItem = note?.getItemById(noteId as number) ?? null;
        if (noteItem === null) {
            return fail(
                'That note is not in the file any more: it was removed or ' +
                    'moved to another file.',
            );
        }
        if (noteItem.isVerseItem) {
            return fail(
                "This is a verse's highlights and comments, not a note: " +
                    'change those in the Bible Reader.',
            );
        }
        const { openNoteWindow } =
            await import('../bible-list/note/noteWindowOpenHelpers');
        openNoteWindow(pathBasename(filePath), filePath, noteId as number);
        return { isOpened: true };
    } catch (error: any) {
        return fail(String(error?.message ?? error));
    }
}
