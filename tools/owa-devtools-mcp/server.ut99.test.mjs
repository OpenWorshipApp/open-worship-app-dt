import { beforeEach, describe, expect, test, vi } from 'vitest';

// `server.mjs` is the one place both doors (the stdio bin and the in-app HTTP
// host) assemble the server, so what it wires -- and in which order -- is the
// policy every session runs under. Every collaborator is replaced by a
// recorder: chrome-devtools-mcp would start puppeteer, and the order of the
// calls is the thing under test.
const serverState = vi.hoisted(() => {
  return {
    calls: [],
    browserUrl: 'http://127.0.0.1:1',
    parsed: null,
    mcpServer: null,
    connectGate: null,
  };
});

vi.mock('chrome-devtools-mcp', () => {
  return {
    createMcpServer: async (args, options) => {
      serverState.calls.push(['createMcpServer', args, options]);
      serverState.mcpServer = {
        async connect(transport) {
          serverState.calls.push(['connect', transport]);
          await serverState.connectGate;
          serverState.calls.push(['connected', transport]);
          return 'the SDK connected';
        },
      };
      return { server: serverState.mcpServer };
    },
  };
});
vi.mock('chrome-devtools-mcp/build/src/config/mcp-options.js', () => {
  return {
    parseArguments: (version, argv) => {
      serverState.calls.push(['parseArguments', version, argv]);
      // Telemetry ON, the way a client's own argv could ask for it.
      serverState.parsed = {
        usageStatistics: true,
        headless: argv.includes('--headless'),
      };
      return serverState.parsed;
    },
  };
});
vi.mock('chrome-devtools-mcp/build/src/version.js', () => {
  return { VERSION: '9.9.9-test' };
});
vi.mock('./discovery.mjs', () => {
  return {
    resolveAppBrowserUrl: () => {
      serverState.calls.push(['resolveAppBrowserUrl']);
      return serverState.browserUrl;
    },
  };
});
vi.mock('./firewall.mjs', () => {
  return {
    guardToolCalls: (transport) => {
      serverState.calls.push(['guardToolCalls', transport]);
    },
  };
});
vi.mock('./notify.mjs', () => {
  return {
    watchToolCalls: (transport) => {
      serverState.calls.push(['watchToolCalls', transport]);
    },
  };
});
vi.mock('./owaTools.mjs', () => {
  return {
    registerOwaTools: (server, options) => {
      serverState.calls.push(['registerOwaTools', server, options]);
    },
  };
});

import { createOwaMcpServer } from './server.mjs';

function callNames() {
  return serverState.calls.map(([name]) => {
    return name;
  });
}

beforeEach(() => {
  serverState.calls = [];
  serverState.browserUrl = 'http://127.0.0.1:1';
  serverState.parsed = null;
  serverState.mcpServer = null;
  serverState.connectGate = null;
});

describe('createOwaMcpServer', () => {
  test("parses the client's argv as chrome-devtools-mcp's own", async () => {
    const { args } = await createOwaMcpServer({ argv: ['--headless'] });
    expect(serverState.calls[0]).toEqual([
      'parseArguments',
      '9.9.9-test',
      ['node', 'owa-devtools-mcp', '--headless'],
    ]);
    expect(args).toBe(serverState.parsed);
    expect(args.headless).toBe(true);
  });

  // A process-wide telemetry singleton that throws on the second session,
  // and a report from a church's machine to Google: off whatever was asked.
  test('turns usage statistics off even when the arguments asked for them', async () => {
    const { args } = await createOwaMcpServer({ argv: [] });
    expect(args.usageStatistics).toBe(false);
  });

  // The app's debugging port changes every launch; one long-lived server has
  // to follow it, so the URL is read on every access, never fixed at start.
  test('reads browserUrl from discovery on every access', async () => {
    const { args } = await createOwaMcpServer();
    const createCall = serverState.calls.find(([name]) => {
      return name === 'createMcpServer';
    });
    // chrome-devtools-mcp is handed the very object carrying the getter.
    expect(createCall[1]).toBe(args);
    expect(callNames()).not.toContain('resolveAppBrowserUrl');

    serverState.browserUrl = 'http://127.0.0.1:60401';
    expect(args.browserUrl).toBe('http://127.0.0.1:60401');
    serverState.browserUrl = 'http://127.0.0.1:60402';
    expect(args.browserUrl).toBe('http://127.0.0.1:60402');
    expect(
      callNames().filter((name) => {
        return name === 'resolveAppBrowserUrl';
      }),
    ).toHaveLength(2);
    expect(Object.keys(args)).toContain('browserUrl');
  });

  test('passes the log file through to chrome-devtools-mcp', async () => {
    await createOwaMcpServer({ logFile: 'C:/logs/mcp.log' });
    const createCall = serverState.calls.find(([name]) => {
      return name === 'createMcpServer';
    });
    expect(createCall[2]).toEqual({ logFile: 'C:/logs/mcp.log' });
  });

  test('registers the owa tools for the door it serves, stdio by default', async () => {
    const { server: stdioServer } = await createOwaMcpServer();
    const { server: appServer } = await createOwaMcpServer({ door: 'app' });
    const registered = serverState.calls.filter(([name]) => {
      return name === 'registerOwaTools';
    });
    expect(registered).toEqual([
      ['registerOwaTools', stdioServer, { door: 'stdio' }],
      ['registerOwaTools', appServer, { door: 'app' }],
    ]);
  });
});

describe('server.connect', () => {
  // The order is load-bearing: the banner is wrapped first and the firewall
  // last, so the firewall is the OUTERMOST handler and runs FIRST -- a call it
  // refuses must never also raise a banner saying the app did it. Both wrap
  // only after the SDK has installed its own handlers.
  test('wraps the banner, then the firewall, after the SDK has connected', async () => {
    const { server } = await createOwaMcpServer();
    let openGate;
    serverState.connectGate = new Promise((resolve) => {
      openGate = resolve;
    });
    serverState.calls = [];
    const transport = { name: 'a transport' };

    const connecting = server.connect(transport);
    await Promise.resolve();
    expect(callNames()).toEqual(['connect']);

    openGate();
    await expect(connecting).resolves.toBe('the SDK connected');
    expect(serverState.calls).toEqual([
      ['connect', transport],
      ['connected', transport],
      ['watchToolCalls', transport],
      ['guardToolCalls', transport],
    ]);
  });

  test('the server handed back is the one whose connect is wrapped', async () => {
    const { server } = await createOwaMcpServer();
    expect(server).toBe(serverState.mcpServer);
    serverState.calls = [];
    await server.connect({ name: 'second' });
    expect(callNames()).toEqual([
      'connect',
      'connected',
      'watchToolCalls',
      'guardToolCalls',
    ]);
  });
});
