import type { IncomingMessage } from 'node:http';

import appProvider from '../server/appProvider';
import {
    fsCheckDirExist,
    fsCreateDir,
    fsCreateWriteStream,
    fsDeleteDir,
    fsDeleteFile,
    fsListDirectories,
    getTempPath,
    pathJoin,
} from '../server/fileHelpers';
import {
    MAX_LINK_MEDIA_BYTES,
    MAX_LINK_PICTURE_BYTES,
    checkIsAllowedLinkUrl,
    checkIsPublicAddress,
    findLinkMediaKind,
    toLinkFileName,
    type OfficeLinkKindType,
} from './officeLinkMediaHelpers';

/**
 * The download of a picture, a video or a sound from a link the person
 * typed (`officeLinkMediaHelpers.ts`, `EC-777`). Loaded only when a change
 * names one. Every hop -- the link and each redirect -- is held to a public
 * http(s) address; the body is streamed to disk, never held whole, and
 * stopped past its size or its time; the first bytes decide what it is,
 * and anything a deck does not take is let go with its reason. Each file
 * goes into a folder of its own under the computer's temporary folder, and
 * folders older than an hour are taken away at the next download: a deck
 * keeps its own copy of what was put in.
 */

const LINK_FOLDER_NAME = 'open-worship-app-office-links';
const KEEP_MILLISECONDS = 60 * 60 * 1000;
const MAX_REDIRECTS = 5;
const PICTURE_TIMEOUT_MILLISECONDS = 60 * 1000;
const MEDIA_TIMEOUT_MILLISECONDS = 3 * 60 * 1000;
// enough of the start of a file to tell what it is
const HEAD_BYTES = 64;

export type OfficeLinkFileType = { name: string; filePath: string };

type RequestFunctionType = (
    options: { [key: string]: any },
    callback: (response: IncomingMessage) => void,
) => {
    on: (event: string, listener: (...args: any[]) => void) => any;
    end: () => void;
    destroy: (error?: Error) => void;
};

export type OfficeLinkDepsType = {
    request: RequestFunctionType;
    requestHttp: RequestFunctionType;
    getFolderPath: () => string;
    createWriteStream: (filePath: string) => {
        write: (chunk: Uint8Array) => boolean;
        end: (callback?: () => void) => void;
        destroy: () => void;
        once: (event: string, listener: (...args: any[]) => void) => any;
    };
    createDir: (dirPath: string) => Promise<unknown>;
    deleteFile: (filePath: string) => Promise<unknown>;
    clean: (folderPath: string, now: number) => Promise<void>;
    now: () => number;
};

/** Takes away the link folders older than an hour; the newer stay. */
export async function cleanOldOfficeLinkFolders(
    folderPath: string,
    now: number,
) {
    if (!(await fsCheckDirExist(folderPath))) {
        return;
    }
    for (const name of await fsListDirectories(folderPath)) {
        // only a folder this made: its time, a dash, six letters
        const found = /^([0-9a-z]{8,9})-[0-9a-z]{1,6}$/.exec(name);
        const stamp = found === null ? NaN : Number.parseInt(found[1], 36);
        if (Number.isFinite(stamp) && now - stamp > KEEP_MILLISECONDS) {
            await fsDeleteDir(pathJoin(folderPath, name)).catch(() => {
                return undefined;
            });
        }
    }
}

/**
 * Takes away the folders the given downloads were put in -- once the ask
 * that wanted them is over -- and nothing outside the link folder.
 */
export async function deleteOfficeLinkFiles(
    filePaths: readonly string[],
    folderPath = pathJoin(getTempPath(), LINK_FOLDER_NAME),
) {
    const prefix = pathJoin(folderPath, 'x').slice(0, -1);
    for (const filePath of filePaths) {
        if (!filePath.startsWith(prefix)) {
            continue;
        }
        const dirName = filePath.slice(prefix.length).split(/[\\/]/)[0];
        if (!/^[0-9a-z]{8,9}-[0-9a-z]{1,6}$/.test(dirName ?? '')) {
            continue;
        }
        await fsDeleteDir(pathJoin(folderPath, dirName)).catch(() => {
            return undefined;
        });
    }
}

function genDefaultDeps(): OfficeLinkDepsType {
    return {
        request: appProvider.httpUtils.request as any,
        requestHttp: appProvider.httpUtils.requestHttp as any,
        getFolderPath: () => {
            return pathJoin(getTempPath(), LINK_FOLDER_NAME);
        },
        createWriteStream: fsCreateWriteStream as any,
        createDir: fsCreateDir,
        deleteFile: fsDeleteFile,
        clean: cleanOldOfficeLinkFolders,
        now: Date.now,
    };
}

