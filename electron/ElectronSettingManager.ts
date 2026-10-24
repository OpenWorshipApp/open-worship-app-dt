import fs from 'node:fs';
import path from 'node:path';
import electron, { type BrowserWindow, nativeTheme } from 'electron';

import { htmlFiles } from './fsServe';
import { genTimeoutAttempt } from './electronHelpers';
import {
    checkIsDataDirSettingName,
    SELECTED_PARENT_DIR_SETTING_NAME,
} from './dataDirSettingProtocol';
import {
    deleteDataDirSettingFile,
    listDataDirSettingNames,
    readDataDirSettingFile,
    toDataDirSettingPath,
    writeDataDirSettingFile,
} from './dataDirSettingHelpers';
import {
    checkIsSafeStorageAvailable,
    decryptFromBase64,
    encryptToBase64,
    scrubLegacyPlaintextSecrets,
} from './electronSecureSettingHelpers';

export type PopupWinBoundsType = Electron.Rectangle & {
    isMaximized: boolean;
};

// Enough of a window to still be grabbed with the mouse. A remembered
// rectangle that leaves less than this on any display is treated as gone --
// unplugging a second monitor must not strand a popup where it cannot be
// reached.
const MIN_REACHABLE_WIDTH = 120;
const MIN_REACHABLE_HEIGHT = 32;

function checkIsFiniteNumber(value: any) {
    return typeof value === 'number' && Number.isFinite(value);
}

function toValidBounds(value: any): PopupWinBoundsType | null {
    if (typeof value !== 'object' || value === null) {
        return null;
    }
    const { x, y, width, height } = value;
    if (
        !checkIsFiniteNumber(x) ||
        !checkIsFiniteNumber(y) ||
        !checkIsFiniteNumber(width) ||
        !checkIsFiniteNumber(height) ||
        width < 1 ||
        height < 1
    ) {
        return null;
    }
    return {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
        isMaximized: value.isMaximized === true,
    };
}

function toPopupWinBoundsMap(value: any) {
    const boundsMap: Record<string, PopupWinBoundsType> = {};
    if (typeof value !== 'object' || value === null) {
        return boundsMap;
    }
    for (const [key, bounds] of Object.entries(value)) {
        const validBounds = toValidBounds(bounds);
        if (validBounds !== null) {
            boundsMap[key] = validBounds;
        }
    }
    return boundsMap;
}

let instance: ElectronSettingManager | null = null;
export default class ElectronSettingManager {
    timeoutAttempt = genTimeoutAttempt();
    settingObject: {
        mainWinBounds: Electron.Rectangle | null;
        appScreenDisplayId: number | null;
        mainHtmlPath: string;
        clientSetting: Record<string, any>;
        secureSetting: Record<string, string>;
        /**
         * Where the user last left each popup window. Keyed by the popup's own
         * html page (`genPopupBoundsKey` in `electronHelpers.ts`), so it is
         * bounded by the number of pages the app has -- never by the number of
         * documents, notes or pdfs the user has ever opened one for.
         */
        popupWinBoundsMap: Record<string, PopupWinBoundsType>;
    } = {
        mainWinBounds: null,
        appScreenDisplayId: null,
        mainHtmlPath: htmlFiles.reader,
        clientSetting: {},
        secureSetting: {},
        popupWinBoundsMap: {},
    };
    /**
     * Decrypted secure values. Bounded by the number of secure keys (two today,
     * a few hundred bytes), so it is not an accumulating cache. It exists
     * because every `decryptString` is an OS call -- on macOS a Keychain round
     * trip that can raise a system prompt -- and these are read per API request.
     *
     * When secure storage is unavailable it doubles as the ONLY store, keeping
     * credentials usable for the session without ever writing them to disk.
     */
    secureCache = new Map<string, string>();
    isSecureStorageAvailable: boolean | null = null;
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
            this.settingObject.secureSetting = json.secureSetting ?? {};
            this.settingObject.popupWinBoundsMap = toPopupWinBoundsMap(
                json.popupWinBoundsMap,
            );
            if (scrubLegacyPlaintextSecrets(this.settingObject.clientSetting)) {
                // Immediate: cleartext credentials must not survive a crash in
                // the debounce window.
                this.save(true);
            }
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

