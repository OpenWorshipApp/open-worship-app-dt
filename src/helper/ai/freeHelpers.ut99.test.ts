import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    constructed: [] as any[],
    isAIEnabled: true,
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
vi.mock('./aiHelpers', () => ({ getIsAIEnabled: () => h.isAIEnabled }));

import { FREE_SERVICE_MAP, getFreeInstance } from './freeHelpers';

beforeEach(() => {
    h.constructed.length = 0;
    h.isAIEnabled = true;
});

describe('getFreeInstance', () => {
    test('holds to the master switch: free is about money, not permission', () => {
        h.isAIEnabled = false;
        expect(getFreeInstance()).toBeNull();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Fail to get free assistant',
            'AI features are turned off in Settings.',
        );
        expect(h.constructed).toEqual([]);
    });

    test('asks the Kilo gateway with a placeholder, never a key, once', () => {
        const first = getFreeInstance();
        expect(h.constructed).toEqual([
            {
                apiKey: 'anonymous',
                baseURL: 'https://api.kilo.ai/api/gateway',
                dangerouslyAllowBrowser: true,
            },
        ]);
        expect(getFreeInstance()).toBe(first);
        expect(h.constructed).toHaveLength(1);
        expect(h.showSimpleToast).not.toHaveBeenCalled();
    });

    test('a client already made is still refused with AI switched off', () => {
        getFreeInstance();
        h.isAIEnabled = false;
        expect(getFreeInstance()).toBeNull();
    });
});

describe('FREE_SERVICE_MAP', () => {
    test('names the service the warning discloses, with its terms page', () => {
        expect(FREE_SERVICE_MAP.kilo).toEqual({
            label: 'Kilo Code',
            baseUrl: 'https://api.kilo.ai/api/gateway',
            homeUrl: 'https://kilo.ai',
        });
    });
});
