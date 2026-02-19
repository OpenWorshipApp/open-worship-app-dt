import { BrowserWindow } from 'electron';

import { genRoutProps } from './protocolHelpers';
import { htmlFiles } from './fsServe';
import {
    attemptClosing,
    genWebPreferences,
    getAppThemeBackgroundColor,
    guardBrowsing,
} from './electronHelpers';

const routeProps = genRoutProps(htmlFiles.finder);
export default class ElectronFinderController {
    win: BrowserWindow | null = null;
    mainWin: BrowserWindow | null = null;
    createWindow(mainWin: BrowserWindow) {
        const webPreferences = genWebPreferences(routeProps.preloadFilePath);
        const mainBounds = mainWin.getBounds();
        const win = new BrowserWindow({
            backgroundColor: getAppThemeBackgroundColor(),
            x: mainBounds.x,
            y: mainBounds.y,
            width: 270,
            height: 80,
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
        this.mainWin?.webContents.stopFindInPage('clearSelection');
        attemptClosing(this.win);
        this.mainWin = null;
        this.win = null;
    }
}
