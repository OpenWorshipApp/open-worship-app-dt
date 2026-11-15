/**
 * A document page drawn into a picture, end to end: the pages staged or
 * found on disk, the locked-down session, the hidden window and what it may
 * load, the picture cut to size, and everything taken away again -- with a
 * fake window, a real temporary folder and the clock under the test's hand.
 */
import { readFileSync } from 'node:fs';
import {
    mkdir,
    mkdtemp,
    realpath,
    rm,
    stat,
    writeFile,
} from 'node:fs/promises';
import type * as NodeFsPromises from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as DocumentCaptureHelpers from './documentCaptureHelpers';

type ImageSpecType = {
    isEmpty?: boolean;
    width: number;
    height: number;
};

const state = vi.hoisted(() => {
    const created = {
        windows: [] as any[],
        fromPartitionNames: [] as string[],
        permissionRequestHandlers: [] as any[],
        permissionCheckHandlers: [] as any[],
        sessionEvents: [] as { name: string; handler: any }[],
        beforeRequests: [] as { filter: any; handler: any }[],
    };
    const behaviour = {
        // What each `loadURL` does, by call: a value resolves, `'hang'`
        // never settles, an Error rejects.
        loadResults: [] as unknown[],
        // The picture each capture answers, by call; the last one repeats.
        images: [] as ImageSpecType[],
        onLoad: null as null | ((url: string) => Promise<void> | void),
        isConstructorBroken: false,
        rmError: null as null | Error,
    };
    function genImage(spec: ImageSpecType, label: string) {
        const image = {
            spec,
            resizeCalls: [] as any[],
            jpegQualities: [] as number[],
            isEmpty: () => spec.isEmpty === true,
            getSize: () => ({ width: spec.width, height: spec.height }),
            resize(options: any) {
                image.resizeCalls.push(options);
                return genImage(
                    { width: options.width, height: options.height },
                    `${label}>${options.width}x${options.height}`,
                );
            },
            toJPEG(quality: number) {
                image.jpegQualities.push(quality);
                return Buffer.from(`jpeg:${label}`, 'utf8');
            },
        };
        return image;
    }
    class FakeBrowserWindow {
        options: any;
        loadedUrls: string[] = [];
        destroyCount = 0;
        isGone = false;
        windowOpenHandler: any = null;
        contentsEvents: { name: string; handler: any }[] = [];
        zoomFactors: number[] = [];
        captureRects: any[] = [];
        capturedImages: any[] = [];
        // The order things happened in, to hold the zoom before the picture.
        steps: string[] = [];
        webContents: any;
        constructor(options: any) {
            if (behaviour.isConstructorBroken) {
                throw new Error('The window could not be made.');
            }
            this.options = options;
            created.windows.push(this);
            this.webContents = {
                setWindowOpenHandler: (handler: any) => {
                    this.windowOpenHandler = handler;
                },
                on: (name: string, handler: any) => {
                    this.contentsEvents.push({ name, handler });
                },
                setZoomFactor: (factor: number) => {
                    this.steps.push('zoom');
                    this.zoomFactors.push(factor);
                },
                capturePage: async (rect: any) => {
                    this.steps.push('capture');
                    this.captureRects.push(rect);
                    const index = this.capturedImages.length;
                    const spec =
                        behaviour.images[
                            Math.min(index, behaviour.images.length - 1)
                        ];
                    const image = genImage(spec, `page${index + 1}`);
                    this.capturedImages.push(image);
                    return image;
                },
            };
        }
        async loadURL(url: string) {
            this.steps.push('load');
            const index = this.loadedUrls.length;
            this.loadedUrls.push(url);
            await behaviour.onLoad?.(url);
            const result = behaviour.loadResults[index];
            if (result === 'hang') {
                return new Promise(() => {});
            }
            if (result instanceof Error) {
                throw result;
            }
            return undefined;
        }
        isDestroyed() {
            return this.isGone;
        }
        destroy() {
            this.destroyCount += 1;
            this.isGone = true;
        }
    }
    const captureSession = {
        setPermissionRequestHandler(handler: any) {
            created.permissionRequestHandlers.push(handler);
        },
        setPermissionCheckHandler(handler: any) {
            created.permissionCheckHandlers.push(handler);
        },
        on(name: string, handler: any) {
            created.sessionEvents.push({ name, handler });
        },
        webRequest: {
            onBeforeRequest(filter: any, handler: any) {
                created.beforeRequests.push({ filter, handler });
            },
        },
    };
    return {
        created,
        behaviour,
        FakeBrowserWindow,
        captureSession,
        reset() {
            created.windows.length = 0;
            created.fromPartitionNames.length = 0;
            created.permissionRequestHandlers.length = 0;
            created.permissionCheckHandlers.length = 0;
            created.sessionEvents.length = 0;
            created.beforeRequests.length = 0;
            behaviour.loadResults = [];
            behaviour.images = [{ width: 640, height: 360 }];
            behaviour.onLoad = null;
            behaviour.isConstructorBroken = false;
            behaviour.rmError = null;
        },
    };
});

