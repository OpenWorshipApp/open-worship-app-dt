import { BrowserWindow } from 'electron';

import { AnyObjectType, channels } from './electronEventListener';
import { genRoutProps } from './protocolHelpers';
import { htmlFiles } from './fsServe';
import { isSecured } from './electronHelpers';

const routeProps = genRoutProps(htmlFiles.screen);
const cache = new Map<string, ElectronScreenController>();
export default class ElectronScreenController {
    win: BrowserWindow;
    screenId: number;

    constructor(screenId: number) {
        this.screenId = screenId;
        this.win = this.createScreenWindow();
    }

    createScreenWindow() {
        const isWin32 = process.platform === 'win32';
        const isScreenCanFullScreen = isWin32;
        const screenWin = new BrowserWindow({
            transparent: true,
            x: 0,
            y: 0,
            frame: false,
            webPreferences: {
                webSecurity: isSecured,
                nodeIntegration: true,
                contextIsolation: false,
                preload: routeProps.preloadFilePath,
            },
        });
        const query = `?screenId=${this.screenId}`;
        routeProps.loadURL(screenWin, query);
        if (isScreenCanFullScreen) {
            screenWin.setFullScreen(true);
        }
        screenWin.on('close', () => {
            this.destroyInstance();
        });
        return screenWin;
    }

    listenLoading() {
        return new Promise<void>((resolve) => {
            this.win.webContents.once('did-finish-load', () => {
                resolve();
            });
        });
    }

    destroyInstance() {
        cache.delete(this.screenId.toString());
    }

    close() {
        if (!this.win.isDestroyed()) {
            this.win.close();
        }
    }

    setDisplay(display: Electron.Display) {
        const bounds = display.bounds;
        this.win.setBounds(bounds);
        this.win.webContents.executeJavaScript('window.location.reload();');
    }

    sendData(channel: string, data: any) {
        this.win.webContents.send(channel, data);
    }

    sendMessage(type: string, data: AnyObjectType) {
        this.win.webContents.send(channels.screenMessageChannel, {
            screenId: this.screenId,
            type,
            data,
        });
    }

    static getAllIds(): number[] {
        return Array.from(cache.keys()).map((key) => {
            return +key;
        });
    }

    static createInstance(screenId: number) {
        const key = screenId.toString();
        if (!cache.has(key)) {
            const screenController = new this(screenId);
            cache.set(key, screenController);
        }
        return cache.get(key) as ElectronScreenController;
    }

    static getInstance(screenId: number): ElectronScreenController | null {
        const key = screenId.toString();
        if (!cache.has(key)) {
            return null;
        }
        return cache.get(key) as ElectronScreenController;
    }

    static closeAll() {
        cache.forEach((screenController) => {
            screenController.close();
            screenController.destroyInstance();
        });
    }
}
