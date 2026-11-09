import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The guards around a language plugin's entry file: one that is not a
// factory, one that answers no data, one with no Open Lyric half, and a JSON
// file asked of a language that is not installed.

const ipc = vi.hoisted(() => ({
    invoke: vi.fn(),
    sendSync: vi.fn(),
}));
vi.mock('electron', () => ({ ipcRenderer: ipc }));

import langUtils from './langUtils';
import { LANG_PLUGIN_ENTRY_FILE_NAME } from '../langPluginProtocol';

let rootDir = '';

function writePlugin(langCode: string, entrySource: string) {
    const dirPath = path.join(rootDir, `${langCode}@1.0.0`);
    fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFileSync(
        path.join(dirPath, LANG_PLUGIN_ENTRY_FILE_NAME),
        entrySource,
    );
    fs.writeFileSync(
        path.join(dirPath, 'questions.json'),
        JSON.stringify({ rows: 1 }),
    );
    return {
        langCode,
        locale: `${langCode}-XX`,
        version: '1.0.0',
        dirPath,
        isEnabled: true,
    };
}

beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'owa-lang-utils-ut100-'));
    ipc.invoke.mockReset();
    ipc.sendSync.mockReset();
});

afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
});

describe('langUtils plugin guards', () => {
    test('an entry file that exports no factory is refused by name', async () => {
        const plugin = writePlugin(
            'xa',
            'module.exports = { langCode: "xa" };',
        );
        ipc.invoke.mockResolvedValue([plugin]);

        await expect(langUtils.getLangData('xa')).rejects.toThrow(
            `"${path.join(plugin.dirPath, LANG_PLUGIN_ENTRY_FILE_NAME)}" is not a language plugin.`,
        );
    });

    test('a factory that answers no data is refused, and nothing is kept', async () => {
        const plugin = writePlugin(
            'xb',
            'module.exports = function () { return null; };',
        );
        ipc.invoke.mockResolvedValue([plugin]);

        await expect(langUtils.getLangData('xb')).rejects.toThrow(
            'returned no language data.',
        );
        // Asked again, it is loaded (and refused) again: no half-loaded copy.
        await expect(langUtils.getLangData('xb')).rejects.toThrow(
            'returned no language data.',
        );
    });

    test('a language with no Open Lyric half loads as it is', async () => {
        const plugin = writePlugin(
            'xc',
            'module.exports = function (host) { return { langCode: host.langCode }; };',
        );
        ipc.invoke.mockResolvedValue([plugin]);

        const data = await langUtils.getLangData('xc');

        expect(data).toEqual({ langCode: 'xc', packageDir: plugin.dirPath });
        expect(data.initOpenLyricPlugins).toBeUndefined();
    });

    test('a JSON file of a language that is not installed is null', async () => {
        const plugin = writePlugin(
            'xd',
            'module.exports = function () { return {}; };',
        );
        ipc.invoke.mockResolvedValue([plugin]);

        await expect(
            langUtils.readLangPluginJson('zz', 'questions.json'),
        ).resolves.toBeNull();
        // The same file of the installed one is read.
        await expect(
            langUtils.readLangPluginJson('xd', 'questions.json'),
        ).resolves.toEqual({ rows: 1 });
    });
});
