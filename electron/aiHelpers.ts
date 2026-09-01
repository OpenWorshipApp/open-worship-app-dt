// Everything the app does to be drivable by an agent -- the in-app self-help
// chatbot first, an outside client (Claude Code, the robot-test skill) second.
//
// Two doors, both discovered through one file:
//
//   1. the CDP (remote debugging) endpoint, on a port Chromium picks;
//   2. `owa-devtools-mcp` over HTTP, on a preferred-but-not-guaranteed port.
//
// Both land in `<temp>/open-worship-app-cdp/<pid>.json`, one file per live
// instance. Nothing else in the app depends on this module: it is additive,
// and everything in it fails quietly, because a broken agent door must never
// be what stops a service.

import { app } from 'electron';
import { readFileSync, unlinkSync } from 'node:fs';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { isDev, toUnpackedPath } from './electronHelpers';

const REMOTE_DEBUGGING_PORT_ARG_PREFIX = '--owa-remote-debugging-port=';
const MCP_PORT_ARG_PREFIX = '--owa-mcp-port=';
const AI_INFO_DIR_NAME = 'open-worship-app-cdp';
// Chromium writes the port its DevTools handler actually bound into this file,
// inside whatever directory this process was given as its user data dir.
const DEVTOOLS_ACTIVE_PORT_FILE_NAME = 'DevToolsActivePort';

let isRemoteDebuggingEnabled = false;
let remoteDebuggingPort: number | null = null;
let mcpHost: McpHostType | null = null;

type McpHostType = {
    port: number;
    url: string;
    close: () => Promise<void>;
};

// `import()` survives here; TypeScript would turn a plain dynamic import into
// `require()` under `module: commonjs`, which cannot load an ESM graph that
// awaits at its top level.
const importEsm = new Function('specifier', 'return import(specifier);') as (
    specifier: string,
) => Promise<any>;

// The env var wins over the argv value for the same reason `OWA_USER_DATA_PATH`
// does: a jump list relaunch carries argv but no environment.
function getRequestedPort(envName: string, argPrefix: string) {
    const arg = process.argv.find((item) => {
        return item.startsWith(argPrefix);
    });
    const rawPort = process.env[envName] ?? arg?.slice(argPrefix.length);
    if (!rawPort) {
        return null;
    }
    const port = Number(rawPort);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
        return null;
    }
    return port;
}

// `clientSetting` in `<userData>/setting.json`, the store the renderer writes
// through `appHomeStorage`. Read straight off disk because the gate is needed
// BEFORE `ready` -- `ElectronSettingManager` does not exist yet, and the whole
// point of the switch is that nothing AI-shaped loads in a disabled process.
export const AI_ENABLED_SETTING_NAME = 'ai-enabled';

/**
 * What an install with nothing written yet does.
 *
 * OFF for a packaged build, ON for dev. The doors this switch opens are a CDP
 * endpoint and an MCP host, and anything that reaches either drives a renderer
 * with node integration -- on an operator's machine that is a local code
 * execution surface, and the decrypted API keys sit behind it. Nobody gets
 * that by upgrading: it is opted into in Settings -> Others, once, knowingly.
 * Dev is the machine of whoever is building the app and has always run with
 * the endpoint open, so it keeps that default.
 *
 * Read in the function body, never at module load: a module-load read of
 * another module's export is what makes a partial `vi.mock` blow up on import
 * rather than where the value is used.
 */
function checkIsAiEnabledByDefault() {
    return isDev;
}

export function checkIsAiEnabled() {
    try {
        const settingFilePath = path.join(
            app.getPath('userData'),
            'setting.json',
        );
        const json = JSON.parse(readFileSync(settingFilePath, 'utf-8'));
        const value = json?.clientSetting?.[AI_ENABLED_SETTING_NAME];
        if (value !== 'true' && value !== 'false') {
            return checkIsAiEnabledByDefault();
        }
        return value === 'true';
    } catch (_error) {
        return checkIsAiEnabledByDefault();
    }
}

