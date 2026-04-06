/* eslint-disable */

import { spawn } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

const AGENT_DEBUG_URL = 'http://127.0.0.1:47831/health';
const VITE_DEV_URL = 'https://127.0.0.1:3000/presenter.html';
const WAITING_INTERVAL_MS = 500;
const WAITING_TIMEOUT_MS = 30_000;

function getNpmCommand() {
    return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function delay(timeMs) {
    return new Promise((resolve) => {
        setTimeout(resolve, timeMs);
    });
}

function requestUrl(url, { insecure = false, timeout = 2_000 } = {}) {
    return new Promise((resolve) => {
        const urlObject = new URL(url);
        const request = (
            urlObject.protocol === 'https:' ? httpsRequest : httpRequest
        )(
            urlObject,
            urlObject.protocol === 'https:'
                ? {
                      rejectUnauthorized: !insecure,
                  }
                : undefined,
            (response) => {
                let body = '';
                response.setEncoding('utf8');
                response.on('data', (chunk) => {
                    body += chunk;
                });
                response.on('end', () => {
                    resolve({
                        statusCode: response.statusCode ?? 0,
                        body,
                    });
                });
            },
        );
        request.on('error', () => {
            resolve(null);
        });
        request.setTimeout(timeout, () => {
            request.destroy();
            resolve(null);
        });
        request.end();
    });
}

async function checkIsAgentDebugRunning() {
    const response = await requestUrl(AGENT_DEBUG_URL);
    if (response === null) {
        return false;
    }
    return response.statusCode >= 200 && response.statusCode < 300;
}

async function checkIsViteDevServerRunning() {
    const response = await requestUrl(VITE_DEV_URL, {
        insecure: true,
    });
    if (response === null) {
        return false;
    }
    return response.statusCode >= 200 && response.statusCode < 500;
}

function runNpmCommand(args, env = process.env, stdio = 'inherit') {
    return new Promise((resolve, reject) => {
        const childProcess = spawn(getNpmCommand(), args, {
            env,
            stdio,
        });
        childProcess.once('error', reject);
        childProcess.once('exit', (code, signal) => {
            resolve({ code, signal, childProcess });
        });
    });
}

async function startViteDevServer() {
    const childProcess = spawn(
        getNpmCommand(),
        [
            'run',
            'vite:dev',
            '--',
            '--host',
            '127.0.0.1',
            '--port',
            '3000',
            '--strictPort',
        ],
        {
            env: process.env,
            stdio: 'inherit',
        },
    );
    childProcess.once('error', (error) => {
        console.error('[dev:agent] Failed to start Vite dev server:', error);
    });
    const timeoutAt = Date.now() + WAITING_TIMEOUT_MS;
    while (Date.now() < timeoutAt) {
        if (childProcess.exitCode !== null) {
            throw new Error('Vite dev server exited before it became ready');
        }
        if (await checkIsViteDevServerRunning()) {
            return childProcess;
        }
        await delay(WAITING_INTERVAL_MS);
    }
    throw new Error('Timed out waiting for the Vite dev server on port 3000');
}

function stopChildProcess(childProcess) {
    if (childProcess?.exitCode !== null) {
        return;
    }
    childProcess.kill('SIGTERM');
}

async function main() {
    if (await checkIsAgentDebugRunning()) {
        console.log(
            '[dev:agent] Agent debug server is already running at http://127.0.0.1:47831',
        );
        return;
    }

    const electronEnv = {
        ...process.env,
        OPEN_WORSHIP_AGENT_DEBUG: '1',
    };
    let startedViteDevServer = null;
    const cleanup = () => {
        stopChildProcess(startedViteDevServer);
    };
    process.once('SIGINT', () => {
        cleanup();
        process.exit(130);
    });
    process.once('SIGTERM', () => {
        cleanup();
        process.exit(143);
    });

    try {
        const isViteReady = await checkIsViteDevServerRunning();
        if (isViteReady) {
            console.log(
                '[dev:agent] Reusing the existing Vite dev server on https://127.0.0.1:3000',
            );
        } else {
            console.log(
                '[dev:agent] Starting a Vite dev server on https://127.0.0.1:3000',
            );
            startedViteDevServer = await startViteDevServer();
        }

        const buildResult = await runNpmCommand(['run', 'electron:build']);
        if ((buildResult.code ?? 1) !== 0) {
            process.exit(buildResult.code ?? 1);
        }

        const electronResult = await runNpmCommand(
            ['run', 'electron'],
            electronEnv,
        );
        const isAgentDebugRunning = await checkIsAgentDebugRunning();
        if ((electronResult.code ?? 0) === 0 && !isAgentDebugRunning) {
            console.error(
                '[dev:agent] Electron exited before the agent debug server became available. ' +
                    'If another app instance is already running without agent debug, close it and rerun this command.',
            );
            process.exit(1);
        }
        process.exit(electronResult.code ?? 0);
    } finally {
        cleanup();
    }
}

try {
    await main();
} catch (error) {
    console.error('[dev:agent]', error instanceof Error ? error.message : error);
    process.exit(1);
}
