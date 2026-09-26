import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('../fsServe', () => ({
    htmlFiles: {
        presenter: 'presenter.html',
        bibleReader: 'reader.html',
    },
    toTitleCase: (text: string) => {
        return text.charAt(0).toUpperCase() + text.slice(1);
    },
}));

import { initProvider } from './providerHelpers';

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('initProvider', () => {
    test('names the current page and freezes the complete bridge', async () => {
        vi.stubGlobal('location', { pathname: '/presenter.html?uuid=main' });
        const provider = { nested: { list: [{ value: 1 }] } } as any;

        await initProvider(provider);

        expect(provider.currentHomePage).toBe('/presenter.html?uuid=main');
        expect(provider.presenterHomePage).toBe('/presenter.html');
        expect(provider.bibleReaderHomePage).toBe('/reader.html');
        expect(provider.isPagePresenter).toBe(true);
        expect(provider.isPageBibleReader).toBe(false);
        await expect(provider.init()).resolves.toBeUndefined();
        expect(globalThis.provider).toBe(provider);
        expect(Object.isFrozen(provider)).toBe(true);
        expect(Object.isFrozen(provider.nested)).toBe(true);
        expect(Object.isFrozen(provider.nested.list)).toBe(true);
        expect(Object.isFrozen(provider.nested.list[0])).toBe(true);
    });

    test('waits for the pathname instead of freezing an incomplete bridge', async () => {
        vi.useFakeTimers();
        const locationState = { pathname: '' };
        vi.stubGlobal('location', locationState);
        const provider = {} as any;

        const pending = initProvider(provider);
        locationState.pathname = '/reader.html';
        await vi.advanceTimersByTimeAsync(100);
        await pending;

        expect(provider.isPageBibleReader).toBe(true);
        expect(provider.isPagePresenter).toBe(false);
    });

    test('fails after the bounded pathname wait', async () => {
        vi.stubGlobal('location', { pathname: '' });

        await expect(initProvider({}, 20)).rejects.toThrow(
            'Path name is not ready after multiple attempts',
        );
    });
});
