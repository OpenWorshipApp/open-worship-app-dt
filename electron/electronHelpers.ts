import {
    app,
    dialog,
    nativeTheme,
    shell,
    clipboard,
    BrowserWindow,
    screen,
} from 'electron';
import type {
    WebPreferences,
    WindowOpenHandlerResponse,
    BrowserWindowConstructorOptions,
    HandlerDetails,
    WebContents,
    MenuItemConstructorOptions,
} from 'electron';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { release } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import appInfo from '../package.json';
// Cyclic on paper -- `ElectronSettingManager` imports `genTimeoutAttempt` from
// here -- but every use below is inside a function body, so neither module ever
// reads a half-initialised export of the other.
import ElectronSettingManager, {
    type PopupWinBoundsType,
} from './ElectronSettingManager';
import { htmlFiles } from './fsServe';
// Cyclic on paper for the same reason as the line above: this reaches
// `aiHelpers`, which imports `isDev`/`toUnpackedPath` from here. Every use on
// both sides is inside a function body.
import {
    checkIsCaptureUrlAllowed,
    guardCaptureWindow,
    prepareCaptureSession,
} from './webCaptureHelpers';

export type OptionalPromise<T> = T | Promise<T>;

export type CustomMenuItemType = {
    clickData?: any;
    submenu?: CustomMenuItemType[];
} & MenuItemConstructorOptions;
export type CustomMenusDataType = {
    tools?: CustomMenuItemType[];
    file?: CustomMenuItemType[];
    // The top-level **Insert** menu. Unlike `file`/`tools` it has no built-in
    // items of its own, so the whole menu disappears when nothing contributes —
    // which is what keeps it off the pages that have no canvas to insert into.
    insert?: CustomMenuItemType[];
    // Renderer-contributed **View** entries: the per-widget open/close
    // checkboxes and `Reset Widgets Size`. Only the main window contributes —
    // popups hide their menu bar, and a single owner is what keeps the click
    // routed back to the window whose widgets the items describe.
    view?: CustomMenuItemType[];
};

function parseEnvContent(content: string) {
    const env: Record<string, string> = {};
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }
        const match = /^(?:export\s+)?([\w.-]+)\s*=\s*(.*)$/.exec(line);
        if (match === null) {
            continue;
        }
        const key = match[1];
        let value = match[2].trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        env[key] = value;
    }
    return env;
}

function loadEnvFile() {
    try {
        const envFilePath = path.join(process.cwd(), '.env');
        if (!existsSync(envFilePath)) {
            return;
        }
        const content = readFileSync(envFilePath, 'utf-8');
        const env = parseEnvContent(content);
        for (const [key, value] of Object.entries(env)) {
            process.env[key] = value;
        }
    } catch (_error) {}
}

loadEnvFile();

function getPackInfo() {
    try {
        const packageInfo = require('../package-info.json');
        return packageInfo;
    } catch (_error) {
        return null;
    }
}

export const isDev = process.env.NODE_ENV === 'development';

export const isWindows = process.platform === 'win32';
export const isMac = process.platform === 'darwin';
export const isLinux = process.platform === 'linux';
// Electron's own marker for an MSIX/AppX install, set in the main process and
// in node-integrated renderers alike; `undefined` everywhere else.
export const isWindowsStore = isWindows && process.windowsStore === true;
const osRelease = release().toLowerCase();
export const isUbuntu = isLinux && osRelease.includes('ubuntu');
export const isFedora = isLinux && osRelease.includes('fedora');
/**
 * Whether this OS can put a real translucent backdrop BEHIND a window.
 *
 * Only the compositor can do this: a popup is its own OS window, so nothing
 * CSS does inside it can see the app window underneath. Windows 11 22H2 grew
 * `backgroundMaterial`, macOS has always had `vibrancy`; everywhere else the
 * window must stay opaque, because a window told to be see-through with no
 * backdrop to blur is just unreadable text over the desktop.
 */
function checkIsGlassCapable() {
    if (isMac) {
        return true;
    }
    if (!isWindows) {
        return false;
    }
    // `10.0.22621` -- the first build carrying the acrylic system backdrop.
    const buildNumber = Number(release().split('.')[2]);
    return !Number.isNaN(buildNumber) && buildNumber >= 22621;
}
export const isGlassCapable = checkIsGlassCapable();

export const isSecured = false; // TODO: make it secure
export const is64System = process.arch === 'x64';
export const isArm64 = process.arch === 'arm64';
export const commitHash = getPackInfo()?.commitHash ?? undefined;

export const messageChannels = {
    screenMessage: 'app:screen:message',
    openAboutPage: 'main:app:open-about-page',
    openChatbotPage: 'main:app:open-chatbot-page',
    openAiChatPage: 'main:app:open-aichat-page',
    guideHelp: 'main:app:guide-help',
    guideHelpAnswer: 'main:app:guide-help-answer',
    chatAttach: 'main:app:chat-attach',
};

/**
 * `entries` unpacks only those paths. A data archive can hold gigabytes of
 * media across several folders, and its manifest has to be read BEFORE the user
 * picks which of them to restore — so unpacking the whole thing to answer that
 * question would be minutes of I/O thrown away.
 */
export async function tarExtract(
    filePath: string,
    outputDir: string,
    entries?: string[],
) {
    const { x: tarX } = await import('tar');
    return await (tarX as any)({ file: filePath, cwd: outputDir }, entries);
}

/**
 * `excludeNamePatterns` are regex sources tested against each path SEGMENT, so
 * a matching folder takes everything under it out of the archive too. Used to
 * keep the regenerable per-document caches (`<doc>.histories`,
 * `<doc>.pdf-images`, `<doc>.pptx-htmls`, …) out of a data archive: they are
 * rebuilt on demand and together can dwarf the documents themselves.
 */
export async function tarCreate(
    inputDir: string,
    outputFilePath: string,
    files: string[],
    isGzip = false,
    excludeNamePatterns?: string[],
) {
    const { c: tarC } = await import('tar');
    const excludeRegexes = (excludeNamePatterns ?? []).map((pattern) => {
        return new RegExp(pattern);
    });
    const filter =
        excludeRegexes.length === 0
            ? undefined
            : (entryPath: string) => {
                  // tar hands over `/`-separated paths on every platform.
                  return !entryPath.split('/').some((segment) => {
                      return excludeRegexes.some((regex) => {
                          return regex.test(segment);
                      });
                  });
              };
    return await (tarC as any)(
        {
            cwd: inputDir,
            file: outputFilePath,
            gzip: isGzip,
            portable: true,
            filter,
        },
        files,
    );
}

