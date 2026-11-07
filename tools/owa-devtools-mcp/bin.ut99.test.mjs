import { EventEmitter } from 'node:events';
import net from 'node:net';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// `bin.mjs` is what an outside client spawns. It runs at import time, so each
// test sets `process.argv`, resets the module registry and imports it again.
// The bridge is driven over real loopback sockets (127.0.0.1 only): forwarding
// bytes both ways is the whole job, and a fake socket would prove nothing about
// `pipe`. `node:net` is wrapped only to RECORD every server made, so each one
// is closed again; `connect` and the sockets themselves are real.
const binState = vi.hoisted(() => {
  return {
    serverOptionList: [],
    connectedTransportList: [],
    transportList: [],
    connectToCdpCallList: [],
    connectToCdp: null,
    netServerList: [],
  };
});

vi.mock('node:net', async (importOriginal) => {
  const actual = await importOriginal();
  const real = actual.default ?? actual;
  const createServer = (...args) => {
    const server = real.createServer(...args);
    binState.netServerList.push(server);
    return server;
  };
  return { ...actual, createServer, default: { ...real, createServer } };
});
vi.mock('chrome-devtools-mcp/build/src/third_party/index.js', () => {
  return {
    StdioServerTransport: class FakeStdioServerTransport {
      constructor() {
        binState.transportList.push(this);
      }
    },
  };
});
vi.mock('./server.mjs', () => {
  return {
    createOwaMcpServer: async (options) => {
      binState.serverOptionList.push(options);
      return {
        server: {
          connect: async (transport) => {
            binState.connectedTransportList.push(transport);
          },
        },
      };
    },
  };
});
vi.mock('./discovery.mjs', () => {
  return {
    connectToCdp: (options) => {
      binState.connectToCdpCallList.push(options);
      return binState.connectToCdp(options);
    },
  };
});

const originalArgv = process.argv;
const originalTitle = process.title;
const openSocketList = [];
let logSpy;

function readLoggedLines() {
  return logSpy.mock.calls.map((items) => {
    return items.join(' ');
  });
}

async function runBin(args) {
  process.argv = ['node', 'bin.mjs', ...args];
  vi.resetModules();
  return import('./bin.mjs');
}

function listen(server, port = 0) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      resolve(server.address().port);
    });
  });
}

async function findFreePort() {
  const probe = net.createServer();
  const port = await listen(probe);
  await new Promise((resolve) => {
    probe.close(resolve);
  });
  return port;
}

// The app's debugging endpoint, as far as the bridge can tell: it answers
// whatever it is sent.
async function startUpstream() {
  const socketList = [];
  const server = net.createServer((socket) => {
    socketList.push(socket);
    openSocketList.push(socket);
    socket.on('error', () => {});
    socket.on('data', (chunk) => {
      socket.write(`pong:${chunk.toString('utf8')}`);
    });
  });
  const port = await listen(server);
  return { server, socketList, port };
}

// What `connectToCdp` does for real: a socket to the live endpoint.
function genConnectUpstream(port) {
  return () => {
    return new Promise((resolve, reject) => {
      const socket = net.connect(port, '127.0.0.1');
      openSocketList.push(socket);
      socket.once('connect', () => {
        resolve({ socket, port });
      });
      socket.once('error', reject);
    });
  };
}

function connectClient(port) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1');
    openSocketList.push(socket);
    socket.on('error', () => {});
    socket.once('connect', () => {
      resolve(socket);
    });
    socket.once('error', reject);
  });
}

function readOnce(socket) {
  return new Promise((resolve) => {
    socket.once('data', (chunk) => {
      resolve(chunk.toString('utf8'));
    });
  });
}

function waitForClose(socket) {
  return new Promise((resolve) => {
    socket.once('close', resolve);
  });
}

async function exchange(port, text) {
  const client = await connectClient(port);
  const answer = readOnce(client);
  client.write(text);
  return { client, answer: await answer };
}

