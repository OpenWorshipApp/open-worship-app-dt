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
    publishAiEndpoints,
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
});
