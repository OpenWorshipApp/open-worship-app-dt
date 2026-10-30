import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    setting: { bedrockAPIKey: '', bedrockRegion: 'us-west-2' },
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
}));
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: h.toast }));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));

import { genBedrockBaseUrl, getBedrockInstance } from './bedrockHelpers';

beforeEach(() => {
    h.setting = { bedrockAPIKey: '', bedrockRegion: 'us-west-2' };
    h.isEnabled = true;
    h.clients.length = 0;
});

describe('getBedrockInstance', () => {
    test('the OpenAI-shaped route lives under /openai/v1 of the region', () => {
        expect(genBedrockBaseUrl('eu-central-1')).toBe(
            'https://bedrock-mantle.eu-central-1.api.aws/openai/v1',
        );
    });

    test('the master switch wins over a stored key', () => {
        h.setting.bedrockAPIKey = 'ABSK-off';
        h.isEnabled = false;
        expect(getBedrockInstance()).toBeNull();
        expect(h.toast).toHaveBeenCalledWith(
            'Fail to get Amazon Bedrock instance',
            'AI features are turned off in Settings.',
        );
        expect(h.clients).toHaveLength(0);
    });

    test('no key is said as a missing key', () => {
        expect(getBedrockInstance()).toBeNull();
        expect(h.toast).toHaveBeenCalledWith(
            'Fail to get Amazon Bedrock instance',
            'Missing Amazon Bedrock API Key.',
        );
    });

    test('one client per key and region, a new one when the region moves', () => {
        h.setting.bedrockAPIKey = 'ABSK-1';
        const client = getBedrockInstance();
        expect(h.clients[0].options).toEqual({
            apiKey: 'ABSK-1',
            baseURL: 'https://bedrock-mantle.us-west-2.api.aws/openai/v1',
            dangerouslyAllowBrowser: true,
        });
        expect(getBedrockInstance()).toBe(client);

        h.setting.bedrockRegion = 'us-east-1';
        const movedClient = getBedrockInstance();
        expect(movedClient).not.toBe(client);
        expect(h.clients).toHaveLength(2);
        expect(h.clients[1].options.baseURL).toBe(
            'https://bedrock-mantle.us-east-1.api.aws/openai/v1',
        );
    });
});
