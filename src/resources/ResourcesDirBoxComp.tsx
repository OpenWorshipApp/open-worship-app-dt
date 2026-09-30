import { Fragment, useCallback, useRef, useState } from 'react';

import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { handleError } from '../helper/errorHelpers';
import { getMenuTitleRevealFile } from '../helper/helpers';
import { useStateSettingBoolean } from '../helper/settingHelpers';
import { tran } from '../lang/langHelpers';
import LoadingComp from '../others/LoadingComp';
import {
    hideProgressBar,
    showProgressBar,
} from '../progress-bar/progressBarHelpers';
import { showFileOrDirExplorer } from '../server/appHelpers';
import { pathBasename, pathDirname, selectFiles } from '../server/fileHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import ResourcesFileRowComp from './ResourcesFileRowComp';
import {
    checkIsInResourcesDataDir,
    copyFilesIntoResourcesFolder,
    ResourcesCopyError,
    toResourcesFilesCopiedMessage,
} from './resourcesCopyHelpers';
import { toResourcesFolderExpandedSettingName } from './resourcesFolderHelpers';
import type {
    ResourcesScanResultType,
    ResourceTargetType,
} from './resourcesScanHelpers';
import {
    checkIsResourceFileListed,
    groupResourceFiles,
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
 * One user-added folder, and every file in it matching any open chapter.
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
    targets,
    searchText,
    isOthersShowing,
    onAddFolder,
    onCopyFolderToDataDir,
    onRemoveFolder,
}: Readonly<{
    dirPath: string;
    targets: ResourceTargetType[];
    searchText: string;
    /** List the files named after no chapter at all, after the rest. */
    isOthersShowing: boolean;
    onAddFolder: () => void;
    onCopyFolderToDataDir: (dirPath: string) => void;
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
    const onCopyFolderToDataDirRef = useAppCurrentRef(onCopyFolderToDataDir);
    const onRemoveFolderRef = useAppCurrentRef(onRemoveFolder);
    const dirPathRef = useAppCurrentRef(dirPath);
    // Read only when the copy has finished, to work out whether anything it
    // wrote will actually be drawn -- so they must be the view as it is THEN,
    // not as it was when the menu was opened.
    const targetsRef = useAppCurrentRef(targets);
    const searchTextRef = useAppCurrentRef(searchText);
    const isOthersShowingRef = useAppCurrentRef(isOthersShowing);
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
    const handleRefreshingRef = useAppCurrentRef(handleRefreshing);
    // Guards a second run while one is going: the menu can be opened again
    // over a folder whose copy is still writing, and two runs would each pick
    // the same free name and one would land on the other.
    const isAddingFilesRef = useRef(false);
    const handleAddingFiles = useCallback(async () => {
        if (isAddingFilesRef.current) {
            return;
        }
        const title = tran('Add Files');
        const pickedFilePaths = await selectFiles([
            { name: tran('All Files'), extensions: ['*'] },
        ]);
        if (pickedFilePaths.length === 0) {
            return;
        }
        const dirPath = dirPathRef.current;
        const progressKey = `${title}: ${dirPath}`;
        isAddingFilesRef.current = true;
        showProgressBar(progressKey);
        try {
            const result = await copyFilesIntoResourcesFolder(
                dirPath,
                pickedFilePaths,
            );
            if (result.error !== null) {
                handleError(result.error);
            }
            if (result.copiedFilePaths.length > 0) {
                // The box is what has to change, and it is keyed on the cached
                // walk -- so the cache goes first, then the re-scan.
                handleRefreshingRef.current();
                // Opened, because a folder that was collapsed when the files
                // went in would answer the copy with nothing at all.
                setIsShowingRef.current(true);
            }
            const isNoneListed = result.copiedFilePaths.every((filePath) => {
                return !checkIsResourceFileListed(
                    pathBasename(filePath),
                    targetsRef.current,
                    searchTextRef.current,
                    isOthersShowingRef.current,
                );
            });
            showSimpleToast(
                title,
                toResourcesFilesCopiedMessage(result, {
                    isNoneListed,
                    isOthersShowing: isOthersShowingRef.current,
                }),
            );
        } catch (error) {
            if (error instanceof ResourcesCopyError) {
                showSimpleToast(title, tran(error.messageKey));
                return;
            }
            handleError(error);
            showSimpleToast(
                title,
                `${tran('Cannot copy file')}: ${(error as Error).message}`,
            );
        } finally {
            isAddingFilesRef.current = false;
            hideProgressBar(progressKey);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleAddingFilesRef = useAppCurrentRef(handleAddingFiles);
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
                childBefore: genContextMenuItemIcon('file-earmark-plus'),
                menuElement: tran('Add Files'),
                onSelect: () => {
                    void handleAddingFilesRef.current();
                },
            },
            {
                childBefore: genContextMenuItemIcon('folder2-open'),
                menuElement: getMenuTitleRevealFile(),
                onSelect: () => {
                    showFileOrDirExplorer(dirPathRef.current);
                },
            },
            // Left out for a folder that is already a copy: there is nothing
            // to copy it to. Asked when the menu opens, never on render, so
            // the data directory is not resolved for every box on screen.
            ...(checkIsInResourcesDataDir(dirPathRef.current)
                ? []
                : [
                      {
                          childBefore: genContextMenuItemIcon('copy'),
                          menuElement: tran('Copy to Data Directory'),
                          onSelect: () => {
                              onCopyFolderToDataDirRef.current(
                                  dirPathRef.current,
                              );
                          },
                      },
                  ]),
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
                    <bdi>{toParentPathLabel(dirPath)}</bdi>
                </span>
                <ContextMenuDotsButtonComp
                    onOpening={handleContextMenuOpening}
                />
            </div>
            {isShowing ? (
                <ResourcesDirBoxBodyComp
                    dirPath={dirPath}
                    targets={targets}
                    searchText={searchText}
                    isOthersShowing={isOthersShowing}
                    refreshCount={refreshCount}
                />
            ) : null}
        </div>
    );
}

function ResourcesDirBoxBodyComp({
    dirPath,
    targets,
    searchText,
    isOthersShowing,
    refreshCount,
}: Readonly<{
    dirPath: string;
    targets: ResourceTargetType[];
    searchText: string;
    isOthersShowing: boolean;
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
        scanResourceFiles(dirPath, targets, searchText, isOthersShowing, () => {
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
        // costs at most one walk per 500ms rather than one per character; and
        // `targets` is one array per reading (memoised on its key), so it is
        // a new identity only when a pane opened, closed or moved chapter.
    }, [dirPath, targets, searchText, isOthersShowing, refreshCount]);
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
    const {
        filePaths,
        searchedFilePaths,
        isTruncated,
        isSearchTruncated,
        otherFilePaths,
        isOthersTruncated,
    } = scanResult;
    // One labelled run per pattern, in the order the toolbar prints them --
    // three panes make three questions, and a flat list could not say which
    // chapter a `GEN.27.pdf` answered.
    const groupList = groupResourceFiles(filePaths, targets);
    return (
        <div className="app-resources-body">
            {groupList.length === 0 &&
            searchedFilePaths.length === 0 &&
            otherFilePaths.length === 0 ? (
                <div className="app-resources-note">
                    {tran('No matching files')}
                </div>
            ) : (
                groupList.map((group) => {
                    return (
                        <Fragment key={group.pattern}>
                            <div
                                className="app-resources-found-label"
                                title={group.pattern}
                            >
                                <span
                                    className={
                                        'app-resources-pattern app-ellipsis' +
                                        ' app-data' +
                                        (group.isBookLevel
                                            ? ' is-book-level'
                                            : '')
                                    }
                                >
                                    {group.pattern}
                                </span>
                            </div>
                            {group.filePaths.map((filePath) => {
                                return (
                                    <ResourcesFileRowComp
                                        key={filePath}
                                        filePath={filePath}
                                        bookKey={group.bookKey}
                                        // These are the files of the chapter
                                        // being read -- a handful, and the
                                        // reason the panel is open -- so a
                                        // link list among them shows its links
                                        // without a second press.
                                        canAutoExpandLinks
                                    />
                                );
                            })}
                        </Fragment>
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
            {otherFilePaths.length > 0 ? (
                <>
                    {/*
                     * Labelled like the search tail, and last: these answer
                     * "what else is on this shelf", never "what is named after
                     * the chapter on screen".
                     */}
                    <div
                        className="app-resources-found-label app-ellipsis"
                        title={tran(
                            'Show files not named after a book and chapter',
                        )}
                    >
                        <i className="bi bi-files" />
                        <span className="app-ellipsis">{tran('Others')}</span>
                    </div>
                    {otherFilePaths.map((filePath) => {
                        // No `canAutoExpandLinks`: up to 200 of these, so a
                        // `.json` among them is read on its first press.
                        return (
                            <ResourcesFileRowComp
                                key={filePath}
                                filePath={filePath}
                            />
                        );
                    })}
                </>
            ) : null}
            {isOthersTruncated ? (
                <div className="app-resources-note text-warning app-ellipsis">
                    <i className="bi bi-exclamation-triangle pe-1" />
                    {tran('Too many other files')}
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
