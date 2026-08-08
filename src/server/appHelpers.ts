import { useState } from 'react';

import appProvider from './appProvider';
import { showSimpleToast } from '../toast/toastHelpers';
import { handleError } from '../helper/errorHelpers';
import type { AnyObjectType, OptionalPromise } from '../helper/typeHelpers';
import {
    fsCheckFileExist,
    getDotExtensionFromBase64Data,
    getDownloadPath,
    isSupportedMimetype,
    pathJoin,
    pathResolve,
} from './fileHelpers';
import FileSource, { type SrcData } from '../helper/FileSource';
import { showProgressBarMessage } from '../progress-bar/progressBarHelpers';
import { appError as logError } from '../helper/loggerHelpers';
import { useAppEffect } from '../helper/appHooks';

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

// Save an embedded base64 image (e.g. an image canvas item, which inlines its
// data rather than referencing a file) into the Downloads folder and reveal it.
export function downloadImageBase64Data(srcData: SrcData) {
    const dotExtension = getDotExtensionFromBase64Data(srcData);
    if (dotExtension === null) {
        showSimpleToast('Download', 'Unsupported image data');
        return null;
    }
    const filePath = pathJoin(
        getDownloadPath(),
        `owa-image_${Date.now()}${dotExtension}`,
    );
    const fileSource = FileSource.getInstance(filePath);
    if (!fileSource.writeFileBase64DataSync(srcData)) {
        showSimpleToast('Download', 'Failed to save image');
        return null;
    }
    showSimpleToast('Download', `Image saved at: ${filePath}`);
    showFileOrDirExplorer(filePath);
    return filePath;
}

export function convertToPdf(officeFilePath: string, pdfFilePath: string) {
    return electronSendAsync<Error | null>('main:app:convert-to-pdf', {
        officeFilePath,
        pdfFilePath,
    });
}

// `entries` unpacks only those paths — a whole-data archive is read for its
// manifest long before the user has said which folders to restore.
export function tarExtract(
    filePath: string,
    outputDir: string,
    entries?: string[],
) {
    return electronSendAsync<void>('main:app:tar-extract', {
        filePath,
        outputDir,
        entries,
    });
}

// `excludeNamePatterns` are regex sources matched against each path segment;
// a matching folder (the regenerable per-document caches) is left out.
export function tarCreate(
    inputDir: string,
    outputFilePath: string,
    files: string[],
    isGzip = false,
    excludeNamePatterns?: string[],
) {
    return electronSendAsync<void>('main:app:tar-create', {
        inputDir,
        outputFilePath,
        files,
        isGzip,
        excludeNamePatterns,
    });
}

// Append to an existing UNCOMPRESSED tar; see the electron side for why the
// data archive is built this way.
export function tarAppend(
    archiveFilePath: string,
    inputDir: string,
    files: string[],
) {
    return electronSendAsync<void>('main:app:tar-append', {
        archiveFilePath,
        inputDir,
        files,
    });
}

// Password protection for an exported archive. The work is done in the main
// process and both directions stream disk to disk — an archive can be gigabytes
// and must never be carried across the bridge or held in memory.
export function encryptFile(
    filePath: string,
    outputFilePath: string,
    password: string,
) {
    return electronSendAsync<void>('main:app:file-encrypt', {
        filePath,
        outputFilePath,
        password,
    });
}

// A wrong password comes back as a RESULT rather than a rejection: only an
// `Error`'s message survives the IPC clone, and recognising a wrong password by
// matching text anyone might reword is a bug waiting to happen. Genuine I/O
// failures still reject.
export type ArchiveDecryptResultType =
    | { isOk: true }
    | {
          isOk: false;
          reason: 'wrong-password' | 'not-encrypted' | 'unsupported';
      };

export function decryptFile(
    filePath: string,
    outputFilePath: string,
    password: string,
) {
    return electronSendAsync<ArchiveDecryptResultType>(
        'main:app:file-decrypt',
        { filePath, outputFilePath, password },
    );
}

// By the container magic, not by the file name: a bundle mailed around or
// downloaded from a URL arrives under whatever name that service gave it.
export function checkIsEncryptedFile(filePath: string) {
    return electronSendAsync<boolean>('main:app:check-is-encrypted-file', {
        filePath,
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

/**
 * The flags that make yt-dlp use the binaries we ship instead of whatever the
 * user happens to have installed. Shared by every yt-dlp call so a fix to one
 * of them cannot miss the other.
 */
function toYtDlpRuntimeArgs() {
    const { ytUtils } = appProvider;
    return [
        '--no-playlist',
        '--ffmpeg-location',
        `${ytUtils.ffmpegBinPath}`,
        // yt-dlp enables deno by default and prefers it over every other
        // runtime, so clear the defaults before pointing it at the QuickJS we
        // ship - otherwise a deno on the user's PATH silently wins.
        '--no-js-runtimes',
        '--js-runtimes',
        `quickjs:${ytUtils.qjsBinPath}`,
    ];
}

/**
 * The direct media URL behind a page URL, without downloading anything: `-g`
 * makes yt-dlp print the stream it would have fetched. `b` selects a *muxed*
 * format, so the one URL that comes back carries both tracks and a single
 * `<video>` element can play it.
 *
 * What comes back is short-lived and tied to the requesting IP (the URL carries
 * an `expire` stamp), so it is for playing now — never for storing. Google
 * serves it with `access-control-allow-origin` echoing our own origin, so a
 * `crossOrigin="anonymous"` video stays canvas-readable.
 */
export async function resolveMediaStreamUrl(targetUrl: string) {
    const ytDlpWrap = await appProvider.ytUtils.getYTHelper();
    const output = await ytDlpWrap.execPromise([
        targetUrl.trim(),
        '-g',
        '-f',
        'b[ext=mp4]/b',
        ...toYtDlpRuntimeArgs(),
    ]);
    const streamUrl = output
        .split('\n')
        .map((line) => {
            return line.trim();
        })
        .find((line) => {
            return line.startsWith('http');
        });
    if (streamUrl === undefined) {
        throw new Error('yt-dlp returned no playable stream URL');
    }
    return streamUrl;
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
                const ytDlpWrap = await appProvider.ytUtils.getYTHelper();
                let filePath: string | null = null;
                const args = [videoOrAudioUrl, '-o', outputFormat];
                args.push(...toYtDlpRuntimeArgs());
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
                            if (match?.[1]) {
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

export function useIsOnTop() {
    const [isOnTop, setIsOnTop] = useState(false);
    const setIsOnTop1 = async (
        newIsOnTop: boolean | ((prev: boolean) => boolean),
    ) => {
        appProvider.messageUtils.sendData('all:app:set-is-window-on-top', {
            isOnTop:
                typeof newIsOnTop === 'function'
                    ? newIsOnTop(isOnTop)
                    : newIsOnTop,
        });
        setIsOnTop(newIsOnTop);
    };
    useAppEffect(() => {
        const isOnTop = appProvider.messageUtils.sendDataSync(
            'all:app:check-is-window-on-top',
        );
        setIsOnTop(isOnTop === true);
    }, []);
    return [isOnTop, setIsOnTop1] as const;
}
