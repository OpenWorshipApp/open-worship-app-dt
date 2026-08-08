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
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { handleAutoHide } from '../helper/domHelpers';
import { handleError } from '../helper/errorHelpers';
import FileSource from '../helper/FileSource';
import { tran } from '../lang/langHelpers';
import FileReadErrorComp from '../others/FileReadErrorComp';
import LoadingComp from '../others/LoadingComp';
import ScrollingHandlerComp from '../scrolling/ScrollingHandlerComp';
import type PresentingFlowItem from './PresentingFlowItem';
import { toPresentingFlowActionKeyEventMapper } from './presentingFlowActionKeyHelpers';
import {
    registerPresentingFlowRunController,
    setPresentingFlowAutoNextPaused,
    stopPresentingFlowAutoNext,
    toPresentingFlowAutoNextCountdownLabel,
    usePresentingFlowAutoNext,
} from './presentingFlowAutoNextHelpers';
import { sendPresentingFlowItemToScreens } from './presentingFlowHelpers';
import { usePresentingFlowItems } from './presentingFlowItemsHelpers';
import PresentingFlowItemPreviewComp from './PresentingFlowItemPreviewComp';
import { refreshOnScreenAfterPresenting } from './presentingFlowOnScreenHelpers';
import {
    PRESENTING_FLOW_PREVIEW_ITEM_INDEX_KEY,
    bringPresentingFlowRunElementToView,
    collectPresentingFlowRunShortcutKeys,
    expandPresentingFlowPreviewItem,
    findNextPresentingFlowPreviewIndex,
    findPresentingFlowRunShortcutUuid,
    requestPresentingFlowPreviewChildEntry,
    resolvePresentingFlowPreviewSelectedIndex,
    stepPresentingFlowPreviewChild,
    setAllPresentingFlowPreviewItemsCollapsed,
    setPresentingFlowPreviewFilePath,
    setPresentingFlowPreviewSelectedItem,
    toPresentingFlowPreviewItemKey,
    usePresentingFlowPreviewCollapsedCount,
    usePresentingFlowPreviewFilePath,
} from './presentingFlowPreviewFloatingHelpers';
import { useThemeSource } from '../others/themeHelpers';

// Its own setting, so zooming the presenting flow preview does not resize the slides
// in the documents previewer (and the other way round).
const THUMBNAIL_SCALE_SETTING_NAME =
    'presenting-flow-preview-thumbnail-size-scale';
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
        `[${PRESENTING_FLOW_PREVIEW_ITEM_INDEX_KEY}="${index}"]`,
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

/**
 * Whether a key press belongs to the RUN rather than to whatever is behind the
 * widget.
 *
 * Both the next-key and the run sheet's own shortcuts ask this, and they must ask
 * the same thing: these keys are registered on the window, the presenter's slide
 * list answers the very same ones, and a shortcut that fired while the operator
 * was typing somewhere else in the widget would put something on a live screen.
 */
function checkIsPresentingFlowRunKeyOwned(container: HTMLDivElement | null) {
    const { activeElement } = document;
    return (
        activeElement !== null &&
        container !== null &&
        container.contains(activeElement) &&
        !checkIsFormControlFocused(activeElement)
    );
}

// With no screen selected, `chooseScreenIds` asks which one with a menu it
// positions from the event. A keyboard event carries no coordinates, so the
// question is pointed at the element that is being shown.
function toElementMouseEvent(element: Element | null) {
    const rect = element?.getBoundingClientRect();
    return createMouseEvent((rect?.left ?? 0) + 8, (rect?.top ?? 0) + 8);
}

async function showPresentingFlowItemOnScreens(
    presentingFlowItem: PresentingFlowItem,
    mouseEvent: MouseEvent,
) {
    // A stored slide is a reference, so it has to be re-read from its document
    // before a screen can be handed anything — the same route the rows take. An
    // action is run on the screens instead of shown on them.
    await sendPresentingFlowItemToScreens(presentingFlowItem, mouseEvent);
    refreshOnScreenAfterPresenting();
}

/**
 * Step the run forward one place and fire what it lands on.
 *
 * An element that holds several slides — a document — is walked SLIDE by slide
 * first: the run only leaves it once the slide on screen is its last, which is
 * what makes a whole song or sermon deck playable from here. Everything else is
 * one place of its own.
 *
 * Answers whether the run actually MOVED, which is what tells an auto-next
 * ticking against the end of the sheet to stop.
 */
