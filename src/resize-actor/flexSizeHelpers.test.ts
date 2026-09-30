// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const { values, mocks } = vi.hoisted(() => ({
    values: new Map<string, string>(),
    mocks: { set: vi.fn(), remove: vi.fn(), error: vi.fn() },
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => values.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        values.set(key, value);
        mocks.set(key, value);
    },
    removeSettingsByPrefix: mocks.remove,
    toFilePathSettingName: (name: string, path: string) => `${name}-${path}`,
}));
vi.mock('../helper/helpers', () => ({
    parseJsonSafely: (value: string) => JSON.parse(value),
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: mocks.error }));

import {
    clearWidgetSizeSetting,
    getFlexSizeSetting,
    keyToDataFlexSizeKey,
    setDisablingSetting,
    toAppDocumentFlexSizeName,
    toSettingString,
} from './flexSizeHelpers';

const defaults = { left: ['0.25 1 0%'], right: ['0.75 1 0%'] } as any;

describe('flex size settings', () => {
    beforeEach(() => {
        values.clear();
        vi.clearAllMocks();
    });
    test('repairs malformed stored layouts and keeps valid panes filling available space', () => {
        expect(() => getFlexSizeSetting('x', {})).toThrow('at least one key');
        values.set(toSettingString('x'), '{bad');
        expect(getFlexSizeSetting('x', defaults)).toEqual(defaults);
        expect(mocks.set).toHaveBeenCalledWith(
            toSettingString('x'),
            JSON.stringify(defaults),
        );
        values.set(
            toSettingString('x'),
            JSON.stringify({ left: ['0.2 1 0%'], right: ['0.2 1 0%'] }),
        );
        expect(
            getFlexSizeSetting('x', defaults, [
                { key: 'left' },
                { key: 'right' },
            ] as any),
        ).toEqual({ left: ['0.8 1 0%'], right: ['0.8 1 0%'] });
    });
    test('stores disabling state from the live layout and uses collision-proof names', async () => {
        const pane = document.createElement('div');
        pane.dataset.fs = 'x-left';
        pane.style.flex = '0.6 1 0%';
        document.body.append(pane);
        values.set(toSettingString('x'), JSON.stringify(defaults));
        expect(
            setDisablingSetting('x', defaults, 'x-left', ['second', 0.2]),
        ).toEqual({
            left: ['0.6 1 0%', ['second', 0.2]],
            right: ['0.75 1 0%'],
        });
        pane.remove();
        expect(keyToDataFlexSizeKey('x', 'left')).toBe('x-left');
        expect(toAppDocumentFlexSizeName('preview', 'C:/songs/a')).toBe(
            'preview-C:/songs/a',
        );
        await clearWidgetSizeSetting();
        expect(mocks.remove).toHaveBeenCalledWith('widget-size');
    });
});
