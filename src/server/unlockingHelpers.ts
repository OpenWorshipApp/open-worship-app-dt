import { appWarning } from '../helper/loggerHelpers';
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
        if (i === 500) {
            // 600 x 100ms = 60s
            appWarning(
                `Unlocking key "${key}" is still locked after 50 attempts (5s).`,
            );
        }
    }
    lockSet.add(key);
    const data = await callback();
    lockSet.delete(key);
    return data;
}

const timeoutAttempt = genTimeoutAttempt(2000);
export async function unlockingCacher<T>(
    key: string,
    callback: () => OptionalPromise<T>,
    cacheManager: CacheManager<T>,
    isDeferCache = false,
) {
    return unlocking(key, async () => {
        const cachedBibleKey = await cacheManager.get(key);
        if (cachedBibleKey) {
            if (isDeferCache) {
                timeoutAttempt(async () => {
                    const value = await callback();
                    await cacheManager.set(key, value);
                });
            }
            return cachedBibleKey;
        }
        const value = await callback();
        await cacheManager.set(key, value);
        return value;
    });
}
