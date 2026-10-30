import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    setting: { openAIAPIKey: '' },
    isEnabled: true,
    toast: vi.fn(),
    clients: [] as { options: Record<string, unknown> }[],
}));

vi.mock('openai', () => ({
    default: class OpenAIStub {
        constructor(readonly options: Record<string, unknown>) {
            h.clients.push(this);
        }
    },
}));
vi.mock('./aiHelpers', () => ({
    getAISetting: () => ({ ...h.setting }),
    getIsAIEnabled: () => h.isEnabled,
    useAISetting: () => h.setting,
}));
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: h.toast }));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));

import { DATA_DIR_NAME, getOpenAIInstance } from './openAIHelpers';

beforeEach(() => {
    h.setting = { openAIAPIKey: '' };
    h.isEnabled = true;
    h.clients.length = 0;
});

describe('getOpenAIInstance', () => {
    test('the master switch wins over a stored key', () => {
        h.setting.openAIAPIKey = 'sk-off';
        h.isEnabled = false;
        expect(getOpenAIInstance()).toBeNull();
        expect(h.toast).toHaveBeenCalledWith(
            'Fail to get OpenAI instance',
            'AI features are turned off in Settings.',
        );
        expect(h.clients).toHaveLength(0);
    });

    test('no key is said as a missing key', () => {
        expect(getOpenAIInstance()).toBeNull();
        expect(h.toast).toHaveBeenCalledWith(
            'Fail to get OpenAI instance',
            'Missing OpenAI API Key.',
        );
    });

    test('one client per key', () => {
        h.setting.openAIAPIKey = 'sk-1';
        const client = getOpenAIInstance();
        expect(h.clients[0].options).toEqual({
            apiKey: 'sk-1',
            dangerouslyAllowBrowser: true,
        });
        expect(getOpenAIInstance()).toBe(client);

        h.setting.openAIAPIKey = 'sk-2';
        expect(getOpenAIInstance()).not.toBe(client);
        expect(h.clients.map((one) => one.options.apiKey)).toEqual([
            'sk-1',
            'sk-2',
        ]);
    });

    test('re-exports the data folder name from the light module', () => {
        expect(DATA_DIR_NAME).toBe('ai-openai-data');
    });
});
