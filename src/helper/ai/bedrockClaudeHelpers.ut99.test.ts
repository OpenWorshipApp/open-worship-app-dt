import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    constructed: [] as any[],
    isAIEnabled: true,
    setting: { bedrockAPIKey: '', bedrockRegion: 'us-west-2' } as any,
    showSimpleToast: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
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
}));

import {
    genBedrockClaudeBaseUrl,
    getBedrockClaudeInstance,
} from './bedrockClaudeHelpers';

beforeEach(() => {
    h.constructed.length = 0;
    h.isAIEnabled = true;
    h.setting = { bedrockAPIKey: '', bedrockRegion: 'us-west-2' };
});

describe('genBedrockClaudeBaseUrl', () => {
    test('is the Anthropic route of the runtime host of the region', () => {
        expect(genBedrockClaudeBaseUrl('us-east-2')).toBe(
            'https://bedrock-runtime.us-east-2.amazonaws.com/anthropic',
        );
    });
});

describe('getBedrockClaudeInstance', () => {
    test('says AI is off rather than blaming a key that is there', () => {
        h.isAIEnabled = false;
        h.setting.bedrockAPIKey = 'ABSK-1';
        expect(getBedrockClaudeInstance()).toBeNull();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Fail to get Amazon Bedrock instance',
            'AI features are turned off in Settings.',
        );
        expect(h.constructed).toEqual([]);
    });

    test('says the key is missing in the words the other Bedrock client uses', () => {
        expect(getBedrockClaudeInstance()).toBeNull();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Fail to get Amazon Bedrock instance',
            'Missing Amazon Bedrock API Key.',
        );
        expect(h.constructed).toEqual([]);
    });

    test('hands the Bedrock key to the Anthropic SDK at the region host, memoised on both', () => {
        h.setting = { bedrockAPIKey: 'ABSK-1', bedrockRegion: 'us-west-2' };
        const first = getBedrockClaudeInstance();
        expect(h.constructed).toEqual([
            {
                apiKey: 'ABSK-1',
                baseURL:
                    'https://bedrock-runtime.us-west-2.amazonaws.com/anthropic',
                dangerouslyAllowBrowser: true,
            },
        ]);
        expect(getBedrockClaudeInstance()).toBe(first);
        expect(h.constructed).toHaveLength(1);

        h.setting = { bedrockAPIKey: 'ABSK-1', bedrockRegion: 'eu-central-1' };
        const second = getBedrockClaudeInstance();
        expect(second).not.toBe(first);
        expect((second as any).options.baseURL).toBe(
            'https://bedrock-runtime.eu-central-1.amazonaws.com/anthropic',
        );

        h.setting = { bedrockAPIKey: 'ABSK-2', bedrockRegion: 'eu-central-1' };
        expect(getBedrockClaudeInstance()).not.toBe(second);
        expect(h.constructed).toHaveLength(3);
        expect(h.showSimpleToast).not.toHaveBeenCalled();
    });
});
