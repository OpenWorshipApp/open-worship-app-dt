import { checkIsAiEnabled } from './aiHelpers';
import { fetchOnRelaySession } from './customLlmRelayHelpers';
import {
    REPORT_TEXT_MAX,
    genReportPostBody,
    toCustomServerBaseUrl,
    toReportUploadAllowance,
    toValidReportFiles,
    type LlmReportFailureType,
    type LlmReportPostRequestType,
    type LlmReportPostResultType,
    type LlmReportServerType,
} from './customLlmProtocol';
import { getLlmReportServers, refreshLlmRegistry } from './llmRegistryHelpers';

/**
 * The door a problem report leaves by (2026-10-13, the user's ask: _a shared
 * server can be type accepting report … the endpoint should be accepting POST
 * a raw text directly … when user report the chatbot should collect
 * information and prepare as a prompt (raw text) then post to the endpoint_).
 *
 * The help window's **Send report** hands the prepared text HERE, with the
 * files that go with it, and this posts them to an entry of the shared
 * registry marked `isAcceptingReport` (`customLlmProtocol.ts`), with that
 * entry's own key as the bearer.
 *
 * The body is JSON (the same day, the user again: _the posting endpoint
 * maybe have to accept json instead of raw text … `{"prompt":"…",
 * "attachments":["base64 data", …]}` … and accept files like markdown
 * pdf_): the text under `prompt`, and under `attachments` the picture of
 * the app and what the person attached -- `genReportPostBody` writes it.
 *
 * In main for the reasons the relay is (`customLlmRelayHelpers.ts`): the
 * window's CSP names the hosts it may speak to, and a registry server's
 * address and key never enter a window. So a window names NO address -- it
 * hands over words, and what comes back is whether they were taken, in a
 * sentence written here: never the server's own answer, and never an error
 * that names the host.
 */

// One address is given this long to take a report of words; one with files
// is given the time a slow uplink needs on top (`toReportUploadAllowance`).
const POST_TIMEOUT_MILLISECONDS = 10 * 1000;
// All of it -- every address tried, and the registry read again in between
// -- is over inside this (and the same allowance): somebody is waiting on a
// Send they pressed.
const TOTAL_TIMEOUT_MILLISECONDS = 40 * 1000;
// A person sends a report or two. Anything that sends more than this is a
// loop, and what it would flood is one admin's machine behind a tunnel.
const POST_LIMIT = 5;
const POST_LIMIT_WINDOW_MILLISECONDS = 10 * 60 * 1000;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

export type LlmReportDepsType = {
    isAiEnabled: () => boolean;
    readReportServers: () => readonly LlmReportServerType[];
    // Reads the registry afresh; resolves whatever the read did, with an
    // `error` when it could not be read.
    refreshRegistry: () => Promise<unknown>;
    fetch: (url: string, init: RequestInit) => Promise<Response>;
    now?: () => number;
};

// When the last few reports were handed in, for the ration. Bounded by the
// limit itself: a stamp older than the window leaves at the next post.
let postStampList: number[] = [];
// Posts in flight, so Stop in the help window ends the sending and not only
// the waiting. Every entry leaves in `finally`.
const controllerMap = new Map<string, AbortController>();

export function cancelLlmReportPost(requestId: unknown) {
    if (typeof requestId !== 'string') {
        return;
    }
    controllerMap.get(requestId)?.abort();
}

function genFailure(
    reason: LlmReportFailureType,
    detail: string,
): LlmReportPostResultType {
    return { ok: false, reason, detail };
}

const CANCELLED = genFailure('cancelled', 'stopped');

// All of an answer that is looked at: enough for `{"ok":false,...}` or an
// `{"error":...}`, and no more of a body nobody asked for.
const ANSWER_READ_MAX = 4096;

