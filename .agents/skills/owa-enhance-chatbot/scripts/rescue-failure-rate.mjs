// Measures how often the stuck-step rescue FAILS, against the running app.
//
//   node .claude/skills/owa-enhance-chatbot/scripts/rescue-failure-rate.mjs
//   node .../rescue-failure-rate.mjs --runs=10 --manual=W-06 --step=3
//   node .../rescue-failure-rate.mjs --json
//
// A walkthrough step the card cannot press asks the assistant (backlog EC-38).
// That answer is written by a model, in a window, about a live app -- three
// sources of variance -- and eyeballing five of them is how a run talks itself
// into "it works now". This drives the same step N times and grades each answer
// against failures that were actually observed, so the number can be compared
// with the last run's instead of with a memory.
//
// The grader is deterministic on purpose. An LLM judge would cost money, vary
// with the very model being measured, and could not be re-run against an old
// transcript. Every rule below exists because a real answer tripped it.
//
// It spends the user's API credit: one model round per run.

import { readdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DISCOVERY_DIR = path.join(os.tmpdir(), 'open-worship-app-cdp');
const argv = process.argv.slice(2);
const isJson = argv.includes('--json');
const argOf = (name, fallback) => {
    const found = argv.find((one) => one.startsWith('--' + name + '='));
    return found === undefined ? fallback : found.split('=')[1];
};
const runs = Number(argOf('runs', 10));
const manualId = argOf('manual', 'W-06');
const stepNumber = Number(argOf('step', 3));

// The published instance file carries `mcpUrl`; the default port is a default,
// never a promise. OWA_MCP_URL wins, for a bridged or a second instance.
function resolveMcpEndpoint() {
    if (process.env.OWA_MCP_URL) {
        if (!process.env.OWA_MCP_TOKEN) {
            throw new Error('OWA_MCP_URL also requires OWA_MCP_TOKEN.');
        }
        return {
            mcpUrl: process.env.OWA_MCP_URL,
            mcpToken: process.env.OWA_MCP_TOKEN,
        };
    }
    const instances = readdirSync(DISCOVERY_DIR)
        .filter((name) => name.endsWith('.json'))
        .map((name) => {
            try {
                return JSON.parse(
                    readFileSync(path.join(DISCOVERY_DIR, name), 'utf8'),
                );
            } catch {
                return null;
            }
        })
        .filter((one) => one !== null && one.mcpUrl && one.mcpToken)
        .sort((one, other) => {
            return String(other.startedAt).localeCompare(String(one.startedAt));
        });
    if (instances.length === 0) {
        throw new Error(
            'No app is publishing an endpoint. Start it with ' +
                'env -u ELECTRON_RUN_AS_NODE npm run dev.',
        );
    }
    return instances[0];
}

const { mcpUrl: MCP_URL, mcpToken: MCP_TOKEN } = resolveMcpEndpoint();
if (!MCP_TOKEN) {
    throw new Error('The selected MCP endpoint has no published token.');
}
let sessionId = null;
let requestId = 0;

async function post(body) {
    const headers = {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: `Bearer ${MCP_TOKEN}`,
    };
    if (sessionId !== null) {
        headers['mcp-session-id'] = sessionId;
    }
    const response = await fetch(MCP_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120000),
    });
    const newSessionId = response.headers.get('mcp-session-id');
    if (newSessionId) {
        sessionId = newSessionId;
    }
    if (!response.ok) {
        throw new Error('The assistant service answered ' + response.status);
    }
    if (response.status === 202) {
        return null;
    }
    const data = await response.json();
    if (data && data.error) {
        throw new Error(data.error.message ?? 'The call failed');
    }
    return (data && data.result) ?? null;
}

