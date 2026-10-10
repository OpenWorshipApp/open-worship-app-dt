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
    toContextLabel,
    type CustomLlmFetchResultType,
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

function toResponse(
    result: Extract<CustomLlmFetchResultType, { ok: true }>,
): Response {
    let contentType = result.contentType;
    // The SDK reads a body as JSON only when it is labelled JSON, and a small
    // local server does not always say so.
    if (!/json/i.test(contentType)) {
        try {
            JSON.parse(result.text);
            contentType = 'application/json';
        } catch (_error) {
            contentType = contentType || 'text/plain';
        }
    }
    return new Response(
        NULL_BODY_STATUS_SET.has(result.status) ? null : result.text,
        { status: result.status, headers: { 'content-type': contentType } },
    );
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
// what the assistant's tool list alone needs.
const CONTEXT_ERROR_PATTERN =
    /context (?:length|window|size)|n_ctx|tokens to keep|maximum context|context overflow/i;

/**
 * What to say when the model's context cannot hold the conversation: the
 * size it is loaded with when LM Studio said, and always the size to load
 * it with instead. 32k, not the 16k minimum -- 16k answers one question and
 * runs out on the follow-up (`CUSTOM_CONTEXT_MIN`).
 */
export function genContextTooSmallText(loadedContext: number | null = null) {
    const loadedText =
        loadedContext === null
            ? "this model's context"
            : `the ${toContextLabel(loadedContext)} context this model is loaded with`;
    return (
        `the conversation does not fit ${loadedText} — load it with a ` +
        `Context Length of ${toContextLabel(CUSTOM_CONTEXT_COMFORTABLE)} or ` +
        'more where the model is loaded (in LM Studio: the model’s load ' +
        'settings), then ask again'
    );
}

/**
 * The sentence to show for a failed custom-server ask, or null to leave the
 * error to the generic reading. The SDK wraps whatever the fetch threw in an
 * `APIConnectionError`, so the relay's own sentence is found on `cause`.
 */
export function toCustomServerFailure(
    error: any,
    loadedContext: number | null = null,
): Error | null {
    if (checkIsCustomServerError(error)) {
        return error;
    }
    if (checkIsCustomServerError(error?.cause)) {
        return error.cause;
    }
    const message = String(error?.message ?? '');
    if (
        typeof error?.status === 'number' &&
        CONTEXT_ERROR_PATTERN.test(message)
    ) {
        return new CustomServerError(genContextTooSmallText(loadedContext));
    }
    return null;
}
