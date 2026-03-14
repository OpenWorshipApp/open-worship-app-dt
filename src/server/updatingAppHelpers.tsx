import appProvider from './appProvider';
import { showSimpleToast } from '../toast/toastHelpers';
import { handleError } from '../helper/errorHelpers';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';
import { appLog, appError as logError } from '../helper/loggerHelpers';
import { tran } from '../lang/langHelpers';
import { fsMove, getDownloadPath, pathJoin } from './fileHelpers';
import {
    initHttpRequest,
    MessageCallbackType,
    writeStreamToFile,
} from '../helper/bible-helpers/downloadHelpers';
import { showFileOrDirExplorer } from './appHelpers';
import {
    hideProgressBar,
    showProgressBar,
    showProgressBarMessage,
} from '../progress-bar/progressBarHelpers';
import FileSource from '../helper/FileSource';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';

type UpdateDataType = {
    version: string;
    commitID: string;
    isMac: boolean;
    isArm64: boolean;
    isUniversal: boolean;
    portable: [
        {
            fileFullName: string;
            checksum: string;
            publicPath: string;
            releaseDate: string;
        },
    ];
    installer: [
        {
            fileFullName: string;
            checksum: string;
            publicPath: string;
            releaseDate: string;
        },
    ];
};

const DOWNLOAD_BASE_URL = `${appProvider.appInfo.homepage}/download`;
function toFullUrl(suffix: string) {
    return `${DOWNLOAD_BASE_URL}/${suffix}`;
}

const attemptTimeout = genTimeoutAttempt(3000);
let attemptCount = 0;
function blockUnload(event: BeforeUnloadEvent) {
    attemptTimeout(() => {
        attemptCount = 0;
    });
    attemptCount++;
    if (attemptCount > 3) {
        window.removeEventListener('beforeunload', blockUnload);
        return;
    }
    event.preventDefault();
    showSimpleToast(
        tran('Downloading in progress'),
        tran("Can't leave the page while downloading.") +
            ' ' +
            tran('Please wait until the download is complete.') +
            ' ' +
            tran('Or attempt 3 times to force leaving.'),
    );
}

function streamDownloadFile(
    filePath: string,
    response: any,
    messageCallback: MessageCallbackType,
) {
    return new Promise<void>((resolve, reject) => {
        writeStreamToFile(
            filePath,
            {
                onStart: (total) => {
                    globalThis.addEventListener('beforeunload', blockUnload);
                    const fileSize = Number.parseInt(total.toFixed(2));
                    messageCallback(
                        `Start downloading (File size: ${fileSize}MB)...`,
                    );
                },
                onProgress: (progress) => {
                    messageCallback(`${(progress * 100).toFixed(2)}% done`);
                },
                onDone: (error) => {
                    globalThis.removeEventListener('beforeunload', blockUnload);
                    if (error) {
                        showSimpleToast('Download Error', `Error: ${error}`);
                        reject(error);
                        return;
                    }
                    showSimpleToast(
                        'Download Completed',
                        `File saved at: ${filePath}`,
                    );
                    resolve();
                },
            },
            response,
        );
    });
}

const PROGRESS_BAR_EVENT_KEY = 'app-update-download';
function messageCallback(message: string | null) {
    showProgressBarMessage(message ?? '');
}

async function downloadUpdate(updateData: UpdateDataType) {
    const srcUrlSuffix = updateData.installer[0].publicPath;
    const srcUrl = `${appProvider.appInfo.homepage}/${srcUrlSuffix}`;
    const fileFullName = updateData.installer[0].fileFullName;
    const downloadDirPath = getDownloadPath();
    const downloadDestFilePath = pathJoin(
        downloadDirPath,
        `${fileFullName}.${crypto.randomUUID()}.owa-downloading`,
    );
    appLog(
        'Downloading update from',
        `"${srcUrl}"`,
        'to',
        `${downloadDestFilePath}`,
    );
    try {
        showProgressBar(PROGRESS_BAR_EVENT_KEY);
        messageCallback('Downloading file...');
        const response = await initHttpRequest(new URL(srcUrl));
        await streamDownloadFile(
            downloadDestFilePath,
            response,
            messageCallback,
        );
        const destFilePath = pathJoin(downloadDirPath, fileFullName);
        const fileSource = FileSource.getInstance(destFilePath);
        const nextDestFilePath = await fileSource.genNextFilePath();
        await fsMove(downloadDestFilePath, nextDestFilePath);
        return nextDestFilePath;
    } catch (error) {
        showSimpleToast(
            tran('Error occurred during download'),
            `${tran('Error')}: ${error}`,
        );
        handleError(error);
        return null;
    } finally {
        hideProgressBar(PROGRESS_BAR_EVENT_KEY);
    }
}

