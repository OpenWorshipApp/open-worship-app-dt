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

        // 32k, not the 16k minimum: 16k runs out on the follow-up.
        expect(toCustomServerFailure(error)?.message).toBe(
            "the conversation does not fit this model's context — load it " +
                'with a Context Length of 32k or more where the model is ' +
                'loaded (in LM Studio: the model’s load settings), then ask ' +
                'again',
        );
        // With what LM Studio said, the size it IS loaded with is named.
        expect(toCustomServerFailure(error, 16384)?.message).toMatch(
            /^the conversation does not fit the 16k context this model is loaded with — /,
        );
    });

    it('leaves any other refusal to the generic reading', async () => {
        relay.requestCustomLlm.mockResolvedValue({
            ok: true,
            status: 404,
            contentType: 'application/json',
            text: JSON.stringify({ error: { message: 'model not found' } }),
        });

        const error = await ask().catch((caught) => caught);

        expect(error.status).toBe(404);
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
