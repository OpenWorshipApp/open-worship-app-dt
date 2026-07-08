#!/usr/bin/env node
// Polls the Electron remote-debugging (CDP) endpoint until a renderer page
// target is available -- i.e. the "debugger is attached" and the app window has
// navigated. Used by the owa-robot-test skill before driving the UI through
// chrome-devtools-mcp.
//
// Usage:
//   node wait-for-debugger.mjs [--port=9223] [--match=presenter.html]
//                              [--timeout=120000] [--interval=1000]
//
// - --port      CDP port Electron was launched with (package.json => 9223).
// - --match     substring the target page URL must contain (default ".html";
//               use "presenter.html" to wait specifically for the main window).
// - --timeout   overall wait budget in ms (default 120000).
// - --interval  poll interval in ms (default 1000).
//
// Exit 0 and print the matched target as JSON when ready.
// Exit 1 on timeout (prints the last-seen targets to help debugging).
//
// Zero dependencies: uses Node 22+ global fetch + AbortSignal.timeout.

const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
        const match = arg.match(/^--([^=]+)=(.*)$/);
        return match ? [match[1], match[2]] : [arg.replace(/^--/, ''), true];
    }),
);

const port = Number(args.port ?? 9223);
const match = typeof args.match === 'string' ? args.match : '.html';
const timeout = Number(args.timeout ?? 120000);
const interval = Number(args.interval ?? 1000);
// Electron binds remote debugging to 127.0.0.1; keep "localhost" as a fallback.
const hosts = ['127.0.0.1', 'localhost'];

const deadline = Date.now() + timeout;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchTargets() {
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
while (Date.now() < deadline) {
    const result = await fetchTargets();
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
    await sleep(interval);
}

process.stderr.write(
    `Timed out after ${timeout}ms waiting for a "${match}" page on port ${port}.\n`,
);
if (lastSeen) {
    process.stderr.write(
        'Last seen targets:\n' + JSON.stringify(lastSeen, null, 2) + '\n',
    );
} else {
    process.stderr.write(
        'The CDP endpoint never responded. Is "npm run dev" running and did ' +
            'Electron launch with --remote-debugging-port?\n',
    );
}
process.exit(1);
