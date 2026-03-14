import appProvider from './appProvider';
import { showSimpleToast } from '../toast/toastHelpers';
import { handleError } from '../helper/errorHelpers';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';
import type { AnyObjectType, OptionalPromise } from '../helper/typeHelpers';
import { goToPath } from '../router/routeHelpers';
import {
    fsCheckFileExist,
    getDotExtensionFromBase64Data,
    getDownloadPath,
    isSupportedMimetype,
    pathJoin,
    pathResolve,
} from './fileHelpers';
import FileSource from '../helper/FileSource';
import { showProgressBarMessage } from '../progress-bar/progressBarHelpers';
import { appError as logError } from '../helper/loggerHelpers';
import { tran } from '../lang/langHelpers';

export function genReturningEventName(eventName: string) {
    return `${eventName}-return-${crypto.randomUUID()}`;
}

export function electronSendAsync<T>(
    eventName: string,
    data: AnyObjectType = {},
) {
    return new Promise<T>((resolve, reject) => {
        const replyEventName = genReturningEventName(eventName);
        appProvider.messageUtils.listenOnceForData(
            replyEventName,
            (_event, imageData: T) => {
                if (imageData instanceof Error) {
                    return reject(imageData);
                }
                resolve(imageData);
            },
        );
        appProvider.messageUtils.sendData(eventName, {
            ...data,
            replyEventName,
        });
    });
}

export function showFileOrDirExplorer(dir: string) {
    appProvider.messageUtils.sendData('main:app:reveal-path', dir);
}

export function convertToPdf(officeFilePath: string, pdfFilePath: string) {
    return electronSendAsync<Error | null>('main:app:convert-to-pdf', {
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
        tran('The application is started first time'),
        tran('This will set the home page to "📖 Bible Reader🔎"?'),
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
                oldFileSource.baseDirPath,
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
                fileSource.baseDirPath,
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

export async function getSlidesCount(filePath: string) {
    const count = await electronSendAsync<number | null>(
        'main:app:ms-pp-slides-count',
        { filePath },
    );
    return count;
}
export async function removeSlideBackground(filePath: string) {
    // TODO: this function should not work yet, need to be fixed in the future
    const isSuccess = await electronSendAsync<boolean>(
        'main:app:ms-pp-remove-slides-bg',
        { filePath },
    );
    return isSuccess;
}

export async function exportBibleMSWord(
    data: { title: string; body: string; fontFamily: string | null }[],
) {
    const downloadDirPath = getDownloadPath();
    const date = new Date();
    let dateStr = date.toISOString().split('.')[0];
    dateStr = dateStr.replace('T', '_');
    dateStr = dateStr.replaceAll(':', '-');
    const filePath = pathJoin(
        downloadDirPath,
        `owa-bible-verses_${dateStr}.docx`,
    );
    await electronSendAsync('main:app:ms-word-export-bible', {
        filePath,
        data,
    });
    return filePath;
}

async function getPageTitle(url: string) {
    const rawHtml = await fetch(url)
        .then((response) => response.text())
        .catch((error) => {
            logError('Error fetching page:', error);
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
                    if (fileSource.writeFileBase64DataSync(srcData)) {
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
                    '--js-runtimes',
                    `deno:${ytUtils.denoBinPath}`,
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
    try {
        const clipboardItems = await navigator.clipboard.read();
        const isPastingImage = clipboardItems.some((clipboardItem) => {
            return checkClipboardHasImage(clipboardItem);
        });
        return isPastingImage;
    } catch (_error) {
        return false;
    }
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

export function printHtmlText() {
    appProvider.messageUtils.sendData('all:app:print');
}
(globalThis as any).printHtmlText = printHtmlText;
console.log('printHtmlText');

export function timeToTimeString(time: number) {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    return `${hours}:${minutes}:${seconds}`;
}
