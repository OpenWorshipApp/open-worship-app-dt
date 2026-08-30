import { useCallback } from 'react';

import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import { tran } from '../lang/langHelpers';
import { useAppStateAsync, useAppCurrentRef } from '../helper/appHooks';
import {
    fsCheckDirExist,
    fsCheckFileExist,
    pathBasename,
} from '../server/fileHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { getMenuTitleRevealFile } from '../helper/helpers';
import { showFileOrDirExplorer } from '../server/appHelpers';

// TODO: check direction rtl error with /*
function cleanPath(path: string) {
    if (path.startsWith('/')) {
        path = path.substring(1);
    }
    return path;
}

export function PathPreviewerComp({
    dirOrFilePath,
    isShowingNameOnly = false,
    onClick,
    canOpenFileExplorer = false,
    isFile = false,
}: Readonly<{
    dirOrFilePath: string;
    isShowingNameOnly?: boolean;
    onClick?: (event: any) => void;
    canOpenFileExplorer?: boolean;
    isFile?: boolean;
}>) {
    const [isValidPath] = useAppStateAsync(
        async () => {
            if (isFile) {
                const isFileExist = await fsCheckFileExist(dirOrFilePath);
                return isFileExist;
            }
            const isDir = await fsCheckDirExist(dirOrFilePath);
            return isDir;
        },
        [dirOrFilePath, isFile],
        true,
    );
    const cleanedDirectoryPath = cleanPath(dirOrFilePath);
    let directoryPath = cleanedDirectoryPath;
    if (isShowingNameOnly) {
        directoryPath = pathBasename(cleanedDirectoryPath);
        const index = directoryPath.indexOf('.');
        if (index > 0) {
            directoryPath = directoryPath.substring(0, index);
        }
    }
    const canOpenFileExplorerRef = useAppCurrentRef(canOpenFileExplorer);
    const dirPathRef = useAppCurrentRef(dirOrFilePath);
    const handleContextMenuOpening = useCallback((event: any) => {
        if (!canOpenFileExplorerRef.current) {
            return;
        }
        showAppContextMenu(event, [
            {
                childBefore: genContextMenuItemIcon('folder2-open'),
                menuElement: getMenuTitleRevealFile(),
                onSelect: () => {
                    showFileOrDirExplorer(dirPathRef.current);
                },
            },
        ]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const stateClassName = isValidPath
        ? 'text-muted'
        : 'text-danger-emphasis bg-danger-subtle border-danger fw-bold';
    return (
        // The ⋮ is a SIBLING of the path, never a child of it: the label is
        // `app-ellipsis-left`, which is `direction: rtl`, and anything nested in
        // it is re-ordered by that too.
        <div className="d-flex align-items-center flex-fill">
            <div
                className={
                    'app-ellipsis-left app-border-white-round px-1 flex-fill' +
                    ` ${onClick ? 'pointer' : ''}` +
                    ` ${stateClassName}`
                }
                onClick={onClick}
                title={
                    isValidPath ? cleanedDirectoryPath : tran('Invalid Path')
                }
                style={{
                    fontSize: '0.9rem',
                }}
                onContextMenu={handleContextMenuOpening}
            >
                {directoryPath}
            </div>
            {canOpenFileExplorer ? (
                <ContextMenuDotsButtonComp
                    onOpening={handleContextMenuOpening}
                />
            ) : null}
        </div>
    );
}
