import { BrowserWindow } from 'electron';

import { genRoutProps } from './protocolHelpers';
import { htmlFiles } from './fsServe';
import {
    attemptClosing,
    genWebPreferences,
    getAppThemeBackgroundColor,
    getCenterScreenPosition,
    guardBrowsing,
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
