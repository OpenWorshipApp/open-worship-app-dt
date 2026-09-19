import DirSource from './DirSource';
import FileSource from './FileSource';
import {
    fsCheckDirExist,
    fsCheckFileExist,
    pathDirname,
    pathJoin,
    type MimetypeNameType,
} from '../server/fileHelpers';
import { checkAreArraysEqual } from '../server/comparisonHelpers';
import appProvider from '../server/appProvider';
import { handleError } from './errorHelpers';
import { HISTORY_DIR_NAME_SUFFIX } from '../editing-manager/editingHistoryPathHelpers';
import { appLocalStorage } from '../setting/directory-setting/appLocalStorage';
import { genTimeoutAttempt } from './timeoutHelpers';

// `FileSource` starts the watch, so this module must stay free of React and of
// `domHelpers` (which installs a `MutationObserver` and an IPC listener at
// module load). Pulling those in through `FileSource` would drag the whole DOM
// graph into every consumer of it.

/**
 * The suffixes that make a path a SIDECAR of another file rather than a file of
 * its own — a change inside one is a change to the file it belongs to.
 */
const fileExtraSuffixes = [HISTORY_DIR_NAME_SUFFIX, '-htmls', '-images'];

/**
 * The changed path is told first, always. Then — and ONLY when the path is a
 * SIDECAR of another file — the file it belongs to is told as well: a revision
 * written into `song.ows.histories` IS a change to `song.ows`, and nothing else
 * would ever say so.
 */
// TODO: support other events: 'rename', 'unlink', 'add'
async function alertFileChanging(filePath: string) {
    FileSource.getInstance(filePath).fireUpdateEvent();
    const sidecarSuffix = fileExtraSuffixes.find((suffix) => {
        return filePath.includes(suffix);
    });
    if (sidecarSuffix === undefined) {
        return;
    }
    const originalFilePath = filePath.split(sidecarSuffix)[0];
    if (await fsCheckFileExist(originalFilePath)) {
        FileSource.getInstance(originalFilePath).fireUpdateEvent();
    }
}

/**
 * Re-list the directory and fire `refresh` only if its file list actually
 * moved. `fireRefreshEvent` is what empties `filePathsMap`, so an unconditional
 * call would make every list re-read the directory on every write.
 */
async function reconcileDirSource(dirSource: DirSource) {
    try {
        const mimetypeNames = Object.keys(
            dirSource.filePathsMap,
        ) as MimetypeNameType[];
        if (mimetypeNames.length === 0) {
            dirSource.fireRefreshEvent();
            return;
        }
        for (const mimetypeName of mimetypeNames) {
            const oldFilePaths = dirSource.filePathsMap[mimetypeName];
            const newFilePaths =
                await dirSource.getFilePathsQuick(mimetypeName);
            if (!checkAreArraysEqual(oldFilePaths, newFilePaths)) {
                dirSource.fireRefreshEvent();
            }
        }
    } catch (_error) {
        dirSource.fireRefreshEvent();
    }
}

/**
 * ONE trailing pass per burst.
 *
 * The watch is recursive over the whole data dir, so a single media download
 * writes its file in hundreds of chunks and every chunk is its own event —
 * doing the filesystem work inline would spend an `fsCheckFileExist` and a full
 * `readdir` diff on each one, on the hardware least able to afford it. The
 * paths pile up in sets meanwhile, so two directories touched inside the same
 * window are BOTH reconciled: a plain debounce would keep only the last.
 *
 * A module-level timer is right here — this helper is single-instance by
 * construction (one watch per renderer), not one-per-component.
 */
const WATCH_EVENT_DEBOUNCE_MILLISECOND = 500;
const attemptTimeout = genTimeoutAttempt(WATCH_EVENT_DEBOUNCE_MILLISECOND);
const pendingFilePaths = new Set<string>();
const pendingDirPaths = new Set<string>();
let isPendingEveryDirSource = false;

