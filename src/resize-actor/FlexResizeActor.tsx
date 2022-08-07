import './FlexResizeActor.scss';

import React from 'react';
import { DisabledType } from './flexSizeHelpers';

export type ResizeKindType = 'v' | 'h';
export interface Props {
    type: ResizeKindType,
    checkSize: () => void,
    disable: (dataFSizeKey: string,
        target: DisabledType) => void,
}
export default class FlexResizeActor extends React.Component<Props, {}> {
    myRef: React.RefObject<HTMLDivElement>;
    lastPos: number = 0;
    previousMinSize: number = 0;
    nextMinSize: number = 0;
    previousSize: number = 0;
    nextSize: number = 0;
    previousGrow: number = 0;
    nextGrow: number = 0;
    sumGrow: number = 0;
    sumSize: number = 0;
    mouseMoveListener: (mm: MouseEvent) => void;
    mouseUpListener: (mm: MouseEvent) => void;
    constructor(props: Props) {
        super(props);
        this.myRef = React.createRef();
        this.mouseMoveListener = (mm: MouseEvent) => this.onMouseMove(mm);
        this.mouseUpListener = (e) => this.onMouseUp(e);
    }
    get previous() {
        return this.myRef.current?.previousElementSibling as HTMLDivElement;
    }
    get next() {
        return this.myRef.current?.nextElementSibling as HTMLDivElement;
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
    init() {
        const current = this.myRef.current;
        if (!current) {
            return;
        }
        const prev = current.previousElementSibling as HTMLDivElement;
        const next = current.nextElementSibling as HTMLDivElement;
        if (!prev || !next) {
            return;
        }
        current.classList.add('active');

        this.previousMinSize = +(this.previous.dataset['minSize'] || '');
        this.nextMinSize = +(this.next.dataset['minSize'] || '');
        this.previousSize = this.getOffsetSize(prev);
        this.nextSize = this.getOffsetSize(next);
        this.sumSize = this.previousSize + this.nextSize;
        this.previousGrow = Number(prev.style.flexGrow);
        this.nextGrow = Number(next.style.flexGrow);
        this.sumGrow = this.previousGrow + this.nextGrow;
    }
    isShouldIgnore(md: MouseEvent) {
        return (md.target as any).tagName === 'I';
    }
    onMouseDown(e: MouseEvent) {
        if (this.isShouldIgnore(e)) {
            return;
        }
        e.preventDefault();
        this.init();
        this.lastPos = this.getMousePagePos(e);
        window.addEventListener('mousemove', this.mouseMoveListener);
        window.addEventListener('mouseup', this.mouseUpListener);
    }
    onMouseMove(e: MouseEvent) {
        if (this.isShouldIgnore(e)) {
            return;
        }
        let pos = this.getMousePagePos(e);
        const d = pos - this.lastPos;
        this.previousSize += d;
        this.nextSize -= d;
        if (this.previousSize < 0) {
            this.nextSize += this.previousSize;
            pos -= this.previousSize;
            this.previousSize = 0;
        }
        if (this.nextSize < 0) {
            this.previousSize += this.nextSize;
            pos += this.nextSize;
            this.nextSize = 0;
        }

        if (this.previousSize < this.previousMinSize) {
            this.previous.classList.add('sizing-hide');
        } else {
            this.previous.classList.remove('sizing-hide');
        }
        if (this.nextSize < this.nextMinSize) {
            this.next.classList.add('sizing-hide');
        } else {
            this.next.classList.remove('sizing-hide');
        }
        const prevGrowNew = this.sumGrow * (this.previousSize / this.sumSize);
        const nextGrowNew = this.sumGrow * (this.nextSize / this.sumSize);

        this.previous.style.flexGrow = `${prevGrowNew}`;
        this.next.style.flexGrow = `${nextGrowNew}`;

        this.lastPos = pos;
    }
    onMouseUp(e: MouseEvent) {
        if (this.isShouldIgnore(e)) {
            return;
        }
        const current = this.myRef.current;
        if (!current) {
            return;
        }
        window.removeEventListener('mousemove', this.mouseMoveListener);
        window.removeEventListener('mouseup', this.mouseUpListener);

        current.classList.remove('active');
        if (this.previous.classList.contains('sizing-hide')) {
            this.quicMove('left');
            return;
        }
        if (this.next.classList.contains('sizing-hide')) {
            this.quicMove('right');
            return;
        }
        this.props.checkSize();
    }
    quicMove(type: string) {
        this.init();
        const isFirst = ['left', 'up'].includes(type);
        const dataFSizeKey = isFirst ? this.previous.dataset['fs'] : this.next.dataset['fs'];
        if (dataFSizeKey !== undefined) {
            if (isFirst) {
                this.next.style.flexGrow = `${this.sumGrow}`;
            } else {
                this.previous.style.flexGrow = `${this.sumGrow}`;
            }
            this.props.disable(dataFSizeKey, [
                isFirst ? 'first' : 'second',
                isFirst ? this.previousGrow : this.nextGrow,
            ]);
        }
        this.myRef.current?.classList.remove('active');
    }
    componentDidMount() {
        const target = this.myRef.current;
        if (target) {
            target.addEventListener('mousedown', (md) => {
                this.onMouseDown(md);
            });
        }
    }
    render() {
        return (
            <div className={`flex-resize-actor ${this.props.type}`}
                ref={this.myRef}>
                <div className='mover'>
                    {[
                        ['left', 'chevron-left'],
                        ['right', 'chevron-right'],
                        ['up', 'chevron-up'],
                        ['down', 'chevron-down'],
                    ].map(([type, icon], i) => {
                        return (
                            <i key={i} title={`Disable ${type}`}
                                className={`${type} bi bi-${icon}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    this.quicMove(type);
                                }} />
                        );
                    })}
                </div>
            </div>
        );
    }
}
