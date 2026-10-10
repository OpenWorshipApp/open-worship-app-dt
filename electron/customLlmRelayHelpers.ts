import { session, type Session, type WebContents } from 'electron';

import ElectronSettingManager from './ElectronSettingManager';
import { checkIsAiEnabled } from './aiHelpers';
import {
    CUSTOM_LLM_KEYS_SETTING_KEY,
    CUSTOM_LLM_SERVERS_SETTING_KEY,
    checkIsAllowedCustomLlmCall,
    checkIsSameOrigin,
    toCustomLlmCallUrl,
    toCustomServerBaseUrl,
    toValidCustomServerKeys,
    toValidCustomServers,
    type CustomLlmFetchRequestType,
    type CustomLlmFetchResultType,
} from './customLlmProtocol';

/**
 * The chatbot's door to a CUSTOM server (LM Studio and the like), opened in
 * the main process rather than from the chatbot window.
 *
 * The window's only network fence is its CSP, which names the assistants it
 * may speak to; a custom server can be any address, and widening that list to
 * every host would leave an answer that tried to post a key somewhere with
 * everywhere to send it. So the window asks HERE, by server id, and this
 * forwards only to an address saved in Settings, only the calls the chatbot
 * makes (`checkIsAllowedCustomLlmCall`), with the server's key read from the
 * encrypted store in this
 * process -- a custom server's key never enters the chatbot window at all.
 *
 * Its own in-memory session, not the default one: the app's CORS rewrite,
 * referrer stamping and cookie jar live on the default session, and none of
 * them has any business on a request to somebody's model server.
 */

const RELAY_PARTITION = 'custom-llm-relay';
// A model server's answer is a few kilobytes; a list of models, tens. Read
// with a ceiling so a misbehaving server cannot fill this process's memory.
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
// A question with a picture attached is the biggest thing sent.
const MAX_REQUEST_BYTES = 12 * 1024 * 1024;
// A small machine running a model on its CPU can take minutes over the ~16k
// tokens a round carries. Longer than the client's own timeout, so the client
// gives up first and says why; this one only stops a request nobody awaits.
const RELAY_TIMEOUT_MILLISECONDS = 11 * 60 * 1000;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;
// While a question is out, the server's model list is asked on a SECOND
// connection this often. A model writing for minutes sends nothing on the
// first, so silence there says nothing; a second connection that cannot even
// be opened says the machine is gone. Measured 2026-10-09: the LM Studio box
// down the hall went to sleep mid-question, and the window waited 516 s and
// then told the volunteer to check that LM Studio was running.
const WATCH_INTERVAL_MILLISECONDS = 20 * 1000;
// Misses in a row before the question is given up as lost. Only a FAILED
// connection is a miss: a list that is merely slow to come back is a busy
// server, and a busy server is alive.
const WATCH_MISS_LIMIT = 2;

export type CustomLlmRelayDepsType = {
    isAiEnabled: () => boolean;
    readServersText: () => string | null;
    readKeysText: () => string | null;
    fetch: (url: string, init: RequestInit) => Promise<Response>;
};

// In-flight requests, so Stop in the chatbot drops the work and not only the
// interest in it: a local model left generating holds the machine's CPU.
// Bounded by what is in flight; every entry leaves in `finally`.
const controllerMap = new Map<string, AbortController>();

export function cancelCustomLlmFetch(requestId: unknown) {
    if (typeof requestId !== 'string') {
        return;
    }
    controllerMap.get(requestId)?.abort();
}

function genFailure(
    reason: Extract<CustomLlmFetchResultType, { ok: false }>['reason'],
    detail: string,
): CustomLlmFetchResultType {
    return { ok: false, reason, detail };
}

async function readCappedText(response: Response) {
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
        return null;
    }
    if (response.body === null) {
        return '';
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        total += value.byteLength;
        if (total > MAX_RESPONSE_BYTES) {
            await reader.cancel();
            return null;
        }
        chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return new TextDecoder().decode(bytes);
}

