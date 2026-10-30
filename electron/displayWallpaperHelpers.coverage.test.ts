import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// A virtual display's own wallpaper, as the mini screen card draws it. The
// sibling suite covers the monitors' wallpapers read from the OS; this one
// covers `readVirtualDisplayWallpaper`, which needs `createThumbnailFromPath`
// on the `nativeImage` stand-in as well.
const { mocks } = vi.hoisted(() => ({
    mocks: {
        execFile: vi.fn(),
        readdirSync: vi.fn(),
        statSync: vi.fn(),
        createFromPath: vi.fn(),
        createThumbnailFromPath: vi.fn(),
        getPath: vi.fn(),
    },
}));

vi.mock('node:child_process', () => ({ execFile: mocks.execFile }));
vi.mock('node:fs', () => ({
    default: { readdirSync: mocks.readdirSync, statSync: mocks.statSync },
}));
vi.mock('electron', () => ({
    app: { getPath: mocks.getPath },
    nativeImage: {
        createFromPath: mocks.createFromPath,
        createThumbnailFromPath: mocks.createThumbnailFromPath,
    },
}));

import {
    forgetDisplayWallpapers,
    readVirtualDisplayWallpaper,
} from './displayWallpaperHelpers';

const originalPlatform = process.platform;
const BLACK = '#000000';
const HOLD_MILLISECOND = 5 * 60 * 1000;

function definePlatform(platform: string) {
    Object.defineProperty(process, 'platform', {
        value: platform,
        configurable: true,
    });
}

function toDataUrl(text: string) {
    return `data:image/jpeg;base64,${Buffer.from(text, 'utf8').toString('base64')}`;
}

// A decoded picture whose `resize` hands back a smaller one with its own bytes.
function genImage(width: number, jpeg: string) {
    const small = {
        isEmpty: () => false,
        getSize: () => ({ width: 64, height: 36 }),
        toJPEG: vi.fn(() => Buffer.from(`${jpeg}-small`, 'utf8')),
    };
    return {
        isEmpty: () => false,
        getSize: () => ({ width, height: Math.round(width * 0.5625) }),
        resize: vi.fn(() => small),
        toJPEG: vi.fn(() => Buffer.from(jpeg, 'utf8')),
        small,
    };
}

beforeEach(() => {
    vi.useFakeTimers();
    definePlatform('win32');
    forgetDisplayWallpapers();
    mocks.statSync.mockReturnValue({ size: 1000 });
});

afterEach(() => {
    forgetDisplayWallpapers();
    vi.useRealTimers();
    definePlatform(originalPlatform);
});