/**
 * Whether a 2xx answer says, in its own body, that the report was NOT kept:
 * JSON with `ok: false` or an `error`. An address in the registry can be
 * mis-set onto something that is no inbox at all -- an LLM server answers an
 * unknown POST with 200 and an error object -- and "Sent" over a report
 * nobody kept is the one thing this door must not say. An answer that is
 * not JSON, or says nothing either way, is a server that took it.
 */
async function checkIsRefusedInAnswer(response: Response) {
    const reader = response.body?.getReader();
    if (reader === undefined) {
        return false;
    }
    const decoder = new TextDecoder();
    let answer = '';
    try {
        while (answer.length < ANSWER_READ_MAX) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            answer += decoder.decode(value, { stream: true });
        }
    } catch (_error) {
        return false;
    } finally {
        reader.cancel().catch(() => {});
    }
    try {
        const data = JSON.parse(answer);
        return (
            data !== null &&
            typeof data === 'object' &&
            (data.ok === false ||
                (data.error !== undefined && data.error !== null))
        );
    } catch (_error) {
        return false;
    }
}

/** One address asked to take the report. Never throws. */
async function postToReportServer(
    server: LlmReportServerType,
    body: string,
    deps: LlmReportDepsType,
    signal: AbortSignal,
): Promise<LlmReportPostResultType> {
    const url = toCustomServerBaseUrl(server.baseUrl);
    if (url === null) {
        return genFailure(
            'unreachable',
            'the report server has no usable address',
        );
    }
    const controller = new AbortController();
    const handleAbort = () => {
        controller.abort();
    };
    signal.addEventListener('abort', handleAbort, { once: true });
    let isTimedOut = false;
    const timer = setTimeout(
        () => {
            isTimedOut = true;
            controller.abort();
        },
        POST_TIMEOUT_MILLISECONDS + toReportUploadAllowance(body.length),
    );
    try {
        const headers: Record<string, string> = {
            'content-type': 'application/json; charset=utf-8',
        };
        if (server.apiKey.length > 0) {
            headers.authorization = `Bearer ${server.apiKey}`;
        }
        const response = await deps.fetch(url, {
            method: 'POST',
            headers,
            body,
            signal: controller.signal,
            // A redirect could carry the report and the key to another
            // host; the address in the registry is the only one sent to.
            redirect: 'manual',
            credentials: 'omit',
            cache: 'no-store',
        });
        if (response.ok) {
            // Only whether it was taken matters, and the start of the
            // answer is read for that alone: its words reach nobody.
            return (await checkIsRefusedInAnswer(response))
                ? genFailure('refused', 'the report server did not keep it')
                : { ok: true };
        }
        response.body?.cancel().catch(() => {});
        if (
            response.type === 'opaqueredirect' ||
            (response.status >= 300 && response.status < 400)
        ) {
            return genFailure(
                'refused',
                'the report server sent it on to another address',
            );
        }
        if (response.status === 413) {
            // Said apart from the other refusals: the window sends the
            // words again without the files (`postIssueReport`).
            return genFailure(
                'too-large',
                'the report server said it is too large',
            );
        }
        return genFailure(
            'refused',
            `the report server answered ${response.status}`,
        );
    } catch (_error) {
        if (signal.aborted) {
            return CANCELLED;
        }
        // Not the error's own words: a failed connection names the host.
        return isTimedOut
            ? genFailure('timeout', 'the report server took too long to answer')
            : genFailure('unreachable', 'the report server did not answer');
    } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', handleAbort);
    }
}

/**
 * Posts one report. The addresses main holds are tried in the registry's
 * order; when none of them took it -- or none is known -- the registry is
 * read once more and whatever is NEW in it tried: a quick tunnel's address
 * changes every time it starts, and an app that has been open since the
 * morning still holds the morning's. Never throws.
 */
