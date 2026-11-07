import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The window's door to the language plugins: the list from the main process
// (mocked IPC), the ONE language asked for loaded from a real factory file on
// disk -- the shape `extra-work/build-lang-plugins.mjs` writes.

const ipc = vi.hoisted(() => ({
    invoke: vi.fn(),
    sendSync: vi.fn(),
}));
vi.mock('electron', () => ({ ipcRenderer: ipc }));

import langUtils from './langUtils';
import {
    LANG_PLUGINS_CHANNEL,
    LANG_PLUGINS_DIR_CHANNEL,
} from '../langPluginProtocol';

let rootDir = '';

// A factory that answers with what it was handed, so a test can read the host.
const FACTORY_SOURCE = `module.exports = function (host) {
    const bound = [];
    host.onOpenLyricInternal(function (m) { bound.push(m); });
    globalThis.__owaLangTestLoads = (globalThis.__owaLangTestLoads || 0) + 1;
    return {
        langCode: host.langCode,
        packageDir: '',
        fontUrl: host.assetUrl('assets/font.ttf'),
        bundlePath: host.toFilePath('bb-cr.gz.bundle'),
        bound: bound,
        initOpenLyricPlugins: function (args) { return bound.length; },
        // What the build turns a plugin's \`new Worker(new URL(...))\` into.
        startWorker: function (rel) {
            return host.createWorker(new URL(host.assetUrl(rel)), { type: 'module' });
        },
    };
};
`;

function writePlugin(folderName: string, version: string) {
    const dirPath = path.join(rootDir, folderName);
    fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFileSync(path.join(dirPath, 'index.js'), FACTORY_SOURCE);
    fs.writeFileSync(
        path.join(dirPath, 'questions.json'),
        JSON.stringify({ version }),
    );
    return {
        langCode: 'xx',
        locale: 'xx-XX',
        version,
        dirPath,
        isEnabled: true,
    };
}

beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'owa-lang-utils-'));
    ipc.invoke.mockReset();
    ipc.sendSync.mockReset();
    (globalThis as any).__owaLangTestLoads = 0;
});

afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
    delete (globalThis as any).__owaLangTestLoads;
});