function stepPresentingFlowRunForward(
    container: HTMLDivElement | null,
    filePath: string,
    presentingFlowItems: PresentingFlowItem[] | null | undefined,
) {
    if (container === null || !presentingFlowItems?.length) {
        return false;
    }
    const fromIndex = resolvePresentingFlowPreviewSelectedIndex(
        filePath,
        presentingFlowItems,
    );
    // Stay inside the element the run is on while it still has a slide to show.
    // Its own box is left where it is: what moves into view is the slide, and
    // the element's label is pinned above it anyway.
    if (
        fromIndex !== -1 &&
        stepPresentingFlowPreviewChild(
            fromIndex,
            toElementMouseEvent(toElementBox(container, fromIndex)),
            false,
        )
    ) {
        return true;
    }
    const nextIndex = findNextPresentingFlowPreviewIndex(
        presentingFlowItems,
        fromIndex,
    );
    // The end of the run sheet: stay on the last element rather than wrapping
    // round to the top of a live presentation.
    if (nextIndex === -1) {
        return false;
    }
    landPresentingFlowRunOnIndex(
        container,
        filePath,
        presentingFlowItems,
        nextIndex,
    );
    return true;
}

/**
 * Put the run ON an element: mark it, bring it into view, and fire it.
 *
 * The one landing for both ways in — the next-key stepping onto it and a
 * `Jump to` sending the run there — so an element behaves the same however the
 * run arrived.
 *
 * `isFromJump` withholds exactly ONE thing: an action that would move the run
 * again AT ONCE (`movesRunAtOnce`, i.e. another jump), because two jumps aimed at
 * each other would send the run back and forth for ever. Everything else fires
 * normally, a CLOCK included — jumping onto an interval starts it, which is how a
 * looping set is built: the interval walks the slides, a jump at the end of them
 * points back at the interval.
 */
function landPresentingFlowRunOnIndex(
    container: HTMLDivElement,
    filePath: string,
    presentingFlowItems: PresentingFlowItem[],
    index: number,
    isFromJump = false,
) {
    const presentingFlowItem = presentingFlowItems[index];
    const itemKey = toPresentingFlowPreviewItemKey(presentingFlowItem);
    setPresentingFlowPreviewSelectedItem(filePath, itemKey, index);
    // UNFOLD it, always. Folding is how a long sheet is READ; it must never
    // decide what takes part in the run, and an element the run has stopped on
    // with its body hidden shows the operator nothing at all.
    expandPresentingFlowPreviewItem(filePath, itemKey);
    const element = toElementBox(container, index);
    if (element !== null) {
        bringPresentingFlowRunElementToView(element);
    }
    const mouseEvent = toElementMouseEvent(element);
    // Crossing into an element that holds slides always opens it at its FIRST
    // one, whatever of it may still be on a screen.
    if (stepPresentingFlowPreviewChild(index, mouseEvent, true)) {
        return;
    }
    // It holds slides but has none to walk YET: unfolding it a moment ago is
    // what mounts its preview, and that preview then reads the slides off disk.
    // The ask is left for whenever they arrive rather than dropped — otherwise
    // stepping onto a folded song would show nothing and the run would look
    // stuck on its header.
    if (presentingFlowItem.isAppDocument) {
        requestPresentingFlowPreviewChildEntry(index, mouseEvent);
        return;
    }
    // Only the kinds that DO something when the run reaches them have anything
    // left to fire; an element that had slides to walk has just walked one, and
    // the two that do nothing (an audio track, a damaged entry) are stopped on
    // so the cursor shows where the run is, and no more.
    if (
        presentingFlowItem.isRunReachable &&
        !(isFromJump && presentingFlowItem.runAction?.movesRunAtOnce)
    ) {
        showPresentingFlowItemOnScreens(presentingFlowItem, mouseEvent).catch(
            handleError,
        );
    }
}

/**
 * Send the run to the element a `Jump to` names, or answer false when this sheet
 * no longer lists it — the line it was aimed at has been removed.
 *
 * Matched on the target's UUID rather than on a position: the sheet is reordered
 * all the time, and re-arming or renaming the line it points at must not lose
 * it. A PARKED target is passed over the same way the next-key passes it over —
 * an operator who took a line out of the run did not mean "except when jumped
 * to".
 */
function jumpPresentingFlowRunToUuid(
    container: HTMLDivElement | null,
    filePath: string,
    presentingFlowItems: PresentingFlowItem[] | null | undefined,
    uuid: string,
) {
    if (container === null || !presentingFlowItems?.length) {
        return false;
    }
    const index = presentingFlowItems.findIndex((presentingFlowItem) => {
        return (
            presentingFlowItem.uuid === uuid && !presentingFlowItem.isDisabled
        );
    });
    if (index === -1) {
        return false;
    }
    landPresentingFlowRunOnIndex(
        container,
        filePath,
        presentingFlowItems,
        index,
        true,
    );
    return true;
}