const REDIRECT_STATUS_SET = new Set([301, 302, 303, 307, 308]);

function toSiteWords(url: string) {
    try {
        return new URL(url).hostname;
    } catch (_error) {
        return 'the link';
    }
}

/**
 * The response to a link, every redirect followed only to a public
 * address; a reason when it is refused or fails.
 */
function openLink(
    url: string,
    deps: OfficeLinkDepsType,
    signal: AbortSignal | null | undefined,
    timeoutMilliseconds: number,
    redirectCount = 0,
): Promise<{ response: IncomingMessage; url: string } | { reason: string }> {
    if (!checkIsAllowedLinkUrl(url)) {
        return Promise.resolve({
            reason:
                'The link is not an internet address this can download ' +
                'from (only http or https, never this computer or the ' +
                "church's own network).",
        });
    }
    return new Promise((resolve) => {
        const target = new URL(url);
        const isPlain = target.protocol === 'http:';
        const requestFunction = isPlain ? deps.requestHttp : deps.request;
        let isSettled = false;
        const settle = (
            value:
                { response: IncomingMessage; url: string } | { reason: string },
        ) => {
            if (!isSettled) {
                isSettled = true;
                clearTimeout(timer);
                signal?.removeEventListener('abort', onAbort);
                resolve(value);
            }
        };
        const request = requestFunction(
            {
                hostname: target.hostname,
                port: target.port
                    ? Number.parseInt(target.port)
                    : isPlain
                      ? 80
                      : 443,
                path: target.pathname + target.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'OpenWorshipApp',
                    Accept: 'image/*, video/*, audio/*, */*;q=0.5',
                },
            },
            (response) => {
                // where a public NAME really led: checked before a byte
                const remote = response.socket?.remoteAddress;
                if (
                    typeof remote === 'string' &&
                    !checkIsPublicAddress(remote)
                ) {
                    response.destroy();
                    settle({
                        reason:
                            `${toSiteWords(url)} is on this computer or ` +
                            "the church's own network, which this does " +
                            'not download from.',
                    });
                    return;
                }
                const status = response.statusCode ?? 0;
                if (
                    REDIRECT_STATUS_SET.has(status) &&
                    response.headers.location
                ) {
                    response.resume();
                    if (redirectCount >= MAX_REDIRECTS) {
                        settle({
                            reason: `The link at ${toSiteWords(url)} was sent on too many times.`,
                        });
                        return;
                    }
                    let next: string;
                    try {
                        next = new URL(response.headers.location, url).href;
                    } catch (_error) {
                        settle({
                            reason: `The link at ${toSiteWords(url)} sent it on to no address.`,
                        });
                        return;
                    }
                    // held to the same rule before it is asked
                    if (!checkIsAllowedLinkUrl(next)) {
                        settle({
                            reason:
                                `The link at ${toSiteWords(url)} sent it on ` +
                                'to an address this does not download from.',
                        });
                        return;
                    }
                    openLink(
                        next,
                        deps,
                        signal,
                        timeoutMilliseconds,
                        redirectCount + 1,
                    ).then(settle);
                    return;
                }
                if (status !== 200) {
                    response.resume();
                    settle({
                        reason:
                            `${toSiteWords(url)} answered ${status} ` +
                            '(the link is wrong, or the file is not shared).',
                    });
                    return;
                }
                settle({ response, url });
            },
        );
        const onAbort = () => {
            request.destroy(new Error('stopped'));
            settle({ reason: 'Stopped.' });
        };
        const timer = setTimeout(() => {
            request.destroy(new Error('timeout'));
            settle({ reason: `${toSiteWords(url)} took too long to answer.` });
        }, timeoutMilliseconds);
        signal?.addEventListener('abort', onAbort);
        request.on('error', () => {
            settle({
                reason: `${toSiteWords(url)} could not be reached.`,
            });
        });
        request.end();
    });
}

/**
 * The file a link holds, downloaded into a folder of its own, when it is
 * the kind asked for; a reason the model can say otherwise.
 */
