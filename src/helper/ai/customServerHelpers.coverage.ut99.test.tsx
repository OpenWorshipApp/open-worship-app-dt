// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The two stores as plain maps, so what a helper WROTE is read back the way
// the next window reads it; the relay's IPC is faked per test.
const h = vi.hoisted(() => ({
    homeStore: new Map<string, string>(),
    secureStore: new Map<string, string>(),
    send: vi.fn(),
    sendData: vi.fn(),
}));

vi.mock('../appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});
vi.mock('../../server/appHomeStorage', () => ({
    appHomeStorage: {
        getItem: (key: string) => h.homeStore.get(key) ?? null,
        setItem: (key: string, value: string) => {
            h.homeStore.set(key, value);
        },
    },
}));
vi.mock('../../server/appSecureStorage', () => ({
    appSecureStorage: {
        getItem: (key: string) => h.secureStore.get(key) ?? null,
        setItem: (key: string, value: string) => {
            h.secureStore.set(key, value);
        },
        removeItem: (key: string) => {
            h.secureStore.delete(key);
        },
    },
}));
vi.mock('../../server/appProvider', () => ({
    default: { messageUtils: { sendData: h.sendData } },
}));
vi.mock('../../server/electronSendHelpers', () => ({
    electronSendAsync: h.send,
}));

import {
    cancelCustomLlmRequest,
    describeCustomLlmFailure,
    genCustomModelRow,
    genCustomServer,
    getCustomServerKey,
    getCustomServers,
    listCustomServerModels,
    loadLlmRegistry,
    requestCustomLlm,
    setCustomServerKey,
    setCustomServers,
    useCustomServers,
    useLlmRegistry,
} from './customServerHelpers';
import {
    CUSTOM_KEY_MAX,
    CUSTOM_LLM_CANCEL_CHANNEL,
    CUSTOM_LLM_FETCH_CHANNEL,
    CUSTOM_LLM_KEYS_SETTING_KEY,
    CUSTOM_LLM_SERVERS_SETTING_KEY,
    LLM_REGISTRY_GET_CHANNEL,
    type CustomServerType,
} from '../../../electron/customLlmProtocol';

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function genStatus(servers: CustomServerType[], fetchedAt = 1) {
    return {
        url: 'https://www.openworship.app/llm/info.json',
        servers,
        fetchedAt,
        error: null,
    };
}

const SHARED_SERVER: CustomServerType = {
    id: 'registry-church',
    name: 'Church LM Studio',
    baseUrl: 'https://shared-server.invalid/v1',
    models: [{ id: 'row-1', model: 'qwen/qwen3.5-9b', name: 'Qwen' }],
};

let container: HTMLDivElement;
let root: Root;
// Counted on COMMIT: a state update that hands back the old object may still
// call the component once, but it commits nothing.
let registryCommitCount = 0;

function ServersProbeComp() {
    const servers = useCustomServers();
    return (
        <output className="servers">
            {servers
                .map((server) => {
                    return server.name;
                })
                .join(',')}
        </output>
    );
}

function RegistryProbeComp() {
    const { servers, status } = useLlmRegistry();
    useEffect(() => {
        registryCommitCount++;
    });
    return (
        <output className="registry">
            {JSON.stringify({
                ids: servers.map((server) => {
                    return `${server.id}:${server.source}`;
                }),
                fetchedAt: status?.fetchedAt ?? null,
            })}
        </output>
    );
}

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

function readRegistryProbe() {
    return JSON.parse(container.querySelector('.registry')!.textContent!);
}

beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    h.homeStore.clear();
    h.secureStore.clear();
    registryCommitCount = 0;
    // Every test starts from an empty registry, whatever the last one left.
    h.send.mockResolvedValue(genStatus([], 0));
    await loadLlmRegistry();
    h.send.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
});

describe('the saved servers', () => {
    test('a list first shows what the store holds', async () => {
        h.homeStore.set(
            CUSTOM_LLM_SERVERS_SETTING_KEY,
            JSON.stringify({
                servers: [
                    {
                        id: 'lm-1',
                        name: 'LM Studio',
                        baseUrl: 'http://localhost:1234/v1',
                        models: [],
                    },
                ],
            }),
        );
        await act(async () => {
            root.render(<ServersProbeComp />);
        });
        expect(container.querySelector('.servers')!.textContent).toBe(
            'LM Studio',
        );
    });

    test('a save writes the checked list and every mounted list hears it', async () => {
        await act(async () => {
            root.render(<ServersProbeComp />);
        });
        expect(container.querySelector('.servers')!.textContent).toBe('');

        await act(async () => {
            setCustomServers([
                {
                    id: 'lm-1',
                    name: '  LM Studio  ',
                    baseUrl: ' http://localhost:1234/v1 ',
                    models: [],
                    // Nothing but the listed fields is kept.
                    secret: 'should not be stored',
                } as any,
                // An id the store can never hold.
                { id: 'not an id', name: 'Bad', baseUrl: '', models: [] },
            ]);
        });
        expect(
            JSON.parse(h.homeStore.get(CUSTOM_LLM_SERVERS_SETTING_KEY)!),
        ).toEqual({
            servers: [
                {
                    id: 'lm-1',
                    name: 'LM Studio',
                    baseUrl: 'http://localhost:1234/v1',
                    models: [],
                },
            ],
        });
        expect(container.querySelector('.servers')!.textContent).toBe(
            'LM Studio',
        );
        expect(getCustomServers().map((one) => one.id)).toEqual(['lm-1']);
    });

    test('an unmounted list stops listening', async () => {
        await act(async () => {
            root.render(<ServersProbeComp />);
        });
        act(() => {
            root.unmount();
        });
        // A save after the unmount reaches no state of the gone list.
        expect(() => {
            setCustomServers([
                { id: 'lm-2', name: 'Ollama', baseUrl: '', models: [] },
            ]);
        }).not.toThrow();
        root = createRoot(container);
        await act(async () => {
            root.render(<ServersProbeComp />);
        });
        expect(container.querySelector('.servers')!.textContent).toBe('Ollama');
    });
});

