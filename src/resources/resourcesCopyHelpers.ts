import { appManagedDataDirNames } from '../helper/constants';
import { tran } from '../lang/langHelpers';
import {
    fsCheckDirExist,
    fsCheckFileExist,
    fsCloneFile,
    fsCreateDir,
    fsDeleteDir,
    fsDeleteFile,
    fsListDirents,
    fsMove,
    pathBasename,
    pathJoin,
    pathResolve,
    pathSeparator,
} from '../server/fileHelpers';
import { appLocalStorage } from '../setting/directory-setting/appLocalStorage';
import { toDirPathCompareKey } from './resourcesFolderHelpers';

/**
 * A refusal the panel can put into words: `messageKey` is a `tran()` key. Its
 * own class so a disk error (EACCES, ENOSPC) is never mistaken for one and
 * shown as a sentence the user did nothing to earn.
 */
export class ResourcesCopyError extends Error {
    readonly messageKey: string;
    constructor(messageKey: string) {
        super(messageKey);
        this.messageKey = messageKey;
    }
}

export type ResourcesFolderCopyResultType = {
    destinationDirPath: string;
    fileCount: number;
    /** Links and anything else that is neither a file nor a folder. */
    skippedCount: number;
};

export type ResourcesFilesCopyResultType = {
    /** Where each picked file landed, in the order they were picked. */
    copiedFilePaths: string[];
    /** Picked paths that were already that very file here, or are gone. */
    skippedCount: number;
    /**
     * What stopped the run, or null when every picked path was dealt with.
     *
     * Handed back rather than thrown, because the files copied BEFORE it are
     * real and on disk: a throw would leave the panel with a disk error and no
     * way to say that four of the seven landed.
     */
    error: unknown;
};

/** `<selected parent dir>/resources`, where copied folders are kept. */
export function getResourcesDataDirPath() {
    return pathJoin(
        appLocalStorage.defaultStorageDirPath,
        appManagedDataDirNames.RESOURCES,
    );
}

/**
 * Whether `dirPath` is `parentDirPath` itself or anywhere under it, compared
 * the way the file system compares (case-folded except on Linux).
 *
 * The separator is required after the parent, or `D:\Songs` would count as
 * inside `D:\Song`. A drive root already ends in one (`C:\`), so it is not
 * doubled there.
 */
export function checkIsSameOrInsideDir(parentDirPath: string, dirPath: string) {
    const parentKey = toDirPathCompareKey(pathResolve(parentDirPath));
    const key = toDirPathCompareKey(pathResolve(dirPath));
    if (key === parentKey) {
        return true;
    }
    const prefix = parentKey.endsWith(pathSeparator)
        ? parentKey
        : parentKey + pathSeparator;
    return key.startsWith(prefix);
}

/**
 * Why a folder cannot be copied at all, as a `tran()` key -- or null when it
 * can. No disk access, so the panel asks it BEFORE its confirm: a question
 * whose Yes can only be refused is not worth asking.
 */
export function getResourcesFolderCopyRefusalKey(dirPath: string) {
    const resourcesDirPath = getResourcesDataDirPath();
    if (checkIsSameOrInsideDir(resourcesDirPath, dirPath)) {
        return 'Folder is already in the data directory';
    }
    // A folder holding the data directory -- `Desktop` beside a data dir at
    // `Desktop\open-worship-data` -- would be copied into itself: every file
    // written lands inside the tree still being read.
    if (checkIsSameOrInsideDir(dirPath, resourcesDirPath)) {
        return 'The data directory is inside this folder';
    }
    return null;
}

/** Already copied -- the menu has nothing to offer for this folder. */
export function checkIsInResourcesDataDir(dirPath: string) {
    return checkIsSameOrInsideDir(getResourcesDataDirPath(), dirPath);
}

async function checkIsPathTaken(filePath: string) {
    return (
        (await fsCheckDirExist(filePath)) || (await fsCheckFileExist(filePath))
    );
}

/** `YouTube`, then `YouTube (1)` -- as `FileSource.genNextFilePath` names. */
export async function genFreeDirPath(parentDirPath: string, name: string) {
    let index = 0;
    let dirPath = pathJoin(parentDirPath, name);
    while (await checkIsPathTaken(dirPath)) {
        index++;
        dirPath = pathJoin(parentDirPath, `${name} (${index})`);
    }
    return dirPath;
}

