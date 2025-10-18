import { BrowserWindow } from 'electron';

import { genRoutProps } from './protocolHelpers';
import { htmlFiles } from './fsServe';
import {
    attemptClosing,
    getAppThemeBackgroundColor,
    getCenterScreenPosition,
    isSecured,
} from './electronHelpers';
import { join } from 'node:path';

const routeProps = genRoutProps(htmlFiles.lwShare);
export default class ElectronLWShareController {
    win: BrowserWindow | null = null;
    mainWin: BrowserWindow | null = null;
    createWindow(mainWin: BrowserWindow) {
        const { x, y, width, height } = getCenterScreenPosition(mainWin, {
            width: 550,
            height: 600,
        });
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
                preload: join(__dirname, 'client', 'lwShare.preload.js'),
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
        attemptClosing(this.win);
        this.mainWin = null;
        this.win = null;
    }
}
