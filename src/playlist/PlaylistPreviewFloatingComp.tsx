import { useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

import FloatingWidgetComp from '../app-modal/FloatingWidgetComp';
import { DEFAULT_THUMBNAIL_SIZE_FACTOR } from '../app-document-list/appDocumentTypeHelpers';
import { defaultRangeSize } from '../app-document-presenter/items/AppDocumentPreviewerFooterComp';
import { createMouseEvent } from '../context-menu/appContextMenuHelpers';
import type { EventMapperType } from '../event/KeyboardEventListener';
import { useKeyboardRegistering } from '../event/KeyboardEventListener';
import { useVarySlideThumbnailSizeScale } from '../event/VaryAppDocumentEventListener';
import AppRangeComp, { useZoomingRegistering } from '../others/AppRangeComp';
import { useAppCurrentRef } from '../helper/appHooks';
import { handleAutoHide } from '../helper/domHelpers';
import { bringDomToNearestView } from '../helper/helpers';
import { handleError } from '../helper/errorHelpers';
import FileSource from '../helper/FileSource';
import { tran } from '../lang/langHelpers';
import FileReadErrorComp from '../others/FileReadErrorComp';
import LoadingComp from '../others/LoadingComp';
import type PlaylistItem from './PlaylistItem';
import { sendPlaylistItemToScreens } from './playlistHelpers';
import { usePlaylistItems } from './playlistItemsHelpers';
import PlaylistItemPreviewComp from './PlaylistItemPreviewComp';
import { refreshOnScreenAfterPresenting } from './playlistOnScreenHelpers';
import {
    PLAYLIST_PREVIEW_ITEM_INDEX_KEY,
    checkPlaylistPreviewHasChildren,
    findNextPlaylistPreviewIndex,
    resolvePlaylistPreviewSelectedIndex,
    stepPlaylistPreviewChild,
    setAllPlaylistPreviewItemsCollapsed,
    setPlaylistPreviewFilePath,
    setPlaylistPreviewSelectedItem,
    toPlaylistPreviewItemKey,
    usePlaylistPreviewCollapsedCount,
    usePlaylistPreviewFilePath,
} from './playlistPreviewFloatingHelpers';
import { useThemeSource } from '../others/themeHelpers';

// Its own setting, so zooming the playlist preview does not resize the slides
// in the documents previewer (and the other way round).
const THUMBNAIL_SCALE_SETTING_NAME = 'playlist-preview-thumbnail-size-scale';
const DEFAULT_THUMBNAIL_SCALE = 50;

// The same keys that advance the presenter's own slide list, forward only —
// a run sheet is walked from where it is to its end.
const nextEventMaps: EventMapperType[] = [
    { key: ' ' },
    { key: 'ArrowDown' },
    { key: 'ArrowRight' },
    { key: 'PageDown' },
];

function toElementBox(container: HTMLDivElement, index: number) {
    return container.querySelector(
        `[${PLAYLIST_PREVIEW_ITEM_INDEX_KEY}="${index}"]`,
    );
}

// The widget's own zoom slider answers the arrow keys itself, and a form
// control anywhere in it would do the same — stepping the run instead would
// leave the control looking dead while a screen changed behind it.
function checkIsFormControlFocused(element: Element) {
    const { tagName } = element;
    return (
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT' ||
        (element instanceof HTMLElement && element.isContentEditable)
    );
}

// With no screen selected, `chooseScreenIds` asks which one with a menu it
// positions from the event. A keyboard event carries no coordinates, so the
// question is pointed at the element that is being shown.
function toElementMouseEvent(element: Element | null) {
    const rect = element?.getBoundingClientRect();
    return createMouseEvent((rect?.left ?? 0) + 8, (rect?.top ?? 0) + 8);
}

async function showPlaylistItemOnScreens(
    playlistItem: PlaylistItem,
    mouseEvent: MouseEvent,
) {
    // A stored slide is a reference, so it has to be re-read from its document
    // before a screen can be handed anything — the same route the rows take. An
    // action is run on the screens instead of shown on them.
    await sendPlaylistItemToScreens(playlistItem, mouseEvent);
    refreshOnScreenAfterPresenting();
}

/**
 * Step the run forward one place and put what it lands on onto the screens.
 *
 * An element that holds several slides — a document — is walked SLIDE by slide
 * first: the run only leaves it once the slide on screen is its last, which is
 * what makes a whole song or sermon deck playable from here. Everything else is
 * one place of its own.
 *
 * Gated on the widget holding focus. These keys are registered on the window,
 * and the presenter's slide list answers the very same ones (`handleSlideMoving`
 * gates itself the same way) — without this, opening the preview would take the
 * keys away from the list behind it.
 */
function useNextItemShowing(
    containerRef: { current: HTMLDivElement | null },
    filePath: string,
    playlistItems: PlaylistItem[] | null | undefined,
) {
    const currentRef = useAppCurrentRef({ filePath, playlistItems });
    useKeyboardRegistering(
        nextEventMaps,
        (event) => {
            const container = containerRef.current;
            const { filePath, playlistItems } = currentRef.current;
            if (container === null || !playlistItems?.length) {
                return;
            }
            const { activeElement } = document;
            if (
                activeElement === null ||
                !container.contains(activeElement) ||
                checkIsFormControlFocused(activeElement)
            ) {
                return;
            }
            event.preventDefault();
            const fromIndex = resolvePlaylistPreviewSelectedIndex(
                filePath,
                playlistItems,
            );
            // Stay inside the element the run is on while it still has a slide
            // to show. Its own box is left where it is: what moves into view is
            // the slide, and the element's label is pinned above it anyway.
            if (
                fromIndex !== -1 &&
                stepPlaylistPreviewChild(
                    fromIndex,
                    toElementMouseEvent(toElementBox(container, fromIndex)),
                    false,
                )
            ) {
                return;
            }
            const nextIndex = findNextPlaylistPreviewIndex(
                playlistItems,
                fromIndex,
                checkPlaylistPreviewHasChildren,
            );
            // The end of the run sheet: stay on the last element rather than
            // wrapping round to the top of a live presentation.
            if (nextIndex === -1) {
                return;
            }
            const nextItem = playlistItems[nextIndex];
            setPlaylistPreviewSelectedItem(
                filePath,
                toPlaylistPreviewItemKey(nextItem),
                nextIndex,
            );
            const element = toElementBox(container, nextIndex);
            if (element !== null) {
                bringDomToNearestView(element);
            }
            const mouseEvent = toElementMouseEvent(element);
            // Crossing into an element that holds slides always opens it at its
            // FIRST one, whatever of it may still be on a screen.
            if (stepPlaylistPreviewChild(nextIndex, mouseEvent, true)) {
                return;
            }
            // Only the kinds a screen can take have something to do of their
            // own; an element that had slides to walk has just walked one.
            if (!nextItem.isScreenReachable) {
                return;
            }
            showPlaylistItemOnScreens(nextItem, mouseEvent).catch(handleError);
        },
        [],
    );
}

/**
 * Fold the whole run sheet away, or open all of it, from one place. Reaching
 * every element's own chevron costs a click per element, and a long sheet — the
 * one worth folding — is exactly where that adds up.
 *
 * Pinned beside the footer's `...` handle rather than dropped inside the footer:
 * the footer folds itself away after a couple of seconds, and these two belong
 * to READING the list, not to zooming it.
 */
function PlaylistPreviewCollapsingButtonsComp({
    filePath,
    playlistItems,
}: Readonly<{
    filePath: string;
    playlistItems: PlaylistItem[];
}>) {
    const itemKeys = useMemo(() => {
        return playlistItems.map(toPlaylistPreviewItemKey);
    }, [playlistItems]);
    const collapsedCount = usePlaylistPreviewCollapsedCount(filePath, itemKeys);
    const currentRef = useAppCurrentRef({ filePath, itemKeys });
    const handleCollapsingAll = useCallback(() => {
        const current = currentRef.current;
        setAllPlaylistPreviewItemsCollapsed(
            current.filePath,
            current.itemKeys,
            true,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleExpandingAll = useCallback(() => {
        const current = currentRef.current;
        setAllPlaylistPreviewItemsCollapsed(
            current.filePath,
            current.itemKeys,
            false,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="app-playlist-preview-collapsing-buttons">
            <button
                type="button"
                title={tran('Collapse All')}
                disabled={collapsedCount === itemKeys.length}
                onClick={handleCollapsingAll}
            >
                <i className="bi bi-arrows-collapse" />
            </button>
            <button
                type="button"
                title={tran('Expand All')}
                disabled={collapsedCount === 0}
                onClick={handleExpandingAll}
            >
                <i className="bi bi-arrows-expand" />
            </button>
        </div>
    );
}

function PlaylistPreviewBodyComp({
    filePath,
}: Readonly<{
    filePath: string;
}>) {
    const playlistItems = usePlaylistItems(filePath);
    const containerRef = useRef<HTMLDivElement>(null);
    const [thumbnailSizeScale, setThumbnailSizeScale] =
        useVarySlideThumbnailSizeScale({
            settingName: THUMBNAIL_SCALE_SETTING_NAME,
            defaultSize: DEFAULT_THUMBNAIL_SCALE,
        });
    // Ctrl+wheel and two-finger pinch, the same gestures the documents
    // previewer answers to.
    useZoomingRegistering(containerRef, {
        value: thumbnailSizeScale,
        setValue: setThumbnailSizeScale,
        defaultSize: defaultRangeSize,
    });
    const thumbnailWidth = thumbnailSizeScale * DEFAULT_THUMBNAIL_SIZE_FACTOR;
    useNextItemShowing(containerRef, filePath, playlistItems);
    return (
        <div
            className="app-playlist-preview d-flex flex-column"
            data-no-widget-drag="true"
            ref={containerRef}
            // Focusable so clicking anywhere in the list hands it the keys —
            // a plain <div> would leave focus wherever it was and the next-key
            // would keep driving the panel behind the widget.
            tabIndex={0}
        >
            {playlistItems === undefined ? (
                <LoadingComp />
            ) : playlistItems === null ? (
                <FileReadErrorComp />
            ) : playlistItems.length === 0 ? (
                <div className="p-2">{tran('No items in this playlist')}</div>
            ) : (
                playlistItems.map((playlistItem, i) => {
                    return (
                        <PlaylistItemPreviewComp
                            key={`${playlistItem.type}-${i}`}
                            playlistItem={playlistItem}
                            index={i}
                            thumbnailWidth={thumbnailWidth}
                        />
                    );
                })
            )}
            {/* Same auto-hiding footer the background panel uses, folding away
                into a `...` handle. It is made sticky in this widget's SCSS —
                the shared rule is absolute, which scrolls off with the list. */}
            <div
                className="card-footer d-flex w-100 p-0 app-auto-hide-bottom"
                ref={(element) => {
                    if (element !== null) {
                        handleAutoHide(element);
                    }
                }}
            >
                <div className="flex-fill" />
                <AppRangeComp
                    value={thumbnailSizeScale}
                    title={tran('Slide Thumbnail Size Scale')}
                    setValue={setThumbnailSizeScale}
                    defaultSize={defaultRangeSize}
                />
                {/* Keeps the bar's right end clear for the collapse/expand pair,
                    which is pinned OVER it — the zoom-in end of the range would
                    otherwise sit underneath and be unclickable. A spacer rather
                    than padding: `p-0` is a bootstrap `!important`. */}
                <div className="app-playlist-preview-collapsing-spacer" />
            </div>
            {/* After the footer on purpose: both are pinned to the widget's
                bottom edge, and the footer would otherwise paint over these two
                the moment it unfolds. */}
            {playlistItems?.length ? (
                <PlaylistPreviewCollapsingButtonsComp
                    filePath={filePath}
                    playlistItems={playlistItems}
                />
            ) : null}
        </div>
    );
}

// Single host, portaled to the body so the widget is never clipped by the left
// panel it is opened from.
export default function PlaylistPreviewFloatingComp() {
    const filePath = usePlaylistPreviewFilePath();
    const { theme } = useThemeSource();
    if (filePath === null) {
        return null;
    }
    const fileSource = FileSource.getInstance(filePath);
    return createPortal(
        <div className="app" data-bs-theme={theme}>
            <FloatingWidgetComp
                title={`${tran('Playlist')}: ${fileSource.name}`}
                persistKey="floating-widget-rect-playlist-preview"
                onClose={() => {
                    setPlaylistPreviewFilePath(null);
                }}
                options={{
                    width: 760,
                    height: 560,
                    minWidth: 320,
                    minHeight: 240,
                }}
            >
                <PlaylistPreviewBodyComp filePath={filePath} />
            </FloatingWidgetComp>
        </div>,
        document.body,
    );
}
