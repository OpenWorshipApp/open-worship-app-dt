// The stdio door as functions: what `bin.mjs` runs, and what the package API
// (`index.mjs`) hands a program that wants this server on its own stdio or
// behind a transport of its own. One body for both, so the command, the npm
// package and the extra-bin executable cannot drift apart.

import { StdioServerTransport } from 'chrome-devtools-mcp/build/src/third_party/index.js';

import { findDrivenInstance } from './discovery.mjs';
import { configureLangPacks } from './langPacks.mjs';
import { createOwaMcpServer } from './server.mjs';
import { logToStderr } from './stderrLog.mjs';

/**
 * A language's dictionary, corpus and manual are read from the folders the
 * app being driven has INSTALLED (its instance file names them, `langDirs`),
 * the same ones its own in-app door reads; a checkout's source packages only
 * when no app says (`langPacks.mjs`).
 */
export function configureDrivenLangPacks() {
  configureLangPacks(() => {
    const langDirs = findDrivenInstance()?.langDirs;
    return Array.isArray(langDirs) ? langDirs : null;
  });
}

/**
 * The stdio door's server, not yet connected: `argv` is chrome-devtools-mcp's
 * own CLI surface (`--headless`, `--viewport=1280x720`, ...).
 */
export async function createStdioDoorServer({ argv = [], logFile } = {}) {
  configureDrivenLangPacks();
  return createOwaMcpServer({ argv, logFile });
}

/**
 * Serves the stdio door on this process's stdin/stdout. Ending the process
 * when the client goes away is the caller's business (`bin.mjs` does it).
 */
export async function runOwaMcpStdioServer({
  argv = [],
  logFile,
  log = logToStderr,
} = {}) {
  const { server } = await createStdioDoorServer({ argv, logFile });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('connected over stdio');
  return {
    server,
    close: async () => {
      await server.close();
    },
  };
}
