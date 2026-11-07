// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { releaseMediaElementMock, appProviderMock } = vi.hoisted(() => ({
    releaseMediaElementMock: vi.fn(),
    appProviderMock: {
        isPageScreen: false,
        systemUtils: { isDev: false },
        appUtils: { handleError: vi.fn() },
    },
}));

vi.mock('../server/appProvider', () => ({ default: appProviderMock }));
vi.mock('./mediaHelpers', () => ({
    releaseMediaElement: releaseMediaElementMock,
}));

import { getVideoDurationSeconds } from './videoDurationHelpers';

let createdVideos: HTMLVideoElement[] = [];

beforeEach(() => {
    vi.useFakeTimers();
    createdVideos = [];
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((
        tagName: string,
        options?: ElementCreationOptions,
    ) => {
        const element = originalCreateElement(tagName, options);
        if (tagName === 'video') {
            createdVideos.push(element as HTMLVideoElement);
        }
        return element;
    }) as typeof document.createElement);
});

afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
});

// The probe is created after the cache's (unlocked) lookup has resolved.
async function waitForProbe(count = 1) {
    for (let i = 0; i < 20 && createdVideos.length < count; i++) {
        await Promise.resolve();
    }
    expect(createdVideos).toHaveLength(count);
    return createdVideos[count - 1];
}

function loadMetadata(video: HTMLVideoElement, duration: number) {
    Object.defineProperty(video, 'duration', {
        configurable: true,
        value: duration,
    });
    video.dispatchEvent(new Event('loadedmetadata'));
}

describe('getVideoDurationSeconds', () => {
    test('reads the metadata of a muted, metadata-only probe and rounds UP', async () => {
        const promise = getVideoDurationSeconds('file:///clip-a.mp4');
        const video = await waitForProbe();
        expect(video.preload).toBe('metadata');
        expect(video.muted).toBe(true);
        expect(video.src).toBe('file:///clip-a.mp4');

        loadMetadata(video, 188.035011);
        await expect(promise).resolves.toBe(189);
        // The probe gives its player back and drops its handlers.
        expect(releaseMediaElementMock).toHaveBeenCalledWith(video);
        expect(video.onloadedmetadata).toBeNull();
        expect(video.onerror).toBeNull();
        // The give-up timeout was cleared: it never fires a second finish.
        await vi.advanceTimersByTimeAsync(10_000);
        expect(releaseMediaElementMock).toHaveBeenCalledTimes(1);
    });

    test('a second ask within the cache window does not probe again', async () => {
        const first = getVideoDurationSeconds('file:///clip-b.mp4');
        loadMetadata(await waitForProbe(), 12);
        await expect(first).resolves.toBe(12);

        await vi.advanceTimersByTimeAsync(5_000);
        await expect(
            getVideoDurationSeconds('file:///clip-b.mp4'),
        ).resolves.toBe(12);
        expect(createdVideos).toHaveLength(1);
    });

    test('the cache is short-lived: past its window the clip is probed again', async () => {
        const first = getVideoDurationSeconds('file:///clip-c.mp4');
        loadMetadata(await waitForProbe(), 30);
        await expect(first).resolves.toBe(30);

        await vi.advanceTimersByTimeAsync(10_001);
        const second = getVideoDurationSeconds('file:///clip-c.mp4');
        loadMetadata(await waitForProbe(2), 31);
        await expect(second).resolves.toBe(31);
    });

    test.each([
        ['zero', 0],
        ['infinite (a live stream)', Number.POSITIVE_INFINITY],
        ['not a number', Number.NaN],
    ])('a %s duration reads as unknown', async (_label, duration) => {
        const src = `file:///clip-${String(duration)}.mp4`;
        const promise = getVideoDurationSeconds(src);
        loadMetadata(await waitForProbe(), duration);
        await expect(promise).resolves.toBeNull();
    });

    test('a load error reads as unknown, and the failure is cached', async () => {
        const first = getVideoDurationSeconds('file:///broken.mp4');
        const video = await waitForProbe();
        video.dispatchEvent(new Event('error'));
        await expect(first).resolves.toBeNull();
        expect(releaseMediaElementMock).toHaveBeenCalledWith(video);

        // An unreadable file must not be probed again every tick.
        await expect(
            getVideoDurationSeconds('file:///broken.mp4'),
        ).resolves.toBeNull();
        expect(createdVideos).toHaveLength(1);
    });

    test('a probe that never answers gives up after ten seconds', async () => {
        const promise = getVideoDurationSeconds('file:///on-a-stick.mp4');
        const video = await waitForProbe();
        let settled: number | null | undefined;
        promise.then((value) => {
            settled = value;
        });

        await vi.advanceTimersByTimeAsync(9_999);
        expect(settled).toBeUndefined();
        expect(releaseMediaElementMock).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        expect(settled).toBeNull();
        expect(releaseMediaElementMock).toHaveBeenCalledWith(video);
        expect(video.onloadedmetadata).toBeNull();
    });

    test('a screen window does not cache, so it probes each time', async () => {
        appProviderMock.isPageScreen = true;
        try {
            const first = getVideoDurationSeconds('file:///screen.mp4');
            loadMetadata(await waitForProbe(), 5);
            await expect(first).resolves.toBe(5);
            const second = getVideoDurationSeconds('file:///screen.mp4');
            loadMetadata(await waitForProbe(2), 5);
            await expect(second).resolves.toBe(5);
        } finally {
            appProviderMock.isPageScreen = false;
        }
    });
});
