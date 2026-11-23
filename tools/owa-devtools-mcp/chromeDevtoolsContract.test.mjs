import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';

import { McpServer } from 'chrome-devtools-mcp';
import { BrowserManager } from 'chrome-devtools-mcp/build/src/BrowserManager.js';
import { NO_CONFIG_DISCOVERY_ENV } from 'chrome-devtools-mcp/build/src/config/ConfigLocator.js';
import { ConfigParser } from 'chrome-devtools-mcp/build/src/config/ConfigParser.js';
import {
  puppeteer,
  StdioServerTransport,
} from 'chrome-devtools-mcp/build/src/third_party/index.js';
import { VERSION } from 'chrome-devtools-mcp/build/src/version.js';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { pageIdSchema } from 'chrome-devtools-mcp/build/src/tools/ToolDefinition.js';

import {
  closeBrowserWithServer,
  makePageIdOptional,
  restoreSdkToolCalls,
} from './server.mjs';

// The REAL chrome-devtools-mcp, nothing mocked. `server.mjs` reaches into
// its build folder, and every other test of that file mocks those paths --
// which is how 1.12 shipped green with `parseArguments` gone: the server
// died on load and both doors with it (2026-11-07). A version that moves or
// renames any of these fails here instead.

let tempDirPath = null;

afterEach(() => {
  if (tempDirPath !== null) {
    fs.rmSync(tempDirPath, { recursive: true, force: true });
    tempDirPath = null;
  }
});

function genConfigHomeEnv() {
  // Where `ConfigLocator` looks on each OS family, both written: a config
  // file there turns `headless` on.
  tempDirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'owa-cdm-contract-'));
  for (const dirPath of [
    path.join(tempDirPath, 'Google', 'cd4a'),
    path.join(tempDirPath, 'cd4a'),
  ]) {
    fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFileSync(
      path.join(dirPath, 'config.json'),
      JSON.stringify({ headless: true }),
    );
  }
  return { LOCALAPPDATA: tempDirPath, XDG_CONFIG_HOME: tempDirPath };
}

function parseConfig(env) {
  return new ConfigParser(
    VERSION,
    ['node', 'owa-devtools-mcp'],
    env,
    false,
  ).parseConfig();
}

/**
 * A real chrome-devtools-mcp server with one tool of ours registered AFTER
 * it, the way `registerOwaTools` does, asked over a real stdio transport.
 * No browser is reached: the probe answers by itself, and the chrome tool is
 * called without its required `pageId`, which it refuses before connecting.
 */
async function askAfterRegistering({ isRestored, instructions = null }) {
  const config = parseConfig({ [NO_CONFIG_DISCOVERY_ENV]: '1' });
  config.resolved.usageStatistics = false;
  const browserManager = new BrowserManager(config, {});
  const { server } = await McpServer.from(config, { browserManager });
  if (isRestored) {
    restoreSdkToolCalls(server);
  }
  if (instructions !== null) {
    // What server.mjs does for the stdio door.
    server.server._instructions = instructions;
  }
  server.registerTool('owa_probe', { description: 'probe' }, async () => {
    return { content: [{ type: 'text', text: 'probed' }] };
  });
  const input = new PassThrough();
  const output = new PassThrough();
  const replyMap = new Map();
  let buffer = '';
  output.on('data', (chunk) => {
    buffer += chunk;
    let at;
    while ((at = buffer.indexOf('\n')) >= 0) {
      const message = JSON.parse(buffer.slice(0, at));
      buffer = buffer.slice(at + 1);
      replyMap.get(message.id)?.(message);
    }
  });
  await server.connect(new StdioServerTransport(input, output));
  const ask = (id, method, params) => {
    return new Promise((resolve) => {
      replyMap.set(id, resolve);
      input.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  };
  const initialized = await ask(1, 'initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'contract-test', version: '1' },
  });
  input.write(
    JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) +
      '\n',
  );
  const listed = await ask(2, 'tools/list', {});
  const probe = await ask(3, 'tools/call', {
    name: 'owa_probe',
    arguments: {},
  });
  const chrome = await ask(4, 'tools/call', {
    name: 'take_snapshot',
    arguments: {},
  });
  await server.close();
  return { initialized, listed, probe, chrome };
}

