import { beforeEach, describe, expect, it, vi } from 'vitest';

// The relay core takes its dependencies as an argument; the Electron wiring
// around it is stubbed only far enough to load.
vi.mock('electron', () => ({ session: { fromPartition: vi.fn() } }));
vi.mock('./ElectronSettingManager', () => ({
    default: { getInstance: vi.fn() },
}));
vi.mock('./aiHelpers', () => ({ checkIsAiEnabled: vi.fn(() => true) }));

import {
    cancelCustomLlmFetch,
    runCustomLlmFetch,
    type CustomLlmRelayDepsType,
} from './customLlmRelayHelpers';
import { toCustomServersText } from './customLlmProtocol';

const SERVER_ID = '11111111-2222-3333-4444-555555555555';

const SERVERS_TEXT = toCustomServersText([
    {
        id: SERVER_ID,
        name: 'LM Studio',
        baseUrl: 'http://localhost:1234/v1/',
        models: [{ id: 'row-1', model: 'phi', name: '' }],
    },
]);

function genDeps(
    value: Partial<CustomLlmRelayDepsType> = {},
): CustomLlmRelayDepsType & { fetch: ReturnType<typeof vi.fn> } {
    return {
        isAiEnabled: () => true,
        readServersText: () => SERVERS_TEXT,
        readKeysText: () => null,
        fetch: vi.fn(async () => {
            return new Response('{"data":[]}', {
                status: 200,
                headers: { 'content-type': 'application/json' },
            });
        }),
        ...value,
    } as any;
}

function genRequest(value: Record<string, unknown> = {}) {
    return {
        serverId: SERVER_ID,
        method: 'GET',
        path: '/models',
        requestId: 'req-1',
        ...value,
    } as any;
}

