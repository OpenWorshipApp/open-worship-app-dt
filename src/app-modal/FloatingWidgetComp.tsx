import './FloatingWidgetComp.scss';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
    CSSProperties,
    PointerEvent as ReactPointerEvent,
    PropsWithChildren,
    ReactNode,
} from 'react';
import { useThemeSource } from '../others/themeHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';
import {
    COLLAPSED_HEIGHT,
    FLOATING_WIDGET_MAX_Z_OFFSET,
    RESIZE_HANDLES,
    bringFloatingWidgetToFront,
    clampWidgetRect,
    getInitialWidgetRect,
    getMaximizedWidgetRect,
    isBlankDragArea,
    isIgnored,
    isOnScrollbar,
    readPersistedRect,
    registerFloatingWidget,
    resizeWidgetRect,
    toggleMaximizedWidgetRect,
    writePersistedRect,
} from './floatingWidgetHelpers';
import { useIsInModalLayer } from './modalLayerContext';
import type {
    FloatingWidgetOptions,
    InteractionMode,
    InteractionState,
    ResizeHandle,
    WidgetRect,
} from './floatingWidgetHelpers';

// The header's maximize gesture is detected from the presses themselves rather
// than from a `dblclick` event, because there IS no `dblclick` here: pressing
// the header starts a move and `startInteraction` cancels the `pointerdown`,
// which makes Chromium drop the whole compatibility sequence after it —
// `mousedown`, `mouseup`, `click` and `dblclick` all included. Verified live.
const DOUBLE_PRESS_MILLISECOND = 400;
// A second press this far from the first is a new gesture somewhere else, not
// the other half of a double-click.
const DOUBLE_PRESS_SLOP_PIXEL = 6;

interface MyProps {
    children?: ReactNode;
    collapsedChildren?: ReactNode | null;
    title?: ReactNode;
    // Widget-specific buttons placed before the collapse/close pair. They share
    // the actions container, so they are excluded from the drag surface too.
    extraActionButtons?: ReactNode;
    onClose: () => void;
    // When set, the widget's size and location are saved under this setting key
    // and restored the next time it opens.
    persistKey?: string;
    // Bump this to pull the widget back to the front. For hosts whose "open"
    // gesture can land on a widget that is ALREADY open: pressing inside a
    // widget raises it, but a request coming from anywhere else in the app has
    // no other way to say "this one, now".
    raiseToken?: number;
    options: FloatingWidgetOptions;
}

/**
 * Whether a pointer event belongs to the gesture currently in progress.
 *
 * The null check is SEPARATE from the pointer comparison on purpose: with no
 * gesture in progress `interactionState?.pointerId` is `undefined`, and an event
 * whose own `pointerId` is `undefined` — a synthetic or replayed one — then
 * compares EQUAL. Callers went on to read `startRect` off null, and an uncaught
 * throw here escalates to the app's "Reload is needed" dialog (the same hazard
 * `setPointerCapture` is wrapped against below).
 */
function checkIsOwnPointer(
    interactionState: InteractionState | null,
    event: ReactPointerEvent<HTMLElement>,
): interactionState is InteractionState {
    return (
        interactionState !== null &&
        interactionState.pointerId === event.pointerId
    );
}

