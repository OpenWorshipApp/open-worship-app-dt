import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { BrowserWindow, session } from 'electron';

/**
 * Pictures of a document's pages, for the help window's assistant to read
 * the words off (2026-11-10, the user: _for document that unable to extract
 * text the mcp should convert to image then send image to llm to extract
 * text_). Two kinds of page come here:
 *
 * - a slide or page `pptx-to-html-conv` / `docx-to-html-conv` already wrote
 *   beside the document (`<name>.pptx-htmls/slide3.html`), with the deck's
 *   own fonts exported into its `fonts/` folder -- which is the point: a
 *   slide set in a legacy font whose text decodes to stray Latin letters is
 *   DRAWN right here, in that font;
 * - a slide document's slide, which the app writes out as HTML itself and
 *   this stages in a temporary folder (never a `data:` URL: Chromium caps a
 *   URL at 2 MB, and a slide's pictures are inline -- `printing.md`).
 *
 * A converted deck is a document from anywhere, so the page is loaded the
 * way a stranger's page is: its own memory-only session, sandboxed, no Node,
 * no preload, NO SCRIPT at all, popups / permissions / downloads refused,
 * and not one request but a `file:` inside its own folder (or a `data:`
 * picture) -- it cannot reach this machine's other files, the network, or
 * the app's own doors. Nothing is kept: the window is destroyed and a staged
 * folder removed before the answer goes back.
 */

export type CaptureDocumentPagesParamsType = {
    // A converter's output folder, and pages inside it.
    dirPath?: string;
    filePaths?: string[];
    // Pages the app wrote itself.
    htmlTexts?: string[];
    // The page's own size, in CSS pixels.
    width: number;
    height: number;
};

export type CaptureDocumentPagesResultType = {
    isSuccessful: boolean;
    message?: string;
    dataUrls: string[];
};

const CAPTURE_PARTITION = 'owa-capture-document';
export const MAX_DOCUMENT_CAPTURE_PAGES = 8;
// The long edge every picture sent to an assistant is cut to.
const LONG_EDGE = 1024;
const MAX_PAGE_EDGE = 4096;
const LOAD_TIMEOUT_MILLISECONDS = 15_000;
// Fonts load after `did-finish-load` and no script may run to wait on
// `document.fonts.ready`, so the picture is taken a moment later.
const SETTLE_MILLISECONDS = 600;
// What `pptx-to-html-conv` and `docx-to-html-conv` name their folders.
const CONVERTED_DIR_PATTERN = /\.(?:pptx|docx)-htmls$/i;

let isSessionLockedDown = false;
let allowedDirPath: string | null = null;

function toComparablePath(value: string) {
    const resolved = path.resolve(value);
    return process.platform === 'win32' || process.platform === 'darwin'
        ? resolved.toLowerCase()
        : resolved;
}

/**
 * Whether `filePath` is inside `dirPath` (after `..` is resolved away) --
 * never the folder itself, never a sibling whose name starts the same.
 */
export function checkIsPathInside(dirPath: string, filePath: string) {
    const relative = path.relative(
        toComparablePath(dirPath),
        toComparablePath(filePath),
    );
    return (
        relative !== '' &&
        !relative.startsWith('..') &&
        !path.isAbsolute(relative)
    );
}

/** A converter's folder, and `.html` pages inside it; else why not. */
export function findCapturePathsProblem(
    dirPath: string | undefined,
    filePaths: string[] | undefined,
) {
    if (typeof dirPath !== 'string' || !CONVERTED_DIR_PATTERN.test(dirPath)) {
        return 'Only a page a PowerPoint or Word file was converted to can be drawn.';
    }
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
        return 'No page was named.';
    }
    for (const filePath of filePaths) {
        if (
            typeof filePath !== 'string' ||
            !/\.html?$/i.test(filePath) ||
            !checkIsPathInside(dirPath, filePath)
        ) {
            return 'A page outside its document folder cannot be drawn.';
        }
    }
    return null;
}

/** The one request a document page may make: its own folder, or a picture. */
export function checkIsDocumentRequestAllowed(
    url: string,
    dirPath: string | null,
) {
    if (url.startsWith('data:') || url.startsWith('blob:')) {
        return true;
    }
    if (dirPath === null || !url.startsWith('file:')) {
        return false;
    }
    try {
        return checkIsPathInside(dirPath, fileURLToPath(url));
    } catch {
        return false;
    }
}

function lockDownSession() {
    const captureSession = session.fromPartition(CAPTURE_PARTITION);
    if (isSessionLockedDown) {
        return captureSession;
    }
    isSessionLockedDown = true;
    captureSession.setPermissionRequestHandler(
        (_contents, _permission, done) => {
            done(false);
        },
    );
    captureSession.setPermissionCheckHandler(() => {
        return false;
    });
    captureSession.on('will-download', (event) => {
        event.preventDefault();
    });
    captureSession.webRequest.onBeforeRequest(
        { urls: ['<all_urls>'] },
        (details, callback) => {
            callback({
                cancel: !checkIsDocumentRequestAllowed(
                    details.url,
                    allowedDirPath,
                ),
            });
        },
    );
    return captureSession;
}

function toPageSize(value: number) {
    return Math.max(
        16,
        Math.min(MAX_PAGE_EDGE, Math.round(Number(value) || 0) || 16),
    );
}

