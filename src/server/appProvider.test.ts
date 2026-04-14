// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

describe('appProvider fallback', () => {
    beforeEach(() => {
        vi.resetModules();
        globalThis.localStorage.clear();
        document.title = 'Browser App';
        history.replaceState(null, '', '/setting.html');
        delete (globalThis as any).provider;
    });

    test('falls back to the browser mock when no injected provider exists', async () => {
        const { default: appProvider } = await import('./appProvider');
        const { goToPath } = await import('../router/routeHelpers');

        let syncPayload: string | null = null;
        appProvider.messageUtils.listenForData(
            'browser:sync',
            (event, value) => {
                event.returnValue = value;
            },
        );
        appProvider.messageUtils.listenForData(
            'browser:async',
            (_event, value) => {
                syncPayload = value;
            },
        );

        appProvider.messageUtils.sendData('browser:async', 'ready');

        expect(appProvider.appType).toBe('web');
        expect(appProvider.isDesktop).toBe(false);
        expect(appProvider.currentHomePage).toBe('/setting.html');
        expect(appProvider.settingHomePage).toBe('/setting.html');
        expect(appProvider.isPageSetting).toBe(true);
        expect(
            appProvider.messageUtils.sendDataSync('browser:sync', 'pong'),
        ).toBe('pong');
        expect(
            appProvider.messageUtils.sendDataSync('main:app:get-theme'),
        ).toBe('system');
        expect(syncPayload).toBe('ready');
        expect(typeof goToPath).toBe('function');
        expect((globalThis as any).provider).toBeUndefined();
    });

    test('prefers the injected provider when Electron populates the bridge', async () => {
        const sendDataSync = vi.fn(() => 'light');
        (globalThis as any).provider = {
            appType: 'desktop',
            isDesktop: true,
            presenterHomePage: '/injected-presenter.html',
            currentHomePage: '/injected-presenter.html',
            messageUtils: {
                messageChannels: { screenMessage: 'screen:channel' },
                sendData: vi.fn(),
                sendDataSync,
                listenForData: vi.fn(),
                listenOnceForData: vi.fn(),
            },
        };

        const { default: appProvider } = await import('./appProvider');

        expect(appProvider.appType).toBe('desktop');
        expect(appProvider.isDesktop).toBe(true);
        expect(appProvider.presenterHomePage).toBe('/injected-presenter.html');
        expect(appProvider.windowTitle).toBe('Browser App');
        expect(
            appProvider.messageUtils.sendDataSync('main:app:get-theme'),
        ).toBe('light');
        expect(sendDataSync).toHaveBeenCalledWith('main:app:get-theme');
        expect((globalThis as any).provider).toBeUndefined();
    });
});
