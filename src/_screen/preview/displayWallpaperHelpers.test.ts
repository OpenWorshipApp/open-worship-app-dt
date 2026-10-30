// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { displayState, mocks, providerMock, settingStore } = vi.hoisted(() => ({
    displayState: {
        displays: [
            { id: 11, bounds: { width: 1920, height: 1080 }, scaleFactor: 1 },
            { id: 22, bounds: { width: 1280, height: 800 }, scaleFactor: 2 },
        ] as any[],
    },
    mocks: {
        electronSendAsync: vi.fn(),
        handleError: vi.fn(),
    },
    // `appHooks` reads `systemUtils.isDev` at module load; without a preload
    // there is no provider behind the real module.
    providerMock: { systemUtils: { isDev: false } },
    settingStore: new Map<string, string>(),
}));

vi.mock('../../server/appProvider', () => ({ default: providerMock }));
vi.mock('../../server/electronSendHelpers', () => ({
    electronSendAsync: mocks.electronSendAsync,
}));
vi.mock('../../helper/errorHelpers', () => ({
    handleError: mocks.handleError,
}));
vi.mock('../../helper/settingHelpers', () => ({
    getSetting: (key: string) => settingStore.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        settingStore.set(key, value);
    },
}));
vi.mock('../managers/screenHelpers', () => ({
    getAllDisplays: () => ({
        primaryDisplay: displayState.displays[0],
        displays: displayState.displays,
    }),
}));

import type * as DisplayWallpaperHelpersType from './displayWallpaperHelpers';

const WALLPAPER = {
    imageDataUrl: 'data:image/jpeg;base64,AAA',
    color: 'rgb(0, 0, 0)',
    fit: 'cover' as const,
};

let helpers: typeof DisplayWallpaperHelpersType;

async function flush() {
    await Promise.resolve();
    await Promise.resolve();
}

