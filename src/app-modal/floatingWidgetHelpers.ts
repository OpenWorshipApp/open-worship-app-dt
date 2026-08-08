import type { CSSProperties } from 'react';

import { getSetting, setSetting } from '../helper/settingHelpers';
import { type MutationType } from '../helper/helpers';

const VIEWPORT_PADDING = 8;
const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 240;
const DEFAULT_MIN_WIDTH = 220;
const DEFAULT_MIN_HEIGHT = 140;
export const COLLAPSED_HEIGHT = 42;

const PARENT_IGNORE_SELECTORS = ['[data-no-widget-drag="true"]'];
// Pressing on these elements keeps their own click/drag behavior instead of
// starting a widget move, so blank areas stay draggable without breaking
// interactive controls inside the widget.
const NON_DRAGGABLE_SELECTOR = [
    'a',
    'button',
    'input',
    'textarea',
    'select',
    'label',
    '[role="button"]',
    '[role="textbox"]',
    '[role="menuitem"]',
    '[contenteditable="true"]',
].join(',');

export type WidgetRect = {
    left: number;
    top: number;
    width: number;
    height: number;
};

export type InteractionMode = 'move' | 'resize';

export type ResizeHandle =
    | 'top'
    | 'right'
    | 'bottom'
    | 'left'
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right';

export const RESIZE_HANDLES: ResizeHandle[] = [
    'top',
    'right',
    'bottom',
    'left',
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
];

export type InteractionState = {
    mode: InteractionMode;
    handle: ResizeHandle | null;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startRect: WidgetRect;
};

export type FloatingWidgetOptions = {
    extraStyle?: CSSProperties;
    extraClassName?: string;
    width?: number;
    height?: number;
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    isBodyDraggable?: boolean;
    // Shifts only the FIRST-EVER position, before anything is persisted. For
    // hosts that can open several widgets at once and would otherwise drop them
    // all on the same spot.
    initialOffset?: number;
};

// Floating widgets are opened by unrelated hosts in unrelated React trees, so
// "the focused one is on top" cannot be solved by DOM order — they all share the
// same base z-index from the stylesheet and only their offset inside the
// reserved band changes. Keep in sync with `$z-index-floating-widget-band`.
export const FLOATING_WIDGET_MAX_Z_OFFSET = 9;

type StackListener = (zIndexOffset: number) => void;

// Live widgets, oldest-focused first — the tail is the topmost one. Only ever
// holds the handful of widgets currently mounted, and is emptied by unmounts.
const stackedWidgetListeners: StackListener[] = [];

function notifyStackedWidgets() {
    const { length } = stackedWidgetListeners;
    stackedWidgetListeners.forEach((listener, index) => {
        // Counting from the TOP keeps the widgets the user cares about
        // separated; if more than the band is open, the bottom ones tie at the
        // floor instead of the top ones tying with each other.
        const indexFromTop = length - 1 - index;
        listener(Math.max(0, FLOATING_WIDGET_MAX_Z_OFFSET - indexFromTop));
    });
}

export function registerFloatingWidget(listener: StackListener) {
    stackedWidgetListeners.push(listener);
    notifyStackedWidgets();
    return () => {
        const index = stackedWidgetListeners.indexOf(listener);
        if (index !== -1) {
            stackedWidgetListeners.splice(index, 1);
            notifyStackedWidgets();
        }
    };
}

export function bringFloatingWidgetToFront(listener: StackListener) {
    const index = stackedWidgetListeners.indexOf(listener);
    // Already on top (the common case for repeated clicks in one widget) — no
    // reorder and no re-render of anything.
    if (index === -1 || index === stackedWidgetListeners.length - 1) {
        return;
    }
    stackedWidgetListeners.splice(index, 1);
    stackedWidgetListeners.push(listener);
    notifyStackedWidgets();
}

function clampNumber(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), Math.max(min, max));
}

function getViewportSize() {
    if (globalThis.window === undefined || globalThis.document === undefined) {
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
    options: FloatingWidgetOptions,
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
        options.maxWidth ?? viewportMaxWidth,
        viewportMaxWidth,
    );
    const maxHeight = Math.min(
        options.maxHeight ?? viewportMaxHeight,
        viewportMaxHeight,
    );
    const minWidth = Math.min(options.minWidth ?? DEFAULT_MIN_WIDTH, maxWidth);
    const minHeight = Math.min(
        options.minHeight ?? DEFAULT_MIN_HEIGHT,
        maxHeight,
    );

    return {
        width: clampNumber(width, minWidth, maxWidth),
        height: clampNumber(height, minHeight, maxHeight),
    };
}

