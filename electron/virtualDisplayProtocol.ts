// Virtual Displays: shared types and pure helpers. No Electron, renderer or
// filesystem dependencies, so the main process, the compositor page and the
// panel all import the same rules.
import {
    MIRROR_REMOTE_DISPLAY_FIRST,
    toMirrorHostPort,
    type MirrorAddressKind,
    type MirrorRouterStatus,
    type MirrorScreenContext,
} from './screenMirrorProtocol';

// Display ids between the real monitors (positive) and Screen Mirror's guest
// monitors (-1000000 and below). A virtual display's id is this base minus its
// number, so number 1 is -500001.
export const VIRTUAL_DISPLAY_ID_BASE = -500000;
export const MAX_VIRTUAL_DISPLAYS = 8;
export const VIRTUAL_DISPLAY_MIN_SIDE = 160;
export const VIRTUAL_DISPLAY_MAX_SIDE = 3840;
// 4K in either orientation, never more pixels than that.
export const VIRTUAL_DISPLAY_MAX_PIXELS = 3840 * 2160;
export const VIRTUAL_DISPLAY_NAME_MAX = 64;
export const VIRTUAL_DISPLAY_SETTING_KEY = 'virtual-displays';
export const VIRTUAL_DISPLAY_SHARE_KEY = 'virtual-display-share';

export const RESOLUTION_PRESETS: ReadonlyArray<{
    width: number;
    height: number;
}> = [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
    { width: 3840, height: 2160 },
    { width: 1080, height: 1920 },
    { width: 1024, height: 768 },
];

export const VIRTUAL_DISPLAY_IMAGE_EXTENSIONS = [
    'png',
    'jpg',
    'jpeg',
    'gif',
    'webp',
    'bmp',
    'svg',
    'avif',
];
export const VIRTUAL_DISPLAY_VIDEO_EXTENSIONS = [
    'mp4',
    'webm',
    'mov',
    'm4v',
    'ogv',
    'mkv',
];

export type VirtualDisplayWallpaper =
    | { kind: 'none' }
    | { kind: 'color'; color: string }
    | { kind: 'image' | 'video'; filePath: string };
export type VirtualDisplayRecord = {
    number: number;
    name: string;
    width: number;
    height: number;
    wallpaper: VirtualDisplayWallpaper;
};
export type VirtualDisplaySetting = {
    // Numbers are never handed out twice: a screen remembers its display by
    // id, and an old link or QR code names the number.
    nextNumber: number;
    list: VirtualDisplayRecord[];
};
// Where a viewer came from.
export type VirtualDisplayNetwork = 'this-computer' | 'local' | 'internet';
export type VirtualDisplayClient = {
    id: string;
    // A browser drawing the display itself, or a player taking the MP4.
    kind: 'web' | 'video';
    address: string;
    network: VirtualDisplayNetwork;
    userAgent: string;
    since: number;
    isPreview: boolean;
    // A browser this computer lets scroll and pick verses in the app, as a
    // hand on the projector's own window would. Off until the operator turns
    // it on, for each connection; never for an MP4 player.
    isInteractive: boolean;
};
// A viewer the operator disconnected, kept out for a while: a browser by its
// own id (others at the same address -- a whole church behind one router --
// are not touched), a media player, which has none, by its address.
export type VirtualDisplayBlockedClient = {
    key: string;
    kind: 'web' | 'video';
    address: string;
    until: number;
};
export type VirtualDisplayStreamStatus = 'idle' | 'starting' | 'live' | 'error';
export type VirtualDisplayInfo = VirtualDisplayRecord & {
    displayId: number;
    screenIds: number[];
    stream: VirtualDisplayStreamStatus;
    error: string | null;
    mimeType: string | null;
    isWallpaperMissing: boolean;
    clients: VirtualDisplayClient[];
    blocked: VirtualDisplayBlockedClient[];
};
export type VirtualDisplayAddress = {
    host: string;
    port: number;
    kind: 'this-computer' | MirrorAddressKind;
};
export type VirtualDisplayState = {
    available: boolean;
    error: string | null;
    port: number;
    shareEnabled: boolean;
    internetEnabled: boolean;
    router: MirrorRouterStatus;
    addresses: VirtualDisplayAddress[];
    displays: VirtualDisplayInfo[];
};
// What the compositor page is told to draw.
export type VirtualDisplayCompositorConfig = {
    number: number;
    width: number;
    height: number;
    wallpaper:
        | { kind: 'none' }
        | { kind: 'color'; color: string }
        | { kind: 'image' | 'video'; filePath: string };
    screens: { screenId: number; src: string }[];
};
// What a browser viewer draws: the display's size and wallpaper, and the
// screens stacked on it, last on top.
export type VirtualDisplayLayout = {
    number: number;
    name: string;
    width: number;
    height: number;
    wallpaper:
        | { kind: 'none' }
        | { kind: 'color'; color: string }
        | { kind: 'image' | 'video'; url: string };
    screenIds: number[];
    // The viewer page's few words, in the app's language.
    labels: Record<string, string>;
};
// A screen page in a browser: its context, and the display it is on (the page
// asks for "the displays" and is answered with this one).
export type VirtualDisplayWebContext = MirrorScreenContext & {
    display: { id: number; label: string; width: number; height: number };
    // This computer as Screen Mirror knows it: a browser asks for a camera on
    // the screen as `mirror-camera:<hostId>:<camera>` (`toVirtualDisplayCameraId`).
    hostId: string;
};
// Over a viewer's WebSocket, host to page.
export type VirtualDisplayWebPacket =
    | { type: 'layout'; layout: VirtualDisplayLayout }
    | { type: 'context'; context: VirtualDisplayWebContext }
    | { type: 'context-update'; data: Partial<MirrorScreenContext> }
    | {
          type: 'message';
          message: { screenId: number; type: string; data: any };
      };
