import {
    app,
    nativeTheme,
    shell,
    clipboard,
    BrowserWindow,
    type WebPreferences,
    type WindowOpenHandlerResponse,
    type BrowserWindowConstructorOptions,
    type HandlerDetails,
    type WebContents,
} from 'electron';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { release } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import appInfo from '../package.json';
import { htmlFiles } from './fsServe';

export type OptionalPromise<T> = T | Promise<T>;

export type CustomMenuItemType =
    | {
          label: string;
          submenu: {
              label: string;
              clickData: any;
          }[];
      }
    | {
          label: string;
          clickData: any;
      };
export type CustomMenusDataType = {
    tools?: CustomMenuItemType[];
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
const osRelease = release().toLowerCase();
export const isUbuntu = isLinux && osRelease.includes('ubuntu');
export const isFedora = isLinux && osRelease.includes('fedora');
export const isSecured = false; // TODO: make it secure
export const is64System = process.arch === 'x64';
export const isArm64 = process.arch === 'arm64';
export const commitHash = getPackInfo()?.commitHash ?? undefined;

export const messageChannels = {
    screenMessage: 'app:screen:message',
    openAboutPage: 'main:app:open-about-page',
};

export async function tarExtract(filePath: string, outputDir: string) {
    const { x: tarX } = await import('tar');
    return await (tarX as any)({ file: filePath, cwd: outputDir });
}

export async function tarCreate(
    inputDir: string,
    outputFilePath: string,
    files: string[],
    isGzip = false,
) {
    const { c: tarC } = await import('tar');
    return await (tarC as any)(
        {
            cwd: inputDir,
            file: outputFilePath,
            gzip: isGzip,
            portable: true,
        },
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
        const maxX = Math.max(
            ...groupWindows.map((win) => {
                return win.getBounds().x;
            }),
        );
        subDisplay.x = maxX + 20;
        const maxY = Math.max(
            ...groupWindows.map((win) => {
                return win.getBounds().y;
            }),
        );
        subDisplay.y = maxY + 20;
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

    return subDisplay;
}

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

    return { groupWindows, selfWindows, subDisplay, featuresRecord };
}

function createPopupWindow(
    options: HandlerDetails,
    webPreferences: WebPreferences | undefined,
    featuresRecord: PopupWindowFeaturesType,
    constructionOptions: BrowserWindowConstructorOptions,
): WebContents {
    const popupWin = new BrowserWindow(constructionOptions);
    guardBrowsing(popupWin, webPreferences);
    if (featuresRecord.appFollowScale) {
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
    popupWin.loadURL(options.url);
    setTimeout(() => {
        popupWin.focus();
    }, 100);
    return popupWin.webContents;
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

    const { groupWindows, selfWindows, subDisplay, featuresRecord } =
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

    const topToMainOptions: BrowserWindowConstructorOptions = {};
    if (featuresRecord.appTopToMain) {
        topToMainOptions.parent = win;
    }

    const content: WindowOpenHandlerResponse = {
        action: 'allow',
        overrideBrowserWindowOptions: {
            ...subDisplay,
            ...topToMainOptions,
            webPreferences,
            // transparent: true,
            // frame: false,
            backgroundColor: getAppThemeBackgroundColor(),
        },
        createWindow: (
            constructionOptions: BrowserWindowConstructorOptions,
        ) => {
            return createPopupWindow(
                options,
                webPreferences,
                featuresRecord,
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
    const previewDir = path.join(app.getPath('temp'), printPreviewDirName);
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
    const contentDir = path.join(app.getPath('temp'), printPreviewDirName);
    await mkdir(contentDir, { recursive: true });
    printPreviewFileIndex += 1;
    const contentFilePath = path.join(
        contentDir,
        `print-content-${Date.now()}-${printPreviewFileIndex}.html`,
    );
    await writeFile(contentFilePath, htmlText);
    const printWin = new BrowserWindow({ show: false });
    const cleanup = () => {
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
            // fallback glyphs into the PDF.
            await printWin.webContents.executeJavaScript(
                'document.fonts.ready.then(() => true)',
                true,
            );
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
    const captureWin = new BrowserWindow({
        show: false,
        width,
        height,
        webPreferences: {
            webSecurity: false,
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
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

export function getAllNoneFinderWindows() {
    const allWindows = BrowserWindow.getAllWindows();
    return allWindows.filter((win) => {
        const url = win.webContents.getURL();
        return !url.includes(htmlFiles.finder);
    });
}
