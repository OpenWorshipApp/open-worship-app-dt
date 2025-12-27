import appProvider from './appProvider';
import { showSimpleToast } from '../toast/toastHelpers';
import { handleError } from '../helper/errorHelpers';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';
import { AnyObjectType, OptionalPromise } from '../helper/typeHelpers';
import { goToPath } from '../router/routeHelpers';
import {
    fsCheckFileExist,
    getDotExtensionFromBase64Data,
    isSupportedMimetype,
    pathJoin,
    pathResolve,
} from './fileHelpers';
import FileSource from '../helper/FileSource';
import { showProgressBarMessage } from '../progress-bar/progressBarHelpers';

export function genReturningEventName(eventName: string) {
    return `${eventName}-return-${Date.now()}`;
}

export function electronSendAsync<T>(
    eventName: string,
    data: AnyObjectType = {},
) {
    return new Promise<T>((resolve, reject) => {
        const replyEventName = genReturningEventName(eventName);
        appProvider.messageUtils.listenOnceForData(
            replyEventName,
            (_event, data: T) => {
                if (data instanceof Error) {
                    return reject(data);
                }
                resolve(data);
            },
        );
        appProvider.messageUtils.sendData(eventName, {
            ...data,
            replyEventName,
        });
    });
}

export function showExplorer(dir: string) {
    appProvider.messageUtils.sendData('main:app:reveal-path', dir);
}

export function previewPdf(src: string) {
    appProvider.messageUtils.sendData('main:app:preview-pdf', src);
}

export function convertToPdf(officeFilePath: string, pdfFilePath: string) {
    return electronSendAsync<void>('main:app:convert-to-pdf', {
        officeFilePath,
        pdfFilePath,
    });
}

export function tarExtract(filePath: string, outputDir: string) {
    return electronSendAsync<void>('main:app:tar-extract', {
        filePath,
        outputDir,
    });
}

export function copyToClipboard(str: string) {
    appProvider.systemUtils.copyToClipboard(str);
    showSimpleToast('Copy', 'Text has been copied to clip');
    return true;
}

