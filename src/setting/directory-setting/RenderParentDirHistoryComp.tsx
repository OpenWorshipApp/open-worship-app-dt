import { useCallback, useState } from 'react';

import { tran } from '../../lang/langHelpers';
import type DirSource from '../../helper/DirSource';
import { useAppCurrentRef, useAppStateAsync } from '../../helper/appHooks';
import {
    fsCheckDirExist,
    pathResolve,
    toPathCompareKey,
} from '../../server/fileHelpers';
import { showAppConfirm } from '../../popup-widget/popupWidgetHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import { escapeHtmlText } from '../../helper/sanitizeHelpers';
import {
    getParentDirHistory,
    removeParentDirHistory,
} from './parentDirHistoryHelpers';

type RecentDirType = { dirPath: string; isExisting: boolean };

async function loadRecentDirs(currentDirPath: string) {
    const currentKey = currentDirPath
        ? toPathCompareKey(pathResolve(currentDirPath))
        : null;
    const dirPathList = getParentDirHistory().filter((dirPath) => {
        return toPathCompareKey(dirPath) !== currentKey;
    });
    return await Promise.all(
        dirPathList.map(async (dirPath): Promise<RecentDirType> => {
            return { dirPath, isExisting: await fsCheckDirExist(dirPath) };
        }),
    );
}

function RenderRecentDirComp({
    dirSource,
    recentDir,
    onChanged,
}: Readonly<{
    dirSource: DirSource;
    recentDir: RecentDirType;
    onChanged: () => void;
}>) {
    const { dirPath, isExisting } = recentDir;
    const dirSourceRef = useAppCurrentRef(dirSource);
    const dirPathRef = useAppCurrentRef(dirPath);
    const onChangedRef = useAppCurrentRef(onChanged);
    const handleSwitching = useCallback(async () => {
        const targetDirPath = dirPathRef.current;
        // Asked again at the press: switching to a folder that is not there
        // blanks every child folder setting (`setParentDirPath`).
        if (!(await fsCheckDirExist(targetDirPath))) {
            showSimpleToast(
                tran('Recent Folders'),
                tran('This folder is not there any more.'),
            );
            onChangedRef.current();
            return;
        }
        // Every open window reloads on the new folder, a projector included,
        // so one stray press must not be enough.
        const isOk = await showAppConfirm(
            tran('Switch Data Folder'),
            `${tran('Switch to the data folder')} ` +
                `"${escapeHtmlText(targetDirPath)}"? ` +
                tran('Every open window reloads.'),
            { confirmButtonLabel: 'Switch' },
        );
        if (!isOk) {
            return;
        }
        dirSourceRef.current.dirPath = targetDirPath;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleRemoving = useCallback(() => {
        removeParentDirHistory(dirPathRef.current);
        onChangedRef.current();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="d-flex align-items-center mb-1">
            {/* Cut on the LEFT, so the folder's own name -- the part that
            tells two entries apart -- stays in view. The `bdi` keeps the path
            in its own order under that `direction: rtl` (`PathPreviewerComp`).
            */}
            <span
                className="flex-grow-1 app-ellipsis-left app-selectable-text"
                style={{ minWidth: 0, fontSize: '0.9rem' }}
                title={dirPath}
            >
                <bdi>{dirPath}</bdi>
            </span>
            {isExisting ? null : (
                <span className="badge rounded-pill text-bg-danger ms-1">
                    {tran('Missing')}
                </span>
            )}
            <button
                className="btn btn-sm btn-outline-info d-flex align-items-center ms-1"
                type="button"
                disabled={!isExisting}
                title={tran('Switch to the data folder')}
                onClick={handleSwitching}
            >
                <i className="bi bi-arrow-left-right me-1" />
                {tran('Switch')}
            </button>
            <button
                className="btn btn-sm btn-outline-secondary ms-1"
                type="button"
                title={tran('Remove from Recent Folders')}
                aria-label={tran('Remove from Recent Folders')}
                onClick={handleRemoving}
            >
                <i className="bi bi-x-lg" />
            </button>
        </div>
    );
}

/**
 * The data folders used before on this computer, for a way back to one without
 * the folder picker. Read only while Path Settings is open: one home-storage
 * read and a stat per folder (at most ten).
 */
export default function RenderParentDirHistoryComp({
    dirSource,
}: Readonly<{ dirSource: DirSource }>) {
    const [reloadCount, setReloadCount] = useState(0);
    const [recentDirs] = useAppStateAsync(() => {
        return loadRecentDirs(dirSource.dirPath);
    }, [dirSource, reloadCount]);
    const handleChanged = useCallback(() => {
        setReloadCount((count) => {
            return count + 1;
        });
    }, []);
    if (!recentDirs || recentDirs.length === 0) {
        return null;
    }
    return (
        <div className="mt-2">
            <div className="d-flex align-items-center mb-1 opacity-75">
                <i className="bi bi-clock-history me-2" />
                {tran('Recent Folders')}
            </div>
            {recentDirs.map((recentDir) => {
                return (
                    <RenderRecentDirComp
                        key={recentDir.dirPath}
                        dirSource={dirSource}
                        recentDir={recentDir}
                        onChanged={handleChanged}
                    />
                );
            })}
        </div>
    );
}
