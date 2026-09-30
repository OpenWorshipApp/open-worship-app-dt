// What the RUNNING app costs the machine it is on -- the baseline every
// performance claim in an /owa-enhance report is judged against.
//
//   node .claude/skills/owa-enhance/scripts/app-vitals.mjs
//   node .../app-vitals.mjs --gc           collect garbage in each page first
//   node .../app-vitals.mjs --port=53550   one particular instance
//   node .../app-vitals.mjs --json
//
// Two views of one moment. PROCESSES: every process Chromium reports for the
// app -- the main process, the GPU process, each renderer, the utilities --
// with the operating system's own memory figure for it, which is what decides
// whether an old laptop starts to swap. PAGES: each app window's JS heap, and
// its renderer's DOM nodes, documents and event listeners, where a leak shows
// first. A page is tied to its process by `process.pid` read in the page; the
// chatbot and AI Chat windows have no `process` (they are locked down), so
// theirs stays unknown.
//
// Read-only, over raw CDP rather than the MCP: no banner, no firewall, no
// connection kept. The one command with an effect is `--gc`, a garbage
// collection pause in each page, so it is opt-in -- and a before/after pair
// must both use it or both not. Numbers compare only like for like: the same
// windows open, doing the same thing. The page expression stays
// dependency-free: an `import()` from here would re-run app module code and
// kill the window's keyboard shortcuts.
//
// Exit code: 0 measured, 1 no running app.

import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// scripts -> owa-enhance -> skills -> .claude|.github -> repo root
const REPO_ROOT = path.join(HERE, '..', '..', '..', '..');
const MCP_DIR_PATH = path.join(REPO_ROOT, 'tools', 'owa-devtools-mcp');

const { getVersion, listTargets, requireLivePort } = await import(
    pathToFileURL(path.join(MCP_DIR_PATH, 'cdp.mjs')).href
);
const { readLiveInstances } = await import(
    pathToFileURL(path.join(MCP_DIR_PATH, 'discovery.mjs')).href
);

const argList = process.argv.slice(2);
const isJson = argList.includes('--json');
const isGcFirst = argList.includes('--gc');
const portArg =
    Number(
        argList
            .find((arg) => arg.startsWith('--port='))
            ?.slice('--port='.length),
    ) || undefined;

const BYTES_PER_MB = 1024 * 1024;
const PID_EXPRESSION =
    "typeof process !== 'undefined' && Number.isInteger(process.pid) ? process.pid : null";
// Main first, then what draws, then the helpers.
const PROCESS_KIND_ORDER = ['main', 'gpu', 'renderer'];

function toMb(byteCount) {
    return Number.isFinite(byteCount)
        ? Math.round((byteCount / BYTES_PER_MB) * 10) / 10
        : null;
}

function toLocalStamp(date) {
    const pad = (number) => String(number).padStart(2, '0');
    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-` +
        `${pad(date.getDate())} ${pad(date.getHours())}:` +
        `${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    );
}

/** One socket per target: the commands in order, answered, then closed. */
function sendInOrder(webSocketUrl, commands, timeout = 15000) {
    return new Promise((resolve, reject) => {
        const results = [];
        let isDone = false;
        let timeoutId = null;
        const socket = new WebSocket(webSocketUrl);
        const finish = (error) => {
            if (isDone) {
                return;
            }
            isDone = true;
            clearTimeout(timeoutId);
            try {
                socket.close();
            } catch {
                // Already closing.
            }
            if (error) {
                reject(error);
            } else {
                resolve(results);
            }
        };
        timeoutId = setTimeout(() => {
            finish(new Error(`Timed out talking to ${webSocketUrl}`));
        }, timeout);
        const sendNext = () => {
            if (results.length === commands.length) {
                finish(null);
                return;
            }
            const [method, params = {}] = commands[results.length];
            socket.send(
                JSON.stringify({ id: results.length + 1, method, params }),
            );
        };
        socket.addEventListener('open', sendNext);
        socket.addEventListener('error', () => {
            finish(new Error(`Could not attach to ${webSocketUrl}`));
        });
        socket.addEventListener('message', (event) => {
            let message;
            try {
                message = JSON.parse(event.data);
            } catch {
                return;
            }
            if (message.id !== results.length + 1) {
                return;
            }
            results.push(
                message.error
                    ? { error: message.error.message }
                    : message.result,
            );
            sendNext();
        });
    });
}

