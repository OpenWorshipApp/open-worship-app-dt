import { beforeEach, describe, expect, it, vi } from 'vitest';

// The relay faked, as in the sibling suite; three servers -- one on this
// computer, one on the church's network and one shared -- so each of the
// relay's sentences can be told apart by WHERE the server is.
const { relay } = vi.hoisted(() => ({
    relay: {
        requestCustomLlm: vi.fn(),
        cancelCustomLlmRequest: vi.fn(),
    },
}));

vi.mock('./aiHelpers', () => ({ getIsAIEnabled: () => true }));
vi.mock('./customServerHelpers', () => ({
    requestCustomLlm: relay.requestCustomLlm,
    cancelCustomLlmRequest: relay.cancelCustomLlmRequest,
    getAllCustomServers: () => [
        {
            id: 'here',
            name: 'LM Studio',
            baseUrl: 'http://localhost:1234/v1',
            models: [],
        },
        {
            id: 'hall',
            name: 'LM Studio super-computer',
            baseUrl: 'http://super-computer:1237/v1',
            models: [],
        },
        {
            id: 'registry-church',
            name: 'Church LM Studio',
            baseUrl: 'https://shared-server.invalid/v1',
            models: [],
        },
    ],
    describeCustomLlmFailure: (result: { reason: string }, baseUrl: string) =>
        `${result.reason} at ${baseUrl}`,
}));

import {
    genContextCutText,
    genContextTooSmallText,
    relayFetch,
    toCustomServerFailure,
    toReadableErrorText,
} from './customServerClientHelpers';
import {
    CustomServerError,
    checkIsCustomServerError,
} from '../../../electron/customLlmProtocol';

function genOk(status: number, text = '{}') {
    return { ok: true, status, contentType: 'application/json', text };
}

async function readRelayFailure(serverId: string, reason: string) {
    relay.requestCustomLlm.mockResolvedValue({ ok: false, reason, detail: '' });
    const error = await relayFetch(
        `https://custom-server.invalid/${serverId}/chat/completions`,
        { method: 'POST', body: '{}' },
    ).catch((caught) => caught);
    expect(checkIsCustomServerError(error)).toBe(true);
    return error.message as string;
}

beforeEach(() => {
    relay.requestCustomLlm.mockResolvedValue(genOk(200));
});

describe('relayFetch, the address and the body', () => {
    it('refuses a relay address that names no path after the server', async () => {
        await expect(
            relayFetch('https://custom-server.invalid/here'),
        ).rejects.toThrow(new TypeError('Not a custom-server address'));
        await expect(
            relayFetch('https://custom-server.invalid//models'),
        ).rejects.toThrow('Not a custom-server address');
        expect(relay.requestCustomLlm).not.toHaveBeenCalled();
    });

    it('reads a URL object, and drops the query the relay never forwards', async () => {
        const response = await relayFetch(
            new URL('https://custom-server.invalid/here/models?limit=5'),
        );
        expect(response.status).toBe(200);
        expect(relay.requestCustomLlm).toHaveBeenCalledWith(
            {
                serverId: 'here',
                method: 'GET',
                path: '/models',
                body: undefined,
            },
            expect.any(String),
        );
    });

    it('sends a body that is not a string as its text, under an upper-case method', async () => {
        await relayFetch(
            new Request('https://custom-server.invalid/hall/chat/completions', {
                method: 'POST',
            }),
            {
                method: 'post',
                body: new TextEncoder().encode('{"model":"qwen"}'),
            },
        );
        expect(relay.requestCustomLlm.mock.calls[0][0]).toEqual({
            serverId: 'hall',
            method: 'POST',
            path: '/chat/completions',
            body: '{"model":"qwen"}',
        });
    });
});

