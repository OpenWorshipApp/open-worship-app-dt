import { beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => {
    return {
        settings: new Map<string, string>(),
        written: [] as [string, string][],
        lockKeys: [] as string[],
        isWriter: true,
    };
});

vi.mock('../../helper/settingHelpers', () => ({
    getSetting: (key: string) => {
        return state.settings.get(key) ?? null;
    },
    setSetting: (key: string, value: string) => {
        state.written.push([key, value]);
        state.settings.set(key, value);
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
        state.lockKeys.push(key);
        return await callback();
    },
}));
vi.mock('./onScreenSettingPersistHelpers', () => ({
    checkIsOnScreenSettingWriter: () => state.isWriter,
}));

import {
    cache,
    deleteScreenManagerBaseCache,
    getAllScreenManagerBases,
    getScreenManagerBase,
    getScreenManagerBaseByKey,
    getScreenManagersInstanceSetting,
    getSelectedScreenManagerBases,
    getValidOnScreen,
    saveScreenManagersSetting,
    setScreenManagerBaseCache,
} from './screenManagerBaseHelpers';

const MANAGERS = 'screen-managers';

function genBase(
    screenId: number,
    {
        isSelected = false,
        isLocked = false,
        stage = 0,
        colorNote = null as string | null,
    } = {},
) {
    return {
        key: screenId.toString(),
        screenId,
        isSelected,
        isLocked,
        stage,
        getColorNote: async () => colorNote,
    } as any;
}

function setManagersSetting(list: unknown[]) {
    state.settings.set(MANAGERS, JSON.stringify(list));
}

function readManagersSetting() {
    return JSON.parse(state.settings.get(MANAGERS) ?? 'null');
}

beforeEach(() => {
    state.settings.clear();
    state.written.length = 0;
    state.lockKeys.length = 0;
    state.isWriter = true;
    cache.clear();
});

describe('getScreenManagersInstanceSetting', () => {
    test('nothing stored, or nothing readable, is no screens', () => {
        expect(getScreenManagersInstanceSetting()).toEqual([]);
        state.settings.set(MANAGERS, '{broken');
        expect(getScreenManagersInstanceSetting()).toEqual([]);
    });

    test('keeps one entry per numeric screen id, the first one', () => {
        setManagersSetting([
            { screenId: 0, isSelected: true },
            { screenId: '1', isSelected: true },
            { screenId: 2, isSelected: false },
            { screenId: 0, isSelected: false },
            { isSelected: true },
        ]);

        expect(getScreenManagersInstanceSetting()).toEqual([
            { screenId: 0, isSelected: true },
            { screenId: 2, isSelected: false },
        ]);
    });

    test('hands out a copy, never the memoized list', () => {
        setManagersSetting([{ screenId: 0 }, { screenId: 1 }]);

        const first = getScreenManagersInstanceSetting();
        first.splice(0, 2);
        expect(getScreenManagersInstanceSetting()).toHaveLength(2);
    });

    test('follows the setting as soon as it changes', () => {
        setManagersSetting([{ screenId: 0 }]);
        expect(getScreenManagersInstanceSetting()).toHaveLength(1);

        setManagersSetting([{ screenId: 0 }, { screenId: 3 }]);
        expect(
            getScreenManagersInstanceSetting().map(({ screenId }) => screenId),
        ).toEqual([0, 3]);
    });
});

describe('getValidOnScreen', () => {
    test('keeps only the entries of screens that exist', () => {
        setManagersSetting([{ screenId: 0 }, { screenId: 2 }]);

        expect(
            getValidOnScreen({ 0: 'a', 1: 'b', 2: 'c', other: 'd' }),
        ).toEqual({ 0: 'a', 2: 'c' });
    });

    test('with no screens at all, nothing is valid', () => {
        expect(getValidOnScreen({ 0: 'a' })).toEqual({});
    });
});

describe('the screen manager cache', () => {
    test('stores, finds, lists sorted and forgets screen managers', () => {
        const base2 = genBase(2, { isSelected: true });
        const base0 = genBase(0);
        const base1 = genBase(1, { isSelected: true });
        setScreenManagerBaseCache(base2);
        setScreenManagerBaseCache(base0);
        setScreenManagerBaseCache(base1);

        expect(getScreenManagerBase(1)).toBe(base1);
        expect(getScreenManagerBase(5)).toBeNull();
        expect(getScreenManagerBaseByKey('2')).toBe(base2);
        expect(getScreenManagerBaseByKey('x')).toBeNull();
        // The "which screen?" picker lists 0, 1, 2 -- never insertion order.
        expect(getAllScreenManagerBases()).toEqual([base0, base1, base2]);
        expect(getSelectedScreenManagerBases()).toEqual([base1, base2]);

        deleteScreenManagerBaseCache('1');
        expect(getScreenManagerBase(1)).toBeNull();
        expect(getAllScreenManagerBases()).toEqual([base0, base2]);
    });
});

describe('saveScreenManagersSetting', () => {
    test('writes every live screen, keeping the stored ones it does not hold', async () => {
        setManagersSetting([
            {
                screenId: 0,
                isSelected: false,
                isLocked: false,
                stageNumber: 0,
                colorNote: null,
            },
            {
                screenId: 4,
                isSelected: true,
                isLocked: false,
                stageNumber: 2,
                colorNote: 'blue',
            },
        ]);
        setScreenManagerBaseCache(
            genBase(0, { isSelected: true, isLocked: true, stage: 1 }),
        );
        setScreenManagerBaseCache(genBase(3, { colorNote: 'red' }));

        await saveScreenManagersSetting();

        expect(state.lockKeys).toEqual([MANAGERS]);
        expect(readManagersSetting()).toEqual([
            {
                screenId: 0,
                isSelected: true,
                isLocked: true,
                stageNumber: 1,
                colorNote: null,
            },
            {
                screenId: 4,
                isSelected: true,
                isLocked: false,
                stageNumber: 2,
                colorNote: 'blue',
            },
            {
                screenId: 3,
                isSelected: false,
                isLocked: false,
                stageNumber: 0,
                colorNote: 'red',
            },
        ]);
    });

    test('drops the screen being deleted', async () => {
        setManagersSetting([{ screenId: 0 }, { screenId: 1 }]);
        setScreenManagerBaseCache(genBase(0));
        setScreenManagerBaseCache(genBase(1));

        await saveScreenManagersSetting(1);

        expect(
            readManagersSetting().map(({ screenId }: any) => screenId),
        ).toEqual([0]);
    });

    test('a projector window never rewrites the list', async () => {
        state.isWriter = false;
        setManagersSetting([{ screenId: 0 }]);
        setScreenManagerBaseCache(genBase(0));
        setScreenManagerBaseCache(genBase(1));

        await saveScreenManagersSetting();

        expect(state.written).toEqual([]);
        expect(readManagersSetting()).toEqual([{ screenId: 0 }]);
    });
});
