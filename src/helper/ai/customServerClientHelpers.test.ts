import { beforeEach, describe, expect, it, vi } from 'vitest';

// The real SDK, the relay faked: what is under test is what the SDK makes of
// what the relay answers -- a completion, a refusal, a Stop.
const { relay } = vi.hoisted(() => ({
    relay: {
        requestCustomLlm: vi.fn(),
        cancelCustomLlmRequest: vi.fn(),
        isAiEnabled: true,
    },
}));

vi.mock('./aiHelpers', () => ({
    getIsAIEnabled: () => relay.isAiEnabled,
}));
vi.mock('./customServerHelpers', () => ({
    requestCustomLlm: relay.requestCustomLlm,
    cancelCustomLlmRequest: relay.cancelCustomLlmRequest,
    getCustomServers: () => [
        {
            id: 'server-1',
            name: 'LM Studio',
            baseUrl: 'http://localhost:1234/v1',
            models: [],
        },
    ],
    describeCustomLlmFailure: (result: { reason: string }, baseUrl: string) =>
        `${result.reason} at ${baseUrl}`,
}));

import {
    getCustomServerInstance,
    relayFetch,
    toCustomServerFailure,
    toReadableErrorText,
} from './customServerClientHelpers';
import { checkIsCustomServerError } from '../../../electron/customLlmProtocol';
import { checkIsCancelError } from '../../chatbot/cancelHelpers';

const COMPLETION = {
    id: 'chatcmpl-1',
    object: 'chat.completion',
    created: 1,
    model: 'phi-3.1-mini-128k-instruct',
    choices: [
        {
            index: 0,
            finish_reason: 'stop',
            message: { role: 'assistant', content: 'Press F5.' },
        },
    ],
};

function ask(signal?: AbortSignal) {
    return getCustomServerInstance('server-1').chat.completions.create(
        {
            model: 'phi-3.1-mini-128k-instruct',
            messages: [{ role: 'user', content: 'hi' }],
        },
        { signal },
    );
}

