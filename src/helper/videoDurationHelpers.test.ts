// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The real `CacheManager` is under test here too -- its ten-second expiry is
// the module's whole memory promise. It asks `appProvider` whether this is a
// screen page (those cache nothing), and the logger asks whether this is dev.
vi.mock('../server/appProvider', () => ({
    default: {
        isPageScreen: false,
        systemUtils: { isDev: false },
        appUtils: { handleError: vi.fn() },
    },
}));

import { getVideoDurationSeconds } from './videoDurationHelpers';

let createdVideos: HTMLVideoElement[];
let loadSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    vi.useFakeTimers();
    createdVideos = [];
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((
        tagName: string,
    ) => {
        const element = createElement(tagName);
        if (element instanceof HTMLVideoElement) {
            createdVideos.push(element);
        }
        return element;
    }) as typeof document.createElement);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    loadSpy = vi
        .spyOn(HTMLMediaElement.prototype, 'load')
        .mockImplementation(() => {});
});

afterEach(() => {
    vi.useRealTimers();
});

// The cache is read before a probe is built, behind an async lock.
async function waitForProbes(count: number) {
    for (let i = 0; i < 50 && createdVideos.length < count; i++) {
        await Promise.resolve();
    }
    expect(createdVideos).toHaveLength(count);
    return createdVideos[count - 1];
}

function answerMetadata(video: HTMLVideoElement, duration: number) {
    Object.defineProperty(video, 'duration', {
        configurable: true,
        value: duration,
    });
    video.dispatchEvent(new Event('loadedmetadata'));
}

describe('getVideoDurationSeconds', () => {
    test('reads whole seconds, rounded up, and hands the probe back', async () => {
        const reading = getVideoDurationSeconds('file:///clip-a.mp4');
        const probe = await waitForProbes(1);
        expect(probe.preload).toBe('metadata');
        expect(probe.muted).toBe(true);
        expect(probe.src).toBe('file:///clip-a.mp4');

        answerMetadata(probe, 188.035011);
        expect(await reading).toBe(189);
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(probe.hasAttribute('src')).toBe(false);
        expect(probe.onloadedmetadata).toBeNull();
        expect(probe.onerror).toBeNull();
    });

    test('a clip asked again soon is answered from memory', async () => {
        const first = getVideoDurationSeconds('file:///clip-b.mp4');
        answerMetadata(await waitForProbes(1), 42);
        expect(await first).toBe(42);

        expect(await getVideoDurationSeconds('file:///clip-b.mp4')).toBe(42);
        expect(createdVideos).toHaveLength(1);
    });

    test('the memory is short: past ten seconds the clip is read again', async () => {
        const first = getVideoDurationSeconds('file:///clip-c.mp4');
        answerMetadata(await waitForProbes(1), 30);
        expect(await first).toBe(30);

        await vi.advanceTimersByTimeAsync(11_000);
        const second = getVideoDurationSeconds('file:///clip-c.mp4');
        answerMetadata(await waitForProbes(2), 31);
        expect(await second).toBe(31);
    });

    test('a file that cannot be read is null, and is not probed again', async () => {
        const first = getVideoDurationSeconds('file:///broken.mp4');
        const probe = await waitForProbes(1);
        probe.dispatchEvent(new Event('error'));
        expect(await first).toBeNull();
        expect(loadSpy).toHaveBeenCalledTimes(1);

        expect(await getVideoDurationSeconds('file:///broken.mp4')).toBeNull();
        expect(createdVideos).toHaveLength(1);
    });

    test('a live stream or an empty clip has no length to wait for', async () => {
        const live = getVideoDurationSeconds('file:///live.m3u8');
        answerMetadata(await waitForProbes(1), Number.POSITIVE_INFINITY);
        expect(await live).toBeNull();

        const empty = getVideoDurationSeconds('file:///empty.mp4');
        answerMetadata(await waitForProbes(2), 0);
        expect(await empty).toBeNull();

        const unknown = getVideoDurationSeconds('file:///unknown.mp4');
        answerMetadata(await waitForProbes(3), Number.NaN);
        expect(await unknown).toBeNull();
    });

    test('a clip that never answers is given up after ten seconds', async () => {
        const reading = getVideoDurationSeconds('file:///stick-gone.mp4');
        const probe = await waitForProbes(1);
        await vi.advanceTimersByTimeAsync(9_999);
        expect(loadSpy).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(await reading).toBeNull();
        expect(loadSpy).toHaveBeenCalledTimes(1);
        // A late answer after giving up changes nothing.
        expect(probe.onloadedmetadata).toBeNull();
    });
});
