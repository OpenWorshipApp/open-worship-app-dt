import http from 'node:http';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { pinCdpPort } from './discovery.mjs';
import { startOwaMcpHost } from './host.mjs';

// The in-app HTTP door over a real server on 127.0.0.1 port 0, the MCP
// server behind it a small fake (no chrome-devtools-mcp, no puppeteer).
// `node:http` is wrapped only to hand the test the server the host made, so
// a test can stand beside the host's own request handler; everything else
// about it is real.
const hostState = vi.hoisted(() => {
  const state = {
    mcpServers: [],
    httpServers: [],
    configureLangPacks: vi.fn(),
  };
  state.genMcpServer = () => {
    const server = {
      transport: null,
      closeCount: 0,
      async connect(transport) {
        server.transport = transport;
        await transport.start();
        transport.onmessage = (message) => {
          if (message.id === undefined) {
            return;
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
        await server.transport?.close();
      },
    };
    return server;
  };
  return state;
});

vi.mock('./server.mjs', () => {
  return {
    createOwaMcpServer: async () => {
      const server = hostState.genMcpServer();
      hostState.mcpServers.push(server);
      return { server };
    },
  };
});
vi.mock('./langPacks.mjs', () => {
  return { configureLangPacks: hostState.configureLangPacks };
});
vi.mock('node:http', async (importOriginal) => {
  const actual = await importOriginal();
  const real = actual.default ?? actual;
  const createServer = (...args) => {
    const server = real.createServer(...args);
    hostState.httpServers.push(server);
    return server;
  };
  return { ...actual, createServer, default: { ...real, createServer } };
});

const hosts = [];
let hostLogger;

async function startHost(options = {}) {
  const host = await startOwaMcpHost({
    port: 0,
    logger: hostLogger,
    ...options,
  });
  hosts.push(host);
  return host;
}

// One request on a connection of its own.
function request(host, { method = 'POST', body, sessionId } = {}) {
  const headers = { authorization: `Bearer ${host.token}` };
  if (sessionId !== undefined) {
    headers['mcp-session-id'] = sessionId;
  }
  let payload;
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: host.port,
        method,
        path: '/mcp',
        headers,
        agent: false,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            text: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    req.on('error', reject);
    req.end(payload);
  });
}

async function initialize(host) {
  const response = await request(host, {
    body: { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
  });
  expect(response.status).toBe(200);
  return response.headers['mcp-session-id'];
}

beforeEach(() => {
  hostLogger = vi.fn();
  hostState.mcpServers.length = 0;
  hostState.httpServers.length = 0;
});

afterEach(async () => {
  for (const host of hosts.splice(0)) {
    await host.close().catch(() => {});
  }
  pinCdpPort(null);
});

describe('startOwaMcpHost', () => {
  test("reads a language from THIS app's installed plugins when told them", async () => {
    const listLangDirs = () => ['/data/lang/xx@1.0.0'];
    await startHost({ listLangDirs });
    expect(hostState.configureLangPacks).toHaveBeenCalledTimes(1);
    expect(hostState.configureLangPacks).toHaveBeenCalledWith(listLangDirs);
  });

  test('leaves the language folders alone when not told them', async () => {
    await startHost();
    expect(hostState.configureLangPacks).not.toHaveBeenCalled();
  });
});

describe('a session closed twice at once', () => {
  test('the app closing while a client ends its session closes its server once', async () => {
    const host = await startHost();
    const sessionId = await initialize(host);
    const [httpServer] = hostState.httpServers;
    // Beside the host's own handler, in the same turn: the host is closed
    // as the client's DELETE comes in.
    httpServer.on('request', (req) => {
      if (req.method === 'DELETE') {
        host.close();
      }
    });

    const response = await request(host, { method: 'DELETE', sessionId });

    expect(response.status).toBe(204);
    expect(hostState.mcpServers).toHaveLength(1);
    expect(hostState.mcpServers[0].closeCount).toBe(1);
    expect(hostLogger).not.toHaveBeenCalledWith(
      'MCP host request failed',
      expect.anything(),
    );
  });
});

describe('a failure after the answer has started', () => {
  test('ends the event stream it opened instead of writing a second head', async () => {
    const host = await startHost();
    const sessionId = await initialize(host);
    const [httpServer] = hostState.httpServers;
    const failure = new Error('the socket went away');
    httpServer.prependListener('request', (req, res) => {
      if (req.method === 'GET') {
        res.setTimeout = () => {
          throw failure;
        };
      }
    });

    const response = await request(host, { method: 'GET', sessionId });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('text/event-stream');
    expect(response.text).toBe('');
    expect(hostLogger).toHaveBeenCalledWith('MCP host request failed', failure);
    // The session is still there for the client's next request.
    const next = await request(host, {
      sessionId,
      body: { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    });
    expect(next.status).toBe(200);
    expect(JSON.parse(next.text)).toEqual({
      jsonrpc: '2.0',
      id: 2,
      result: { echo: 'tools/list' },
    });
  });
});
