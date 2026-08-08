import {
    registerAppMenuClicked,
    setAppMenuItems,
    tran,
} from '../../lang/langHelpers';
import { createWorkDir, safeDeleteDir } from '../../helper/appArchiveHelpers';
import { openArchiveForReading } from '../../helper/archivePasswordHelpers';
import { ArchivePasswordComp } from '../../popup-widget/ArchivePasswordComp';
import {
    showAppAlert,
    showAppInput,
} from '../../popup-widget/popupWidgetHelpers';
import {
    hideProgressBar,
    showProgressBar,
} from '../../progress-bar/progressBarHelpers';
import appProvider from '../../server/appProvider';
import { selectFiles } from '../../server/fileHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import { getDataDirectoryBySettingName } from '../directory-setting/dataDirectories';
import DataFolderSelectorComp, {
    type DataFolderChoiceType,
} from './DataFolderSelectorComp';
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
 * The **File → Export Data / Import Data** entries. They are contributed to the
 * native menu by the renderer (`setAppMenuItems`, the same mechanism the
 * language packs use for their Tools items) rather than hard-coded in
 * `electron/electronMenu.ts`, so their labels go through `tran` where the
 * loaded locale actually lives, and the work runs in the window that owns the
 * data — clicks come back to THIS renderer, not whichever window has focus.
 */

const MENU_KEY = 'data-archive';
const EXPORT_CLICK = 'data-archive:export';
const IMPORT_CLICK = 'data-archive:import';

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
    choices: DataFolderChoiceType[],
    isAskingNewPassword = false,
) {
    let selectedKeys = choices.map((choice) => {
        return choice.key;
    });
    let password = '';
    let confirmedPassword = '';
    const isOk = await showAppInput(
        // The popup renders its title raw, so it is translated here.
        tran(title),
        <>
            <DataFolderSelectorComp
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
    // Ok cannot be vetoed from inside the popup (Enter confirms it outright), so
    // a mistyped confirmation is caught here and the dialog is re-opened. A
    // backup locked behind a password that was typed wrong once is a backup
    // that is gone.
    if (password !== '' && password !== confirmedPassword) {
        await showAppAlert(tran(title), tran('Passwords do not match'));
        return await askForFolders(
            title,
            message,
            choices,
            isAskingNewPassword,
        );
    }
    return { selectedKeys, password: password || null };
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
        showSimpleToast(title, reportDataArchiveError(title, error));
    }
}

async function handleExporting() {
    return await runMenuAction(EXPORT_TITLE, async () => {
        const folders = await getExportableDataFolders();
        if (folders.length === 0) {
            showSimpleToast(
                EXPORT_TITLE,
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
                    title: dataDirectory.title,
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
        showSimpleToast(EXPORT_TITLE, `Exported to ${archiveFilePath}`);
    });
}

function toImportChoices(folders: DataArchiveFolderType[]) {
    const choices: DataFolderChoiceType[] = [];
    for (const folder of folders) {
        const dataDirectory = getDataDirectoryBySettingName(folder.settingName);
        if (dataDirectory === null) {
            continue;
        }
        choices.push({
            key: folder.settingName,
            title: dataDirectory.title,
            iconClassName: dataDirectory.iconClassName,
            detail: folder.entry,
        });
    }
    return choices;
}

// `archiveFilePath` skips the file picker when the archive is already known
// (a dropped file, or an automated run that cannot drive a native dialog).
async function handleImporting(archiveFilePath?: string) {
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
                IMPORT_TITLE,
                `Imported ${copied} file(s); ${reused} already up to date`,
            );
        } finally {
            await safeDeleteDir(workDir);
        }
    });
}

function handleDataArchiveMenuClicked(
    _event: any,
    clickData: { dataArchive?: string },
) {
    if (clickData?.dataArchive === EXPORT_CLICK) {
        handleExporting();
    } else if (clickData?.dataArchive === IMPORT_CLICK) {
        handleImporting();
    }
}

// Separate from `initDataArchiveAppMenu` for the same reason the language menu
// splits them: the async menu build cannot be undone from an effect cleanup,
// but a listener left behind by StrictMode's double mount would run every
// export twice.
export function registerDataArchiveAppMenuClicked() {
    return registerAppMenuClicked(handleDataArchiveMenuClicked);
}

// The File menu is drawn by the OS, so it is unreachable from CDP — these give
// an automated QA run (and a developer) a way to drive the same two flows the
// menu entries do. Same dev-only pattern as `tryPopup` / `testSimpleToasts`.
if (appProvider.systemUtils.isDev) {
    (globalThis as any).tryDataExport = handleExporting;
    (globalThis as any).tryDataImport = handleImporting;
}

// The native menu is plain text, so the labels are translated here rather than
// rendered. They follow the locale because this re-runs on mount, and the app
// reloads its windows when the language changes.
export function initDataArchiveAppMenu() {
    setAppMenuItems(MENU_KEY, {
        file: [
            {
                label: tran(EXPORT_TITLE),
                clickData: { dataArchive: EXPORT_CLICK },
            },
            {
                label: tran(IMPORT_TITLE),
                clickData: { dataArchive: IMPORT_CLICK },
            },
        ],
    });
}
