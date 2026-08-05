import { useCallback, useRef } from 'react';

import { showDroppedDataOnScreens } from '../_screen/managers/screenDroppedHelpers';
import ScreenVaryAppDocumentManager from '../_screen/managers/ScreenVaryAppDocumentManager';
import { VaryAppDocumentContext } from '../app-document-list/appDocumentHelpers';
import type {
    VaryAppDocumentType,
    VarySlideType,
} from '../app-document-list/appDocumentTypeHelpers';
import { genAttachBackgroundComponent } from '../app-document-presenter/items/slideItemRenderHelpers';
import VarySlideRenderWrapperComp from '../app-document-presenter/items/VarySlideRenderWrapperComp';
import {
    DATA_QUERY_KEY,
    handleVarySlideSelecting,
} from '../app-document-presenter/items/varyAppDocumentHelpers';
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
import { bringDomToNearestView } from '../helper/helpers';
import { tran } from '../lang/langHelpers';
import { genShowOnScreensContextMenu } from '../others/FileItemHandlerComp';
import LoadingComp from '../others/LoadingComp';
import type PlaylistItem from './PlaylistItem';
import { loadVaryAppDocument, loadVarySlides } from './playlistDocumentHelpers';
import {
    handlePlaylistItemScreenDropping,
    sendPlaylistItemToScreens,
} from './playlistHelpers';
import {
    checkIsPlaylistItemOnScreen,
    toPlaylistItemOnScreenKey,
    useIsOnScreenChecking,
} from './playlistOnScreenHelpers';
import { notifyPlaylistItemOrigin } from './playlistOriginHelpers';
import type { PlaylistPreviewChildSteppingType } from './playlistPreviewFloatingHelpers';
import {
    PLAYLIST_PREVIEW_ITEM_INDEX_KEY,
    findNextPlaylistPreviewChildIndex,
    registerPlaylistPreviewChildStepping,
    setPlaylistPreviewSelectedItem,
    toPlaylistPreviewItemKey,
    usePlaylistPreviewItemExpanding,
    usePlaylistPreviewSelectedItemKey,
} from './playlistPreviewFloatingHelpers';

/**
 * One element in the full preview: a collapsible header (so unwanted elements
 * can be folded away and only the ones being worked on stay visible) over the
 * element's own native preview, closed by an `<hr>` divider.
 */
