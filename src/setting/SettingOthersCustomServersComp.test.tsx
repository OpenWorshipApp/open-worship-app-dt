// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// A real store behind the helpers' names, so the panel reads back what it
// wrote -- the round trip is what is under test.
const h = vi.hoisted(() => ({
    servers: [] as any[],
    keys: {} as Record<string, string>,
    listeners: new Set<() => void>(),
    listModels: vi.fn(),
    readServerInfo: vi.fn(async () => null as any),
    nextId: 0,
    collapsedMap: new Map<string, boolean>(),
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});

vi.mock('../helper/ai/customServerHelpers', async () => {
    const react = await import('react');
    const protocol = await import('../../electron/customLlmProtocol');
    const genId = () => {
        h.nextId += 1;
        return `id-${h.nextId}`;
    };
    return {
        getCustomServers: () => h.servers,
        setCustomServers: (servers: any[]) => {
            h.servers = protocol.toValidCustomServers({ servers });
            for (const listener of h.listeners) {
                listener();
            }
        },
        useCustomServers: () => {
            const [servers, setServers] = react.useState(h.servers);
            react.useEffect(() => {
                const listener = () => {
                    setServers(h.servers);
                };
                h.listeners.add(listener);
                return () => {
                    h.listeners.delete(listener);
                };
            }, []);
            return servers;
        },
        getCustomServerKey: (serverId: string) => h.keys[serverId] ?? '',
        setCustomServerKey: (serverId: string, key: string) => {
            if (key) {
                h.keys[serverId] = key;
            } else {
                delete h.keys[serverId];
            }
        },
        genCustomServer: () => ({
            id: genId(),
            name: '',
            baseUrl: '',
            models: [],
        }),
        genCustomModelRow: (model = '', name = '') => ({
            id: genId(),
            model,
            name,
        }),
        listCustomServerModels: h.listModels,
        readCustomServerModelInfo: h.readServerInfo,
        findCustomModelInfo: (info: any, modelId: string) => {
            return info === null
                ? null
                : (info.infoMap.get(modelId) ?? info.commonInfo ?? null);
        },
        mergeCustomServerModels: (server: any, models: string[]) => {
            const known = new Set(server.models.map((one: any) => one.model));
            return {
                ...server,
                models: [
                    ...server.models,
                    ...models
                        .filter((model) => !known.has(model))
                        .map((model) => ({ id: genId(), model, name: '' })),
                ],
            };
        },
    };
});

// A real store behind the fold's names too: what is folded is read back.
vi.mock('./settingSectionFoldHelpers', () => ({
    toCustomServerFoldName: (serverId: string) => {
        return `ai-custom-server-${serverId}`;
    },
    getIsSettingSectionCollapsed: (foldName: string) => {
        return h.collapsedMap.get(foldName) ?? false;
    },
    saveIsSettingSectionCollapsed: (foldName: string, isCollapsed: boolean) => {
        h.collapsedMap.set(foldName, isCollapsed);
    },
    forgetIsSettingSectionCollapsed: (foldName: string) => {
        h.collapsedMap.delete(foldName);
    },
}));

import SettingOthersCustomServersComp from './SettingOthersCustomServersComp';

let container: HTMLDivElement;
let root: Root | null = null;

// A title that folds what it heads, by the words on it.
function findFoldButton(text: string) {
    return Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[aria-expanded]'),
    ).find((one) => {
        return one.textContent === text;
    }) as HTMLButtonElement;
}

function findButton(text: string) {
    return Array.from(container.querySelectorAll('button')).find((one) => {
        return (
            one.textContent?.trim() === text ||
            one.getAttribute('aria-label') === text
        );
    }) as HTMLButtonElement;
}

function findInputByLabel(text: string) {
    const label = Array.from(container.querySelectorAll('label')).find(
        (one) => {
            return one.textContent?.includes(text);
        },
    );
    // By id rather than a selector: React's ids hold colons, and jsdom has
    // no `CSS.escape` to quote them with.
    return document.getElementById(
        label?.getAttribute('for') ?? '',
    ) as HTMLInputElement;
}

