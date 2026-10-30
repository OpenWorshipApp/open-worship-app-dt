import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    deleteDataDirSettingFile,
    forgetDataDirSettingCache,
    listDataDirSettingNames,
    readDataDirSettingFile,
    toDataDirSettingPath,
    writeDataDirSettingFile,
} from './dataDirSettingHelpers';

// The data folder's own settings are real files, so these run on a real
// folder of their own; only `Date` is faked, to walk the two-second cache.
let dataDirPath: string;
let consoleLogSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-28T10:00:00Z'));
    forgetDataDirSettingCache();
    dataDirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'owa-data-dir-'));
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
    forgetDataDirSettingCache();
    consoleLogSpy.mockRestore();
    vi.useRealTimers();
    fs.rmSync(dataDirPath, { recursive: true, force: true });
});

describe('data folder setting files', () => {
    it('keeps each setting as a file under local-storage', () => {
        expect(toDataDirSettingPath(dataDirPath, 'stay-awake')).toBe(
            path.join(dataDirPath, 'local-storage', 'stay-awake'),
        );
    });

    it('writes whole, leaves no temp file, and reads back what it wrote', () => {
        const filePath = toDataDirSettingPath(dataDirPath, 'stay-awake');
        expect(writeDataDirSettingFile(filePath, 'true')).toBe(true);
        expect(fs.readFileSync(filePath, 'utf8')).toBe('true');
        expect(fs.readdirSync(path.dirname(filePath))).toEqual(['stay-awake']);
        expect(readDataDirSettingFile(filePath)).toBe('true');
    });

    it('answers from memory for two seconds, and a hit does not extend that', () => {
        const filePath = toDataDirSettingPath(
            dataDirPath,
            'screen-mirror-mode',
        );
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, 'approve');
        expect(readDataDirSettingFile(filePath)).toBe('approve');

        // Another process changes the file behind this one's back.
        fs.writeFileSync(filePath, 'code');
        vi.advanceTimersByTime(1500);
        expect(readDataDirSettingFile(filePath)).toBe('approve');

        // Two seconds after the read from disk, not after the last hit.
        vi.advanceTimersByTime(600);
        expect(readDataDirSettingFile(filePath)).toBe('code');
    });

    it('reads a lapsed entry afresh after another file was read', () => {
        const first = toDataDirSettingPath(dataDirPath, 'virtual-displays');
        const second = toDataDirSettingPath(
            dataDirPath,
            'virtual-display-share',
        );
        writeDataDirSettingFile(first, '[1]');
        vi.advanceTimersByTime(2500);
        fs.writeFileSync(first, '[1,2]');
        // Remembering the second sweeps the lapsed first entry out.
        writeDataDirSettingFile(second, 'true');
        expect(readDataDirSettingFile(first)).toBe('[1,2]');
        expect(readDataDirSettingFile(second)).toBe('true');
    });

    it('reads a missing setting as null, quietly', () => {
        const filePath = toDataDirSettingPath(dataDirPath, 'stay-awake');
        expect(readDataDirSettingFile(filePath)).toBeNull();
        expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('reads a setting it cannot open as null, and says why', () => {
        // A folder where the file should be.
        const filePath = toDataDirSettingPath(dataDirPath, 'stay-awake');
        fs.mkdirSync(filePath, { recursive: true });
        expect(readDataDirSettingFile(filePath)).toBeNull();
        expect(consoleLogSpy).toHaveBeenCalledWith(
            'Error reading a data folder setting',
            expect.objectContaining({ code: 'EISDIR' }),
        );
    });

    it('answers false when the setting cannot be written', () => {
        // A file where the local-storage folder should be.
        fs.writeFileSync(path.join(dataDirPath, 'local-storage'), 'not a dir');
        const filePath = toDataDirSettingPath(dataDirPath, 'stay-awake');
        expect(writeDataDirSettingFile(filePath, 'true')).toBe(false);
        expect(consoleLogSpy).toHaveBeenCalledWith(
            'Error saving a data folder setting',
            expect.any(Error),
        );
        expect(
            fs.readFileSync(path.join(dataDirPath, 'local-storage'), 'utf8'),
        ).toBe('not a dir');
    });

    it('deletes a setting at once, cache included', () => {
        const filePath = toDataDirSettingPath(dataDirPath, 'stay-awake');
        writeDataDirSettingFile(filePath, 'true');
        expect(readDataDirSettingFile(filePath)).toBe('true');
        deleteDataDirSettingFile(filePath);
        expect(fs.existsSync(filePath)).toBe(false);
        expect(readDataDirSettingFile(filePath)).toBeNull();
        // Deleting what is already gone is not an error worth a word.
        deleteDataDirSettingFile(filePath);
        expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('says why a setting could not be removed, and forgets it anyway', () => {
        const filePath = toDataDirSettingPath(dataDirPath, 'stay-awake');
        fs.mkdirSync(filePath, { recursive: true });
        deleteDataDirSettingFile(filePath);
        expect(consoleLogSpy).toHaveBeenCalledWith(
            'Error removing a data folder setting',
            expect.objectContaining({ code: expect.any(String) }),
        );
        expect(fs.existsSync(filePath)).toBe(true);
        consoleLogSpy.mockClear();
        // Remembered as unset: no disk read, so no read error either.
        expect(readDataDirSettingFile(filePath)).toBeNull();
        expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('lists only the data folder settings it holds', () => {
        const folder = path.join(dataDirPath, 'local-storage');
        fs.mkdirSync(folder, { recursive: true });
        for (const name of [
            'stay-awake',
            'lexical-playground-note-1',
            'selected-parent-dir',
            'notes.txt',
            'Stay-Awake',
        ]) {
            fs.writeFileSync(path.join(folder, name), '');
        }
        expect(listDataDirSettingNames(dataDirPath).sort()).toEqual([
            'lexical-playground-note-1',
            'stay-awake',
        ]);
    });

    it('lists nothing for a folder with no settings yet', () => {
        expect(
            listDataDirSettingNames(path.join(dataDirPath, 'missing')),
        ).toEqual([]);
    });
});
