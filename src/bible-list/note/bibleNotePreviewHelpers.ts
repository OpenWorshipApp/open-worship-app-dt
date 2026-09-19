/**
 * A bible note file opened READ-ONLY from wherever it sits on the machine --
 * the Resources panel shelves `.own` files that live far outside the Bible
 * Notes folder, and `?file=` can only name a file INSIDE it.
 *
 * It is the same `bibleNote.html` window and the same editor; what differs is
 * that the window finds the file by this full path, and that nothing it does is
 * ever written back (`initBibleNote`'s `isReadOnly`). A separate parameter
 * rather than a flag beside `?file=`, so a URL can never mean "the notes-folder
 * file, but read-only" or "this outside path, but editable".
 *
 * Imports nothing on purpose: the bible lookup panel reads these names, and
 * the popup opener that goes with them (`resourcePreviewOpenHelpers.ts`) is
 * loaded only when something is actually opened.
 */
export const BIBLE_NOTE_PREVIEW_FILE_PARAM_NAME = 'preview-file';

// Twin of `src/server/mime/note-types.json`, which names the one extension.
const NOTE_DOT_EXTENSION = '.own';

export function checkIsBibleNoteFileName(fileFullName: string) {
    return fileFullName.toLowerCase().endsWith(NOTE_DOT_EXTENSION);
}

/**
 * The file a read-only window was opened on, or `null` for an ordinary note
 * window. Anything that is not a note file by name is refused here, so a
 * hand-made URL cannot point the window at some other file.
 */
export function getBibleNotePreviewFilePath(url: string) {
    if (!URL.canParse(url)) {
        return null;
    }
    const filePath = new URL(url).searchParams.get(
        BIBLE_NOTE_PREVIEW_FILE_PARAM_NAME,
    );
    if (!filePath || !checkIsBibleNoteFileName(filePath)) {
        return null;
    }
    return filePath;
}
