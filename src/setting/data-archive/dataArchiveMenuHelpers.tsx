import { tran } from '../../lang/langHelpers';
import {
    BIBLE_XML_ARCHIVE_ITEM_KIND,
    createWorkDir,
    safeDeleteDir,
} from '../../helper/appArchiveHelpers';
import { openArchiveForReading } from '../../helper/archivePasswordHelpers';
import {
    ArchivePasswordComp,
    MAX_PASSWORD_ATTEMPTS,
} from '../../popup-widget/ArchivePasswordComp';
import { showAppInput } from '../../popup-widget/popupWidgetHelpers';
import {
    hideProgressBar,
    showProgressBar,
} from '../../progress-bar/progressBarHelpers';
import { selectFiles } from '../../server/fileHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import { getDataDirectoryBySettingName } from '../directory-setting/dataDirectories';
import ArchiveItemSelectorComp, {
    type ArchiveItemChoiceType,
} from '../../popup-widget/ArchiveItemSelectorComp';
import type { DataArchiveFolderType } from './dataArchiveHelpers';
import {
    EXPORT_TITLE,
    IMPORT_TITLE,
    exportData,
    getExportableDataFolders,
    importDataArchive,
    readDataArchiveManifest,
    reportDataArchiveError,
} from './dataArchiveHelpers';

/**
 * What the **File → Export Data / Import Data** entries DO. The entries
 * themselves are contributed by `DataArchiveAppMenuComp.tsx`, which imports
 * this module only when one of them is clicked: everything here reaches the
 * archive, password and folder-picker modules, and no page needs those before.
 */

/**
 * Ask which folders to act on, and — on the way out — what to protect the
 * archive with. Returns null when the user cancels or unchecks everything;
 * `showAppInput` only resolves Ok/Cancel, so the live answers are captured here.
 *
 * The password fields ride INSIDE this dialog rather than in one of their own:
 * exporting is one action and asking twice for it would be two dialogs for a
 * single click. Importing does not use them — by the time this is reached, the
 * archive has already been opened and any password it needed was asked for
 * against the file itself.
 */
async function askForFolders(
    title: string,
    message: string,
    choices: ArchiveItemChoiceType[],
    isAskingNewPassword = false,
) {
    let invalidMessage: string | undefined = undefined;
    // A LOOP, and deliberately not `showAppAlert` + recursion — see the twin of
    // this function in `bibleXMLArchiveMenuHelpers.tsx` for the whole story.
    //
    // Short version: an alert between the two `showAppInput` calls unmounts the
    // popup and throws away both children's state, so the re-ask came back with
    // the password fields blank and every folder re-checked. An operator who
    // picked one small folder, mistyped the confirmation and pressed Ok again
    // got their ENTIRE data directory, unprotected, with nothing said about it.
    for (let attempt = 0; attempt < MAX_PASSWORD_ATTEMPTS; attempt++) {
        let selectedKeys = choices.map((choice) => {
            return choice.key;
        });
        let password = '';
        let confirmedPassword = '';
        const isOk = await showAppInput(
            // The popup renders its title raw, so it is translated here.
            tran(title),
            <>
                <ArchiveItemSelectorComp
                    choices={choices}
                    message={message}
                    onChange={(newSelectedKeys) => {
                        selectedKeys = newSelectedKeys;
                    }}
                />
                {isAskingNewPassword ? (
                    <div className="mt-3 pt-3 border-top">
                        <ArchivePasswordComp
                            isConfirming
                            invalidMessage={invalidMessage}
                            onChange={(newPassword, newConfirmedPassword) => {
                                password = newPassword;
                                confirmedPassword = newConfirmedPassword;
                            }}
                        />
                    </div>
                ) : null}
            </>,
            { escToCancel: true },
        );
        if (!isOk || selectedKeys.length === 0) {
            return null;
        }
        if (password === confirmedPassword) {
            return { selectedKeys, password: password || null };
        }
        invalidMessage = 'Passwords do not match';
    }
    return null;
}

/**
 * Run one step under the progress bar. Written once because the failure mode of
 * a hand-balanced show/hide pair is a progress bar that never goes away, and it
 * is invisible until it happens.
 */
async function runWithProgress<T>(title: string, run: () => Promise<T>) {
    showProgressBar(title);
    try {
        return await run();
    } finally {
        hideProgressBar(title);
    }
}

/** Both flows end the same way: log it and say so under their own title. */
async function runMenuAction(title: string, run: () => Promise<void>) {
    try {
        await run();
    } catch (error: any) {
        showSimpleToast(tran(title), reportDataArchiveError(title, error));
    }
}