/**
 * Append to an EXISTING uncompressed tar. A data archive is written straight
 * from the user's folders (no staging copy of gigabytes), which means its `cwd`
 * is their data directory and the manifest cannot be one of those entries — so
 * the manifest is appended afterwards from a temp dir. Only works on a plain
 * `.tar`; that is why a data archive is not gzipped (its media already is).
 */
export async function tarAppend(
    archiveFilePath: string,
    inputDir: string,
    files: string[],
) {
    const { r: tarR } = await import('tar');
    return await (tarR as any)(
        { file: archiveFilePath, cwd: inputDir, portable: true },
        files,
    );
}

interface ClosableInt {
    close: () => void;
}

export function toUnpackedPath(path: string) {
    return path.replace('app.asar', 'app.asar.unpacked');
}
export function attemptClosing(target?: ClosableInt | null) {
    try {
        target?.close();
    } catch (_error) {}
}

/**
 * A renderer that dies (`render-process-gone`) leaves its BrowserWindow as a
 * dead shell nothing revives — no navigation, no reload, only an app restart.
 * A renderer that HANGS (`unresponsive`) is worse: the window silently ignores
 * every click, and on the operator's machine mid-service that reads as "the
 * app is gone". Both get one recovery path here: reload the content, by force
 * (`forcefullyCrashRenderer` -> `render-process-gone` -> reload) when the
 * renderer cannot cooperate.
 *
 * The timestamp window caps a crash-loop: content that dies on every boot
 * would otherwise reload forever, burning the low-spec target machine.
 */
export function applyRendererRecovery(
    win: BrowserWindow,
    reloadContent: () => void,
) {
    const MAX_RELOADS = 3;
    const WINDOW_MILLIS = 30 * 1000;
    let reloadTimes: number[] = [];
    win.webContents.on('render-process-gone', (_event, details) => {
        if (details.reason === 'clean-exit') {
            return;
        }
        const now = Date.now();
        reloadTimes = reloadTimes.filter((time) => {
            return now - time < WINDOW_MILLIS;
        });
        if (reloadTimes.length >= MAX_RELOADS) {
            return;
        }
        reloadTimes.push(now);
        reloadContent();
    });
    win.on('unresponsive', async () => {
        const { response } = await dialog.showMessageBox(win, {
            type: 'warning',
            title: 'Window Not Responding',
            message: 'This window has stopped responding.',
            buttons: ['Reload', 'Wait'],
            defaultId: 0,
            cancelId: 1,
        });
        if (response === 0 && !win.isDestroyed()) {
            // The gone-handler above performs the actual reload.
            win.webContents.forcefullyCrashRenderer();
        }
    });
}

// src/event/KeyboardEventListener.ts
export type KeyboardType =
    | 'ArrowUp'
    | 'ArrowRight'
    | 'PageUp'
    | 'ArrowDown'
    | 'ArrowLeft'
    | 'PageDown'
    | 'Enter'
    | 'Tab'
    | 'Escape'
    | ' ';
export const allArrows: KeyboardType[] = [
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
];
export type WindowsControlType = 'Ctrl' | 'Alt' | 'Shift';
export type LinuxControlType = 'Ctrl' | 'Alt' | 'Shift';
export type MacControlType = 'Ctrl' | 'Option' | 'Shift' | 'Meta';
export type AllControlType = 'Ctrl' | 'Shift';
export enum PlatformEnum {
    Windows = 'Windows',
    Mac = 'Mac',
    Linux = 'Linux',
}
export interface EventMapper {
    wControlKey?: WindowsControlType[];
    mControlKey?: MacControlType[];
    lControlKey?: LinuxControlType[];
    allControlKey?: AllControlType[];
    platforms?: PlatformEnum[];
    key: string;
}
const keyNameMap: { [key: string]: string } = {
    Meta: 'Command',
};
export function toShortcutKey(eventMapper: EventMapper) {
    let key = eventMapper.key;
    if (!key) {
        return '';
    }
    if (key.length === 1) {
        key = key.toUpperCase();
    }
    const { wControlKey, mControlKey, lControlKey, allControlKey } =
        eventMapper;
    const allControls: string[] = allControlKey ?? [];
    if (isWindows) {
        allControls.push(...(wControlKey ?? []));
    } else if (isMac) {
        allControls.push(...(mControlKey ?? []));
    } else if (isLinux) {
        allControls.push(...(lControlKey ?? []));
    }
    if (allControls.length > 0) {
        const allControlKeys = allControls.map((key) => {
            return keyNameMap[key] ?? key;
        });
        const sorted = [...allControlKeys].sort((a, b) => {
            return a.localeCompare(b);
        });
        key = `${sorted.join(' + ')} + ${key}`;
    }
    return key;
}

function genDownloadPageUrl() {
    const url = new URL(`${appInfo.homepage}/download`);
    url.searchParams.set('mv', app.getVersion());
    return url.toString();
}

export function getUpdatePageUrl(
    isStoreInstall = isWindowsStore,
    storeProductId = appInfo.msStoreProductId,
) {
    if (!isStoreInstall) {
        return genDownloadPageUrl();
    }
    if (storeProductId) {
        // The app's own page in Microsoft Store, which carries its Update
        // button. Aimed by the product id Partner Center assigns and never
        // changes: the package family name form is documented as deprecated,
        // and it had to be guessed off the install path anyway.
        const url = new URL('ms-windows-store://pdp/');
        url.searchParams.set('ProductId', storeProductId);
        return url.toString();
    }
    // Nothing reserved yet means no deep link to the package page, but the
    // Store's own updates list still surfaces the app -- and a Store install
    // must never land on the self-hosted download page, whose installer cannot
    // update an MSIX package. `check-appx-config.mjs` is what keeps a real
    // Store build from ever shipping without the id.
    return 'ms-windows-store://downloadsandupdates';
}

export function goDownload() {
    // The menu's "Check for Updates Online" means the WEBSITE download page,
    // whatever the install source -- never the Store.
    shell.openExternal(genDownloadPageUrl()).catch((error: Error) => {
        console.error('Failed to open the download page:', error);
    });
}

