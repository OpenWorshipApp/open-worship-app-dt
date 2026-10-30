import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
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
vi.mock('./aiHelpers', () => ({ getIsAIEnabled: () => h.isEnabled }));
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: h.toast }));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));

import { FREE_SERVICE_MAP, getFreeInstance } from './freeHelpers';

beforeEach(() => {
    h.isEnabled = true;
});

describe('getFreeInstance', () => {
    test('"free" is not permission: the master switch still turns it off', () => {
        h.isEnabled = false;
        expect(getFreeInstance()).toBeNull();
        expect(h.toast).toHaveBeenCalledWith(
            'Fail to get free assistant',
            'AI features are turned off in Settings.',
        );
    });

    test('asks the keyless service with a placeholder, never a real key, once', () => {
        const client: unknown = getFreeInstance();
        expect(client).not.toBeNull();
        expect(getFreeInstance()).toBe(client);
        const created = h.clients.filter((one) => one === client);
        expect(created).toHaveLength(1);
        expect(created[0].options).toEqual({
            apiKey: 'anonymous',
            baseURL: 'https://api.kilo.ai/api/gateway',
            dangerouslyAllowBrowser: true,
        });
        expect(h.toast).not.toHaveBeenCalled();
    });

    test('names who answers, for the warning and Settings alike', () => {
        expect(FREE_SERVICE_MAP.kilo).toEqual({
            label: 'Kilo Code',
            baseUrl: 'https://api.kilo.ai/api/gateway',
            homeUrl: 'https://kilo.ai',
        });
    });
});