/**
 * `Genesis.pdf`, then `Genesis (1).pdf` -- `genFreeDirPath` for a file, with
 * the index put before the extension so the copy still opens in the same app.
 *
 * A name with no dot, or one that is nothing but a leading dot (`.gitignore`),
 * has no extension to keep: the index goes on the end, where `(1)` would
 * otherwise become the whole extension.
 */
export async function genFreeFilePath(dirPath: string, fileFullName: string) {
    const dotIndex = fileFullName.lastIndexOf('.');
    const [name, dotExtension] =
        dotIndex > 0
            ? [fileFullName.slice(0, dotIndex), fileFullName.slice(dotIndex)]
            : [fileFullName, ''];
    let index = 0;
    let filePath = pathJoin(dirPath, fileFullName);
    while (await checkIsPathTaken(filePath)) {
        index++;
        filePath = pathJoin(dirPath, `${name} (${index})${dotExtension}`);
    }
    return filePath;
}

/**
 * Copy picked files INTO one of the user's own resources folders. The sources
 * are never touched, and nothing already there is ever overwritten -- a name
 * that is taken gets the next free one, exactly as a dropped media file does.
 *
 * Sequential for the reason `copyDirTree` is: a selection can be a whole
 * folder's worth of PDFs, and N parallel copies is N disk queues on a machine
 * that has one. No staging dance here, though -- each file is independent and
 * lands under its own final name, so there is no half-written TREE to hide;
 * only the one file a failure was in the middle of is swept up.
 */
export async function copyFilesIntoResourcesFolder(
    dirPath: string,
    filePaths: string[],
): Promise<ResourcesFilesCopyResultType> {
    const destinationDirPath = pathResolve(dirPath);
    if (!(await fsCheckDirExist(destinationDirPath))) {
        throw new ResourcesCopyError('Folder not found');
    }
    const copiedFilePaths: string[] = [];
    let skippedCount = 0;
    for (const pickedFilePath of filePaths) {
        const sourceFilePath = pathResolve(pickedFilePath);
        const fileFullName = pathBasename(sourceFilePath);
        const sameNamePath = pathJoin(destinationDirPath, fileFullName);
        // The picked file IS the one already sitting here: copying it would
        // put `GEN.1 (1).pdf` beside `GEN.1.pdf` and read as a bug.
        if (
            toDirPathCompareKey(sourceFilePath) ===
                toDirPathCompareKey(sameNamePath) ||
            !(await fsCheckFileExist(sourceFilePath))
        ) {
            skippedCount++;
            continue;
        }
        const targetFilePath = await genFreeFilePath(
            destinationDirPath,
            fileFullName,
        );
        try {
            await fsCloneFile(sourceFilePath, targetFilePath);
        } catch (error) {
            // `copyFile` can leave a truncated file behind (a full disk, a
            // network share that went away), and a half a PDF on a shelf is
            // worse than no PDF: it opens, and it is wrong.
            try {
                await fsDeleteFile(targetFilePath);
            } catch (_error) {}
            // Stopped rather than carried on: whatever failed this file --
            // no space, no permission, the folder gone -- is about to fail
            // every file after it, each one leaving another part file.
            return { copiedFilePaths, skippedCount, error };
        }
        copiedFilePaths.push(targetFilePath);
    }
    return { copiedFilePaths, skippedCount, error: null };
}

/**
 * What the toast says after an Add Files run: what landed, what did not, and
 * the one thing the panel cannot say for itself -- files that ARE on the shelf
 * now and are not drawn, because this list only ever holds what is named after
 * the chapter on screen. Without that sentence a successful copy of
 * `outline.docx` reads exactly like a copy that failed.
 */
