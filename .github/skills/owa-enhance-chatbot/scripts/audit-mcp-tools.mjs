// Audits the MCP tool surface of the RUNNING app -- the thing the chatbot pays
// for on every single round of every single question.
//
//   node .claude/skills/owa-enhance-chatbot/scripts/audit-mcp-tools.mjs
//   node .../audit-mcp-tools.mjs --json          # machine-readable
//   node .../audit-mcp-tools.mjs --rounds=10     # what a full tool loop costs
//   node .../audit-mcp-tools.mjs --stdio         # the code on disk, no restart
//   node .../audit-mcp-tools.mjs --ratchet       # fail if the bill has grown
//   node .../audit-mcp-tools.mjs --ratchet=8200  # ...against your own ceiling
//
// It asks the app's own MCP host for `tools/list` exactly the way
// `src/chatbot/mcpClient.ts` does, then reports what each tool costs in the
// prompt and whether it announces itself in the window when it acts.
//
// Read-only: it lists tools, it never calls one. Exits 1 when it cannot reach
// a running app, and -- with `--ratchet` -- when the MODEL's bill has crossed
// the recorded ceiling. Otherwise safe to run at any point in a session.

import { readdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// scripts -> owa-enhance-chatbot -> skills -> .claude|.github -> repo root
const REPO_ROOT = path.join(HERE, '..', '..', '..', '..');
const DISCOVERY_DIR = path.join(os.tmpdir(), 'open-worship-app-cdp');
// Characters per token, rounded the pessimistic way. Good enough to compare
// tools with each other, which is the only thing this number is used for.
const CHARS_PER_TOKEN = 4;

const argv = process.argv.slice(2);
const isJson = argv.includes('--json');
const roundsArg = argv.find((one) => one.startsWith('--rounds='));
// `MAX_TOOL_ROUNDS` in src/chatbot/llmBotHelpers.ts.
const rounds = roundsArg ? Number(roundsArg.split('=')[1]) : 10;

// `MC-14` -- the ratchet. The surface grew 19% in a day because adding a tool
// is easy and nobody is billed at the time, and the only thing standing
// against that was this file asking people to run a script.
//
// The ceiling is on the MODEL's bill, not the host's: the developer's door may
// grow, and a tool added "for the developer" that quietly reaches the model is
// exactly the regression this catches. Measured 2026-09-17 at 24 tools /
// ~7 990 tokens; the headroom is one small tool, so a deliberate addition
// raises this line IN THE SAME CHANGE and says why -- which is the point. It
// is not a budget to spend down to.
//
// Lowered 2026-09-18 from 8 200 to 7 450 when MC-07's description cut took
// the bill to ~7 253: a ceiling left where it was would have handed the
// saving straight back as ~950 tokens of room nobody decided to spend.
const MODEL_TOKEN_CEILING = 7450;
const ratchetArg = argv.find((one) => {
    return one === '--ratchet' || one.startsWith('--ratchet=');
});
const ratchetCeiling = ratchetArg
    ? (Number(ratchetArg.split('=')[1]) || MODEL_TOKEN_CEILING)
    : null;

// The published instance file carries `mcpUrl`; the default port is a default,
// never a promise. OWA_MCP_URL wins, for a bridged or a second instance.
function resolveMcpUrl() {
    if (process.env.OWA_MCP_URL) {
        return process.env.OWA_MCP_URL;
    }
    let names = [];
    try {
        names = readdirSync(DISCOVERY_DIR);
    } catch {
        throw new Error(
            'No app is publishing an endpoint. Start it with ' +
                '`env -u ELECTRON_RUN_AS_NODE npm run dev`.',
        );
    }
    const instances = [];
    for (const name of names) {
        if (!name.endsWith('.json')) {
            continue;
        }
        try {
            const info = JSON.parse(
                readFileSync(path.join(DISCOVERY_DIR, name), 'utf8'),
            );
            if (info?.mcpUrl) {
                instances.push(info);
            }
        } catch {
            // A file half-written by an instance that is still starting.
        }
    }
    if (instances.length === 0) {
        throw new Error('No published instance carries an mcpUrl.');
    }
    // Newest first: a stale file for a dead pid sorts to the back.
    instances.sort((one, other) => {
        return String(other.startedAt).localeCompare(String(one.startedAt));
    });
    return instances[0].mcpUrl;
}

let sessionId = null;
let requestId = 0;

async function post(mcpUrl, body) {
    const headers = {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
    };
    if (sessionId !== null) {
        headers['mcp-session-id'] = sessionId;
    }
    const response = await fetch(mcpUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
    });
    const newSessionId = response.headers.get('mcp-session-id');
    if (newSessionId) {
        sessionId = newSessionId;
    }
    if (!response.ok) {
        throw new Error(`The assistant service answered ${response.status}`);
    }
    if (response.status === 202) {
        return null;
    }
    const data = await response.json();
    if (data?.error) {
        throw new Error(data.error.message ?? 'The call failed');
    }
    return data?.result ?? null;
}

