import {
    createCipheriv,
    createDecipheriv,
    randomBytes,
    scrypt,
    timingSafeEqual,
} from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { open, rename, rm, stat, writeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';

/**
 * Password protection for an exported archive.
 *
 * The whole `.tar`/`.tar.gz` an export just wrote is wrapped, byte for byte, in
 * the container below. Nothing about the archive formats themselves changes, so
 * an export WITHOUT a password stays exactly what the app has always written and
 * every bundle already sitting in someone's Downloads folder still imports.
 *
 * Everything here streams. A whole-data archive is the user's entire document
 * set and can be gigabytes; reading one into memory to encrypt it would take the
 * app out on the low-spec machines it is built for.
 *
 * Container:
 *
 * ```
 * offset size  field
 * 0      7     magic 'OWAENC\0'
 * 7      1     container version (1)
 * 8      1     KDF id (1 = scrypt)
 * 9      1     log2(N)
 * 10     1     r
 * 11     1     p
 * 12     4     reserved (zero)
 * 16     16    salt
 * 32     12    IV (GCM nonce)
 * 44     4     reserved (zero)
 * 48     16    key check
 * 64     ...   ciphertext
 * EOF-16 16    GCM auth tag
 * ```
 *
 * The auth tag goes at the END because it does not exist until the last byte has
 * been encrypted, and holding the ciphertext back to put it in the header would
 * mean buffering the archive. Decryption reads those 16 bytes on their own.
 *
 * The whole 64-byte header is the cipher's additional authenticated data, so a
 * flipped salt or a lowered work factor is caught by the tag rather than
 * quietly changing what gets derived.
 */

const MAGIC = Buffer.from('OWAENC\0', 'latin1');
const CONTAINER_VERSION = 1;
const KDF_SCRYPT = 1;
const HEADER_LENGTH = 64;

const KEY_LENGTH = 32;
const KEY_CHECK_LENGTH = 16;
/** The key and the key check come out of ONE derivation, in that order. */
const DERIVED_LENGTH = KEY_LENGTH + KEY_CHECK_LENGTH;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const SALT_OFFSET = 16;
const IV_OFFSET = 32;
const KEY_CHECK_OFFSET = 48;

/**
 * scrypt at N=2^15, r=8, p=1: a 32MB working set, transient, ONCE per export or
 * import — not per chunk and not per retry beyond the single derivation. It is
 * the accepted floor for a human-chosen password, which is exactly what a bundle
 * carried on a USB stick is protected by.
 *
 * The parameters travel in the header, so raising them later strands nothing
 * already written.
 */
const SCRYPT_LOG2_N = 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

export type ArchiveDecryptResultType =
    | { isOk: true }
    | {
          isOk: false;
          reason: 'wrong-password' | 'not-encrypted' | 'unsupported';
      };

/**
 * Node's scrypt defaults to a 32MB cap, which is EXACTLY what N=2^15,r=8 asks
 * for — it throws without an explicit, larger `maxmem`.
 */
function deriveKey(
    password: string,
    salt: Buffer,
    N: number,
    r: number,
    p: number,
) {
    return new Promise<Buffer>((resolve, reject) => {
        scrypt(
            // Normalised so a Khmer or accented password typed on two machines
            // with different input methods still derives the same key.
            password.normalize('NFKC'),
            salt,
            DERIVED_LENGTH,
            { N, r, p, maxmem: 256 * N * r + 1024 * 1024 },
            (error, derived) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(derived as Buffer);
                }
            },
        );
    });
}

function buildHeader(salt: Buffer, iv: Buffer, keyCheck: Buffer) {
    const header = Buffer.alloc(HEADER_LENGTH);
    MAGIC.copy(header, 0);
    header.writeUInt8(CONTAINER_VERSION, MAGIC.length);
    header.writeUInt8(KDF_SCRYPT, 8);
    header.writeUInt8(SCRYPT_LOG2_N, 9);
    header.writeUInt8(SCRYPT_R, 10);
    header.writeUInt8(SCRYPT_P, 11);
    salt.copy(header, SALT_OFFSET);
    iv.copy(header, IV_OFFSET);
    keyCheck.copy(header, KEY_CHECK_OFFSET);
    return header;
}

type ParsedHeaderType = {
    N: number;
    r: number;
    p: number;
    salt: Buffer;
    iv: Buffer;
    keyCheck: Buffer;
};

/** `null` when this is not one of ours, or is one this build cannot read. */
function parseHeader(header: Buffer): ParsedHeaderType | null {
    if (
        header.length < HEADER_LENGTH ||
        !header.subarray(0, MAGIC.length).equals(MAGIC) ||
        header.readUInt8(MAGIC.length) !== CONTAINER_VERSION ||
        header.readUInt8(8) !== KDF_SCRYPT
    ) {
        return null;
    }
    const log2N = header.readUInt8(9);
    const r = header.readUInt8(10);
    const p = header.readUInt8(11);
    // A hand-edited header must not be able to ask for gigabytes of scrypt
    // memory. The recorded parameters are honoured, but only within what this
    // build is willing to spend.
    if (log2N < 10 || log2N > 20 || r < 1 || r > 32 || p < 1 || p > 16) {
        return null;
    }
    return {
        N: 2 ** log2N,
        r,
        p,
        salt: header.subarray(SALT_OFFSET, SALT_OFFSET + SALT_LENGTH),
        iv: header.subarray(IV_OFFSET, IV_OFFSET + IV_LENGTH),
        keyCheck: header.subarray(
            KEY_CHECK_OFFSET,
            KEY_CHECK_OFFSET + KEY_CHECK_LENGTH,
        ),
    };
}

