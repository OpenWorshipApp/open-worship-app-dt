// llm-tunnel.mjs
// Puts a local LLM server (LM Studio, llama.cpp, Ollama, ...) on the public
// internet through a Cloudflare quick tunnel, the way Open Worship does it for
// Screen Mirror (electron/screenMirrorTunnel.ts): cloudflared dials OUT to
// Cloudflare and gets back an https://<words>.trycloudflare.com address, so
// nothing changes on the router or the firewall and no Cloudflare account is
// needed. The address is new on every start.
//
// Visitors do not reach the LLM server itself. They reach a "door" on
// 127.0.0.1 that asks for an API key and passes on only the calls a chat
// client makes; loading, downloading or deleting models stays local.
//
// One file, no npm packages, Windows / macOS / Linux with Node 18 or newer, so
// it can be copied out of the repo and run alone. Left running
// (`llm-tunnel-startup.mjs` starts it with the computer) it looks at itself
// every minute: a tunnel that stopped answering is opened again, a changed
// model list is written out again, and with --publish the app's shared
// registry (docs/llm-registry/README.md) is told the new address each time.
//
// With --with-reports the tunnel to an LLM server ALSO takes the problem
// reports the app's help window sends: a POST of JSON -- the report under
// `prompt`, its files under `attachments` -- to the address itself, the
// `/v1` the registry names, is kept in a SQLite file
// (llm-report-inbox.mjs) and never passed to the LLM server, and the entry
// it publishes says so (`isAcceptingReport`). One tunnel, one key, both.
//
// With --reports there is no LLM server behind the door: the door IS the
// report inbox (llm-report-inbox.mjs), which takes the problem reports the
// app's help window sends and keeps them in a SQLite file, and --publish
// names its address in the registry as an entry that takes reports.
//
// Usage: node llm-tunnel.mjs [--port 1234] [--host <address>]
//          [--name "Church LM Studio"] [--id <server id>]
//          [--new-key] [--no-key] [--cloudflared <path>]
//          [--check <seconds>] [--publish] [--out <folder>] [--log <file>]
//          [--with-reports | --reports] [--db <file>]
//          [--note <text>] [--model-note <model>=<text> ...]

