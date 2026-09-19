import './ResourcesComp.scss';

import type { ChangeEvent, DragEvent } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { handleError } from '../helper/errorHelpers';
import { escapeHtmlText } from '../helper/sanitizeHelpers';
import { useStateSettingBoolean } from '../helper/settingHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { tran } from '../lang/langHelpers';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';
import {
    hideProgressBar,
    showProgressBar,
} from '../progress-bar/progressBarHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import ResourcesDirBoxComp from './ResourcesDirBoxComp';
import {
    copyResourcesFolderToDataDir,
    getResourcesDataDirPath,
    getResourcesFolderCopyRefusalKey,
    ResourcesCopyError,
} from './resourcesCopyHelpers';
import {
    checkIsDraggingFiles,
    planResourcesFolderDrop,
    readDroppedPaths,
} from './resourcesDropHelpers';
import {
    carryResourcesFolderSettings,
    getResourcesFolderList,
    RESOURCES_OTHERS_SHOWING_SETTING_NAME,
    RESOURCES_SEARCH_SHOWING_SETTING_NAME,
    promptAddResourcesFolders,
    removeResourcesFolderSettings,
    replaceResourcesFolder,
    setResourcesFolderList,
} from './resourcesFolderHelpers';
import type { ResourceTargetType } from './resourcesScanHelpers';
import {
    invalidateResourcesScanCache,
    toResourceMatchPatterns,
} from './resourcesScanHelpers';

