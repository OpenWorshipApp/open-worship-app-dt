import { BrowserWindow } from 'electron';

import { genRoutProps } from './protocolHelpers';
import { htmlFiles } from './fsServe';
import {
    attemptClosing,
    getAppThemeBackgroundColor,
    isSecured,
} from './electronHelpers';
import type ElectronSettingManager from './ElectronSettingManager';

const displayPercent = 0.9;

const routeProps = genRoutProps(htmlFiles.setting);
export default class ElectronSettingController {
    win: BrowserWindow | null = null;
    mainWin: BrowserWindow | null = null;

    _resizeCenterSubDisplay({
        x,
        y,
        width,
        height,
    }: {
        x: number;
        y: number;
        width: number;
        height: number;
    }) {
        return {
            x: Math.floor(x - (width * (1 - displayPercent)) / 2),
            y: Math.floor(y - (height * (1 - displayPercent)) / 2),
            width: Math.floor(width * displayPercent),
            height: Math.floor(height * displayPercent),
        };
    }

    getSubDisplay(settingManager: ElectronSettingManager) {
        const mainWinBounds = settingManager.settingObject.mainWinBounds;
        if (mainWinBounds === null) {
            const primaryDisplay = settingManager.primaryDisplay;
            return this._resizeCenterSubDisplay({
                x: primaryDisplay.bounds.x,
                y: primaryDisplay.bounds.y,
                width: primaryDisplay.bounds.width,
                height: primaryDisplay.bounds.height,
            });
        }
        const { x, y, width, height } = mainWinBounds;
        return this._resizeCenterSubDisplay({
            x,
            y,
            width,
            height,
        });
    }

    createWindow(
        mainWin: BrowserWindow,
        settingManager: ElectronSettingManager,
    ) {
        const { x, y, width, height } = this.getSubDisplay(settingManager);
        const win = new BrowserWindow({
            backgroundColor: getAppThemeBackgroundColor(),
            x,
            y,
            width,
            height,
            webPreferences: {
                webSecurity: isSecured,
                nodeIntegration: true,
                contextIsolation: false,
                preload: routeProps.preloadFilePath,
            },
            parent: mainWin,
            autoHideMenuBar: true,
        });
        routeProps.loadURL(win);
        return win;
    }
    open(mainWin: BrowserWindow, settingManager: ElectronSettingManager) {
        if (this.win === null) {
            this.mainWin = mainWin;
            this.win = this.createWindow(mainWin, settingManager);
            this.win.on('closed', () => {
                attemptClosing(this);
            });
        } else {
            this.win.show();
        }
    }
    close() {
        this.mainWin?.reload();
        attemptClosing(this.win);
        this.mainWin = null;
        this.win = null;
    }
}
