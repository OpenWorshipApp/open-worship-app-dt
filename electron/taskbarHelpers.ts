import { createHash } from 'node:crypto';
import path from 'node:path';

import { app } from 'electron';

import type ElectronAppController from './ElectronAppController';
import {
    isDev,
    isWindows,
    isWindowsStore,
    resetPopupWindowsBounds,
} from './electronHelpers';

import packageInfo from '../package.json';

export const RESET_WINDOW_BOUNDS_LABEL = 'Reset Position and Size';
export const RESET_WINDOW_BOUNDS_ARG = '--owa-reset-window-bounds';
// Help -> App Help (Chatbot), from the taskbar icon too (2026-10-15, the
// user's ask with the jump list's Tasks circled: _so I can find help_ --
// with the app minimised, or behind something else, the Help menu is not
// where anybody can reach it).
export const OPEN_CHATBOT_LABEL = 'App Help (Chatbot)';
export const OPEN_CHATBOT_ARG = '--owa-open-chatbot';
export const USER_DATA_PATH_ARG_PREFIX = '--owa-user-data-path=';

export function findUserDataPathArg(argv: string[]) {
    const arg = argv.find((item) => {
        return item.startsWith(USER_DATA_PATH_ARG_PREFIX);
    });
    const userDataPath = arg?.slice(USER_DATA_PATH_ARG_PREFIX.length);
    return userDataPath ? userDataPath : null;
}

export function resetWindowsBounds(appController: ElectronAppController) {
    appController.settingManager.restoreMainBounds(appController.mainWin);
    // Popups follow the main window, so whatever stranded it stranded them too
    // -- and unlike the main window they have no menu bar of their own to be
    // rescued from.
    resetPopupWindowsBounds(appController.mainWin);
}

// The jump list attaches to the process' Application User Model ID. For the
// installed app it must be exactly the `build.appId` that electron-builder's
// NSIS stamps on the shortcut, or the taskbar treats the running app and its
// pinned shortcut as two different things. Dev keeps its own identity, matching
// how it already keeps its own `userData` dir and single-instance lock.
//
// A Store (MSIX) install is the one case with NOTHING to claim: Windows gives
// the package its own id and forbids replacing it -- "you may only use the
// AUMID generated for it by the application model environment" -- and setting
// one anyway is documented to make the jump list entries disappear, which is
// exactly the reset task below.
//
// The identity follows the DATA FOLDER, not the build (2026-10-15). The jump
// list belongs to the identity, and the last process to set it wins: a dev
// instance on a scratch profile (`OWA_USER_DATA_PATH`) started after the
// user's own dev app took the list over, its tasks naming the scratch folder,
// and the user's **App Help (Chatbot)** started an app on that profile
// instead of reaching theirs. So the default folder keeps the shared id, its
// `-dev` twin keeps `.dev` -- also for the copy a task click starts, which has
// no environment and so is not "dev" itself -- and any other folder gets an
// id of its own: its own taskbar button and its own list.
function toComparablePath(dirPath: string) {
    return path.resolve(dirPath).toLowerCase();
}

export function toAppUserModelId(
    userDataPath: string,
    defaultUserDataPath: string,
) {
    const appId = packageInfo.build.appId;
    const target = toComparablePath(userDataPath);
    if (target === toComparablePath(defaultUserDataPath)) {
        return appId;
    }
    if (target === toComparablePath(`${defaultUserDataPath}-dev`)) {
        return `${appId}.dev`;
    }
    const digest = createHash('sha256')
        .update(target)
        .digest('hex')
        .slice(0, 8);
    return `${isDev ? `${appId}.dev` : appId}.${digest}`;
}

// `defaultUserDataPath` is the folder Electron chose before any override.
export function initAppUserModelId(defaultUserDataPath: string) {
    if (!isWindows || isWindowsStore) {
        return;
    }
    app.setAppUserModelId(
        toAppUserModelId(app.getPath('userData'), defaultUserDataPath),
    );
}