export type VirtualDisplayEncodeOptions = {
    generation: number;
    width: number;
    height: number;
    frameRate: number;
};

export function toVirtualDisplayId(number: number) {
    return VIRTUAL_DISPLAY_ID_BASE - number;
}

export function isVirtualDisplayId(id: unknown): id is number {
    return (
        typeof id === 'number' &&
        Number.isInteger(id) &&
        id < VIRTUAL_DISPLAY_ID_BASE &&
        id > MIRROR_REMOTE_DISPLAY_FIRST
    );
}

export function toVirtualDisplayNumber(id: unknown) {
    return isVirtualDisplayId(id) ? VIRTUAL_DISPLAY_ID_BASE - id : null;
}

function toEven(value: number) {
    return Math.round(value / 2) * 2;
}

// H.264 4:2:0 needs even sides; the sizes a compositor window and an encoder
// can be trusted with.
export function clampResolution(width: unknown, height: unknown) {
    const clampSide = (value: unknown, fallback: number) => {
        // `Number(null)` is 0: only a real number or numeric text counts.
        const number =
            typeof value === 'number'
                ? value
                : typeof value === 'string' && value.trim() !== ''
                  ? Number(value)
                  : Number.NaN;
        if (!Number.isFinite(number)) {
            return fallback;
        }
        return toEven(
            Math.min(
                VIRTUAL_DISPLAY_MAX_SIDE,
                Math.max(VIRTUAL_DISPLAY_MIN_SIDE, Math.round(number)),
            ),
        );
    };
    let w = clampSide(width, 1920);
    let h = clampSide(height, 1080);
    if (w * h > VIRTUAL_DISPLAY_MAX_PIXELS) {
        const scale = Math.sqrt(VIRTUAL_DISPLAY_MAX_PIXELS / (w * h));
        // Down to an even number: rounding up could pass the cap again.
        w = Math.floor((w * scale) / 2) * 2;
        h = Math.floor((h * scale) / 2) * 2;
    }
    return { width: w, height: h };
}

function toExtension(filePath: string) {
    const match = /\.([a-z0-9]+)$/i.exec(filePath);
    return match ? match[1].toLowerCase() : '';
}

