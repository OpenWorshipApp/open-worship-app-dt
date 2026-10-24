import { beforeEach, describe, expect, test, vi } from 'vitest';

const settingMap = new Map<string, string>();

vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => settingMap.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        settingMap.set(key, value);
    },
}));

import {
    genHeadSummary,
    getIsHeadCollapsed,
    saveIsHeadCollapsed,
} from './headCollapseHelpers';

beforeEach(() => {
    settingMap.clear();
});

describe('the fold of the head', () => {
    test('is open until somebody folds it', () => {
        // A fresh install must show every picker: the fold is only ever a
        // thing the user did.
        expect(getIsHeadCollapsed()).toBe(false);
    });

    test('is remembered both ways, so the next window opens as it was left', () => {
        saveIsHeadCollapsed(true);
        expect(settingMap.get('chatbot-head-collapsed')).toBe('true');
        expect(getIsHeadCollapsed()).toBe(true);
        saveIsHeadCollapsed(false);
        expect(getIsHeadCollapsed()).toBe(false);
    });

    test('anything else in the setting reads as open', () => {
        // `setSetting(key, null)` blanks a key rather than removing it.
        settingMap.set('chatbot-head-collapsed', '');
        expect(getIsHeadCollapsed()).toBe(false);
        settingMap.set('chatbot-head-collapsed', 'yes');
        expect(getIsHeadCollapsed()).toBe(false);
    });
});

describe('genHeadSummary', () => {
    test('reads the pickers in the order they stand in', () => {
        expect(genHeadSummary(['Presenter', 'Claude', 'Sonnet 5'])).toBe(
            'Presenter · Claude · Sonnet 5',
        );
    });

    test('a picker with nothing chosen leaves no gap behind', () => {
        // No provider at all: there is no model to name.
        expect(genHeadSummary(['Bible Reader', null, undefined, ''])).toBe(
            'Bible Reader',
        );
        expect(genHeadSummary(['Presenter', '  ', ' Free '])).toBe(
            'Presenter · Free',
        );
        expect(genHeadSummary([])).toBe('');
    });
});
