import { app, BrowserWindow, Menu, MenuItem, shell } from 'electron';
import path from 'node:path';

import { type ScreenMessageType } from './electronEventListener';
import { genRoutProps, genRouteUrl } from './protocolHelpers';
import type ElectronSettingManager from './ElectronSettingManager';
import { htmlFiles } from './fsServe';
import {
    attemptClosing,
    genWebPreferences,
    getAppThemeBackgroundColor,
    guardBrowsing,
    isDev,
    messageChannels,
} from './electronHelpers';

const allowedMainHtmlFiles = new Set([
    htmlFiles.presenter,
    htmlFiles.reader,
    htmlFiles.appDocumentEditor,
]);

function toAllowedMainHtmlPath(mainHtmlPath: string) {
    return allowedMainHtmlFiles.has(mainHtmlPath)
        ? mainHtmlPath
        : htmlFiles.reader;
}

// A custom scheme (`owa://`) yields an opaque origin whose `.origin` is the
// literal string "null", so it can't distinguish `owa://local` from
// `file://` or `data:`. Comparing scheme + host directly keeps the check
// meaningful for both the dev (`https://localhost:3000`) and packaged origins.
function toOriginKey(url: URL) {
    return `${url.protocol}//${url.host}`;
}

// The app's own root URL — `https://localhost:3000` in dev, `owa://local` when
// packaged — resolved through the very generator the window is loaded with.
const appRootOriginKey = toOriginKey(new URL(genRouteUrl(htmlFiles.reader)));

// The main window must never leave presenter/reader/editor. A navigation is
// only supported when it targets the EXACT URL the app itself would generate
// for an allowed main page: an html path that survives `toAllowedMainHtmlPath`
// unchanged, served from the same root URL `genRouteUrl` produces. Anything
// else (external links, `setting.html`, `file://`, redirects, extra path
// segments) is rejected.
function isSupportedMainNavigation(targetUrl: string) {
    if (!URL.canParse(targetUrl)) {
        return false;
    }
    const targetUrlObj = new URL(targetUrl);
    const htmlFileName = targetUrlObj.pathname.split('/').pop() ?? '';
    if (toAllowedMainHtmlPath(htmlFileName) !== htmlFileName) {
        return false;
    }
    const expectedUrlObj = new URL(genRouteUrl(htmlFileName));
    return (
        toOriginKey(targetUrlObj) === toOriginKey(expectedUrlObj) &&
        targetUrlObj.pathname === expectedUrlObj.pathname
    );
}

function guardMainNavigation(win: BrowserWindow) {
    const handleNavigation = (event: Electron.Event, targetUrl: string) => {
        if (isSupportedMainNavigation(targetUrl)) {
            return;
        }
        // Block the main window from replacing itself with an unsupported page.
        event.preventDefault();
        // Hand only genuine external links (a different root) to the system
        // browser; an unsupported same-root page (e.g. `setting.html`) is just
        // blocked, never popped open in a browser.
        if (!URL.canParse(targetUrl)) {
            return;
        }
        const targetUrlObj = new URL(targetUrl);
        const isExternalOrigin = toOriginKey(targetUrlObj) !== appRootOriginKey;
        if (
            isExternalOrigin &&
            (targetUrlObj.protocol === 'http:' ||
                targetUrlObj.protocol === 'https:')
        ) {
            shell.openExternal(targetUrl);
        }
    };
    win.webContents.on('will-navigate', handleNavigation);
    win.webContents.on('will-redirect', handleNavigation);
}

let instance: ElectronMainController | null = null;
export default class ElectronMainController {
    win: BrowserWindow;

    constructor(settingManager: ElectronSettingManager) {
        this.win = this.createWindow(settingManager);
    }

    createWindow(settingManager: ElectronSettingManager) {
        const mainHtmlPath = toAllowedMainHtmlPath(settingManager.mainHtmlPath);
        const routeProps = genRoutProps(mainHtmlPath);
        const webPreferences = genWebPreferences(routeProps.preloadFilePath);
        const win = new BrowserWindow({
            backgroundColor: getAppThemeBackgroundColor(),
            webPreferences,
            // The packaged app gets its icon from electron-builder; `icon.png`
            // only exists at the project root in dev, so set it dev-only.
            ...(isDev
                ? {
                      icon: path.join(
                          app.getAppPath(),
                          'extra-work',
                          'icon-dev.png',
                      ),
                  }
                : {}),
        });
        guardBrowsing(win, webPreferences);
        guardMainNavigation(win);
        win.on('closed', () => {
            process.exit(0);
        });
        win.webContents.on('context-menu', (_event, params) => {
            if (!params.dictionarySuggestions.length) {
                return;
            }
            const menu = new Menu();
            for (const suggestion of params.dictionarySuggestions) {
                menu.append(
                    new MenuItem({
                        label: suggestion,
                        click: () => {
                            win.webContents.replaceMisspelling(suggestion);
                        },
                    }),
                );
            }
            menu.popup();
        });
        routeProps.loadURL(win);
        return win;
    }

    close() {
        attemptClosing(this.win);
        process.exit(0);
    }

    sendMessage(channel: string, data?: any) {
        this.win.webContents.send(channel, data);
    }

    sendScreenMessage(message: ScreenMessageType) {
        this.sendMessage(messageChannels.screenMessage, message);
    }

    changeBible(isNext: boolean) {
        this.sendMessage('app:main:change-bible', isNext);
    }

    ctrlScrolling(isUp: boolean) {
        this.sendMessage('app:main:ctrl-scrolling', isUp);
    }

    sendNotifyInvisibility(screenId: number) {
        this.sendScreenMessage({
            screenId,
            type: 'visible',
            data: {
                isShowing: false,
            },
        });
    }

    static getInstance(settingManager: ElectronSettingManager) {
        instance ??= new this(settingManager);
        return instance;
    }

    gotoSettingHomePage() {
        this.sendMessage('app:main:go-to-setting-home');
    }
}