function toPageName(url) {
    try {
        const parsedUrl = new URL(url);
        return path.posix.basename(parsedUrl.pathname) + parsedUrl.search;
    } catch {
        return url;
    }
}

async function measurePage(target) {
    const commands = [
        ['Runtime.getHeapUsage'],
        // The renderer's counters: pages sharing a renderer share them.
        ['Memory.getDOMCounters'],
        [
            'Runtime.evaluate',
            { expression: PID_EXPRESSION, returnByValue: true },
        ],
    ];
    if (isGcFirst) {
        commands.unshift(['HeapProfiler.collectGarbage']);
    }
    const results = await sendInOrder(target.webSocketDebuggerUrl, commands);
    const [heap, dom, pidAnswer] = results.slice(isGcFirst ? 1 : 0);
    return {
        page: toPageName(target.url),
        url: target.url,
        pid: pidAnswer?.result?.value ?? null,
        jsHeapUsedMB: toMb(heap?.usedSize),
        jsHeapTotalMB: toMb(heap?.totalSize),
        domNodes: dom?.nodes ?? null,
        documents: dom?.documents ?? null,
        listeners: dom?.jsEventListeners ?? null,
    };
}

function toProcessKind(chromiumType) {
    if (chromiumType === 'browser') {
        return 'main';
    }
    if (String(chromiumType).toLowerCase().startsWith('gpu')) {
        return 'gpu';
    }
    if (chromiumType === 'renderer') {
        return 'renderer';
    }
    // `network.mojom.NetworkService` -> `utility: network`
    return `utility: ${String(chromiumType).split('.')[0]}`;
}

function runFile(filePath, fileArgs) {
    return new Promise((resolve) => {
        execFile(
            filePath,
            fileArgs,
            { timeout: 20000, windowsHide: true, maxBuffer: 8 * BYTES_PER_MB },
            (error, stdout) => {
                resolve(error ? null : stdout);
            },
        );
    });
}

/**
 * pid -> the operating system's figures. Windows gives PRIVATE bytes (what
 * the process alone has committed) and the working set (what sits in RAM,
 * shared pages counted again in every process mapping them); elsewhere `ps`
 * gives the resident set, shared pages included. Private is the one that adds
 * up across processes.
 */
async function readOsMemoryMap(pids) {
    const memoryMap = new Map();
    if (pids.length === 0) {
        return memoryMap;
    }
    if (process.platform === 'win32') {
        const stdout = await runFile('powershell.exe', [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `Get-Process -Id ${pids.join(',')} -ErrorAction SilentlyContinue | ` +
                'Select-Object Id,PrivateMemorySize64,WorkingSet64 | ' +
                'ConvertTo-Json -Compress',
        ]);
        try {
            const parsed = JSON.parse(stdout ?? '');
            for (const row of Array.isArray(parsed) ? parsed : [parsed]) {
                memoryMap.set(row.Id, {
                    privateMB: toMb(row.PrivateMemorySize64),
                    workingSetMB: toMb(row.WorkingSet64),
                });
            }
        } catch {
            // No figures: the output says so rather than guessing.
        }
        return memoryMap;
    }
    const stdout = await runFile('ps', [
        '-o',
        'pid=,rss=',
        '-p',
        pids.join(','),
    ]);
    for (const line of (stdout ?? '').split('\n')) {
        const [pid, residentKb] = line.trim().split(/\s+/).map(Number);
        if (Number.isInteger(pid) && Number.isFinite(residentKb)) {
            memoryMap.set(pid, { residentMB: toMb(residentKb * 1024) });
        }
    }
    return memoryMap;
}

