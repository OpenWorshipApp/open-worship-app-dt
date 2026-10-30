import { once } from 'node:events';
import net from 'node:net';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The stdio front door. It is a script -- it acts as it is imported -- so each
// test sets `process.argv` and imports it afresh. What it serves is mocked;
// the bridge forwards over real loopback sockets.
const mocks = vi.hoisted(() => ({
  connectToCdp: vi.fn(),
  createOwaMcpServer: vi.fn(),
  transports: [],
}));

vi.mock('chrome-devtools-mcp/build/src/third_party/index.js', () => ({
  StdioServerTransport: class {
    constructor() {
      mocks.transports.push(this);
    }
  },
}));
vi.mock('./discovery.mjs', () => ({ connectToCdp: mocks.connectToCdp }));
vi.mock('./server.mjs', () => ({
  createOwaMcpServer: mocks.createOwaMcpServer,
}));

const saved = { argv: process.argv, title: process.title };
const servers = [];
const sockets = [];

async function listen(server, port = 0) {
  servers.push(server);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return server.address().port;
}

async function findFreePort() {
  const probe = net.createServer();
  await new Promise((resolve) => {
    probe.listen(0, '127.0.0.1', resolve);
  });
  const { port } = probe.address();
  await new Promise((resolve) => {
    probe.close(resolve);
  });
  return port;
}

function connect(port) {
  const socket = net.connect(port, '127.0.0.1');
  socket.on('error', () => {});
  sockets.push(socket);
  return socket;
}

async function startBin(args) {
  process.argv = ['node', 'bin.mjs', ...args];
  vi.resetModules();
  await import('./bin.mjs');
}

let errorLog;

beforeEach(() => {
  mocks.transports.length = 0;
  errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  process.argv = saved.argv;
  process.title = saved.title;
  for (const socket of sockets.splice(0)) {
    socket.destroy();
  }
  await Promise.all(
    servers.splice(0).map((server) => {
      return new Promise((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections?.();
      });
    }),
  );
});

describe('the stdio door', () => {
  it('serves the MCP server over stdio, keeping the bridge flags for itself', async () => {
    const server = { connect: vi.fn(async () => {}) };
    mocks.createOwaMcpServer.mockResolvedValue({ server });
    const stdinHandlers = {};
    const fakeStdin = {
      on(name, handler) {
        stdinHandlers[name] = handler;
        return fakeStdin;
      },
    };
    vi.spyOn(process, 'stdin', 'get').mockReturnValue(fakeStdin);
    const signalHandlers = {};
    vi.spyOn(process, 'on').mockImplementation((name, handler) => {
      signalHandlers[name] = handler;
      return process;
    });
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {});

    await startBin(['--headless', '--listen=9223', '--logFile=mcp.log']);

    expect(process.title).toBe('owa-devtools-mcp');
    expect(mocks.createOwaMcpServer).toHaveBeenCalledWith({
      argv: ['--headless', '--logFile=mcp.log'],
    });
    expect(mocks.transports).toHaveLength(1);
    expect(server.connect).toHaveBeenCalledWith(mocks.transports[0]);
    expect(errorLog).toHaveBeenCalledWith(
      '[owa-devtools-mcp]',
      'connected over stdio',
    );
    expect(mocks.connectToCdp).not.toHaveBeenCalled();

    // The client going away -- either way it says so -- ends the process.
    expect(Object.keys(stdinHandlers).sort()).toEqual(['close', 'end']);
    expect(Object.keys(signalHandlers).sort()).toEqual(['SIGINT', 'SIGTERM']);
    expect(exit).not.toHaveBeenCalled();
    stdinHandlers.end();
    signalHandlers.SIGTERM();
    expect(exit.mock.calls).toEqual([[0], [0]]);
  });
});

describe('the bridge', () => {
  it('forwards a fixed port to the app, never dialling itself', async () => {
    const appServer = net.createServer((socket) => {
      socket.on('error', () => {});
      socket.pipe(socket);
    });
    const appPort = await listen(appServer);
    const listenPort = await findFreePort();
    mocks.connectToCdp.mockImplementation(async () => {
      const socket = net.connect(appPort, '127.0.0.1');
      await once(socket, 'connect');
      return { socket, port: appPort };
    });
    const createServer = vi.spyOn(net, 'createServer');

    await startBin(['--bridge', `--listen=${listenPort}`]);
    servers.push(createServer.mock.results[0].value);

    expect(errorLog).toHaveBeenCalledWith(
      '[owa-devtools-mcp]',
      `bridge listening on http://127.0.0.1:${listenPort}`,
    );
    expect(mocks.createOwaMcpServer).not.toHaveBeenCalled();

    const client = connect(listenPort);
    await once(client, 'connect');
    client.write('ping');
    const [data] = await once(client, 'data');
    expect(data.toString()).toBe('ping');
    expect(mocks.connectToCdp).toHaveBeenCalledWith({
      excludePorts: [listenPort],
    });
    expect(errorLog).toHaveBeenCalledWith(
      '[owa-devtools-mcp]',
      `forwarding a connection to 127.0.0.1:${appPort}`,
    );
  });

  it('refuses a connection when the app is not up, and says why', async () => {
    mocks.connectToCdp.mockRejectedValue(
      new Error('No running Open Worship App found (tried 9223)'),
    );
    const createServer = vi.spyOn(net, 'createServer');
    await startBin(['--bridge', '--listen=0']);
    const bridge = createServer.mock.results[0].value;
    servers.push(bridge);

    const client = connect(bridge.address().port);
    await once(client, 'close');
    expect(errorLog).toHaveBeenCalledWith(
      '[owa-devtools-mcp]',
      'No running Open Worship App found (tried 9223)',
    );
    expect(mocks.connectToCdp).toHaveBeenCalledWith({ excludePorts: [0] });
  });

  it('drops the client when the app end of the line breaks', async () => {
    const appServer = net.createServer((socket) => {
      socket.on('data', () => {
        socket.resetAndDestroy();
      });
    });
    const appPort = await listen(appServer);
    mocks.connectToCdp.mockImplementation(async () => {
      const socket = net.connect(appPort, '127.0.0.1');
      await once(socket, 'connect');
      return { socket, port: appPort };
    });
    const createServer = vi.spyOn(net, 'createServer');
    await startBin(['--bridge', '--listen=0']);
    const bridge = createServer.mock.results[0].value;
    servers.push(bridge);

    const client = connect(bridge.address().port);
    await vi.waitFor(() => {
      expect(mocks.connectToCdp).toHaveBeenCalled();
    });
    client.write('ping');
    await once(client, 'close');
    expect(client.destroyed).toBe(true);
  });

  it('fails loudly when its port is taken', async () => {
    const busyPort = await listen(net.createServer());
    process.argv = ['node', 'bin.mjs', '--bridge', `--listen=${busyPort}`];
    vi.resetModules();
    await expect(import('./bin.mjs')).rejects.toThrow(/EADDRINUSE/);
  });
});
