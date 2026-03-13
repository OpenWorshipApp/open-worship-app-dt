import { vi } from 'vitest';

import { createMockBrowserWindow } from './testUtils';

type BrowserWindowFactory = () => any;

const browserWindows: any[] = [];
let browserWindowFactory: BrowserWindowFactory = () =>
    createMockBrowserWindow();

const BrowserWindowMock: any = vi.fn(function BrowserWindowMock(options?: any) {
    const win = browserWindowFactory();
    win.__options = options;
    browserWindows.push(win);
    return win;
});
BrowserWindowMock.getAllWindows = vi.fn(() => browserWindows);

const menuBuildFromTemplate = vi.fn();
const menuSetApplicationMenu = vi.fn();
const MenuMock: any = vi.fn(function MenuMock() {
    return {
        append: vi.fn(),
        popup: vi.fn(),
    };
});
MenuMock.buildFromTemplate = menuBuildFromTemplate;
MenuMock.setApplicationMenu = menuSetApplicationMenu;

export const electronMockState = {
    browserWindows,
    BrowserWindowMock,
    app: {
        getVersion: vi.fn(() => '1.2.3'),
        getAppPath: vi.fn(() => '/mock-app'),
        getPath: vi.fn(() => '/mock-user-data'),
        isPackaged: false,
        name: 'Open Worship app',
        on: vi.fn(),
        whenReady: vi.fn(),
        requestSingleInstanceLock: vi.fn(() => true),
        quit: vi.fn(),
        commandLine: {
            appendSwitch: vi.fn(),
        },
    },
    nativeTheme: {
        shouldUseDarkColors: false,
        themeSource: 'system' as 'light' | 'dark' | 'system',
    },
    shell: {
        openExternal: vi.fn(),
        showItemInFolder: vi.fn(),
        trashItem: vi.fn(),
    },
    clipboard: {
        writeText: vi.fn(),
    },
    net: {
        fetch: vi.fn((url: string) => Promise.resolve(url)),
    },
    protocol: {
        handle: vi.fn(),
        registerSchemesAsPrivileged: vi.fn(),
    },
    session: {
        defaultSession: {
            webRequest: {
                onHeadersReceived: vi.fn(),
            },
        },
    },
    dialog: {
        showOpenDialog: vi.fn(),
    },
    ipcMain: {
        handle: vi.fn(),
        on: vi.fn(),
    },
    systemPreferences: {
        askForMediaAccess: vi.fn(),
    },
    screen: {
        getAllDisplays: vi.fn(() => []),
        getPrimaryDisplay: vi.fn(() => ({
            id: 1,
            bounds: { x: 0, y: 0, width: 1920, height: 1080 },
            size: { width: 1920, height: 1080 },
        })),
    },
    Menu: MenuMock,
    MenuItem: vi.fn((options: any) => options),
    reset() {
        browserWindows.splice(0, browserWindows.length);
        browserWindowFactory = () => createMockBrowserWindow();
        BrowserWindowMock.mockClear();
        BrowserWindowMock.getAllWindows.mockClear();
        this.app.getVersion.mockClear();
        this.app.getAppPath.mockClear();
        this.app.getPath.mockClear();
        this.app.on.mockClear();
        this.app.whenReady.mockClear();
        this.app.requestSingleInstanceLock.mockClear();
        this.app.quit.mockClear();
        this.app.commandLine.appendSwitch.mockClear();
        this.shell.openExternal.mockClear();
        this.shell.showItemInFolder.mockClear();
        this.shell.trashItem.mockClear();
        this.clipboard.writeText.mockClear();
        this.net.fetch.mockClear();
        this.protocol.handle.mockClear();
        this.protocol.registerSchemesAsPrivileged.mockClear();
        this.session.defaultSession.webRequest.onHeadersReceived.mockClear();
        this.dialog.showOpenDialog.mockClear();
        this.ipcMain.handle.mockClear();
        this.ipcMain.on.mockClear();
        this.systemPreferences.askForMediaAccess.mockClear();
        this.screen.getAllDisplays.mockClear();
        this.screen.getPrimaryDisplay.mockClear();
        MenuMock.mockClear();
        menuBuildFromTemplate.mockClear();
        menuSetApplicationMenu.mockClear();
        this.MenuItem.mockClear();
        this.nativeTheme.shouldUseDarkColors = false;
        this.nativeTheme.themeSource = 'system';
        this.app.isPackaged = false;
    },
    setBrowserWindowFactory(factory: BrowserWindowFactory) {
        browserWindowFactory = factory;
    },
};

export function createElectronModuleMock() {
    const electronModule = {
        app: electronMockState.app,
        nativeTheme: electronMockState.nativeTheme,
        shell: electronMockState.shell,
        clipboard: electronMockState.clipboard,
        BrowserWindow: electronMockState.BrowserWindowMock,
        protocol: electronMockState.protocol,
        session: electronMockState.session,
        net: electronMockState.net,
        dialog: electronMockState.dialog,
        ipcMain: electronMockState.ipcMain,
        systemPreferences: electronMockState.systemPreferences,
        screen: electronMockState.screen,
        Menu: electronMockState.Menu,
        MenuItem: electronMockState.MenuItem,
    };
    return {
        ...electronModule,
        default: electronModule,
    };
}