const lockSet = new Set<string>();
export async function unlocking<T>(
    key: string,
    callback: () => Promise<T> | T,
) {
    let i = 0;
    while (lockSet.has(key)) {
        await new Promise((resolve) => {
            setTimeout(resolve, 100);
        });
        i++;
        if (i >= 600) {
            throw new Error(`Timeout waiting for unlock: ${key}`);
        }
    }
    lockSet.add(key);
    const data = await callback();
    lockSet.delete(key);
    return data;
}

export function getAppThemeBackgroundColor() {
    return nativeTheme.shouldUseDarkColors ? '#000000' : '#ffffff';
}

export function copyDebugInfoToClipboard(isFull = false) {
    const packageInfo = getPackInfo();
    if (packageInfo === null) {
        clipboard.writeText('No package info available');
        return;
    }
    let debugAppInfo = `
App Version: ${app.getVersion()}
Electron Version: ${process.versions.electron}
Chrome Version: ${process.versions.chrome}
Node.js Version: ${process.versions.node}
V8 Version: ${process.versions.v8}
OS: ${process.platform} ${process.arch} ${require('node:os').release()}
Commit Hash: ${packageInfo.commitHash}`.trim();
    if (isFull) {
        packageInfo.debugAppInfo = debugAppInfo;
        debugAppInfo = JSON.stringify(packageInfo, null, 2);
    }
    clipboard.writeText(debugAppInfo);
}

export function genParentWinCenterPosition(
    mainWin: Electron.BrowserWindow,
    {
        width = 700,
        height = 435,
    }: {
        width: number;
        height: number;
    },
) {
    const mainBounds = mainWin.getBounds();
    const x = mainBounds.x + (mainBounds.width - width) / 2;
    const y = mainBounds.y + (mainBounds.height - height) / 2;
    return { x, y };
}

function applyZoomFactor(win: BrowserWindow) {
    win.webContents.on('did-finish-load', () => {
        const bounds = win.getBounds();
        const currentZoomFactor = win.webContents.getZoomFactor();
        if (currentZoomFactor === 1) {
            return;
        }
        const newWidth = Math.round(bounds.width * currentZoomFactor);
        const newHeight = Math.round(bounds.height * currentZoomFactor);
        const offsetX = Math.round((newWidth - bounds.width) / 2);
        const offsetY = Math.round((newHeight - bounds.height) / 2);
        win.setBounds({
            x: bounds.x - offsetX,
            y: bounds.y - offsetY,
            width: newWidth,
            height: newHeight,
        });
    });
}

export function genCenterSubDisplay({
    displayPercent,
    x,
    y,
    width,
    height,
}: {
    displayPercent: number;
    x: number;
    y: number;
    width: number;
    height: number;
}) {
    const offsetWidth = width * (1 - displayPercent);
    // intend to keep the aspect ratio, so use the same offset for height
    const offsetHeight = offsetWidth;
    return {
        x: Math.floor(x + offsetWidth / 2),
        y: Math.floor(y + offsetHeight / 2),
        width: Math.floor(width - offsetWidth),
        height: Math.floor(height - offsetHeight),
        background: 'transparent',
    };
}

export function genWebPreferences(preloadPath: string) {
    // TODO: fix security issues with nodeIntegration and contextIsolation
    // All windows expose full Node.js APIs to renderers.
    // Any XSS vulnerability escalates to full system compromise.
    // Electron strongly recommends contextIsolation:
    //  true with a preload bridge.
    const webPreferences: WebPreferences = {
        webSecurity: isSecured,
        nodeIntegration: true,
        contextIsolation: false,
        preload: preloadPath,
    };
    return webPreferences;
}

function toUrlWithSortedParams(url: string, isRemovingUuid = false) {
    const urlObj = new URL(url);
    if (isRemovingUuid) {
        urlObj.searchParams.delete('uuid');
    }
    const sortedParams = [...urlObj.searchParams.entries()].sort(
        ([keyA], [keyB]) => {
            return keyA.localeCompare(keyB);
        },
    );
    urlObj.search = new URLSearchParams(sortedParams).toString();
    return urlObj.toString();
}

export type PopupWindowFeaturesType = {
    popup?: boolean;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    appFollowScale?: boolean;
    appAlignHorizontal?: 'left' | 'center' | 'right';
    appAlignVertical?: 'top' | 'center' | 'bottom';
    appScale?: number;
    appAlwaysOnTop?: boolean;
    appTopToMain?: boolean;
    appShowMenuBar?: boolean;
    appResize?: boolean;
    appGlassy?: boolean;
    // `+`-joined Blink runtime feature names, see `PopupWindowFeaturesType` in
    // `src/helper/domHelpers.ts`.
    appBlinkFeatures?: string;
};

// features: 'popup,width=700,height=435,appCenter,appFollowScale'
// => { popup: true, width: 700, height: 435, appCenter: true, appFollowScale: true }
function toFeatureRecord(featuresString: string) {
    const featuresArray = featuresString.split(',');
    const featuresRecord: { [key: string]: boolean | number | string } = {};
    for (const feature of featuresArray) {
        const [key, value] = feature.split('=');
        if (value === undefined || value === 'true') {
            featuresRecord[key] = true;
        } else if (value === 'false') {
            featuresRecord[key] = false;
        } else {
            const numValue = Number(value);
            featuresRecord[key] = Number.isNaN(numValue) ? value : numValue;
        }
    }
    return featuresRecord as PopupWindowFeaturesType;
}

// A second window of the same kind steps off the one already open instead of
// landing exactly on top of it.
function genGroupCascadePosition(groupWindows: BrowserWindow[]) {
    const boundsList = groupWindows.map((win) => {
        return win.getBounds();
    });
    return {
        x:
            Math.max(
                ...boundsList.map(({ x }) => {
                    return x;
                }),
            ) + 20,
        y:
            Math.max(
                ...boundsList.map(({ y }) => {
                    return y;
                }),
            ) + 20,
    };
}

