import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { mocks } = vi.hoisted(() => ({
    mocks: {
        execFile: vi.fn(),
        readdirSync: vi.fn(),
        statSync: vi.fn(),
        createFromPath: vi.fn(),
        getPath: vi.fn(() => '/appdata'),
    },
}));

vi.mock('node:child_process', () => ({ execFile: mocks.execFile }));
vi.mock('node:fs', () => ({
    default: { readdirSync: mocks.readdirSync, statSync: mocks.statSync },
}));
vi.mock('electron', () => ({
    app: { getPath: mocks.getPath },
    nativeImage: { createFromPath: mocks.createFromPath },
}));

import type * as DisplayWallpaperHelpersType from './displayWallpaperHelpers';

const originalPlatform = process.platform;

let helpers: typeof DisplayWallpaperHelpersType;

function definePlatform(platform: string) {
    Object.defineProperty(process, 'platform', {
        value: platform,
        configurable: true,
    });
}

/** `promisify` wraps the callback form, so the mock answers that way. */
function answerCommand(
    readStdout: (command: string, args: string[]) => string | null,
) {
    mocks.execFile.mockImplementation(
        (command: string, args: string[], _options: any, callback: any) => {
            const stdout = readStdout(command, args);
            if (stdout === null) {
                callback(new Error(`no ${command}`));
                return;
            }
            callback(null, { stdout, stderr: '' });
        },
    );
}

function genImage(width = 1920) {
    return {
        isEmpty: () => false,
        getSize: () => ({ width, height: 1080 }),
        resize: vi.fn(function resize(this: unknown) {
            return genImage(400);
        }),
        toJPEG: () => Buffer.from('JPEG', 'utf8'),
    };
}

const EXPECTED_DATA_URL = `data:image/jpeg;base64,${Buffer.from(
    'JPEG',
    'utf8',
).toString('base64')}`;

// `    WallPaper    REG_SZ    C:\pictures\one.jpg`, CRLF like the real thing.
function genRegistryOutput(rows: [string, string][]) {
    return [
        '',
        'HKEY_CURRENT_USER\\Control Panel\\Desktop',
        ...rows.map(([name, data]) => `    ${name}    REG_SZ    ${data}`),
        '',
    ].join('\r\n');
}

const WALLPAPER_FILE_PATH = 'C:\\pictures\\one.jpg';

beforeEach(async () => {
    vi.useFakeTimers();
    definePlatform('win32');
    mocks.getPath.mockReturnValue('/appdata');
    mocks.statSync.mockReturnValue({ size: 1000 });
    mocks.readdirSync.mockReturnValue([]);
    mocks.createFromPath.mockReturnValue(genImage());
    answerCommand((_command, args) => {
        if (args.includes('HKCU\\Control Panel\\Colors')) {
            return genRegistryOutput([['Background', '0 0 0']]);
        }
        return genRegistryOutput([
            ['WallPaper', WALLPAPER_FILE_PATH],
            ['WallpaperStyle', '10'],
            ['TileWallpaper', '0'],
        ]);
    });
    // The held wallpaper is module state, which is half of what is under test.
    vi.resetModules();
    helpers = await import('./displayWallpaperHelpers');
});

afterEach(() => {
    vi.useRealTimers();
    definePlatform(originalPlatform);
});

