import { app, BrowserWindow } from 'electron';

import ElectronMainController from './ElectronMainController';
import ElectronSettingManager from './ElectronSettingManager';
import { getCurrent, htmlFiles } from './fsServe';
import { getAppThemeBackgroundColor, messageChannels } from './electronHelpers';
import ElectronLWShareController from './ElectronLWShareController';

let instance: ElectronAppController | null = null;
let lwShareController: ElectronLWShareController | null = null;

// A window `reloadAll` and `sendMessageToAll` may reach. Its webContents is
// checked on its own: closing the help window runs its `destroyed` listener
// (`all:app:chatbot-busy` in `electronEventListener.ts`) while its
// BrowserWindow is still listed and not yet destroyed, and `getURL()` on the
// gone webContents threw "Object has been destroyed" -- an uncaught exception
// in the main process, Electron's blocking error dialog.
function checkIsReachableWindow(win: BrowserWindow) {
    if (win.isDestroyed() || win.webContents.isDestroyed()) {
        return false;
    }
    const url = win.webContents.getURL();
    return (
        !url.includes(htmlFiles.screen) &&
        // A virtual display's compositor: reloading it cuts every stream.
        !url.includes(htmlFiles.virtualDisplay)
    );
}

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
        return ElectronSettingManager.getInstance();
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

    // Help -> Report a Problem: the assistant opened already asking what
    // went wrong. The window asks its own caution first, as for the item
    // above it.
    openChatbotReportPage() {
        this.mainController.sendMessage(messageChannels.openChatbotReport);
    }

    openChatbotPage() {
        this.mainController.sendMessage(messageChannels.openChatbotPage);
    }

    // The taskbar icon's Tasks -> App Help (Chatbot): the same window with
    // no caution in front of it, at the user's word.
    openChatbotFromTaskbar() {
        this.mainController.sendMessage(messageChannels.openChatbotFromTaskbar);
    }

    openAiChatPage() {
        this.mainController.sendMessage(messageChannels.openAiChatPage);
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
    // About, the document/lyric/bible-note/web editors) are created off
    // `setWindowOpenHandler` in `createPopupWindow` and are registered nowhere,
    // so enumerate the live windows instead — otherwise `Apply Settings` leaves
    // every open popup on the old language, theme and directory paths.
    // Screen output windows are skipped on purpose: reloading one blanks a live
    // presentation, and the presenter re-pushes their content on its own reload.
    reloadAll() {
        for (const win of BrowserWindow.getAllWindows()) {
            if (checkIsReachableWindow(win)) {
                win.reload();
            }
        }
    }

    // Same enumeration as `reloadAll`, and for the same reason: popups are
    // registered nowhere, so a message only `allWindows()` knows about would
    // miss the Settings window — which is the one that needs most of them.
    sendMessageToAll(channel: string, ...args: any[]) {
        for (const win of BrowserWindow.getAllWindows()) {
            if (checkIsReachableWindow(win)) {
                win.webContents.send(channel, ...args);
            }
        }
    }
}
