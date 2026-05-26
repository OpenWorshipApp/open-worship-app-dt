import { beforeEach, describe, expect, test, vi } from 'vitest';

const { appWarningMock, scheduledCallbacks, genTimeoutAttemptMock } =
    vi.hoisted(() => {
        const callbacks: Array<() => unknown> = [];
        return {
            appWarningMock: vi.fn(),
            scheduledCallbacks: callbacks,
            genTimeoutAttemptMock: vi.fn(() => {
                return (callback: () => unknown) => {
                    callbacks.push(callback);
                };
            }),
        };
    });

vi.mock('../helper/loggerHelpers', () => ({
    appWarning: appWarningMock,
}));

vi.mock('../helper/timeoutHelpers', () => ({
    genTimeoutAttempt: genTimeoutAttemptMock,
}));

describe('unlockingHelpers', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        vi.useRealTimers();
        scheduledCallbacks.length = 0;
    });

    test('waits for an existing lock and warns after prolonged contention', async () => {
        vi.useFakeTimers();
        const { unlocking } = await import('./unlockingHelpers');

        let releaseFirst: (() => void) | undefined;
        const firstPromise = unlocking('shared', async () => {
            await new Promise<void>((resolve) => {
                releaseFirst = resolve;
            });
            return 'first';
        });
        await Promise.resolve();

        const secondCallback = vi.fn(async () => 'second');
        const secondPromise = unlocking('shared', secondCallback);

        await vi.advanceTimersByTimeAsync(50_000);
        expect(appWarningMock).toHaveBeenCalledWith(
            'Unlocking key "shared" is still locked after 50 attempts (5s).',
        );
        expect(secondCallback).not.toHaveBeenCalled();

        releaseFirst?.();
        await expect(firstPromise).resolves.toBe('first');
        await vi.advanceTimersByTimeAsync(100);
        await expect(secondPromise).resolves.toBe('second');
        expect(secondCallback).toHaveBeenCalledTimes(1);
    });

    test('returns cached values without recomputing and refreshes deferred cache later', async () => {
        const { unlockingCacher } = await import('./unlockingHelpers');
        const callback = vi.fn(async () => 'fresh');
        const cacheManager = {
            get: vi.fn(async () => 'cached'),
            set: vi.fn(async () => undefined),
        } as any;

        await expect(
            unlockingCacher('verse', callback, cacheManager, true),
        ).resolves.toBe('cached');

        expect(callback).not.toHaveBeenCalled();
        expect(cacheManager.set).not.toHaveBeenCalled();
        expect(scheduledCallbacks).toHaveLength(1);

        await scheduledCallbacks[0]();
        expect(callback).toHaveBeenCalledTimes(1);
        expect(cacheManager.set).toHaveBeenCalledWith('verse', 'fresh');
    });

    test('computes and stores uncached values, including falsey cache entries', async () => {
        const { unlockingCacher } = await import('./unlockingHelpers');
        const callback = vi.fn(() => 'new-value');
        const cacheManager = {
            get: vi.fn(async () => ''),
            set: vi.fn(async () => undefined),
        } as any;

        await expect(
            unlockingCacher('verse', callback, cacheManager),
        ).resolves.toBe('new-value');

        expect(callback).toHaveBeenCalledTimes(1);
        expect(cacheManager.set).toHaveBeenCalledWith('verse', 'new-value');
    });
});
