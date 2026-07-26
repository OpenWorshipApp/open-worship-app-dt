// Touch support for the app's HTML5 drag & drop.
//
// Chromium fires no drag events for touch input, so every `draggable` element
// (slides, bible items, backgrounds, colors, foreground widgets) is dead on a
// touchscreen. This shim turns a long-press-then-move gesture into real
// `DragEvent`s carrying one shared `DataTransfer`, so all existing
// `onDragStart` / `onDragOver` / `onDrop` handlers keep working unchanged.
//
// Cost when idle is a single passive `touchstart` listener; the non-passive
// `touchmove` listener (the one that blocks scroll optimization) is attached
// only once the press has been held still long enough to mean "drag".

// Held-still delay before a press counts as a drag intent. Kept below
// Chromium's ~500ms touch context-menu gesture so a press that never moves
// still opens the context menu.
const LONG_PRESS_DELAY_MS = 300;
// Moving further than this before the delay elapses means "scroll", not "drag".
const PRE_ARM_MOVE_TOLERANCE_PX = 10;
// Movement after arming that actually starts the drag.
const ARMED_DRAG_THRESHOLD_PX = 6;
const AUTO_SCROLL_EDGE_PX = 48;
const AUTO_SCROLL_STEP_PX = 14;
const GHOST_CURSOR_OFFSET_PX = 14;
const GHOST_LABEL_MAX_LENGTH = 60;
const SCROLLABLE_OVERFLOW_REGEX = /auto|scroll|overlay/;
const NON_DRAGGING_SELECTOR =
    'input, textarea, select, a[href], .monaco-editor,' +
    ' [contenteditable]:not([contenteditable="false"])';

type TouchDragStateType = {
    touchIdentifier: number;
    sourceElement: HTMLElement;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    armTimeoutId: ReturnType<typeof setTimeout> | null;
    isArmed: boolean;
    isDragging: boolean;
    dataTransfer: DataTransfer | null;
    ghostElement: HTMLElement | null;
    overElement: Element | null;
    isDropAllowed: boolean;
    animationFrameId: number | null;
    scrollContainer: HTMLElement | null;
};

let touchDragState: TouchDragStateType | null = null;

function checkIsDragEventSupported() {
    return (
        typeof DragEvent !== 'undefined' && typeof DataTransfer !== 'undefined'
    );
}

function findDraggableElement(target: EventTarget | null) {
    if (target instanceof Element === false) {
        return null;
    }
    if (target.closest(NON_DRAGGING_SELECTOR) !== null) {
        return null;
    }
    const draggableElement = target.closest('[draggable="true"]');
    return draggableElement instanceof HTMLElement ? draggableElement : null;
}

function findTouch(event: TouchEvent, touchIdentifier: number) {
    for (const touch of Array.from(event.touches)) {
        if (touch.identifier === touchIdentifier) {
            return touch;
        }
    }
    return null;
}

function dispatchDragEvent(
    type: string,
    element: Element,
    { dataTransfer, currentX, currentY }: TouchDragStateType,
) {
    const dragEvent = new DragEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        dataTransfer,
        clientX: currentX,
        clientY: currentY,
    });
    element.dispatchEvent(dragEvent);
    return dragEvent;
}

function toGhostLabel(sourceElement: HTMLElement) {
    // An item can name itself with `data-touch-drag-label`; the card header
    // and the item text are only fallbacks, and can read as noise.
    const headerElement = sourceElement.querySelector('.card-header');
    const text = (
        sourceElement.dataset.touchDragLabel ??
        (headerElement ?? sourceElement).textContent ??
        ''
    ).trim();
    if (text.length === 0) {
        return sourceElement.title.trim() || '⠿';
    }
    if (text.length > GHOST_LABEL_MAX_LENGTH) {
        return `${text.slice(0, GHOST_LABEL_MAX_LENGTH)}…`;
    }
    return text;
}

function createGhostElement(sourceElement: HTMLElement) {
    const ghostElement = document.createElement('div');
    ghostElement.className = 'app-touch-drag-ghost';
    ghostElement.textContent = toGhostLabel(sourceElement);
    Object.assign(ghostElement.style, {
        position: 'fixed',
        top: '0px',
        left: '0px',
        zIndex: '10000',
        pointerEvents: 'none',
        maxWidth: '220px',
        padding: '4px 10px',
        borderRadius: '6px',
        border: '1px solid var(--bs-info, #0dcaf0)',
        backgroundColor: 'var(--bs-body-bg, #212529)',
        color: 'var(--bs-body-color, #ffffff)',
        opacity: '0.9',
        fontSize: '12px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
        willChange: 'transform',
    });
    // The theme's CSS variables live on `#app`, not on `body`.
    const rootElement = document.getElementById('app') ?? document.body;
    rootElement.appendChild(ghostElement);
    return ghostElement;
}