export async function downloadOfficeLinkMedia(
    url: string,
    want: OfficeLinkKindType,
    signal?: AbortSignal | null,
    deps: OfficeLinkDepsType = genDefaultDeps(),
): Promise<OfficeLinkFileType | { reason: string }> {
    const maxBytes =
        want === 'picture' ? MAX_LINK_PICTURE_BYTES : MAX_LINK_MEDIA_BYTES;
    const timeoutMilliseconds =
        want === 'picture'
            ? PICTURE_TIMEOUT_MILLISECONDS
            : MEDIA_TIMEOUT_MILLISECONDS;
    const opened = await openLink(url, deps, signal, timeoutMilliseconds);
    if ('reason' in opened) {
        return opened;
    }
    const { response } = opened;
    const contentType = String(response.headers['content-type'] ?? '')
        .split(';')[0]
        .trim()
        .toLowerCase();
    // a page is said before a byte of it is read
    if (
        /^(?:text\/html|application\/xhtml|application\/json)/.test(contentType)
    ) {
        response.destroy();
        return {
            reason:
                'The link is a web page, not the picture, video or sound ' +
                "itself. Ask them for the file's own link (right-click the " +
                'picture, Copy Image Address), or to save it and drag it in.',
        };
    }
    const declared = Number.parseInt(
        String(response.headers['content-length'] ?? ''),
    );
    if (Number.isFinite(declared) && declared > maxBytes) {
        response.destroy();
        return {
            reason:
                `It is ${Math.ceil(declared / 1048576)} MB; a ${want === 'picture' ? 'picture' : 'video or sound'} ` +
                `from a link may be ${maxBytes / 1048576} MB at most. Ask them ` +
                'to save a smaller one and drag it in.',
        };
    }
    const folderPath = deps.getFolderPath();
    await deps.clean(folderPath, deps.now()).catch(() => {
        return undefined;
    });
    const dirPath = pathJoin(
        folderPath,
        `${deps.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    );
    await deps.createDir(dirPath);
    let linkPath = '';
    try {
        linkPath = new URL(opened.url).pathname;
    } catch (_error) {
        linkPath = '';
    }
    return new Promise((resolve) => {
        let head = new Uint8Array(0);
        let size = 0;
        let filePath: string | null = null;
        let fileName = '';
        let sink: ReturnType<OfficeLinkDepsType['createWriteStream']> | null =
            null;
        let isSettled = false;
        const finish = (value: OfficeLinkFileType | { reason: string }) => {
            if (isSettled) {
                return;
            }
            isSettled = true;
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            if ('reason' in value) {
                response.destroy();
                sink?.destroy();
                if (filePath !== null) {
                    deps.deleteFile(filePath).catch(() => {
                        return undefined;
                    });
                }
            }
            resolve(value);
        };
        const onAbort = () => {
            finish({ reason: 'Stopped.' });
        };
        const timer = setTimeout(() => {
            finish({
                reason: `${toSiteWords(url)} took too long to send it.`,
            });
        }, timeoutMilliseconds);
        signal?.addEventListener('abort', onAbort);
        const startSink = () => {
            const found = findLinkMediaKind(head, linkPath);
            if (found === null) {
                finish({
                    reason:
                        'The link is not a picture, video or sound a ' +
                        'PowerPoint takes (it may be a web page). Ask them ' +
                        "for the file's own link, or to save it and drag it in.",
                });
                return false;
            }
            if ('unsupported' in found) {
                finish({
                    reason:
                        `It is a ${found.unsupported} picture, which a ` +
                        'PowerPoint here does not take: PNG, JPEG, GIF or ' +
                        'BMP. Ask them to save it as one of those and drag ' +
                        'it in.',
                });
                return false;
            }
            if (found.kind !== want) {
                finish({
                    reason:
                        want === 'picture'
                            ? 'The link is a video or a sound: give it as `media`.'
                            : 'The link is a picture: give it as `picture`.',
                });
                return false;
            }
            fileName = toLinkFileName(opened.url, found.kind, found.ext);
            filePath = pathJoin(dirPath, fileName);
            sink = deps.createWriteStream(filePath);
            sink.once('error', () => {
                finish({
                    reason: 'The file could not be saved on this computer.',
                });
            });
            if (head.length > 0) {
                sink.write(head);
            }
            return true;
        };
        response.on('data', (chunk: Uint8Array) => {
            if (isSettled) {
                return;
            }
            size += chunk.length;
            if (size > maxBytes) {
                finish({
                    reason:
                        `It is over ${maxBytes / 1048576} MB, the most a ` +
                        `${want === 'picture' ? 'picture' : 'video or sound'} from a link may be. ` +
                        'Ask them to save a smaller one and drag it in.',
                });
                return;
            }
            if (sink === null) {
                const joined = new Uint8Array(head.length + chunk.length);
                joined.set(head);
                joined.set(chunk, head.length);
                head = joined;
                if (head.length >= HEAD_BYTES) {
                    startSink();
                }
                return;
            }
            sink.write(chunk);
        });
        response.on('error', () => {
            finish({ reason: `${toSiteWords(url)} stopped sending it.` });
        });
        response.on('end', () => {
            if (isSettled) {
                return;
            }
            if (sink === null && !startSink()) {
                return;
            }
            const done = sink;
            const path = filePath;
            if (done === null || path === null) {
                return;
            }
            done.end(() => {
                finish({ name: fileName, filePath: path });
            });
        });
    });
}
