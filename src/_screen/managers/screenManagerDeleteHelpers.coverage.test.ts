import { beforeEach, describe, expect, test, vi } from 'vitest';

// A settings file in memory. Plain functions, not `vi.fn`, so `mockReset`
// cannot wipe them between tests; every write and lock is recorded instead.
const store = vi.hoisted(() => {
    return {
        values: new Map<string, string>(),
        removed: [] as string[],
        written: [] as [string, string][],
        lockKeys: [] as string[],
    };
});

vi.mock('../../helper/settingHelpers', () => ({
    getSetting: (key: string) => {
        return store.values.get(key) ?? null;
    },
    setSetting: (key: string, value: string) => {
        store.written.push([key, value]);
        store.values.set(key, value);
    },
    removeSetting: (key: string) => {
        store.removed.push(key);
        store.values.delete(key);
    },
}));
// The real one is `JSON.parse` returning null on a throw; importing it would
// pull the language and provider modules in.
vi.mock('../../helper/helpers', () => ({
    parseJsonSafely: (json: string) => {
        if (!json) {
            return null;
        }
        try {
            return JSON.parse(json);
        } catch {
            return null;
        }
    },
}));
vi.mock('../../server/unlockingHelpers', () => ({
    unlocking: async (key: string, callback: () => unknown) => {
        store.lockKeys.push(key);
        return await callback();
    },
}));
vi.mock('./screenHelpers', () => ({
    SCREEN_MANAGER_SETTING_NAME: 'screen-display-',
}));

import { deleteScreenPersistedData } from './screenManagerDeleteHelpers';
import { previewerSettingPrefixList } from './screenSettingKeyHelpers';

const BACKGROUND = 'screen-bg-manager';
const FOREGROUND = 'screen-foreground-manager';
const VARY_APP_DOCUMENT = 'screen-vary-app-document-manager';
const FULL_TEXT = 'screen-ft-manager';

function readMap(settingName: string) {
    return JSON.parse(store.values.get(settingName) ?? 'null');
}

beforeEach(() => {
    store.values.clear();
    store.removed.length = 0;
    store.written.length = 0;
    store.lockKeys.length = 0;
});

describe('deleteScreenPersistedData', () => {
    test('drops every per-screen key nobody else owns', async () => {
        store.values.set('screen-display--pid-2', '17');
        store.values.set('screen-display--pid-3', '18');
        for (const prefix of previewerSettingPrefixList) {
            store.values.set(`${prefix}2`, 'x');
            store.values.set(`${prefix}3`, 'y');
        }

        await deleteScreenPersistedData(2);

        expect(store.removed).toEqual([
            'screen-display--pid-2',
            ...previewerSettingPrefixList.map((prefix) => `${prefix}2`),
        ]);
        // A reused screen id must not inherit them -- and screen 3 keeps its.
        expect(store.values.get('screen-display--pid-3')).toBe('18');
        for (const prefix of previewerSettingPrefixList) {
            expect(store.values.has(`${prefix}2`)).toBe(false);
            expect(store.values.get(`${prefix}3`)).toBe('y');
        }
    });

    test('removes only that screen from each on-screen map, under its writer lock', async () => {
        for (const settingName of [
            BACKGROUND,
            FOREGROUND,
            VARY_APP_DOCUMENT,
            FULL_TEXT,
        ]) {
            store.values.set(
                settingName,
                JSON.stringify({
                    1: { owner: 1 },
                    2: { owner: 2 },
                }),
            );
        }

        await deleteScreenPersistedData(2);

        for (const settingName of [
            BACKGROUND,
            FOREGROUND,
            VARY_APP_DOCUMENT,
            FULL_TEXT,
        ]) {
            expect(readMap(settingName)).toEqual({ 1: { owner: 1 } });
        }
        // The long-text map is written under a `set-`-prefixed lock.
        expect(store.lockKeys).toEqual([
            BACKGROUND,
            FOREGROUND,
            VARY_APP_DOCUMENT,
            `set-${FULL_TEXT}`,
        ]);
    });

    test('a map that never held the screen is not rewritten', async () => {
        store.values.set(BACKGROUND, JSON.stringify({ 1: { owner: 1 } }));
        store.values.set(FOREGROUND, JSON.stringify({ 2: { owner: 2 } }));

        await deleteScreenPersistedData(2);

        expect(store.written.map(([key]) => key)).toEqual([FOREGROUND]);
        expect(readMap(BACKGROUND)).toEqual({ 1: { owner: 1 } });
        expect(readMap(FOREGROUND)).toEqual({});
    });

    test('an unreadable or non-object setting is left exactly as it was', async () => {
        store.values.set(BACKGROUND, '{not json');
        store.values.set(FOREGROUND, '5');
        store.values.set(VARY_APP_DOCUMENT, 'null');
        // FULL_TEXT is not set at all.

        await deleteScreenPersistedData(2);

        expect(store.written).toEqual([]);
        expect(store.values.get(BACKGROUND)).toBe('{not json');
        expect(store.values.get(FOREGROUND)).toBe('5');
        expect(store.values.get(VARY_APP_DOCUMENT)).toBe('null');
        expect(store.values.has(FULL_TEXT)).toBe(false);
    });
});
