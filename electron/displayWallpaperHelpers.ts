import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import { app, nativeImage } from 'electron';

/**
 * The DESKTOP BACKGROUND of a monitor — the wallpaper itself, read from the
 * operating system, never a photograph of the screen.
 *
 * The mini screen previewer draws this behind everything it renders. A screen
 * window is `transparent: true`, so wherever the app puts nothing the audience
 * sees that monitor's desktop; the checkered pattern the card used to draw was a
 * stand-in for exactly this.
 *
 * `desktopCapturer` was the obvious way in and is the wrong one: it can only
 * photograph a display AS COMPOSITED, so it drags in every other window that
 * happens to be up — the app itself, for a screen assigned to the machine's own
 * monitor — and it has to be retaken to stay honest. The wallpaper is a FILE. It
 * is read once, holds still, contains nobody's windows, and costs nothing to
 * keep.
 */

const execFileAsync = promisify(execFile);

// A wallpaper changes about once a year. It is re-read when a card is mounted
// afresh and on Refresh Preview; this cache only stops a burst of cards each
// spawning their own `reg query`, and it is DROPPED on a timer so an idle app
// holds no picture.
const CACHE_TTL_MILLISECOND = 5 * 60 * 1000;
const COMMAND_TIMEOUT_MILLISECOND = 3000;
const MIN_WIDTH = 64;
const MAX_WIDTH = 640;
// The backdrop is a photograph-like image, so JPEG; and every byte of it
// crosses the IPC and is then held as a base64 string by the card.
const JPEG_QUALITY = 70;
// A file this big is not a wallpaper. Decoding is the one expensive moment on
// this path and this app targets very low-spec machines.
const MAX_SOURCE_BYTES = 40 * 1024 * 1024;

const WINDOWS_DESKTOP_KEY = 'HKCU\\Control Panel\\Desktop';
const WINDOWS_COLORS_KEY = 'HKCU\\Control Panel\\Colors';
const WINDOWS_THEMES_PARTS = ['Microsoft', 'Windows', 'Themes'];

/** How the desktop is told to lay the picture out, in CSS terms. */
export type DisplayWallpaperFitType =
    'cover' | 'contain' | 'fill' | 'center' | 'tile';

export type DisplaySizeType = { width: number; height: number };

export type DisplayWallpaperType = {
    imageDataUrl: string | null;
    color: string | null;
    fit: DisplayWallpaperFitType;
};

type ReadWallpaperType = {
    filePath: string | null;
    color: string | null;
    fit: DisplayWallpaperFitType;
};

type CacheEntryType = {
    wallpaper: DisplayWallpaperType | null;
    timeoutId: NodeJS.Timeout;
};

const cacheMap = new Map<string, CacheEntryType>();

function holdInCache(cacheKey: string, wallpaper: DisplayWallpaperType | null) {
    const previous = cacheMap.get(cacheKey);
    if (previous !== undefined) {
        clearTimeout(previous.timeoutId);
    }
    const timeoutId = setTimeout(() => {
        cacheMap.delete(cacheKey);
    }, CACHE_TTL_MILLISECOND);
    // Never hold the process open for a cache sweep.
    timeoutId.unref?.();
    cacheMap.set(cacheKey, { wallpaper, timeoutId });
}

async function runCommand(command: string, args: string[]) {
    try {
        const { stdout } = await execFileAsync(command, args, {
            timeout: COMMAND_TIMEOUT_MILLISECOND,
            windowsHide: true,
        });
        return stdout;
    } catch (_error) {
        // Every reader below is best-effort by design: a machine that will not
        // answer keeps the previewer's pattern rather than raising anything.
        return null;
    }
}

// -- Windows -----------------------------------------------------------------

/**
 * `reg query` prints `    <name>    REG_SZ    <data>`. Split on `/\r?\n/`: the
 * output is CRLF and an anchored regex silently matches nothing otherwise.
 */
function readRegistryValues(stdout: string) {
    const valueMap = new Map<string, string>();
    for (const line of stdout.split(/\r?\n/)) {
        const matched = /^\s+(\S+)\s+REG_\w+\s{2,}(.*)$/.exec(line);
        if (matched !== null) {
            valueMap.set(matched[1].toLowerCase(), matched[2].trim());
        }
    }
    return valueMap;
}

function toWindowsFit(valueMap: Map<string, string>): DisplayWallpaperFitType {
    if (valueMap.get('tilewallpaper') === '1') {
        return 'tile';
    }
    switch (valueMap.get('wallpaperstyle')) {
        case '6':
            return 'contain';
        case '2':
            return 'fill';
        case '0':
            return 'center';
        // 10 = Fill, 22 = Span, and anything unknown.
        default:
            return 'cover';
    }
}

