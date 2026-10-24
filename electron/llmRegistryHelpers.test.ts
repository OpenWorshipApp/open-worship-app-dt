import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    getLlmRegistryServers,
    getLlmRegistryStatus,
    getLlmReportServers,
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
                    // Never the address the file carries: a stand-in.
                    baseUrl: 'https://shared-server.invalid/v1',
                    isFree: true,
                    source: 'registry',
                    // Shown to the person choosing (2026-10-17).
                    note: { '': 'LM Studio on the church computer' },
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
        expect(JSON.stringify(status)).not.toContain('trycloudflare');
        expect(getLlmRegistryServers()[0]).toMatchObject({
            id: 'registry-super-computer',
            baseUrl: 'https://abc.trycloudflare.com/v1',
            apiKey: 'sk-shared',
            note: { '': 'LM Studio on the church computer' },
        });
    });

    // "Should not show in setting shared servers": what a window lists is
    // the status, and an entry that takes reports is never in it.
    it('holds an entry that takes reports for the report door, and tells no window of it', async () => {
        const text = JSON.stringify({
            version: 1,
            servers: [
                {
                    id: 'reporting',
                    name: 'Report inbox',
                    baseUrl: 'https://reports.trycloudflare.com/v1',
                    apiKey: 'sk-report',
                    isAcceptingReport: true,
                    note: 'For reporting',
                },
                ...JSON.parse(REGISTRY_TEXT).servers,
            ],
        });
        const status = await refreshLlmRegistry({ fetch: genFetch(text) });
        expect(status.servers.map((one) => one.id)).toEqual([
            'registry-super-computer',
        ]);
        expect(JSON.stringify(status)).not.toContain('Report inbox');
        expect(JSON.stringify(status)).not.toContain('sk-report');
        expect(JSON.stringify(status)).not.toContain('reports.trycloudflare');
        expect(getLlmRegistryServers()).toHaveLength(1);
        expect(getLlmReportServers()).toEqual([
            {
                id: 'registry-reporting',
                name: 'Report inbox',
                baseUrl: 'https://reports.trycloudflare.com/v1',
                apiKey: 'sk-report',
                note: 'For reporting',
            },
        ]);
        resetLlmRegistryForTests();
        expect(getLlmReportServers()).toEqual([]);
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