describe('the custom-server client', () => {
    beforeEach(() => {
        relay.isAiEnabled = true;
        relay.requestCustomLlm.mockReset();
        relay.cancelCustomLlmRequest.mockReset();
    });

    it('posts through the relay, by server id and path, and reads the answer', async () => {
        relay.requestCustomLlm.mockResolvedValue({
            ok: true,
            status: 200,
            // A small local server does not always label its JSON.
            contentType: 'text/plain',
            text: JSON.stringify(COMPLETION),
        });

        const completion = await ask();

        expect(completion.choices[0].message.content).toBe('Press F5.');
        const [request] = relay.requestCustomLlm.mock.calls[0];
        expect(request).toMatchObject({
            serverId: 'server-1',
            method: 'POST',
            path: '/chat/completions',
        });
        expect(JSON.parse(request.body).model).toBe(
            'phi-3.1-mini-128k-instruct',
        );
    });

    it("hands back the relay's own sentence when nothing answered", async () => {
        relay.requestCustomLlm.mockResolvedValue({
            ok: false,
            reason: 'unreachable',
            detail: 'net::ERR_CONNECTION_REFUSED',
        });

        const error = await ask().catch((caught) => caught);

        const failure = toCustomServerFailure(error);
        expect(checkIsCustomServerError(failure)).toBe(true);
        expect(failure?.message).toBe(
            'unreachable at http://localhost:1234/v1',
        );
    });

    it('turns a context too small for the conversation into the fix', async () => {
        relay.requestCustomLlm.mockResolvedValue({
            ok: true,
            status: 400,
            contentType: 'application/json',
            text: JSON.stringify({
                error: 'Trying to keep the first 9000 tokens when context the overflows. However, the model is loaded with context length of only 4096 tokens',
            }),
        });

        const error = await ask().catch((caught) => caught);

        // 32k, not the 16k minimum: 16k runs out on the follow-up. With
        // no word on which program the server is, no program is named.
        expect(toCustomServerFailure(error)?.message).toBe(
            "the conversation does not fit this model's context — load it " +
                'with a context length of 32k or more where the model is ' +
                'served, then ask again',
        );
        // With what the server said, the size it IS loaded with is named,
        // and the fix is in the words of the program that loads it.
        expect(
            toCustomServerFailure(error, {
                loadedContext: 16384,
                kind: 'lm-studio',
            })?.message,
        ).toBe(
            'the conversation does not fit the 16k context this model is ' +
                'loaded with — load it again in LM Studio with a Context ' +
                'Length of 32k or more (the model’s load settings), then ' +
                'ask again',
        );
        expect(
            toCustomServerFailure(error, {
                loadedContext: 2050,
                kind: 'ollama',
            })?.message,
        ).toBe(
            'the conversation does not fit the 2k context this model is ' +
                'loaded with — in the Ollama app, set Settings → Context ' +
                'length to 32k or more (or start Ollama with ' +
                'OLLAMA_CONTEXT_LENGTH=32768), then ask again',
        );
    });

    it('reads Ollama’s own context refusal as the context being too small', async () => {
        // Ollama 0.40, 2026-10-10: a 400 whose message is itself JSON.
        relay.requestCustomLlm.mockResolvedValue({
            ok: true,
            status: 400,
            contentType: 'application/json',
            text: JSON.stringify({
                error: {
                    message:
                        '{"error":{"code":400,"message":"request (6856 tokens) exceeds the available context size (2304 tokens), try increasing it","type":"exceed_context_size_error"}}',
                    type: 'invalid_request_error',
                },
            }),
        });
        const error = await ask().catch((caught) => caught);
        expect(
            toCustomServerFailure(error, { kind: 'ollama' })?.message,
        ).toMatch(
            /^the conversation does not fit this model's context — in the Ollama app/,
        );
    });

    it('says the server has no such model when its 404 names one', async () => {
        relay.requestCustomLlm.mockResolvedValue({
            ok: true,
            status: 404,
            contentType: 'application/json',
            text: JSON.stringify({
                error: {
                    message: "model 'qwen3.5:4b' not found",
                    type: 'not_found_error',
                },
            }),
        });

        const error = await ask().catch((caught) => caught);

        expect(error.status).toBe(404);
        expect(
            toCustomServerFailure(error, {
                kind: 'ollama',
                model: 'qwen3.5:4b',
                baseUrl: 'http://localhost:11434/v1',
            })?.message,
        ).toBe(
            'this server has no model called “qwen3.5:4b” — check the model ' +
                'id in Settings → Others → Custom servers, press Load models ' +
                'from server there, or pull it (ollama pull qwen3.5:4b)',
        );
        // Another server: the same, without Ollama's command.
        expect(toCustomServerFailure(error, { model: 'phi' })?.message).toMatch(
            /press Load models from server there$/,
        );
    });

    it('says the address is wrong when the 404 is a bare page', async () => {
        // Ollama typed as `…/v1/systemone` (2026-10-10): a text page, which
        // the generic reading called "not available to the account".
        relay.requestCustomLlm.mockResolvedValue({
            ok: true,
            status: 404,
            contentType: 'text/plain',
            text: '404 page not found',
        });

        const error = await ask().catch((caught) => caught);

        expect(
            toCustomServerFailure(error, {
                baseUrl: 'http://localhost:11434/v1/systemone',
            })?.message,
        ).toBe(
            'nothing speaks the OpenAI API at ' +
                'http://localhost:11434/v1/systemone — in Settings → Others → ' +
                'Custom servers, check the address and press Test (Ollama: ' +
                'http://localhost:11434/v1, LM Studio: http://localhost:1234/v1)',
        );
    });

    it('says a model that cannot take tools cannot', async () => {
        relay.requestCustomLlm.mockResolvedValue({
            ok: true,
            status: 400,
            contentType: 'application/json',
            text: JSON.stringify({
                error: {
                    message:
                        'registry.ollama.ai/library/gemma3:4b does not support tools',
                    type: 'api_error',
                },
            }),
        });
        const error = await ask().catch((caught) => caught);
        expect(toCustomServerFailure(error, { kind: 'ollama' })?.message).toBe(
            'this model cannot use tools, which the assistant needs to look ' +
                'things up — pick a model that supports tools (Ollama marks ' +
                'them “tools” in its library)',
        );
    });

    it('says which flag switches tool calling on, server by server', async () => {
        // llama.cpp / llamafile: a 500 until `--jinja`.
        relay.requestCustomLlm.mockResolvedValue({
            ok: true,
            status: 500,
            contentType: 'application/json',
            text: JSON.stringify({
                error: {
                    code: 500,
                    message: 'tools param requires --jinja flag',
                    type: 'server_error',
                },
            }),
        });
        let error = await ask().catch((caught) => caught);
        expect(toCustomServerFailure(error)?.message).toBe(
            'this server needs tool calling switched on — start llama-server ' +
                '(or llamafile) again with the --jinja flag, then ask again',
        );
        // vLLM / SGLang: a 400 written in a shape with no `error` key.
        relay.requestCustomLlm.mockResolvedValue({
            ok: true,
            status: 400,
            contentType: 'application/json',
            text: JSON.stringify({
                object: 'error',
                message:
                    '"auto" tool choice requires --enable-auto-tool-choice and --tool-call-parser to be set',
                type: 'BadRequestError',
                param: null,
                code: 400,
            }),
        });
        error = await ask().catch((caught) => caught);
        expect(toCustomServerFailure(error)?.message).toBe(
            'this server needs tool calling switched on — start it again ' +
                'with --enable-auto-tool-choice and --tool-call-parser (vLLM, ' +
                'SGLang), then ask again',
        );
    });

    it('reads a refusal vLLM, SGLang or a FastAPI server wrote in its own shape', async () => {
        // vLLM's unknown model: JSON with no `error` key, which the SDK
        // would otherwise report as "404 status code (no body)".
        relay.requestCustomLlm.mockResolvedValue({
            ok: true,
            status: 404,
            contentType: 'application/json',
            text: JSON.stringify({
                object: 'error',
                message: 'The model `qwen3.5` does not exist.',
                type: 'NotFoundError',
                param: null,
                code: 404,
            }),
        });
        let error = await ask().catch((caught) => caught);
        expect(error.error).toEqual({
            message: 'The model `qwen3.5` does not exist.',
            type: 'NotFoundError',
            code: 404,
        });
        expect(
            toCustomServerFailure(error, { model: 'qwen3.5' })?.message,
        ).toMatch(/^this server has no model called “qwen3.5”/);
        // A FastAPI `detail`.
        relay.requestCustomLlm.mockResolvedValue({
            ok: true,
            status: 401,
            contentType: 'application/json',
            text: JSON.stringify({ detail: 'Unauthorized' }),
        });
        error = await ask().catch((caught) => caught);
        expect(error.error).toEqual({
            message: 'Unauthorized',
            type: null,
            code: null,
        });
        // The usual shape, and a text page, are left as they are.
        expect(toReadableErrorText(404, '{"error":{"message":"x"}}')).toBe(
            '{"error":{"message":"x"}}',
        );
        expect(toReadableErrorText(404, '404 page not found')).toBe(
            '404 page not found',
        );
        expect(toReadableErrorText(200, '{"message":"fine"}')).toBe(
            '{"message":"fine"}',
        );
        expect(toReadableErrorText(500, '{"detail":[{"loc":"x"}]}')).toBe(
            '{"error":{"message":"[{\\"loc\\":\\"x\\"}]","type":null,"code":null}}',
        );
    });

    it('says the server was too slow when the window’s own clock ran out', async () => {
        // What the SDK throws at its timeout: no status, "Request timed out."
        const error: any = new Error('Request timed out.');
        Object.defineProperty(error, 'constructor', {
            value: { name: 'APIConnectionTimeoutError' },
        });
        expect(
            toCustomServerFailure(error, {
                baseUrl: 'http://localhost:11434/v1',
            })?.message,
        ).toBe(
            'the server took longer than 10 minutes over the question and ' +
                'the window gave up — a local model reads the assistant’s ' +
                'whole instruction set first, and this computer is too slow ' +
                'for that; a general question typed after /btw is small ' +
                'enough to answer here, and questions about the app need a ' +
                'faster computer or a model running on a GPU',
        );
        expect(
            toCustomServerFailure(error, {
                baseUrl: 'http://super-computer:1237/v1',
            })?.message,
        ).toMatch(/the computer it runs on is too slow/);
    });

    it('leaves any other refusal to the generic reading', async () => {
        relay.requestCustomLlm.mockResolvedValue({
            ok: true,
            status: 401,
            contentType: 'application/json',
            text: JSON.stringify({ error: { message: 'bad key' } }),
        });

        const error = await ask().catch((caught) => caught);

        expect(error.status).toBe(401);
        expect(toCustomServerFailure(error)).toBeNull();
    });

    it('Stop rejects at once as a cancellation, and tells the relay to drop it', async () => {
        relay.requestCustomLlm.mockReturnValue(new Promise(() => {}));
        const controller = new AbortController();

        const pending = ask(controller.signal).catch((caught) => caught);
        await vi.waitFor(() => {
            expect(relay.requestCustomLlm).toHaveBeenCalled();
        });
        controller.abort();
        const error = await pending;
        // Read the way the loop reads it: off the signal -- the SDK's own
        // abort error carries "Error" as its name.
        expect(checkIsCancelError(error, controller.signal)).toBe(true);
        expect(error.constructor.name).toBe('APIUserAbortError');
        expect(relay.cancelCustomLlmRequest).toHaveBeenCalledWith(
            relay.requestCustomLlm.mock.calls[0][1],
        );
    });

    it('builds an empty body for a status that cannot carry one', async () => {
        relay.requestCustomLlm.mockResolvedValue({
            ok: true,
            status: 204,
            contentType: '',
            text: '',
        });

        const response = await relayFetch(
            'https://custom-server.invalid/server-1/models',
        );

        expect(response.status).toBe(204);
        expect(await response.text()).toBe('');
    });

    it('refuses an address that is not the relay’s own', async () => {
        await expect(
            relayFetch('https://api.openai.com/v1/models'),
        ).rejects.toThrow('Not a custom-server address');
        expect(relay.requestCustomLlm).not.toHaveBeenCalled();
    });

    it('refuses to make a client with AI switched off', () => {
        relay.isAiEnabled = false;
        expect(() => getCustomServerInstance('server-2')).toThrow(
            'AI features are turned off in Settings',
        );
    });
});
