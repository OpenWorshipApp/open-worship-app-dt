import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    getLlmRegistryServers,
    refreshLlmRegistry,
    resetLlmRegistryForTests,
} from './llmRegistryHelpers';

// The registry read when the site is slow, or sends what is no registry:
// the error says which, and the servers of the last good read stay. No
// network: `fetch` is the test's own.

const REGISTRY = {
    version: 1,
    servers: [
        {
            id: 'hall',
            name: 'Hall',
            baseUrl: 'https://hall.example/v1',
            models: [{ model: 'qwen3:8b', name: 'Qwen' }],
        },
    ],
};

function answer(text: string) {
    return new Response(text, { status: 200 });
}

beforeEach(() => {
    resetLlmRegistryForTests();
    vi.stubEnv('OWA_LLM_REGISTRY_URL', '');
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    resetLlmRegistryForTests();
});

describe('a registry read that goes wrong', () => {
    test('a site that does not answer in eight seconds is let go, and said so', async () => {
        vi.useFakeTimers();
        let signal: AbortSignal | undefined;
        const fetch = vi.fn((_url: string, init: RequestInit) => {
            signal = init.signal ?? undefined;
            return new Promise<Response>((_resolve, reject) => {
                signal!.addEventListener('abort', () => {
                    reject(
                        Object.assign(new Error('aborted'), {
                            name: 'AbortError',
                        }),
                    );
                });
            });
        });

        const read = refreshLlmRegistry({ fetch });
        await vi.advanceTimersByTimeAsync(7999);
        expect(signal?.aborted).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        const status = await read;

        expect(signal?.aborted).toBe(true);
        expect(status.error).toBe('openworship.app did not answer in time');
        expect(status.fetchedAt).toBeNull();
    });

    test('a file too large to be a registry is not read, and the last good servers stay', async () => {
        const good = await refreshLlmRegistry({
            fetch: async () => answer(JSON.stringify(REGISTRY)),
            now: () => 1234,
        });
        expect(good.error).toBeNull();
        expect(getLlmRegistryServers().map((server) => server.id)).toEqual([
            'registry-hall',
        ]);

        const tooLarge = await refreshLlmRegistry({
            fetch: async () => answer(' '.repeat(256 * 1024 + 1)),
            now: () => 5678,
        });

        expect(tooLarge.error).toBe('the registry file is too large to be one');
        expect(tooLarge.fetchedAt).toBe(1234);
        expect(getLlmRegistryServers().map((server) => server.id)).toEqual([
            'registry-hall',
        ]);
    });

    test('a failure that is no error is told as it is, when it is short', async () => {
        const status = await refreshLlmRegistry({
            fetch: () => Promise.reject('offline'),
        });

        expect(status.error).toBe('offline');
    });

    test('a failure with no words, or too many, is told plainly', async () => {
        const silent = await refreshLlmRegistry({
            fetch: () => Promise.reject(new Error('')),
        });
        expect(silent.error).toBe('openworship.app could not be reached');

        const rambling = await refreshLlmRegistry({
            fetch: () => Promise.reject(new Error('x'.repeat(160))),
        });
        expect(rambling.error).toBe('openworship.app could not be reached');

        const short = await refreshLlmRegistry({
            fetch: () => Promise.reject(new Error('x'.repeat(159))),
        });
        expect(short.error).toBe('x'.repeat(159));
    });
});
