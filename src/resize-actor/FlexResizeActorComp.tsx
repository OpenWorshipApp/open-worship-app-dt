import './FlexResizeActorComp.scss';

import { Component, RefObject, createRef } from 'react';

import { DisabledType } from './flexSizeHelpers';
import { genTimeoutAttempt } from '../helper/helpers';

export const HIDDEN_WIDGET_CLASS = 'hidden-widget';
export const ACTIVE_HIDDEN_WIDGET_CLASS = `active-${HIDDEN_WIDGET_CLASS}`;
function checkIsActiveHiddenWidgetNode(node: HTMLDivElement) {
    return node.classList.contains(ACTIVE_HIDDEN_WIDGET_CLASS);
}

import imageUp from './images/up.png';
import imageDown from './images/down.png';
import imageLeft from './images/left.png';
import imageRight from './images/right.png';

const ICON_MAP = {
    h: [
        ['left', imageLeft, '0 5px 0 0'],
        ['right', imageRight, '0 0 0 5px'],
    ],
    v: [
        ['up', imageUp, '0 0 5px 0'],
        ['down', imageDown, '5px 0 0 0'],
    ],
};

export type ResizeKindType = 'v' | 'h';
export interface Props {
    type: ResizeKindType;
    isDisableQuickResize: boolean;
    checkSize: () => void;
    disableWidget: (dataFlexSizeKey: string, target: DisabledType) => void;
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
    attemptTimeout: (func: () => void, isImmediate?: boolean) => void;
    constructor(props: Props) {
        super(props);
        this.myRef = createRef();
        this.mouseMoveListener = (event: MouseEvent) => {
            this.onMouseMove(event);
        };
        this.mouseUpListener = (event) => {
            this.onMouseUp(event);
        };
        this.attemptTimeout = genTimeoutAttempt(100);
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
    getMousePagePos(me: MouseEvent) {
        return this.isVertical ? me.pageY : me.pageX;
    }
    getOffsetSize(div: HTMLDivElement) {
        return this.isVertical ? div.offsetHeight : div.offsetWidth;
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

        this.previousMinSize = parseInt(this.preNode.dataset['minSize'] ?? '');
        this.nextMinSize = parseInt(this.nextNode.dataset['minSize'] ?? '');
        this.preSize = this.getOffsetSize(prev);
        this.nextSize = this.getOffsetSize(next);
        this.sumSize = this.preSize + this.nextSize;
        this.previousGrow = Number(prev.style.flexGrow);
        this.nextGrow = Number(next.style.flexGrow);
        this.sumGrow = this.previousGrow + this.nextGrow;
    }
    isShouldIgnore(md: MouseEvent) {
        return (md.target as any).tagName === 'I';
    }
    onMouseDown(event: MouseEvent) {
        if (this.isShouldIgnore(event)) {
            return;
        }
        event.preventDefault();
        this.init();
        this.lastPos = this.getMousePagePos(event);
        window.addEventListener('mousemove', this.mouseMoveListener);
        window.addEventListener('mouseup', this.mouseUpListener);
    }
    get isPreReachMinSize() {
        return this.preSize <= this.previousMinSize;
    }
    get isNextReachMinSize() {
        return this.nextSize <= this.nextMinSize;
    }
    onMouseMove(event: MouseEvent) {
        if (this.isShouldIgnore(event)) {
            return;
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
            this.addHiddenWidgetClassName(this.nextNode);
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
        if (this.props.isDisableQuickResize) {
            return;
        }
        divElement.classList.add(HIDDEN_WIDGET_CLASS);
    }
    removeHiddenWidgetClassname(divElement: HTMLDivElement) {
        divElement.classList.remove(HIDDEN_WIDGET_CLASS);
    }
    onMouseUp(event: MouseEvent) {
        if (this.isShouldIgnore(event)) {
            return;
        }
        if (!this.currentNode) {
            return;
        }
        window.removeEventListener('mousemove', this.mouseMoveListener);
        window.removeEventListener('mouseup', this.mouseUpListener);

        this.setInactive();
        if (this.preNode.classList.contains(HIDDEN_WIDGET_CLASS)) {
            this.quicMove('left');
            return;
        }
        if (this.nextNode.classList.contains(HIDDEN_WIDGET_CLASS)) {
            this.quicMove('right');
            return;
        }
        this.props.checkSize();
    }
    quicMove(type: string) {
        this.init();
        const isFirst = ['left', 'up'].includes(type);
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
    componentDidMount() {
        const target = this.currentNode;
        if (target) {
            target.addEventListener('mousedown', (md) => {
                this.onMouseDown(md);
            });
        }
    }
    render() {
        const props = this.props;
        const type = this.props.type;
        const moverChildren = props.isDisableQuickResize
            ? null
            : ICON_MAP[type].map(([direction, src, margin]) => {
                  return (
                      <img
                          key={direction}
                          alt={`Disable ${direction}`}
                          src={src}
                          title={`Disable ${direction}`}
                          className="disabling-arrow"
                          style={{ margin }}
                          onClick={(event) => {
                              event.stopPropagation();
                              this.quicMove(direction);
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
                    this.attemptTimeout(() => {
                        this.currentNode.classList.remove('attempt');
                    }, true);
                }}
                onMouseMove={(event) => {
                    if (event.target !== this.currentNode) {
                        return;
                    }
                    const mover = this.currentNode.querySelector(
                        '.mover',
                    ) as HTMLDivElement;
                    if (type === 'v') {
                        mover.style.left = `${event.pageX}px`;
                    } else if (type === 'h') {
                        mover.style.top = `${event.pageY}px`;
                    }
                }}
                onDoubleClick={() => {
                    const prevDefault =
                        this.preNode.dataset['fsDefault'] ?? '1';
                    const nextDefault =
                        this.nextNode.dataset['fsDefault'] ?? '1';
                    this.preNode.style.flexGrow = '';
                    this.preNode.style.flex = prevDefault;
                    this.nextNode.style.flexGrow = '';
                    this.nextNode.style.flex = nextDefault;
                    props.checkSize();
                }}
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
