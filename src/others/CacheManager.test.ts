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

import CacheManager, { globalCacheManager10Seconds } from './CacheManager';

describe('CacheManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        appProviderMock.isPageScreen = false;
    });

    afterEach(() => {
        globalCacheManager10Seconds.stopCleanup();
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

    test('expiry is absolute: reading does not extend an entry lifetime', () => {
        const cache = new CacheManager<number>(2);

        cache.setSync('alpha', 1);
        // Read it more often than the TTL. A sliding expiry would keep this
        // entry alive for ever, which is what let the presenting flow tree serve a
        // stale `.owpf` through fs.watch, Reload and a full window reload.
        for (let index = 0; index < 5; index++) {
            vi.advanceTimersByTime(1000);
            cache.getSync('alpha');
        }

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
        expect(globalCacheManager10Seconds).toBeInstanceOf(CacheManager);
    });

    test('refuses a zero or negative lifetime and warns about a long one', () => {
        expect(() => new CacheManager<number>(0)).toThrow(
            'expirationSecond must be greater than 0',
        );
        expect(() => new CacheManager<number>(-1)).toThrow(
            'expirationSecond must be greater than 0',
        );
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const cache = new CacheManager<number>(11);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0][0])).toContain(
            'CacheManager expirationSecond is set to 11, which is greater than 10 seconds.',
        );
        new CacheManager<number>(10);
        expect(warn).toHaveBeenCalledTimes(1);
        cache.stopCleanup();
    });

    test('an entry with no lifetime never expires and schedules no cleanup', () => {
        const cache = new CacheManager<number>();
        cache.setSync('forever', 42);
        expect((cache as any).intervalId).toBeNull();
        vi.advanceTimersByTime(60 * 60 * 1000);
        expect(cache.hasSync('forever')).toBe(true);
        expect(cache.getSync('forever')).toBe(42);
    });

    test('has() treats an expired entry as gone, without a get() first', () => {
        const cache = new CacheManager<number>(1);
        cache.setSync('alpha', 1);
        vi.advanceTimersByTime(1001);
        expect(cache.hasSync('alpha')).toBe(false);
        expect((cache as any).cache.size).toBe(0);
        cache.stopCleanup();
    });

    test('drops only the matched entries, and the timer once none is left', () => {
        const cache = new CacheManager<number>(5);
        cache.setSync('owner-a:1', 1);
        cache.setSync('owner-a:2', 2);
        cache.setSync('owner-b:1', 3);
        expect((cache as any).intervalId).not.toBeNull();

        cache.deleteMatchedSync((key) => key.startsWith('owner-a:'));
        expect(cache.hasSync('owner-a:1')).toBe(false);
        expect(cache.hasSync('owner-a:2')).toBe(false);
        expect(cache.getSync('owner-b:1')).toBe(3);
        expect((cache as any).intervalId).not.toBeNull();

        cache.deleteMatchedSync((key) => key.startsWith('owner-b:'));
        expect((cache as any).cache.size).toBe(0);
        expect((cache as any).intervalId).toBeNull();
    });
});
