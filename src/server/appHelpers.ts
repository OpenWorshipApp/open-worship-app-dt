import { useState } from 'react';

import appProvider from './appProvider';
import { showSimpleToast } from '../toast/toastHelpers';
import { handleError } from '../helper/errorHelpers';
import { tran } from '../lang/langHelpers';
import type { AnyObjectType, OptionalPromise } from '../helper/typeHelpers';
import {
    fsCheckFileExist,
    fsDeleteFile,
    fsListFiles,
    getDotExtensionFromBase64Data,
    getDownloadPath,
    isSupportedMimetype,
    pathJoin,
    pathResolve,
    toPortableFileName,
} from './fileHelpers';
import { decodeHtmlEntities } from '../helper/sanitizeHelpers';
import FileSource, { type SrcData } from '../helper/FileSource';
import { showProgressBarMessage } from '../progress-bar/progressBarHelpers';
import { appError as logError } from '../helper/loggerHelpers';
import { useAppEffect } from '../helper/appHooks';
import type { ExtraBinPathsType } from '../helper/extra-bin/extraBinHelpers';
import { EXTRA_BIN_MISSING_ERROR_MESSAGE } from '../helper/extra-bin/extraBinErrors';

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
        showSimpleToast(tran('Download'), tran('Unsupported image data'));
        return null;
    }
    const filePath = pathJoin(
        getDownloadPath(),
        `owa-image_${Date.now()}${dotExtension}`,
    );
    const fileSource = FileSource.getInstance(filePath);
    if (!fileSource.writeFileBase64DataSync(srcData)) {
        showSimpleToast(tran('Download'), tran('Failed to save image'));
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

/**
 * `title` names WHAT was copied, for a caller that copies more than one thing
 * — the connection graph's Markdown and its Mermaid diagram sit on one menu,
 * and a confirmation reading `Copy` for either leaves the user checking their
 * clipboard to find out which landed. It is the TOAST's title, so it arrives
 * already translated.
 */
export function copyToClipboard(str: string, title?: string) {
    appProvider.systemUtils.copyToClipboard(str);
    showSimpleToast(
        title ?? tran('Copy'),
        tran('Text has been copied to clip'),
    );
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
/**
 * A file's side files go the way the file itself went: `delete` when the
 * person agreed to delete it permanently, because it sat on a drive with no
 * trash, where the side files cannot be trashed either.
 */
export async function trashAllMaterialFiles(
    fileSource: FileSource,
    permanentFallback: 'none' | 'delete' = 'none',
) {
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
            await currentFileSource.trash(permanentFallback);
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
        // As the page reads, not as its HTML is escaped: `&amp;` is `&`.
        const title = decodeHtmlEntities(titleMatch[1]).trim();
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
function toYtDlpRuntimeArgs(extraBinPaths: ExtraBinPathsType) {
    return [
        '--no-playlist',
        '--ffmpeg-location',
        `${extraBinPaths.ffmpegBinDirPath}`,
        // yt-dlp enables deno by default and prefers it over every other
        // runtime, so clear the defaults before pointing it at the QuickJS we
        // ship - otherwise a deno on the user's PATH silently wins.
        '--no-js-runtimes',
        '--js-runtimes',
        `quickjs:${extraBinPaths.qjsBinPath}`,
    ];
}

/**
 * The media helpers are installed on demand rather than bundled, so every
 * yt-dlp caller has to go through this first. Imported lazily: this module is on
 * the launch path and must not statically pull in the storage helpers and the
 * confirm dialog the guard needs.
 */
async function requireExtraBinPathsLazily() {
    const { requireExtraBinPaths } =
        await import('../helper/extra-bin/extraBinHelpers');
    return await requireExtraBinPaths();
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
    const extraBinPaths = await requireExtraBinPathsLazily();
    if (extraBinPaths === null) {
        throw new Error(EXTRA_BIN_MISSING_ERROR_MESSAGE);
    }
    const ytDlpWrap = await appProvider.ytUtils.getYTHelper(
        extraBinPaths.ytDlpBinPath,
    );
    const output = await ytDlpWrap.execPromise([
        targetUrl.trim(),
        '-g',
        '-f',
        'b[ext=mp4]/b',
        ...toYtDlpRuntimeArgs(extraBinPaths),
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
                // Before `getPageTitle`, today's first network call: a user who
                // has not installed the media pack should not wait on a request
                // that cannot lead anywhere.
                const extraBinPaths = await requireExtraBinPathsLazily();
                if (extraBinPaths === null) {
                    reject(new Error(EXTRA_BIN_MISSING_ERROR_MESSAGE));
                    return;
                }
                const videoOrAudioUrl = targetUrl.trim();
                const title = await getPageTitle(videoOrAudioUrl);
                const resolvedSuccess = (resolvedFilePath: string) => {
                    const fileSource = FileSource.getInstance(resolvedFilePath);
                    resolve({
                        filePath: resolvedFilePath,
                        // A title is not a file name: `Way Maker | Live`
                        // fails the final move on Windows and on an exFAT
                        // stick, after the whole download.
                        fileFullName: `${toPortableFileName(title ?? '', temptName)}${fileSource.dotExtension}`,
                    });
                };
                const temptName = `temp-${Date.now()}`;
                const outputFormat = pathResolve(
                    `${outputDir}/${temptName}.%(ext)s`,
                );
                // A failed/aborted yt-dlp run leaves its staging artifacts
                // behind — the merged output, the per-format streams, and
                // `.part` fragments — all sharing the `temp-<ts>` prefix. Sweep
                // them so a broken download does not silently accumulate (see
                // the stale `temp-*.mp4` orphans found in the data dir).
                const cleanupTempArtifacts = async () => {
                    try {
                        const fileNames = await fsListFiles(outputDir);
                        await Promise.all(
                            fileNames
                                .filter((name) => name.startsWith(temptName))
                                .map((name) =>
                                    fsDeleteFile(pathJoin(outputDir, name)),
                                ),
                        );
                    } catch (cleanupError) {
                        handleError(cleanupError);
                    }
                };
                const ytDlpWrap = await appProvider.ytUtils.getYTHelper(
                    extraBinPaths.ytDlpBinPath,
                );
                let filePath: string | null = null;
                const args = [videoOrAudioUrl, '-o', outputFormat];
                args.push(...toYtDlpRuntimeArgs(extraBinPaths));
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
                            await cleanupTempArtifacts();
                            reject(
                                new Error('Download failed: ' + error.message),
                            );
                        }
                    })
                    .on('close', async () => {
                        showProgressBarMessage('all done');
                        if (filePath === null) {
                            await cleanupTempArtifacts();
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

export function checkIsMainWindow() {
    return (
        appProvider.messageUtils.sendDataSync(
            'all:app:check-is-main-window',
        ) === true
    );
}

export function getHelpPageUrl() {
    return `${appProvider.appInfo.homepage}/help`;
}

/**
 * The maintainers' address, read out of the package's `author` field -- the
 * `Name <email> (site)` form npm documents -- so it is declared ONCE, in
 * `package.json`, and everything that says "write to us" (the chatbot's
 * Report button first) agrees on it. `null` when the field carries no
 * address, and the caller says so rather than inventing one.
 */
export function parseContactEmail(author: string) {
    const matched = /<\s*([^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)\s*>/.exec(author);
    return matched?.[1] ?? null;
}

export function getContactEmail() {
    return parseContactEmail(appProvider.appInfo.author ?? '');
}

export type ContactEmailType = {
    email: string;
    // Where it came from: the app's own help page, read live, or the address
    // this build was made with. The page wins because a build goes stale --
    // the package named one address while the site had moved to another.
    source: 'help page' | 'app';
};

const EMAIL_PATTERN =
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;

/**
 * The address a help page names: a `mailto:` link first, then the first
 * address written in its words ("please contact us at …"). The page reader
 * keeps only http(s) links, so in practice it is the words that carry it.
 */
export function readContactEmailFromPage(
    page: { text?: unknown; links?: unknown } | null | undefined,
) {
    if (page === null || page === undefined) {
        return null;
    }
    const links: unknown[] = Array.isArray(page.links) ? page.links : [];
    for (const link of links) {
        const href =
            typeof (link as any)?.href === 'string' ? (link as any).href : '';
        if (href.toLowerCase().startsWith('mailto:')) {
            const email = EMAIL_PATTERN.exec(href.slice('mailto:'.length))?.[0];
            if (email !== undefined) {
                return email;
            }
        }
    }
    const text = typeof page.text === 'string' ? page.text : '';
    return EMAIL_PATTERN.exec(text)?.[0] ?? null;
}

// Short-lived, deliberately: the buttons under a report are pressed within
// minutes of it being written, and each would otherwise load the page again.
const HELP_PAGE_CONTACT_TTL_MILLISECONDS = 10 * 60 * 1000;
let helpPageContact: { email: string | null; readAt: number } | null = null;

async function readHelpPageContactEmail() {
    const now = Date.now();
    if (
        helpPageContact !== null &&
        now - helpPageContact.readAt < HELP_PAGE_CONTACT_TTL_MILLISECONDS
    ) {
        return helpPageContact.email;
    }
    let email: string | null = null;
    try {
        // The same locked-down reader `owa_read_website` uses: the page is
        // RENDERED (the site is a script that paints its own text, so a plain
        // fetch of the HTML finds nothing), and nothing of it but the address
        // is kept here.
        const page = await electronSendAsync<{
            text?: unknown;
            links?: unknown;
        }>('main:app:read-web-page', {
            url: getHelpPageUrl(),
            maxChars: 20000,
        });
        email = readContactEmailFromPage(page);
    } catch (error) {
        logError('Could not read the help page for a contact address:', error);
    }
    // A failed read is remembered for the same window: a machine with no
    // internet must not wait on the page again at every press.
    helpPageContact = { email, readAt: now };
    return email;
}

/**
 * Where a report should go: the address the app's help page names TODAY,
 * and only when that cannot be read, the one this build was made with.
 */
export async function findContactEmail(): Promise<ContactEmailType | null> {
    const fromHelpPage = await readHelpPageContactEmail();
    if (fromHelpPage !== null) {
        return { email: fromHelpPage, source: 'help page' };
    }
    const fromApp = getContactEmail();
    return fromApp === null ? null : { email: fromApp, source: 'app' };
}
