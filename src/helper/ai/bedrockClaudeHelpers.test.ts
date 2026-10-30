import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    setting: { bedrockAPIKey: '', bedrockRegion: 'us-west-2' },
    isEnabled: true,
    toast: vi.fn(),
    clients: [] as { options: Record<string, unknown> }[],
}));

vi.mock('@anthropic-ai/sdk', () => ({
    default: class AnthropicStub {
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

import {
    genBedrockClaudeBaseUrl,
    getBedrockClaudeInstance,
} from './bedrockClaudeHelpers';

beforeEach(() => {
    h.setting = { bedrockAPIKey: '', bedrockRegion: 'us-west-2' };
    h.isEnabled = true;
    h.clients.length = 0;
});

describe('getBedrockClaudeInstance', () => {
    test('Claude is asked on the runtime host’s /anthropic route', () => {
        expect(genBedrockClaudeBaseUrl('us-east-2')).toBe(
            'https://bedrock-runtime.us-east-2.amazonaws.com/anthropic',
        );
    });

    test('the master switch wins over a stored key', () => {
        h.setting.bedrockAPIKey = 'ABSK-off';
        h.isEnabled = false;
        expect(getBedrockClaudeInstance()).toBeNull();
        expect(h.toast).toHaveBeenCalledWith(
            'Fail to get Amazon Bedrock instance',
            'AI features are turned off in Settings.',
        );
        expect(h.clients).toHaveLength(0);
    });

    test('no key is said as a missing key', () => {
        expect(getBedrockClaudeInstance()).toBeNull();
        expect(h.toast).toHaveBeenCalledWith(
            'Fail to get Amazon Bedrock instance',
            'Missing Amazon Bedrock API Key.',
        );
    });

    test('one client per key and region, a new one when either moves', () => {
        h.setting.bedrockAPIKey = 'ABSK-claude-1';
        const client = getBedrockClaudeInstance();
        expect(h.clients[0].options).toEqual({
            apiKey: 'ABSK-claude-1',
            baseURL:
                'https://bedrock-runtime.us-west-2.amazonaws.com/anthropic',
            dangerouslyAllowBrowser: true,
        });
        expect(getBedrockClaudeInstance()).toBe(client);

        h.setting.bedrockRegion = 'eu-central-1';
        expect(getBedrockClaudeInstance()).not.toBe(client);
        h.setting.bedrockAPIKey = 'ABSK-claude-2';
        getBedrockClaudeInstance();
        expect(h.clients.map((one) => one.options.apiKey)).toEqual([
            'ABSK-claude-1',
            'ABSK-claude-1',
            'ABSK-claude-2',
        ]);
    });
});
