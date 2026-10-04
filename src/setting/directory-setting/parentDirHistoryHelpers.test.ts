import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        homeItems: new Map<string, string>(),
        setItemCount: 0,
    };
});

// Windows paths on a case-insensitive file system, whatever runs the test.
vi.mock('../../server/appProvider', async () => {
    const nodePath = await import('node:path');
    return {
        default: {
            pathUtils: nodePath.win32,
            systemUtils: { isLinux: false },
            sessionData: { defaultStorageDirPath: null },
        },
    };
});
vi.mock('../../helper/errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('../../server/appHomeStorage', () => ({
    appHomeStorage: {
        getItem: (key: string) => {
            return h.homeItems.get(key) ?? null;
        },
        setItem: (key: string, value: string) => {
            h.setItemCount++;
            h.homeItems.set(key, value);
        },
    },
}));

import {
    addParentDirHistory,
    getParentDirHistory,
    MAX_PARENT_DIR_HISTORY_COUNT,
    PARENT_DIR_HISTORY_SETTING_NAME,
    removeParentDirHistory,
    replaceParentDirHistory,
    toParentDirHistory,
} from './parentDirHistoryHelpers';

beforeEach(() => {
    h.homeItems.clear();
    h.setItemCount = 0;
});

describe('toParentDirHistory', () => {
    test('one folder is listed once, whatever its case or trailing slash', () => {
        expect(
            toParentDirHistory(['D:\\Data', 'd:\\data\\', '  D:\\DATA  ']),
        ).toEqual(['D:\\Data']);
    });

    test('anything but a non-empty path is dropped', () => {
        expect(toParentDirHistory(['', '   ', 3, null, 'E:\\x'])).toEqual([
            'E:\\x',
        ]);
        expect(toParentDirHistory('E:\\x')).toEqual([]);
        expect(toParentDirHistory(null)).toEqual([]);
    });

    test('the list is capped, keeping the newest', () => {
        const dirPaths = Array.from({ length: 15 }, (_, i) => {
            return `D:\\data-${i}`;
        });
        const history = toParentDirHistory(dirPaths);
        expect(history).toHaveLength(MAX_PARENT_DIR_HISTORY_COUNT);
        expect(history[0]).toBe('D:\\data-0');
    });
});

describe('the saved list', () => {
    test('a broken value reads as empty rather than throwing', () => {
        h.homeItems.set(PARENT_DIR_HISTORY_SETTING_NAME, '{not json');
        expect(getParentDirHistory()).toEqual([]);
    });

    test('a folder used again moves to the front, the last given first', () => {
        addParentDirHistory('D:\\a');
        addParentDirHistory('D:\\b');
        addParentDirHistory('D:\\c', 'D:\\A');
        expect(getParentDirHistory()).toEqual(['D:\\A', 'D:\\c', 'D:\\b']);
    });

    test('an empty or missing path adds nothing', () => {
        addParentDirHistory(null, '');
        expect(h.setItemCount).toBe(0);
        expect(getParentDirHistory()).toEqual([]);
    });

    test('nothing is written when the list would not change', () => {
        addParentDirHistory('D:\\b', 'D:\\a');
        expect(h.setItemCount).toBe(1);
        addParentDirHistory('D:\\a\\');
        removeParentDirHistory('D:\\elsewhere');
        expect(h.setItemCount).toBe(1);
    });

    test('the spelling chosen last is the one kept', () => {
        addParentDirHistory('D:\\b', 'D:\\Data');
        addParentDirHistory('d:\\data');
        expect(getParentDirHistory()).toEqual(['d:\\data', 'D:\\b']);
    });

    test('a folder is removed by any spelling of it', () => {
        addParentDirHistory('D:\\a', 'D:\\b');
        removeParentDirHistory('d:\\A\\');
        expect(getParentDirHistory()).toEqual(['D:\\b']);
    });

    test('a folder found elsewhere takes over its entry in place', () => {
        addParentDirHistory('D:\\a', 'E:\\stick', 'D:\\b');
        replaceParentDirHistory('E:\\stick', 'F:\\stick');
        expect(getParentDirHistory()).toEqual(['D:\\b', 'F:\\stick', 'D:\\a']);
    });

    test('a replacement already listed is kept once', () => {
        addParentDirHistory('F:\\stick', 'E:\\stick');
        replaceParentDirHistory('E:\\stick', 'F:\\stick');
        expect(getParentDirHistory()).toEqual(['F:\\stick']);
    });
});
