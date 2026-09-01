// The in-app front door: the same MCP server as `bin.mjs`, served over HTTP so
// the app's own chatbot -- and any outside client that would rather connect
// than spawn a process -- can reach it while the app is running.
//
// Transport: MCP "streamable HTTP". POST carries a JSON-RPC message and gets
// its response back (JSON for a request, 202 for a notification); GET opens an
// SSE stream for anything the server starts on its own; DELETE ends a session.
// It is hand-rolled against `node:http` on purpose -- pulling the MCP SDK in
// would put a second copy of it (and its transitive tree) inside an app that
// has to run on very low-spec machines, for one class this file implements in
// ~120 lines.
//
// Bound to 127.0.0.1 and Origin-checked: a page in a browser must not be able
// to drive the operator's app.

import http from 'node:http';

export const DEFAULT_MCP_PORT = 39223;
const MCP_PATH = '/mcp';
const SESSION_IDLE_MILLISECONDS = 15 * 60 * 1000;
const SWEEP_INTERVAL_MILLISECONDS = 60 * 1000;
const MAX_BODY_BYTES = 4 * 1024 * 1024;
// Every session holds its own MCP server and a browser connection behind it.
// In practice there are two -- the app's chatbot and one outside agent -- so a
// handful is generous; what this stops is an unbounded pile of them growing on
// an operator's machine because something reconnected in a loop.
const MAX_SESSION_COUNT = 8;

class HttpSessionTransport {
    constructor(sessionId) {
        this.sessionId = sessionId;
        this.pendingResponseMap = new Map();
        this.sseResponse = null;
    }

    async start() {}

    setProtocolVersion(version) {
        this.protocolVersion = version;
    }

    async send(message) {
        const pending =
            message.id === undefined
                ? undefined
                : this.pendingResponseMap.get(message.id);
        if (pending !== undefined) {
            this.pendingResponseMap.delete(message.id);
            pending(message);
            return;
        }
        // Server-initiated: only reachable while a client holds the SSE
        // stream open. Nothing here needs delivery guarantees, so an absent
        // stream drops it rather than growing a queue that no one drains.
        if (this.sseResponse !== null) {
            this.sseResponse.write(`data: ${JSON.stringify(message)}\n\n`);
        }
    }

    async close() {
        for (const pending of this.pendingResponseMap.values()) {
            pending(null);
        }
        this.pendingResponseMap.clear();
        this.sseResponse?.end();
        this.sseResponse = null;
        this.onclose?.();
    }

    /** Feeds one client message in and waits for its response, if any. */
    handleMessage(message) {
        if (message.id === undefined) {
            this.onmessage?.(message);
            return Promise.resolve(null);
        }
        return new Promise((resolve) => {
            this.pendingResponseMap.set(message.id, resolve);
            this.onmessage?.(message);
        });
    }
}

function checkIsAllowedOrigin(origin) {
    if (!origin) {
        return true;
    }
    try {
        const { hostname, protocol } = new URL(origin);
        return (
            protocol === 'file:' ||
            ['127.0.0.1', 'localhost', '::1'].includes(hostname)
        );
    } catch {
        return false;
    }
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on('data', (chunk) => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                reject(new Error('Request body too large'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            resolve(Buffer.concat(chunks).toString('utf-8'));
        });
        req.on('error', reject);
    });
}

function sendJson(res, status, body, headers = {}) {
    const text = JSON.stringify(body);
    res.writeHead(status, {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(text),
        ...headers,
    });
    res.end(text);
}

/**
 * Starts the HTTP MCP host. `port` is a preference, not a promise: a busy port
 * (a second instance, something else on the machine) falls through to a free
 * one, and the URL that comes back is the one to publish.
 */
