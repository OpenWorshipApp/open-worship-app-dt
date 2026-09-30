import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { mocks, providerMock } = vi.hoisted(() => ({
    mocks: {
        checkShouldLockdownRenderer: vi.fn(),
        initProvider: vi.fn(),
        initServer: vi.fn(),
        lockdownRenderer: vi.fn(),
    },
    providerMock: { appType: 'desktop' },
}));

vi.mock('./fullProvider', () => ({ provider: providerMock }));
vi.mock('./providerHelpers', () => ({ initProvider: mocks.initProvider }));
vi.mock('./rendererLockdown', () => ({
    checkShouldLockdownRenderer: mocks.checkShouldLockdownRenderer,
    lockdownRenderer: mocks.lockdownRenderer,
}));
vi.mock('../lwShareHelpers', () => ({
    initServer: mocks.initServer,
    lwShareInfo: { url: 'https://share.test' },
}));

describe('preload entries', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        mocks.checkShouldLockdownRenderer.mockReturnValue(false);
    });

    afterEach(() => {
        delete (globalThis as any).lwShareController;
    });

    test('initializes an ordinary renderer without locking it down', async () => {
        await import('./preloadProvider');

        expect(mocks.checkShouldLockdownRenderer).toHaveBeenCalled();
        expect(mocks.lockdownRenderer).not.toHaveBeenCalled();
        expect(mocks.initProvider).toHaveBeenCalledWith(providerMock);
    });

    test('locks down an outside-content renderer before initialization', async () => {
        mocks.checkShouldLockdownRenderer.mockReturnValue(true);

        await import('./preloadProvider');

        expect(mocks.lockdownRenderer).toHaveBeenCalledTimes(1);
        expect(mocks.initProvider).toHaveBeenCalledWith(providerMock);
    });

    test('publishes the local-sharing controller', async () => {
        await import('./lwShare.preload');

        expect(mocks.initProvider).toHaveBeenCalledWith(providerMock);
        expect((globalThis as any).lwShareController).toEqual({
            info: { lwShareInfo: { url: 'https://share.test' } },
            initServer: mocks.initServer,
        });
    });
});
