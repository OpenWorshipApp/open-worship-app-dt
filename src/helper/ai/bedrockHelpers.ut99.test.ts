import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    constructed: [] as any[],
    isAIEnabled: true,
    setting: { bedrockAPIKey: '', bedrockRegion: 'us-west-2' } as any,
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
}));

import { genBedrockBaseUrl, getBedrockInstance } from './bedrockHelpers';

beforeEach(() => {
    h.constructed.length = 0;
    h.isAIEnabled = true;
    h.setting = { bedrockAPIKey: '', bedrockRegion: 'us-west-2' };
});

describe('genBedrockBaseUrl', () => {
    test('is the OpenAI route of the mantle host of the region', () => {
        expect(genBedrockBaseUrl('eu-central-1')).toBe(
            'https://bedrock-mantle.eu-central-1.api.aws/openai/v1',
        );
    });
});

describe('getBedrockInstance', () => {
    test('says AI is off rather than blaming a key that is there', () => {
        h.isAIEnabled = false;
        h.setting.bedrockAPIKey = 'ABSK-1';
        expect(getBedrockInstance()).toBeNull();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Fail to get Amazon Bedrock instance',
            'AI features are turned off in Settings.',
        );
        expect(h.constructed).toEqual([]);
    });

    test('says the key is missing when it is', () => {
        expect(getBedrockInstance()).toBeNull();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Fail to get Amazon Bedrock instance',
            'Missing Amazon Bedrock API Key.',
        );
        expect(h.constructed).toEqual([]);
    });

    test('sends the key as a bearer to the region, and a new region gets a new client', () => {
        h.setting = { bedrockAPIKey: 'ABSK-1', bedrockRegion: 'us-west-2' };
        const first = getBedrockInstance();
        expect(h.constructed).toEqual([
            {
                apiKey: 'ABSK-1',
                baseURL: 'https://bedrock-mantle.us-west-2.api.aws/openai/v1',
                dangerouslyAllowBrowser: true,
            },
        ]);
        expect(getBedrockInstance()).toBe(first);
        expect(h.constructed).toHaveLength(1);

        // The same key asked in another region is another host.
        h.setting = { bedrockAPIKey: 'ABSK-1', bedrockRegion: 'us-east-1' };
        const second = getBedrockInstance();
        expect(second).not.toBe(first);
        expect((second as any).options.baseURL).toBe(
            'https://bedrock-mantle.us-east-1.api.aws/openai/v1',
        );

        h.setting = { bedrockAPIKey: 'ABSK-2', bedrockRegion: 'us-east-1' };
        const third = getBedrockInstance();
        expect(third).not.toBe(second);
        expect((third as any).options.apiKey).toBe('ABSK-2');
        expect(h.constructed).toHaveLength(3);
        expect(h.showSimpleToast).not.toHaveBeenCalled();
    });
});
