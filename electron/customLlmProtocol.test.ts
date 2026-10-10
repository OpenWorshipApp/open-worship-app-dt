import { describe, expect, it } from 'vitest';

import {
    CUSTOM_CONTEXT_COMFORTABLE,
    CUSTOM_CONTEXT_MIN,
    CustomServerError,
    LLAMA_CPP_PROPS_PATH,
    LM_STUDIO_MODELS_PATH,
    MAX_CUSTOM_MODELS,
    MAX_CUSTOM_SERVERS,
    OLLAMA_PS_PATH,
    OLLAMA_TAGS_PATH,
    checkIsAllowedCustomLlmCall,
    checkIsCustomServerError,
    checkIsLocalNetworkUrl,
    checkIsLoopbackUrl,
    checkIsSameOrigin,
    genCustomServerAddressCandidates,
    toContextLabel,
    toCustomLlmCallUrl,
    toCustomServerKindLabel,
    toLlamaCppModelInfo,
    toLmStudioModelInfoMap,
    toOllamaModelInfoMap,
    checkIsUsableCustomServer,
    decodeCustomModel,
    encodeCustomModel,
    findCustomModel,
    toCustomModelLabel,
    toCustomServerBaseUrl,
    toCustomServersText,
    toValidCustomServerKeys,
    toValidCustomServers,
    type CustomServerType,
} from './customLlmProtocol';

const SERVER_ID = '11111111-2222-3333-4444-555555555555';
const ROW_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function genServer(value: Partial<CustomServerType> = {}): CustomServerType {
    return {
        id: SERVER_ID,
        name: 'LM Studio',
        baseUrl: 'http://localhost:1234/v1',
        models: [{ id: ROW_ID, model: 'phi-3.1-mini-128k-instruct', name: '' }],
        ...value,
    };
}

describe('toCustomServerBaseUrl', () => {
    it('keeps an http or https address, without its trailing slash', () => {
        expect(toCustomServerBaseUrl(' http://localhost:1234/v1/ ')).toBe(
            'http://localhost:1234/v1',
        );
        expect(toCustomServerBaseUrl('https://api.example.com/v1')).toBe(
            'https://api.example.com/v1',
        );
        expect(toCustomServerBaseUrl('http://192.168.1.20:11434')).toBe(
            'http://192.168.1.20:11434',
        );
    });

    // A key goes in the key box, where it is encrypted; another scheme is not
    // a server; a query or a fragment would be mangled by the SDK's paths.
    it('refuses what is not a plain web address', () => {
        for (const value of [
            '',
            'localhost:1234',
            'file:///C:/setting.json',
            'javascript:alert(1)',
            'ftp://example.com',
            'http://user:pass@localhost:1234/v1',
            'http://localhost:1234/v1?x=1',
            'http://localhost:1234/v1#top',
            `http://example.com/${'a'.repeat(600)}`,
            42,
            null,
        ]) {
            expect(toCustomServerBaseUrl(value)).toBeNull();
        }
    });
});

describe('checkIsLoopbackUrl', () => {
    it('is this computer and nothing else', () => {
        expect(checkIsLoopbackUrl('http://localhost:1234/v1')).toBe(true);
        expect(checkIsLoopbackUrl('http://127.0.0.1:1234/v1')).toBe(true);
        expect(checkIsLoopbackUrl('http://[::1]:1234/v1')).toBe(true);
        expect(checkIsLoopbackUrl('http://192.168.1.20:1234/v1')).toBe(false);
        expect(checkIsLoopbackUrl('https://api.example.com/v1')).toBe(false);
        expect(checkIsLoopbackUrl('not a url')).toBe(false);
    });
});

describe('checkIsLocalNetworkUrl', () => {
    it('is this computer or a machine on the same network', () => {
        for (const value of [
            'http://localhost:1234/v1',
            // A bare machine name, the way the user's LM Studio box is named.
            'http://super-computer:1237/v1',
            'http://192.168.1.12:1234/v1',
            'http://10.0.0.5:11434',
            'http://172.20.1.1:8080/v1',
            'http://100.101.102.103:1234/v1',
            'http://gpu-box.local:1234/v1',
            'http://studio.lan:1234/v1',
            'http://box.home.arpa:1234/v1',
            'http://[fd12:3456::1]:1234/v1',
            'http://[fe80::1]:1234/v1',
        ]) {
            expect(checkIsLocalNetworkUrl(value)).toBe(true);
        }
    });

    it('is never a service out on the internet', () => {
        for (const value of [
            'https://api.example.com/v1',
            'https://openrouter.ai/api/v1',
            'http://8.8.8.8/v1',
            'http://172.32.0.1/v1',
            'http://192.169.1.1/v1',
            'http://[2001:db8::1]/v1',
            'not a url',
        ]) {
            expect(checkIsLocalNetworkUrl(value)).toBe(false);
        }
    });
});