async function readProcessInfo(version) {
    if (!version?.webSocketDebuggerUrl) {
        return [];
    }
    try {
        const [answer] = await sendInOrder(version.webSocketDebuggerUrl, [
            ['SystemInfo.getProcessInfo'],
        ]);
        return answer?.processInfo ?? [];
    } catch {
        return [];
    }
}

function sumOf(processes, key) {
    const values = processes
        .map((one) => one[key])
        .filter((value) => Number.isFinite(value));
    if (values.length === 0) {
        return null;
    }
    return Math.round(values.reduce((total, value) => total + value, 0) * 10) / 10;
}

async function measureApp(port) {
    const instance =
        readLiveInstances().find((one) => one.port === port) ?? null;
    const [rawTargets, appTargets, version] = await Promise.all([
        fetch(`http://127.0.0.1:${port}/json/list`, {
            signal: AbortSignal.timeout(5000),
        }).then((res) => res.json()),
        listTargets(port),
        getVersion(port),
    ]);
    const pages = [];
    for (const target of appTargets) {
        try {
            pages.push(await measurePage(target));
        } catch (error) {
            pages.push({
                page: toPageName(target.url),
                url: target.url,
                error: error.message,
            });
        }
    }
    const processInfo = await readProcessInfo(version);
    const memoryMap = await readOsMemoryMap(
        processInfo.map((one) => one.id).filter(Number.isInteger),
    );
    const processes = processInfo
        .map((one) => {
            return {
                kind: toProcessKind(one.type),
                pid: one.id,
                cpuSeconds: Math.round((one.cpuTime ?? 0) * 10) / 10,
                ...memoryMap.get(one.id),
                pages: pages
                    .filter((page) => page.pid === one.id)
                    .map((page) => page.page),
            };
        })
        .sort((one, other) => {
            const rankOf = (kind) => {
                const index = PROCESS_KIND_ORDER.indexOf(kind);
                return index === -1 ? PROCESS_KIND_ORDER.length : index;
            };
            return (
                rankOf(one.kind) - rankOf(other.kind) ||
                (other.privateMB ?? other.residentMB ?? 0) -
                    (one.privateMB ?? one.residentMB ?? 0)
            );
        });
    const otherTargets = { devtools: 0, webview: 0, worker: 0, other: 0 };
    for (const target of rawTargets) {
        if (target.type === 'page') {
            if (String(target.url).startsWith('devtools://')) {
                otherTargets.devtools += 1;
            }
        } else if (target.type === 'webview') {
            otherTargets.webview += 1;
        } else if (String(target.type).includes('worker')) {
            otherTargets.worker += 1;
        } else {
            otherTargets.other += 1;
        }
    }
    return {
        measuredAt: new Date().toISOString(),
        port,
        instance:
            instance === null
                ? null
                : {
                      pid: instance.pid,
                      isDev: instance.isDev,
                      version: instance.version,
                      startedAt: instance.startedAt,
                  },
        electron:
            version?.['User-Agent']?.match(/Electron\/(\S+)/)?.[1] ?? null,
        chrome: version?.Browser ?? null,
        gcFirst: isGcFirst,
        processes,
        totals: {
            privateMB: sumOf(processes, 'privateMB'),
            workingSetMB: sumOf(processes, 'workingSetMB'),
            residentMB: sumOf(processes, 'residentMB'),
        },
        pages,
        otherTargets,
    };
}

function formatTable(rows, rightAlignedColumnSet) {
    const widths = rows[0].map((_, column) => {
        return Math.max(...rows.map((row) => String(row[column]).length));
    });
    return rows.map((row) => {
        return (
            '  ' +
            row
                .map((cell, column) => {
                    const text = String(cell);
                    return rightAlignedColumnSet.has(column)
                        ? text.padStart(widths[column])
                        : text.padEnd(widths[column]);
                })
                .join('   ')
                .trimEnd()
        );
    });
}

