// Provides an in-memory `localStorage` for node-environment tests.
// jsdom-environment tests already supply their own `localStorage`, so this
// polyfill only installs when the global is missing.
if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map<string, string>();
    const localStoragePolyfill: Storage = {
        get length() {
            return store.size;
        },
        clear() {
            store.clear();
        },
        getItem(key: string) {
            return store.has(key) ? (store.get(key) as string) : null;
        },
        key(index: number) {
            return Array.from(store.keys())[index] ?? null;
        },
        removeItem(key: string) {
            store.delete(key);
        },
        setItem(key: string, value: string) {
            store.set(key, String(value));
        },
    };
    globalThis.localStorage = localStoragePolyfill;
}
