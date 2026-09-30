import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { mocks, policy, readSession, state } = vi.hoisted(() => ({
    mocks: {
        attemptClosing: vi.fn(),
        importEsm: vi.fn(),
        toMcpPackagePath: vi.fn(() => '/app/webUrlPolicy.mjs'),
    },
    policy: {
        checkWebUrl: vi.fn(),
        checkWebUrlIsFetchable: vi.fn(),
    },
    readSession: {
        clearStorageData: vi.fn(),
        on: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
        setPermissionRequestHandler: vi.fn(),
    },
    state: { window: null as any },
}));

vi.mock('electron', () => ({
    BrowserWindow: vi.fn(function BrowserWindowMock() {
        return state.window;
    }),
    session: { fromPartition: vi.fn(() => readSession) },
}));
vi.mock('./electronHelpers', () => ({
    attemptClosing: mocks.attemptClosing,
}));
vi.mock('./aiHelpers', () => ({
    importEsm: mocks.importEsm,
    toMcpPackagePath: mocks.toMcpPackagePath,
}));

import { BrowserWindow, session } from 'electron';

import { readWebPage } from './webPageHelpers';

function createWindow() {
    const listeners = new Map<string, (...args: any[]) => unknown>();
    return {
        listeners,
        loadURL: vi.fn(async () => undefined),
        setContentSize: vi.fn(),
        webContents: {
            capturePage: vi.fn(async () => ({
                toDataURL: () => 'data:image/png;base64,picture',
            })),
            executeJavaScript: vi.fn(),
            on: vi.fn((name: string, callback: (...args: any[]) => unknown) => {
                listeners.set(name, callback);
            }),
            setAudioMuted: vi.fn(),
            setWindowOpenHandler: vi.fn(),
        },
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    state.window = createWindow();
    mocks.importEsm.mockResolvedValue(policy);
    policy.checkWebUrl.mockImplementation((url: string) => ({
        isAllowed: url.startsWith('https://'),
    }));
    policy.checkWebUrlIsFetchable.mockResolvedValue({
        isAllowed: true,
        href: 'https://example.com/article',
        hostname: 'example.com',
    });
    readSession.clearStorageData.mockResolvedValue(undefined);
});

afterEach(() => {
    vi.useRealTimers();
});

async function finishRead<T>(pending: Promise<T>) {
    await vi.runAllTimersAsync();
    return await pending;
}