describe('toCustomLlmCallUrl', () => {
    it('puts the chat calls under the base URL', () => {
        expect(
            toCustomLlmCallUrl('http://localhost:1234/v1', '/chat/completions'),
        ).toBe('http://localhost:1234/v1/chat/completions');
    });

    it('asks LM Studio’s own list at the root of a /v1 address only', () => {
        expect(
            toCustomLlmCallUrl(
                'http://super-computer:1237/v1',
                LM_STUDIO_MODELS_PATH,
            ),
        ).toBe('http://super-computer:1237/api/v0/models');
        expect(
            toCustomLlmCallUrl(
                'https://example.com/team/v1',
                LM_STUDIO_MODELS_PATH,
            ),
        ).toBeNull();
        // A bare address IS the server's root: llama.cpp and LiteLLM answer
        // the protocol there, so Test keeps it as typed.
        expect(
            toCustomLlmCallUrl('http://localhost:11434', LM_STUDIO_MODELS_PATH),
        ).toBe('http://localhost:11434/api/v0/models');
        expect(
            toCustomLlmCallUrl(
                'http://localhost:11434/api',
                LM_STUDIO_MODELS_PATH,
            ),
        ).toBeNull();
    });

    it('asks Ollama’s own two lists at the root of a /v1 address too', () => {
        expect(
            toCustomLlmCallUrl('http://localhost:11434/v1', OLLAMA_TAGS_PATH),
        ).toBe('http://localhost:11434/api/tags');
        expect(
            toCustomLlmCallUrl('http://localhost:11434/v1', OLLAMA_PS_PATH),
        ).toBe('http://localhost:11434/api/ps');
        expect(
            toCustomLlmCallUrl('http://localhost:11434/api', OLLAMA_PS_PATH),
        ).toBeNull();
    });
});

describe('genCustomServerAddressCandidates', () => {
    it('offers the same server’s usual paths, best first, never another host', () => {
        // Ollama typed as its own `/v1/systemone` door (2026-10-10).
        expect(
            genCustomServerAddressCandidates(
                'http://localhost:11434/v1/systemone',
            ),
        ).toEqual([
            'http://localhost:11434/v1',
            'http://localhost:11434/v1/systemone/v1',
            'http://localhost:11434',
        ]);
        // Ollama's root, as its docs write the server address.
        expect(
            genCustomServerAddressCandidates('http://localhost:11434'),
        ).toEqual(['http://localhost:11434/v1']);
        // Behind a proxy's path: that path's own `/v1` is a guess too.
        expect(
            genCustomServerAddressCandidates('https://example.com/team/'),
        ).toEqual([
            'https://example.com/v1',
            'https://example.com/team/v1',
            'https://example.com',
        ]);
        // The address itself is never a candidate.
        expect(
            genCustomServerAddressCandidates('http://localhost:1234/v1'),
        ).toEqual(['http://localhost:1234']);
        expect(genCustomServerAddressCandidates('localhost:1234')).toEqual([]);
        for (const candidate of genCustomServerAddressCandidates(
            'http://super-computer:1237/v1/x',
        )) {
            expect(
                checkIsSameOrigin(candidate, 'http://super-computer:1237/v1/x'),
            ).toBe(true);
        }
    });

    it('tells one origin from another by scheme, host and port', () => {
        expect(
            checkIsSameOrigin(
                'http://localhost:11434/v1',
                'http://localhost:11434',
            ),
        ).toBe(true);
        expect(
            checkIsSameOrigin(
                'http://localhost:11434/v1',
                'http://localhost:1234/v1',
            ),
        ).toBe(false);
        expect(
            checkIsSameOrigin(
                'http://localhost:11434',
                'https://localhost:11434',
            ),
        ).toBe(false);
        expect(checkIsSameOrigin('nope', 'http://localhost:11434')).toBe(false);
    });
});

