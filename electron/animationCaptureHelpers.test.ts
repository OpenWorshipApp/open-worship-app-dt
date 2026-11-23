/**
 * The hidden window a CSS animation is drawn in for Save as Image / Save as
 * Video: a box of its own that loads the one staged page and nothing else,
 * sized as asked (offscreen, so the OS does not shrink it), seeked frame by
 * frame, and gone -- window and staged folder -- once closed.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const state = {
        windowOptions: [] as any[],
        windows: [] as any[],
        beforeRequest: null as
            null | ((details: { url: string }, done: (r: any) => void) => void),
    };
    const image = {
        isEmpty: () => false,
        getSize: () => ({ width: 1920, height: 1080 }),
        resize: vi.fn(),
        toPNG: () => Buffer.from([137, 80, 78, 71]),
        toBitmap: () => Buffer.from([1, 2, 3, 4]),
    };
    class BrowserWindow {
        isDestroyedValue = false;
        webContents = {
            setWindowOpenHandler: vi.fn(),
            on: vi.fn(),
            setAudioMuted: vi.fn(),
            executeJavaScript: vi.fn(async () => true),
            invalidate: vi.fn(),
            capturePage: vi.fn(async () => image),
        };
        loadURL = vi.fn(async () => undefined);
        constructor(options: any) {
            state.windowOptions.push(options);
            state.windows.push(this);
        }
        isDestroyed() {
            return this.isDestroyedValue;
        }
        destroy() {
            this.isDestroyedValue = true;
        }
    }
    const captureSession = {
        setPermissionRequestHandler: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
        on: vi.fn(),
        webRequest: {
            onBeforeRequest: vi.fn((_filter: any, handler: any) => {
                state.beforeRequest = handler;
            }),
        },
    };
    return { state, image, BrowserWindow, captureSession };
});

vi.mock('electron', () => {
    return {
        BrowserWindow: mocks.BrowserWindow,
        session: { fromPartition: vi.fn(() => mocks.captureSession) },
    };
});

import {
    captureAnimationFrame,
    checkIsAnimationRequestAllowed,
    closeAnimationCapture,
    genAnimationSeekScript,
    getAnimationCaptureId,
    openAnimationCapture,
    toAnimationCaptureEdge,
} from './animationCaptureHelpers';

function askRequest(url: string) {
    let isCancelled: boolean | null = null;
    mocks.state.beforeRequest?.({ url }, (result: { cancel: boolean }) => {
        isCancelled = result.cancel;
    });
    return isCancelled;
}

beforeEach(() => {
    mocks.state.windowOptions = [];
    mocks.state.windows = [];
    mocks.image.resize.mockReset();
});

afterEach(async () => {
    vi.useRealTimers();
    await closeAnimationCapture({});
});

describe('animationCaptureHelpers', () => {
    it('keeps a size between 16 and 4096 pixels', () => {
        expect(toAnimationCaptureEdge(1920)).toBe(1920);
        expect(toAnimationCaptureEdge(3840.4)).toBe(3840);
        expect(toAnimationCaptureEdge(0)).toBe(16);
        expect(toAnimationCaptureEdge('x')).toBe(16);
        expect(toAnimationCaptureEdge(99999)).toBe(4096);
    });

    it('lets the page load itself and nothing else', () => {
        const pageUrl = pathToFileURL(
            path.resolve('/tmp/capture/page-1/animation.html'),
        ).toString();
        expect(checkIsAnimationRequestAllowed(pageUrl, pageUrl)).toBe(true);
        expect(
            checkIsAnimationRequestAllowed(
                pathToFileURL(path.resolve('/tmp/capture/x.html')).toString(),
                pageUrl,
            ),
        ).toBe(false);
        expect(
            checkIsAnimationRequestAllowed('https://example.com/', pageUrl),
        ).toBe(false);
        expect(
            checkIsAnimationRequestAllowed('data:image/png;base64,AA', pageUrl),
        ).toBe(false);
        expect(checkIsAnimationRequestAllowed(pageUrl, null)).toBe(false);
    });

    it('seeks every animation by its own playback rate', () => {
        const script = genAnimationSeekScript(6000);
        expect(script).toContain('document.getAnimations()');
        expect(script).toContain('animation.pause()');
        expect(script).toContain('6000 * animation.playbackRate');
        expect(genAnimationSeekScript(Number.NaN)).toContain(
            '0 * animation.playbackRate',
        );
    });

    it('draws in a sandboxed offscreen window of the size asked', async () => {
        const opened = await openAnimationCapture({
            htmlText: '<!DOCTYPE html><html><body></body></html>',
            width: 1920,
            height: 1080,
        });
        expect(opened).toMatchObject({ width: 1920, height: 1080 });
        const [options] = mocks.state.windowOptions;
        expect(options).toMatchObject({
            show: false,
            width: 1920,
            height: 1080,
            transparent: false,
            backgroundColor: '#000000',
        });
        expect(options.webPreferences).toMatchObject({
            offscreen: true,
            sandbox: true,
            nodeIntegration: false,
            contextIsolation: true,
            partition: 'owa-capture-animation',
        });
        expect(options.webPreferences.preload).toBeUndefined();
        const [win] = mocks.state.windows;
        const pageUrl = win.loadURL.mock.calls[0][0] as string;
        expect(existsSync(fileURLToPath(pageUrl))).toBe(true);
        expect(askRequest(pageUrl)).toBe(false);
        expect(askRequest('https://example.com/a.css')).toBe(true);
        expect(
            askRequest(pathToFileURL(path.resolve('/etc/passwd')).toString()),
        ).toBe(true);
    });

    it('keeps see-through parts only for a picture', async () => {
        await openAnimationCapture({
            htmlText: '<html></html>',
            width: 640,
            height: 360,
            isTransparent: true,
        });
        expect(mocks.state.windowOptions[0]).toMatchObject({
            transparent: true,
            backgroundColor: '#00000000',
        });
    });

    it('answers a frame as BGRA or PNG, resized to the size asked', async () => {
        const { captureId } = await openAnimationCapture({
            htmlText: '<html></html>',
            width: 1280,
            height: 720,
        });
        const resized = {
            ...mocks.image,
            getSize: () => ({ width: 1280, height: 720 }),
        };
        mocks.image.resize.mockReturnValue(resized);
        const frame = await captureAnimationFrame({
            captureId,
            timeMilliseconds: 6000,
            kind: 'bitmap',
        });
        expect(mocks.image.resize).toHaveBeenCalledWith({
            width: 1280,
            height: 720,
            quality: 'best',
        });
        expect(frame).toMatchObject({ width: 1280, height: 720 });
        expect([...frame.data]).toEqual([1, 2, 3, 4]);
        const [win] = mocks.state.windows;
        expect(win.webContents.executeJavaScript).toHaveBeenLastCalledWith(
            genAnimationSeekScript(6000),
        );
        expect(win.webContents.invalidate).toHaveBeenCalled();
        const png = await captureAnimationFrame({
            captureId,
            timeMilliseconds: 0,
            kind: 'png',
        });
        expect([...png.data]).toEqual([137, 80, 78, 71]);
    });

    it('refuses a frame of a capture that is not open', async () => {
        await expect(
            captureAnimationFrame({
                captureId: 'nope',
                timeMilliseconds: 0,
                kind: 'png',
            }),
        ).rejects.toThrow(/not being drawn/);
    });

    it('closes the window and removes the staged page', async () => {
        const { captureId } = await openAnimationCapture({
            htmlText: '<html></html>',
            width: 640,
            height: 360,
        });
        const [win] = mocks.state.windows;
        const pagePath = fileURLToPath(win.loadURL.mock.calls[0][0]);
        expect(await closeAnimationCapture({ captureId: 'other' })).toBe(false);
        expect(await closeAnimationCapture({ captureId })).toBe(true);
        expect(win.isDestroyed()).toBe(true);
        expect(existsSync(pagePath)).toBe(false);
        expect(getAnimationCaptureId()).toBeNull();
    });

    it('closes one opened before a second, and one left idle', async () => {
        await openAnimationCapture({
            htmlText: '<html></html>',
            width: 640,
            height: 360,
        });
        await openAnimationCapture({
            htmlText: '<html></html>',
            width: 640,
            height: 360,
        });
        const [first, second] = mocks.state.windows;
        expect(first.isDestroyed()).toBe(true);
        expect(second.isDestroyed()).toBe(false);
        vi.useFakeTimers();
        const { captureId } = await openAnimationCapture({
            htmlText: '<html></html>',
            width: 640,
            height: 360,
        });
        expect(getAnimationCaptureId()).toBe(captureId);
        await vi.advanceTimersByTimeAsync(20_000);
        expect(getAnimationCaptureId()).toBeNull();
    });

    it('closes when the window that asked goes away', async () => {
        let onGone: (() => void) | null = null;
        const owner = {
            once: vi.fn((_name: string, listener: () => void) => {
                onGone = listener;
            }),
            removeListener: vi.fn(),
            isDestroyed: () => false,
        };
        await openAnimationCapture(
            { htmlText: '<html></html>', width: 640, height: 360 },
            owner as any,
        );
        expect(owner.once).toHaveBeenCalledWith('destroyed', onGone);
        onGone!();
        await vi.waitFor(() => {
            expect(getAnimationCaptureId()).toBeNull();
        });
    });
});
