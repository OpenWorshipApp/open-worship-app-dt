import { useCallback, useState } from 'react';

import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import {
    createMouseEvent,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { handleError } from '../helper/errorHelpers';
import { tran } from '../lang/langHelpers';
import { genRevealOriginal } from '../others/FileItemHandlerComp';
import type Playlist from './Playlist';
import PlaylistItem from './PlaylistItem';
import {
    extractDropPayload,
    playlistDraggingStore,
    UNSUPPORTED_DROP_PAYLOAD,
} from './playlistHelpers';
import {
    checkIsPlaylistItemOnScreen,
    toPlaylistItemOnScreenKey,
    useIsOnScreenChecking,
} from './playlistOnScreenHelpers';
import { notifyPlaylistCcOrigin } from './playlistOriginHelpers';
import PlaylistRowComp from './PlaylistRowComp';
import PlaylistScreenPinComp, {
    genSetSpecificScreenContextMenu,
} from './PlaylistScreenPinComp';

/**
 * Where a CC lives: which entry holds it, and — for a document entry — which of
 * its slides. `slideId` of null is the entry itself.
 *
 * Passed as one object rather than as two more props on every row: the tree's
 * slide component already takes seven resolvers, and this is the pair every CC
 * mutation needs together.
 */
export type PlaylistCcHostType = {
    playlist: Playlist;
    index: number;
    slideId: number | null;
};

/**
 * `Add CC Elements`, offered by every row that can host one.
 *
 * Exported from here for the same reason `genDisableContextMenu` and
 * `genSetSpecificScreenContextMenu` are exported from where they are: four menus
 * offer it — the element row, a document's slide rows, and the same two in the
 * floating preview — and they must not drift apart.
 *
 * The playlist is read ON SELECT, never to draw the row: this is one file read
 * on an explicit gesture, against a menu that would otherwise be built for every
 * row of every listed playlist.
 *
 * Lists TOP-LEVEL entries only, which is also the whole of what a CC may point
 * at — every follower names a line of the sheet. A slide of a document is
 * attached by dragging its row, which appends that slide as a line of its own
 * first.
 */
export function genAddCcElementsContextMenu(
    host: PlaylistCcHostType,
    hostUuid: string | null,
): ContextMenuItemType[] {
    return [
        {
            childBefore: genContextMenuItemIcon('paperclip'),
            menuElement: tran('Add CC Elements'),
            onSelect: (event: any) => {
                event.stopPropagation();
                // The host closes this menu around `onSelect`, so the original
                // event is gone by the time the submenu opens — the coordinates
                // are kept and a fresh event synthesized at them, exactly as the
                // screen-pin checklist reopens itself.
                const { clientX, clientY } = event;
                showAddCcElementsMenu(host, hostUuid, clientX, clientY);
            },
        },
    ];
}

async function showAddCcElementsMenu(
    host: PlaylistCcHostType,
    hostUuid: string | null,
    clientX: number,
    clientY: number,
) {
    const { playlist, index, slideId } = host;
    const playlistItems = (await playlist.getItems()) ?? [];
    // A `Jump to` is armed with a POINTER at another line rather than with a
    // follower, so what it may name is everything the sheet lists — a document
    // most of all. Read off the host itself; a slide's CCs are always followers,
    // whatever the entry above them is.
    const isTarget =
        slideId === null &&
        playlistItems[index] !== undefined &&
        PlaylistItem.checkIsCcTargetHost(playlistItems[index].toJson());
    const menuItems: ContextMenuItemType[] = [];
    playlistItems.forEach((playlistItem, itemIndex) => {
        const { uuid } = playlistItem;
        if (playlistItem.isError || (uuid !== null && uuid === hostUuid)) {
            return;
        }
        if (
            PlaylistItem.resolveCcItemJson(playlistItem.toJson(), isTarget) ===
            null
        ) {
            return;
        }
        menuItems.push({
            childBefore: genContextMenuItemIcon(playlistItem.iconName, {
                color: playlistItem.iconColor,
            }),
            menuElement: `${itemIndex + 1}. ${playlistItem.title}`,
            onSelect: () => {
                // By POSITION, not by the uuid read above: an entry written
                // before uuids existed has none until something points at it,
                // and `Playlist` is where that is minted and saved.
                playlist
                    .addItemCcFromItemIndex(
                        index,
                        slideId,
                        playlist.filePath,
                        itemIndex,
                    )
                    .catch(handleError);
            },
        });
    });
    if (menuItems.length === 0) {
        menuItems.push({
            childBefore: genContextMenuItemIcon('dash'),
            menuElement: tran('No other elements'),
            disabled: true,
            onSelect: () => {},
        });
    }
    showAppContextMenu(createMouseEvent(clientX, clientY), menuItems);
}

/**
 * A CC row's own menu.
 *
 * Deliberately WITHOUT `Show on Screens`: a CC is shown by its host and by
 * nothing else, and an entry that presented it on its own would quietly turn it
 * into an ordinary element by another door. Without `Disable` either — parking
 * takes a LINE out of the run, and a CC is not a line of the run; a follower
 * that is not wanted is removed. And without `Change Seconds`: what a
 * `Next: Timeout` is armed with belongs to the ELEMENT now, so it is re-armed
 * there and every CC of it is re-armed at once — `Reveal Original` is one click
 * away, and it is the first entry here.
 *
 * `Set Specific Screen` stays, the one thing a CC says for itself, and its
 * clearing row means "follow the element, then the host" — the same reading a
 * slide's cleared pin has against the document above it.
 */
export function genCcItemContextMenuItems(
    host: PlaylistCcHostType,
    ccItem: PlaylistItem,
    ccIndex: number,
    ccCount: number,
): ContextMenuItemType[] {
    const { playlist, index, slideId } = host;
    const menuItems: ContextMenuItemType[] = [
        genRevealOriginal(() => {
            notifyPlaylistCcOrigin(ccItem);
        }),
    ];
    if (ccItem.isScreenPinnable) {
        menuItems.push(
            ...genSetSpecificScreenContextMenu(
                ccItem.screenIds,
                (newScreenIds) => {
                    playlist
                        .setItemCcItemScreenIds(
                            index,
                            slideId,
                            ccIndex,
                            newScreenIds,
                        )
                        .catch(handleError);
                },
            ),
        );
    }
    if (ccIndex > 0) {
        menuItems.push({
            childBefore: genContextMenuItemIcon('arrow-up-circle'),
            menuElement: tran('Move up'),
            onSelect: () => {
                playlist
                    .moveItemCcItemToIndex(index, slideId, ccIndex, ccIndex - 1)
                    .catch(handleError);
            },
        });
    }
    if (ccIndex < ccCount - 1) {
        menuItems.push({
            childBefore: genContextMenuItemIcon('arrow-down-circle'),
            menuElement: tran('Move down'),
            onSelect: () => {
                playlist
                    .moveItemCcItemToIndex(index, slideId, ccIndex, ccIndex + 1)
                    .catch(handleError);
            },
        });
    }
    menuItems.push({
        childBefore: genContextMenuItemIcon('x-circle', {
            color: 'var(--bs-danger)',
        }),
        menuElement: tran('Remove CC Element'),
        onSelect: () => {
            playlist
                .removeItemCcItemAtIndex(index, slideId, ccIndex)
                .catch(handleError);
        },
    });
    return menuItems;
}

/**
 * One CC row, drawn under the element or slide it rides with.
 *
 * Clicking it does NOT present it — the host does that. It reveals the element
 * this CC points at instead, which is the only thing a click on a follower can
 * usefully mean and the only way to find out which line of the sheet a repeated
 * label refers to.
 */
function PlaylistCcRowComp({
    host,
    ccItem,
    ccIndex,
    ccCount,
    depth,
}: Readonly<{
    host: PlaylistCcHostType;
    ccItem: PlaylistItem;
    ccIndex: number;
    ccCount: number;
    depth: number;
}>) {
    const hostRef = useAppCurrentRef(host);
    const ccItemRef = useAppCurrentRef(ccItem);
    const ccIndexRef = useAppCurrentRef(ccIndex);
    const ccCountRef = useAppCurrentRef(ccCount);
    const handleClicking = useCallback((event: any) => {
        // See `PlaylistItemComp.handleClicking`: without this the click reaches
        // the enclosing `FileItemHandlerComp` <li> and fires the app's one
        // UNSCOPED FileSource `select`.
        event.stopPropagation();
        notifyPlaylistCcOrigin(ccItemRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleContextMenuOpening = useCallback((event: any) => {
        event.stopPropagation();
        showAppContextMenu(
            event,
            genCcItemContextMenuItems(
                hostRef.current,
                ccItemRef.current,
                ccIndexRef.current,
                ccCountRef.current,
            ),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const isOnScreen = useIsOnScreenChecking(() => {
        return checkIsPlaylistItemOnScreen(ccItemRef.current);
    }, toPlaylistItemOnScreenKey(ccItem));
    // A CC row belongs to its host, so the block of them is part of the host's
    // drop target: dropping onto one attaches ANOTHER CC to the same host
    // rather than doing nothing (or, worse, falling through to the playlist
    // card and appending an element). Nothing here reorders, so there are no
    // edge bands — the whole row attaches.
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const handleDraggingOver = useCallback((event: any) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDraggingOver(true);
    }, []);
    const handleDraggingLeave = useCallback(() => {
        setIsDraggingOver(false);
    }, []);
    const handleDropping = useCallback(async (event: any) => {
        setIsDraggingOver(false);
        const { playlist, index, slideId } = hostRef.current;
        const dragging = playlistDraggingStore.current;
        if (dragging !== null) {
            event.preventDefault();
            event.stopPropagation();
            await playlist.addItemCcFromItemIndex(
                index,
                slideId,
                dragging.filePath,
                dragging.index,
            );
            return;
        }
        const payload = extractDropPayload(event);
        // Both empties bubble: nothing readable is not ours to answer, and an
        // unsupported app payload is refused ONCE, by the enclosing card.
        if (payload === null || payload === UNSUPPORTED_DROP_PAYLOAD) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        await playlist.addItemCcFromDroppedData(
            index,
            slideId,
            payload.droppedData,
            payload.dragData,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <PlaylistRowComp
            depth={depth}
            idLabel={ccItem.idLabel}
            iconName={ccItem.iconName}
            iconColor={ccItem.iconColor}
            label={ccItem.title}
            title={`${tran('CC element')}\n${ccItem.title}`}
            onClick={handleClicking}
            onContextMenu={handleContextMenuOpening}
            onDragOver={handleDraggingOver}
            onDragLeave={handleDraggingLeave}
            onDrop={handleDropping}
            isOnScreen={isOnScreen}
            isCcRow
            extraClassName={
                'app-playlist-cc-row' +
                (isDraggingOver ? ' app-playlist-row-dragging-over-cc' : '')
            }
            extraStyle={{ ...ccItem.extraStyle }}
            // Only its OWN pin: a CC with none follows its host, whose row right
            // above it already carries that badge.
            extraChild={
                ccItem.screenIds.length > 0 ? (
                    <PlaylistScreenPinComp screenIds={ccItem.screenIds} />
                ) : null
            }
        />
    );
}

/**
 * The CC rows of one host. Renders nothing — not even a fragment's worth of
 * work — when there are none, which is every row of every run sheet that uses no
 * CCs; the caller still gates on the host's own cheap `hasCcItems` first.
 */
export default function PlaylistCcRowsComp({
    host,
    ccItems,
    depth,
}: Readonly<{
    host: PlaylistCcHostType;
    ccItems: PlaylistItem[];
    depth: number;
}>) {
    if (ccItems.length === 0) {
        return null;
    }
    return (
        <>
            {ccItems.map((ccItem, ccIndex) => {
                return (
                    <PlaylistCcRowComp
                        key={`${ccItem.uuid}-${ccIndex}`}
                        host={host}
                        ccItem={ccItem}
                        ccIndex={ccIndex}
                        ccCount={ccItems.length}
                        depth={depth}
                    />
                );
            })}
        </>
    );
}
