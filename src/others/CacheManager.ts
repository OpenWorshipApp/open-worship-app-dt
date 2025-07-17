import { unlocking } from '../server/unlockingHelpers';

type StoreType<T> = { value: T; timestamp: number };
export default class CacheManager<T> {
    private readonly cache: Map<string, StoreType<T>>;
    private readonly expirationSecond: number | null;

    constructor(expirationSecond: number | null = null) {
        this.cache = new Map();
        this.expirationSecond = expirationSecond;
        const cleanupSeconds = 5 * 1000; // 5 seconds
        setInterval(this.cleanup.bind(this), cleanupSeconds);
    }

    unlocking<P>(key: string, callback: () => Promise<P>): Promise<P> {
        return unlocking<P>(`caching-${key}`, async () => {
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
            cacheItem.timestamp = Date.now();
            return cacheItem.value;
        }
        return null;
    }

    async get(key: string): Promise<T | null> {
        return await this.unlocking(key, async () => {
            return this.getSync(key);
        });
    }

    setSync(key: string, value: T): void {
        this.cache.set(key, { value, timestamp: Date.now() });
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
    }
}