async function readBytesAt(filePath: string, position: number, length: number) {
    const fileHandle = await open(filePath, 'r');
    try {
        const buffer = Buffer.alloc(length);
        const { bytesRead } = await fileHandle.read(
            buffer,
            0,
            length,
            position,
        );
        return buffer.subarray(0, bytesRead);
    } finally {
        await fileHandle.close();
    }
}

// A half-written output is worse than none: it looks like an archive to
// everything downstream. Both directions build under `.part` and rename only
// once the last byte is in, so a crash leaves nothing importable behind.
async function attemptDeleting(filePath: string) {
    try {
        await rm(filePath, { force: true });
    } catch (_error) {}
}

/** Whether the file carries a container this build can open. */
export async function checkIsEncryptedFile(filePath: string) {
    try {
        const header = await readBytesAt(filePath, 0, HEADER_LENGTH);
        return parseHeader(header) !== null;
    } catch (_error) {
        return false;
    }
}

export async function encryptFile(
    filePath: string,
    outputFilePath: string,
    password: string,
) {
    if (!password) {
        throw new Error('A password is required to protect an archive');
    }
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);
    const derived = await deriveKey(
        password,
        salt,
        2 ** SCRYPT_LOG2_N,
        SCRYPT_R,
        SCRYPT_P,
    );
    const header = buildHeader(
        salt,
        iv,
        derived.subarray(KEY_LENGTH, DERIVED_LENGTH),
    );
    const cipher = createCipheriv(
        'aes-256-gcm',
        derived.subarray(0, KEY_LENGTH),
        iv,
        { authTagLength: AUTH_TAG_LENGTH },
    );
    cipher.setAAD(header);
    const partFilePath = `${outputFilePath}.part`;
    const writeStream = createWriteStream(partFilePath);
    try {
        // The header is plaintext and goes out before the cipher stream is
        // attached, so a reader learns the salt without the password.
        writeStream.write(header);
        // `end: false` keeps the file open past the ciphertext, because the
        // auth tag only exists once the cipher has seen its last byte.
        await pipeline(createReadStream(filePath), cipher, writeStream, {
            end: false,
        });
        await new Promise<void>((resolve, reject) => {
            writeStream.on('error', reject);
            writeStream.end(cipher.getAuthTag(), resolve);
        });
        await rename(partFilePath, outputFilePath);
    } catch (error) {
        writeStream.destroy();
        await attemptDeleting(partFilePath);
        throw error;
    }
}

/**
 * A wrong password comes back as a RESULT, not a throw. Electron's structured
 * clone of an `Error` keeps only its message, so a thrown sentinel would have to
 * be recognised by string-matching text that anyone might reword; a plain object
 * crosses the bridge intact. Genuine I/O failures still throw.
 */
export async function decryptFile(
    filePath: string,
    outputFilePath: string,
    password: string,
): Promise<ArchiveDecryptResultType> {
    const { size } = await stat(filePath);
    if (size < HEADER_LENGTH + AUTH_TAG_LENGTH) {
        return { isOk: false, reason: 'not-encrypted' };
    }
    const header = await readBytesAt(filePath, 0, HEADER_LENGTH);
    const parsedHeader = parseHeader(header);
    if (parsedHeader === null) {
        return {
            isOk: false,
            reason: header.subarray(0, MAGIC.length).equals(MAGIC)
                ? 'unsupported'
                : 'not-encrypted',
        };
    }
    const { N, r, p, salt, iv, keyCheck } = parsedHeader;
    const derived = await deriveKey(password, salt, N, r, p);
    // The whole point of the key check: GCM only reports a bad key at `final()`,
    // which on a multi-GB data archive means reading every byte before saying
    // "wrong password". This answers after one derivation and no file I/O.
    if (
        !timingSafeEqual(derived.subarray(KEY_LENGTH, DERIVED_LENGTH), keyCheck)
    ) {
        return { isOk: false, reason: 'wrong-password' };
    }
    // GCM verifies as it goes, so the tag has to be handed over BEFORE the
    // stream starts — it is read on its own from the tail of the file.
    const authTag = await readBytesAt(
        filePath,
        size - AUTH_TAG_LENGTH,
        AUTH_TAG_LENGTH,
    );
    const decipher = createDecipheriv(
        'aes-256-gcm',
        derived.subarray(0, KEY_LENGTH),
        iv,
        { authTagLength: AUTH_TAG_LENGTH },
    );
    decipher.setAAD(header);
    decipher.setAuthTag(authTag);
    const partFilePath = `${outputFilePath}.part`;
    const cipherTextLength = size - HEADER_LENGTH - AUTH_TAG_LENGTH;
    try {
        if (cipherTextLength === 0) {
            // An empty payload has no byte range to stream — `start` would land
            // past `end` and `createReadStream` throws. The tag still has to be
            // verified, which is what `final()` does.
            decipher.final();
            await writeFile(partFilePath, Buffer.alloc(0));
        } else {
            await pipeline(
                createReadStream(filePath, {
                    start: HEADER_LENGTH,
                    // `end` is INCLUSIVE, so this is the byte just before the
                    // tag.
                    end: size - AUTH_TAG_LENGTH - 1,
                }),
                decipher,
                createWriteStream(partFilePath),
            );
        }
        await rename(partFilePath, outputFilePath);
        return { isOk: true };
    } catch (error) {
        await attemptDeleting(partFilePath);
        // The key check already passed, so this is not a wrong password — the
        // archive itself is damaged.
        // `cause` is attached rather than passed to the constructor: the
        // electron build targets a lib without the two-argument `Error`.
        const damagedError = new Error('This protected archive is damaged');
        (damagedError as any).cause = error;
        throw damagedError;
    }
}