export async function startOwaMcpHost({
    port = DEFAULT_MCP_PORT,
    logger = () => {},
} = {}) {
    const sessionMap = new Map();

    async function closeSession(sessionId) {
        const session = sessionMap.get(sessionId);
        if (session === undefined) {
            return;
        }
        sessionMap.delete(sessionId);
        try {
            await session.server.close();
        } catch (error) {
            logger('Failed to close an MCP session', error);
        }
    }

    async function getSession(sessionId) {
        const session = sessionMap.get(sessionId);
        if (session !== undefined) {
            session.lastUsedAt = Date.now();
        }
        return session;
    }

    async function createSession() {
        // At the cap the least recently used one goes, rather than refusing
        // the new client: whoever is asking now is the one in front of the app.
        while (sessionMap.size >= MAX_SESSION_COUNT) {
            const [oldestId] = [...sessionMap.entries()].sort((one, other) => {
                return one[1].lastUsedAt - other[1].lastUsedAt;
            })[0];
            logger(`MCP session ${oldestId} closed to make room`);
            await closeSession(oldestId);
        }
        const sessionId = crypto.randomUUID();
        const transport = new HttpSessionTransport(sessionId);
        // Imported here, not at module load: this pulls in chrome-devtools-mcp
        // (and puppeteer behind it). An app nobody asks for help stays exactly
        // as light as it was.
        const { createOwaMcpServer } = await import('./server.mjs');
        const { server } = await createOwaMcpServer();
        await server.connect(transport);
        const session = { sessionId, transport, server, lastUsedAt: Date.now() };
        sessionMap.set(sessionId, session);
        logger(`MCP session ${sessionId} opened`);
        return session;
    }

    async function handlePost(req, res, sessionId) {
        const rawBody = await readBody(req);
        let payload;
        try {
            payload = JSON.parse(rawBody);
        } catch {
            sendJson(res, 400, {
                jsonrpc: '2.0',
                error: { code: -32700, message: 'Parse error' },
                id: null,
            });
            return;
        }
        const messages = Array.isArray(payload) ? payload : [payload];
        const isInitializing = messages.some((message) => {
            return message?.method === 'initialize';
        });
        let session = await getSession(sessionId);
        if (session === undefined) {
            if (!isInitializing) {
                sendJson(res, 404, {
                    jsonrpc: '2.0',
                    error: { code: -32001, message: 'Unknown session' },
                    id: null,
                });
                return;
            }
            session = await createSession();
        }
        // A tool call runs a browser round trip; the socket must not be timed
        // out from under it.
        res.setTimeout(0);
        const results = await Promise.all(
            messages.map((message) => {
                return session.transport.handleMessage(message);
            }),
        );
        const responses = results.filter((result) => {
            return result !== null && result !== undefined;
        });
        const headers = { 'mcp-session-id': session.sessionId };
        if (responses.length === 0) {
            res.writeHead(202, headers);
            res.end();
            return;
        }
        sendJson(
            res,
            200,
            Array.isArray(payload) ? responses : responses[0],
            headers,
        );
    }

    async function handleGet(res, session) {
        res.writeHead(200, {
            'content-type': 'text/event-stream',
            'cache-control': 'no-cache',
            connection: 'keep-alive',
        });
        res.setTimeout(0);
        // One stream per session. A client that opens a second one (a reload,
        // a retry after a dropped socket) would otherwise leave the first
        // response open with nothing on the other end of it.
        const previousResponse = session.transport.sseResponse;
        if (previousResponse !== null && previousResponse !== res) {
            previousResponse.end();
        }
        session.transport.sseResponse = res;
        res.on('close', () => {
            if (session.transport.sseResponse === res) {
                session.transport.sseResponse = null;
            }
        });
    }

    const server = http.createServer(async (req, res) => {
        try {
            if (!checkIsAllowedOrigin(req.headers.origin)) {
                sendJson(res, 403, { error: 'Forbidden origin' });
                return;
            }
            const url = new URL(req.url, 'http://127.0.0.1');
            const sessionId = req.headers['mcp-session-id'];
            if (url.pathname === '/' && req.method === 'GET') {
                sendJson(res, 200, {
                    name: 'owa-devtools-mcp',
                    transport: 'streamable-http',
                    mcpUrl: `http://127.0.0.1:${server.address().port}${MCP_PATH}`,
                    sessions: sessionMap.size,
                });
                return;
            }
            if (url.pathname !== MCP_PATH) {
                sendJson(res, 404, { error: 'Not found' });
                return;
            }
            if (req.method === 'POST') {
                await handlePost(req, res, sessionId);
                return;
            }
            const session = await getSession(sessionId);
            if (session === undefined) {
                sendJson(res, 404, { error: 'Unknown session' });
                return;
            }
            if (req.method === 'GET') {
                await handleGet(res, session);
                return;
            }
            if (req.method === 'DELETE') {
                await closeSession(sessionId);
                res.writeHead(204);
                res.end();
                return;
            }
            res.writeHead(405, { allow: 'GET, POST, DELETE' });
            res.end();
        } catch (error) {
            logger('MCP host request failed', error);
            if (!res.headersSent) {
                sendJson(res, 500, { error: String(error?.message ?? error) });
            } else {
                res.end();
            }
        }
    });

    await new Promise((resolve, reject) => {
        const handleFallback = (error) => {
            // Preferred port taken -- another instance, or something else on
            // the machine. The published URL is what clients follow anyway.
            // Only ONE fallback: if a free port cannot be had either, this is
            // not a busy-port problem, and an unhandled 'error' event would
            // throw out of band and take the whole app down with it -- which
            // is precisely what `electron/aiHelpers.ts` promises never to do.
            server.once('error', reject);
            try {
                server.listen(0, '127.0.0.1', resolve);
            } catch (listenError) {
                reject(listenError ?? error);
            }
        };
        server.once('error', handleFallback);
        server.listen(port, '127.0.0.1', () => {
            // Consumed or not, the fallback must not survive a successful
            // listen: a later runtime error would otherwise call `listen` on
            // an already-listening server (ERR_SERVER_ALREADY_LISTEN).
            server.removeListener('error', handleFallback);
            resolve();
        });
    });
    // From here on an error is logged, never thrown: a server that has already
    // started must not be able to end the process it is a guest in.
    server.on('error', (error) => {
        logger('MCP host server error', error);
    });

    // Sessions hold a browser connection; an agent that walks away should not
    // keep it (or its memory) alive on the operator's machine.
    const sweepId = setInterval(() => {
        const deadline = Date.now() - SESSION_IDLE_MILLISECONDS;
        for (const [sessionId, session] of sessionMap) {
            if (session.lastUsedAt < deadline) {
                closeSession(sessionId);
            }
        }
    }, SWEEP_INTERVAL_MILLISECONDS);
    sweepId.unref?.();

    const actualPort = server.address().port;
    return {
        port: actualPort,
        url: `http://127.0.0.1:${actualPort}${MCP_PATH}`,
        async close() {
            clearInterval(sweepId);
            await Promise.all(
                [...sessionMap.keys()].map((sessionId) => {
                    return closeSession(sessionId);
                }),
            );
            await new Promise((resolve) => {
                server.close(resolve);
            });
        },
    };
}
