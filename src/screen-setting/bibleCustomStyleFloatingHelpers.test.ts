// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const { settingStore } = vi.hoisted(() => ({
    settingStore: new Map<string, string>(),
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => settingStore.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        settingStore.set(key, value);
    },
}));

import {
    getIsBibleCustomStyleFloatingShowing,
    setIsBibleCustomStyleFloatingShowing,
    toggleBibleCustomStyleFloatingShowing,
} from './bibleCustomStyleFloatingHelpers';

describe('bibleCustomStyleFloatingHelpers', () => {
    beforeEach(() => {
        settingStore.clear();
    });

    test('every toggle button shares one floating-widget state', () => {
        expect(getIsBibleCustomStyleFloatingShowing()).toBe(false);

        setIsBibleCustomStyleFloatingShowing(true);
        expect(getIsBibleCustomStyleFloatingShowing()).toBe(true);
        expect(settingStore.get('bible-custom-style-floating')).toBe('true');

        toggleBibleCustomStyleFloatingShowing();
        expect(getIsBibleCustomStyleFloatingShowing()).toBe(false);

        toggleBibleCustomStyleFloatingShowing();
        expect(getIsBibleCustomStyleFloatingShowing()).toBe(true);
    });
});
