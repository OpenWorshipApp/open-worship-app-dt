import OpenAI from 'openai';

import { getIsAIEnabled } from './aiHelpers';
import {
    cancelCustomLlmRequest,
    describeCustomLlmFailure,
    getCustomServers,
    requestCustomLlm,
} from './customServerHelpers';
import {
    CUSTOM_CONTEXT_COMFORTABLE,
    CustomServerError,
    checkIsCustomServerError,
    checkIsLoopbackUrl,
    toContextLabel,
    toCustomServerBaseUrl,
    type CustomLlmFetchResultType,
    type CustomServerKindType,
} from '../../../electron/customLlmProtocol';

/**
 * The chatbot's client for a custom server: the OpenAI SDK, unchanged, with
 * its `fetch` swapped for one that goes through the main-process relay. The
 * SDK builds the request -- tools, messages, the lot -- and posts it to a
 * made-up address on a reserved name; `relayFetch` reads the server id and
 * the path back off that address and hands the call to the relay, which is
 * what knows the real address and the key.
 */
const RELAY_ORIGIN = 'https://custom-server.invalid';
// Under the relay's own ceiling, so the client is the one that gives up and
// says why. A CPU-only machine can take minutes over one round.
const CLIENT_TIMEOUT_MILLISECONDS = 10 * 60 * 1000;
// Statuses a `Response` must be built with a null body for, or it throws.
const NULL_BODY_STATUS_SET = new Set([204, 205, 304]);

function toRelayTarget(url: string) {
    if (!url.startsWith(`${RELAY_ORIGIN}/`)) {
        return null;
    }
    const rest = url.slice(RELAY_ORIGIN.length + 1);
    const slashIndex = rest.indexOf('/');
    if (slashIndex <= 0) {
        return null;
    }
    // The SDK may add a query string; the relay forwards none.
    const path = rest.slice(slashIndex).split('?')[0];
    return { serverId: rest.slice(0, slashIndex), path };
}

function getServerBaseUrl(serverId: string) {
    return (
        getCustomServers().find((one) => {
            return one.id === serverId;
        })?.baseUrl ?? ''
    );
}

/**
 * A refusal's body in the ONE shape the SDK reads, `{error: {message, type,
 * code}}`, whatever shape the server wrote it in. LM Studio, Ollama,
 * llama.cpp and a LiteLLM proxy write that shape; vLLM and SGLang write
 * `{object: "error", message, type, code}` with no `error` key at all, and a
 * FastAPI server (vLLM's key check, GPT4All) `{detail: ...}` -- which the
 * SDK turns into "404 status code (no body)" and this module cannot read.
 * A body that already carries `error`, or that is not JSON, is left alone.
 */
export function toReadableErrorText(status: number, text: string): string {
    if (status < 400) {
        return text;
    }
    let data: any;
    try {
        data = JSON.parse(text);
    } catch (_error) {
        return text;
    }
    if (data === null || typeof data !== 'object' || 'error' in data) {
        return text;
    }
    const message =
        typeof data.message === 'string'
            ? data.message
            : typeof data.detail === 'string'
              ? data.detail
              : data.detail !== undefined
                ? JSON.stringify(data.detail)
                : null;
    if (message === null) {
        return text;
    }
    return JSON.stringify({
        error: {
            message,
            type: typeof data.type === 'string' ? data.type : null,
            code: data.code ?? null,
        },
    });
}

function toResponse(
    result: Extract<CustomLlmFetchResultType, { ok: true }>,
): Response {
    let contentType = result.contentType;
    const text = toReadableErrorText(result.status, result.text);
    // The SDK reads a body as JSON only when it is labelled JSON, and a small
    // local server does not always say so.
    if (!/json/i.test(contentType)) {
        try {
            JSON.parse(text);
            contentType = 'application/json';
        } catch (_error) {
            contentType = contentType || 'text/plain';
        }
    }
    return new Response(NULL_BODY_STATUS_SET.has(result.status) ? null : text, {
        status: result.status,
        headers: { 'content-type': contentType },
    });
}

async function toBodyText(body: BodyInit | null | undefined) {
    if (body === null || body === undefined) {
        return undefined;
    }
    if (typeof body === 'string') {
        return body;
    }
    return new Response(body).text();
}

