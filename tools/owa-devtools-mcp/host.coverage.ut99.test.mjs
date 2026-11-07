import http from 'node:http';
import net from 'node:net';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { pinCdpPort, resolveAppBrowserUrl } from './discovery.mjs';
import { startOwaMcpHost } from './host.mjs';

// The in-app HTTP door, driven over a real server on 127.0.0.1 port 0. What
// sits BEHIND the door -- chrome-devtools-mcp and puppeteer -- is replaced by
// a small fake MCP server that answers every request with what it was asked,
// so each test can see exactly what the door let through and what it kept
// back. `node:http` is wrapped only to hand the test the server the host made
// (and, for two start-up tests, to make `listen` fail); everything else about
// it is real.
const hostState = vi.hoisted(() => {
  const state = {
    createCalls: [],
    mcpServers: [],
    httpServers: [],
    received: [],
    closeError: null,
    patchHttpServer: null,
  };
  state.genMcpServer = () => {
    const server = {
      transport: null,
      closeCount: 0,
      onCloseCount: 0,
      async connect(transport) {
        server.transport = transport;
        await transport.start();
        transport.setProtocolVersion('2025-06-18');
        transport.onclose = () => {
          server.onCloseCount += 1;
        };
        transport.onmessage = (message) => {
          state.received.push(message);
          if (message.id === undefined || message.method === 'hang') {
            return;
          }
          if (message.method === 'explode') {
            throw new Error('the server fell over');
          }
          transport.send({
            jsonrpc: '2.0',
            id: message.id,
            result: { echo: message.method },
          });
        };
      },
      async close() {
        server.closeCount += 1;
        if (state.closeError !== null) {
          throw state.closeError;
        }
        await server.transport?.close();
      },
    };
    return server;
  };
  return state;
});

vi.mock('./server.mjs', () => {
  return {
    createOwaMcpServer: async (options) => {
      hostState.createCalls.push(options);
      const server = hostState.genMcpServer();
      hostState.mcpServers.push(server);
      return { server };
    },
  };
});
vi.mock('node:http', async (importOriginal) => {
  const actual = await importOriginal();
  const real = actual.default ?? actual;
  const createServer = (...args) => {
    const server = real.createServer(...args);
    hostState.httpServers.push(server);
    hostState.patchHttpServer?.(server);
    return server;
  };
  return { ...actual, createServer, default: { ...real, createServer } };
});

const hosts = [];
let hostLogger;

// Loopback answers in milliseconds; the long ceiling is only for a machine
// running the whole suite under coverage at once.
function waitUntil(check) {
  return vi.waitFor(check, { timeout: 5000, interval: 10 });
}

async function startHost(options = {}) {
  const host = await startOwaMcpHost({
    port: 0,
    logger: hostLogger,
    ...options,
  });
  hosts.push(host);
  return host;
}

// One request on a connection of its own, so nothing is pooled between hosts.
function request(
  host,
  { method = 'POST', path = '/mcp', headers = {}, body, token, sessionId } = {},
) {
  const finalHeaders = { ...headers };
  const bearer = token === undefined ? host.token : token;
  if (bearer !== null && finalHeaders.authorization === undefined) {
    finalHeaders.authorization = `Bearer ${bearer}`;
  }
  if (sessionId !== undefined) {
    finalHeaders['mcp-session-id'] = sessionId;
  }
  let payload;
  if (body !== undefined) {
    finalHeaders['content-type'] = 'application/json';
    payload =
      typeof body === 'string' || Buffer.isBuffer(body)
        ? body
        : JSON.stringify(body);
  }
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: host.port,
        method,
        path,
        headers: finalHeaders,
        agent: false,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json;
          try {
            json = JSON.parse(text);
          } catch {
            json = undefined;
          }
          resolve({ status: res.statusCode, headers: res.headers, text, json });
        });
      },
    );
    req.on('error', reject);
    req.end(payload);
  });
}