vi.mock('electron', () => {
    return {
        BrowserWindow: state.FakeBrowserWindow,
        session: {
            fromPartition: (name: string) => {
                state.created.fromPartitionNames.push(name);
                return state.captureSession;
            },
        },
    };
});

// `rm` is the real one unless a test makes the clean-up fail.
vi.mock('node:fs/promises', async (importOriginal) => {
    const actual = await importOriginal<typeof NodeFsPromises>();
    const rmWrapper = (...args: Parameters<typeof actual.rm>) => {
        if (state.behaviour.rmError !== null) {
            return Promise.reject(state.behaviour.rmError);
        }
        return actual.rm(...args);
    };
    return { ...actual, default: { ...actual, rm: rmWrapper }, rm: rmWrapper };
});

// Bound before any fake clock: the real event loop turns between looks, so
// the real disk work in between can finish.
const realSetImmediate = setImmediate;
const STAGE_BASE_DIR_PATH = path.join(
    tmpdir(),
    'open-worship-document-capture',
);

type ModuleType = typeof DocumentCaptureHelpers;
let helpers: ModuleType;
let tempDirPath = '';

/** Lets the fake clock run until `promise` settles (a 5 s real deadline). */
async function runClockUntilSettled<T>(promise: Promise<T>): Promise<T> {
    let isSettled = false;
    promise.then(
        () => {
            isSettled = true;
        },
        () => {
            isSettled = true;
        },
    );
    const deadline = performance.now() + 5000;
    while (!isSettled && performance.now() < deadline) {
        await vi.advanceTimersByTimeAsync(700);
        await new Promise((resolve) => {
            realSetImmediate(resolve);
        });
    }
    return promise;
}

async function waitFor(check: () => boolean, what: string) {
    const deadline = performance.now() + 5000;
    while (!check()) {
        if (performance.now() > deadline) {
            throw new Error(`Timed out waiting for ${what}`);
        }
        await vi.advanceTimersByTimeAsync(0);
        await new Promise((resolve) => {
            realSetImmediate(resolve);
        });
    }
}

async function genDeckDir(name = 'Song.pptx-htmls', pageCount = 2) {
    const dirPath = path.join(tempDirPath, name);
    await mkdir(path.join(dirPath, 'fonts'), { recursive: true });
    const filePaths: string[] = [];
    for (let index = 1; index <= pageCount; index++) {
        const filePath = path.join(dirPath, `slide${index}.html`);
        await writeFile(filePath, `<p>slide ${index}</p>`, 'utf8');
        filePaths.push(filePath);
    }
    return { dirPath, filePaths };
}

function jpegDataUrl(label: string) {
    return `data:image/jpeg;base64,${Buffer.from(`jpeg:${label}`, 'utf8').toString('base64')}`;
}

function askRequest(url: string) {
    const [{ handler }] = state.created.beforeRequests;
    let answer: any = null;
    handler({ url }, (value: any) => {
        answer = value;
    });
    return answer;
}

beforeEach(async () => {
    state.reset();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    tempDirPath = await realpath(
        await mkdtemp(path.join(tmpdir(), 'owa-capture-ut102-')),
    );
    // A fresh module per test: the session is locked down once per process
    // and the captures are chained, both module state.
    vi.resetModules();
    helpers = await import('./documentCaptureHelpers');
});

afterEach(async () => {
    vi.clearAllTimers();
    vi.useRealTimers();
    state.behaviour.rmError = null;
    await rm(tempDirPath, { recursive: true, force: true });
});

describe('checkIsDocumentRequestAllowed', () => {
    it('refuses a file address that names no path it can read', () => {
        // An encoded slash cannot be turned into a path on any system.
        expect(
            helpers.checkIsDocumentRequestAllowed(
                'file:///docs/Song.pptx-htmls/a%2Fb.ttf',
                path.resolve('/docs/Song.pptx-htmls'),
            ),
        ).toBe(false);
        expect(
            helpers.checkIsDocumentRequestAllowed(
                'blob:https://localhost/1',
                null,
            ),
        ).toBe(true);
    });
});

