import { tran } from '../../lang/langHelpers';
import { showAppConfirm } from '../../popup-widget/popupWidgetHelpers';
import { checkIsVersionOutdated } from '../../server/updatingAppHelpers';
import { reportPackageUpdates } from '../packageUpdateHelpers';
import {
    EXTRA_BIN_MEDIA_NAMES,
    checkIsExtraBinInstalled,
    getExtraBinDirPath,
    getExtraBinPaths,
    getInstalledExtraBinVersion,
} from './extraBinHelpers';
import {
    findLocalExtraBinArchive,
    getExtraBinEntry,
    installExtraBin,
} from './extraBinInstallHelpers';

/**
 * The gate in front of every yt-dlp call (2026-11-10, the user: _when user
 * attempt to download media the app should check the extra-bin
 * install/update confirm install/update first before proceeding_). Imported
 * lazily by `appHelpers.ts`: the confirm dialog and the install helpers stay
 * off the launch path, and nothing here is read before a download is asked.
 */

// The update look must not hold a download up. A network that hangs rather
// than fails would otherwise keep the person waiting on a question that never
// comes; past this the download goes on with the pack already installed.
export const EXTRA_BIN_UPDATE_CHECK_TIMEOUT_MILLISECONDS = 6_000;

/** The published pack, or null when it cannot be told in time (offline). */
async function readLatestExtraBinEntry() {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => {
            resolve(null);
        }, EXTRA_BIN_UPDATE_CHECK_TIMEOUT_MILLISECONDS);
    });
    try {
        return await Promise.race([
            getExtraBinEntry(true).catch(() => {
                return null;
            }),
            timeout,
        ]);
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Answers whether an install ran. Not whether it succeeded: the install's own
 * check also wants cloudflared, so the caller looks at the media tools itself.
 */
async function offerExtraBinInstall(missingNames: readonly string[]) {
    const isOk = await showAppConfirm(
        tran('Media Tools Required'),
        `${tran(
            'Downloading video or audio needs the extra binaries, ' +
                'which are not installed yet.',
        )} (${missingNames.join(', ')}). ` +
            `${tran('Would you like to download and install them now?')}`,
        { confirmButtonLabel: 'Download and Install' },
    );
    if (!isOk) {
        return false;
    }
    // A failure is toasted by the install itself; the caller stays quiet.
    await installExtraBin();
    return true;
}

/**
 * Offers a newer published pack before the download, and answers whether an
 * install ran. Declining keeps the installed pack, which still downloads: an
 * update is never a reason to refuse one. Offline or slow, nothing is asked.
 */
async function offerExtraBinUpdate() {
    const installedVersion = await getInstalledExtraBinVersion();
    if (installedVersion === null) {
        return false;
    }
    const entry = await readLatestExtraBinEntry();
    if (entry === null) {
        return false;
    }
    const isOutdated = checkIsVersionOutdated(installedVersion, entry.version);
    // What this look learned goes to the Setting gear's sign as well.
    reportPackageUpdates({ isExtraBinOutdated: isOutdated });
    if (!isOutdated) {
        return false;
    }
    const isOk = await showAppConfirm(
        tran('Update Available'),
        `${tran(
            'A newer version of the media tools is available. ' +
                'Would you like to update them before downloading?',
        )} (${installedVersion} → ${entry.version})`,
        { cancelButtonLabel: 'Not Now', confirmButtonLabel: 'Update' },
    );
    if (!isOk) {
        return false;
    }
    // The Settings panel's Update: the archive being replaced goes once the
    // new one is in, or the folder keeps one pack per release.
    const isUpdated = await installExtraBin({
        entry,
        isForceDownload: true,
        supersededArchiveFileFullName:
            await findLocalExtraBinArchive(getExtraBinDirPath()),
    });
    if (isUpdated) {
        reportPackageUpdates({ isExtraBinOutdated: false });
    }
    return true;
}

async function checkIsMediaToolsInstalled() {
    const { isInstalled } = await checkIsExtraBinInstalled(
        EXTRA_BIN_MEDIA_NAMES,
    );
    return isInstalled;
}

/**
 * The yt-dlp, ffmpeg and qjs paths to download with, or null when there is
 * nothing to download with: the install was declined or failed. A pack not
 * installed is offered right here, one with a newer release is offered as an
 * update, each confirmed first; the download then goes on.
 */
export async function requireExtraBinPaths() {
    const { isInstalled, missingNames } = await checkIsExtraBinInstalled(
        EXTRA_BIN_MEDIA_NAMES,
    );
    const isInstallRun = isInstalled
        ? await offerExtraBinUpdate()
        : await offerExtraBinInstall(missingNames);
    if (!isInstalled && !isInstallRun) {
        return null;
    }
    // Looked at again after any install: a failed update can leave the old
    // pack half replaced, and an install's own check also wants cloudflared,
    // which a media download does not need.
    if (isInstallRun && !(await checkIsMediaToolsInstalled())) {
        return null;
    }
    return getExtraBinPaths();
}
