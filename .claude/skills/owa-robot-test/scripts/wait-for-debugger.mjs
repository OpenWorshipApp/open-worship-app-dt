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
//                              [--prod | --dev] [--pid=<pid>]
//
// - --port      force a port instead of discovering the running instance.
// - --prod      only a PACKAGED instance (`isDev: false` in its published
//               file) counts -- the owa-robot-test prod mode, where a dev app
//               restarted beside it must not be mistaken for the build under
//               test. `--dev` is the mirror image. Without either, the newest
//               live instance wins, whichever kind it is. `--prod` prefers
//               the pid `prod-app.mjs launch` recorded, when that file exists.
// - --pid       wait for exactly that instance (its published file's `pid`).
// - --match     substring the target page URL must contain (default ".html";
//               use "presenter.html" to wait specifically for the main window).
// - --timeout   overall wait budget in ms (default 120000).
// - --interval  poll interval in ms (default 1000).
//
// Exit 0 and print the matched target as JSON when ready.
// Exit 1 on timeout (prints the last-seen targets to help debugging).
//
// Zero dependencies: uses Node 22+ global fetch + AbortSignal.timeout.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    CDP_INFO_DIR_PATH,
    readLiveInstances,
    resolveCdpPort,
} from '../../../../tools/owa-devtools-mcp/discovery.mjs';

// Written by `prod-app.mjs launch`; read when `--prod` is asked for.
const PROD_RECORD_FILE_PATH = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../../test-results/robot-test/prod-app.json',
);

const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
        const match = arg.match(/^--([^=]+)=(.*)$/);
        return match ? [match[1], match[2]] : [arg.replace(/^--/, ''), true];
    }),
);

const forcedPort = args.port ? Number(args.port) : undefined;
// `true` = packaged only, `false` = dev only, `null` = whichever is newest.
const wantedIsDev =
    args.prod === true ? false : args.dev === true ? true : null;
const match = typeof args.match === 'string' ? args.match : '.html';
const timeout = Number(args.timeout ?? 120000);
const interval = Number(args.interval ?? 1000);
// Electron binds remote debugging to 127.0.0.1; keep "localhost" as a fallback.
const hosts = ['127.0.0.1', 'localhost'];

const deadline = Date.now() + timeout;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The port to probe this round. With a kind asked for, the published files
 * are read directly and filtered on `isDev`; otherwise `resolveCdpPort`
 * (newest live instance, then the legacy fallback port) decides.
 */
async function pickPort() {
    if (forcedPort !== undefined) {
        return resolveCdpPort({ port: forcedPort });
    }
    const instances = readLiveInstances();
    // A pid names ONE instance: `--pid=`, or the one `prod-app.mjs launch`
    // recorded when `--prod` is asked for -- with the installed app and the
    // release-dir app both up, "any packaged instance" is the wrong one half
    // the time (observed 2026-09-09: the wait attached to the older one while
    // the launched one was still starting).
    const wantedPid = readWantedPid();
    if (wantedPid !== null) {
        const instance = instances.find((candidate) => {
            return candidate.pid === wantedPid;
        });
        return instance ? instance.port : null;
    }
    if (wantedIsDev === null) {
        return resolveCdpPort();
    }
    const instance = instances.find((candidate) => {
        return (candidate.isDev === true) === wantedIsDev;
    });
    return instance ? instance.port : null;
}

function readWantedPid() {
    const explicitPid = Number(args.pid);
    if (Number.isInteger(explicitPid) && explicitPid > 0) {
        return explicitPid;
    }
    if (wantedIsDev !== false) {
        return null;
    }
    try {
        const record = JSON.parse(readFileSync(PROD_RECORD_FILE_PATH, 'utf-8'));
        return Number.isInteger(record?.pid) ? record.pid : null;
    } catch {
        return null;
    }
}

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
            // An open DevTools panel is a page target too, and its URL ends
            // in `devtools_app.html` -- it must never satisfy `.html`.
            !target.url.startsWith('devtools://') &&
            target.url.includes(match),
    );
}

let lastSeen = null;
let lastPort = null;
while (Date.now() < deadline) {
    // Re-resolved every round: an app restarted mid-wait comes back on a
    // different port, and the published file is what says so.
    const port = await pickPort();
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
        (wantedIsDev === null
            ? ''
            : wantedIsDev
              ? ' of a DEV instance'
              : ' of a PACKAGED instance') +
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
            'all -- and a PACKAGED build with the setting UNSET is off; ' +
            'see `prod-app.mjs ai-status`), or ELECTRON_RUN_AS_NODE=1 ' +
            'inherited from VS Code makes Electron run as plain Node -- ' +
            'launch with `env -u ELECTRON_RUN_AS_NODE npm run dev`, and ' +
            'start the packaged app through `prod-app.mjs launch`, which ' +
            'strips it.\n',
    );
}
process.exit(1);