describe('a virtual display wallpaper', () => {
    test('none is black, a colour is itself, and neither reads a file', async () => {
        await expect(
            readVirtualDisplayWallpaper({ kind: 'none' }),
        ).resolves.toEqual({ imageDataUrl: null, color: BLACK, fit: 'cover' });
        await expect(
            readVirtualDisplayWallpaper({ kind: 'color', color: '#336699' }),
        ).resolves.toEqual({
            imageDataUrl: null,
            color: '#336699',
            fit: 'cover',
        });
        expect(mocks.statSync).not.toHaveBeenCalled();
        expect(mocks.createFromPath).not.toHaveBeenCalled();
        expect(mocks.createThumbnailFromPath).not.toHaveBeenCalled();
    });

    test('a picture is a small JPEG on black, decoded once while it is held', async () => {
        const image = genImage(1920, 'PICTURE');
        mocks.createFromPath.mockReturnValue(image);
        const wallpaper = { kind: 'image' as const, filePath: '/w/bg.png' };
        const first = await readVirtualDisplayWallpaper(wallpaper, 200);
        expect(first).toEqual({
            imageDataUrl: toDataUrl('PICTURE-small'),
            color: BLACK,
            fit: 'cover',
        });
        expect(mocks.statSync).toHaveBeenCalledWith('/w/bg.png');
        expect(mocks.createFromPath).toHaveBeenCalledWith('/w/bg.png');
        expect(image.resize).toHaveBeenCalledWith({ width: 200 });
        expect(image.small.toJPEG).toHaveBeenCalledWith(70);

        // A second card on the same display decodes nothing.
        expect(await readVirtualDisplayWallpaper(wallpaper, 200)).toBe(first);
        expect(mocks.createFromPath).toHaveBeenCalledTimes(1);

        // Another width is a read of its own.
        await readVirtualDisplayWallpaper(wallpaper, 400);
        expect(mocks.createFromPath).toHaveBeenCalledTimes(2);

        // Released once the hold passes: read again.
        await vi.advanceTimersByTimeAsync(HOLD_MILLISECOND);
        await readVirtualDisplayWallpaper(wallpaper, 200);
        expect(mocks.createFromPath).toHaveBeenCalledTimes(3);

        // Refresh Preview forgets it too.
        forgetDisplayWallpapers();
        await readVirtualDisplayWallpaper(wallpaper, 200);
        expect(mocks.createFromPath).toHaveBeenCalledTimes(4);
    });

    test('a picture that is gone, too big or empty leaves only black', async () => {
        mocks.statSync.mockImplementationOnce(() => {
            throw new Error('ENOENT');
        });
        expect(
            await readVirtualDisplayWallpaper(
                { kind: 'image', filePath: '/w/moved.png' },
                200,
            ),
        ).toEqual({ imageDataUrl: null, color: BLACK, fit: 'cover' });

        mocks.statSync.mockReturnValueOnce({ size: 41 * 1024 * 1024 });
        expect(
            (
                await readVirtualDisplayWallpaper(
                    { kind: 'image', filePath: '/w/huge.png' },
                    200,
                )
            ).imageDataUrl,
        ).toBeNull();
        expect(mocks.createFromPath).not.toHaveBeenCalled();

        mocks.createFromPath.mockReturnValueOnce({ isEmpty: () => true });
        expect(
            (
                await readVirtualDisplayWallpaper(
                    { kind: 'image', filePath: '/w/broken.png' },
                    200,
                )
            ).imageDataUrl,
        ).toBeNull();
    });

    test.each(['win32', 'darwin'])(
        'on %s a video is a still of it, never the video itself',
        async (platform) => {
            definePlatform(platform);
            const still = {
                isEmpty: () => false,
                toJPEG: vi.fn(() => Buffer.from('STILL', 'utf8')),
            };
            mocks.createThumbnailFromPath.mockResolvedValue(still);
            const wallpaper = await readVirtualDisplayWallpaper(
                { kind: 'video', filePath: '/w/loop.mp4' },
                99999,
            );
            expect(wallpaper).toEqual({
                imageDataUrl: toDataUrl('STILL'),
                color: BLACK,
                fit: 'cover',
            });
            // The asked-for width is clamped, the still 4:3 of it.
            expect(mocks.createThumbnailFromPath).toHaveBeenCalledWith(
                '/w/loop.mp4',
                { width: 640, height: 480 },
            );
            expect(still.toJPEG).toHaveBeenCalledWith(70);
            expect(mocks.createFromPath).not.toHaveBeenCalled();
            // Held like a picture.
            await readVirtualDisplayWallpaper(
                { kind: 'video', filePath: '/w/loop.mp4' },
                99999,
            );
            expect(mocks.createThumbnailFromPath).toHaveBeenCalledTimes(1);
        },
    );

    test('a video with no still, or one the OS fails on, is black', async () => {
        mocks.createThumbnailFromPath.mockResolvedValueOnce({
            isEmpty: () => true,
        });
        expect(
            await readVirtualDisplayWallpaper(
                { kind: 'video', filePath: '/w/empty.mp4' },
                320,
            ),
        ).toEqual({ imageDataUrl: null, color: BLACK, fit: 'cover' });

        mocks.createThumbnailFromPath.mockRejectedValueOnce(
            new Error('no thumbnailer'),
        );
        expect(
            await readVirtualDisplayWallpaper(
                { kind: 'video', filePath: '/w/odd.mkv' },
                320,
            ),
        ).toEqual({ imageDataUrl: null, color: BLACK, fit: 'cover' });
        // The smallest width when none is given.
        await readVirtualDisplayWallpaper({
            kind: 'video',
            filePath: '/w/none.mp4',
        });
        expect(mocks.createThumbnailFromPath).toHaveBeenLastCalledWith(
            '/w/none.mp4',
            { width: 64, height: 48 },
        );
    });

    test('on Linux a video has no still to show', async () => {
        definePlatform('linux');
        expect(
            await readVirtualDisplayWallpaper(
                { kind: 'video', filePath: '/w/loop.mp4' },
                320,
            ),
        ).toEqual({ imageDataUrl: null, color: BLACK, fit: 'cover' });
        expect(mocks.createThumbnailFromPath).not.toHaveBeenCalled();
        expect(mocks.createFromPath).not.toHaveBeenCalled();
    });
});