export async function handleExporting() {
    return await runMenuAction(EXPORT_TITLE, async () => {
        const folders = await getExportableDataFolders();
        if (folders.length === 0) {
            showSimpleToast(
                tran(EXPORT_TITLE),
                'No data folder is set up yet — choose them in Settings →' +
                    ' Path Settings first',
            );
            return;
        }
        const answer = await askForFolders(
            EXPORT_TITLE,
            'Choose the folders to export',
            folders.map(({ dataDirectory, dirPath }) => {
                return {
                    key: dataDirectory.settingName,
                    // The selector renders titles raw — a bible row's title is
                    // its key, which has no dictionary entry — so a fixed one
                    // like this is translated here.
                    title: tran(dataDirectory.title),
                    iconClassName: dataDirectory.iconClassName,
                    detail: dirPath,
                };
            }),
            true,
        );
        if (answer === null) {
            return;
        }
        const { selectedKeys, password } = answer;
        const selectedFolders = folders.filter(({ dataDirectory }) => {
            return selectedKeys.includes(dataDirectory.settingName);
        });
        const archiveFilePath = await runWithProgress(EXPORT_TITLE, () => {
            return exportData(selectedFolders, password);
        });
        showSimpleToast(
            tran(EXPORT_TITLE),
            `${tran('Exported to')} ${archiveFilePath}`,
        );
    });
}

function toImportChoices(folders: DataArchiveFolderType[]) {
    const choices: ArchiveItemChoiceType[] = [];
    for (const folder of folders) {
        const dataDirectory = getDataDirectoryBySettingName(folder.settingName);
        if (dataDirectory === null) {
            continue;
        }
        choices.push({
            key: folder.settingName,
            title: tran(dataDirectory.title),
            iconClassName: dataDirectory.iconClassName,
            detail: folder.entry,
        });
    }
    return choices;
}

// `archiveFilePath` skips the file picker when the archive is already known
// (a dropped file, or an automated run that cannot drive a native dialog).
export async function handleImporting(archiveFilePath?: string) {
    return await runMenuAction(IMPORT_TITLE, async () => {
        if (archiveFilePath === undefined) {
            const filePaths = await selectFiles([
                {
                    name: 'Open Worship Data Archive',
                    // `enc` is the password protected shape of the same archive.
                    extensions: ['tar', 'enc'],
                },
            ]);
            archiveFilePath = filePaths[0];
        }
        if (!archiveFilePath) {
            return;
        }
        // Opened ONCE for both the manifest read and the restore. This is the
        // only flow that reaches into an archive twice, and a protected one has
        // to be unwrapped whole before anything inside it can be read — doing
        // that twice on a data set this size is minutes of I/O and a second
        // full-size temp copy, for nothing.
        const workDir = await createWorkDir('owadata-read');
        try {
            const readableArchive = await openArchiveForReading(
                archiveFilePath,
                workDir,
                IMPORT_TITLE,
            );
            if (readableArchive === null) {
                return;
            }
            const readableFilePath = readableArchive.filePath;
            // Only the manifest is unpacked at this point; the archive may be
            // gigabytes and the user has not chosen anything yet.
            const manifest = await runWithProgress(IMPORT_TITLE, () => {
                return readDataArchiveManifest(readableFilePath);
            });
            if (manifest.kind === BIBLE_XML_ARCHIVE_ITEM_KIND) {
                // A Bible Data bundle picked here by mistake. It goes on to
                // Import Bible Data as the DECRYPTED copy, which that flow
                // opens as a plain archive: no second password prompt, and no
                // second pass over the file. Loaded only now — it reaches the
                // bible XML readers, which an ordinary data import never needs.
                const { handleBibleXMLImporting } =
                    await import('../bible-setting/bibleXMLArchiveMenuHelpers');
                await handleBibleXMLImporting(readableFilePath);
                return;
            }
            const answer = await askForFolders(
                IMPORT_TITLE,
                'Choose the folders to import',
                toImportChoices(manifest.folders),
            );
            if (answer === null) {
                return;
            }
            const selectedFolders = manifest.folders.filter((folder) => {
                return answer.selectedKeys.includes(folder.settingName);
            });
            const { copied, reused } = await runWithProgress(
                IMPORT_TITLE,
                () => {
                    return importDataArchive(readableFilePath, selectedFolders);
                },
            );
            showSimpleToast(
                tran(IMPORT_TITLE),
                `Imported ${copied} file(s); ${reused} already up to date`,
            );
        } finally {
            await safeDeleteDir(workDir);
        }
    });
}
