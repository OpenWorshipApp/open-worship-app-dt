import { BrowserWindow, Menu, MenuItem, shell } from 'electron';

import { channels, ScreenMessageType } from './electronEventListener';
import { genRoutProps } from './protocolHelpers';
import ElectronSettingManager from './ElectronSettingManager';
import {
    attemptClosing,
    genWebPreferences,
    getAppThemeBackgroundColor,
    guardBrowsing,
} from './electronHelpers';

let instance: ElectronMainController | null = null;
export default class ElectronMainController {
    win: BrowserWindow;

    constructor(settingManager: ElectronSettingManager) {
        this.win = this.createWindow(settingManager);
    }

    previewPdf(pdfFilePath: string) {
        const mainWin = this.win;
        const win = new BrowserWindow({
            parent: mainWin,
        });
        win.webContents.setWindowOpenHandler((options) => {
            shell.openExternal(options.url);
            return { action: 'deny' };
        });
        win.loadURL(pdfFilePath);
    }

    createWindow(settingManager: ElectronSettingManager) {
        const routeProps = genRoutProps(settingManager.mainHtmlPath);
        const webPreferences = genWebPreferences(routeProps.preloadFilePath);
        const win = new BrowserWindow({
            backgroundColor: getAppThemeBackgroundColor(),
            webPreferences,
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

    sendMessage(message: ScreenMessageType) {
        this.win.webContents.send(channels.screenMessageChannel, message);
    }

    changeBible(isNext: boolean) {
        this.sendData('app:main:change-bible', isNext);
    }

    ctrlScrolling(isUp: boolean) {
        this.sendData('app:main:ctrl-scrolling', isUp);
    }

    sendNotifyInvisibility(screenId: number) {
        this.sendMessage({
            screenId,
            type: 'visible',
            data: {
                isShowing: false,
            },
        });
    }

    static getInstance(settingManager: ElectronSettingManager) {
        if (instance === null) {
            instance = new this(settingManager);
        }
        return instance;
    }

    gotoSettingHomePage() {
        this.win.webContents.executeJavaScript('openBibleSetting();');
    }
}
