import { useCallback, useState } from 'react';

import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { getMenuTitleRevealFile } from '../helper/helpers';
import { useStateSettingBoolean } from '../helper/settingHelpers';
import { tran } from '../lang/langHelpers';
import LoadingComp from '../others/LoadingComp';
import { showFileOrDirExplorer } from '../server/appHelpers';
import { pathBasename, pathDirname } from '../server/fileHelpers';
import ResourcesFileRowComp from './ResourcesFileRowComp';
import { toResourcesFolderExpandedSettingName } from './resourcesFolderHelpers';
import type { ResourcesScanResultType } from './resourcesScanHelpers';
import {
    invalidateResourcesScanCache,
    scanResourceFiles,
} from './resourcesScanHelpers';

/**
 * The parent folder, as a trail rather than an absolute path.
 *
 * The leading separator is dropped because `app-ellipsis-left` renders in
 * `direction: rtl`, which walks a leading `/` around to the far end and prints
 * `Users/raksa/Downloads/` -- a slash the path does not have, in the one place
 * the eye checks for one. It carries no information here either: what
 * identifies a shelf is the tail of the trail, never its root.
 */
function toParentPathLabel(dirPath: string) {
    return pathDirname(dirPath).replace(/^[/\\]+/, '');
}

function toErrorMessageKey(error: any) {
    // The two things the box has to be able to say apart. `ENOTDIR` lands here
    // when the saved path now names a FILE, which reads to the user exactly the
    // same as the folder being gone.
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
        return 'Folder not found';
    }
    return 'Cannot read folder';
}

/**
 * One user-added folder, and every file in it matching the selected verse.
 *
 * Deliberately NOT `BibleCrossRefWrapperComp` with more props: that box is
 * built around a bible key it appends to its own title and looks a font up for,
 * its body wraps chips rather than stacking rows, and its context menu is a
 * single hard-coded Refresh. What IS copied from it, because it is what makes
 * this affordable, is that the children are not rendered at all while
 * collapsed -- so a collapsed folder never mounts the effect below and never
 * touches the disk.
 */
