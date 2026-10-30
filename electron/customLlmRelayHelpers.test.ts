import { beforeEach, describe, expect, it, vi } from 'vitest';

// The relay core takes its dependencies as an argument; the Electron wiring
// around it is stubbed only far enough to load.
vi.mock('electron', () => ({ session: { fromPartition: vi.fn() } }));
vi.mock('./ElectronSettingManager', () => ({
    default: { getInstance: vi.fn() },
}));
vi.mock('./aiHelpers', () => ({ checkIsAiEnabled: vi.fn(() => true) }));

import { EventEmitter } from 'node:events';
import { session } from 'electron';

import {
    cancelCustomLlmFetch,
    fetchOnRelaySession,
    handleCustomLlmFetch,
    runCustomLlmFetch,
    type CustomLlmRelayDepsType,
} from './customLlmRelayHelpers';
import {
    CUSTOM_LLM_KEYS_SETTING_KEY,
    CUSTOM_LLM_SERVERS_SETTING_KEY,
    toCustomServersText,
} from './customLlmProtocol';
import ElectronSettingManager from './ElectronSettingManager';
import { checkIsAiEnabled } from './aiHelpers';
import {
    refreshLlmRegistry,
    resetLlmRegistryForTests,
} from './llmRegistryHelpers';

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

    // The shared registry's servers are main's to know: a window names one
    // by its `registry-` id and the key goes out from the registry itself.
    it('asks a registry server by its id with the registry key, and no other', async () => {
        const deps = genDeps({
            readRegistryServers: () => [
                {
                    id: 'registry-super-computer',
                    name: 'Church LM Studio',
                    baseUrl: 'https://abc.trycloudflare.com/v1',
                    models: [{ id: 'row-1', model: 'qwen', name: '' }],
                    apiKey: 'sk-shared',
                    isFree: true,
                    note: '',
                    source: 'registry',
                },
            ],
        });
        const result = await runCustomLlmFetch(
            genRequest({ serverId: 'registry-super-computer' }),
            deps,
        );
        expect(result.ok).toBe(true);
        const [url, init] = deps.fetch.mock.calls[0] as any[];
        expect(url).toBe('https://abc.trycloudflare.com/v1/models');
        expect(init.headers.authorization).toBe('Bearer sk-shared');
        // A registry id the registry does not carry is unknown, like any
        // other; a saved-looking id never reaches the registry list.
        const missing = await runCustomLlmFetch(
            genRequest({ serverId: 'registry-nobody' }),
            deps,
        );
        expect(missing).toMatchObject({ ok: false, reason: 'unknown-server' });
        const noRegistry = await runCustomLlmFetch(
            genRequest({ serverId: 'registry-super-computer' }),
            genDeps(),
        );
        expect(noRegistry).toMatchObject({
            ok: false,
            reason: 'unknown-server',
        });
    });

    // A window is never told where a shared server lives, so what the server
    // (or the tunnel in front of it) writes about itself must not tell it.
    it('takes a registry server’s host out of what comes back, and leaves a saved server’s alone', async () => {
        const registryServer = {
            id: 'registry-super-computer',
            name: 'Church LM Studio',
            baseUrl: 'https://abc.trycloudflare.com/v1',
            models: [{ id: 'row-1', model: 'qwen', name: '' }],
            apiKey: 'sk-shared',
            isFree: true,
            note: '',
            source: 'registry' as const,
        };
        const answered = await runCustomLlmFetch(
            genRequest({ serverId: 'registry-super-computer' }),
            genDeps({
                readRegistryServers: () => [registryServer],
                fetch: vi.fn(async () => {
                    return new Response(
                        'Tunnel abc.trycloudflare.com is not running',
                        { status: 530 },
                    );
                }),
            }),
        );
        expect(answered).toMatchObject({
            ok: true,
            status: 530,
            text: 'Tunnel shared-server.invalid is not running',
        });
        const refused = await runCustomLlmFetch(
            genRequest({ serverId: 'registry-super-computer' }),
            genDeps({
                readRegistryServers: () => [registryServer],
                fetch: vi.fn(async () => {
                    throw new Error(
                        'getaddrinfo ENOTFOUND abc.trycloudflare.com',
                    );
                }),
            }),
        );
        expect(refused).toEqual({
            ok: false,
            reason: 'unreachable',
            detail: 'getaddrinfo ENOTFOUND shared-server.invalid',
        });
        const saved = await runCustomLlmFetch(
            genRequest(),
            genDeps({
                fetch: vi.fn(async () => {
                    throw new Error('connect ECONNREFUSED localhost:1234');
                }),
            }),
        );
        expect(saved).toMatchObject({
            detail: 'connect ECONNREFUSED localhost:1234',
        });
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

    it('probes the model list at another path of the SAME server only', async () => {
        const deps = genDeps({
            readKeysText: () => JSON.stringify({ [SERVER_ID]: 'sk-local' }),
        });
        const result = await runCustomLlmFetch(
            genRequest({ probeBaseUrl: 'http://localhost:1234' }),
            deps,
        );
        expect(result).toMatchObject({ ok: true, status: 200 });
        const [url, init] = deps.fetch.mock.calls[0];
        expect(url).toBe('http://localhost:1234/models');
        // The same server, so the key goes with it.
        expect(init.headers.authorization).toBe('Bearer sk-local');

        // Another host, another port, another scheme: never, key or no key.
        for (const probeBaseUrl of [
            'http://localhost:11434/v1',
            'https://localhost:1234/v1',
            'http://evil.example/v1',
            'not an address',
        ]) {
            expect(
                await runCustomLlmFetch(genRequest({ probeBaseUrl }), deps),
            ).toMatchObject({ ok: false, reason: 'not-allowed' });
        }
        // And only the model list is ever probed.
        expect(
            await runCustomLlmFetch(
                genRequest({
                    method: 'POST',
                    path: '/chat/completions',
                    body: '{}',
                    probeBaseUrl: 'http://localhost:1234',
                }),
                deps,
            ),
        ).toMatchObject({ ok: false, reason: 'not-allowed' });
        expect(
            await runCustomLlmFetch(
                genRequest({
                    path: '/api/tags',
                    probeBaseUrl: 'http://localhost:1234',
                }),
                deps,
            ),
        ).toMatchObject({ ok: false, reason: 'not-allowed' });
        expect(deps.fetch).toHaveBeenCalledTimes(1);
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

describe('reading what came back', () => {
    beforeEach(() => {
        vi.useRealTimers();
    });

    it('reads an answer with no body as empty text', async () => {
        const deps = genDeps({
            fetch: vi.fn(async () => new Response(null, { status: 204 })),
        });
        expect(await runCustomLlmFetch(genRequest(), deps)).toEqual({
            ok: true,
            status: 204,
            contentType: '',
            text: '',
        });
    });

    it('stops reading an undeclared answer once it is too big, and lets it go', async () => {
        const megabyte = new Uint8Array(1024 * 1024);
        let pulled = 0;
        const cancel = vi.fn();
        const deps = genDeps({
            fetch: vi.fn(async () => {
                // No content-length: only counting the bytes can tell.
                const stream = new ReadableStream<Uint8Array>({
                    pull(controller) {
                        pulled += 1;
                        controller.enqueue(megabyte);
                    },
                    cancel,
                });
                return new Response(stream, { status: 200 });
            }),
        });
        expect(await runCustomLlmFetch(genRequest(), deps)).toMatchObject({
            ok: false,
            reason: 'too-large',
        });
        expect(cancel).toHaveBeenCalledTimes(1);
        // Four megabytes are held, the fifth is the one that stops it.
        expect(pulled).toBeLessThanOrEqual(6);
    });

    it('ignores a Stop that names no request', async () => {
        let release: (() => void) | undefined;
        const deps = genDeps({
            fetch: vi.fn((_url: string, init: RequestInit) => {
                return new Promise<Response>((resolve, reject) => {
                    release = () => resolve(new Response('{"data":[]}'));
                    init.signal?.addEventListener('abort', () => {
                        reject(new Error('aborted'));
                    });
                });
            }),
        });
        const pending = runCustomLlmFetch(
            genRequest({ requestId: 'req-named' }),
            deps,
        );
        cancelCustomLlmFetch(undefined);
        cancelCustomLlmFetch(42);
        release?.();
        expect(await pending).toMatchObject({ ok: true, status: 200 });
    });
});

// The Electron side: the relay's own session and the IPC door around the core.
// The session is made once for the whole run, so what it registers is kept in
// plain fields rather than in mock calls a reset would clear.
const relaySession = {
    partitions: [] as string[],
    permissionRequest: undefined as
        | undefined
        | ((contents: unknown, permission: string, done: any) => void),
    permissionCheck: undefined as undefined | (() => boolean),
    willDownload: undefined as undefined | ((event: any) => void),
    fetch: vi.fn(),
};

describe('the relay in main', () => {
    const settings = {
        clientSettings: new Map<string, string>(),
        secureSettings: new Map<string, string>(),
    };

    beforeEach(() => {
        vi.useRealTimers();
        settings.clientSettings.clear();
        settings.secureSettings.clear();
        resetLlmRegistryForTests();
        vi.mocked(checkIsAiEnabled).mockReturnValue(true);
        vi.mocked(ElectronSettingManager.getInstance).mockReturnValue({
            getClientSetting: (key: string) => {
                return settings.clientSettings.get(key) ?? null;
            },
            getSecureSetting: (key: string) => {
                return settings.secureSettings.get(key) ?? null;
            },
        } as any);
        vi.mocked(session.fromPartition).mockImplementation(
            (partition: string) => {
                relaySession.partitions.push(partition);
                return {
                    setPermissionRequestHandler: (handler: any) => {
                        relaySession.permissionRequest = handler;
                    },
                    setPermissionCheckHandler: (handler: any) => {
                        relaySession.permissionCheck = handler;
                    },
                    on: (name: string, handler: any) => {
                        if (name === 'will-download') {
                            relaySession.willDownload = handler;
                        }
                    },
                    fetch: (url: string, init: RequestInit) => {
                        return relaySession.fetch(url, init);
                    },
                } as any;
            },
        );
        relaySession.fetch.mockImplementation(async () => {
            return new Response('{"data":[]}', {
                status: 200,
                headers: { 'content-type': 'application/json' },
            });
        });
    });

    it('sends on its own locked-down session, made once', async () => {
        const init = { method: 'POST', body: 'report' };
        await fetchOnRelaySession('https://reports.example/post', init);
        await fetchOnRelaySession('https://reports.example/post', init);
        expect(relaySession.fetch).toHaveBeenCalledWith(
            'https://reports.example/post',
            init,
        );
        expect(relaySession.partitions).toEqual(['custom-llm-relay']);

        const done = vi.fn();
        relaySession.permissionRequest?.({}, 'media', done);
        expect(done).toHaveBeenCalledWith(false);
        expect(relaySession.permissionCheck?.()).toBe(false);
        const download = { preventDefault: vi.fn() };
        relaySession.willDownload?.(download);
        expect(download.preventDefault).toHaveBeenCalledTimes(1);
    });

    it('forwards a window call to the server saved in Settings, with the stored key', async () => {
        settings.clientSettings.set(
            CUSTOM_LLM_SERVERS_SETTING_KEY,
            SERVERS_TEXT,
        );
        settings.secureSettings.set(
            CUSTOM_LLM_KEYS_SETTING_KEY,
            JSON.stringify({ [SERVER_ID]: 'sk-stored' }),
        );
        const sender = new EventEmitter();
        const result = await handleCustomLlmFetch(genRequest(), sender as any);
        expect(result).toMatchObject({ ok: true, text: '{"data":[]}' });
        const [url, init] = relaySession.fetch.mock.calls[0];
        expect(url).toBe('http://localhost:1234/v1/models');
        expect(init.headers.authorization).toBe('Bearer sk-stored');
        // Done: the window's close no longer reaches the finished request.
        expect(sender.listenerCount('destroyed')).toBe(0);
    });

    it('drops the question when the asking window is closed', async () => {
        settings.clientSettings.set(
            CUSTOM_LLM_SERVERS_SETTING_KEY,
            SERVERS_TEXT,
        );
        relaySession.fetch.mockImplementation(
            (_url: string, init: RequestInit) => {
                return new Promise((_resolve, reject) => {
                    init.signal?.addEventListener('abort', () => {
                        reject(new Error('aborted'));
                    });
                });
            },
        );
        const sender = new EventEmitter();
        const pending = handleCustomLlmFetch(
            genRequest({ requestId: 'req-window' }),
            sender as any,
        );
        expect(sender.listenerCount('destroyed')).toBe(1);
        sender.emit('destroyed');
        expect(await pending).toMatchObject({
            ok: false,
            reason: 'cancelled',
        });
    });

    it('asks a registry server main read, by its id', async () => {
        await refreshLlmRegistry({
            fetch: async () => {
                return new Response(
                    JSON.stringify({
                        version: 1,
                        updated: '2026-10-10',
                        servers: [
                            {
                                id: 'super-computer',
                                name: 'Church LM Studio',
                                baseUrl: 'https://abc.trycloudflare.com/v1',
                                apiKey: 'sk-shared',
                                isFree: true,
                                note: '',
                                models: [{ model: 'qwen', name: 'Qwen' }],
                            },
                        ],
                    }),
                );
            },
        });
        const result = await handleCustomLlmFetch(
            genRequest({ serverId: 'registry-super-computer' }),
            new EventEmitter() as any,
        );
        expect(result).toMatchObject({ ok: true });
        const [url, init] = relaySession.fetch.mock.calls[0];
        expect(url).toBe('https://abc.trycloudflare.com/v1/models');
        expect(init.headers.authorization).toBe('Bearer sk-shared');
    });

    it('does nothing with AI switched off in Settings', async () => {
        vi.mocked(checkIsAiEnabled).mockReturnValue(false);
        const result = await handleCustomLlmFetch(
            genRequest(),
            new EventEmitter() as any,
        );
        expect(result).toMatchObject({ ok: false, reason: 'ai-off' });
        expect(relaySession.fetch).not.toHaveBeenCalled();
    });
});
