import { handleError } from '../../helper/errorHelpers';
import {
    getCurrentLocale,
    getLangDataAsync,
    tran,
} from '../../lang/langHelpers';
import {
    copyDirTree,
    genFreeDirPath,
} from '../../resources/resourcesCopyHelpers';
import { appHomeStorage } from '../../server/appHomeStorage';
import appProvider from '../../server/appProvider';
import {
    genDataDirAlias,
    toPortableText,
} from '../../server/dataDirAliasHelpers';
import {
    checkIsInOneDrivePath,
    DATA_DIR_MARKER_FILE_NAME,
    DATA_DIR_MOVED_FROM_FLAG_FILE_NAME,
    DATA_DIR_MOVED_TO_FLAG_FILE_NAME,
    DEFAULT_DATA_DIR_NAME,
    ensureDataDirMarkerIdSync,
    fsCheckDirExist,
    fsCheckFileExist,
    fsCreateDir,
    fsDeleteDir,
    fsDeleteFile,
    fsGetFileSize,
    fsListDirents,
    fsReadFile,
    fsWriteFile,
    getDefaultDataDirPath,
    pathDirname,
    pathJoin,
    pathResolve,
    pathSeparator,
    toPathCompareKey,
} from '../../server/fileHelpers';
import { checkIsMainWindow } from '../../server/mainWindowHelpers';
import { relaunchApp } from '../settingHelpers';
import {
    appLocalStorage,
    DATA_DIR_MOVE_HIDE_CHANGED_EVENT_NAME,
    DATA_DIR_MOVE_PENDING_SETTING_NAME,
    DATA_DIR_MOVE_RESULT_SESSION_NAME,
    SELECTED_PARENT_DIR_SETTING_NAME,
} from './appLocalStorage';
import { forEachDataDirTextFile } from './directoryHelpers';
import { removeParentDirHistory } from './parentDirHistoryHelpers';

/**
 * The data folder's move off the Desktop, to `<home>/.owa/open-worship-data`
 * (`getDefaultDataDirPath`): on Windows OneDrive backs up the Desktop, and
 * syncing it turned songs, slides and settings into online-only copies or took
 * them off the computer.
 *
 * Asked at launch (`dataDirMoveAskHelpers.tsx`), done at the NEXT start: a
 * Windows folder cannot be renamed while anything in it is open, and a running
 * window holds the data folder's watch, the Bible search databases and
 * whatever video is playing. **Move Now** records the request and relaunches;
 * `init()` runs `runPendingDataDirMove` in the main window before anything
 * reads the folder. The app never deletes the folder it moved from: a copy
 * leaves it where it was, marked, for the person to put in the Recycle Bin.
 */

// The ask's own state, per computer like the choice of folder itself.
export const DATA_DIR_MOVE_HIDDEN_UNTIL_SETTING_NAME =
    'data-dir-move-hidden-until';
// The dialog's button says the number ("Hide for 30 days").
export const DATA_DIR_MOVE_HIDE_MS = 30 * 24 * 60 * 60 * 1000;
const STAGING_DIR_PREFIX = `.${DEFAULT_DATA_DIR_NAME}.moving-`;

// A stamp further off than twice what the button sets is not believed, as for
// the daily tips (`dailyTipSettingHelpers.ts`): pressed while the clock ran
// ahead, it would keep the question away for years.
export function checkIsDataDirMoveHidden(now = Date.now()) {
    const remaining =
        Number(
            appHomeStorage.getItem(DATA_DIR_MOVE_HIDDEN_UNTIL_SETTING_NAME),
        ) - now;
    return remaining > 0 && remaining <= 2 * DATA_DIR_MOVE_HIDE_MS;
}

/**
 * The day the ask comes back, for the Settings → General list of what was put
 * away (2026-10-20: _to be able to restore_), the same not-believed rule as
 * `checkIsDataDirMoveHidden`.
 */
