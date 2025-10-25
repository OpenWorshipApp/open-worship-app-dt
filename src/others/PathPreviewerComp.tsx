import { useCallback } from 'react';
import { useAppStateAsync } from '../helper/debuggerHelpers';
import { fsCheckDirExist, pathBasename } from '../server/fileHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { menuTitleRevealFile } from '../helper/helpers';
import { showExplorer } from '../server/appHelpers';

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
    const [isValidPath] = useAppStateAsync(() => {
        if (shouldNotValidate) {
            return Promise.resolve(true);
        }
        return fsCheckDirExist(dirPath);
    }, [shouldNotValidate, dirPath]);
    const cleanedDirectoryPath = cleanPath(dirPath);
    let directoryPath = cleanedDirectoryPath;
    if (isShowingNameOnly) {
        directoryPath = pathBasename(cleanedDirectoryPath);
        const index = directoryPath.indexOf('.');
        if (index > 0) {
            directoryPath = directoryPath.substring(0, index);
        }
    }
    const handleContextMenuOpening = useCallback(
        (event: any) => {
            if (!canOpenFileExplorer) {
                return;
            }
            showAppContextMenu(event, [
                {
                    menuElement: menuTitleRevealFile,
                    onSelect: () => {
                        showExplorer(dirPath);
                    },
                },
            ]);
        },
        [canOpenFileExplorer, dirPath],
    );
    return (
        <div
            className={
                'app-ellipsis-left app-border-white-round px-1 flex-fill' +
                ` ${onClick ? 'pointer' : ''}`
            }
            onClick={onClick}
            title={isValidPath ? cleanedDirectoryPath : '`Invalid Path'}
            style={{
                color: isValidPath ? '' : 'red',
            }}
            onContextMenu={handleContextMenuOpening}
        >
            {directoryPath}
        </div>
    );
}
