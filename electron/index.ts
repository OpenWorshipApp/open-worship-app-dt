import { app, protocol } from 'electron';

import { isDev, sweepStalePrintPreviewFiles } from './electronHelpers';
import {
    customScheme,
    initCustomSchemeHandler,
    schemePrivileges,
} from './fsServe';
protocol.registerSchemesAsPrivileged([
    {
        scheme: customScheme,
        privileges: schemePrivileges,
    },
]);

import ElectronAppController from './ElectronAppController';
import {
    initFinderEvent,
    initEventListenerApp,
    initEventOther,
    initEventScreen,
} from './electronEventListener';
import { initMenu } from './electronMenu';
import { initDevtools } from './devtools';
import { initDisplayMediaHandler } from './displayMediaHelpers';
import {
    findUserDataPathArg,
    initAppUserModelId,
    initSecondInstance,
    initUserTasks,
} from './taskbarHelpers';

function applyLaunchOverrides() {
    // The single-instance lock lives in `userData`, so dev must use its own
    // directory to be able to run alongside the installed app.
    const userDataPath =
        process.env.OWA_USER_DATA_PATH ??
        // a taskbar jump list task relaunches the exe with no environment, so it
        // names the data dir — and therefore the lock — it means on the argv
        findUserDataPathArg(process.argv) ??
        (isDev ? `${app.getPath('userData')}-dev` : null);
    if (userDataPath) {
        app.setPath('userData', userDataPath);
        app.setPath('sessionData', userDataPath);
    }
    initAppUserModelId();
}

async function main() {
    applyLaunchOverrides();
    if (isDev) {
        app.commandLine.appendSwitch('ignore-certificate-errors');
    }
    // Taken before `whenReady()` so the throwaway process a jump list task
    // spawns quits without ever spinning up Chromium.
    const gotTheLock = app.requestSingleInstanceLock({
        myKey: 'open-worship-app',
    });
    if (!gotTheLock) {
        app.quit();
        return;
    }
    await app.whenReady();
    // Fire-and-forget: clear print preview temp files left behind by a
    // previous run that was killed with a preview open.
    sweepStalePrintPreviewFiles();
    initCustomSchemeHandler();
    initDisplayMediaHandler();
    const appController = ElectronAppController.getInstance();
    initSecondInstance(appController);
    initUserTasks();
    initEventListenerApp(appController);
    initEventScreen(appController);
    initFinderEvent();
    initEventOther(appController);
    initMenu(appController);
    initDevtools(appController);
}

main();