import { execFileSync, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Where the LLM server is unless --host names another computer.
const TARGET_HOST = '127.0.0.1';
const HOST_PATTERN = /^[A-Za-z0-9.-]{1,253}$/;
// Beside the script and never in git (`.gitignore`): the key, and -- one
// of each per tunnel, by its server id, so several can run from this folder
// at once -- what a start has to know about the start before it.
const KEY_FILE = path.join(HERE, 'tunnel-key.txt');

export function getPidFile(id) {
    return path.join(HERE, `tunnel-${id}-cloudflared.pid`);
}

export function getLockFile(id) {
    return path.join(HERE, `tunnel-${id}.pid`);
}

// For --publish: the script that reads and writes the registry on the site.
const PUSH_SCRIPT = path.join(HERE, 's3-push-llm-registry.mjs');
// For --reports: the inbox, loaded only then -- it needs Node's own SQLite
// (22.13 or newer), which a tunnel to an LLM server does not.
const INBOX_SCRIPT = path.join(HERE, 'llm-report-inbox.mjs');
// Where the inbox takes a report: the registry entry's address ends in it,
// and the app posts to that address exactly as written.
export const REPORT_PATH = '/report';
// Where a tunnel to an LLM server takes one (--with-reports): the base
// address its registry entry names, to which the app posts as written.
export const REPORT_AT_BASE_PATH = '/v1';

// The same reading of cloudflared's log as the app's MirrorTunnel.
const URL_PATTERN = /https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/;
const CONNECTED_PATTERN = /Registered tunnel connection/;
// cloudflared that dies is started again, waiting longer each time.
const RESTART_DELAYS_MILLISECOND = [3000, 10000, 30000, 60000];
const NAME_WAIT_MILLISECOND = 30000;
const NAME_POLL_MILLISECOND = 2000;
// The look it takes at itself (--check): this many misses in a row through
// the public address and the tunnel is opened again; a cloudflared that has
// not been handed an address after this long is started again.
const MAX_CHECK_FAILURES = 3;
const STARTING_LIMIT_MILLISECOND = 3 * 60 * 1000;
const MIN_CHECK_SECONDS = 10;
// The registry is not sent to the site more often than this: an address that
// keeps changing is a tunnel that keeps dying.
const PUBLISH_GAP_MILLISECOND = 60 * 1000;
// A publish that failed (the internet was away) is tried again by a later
// look, this far apart.
const PUBLISH_RETRY_MILLISECOND = 5 * 60 * 1000;
const CLOSING_PUBLISH_LIMIT_MILLISECOND = 15 * 1000;
const LOG_MAX_BYTES = 1024 * 1024;
// The app's own limits on a registry entry (electron/customLlmProtocol.ts).
const MAX_MODELS = 50;
const ID_PATTERN = /^[A-Za-z0-9-]{1,48}$/;
const NAME_MAX = 60;
const NOTE_MAX = 300;
// On every answer the door gives, so the look through the public address can
// tell "the door answered" from one of Cloudflare's own error pages.
export const DOOR_HEADER = 'x-llm-door';
// How the look names itself to the door, which then keeps its good answers
// out of the log: one line a minute that says nothing.
export const CHECK_AGENT = 'llm-tunnel-check';

// The only calls the door passes on -- the ones Open Worship's relay makes
// (electron/customLlmProtocol.ts) plus the other two OpenAI inference calls.
export const ALLOWED_CALLS = [
    ['GET', '/v1/models'],
    ['POST', '/v1/chat/completions'],
    ['POST', '/v1/completions'],
    ['POST', '/v1/embeddings'],
    // What a server says about itself, read-only: LM Studio, Ollama, llama.cpp.
    ['GET', '/api/v0/models'],
    ['GET', '/api/tags'],
    ['GET', '/api/ps'],
    ['GET', '/props'],
];

export const USAGE = [
    'Usage: node llm-tunnel.mjs [--port 1234] [--host <address>]',
    '         [--name "Church LM Studio"] [--id <server id>]',
    '         [--new-key] [--no-key] [--cloudflared <path>]',
    '         [--check <seconds>] [--publish] [--out <folder>] [--log <file>]',
    '         [--with-reports | --reports] [--db <file>]',
    '         [--note <text>] [--model-note <model>=<text> ...]',
    '',
    '  --port         the LLM server on this computer (1234 LM Studio,',
    '                 8080 llama.cpp, 11434 Ollama)',
    '  --host         the computer the LLM server is on, when it is another',
    '                 one of the local network (its name or address)',
    '  --name, --id   how the server is named in the registry; the id is',
    '                 what tells one tunnel from another (llm-<port> unless',
    '                 given), so each tunnel adds and removes its own entry',
    '  --new-key      make a new API key; --no-key asks for none',
    '  --check        how often it looks at itself, in seconds (60; 0 never)',
    '  --publish      send the address to the shared registry on the site',
    '                 (needs the repo checkout and extra-work/.env)',
    '  --out          where the connection file and llm-info.json are written',
    '  --log          also write what it says to this file',
    '  --with-reports this tunnel also takes the problem reports the app',
    '                 sends: a POST of the report (JSON: "prompt" and',
    '                 "attachments") to its own address is kept',
    '                 in a SQLite file (--db; report-inbox.sqlite here) and',
    '                 the entry it publishes is marked as taking reports.',
    '                 Needs Node 22.13 or newer.',
    '  --reports      no LLM server: open the report inbox instead, which',
    "                 keeps the problem reports the app's help window sends",
    '                 in a SQLite file (--db; report-inbox.sqlite here), and',
    '                 with --publish name it in the registry as the address',
    '                 that takes reports. Its id is "reports" unless given.',
    '                 Needs Node 22.13 or newer; --port and --host are not',
    '                 used.',
    '  --no-notify    with --reports or --with-reports: no desktop notice',
    '                 on this computer when a new report arrives (one a',
    '                 minute at most; on by default).',
    '  --note         what the app SHOWS the person choosing this server,',
    '                 up to 300 characters ("Slow, but free for us")',
    '  --model-note   the same for one model, as <model>=<text>; give it',
    '                 once per model. Without these, a note already on this',
    "                 tunnel's entry in the registry is kept.",
].join('\n');

/**
 * A tunnel's id when none is given: the server it carries, so two tunnels to
 * two servers are two entries and the same server keeps its id across starts.
 */
export function genDefaultId(host, port) {
    const where = host === TARGET_HOST ? '' : `${host}-`;
    return `llm-${where}${port}`.replace(/[^A-Za-z0-9-]+/g, '-').slice(0, 48);
}

/** The options, or null when they cannot be read (the usage is then shown). */
export function readArgs(argv) {
    const args = {
        port: 1234,
        host: TARGET_HOST,
        name: 'Church LM Studio',
        id: '',
        isKeyWanted: true,
        isNewKey: false,
        cloudflared: '',
        checkSeconds: 60,
        isPublishing: false,
        outDir: '',
        logFile: '',
        isReports: false,
        isWithReports: false,
        dbFile: '',
        // A desktop notice for each new report (`genNewReportNotifier`).
        isNotifying: true,
        // What the app shows the person choosing the server, and each
        // model by its id (`genRegistryServer`).
        note: '',
        modelNotes: {},
    };
    let isBad = false;
    let isNameGiven = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const readNext = () => {
            return String(argv[++i] ?? '');
        };
        if (arg === '--port') args.port = Number(readNext());
        else if (arg === '--host') args.host = readNext();
        else if (arg === '--name') {
            args.name = readNext();
            isNameGiven = true;
        } else if (arg === '--id') args.id = readNext();
        else if (arg === '--reports') args.isReports = true;
        else if (arg === '--with-reports') args.isWithReports = true;
        else if (arg === '--db') args.dbFile = readNext();
        else if (arg === '--no-notify') args.isNotifying = false;
        else if (arg === '--cloudflared') args.cloudflared = readNext();
        else if (arg === '--check') args.checkSeconds = Number(readNext());
        else if (arg === '--out') args.outDir = readNext();
        else if (arg === '--log') args.logFile = readNext();
        else if (arg === '--new-key') args.isNewKey = true;
        else if (arg === '--no-key') args.isKeyWanted = false;
        else if (arg === '--publish') args.isPublishing = true;
        else if (arg === '--note') {
            args.note = readNext().trim();
            isBad = isBad || args.note.length === 0;
        } else if (arg === '--model-note') {
            const [model, ...rest] = readNext().split('=');
            const text = rest.join('=').trim();
            isBad = isBad || model.trim().length === 0 || text.length === 0;
            args.modelNotes[model.trim()] = text;
        } else isBad = true;
    }
    // An inbox is not the LLM server on a port: it has a name and an id of
    // its own, so it and a tunnel to LM Studio are two entries untyped.
    if (args.isReports && !isNameGiven) {
        args.name = 'Report inbox';
    }
    if (args.id === '') {
        args.id = args.isReports
            ? 'reports'
            : genDefaultId(args.host, args.port);
    }
    if (
        isBad ||
        // A file for the inbox, and only for it.
        (args.dbFile !== '' && !args.isReports && !args.isWithReports) ||
        // The inbox alone, or beside an LLM server: not both.
        (args.isReports && args.isWithReports) ||
        (argv.includes('--db') && args.dbFile.trim() === '') ||
        !Number.isInteger(args.port) ||
        args.port < 1 ||
        args.port > 65535 ||
        !HOST_PATTERN.test(args.host) ||
        !Number.isInteger(args.checkSeconds) ||
        args.checkSeconds < 0 ||
        !ID_PATTERN.test(args.id) ||
        args.name.trim().length === 0 ||
        args.name.length > NAME_MAX ||
        args.note.length > NOTE_MAX ||
        Object.values(args.modelNotes).some((text) => {
            return text.length > NOTE_MAX;
        })
    ) {
        return null;
    }
    if (args.checkSeconds > 0 && args.checkSeconds < MIN_CHECK_SECONDS) {
        args.checkSeconds = MIN_CHECK_SECONDS;
    }
    return args;
}

