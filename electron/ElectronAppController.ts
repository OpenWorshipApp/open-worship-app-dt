import { app, BrowserWindow } from 'electron';

import ElectronFinderController from './ElectronFinderController';
import ElectronMainController from './ElectronMainController';
import ElectronSettingManager from './ElectronSettingManager';
import { getCurrent } from './fsServe';
import ElectronAboutController from './ElectronAboutController';
import { getAppThemeBackgroundColor } from './electronHelpers';
import ElectronLWShareController from './ElectronLWShareController';

let instance: ElectronAppController | null = null;
let settingManager: ElectronSettingManager | null = null;
let finderController: ElectronFinderController | null = null;
let lwShareController: ElectronLWShareController | null = null;
let aboutController: ElectronAboutController | null = null;
export default class ElectronAppController {
    constructor() {
        this.settingController.syncMainWindow(this.mainWin);
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                this.settingController.syncMainWindow(this.mainWin);
            }
        });
        const webContents = this.mainWin.webContents;
        webContents.on('did-finish-load', () => {
            this.settingController.mainHtmlPath = getCurrent(webContents);
        });
    }

    get mainWin() {
        return this.mainController.win;
    }

    get settingController() {
        if (settingManager === null) {
            settingManager = new ElectronSettingManager();
        }
        return settingManager;
    }

    get mainController() {
        return ElectronMainController.getInstance(this.settingController);
    }

    get finderController() {
        if (finderController === null) {
            finderController = new ElectronFinderController();
        }
        return finderController;
    }

    get lwShareController() {
        if (lwShareController === null) {
            lwShareController = new ElectronLWShareController();
        }
        return lwShareController;
    }

    get aboutController() {
        if (aboutController === null) {
            aboutController = new ElectronAboutController();
        }
        return aboutController;
    }

    static getInstance() {
        if (instance === null) {
            instance = new ElectronAppController();
        }
        return instance;
    }

    resetThemeBackgroundColor() {
        const backgroundColor = getAppThemeBackgroundColor();
        this.mainWin.setBackgroundColor(backgroundColor);
        this.finderController.win?.setBackgroundColor(backgroundColor);
        this.lwShareController.win?.setBackgroundColor(backgroundColor);
        this.aboutController.win?.setBackgroundColor(backgroundColor);
    }
}