describe('on Windows', () => {
    test('reads the wallpaper the registry names, with its layout', async () => {
        const wallpaper = await helpers.readDisplayWallpaper({
            displayIndex: 0,
        });
        expect(mocks.createFromPath).toHaveBeenCalledWith(WALLPAPER_FILE_PATH);
        expect(wallpaper).toEqual({
            imageDataUrl: EXPECTED_DATA_URL,
            color: 'rgb(0, 0, 0)',
            fit: 'cover',
        });
    });

    test('a tiled desktop is reported as tiled', async () => {
        answerCommand(() =>
            genRegistryOutput([
                ['WallPaper', WALLPAPER_FILE_PATH],
                ['WallpaperStyle', '0'],
                ['TileWallpaper', '1'],
            ]),
        );
        const wallpaper = await helpers.readDisplayWallpaper({
            displayIndex: 0,
        });
        expect(wallpaper?.fit).toBe('tile');
    });

    test.each([
        ['6', 'contain'],
        ['2', 'fill'],
        ['0', 'center'],
    ])('maps Windows wallpaper style %s to %s', async (style, fit) => {
        answerCommand(() =>
            genRegistryOutput([
                ['WallPaper', WALLPAPER_FILE_PATH],
                ['WallpaperStyle', style],
            ]),
        );
        expect(await helpers.readDisplayWallpaper({ displayIndex: 0 })).toEqual(
            {
                imageDataUrl: EXPECTED_DATA_URL,
                color: null,
                fit,
            },
        );
    });

    test.each(['0 0', '0 invalid 0'])(
        'ignores malformed background color %s while keeping the image',
        async (background) => {
            answerCommand((_command, args) =>
                genRegistryOutput(
                    args.includes('HKCU\\Control Panel\\Colors')
                        ? [['Background', background]]
                        : [['WallPaper', WALLPAPER_FILE_PATH]],
                ),
            );
            expect(
                await helpers.readDisplayWallpaper({ displayIndex: 0 }),
            ).toEqual({
                imageDataUrl: EXPECTED_DATA_URL,
                color: null,
                fit: 'cover',
            });
        },
    );

    test('falls back to the registry image when the monitor cache folder is unavailable', async () => {
        mocks.readdirSync.mockImplementation(() => {
            throw new Error('unavailable');
        });
        const wallpaper = await helpers.readDisplayWallpaper({
            displayIndex: 0,
            sizes: [{ width: 1920, height: 1080 }],
        });
        expect(mocks.createFromPath).toHaveBeenCalledExactlyOnceWith(
            WALLPAPER_FILE_PATH,
        );
        expect(wallpaper?.imageDataUrl).toBe(EXPECTED_DATA_URL);
    });

    test('keeps the desktop color when the wallpaper file cannot be read', async () => {
        mocks.statSync.mockImplementation(() => {
            throw new Error('missing file');
        });
        expect(await helpers.readDisplayWallpaper({ displayIndex: 0 })).toEqual(
            {
                imageDataUrl: null,
                color: 'rgb(0, 0, 0)',
                fit: 'cover',
            },
        );
        expect(mocks.createFromPath).not.toHaveBeenCalled();
    });

    test("a monitor's own pre-fitted copy wins, and is drawn edge to edge", async () => {
        mocks.readdirSync.mockReturnValue([
            'CachedImage_1920_1080_POS4.jpg',
            'CachedImage_2560_1440_POS2.jpg',
        ]);
        const wallpaper = await helpers.readDisplayWallpaper({
            displayIndex: 1,
            sizes: [{ width: 2560, height: 1440 }],
        });
        expect(mocks.createFromPath).toHaveBeenCalledWith(
            path.join(
                '/appdata',
                'Microsoft',
                'Windows',
                'Themes',
                'CachedFiles',
                'CachedImage_2560_1440_POS2.jpg',
            ),
        );
        expect(wallpaper?.fit).toBe('fill');
    });

    test('two monitors of the SAME size are ambiguous and are not guessed at', async () => {
        mocks.readdirSync.mockReturnValue([
            'CachedImage_1920_1080_POS2.jpg',
            'CachedImage_1920_1080_POS4.jpg',
        ]);
        await helpers.readDisplayWallpaper({
            displayIndex: 1,
            sizes: [{ width: 1920, height: 1080 }],
        });
        expect(mocks.createFromPath).toHaveBeenCalledWith(WALLPAPER_FILE_PATH);
    });

    test('a desktop with no picture on it is still its colour', async () => {
        mocks.createFromPath.mockReturnValue({ isEmpty: () => true });
        const wallpaper = await helpers.readDisplayWallpaper({
            displayIndex: 0,
        });
        expect(wallpaper).toEqual({
            imageDataUrl: null,
            color: 'rgb(0, 0, 0)',
            fit: 'cover',
        });
    });

    test('a machine that says nothing at all answers null', async () => {
        answerCommand(() => null);
        mocks.createFromPath.mockReturnValue({ isEmpty: () => true });
        await expect(
            helpers.readDisplayWallpaper({ displayIndex: 0 }),
        ).resolves.toBeNull();
    });

    test('a file too big to be a wallpaper is not decoded', async () => {
        mocks.statSync.mockReturnValue({ size: 64 * 1024 * 1024 });
        const wallpaper = await helpers.readDisplayWallpaper({
            displayIndex: 0,
        });
        expect(mocks.createFromPath).not.toHaveBeenCalled();
        expect(wallpaper?.imageDataUrl).toBeNull();
    });
});

