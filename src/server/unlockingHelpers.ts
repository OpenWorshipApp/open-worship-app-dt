import { appError, appWarning } from '../helper/loggerHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import type { OptionalPromise } from '../helper/typeHelpers';
import type CacheManager from '../others/CacheManager';

const lockSet = new Set<string>();
export async function unlocking<T>(
    key: string,
    callback: () => Promise<T> | T,
) {
    let i = 0;
    while (lockSet.has(key) && i < 600) {
        await new Promise((resolve) => {
            setTimeout(resolve, 100);
        });
        i++;
        if (i === 50) {
            appWarning(
                `Unlocking key "${key}" is still locked after 50 attempts (5s).`,
            );
        }
    }
    if (lockSet.has(key)) {
        // Escape hatch: give up waiting so the app does not deadlock, but this
        // means the callback now races the lock holder on the same resource.
        appError(
            `Unlocking key "${key}" is still locked after 600 attempts ` +
                '(60s). Giving up waiting and running the callback ' +
                'CONCURRENTLY with the lock holder.',
        );
    }
    lockSet.add(key);
    try {
        return await callback();
    } finally {
        lockSet.delete(key);
    }
}

// One module-level debounce shared across every key would let only the
// last-hit key's deferred refresh ever run. Key the debounce per cache key and
// drop the entry once it fires so the map does not grow unbounded.
const deferredAttemptMap = new Map<
    string,
    ReturnType<typeof genTimeoutAttempt>
>();
export async function unlockingCacher<T>(
    key: string,
    callback: () => OptionalPromise<T>,
    cacheManager: CacheManager<T>,
    isDeferCache = false,
) {
    return unlocking(key, async () => {
        const cachedValue = await cacheManager.get(key);
        if (cachedValue) {
            if (isDeferCache) {
                let attemptTimeout = deferredAttemptMap.get(key);
                if (attemptTimeout === undefined) {
                    attemptTimeout = genTimeoutAttempt(2000);
                    deferredAttemptMap.set(key, attemptTimeout);
                }
                attemptTimeout(async () => {
                    deferredAttemptMap.delete(key);
                    const value = await callback();
                    await cacheManager.set(key, value);
                });
            }
            return cachedValue;
        }
        const value = await callback();
        await cacheManager.set(key, value);
        return value;
    });
}
