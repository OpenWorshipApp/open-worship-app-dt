import type { IncomingMessage } from 'node:http';

import { handleError } from '../errorHelpers';
import {
    fsCheckFileExist,
    fsDeleteFile,
    fsCreateWriteStream,
    fsCreateDir,
    fsCheckDirExist,
} from '../../server/fileHelpers';
import type { WriteStream } from 'node:fs';
import appProvider from '../../server/appProvider';
import type { OptionalPromise } from '../typeHelpers';

export const BIBLE_DOWNLOAD_TOAST_TITLE = 'Bible Download';

export type MessageCallbackType = (message: string | null) => void;

// The website is served behind a CDN that returns the SPA index.html fallback
// (HTTP 200, ~557 bytes of HTML) for requests WITHOUT a User-Agent, and only
// serves the real binary when one is present. Without this header the app
// silently "downloads" the HTML page instead of the installer. Computed lazily
// so importing this module never touches appProvider.appInfo at load time.
function getUserAgent() {
    return `${appProvider.appInfo.name}/${appProvider.appInfo.version}`;
}

// CDNs answer the download URL with any of these, not just a bare 302.
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;

export function initHttpRequest(url: URL, redirectCount = 0) {
    return new Promise<IncomingMessage>((resolve, reject) => {
        const request = appProvider.httpUtils.request(
            {
                port: 443,
                path: url.pathname + url.search,
                method: 'GET',
                hostname: url.hostname,
                headers: {
                    'User-Agent': getUserAgent(),
                },
            },
            (response) => {
                const { statusCode, headers } = response;
                if (
                    statusCode !== undefined &&
                    REDIRECT_STATUS_CODES.has(statusCode) &&
                    headers.location
                ) {
                    if (redirectCount >= MAX_REDIRECTS) {
                        reject(new Error('Too many download redirects'));
                        return;
                    }
                    // Location may be relative; resolve against the current URL.
                    const nextUrl = new URL(headers.location, url);
                    initHttpRequest(nextUrl, redirectCount + 1).then(
                        resolve,
                        reject,
                    );
                    return;
                }
                resolve(response);
            },
        );
        request.on('error', (event: Error) => {
            reject(event);
        });
        request.end();
    });
}

export type DownloadOptionsType = {
    onStart: (fileSize: number) => OptionalPromise<void>;
    onProgress: (percentage: number) => OptionalPromise<void>;
    onDone: (error: Error | null, filePath?: string) => OptionalPromise<void>;
};
export async function writeStreamToFile(
    filePath: string,
    options: DownloadOptionsType,
    response: any,
) {
    if (response.statusCode !== 200) {
        return options.onDone(new Error('Error during download'));
    }
    if (await fsCheckFileExist(filePath)) {
        await fsDeleteFile(filePath);
    }
    const dir = appProvider.pathUtils.dirname(filePath);
    if (!(await fsCheckDirExist(dir))) {
        await fsCreateDir(dir);
    }
    let writeStreamGlobal: WriteStream | null = null;
    try {
        const writeStream = (writeStreamGlobal = fsCreateWriteStream(filePath));
        if (!writeStream.writable) {
            throw new Error('Write Stream is not writable');
        }
        const len = Number.parseInt(response.headers['content-length']);
        let cur = 0;
        const mb = 1048576; //1048576 - bytes in  1Megabyte
        const total = len / mb;
        options.onStart(Number.parseInt(total.toFixed(2)));

        // A download must settle (onDone) exactly once. Without this guard the
        // 'end'/'finish' success path could race with an 'error'/'aborted'
        // failure path and fire onDone twice.
        let isSettled = false;
        const fail = (error: Error) => {
            if (isSettled) {
                return;
            }
            isSettled = true;
            response.destroy?.();
            writeStream.destroy();
            fsDeleteFile(filePath).catch((deleteError) => {
                handleError(deleteError);
            });
            options.onDone(error);
        };

        // A dropped connection or disk error must fail the download instead of
        // hanging forever (no 'end' would ever fire) or silently succeeding.
        response.on('error', fail);
        response.on('aborted', () => {
            fail(new Error('Download connection aborted'));
        });
        writeStream.on('error', fail);

        response.on('data', (chunk: Buffer) => {
            const canContinue = writeStream.write(chunk);
            cur += chunk.length;
            options.onProgress(cur / len);
            // Honor backpressure: on a slow disk the source must wait, or the
            // whole file buffers in memory (deadly on low-spec machines).
            if (!canContinue) {
                response.pause();
            }
        });
        writeStream.on('drain', () => {
            response.resume();
        });

        // onDone must only fire once every byte is flushed to disk, so end()
        // the stream on the source's 'end' and wait for 'finish'. Calling
        // onDone earlier let the caller move/rename a still-writing file.
        response.on('end', () => {
            writeStream.end();
        });
        writeStream.on('finish', () => {
            if (isSettled) {
                return;
            }
            // Guard truncated downloads (connection closed cleanly mid-stream):
            // fewer bytes than Content-Length means a broken file.
            if (!Number.isNaN(len) && cur < len) {
                fail(
                    new Error(
                        `Incomplete download: received ${cur} of ${len} bytes`,
                    ),
                );
                return;
            }
            isSettled = true;
            options.onDone(null, filePath);
        });
    } catch (error) {
        if (writeStreamGlobal !== null) {
            writeStreamGlobal.close();
        }
        try {
            await fsDeleteFile(filePath);
        } catch (error) {
            handleError(error);
        }
        options.onDone(error as Error);
    }
}
