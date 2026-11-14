// Asks a built MCP server the same questions an MCP client would, over stdio:
// `initialize`, `tools/list`, and the calls that need no app. Two uses:
//
// - the SMOKE check of a built executable (`mcpSea.mjs`): it starts, lists its
//   tools and answers from its own knowledge;
// - the PARITY check (`build-open-worship-app-mcp.mjs`): the npm package's
//   `node bin.mjs` and the single executable are asked the same, and every
//   answer -- the tool list with its descriptions and schemas, and each call's
//   result -- must be the same, the user's rule: "npm mcp and the single
//   executable have to be no different functionalities".
//
// HERMETIC by default: an empty temp folder (so no running app is found -- the
// discovery files live in the temp folder) and no `OWA_*` setting from the
// builder's shell. `--live` asks with the real temp folder instead.

import { spawn } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';

// Read-only, and none of them needs the app.
export const OFFLINE_CALL_LIST = [
  {
    name: 'owa_help_search',
    arguments: { query: 'add a song to the service', limit: 3 },
  },
  { name: 'owa_list_questions', arguments: { query: 'add a song' } },
  { name: 'owa_help_page', arguments: { id: 'W-11' } },
  { name: 'owa_tran', arguments: { text: 'Clear Long Text' } },
  { name: 'owa_app_state', arguments: {} },
];

const PROTOCOL_VERSION = '2025-06-18';

/** The builder's environment, minus everything that could point the server. */
export function genHermeticEnv(tempDir, baseEnv = process.env) {
  const env = {};
  for (const [key, value] of Object.entries(baseEnv)) {
    if (
      key.startsWith('OWA_') ||
      key.startsWith('npm_') ||
      key === 'NODE_OPTIONS' ||
      key === 'ELECTRON_RUN_AS_NODE'
    ) {
      continue;
    }
    env[key] = value;
  }
  if (tempDir) {
    env.TMPDIR = tempDir;
    env.TEMP = tempDir;
    env.TMP = tempDir;
  }
  return env;
}

/**
 * Spawns `command args`, speaks MCP to it, and answers what it said: its
 * `serverInfo`, `tools` and each call's `result` (or `error`).
 */
export function runMcpHandshake({
  command,
  args = [],
  cwd,
  env,
  callList = OFFLINE_CALL_LIST,
  timeoutMs = 120000,
}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const waiterMap = new Map();
    let stdoutBuffer = '';
    let stderrText = '';
    let isDone = false;
    const finish = (error, value) => {
      if (isDone) {
        return;
      }
      isDone = true;
      clearTimeout(timeoutId);
      child.kill();
      if (error) {
        const stderrTail = stderrText.trim().split('\n').slice(-8).join('\n');
        error.message += stderrTail
          ? `\n--- server stderr ---\n${stderrTail}`
          : '';
        reject(error);
      } else {
        resolve(value);
      }
    };
    const timeoutId = setTimeout(() => {
      finish(new Error(`The MCP server did not answer within ${timeoutMs} ms`));
    }, timeoutMs);
    child.on('error', (error) => {
      finish(error);
    });
    child.on('exit', (code, signal) => {
      finish(
        new Error(`The MCP server exited (code ${code}, signal ${signal})`),
      );
    });
    child.stderr.on('data', (chunk) => {
      stderrText = (stderrText + chunk.toString()).slice(-20000);
    });
    child.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString();
      let index = stdoutBuffer.indexOf('\n');
      while (index !== -1) {
        const line = stdoutBuffer.slice(0, index).trim();
        stdoutBuffer = stdoutBuffer.slice(index + 1);
        index = stdoutBuffer.indexOf('\n');
        if (line === '') {
          continue;
        }
        let message;
        try {
          message = JSON.parse(line);
        } catch (_error) {
          finish(
            new Error(`Not a protocol line on stdout: ${line.slice(0, 200)}`),
          );
          return;
        }
        waiterMap.get(message.id)?.(message);
      }
    });
    let nextId = 1;
    const send = (method, params) => {
      const id = nextId++;
      return new Promise((resolveMessage) => {
        waiterMap.set(id, resolveMessage);
        child.stdin.write(
          `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`,
        );
      });
    };
    (async () => {
      const initialized = await send('initialize', {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'owa-mcp-dist-check', version: '1.0.0' },
      });
      if (initialized.error) {
        throw new Error(`initialize failed: ${initialized.error.message}`);
      }
      child.stdin.write(
        `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`,
      );
      const listed = await send('tools/list', {});
      const tools = listed.result?.tools ?? [];
      const calls = [];
      for (const call of callList) {
        const answer = await send('tools/call', call);
        calls.push({
          name: call.name,
          arguments: call.arguments,
          result: answer.result ?? null,
          error: answer.error ?? null,
        });
      }
      finish(null, {
        serverInfo: initialized.result?.serverInfo ?? null,
        protocolVersion: initialized.result?.protocolVersion ?? null,
        tools,
        calls,
      });
    })().catch((error) => {
      finish(error);
    });
  });
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A handshake with the folders it ran from written `<root>`, so two copies of
 * one tree in two places compare equal (a page names where its knowledge
 * came from).
 */