/**
 * The next-key, and the one registration that lets the run step ITSELF.
 *
 * The key is gated on the widget holding focus. These keys are registered on the
 * window, and the presenter's slide list answers the very same ones
 * (`handleSlideMoving` gates itself the same way) — without this, opening the
 * preview would take the keys away from the list behind it. An auto-next has no
 * such gate: it is the run's own clock, not a key the panel behind might want.
 */
function useNextItemShowing(
    containerRef: { current: HTMLDivElement | null },
    filePath: string,
    presentingFlowItems: PresentingFlowItem[] | null | undefined,
) {
    const currentRef = useAppCurrentRef({ filePath, presentingFlowItems });
    useKeyboardRegistering(
        nextEventMaps,
        (event) => {
            const container = containerRef.current;
            const { filePath, presentingFlowItems } = currentRef.current;
            if (!checkIsPresentingFlowRunKeyOwned(container)) {
                return;
            }
            event.preventDefault();
            stepPresentingFlowRunForward(
                container,
                filePath,
                presentingFlowItems,
            );
        },
        [],
    );
    // Registered for as long as the widget is open on this presenting flow: closing it
    // (or pointing it at another sheet) ends the run, and the cleanup stops
    // whatever was ticking with it.
    useAppEffect(() => {
        return registerPresentingFlowRunController(filePath, {
            stepForward: () => {
                const current = currentRef.current;
                return stepPresentingFlowRunForward(
                    containerRef.current,
                    current.filePath,
                    current.presentingFlowItems,
                );
            },
            jumpToUuid: (uuid) => {
                const current = currentRef.current;
                return jumpPresentingFlowRunToUuid(
                    containerRef.current,
                    current.filePath,
                    current.presentingFlowItems,
                    uuid,
                );
            },
        });
    }, [filePath]);
}

/**
 * ONE of the run sheet's own shortcuts, for as long as it is mounted.
 *
 * A component per shortcut rather than one registration for all of them, and
 * that is not a style choice: `useKeyboardRegistering` spreads the resolved event
 * names into its effect's dependency list, so a single hook watching a set that
 * grows and shrinks would hand React a dependency array that changes LENGTH
 * between renders. One shortcut per mount, keyed by the shortcut itself, keeps
 * every array a constant size — adding or re-arming one remounts exactly the
 * component whose key changed.
 *
 * Registering through the app's own keyboard layer (rather than a raw window
 * listener) is what makes a modal on top take the key back: the layer is pinned
 * at mount, and a press while a popup is open is fired under the popup's layer
 * and finds nothing registered.
 */
function PresentingFlowRunShortcutComp({
    shortcutKey,
    onTriggering,
}: Readonly<{
    shortcutKey: string;
    onTriggering: (shortcutKey: string) => void;
}>) {
    // Stable for this mount — the key never changes under a component keyed by
    // it — so the registration is done once and not on every render.
    const eventMappers = useMemo(() => {
        const eventMapper = toPresentingFlowActionKeyEventMapper(shortcutKey);
        return eventMapper === null ? [] : [eventMapper];
    }, [shortcutKey]);
    const onTriggeringRef = useAppCurrentRef(onTriggering);
    useKeyboardRegistering(eventMappers, () => {
        onTriggeringRef.current(shortcutKey);
    }, []);
    return null;
}

/**
 * The run sheet's HOTKEYS: every `Keyboard Event` line that is armed and in play,
 * each answering to its own shortcut.
 *
 * A press SENDS the run to that line, by the very landing a `Jump to` uses — so
 * whatever is attached to it goes up exactly as it would have if the operator had
 * stepped there, and the cursor is left on it so the next-key carries on from
 * there. Gated on the widget holding focus, for the same reason the next-key is.
 */
