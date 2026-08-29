import { useCallback } from 'react';

import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';
import { getMenuTitleRevealFile } from '../helper/helpers';
import appProvider from '../server/appProvider';
import { copyToClipboard, showFileOrDirExplorer } from '../server/appHelpers';
import { pathBasename } from '../server/fileHelpers';
import { toResourceIcon } from './resourcesScanHelpers';

export default function ResourcesFileRowComp({
    filePath,
}: Readonly<{
    filePath: string;
}>) {
    const fileFullName = pathBasename(filePath);
    const [iconName, color] = toResourceIcon(fileFullName);
    const filePathRef = useAppCurrentRef(filePath);
    const handleOpening = useCallback(() => {
        appProvider.systemUtils.openFile(filePathRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleContextMenuOpening = useCallback((event: any) => {
        showAppContextMenu(event, [
            {
                childBefore: genContextMenuItemIcon('box-arrow-up-right'),
                menuElement: tran('Open'),
                onSelect: () => {
                    appProvider.systemUtils.openFile(filePathRef.current);
                },
            },
            // The two items `genCommonMenu` builds, inline rather than
            // imported: that helper lives in `FileItemHandlerComp`, a whole
            // file-list ROW component, and importing it here would pull
            // `FileSource`, the dir-source watcher and the screen helpers into
            // the bible lookup panel to draw two menu entries.
            {
                childBefore: genContextMenuItemIcon('clipboard'),
                menuElement: tran('Copy Path to Clipboard'),
                onSelect: () => {
                    copyToClipboard(filePathRef.current);
                },
            },
            {
                childBefore: genContextMenuItemIcon('folder2-open'),
                menuElement: getMenuTitleRevealFile(),
                onSelect: () => {
                    showFileOrDirExplorer(filePathRef.current);
                },
            },
        ]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <button
            className={
                'btn btn-sm text-start w-100 app-ellipsis px-1 py-0' +
                ' app-caught-hover-pointer'
            }
            type="button"
            // The whole path, because the name alone cannot tell two matches in
            // two subfolders apart -- and the folder it sits in is usually what
            // says which one this is.
            title={filePath}
            onClick={handleOpening}
            onContextMenu={handleContextMenuOpening}
        >
            <i className={`bi bi-${iconName} pe-1`} style={{ color }} />
            {fileFullName}
        </button>
    );
}
