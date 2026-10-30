// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    homeStore: new Map<string, string>(),
    secureStore: new Map<string, string>(),
    send: vi.fn(),
    sendData: vi.fn(),
    removeSecure: vi.fn(),
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
            h.removeSecure(key);
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
    describeCustomLlmFailure,
    genCustomServer,
    getCustomServerKey,
    getCustomServers,
    listCustomServerModels,
    loadLlmRegistry,
    setCustomServerKey,
    setCustomServers,
    useCustomServers,
    useLlmRegistry,
} from './customServerHelpers';
import {
    CUSTOM_KEY_MAX,
    CUSTOM_LLM_KEYS_SETTING_KEY,
    CUSTOM_LLM_SERVERS_SETTING_KEY,
    LLM_REGISTRY_GET_CHANNEL,
    type CustomServerType,
} from '../../../electron/customLlmProtocol';

function genServer(value: Partial<CustomServerType> = {}): CustomServerType {
    return {
        id: 'server-1',
        name: 'LM Studio',
        baseUrl: 'http://localhost:1234/v1',
        models: [{ id: 'row-1', model: 'qwen/qwen3.5-9b', name: 'Qwen' }],
        ...value,
    };
}

beforeEach(() => {
    h.homeStore.clear();
    h.secureStore.clear();
});

describe('the saved servers', () => {
    test('are written as validated JSON and read back fresh', () => {
        setCustomServers([
            genServer(),
            // An id that could never be a storage key is not kept.
            genServer({ id: 'not a valid id!' }),
        ]);
        const stored = JSON.parse(
            h.homeStore.get(CUSTOM_LLM_SERVERS_SETTING_KEY) ?? '{}',
        );
        expect(stored.servers.map((one: CustomServerType) => one.id)).toEqual([
            'server-1',
        ]);
        expect(getCustomServers()).toEqual([genServer()]);
    });

    test('a new row is blank with an id of its own', () => {
        const first = genCustomServer();
        const second = genCustomServer();
        expect(first).toMatchObject({ name: '', baseUrl: '', models: [] });
        expect(first.id).toMatch(/^[0-9a-f-]{36}$/);
        expect(second.id).not.toBe(first.id);
    });
});

describe('the encrypted server keys', () => {
    test('a key is trimmed, capped and kept per server', () => {
        setCustomServerKey('server-1', '  sk-local  ');
        setCustomServerKey('server-2', 'k'.repeat(CUSTOM_KEY_MAX + 10));
        expect(getCustomServerKey('server-1')).toBe('sk-local');
        expect(getCustomServerKey('server-2')).toHaveLength(CUSTOM_KEY_MAX);
        expect(getCustomServerKey('server-3')).toBe('');
        expect(
            JSON.parse(h.secureStore.get(CUSTOM_LLM_KEYS_SETTING_KEY) ?? '{}'),
        ).toEqual({
            'server-1': 'sk-local',
            'server-2': 'k'.repeat(CUSTOM_KEY_MAX),
        });
    });

    test('an emptied key is removed, and the last one leaves no blob', () => {
        setCustomServerKey('server-1', 'a');
        setCustomServerKey('server-2', 'b');
        setCustomServerKey('server-1', '   ');
        expect(getCustomServerKey('server-1')).toBe('');
        expect(getCustomServerKey('server-2')).toBe('b');
        expect(h.removeSecure).not.toHaveBeenCalled();

        setCustomServerKey('server-2', '');
        expect(h.removeSecure).toHaveBeenCalledWith(
            CUSTOM_LLM_KEYS_SETTING_KEY,
        );
        expect(h.secureStore.has(CUSTOM_LLM_KEYS_SETTING_KEY)).toBe(false);
    });

    test('a store that cannot be read holds no keys', () => {
        h.secureStore.set(CUSTOM_LLM_KEYS_SETTING_KEY, '{not json');
        expect(getCustomServerKey('server-1')).toBe('');
    });
});

