#!/usr/bin/env node
// Polls the Electron remote-debugging (CDP) endpoint until a renderer page
// target is available -- i.e. the "debugger is attached" and the app window has
// navigated. Used by the owa-robot-test skill before driving the UI.
//
// The app takes NO hardcoded port any more: Chromium binds a free one and the
// main process publishes it to `<temp>/open-worship-app-cdp/<pid>.json`
// (`publishAiEndpoints` in `electron/aiHelpers.ts`). This script discovers it
// through `tools/owa-devtools-mcp/discovery.mjs`; `--port` still forces one.
//
// Usage:
//   node wait-for-debugger.mjs [--port=<port>] [--match=presenter.html]
//                              [--timeout=120000] [--interval=1000]
//
// - --port      force a port instead of discovering the running instance.
// - --match     substring the target page URL must contain (default ".html";
//               use "presenter.html" to wait specifically for the main window).
// - --timeout   overall wait budget in ms (default 120000).
// - --interval  poll interval in ms (default 1000).
//
// Exit 0 and print the matched target as JSON when ready.
// Exit 1 on timeout (prints the last-seen targets to help debugging).
//
// Zero dependencies: uses Node 22+ global fetch + AbortSignal.timeout.

import {
    CDP_INFO_DIR_PATH,
    readLiveInstances,
    resolveCdpPort,
} from '../../../../tools/owa-devtools-mcp/discovery.mjs';

const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
        const match = arg.match(/^--([^=]+)=(.*)$/);
        return match ? [match[1], match[2]] : [arg.replace(/^--/, ''), true];
    }),
);

const forcedPort = args.port ? Number(args.port) : undefined;
const match = typeof args.match === 'string' ? args.match : '.html';
const timeout = Number(args.timeout ?? 120000);
const interval = Number(args.interval ?? 1000);
// Electron binds remote debugging to 127.0.0.1; keep "localhost" as a fallback.
const hosts = ['127.0.0.1', 'localhost'];

const deadline = Date.now() + timeout;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchTargets(port) {
    for (const host of hosts) {
        try {
            const res = await fetch(`http://${host}:${port}/json/list`, {
                signal: AbortSignal.timeout(2000),
            });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    return { host, data };
                }
            }
        } catch {
            // Endpoint not up yet or host unreachable; try the next host.
        }
    }
    return null;
}

function pickPage(targets) {
    return targets.find(
        (target) =>
            target.type === 'page' &&
            typeof target.url === 'string' &&
            target.url.includes(match),
    );
}

let lastSeen = null;
let lastPort = null;
while (Date.now() < deadline) {
    // Re-resolved every round: an app restarted mid-wait comes back on a
    // different port, and the published file is what says so.
    const port = await resolveCdpPort({ port: forcedPort });
    if (port !== null) {
        lastPort = port;
        const result = await fetchTargets(port);
        if (result) {
            lastSeen = result.data;
            const page = pickPage(result.data);
            if (page) {
                process.stdout.write(
                    JSON.stringify(
                        {
                            ready: true,
                            host: result.host,
                            port,
                            title: page.title,
                            url: page.url,
                            webSocketDebuggerUrl: page.webSocketDebuggerUrl,
                        },
                        null,
                        2,
                    ) + '\n',
                );
                process.exit(0);
            }
        }
    }
    await sleep(interval);
}

process.stderr.write(
    `Timed out after ${timeout}ms waiting for a "${match}" page` +
        (lastPort === null ? '' : ` on port ${lastPort}`) +
        '.\n',
);
if (lastSeen) {
    process.stderr.write(
        'Last seen targets:\n' + JSON.stringify(lastSeen, null, 2) + '\n',
    );
} else {
    process.stderr.write(
        'No running app published itself. Instances publish to ' +
            `${CDP_INFO_DIR_PATH}; right now: ` +
            `${JSON.stringify(readLiveInstances())}\n` +
            'Is "npm run dev" running? Two other causes: AI features are ' +
            'switched off in Settings > Others (no endpoint is opened at ' +
            'all), or ELECTRON_RUN_AS_NODE=1 inherited from VS Code makes ' +
            'Electron run as plain Node -- launch with ' +
            '`env -u ELECTRON_RUN_AS_NODE npm run dev`.\n',
    );
}
process.exit(1);
