// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { mocks } = vi.hoisted(() => ({
    mocks: {
        electronSendAsync: vi.fn(),
        getFileMD5: vi.fn(),
        fsGetFileStamp: vi.fn(),
        getDefaultScreenDisplay: vi.fn(),
    },
}));

vi.mock('../server/appProvider', () => ({
    default: {
        isPageScreen: false,
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
        appUtils: { handleError: () => {} },
    },
}));
vi.mock('../server/appHelpers', () => ({
    electronSendAsync: mocks.electronSendAsync,
}));
vi.mock('../_screen/managers/screenHelpers', () => ({
    getDefaultScreenDisplay: mocks.getDefaultScreenDisplay,
}));
vi.mock('../server/fileHelpers', () => ({
    toFilePathFromFileUrl: (src: string) => {
        return decodeURIComponent(new URL(src).pathname);
    },
    fsGetFileStamp: mocks.fsGetFileStamp,
    getFileMD5: mocks.getFileMD5,
}));

import {
    captureWebScreenShot,
    refreshWebCapturing,
    useWebCapturing,
} from './capturingHelpers';

const SIZE = { width: 200, height: 100, delay: 0 };
const usedUrls = new Set<string>();

function capture(url: string) {
    usedUrls.add(url);
    return captureWebScreenShot(url, SIZE);
}

function genDeferred<T>() {
    let resolve: (value: T) => void = () => {};
    const promise = new Promise<T>((resolveIt) => {
        resolve = resolveIt;
    });
    return { promise, resolve };
}

beforeEach(() => {
    vi.useFakeTimers();
    mocks.electronSendAsync.mockResolvedValue('shot');
    mocks.fsGetFileStamp.mockResolvedValue({ size: 1, modifiedAt: 1 });
    mocks.getFileMD5.mockImplementation(async (filePath: string) => {
        return `md5-of-${filePath}`;
    });
    mocks.getDefaultScreenDisplay.mockReturnValue({
        bounds: { width: 1280, height: 720 },
    });
});

