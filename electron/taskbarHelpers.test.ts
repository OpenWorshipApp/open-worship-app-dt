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

function getUserTask() {
    const [tasks] = electronMockState.app.setUserTasks.mock.calls[0];
    return tasks[0];
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
        initAppUserModelId();

        expect(electronMockState.app.setAppUserModelId).toHaveBeenCalledWith(
            'app.openworship.desktop',
        );
    });

    test('leaves a Store install the identity Windows gave its package', () => {
        // MSIX forbids a custom app id, and setting one anyway is what makes
        // the reset task below disappear from the jump list.
        platformFlags.isWindowsStore = true;

        initAppUserModelId();
        initUserTasks();

        expect(electronMockState.app.setAppUserModelId).not.toHaveBeenCalled();
        expect(electronMockState.app.setUserTasks).toHaveBeenCalledTimes(1);
    });

    test('keeps a separate taskbar identity in dev', () => {
        platformFlags.isDev = true;

        initAppUserModelId();

        expect(electronMockState.app.setAppUserModelId).toHaveBeenCalledWith(
            'app.openworship.desktop.dev',
        );
    });

    test('does nothing off Windows', () => {
        platformFlags.isWindows = false;

        initAppUserModelId();
        initUserTasks();

        expect(electronMockState.app.setAppUserModelId).not.toHaveBeenCalled();
        expect(electronMockState.app.setUserTasks).not.toHaveBeenCalled();
    });

    test('adds the reset task pointing back at this data dir', () => {
        initUserTasks();

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

        initUserTasks();

        expect(getUserTask().arguments).toBe(
            '/mock-app --owa-user-data-path=/mock-user-data ' +
                '--owa-reset-window-bounds',
        );
    });

    test('quotes a data dir containing spaces', () => {
        electronMockState.app.getPath.mockReturnValue('/mock user data');

        initUserTasks();

        expect(getUserTask().arguments).toBe(
            '"--owa-user-data-path=/mock user data" --owa-reset-window-bounds',
        );
    });

    test('resets the bounds when a relaunch asks for it', () => {
        const appController = genAppController();

        initSecondInstance(appController as any);
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

        initSecondInstance(appController as any);
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

        initSecondInstance(appController as any);
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
