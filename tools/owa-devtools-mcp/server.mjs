// `owa-devtools-mcp` = chrome-devtools-mcp's browser tools, permanently aimed
// at the running Open Worship App, plus this app's own tools (`owaTools.mjs`).
//
// The app's debugging port changes every launch, and an MCP server's argv is
// fixed when its client spawns it -- so `browserUrl` is a live getter rather
// than a string. chrome-devtools-mcp re-reads it on every connection, which
// means one long-lived server follows the app across restarts, and an app that
// is not running yet costs nothing but a failed connection.
//
// Since chrome-devtools-mcp 1.12 its `createMcpServer` copies the arguments
// into a `ServerConfig` (`{ ...resolved }`), which reads a getter ONCE and
// keeps the port of that moment for good -- so the server is put together
// here from the same parts, and the getter goes on the config's own
// `resolved`, the object `BrowserManager` reads at every connect.

import { McpServer } from 'chrome-devtools-mcp';
import { BrowserManager } from 'chrome-devtools-mcp/build/src/BrowserManager.js';
import { NO_CONFIG_DISCOVERY_ENV } from 'chrome-devtools-mcp/build/src/config/ConfigLocator.js';
import { ConfigParser } from 'chrome-devtools-mcp/build/src/config/ConfigParser.js';
import { puppeteer } from 'chrome-devtools-mcp/build/src/third_party/index.js';
import { VERSION } from 'chrome-devtools-mcp/build/src/version.js';

import { skipDevToolsTargets } from './devToolsTargets.mjs';
import { resolveAppBrowserUrl } from './discovery.mjs';
import { guardToolCalls } from './firewall.mjs';
import { listLangPacks, readLangPackJson } from './langPacks.mjs';
import { watchToolCalls } from './notify.mjs';
import { registerOwaTools } from './owaTools.mjs';
import { configureWorldLanguageParts } from './worldLanguages.mjs';

// What the Bible import and the lyric tools know of a language in its own
// words comes from that language's INSTALLED folder (`world.json`), the same
// folders `langPacks.mjs` reads its dictionary from; English is the app's.
configureWorldLanguageParts(() => {
  return listLangPacks().map((pack) => {
    return readLangPackJson(pack, 'world.json');
  });
});

/**
 * chrome-devtools-mcp 1.12 answers `tools/call` itself, out of ITS OWN tool
 * map, so every `owa_*` tool registered after it was listed by `tools/list`
 * and then refused as "Tool owa_app_state not found" -- the chatbot, which
 * calls nothing else, could do nothing (2026-11-07). The SDK's own handler
 * serves every tool registered with the SDK, and chrome-devtools registers
 * its tools there as well, enabled or disabled as its own map has them; so
 * the call goes back to it, and both families answer through one door.
 * Before `connect`: the SDK registers its capabilities again on the way.
 */
export function restoreSdkToolCalls(server) {
  server.server.removeRequestHandler('tools/call');
  server.server.removeRequestHandler('tools/list');
  server._toolHandlersInitialized = false;
  server.setToolRequestHandlers();
}

/**
 * Closing the SDK server -- what the in-app host does when a session ends,
 * is swept idle or is pushed out at the cap -- closes chrome-devtools' own
 * server with it, and so lets go of the session's browser connection.
 *
 * Until 1.12 the browser was ONE module-level connection every session
 * shared; since then each session's `BrowserManager` holds its own, and only
 * chrome-devtools' `McpServer.close()` disconnects it (never closing the app:
 * a browser it connected to is disconnected, not closed). The host is handed
 * the SDK server alone, so each closed session left a CDP connection, with
 * its page listeners, open in the app's main process -- measured 2026-11-07,
 * four closed sessions, four connections, growing with every 15-minute idle
 * sweep of the chatbot's session (`.claude/rules/agent-access.md`).
 *
 * chrome-devtools' `close()` closes the SDK half through this very method,
 * so from the first call on the method is the SDK's own again: the inner call
 * (and any later one) closes only that, whether it comes synchronously or
 * after an await.
 */
export function closeBrowserWithServer(mcpServer) {
  const { server } = mcpServer;
  const closeSdkServer = server.close;
  let isClosing = false;
  server.close = async () => {
    if (isClosing) {
      return closeSdkServer.call(server);
    }
    isClosing = true;
    await mcpServer.close();
  };
}

/**
 * `argv` is chrome-devtools-mcp's own CLI surface (`--headless`, `--viewport`,
 * `--logFile`, ...); anything it does not know is dropped by the caller.
 * `door` is who is on the other end: `app` for the in-app HTTP host (the
 * chatbot), `stdio` for an outside agent -- said in what a tool writes into
 * the user's files, e.g. who installed a Bible.
 */
export async function createOwaMcpServer({
  argv = [],
  logFile,
  door = 'stdio',
} = {}) {
  // No config-file discovery: chrome-devtools-mcp would otherwise read a
  // `cd4a` config.json from the user's profile, and nothing on this machine
  // outside this package may change what the server offers.
  const config = new ConfigParser(
    VERSION,
    ['node', 'owa-devtools-mcp', ...argv],
    { ...process.env, [NO_CONFIG_DISCOVERY_ENV]: '1' },
    false,
  ).parseConfig();
  const args = config.resolved;
  // Two reasons, both hard requirements:
  //  - chrome-devtools-mcp's telemetry is a process-wide singleton that
  //    THROWS on a second `createMcpServer`, and the app serves one server
  //    per MCP session ("ClearcutLogger is already initialized" -> every
  //    session after the first one dies);
  //  - it would report usage from the operator's machine to Google, which an
  //    app that runs in a church back room has no business doing.
  args.usageStatistics = false;
  Object.defineProperty(args, 'browserUrl', {
    get: () => resolveAppBrowserUrl(),
    configurable: true,
    enumerable: true,
  });
  // Before the first connection: a DevTools window is never a page to the
  // browser tools -- on Chromium 128 it hung every one of them, and its
  // console has Node. See `devToolsTargets.mjs`.
  skipDevToolsTargets(puppeteer);
  const browserManager = new BrowserManager(config, { logFile });
  const mcpServer = await McpServer.from(config, { browserManager, logFile });
  const { server } = mcpServer;
  closeBrowserWithServer(mcpServer);
  restoreSdkToolCalls(server);
  registerOwaTools(server, { door });
  // Wrapped here rather than at each transport: the stdio bin and the
  // in-app HTTP host both reach the window through this one server, and a
  // click nobody in the room made must say who made it. Set
  // OWA_MCP_NOTICE=0 to run without the banner.
  const connect = server.connect.bind(server);
  server.connect = async (transport) => {
    const connected = await connect(transport);
    // After, never before: the SDK chains whatever handler it finds.
    watchToolCalls(transport);
    // Last, so it is the OUTERMOST wrapper and therefore runs FIRST. The
    // order is load-bearing: a call the firewall refuses must not also
    // raise a banner telling the user the app just did it. See
    // `firewall.mjs` for what it refuses and why.
    guardToolCalls(transport);
    return connected;
  };
  return { server, args };
}
