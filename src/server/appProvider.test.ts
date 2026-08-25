// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

describe('appProvider', () => {
    beforeEach(() => {
        vi.resetModules();
        globalThis.localStorage.clear();
        document.title = 'Browser App';
        history.replaceState(null, '', '/setting.html');
        delete (globalThis as any).provider;
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
