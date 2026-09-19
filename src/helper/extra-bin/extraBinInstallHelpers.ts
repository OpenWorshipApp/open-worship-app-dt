import {
    messageCallback,
    streamDownloadFile,
} from '../../background/downloadHelper';
import { tran } from '../../lang/langHelpers';
import {
    hideProgressBar,
    showProgressBar,
} from '../../progress-bar/progressBarHelpers';
import appProvider from '../../server/appProvider';
import { tarExtract } from '../../server/appHelpers';
import {
    ensureDirectory,
    fsCloneFile,
    fsDeleteFile,
    fsListFiles,
    fsReadFile,
    getFileChecksum,
    pathBasename,
    pathJoin,
} from '../../server/fileHelpers';
import {
    checkIsVersionOutdated,
    getDownloadTargetUrl,
} from '../../server/updatingAppHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import { appError as logError } from '../loggerHelpers';
import { unlocking } from '../../server/unlockingHelpers';
import {
    EXTRA_BIN_ARCHIVE_REGEX,
    checkIsExtraBinInstalled,
    getExtraBinDirPath,
    getInstalledExtraBinVersion,
} from './extraBinHelpers';

export type ExtraBinEntryType = {
    url: string;
    version: string;
    checksum?: string;
};

export const EXTRA_BIN_TOAST_TITLE = 'Extra Binaries';
const PROGRESS_BAR_EVENT_KEY = 'extra-bin-install';
const INSTALL_LOCK_KEY = 'extra-bin-install';
const DEV_RELEASE_DIR_PARTS = [
    'extra-work',
    'experiment-building',
    'release',
] as const;

function getDevReleaseDirPath() {
    // In dev `app.getAppPath()` is the repo root, so the pack the local build
    // produced can stand in for the published one.
    const appPath = appProvider.messageUtils.sendDataSync(
        'main:app:get-app-path',
    ) as string;
    return pathJoin(appPath, ...DEV_RELEASE_DIR_PARTS);
}

async function getDevExtraBinEntry(): Promise<ExtraBinEntryType | null> {
    const dirPath = getDevReleaseDirPath();
    try {
        const binInfo = JSON.parse(
            await fsReadFile(pathJoin(dirPath, 'bin-info.json')),
        );
        return {
            url: pathJoin(dirPath, binInfo.fileFullName),
            version: binInfo.version,
            checksum: binInfo.checksum,
        };
    } catch (_error) {
        showSimpleToast(
            tran(EXTRA_BIN_TOAST_TITLE),
            `${tran('No local pack was built yet')}: ` +
                'run `npm i` (or `node extra-work/build-extra-bin.mjs`) ' +
                `to create one in "${dirPath}"`,
        );
        return null;
    }
}

/**
 * Which pack this app version should install, out of the cumulative `extraBin`
 * map published in the platform's `info.json`. The map is keyed by the app
 * version the pack was released with — the zero-padded `2026.07.26` form that
 * `appProvider.appInfo.version` carries, NOT the unpadded one in an installer
 * file name.
 *
 * An app version with no entry of its own (a build made between two releases)
 * falls back to the newest published pack rather than refusing to install.
 */
export async function getExtraBinEntry(): Promise<ExtraBinEntryType | null> {
    if (appProvider.systemUtils.isDev) {
        return await getDevExtraBinEntry();
    }
    const url = await getDownloadTargetUrl(true);
    if (url === null) {
        return null;
    }
    const downloadInfo = await fetch(url, { method: 'GET', cache: 'no-cache' })
        .then((response) => {
            if (!response.ok) {
                throw new Error(
                    `Failed to fetch extra-bin info: ${response.statusText}`,
                );
            }
            return response.json();
        })
        .catch((error) => {
            logError('Error fetching extra-bin info:', error);
            return null;
        });
    const extraBin = downloadInfo?.extraBin ?? null;
    if (extraBin === null) {
        return null;
    }
    const entry = extraBin[appProvider.appInfo.version];
    if (entry) {
        return entry;
    }
    const newestKey = Object.keys(extraBin).reduce(
        (currentKey: string | null, key) => {
            if (currentKey === null) {
                return key;
            }
            return checkIsVersionOutdated(currentKey, key) ? key : currentKey;
        },
        null,
    );
    return newestKey === null ? null : (extraBin[newestKey] ?? null);
}

/**
 * The archive is deliberately KEPT after extraction, so a pack whose binaries
 * got corrupted can be repaired with no network. Note this is the opposite of
 * `extractDownloadedBible`, which deletes in its `finally` — do not "fix" this
 * one to match it.
 */