export interface ClipboardInf {
    clipboardSerialize(): OptionalPromise<string | null>;
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
    const downloadInfo = await fetch(
        `${appProvider.appInfo.homepage}/download/info.json`,
        {
            method: 'GET',
            cache: 'no-cache',
        },
    )
        .then((response) => {
            if (!response.ok) {
                throw new Error(
                    `Failed to fetch update download info: ${response.statusText}`,
                );
            }
            return response.json();
        })
        .catch((error) => {
            console.error('Error fetching update download info:', error);
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
    return `${appProvider.appInfo.homepage}/download/${targetInfo[0]}/info.json`;
}

export async function checkForUpdateSilently() {
    const url = await getDownloadTargetUrl();
    if (url === null) {
        return;
    }
    const updateData = await fetch(url, {
        method: 'GET',
        cache: 'no-cache',
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error(
                    `Failed to fetch update info: ${response.statusText}`,
                );
            }
            return response.json();
        })
        .catch((error) => {
            console.error('Error fetching update info:', error);
            return null;
        });
    if (updateData === null) {
        return;
    }
    try {
        const version = updateData.version as string;
        console.log(
            `Current version: ${appProvider.appInfo.version}, ` +
                `Latest version: ${version}`,
        );

        if (checkIsVersionOutdated(appProvider.appInfo.version, version)) {
            const isOk = await showAppConfirm(
                'Update Available',
                `A new version of the app is available: "${version}". ` +
                    'Would you like to check for update?',
                {
                    confirmButtonLabel: 'Yes',
                },
            );
            if (isOk) {
                appProvider.messageUtils.sendData('main:app:go-download');
            }
        }
    } catch (error) {
        handleError(error);
    }
}

const DECIDED_BIBLE_READER_HOME_PAGE_SETTING_NAME = 'decided-reader-home-page';
function setDecided() {
    globalThis.localStorage.setItem(
        DECIDED_BIBLE_READER_HOME_PAGE_SETTING_NAME,
        'true',
    );
}
export async function checkDecidedBibleReaderHomePage() {
    if (appProvider.isPageSetting) {
        return;
    }
    if (appProvider.isPageReader) {
        setDecided();
    }
    const decided = globalThis.localStorage.getItem(
        DECIDED_BIBLE_READER_HOME_PAGE_SETTING_NAME,
    );
    if (decided !== null) {
        return;
    }
    const isOk = await showAppConfirm(
        'The application is started first time',
        'This will set the home page to "📖 Bible Reader🔎"?',
        {
            confirmButtonLabel: 'Yes',
        },
    );
    setDecided();
    if (isOk) {
        goToPath(appProvider.readerHomePage);
    }
}

export function pasteTextToInput(inputElement: HTMLInputElement, text: string) {
    inputElement.focus();
    const value = inputElement.value;
    inputElement.setRangeText(text, 0, value.length, 'end');
    inputElement.dispatchEvent(
        new Event('input', {
            bubbles: true,
            composed: true,
        }),
    );
}

const FILE_EXTENSIONS = ['.bg.json', '.preview.bg.json'];
export async function renameAllMaterialFiles(
    oldFileSource: FileSource,
    newBaseFileName: string,
) {
    await Promise.all(
        FILE_EXTENSIONS.map(async (ext) => {
            const currentPath = pathJoin(
                oldFileSource.basePath,
                `${oldFileSource.fullName}${ext}`,
            );
            if (!(await fsCheckFileExist(currentPath))) {
                return;
            }
            const currentFileSource = FileSource.getInstance(currentPath);
            const newFileName = currentFileSource.name.replace(
                oldFileSource.name,
                newBaseFileName,
            );
            await currentFileSource.renameTo(newFileName);
        }),
    );
}
export async function trashAllMaterialFiles(fileSource: FileSource) {
    await Promise.all(
        FILE_EXTENSIONS.map(async (ext) => {
            const currentPath = pathJoin(
                fileSource.basePath,
                `${fileSource.fullName}${ext}`,
            );
            if (!(await fsCheckFileExist(currentPath))) {
                return;
            }
            const currentFileSource = FileSource.getInstance(currentPath);
            await currentFileSource.trash();
        }),
    );
}

export async function getSlidesCount(
    powerPointFilePath: string,
    dotNetRootDir?: string,
) {
    const powerPointHelper =
        await appProvider.powerPointUtils.getPowerPointHelper(dotNetRootDir);
    if (powerPointHelper === null) {
        console.log('PowerPoint helper is not available');
        return null;
    }
    return powerPointHelper.countSlides(powerPointFilePath);
}

async function getPageTitle(url: string) {
    const rawHtml = await fetch(url)
        .then((response) => response.text())
        .catch((error) => {
            console.error('Error fetching page:', error);
            return null;
        });
    if (rawHtml === null) {
        return null;
    }
    const titleMatch = /<title>(.*?)<\/title>/.exec(rawHtml);
    if (titleMatch?.[1]) {
        let title = titleMatch[1].trim();
        title = decodeURIComponent(encodeURIComponent(title));
        return title.length > 0 ? title : null;
    }
    return null;
}

export function downloadImage(targetUrl: string, outputDir: string) {
    return new Promise<{ filePath: string; fileFullName: string }>(
        (resolve, reject) => {
            (async () => {
                try {
                    const response = await fetch(targetUrl);
                    if (!response.ok) {
                        throw new Error('Failed to fetch image');
                    }
                    const blob = await response.blob();
                    const srcData = await FileSource.getSrcDataFromFrom(blob);
                    if (srcData === null) {
                        throw new Error('Failed to extract image data');
                    }
                    const dotExt = getDotExtensionFromBase64Data(srcData);
                    if (dotExt === null) {
                        throw new Error('Failed to get image file extension');
                    }
                    const filePath = pathJoin(
                        outputDir,
                        `${Date.now()}${dotExt}`,
                    );
                    const fileSource = FileSource.getInstance(filePath);
                    if (await fileSource.writeFileBase64Data(srcData)) {
                        resolve({
                            filePath,
                            fileFullName: fileSource.fullName,
                        });
                    } else {
                        throw new Error('Failed to write image file');
                    }
                } catch (error: any) {
                    reject(new Error('Download failed: ' + error));
                }
            })();
        },
    );
}

export function downloadVideoOrAudio(
    targetUrl: string,
    outputDir: string,
    isVideo: boolean,
) {
    return new Promise<{ filePath: string; fileFullName: string }>(
        (resolve, reject) => {
            (async () => {
                const videoOrAudioUrl = targetUrl.trim();
                const title = await getPageTitle(videoOrAudioUrl);
                const resolvedSuccess = (resolvedFilePath: string) => {
                    const fileSource = FileSource.getInstance(resolvedFilePath);
                    resolve({
                        filePath: resolvedFilePath,
                        fileFullName: `${title || temptName}${fileSource.dotExtension}`,
                    });
                };
                const temptName = `temp-${Date.now()}`;
                const outputFormat = pathResolve(
                    `${outputDir}/${temptName}.%(ext)s`,
                );
                const { ytUtils } = appProvider;
                const ytDlpWrap = await ytUtils.getYTHelper();
                let filePath: string | null = null;
                const args = [videoOrAudioUrl, '-o', outputFormat];
                args.push(
                    '--no-playlist',
                    '--ffmpeg-location',
                    `${ytUtils.ffmpegBinPath}`,
                );
                if (!isVideo) {
                    args.push(
                        '-x',
                        '--audio-format',
                        'mp3',
                        '--audio-quality',
                        '0',
                    );
                }
                const ytDlpEventEmitter = ytDlpWrap
                    .exec(args)
                    .on('progress', (progress) =>
                        showProgressBarMessage(
                            progress.percent,
                            progress.totalSize,
                            progress.currentSpeed,
                            progress.eta,
                        ),
                    )
                    .on('ytDlpEvent', (eventType, eventData) => {
                        showProgressBarMessage(eventType, eventData);
                        if (eventType === 'ExtractAudio') {
                            const regex = /Destination: (.+)$/;
                            const match = eventData.match(regex);
                            if (match?.[1]) {
                                filePath = match[1];
                            }
                        } else if (eventType === 'Merger') {
                            const regex = /Merging formats into "(.+?)"/;
                            const match = eventData.match(regex);
                            if (match[1]) {
                                filePath = match[1];
                            }
                        } else if (eventType === 'download') {
                            eventData = eventData.trim();
                            const startString = 'Destination: ';
                            const endString = ' has already been downloaded';
                            if (eventData.startsWith(startString)) {
                                filePath = eventData.split(startString)[1];
                            } else if (eventData.endsWith(endString)) {
                                filePath = eventData.split(endString)[0];
                            }
                        }
                    })
                    .on('error', async (error) => {
                        handleError(error);
                        if (
                            filePath !== null &&
                            (await fsCheckFileExist(filePath))
                        ) {
                            resolvedSuccess(filePath);
                        } else {
                            reject(
                                new Error('Download failed: ' + error.message),
                            );
                        }
                    })
                    .on('close', () => {
                        showProgressBarMessage('all done');
                        if (filePath === null) {
                            reject(new Error('Unable to determine file path'));
                        } else {
                            resolvedSuccess(filePath);
                        }
                    });
                showProgressBarMessage(
                    'Process id:',
                    ytDlpEventEmitter.ytDlpProcess.pid,
                );
            })();
        },
    );
}

function checkClipboardHasImage(clipboardItem: ClipboardItem) {
    return clipboardItem.types.some((type) => {
        return isSupportedMimetype(type, 'image');
    });
}

export async function checkIsImagesInClipboard() {
    const clipboardItems = await navigator.clipboard.read();
    const isPastingImage = clipboardItems.some((clipboardItem) => {
        return checkClipboardHasImage(clipboardItem);
    });
    return isPastingImage;
}

export async function* readImagesFromClipboard() {
    const clipboardItems = await navigator.clipboard.read();
    for (const clipboardItem of clipboardItems) {
        for (const type of clipboardItem.types) {
            if (isSupportedMimetype(type, 'image')) {
                const blob = await clipboardItem.getType(type);
                yield blob;
            }
        }
    }
}

export async function readTextFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        return text;
    } catch (error) {
        handleError(error);
        return null;
    }
}

export function removeOpacityFromHexColor(hexColor: string) {
    if (hexColor.startsWith('#')) {
        return hexColor.substring(0, 7);
    }
    return hexColor;
}
