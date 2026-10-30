import http from 'node:http';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The HTTP door, driven over real loopback sockets on a free port. The MCP
// server behind each session is a fake that answers every request with what
// it was asked, so these tests are about the DOOR: who it lets in, how a
// session is opened, answered, streamed to, swept and closed.
const mocks = vi.hoisted(() => ({
  pinCdpPort: vi.fn(),
  createOwaMcpServer: vi.fn(),
  servers: [],
}));

vi.mock('./discovery.mjs', () => ({ pinCdpPort: mocks.pinCdpPort }));
vi.mock('./server.mjs', () => ({
  createOwaMcpServer: mocks.createOwaMcpServer,
}));

import { DEFAULT_MCP_PORT, startOwaMcpHost } from './host.mjs';

// An MCP server as far as the transport can tell: it echoes each request's
// method back, never answers `never`, and records notifications.
function genFakeServer({ closeError = null } = {}) {
  const server = {
    transport: null,
    notifications: [],
    closedTransportCount: 0,
    connect: vi.fn(async (transport) => {
      server.transport = transport;
      await transport.start();
      transport.setProtocolVersion('2025-06-18');
      transport.onclose = () => {
        server.closedTransportCount += 1;
      };
      transport.onmessage = (message) => {
        if (message.id === undefined) {
          server.notifications.push(message.method);
          return;
        }
        if (message.method === 'never') {
          return;
        }
        transport.send({
          jsonrpc: '2.0',
          id: message.id,
          result: { echo: message.method },
        });
      };
    }),
    close: vi.fn(async () => {
      if (closeError !== null) {
        throw closeError;
      }
      await server.transport.close();
    }),
  };
  mocks.servers.push(server);
  return server;
}

const hosts = [];

async function startHost(options = {}) {
  const host = await startOwaMcpHost({ port: 0, ...options });
  hosts.push(host);
  return host;
}

function request(
  host,
  { method = 'POST', path = '/mcp', headers = {}, body } = {},
) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: host.port,
        method,
        path,
        headers,
        agent: false,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf-8');
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {
            // Not every answer has a body.
          }
          resolve({ status: res.statusCode, headers: res.headers, text, json });
        });
      },
    );
    req.on('error', reject);
    if (body !== undefined) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function authHeaders(host, sessionId) {
  return {
    authorization: `Bearer ${host.token}`,
    'content-type': 'application/json',
    ...(sessionId === undefined ? {} : { 'mcp-session-id': sessionId }),
  };
}

