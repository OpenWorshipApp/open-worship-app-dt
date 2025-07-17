import { OptionalPromise } from '../helper/typeHelpers';

const lockSet = new Set<string>();
export async function unlocking<T>(
    key: string,
    callback: () => OptionalPromise<T>,
) {
    if (lockSet.has(key)) {
        await new Promise((resolve) => {
            setTimeout(resolve, 100);
        });
        return unlocking(key, callback);
    }
    lockSet.add(key);
    const data = await callback();
    lockSet.delete(key);
    return data;
}