beforeEach(async () => {
    settingStore.clear();
    mocks.electronSendAsync.mockResolvedValue(WALLPAPER);
    // The held wallpaper and its listeners are module state, which is what is
    // under test.
    vi.resetModules();
    helpers = await import('./displayWallpaperHelpers');
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('the backdrop setting', () => {
    test('is on unless it was turned off', () => {
        expect(helpers.getIsWallpaperBackdropEnabled()).toBe(true);
        helpers.setIsWallpaperBackdropEnabled(false);
        expect(helpers.getIsWallpaperBackdropEnabled()).toBe(false);
        helpers.setIsWallpaperBackdropEnabled(true);
        expect(helpers.getIsWallpaperBackdropEnabled()).toBe(true);
    });
});

describe('subscribeDisplayWallpaper', () => {
    test('the first card reads the wallpaper and is handed it', async () => {
        const listener = vi.fn();
        helpers.subscribeDisplayWallpaper(11, listener);
        expect(listener).toHaveBeenCalledWith(null);
        await flush();
        expect(mocks.electronSendAsync).toHaveBeenCalledWith(
            'main:app:read-display-wallpaper',
            expect.objectContaining({ displayIndex: 0 }),
        );
        expect(listener).toHaveBeenLastCalledWith(WALLPAPER);
    });

    test('two cards on ONE display read it once between them', async () => {
        helpers.subscribeDisplayWallpaper(11, vi.fn());
        const lateListener = vi.fn();
        helpers.subscribeDisplayWallpaper(11, lateListener);
        await flush();
        expect(mocks.electronSendAsync).toHaveBeenCalledTimes(1);
        // ...and the second one is still told what the first read.
        expect(lateListener).toHaveBeenLastCalledWith(WALLPAPER);
    });

    test('a scaled display is asked for by its PIXEL size first', async () => {
        // Windows names each monitor's pre-fitted copy in physical pixels while
        // `bounds` is in DIP, so both are offered, the physical one first.
        helpers.subscribeDisplayWallpaper(22, vi.fn());
        await flush();
        expect(mocks.electronSendAsync).toHaveBeenCalledWith(
            'main:app:read-display-wallpaper',
            expect.objectContaining({
                displayIndex: 1,
                sizes: [
                    { width: 2560, height: 1600 },
                    { width: 1280, height: 800 },
                ],
            }),
        );
    });

    test('a display that is no longer plugged in is still asked about', async () => {
        helpers.subscribeDisplayWallpaper(999, vi.fn());
        await flush();
        expect(mocks.electronSendAsync).toHaveBeenCalledWith(
            'main:app:read-display-wallpaper',
            expect.objectContaining({ displayIndex: 0, sizes: [] }),
        );
    });

    test('nothing is read again on its own -- a wallpaper holds still', async () => {
        helpers.subscribeDisplayWallpaper(11, vi.fn());
        await flush();
        vi.useFakeTimers();
        await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
        vi.useRealTimers();
        expect(mocks.electronSendAsync).toHaveBeenCalledTimes(1);
    });
});

describe('refreshDisplayWallpaper', () => {
    test('reads it again, FORCING past what the main process holds', async () => {
        helpers.subscribeDisplayWallpaper(11, vi.fn());
        await flush();
        helpers.refreshDisplayWallpaper(11);
        await flush();
        expect(mocks.electronSendAsync).toHaveBeenLastCalledWith(
            'main:app:read-display-wallpaper',
            expect.objectContaining({ isForced: true }),
        );
    });

    test('a refresh while the first read is still out asks only once', async () => {
        mocks.electronSendAsync.mockReturnValue(new Promise(() => {}));
        helpers.subscribeDisplayWallpaper(11, vi.fn());
        helpers.refreshDisplayWallpaper(11);
        await flush();
        expect(mocks.electronSendAsync).toHaveBeenCalledTimes(1);
    });

    test('refreshing a display no card is on does nothing', async () => {
        helpers.refreshDisplayWallpaper(11);
        await flush();
        expect(mocks.electronSendAsync).not.toHaveBeenCalled();
    });
});

describe('letting go', () => {
    test('the last card leaving drops the picture', async () => {
        const unsubscribe = helpers.subscribeDisplayWallpaper(11, vi.fn());
        await flush();
        unsubscribe();
        const listener = vi.fn();
        helpers.subscribeDisplayWallpaper(11, listener);
        expect(listener).toHaveBeenCalledWith(null);
    });

    test('a read still in flight cannot write into a dropped display', async () => {
        let resolveRead: (value: unknown) => void = () => {};
        mocks.electronSendAsync.mockReturnValue(
            new Promise((resolve) => {
                resolveRead = resolve;
            }),
        );
        const unsubscribe = helpers.subscribeDisplayWallpaper(11, vi.fn());
        unsubscribe();
        resolveRead(WALLPAPER);
        await flush();
        const listener = vi.fn();
        mocks.electronSendAsync.mockReturnValue(new Promise(() => {}));
        helpers.subscribeDisplayWallpaper(11, listener);
        expect(listener).toHaveBeenCalledWith(null);
    });

    test('a failed read keeps the pattern and says so only in the log', async () => {
        mocks.electronSendAsync.mockRejectedValue(new Error('no desktop'));
        const listener = vi.fn();
        helpers.subscribeDisplayWallpaper(11, listener);
        await flush();
        expect(listener).toHaveBeenLastCalledWith(null);
        expect(mocks.handleError).toHaveBeenCalled();
    });
});

describe('a Screen Mirror guest display', () => {
    test('is never asked for a wallpaper: it has no desktop here', async () => {
        const { MIRROR_REMOTE_DISPLAY_FIRST } =
            await import('../../../electron/screenMirrorProtocol');
        const listener = vi.fn();
        helpers.subscribeDisplayWallpaper(
            MIRROR_REMOTE_DISPLAY_FIRST - 3,
            listener,
        );
        helpers.refreshDisplayWallpaper(MIRROR_REMOTE_DISPLAY_FIRST - 3);
        await flush();
        expect(mocks.electronSendAsync).not.toHaveBeenCalled();
        expect(listener).toHaveBeenCalledWith(null);
    });
});

describe('useDisplayWallpaper', () => {
    test('hands a card the wallpaper while on, and lets go of it when off', async () => {
        const { createElement, act } = await import('react');
        const { createRoot } = await import('react-dom/client');
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        const seen: unknown[] = [];
        function ProbeComp({ isEnabled }: { isEnabled: boolean }) {
            seen.push(helpers.useDisplayWallpaper(11, isEnabled));
            return null;
        }
        const container = document.createElement('div');
        const root = createRoot(container);
        try {
            await act(async () => {
                root.render(createElement(ProbeComp, { isEnabled: true }));
            });
            await act(async () => {
                await flush();
            });
            expect(seen[0]).toBe(null);
            expect(seen.at(-1)).toEqual(WALLPAPER);
            expect(mocks.electronSendAsync).toHaveBeenCalledTimes(1);

            // Off: nothing to draw, and the display is released, so a
            // refresh has nothing to read.
            await act(async () => {
                root.render(createElement(ProbeComp, { isEnabled: false }));
            });
            expect(seen.at(-1)).toBe(null);
            helpers.refreshDisplayWallpaper(11);
            await flush();
            expect(mocks.electronSendAsync).toHaveBeenCalledTimes(1);

            // On again: read afresh for the card.
            await act(async () => {
                root.render(createElement(ProbeComp, { isEnabled: true }));
            });
            await act(async () => {
                await flush();
            });
            expect(mocks.electronSendAsync).toHaveBeenCalledTimes(2);
            expect(seen.at(-1)).toEqual(WALLPAPER);
        } finally {
            act(() => {
                root.unmount();
            });
            vi.unstubAllGlobals();
        }
    });
});
