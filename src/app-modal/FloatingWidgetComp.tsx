import './FloatingWidgetComp.scss';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
    PointerEvent as ReactPointerEvent,
    PropsWithChildren,
    ReactNode,
} from 'react';
import { useThemeSource } from '../others/themeHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import {
    COLLAPSED_HEIGHT,
    RESIZE_HANDLES,
    clampWidgetRect,
    getInitialWidgetRect,
    isBlankDragArea,
    isIgnored,
    isOnScrollbar,
    readPersistedRect,
    resizeWidgetRect,
    writePersistedRect,
} from './floatingWidgetHelpers';
import type {
    FloatingWidgetOptions,
    InteractionMode,
    InteractionState,
    ResizeHandle,
} from './floatingWidgetHelpers';

interface MyProps {
    children?: ReactNode;
    collapsedChildren?: ReactNode | null;
    title?: ReactNode;
    onClose: () => void;
    // When set, the widget's size and location are saved under this setting key
    // and restored the next time it opens.
    persistKey?: string;
    options?: FloatingWidgetOptions;
}

export default function FloatingWidgetComp({
    children,
    collapsedChildren = null,
    title,
    options,
    persistKey,
    onClose,
}: PropsWithChildren<MyProps>) {
    const widgetRef = useRef<HTMLDivElement>(null);
    const interactionRef = useRef<InteractionState | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [activeMode, setActiveMode] = useState<InteractionMode | null>(null);
    const [widgetRect, setWidgetRect] = useState(() => {
        if (persistKey !== undefined) {
            const persistedRect = readPersistedRect(persistKey);
            if (persistedRect !== null) {
                return clampWidgetRect(persistedRect, options);
            }
        }
        return getInitialWidgetRect(options);
    });
    const widgetRectRef = useAppCurrentRef(widgetRect);
    const persistKeyRef = useAppCurrentRef(persistKey);
    const optionsRef = useAppCurrentRef(options);
    const isCollapsedRef = useAppCurrentRef(isCollapsed);
    const optionHeight = options?.height;
    const optionMaxHeight = options?.maxHeight;
    const optionMaxWidth = options?.maxWidth;
    const optionMinHeight = options?.minHeight;
    const optionMinWidth = options?.minWidth;
    const optionWidth = options?.width;

    useEffect(() => {
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

            interactionRef.current = {
                mode,
                handle,
                pointerId: event.pointerId,
                startClientX: event.clientX,
                startClientY: event.clientY,
                startRect: widgetRectRef.current,
            };
            widgetRef.current?.setPointerCapture(event.pointerId);
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
            if (interactionState?.pointerId !== event.pointerId) {
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
            if (interactionState?.pointerId !== event.pointerId) {
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

    const { theme } = useThemeSource();

    const actionButtons = (
        <div
            className="floating-widget__actions"
            onPointerDown={(event) => event.stopPropagation()}
        >
            <button
                type="button"
                className="floating-widget__button"
                onClick={() => setIsCollapsed((prev) => !prev)}
                aria-label={
                    isCollapsed
                        ? 'Expand floating widget'
                        : 'Collapse floating widget'
                }
                title={
                    isCollapsed
                        ? 'Expand floating widget'
                        : 'Collapse floating widget'
                }
            >
                <i className={`bi bi-chevron-${isCollapsed ? 'up' : 'down'}`} />
            </button>
            <button
                type="button"
                className="floating-widget__button"
                onClick={onClose}
                aria-label="Close floating widget"
                title="Close floating widget"
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
                isCollapsed ? 'floating-widget--collapsed' : '',
                activeMode === 'move' ? 'floating-widget--moving' : '',
                activeMode === 'resize' ? 'floating-widget--resizing' : '',
                options?.extraClassName ?? '',
            ]
                .filter(Boolean)
                .join(' ')}
            style={{
                ...options?.extraStyle,
                left: widgetRect.left,
                top: widgetRect.top,
                width: widgetRect.width,
                height: isCollapsed ? COLLAPSED_HEIGHT : widgetRect.height,
            }}
            onPointerDown={handleWidgetPointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishInteraction}
            onPointerCancel={finishInteraction}
        >
            {title == null ? (
                <div className="floating-widget__toolbar">{actionButtons}</div>
            ) : (
                <div className="floating-widget__header">
                    <div className="floating-widget__title">{title}</div>
                    {actionButtons}
                </div>
            )}
            <div className="floating-widget__content">
                {isCollapsed ? collapsedChildren : children}
            </div>
            {!isCollapsed &&
                RESIZE_HANDLES.map((handle) => (
                    <div
                        key={handle}
                        className={`floating-widget__resize-handle floating-widget__resize-handle--${handle}`}
                        onPointerDown={(event) =>
                            startInteraction(event, 'resize', handle)
                        }
                        title="Drag to resize"
                        aria-hidden="true"
                    />
                ))}
        </div>
    );
}
