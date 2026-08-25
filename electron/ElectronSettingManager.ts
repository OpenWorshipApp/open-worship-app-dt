import fs from 'node:fs';
import path from 'node:path';
import electron, { type BrowserWindow, nativeTheme } from 'electron';

import { htmlFiles } from './fsServe';
import { genTimeoutAttempt } from './electronHelpers';
import {
    checkIsSafeStorageAvailable,
    decryptFromBase64,
    encryptToBase64,
    scrubLegacyPlaintextSecrets,
} from './electronSecureSettingHelpers';

export default class ElectronSettingManager {
    timeoutAttempt = genTimeoutAttempt();
    settingObject: {
        mainWinBounds: Electron.Rectangle | null;
        appScreenDisplayId: number | null;
        mainHtmlPath: string;
        clientSetting: Record<string, any>;
        secureSetting: Record<string, string>;
    } = {
        mainWinBounds: null,
        appScreenDisplayId: null,
        mainHtmlPath: htmlFiles.reader,
        clientSetting: {},
        secureSetting: {},
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
}
