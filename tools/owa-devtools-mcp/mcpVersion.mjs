// Which app version this MCP server was made from, and whether the app it
// drives is that version (2026-11-13, the user: _make the mcp to remind agent
// to check mcp version and app version, it should match for the best
// result_). The tools find controls by the words, panels and pages of the app
// they were written with, so a server older or newer than the app can miss a
// control the app renamed, or offer one it does not have yet.
//
// Where the version comes from:
//   - the npm package and the extra-bin executable: `mcp-version.json` beside
//     this file, written by `stageMcpRuntimeTree` with the app's version;
//   - this checkout (`./.mcp.json`, the in-app host in dev): the app's own
//     `package.json` two folders up.
// A leaf: `node:fs` and nothing of the server's.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const MCP_VERSION_FILE_NAME = 'mcp-version.json';

function readVersionField(filePath, fieldName) {
  try {
    const value = JSON.parse(readFileSync(filePath, 'utf8'))?.[fieldName];
    return typeof value === 'string' && value.trim() !== ''
      ? value.trim()
      : null;
  } catch {
    return null;
  }
}

// One short string, read once: it cannot change while the process runs.
let cachedMcpVersion;

/** The app version this server was made from, or null when unknown. */
export function readMcpVersion() {
  if (cachedMcpVersion === undefined) {
    cachedMcpVersion =
      readVersionField(path.join(HERE, MCP_VERSION_FILE_NAME), 'appVersion') ??
      readVersionField(path.join(HERE, '..', '..', 'package.json'), 'version');
  }
  return cachedMcpVersion;
}

/** What `stageMcpRuntimeTree` writes beside the server. */
export function genMcpVersionFileText(appVersion) {
  return `${JSON.stringify({ appVersion }, null, 2)}\n`;
}

function toVersionParts(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(version ?? '').trim());
  return match === null ? null : match.slice(1, 4).map(Number);
}

/**
 * -1, 0 or 1 as `left` is older than, the same as or newer than `right`;
 * null when either is not a version. Part by part as numbers, so the app's
 * `2026.11.02` and npm's `2026.11.2` are the same version.
 */
export function compareAppVersions(left, right) {
  const leftParts = toVersionParts(left);
  const rightParts = toVersionParts(right);
  if (leftParts === null || rightParts === null) {
    return null;
  }
  for (let index = 0; index < 3; index++) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] < rightParts[index] ? -1 : 1;
    }
  }
  return 0;
}

/**
 * This server's version against the app's, with what to do when they differ
 * -- a sentence, not a flag: a model infers past a missing key.
 */
export function genVersionCheck(appVersion, mcpVersion = readMcpVersion()) {
  const order = compareAppVersions(mcpVersion, appVersion);
  if (order === 0) {
    return { mcp: mcpVersion, app: appVersion, isMatch: true };
  }
  const base = { mcp: mcpVersion ?? null, app: appVersion ?? null };
  if (order === null) {
    return {
      ...base,
      isMatch: null,
      note:
        'Could not tell whether this MCP server matches the app: one of the ' +
        'two versions is unknown. For the best result they should be the ' +
        'same.',
    };
  }
  const update =
    order < 0
      ? `This MCP server (from app ${mcpVersion}) is OLDER than the app ` +
        `(${appVersion}): some controls may be named or placed otherwise ` +
        'now. Update the server to the app\'s version -- in the app, ' +
        'Settings > Others > Extra Binaries > Update, or the npm package ' +
        'open-worship-app-mcp -- then reconnect.'
      : `This MCP server (from app ${mcpVersion}) is NEWER than the app ` +
        `(${appVersion}): it may expect controls this app does not have ` +
        'yet. Update the app, or use a server from the same version.';
  return {
    ...base,
    isMatch: false,
    note: `${update} Tell the user before relying on a press.`,
  };
}