export default function ResourcesDirBoxComp({
    dirPath,
    bookKey,
    chapter,
    searchText,
    onAddFolder,
    onRemoveFolder,
}: Readonly<{
    dirPath: string;
    bookKey: string;
    chapter: number;
    searchText: string;
    onAddFolder: () => void;
    onRemoveFolder: (dirPath: string) => void;
}>) {
    const [isShowing, setIsShowing] = useStateSettingBoolean(
        toResourcesFolderExpandedSettingName(dirPath),
        true,
    );
    // Bumped by Refresh. A primitive, so the scan effect below can keep a deps
    // array of primitives only -- an object dep would re-walk the tree on every
    // re-render of the parent.
    const [refreshCount, setRefreshCount] = useState(0);
    const isShowingRef = useAppCurrentRef(isShowing);
    const setIsShowingRef = useAppCurrentRef(setIsShowing);
    const onAddFolderRef = useAppCurrentRef(onAddFolder);
    const onRemoveFolderRef = useAppCurrentRef(onRemoveFolder);
    const dirPathRef = useAppCurrentRef(dirPath);
    const handleToggleShowing = useCallback(() => {
        setIsShowingRef.current(!isShowingRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleRefreshing = useCallback(() => {
        invalidateResourcesScanCache(dirPathRef.current);
        setRefreshCount((oldCount) => {
            return oldCount + 1;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleContextMenuOpening = useCallback((event: any) => {
        const menuItems: ContextMenuItemType[] = [
            {
                childBefore: genContextMenuItemIcon('arrow-clockwise'),
                menuElement: tran('Refresh'),
                onSelect: handleRefreshing,
            },
            {
                childBefore: genContextMenuItemIcon('folder-plus'),
                menuElement: tran('Add Folder'),
                onSelect: () => {
                    onAddFolderRef.current();
                },
            },
            {
                childBefore: genContextMenuItemIcon('folder2-open'),
                menuElement: getMenuTitleRevealFile(),
                onSelect: () => {
                    showFileOrDirExplorer(dirPathRef.current);
                },
            },
            {
                childBefore: genContextMenuItemIcon('folder-x', {
                    color: 'var(--bs-danger)',
                }),
                menuElement: tran('Remove Folder'),
                onSelect: () => {
                    onRemoveFolderRef.current(dirPathRef.current);
                },
            },
        ];
        showAppContextMenu(event, menuItems);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="app-resources-group w-100">
            <div
                className={
                    'app-resources-group-header app-caught-hover-pointer'
                }
                title={dirPath}
                onClick={handleToggleShowing}
                onContextMenu={handleContextMenuOpening}
            >
                <i
                    className={
                        'app-resources-group-chevron bi bi-chevron-' +
                        (isShowing ? 'down' : 'right')
                    }
                />
                <i className="app-resources-group-icon bi bi-folder2-open" />
                <span className="app-resources-group-name app-ellipsis">
                    {pathBasename(dirPath)}
                </span>
                {/*
                 * The basename alone identifies nothing -- a shelf called `pdf`
                 * next to one called `test` says only that someone named their
                 * folders in a hurry. The tail of the parent path is what says
                 * WHICH library this is, and `app-ellipsis-left` drops the head
                 * of it rather than the end when it will not fit.
                 */}
                <span className="app-resources-group-path app-ellipsis-left">
                    {toParentPathLabel(dirPath)}
                </span>
                <ContextMenuDotsButtonComp
                    onOpening={handleContextMenuOpening}
                />
            </div>
            {isShowing ? (
                <ResourcesDirBoxBodyComp
                    dirPath={dirPath}
                    bookKey={bookKey}
                    chapter={chapter}
                    searchText={searchText}
                    refreshCount={refreshCount}
                />
            ) : null}
        </div>
    );
}

function ResourcesDirBoxBodyComp({
    dirPath,
    bookKey,
    chapter,
    searchText,
    refreshCount,
}: Readonly<{
    dirPath: string;
    bookKey: string;
    chapter: number;
    searchText: string;
    refreshCount: number;
}>) {
    const [scanResult, setScanResult] =
        useState<ResourcesScanResultType | null>(null);
    const [errorMessageKey, setErrorMessageKey] = useState<string | null>(null);
    useAppEffect(() => {
        // Two guards, and they do different jobs. `isCancelled` stops a stale
        // result from landing in state; `isCancelledRef` is read by the walk
        // itself, so abandoning a folder actually stops the disk reads instead
        // of leaving a 1500-directory walk running to completion.
        let isCancelled = false;
        const isCancelledRef = { current: false };
        setErrorMessageKey(null);
        scanResourceFiles(dirPath, bookKey, chapter, searchText, () => {
            return isCancelledRef.current;
        })
            .then((result) => {
                if (isCancelled || result === null) {
                    return;
                }
                setScanResult(result);
            })
            .catch((error) => {
                if (isCancelled) {
                    return;
                }
                setScanResult(null);
                setErrorMessageKey(toErrorMessageKey(error));
            });
        return () => {
            isCancelled = true;
            isCancelledRef.current = true;
        };
        // `searchText` arrives already debounced from the panel, so a keypress
        // costs at most one walk per 500ms rather than one per character.
    }, [dirPath, bookKey, chapter, searchText, refreshCount]);
    if (errorMessageKey !== null) {
        return (
            <div className="app-resources-body">
                <div
                    className="app-resources-note text-danger app-ellipsis"
                    title={dirPath}
                >
                    <i className="bi bi-exclamation-triangle pe-1" />
                    {tran(errorMessageKey)}
                </div>
            </div>
        );
    }
    if (scanResult === null) {
        return (
            <div className="app-resources-body">
                <LoadingComp style={{ height: '2rem' }} />
            </div>
        );
    }
    const { filePaths, searchedFilePaths, isTruncated, isSearchTruncated } =
        scanResult;
    return (
        <div className="app-resources-body">
            {filePaths.length === 0 && searchedFilePaths.length === 0 ? (
                <div className="app-resources-note">
                    {tran('No matching files')}
                </div>
            ) : (
                filePaths.map((filePath) => {
                    return (
                        <ResourcesFileRowComp
                            key={filePath}
                            filePath={filePath}
                            bookKey={bookKey}
                        />
                    );
                })
            )}
            {searchedFilePaths.length > 0 ? (
                <>
                    {/*
                     * Labelled, because an unlabelled tail would read as more
                     * verse matches -- and these are files that have nothing
                     * to do with the verse on screen.
                     */}
                    <div
                        className="app-resources-found-label app-ellipsis"
                        title={searchText}
                    >
                        <i className="bi bi-search" />
                        <span className="app-ellipsis app-data">
                            {`*${searchText}*`}
                        </span>
                    </div>
                    {searchedFilePaths.map((filePath) => {
                        return (
                            <ResourcesFileRowComp
                                key={filePath}
                                filePath={filePath}
                                bookKey={bookKey}
                            />
                        );
                    })}
                </>
            ) : null}
            {isSearchTruncated ? (
                <div className="app-resources-note text-warning app-ellipsis">
                    <i className="bi bi-exclamation-triangle pe-1" />
                    {tran('Too many matching files')}
                </div>
            ) : null}
            {isTruncated ? (
                // A silently short list reads as a broken feature, and nothing
                // else on screen could ever explain it.
                <div className="app-resources-note text-warning app-ellipsis">
                    <i className="bi bi-exclamation-triangle pe-1" />
                    {tran('Too many folders to search')}
                </div>
            ) : null}
        </div>
    );
}