describe('toOllamaModelInfoMap', () => {
    // Trimmed from what Ollama 0.40 answered on 2026-10-10.
    const TAGS_TEXT = JSON.stringify({
        models: [
            {
                name: 'tev1:4b',
                model: 'tev1:4b',
                details: { family: 'qwen35', context_length: 262144 },
                capabilities: ['decision'],
            },
            {
                name: 'qwen3.5:4b',
                model: 'qwen3.5:4b',
                details: { context_length: 262144 },
                capabilities: ['completion', 'tools', 'vision', 'thinking'],
            },
            { name: '', model: '' },
            'junk',
        ],
    });
    const PS_TEXT = JSON.stringify({
        models: [{ name: 'tev1:4b', model: 'tev1:4b', context_length: 2050 }],
    });

    it('says which models are loaded, how big, and which ones see', () => {
        const infoMap = toOllamaModelInfoMap(TAGS_TEXT, PS_TEXT);
        expect(infoMap?.get('tev1:4b')).toEqual({
            isLoaded: true,
            loadedContext: 2050,
            maxContext: 262144,
            canSeeImages: false,
        });
        expect(infoMap?.get('qwen3.5:4b')).toEqual({
            isLoaded: false,
            loadedContext: null,
            maxContext: 262144,
            canSeeImages: true,
        });
        expect(infoMap?.size).toBe(2);
    });

    it('takes a missing or odd second list as nothing loaded', () => {
        expect(toOllamaModelInfoMap(TAGS_TEXT, null)?.get('tev1:4b')).toEqual({
            isLoaded: false,
            loadedContext: null,
            maxContext: 262144,
            canSeeImages: false,
        });
        expect(
            toOllamaModelInfoMap(TAGS_TEXT, '<html>')?.get('tev1:4b')?.isLoaded,
        ).toBe(false);
    });

    it('is null for anything that is not Ollama’s list', () => {
        expect(toOllamaModelInfoMap('<html>', null)).toBeNull();
        expect(toOllamaModelInfoMap('{"data":[]}', null)).toBeNull();
    });

    it('names the program for a sentence', () => {
        expect(toCustomServerKindLabel('lm-studio')).toBe('LM Studio');
        expect(toCustomServerKindLabel('ollama')).toBe('Ollama');
        expect(toCustomServerKindLabel('llama-cpp')).toBe('llama.cpp');
        expect(toCustomServerKindLabel('other')).toBe('the server');
    });
});

describe('toLlamaCppModelInfo', () => {
    it('reads the context each slot was started with, and the projector', () => {
        expect(
            toLlamaCppModelInfo(
                JSON.stringify({
                    default_generation_settings: { id: 0, n_ctx: 4096 },
                    total_slots: 1,
                    model_path: '/models/qwen3.5-4b.gguf',
                    modalities: { vision: true, audio: false },
                }),
            ),
        ).toEqual({
            isLoaded: true,
            loadedContext: 4096,
            maxContext: null,
            canSeeImages: true,
        });
        // An older llamafile says less.
        expect(
            toLlamaCppModelInfo(
                JSON.stringify({
                    default_generation_settings: { n_ctx: 512 },
                    total_slots: 1,
                }),
            ),
        ).toEqual({
            isLoaded: true,
            loadedContext: 512,
            maxContext: null,
            canSeeImages: false,
        });
    });

    it('is null for anything that is not that answer', () => {
        expect(toLlamaCppModelInfo('<html>')).toBeNull();
        expect(toLlamaCppModelInfo('{"data":[]}')).toBeNull();
        expect(toLlamaCppModelInfo('{"version":"0.40.2"}')).toBeNull();
    });
});