function checkIsFile(file) {
    try {
        return fs.statSync(file).isFile();
    } catch {
        return false;
    }
}

function checkIsDirectory(dir) {
    try {
        return fs.statSync(dir).isDirectory();
    } catch {
        return false;
    }
}

/** The app's name for this kind of computer (extra-work/buildPlatformHelpers.mjs). */
export function getPlatformDirName(
    platform = process.platform,
    arch = process.arch,
) {
    const isArm64 = arch === 'arm64';
    if (platform === 'win32') {
        return isArm64 ? 'win-arm64' : 'win';
    }
    if (platform === 'darwin') {
        return isArm64 ? 'mac' : 'mac-int';
    }
    return isArm64 ? 'linux-arm64' : 'linux';
}

/** Where Electron keeps an app's `userData`, by OS. */
function getAppDataDir(platform, env, home) {
    if (platform === 'win32') {
        return env.APPDATA || path.join(home, 'AppData', 'Roaming');
    }
    if (platform === 'darwin') {
        return path.join(home, 'Library', 'Application Support');
    }
    return env.XDG_CONFIG_HOME || path.join(home, '.config');
}

/** Every place a cloudflared may be, most wanted first. */
export function listCloudflaredCandidates(
    asked,
    {
        platform = process.platform,
        arch = process.arch,
        env = process.env,
        home = os.homedir(),
        scriptDir = HERE,
    } = {},
) {
    const fileName = platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
    const platformDir = getPlatformDirName(platform, arch);
    const appDataDir = getAppDataDir(platform, env, home);
    // The builds committed to the app's repo (*-build-cloudflared.*), when
    // this script is run from its checkout.
    const repoDir = path.join(
        scriptDir,
        '..',
        'experiment-building',
        platformDir,
    );
    let repoBuilds = [];
    try {
        repoBuilds = fs
            .readdirSync(repoDir)
            .filter((name) => {
                return /^cloudflared/i.test(name);
            })
            .map((name) => {
                return path.join(repoDir, name);
            });
    } catch {
        // No checkout of the app around this script.
    }
    return [
        asked,
        env.CLOUDFLARED,
        path.join(scriptDir, fileName),
        // Open Worship's extra-bin pack (electron/extraBinPaths.ts).
        ...['open-worship-app', 'open-worship-app-dev'].map((name) => {
            return path.join(
                appDataDir,
                name,
                'extra-bin',
                platformDir,
                'cloudflared',
                fileName,
            );
        }),
        ...repoBuilds,
        ...(env.PATH || '')
            .split(path.delimiter)
            .filter(Boolean)
            .map((dir) => {
                return path.join(dir, fileName);
            }),
    ].filter(Boolean);
}

function findCloudflared(asked) {
    return listCloudflaredCandidates(asked).find(checkIsFile) || '';
}

// The repo's builds are committed without the executable bit, and a file
// carried on a stick can lose it: a copy beside this script is run instead.
function toRunnable(file) {
    if (process.platform === 'win32') {
        return file;
    }
    try {
        fs.accessSync(file, fs.constants.X_OK);
        return file;
    } catch {
        // Not executable as it is.
    }
    const copy = path.join(HERE, 'cloudflared');
    if (path.resolve(file) !== copy) {
        fs.copyFileSync(file, copy);
    }
    fs.chmodSync(copy, 0o755);
    return copy;
}

/** What a running process is: its command line, or on Windows its file name. */
export function readProcessCommand(pid) {
    try {
        if (process.platform === 'win32') {
            return execFileSync(
                'tasklist',
                ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'],
                { encoding: 'utf8', windowsHide: true },
            );
        }
        if (process.platform === 'linux') {
            return fs
                .readFileSync(`/proc/${pid}/cmdline`, 'utf8')
                .replaceAll('\0', ' ');
        }
        return execFileSync('ps', ['-p', String(pid), '-o', 'command='], {
            encoding: 'utf8',
        });
    } catch {
        return '';
    }
}

function readPidFile(file) {
    try {
        const pid = Number(fs.readFileSync(file, 'utf8').trim());
        return Number.isInteger(pid) && pid > 0 ? pid : 0;
    } catch {
        return 0;
    }
}

// One tunnel per server id: a second start of the same one -- a scheduled
// repeat, a double click -- leaves the first alone.
function takeLock(lockFile) {
    const pid = readPidFile(lockFile);
    const ownPattern = process.platform === 'win32' ? /node/i : /llm-tunnel/;
    if (
        pid !== 0 &&
        pid !== process.pid &&
        ownPattern.test(readProcessCommand(pid))
    ) {
        return false;
    }
    fs.writeFileSync(lockFile, String(process.pid));
    return true;
}

export function readKey(isNewKey, keyFile = KEY_FILE) {
    if (!isNewKey) {
        try {
            const saved = fs.readFileSync(keyFile, 'utf8').trim();
            if (saved) {
                return saved;
            }
        } catch {
            // First start: no key yet.
        }
    }
    const key = `sk-${crypto.randomBytes(20).toString('hex')}`;
    fs.writeFileSync(keyFile, `${key}\n`, { mode: 0o600 });
    return key;
}

export function checkIsKeyRight(req, key) {
    const given =
        /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '')?.[1] ?? '';
    const toDigest = (text) => {
        return crypto.createHash('sha256').update(text).digest();
    };
    return crypto.timingSafeEqual(toDigest(given.trim()), toDigest(key));
}

const output = { file: '' };

function print(text = '') {
    console.log(text);
    if (!output.file) {
        return;
    }
    try {
        if (
            checkIsFile(output.file) &&
            fs.statSync(output.file).size > LOG_MAX_BYTES
        ) {
            fs.renameSync(output.file, `${output.file}.1`);
        }
        fs.appendFileSync(output.file, `${text}\n`);
    } catch {
        // A log that cannot be written must not stop the tunnel.
    }
}

function log(text) {
    const now = new Date();
    const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
        .map((part) => {
            return String(part).padStart(2, '0');
        })
        .join('-');
    print(`${date} ${now.toTimeString().slice(0, 8)}  ${text}`);
}

