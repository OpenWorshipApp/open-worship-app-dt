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

import { compareAppVersions, readMcpVersion } from './mcpVersion.mjs';

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

// Which app an OUTSIDE agent works with when several are running (2026-11-13,
// the user: _make mcp to list for choice when found multiple running app_,
// _this machine running 3 instances of open worship app so the mcp should
// check and let user pick one to work with_). "Newest first" had picked for
// them, in silence -- with the packaged app up, a dev window started after it
// was driven, and the other way round a press meant for the dev app could
// land in the one holding the church's real data. The stdio server turns
// this on (`requireAppChoice`); the in-app host is pinned to its own
// instance, and scripts that import these functions keep newest-first.
let isAppChoiceRequired = false;
// The app chosen with `owa_choose_app`, for the life of this process (the
// stdio server is one client's): its pid, and its profile and kind so a
// restart -- nodemon, or the person -- is followed to the same app.
let chosenInstance = null;

/** Several running apps are listed for a choice instead of driving the newest. */
export function requireAppChoice(isRequired = true) {
    isAppChoiceRequired = isRequired === true;
}

/** Works with `instance` (a published record) from now on; null forgets. */
export function chooseAppInstance(instance) {
    chosenInstance =
        instance === null || instance === undefined
            ? null
            : {
                  pid: instance.pid,
                  userDataPath: instance.userDataPath ?? null,
                  isDev: instance.isDev === true,
              };
}

export function readChosenAppInstance() {
    return chosenInstance;
}

/**
 * The chosen app as it runs now: the same process, else the ONE live
 * instance of its kind on its profile (it was restarted). Null when it is
 * gone -- never another app in its place.
 */
function findChosenLiveInstance(instances) {
    if (chosenInstance === null) {
        return null;
    }
    const same = instances.find((instance) => {
        return instance.pid === chosenInstance.pid;
    });
    if (same !== undefined) {
        return same;
    }
    if (chosenInstance.userDataPath === null) {
        return null;
    }
    const restartedList = instances.filter((instance) => {
        return (
            instance.userDataPath === chosenInstance.userDataPath &&
            (instance.isDev === true) === chosenInstance.isDev
        );
    });
    if (restartedList.length !== 1) {
        return null;
    }
    chosenInstance = { ...chosenInstance, pid: restartedList[0].pid };
    return restartedList[0];
}

/**
 * The published app this process works with when no port is named:
 * `{instance}`, or `{instance: null, isChoicePending: true, instances}` when
 * several are running and none was chosen, or `{instance: null, isChosenGone:
 * true}` when the chosen one quit.
 */
function pickPublishedInstance(liveInstances) {
    const targetInstances = filterTargetInstances(
        liveInstances,
        readCdpTarget(),
    );
    if (chosenInstance !== null) {
        const instance = findChosenLiveInstance(targetInstances);
        return instance === null
            ? { instance: null, isChosenGone: true, instances: targetInstances }
            : { instance };
    }
    if (isAppChoiceRequired && targetInstances.length > 1) {
        return {
            instance: null,
            isChoicePending: true,
            instances: targetInstances,
        };
    }
    return { instance: targetInstances[0] ?? null };
}

/** The apps a choice is made among: live, of the kind asked for, newest first. */
export function listChoosableInstances() {
    return filterTargetInstances(readLiveInstances(), readCdpTarget());
}

/** A folder's last name: the profile, without the account name above it. */
function toProfileName(userDataPath) {
    if (typeof userDataPath !== 'string' || userDataPath === '') {
        return null;
    }
    return userDataPath.split(/[\\/]+/).filter(Boolean).pop() ?? null;
}