export async function runLlmReportPost(
    request: LlmReportPostRequestType,
    deps: LlmReportDepsType,
): Promise<LlmReportPostResultType> {
    if (!deps.isAiEnabled()) {
        return genFailure('ai-off', 'AI features are turned off in Settings');
    }
    const { text, requestId } = request ?? {};
    const files = toValidReportFiles(request?.files);
    if (
        typeof text !== 'string' ||
        text.trim().length === 0 ||
        text.length > REPORT_TEXT_MAX ||
        files === null ||
        (requestId !== undefined &&
            (typeof requestId !== 'string' ||
                !REQUEST_ID_PATTERN.test(requestId)))
    ) {
        return genFailure('not-allowed', 'that is not a report this app wrote');
    }
    const now = deps.now ?? Date.now;
    const startedAt = now();
    postStampList = postStampList.filter((stamp) => {
        return startedAt - stamp < POST_LIMIT_WINDOW_MILLISECONDS;
    });
    if (postStampList.length >= POST_LIMIT) {
        return genFailure(
            'too-many',
            'several reports were sent in the last few minutes; wait a ' +
                'little before sending another',
        );
    }
    postStampList.push(startedAt);
    // Written once: every address is sent the same bytes.
    const body = genReportPostBody(text, files);
    const totalTimeout =
        TOTAL_TIMEOUT_MILLISECONDS + toReportUploadAllowance(body.length);
    const controller = new AbortController();
    if (requestId !== undefined) {
        // Registered before the first `await`: a cancel sent straight after
        // the post arrives after it on the same channel.
        controllerMap.set(requestId, controller);
    }
    const { signal } = controller;
    // By address and key: an entry read again as it was is not asked twice.
    const triedKeySet = new Set<string>();
    // The last "no" of an address that was asked; none when none was.
    const failureList: LlmReportPostResultType[] = [];
    // Answers the post's fate once it is settled -- taken, or stopped --
    // and null while the next address may still be asked.
    const tryServers = async () => {
        for (const server of deps.readReportServers()) {
            const key = `${server.baseUrl}\n${server.apiKey}`;
            if (triedKeySet.has(key)) {
                continue;
            }
            if (now() - startedAt >= totalTimeout) {
                return null;
            }
            triedKeySet.add(key);
            const result = await postToReportServer(server, body, deps, signal);
            if (result.ok || signal.aborted) {
                return result;
            }
            failureList.push(result);
        }
        return null;
    };
    try {
        const first = await tryServers();
        if (first !== null) {
            return first;
        }
        const refreshed = await deps.refreshRegistry();
        if (signal.aborted) {
            return CANCELLED;
        }
        const second = await tryServers();
        if (second !== null) {
            return second;
        }
        if (
            failureList.length === 0 &&
            typeof (refreshed as { error?: unknown } | null)?.error === 'string'
        ) {
            // Nobody was asked because the list itself could not be read
            // -- this computer is offline, most likely. "No report server
            // is shared" would be a guess about a list nobody saw.
            return genFailure(
                'unreachable',
                'the list of report servers could not be read',
            );
        }
        return (
            // "Too large" first, whoever said it: it is the one refusal the
            // window can do something about -- send the words alone.
            failureList.find((one) => {
                return !one.ok && one.reason === 'too-large';
            }) ??
            failureList[failureList.length - 1] ??
            genFailure('no-server', 'no report server is shared right now')
        );
    } finally {
        if (requestId !== undefined) {
            controllerMap.delete(requestId);
        }
    }
}

// Every dependency read inside a function, never at module load -- the
// relay's own rule, for the same partial-mock reason.
const reportDeps: LlmReportDepsType = {
    isAiEnabled: () => {
        return checkIsAiEnabled();
    },
    readReportServers: () => {
        return getLlmReportServers();
    },
    refreshRegistry: () => {
        return refreshLlmRegistry();
    },
    fetch: (url, init) => {
        return fetchOnRelaySession(url, init);
    },
};

/** The IPC door. */
export function handleLlmReportPost(request: LlmReportPostRequestType) {
    return runLlmReportPost(request, reportDeps);
}

/** Tests only: no report handed in yet. */
export function resetLlmReportForTests() {
    postStampList = [];
    controllerMap.clear();
}
