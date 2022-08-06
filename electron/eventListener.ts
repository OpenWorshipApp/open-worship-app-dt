import ElectronAppController from './ElectronAppController';
import { isDev } from './helpers';
import ElectronPresentController from './ElectronPresentController';

import { readValue } from './sqlite3';
const crypto = require('crypto');
const electron = require('electron');

const { dialog, ipcMain, app } = electron;

let apiUrl = process.env.API_URL;
let key = process.env.API_KEY;
if (!isDev) {
    const ow = require('../build/Release/ow');
    apiUrl = ow.getApiUrl();
    key = ow.getApiKey();
}
function hasXApiKey() {
    const timeStr = Date.now().toString();
    const md5sum = crypto.createHash('md5').update(key + timeStr);
    return `${timeStr}.${md5sum.digest('hex')}`;
}

export type AnyObjectType = {
    [key: string]: any;
};

export type PresentMessageType = {
    presentId: number,
    type: 'background' | 'display-change' | 'visible',
    data: AnyObjectType,
};

export const presentMessageChannel = 'app:present:message';

export function initApp(appController: ElectronAppController) {
    ipcMain.on('main:app:get-data-path', (event) => {
        event.returnValue = app.getPath('userData');
    });
    ipcMain.on('main:app:select-dirs', async (event) => {
        const result = await dialog.showOpenDialog(appController.mainWin, {
            properties: ['openDirectory'],
        });
        event.returnValue = result.filePaths;
    });
    ipcMain.on('main:app:select-files', async (event, filters) => {
        const result = await dialog.showOpenDialog(appController.mainWin, {
            properties: ['openFile', 'multiSelections'],
            filters,
        });
        event.returnValue = result.filePaths;
    });

    ipcMain.on('main:app:db-read', async (event, data) => {
        const value = await readValue(data.dbFilePath, data.table, data.key);
        event.reply(data.waitingEventName, value);
    });

    ipcMain.on('app:app:https-credential', (event) => {
        event.returnValue = {
            apiUrl,
            apiKey: hasXApiKey(),
        };
    });
}
export function initPresent(appController: ElectronAppController) {
    ipcMain.on('main:app:get-displays', (event) => {
        event.returnValue = {
            primaryDisplay: appController.settingController.primaryDisplay,
            displays: appController.settingController.allDisplays,
        };
    });
    ipcMain.on('main:app:get-presents', (event) => {
        event.returnValue = ElectronPresentController.getAllIds();
    });
    // TODO: use shareProps.mainWin.on or shareProps.presentWin.on
    ipcMain.on('main:app:show-present', (event, data: {
        presentId: number,
        displayId: number,
    }) => {
        const presentController = ElectronPresentController.createInstance(data.presentId);
        const display = appController.settingController.
            getDisplayById(data.displayId);
        if (display !== undefined) {
            presentController.setDisplay(display);
            event.returnValue = true;
        } else {
            event.returnValue = true;
        }
        appController.mainWin.focus();
    });
    ipcMain.on('app:hide-present', (_, presentId: number) => {
        const presentController = ElectronPresentController.getInstance(presentId);
        if (presentController !== null) {
            presentController.hide();
            appController.mainController.sendMessage({
                presentId,
                type: 'visible',
                data: {
                    isShowing: false,
                },
            });
        }
    });
    ipcMain.on('main:app:set-present-display', (event, data: {
        presentId: number,
        displayId: number,
    }) => {
        const display = appController.settingController.
            getDisplayById(data.displayId);
        const presentController = ElectronPresentController.getInstance(data.presentId);
        if (display !== undefined && presentController !== null) {
            presentController.setDisplay(display);
            event.returnValue = display;
        } else {
            event.returnValue = null;
        }
    });
    ipcMain.on('main-app-present:message', async (_, data: {
        presentId: number,
        message: any,
        replyEventName: string,
    }) => {
        const presentController = ElectronPresentController.getInstance(data.presentId);
        if (presentController !== null) {
            const result = presentController.sendMessage(data.message);
            appController.mainWin.webContents.send(data.replyEventName, result);
        }
    });
    ipcMain.on('present:app:change-bible', (_, isNext) => {
        appController.mainController.changeBible(isNext);
    });
    ipcMain.on('present:app:ctrl-scrolling', (_, isUp) => {
        appController.mainController.ctrlScrolling(isUp);
    });
}
