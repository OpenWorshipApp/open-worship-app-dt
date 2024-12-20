import { getRotationDeg, removePX } from '../helper/helpers';

type ResizeType = {
    left: boolean, top: boolean, xResize: boolean, yResize: boolean,
};
type BoxInfoType = {
    top: number,
    left: number,
    width: number,
    height: number,
    rotate: number,
}
type ListenedEvent = {
    eventName: 'mousedown', target: HTMLDivElement,
    listener: (event: MouseEvent) => void,
};

type CalcBoxPropsType = {
    left: boolean, top: boolean, xResize: boolean, yResize: boolean,
    cosFraction: number, sinFraction: number, initW: number, initH: number,
    boxProps: BoxEditorController, mEvent: MouseEvent,
};

function calcBoxPropsXSize(options: {
    left: boolean, cosFraction: number, sinFraction: number, initX: number,
    initY: number, initW: number, initH: number, minWidth: number,
    rotatedWDiff: number,
}) {
    const {
        left, cosFraction, sinFraction, initH, minWidth,
    } = options;
    let { initX, initY, initW, rotatedWDiff } = options;

    if (left) {
        initW -= rotatedWDiff;
        if (initW < minWidth) {
            initW = minWidth;
            rotatedWDiff = initW - minWidth;
        }
    } else {
        initW = initW + rotatedWDiff;
        if (initW < minWidth) {
            initW = minWidth;
            rotatedWDiff = minWidth - initW;
        }
    }
    initX += 0.5 * rotatedWDiff * cosFraction;
    initY += 0.5 * rotatedWDiff * sinFraction;
    return {
        newW: initW, newH: initH, newX: initX, newY: initY,
    };
}
function calcBoxPropsYSize(options: {
    top: boolean, cosFraction: number, sinFraction: number, initX: number,
    initY: number, initW: number, initH: number, minHeight: number,
    rotatedHDiff: number,
}) {
    const {
        top, cosFraction, sinFraction, initW, minHeight,
    } = options;
    let { initX, initY, initH, rotatedHDiff } = options;

    if (top) {
        initH -= rotatedHDiff;
        if (initH < minHeight) {
            initH = minHeight;
            rotatedHDiff = initH - minHeight;
        }
    } else {
        initH = initH + rotatedHDiff;
        if (initH < minHeight) {
            initH = minHeight;
            rotatedHDiff = minHeight - initH;
        }
    }
    initX -= 0.5 * rotatedHDiff * sinFraction;
    initY += 0.5 * rotatedHDiff * cosFraction;
    return {
        newX: initX, newY: initY, newW: initW, newH: initH,
    };
}
function calcBoxProps(options: CalcBoxPropsType) {
    const {
        left, top, xResize, yResize, cosFraction, sinFraction, initW, initH,
        boxProps, mEvent,
    } = options;
    const { scaleFactor, mousePressX, mousePressY } = boxProps;
    const wDiff = (mEvent.clientX - mousePressX) / scaleFactor;
    const hDiff = (mEvent.clientY - mousePressY) / scaleFactor;
    const rotatedWDiff = cosFraction * wDiff + sinFraction * hDiff;
    const rotatedHDiff = cosFraction * hDiff - sinFraction * wDiff;

    let newW = initW,
        newH = initH,
        newX = boxProps.initX,
        newY = boxProps.initY;

    if (xResize) {
        const result = calcBoxPropsXSize({
            left, cosFraction, sinFraction, initW, initH, ...boxProps,
            rotatedWDiff,
        });
        newX = result.newX;
        newY = result.newY;
        newW = result.newW;
        newH = result.newH;
    }

    if (yResize) {
        const result = calcBoxPropsYSize({
            top, cosFraction, sinFraction, rotatedHDiff, ...boxProps,
            initX: newX, initY: newY, initW: newW, initH: newH,
        });
        newX = result.newX;
        newY = result.newY;
        newW = result.newW;
        newH = result.newH;
    }
    return {
        newW, newH, newX, newY,
    };
}

