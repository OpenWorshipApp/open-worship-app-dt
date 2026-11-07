import { beforeEach, describe, expect, test, vi } from 'vitest';

// The SDK is a class that writes down what it was built with: no request is
// ever made, and what is under test is which client is handed out.
const h = vi.hoisted(() => ({
    constructed: [] as any[],
    isAIEnabled: true,
    setting: { kimiAPIKey: '' } as any,
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

import { checkIsAvailable, getKimiInstance, useAvailable } from './kimiHelpers';

beforeEach(() => {
    h.constructed.length = 0;
    h.isAIEnabled = true;
    h.setting = { kimiAPIKey: '' };
});

describe('getKimiInstance', () => {
    test('says AI is off rather than blaming a key that is there', () => {
        h.isAIEnabled = false;
        h.setting = { kimiAPIKey: 'sk-kimi-1' };
        expect(getKimiInstance()).toBeNull();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Fail to get Kimi instance',
            'AI features are turned off in Settings.',
        );
        expect(h.constructed).toEqual([]);
    });

    test('says the key is missing when it is', () => {
        expect(getKimiInstance()).toBeNull();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Fail to get Kimi instance',
            'Missing Kimi API Key.',
        );
        expect(h.constructed).toEqual([]);
    });

    test('points the OpenAI SDK at Moonshot, and keeps it while the key stays', () => {
        h.setting = { kimiAPIKey: 'sk-kimi-1' };
        const first = getKimiInstance();
        expect(h.constructed).toEqual([
            {
                apiKey: 'sk-kimi-1',
                baseURL: 'https://api.moonshot.ai/v1',
                dangerouslyAllowBrowser: true,
            },
        ]);
        expect(getKimiInstance()).toBe(first);
        expect(h.constructed).toHaveLength(1);

        h.setting = { kimiAPIKey: 'sk-kimi-2' };
        const second = getKimiInstance();
        expect(second).not.toBe(first);
        expect((second as any).options.apiKey).toBe('sk-kimi-2');
        expect(h.constructed).toHaveLength(2);
        expect(h.showSimpleToast).not.toHaveBeenCalled();
    });
});

describe('checkIsAvailable', () => {
    test('needs AI on and a key that is more than spaces', () => {
        expect(checkIsAvailable({ kimiAPIKey: 'sk-kimi' } as any)).toBe(true);
        expect(checkIsAvailable({ kimiAPIKey: '   ' } as any)).toBe(false);
        h.isAIEnabled = false;
        expect(checkIsAvailable({ kimiAPIKey: 'sk-kimi' } as any)).toBe(false);
    });

    test('reads the stored setting when given none, and so does the hook', () => {
        h.setting = { kimiAPIKey: 'sk-kimi' };
        expect(checkIsAvailable()).toBe(true);
        expect(useAvailable()).toBe(true);
        h.setting = { kimiAPIKey: '' };
        expect(checkIsAvailable()).toBe(false);
        expect(useAvailable()).toBe(false);
    });
});