describe('relayFetch, what the relay answered', () => {
    it('a Stop already pressed rejects before anything is sent', async () => {
        const controller = new AbortController();
        controller.abort();
        const error = await relayFetch(
            'https://custom-server.invalid/here/models',
            { signal: controller.signal },
        ).catch((caught) => caught);
        expect(error).toBeInstanceOf(DOMException);
        expect(error.name).toBe('AbortError');
        expect(relay.requestCustomLlm).not.toHaveBeenCalled();
        expect(relay.cancelCustomLlmRequest).not.toHaveBeenCalled();
    });

    it('a status no HTTP answer carries is the server answering it', async () => {
        relay.requestCustomLlm.mockResolvedValue(genOk(600));
        const error = await relayFetch(
            'https://custom-server.invalid/here/models',
        ).catch((caught) => caught);
        expect(checkIsCustomServerError(error)).toBe(true);
        expect(error.message).toBe('the server answered 600');

        relay.requestCustomLlm.mockResolvedValue(genOk(199));
        await expect(
            relayFetch('https://custom-server.invalid/here/models'),
        ).rejects.toThrow('the server answered 199');
    });

    it('an IPC failure is passed on, and a later Stop tells the relay nothing', async () => {
        const failure = new Error('main is gone');
        relay.requestCustomLlm.mockRejectedValue(failure);
        const controller = new AbortController();
        await expect(
            relayFetch('https://custom-server.invalid/here/models', {
                signal: controller.signal,
            }),
        ).rejects.toBe(failure);
        controller.abort();
        expect(relay.cancelCustomLlmRequest).not.toHaveBeenCalled();
    });
});

describe("the relay's failures in the help window's words", () => {
    it('a server that went quiet is said by where it runs', async () => {
        expect(await readRelayFailure('here', 'lost')).toBe(
            'it went quiet in the middle of the question — check that its ' +
                'server is running',
        );
        expect(await readRelayFailure('hall', 'lost')).toBe(
            'it went quiet in the middle of the question — check that the ' +
                'computer it runs on is on and awake, and that its server is ' +
                'running',
        );
        expect(await readRelayFailure('registry-church', 'lost')).toBe(
            'it went quiet in the middle of the question — it is shared by ' +
                'openworship.app and may be switched off right now; try ' +
                'again later or pick another assistant',
        );
    });

    it('a machine down the hall that does not answer is sent to first', async () => {
        const message = await readRelayFailure('hall', 'unreachable');
        expect(message).toBe(
            'its server is not answering — check that the computer it runs ' +
                'on is on and awake, and that the server is running',
        );
        // No address of any server in the help window.
        expect(message).not.toContain('super-computer');
    });

    it('a server too slow to answer says so, wherever it is', async () => {
        expect(await readRelayFailure('hall', 'timeout')).toBe(
            'the server took too long to answer',
        );
    });
});

describe('toReadableErrorText', () => {
    it('leaves a refusal alone when it carries no sentence to lift', () => {
        const text = JSON.stringify({ object: 'error', code: 400 });
        expect(toReadableErrorText(400, text)).toBe(text);
        expect(toReadableErrorText(500, 'null')).toBe('null');
    });

    it("writes FastAPI's list of problems out as the message", () => {
        const detail = [{ loc: ['body', 'model'], msg: 'field required' }];
        expect(
            JSON.parse(toReadableErrorText(422, JSON.stringify({ detail }))),
        ).toEqual({
            error: { message: JSON.stringify(detail), type: null, code: null },
        });
    });
});

describe('the context fix for llama.cpp', () => {
    it("names llama-server's own flag, cut answer or refused question", () => {
        const fix =
            'start llama-server (or llamafile) again with a context size of ' +
            '32k or more (-c 32768)';
        expect(genContextTooSmallText(null, 'llama-cpp')).toBe(
            `the conversation does not fit this model's context — ${fix}, ` +
                'then ask again',
        );
        expect(genContextCutText(8192, 'llama-cpp')).toBe(
            'it loaded this model with only 8k of context and answered from ' +
                `part of the question, so that answer is not shown — ${fix}, ` +
                'then ask again',
        );
    });
});

describe('toCustomServerFailure, the plain cases', () => {
    it('hands back a sentence the relay already wrote', () => {
        const error = new CustomServerError('stopped');
        expect(toCustomServerFailure(error)).toBe(error);
        const wrapped = { message: 'Connection error.', cause: error };
        expect(toCustomServerFailure(wrapped)).toBe(error);
    });

    it('leaves an error with no status and no timeout to the generic reading', () => {
        expect(toCustomServerFailure(new Error('socket hang up'))).toBeNull();
        expect(toCustomServerFailure(null)).toBeNull();
    });
});
