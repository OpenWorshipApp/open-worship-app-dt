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

/**
 * Ports to try, best first. `excludePorts` keeps a bridge from dialling its own
 * listener -- with the legacy fallback in the list that is an infinite loop.
 */
export function listCandidatePorts({ port, excludePorts = [] } = {}) {
    const ports = [];
    if (port) {
        ports.push(Number(port));
    } else {
        const envPort = Number(process.env.OWA_CDP_PORT);
        if (Number.isInteger(envPort) && envPort > 0) {
            ports.push(envPort);
        }
        for (const instance of readLiveInstances()) {
            ports.push(instance.port);
        }
        ports.push(...FALLBACK_PORTS);
    }
    return [...new Set(ports)].filter((candidate) => {
        return !excludePorts.includes(candidate);
    });
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
        for (const candidatePort of listCandidatePorts({ port, excludePorts })) {
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