function callTool(host, sessionId, method, id = 7) {
  return request(host, { sessionId, body: { jsonrpc: '2.0', id, method } });
}

async function initialize(host) {
  const response = await request(host, {
    body: { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
  });
  return { ...response, sessionId: response.headers['mcp-session-id'] };
}

function readInfo(host) {
  return request(host, { method: 'GET', path: '/', token: null });
}

// A client holding the SSE stream open. Node sends the response head with the
// first write, so `response` arrives only once the server has said something.
function openEventStream(host, sessionId) {
  const stream = { chunks: [], isEnded: false, response: null };
  stream.request = http.request({
    host: '127.0.0.1',
    port: host.port,
    method: 'GET',
    path: '/mcp',
    headers: {
      authorization: `Bearer ${host.token}`,
      'mcp-session-id': sessionId,
    },
    agent: false,
  });
  stream.request.on('error', () => {});
  stream.request.on('response', (response) => {
    stream.response = response;
    response.setEncoding('utf8');
    response.on('data', (chunk) => {
      stream.chunks.push(chunk);
    });
    response.on('end', () => {
      stream.isEnded = true;
    });
    response.on('error', () => {});
  });
  stream.request.end();
  stream.readText = () => {
    return stream.chunks.join('');
  };
  return stream;
}

beforeEach(() => {
  hostState.createCalls = [];
  hostState.mcpServers = [];
  hostState.httpServers = [];
  hostState.received = [];
  hostState.closeError = null;
  hostState.patchHttpServer = null;
  hostLogger = vi.fn();
  vi.stubEnv('OWA_CDP_PORT', '');
  vi.stubEnv('OWA_CDP_TARGET', '');
});

afterEach(async () => {
  await Promise.all(
    hosts.splice(0).map((host) => {
      return host.close();
    }),
  );
  vi.useRealTimers();
  pinCdpPort(null);
  vi.unstubAllEnvs();
});

describe('the door: origin, path and credential', () => {
  // A web page in the operator's browser can reach 127.0.0.1 too. Its Origin
  // header is the one thing that says so, and it is read before the token.
  test.each([
    'https://evil.example',
    'http://localhost.evil.example',
    'http://127.0.0.1.nip.io:3000',
    'null',
    'not a url',
  ])('refuses the origin %j even with the right token', async (origin) => {
    const host = await startHost();
    const response = await request(host, {
      headers: { origin },
      body: { jsonrpc: '2.0', id: 1, method: 'initialize' },
    });
    expect(response.status).toBe(403);
    expect(response.json).toEqual({ error: 'Forbidden origin' });
    expect(hostState.createCalls).toEqual([]);
  });

  test.each([
    'http://localhost:3000',
    'https://localhost:3000',
    'http://127.0.0.1:39240',
    'file://',
  ])("lets the app's own origin %j through to the routing", async (origin) => {
    const host = await startHost();
    const response = await request(host, {
      method: 'GET',
      path: '/',
      headers: { origin },
      token: null,
    });
    expect(response.status).toBe(200);
  });

  test('GET / names the door and counts sessions, and never shows the token', async () => {
    const host = await startHost();
    const before = await readInfo(host);
    expect(before.json).toEqual({
      name: 'owa-devtools-mcp',
      transport: 'streamable-http',
      mcpUrl: host.url,
      sessions: 0,
    });
    await initialize(host);
    const after = await readInfo(host);
    expect(after.json.sessions).toBe(1);
    expect(after.text).not.toContain(host.token);
  });

  test('any other path is 404, before any token is asked for', async () => {
    const host = await startHost();
    const other = await request(host, {
      method: 'GET',
      path: '/other',
      token: null,
    });
    const deeper = await request(host, {
      path: '/mcp/extra',
      body: { jsonrpc: '2.0', id: 1, method: 'initialize' },
    });
    expect(other.status).toBe(404);
    expect(other.json).toEqual({ error: 'Not found' });
    expect(deeper.status).toBe(404);
    expect(hostState.createCalls).toEqual([]);
  });

  // The comparison is exact and of equal-length buffers: a token one
  // character off, a different scheme, a case change or a doubled space is
  // not the capability. (Space at either END is not part of a header value
  // at all -- HTTP strips it before the host sees it.)
  test('refuses every near miss of the bearer token', async () => {
    const host = await startHost();
    const flipped = (host.token[0] === 'A' ? 'B' : 'A') + host.token.slice(1);
    const nearMisses = [
      `Bearer ${flipped}`,
      `bearer ${host.token}`,
      `Bearer  ${host.token}`,
      `Bearer ${host.token}x`,
      `Bearer ${host.token.slice(1)}`,
      `Basic ${host.token}`,
      host.token,
    ];
    for (const authorization of nearMisses) {
      const response = await request(host, {
        headers: { authorization },
        body: { jsonrpc: '2.0', id: 1, method: 'initialize' },
      });
      expect(response.status).toBe(401);
      expect(response.headers['www-authenticate']).toBe('Bearer');
    }
    expect(hostState.createCalls).toEqual([]);
  });

  test('two hosts never share a token', async () => {
    const one = await startHost();
    const two = await startHost();
    expect(one.token).not.toBe(two.token);
    const crossed = await request(two, {
      token: one.token,
      body: { jsonrpc: '2.0', id: 1, method: 'initialize' },
    });
    expect(crossed.status).toBe(401);
  });
});

describe('sessions over POST', () => {
  test("initialize opens a session on the app's door and answers through it", async () => {
    const host = await startHost();
    const opened = await initialize(host);
    expect(opened.status).toBe(200);
    expect(opened.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(opened.json).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: { echo: 'initialize' },
    });
    // The HTTP door is the app's own: what its tools write says so.
    expect(hostState.createCalls).toEqual([{ door: 'app' }]);
    const { transport } = hostState.mcpServers[0];
    expect(transport.sessionId).toBe(opened.sessionId);
    expect(transport.protocolVersion).toBe('2025-06-18');
    expect(hostLogger).toHaveBeenCalledWith(
      `MCP session ${opened.sessionId} opened`,
    );
  });

  test('a request in an open session goes to that session, not a new one', async () => {
    const host = await startHost();
    const { sessionId } = await initialize(host);
    const response = await callTool(host, sessionId, 'tools/list', 2);
    expect(response.status).toBe(200);
    expect(response.headers['mcp-session-id']).toBe(sessionId);
    expect(response.json).toEqual({
      jsonrpc: '2.0',
      id: 2,
      result: { echo: 'tools/list' },
    });
    expect(hostState.createCalls).toHaveLength(1);
  });

  test('a notification is taken with 202 and no body', async () => {
    const host = await startHost();
    const { sessionId } = await initialize(host);
    const response = await request(host, {
      sessionId,
      body: { jsonrpc: '2.0', method: 'notifications/initialized' },
    });
    expect(response.status).toBe(202);
    expect(response.text).toBe('');
    expect(response.headers['mcp-session-id']).toBe(sessionId);
    expect(hostState.received.at(-1)).toEqual({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });
  });

  test('a batch answers its requests, in order, and drops the notifications', async () => {
    const host = await startHost();
    const { sessionId } = await initialize(host);
    const response = await request(host, {
      sessionId,
      body: [
        { jsonrpc: '2.0', id: 2, method: 'tools/list' },
        { jsonrpc: '2.0', method: 'notifications/progress' },
        { jsonrpc: '2.0', id: 3, method: 'tools/call' },
      ],
    });
    expect(response.status).toBe(200);
    expect(response.json).toEqual([
      { jsonrpc: '2.0', id: 2, result: { echo: 'tools/list' } },
      { jsonrpc: '2.0', id: 3, result: { echo: 'tools/call' } },
    ]);
  });

  test('a batch of notifications only is 202', async () => {
    const host = await startHost();
    const { sessionId } = await initialize(host);
    const response = await request(host, {
      sessionId,
      body: [
        { jsonrpc: '2.0', method: 'notifications/one' },
        { jsonrpc: '2.0', method: 'notifications/two' },
      ],
    });
    expect(response.status).toBe(202);
    expect(
      hostState.received.slice(-2).map((message) => {
        return message.method;
      }),
    ).toEqual(['notifications/one', 'notifications/two']);
  });

  test('an initialize inside a batch opens the session too', async () => {
    const host = await startHost();
    const response = await request(host, {
      body: [
        { jsonrpc: '2.0', id: 1, method: 'initialize' },
        { jsonrpc: '2.0', method: 'notifications/initialized' },
      ],
    });
    expect(response.status).toBe(200);
    expect(response.json).toEqual([
      { jsonrpc: '2.0', id: 1, result: { echo: 'initialize' } },
    ]);
    expect(response.headers['mcp-session-id']).toBe(
      hostState.mcpServers[0].transport.sessionId,
    );
  });

  test('a body that is not JSON is a parse error, and opens nothing', async () => {
    const host = await startHost();
    const response = await request(host, { body: '{"jsonrpc": "2.0",' });
    expect(response.status).toBe(400);
    expect(response.json).toEqual({
      jsonrpc: '2.0',
      error: { code: -32700, message: 'Parse error' },
      id: null,
    });
    expect(hostState.createCalls).toEqual([]);
  });

  test('a session the host does not have is 404, and opens nothing', async () => {
    const host = await startHost();
    const response = await callTool(
      host,
      '00000000-0000-0000-0000-000000000000',
      'tools/list',
    );
    expect(response.status).toBe(404);
    expect(response.json).toEqual({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Unknown session' },
      id: null,
    });
    expect(hostState.createCalls).toEqual([]);
  });

  test('a request the session throws on is answered 500 and logged, and the host keeps serving', async () => {
    const host = await startHost();
    const { sessionId } = await initialize(host);
    const failed = await callTool(host, sessionId, 'explode');
    expect(failed.status).toBe(500);
    expect(failed.json).toEqual({ error: 'the server fell over' });
    expect(hostLogger).toHaveBeenCalledWith(
      'MCP host request failed',
      expect.objectContaining({ message: 'the server fell over' }),
    );
    expect((await callTool(host, sessionId, 'tools/list')).status).toBe(200);
  });

  // 4 MB is far past any real message; past it the socket is cut rather than
  // the whole body being held in memory on a low-spec machine.
  test('a body over 4 MB is cut off before it reaches a session', async () => {
    const host = await startHost();
    const body = Buffer.alloc(4 * 1024 * 1024 + 1, 0x20);
    const outcome = await request(host, { body }).catch((error) => {
      return { status: 'reset', error };
    });
    await waitUntil(() => {
      expect(hostLogger).toHaveBeenCalledWith(
        'MCP host request failed',
        expect.objectContaining({ message: 'Request body too large' }),
      );
    });
    expect(outcome.status).not.toBe(200);
    expect(hostState.createCalls).toEqual([]);
    // The host survives it.
    expect((await readInfo(host)).status).toBe(200);
  });
});

