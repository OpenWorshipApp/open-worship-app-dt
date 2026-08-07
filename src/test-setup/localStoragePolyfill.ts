import { beforeEach } from 'vitest';

import { releaseAllDerivedSettings } from '../helper/derivedSettingRegistry';

// Settings whose parsed form is memoized are keyed on the raw setting string,
// which is exact in the app but not across tests: a test that mocks `getSetting`
// to return the same string as the previous one while expecting a different
// parse would be served the stale entry. Dropping them per test costs nothing
// and removes the trap. The registry is import-free on purpose so this does not
// pull the app graph into node-environment tests.
beforeEach(() => {
    releaseAllDerivedSettings();
});

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