export function normalizeHandshake(handshake, rootDirList) {
  let text = JSON.stringify(handshake);
  const rootList = rootDirList
    .filter(Boolean)
    .flatMap((rootDir) => {
      const posixRoot = rootDir.replaceAll('\\', '/');
      return [
        rootDir,
        posixRoot,
        JSON.stringify(rootDir).slice(1, -1),
        JSON.stringify(posixRoot).slice(1, -1),
      ];
    })
    .sort((left, right) => {
      return right.length - left.length;
    });
  for (const root of new Set(rootList)) {
    text = text.replace(new RegExp(escapeRegExp(root), 'g'), '<root>');
  }
  return JSON.parse(text);
}

/** What two handshakes answered differently, by tool and by call. */
export function compareHandshakes(left, right) {
  const differenceList = [];
  const toToolMap = (handshake) => {
    return new Map(
      handshake.tools.map((tool) => {
        return [tool.name, tool];
      }),
    );
  };
  const leftToolMap = toToolMap(left);
  const rightToolMap = toToolMap(right);
  for (const name of new Set([...leftToolMap.keys(), ...rightToolMap.keys()])) {
    if (!leftToolMap.has(name) || !rightToolMap.has(name)) {
      differenceList.push(
        `tool ${name}: only in the ${leftToolMap.has(name) ? 'first' : 'second'}`,
      );
    } else if (
      !isDeepStrictEqual(leftToolMap.get(name), rightToolMap.get(name))
    ) {
      differenceList.push(`tool ${name}: described differently`);
    }
  }
  left.calls.forEach((call, index) => {
    const other = right.calls[index];
    if (!isDeepStrictEqual(call, other)) {
      differenceList.push(`call ${call.name}: answered differently`);
    }
  });
  if (!isDeepStrictEqual(left.serverInfo, right.serverInfo)) {
    differenceList.push('serverInfo differs');
  }
  return differenceList;
}

/** One line per thing the smoke check must see, or why it did not. */
export function checkSmokeHandshake(handshake) {
  const problemList = [];
  const toolNameSet = new Set(
    handshake.tools.map((tool) => {
      return tool.name;
    }),
  );
  for (const name of ['owa_help_search', 'owa_app_state', 'take_screenshot']) {
    if (!toolNameSet.has(name)) {
      problemList.push(`no ${name} in tools/list`);
    }
  }
  if (toolNameSet.has('evaluate_script')) {
    problemList.push('evaluate_script is listed: the firewall is not in front');
  }
  const search = handshake.calls.find((call) => {
    return call.name === 'owa_help_search';
  });
  const searchText = JSON.stringify(search?.result ?? null);
  if (search?.result?.isError || !/W-\d+/.test(searchText)) {
    problemList.push('owa_help_search found no manual page');
  }
  return problemList;
}
