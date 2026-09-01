import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

const initCustomSchemeHandler = vi.fn();
const sweepStalePrintPreviewFiles = vi.fn();
const initFinderEvent = vi.fn();
const initEventListenerApp = vi.fn();
const initEventOther = vi.fn();
const initEventScreen = vi.fn();
const initMenu = vi.fn();
const initDevtools = vi.fn();
const initDisplayMediaHandler = vi.fn();
const findUserDataPathArg = vi.fn(() => null as string | null);
const initAppUserModelId = vi.fn();
const initSecondInstance = vi.fn();
const initUserTasks = vi.fn();
const enableRemoteDebugging = vi.fn();
const initAi = vi.fn();
const getInstance = vi.fn(() => ({ id: 'app-controller' }));

vi.mock('./fsServe', () => ({
    customScheme: 'owa',
    initCustomSchemeHandler,
    schemePrivileges: { standard: true },
}));

vi.mock('./electronEventListener', () => ({
    initFinderEvent,
    initEventListenerApp,
    initEventOther,
    initEventScreen,
}));

vi.mock('./taskbarHelpers', () => ({
    findUserDataPathArg,
    initAppUserModelId,
    initSecondInstance,
    initUserTasks,
}));

vi.mock('./aiHelpers', () => ({ enableRemoteDebugging, initAi }));
vi.mock('./electronMenu', () => ({ initMenu }));
vi.mock('./devtools', () => ({ initDevtools }));
vi.mock('./displayMediaHelpers', () => ({ initDisplayMediaHandler }));
vi.mock('./ElectronAppController', () => ({
    default: {
        getInstance,
    },
}));

// Pins the electron mock: the factory runs on this first request and its result
// is then cached past every `vi.resetModules()`. Requesting it here — before any
// reset — makes it close over the same `testElectronModule` instance imported
// below, so re-imported copies of `./index` act on the state asserted on here.
import 'electron';
import { electronMockState } from './testElectronModule';

describe('electron index', () => {
    beforeEach(() => {
        vi.resetModules();
        initCustomSchemeHandler.mockClear();
        sweepStalePrintPreviewFiles.mockClear();
        initFinderEvent.mockClear();
        initEventListenerApp.mockClear();
        initEventOther.mockClear();
        initEventScreen.mockClear();
        initMenu.mockClear();
        initDevtools.mockClear();
        initDisplayMediaHandler.mockClear();
        findUserDataPathArg.mockClear();
        findUserDataPathArg.mockReturnValue(null);
        initAppUserModelId.mockClear();
        initSecondInstance.mockClear();
        initUserTasks.mockClear();
        enableRemoteDebugging.mockClear();
        initAi.mockClear();
        getInstance.mockClear();
        electronMockState.reset();
        electronMockState.app.whenReady.mockResolvedValue(undefined);
        vi.doMock('./electronHelpers', () => ({
            isDev: true,
            sweepStalePrintPreviewFiles,
        }));
    });

    test('registers the custom scheme and initializes the Electron app', async () => {
        // the mock grants the lock by default, as a first launch does
        await import('./index');

        expect(
            electronMockState.protocol.registerSchemesAsPrivileged,
        ).toHaveBeenCalledWith([
            {
                scheme: 'owa',
                privileges: { standard: true },
            },
        ]);
        expect(
            electronMockState.app.commandLine.appendSwitch,
        ).toHaveBeenCalledWith('ignore-certificate-errors');
        expect(electronMockState.app.setPath).toHaveBeenCalledWith(
            'userData',
            '/mock-user-data-dev',
        );
        expect(electronMockState.app.setPath).toHaveBeenCalledWith(
            'sessionData',
            '/mock-user-data-dev',
        );
        expect(sweepStalePrintPreviewFiles).toHaveBeenCalledTimes(1);
        expect(initCustomSchemeHandler).toHaveBeenCalledTimes(1);
        expect(initDisplayMediaHandler).toHaveBeenCalledTimes(1);
        expect(getInstance).toHaveBeenCalledTimes(1);
        expect(initMenu).toHaveBeenCalledWith({ id: 'app-controller' });
        expect(initDevtools).toHaveBeenCalledWith({ id: 'app-controller' });
        expect(initAppUserModelId).toHaveBeenCalledTimes(1);
        expect(initSecondInstance).toHaveBeenCalledWith({
            id: 'app-controller',
        });
        expect(initUserTasks).toHaveBeenCalledTimes(1);
        expect(enableRemoteDebugging).toHaveBeenCalledTimes(1);
        expect(initAi).toHaveBeenCalledTimes(1);
    });

    test('the agent doors are opened before ready, never without the lock', async () => {
        electronMockState.app.requestSingleInstanceLock.mockReturnValueOnce(
            false,
        );

        await import('./index');

        // A jump list task spawns a throwaway process that quits immediately:
        // it must not touch the command line or publish itself as an instance.
        expect(enableRemoteDebugging).not.toHaveBeenCalled();
        expect(initAi).not.toHaveBeenCalled();
    });

    test('a relaunch may name the data dir, overriding the dev default', async () => {
        findUserDataPathArg.mockReturnValue('/named-data');

        await import('./index');

        expect(electronMockState.app.setPath).toHaveBeenCalledWith(
            'userData',
            '/named-data',
        );
    });

    test('a duplicate launch quits without ever starting Chromium', async () => {
        electronMockState.app.requestSingleInstanceLock.mockReturnValueOnce(
            false,
        );

        await import('./index');

        expect(electronMockState.app.quit).toHaveBeenCalledTimes(1);
        // the whole point of taking the lock before `whenReady()`
        expect(electronMockState.app.whenReady).not.toHaveBeenCalled();
        expect(getInstance).not.toHaveBeenCalled();
    });
});
