import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    isAIEnabled: true,
    setting: { anthropicAPIKey: '' } as any,
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
} from './anthropicAvailabilityHelpers';

beforeEach(() => {
    h.isAIEnabled = true;
    h.setting = { anthropicAPIKey: '' };
});

describe('anthropic availability', () => {
    test('needs AI on and a key that is more than spaces', () => {
        expect(checkIsAvailable({ anthropicAPIKey: 'sk-ant' } as any)).toBe(
            true,
        );
        expect(checkIsAvailable({ anthropicAPIKey: '  ' } as any)).toBe(false);
        h.isAIEnabled = false;
        expect(checkIsAvailable({ anthropicAPIKey: 'sk-ant' } as any)).toBe(
            false,
        );
    });

    test('reads the stored setting when given none, and so does the hook', () => {
        h.setting = { anthropicAPIKey: ' sk-ant ' };
        expect(checkIsAvailable()).toBe(true);
        expect(useAvailable()).toBe(true);
        h.setting = { anthropicAPIKey: '' };
        expect(checkIsAvailable()).toBe(false);
        expect(useAvailable()).toBe(false);
    });

    test('names its own data folder', () => {
        expect(DATA_DIR_NAME).toBe('ai-anthropic-data');
    });
});
