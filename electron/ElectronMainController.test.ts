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
        expect(windowOptions.icon).toMatch(/icon(-dev)?\.png$/);
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

    test('leaves sub-frame navigations to the frame itself', () => {
        const processExit = vi
            .spyOn(process, 'exit')
            .mockImplementation((() => undefined) as any);
        const controller = new ElectronMainController({
            mainHtmlPath: 'presenter.html',
        } as any);
        const handleNavigation = getWillNavigateHandler(controller);
        electronMockState.shell.openExternal.mockClear();

        // An <iframe> loading external content — and, crucially, following the
        // redirect that such an embed answers with — is not the window
        // navigating away. Blocking it left the frame blank and popped the URL
        // open in the system browser.
        const event = { preventDefault: vi.fn(), isMainFrame: false };
        handleNavigation?.(event as any, 'https://maps.google.com/maps?q=0,0');
        handleNavigation?.(
            event as any,
            'https://www.google.com/maps/embed?pb=x',
        );

        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(electronMockState.shell.openExternal).not.toHaveBeenCalled();
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

    test('closing the main window ends the process', () => {
        const processExit = vi
            .spyOn(process, 'exit')
            .mockImplementation((() => undefined) as any);
        try {
            const controller = new ElectronMainController({
                mainHtmlPath: 'presenter.html',
            } as any);

            const closedHandler = (controller.win.on as any).mock.calls.find(
                ([eventName]: [string]) => eventName === 'closed',
            )?.[1];
            closedHandler();
            expect(processExit).toHaveBeenCalledWith(0);

            controller.close();
            expect(attemptClosing).toHaveBeenCalledWith(controller.win);
            expect(processExit).toHaveBeenCalledTimes(2);
        } finally {
            processExit.mockRestore();
        }
    });

    test('spelling suggestions become a context menu that fixes the word', () => {
        const processExit = vi
            .spyOn(process, 'exit')
            .mockImplementation((() => undefined) as any);
        try {
            const controller = new ElectronMainController({
                mainHtmlPath: 'presenter.html',
            } as any);
            const contextMenuHandler = (
                controller.win.webContents.on as any
            ).mock.calls.find(
                ([eventName]: [string]) => eventName === 'context-menu',
            )?.[1];

            // nothing misspelled: no menu at all
            contextMenuHandler({}, { dictionarySuggestions: [] });
            expect(electronMockState.MenuItem).not.toHaveBeenCalled();

            contextMenuHandler(
                {},
                { dictionarySuggestions: ['grace', 'grade'] },
            );
            expect(electronMockState.MenuItem).toHaveBeenCalledTimes(2);

            const [{ click }] = electronMockState.MenuItem.mock.calls[0];
            click();
            expect(
                controller.win.webContents.replaceMisspelling,
            ).toHaveBeenCalledWith('grace');
        } finally {
            processExit.mockRestore();
        }
    });

    test('forwards bible navigation and screen invisibility', () => {
        const processExit = vi
            .spyOn(process, 'exit')
            .mockImplementation((() => undefined) as any);
        try {
            const controller = new ElectronMainController({
                mainHtmlPath: 'presenter.html',
            } as any);

            controller.changeBible({ screenId: 2, isNext: true });
            expect(controller.win.webContents.send).toHaveBeenCalledWith(
                'app:main:change-bible',
                { screenId: 2, isNext: true },
            );

            controller.sendNotifyInvisibility(5);
            expect(controller.win.webContents.send).toHaveBeenCalledWith(
                'app:screen:message',
                {
                    screenId: 5,
                    type: 'visible',
                    data: { isShowing: false },
                },
            );
        } finally {
            processExit.mockRestore();
        }
    });
});
