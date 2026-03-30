import appProvider from './appProvider';
import { showSimpleToast } from '../toast/toastHelpers';
import { handleError } from '../helper/errorHelpers';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';
import { appLog, appError as logError } from '../helper/loggerHelpers';
import { tran } from '../lang/langHelpers';
import { fsMove, getDownloadPath, pathJoin } from './fileHelpers';
import { initHttpRequest } from '../helper/bible-helpers/downloadHelpers';
import { showFileOrDirExplorer } from './appHelpers';
import {
    hideProgressBar,
    showProgressBar,
} from '../progress-bar/progressBarHelpers';
import FileSource from '../helper/FileSource';
import {
    messageCallback,
    streamDownloadFile,
} from '../background/downloadHelper';

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

function goToDownloadPage() {
    appProvider.messageUtils.sendData('main:app:go-download');
}

const DOWNLOAD_BASE_URL = `${appProvider.appInfo.homepage}/download`;

const PROGRESS_BAR_EVENT_KEY = 'app-update-download';

// Maybe in the future, url have been changed to full
function addRootURL(rootUrl: string, endUrl: string) {
    if (endUrl.startsWith('http://') || endUrl.startsWith('https://')) {
        return endUrl;
    }
    const url = `${rootUrl}/${endUrl}`;
    return url;
}

async function downloadUpdate(updateData: UpdateDataType) {
    const srcUrlSuffix = updateData.installer[0].publicPath;
    const srcUrl = addRootURL(appProvider.appInfo.homepage, srcUrlSuffix);
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

function checkIsVersionOverdue3Months(version: string) {
    const currentParts = version.split('.').map(Number);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const currentVersionDate = new Date(
        currentParts[0],
        currentParts[1] - 1,
        currentParts[2],
    );
    return currentVersionDate < threeMonthsAgo;
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

function showFail() {
    showSimpleToast(
        tran('No Compatible Update Found'),
        tran('Sorry, we could not find a compatible update for your system.'),
    );
}

type FileInfoType = {
    fileFullName: string;
    checksum: string;
    publicPath: string;
    releaseDate: string;
};
type DownloadInfoItemType = {
    version: string;
    commitID: string;

    is64System?: boolean;
    isArm64?: boolean;

    isLinux?: boolean;
    isUbuntu?: boolean;
    isFedora?: boolean;

    isMac?: boolean;
    isUniversal?: boolean;

    isWindows?: boolean;

    portable: FileInfoType[];
    installer: FileInfoType[];
};
function checkIsItemMatch(item: DownloadInfoItemType) {
    const { systemUtils } = appProvider;
    if (systemUtils.isWindows) {
        if (!item.isWindows) {
            return false;
        }
        if (systemUtils.is64System && !item.is64System) {
            return false;
        }
        if (systemUtils.isArm64 && !item.isArm64) {
            return false;
        }
        return true;
    }
    if (systemUtils.isMac) {
        if (!item.isMac) {
            return false;
        }
        if (systemUtils.isArm64 && !item.isArm64) {
            return false;
        }
        return true;
    }
    if (systemUtils.isLinux) {
        if (!item.isLinux) {
            return false;
        }
        if (systemUtils.isUbuntu && !item.isUbuntu) {
            return false;
        }
        if (systemUtils.isFedora && !item.isFedora) {
            return false;
        }
        return true;
    }
    return false;
}

async function getDownloadTargetUrl() {
    const jsonUrl = `${DOWNLOAD_BASE_URL}/info.json`;
    const downloadInfo = await fetch(jsonUrl, {
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
        showFail();
        return null;
    }
    const targetInfo =
        Object.entries(downloadInfo).find(([_key, item]: [string, any]) => {
            return checkIsItemMatch(item);
        }) ?? null;
    if (targetInfo === null) {
        showFail();
        return null;
    }
    const url = addRootURL(DOWNLOAD_BASE_URL, `${targetInfo[0]}/info.json`);
    return url;
}

function showDownloadableToast() {
    showSimpleToast(
        tran('Update Available'),
        <>
            {tran('You can go to download page.')}
            <br />
            <button className="btn btn-sm" onClick={goToDownloadPage}>
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
    if (appProvider.systemUtils.isDev) {
        return;
    }
    if (isSilent && isSilentlyChecked) {
        return;
    }
    isSilentlyChecked = true;
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
        showFail();
        return;
    }
    try {
        const onlineVersion = updateData.version;
        const version = appProvider.appInfo.version;
        appLog(
            `Current version: ${version}, ` +
                `Latest version: ${onlineVersion}`,
        );
        if (checkIsVersionOverdue3Months(version)) {
            // force to download page if the version is over 3 months old
            goToDownloadPage();
            return;
        }

        const systemCommitHash = appProvider.systemUtils.commitHash;
        console.log('Data commit id:', updateData.commitID);
        console.log('System commit hash:', systemCommitHash);
        let isWrongCommitHas = false;
        if (systemCommitHash !== undefined) {
            isWrongCommitHas = updateData.commitID !== systemCommitHash;
        }

        if (
            !(
                checkIsVersionOutdated(version, onlineVersion) ||
                isWrongCommitHas
            )
        ) {
            if (!isSilent) {
                showNoUpdateAvailableToast();
            }
            return;
        }
        const isOk = await showAppConfirm(
            tran('Update Available'),
            `${tran('A new version of the app is available')}, version:"${onlineVersion}" ` +
                `and commit ID:"${updateData.commitID.substring(0, 7)}". ` +
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
    } catch (error) {
        handleError(error);
    }
}

appProvider.messageUtils.listenForData('main:app:check-update', () => {
    checkForAppUpdate(false);
});
