import appProvider from '../server/appProvider';
import { unlocking } from '../server/unlockingHelpers';

type StoreType<T> = { value: T; timestamp: number };
export default class CacheManager<T> {
    private readonly uuid: string;
    private readonly cache: Map<string, StoreType<T>>;
    private readonly expirationSecond: number | null;
    private intervalId: NodeJS.Timeout | null = null;

    constructor(expirationSecond: number | null = null) {
        this.uuid = crypto.randomUUID();
        this.cache = new Map();
        this.expirationSecond = expirationSecond;
    }

    // Lazy: only runs while there is something that can expire, so the many
    // module-level instances don't each keep an eternal 5s timer alive.
    private ensureCleanupScheduled(): void {
        if (this.expirationSecond === null || this.intervalId !== null) {
            return;
        }
        const cleanupMillis = 5 * 1000; // 5 seconds
        this.intervalId = setInterval(this.cleanup.bind(this), cleanupMillis);
    }

    unlocking<P>(key: string, callback: () => Promise<P>): Promise<P> {
        return unlocking<P>(`caching-${this.uuid}-${key}`, async () => {
            return await callback();
        });
    }

    checkIsExpired(item: StoreType<T>): boolean {
        if (this.expirationSecond === null) {
            return false;
        }
        return Date.now() - item.timestamp > this.expirationSecond * 1000;
    }

    private _cleanup(): void {
        for (const [key, item] of this.cache) {
            if (this.checkIsExpired(item)) {
                this.cache.delete(key);
            }
        }
        if (this.cache.size === 0) {
            this.stopCleanup();
        }
    }

    async cleanup(): Promise<void> {
        await this.unlocking('cleanup', async () => {
            this._cleanup();
        });
    }

    getSync(key: string): T | null {
        const cacheItem = this.cache.get(key);
        if (cacheItem) {
            if (this.checkIsExpired(cacheItem)) {
                this.cache.delete(key);
                return null;
            }
            // The timestamp is the moment the value was READ FROM SOURCE, and a
            // read must never move it: refreshing it here made the expiry
            // SLIDING, so anything asked for more often than `expirationSecond`
            // never expired at all. `FileSource`'s 2s file-data cache is re-read
            // constantly by the presenting flow's on-screen pass, and the result was a
            // presenting flow tree serving bytes from disk that the file had long since
            // moved past — through `fs.watch`, through Reload, through a whole
            // window reload. An expiry has to be measured from the write.
            return cacheItem.value;
        }
        return null;
    }

    async has(key: string): Promise<boolean> {
        return await this.unlocking(key, async () => {
            return this.hasSync(key);
        });
    }

    async get(key: string): Promise<T | null> {
        return await this.unlocking(key, async () => {
            return this.getSync(key);
        });
    }

    hasSync(key: string): boolean {
        const cacheItem = this.cache.get(key);
        if (cacheItem === undefined) {
            return false;
        }
        // `get` treats expired entries as absent; `has` must agree, or a
        // has→get sequence reports a false "cached null".
        if (this.checkIsExpired(cacheItem)) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }

    setSync(key: string, value: T): void {
        if (appProvider.isPageScreen) {
            return;
        }
        this.cache.set(key, { value, timestamp: Date.now() });
        this.ensureCleanupScheduled();
    }

    async set(key: string, value: T): Promise<void> {
        await this.unlocking(key, async () => {
            this.setSync(key, value);
        });
    }

    deleteSync(key: string): void {
        this.cache.delete(key);
    }

    async delete(key: string): Promise<void> {
        await this.unlocking(key, async () => {
            this.deleteSync(key);
        });
    }

    clear(): void {
        this.cache.clear();
        this.stopCleanup();
    }

    stopCleanup(): void {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}

// CacheManager instance with 1 minute expiration
export const globalCacheManager1M = new CacheManager<any>(60);