function genBoundsData(
    parentWin: BrowserWindow,
    groupWindows: BrowserWindow[],
    selfWindows: BrowserWindow[],
    featuresRecord: PopupWindowFeaturesType,
) {
    const bounds = parentWin.getBounds();
    const subDisplay = genCenterSubDisplay({
        displayPercent: featuresRecord.appScale ?? 0.9,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
    });
    if (groupWindows.length > 0 && selfWindows.length === 0) {
        Object.assign(subDisplay, genGroupCascadePosition(groupWindows));
    }
    Object.assign(subDisplay, {
        width: featuresRecord.width ?? subDisplay.width,
        height: featuresRecord.height ?? subDisplay.height,
        x: featuresRecord.x ?? subDisplay.x,
        y: featuresRecord.y ?? subDisplay.y,
    });

    const centerData = genParentWinCenterPosition(parentWin, {
        width: subDisplay.width,
        height: subDisplay.height,
    });
    // Horizontal alignment
    switch (featuresRecord.appAlignHorizontal) {
        case 'left':
            subDisplay.x = bounds.x;
            break;
        case 'center':
            subDisplay.x = centerData.x;
            break;
        case 'right':
            subDisplay.x = bounds.x + bounds.width;
            break;
    }
    // Vertical alignment
    switch (featuresRecord.appAlignVertical) {
        case 'top':
            subDisplay.y = bounds.y;
            break;
        case 'center':
            subDisplay.y = centerData.y;
            break;
        case 'bottom':
            subDisplay.y = bounds.y + bounds.height;
            break;
    }

    return Object.assign(subDisplay, keepOnScreen(bounds, subDisplay));
}

/**
 * Keeps a popup where the mouse can reach it.
 *
 * `right`/`bottom` alignment and a cascade both place a window BESIDE its
 * opener, and beside a maximised opener is off the edge of the monitor. A
 * window created there is nudged back by the OS; one MOVED there by
 * `setBounds` is not -- `Reset Position and Size` put the chatbot at x=1502 on
 * a 1494-wide screen, which is how the menu item meant to rescue a lost window
 * lost one. The same clamp runs on open too, so the two paths agree.
 */
function keepOnScreen(
    parentBounds: Electron.Rectangle,
    { x, y, width, height }: Electron.Rectangle,
): Electron.Rectangle {
    const { workArea } = screen.getDisplayMatching(parentBounds);
    const clampedWidth = Math.min(width, workArea.width);
    const clampedHeight = Math.min(height, workArea.height);
    return {
        x: Math.max(
            workArea.x,
            Math.min(x, workArea.x + workArea.width - clampedWidth),
        ),
        y: Math.max(
            workArea.y,
            Math.min(y, workArea.y + workArea.height - clampedHeight),
        ),
        width: clampedWidth,
        height: clampedHeight,
    };
}

/**
 * The key a popup's remembered position and size is stored under.
 *
 * It is the popup's own html page, NOT the full url: a per-document key would
 * grow `setting.json` by one entry for every file the user ever opened an
 * editor, note or preview for, while "this kind of window opens where I last
 * left it" is what a user actually expects anyway. Anything that is not one of
 * the app's own pages -- a `file://` pdf preview -- is deliberately not
 * remembered, which is what keeps the map bounded by the page count.
 */
const popupBoundsKeySet = new Set<string>(Object.values(htmlFiles));
function genPopupBoundsKey(url: string) {
    if (!URL.canParse(url)) {
        return null;
    }
    const htmlFileFullName = new URL(url).pathname.split('/').pop() ?? '';
    return popupBoundsKeySet.has(htmlFileFullName) ? htmlFileFullName : null;
}

type PopupWindowMetaType = {
    boundsKey: string | null;
    featuresRecord: PopupWindowFeaturesType;
    parentWin: BrowserWindow;
    boundsResetAt: number;
};
// Weak so a closed popup drops out on its own. `resetPopupWindowsBounds` walks
// `BrowserWindow.getAllWindows()` and looks each window up here, because popups
// are registered nowhere else (see `ElectronAppController.reloadAll`).
const popupWindowMetaMap = new WeakMap<BrowserWindow, PopupWindowMetaType>();

function getPopupWindowData(parentWin: BrowserWindow, options: HandlerDetails) {
    const { url, features } = options;
    const featuresRecord = toFeatureRecord(features);

    const allWindows = BrowserWindow.getAllWindows();

    const sortedUrl = toUrlWithSortedParams(url, true);
    const groupWindows = allWindows.filter((win) => {
        const { webContents } = win;
        const currentSortedUrl = toUrlWithSortedParams(
            webContents.getURL(),
            true,
        );
        return currentSortedUrl === sortedUrl;
    });

    const originalSortedUrl = toUrlWithSortedParams(url);
    const selfWindows = groupWindows.filter((win) => {
        const { webContents } = win;
        const currentSortedUrl = toUrlWithSortedParams(webContents.getURL());
        return currentSortedUrl === originalSortedUrl;
    });

    const subDisplay = genBoundsData(
        parentWin,
        groupWindows,
        selfWindows,
        featuresRecord,
    );

    return {
        groupWindows,
        selfWindows,
        subDisplay,
        featuresRecord,
        boundsKey: genPopupBoundsKey(url),
    };
}

// Window move/resize events arrive after the OS has actually moved the window,
// so a synchronous flag would already be gone by the time they land. A short
// quiet period is what stops `Reset Position and Size` from immediately
// recording the very defaults it just applied.
const BOUNDS_RESET_QUIET_MILLISECOND = 1000;

/**
 * Records where the user leaves a popup. Same shape as the main window's own
 * tracking in `ElectronSettingManager.syncMainWindow`: every move/resize writes
 * the geometry, and the setting write behind it is debounced and skipped when
 * nothing actually changed.
 */
function trackPopupWindowBounds(popupWin: BrowserWindow, boundsKey: string) {
    const saveBounds = () => {
        const meta = popupWindowMetaMap.get(popupWin);
        if (
            popupWin.isDestroyed() ||
            Date.now() - (meta?.boundsResetAt ?? 0) <
                BOUNDS_RESET_QUIET_MILLISECOND
        ) {
            return;
        }
        const isMaximized = popupWin.isMaximized();
        // The maximized rectangle is the whole screen, never a size worth
        // restoring to once the window is un-maximized again.
        const bounds = isMaximized
            ? popupWin.getNormalBounds()
            : popupWin.getBounds();
        ElectronSettingManager.getInstance().setPopupWinBounds(boundsKey, {
            ...bounds,
            isMaximized,
        });
    };
    popupWin.on('resize', saveBounds);
    popupWin.on('move', saveBounds);
    popupWin.on('maximize', saveBounds);
    popupWin.on('unmaximize', saveBounds);
}

