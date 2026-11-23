/**
 * An Open Lyric song as plain Markdown, `<song>.ol.md` -- what the Open Lyric
 * editors and their VS Code extensions write. A leaf with no imports on
 * purpose: the Documents list asks it of every dropped file, and the work of
 * converting one (`openLyricFileHelpers.ts`) loads only when there is one.
 */
export const OPEN_LYRIC_FILE_DOT_EXTENSION = '.ol.md';

export function checkIsOpenLyricFileFullName(fileFullName: string) {
    return (
        fileFullName.length > OPEN_LYRIC_FILE_DOT_EXTENSION.length &&
        fileFullName.toLowerCase().endsWith(OPEN_LYRIC_FILE_DOT_EXTENSION)
    );
}