describe('ending sessions', () => {
  test('GET and DELETE need a session the host knows', async () => {
    const host = await startHost();
    const noSession = await request(host, { method: 'GET' });
    const unknown = await request(host, {
      method: 'DELETE',
      sessionId: '00000000-0000-0000-0000-000000000000',
    });
    expect(noSession.status).toBe(404);
    expect(noSession.json).toEqual({ error: 'Unknown session' });
    expect(unknown.status).toBe(404);
  });

  test('DELETE closes the session and its server, and the id stops working', async () => {
    const host = await startHost();
    const { sessionId } = await initialize(host);
    const deleted = await request(host, { method: 'DELETE', sessionId });
    expect(deleted.status).toBe(204);
    expect(hostState.mcpServers[0].closeCount).toBe(1);
    expect(hostState.mcpServers[0].onCloseCount).toBe(1);
    expect((await callTool(host, sessionId, 'tools/list')).status).toBe(404);
    expect((await readInfo(host)).json.sessions).toBe(0);
  });

  test('a request still waiting when its session closes is answered, not left hanging', async () => {
    const host = await startHost();
    const { sessionId } = await initialize(host);
    const waiting = callTool(host, sessionId, 'hang', 9);
    await waitUntil(() => {
      expect(
        hostState.received.some((message) => {
          return message.method === 'hang';
        }),
      ).toBe(true);
    });
    expect((await request(host, { method: 'DELETE', sessionId })).status).toBe(
      204,
    );
    const answered = await waiting;
    expect(answered.status).toBe(202);
    expect(answered.text).toBe('');
  });

  test('a session whose server fails to close is still let go, and the failure logged', async () => {
    const host = await startHost();
    const { sessionId } = await initialize(host);
    hostState.closeError = new Error('browser already gone');
    const deleted = await request(host, { method: 'DELETE', sessionId });
    expect(deleted.status).toBe(204);
    expect(hostLogger).toHaveBeenCalledWith(
      'Failed to close an MCP session',
      hostState.closeError,
    );
    expect((await callTool(host, sessionId, 'tools/list')).status).toBe(404);
  });

  test('a method the door does not speak is 405, naming the ones it does', async () => {
    const host = await startHost();
    const { sessionId } = await initialize(host);
    const response = await request(host, { method: 'PUT', sessionId });
    expect(response.status).toBe(405);
    expect(response.headers.allow).toBe('GET, POST, DELETE');
  });

  // Each session holds an MCP server and a browser connection. Something that
  // reconnects in a loop must not pile them up on the operator's machine, and
  // whoever is asking NOW is the one in front of the app.
  test('at the cap the least recently used session makes room for the new one', async () => {
    let now = 1_000;
    vi.spyOn(Date, 'now').mockImplementation(() => {
      return now;
    });
    const host = await startHost();
    const idList = [];
    for (let index = 0; index < 8; index += 1) {
      now += 1_000;
      idList.push((await initialize(host)).sessionId);
    }
    now += 1_000;
    // The first one is used again, so the SECOND is now the oldest.
    expect((await callTool(host, idList[0], 'tools/list')).status).toBe(200);
    now += 1_000;
    const ninth = await initialize(host);
    expect(ninth.status).toBe(200);
    expect(hostLogger).toHaveBeenCalledWith(
      `MCP session ${idList[1]} closed to make room`,
    );
    expect(
      hostState.mcpServers.map((server) => {
        return server.closeCount;
      }),
    ).toEqual([0, 1, 0, 0, 0, 0, 0, 0, 0]);
    expect((await callTool(host, idList[1], 'tools/list')).status).toBe(404);
    expect((await callTool(host, idList[0], 'tools/list')).status).toBe(200);
    expect((await readInfo(host)).json.sessions).toBe(8);
  });

  test('a session idle for 15 minutes is swept; one in use is kept', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => {
      return now;
    });
    const host = await startHost();
    const idle = await initialize(host);
    const busy = await initialize(host);
    now = 14 * 60 * 1000;
    expect((await callTool(host, busy.sessionId, 'tools/list')).status).toBe(
      200,
    );
    now = 15 * 60 * 1000 + 1;
    vi.advanceTimersByTime(60 * 1000);
    expect(hostState.mcpServers[0].closeCount).toBe(1);
    expect(hostState.mcpServers[1].closeCount).toBe(0);
    expect((await callTool(host, idle.sessionId, 'tools/list')).status).toBe(
      404,
    );
    expect((await callTool(host, busy.sessionId, 'tools/list')).status).toBe(
      200,
    );
  });

  test('closing the host ends every session and stops listening', async () => {
    const host = await startOwaMcpHost({ port: 0, logger: hostLogger });
    await initialize(host);
    await initialize(host);
    await host.close();
    expect(
      hostState.mcpServers.map((server) => {
        return server.closeCount;
      }),
    ).toEqual([1, 1]);
    expect(hostState.httpServers.at(-1).listening).toBe(false);
  });
});

