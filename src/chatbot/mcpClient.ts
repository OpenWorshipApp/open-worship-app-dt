// The chatbot's client for `owa-devtools-mcp`, which the main process serves
// over HTTP while the app runs (`electron/aiHelpers.ts` -> `startMcpHost`).
//
// The port is picked at launch, so it is asked for rather than hardcoded. One
// session is opened on demand and reused; nothing is cached between answers
// except that session id.

import appProvider from '../server/appProvider';

export type McpToolType = {
    name: string;
    description?: string;
};

type AiEndpointsType = {
    mcpUrl: string | null;
    cdpPort: number | null;
};

let sessionId: string | null = null;
let requestId = 0;

export function getAiEndpoints(): AiEndpointsType {
    try {
        return appProvider.messageUtils.sendDataSync(
            'main:app:get-ai-endpoints',
        );
    } catch (_error) {
        return { mcpUrl: null, cdpPort: null };
    }
}

/**
 * The app's OWN tool host failed -- not the AI provider, and not the question.
 *
 * Its own class so the window can say that in words. Measured 2026-09-12: the
 * host answered 500 twice in a row, the offline guide (which searches through
 * the same host) failed with it, and the volunteer was shown "I could not
 * answer that: The assistant service answered 500" -- a status code and
 * nothing to do about it. On the path where the guide DID answer, the note
 * over it blamed the provider ("Free could not answer"), on a day Free really
 * was broken for a reason of its own, which made the two impossible to tell
 * apart.
 *
 * The status goes in `hostStatus`, for whoever reads the console, and
 * deliberately NOT in `status`: `readLlmIssue` reads that field as the
 * provider's, and a 500 there is a provider fault -- which would hand the
 * question to another of the user's keys for a failure no key can fix.
 */
export class ToolHostError extends Error {
    hostStatus: number;

    constructor(hostStatus: number) {
        super(
            "The app's own help service did not respond. Try again in a " +
                'moment; if it keeps happening, restart the app with View → ' +
                'Relaunch in the main window.',
        );
        this.name = 'ToolHostError';
        this.hostStatus = hostStatus;
    }
}

export function checkIsToolHostError(error: any): error is ToolHostError {
    return error instanceof ToolHostError;
}

// Every call takes the caller's stop signal, all the way down to the `fetch`
// that does the work: a question the user gave up on must stop asking the
// tool host too, not just stop listening to it.
async function post(
    body: any,
    isRetry = false,
    signal?: AbortSignal | null,
): Promise<any> {
    const { mcpUrl } = getAiEndpoints();
    if (mcpUrl === null) {
        throw new Error(
            'The assistant service is not running in this app instance.',
        );
    }
    const headers: Record<string, string> = {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
    };
    if (sessionId !== null) {
        headers['mcp-session-id'] = sessionId;
    }
    const response = await fetch(mcpUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        // Undefined when nobody passed one, which is what `fetch` wants:
        // handing it `null` is a type error, not "no signal".
        signal: signal ?? undefined,
    });
    const newSessionId = response.headers.get('mcp-session-id');
    if (newSessionId) {
        sessionId = newSessionId;
    }
    if (!response.ok) {
        // The host sweeps a session that has been idle for fifteen minutes,
        // which is exactly what a help window left open through a service
        // does. Opening a new one and asking again HERE is what makes that
        // invisible -- surfacing it instead meant the first question after
        // the break always failed and fell back to the offline bot, and the
        // second one worked.
        if (response.status === 404) {
            sessionId = null;
            // Never re-open a session to replay the call that opens one --
            // that is how a host answering 404 to everything becomes an
            // endless loop instead of one honest error.
            if (!isRetry && body?.method !== 'initialize') {
                await ensureSession(signal);
                return await post(body, true, signal);
            }
        }
        throw new ToolHostError(response.status);
    }
    if (response.status === 202) {
        return null;
    }
    const data = await response.json();
    if (data?.error) {
        throw new Error(data.error.message ?? 'The assistant call failed');
    }
    return data?.result ?? null;
}

async function ensureSession(signal?: AbortSignal | null) {
    if (sessionId !== null) {
        return;
    }
    requestId += 1;
    await post(
        {
            jsonrpc: '2.0',
            id: requestId,
            method: 'initialize',
            params: {
                protocolVersion: '2025-06-18',
                capabilities: {},
                clientInfo: { name: 'owa-chatbot', version: '0.1.0' },
            },
        },
        false,
        signal,
    );
    await post(
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        false,
        signal,
    );
}

export async function listTools(
    signal?: AbortSignal | null,
): Promise<McpToolType[]> {
    await ensureSession(signal);
    requestId += 1;
    const result = await post(
        {
            jsonrpc: '2.0',
            id: requestId,
            method: 'tools/list',
        },
        false,
        signal,
    );
    return result?.tools ?? [];
}

export async function callTool(
    name: string,
    args: any = {},
    signal?: AbortSignal | null,
) {
    await ensureSession(signal);
    requestId += 1;
    const result = await post(
        {
            jsonrpc: '2.0',
            id: requestId,
            method: 'tools/call',
            params: { name, arguments: args },
        },
        false,
        signal,
    );
    const text = (result?.content ?? [])
        .filter((item: any) => {
            return item?.type === 'text';
        })
        .map((item: any) => {
            return item.text;
        })
        .join('\n');
    if (result?.isError) {
        throw new Error(text || 'The tool call failed');
    }
    return text;
}

export function parseToolJson(text: string) {
    try {
        return JSON.parse(text);
    } catch (_error) {
        return null;
    }
}
