import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type * as CryptoModule from 'node:crypto';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// `archiveCryptoHelpers.test.ts` runs the real `node:crypto` on purpose; this
// file only makes the key derivation fail, which the real one does not do on
// demand, to see what an export or an import does then.
const { scryptFailure } = vi.hoisted(() => ({
    scryptFailure: new Error('scrypt: out of memory'),
}));
vi.mock('node:crypto', async (importOriginal) => {
    const actual = await importOriginal<typeof CryptoModule>();
    return {
        ...actual,
        scrypt: (...args: unknown[]) => {
            const callback = args.at(-1) as (error: Error | null) => void;
            callback(scryptFailure);
        },
    };
});

import { decryptFile, encryptFile } from './archiveCryptoHelpers';

let dirPath = '';

beforeEach(async () => {
    dirPath = await mkdtemp(join(tmpdir(), 'owa-archive-kdf-'));
});

afterEach(async () => {
    await rm(dirPath, { recursive: true, force: true });
});

describe('a key derivation that fails', () => {
    test('fails the export with its own error and leaves nothing behind', async () => {
        const sourcePath = join(dirPath, 'data.tar');
        const outputPath = join(dirPath, 'data.tar.owaenc');
        await writeFile(sourcePath, 'archive bytes');

        await expect(
            encryptFile(sourcePath, outputPath, 'In Jesus Christ'),
        ).rejects.toBe(scryptFailure);

        expect(existsSync(outputPath)).toBe(false);
        expect(existsSync(`${outputPath}.part`)).toBe(false);
    });

    test('fails the import with its own error, not as a wrong password', async () => {
        // A header this build reads: magic, version 1, scrypt, N=2^15, r=8,
        // p=1, then salt, nonce and key check; an empty body and a tag.
        const header = Buffer.alloc(64);
        Buffer.from('OWAENC\0', 'latin1').copy(header, 0);
        header.writeUInt8(1, 7);
        header.writeUInt8(1, 8);
        header.writeUInt8(15, 9);
        header.writeUInt8(8, 10);
        header.writeUInt8(1, 11);
        const sourcePath = join(dirPath, 'data.tar.owaenc');
        const outputPath = join(dirPath, 'data.tar');
        await writeFile(sourcePath, Buffer.concat([header, Buffer.alloc(16)]));

        await expect(
            decryptFile(sourcePath, outputPath, 'In Jesus Christ'),
        ).rejects.toBe(scryptFailure);

        expect(existsSync(outputPath)).toBe(false);
        expect(existsSync(`${outputPath}.part`)).toBe(false);
    });
});
