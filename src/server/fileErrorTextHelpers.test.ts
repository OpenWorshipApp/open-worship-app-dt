import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, test, vi } from 'vitest';

vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => `[${text}]`,
}));

import {
    FILE_ERROR_TOAST_TIMEOUT,
    genCodedError,
    toFileErrorText,
} from './fileErrorTextHelpers';

const workDir = mkdtempSync(path.join(tmpdir(), 'owa-file-error-'));

afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
});

// The real errors Node raises, not hand-made objects: the codes the helper
// reads are the ones a failed save on the operator's machine carries.
function catchError(run: () => void) {
    try {
        run();
    } catch (error) {
        return error;
    }
    throw new Error('expected the file operation to fail');
}

describe('toFileErrorText', () => {
    test('a folder that is gone says to check its drive', () => {
        const error = catchError(() => {
            writeFileSync(path.join(workDir, 'gone', 'Sunday.slides'), 'x');
        });
        expect((error as any).code).toBe('ENOENT');
        expect(toFileErrorText(error)).toBe(
            '[The file or its folder is not there any more. ' +
                'Check that its drive is connected.]',
        );
    });

    test.runIf(process.platform !== 'win32' && process.getuid?.() !== 0)(
        'a folder that refuses changes says so, not "EACCES"',
        () => {
            const dirPath = mkdtempSync(path.join(workDir, 'read-only-'));
            chmodSync(dirPath, 0o555);
            const error = catchError(() => {
                writeFileSync(path.join(dirPath, 'Sunday.slides'), 'x');
            });
            chmodSync(dirPath, 0o755);
            expect((error as any).code).toBe('EACCES');
            const text = toFileErrorText(error);
            expect(text).toBe(
                '[This file or folder cannot be changed. ' +
                    'Check that it is not read-only or open in another program.]',
            );
            expect(text).not.toContain('EACCES');
        },
    );

    test('every code a save can meet has its own sentence', () => {
        const texts = [
            'ENOTDIR',
            'EPERM',
            'EROFS',
            'ENOSPC',
            'EBUSY',
            'EEXIST',
        ].map((code) => {
            return toFileErrorText(genCodedError('raw', code));
        });
        expect(texts).toEqual([
            '[The file or its folder is not there any more. ' +
                'Check that its drive is connected.]',
            '[This file or folder cannot be changed. ' +
                'Check that it is not read-only or open in another program.]',
            '[This drive is read-only. Choose a folder on another drive.]',
            '[The disk is full. Free some space, then try again.]',
            '[Another program is using this file. Close it, then try again.]',
            '[A file with this name is already there. Choose another name.]',
        ]);
        for (const text of texts) {
            expect(text).not.toContain('raw');
        }
    });

    test('anything else is a plain sentence, never the raw message', () => {
        for (const error of [
            new Error('EWHATEVER: something internal'),
            genCodedError('raw', 'EIO'),
            null,
            'a string',
        ]) {
            expect(toFileErrorText(error)).toBe(
                '[It did not work. Please try again.]',
            );
        }
    });

    test('a wrapped failure is named by the error it wraps', () => {
        const wrapped = new Error('Error during checking file exist', {
            cause: genCodedError('EACCES: permission denied', 'EACCES'),
        });
        expect(toFileErrorText(wrapped)).toBe(
            '[This file or folder cannot be changed. ' +
                'Check that it is not read-only or open in another program.]',
        );
    });

    test('a coded error keeps its message for the log', () => {
        const error = genCodedError('File exist', 'EEXIST');
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('File exist');
        expect(error.code).toBe('EEXIST');
    });

    test('a failure stays long enough to read', () => {
        expect(FILE_ERROR_TOAST_TIMEOUT).toBeGreaterThanOrEqual(8e3);
    });
});
