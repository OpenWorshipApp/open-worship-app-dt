import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    setting: { anthropicAPIKey: '' },
    hookSetting: { anthropicAPIKey: '' },
    isEnabled: true,
}));

vi.mock('./aiHelpers', () => ({
    getAISetting: () => ({ ...h.setting }),
    getIsAIEnabled: () => h.isEnabled,
    useAISetting: () => h.hookSetting,
}));

import {
    DATA_DIR_NAME,
    checkIsAvailable,
    useAvailable,
} from './anthropicAvailabilityHelpers';

beforeEach(() => {
    h.setting = { anthropicAPIKey: '' };
    h.hookSetting = { anthropicAPIKey: '' };
    h.isEnabled = true;
});

describe('Anthropic availability, without the SDK', () => {
    test('needs a non-blank key', () => {
        expect(checkIsAvailable({ anthropicAPIKey: 'sk-ant' } as any)).toBe(
            true,
        );
        expect(checkIsAvailable({ anthropicAPIKey: '  ' } as any)).toBe(false);
    });

    test('is off with the master switch, key or not', () => {
        h.isEnabled = false;
        expect(checkIsAvailable({ anthropicAPIKey: 'sk-ant' } as any)).toBe(
            false,
        );
    });

    test('reads the stored setting when none is given', () => {
        expect(checkIsAvailable()).toBe(false);
        h.setting.anthropicAPIKey = 'sk-ant';
        expect(checkIsAvailable()).toBe(true);
    });

    test('the hook answers from the live setting', () => {
        expect(useAvailable()).toBe(false);
        h.hookSetting = { anthropicAPIKey: 'sk-ant' };
        expect(useAvailable()).toBe(true);
    });

    test('names its own data folder', () => {
        expect(DATA_DIR_NAME).toBe('ai-anthropic-data');
    });
});