function checkIsAbsolutePath(filePath: string) {
    return /^(?:[a-zA-Z]:[\\/]|\\\\|\/)/.test(filePath);
}

export function sanitizeWallpaper(value: unknown): VirtualDisplayWallpaper {
    const data = value as Record<string, unknown> | null;
    if (!data || typeof data !== 'object') {
        return { kind: 'none' };
    }
    if (
        data.kind === 'color' &&
        typeof data.color === 'string' &&
        /^#[0-9a-f]{6}$/i.test(data.color)
    ) {
        return { kind: 'color', color: data.color.toLowerCase() };
    }
    if (
        (data.kind === 'image' || data.kind === 'video') &&
        typeof data.filePath === 'string' &&
        data.filePath.length <= 4096 &&
        checkIsAbsolutePath(data.filePath)
    ) {
        const extensions =
            data.kind === 'image'
                ? VIRTUAL_DISPLAY_IMAGE_EXTENSIONS
                : VIRTUAL_DISPLAY_VIDEO_EXTENSIONS;
        if (extensions.includes(toExtension(data.filePath))) {
            return { kind: data.kind, filePath: data.filePath };
        }
    }
    return { kind: 'none' };
}

export function sanitizeVirtualDisplayName(name: unknown, number: number) {
    const text =
        typeof name === 'string'
            ? name
                  .replace(/\s+/g, ' ')
                  .trim()
                  .slice(0, VIRTUAL_DISPLAY_NAME_MAX)
            : '';
    return text || `Virtual Display ${number}`;
}

export function sanitizeVirtualDisplayRecord(
    value: unknown,
): VirtualDisplayRecord | null {
    const data = value as Record<string, unknown> | null;
    if (!data || typeof data !== 'object') {
        return null;
    }
    const number = Number(data.number);
    if (!Number.isInteger(number) || number < 1 || number > 9999) {
        return null;
    }
    const { width, height } = clampResolution(data.width, data.height);
    return {
        number,
        name: sanitizeVirtualDisplayName(data.name, number),
        width,
        height,
        wallpaper: sanitizeWallpaper(data.wallpaper),
    };
}

export function readVirtualDisplaySetting(
    text: string | null | undefined,
): VirtualDisplaySetting {
    let data: any;
    try {
        data = JSON.parse(text || 'null');
    } catch {
        data = null;
    }
    const list: VirtualDisplayRecord[] = [];
    const seen = new Set<number>();
    for (const item of Array.isArray(data?.list) ? data.list : []) {
        const record = sanitizeVirtualDisplayRecord(item);
        if (
            record === null ||
            seen.has(record.number) ||
            list.length >= MAX_VIRTUAL_DISPLAYS
        ) {
            continue;
        }
        seen.add(record.number);
        list.push(record);
    }
    const highest = list.reduce((max, item) => Math.max(max, item.number), 0);
    const nextNumber = Number(data?.nextNumber);
    return {
        nextNumber:
            Number.isInteger(nextNumber) && nextNumber > highest
                ? Math.min(nextNumber, 9999)
                : highest + 1,
        list,
    };
}

export function toVirtualDisplayStreamPath(number: number) {
    return `/vd/${number}/video`;
}

// The page a browser opens to watch a display.
export function toVirtualDisplayPagePath(number: number) {
    return `/vd/${number}/`;
}

// What a person touching a virtual display's browser page may tell the app:
// a verse tapped and a page scrolled -- what a hand on the projector's own
// window sends. Never `visible` (it hides the screen), `init` (the presenter
// sends everything again) or a video clock. Rebuilt from checked fields, so
// nothing else a viewer adds is passed on.
export const VIRTUAL_DISPLAY_VIEWER_FEEDBACK_TYPES = new Set([
    'bible-screen-view-selected-index',
    'sync-scroll-percentage',
]);
// The only containers a screen page scrolls (bible, and a slide too tall for
// the screen); the presenter looks the selector up inside that screen alone.
const VIEWER_SCROLL_SELECTORS = new Set([
    '.screen-bible-container-scroll',
    '.half-scale-container',
]);