export default function ResourcesRendererComp({
    targets,
}: Readonly<{
    /**
     * Every chapter open in the reader, in pane order, already unique -- and
     * one array per reading (memoised on its key upstream), so the boxes
     * below can take it as an effect dependency without re-walking a folder
     * on every re-render of this panel.
     */
    targets: ResourceTargetType[];
}>) {
    const [dirPathList, setDirPathList] = useState<string[]>(() => {
        return getResourcesFolderList();
    });
    // Bumped by Reload, and part of each box's `key`. Without it a Reload
    // whose folder list came back unchanged would remount nothing, and the
    // boxes -- keyed by path, with unchanged props -- would never re-scan.
    const [reloadCount, setReloadCount] = useState(0);
    // Persisted: whoever files material by name wants the box open every time,
    // and whoever does not never has to see it.
    const [isSearchShowing, setIsSearchShowing] = useStateSettingBoolean(
        RESOURCES_SEARCH_SHOWING_SETTING_NAME,
        false,
    );
    // Persisted for the same reason: someone who keeps general material --
    // a family tree, a map -- beside their chapter files wants it every time.
    // Off by default, because the panel exists for the chapter being read.
    const [isOthersShowing, setIsOthersShowing] = useStateSettingBoolean(
        RESOURCES_OTHERS_SHOWING_SETTING_NAME,
        false,
    );
    // Two of them on purpose. `searchText` is what the field shows, updated on
    // every keystroke; `appliedSearchText` is what the folders actually walk
    // the disk for, and only catches up once typing pauses.
    const [searchText, setSearchText] = useState('');
    const [appliedSearchText, setAppliedSearchText] = useState('');
    // Whether a folder drag is hovering the panel. A boolean in state rather
    // than a style written onto the element, because the toolbar says what
    // will happen as well as the panel lighting up, and the two must not be
    // able to disagree.
    const [isDroppingOver, setIsDroppingOver] = useState(false);
    // Per-instance, per `.claude/CLAUDE.md`: a module-level timer would be
    // shared by every mounted panel and collapse them into one.
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    const dirPathListRef = useAppCurrentRef(dirPathList);

    // Persisted from the handlers rather than from an effect on `dirPathList`:
    // the list changes only when the user adds or removes a folder, so an
    // effect would just re-serialize and re-write the same JSON on every
    // unrelated re-render of this panel.
    const handleAddingFolder = useCallback(async () => {
        const newDirPathList = await promptAddResourcesFolders(
            dirPathListRef.current,
        );
        if (newDirPathList === null) {
            return;
        }
        setResourcesFolderList(newDirPathList);
        setDirPathList(newDirPathList);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleRemovingFolder = useCallback(async (dirPath: string) => {
        const isOk = await showAppConfirm(
            tran('Remove Folder'),
            `Remove "${escapeHtmlText(dirPath)}"?`,
            { cancelButtonLabel: 'No', confirmButtonLabel: 'Yes' },
        );
        if (!isOk) {
            return;
        }
        const newDirPathList = dirPathListRef.current.filter((oldDirPath) => {
            return oldDirPath !== dirPath;
        });
        setResourcesFolderList(newDirPathList);
        setDirPathList(newDirPathList);
        // Nothing else can reach either of these once the folder is off the
        // list: the cached matches would sit until their TTL, and the
        // expanded-state setting file would sit forever.
        invalidateResourcesScanCache(dirPath);
        await removeResourcesFolderSettings(dirPath);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Folders being copied right now. A second press on the same folder while
    // its copy runs would start a second full copy of the same tree.
    const copyingDirPathsRef = useRef(new Set<string>());
    const handleCopyingFolderToDataDir = useCallback(
        async (dirPath: string) => {
            if (copyingDirPathsRef.current.has(dirPath)) {
                return;
            }
            const title = tran('Copy to Data Directory');
            const refusalKey = getResourcesFolderCopyRefusalKey(dirPath);
            if (refusalKey !== null) {
                showSimpleToast(title, tran(refusalKey));
                return;
            }
            // Where it will land, said BEFORE anything is written: a copy
            // can be gigabytes, and the destination is a folder the user may
            // never have opened.
            const isOk = await showAppConfirm(
                title,
                tran('Copy this folder, then list the copy here instead?') +
                    `<br><br>"${escapeHtmlText(dirPath)}"` +
                    `<br>→ "${escapeHtmlText(getResourcesDataDirPath())}"`,
                { cancelButtonLabel: 'No', confirmButtonLabel: 'Yes' },
            );
            if (!isOk) {
                return;
            }
            const progressKey = `${title}: ${dirPath}`;
            copyingDirPathsRef.current.add(dirPath);
            showProgressBar(progressKey);
            try {
                const { destinationDirPath } =
                    await copyResourcesFolderToDataDir(dirPath);
                // The copy takes the original's place, open or collapsed as it
                // was; the original stays on disk, only off the list.
                carryResourcesFolderSettings(dirPath, destinationDirPath);
                const newDirPathList = replaceResourcesFolder(
                    getResourcesFolderList(),
                    dirPath,
                    destinationDirPath,
                );
                setResourcesFolderList(newDirPathList);
                setDirPathList(newDirPathList);
                invalidateResourcesScanCache(dirPath);
                await removeResourcesFolderSettings(dirPath);
                showSimpleToast(title, destinationDirPath);
            } catch (error) {
                if (error instanceof ResourcesCopyError) {
                    showSimpleToast(title, tran(error.messageKey));
                    return;
                }
                handleError(error);
                showSimpleToast(
                    title,
                    tran('Cannot copy folder') +
                        ': ' +
                        (error as Error).message,
                );
            } finally {
                copyingDirPathsRef.current.delete(dirPath);
                hideProgressBar(progressKey);
            }
        },
        [],
    );
    const handleReloading = useCallback(() => {
        // Everything this panel derives, dropped at once: the cached matches
        // for every folder (nothing watches these -- they live outside the
        // app's data dir) and the folder list itself, which another window may
        // have changed.
        invalidateResourcesScanCache();
        setDirPathList(getResourcesFolderList());
        setReloadCount((oldCount) => {
            return oldCount + 1;
        });
    }, []);
    const isDroppingOverRef = useAppCurrentRef(isDroppingOver);
    const handleDragOver = useCallback((event: DragEvent) => {
        if (!checkIsDraggingFiles(event.dataTransfer)) {
            return;
        }
        // What makes the panel a drop target at all: without it the browser
        // never fires `drop` and the cursor reads "no entry" over a panel
        // that does accept folders.
        event.preventDefault();
        // External file drags always allow it, where `link` -- which is
        // closer to what happens, since nothing is copied -- is only
        // sometimes in `effectAllowed`, and asking for one that is not
        // silently kills the drop.
        event.dataTransfer.dropEffect = 'copy';
        // `dragover` fires continuously while the pointer moves; only the
        // transition is written, so a drag held over the panel re-renders it
        // once rather than once a frame.
        if (!isDroppingOverRef.current) {
            setIsDroppingOver(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleDragLeave = useCallback((event: DragEvent) => {
        // `dragleave` also arrives when the pointer crosses onto a CHILD of
        // the panel -- a folder header, a file row -- which is not leaving at
        // all. `relatedTarget` is null when the drag leaves the window
        // entirely, and that one IS a leave.
        const relatedTarget = event.relatedTarget as Node | null;
        if (
            relatedTarget !== null &&
            event.currentTarget.contains(relatedTarget)
        ) {
            return;
        }
        setIsDroppingOver(false);
    }, []);
    const handleDropping = useCallback(async (event: DragEvent) => {
        event.preventDefault();
        setIsDroppingOver(false);
        const droppedPaths = readDroppedPaths(event.dataTransfer);
        if (droppedPaths.length === 0) {
            return;
        }
        const { newDirPathList, duplicatedDirPaths } =
            await planResourcesFolderDrop(droppedPaths, dirPathListRef.current);
        if (newDirPathList !== null) {
            // No toast on success: the folders appearing in the list, with
            // their files under them, is the feedback -- and it is the thing
            // the user was looking at when they let go.
            setResourcesFolderList(newDirPathList);
            setDirPathList(newDirPathList);
            return;
        }
        // Nothing changed, so nothing on screen can say why on its own.
        showSimpleToast(
            tran('Add Folder'),
            tran(
                duplicatedDirPaths.length > 0
                    ? 'Folder is already added'
                    : 'Drop a folder, not a file',
            ),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const isSearchShowingRef = useAppCurrentRef(isSearchShowing);
    const setIsSearchShowingRef = useAppCurrentRef(setIsSearchShowing);
    const handleSearchTextChanging = useCallback(
        (event: any) => {
            const newSearchText = event.target.value;
            setSearchText(newSearchText);
            // A folder walk per keystroke is exactly what this app cannot
            // afford; the trailing edge is also the only value that matters.
            attemptTimeout(() => {
                setAppliedSearchText(newSearchText);
            });
        },
        [attemptTimeout],
    );
    const handleSearchToggling = useCallback(
        () => {
            const newIsSearchShowing = !isSearchShowingRef.current;
            setIsSearchShowingRef.current(newIsSearchShowing);
            if (!newIsSearchShowing) {
                // Closing has to drop the text as well, or every folder would
                // keep listing extra files with nothing on screen saying why.
                // Immediate, which also cancels a keystroke still in flight.
                attemptTimeout(() => {
                    setSearchText('');
                    setAppliedSearchText('');
                }, true);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [attemptTimeout],
    );
    const setIsOthersShowingRef = useAppCurrentRef(setIsOthersShowing);
    const handleOthersToggling = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setIsOthersShowingRef.current(event.target.checked);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleAddingFolderRef = useAppCurrentRef(handleAddingFolder);
    const handleReloadingRef = useAppCurrentRef(handleReloading);
    const handleContextMenuOpening = useCallback((event: any) => {
        const menuItems: ContextMenuItemType[] = [
            {
                childBefore: genContextMenuItemIcon('folder-plus'),
                menuElement: tran('Add Folder'),
                onSelect: () => {
                    void handleAddingFolderRef.current();
                },
            },
            {
                childBefore: genContextMenuItemIcon('arrow-clockwise'),
                menuElement: tran('Reload'),
                onSelect: () => {
                    handleReloadingRef.current();
                },
            },
        ];
        showAppContextMenu(event, menuItems);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleAddButtonClicking = useCallback(() => {
        void handleAddingFolderRef.current();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const matchPatterns = toResourceMatchPatterns(targets);
    return (
        <div
            className={
                'app-resources w-100' + (isDroppingOver ? ' is-dropping' : '')
            }
            // Fills the panel even when the folder boxes do not, so a
            // right-click in the empty space BELOW them still lands on this
            // view rather than on the bare tab body. `minHeight` rather than
            // `height` so a long list still grows and scrolls normally.
            // Inner right-clicks are unaffected: a folder header's and a file
            // row's own menus call `showAppContextMenu`, which stops the event
            // before it reaches here.
            style={{ minHeight: '100%' }}
            onContextMenu={handleContextMenuOpening}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDropping}
        >
            <div className="app-resources-toolbar">
                <button
                    className="app-ghost-button"
                    type="button"
                    title={tran('More Options')}
                    aria-label={tran('More Options')}
                    onClick={handleContextMenuOpening}
                >
                    <i className="bi bi-three-dots-vertical" />
                </button>
                {isDroppingOver ? (
                    // In the patterns' own row rather than over the list: the
                    // list scrolls, so an overlay on it is off screen exactly
                    // when a long shelf is being added to, and a line added
                    // beside them would shift the whole panel mid-drag.
                    <span className="app-resources-drop-hint app-ellipsis">
                        <i className="bi bi-folder-plus pe-1" />
                        {tran('Drop folders here')}
                    </span>
                ) : (
                    /*
                     * The patterns are what this panel IS -- "your files named
                     * after what you are reading" -- so they are set to be
                     * read, and drawn as the two different things they are: a
                     * chapter that is open, solid, one per pane; the
                     * book-level catch-all, dashed, once per book, the same
                     * dashed outline a row carries when it matched that half.
                     */
                    <span
                        className="app-resources-patterns"
                        title={tran(
                            'Book-level files are shown in every chapter',
                        )}
                    >
                        {matchPatterns.map(({ pattern, isBookLevel }) => {
                            return (
                                <span
                                    key={pattern}
                                    className={
                                        'app-resources-pattern app-ellipsis' +
                                        ' app-data' +
                                        (isBookLevel ? ' is-book-level' : '')
                                    }
                                >
                                    {pattern}
                                </span>
                            );
                        })}
                    </span>
                )}
                {/*
                 * A checkbox rather than another icon button: it is a standing
                 * choice about what the list holds, and the word says what it
                 * holds where an icon would have to be learned. Outside the
                 * patterns' swap, so it stays put while a folder is dragged in.
                 */}
                <label
                    className={
                        'app-resources-others form-label mb-0 text-nowrap' +
                        ' app-caught-hover-pointer'
                    }
                    title={tran(
                        'Show files not named after a book and chapter',
                    )}
                >
                    <input
                        className="form-check-input mt-0 app-caught-hover-pointer"
                        type="checkbox"
                        checked={isOthersShowing}
                        onChange={handleOthersToggling}
                    />
                    <span>{tran('Others')}</span>
                </label>
                <button
                    className="app-ghost-button"
                    type="button"
                    title={tran('Search file name')}
                    aria-label={tran('Search file name')}
                    aria-pressed={isSearchShowing}
                    onClick={handleSearchToggling}
                >
                    <i className="bi bi-search" />
                </button>
            </div>
            {isSearchShowing ? (
                <div className="app-resources-search">
                    <input
                        className="form-control form-control-sm"
                        // `search` so Chromium draws its own clear button and
                        // handles Escape -- two affordances for no extra DOM.
                        type="search"
                        autoFocus
                        placeholder={tran('Search file name')}
                        value={searchText}
                        onChange={handleSearchTextChanging}
                    />
                </div>
            ) : null}
            {dirPathList.length === 0 ? (
                // A visible way in. An empty list whose only entry point is the
                // three-dots menu or a right-click is invisible to anyone who
                // does not already know the feature exists -- the same lesson
                // `EmptyFileListComp` was written for.
                <div className="d-flex flex-column align-items-center p-2">
                    <button
                        className="btn btn-sm btn-outline-info"
                        type="button"
                        onClick={handleAddButtonClicking}
                    >
                        <i className="bi bi-folder-plus pe-1" />
                        {tran('Add Folder')}
                    </button>
                    {/*
                     * Drag and drop is invisible until it is tried, so the one
                     * screen a user reaches with no folders yet is where it
                     * has to be said -- the same reasoning as the button above.
                     */}
                    <div className="app-resources-note pt-1">
                        {tran('Drop folders here')}
                    </div>
                </div>
            ) : (
                <div className="px-1">
                    {dirPathList.map((dirPath) => {
                        return (
                            <ResourcesDirBoxComp
                                key={`${dirPath}#${reloadCount}`}
                                dirPath={dirPath}
                                targets={targets}
                                searchText={
                                    isSearchShowing ? appliedSearchText : ''
                                }
                                isOthersShowing={isOthersShowing}
                                onAddFolder={handleAddButtonClicking}
                                onCopyFolderToDataDir={
                                    handleCopyingFolderToDataDir
                                }
                                onRemoveFolder={handleRemovingFolder}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}