export function toResourcesFilesCopiedMessage(
    { copiedFilePaths, skippedCount, error }: ResourcesFilesCopyResultType,
    {
        isNoneListed,
        isOthersShowing,
    }: { isNoneListed: boolean; isOthersShowing: boolean },
) {
    const copiedCount = copiedFilePaths.length;
    const parts: string[] = [];
    if (copiedCount > 0) {
        const messageKey = copiedCount === 1 ? 'file copied' : 'files copied';
        parts.push(`${copiedCount} ${tran(messageKey)}`);
    }
    if (skippedCount > 0) {
        // One count for both reasons a file is passed over -- it is already
        // the file at that very path, or it is gone since the picker named it.
        // Neither is something the user can act on, and neither lost anything.
        const messageKey =
            skippedCount === 1
                ? 'file was not copied'
                : 'files were not copied';
        parts.push(`${skippedCount} ${tran(messageKey)}`);
    }
    const sentences = [parts.join(', ')];
    if (error !== null) {
        sentences.push(
            `${tran('Cannot copy file')}: ${(error as Error)?.message ?? ''}`,
        );
    } else if (copiedCount > 0 && isNoneListed) {
        // Only when NOTHING new appears: with some of them drawn, the list
        // has already shown the user what happened.
        sentences.push(
            tran(
                isOthersShowing
                    ? 'They are not shown in this list'
                    : 'Tick Others to see them',
            ),
        );
    }
    return sentences
        .filter((sentence) => {
            return sentence !== '';
        })
        .join('. ');
}

/**
 * Copy a tree one entry at a time.
 *
 * Sequential on purpose, like `_fsMoveAcrossDevices`: a parallel copy would
 * hold N file handles and N disk queues open at once on a weak machine, and
 * `copyFile` streams inside libuv, so no file ever lands in the renderer's
 * memory. `fsListDirents` does not follow links, so a link pointing back up
 * the tree is skipped rather than walked for ever.
 */
async function copyDirTree(
    sourceDirPath: string,
    destinationDirPath: string,
    counts: { fileCount: number; skippedCount: number },
) {
    await fsCreateDir(destinationDirPath);
    for (const entry of await fsListDirents(sourceDirPath)) {
        const sourcePath = pathJoin(sourceDirPath, entry.name);
        const destinationPath = pathJoin(destinationDirPath, entry.name);
        if (entry.isDirectory) {
            await copyDirTree(sourcePath, destinationPath, counts);
        } else if (entry.isFile) {
            await fsCloneFile(sourcePath, destinationPath);
            counts.fileCount++;
        } else {
            counts.skippedCount++;
        }
    }
}

/**
 * Copy a Resources folder into `<selected parent dir>/resources/<its name>`.
 * The source is never touched.
 *
 * The tree is written under a hidden staging name and renamed into place only
 * once every file is in -- a same-volume rename, so it costs nothing -- which
 * means a copy that fails, or an app closed half way, never leaves a folder
 * that looks finished. The free name is chosen at that moment rather than
 * before, so a folder that appeared during a long copy is not overwritten.
 */
export async function copyResourcesFolderToDataDir(
    dirPath: string,
): Promise<ResourcesFolderCopyResultType> {
    const sourceDirPath = pathResolve(dirPath);
    if (!(await fsCheckDirExist(sourceDirPath))) {
        throw new ResourcesCopyError('Folder not found');
    }
    // Asked again here, not only by the panel before its confirm: the data
    // directory can be changed in Settings while that confirm is open.
    const refusalKey = getResourcesFolderCopyRefusalKey(sourceDirPath);
    if (refusalKey !== null) {
        throw new ResourcesCopyError(refusalKey);
    }
    const resourcesDirPath = getResourcesDataDirPath();
    await fsCreateDir(resourcesDirPath);
    // A drive root has no base name.
    const name = pathBasename(sourceDirPath) || 'Folder';
    const stagingDirPath = pathJoin(
        resourcesDirPath,
        `.copying-${Date.now()}-${name}`,
    );
    const counts = { fileCount: 0, skippedCount: 0 };
    try {
        await copyDirTree(sourceDirPath, stagingDirPath, counts);
        const destinationDirPath = await genFreeDirPath(resourcesDirPath, name);
        await fsMove(stagingDirPath, destinationDirPath);
        return { destinationDirPath, ...counts };
    } catch (error) {
        try {
            await fsDeleteDir(stagingDirPath);
        } catch (_error) {}
        throw error;
    }
}