async function typeAndLeave(input: HTMLInputElement, value: string) {
    await act(async () => {
        input.focus();
        input.value = value;
        input.blur();
    });
}

describe('SettingOthersCustomServersComp', () => {
    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        h.servers = [];
        h.keys = {};
        h.listeners.clear();
        h.listModels.mockReset();
        h.readServerInfo.mockReset();
        h.readServerInfo.mockResolvedValue(null);
        h.nextId = 0;
        h.collapsedMap.clear();
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(async () => {
        if (root) {
            await act(async () => root?.unmount());
            root = null;
        }
        container.remove();
    });

    async function render() {
        await act(async () => {
            root = createRoot(container);
            root.render(<SettingOthersCustomServersComp />);
        });
    }

    test('adds a server and saves its name and address on leaving each box', async () => {
        await render();
        await act(async () => findButton('Add server').click());
        expect(h.servers).toHaveLength(1);

        await typeAndLeave(findInputByLabel('Server name'), 'LM Studio');
        await typeAndLeave(
            findInputByLabel('Base URL'),
            'http://localhost:1234/v1',
        );

        expect(h.servers[0]).toMatchObject({
            name: 'LM Studio',
            baseUrl: 'http://localhost:1234/v1',
        });
        expect(container.textContent).toContain('LM Studio · Models: 0');
    });

    test('keeps the key out of the plain list', async () => {
        await render();
        await act(async () => findButton('Add server').click());
        await typeAndLeave(findInputByLabel('API key (optional)'), 'sk-local');

        expect(h.keys[h.servers[0].id]).toBe('sk-local');
        expect(JSON.stringify(h.servers)).not.toContain('sk-local');
    });

    test('adds, renames and removes a model row', async () => {
        h.servers = [
            {
                id: 'server-1',
                name: 'LM Studio',
                baseUrl: 'http://localhost:1234/v1',
                models: [],
            },
        ];
        await render();
        await act(async () => findButton('Add model').click());
        const [modelInput, nameInput] = Array.from(
            container.querySelectorAll<HTMLInputElement>(
                '.app-setting-others-model-row input',
            ),
        );
        await typeAndLeave(modelInput, 'phi-3.1-mini-128k-instruct');
        await typeAndLeave(nameInput, 'Phi 3.1 Mini 128k Instruct');

        expect(h.servers[0].models).toEqual([
            {
                id: expect.any(String),
                model: 'phi-3.1-mini-128k-instruct',
                name: 'Phi 3.1 Mini 128k Instruct',
            },
        ]);
        expect(container.textContent).toContain('Offered in the chatbot');

        await act(async () => findButton('Remove this model').click());
        expect(h.servers[0].models).toEqual([]);
    });

    test('Test says what the server answered, and Load merges its models', async () => {
        h.servers = [
            {
                id: 'server-1',
                name: 'LM Studio',
                baseUrl: 'http://localhost:1234/v1',
                models: [{ id: 'row-1', model: 'phi', name: 'Phi' }],
            },
        ];
        h.listModels.mockResolvedValue({ ok: true, models: ['phi', 'llama'] });
        await render();

        await act(async () => findButton('Test').click());
        expect(container.textContent).toContain(
            'The server answered. Chat models it has: 2',
        );

        await act(async () => findButton('Load models from server').click());
        // Kept with its id and name; the new one added after it.
        expect(h.servers[0].models).toEqual([
            { id: 'row-1', model: 'phi', name: 'Phi' },
            { id: expect.any(String), model: 'llama', name: '' },
        ]);
    });

    test('a test that fails says why, and a bad address is said before asking', async () => {
        h.servers = [
            {
                id: 'server-1',
                name: 'LM Studio',
                baseUrl: 'localhost:1234',
                models: [],
            },
        ];
        await render();
        await act(async () => findButton('Test').click());
        expect(container.textContent).toContain(
            'This is not a web address yet.',
        );
        expect(h.listModels).not.toHaveBeenCalled();

        h.servers = [{ ...h.servers[0], baseUrl: 'http://localhost:1234/v1' }];
        h.listModels.mockResolvedValue({
            ok: false,
            message: 'nothing answered at http://localhost:1234/v1',
        });
        await act(async () => findButton('Test').click());
        expect(container.textContent).toContain(
            'The server did not answer: nothing answered at http://localhost:1234/v1',
        );
    });

    test('deletes a server and its key together', async () => {
        h.servers = [
            {
                id: 'server-1',
                name: 'LM Studio',
                baseUrl: 'http://localhost:1234/v1',
                models: [],
            },
        ];
        h.keys = { 'server-1': 'sk-local' };
        await render();
        await act(async () => findButton('Delete this server').click());
        expect(h.servers).toEqual([]);
        expect(h.keys).toEqual({});
    });

    test('Test says what LM Studio has loaded, and warns of a small context', async () => {
        h.servers = [
            {
                id: 'server-1',
                name: 'LM Studio super-computer',
                baseUrl: 'http://super-computer:1237/v1',
                models: [
                    { id: 'row-1', model: 'qwen/qwen3.5-9b', name: '' },
                    { id: 'row-2', model: 'google/gemma-4-e4b', name: '' },
                    { id: 'row-3', model: 'qwen/qwen3.8-27b', name: '' },
                    { id: 'row-4', model: 'my-own', name: '' },
                ],
            },
        ];
        h.listModels.mockResolvedValue({ ok: true, models: [] });
        h.readServerInfo.mockResolvedValue({
            kind: 'lm-studio',
            infoMap: new Map([
                [
                    'qwen/qwen3.5-9b',
                    {
                        isLoaded: true,
                        loadedContext: 16384,
                        maxContext: 262144,
                        canSeeImages: true,
                    },
                ],
                [
                    'google/gemma-4-e4b',
                    {
                        isLoaded: false,
                        loadedContext: null,
                        maxContext: 131072,
                        canSeeImages: true,
                    },
                ],
                [
                    'qwen/qwen3.8-27b',
                    {
                        isLoaded: true,
                        loadedContext: 32768,
                        maxContext: 262144,
                        canSeeImages: true,
                    },
                ],
            ]),
        });
        await render();
        expect(container.textContent).not.toContain('Loaded in LM Studio');
        await act(async () => findButton('Test').click());
        const notes = Array.from(
            container.querySelectorAll('.app-setting-others-model-note'),
        ).map((one) => {
            return one.textContent;
        });
        expect(notes).toEqual([
            'Loaded in LM Studio. Context length: 16k. A follow-up question ' +
                'may not fit. In LM Studio, load this model again with a ' +
                'Context Length of 32k.',
            'Not loaded in LM Studio right now. The first question waits ' +
                'for it to load.',
            'Loaded in LM Studio. Context length: 32k.',
        ]);
    });

    test('says a context too small for the assistant is too small', async () => {
        h.servers = [
            {
                id: 'server-1',
                name: 'LM Studio',
                baseUrl: 'http://localhost:1234/v1',
                models: [{ id: 'row-1', model: 'phi', name: '' }],
            },
        ];
        h.listModels.mockResolvedValue({ ok: true, models: ['phi'] });
        h.readServerInfo.mockResolvedValue({
            kind: 'lm-studio',
            infoMap: new Map([
                [
                    'phi',
                    {
                        isLoaded: true,
                        loadedContext: 4096,
                        maxContext: 131072,
                        canSeeImages: false,
                    },
                ],
            ]),
        });
        await render();
        await act(async () => findButton('Test').click());
        expect(container.textContent).toContain(
            'Context length: 4k. That is too small for the assistant.',
        );
    });

    test('Test speaks in Ollama’s words for an Ollama server', async () => {
        h.servers = [
            {
                id: 'server-1',
                name: 'Ollama',
                baseUrl: 'http://localhost:11434/v1',
                models: [
                    { id: 'row-1', model: 'qwen3.5:4b', name: '' },
                    { id: 'row-2', model: 'llama3.2:3b', name: '' },
                ],
            },
        ];
        h.listModels.mockResolvedValue({ ok: true, models: [] });
        h.readServerInfo.mockResolvedValue({
            kind: 'ollama',
            infoMap: new Map([
                [
                    'qwen3.5:4b',
                    {
                        isLoaded: true,
                        loadedContext: 4096,
                        maxContext: 262144,
                        canSeeImages: true,
                    },
                ],
                [
                    'llama3.2:3b',
                    {
                        isLoaded: false,
                        loadedContext: null,
                        maxContext: 131072,
                        canSeeImages: false,
                    },
                ],
            ]),
        });
        await render();
        await act(async () => findButton('Test').click());
        const notes = Array.from(
            container.querySelectorAll('.app-setting-others-model-note'),
        ).map((one) => {
            return one.textContent;
        });
        expect(notes).toEqual([
            'Loaded in Ollama. Context length: 4k. That is too small for ' +
                'the assistant. In the Ollama app, set Settings → Context ' +
                'length to 32k.',
            'Not loaded in Ollama right now. The first question waits for ' +
                'it to load.',
        ]);
    });

    test('Test speaks in llama.cpp’s words, for every row of that server', async () => {
        h.servers = [
            {
                id: 'server-1',
                name: 'llama.cpp',
                baseUrl: 'http://localhost:8080/v1',
                models: [{ id: 'row-1', model: 'qwen3.5-4b.gguf', name: '' }],
            },
        ];
        h.listModels.mockResolvedValue({ ok: true, models: [] });
        h.readServerInfo.mockResolvedValue({
            kind: 'llama-cpp',
            infoMap: new Map(),
            commonInfo: {
                isLoaded: true,
                loadedContext: 4096,
                maxContext: null,
                canSeeImages: false,
            },
        });
        await render();
        await act(async () => findButton('Test').click());
        expect(
            container.querySelector('.app-setting-others-model-note')
                ?.textContent,
        ).toBe(
            'Loaded in llama.cpp. Context length: 4k. That is too small for ' +
                'the assistant. Start llama-server again with a context size ' +
                '(-c) of 32k.',
        );
    });

    test('Test saves the address the server really answered at, and says so', async () => {
        h.servers = [
            {
                id: 'server-1',
                name: 'Ollama',
                baseUrl: 'http://localhost:11434/v1/systemone',
                models: [{ id: 'row-1', model: 'qwen3.5:4b', name: '' }],
            },
        ];
        h.listModels.mockResolvedValue({
            ok: true,
            models: ['qwen3.5:4b'],
            correctedBaseUrl: 'http://localhost:11434/v1',
        });
        await render();
        await act(async () => findButton('Test').click());
        expect(h.servers[0].baseUrl).toBe('http://localhost:11434/v1');
        expect(container.textContent).toContain(
            'Address corrected to http://localhost:11434/v1. The server ' +
                'answered. Chat models it has: 1',
        );
        // The model state was then read at the corrected address.
        expect((h.readServerInfo.mock.calls[0] as any[])[0]).toMatchObject({
            baseUrl: 'http://localhost:11434/v1',
        });
    });

    test('"Sees pictures" is stored on the row, and only while ticked', async () => {
        h.servers = [
            {
                id: 'server-1',
                name: 'LM Studio',
                baseUrl: 'http://localhost:1234/v1',
                models: [{ id: 'row-1', model: 'qwen', name: '' }],
            },
        ];
        await render();
        const findBox = () => {
            return container.querySelector<HTMLInputElement>(
                '.app-setting-others-model-sees input',
            ) as HTMLInputElement;
        };
        expect(findBox().checked).toBe(false);
        await act(async () => findBox().click());
        expect(h.servers[0].models[0]).toEqual({
            id: 'row-1',
            model: 'qwen',
            name: '',
            canSeeImages: true,
        });
        expect(findBox().checked).toBe(true);
        await act(async () => findBox().click());
        expect(h.servers[0].models[0]).toEqual({
            id: 'row-1',
            model: 'qwen',
            name: '',
        });
    });

    test('a server folds to its name and model count, and keeps what a Test said', async () => {
        h.servers = [
            {
                id: 'server-1',
                name: 'LM Studio',
                baseUrl: 'http://localhost:1234/v1',
                models: [{ id: 'row-1', model: 'phi', name: 'Phi' }],
            },
        ];
        h.listModels.mockResolvedValue({ ok: true, models: ['phi', 'llama'] });
        await render();
        await act(async () => findButton('Test').click());
        // Open, the line under Test says it is offered; the title does not.
        expect(
            container.querySelector('[title="Offered in the chatbot"]'),
        ).toBeNull();

        await act(async () => {
            findFoldButton('LM Studio · Models: 1').click();
        });

        expect(findInputByLabel('Server name')).toBeNull();
        expect(findButton('Test')).toBeUndefined();
        expect(
            container.querySelector('.app-setting-others-model-row'),
        ).toBeNull();
        expect(container.textContent).not.toContain('The server answered');
        // What is left says which server it is, that it is offered, and can
        // still take it out.
        expect(container.textContent).toContain('LM Studio · Models: 1');
        expect(
            container.querySelector('[title="Offered in the chatbot"]'),
        ).not.toBeNull();
        expect(findButton('Delete this server')).toBeDefined();
        expect(h.collapsedMap.get('ai-custom-server-server-1')).toBe(true);

        await act(async () => {
            findFoldButton('LM Studio · Models: 1').click();
        });

        expect(findInputByLabel('Server name')).not.toBeNull();
        expect(container.textContent).toContain(
            'The server answered. Chat models it has: 2',
        );
    });

    test('a folded server that cannot be offered yet does not say it is', async () => {
        h.servers = [
            { id: 'server-1', name: 'LM Studio', baseUrl: '', models: [] },
        ];
        h.collapsedMap.set('ai-custom-server-server-1', true);

        await render();

        expect(findInputByLabel('Server name')).toBeNull();
        expect(
            container.querySelector('[title="Offered in the chatbot"]'),
        ).toBeNull();
    });

    test('the list of servers folds as one, Add server with it', async () => {
        h.servers = [
            {
                id: 'server-1',
                name: 'LM Studio',
                baseUrl: 'http://localhost:1234/v1',
                models: [{ id: 'row-1', model: 'phi', name: 'Phi' }],
            },
        ];
        await render();

        await act(async () => findFoldButton('Custom servers').click());

        expect(findButton('Add server')).toBeUndefined();
        expect(container.textContent).not.toContain('LM Studio');
        expect(h.collapsedMap.get('ai-custom-servers')).toBe(true);
        // One usable server is in there.
        expect(
            container.querySelector('[title="Offered in the chatbot"]'),
        ).not.toBeNull();

        await act(async () => findFoldButton('Custom servers').click());

        expect(findButton('Add server')).toBeDefined();
        expect(container.textContent).toContain('LM Studio · Models: 1');
    });

    test('a deleted server takes its fold with it', async () => {
        h.servers = [
            {
                id: 'server-1',
                name: 'LM Studio',
                baseUrl: 'http://localhost:1234/v1',
                models: [],
            },
        ];
        h.collapsedMap.set('ai-custom-server-server-1', true);
        await render();

        // Still on the folded row.
        await act(async () => findButton('Delete this server').click());

        expect(h.servers).toEqual([]);
        expect(h.collapsedMap.has('ai-custom-server-server-1')).toBe(false);
    });
});