beforeEach(() => {
  binState.serverOptionList = [];
  binState.connectedTransportList = [];
  binState.transportList = [];
  binState.connectToCdpCallList = [];
  binState.connectToCdp = null;
  binState.netServerList = [];
  logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  for (const socket of openSocketList.splice(0)) {
    socket.destroy();
  }
  await Promise.all(
    binState.netServerList.splice(0).map((server) => {
      return new Promise((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    }),
  );
  process.argv = originalArgv;
  process.title = originalTitle;
});

describe('--bridge', () => {
  test('forwards a client to the app endpoint and back, never to its own port', async () => {
    const upstream = await startUpstream();
    binState.connectToCdp = genConnectUpstream(upstream.port);
    const listenPort = await findFreePort();

    await runBin(['--bridge', `--listen=${listenPort}`]);
    expect(process.title).toBe('owa-devtools-mcp');
    expect(readLoggedLines()).toContain(
      `[owa-devtools-mcp] bridge listening on http://127.0.0.1:${listenPort}`,
    );

    const { answer } = await exchange(listenPort, 'ping');
    expect(answer).toBe('pong:ping');
    // Without the exclusion the bridge finds its own listener through the
    // legacy fallback port and forwards to itself, forever.
    expect(binState.connectToCdpCallList).toEqual([
      { excludePorts: [listenPort] },
    ]);
    expect(readLoggedLines()).toContain(
      `[owa-devtools-mcp] forwarding a connection to 127.0.0.1:${upstream.port}`,
    );
    // The bridge runs instead of the MCP server, not beside it.
    expect(binState.serverOptionList).toEqual([]);
    expect(binState.transportList).toEqual([]);
  });

  test('with no --listen it takes any free port and says which', async () => {
    await runBin(['--bridge']);
    const line = readLoggedLines().find((one) => {
      return one.includes('bridge listening on');
    });
    const port = Number(line.match(/127\.0\.0\.1:(\d+)$/)[1]);
    expect(port).toBeGreaterThan(0);
    expect(binState.netServerList[0].address().port).toBe(port);
  });

  // A refused connection is what every client already knows how to report,
  // and they retry per call -- so starting the app is enough to recover.
  test('with no app running the client is turned away and the reason logged', async () => {
    binState.connectToCdp = async () => {
      throw new Error('No running Open Worship App found (tried 9223)');
    };
    const listenPort = await findFreePort();
    await runBin(['--bridge', `--listen=${listenPort}`]);

    const client = await connectClient(listenPort);
    await waitForClose(client);
    expect(readLoggedLines()).toContain(
      '[owa-devtools-mcp] No running Open Worship App found (tried 9223)',
    );

    // The next client is tried afresh, and gets through once the app is up.
    const upstream = await startUpstream();
    binState.connectToCdp = genConnectUpstream(upstream.port);
    const { answer } = await exchange(listenPort, 'later');
    expect(answer).toBe('pong:later');
  });

  test('an error on the app side drops that client, not the bridge', async () => {
    const upstream = await startUpstream();
    binState.connectToCdp = genConnectUpstream(upstream.port);
    const listenPort = await findFreePort();
    await runBin(['--bridge', `--listen=${listenPort}`]);
    const { client } = await exchange(listenPort, 'ping');

    const closed = waitForClose(client);
    upstream.socketList[0].resetAndDestroy();
    await closed;
    expect(client.destroyed).toBe(true);

    const { answer } = await exchange(listenPort, 'again');
    expect(answer).toBe('pong:again');
  });

  test('a client that hangs up, even abruptly, closes its app connection', async () => {
    const upstream = await startUpstream();
    binState.connectToCdp = genConnectUpstream(upstream.port);
    const listenPort = await findFreePort();
    await runBin(['--bridge', `--listen=${listenPort}`]);
    const { client } = await exchange(listenPort, 'ping');

    const upstreamClosed = waitForClose(upstream.socketList[0]);
    client.resetAndDestroy();
    await upstreamClosed;
    expect(upstream.socketList[0].destroyed).toBe(true);

    const { answer } = await exchange(listenPort, 'still here');
    expect(answer).toBe('pong:still here');
  });

  test('a bridge port that is already taken fails the start', async () => {
    const blocker = net.createServer();
    const port = await listen(blocker);
    await expect(
      runBin(['--bridge', `--listen=${port}`]),
    ).rejects.toMatchObject({ code: 'EADDRINUSE' });
  });
});

describe('the stdio door', () => {
  test('serves the MCP server over stdio with the client argv, minus --listen', async () => {
    const stdin = new EventEmitter();
    vi.spyOn(process, 'stdin', 'get').mockReturnValue(stdin);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    const before = {
      SIGINT: process.listeners('SIGINT'),
      SIGTERM: process.listeners('SIGTERM'),
    };
    const added = (signal) => {
      return process.listeners(signal).filter((listener) => {
        return !before[signal].includes(listener);
      });
    };
    try {
      await runBin(['--headless', '--listen=9223', '--viewport=1280x720']);

      expect(process.title).toBe('owa-devtools-mcp');
      expect(binState.serverOptionList).toEqual([
        { argv: ['--headless', '--viewport=1280x720'] },
      ]);
      expect(binState.transportList).toHaveLength(1);
      expect(binState.connectedTransportList).toEqual([
        binState.transportList[0],
      ]);
      expect(readLoggedLines()).toContain(
        '[owa-devtools-mcp] connected over stdio',
      );
      // No bridge, and nothing dialled.
      expect(binState.netServerList).toEqual([]);
      expect(binState.connectToCdpCallList).toEqual([]);

      // Every way the client can go away ends the process, successfully.
      expect(added('SIGINT')).toHaveLength(1);
      expect(added('SIGTERM')).toHaveLength(1);
      expect(exitSpy).not.toHaveBeenCalled();
      stdin.emit('end');
      stdin.emit('close');
      added('SIGINT')[0]();
      added('SIGTERM')[0]();
      expect(exitSpy.mock.calls).toEqual([[0], [0], [0], [0]]);
    } finally {
      for (const signal of ['SIGINT', 'SIGTERM']) {
        for (const listener of added(signal)) {
          process.removeListener(signal, listener);
        }
      }
    }
  });
});
