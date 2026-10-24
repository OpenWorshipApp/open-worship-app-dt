import { useCallback, useState } from 'react';

import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';
import appProvider from '../server/appProvider';
import { checkIsDesktopDataDir } from '../server/fileHelpers';
import {
    appLocalStorage,
    DATA_DIR_MOVE_HIDE_CHANGED_EVENT_NAME,
} from '../setting/directory-setting/appLocalStorage';

// The data folder in use, when it is on the Desktop. Read once per window:
// a folder is changed in Settings, and every window reloads with it.
function readDesktopDataDir() {
    if (appLocalStorage.isOnOwnFolder) {
        return null;
    }
    const dirPath = appLocalStorage.defaultStorageDirPath;
    return dirPath && checkIsDesktopDataDir(dirPath) ? dirPath : null;
}

/**
 * A data folder on the Desktop -- the old default, which OneDrive backs up and
 * can empty -- said in every window while it is in use (the user, with the
 * Reader on one: _the data moving warning card should be in all pages_,
 * _especially reader_). The start asks once per launch (W-54) and a folder
 * switched to inside the app was never asked about; a card is there each
 * time a window is. Fixed in a corner, so no page's layout moves for it, and
 * gone with the start's own question when that is put away for 30 days.
 */
export default function DesktopDataDirCardComp() {
    const [dirPath] = useState(readDesktopDataDir);
    // Shown only once the 30-day hide is known not to be on: the helpers that
    // know are loaded for this card alone, never in a window it is not in.
    const [isHidden, setIsHidden] = useState<boolean | null>(null);
    // The ✕: this window only, and not undone by reading the hide again.
    const [isClosed, setIsClosed] = useState(false);
    useAppEffect(() => {
        if (dirPath === null) {
            return;
        }
        let isAlive = true;
        const readHidden = () => {
            import('../setting/directory-setting/dataDirMoveHelpers').then(
                ({ checkIsDataDirMoveHidden }) => {
                    if (isAlive) {
                        setIsHidden(checkIsDataDirMoveHidden());
                    }
                },
            );
        };
        readHidden();
        // Put away, or brought back, after this card was drawn: by the
        // start-up question in this window (the card stayed up saying what
        // had just been put away), by Settings' Show again, or in another
        // window -- read again when told, and when this window is in front.
        globalThis.addEventListener(
            DATA_DIR_MOVE_HIDE_CHANGED_EVENT_NAME,
            readHidden,
        );
        globalThis.addEventListener('focus', readHidden);
        return () => {
            isAlive = false;
            globalThis.removeEventListener(
                DATA_DIR_MOVE_HIDE_CHANGED_EVENT_NAME,
                readHidden,
            );
            globalThis.removeEventListener('focus', readHidden);
        };
    }, [dirPath]);
    const dirPathRef = useAppCurrentRef(dirPath);
    const handleMoving = useCallback(async () => {
        if (dirPathRef.current === null) {
            return;
        }
        const { askToMoveDesktopDataDir } =
            await import('../setting/directory-setting/dataDirMoveAskHelpers');
        // Asked for: a question put away for 30 days is asked all the same.
        // Put away from it, the card hears so (`readHidden`).
        await askToMoveDesktopDataDir(dirPathRef.current, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleHiding = useCallback(async () => {
        const { hideDataDirMoveForAWhile } =
            await import('../setting/directory-setting/dataDirMoveHelpers');
        hideDataDirMoveForAWhile();
        setIsHidden(true);
    }, []);
    if (dirPath === null || isHidden !== false || isClosed) {
        return null;
    }
    return (
        <div
            className="app-desktop-data-dir-card card border-warning-subtle bg-warning-subtle p-2"
            role="status"
            style={{
                position: 'fixed',
                // Past Settings' sidebar (`.app-setting-sidebar`, 132px): over
                // it, the card hid App Assistant and Apply Settings.
                left: appProvider.isPageSetting ? '144px' : '12px',
                bottom: '12px',
                // Under every modal layer (`variables.scss`: the Bible Lookup is
                // base+15, a confirm base+56), so a dialog's backdrop covers it
                // -- drawn over one, its Move Now asked a second question on
                // top of the first. Above the page and its floating widgets.
                zIndex: 24,
                maxWidth: '420px',
            }}
        >
            <div className="d-flex align-items-start">
                <i className="bi bi-exclamation-triangle text-warning-emphasis me-2" />
                <div className="flex-grow-1 text-warning-emphasis">
                    <strong>
                        {tran('Move Your Data Folder Off the Desktop')}
                    </strong>
                    <div className="small fw-semibold">
                        {tran(
                            'The Desktop is not a safe place for your data folder: backup and sync tools can move or empty it while the app is using it.',
                        )}
                    </div>
                    <div className="small">
                        {tran(
                            'Your songs, slides, Bibles and settings are kept in a folder on the Desktop:',
                        )}
                    </div>
                    <bdi
                        className="small app-selectable-text"
                        style={{ overflowWrap: 'anywhere' }}
                    >
                        {dirPath}
                    </bdi>
                </div>
                <button
                    className="btn btn-sm btn-close ms-2"
                    type="button"
                    title={tran('Close')}
                    aria-label={tran('Close')}
                    onClick={() => {
                        setIsClosed(true);
                    }}
                />
            </div>
            <div className="d-flex justify-content-end gap-2 mt-2">
                <button
                    className="btn btn-sm btn-outline-secondary"
                    type="button"
                    onClick={handleHiding}
                >
                    {tran('Hide for 30 days')}
                </button>
                <button
                    className="btn btn-sm btn-warning d-flex align-items-center"
                    type="button"
                    onClick={handleMoving}
                >
                    <i className="bi bi-box-arrow-right me-1" />
                    {tran('Move Now')}
                </button>
            </div>
        </div>
    );
}
