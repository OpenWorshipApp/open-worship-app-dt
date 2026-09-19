import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    checkIsEncryptedFileMock,
    decryptFileMock,
    encryptFileMock,
    fsDeleteFileMock,
    askForArchivePasswordMock,
    askForNewArchivePasswordMock,
} = vi.hoisted(() => ({
    checkIsEncryptedFileMock: vi.fn(),
    decryptFileMock: vi.fn(),
    encryptFileMock: vi.fn(),
    fsDeleteFileMock: vi.fn(),
    askForArchivePasswordMock: vi.fn(),
    askForNewArchivePasswordMock: vi.fn(),
}));

vi.mock('../server/appHelpers', () => ({
    checkIsEncryptedFile: checkIsEncryptedFileMock,
    decryptFile: decryptFileMock,
    encryptFile: encryptFileMock,
}));

vi.mock('../server/fileHelpers', () => ({
    fsDeleteFile: fsDeleteFileMock,
    pathJoin: (...parts: string[]) => parts.join('/'),
}));

// The dialog is loaded on demand, so this stands in for the real module the
// dynamic `import()` reaches.
vi.mock('../popup-widget/ArchivePasswordComp', () => ({
    askForArchivePassword: askForArchivePasswordMock,
    askForNewArchivePassword: askForNewArchivePasswordMock,
}));

import {
    openArchiveForReading,
    protectArchiveFile,
} from './archivePasswordHelpers';

const ARCHIVE = '/downloads/Service.owapf.enc';
const WORK_DIR = '/system-temp/owapf-import-run-id';
const PLAIN = `${WORK_DIR}/decrypted-archive`;

beforeEach(() => {
    checkIsEncryptedFileMock.mockResolvedValue(true);
    decryptFileMock.mockResolvedValue({ isOk: true });
});

describe('protecting an exported archive', () => {
    test('drops the plain copy once it is wrapped', async () => {
        expect(
            await protectArchiveFile('/tmp/plain.tmp', ARCHIVE, 'secret'),
        ).toBe(ARCHIVE);

        expect(encryptFileMock).toHaveBeenCalledWith(
            '/tmp/plain.tmp',
            ARCHIVE,
            'secret',
        );
        expect(fsDeleteFileMock).toHaveBeenCalledWith('/tmp/plain.tmp');
    });

    // The unprotected copy must not survive a failed wrap either — it is the
    // very thing the password was meant to keep off the disk.
    test('drops the plain copy even when the wrap fails', async () => {
        encryptFileMock.mockRejectedValue(new Error('disk full'));

        await expect(
            protectArchiveFile('/tmp/plain.tmp', ARCHIVE, 'secret'),
        ).rejects.toThrow('disk full');

        expect(fsDeleteFileMock).toHaveBeenCalledWith('/tmp/plain.tmp');
    });
});

describe('opening an archive for reading', () => {
    test('hands an unprotected archive straight back', async () => {
        checkIsEncryptedFileMock.mockResolvedValue(false);

        const readable = await openArchiveForReading(
            '/downloads/Service.owapf.tar.gz',
            WORK_DIR,
            'Import Presenting Flow',
        );

        expect(readable?.filePath).toBe('/downloads/Service.owapf.tar.gz');
        // No prompt, no decrypt: an unprotected import costs exactly one
        // header read more than it did before this feature existed.
        expect(askForArchivePasswordMock).not.toHaveBeenCalled();
        expect(decryptFileMock).not.toHaveBeenCalled();
    });

    test('decrypts into the work dir the import already cleans up', async () => {
        askForArchivePasswordMock.mockResolvedValue('secret');

        const readable = await openArchiveForReading(
            ARCHIVE,
            WORK_DIR,
            'Import Presenting Flow',
        );

        expect(readable?.filePath).toBe(PLAIN);
        expect(decryptFileMock).toHaveBeenCalledWith(ARCHIVE, PLAIN, 'secret');
    });

    test('asks again after a wrong password, then gives up', async () => {
        askForArchivePasswordMock.mockResolvedValue('wrong');
        decryptFileMock.mockResolvedValue({
            isOk: false,
            reason: 'wrong-password',
        });

        await expect(
            openArchiveForReading(ARCHIVE, WORK_DIR, 'Import Presenting Flow'),
        ).rejects.toThrow('Wrong password');

        expect(askForArchivePasswordMock).toHaveBeenCalledTimes(3);
        // The first ask says only that a password is needed; the retries say
        // the last one was wrong.
        expect(askForArchivePasswordMock.mock.calls[0][1]).toBeUndefined();
        expect(askForArchivePasswordMock.mock.calls[1][1]).toBe(
            'Wrong password, try again',
        );
        expect(fsDeleteFileMock).toHaveBeenCalledWith(PLAIN);
    });

    test('takes the right password on the second try', async () => {
        askForArchivePasswordMock
            .mockResolvedValueOnce('wrong')
            .mockResolvedValueOnce('secret');
        decryptFileMock
            .mockResolvedValueOnce({ isOk: false, reason: 'wrong-password' })
            .mockResolvedValueOnce({ isOk: true });

        const readable = await openArchiveForReading(
            ARCHIVE,
            WORK_DIR,
            'Import Presenting Flow',
        );

        expect(readable?.filePath).toBe(PLAIN);
        expect(askForArchivePasswordMock).toHaveBeenCalledTimes(2);
    });

    // Backing out is not a failure, so it answers `null` rather than throwing
    // and the caller's toast never fires.
    test('answers null when the prompt is cancelled', async () => {
        askForArchivePasswordMock.mockResolvedValue(null);

        expect(
            await openArchiveForReading(
                ARCHIVE,
                WORK_DIR,
                'Import Presenting Flow',
            ),
        ).toBeNull();
        expect(decryptFileMock).not.toHaveBeenCalled();
    });

    test('does not offer a retry for an archive it cannot read at all', async () => {
        askForArchivePasswordMock.mockResolvedValue('secret');
        decryptFileMock.mockResolvedValue({
            isOk: false,
            reason: 'unsupported',
        });

        await expect(
            openArchiveForReading(ARCHIVE, WORK_DIR, 'Import Presenting Flow'),
        ).rejects.toThrow('cannot be opened by this version');

        expect(askForArchivePasswordMock).toHaveBeenCalledTimes(1);
    });
});