/**
 * Asks the server's model list every `WATCH_INTERVAL_MILLISECONDS` while a
 * chat call is out, and calls `onLost` after `WATCH_MISS_LIMIT` connections
 * in a row that could not be made. One ask at a time: one still waiting is a
 * busy server, never a miss. Returns the function that stops it.
 */
function startWatchingServer(
    url: string,
    headers: Record<string, string>,
    deps: CustomLlmRelayDepsType,
    onLost: () => void,
) {
    const controller = new AbortController();
    let missCount = 0;
    let isAsking = false;
    const timer = setInterval(() => {
        if (isAsking) {
            return;
        }
        isAsking = true;
        deps.fetch(url, {
            method: 'GET',
            headers,
            signal: controller.signal,
            redirect: 'manual',
            credentials: 'omit',
            cache: 'no-store',
        }).then(
            (response) => {
                isAsking = false;
                missCount = 0;
                // Only that it answered matters; let the connection go.
                response.body?.cancel().catch(() => {});
            },
            () => {
                isAsking = false;
                if (controller.signal.aborted) {
                    return;
                }
                missCount += 1;
                if (missCount >= WATCH_MISS_LIMIT) {
                    onLost();
                }
            },
        );
    }, WATCH_INTERVAL_MILLISECONDS);
    return () => {
        clearInterval(timer);
        controller.abort();
    };
}

/**
 * One forwarded call. Never throws for anything the network does -- the
 * window needs to tell "nothing answered" from "the server said no", and an
 * Error sent over IPC keeps only its message.
 */
export async function runCustomLlmFetch(
    request: CustomLlmFetchRequestType,
    deps: CustomLlmRelayDepsType,
): Promise<CustomLlmFetchResultType> {
    if (!deps.isAiEnabled()) {
        return genFailure('ai-off', 'AI features are turned off in Settings');
    }
    const { serverId, method, path, body, requestId, probeBaseUrl } =
        request ?? {};
    if (
        typeof requestId !== 'string' ||
        !REQUEST_ID_PATTERN.test(requestId) ||
        !checkIsAllowedCustomLlmCall(method, path) ||
        (method === 'POST' &&
            (typeof body !== 'string' || body.length > MAX_REQUEST_BYTES))
    ) {
        return genFailure(
            'not-allowed',
            'that call is not one the chatbot makes',
        );
    }
    const server = toValidCustomServers(deps.readServersText()).find((one) => {
        return one.id === serverId;
    });
    if (server === undefined) {
        return genFailure('unknown-server', 'that server is not in Settings');
    }
    const savedBaseUrl = toCustomServerBaseUrl(server.baseUrl);
    if (savedBaseUrl === null) {
        return genFailure('bad-url', 'the server address is not a web address');
    }
    // A probe asks the model list at another path of the SAME program, and
    // nothing else: the key goes only to the host it was saved for.
    const probe =
        probeBaseUrl === undefined ? null : toCustomServerBaseUrl(probeBaseUrl);
    if (
        probeBaseUrl !== undefined &&
        (probe === null ||
            path !== '/models' ||
            !checkIsSameOrigin(probe, savedBaseUrl))
    ) {
        return genFailure(
            'not-allowed',
            'that call is not one the chatbot makes',
        );
    }
    const baseUrl = probe ?? savedBaseUrl;
    const url = toCustomLlmCallUrl(baseUrl, path);
    if (url === null) {
        return genFailure(
            'not-allowed',
            'that call is not one the chatbot makes',
        );
    }
    const apiKey = toValidCustomServerKeys(deps.readKeysText())[server.id];
    const controller = new AbortController();
    // Registered before the first `await`: a cancel sent straight after the
    // request arrives after it on the same channel, and must find it here.
    controllerMap.set(requestId, controller);
    let isTimedOut = false;
    const timer = setTimeout(() => {
        isTimedOut = true;
        controller.abort();
    }, RELAY_TIMEOUT_MILLISECONDS);
    const authHeaders: Record<string, string> =
        apiKey === undefined ? {} : { authorization: `Bearer ${apiKey}` };
    let isLost = false;
    // Only a question is watched: it is the one call that can take minutes.
    const stopWatching =
        method === 'POST'
            ? startWatchingServer(
                  `${baseUrl}/models`,
                  { accept: 'application/json', ...authHeaders },
                  deps,
                  () => {
                      isLost = true;
                      controller.abort();
                  },
              )
            : () => {};
    try {
        const headers: Record<string, string> = {
            accept: 'application/json',
            ...authHeaders,
        };
        if (method === 'POST') {
            headers['content-type'] = 'application/json';
        }
        const response = await deps.fetch(url, {
            method,
            headers,
            body: method === 'POST' ? body : undefined,
            signal: controller.signal,
            // A redirect could carry the key to another host; the address
            // in Settings is the only one this forwards to.
            redirect: 'manual',
            credentials: 'omit',
            cache: 'no-store',
        });
        if (
            response.type === 'opaqueredirect' ||
            (response.status >= 300 && response.status < 400)
        ) {
            return genFailure(
                'redirect',
                'the server sent the request to another address',
            );
        }
        const text = await readCappedText(response);
        if (text === null) {
            return genFailure('too-large', 'the server answered with too much');
        }
        return {
            ok: true,
            status: response.status,
            contentType: response.headers.get('content-type') ?? '',
            text,
        };
    } catch (error: any) {
        if (controller.signal.aborted) {
            if (isTimedOut) {
                return genFailure(
                    'timeout',
                    'the server took too long to answer',
                );
            }
            return isLost
                ? genFailure('lost', 'the server stopped answering')
                : genFailure('cancelled', 'stopped');
        }
        return genFailure(
            'unreachable',
            String(error?.message ?? error).slice(0, 200),
        );
    } finally {
        stopWatching();
        clearTimeout(timer);
        controllerMap.delete(requestId);
    }
}