function sleep(millisecond) {
    return new Promise((resolve) => {
        setTimeout(resolve, millisecond);
    });
}

function getJson(url) {
    return new Promise((resolve, reject) => {
        const request = http.get(url, { timeout: 15000 }, (answer) => {
            let text = '';
            answer.setEncoding('utf8');
            answer.on('data', (chunk) => {
                text += chunk;
            });
            answer.on('end', () => {
                try {
                    resolve({
                        status: answer.statusCode,
                        data: JSON.parse(text),
                    });
                } catch {
                    resolve({ status: answer.statusCode, data: null });
                }
            });
        });
        request.on('timeout', () => {
            request.destroy(new Error('no answer in 15 s'));
        });
        request.on('error', reject);
    });
}

// The chat models the server offers, as entries for llm-info.json. Rejects
// only when nothing answers on the port at all.
export async function readModels(port, host = TARGET_HOST) {
    const base = `http://${host}:${port}`;
    // LM Studio describes its models (display name, vision) on /api/v1/models.
    const lmStudio = await getJson(`${base}/api/v1/models`);
    if (Array.isArray(lmStudio.data?.models)) {
        const chatList = lmStudio.data.models.filter((item) => {
            return item.type === 'llm' && typeof item.key === 'string';
        });
        // Only what is LOADED, when anything is: the list holds every model
        // downloaded, and one picked that is not loaded is loaded on the
        // spot (LM Studio's JIT) at its default context -- too small for the
        // app, and a long wait on the machine (2026-10-15, nine listed with
        // a 12B first while only a 4B was loaded). With nothing loaded the
        // whole list stands, so the assistant is never published empty.
        const loadedList = chatList.filter((item) => {
            return (
                Array.isArray(item.loaded_instances) &&
                item.loaded_instances.length > 0
            );
        });
        return {
            kind: 'LM Studio',
            models: (loadedList.length > 0 ? loadedList : chatList)
                .slice(0, MAX_MODELS)
                .map((item) => {
                    return {
                        model: item.key,
                        name: item.display_name || item.key,
                        canSeeImages: item.capabilities?.vision === true,
                    };
                }),
        };
    }
    // Any other OpenAI-compatible server only lists ids (none when it asks
    // for its own key).
    const list = await getJson(`${base}/v1/models`);
    const rows = Array.isArray(list.data?.data) ? list.data.data : [];
    return {
        kind: 'Local LLM server',
        models: rows
            .filter((item) => {
                return typeof item.id === 'string' && !/embed/i.test(item.id);
            })
            .slice(0, MAX_MODELS)
            .map((item) => {
                return { model: item.id, name: item.id, canSeeImages: false };
            }),
    };
}

// The door: a loopback listener of its own, the only thing cloudflared is
// pointed at.
export function openDoor(
    targetPort,
    key,
    say = log,
    targetHost = TARGET_HOST,
    reportTaker = null,
) {
    const server = http.createServer((req, res) => {
        const startedAt = Date.now();
        const pathname = req.url.split('?')[0];
        const visitor =
            req.headers['cf-connecting-ip'] || req.socket.remoteAddress;
        const isOwnLook = req.headers['user-agent'] === CHECK_AGENT;
        const note = (status) => {
            // Only the tunnel's own LOOK goes unlogged -- a GET. A chat call
            // that names itself the look is logged like any other, or a
            // flood sent under that name would leave no line at all.
            if (isOwnLook && status === 200 && req.method === 'GET') {
                return;
            }
            const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
            say(
                `${req.method} ${pathname}  ${status}  ${seconds} s  from ${visitor}`,
            );
        };
        const refuse = (status, code, message) => {
            res.writeHead(status, {
                'content-type': 'application/json',
                [DOOR_HEADER]: '1',
            });
            res.end(
                JSON.stringify({
                    error: { message, type: 'invalid_request_error', code },
                }),
            );
            note(status);
        };
        if (key && !checkIsKeyRight(req, key)) {
            refuse(
                401,
                'invalid_api_key',
                'This server needs its API key: send "Authorization: Bearer <key>".',
            );
            return;
        }
        // --with-reports: a POST to the address itself is a problem report
        // from the app. It is kept here, behind the same key, and never
        // reaches the LLM server.
        if (
            reportTaker !== null &&
            req.method === 'POST' &&
            pathname === REPORT_AT_BASE_PATH
        ) {
            reportTaker.take(req, res);
            return;
        }
        if (
            !ALLOWED_CALLS.some(([method, allowed]) => {
                return method === req.method && allowed === pathname;
            })
        ) {
            refuse(
                404,
                'not_found',
                `${req.method} ${pathname} is not open here; use /v1/models and /v1/chat/completions.`,
            );
            return;
        }
        const headers = {
            ...req.headers,
            host: `${targetHost === TARGET_HOST ? 'localhost' : targetHost}:${targetPort}`,
        };
        // The door's key stops at the door. Without one, the server's own key
        // is passed on.
        if (key) {
            delete headers.authorization;
        }
        const upstream = http.request(
            {
                host: targetHost,
                port: targetPort,
                method: req.method,
                path: req.url,
                headers,
            },
            (answer) => {
                res.writeHead(answer.statusCode, {
                    ...answer.headers,
                    [DOOR_HEADER]: '1',
                });
                // A streamed answer must leave word by word, not when a
                // buffer fills.
                res.flushHeaders();
                answer.pipe(res);
                answer.on('end', () => {
                    note(answer.statusCode);
                });
            },
        );
        upstream.on('error', () => {
            if (res.headersSent) {
                res.destroy();
            } else {
                refuse(
                    502,
                    'server_unreachable',
                    `The LLM server at ${targetHost}:${targetPort} did not answer.`,
                );
            }
        });
        // The visitor left or pressed Stop: the LLM server stops writing too.
        res.on('close', () => {
            if (!res.writableEnded) {
                upstream.destroy();
            }
        });
        req.pipe(upstream);
    });
    return new Promise((resolve, reject) => {
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            resolve(server);
        });
    });
}

