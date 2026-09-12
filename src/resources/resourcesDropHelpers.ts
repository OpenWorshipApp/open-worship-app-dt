import { getAppFilePathFromFile } from '../helper/localFileHelpers';
import { fsCheckDirExist } from '../server/fileHelpers';
import type { ResourcesFolderAddingResultType } from './resourcesFolderHelpers';
import { addResourcesFolders } from './resourcesFolderHelpers';

/**
 * How many dropped paths to look at.
 *
 * Every one of them costs a `stat`, and a drag can carry a whole
 * select-all -- hundreds of files nobody meant to shelve. Folders come in
 * ones and twos, so the cap only ever bites on a drag this panel has nothing
 * to do with, and it bounds the I/O a single gesture can start.
 */
export const MAX_DROPPED_PATHS = 50;

/**
 * Whether the drag carries files at all.
 *
 * The `length > 0` is not redundant: `.every()` on an empty
 * `dataTransfer.items` is vacuously true, so without it a drag of pure text
 * would light the panel up as an accepted drop. Everything the app drags
 * INTERNALLY -- a verse, a slide, a background -- travels as `string` items,
 * so this is also what keeps those from being offered a folder drop.
 */
export function checkIsDraggingFiles(dataTransfer: DataTransfer | null) {
    if (dataTransfer === null) {
        return false;
    }
    const items = Array.from(dataTransfer.items);
    return (
        items.length > 0 &&
        items.every((item) => {
            return item.kind === 'file';
        })
    );
}

/**
 * The on-disk paths a drop carried, in drop order and without repeats.
 *
 * Read off `dataTransfer.files` rather than through `readDroppedFiles`, which
 * walks `webkitGetAsEntry()` and yields only entries whose `isFile` is true --
 * a dropped FOLDER is exactly what that skips. `appFilePath` is stamped onto
 * every dropped `File` by the electron preload; a `File` made in the renderer
 * carries none and is dropped here.
 */
export function readDroppedPaths(dataTransfer: DataTransfer | null): string[] {
    if (dataTransfer === null) {
        return [];
    }
    const droppedPaths: string[] = [];
    for (const file of Array.from(dataTransfer.files ?? [])) {
        const filePath = getAppFilePathFromFile(file);
        if (filePath === null || droppedPaths.includes(filePath)) {
            continue;
        }
        droppedPaths.push(filePath);
    }
    return droppedPaths;
}

export type ResourcesFolderDropPlanType = ResourcesFolderAddingResultType & {
    /** Something was dropped that is not a folder this panel can shelve. */
    isNonFolderDropped: boolean;
};

/**
 * What a drop of these paths would do to the folder list.
 *
 * A dropped FILE is deliberately not turned into its parent folder: that
 * parent is as often the Desktop or Downloads as it is a library, and adding
 * it starts a recursive walk of the whole thing. Saying "drop a folder"
 * costs the user one more gesture and cannot land them with a scan of
 * everything they own.
 *
 * The `stat`s are sequential on purpose -- a drop of many paths would
 * otherwise open that many file handles at once on machines that can least
 * afford it, and the answer is needed before anything is shown either way.
 */
export async function planResourcesFolderDrop(
    droppedPaths: string[],
    existingDirPathList: string[],
): Promise<ResourcesFolderDropPlanType> {
    const dirPaths: string[] = [];
    let isNonFolderDropped = false;
    for (const droppedPath of droppedPaths.slice(0, MAX_DROPPED_PATHS)) {
        let isDir: boolean;
        try {
            isDir = await fsCheckDirExist(droppedPath);
        } catch (_error) {
            // A path that cannot even be read -- a permission-denied network
            // share, a device that went away mid-drag -- is not a folder this
            // panel can shelve, and must not take the whole drop down with it.
            isDir = false;
        }
        if (isDir) {
            dirPaths.push(droppedPath);
        } else {
            isNonFolderDropped = true;
        }
    }
    return {
        ...addResourcesFolders(existingDirPathList, dirPaths),
        isNonFolderDropped,
    };
}
