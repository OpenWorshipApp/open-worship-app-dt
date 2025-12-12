import { BrowserWindow } from 'electron';

import { genRoutProps } from './protocolHelpers';
import { htmlFiles } from './fsServe';
import {
    attemptClosing,
    getAppThemeBackgroundColor,
    isSecured,
} from './electronHelpers';

const routeProps = genRoutProps(htmlFiles.setting);
export default class ElectronSettingController {
    win: BrowserWindow | null = null;
    mainWin: BrowserWindow | null = null;
    createWindow(mainWin: BrowserWindow) {
        const win = new BrowserWindow({
            backgroundColor: getAppThemeBackgroundColor(),
            x: 0,
            y: 0,
            width: 270,
            height: 80,
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
    open(mainWin: BrowserWindow) {
        if (this.win === null) {
            this.mainWin = mainWin;
            this.win = this.createWindow(mainWin);
            this.win.on('closed', () => {
                attemptClosing(this);
            });
        } else {
            this.win.show();
        }
    }
    close() {
        this.mainWin?.webContents.stopFindInPage('clearSelection');
        attemptClosing(this.win);
        this.mainWin = null;
        this.win = null;
    }
}
