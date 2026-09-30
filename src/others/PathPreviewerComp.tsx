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

// The `direction: rtl` this label needs to keep the END of a long path also
// makes the line RTL for the bidi algorithm, which reorders a path whose runs
// are not all one direction (a folder named `1_cv`, a leading `/*`). The path
// is drawn inside a `bdi` below, which takes its direction from its own first
// strong character, so only the ellipsis side is left to `direction`.
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
        //
        // `minWidth: 0` is load-bearing, not tidiness: this wrapper is itself a
        // flex item, its automatic minimum size is the min-content of a
        // `white-space: nowrap` path, and the label's own `overflow: hidden`
        // does NOT lift that off the parent. Without it the path refuses to
        // shrink and pushes the whole row — search, sort, filter, ⋮ — past the
        // panel edge instead of ellipsizing.
        <div
            className="d-flex align-items-center flex-fill"
            style={{ minWidth: 0 }}
        >
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
                <bdi>{directoryPath}</bdi>
            </div>
            {canOpenFileExplorer ? (
                <ContextMenuDotsButtonComp
                    onOpening={handleContextMenuOpening}
                />
            ) : null}
        </div>
    );
}