describe('langUtils', () => {
    test('lists what the main process found, and nothing when it fails', async () => {
        const plugin = writePlugin('xx', '1.0.0');
        ipc.invoke.mockResolvedValueOnce([plugin]);
        await expect(langUtils.getLangPlugins()).resolves.toEqual([plugin]);
        expect(ipc.invoke).toHaveBeenCalledWith(LANG_PLUGINS_CHANNEL);
        ipc.invoke.mockRejectedValueOnce(new Error('no main'));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        await expect(langUtils.getLangPlugins()).resolves.toEqual([]);
        ipc.invoke.mockResolvedValueOnce('junk');
        await expect(langUtils.getLangPlugins()).resolves.toEqual([]);
    });

    test('loads the language asked for once, with its assets on the app origin', async () => {
        const plugin = writePlugin('xx', '1.0.0');
        ipc.invoke.mockResolvedValue([plugin]);
        const data = await langUtils.getLangData('xx');
        expect(data.fontUrl).toBe('owa://local/@lang/xx/assets/font.ttf');
        expect(data.bundlePath).toBe(
            path.join(plugin.dirPath, 'bb-cr.gz.bundle'),
        );
        expect(data.packageDir).toBe(plugin.dirPath);
        // The same copy is not loaded twice.
        await expect(langUtils.getLangData('xx')).resolves.toBe(data);
        expect((globalThis as any).__owaLangTestLoads).toBe(1);
        await expect(langUtils.getLangData('zz')).resolves.toBeNull();
    });

    test('an updated copy is a new load', async () => {
        const first = writePlugin('xx@1.0.0', '1.0.0');
        ipc.invoke.mockResolvedValue([first]);
        const oldData = await langUtils.getLangData('xx');
        const second = writePlugin('xx@1.0.1', '1.0.1');
        ipc.invoke.mockResolvedValue([second]);
        const newData = await langUtils.getLangData('xx');
        expect(newData).not.toBe(oldData);
        expect(newData.bundlePath).toBe(
            path.join(second.dirPath, 'bb-cr.gz.bundle'),
        );
    });

    test("the Open Lyric half is bound to the window's own registry first", async () => {
        const plugin = writePlugin('xx@2', '2.0.0');
        ipc.invoke.mockResolvedValue([plugin]);
        const data = await langUtils.getLangData('xx');
        expect(() => data.initOpenLyricPlugins({})).toThrow(
            /needs `openLyricInternal`/,
        );
        const registry = { registerPlugin: () => {} };
        expect(data.initOpenLyricPlugins({ openLyricInternal: registry })).toBe(
            1,
        );
        // Bound once, however often the window initializes the plugins.
        data.initOpenLyricPlugins({ openLyricInternal: registry });
        expect(data.bound).toEqual([registry]);
    });

    test("a plugin's worker starts from the window's own origin, as a blob when the window is elsewhere", async () => {
        const plugin = writePlugin('xx@4', '4.0.0');
        fs.mkdirSync(path.join(plugin.dirPath, 'assets'));
        const workerSource = 'self.onmessage = () => {};';
        fs.writeFileSync(
            path.join(plugin.dirPath, 'assets', 'spell.worker.js'),
            workerSource,
        );
        ipc.invoke.mockResolvedValue([plugin]);
        const data = await langUtils.getLangData('xx');
        const started: { url: string; options: unknown }[] = [];
        vi.stubGlobal(
            'Worker',
            class {
                constructor(url: string | URL, options: unknown) {
                    started.push({ url: String(url), options });
                }
            },
        );
        try {
            // Packaged: the page and the plugin are both on `owa://local`.
            vi.stubGlobal('location', { origin: 'owa://local' });
            data.startWorker('assets/spell.worker.js');
            expect(started[0]).toEqual({
                url: 'owa://local/@lang/xx/assets/spell.worker.js',
                options: { type: 'module' },
            });
            // Dev: `https://localhost:3000` may not start a worker from
            // `owa://local` (same-origin rule, `worker-src 'self' blob:`).
            vi.stubGlobal('location', { origin: 'https://localhost:3000' });
            data.startWorker('assets/spell.worker.js');
            data.startWorker('assets/spell.worker.js');
            expect(started[1].url).toMatch(/^blob:/);
            expect(started[1].options).toEqual({ type: 'module' });
            // One copy of the script, reused.
            expect(started[2].url).toBe(started[1].url);
            const { resolveObjectURL } = await import('node:buffer');
            await expect(
                resolveObjectURL(started[1].url)?.text(),
            ).resolves.toBe(workerSource);
        } finally {
            vi.unstubAllGlobals();
        }
    });

    test('reads a json file of the plugin, and no other kind of path', async () => {
        const plugin = writePlugin('xx', '3.0.0');
        ipc.invoke.mockResolvedValue([plugin]);
        await expect(
            langUtils.readLangPluginJson('xx', 'questions.json'),
        ).resolves.toEqual({ version: '3.0.0' });
        await expect(
            langUtils.readLangPluginJson('xx', '../meta.json'),
        ).resolves.toBeNull();
        await expect(
            langUtils.readLangPluginJson('xx', 'index.js'),
        ).resolves.toBeNull();
        await expect(
            langUtils.readLangPluginJson('xx', 'missing.json'),
        ).resolves.toBeNull();
    });

    test('says where installed languages go', () => {
        ipc.sendSync.mockReturnValueOnce('/data/lang');
        expect(langUtils.getLangPluginsDirPath()).toBe('/data/lang');
        expect(ipc.sendSync).toHaveBeenCalledWith(LANG_PLUGINS_DIR_CHANNEL);
        ipc.sendSync.mockReturnValueOnce(undefined);
        expect(langUtils.getLangPluginsDirPath()).toBeNull();
    });
});