export function readDataDirMoveHiddenAt(now = Date.now()): number | null {
    const until = Number(
        appHomeStorage.getItem(DATA_DIR_MOVE_HIDDEN_UNTIL_SETTING_NAME),
    );
    const remaining = until - now;
    return remaining > 0 && remaining <= 2 * DATA_DIR_MOVE_HIDE_MS
        ? until
        : null;
}

// The card in this window reads the hide once; put away from the start-up
// question, it stayed on screen saying what had just been put away.
function sayDataDirMoveHideChanged() {
    globalThis.dispatchEvent?.(
        new Event(DATA_DIR_MOVE_HIDE_CHANGED_EVENT_NAME),
    );
}

/** Back before the 30 days are up, from that list. */
export function showDataDirMoveAgain() {
    appHomeStorage.removeItem(DATA_DIR_MOVE_HIDDEN_UNTIL_SETTING_NAME);
    sayDataDirMoveHideChanged();
}

export function hideDataDirMoveForAWhile(now = Date.now()) {
    appHomeStorage.setItem(
        DATA_DIR_MOVE_HIDDEN_UNTIL_SETTING_NAME,
        `${now + DATA_DIR_MOVE_HIDE_MS}`,
    );
    sayDataDirMoveHideChanged();
}

/** Nothing comes back: the window asking is gone with the process. */
export function requestDataDirMove(fromDirPath: string) {
    appHomeStorage.setItem(
        DATA_DIR_MOVE_PENDING_SETTING_NAME,
        JSON.stringify({ fromDirPath, requestedAt: Date.now() }),
    );
    relaunchApp();
}

export type DataDirMoveResultType = {
    isMoved: boolean;
    fromDirPath: string;
    toDirPath: string;
    // The folder moved from is still there (copied, not renamed), marked with
    // `DATA_DIR_MOVED_TO_FLAG_FILE_NAME`.
    isCopied: boolean;
    errorMessage?: string;
};

/**
 * A refusal the dialog can put into words: `message` is already translated.
 * Its own class so a disk error is shown as what it is.
 */
class DataDirMoveError extends Error {}

function checkIsSamePath(path1: string, path2: string) {
    return (
        toPathCompareKey(pathResolve(path1)) ===
        toPathCompareKey(pathResolve(path2))
    );
}