async function openSession(host) {
  const response = await request(host, {
    headers: authHeaders(host),
    body: { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
  });
  expect(response.status).toBe(200);
  return {
    response,
    sessionId: response.headers['mcp-session-id'],
    server: mocks.servers[mocks.servers.length - 1],
  };
}

// The SSE stream. Its headers reach the client with the first thing written
// on it, so the promise resolves once the server has said something.
function openStream(host, sessionId) {
  let req;
  const promise = new Promise((resolve, reject) => {
    req = http.request(
      {
        host: '127.0.0.1',
        port: host.port,
        method: 'GET',
        path: '/mcp',
        headers: authHeaders(host, sessionId),
        agent: false,
      },
      (res) => {
        const stream = { res, text: '', isEnded: false };
        res.setEncoding('utf-8');
        res.on('data', (chunk) => {
          stream.text += chunk;
        });
        res.on('end', () => {
          stream.isEnded = true;
        });
        resolve(stream);
      },
    );
    req.on('error', (error) => {
      if (error.code !== 'ECONNRESET') {
        reject(error);
      }
    });
    req.end();
  });
  return { promise, destroy: () => req.destroy() };
}

beforeEach(() => {
  mocks.servers.length = 0;
  mocks.createOwaMcpServer.mockImplementation(async () => {
    return { server: genFakeServer() };
  });
});

afterEach(async () => {
  await Promise.all(hosts.splice(0).map((host) => host.close()));
  vi.useRealTimers();
});

describe('the door before a session', () => {
  it('serves a description at the root, without the token in it', async () => {
    const host = await startHost();
    expect(host.port).not.toBe(DEFAULT_MCP_PORT);
    expect(host.url).toBe(`http://127.0.0.1:${host.port}/mcp`);

    const root = await request(host, { method: 'GET', path: '/' });
    expect(root.status).toBe(200);
    expect(root.json).toEqual({
      name: 'owa-devtools-mcp',
      transport: 'streamable-http',
      mcpUrl: host.url,
      sessions: 0,
    });
    expect(root.text).not.toContain(host.token);

    const elsewhere = await request(host, { method: 'GET', path: '/other' });
    expect(elsewhere.status).toBe(404);
    expect(elsewhere.json).toEqual({ error: 'Not found' });
  });

  it('refuses a web page from somewhere else, even holding the token', async () => {
    const host = await startHost();
    for (const origin of ['https://evil.example', 'not a url']) {
      const response = await request(host, {
        headers: { ...authHeaders(host), origin },
        body: { jsonrpc: '2.0', id: 1, method: 'initialize' },
      });
      expect(response.status, origin).toBe(403);
      expect(response.json).toEqual({ error: 'Forbidden origin' });
    }
    expect(mocks.createOwaMcpServer).not.toHaveBeenCalled();

    // The app's own pages and loopback are this machine.
    for (const origin of [
      'http://localhost:3000',
      'https://127.0.0.1:5173',
      'file:///C:/app/chatbot.html',
    ]) {
      const response = await request(host, {
        method: 'GET',
        path: '/',
        headers: { origin },
      });
      expect(response.status, origin).toBe(200);
    }
  });

  it('refuses a forged token of the right length, and another launch token', async () => {
    const host = await startHost();
    const other = await startHost();
    expect(other.token).not.toBe(host.token);
    expect(other.token).toMatch(/^[\w-]{43}$/);

    const forged = await request(host, {
      headers: { authorization: `Bearer ${'A'.repeat(43)}` },
      body: { jsonrpc: '2.0', id: 1, method: 'initialize' },
    });
    expect(forged.status).toBe(401);
    const borrowed = await request(host, {
      headers: { authorization: `Bearer ${other.token}` },
      body: { jsonrpc: '2.0', id: 1, method: 'initialize' },
    });
    expect(borrowed.status).toBe(401);
    expect(borrowed.headers['www-authenticate']).toBe('Bearer');
    expect(mocks.createOwaMcpServer).not.toHaveBeenCalled();
  });

  it('answers a body that is not JSON with a parse error', async () => {
    const host = await startHost();
    const response = await request(host, {
      headers: authHeaders(host),
      body: '{not json',
    });
    expect(response.status).toBe(400);
    expect(response.json).toEqual({
      jsonrpc: '2.0',
      error: { code: -32700, message: 'Parse error' },
      id: null,
    });
  });

  it('drops a body past the cap without opening a session', async () => {
    const logger = vi.fn();
    const host = await startHost({ logger });
    const outcome = await request(host, {
      headers: authHeaders(host),
      body: 'x'.repeat(4 * 1024 * 1024 + 1024),
    }).catch((error) => error);
    // The socket is torn down under the upload, or the 500 got out first.
    if (!(outcome instanceof Error)) {
      expect(outcome.status).toBe(500);
    }
    await vi.waitFor(() => {
      expect(logger).toHaveBeenCalledWith(
        'MCP host request failed',
        expect.objectContaining({ message: 'Request body too large' }),
      );
    });
    expect(mocks.createOwaMcpServer).not.toHaveBeenCalled();
  });

  it('pins discovery to its own instance only when told which that is', async () => {
    await startHost();
    expect(mocks.pinCdpPort).not.toHaveBeenCalled();
    const getCdpPort = () => 9333;
    await startHost({ getCdpPort });
    expect(mocks.pinCdpPort).toHaveBeenCalledWith(getCdpPort);
  });

  it('takes a free port when the one it prefers is busy', async () => {
    const first = await startHost();
    const second = await startHost({ port: first.port });
    expect(second.port).not.toBe(first.port);
    const root = await request(second, { method: 'GET', path: '/' });
    expect(root.json.mcpUrl).toBe(second.url);
  });

  it('logs a server error after it started instead of throwing it', async () => {
    const logger = vi.fn();
    const createServer = vi.spyOn(http, 'createServer');
    await startHost({ logger });
    const server = createServer.mock.results[0].value;
    const error = new Error('late trouble');
    expect(() => server.emit('error', error)).not.toThrow();
    expect(logger).toHaveBeenCalledWith('MCP host server error', error);
  });
});

describe('a session', () => {
  it('opens on initialize as the app door, and answers on its id', async () => {
    const logger = vi.fn();
    const host = await startHost({ logger });
    const { response, sessionId, server } = await openSession(host);
    expect(mocks.createOwaMcpServer).toHaveBeenCalledWith({ door: 'app' });
    expect(server.connect).toHaveBeenCalledWith(server.transport);
    expect(server.transport.protocolVersion).toBe('2025-06-18');
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.json).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: { echo: 'initialize' },
    });
    expect(logger).toHaveBeenCalledWith(`MCP session ${sessionId} opened`);

    const listed = await request(host, {
      headers: authHeaders(host, sessionId),
      body: { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    });
    expect(listed.status).toBe(200);
    expect(listed.headers['mcp-session-id']).toBe(sessionId);
    expect(listed.json.result).toEqual({ echo: 'tools/list' });
    // One session for both: the second request reused it.
    expect(mocks.createOwaMcpServer).toHaveBeenCalledTimes(1);
    const root = await request(host, { method: 'GET', path: '/' });
    expect(root.json.sessions).toBe(1);
  });

  it('answers a notification with 202 and a batch with a list', async () => {
    const host = await startHost();
    const { sessionId, server } = await openSession(host);

    const notified = await request(host, {
      headers: authHeaders(host, sessionId),
      body: { jsonrpc: '2.0', method: 'notifications/initialized' },
    });
    expect(notified.status).toBe(202);
    expect(notified.headers['mcp-session-id']).toBe(sessionId);
    expect(notified.text).toBe('');
    expect(server.notifications).toEqual(['notifications/initialized']);

    const batch = await request(host, {
      headers: authHeaders(host, sessionId),
      body: [
        { jsonrpc: '2.0', id: 7, method: 'tools/list' },
        { jsonrpc: '2.0', method: 'notifications/cancelled' },
        { jsonrpc: '2.0', id: 8, method: 'ping' },
      ],
    });
    expect(batch.status).toBe(200);
    expect(batch.json).toEqual([
      { jsonrpc: '2.0', id: 7, result: { echo: 'tools/list' } },
      { jsonrpc: '2.0', id: 8, result: { echo: 'ping' } },
    ]);
  });

  it('opens a fresh session for an initialize carrying a stale id', async () => {
    const host = await startHost();
    const response = await request(host, {
      headers: authHeaders(host, 'stale-session'),
      body: { jsonrpc: '2.0', id: 1, method: 'initialize' },
    });
    expect(response.status).toBe(200);
    expect(response.headers['mcp-session-id']).not.toBe('stale-session');

    const unknown = await request(host, {
      headers: authHeaders(host, 'stale-session'),
      body: { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    });
    expect(unknown.status).toBe(404);
    expect(unknown.json.error).toEqual({
      code: -32001,
      message: 'Unknown session',
    });
  });

  it('turns a server that fails to start into a 500, not a crash', async () => {
    const logger = vi.fn();
    mocks.createOwaMcpServer.mockRejectedValueOnce(new Error('no browser'));
    const host = await startHost({ logger });
    const response = await request(host, {
      headers: authHeaders(host),
      body: { jsonrpc: '2.0', id: 1, method: 'initialize' },
    });
    expect(response.status).toBe(500);
    expect(response.json).toEqual({ error: 'no browser' });
    expect(logger).toHaveBeenCalledWith(
      'MCP host request failed',
      expect.objectContaining({ message: 'no browser' }),
    );
  });

  it('refuses GET, DELETE and other verbs for a session it does not know', async () => {
    const host = await startHost();
    for (const method of ['GET', 'DELETE', 'PUT']) {
      const response = await request(host, {
        method,
        headers: authHeaders(host, 'nobody'),
      });
      expect(response.status, method).toBe(404);
      expect(response.json).toEqual({ error: 'Unknown session' });
    }
    const { sessionId } = await openSession(host);
    const put = await request(host, {
      method: 'PUT',
      headers: authHeaders(host, sessionId),
    });
    expect(put.status).toBe(405);
    expect(put.headers.allow).toBe('GET, POST, DELETE');
  });

  it('closes on DELETE, answering a request still waiting on it', async () => {
    const host = await startHost();
    const { sessionId, server } = await openSession(host);
    const waiting = request(host, {
      headers: authHeaders(host, sessionId),
      body: { jsonrpc: '2.0', id: 5, method: 'never' },
    });
    await vi.waitFor(() => {
      expect(server.transport.pendingResponseMap.size).toBe(1);
    });

    const deleted = await request(host, {
      method: 'DELETE',
      headers: authHeaders(host, sessionId),
    });
    expect(deleted.status).toBe(204);
    expect(server.close).toHaveBeenCalledTimes(1);
    expect(server.closedTransportCount).toBe(1);
    // Answered, not left hanging until the socket gives up.
    expect((await waiting).status).toBe(202);
    expect(server.transport.pendingResponseMap.size).toBe(0);

    const after = await request(host, {
      headers: authHeaders(host, sessionId),
      body: { jsonrpc: '2.0', id: 6, method: 'tools/list' },
    });
    expect(after.status).toBe(404);
  });

  it('logs a session that fails to close, and forgets it all the same', async () => {
    const logger = vi.fn();
    const failure = new Error('stuck');
    mocks.createOwaMcpServer.mockImplementationOnce(async () => {
      return { server: genFakeServer({ closeError: failure }) };
    });
    const host = await startHost({ logger });
    const { sessionId } = await openSession(host);
    const deleted = await request(host, {
      method: 'DELETE',
      headers: authHeaders(host, sessionId),
    });
    expect(deleted.status).toBe(204);
    expect(logger).toHaveBeenCalledWith(
      'Failed to close an MCP session',
      failure,
    );
    const root = await request(host, { method: 'GET', path: '/' });
    expect(root.json.sessions).toBe(0);
  });
});