// `--stdio`: ask a FRESH server spawned from the code on disk instead of the
// app's HTTP host. The host cached `server.mjs` on its first session, so after
// an edit it reports the surface the app STARTED with -- measuring a change
// used to mean restarting the operator's app (memory:
// `mcp-tool-edit-two-processes`). The fresh server still finds the running app
// for anything that needs one; `tools/list` needs none.
async function listToolsOverStdio() {
    const { spawn } = await import('node:child_process');
    const binPath = path.join(REPO_ROOT, 'tools', 'owa-devtools-mcp', 'bin.mjs');
    const child = spawn(process.execPath, [binPath], {
        stdio: ['pipe', 'pipe', 'ignore'],
        cwd: REPO_ROOT,
    });
    try {
        const answerMap = new Map();
        let buffer = '';
        child.stdout.on('data', (chunk) => {
            buffer += chunk.toString();
            let index = buffer.indexOf('\n');
            while (index !== -1) {
                const line = buffer.slice(0, index).trim();
                buffer = buffer.slice(index + 1);
                index = buffer.indexOf('\n');
                try {
                    const message = JSON.parse(line);
                    answerMap.get(message.id)?.(message);
                } catch {
                    // Not a protocol line.
                }
            }
        });
        const send = (id, method, params) => {
            return new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error(`${method} timed out`));
                }, 60000);
                answerMap.set(id, (message) => {
                    clearTimeout(timeoutId);
                    resolve(message);
                });
                child.stdin.write(
                    `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`,
                );
            });
        };
        await send(1, 'initialize', {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'owa-enhance-chatbot-audit', version: '1.0.0' },
        });
        child.stdin.write(
            `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`,
        );
        const listed = await send(2, 'tools/list', {});
        return listed.result?.tools ?? [];
    } finally {
        child.kill();
    }
}

async function listTools(mcpUrl) {
    requestId += 1;
    await post(mcpUrl, {
        jsonrpc: '2.0',
        id: requestId,
        method: 'initialize',
        params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'owa-enhance-chatbot-audit', version: '1.0.0' },
        },
    });
    await post(mcpUrl, { jsonrpc: '2.0', method: 'notifications/initialized' });
    requestId += 1;
    const result = await post(mcpUrl, {
        jsonrpc: '2.0',
        id: requestId,
        method: 'tools/list',
    });
    return result?.tools ?? [];
}

// `notify.mjs` decides which tools put "something else is driving your app" in
// the window. A tool that ACTS and is missing from its table acts silently,
// which is the one thing that table exists to prevent.
// `modelTools.mjs` decides which of them the CHATBOT's model is offered. The
// host's bill and the model's bill are different numbers, and the one that
// matters for a question is the smaller one -- reporting only the total is how
// a tool added "for the developer" quietly ends up billed to every volunteer.
// `pathToFileURL`, not the bare path: dynamic import of `C:\...` throws
// ERR_UNSUPPORTED_ESM_URL_SCHEME, and the catch below swallowed it -- which is
// why the notify check silently did nothing on Windows.
async function loadPackageModule(file) {
    try {
        return await import(
            pathToFileURL(
                path.join(REPO_ROOT, 'tools', 'owa-devtools-mcp', file),
            ).href
        );
    } catch (error) {
        console.error(`  ! could not load ${file}: ${error.message}`);
        return null;
    }
}


const ACTING_NAME_PATTERN =
    /^(owa_)?(click|type|fill|drag|hover|press|upload|navigate|new_page|close|resize|emulate|evaluate|handle_dialog|goto|hide|guide_start|guide_step|find_ui|present)/;

function measure(tool) {
    const description = tool.description ?? '';
    const schema = JSON.stringify(tool.inputSchema ?? {});
    // What one tool costs on the wire, in the shape both providers send.
    const wire = JSON.stringify({
        name: tool.name,
        description,
        input_schema: tool.inputSchema ?? {},
    });
    return {
        name: tool.name,
        isOwa: tool.name.startsWith('owa_'),
        isModelHidden: false,
        descriptionChars: description.length,
        schemaChars: schema.length,
        tokens: Math.ceil(wire.length / CHARS_PER_TOKEN),
    };
}

function pad(text, width) {
    return String(text).padEnd(width);
}

function padStart(text, width) {
    return String(text).padStart(width);
}

