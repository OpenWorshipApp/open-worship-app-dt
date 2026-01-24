import { genTimeoutAttempt } from '../helper/helpers';
import type { OptionalPromise } from '../helper/typeHelpers';
import type CacheManager from '../others/CacheManager';

const lockSet = new Set<string>();
export async function unlocking<T>(
    key: string,
    callback: () => OptionalPromise<T>,
) {
    if (lockSet.has(key)) {
        await new Promise((resolve) => {
            setTimeout(resolve, 1);
        });
        return unlocking(key, callback);
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
