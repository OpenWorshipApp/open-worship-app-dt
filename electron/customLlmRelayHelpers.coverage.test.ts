import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, test, vi } from 'vitest';

// The Electron wiring around the relay core: its own session, the settings it
// reads in this process, and the IPC door a window asks through. Plain
// functions over hoisted state, not `vi.fn`, because the relay builds its
// session ONCE per module and `mockReset` would wipe what that first build
// registered before a later test could read it.
const state = vi.hoisted(() => ({
    partitions: [] as string[],
    permissionRequestHandler: null as
        null | ((contents: unknown, permission: string, done: any) => void),
    permissionCheckHandler: null as null | (() => boolean),
    sessionEvents: new Map<string, (event: any) => void>(),
    fetchCalls: [] as [string, RequestInit][],
    fetchImpl: null as
        null | ((url: string, init: RequestInit) => Promise<Response>),
    client: new Map<string, string>(),
    secure: new Map<string, string>(),
    aiEnabled: true,
    registry: [] as any[],
}));

vi.mock('electron', () => ({
    session: {
        fromPartition: (partition: string) => {
            state.partitions.push(partition);
            return {
                setPermissionRequestHandler: (handler: any) => {
                    state.permissionRequestHandler = handler;
                },
                setPermissionCheckHandler: (handler: any) => {
                    state.permissionCheckHandler = handler;
                },
                on: (name: string, handler: (event: any) => void) => {
                    state.sessionEvents.set(name, handler);
                },
                fetch: (url: string, init: RequestInit) => {
                    state.fetchCalls.push([url, init]);
                    return state.fetchImpl!(url, init);
                },
            };
        },
    },
}));
vi.mock('./ElectronSettingManager', () => ({
    default: {
        getInstance: () => ({
            getClientSetting: (key: string) => state.client.get(key) ?? null,
            getSecureSetting: (key: string) => state.secure.get(key) ?? null,
        }),
    },
}));
vi.mock('./aiHelpers', () => ({
    checkIsAiEnabled: () => state.aiEnabled,
}));
vi.mock('./llmRegistryHelpers', () => ({
    getLlmRegistryServers: () => state.registry,
}));

import {
    CUSTOM_LLM_KEYS_SETTING_KEY,
    CUSTOM_LLM_SERVERS_SETTING_KEY,
    toCustomServersText,
} from './customLlmProtocol';
import {
    cancelCustomLlmFetch,
    fetchOnRelaySession,
    handleCustomLlmFetch,
    runCustomLlmFetch,
    type CustomLlmRelayDepsType,
} from './customLlmRelayHelpers';

const SERVER_ID = '11111111-2222-3333-4444-555555555555';

function genSender() {
    return new EventEmitter() as any;
}

function genRequest(value: Record<string, unknown> = {}) {
    return {
        serverId: SERVER_ID,
        method: 'GET',
        path: '/models',
        requestId: 'req-door',
        ...value,
    } as any;
}

// Rejects once the relay drops the request, as a real fetch does.
function hangUntilAborted(_url: string, init: RequestInit) {
    return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
            reject(new Error('aborted'));
        });
    });
}

beforeEach(() => {
    state.fetchCalls = [];
    state.fetchImpl = async () => {
        return new Response('{"data":[]}', {
            status: 200,
            headers: { 'content-type': 'application/json' },
        });
    };
    state.client.clear();
    state.secure.clear();
    state.aiEnabled = true;
    state.registry = [];
    state.client.set(
        CUSTOM_LLM_SERVERS_SETTING_KEY,
        toCustomServersText([
            {
                id: SERVER_ID,
                name: 'LM Studio',
                baseUrl: 'http://localhost:1234/v1',
                models: [{ id: 'row-1', model: 'phi', name: '' }],
            },
        ]),
    );
});

describe('the relay’s own session', () => {
    test('is made once, refuses every permission and every download', async () => {
        const response = await fetchOnRelaySession(
            'https://registry.example/report',
            { method: 'POST' },
        );
        await fetchOnRelaySession('https://registry.example/again', {});

        expect(response.status).toBe(200);
        expect(state.partitions).toEqual(['custom-llm-relay']);
        expect(state.fetchCalls.map(([url]) => url)).toEqual([
            'https://registry.example/report',
            'https://registry.example/again',
        ]);
        const done = vi.fn();
        state.permissionRequestHandler!({}, 'media', done);
        expect(done).toHaveBeenCalledWith(false);
        expect(state.permissionCheckHandler!()).toBe(false);
        const download = { preventDefault: vi.fn() };
        state.sessionEvents.get('will-download')!(download);
        expect(download.preventDefault).toHaveBeenCalledOnce();
    });
});

