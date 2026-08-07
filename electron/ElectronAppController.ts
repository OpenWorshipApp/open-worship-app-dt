import { app, BrowserWindow } from 'electron';

import ElectronMainController from './ElectronMainController';
import ElectronSettingManager from './ElectronSettingManager';
import { getCurrent, htmlFiles } from './fsServe';
import { getAppThemeBackgroundColor } from './electronHelpers';
import ElectronLWShareController from './ElectronLWShareController';

let instance: ElectronAppController | null = null;
let settingManager: ElectronSettingManager | null = null;
let lwShareController: ElectronLWShareController | null = null;
export default class ElectronAppController {
    constructor() {
        this.settingManager.syncMainWindow(this.mainWin);
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                this.settingManager.syncMainWindow(this.mainWin);
            }
        });
        const webContents = this.mainWin.webContents;
        webContents.on('did-finish-load', () => {
            this.settingManager.mainHtmlPath = getCurrent(webContents);
        });
    }

    get mainWin() {
        return this.mainController.win;
    }

    get settingManager() {
        settingManager ??= new ElectronSettingManager();
        return settingManager;
    }

    get mainController() {
        return ElectronMainController.getInstance(this.settingManager);
    }

    get lwShareController() {
        lwShareController ??= new ElectronLWShareController();
        return lwShareController;
    }

    openAboutPage() {
        this.mainController.sendMessage('main:app:open-about-page');
    }

    openFindPage() {
        this.mainController.sendMessage('main:app:open-find-page');
    }

    static getInstance() {
        instance ??= new ElectronAppController();
        return instance;
    }

    allWindows() {
        return [this.mainController.win, this.lwShareController.win].filter(
            (win): win is BrowserWindow => {
                return win !== null;
            },
        );
    }

    resetThemeBackgroundColor() {
        const backgroundColor = getAppThemeBackgroundColor();
        this.allWindows().forEach((win) => {
            win.setBackgroundColor(backgroundColor);
        });
    }

    // `allWindows()` only knows the main and LW-share windows. Popups (Settings,
    // About, Finder, the document/lyric/bible-note/web editors) are created off
    // `setWindowOpenHandler` in `createPopupWindow` and are registered nowhere,
    // so enumerate the live windows instead — otherwise `Apply Settings` leaves
    // every open popup on the old language, theme and directory paths.
    // Screen output windows are skipped on purpose: reloading one blanks a live
    // presentation, and the presenter re-pushes their content on its own reload.
    reloadAll() {
        for (const win of BrowserWindow.getAllWindows()) {
            if (
                win.isDestroyed() ||
                win.webContents.getURL().includes(htmlFiles.screen)
            ) {
                continue;
            }
            win.reload();
        }
    }
}