type PopupWindowContextType = {
    parentWin: BrowserWindow;
    webPreferences: WebPreferences | undefined;
    featuresRecord: PopupWindowFeaturesType;
    boundsKey: string | null;
    savedBounds: PopupWinBoundsType | null;
};

function createPopupWindow(
    options: HandlerDetails,
    context: PopupWindowContextType,
    constructionOptions: BrowserWindowConstructorOptions,
): WebContents {
    const {
        parentWin,
        webPreferences,
        featuresRecord,
        boundsKey,
        savedBounds,
    } = context;
    const popupWin = new BrowserWindow(constructionOptions);
    guardBrowsing(popupWin, webPreferences);
    // Restored bounds are already the size the user last saw AT their zoom
    // level; scaling them again would grow the window on every launch.
    if (featuresRecord.appFollowScale && savedBounds === null) {
        applyZoomFactor(popupWin);
    }
    if (featuresRecord.appAlwaysOnTop) {
        popupWin.setAlwaysOnTop(true, 'screen-saver');
    }
    if (featuresRecord.appShowMenuBar) {
        popupWin.setMenuBarVisibility(true);
        popupWin.setAutoHideMenuBar(false);
    } else {
        popupWin.setMenuBarVisibility(false);
        popupWin.setAutoHideMenuBar(true);
    }
    if (featuresRecord.appResize === false) {
        popupWin.setResizable(false);
    }
    popupWindowMetaMap.set(popupWin, {
        boundsKey,
        featuresRecord,
        parentWin,
        boundsResetAt: 0,
    });
    if (boundsKey !== null) {
        if (savedBounds?.isMaximized) {
            popupWin.maximize();
        }
        trackPopupWindowBounds(popupWin, boundsKey);
    }
    popupWin.loadURL(options.url);
    setTimeout(() => {
        popupWin.focus();
    }, 100);
    return popupWin.webContents;
}

/**
 * `Window` -> `Reset Position and Size`, for the popup windows.
 *
 * Two halves, both needed: the remembered geometry is dropped so the NEXT open
 * starts from the page's own defaults, and every popup currently on screen is
 * moved back over its opener -- rescuing a window that ended up where the mouse
 * cannot reach it is the whole point of the menu item.
 */
export function resetPopupWindowsBounds(fallbackParentWin: BrowserWindow) {
    ElectronSettingManager.getInstance().clearPopupWinBounds();
    const resetWindows: BrowserWindow[] = [];
    for (const popupWin of BrowserWindow.getAllWindows()) {
        const meta = popupWindowMetaMap.get(popupWin);
        if (meta === undefined || popupWin.isDestroyed()) {
            continue;
        }
        const parentWin = meta.parentWin.isDestroyed()
            ? fallbackParentWin
            : meta.parentWin;
        // Already-reset popups of the same kind act as the group, so several
        // open at once fan out instead of stacking on a single spot.
        const groupWindows = resetWindows.filter((resetWin) => {
            const resetMeta = popupWindowMetaMap.get(resetWin);
            return resetMeta?.boundsKey === meta.boundsKey;
        });
        const { x, y, width, height } = genBoundsData(
            parentWin,
            groupWindows,
            [],
            meta.featuresRecord,
        );
        meta.boundsResetAt = Date.now();
        if (popupWin.isMaximized()) {
            popupWin.unmaximize();
        }
        popupWin.setBounds({ x, y, width, height });
        resetWindows.push(popupWin);
    }
}

/**
 * The help window steps aside while a walkthrough is running.
 *
 * The chatbot is a separate OS window that deliberately sits ON TOP of the app
 * (`appTopToMain`), because its answers are about the window behind it. That is
 * exactly wrong for a walkthrough: the card it starts rings a control in that
 * window, and roughly a quarter of the app can be behind the help window at any
 * moment -- measured at 12% of the presenter's named controls with it parked
 * over the middle. Telling someone to press a button they cannot see is worse
 * than not offering to.
 *
 * So it is minimised for the length of the walkthrough and restored when the
 * card closes. Two things keep that from being rude:
 *
 * - **Only when it is actually in the way.** A second monitor, or a window
 *   pushed off to the side, is left alone -- and then nothing is restored
 *   either, because nothing moved.
 * - **Only what this did.** A window the user minimised themselves is not
 *   "restored", and one they bring back mid-walkthrough is theirs again.
 *
 * Recovering it by hand already works and keeps working: the taskbar, or the
 * app's own 🤖 button, which `handlePopupWindowOpen` answers by restoring the
 * window that is already open rather than making a second one.
 */
let tuckedAwayWin: BrowserWindow | null = null;
let handleUserReclaiming: (() => void) | null = null;

// Stop treating the window as ours. Called both when the USER brings it back
// and just before this code does -- our own `restore()` and `close` fire the
// same events, and re-entering through them would clear the reference a second
// time or restore a window twice.
function releaseTuckedAwayWin() {
    if (tuckedAwayWin !== null && handleUserReclaiming !== null) {
        if (!tuckedAwayWin.isDestroyed()) {
            tuckedAwayWin.off('restore', handleUserReclaiming);
            tuckedAwayWin.off('closed', handleUserReclaiming);
        }
    }
    tuckedAwayWin = null;
    handleUserReclaiming = null;
}

function findChatbotWindow() {
    return (
        BrowserWindow.getAllWindows().find((win) => {
            return (
                !win.isDestroyed() &&
                win.webContents.getURL().includes(htmlFiles.chatbot)
            );
        }) ?? null
    );
}

function checkIsOverlapping(one: BrowserWindow, other: BrowserWindow) {
    const a = one.getBounds();
    const b = other.getBounds();
    return (
        Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) &&
        Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y)
    );
}

/**
 * macOS only: take the window out of its parent's group for as long as it is
 * minimised.
 *
 * The chatbot is opened as a CHILD of the window that asked for it
 * (`appTopToMain`), and on macOS that is an AppKit child window, which cannot
 * be miniaturised on its own (electron/electron#26031 and #39578, both open).
 * `minimize()` on it sent the PRESENTER into the Dock, and every other popup
 * riding on it, while the chatbot stayed up and never counted as minimised --
 * so the `restore()` at the end of the walkthrough did nothing and the app
 * stayed down. Measured live 2026-09-12: presenter and Settings off screen,
 * chatbot on.
 *
 * It rejoins on `restore`, whoever restores it -- this code when the card
 * closes, or the user from the Dock or the robot button -- and NOT straight
 * after our own `restore()` call: the window is still miniaturised then, and
 * Electron only attaches a VISIBLE window to its parent, so a parent set too
 * early is remembered and the window floats free of it.
 *
 * Windows and Linux minimise an owned window by itself, so nothing is detached
 * there. The platform is read at call time so a test can pick one.
 */
