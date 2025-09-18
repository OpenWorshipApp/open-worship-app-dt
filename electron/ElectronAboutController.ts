import { BrowserWindow } from 'electron';

import { genRoutProps } from './protocolHelpers';
import { htmlFiles } from './fsServe';
import {
    attemptClosing,
    getAppThemeBackgroundColor,
    isSecured,
} from './electronHelpers';

const routeProps = genRoutProps(htmlFiles.about);
export default class ElectronAboutController {
    win: BrowserWindow | null = null;
    mainWin: BrowserWindow | null = null;
    createWindow(mainWin: BrowserWindow) {
        const mainBounds = mainWin.getBounds();
        const width = 700;
        const height = 435;
        const x = mainBounds.x + (mainBounds.width - width) / 2;
        const y = mainBounds.y + (mainBounds.height - height) / 2;
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
