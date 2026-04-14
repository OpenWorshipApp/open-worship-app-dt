import { beforeEach, describe, expect, test, vi } from 'vitest';

const { getItemMock, setItemMock } = vi.hoisted(() => ({
    getItemMock: vi.fn(),
    setItemMock: vi.fn(),
}));

vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        getItem: getItemMock,
        setItem: setItemMock,
    },
}));

import SettingManager from './SettingManager';

describe('SettingManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getItemMock.mockReturnValue(null);
    });

    test('returns the default value when storage is empty', () => {
        const manager = new SettingManager<string>({
            settingName: 'theme',
            defaultValue: 'light',
        });

        expect(manager.getSetting()).toBe('light');
        expect(getItemMock).toHaveBeenCalledWith('theme');
    });

    test('deserializes stored values when valid', () => {
        getItemMock.mockReturnValue('{"enabled":true}');

        const manager = new SettingManager<{ enabled: boolean }>({
            settingName: 'feature',
            defaultValue: { enabled: false },
            validate: (value) => value.includes('enabled'),
            serialize: (value) => JSON.stringify(value),
            deserialize: (value) => JSON.parse(value),
        });

        expect(manager.getSetting()).toEqual({ enabled: true });
    });

    test('throws when stored data is invalid and fallback is disabled', () => {
        getItemMock.mockReturnValue('bad');

        const manager = new SettingManager<string>({
            settingName: 'mode',
            defaultValue: 'safe',
            validate: (value) => value !== 'bad',
        });

        expect(() => manager.getSetting()).toThrow(
            'Invalid setting value: bad',
        );
    });

    test('returns the default when invalid data should fall back', () => {
        getItemMock.mockReturnValue('broken');

        const manager = new SettingManager<number>({
            settingName: 'zoom',
            defaultValue: 100,
            isErrorToDefault: true,
            validate: (value) => value !== 'broken',
            serialize: (value) => `${value}`,
            deserialize: (value) => Number.parseInt(value, 10),
        });

        expect(manager.getSetting()).toBe(100);
    });

    test('serializes and stores valid values', () => {
        const manager = new SettingManager<string>({
            settingName: 'language',
            defaultValue: 'en',
            validate: (value) => value !== 'invalid',
        });

        manager.setSetting('ko');

        expect(setItemMock).toHaveBeenCalledWith('language', 'ko');
    });

    test('rejects invalid values during setSetting', () => {
        const manager = new SettingManager<string>({
            settingName: 'language',
            defaultValue: 'en',
            validate: (value) => value !== 'invalid',
        });

        expect(() => manager.setSetting('invalid')).toThrow(
            'Invalid setting value: invalid',
        );
    });
});