function detachFromParentWhileMinimised(win: BrowserWindow) {
    const parentWin = win.getParentWindow();
    if (process.platform !== 'darwin' || parentWin === null) {
        return;
    }
    win.setParentWindow(null);
    win.once('restore', () => {
        if (!win.isDestroyed() && !parentWin.isDestroyed()) {
            win.setParentWindow(parentWin);
        }
    });
}

export function setGuideRunning(guidedWin: BrowserWindow, isRunning: boolean) {
    if (!isRunning) {
        // Only ever undo this function's own doing: `tuckedAwayWin` is null
        // unless a walkthrough put it there, and the `restore` listener below
        // has already given it up if the user brought it back themselves.
        //
        // Deliberately NOT gated on `isMinimized()` any more: that asks the
        // window manager to confirm, a beat later, something we already know,
        // and a stale answer leaves the window down with no way back but the
        // taskbar. Whether the user has reclaimed it is a thing to be TOLD
        // (the event), not a state to re-read.
        const win = tuckedAwayWin;
        releaseTuckedAwayWin();
        if (win !== null && !win.isDestroyed()) {
            win.restore();
        }
        return;
    }
    const chatbotWin = findChatbotWindow();
    if (
        chatbotWin === null ||
        chatbotWin === guidedWin ||
        chatbotWin.isMinimized() ||
        !checkIsOverlapping(chatbotWin, guidedWin)
    ) {
        return;
    }
    // Nothing should still be held here -- the stop always releases, and a
    // window still held would be minimised and so refused above -- but taking
    // a second one without letting the first go would leak a listener.
    releaseTuckedAwayWin();
    tuckedAwayWin = chatbotWin;
    handleUserReclaiming = releaseTuckedAwayWin;
    chatbotWin.once('restore', handleUserReclaiming);
    chatbotWin.once('closed', handleUserReclaiming);
    detachFromParentWhileMinimised(chatbotWin);
    chatbotWin.minimize();
    // The walkthrough happens in the app window from here, and a demo step
    // that types needs it genuinely focused -- minimising the window in front
    // of it is most of the way there, but not all of it on every desktop.
    if (!guidedWin.isDestroyed()) {
        guidedWin.focus();
    }
}

/**
 * A walkthrough step the card could not perform, handed to the chat window
 * that started it. The two are separate renderers — one drawing a card in the
 * presenter, one holding the conversation and the model — and neither can
 * reach the other, so the main process carries the question across and the
 * answer back.
 *
 * The guided window is remembered rather than looked up, because by the time
 * the answer arrives the model has had several rounds to move the app around,
 * and the card that asked is in the window that asked — not in whatever is
 * focused a few seconds later.
 *
 * Nothing here restores the chat window. It was minimised for the length of
 * the walkthrough on purpose (`setGuideRunning`), the user is looking at the
 * app, and the answer is drawn on the card in front of them; pulling the help
 * window back over the control they are about to press would undo the fix
 * while delivering it.
 */
let guideHelpAskingWin: BrowserWindow | null = null;

export function askGuideHelp(guidedWin: BrowserWindow, payload: any) {
    guideHelpAskingWin = guidedWin;
    const chatbotWin = findChatbotWindow();
    if (chatbotWin === null || chatbotWin === guidedWin) {
        // Say so at once instead of letting the card wait out its timeout:
        // with no chat window there is nobody to ask, and the sooner the card
        // knows, the sooner the user gets the plain instruction back.
        answerGuideHelp({ token: payload?.token, text: '' });
        return false;
    }
    chatbotWin.webContents.send(messageChannels.guideHelp, payload);
    return true;
}

/**
 * A picture on its way from the Presenting Control to the help window.
 *
 * Held here for the same reason the guide's answer is routed here: the two are
 * separate renderers and neither can reach the other. What is different is the
 * TIMING -- pressing the camera also OPENS the help window, and a window still
 * loading cannot receive a message. So the picture waits, and the window takes
 * it when it is ready. Exactly one is held: a second snapshot replaces the
 * first, because a queue of screenshots in the main process is a memory leak
 * dressed as a feature.
 */
let pendingChatAttachment: any = null;

export function sendChatAttachment(payload: any) {
    pendingChatAttachment = payload;
    const chatbotWin = findChatbotWindow();
    if (chatbotWin === null) {
        return false;
    }
    chatbotWin.webContents.send(messageChannels.chatAttach, payload);
    return true;
}

/** Read once and forgotten: this must not keep a picture alive. */
export function takeChatAttachment() {
    const payload = pendingChatAttachment;
    pendingChatAttachment = null;
    return payload;
}

export function answerGuideHelp(payload: any) {
    const win = guideHelpAskingWin;
    guideHelpAskingWin = null;
    if (win === null || win.isDestroyed()) {
        return false;
    }
    win.webContents.send(messageChannels.guideHelpAnswer, payload);
    return true;
}

/**
 * Blink runtime features (e.g. `CanvasDrawElement`) can be switched on for a
 * single window through its `webPreferences`. They are per renderer *process*
 * though, so this only takes effect because `openPopupWindow` marks such
 * popups `noopener`, which stops the popup from being placed in the opener's
 * process. Appending to `app.commandLine` here would not work: the browser
 * process command line is already parsed by the time a window is opened.
 */
function genPopupWebPreferences(
    webPreferences: WebPreferences,
    featuresRecord: PopupWindowFeaturesType,
    boundsKey: string | null,
): WebPreferences {
    // The AI Chat window is the ONE page allowed a `<webview>` guest -- the
    // box it keeps a company's chat site in. Keyed on the page, never on a
    // feature the opener could ask for: a renderer that could request the
    // tag could host a foreign page next to node integration. What the guest
    // itself may do is decided in `aiChatGuestHelpers.ts`.
    const guestPreferences: WebPreferences =
        boundsKey === htmlFiles.aichat ? { webviewTag: true } : {};
    const blinkFeatures = featuresRecord.appBlinkFeatures;
    if (!blinkFeatures) {
        return { ...webPreferences, ...guestPreferences };
    }
    return {
        ...webPreferences,
        ...guestPreferences,
        enableBlinkFeatures: blinkFeatures.split('+').join(','),
    };
}

