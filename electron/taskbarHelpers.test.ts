import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

// Both flags are read inside the function bodies, so getters over mutable state
// let each case pick a platform without `vi.resetModules()` — which would leave
// the helpers holding a different electron mock than this file asserts on.
const platformFlags = vi.hoisted(() => {
    return { isDev: false, isWindows: true, isWindowsStore: false };
});

const { resetPopupWindowsBounds } = vi.hoisted(() => ({
    resetPopupWindowsBounds: vi.fn(),
}));

vi.mock('./electronHelpers', () => ({
    get isDev() {
        return platformFlags.isDev;
    },
    get isWindows() {
        return platformFlags.isWindows;
    },
    get isWindowsStore() {
        return platformFlags.isWindowsStore;
    },
    resetPopupWindowsBounds,
}));

import {
    findUserDataPathArg,
    initAppUserModelId,
    initLaunchTask,
    initSecondInstance,
    initUserTasks,
    relaunchApp,
} from './taskbarHelpers';
import { electronMockState } from './testElectronModule';
import { createMockBrowserWindow } from './testUtils';

function genAppController() {
    const mainWin = createMockBrowserWindow();
    return {
        mainWin,
        openChatbotFromTaskbar: vi.fn(),
        settingManager: {
            restoreMainBounds: vi.fn(),
        },
    };
}

function getSecondInstanceHandler() {
    const call = electronMockState.app.on.mock.calls.find(([eventName]) => {
        return eventName === 'second-instance';
    });
    return call?.[1] as (...args: any[]) => void;
}

function getUserTask(title = 'Reset Position and Size') {
    const [tasks] = electronMockState.app.setUserTasks.mock.calls[0];
    return tasks.find((task: any) => {
        return task.title === title;
    });
}