describe('the encrypted keys', () => {
    test('a key is trimmed, cut at the ceiling and read back by server id', () => {
        setCustomServerKey('lm-1', '  sk-local-1  ');
        expect(
            JSON.parse(h.secureStore.get(CUSTOM_LLM_KEYS_SETTING_KEY)!),
        ).toEqual({ 'lm-1': 'sk-local-1' });
        expect(getCustomServerKey('lm-1')).toBe('sk-local-1');
        expect(getCustomServerKey('lm-2')).toBe('');

        setCustomServerKey('lm-2', 'k'.repeat(CUSTOM_KEY_MAX + 50));
        expect(getCustomServerKey('lm-2')).toHaveLength(CUSTOM_KEY_MAX);
        expect(getCustomServerKey('lm-1')).toBe('sk-local-1');
    });

    test('removing a key keeps the others, and the last one leaves no blob', () => {
        setCustomServerKey('lm-1', 'sk-one');
        setCustomServerKey('lm-2', 'sk-two');
        setCustomServerKey('lm-1', '   ');
        expect(
            JSON.parse(h.secureStore.get(CUSTOM_LLM_KEYS_SETTING_KEY)!),
        ).toEqual({ 'lm-2': 'sk-two' });
        setCustomServerKey('lm-2', '');
        expect(h.secureStore.has(CUSTOM_LLM_KEYS_SETTING_KEY)).toBe(false);
        expect(getCustomServerKey('lm-2')).toBe('');
    });

    test('an unreadable blob reads as no keys at all', () => {
        h.secureStore.set(CUSTOM_LLM_KEYS_SETTING_KEY, '{not json');
        expect(getCustomServerKey('lm-1')).toBe('');
        setCustomServerKey('lm-1', 'sk-new');
        expect(
            JSON.parse(h.secureStore.get(CUSTOM_LLM_KEYS_SETTING_KEY)!),
        ).toEqual({ 'lm-1': 'sk-new' });
    });
});

describe('the shared registry in a mounted list', () => {
    test('asks main for what it holds on mount and draws the shared rows', async () => {
        h.send.mockResolvedValue(genStatus([SHARED_SERVER], 7));
        await act(async () => {
            root.render(<RegistryProbeComp />);
        });
        await flush();
        expect(h.send).toHaveBeenCalledWith(LLM_REGISTRY_GET_CHANNEL);
        expect(readRegistryProbe()).toEqual({
            ids: ['registry-church:registry'],
            fetchedAt: 7,
        });
    });

    test('an edit of a SAVED server draws the registry list no more', async () => {
        h.send.mockResolvedValue(genStatus([SHARED_SERVER], 3));
        await act(async () => {
            root.render(<RegistryProbeComp />);
        });
        await flush();
        const countAfterLoad = registryCommitCount;
        expect(countAfterLoad).toBeGreaterThan(0);
        await act(async () => {
            setCustomServerKey('lm-1', 'sk-one');
            setCustomServers([
                { id: 'lm-1', name: 'LM Studio', baseUrl: '', models: [] },
            ]);
        });
        expect(registryCommitCount).toBe(countAfterLoad);
        expect(readRegistryProbe().fetchedAt).toBe(3);
    });

    test('a fresh read heard while mounted is drawn', async () => {
        h.send.mockResolvedValue(genStatus([], 1));
        await act(async () => {
            root.render(<RegistryProbeComp />);
        });
        await flush();
        expect(readRegistryProbe()).toEqual({ ids: [], fetchedAt: 1 });

        h.send.mockResolvedValue(genStatus([SHARED_SERVER], 9));
        await act(async () => {
            await loadLlmRegistry(true);
        });
        expect(readRegistryProbe()).toEqual({
            ids: ['registry-church:registry'],
            fetchedAt: 9,
        });
    });

    test('a status main could not give reads as no servers, no status', async () => {
        h.send.mockResolvedValue(undefined);
        expect(await loadLlmRegistry()).toBeNull();
    });
});

