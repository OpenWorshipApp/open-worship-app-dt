import { fsCheckDirExist } from '../server/fileHelpers';
import type { ResourcesFolderAddingResultType } from './resourcesFolderHelpers';
import { addResourcesFolders } from './resourcesFolderHelpers';

// In the leaf module so a path box can take a dropped folder without pulling
// this panel's settings in with it; re-exported for the panel's own callers.
export {
    checkIsDraggingFiles,
    readDroppedPaths,
} from '../helper/localFileHelpers';

/**
 * How many dropped paths to look at.
 *
 * Every one of them costs a `stat`, and a drag can carry a whole
 * select-all -- hundreds of files nobody meant to shelve. Folders come in
 * ones and twos, so the cap only ever bites on a drag this panel has nothing
 * to do with, and it bounds the I/O a single gesture can start.
 */
export const MAX_DROPPED_PATHS = 50;

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