describe('toLmStudioModelInfoMap', () => {
    // Trimmed from what LM Studio 0.4 answered on 2026-10-09.
    const TEXT = JSON.stringify({
        object: 'list',
        data: [
            {
                id: 'qwen/qwen3.5-9b',
                type: 'vlm',
                state: 'loaded',
                max_context_length: 262144,
                loaded_context_length: 16384,
            },
            {
                id: 'meta/muse-glimmer',
                type: 'llm',
                state: 'not-loaded',
                max_context_length: 131072,
            },
            { id: '', type: 'llm' },
            'junk',
        ],
    });

    it('says which models are loaded, how big, and which ones see', () => {
        const infoMap = toLmStudioModelInfoMap(TEXT);
        expect(infoMap?.get('qwen/qwen3.5-9b')).toEqual({
            isLoaded: true,
            loadedContext: 16384,
            maxContext: 262144,
            canSeeImages: true,
        });
        expect(infoMap?.get('meta/muse-glimmer')).toEqual({
            isLoaded: false,
            loadedContext: null,
            maxContext: 131072,
            canSeeImages: false,
        });
        expect(infoMap?.size).toBe(2);
    });

    it('is null for anything that is not that list', () => {
        expect(toLmStudioModelInfoMap('<html>')).toBeNull();
        expect(toLmStudioModelInfoMap('{"models":[]}')).toBeNull();
    });

    it('writes a context the way LM Studio does', () => {
        expect(toContextLabel(16384)).toBe('16k');
        expect(toContextLabel(CUSTOM_CONTEXT_COMFORTABLE)).toBe('32k');
        expect(CUSTOM_CONTEXT_MIN).toBeLessThan(CUSTOM_CONTEXT_COMFORTABLE);
    });
});

describe('toValidCustomServers', () => {
    it('reads the stored text back, keeping a half-filled server to finish', () => {
        const half = genServer({ baseUrl: 'localhost', models: [] });
        expect(toValidCustomServers(toCustomServersText([half]))).toEqual([
            half,
        ]);
    });

    it('keeps "sees pictures" only when it is true', () => {
        const [server] = toValidCustomServers({
            servers: [
                genServer({
                    models: [
                        {
                            id: 'a',
                            model: 'qwen',
                            name: '',
                            canSeeImages: true,
                        },
                        {
                            id: 'b',
                            model: 'phi',
                            name: '',
                            canSeeImages: 'yes' as any,
                        },
                    ],
                }),
            ],
        });
        expect(server.models[0].canSeeImages).toBe(true);
        expect(server.models[1]).toEqual({ id: 'b', model: 'phi', name: '' });
    });

    it('copies only the listed fields, drops bad ids and duplicates', () => {
        const servers = toValidCustomServers({
            servers: [
                { ...genServer(), extra: 'smuggled', dataUrl: 'x' },
                genServer(),
                { ...genServer(), id: '../../etc' },
                'not a server',
            ],
        });
        expect(servers).toHaveLength(1);
        expect(Object.keys(servers[0]).sort()).toEqual([
            'baseUrl',
            'id',
            'models',
            'name',
        ]);
    });

    it('caps the servers and the models', () => {
        const models = Array.from({ length: MAX_CUSTOM_MODELS + 5 }, (_, i) => {
            return { id: `row-${i}`, model: `m${i}`, name: '' };
        });
        const servers = toValidCustomServers({
            servers: Array.from({ length: MAX_CUSTOM_SERVERS + 3 }, (_, i) => {
                return genServer({ id: `server-${i}`, models });
            }),
        });
        expect(servers).toHaveLength(MAX_CUSTOM_SERVERS);
        expect(servers[0].models).toHaveLength(MAX_CUSTOM_MODELS);
    });

    it('reads garbage as no servers rather than throwing', () => {
        expect(toValidCustomServers('not json')).toEqual([]);
        expect(toValidCustomServers(null)).toEqual([]);
        expect(toValidCustomServers({ servers: 'x' })).toEqual([]);
    });
});

describe('toValidCustomServerKeys', () => {
    it('keeps a key per known-shaped id, blanks dropped', () => {
        expect(
            toValidCustomServerKeys(
                JSON.stringify({
                    [SERVER_ID]: ' sk-1 ',
                    other: '',
                    '../x': 'y',
                }),
            ),
        ).toEqual({ [SERVER_ID]: 'sk-1' });
        expect(toValidCustomServerKeys('[1,2]')).toEqual({});
        expect(toValidCustomServerKeys('nope')).toEqual({});
    });
});