export async function findLocalExtraBinArchive(dirPath: string) {
    try {
        const fileFullNames = await fsListFiles(dirPath);
        return (
            fileFullNames.find((fileFullName) => {
                return EXTRA_BIN_ARCHIVE_REGEX.test(fileFullName);
            }) ?? null
        );
    } catch (_error) {
        return null;
    }
}

async function downloadExtraBinArchive(
    entry: ExtraBinEntryType,
    destFilePath: string,
) {
    if (appProvider.systemUtils.isDev) {
        // Dev has no published pack to fetch: the URL is the locally built file.
        // A plain clone, not `fsCopyFilePathToPath` — that one de-duplicates by
        // suffixing, and a second install would land as "bin-0.0.1 (1).tar.gz",
        // which nothing looks for.
        messageCallback('Copying the locally built pack...');
        await fsDeleteFile(destFilePath).catch(logError);
        await fsCloneFile(entry.url, destFilePath);
        return;
    }
    messageCallback('Downloading...');
    const { initHttpRequest } =
        await import('../bible-helpers/downloadHelpers');
    const response = await initHttpRequest(new URL(entry.url));
    await streamDownloadFile(destFilePath, response, messageCallback, true);
    if (entry.checksum) {
        // Verify BEFORE extracting: these are executables the app will spawn,
        // and a truncated download that still closed cleanly must never reach
        // the disk as one.
        messageCallback('Verifying...');
        const checksum = await getFileChecksum(destFilePath, 'sha512');
        if (checksum !== entry.checksum) {
            await fsDeleteFile(destFilePath).catch(logError);
            throw new Error(
                'Checksum mismatch: the downloaded pack is corrupted.',
            );
        }
    }
}

export async function extractExtraBin(archiveFileFullName: string) {
    const dirPath = getExtraBinDirPath();
    await tarExtract(pathJoin(dirPath, archiveFileFullName), dirPath);
}

export type InstallExtraBinOptionsType = {
    entry?: ExtraBinEntryType | null;
    // Fetch again even when an archive is already on disk (the repair path for
    // a corrupted archive, and the path an update takes).
    isForceDownload?: boolean;
    // Delete this archive once the new one is in — an update would otherwise
    // leave one pack per release behind.
    supersededArchiveFileFullName?: string | null;
};

/**
 * Install (or repair, or update) the pack. Serialized: two extractions into the
 * same folder at once would interleave file writes.
 */
export async function installExtraBin({
    entry,
    isForceDownload = false,
    supersededArchiveFileFullName = null,
}: InstallExtraBinOptionsType = {}) {
    return unlocking(INSTALL_LOCK_KEY, async () => {
        showProgressBar(PROGRESS_BAR_EVENT_KEY);
        try {
            const dirPath = getExtraBinDirPath();
            await ensureDirectory(dirPath);
            let archiveFileFullName = await findLocalExtraBinArchive(dirPath);
            if (archiveFileFullName === null || isForceDownload) {
                const targetEntry = entry ?? (await getExtraBinEntry());
                if (targetEntry === null) {
                    showSimpleToast(
                        tran(EXTRA_BIN_TOAST_TITLE),
                        `${tran('No pack is available for this app version')} ` +
                            `("${appProvider.appInfo.version}")`,
                    );
                    return false;
                }
                const fileFullName = pathBasename(targetEntry.url);
                await downloadExtraBinArchive(
                    targetEntry,
                    pathJoin(dirPath, fileFullName),
                );
                archiveFileFullName = fileFullName;
            }
            messageCallback('Extracting...');
            await extractExtraBin(archiveFileFullName);
            if (
                supersededArchiveFileFullName !== null &&
                supersededArchiveFileFullName !== archiveFileFullName
            ) {
                await fsDeleteFile(
                    pathJoin(dirPath, supersededArchiveFileFullName),
                ).catch(logError);
            }
            const { isInstalled, missingNames } =
                await checkIsExtraBinInstalled();
            if (!isInstalled) {
                throw new Error(
                    `The pack is missing: ${missingNames.join(', ')}`,
                );
            }
            showSimpleToast(
                tran(EXTRA_BIN_TOAST_TITLE),
                `${tran('Installed')} ` +
                    `"${await getInstalledExtraBinVersion()}"`,
            );
            return true;
        } catch (error) {
            logError(error);
            showSimpleToast(
                tran(EXTRA_BIN_TOAST_TITLE),
                `${tran('Error')}: ${error}`,
            );
            return false;
        } finally {
            hideProgressBar(PROGRESS_BAR_EVENT_KEY);
        }
    });
}
