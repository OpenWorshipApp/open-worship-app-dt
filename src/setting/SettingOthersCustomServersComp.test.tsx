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
    readLmStudio: vi.fn(async () => null as Map<string, any> | null),
    nextId: 0,
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
        readLmStudioModels: h.readLmStudio,
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

import SettingOthersCustomServersComp from './SettingOthersCustomServersComp';

let container: HTMLDivElement;
let root: Root | null = null;

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
        h.readLmStudio.mockReset();
        h.readLmStudio.mockResolvedValue(null);
        h.nextId = 0;
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
        h.readLmStudio.mockResolvedValue(
            new Map([
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
        );
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
        h.readLmStudio.mockResolvedValue(
            new Map([
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
        );
        await render();
        await act(async () => findButton('Test').click());
        expect(container.textContent).toContain(
            'Context length: 4k. That is too small for the assistant.',
        );
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
});
