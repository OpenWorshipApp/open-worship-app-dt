import { afterEach, describe, expect, it, vi } from 'vitest';

// The store and the relay's IPC are not what is under test; the helpers'
// own decisions are.
const h = vi.hoisted(() => ({
    send: vi.fn(),
    sendData: vi.fn(),
}));

vi.mock('../appHooks', () => ({ useAppEffect: vi.fn() }));
vi.mock('../../server/appHomeStorage', () => ({
    appHomeStorage: { getItem: vi.fn(), setItem: vi.fn() },
}));
vi.mock('../../server/appSecureStorage', () => ({
    appSecureStorage: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
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
    findCustomModelInfo,
    listCustomServerModels,
    mergeCustomServerModels,
    readCustomServerModelInfo,
} from './customServerHelpers';
import {
    CUSTOM_LLM_CANCEL_CHANNEL,
    type CustomModelInfoType,
    type CustomServerType,
} from '../../../electron/customLlmProtocol';

function genServer(value: Partial<CustomServerType> = {}): CustomServerType {
    return {
        id: 'server-1',
        name: 'LM Studio super-computer',
        baseUrl: 'http://super-computer:1237/v1',
        models: [{ id: 'row-1', model: 'qwen/qwen3.5-9b', name: '' }],
        ...value,
    };
}

function genInfo(value: Partial<CustomModelInfoType> = {}) {
    return {
        isLoaded: true,
        loadedContext: 16384,
        maxContext: 262144,
        canSeeImages: true,
        ...value,
    };
}

afterEach(() => {
    vi.useRealTimers();
    h.send.mockReset();
    h.sendData.mockReset();
});

describe('describeCustomLlmFailure', () => {
    it('sends a person to the machine first when it is not this one', () => {
        expect(
            describeCustomLlmFailure(
                { ok: false, reason: 'unreachable', detail: '' },
                'http://super-computer:1237/v1',
            ),
        ).toBe(
            'nothing answered at http://super-computer:1237/v1 — check ' +
                'that the computer it runs on is on and awake, and that its ' +
                'server is running',
        );
        expect(
            describeCustomLlmFailure(
                { ok: false, reason: 'unreachable', detail: '' },
                'http://localhost:1234/v1',
            ),
        ).toBe(
            'nothing answered at http://localhost:1234/v1 — check that its ' +
                'server is running',
        );
    });

    it('says a server that went away mid-question went away', () => {
        expect(
            describeCustomLlmFailure(
                { ok: false, reason: 'lost', detail: '' },
                'http://super-computer:1237/v1',
            ),
        ).toMatch(
            /^it went quiet in the middle of the question — check that the computer/,
        );
    });
});

describe('mergeCustomServerModels', () => {
    it('adds new models and takes LM Studio’s word on pictures', () => {
        const server = genServer({
            models: [
                { id: 'row-1', model: 'qwen/qwen3.5-9b', name: 'Qwen' },
                // Ticked by hand, and LM Studio says it is blind.
                {
                    id: 'row-2',
                    model: 'phi',
                    name: '',
                    canSeeImages: true,
                },
                // Not in LM Studio's list: left as the person set it.
                {
                    id: 'row-3',
                    model: 'mine',
                    name: '',
                    canSeeImages: true,
                },
            ],
        });
        const merged = mergeCustomServerModels(
            server,
            ['qwen/qwen3.5-9b', 'phi', 'google/gemma-4-e4b'],
            new Map([
                ['qwen/qwen3.5-9b', genInfo()],
                ['phi', genInfo({ canSeeImages: false })],
                ['google/gemma-4-e4b', genInfo({ isLoaded: false })],
            ]),
        );
        expect(merged.models).toEqual([
            {
                id: 'row-1',
                model: 'qwen/qwen3.5-9b',
                name: 'Qwen',
                canSeeImages: true,
            },
            { id: 'row-2', model: 'phi', name: '' },
            { id: 'row-3', model: 'mine', name: '', canSeeImages: true },
            {
                id: expect.any(String),
                model: 'google/gemma-4-e4b',
                name: '',
                canSeeImages: true,
            },
        ]);
    });

    it('changes nothing about pictures when the server said nothing', () => {
        const server = genServer({
            models: [{ id: 'row-1', model: 'a', name: '', canSeeImages: true }],
        });
        expect(mergeCustomServerModels(server, ['a']).models).toEqual(
            server.models,
        );
    });
});

function genAnswer(status: number, body: unknown) {
    return {
        ok: true,
        status,
        contentType: 'application/json',
        text: typeof body === 'string' ? body : JSON.stringify(body),
    };
}

// The relay answered by the PATH asked, the way a real server would.
function answerByPath(answers: Record<string, unknown>) {
    h.send.mockImplementation(async (_channel: string, request: any) => {
        const key = `${request.probeBaseUrl ?? ''}${request.path}`;
        const answer = answers[key] ?? answers[request.path];
        if (answer === undefined) {
            return genAnswer(404, '404 page not found');
        }
        return answer;
    });
}

const MODEL_LIST = genAnswer(200, { data: [{ id: 'qwen3.5:4b' }] });

describe('readCustomServerModelInfo', () => {
    it('reads LM Studio’s own list through the relay', async () => {
        h.send.mockResolvedValue(
            genAnswer(200, {
                data: [
                    {
                        id: 'qwen/qwen3.5-9b',
                        type: 'vlm',
                        state: 'loaded',
                        loaded_context_length: 16384,
                        max_context_length: 262144,
                    },
                ],
            }),
        );
        const info = await readCustomServerModelInfo(genServer());
        expect(info?.kind).toBe('lm-studio');
        expect(info?.infoMap.get('qwen/qwen3.5-9b')).toEqual(genInfo());
        expect(h.send).toHaveBeenCalledTimes(1);
        expect(h.send.mock.calls[0][1]).toMatchObject({
            serverId: 'server-1',
            method: 'GET',
            path: '/api/v0/models',
        });
    });

    it('reads Ollama’s two lists when LM Studio’s is not there', async () => {
        answerByPath({
            '/api/tags': genAnswer(200, {
                models: [
                    {
                        name: 'qwen3.5:4b',
                        model: 'qwen3.5:4b',
                        details: { context_length: 262144 },
                        capabilities: ['completion', 'tools', 'vision'],
                    },
                    {
                        name: 'llama3.2:3b',
                        model: 'llama3.2:3b',
                        details: { context_length: 131072 },
                        capabilities: ['completion', 'tools'],
                    },
                ],
            }),
            '/api/ps': genAnswer(200, {
                models: [{ name: 'qwen3.5:4b', context_length: 4096 }],
            }),
        });
        const info = await readCustomServerModelInfo(
            genServer({ baseUrl: 'http://localhost:11434/v1' }),
        );
        expect(info?.kind).toBe('ollama');
        expect(info?.infoMap.get('qwen3.5:4b')).toEqual({
            isLoaded: true,
            loadedContext: 4096,
            maxContext: 262144,
            canSeeImages: true,
        });
        expect(info?.infoMap.get('llama3.2:3b')).toEqual({
            isLoaded: false,
            loadedContext: null,
            maxContext: 131072,
            canSeeImages: false,
        });
        expect(
            h.send.mock.calls.map((call: any[]) => {
                return call[1].path;
            }),
        ).toEqual(['/api/v0/models', '/api/tags', '/api/ps']);
    });

    it('asks nothing of a server that is not shaped like either', async () => {
        expect(
            await readCustomServerModelInfo(
                genServer({ baseUrl: 'http://localhost:11434' }),
            ),
        ).toBeNull();
        expect(h.send).not.toHaveBeenCalled();
    });

    it('reads llama.cpp’s /props as the word on its one model', async () => {
        answerByPath({
            '/props': genAnswer(200, {
                default_generation_settings: { id: 0, n_ctx: 4096 },
                total_slots: 1,
                model_path: '/models/qwen3.5-4b.gguf',
                modalities: { vision: true, audio: false },
            }),
        });
        const info = await readCustomServerModelInfo(
            genServer({ baseUrl: 'http://localhost:8080/v1' }),
        );
        expect(info?.kind).toBe('llama-cpp');
        expect(info?.infoMap.size).toBe(0);
        expect(info?.commonInfo).toEqual({
            isLoaded: true,
            loadedContext: 4096,
            maxContext: null,
            canSeeImages: true,
        });
        // Whatever id the row was given, the server's one word applies.
        expect(findCustomModelInfo(info, 'anything')?.loadedContext).toBe(4096);
        expect(
            h.send.mock.calls.map((call: any[]) => {
                return call[1].path;
            }),
        ).toEqual(['/api/v0/models', '/api/tags', '/props']);
    });

    it('calls a server that answers no door something else', async () => {
        answerByPath({});
        const info = await readCustomServerModelInfo(genServer());
        expect(info).toEqual({
            kind: 'other',
            infoMap: new Map(),
            commonInfo: null,
        });
        expect(findCustomModelInfo(info, 'x')).toBeNull();
        expect(findCustomModelInfo(null, 'x')).toBeNull();
    });

    it('gives up on a machine that is off, within the one wait', async () => {
        vi.useFakeTimers();
        h.send.mockReturnValue(new Promise(() => {}));
        const pending = readCustomServerModelInfo(genServer(), 1500);
        await vi.advanceTimersByTimeAsync(1500);
        expect(await pending).toBeNull();
        // One ask, not one per door: the wait is for the whole reading.
        expect(h.send).toHaveBeenCalledTimes(1);
        // And the relay is told to drop it, so nothing waits on for nobody.
        expect(h.sendData).toHaveBeenCalledWith(CUSTOM_LLM_CANCEL_CHANNEL, {
            requestId: expect.any(String),
        });
    });
});

describe('listCustomServerModels', () => {
    it('lists the chat models at the saved address', async () => {
        answerByPath({ '/models': MODEL_LIST });
        expect(
            await listCustomServerModels(
                genServer({ baseUrl: 'http://localhost:11434/v1' }),
            ),
        ).toEqual({ ok: true, models: ['qwen3.5:4b'] });
        expect(h.send.mock.calls[0][1]).not.toHaveProperty('probeBaseUrl');
    });

    it('finds the protocol one path off and says which address to save', async () => {
        // Ollama typed as its own `/v1/systemone` door (2026-10-10): every
        // call under it is a 404 page.
        answerByPath({ 'http://localhost:11434/v1/models': MODEL_LIST });
        expect(
            await listCustomServerModels(
                genServer({ baseUrl: 'http://localhost:11434/v1/systemone' }),
            ),
        ).toEqual({
            ok: true,
            models: ['qwen3.5:4b'],
            correctedBaseUrl: 'http://localhost:11434/v1',
        });
        expect(h.send.mock.calls[1][1]).toMatchObject({
            path: '/models',
            probeBaseUrl: 'http://localhost:11434/v1',
        });
    });

    it('says what to type when no address of the server speaks the protocol', async () => {
        answerByPath({});
        const answer = await listCustomServerModels(
            genServer({ baseUrl: 'http://localhost:11434' }),
        );
        expect(answer.ok).toBe(false);
        expect((answer as any).message).toBe(
            'the server answered 404 — nothing at this address speaks the ' +
                'OpenAI API; the address usually ends in /v1 (Ollama: ' +
                'http://localhost:11434/v1, LM Studio: http://localhost:1234/v1)',
        );
        // The root, `/v1`: nothing on another host.
        expect(
            h.send.mock.calls.map((call: any[]) => {
                return call[1].probeBaseUrl ?? '(saved)';
            }),
        ).toEqual(['(saved)', 'http://localhost:11434/v1']);
    });

    it('tries no other path for a refused key or a machine that is off', async () => {
        h.send.mockResolvedValue(genAnswer(401, { error: 'no' }));
        expect(await listCustomServerModels(genServer())).toEqual({
            ok: false,
            message: 'the server refused the API key',
        });
        expect(h.send).toHaveBeenCalledTimes(1);

        h.send.mockReset();
        h.send.mockResolvedValue({
            ok: false,
            reason: 'unreachable',
            detail: '',
        });
        const answer = await listCustomServerModels(genServer());
        expect((answer as any).message).toMatch(/^nothing answered at/);
        expect(h.send).toHaveBeenCalledTimes(1);
    });
});