function flushPendingFileEvents() {
    const filePaths = Array.from(pendingFilePaths);
    const dirPaths = Array.from(pendingDirPaths);
    const isEveryDirSource = isPendingEveryDirSource;
    pendingFilePaths.clear();
    pendingDirPaths.clear();
    isPendingEveryDirSource = false;
    // `getInstanceByDirPath` only ever answers for a directory some list is
    // mounted on, which is also what keeps a sidecar write cheap: the parent of
    // `<file>.histories/3` is the history folder itself, which owns no
    // `DirSource`, so it drops out here instead of costing a `readdir`.
    const dirSources = isEveryDirSource
        ? DirSource.getAllInstances()
        : dirPaths
              .map((dirPath) => {
                  return DirSource.getInstanceByDirPath(dirPath);
              })
              .filter((dirSource) => {
                  return dirSource !== null;
              });
    (async () => {
        for (const filePath of filePaths) {
            await alertFileChanging(filePath);
        }
        for (const dirSource of dirSources) {
            await reconcileDirSource(dirSource);
        }
    })().catch(handleError);
}

/**
 * Deliberately synchronous and free of I/O: it runs once per filesystem event,
 * and during a download that is thousands of times a minute. All it does is
 * remember what to look at, then arm the trailing pass.
 */
function handleFileEvent(rootDirPath: string, ...args: any[]) {
    const [eventType, name] = args as [string, string | null];
    if (typeof name !== 'string') {
        // Nothing to attribute the change to — see `DirSource.getAllInstances`.
        isPendingEveryDirSource = true;
    } else {
        const filePath = pathJoin(rootDirPath, name);
        if (eventType === 'change' || eventType === 'rename') {
            pendingFilePaths.add(filePath);
        }
        // The directory holding the entry is the only list whose contents can
        // have moved — and it is asked whether or not the entry still exists,
        // because a DELETED file has to leave the list too.
        pendingDirPaths.add(pathDirname(filePath));
    }
    attemptTimeout(flushPendingFileEvents);
}

async function watchDir(dirPath: string, signal: AbortSignal) {
    const isDirExist = await fsCheckDirExist(dirPath);
    if (!isDirExist) {
        return false;
    }
    try {
        appProvider.fileUtils.watch(
            dirPath,
            {
                signal,
                recursive: true,
            },
            handleFileEvent.bind(null, dirPath),
        );
        return true;
    } catch (error) {
        handleError(error);
        return false;
    }
}

type WatchingStateType = {
    dirPath: string;
    abortController: AbortController;
};

let watchingState: WatchingStateType | null = null;
let startingPromise: Promise<void> | null = null;
const resolvedPromise = Promise.resolve();

async function startWatchingDataDir() {
    try {
        const dirPath =
            (await appLocalStorage.getSelectedParentDirectory()) ?? '';
        if (dirPath.trim() === '') {
            return;
        }
        const abortController = new AbortController();
        const isWatching = await watchDir(dirPath, abortController.signal);
        // Only a watch that actually started is remembered, so a run that found
        // no directory (first launch, before the user picks one) is retried by
        // the next caller instead of being latched as "done".
        if (isWatching) {
            watchingState = { dirPath, abortController };
        }
    } finally {
        startingPromise = null;
    }
}

/**
 * EVERY `FileSource` listener registration calls this, and a list mounts one
 * per row, so the settled case has to be a field read and nothing more.
 *
 * It used to take an `unlocking` lock and re-read the selected directory off
 * disk on each call; because that lock waits by polling on a 100ms timer, a
 * 50-row list spent ~4.7 seconds of background churn and 50 filesystem stats to
 * install a single watch.
 */
export function watchDataDir() {
    if (watchingState !== null) {
        return resolvedPromise;
    }
    // In-flight starts share one promise, so a burst of registrations resolves
    // the directory once rather than once each.
    startingPromise ??= startWatchingDataDir();
    return startingPromise;
}

/**
 * Aborts the watch by the identity it was STARTED with. Resolving the selected
 * directory again here would be a bug: the one caller that needs this is the
 * data-directory setting, which unwatches precisely because the selection is
 * about to change, and the old tree would then never be released.
 */
export function unwatchDataDir() {
    if (watchingState === null) {
        return;
    }
    watchingState.abortController.abort();
    watchingState = null;
}
