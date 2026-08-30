import { useCallback } from 'react';

import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';
import { getMenuTitleRevealFile } from '../helper/helpers';
import appProvider from '../server/appProvider';
import { copyToClipboard, showFileOrDirExplorer } from '../server/appHelpers';
import { pathBasename } from '../server/fileHelpers';
import {
    checkIsBookLevelName,
    toResourceIcon,
    toResourceNameParts,
} from './resourcesScanHelpers';

export default function ResourcesFileRowComp({
    filePath,
    bookKey,
}: Readonly<{
    filePath: string;
    bookKey: string;
}>) {
    const fileFullName = pathBasename(filePath);
    const [iconName, color] = toResourceIcon(fileFullName);
    const [nameStem, dotExtension] = toResourceNameParts(fileFullName);
    const isBookLevel = checkIsBookLevelName(fileFullName, bookKey);
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
        // A row of two siblings: the ⋮ cannot be nested inside the file
        // button, and a press on it must not open the file.
        <div className="app-resources-file-row">
            <button
                className="app-resources-file app-caught-hover-pointer"
                type="button"
                // The whole path, because the name alone cannot tell two matches in
                // two subfolders apart -- and the folder it sits in is usually what
                // says which one this is.
                title={filePath}
                onClick={handleOpening}
                onContextMenu={handleContextMenuOpening}
            >
                <i
                    className={`bi bi-${iconName} app-resources-file-icon`}
                    style={{ color }}
                />
                {/*
                 * Split, not styled as one string: the stem is the reference the
                 * user came here for, and a column of identical `.pdf`s should not
                 * be competing with it for the same weight. `app-data` because
                 * these names are mostly numbers -- tabular figures keep a column
                 * of chapter numbers from shifting as it scrolls.
                 */}
                <span className="app-resources-file-stem app-ellipsis app-data">
                    {nameStem}
                </span>
                {dotExtension ? (
                    <span className="app-resources-file-extension">
                        {dotExtension}
                    </span>
                ) : null}
                {isBookLevel ? (
                    <span
                        className="app-resources-file-tag"
                        title={tran(
                            'Book-level files are shown in every chapter',
                        )}
                    >
                        {tran('Introduction')}
                    </span>
                ) : null}
            </button>
            <ContextMenuDotsButtonComp onOpening={handleContextMenuOpening} />
        </div>
    );
}