function toCell(value) {
    return value === null || value === undefined ? '-' : value;
}

function printText(report) {
    const isWindows = process.platform === 'win32';
    const who =
        report.instance === null
            ? 'an instance that did not publish itself'
            : `${report.instance.isDev ? 'dev' : 'packaged'} ` +
              `${report.instance.version ?? '?'} · pid ${report.instance.pid}`;
    const lines = [
        `Open Worship App -- ${who} · CDP ${report.port} · ` +
            `Electron ${report.electron ?? '?'} (${report.chrome ?? '?'})`,
        `Measured ${toLocalStamp(new Date(report.measuredAt))} · ` +
            `garbage collected first: ${report.gcFirst ? 'yes' : 'no'}`,
        '',
        'Processes (operating system figures)',
    ];
    const memoryHeads = isWindows
        ? ['private MB', 'working set MB']
        : ['resident MB'];
    const processRows = [
        ['kind', 'pid', ...memoryHeads, 'cpu s', 'pages'],
        ...report.processes.map((one) => {
            return [
                one.kind,
                one.pid,
                ...(isWindows
                    ? [toCell(one.privateMB), toCell(one.workingSetMB)]
                    : [toCell(one.residentMB)]),
                one.cpuSeconds,
                one.pages.join(', '),
            ];
        }),
        [
            'total',
            '',
            ...(isWindows
                ? [
                      toCell(report.totals.privateMB),
                      toCell(report.totals.workingSetMB),
                  ]
                : [toCell(report.totals.residentMB)]),
            '',
            '',
        ],
    ];
    const memoryColumns = isWindows ? [2, 3, 4] : [2, 3];
    lines.push(...formatTable(processRows, new Set([1, ...memoryColumns])));
    lines.push('', 'Pages (app windows)');
    const pageRows = [
        [
            'page',
            'JS heap used MB',
            'of MB',
            'DOM nodes',
            'documents',
            'listeners',
            'pid',
        ],
        ...report.pages.map((page) => {
            if (page.error) {
                return [page.page, `could not measure: ${page.error}`, '', '', '', '', ''];
            }
            return [
                page.page,
                toCell(page.jsHeapUsedMB),
                toCell(page.jsHeapTotalMB),
                toCell(page.domNodes),
                toCell(page.documents),
                toCell(page.listeners),
                toCell(page.pid),
            ];
        }),
    ];
    lines.push(...formatTable(pageRows, new Set([1, 2, 3, 4, 5, 6])));
    const notes = [];
    if (report.processes.length === 0) {
        notes.push('No process list: SystemInfo.getProcessInfo did not answer.');
    } else if (report.totals.privateMB === null && report.totals.residentMB === null) {
        notes.push('No operating-system figures: the process query failed.');
    }
    if (report.otherTargets.devtools > 0) {
        notes.push(
            `${report.otherTargets.devtools} DevTools window(s) open: a renderer ` +
                'with no page is likely DevTools, which is not the app.',
        );
    }
    if (report.otherTargets.webview > 0) {
        notes.push(
            `${report.otherTargets.webview} webview guest(s) (the AI Chat window) ` +
                'run in renderers of their own.',
        );
    }
    notes.push(
        'DOM nodes, documents and listeners are counted per renderer process.',
    );
    lines.push('', ...notes.map((note) => `Note: ${note}`));
    console.log(lines.join('\n'));
}

async function main() {
    let port;
    try {
        port = await requireLivePort(portArg);
    } catch (error) {
        if (isJson) {
            console.log(JSON.stringify({ error: error.message }));
        } else {
            console.error(error.message);
        }
        return 1;
    }
    const report = await measureApp(port);
    if (isJson) {
        console.log(JSON.stringify(report, null, 2));
    } else {
        printText(report);
    }
    return 0;
}

process.exitCode = await main();
