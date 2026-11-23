import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { BrowserWindow, session, type WebContents } from 'electron';

/**
 * Frames of a CSS animation, for Save as Image / Save as Video on the
 * Animations picker (2026-11-19, the user: _for animation add button to
 * save to image|video. for both background|foreground, for video let user
 * choose dimention and duration_). A shader is drawn in the renderer frame
 * by frame; a CSS animation is markup, and no renderer can read its own
 * markup's pixels, so it is drawn HERE in a hidden window and pictured.
 *
 * The page is the one Copy Code writes (`genCssAnimationHtml` /
 * `genCssCodeAnimationHtml`): the app's own markup and, for a person's own
 * animation, their style sheet as checked by `checkCssCodeProblem` (no
 * address, no escape). It is still loaded as a stranger's page would be:
 * its own memory-only session, sandboxed, no Node, no preload, popups /
 * navigation / permissions / downloads refused, and not one request but the
 * page's own staged file -- never a `data:` URL (`printing.md`). Script
 * stays on only because each frame is SEEKED from here
 * (`document.getAnimations()`: every animation paused at the frame's time,
 * `::before` and `::after` included, a person's speed kept through its
 * `playbackRate`), which is what makes a video frame-exact on a slow
 * computer, where a recording in real time would drop frames.
 *
 * `offscreen: true`: a hidden window larger than the display is shrunk by
 * the OS (`documentCaptureHelpers.ts` measured a picture of a slide's
 * top-left quarter), and a 1920 or 3840 frame must be that size. One capture
 * at a time; it is closed when the renderer says so, when that renderer
 * goes, or after `IDLE_CLOSE_MILLISECONDS` without a frame asked for.
 */

const CAPTURE_PARTITION = 'owa-capture-animation';
export const MIN_ANIMATION_CAPTURE_EDGE = 16;
export const MAX_ANIMATION_CAPTURE_EDGE = 4096;
const LOAD_TIMEOUT_MILLISECONDS = 15_000;
const SEEK_TIMEOUT_MILLISECONDS = 5_000;
const IDLE_CLOSE_MILLISECONDS = 20_000;

export type AnimationCaptureOpenParamsType = {
    htmlText: string;
    width: number;
    height: number;
    /** A picture keeps see-through parts; a video frame is on black. */
    isTransparent?: boolean;
};

export type AnimationCaptureFrameParamsType = {
    captureId: string;
    timeMilliseconds: number;
    kind: 'bitmap' | 'png';
};

export type AnimationCaptureFrameType = {
    width: number;
    height: number;
    /** `bitmap`: raw BGRA, 4 bytes a pixel, rows top down. `png`: a file. */
    data: Uint8Array;
};

type CaptureType = {
    id: string;
    win: BrowserWindow;
    stagedDirPath: string;
    pageUrl: string;
    width: number;
    height: number;
    owner: WebContents | null;
    onOwnerGone: () => void;
    idleTimer: ReturnType<typeof setTimeout> | null;
};

let current: CaptureType | null = null;
let isSessionLockedDown = false;
let allowedPageUrl: string | null = null;

export function toAnimationCaptureEdge(value: unknown) {
    const number = Math.round(Number(value) || 0);
    return Math.max(
        MIN_ANIMATION_CAPTURE_EDGE,
        Math.min(MAX_ANIMATION_CAPTURE_EDGE, number),
    );
}

/** The one request the page may make: itself. */
export function checkIsAnimationRequestAllowed(
    url: string,
    pageUrl: string | null,
) {
    if (pageUrl === null || !url.startsWith('file:')) {
        return false;
    }
    try {
        return (
            path.resolve(fileURLToPath(url)) ===
            path.resolve(fileURLToPath(pageUrl))
        );
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
                cancel: !checkIsAnimationRequestAllowed(
                    details.url,
                    allowedPageUrl,
                ),
            });
        },
    );
    return captureSession;
}

function withTimeout<T>(
    promise: Promise<T>,
    milliseconds: number,
    why: string,
) {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return Promise.race([
        promise,
        new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => {
                reject(new Error(why));
            }, milliseconds);
        }),
    ]).finally(() => {
        if (timer !== null) {
            clearTimeout(timer);
        }
    });
}

/**
 * Pauses every animation at `timeMilliseconds` of the page's own clock and
 * answers once two frames have been drawn with it.
 */
export function genAnimationSeekScript(timeMilliseconds: number) {
    const time = Math.max(0, Number(timeMilliseconds) || 0);
    return `(async () => {
        for (const animation of document.getAnimations()) {
            animation.pause();
            animation.currentTime = ${time} * animation.playbackRate;
        }
        await new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
        });
        return true;
    })()`;
}