describe('pages the app wrote itself', () => {
    it('stages each page in a temporary folder, draws it and takes the folder away', async () => {
        const seen: { filePath: string; text: string }[] = [];
        // Read SYNCHRONOUSLY: `loadURL` races the 15 s timer on the fake
        // clock, and `runClockUntilSettled` moves that clock 700 ms a turn
        // whether or not real work is pending -- an async read slowed past
        // ~21 turns (a loaded machine, a virus scan of the file just written)
        // lost the race and failed with "The page took too long to draw."
        state.behaviour.onLoad = (url) => {
            const localPath = fileURLToPath(url);
            seen.push({
                filePath: localPath,
                text: readFileSync(localPath, 'utf8'),
            });
        };
        const result = await runClockUntilSettled(
            helpers.captureDocumentPages({
                htmlTexts: ['<p>one</p>', 42 as any, '<p>two</p>'],
                width: 640,
                height: 360,
            }),
        );

        expect(result).toEqual({
            isSuccessful: true,
            dataUrls: [jpegDataUrl('page1'), jpegDataUrl('page2')],
        });
        // The one that was not text was left out, the rest numbered in order.
        expect(seen.map((item) => item.text)).toEqual([
            '<p>one</p>',
            '<p>two</p>',
        ]);
        expect(seen.map((item) => path.basename(item.filePath))).toEqual([
            'page-1.html',
            'page-2.html',
        ]);
        const stagedDirPath = path.dirname(seen[0].filePath);
        expect(path.basename(stagedDirPath)).toMatch(/^pages-/);
        expect(path.dirname(stagedDirPath).toLowerCase()).toBe(
            STAGE_BASE_DIR_PATH.toLowerCase(),
        );
        // Nothing is kept.
        await expect(stat(stagedDirPath)).rejects.toThrow();
        const [win] = state.created.windows;
        expect(win.loadedUrls).toEqual(
            seen.map((item) => pathToFileURL(item.filePath).toString()),
        );
        expect(win.destroyCount).toBe(1);
        // Already the picture's size: drawn as it is, at the quality asked.
        expect(win.capturedImages[0].resizeCalls).toEqual([]);
        expect(win.capturedImages[0].jpegQualities).toEqual([85]);
    });

    it('draws at most eight pages', async () => {
        const htmlTexts = Array.from({ length: 11 }, (_, index) => {
            return `<p>${index}</p>`;
        });
        const result = await runClockUntilSettled(
            helpers.captureDocumentPages({
                htmlTexts,
                width: 640,
                height: 360,
            }),
        );
        expect(helpers.MAX_DOCUMENT_CAPTURE_PAGES).toBe(8);
        expect(result.dataUrls).toHaveLength(8);
        expect(state.created.windows[0].loadedUrls).toHaveLength(8);
        expect(
            path.basename(
                fileURLToPath(state.created.windows[0].loadedUrls[7]),
            ),
        ).toBe('page-8.html');
    });

    it('opens the window locked down, the size of the picture, and the page zoomed to fit', async () => {
        state.behaviour.images = [{ width: 1024, height: 576 }];
        await runClockUntilSettled(
            helpers.captureDocumentPages({
                htmlTexts: ['<p>wide</p>'],
                width: 1920,
                height: 1080,
            }),
        );
        const [win] = state.created.windows;
        expect(win.options).toEqual({
            show: false,
            width: 1024,
            height: 576,
            useContentSize: true,
            webPreferences: {
                partition: 'owa-capture-document',
                sandbox: true,
                nodeIntegration: false,
                contextIsolation: true,
                javascript: false,
                preload: undefined,
                webSecurity: true,
                offscreen: false,
            },
        });
        expect(win.zoomFactors).toEqual([1024 / 1920]);
        expect(win.captureRects).toEqual([
            { x: 0, y: 0, width: 1024, height: 576 },
        ]);
        expect(win.steps).toEqual(['load', 'zoom', 'capture']);
        // No popup, no navigation away.
        expect(win.windowOpenHandler()).toEqual({ action: 'deny' });
        const navigate = win.contentsEvents.find((item: any) => {
            return item.name === 'will-navigate';
        });
        const event = { preventDefault: vi.fn() };
        navigate.handler(event);
        expect(event.preventDefault).toHaveBeenCalledTimes(1);
    });

    it('takes the picture only once the fonts had a moment to load', async () => {
        const promise = helpers.captureDocumentPages({
            htmlTexts: ['<p>late font</p>'],
            width: 640,
            height: 360,
        });
        await waitFor(() => {
            return state.created.windows[0]?.zoomFactors.length === 1;
        }, 'the page to load');
        const [win] = state.created.windows;
        await vi.advanceTimersByTimeAsync(599);
        expect(win.captureRects).toHaveLength(0);
        await vi.advanceTimersByTimeAsync(1);
        expect(win.captureRects).toHaveLength(1);
        await expect(runClockUntilSettled(promise)).resolves.toMatchObject({
            isSuccessful: true,
        });
    });

    it('keeps a page size between 16 and 4096 pixels', async () => {
        state.behaviour.images = [{ width: 16, height: 1024 }];
        await runClockUntilSettled(
            helpers.captureDocumentPages({
                htmlTexts: ['<p>odd</p>'],
                width: 'wide' as any,
                height: 99999,
            }),
        );
        const [win] = state.created.windows;
        // 16 x 4096, its long edge cut to 1024: a quarter, and never under 16.
        expect(win.options.width).toBe(16);
        expect(win.options.height).toBe(1024);
        expect(win.zoomFactors).toEqual([0.25]);

        state.created.windows.length = 0;
        await runClockUntilSettled(
            helpers.captureDocumentPages({
                htmlTexts: ['<p>tiny</p>'],
                width: 3,
                height: -50,
            }),
        );
        expect(state.created.windows[0].options).toMatchObject({
            width: 16,
            height: 16,
        });
        expect(state.created.windows[0].zoomFactors).toEqual([1]);
    });

    it('cuts a picture bigger than 1024 pixels down to it', async () => {
        // A display scaled up: the window's picture comes back twice as big.
        state.behaviour.images = [{ width: 2048, height: 1152 }];
        const result = await runClockUntilSettled(
            helpers.captureDocumentPages({
                htmlTexts: ['<p>retina</p>'],
                width: 1920,
                height: 1080,
            }),
        );
        const [image] = state.created.windows[0].capturedImages;
        expect(image.resizeCalls).toEqual([
            { width: 1024, height: 576, quality: 'best' },
        ]);
        // The cut picture is the one sent, not the big one.
        expect(image.jpegQualities).toEqual([]);
        expect(result.dataUrls).toEqual([jpegDataUrl('page1>1024x576')]);
    });

    it('says a page that drew nothing, and keeps the pages drawn before it', async () => {
        state.behaviour.images = [
            { width: 640, height: 360 },
            { width: 0, height: 0, isEmpty: true },
        ];
        const result = await runClockUntilSettled(
            helpers.captureDocumentPages({
                htmlTexts: ['<p>one</p>', '<p>blank</p>', '<p>three</p>'],
                width: 640,
                height: 360,
            }),
        );
        expect(result).toEqual({
            isSuccessful: true,
            message: 'The page drew nothing.',
            dataUrls: [jpegDataUrl('page1')],
        });
        // It stopped there.
        expect(state.created.windows[0].loadedUrls).toHaveLength(2);
        expect(state.created.windows[0].destroyCount).toBe(1);
    });

    it('fails when the first page drew nothing', async () => {
        state.behaviour.images = [{ width: 0, height: 0, isEmpty: true }];
        const result = await runClockUntilSettled(
            helpers.captureDocumentPages({
                htmlTexts: ['<p>blank</p>'],
                width: 640,
                height: 360,
            }),
        );
        expect(result).toEqual({
            isSuccessful: false,
            message: 'The page drew nothing.',
            dataUrls: [],
        });
    });

    it('gives up on a page that does not load in 15 seconds', async () => {
        state.behaviour.loadResults = ['hang'];
        const promise = helpers.captureDocumentPages({
            htmlTexts: ['<p>slow</p>'],
            width: 640,
            height: 360,
        });
        await waitFor(() => {
            return state.created.windows[0]?.loadedUrls.length === 1;
        }, 'the page to start loading');
        const [win] = state.created.windows;
        await vi.advanceTimersByTimeAsync(14_999);
        expect(win.destroyCount).toBe(0);
        await vi.advanceTimersByTimeAsync(1);
        await expect(runClockUntilSettled(promise)).resolves.toEqual({
            isSuccessful: false,
            message: 'The page took too long to draw.',
            dataUrls: [],
        });
        expect(win.destroyCount).toBe(1);
        expect(win.captureRects).toEqual([]);
    });

    it("says a load that failed in the loader's own words", async () => {
        state.behaviour.loadResults = [new Error('ERR_FILE_NOT_FOUND (-6)')];
        const result = await runClockUntilSettled(
            helpers.captureDocumentPages({
                htmlTexts: ['<p>gone</p>'],
                width: 640,
                height: 360,
            }),
        );
        expect(result).toEqual({
            isSuccessful: false,
            message: 'ERR_FILE_NOT_FOUND (-6)',
            dataUrls: [],
        });
    });

    it('does not destroy a window that is already gone', async () => {
        state.behaviour.onLoad = () => {
            state.created.windows[0].isGone = true;
        };
        const result = await runClockUntilSettled(
            helpers.captureDocumentPages({
                htmlTexts: ['<p>closed</p>'],
                width: 640,
                height: 360,
            }),
        );
        expect(result.isSuccessful).toBe(true);
        expect(state.created.windows[0].destroyCount).toBe(0);
    });

    it('answers even when the staged folder cannot be removed', async () => {
        let stagedDirPath = '';
        state.behaviour.onLoad = (url) => {
            stagedDirPath = path.dirname(fileURLToPath(url));
            state.behaviour.rmError = new Error('EBUSY: resource busy');
        };
        const result = await runClockUntilSettled(
            helpers.captureDocumentPages({
                htmlTexts: ['<p>held</p>'],
                width: 640,
                height: 360,
            }),
        );
        expect(result).toEqual({
            isSuccessful: true,
            dataUrls: [jpegDataUrl('page1')],
        });
        state.behaviour.rmError = null;
        // Left behind, so this test takes it away itself.
        expect((await stat(stagedDirPath)).isDirectory()).toBe(true);
        await rm(stagedDirPath, { recursive: true, force: true });
    });
});