describe('the event stream', () => {
  // A request the SERVER starts (it has an id, but no client asked for it)
  // has only the stream to travel on.
  test('a server-initiated message reaches the open stream', async () => {
    const host = await startHost();
    const { sessionId } = await initialize(host);
    const { transport } = hostState.mcpServers[0];
    const stream = openEventStream(host, sessionId);
    await waitUntil(() => {
      expect(transport.sseResponse).not.toBe(null);
    });
    const message = {
      jsonrpc: '2.0',
      id: 'server-1',
      method: 'sampling/createMessage',
    };
    await transport.send(message);
    await waitUntil(() => {
      expect(stream.readText()).toBe(`data: ${JSON.stringify(message)}\n\n`);
    });
    expect(stream.response.statusCode).toBe(200);
    expect(stream.response.headers['content-type']).toBe('text/event-stream');
    expect(stream.response.headers['cache-control']).toBe('no-cache');
  });

  test('a second stream replaces the first, which is ended', async () => {
    const host = await startHost();
    const { sessionId } = await initialize(host);
    const { transport } = hostState.mcpServers[0];
    const first = openEventStream(host, sessionId);
    await waitUntil(() => {
      expect(transport.sseResponse).not.toBe(null);
    });
    const firstResponse = transport.sseResponse;
    await transport.send({ jsonrpc: '2.0', method: 'notifications/one' });
    await waitUntil(() => {
      expect(first.readText()).toContain('notifications/one');
    });
    const firstClosed = new Promise((resolve) => {
      firstResponse.once('close', resolve);
    });

    const second = openEventStream(host, sessionId);
    await waitUntil(() => {
      expect(transport.sseResponse).not.toBe(firstResponse);
      expect(transport.sseResponse).not.toBe(null);
    });
    const secondResponse = transport.sseResponse;
    await firstClosed;
    await waitUntil(() => {
      expect(first.isEnded).toBe(true);
    });
    // The first stream's own close must not take the second one with it.
    expect(transport.sseResponse).toBe(secondResponse);

    await transport.send({ jsonrpc: '2.0', method: 'notifications/two' });
    await waitUntil(() => {
      expect(second.readText()).toContain('notifications/two');
    });
    expect(first.readText()).not.toContain('notifications/two');
  });

  test('a stream the client closes is let go, and nothing is queued for the next', async () => {
    const host = await startHost();
    const { sessionId } = await initialize(host);
    const { transport } = hostState.mcpServers[0];
    const first = openEventStream(host, sessionId);
    await waitUntil(() => {
      expect(transport.sseResponse).not.toBe(null);
    });
    await transport.send({ jsonrpc: '2.0', method: 'notifications/hello' });
    await waitUntil(() => {
      expect(first.readText()).toContain('notifications/hello');
    });

    first.request.destroy();
    await waitUntil(() => {
      expect(transport.sseResponse).toBe(null);
    });
    // Nobody is listening: dropped, not held for whoever comes next.
    await expect(
      transport.send({ jsonrpc: '2.0', method: 'notifications/dropped' }),
    ).resolves.toBe(undefined);

    const next = openEventStream(host, sessionId);
    await waitUntil(() => {
      expect(transport.sseResponse).not.toBe(null);
    });
    await transport.send({ jsonrpc: '2.0', method: 'notifications/after' });
    await waitUntil(() => {
      expect(next.readText()).toContain('notifications/after');
    });
    expect(next.readText()).not.toContain('notifications/dropped');
  });

  test('deleting the session ends its stream', async () => {
    const host = await startHost();
    const { sessionId } = await initialize(host);
    const { transport } = hostState.mcpServers[0];
    const stream = openEventStream(host, sessionId);
    await waitUntil(() => {
      expect(transport.sseResponse).not.toBe(null);
    });
    await transport.send({ jsonrpc: '2.0', method: 'notifications/hello' });
    await waitUntil(() => {
      expect(stream.response).not.toBe(null);
    });
    expect((await request(host, { method: 'DELETE', sessionId })).status).toBe(
      204,
    );
    await waitUntil(() => {
      expect(stream.isEnded).toBe(true);
    });
    expect(transport.sseResponse).toBe(null);
  });
});

