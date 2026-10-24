import { BrowserWindow } from 'electron';

import { type AnyObjectType } from './electronEventListener';
import { genKeepAwake } from './keepAwakeHelpers';
import { genRoutProps } from './protocolHelpers';
import { htmlFiles } from './fsServe';
import { screenMirrorRuntime } from './screenMirrorRuntime';
import {
    applyRendererRecovery,
    attemptClosing,
    genWebPreferences,
    guardBrowsing,
    messageChannels,
} from './electronHelpers';

const routeProps = genRoutProps(htmlFiles.screen);
const cache = new Map<string, ElectronScreenController>();
export default class ElectronScreenController {
    win: BrowserWindow;
    screenId: number;
    // Set while the screen is being handed to a virtual display: its window
    // closes, but the screen is still showing and nobody may be told otherwise.
    isMoving = false;

    constructor(screenId: number) {
        this.screenId = screenId;
        this.win = this.createWindow();
    }

    createWindow() {
        const isWin32 = process.platform === 'win32';
        const isScreenCanFullScreen = isWin32;
        const webPreferences = genWebPreferences(routeProps.preloadFilePath);
        const win = new BrowserWindow({
            x: 0,
            y: 0,
            transparent: true,
            frame: false,
            webPreferences,
        });
        guardBrowsing(win, webPreferences);
        // A screen window lives only while its screen is showing, so it keeps
        // the display awake for exactly that long.
        const setIsAwake = genKeepAwake();
        setIsAwake(true);
        win.once('closed', () => {
            setIsAwake(false);
        });
        const query = `?screenId=${this.screenId}`;
        const loadScreen = () => {
            const httpUrl = screenMirrorRuntime.screenUrl?.(this.screenId);
            if (httpUrl) void win.loadURL(httpUrl);
            else routeProps.loadURL(win, query);
        };
        applyRendererRecovery(win, () => {
            loadScreen();
        });
        loadScreen();
        if (isScreenCanFullScreen) {
            win.setFullScreen(true);
        }
        win.on('close', () => {
            this.destroyInstance();
        });
        return win;
    }

    listenLoading() {
        if (this.win.webContents.isLoading?.() === false)
            return Promise.resolve();
        return new Promise<void>((resolve) => {
            this.win.webContents.once('did-finish-load', () => {
                resolve();
            });
        });
    }

    destroyInstance() {
        // A detached window shares its id with a cached one; closing it must
        // not drop the other from the cache.
        const key = this.screenId.toString();
        if (cache.get(key) === this) cache.delete(key);
    }

    close() {
        attemptClosing(this.win);
    }

    setDisplay(display: Electron.Display) {
        const { bounds } = display;
        this.win.setBounds(bounds);
        const actualBounds = this.win.getBounds();
        const actualAspectRatio = Math.min(
            actualBounds.width / bounds.width,
            actualBounds.height / bounds.height,
        );
        const newWidth = Math.floor(bounds.width * actualAspectRatio);
        const newHeight = Math.floor(bounds.height * actualAspectRatio);
        const newX = Math.floor(bounds.x + (bounds.width - newWidth) / 2);
        const newBounds = {
            x: newX,
            y: actualBounds.y,
            width: newWidth,
            height: newHeight,
        };
        this.win.setBounds(newBounds);
        this.win.webContents.reload();
    }

    sendData(channel: string, data: any) {
        this.win.webContents.send(channel, data);
    }

    sendMessage(type: string, data: AnyObjectType) {
        this.win.webContents.send(messageChannels.screenMessage, {
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

    // A screen window kept outside the cache: Screen Mirror shows each host's
    // screen in one, under the host's own screen id, so two hosts' screen 0
    // and this computer's own screen 0 can all be up at once.
    static createDetached(screenId: number) {
        return new this(screenId);
    }

    static getInstance(screenId: number) {
        const key = screenId.toString();
        if (!cache.has(key)) {
            return null;
        }
        return cache.get(key) as ElectronScreenController;
    }

    static closeAll() {
        cache.forEach((screenController) => {
            attemptClosing(screenController);
            screenController.destroyInstance();
        });
    }
}