function findScrollContainer(sourceElement: HTMLElement) {
    const selector = sourceElement.dataset.scrollContainerSelector;
    if (selector) {
        const container = document.querySelector(selector);
        if (container instanceof HTMLElement) {
            return container;
        }
    }
    // Resolved once per drag on purpose: `getComputedStyle` in the per-frame
    // loop would be the most expensive thing in the whole gesture.
    let element: HTMLElement | null = sourceElement.parentElement;
    while (element !== null) {
        const { overflowY, overflowX } = getComputedStyle(element);
        if (
            (SCROLLABLE_OVERFLOW_REGEX.test(overflowY) &&
                element.scrollHeight > element.clientHeight) ||
            (SCROLLABLE_OVERFLOW_REGEX.test(overflowX) &&
                element.scrollWidth > element.clientWidth)
        ) {
            return element;
        }
        element = element.parentElement;
    }
    return null;
}

function autoScroll(state: TouchDragStateType) {
    const container = state.scrollContainer;
    if (container === null) {
        return;
    }
    const { currentX, currentY } = state;
    const rect = container.getBoundingClientRect();
    if (container.scrollHeight > container.clientHeight) {
        if (currentY < rect.top + AUTO_SCROLL_EDGE_PX) {
            container.scrollTop -= AUTO_SCROLL_STEP_PX;
        } else if (currentY > rect.bottom - AUTO_SCROLL_EDGE_PX) {
            container.scrollTop += AUTO_SCROLL_STEP_PX;
        }
    }
    if (container.scrollWidth > container.clientWidth) {
        if (currentX < rect.left + AUTO_SCROLL_EDGE_PX) {
            container.scrollLeft -= AUTO_SCROLL_STEP_PX;
        } else if (currentX > rect.right - AUTO_SCROLL_EDGE_PX) {
            container.scrollLeft += AUTO_SCROLL_STEP_PX;
        }
    }
}

function updateDragTarget(state: TouchDragStateType) {
    const { currentX, currentY, ghostElement } = state;
    if (ghostElement !== null) {
        const x = currentX + GHOST_CURSOR_OFFSET_PX;
        const y = currentY + GHOST_CURSOR_OFFSET_PX;
        ghostElement.style.transform = `translate(${x}px, ${y}px)`;
    }
    // The ghost is `pointer-events: none`, so it never hides the drop target.
    const element = document.elementFromPoint(currentX, currentY);
    if (element !== state.overElement) {
        if (state.overElement !== null) {
            dispatchDragEvent('dragleave', state.overElement, state);
        }
        state.overElement = element;
        state.isDropAllowed = false;
        if (element !== null) {
            dispatchDragEvent('dragenter', element, state);
        }
    }
    if (element !== null) {
        const dragOverEvent = dispatchDragEvent('dragover', element, state);
        // Same contract as the native drag: only a `dragover` that was
        // `preventDefault`ed marks the element as a drop zone.
        state.isDropAllowed = dragOverEvent.defaultPrevented;
    }
    autoScroll(state);
}

function runDragFrame() {
    const state = touchDragState;
    if (state === null || !state.isDragging) {
        return;
    }
    state.animationFrameId = requestAnimationFrame(runDragFrame);
    updateDragTarget(state);
}

function suppressNextTapEvents() {
    // touchend synthesizes a click on the drop target; without this a slide
    // drop would also select/present whatever the finger was released over.
    const suppress = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
    };
    const options = { capture: true, once: true } as const;
    window.addEventListener('click', suppress, options);
    window.addEventListener('contextmenu', suppress, options);
    setTimeout(() => {
        window.removeEventListener('click', suppress, options);
        window.removeEventListener('contextmenu', suppress, options);
    }, 400);
}

function beginDrag(state: TouchDragStateType) {
    if (!checkIsDragEventSupported()) {
        return false;
    }
    const dataTransfer = new DataTransfer();
    dataTransfer.effectAllowed = 'all';
    dataTransfer.dropEffect = 'move';
    state.dataTransfer = dataTransfer;
    const dragStartEvent = dispatchDragEvent(
        'dragstart',
        state.sourceElement,
        state,
    );
    if (dragStartEvent.defaultPrevented) {
        state.dataTransfer = null;
        return false;
    }
    state.isDragging = true;
    state.ghostElement = createGhostElement(state.sourceElement);
    state.scrollContainer = findScrollContainer(state.sourceElement);
    state.animationFrameId = requestAnimationFrame(runDragFrame);
    updateDragTarget(state);
    return true;
}