describe('handleCustomLlmFetch, the IPC door', () => {
    test('forwards to the saved server with the key read in this process', async () => {
        state.secure.set(
            CUSTOM_LLM_KEYS_SETTING_KEY,
            JSON.stringify({ [SERVER_ID]: 'sk-main-only' }),
        );
        const sender = genSender();

        const result = await handleCustomLlmFetch(genRequest(), sender);

        expect(result).toEqual({
            ok: true,
            status: 200,
            contentType: 'application/json',
            text: '{"data":[]}',
        });
        expect(state.fetchCalls).toHaveLength(1);
        const [url, init] = state.fetchCalls[0];
        expect(url).toBe('http://localhost:1234/v1/models');
        expect((init.headers as any).authorization).toBe('Bearer sk-main-only');
        // The door stops listening for the window once the answer is in.
        expect(sender.listenerCount('destroyed')).toBe(0);
    });

    test('a registry server is found through the registry, by its id', async () => {
        state.registry = [
            {
                id: 'registry-hall',
                name: 'Hall',
                baseUrl: 'https://hall.example/v1',
                models: [],
                apiKey: 'sk-registry',
                isFree: true,
                note: '',
                source: 'registry',
            },
        ];

        const result = await handleCustomLlmFetch(
            genRequest({ serverId: 'registry-hall' }),
            genSender(),
        );

        expect(result).toMatchObject({ ok: true, status: 200 });
        expect(state.fetchCalls[0][0]).toBe('https://hall.example/v1/models');
        expect((state.fetchCalls[0][1].headers as any).authorization).toBe(
            'Bearer sk-registry',
        );
    });

    test('a window closed mid-question takes its request with it', async () => {
        state.fetchImpl = hangUntilAborted;
        const sender = genSender();

        const pending = handleCustomLlmFetch(
            genRequest({
                requestId: 'req-window',
                method: 'POST',
                path: '/chat/completions',
                body: '{"model":"phi"}',
            }),
            sender,
        );
        expect(sender.listenerCount('destroyed')).toBe(1);
        sender.emit('destroyed');

        expect(await pending).toMatchObject({ ok: false, reason: 'cancelled' });
        expect(sender.listenerCount('destroyed')).toBe(0);
    });

    test('says no with AI switched off, and asks nothing', async () => {
        state.aiEnabled = false;

        expect(await handleCustomLlmFetch(genRequest(), genSender())).toEqual({
            ok: false,
            reason: 'ai-off',
            detail: 'AI features are turned off in Settings',
        });
        expect(state.fetchCalls).toEqual([]);
    });

    test('with no servers saved, every id is unknown', async () => {
        state.client.clear();

        expect(
            await handleCustomLlmFetch(genRequest(), genSender()),
        ).toMatchObject({ ok: false, reason: 'unknown-server' });
    });
});

describe('cancelCustomLlmFetch', () => {
    test('ignores an id that is not text, and cancels only its own request', async () => {
        const deps: CustomLlmRelayDepsType = {
            isAiEnabled: () => true,
            readServersText: () =>
                state.client.get(CUSTOM_LLM_SERVERS_SETTING_KEY)!,
            readKeysText: () => null,
            fetch: hangUntilAborted,
        };
        const pending = runCustomLlmFetch(
            genRequest({ requestId: 'req-keep' }),
            deps,
        );
        let isSettled = false;
        void pending.then(() => {
            isSettled = true;
        });

        cancelCustomLlmFetch(42);
        cancelCustomLlmFetch(undefined);
        cancelCustomLlmFetch('req-other');
        await new Promise((resolve) => setTimeout(resolve, 5));
        expect(isSettled).toBe(false);

        cancelCustomLlmFetch('req-keep');
        expect(await pending).toMatchObject({ reason: 'cancelled' });
    });
});

describe('reading the answer', () => {
    function genDeps(fetch: CustomLlmRelayDepsType['fetch']) {
        return {
            isAiEnabled: () => true,
            readServersText: () =>
                state.client.get(CUSTOM_LLM_SERVERS_SETTING_KEY)!,
            readKeysText: () => null,
            fetch,
        } satisfies CustomLlmRelayDepsType;
    }

    test('an answer with no body at all is empty text', async () => {
        const result = await runCustomLlmFetch(
            genRequest(),
            genDeps(async () => new Response(null, { status: 204 })),
        );

        expect(result).toEqual({
            ok: true,
            status: 204,
            contentType: '',
            text: '',
        });
    });

    test('a body that keeps coming is cut off at the ceiling, and let go', async () => {
        const chunk = new Uint8Array(1024 * 1024);
        let pulled = 0;
        let isCancelled = false;
        // No content-length to refuse it by: only the running count can.
        const body = new ReadableStream<Uint8Array>({
            pull(controller) {
                pulled += 1;
                controller.enqueue(chunk);
            },
            cancel() {
                isCancelled = true;
            },
        });

        const result = await runCustomLlmFetch(
            genRequest(),
            genDeps(async () => new Response(body, { status: 200 })),
        );

        expect(result).toEqual({
            ok: false,
            reason: 'too-large',
            detail: 'the server answered with too much',
        });
        expect(isCancelled).toBe(true);
        // Four MiB is the ceiling: the fifth chunk crossed it.
        expect(pulled).toBeLessThanOrEqual(6);
    });

    test('a body in several pieces is joined in order', async () => {
        const encoder = new TextEncoder();
        const pieces = ['{"data":', '[{"id":"phi"}', ']}'];
        const body = new ReadableStream<Uint8Array>({
            start(controller) {
                for (const piece of pieces) {
                    controller.enqueue(encoder.encode(piece));
                }
                controller.close();
            },
        });

        const result = await runCustomLlmFetch(
            genRequest(),
            genDeps(async () => new Response(body, { status: 200 })),
        );

        expect(result).toMatchObject({
            ok: true,
            text: '{"data":[{"id":"phi"}]}',
        });
    });
});