afterEach(() => {
    // Drops every shot this test cached, so the shared byte budget starts
    // empty for the next one.
    for (const url of usedUrls) {
        refreshWebCapturing(url);
    }
    usedUrls.clear();
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe('captureWebScreenShot', () => {
    test('a file whose bytes cannot be hashed is cached like a web page, and expires', async () => {
        mocks.getFileMD5.mockResolvedValue(null);
        await capture('file:///webs/unreadable.html');
        await capture('file:///webs/unreadable.html');
        expect(mocks.electronSendAsync).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(10_001);
        await capture('file:///webs/unreadable.html');
        expect(mocks.electronSendAsync).toHaveBeenCalledTimes(2);
    });

    test('two asks for the same shot at once share one capture', async () => {
        const deferred = genDeferred<string>();
        mocks.electronSendAsync.mockReturnValue(deferred.promise);
        const first = capture('https://example.com/shared');
        const second = capture('https://example.com/shared');
        // The cache lookup of the second waits out the first one's lock
        // (a 100ms poll) and then finds the capture already in flight.
        await vi.advanceTimersByTimeAsync(200);
        expect(mocks.electronSendAsync).toHaveBeenCalledTimes(1);
        expect(mocks.electronSendAsync).toHaveBeenCalledWith(
            'main:app:capture-web-screen-shot',
            { url: 'https://example.com/shared', ...SIZE },
        );
        deferred.resolve('one shot');
        await expect(Promise.all([first, second])).resolves.toEqual([
            'one shot',
            'one shot',
        ]);
    });

    test('a refresh during a capture starts a new one and never caches the old', async () => {
        const url = 'https://example.com/scoreboard';
        const oldShot = genDeferred<string>();
        const newShot = genDeferred<string>();
        mocks.electronSendAsync
            .mockReturnValueOnce(oldShot.promise)
            .mockReturnValueOnce(newShot.promise);

        const beforeRefresh = capture(url);
        await vi.advanceTimersByTimeAsync(0);
        refreshWebCapturing(url);
        const afterRefresh = capture(url);
        await vi.advanceTimersByTimeAsync(0);
        expect(mocks.electronSendAsync).toHaveBeenCalledTimes(2);

        // The abandoned capture finishes first: its caller still gets it...
        oldShot.resolve('old score');
        await expect(beforeRefresh).resolves.toBe('old score');
        // ...but it neither caches nor clears the newer capture's slot, so a
        // third asker joins the capture that is still running.
        const joining = capture(url);
        await vi.advanceTimersByTimeAsync(0);
        expect(mocks.electronSendAsync).toHaveBeenCalledTimes(2);

        newShot.resolve('new score');
        await expect(afterRefresh).resolves.toBe('new score');
        await expect(joining).resolves.toBe('new score');
        await expect(capture(url)).resolves.toBe('new score');
        expect(mocks.electronSendAsync).toHaveBeenCalledTimes(2);
    });
});

describe('the shared byte budget', () => {
    test('an oversized new shot evicts everything older, but never itself', async () => {
        mocks.electronSendAsync.mockResolvedValueOnce('s'.repeat(1_000_000));
        await capture('file:///webs/small.html');
        mocks.electronSendAsync.mockResolvedValueOnce('b'.repeat(6_500_000));
        await capture('file:///webs/huge.html');
        expect(mocks.electronSendAsync).toHaveBeenCalledTimes(2);

        // The huge one is still served from the cache...
        await expect(capture('file:///webs/huge.html')).resolves.toHaveLength(
            6_500_000,
        );
        expect(mocks.electronSendAsync).toHaveBeenCalledTimes(2);
        // ...and the small one was evicted to make room.
        mocks.electronSendAsync.mockResolvedValueOnce('again');
        await expect(capture('file:///webs/small.html')).resolves.toBe('again');
        expect(mocks.electronSendAsync).toHaveBeenCalledTimes(3);
    });

    test('a web shot that already expired is not charged against the budget', async () => {
        // A file shot (never expires) first, then a web shot that will.
        mocks.electronSendAsync.mockResolvedValueOnce('f'.repeat(3_000_000));
        await capture('file:///webs/keep.html');
        mocks.electronSendAsync.mockResolvedValueOnce('w'.repeat(2_500_000));
        await capture('https://example.com/expiring');
        await vi.advanceTimersByTimeAsync(11_000);

        // 3M live + 1M new is well under the 6M budget once the expired 2.5M
        // stops counting; charged for it, the live file shot was evicted.
        mocks.electronSendAsync.mockResolvedValueOnce('n'.repeat(1_000_000));
        await capture('https://example.com/new');
        expect(mocks.electronSendAsync).toHaveBeenCalledTimes(3);
        await expect(capture('file:///webs/keep.html')).resolves.toHaveLength(
            3_000_000,
        );
        expect(mocks.electronSendAsync).toHaveBeenCalledTimes(3);
    });
});

describe('useWebCapturing and refreshWebCapturing', () => {
    let container: HTMLDivElement;
    let root: Root;

    function ProbeComp({ name }: Readonly<{ name: string }>) {
        const imageData = useWebCapturing('https://example.com/clock', {
            width: 320,
            height: 180,
        });
        return (
            <span data-name={name}>
                {imageData === undefined ? 'loading' : String(imageData)}
            </span>
        );
    }

    // Two mounts asking at once meet on the cache's lock, which polls.
    async function settleCaptures() {
        await act(async () => {
            await vi.advanceTimersByTimeAsync(200);
        });
    }

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        usedUrls.add('https://example.com/clock');
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
    });

    test('every mounted capture of a url re-runs when it is refreshed', async () => {
        mocks.electronSendAsync.mockResolvedValueOnce('12:00');
        await act(async () => {
            root.render(
                <>
                    <ProbeComp name="thumbnail" />
                    <ProbeComp name="preview" />
                </>,
            );
        });
        await settleCaptures();
        expect(container.textContent).toBe('12:0012:00');
        // One capture for both: the second asker joined it.
        expect(mocks.electronSendAsync).toHaveBeenCalledTimes(1);
        expect(mocks.electronSendAsync).toHaveBeenCalledWith(
            'main:app:capture-web-screen-shot',
            {
                url: 'https://example.com/clock',
                width: 320,
                height: 180,
                delay: 3000,
            },
        );
        expect(mocks.getDefaultScreenDisplay).not.toHaveBeenCalled();

        mocks.electronSendAsync.mockResolvedValueOnce('12:05');
        await act(async () => {
            refreshWebCapturing('https://example.com/clock');
        });
        await settleCaptures();
        expect(container.textContent).toBe('12:0512:05');
        expect(mocks.electronSendAsync).toHaveBeenCalledTimes(2);
    });

    test('an unmounted capture stops listening for refreshes', async () => {
        await act(async () => {
            root.render(<ProbeComp name="only" />);
        });
        expect(mocks.electronSendAsync).toHaveBeenCalledTimes(1);
        await act(async () => {
            root.render(<span>gone</span>);
        });
        await act(async () => {
            refreshWebCapturing('https://example.com/clock');
        });
        expect(mocks.electronSendAsync).toHaveBeenCalledTimes(1);
    });
});
