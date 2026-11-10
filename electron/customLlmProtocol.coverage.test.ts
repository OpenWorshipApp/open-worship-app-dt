import { describe, expect, test } from 'vitest';

import {
    MAX_CUSTOM_MODELS,
    findCustomModel,
    pickRegistryNote,
    toLlamaCppRouterModelInfoMap,
    toLmStudioModelInfoMap,
    toOllamaModelInfoMap,
    toValidCustomServers,
    toValidLlmRegistry,
} from './customLlmProtocol';

// The caps and skips on what a model server or a registry file says: each
// is read as untrusted, and a list that never ends must not fill memory.

const CAP = MAX_CUSTOM_MODELS * 4;

describe('a model list that goes on and on is cut at the cap', () => {
    test('LM Studio', () => {
        const data = Array.from({ length: CAP + 25 }, (_, index) => ({
            id: `model-${index}`,
            state: index === 0 ? 'loaded' : 'not-loaded',
            loaded_context_length: 8192,
            max_context_length: 32768,
            type: index === 1 ? 'vlm' : 'llm',
        }));

        const infoMap = toLmStudioModelInfoMap(JSON.stringify({ data }));

        expect(infoMap?.size).toBe(CAP);
        expect(infoMap?.has(`model-${CAP - 1}`)).toBe(true);
        expect(infoMap?.has(`model-${CAP}`)).toBe(false);
        expect(infoMap?.get('model-0')).toEqual({
            isLoaded: true,
            loadedContext: 8192,
            maxContext: 32768,
            canSeeImages: false,
        });
        expect(infoMap?.get('model-1')).toEqual({
            isLoaded: false,
            loadedContext: null,
            maxContext: 32768,
            canSeeImages: true,
        });
    });

    test('Ollama', () => {
        const models = Array.from({ length: CAP + 3 }, (_, index) => ({
            name: `llama-${index}:latest`,
            model: `llama-${index}:latest`,
        }));

        const infoMap = toOllamaModelInfoMap(JSON.stringify({ models }), null);

        expect(infoMap?.size).toBe(CAP);
        expect(infoMap?.has(`llama-${CAP}:latest`)).toBe(false);
    });

    test('a llama.cpp router', () => {
        const data = Array.from({ length: CAP + 3 }, (_, index) => ({
            id: `gguf-${index}`,
            status: { value: 'unloaded', args: ['--port', '0'] },
        }));

        const infoMap = toLlamaCppRouterModelInfoMap(JSON.stringify({ data }));

        expect(infoMap?.size).toBe(CAP);
        expect(infoMap?.has(`gguf-${CAP}`)).toBe(false);
    });
});

describe('a llama.cpp router’s start arguments', () => {
    test('a loaded model with no context argument says no size', () => {
        const infoMap = toLlamaCppRouterModelInfoMap(
            JSON.stringify({
                data: [
                    {
                        id: 'qwen',
                        status: {
                            value: 'loaded',
                            args: ['--port', '8081', 42, '--mmproj', 'p.gguf'],
                        },
                    },
                    {
                        id: 'phi',
                        status: { value: 'loaded', args: ['-c', '16384'] },
                    },
                ],
            }),
        );

        expect(infoMap?.get('qwen')).toEqual({
            isLoaded: true,
            loadedContext: null,
            maxContext: null,
            canSeeImages: true,
        });
        expect(infoMap?.get('phi')?.loadedContext).toBe(16384);
    });
});

describe('a saved server’s models, read as untrusted', () => {
    test('a models field that is no list holds none', () => {
        const [server] = toValidCustomServers({
            servers: [
                {
                    id: 'server-1',
                    name: 'LM Studio',
                    baseUrl: 'http://localhost:1234/v1',
                    models: 'phi',
                },
            ],
        });

        expect(server.models).toEqual([]);
    });

    test('a row with no id, a bad id or a repeated id is dropped', () => {
        const [server] = toValidCustomServers({
            servers: [
                {
                    id: 'server-1',
                    name: 'LM Studio',
                    baseUrl: 'http://localhost:1234/v1',
                    models: [
                        { id: 'row-1', model: 'phi', name: 'Phi' },
                        { id: 'row-1', model: 'copy', name: 'Copy' },
                        { id: 'has spaces', model: 'x' },
                        { model: 'no-id' },
                        null,
                        { id: 'row-2', model: ' qwen ', canSeeImages: true },
                    ],
                },
            ],
        });

        expect(server.models).toEqual([
            { id: 'row-1', model: 'phi', name: 'Phi' },
            { id: 'row-2', model: 'qwen', name: '', canSeeImages: true },
        ]);
    });
});

describe('the shared registry’s models', () => {
    function genRegistry(models: unknown) {
        return {
            version: 1,
            servers: [
                {
                    id: 'hall',
                    name: 'Hall',
                    baseUrl: 'https://hall.example/v1',
                    models,
                },
            ],
        };
    }

    test('a row that names no model is skipped, and row ids follow the kept rows', () => {
        const registry = toValidLlmRegistry(
            genRegistry([
                { model: '   ' },
                { name: 'nameless' },
                null,
                { model: 'qwen3:8b', name: 'Qwen' },
            ]),
        );

        expect(registry?.servers[0].models).toEqual([
            { id: 'm0-qwen3-8b', model: 'qwen3:8b', name: 'Qwen' },
        ]);
    });

    test('a registry server offers at most the cap of models', () => {
        const registry = toValidLlmRegistry(
            genRegistry(
                Array.from({ length: MAX_CUSTOM_MODELS + 5 }, (_, index) => ({
                    model: `model-${index}`,
                })),
            ),
        );

        const models = registry?.servers[0].models ?? [];
        expect(models).toHaveLength(MAX_CUSTOM_MODELS);
        expect(models.at(-1)?.model).toBe(`model-${MAX_CUSTOM_MODELS - 1}`);
    });
});

describe('small lookups', () => {
    test('a note with nothing in it says nothing', () => {
        expect(pickRegistryNote({}, 'yy')).toBe('');
        expect(pickRegistryNote(undefined, 'yy')).toBe('');
        expect(pickRegistryNote({ xx: 'Welcome ✝' }, 'yy')).toBe('Welcome ✝');
    });

    test('a model id that is no model id finds nothing', () => {
        const servers = toValidCustomServers({
            servers: [
                {
                    id: 'server-1',
                    name: 'LM Studio',
                    baseUrl: 'http://localhost:1234/v1',
                    models: [{ id: 'row-1', model: 'phi', name: '' }],
                },
            ],
        });

        expect(findCustomModel(servers, 'server-1/row-1')).toMatchObject({
            row: { model: 'phi' },
        });
        expect(findCustomModel(servers, 'phi')).toBeNull();
        expect(findCustomModel(servers, 42)).toBeNull();
        expect(findCustomModel(servers, 'server-1/row-1/extra')).toBeNull();
    });
});