/**
 * The window options behind `appGlassy` -- a popup that reads as frosted glass
 * over the app instead of a slab on top of it.
 *
 * The backdrop is drawn by the OS compositor, so it costs this app nothing on
 * the machines it has to run on; a CSS `backdrop-filter` could not do it at
 * all, having no access to what is behind its own window. The page must leave
 * the window fully transparent for it to show through, which is why the alpha
 * background colour is the whole point rather than an oversight -- the popup's
 * own stylesheet paints the readable tint on top.
 *
 * Where the compositor cannot do it, the popup stays exactly as opaque as
 * every other one.
 */
function genGlassOptions(
    featuresRecord: PopupWindowFeaturesType,
): BrowserWindowConstructorOptions {
    if (featuresRecord.appGlassy !== true || !isGlassCapable) {
        return { backgroundColor: getAppThemeBackgroundColor() };
    }
    return {
        backgroundColor: '#00000000',
        ...(isMac
            ? ({
                  vibrancy: 'under-window',
                  // Or the blur freezes the moment the popup loses focus,
                  // which is most of the time: the answers in it are about
                  // the window behind.
                  visualEffectState: 'active',
              } as const)
            : ({ backgroundMaterial: 'acrylic' } as const)),
    };
}

export const POPUP_FRAME_NAME_PREFIX = 'popup_window';
function handlePopupWindowOpen(
    win: BrowserWindow,
    webPreferences: WebPreferences | undefined,
    options: HandlerDetails,
): WindowOpenHandlerResponse {
    if (
        !options.frameName.startsWith(POPUP_FRAME_NAME_PREFIX) ||
        webPreferences === undefined
    ) {
        const urlObj = new URL(options.url);
        if (['http:', 'https:'].includes(urlObj.protocol)) {
            shell.openExternal(options.url);
        }
        return { action: 'deny' };
    }

    const { groupWindows, selfWindows, subDisplay, featuresRecord, boundsKey } =
        getPopupWindowData(win, options);
    if (groupWindows.length > 0) {
        setTimeout(() => {
            for (const win of groupWindows) {
                if (win.isMinimized()) {
                    win.restore();
                }
                win.focus();
            }
        }, 0);
    }
    if (selfWindows.length > 0) {
        return { action: 'deny' };
    }

    // Where the user last left this kind of popup wins over the page's own
    // declared placement -- that is the whole point of remembering it.
    const savedBounds =
        boundsKey === null
            ? null
            : ElectronSettingManager.getInstance().getPopupWinBounds(boundsKey);
    if (savedBounds !== null) {
        const { x, y, width, height } = savedBounds;
        Object.assign(subDisplay, { x, y, width, height });
        if (groupWindows.length > 0) {
            Object.assign(subDisplay, genGroupCascadePosition(groupWindows));
        }
    }

    const topToMainOptions: BrowserWindowConstructorOptions = {};
    if (featuresRecord.appTopToMain) {
        topToMainOptions.parent = win;
    }

    const popupWebPreferences = genPopupWebPreferences(
        webPreferences,
        featuresRecord,
        boundsKey,
    );

    const content: WindowOpenHandlerResponse = {
        action: 'allow',
        overrideBrowserWindowOptions: {
            ...subDisplay,
            ...topToMainOptions,
            webPreferences: popupWebPreferences,
            // transparent: true,
            // frame: false,
            ...genGlassOptions(featuresRecord),
        },
        createWindow: (
            constructionOptions: BrowserWindowConstructorOptions,
        ) => {
            return createPopupWindow(
                options,
                {
                    parentWin: win,
                    webPreferences: popupWebPreferences,
                    featuresRecord,
                    boundsKey,
                    savedBounds,
                },
                constructionOptions,
            );
        },
    };
    return content;
}
export function guardBrowsing(
    win: BrowserWindow,
    webPreferences?: WebPreferences,
) {
    win.webContents.setWindowOpenHandler(
        handlePopupWindowOpen.bind(null, win, webPreferences),
    );
}

const printPreviewDirName = 'open-worship-print-preview';
let printPreviewFileIndex = 0;

function getPrintPreviewDirPath() {
    return path.join(app.getPath('temp'), printPreviewDirName);
}

const printPreviewFileNameRegex =
    /^print-(?:preview|content)-(\d+)-\d+\.(?:pdf|html)$/;

// Print preview `.pdf`/content `.html` files are removed when their windows
// close, but killing the app with a preview open leaves them behind forever.
// Sweep old leftovers at startup — best effort, never blocks or crashes
// startup. Files younger than an hour are kept so another running instance's
// open preview is never deleted (dev and packaged share the same temp dir).
export async function sweepStalePrintPreviewFiles() {
    try {
        const previewDir = getPrintPreviewDirPath();
        const fileNames = await readdir(previewDir);
        const oneHourAgo = Date.now() - 1000 * 60 * 60;
        await Promise.all(
            fileNames.map(async (fileName) => {
                const match = printPreviewFileNameRegex.exec(fileName);
                if (match === null || Number(match[1]) > oneHourAgo) {
                    return;
                }
                await rm(path.join(previewDir, fileName), { force: true });
            }),
        );
    } catch (_error) {}
}

function getPrintableWindow(browserWindow?: BrowserWindow | null) {
    const win = browserWindow ?? BrowserWindow.getFocusedWindow();

    if (!win || win.isDestroyed()) {
        return null;
    }

    return win;
}

export function printCurrentWindow(browserWindow?: BrowserWindow | null) {
    const win = getPrintableWindow(browserWindow);

    if (!win) {
        return;
    }

    win.webContents.print({ printBackground: true }, (success, errorType) => {
        if (!success) {
            console.log('Print failed:', errorType);
        }
    });
}

