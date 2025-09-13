import { BrowserWindow, Menu, MenuItem, shell } from 'electron';

import { channels, ScreenMessageType } from './electronEventListener';
import { genRoutProps } from './protocolHelpers';
import ElectronSettingController from './ElectronSettingController';
import { attemptClosing, isSecured } from './electronHelpers';

let instance: ElectronMainController | null = null;
export default class ElectronMainController {
    win: BrowserWindow;

    constructor(settingController: ElectronSettingController) {
        this.win = this.createWindow(settingController);
    }

    previewPdf(pdfFilePath: string) {
        const mainWin = this.win;
        const pdfWin = new BrowserWindow({
            parent: mainWin,
        });
        pdfWin.loadURL(pdfFilePath);
    }

    createWindow(settingController: ElectronSettingController) {
        const routeProps = genRoutProps(settingController.mainHtmlPath);
        const win = new BrowserWindow({
            backgroundColor: '#000000',
            x: 0,
            y: 0,
            webPreferences: {
                webSecurity: isSecured,
                nodeIntegration: true,
                contextIsolation: false,
                preload: routeProps.preloadFilePath,
            },
        });
        win.webContents.setWindowOpenHandler(({ url }) => {
            shell.openExternal(url);
            return { action: 'deny' };
        });
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

    static getInstance(settingController: ElectronSettingController) {
        if (instance === null) {
            instance = new this(settingController);
        }
        return instance;
    }
}
