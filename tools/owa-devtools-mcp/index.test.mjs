import { once } from 'node:events';
import net from 'node:net';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The npm package's JavaScript API. What it finds is mocked at the discovery
// seam; the bridge listens on a real loopback socket; the MCP server is
// mocked at `stdio.mjs`, which also tells whether it was loaded at all.
const mocks = vi.hoisted(() => {
  return {
    instances: [],
    drivenInstance: null,
    browserUrl: 'http://127.0.0.1:1',
    isStdioLoaded: false,
    createStdioDoorServer: null,
    runOwaMcpStdioServer: null,
    connectToCdp: null,
  };
});

vi.mock('./discovery.mjs', () => {
  return {
    CDP_INFO_DIR_PATH: '/tmp/open-worship-app-cdp',
    readLiveInstances: () => {
      return mocks.instances;
    },
    findDrivenInstance: () => {
      return mocks.drivenInstance;
    },
    resolveAppBrowserUrl: () => {
      return mocks.browserUrl;
    },
    connectToCdp: (options) => {
      return mocks.connectToCdp(options);
    },
  };
});
vi.mock('./stdio.mjs', () => {
  mocks.isStdioLoaded = true;
  return {
    createStdioDoorServer: (options) => {
      return mocks.createStdioDoorServer(options);
    },
    runOwaMcpStdioServer: (options) => {
      return mocks.runOwaMcpStdioServer(options);
    },
  };
});

const DECLARED_EXPORTS = [
  'OWA_CDP_INFO_DIR_PATH',
  'createOwaMcpServer',
  'findDrivenInstance',
  'listOwaAppInstances',
  'redactSecrets',
  'resolveAppBrowserUrl',
  'runOwaMcpBridge',
  'runOwaMcpStdioServer',
];

const APP_INSTANCE = {
  pid: 4242,
  port: 50123,
  url: 'http://127.0.0.1:50123',
  mcpUrl: 'http://127.0.0.1:39223/mcp',
  mcpToken: 'the-door-capability',
  isDev: true,
  version: '2026.11.02',
  userDataPath: '/data/open-worship-app-dev',
  startedAt: '2026-11-13T09:00:00.000Z',
  langDirs: ['/data/lang/fixture'],
};

let api;

beforeEach(async () => {
  mocks.instances = [];
  mocks.drivenInstance = null;
  mocks.isStdioLoaded = false;
  vi.resetModules();
  api = await import('./index.mjs');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the package API', () => {
  test('exports exactly what index.d.mts declares', () => {
    expect(Object.keys(api).sort()).toEqual(DECLARED_EXPORTS);
    expect(api.OWA_CDP_INFO_DIR_PATH).toBe('/tmp/open-worship-app-cdp');
  });

  test('loads no MCP server until one is asked for', async () => {
    expect(mocks.isStdioLoaded).toBe(false);
    api.listOwaAppInstances();
    api.findDrivenInstance();
    api.resolveAppBrowserUrl();
    expect(mocks.isStdioLoaded).toBe(false);
    const server = { connect: vi.fn(), close: vi.fn() };
    mocks.createStdioDoorServer = vi.fn(async () => {
      return { server, args: { browserUrl: 'x' } };
    });
    await api.createOwaMcpServer();
    expect(mocks.isStdioLoaded).toBe(true);
  });
});

describe('finding the app', () => {
  test('lists every running app without its MCP door token', () => {
    const older = { ...APP_INSTANCE, pid: 7, port: 50100, isDev: false };
    mocks.instances = [APP_INSTANCE, older];
    const listed = api.listOwaAppInstances();
    expect(listed).toHaveLength(2);
    for (const instance of listed) {
      expect(instance).not.toHaveProperty('mcpToken');
    }
    const { mcpToken: _token, ...withoutToken } = APP_INSTANCE;
    expect(listed[0]).toEqual(withoutToken);
    expect(listed[1].port).toBe(50100);
    // The discovery's own objects are left as they were.
    expect(APP_INSTANCE.mcpToken).toBe('the-door-capability');
  });

  test('names the driven app without its token, or null', () => {
    expect(api.findDrivenInstance()).toBeNull();
    mocks.drivenInstance = APP_INSTANCE;
    const driven = api.findDrivenInstance();
    expect(driven).not.toHaveProperty('mcpToken');
    expect(driven.port).toBe(APP_INSTANCE.port);
  });

  test("answers the driven app's debugging address", () => {
    mocks.browserUrl = 'http://127.0.0.1:50123';
    expect(api.resolveAppBrowserUrl()).toBe('http://127.0.0.1:50123');
  });
});

describe('serving it', () => {
  test('createOwaMcpServer hands back the stdio door server alone', async () => {
    const server = { connect: vi.fn(), close: vi.fn() };
    mocks.createStdioDoorServer = vi.fn(async () => {
      return { server, args: { browserUrl: 'x' } };
    });
    const created = await api.createOwaMcpServer({
      argv: ['--headless'],
      logFile: 'mcp.log',
    });
    expect(mocks.createStdioDoorServer).toHaveBeenCalledWith({
      argv: ['--headless'],
      logFile: 'mcp.log',
    });
    expect(created).toEqual({ server });
  });

  test('runOwaMcpStdioServer is the command body', async () => {
    const answer = { server: {}, close: vi.fn() };
    mocks.runOwaMcpStdioServer = vi.fn(async () => {
      return answer;
    });
    const log = vi.fn();
    expect(await api.runOwaMcpStdioServer({ argv: ['--x'], log })).toBe(answer);
    expect(mocks.runOwaMcpStdioServer).toHaveBeenCalledWith({
      argv: ['--x'],
      log,
    });
  });

  test('runOwaMcpBridge forwards a real port and closes', async () => {
    const appServer = net.createServer((socket) => {
      socket.on('error', () => {});
      socket.pipe(socket);
    });
    await new Promise((resolve) => {
      appServer.listen(0, '127.0.0.1', resolve);
    });
    const appPort = appServer.address().port;
    mocks.connectToCdp = async () => {
      const socket = net.connect(appPort, '127.0.0.1');
      await once(socket, 'connect');
      return { socket, port: appPort };
    };
    const log = vi.fn();
    const bridge = await api.runOwaMcpBridge({ listenPort: 0, log });
    try {
      expect(bridge.port).toBeGreaterThan(0);
      expect(log).toHaveBeenCalledWith(
        `bridge listening on http://127.0.0.1:${bridge.port}`,
      );
      const client = net.connect(bridge.port, '127.0.0.1');
      client.on('error', () => {});
      await once(client, 'connect');
      client.write('ping');
      const [data] = await once(client, 'data');
      expect(data.toString()).toBe('ping');
      client.destroy();
    } finally {
      await bridge.close();
      await new Promise((resolve) => {
        appServer.close(resolve);
        appServer.closeAllConnections?.();
      });
    }
  });

  test('redactSecrets is the firewall scrubber', () => {
    const key = `sk-${'B'.repeat(26)}`;
    expect(api.redactSecrets(`the key is ${key}.`)).not.toContain(key);
  });
});
