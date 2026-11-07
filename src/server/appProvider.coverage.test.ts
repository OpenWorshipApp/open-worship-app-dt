// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// What `appProvider` adds on top of the preload's bridge: whether the mouse is
// over the window, whether the window has focus, and which `*HomePage` entries
// can name a page. The module reads `globalThis.provider` and listens on
// `document` when it loads, so each test loads it afresh and the listeners it
// added are taken off again afterwards.
type Listener = [string, EventListenerOrEventListenerObject];
let documentListeners: Listener[] = [];

async function loadAppProvider() {
    vi.resetModules();
    (globalThis as any).provider = {
        presenterHomePage: '/presenter.html',
        messageUtils: { messageChannels: { screenMessage: 'screen' } },
    };
    return (await import('./appProvider')).default;
}

beforeEach(() => {
    documentListeners = [];
    const original = document.addEventListener.bind(document);
    vi.spyOn(document, 'addEventListener').mockImplementation(
        (type: string, listener: any, options?: any) => {
            documentListeners.push([type, listener]);
            original(type, listener, options);
        },
    );
});

afterEach(() => {
    for (const [type, listener] of documentListeners) {
        document.removeEventListener(type, listener);
    }
    vi.restoreAllMocks();
    delete (globalThis as any).provider;
});

describe('appProvider', () => {
    test('knows whether the mouse is over the window', async () => {
        const appProvider = await loadAppProvider();
        expect(appProvider.getIsMouseOverApp()).toBe(false);
        document.dispatchEvent(new MouseEvent('mouseenter'));
        expect(appProvider.getIsMouseOverApp()).toBe(true);
        document.dispatchEvent(new MouseEvent('mouseleave'));
        expect(appProvider.getIsMouseOverApp()).toBe(false);
    });

    test('asks the document whether the window has focus', async () => {
        const appProvider = await loadAppProvider();
        const hasFocus = vi.spyOn(document, 'hasFocus');
        hasFocus.mockReturnValue(true);
        expect(appProvider.getIsWindowFocused()).toBe(true);
        hasFocus.mockReturnValue(false);
        expect(appProvider.getIsWindowFocused()).toBe(false);
        expect(hasFocus).toHaveBeenCalledTimes(2);
    });
});

describe('toPageFlags', () => {
    test('a home page that is empty or not a path names no page', async () => {
        await loadAppProvider();
        const { toPageFlags } = await import('./appProvider');
        expect(
            toPageFlags(
                {
                    presenterHomePage: '',
                    readerHomePage: 42,
                    settingHomePage: null,
                    screenHomePage: '/screen.html',
                },
                '/screen.html',
            ),
        ).toEqual({
            currentHomePage: '/screen.html',
            isPageScreen: true,
        });
    });
});
