import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    isAIEnabled: true,
    setting: { openAIAPIKey: '' } as any,
}));

vi.mock('./aiHelpers', () => ({
    getAISetting: () => h.setting,
    getIsAIEnabled: () => h.isAIEnabled,
    useAISetting: () => h.setting,
}));

import {
    checkIsAvailable,
    DATA_DIR_NAME,
    useAvailable,
} from './openAIAvailabilityHelpers';

beforeEach(() => {
    h.isAIEnabled = true;
    h.setting = { openAIAPIKey: '' };
});

describe('openAI availability', () => {
    test('needs AI on and a key that is more than spaces', () => {
        expect(checkIsAvailable({ openAIAPIKey: 'sk-1' } as any)).toBe(true);
        expect(checkIsAvailable({ openAIAPIKey: ' \t ' } as any)).toBe(false);
        h.isAIEnabled = false;
        expect(checkIsAvailable({ openAIAPIKey: 'sk-1' } as any)).toBe(false);
    });

    test('reads the stored setting when given none, and so does the hook', () => {
        h.setting = { openAIAPIKey: 'sk-1' };
        expect(checkIsAvailable()).toBe(true);
        expect(useAvailable()).toBe(true);
        h.setting = { openAIAPIKey: '' };
        expect(checkIsAvailable()).toBe(false);
        expect(useAvailable()).toBe(false);
    });

    test('names its own data folder', () => {
        expect(DATA_DIR_NAME).toBe('ai-openai-data');
    });
});
