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

import SettingManager, { genStringListSettingManager } from './SettingManager';

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

describe('genStringListSettingManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getItemMock.mockReturnValue(null);
    });

    test('returns an empty list when nothing is stored', () => {
        const manager = genStringListSettingManager('history-text-list');

        expect(manager.getSetting()).toEqual([]);
        expect(getItemMock).toHaveBeenCalledWith('history-text-list');
    });

    test('reads back a stored list', () => {
        getItemMock.mockReturnValue('["Gen 1:1","John 3:16"]');

        const manager = genStringListSettingManager('history-text-list');

        expect(manager.getSetting()).toEqual(['Gen 1:1', 'John 3:16']);
    });

    // The defect this replaced: an unguarded `JSON.parse` in a render body
    // threw on a truncated settings file and took the panel down with it.
    test('falls back to the default when the stored JSON is truncated', () => {
        getItemMock.mockReturnValue('["Gen 1:1","John 3:1');

        const manager = genStringListSettingManager('history-text-list');

        expect(manager.getSetting()).toEqual([]);
    });

    test('falls back to the default when the stored JSON is not an array', () => {
        getItemMock.mockReturnValue('{"nope":true}');

        const manager = genStringListSettingManager('history-text-list');

        expect(manager.getSetting()).toEqual([]);
    });

    test('drops non-string entries instead of failing the whole read', () => {
        getItemMock.mockReturnValue('["Gen 1:1",42,null,"John 3:16"]');

        const manager = genStringListSettingManager('history-text-list');

        expect(manager.getSetting()).toEqual(['Gen 1:1', 'John 3:16']);
    });

    test('serializes the list on write', () => {
        const manager = genStringListSettingManager('history-text-list');

        manager.setSetting(['Gen 1:1']);

        expect(setItemMock).toHaveBeenCalledWith(
            'history-text-list',
            '["Gen 1:1"]',
        );
    });
});
