import { tran } from '../lang/langHelpers';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';
import { showFileOrDirExplorer, tarExtract } from '../server/appHelpers';
import {
    ensureDirectory,
    fsCopyFilePathToPath,
    fsDeleteDir,
    fsReadFile,
    getDownloadPath,
    getTempPath,
    pathJoin,
    selectFiles,
} from '../server/fileHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import { appError as logError } from './loggerHelpers';

// A downloaded pack -- the Extra Binaries' media tools, a language -- saved as
// a file, passed to a friend and installed from it (2026-11-04, the user: _as
// a user I want to able to store the extra-bin and language downloaded file
// somewhere so I can share to my friend easily_). What both kinds share.
//
// Both hold code the app runs: the pack's programs are spawned, a language's
// script is loaded by every window, with Node in reach. A file whose checksum
// matches a published pack IS that pack; any other is asked about first.

/** Answers the path picked, or null when the dialog was closed. */
export async function pickPackFile() {
    const filePaths = await selectFiles([
        { name: 'Open Worship Pack', extensions: ['gz', 'tgz'] },
    ]);
    return filePaths[0] || null;
}

/**
 * Reads ONE json file out of a pack without unpacking the rest: a pack is
 * tens of MB, and one for another computer must never overwrite this one's.
 * Null when the file is not there, or not json.
 */
export async function readPackFileJson(
    archiveFilePath: string,
    entryFileName: string,
): Promise<unknown> {
    const randomId =
        globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const workDirPath = pathJoin(getTempPath(), `owa-pack-check-${randomId}`);
    try {
        await ensureDirectory(workDirPath);
        await tarExtract(archiveFilePath, workDirPath, [entryFileName]);
        return JSON.parse(
            await fsReadFile(pathJoin(workDirPath, entryFileName)),
        );
    } catch (error) {
        logError(error);
        return null;
    } finally {
        await fsDeleteDir(workDirPath).catch(() => {});
    }
}

/** The toast for a file that cannot be installed; `detail` says why. */
export function toNotInstallablePackMessage(detail: string) {
    return `${tran('This file is not a pack this app can install')}: ${detail}`;
}

/** True when the person still wants a pack no published one vouches for. */
export function confirmUnverifiedPackFile() {
    return showAppConfirm(
        tran('Import'),
        tran(
            'This file could not be checked against the published list. ' +
                'It holds programs the app runs: import it only if it comes ' +
                'from someone you trust.',
        ),
        { cancelButtonLabel: 'Cancel', confirmButtonLabel: 'Import' },
    );
}

/**
 * Copies a pack into Downloads under `fileFullName` (de-duplicated, never
 * overwriting) and shows it there, as every export of this app does. Answers
 * the new path, or null when the copy failed (it has said so).
 */
export async function exportPackFile(
    toastTitle: string,
    filePath: string,
    fileFullName: string,
) {
    const exportedFilePath = await fsCopyFilePathToPath(
        filePath,
        getDownloadPath(),
        fileFullName,
    );
    if (exportedFilePath === null) {
        return null;
    }
    showSimpleToast(toastTitle, `${tran('Exported to')} ${exportedFilePath}`);
    showFileOrDirExplorer(exportedFilePath);
    return exportedFilePath;
}