export async function relayFetch(
    input: string | URL | Request,
    init?: RequestInit,
): Promise<Response> {
    const url =
        typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
    const target = toRelayTarget(url);
    if (target === null) {
        throw new TypeError('Not a custom-server address');
    }
    const signal = init?.signal ?? null;
    if (signal?.aborted) {
        throw new DOMException('The request was aborted', 'AbortError');
    }
    const method = (init?.method ?? 'GET').toUpperCase();
    const body = await toBodyText(init?.body);
    const requestId = crypto.randomUUID();
    return new Promise<Response>((resolve, reject) => {
        // Stop rejects AT ONCE and tells the relay to drop the work; the
        // relay's own reply, when it comes, settles nothing.
        const handleAborting = () => {
            cancelCustomLlmRequest(requestId);
            reject(new DOMException('The request was aborted', 'AbortError'));
        };
        signal?.addEventListener('abort', handleAborting, { once: true });
        requestCustomLlm(
            { serverId: target.serverId, method, path: target.path, body },
            requestId,
        ).then(
            (result) => {
                signal?.removeEventListener('abort', handleAborting);
                if (!result.ok) {
                    reject(
                        new CustomServerError(
                            describeCustomLlmFailure(
                                result,
                                getServerBaseUrl(target.serverId),
                            ),
                        ),
                    );
                    return;
                }
                if (result.status < 200 || result.status > 599) {
                    reject(
                        new CustomServerError(
                            `the server answered ${result.status}`,
                        ),
                    );
                    return;
                }
                resolve(toResponse(result));
            },
            (error) => {
                signal?.removeEventListener('abort', handleAborting);
                reject(error);
            },
        );
    });
}

// One client per server, keyed on its id: everything that differs between
// servers -- address, key -- lives in the relay, so the client never goes
// stale. Bounded by the servers ever asked in this window's life.
const instanceMap = new Map<string, OpenAI>();

export function getCustomServerInstance(serverId: string) {
    if (!getIsAIEnabled()) {
        throw new CustomServerError('AI features are turned off in Settings');
    }
    let instance = instanceMap.get(serverId);
    if (instance === undefined) {
        instance = new OpenAI({
            // Never a key: the relay adds the real one, in the main process.
            apiKey: 'relay',
            baseURL: `${RELAY_ORIGIN}/${serverId}`,
            fetch: relayFetch,
            timeout: CLIENT_TIMEOUT_MILLISECONDS,
            maxRetries: 0,
            dangerouslyAllowBrowser: true,
        });
        instanceMap.set(serverId, instance);
    }
    return instance;
}

// What a server says when the conversation does not fit the context the
// model was LOADED with -- LM Studio's default is often 4 096 tokens, under
// what the assistant's tool list alone needs; Ollama's 400 reads "request
// (6856 tokens) exceeds the available context size (2304 tokens)".
const CONTEXT_ERROR_PATTERN =
    /context (?:length|window|size)|n_ctx|tokens to keep|maximum context|context overflow/i;
// What a server says of a request with tools it cannot take, each with what
// to do about it: Ollama's "<model> does not support tools" (a 400, the
// model's own limit); llama.cpp's and llamafile's "tools param requires
// --jinja flag" (a 500 until the server is started with the flag); vLLM's and
// SGLang's "auto" tool choice requires --enable-auto-tool-choice and
// --tool-call-parser (a 400 until the server is started with them). The
// first pattern that matches wins, so the specific ones come first.
const NO_TOOLS_ERROR_LIST: { pattern: RegExp; fixText: string }[] = [
    {
        pattern: /--jinja/i,
        fixText:
            'this server needs tool calling switched on — start llama-server ' +
            '(or llamafile) again with the --jinja flag, then ask again',
    },
    {
        pattern: /enable-auto-tool-choice|tool-call-parser/i,
        fixText:
            'this server needs tool calling switched on — start it again ' +
            'with --enable-auto-tool-choice and --tool-call-parser (vLLM, ' +
            'SGLang), then ask again',
    },
    {
        pattern:
            /does not support tools|tool(?:s| calls?| calling| use) (?:is |are )?not supported|function calling (?:is )?not supported/i,
        fixText:
            'this model cannot use tools, which the assistant needs to look ' +
            'things up — pick a model that supports tools',
    },
];

/**
 * What to say when the model's context cannot hold the conversation: the
 * size it is loaded with when the server said, and always the size to load
 * it with instead, in the words of the program that loads it. 32k, not the
 * 16k minimum -- 16k answers one question and runs out on the follow-up
 * (`CUSTOM_CONTEXT_MIN`).
 */
export function genContextTooSmallText(
    loadedContext: number | null = null,
    kind: CustomServerKindType = 'other',
) {
    const loadedText =
        loadedContext === null
            ? "this model's context"
            : `the ${toContextLabel(loadedContext)} context this model is loaded with`;
    const sizeText = toContextLabel(CUSTOM_CONTEXT_COMFORTABLE);
    const fixText =
        kind === 'lm-studio'
            ? `load it again in LM Studio with a Context Length of ${sizeText} ` +
              'or more (the model’s load settings)'
            : kind === 'ollama'
              ? 'in the Ollama app, set Settings → Context length to ' +
                `${sizeText} or more (or start Ollama with ` +
                `OLLAMA_CONTEXT_LENGTH=${CUSTOM_CONTEXT_COMFORTABLE})`
              : kind === 'llama-cpp'
                ? 'start llama-server (or llamafile) again with a context ' +
                  `size of ${sizeText} or more (-c ${CUSTOM_CONTEXT_COMFORTABLE})`
                : `load it with a context length of ${sizeText} or more where ` +
                  'the model is served';
    return `the conversation does not fit ${loadedText} — ${fixText}, then ask again`;
}

