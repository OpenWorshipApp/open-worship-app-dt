import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import './PathSelectorComp.scss';

import type { DragEvent, ReactNode } from 'react';
import { lazy, useCallback, useState } from 'react';

import { tran } from '../lang/langHelpers';
import type DirSource from '../helper/DirSource';
import AppSuspenseComp from './AppSuspenseComp';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { getMenuTitleRevealFile } from '../helper/helpers';
import {
    checkIsDraggingFiles,
    readDroppedPaths,
} from '../helper/localFileHelpers';
import { copyToClipboard, showFileOrDirExplorer } from '../server/appHelpers';
import appProvider from '../server/appProvider';
import { fsCheckDirExist } from '../server/fileHelpers';
import { openPathSetting } from '../setting/settingHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import RenderPathTitleComp from './RenderPathTitleComp';
import { useAppCurrentRef } from '../helper/appHooks';

const LazyPathEditorComp = lazy(() => {
    return import('./PathEditorComp');
});

/**
 * How many dropped paths are looked at for a folder. Each one costs a `stat`,
 * and a drag can carry a whole select-all; a folder for this box comes alone.
 */
const MAX_CHECKED_DROPPED_PATHS = 10;

/**
 * The first dropped path that is a folder. A dropped FILE is not turned into
 * its parent folder: that is as often the Desktop or Downloads as the folder
 * meant, and the box would then point at it. Sequential on purpose -- a
 * many-path drop must not open that many file handles at once.
 */
async function findDroppedDirPath(droppedPaths: string[]) {
    for (const droppedPath of droppedPaths.slice(
        0,
        MAX_CHECKED_DROPPED_PATHS,
    )) {
        try {
            if (await fsCheckDirExist(droppedPath)) {
                return droppedPath;
            }
        } catch (_error) {
            // A path that cannot even be read (a share that went away
            // mid-drag) is not a folder this box can point at.
        }
    }
    return null;
}

function openContextMenu(
    dirSource: DirSource,
    isUnsettable: boolean,
    event: any,
) {
    const dirPath = dirSource.dirPath;
    if (!dirPath) {
        event.preventDefault();
        event.stopPropagation();
        return;
    }
    const menuItems: ContextMenuItemType[] = [
        {
            childBefore: genContextMenuItemIcon('clipboard'),
            menuElement: tran('Copy to Clipboard'),
            onSelect: () => {
                copyToClipboard(dirPath);
            },
        },
        {
            childBefore: genContextMenuItemIcon('folder2-open'),
            menuElement: getMenuTitleRevealFile(),
            onSelect: () => {
                showFileOrDirExplorer(dirPath);
            },
        },
    ];
    if (!appProvider.isPageSetting) {
        menuItems.push({
            childBefore: genContextMenuItemIcon('pencil-square'),
            menuElement: tran('Edit Parent Path'),
            onSelect: () => {
                openPathSetting();
            },
        });
    }
    if (isUnsettable) {
        menuItems.push({
            childBefore: genContextMenuItemIcon('folder-x', {
                color: 'var(--bs-danger)',
            }),
            menuElement: tran('Unset Directory Path'),
            onSelect: () => {
                dirSource.dirPath = '';
            },
        });
    }
    showAppContextMenu(event, menuItems);
}