describe('the server-sent stream', () => {
  it('carries what the server starts on its own, one stream per session', async () => {
    const host = await startHost();
    const { sessionId, server } = await openSession(host);

    const first = openStream(host, sessionId);
    await vi.waitFor(() => {
      expect(server.transport.sseResponse).not.toBeNull();
    });
    const message = {
      jsonrpc: '2.0',
      method: 'notifications/tools/list_changed',
    };
    await server.transport.send(message);
    const firstStream = await first.promise;
    expect(firstStream.res.statusCode).toBe(200);
    expect(firstStream.res.headers['content-type']).toBe('text/event-stream');
    await vi.waitFor(() => {
      expect(firstStream.text).toBe(`data: ${JSON.stringify(message)}\n\n`);
    });

    // A reconnect replaces the stream; the old one is ended, not orphaned.
    const firstResponse = server.transport.sseResponse;
    const second = openStream(host, sessionId);
    await vi.waitFor(() => {
      expect(server.transport.sseResponse).not.toBe(firstResponse);
    });
    await vi.waitFor(() => {
      expect(firstStream.isEnded).toBe(true);
    });

    // The client walks away: the stream is let go, and a message with
    // nowhere to go is dropped rather than queued.
    second.destroy();
    await vi.waitFor(() => {
      expect(server.transport.sseResponse).toBeNull();
    });
    await expect(
      server.transport.send({ jsonrpc: '2.0', method: 'notifications/x' }),
    ).resolves.toBeUndefined();
  });

  it('ends the stream when the session is deleted', async () => {
    const host = await startHost();
    const { sessionId, server } = await openSession(host);
    const stream = openStream(host, sessionId);
    await vi.waitFor(() => {
      expect(server.transport.sseResponse).not.toBeNull();
    });
    await request(host, {
      method: 'DELETE',
      headers: authHeaders(host, sessionId),
    });
    const ended = await stream.promise;
    await vi.waitFor(() => {
      expect(ended.isEnded).toBe(true);
    });
    expect(server.transport.sseResponse).toBeNull();
  });
});