async function main() {
    const isStdio = argv.includes('--stdio');
    const mcpUrl = isStdio
        ? 'a fresh stdio server (the code on disk)'
        : resolveMcpUrl();
    const tools = isStdio ? await listToolsOverStdio() : await listTools(mcpUrl);
    const describeToolCall = (await loadPackageModule('notify.mjs'))
        ?.describeToolCall;
    const checkIsModelHiddenTool = (await loadPackageModule('modelTools.mjs'))
        ?.checkIsModelHiddenTool;
    const rows = tools
        .map((tool) => {
            return {
                ...measure(tool),
                isModelHidden: Boolean(checkIsModelHiddenTool?.(tool.name)),
            };
        })
        .sort((one, other) => {
            return other.tokens - one.tokens;
        });
    const owaRows = rows.filter((row) => row.isOwa);
    const devtoolsRows = rows.filter((row) => !row.isOwa);
    const sum = (list) => {
        return list.reduce((total, row) => total + row.tokens, 0);
    };
    const totalTokens = sum(rows);
    const modelRows = rows.filter((row) => {
        return !row.isModelHidden;
    });
    const modelTokens = sum(modelRows);

    const warnings = [];
    for (const tool of tools) {
        if (!tool.description) {
            warnings.push(`${tool.name}: no description at all`);
        }
        if (!describeToolCall) {
            continue;
        }
        // `{ highlight: true }`, not `{}`: `owa_find_ui` announces itself
        // only when it is asked to draw, so empty args report the one tool
        // with a conditional banner as having none.
        const isAnnounced = Boolean(
            describeToolCall(tool.name, { highlight: true }),
        );
        if (ACTING_NAME_PATTERN.test(tool.name) && !isAnnounced) {
            warnings.push(
                `${tool.name}: acts on the window but is NOT in notify.mjs ` +
                    'ACTING_TOOLS -- it would touch the app silently',
            );
        }
    }

    const report = {
        mcpUrl,
        toolCount: rows.length,
        owaToolCount: owaRows.length,
        devtoolsToolCount: devtoolsRows.length,
        tokensPerRound: totalTokens,
        owaTokens: sum(owaRows),
        devtoolsTokens: sum(devtoolsRows),
        tokensPerQuestion: totalTokens * rounds,
        modelToolCount: modelRows.length,
        modelTokensPerRound: modelTokens,
        modelTokensPerQuestion: modelTokens * rounds,
        rounds,
        warnings,
        tools: rows,
    };
    // Read before the table is printed so `--json --ratchet` still exits 1.
    const overBy =
        ratchetCeiling === null
            ? 0
            : report.modelTokensPerRound - ratchetCeiling;
    if (isJson) {
        console.log(
            JSON.stringify({ ...report, ratchetCeiling, overBy }, null, 2),
        );
        if (overBy > 0) {
            process.exitCode = 1;
        }
        return;
    }

    console.log(`MCP host        ${mcpUrl}`);
    console.log(
        `Tools           ${report.toolCount} ` +
            `(${report.owaToolCount} owa_*, ` +
            `${report.devtoolsToolCount} chrome-devtools)`,
    );
    console.log(
        `Tokens/round    ~${report.tokensPerRound} ` +
            `(owa_* ~${report.owaTokens}, devtools ~${report.devtoolsTokens})`,
    );
    console.log(
        `To the model    ${report.modelToolCount} tools, ` +
            `~${report.modelTokensPerRound} tokens/round ` +
            `(${report.toolCount - report.modelToolCount} withheld by ` +
            'modelTools.mjs)',
    );
    console.log(
        `Worst case      ~${report.modelTokensPerQuestion} tokens of tool ` +
            `schema across ${rounds} rounds of ONE question ` +
            `(~${report.tokensPerQuestion} if nothing were withheld)`,
    );
    console.log('');
    console.log(
        pad('tool', 34) +
            padStart('tokens', 8) +
            padStart('desc', 8) +
            padStart('schema', 8),
    );
    console.log('-'.repeat(58));
    for (const row of rows) {
        console.log(
            pad(row.isModelHidden ? `(${row.name})` : row.name, 34) +
                padStart(row.tokens, 8) +
                padStart(row.descriptionChars, 8) +
                padStart(row.schemaChars, 8),
        );
    }
    console.log('');
    console.log('(name) = served to the developer, withheld from the model.');
    if (warnings.length > 0) {
        console.log('');
        console.log('Warnings:');
        for (const warning of warnings) {
            console.log(`  ! ${warning}`);
        }
    }
    if (ratchetCeiling === null) {
        return;
    }
    console.log('');
    if (overBy > 0) {
        // Named tools, not just a number: the person reading this is deciding
        // what to withhold, and the biggest row is usually the answer.
        const biggest = rows
            .filter((row) => {
                return !row.isModelHidden;
            })
            .slice(0, 3)
            .map((row) => {
                return `${row.name} (~${row.tokens})`;
            })
            .join(', ');
        console.log(
            `RATCHET FAILED  the model's bill is ~${report.modelTokensPerRound} ` +
                `tokens/round, ~${overBy} over the ${ratchetCeiling} ceiling ` +
                `-- ~${overBy * rounds} tokens a question.`,
        );
        console.log(
            `                Cut a description, withhold a tool in ` +
                `modelTools.mjs, or raise MODEL_TOKEN_CEILING in this script ` +
                `and say why. Biggest: ${biggest}.`,
        );
        process.exitCode = 1;
        return;
    }
    console.log(
        `Ratchet         ok -- ~${report.modelTokensPerRound} of ` +
            `${ratchetCeiling} tokens/round (${-overBy} to spare)`,
    );
}

main().catch((error) => {
    console.error(String(error?.message ?? error));
    process.exit(1);
});
