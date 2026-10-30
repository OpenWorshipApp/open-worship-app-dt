import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    setting: { anthropicAPIKey: '', anthropicWorkspaceId: '' },
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
    useAISetting: () => h.setting,
}));
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: h.toast }));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));

import { DATA_DIR_NAME, getAnthropicInstance } from './anthropicHelpers';

beforeEach(() => {
    h.setting = { anthropicAPIKey: '', anthropicWorkspaceId: '' };
    h.isEnabled = true;
    h.clients.length = 0;
});

describe('getAnthropicInstance', () => {
    test('the master switch wins over a stored key', () => {
        h.setting.anthropicAPIKey = 'sk-ant-off';
        h.isEnabled = false;
        expect(getAnthropicInstance()).toBeNull();
        expect(h.toast).toHaveBeenCalledWith(
            'Fail to get Anthropic instance',
            'AI features are turned off in Settings.',
        );
        expect(h.clients).toHaveLength(0);
    });

    test('no key is said as a missing key', () => {
        expect(getAnthropicInstance()).toBeNull();
        expect(h.toast).toHaveBeenCalledWith(
            'Fail to get Anthropic instance',
            'Missing Anthropic API Key.',
        );
    });

    test('an ordinary key sends no workspace header, and is reused', () => {
        h.setting.anthropicAPIKey = 'sk-ant-plain';
        const client = getAnthropicInstance();
        expect(h.clients[0].options).toEqual({
            apiKey: 'sk-ant-plain',
            dangerouslyAllowBrowser: true,
        });
        expect(getAnthropicInstance()).toBe(client);
        expect(h.clients).toHaveLength(1);
    });

    test('a workspace id rides as its header, and changing it alone makes a new client', () => {
        h.setting.anthropicAPIKey = 'sk-ant-linked';
        h.setting.anthropicWorkspaceId = 'wrkspc_1';
        const client = getAnthropicInstance();
        expect(h.clients[0].options).toEqual({
            apiKey: 'sk-ant-linked',
            dangerouslyAllowBrowser: true,
            defaultHeaders: { 'anthropic-workspace-id': 'wrkspc_1' },
        });

        h.setting.anthropicWorkspaceId = 'wrkspc_2';
        expect(getAnthropicInstance()).not.toBe(client);
        expect(h.clients[1].options.defaultHeaders).toEqual({
            'anthropic-workspace-id': 'wrkspc_2',
        });
    });

    test('re-exports the data folder name from the light module', () => {
        expect(DATA_DIR_NAME).toBe('ai-anthropic-data');
    });
});
