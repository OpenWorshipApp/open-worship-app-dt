import { useCallback, useState } from 'react';

import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { dragStore } from '../helper/dragHelpers';
import { useStateSettingBoolean } from '../helper/settingHelpers';
import { tran } from '../lang/langHelpers';
import {
    genRevealOriginal,
    genShowOnScreensContextMenu,
} from '../others/FileItemHandlerComp';
import { chooseColorNote } from '../others/ItemColorNoteComp';
import type Playlist from './Playlist';
import type PlaylistItem from './PlaylistItem';
import PlaylistDocumentSlidesComp from './PlaylistDocumentSlidesComp';
import { useVaryAppDocumentOpener } from './playlistDocumentHelpers';
import {
    handlePlaylistItemScreenDropping,
    playlistDraggingStore,
    sendPlaylistItemToScreens,
    toPlaylistSettingName,
} from './playlistHelpers';
import {
    checkIsPlaylistItemOnScreen,
    refreshOnScreenAfterPresenting,
    toPlaylistItemOnScreenKey,
    useIsOnScreenChecking,
} from './playlistOnScreenHelpers';
import { notifyPlaylistItemOrigin } from './playlistOriginHelpers';
import PlaylistRowComp from './PlaylistRowComp';

function genContextMenuItems(
    playlist: Playlist,
    playlistItem: PlaylistItem,
    index: number,
    itemCount: number,
): ContextMenuItemType[] {
    // An action has no original anywhere in the app to be pointed at — it is
    // authored in the playlist itself.
    const menuItems: ContextMenuItemType[] = playlistItem.isAction
        ? []
        : [
              genRevealOriginal(() => {
                  notifyPlaylistItemOrigin(playlistItem);
              }),
          ];
    if (playlistItem.isScreenReachable) {
        menuItems.push(
            ...genShowOnScreensContextMenu(
                (event) => {
                    sendPlaylistItemToScreens(playlistItem, event, true);
                },
                playlistItem.isAction ? 'Apply on Screens' : undefined,
            ),
        );
    }
    if (index > 0) {
        menuItems.push({
            childBefore: genContextMenuItemIcon('arrow-up-circle'),
            menuElement: tran('Move up'),
            onSelect: () => {
                playlist.moveItemToIndex(index, index - 1);
            },
        });
    }
    if (index < itemCount - 1) {
        menuItems.push({
            childBefore: genContextMenuItemIcon('arrow-down-circle'),
            menuElement: tran('Move down'),
            onSelect: () => {
                playlist.moveItemToIndex(index, index + 1);
            },
        });
    }
    menuItems.push(
        {
            childBefore: genContextMenuItemIcon('record-circle', {
                color: playlistItem.colorNote || undefined,
            }),
            menuElement: tran('Choose Color'),
            onSelect: (event) => {
                chooseColorNote(
                    playlistItem.colorNote,
                    (newColorNote) => {
                        playlist.setItemColorNote(index, newColorNote);
                    },
                    event,
                );
            },
        },
        {
            childBefore: genContextMenuItemIcon('x-circle', {
                color: 'var(--bs-danger)',
            }),
            menuElement: tran('Remove from Playlist'),
            onSelect: () => {
                playlist.removeItemAtIndex(index);
            },
        },
    );
    return menuItems;
}

