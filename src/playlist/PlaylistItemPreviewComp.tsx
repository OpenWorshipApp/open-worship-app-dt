import { useCallback, useMemo, useRef } from 'react';

import { PresetScreenIdsContext } from '../_screen/managers/screenChoosingHelpers';
import { showDroppedDataOnScreens } from '../_screen/managers/screenDroppedHelpers';
import { VaryAppDocumentContext } from '../app-document-list/appDocumentHelpers';
import type {
    VaryAppDocumentType,
    VarySlideType,
} from '../app-document-list/appDocumentTypeHelpers';
import { genAttachBackgroundComponent } from '../app-document-presenter/items/slideItemRenderHelpers';
import VarySlideRenderWrapperComp from '../app-document-presenter/items/VarySlideRenderWrapperComp';
import { DATA_QUERY_KEY } from '../app-document-presenter/items/varyAppDocumentHelpers';
import type BibleItem from '../bible-list/BibleItem';
import BibleViewTitleEditorComp from '../bible-reader/BibleViewTitleEditorComp';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import {
    useAppCurrentRef,
    useAppEffect,
    useAppStateAsync,
} from '../helper/appHooks';
import { useBibleFontFamily } from '../helper/bible-helpers/bibleStyleHelpers';
import type { DroppedDataType } from '../helper/DragInf';
import { dragStore } from '../helper/dragHelpers';
import { handleError } from '../helper/errorHelpers';
import { tran } from '../lang/langHelpers';
import LoadingComp from '../others/LoadingComp';
import type PlaylistItem from './PlaylistItem';
import { loadVaryAppDocument, loadVarySlides } from './playlistDocumentHelpers';
import {
    handlePlaylistItemScreenDropping,
    sendPlaylistItemToScreens,
} from './playlistHelpers';
import {
    genPlaylistItemContextMenuItems,
    genPlaylistVarySlideContextMenuItems,
} from './playlistItemMenuHelpers';
import {
    checkIsPlaylistItemOnScreen,
    toPlaylistItemOnScreenKey,
    useIsOnScreenChecking,
} from './playlistOnScreenHelpers';
import { notifyPlaylistItemOrigin } from './playlistOriginHelpers';
import Playlist from './Playlist';
import PlaylistCcRowsComp from './PlaylistCcRowsComp';
import type { PlaylistCcHostType } from './PlaylistCcRowsComp';
import { armPlaylistCcPropagation } from './playlistCcApplyHelpers';
import {
    PLAYLIST_CC_ROW_ATTR,
    PLAYLIST_ITEM_UUID_ATTR,
} from './playlistCcHelpers';
import PlaylistScreenPinComp from './PlaylistScreenPinComp';
import type { PlaylistPreviewChildSteppingType } from './playlistPreviewFloatingHelpers';
import {
    PLAYLIST_PREVIEW_ITEM_INDEX_KEY,
    bringPlaylistRunElementToView,
    findNextPlaylistPreviewChildIndex,
    registerPlaylistPreviewChildStepping,
    resolvePlaylistPreviewSelectedChildIndex,
    setPlaylistPreviewSelectedChild,
    setPlaylistPreviewSelectedItem,
    toPlaylistPreviewItemKey,
    usePlaylistPreviewIsChildSelected,
    usePlaylistPreviewIsItemSelected,
    usePlaylistPreviewItemExpanding,
} from './playlistPreviewFloatingHelpers';

/**
 * Whether a click landed on something the widget OFFERS — an element header, a
 * slide card, an action's button, a CC row — rather than on the space around
 * them: the frame's padding, the gap between two thumbnails, the couple of
 * pixels of margin round a card, the divider under an element.
 *
 * Asked of the CURSOR rather than of a list of class names, because the cursor
 * IS the promise made to the operator before the press: everything in here that
 * does something already wears `pointer` (`app-caught-hover-pointer`, a plain
 * `<button>`), so the two cannot drift apart the way a hand-kept list of
 * selectors would. A press on plain space is then what it looks like — the
 * widget takes focus, and nothing that a screen can see moves.
 *
 * `event.target` is retargeted to the shadow HOST for a click inside a slide's
 * shadow root, and that host sits inside the card, so it inherits the card's
 * `pointer` and answers the same as the card would.
 */
function checkIsClickOffered(event: { target: EventTarget | null }) {
    const { target } = event;
    return (
        target instanceof Element &&
        getComputedStyle(target).cursor === 'pointer'
    );
}

/**
 * One element in the full preview: a collapsible header (so unwanted elements
 * can be folded away and only the ones being worked on stay visible) over the
 * element's own native preview, closed by an `<hr>` divider.
 */
