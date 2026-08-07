import { useCallback, useMemo, useState } from 'react';

import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { dragStore } from '../helper/dragHelpers';
import { useStateSettingBoolean } from '../helper/settingHelpers';
import type Playlist from './Playlist';
import type PlaylistItem from './PlaylistItem';
import PlaylistCcRowsComp from './PlaylistCcRowsComp';
import type { PlaylistCcHostType } from './PlaylistCcRowsComp';
import PlaylistDocumentSlidesComp from './PlaylistDocumentSlidesComp';
import type { PlaylistSlideCcHostType } from './PlaylistDocumentSlidesComp';
import { useVaryAppDocumentOpener } from './playlistDocumentHelpers';
import {
    extractDropPayload,
    handlePlaylistItemScreenDropping,
    playlistDraggingStore,
    toPlaylistRowDropKind,
    sendPlaylistItemToScreens,
    toPlaylistSettingName,
    UNSUPPORTED_DROP_PAYLOAD,
} from './playlistHelpers';
import { genPlaylistItemContextMenuItems } from './playlistItemMenuHelpers';
import {
    checkIsPlaylistItemOnScreen,
    refreshOnScreenAfterPresenting,
    toPlaylistItemOnScreenKey,
    useIsOnScreenChecking,
} from './playlistOnScreenHelpers';
import { notifyPlaylistItemOrigin } from './playlistOriginHelpers';
import PlaylistRowComp from './PlaylistRowComp';
import PlaylistScreenPinComp from './PlaylistScreenPinComp';

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
    // Which of the two things a drag hovering here would do — they look
    // different because they ARE different: one moves this line, the other
    // attaches something to it.
    const [draggingOverKind, setDraggingOverKind] = useState<
        'position' | 'cc' | null
    >(null);
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
        // Parked: the whole point is that a click on this row does nothing at
        // all — not even open a document's preview, which is what a mis-aimed
        // click on a run sheet costs an operator mid-service.
        if (currentItem.isDisabled) {
            return;
        }
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
        //
        // A parked row is still DRAGGABLE — reordering the run sheet is how it
        // is tidied away, and taking that off would be the one thing disabling
        // must not cost — it just carries no screen payload with it.
        dragStore.onDropped = currentItem.isDisabled
            ? null
            : handlePlaylistItemScreenDropping.bind(null, currentItem);
        event.dataTransfer.setData('text', currentItem.title);
        event.stopPropagation();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDraggingEnd = useCallback(() => {
        playlistDraggingStore.current = null;
        dragStore.onDropped = null;
    }, []);

    // The two things a drag hovering this row can do, and the modifiers that
    // force either — the rule itself is `toPlaylistRowDropKind`; this only says
    // whether the row's EDGE BANDS mean anything, which they do for a line of
    // this sheet being moved and for nothing else.
    const toDropKind = useCallback((event: any): 'position' | 'cc' => {
        const dragging = playlistDraggingStore.current;
        return toPlaylistRowDropKind(
            event,
            dragging !== null &&
                dragging.filePath === playlistRef.current.filePath &&
                dragging.index !== indexRef.current,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDraggingOver = useCallback((event: any) => {
        const dragging = playlistDraggingStore.current;
        // An element row of ANOTHER playlist is being moved within its own list
        // — it is neither reordered here nor attached, so this row says nothing.
        if (
            dragging !== null &&
            dragging.filePath !== playlistRef.current.filePath
        ) {
            return;
        }
        // Dropping a row on ITSELF has never meant anything, and attaching an
        // element to itself means less.
        if (dragging !== null && dragging.index === indexRef.current) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        // The payload cannot be inspected here — the browser only hands
        // `dataTransfer`'s contents over on `drop` — so a CC affordance is
        // OPTIMISTIC and the drop decides whether anything comes of it.
        setDraggingOverKind(toDropKind(event));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDraggingLeave = useCallback(() => {
        setDraggingOverKind(null);
    }, []);

    const handleDropping = useCallback(async (event: any) => {
        setDraggingOverKind(null);
        const dragging = playlistDraggingStore.current;
        if (dragging !== null) {
            if (
                dragging.filePath !== playlistRef.current.filePath ||
                dragging.index === indexRef.current
            ) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            if (toDropKind(event) === 'position') {
                playlistRef.current.moveItemToIndex(
                    dragging.index,
                    indexRef.current,
                );
                return;
            }
            // A listed element attaching to this one. Read back out of its
            // playlist by index rather than from the drag: an action is not a
            // drag type at all, and a slide and a document both refuse to
            // serialize themselves onto one.
            await playlistRef.current.addItemCcFromItemIndex(
                indexRef.current,
                null,
                dragging.filePath,
                dragging.index,
            );
            return;
        }
        const payload = extractDropPayload(event);
        // Nothing this playlist understands (a file, plain text) — left to
        // bubble so the enclosing playlist card still gets its chance at it.
        // An app payload of an unsupported type bubbles for the same reason:
        // the card refuses it out loud, and letting it through keeps that ONE
        // refusal instead of one per nested drop target.
        if (payload === null || payload === UNSUPPORTED_DROP_PAYLOAD) {
            return;
        }
        event.preventDefault();
        // Stopped, and it must be: the same drop otherwise reaches
        // `PlaylistFileComp.handleDropping` through the enclosing
        // `FileItemHandlerComp` <li> and the payload lands TWICE — once as this
        // row's CC and once as a new element appended out of sight.
        event.stopPropagation();
        // Ctrl on something from ANOTHER panel means "as a line, HERE" — the
        // only way to land it anywhere but the end of the sheet, since dropping
        // on the playlist's name row appends. Without it, dropping on a line
        // attaches to that line, which is what it has always meant.
        if (toDropKind(event) === 'position') {
            await playlistRef.current.addItem(
                payload.droppedData,
                payload.dragData,
                indexRef.current,
            );
            return;
        }
        await playlistRef.current.addItemCcFromDroppedData(
            indexRef.current,
            null,
            payload.droppedData,
            payload.dragData,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleContextMenuOpening = useCallback((event: any) => {
        event.stopPropagation();
        showAppContextMenu(
            event,
            genPlaylistItemContextMenuItems(
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
    const ccHost: PlaylistCcHostType = useMemo(() => {
        return { playlist, index, slideId: null };
    }, [playlist, index]);
    const slideCcHost: PlaylistSlideCcHostType = useMemo(() => {
        return { playlist, index, playlistItem };
    }, [playlist, index, playlistItem]);

    return (
        <div>
            {/* The element and its CCs are ONE thing to point at: they go to a
                screen together, so hovering any of them lights all of them. A
                container of their own rather than the wrapper below, which also
                holds a document's slides — those are what the element HOLDS,
                not what rides with it. */}
            <div className="app-playlist-row-group">
                <PlaylistRowComp
                    depth={1}
                    // On the ROW rather than on a wrapper: the drop kind is
                    // decided from where the pointer sits WITHIN the row, so it
                    // has to be the row the rect is measured from.
                    onDragOver={handleDraggingOver}
                    onDragLeave={handleDraggingLeave}
                    onDrop={handleDropping}
                    itemUuid={playlistItem.uuid}
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
                    isDisabled={playlistItem.isDisabled}
                    // An element carries no flag but this playlist's own — a
                    // document hides SLIDES, never the whole entry — so a parked
                    // element is always the run sheet's doing.
                    isPlaylistDisabled={playlistItem.isDisabled}
                    extraChild={
                        playlistItem.screenIds.length > 0 ? (
                            <PlaylistScreenPinComp
                                screenIds={playlistItem.screenIds}
                            />
                        ) : null
                    }
                    extraClassName={
                        (draggingOverKind === null
                            ? ''
                            : draggingOverKind === 'cc'
                              ? 'app-playlist-row-dragging-over-cc'
                              : 'app-playlist-row-dragging-over') +
                        (playlistItem.isError ? ' app-playlist-row-error' : '')
                    }
                    extraStyle={{ ...playlistItem.extraStyle }}
                />
                {/* Directly under the line they ride with, and BEFORE a
                    document's slides: they belong to this element, the slides
                    are what it holds. Gated on the item's own cheap check so a
                    run sheet without CCs builds no component at all. */}
                {playlistItem.hasCcItems ? (
                    <PlaylistCcRowsComp
                        host={ccHost}
                        ccItems={playlistItem.ccItems}
                        depth={2}
                    />
                ) : null}
            </div>
            {isDocument && isExpanded ? (
                <PlaylistDocumentSlidesComp
                    filePath={playlistItem.itemFilePath}
                    depth={2}
                    // A slide row follows its own pin if it has one, else the
                    // document's — and pinning one writes an exception onto
                    // this same entry, since a slide row is not a playlist
                    // entry of its own.
                    resolveScreenIds={(slideId) => {
                        return playlistItem.getSlideScreenIds(slideId);
                    }}
                    resolveOwnScreenIds={(slideId) => {
                        return playlistItem.getOwnSlideScreenIds(slideId);
                    }}
                    setSlideScreenIds={(slideId, newScreenIds) => {
                        playlist.setItemSlideScreenIds(
                            index,
                            slideId,
                            newScreenIds,
                        );
                    }}
                    // Parking the document parks every slide under it, so this
                    // answers for them; the menu still edits only the slide's
                    // OWN flag, the same split the pins make.
                    resolveIsSlideDisabled={(varySlide) => {
                        return playlistItem.checkIsVarySlideDisabled(varySlide);
                    }}
                    resolveIsOwnSlideDisabled={(slideId) => {
                        return playlistItem.checkIsOwnSlideDisabled(slideId);
                    }}
                    // Marked apart from a slide the DOCUMENT hides: this park
                    // is the operator's own and comes off from this menu, that
                    // one only ever does in the document itself. Its own flag
                    // OR the element's — an inherited park is still this run
                    // sheet's decision, just made one level up.
                    resolveIsPlaylistSlideDisabled={(slideId) => {
                        return playlistItem.checkIsSlideDisabled(slideId);
                    }}
                    setSlideDisabled={(slideId, isDisabled) => {
                        playlist.setItemSlideDisabled(
                            index,
                            slideId,
                            isDisabled,
                        );
                    }}
                    // One object rather than four more resolvers: this prop list
                    // is already long, and a slide row needs the whole triple
                    // together to write anything at all.
                    slideCcHost={slideCcHost}
                />
            ) : null}
        </div>
    );
}