function toWindowsColor(background: string | undefined) {
    // `HKCU\Control Panel\Colors\Background` is a space-separated RGB triplet.
    if (background === undefined) {
        return null;
    }
    const parts = background.trim().split(/\s+/).map(Number);
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
        return null;
    }
    return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
}

function toWindowsThemesPath(...parts: string[]) {
    return path.join(app.getPath('appData'), ...WINDOWS_THEMES_PARTS, ...parts);
}

/**
 * Windows renders a copy of each monitor's wallpaper, already cropped to that
 * monitor and named with its pixel size. When exactly one of them is this
 * display's size it is the best answer there is: per-monitor AND pre-fitted, so
 * it is drawn edge to edge. Two monitors of the same size are ambiguous and fall
 * through to the one-wallpaper path rather than guess.
 */
function findWindowsCachedWallpaper(sizes: DisplaySizeType[]) {
    const cachedDirPath = toWindowsThemesPath('CachedFiles');
    let fileNames: string[];
    try {
        fileNames = fs.readdirSync(cachedDirPath);
    } catch (_error) {
        return null;
    }
    for (const size of sizes) {
        const prefix = `cachedimage_${size.width}_${size.height}_`;
        const matched = fileNames.filter((fileName) => {
            return fileName.toLowerCase().startsWith(prefix);
        });
        if (matched.length === 1) {
            return path.join(cachedDirPath, matched[0]);
        }
    }
    return null;
}

async function readWindowsWallpaper(
    sizes: DisplaySizeType[],
): Promise<ReadWallpaperType> {
    const [desktopOut, colorsOut] = await Promise.all([
        runCommand('reg', ['query', WINDOWS_DESKTOP_KEY]),
        runCommand('reg', ['query', WINDOWS_COLORS_KEY, '/v', 'Background']),
    ]);
    const valueMap =
        desktopOut === null
            ? new Map<string, string>()
            : readRegistryValues(desktopOut);
    const color = toWindowsColor(
        colorsOut === null
            ? undefined
            : readRegistryValues(colorsOut).get('background'),
    );
    const cachedFilePath = findWindowsCachedWallpaper(sizes);
    if (cachedFilePath !== null) {
        return { filePath: cachedFilePath, color, fit: 'fill' };
    }
    const wallpaperPath = valueMap.get('wallpaper');
    return {
        filePath:
            wallpaperPath !== undefined && wallpaperPath !== ''
                ? wallpaperPath
                : toWindowsThemesPath('TranscodedWallpaper'),
        color,
        fit: toWindowsFit(valueMap),
    };
}

// -- macOS -------------------------------------------------------------------

async function readMacWallpaper(
    displayIndex: number,
): Promise<ReadWallpaperType> {
    const stdout = await runCommand('osascript', [
        '-e',
        'tell application "System Events" to get picture of every desktop',
    ]);
    if (stdout === null) {
        return { filePath: null, color: null, fit: 'cover' };
    }
    // One POSIX path per desktop, in the order the system lists the displays.
    const filePaths = stdout
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part !== '');
    return {
        filePath: filePaths[displayIndex] ?? filePaths[0] ?? null,
        color: null,
        fit: 'cover',
    };
}

// -- Linux -------------------------------------------------------------------

function toGSettingsValue(stdout: string | null) {
    if (stdout === null) {
        return null;
    }
    const trimmed = stdout.trim().replace(/^'/, '').replace(/'$/, '');
    return trimmed === '' ? null : trimmed;
}

async function readLinuxWallpaper(): Promise<ReadWallpaperType> {
    // GNOME only, deliberately: it is the desktop a church machine running
    // Linux is overwhelmingly on, and every other one keeps the pattern rather
    // than having a guess written for it here.
    const [uri, primaryColor] = await Promise.all([
        runCommand('gsettings', [
            'get',
            'org.gnome.desktop.background',
            'picture-uri',
        ]).then(toGSettingsValue),
        runCommand('gsettings', [
            'get',
            'org.gnome.desktop.background',
            'primary-color',
        ]).then(toGSettingsValue),
    ]);
    const filePrefix = 'file://';
    return {
        filePath:
            uri !== null && uri.startsWith(filePrefix)
                ? decodeURIComponent(uri.slice(filePrefix.length))
                : null,
        color: primaryColor,
        fit: 'cover',
    };
}

// -- Shared ------------------------------------------------------------------