// A jump list task cannot call into the running app: Windows launches `program`
// with `arguments` and the single-instance lock forwards that argv to us. The
// relaunched process inherits no environment, so `isDev` is false there and
// `applyLaunchOverrides` would aim it at the packaged `userData` — a different
// lock, which would open a whole second app instead of signalling this one.
// Naming the already-resolved dir on the command line keeps dev talking to dev.
//
// A LIST, not a command line: `app.relaunch` takes the arguments already split
// and quoting them there would make the quotes part of the path. Only the jump
// list, which hands Windows one string, joins and quotes them.
function genRelaunchArgList(extraArgs: string[] = []) {
    return [
        // in dev `process.execPath` is electron.exe, which needs the app path
        ...(isDev ? [app.getAppPath()] : []),
        `${USER_DATA_PATH_ARG_PREFIX}${app.getPath('userData')}`,
        ...extraArgs,
    ];
}

function genRelaunchArguments(taskArg: string) {
    return genRelaunchArgList([taskArg])
        .map((part) => {
            return part.includes(' ') ? `"${part}"` : part;
        })
        .join(' ');
}

/**
 * Close this app and open it again.
 *
 * The one setting that CANNOT be applied any other way is the AI master
 * switch: the main process reads it before `ready` to decide whether the
 * debugging endpoint and the MCP host open at all, so no amount of reloading
 * renderers (`Apply Settings`) can change it. Electron starts the new process
 * only once this one has exited, so the single-instance lock is free by then.
 *
 * The window reset a jump list task carries is deliberately NOT passed on: a
 * restart asked for in Settings must leave the user's window where they put it.
 */
export function relaunchApp() {
    app.relaunch({ args: genRelaunchArgList() });
    // `quit`, not `exit`: `will-quit` is where the agent endpoint file is
    // swept and the settings are flushed (`ElectronSettingManager`).
    app.quit();
}

// Adds the entries under "Tasks" when the taskbar icon is right-clicked. Must
// run after `app.whenReady()`. The help is listed only with the AI master
// switch on, like Help -> App Help (Chatbot): the window it opens would have
// nothing to talk to. The switch is read once a launch, and so is this list.
export function initUserTasks(isAiEnabled: boolean) {
    if (!isWindows) {
        return;
    }
    app.setUserTasks([
        ...(isAiEnabled
            ? [
                  {
                      program: process.execPath,
                      arguments: genRelaunchArguments(OPEN_CHATBOT_ARG),
                      iconPath: process.execPath,
                      iconIndex: 0,
                      title: OPEN_CHATBOT_LABEL,
                      description: 'Ask the help assistant about the app',
                  },
              ]
            : []),
        {
            program: process.execPath,
            arguments: genRelaunchArguments(RESET_WINDOW_BOUNDS_ARG),
            iconPath: process.execPath,
            iconIndex: 0,
            title: RESET_WINDOW_BOUNDS_LABEL,
            description: 'Move the main window back onto the primary display',
        },
    ]);
}

export function initSecondInstance(
    appController: ElectronAppController,
    isAiEnabled: boolean,
) {
    app.on('second-instance', (_event, argv) => {
        const win = appController.mainWin;
        if (win.isMinimized()) {
            win.restore();
        }
        if (argv.includes(RESET_WINDOW_BOUNDS_ARG)) {
            resetWindowsBounds(appController);
        }
        // a plain relaunch means "give me the app I already have running"
        win.focus();
        // After the focus: the main window asks the caution, and the help
        // opens beside it.
        if (isAiEnabled && argv.includes(OPEN_CHATBOT_ARG)) {
            appController.openChatbotFromTaskbar();
        }
    });
}

/**
 * The help task pressed while the app was NOT running starts it with the
 * argument itself, and no `second-instance` comes. Asked once the main
 * window has loaded -- its page is what listens, and asks the caution.
 */
export function initLaunchTask(
    appController: ElectronAppController,
    argv: string[],
    isAiEnabled: boolean,
) {
    if (!isAiEnabled || !argv.includes(OPEN_CHATBOT_ARG)) {
        return;
    }
    appController.mainWin.webContents.once('did-finish-load', () => {
        appController.openChatbotFromTaskbar();
    });
}