export default class BoxEditorController {
    onDone: () => void = () => false;
    onClick: (event: any) => void = () => false;
    editor: HTMLDivElement | null = null;
    target: HTMLDivElement | null = null;
    minWidth = 40;
    minHeight = 40;
    initX = 0;
    initY = 0;
    mousePressX = 0;
    mousePressY = 0;
    scaleFactor = 1;
    resizeActorList: {
        [key: string]: ResizeType
    } = {
            'right-mid': {
                left: false, top: false, xResize: true, yResize: false,
            },
            'left-mid': {
                left: true, top: false, xResize: true, yResize: false,
            },
            'top-mid': {
                left: false, top: true, xResize: false, yResize: true,
            },
            'bottom-mid': {
                left: false, top: false, xResize: false, yResize: true,
            },
            'left-top': {
                left: true, top: true, xResize: true, yResize: true,
            },
            'right-top': {
                left: false, top: true, xResize: true, yResize: true,
            },
            'right-bottom': {
                left: false, top: false, xResize: true, yResize: true,
            },
            'left-bottom': {
                left: true, top: false, xResize: true, yResize: true,
            },
        };
    rotatorCN = 'rotate';
    listened: ListenedEvent[] = [];
    setScaleFactor(sf: number) {
        this.scaleFactor = sf;
    }
    addEvent(le: ListenedEvent) {
        le.target.addEventListener(le.eventName, le.listener, false);
        this.listened.push(le);
    }
    release() {
        while (this.listened.length) {
            const obj = this.listened.shift();
            obj?.target.removeEventListener(
                obj.eventName, obj.listener as any, false,
            );
        }
        this.editor = null;
        this.target = null;
    }
    initEvent(editor: HTMLDivElement) {
        this.release();
        this.editor = editor;
        this.target = this.editor.firstChild as HTMLDivElement;
        // drag support
        const moveHandler = (event: MouseEvent) => this.moveHandler(event);
        this.addEvent({
            eventName: 'mousedown',
            target: this.target,
            listener: moveHandler,
        });
        // handle resize
        for (const [key, value] of Object.entries(this.resizeActorList)) {
            const ele = this.target.querySelector(`.${key}`) as HTMLDivElement;
            const resizeHandler = (event: MouseEvent) => {
                return this.resizeHandler(event, value);
            };
            this.addEvent({
                eventName: 'mousedown',
                target: ele,
                listener: resizeHandler,
            });
        }
        // handle rotation
        const rotator = (
            this.target.querySelector(`.${this.rotatorCN}`) as HTMLDivElement
        );
        const rotateHandler = (event: MouseEvent) => this.rotateHandler(event);
        this.addEvent({
            eventName: 'mousedown',
            target: rotator,
            listener: rotateHandler,
        });
    }
    moveHandler(event: MouseEvent) {
        if (this.editor === null || this.target === null) {
            return;
        }
        event.stopPropagation();
        let isMoving = false;
        const target = event.currentTarget as HTMLDivElement;
        if (target.className.includes('dot')) {
            return;
        }
        this.initX = this.editor.offsetLeft;
        this.initY = this.editor.offsetTop;
        this.mousePressX = event.clientX;
        this.mousePressY = event.clientY;

        const eventMouseMoveHandler = (event: MouseEvent) => {
            event.stopPropagation();
            isMoving = true;
            const {
                scaleFactor, initX, initY, mousePressX, mousePressY,
            } = this;
            this.repositionElement(
                initX + (event.clientX - mousePressX) / scaleFactor,
                initY + (event.clientY - mousePressY) / scaleFactor,
            );
        };
        const eventMouseUpHandler = (endingEvent: MouseEvent) => {
            if (this.editor === null || this.target === null) {
                return;
            }
            endingEvent.stopPropagation();
            if (isMoving) {
                this.onDone();
            } else {
                this.onClick(endingEvent);
            }
            window.removeEventListener(
                'mousemove', eventMouseMoveHandler, false,
            );
            window.removeEventListener('mouseup', eventMouseUpHandler);
        };
        window.addEventListener('mousemove', eventMouseMoveHandler, false);
        window.addEventListener('mouseup', eventMouseUpHandler, false);
    }
    rotationFromStyle(st: CSSStyleDeclaration) {
        const tm = st.getPropertyValue('transform');
        if (tm !== 'none') {
            const values = tm.split('(')[1].split(')')[0].split(',');
            const angle = Math.round(
                Math.atan2(
                    parseInt(values[1], 10),
                    parseInt(values[0], 10)) * (180 / Math.PI
                ),
            );
            return angle < 0 ? angle + 360 : angle;
        }
        return 0;
    }
    getCurrentRotation(el: HTMLDivElement) {
        const st = window.getComputedStyle(el, null);
        return this.rotationFromStyle(st);
    }
    repositionElement(x: number, y: number) {
        if (this.editor === null) {
            return;
        }
        this.editor.style.left = `${x}px`;
        this.editor.style.top = `${y}px`;
    }
    resizeBox(w: number, h: number) {
        if (this.target === null) {
            return;
        }
        this.target.style.width = `${w}px`;
        this.target.style.height = `${h}px`;
    }
    rotateBox(deg: number) {
        if (this.editor === null) {
            return;
        }
        this.editor.style.transform = `rotate(${deg}deg)`;
    }
    unRotateBox() {
        if (this.editor === null) {
            return;
        }
        this.editor.style.transform = 'rotate(0deg)';
    }
    rotateHandler(event: MouseEvent) {
        if (this.target === null) {
            return;
        }
        event.stopPropagation();
        const arrowRects = this.target.getBoundingClientRect();
        const arrowX = arrowRects.left + arrowRects.width / 2;
        const arrowY = arrowRects.top + arrowRects.height / 2;

        const eventMoveHandler = (movingEvent: MouseEvent) => {
            movingEvent.stopPropagation();
            const angle =
                Math.atan2(
                    movingEvent.clientY - arrowY,
                    movingEvent.clientX - arrowX,
                ) + Math.PI / 2;
            this.rotateBox((angle * 180) / Math.PI);
        };
        const eventEndHandler = (endingEvent: MouseEvent) => {
            endingEvent.stopPropagation();
            if (this.onDone !== null) {
                this.onDone();
            }
            window.removeEventListener('mousemove', eventMoveHandler, false);
            window.removeEventListener('mouseup', eventEndHandler);
        };
        window.addEventListener('mousemove', eventMoveHandler, false);
        window.addEventListener('mouseup', eventEndHandler, false);
    }
    resizeHandler(event: MouseEvent, options: ResizeType) {
        if (this.editor === null || this.target === null) {
            return;
        }
        event.stopPropagation();
        const { left, top, xResize, yResize } = options;
        this.initX = this.editor.offsetLeft;
        this.initY = this.editor.offsetTop;
        this.mousePressX = event.clientX;
        this.mousePressY = event.clientY;

        const initW = this.target.offsetWidth;
        const initH = this.target.offsetHeight;

        const initRotate = this.getCurrentRotation(this.editor);
        const initRadians = (initRotate * Math.PI) / 180;
        const cosFraction = Math.cos(initRadians);
        const sinFraction = Math.sin(initRadians);
        const mMoveHandler = (movingEvent: MouseEvent) => {
            movingEvent.stopPropagation();
            const { newW, newH, newX, newY } = calcBoxProps({
                left, top, xResize, yResize, cosFraction, sinFraction,
                initW, initH, boxProps: this, mEvent: movingEvent,
            });
            this.resizeBox(newW, newH);
            this.repositionElement(newX, newY);
        };

        const eventMouseUpHandler = (endingEvent: MouseEvent) => {
            if (this.onDone !== null) {
                this.onDone();
            }
            endingEvent.stopPropagation();
            window.removeEventListener('mousemove', mMoveHandler, false);
            window.removeEventListener('mouseup', eventMouseUpHandler);
        };
        window.addEventListener('mousemove', mMoveHandler, false);
        window.addEventListener('mouseup', eventMouseUpHandler, false);
    }
    getInfo(): BoxInfoType | null {
        if (this.editor === null || this.target === null) {
            return null;
        }
        const info = {
            top: removePX(this.editor.style.top),
            left: removePX(this.editor.style.left),
            width: removePX(this.target.style.width),
            height: removePX(this.target.style.height),
            rotate: getRotationDeg(this.editor.style.transform),
        };
        info.top -= info.height / 2;
        info.left -= info.width / 2;
        return info;
    }
}

export const boxEditorController = new BoxEditorController();
