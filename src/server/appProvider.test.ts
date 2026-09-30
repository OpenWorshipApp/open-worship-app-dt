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

    test('names the page from its own location when the preload saw another', async () => {
        history.replaceState(null, '', '/reader.html');
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        (globalThis as any).provider = {
            presenterHomePage: '/presenter.html',
            readerHomePage: '/reader.html',
            currentHomePage: 'blank',
            isPagePresenter: false,
            isPageReader: false,
            messageUtils: { messageChannels: { screenMessage: 'x' } },
        };

        const { default: appProvider } = await import('./appProvider');

        expect(appProvider.isPageReader).toBe(true);
        expect(appProvider.isPagePresenter).toBe(false);
        expect(appProvider.isMainPage).toBe(true);
        expect(appProvider.currentHomePage).toBe('/reader.html');
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('corrected isPageReader'),
        );
        warn.mockRestore();
    });
});

describe('toPageFlags', () => {
    test('derives every flag from the published home paths', async () => {
        const { toPageFlags } = await import('./appProvider');
        const flags = toPageFlags(
            {
                presenterHomePage: '/presenter.html',
                readerHomePage: '/reader.html',
                appDocumentEditorHomePage: '/appDocumentEditor.html',
                currentHomePage: '/presenter.html',
                isPagePresenter: true,
            },
            '/presenter.html',
        );

        expect(flags).toEqual({
            currentHomePage: '/presenter.html',
            isPagePresenter: true,
            isPageReader: false,
            isPageAppDocumentEditor: false,
        });
    });

    test('is quiet when the preload agrees', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { toPageFlags } = await import('./appProvider');
        const flags = toPageFlags(
            { screenHomePage: '/screen.html', isPageScreen: true },
            '/screen.html',
        );

        expect(flags.isPageScreen).toBe(true);
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });

    test('derives nothing without a provider or a pathname', async () => {
        const { toPageFlags } = await import('./appProvider');

        expect(toPageFlags(undefined, '/reader.html')).toEqual({});
        expect(toPageFlags({ readerHomePage: '/reader.html' }, '')).toEqual({});
    });
});
