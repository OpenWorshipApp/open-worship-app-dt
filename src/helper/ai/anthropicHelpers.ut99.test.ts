import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    constructed: [] as any[],
    isAIEnabled: true,
    setting: { anthropicAPIKey: '', anthropicWorkspaceId: '' } as any,
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
    useAISetting: () => h.setting,
}));

import * as availability from './anthropicAvailabilityHelpers';
import {
    checkIsAvailable,
    DATA_DIR_NAME,
    getAnthropicInstance,
    useAvailable,
} from './anthropicHelpers';

beforeEach(() => {
    h.constructed.length = 0;
    h.isAIEnabled = true;
    h.setting = { anthropicAPIKey: '', anthropicWorkspaceId: '' };
});

describe('getAnthropicInstance', () => {
    test('says AI is off rather than blaming a key that is there', () => {
        h.isAIEnabled = false;
        h.setting.anthropicAPIKey = 'sk-ant-1';
        expect(getAnthropicInstance()).toBeNull();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Fail to get Anthropic instance',
            'AI features are turned off in Settings.',
        );
        expect(h.constructed).toEqual([]);
    });

    test('says the key is missing when it is', () => {
        expect(getAnthropicInstance()).toBeNull();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Fail to get Anthropic instance',
            'Missing Anthropic API Key.',
        );
        expect(h.constructed).toEqual([]);
    });

    test('an ordinary key gets no workspace header, an identity-linked one gets its workspace', () => {
        h.setting = { anthropicAPIKey: 'sk-ant-1', anthropicWorkspaceId: '' };
        const first = getAnthropicInstance();
        expect(h.constructed).toEqual([
            { apiKey: 'sk-ant-1', dangerouslyAllowBrowser: true },
        ]);
        expect(h.constructed[0]).not.toHaveProperty('defaultHeaders');
        expect(getAnthropicInstance()).toBe(first);
        expect(h.constructed).toHaveLength(1);

        // Only the workspace changed: the old client must not come back.
        h.setting = {
            anthropicAPIKey: 'sk-ant-1',
            anthropicWorkspaceId: 'wrkspc_01',
        };
        const second = getAnthropicInstance();
        expect(second).not.toBe(first);
        expect(h.constructed[1]).toEqual({
            apiKey: 'sk-ant-1',
            dangerouslyAllowBrowser: true,
            defaultHeaders: { 'anthropic-workspace-id': 'wrkspc_01' },
        });
        expect(getAnthropicInstance()).toBe(second);
        expect(h.constructed).toHaveLength(2);
        expect(h.showSimpleToast).not.toHaveBeenCalled();
    });
});

describe('the availability re-exports', () => {
    test('are the light module own, for the callers that kept this import', () => {
        expect(checkIsAvailable).toBe(availability.checkIsAvailable);
        expect(useAvailable).toBe(availability.useAvailable);
        expect(DATA_DIR_NAME).toBe('ai-anthropic-data');
    });
});
