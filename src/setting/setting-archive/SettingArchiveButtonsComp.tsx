import { useCallback } from 'react';

import { handleError } from '../../helper/errorHelpers';
import { tran } from '../../lang/langHelpers';
import appProvider from '../../server/appProvider';

/**
 * **Export Settings / Import Settings**, under Apply Settings in the Settings
 * window's sidebar, so they are there from every tab.
 *
 * Only the buttons live here. The flows reach the archive, password, tar and
 * tree-picker modules, none of which the Settings window needs until one of
 * these is pressed, so they are imported then.
 */

function importSettingArchiveFlows() {
    return import('./settingArchiveMenuHelpers');
}

// A native file dialog cannot be driven over CDP, so an automated QA run (and
// a developer) gets the same two flows with the path handed in. Same dev-only
// pattern as `tryDataExport` / `tryBibleXMLExport`.
if (appProvider.systemUtils.isDev) {
    (globalThis as any).trySettingsExport = async () => {
        const { handleSettingsExporting } = await importSettingArchiveFlows();
        return handleSettingsExporting();
    };
    (globalThis as any).trySettingsImport = async (
        archiveFilePath?: string,
    ) => {
        const { handleSettingsImporting } = await importSettingArchiveFlows();
        return handleSettingsImporting(archiveFilePath);
    };
}

export default function SettingArchiveButtonsComp() {
    const handleExporting = useCallback(async () => {
        try {
            const { handleSettingsExporting } =
                await importSettingArchiveFlows();
            await handleSettingsExporting();
        } catch (error) {
            handleError(error);
        }
    }, []);
    const handleImporting = useCallback(async () => {
        try {
            const { handleSettingsImporting } =
                await importSettingArchiveFlows();
            await handleSettingsImporting();
        } catch (error) {
            handleError(error);
        }
    }, []);
    return (
        <>
            <button
                className="btn btn-sm btn-outline-secondary"
                type="button"
                title={tran('Export settings to a file')}
                onClick={handleExporting}
            >
                <i className="bi bi-box-arrow-up me-1" />
                {tran('Export Settings')}
            </button>
            <button
                className="btn btn-sm btn-outline-secondary"
                type="button"
                title={tran('Import settings from a file')}
                onClick={handleImporting}
            >
                <i className="bi bi-box-arrow-in-down me-1" />
                {tran('Import Settings')}
            </button>
        </>
    );
}