    /**
     * A remembered rectangle is only usable while a display it overlaps is
     * still attached. Checked against the work area rather than the full
     * display bounds so a window is never handed back behind the taskbar.
     */
    checkIsBoundsReachable(bounds: Electron.Rectangle) {
        return this.allDisplays.some(({ workArea }) => {
            const overlapWidth =
                Math.min(bounds.x + bounds.width, workArea.x + workArea.width) -
                Math.max(bounds.x, workArea.x);
            const overlapHeight =
                Math.min(
                    bounds.y + bounds.height,
                    workArea.y + workArea.height,
                ) - Math.max(bounds.y, workArea.y);
            return (
                overlapWidth >= MIN_REACHABLE_WIDTH &&
                overlapHeight >= MIN_REACHABLE_HEIGHT
            );
        });
    }

    getPopupWinBounds(key: string): PopupWinBoundsType | null {
        const bounds = toValidBounds(this.settingObject.popupWinBoundsMap[key]);
        if (bounds === null || !this.checkIsBoundsReachable(bounds)) {
            return null;
        }
        return bounds;
    }

    setPopupWinBounds(key: string, bounds: PopupWinBoundsType) {
        const validBounds = toValidBounds(bounds);
        if (validBounds === null) {
            return;
        }
        const currentBounds = this.settingObject.popupWinBoundsMap[key];
        // Dragging a window fires a move event per frame; without this every
        // one of them would queue another whole-setting-file write.
        if (
            currentBounds !== undefined &&
            (Object.keys(validBounds) as (keyof PopupWinBoundsType)[]).every(
                (name) => {
                    return currentBounds[name] === validBounds[name];
                },
            )
        ) {
            return;
        }
        this.settingObject.popupWinBoundsMap[key] = validBounds;
        this.save();
    }

    clearPopupWinBounds() {
        if (Object.keys(this.settingObject.popupWinBoundsMap).length === 0) {
            return;
        }
        this.settingObject.popupWinBoundsMap = {};
        this.save();
    }