/**
 * The window is made the size of the picture wanted -- the page's long edge
 * cut to `LONG_EDGE` -- and the page ZOOMED to fit it. A window the size of
 * a 1920px slide is shrunk by the OS to fit a smaller or scaled screen
 * (measured: a picture of the slide's top-left corner alone), and the zoom
 * needs no script, which these pages may not run.
 */
export function toCaptureLayout(width: number, height: number) {
    const scale = Math.min(1, LONG_EDGE / Math.max(width, height));
    return {
        scale,
        windowWidth: Math.max(16, Math.round(width * scale)),
        windowHeight: Math.max(16, Math.round(height * scale)),
    };
}

async function loadAndCapture(
    win: BrowserWindow,
    filePath: string,
    layout: ReturnType<typeof toCaptureLayout>,
) {
    await Promise.race([
        win.loadURL(pathToFileURL(filePath).toString()),
        new Promise((_resolve, reject) => {
            setTimeout(() => {
                reject(new Error('The page took too long to draw.'));
            }, LOAD_TIMEOUT_MILLISECONDS);
        }),
    ]);
    win.webContents.setZoomFactor(layout.scale);
    await new Promise((resolve) => {
        setTimeout(resolve, SETTLE_MILLISECONDS);
    });
    const image = await win.webContents.capturePage({
        x: 0,
        y: 0,
        width: layout.windowWidth,
        height: layout.windowHeight,
    });
    if (image.isEmpty()) {
        throw new Error('The page drew nothing.');
    }
    const size = image.getSize();
    const scale = Math.min(1, LONG_EDGE / Math.max(size.width, size.height));
    const resized =
        scale < 1
            ? image.resize({
                  width: Math.round(size.width * scale),
                  height: Math.round(size.height * scale),
                  quality: 'best',
              })
            : image;
    return `data:image/jpeg;base64,${resized.toJPEG(85).toString('base64')}`;
}

// One capture at a time: the wall knows ONE folder, and a second capture
// started meanwhile would refuse the first one's fonts.
let captureChain: Promise<unknown> = Promise.resolve();

export function captureDocumentPages(
    params: CaptureDocumentPagesParamsType,
): Promise<CaptureDocumentPagesResultType> {
    const result = captureChain.then(() => {
        return captureDocumentPagesNow(params);
    });
    captureChain = result.catch(() => undefined);
    return result;
}

async function captureDocumentPagesNow(
    params: CaptureDocumentPagesParamsType,
): Promise<CaptureDocumentPagesResultType> {
    const width = toPageSize(params?.width);
    const height = toPageSize(params?.height);
    let dirPath: string;
    let filePaths: string[];
    let stagedDirPath: string | null = null;
    if (Array.isArray(params?.htmlTexts) && params.htmlTexts.length > 0) {
        const htmlTexts = params.htmlTexts
            .filter((text) => {
                return typeof text === 'string';
            })
            .slice(0, MAX_DOCUMENT_CAPTURE_PAGES);
        const baseDirPath = path.join(
            tmpdir(),
            'open-worship-document-capture',
        );
        await mkdir(baseDirPath, { recursive: true });
        stagedDirPath = await mkdtemp(path.join(baseDirPath, 'pages-'));
        dirPath = stagedDirPath;
        filePaths = [];
        for (const [index, htmlText] of htmlTexts.entries()) {
            const filePath = path.join(dirPath, `page-${index + 1}.html`);
            await writeFile(filePath, htmlText, 'utf8');
            filePaths.push(filePath);
        }
    } else {
        const problem = findCapturePathsProblem(
            params?.dirPath,
            params?.filePaths,
        );
        if (problem !== null) {
            return { isSuccessful: false, message: problem, dataUrls: [] };
        }
        dirPath = params.dirPath as string;
        filePaths = (params.filePaths as string[]).slice(
            0,
            MAX_DOCUMENT_CAPTURE_PAGES,
        );
        try {
            if (!(await stat(dirPath)).isDirectory()) {
                throw new Error('not a folder');
            }
        } catch {
            return {
                isSuccessful: false,
                message: 'The converted pages are not there any more.',
                dataUrls: [],
            };
        }
    }
    lockDownSession();
    allowedDirPath = dirPath;
    const layout = toCaptureLayout(width, height);
    const win = new BrowserWindow({
        show: false,
        width: layout.windowWidth,
        height: layout.windowHeight,
        useContentSize: true,
        webPreferences: {
            partition: CAPTURE_PARTITION,
            sandbox: true,
            nodeIntegration: false,
            contextIsolation: true,
            javascript: false,
            preload: undefined,
            webSecurity: true,
            offscreen: false,
        },
    });
    win.webContents.setWindowOpenHandler(() => {
        return { action: 'deny' as const };
    });
    win.webContents.on('will-navigate', (event) => {
        event.preventDefault();
    });
    const dataUrls: string[] = [];
    try {
        for (const filePath of filePaths) {
            dataUrls.push(await loadAndCapture(win, filePath, layout));
        }
        return { isSuccessful: true, dataUrls };
    } catch (error: any) {
        return {
            isSuccessful: dataUrls.length > 0,
            message: String(error?.message ?? error),
            dataUrls,
        };
    } finally {
        allowedDirPath = null;
        if (!win.isDestroyed()) {
            win.destroy();
        }
        if (stagedDirPath !== null) {
            await rm(stagedDirPath, { recursive: true, force: true }).catch(
                () => undefined,
            );
        }
    }
}
