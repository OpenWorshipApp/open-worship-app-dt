import { useCallback } from 'react';

import { tran } from '../lang/langHelpers';
import { useAppStateAsync, useAppCurrentRef } from '../helper/appHooks';
import { fsCheckDirExist, pathBasename } from '../server/fileHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
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
    dirPath,
    isShowingNameOnly = false,
    onClick,
    shouldNotValidate = false,
    canOpenFileExplorer = false,
}: Readonly<{
    dirPath: string;
    isShowingNameOnly?: boolean;
    onClick?: (event: any) => void;
    shouldNotValidate?: boolean;
    canOpenFileExplorer?: boolean;
}>) {
    const [isValidPath] = useAppStateAsync(
        () => {
            if (shouldNotValidate) {
                return Promise.resolve(true);
            }
            return fsCheckDirExist(dirPath);
        },
        [shouldNotValidate, dirPath],
        true,
    );
    const cleanedDirectoryPath = cleanPath(dirPath);
    let directoryPath = cleanedDirectoryPath;
    if (isShowingNameOnly) {
        directoryPath = pathBasename(cleanedDirectoryPath);
        const index = directoryPath.indexOf('.');
        if (index > 0) {
            directoryPath = directoryPath.substring(0, index);
        }
    }
    const canOpenFileExplorerRef = useAppCurrentRef(canOpenFileExplorer);
    const dirPathRef = useAppCurrentRef(dirPath);
    const handleContextMenuOpening = useCallback((event: any) => {
        if (!canOpenFileExplorerRef.current) {
            return;
        }
        showAppContextMenu(event, [
            {
                menuElement: getMenuTitleRevealFile(),
                onSelect: () => {
                    showFileOrDirExplorer(dirPathRef.current);
                },
            },
        ]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div
            className={
                'app-ellipsis-left app-border-white-round px-1 flex-fill text-muted' +
                ` ${onClick ? 'pointer' : ''}`
            }
            onClick={onClick}
            title={isValidPath ? cleanedDirectoryPath : tran('Invalid Path')}
            style={{
                color: isValidPath ? '' : 'red',
                fontSize: '0.9rem',
            }}
            onContextMenu={handleContextMenuOpening}
        >
            {directoryPath}
        </div>
    );
}
