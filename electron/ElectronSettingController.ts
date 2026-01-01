import { BrowserWindow } from 'electron';

import { genRoutProps } from './protocolHelpers';
import { htmlFiles } from './fsServe';
import {
    attemptClosing,
    genCenterSubDisplay,
    genWebPreferences,
    getAppThemeBackgroundColor,
    guardBrowsing,
} from './electronHelpers';
import type ElectronSettingManager from './ElectronSettingManager';

const displayPercent = 0.9;

const routeProps = genRoutProps(htmlFiles.setting);
export default class ElectronSettingController {
    win: BrowserWindow | null = null;
    mainWin: BrowserWindow | null = null;

    getSubDisplay(settingManager: ElectronSettingManager) {
        const mainWinBounds = settingManager.settingObject.mainWinBounds;
        if (mainWinBounds === null) {
            const primaryDisplay = settingManager.primaryDisplay;
            return genCenterSubDisplay({
                displayPercent,
                x: primaryDisplay.bounds.x,
                y: primaryDisplay.bounds.y,
                width: primaryDisplay.bounds.width,
                height: primaryDisplay.bounds.height,
            });
        }
        const { x, y, width, height } = mainWinBounds;
        return genCenterSubDisplay({
            displayPercent,
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
        const webPreferences = genWebPreferences(routeProps.preloadFilePath);
        const win = new BrowserWindow({
            backgroundColor: getAppThemeBackgroundColor(),
            x,
            y,
            width,
            height,
            webPreferences,
            parent: mainWin,
            autoHideMenuBar: true,
        });
        guardBrowsing(win, webPreferences);
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