function toImageDataUrl(filePath: string | null, width: number) {
    if (filePath === null) {
        return null;
    }
    try {
        if (fs.statSync(filePath).size > MAX_SOURCE_BYTES) {
            return null;
        }
    } catch (_error) {
        // No wallpaper file: a solid-colour desktop, or a path that has moved
        // on. The colour beside it is still an answer.
        return null;
    }
    const image = nativeImage.createFromPath(filePath);
    if (image.isEmpty()) {
        return null;
    }
    // `resize` with a width alone keeps the aspect ratio, so the card gets the
    // wallpaper's own shape and a few tens of kilobytes rather than a 4K frame.
    const resized =
        image.getSize().width > width ? image.resize({ width }) : image;
    return `data:image/jpeg;base64,${resized
        .toJPEG(JPEG_QUALITY)
        .toString('base64')}`;
}

function toValidWidth(width: unknown) {
    const parsedWidth = Math.round(Number(width));
    if (!Number.isFinite(parsedWidth)) {
        return MIN_WIDTH;
    }
    return Math.min(Math.max(parsedWidth, MIN_WIDTH), MAX_WIDTH);
}

function readPlatformWallpaper(
    displayIndex: number,
    sizes: DisplaySizeType[],
): Promise<ReadWallpaperType> {
    if (process.platform === 'win32') {
        return readWindowsWallpaper(sizes);
    }
    if (process.platform === 'darwin') {
        return readMacWallpaper(displayIndex);
    }
    return readLinuxWallpaper();
}

/**
 * The desktop background of one monitor, as a picture the previewer can draw, a
 * colour, or null when this machine will not say — a desktop environment with no
 * reader here, a wallpaper file that has moved, a locked-down account. Null is
 * an answer, not a failure: the card draws its "nothing here" pattern.
 *
 * `displayIndex` and `sizes` come from the renderer, which already holds the
 * ordered display list: the platform readers key off a monitor's POSITION
 * (macOS) or its PIXEL SIZE (Windows), and resolving those here would mean
 * reaching for Electron's `screen` module from a helper that is loaded before
 * that is safe.
 */
export async function readDisplayWallpaper({
    displayIndex,
    width,
    sizes,
}: {
    displayIndex: number;
    width?: number;
    sizes?: DisplaySizeType[];
}): Promise<DisplayWallpaperType | null> {
    const validWidth = toValidWidth(width);
    const cacheKey = `${displayIndex}:${validWidth}`;
    const cached = cacheMap.get(cacheKey);
    if (cached !== undefined) {
        return cached.wallpaper;
    }
    const read = await readPlatformWallpaper(displayIndex, sizes ?? []);
    const imageDataUrl = toImageDataUrl(read.filePath, validWidth);
    const wallpaper =
        imageDataUrl === null && read.color === null
            ? null
            : { imageDataUrl, color: read.color, fit: read.fit };
    holdInCache(cacheKey, wallpaper);
    return wallpaper;
}

/**
 * A virtual display's own wallpaper, as the mini screen card draws a monitor's:
 * a small JPEG of the picture, a still of the video (never the video itself --
 * a card playing one is a decoder running for a thumbnail), or the colour.
 * Black when there is none, because black is what that display streams.
 */
export async function readVirtualDisplayWallpaper(
    wallpaper:
        | { kind: 'none' }
        | { kind: 'color'; color: string }
        | { kind: 'image' | 'video'; filePath: string },
    width?: number,
): Promise<DisplayWallpaperType> {
    const black = '#000000';
    if (wallpaper.kind === 'none') {
        return { imageDataUrl: null, color: black, fit: 'cover' };
    }
    if (wallpaper.kind === 'color') {
        return { imageDataUrl: null, color: wallpaper.color, fit: 'cover' };
    }
    const validWidth = toValidWidth(width);
    const cacheKey = `virtual:${wallpaper.kind}:${validWidth}:${wallpaper.filePath}`;
    const cached = cacheMap.get(cacheKey);
    if (cached?.wallpaper) {
        return cached.wallpaper;
    }
    let imageDataUrl: string | null = null;
    if (wallpaper.kind === 'image') {
        imageDataUrl = toImageDataUrl(wallpaper.filePath, validWidth);
    } else if (process.platform === 'win32' || process.platform === 'darwin') {
        try {
            const still = await nativeImage.createThumbnailFromPath(
                wallpaper.filePath,
                { width: validWidth, height: Math.round(validWidth * 0.75) },
            );
            imageDataUrl = still.isEmpty()
                ? null
                : `data:image/jpeg;base64,${still
                      .toJPEG(JPEG_QUALITY)
                      .toString('base64')}`;
        } catch (_error) {
            imageDataUrl = null;
        }
    }
    const result: DisplayWallpaperType = {
        imageDataUrl,
        color: black,
        fit: 'cover',
    };
    holdInCache(cacheKey, result);
    return result;
}

/** Forgets every held wallpaper — what Refresh Preview is asking for. */
export function forgetDisplayWallpapers() {
    for (const entry of cacheMap.values()) {
        clearTimeout(entry.timeoutId);
    }
    cacheMap.clear();
}
