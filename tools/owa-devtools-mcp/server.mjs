// `owa-devtools-mcp` = chrome-devtools-mcp's browser tools, permanently aimed
// at the running Open Worship App, plus this app's own tools (`owaTools.mjs`).
//
// The app's debugging port changes every launch, and an MCP server's argv is
// fixed when its client spawns it -- so `browserUrl` is a live getter rather
// than a string. chrome-devtools-mcp re-reads it on every tool call, which
// means one long-lived server follows the app across restarts, and an app that
// is not running yet costs nothing but a failed connection.

import { createMcpServer } from 'chrome-devtools-mcp';
import { parseArguments } from 'chrome-devtools-mcp/build/src/config/mcp-options.js';
import { VERSION } from 'chrome-devtools-mcp/build/src/version.js';

import { readLiveInstances } from './discovery.mjs';
import { watchToolCalls } from './notify.mjs';
import { registerOwaTools } from './owaTools.mjs';

// Never falsy: an empty `browserUrl` makes chrome-devtools-mcp LAUNCH its own
// Chrome, which is the one thing this server must never do.
const NO_APP_URL = 'http://127.0.0.1:1';

export function resolveAppBrowserUrl() {
    const envPort = Number(process.env.OWA_CDP_PORT);
    if (Number.isInteger(envPort) && envPort > 0) {
        return `http://127.0.0.1:${envPort}`;
    }
    const [instance] = readLiveInstances();
    return instance ? `http://127.0.0.1:${instance.port}` : NO_APP_URL;
}

/**
 * `argv` is chrome-devtools-mcp's own CLI surface (`--headless`, `--viewport`,
 * `--logFile`, ...); anything it does not know is dropped by the caller.
 */
export async function createOwaMcpServer({ argv = [], logFile } = {}) {
    const args = parseArguments(VERSION, ['node', 'owa-devtools-mcp', ...argv]);
    // Two reasons, both hard requirements:
    //  - chrome-devtools-mcp's telemetry is a process-wide singleton that
    //    THROWS on a second `createMcpServer`, and the app serves one server
    //    per MCP session ("ClearcutLogger is already initialized" -> every
    //    session after the first one dies);
    //  - it would report usage from the operator's machine to Google, which an
    //    app that runs in a church back room has no business doing.
    args.usageStatistics = false;
    Object.defineProperty(args, 'browserUrl', {
        get: resolveAppBrowserUrl,
        configurable: true,
        enumerable: true,
    });
    const { server } = await createMcpServer(args, { logFile });
    registerOwaTools(server);
    // Wrapped here rather than at each transport: the stdio bin and the
    // in-app HTTP host both reach the window through this one server, and a
    // click nobody in the room made must say who made it. Set
    // OWA_MCP_NOTICE=0 to run without the banner.
    const connect = server.connect.bind(server);
    server.connect = async (transport) => {
        const connected = await connect(transport);
        // After, never before: the SDK chains whatever handler it finds.
        watchToolCalls(transport);
        return connected;
    };
    return { server, args };
}