function getDevToolsActivePortFilePath() {
    return path.join(app.getPath('userData'), DEVTOOLS_ACTIVE_PORT_FILE_NAME);
}

export function getAiInfoDirPath() {
    return path.join(app.getPath('temp'), AI_INFO_DIR_NAME);
}

function getAiInfoFilePath() {
    return path.join(getAiInfoDirPath(), `${process.pid}.json`);
}

/**
 * Opens the CDP endpoint on a port Chromium picks (`0` = any free one), so
 * instances that run side by side -- dev next to the packaged app, or several
 * dev instances aimed at different `OWA_USER_DATA_PATH`s -- never fight over
 * one hardcoded number, where the loser silently ends up with no endpoint at
 * all. `publishAiEndpoints` then makes the chosen port discoverable.
 * `OWA_REMOTE_DEBUGGING_PORT` / `--owa-remote-debugging-port=` pin it instead,
 * for a client that cannot read the published file.
 *
 * MUST be called BEFORE `ready`: Chromium reads these switches when it starts
 * the DevTools handler, so appending them from an async callback (an `await`ed
 * free-port lookup, say) loses that race often enough to look like a debugger
 * that randomly fails to attach.
 *
 * A packaged build CAN open it -- the in-app chatbot drives the app through it
 * wherever the app runs -- but only once the operator has switched AI features
 * on, because it is bound to `127.0.0.1` and anything already on this machine
 * that reaches it drives a renderer with node integration. Dev opens it
 * without being asked; see `checkIsAiEnabledByDefault`.
 */
export function enableRemoteDebugging() {
    if (!checkIsAiEnabled()) {
        return;
    }
    const requestedPort = getRequestedPort(
        'OWA_REMOTE_DEBUGGING_PORT',
        REMOTE_DEBUGGING_PORT_ARG_PREFIX,
    );
    // A leftover from a previous run would otherwise be read as this run's port.
    try {
        unlinkSync(getDevToolsActivePortFilePath());
    } catch (_error) {}
    app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
    app.commandLine.appendSwitch(
        'remote-debugging-port',
        (requestedPort ?? 0).toString(),
    );
    isRemoteDebuggingEnabled = true;
}

function readDevToolsActivePort() {
    try {
        const content = readFileSync(getDevToolsActivePortFilePath(), 'utf-8');
        const port = Number(content.split('\n')[0].trim());
        return Number.isInteger(port) && port > 0 ? port : null;
    } catch (_error) {
        return null;
    }
}

async function waitForDevToolsActivePort(timeoutMilliseconds: number) {
    const deadline = Date.now() + timeoutMilliseconds;
    for (;;) {
        const port = readDevToolsActivePort();
        if (port !== null || Date.now() >= deadline) {
            return port;
        }
        await new Promise((resolve) => {
            setTimeout(resolve, 200);
        });
    }
}

function checkIsProcessAlive(pid: number) {
    try {
        // Signal 0 only probes; it never touches the process.
        process.kill(pid, 0);
        return true;
    } catch (error: any) {
        // A running process owned by someone else answers EPERM, not ESRCH.
        return error?.code === 'EPERM';
    }
}

// A killed app never runs its `will-quit` cleanup, so its file would otherwise
// sit there forever and point an agent at a dead port.
async function sweepStaleAiInfo(dirPath: string) {
    try {
        const fileNames = await readdir(dirPath);
        await Promise.all(
            fileNames.map(async (fileName) => {
                const pid = Number(fileName.replace(/\.json$/, ''));
                if (
                    !Number.isInteger(pid) ||
                    pid === process.pid ||
                    checkIsProcessAlive(pid)
                ) {
                    return;
                }
                await rm(path.join(dirPath, fileName), { force: true });
            }),
        );
    } catch (_error) {}
}

function getMcpHostModulePath() {
    // `tools/` ships unpacked beside the asar so the ESM loader can read it.
    return toUnpackedPath(
        path.join(app.getAppPath(), 'tools', 'owa-devtools-mcp', 'host.mjs'),
    );
}

