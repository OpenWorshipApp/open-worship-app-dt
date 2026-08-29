import { useCallback, useState } from 'react';

import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { getMenuTitleRevealFile } from '../helper/helpers';
import { useStateSettingBoolean } from '../helper/settingHelpers';
import { tran } from '../lang/langHelpers';
import LoadingComp from '../others/LoadingComp';
import { showFileOrDirExplorer } from '../server/appHelpers';
import { pathBasename } from '../server/fileHelpers';
import ResourcesFileRowComp from './ResourcesFileRowComp';
import { toResourcesFolderExpandedSettingName } from './resourcesFolderHelpers';
import type { ResourcesScanResultType } from './resourcesScanHelpers';
import {
    invalidateResourcesScanCache,
    scanResourceFiles,
} from './resourcesScanHelpers';

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
        <div
            className="card w-100 my-1"
            style={{
                border: '1px dotted var(--bs-info-text-emphasis)',
            }}
        >
            <div
                className="card-header app-ellipsis p-1 app-caught-hover-pointer"
                style={{ height: '2rem' }}
                title={dirPath}
                onClick={handleToggleShowing}
                onContextMenu={handleContextMenuOpening}
            >
                <i
                    className={`bi bi-chevron-${isShowing ? 'down' : 'right'}`}
                />
                <i className="bi bi-folder2-open px-1" />
                {pathBasename(dirPath)}
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
            <div className="card-body app-inner-shadow px-1 py-0">
                <div className="text-danger app-ellipsis" title={dirPath}>
                    <i className="bi bi-exclamation-triangle pe-1" />
                    {tran(errorMessageKey)}
                </div>
            </div>
        );
    }
    if (scanResult === null) {
        return (
            <div className="card-body app-inner-shadow px-1 py-0">
                <LoadingComp style={{ height: '2rem' }} />
            </div>
        );
    }
    const { filePaths, searchedFilePaths, isTruncated, isSearchTruncated } =
        scanResult;
    return (
        <div className="card-body app-inner-shadow px-1 py-0">
            {filePaths.length === 0 && searchedFilePaths.length === 0 ? (
                <div style={{ opacity: '0.5' }}>
                    {tran('No matching files')}
                </div>
            ) : (
                filePaths.map((filePath) => {
                    return (
                        <ResourcesFileRowComp
                            key={filePath}
                            filePath={filePath}
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
                        className="app-ellipsis"
                        style={{ opacity: '0.5' }}
                        title={searchText}
                    >
                        <i className="bi bi-search pe-1" />
                        {`*${searchText}*`}
                    </div>
                    {searchedFilePaths.map((filePath) => {
                        return (
                            <ResourcesFileRowComp
                                key={filePath}
                                filePath={filePath}
                            />
                        );
                    })}
                </>
            ) : null}
            {isSearchTruncated ? (
                <div className="text-warning app-ellipsis">
                    <i className="bi bi-exclamation-triangle pe-1" />
                    {tran('Too many matching files')}
                </div>
            ) : null}
            {isTruncated ? (
                // A silently short list reads as a broken feature, and nothing
                // else on screen could ever explain it.
                <div className="text-warning app-ellipsis">
                    <i className="bi bi-exclamation-triangle pe-1" />
                    {tran('Too many folders to search')}
                </div>
            ) : null}
        </div>
    );
}