    /**
     * `isImmediate` skips the 1s debounce. Rescheduling clears the pending
     * timer, so a burst of window move/resize events can starve the write
     * indefinitely -- fine for bounds, data loss for a rotated one-time-use
     * refresh token. Secure writes always pass true.
     */
    save(isImmediate = false) {
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
        }, isImmediate);
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

    /**
     * The data folder in use, where `checkIsDataDirSettingName` settings are
     * kept: the chosen one while it is there, else this profile's own -- where
     * the renderer's `appLocalStorage` keeps its settings too.
     */
    get dataDirPath() {
        const chosen =
            this.settingObject.clientSetting[SELECTED_PARENT_DIR_SETTING_NAME];
        try {
            if (typeof chosen === 'string' && chosen && fs.existsSync(chosen)) {
                return chosen;
            }
        } catch (_error) {}
        return electron.app.getPath('userData');
    }

    getClientSetting(key: string) {
        if (checkIsDataDirSettingName(key)) {
            const value = readDataDirSettingFile(
                toDataDirSettingPath(this.dataDirPath, key),
            );
            if (value !== null) {
                return value;
            }
            // Not moved yet: kept here while no data folder was in use as the
            // app started (`moveSettingsToDataDir`).
        }
        const value = this.settingObject.clientSetting[key];
        if (typeof value !== 'string') {
            return null;
        }
        return value;
    }
    setClientSetting(key: string, value: any) {
        if (checkIsDataDirSettingName(key)) {
            const filePath = toDataDirSettingPath(this.dataDirPath, key);
            if (typeof value === 'string') {
                writeDataDirSettingFile(filePath, value);
            } else {
                deleteDataDirSettingFile(filePath);
            }
            this.dropOldClientSetting(key);
            return;
        }
        if (typeof value !== 'string') {
            value = null;
        }
        this.settingObject.clientSetting[key] = value;
        this.save();
        // A folder chosen now takes what was kept here for one at once, not
        // at the next start: until then a setting changed in it would have
        // left the old global copy of the others behind.
        if (key === SELECTED_PARENT_DIR_SETTING_NAME) {
            this.moveSettingsToDataDir();
        }
    }
    deleteClientSetting(key: string) {
        if (checkIsDataDirSettingName(key)) {
            deleteDataDirSettingFile(
                toDataDirSettingPath(this.dataDirPath, key),
            );
            this.dropOldClientSetting(key);
            return;
        }
        delete this.settingObject.clientSetting[key];
        this.save();
    }
    /**
     * Every key, the data folder's included: Export / Import Settings lists
     * the computer's store this way, and finds them where they always were.
     */
    getAllClientSettingKeys() {
        const keyList = Object.keys(this.settingObject.clientSetting);
        for (const name of listDataDirSettingNames(this.dataDirPath)) {
            if (!keyList.includes(name)) {
                keyList.push(name);
            }
        }
        return keyList;
    }
    // A copy from before the setting went to the data folder: the folder's is
    // the one now, and the old one would read back wherever the folder is not.
    private dropOldClientSetting(key: string) {
        if (key in this.settingObject.clientSetting) {
            delete this.settingObject.clientSetting[key];
            this.save();
        }
    }
    /**
     * Once, at the start: what was kept here before these settings went to
     * the data folder goes INTO the folder in use. Only into one that was
     * chosen and is there -- a stick that is not plugged in keeps them here
     * until it is -- and never over the folder's own.
     */
    moveSettingsToDataDir() {
        const chosen =
            this.settingObject.clientSetting[SELECTED_PARENT_DIR_SETTING_NAME];
        try {
            if (
                typeof chosen !== 'string' ||
                !chosen ||
                !fs.existsSync(chosen)
            ) {
                return;
            }
        } catch (_error) {
            return;
        }
        let isChanged = false;
        for (const key of Object.keys(this.settingObject.clientSetting)) {
            if (!checkIsDataDirSettingName(key)) {
                continue;
            }
            const value = this.settingObject.clientSetting[key];
            const filePath = toDataDirSettingPath(chosen, key);
            const isKept =
                typeof value !== 'string' ||
                readDataDirSettingFile(filePath) !== null ||
                writeDataDirSettingFile(filePath, value);
            if (isKept) {
                delete this.settingObject.clientSetting[key];
                isChanged = true;
            }
        }
        if (isChanged) {
            this.save(true);
        }
    }
    clearClientSettings() {
        this.settingObject.clientSetting = {};
        this.save();
    }

    checkIsSecureStorageAvailable() {
        if (this.isSecureStorageAvailable === null) {
            const isAvailable = checkIsSafeStorageAvailable();
            // A false from the not-ready guard must not latch forever.
            if (isAvailable || electron.app.isReady()) {
                this.isSecureStorageAvailable = isAvailable;
            }
            return isAvailable;
        }
        return this.isSecureStorageAvailable;
    }

    getSecureSetting(key: string) {
        const cachedValue = this.secureCache.get(key);
        if (cachedValue !== undefined) {
            return cachedValue;
        }
        if (!this.checkIsSecureStorageAvailable()) {
            return null;
        }
        const encryptedValue = this.settingObject.secureSetting[key];
        if (typeof encryptedValue !== 'string') {
            return null;
        }
        const value = decryptFromBase64(encryptedValue);
        if (value === null) {
            // Undecryptable, e.g. the profile was copied from another OS user or
            // machine. Drop it so the UI reads "not set" instead of showing a
            // saved credential that nothing can actually use.
            delete this.settingObject.secureSetting[key];
            this.save(true);
            return null;
        }
        this.secureCache.set(key, value);
        return value;
    }

    setSecureSetting(key: string, value: any) {
        if (typeof value !== 'string') {
            // Deliberately NOT the coerce-to-null of `setClientSetting`:
            // silently storing null where a credential belongs is worse than a
            // no-op.
            return;
        }
        this.secureCache.set(key, value);
        if (!this.checkIsSecureStorageAvailable()) {
            // Session only, never written. Any stale blob must go, or a
            // temporarily locked keyring means the user sets a new credential
            // today and silently gets the old one back next launch.
            if (key in this.settingObject.secureSetting) {
                delete this.settingObject.secureSetting[key];
                this.save(true);
            }
            return;
        }
        const encryptedValue = encryptToBase64(value);
        if (encryptedValue === null) {
            return;
        }
        this.settingObject.secureSetting[key] = encryptedValue;
        this.save(true);
    }

    deleteSecureSetting(key: string) {
        this.secureCache.delete(key);
        delete this.settingObject.secureSetting[key];
        this.save(true);
    }

    clearSecureSettings() {
        this.secureCache.clear();
        this.settingObject.secureSetting = {};
        this.save(true);
    }

    // One writer per process: two managers would each hold a full copy of
    // `settingObject` and overwrite each other's `setting.json`.
    static getInstance() {
        if (instance === null) {
            const manager = new this();
            instance = manager;
            manager.moveSettingsToDataDir();
            // `save()` waits a second for more changes, and a quit inside
            // that second (a Restart pressed right after Import Settings)
            // dropped every write still waiting.
            electron.app.on('will-quit', () => {
                manager.save(true);
            });
        }
        return instance;
    }
}
