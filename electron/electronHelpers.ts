import {
    app,
    nativeTheme,
    shell,
    clipboard,
    BrowserWindow,
    WebPreferences,
    WindowOpenHandlerResponse,
    BrowserWindowConstructorOptions,
} from 'electron';

import appInfo from '../package.json';

export const isDev = process.env.NODE_ENV === 'development';

export const isWindows = process.platform === 'win32';
export const isMac = process.platform === 'darwin';
export const isLinux = process.platform === 'linux';
export const isSecured = false; // TODO: make it secure
export const is64System = process.arch === 'x64';
export const isArm64 = process.arch === 'arm64';

export async function tarExtract(filePath: string, outputDir: string) {
    const { x: tarX } = await import('tar');
    return await (tarX as any)({ file: filePath, cwd: outputDir });
}

interface ClosableInt {
    close: () => void;
}

export function toUnpackedPath(path: string) {
    return path.replace('app.asar', 'app.asar.unpacked');
}
export function attemptClosing(win?: ClosableInt | null) {
    try {
        win?.close();
    } catch (_error) {}
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

export function goDownload() {
    const url = new URL(`${appInfo.homepage}/download`);
    url.searchParams.set('mv', app.getVersion());
    shell.openExternal(url.toString());
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
    const packageInfo = require('../package-info.json');
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

export function getCenterScreenPosition(
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
    return { x, y, width, height };
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

function getGroupWindowsByUrl(url: string) {
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
    const selfWindows = allWindows.filter((win) => {
        const { webContents } = win;
        const currentSortedUrl = toUrlWithSortedParams(webContents.getURL());
        return currentSortedUrl === originalSortedUrl;
    });

    return { groupWindows, selfWindows };
}

export const POPUP_FRAME_NAME_PREFIX = 'popup_window';
export function guardBrowsing(
    win: BrowserWindow,
    webPreferences?: WebPreferences,
) {
    win.webContents.setWindowOpenHandler((options) => {
        const { groupWindows, selfWindows } = getGroupWindowsByUrl(options.url);
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

        if (
            !options.frameName.startsWith(POPUP_FRAME_NAME_PREFIX) ||
            webPreferences === undefined
        ) {
            shell.openExternal(options.url);
            return { action: 'deny' };
        }

        const bounds = win.getBounds();
        const subDisplay = genCenterSubDisplay({
            displayPercent: 0.9,
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
        });
        const content: WindowOpenHandlerResponse = {
            action: 'allow',
            overrideBrowserWindowOptions: {
                ...subDisplay,
                webPreferences,
            },
            createWindow: (
                constructionOptions: BrowserWindowConstructorOptions,
            ) => {
                const popupWin = new BrowserWindow(constructionOptions);
                popupWin.loadURL(options.url);
                setTimeout(() => {
                    popupWin.focus();
                }, 100);
                return popupWin.webContents;
            },
        };
        return content;
    });
}

export function printHTMLContent(htmlText: string) {
    const printWin = new BrowserWindow({
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });
    printWin.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(htmlText)}`,
    );
    printWin.webContents.on('did-finish-load', () => {
        printWin.webContents.print({}, (success, errorType) => {
            if (!success) {
                console.log('Print failed:', errorType);
            }
            attemptClosing(printWin);
        });
    });
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
    const captureWin = new BrowserWindow({
        show: false,
        width,
        height,
        webPreferences: {
            webSecurity: false,
            nodeIntegration: true,
            contextIsolation: false,
        },
    });
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
    attemptClosing(captureWin);
    const imageDataUrl = image.toDataURL();
    return imageDataUrl;
}

export function genTimeoutAttempt(
    timeMilliseconds: number = 1e3,
    shouldWait = true,
) {
    let timeoutId: any = null;
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
