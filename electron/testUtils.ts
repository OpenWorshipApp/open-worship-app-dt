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
    capturePage: ReturnType<typeof vi.fn>;
    print: ReturnType<typeof vi.fn>;
};

export type MockBrowserWindow = {
    webContents: MockWebContents;
    on: ReturnType<typeof vi.fn>;
    setBounds: ReturnType<typeof vi.fn>;
    getBounds: ReturnType<typeof vi.fn>;
    getPosition: ReturnType<typeof vi.fn>;
    getSize: ReturnType<typeof vi.fn>;
    setBackgroundColor: ReturnType<typeof vi.fn>;
    reload: ReturnType<typeof vi.fn>;
    setFullScreen: ReturnType<typeof vi.fn>;
    setAlwaysOnTop: ReturnType<typeof vi.fn>;
    loadURL: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
    show: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    maximize: ReturnType<typeof vi.fn>;
    isMinimized: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
};

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
        capturePage: vi.fn(),
        print: vi.fn(),
        ...overrides,
    };
}

export function createMockBrowserWindow(
    overrides: Partial<MockBrowserWindow> = {},
): MockBrowserWindow {
    const webContents = overrides.webContents ?? createMockWebContents();
    return {
        on: vi.fn(),
        setBounds: vi.fn(),
        getBounds: vi.fn(() => ({ x: 10, y: 20, width: 1200, height: 800 })),
        getPosition: vi.fn(() => [10, 20]),
        getSize: vi.fn(() => [1200, 800]),
        setBackgroundColor: vi.fn(),
        reload: vi.fn(),
        setFullScreen: vi.fn(),
        setAlwaysOnTop: vi.fn(),
        loadURL: vi.fn(),
        focus: vi.fn(),
        show: vi.fn(),
        close: vi.fn(),
        maximize: vi.fn(),
        isMinimized: vi.fn(() => false),
        restore: vi.fn(),
        ...overrides,
        webContents,
    };
}

export function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}
