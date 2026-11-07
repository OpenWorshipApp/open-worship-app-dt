import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    constructed: [] as any[],
    isAIEnabled: true,
    setting: { openAIAPIKey: '' } as any,
    showSimpleToast: vi.fn(),
}));

vi.mock('openai', () => ({
    default: class {
        options: any;
        constructor(options: any) {
            this.options = options;
            h.constructed.push(options);
        }
    },
}));
vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToast,
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('./aiHelpers', () => ({
    getAISetting: () => h.setting,
    getIsAIEnabled: () => h.isAIEnabled,
    useAISetting: () => h.setting,
}));

import * as availability from './openAIAvailabilityHelpers';
import {
    checkIsAvailable,
    DATA_DIR_NAME,
    getOpenAIInstance,
    useAvailable,
} from './openAIHelpers';

beforeEach(() => {
    h.constructed.length = 0;
    h.isAIEnabled = true;
    h.setting = { openAIAPIKey: '' };
});

describe('getOpenAIInstance', () => {
    test('says AI is off rather than blaming a key that is there', () => {
        h.isAIEnabled = false;
        h.setting = { openAIAPIKey: 'sk-1' };
        expect(getOpenAIInstance()).toBeNull();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Fail to get OpenAI instance',
            'AI features are turned off in Settings.',
        );
        expect(h.constructed).toEqual([]);
    });

    test('says the key is missing when it is', () => {
        expect(getOpenAIInstance()).toBeNull();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Fail to get OpenAI instance',
            'Missing OpenAI API Key.',
        );
        expect(h.constructed).toEqual([]);
    });

    test('builds one client per key and keeps it while the key stays', () => {
        h.setting = { openAIAPIKey: 'sk-1' };
        const first = getOpenAIInstance();
        expect(h.constructed).toEqual([
            { apiKey: 'sk-1', dangerouslyAllowBrowser: true },
        ]);
        expect(getOpenAIInstance()).toBe(first);
        expect(h.constructed).toHaveLength(1);

        h.setting = { openAIAPIKey: 'sk-2' };
        const second = getOpenAIInstance();
        expect(second).not.toBe(first);
        expect((second as any).options.apiKey).toBe('sk-2');
        expect(h.constructed).toHaveLength(2);
        expect(h.showSimpleToast).not.toHaveBeenCalled();
    });
});

describe('the availability re-exports', () => {
    test('are the light module own, for the callers that kept this import', () => {
        expect(checkIsAvailable).toBe(availability.checkIsAvailable);
        expect(useAvailable).toBe(availability.useAvailable);
        expect(DATA_DIR_NAME).toBe('ai-openai-data');
    });
});