/**
 * What to say when the server's protocol door answered that it has no such
 * model: the id typed in Settings is not one the server lists.
 */
export function genModelMissingText(
    model: string,
    kind: CustomServerKindType = 'other',
) {
    const pullText =
        kind === 'ollama' ? `, or pull it (ollama pull ${model})` : '';
    return (
        `this server has no model called “${model}” — check the model id ` +
        'in Settings → Others → Custom servers, press Load models from ' +
        `server there${pullText}`
    );
}

/**
 * What to say when the address answered, but with a 404 page rather than the
 * protocol: the path is wrong, and Settings' Test is what finds the right
 * one. Measured 2026-10-10 on Ollama typed as `…/v1/systemone`.
 */
export function genWrongAddressText(baseUrl: string) {
    return (
        `nothing speaks the OpenAI API at ${toCustomServerBaseUrl(baseUrl) ?? baseUrl}` +
        ' — in Settings → Others → Custom servers, check the address and ' +
        'press Test (Ollama: http://localhost:11434/v1, LM Studio: ' +
        'http://localhost:1234/v1)'
    );
}

export type CustomServerFailureContextType = {
    loadedContext?: number | null;
    kind?: CustomServerKindType;
    // The server's saved address and the model asked for, for the two
    // sentences that name them.
    baseUrl?: string;
    model?: string;
};

/**
 * Whether the SDK error carries a body the server WROTE about the request,
 * rather than a bare status page. The SDK puts a JSON body's `error` field
 * on `error.error` (Ollama: `{message: "model 'x' not found", type:
 * "not_found_error"}`) and leaves it undefined for a text page ("404 page
 * not found"); a JSON body with no `error` field (vLLM) leaves only the
 * message, which names the model.
 */
function checkHasServerWrittenBody(error: any) {
    const body = error?.error;
    if (body !== undefined && body !== null) {
        return true;
    }
    return /model/i.test(String(error?.message ?? ''));
}

/**
 * The sentence to show for a failed custom-server ask, or null to leave the
 * error to the generic reading. The SDK wraps whatever the fetch threw in an
 * `APIConnectionError`, so the relay's own sentence is found on `cause`.
 *
 * A 404 is read two ways, because the generic reading -- "this model is not
 * available to the account" -- is wrong for both: a 404 the server WROTE
 * (JSON naming the model) means the server has no such model; a bare 404
 * page means the address is one path off (an Ollama typed without `/v1`),
 * which Settings' Test now corrects.
 */
export function toCustomServerFailure(
    error: any,
    context: CustomServerFailureContextType = {},
): Error | null {
    if (checkIsCustomServerError(error)) {
        return error;
    }
    if (checkIsCustomServerError(error?.cause)) {
        return error.cause;
    }
    const { loadedContext = null, kind = 'other', baseUrl, model } = context;
    const status = error?.status;
    const message = String(error?.message ?? '');
    // The SDK's own clock ran out (`CLIENT_TIMEOUT_MILLISECONDS`): the
    // generic reading of an error with no status is "the internet may be
    // down", and what happened is that the server was too SLOW. Measured
    // 2026-10-10: the user's laptop under Ollama read 11 tokens a second,
    // so the assistant's full request took the whole ten minutes.
    if (
        error?.constructor?.name === 'APIConnectionTimeoutError' ||
        /request timed out/i.test(message)
    ) {
        const where =
            baseUrl !== undefined && checkIsLoopbackUrl(baseUrl)
                ? 'this computer is too slow'
                : 'the computer it runs on is too slow';
        return new CustomServerError(
            `the server took longer than ${Math.round(CLIENT_TIMEOUT_MILLISECONDS / 60000)} minutes ` +
                'over the question and the window gave up — a local model ' +
                `reads the assistant’s whole instruction set first, and ${where} ` +
                'for that; a general question typed after /btw is small ' +
                'enough to answer here, and questions about the app need a ' +
                'faster computer or a model running on a GPU',
        );
    }
    if (typeof status !== 'number') {
        return null;
    }
    if (status === 404) {
        return new CustomServerError(
            checkHasServerWrittenBody(error)
                ? genModelMissingText(model ?? 'this model', kind)
                : genWrongAddressText(baseUrl ?? ''),
        );
    }
    if (CONTEXT_ERROR_PATTERN.test(message)) {
        return new CustomServerError(
            genContextTooSmallText(loadedContext, kind),
        );
    }
    const noTools = NO_TOOLS_ERROR_LIST.find(({ pattern }) => {
        return pattern.test(message);
    });
    if (noTools !== undefined) {
        return new CustomServerError(
            noTools.fixText +
                (kind === 'ollama'
                    ? ' (Ollama marks them “tools” in its library)'
                    : ''),
        );
    }
    return null;
}