describe('runCustomLlmFetch', () => {
    beforeEach(() => {
        vi.useRealTimers();
    });

    it('forwards to the SAVED address, with the key read here', async () => {
        const deps = genDeps({
            readKeysText: () => JSON.stringify({ [SERVER_ID]: 'sk-local' }),
        });
        const result = await runCustomLlmFetch(genRequest(), deps);
        expect(result).toEqual({
            ok: true,
            status: 200,
            contentType: 'application/json',
            text: '{"data":[]}',
        });
        const [url, init] = deps.fetch.mock.calls[0];
        expect(url).toBe('http://localhost:1234/v1/models');
        expect(init.headers.authorization).toBe('Bearer sk-local');
        // A redirect could carry the key to another host.
        expect(init.redirect).toBe('manual');
        expect(init.credentials).toBe('omit');
        // The key goes out in a header and never comes back.
        expect(JSON.stringify(result)).not.toContain('sk-local');
    });

    it('sends no Authorization at all when the server has no key', async () => {
        const deps = genDeps();
        await runCustomLlmFetch(genRequest(), deps);
        expect(deps.fetch.mock.calls[0][1].headers).not.toHaveProperty(
            'authorization',
        );
    });

    it('posts a chat body as JSON', async () => {
        const deps = genDeps();
        await runCustomLlmFetch(
            genRequest({
                method: 'POST',
                path: '/chat/completions',
                body: '{"model":"phi"}',
            }),
            deps,
        );
        const [url, init] = deps.fetch.mock.calls[0];
        expect(url).toBe('http://localhost:1234/v1/chat/completions');
        expect(init.method).toBe('POST');
        expect(init.body).toBe('{"model":"phi"}');
        expect(init.headers['content-type']).toBe('application/json');
    });

    it('asks LM Studio’s own list at the ROOT of a /v1 address', async () => {
        const deps = genDeps();
        await runCustomLlmFetch(
            genRequest({ path: '/api/v0/models', method: 'GET' }),
            deps,
        );
        expect(deps.fetch.mock.calls[0][0]).toBe(
            'http://localhost:1234/api/v0/models',
        );
    });

    it('never asks the root of an address with a longer path', async () => {
        const deps = genDeps({
            readServersText: () =>
                toCustomServersText([
                    {
                        id: SERVER_ID,
                        name: 'Proxy',
                        baseUrl: 'https://example.com/team/v1',
                        models: [],
                    },
                ]),
        });
        expect(
            await runCustomLlmFetch(
                genRequest({ path: '/api/v0/models', method: 'GET' }),
                deps,
            ),
        ).toMatchObject({ ok: false, reason: 'not-allowed' });
        expect(deps.fetch).not.toHaveBeenCalled();
    });

    it('refuses every call but the ones the chatbot makes', async () => {
        const deps = genDeps();
        for (const request of [
            genRequest({ path: '/embeddings', method: 'POST', body: '{}' }),
            genRequest({ path: '/api/v0/models', method: 'POST', body: '{}' }),
            genRequest({
                path: '/api/v1/models/load',
                method: 'POST',
                body: '{}',
            }),
            genRequest({ path: '/models', method: 'DELETE' }),
            genRequest({ path: '/../admin' }),
            genRequest({ method: 'POST', path: '/chat/completions' }),
            genRequest({ requestId: 'not an id!' }),
        ]) {
            expect(await runCustomLlmFetch(request, deps)).toMatchObject({
                ok: false,
                reason: 'not-allowed',
            });
        }
        expect(deps.fetch).not.toHaveBeenCalled();
    });

    it('refuses a server that is not in Settings, or not an address', async () => {
        const deps = genDeps();
        expect(
            await runCustomLlmFetch(genRequest({ serverId: 'other' }), deps),
        ).toMatchObject({ ok: false, reason: 'unknown-server' });
        const badDeps = genDeps({
            readServersText: () =>
                toCustomServersText([
                    {
                        id: SERVER_ID,
                        name: 'x',
                        baseUrl: 'file:///C:/',
                        models: [],
                    },
                ]),
        });
        expect(await runCustomLlmFetch(genRequest(), badDeps)).toMatchObject({
            ok: false,
            reason: 'bad-url',
        });
        expect(deps.fetch).not.toHaveBeenCalled();
        expect(badDeps.fetch).not.toHaveBeenCalled();
    });

    it('does nothing with AI switched off', async () => {
        const deps = genDeps({ isAiEnabled: () => false });
        expect(await runCustomLlmFetch(genRequest(), deps)).toMatchObject({
            ok: false,
            reason: 'ai-off',
        });
        expect(deps.fetch).not.toHaveBeenCalled();
    });

    it('says nothing answered rather than throwing', async () => {
        const deps = genDeps({
            fetch: vi.fn(async () => {
                throw new Error('net::ERR_CONNECTION_REFUSED');
            }),
        });
        expect(await runCustomLlmFetch(genRequest(), deps)).toEqual({
            ok: false,
            reason: 'unreachable',
            detail: 'net::ERR_CONNECTION_REFUSED',
        });
    });

    it('refuses a redirect instead of following it', async () => {
        const deps = genDeps({
            fetch: vi.fn(async () => {
                return new Response(null, {
                    status: 302,
                    headers: { location: 'https://elsewhere.example' },
                });
            }),
        });
        expect(await runCustomLlmFetch(genRequest(), deps)).toMatchObject({
            ok: false,
            reason: 'redirect',
        });
    });

    it('refuses an answer too big to hold', async () => {
        const deps = genDeps({
            fetch: vi.fn(async () => {
                return new Response('x', {
                    status: 200,
                    headers: { 'content-length': String(64 * 1024 * 1024) },
                });
            }),
        });
        expect(await runCustomLlmFetch(genRequest(), deps)).toMatchObject({
            ok: false,
            reason: 'too-large',
        });
    });

    it('passes the server’s own error status through', async () => {
        const deps = genDeps({
            fetch: vi.fn(async () => {
                return new Response('{"error":"model not loaded"}', {
                    status: 400,
                });
            }),
        });
        expect(await runCustomLlmFetch(genRequest(), deps)).toMatchObject({
            ok: true,
            status: 400,
            text: '{"error":"model not loaded"}',
        });
    });

    it('drops the work on Stop, and says it was stopped', async () => {
        const deps = genDeps({
            fetch: vi.fn((_url: string, init: RequestInit) => {
                return new Promise<Response>((_resolve, reject) => {
                    init.signal?.addEventListener('abort', () => {
                        reject(new Error('aborted'));
                    });
                });
            }),
        });
        const pending = runCustomLlmFetch(
            genRequest({ requestId: 'req-stop' }),
            deps,
        );
        cancelCustomLlmFetch('req-stop');
        expect(await pending).toMatchObject({
            ok: false,
            reason: 'cancelled',
        });
    });

    describe('watching the server while a question is out', () => {
        const CHAT_URL = 'http://localhost:1234/v1/chat/completions';
        const LIST_URL = 'http://localhost:1234/v1/models';

        function genChatRequest() {
            return genRequest({
                method: 'POST',
                path: '/chat/completions',
                body: '{"model":"phi"}',
            });
        }

        function genHangingChat() {
            return (_url: string, init: RequestInit) => {
                return new Promise<Response>((_resolve, reject) => {
                    init.signal?.addEventListener('abort', () => {
                        reject(new Error('aborted'));
                    });
                });
            };
        }

        it('gives the question up once the machine cannot be reached', async () => {
            vi.useFakeTimers();
            const hangingChat = genHangingChat();
            const deps = genDeps({
                readKeysText: () => JSON.stringify({ [SERVER_ID]: 'sk-1' }),
                fetch: vi.fn(async (url: string, init: RequestInit) => {
                    if (url === LIST_URL) {
                        throw new Error('net::ERR_ADDRESS_UNREACHABLE');
                    }
                    return hangingChat(url, init);
                }),
            });
            const pending = runCustomLlmFetch(genChatRequest(), deps);
            await vi.advanceTimersByTimeAsync(41 * 1000);
            expect(await pending).toMatchObject({ ok: false, reason: 'lost' });
            const listCalls = deps.fetch.mock.calls.filter(([url]) => {
                return url === LIST_URL;
            });
            expect(listCalls).toHaveLength(2);
            // The watch carries the key the question did, and nothing else.
            expect(listCalls[0][1].headers).toEqual({
                accept: 'application/json',
                authorization: 'Bearer sk-1',
            });
        });

        it('keeps waiting on a server that is only slow', async () => {
            vi.useFakeTimers();
            const hangingChat = genHangingChat();
            const deps = genDeps({
                fetch: vi.fn(async (url: string, init: RequestInit) => {
                    if (url === CHAT_URL) {
                        return hangingChat(url, init);
                    }
                    // A list that never comes back is a busy server.
                    return hangingChat(url, init);
                }),
            });
            const pending = runCustomLlmFetch(
                { ...genChatRequest(), requestId: 'req-slow' },
                deps,
            );
            await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
            // One watch at a time: the first never settled.
            expect(
                deps.fetch.mock.calls.filter(([url]) => {
                    return url === LIST_URL;
                }),
            ).toHaveLength(1);
            cancelCustomLlmFetch('req-slow');
            expect(await pending).toMatchObject({
                ok: false,
                reason: 'cancelled',
            });
        });

        it('forgives a miss the server recovers from', async () => {
            vi.useFakeTimers();
            const hangingChat = genHangingChat();
            let listCount = 0;
            const deps = genDeps({
                fetch: vi.fn(async (url: string, init: RequestInit) => {
                    if (url === LIST_URL) {
                        listCount += 1;
                        if (listCount % 2 === 1) {
                            throw new Error('net::ERR_CONNECTION_RESET');
                        }
                        return new Response('{"data":[]}');
                    }
                    return hangingChat(url, init);
                }),
            });
            const pending = runCustomLlmFetch(
                { ...genChatRequest(), requestId: 'req-flaky' },
                deps,
            );
            await vi.advanceTimersByTimeAsync(3 * 60 * 1000);
            cancelCustomLlmFetch('req-flaky');
            expect(await pending).toMatchObject({ reason: 'cancelled' });
        });

        it('stops watching once the answer is in', async () => {
            vi.useFakeTimers();
            const deps = genDeps();
            await runCustomLlmFetch(genChatRequest(), deps);
            await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
            expect(deps.fetch).toHaveBeenCalledTimes(1);
        });

        it('never watches a model list being read', async () => {
            vi.useFakeTimers();
            const hangingChat = genHangingChat();
            const deps = genDeps({ fetch: vi.fn(hangingChat) });
            const pending = runCustomLlmFetch(
                genRequest({ requestId: 'req-list' }),
                deps,
            );
            await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
            expect(deps.fetch).toHaveBeenCalledTimes(1);
            cancelCustomLlmFetch('req-list');
            await pending;
        });
    });

    it('gives up on a server that never answers', async () => {
        vi.useFakeTimers();
        const deps = genDeps({
            fetch: vi.fn((_url: string, init: RequestInit) => {
                return new Promise<Response>((_resolve, reject) => {
                    init.signal?.addEventListener('abort', () => {
                        reject(new Error('aborted'));
                    });
                });
            }),
        });
        const pending = runCustomLlmFetch(genRequest(), deps);
        await vi.advanceTimersByTimeAsync(12 * 60 * 1000);
        expect(await pending).toMatchObject({ ok: false, reason: 'timeout' });
    });
});