describe("a converter's pages", () => {
    it('draws the pages named inside the folder, at most eight', async () => {
        const { dirPath, filePaths } = await genDeckDir('Song.pptx-htmls', 9);
        const result = await runClockUntilSettled(
            helpers.captureDocumentPages({
                dirPath,
                filePaths,
                width: 960,
                height: 540,
            }),
        );
        expect(result.isSuccessful).toBe(true);
        expect(result.dataUrls).toHaveLength(8);
        const [win] = state.created.windows;
        expect(win.loadedUrls).toEqual(
            filePaths.slice(0, 8).map((filePath) => {
                return pathToFileURL(filePath).toString();
            }),
        );
        // The converter's own folder stays where it is.
        expect((await stat(dirPath)).isDirectory()).toBe(true);
    });

    it('refuses a folder no converter wrote, before any window opens', async () => {
        const dirPath = path.join(tempDirPath, 'Documents');
        await mkdir(dirPath);
        const result = await helpers.captureDocumentPages({
            dirPath,
            filePaths: [path.join(dirPath, 'a.html')],
            width: 640,
            height: 360,
        });
        expect(result).toEqual({
            isSuccessful: false,
            message:
                'Only a page a PowerPoint or Word file was converted to can be drawn.',
            dataUrls: [],
        });
        expect(state.created.windows).toEqual([]);
        expect(state.created.fromPartitionNames).toEqual([]);
    });

    it('says the pages are gone when the folder is not there or is not a folder', async () => {
        const goneDirPath = path.join(tempDirPath, 'Gone.docx-htmls');
        const missing = await helpers.captureDocumentPages({
            dirPath: goneDirPath,
            filePaths: [path.join(goneDirPath, 'page1.html')],
            width: 640,
            height: 360,
        });
        expect(missing).toEqual({
            isSuccessful: false,
            message: 'The converted pages are not there any more.',
            dataUrls: [],
        });

        const fileDirPath = path.join(tempDirPath, 'File.pptx-htmls');
        await writeFile(fileDirPath, 'not a folder', 'utf8');
        const notFolder = await helpers.captureDocumentPages({
            dirPath: fileDirPath,
            filePaths: [path.join(fileDirPath, 'slide1.html')],
            width: 640,
            height: 360,
        });
        expect(notFolder.message).toBe(
            'The converted pages are not there any more.',
        );
        expect(state.created.windows).toEqual([]);
    });

    it('takes an empty page list for no pages', async () => {
        const result = await helpers.captureDocumentPages({
            htmlTexts: [],
            dirPath: path.join(tempDirPath, 'Song.pptx-htmls'),
            filePaths: [],
            width: 640,
            height: 360,
        });
        expect(result).toEqual({
            isSuccessful: false,
            message: 'No page was named.',
            dataUrls: [],
        });
    });
});

