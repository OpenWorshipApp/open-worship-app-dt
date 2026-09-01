// Audits the MCP tool surface of the RUNNING app -- the thing the chatbot pays
// for on every single round of every single question.
//
//   node .claude/skills/owa-enhance-chatbot/scripts/audit-mcp-tools.mjs
//   node .../audit-mcp-tools.mjs --json          # machine-readable
//   node .../audit-mcp-tools.mjs --rounds=10     # what a full tool loop costs
//
// It asks the app's own MCP host for `tools/list` exactly the way
// `src/chatbot/mcpClient.ts` does, then reports what each tool costs in the
// prompt and whether it announces itself in the window when it acts.
//
// Read-only: it lists tools, it never calls one. Exits 1 only when it cannot
// reach a running app, so it is safe to run at any point in a session.

import { readdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
async function loadDescribeToolCall() {
    try {
        const module = await import(
            path.join(REPO_ROOT, 'tools', 'owa-devtools-mcp', 'notify.mjs')
        );
        return module.describeToolCall;
    } catch {
        return null;
    }
}

const ACTING_NAME_PATTERN =
    /^(owa_)?(click|type|fill|drag|hover|press|upload|navigate|new_page|close|resize|emulate|evaluate|handle_dialog|goto|hide|guide_start|guide_step|find_ui)/;

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
    const mcpUrl = resolveMcpUrl();
    const tools = await listTools(mcpUrl);
    const describeToolCall = await loadDescribeToolCall();
    const rows = tools.map(measure).sort((one, other) => {
        return other.tokens - one.tokens;
    });
    const owaRows = rows.filter((row) => row.isOwa);
    const devtoolsRows = rows.filter((row) => !row.isOwa);
    const sum = (list) => {
        return list.reduce((total, row) => total + row.tokens, 0);
    };
    const totalTokens = sum(rows);

    const warnings = [];
    for (const tool of tools) {
        if (!tool.description) {
            warnings.push(`${tool.name}: no description at all`);
        }
        if (describeToolCall === null) {
            continue;
        }
        const isAnnounced = Boolean(describeToolCall(tool.name, {}));
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
        rounds,
        warnings,
        tools: rows,
    };
    if (isJson) {
        console.log(JSON.stringify(report, null, 2));
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
        `Worst case      ~${report.tokensPerQuestion} tokens of tool schema ` +
            `across ${rounds} rounds of ONE question`,
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
            pad(row.name, 34) +
                padStart(row.tokens, 8) +
                padStart(row.descriptionChars, 8) +
                padStart(row.schemaChars, 8),
        );
    }
    if (warnings.length > 0) {
        console.log('');
        console.log('Warnings:');
        for (const warning of warnings) {
            console.log(`  ! ${warning}`);
        }
    }
}

main().catch((error) => {
    console.error(String(error?.message ?? error));
    process.exit(1);
});
