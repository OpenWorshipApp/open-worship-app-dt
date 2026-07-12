import fs from 'node:fs';
import path from 'node:path';
import electron, { type BrowserWindow, nativeTheme } from 'electron';

import { htmlFiles } from './fsServe';
import { genTimeoutAttempt } from './electronHelpers';

export default class ElectronSettingManager {
    timeoutAttempt = genTimeoutAttempt();
    settingObject: {
        mainWinBounds: Electron.Rectangle | null;
        appScreenDisplayId: number | null;
        mainHtmlPath: string;
        clientSetting: Record<string, any>;
    } = {
        mainWinBounds: null,
        appScreenDisplayId: null,
        mainHtmlPath: htmlFiles.reader,
        clientSetting: {},
    };
    constructor() {
        try {
            console.log('Reading setting from', this.fileSettingPath);
            const str = fs.readFileSync(this.fileSettingPath, 'utf8').trim();
            let json;
            if (str === '') {
                json = {};
            } else {
                json = JSON.parse(str);
            }
            this.settingObject.mainWinBounds = json.mainWinBounds;
            this.settingObject.appScreenDisplayId = json.appScreenDisplayId;
            this.settingObject.mainHtmlPath =
                json.mainHtmlPath ?? this.settingObject.mainHtmlPath;
            nativeTheme.themeSource = json.themeSource ?? 'system';
            this.settingObject.clientSetting = json.clientSetting ?? {};
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                this.save();
            } else {
                console.log(error);
            }
        }
    }

    get fileSettingPath() {
        const userDataPath = electron.app.getPath('userData');
        return path.join(userDataPath, 'setting.json');
    }

    get isWinMaximized() {
        return (
            (this.settingObject.mainWinBounds?.width ?? 0) >=
                this.primaryDisplay.bounds.width &&
            (this.settingObject.mainWinBounds?.height ?? 0) >=
                this.primaryDisplay.bounds.height
        );
    }

    get mainWinBounds() {
        return this.settingObject.mainWinBounds ?? this.primaryDisplay.bounds;
    }

    set mainWinBounds(bounds) {
        this.settingObject.mainWinBounds = bounds;
        this.save();
    }

    get themeSource() {
        return nativeTheme.themeSource;
    }

    set themeSource(themeSource: 'light' | 'dark' | 'system') {
        nativeTheme.themeSource = themeSource;
        this.save();
    }

    applyMainWindowBounds(
        win: BrowserWindow,
        { width, height }: { width?: number; height?: number } = {},
    ) {
        const [x, y] = win.getPosition();
        const [currentWidth, currentHeight] = win.getSize();
        const mainWinBounds = this.mainWinBounds;
        this.mainWinBounds = {
            ...mainWinBounds,
            x,
            y,
            width: width ?? currentWidth,
            height: height ?? currentHeight,
        };
    }

    restoreMainBounds(win: BrowserWindow) {
        // TODO: check if bounds are valid (outside of screen) reset to default
        this.mainWinBounds = this.primaryDisplay.bounds;
        win.setBounds(this.mainWinBounds);
    }

    get allDisplays() {
        return electron.screen.getAllDisplays();
    }

    get primaryDisplay() {
        return electron.screen.getPrimaryDisplay();
    }

    getDisplayById(displayId: number) {
        return this.allDisplays.find((display) => {
            return display.id === displayId;
        });
    }

    save() {
        const data = {
            ...this.settingObject,
            themeSource: nativeTheme.themeSource,
        };
        this.timeoutAttempt(() => {
            try {
                fs.writeFileSync(
                    this.fileSettingPath,
                    JSON.stringify(data),
                    'utf8',
                );
                console.log('Setting saved');
            } catch (error) {
                console.log('Error saving setting', error);
            }
        });
    }

    syncMainWindow(win: BrowserWindow) {
        win.setBounds(this.mainWinBounds);
        if (this.isWinMaximized) {
            win.maximize();
        }
        win.on('resize', () => {
            this.applyMainWindowBounds(win);
        });
        win.on('maximize', () => {
            this.applyMainWindowBounds(win, {
                width: this.primaryDisplay.bounds.width,
                height: this.primaryDisplay.bounds.height,
            });
        });
        win.on('move', () => {
            this.applyMainWindowBounds(win);
        });
    }

    get mainHtmlPath() {
        return this.settingObject.mainHtmlPath;
    }

    set mainHtmlPath(path: string) {
        this.settingObject.mainHtmlPath = path;
        this.save();
    }

    getClientSetting(key: string) {
        const value = this.settingObject.clientSetting[key];
        if (typeof value !== 'string') {
            return null;
        }
        return value;
    }
    setClientSetting(key: string, value: any) {
        if (typeof value !== 'string') {
            value = null;
        }
        this.settingObject.clientSetting[key] = value;
        this.save();
    }
    deleteClientSetting(key: string) {
        delete this.settingObject.clientSetting[key];
        this.save();
    }
    getAllClientSettingKeys() {
        return Object.keys(this.settingObject.clientSetting);
    }
    clearClientSettings() {
        this.settingObject.clientSetting = {};
        this.save();
    }
}
