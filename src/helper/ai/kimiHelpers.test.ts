import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    setting: { kimiAPIKey: '' },
    hookSetting: { kimiAPIKey: '' },
    isEnabled: true,
    toast: vi.fn(),
    clients: [] as { options: Record<string, unknown> }[],
}));

// The SDK itself is not under test -- what it is handed is.
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
    useAISetting: () => h.hookSetting,
}));
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: h.toast }));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));

import { checkIsAvailable, getKimiInstance, useAvailable } from './kimiHelpers';

beforeEach(() => {
    h.setting = { kimiAPIKey: '' };
    h.hookSetting = { kimiAPIKey: '' };
    h.isEnabled = true;
    h.clients.length = 0;
});

describe('getKimiInstance', () => {
    test('the master switch wins over a stored key, and says so', () => {
        h.setting.kimiAPIKey = 'sk-kimi-off';
        h.isEnabled = false;
        expect(getKimiInstance()).toBeNull();
        expect(h.toast).toHaveBeenCalledWith(
            'Fail to get Kimi instance',
            'AI features are turned off in Settings.',
        );
        expect(h.clients).toHaveLength(0);
    });

    test('no key is said as a missing key', () => {
        expect(getKimiInstance()).toBeNull();
        expect(h.toast).toHaveBeenCalledWith(
            'Fail to get Kimi instance',
            'Missing Kimi API Key.',
        );
    });

    test('points the OpenAI client at Moonshot, once per key', () => {
        h.setting.kimiAPIKey = 'sk-kimi-1';
        const client = getKimiInstance();
        expect(h.clients).toEqual([client]);
        expect(h.clients[0].options).toEqual({
            apiKey: 'sk-kimi-1',
            baseURL: 'https://api.moonshot.ai/v1',
            dangerouslyAllowBrowser: true,
        });
        expect(getKimiInstance()).toBe(client);
        expect(h.clients).toHaveLength(1);

        h.setting.kimiAPIKey = 'sk-kimi-2';
        const nextClient = getKimiInstance();
        expect(nextClient).not.toBe(client);
        expect(h.clients.at(-1)?.options.apiKey).toBe('sk-kimi-2');
        expect(h.toast).not.toHaveBeenCalled();
    });
});

describe('Kimi availability', () => {
    test('needs a non-blank key and the switch on', () => {
        expect(checkIsAvailable({ kimiAPIKey: ' key ' } as any)).toBe(true);
        expect(checkIsAvailable({ kimiAPIKey: '   ' } as any)).toBe(false);
        h.isEnabled = false;
        expect(checkIsAvailable({ kimiAPIKey: 'key' } as any)).toBe(false);
    });

    test('reads the stored setting when none is given', () => {
        expect(checkIsAvailable()).toBe(false);
        h.setting.kimiAPIKey = 'sk-kimi';
        expect(checkIsAvailable()).toBe(true);
    });

    test('the hook answers from the live setting', () => {
        expect(useAvailable()).toBe(false);
        h.hookSetting = { kimiAPIKey: 'sk-kimi' };
        expect(useAvailable()).toBe(true);
    });
});