function renamePath(oldPath: string, newPath: string) {
    return new Promise<void>((resolve, reject) => {
        appProvider.fileUtils.rename(oldPath, newPath, (error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

/**
 * Every file under a folder, hidden ones included, as a count and a size: the
 * proof a copy is whole. A macOS iCloud stub (`.name.icloud`) stands for a
 * file that is only online, which a copy would carry over as the stub.
 */
async function measureDirTree(dirPath: string) {
    const measure = { fileCount: 0, byteCount: 0, iCloudStubCount: 0 };
    const queue = [dirPath];
    while (queue.length > 0) {
        const currentDirPath = queue.shift() as string;
        for (const entry of await fsListDirents(currentDirPath)) {
            const entryPath = pathJoin(currentDirPath, entry.name);
            if (entry.isDirectory) {
                queue.push(entryPath);
            } else if (entry.isFile) {
                measure.fileCount++;
                measure.byteCount += await fsGetFileSize(entryPath);
                if (/^\..+\.icloud$/.test(entry.name)) {
                    measure.iCloudStubCount++;
                }
            }
        }
    }
    return measure;
}

// A staging folder left by a start that was cut short is never finished, and
// is the app's own: nobody else names a folder like this.
async function removeStaleStagingDirs(homeDirPath: string) {
    const direntList = await fsListDirents(homeDirPath).catch(() => {
        return [];
    });
    for (const { name, isDirectory } of direntList) {
        if (isDirectory && name.startsWith(STAGING_DIR_PREFIX)) {
            try {
                await fsDeleteDir(pathJoin(homeDirPath, name));
            } catch (error) {
                handleError(error);
            }
        }
    }
}

/**
 * Where a move would put the folder now: the default when free or empty, else
 * the next free name beside it. For the question to name the folder the move
 * makes -- it named the default even when that held another data folder,
 * which read as the two being put together.
 */
export async function genDataDirMoveTargetPath() {
    const defaultDirPath = getDefaultDataDirPath();
    if (
        !(await fsCheckDirExist(defaultDirPath)) ||
        (await fsListDirents(defaultDirPath)).length === 0
    ) {
        return defaultDirPath;
    }
    return genFreeDirPath(pathDirname(defaultDirPath), DEFAULT_DATA_DIR_NAME);
}

// The default when free; an empty folder there is taken over, one holding
// anything gets the next free name beside it.
async function genTargetDirPath() {
    const targetDirPath = await genDataDirMoveTargetPath();
    if (
        checkIsSamePath(targetDirPath, getDefaultDataDirPath()) &&
        (await fsCheckDirExist(targetDirPath))
    ) {
        await fsDeleteDir(targetDirPath);
    }
    return targetDirPath;
}

type ProgressType = { update: (done: number, total: number) => void };

/**
 * On a Mac, before anything moves: a renamed stub leaves iCloud's Desktop,
 * and iCloud then deletes the file it stood for; a copied one is only a stub.
 * Either way that file would be gone, so the move waits until it is here.
 */
function checkIsAllOnThisMac(measure: { iCloudStubCount: number }) {
    if (appProvider.systemUtils.isMac && measure.iCloudStubCount > 0) {
        throw new DataDirMoveError(
            tran(
                'Some files in the data folder are only in iCloud Drive. Open the folder in Finder, choose Download Now, then try again.',
            ),
        );
    }
}

/**
 * Copied under a hidden staging name and renamed into place only once every
 * file is in and counted, so a copy that fails, or an app closed half way,
 * never leaves a folder that looks finished. Reading each file is what makes
 * OneDrive download one that was only online; offline, the read fails and
 * nothing changes.
 */
async function copyDataDir(
    fromDirPath: string,
    toDirPath: string,
    homeDirPath: string,
    progress: ProgressType,
) {
    const expected = await measureDirTree(fromDirPath);
    checkIsAllOnThisMac(expected);
    const stagingDirPath = pathJoin(
        homeDirPath,
        `${STAGING_DIR_PREFIX}${Date.now()}`,
    );
    try {
        const counts = { fileCount: 0, skippedCount: 0 };
        progress.update(0, expected.fileCount);
        await copyDirTree(fromDirPath, stagingDirPath, counts, () => {
            progress.update(counts.fileCount, expected.fileCount);
        });
        const copied = await measureDirTree(stagingDirPath);
        if (
            copied.fileCount !== expected.fileCount ||
            copied.byteCount !== expected.byteCount
        ) {
            throw new DataDirMoveError(
                tran(
                    'The copy is not the same as the data folder, so it was not used.',
                ),
            );
        }
        await renamePath(stagingDirPath, toDirPath);
    } catch (error) {
        try {
            await fsDeleteDir(stagingDirPath);
        } catch (_error) {}
        throw error;
    }
}

/**
 * The old folder's path in every form a file inside it was saved with -- raw,
 * JSON-escaped, a `file:///` URL -- written as `$DATA_DIR_PATH`, so it reads
 * as the new folder from now on. Unlike **Repair Links** it does not ask
 * whether the old path is still there: after a copy it is, and is no longer
 * the data folder. Returns how many files changed.
 */
export async function rewriteMovedDataDirLinks(
    dataDirPath: string,
    oldDirPath: string,
) {
    const oldAlias = genDataDirAlias(
        oldDirPath,
        pathSeparator,
        appProvider.browserUtils.pathToFileURL,
    );
    let fileCount = 0;
    await forEachDataDirTextFile(dataDirPath, async (filePath) => {
        const text = await fsReadFile(filePath);
        const rewrittenText = toPortableText(text, oldAlias);
        if (rewrittenText === text) {
            return;
        }
        await fsWriteFile(filePath, rewrittenText);
        fileCount++;
    });
    return fileCount;
}

const MOVED_AT_LINE_NAME = 'moved-at';
const MOVED_FROM_LINE_NAME = 'moved-from';
const MOVED_TO_LINE_NAME = 'moved-to';

function genFlagText(sentence: string, lines: [string, string][]) {
    return [
        sentence,
        '',
        ...lines.map(([name, value]) => {
            return `${name}: ${value}`;
        }),
        '',
    ].join('\n');
}

function readFlagLine(text: string, name: string) {
    for (const line of text.split(/\r?\n/)) {
        if (line.startsWith(`${name}: `)) {
            const value = line.slice(name.length + 2).trim();
            return value === '' ? null : value;
        }
    }
    return null;
}

async function readFlag(dirPath: string, fileName: string, name: string) {
    try {
        const text = await fsReadFile(pathJoin(dirPath, fileName));
        const dirPathValue = readFlagLine(text, name);
        if (dirPathValue === null) {
            return null;
        }
        return {
            dirPath: dirPathValue,
            movedAt: readFlagLine(text, MOVED_AT_LINE_NAME),
        };
    } catch (_error) {
        return null;
    }
}

/** Where the data folder at `dataDirPath` was moved from, if it was. */
export function readDataDirMovedFromFlag(dataDirPath: string) {
    return readFlag(
        dataDirPath,
        DATA_DIR_MOVED_FROM_FLAG_FILE_NAME,
        MOVED_FROM_LINE_NAME,
    );
}

/** Where the folder at `dirPath` was moved to, when it is a copy left behind. */
export function readDataDirMovedToFlag(dirPath: string) {
    return readFlag(
        dirPath,
        DATA_DIR_MOVED_TO_FLAG_FILE_NAME,
        MOVED_TO_LINE_NAME,
    );
}

/**
 * Once the folder is in its new place: the choice follows it at once, and
 * nothing after that can undo the move -- a link left unrewritten or a flag
 * not written is reported and passed over.
 */
async function finishDataDirMove(
    fromDirPath: string,
    toDirPath: string,
    isCopied: boolean,
) {
    await appLocalStorage.setSelectedParentDirectory(toDirPath);
    // Recent Folders must not offer the way back to a copy no longer used.
    removeParentDirHistory(fromDirPath);
    try {
        // Before React mounts: the color-note check at start-up drops a note
        // whose file it cannot find.
        await rewriteMovedDataDirLinks(toDirPath, fromDirPath);
    } catch (error) {
        handleError(error);
    }
    const movedAt = new Date().toISOString();
    try {
        // After the rewrite, which is not asked to read it.
        await fsWriteFile(
            pathJoin(toDirPath, DATA_DIR_MOVED_FROM_FLAG_FILE_NAME),
            genFlagText(tran('Open Worship App moved this data folder here.'), [
                [MOVED_AT_LINE_NAME, movedAt],
                [MOVED_FROM_LINE_NAME, fromDirPath],
            ]),
        );
    } catch (error) {
        handleError(error);
    }
    if (!isCopied) {
        return;
    }
    try {
        await fsWriteFile(
            pathJoin(fromDirPath, DATA_DIR_MOVED_TO_FLAG_FILE_NAME),
            genFlagText(
                tran(
                    'Open Worship App no longer uses this folder: it was copied to the place below. When you are sure everything is there, move this folder to the Recycle Bin (Trash) yourself.',
                ),
                [
                    [MOVED_AT_LINE_NAME, movedAt],
                    [MOVED_TO_LINE_NAME, toDirPath],
                ],
            ),
        );
    } catch (error) {
        // The move stands; only the reminder about the old copy is lost.
        handleError(error);
    }
}

export type DataDirCopyResultType = {
    isCopied: boolean;
    toDirPath: string;
    errorMessage?: string;
};

function checkIsPathInside(dirPath: string, parentDirPath: string) {
    const key = toPathCompareKey(pathResolve(dirPath));
    const parentKey = toPathCompareKey(pathResolve(parentDirPath));
    return key === parentKey || key.startsWith(parentKey + pathSeparator);
}

/**
 * A copy of the data folder in use, put where the person chose -- a USB
 * stick, another drive, any folder (the user: _in path setting, add option to
 * copy data dir to a drive_, _or to a folder_, _so user can decide to choose a
 * drive_). The copy the move makes (`copyDataDir`: a hidden staging name,
 * every file counted and its size checked, renamed into place only once
 * whole), as `<chosen>/open-worship-data` or the next free name. The copy is a
 * data folder of its OWN: a new marker, so the app never takes it for the one
 * it came from and Found Data Folders can list it, and none of the move's
 * flags, so it never reminds of an old copy. The folder in use stays in use.
 */
export async function copyDataDirTo(
    fromDirPath: string,
    parentDirPath: string,
    progress: ProgressType,
): Promise<DataDirCopyResultType> {
    let toDirPath = pathJoin(parentDirPath, DEFAULT_DATA_DIR_NAME);
    try {
        if (checkIsPathInside(parentDirPath, fromDirPath)) {
            throw new DataDirMoveError(
                tran('The copy cannot go inside the data folder itself.'),
            );
        }
        toDirPath = await genFreeDirPath(parentDirPath, DEFAULT_DATA_DIR_NAME);
        await copyDataDir(fromDirPath, toDirPath, parentDirPath, progress);
        try {
            // A path saved whole -- before `$DATA_DIR_PATH`, or by a tool
            // that writes it raw -- still named the folder copied FROM: on
            // the copy, the Documents setting and a slide's picture went on
            // reading and writing the original. Repair Links cannot see it,
            // because the original is still there.
            await rewriteMovedDataDirLinks(toDirPath, fromDirPath);
        } catch (error) {
            // The copy is whole; a link left as it was is what Repair Links
            // is for once the original is gone.
            handleError(error);
        }
        for (const fileName of [
            DATA_DIR_MARKER_FILE_NAME,
            DATA_DIR_MOVED_FROM_FLAG_FILE_NAME,
            DATA_DIR_MOVED_TO_FLAG_FILE_NAME,
        ]) {
            const filePath = pathJoin(toDirPath, fileName);
            if (await fsCheckFileExist(filePath)) {
                await fsDeleteFile(filePath);
            }
        }
        ensureDataDirMarkerIdSync(toDirPath);
    } catch (error) {
        if (!(error instanceof DataDirMoveError)) {
            handleError(error);
        }
        return {
            isCopied: false,
            toDirPath,
            errorMessage: error instanceof Error ? error.message : `${error}`,
        };
    }
    return { isCopied: true, toDirPath };
}

/**
 * The move itself. Renamed when the folder is not under OneDrive -- instant,
 * no second copy on the disk -- and copied when it is, or when the rename is
 * refused (a file held open, another drive). A failure changes nothing: the
 * app keeps using the folder where it is, and asks again at the next launch.
 */
export async function moveDataDir(
    fromDirPath: string,
    progress: ProgressType,
): Promise<DataDirMoveResultType> {
    const homeDirPath = pathDirname(getDefaultDataDirPath());
    let toDirPath = getDefaultDataDirPath();
    let isCopied = false;
    try {
        await fsCreateDir(homeDirPath);
        await removeStaleStagingDirs(homeDirPath);
        toDirPath = await genTargetDirPath();
        if (appProvider.systemUtils.isMac) {
            checkIsAllOnThisMac(await measureDirTree(fromDirPath));
        }
        let isRenamed = false;
        if (!checkIsInOneDrivePath(fromDirPath)) {
            try {
                await renamePath(fromDirPath, toDirPath);
                isRenamed = true;
            } catch (error) {
                // EPERM / EBUSY on Windows when a file is held open, EXDEV
                // across drives: the copy below still works.
                console.warn('Renaming the data folder failed:', error);
            }
        }
        if (!isRenamed) {
            await copyDataDir(fromDirPath, toDirPath, homeDirPath, progress);
            isCopied = true;
        }
    } catch (error) {
        if (!(error instanceof DataDirMoveError)) {
            handleError(error);
        }
        return {
            isMoved: false,
            fromDirPath,
            toDirPath,
            isCopied,
            errorMessage: error instanceof Error ? error.message : `${error}`,
        };
    }
    await finishDataDirMove(fromDirPath, toDirPath, isCopied);
    return { isMoved: true, fromDirPath, toDirPath, isCopied };
}

// The page has not rendered yet, so plain DOM: a few words and a count, in
// the app's language, over whatever the window shows while it loads.
function showMovingOverlay(): ProgressType & { remove: () => void } {
    const element = document.createElement('div');
    element.setAttribute('role', 'status');
    Object.assign(element.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '2147483647',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '16px',
        textAlign: 'center',
        fontSize: '18px',
        background: 'var(--bs-body-bg, #212529)',
        color: 'var(--bs-body-color, #dee2e6)',
    });
    const titleElement = document.createElement('div');
    titleElement.textContent = tran(
        'Moving your data folder to a safe place. Please wait…',
    );
    const countElement = document.createElement('div');
    element.append(titleElement, countElement);
    document.body.append(element);
    let lastUpdatedAt = 0;
    return {
        update(done, total) {
            // Text only, at most a few times a second: a folder of small
            // files would otherwise repaint once per file.
            const now = Date.now();
            if (done !== total && now - lastUpdatedAt < 250) {
                return;
            }
            lastUpdatedAt = now;
            countElement.textContent = `${done} / ${total}`;
        },
        remove() {
            element.remove();
        },
    };
}

function readPendingFromDirPath(pendingText: string) {
    try {
        const fromDirPath = JSON.parse(pendingText)?.fromDirPath;
        return typeof fromDirPath === 'string' && fromDirPath.length > 0
            ? fromDirPath
            : null;
    } catch (_error) {
        return null;
    }
}

/**
 * At the start of the main window, before anything reads the data folder:
 * the move asked for before the relaunch. Claimed first, like the start-up
 * migrations, so a start that crashes half way never moves twice; the folder
 * is moved only while it is still the one chosen. The outcome is left in
 * `sessionStorage` for the window to say once it has rendered.
 */
export async function runPendingDataDirMove() {
    const pendingText = appHomeStorage.getItem(
        DATA_DIR_MOVE_PENDING_SETTING_NAME,
    );
    if (pendingText === null || !checkIsMainWindow()) {
        return;
    }
    appHomeStorage.removeItem(DATA_DIR_MOVE_PENDING_SETTING_NAME);
    const fromDirPath = readPendingFromDirPath(pendingText);
    const selectedDirPath = appHomeStorage.getItem(
        SELECTED_PARENT_DIR_SETTING_NAME,
    );
    if (
        fromDirPath === null ||
        !selectedDirPath ||
        !checkIsSamePath(fromDirPath, selectedDirPath) ||
        !(await fsCheckDirExist(fromDirPath))
    ) {
        return;
    }
    await getLangDataAsync(getCurrentLocale());
    const overlay = showMovingOverlay();
    try {
        const result = await moveDataDir(selectedDirPath, overlay);
        try {
            sessionStorage.setItem(
                DATA_DIR_MOVE_RESULT_SESSION_NAME,
                JSON.stringify(result),
            );
        } catch (_error) {}
    } finally {
        overlay.remove();
    }
}