function checkIsVersionOutdated(
    // 2025.06.25 vs 2025.06.26
    currentVersion: string,
    latestVersion: string,
) {
    const currentParts = currentVersion.split('.').map(Number);
    const latestParts = latestVersion.split('.').map(Number);

    for (
        let i = 0;
        i < Math.max(currentParts.length, latestParts.length);
        i++
    ) {
        const currentPart = currentParts[i] || 0;
        const latestPart = latestParts[i] || 0;

        if (currentPart < latestPart) {
            return true;
        } else if (currentPart > latestPart) {
            return false;
        }
    }
    return false; // Versions are equal
}

async function getDownloadTargetUrl() {
    const downloadInfo = await fetch(toFullUrl('info.json'), {
        method: 'GET',
        cache: 'no-cache',
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error(
                    `Failed to fetch update download info: ${response.statusText}`,
                );
            }
            return response.json();
        })
        .catch((error) => {
            logError('Error fetching update download info:', error);
            return null;
        });
    if (downloadInfo === null) {
        return null;
    }
    const { systemUtils } = appProvider;
    const targetInfo =
        Object.entries(downloadInfo).find(([_key, item]: [string, any]) => {
            return (
                (systemUtils.isWindows && item.isWindows) ||
                (systemUtils.isMac &&
                    item.isMac &&
                    ((systemUtils.isArm64 && item.isArm64) ||
                        (!systemUtils.is64System && !item.isArm64))) ||
                (systemUtils.isLinux && item.isLinux)
            );
        }) ?? null;
    if (targetInfo === null) {
        return null;
    }
    return toFullUrl(`${targetInfo[0]}/info.json`);
}

function showDownloadableToast() {
    showSimpleToast(
        tran('Update Available'),
        <>
            {tran('You can go to download page.')}
            <br />
            <button
                className="btn btn-sm"
                onClick={() => {
                    appProvider.messageUtils.sendData('main:app:go-download');
                }}
            >
                {tran('Go to Download Page')}
            </button>
        </>,
    );
}

function showNoUpdateAvailableToast() {
    showSimpleToast(
        tran('No Update Needed'),
        tran('You are using the latest version of the app.'),
    );
}

let isSilentlyChecked = false;

export async function checkForAppUpdate(isSilent = true) {
    if (isSilent && isSilentlyChecked) {
        return;
    }
    isSilentlyChecked = isSilent;
    const url = await getDownloadTargetUrl();
    if (url === null) {
        return;
    }
    const updateData = await fetch(url, {
        method: 'GET',
        cache: 'no-cache',
    })
        .then((response): Promise<UpdateDataType> => {
            if (!response.ok) {
                throw new Error(
                    `Failed to fetch update info: ${response.statusText}`,
                );
            }
            return response.json();
        })
        .catch((error) => {
            logError('Error fetching update info:', error);
            return null;
        });
    if (updateData === null) {
        return;
    }
    try {
        const version = updateData.version;
        appLog(
            `Current version: ${appProvider.appInfo.version}, ` +
                `Latest version: ${version}`,
        );

        if (checkIsVersionOutdated(appProvider.appInfo.version, version)) {
            const isOk = await showAppConfirm(
                tran('Update Available'),
                `${tran('A new version of the app is available')}: "${version}". ` +
                    `${tran('Would you like to download it?')}`,
                {
                    confirmButtonLabel: 'Yes',
                },
            );
            if (!isOk) {
                showDownloadableToast();
                return;
            }
            const downloadedFilePath = await downloadUpdate(updateData);
            if (downloadedFilePath === null) {
                return;
            }
            const isOkToOpen = await showAppConfirm(
                tran('Download Completed'),
                `${tran(
                    'The update has been downloaded. ' +
                        'Do you want to open the file location?',
                )}`,
                {
                    confirmButtonLabel: 'Yes',
                },
            );
            if (!isOkToOpen) {
                return;
            }
            showFileOrDirExplorer(downloadedFilePath);
        } else if (!isSilent) {
            showNoUpdateAvailableToast();
        }
    } catch (error) {
        handleError(error);
    }
}

appProvider.messageUtils.listenForData('main:app:check-update', () => {
    checkForAppUpdate(false);
});