function PreviewFrameComp({
    playlistItem,
    index,
    children,
}: Readonly<{
    playlistItem: PlaylistItem;
    index: number;
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
    const isSelected =
        usePlaylistPreviewSelectedItemKey(playlistItem.filePath) === itemKey;
    // Where the next-key steps from. Marked on ANY click on the element, header
    // included: an element folded away has no body to click, and it still has to
    // be reachable as the place the run carries on from. That is also why the
    // header does NOT fold the element — clicking it is how the run is pointed
    // at that element, and folding the body away at the same time would undo the
    // very thing the click was for. Only the chevron folds.
    const handleSelecting = useCallback(() => {
        setPlaylistPreviewSelectedItem(
            playlistItemRef.current.filePath,
            toPlaylistPreviewItemKey(playlistItemRef.current),
            indexRef.current,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div
            className={
                'app-playlist-preview-item w-100' +
                (isSelected ? ' app-playlist-preview-item-selected' : '')
            }
            {...{ [PLAYLIST_PREVIEW_ITEM_INDEX_KEY]: index }}
            // Captured on the way DOWN: a slide card stops the click on its way
            // back up (`VarySlideRenderWrapperComp`), and that is precisely the
            // click that presents — a bubble handler would miss it.
            onClickCapture={handleSelecting}
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
                title={playlistItem.title}
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
                    <span className="app-playlist-row-id px-1">
                        {playlistItem.idLabel}
                    </span>
                ) : null}
                <span
                    className={
                        'app-ellipsis flex-fill ps-1' +
                        (isOnScreen ? ' app-on-screen' : '')
                    }
                    style={{ ...playlistItem.extraStyle }}
                >
                    {playlistItem.title}
                </span>
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
 * bible items reuse the app's own list components, which already carry a
 * "Show on Screens" menu and a drag payload; a background or a foreground is
 * drawn here, so it has to be given the same two ways out or it ends up the
 * only thing in the widget that can be presented by left-click alone.
 *
 * Dragging takes the async `dragStore` route the playlist rows take, for the
 * same reason they do: `dragstart` cannot await, and a stored item may still
 * need to be re-read before a screen can be handed anything.
 *
 * Returns nothing for the kinds a screen cannot take (audio plays locally, a
 * document opens a preview) — offering them either affordance would promise
 * something the screen pipeline drops on the floor.
 */
function useScreenReachProps(playlistItem: PlaylistItem) {
    const playlistItemRef = useAppCurrentRef(playlistItem);
    const handleContextMenuOpening = useCallback((event: any) => {
        event.stopPropagation();
        const currentItem = playlistItemRef.current;
        showAppContextMenu(
            event,
            genShowOnScreensContextMenu(
                (selectingEvent: any) => {
                    sendPlaylistItemToScreens(
                        playlistItemRef.current,
                        selectingEvent,
                        true,
                    );
                },
                currentItem.isAction ? 'Apply on Screens' : undefined,
            ),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleDraggingStart = useCallback((event: any) => {
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
        onContextMenu: handleContextMenuOpening,
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
}: Readonly<{
    varyAppDocument: VaryAppDocumentType;
    varySlide: VarySlideType;
    index: number;
    thumbnailWidth: number;
}>) {
    const varySlideRef = useAppCurrentRef(varySlide);
    const handleContextMenuOpening = useCallback((event: any) => {
        event.stopPropagation();
        showAppContextMenu(
            event,
            genShowOnScreensContextMenu((selectingEvent: any) => {
                const varySlide = varySlideRef.current;
                ScreenVaryAppDocumentManager.handleSlideSelecting(
                    selectingEvent,
                    varySlide.filePath,
                    varySlide.toJson(),
                    true,
                );
            }),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        // Capture rather than bubble: the slide card answers `contextmenu` on
        // its own root, so a bubble handler here would never be reached.
        <div onContextMenuCapture={handleContextMenuOpening}>
            <VaryAppDocumentContext value={varyAppDocument}>
                <VarySlideRenderWrapperComp
                    thumbSize={thumbnailWidth}
                    varySlide={varySlide}
                    index={index}
                />
            </VaryAppDocumentContext>
        </div>
    );
}

function PlaylistSlideItemPreviewComp({
    playlistItem,
    thumbnailWidth,
}: Readonly<{ playlistItem: PlaylistItem; thumbnailWidth: number }>) {
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
        />
    );
}

/**
 * Which of a document's slides the audience is on, or -1 when none of it is
 * showing and nothing has been stepped to yet.
 *
 * Read off the SCREENS rather than remembered here: the operator may well have
 * clicked a slide directly, and the screens are the only thing that knows what
 * is actually being looked at. One read of the on-screen setting for the whole
 * document, never one per slide — a long document is exactly where that would
 * hurt. `lastShownId` covers the moment nothing of it is showing (it was
 * cleared, or a background took the screen) so the walk carries on rather than
 * restarting.
 *
 * The FURTHEST slide wins when two screens hold different ones, so a press
 * always moves the run forwards.
 */
function findOnScreenChildIndex(
    varySlides: VarySlideType[],
    lastShownId: number | null,
) {
    const dataList = ScreenVaryAppDocumentManager.getDataList();
    // Walked from the END, so the first match IS the furthest one and a long
    // document stops looking as soon as it has its answer.
    for (let i = varySlides.length - 1; i >= 0; i--) {
        const varySlide = varySlides[i];
        const isOnScreen = dataList.some(([, data]) => {
            return (
                data.filePath === varySlide.filePath &&
                data.itemJson.id === varySlide.id
            );
        });
        if (isOnScreen) {
            return i;
        }
    }
    return varySlides.findIndex((varySlide) => {
        return varySlide.id === lastShownId;
    });
}

/**
 * How a document element answers the next-key: it walks its OWN slides, and only
 * reports back "nothing left" — letting the run move on to the next element —
 * once the slide on screen is its last one.
 *
 * `isEntering` is the run ARRIVING here from another element, and it always
 * starts the document at its first slide. Resuming from what happens to be on
 * screen would be right while walking one document, but crossing into one reads
 * as a jump into its middle: a slide of it may still be live from earlier in the
 * service, or from the presenter's own list, and neither says where this run
 * should begin.
 *
 * Registered from here rather than handing the slides to the widget: this
 * component is the only thing holding them, and only while the element is
 * unfolded, so nothing keeps a document in memory once its preview is gone.
 */
function useChildStepping(
    index: number,
    varySlides: VarySlideType[] | null,
    containerRef: { current: HTMLDivElement | null },
) {
    const lastShownIdRef = useRef<number | null>(null);
    const currentRef = useAppCurrentRef({ varySlides });
    const handleStepping = useCallback<PlaylistPreviewChildSteppingType>(
        (event, isEntering) => {
            const { varySlides } = currentRef.current;
            if (varySlides === null) {
                return false;
            }
            const fromIndex = isEntering
                ? -1
                : findOnScreenChildIndex(varySlides, lastShownIdRef.current);
            const nextIndex = findNextPlaylistPreviewChildIndex(
                varySlides,
                fromIndex,
            );
            if (nextIndex === -1) {
                return false;
            }
            const varySlide = varySlides[nextIndex];
            lastShownIdRef.current = varySlide.id;
            // The very path a click on that slide takes, so a stepped-to slide
            // reaches the screens exactly as a clicked one does.
            handleVarySlideSelecting(event, nextIndex + 1, varySlide, () => {});
            const element = containerRef.current?.querySelector(
                `[${DATA_QUERY_KEY}="${varySlide.id}"]`,
            );
            if (element != null) {
                bringDomToNearestView(element);
            }
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
    useChildStepping(index, data?.varySlides ?? null, containerRef);
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
                    />
                );
            })}
        </div>
    );
}

function PlaylistBackgroundItemPreviewComp({
    playlistItem,
    thumbnailWidth,
}: Readonly<{ playlistItem: PlaylistItem; thumbnailWidth: number }>) {
    const [droppedData] = useAppStateAsync(() => {
        return playlistItem.toDroppedData();
    }, [playlistItem]);
    const droppedDataRef = useAppCurrentRef(droppedData);
    const screenReachProps = useScreenReachProps(playlistItem);
    const handleClicking = useCallback((event: any) => {
        if (!droppedDataRef.current) {
            return;
        }
        showDroppedDataOnScreens(event, droppedDataRef.current);
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
}: Readonly<{ playlistItem: PlaylistItem; droppedData: DroppedDataType }>) {
    const bibleItem = droppedData.item as BibleItem;
    const fontFamily = useBibleFontFamily(bibleItem.bibleKey);
    const screenReachProps = useScreenReachProps(playlistItem);
    const droppedDataRef = useAppCurrentRef(droppedData);
    const handleClicking = useCallback((event: any) => {
        showDroppedDataOnScreens(event, droppedDataRef.current);
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
    thumbnailWidth,
}: Readonly<{
    playlistItem: PlaylistItem;
    index: number;
    thumbnailWidth: number;
}>) {
    return (
        <PreviewFrameComp playlistItem={playlistItem} index={index}>
            {renderPreviewBody(playlistItem, index, thumbnailWidth)}
        </PreviewFrameComp>
    );
}