function finishDrag(state: TouchDragStateType, shouldDrop: boolean) {
    if (state.animationFrameId !== null) {
        cancelAnimationFrame(state.animationFrameId);
        state.animationFrameId = null;
    }
    if (state.overElement !== null) {
        if (shouldDrop && state.isDropAllowed) {
            dispatchDragEvent('drop', state.overElement, state);
        } else {
            dispatchDragEvent('dragleave', state.overElement, state);
        }
    }
    dispatchDragEvent('dragend', state.sourceElement, state);
    state.ghostElement?.remove();
    state.ghostElement = null;
    state.overElement = null;
    state.dataTransfer = null;
    state.scrollContainer = null;
    suppressNextTapEvents();
}

function detachGestureListeners() {
    document.removeEventListener('touchmove', handlePreArmTouchMove);
    document.removeEventListener('touchmove', handleArmedTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
    document.removeEventListener('touchcancel', handleTouchCancel);
}

function resetGesture(shouldDrop: boolean) {
    const state = touchDragState;
    touchDragState = null;
    detachGestureListeners();
    if (state === null) {
        return;
    }
    if (state.armTimeoutId !== null) {
        clearTimeout(state.armTimeoutId);
        state.armTimeoutId = null;
    }
    if (state.isDragging) {
        finishDrag(state, shouldDrop);
    }
}

function armGesture() {
    const state = touchDragState;
    if (state === null) {
        return;
    }
    state.armTimeoutId = null;
    state.isArmed = true;
    // Swap the passive move listener for a non-passive one only now, so a
    // plain scroll gesture never pays for a blocking touchmove handler.
    document.removeEventListener('touchmove', handlePreArmTouchMove);
    document.addEventListener('touchmove', handleArmedTouchMove, {
        passive: false,
    });
}

function handlePreArmTouchMove(event: TouchEvent) {
    const state = touchDragState;
    if (state === null) {
        return;
    }
    const touch = findTouch(event, state.touchIdentifier);
    if (touch === null) {
        return;
    }
    const deltaX = touch.clientX - state.startX;
    const deltaY = touch.clientY - state.startY;
    if (Math.hypot(deltaX, deltaY) > PRE_ARM_MOVE_TOLERANCE_PX) {
        // Moved before the press was held long enough: this is a scroll.
        resetGesture(false);
    }
}

function handleArmedTouchMove(event: TouchEvent) {
    const state = touchDragState;
    if (state === null) {
        return;
    }
    const touch = findTouch(event, state.touchIdentifier);
    if (touch === null) {
        return;
    }
    state.currentX = touch.clientX;
    state.currentY = touch.clientY;
    if (!state.isDragging) {
        const deltaX = touch.clientX - state.startX;
        const deltaY = touch.clientY - state.startY;
        if (Math.hypot(deltaX, deltaY) < ARMED_DRAG_THRESHOLD_PX) {
            return;
        }
        if (!beginDrag(state)) {
            resetGesture(false);
            return;
        }
    }
    // Keep the page from scrolling underneath the drag.
    event.preventDefault();
}

function handleTouchEnd(event: TouchEvent) {
    const state = touchDragState;
    if (state === null) {
        return;
    }
    for (const touch of Array.from(event.changedTouches)) {
        if (touch.identifier !== state.touchIdentifier) {
            continue;
        }
        state.currentX = touch.clientX;
        state.currentY = touch.clientY;
        resetGesture(true);
        return;
    }
}

function handleTouchCancel() {
    resetGesture(false);
}

function handleTouchStart(event: TouchEvent) {
    if (touchDragState !== null) {
        // A second finger (pinch/zoom) always wins over a drag.
        resetGesture(false);
        return;
    }
    if (event.touches.length !== 1 || !checkIsDragEventSupported()) {
        return;
    }
    const sourceElement = findDraggableElement(event.target);
    if (sourceElement === null) {
        return;
    }
    const touch = event.touches[0];
    touchDragState = {
        touchIdentifier: touch.identifier,
        sourceElement,
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        currentY: touch.clientY,
        armTimeoutId: setTimeout(armGesture, LONG_PRESS_DELAY_MS),
        isArmed: false,
        isDragging: false,
        dataTransfer: null,
        ghostElement: null,
        overElement: null,
        isDropAllowed: false,
        animationFrameId: null,
        scrollContainer: null,
    };
    document.addEventListener('touchmove', handlePreArmTouchMove, {
        passive: true,
    });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchCancel);
}

export function initTouchDragAndDrop() {
    document.addEventListener('touchstart', handleTouchStart, {
        passive: true,
    });
    return () => {
        resetGesture(false);
        document.removeEventListener('touchstart', handleTouchStart);
    };
}