function armIdleClose(capture: CaptureType) {
    if (capture.idleTimer !== null) {
        clearTimeout(capture.idleTimer);
    }
    capture.idleTimer = setTimeout(() => {
        void closeAnimationCapture({ captureId: capture.id });
    }, IDLE_CLOSE_MILLISECONDS);
}

export async function closeAnimationCapture({
    captureId,
}: {
    captureId?: string;
}) {
    const capture = current;
    if (capture === null || (captureId && capture.id !== captureId)) {
        return false;
    }
    current = null;
    allowedPageUrl = null;
    if (capture.idleTimer !== null) {
        clearTimeout(capture.idleTimer);
    }
    if (capture.owner !== null && !capture.owner.isDestroyed()) {
        capture.owner.removeListener('destroyed', capture.onOwnerGone);
    }
    if (!capture.win.isDestroyed()) {
        capture.win.destroy();
    }
    await rm(capture.stagedDirPath, { recursive: true, force: true }).catch(
        () => undefined,
    );
    return true;
}

export async function openAnimationCapture(
    params: AnimationCaptureOpenParamsType,
    owner: WebContents | null = null,
) {
    if (typeof params?.htmlText !== 'string' || !params.htmlText) {
        throw new Error('There is no animation to draw.');
    }
    // One at a time: the session's wall knows one page.
    await closeAnimationCapture({});
    const width = toAnimationCaptureEdge(params.width);
    const height = toAnimationCaptureEdge(params.height);
    const baseDirPath = path.join(tmpdir(), 'open-worship-animation-capture');
    await mkdir(baseDirPath, { recursive: true });
    const stagedDirPath = await mkdtemp(path.join(baseDirPath, 'page-'));
    const filePath = path.join(stagedDirPath, 'animation.html');
    await writeFile(filePath, params.htmlText, 'utf8');
    const pageUrl = pathToFileURL(filePath).toString();
    lockDownSession();
    allowedPageUrl = pageUrl;
    const isTransparent = params.isTransparent === true;
    const win = new BrowserWindow({
        show: false,
        width,
        height,
        useContentSize: true,
        frame: false,
        transparent: isTransparent,
        backgroundColor: isTransparent ? '#00000000' : '#000000',
        webPreferences: {
            partition: CAPTURE_PARTITION,
            offscreen: true,
            sandbox: true,
            nodeIntegration: false,
            contextIsolation: true,
            preload: undefined,
            webSecurity: true,
            backgroundThrottling: false,
            spellcheck: false,
        },
    });
    const id = randomUUID();
    const capture: CaptureType = {
        id,
        win,
        stagedDirPath,
        pageUrl,
        width,
        height,
        owner,
        onOwnerGone: () => {
            void closeAnimationCapture({ captureId: id });
        },
        idleTimer: null,
    };
    current = capture;
    win.webContents.setWindowOpenHandler(() => {
        return { action: 'deny' as const };
    });
    win.webContents.on('will-navigate', (event) => {
        event.preventDefault();
    });
    win.webContents.setAudioMuted(true);
    owner?.once('destroyed', capture.onOwnerGone);
    try {
        await withTimeout(
            win.loadURL(pageUrl),
            LOAD_TIMEOUT_MILLISECONDS,
            'The animation took too long to draw.',
        );
        await withTimeout(
            win.webContents.executeJavaScript(
                'document.fonts.ready.then(() => true)',
            ),
            SEEK_TIMEOUT_MILLISECONDS,
            'The animation took too long to draw.',
        );
    } catch (error) {
        await closeAnimationCapture({ captureId: capture.id });
        throw error;
    }
    armIdleClose(capture);
    return { captureId: capture.id, width, height };
}

export async function captureAnimationFrame(
    params: AnimationCaptureFrameParamsType,
): Promise<AnimationCaptureFrameType> {
    const capture = current;
    if (capture === null || capture.id !== params?.captureId) {
        throw new Error('The animation is not being drawn any more.');
    }
    armIdleClose(capture);
    const { win, width, height } = capture;
    await withTimeout(
        win.webContents.executeJavaScript(
            genAnimationSeekScript(params.timeMilliseconds),
        ),
        SEEK_TIMEOUT_MILLISECONDS,
        'The animation took too long to draw a frame.',
    );
    if (win.isDestroyed()) {
        throw new Error('The animation is not being drawn any more.');
    }
    win.webContents.invalidate();
    let image = await win.webContents.capturePage({
        x: 0,
        y: 0,
        width,
        height,
    });
    if (image.isEmpty()) {
        throw new Error('The animation drew nothing.');
    }
    const size = image.getSize();
    if (size.width !== width || size.height !== height) {
        image = image.resize({ width, height, quality: 'best' });
    }
    const buffer = params.kind === 'png' ? image.toPNG() : image.toBitmap();
    return {
        width,
        height,
        data: new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.length),
    };
}

/** For tests: whether a capture is open. */
export function getAnimationCaptureId() {
    return current?.id ?? null;
}
