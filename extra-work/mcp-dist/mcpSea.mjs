// Builds `open-worship-app-mcp[.exe]`, the MCP server as a Node single
// executable (https://nodejs.org/api/single-executable-applications.html) for
// a computer with no Node: the extra-bin pack's `mcp/` folder.
//
// The binary is Node itself plus a three-line bootstrap (`SEA_MAIN_SOURCE`)
// that loads `launch.cjs` from DISK beside it, which starts
// `tools/owa-devtools-mcp/bin.mjs` from the runtime tree around it. Nothing of
// the server is inside the binary, so it runs the very files the npm package
// runs -- one body, two launchers, and `mcpHandshake.mjs` holds them to the
// same answers.
//
// The Node that runs this script is the Node inside the executable: it must
// be an official static build (`checkNodeForSea`), and the release machine of
// each OS builds that OS's pack. Node 25.5 and later build the executable
// themselves (`--build-sea`); an older one prepares the blob
// (`--experimental-sea-config`) and `postject` injects it.

import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  closeSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import {
  MCP_LAUNCH_FILE_NAME,
  SEA_FUSE,
  SEA_LAUNCH_SOURCE,
  SEA_MAIN_SOURCE,
  checkNodeForSea,
  genSeaConfig,
} from './mcpDistHelpers.mjs';
import {
  checkSmokeHandshake,
  genHermeticEnv,
  runMcpHandshake,
} from './mcpHandshake.mjs';

const require = createRequire(import.meta.url);
const isMac = process.platform === 'darwin';

/** Whether a (large) binary holds a string, read a megabyte at a time. */
export function checkFileHasText(filePath, text) {
  const needle = Buffer.from(text);
  const chunkSize = 1024 * 1024;
  const buffer = Buffer.alloc(chunkSize + needle.length);
  const fd = openSync(filePath, 'r');
  try {
    let carry = 0;
    let position = 0;
    for (;;) {
      const bytesRead = readSync(fd, buffer, carry, chunkSize, position);
      if (bytesRead === 0) {
        return false;
      }
      const view = buffer.subarray(0, carry + bytesRead);
      if (view.includes(needle)) {
        return true;
      }
      // Keep the tail: the string may cross the edge of a read.
      carry = Math.min(needle.length - 1, view.length);
      view.copy(buffer, 0, view.length - carry);
      position += bytesRead;
    }
  } finally {
    closeSync(fd);
  }
}

/** Whether the running Node can be the executable's runtime, and how. */
export function readNodeSeaSupport() {
  const check = checkNodeForSea({
    version: process.versions.node,
    release: process.release,
    config: process.config,
    hasFuse: checkFileHasText(process.execPath, SEA_FUSE),
  });
  const helpText =
    spawnSync(process.execPath, ['--help'], { encoding: 'utf8' }).stdout ?? '';
  return {
    ...check,
    nodeVersion: process.versions.node,
    hasBuildSea: helpText.includes('--build-sea'),
  };
}

function runChecked(command, argList, options = {}) {
  const result = spawnSync(command, argList, { encoding: 'utf8', ...options });
  if (result.status !== 0) {
    const detail = (
      result.stderr ||
      result.stdout ||
      result.error?.message ||
      ''
    ).trim();
    throw new Error(`"${command} ${argList.join(' ')}" failed: ${detail}`);
  }
  return result.stdout;
}

// A Node downloaded through a browser carries macOS's quarantine flag, and a
// copy keeps it. Gatekeeper then holds the first launch of the ad-hoc signed
// executable -- measured 2026-11-13: the process sat at launch with no CPU,
// and that binary kept doing so after the flag was taken off. So the copy is
// cleared before it is ever started.
function clearMacAttributes(filePath) {
  if (isMac) {
    spawnSync('xattr', ['-c', filePath]);
  }
}

/**
 * Writes the executable to `outFilePath` and `launch.cjs` beside it. The
 * runtime tree must be (or will be) in the same folder.
 */
export async function buildMcpExecutable({ outFilePath }) {
  const support = readNodeSeaSupport();
  if (!support.isUsable) {
    throw new Error(
      `Node ${support.nodeVersion} cannot be the MCP executable's runtime: ` +
        support.reason,
    );
  }
  const outDir = path.dirname(outFilePath);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, MCP_LAUNCH_FILE_NAME), SEA_LAUNCH_SOURCE);
  const workDir = mkdtempSync(path.join(os.tmpdir(), 'owa-mcp-sea-'));
  try {
    const mainPath = path.join(workDir, 'sea-main.cjs');
    const configPath = path.join(workDir, 'sea-config.json');
    writeFileSync(mainPath, SEA_MAIN_SOURCE);
    rmSync(outFilePath, { force: true });
    if (support.hasBuildSea) {
      writeFileSync(
        configPath,
        JSON.stringify(genSeaConfig({ mainPath, outputPath: outFilePath })),
      );
      runChecked(process.execPath, ['--build-sea', configPath], {
        cwd: workDir,
      });
    } else {
      const blobPath = path.join(workDir, 'sea-prep.blob');
      writeFileSync(
        configPath,
        JSON.stringify(genSeaConfig({ mainPath, outputPath: blobPath })),
      );
      runChecked(process.execPath, ['--experimental-sea-config', configPath], {
        cwd: workDir,
      });
      copyFileSync(process.execPath, outFilePath);
      clearMacAttributes(outFilePath);
      if (isMac) {
        runChecked('codesign', ['--remove-signature', outFilePath]);
      }
      const { inject } = require('postject');
      await inject(outFilePath, 'NODE_SEA_BLOB', readFileSync(blobPath), {
        sentinelFuse: SEA_FUSE,
        ...(isMac ? { machoSegmentName: 'NODE_SEA' } : {}),
      });
    }
    clearMacAttributes(outFilePath);
    if (isMac) {
      // Ad hoc: an Apple Silicon Mac runs no unsigned code at all.
      runChecked('codesign', ['--sign', '-', '--force', outFilePath]);
    }
    if (process.platform !== 'win32') {
      chmodSync(outFilePath, 0o755);
    }
    return {
      outFilePath,
      nodeVersion: support.nodeVersion,
      method: support.hasBuildSea ? '--build-sea' : 'postject',
    };
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

/**
 * Starts the built executable as a client would, with no app to find, and
 * holds it to listing its tools behind the firewall and answering from its
 * knowledge. Answers the handshake.
 */
export async function smokeTestMcpExecutable({ exePath }) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'owa-mcp-smoke-'));
  try {
    const handshake = await runMcpHandshake({
      command: exePath,
      cwd: tempDir,
      env: genHermeticEnv(tempDir),
    });
    const problemList = checkSmokeHandshake(handshake);
    if (problemList.length > 0) {
      throw new Error(
        `The MCP executable answered wrong: ${problemList.join('; ')}`,
      );
    }
    return handshake;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