export type VirtualDisplayViewerFeedback =
    | {
          type: 'bible-screen-view-selected-index';
          data: { selectedKJVVerseKey: string | null };
      }
    | {
          type: 'sync-scroll-percentage';
          data: {
              domSelector: string;
              scroll: { x: number; y: number };
              isSubPixel?: true;
          };
      };

export function readVirtualDisplayViewerFeedback(
    value: unknown,
): VirtualDisplayViewerFeedback | null {
    if (value === null || typeof value !== 'object') {
        return null;
    }
    const { type, data } = value as { type?: unknown; data?: any };
    if (data === null || typeof data !== 'object') {
        return null;
    }
    if (type === 'bible-screen-view-selected-index') {
        const key = data.selectedKJVVerseKey;
        if (
            key === null ||
            (typeof key === 'string' && /^[\w .:-]{1,64}$/.test(key))
        ) {
            return { type, data: { selectedKJVVerseKey: key } };
        }
        return null;
    }
    if (type === 'sync-scroll-percentage') {
        const { domSelector, scroll, isSubPixel } = data;
        const isFraction = (number: unknown) => {
            return (
                typeof number === 'number' &&
                Number.isFinite(number) &&
                number >= 0 &&
                number <= 1
            );
        };
        if (
            !VIEWER_SCROLL_SELECTORS.has(domSelector) ||
            scroll === null ||
            typeof scroll !== 'object' ||
            !isFraction(scroll.x) ||
            !isFraction(scroll.y)
        ) {
            return null;
        }
        return {
            type,
            data: {
                domSelector,
                scroll: { x: scroll.x, y: scroll.y },
                ...(isSubPixel === true ? { isSubPixel: true as const } : {}),
            },
        };
    }
    return null;
}

// The cameras one screen message puts on a screen: a foreground overlay's
// (`cameraDataList`), or a camera background. A browser watching a virtual
// display may ask this computer for these cameras and no other -- what the
// operator put up, not every camera on the machine. Null for a message that
// says nothing about cameras.
export type ScreenCameraType = { id: string; label: string };
export function readScreenMessageCameras(message: {
    type?: unknown;
    data?: any;
}): { layer: 'foreground' | 'background'; cameras: ScreenCameraType[] } | null {
    const toCamera = (id: unknown, label: unknown) => {
        return typeof id === 'string' && id !== '' && id.length <= 512
            ? { id, label: typeof label === 'string' ? label : '' }
            : null;
    };
    if (message.type === 'foreground') {
        const list = message.data?.cameraDataList;
        return {
            layer: 'foreground',
            cameras: (Array.isArray(list) ? list : [])
                .map((item: any) => toCamera(item?.id, item?.label))
                .filter((item): item is ScreenCameraType => item !== null),
        };
    }
    if (message.type === 'background') {
        const data = message.data;
        const camera =
            data?.type === 'camera' ? toCamera(data.src, data.label) : null;
        return { layer: 'background', cameras: camera ? [camera] : [] };
    }
    return null;
}

// How a browser viewer names one of this computer's cameras: Screen Mirror's
// remote-camera form, so the screen page asks for a stream instead of a
// device it does not have.
export function toVirtualDisplayCameraId(hostId: string, cameraId: string) {
    return `mirror-camera:${hostId}:${cameraId}`;
}

// The two pages, and what each is told in its address.
const DEV_VIEWER_PAGE_QUERY_KEYS = new Map([
    ['/virtual-display-viewer.html', new Set(['preview'])],
    ['/vd-screen.html', new Set(['vd', 'screenId', 'viewer', 'preview'])],
]);
const DEV_VIEWER_PATHS = new Set([
    '/src/virtual-display-viewer.ts',
    '/src/vd-screen.ts',
    '/@vite/client',
    '/@vite/env',
    '/@react-refresh',
]);
// What Vite adds to a module address: a cache stamp, and "load this as a
// module / as its URL". Anything else (`raw`, `inline`, a doubled `?`) is
// how Vite's file rules have been slipped before, so it is refused.
const DEV_VIEWER_QUERY_KEYS = new Set(['t', 'v', 'import', 'url']);