describe('checkIsUsableCustomServer', () => {
    it('needs a name, a usable address and a model', () => {
        expect(checkIsUsableCustomServer(genServer())).toBe(true);
        expect(checkIsUsableCustomServer(genServer({ name: '' }))).toBe(false);
        expect(
            checkIsUsableCustomServer(genServer({ baseUrl: 'localhost:1234' })),
        ).toBe(false);
        expect(
            checkIsUsableCustomServer(
                genServer({ models: [{ id: ROW_ID, model: '', name: 'x' }] }),
            ),
        ).toBe(false);
    });
});

describe('the chatbot model id', () => {
    it('is the server and the row, and finds both back', () => {
        const value = encodeCustomModel(SERVER_ID, ROW_ID);
        expect(decodeCustomModel(value)).toEqual({
            serverId: SERVER_ID,
            rowId: ROW_ID,
        });
        const found = findCustomModel([genServer()], value);
        expect(found?.row.model).toBe('phi-3.1-mini-128k-instruct');
        expect(toCustomModelLabel(found!.row)).toBe(
            'phi-3.1-mini-128k-instruct',
        );
    });

    it('is nothing for a deleted row, a deleted server or another shape', () => {
        expect(
            findCustomModel(
                [genServer({ models: [] })],
                `${SERVER_ID}/${ROW_ID}`,
            ),
        ).toBeNull();
        expect(findCustomModel([], `${SERVER_ID}/${ROW_ID}`)).toBeNull();
        expect(decodeCustomModel('gpt-5')).toBeNull();
        expect(decodeCustomModel('a/b/c')).toBeNull();
        expect(decodeCustomModel(undefined)).toBeNull();
    });

    it('shows the name when there is one', () => {
        expect(
            toCustomModelLabel({ id: ROW_ID, model: 'phi', name: 'Phi Mini' }),
        ).toBe('Phi Mini');
    });
});

describe('the relay calls', () => {
    it('are the two the chatbot makes and no other', () => {
        expect(checkIsAllowedCustomLlmCall('GET', '/models')).toBe(true);
        expect(checkIsAllowedCustomLlmCall('POST', '/chat/completions')).toBe(
            true,
        );
        expect(checkIsAllowedCustomLlmCall('GET', LM_STUDIO_MODELS_PATH)).toBe(
            true,
        );
        expect(checkIsAllowedCustomLlmCall('GET', OLLAMA_TAGS_PATH)).toBe(true);
        expect(checkIsAllowedCustomLlmCall('GET', OLLAMA_PS_PATH)).toBe(true);
        expect(checkIsAllowedCustomLlmCall('GET', LLAMA_CPP_PROPS_PATH)).toBe(
            true,
        );
        // llama.cpp's doors that change the server.
        expect(checkIsAllowedCustomLlmCall('POST', LLAMA_CPP_PROPS_PATH)).toBe(
            false,
        );
        expect(checkIsAllowedCustomLlmCall('POST', '/slots')).toBe(false);
        // Ollama's doors that pull, copy, load or delete a model.
        expect(checkIsAllowedCustomLlmCall('POST', '/api/pull')).toBe(false);
        expect(checkIsAllowedCustomLlmCall('POST', '/api/generate')).toBe(
            false,
        );
        expect(checkIsAllowedCustomLlmCall('DELETE', '/api/delete')).toBe(
            false,
        );
        expect(checkIsAllowedCustomLlmCall('POST', OLLAMA_PS_PATH)).toBe(false);
        // Reading what LM Studio has loaded, never loading or unloading it.
        expect(checkIsAllowedCustomLlmCall('POST', LM_STUDIO_MODELS_PATH)).toBe(
            false,
        );
        expect(checkIsAllowedCustomLlmCall('POST', '/api/v1/models/load')).toBe(
            false,
        );
        expect(checkIsAllowedCustomLlmCall('POST', '/models')).toBe(false);
        expect(checkIsAllowedCustomLlmCall('POST', '/embeddings')).toBe(false);
        expect(checkIsAllowedCustomLlmCall('GET', '/../admin')).toBe(false);
    });
});

describe('CustomServerError', () => {
    it('is told apart by its name, so a mocked module still matches', () => {
        expect(checkIsCustomServerError(new CustomServerError('x'))).toBe(true);
        expect(
            checkIsCustomServerError({
                name: 'CustomServerError',
                message: 'y',
            }),
        ).toBe(true);
        expect(checkIsCustomServerError(new Error('z'))).toBe(false);
        expect(checkIsCustomServerError(null)).toBe(false);
    });
});
