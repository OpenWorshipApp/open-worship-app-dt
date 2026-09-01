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

async function post(body: any, isRetry = false): Promise<any> {
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
                await ensureSession();
                return await post(body, true);
            }
        }
        throw new Error(`The assistant service answered ${response.status}`);
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

async function ensureSession() {
    if (sessionId !== null) {
        return;
    }
    requestId += 1;
    await post({
        jsonrpc: '2.0',
        id: requestId,
        method: 'initialize',
        params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'owa-chatbot', version: '0.1.0' },
        },
    });
    await post({ jsonrpc: '2.0', method: 'notifications/initialized' });
}

export async function listTools(): Promise<McpToolType[]> {
    await ensureSession();
    requestId += 1;
    const result = await post({
        jsonrpc: '2.0',
        id: requestId,
        method: 'tools/list',
    });
    return result?.tools ?? [];
}

export async function callTool(name: string, args: any = {}) {
    await ensureSession();
    requestId += 1;
    const result = await post({
        jsonrpc: '2.0',
        id: requestId,
        method: 'tools/call',
        params: { name, arguments: args },
    });
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
