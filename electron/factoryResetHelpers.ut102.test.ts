/**
 * A factory reset that meets a disk saying no: a settings folder it cannot
 * read, a setting file it cannot remove, a `setting.json` that will not go.
 * Each is said in the log and the reset goes on with the rest -- it is the
 * way back for an app that will not start, so it must never stop half way.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

vi.mock('./taskbarHelpers', () => ({ relaunchApp: vi.fn() }));

import { resetAllSettingFiles } from './factoryResetHelpers';
import { electronMockState } from './testElectronModule';

let tempDirPath = '';
let userDataPath = '';
let logMock: ReturnType<typeof vi.spyOn>;

function writeFile(filePath: string, text = 'x') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, text, 'utf8');
}

function logLinesStartingWith(text: string) {
    return logMock.mock.calls.filter((call: unknown[]) => {
        return call[0] === text;
    });
}

describe('resetAllSettingFiles when the disk refuses', () => {
    beforeEach(() => {
        electronMockState.reset();
        tempDirPath = fs.realpathSync(
            fs.mkdtempSync(path.join(os.tmpdir(), 'owa-reset-ut102-')),
        );
        userDataPath = path.join(tempDirPath, 'user-data');
        fs.mkdirSync(userDataPath);
        electronMockState.app.getPath.mockImplementation(() => userDataPath);
        logMock = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        electronMockState.app.getPath.mockImplementation(
            () => '/mock-user-data',
        );
        fs.rmSync(tempDirPath, { recursive: true, force: true });
    });

    test('a settings "folder" that is a file is said, and the rest still goes', () => {
        const chosenPath = path.join(tempDirPath, 'chosen');
        // Where the data folder's settings should be, a file.
        writeFile(path.join(chosenPath, 'local-storage'), 'not a folder');
        writeFile(path.join(userDataPath, 'local-storage', 'theme'), 'dark');
        writeFile(
            path.join(userDataPath, 'setting.json'),
            JSON.stringify({
                clientSetting: { 'selected-parent-dir': chosenPath },
            }),
        );

        resetAllSettingFiles();

        const [unreadable] = logLinesStartingWith(
            'Factory reset could not read',
        );
        expect(unreadable[1]).toBe(path.join(chosenPath, 'local-storage'));
        // ENOTDIR on macOS and Linux; whatever the system calls it, it is
        // not the folder-never-written-to that goes unsaid.
        expect((unreadable[2] as any)?.code).toEqual(expect.any(String));
        expect((unreadable[2] as any)?.code).not.toBe('ENOENT');
        // The folder it could read was emptied, and setting.json went.
        expect(
            fs.existsSync(path.join(userDataPath, 'local-storage', 'theme')),
        ).toBe(false);
        expect(fs.existsSync(path.join(userDataPath, 'setting.json'))).toBe(
            false,
        );
        // The file in its place is nobody's setting and stays.
        expect(fs.existsSync(path.join(chosenPath, 'local-storage'))).toBe(
            true,
        );
        expect(logMock).toHaveBeenLastCalledWith(
            'Factory reset: every setting removed',
        );
    });

    test('a folder never written to is no news', () => {
        resetAllSettingFiles();
        expect(logLinesStartingWith('Factory reset could not read')).toEqual(
            [],
        );
        expect(logMock).toHaveBeenLastCalledWith(
            'Factory reset: every setting removed',
        );
    });

    test('a setting file that will not go is said, and the next one still goes', () => {
        const settingDirPath = path.join(userDataPath, 'local-storage');
        writeFile(path.join(settingDirPath, 'held'), 'busy');
        writeFile(path.join(settingDirPath, 'theme'), 'dark');
        const realUnlink = fs.unlinkSync;
        const busy = Object.assign(new Error('EBUSY: resource busy'), {
            code: 'EBUSY',
        });
        const unlinkSpy = vi.spyOn(fs, 'unlinkSync');
        unlinkSpy.mockImplementation((filePath) => {
            if (path.basename(String(filePath)) === 'held') {
                throw busy;
            }
            return realUnlink(filePath);
        });

        resetAllSettingFiles();
        unlinkSpy.mockRestore();

        expect(logLinesStartingWith('Factory reset could not remove')).toEqual([
            ['Factory reset could not remove', 'held', busy],
        ]);
        expect(fs.existsSync(path.join(settingDirPath, 'theme'))).toBe(false);
        expect(fs.existsSync(path.join(settingDirPath, 'held'))).toBe(true);
    });

    test('a setting.json that will not go is said, and the reset still ends', () => {
        const settingFilePath = path.join(userDataPath, 'setting.json');
        writeFile(settingFilePath, '{}');
        const denied = Object.assign(new Error('EPERM: not permitted'), {
            code: 'EPERM',
        });
        const rmSpy = vi.spyOn(fs, 'rmSync').mockImplementation(() => {
            throw denied;
        });

        expect(() => {
            resetAllSettingFiles();
        }).not.toThrow();
        // The test's own clean-up needs the real one back.
        rmSpy.mockRestore();

        expect(logLinesStartingWith('Factory reset could not remove')).toEqual([
            ['Factory reset could not remove', settingFilePath, denied],
        ]);
        expect(logMock).toHaveBeenLastCalledWith(
            'Factory reset: every setting removed',
        );
    });
});