describe('the capture session', () => {
    it('refuses every permission and download, once for the whole process', async () => {
        await runClockUntilSettled(
            helpers.captureDocumentPages({
                htmlTexts: ['<p>one</p>'],
                width: 640,
                height: 360,
            }),
        );
        await runClockUntilSettled(
            helpers.captureDocumentPages({
                htmlTexts: ['<p>two</p>'],
                width: 640,
                height: 360,
            }),
        );
        expect(state.created.fromPartitionNames).toEqual([
            'owa-capture-document',
            'owa-capture-document',
        ]);
        expect(state.created.permissionRequestHandlers).toHaveLength(1);
        expect(state.created.permissionCheckHandlers).toHaveLength(1);
        expect(state.created.beforeRequests).toHaveLength(1);
        expect(state.created.sessionEvents.map((item) => item.name)).toEqual([
            'will-download',
        ]);

        const done = vi.fn();
        state.created.permissionRequestHandlers[0]({}, 'media', done);
        expect(done).toHaveBeenCalledWith(false);
        expect(state.created.permissionCheckHandlers[0]()).toBe(false);
        const download = { preventDefault: vi.fn() };
        state.created.sessionEvents[0].handler(download);
        expect(download.preventDefault).toHaveBeenCalledTimes(1);
        expect(state.created.beforeRequests[0].filter).toEqual({
            urls: ['<all_urls>'],
        });
    });

    it('lets a page load its own folder only while it is drawn', async () => {
        const { dirPath, filePaths } = await genDeckDir('Hymn.pptx-htmls', 1);
        const fontUrl = pathToFileURL(
            path.join(dirPath, 'fonts', 'Face.ttf'),
        ).toString();
        const otherUrl = pathToFileURL(
            path.join(tempDirPath, 'setting.json'),
        ).toString();
        const answersDuring: any[] = [];
        state.behaviour.onLoad = () => {
            answersDuring.push(
                askRequest(fontUrl),
                askRequest(otherUrl),
                askRequest('https://example.com/a.png'),
                askRequest('data:image/png;base64,AAAA'),
            );
        };
        await runClockUntilSettled(
            helpers.captureDocumentPages({
                dirPath,
                filePaths,
                width: 640,
                height: 360,
            }),
        );
        expect(answersDuring).toEqual([
            { cancel: false },
            { cancel: true },
            { cancel: true },
            { cancel: false },
        ]);
        // The drawing over, not even its own folder.
        expect(askRequest(fontUrl)).toEqual({ cancel: true });
        expect(askRequest('data:image/png;base64,AAAA')).toEqual({
            cancel: false,
        });
    });
});

