import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    renameSync: null as null | ((from: string, to: string) => void),
}));

vi.mock('./appProvider', async () => {
    const nodeFs = await import('node:fs');
    const nodePath = await import('node:path');
    const nodeUrl = await import('node:url');
    return {
        default: {
            pathUtils: nodePath,
            browserUtils: { pathToFileURL: nodeUrl.pathToFileURL },
            sessionData: { defaultStorageDirPath: null },
            fileUtils: {
                writeFileSync: nodeFs.writeFileSync,
                readFileSync: nodeFs.readFileSync,
                unlinkSync: nodeFs.unlinkSync,
                existsSync: nodeFs.existsSync,
                get renameSync() {
                    return mocks.renameSync ?? nodeFs.renameSync;
                },
            },
        },
    };
});
vi.mock('../helper/errorHelpers', () => ({ handleError: vi.fn() }));

import { fsWriteFileAtomicSync } from './storageFileHelpers';

let dirPath = '';
beforeEach(() => {
    dirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'owa-atomic-'));
    mocks.renameSync = null;
});
afterEach(() => {
    fs.rmSync(dirPath, { recursive: true, force: true });
});

describe('fsWriteFileAtomicSync', () => {
    test('replaces the file whole and leaves no temporary file', () => {
        const filePath = path.join(dirPath, 'screen-map');
        fs.writeFileSync(filePath, JSON.stringify({ a: 'x'.repeat(5000) }));
        fsWriteFileAtomicSync(filePath, '{"b":1}');
        expect(fs.readFileSync(filePath, 'utf8')).toBe('{"b":1}');
        expect(fs.readdirSync(dirPath)).toEqual(['screen-map']);
    });

    test('writes through the rename, not in place', () => {
        const filePath = path.join(dirPath, 'screen-map');
        const renames: string[] = [];
        mocks.renameSync = (from, to) => {
            renames.push(path.basename(from));
            fs.renameSync(from, to);
        };
        fsWriteFileAtomicSync(filePath, '{}');
        expect(renames).toHaveLength(1);
        expect(renames[0].startsWith('.screen-map.')).toBe(true);
    });

    test('falls back to an in-place write when the rename keeps failing', () => {
        const filePath = path.join(dirPath, 'screen-map');
        let attempts = 0;
        mocks.renameSync = () => {
            attempts++;
            throw Object.assign(new Error('busy'), { code: 'EPERM' });
        };
        fsWriteFileAtomicSync(filePath, '{"c":2}');
        expect(attempts).toBe(5);
        expect(fs.readFileSync(filePath, 'utf8')).toBe('{"c":2}');
        expect(fs.readdirSync(dirPath)).toEqual(['screen-map']);
    });
});