async function call(name, args = {}) {
    requestId += 1;
    const result = await post({
        jsonrpc: '2.0',
        id: requestId,
        method: 'tools/call',
        params: { name, arguments: args },
    });
    const text = ((result && result.content) ?? [])
        .map((one) => one.text ?? '')
        .join('');
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

// Every rule here is a failure observed live on 2026-09-01, in the order they
// were found. Keep them; a rule removed because "the model does not do that any
// more" is how a regression gets back in.
const GRADERS = [
    {
        key: 'no-answer',
        // Nobody answered in time and the card fell back to its own apology.
        test: (answer) => answer.length === 0,
    },
    {
        key: 'narration',
        // "I can see the verse ... is displayed in the preview area on the
        // right." True, and not an instruction. 3 in 4 before the DO: frame
        // was enforced in code rather than asked for in the prompt.
        test: (answer) =>
            /^\s*(i\s+(can\s+)?(see|don'?t\s+see|found|looked)|the\s+screenshot|it\s+looks\s+like|looking\s+at|based\s+on)/i.test(
                answer,
            ),
    },
    {
        key: 'wrong-subject',
        // "No presentation screen is showing right now. This machine has 1
        // display available to present on." The matcher's raw reason, "nothing
        // on screen to act on", read as a projector symptom -- which the system
        // prompt teaches the model to go and diagnose.
        test: (answer) =>
            /presentation screen|display\(\)|available to present on/i.test(
                answer,
            ),
    },
    {
        key: 'tool-label-leak',
        // "Click Bible Lookup Open bible lookup popup [Ctrl+B]" -- owa_list_ui
        // joins up every way an element is named, and the model pasted the
        // join. Same class as the guide's own "Download From URL Download From
        // URL" (EC-24).
        test: (answer) =>
            /\[(ctrl|alt|shift|f\d)/i.test(answer) ||
            // The other half of a join, with no bracket to give it
            // away: "Click Previewer Enable Previewer (above Slide)".
            // A capitalised word repeated within twenty characters is
            // a label said twice, never a sentence.
            /\b([A-Z]\w{3,})\b.{0,20}\b\1\b/.test(answer),
    },
    {
        key: 'internals-leak',
        // A recipe id, a path, a tool name, a component name.
        test: (answer) =>
            /\b[A-Z]{1,3}-\d{1,3}\b|owa_[a-z_]+|src\//.test(answer) ||
            /[A-Za-z]Comp\b/.test(answer),
    },
    {
        key: 'not-an-instruction',
        // Nothing a volunteer can carry out.
        test: (answer) =>
            !/\b(click|double-click|press|open|choose|pick|type|drag|select|watch|wait|switch|close)\b/i.test(
                answer,
            ),
    },
    {
        key: 'too-long-for-the-card',
        test: (answer) => answer.length > 240,
    },
    {
        key: 'mangled-text',
        // Seen twice in one 12-run batch: "press Enter" arriving as
        // "pre  Enter", both times on the word "press". Not reproducible in
        // the next 6 runs, and provably not any transform in the pipeline --
        // toGuideRescueAnswer leaves "press" alone, and the card collapses
        // runs of whitespace, so a double space that reaches here at all is
        // anomalous by construction. Kept as a tripwire rather than chased:
        // if it recurs, this is what says so instead of a person re-reading
        // the answers (backlog EC-41).
        test: (answer) => /\S\s{2,}\S/.test(answer),
    },
];

function grade(answer) {
    const text = String(answer ?? '').trim();
    return GRADERS.filter((one) => one.test(text)).map((one) => one.key);
}

async function once() {
    await call('owa_guide_start', { manualId, mode: 'demo' });
    await call('owa_guide_step', { action: 'goto', stepNumber });
    const startedAt = Date.now();
    await call('owa_guide_step', { action: 'do' });
    let status = null;
    // The card gives up on its own after 30s; allow a little past that, so a
    // late answer is measured for what it says rather than as a timeout.
    while (Date.now() - startedAt < 45000) {
        await new Promise((resolve) => {
            setTimeout(resolve, 1500);
        });
        status = await call('owa_guide_status');
        const help = status === null ? null : status.help;
        if (help === null || help === undefined || help.status !== 'asking') {
            break;
        }
    }
    await call('owa_guide_step', { action: 'stop' });
    const help = (status === null ? null : status.help) ?? {};
    const text = help.text ?? '';
    return {
        seconds: Math.round((Date.now() - startedAt) / 1000),
        status: help.status ?? 'none',
        text,
        failures: grade(text),
    };
}

requestId += 1;
await post({
    jsonrpc: '2.0',
    id: requestId,
    method: 'initialize',
    params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'owa-rescue-failure-rate', version: '1.0.0' },
    },
});
await post({ jsonrpc: '2.0', method: 'notifications/initialized' });

const results = [];
for (let at = 0; at < runs; at += 1) {
    // Sequential, never parallel: they all drive the ONE card in the one
    // window, and two at a time would grade each other's answers.
    const result = await once();
    results.push(result);
    if (!isJson) {
        const verdict =
            result.failures.length === 0
                ? 'ok  '
                : 'FAIL[' + result.failures.join(',') + ']';
        console.log(
            String(at + 1).padStart(2) +
                ' ' +
                verdict +
                ' ' +
                String(result.seconds).padStart(3) +
                's  ' +
                result.text.slice(0, 110),
        );
    }
}

const failed = results.filter((one) => one.failures.length > 0);
const seconds = results
    .map((one) => one.seconds)
    .sort((one, other) => {
        return one - other;
    });
const byReason = {};
for (const result of failed) {
    for (const key of result.failures) {
        byReason[key] = (byReason[key] ?? 0) + 1;
    }
}
const summary = {
    manualId,
    stepNumber,
    runs: results.length,
    failed: failed.length,
    failureRate: Number((failed.length / results.length).toFixed(3)),
    medianSeconds: seconds[Math.floor(seconds.length / 2)] ?? null,
    byReason,
};
if (isJson) {
    console.log(JSON.stringify({ summary, results }, null, 2));
} else {
    console.log('');
    console.log(
        'failure rate  ' +
            failed.length +
            '/' +
            results.length +
            ' (' +
            Math.round(summary.failureRate * 100) +
            '%)  median ' +
            summary.medianSeconds +
            's',
    );
    for (const [key, count] of Object.entries(byReason)) {
        console.log('  ' + key.padEnd(22) + ' ' + count);
    }
}
process.exit(failed.length > 0 ? 1 : 0);
