import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import {
    checkIsEncryptedFile,
    decryptFile,
    encryptFile,
} from './archiveCryptoHelpers';

/**
 * Deliberately UNMOCKED. `archiveCryptoHelpers` touches no electron API, so it
 * runs against real files and real `node:crypto` here — which is the only way to
 * catch the two mistakes that would otherwise reach users looking exactly like a
 * wrong password: the inclusive `end` on the ciphertext read stream, and the
 * auth tag being appended after the pipeline rather than inside it.
 */

const PASSWORD = 'In Jesus Christ';

/**
 * These write and stream REAL files, so they are not bound by the suite's
 * 5s default the way a mocked test is. The cost is the disk, not the crypto —
 * a key derivation measures around 130ms — and it climbs when the whole suite
 * is running beside them.
 */
const REAL_FILE_TIMEOUT = 30_000;

let workDir = '';

function toPath(fileName: string) {
    return join(workDir, fileName);
}

async function writeFixture(fileName: string, content: Buffer) {
    const filePath = toPath(fileName);
    await writeFile(filePath, content);
    return filePath;
}

async function checkIsExisting(filePath: string) {
    try {
        await stat(filePath);
        return true;
    } catch (_error) {
        return false;
    }
}

beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'owa-archive-crypto-'));
});

afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
});

