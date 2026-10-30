import { beforeEach, describe, expect, it, vi } from 'vitest';

// How one MCP server is put together for either door: chrome-devtools' tools
// aimed at the running app, the app's own tools, the banner and the firewall
// around every transport -- in that order.
const mocks = vi.hoisted(() => ({
  parseArguments: vi.fn(),
  createMcpServer: vi.fn(),
  resolveAppBrowserUrl: vi.fn(),
  registerOwaTools: vi.fn(),
  watchToolCalls: vi.fn(),
  guardToolCalls: vi.fn(),
  order: [],
}));

vi.mock('chrome-devtools-mcp', () => ({
  createMcpServer: mocks.createMcpServer,
}));
vi.mock('chrome-devtools-mcp/build/src/config/mcp-options.js', () => ({
  parseArguments: mocks.parseArguments,
}));
vi.mock('chrome-devtools-mcp/build/src/version.js', () => ({
  VERSION: '9.9.9',
}));
vi.mock('./discovery.mjs', () => ({
  resolveAppBrowserUrl: mocks.resolveAppBrowserUrl,
}));
vi.mock('./owaTools.mjs', () => ({
  registerOwaTools: mocks.registerOwaTools,
}));
vi.mock('./notify.mjs', () => ({ watchToolCalls: mocks.watchToolCalls }));
vi.mock('./firewall.mjs', () => ({ guardToolCalls: mocks.guardToolCalls }));

import { createOwaMcpServer } from './server.mjs';

let innerServer;

beforeEach(() => {
  mocks.order.length = 0;
  innerServer = {
    connect: vi.fn(async () => {
      mocks.order.push('connect');
      return 'connected';
    }),
  };
  mocks.parseArguments.mockImplementation((_version, argv) => {
    return { argv, usageStatistics: true, browserUrl: 'http://launch.me' };
  });
  mocks.createMcpServer.mockResolvedValue({ server: innerServer });
  mocks.watchToolCalls.mockImplementation(() => {
    mocks.order.push('banner');
  });
  mocks.guardToolCalls.mockImplementation(() => {
    mocks.order.push('firewall');
  });
});

describe('createOwaMcpServer', () => {
  it('passes the caller argv through and never reports usage', async () => {
    const { server, args } = await createOwaMcpServer({
      argv: ['--headless'],
      logFile: 'mcp.log',
    });
    expect(server).toBe(innerServer);
    expect(mocks.parseArguments).toHaveBeenCalledWith('9.9.9', [
      'node',
      'owa-devtools-mcp',
      '--headless',
    ]);
    expect(args.usageStatistics).toBe(false);
    expect(mocks.createMcpServer).toHaveBeenCalledWith(args, {
      logFile: 'mcp.log',
    });
  });

  it('finds the app afresh every time chrome-devtools asks where it is', async () => {
    const { args } = await createOwaMcpServer();
    mocks.resolveAppBrowserUrl
      .mockReturnValueOnce('http://127.0.0.1:9333')
      .mockReturnValueOnce('http://127.0.0.1:9444');
    expect(args.browserUrl).toBe('http://127.0.0.1:9333');
    expect(args.browserUrl).toBe('http://127.0.0.1:9444');
    expect(Object.keys(args)).toContain('browserUrl');
  });

  it('registers the app tools for the door it serves', async () => {
    await createOwaMcpServer();
    expect(mocks.registerOwaTools).toHaveBeenCalledWith(innerServer, {
      door: 'stdio',
    });
    await createOwaMcpServer({ door: 'app' });
    expect(mocks.registerOwaTools).toHaveBeenLastCalledWith(innerServer, {
      door: 'app',
    });
  });

  it('wraps every transport with the banner, then the firewall outermost', async () => {
    const { server } = await createOwaMcpServer();
    const transport = { onmessage: null };
    await expect(server.connect(transport)).resolves.toBe('connected');
    expect(mocks.order).toEqual(['connect', 'banner', 'firewall']);
    expect(mocks.watchToolCalls).toHaveBeenCalledWith(transport);
    expect(mocks.guardToolCalls).toHaveBeenCalledWith(transport);
  });
});