describe('chrome-devtools-mcp, as server.mjs uses it', () => {
  test('still has every name server.mjs imports', () => {
    expect(typeof McpServer?.from).toBe('function');
    expect(typeof BrowserManager).toBe('function');
    expect(typeof ConfigParser).toBe('function');
    expect(typeof NO_CONFIG_DISCOVERY_ENV).toBe('string');
    expect(typeof puppeteer?.connect).toBe('function');
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
    // `owa_choose_app` drops the session's browser through it, so the next
    // chrome-devtools call connects to the app chosen (`server.mjs`).
    expect(typeof BrowserManager.prototype.abandonPendingAttempt).toBe(
      'function',
    );
  });

  // The stdio door's instructions (`appChoice.mjs`) ride the SDK server's
  // own field, which `initialize` answers with.
  test('answers initialize with the instructions set on the SDK server', async () => {
    const { initialized } = await askAfterRegistering({
      isRestored: true,
      instructions: 'Check the versions.',
    });
    expect(initialized.result.instructions).toBe('Check the versions.');
  }, 30_000);

  test('keeps one `resolved` object, so the live browserUrl getter holds', () => {
    const config = parseConfig({ [NO_CONFIG_DISCOVERY_ENV]: '1' });
    expect(config.resolved).toBe(config.resolved);
    let port = 1;
    Object.defineProperty(config.resolved, 'browserUrl', {
      get: () => `http://127.0.0.1:${port}`,
      configurable: true,
      enumerable: true,
    });
    port = 60401;
    expect(config.resolved.browserUrl).toBe('http://127.0.0.1:60401');
    port = 60402;
    expect(config.resolved.browserUrl).toBe('http://127.0.0.1:60402');
  });

  // Proves the next test can fail: 1.12 answers tools/call from its own map.
  test('on its own, refuses a tool registered after it', async () => {
    const { listed, probe } = await askAfterRegistering({ isRestored: false });
    const names = listed.result.tools.map((tool) => {
      return tool.name;
    });
    expect(names).toContain('owa_probe');
    expect(probe.error?.message).toMatch(/owa_probe not found/);
  }, 30_000);

  // `server.mjs` relaxes the one `pageIdSchema` every page tool spreads
  // (`AD-39`); the version that moves it, or stops spreading it, fails here.
  test('builds every page tool from pageIdSchema, and takes no pageId once it is optional', async () => {
    const listTakeSnapshot = async () => {
      const config = parseConfig({ [NO_CONFIG_DISCOVERY_ENV]: '1' });
      config.resolved.usageStatistics = false;
      const browserManager = new BrowserManager(config, {});
      const { server } = await McpServer.from(config, { browserManager });
      const tool = server._registeredTools.take_snapshot;
      const result = {
        isEmptyAllowed: tool.inputSchema.safeParse({}).success,
        isPageIdAllowed: tool.inputSchema.safeParse({ pageId: 2 }).success,
      };
      await server.close();
      return result;
    };
    const original = pageIdSchema.pageId;
    try {
      expect(await listTakeSnapshot()).toEqual({
        isEmptyAllowed: false,
        isPageIdAllowed: true,
      });
      makePageIdOptional();
      expect(await listTakeSnapshot()).toEqual({
        isEmptyAllowed: true,
        isPageIdAllowed: true,
      });
    } finally {
      pageIdSchema.pageId = original;
    }
  }, 30_000);

  test("serves our tools and its own once tools/call is the SDK's again", async () => {
    const { probe, chrome } = await askAfterRegistering({ isRestored: true });
    expect(probe.error).toBeUndefined();
    expect(probe.result.content).toEqual([{ type: 'text', text: 'probed' }]);
    // Its own tool still answers -- refused for the missing pageId, which
    // is the tool's own validation, not "not found".
    expect(chrome.error).toBeUndefined();
    expect(chrome.result.isError).toBe(true);
    expect(JSON.stringify(chrome.result.content)).toMatch(/pageId/);
  }, 30_000);

  /**
   * A real server on a real (idle) transport, its BrowserManager watched.
   * The host closes a session through the SDK server it was handed, never
   * through chrome-devtools' own -- so that close is the one asked here.
   */
  async function closeThroughSdk({ isWired }) {
    const config = parseConfig({ [NO_CONFIG_DISCOVERY_ENV]: '1' });
    config.resolved.usageStatistics = false;
    const browserManager = new BrowserManager(config, {});
    const closeBrowser = vi.spyOn(browserManager, 'close');
    const mcpServer = await McpServer.from(config, { browserManager });
    if (isWired) {
      closeBrowserWithServer(mcpServer);
    }
    const { server } = mcpServer;
    await server.connect(
      new StdioServerTransport(new PassThrough(), new PassThrough()),
    );
    await server.close();
    const browserCloseCount = closeBrowser.mock.calls.length;
    const isConnected = server.isConnected();
    // Clean-up, whatever the outcome.
    await mcpServer.close();
    return { browserCloseCount, isConnected };
  }

  // Proves the next test can fail: in 1.12 each session holds its own
  // browser, and the SDK's close does not reach it.
  test("on its own, the SDK server's close leaves the browser open", async () => {
    const { browserCloseCount } = await closeThroughSdk({ isWired: false });
    expect(browserCloseCount).toBe(0);
  }, 30_000);

  test("closing the SDK server closes the session's browser too", async () => {
    const { browserCloseCount, isConnected } = await closeThroughSdk({
      isWired: true,
    });
    expect(browserCloseCount).toBe(1);
    // The SDK half is closed as well, which only happens while
    // chrome-devtools' own close() still closes it.
    expect(isConnected).toBe(false);
  }, 30_000);

  test('reads a config file from the profile unless discovery is off', () => {
    const env = genConfigHomeEnv();
    // Proves the file is found, so the next assertion can fail.
    expect(parseConfig(env).resolved.headless).toBe(true);
    const config = parseConfig({ ...env, [NO_CONFIG_DISCOVERY_ENV]: '1' });
    expect(config.resolved.headless).toBe(false);
    expect(config.configPath).toBeUndefined();
  });
});
