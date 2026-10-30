import { beforeEach, describe, expect, test, vi } from 'vitest';

const { removeSettingMock } = vi.hoisted(() => ({
    removeSettingMock: vi.fn(),
}));

vi.mock('../../helper/settingHelpers', () => ({
    getSetting: vi.fn(() => null),
    removeSetting: removeSettingMock,
    setSetting: vi.fn(),
}));

vi.mock('../../helper/helpers', () => ({
    parseJsonSafely: vi.fn(() => null),
}));

vi.mock('../../server/unlockingHelpers', () => ({
    unlocking: vi.fn(async (_key: string, callback: () => unknown) => {
        return await callback();
    }),
}));

vi.mock('./screenHelpers', () => ({
    SCREEN_MANAGER_SETTING_NAME: 'screen-manager',
}));

import { screenManagerSettingNames } from '../../helper/constants';
import { parseJsonSafely } from '../../helper/helpers';
import { getSetting, setSetting } from '../../helper/settingHelpers';
import { unlocking } from '../../server/unlockingHelpers';
import {
    deleteScreenPersistedData,
    removeRetiredScreenSettings,
} from './screenManagerDeleteHelpers';
import { previewerSettingPrefixList } from './screenSettingKeyHelpers';

describe('removeRetiredScreenSettings', () => {
    beforeEach(() => {
        removeSettingMock.mockClear();
    });

    test('drops the removed Mask feature key for that screen only', () => {
        removeRetiredScreenSettings(2);
        expect(removeSettingMock).toHaveBeenCalledTimes(1);
        expect(removeSettingMock).toHaveBeenCalledWith('screen-mask-2');
    });
});

describe('deleteScreenPersistedData', () => {
    const settingStore = new Map<string, string>();
    const lockKeys: string[] = [];

    beforeEach(() => {
        settingStore.clear();
        lockKeys.length = 0;
        removeSettingMock.mockClear();
        vi.mocked(getSetting).mockImplementation((name: string) => {
            return settingStore.get(name) ?? null;
        });
        vi.mocked(setSetting).mockImplementation(
            (name: string, value: string | null) => {
                settingStore.set(name, value ?? '');
            },
        );
        vi.mocked(parseJsonSafely).mockImplementation((json: any) => {
            try {
                return json ? JSON.parse(json) : null;
            } catch {
                return null;
            }
        });
        vi.mocked(unlocking).mockImplementation(
            async (key: string, callback: () => unknown) => {
                lockKeys.push(key);
                return await callback();
            },
        );
    });

    test('drops the keys no manager owns: display and previewer settings', async () => {
        await deleteScreenPersistedData(3);
        const removed = removeSettingMock.mock.calls.map((call) => call[0]);
        expect(removed).toContain('screen-manager-pid-3');
        for (const prefix of previewerSettingPrefixList) {
            expect(removed).toContain(`${prefix}3`);
        }
        expect(removed).toHaveLength(previewerSettingPrefixList.length + 1);
    });

    test('removes only that screen from every on-screen map, under each writer lock', async () => {
        const names = screenManagerSettingNames;
        for (const name of [
            names.BACKGROUND,
            names.FOREGROUND,
            names.VARY_APP_DOCUMENT,
            names.FULL_TEXT,
        ]) {
            settingStore.set(
                name,
                JSON.stringify({ 1: { kept: name }, 3: { gone: true } }),
            );
        }
        await deleteScreenPersistedData(3);
        for (const name of [
            names.BACKGROUND,
            names.FOREGROUND,
            names.VARY_APP_DOCUMENT,
            names.FULL_TEXT,
        ]) {
            expect(JSON.parse(settingStore.get(name)!)).toEqual({
                1: { kept: name },
            });
        }
        // The long text writes under a `set-` lock; the others under the name.
        expect(lockKeys).toEqual([
            names.BACKGROUND,
            names.FOREGROUND,
            names.VARY_APP_DOCUMENT,
            `set-${names.FULL_TEXT}`,
        ]);
    });

    test('a map without that screen is not rewritten', async () => {
        settingStore.set(
            screenManagerSettingNames.BACKGROUND,
            JSON.stringify({ 1: { src: '#fff' } }),
        );
        await deleteScreenPersistedData(3);
        expect(setSetting).not.toHaveBeenCalled();
    });

    test('an unreadable map is left alone rather than wiped', async () => {
        settingStore.set(screenManagerSettingNames.FOREGROUND, '{broken');
        settingStore.set(screenManagerSettingNames.BACKGROUND, '42');
        await deleteScreenPersistedData(3);
        expect(setSetting).not.toHaveBeenCalled();
        expect(settingStore.get(screenManagerSettingNames.FOREGROUND)).toBe(
            '{broken',
        );
    });
});
