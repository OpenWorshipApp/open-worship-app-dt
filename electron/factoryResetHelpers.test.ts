import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

const { relaunchApp } = vi.hoisted(() => ({ relaunchApp: vi.fn() }));
vi.mock('./taskbarHelpers', () => ({ relaunchApp }));

import {
    confirmFactoryReset,
    FACTORY_RESET_MARKER_FILE_NAME,
    resetAllSettingFiles,
    resetBrowserSettingStorage,
    takeFactoryResetRequest,
} from './factoryResetHelpers';
import { electronMockState } from './testElectronModule';

let tempDirPath = '';
let userDataPath = '';

function writeFile(filePath: string, text = 'x') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, text, 'utf8');
}

function writeSettingFile(clientSetting: Record<string, string>) {
    writeFile(
        path.join(userDataPath, 'setting.json'),
        JSON.stringify({
            clientSetting,
            secureSetting: { 'ai-setting-secret': 'c2VjcmV0' },
            mainWinBounds: { x: 0, y: 0, width: 10, height: 10 },
        }),
    );
}

describe('factoryResetHelpers', () => {
    beforeEach(() => {
        electronMockState.reset();
        relaunchApp.mockClear();
        tempDirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'owa-reset-'));
        userDataPath = path.join(tempDirPath, 'user-data');
        fs.mkdirSync(userDataPath);
        electronMockState.app.getPath.mockImplementation(() => userDataPath);
    });

    afterEach(() => {
        electronMockState.app.getPath.mockImplementation(
            () => '/mock-user-data',
        );
        fs.rmSync(tempDirPath, { recursive: true, force: true });
    });

    test('Cancel, the default answer, asks for nothing', async () => {
        await confirmFactoryReset(null);

        const [options] = electronMockState.dialog.showMessageBox.mock
            .calls[0] as any[];
        expect(options).toMatchObject({
            type: 'warning',
            buttons: ['Factory Reset', 'Cancel'],
            // Enter or Escape on a mis-click resets nothing.
            defaultId: 1,
            cancelId: 1,
        });
        expect(
            fs.existsSync(
                path.join(userDataPath, FACTORY_RESET_MARKER_FILE_NAME),
            ),
        ).toBe(false);
        expect(relaunchApp).not.toHaveBeenCalled();
    });

    test('confirmed, it leaves the marker for the next start and restarts', async () => {
        electronMockState.dialog.showMessageBox.mockImplementation(
            async () => ({ response: 0 }),
        );

        await confirmFactoryReset('D:\\Church Data');

        const [options] = electronMockState.dialog.showMessageBox.mock
            .calls[0] as any[];
        // The person is told where their files still are.
        expect(options.detail).toContain('"D:\\Church Data"');
        expect(options.detail).toContain('not deleted');
        expect(
            fs.existsSync(
                path.join(userDataPath, FACTORY_RESET_MARKER_FILE_NAME),
            ),
        ).toBe(true);
        expect(relaunchApp).toHaveBeenCalledTimes(1);
    });

    test('a marker that cannot be written says so and does not restart', async () => {
        electronMockState.dialog.showMessageBox.mockImplementation(
            async () => ({ response: 0 }),
        );
        electronMockState.app.getPath.mockImplementation(() => {
            return path.join(tempDirPath, 'not-there', 'deeper');
        });
        const consoleLogSpy = vi
            .spyOn(console, 'log')
            .mockImplementation(() => {});
        try {
            await confirmFactoryReset(null);
        } finally {
            consoleLogSpy.mockRestore();
        }

        expect(electronMockState.dialog.showErrorBox).toHaveBeenCalledWith(
            'Factory Reset',
            expect.stringContaining('nothing was changed'),
        );
        expect(relaunchApp).not.toHaveBeenCalled();
    });

    test('the request is taken once, so a later start resets nothing', () => {
        expect(takeFactoryResetRequest()).toBe(false);

        writeFile(path.join(userDataPath, FACTORY_RESET_MARKER_FILE_NAME));
        expect(takeFactoryResetRequest()).toBe(true);
        expect(takeFactoryResetRequest()).toBe(false);
    });

    test('removes every setting file and nothing that is data', () => {
        const dataDirPath = path.join(tempDirPath, 'church-data');
        writeSettingFile({ 'selected-parent-dir': dataDirPath });
        const ownSettingPath = path.join(
            userDataPath,
            'local-storage',
            'presenter-layout',
        );
        const folderSettingPath = path.join(
            dataDirPath,
            'local-storage',
            'stay-awake',
        );
        const nestedPath = path.join(
            dataDirPath,
            'local-storage',
            'nested',
            'kept',
        );
        const songPath = path.join(dataDirPath, 'lyrics', 'song.md');
        const languagePath = path.join(userDataPath, 'lang', 'km', 'meta.json');
        for (const filePath of [
            ownSettingPath,
            folderSettingPath,
            nestedPath,
            songPath,
            languagePath,
        ]) {
            writeFile(filePath);
        }

        resetAllSettingFiles();

        expect(fs.existsSync(path.join(userDataPath, 'setting.json'))).toBe(
            false,
        );
        expect(fs.existsSync(ownSettingPath)).toBe(false);
        expect(fs.existsSync(folderSettingPath)).toBe(false);
        // Only the setting files themselves: a folder in there, the songs and
        // the installed languages are left alone.
        expect(fs.existsSync(nestedPath)).toBe(true);
        expect(fs.existsSync(songPath)).toBe(true);
        expect(fs.existsSync(languagePath)).toBe(true);
    });

    test('a data folder that is not there, or not a full path, is skipped', () => {
        const readdirSpy = vi.spyOn(fs, 'readdirSync');
        try {
            for (const chosen of ['', 'relative', '/no/such/church-data']) {
                readdirSpy.mockClear();
                writeSettingFile({ 'selected-parent-dir': chosen });

                expect(() => resetAllSettingFiles()).not.toThrow();

                const readList = readdirSpy.mock.calls.map(([dirPath]) => {
                    return String(dirPath);
                });
                // Never the working directory's `local-storage`.
                expect(
                    readList.every((dirPath) => path.isAbsolute(dirPath)),
                    chosen,
                ).toBe(true);
                expect(readList).toContain(
                    path.join(userDataPath, 'local-storage'),
                );
            }
        } finally {
            readdirSpy.mockRestore();
        }
    });

    test('a setting.json that is not JSON is still removed', () => {
        writeFile(path.join(userDataPath, 'setting.json'), '{ broken');

        resetAllSettingFiles();

        expect(fs.existsSync(path.join(userDataPath, 'setting.json'))).toBe(
            false,
        );
    });

    test("clears the windows' localStorage, and a failure stops nothing", async () => {
        const { clearStorageData } = electronMockState.session.defaultSession;

        await resetBrowserSettingStorage();
        expect(clearStorageData).toHaveBeenCalledWith({
            storages: ['localstorage'],
        });

        clearStorageData.mockImplementationOnce(async () => {
            throw new Error('busy');
        });
        const consoleLogSpy = vi
            .spyOn(console, 'log')
            .mockImplementation(() => {});
        try {
            await expect(resetBrowserSettingStorage()).resolves.toBeUndefined();
        } finally {
            consoleLogSpy.mockRestore();
        }
    });
});
