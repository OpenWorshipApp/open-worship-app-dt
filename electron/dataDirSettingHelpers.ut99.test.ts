import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    deleteDataDirSettingFile,
    forgetDataDirSettingCache,
    listDataDirSettingNames,
    readDataDirSettingFile,
    toDataDirSettingPath,
    writeDataDirSettingFile,
} from './dataDirSettingHelpers';

let dataDir = '';
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'owa-'));
    forgetDataDirSettingCache();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-03T10:00:00.000Z'));
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
    forgetDataDirSettingCache();
    vi.useRealTimers();
    fs.rmSync(dataDir, { recursive: true, force: true });
});

function settingPath(key: string) {
    return toDataDirSettingPath(dataDir, key);
}

describe('toDataDirSettingPath', () => {
    test('names the file after its key inside the folder’s local-storage', () => {
        expect(toDataDirSettingPath('/data', 'stay-awake')).toBe(
            path.join('/data', 'local-storage', 'stay-awake'),
        );
    });
});

describe('writing and reading a setting', () => {
    test('a write lands whole on disk and reads back', () => {
        const filePath = settingPath('screen-mirror-mode');

        expect(writeDataDirSettingFile(filePath, 'code')).toBe(true);

        expect(fs.readFileSync(filePath, 'utf8')).toBe('code');
        expect(readDataDirSettingFile(filePath)).toBe('code');
        // The temporary file it was written through is gone.
        expect(fs.readdirSync(path.dirname(filePath))).toEqual([
            'screen-mirror-mode',
        ]);
        expect(logSpy).not.toHaveBeenCalled();
    });

    test('a setting the folder does not hold reads as null, quietly', () => {
        expect(readDataDirSettingFile(settingPath('stay-awake'))).toBeNull();
        expect(logSpy).not.toHaveBeenCalled();
    });

    test('a file that cannot be read reads as null, and says why', () => {
        // A folder where the setting's file should be.
        const filePath = settingPath('stay-awake');
        fs.mkdirSync(filePath, { recursive: true });

        expect(readDataDirSettingFile(filePath)).toBeNull();
        expect(logSpy).toHaveBeenCalledWith(
            'Error reading a data folder setting',
            expect.objectContaining({ code: expect.any(String) }),
        );
    });

    test('a write that cannot land answers false and leaves nothing cached', () => {
        // The folder's local-storage is a FILE: no folder can be made there.
        fs.writeFileSync(path.join(dataDir, 'local-storage'), 'in the way');
        const filePath = settingPath('stay-awake');

        expect(writeDataDirSettingFile(filePath, 'true')).toBe(false);

        expect(logSpy).toHaveBeenCalledWith(
            'Error saving a data folder setting',
            expect.anything(),
        );
        expect(readDataDirSettingFile(filePath)).toBeNull();
    });
});

describe('the short-lived cache', () => {
    test('answers from memory for two seconds, then reads the disk again', () => {
        const filePath = settingPath('screen-mirror-port');
        writeDataDirSettingFile(filePath, '39240');
        // Another window writes the file behind this process's back.
        fs.writeFileSync(filePath, '39241', 'utf8');

        vi.advanceTimersByTime(1500);
        expect(readDataDirSettingFile(filePath)).toBe('39240');
        // A read is no write: it must not push the expiry forward.
        vi.advanceTimersByTime(1000);
        expect(readDataDirSettingFile(filePath)).toBe('39241');
    });

    test('a missing file is remembered as missing until it lapses', () => {
        const filePath = settingPath('virtual-displays');
        expect(readDataDirSettingFile(filePath)).toBeNull();
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, '[]', 'utf8');

        expect(readDataDirSettingFile(filePath)).toBeNull();
        vi.advanceTimersByTime(2001);
        expect(readDataDirSettingFile(filePath)).toBe('[]');
    });

    test('a lapsed entry gives way when another comes in', () => {
        const first = settingPath('screen-mirror-host');
        const second = settingPath('screen-mirror-guests');
        writeDataDirSettingFile(first, 'true');
        vi.advanceTimersByTime(2500);
        // The second write sweeps the first, lapsed, entry out of memory:
        // the cache is bounded by what was touched in the last two seconds.
        const deleteSpy = vi.spyOn(Map.prototype, 'delete');
        writeDataDirSettingFile(second, '[]');
        expect(deleteSpy).toHaveBeenCalledWith(first);
        expect(deleteSpy).not.toHaveBeenCalledWith(second);
        deleteSpy.mockRestore();
        fs.writeFileSync(first, 'false', 'utf8');

        expect(readDataDirSettingFile(first)).toBe('false');
        expect(readDataDirSettingFile(second)).toBe('[]');
    });

    test('is keyed by the whole path: another folder never answers', () => {
        const otherDir = path.join(dataDir, 'other');
        writeDataDirSettingFile(settingPath('stay-awake'), 'true');

        expect(
            readDataDirSettingFile(
                toDataDirSettingPath(otherDir, 'stay-awake'),
            ),
        ).toBeNull();
    });
});

describe('deleteDataDirSettingFile', () => {
    test('removes the file, and a read straight after sees it gone', () => {
        const filePath = settingPath('screen-mirror-tunnel');
        writeDataDirSettingFile(filePath, 'true');

        deleteDataDirSettingFile(filePath);

        expect(fs.existsSync(filePath)).toBe(false);
        expect(readDataDirSettingFile(filePath)).toBeNull();
        expect(logSpy).not.toHaveBeenCalled();
    });

    test('a setting already gone is no error', () => {
        deleteDataDirSettingFile(settingPath('stay-awake'));

        expect(logSpy).not.toHaveBeenCalled();
    });

    test('a file that cannot be removed says why, and is forgotten anyway', () => {
        const filePath = settingPath('stay-awake');
        fs.mkdirSync(filePath, { recursive: true });

        deleteDataDirSettingFile(filePath);

        expect(logSpy).toHaveBeenCalledWith(
            'Error removing a data folder setting',
            expect.objectContaining({ code: expect.any(String) }),
        );
        expect(fs.existsSync(filePath)).toBe(true);
    });
});

describe('listDataDirSettingNames', () => {
    test('lists only the settings the list names', () => {
        writeDataDirSettingFile(settingPath('stay-awake'), 'true');
        writeDataDirSettingFile(settingPath('lexical-playground-note'), '{}');
        // Files the folder holds that are no setting of the list.
        fs.writeFileSync(settingPath('selected-parent-dir'), '/x');
        fs.writeFileSync(settingPath('Not-A-Setting'), 'x');

        expect(listDataDirSettingNames(dataDir).sort()).toEqual([
            'lexical-playground-note',
            'stay-awake',
        ]);
    });

    test('a folder with no local-storage holds none', () => {
        expect(listDataDirSettingNames(path.join(dataDir, 'nowhere'))).toEqual(
            [],
        );
    });
});
