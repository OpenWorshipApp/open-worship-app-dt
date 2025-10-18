import fs from 'node:fs';
import path from 'node:path';
import electron, { BrowserWindow } from 'electron';

import { htmlFiles } from './fsServe';

const settingObject: {
    mainWinBounds: Electron.Rectangle | null;
    appScreenDisplayId: number | null;
    mainHtmlPath: string;
} = {
    mainWinBounds: null,
    appScreenDisplayId: null,
    mainHtmlPath: htmlFiles.presenter,
};
export default class ElectronSettingController {
    constructor() {
        try {
            const str = fs.readFileSync(this.fileSettingPath, 'utf8');
            const json = JSON.parse(str);
            settingObject.mainWinBounds = json.mainWinBounds;
            settingObject.appScreenDisplayId = json.appScreenDisplayId;
            settingObject.mainHtmlPath =
                json.mainHtmlPath ?? settingObject.mainHtmlPath;
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                this.save();
            } else {
                console.log(error);
            }
        }
    }

    get fileSettingPath() {
        const useDataPath = electron.app.getPath('userData');
        return path.join(useDataPath, 'setting.json');
    }

    get isWinMaximized() {
        return (
            (settingObject.mainWinBounds?.width ?? 0) >=
                this.primaryDisplay.bounds.width &&
            (settingObject.mainWinBounds?.height ?? 0) >=
                this.primaryDisplay.bounds.height
        );
    }

    get mainWinBounds() {
        return settingObject.mainWinBounds ?? this.primaryDisplay.bounds;
    }

    set mainWinBounds(bounds) {
        settingObject.mainWinBounds = bounds;
        this.save();
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
            return display.id == displayId;
        });
    }

    save() {
        fs.writeFileSync(
            this.fileSettingPath,
            JSON.stringify(settingObject),
            'utf8',
        );
    }

    syncMainWindow(win: BrowserWindow) {
        win.setBounds(this.mainWinBounds);
        if (this.isWinMaximized) {
            win.maximize();
        }
        win.on('resize', () => {
            const [width, height] = win.getSize();
            this.mainWinBounds = { ...this.mainWinBounds, width, height };
        });
        win.on('maximize', () => {
            this.mainWinBounds = {
                ...this.mainWinBounds,
                width: this.primaryDisplay.bounds.width,
                height: this.primaryDisplay.bounds.height,
            };
        });
        win.on('move', () => {
            const [x, y] = win.getPosition();
            this.mainWinBounds = { ...this.mainWinBounds, x, y };
        });
    }

    get mainHtmlPath() {
        return settingObject.mainHtmlPath;
    }

    set mainHtmlPath(path: string) {
        settingObject.mainHtmlPath = path;
        this.save();
    }
}