/**
 * Serves `owa-devtools-mcp` over HTTP for the in-app chatbot and any outside
 * client. Only `node:http` loads here -- the MCP machinery (and puppeteer
 * behind it) is pulled in by the host on the first session, so an app nobody
 * asks for help stays exactly as light as it was.
 */
export async function startMcpHost() {
    if (mcpHost !== null || !checkIsAiEnabled()) {
        return mcpHost;
    }
    try {
        // Where `build-knowledge.mjs` put the manual and the internal notes.
        // Passed in rather than guessed: the tools package cannot know whether
        // it is running from a checkout or from inside an asar.
        process.env.OWA_KNOWLEDGE_DIR = toUnpackedPath(
            path.join(app.getAppPath(), 'electron-build', 'knowledge'),
        );
        const { startOwaMcpHost } = await importEsm(
            pathToFileURL(getMcpHostModulePath()).toString(),
        );
        mcpHost = await startOwaMcpHost({
            port:
                getRequestedPort('OWA_MCP_PORT', MCP_PORT_ARG_PREFIX) ??
                undefined,
            logger: (...items: unknown[]) => {
                console.log('[owa-devtools-mcp]', ...items);
            },
        });
        return mcpHost;
    } catch (error) {
        console.log('Failed to start the MCP host:', error);
        return null;
    }
}

/**
 * Publishes both doors to `<temp>/open-worship-app-cdp/<pid>.json`. The temp
 * dir is the one place an agent can look without already knowing which data
 * directory this instance was launched with -- `OWA_USER_DATA_PATH` and
 * `--owa-user-data-path=` can point that anywhere.
 *
 * Call AFTER `ready`; the file Chromium writes appears as the DevTools handler
 * starts, so it is polled for rather than read once.
 */
export async function publishAiEndpoints(timeoutMilliseconds = 10 * 1000) {
    if (!isRemoteDebuggingEnabled) {
        return null;
    }
    try {
        const port = await waitForDevToolsActivePort(timeoutMilliseconds);
        if (port === null) {
            console.log('Remote debugging port was never reported by Chromium');
            return null;
        }
        remoteDebuggingPort = port;
        const dirPath = getAiInfoDirPath();
        // 0700: on Linux the temp dir is shared between every account on the
        // machine, and this file is the one thing that turns "there is an app
        // running somewhere" into the exact port that drives it.
        await mkdir(dirPath, { recursive: true, mode: 0o700 });
        await sweepStaleAiInfo(dirPath);
        const filePath = getAiInfoFilePath();
        await writeFile(
            filePath,
            JSON.stringify(
                {
                    pid: process.pid,
                    port,
                    url: `http://127.0.0.1:${port}`,
                    mcpUrl: mcpHost?.url ?? null,
                    isDev,
                    version: app.getVersion(),
                    userDataPath: app.getPath('userData'),
                    startedAt: new Date().toISOString(),
                },
                null,
                2,
            ),
            { mode: 0o600 },
        );
        app.on('will-quit', () => {
            try {
                unlinkSync(filePath);
            } catch (_error) {}
        });
        console.log(
            `Agent endpoints -- CDP: http://127.0.0.1:${port}` +
                `, MCP: ${mcpHost?.url ?? 'off'} -- published to ${filePath}`,
        );
        return port;
    } catch (error) {
        console.log('Failed to publish the agent endpoints:', error);
        return null;
    }
}

/**
 * Starts the MCP host, then publishes both doors. Fire-and-forget.
 *
 * With the feature switched off in Settings -> Others this returns before
 * anything AI-shaped is imported or listened on -- which is the point of the
 * switch: an operator on a low-spec machine can have a process with none of
 * it, at the cost of a restart.
 */
export async function initAi() {
    if (!checkIsAiEnabled()) {
        console.log('AI features are disabled in settings');
        return;
    }
    await startMcpHost();
    await publishAiEndpoints();
}

export function getRemoteDebuggingPort() {
    return remoteDebuggingPort;
}

export function getMcpUrl() {
    return mcpHost?.url ?? null;
}
