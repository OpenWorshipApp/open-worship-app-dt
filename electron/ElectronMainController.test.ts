import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

const {
    attemptClosing,
    genWebPreferences,
    getAppThemeBackgroundColor,
    guardBrowsing,
    loadURL,
} = vi.hoisted(() => ({
    attemptClosing: vi.fn(),
    genWebPreferences: vi.fn(() => ({ preload: '/tmp/preload.js' })),
    getAppThemeBackgroundColor: vi.fn(() => '#101010'),
    guardBrowsing: vi.fn(),
    loadURL: vi.fn(),
}));

vi.mock('./electronHelpers', () => ({
    attemptClosing,
    genWebPreferences,
    getAppThemeBackgroundColor,
    guardBrowsing,
    isDev: true,
    messageChannels: {
        screenMessage: 'app:screen:message',
    },
}));

vi.mock('./protocolHelpers', () => ({
    genRoutProps: vi.fn(() => ({
        preloadFilePath: '/tmp/preload.js',
        loadURL,
    })),
    genRouteUrl: (htmlFileFullName: string, query = '') => {
        return `https://localhost:3000/${htmlFileFullName}${query}`;
    },
}));

import ElectronMainController from './ElectronMainController';
import { electronMockState } from './testElectronModule';

describe('ElectronMainController', () => {
    beforeEach(() => {
        electronMockState.reset();
        attemptClosing.mockClear();
        genWebPreferences.mockClear();
        getAppThemeBackgroundColor.mockClear();
        guardBrowsing.mockClear();
        loadURL.mockClear();
    });

    test('creates the main window and loads the configured route', () => {
        const processExit = vi
            .spyOn(process, 'exit')
            .mockImplementation((() => undefined) as any);

        const controller = new ElectronMainController({
            mainHtmlPath: 'presenter.html',
        } as any);

        expect(electronMockState.BrowserWindowMock).toHaveBeenCalledTimes(1);
        const windowOptions =
            electronMockState.BrowserWindowMock.mock.calls[0][0];
        expect(windowOptions.icon).toContain('icon-dev.png');
        expect(loadURL).toHaveBeenCalledWith(controller.win);
        expect(guardBrowsing).toHaveBeenCalledTimes(1);
        processExit.mockRestore();
    });

    function getWillNavigateHandler(controller: ElectronMainController) {
        const onCalls = (controller.win.webContents.on as any).mock.calls;
        const call = onCalls.find(([eventName]: [string]) => {
            return eventName === 'will-navigate';
        });
        return call?.[1] as
            | ((event: { preventDefault: () => void }, url: string) => void)
            | undefined;
    }

    test('guards the main window against unsupported navigations', () => {
        const processExit = vi
            .spyOn(process, 'exit')
            .mockImplementation((() => undefined) as any);
        const controller = new ElectronMainController({
            mainHtmlPath: 'presenter.html',
        } as any);
        const handleNavigation = getWillNavigateHandler(controller);
        expect(handleNavigation).toBeTypeOf('function');

        const allow = (url: string) => {
            const event = { preventDefault: vi.fn() };
            handleNavigation?.(event, url);
            return event.preventDefault;
        };

        // Same-origin, supported main pages are allowed through.
        for (const url of [
            'https://localhost:3000/reader.html',
            'https://localhost:3000/appDocumentEditor.html',
            'https://localhost:3000/presenter.html?foo=bar',
        ]) {
            expect(allow(url)).not.toHaveBeenCalled();
        }

        // An unsupported same-origin page is blocked without opening a browser.
        expect(allow('https://localhost:3000/setting.html')).toHaveBeenCalled();
        // An allowed page name under an unexpected path (not what genRouteUrl
        // would produce) is still rejected.
        expect(
            allow('https://localhost:3000/sub/presenter.html'),
        ).toHaveBeenCalled();
        expect(electronMockState.shell.openExternal).not.toHaveBeenCalled();

        // An external http(s) navigation is blocked and handed to the browser.
        const externalUrl = 'https://example.com/presenter.html';
        expect(allow(externalUrl)).toHaveBeenCalled();
        expect(electronMockState.shell.openExternal).toHaveBeenCalledWith(
            externalUrl,
        );
        processExit.mockRestore();
    });

    test('sends screen messages over the configured channel', () => {
        const processExit = vi
            .spyOn(process, 'exit')
            .mockImplementation((() => undefined) as any);
        const controller = new ElectronMainController({
            mainHtmlPath: 'presenter.html',
        } as any);

        controller.sendScreenMessage({
            screenId: 4,
            type: 'visible',
            data: { isShowing: false },
        });
        controller.gotoSettingHomePage();

        expect(controller.win.webContents.send).toHaveBeenCalledWith(
            'app:screen:message',
            {
                screenId: 4,
                type: 'visible',
                data: { isShowing: false },
            },
        );
        expect(controller.win.webContents.send).toHaveBeenCalledWith(
            'app:main:go-to-setting-home',
            undefined,
        );
        processExit.mockRestore();
    });
});