describe('readWebPage', () => {
    test('reads normalized page data inside the locked-down session', async () => {
        state.window.webContents.executeJavaScript.mockResolvedValue({
            title: 'Example',
            url: 'https://example.com/article',
            text: 'Useful words',
            totalWords: 2,
            isCut: false,
            links: [{ text: 'More', href: 'https://example.com/more' }],
        });

        const result = await finishRead(
            readWebPage(' HTTPS://EXAMPLE.COM/article ', { maxChars: 50 }),
        );

        expect(result).toEqual({
            title: 'Example',
            url: 'https://example.com/article',
            text: 'Useful words',
            totalWords: 2,
            isCut: false,
            links: [{ text: 'More', href: 'https://example.com/more' }],
            imageDataUrl: null,
        });
        expect(state.window.loadURL).toHaveBeenCalledWith(
            'https://example.com/article',
        );
        expect(state.window.webContents.setAudioMuted).toHaveBeenCalledWith(
            true,
        );
        expect(state.window.webContents.executeJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('full.slice(0, 200)'),
            true,
        );
        expect(mocks.attemptClosing).toHaveBeenCalledWith(state.window);
        expect(readSession.clearStorageData).toHaveBeenCalledTimes(1);

        const requestPermission =
            readSession.setPermissionRequestHandler.mock.calls[0][0];
        const done = vi.fn();
        requestPermission({}, 'camera', done);
        expect(done).toHaveBeenCalledWith(false);
        const checkPermission =
            readSession.setPermissionCheckHandler.mock.calls[0][0];
        expect(checkPermission()).toBe(false);

        const willDownload = readSession.on.mock.calls.find(
            ([name]) => name === 'will-download',
        )?.[1];
        const downloadEvent = { preventDefault: vi.fn() };
        willDownload(downloadEvent);
        expect(downloadEvent.preventDefault).toHaveBeenCalledTimes(1);
    });

    test('locks navigation and popups down', async () => {
        state.window.webContents.executeJavaScript.mockResolvedValue({});

        await finishRead(readWebPage('https://example.com'));

        const blocked = { preventDefault: vi.fn() };
        state.window.listeners.get('will-navigate')?.(
            blocked,
            'file:///tmp/secret',
        );
        expect(blocked.preventDefault).toHaveBeenCalledTimes(1);
        const allowed = { preventDefault: vi.fn() };
        state.window.listeners.get('will-redirect')?.(
            allowed,
            'https://example.com/next',
        );
        expect(allowed.preventDefault).not.toHaveBeenCalled();

        const openHandler =
            state.window.webContents.setWindowOpenHandler.mock.calls[0][0];
        expect(openHandler()).toEqual({ action: 'deny' });
    });

    test('captures a capped whole-page picture before reading text', async () => {
        state.window.webContents.executeJavaScript
            .mockResolvedValueOnce(9000)
            .mockResolvedValueOnce({
                title: null,
                url: null,
                text: null,
                totalWords: null,
                isCut: 1,
                links: null,
            });

        const result = await finishRead(
            readWebPage('https://example.com', {
                wantsScreenshot: true,
                width: 800,
                height: 600,
            }),
        );

        expect(state.window.setContentSize).toHaveBeenCalledWith(800, 2400);
        expect(state.window.webContents.capturePage).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            title: '',
            url: 'https://example.com/article',
            text: '',
            totalWords: 0,
            isCut: false,
            links: [],
            imageDataUrl: 'data:image/png;base64,picture',
        });
    });

    test('uses viewport height when page measurement fails', async () => {
        state.window.webContents.executeJavaScript
            .mockRejectedValueOnce(new Error('measurement failed'))
            .mockResolvedValueOnce({ text: 'still readable' });

        const result = await finishRead(
            readWebPage('https://example.com', { wantsScreenshot: true }),
        );

        expect(state.window.setContentSize).not.toHaveBeenCalled();
        expect(result.text).toBe('still readable');
        expect(result.imageDataUrl).toContain('data:image/png');
    });

    test('refuses an address before creating a browser window', async () => {
        policy.checkWebUrlIsFetchable.mockResolvedValueOnce({
            isAllowed: false,
            reason: 'Private addresses are blocked.',
        });

        await expect(readWebPage('http://127.0.0.1:39223')).rejects.toThrow(
            'Private addresses are blocked.',
        );
        expect(BrowserWindow).not.toHaveBeenCalled();
    });

    test('tears the window down when loading fails', async () => {
        state.window.loadURL.mockRejectedValueOnce(new Error('offline'));

        const pending = readWebPage('https://example.com');
        const assertion = expect(pending).rejects.toThrow('offline');
        await vi.runAllTimersAsync();
        await assertion;
        expect(mocks.attemptClosing).toHaveBeenCalledWith(state.window);
        expect(readSession.clearStorageData).toHaveBeenCalledTimes(1);
    });

    test('does not let storage cleanup replace a good answer', async () => {
        state.window.webContents.executeJavaScript.mockResolvedValue({
            text: 'answer',
        });
        readSession.clearStorageData.mockRejectedValueOnce(
            new Error('cleanup failed'),
        );

        await expect(
            finishRead(readWebPage('https://example.com')),
        ).resolves.toEqual(expect.objectContaining({ text: 'answer' }));
        expect(session.fromPartition).toHaveBeenCalledWith('owa-read-website');
    });
});