describe('archive password protection', () => {
    test(
        'round trips a payload byte for byte',
        async () => {
            // Comfortably past one 64KiB stream chunk, so the streaming path is
            // what is actually exercised.
            const content = randomBytes(1024 * 1024 + 7);
            const plainFilePath = await writeFixture('archive.tar.gz', content);
            const encryptedFilePath = toPath('archive.enc');
            const restoredFilePath = toPath('restored.tar.gz');

            await encryptFile(plainFilePath, encryptedFilePath, PASSWORD);
            const result = await decryptFile(
                encryptedFilePath,
                restoredFilePath,
                PASSWORD,
            );

            expect(result).toEqual({ isOk: true });
            expect(await readFile(restoredFilePath)).toEqual(content);
            // The wrapped file must not simply be the payload with a hat on.
            expect(await readFile(encryptedFilePath)).not.toEqual(content);
        },
        REAL_FILE_TIMEOUT,
    );

    test.each([
        ['empty', 0],
        ['single byte', 1],
        ['exactly one stream chunk', 64 * 1024],
        ['one byte past a stream chunk', 64 * 1024 + 1],
    ])(
        'round trips an %s payload',
        async (_name, size) => {
            const content = randomBytes(size);
            const plainFilePath = await writeFixture('archive.tar', content);
            const encryptedFilePath = toPath('archive.enc');
            const restoredFilePath = toPath('restored.tar');

            await encryptFile(plainFilePath, encryptedFilePath, PASSWORD);
            const result = await decryptFile(
                encryptedFilePath,
                restoredFilePath,
                PASSWORD,
            );

            expect(result).toEqual({ isOk: true });
            expect(await readFile(restoredFilePath)).toEqual(content);
        },
        REAL_FILE_TIMEOUT,
    );

    test(
        'round trips a Khmer password across normalisation forms',
        async () => {
            const content = randomBytes(256);
            const plainFilePath = await writeFixture('archive.tar', content);
            const encryptedFilePath = toPath('archive.enc');
            const restoredFilePath = toPath('restored.tar');
            const password = 'ព្រះគម្ពីរ ២០២៦';

            await encryptFile(plainFilePath, encryptedFilePath, password);
            const result = await decryptFile(
                encryptedFilePath,
                restoredFilePath,
                password.normalize('NFD'),
            );

            expect(result).toEqual({ isOk: true });
            expect(await readFile(restoredFilePath)).toEqual(content);
        },
        REAL_FILE_TIMEOUT,
    );

    test(
        'rejects a wrong password without writing anything',
        async () => {
            const plainFilePath = await writeFixture(
                'archive.tar',
                randomBytes(4096),
            );
            const encryptedFilePath = toPath('archive.enc');
            const restoredFilePath = toPath('restored.tar');

            await encryptFile(plainFilePath, encryptedFilePath, PASSWORD);
            const result = await decryptFile(
                encryptedFilePath,
                restoredFilePath,
                'not the password',
            );

            expect(result).toEqual({ isOk: false, reason: 'wrong-password' });
            // The key check answers before a single byte of the payload is read —
            // which is what keeps a wrong guess cheap on a gigabyte archive.
            expect(await checkIsExisting(restoredFilePath)).toBe(false);
        },
        REAL_FILE_TIMEOUT,
    );

    test(
        'recognises a file that was never protected',
        async () => {
            const plainFilePath = await writeFixture(
                'archive.tar',
                Buffer.from('a plain tar, more or less'),
            );

            expect(await checkIsEncryptedFile(plainFilePath)).toBe(false);
            expect(
                await decryptFile(plainFilePath, toPath('out'), PASSWORD),
            ).toEqual({ isOk: false, reason: 'not-encrypted' });
        },
        REAL_FILE_TIMEOUT,
    );

    test(
        'recognises a file too short to be a container',
        async () => {
            const shortFilePath = await writeFixture('short', Buffer.alloc(10));

            expect(await checkIsEncryptedFile(shortFilePath)).toBe(false);
            expect(
                await decryptFile(shortFilePath, toPath('out'), PASSWORD),
            ).toEqual({ isOk: false, reason: 'not-encrypted' });
        },
        REAL_FILE_TIMEOUT,
    );

    test(
        'recognises a protected file, and only a protected file',
        async () => {
            const plainFilePath = await writeFixture(
                'archive.tar',
                randomBytes(512),
            );
            const encryptedFilePath = toPath('archive.enc');

            await encryptFile(plainFilePath, encryptedFilePath, PASSWORD);

            expect(await checkIsEncryptedFile(encryptedFilePath)).toBe(true);
            expect(await checkIsEncryptedFile(plainFilePath)).toBe(false);
            expect(await checkIsEncryptedFile(toPath('nothing-here'))).toBe(
                false,
            );
        },
        REAL_FILE_TIMEOUT,
    );

    test(
        'writes the documented header',
        async () => {
            const plainFilePath = await writeFixture(
                'archive.tar',
                randomBytes(64),
            );
            const encryptedFilePath = toPath('archive.enc');

            await encryptFile(plainFilePath, encryptedFilePath, PASSWORD);
            const encrypted = await readFile(encryptedFilePath);

            expect(encrypted.subarray(0, 7).toString('latin1')).toBe(
                'OWAENC\0',
            );
            expect(encrypted.readUInt8(7)).toBe(1); // container version
            expect(encrypted.readUInt8(8)).toBe(1); // scrypt
            expect(encrypted.readUInt8(9)).toBe(15); // log2(N)
            expect(encrypted.readUInt8(10)).toBe(8); // r
            expect(encrypted.readUInt8(11)).toBe(1); // p
            // 64-byte header + payload + 16-byte auth tag.
            expect(encrypted.length).toBe(64 + 64 + 16);
        },
        REAL_FILE_TIMEOUT,
    );

    test(
        'refuses a header asking for an unusable work factor',
        async () => {
            const plainFilePath = await writeFixture(
                'archive.tar',
                randomBytes(512),
            );
            const encryptedFilePath = toPath('archive.enc');
            await encryptFile(plainFilePath, encryptedFilePath, PASSWORD);

            // A hand-edited header must not be able to make the app allocate
            // gigabytes for a key derivation.
            const encrypted = await readFile(encryptedFilePath);
            encrypted.writeUInt8(40, 9);
            await writeFile(encryptedFilePath, encrypted);

            expect(await checkIsEncryptedFile(encryptedFilePath)).toBe(false);
            expect(
                await decryptFile(encryptedFilePath, toPath('out'), PASSWORD),
            ).toEqual({ isOk: false, reason: 'unsupported' });
        },
        REAL_FILE_TIMEOUT,
    );

    test(
        'refuses a tampered payload',
        async () => {
            const plainFilePath = await writeFixture(
                'archive.tar',
                randomBytes(4096),
            );
            const encryptedFilePath = toPath('archive.enc');
            const restoredFilePath = toPath('restored.tar');
            await encryptFile(plainFilePath, encryptedFilePath, PASSWORD);

            const encrypted = await readFile(encryptedFilePath);
            encrypted.writeUInt8(encrypted.readUInt8(1024) ^ 0xff, 1024);
            await writeFile(encryptedFilePath, encrypted);

            await expect(
                decryptFile(encryptedFilePath, restoredFilePath, PASSWORD),
            ).rejects.toThrow('damaged');
            // A half-written file is worse than none — it looks importable.
            expect(await checkIsExisting(restoredFilePath)).toBe(false);
        },
        REAL_FILE_TIMEOUT,
    );

    test(
        'refuses a tampered salt, because the header is authenticated',
        async () => {
            const plainFilePath = await writeFixture(
                'archive.tar',
                randomBytes(1024),
            );
            const encryptedFilePath = toPath('archive.enc');
            await encryptFile(plainFilePath, encryptedFilePath, PASSWORD);

            const encrypted = await readFile(encryptedFilePath);
            // The IV, which the key check does not cover — only the auth tag does.
            encrypted.writeUInt8(encrypted.readUInt8(32) ^ 0xff, 32);
            await writeFile(encryptedFilePath, encrypted);

            await expect(
                decryptFile(encryptedFilePath, toPath('out'), PASSWORD),
            ).rejects.toThrow('damaged');
        },
        REAL_FILE_TIMEOUT,
    );

    test(
        'refuses to protect an archive with an empty password',
        async () => {
            const plainFilePath = await writeFixture(
                'archive.tar',
                randomBytes(64),
            );

            await expect(
                encryptFile(plainFilePath, toPath('archive.enc'), ''),
            ).rejects.toThrow('password is required');
        },
        REAL_FILE_TIMEOUT,
    );

    test(
        'leaves nothing behind when the payload cannot be read',
        async () => {
            const encryptedFilePath = toPath('archive.enc');

            await expect(
                encryptFile(
                    toPath('no-such-archive.tar'),
                    encryptedFilePath,
                    PASSWORD,
                ),
            ).rejects.toThrow();

            expect(await checkIsExisting(encryptedFilePath)).toBe(false);
            expect(await checkIsExisting(`${encryptedFilePath}.part`)).toBe(
                false,
            );
        },
        REAL_FILE_TIMEOUT,
    );
});
