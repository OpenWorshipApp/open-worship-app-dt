/**
 * Which open window is ONE Bible note's own (2026-11-08, the user, with a
 * note conversation whose head read _Bible Reader · Auto_: _chatbot should
 * demand select a bible-note window (open one if not opened) … `Open in
 * Chatbot` should check for opening window first then attach with window
 * selected in chatbot_).
 *
 * A note window is `bibleNote.html?file=<file name>&id=<note id>` (plus the
 * Bible Notes session it belongs to, when not the default one, and a popup
 * `uuid`), as `handleOpening` in `BibleNoteItemRenderComp.tsx` opens it. The
 * note row asks whether one is open before opening the help window, and the
 * help window finds it among the app's windows to work in it.
 *
 * No imports: both the main window's row menu and the help window load it.
 */

export const NOTE_WINDOW_PAGE_NAME = 'bibleNote.html';

/** What names a note's window: its file's name and its id in that file. */
export type NoteWindowTargetType = {
    fileFullName: string;
    noteId: number;
};

/** The file name of a path, either kind of slash. */
export function toNoteFileFullName(filePath: string) {
    return filePath.split(/[\\/]/).pop() ?? '';
}

/** The window target of one note of a `.own` file, or null. */
export function toNoteWindowTarget(
    filePath: string,
    noteId: number | null | undefined,
): NoteWindowTargetType | null {
    const fileFullName = toNoteFileFullName(filePath);
    if (
        fileFullName === '' ||
        typeof noteId !== 'number' ||
        !Number.isInteger(noteId) ||
        noteId < 0
    ) {
        return null;
    }
    return { fileFullName, noteId };
}

/** Whether a window's address is that note's own window. */
export function checkIsNoteWindowUrl(
    url: string,
    target: NoteWindowTargetType,
) {
    let parsed: URL;
    try {
        parsed = new URL(url, 'http://localhost/');
    } catch (_error) {
        return false;
    }
    if (parsed.pathname.split('/').pop() !== NOTE_WINDOW_PAGE_NAME) {
        return false;
    }
    return (
        parsed.searchParams.get('file') === target.fileFullName &&
        parsed.searchParams.get('id') === String(target.noteId)
    );
}

/** The first window of a list that is that note's own, or null. */
export function findNoteWindow<T extends { url: string }>(
    windowList: readonly T[],
    target: NoteWindowTargetType,
): T | null {
    return (
        windowList.find((item) => {
            return checkIsNoteWindowUrl(item.url, target);
        }) ?? null
    );
}
