import './FloatingWidgetComp.scss';

import { useEffect, useRef, useState } from 'react';
import type {
    CSSProperties,
    PointerEvent as ReactPointerEvent,
    PropsWithChildren,
    ReactNode,
} from 'react';

const VIEWPORT_PADDING = 8;
const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 240;
const DEFAULT_MIN_WIDTH = 220;
const DEFAULT_MIN_HEIGHT = 140;
const COLLAPSED_HEIGHT = 42;

type WidgetRect = {
    left: number;
    top: number;
    width: number;
    height: number;
};

type InteractionMode = 'move' | 'resize';

type InteractionState = {
    mode: InteractionMode;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startRect: WidgetRect;
};

type FloatingWidgetOptions = NonNullable<MyProps['options']>;

function clampNumber(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), Math.max(min, max));
}

function getViewportSize() {
    if (
        globalThis.window === undefined ||
        globalThis.document === undefined
    ) {
        return {
            width: DEFAULT_WIDTH + VIEWPORT_PADDING * 2,
            height: DEFAULT_HEIGHT + VIEWPORT_PADDING * 2,
        };
    }

    return {
        width:
            globalThis.document.documentElement.clientWidth ||
            globalThis.window.innerWidth,
        height:
            globalThis.document.documentElement.clientHeight ||
            globalThis.window.innerHeight,
    };
}

function getConstrainedSize(
    width: number,
    height: number,
    options?: FloatingWidgetOptions,
) {
    const viewportSize = getViewportSize();
    const viewportMaxWidth = Math.max(
        VIEWPORT_PADDING,
        viewportSize.width - VIEWPORT_PADDING * 2,
    );
    const viewportMaxHeight = Math.max(
        VIEWPORT_PADDING,
        viewportSize.height - VIEWPORT_PADDING * 2,
    );
    const maxWidth = Math.min(
        options?.maxWidth ?? viewportMaxWidth,
        viewportMaxWidth,
    );
    const maxHeight = Math.min(
        options?.maxHeight ?? viewportMaxHeight,
        viewportMaxHeight,
    );
    const minWidth = Math.min(options?.minWidth ?? DEFAULT_MIN_WIDTH, maxWidth);
    const minHeight = Math.min(
        options?.minHeight ?? DEFAULT_MIN_HEIGHT,
        maxHeight,
    );

    return {
        width: clampNumber(width, minWidth, maxWidth),
        height: clampNumber(height, minHeight, maxHeight),
    };
}

function clampWidgetRect(
    rect: WidgetRect,
    options?: FloatingWidgetOptions,
    isCollapsed = false,
) {
    const viewportSize = getViewportSize();
    const size = getConstrainedSize(rect.width, rect.height, options);
    const renderedHeight = isCollapsed ? COLLAPSED_HEIGHT : size.height;

    return {
        left: clampNumber(
            rect.left,
            VIEWPORT_PADDING,
            viewportSize.width - size.width - VIEWPORT_PADDING,
        ),
        top: clampNumber(
            rect.top,
            VIEWPORT_PADDING,
            viewportSize.height - renderedHeight - VIEWPORT_PADDING,
        ),
        ...size,
    };
}

function getInitialWidgetRect(options?: FloatingWidgetOptions) {
    const size = getConstrainedSize(
        options?.width ?? DEFAULT_WIDTH,
        options?.height ?? DEFAULT_HEIGHT,
        options,
    );
    const viewportSize = getViewportSize();

    return clampWidgetRect(
        {
            left: viewportSize.width - size.width - 24,
            top: 64,
            ...size,
        },
        options,
    );
}

interface MyProps {
    children?: ReactNode;
    onClose: () => void;
    options?: {
        extraStyle?: CSSProperties;
        extraClassName?: string;
        width?: number;
        height?: number;
        minWidth?: number;
        minHeight?: number;
        maxWidth?: number;
        maxHeight?: number;
    };
}

export default function FloatingWidgetComp({
    children,
    options,
    onClose,
}: PropsWithChildren<MyProps>) {
    const widgetRef = useRef<HTMLDivElement>(null);
    const interactionRef = useRef<InteractionState | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [widgetRect, setWidgetRect] = useState(() =>
        getInitialWidgetRect(options),
    );
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

        setWidgetRect((prev) =>
            clampWidgetRect(
                {
                    ...prev,
                    width: optionWidth ?? prev.width,
                    height: optionHeight ?? prev.height,
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
            globalThis.window.removeEventListener('resize', handleViewportResize);
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

    const startInteraction = (
        event: ReactPointerEvent<HTMLElement>,
        mode: InteractionMode,
    ) => {
        if (event.button !== 0) {
            return;
        }

        interactionRef.current = {
            mode,
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startRect: widgetRect,
        };
        widgetRef.current?.setPointerCapture(event.pointerId);
        event.preventDefault();
    };

    const finishInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (interactionRef.current?.pointerId !== event.pointerId) {
            return;
        }

        if (widgetRef.current?.hasPointerCapture(event.pointerId)) {
            widgetRef.current.releasePointerCapture(event.pointerId);
        }
        interactionRef.current = null;
    };

    const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        const interactionState = interactionRef.current;
        if (interactionState?.pointerId !== event.pointerId) {
            return;
        }

        const deltaX = event.clientX - interactionState.startClientX;
        const deltaY = event.clientY - interactionState.startClientY;

        if (interactionState.mode === 'move') {
            setWidgetRect(
                clampWidgetRect(
                    {
                        ...interactionState.startRect,
                        left: interactionState.startRect.left + deltaX,
                        top: interactionState.startRect.top + deltaY,
                    },
                    options,
                    isCollapsed,
                ),
            );
            return;
        }

        setWidgetRect(
            clampWidgetRect(
                {
                    ...interactionState.startRect,
                    width: interactionState.startRect.width + deltaX,
                    height: interactionState.startRect.height + deltaY,
                },
                options,
            ),
        );
    };

    return (
        <div
            ref={widgetRef}
            className={[
                'floating-widget',
                isCollapsed ? 'floating-widget--collapsed' : '',
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
            onPointerMove={handlePointerMove}
            onPointerUp={finishInteraction}
            onPointerCancel={finishInteraction}
        >
            <div className="floating-widget__toolbar">
                <div
                    className="floating-widget__actions"
                    onPointerDown={(event) => event.stopPropagation()}
                >
                    <button
                        type="button"
                        className="floating-widget__drag-indicator"
                        onPointerDown={(event) => startInteraction(event, 'move')}
                        aria-label="Move floating widget"
                        title="Move floating widget"
                    >
                        <i className="bi bi-grip-horizontal" />
                    </button>
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
                        <i
                            className={`bi bi-chevron-${isCollapsed ? 'up' : 'down'}`}
                        />
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
            </div>
            <div className="floating-widget__content" hidden={isCollapsed}>
                {children}
            </div>
            {!isCollapsed && (
                <button
                    type="button"
                    className="floating-widget__resize-handle"
                    onPointerDown={(event) => startInteraction(event, 'resize')}
                    aria-label="Resize floating widget"
                    title="Resize floating widget"
                >
                    <i className="bi bi-arrow-down-right" />
                </button>
            )}
        </div>
    );
}