function toStartedText(startedAt) {
    const date = new Date(startedAt);
    return Number.isNaN(date.getTime())
        ? null
        : `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/**
 * One running app as a person tells them apart: the pid to choose it by,
 * the kind, the version against this server's, the profile and the start.
 * The profile is the data folder's own name only -- the path above it holds
 * the account name.
 */
export function toAppChoiceRow(instance, { drivenPid = null } = {}) {
    const mcpVersion = readMcpVersion();
    const order = compareAppVersions(mcpVersion, instance.version);
    return {
        pid: instance.pid,
        kind: instance.isDev === true ? 'development' : 'installed app',
        version: instance.version ?? null,
        isSameVersionAsMcp: order === null ? null : order === 0,
        profile: toProfileName(instance.userDataPath),
        startedAt: toStartedText(instance.startedAt),
        ...(drivenPid !== null && instance.pid === drivenPid
            ? { isWorkedWith: true }
            : {}),
    };
}

function toAppChoiceLine(row, index) {
    const parts = [
        `pid ${row.pid}`,
        row.kind,
        row.version === null ? 'version unknown' : `version ${row.version}`,
    ];
    if (row.profile !== null) {
        parts.push(`profile "${row.profile}"`);
    }
    if (row.startedAt !== null) {
        parts.push(`started ${row.startedAt}`);
    }
    if (index === 0) {
        parts.push('the newest');
    }
    if (row.isSameVersionAsMcp === false) {
        parts.push('NOT the version of this MCP server');
    }
    return `- ${parts.join(', ')}`;
}

/** The running apps as lines, newest first. */
export function describeAppChoiceList(instances) {
    return instances
        .map((instance, index) => {
            return toAppChoiceLine(toAppChoiceRow(instance), index);
        })
        .join('\n');
}

// An app with AI features off opens neither door and publishes nothing, so a
// person counting windows may count one the list cannot have.
const UNLISTED_APP_NOTE =
    'An app with its AI features turned off is not listed: it opens no ' +
    'door for an agent.';

/**
 * Why no app is worked with although some are running: several and none
 * chosen, or the chosen one quit. Null when there is an app to work with, or
 * the reason is something else (no app at all, a dead pin).
 */
export function describeAppChoiceProblem(liveInstances = null) {
    if (readExplicitCdpPort() !== null) {
        return null;
    }
    const picked = pickPublishedInstance(liveInstances ?? readLiveInstances());
    if (picked.isChoicePending === true) {
        return (
            `${picked.instances.length} Open Worship apps are running, and ` +
            'this MCP server works with one at a time. Ask the user which ' +
            'one to work with (name each by its profile, kind and version), ' +
            'then call owa_choose_app with its pid. Nothing was done in any ' +
            'of them.\n' +
            describeAppChoiceList(picked.instances) +
            `\n${UNLISTED_APP_NOTE}`
        );
    }
    if (picked.isChosenGone === true) {
        const others =
            picked.instances.length > 0
                ? `Running now:\n${describeAppChoiceList(picked.instances)}\n` +
                  'Ask the user which one to work with, then call ' +
                  'owa_choose_app with its pid.'
                : 'No other Open Worship app is running.';
        return (
            `The app chosen with owa_choose_app (pid ${chosenInstance.pid}) ` +
            'is no longer running, and no other app was taken in its place. ' +
            others
        );
    }
    return null;
}

/** Whether a tool that needs the app must wait for a choice first. */
export function checkIsAppChoiceProblem() {
    return describeAppChoiceProblem() !== null;
}

/**
 * Which app to drive, best evidence first: the port pinned by the instance
 * this process lives in, then one pinned by `OWA_CDP_PORT`, then the newest
 * published instance of the requested kind (or any kind when unset).
 */
export function resolveAppBrowserUrl(instances = null) {
    const explicitPort = readExplicitCdpPort();
    if (explicitPort !== null) {
        return `http://127.0.0.1:${explicitPort}`;
    }
    const { instance } = pickPublishedInstance(
        instances ?? readLiveInstances(),
    );
    return instance ? `http://127.0.0.1:${instance.port}` : NO_APP_URL;
}

/**
 * The published instance `resolveAppBrowserUrl` drives, or null: the one on
 * the port named on purpose, else the newest of the requested kind. Read
 * afresh per call, like the address.
 */
export function findDrivenInstance(instances = null) {
    const liveInstances = instances ?? readLiveInstances();
    const explicitPort = readExplicitCdpPort();
    if (explicitPort !== null) {
        return (
            liveInstances.find((instance) => {
                return instance.port === explicitPort;
            }) ?? null
        );
    }
    return pickPublishedInstance(liveInstances).instance;
}

// A kind pin survives a restart without ever selecting the other kind. Read
// it and discovery afresh per lookup; neither ports nor instances are cached.
function readCdpTarget() {
    const target = process.env.OWA_CDP_TARGET;
    if (target === undefined || target === '') {
        return null;
    }
    if (target !== 'dev' && target !== 'prod') {
        throw new Error(
            'OWA_CDP_TARGET must be dev or prod; unset it to select any running app.',
        );
    }
    return target;
}

function filterTargetInstances(instances, target) {
    return target === null
        ? instances
        : instances.filter((instance) => {
              // A missing/unknown kind is not evidence that an instance is prod.
              return instance.isDev === (target === 'dev');
          });
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
            const target = readCdpTarget();
            const liveInstances = readLiveInstances();
            const picked = pickPublishedInstance(liveInstances);
            if (picked.isChoicePending === true || picked.isChosenGone === true) {
                // Several and none chosen, or the chosen one quit: no port,
                // so the caller reads `describeDeadPin`'s list -- never the
                // newest in silence, nor the legacy port.
            } else if (chosenInstance !== null) {
                ports.push(picked.instance.port);
            } else {
                for (const instance of filterTargetInstances(
                    liveInstances,
                    target,
                )) {
                    ports.push(instance.port);
                }
                // The legacy port carries no instance kind, so it cannot
                // satisfy a kind pin even when no matching published app is
                // available.
                if (target === null) {
                    ports.push(...FALLBACK_PORTS);
                }
            }
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
        const choiceProblem = describeAppChoiceProblem();
        if (choiceProblem !== null) {
            return choiceProblem;
        }
        const target = readCdpTarget();
        return target === null
            ? null
            : `No responding ${target} app was found for OWA_CDP_TARGET=${target}. ` +
                  `Start a ${target === 'dev' ? 'development' : 'packaged'} app with AI features enabled; ` +
                  'other instance kinds and legacy ports are not tried.';
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
                        describeDeadPin() ??
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
