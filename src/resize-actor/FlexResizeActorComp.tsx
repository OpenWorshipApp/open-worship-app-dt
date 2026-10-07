import './FlexResizeActorComp.scss';

import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import { Component, createRef } from 'react';

import type { DisabledType, CloseType } from './flexSizeHelpers';

export const HIDDEN_WIDGET_CLASS = 'app-hidden-widget';
export const ACTIVE_HIDDEN_WIDGET_CLASS = `active-${HIDDEN_WIDGET_CLASS}`;
function checkIsActiveHiddenWidgetNode(node: HTMLDivElement) {
    return node.classList.contains(ACTIVE_HIDDEN_WIDGET_CLASS);
}

import imageUp from './images/up.png';
import imageDown from './images/down.png';
import imageLeft from './images/left.png';
import imageRight from './images/right.png';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import {
    type ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { tran } from '../lang/langHelpers';
import { checkMediaPlaying } from '../helper/mediaControlHelpers';

const CloseTypeListLeft: CloseType[] = ['left', 'up'] as const;
const ICON_MAP: Record<'h' | 'v', [CloseType, string, string][]> = {
    h: [
        ['left', imageLeft, '0 5px 0 0'],
        ['right', imageRight, '0 0 0 5px'],
    ],
    v: [
        ['up', imageUp, '0 0 5px 0'],
        ['down', imageDown, '5px 0 0 0'],
    ],
};

// What an arrow on the divider does, in words: it collapses the panel on that
// side (the menu's Close First / Second Widget). It used to say "Disable left",
// in English in every language. Deliberately NOT the menu's own words, so the
// app's tools do not find a hover-only arrow where a walkthrough means the menu
// item. Literal keys, so `tranKeyCoverage.test.ts` can check each one.
function genCollapseTitle(direction: CloseType) {
    if (direction === 'left') {
        return tran('Collapse left panel');
    }
    if (direction === 'right') {
        return tran('Collapse right panel');
    }
    if (direction === 'up') {
        return tran('Collapse top panel');
    }
    return tran('Collapse bottom panel');
}

type PointerLikeEvent = MouseEvent | TouchEvent;

// How far one arrow press moves the divider, and with Shift held.
export const KEYBOARD_RESIZE_STEP = 20;
export const KEYBOARD_RESIZE_BIG_STEP = 100;

/**
 * The step an arrow key moves the divider by, signed toward the SECOND pane
 * (right, down), or null for any other key. A divider between left and right
 * panes answers Left/Right, one between top and bottom answers Up/Down; the
 * other pair is left alone so it still scrolls whatever has the keyboard.
 */
export function toKeyboardResizeStep(
    type: ResizeKindType,
    key: string,
    isShiftKey: boolean,
) {
    const [backKey, forwardKey] =
        type === 'v' ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
    const step = isShiftKey ? KEYBOARD_RESIZE_BIG_STEP : KEYBOARD_RESIZE_STEP;
    if (key === backKey) {
        return -step;
    }
    if (key === forwardKey) {
        return step;
    }
    return null;
}

/**
 * How far a keyboard step may really go: never past either pane's minimum, so
 * the keyboard resizes and never collapses -- collapsing is the divider's menu,
 * Close First / Second Widget, which says so in words.
 */
export function clampKeyboardResizeStep({
    step,
    preSize,
    nextSize,
    preMinSize,
    nextMinSize,
}: {
    step: number;
    preSize: number;
    nextSize: number;
    preMinSize: number;
    nextMinSize: number;
}) {
    if (step < 0) {
        return Math.min(0, Math.max(step, preMinSize - preSize));
    }
    return Math.max(0, Math.min(step, nextSize - nextMinSize));
}

export type ResizeKindType = 'v' | 'h';
export interface Props {
    type: ResizeKindType;
    isDisableQuickResize: boolean;
    checkSize: () => void;
    disableWidget: (dataFlexSizeKey: string, target: DisabledType) => void;
    checkCanClose: () => CloseType | null;
}
export default class FlexResizeActorComp extends Component<Props, object> {
    myRef: RefObject<HTMLDivElement | null>;
    lastPos: number = 0;
    previousMinSize: number = 0;
    nextMinSize: number = 0;
    preSize: number = 0;
    nextSize: number = 0;
    previousGrow: number = 0;
    nextGrow: number = 0;
    sumGrow: number = 0;
    sumSize: number = 0;
    mouseMoveListener: (event: MouseEvent) => void;
    mouseUpListener: (event: MouseEvent) => void;
    touchMoveListener: (event: TouchEvent) => void;
    touchEndListener: (event: TouchEvent) => void;
    attemptTimeout: (func: () => void, isImmediate?: boolean) => void;
    // The size is SAVED once the keys stop: a held arrow repeats ~30 times a
    // second, and every save writes the layout setting.
    keyboardSavingAttempt: (func: () => void, isImmediate?: boolean) => void;

    constructor(props: Props) {
        super(props);
        this.myRef = createRef();
        this.mouseMoveListener = (event: MouseEvent) => {
            this.onMouseMove(event);
        };
        this.mouseUpListener = (event) => {
            this.onMouseUp(event);
        };
        this.touchMoveListener = (event: TouchEvent) => {
            this.onMouseMove(event);
        };
        this.touchEndListener = (event: TouchEvent) => {
            this.onMouseUp(event);
        };
        this.attemptTimeout = genTimeoutAttempt(100);
        this.keyboardSavingAttempt = genTimeoutAttempt(300);
    }

    private get currentNode() {
        if (this.myRef.current === null) {
            throw new Error('currentNode is null');
        }
        return this.myRef.current;
    }

    private getSiblingFromNode(node: HTMLDivElement, isNext: boolean) {
        if (isNext) {
            return node.nextElementSibling as HTMLDivElement;
        }
        return node.previousElementSibling as HTMLDivElement;
    }

    private getSibling(isNext: boolean) {
        let node = this.getSiblingFromNode(this.currentNode, isNext);
        while (checkIsActiveHiddenWidgetNode(node)) {
            node = this.getSiblingFromNode(node, isNext);
        }
        return node;
    }

    get preNode() {
        return this.getSibling(false);
    }

    get nextNode() {
        return this.getSibling(true);
    }

    get isVertical() {
        return this.props.type === 'v';
    }

    getMousePagePos(event: PointerLikeEvent) {
        const point = 'touches' in event ? event.touches[0] : event;
        return this.isVertical ? point.pageY : point.pageX;
    }

    getOffsetSize(div: HTMLDivElement) {
        return this.isVertical ? div.offsetHeight : div.offsetWidth;
    }

    // `.mover` is `position: fixed`, which places it against the VIEWPORT only
    // while no ancestor has a transform, filter or backdrop-filter. A floating
    // widget's backdrop blur makes the widget its containing block, so the
    // cursor's viewport coordinate drew the arrows a widget's offset away from
    // the cursor. The origin is measured once per hover (one write, one read)
    // and reused for every move after it.
    moverOrigin: number | null = null;

    placeMover(clientPos: number) {
        const mover = this.currentNode.querySelector(
            '.mover',
        ) as HTMLDivElement;
        const side = this.isVertical ? 'left' : 'top';
        if (this.moverOrigin === null) {
            mover.style[side] = '0px';
            const rect = mover.getBoundingClientRect();
            // The stylesheet's translate(-45%, -45%) moves the box by part of
            // its own size, which is not part of the containing block's place.
            this.moverOrigin = this.isVertical
                ? rect.left + rect.width * 0.45
                : rect.top + rect.height * 0.45;
        }
        mover.style[side] = `${clientPos - this.moverOrigin}px`;
    }

    setActive() {
        this.currentNode.classList.add('active');
        this.preNode.style.pointerEvents = 'none';
        this.nextNode.style.pointerEvents = 'none';
    }

    setInactive() {
        this.currentNode.classList.remove('active');
        this.preNode.style.pointerEvents = 'auto';
        this.nextNode.style.pointerEvents = 'auto';
    }

    init() {
        if (!this.currentNode) {
            return;
        }
        const prev = this.preNode;
        const next = this.nextNode;
        if (!prev || !next) {
            return;
        }
        this.setActive();

        this.previousMinSize = Number.parseInt(
            this.preNode.dataset['minSize'] ?? '',
        );
        this.nextMinSize = Number.parseInt(
            this.nextNode.dataset['minSize'] ?? '',
        );
        this.preSize = this.getOffsetSize(prev);
        this.nextSize = this.getOffsetSize(next);
        this.sumSize = this.preSize + this.nextSize;
        this.previousGrow = Number(prev.style.flexGrow);
        this.nextGrow = Number(next.style.flexGrow);
        this.sumGrow = this.previousGrow + this.nextGrow;
    }

    isShouldIgnore(event: PointerLikeEvent) {
        const target = event.target as HTMLElement;
        return (
            target.tagName === 'I' ||
            target.classList.contains('disabling-arrow')
        );
    }

    onMouseDown(event: PointerLikeEvent) {
        if (this.isShouldIgnore(event)) {
            return;
        }
        event.preventDefault();
        this.init();
        this.lastPos = this.getMousePagePos(event);
        globalThis.addEventListener('mousemove', this.mouseMoveListener);
        globalThis.addEventListener('mouseup', this.mouseUpListener);
        globalThis.addEventListener('touchmove', this.touchMoveListener, {
            passive: false,
        });
        globalThis.addEventListener('touchend', this.touchEndListener);
        globalThis.addEventListener('touchcancel', this.touchEndListener);
    }

    get isPreReachMinSize() {
        return this.preSize <= this.previousMinSize;
    }

    get isNextReachMinSize() {
        return this.nextSize <= this.nextMinSize;
    }

    onMouseMove(event: PointerLikeEvent) {
        if (this.isShouldIgnore(event)) {
            return;
        }
        if ('touches' in event) {
            event.preventDefault();
        }
        let pos = this.getMousePagePos(event);
        const posDiff = pos - this.lastPos;
        if (
            this.props.isDisableQuickResize &&
            ((posDiff < 0 && this.isPreReachMinSize) ||
                (posDiff > 0 && this.isNextReachMinSize))
        ) {
            return;
        }
        this.preSize += posDiff;
        this.nextSize -= posDiff;
        if (this.preSize < 0) {
            this.nextSize += this.preSize;
            pos -= this.preSize;
            this.preSize = 0;
        }
        if (this.nextSize < 0) {
            this.preSize += this.nextSize;
            pos += this.nextSize;
            this.nextSize = 0;
        }

        if (this.isPreReachMinSize) {
            this.addHiddenWidgetClassName(this.preNode);
        } else {
            this.removeHiddenWidgetClassname(this.preNode);
        }
        if (this.isNextReachMinSize) {
            const hiddenAdded = this.addHiddenWidgetClassName(this.nextNode);
            if (!hiddenAdded) {
                return;
            }
        } else {
            this.removeHiddenWidgetClassname(this.nextNode);
        }
        const prevGrowNew = this.sumGrow * (this.preSize / this.sumSize);
        const nextGrowNew = this.sumGrow * (this.nextSize / this.sumSize);

        this.preNode.style.flexGrow = `${prevGrowNew}`;
        this.nextNode.style.flexGrow = `${nextGrowNew}`;

        this.lastPos = pos;
    }

    addHiddenWidgetClassName(divElement: HTMLDivElement) {
        // Runs on every pointer move while dragging, so guard silently — the
        // panel visibly resists collapsing; the discrete close() path toasts.
        const isPlaying = checkMediaPlaying({
            targetElement: divElement,
            withMessage: false,
            includeYouTube: true,
        });
        if (isPlaying) {
            return false;
        }
        if (this.props.isDisableQuickResize) {
            return false;
        }
        divElement.classList.add(HIDDEN_WIDGET_CLASS);
        return true;
    }

    removeHiddenWidgetClassname(divElement: HTMLDivElement) {
        divElement.classList.remove(HIDDEN_WIDGET_CLASS);
    }

    onMouseUp(event: PointerLikeEvent) {
        if (this.isShouldIgnore(event)) {
            return;
        }
        if (!this.currentNode) {
            return;
        }
        globalThis.removeEventListener('mousemove', this.mouseMoveListener);
        globalThis.removeEventListener('mouseup', this.mouseUpListener);
        globalThis.removeEventListener('touchmove', this.touchMoveListener);
        globalThis.removeEventListener('touchend', this.touchEndListener);
        globalThis.removeEventListener('touchcancel', this.touchEndListener);

        this.setInactive();
        if (this.preNode.classList.contains(HIDDEN_WIDGET_CLASS)) {
            this.close('left');
            return;
        }
        if (this.nextNode.classList.contains(HIDDEN_WIDGET_CLASS)) {
            this.close('right');
            return;
        }
        this.props.checkSize();
    }

    close(closeType: CloseType) {
        const isFirst = CloseTypeListLeft.includes(closeType);
        const isPlaying = checkMediaPlaying({
            targetElement: isFirst ? this.preNode : this.nextNode,
            includeYouTube: true,
        });
        if (isPlaying) {
            return;
        }
        this.init();
        const dataFlexSizeKey = isFirst
            ? this.preNode.dataset['fs']
            : this.nextNode.dataset['fs'];
        if (dataFlexSizeKey !== undefined) {
            if (isFirst) {
                this.nextNode.style.flexGrow = `${this.sumGrow}`;
            } else {
                this.preNode.style.flexGrow = `${this.sumGrow}`;
            }
            this.props.disableWidget(dataFlexSizeKey, [
                isFirst ? 'first' : 'second',
                isFirst ? this.previousGrow : this.nextGrow,
            ]);
        }
        this.setInactive();
    }

    resetSize() {
        const prevDefault = this.preNode.dataset['fsDefault'] ?? '1';
        const nextDefault = this.nextNode.dataset['fsDefault'] ?? '1';
        this.preNode.style.flexGrow = '';
        this.preNode.style.flex = prevDefault;
        this.nextNode.style.flexGrow = '';
        this.nextNode.style.flex = nextDefault;
        this.props.checkSize();
    }

    // The divider is a window splitter for a keyboard too (the WAI-ARIA
    // pattern): it takes focus, an arrow moves it, and the context-menu key or
    // Shift+F10 opens the same Reset Size / Close First / Close Second Widget
    // menu a right-click does -- Chromium sends those keys to the focused
    // element as a `contextmenu` event, which `onContextMenu` already
    // answers. Before, it took no focus at all, so the only way to collapse a
    // panel opened by mistake was a mouse.
    resizeByKeyboard(step: number) {
        if (this.myRef.current === null) {
            return;
        }
        this.init();
        this.setInactive();
        const posDiff = clampKeyboardResizeStep({
            step,
            preSize: this.preSize,
            nextSize: this.nextSize,
            preMinSize: Number.isNaN(this.previousMinSize)
                ? 0
                : this.previousMinSize,
            nextMinSize: Number.isNaN(this.nextMinSize) ? 0 : this.nextMinSize,
        });
        if (posDiff === 0 || this.sumSize <= 0) {
            return;
        }
        this.preSize += posDiff;
        this.nextSize -= posDiff;
        this.preNode.style.flexGrow = `${
            this.sumGrow * (this.preSize / this.sumSize)
        }`;
        this.nextNode.style.flexGrow = `${
            this.sumGrow * (this.nextSize / this.sumSize)
        }`;
        this.stampValueNow();
        this.keyboardSavingAttempt(() => {
            this.props.checkSize();
        });
    }

    handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
        if (event.target !== event.currentTarget) {
            return;
        }
        const step = toKeyboardResizeStep(
            this.props.type,
            event.key,
            event.shiftKey,
        );
        if (step === null || event.ctrlKey || event.altKey || event.metaKey) {
            return;
        }
        // Kept from the page's own shortcuts: an arrow on a focused divider
        // is a resize, not the next slide.
        event.preventDefault();
        event.stopPropagation();
        this.resizeByKeyboard(step);
    }

    // A focusable separator says where it sits, as a share of the two panes:
    // 0 is all the second pane, 100 all the first.
    stampValueNow() {
        const node = this.myRef.current;
        if (node === null) {
            return;
        }
        try {
            const preSize = this.getOffsetSize(this.preNode);
            const nextSize = this.getOffsetSize(this.nextNode);
            if (preSize + nextSize <= 0) {
                return;
            }
            node.setAttribute(
                'aria-valuenow',
                `${Math.round((100 * preSize) / (preSize + nextSize))}`,
            );
        } catch (error) {
            // A divider at the very edge has no neighbour to measure.
            console.warn(error);
        }
    }

    handleContextMenuOpening(event: any) {
        const menuItems: ContextMenuItemType[] = [
            {
                childBefore: genContextMenuItemIcon('aspect-ratio'),
                menuElement: tran('Reset Size'),
                onSelect: () => {
                    this.resetSize();
                },
            },
            {
                childBefore: genContextMenuItemIcon('x-square'),
                menuElement: tran('Close First Widget'),
                onSelect: () => {
                    this.close('left');
                },
            },
            {
                childBefore: genContextMenuItemIcon('x-square'),
                menuElement: tran('Close Second Widget'),
                onSelect: () => {
                    this.close('right');
                },
            },
        ];
        showAppContextMenu(event, menuItems);
    }

    // The divider between two panes had no name at all. The help chatbot's
    // control matcher (`owa_find_ui`, the walkthrough card) reads a name off
    // `title` / `aria-label` / `data-widget-name`, so a step about this
    // divider's right-click menu -- Reset Size, Close First Widget, Close
    // Second Widget -- had nothing on screen to ring, and the View-menu
    // route it fell back on lives in the native menu bar, which no card can
    // press. Named after its neighbours' ENGLISH widget names, the same
    // `data-widget-name` the panes carry open or collapsed, so it answers to
    // the words a recipe writes whatever language the app is displaying (a
    // screen reader gets the same name). Read once, at mount: a pane and its
    // collapsed strip swap places beside the divider but keep the name.
    private stampAccessibleName() {
        const node = this.myRef.current;
        if (node === null) {
            return;
        }
        node.setAttribute('role', 'separator');
        node.setAttribute(
            'aria-orientation',
            this.isVertical ? 'horizontal' : 'vertical',
        );
        // Focusable, so it is a window splitter, which carries a value.
        node.setAttribute('aria-valuemin', '0');
        node.setAttribute('aria-valuemax', '100');
        // Not the `preNode`/`nextNode` getters: those step OVER a collapsed
        // strip (and throw on the edge of the container), where the strip
        // is exactly the neighbour wanted here -- it carries the same name
        // as the pane it stands for.
        const nameBeside = (isNext: boolean) => {
            let sibling = isNext
                ? node.nextElementSibling
                : node.previousElementSibling;
            while (sibling !== null) {
                const name = (sibling as HTMLElement).dataset['widgetName'];
                if (name !== undefined) {
                    return name;
                }
                sibling = isNext
                    ? sibling.nextElementSibling
                    : sibling.previousElementSibling;
            }
            return undefined;
        };
        const preName = nameBeside(false);
        const nextName = nameBeside(true);
        if (preName === undefined || nextName === undefined) {
            return;
        }
        node.setAttribute(
            'aria-label',
            `Divider between ${preName} and ${nextName}`,
        );
    }

    componentDidMount() {
        const target = this.currentNode;
        this.stampAccessibleName();
        target.addEventListener('mousedown', (event) => {
            if (event.button === 2) {
                return;
            }
            this.onMouseDown(event);
        });
        target.addEventListener(
            'touchstart',
            (event) => {
                this.onMouseDown(event);
            },
            { passive: false },
        );
        const closeType = this.props.checkCanClose();
        if (closeType !== null) {
            this.close(closeType);
        }
    }

    render() {
        const props = this.props;
        const type = this.props.type;
        const moverChildren = props.isDisableQuickResize
            ? null
            : ICON_MAP[type].map(([direction, src, margin]) => {
                  const title = genCollapseTitle(direction);
                  return (
                      <img
                          key={direction}
                          alt={title}
                          src={src}
                          title={title}
                          className="disabling-arrow"
                          style={{ margin }}
                          onClick={(event) => {
                              event.stopPropagation();
                              this.close(direction);
                          }}
                      />
                  );
              });
        return (
            <div
                className={`flex-resize-actor ${props.type}`}
                onMouseEnter={() => {
                    this.attemptTimeout(() => {
                        this.currentNode.classList.add('attempt');
                    });
                }}
                onMouseLeave={() => {
                    this.moverOrigin = null;
                    this.attemptTimeout(() => {
                        this.currentNode.classList.remove('attempt');
                    }, true);
                }}
                onMouseMove={(event) => {
                    if (event.target !== this.currentNode) {
                        return;
                    }
                    this.placeMover(
                        this.isVertical ? event.clientX : event.clientY,
                    );
                }}
                onDoubleClick={this.resetSize.bind(this)}
                onContextMenu={this.handleContextMenuOpening.bind(this)}
                tabIndex={0}
                onKeyDown={this.handleKeyDown.bind(this)}
                onFocus={this.stampValueNow.bind(this)}
                ref={this.myRef}
            >
                <div
                    className={`mover d-flex ${type === 'v' ? 'flex-column' : ''}`}
                >
                    {moverChildren}
                </div>
            </div>
        );
    }
}