export default function PlaylistItemComp({
    playlist,
    playlistItem,
    index,
    itemCount,
}: Readonly<{
    playlist: Playlist;
    playlistItem: PlaylistItem;
    index: number;
    itemCount: number;
}>) {
    const isDocument = playlistItem.isAppDocument;
    // Keyed by the referenced document, not by the row index, so reordering the
    // playlist does not shuffle which rows are open.
    const [isExpanded, setIsExpanded] = useStateSettingBoolean(
        toPlaylistSettingName(
            'playlist-item-expanded',
            playlist.filePath,
            playlistItem.itemFilePath,
        ),
        false,
    );
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const playlistItemRef = useAppCurrentRef(playlistItem);
    const playlistRef = useAppCurrentRef(playlist);
    const indexRef = useAppCurrentRef(index);
    const itemCountRef = useAppCurrentRef(itemCount);
    const openVaryAppDocument = useVaryAppDocumentOpener();
    const openVaryAppDocumentRef = useAppCurrentRef(openVaryAppDocument);

    const handleClicking = useCallback(async (event: any) => {
        // Stopped here, exactly as the presenter's slide card does
        // (`selectVarySlide`). Without it the click keeps bubbling to the
        // enclosing `FileItemHandlerComp` <li>, which fires an UNSCOPED
        // FileSource `select` — the one subscription in the app that is not
        // filtered by file path — and re-renders every file row in the window.
        // Nothing in the playlist consumes that event: the playlist file's
        // `active` state comes from its own open/closed flag.
        event.stopPropagation();
        const currentItem = playlistItemRef.current;
        if (currentItem.isAppDocument) {
            await openVaryAppDocumentRef.current(currentItem.itemFilePath);
            return;
        }
        // Audio is never played from here: the Audios panel owns playback and
        // all of its protections (one track at a time, the already-playing
        // toast, per-file repeat). Clicking points at the track there instead.
        if (currentItem.isAudio) {
            notifyPlaylistItemOrigin(currentItem);
            return;
        }
        // Resolving the payload is the only thing allowed before the screen
        // manager is handed the data — a stored slide is a reference, so it has
        // to be re-read from its document to exist at all. An action skips that
        // and is run on the chosen screens instead.
        await sendPlaylistItemToScreens(currentItem, event);
        refreshOnScreenAfterPresenting();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDraggingStart = useCallback((event: any) => {
        const currentItem = playlistItemRef.current;
        playlistDraggingStore.current = {
            filePath: playlistRef.current.filePath,
            index: indexRef.current,
        };
        // A slide has to be re-read from its document before it can go to a
        // screen, and `dragstart` cannot await — so the async route is used for
        // every kind here, keeping one code path.
        dragStore.onDropped = handlePlaylistItemScreenDropping.bind(
            null,
            currentItem,
        );
        event.dataTransfer.setData('text', currentItem.title);
        event.stopPropagation();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDraggingEnd = useCallback(() => {
        playlistDraggingStore.current = null;
        dragStore.onDropped = null;
    }, []);

    const handleDraggingOver = useCallback((event: any) => {
        const dragging = playlistDraggingStore.current;
        if (
            dragging === null ||
            dragging.filePath !== playlistRef.current.filePath
        ) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        setIsDraggingOver(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDraggingLeave = useCallback(() => {
        setIsDraggingOver(false);
    }, []);

    const handleDropping = useCallback((event: any) => {
        setIsDraggingOver(false);
        const dragging = playlistDraggingStore.current;
        if (
            dragging === null ||
            dragging.filePath !== playlistRef.current.filePath ||
            dragging.index === indexRef.current
        ) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        playlistRef.current.moveItemToIndex(dragging.index, indexRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleContextMenuOpening = useCallback((event: any) => {
        event.stopPropagation();
        showAppContextMenu(
            event,
            genContextMenuItems(
                playlistRef.current,
                playlistItemRef.current,
                indexRef.current,
                itemCountRef.current,
            ),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleExpandToggling = useCallback(() => {
        setIsExpanded(!isExpanded);
    }, [isExpanded, setIsExpanded]);
    const isOnScreen = useIsOnScreenChecking(() => {
        return checkIsPlaylistItemOnScreen(playlistItemRef.current);
    }, toPlaylistItemOnScreenKey(playlistItem));

    return (
        <div
            onDragOver={handleDraggingOver}
            onDragLeave={handleDraggingLeave}
            onDrop={handleDropping}
        >
            <PlaylistRowComp
                depth={1}
                idLabel={playlistItem.idLabel}
                iconName={playlistItem.iconName}
                iconColor={playlistItem.iconColor}
                label={playlistItem.title}
                title={
                    playlistItem.itemFilePath
                        ? playlistItem.itemFilePath
                        : playlistItem.title
                }
                isExpandable={isDocument}
                isExpanded={isExpanded}
                onToggleExpanding={handleExpandToggling}
                onClick={handleClicking}
                onDragStart={handleDraggingStart}
                onDragEnd={handleDraggingEnd}
                onContextMenu={handleContextMenuOpening}
                colorNote={playlistItem.colorNote}
                isOnScreen={isOnScreen}
                extraClassName={
                    (isDraggingOver ? 'app-playlist-row-dragging-over' : '') +
                    (playlistItem.isError ? ' app-playlist-row-error' : '')
                }
                extraStyle={{ ...playlistItem.extraStyle }}
            />
            {isDocument && isExpanded ? (
                <PlaylistDocumentSlidesComp
                    filePath={playlistItem.itemFilePath}
                    depth={2}
                />
            ) : null}
        </div>
    );
}