describe('what it holds', () => {
    test('overlapping reads leave one expiry timer and release the cached image', async () => {
        const wallpapers = await Promise.all([
            helpers.readDisplayWallpaper({ displayIndex: 0 }),
            helpers.readDisplayWallpaper({ displayIndex: 0 }),
        ]);
        expect(wallpapers[0]).toEqual(wallpapers[1]);
        expect(vi.getTimerCount()).toBe(1);
        mocks.execFile.mockClear();
        await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
        expect(vi.getTimerCount()).toBe(0);
        await helpers.readDisplayWallpaper({ displayIndex: 0 });
        expect(mocks.execFile).toHaveBeenCalledTimes(2);
    });

    test('does not upscale an image already smaller than the requested width', async () => {
        const image = genImage(100);
        mocks.createFromPath.mockReturnValue(image);
        const wallpaper = await helpers.readDisplayWallpaper({
            displayIndex: 0,
            width: 400,
        });
        expect(image.resize).not.toHaveBeenCalled();
        expect(wallpaper?.imageDataUrl).toBe(EXPECTED_DATA_URL);
    });

    test('a second card on the same display spawns nothing', async () => {
        await helpers.readDisplayWallpaper({ displayIndex: 0 });
        mocks.execFile.mockClear();
        await helpers.readDisplayWallpaper({ displayIndex: 0 });
        expect(mocks.execFile).not.toHaveBeenCalled();
    });

    test('another display is read on its own', async () => {
        await helpers.readDisplayWallpaper({ displayIndex: 0 });
        mocks.execFile.mockClear();
        await helpers.readDisplayWallpaper({ displayIndex: 1 });
        expect(mocks.execFile).toHaveBeenCalled();
    });

    test('the picture is RELEASED once the hold passes', async () => {
        await helpers.readDisplayWallpaper({ displayIndex: 0 });
        mocks.execFile.mockClear();
        await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1);
        await helpers.readDisplayWallpaper({ displayIndex: 0 });
        expect(mocks.execFile).toHaveBeenCalled();
    });

    test('Refresh Preview forgets it so a changed desktop is picked up', async () => {
        await helpers.readDisplayWallpaper({ displayIndex: 0 });
        mocks.execFile.mockClear();
        helpers.forgetDisplayWallpapers();
        await helpers.readDisplayWallpaper({ displayIndex: 0 });
        expect(mocks.execFile).toHaveBeenCalled();
    });

    test('the asked-for width is clamped, never passed through', async () => {
        const image = genImage();
        mocks.createFromPath.mockReturnValue(image);
        await helpers.readDisplayWallpaper({ displayIndex: 0, width: 99999 });
        expect(image.resize).toHaveBeenCalledWith({ width: 640 });
    });
});

describe('on macOS', () => {
    beforeEach(async () => {
        definePlatform('darwin');
        answerCommand(() => '/Users/x/one.jpg, /Users/x/two.jpg\n');
        vi.resetModules();
        helpers = await import('./displayWallpaperHelpers');
    });

    test.each([null, ''])(
        'returns no wallpaper when the desktop lookup returns %s',
        async (stdout) => {
            answerCommand(() => stdout);
            await expect(
                helpers.readDisplayWallpaper({ displayIndex: 0 }),
            ).resolves.toBeNull();
            expect(mocks.statSync).not.toHaveBeenCalled();
            expect(mocks.createFromPath).not.toHaveBeenCalled();
        },
    );

    test('takes the picture of the desktop at this display position', async () => {
        await helpers.readDisplayWallpaper({ displayIndex: 1 });
        expect(mocks.createFromPath).toHaveBeenCalledWith('/Users/x/two.jpg');
    });

    test('falls back to the first desktop for a position it has none for', async () => {
        await helpers.readDisplayWallpaper({ displayIndex: 5 });
        expect(mocks.createFromPath).toHaveBeenCalledWith('/Users/x/one.jpg');
    });
});

describe('on Linux', () => {
    beforeEach(async () => {
        definePlatform('linux');
        answerCommand((_command, args) => {
            if (args.includes('primary-color')) {
                return "'#2e3436'\n";
            }
            return "'file:///usr/share/back%20ground.jpg'\n";
        });
        vi.resetModules();
        helpers = await import('./displayWallpaperHelpers');
    });

    test.each([null, "''", "'https://example.com/wallpaper.jpg'"])(
        'uses only the color when the picture URI is %s',
        async (uri) => {
            answerCommand((_command, args) =>
                args.includes('primary-color') ? "'#2e3436'" : uri,
            );
            expect(
                await helpers.readDisplayWallpaper({ displayIndex: 0 }),
            ).toEqual({
                imageDataUrl: null,
                color: '#2e3436',
                fit: 'cover',
            });
            expect(mocks.statSync).not.toHaveBeenCalled();
            expect(mocks.createFromPath).not.toHaveBeenCalled();
        },
    );

    test('decodes the GNOME picture URI and keeps the primary colour', async () => {
        const wallpaper = await helpers.readDisplayWallpaper({
            displayIndex: 0,
        });
        expect(mocks.createFromPath).toHaveBeenCalledWith(
            '/usr/share/back ground.jpg',
        );
        expect(wallpaper?.color).toBe('#2e3436');
    });
});
