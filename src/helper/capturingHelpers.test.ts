/**
 * The screenshot cache against the REAL `CacheManager`.
 *
 * `domHelpers.test.tsx` covers what a capture DOES with a stub cache that
 * never expires; the one thing that stub cannot show is the difference this
 * module is built around — a remote page's shot expires because it may have
 * changed behind the app's back, and a local file's does not because its key
 * carries the md5 of its own bytes. That difference is the whole saving: a
 * hidden BrowserWindow and a three-second page load, on every tab switch and
 * every remounted tile, for a page nobody touched.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { electronSendAsyncMock, getFileMD5Mock, fsGetFileStampMock } =
    vi.hoisted(() => ({
        electronSendAsyncMock: vi.fn(),
        getFileMD5Mock: vi.fn(async (_filePath: string) => {
            return 'md5-one' as string | null;
        }),
        fsGetFileStampMock: vi.fn(async (_filePath: string) => {
            return { size: 1, modifiedAt: 1 } as {
                size: number;
                modifiedAt: number;
            } | null;
        }),
    }));

vi.mock('../server/appProvider', () => ({
    default: {
        isPageScreen: false,
        // Read at module load by `appHooks` to choose its effect wrapper.
        systemUtils: { isDev: false },
    },
}));

vi.mock('../server/appHelpers', () => ({
    electronSendAsync: electronSendAsyncMock,
}));

vi.mock('../_screen/managers/screenHelpers', () => ({
    getDefaultScreenDisplay: vi.fn(() => ({
        bounds: { width: 1280, height: 720 },
    })),
}));

// Reached on demand by the md5 keying, never at module load.
vi.mock('../server/fileHelpers', () => ({
    toFilePathFromFileUrl: (src: string) => {
        return decodeURIComponent(new URL(src).pathname);
    },
    fsGetFileStamp: fsGetFileStampMock,
    getFileMD5: getFileMD5Mock,
}));

import { captureWebScreenShot } from './capturingHelpers';

const CAPTURE_OPTIONS = { width: 100, height: 100, delay: 0 };
const REMOTE_URL = 'https://example.com/clock';
const FILE_URL = 'file:///webs/snow.html';

describe('what the screenshot cache keeps, and for how long', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        electronSendAsyncMock.mockResolvedValue('shot');
        getFileMD5Mock.mockResolvedValue('md5-one');
        fsGetFileStampMock.mockResolvedValue({ size: 1, modifiedAt: 1 });
    });

    test('expires a web page and keeps a file whose bytes have not moved', async () => {
        await captureWebScreenShot(REMOTE_URL, CAPTURE_OPTIONS);
        await captureWebScreenShot(FILE_URL, CAPTURE_OPTIONS);
        expect(electronSendAsyncMock).toHaveBeenCalledTimes(2);

        // Inside the expiry neither is re-captured, which was always true.
        vi.advanceTimersByTime(5_000);
        await captureWebScreenShot(REMOTE_URL, CAPTURE_OPTIONS);
        await captureWebScreenShot(FILE_URL, CAPTURE_OPTIONS);
        expect(electronSendAsyncMock).toHaveBeenCalledTimes(2);

        // Past it, the page that could have changed with nothing here to see
        // it is captured again -- and the file, which can prove it did not, is
        // handed back the picture it already has.
        vi.advanceTimersByTime(60_000);
        await captureWebScreenShot(FILE_URL, CAPTURE_OPTIONS);
        expect(electronSendAsyncMock).toHaveBeenCalledTimes(2);
        await captureWebScreenShot(REMOTE_URL, CAPTURE_OPTIONS);
        expect(electronSendAsyncMock).toHaveBeenCalledTimes(3);
    });

    test('re-captures a file the moment its bytes do move', async () => {
        // Its own url: the file cache deliberately outlives a test, the way
        // it outlives a panel being closed and opened again.
        const fileUrl = 'file:///webs/edited.html';
        await captureWebScreenShot(fileUrl, CAPTURE_OPTIONS);
        expect(electronSendAsyncMock).toHaveBeenCalledTimes(1);

        getFileMD5Mock.mockResolvedValue('md5-two');
        fsGetFileStampMock.mockResolvedValue({ size: 2, modifiedAt: 2 });
        await captureWebScreenShot(fileUrl, CAPTURE_OPTIONS);
        expect(electronSendAsyncMock).toHaveBeenCalledTimes(2);

        // The shot taken of the bytes that are gone goes with them, rather
        // than sitting in the shared budget until something else evicts it.
        getFileMD5Mock.mockResolvedValue('md5-one');
        fsGetFileStampMock.mockResolvedValue({ size: 1, modifiedAt: 1 });
        await captureWebScreenShot(fileUrl, CAPTURE_OPTIONS);
        expect(electronSendAsyncMock).toHaveBeenCalledTimes(3);
    });

    test('reads the file only when a stat says it is worth reading', async () => {
        const fileUrl = 'file:///webs/two-sizes.html';
        await captureWebScreenShot(fileUrl, CAPTURE_OPTIONS);
        await captureWebScreenShot(fileUrl, {
            ...CAPTURE_OPTIONS,
            width: 200,
        });
        // Two sizes of the same unchanged file: two stats, ONE read.
        expect(fsGetFileStampMock).toHaveBeenCalledTimes(2);
        expect(getFileMD5Mock).toHaveBeenCalledTimes(1);

        // A web address asks the disk nothing at all.
        await captureWebScreenShot(
            'https://example.com/no-disk',
            CAPTURE_OPTIONS,
        );
        expect(fsGetFileStampMock).toHaveBeenCalledTimes(2);
        expect(electronSendAsyncMock).toHaveBeenCalledTimes(3);

        // And the two sizes are both still there: one file is legitimately
        // cached at several box sizes at once, and a capture at one size must
        // not throw the other away.
        await captureWebScreenShot(fileUrl, CAPTURE_OPTIONS);
        await captureWebScreenShot(fileUrl, {
            ...CAPTURE_OPTIONS,
            width: 200,
        });
        expect(electronSendAsyncMock).toHaveBeenCalledTimes(3);
    });
});