describe('the session limits', () => {
  it('makes room by closing the least recently used session', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const logger = vi.fn();
    const host = await startHost({ logger });
    const opened = [];
    for (let index = 0; index < 8; index += 1) {
      vi.setSystemTime(1_000_000 + index * 1000);
      opened.push(await openSession(host));
    }
    // The first one is used again, so the second is now the oldest.
    vi.setSystemTime(1_100_000);
    await request(host, {
      headers: authHeaders(host, opened[0].sessionId),
      body: { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    });
    vi.setSystemTime(1_200_000);
    const ninth = await openSession(host);

    expect(logger).toHaveBeenCalledWith(
      `MCP session ${opened[1].sessionId} closed to make room`,
    );
    expect(opened[1].server.close).toHaveBeenCalledTimes(1);
    expect(opened[0].server.close).not.toHaveBeenCalled();
    const root = await request(host, { method: 'GET', path: '/' });
    expect(root.json.sessions).toBe(8);
    for (const [sessionId, status] of [
      [opened[0].sessionId, 200],
      [opened[1].sessionId, 404],
      [ninth.sessionId, 200],
    ]) {
      const response = await request(host, {
        headers: authHeaders(host, sessionId),
        body: { jsonrpc: '2.0', id: 3, method: 'tools/list' },
      });
      expect(response.status).toBe(status);
    }
  });

  it('sweeps a session idle for fifteen minutes and keeps a busy one', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(5_000_000);
    const host = await startHost();
    const idle = await openSession(host);
    const busy = await openSession(host);

    vi.advanceTimersByTime(10 * 60 * 1000);
    await request(host, {
      headers: authHeaders(host, busy.sessionId),
      body: { jsonrpc: '2.0', id: 2, method: 'ping' },
    });
    vi.advanceTimersByTime(6 * 60 * 1000);

    await vi.waitFor(() => {
      expect(idle.server.close).toHaveBeenCalledTimes(1);
    });
    expect(busy.server.close).not.toHaveBeenCalled();
    const gone = await request(host, {
      headers: authHeaders(host, idle.sessionId),
      body: { jsonrpc: '2.0', id: 3, method: 'ping' },
    });
    expect(gone.status).toBe(404);
  });

  it('closes every session when the host closes', async () => {
    const host = await startOwaMcpHost({ port: 0 });
    const one = await openSession(host);
    const two = await openSession(host);
    await host.close();
    expect(one.server.close).toHaveBeenCalledTimes(1);
    expect(two.server.close).toHaveBeenCalledTimes(1);
    await expect(request(host, { method: 'GET', path: '/' })).rejects.toThrow();
  });
});