let relaySession: Session | null = null;

function getRelaySession() {
    if (relaySession !== null) {
        return relaySession;
    }
    relaySession = session.fromPartition(RELAY_PARTITION);
    // Nothing here is a page, but a session is a session: refuse what one
    // could ask for rather than trust that nothing ever will.
    relaySession.setPermissionRequestHandler((_contents, _permission, done) => {
        done(false);
    });
    relaySession.setPermissionCheckHandler(() => {
        return false;
    });
    relaySession.on('will-download', (event) => {
        event.preventDefault();
    });
    return relaySession;
}

// Every dependency read inside a function, never at module load: a load-time
// read of another module's export is what makes a partial `vi.mock` of that
// module throw on import.
const relayDeps: CustomLlmRelayDepsType = {
    isAiEnabled: () => {
        return checkIsAiEnabled();
    },
    readServersText: () => {
        return ElectronSettingManager.getInstance().getClientSetting(
            CUSTOM_LLM_SERVERS_SETTING_KEY,
        );
    },
    readKeysText: () => {
        return ElectronSettingManager.getInstance().getSecureSetting(
            CUSTOM_LLM_KEYS_SETTING_KEY,
        );
    },
    fetch: (url, init) => {
        return getRelaySession().fetch(url, init);
    },
};

/**
 * The IPC door. A window closed mid-question takes its requests with it, so a
 * local model does not go on generating for nobody.
 */
export async function handleCustomLlmFetch(
    request: CustomLlmFetchRequestType,
    sender: WebContents,
) {
    const requestId = request?.requestId;
    const handleDestroyed = () => {
        cancelCustomLlmFetch(requestId);
    };
    sender.once('destroyed', handleDestroyed);
    try {
        return await runCustomLlmFetch(request, relayDeps);
    } finally {
        sender.removeListener('destroyed', handleDestroyed);
    }
}