// A browser on this network watching a virtual display of a DEVELOPMENT
// build: its code comes from the Vite dev server one module at a time, so
// only what that page's module graph asks for passes -- the app's sources,
// the prebundled packages, the two protocol files and the Vite client. Never
// the rest of the dev server, which hands any file it can read to whoever
// asks. `appPath` is the repository root (`app.getAppPath()` in development).
export function checkIsVirtualDisplayDevViewerFile(url: URL, appPath: string) {
    let pathname: string;
    try {
        pathname = decodeURIComponent(url.pathname);
    } catch {
        return false;
    }
    if (/(?:^|\/)\.\.(?:\/|$)|\\|\0|\/\/|\?/.test(pathname)) {
        return false;
    }
    const pageKeys = DEV_VIEWER_PAGE_QUERY_KEYS.get(pathname);
    for (const key of url.searchParams.keys()) {
        if (!(pageKeys ?? DEV_VIEWER_QUERY_KEYS).has(key)) {
            return false;
        }
    }
    if (
        pageKeys !== undefined ||
        DEV_VIEWER_PATHS.has(pathname) ||
        pathname.startsWith('/@id/__x00__vite/') ||
        /^\/assets\/[\w.-]+$/.test(pathname)
    ) {
        return true;
    }
    const root = `/@fs/${appPath.replace(/\\/g, '/').replace(/\/+$/, '')}/`;
    if (!pathname.startsWith(root)) {
        return false;
    }
    return /^(?:src\/|node_modules\/(?:\.vite\/deps\/|[^./])|tools\/owa-devtools-mcp\/[\w-]+\.mjs$|electron\/(?:screenMirrorProtocol|virtualDisplayProtocol)\.ts$)/.test(
        pathname.slice(root.length),
    );
}

// `/vd/<n>/` the page, `/vd/<n>/video` the MP4, `/vd/<n>/ws` a viewer's
// socket; nothing else.
export function parseVirtualDisplayPath(pathname: string) {
    const match = /^\/vd\/(\d{1,4})(\/|\/video|\/ws)?$/.exec(pathname);
    if (match === null) {
        return null;
    }
    const number = Number(match[1]);
    if (number < 1) {
        return null;
    }
    const kind =
        match[2] === '/video' ? 'video' : match[2] === '/ws' ? 'ws' : 'page';
    return { number, kind } as const;
}

export function parseVirtualDisplayStreamPath(pathname: string) {
    const match = /^\/vd\/(\d{1,4})\/video$/.exec(pathname);
    if (match === null) {
        return null;
    }
    const number = Number(match[1]);
    return number >= 1 ? number : null;
}

export function toVirtualDisplayStreamUrl(
    address: { host: string; port: number },
    number: number,
) {
    return `http://${toMirrorHostPort(address.host, address.port)}${toVirtualDisplayStreamPath(number)}`;
}

export function toVirtualDisplayPageUrl(
    address: { host: string; port: number },
    number: number,
) {
    return `http://${toMirrorHostPort(address.host, address.port)}${toVirtualDisplayPagePath(number)}`;
}

// The order the H.264 encoder is tried in: High, Main, then Baseline, at the
// level the size needs (4.0 up to 1080p, 5.1 above).
export function listVirtualDisplayVideoCodecs(width: number, height: number) {
    const level = width * height > 1920 * 1080 ? '33' : '28';
    return [`avc1.6400${level}`, `avc1.4D00${level}`, `avc1.42E0${level}`];
}

// About 0.07 bit per pixel per frame: 1080p30 is ~4.4 Mbps, capped at 8.
export function toVirtualDisplayBitrate(
    width: number,
    height: number,
    frameRate: number,
) {
    return Math.round(
        Math.min(
            8_000_000,
            Math.max(800_000, width * height * frameRate * 0.07),
        ),
    );
}