function usePresentingFlowRunShortcuts(
    containerRef: { current: HTMLDivElement | null },
    filePath: string,
    presentingFlowItems: PresentingFlowItem[] | null | undefined,
) {
    const currentRef = useAppCurrentRef({ filePath, presentingFlowItems });
    const shortcutKeys = useMemo(() => {
        return collectPresentingFlowRunShortcutKeys(presentingFlowItems);
    }, [presentingFlowItems]);
    const handleTriggering = useCallback((shortcutKey: string) => {
        const container = containerRef.current;
        const { filePath, presentingFlowItems } = currentRef.current;
        if (!checkIsPresentingFlowRunKeyOwned(container)) {
            return;
        }
        const uuid = findPresentingFlowRunShortcutUuid(
            presentingFlowItems,
            shortcutKey,
        );
        if (uuid === null) {
            return;
        }
        jumpPresentingFlowRunToUuid(
            container,
            filePath,
            presentingFlowItems,
            uuid,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return { shortcutKeys, handleTriggering };
}

/**
 * What is ticking, and the two things that can be done to it.
 *
 * HOLD it — the answer to a speaker overrunning, and the reason this is not one
 * button: losing the countdown and re-arming it afterwards was the only way to
 * say "not yet", on both clocks. STOP it — the only way out of an INTERVAL,
 * which deliberately survives clicks and keys, and an extra one out of a
 * timeout, which any input already cancels.
 *
 * Shown only while something is armed: a control that was always there would
 * read as part of the widget's furniture rather than as "this run is moving
 * itself". A div rather than one button, since two controls may not nest.
 */
function PresentingFlowPreviewAutoNextComp() {
    const autoNextState = usePresentingFlowAutoNext();
    if (autoNextState === null) {
        return null;
    }
    const { mode, remainingSeconds, isPaused } = autoNextState;
    const isInterval = mode === 'interval';
    return (
        <div
            // Tinted like the ELEMENT that armed it, so a glance at the pill and
            // a glance at the run sheet say the same thing.
            className={
                'app-presenting-flow-preview-auto-next' +
                (isInterval
                    ? ' app-presenting-flow-preview-auto-next-interval'
                    : '') +
                (isPaused
                    ? ' app-presenting-flow-preview-auto-next-paused'
                    : '')
            }
        >
            {/* First, where the eye lands: what the operator reaches for while
                a countdown is running is holding it, not ending it. */}
            <button
                type="button"
                className="app-presenting-flow-preview-auto-next-button"
                title={tran(isPaused ? 'Resume Auto Next' : 'Pause Auto Next')}
                onClick={() => {
                    setPresentingFlowAutoNextPaused(!isPaused);
                }}
            >
                <i className={'bi bi-' + (isPaused ? 'play' : 'pause')} />
            </button>
            {/* Which clock this is, kept beside the count rather than replaced
                by the toggle above: amber waits once, teal keeps going, and a
                held pill must still say which of the two it is. */}
            <i
                className={
                    'bi bi-' + (isInterval ? 'arrow-repeat' : 'hourglass-split')
                }
            />
            <span className="px-1">
                {toPresentingFlowAutoNextCountdownLabel(remainingSeconds)}
            </span>
            <button
                type="button"
                className="app-presenting-flow-preview-auto-next-button"
                title={tran('Stop Auto Next')}
                onClick={() => {
                    stopPresentingFlowAutoNext();
                }}
            >
                <i
                    className="bi bi-x-circle"
                    style={{
                        color: 'var(--bs-danger)',
                    }}
                />
            </button>
        </div>
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
function PresentingFlowPreviewCollapsingButtonsComp({
    filePath,
    presentingFlowItems,
}: Readonly<{
    filePath: string;
    presentingFlowItems: PresentingFlowItem[];
}>) {
    const itemKeys = useMemo(() => {
        return presentingFlowItems.map(toPresentingFlowPreviewItemKey);
    }, [presentingFlowItems]);
    const collapsedCount = usePresentingFlowPreviewCollapsedCount(
        filePath,
        itemKeys,
    );
    const currentRef = useAppCurrentRef({ filePath, itemKeys });
    const handleCollapsingAll = useCallback(() => {
        const current = currentRef.current;
        setAllPresentingFlowPreviewItemsCollapsed(
            current.filePath,
            current.itemKeys,
            true,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleExpandingAll = useCallback(() => {
        const current = currentRef.current;
        setAllPresentingFlowPreviewItemsCollapsed(
            current.filePath,
            current.itemKeys,
            false,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="app-presenting-flow-preview-collapsing-buttons">
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

function PresentingFlowPreviewBodyComp({
    filePath,
}: Readonly<{
    filePath: string;
}>) {
    const presentingFlowItems = usePresentingFlowItems(filePath);
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
    useNextItemShowing(containerRef, filePath, presentingFlowItems);
    const { shortcutKeys, handleTriggering } = usePresentingFlowRunShortcuts(
        containerRef,
        filePath,
        presentingFlowItems,
    );
    // The widget takes the keys the moment it opens.
    //
    // Every key this thing answers to — the next-key and the run sheet's own
    // shortcuts alike — is gated on focus being INSIDE it, so that opening the
    // preview does not steal Space and the arrows from the panel behind. But the
    // gesture that opens it leaves focus on the button in the tree, i.e. outside:
    // without this the operator's first press did nothing at all, and there was
    // nothing on screen to say that clicking the list first was what it wanted.
    //
    // On mount and on the presenting flow changing only — never on a re-render, which
    // would drag focus back out of anything inside the widget the operator is
    // actually using. `preventScroll` because the run sheet must not jump.
    useAppEffect(() => {
        containerRef.current?.focus({ preventScroll: true });
    }, [filePath]);
    return (
        <div
            className="app-presenting-flow-preview d-flex flex-column app-focusable"
            ref={containerRef}
            // Focusable so clicking anywhere in the list hands it the keys —
            // a plain <div> would leave focus wherever it was and the next-key
            // would keep driving the panel behind the widget.
            tabIndex={0}
        >
            {/* Rendered rather than registered in a hook, one per shortcut and
                keyed by it — see `PresentingFlowRunShortcutComp`. They draw nothing. */}
            {shortcutKeys.map((shortcutKey) => {
                return (
                    <PresentingFlowRunShortcutComp
                        key={shortcutKey}
                        shortcutKey={shortcutKey}
                        onTriggering={handleTriggering}
                    />
                );
            })}
            {presentingFlowItems === undefined ? (
                <LoadingComp />
            ) : presentingFlowItems === null ? (
                <FileReadErrorComp />
            ) : presentingFlowItems.length === 0 ? (
                <div className="p-2">
                    {tran('No items in this presenting flow')}
                </div>
            ) : (
                presentingFlowItems.map((presentingFlowItem, i) => {
                    return (
                        <PresentingFlowItemPreviewComp
                            key={`${presentingFlowItem.type}-${i}`}
                            presentingFlowItem={presentingFlowItem}
                            index={i}
                            itemCount={presentingFlowItems.length}
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
                {/* Keeps the bar's right end clear for the to-the-top button,
                    which is pinned OVER it — the zoom-in end of the range would
                    otherwise sit underneath and be unclickable. A spacer rather
                    than padding: `p-0` is a bootstrap `!important`. The
                    collapse/expand pair needs no such reservation at the other
                    end: that is where the bar's own `flex-fill` gap is. */}
                <div className="app-presenting-flow-preview-collapsing-spacer" />
            </div>
            {/* After the footer on purpose: these are pinned to the same bottom
                edge it is, and it would otherwise paint over them the moment it
                unfolds. */}
            {presentingFlowItems?.length ? (
                <>
                    <PresentingFlowPreviewCollapsingButtonsComp
                        filePath={filePath}
                        presentingFlowItems={presentingFlowItems}
                    />
                    {/* The same to-the-top affordance the documents previewer
                        and the file lists carry, in the corner it sits in
                        everywhere else. A run sheet is walked downwards and a
                        long one leaves its opening item far above, so getting
                        back to the top is worth not scrolling for. The scroller
                        is named because it is NOT this list — the widget's body
                        scrolls it. */}
                    <ScrollingHandlerComp scrollingContainerSelector=".floating-widget__content" />
                </>
            ) : null}
            {/* Pinned at the TOP, opposite the collapse pair: it is the one
                thing in here that changes on its own, and it must be readable
                without scrolling back to whichever element armed it. */}
            <PresentingFlowPreviewAutoNextComp />
        </div>
    );
}

// Single host, portaled to the body so the widget is never clipped by the left
// panel it is opened from.
export default function PresentingFlowPreviewFloatingComp() {
    const filePath = usePresentingFlowPreviewFilePath();
    const { theme } = useThemeSource();
    if (filePath === null) {
        return null;
    }
    const fileSource = FileSource.getInstance(filePath);
    return createPortal(
        <div className="app app-floating-widget-portal" data-bs-theme={theme}>
            <FloatingWidgetComp
                title={`${tran('Presenting Flow')}: ${fileSource.name}`}
                persistKey="floating-widget-rect-presenting-flow-preview"
                onClose={() => {
                    setPresentingFlowPreviewFilePath(null);
                }}
                options={{
                    width: 760,
                    height: 560,
                    minWidth: 320,
                    minHeight: 240,
                }}
            >
                <PresentingFlowPreviewBodyComp filePath={filePath} />
            </FloatingWidgetComp>
        </div>,
        document.body,
    );
}
