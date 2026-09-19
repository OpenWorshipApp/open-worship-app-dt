import { useAppEffect } from '../../helper/appHooks';
import { handleError } from '../../helper/errorHelpers';
import {
    registerAppMenuClicked,
    setAppMenuItems,
    tran,
} from '../../lang/langHelpers';
import { checkIsMainWindow } from '../../server/appHelpers';
import appProvider from '../../server/appProvider';

/**
 * The **File → Export Data / Import Data** entries. They are contributed to the
 * native menu by the renderer (`setAppMenuItems`, the same mechanism the
 * language packs use for their Tools items) rather than hard-coded in
 * `electron/electronMenu.ts`, so their labels go through `tran` where the
 * loaded locale actually lives, and the work runs in the window that owns the
 * data — clicks come back to THIS renderer, not whichever window has focus.
 *
 * Mounted by every page the MAIN window shows that should carry them — the
 * Presenter and the Reader — and only there: the entries are keyed, so a popup
 * (the Reader opened on its own) would take the key over and route the main
 * window's clicks to itself, then drop them once it closed.
 *
 * This module is only the menu. The flows (`dataArchiveMenuHelpers.tsx`) reach
 * the archive, password and folder-picker modules, none of which a page needs
 * until one of the two entries is actually clicked, so they are imported then.
 */

const MENU_KEY = 'data-archive';
const EXPORT_CLICK = 'data-archive:export';
const IMPORT_CLICK = 'data-archive:import';

function importDataArchiveFlows() {
    return import('./dataArchiveMenuHelpers');
}

async function handleDataArchiveMenuClicked(
    _event: any,
    clickData: { dataArchive?: string },
) {
    // Every menu click reaches every listener, so this must check the key
    // BEFORE importing anything.
    const dataArchive = clickData?.dataArchive;
    if (dataArchive !== EXPORT_CLICK && dataArchive !== IMPORT_CLICK) {
        return;
    }
    try {
        const { handleExporting, handleImporting } =
            await importDataArchiveFlows();
        if (dataArchive === EXPORT_CLICK) {
            await handleExporting();
        } else {
            await handleImporting();
        }
    } catch (error) {
        handleError(error);
    }
}

// The native menu is plain text, so the labels are translated here rather than
// rendered. They follow the locale because this re-runs on mount, and the app
// reloads its windows when the language changes.
function initDataArchiveAppMenu() {
    setAppMenuItems(MENU_KEY, {
        file: [
            {
                label: tran('Export Data'),
                clickData: { dataArchive: EXPORT_CLICK },
            },
            {
                label: tran('Import Data'),
                clickData: { dataArchive: IMPORT_CLICK },
            },
        ],
    });
}

// The File menu is drawn by the OS, so it is unreachable from CDP — these give
// an automated QA run (and a developer) a way to drive the same two flows the
// menu entries do. Same dev-only pattern as `tryPopup` / `testSimpleToasts`.
if (appProvider.systemUtils.isDev) {
    (globalThis as any).tryDataExport = async () => {
        const { handleExporting } = await importDataArchiveFlows();
        return handleExporting();
    };
    (globalThis as any).tryDataImport = async (archiveFilePath?: string) => {
        const { handleImporting } = await importDataArchiveFlows();
        return handleImporting(archiveFilePath);
    };
}

export default function DataArchiveAppMenuComp() {
    // The click listener is registered separately from the menu build for the
    // same reason the language menu splits them: the menu build cannot be undone
    // from an effect cleanup, but a listener left behind by StrictMode's double
    // mount would run every export twice.
    useAppEffect(() => {
        if (!checkIsMainWindow()) {
            return;
        }
        const unregister = registerAppMenuClicked(handleDataArchiveMenuClicked);
        initDataArchiveAppMenu();
        return unregister;
    }, []);
    return null;
}