function PreviewFrameComp({
    playlistItem,
    index,
    itemCount,
    children,
}: Readonly<{
    playlistItem: PlaylistItem;
    index: number;
    // Only the move-to-end entries need it, but they are the two the tree's menu
    // gates on knowing where the run sheet ENDS — without it the preview's menu
    // would be the tree's minus its two long jumps, which is exactly the kind of
    // near-copy sharing the builder is meant to rule out.
    itemCount: number;
    children: any;
}>) {
    const itemKey = toPlaylistPreviewItemKey(playlistItem);
    // Remembered per playlist file, so a run sheet folded down to the few
    // elements being worked on comes back that way next time it is opened.
    const [isExpanded, handleToggling] = usePlaylistPreviewItemExpanding(
        playlistItem.filePath,
        itemKey,
    );
    const playlistItemRef = useAppCurrentRef(playlistItem);
    const indexRef = useAppCurrentRef(index);
    const isOnScreen = useIsOnScreenChecking(() => {
        return checkIsPlaylistItemOnScreen(playlistItemRef.current);
    }, toPlaylistItemOnScreenKey(playlistItem));
    // By position as well as key: two identical entries share a key, and a
    // key-only answer marks both of them.
    const isSelected = usePlaylistPreviewIsItemSelected(
        playlistItem.filePath,
        itemKey,
        index,
    );
    // Where the next-key steps from. Marked by a click on anything the element
    // OFFERS — its header above all, since an element folded away has no body to
    // click and still has to be reachable as the place the run carries on from.
    // That is also why the header does NOT fold the element: clicking it is how
    // the run is pointed at that element, and folding the body away at the same
    // time would undo the very thing the click was for. Only the chevron folds.
    const handleSelecting = useCallback((event: any) => {
        // The space AROUND those things is not an offer. Pressing the frame's
        // padding, the gap between two thumbnails or the divider under the
        // element only hands the widget focus — moving the run's cursor off
        // whatever is live because a press missed a card by two pixels is not
        // something the operator asked for.
        if (!checkIsClickOffered(event)) {
            return;
        }
        // A CC is shown BY the run and is never something the run stops on, so
        // clicking one — which only reveals the element it is a copy of — must
        // not move the cursor. Answered here rather than by the CC row itself:
        // this handler CAPTURES, so it runs before anything nested can stop it.
        if (
            (event.target as Element | null)?.closest?.(
                `[${PLAYLIST_CC_ROW_ATTR}]`,
            ) != null
        ) {
            return;
        }
        setPlaylistPreviewSelectedItem(
            playlistItemRef.current.filePath,
            toPlaylistPreviewItemKey(playlistItemRef.current),
            indexRef.current,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const itemCountRef = useAppCurrentRef(itemCount);
    // The element's OWN menu, on the whole frame: its header, and every part of
    // its body that is not a thing with a menu of its own (a slide card, a CC
    // row — both of which stop the event before it reaches here). The run sheet
    // is edited from the preview during a service, so this is the same menu the
    // tree row gives, built by the same function rather than a subset of it.
    const handleContextMenuOpening = useCallback((event: any) => {
        event.stopPropagation();
        const currentItem = playlistItemRef.current;
        showAppContextMenu(
            event,
            genPlaylistItemContextMenuItems(
                Playlist.getInstance(currentItem.filePath),
                currentItem,
                indexRef.current,
                itemCountRef.current,
            ),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div
            className={
                'app-playlist-preview-item w-100' +
                (isSelected ? ' app-playlist-preview-item-selected' : '') +
                (playlistItem.isDisabled
                    ? ' app-playlist-preview-item-disabled'
                    : '')
            }
            {...{ [PLAYLIST_PREVIEW_ITEM_INDEX_KEY]: index }}
            {...(playlistItem.uuid === null
                ? {}
                : { [PLAYLIST_ITEM_UUID_ATTR]: playlistItem.uuid })}
            // Captured on the way DOWN: a slide card stops the click on its way
            // back up (`VarySlideRenderWrapperComp`), and that is precisely the
            // click that presents — a bubble handler would miss it.
            onClickCapture={handleSelecting}
            // Bubbling, unlike the click above: the two things nested here that
            // have menus of their own must WIN, and they say so by stopping the
            // event on its way up.
            onContextMenu={handleContextMenuOpening}
        >
            <div
                className={
                    'app-playlist-preview-item-label d-flex' +
                    ' align-items-center app-caught-hover-pointer'
                }
                style={
                    playlistItem.colorNote
                        ? { borderLeft: `3px solid ${playlistItem.colorNote}` }
                        : undefined
                }
                title={
                    (playlistItem.isDisabled
                        ? `${tran('This item is disabled in this playlist')}\n`
                        : '') + playlistItem.title
                }
            >
                <i
                    className={
                        'bi app-playlist-preview-item-chevron' +
                        ' app-caught-hover-pointer' +
                        ` bi-chevron-${isExpanded ? 'down' : 'right'}`
                    }
                    onClick={handleToggling}
                />
                <span className="app-playlist-row-index px-1">{index + 1}</span>
                <i
                    className={`bi bi-${playlistItem.iconName}`}
                    style={{ color: playlistItem.iconColor }}
                />
                {playlistItem.idLabel ? (
                    // Tinted with the icon, exactly as the tree row does it.
                    <span
                        className="app-playlist-row-id px-1"
                        style={
                            playlistItem.iconColor
                                ? { color: playlistItem.iconColor }
                                : undefined
                        }
                    >
                        {playlistItem.idLabel}
                    </span>
                ) : null}
                <span
                    className={
                        'app-ellipsis flex-fill ps-1' +
                        (isOnScreen ? ' app-on-screen' : '') +
                        (playlistItem.isDisabled
                            ? ' app-playlist-row-label-parked'
                            : '')
                    }
                    style={{ ...playlistItem.extraStyle }}
                >
                    {playlistItem.title}
                </span>
                {/* An element is only ever parked BY the run sheet, so it wears
                    that mark alone — the eye-slash is kept for the one thing
                    this widget cannot undo, a slide its document hides. */}
                {playlistItem.isDisabled ? (
                    <i
                        className={
                            'bi bi-slash-circle app-playlist-row-disabled-icon' +
                            ' app-playlist-row-disabled-icon-playlist'
                        }
                    />
                ) : null}
                {playlistItem.screenIds.length > 0 ? (
                    <PlaylistScreenPinComp screenIds={playlistItem.screenIds} />
                ) : null}
            </div>
            {isExpanded ? (
                <div className="app-playlist-preview-item-body">{children}</div>
            ) : null}
            <hr className="app-playlist-preview-divider" />
        </div>
    );
}

/**
 * Reach-a-screen wiring for the previews this file draws itself. Slides and
 * bible items reuse the app's own list components, which already carry a drag
 * payload; a background or a foreground is drawn here, so it has to be given the
 * same way out or it ends up the only thing in the widget that can be presented
 * by left-click alone.
 *
 * Dragging takes the async `dragStore` route the playlist rows take, for the
 * same reason they do: `dragstart` cannot await, and a stored item may still
 * need to be re-read before a screen can be handed anything.
 *
 * Returns nothing for the kinds a screen cannot take (audio plays locally, a
 * document opens a preview) — offering them the affordance would promise
 * something the screen pipeline drops on the floor.
 *
 * NO context menu of its own: right-clicking any of these previews is
 * right-clicking the ELEMENT, and its frame answers that with the element's
 * whole menu. A menu here would shadow it with a subset, which is precisely how
 * the preview came to be missing most of the tree row's entries.
 */
function useScreenReachProps(playlistItem: PlaylistItem) {
    const playlistItemRef = useAppCurrentRef(playlistItem);
    const handleDraggingStart = useCallback((event: any) => {
        // A preview has nothing to reorder, so a parked element's drag is
        // cancelled outright rather than merely emptied of its payload.
        if (playlistItemRef.current.isDisabled) {
            event.preventDefault();
            return;
        }
        dragStore.onDropped = handlePlaylistItemScreenDropping.bind(
            null,
            playlistItemRef.current,
        );
        event.dataTransfer.setData('text', playlistItemRef.current.title);
        event.stopPropagation();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleDraggingEnd = useCallback(() => {
        dragStore.onDropped = null;
    }, []);
    if (!playlistItem.isScreenReachable) {
        return {};
    }
    return {
        draggable: true,
        onDragStart: handleDraggingStart,
        onDragEnd: handleDraggingEnd,
    };
}

/**
 * Slides are drawn by the very component the documents previewer uses, inside
 * the same `VaryAppDocumentContext` — the preview is the real thing, not a
 * look-alike, so a slide reads here exactly as it does in the previewer.
 *
 * Its right-click menu is the previewer's though: colour notes, attached
 * backgrounds and — for an editable slide — the whole edit family, all of which
 * act on the DOCUMENT rather than on the run sheet the operator is reading.
 * Caught on the way DOWN and answered with the one thing this widget is for, so
 * the previewer's own rows keep their full menu.
 */
function VarySlidePreviewComp({
    varyAppDocument,
    varySlide,
    index,
    thumbnailWidth,
    presetScreenIds,
    ownScreenIds = [],
    setSlideScreenIds,
    isDisabled,
    isOwnDisabled,
    isPlaylistDisabled = false,
    setIsDisabled,
    playlistFilePath,
    itemKey = null,
    itemIndex,
    ccHost,
    ccItems = [],
    propagatingCcItems = [],
}: Readonly<{
    varyAppDocument: VaryAppDocumentType;
    varySlide: VarySlideType;
    index: number;
    thumbnailWidth: number;
    presetScreenIds: number[];
    ownScreenIds?: number[];
    setSlideScreenIds?: (slideId: number, screenIds: number[]) => void;
    // Whether this card is parked, and what the menu toggles. For a document's
    // slide that is the run sheet's per-slide flag; for a single-slide entry it
    // IS the entry's own flag — the entry is the slide.
    isDisabled: boolean;
    isOwnDisabled: boolean;
    // Parked by the run sheet rather than hidden by the document — a card at
    // this size cannot say so by dimming twice over, so each kind gets its own
    // badge. Same split, and the same two glyphs, as the tree rows.
    isPlaylistDisabled?: boolean;
    setIsDisabled: (isDisabled: boolean) => void;
    playlistFilePath: string;
    // Null for a single-slide entry: the entry IS this slide, and its own label
    // already carries the element cursor — marking the card as well would read
    // as two cursors on the one thing.
    itemKey?: string | null;
    // Which ELEMENT this card belongs to, not which slide (`index` is that).
    // The two apart is what stops the second copy of a twice-listed document
    // marking the same slide as the first.
    itemIndex: number;
    // Where a CC attached to THIS slide is stored, what is drawn under the card,
    // and what actually rides along when it is shown (the element's own CCs as
    // well as this slide's) — the same three the tree's slide rows take.
    ccHost?: PlaylistCcHostType;
    ccItems?: PlaylistItem[];
    propagatingCcItems?: PlaylistItem[];
}>) {
    const varySlideRef = useAppCurrentRef(varySlide);
    const ccHostRef = useAppCurrentRef(ccHost);
    const propagatingCcItemsRef = useAppCurrentRef(propagatingCcItems);
    const isSelected = usePlaylistPreviewIsChildSelected(
        playlistFilePath,
        itemKey,
        itemIndex,
        varySlide.id,
    );
    const cursorRef = useAppCurrentRef({
        playlistFilePath,
        itemKey,
        itemIndex,
    });
    const ownScreenIdsRef = useAppCurrentRef(ownScreenIds);
    const setSlideScreenIdsRef = useAppCurrentRef(setSlideScreenIds);
    const isDisabledRef = useAppCurrentRef(isDisabled);
    const isOwnDisabledRef = useAppCurrentRef(isOwnDisabled);
    const setIsDisabledRef = useAppCurrentRef(setIsDisabled);
    const handleContextMenuOpening = useCallback((event: any) => {
        event.stopPropagation();
        showAppContextMenu(
            event,
            genPlaylistVarySlideContextMenuItems({
                varySlide: varySlideRef.current,
                isDisabled: isDisabledRef.current,
                isOwnDisabled: isOwnDisabledRef.current,
                ownScreenIds: ownScreenIdsRef.current,
                // A slide of a SINGLE-slide entry has no per-slide pin of its
                // own — the entry IS the slide, and its frame already carries
                // the entry's menu. Only a document's slides get one.
                setSlideScreenIds: setSlideScreenIdsRef.current,
                // Adapted rather than threaded through: the card is told how to
                // park ITSELF, and which slide that is has already been decided
                // by whoever built the card.
                setSlideDisabled: (_slideId, newIsDisabled) => {
                    setIsDisabledRef.current(newIsDisabled);
                },
                ccHost: ccHostRef.current,
            }),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // The card's own click handler is the presenter's, reached through several
    // components — so a parked card is answered on the way DOWN, before any of
    // them see the click, rather than by teaching each of them about playlists.
    //
    // This is also the ONE place the run's slide cursor is written, and it is
    // reached by a real click and by the click a keyboard step propagates
    // alike, so the two can never disagree about where the run is. A parked
    // card takes no cursor: the run cannot stop on it.
    const handleClickingCapture = useCallback((event: any) => {
        if (isDisabledRef.current) {
            event.stopPropagation();
            event.preventDefault();
            return;
        }
        // This box is a few pixels bigger than the card it holds — the cursor
        // outline is drawn into that margin — and the strip around the edge is
        // not the card: a press there presents nothing, so it must not move the
        // cursor or arm a follower either.
        if (!checkIsClickOffered(event)) {
            return;
        }
        const { playlistFilePath, itemKey, itemIndex } = cursorRef.current;
        if (itemKey !== null) {
            setPlaylistPreviewSelectedChild(
                playlistFilePath,
                itemKey,
                itemIndex,
                varySlideRef.current.id,
            );
        }
        // The card's own click is the PRESENTER's, several components down, so
        // this is where a playlist's followers can be armed at all. It is the
        // one hook the run player's next-key needs too: a step is a real click
        // dispatched onto this card, so it comes back through here.
        armPlaylistCcPropagation(event, propagatingCcItemsRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        // Capture rather than bubble: the slide card answers `contextmenu` on
        // its own root, so a bubble handler here would never be reached.
        <div
            className={
                'app-playlist-preview-slide' +
                (isDisabled ? ' app-playlist-preview-slide-disabled' : '') +
                (isSelected ? ' app-playlist-preview-item-selected' : '')
            }
            onContextMenuCapture={handleContextMenuOpening}
            onClickCapture={handleClickingCapture}
        >
            {/* The card's click handler is the presenter's own, shared with the
                documents previewer — the entry's pinned screens reach it here
                rather than by teaching that component about playlists. */}
            <PresetScreenIdsContext value={presetScreenIds}>
                <VaryAppDocumentContext value={varyAppDocument}>
                    <VarySlideRenderWrapperComp
                        thumbSize={thumbnailWidth}
                        varySlide={varySlide}
                        index={index}
                    />
                </VaryAppDocumentContext>
            </PresetScreenIdsContext>
            {/* Overlaid rather than placed in the flow: the card is the
                presenter's own component at a size the zoom slider drives, and
                anything added beside it would push the grid around. Only its
                OWN pin — a slide merely following the document would repeat the
                badge the element header already carries, on every thumbnail. */}
            {ownScreenIds.length > 0 ? (
                <PlaylistScreenPinComp screenIds={ownScreenIds} />
            ) : null}
            {/* The opposite corner to the pin, for the same reason it sits
                where it does: the card is the presenter's own component and
                nothing may be added to the flow around it. Drawn only while
                parked, so a run sheet of live slides builds none of these. */}
            {isDisabled ? (
                <i
                    className={
                        'bi app-playlist-preview-slide-disabled-icon' +
                        (isPlaylistDisabled
                            ? ' bi-slash-circle' +
                              ' app-playlist-row-disabled-icon-playlist'
                            : ' bi-eye-slash')
                    }
                    title={tran(
                        isPlaylistDisabled
                            ? 'This item is disabled in this playlist'
                            : 'This item is disabled in its document',
                    )}
                />
            ) : null}
            {/* Under the card, inside it: the grid is flex-wrap, so anything
                placed beside a card would push the whole row around. Only this
                slide's OWN CCs — the element's are drawn once, on its frame,
                rather than repeated under every thumbnail. */}
            {ccHost !== undefined && ccItems.length > 0 ? (
                <div className="app-playlist-preview-cc-rows">
                    <PlaylistCcRowsComp
                        host={ccHost}
                        ccItems={ccItems}
                        depth={0}
                    />
                </div>
            ) : null}
        </div>
    );
}

function PlaylistSlideItemPreviewComp({
    playlistItem,
    index,
    thumbnailWidth,
}: Readonly<{
    playlistItem: PlaylistItem;
    index: number;
    thumbnailWidth: number;
}>) {
    const [data] = useAppStateAsync(async () => {
        const varyAppDocument = await loadVaryAppDocument(
            playlistItem.itemFilePath,
            playlistItem.stage,
        );
        const varySlide = await playlistItem.getVarySlide();
        if (varyAppDocument === null || varySlide === null) {
            return null;
        }
        return { varyAppDocument, varySlide };
    }, [playlistItem]);
    if (data === undefined) {
        return <LoadingComp />;
    }
    if (data === null) {
        return <div>{tran('Fail to read file data')}</div>;
    }
    return (
        <VarySlidePreviewComp
            varyAppDocument={data.varyAppDocument}
            varySlide={data.varySlide}
            index={data.varySlide.id}
            thumbnailWidth={thumbnailWidth}
            presetScreenIds={playlistItem.screenIds}
            playlistFilePath={playlistItem.filePath}
            itemIndex={index}
            // The entry IS this slide, so the ENTRY's CCs ride with this card —
            // and they have to be armed here, since a card's click never reaches
            // `sendPlaylistItemToScreens`. Drawn by the frame above, not here.
            propagatingCcItems={playlistItem.ccItems}
            // The entry IS this slide, so its card carries the ENTRY's flag —
            // there is no per-slide exception to make against itself.
            isDisabled={playlistItem.isDisabled}
            isOwnDisabled={playlistItem.isDisabled}
            isPlaylistDisabled={playlistItem.isDisabled}
            setIsDisabled={(isDisabled) => {
                Playlist.getInstance(playlistItem.filePath).setItemDisabled(
                    index,
                    isDisabled,
                );
            }}
        />
    );
}

/**
 * How a document element answers the next-key: it walks its OWN slides, and only
 * reports back "nothing left" — letting the run move on to the next element —
 * once the run is on its last slide.
 *
 * Where it is walking FROM is the panel's own cursor, not what is on a screen.
 * Several elements can be live at once — the same document may even be listed
 * twice, or still be live from the presenter's own list — and the screens
 * cannot say which of those the operator is walking; reading them made a press
 * in one element jump to whatever another had shown.
 *
 * `isEntering` is the run ARRIVING here from another element, and it always
 * starts the document at its first slide: a slide of it may still be live from
 * earlier in the service, and that says nothing about where this run begins.
 *
 * Nothing is presented from here. The step PROPAGATES A CLICK onto the card it
 * lands on and lets that click do the rest, so stepping and clicking are one
 * operation rather than two implementations of it that can drift apart.
 *
 * Registered from here rather than handing the slides to the widget: this
 * component is the only thing holding them, and only while the element is
 * unfolded, so nothing keeps a document in memory once its preview is gone.
 */
function useChildStepping(
    playlistFilePath: string,
    itemKey: string,
    index: number,
    varySlides: VarySlideType[] | null,
    containerRef: { current: HTMLDivElement | null },
    checkIsSlideDisabled: (slideId: number) => boolean,
) {
    const currentRef = useAppCurrentRef({
        playlistFilePath,
        itemKey,
        index,
        varySlides,
        checkIsSlideDisabled,
    });
    const handleStepping = useCallback<PlaylistPreviewChildSteppingType>(
        (_event, isEntering) => {
            const {
                playlistFilePath,
                itemKey,
                index,
                varySlides,
                checkIsSlideDisabled,
            } = currentRef.current;
            if (varySlides === null) {
                return false;
            }
            const fromIndex = isEntering
                ? -1
                : resolvePlaylistPreviewSelectedChildIndex(
                      playlistFilePath,
                      itemKey,
                      index,
                      varySlides,
                  );
            const nextIndex = findNextPlaylistPreviewChildIndex(
                varySlides,
                fromIndex,
                (slideIndex) => {
                    return checkIsSlideDisabled(varySlides[slideIndex].id);
                },
            );
            if (nextIndex === -1) {
                return false;
            }
            const varySlide = varySlides[nextIndex];
            const element = containerRef.current?.querySelector(
                `[${DATA_QUERY_KEY}="${varySlide.id}"]`,
            );
            // Its card is what does the presenting, so with no card there is
            // nothing this press can do — answered as "nothing left" rather
            // than silently moving a cursor onto something invisible.
            if (element == null) {
                return false;
            }
            // Before the click, not after: with no screen chosen yet the click
            // opens the "which screen?" menu against this rect, and a rect that
            // is still off-screen would put the menu somewhere unhelpful.
            bringPlaylistRunElementToView(element);
            const { left, top } = element.getBoundingClientRect();
            // A real click, so everything a click does happens: the wrapper's
            // capture handler moves the cursor here, a parked card cancels it,
            // and the card's own handler presents it with the entry's pinned
            // screens. A keyboard event carries no coordinates, so they come
            // from the card itself — what the menu is positioned from.
            element.dispatchEvent(
                new MouseEvent('click', {
                    bubbles: true,
                    clientX: left + 8,
                    clientY: top + 8,
                }),
            );
            return true;
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    useAppEffect(() => {
        // Nothing to walk until the slides are actually read — until then the
        // element is passed over, the same as a folded one.
        if (!varySlides?.length) {
            return;
        }
        return registerPlaylistPreviewChildStepping(index, handleStepping);
    }, [index, varySlides, handleStepping]);
}

/**
 * A document element shows every one of its slides right away — no inner
 * expander. The slides are still only read when this mounts, and this only
 * mounts while the element's own frame is expanded, so collapsing the element
 * releases them again.
 */
function PlaylistDocumentItemPreviewComp({
    playlistItem,
    index,
    thumbnailWidth,
}: Readonly<{
    playlistItem: PlaylistItem;
    index: number;
    thumbnailWidth: number;
}>) {
    const [data] = useAppStateAsync(async () => {
        const varyAppDocument = await loadVaryAppDocument(
            playlistItem.itemFilePath,
        );
        if (varyAppDocument === null) {
            return null;
        }
        const varySlides = await loadVarySlides(varyAppDocument);
        if (varySlides === null) {
            return null;
        }
        return { varyAppDocument, varySlides };
    }, [playlistItem]);
    const containerRef = useRef<HTMLDivElement>(null);
    const itemKey = toPlaylistPreviewItemKey(playlistItem);
    // A step no longer resolves screens itself — the click it propagates does
    // that, so a stepped-to slide reaches its own pinned screens by the very
    // path a clicked one does.
    useChildStepping(
        playlistItem.filePath,
        itemKey,
        index,
        data?.varySlides ?? null,
        containerRef,
        (slideId) => {
            return playlistItem.checkIsSlideDisabled(slideId);
        },
    );
    const setSlideScreenIds = useCallback(
        (slideId: number, newScreenIds: number[]) => {
            Playlist.getInstance(playlistItem.filePath).setItemSlideScreenIds(
                index,
                slideId,
                newScreenIds,
            );
        },
        [playlistItem.filePath, index],
    );
    const setSlideDisabled = useCallback(
        (slideId: number, isDisabled: boolean) => {
            Playlist.getInstance(playlistItem.filePath).setItemSlideDisabled(
                index,
                slideId,
                isDisabled,
            );
        },
        [playlistItem.filePath, index],
    );
    // Asked once for the whole document, not once per card — see the same pair
    // in the tree's slide list.
    const hasAnySlideCc = playlistItem.hasSlideCcItems;
    const hasAnyCc = hasAnySlideCc || playlistItem.hasCcItems;
    if (data === undefined) {
        return <LoadingComp />;
    }
    if (data === null) {
        return <div>{tran('Fail to read file data')}</div>;
    }
    return (
        <div className="d-flex flex-wrap w-100" ref={containerRef}>
            {data.varySlides.map((varySlide, i) => {
                return (
                    <VarySlidePreviewComp
                        key={`${varySlide.filePath}-${varySlide.id}`}
                        varyAppDocument={data.varyAppDocument}
                        varySlide={varySlide}
                        index={i}
                        thumbnailWidth={thumbnailWidth}
                        playlistFilePath={playlistItem.filePath}
                        itemKey={itemKey}
                        itemIndex={index}
                        presetScreenIds={playlistItem.getSlideScreenIds(
                            varySlide.id,
                        )}
                        ownScreenIds={playlistItem.getOwnSlideScreenIds(
                            varySlide.id,
                        )}
                        setSlideScreenIds={setSlideScreenIds}
                        isDisabled={playlistItem.checkIsVarySlideDisabled(
                            varySlide,
                        )}
                        isOwnDisabled={playlistItem.checkIsOwnSlideDisabled(
                            varySlide.id,
                        )}
                        // Its own park or the element's — both are this run
                        // sheet's, and only they come off from the card's menu.
                        isPlaylistDisabled={playlistItem.checkIsSlideDisabled(
                            varySlide.id,
                        )}
                        setIsDisabled={(isDisabled) => {
                            setSlideDisabled(varySlide.id, isDisabled);
                        }}
                        ccHost={{
                            playlist: Playlist.getInstance(
                                playlistItem.filePath,
                            ),
                            index,
                            slideId: varySlide.id,
                        }}
                        ccItems={
                            hasAnySlideCc
                                ? playlistItem.getSlideCcItems(varySlide.id)
                                : undefined
                        }
                        propagatingCcItems={
                            hasAnyCc
                                ? playlistItem.getEffectiveSlideCcItems(
                                      varySlide.id,
                                  )
                                : undefined
                        }
                    />
                );
            })}
        </div>
    );
}

function PlaylistBackgroundItemPreviewComp({
    playlistItem,
    thumbnailWidth,
}: Readonly<{
    playlistItem: PlaylistItem;
    thumbnailWidth: number;
}>) {
    const [droppedData] = useAppStateAsync(() => {
        return playlistItem.toDroppedData();
    }, [playlistItem]);
    const droppedDataRef = useAppCurrentRef(droppedData);
    const screenReachProps = useScreenReachProps(playlistItem);
    // Drawn here rather than by a list component, so this click has to honour
    // the entry's pinned screens itself — it never reaches
    // `sendPlaylistItemToScreens`, which is also why the parked check is
    // repeated here rather than left to that one gate.
    const playlistItemRef = useAppCurrentRef(playlistItem);
    const handleClicking = useCallback((event: any) => {
        if (!droppedDataRef.current || playlistItemRef.current.isDisabled) {
            return;
        }
        // Drawn here rather than by a list component, so this click never
        // reaches the one funnel — it arms its own followers, exactly as it
        // applies the pin itself.
        armPlaylistCcPropagation(event, playlistItemRef.current.ccItems);
        showDroppedDataOnScreens(
            event,
            droppedDataRef.current,
            false,
            playlistItemRef.current.screenIds,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (droppedData === undefined) {
        return <LoadingComp />;
    }
    return (
        <div
            className="card app-caught-hover-pointer app-overflow-hidden"
            style={{
                width: `${thumbnailWidth}px`,
                height: `${Math.round((thumbnailWidth * 9) / 16)}px`,
            }}
            title={playlistItem.title}
            onClick={handleClicking}
            {...screenReachProps}
        >
            {genAttachBackgroundComponent(droppedData)}
        </div>
    );
}

/**
 * A verse in a run sheet is a stored PRESET, not a row of a bible file: it
 * cannot be reordered into one, retargeted, or given an attached background, and
 * the file it was dragged from may not even be open. So it is drawn read-only
 * here rather than through `BibleItemRenderComp`, whose menu (open, the copy
 * family, retarget, colour note) and double-click-to-present belong to the
 * Bibles list. What is left is what this widget is for, and the same two ways
 * out the background and foreground previews have: one click shows the verse,
 * right-click asks which screen.
 */
function PlaylistBibleItemRowComp({
    playlistItem,
    droppedData,
}: Readonly<{
    playlistItem: PlaylistItem;
    droppedData: DroppedDataType;
}>) {
    const bibleItem = droppedData.item as BibleItem;
    const fontFamily = useBibleFontFamily(bibleItem.bibleKey);
    const screenReachProps = useScreenReachProps(playlistItem);
    const droppedDataRef = useAppCurrentRef(droppedData);
    // As in the background preview: drawn here, so the pin — and the parked
    // check — are applied here.
    const playlistItemRef = useAppCurrentRef(playlistItem);
    const handleClicking = useCallback((event: any) => {
        if (playlistItemRef.current.isDisabled) {
            return;
        }
        // As in the background preview: drawn here, so armed here.
        armPlaylistCcPropagation(event, playlistItemRef.current.ccItems);
        showDroppedDataOnScreens(
            event,
            droppedDataRef.current,
            false,
            playlistItemRef.current.screenIds,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div
            className={
                'card w-100 p-1 d-flex flex-row align-items-center' +
                ' app-caught-hover-pointer'
            }
            title={playlistItem.title}
            onClick={handleClicking}
            {...screenReachProps}
            style={{ fontFamily: fontFamily }}
        >
            <span className="badge bg-secondary">{bibleItem.bibleKey}</span>
            <span className="app-ellipsis flex-fill ps-1">
                {/* No `onTargetChange`, so this renders the plain localised
                    title — the editor's own right-click retargeting stays out of
                    the way of the "Show on Screens" menu. */}
                <BibleViewTitleEditorComp bibleItem={bibleItem} />
            </span>
        </div>
    );
}

function PlaylistBibleItemPreviewComp({
    playlistItem,
}: Readonly<{ playlistItem: PlaylistItem }>) {
    const [droppedData] = useAppStateAsync(() => {
        return playlistItem.toDroppedData();
    }, [playlistItem]);
    if (droppedData === undefined) {
        return <LoadingComp />;
    }
    if (droppedData === null) {
        return <div>{tran('Fail to read file data')}</div>;
    }
    return (
        <PlaylistBibleItemRowComp
            playlistItem={playlistItem}
            droppedData={droppedData}
        />
    );
}

/**
 * The two kinds with nothing to LOOK at, drawn as the button that does the
 * thing:
 * - a foreground widget has no compact on-screen preview anywhere in the app
 *   (its panel IS the editor), so this shows what it will apply rather than
 *   inventing a look-alike;
 * - an action has no "what it will look like" at all, only what it will do, so
 *   it is tinted like the mini screen's matching clear button and the two read
 *   as the same action.
 */
function PlaylistButtonItemPreviewComp({
    playlistItem,
}: Readonly<{ playlistItem: PlaylistItem }>) {
    const playlistItemRef = useAppCurrentRef(playlistItem);
    const screenReachProps = useScreenReachProps(playlistItem);
    const handleClicking = useCallback((event: any) => {
        // `sendPlaylistItemToScreens` refuses a parked element anyway — this is
        // only so the press does not read as having done something.
        if (playlistItemRef.current.isDisabled) {
            return;
        }
        sendPlaylistItemToScreens(playlistItemRef.current, event).catch(
            handleError,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const isAction = playlistItem.isAction;
    return (
        <button
            className={
                'btn btn-sm ' +
                (isAction ? 'btn-outline-secondary' : 'btn-outline-primary')
            }
            style={isAction ? { color: playlistItem.iconColor } : undefined}
            // NOT the `disabled` attribute: a disabled button answers no mouse
            // events at all in Chromium, right-click included, and its menu is
            // the only way to put the element back into the run.
            title={playlistItem.title}
            onClick={handleClicking}
            {...screenReachProps}
        >
            <i className={`bi bi-${playlistItem.iconName}`} />{' '}
            {playlistItem.title}
        </button>
    );
}

// Deliberately NOT an <audio> element: the Audios panel owns playback and its
// protections (one track at a time, the already-playing toast, per-file
// repeat). A second player here would play over them. The button points at the
// track in that panel instead.
function PlaylistAudioItemPreviewComp({
    playlistItem,
}: Readonly<{ playlistItem: PlaylistItem }>) {
    const playlistItemRef = useAppCurrentRef(playlistItem);
    const handleClicking = useCallback(() => {
        notifyPlaylistItemOrigin(playlistItemRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <button
            className="btn btn-sm btn-outline-primary"
            onClick={handleClicking}
        >
            <i className={`bi bi-${playlistItem.iconName}`} />{' '}
            {playlistItem.title}
        </button>
    );
}

// Every kind draws itself differently, so this is a plain first-match walk
// rather than a nested ternary — a new item kind is one more `if`, in the same
// order the class's own predicates read.
function renderPreviewBody(
    playlistItem: PlaylistItem,
    index: number,
    thumbnailWidth: number,
) {
    if (playlistItem.isError) {
        return (
            <div className="app-playlist-row-error">
                {tran('Not Supported Item Type')}
            </div>
        );
    }
    if (playlistItem.isAction) {
        return <PlaylistButtonItemPreviewComp playlistItem={playlistItem} />;
    }
    if (playlistItem.isSlide) {
        return (
            <PlaylistSlideItemPreviewComp
                playlistItem={playlistItem}
                index={index}
                thumbnailWidth={thumbnailWidth}
            />
        );
    }
    if (playlistItem.isAppDocument) {
        return (
            <PlaylistDocumentItemPreviewComp
                playlistItem={playlistItem}
                index={index}
                thumbnailWidth={thumbnailWidth}
            />
        );
    }
    if (playlistItem.isBackground) {
        return (
            <PlaylistBackgroundItemPreviewComp
                playlistItem={playlistItem}
                thumbnailWidth={thumbnailWidth}
            />
        );
    }
    if (playlistItem.isAudio) {
        return <PlaylistAudioItemPreviewComp playlistItem={playlistItem} />;
    }
    if (playlistItem.isBibleItem) {
        return <PlaylistBibleItemPreviewComp playlistItem={playlistItem} />;
    }
    return <PlaylistButtonItemPreviewComp playlistItem={playlistItem} />;
}

export default function PlaylistItemPreviewComp({
    playlistItem,
    index,
    itemCount,
    thumbnailWidth,
}: Readonly<{
    playlistItem: PlaylistItem;
    index: number;
    // Only so the frame's menu can offer the same two long jumps the tree's
    // does — see `PreviewFrameComp`.
    itemCount: number;
    thumbnailWidth: number;
}>) {
    const ccHost: PlaylistCcHostType = useMemo(() => {
        return {
            playlist: Playlist.getInstance(playlistItem.filePath),
            index,
            slideId: null,
        };
    }, [playlistItem.filePath, index]);
    return (
        <PreviewFrameComp
            playlistItem={playlistItem}
            index={index}
            itemCount={itemCount}
        >
            {renderPreviewBody(playlistItem, index, thumbnailWidth)}
            {/* Under the element's own preview, inside its frame: the same
                place, and the same reading, the tree gives them. */}
            {playlistItem.hasCcItems ? (
                <div className="app-playlist-preview-cc-rows">
                    <PlaylistCcRowsComp
                        host={ccHost}
                        ccItems={playlistItem.ccItems}
                        depth={0}
                    />
                </div>
            ) : null}
        </PreviewFrameComp>
    );
}
