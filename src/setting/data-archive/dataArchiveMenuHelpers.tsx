import {
    registerAppMenuClicked,
    setAppMenuItems,
    tran,
} from '../../lang/langHelpers';
import { showAppInput } from '../../popup-widget/popupWidgetHelpers';
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
 * Ask which folders to act on. Returns null when the user cancels or unchecks
 * everything — `showAppInput` only resolves Ok/Cancel, so the live selection is
 * captured here.
 */
async function askForFolders(
    title: string,
    message: string,
    choices: DataFolderChoiceType[],
) {
    let selectedKeys = choices.map((choice) => {
        return choice.key;
    });
    const isOk = await showAppInput(
        title,
        <DataFolderSelectorComp
            choices={choices}
            message={message}
            onChange={(newSelectedKeys) => {
                selectedKeys = newSelectedKeys;
            }}
        />,
        { escToCancel: true },
    );
    if (!isOk || selectedKeys.length === 0) {
        return null;
    }
    return selectedKeys;
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
        const selectedKeys = await askForFolders(
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
        );
        if (selectedKeys === null) {
            return;
        }
        const selectedFolders = folders.filter(({ dataDirectory }) => {
            return selectedKeys.includes(dataDirectory.settingName);
        });
        const archiveFilePath = await runWithProgress(EXPORT_TITLE, () => {
            return exportData(selectedFolders);
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
                { name: 'Open Worship Data Archive', extensions: ['tar'] },
            ]);
            archiveFilePath = filePaths[0];
        }
        if (!archiveFilePath) {
            return;
        }
        const knownArchiveFilePath = archiveFilePath;
        // Only the manifest is unpacked at this point; the archive may be
        // gigabytes and the user has not chosen anything yet.
        const manifest = await runWithProgress(IMPORT_TITLE, () => {
            return readDataArchiveManifest(knownArchiveFilePath);
        });
        const selectedKeys = await askForFolders(
            IMPORT_TITLE,
            'Choose the folders to import',
            toImportChoices(manifest.folders),
        );
        if (selectedKeys === null) {
            return;
        }
        const selectedFolders = manifest.folders.filter((folder) => {
            return selectedKeys.includes(folder.settingName);
        });
        const { copied, reused } = await runWithProgress(IMPORT_TITLE, () => {
            return importDataArchive(knownArchiveFilePath, selectedFolders);
        });
        showSimpleToast(
            IMPORT_TITLE,
            `Imported ${copied} file(s); ${reused} already up to date`,
        );
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
