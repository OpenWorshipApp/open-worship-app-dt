import { tran } from '../lang/langHelpers';

// What a person reads when a file could not be saved, made, copied or
// renamed (EN-62). These toasts used to show Node's own message --
// "EROFS: read-only file system, open '/Volumes/…/Sunday.slides'" -- in
// English in every window, for four seconds, and it was the only sign the
// song was not saved. The code says what happened; the sentence says what to
// do about it. The raw message is the log's (`handleError`).
//
// A leaf on purpose: only `tran`, so `fileHelpers` and `FileSource` can take
// it without pulling anything else in.

/** A failure is read slower than news: long enough to look back from the projector. */
export const FILE_ERROR_TOAST_TIMEOUT = 10e3;

/** An error that says which failure it is the way Node's own do, by `code`. */
export function genCodedError(message: string, code: string) {
    return Object.assign(new Error(message), { code });
}

// The code of the error or of what it wraps: `fsCheckFileExist` re-throws a
// failed `stat` as its own error with the real one as `cause`.
function readErrorCode(error: unknown) {
    let current = error;
    for (let depth = 0; depth < 3; depth++) {
        if (typeof current !== 'object' || current === null) {
            return undefined;
        }
        const { code, cause } = current as { code?: unknown; cause?: unknown };
        if (typeof code === 'string') {
            return code;
        }
        current = cause;
    }
    return undefined;
}

export function toFileErrorText(error: unknown) {
    switch (readErrorCode(error)) {
        case 'ENOENT':
        case 'ENOTDIR':
            return tran(
                'The file or its folder is not there any more. ' +
                    'Check that its drive is connected.',
            );
        case 'EACCES':
        case 'EPERM':
            // Windows answers EPERM for a file another program holds open as
            // well as for one it may not change, so the sentence names both.
            return tran(
                'This file or folder cannot be changed. ' +
                    'Check that it is not read-only or open in another program.',
            );
        case 'EROFS':
            return tran(
                'This drive is read-only. Choose a folder on another drive.',
            );
        case 'ENOSPC':
            return tran('The disk is full. Free some space, then try again.');
        case 'EBUSY':
            return tran(
                'Another program is using this file. Close it, then try again.',
            );
        case 'EEXIST':
            return tran(
                'A file with this name is already there. Choose another name.',
            );
        default:
            return tran('It did not work. Please try again.');
    }
}