// A new address is in Cloudflare's DNS a few seconds after cloudflared
// registered. Asked for sooner, a resolver keeps the "no such name" for
// minutes, so the address is announced only once Cloudflare's own DNS over
// HTTPS knows it, or after half a minute anyway.
async function waitForName(url, fetchUrl) {
    const host = new URL(url).host;
    const until = Date.now() + NAME_WAIT_MILLISECOND;
    while (Date.now() < until) {
        try {
            const response = await fetchUrl(
                `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`,
                {
                    signal: AbortSignal.timeout(5000),
                    headers: { accept: 'application/dns-json' },
                },
            );
            const answer = response.ok ? await response.json() : null;
            if (
                Array.isArray(answer?.Answer) &&
                answer.Answer.some((item) => {
                    return item?.type === 1;
                })
            ) {
                return;
            }
        } catch {
            // Not yet, or no answer: asked again.
        }
        await sleep(NAME_POLL_MILLISECOND);
    }
}

// A cloudflared left behind by a run that was killed, not closed, would keep
// its address alive.
function endLeftoverTunnel(pidFile) {
    const pid = readPidFile(pidFile);
    if (pid !== 0 && /cloudflared/i.test(readProcessCommand(pid))) {
        try {
            process.kill(pid);
            log(
                `Closed a tunnel left over from an earlier run (cloudflared, pid ${pid}).`,
            );
        } catch {
            // Already gone.
        }
    }
    fs.rmSync(pidFile, { force: true });
}

/**
 * cloudflared, kept running: `onUp(url)` once its address can be used,
 * `onDown()` when that address stops being one, `onFailed(error)` when it
 * cannot be started at all.
 */
