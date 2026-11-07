import { beforeEach, describe, expect, it, vi } from 'vitest';

// How one MCP server is put together for either door: chrome-devtools' tools
// aimed at the running app, the app's own tools, the banner and the firewall
// around every transport -- in that order.
const mocks = vi.hoisted(() => ({
  parseConfig: vi.fn(),
  configParserArgs: [],
  mcpServerFrom: vi.fn(),
  browserManagerArgs: [],
  resolveAppBrowserUrl: vi.fn(),
  registerOwaTools: vi.fn(),
  watchToolCalls: vi.fn(),
  guardToolCalls: vi.fn(),
  order: [],
  puppeteer: { connect: null },
}));

vi.mock('chrome-devtools-mcp', () => ({
  McpServer: { from: mocks.mcpServerFrom },
}));
vi.mock('chrome-devtools-mcp/build/src/BrowserManager.js', () => ({
  BrowserManager: class {
    constructor(...args) {
      mocks.browserManagerArgs.push(args);
    }
  },
}));
vi.mock('chrome-devtools-mcp/build/src/config/ConfigLocator.js', () => ({
  NO_CONFIG_DISCOVERY_ENV: 'NO_CONFIG_DISCOVERY',
}));
vi.mock('chrome-devtools-mcp/build/src/config/ConfigParser.js', () => ({
  ConfigParser: class {
    constructor(...args) {
      mocks.configParserArgs.push(args);
    }
    parseConfig() {
      return mocks.parseConfig();
    }
  },
}));
vi.mock('chrome-devtools-mcp/build/src/third_party/index.js', () => ({
  puppeteer: mocks.puppeteer,
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
  mocks.puppeteer.connect = vi.fn((options) => options);
  innerServer = {
    connect: vi.fn(async () => {
      mocks.order.push('connect');
      return 'connected';
    }),
    server: { removeRequestHandler: vi.fn() },
    _toolHandlersInitialized: true,
    setToolRequestHandlers: vi.fn(),
  };
  mocks.configParserArgs.length = 0;
  mocks.browserManagerArgs.length = 0;
  mocks.parseConfig.mockImplementation(() => {
    return {
      resolved: { usageStatistics: true, browserUrl: 'http://launch.me' },
    };
  });
  mocks.mcpServerFrom.mockReset();
  mocks.mcpServerFrom.mockResolvedValue({ server: innerServer });
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
    const [[version, argv, env, exitProcess]] = mocks.configParserArgs;
    expect(version).toBe('9.9.9');
    expect(argv).toEqual(['node', 'owa-devtools-mcp', '--headless']);
    // No config file from the user's profile may change the server, and a
    // bad argv must throw rather than end the app's own process.
    expect(env.NO_CONFIG_DISCOVERY).toBe('1');
    expect(exitProcess).toBe(false);
    expect(args.usageStatistics).toBe(false);
    const [[config, options]] = mocks.mcpServerFrom.mock.calls;
    // The config whose `resolved` carries the getter, never a copy of it.
    expect(config.resolved).toBe(args);
    expect(options.logFile).toBe('mcp.log');
    expect(options.browserManager).toBeDefined();
    expect(mocks.browserManagerArgs).toEqual([
      [config, { logFile: 'mcp.log' }],
    ]);
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

  it("gives tools/call back to the SDK before the app's tools are added", async () => {
    mocks.registerOwaTools.mockImplementation(() => {
      // By the time the app's tools are registered, the SDK's handler --
      // the one that serves tools registered after chrome-devtools' -- is in.
      expect(innerServer.setToolRequestHandlers).toHaveBeenCalledTimes(1);
      expect(innerServer._toolHandlersInitialized).toBe(false);
    });
    await createOwaMcpServer();
    expect(innerServer.server.removeRequestHandler.mock.calls).toEqual([
      ['tools/call'],
      ['tools/list'],
    ]);
    expect(mocks.registerOwaTools).toHaveBeenCalledTimes(1);
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

  it('hides DevTools windows from the browser tools before they connect', async () => {
    const innerConnect = vi.fn((options) => options);
    mocks.puppeteer.connect = innerConnect;
    let connectWhenCreated = null;
    mocks.mcpServerFrom.mockImplementation(async () => {
      connectWhenCreated = mocks.puppeteer.connect;
      return { server: innerServer };
    });
    await createOwaMcpServer();
    expect(connectWhenCreated).not.toBe(innerConnect);
    const options = mocks.puppeteer.connect({ targetFilter: () => true });
    const page = (url) => ({ url: () => url });
    expect(
      options.targetFilter(
        page('devtools://devtools/bundled/devtools_app.html'),
      ),
    ).toBe(false);
    expect(
      options.targetFilter(page('https://localhost:3000/reader.html')),
    ).toBe(true);
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
