/**
 * Help -> Factory Reset (2026-11-05, the user's ask with the Help menu in a
 * picture: _reset all setting, just in case there is an unrecoverable error,
 * so the user has the ability to reset_).
 *
 * The way back when a setting has broken the app. Every page may be blank or
 * throwing by then, and Settings -> Clear All Settings is a page too, so this
 * belongs to the main process: an item in the native menu, a native dialog,
 * and the work done by the NEXT process, before anything there reads a
 * setting. Done in this one, a window closing for the restart could still
 * write its own settings back over the reset (they write on the way out).
 *
 * Asked for by a marker file in `userData`, not by an argument on the
 * relaunch: the next start takes the marker away as it acts on it, so nothing
 * that ever restarts the app with the same command line can reset it twice.
 *
 * What is reset is everything the app keeps as a setting -- the same three
 * stores Clear All Settings empties, plus what that button cannot reach:
 *  - `<userData>/setting.json`: the computer's settings (the language, which
 *    data folder, the AI switch, ...), every credential (`secureSetting`),
 *    the window places, the theme;
 *  - `local-storage/` of the data folder in use, and of `userData` itself,
 *    which is the data folder while none is chosen;
 *  - the windows' own browser `localStorage` (the AI caution's "hide for 30
 *    days", `aiCautionHelpers`).
 * Nothing else: documents, songs, Bibles, installed languages and the rest of
 * the data folder stay where they are, to be chosen again.
 */
import fs from 'node:fs';
import path from 'node:path';

import { app, BrowserWindow, dialog, session } from 'electron';

import {
    DATA_DIR_LOCAL_STORAGE_FOLDER_NAME,
    SELECTED_PARENT_DIR_SETTING_NAME,
} from './dataDirSettingProtocol';
import { relaunchApp } from './taskbarHelpers';

export const FACTORY_RESET_LABEL = 'Factory Reset';
export const FACTORY_RESET_MARKER_FILE_NAME = 'factory-reset-pending';
// `ElectronSettingManager.fileSettingPath`, `checkIsAiEnabled`.
const SETTING_FILE_NAME = 'setting.json';

function getMarkerFilePath() {
    return path.join(app.getPath('userData'), FACTORY_RESET_MARKER_FILE_NAME);
}

function genConfirmDetail(dataDirPath: string | null) {
    const lineList = [
        'Every setting goes back to how it was when the app was installed: ' +
            'the language, the data folder in use, window positions, ' +
            'screens, AI keys and sign-ins.',
        'Your documents, songs, Bibles and other files are not deleted.' +
            (dataDirPath
                ? ` They stay in "${dataDirPath}": choose that folder ` +
                  'again after the restart.'
                : ''),
        'The app closes and opens again. Anything not saved is lost, and ' +
            'the reset cannot be undone.',
    ];
    return lineList.join('\n\n');
}

/**
 * Asked first, in a native dialog with Cancel as the default button: the
 * reset cannot be undone, and the window the app's own confirm would be drawn
 * in may be the one that is broken.
 */
export async function confirmFactoryReset(dataDirPath: string | null) {
    const options = {
        type: 'warning' as const,
        title: FACTORY_RESET_LABEL,
        message: 'Reset every setting and restart the app?',
        detail: genConfirmDetail(dataDirPath),
        buttons: [FACTORY_RESET_LABEL, 'Cancel'],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
    };
    const win = BrowserWindow.getFocusedWindow();
    const { response } = await (win
        ? dialog.showMessageBox(win, options)
        : dialog.showMessageBox(options));
    if (response !== 0) {
        return;
    }
    try {
        fs.writeFileSync(getMarkerFilePath(), new Date().toISOString(), 'utf8');
    } catch (error) {
        // Restarting without the marker would reset nothing while seeming
        // to: say so and stay.
        console.log('Factory reset could not be asked for', error);
        dialog.showErrorBox(
            FACTORY_RESET_LABEL,
            'The reset could not be started, nothing was changed.\n\n' +
                String(error),
        );
        return;
    }
    relaunchApp();
}

/**
 * True once when a reset was asked for: the marker is gone after this, so
 * the reset happens on exactly one start. Called only by the process holding
 * the single-instance lock -- a second launch must never reset the settings
 * of the app already running.
 */
export function takeFactoryResetRequest() {
    try {
        fs.unlinkSync(getMarkerFilePath());
        return true;
    } catch (_error) {
        return false;
    }
}

// The one recorded in `setting.json`, if any. Only an absolute path: an empty
// or relative one would aim the reset at the process's working directory.
function readChosenDataDirPath(settingFilePath: string) {
    try {
        const json = JSON.parse(fs.readFileSync(settingFilePath, 'utf8'));
        const chosen = json?.clientSetting?.[SELECTED_PARENT_DIR_SETTING_NAME];
        if (typeof chosen === 'string' && path.isAbsolute(chosen)) {
            return chosen;
        }
    } catch (_error) {}
    return null;
}

// Only the files directly in it: each is one setting, named after its key (or
// an atomic write's leftover). A folder in there is nobody's setting.
function clearSettingFolder(dirPath: string) {
    let entryList: fs.Dirent[];
    try {
        entryList = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (error: any) {
        // A folder never written to, or a stick that is not plugged in.
        if (error?.code !== 'ENOENT') {
            console.log('Factory reset could not read', dirPath, error);
        }
        return;
    }
    for (const entry of entryList) {
        if (!entry.isFile()) {
            continue;
        }
        try {
            fs.unlinkSync(path.join(dirPath, entry.name));
        } catch (error) {
            console.log('Factory reset could not remove', entry.name, error);
        }
    }
}

/**
 * The files. Before `ready` and before anything reads a setting: the AI
 * master switch is read off `setting.json` before the debugging door opens.
 */
export function resetAllSettingFiles() {
    const userDataPath = app.getPath('userData');
    const settingFilePath = path.join(userDataPath, SETTING_FILE_NAME);
    // Read before `setting.json` goes: it is the only record of the folder.
    const chosenDataDirPath = readChosenDataDirPath(settingFilePath);
    for (const dirPath of [userDataPath, chosenDataDirPath]) {
        if (dirPath !== null) {
            clearSettingFolder(
                path.join(dirPath, DATA_DIR_LOCAL_STORAGE_FOLDER_NAME),
            );
        }
    }
    try {
        fs.rmSync(settingFilePath, { force: true });
    } catch (error) {
        console.log('Factory reset could not remove', settingFilePath, error);
    }
    console.log('Factory reset: every setting removed');
}

/** The windows' `localStorage`. After `ready`, before the first window. */
export async function resetBrowserSettingStorage() {
    try {
        await session.defaultSession.clearStorageData({
            storages: ['localstorage'],
        });
    } catch (error) {
        console.log('Factory reset could not clear the local storage', error);
    }
}
