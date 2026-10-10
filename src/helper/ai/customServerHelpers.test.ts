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
    mergeCustomServerModels,
    readLmStudioModels,
} from './customServerHelpers';
import {
    CUSTOM_LLM_CANCEL_CHANNEL,
    type CustomServerType,
    type LmStudioModelInfoType,
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

function genInfo(value: Partial<LmStudioModelInfoType> = {}) {
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

describe('readLmStudioModels', () => {
    it('reads LM Studio’s own list through the relay', async () => {
        h.send.mockResolvedValue({
            ok: true,
            status: 200,
            contentType: 'application/json',
            text: JSON.stringify({
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
        });
        const infoMap = await readLmStudioModels(genServer());
        expect(infoMap?.get('qwen/qwen3.5-9b')).toEqual(genInfo());
        expect(h.send.mock.calls[0][1]).toMatchObject({
            serverId: 'server-1',
            method: 'GET',
            path: '/api/v0/models',
        });
    });

    it('asks nothing of a server that is not shaped like LM Studio', async () => {
        expect(
            await readLmStudioModels(
                genServer({ baseUrl: 'http://localhost:11434' }),
            ),
        ).toBeNull();
        expect(h.send).not.toHaveBeenCalled();
    });

    it('is null for a refusal, and gives up on a machine that is off', async () => {
        h.send.mockResolvedValue({
            ok: true,
            status: 404,
            contentType: 'text/plain',
            text: 'Not found',
        });
        expect(await readLmStudioModels(genServer())).toBeNull();

        vi.useFakeTimers();
        h.send.mockReturnValue(new Promise(() => {}));
        const pending = readLmStudioModels(genServer(), 1500);
        await vi.advanceTimersByTimeAsync(1500);
        expect(await pending).toBeNull();
        // And the relay is told to drop it, so nothing waits on for nobody.
        expect(h.sendData).toHaveBeenCalledWith(CUSTOM_LLM_CANCEL_CHANNEL, {
            requestId: expect.any(String),
        });
    });
});