export function openTunnel({
    cloudflared,
    doorPort,
    onUp,
    onDown,
    onFailed,
    say = log,
    spawnChild = spawn,
    fetchUrl = fetch,
    pidFile,
}) {
    let child;
    let url = '';
    let restarts = 0;
    let restartTimer;
    let startedAt = 0;
    let isClosed = false;

    const start = () => {
        const thisChild = spawnChild(
            cloudflared,
            [
                'tunnel',
                '--no-autoupdate',
                '--url',
                `http://127.0.0.1:${doorPort}`,
            ],
            { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
        );
        child = thisChild;
        startedAt = Date.now();
        if (thisChild.pid) {
            fs.writeFileSync(pidFile, String(thisChild.pid));
        }
        say('Waiting for Cloudflare to hand out an address...');
        // cloudflared logs to stderr; a line can arrive split in two.
        let tail = '';
        let found = '';
        let isWaitingForName = false;
        const onData = (chunk) => {
            tail = (tail + String(chunk)).slice(-8192);
            found = found || (URL_PATTERN.exec(tail)?.[0] ?? '');
            if (found && !isWaitingForName && CONNECTED_PATTERN.test(tail)) {
                isWaitingForName = true;
                void waitForName(found, fetchUrl).then(() => {
                    if (child === thisChild && !isClosed) {
                        restarts = 0;
                        url = found;
                        onUp(found);
                    }
                });
            }
        };
        thisChild.stdout?.on('data', onData);
        thisChild.stderr?.on('data', onData);
        thisChild.on('error', (error) => {
            if (child === thisChild) {
                onFailed(error);
            }
        });
        thisChild.on('exit', (code) => {
            if (isClosed || child !== thisChild) {
                return;
            }
            child = undefined;
            url = '';
            onDown();
            const delay =
                RESTART_DELAYS_MILLISECOND[
                    Math.min(restarts, RESTART_DELAYS_MILLISECOND.length - 1)
                ];
            restarts++;
            const lastWords = tail.trim().split(/\r?\n/).slice(-3).join('\n');
            say(
                `cloudflared stopped (exit ${code}); starting it again in ${delay / 1000} s. Its last words:\n${lastWords}`,
            );
            restartTimer = setTimeout(start, delay);
        });
    };

    const endChild = () => {
        const old = child;
        child = undefined;
        if (old && old.exitCode === null) {
            old.kill();
        }
    };

    return {
        start,
        // A new tunnel now, with a new address: the one there is has stopped
        // carrying.
        restart() {
            clearTimeout(restartTimer);
            endChild();
            url = '';
            onDown();
            start();
        },
        close() {
            isClosed = true;
            clearTimeout(restartTimer);
            endChild();
            url = '';
            fs.rmSync(pidFile, { force: true });
        },
        /** The address, once it can be used; empty until then. */
        getUrl() {
            return url;
        },
        /** How long cloudflared has been running without an address yet. */
        getStartingMillisecond() {
            return child !== undefined && url === ''
                ? Date.now() - startedAt
                : 0;
        },
    };
}

// Asked through the PUBLIC address, so one answer proves the whole way in:
// Cloudflare, cloudflared and the door. The LLM server being off is not the
// tunnel's failure -- the door still answers (502) and says so itself.
export async function checkIsTunnelAnswering(url, key, fetchUrl = fetch) {
    try {
        const response = await fetchUrl(`${url}/v1/models`, {
            signal: AbortSignal.timeout(15000),
            headers: {
                'user-agent': CHECK_AGENT,
                ...(key ? { authorization: `Bearer ${key}` } : {}),
            },
        });
        await response.body?.cancel();
        return response.headers.get(DOOR_HEADER) === '1';
    } catch {
        return false;
    }
}

/**
 * This tunnel's entry. Its notes are what the app SHOWS the person choosing
 * the server or a model (2026-10-17, the user's ask: _for some model we want
 * to let user know it slow but help us save cost of usage_), so the entry
 * carries only what --note and --model-note say: the line it wrote by
 * itself about the tunnel was for whoever read the file, and would have
 * been shown to every volunteer. `_kind`, the server's name, is the log's.
 */
export function genRegistryServer(args, baseUrl, key, _kind, models) {
    const modelNotes = args.modelNotes ?? {};
    return {
        id: args.id,
        name: args.name,
        baseUrl,
        apiKey: key,
        isFree: true,
        ...(args.note ? { note: args.note } : {}),
        models: models.map((model) => {
            const note = modelNotes[model.model];
            return note === undefined ? model : { ...model, note };
        }),
        // The same address takes the app's problem reports too.
        ...(args.isWithReports === true ? { isAcceptingReport: true } : {}),
    };
}

/**
 * The entry with the notes the registry's copy of it already carries, where
 * this start gave none: a note an admin put on the server or on a model in
 * the site's file is not lost when the tunnel starts again and rewrites its
 * entry.
 */
// What a tunnel wrote by itself until then, which is not an admin's to keep.
const OLD_TUNNEL_NOTE_PATTERN = / on the church's computer through a Cloudflare quick tunnel$/;

function keepLiveNotes(server, before) {
    const liveModels = Array.isArray(before?.models) ? before.models : [];
    const liveNote =
        typeof before?.note === 'string' &&
        OLD_TUNNEL_NOTE_PATTERN.test(before.note)
            ? undefined
            : before?.note;
    const kept = {
        ...server,
        models: server.models.map((model) => {
            const live = liveModels.find((one) => {
                return one?.model === model.model;
            });
            return model.note === undefined && live?.note !== undefined
                ? { ...model, note: live.note }
                : model;
        }),
    };
    return server.note === undefined && liveNote !== undefined
        ? { ...kept, note: liveNote }
        : kept;
}

/**
 * The registry entry of a tunnel that carries the report inbox: an address
 * that takes the app's problem reports and is no assistant, so it names no
 * model (docs/llm-registry/README.md, "An entry that takes reports").
 */
export function genReportRegistryServer(args, baseUrl, key) {
    return {
        id: args.id,
        name: args.name,
        baseUrl,
        apiKey: key,
        isAcceptingReport: true,
        note: "Takes the help window's problem reports, through a Cloudflare quick tunnel",
    };
}

/**
 * The registry to send to the site, made from the one it holds NOW: this
 * tunnel's entry put where the entry carrying its id was (at the end when
 * there was none), and every other server -- another tunnel's, one kept by
 * hand -- left exactly as it is. `server` null is the tunnel closing: its
 * own entry is taken out, and nothing else.
 */
export function mergeRegistry(live, server, id, today) {
    const kept = Array.isArray(live?.servers) ? live.servers : [];
    const servers = [];
    let isPlaced = false;
    for (const item of kept) {
        if (item?.id !== id) {
            servers.push(item);
        } else if (server !== null && !isPlaced) {
            servers.push(
                Array.isArray(server.models)
                    ? keepLiveNotes(server, item)
                    : server,
            );
            isPlaced = true;
        }
    }
    if (server !== null && !isPlaced) {
        servers.push(server);
    }
    return { version: 1, updated: today, servers };
}

/**
 * Whether the registry is owed a publish: there is an entry it should carry,
 * it was not told that entry (the last try failed), none is on its way, and
 * the last try is far enough behind.
 */
export function checkIsPublishOwed({
    wantedText,
    publishedText,
    isQueued,
    lastPublishAt,
    now,
}) {
    return (
        wantedText !== '' &&
        !isQueued &&
        wantedText !== publishedText &&
        now - lastPublishAt > PUBLISH_RETRY_MILLISECOND
    );
}

function findOutDir(asked) {
    const desktop = path.join(os.homedir(), 'Desktop');
    const dir = asked
        ? path.resolve(asked)
        : checkIsDirectory(desktop)
          ? desktop
          : path.join(HERE, 'run');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function genMissingCloudflaredText() {
    const fileName =
        process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
    const install =
        process.platform === 'win32'
            ? 'winget install Cloudflare.cloudflared'
            : process.platform === 'darwin'
              ? 'brew install cloudflared'
              : 'see https://pkg.cloudflare.com for apt / dnf';
    return [
        `${fileName} was not found. Put one beside this script, run this`,
        "script from the app's repo checkout, install Open Worship's",
        'extra-bin pack (Settings > Others > Extra Binaries), pass',
        `--cloudflared <path>, or install it: ${install}`,
    ].join('\n');
}

async function main() {
    const args = readArgs(process.argv.slice(2));
    if (args === null) {
        console.error(USAGE);
        process.exit(1);
    }
    output.file = args.logFile ? path.resolve(args.logFile) : '';
    const lockFile = getLockFile(args.id);
    const pidFile = getPidFile(args.id);
    if (!takeLock(lockFile)) {
        log(
            `The tunnel "${args.id}" started from this folder is already running; this start leaves it alone.`,
        );
        return;
    }
    let cloudflared = findCloudflared(args.cloudflared);
    if (!cloudflared) {
        print(genMissingCloudflaredText());
        fs.rmSync(lockFile, { force: true });
        process.exit(1);
    }
    try {
        cloudflared = toRunnable(cloudflared);
    } catch (error) {
        print(
            `${cloudflared} cannot be run (${error.message}). Try: chmod +x "${cloudflared}"`,
        );
        fs.rmSync(lockFile, { force: true });
        process.exit(1);
    }
    const outDir = findOutDir(args.outDir);
    // Named by the id, like the lock: each tunnel writes and removes its own.
    const connectionFile = path.join(
        outDir,
        `llm-tunnel-connection-${args.id}.txt`,
    );
    const infoFile = path.join(outDir, `llm-info-${args.id}.json`);
    endLeftoverTunnel(pidFile);
    const key = args.isKeyWanted ? readKey(args.isNewKey) : '';
    let door;
    let doorTarget = `${args.host}:${args.port}`;
    if (args.isReports) {
        // The door is the inbox itself: nothing stands behind it.
        try {
            const {
                openReportInbox,
                DEFAULT_DB_FILE,
                genNewReportNotifier,
            } = await import(pathToFileURL(INBOX_SCRIPT).href);
            const dbFile = args.dbFile
                ? path.resolve(args.dbFile)
                : DEFAULT_DB_FILE;
            door = await openReportInbox({
                key,
                dbFile,
                say: log,
                onNew: args.isNotifying ? genNewReportNotifier() : null,
            });
            doorTarget = `the report inbox (${dbFile})`;
        } catch (error) {
            print(`The report inbox could not be opened: ${error.message}`);
            fs.rmSync(lockFile, { force: true });
            process.exit(1);
        }
    } else {
        let reportTaker = null;
        if (args.isWithReports) {
            try {
                const {
                    openReportTaker,
                    DEFAULT_DB_FILE,
                    genNewReportNotifier,
                } = await import(pathToFileURL(INBOX_SCRIPT).href);
                const dbFile = args.dbFile
                    ? path.resolve(args.dbFile)
                    : DEFAULT_DB_FILE;
                reportTaker = await openReportTaker({
                    dbFile,
                    say: log,
                    onNew: args.isNotifying ? genNewReportNotifier() : null,
                });
                doorTarget += `, reports kept in ${dbFile}`;
            } catch (error) {
                print(
                    `The report inbox could not be opened: ${error.message}`,
                );
                fs.rmSync(lockFile, { force: true });
                process.exit(1);
            }
        }
        door = await openDoor(args.port, key, log, args.host, reportTaker);
    }
    const doorPort = door.address().port;
    log(
        `Door on 127.0.0.1:${doorPort} -> ${doorTarget}, ${key ? 'API key needed' : 'NO API KEY'}`,
    );
    log(`cloudflared: ${cloudflared}`);

    // What was last written out, so a look that finds nothing new writes
    // nothing: the address, the key and the models, as one text.
    let announced = '';
    let isServerMissingSaid = false;
    let isClosing = false;
    let isLooking = false;
    let failures = 0;
    let publishTurn = 0;
    let publishChain = Promise.resolve();
    let lastPublishAt = 0;
    let isPublishQueued = false;
    // The entry the registry should carry now, and the one it was last told.
    let wantedServer = null;
    let publishedText = '';

    const withdraw = () => {
        announced = '';
        wantedServer = null;
        fs.rmSync(connectionFile, { force: true });
        fs.rmSync(infoFile, { force: true });
    };

    // Puts this tunnel's entry into the registry the site holds, in place of
    // its old one; `server` null takes it back out. Other servers there --
    // another tunnel's -- are never touched.
    const publish = (server, isNow = false) => {
        const turn = ++publishTurn;
        isPublishQueued = true;
        publishChain = publishChain.then(async () => {
            const wait = lastPublishAt + PUBLISH_GAP_MILLISECOND - Date.now();
            if (!isNow && wait > 0) {
                await sleep(wait);
            }
            if (turn !== publishTurn) {
                // A newer address came while this one waited.
                return;
            }
            try {
                if (!checkIsFile(PUSH_SCRIPT)) {
                    throw new Error(
                        's3-push-llm-registry.mjs is not beside this script (run it from the repo checkout)',
                    );
                }
                const { publishRegistry, readPublishedRegistry } = await import(
                    pathToFileURL(PUSH_SCRIPT).href
                );
                await publishRegistry(
                    mergeRegistry(
                        await readPublishedRegistry(),
                        server,
                        args.id,
                        new Date().toISOString().slice(0, 10),
                    ),
                    log,
                );
                publishedText = JSON.stringify(server);
                log(
                    server === null
                        ? 'The shared registry no longer names this server.'
                        : `The shared registry now names ${server.baseUrl}`,
                );
            } catch (error) {
                log(`Not published: ${error?.message ?? error}`);
            }
            lastPublishAt = Date.now();
            if (turn === publishTurn) {
                isPublishQueued = false;
            }
        });
        return publishChain;
    };

    // Writes the address out when it, or what the server offers, is new.
    const announce = async () => {
        const url = tunnel.getUrl();
        if (!url || isClosing) {
            return;
        }
        // An inbox has no LLM server to wait for and no model to list.
        const found = args.isReports
            ? { kind: 'Report inbox', models: [] }
            : await readModels(args.port, args.host).catch(() => {
                  return null;
              });
        if (found === null && args.checkSeconds > 0) {
            // Looked at again on the next check; said once.
            if (!isServerMissingSaid) {
                isServerMissingSaid = true;
                log(
                    `No LLM server answers on ${args.host}:${args.port} yet. The tunnel is open; its address is written out once one does.`,
                );
            }
            return;
        }
        isServerMissingSaid = false;
        const { kind, models } = found ?? {
            kind: 'Local LLM server',
            models: [],
        };
        const baseUrl = args.isReports ? `${url}${REPORT_PATH}` : `${url}/v1`;
        const text = JSON.stringify({ baseUrl, key, models });
        if (text === announced || url !== tunnel.getUrl()) {
            return;
        }
        announced = text;
        const server = args.isReports
            ? genReportRegistryServer(args, baseUrl, key)
            : genRegistryServer(args, baseUrl, key, kind, models);
        fs.writeFileSync(
            infoFile,
            `${JSON.stringify(
                {
                    version: 1,
                    updated: new Date().toISOString().slice(0, 10),
                    servers: [server],
                },
                null,
                2,
            )}\n`,
            { mode: 0o600 },
        );
        const keyHeader = key ? ` -H "Authorization: Bearer ${key}"` : '';
        const reportLines = [
            'Report inbox on the internet (Cloudflare quick tunnel)',
            '',
            `Address  : ${baseUrl}`,
            `API key  : ${key || '(none)'}`,
            '',
            "Open Worship's help window posts a problem report here when Send",
            'report is pressed, once the shared registry names this address',
            '(--publish). Read what arrived:',
            '  node llm-report-inbox.mjs list',
            '',
            'Test from any computer:',
            `  curl -X POST ${baseUrl}${keyHeader} -H "Content-Type: application/json" --data "{\\"prompt\\":\\"a test report\\"}"`,
            '',
            'The address is new every time the tunnel starts. This file is removed when it stops.',
            '',
        ];
        const serverLines = [
            'Local LLM server on the internet (Cloudflare quick tunnel)',
            '',
            `Base URL : ${baseUrl}`,
            `API key  : ${key || '(none)'}`,
            `Models   : ${
                models
                    .map((item) => {
                        return item.model;
                    })
                    .join(', ') || '(ask /v1/models)'
            }`,
            '',
            'Open Worship: Settings > Others > Custom servers > add a server with this',
            'Base URL and API key, then Test.',
            '',
            'Test from any computer:',
            `  curl ${baseUrl}/models${keyHeader}`,
            '',
            'The address is new every time the tunnel starts. This file is removed when it stops.',
            '',
        ];
        fs.writeFileSync(
            connectionFile,
            (args.isReports ? reportLines : serverLines).join(os.EOL),
            { mode: 0o600 },
        );
        // The key is shown to a person at a terminal, never written to a
        // log file or a service's journal.
        const isKeyShown = process.stdout.isTTY === true && !output.file;
        const line = '='.repeat(78);
        print(`\n${line}\n`);
        print(`    ${args.isReports ? 'Address ' : 'Base URL'} : ${baseUrl}`);
        print(
            `    API key  : ${
                key
                    ? isKeyShown
                        ? key
                        : `in ${connectionFile}`
                    : '(none) - anyone who has the address can use this server'
            }`,
        );
        print(`\n${line}\n`);
        print(
            args.isReports
                ? 'The report inbox: a report POSTed to that address is kept, with its files.'
                : `${kind} at ${args.host}:${args.port}, ${models.length} chat model(s).`,
        );
        print(`Written to ${connectionFile}`);
        print(`       and ${infoFile}`);
        print('Ctrl+C closes the tunnel. The address is new on every start.\n');
        if (!args.isPublishing) {
            return;
        }
        if (!args.isReports && models.length === 0) {
            log(
                'Not published: the server lists no chat model, and the registry takes no server without one.',
            );
            return;
        }
        wantedServer = server;
        void publish(server);
    };

    // A publish that did not go through leaves the registry naming an address
    // that is gone: it is sent again, a few minutes apart, until it does.
    // Two tunnels publishing in the same second can lose one entry, and a
    // registry can be replaced by hand: every few minutes the site's copy is
    // read, and this tunnel's entry put back when it is not there as it was
    // sent.
    let lastVerifyAt = Date.now();
    const putBackIfLost = () => {
        if (
            !args.isPublishing ||
            wantedServer === null ||
            isPublishQueued ||
            Date.now() - lastVerifyAt < PUBLISH_RETRY_MILLISECOND
        ) {
            return;
        }
        lastVerifyAt = Date.now();
        const wanted = wantedServer;
        void (async () => {
            try {
                const { readPublishedRegistry } = await import(
                    pathToFileURL(PUSH_SCRIPT).href
                );
                const live = await readPublishedRegistry();
                const mine = live.servers.find((item) => {
                    return item?.id === args.id;
                });
                if (
                    JSON.stringify(mine) !== JSON.stringify(wanted) &&
                    wantedServer === wanted &&
                    !isClosing
                ) {
                    log(
                        'The shared registry no longer had this server as it was sent; putting it back.',
                    );
                    void publish(wanted);
                }
            } catch {
                // Read again in a few minutes.
            }
        })();
    };

    const publishAgainIfOwed = () => {
        if (
            checkIsPublishOwed({
                wantedText:
                    wantedServer === null ? '' : JSON.stringify(wantedServer),
                publishedText,
                isQueued: isPublishQueued,
                lastPublishAt,
                now: Date.now(),
            })
        ) {
            void publish(wantedServer);
        }
    };

    const close = async () => {
        if (isClosing) {
            return;
        }
        isClosing = true;
        clearInterval(lookTimer);
        tunnel.close();
        withdraw();
        fs.rmSync(lockFile, { force: true });
        // The folder made for the two files, when it was this script's own
        // and nothing else is in it (another tunnel's files would be).
        if (outDir === path.join(HERE, 'run')) {
            try {
                fs.rmdirSync(outDir);
            } catch {
                // Not empty: another tunnel is using it.
            }
        }
        if (publishTurn > 0) {
            await Promise.race([
                publish(null, true),
                sleep(CLOSING_PUBLISH_LIMIT_MILLISECOND),
            ]);
        }
        print('\nTunnel closed. The address no longer works.');
        process.exit(0);
    };

    const tunnel = openTunnel({
        cloudflared,
        doorPort,
        pidFile,
        onUp: () => {
            failures = 0;
            void announce();
        },
        onDown: withdraw,
        onFailed: (error) => {
            print(`cloudflared could not be started: ${error.message}`);
            fs.rmSync(lockFile, { force: true });
            process.exit(1);
        },
    });

    // The look it takes at itself.
    const look = async () => {
        if (isClosing || isLooking) {
            return;
        }
        isLooking = true;
        try {
            const url = tunnel.getUrl();
            if (!url) {
                if (
                    tunnel.getStartingMillisecond() > STARTING_LIMIT_MILLISECOND
                ) {
                    log(
                        'cloudflared has been given no address; starting it again.',
                    );
                    tunnel.restart();
                }
                return;
            }
            if (await checkIsTunnelAnswering(url, key)) {
                failures = 0;
                await announce();
                publishAgainIfOwed();
                putBackIfLost();
                return;
            }
            failures++;
            log(
                `The public address did not answer (${failures} of ${MAX_CHECK_FAILURES}).`,
            );
            if (failures >= MAX_CHECK_FAILURES && !isClosing) {
                failures = 0;
                log('Opening a new tunnel; its address will be a new one.');
                tunnel.restart();
            }
        } finally {
            isLooking = false;
        }
    };
    const lookTimer =
        args.checkSeconds > 0
            ? setInterval(() => {
                  void look();
              }, args.checkSeconds * 1000)
            : undefined;

    // Ctrl+C, Ctrl+Break, a closed console window, a polite kill.
    for (const signal of ['SIGINT', 'SIGBREAK', 'SIGHUP', 'SIGTERM']) {
        process.on(signal, () => {
            void close();
        });
    }

    withdraw();
    tunnel.start();
}

function checkIsRunDirectly() {
    try {
        return (
            process.argv[1] !== undefined &&
            fs.realpathSync.native(process.argv[1]) ===
                fs.realpathSync.native(fileURLToPath(import.meta.url))
        );
    } catch {
        return false;
    }
}

if (checkIsRunDirectly()) {
    void main();
}
