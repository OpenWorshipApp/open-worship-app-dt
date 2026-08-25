import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

import { electronMockState } from './testElectronModule';
import { createMockBrowserWindow } from './testUtils';
import {
    captureOAuthRedirectUrl,
    OAUTH_WINDOW_CLOSED_MESSAGE,
} from './oauthHelpers';

const AUTHORIZE_URL = 'https://identityservices.ccli.com/connect/authorize?x=1';
const REDIRECT_PREFIX = 'http://localhost/owa-oauth-callback';

function getLastWindow() {
    const windows = electronMockState.browserWindows;
    return windows[windows.length - 1];
}

function emit(target: any, eventName: string, ...args: any[]) {
    for (const [name, handler] of target.on.mock.calls) {
        if (name === eventName) {
            handler(...args);
        }
    }
}

describe('captureOAuthRedirectUrl', () => {
    beforeEach(() => {
        electronMockState.reset();
        electronMockState.setBrowserWindowFactory(() => {
            return createMockBrowserWindow({
                loadURL: vi.fn(async () => {}),
                destroy: vi.fn(),
            } as any);
        });
    });

    test('resolves with the full URL of a matching will-redirect', async () => {
        const promise = captureOAuthRedirectUrl({
            authorizeUrl: AUTHORIZE_URL,
            redirectUriPrefix: REDIRECT_PREFIX,
        });
        const win = getLastWindow();
        expect(win.loadURL).toHaveBeenCalledWith(AUTHORIZE_URL);
        expect(win.__options.webPreferences.nodeIntegration).toBe(false);
        expect(win.__options.webPreferences.contextIsolation).toBe(true);
        const event = { preventDefault: vi.fn() };
        emit(
            win.webContents,
            'will-redirect',
            event,
            'https://identityservices.ccli.com/somewhere-else',
        );
        expect(event.preventDefault).not.toHaveBeenCalled();
        emit(
            win.webContents,
            'will-redirect',
            event,
            `${REDIRECT_PREFIX}?code=abc&state=xyz`,
        );
        await expect(promise).resolves.toBe(
            `${REDIRECT_PREFIX}?code=abc&state=xyz`,
        );
        expect(event.preventDefault).toHaveBeenCalled();
        expect((win as any).destroy).toHaveBeenCalled();
    });

    test('resolves from did-navigate too and settles only once', async () => {
        const promise = captureOAuthRedirectUrl({
            authorizeUrl: AUTHORIZE_URL,
            redirectUriPrefix: REDIRECT_PREFIX,
        });
        const win = getLastWindow();
        emit(win.webContents, 'did-navigate', {}, `${REDIRECT_PREFIX}?code=1`);
        // A later close must not flip the settled promise into a rejection.
        emit(win, 'closed');
        await expect(promise).resolves.toBe(`${REDIRECT_PREFIX}?code=1`);
    });

    test('rejects when the window is closed before sign in', async () => {
        const promise = captureOAuthRedirectUrl({
            authorizeUrl: AUTHORIZE_URL,
            redirectUriPrefix: REDIRECT_PREFIX,
        });
        const win = getLastWindow();
        emit(win, 'closed');
        await expect(promise).rejects.toThrow(OAUTH_WINDOW_CLOSED_MESSAGE);
    });

    test('refuses a non-http(s) authorize URL', () => {
        expect(() => {
            captureOAuthRedirectUrl({
                authorizeUrl: 'file:///C:/evil.html',
                redirectUriPrefix: REDIRECT_PREFIX,
            });
        }).toThrow('Invalid authorize URL');
        expect(() => {
            captureOAuthRedirectUrl({
                authorizeUrl: AUTHORIZE_URL,
                redirectUriPrefix: '',
            });
        }).toThrow('redirectUriPrefix is required');
    });
});