export async function previewPrintCurrentWindow(
    browserWindow?: BrowserWindow | null,
) {
    const win = getPrintableWindow(browserWindow);

    if (!win) {
        return null;
    }

    const pdfData = await win.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
    });
    const previewDir = getPrintPreviewDirPath();
    await mkdir(previewDir, { recursive: true });

    printPreviewFileIndex += 1;
    const previewFilePath = path.join(
        previewDir,
        `print-preview-${Date.now()}-${printPreviewFileIndex}.pdf`,
    );
    await writeFile(previewFilePath, pdfData);

    const previewWin = new BrowserWindow({
        width: 1000,
        height: 800,
        title: 'Print Preview',
        backgroundColor: getAppThemeBackgroundColor(),
        webPreferences: {
            plugins: true,
        },
    });

    previewWin.on('closed', () => {
        rm(previewFilePath, { force: true }).catch((error) => {
            console.log('Failed to remove print preview file:', error);
        });
    });

    await previewWin.loadURL(pathToFileURL(previewFilePath).toString());
    return previewWin;
}

export async function printHTMLContent(htmlText: string) {
    // A data: URL cannot carry the content here — Chromium caps URLs at 2MB
    // and slide HTML with embedded images easily exceeds that — so stage the
    // HTML in a temp file instead.
    const contentDir = getPrintPreviewDirPath();
    await mkdir(contentDir, { recursive: true });
    printPreviewFileIndex += 1;
    const contentFilePath = path.join(
        contentDir,
        `print-content-${Date.now()}-${printPreviewFileIndex}.html`,
    );
    await writeFile(contentFilePath, htmlText);
    const printWin = new BrowserWindow({ show: false });
    let isCleanedUp = false;
    const cleanup = () => {
        if (isCleanedUp) {
            return;
        }
        isCleanedUp = true;
        attemptClosing(printWin);
        rm(contentFilePath, { force: true }).catch((error) => {
            console.log('Failed to remove print content file:', error);
        });
    };
    const timeout = setTimeout(cleanup, 30_000);
    printWin.webContents.on('did-finish-load', async () => {
        clearTimeout(timeout);
        try {
            // Web fonts referenced by the content may still be loading when
            // did-finish-load fires; printing before they finish rasterizes
            // fallback glyphs into the PDF. `document.fonts.ready` can also
            // hang forever, so wait for it at most 10 seconds and then print
            // with whatever fonts are ready instead of leaking the hidden
            // window and the temp file.
            await Promise.race([
                printWin.webContents.executeJavaScript(
                    'document.fonts.ready.then(() => true)',
                    true,
                ),
                new Promise((resolve) => {
                    setTimeout(resolve, 10_000);
                }),
            ]);
            await previewPrintCurrentWindow(printWin);
        } catch (error) {
            console.log('Print preview failed:', error);
        }
        cleanup();
    });
    printWin.webContents.on(
        'did-fail-load',
        (_event, _errorCode, errorDescription) => {
            clearTimeout(timeout);
            console.log('Print content failed to load:', errorDescription);
            cleanup();
        },
    );
    await printWin.loadURL(pathToFileURL(contentFilePath).toString());
}

export async function captureWebScreenShot(
    url: string,
    {
        width,
        height,
        delay = 1000,
    }: {
        width: number;
        height: number;
        delay?: number;
    },
) {
    console.log('Capturing image', url.substring(0, 100), {
        width,
        height,
        delay,
    });
    // A website item's address comes out of a DOCUMENT, which may have been
    // shared, so it is judged before a window exists for it: only a real web
    // page, never `file:` reading the operator's disk through
    // `webSecurity: false`. The wall that keeps the page off this machine and
    // off the room's network is the session's, prepared here so it is in force
    // before the first request. See `electron/webCaptureHelpers.ts`.
    if (!checkIsCaptureUrlAllowed(url)) {
        throw new Error(
            `Only a web address can be captured, not: ${url.substring(0, 100)}`,
        );
    }
    const partition = await prepareCaptureSession(url);
    const captureWin = new BrowserWindow({
        show: false,
        width,
        height,
        webPreferences: {
            webSecurity: false,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            preload: undefined,
            partition,
        },
    });
    guardCaptureWindow(captureWin);
    try {
        console.log('Loading page for capture');
        await captureWin.loadURL(url);
        await new Promise((resolve) => setTimeout(resolve, delay));
        console.log('Capturing page content');
        const image = await captureWin.webContents.capturePage({
            x: 0,
            y: 0,
            width,
            height,
        });
        const imageDataUrl = image.toDataURL();
        return imageDataUrl;
    } catch (error) {
        console.error('Failed to capture screenshot:', error);
        throw error;
    } finally {
        attemptClosing(captureWin);
    }
}

/**
 * A photograph of a window the app already has open — the presenter or reader
 * the user is looking at, or a projector screen that is showing.
 *
 * Not `captureWebScreenShot` above, which loads a URL into a NEW hidden window:
 * that answers "what does this page look like", and the question here is "what
 * does the operator's screen look like RIGHT NOW", drawing and spotlight and
 * half-open menus included.
 *
 * `capturePage` photographs the window's own web contents rather than the
 * desktop, which is what makes it right for this: the chatbot popup sits ON TOP
 * of the app (`appTopToMain`), and a desktop-level grab would hand the assistant
 * a picture of itself covering the thing it was asked about.
 */
export async function captureWindowImage(win: BrowserWindow | null) {
    if (win === null || win.isDestroyed()) {
        throw new Error('That window is not open');
    }
    const image = await win.webContents.capturePage();
    return image.toDataURL();
}

/**
 * The window a showing projector screen is drawn in, or null when that screen
 * is not showing — which is not an error but an answer: "there is nothing on
 * screen 2" is what most questions asking for a picture of screen 2 are really
 * asking. The target only exists while the screen is up.
 *
 * `appController.mainWin` is deliberately NOT resolved in this module: it would
 * close an import cycle (`ElectronAppController` reads `messageChannels` from
 * here), so the caller passes the window it wants.
 */
export function findScreenWindow(screenId: number) {
    return (
        BrowserWindow.getAllWindows().find((one) => {
            return (
                !one.isDestroyed() &&
                one.webContents
                    .getURL()
                    .includes(`screenId=${screenId.toString()}`)
            );
        }) ?? null
    );
}

export function genTimeoutAttempt(
    timeMilliseconds: number = 1e3,
    shouldWait = true,
) {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastSchedule = Date.now() - timeMilliseconds - 1;
    return function (func: () => void, isImmediate: boolean = false) {
        if (!shouldWait && Date.now() - lastSchedule > timeMilliseconds) {
            isImmediate = true;
        }
        lastSchedule = Date.now();
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        if (isImmediate) {
            func();
            return;
        }
        timeoutId = setTimeout(() => {
            timeoutId = null;
            func();
        }, timeMilliseconds);
    };
}
