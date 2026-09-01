import { vi } from 'vitest';

export type MockWebContents = {
    on: ReturnType<typeof vi.fn>;
    once: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    loadURL: ReturnType<typeof vi.fn>;
    getURL: ReturnType<typeof vi.fn>;
    setWindowOpenHandler: ReturnType<typeof vi.fn>;
    reload: ReturnType<typeof vi.fn>;
    executeJavaScript: ReturnType<typeof vi.fn>;
    openDevTools: ReturnType<typeof vi.fn>;
    getZoomFactor: ReturnType<typeof vi.fn>;
    replaceMisspelling: ReturnType<typeof vi.fn>;
    findInPage: ReturnType<typeof vi.fn>;
    stopFindInPage: ReturnType<typeof vi.fn>;
    isDestroyed: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
    id: number;
    capturePage: ReturnType<typeof vi.fn>;
    print: ReturnType<typeof vi.fn>;
    printToPDF: ReturnType<typeof vi.fn>;
};

export type MockBrowserWindow = {
    id: number;
    webContents: MockWebContents;
    contentView: {
        addChildView: ReturnType<typeof vi.fn>;
        removeChildView: ReturnType<typeof vi.fn>;
    };
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    once: ReturnType<typeof vi.fn>;
    getContentSize: ReturnType<typeof vi.fn>;
    getContentBounds: ReturnType<typeof vi.fn>;
    setBounds: ReturnType<typeof vi.fn>;
    getBounds: ReturnType<typeof vi.fn>;
    getPosition: ReturnType<typeof vi.fn>;
    getSize: ReturnType<typeof vi.fn>;
    setBackgroundColor: ReturnType<typeof vi.fn>;
    reload: ReturnType<typeof vi.fn>;
    setFullScreen: ReturnType<typeof vi.fn>;
    setAlwaysOnTop: ReturnType<typeof vi.fn>;
    setMenuBarVisibility: ReturnType<typeof vi.fn>;
    setAutoHideMenuBar: ReturnType<typeof vi.fn>;
    setResizable: ReturnType<typeof vi.fn>;
    loadURL: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
    show: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    maximize: ReturnType<typeof vi.fn>;
    isMinimized: ReturnType<typeof vi.fn>;
    isMaximized: ReturnType<typeof vi.fn>;
    unmaximize: ReturnType<typeof vi.fn>;
    getNormalBounds: ReturnType<typeof vi.fn>;
    isDestroyed: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
};

let lastMockWebContentsId = 0;

export function createMockWebContents(
    overrides: Partial<MockWebContents> = {},
): MockWebContents {
    return {
        on: vi.fn(),
        once: vi.fn(),
        send: vi.fn(),
        loadURL: vi.fn(),
        getURL: vi.fn(() => 'https://localhost:3000/presenter.html'),
        setWindowOpenHandler: vi.fn(),
        reload: vi.fn(),
        executeJavaScript: vi.fn(),
        openDevTools: vi.fn(),
        getZoomFactor: vi.fn(() => 1),
        replaceMisspelling: vi.fn(),
        findInPage: vi.fn(() => 1),
        stopFindInPage: vi.fn(),
        isDestroyed: vi.fn(() => false),
        close: vi.fn(),
        focus: vi.fn(),
        id: (lastMockWebContentsId += 1),
        capturePage: vi.fn(),
        print: vi.fn(),
        printToPDF: vi.fn(async () => Buffer.from('%PDF')),
        ...overrides,
    };
}

let lastMockBrowserWindowId = 0;

export function createMockBrowserWindow(
    overrides: Partial<MockBrowserWindow> = {},
): MockBrowserWindow {
    const webContents = overrides.webContents ?? createMockWebContents();
    lastMockBrowserWindowId += 1;
    return {
        id: lastMockBrowserWindowId,
        contentView: {
            addChildView: vi.fn(),
            removeChildView: vi.fn(),
        },
        on: vi.fn(),
        off: vi.fn(),
        once: vi.fn(),
        getContentSize: vi.fn(() => [1200, 800]),
        getContentBounds: vi.fn(() => ({
            x: 10,
            y: 20,
            width: 1200,
            height: 800,
        })),
        setBounds: vi.fn(),
        getBounds: vi.fn(() => ({ x: 10, y: 20, width: 1200, height: 800 })),
        getPosition: vi.fn(() => [10, 20]),
        getSize: vi.fn(() => [1200, 800]),
        setBackgroundColor: vi.fn(),
        reload: vi.fn(),
        setFullScreen: vi.fn(),
        setAlwaysOnTop: vi.fn(),
        setMenuBarVisibility: vi.fn(),
        setAutoHideMenuBar: vi.fn(),
        setResizable: vi.fn(),
        loadURL: vi.fn(),
        focus: vi.fn(),
        show: vi.fn(),
        close: vi.fn(),
        maximize: vi.fn(),
        isMinimized: vi.fn(() => false),
        isMaximized: vi.fn(() => false),
        unmaximize: vi.fn(),
        getNormalBounds: vi.fn(() => ({
            x: 10,
            y: 20,
            width: 1200,
            height: 800,
        })),
        isDestroyed: vi.fn(() => false),
        restore: vi.fn(),
        ...overrides,
        webContents,
    };
}

export function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}
