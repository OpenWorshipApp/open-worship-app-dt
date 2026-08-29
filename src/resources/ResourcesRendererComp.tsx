import { useCallback, useMemo, useState } from 'react';

import type BibleItem from '../bible-list/BibleItem';
import SelectedBibleVerseHeaderComp from '../bible-reader/SelectedBibleVerseHeaderComp';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { useStateSettingBoolean } from '../helper/settingHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { tran } from '../lang/langHelpers';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';
import ResourcesDirBoxComp from './ResourcesDirBoxComp';
import {
    getResourcesFolderList,
    RESOURCES_SEARCH_SHOWING_SETTING_NAME,
    promptAddResourcesFolders,
    removeResourcesFolderSettings,
    setResourcesFolderList,
} from './resourcesFolderHelpers';
import {
    invalidateResourcesScanCache,
    toResourceMatchHint,
} from './resourcesScanHelpers';

export default function ResourcesRendererComp({
    bibleItem,
    setBibleItem,
}: Readonly<{
    bibleItem: BibleItem;
    setBibleItem: (bibleItem: BibleItem) => void;
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
    // Two of them on purpose. `searchText` is what the field shows, updated on
    // every keystroke; `appliedSearchText` is what the folders actually walk
    // the disk for, and only catches up once typing pauses.
    const [searchText, setSearchText] = useState('');
    const [appliedSearchText, setAppliedSearchText] = useState('');
    // Per-instance, per `.claude/CLAUDE.md`: a module-level timer would be
    // shared by every mounted panel and collapse them into one.
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    // Book and chapter only -- the verse picks what the header above shows, not
    // which files are looked for.
    const { bookKey, chapter } = bibleItem.target;
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
            `Remove "${dirPath}"?`,
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

    return (
        <div
            className="w-100"
            // Fills the panel even when the folder boxes do not, so a
            // right-click in the empty space BELOW them still lands on this
            // view rather than on the bare tab body. `minHeight` rather than
            // `height` so a long list still grows and scrolls normally.
            // Inner right-clicks are unaffected: a folder header's and a file
            // row's own menus call `showAppContextMenu`, which stops the event
            // before it reaches here.
            style={{ minHeight: '100%' }}
            onContextMenu={handleContextMenuOpening}
        >
            <SelectedBibleVerseHeaderComp
                bibleItem={bibleItem}
                onBibleKeyChange={(newBibleKey) => {
                    const newBibleItem = bibleItem.clone();
                    newBibleItem.bibleKey = newBibleKey;
                    setBibleItem(newBibleItem);
                }}
                onTargetChange={(newBibleTarget) => {
                    const newBibleItem = bibleItem.clone();
                    newBibleItem.target = newBibleTarget;
                    setBibleItem(newBibleItem);
                }}
            />
            <hr className="m-0" />
            <div className="d-flex align-items-center px-1">
                <button
                    className={
                        'btn btn-sm btn-outline-secondary flex-shrink-0' +
                        ' me-1 px-1 py-0'
                    }
                    type="button"
                    title={tran('More Options')}
                    aria-label={tran('More Options')}
                    onClick={handleContextMenuOpening}
                >
                    <i className="bi bi-three-dots-vertical" />
                </button>
                <span
                    className="app-ellipsis flex-fill"
                    style={{ opacity: '0.5' }}
                    title={tran('Book-level files are shown in every chapter')}
                >
                    {toResourceMatchHint(bookKey, chapter)}
                </span>
                <button
                    className={
                        'btn btn-sm flex-shrink-0 ms-1 px-1 py-0 btn-' +
                        (isSearchShowing ? 'info' : 'outline-secondary')
                    }
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
                <div className="px-1">
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
            <hr className="my-1" />
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
                </div>
            ) : (
                <div className="px-1">
                    {dirPathList.map((dirPath) => {
                        return (
                            <ResourcesDirBoxComp
                                key={`${dirPath}#${reloadCount}`}
                                dirPath={dirPath}
                                bookKey={bookKey}
                                chapter={chapter}
                                searchText={
                                    isSearchShowing ? appliedSearchText : ''
                                }
                                onAddFolder={handleAddButtonClicking}
                                onRemoveFolder={handleRemovingFolder}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}