describe('the port', () => {
  test('a busy preferred port falls back to a free one, and the URL says which', async () => {
    const blocker = net.createServer();
    await new Promise((resolve) => {
      blocker.listen(0, '127.0.0.1', resolve);
    });
    const busyPort = blocker.address().port;
    try {
      const host = await startHost({ port: busyPort });
      expect(host.port).not.toBe(busyPort);
      expect(host.url).toBe(`http://127.0.0.1:${host.port}/mcp`);
      expect((await readInfo(host)).json.mcpUrl).toBe(host.url);
    } finally {
      await new Promise((resolve) => {
        blocker.close(resolve);
      });
    }
  });

  // One fallback only, and a failure of it is a rejected start: an 'error'
  // event nobody listens for would throw out of band and take the app down.
  test('when neither port can be had the start is refused, never thrown out of band', async () => {
    hostState.patchHttpServer = (server) => {
      let count = 0;
      server.listen = () => {
        count += 1;
        const error = Object.assign(
          new Error(count === 1 ? 'preferred port taken' : 'no port at all'),
          { code: 'EADDRINUSE' },
        );
        process.nextTick(() => {
          server.emit('error', error);
        });
        return server;
      };
    };
    await expect(startOwaMcpHost({ port: 39223 })).rejects.toThrow(
      'no port at all',
    );
  });

  test('a fallback listen that throws refuses the start with that error', async () => {
    hostState.patchHttpServer = (server) => {
      let count = 0;
      server.listen = () => {
        count += 1;
        if (count === 1) {
          process.nextTick(() => {
            server.emit('error', new Error('preferred port taken'));
          });
          return server;
        }
        throw new Error('cannot listen at all');
      };
    };
    await expect(startOwaMcpHost({ port: 39223 })).rejects.toThrow(
      'cannot listen at all',
    );
  });

  test('after a good start an error is logged, never thrown, and never re-listens', async () => {
    const host = await startHost();
    const server = hostState.httpServers.at(-1);
    // The fallback did not outlive the successful listen.
    expect(server.listenerCount('error')).toBe(1);
    const late = new Error('late trouble');
    expect(() => {
      server.emit('error', late);
    }).not.toThrow();
    expect(hostLogger).toHaveBeenCalledWith('MCP host server error', late);
    expect(server.address().port).toBe(host.port);
    expect((await readInfo(host)).status).toBe(200);
  });

  // Discovery is newest-first, which is right for the stdio bin and wrong for
  // a server living inside ONE instance: the packaged app's chatbot drove the
  // dev window started after it.
  test('getCdpPort pins discovery to the instance the host lives in', async () => {
    const newer = { port: 60401, startedAt: '2026-11-03T00:30:00.000Z' };
    await startHost();
    expect(resolveAppBrowserUrl([newer])).toBe('http://127.0.0.1:60401');
    await startHost({ getCdpPort: () => 60377 });
    expect(resolveAppBrowserUrl([newer])).toBe('http://127.0.0.1:60377');
  });
});
