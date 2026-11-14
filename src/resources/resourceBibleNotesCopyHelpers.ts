/**
 * A Markdown file in Resources copied into Bible Notes (2026-11-13, the
 * user, with a picture of a study's row menu in the Resources panel:
 * _context menu of markdown study file should have `Copy to Bible-Note` to
 * copy the file to bible note area_). Bible Notes lists a Markdown file as
 * one of its own rows (`BibleNoteListComp`), so the copy is the file as it
 * is -- its diagrams too -- and the list, which watches its folder, shows
 * it with nothing more said to it.
 *
 * The folder is the one of the Bible Notes session in front, where a file
 * dropped on the list or a study the help window creates in Bible Notes
 * lands (`getActiveBibleNotesDirPath`). A name already there is not
 * written over: the copy takes the next free one (`… (1).md`), as a drop
 * does.
 *
 * Loaded at the press: a shelf of Resources rows carries none of it.
 */
import { getActiveBibleNotesDirPath } from '../bible-list/note/bibleNotesDirHelpers';
import { tran } from '../lang/langHelpers';
import { fsCopyFilePathToPath, pathBasename } from '../server/fileHelpers';
import { showSimpleToast } from '../toast/toastHelpers';

/**
 * Copies `filePath` into the Bible Notes folder in front and says so; the
 * path written, or null when no folder is set (said in a toast) or the copy
 * failed (`fsCopyFilePathToPath` says why).
 */
export async function copyResourceToBibleNotes(filePath: string) {
    const title = tran('Copy to Bible Notes');
    const dirPath = getActiveBibleNotesDirPath();
    if (!dirPath) {
        showSimpleToast(title, tran('Bible notes directory is not set'));
        return null;
    }
    const copiedFilePath = await fsCopyFilePathToPath(filePath, dirPath);
    if (copiedFilePath === null) {
        return null;
    }
    showSimpleToast(
        title,
        tran('Copied {name}.').replace('{name}', pathBasename(copiedFilePath)),
    );
    return copiedFilePath;
}