describe('describeCustomLlmFailure, every other reason', () => {
    const cases: [string, string][] = [
        ['timeout', 'the server took too long to answer'],
        ['ai-off', 'AI features are turned off in Settings'],
        ['unknown-server', 'this server is no longer in Settings'],
        ['bad-url', 'the server address is not a web address'],
        ['redirect', 'the server sent the request to another address'],
        ['too-large', 'the server answered with too much'],
        ['cancelled', 'stopped'],
        ['something-new', 'that call is not one the chatbot makes'],
    ];
    test.each(cases)('%s reads as a phrase', (reason, expected) => {
        expect(
            describeCustomLlmFailure(
                { ok: false, reason: reason as any, detail: '' },
                'http://localhost:1234/v1',
            ),
        ).toBe(expected);
    });
});

describe('listCustomServerModels when the answer is not a model list', () => {
    test('a page that is not JSON is the wrong door at every address', async () => {
        h.send.mockResolvedValue({ ok: true, status: 200, text: '<html>' });
        const answer = await listCustomServerModels(genServer());
        expect(answer).toEqual({
            ok: false,
            message: expect.stringMatching(
                /^the server did not answer with a model list — nothing at this address speaks the OpenAI API/,
            ),
        });
    });

    test('JSON without a data list is no model list either', async () => {
        h.send.mockResolvedValue({
            ok: true,
            status: 200,
            text: JSON.stringify({ models: ['a'] }),
        });
        const answer = await listCustomServerModels(genServer());
        expect(answer.ok).toBe(false);
        expect((answer as { message: string }).message).toMatch(
            /^the server did not answer with a model list/,
        );
    });
});

describe('the hooks', () => {
    let host: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        host = document.createElement('div');
        document.body.append(host);
        root = createRoot(host);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        host.remove();
        vi.unstubAllGlobals();
    });

    test('useCustomServers redraws on a save and stops listening on unmount', async () => {
        const seen: string[][] = [];
        function ProbeComp() {
            seen.push(useCustomServers().map((one) => one.name));
            return null;
        }
        setCustomServers([genServer({ name: 'Before' })]);
        await act(async () => root.render(<ProbeComp />));
        expect(seen.at(-1)).toEqual(['Before']);

        await act(async () => {
            setCustomServers([genServer({ name: 'After' })]);
        });
        expect(seen.at(-1)).toEqual(['After']);

        await act(async () => root.unmount());
        const renderCount = seen.length;
        setCustomServers([genServer({ name: 'Unheard' })]);
        expect(seen).toHaveLength(renderCount);
        root = createRoot(host);
    });

    test('useLlmRegistry asks main once and redraws only when the registry moved', async () => {
        const status = {
            url: 'https://www.openworship.app/llm/info.json',
            servers: [genServer({ id: 'registry-a', name: 'Shared A' })],
            fetchedAt: 1,
            error: null,
        };
        h.send.mockResolvedValue(status);
        const seen: ReturnType<typeof useLlmRegistry>[] = [];
        function ProbeComp() {
            seen.push(useLlmRegistry());
            return null;
        }
        await act(async () => root.render(<ProbeComp />));
        expect(h.send).toHaveBeenCalledWith(LLM_REGISTRY_GET_CHANNEL);
        const loaded = seen.at(-1)!;
        expect(loaded.servers.map((one) => one.name)).toEqual(['Shared A']);
        expect(loaded.servers[0].source).toBe('registry');
        expect(loaded.status).toBe(status);

        // A saved server's edit is heard, but nothing of the registry moved:
        // the state stays the very same object, so nothing below redraws.
        await act(async () => {
            setCustomServers([genServer()]);
        });
        expect(seen.at(-1)).toBe(loaded);

        const reloaded = {
            ...status,
            servers: [genServer({ id: 'registry-b', name: 'Shared B' })],
            fetchedAt: 2,
        };
        h.send.mockResolvedValue(reloaded);
        await act(async () => {
            await loadLlmRegistry(true);
        });
        expect(seen.at(-1)).not.toBe(loaded);
        expect(seen.at(-1)?.servers.map((one) => one.name)).toEqual([
            'Shared B',
        ]);
        expect(seen.at(-1)?.status).toBe(reloaded);
    });
});