export default function FloatingWidgetComp({
    children,
    collapsedChildren = null,
    title,
    extraActionButtons = null,
    options = {},
    persistKey,
    raiseToken,
    onClose,
}: PropsWithChildren<MyProps>) {
    // The widget portals to `document.body`, so only the React tree can tell it
    // that a modal opened it and it therefore has to stack above that modal.
    const isInModalLayer = useIsInModalLayer();
    const isAboveModal = options.isAboveModal ?? isInModalLayer;
    const widgetRef = useRef<HTMLDivElement>(null);
    const interactionRef = useRef<InteractionState | null>(null);
    // The previous press on the header, kept only long enough to recognize the
    // next one as its double-click partner.
    const lastHeaderPressRef = useRef<{
        timeStamp: number;
        clientX: number;
        clientY: number;
    } | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [activeMode, setActiveMode] = useState<InteractionMode | null>(null);
    // A widget that just opened is the one the user asked for, so it starts on
    // top; the registry corrects this on the very next notification.
    const [zIndexOffset, setZIndexOffset] = useState(
        FLOATING_WIDGET_MAX_Z_OFFSET,
    );
    // Stable identity: it is both the registry key and the callback, so it must
    // survive re-renders.
    const stackListenerRef = useRef((nextOffset: number) => {
        setZIndexOffset(nextOffset);
    });
    const [widgetRect, setWidgetRect] = useState(() => {
        if (persistKey !== undefined) {
            const persistedRect = readPersistedRect(persistKey);
            if (persistedRect !== null) {
                return clampWidgetRect(persistedRect, options);
            }
        }
        return getInitialWidgetRect(options);
    });
    // Non-null ONLY while maximized, and it holds the rect to go back to — the
    // flag and its payload are the same value, so they cannot drift apart. Not
    // persisted on purpose: filling the viewport is a look-at-this-now gesture,
    // and saving it would reopen the widget maximized with nothing to restore.
    const [restoreRect, setRestoreRect] = useState<WidgetRect | null>(null);
    const isMaximized = restoreRect !== null;
    const widgetRectRef = useAppCurrentRef(widgetRect);
    const restoreRectRef = useAppCurrentRef(restoreRect);
    const isMaximizedRef = useAppCurrentRef(isMaximized);
    const persistKeyRef = useAppCurrentRef(persistKey);
    const optionsRef = useAppCurrentRef(options);
    const isCollapsedRef = useAppCurrentRef(isCollapsed);
    const optionHeight = options.height;
    const optionMaxHeight = options.maxHeight;
    const optionMaxWidth = options.maxWidth;
    const optionMinHeight = options.minHeight;
    const optionMinWidth = options.minWidth;
    const optionWidth = options.width;

    useEffect(() => {
        return registerFloatingWidget(stackListenerRef.current);
    }, []);

    // Any press inside the widget raises it — capture phase, so it still runs
    // for the buttons, inputs and resize handles whose own handlers stop the
    // event from bubbling up to here.
    const handleBringToFront = useCallback(() => {
        bringFloatingWidgetToFront(stackListenerRef.current);
    }, []);

    useEffect(() => {
        // Skipped on mount: a widget that just opened already starts on top,
        // and raising it here would reorder the registry for nothing.
        if (raiseToken === undefined || raiseToken === 0) {
            return;
        }
        bringFloatingWidgetToFront(stackListenerRef.current);
    }, [raiseToken]);

    useEffect(() => {
        // A maximized widget owns its rect until the user puts it back — the
        // option size and the caps around it are exactly what the gesture
        // overrode. Read through a ref, NOT a dependency: as a dep this would
        // re-run on the way back down and snap a hand-resized non-persisted
        // widget to the option size instead of to what it had before.
        if (isMaximizedRef.current) {
            return;
        }
        const sizingOptions = {
            height: optionHeight,
            maxHeight: optionMaxHeight,
            maxWidth: optionMaxWidth,
            minHeight: optionMinHeight,
            minWidth: optionMinWidth,
            width: optionWidth,
        };

        // A persisted widget keeps its restored size; only viewport/constraint
        // clamping applies. Otherwise it tracks the option size as before.
        const hasPersist = persistKeyRef.current !== undefined;
        setWidgetRect((prev) =>
            clampWidgetRect(
                {
                    ...prev,
                    width: hasPersist
                        ? prev.width
                        : (optionWidth ?? prev.width),
                    height: hasPersist
                        ? prev.height
                        : (optionHeight ?? prev.height),
                },
                sizingOptions,
                isCollapsed,
            ),
        );
    }, [
        isCollapsed,
        isMaximizedRef,
        optionHeight,
        optionMaxHeight,
        optionMaxWidth,
        optionMinHeight,
        optionMinWidth,
        optionWidth,
        persistKeyRef,
    ]);

    useEffect(() => {
        const sizingOptions = {
            height: optionHeight,
            maxHeight: optionMaxHeight,
            maxWidth: optionMaxWidth,
            minHeight: optionMinHeight,
            minWidth: optionMinWidth,
            width: optionWidth,
        };
        const handleViewportResize = () => {
            // Maximized means "the whole viewport", so a viewport that grew has
            // to be filled again; clamping alone would only ever shrink it.
            if (isMaximizedRef.current) {
                setWidgetRect(getMaximizedWidgetRect());
                return;
            }
            setWidgetRect((prev) =>
                clampWidgetRect(prev, sizingOptions, isCollapsed),
            );
        };

        globalThis.window.addEventListener('resize', handleViewportResize);
        return () => {
            globalThis.window.removeEventListener(
                'resize',
                handleViewportResize,
            );
        };
    }, [
        isCollapsed,
        isMaximizedRef,
        optionHeight,
        optionMaxHeight,
        optionMaxWidth,
        optionMinHeight,
        optionMinWidth,
        optionWidth,
    ]);

    const startInteraction = useCallback(
        (
            event: ReactPointerEvent<HTMLElement>,
            mode: InteractionMode,
            handle: ResizeHandle | null = null,
        ) => {
            if (event.button !== 0) {
                return;
            }

            // Dragging a resize handle makes the widget whatever size the user
            // dragged it to, so it is no longer "maximized" and the remembered
            // rect would be a surprise to jump back to. NOT done for `move`: a
            // double-click on the header is two full press/release pairs, so
            // clearing here would undo the maximize before the second click
            // even lands.
            if (mode === 'resize' && isMaximizedRef.current) {
                setRestoreRect(null);
            }

            interactionRef.current = {
                mode,
                handle,
                pointerId: event.pointerId,
                startClientX: event.clientX,
                startClientY: event.clientY,
                startRect: widgetRectRef.current,
            };
            try {
                widgetRef.current?.setPointerCapture(event.pointerId);
            } catch {
                // Throws (NotFoundError) for a pointer id that is not active —
                // a synthetic/replayed event, or a pointer the OS already
                // cancelled. The move/resize still tracks through this
                // component's own pointermove/up handlers, and an uncaught throw
                // here would escalate to the app's "Reload is needed" dialog.
            }
            setActiveMode(mode);
            event.preventDefault();
            event.stopPropagation();
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const finishInteraction = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            const interactionState = interactionRef.current;
            if (!checkIsOwnPointer(interactionState, event)) {
                return;
            }

            if (widgetRef.current?.hasPointerCapture(event.pointerId)) {
                widgetRef.current.releasePointerCapture(event.pointerId);
            }
            interactionRef.current = null;
            setActiveMode(null);

            // Save the new size/location once, only when the gesture actually
            // moved or resized the widget (a plain click leaves the rect
            // untouched).
            const persistKeyValue = persistKeyRef.current;
            if (persistKeyValue !== undefined) {
                const { startRect } = interactionState;
                const currentRect = widgetRectRef.current;
                const isChanged =
                    currentRect.left !== startRect.left ||
                    currentRect.top !== startRect.top ||
                    currentRect.width !== startRect.width ||
                    currentRect.height !== startRect.height;
                if (isChanged) {
                    writePersistedRect(persistKeyValue, currentRect);
                }
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const handlePointerMove = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            const interactionState = interactionRef.current;
            if (!checkIsOwnPointer(interactionState, event)) {
                return;
            }

            const deltaX = event.clientX - interactionState.startClientX;
            const deltaY = event.clientY - interactionState.startClientY;

            const nextRect =
                interactionState.mode === 'move'
                    ? clampWidgetRect(
                          {
                              ...interactionState.startRect,
                              left: interactionState.startRect.left + deltaX,
                              top: interactionState.startRect.top + deltaY,
                          },
                          optionsRef.current,
                          isCollapsedRef.current,
                      )
                    : resizeWidgetRect(
                          interactionState.startRect,
                          interactionState.handle ?? 'bottom-right',
                          deltaX,
                          deltaY,
                          optionsRef.current,
                      );
            // Track the latest rect synchronously so finishInteraction persists
            // the correct value even before React re-renders from setWidgetRect.
            widgetRectRef.current = nextRect;
            setWidgetRect(nextRect);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const handleWidgetPointerDown = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            const target = event.target;
            if (
                !(target instanceof Element) ||
                !isBlankDragArea(target) ||
                isIgnored(target)
            ) {
                return;
            }
            if (isOnScrollbar(event.clientX, event.clientY, target)) {
                return;
            }
            startInteraction(event, 'move');
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    // Double-pressing the header is the quick "fill the viewport" gesture, and
    // doing it again puts the widget back at the size and place it had.
    const handleHeaderPointerDown = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            const target = event.target;
            // The same surface that can be dragged by, so double-clicking the
            // collapse/close/extra buttons keeps meaning what it always did.
            if (
                event.button !== 0 ||
                !(target instanceof Element) ||
                !isBlankDragArea(target) ||
                isIgnored(target)
            ) {
                return;
            }

            const previousPress = lastHeaderPressRef.current;
            const isDoublePress =
                previousPress !== null &&
                event.timeStamp - previousPress.timeStamp <=
                    DOUBLE_PRESS_MILLISECOND &&
                Math.abs(event.clientX - previousPress.clientX) <=
                    DOUBLE_PRESS_SLOP_PIXEL &&
                Math.abs(event.clientY - previousPress.clientY) <=
                    DOUBLE_PRESS_SLOP_PIXEL;
            if (!isDoublePress) {
                lastHeaderPressRef.current = {
                    timeStamp: event.timeStamp,
                    clientX: event.clientX,
                    clientY: event.clientY,
                };
                return;
            }

            // Cleared so a third press starts counting again instead of undoing
            // what the second one just did.
            lastHeaderPressRef.current = null;
            const next = toggleMaximizedWidgetRect(
                widgetRectRef.current,
                restoreRectRef.current,
                optionsRef.current,
                isCollapsedRef.current,
            );
            // Kept in step synchronously, the way a drag does: a press landing
            // before React re-renders must not resize from the stale rect.
            widgetRectRef.current = next.rect;
            setWidgetRect(next.rect);
            setRestoreRect(next.restoreRect);
            // Held back from the widget's own handler so this press starts no
            // move gesture — the widget just jumped somewhere else, and a drag
            // from the old grab point would fight it.
            event.stopPropagation();
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const { theme } = useThemeSource();

    const collapseLabel = isCollapsed
        ? tran('Expand floating widget')
        : tran('Collapse floating widget');
    const actionButtons = (
        <div
            className="floating-widget__actions"
            onPointerDown={(event) => event.stopPropagation()}
        >
            {extraActionButtons}
            <button
                type="button"
                className="floating-widget__button"
                onClick={() => setIsCollapsed((prev) => !prev)}
                aria-label={collapseLabel}
                title={collapseLabel}
            >
                <i className={`bi bi-chevron-${isCollapsed ? 'up' : 'down'}`} />
            </button>
            <button
                type="button"
                className="floating-widget__button"
                onClick={onClose}
                aria-label={tran('Close floating widget')}
                title={tran('Close floating widget')}
            >
                <i className="bi bi-x-lg" />
            </button>
        </div>
    );

    return (
        <div
            ref={widgetRef}
            data-bs-theme={theme}
            className={[
                'floating-widget',
                isAboveModal ? 'floating-widget--above-modal' : '',
                isCollapsed ? 'floating-widget--collapsed' : '',
                activeMode === 'move' ? 'floating-widget--moving' : '',
                activeMode === 'resize' ? 'floating-widget--resizing' : '',
                options.extraClassName ?? '',
            ]
                .filter(Boolean)
                .join(' ')}
            style={
                {
                    ...options.extraStyle,
                    left: widgetRect.left,
                    top: widgetRect.top,
                    width: widgetRect.width,
                    height: isCollapsed ? COLLAPSED_HEIGHT : widgetRect.height,
                    '--floating-widget-z-offset': zIndexOffset,
                } as CSSProperties
            }
            onPointerDownCapture={handleBringToFront}
            onFocusCapture={handleBringToFront}
            onPointerDown={handleWidgetPointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishInteraction}
            onPointerCancel={finishInteraction}
        >
            {title == null ? (
                <div className="floating-widget__toolbar">{actionButtons}</div>
            ) : (
                <div
                    className="floating-widget__header"
                    onPointerDown={handleHeaderPointerDown}
                >
                    <div className="floating-widget__title">{title}</div>
                    {actionButtons}
                </div>
            )}
            <div
                className="floating-widget__content"
                // `== null`, matching the header branch above: a widget given
                // NO title renders the overlay toolbar instead of a header, and
                // that toolbar is `pointer-events: none`. Marking its body
                // no-drag too would leave the widget with no drag surface at
                // all — only the resize handles — so it could never be moved
                // (`NoteItemEditorPopupComp`'s Bible Lookup is one such widget).
                data-no-widget-drag={
                    title == null || options.isBodyDraggable ? 'false' : 'true'
                }
            >
                {isCollapsed ? collapsedChildren : children}
            </div>
            {!isCollapsed &&
                RESIZE_HANDLES.map((handle) => (
                    <div
                        key={handle}
                        className={`floating-widget__resize-handle floating-widget__resize-handle--${handle}`}
                        data-no-widget-drag="true"
                        onPointerDown={(event) =>
                            startInteraction(event, 'resize', handle)
                        }
                        title={tran('Drag to resize')}
                        aria-hidden="true"
                    />
                ))}
        </div>
    );
}