describe('taskbarHelpers', () => {
    beforeEach(() => {
        electronMockState.reset();
        electronMockState.app.getPath.mockReturnValue('/mock-user-data');
        electronMockState.app.getAppPath.mockReturnValue('/mock-app');
        platformFlags.isDev = false;
        platformFlags.isWindows = true;
        platformFlags.isWindowsStore = false;
        resetPopupWindowsBounds.mockClear();
    });

    test('relaunches naming the data dir, and leaves the window alone', () => {
        relaunchApp();

        expect(electronMockState.app.relaunch).toHaveBeenCalledWith({
            args: ['--owa-user-data-path=/mock-user-data'],
        });
        // A restart asked for in Settings must not move the user's window --
        // that argument belongs to the jump list task and nowhere else.
        expect(
            electronMockState.app.relaunch.mock.calls[0][0].args,
        ).not.toContain('--owa-reset-window-bounds');
        expect(electronMockState.app.quit).toHaveBeenCalledTimes(1);
    });

    test('a dev relaunch carries the app path electron.exe needs', () => {
        platformFlags.isDev = true;

        relaunchApp();

        expect(electronMockState.app.relaunch).toHaveBeenCalledWith({
            args: ['/mock-app', '--owa-user-data-path=/mock-user-data'],
        });
    });

    test('reads the data dir a relaunch names on the command line', () => {
        expect(
            findUserDataPathArg([
                'electron.exe',
                '--owa-user-data-path=/data-dev',
                '--owa-reset-window-bounds',
            ]),
        ).toBe('/data-dev');
        expect(findUserDataPathArg(['electron.exe'])).toBeNull();
        // an empty value must not blank out the real default
        expect(findUserDataPathArg(['--owa-user-data-path='])).toBeNull();
    });

    test('claims the packaged app id so the jump list attaches', () => {
        initAppUserModelId('/mock-user-data');

        expect(electronMockState.app.setAppUserModelId).toHaveBeenCalledWith(
            'app.openworship.desktop',
        );
    });

    test('leaves a Store install the identity Windows gave its package', () => {
        // MSIX forbids a custom app id, and setting one anyway is what makes
        // the reset task below disappear from the jump list.
        platformFlags.isWindowsStore = true;

        initAppUserModelId('/mock-user-data');
        initUserTasks(true);

        expect(electronMockState.app.setAppUserModelId).not.toHaveBeenCalled();
        expect(electronMockState.app.setUserTasks).toHaveBeenCalledTimes(1);
    });

    test('keeps a separate taskbar identity in dev', () => {
        platformFlags.isDev = true;
        electronMockState.app.getPath.mockReturnValue('/mock-user-data-dev');

        initAppUserModelId('/mock-user-data');

        expect(electronMockState.app.setAppUserModelId).toHaveBeenCalledWith(
            'app.openworship.desktop.dev',
        );
    });

    // A task click starts a copy with no environment: not "dev" itself, on
    // the dev folder. It must join the dev app's group, not the installed's.
    test('names the dev folder as dev whoever opens it', () => {
        electronMockState.app.getPath.mockReturnValue('/mock-user-data-dev');

        initAppUserModelId('/mock-user-data');

        expect(electronMockState.app.setAppUserModelId).toHaveBeenCalledWith(
            'app.openworship.desktop.dev',
        );
    });

    // The jump list belongs to the identity and the last to set it wins: a
    // scratch profile started after the user's own dev app took it over, and
    // the user's App Help started an app on the scratch folder.
    test('gives a profile of its own an identity of its own', () => {
        platformFlags.isDev = true;
        const { getPath, setAppUserModelId } = electronMockState.app;
        const idList = [
            '/repo/release/scratch-lang2',
            '/REPO/release/Scratch-Lang2',
            '/repo/release/scratch-lang3',
        ].map((userDataPath) => {
            getPath.mockReturnValue(userDataPath);
            initAppUserModelId('/mock-user-data');
            return setAppUserModelId.mock.calls.at(-1)?.[0];
        });

        expect(idList[0]).toMatch(
            /^app\.openworship\.desktop\.dev\.[0-9a-f]{8}$/,
        );
        // The same folder whatever its case (Windows), another folder not.
        expect(idList[1]).toBe(idList[0]);
        expect(idList[2]).not.toBe(idList[0]);
    });

    test('does nothing off Windows', () => {
        platformFlags.isWindows = false;

        initAppUserModelId('/mock-user-data');
        initUserTasks(true);

        expect(electronMockState.app.setAppUserModelId).not.toHaveBeenCalled();
        expect(electronMockState.app.setUserTasks).not.toHaveBeenCalled();
    });

    test('adds the reset task pointing back at this data dir', () => {
        initUserTasks(false);

        const [tasks] = electronMockState.app.setUserTasks.mock.calls[0];
        expect(tasks).toHaveLength(1);
        expect(getUserTask().program).toBe(process.execPath);
        expect(getUserTask().title).toBe('Reset Position and Size');
        expect(getUserTask().arguments).toBe(
            '--owa-user-data-path=/mock-user-data --owa-reset-window-bounds',
        );
    });

    test('passes the app path too in dev, where execPath is electron itself', () => {
        platformFlags.isDev = true;

        initUserTasks(false);

        expect(getUserTask().arguments).toBe(
            '/mock-app --owa-user-data-path=/mock-user-data ' +
                '--owa-reset-window-bounds',
        );
    });

    test('quotes a data dir containing spaces', () => {
        electronMockState.app.getPath.mockReturnValue('/mock user data');

        initUserTasks(false);

        expect(getUserTask().arguments).toBe(
            '"--owa-user-data-path=/mock user data" --owa-reset-window-bounds',
        );
    });

    // Help -> App Help (Chatbot), from the taskbar icon too.
    test('lists App Help first, with the AI switch on, pointing at this data dir', () => {
        initUserTasks(true);

        const [tasks] = electronMockState.app.setUserTasks.mock.calls[0];
        expect(
            tasks.map((task: any) => {
                return task.title;
            }),
        ).toEqual(['App Help (Chatbot)', 'Reset Position and Size']);
        expect(getUserTask('App Help (Chatbot)').arguments).toBe(
            '--owa-user-data-path=/mock-user-data --owa-open-chatbot',
        );
        expect(getUserTask('App Help (Chatbot)').program).toBe(
            process.execPath,
        );
    });

    test('opens the help in the running app when the task asks', () => {
        const appController = genAppController();
        appController.mainWin.isMinimized.mockReturnValue(true);

        initSecondInstance(appController as any, true);
        getSecondInstanceHandler()(
            {},
            ['electron.exe', '--owa-open-chatbot'],
            '/cwd',
            {},
        );

        // The main window comes up first: it asks the caution.
        expect(appController.mainWin.restore).toHaveBeenCalledTimes(1);
        expect(appController.openChatbotFromTaskbar).toHaveBeenCalledTimes(1);
        expect(
            appController.mainWin.focus.mock.invocationCallOrder[0],
        ).toBeLessThan(
            appController.openChatbotFromTaskbar.mock.invocationCallOrder[0],
        );
        expect(
            appController.settingManager.restoreMainBounds,
        ).not.toHaveBeenCalled();
    });

    test('opens no help with the AI switch off, or for a plain launch', () => {
        const appController = genAppController();

        initSecondInstance(appController as any, false);
        getSecondInstanceHandler()(
            {},
            ['electron.exe', '--owa-open-chatbot'],
            '/cwd',
            {},
        );
        electronMockState.reset();
        initSecondInstance(appController as any, true);
        getSecondInstanceHandler()({}, ['electron.exe'], '/cwd', {});

        expect(appController.openChatbotFromTaskbar).not.toHaveBeenCalled();
    });

    test('the task pressed with the app closed opens the help once it loads', () => {
        const appController = genAppController();

        initLaunchTask(
            appController as any,
            ['electron.exe', '--owa-open-chatbot'],
            true,
        );

        const { once } = appController.mainWin.webContents;
        expect(once).toHaveBeenCalledWith(
            'did-finish-load',
            expect.any(Function),
        );
        expect(appController.openChatbotFromTaskbar).not.toHaveBeenCalled();
        once.mock.calls[0][1]();
        expect(appController.openChatbotFromTaskbar).toHaveBeenCalledTimes(1);

        // No task, or the switch off: nothing waits for the load.
        once.mockClear();
        initLaunchTask(appController as any, ['electron.exe'], true);
        initLaunchTask(
            appController as any,
            ['electron.exe', '--owa-open-chatbot'],
            false,
        );
        expect(once).not.toHaveBeenCalled();
    });

    test('resets the bounds when a relaunch asks for it', () => {
        const appController = genAppController();

        initSecondInstance(appController as any, true);
        getSecondInstanceHandler()(
            {},
            ['electron.exe', '--owa-reset-window-bounds'],
            '/cwd',
            {},
        );

        expect(
            appController.settingManager.restoreMainBounds,
        ).toHaveBeenCalledWith(appController.mainWin);
        // the popups are stranded with it, and have no menu bar of their own
        expect(resetPopupWindowsBounds).toHaveBeenCalledWith(
            appController.mainWin,
        );
        expect(appController.mainWin.focus).toHaveBeenCalledTimes(1);
    });

    test('only focuses when a plain second launch happens', () => {
        const appController = genAppController();

        initSecondInstance(appController as any, true);
        getSecondInstanceHandler()({}, ['electron.exe'], '/cwd', {});

        expect(
            appController.settingManager.restoreMainBounds,
        ).not.toHaveBeenCalled();
        expect(resetPopupWindowsBounds).not.toHaveBeenCalled();
        expect(appController.mainWin.focus).toHaveBeenCalledTimes(1);
        expect(appController.mainWin.restore).not.toHaveBeenCalled();
    });

    test('un-minimizes first, so the new bounds land on a visible window', () => {
        const appController = genAppController();
        appController.mainWin.isMinimized.mockReturnValue(true);

        initSecondInstance(appController as any, true);
        getSecondInstanceHandler()(
            {},
            ['electron.exe', '--owa-reset-window-bounds'],
            '/cwd',
            {},
        );

        expect(appController.mainWin.restore).toHaveBeenCalledTimes(1);
        expect(
            appController.settingManager.restoreMainBounds,
        ).toHaveBeenCalledTimes(1);
    });
});
