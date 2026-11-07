import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: async () => true,
    popupWidgetManager: { openConfirm: null },
}));

import {
    AI_CAUTION_HIDDEN_UNTIL_SETTING,
    AI_PROVIDER_WARN_HIDDEN_UNTIL_SETTING,
    checkIsAiCautionHidden,
    checkIsAiProviderWarnHidden,
    hideAiCautionForAWhile,
    hideAiProviderWarnForAWhile,
    readAiCautionHiddenTime,
    readAiProviderWarnHiddenTime,
    showAiCautionAgain,
    showAiProviderWarnAgain,
} from './aiCautionHelpers';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 3, 9, 0, 0);

beforeEach(() => {
    localStorage.clear();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('what Settings -> General lists as put away', () => {
    test('the caution: nothing, then the day it comes back, then nothing once passed', () => {
        expect(readAiCautionHiddenTime(NOW)).toBeNull();
        const until = hideAiCautionForAWhile(NOW);
        expect(until).toBe(NOW + 30 * DAY);
        expect(readAiCautionHiddenTime(NOW)).toBe(until);
        expect(readAiCautionHiddenTime(until + 1)).toBeNull();
        // The provider warning is its own key and was not put away.
        expect(readAiProviderWarnHiddenTime(NOW)).toBeNull();
    });

    test('the provider warning, on its own key', () => {
        const until = hideAiProviderWarnForAWhile(NOW);
        expect(
            localStorage.getItem(AI_PROVIDER_WARN_HIDDEN_UNTIL_SETTING),
        ).toBe(String(until));
        expect(readAiProviderWarnHiddenTime(NOW)).toBe(NOW + 30 * DAY);
        expect(readAiProviderWarnHiddenTime(until)).toBeNull();
        expect(readAiCautionHiddenTime(NOW)).toBeNull();
    });
});

describe('showing them again before the 30 days are up', () => {
    test('brings back the caution alone', () => {
        hideAiCautionForAWhile(NOW);
        hideAiProviderWarnForAWhile(NOW);
        showAiCautionAgain();
        expect(
            localStorage.getItem(AI_CAUTION_HIDDEN_UNTIL_SETTING),
        ).toBeNull();
        expect(checkIsAiCautionHidden(NOW)).toBe(false);
        expect(checkIsAiProviderWarnHidden(NOW)).toBe(true);
    });

    test('brings back the provider warning alone', () => {
        hideAiCautionForAWhile(NOW);
        hideAiProviderWarnForAWhile(NOW);
        showAiProviderWarnAgain();
        expect(
            localStorage.getItem(AI_PROVIDER_WARN_HIDDEN_UNTIL_SETTING),
        ).toBeNull();
        expect(checkIsAiProviderWarnHidden(NOW)).toBe(false);
        expect(checkIsAiCautionHidden(NOW)).toBe(true);
    });
});

describe('a window whose storage cannot be used', () => {
    test('a storage that throws reads as nothing hidden and writes nothing, quietly', () => {
        const throwing = () => {
            throw new Error('SecurityError: storage is disabled');
        };
        vi.stubGlobal('localStorage', {
            getItem: throwing,
            setItem: throwing,
            removeItem: throwing,
        });
        expect(checkIsAiCautionHidden(NOW)).toBe(false);
        expect(readAiProviderWarnHiddenTime(NOW)).toBeNull();
        expect(hideAiCautionForAWhile(NOW)).toBe(NOW + 30 * DAY);
        expect(() => {
            showAiCautionAgain();
            showAiProviderWarnAgain();
        }).not.toThrow();
        expect(readAiCautionHiddenTime(NOW)).toBeNull();
    });

    test('a window with no storage at all asks every time', () => {
        vi.stubGlobal('localStorage', undefined);
        hideAiProviderWarnForAWhile(NOW);
        expect(checkIsAiProviderWarnHidden(NOW)).toBe(false);
        expect(() => {
            showAiProviderWarnAgain();
        }).not.toThrow();
    });
});
