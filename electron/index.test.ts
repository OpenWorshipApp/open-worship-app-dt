import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

const initCustomSchemeHandler = vi.fn();
const initFinderEvent = vi.fn();
const initEventListenerApp = vi.fn();
const initEventOther = vi.fn();
const initEventScreen = vi.fn();
const initMenu = vi.fn();
const initDevtools = vi.fn();
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

vi.mock('./electronMenu', () => ({ initMenu }));
vi.mock('./devtools', () => ({ initDevtools }));
vi.mock('./ElectronAppController', () => ({
    default: {
        getInstance,
    },
}));

describe('electron index', () => {
    beforeEach(() => {
        vi.resetModules();
        initCustomSchemeHandler.mockClear();
        initFinderEvent.mockClear();
        initEventListenerApp.mockClear();
        initEventOther.mockClear();
        initEventScreen.mockClear();
        initMenu.mockClear();
        initDevtools.mockClear();
        getInstance.mockClear();
    });

    test('registers the custom scheme and initializes the Electron app', async () => {
        vi.doMock('./electronHelpers', () => ({ isDev: true }));
        const { electronMockState } = await import('./testElectronModule');
        electronMockState.reset();
        electronMockState.app.whenReady.mockResolvedValue(undefined);
        electronMockState.app.requestSingleInstanceLock.mockReturnValue(true);

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
        expect(initCustomSchemeHandler).toHaveBeenCalledTimes(1);
        expect(getInstance).toHaveBeenCalledTimes(1);
        expect(initMenu).toHaveBeenCalledWith({ id: 'app-controller' });
        expect(initDevtools).toHaveBeenCalledWith({ id: 'app-controller' });
    });
});
