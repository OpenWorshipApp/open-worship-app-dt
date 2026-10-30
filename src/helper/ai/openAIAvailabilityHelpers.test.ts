import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    setting: { openAIAPIKey: '' },
    hookSetting: { openAIAPIKey: '' },
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
} from './openAIAvailabilityHelpers';

beforeEach(() => {
    h.setting = { openAIAPIKey: '' };
    h.hookSetting = { openAIAPIKey: '' };
    h.isEnabled = true;
});

describe('OpenAI availability, without the SDK', () => {
    test('needs a non-blank key', () => {
        expect(checkIsAvailable({ openAIAPIKey: 'sk' } as any)).toBe(true);
        expect(checkIsAvailable({ openAIAPIKey: ' \t ' } as any)).toBe(false);
    });

    test('is off with the master switch, key or not', () => {
        h.isEnabled = false;
        expect(checkIsAvailable({ openAIAPIKey: 'sk' } as any)).toBe(false);
    });

    test('reads the stored setting when none is given', () => {
        expect(checkIsAvailable()).toBe(false);
        h.setting.openAIAPIKey = 'sk';
        expect(checkIsAvailable()).toBe(true);
    });

    test('the hook answers from the live setting', () => {
        expect(useAvailable()).toBe(false);
        h.hookSetting = { openAIAPIKey: 'sk' };
        expect(useAvailable()).toBe(true);
    });

    test('names its own data folder', () => {
        expect(DATA_DIR_NAME).toBe('ai-openai-data');
    });
});
