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
    fsMove,
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
    confirmUnverifiedPackFile,
    exportPackFile,
    pickPackFile,
    readPackFileJson,
    toNotInstallablePackMessage,
} from '../packFileHelpers';
import {
    EXTRA_BIN_ARCHIVE_REGEX,
    EXTRA_BIN_INFO_FILE_NAME,
    checkIsExtraBinInstalled,
    getExtraBinDirPath,
    getExtraBinPlatformName,
    getInstalledExtraBinVersion,
    moveLegacyExtraBinPack,
    notifyExtraBinChanged,
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

async function getDevExtraBinEntry(
    isQuiet = false,
): Promise<ExtraBinEntryType | null> {
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
        if (isQuiet) {
            return null;
        }
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
 *
 * `isQuiet` for the launch's look for updates, which nobody asked for and must
 * never pop up dev's "no local pack" toast.
 */
export async function getExtraBinEntry(
    isQuiet = false,
): Promise<ExtraBinEntryType | null> {
    if (appProvider.systemUtils.isDev) {
        return await getDevExtraBinEntry(isQuiet);
    }
    const extraBin = await readPublishedExtraBinMap();
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
 * True when a pack's checksum is one published for this computer's platform,
 * under ANY app version: a friend's file may well be an older release. Read
 * only when a file is imported; offline answers false (the person is asked).
 */
export async function checkIsPublishedExtraBinChecksum(checksum: string) {
    if (appProvider.systemUtils.isDev) {
        const entry = await getDevExtraBinEntry(true);
        return entry?.checksum === checksum;
    }
    const extraBin = await readPublishedExtraBinMap();
    return Object.values(extraBin ?? {}).some((entry) => {
        return entry?.checksum === checksum;
    });
}

async function readPublishedExtraBinMap(): Promise<{
    [appVersion: string]: ExtraBinEntryType | undefined;
} | null> {
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
    return extraBin !== null && typeof extraBin === 'object' ? extraBin : null;
}

async function listLocalExtraBinArchives(dirPath: string) {
    try {
        const fileFullNames = await fsListFiles(dirPath);
        return fileFullNames.filter((fileFullName) => {
            return EXTRA_BIN_ARCHIVE_REGEX.test(fileFullName);
        });
    } catch (_error) {
        return [];
    }
}

/**
 * The archive is deliberately KEPT after extraction, so a pack whose binaries
 * got corrupted can be repaired with no network. Note this is the opposite of
 * `extractDownloadedBible`, which deletes in its `finally` — do not "fix" this
 * one to match it.
 */
export async function findLocalExtraBinArchive(dirPath: string) {
    const fileFullNames = await listLocalExtraBinArchives(dirPath);
    return fileFullNames[0] ?? null;
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
    // A pack picked from the disk (Import), already checked by
    // `importExtraBinFromFile`: copied in as this computer's archive, in
    // place of every other one.
    importedArchive?: ImportedExtraBinArchiveType | null;
};

type ImportedExtraBinArchiveType = { filePath: string; version: string };

/**
 * The picked file goes in as `bin-<version>.tar.gz`, the name a download
 * gives it. Through a name of its own, never straight onto the target: the
 * file picked may BE the target, and deleting that first would lose the only
 * copy.
 */
async function copyImportedExtraBinArchive(
    { filePath, version }: ImportedExtraBinArchiveType,
    dirPath: string,
) {
    const fileFullName = `bin-${version}.tar.gz`;
    const targetFilePath = pathJoin(dirPath, fileFullName);
    const tempFilePath = pathJoin(dirPath, `.import-${fileFullName}`);
    await fsDeleteFile(tempFilePath).catch(logError);
    try {
        await fsCloneFile(filePath, tempFilePath);
        await fsDeleteFile(targetFilePath);
        await fsMove(tempFilePath, targetFilePath);
    } catch (error) {
        // Tens of MB nothing would ever look at again.
        await fsDeleteFile(tempFilePath).catch(logError);
        throw error;
    }
    return fileFullName;
}

/**
 * Install (or repair, or update) the pack. Serialized: two extractions into the
 * same folder at once would interleave file writes.
 */
export async function installExtraBin({
    entry,
    isForceDownload = false,
    supersededArchiveFileFullName = null,
    importedArchive = null,
}: InstallExtraBinOptionsType = {}) {
    return unlocking(INSTALL_LOCK_KEY, async () => {
        showProgressBar(PROGRESS_BAR_EVENT_KEY);
        try {
            // An old single-folder pack for this OS is ITS pack: moved in
            // first, so it is re-used rather than downloaded again.
            await moveLegacyExtraBinPack();
            const dirPath = getExtraBinDirPath();
            await ensureDirectory(dirPath);
            let archiveFileFullName = await findLocalExtraBinArchive(dirPath);
            let supersededArchiveFileFullNames =
                supersededArchiveFileFullName === null
                    ? []
                    : [supersededArchiveFileFullName];
            if (importedArchive !== null) {
                // Every archive here goes once this one is in: Re-extract
                // takes the first it finds, and that must be this one.
                supersededArchiveFileFullNames =
                    await listLocalExtraBinArchives(dirPath);
                archiveFileFullName = await copyImportedExtraBinArchive(
                    importedArchive,
                    dirPath,
                );
            } else if (archiveFileFullName === null || isForceDownload) {
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
            for (const fileFullName of supersededArchiveFileFullNames) {
                if (fileFullName !== archiveFileFullName) {
                    await fsDeleteFile(pathJoin(dirPath, fileFullName)).catch(
                        logError,
                    );
                }
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
            // Other windows re-read, and a Screen Mirror tunnel waiting for
            // the pack's cloudflared starts (main process).
            notifyExtraBinChanged();
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

// -- sharing the pack as a file ---------------------------------------------

// A version goes into a file name: nothing that could climb out of the folder.
const EXTRA_BIN_PACK_VERSION_PATTERN = /^[\w.-]+$/;

/** What a pack's own `info.json` says, or null for a file that is no pack. */
async function readExtraBinPackInfo(archiveFilePath: string) {
    const info = await readPackFileJson(
        archiveFilePath,
        EXTRA_BIN_INFO_FILE_NAME,
    );
    if (info === null || typeof info !== 'object') {
        return null;
    }
    const { version, platform } = info as {
        version?: unknown;
        platform?: unknown;
    };
    if (
        typeof version !== 'string' ||
        !EXTRA_BIN_PACK_VERSION_PATTERN.test(version) ||
        typeof platform !== 'string'
    ) {
        return null;
    }
    return { version, platform };
}

/**
 * Installs the pack from a file a friend passed on (Settings > Others > Extra
 * Binaries > Import), with no network needed. Refused when it was built for
 * another kind of computer -- its programs would not start here; asked about
 * when no published pack has its checksum. `filePath` skips the picker.
 */
export async function importExtraBinFromFile(filePath?: string | null) {
    const archiveFilePath = filePath ?? (await pickPackFile());
    if (!archiveFilePath) {
        return false;
    }
    const toastTitle = tran(EXTRA_BIN_TOAST_TITLE);
    const info = await readExtraBinPackInfo(archiveFilePath);
    if (info === null) {
        showSimpleToast(
            toastTitle,
            toNotInstallablePackMessage(`"${pathBasename(archiveFilePath)}"`),
        );
        return false;
    }
    const platformName = getExtraBinPlatformName();
    if (info.platform !== platformName) {
        showSimpleToast(
            toastTitle,
            toNotInstallablePackMessage(
                `"${info.platform}" (${tran('This computer')}: ` +
                    `"${platformName}")`,
            ),
        );
        return false;
    }
    const checksum = await getFileChecksum(archiveFilePath, 'sha512');
    const isPublished =
        checksum !== null && (await checkIsPublishedExtraBinChecksum(checksum));
    if (!isPublished && !(await confirmUnverifiedPackFile())) {
        return false;
    }
    return await installExtraBin({
        importedArchive: { filePath: archiveFilePath, version: info.version },
    });
}

/**
 * Copies the kept archive into Downloads to pass on. Named for the computer it
 * runs on (`bin-0.0.4-win.tar.gz`): the friend's may need another one. Null
 * when there is no archive to copy.
 */
export async function exportExtraBinArchive() {
    const dirPath = getExtraBinDirPath();
    const archiveFileFullName = await findLocalExtraBinArchive(dirPath);
    if (archiveFileFullName === null) {
        return null;
    }
    return await exportPackFile(
        tran(EXTRA_BIN_TOAST_TITLE),
        pathJoin(dirPath, archiveFileFullName),
        archiveFileFullName.replace(
            /\.tar\.gz$/,
            `-${getExtraBinPlatformName()}.tar.gz`,
        ),
    );
}