describe('new rows', () => {
    test('a new server is blank with an id of its own', () => {
        const first = genCustomServer();
        const second = genCustomServer();
        expect(first).toEqual({
            id: expect.stringMatching(UUID_PATTERN),
            name: '',
            baseUrl: '',
            models: [],
        });
        expect(second.id).not.toBe(first.id);
    });

    test('a model row carries the model and the name it was given', () => {
        expect(genCustomModelRow('qwen3.5:4b', 'Qwen')).toEqual({
            id: expect.stringMatching(UUID_PATTERN),
            model: 'qwen3.5:4b',
            name: 'Qwen',
        });
        expect(genCustomModelRow()).toMatchObject({ model: '', name: '' });
    });
});

describe('calls through the relay', () => {
    test('a call carries a fresh request id unless it was given one', async () => {
        h.send.mockResolvedValue({ ok: true, status: 200, text: '{}' });
        const answer = await requestCustomLlm({
            serverId: 'lm-1',
            method: 'GET',
            path: '/models',
        });
        expect(answer).toEqual({ ok: true, status: 200, text: '{}' });
        expect(h.send).toHaveBeenCalledWith(CUSTOM_LLM_FETCH_CHANNEL, {
            serverId: 'lm-1',
            method: 'GET',
            path: '/models',
            requestId: expect.stringMatching(UUID_PATTERN),
        });
        await requestCustomLlm(
            { serverId: 'lm-1', method: 'POST', path: '/chat', body: '{}' },
            'request-7',
        );
        expect(h.send).toHaveBeenLastCalledWith(CUSTOM_LLM_FETCH_CHANNEL, {
            serverId: 'lm-1',
            method: 'POST',
            path: '/chat',
            body: '{}',
            requestId: 'request-7',
        });
    });

    test('a cancel names the request it drops', () => {
        cancelCustomLlmRequest('request-7');
        expect(h.sendData).toHaveBeenCalledWith(CUSTOM_LLM_CANCEL_CHANNEL, {
            requestId: 'request-7',
        });
    });
});

describe('describeCustomLlmFailure, the rarer reasons', () => {
    test.each([
        ['timeout', 'the server took too long to answer'],
        ['ai-off', 'AI features are turned off in Settings'],
        ['unknown-server', 'this server is no longer in Settings'],
        ['bad-url', 'the server address is not a web address'],
        ['redirect', 'the server sent the request to another address'],
        ['too-large', 'the server answered with too much'],
        ['cancelled', 'stopped'],
        ['not-allowed', 'that call is not one the chatbot makes'],
    ])('%s reads as one phrase', (reason, expected) => {
        expect(
            describeCustomLlmFailure(
                { ok: false, reason, detail: '' } as any,
                'http://localhost:1234/v1',
            ),
        ).toBe(expected);
    });
});

describe('listCustomServerModels, a 2xx that is not a model list', () => {
    function genAnswer(text: string) {
        return {
            ok: true,
            status: 200,
            contentType: 'application/json',
            text,
        };
    }

    test('an answer that is not JSON is read as the wrong door', async () => {
        h.send.mockResolvedValue(genAnswer('<html>LM Studio</html>'));
        const answer = await listCustomServerModels({
            id: 'lm-1',
            name: 'LM Studio',
            baseUrl: 'http://localhost:1234/v1',
            models: [],
        });
        expect(answer).toEqual({
            ok: false,
            message:
                'the server did not answer with a model list — nothing at ' +
                'this address speaks the OpenAI API; the address usually ' +
                'ends in /v1 (Ollama: http://localhost:11434/v1, LM Studio: ' +
                'http://localhost:1234/v1)',
        });
        // The saved address, then its root: the `/v1` it already is.
        expect(
            h.send.mock.calls.map((call: any[]) => {
                return call[1].probeBaseUrl ?? '(saved)';
            }),
        ).toEqual(['(saved)', 'http://localhost:1234']);
    });

    test('JSON with no list is the wrong door too, and the next door answers', async () => {
        h.send.mockImplementation(async (_channel: string, request: any) => {
            if (request.probeBaseUrl === undefined) {
                return genAnswer(JSON.stringify({ object: 'list' }));
            }
            return genAnswer(
                JSON.stringify({
                    data: [
                        { id: ' qwen3.5:4b ' },
                        { id: 'qwen3.5:4b' },
                        { id: 'nomic-embed-text' },
                        { id: 42 },
                        null,
                    ],
                }),
            );
        });
        expect(
            await listCustomServerModels({
                id: 'ollama-1',
                name: 'Ollama',
                baseUrl: 'http://localhost:11434',
                models: [],
            }),
        ).toEqual({
            ok: true,
            models: ['qwen3.5:4b'],
            correctedBaseUrl: 'http://localhost:11434/v1',
        });
    });
});
