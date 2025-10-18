import { BrowserWindow } from 'electron';

import { genRoutProps } from './protocolHelpers';
import { htmlFiles } from './fsServe';
import {
    attemptClosing,
    getAppThemeBackgroundColor,
    getCenterScreenPosition,
    isSecured,
} from './electronHelpers';

const routeProps = genRoutProps(htmlFiles.about);
export default class ElectronAboutController {
    win: BrowserWindow | null = null;
    mainWin: BrowserWindow | null = null;
    createWindow(mainWin: BrowserWindow) {
        const { x, y, width, height } = getCenterScreenPosition(mainWin, {
            width: 700,
            height: 435,
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
        attemptClosing(this.win);
        this.mainWin = null;
        this.win = null;
    }
}
