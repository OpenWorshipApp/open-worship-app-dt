// The JavaScript API of the `open-worship-app-mcp` npm package (types:
// `index.d.mts`): the SAME server its `open-worship-app-mcp` command runs, for
// a program that wants to start it, put it behind a transport of its own, or
// find the running app. Nothing here behaves differently from the command or
// from the extra-bin executable: every function below is the body they run.
//
// Light on import: finding the app reads a few small files, so the MCP server
// (chrome-devtools-mcp and puppeteer behind it) loads only when a server is
// asked for.
//
// The app's MCP door token never leaves through this API: an instance comes
// back without `mcpToken`. That capability guards the in-app HTTP door, and a
// program that drives the app through this package has no use for it.

import {
  CDP_INFO_DIR_PATH,
  findDrivenInstance as findDrivenInstanceWithToken,
  readLiveInstances,
  resolveAppBrowserUrl as resolveDrivenBrowserUrl,
} from './discovery.mjs';
import { redactSecrets } from './firewall.mjs';

/** Where every running app publishes how to reach it, one file per app. */
export const OWA_CDP_INFO_DIR_PATH = CDP_INFO_DIR_PATH;

function toPublicInstance(instance) {
  if (!instance) {
    return null;
  }
  const { mcpToken: _mcpToken, ...publicInstance } = instance;
  return publicInstance;
}

/** Every running Open Worship App, newest first. */
export function listOwaAppInstances() {
  return readLiveInstances().map(toPublicInstance);
}

/**
 * The app a server started now would drive (`OWA_CDP_PORT`, then
 * `OWA_CDP_TARGET=dev|prod`, then the newest), or null when none runs.
 */
export function findDrivenInstance() {
  return toPublicInstance(findDrivenInstanceWithToken());
}

/**
 * The debugging address of that app; `http://127.0.0.1:1` (which refuses
 * every connection) when none runs, never an empty value.
 */
export function resolveAppBrowserUrl() {
  return resolveDrivenBrowserUrl();
}

/**
 * The stdio door's MCP server, not yet connected: hand it any MCP transport
 * with `server.connect(transport)`.
 */
export async function createOwaMcpServer({ argv = [], logFile } = {}) {
  const { createStdioDoorServer } = await import('./stdio.mjs');
  const { server } = await createStdioDoorServer({ argv, logFile });
  return { server };
}

/** Serves the MCP server on this process's stdin/stdout, as the command does. */
export async function runOwaMcpStdioServer(options = {}) {
  const stdio = await import('./stdio.mjs');
  return stdio.runOwaMcpStdioServer(options);
}

/** Forwards a fixed local port to the app's debugging port of the moment. */
export async function runOwaMcpBridge(options = {}) {
  const bridge = await import('./bridge.mjs');
  return bridge.runOwaMcpBridge(options);
}

/** The firewall's scrubber: provider keys and tokens out of any text. */
export { redactSecrets };
