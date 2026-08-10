import { app } from 'electron';

import type ElectronAppController from './ElectronAppController';
import { isDev, isWindows } from './electronHelpers';

import packageInfo from '../package.json';

export const RESET_WINDOW_BOUNDS_LABEL = 'Reset Position and Size';
export const RESET_WINDOW_BOUNDS_ARG = '--owa-reset-window-bounds';
export const USER_DATA_PATH_ARG_PREFIX = '--owa-user-data-path=';

export function findUserDataPathArg(argv: string[]) {
    const arg = argv.find((item) => {
        return item.startsWith(USER_DATA_PATH_ARG_PREFIX);
    });
    const userDataPath = arg?.slice(USER_DATA_PATH_ARG_PREFIX.length);
    return userDataPath ? userDataPath : null;
}

export function resetMainWindowBounds(appController: ElectronAppController) {
    appController.settingManager.restoreMainBounds(appController.mainWin);
}

// The jump list attaches to the process' Application User Model ID. For the
// installed app it must be exactly the `build.appId` that electron-builder's
// NSIS stamps on the shortcut, or the taskbar treats the running app and its
// pinned shortcut as two different things. Dev keeps its own identity, matching
// how it already keeps its own `userData` dir and single-instance lock.
export function initAppUserModelId() {
    if (!isWindows) {
        return;
    }
    const appId = packageInfo.build.appId;
    app.setAppUserModelId(isDev ? `${appId}.dev` : appId);
}

// A jump list task cannot call into the running app: Windows launches `program`
// with `arguments` and the single-instance lock forwards that argv to us. The
// relaunched process inherits no environment, so `isDev` is false there and
// `applyLaunchOverrides` would aim it at the packaged `userData` — a different
// lock, which would open a whole second app instead of signalling this one.
// Naming the already-resolved dir on the command line keeps dev talking to dev.
function genRelaunchArguments() {
    const parts = [
        // in dev `process.execPath` is electron.exe, which needs the app path
        ...(isDev ? [app.getAppPath()] : []),
        `${USER_DATA_PATH_ARG_PREFIX}${app.getPath('userData')}`,
        RESET_WINDOW_BOUNDS_ARG,
    ];
    return parts
        .map((part) => {
            return part.includes(' ') ? `"${part}"` : part;
        })
        .join(' ');
}

// Adds the entry under "Tasks" when the taskbar icon is right-clicked. Must run
// after `app.whenReady()`.
export function initUserTasks() {
    if (!isWindows) {
        return;
    }
    app.setUserTasks([
        {
            program: process.execPath,
            arguments: genRelaunchArguments(),
            iconPath: process.execPath,
            iconIndex: 0,
            title: RESET_WINDOW_BOUNDS_LABEL,
            description: 'Move the main window back onto the primary display',
        },
    ]);
}

export function initSecondInstance(appController: ElectronAppController) {
    app.on('second-instance', (_event, argv) => {
        const win = appController.mainWin;
        if (win.isMinimized()) {
            win.restore();
        }
        if (argv.includes(RESET_WINDOW_BOUNDS_ARG)) {
            resetMainWindowBounds(appController);
        }
        // a plain relaunch means "give me the app I already have running"
        win.focus();
    });
}