export function clampWidgetRect(
    rect: WidgetRect,
    options: FloatingWidgetOptions,
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

function getResizeEdges(handle: ResizeHandle) {
    return {
        isLeft: handle.includes('left'),
        isRight: handle.includes('right'),
        isTop: handle.includes('top'),
        isBottom: handle.includes('bottom'),
    };
}

export function resizeWidgetRect(
    startRect: WidgetRect,
    handle: ResizeHandle,
    deltaX: number,
    deltaY: number,
    options: FloatingWidgetOptions,
) {
    const edges = getResizeEdges(handle);
    const right = startRect.left + startRect.width;
    const bottom = startRect.top + startRect.height;

    let width = startRect.width;
    let height = startRect.height;
    if (edges.isRight) {
        width = startRect.width + deltaX;
    } else if (edges.isLeft) {
        width = startRect.width - deltaX;
    }
    if (edges.isBottom) {
        height = startRect.height + deltaY;
    } else if (edges.isTop) {
        height = startRect.height - deltaY;
    }

    const size = getConstrainedSize(width, height, options);
    let { left, top } = startRect;
    if (edges.isLeft) {
        left = right - size.width;
    }
    if (edges.isTop) {
        top = bottom - size.height;
    }

    return clampWidgetRect({ left, top, ...size }, options);
}

export function getInitialWidgetRect(options: FloatingWidgetOptions) {
    const size = getConstrainedSize(
        options.width ?? DEFAULT_WIDTH,
        options.height ?? DEFAULT_HEIGHT,
        options,
    );
    const viewportSize = getViewportSize();
    const initialOffset = options.initialOffset ?? 0;

    return clampWidgetRect(
        {
            left: viewportSize.width - size.width - 24 - initialOffset,
            top: 64 + initialOffset,
            ...size,
        },
        options,
    );
}

// Persisted rect lets a widget come back at the size/location the user last
// left it. Kept as a tiny JSON blob in the shared setting store; written only
// once per drag/resize gesture (on pointer-up), never on every pointer move.
export function readPersistedRect(persistKey: string): WidgetRect | null {
    const raw = getSetting(persistKey);
    if (!raw) {
        return null;
    }
    try {
        const parsed = JSON.parse(raw);
        const values = [
            parsed?.left,
            parsed?.top,
            parsed?.width,
            parsed?.height,
        ];
        if (
            values.every(
                (value) => typeof value === 'number' && Number.isFinite(value),
            )
        ) {
            return {
                left: parsed.left,
                top: parsed.top,
                width: parsed.width,
                height: parsed.height,
            };
        }
    } catch {
        // Ignore a malformed persisted value and fall back to defaults.
    }
    return null;
}

export function writePersistedRect(persistKey: string, rect: WidgetRect) {
    setSetting(persistKey, JSON.stringify(rect));
}

export function isIgnored(target: Element | null) {
    if (target === null || target.classList.contains('floating-widget')) {
        return false;
    }
    if (PARENT_IGNORE_SELECTORS.some((selector) => target.closest(selector))) {
        return true;
    }
    return isIgnored(target.parentElement);
}

export function isBlankDragArea(target: Element) {
    return target.closest(NON_DRAGGABLE_SELECTOR) === null;
}

export function isOnScrollbar(
    clientX: number,
    clientY: number,
    target: Element,
) {
    const rect = target.getBoundingClientRect();
    const isOnVerticalBar = clientX - rect.left > target.clientWidth;
    const isOnHorizontalBar = clientY - rect.top > target.clientHeight;
    return isOnVerticalBar || isOnHorizontalBar;
}

// TODO: this is subject to not be used in the future in favor of performance
export function checkAreChildrenOnscreen(element: Node, type: MutationType) {
    // FIRST, and O(1): this runs from the app-wide `MutationObserver`
    // (`document.body`, `subtree` + `attributes`), so it is handed EVERY
    // attribute change in the window — hundreds per present on the presenter.
    // With no widget mounted there is nothing any of them can be inside of, and
    // the registry already knows that, so the `closest()` ancestor walk below
    // is skipped entirely for what is by far the common case.
    if (stackedWidgetListeners.length === 0) {
        return;
    }
    if (
        element instanceof HTMLElement === false ||
        element.classList.contains('floating-widget')
    ) {
        return;
    }
    if (!(type === 'attr-modified' || type === 'added')) {
        return;
    }
    const widgetElement = element.closest<HTMLElement>('.floating-widget');
    if (widgetElement === null) {
        return;
    }
    const hasOnscreenChild =
        widgetElement.querySelector('[data-screen-icon-id], .app-on-screen') !==
        null;
    const value = hasOnscreenChild ? 'true' : 'false';
    // Only on a real change: writing the attribute is itself an `attributes`
    // mutation, so an unconditional write turns every mutation inside a widget
    // into two records. (The echo is harmless — it lands on `.floating-widget`
    // and exits at the guard above — but it is still work.)
    if (widgetElement.dataset.hasOnscreenChild !== value) {
        widgetElement.dataset.hasOnscreenChild = value;
    }
}
