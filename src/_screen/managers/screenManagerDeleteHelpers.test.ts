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

import { removeRetiredScreenSettings } from './screenManagerDeleteHelpers';

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
