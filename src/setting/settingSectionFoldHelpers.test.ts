import { beforeEach, describe, expect, test, vi } from 'vitest';

const settingMap = new Map<string, string>();

vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => settingMap.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        settingMap.set(key, value);
    },
    removeSetting: (key: string) => {
        settingMap.delete(key);
    },
}));

import {
    forgetIsSettingSectionCollapsed,
    getIsSettingSectionCollapsed,
    saveIsSettingSectionCollapsed,
    toCustomServerFoldName,
} from './settingSectionFoldHelpers';

beforeEach(() => {
    settingMap.clear();
});

describe('the fold of a part of the Others tab', () => {
    test('is open until somebody folds it', () => {
        // A fresh install must show where the keys go: the fold is only ever
        // a thing the user did.
        expect(getIsSettingSectionCollapsed('ai')).toBe(false);
        expect(getIsSettingSectionCollapsed('ai-openai')).toBe(false);
    });

    test('is remembered both ways, so the next window opens as it was left', () => {
        saveIsSettingSectionCollapsed('ai', true);
        expect(settingMap.get('setting-section-collapsed-ai')).toBe('true');
        expect(getIsSettingSectionCollapsed('ai')).toBe(true);
        saveIsSettingSectionCollapsed('ai', false);
        expect(getIsSettingSectionCollapsed('ai')).toBe(false);
    });

    test('each part keeps its own, a box apart from the section around it', () => {
        saveIsSettingSectionCollapsed('ai', true);
        expect(getIsSettingSectionCollapsed('song-select')).toBe(false);
        expect(getIsSettingSectionCollapsed('extra-bin')).toBe(false);
        expect(getIsSettingSectionCollapsed('ai-openai')).toBe(false);
        expect(getIsSettingSectionCollapsed('ai-custom-servers')).toBe(false);
    });

    test('anything else in the setting reads as open', () => {
        // `setSetting(key, null)` blanks a key rather than removing it.
        settingMap.set('setting-section-collapsed-ai', '');
        expect(getIsSettingSectionCollapsed('ai')).toBe(false);
        settingMap.set('setting-section-collapsed-ai', 'yes');
        expect(getIsSettingSectionCollapsed('ai')).toBe(false);
    });

    test('a server is told from the list of servers, and from the next one', () => {
        const first = toCustomServerFoldName('0b362a82-ddd7');
        const second = toCustomServerFoldName('7d1f0c11-aaaa');
        saveIsSettingSectionCollapsed(first, true);

        expect(
            settingMap.get(
                'setting-section-collapsed-ai-custom-server-0b362a82-ddd7',
            ),
        ).toBe('true');
        expect(getIsSettingSectionCollapsed(second)).toBe(false);
        expect(getIsSettingSectionCollapsed('ai-custom-servers')).toBe(false);
    });

    test('a deleted server leaves no fold behind', () => {
        const foldName = toCustomServerFoldName('0b362a82-ddd7');
        saveIsSettingSectionCollapsed(foldName, true);

        forgetIsSettingSectionCollapsed(foldName);

        expect(settingMap.size).toBe(0);
        expect(getIsSettingSectionCollapsed(foldName)).toBe(false);
    });
});
