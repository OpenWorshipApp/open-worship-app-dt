import {
    checkIsEncryptedFile,
    decryptFile,
    encryptFile,
} from '../server/appHelpers';
import { fsDeleteFile, pathJoin } from '../server/fileHelpers';

/**
 * The password half of exporting and importing an archive — everything the five
 * archive modules import.
 *
 * The DIALOG lives in `src/popup-widget/ArchivePasswordComp.tsx` and is loaded
 * on demand, never statically. That module reaches React and `tran`, and `tran`
 * reaches the whole loaded language pack; none of that belongs in the static
 * graph of a module that merely needs to be able to ask, and a password is only
 * ever asked for after a click. Keeping the edge dynamic is also what stops a
 * bundle helper from dragging the note editor's dependencies in behind it.
 */

/**
 * How many times a wrong password may be retyped before the flow gives up. The
 * container's key check makes each rejection cost one derivation and no file
 * I/O, so retrying is cheap even against a multi-gigabyte archive.
 */
const MAX_PASSWORD_ATTEMPTS = 3;

/** Ask what to protect an export with; `''` is "no password", `null` cancels. */
export async function askForNewArchivePassword(title: string) {
    const { askForNewArchivePassword: ask } =
        await import('../popup-widget/ArchivePasswordComp');
    return await ask(title);
}

/**
 * Wrap the plain archive an export just wrote and put the protected one at
 * `outputFilePath`, dropping the plain copy. Answers the final path so the
 * caller can go on reporting exactly one file.
 */
export async function protectArchiveFile(
    plainFilePath: string,
    outputFilePath: string,
    password: string,
) {
    try {
        await encryptFile(plainFilePath, outputFilePath, password);
    } finally {
        // In a `finally`, not after the await: the plain copy is the whole
        // point of the exercise and must not survive a failed wrap either.
        try {
            await fsDeleteFile(plainFilePath);
        } catch (_error) {}
    }
    return outputFilePath;
}

export type ReadableArchiveType = {
    /** Always a plain archive, ready for `tarExtract`. */
    filePath: string;
    /** Removes anything this wrote. A no-op for an unprotected archive. */
    dispose: () => Promise<void>;
};

/**
 * A plain archive path for `filePath`, asking for the password and decrypting
 * into `workDir` first when it turns out to be protected. `null` means the
 * operator cancelled — a cancel is not a failure and gets no toast.
 *
 * Detection is by the container magic, NOT by the file name. A bundle mailed
 * around or fetched from a URL arrives under whatever name that service chose,
 * and refusing it over a renamed extension would be a bug the operator has no
 * way to see. Extensions still decide *routing* — the drop gates and the file
 * dialogs work from a name, before any path is open — but once a path is in
 * hand the header is what answers. So a plain bundle someone renamed to `.enc`
 * simply imports, with no prompt at all.
 *
 * IMPORTANT for callers: an import that names what it created after the archive
 * FILE NAME (`importPresentingFlowArchive` does) must keep reading the ORIGINAL path
 * for that name, not this one — otherwise every protected presenting flow comes in
 * named after a temp file.
 */
export async function openArchiveForReading(
    filePath: string,
    workDir: string,
    title: string,
): Promise<ReadableArchiveType | null> {
    if (!(await checkIsEncryptedFile(filePath))) {
        // Not one of ours: handed straight back, so an unprotected import costs
        // nothing beyond the one header read.
        return { filePath, dispose: async () => {} };
    }
    // Alongside whatever the import is already unpacking, so the caller's
    // existing `safeDeleteDir(workDir)` carries it away too.
    const plainFilePath = pathJoin(workDir, 'decrypted-archive');
    const dispose = async () => {
        try {
            await fsDeleteFile(plainFilePath);
        } catch (_error) {}
    };
    const { askForArchivePassword } =
        await import('../popup-widget/ArchivePasswordComp');
    let invalidMessage: string | undefined = undefined;
    for (let attempt = 0; attempt < MAX_PASSWORD_ATTEMPTS; attempt++) {
        const password = await askForArchivePassword(title, invalidMessage);
        if (password === null) {
            return null;
        }
        const result = await decryptFile(filePath, plainFilePath, password);
        if (result.isOk) {
            return { filePath: plainFilePath, dispose };
        }
        if (result.reason !== 'wrong-password') {
            await dispose();
            throw new Error('This archive cannot be opened by this version');
        }
        invalidMessage = 'Wrong password, try again';
    }
    await dispose();
    throw new Error('Wrong password');
}
