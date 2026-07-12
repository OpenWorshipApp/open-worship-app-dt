import { app, BrowserWindow, Menu, MenuItem } from 'electron';
import path from 'node:path';

import {
    type AnyObjectType,
    type ScreenMessageType,
} from './electronEventListener';
import { genRoutProps } from './protocolHelpers';
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

const allowedMainHtmlFiles: string[] = [
    htmlFiles.presenter,
    htmlFiles.reader,
    htmlFiles.appDocumentEditor,
];

function toAllowedMainHtmlPath(mainHtmlPath: string) {
    return allowedMainHtmlFiles.includes(mainHtmlPath)
        ? mainHtmlPath
        : htmlFiles.presenter;
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

    sendData(channel: string, data?: any) {
        this.win.webContents.send(channel, data);
    }

    sendMessage(channel: string, message?: AnyObjectType) {
        this.win.webContents.send(channel, message);
    }

    sendScreenMessage(message: ScreenMessageType) {
        this.sendMessage(messageChannels.screenMessage, message);
    }

    changeBible(isNext: boolean) {
        this.sendData('app:main:change-bible', isNext);
    }

    ctrlScrolling(isUp: boolean) {
        this.sendData('app:main:ctrl-scrolling', isUp);
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
        this.sendData('app:main:go-to-setting-home');
    }
}
