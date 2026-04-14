import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { appProviderMock, unlockingMock } = vi.hoisted(() => ({
    appProviderMock: {
        isPageScreen: false,
    },
    unlockingMock: vi.fn(
        async (_key: string, callback: () => Promise<unknown>) => {
            return await callback();
        },
    ),
}));

vi.mock('../server/appProvider', () => ({
    default: appProviderMock,
}));

vi.mock('../server/unlockingHelpers', () => ({
    unlocking: unlockingMock,
}));

import CacheManager, { globalCacheManager1M } from './CacheManager';

describe('CacheManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        appProviderMock.isPageScreen = false;
    });

    afterEach(() => {
        globalCacheManager1M.stopCleanup();
        vi.useRealTimers();
    });

    test('stores, retrieves, and expires synchronous cache values', () => {
        const cache = new CacheManager<number>(1);

        cache.setSync('alpha', 1);
        expect(cache.hasSync('alpha')).toBe(true);
        expect(cache.getSync('alpha')).toBe(1);

        vi.advanceTimersByTime(1001);

        expect(cache.getSync('alpha')).toBeNull();
        expect(cache.hasSync('alpha')).toBe(false);

        cache.stopCleanup();
    });

    test('uses unlocking for async operations and clears values', async () => {
        const cache = new CacheManager<string>(10);

        await cache.set('name', 'value');
        expect(await cache.has('name')).toBe(true);
        expect(await cache.get('name')).toBe('value');

        await cache.delete('name');
        expect(await cache.get('name')).toBeNull();

        cache.clear();
        cache.stopCleanup();

        expect(unlockingMock).toHaveBeenCalledWith(
            expect.stringMatching(/^caching-.*-name$/),
            expect.any(Function),
        );
    });

    test('removes expired entries during cleanup and ignores screen-page writes', async () => {
        const cache = new CacheManager<number>(1);

        cache.setSync('keep', 5);
        vi.advanceTimersByTime(1001);
        await cache.cleanup();
        expect(cache.hasSync('keep')).toBe(false);

        appProviderMock.isPageScreen = true;
        cache.setSync('screen', 7);
        expect(cache.hasSync('screen')).toBe(false);

        cache.stopCleanup();
    });

    test('stops the cleanup interval', () => {
        const cache = new CacheManager<number>(1);

        cache.stopCleanup();

        expect((cache as any).intervalId).toBeNull();
        expect(globalCacheManager1M).toBeInstanceOf(CacheManager);
    });
});
