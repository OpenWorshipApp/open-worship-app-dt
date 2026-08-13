import { appManagedDataDirNames } from '../constants';
import { tran } from '../../lang/langHelpers';
import { showAppConfirm } from '../../popup-widget/popupWidgetHelpers';
import appProvider from '../../server/appProvider';
import {
    fsCheckFileExist,
    fsReadFile,
    pathJoin,
} from '../../server/fileHelpers';
import { appLocalStorage } from '../../setting/directory-setting/appLocalStorage';

export const EXTRA_BIN_INFO_FILE_NAME = 'info.json';
export const EXTRA_BIN_ARCHIVE_REGEX = /^bin-.+\.tar\.gz$/;

/**
 * "What I just found on disk disagrees with what another window is showing."
 *
 * The Settings window is its own renderer, so the Extra Binaries panel cannot
 * see what the gate below discovered. It reads once and re-reads only after one
 * of its own buttons; being SENT here by the download prompt is not one of
 * those, so without this it can greet the user with a stale `Installed 0.0.2`
 * -- and, because that answer hides the primary button, with no way to install.
 */
const EXTRA_BIN_CHANGED_BROADCAST_CHANNEL = 'all:app:extra-bin-changed';
const EXTRA_BIN_CHANGED_RENDERER_CHANNEL = 'main:app:extra-bin-changed';

export function notifyExtraBinChanged() {
    appProvider.messageUtils.sendData(EXTRA_BIN_CHANGED_BROADCAST_CHANNEL);
}

/** Returns the unregister function, so a component can hand it back as its
 * effect cleanup without knowing the channel names. */
export function registerExtraBinChangedListener(handler: () => void) {
    appProvider.messageUtils.listenForData(
        EXTRA_BIN_CHANGED_RENDERER_CHANNEL,
        handler,
    );
    return () => {
        appProvider.messageUtils.removeListener(
            EXTRA_BIN_CHANGED_RENDERER_CHANNEL,
            handler,
        );
    };
}

export type ExtraBinPathsType = {
    dirPath: string;
    ytDlpBinPath: string;
    // yt-dlp's `--ffmpeg-location` takes the DIRECTORY, not the executable.
    ffmpegBinDirPath: string;
    // The executable itself, for the existence check only.
    ffmpegBinPath: string;
    qjsBinPath: string;
};

/**
 * Where the on-demand media pack is installed. Pure path math and NO `mkdir`:
 * this is called by an existence check, and a user who never downloads media
 * must not end up with an empty folder in their data directory.
 *
 * `defaultStorage` rather than `ensureDataDirectory`: that one creates the
 * folder and answers null before a parent directory has been picked, while this
 * one falls back to `getUserWritablePath()`, so the pack always has a home and
 * the read path can never disagree with the write path. Same shape as the
 * app-managed bible data folder in `dataDirectories.ts`.
 */
export function getExtraBinDirPath() {
    return pathJoin(
        appLocalStorage.defaultStorage,
        appManagedDataDirNames.EXTRA_BIN,
    );
}

export function getExtraBinPaths(): ExtraBinPathsType {
    const dirPath = getExtraBinDirPath();
    const dotExe = appProvider.systemUtils.isWindows ? '.exe' : '';
    const ffmpegBinDirPath = pathJoin(dirPath, 'ffmpeg', 'bin');
    return {
        dirPath,
        ytDlpBinPath: pathJoin(dirPath, 'yt', `yt-dlp${dotExe}`),
        ffmpegBinDirPath,
        ffmpegBinPath: pathJoin(ffmpegBinDirPath, `ffmpeg${dotExe}`),
        qjsBinPath: pathJoin(dirPath, 'qjs', `qjs${dotExe}`),
    };
}

/**
 * `missingNames` is what makes a failure diagnosable — "not installed" and "the
 * ffmpeg half of the pack is gone" need different answers.
 */
export async function checkIsExtraBinInstalled() {
    const { ytDlpBinPath, ffmpegBinPath, qjsBinPath } = getExtraBinPaths();
    const targetList = [
        ['yt-dlp', ytDlpBinPath],
        ['ffmpeg', ffmpegBinPath],
        ['qjs', qjsBinPath],
    ] as const;
    const existingList = await Promise.all(
        targetList.map(([_name, filePath]) => {
            return fsCheckFileExist(filePath);
        }),
    );
    const missingNames = targetList
        .filter((_target, index) => {
            return !existingList[index];
        })
        .map(([name]) => {
            return name;
        });
    return { isInstalled: missingNames.length === 0, missingNames };
}

export async function getInstalledExtraBinVersion() {
    try {
        const text = await fsReadFile(
            pathJoin(getExtraBinDirPath(), EXTRA_BIN_INFO_FILE_NAME),
        );
        const version = JSON.parse(text).version;
        return typeof version === 'string' ? version : null;
    } catch (_error) {
        return null;
    }
}

/**
 * The gate in front of every yt-dlp call. Returns null when the pack is not
 * there — after offering to take the user to the panel that installs it.
 */
export async function requireExtraBinPaths() {
    const { isInstalled, missingNames } = await checkIsExtraBinInstalled();
    if (isInstalled) {
        return getExtraBinPaths();
    }
    const isOk = await showAppConfirm(
        tran('Media Tools Required'),
        `${tran(
            'Downloading video or audio needs the extra binaries, ' +
                'which are not installed yet.',
        )} (${missingNames.join(', ')}). ` +
            `${tran('Would you like to open Settings to install them?')}`,
        {
            cancelButtonLabel: 'No',
            confirmButtonLabel: 'Yes',
        },
    );
    if (isOk) {
        // Before the window comes forward, so an already-open panel is
        // re-reading while it is being raised rather than after.
        notifyExtraBinChanged();
        // Dynamic so this module never drags the settings page's dependencies
        // into the media download path.
        const { openOthersSetting } =
            await import('../../setting/settingHelpers');
        openOthersSetting();
    }
    return null;
}
