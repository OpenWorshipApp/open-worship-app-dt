// Finds a RUNNING Open Worship App instance.
//
// The app takes no hardcoded debugging port: Chromium binds a free one and the
// main process publishes it to `<temp>/open-worship-app-cdp/<pid>.json` -- see
// `publishAiEndpoints` in `electron/aiHelpers.ts`. One file per
// live instance, so dev beside the packaged app, or several dev instances on
// different `OWA_USER_DATA_PATH`s, can each be found.

import { readdirSync, readFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

export const CDP_INFO_DIR_PATH = path.join(os.tmpdir(), 'open-worship-app-cdp');

// What an instance pinned with `--owa-remote-debugging-port=9223` (the port
// this repo used to hardcode) would be on -- tried last, so a published port
// always wins.
const FALLBACK_PORTS = [9223];

/** Every instance that has published itself, newest first. */
export function readPublishedInstances() {
    let fileNames = [];
    try {
        fileNames = readdirSync(CDP_INFO_DIR_PATH);
    } catch {
        return [];
    }
    const instances = [];
    for (const fileName of fileNames) {
        if (!fileName.endsWith('.json')) {
            continue;
        }
        try {
            const filePath = path.join(CDP_INFO_DIR_PATH, fileName);
            const info = JSON.parse(readFileSync(filePath, 'utf-8'));
            if (Number.isInteger(info?.port)) {
                instances.push(info);
            }
        } catch {
            // A half-written or unreadable file is simply not a candidate.
        }
    }
    // Newest first: the instance started last is the one being worked with.
    return instances.sort((one, other) => {
        return String(other.startedAt).localeCompare(String(one.startedAt));
    });
}

function checkIsProcessAlive(pid) {
    try {
        // Signal 0 only probes; it never touches the process.
        process.kill(pid, 0);
        return true;
    } catch (error) {
        // A running process owned by someone else answers EPERM, not ESRCH.
        return error?.code === 'EPERM';
    }
}

/**
 * Instances whose process is still alive. An app that was killed never ran its
 * `will-quit` cleanup, so its file outlives it -- and a dead port answers
 * nothing but a connection refused, which reads to an agent as "the app is
 * broken" rather than "that one is gone".
 */
export function readLiveInstances() {
    return readPublishedInstances().filter((instance) => {
        return (
            !Number.isInteger(instance.pid) || checkIsProcessAlive(instance.pid)
        );
    });
}

// Never falsy: an empty `browserUrl` makes chrome-devtools-mcp LAUNCH its own
// Chrome, which is the one thing this server must never do.
export const NO_APP_URL = 'http://127.0.0.1:1';

// The CDP port of the instance THIS process lives in, when it lives in one.
// The in-app host pins it; the stdio bin (its own process) never does. A
// getter, because Chromium reports the port only after `ready` and the host
// starts before that.
let getPinnedCdpPort = null;

/**
 * Pins every lookup in this process to one instance's CDP port. Without it
 * every session picks the NEWEST published instance, which is a different app
 * the moment a second one (a dev build beside the packaged app) starts later:
 * measured with the packaged app up and `npm run dev` started after it, the
 * packaged app's own chatbot reported -- and would have clicked in -- the dev
 * window. "Newest first" is right for an outside client and wrong for a
 * server that lives inside a particular instance. `getPort` may answer `null`
 * while the port is not known yet, in which case the fallbacks apply.
 */
export function pinCdpPort(getPort) {
    getPinnedCdpPort = typeof getPort === 'function' ? getPort : null;
}

function readPinnedCdpPort() {
    const port = Number(getPinnedCdpPort?.());
    return Number.isInteger(port) && port > 0 ? port : null;
}

/**
 * Which app to drive, best evidence first: the port pinned by the instance
 * this process lives in, then one pinned by `OWA_CDP_PORT`, then the newest
 * published instance.
 */
export function resolveAppBrowserUrl(instances = null) {
    const pinnedPort = readPinnedCdpPort();
    if (pinnedPort !== null) {
        return `http://127.0.0.1:${pinnedPort}`;
    }
    const envPort = Number(process.env.OWA_CDP_PORT);
    if (Number.isInteger(envPort) && envPort > 0) {
        return `http://127.0.0.1:${envPort}`;
    }
    const [instance] = instances ?? readLiveInstances();
    return instance ? `http://127.0.0.1:${instance.port}` : NO_APP_URL;
}

/**
 * A port named on purpose -- by the instance this process lives in, or by
 * `OWA_CDP_PORT` -- or null when nothing was named. The same order
 * `resolveAppBrowserUrl` reads, because the two must not disagree about which
 * app is being driven.
 */
function readExplicitCdpPort() {
    const pinnedPort = readPinnedCdpPort();
    if (pinnedPort !== null) {
        return pinnedPort;
    }
    const envPort = Number(process.env.OWA_CDP_PORT);
    return Number.isInteger(envPort) && envPort > 0 ? envPort : null;
}

/**
 * Ports to try, best first. `excludePorts` keeps a bridge from dialling its own
 * listener -- with the legacy fallback in the list that is an infinite loop.
 *
 * **A port named on purpose is the WHOLE list.** It used to head a list that
 * went on to every published instance and then the legacy fallbacks, and
 * `resolveCdpPort` takes the first that ANSWERS -- so a pin that had died fell
 * through in silence to whatever was published last. Seen 2026-09-14 with
 * three sessions on one dev app (`MC-30`): a dev app restarted by nodemon
 * comes back on a NEW port, and a script pinned to dev a minute earlier was
 * then driving the newest instance instead -- the PACKAGED app, with the
 * user's real data, had one been up. Meanwhile chrome-devtools' own tools read
 * `resolveAppBrowserUrl`, which has always been exclusive, so the two halves
 * of one server drove two different apps. Naming a port now means that port or
 * nothing, and `describeDeadPin` says what the app actually published.
 */
export function listCandidatePorts({ port, excludePorts = [] } = {}) {
    const ports = [];
    if (port) {
        ports.push(Number(port));
    } else {
        const explicitPort = readExplicitCdpPort();
        if (explicitPort !== null) {
            ports.push(explicitPort);
        } else {
            for (const instance of readLiveInstances()) {
                ports.push(instance.port);
            }
            ports.push(...FALLBACK_PORTS);
        }
    }
    return [...new Set(ports)].filter((candidate) => {
        return !excludePorts.includes(candidate);
    });
}

/**
 * Why nothing answered, when a port was named on purpose -- or null when none
 * was, in which case "no app is running" is the whole story. Written for the
 * person reading a failed script: the pin is theirs, and what the app
 * published is the number they need.
 */
export function describeDeadPin() {
    const explicitPort = readExplicitCdpPort();
    if (explicitPort === null) {
        return null;
    }
    const published = readLiveInstances().map((instance) => {
        return `${instance.port}${instance.isDev ? ' (dev)' : ''}`;
    });
    const source =
        readPinnedCdpPort() !== null ? 'this app instance' : 'OWA_CDP_PORT';
    return (
        `Port ${explicitPort} was named by ${source} and is not answering. ` +
        (published.length > 0
            ? `The app published ${published.join(', ')}. Point ` +
              'OWA_CDP_PORT at one of those, or unset it to take the newest.'
            : 'No running app has published a port at all.')
    );
}

export async function checkIsPortAlive(port, timeout = 1500) {
    for (const host of ['127.0.0.1', 'localhost']) {
        try {
            const res = await fetch(`http://${host}:${port}/json/version`, {
                signal: AbortSignal.timeout(timeout),
            });
            if (res.ok) {
                return true;
            }
        } catch {
            // Not up on this host; try the next one.
        }
    }
    return false;
}

/**
 * The first candidate port answering as a CDP endpoint, or null. `timeout > 0`
 * keeps polling until one appears -- an app still booting publishes nothing.
 */
export async function resolveCdpPort({
    port,
    excludePorts,
    timeout = 0,
    interval = 1000,
} = {}) {
    const deadline = Date.now() + timeout;
    for (;;) {
        for (const candidatePort of listCandidatePorts({
            port,
            excludePorts,
        })) {
            if (await checkIsPortAlive(candidatePort)) {
                return candidatePort;
            }
        }
        if (Date.now() >= deadline) {
            return null;
        }
        await new Promise((resolve) => {
            setTimeout(resolve, interval);
        });
    }
}

/**
 * A socket connected to a live endpoint, trying each candidate in turn.
 * Connecting IS the liveness check, which keeps a bridged connection down to
 * one round trip.
 */
export function connectToCdp(options = {}) {
    const candidatePorts = listCandidatePorts(options);
    return new Promise((resolve, reject) => {
        const connectNext = (index) => {
            if (index >= candidatePorts.length) {
                reject(
                    new Error(
                        'No running Open Worship App found ' +
                            `(tried ${candidatePorts.join(', ') || 'nothing'})`,
                    ),
                );
                return;
            }
            const socket = net.connect(candidatePorts[index], '127.0.0.1');
            socket.once('connect', () => {
                socket.removeAllListeners('error');
                resolve({ socket, port: candidatePorts[index] });
            });
            socket.once('error', () => {
                socket.destroy();
                connectNext(index + 1);
            });
        };
        connectNext(0);
    });
}
