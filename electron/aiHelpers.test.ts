import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { mkdir, readdir, rm, writeFile } = vi.hoisted(() => ({
    mkdir: vi.fn(),
    readdir: vi.fn(),
    rm: vi.fn(),
    writeFile: vi.fn(),
}));

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

vi.mock('node:fs/promises', () => ({ mkdir, readdir, rm, writeFile }));

import {
    checkIsAiEnabled,
    enableRemoteDebugging,
    getMcpToken,
    getMcpUrl,
    getRemoteDebuggingPort,
    initAi,
    publishAiEndpoints,
    startMcpHost,
} from './aiHelpers';
import { electronMockState } from './testElectronModule';

// `readFileSync`/`unlinkSync` are deliberately NOT mocked: the module reads
// files Chromium and the settings store write, so a real directory is the
// honest fixture.
let dirPath = '';

function writeSetting(value: unknown) {
    writeFileSync(
        path.join(dirPath, 'setting.json'),
        JSON.stringify({ clientSetting: { 'ai-enabled': value } }),
    );
}

describe('aiHelpers', () => {
    beforeEach(() => {
        electronMockState.reset();
        dirPath = mkdtempSync(path.join(tmpdir(), 'owa-ai-test-'));
        electronMockState.app.getPath.mockReturnValue(dirPath);
        mkdir.mockReset();
        mkdir.mockResolvedValue(undefined);
        readdir.mockReset();
        readdir.mockResolvedValue([]);
        rm.mockReset();
        rm.mockResolvedValue(undefined);
        writeFile.mockReset();
        writeFile.mockResolvedValue(undefined);
        delete process.env.OWA_REMOTE_DEBUGGING_PORT;
    });

    afterEach(() => {
        rmSync(dirPath, { recursive: true, force: true });
    });

    // Every preload reaches this module (electronHelpers -> webCaptureHelpers),
    // and a page whose CSP has no 'unsafe-eval' -- chatbot.html in dev, EVERY
    // page in a packaged build -- throws on a string evaluated while it loads.
    // It did: the chatbot opened on "Standing by" with no provider (2026-09-18).
    test('loading it evaluates no string, so a strict page CSP survives', async () => {
        vi.resetModules();
        const RealFunction = globalThis.Function;
        const evaluated: string[] = [];
        const refuse = (_target: unknown, args: unknown[]) => {
            evaluated.push(String(args[args.length - 1]));
            throw new EvalError('refused by the page CSP');
        };
        globalThis.Function = new Proxy(RealFunction, {
            construct: refuse,
            apply: (target, _self, args) => refuse(target, args),
        });
        let caught: unknown = null;
        try {
            await import('./aiHelpers');
            // The net is shown to catch one the way module code writes it,
            // or the empty list below would prove nothing.
            try {
                new Function('return 1');
            } catch (error) {
                caught = error;
            }
        } finally {
            globalThis.Function = RealFunction;
        }
        expect(caught).toBeInstanceOf(EvalError);
        expect(evaluated).toEqual(['return 1']);
    });

    // The doors this opens drive a renderer with node integration, so an
    // install that has never been asked gets none of them. Nobody acquires a
    // local code execution surface by upgrading; they opt in, once, knowingly.
    test('an absent setting leaves the feature OFF in a packaged build', () => {
        expect(checkIsAiEnabled()).toBe(false);
        writeFileSync(path.join(dirPath, 'setting.json'), '{}');
        expect(checkIsAiEnabled()).toBe(false);
        // ...including a setting file that cannot be read at all.
        writeFileSync(path.join(dirPath, 'setting.json'), 'not json');
        expect(checkIsAiEnabled()).toBe(false);
    });

    test('an absent setting leaves it ON in dev', async () => {
        vi.resetModules();
        vi.stubEnv('NODE_ENV', 'development');
        try {
            const devModule = await import('./aiHelpers');
            expect(devModule.checkIsAiEnabled()).toBe(true);
        } finally {
            vi.unstubAllEnvs();
            vi.resetModules();
        }
    });

    test('an explicit choice wins over either default', () => {
        writeSetting('true');
        expect(checkIsAiEnabled()).toBe(true);
        writeSetting('false');
        expect(checkIsAiEnabled()).toBe(false);
    });

    test('a value that is neither falls back to the default', () => {
        writeSetting('yes');
        expect(checkIsAiEnabled()).toBe(false);
    });

    test('opens the endpoint on a Chromium-picked port', () => {
        writeSetting('true');

        enableRemoteDebugging();

        const { appendSwitch } = electronMockState.app.commandLine;
        expect(appendSwitch).toHaveBeenCalledWith(
            'remote-debugging-address',
            '127.0.0.1',
        );
        // `0` = any free port, so two instances never fight over one number.
        expect(appendSwitch).toHaveBeenCalledWith('remote-debugging-port', '0');
    });

    test('a pinned port is honoured', () => {
        writeSetting('true');
        process.env.OWA_REMOTE_DEBUGGING_PORT = '9223';

        enableRemoteDebugging();

        expect(
            electronMockState.app.commandLine.appendSwitch,
        ).toHaveBeenCalledWith('remote-debugging-port', '9223');
    });

    test('the switch off means no endpoint at all', async () => {
        writeSetting('false');

        enableRemoteDebugging();

        expect(
            electronMockState.app.commandLine.appendSwitch,
        ).not.toHaveBeenCalled();
        // ... and nothing to publish, so no agent ever finds this instance.
        await expect(publishAiEndpoints(0)).resolves.toBe(null);
        expect(writeFile).not.toHaveBeenCalled();
    });

    test('publishes the port Chromium reported', async () => {
        writeSetting('true');
        enableRemoteDebugging();
        writeFileSync(
            path.join(dirPath, 'DevToolsActivePort'),
            '51234\n/devtools/browser/abc',
        );

        const port = await publishAiEndpoints(0);

        expect(port).toBe(51234);
        const [filePath, content] = writeFile.mock.calls[0];
        expect(filePath).toContain('open-worship-app-cdp');
        expect(filePath).toContain(`${process.pid}.json`);
        expect(JSON.parse(content as string)).toMatchObject({
            pid: process.pid,
            port: 51234,
            url: 'http://127.0.0.1:51234',
        });
    });

    test('gives up quietly when Chromium never reports one', async () => {
        writeSetting('true');
        enableRemoteDebugging();

        await expect(publishAiEndpoints(0)).resolves.toBe(null);
        expect(writeFile).not.toHaveBeenCalled();
    });

    test('waits briefly for Chromium to report its port', async () => {
        writeSetting('true');
        enableRemoteDebugging();
        vi.useFakeTimers();

        const resultPromise = publishAiEndpoints(201);
        await vi.advanceTimersByTimeAsync(400);

        await expect(resultPromise).resolves.toBeNull();
        vi.useRealTimers();
    });

    test('starts one lazy MCP host and exposes its discovery credentials', async () => {
        writeSetting('true');
        process.env.OWA_MCP_PORT = '43123';
        const host = {
            port: 43123,
            url: 'http://127.0.0.1:43123/mcp',
            token: 'secret-token',
            close: vi.fn(),
        };
        const startOwaMcpHost = vi.fn().mockResolvedValue(host);
        const RealFunction = globalThis.Function;
        globalThis.Function = new Proxy(RealFunction, {
            construct: () => async () => ({ startOwaMcpHost }),
        });
        vi.resetModules();
        try {
            const fresh = await import('./aiHelpers');
            await expect(fresh.startMcpHost()).resolves.toBe(host);
            await expect(fresh.startMcpHost()).resolves.toBe(host);
            expect(startOwaMcpHost).toHaveBeenCalledTimes(1);
            expect(startOwaMcpHost).toHaveBeenCalledWith(
                expect.objectContaining({
                    port: 43123,
                    getCdpPort: expect.any(Function),
                    logger: expect.any(Function),
                }),
            );
            expect(process.env.OWA_KNOWLEDGE_DIR).toContain(
                path.join('electron-build', 'knowledge'),
            );
            expect(fresh.getMcpUrl()).toBe(host.url);
            expect(fresh.getMcpToken()).toBe(host.token);
            expect(fresh.getRemoteDebuggingPort()).toBeNull();
            await fresh.initAi();
        } finally {
            globalThis.Function = RealFunction;
            delete process.env.OWA_MCP_PORT;
            delete process.env.OWA_KNOWLEDGE_DIR;
        }
    });

    test('fails closed when the lazy MCP module cannot start', async () => {
        writeSetting('true');
        const RealFunction = globalThis.Function;
        globalThis.Function = new Proxy(RealFunction, {
            construct: () => async () => {
                throw new Error('module unavailable');
            },
        });
        vi.resetModules();
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});
        try {
            const fresh = await import('./aiHelpers');
            await expect(fresh.startMcpHost()).resolves.toBeNull();
            expect(log).toHaveBeenCalledWith(
                'Failed to start the MCP host:',
                expect.any(Error),
            );
        } finally {
            globalThis.Function = RealFunction;
        }
    });

    test('publishes the MCP details and removes stale discovery files', async () => {
        writeSetting('true');
        const host = {
            port: 43124,
            url: 'http://127.0.0.1:43124/mcp',
            token: 'published-token',
            close: vi.fn(),
        };
        const startOwaMcpHost = vi.fn().mockResolvedValue(host);
        const RealFunction = globalThis.Function;
        globalThis.Function = new Proxy(RealFunction, {
            construct: () => async () => ({ startOwaMcpHost }),
        });
        vi.resetModules();
        const kill = vi.spyOn(process, 'kill').mockImplementation((pid) => {
            if (pid === 11111) {
                const error = new Error('not allowed') as NodeJS.ErrnoException;
                error.code = 'EPERM';
                throw error;
            }
            if (pid === 22222) {
                const error = new Error('gone') as NodeJS.ErrnoException;
                error.code = 'ESRCH';
                throw error;
            }
            return true;
        });
        vi.spyOn(console, 'log').mockImplementation(() => {});
        try {
            const fresh = await import('./aiHelpers');
            await fresh.startMcpHost();
            fresh.enableRemoteDebugging();
            writeFileSync(
                path.join(dirPath, 'DevToolsActivePort'),
                '51235\n/devtools/browser/def',
            );
            readdir.mockResolvedValue([
                'not-a-pid.json',
                `${process.pid}.json`,
                '11111.json',
                '22222.json',
            ]);

            await expect(fresh.publishAiEndpoints(0)).resolves.toBe(51235);

            expect(rm).toHaveBeenCalledWith(
                expect.stringContaining(path.join('', '22222.json')),
                { force: true },
            );
            expect(rm).toHaveBeenCalledTimes(1);
            const published = JSON.parse(writeFile.mock.calls[0][1] as string);
            expect(published).toMatchObject({
                port: 51235,
                mcpUrl: host.url,
                mcpToken: host.token,
            });
            expect(fresh.getRemoteDebuggingPort()).toBe(51235);
            const logger = startOwaMcpHost.mock.calls[0][0].logger;
            logger('ready');
            expect(console.log).toHaveBeenCalledWith(
                '[owa-devtools-mcp]',
                'ready',
            );
        } finally {
            globalThis.Function = RealFunction;
            kill.mockRestore();
        }
    });

    test('contains endpoint publication failures and disabled initialization', async () => {
        writeSetting('true');
        enableRemoteDebugging();
        writeFileSync(path.join(dirPath, 'DevToolsActivePort'), '51236\npath');
        mkdir.mockRejectedValueOnce(new Error('read-only temp'));
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});

        await expect(publishAiEndpoints(0)).resolves.toBeNull();
        expect(log).toHaveBeenCalledWith(
            'Failed to publish the agent endpoints:',
            expect.any(Error),
        );

        writeSetting('false');
        await expect(initAi()).resolves.toBeUndefined();
        expect(log).toHaveBeenCalledWith(
            'AI features are disabled in settings',
        );
        expect(getMcpUrl()).toBeNull();
        expect(getMcpToken()).toBeNull();
        expect(getRemoteDebuggingPort()).toBe(51236);
        await expect(startMcpHost()).resolves.toBeNull();
    });
});