export default function PathSelectorComp({
    dirSource,
    isForceShowEditor = false,
    placeholder = '',
    extraElements,
    isAutoFocus = false,
    isFolderDroppable = false,
    isUnsettable = true,
}: Readonly<{
    dirSource: DirSource;
    prefix: string;
    isForceShowEditor?: boolean;
    placeholder?: string;
    extraElements?: ReactNode;
    /** Focus the path box as it appears: it is the one thing to do here. */
    isAutoFocus?: boolean;
    /**
     * A folder dropped from the file manager becomes the path, the same as
     * choosing it in the folder picker. Opt-in: a file list's own path row
     * sits inside a drop target that copies dropped files INTO the folder,
     * and re-pointing the list there would be a surprise.
     */
    isFolderDroppable?: boolean;
    /**
     * Offer **Unset Directory Path**. Not for the data folder itself: the app
     * needs one, a folder is changed by choosing another, and the emptied
     * value is put back -- so the item did nothing, and said nothing.
     */
    isUnsettable?: boolean;
}>) {
    const [isShowingEditor, setIsShowingEditor] = useState(false);
    const [isDroppingOver, setIsDroppingOver] = useState(false);
    const dirPath = dirSource.dirPath;
    const shouldShowingEditor =
        isForceShowEditor || !dirPath || isShowingEditor;
    const isShowingEditorRef = useAppCurrentRef(isShowingEditor);
    const handleToggleEditor = useCallback(() => {
        setIsShowingEditor(!isShowingEditorRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const isDroppingOverRef = useAppCurrentRef(isDroppingOver);
    const handleDragOver = useCallback((event: DragEvent) => {
        if (!checkIsDraggingFiles(event.dataTransfer)) {
            return;
        }
        // Without it the browser never fires `drop`, and the cursor reads
        // "no entry" over a box that does take a folder.
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        // `dragover` fires continuously; only the transition re-renders.
        if (!isDroppingOverRef.current) {
            setIsDroppingOver(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleDragLeave = useCallback((event: DragEvent) => {
        // Crossing onto a child (the input, the chevron) is not leaving;
        // `relatedTarget` is null when the drag leaves the window.
        const relatedTarget = event.relatedTarget as Node | null;
        if (
            relatedTarget !== null &&
            event.currentTarget.contains(relatedTarget)
        ) {
            return;
        }
        setIsDroppingOver(false);
    }, []);
    const dirSourceRef = useAppCurrentRef(dirSource);
    const handleDropping = useCallback(async (event: DragEvent) => {
        if (!checkIsDraggingFiles(event.dataTransfer)) {
            return;
        }
        // Also keeps a dropped file from landing as text in the path input.
        event.preventDefault();
        setIsDroppingOver(false);
        const droppedPaths = readDroppedPaths(event.dataTransfer);
        if (droppedPaths.length === 0) {
            return;
        }
        const droppedDirPath = await findDroppedDirPath(droppedPaths);
        if (droppedDirPath === null) {
            showSimpleToast(
                tran('Choose a folder'),
                tran('Drop a folder, not a file'),
            );
            return;
        }
        const currentDirSource = dirSourceRef.current;
        if (currentDirSource.checkIsSameDirPath(droppedDirPath)) {
            return;
        }
        // The setter is the commit, exactly as the folder picker's: it saves
        // the choice and asks whatever that choice asks.
        currentDirSource.dirPath = droppedDirPath;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div
            className={
                'path-selector w-100' +
                (isDroppingOver ? ' path-selector-dropping' : '')
            }
            onContextMenu={openContextMenu.bind(null, dirSource, isUnsettable)}
            onDragOver={isFolderDroppable ? handleDragOver : undefined}
            onDragLeave={isFolderDroppable ? handleDragLeave : undefined}
            onDrop={isFolderDroppable ? handleDropping : undefined}
        >
            <div
                className="d-flex path-previewer app-caught-hover-pointer"
                title={(shouldShowingEditor ? 'Hide' : 'Show') + ' path editor'}
                onClick={handleToggleEditor}
            >
                <i
                    className={`bi ${
                        shouldShowingEditor
                            ? 'bi-chevron-down'
                            : 'bi-chevron-right'
                    }`}
                />
                {!shouldShowingEditor && (
                    <RenderPathTitleComp
                        dirSource={dirSource}
                        extraElements={extraElements}
                    />
                )}
                {/* No handler: the selector around this row owns the menu. */}
                <ContextMenuDotsButtonComp />
            </div>
            {shouldShowingEditor && (
                <AppSuspenseComp>
                    <LazyPathEditorComp
                        dirSource={dirSource}
                        placeholder={placeholder}
                        isAutoFocus={isAutoFocus}
                    />
                </AppSuspenseComp>
            )}
        </div>
    );
}
