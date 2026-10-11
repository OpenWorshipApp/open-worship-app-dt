import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    getLlmRegistryServers,
    getLlmRegistryStatus,
    getLlmRegistryUrl,
    refreshLlmRegistry,
    resetLlmRegistryForTests,
} from './llmRegistryHelpers';
import { LLM_REGISTRY_URL } from './customLlmProtocol';

const REGISTRY_TEXT = JSON.stringify({
    version: 1,
    updated: '2026-10-10',
    servers: [
        {
            id: 'super-computer',
            name: 'Church LM Studio',
            baseUrl: 'https://abc.trycloudflare.com/v1',
            apiKey: 'sk-shared',
            isFree: true,
            note: 'LM Studio on the church computer',
            models: [
                {
                    model: 'qwen/qwen3.5-9b',
                    name: 'Qwen 3.5 9B',
                    canSeeImages: true,
                },
            ],
        },
    ],
});

function genFetch(body: string, status = 200) {
    return vi.fn(async () => {
        return new Response(body, {
            status,
            headers: { 'content-type': 'application/json' },
        });
    });
}

describe('the shared LLM registry in main', () => {
    beforeEach(() => {
        resetLlmRegistryForTests();
        delete process.env.OWA_LLM_REGISTRY_URL;
    });

    it('reads the official file unless a developer names another', () => {
        expect(getLlmRegistryUrl()).toBe(LLM_REGISTRY_URL);
        process.env.OWA_LLM_REGISTRY_URL = 'http://localhost:18700/info.json';
        expect(getLlmRegistryUrl()).toBe('http://localhost:18700/info.json');
        process.env.OWA_LLM_REGISTRY_URL = '   ';
        expect(getLlmRegistryUrl()).toBe(LLM_REGISTRY_URL);
    });

    it('holds the servers with their keys for the relay, and hands a window the servers without', async () => {
        const fetch = genFetch(REGISTRY_TEXT);
        const status = await refreshLlmRegistry({ fetch, now: () => 123 });
        expect(fetch).toHaveBeenCalledTimes(1);
        expect((fetch.mock.calls[0] as any[])[0]).toBe(LLM_REGISTRY_URL);
        expect(status).toEqual({
            url: LLM_REGISTRY_URL,
            fetchedAt: 123,
            error: null,
            servers: [
                {
                    id: 'registry-super-computer',
                    name: 'Church LM Studio',
                    baseUrl: 'https://abc.trycloudflare.com/v1',
                    isFree: true,
                    source: 'registry',
                    models: [
                        {
                            id: expect.any(String),
                            model: 'qwen/qwen3.5-9b',
                            name: 'Qwen 3.5 9B',
                            canSeeImages: true,
                        },
                    ],
                },
            ],
        });
        expect(JSON.stringify(status)).not.toContain('sk-shared');
        expect(getLlmRegistryServers()[0]).toMatchObject({
            id: 'registry-super-computer',
            apiKey: 'sk-shared',
            note: 'LM Studio on the church computer',
        });
    });

    it('keeps the last good list through a failed read, and says why', async () => {
        await refreshLlmRegistry({
            fetch: genFetch(REGISTRY_TEXT),
            now: () => 1,
        });
        const failed = await refreshLlmRegistry({
            fetch: genFetch('not found', 404),
            now: () => 2,
        });
        expect(failed.servers).toHaveLength(1);
        expect(failed.fetchedAt).toBe(1);
        expect(failed.error).toContain('404');
        const broken = await refreshLlmRegistry({
            fetch: genFetch('{"version": 2, "servers": []}'),
        });
        expect(broken.servers).toHaveLength(1);
        expect(broken.error).toContain('not in the known shape');
        const down = await refreshLlmRegistry({
            fetch: vi.fn(async () => {
                throw new TypeError('fetch failed');
            }),
        });
        expect(down.servers).toHaveLength(1);
        expect(down.error).toBe('fetch failed');
    });

    it('is nothing until read, and refuses an address that is not a web one', async () => {
        expect(getLlmRegistryStatus()).toEqual({
            url: LLM_REGISTRY_URL,
            servers: [],
            fetchedAt: null,
            error: null,
        });
        process.env.OWA_LLM_REGISTRY_URL = 'file:///C:/info.json';
        const fetch = genFetch(REGISTRY_TEXT);
        const status = await refreshLlmRegistry({ fetch });
        expect(fetch).not.toHaveBeenCalled();
        expect(status.error).toContain('not a web address');
    });

    it('shares one read between two presses of Reload', async () => {
        let resolveBody: (value: Response) => void = () => {};
        const fetch = vi.fn(() => {
            return new Promise<Response>((resolve) => {
                resolveBody = resolve;
            });
        });
        const first = refreshLlmRegistry({ fetch });
        const second = refreshLlmRegistry({ fetch });
        expect(second).toBe(first);
        resolveBody(new Response(REGISTRY_TEXT, { status: 200 }));
        await first;
        expect(fetch).toHaveBeenCalledTimes(1);
    });
});