describe('one capture at a time', () => {
    it('starts the second only once the first is done', async () => {
        const first = helpers.captureDocumentPages({
            htmlTexts: ['<p>first</p>'],
            width: 640,
            height: 360,
        });
        const second = helpers.captureDocumentPages({
            htmlTexts: ['<p>second</p>'],
            width: 640,
            height: 360,
        });
        await waitFor(() => {
            return state.created.windows[0]?.zoomFactors.length === 1;
        }, 'the first page to load');
        // The first is still waiting on its fonts: no second window yet.
        expect(state.created.windows).toHaveLength(1);
        await runClockUntilSettled(first);
        await expect(runClockUntilSettled(second)).resolves.toMatchObject({
            isSuccessful: true,
        });
        expect(state.created.windows).toHaveLength(2);
        expect(state.created.windows[0].destroyCount).toBe(1);
    });

    it('goes on with the next capture after one that threw', async () => {
        const { dirPath, filePaths } = await genDeckDir('Song.pptx-htmls', 1);
        state.behaviour.isConstructorBroken = true;
        const broken = helpers.captureDocumentPages({
            dirPath,
            filePaths,
            width: 640,
            height: 360,
        });
        await expect(runClockUntilSettled(broken)).rejects.toThrow(
            'The window could not be made.',
        );
        state.behaviour.isConstructorBroken = false;
        await expect(
            runClockUntilSettled(
                helpers.captureDocumentPages({
                    dirPath,
                    filePaths,
                    width: 640,
                    height: 360,
                }),
            ),
        ).resolves.toMatchObject({
            isSuccessful: true,
            dataUrls: [jpegDataUrl('page1')],
        });
    });
});
