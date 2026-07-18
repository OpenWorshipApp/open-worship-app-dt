import { createContext, use } from 'react';
import { getRotationDeg, removePX } from '../helper/helpers';
import type { OptionalPromise } from '../helper/typeHelpers';
import type {
    SnapLinesType,
    SnapTargetsType,
} from './canvas/canvasSnapGuideHelpers';

type ResizeType = {
    left: boolean;
    top: boolean;
    xResize: boolean;
    yResize: boolean;
};
type BoxInfoType = {
    top: number;
    left: number;
    width: number;
    height: number;
    rotate: number;
};
type ListenedEvent = {
    eventName: 'pointerdown';
    target: HTMLDivElement;
    listener: (event: PointerEvent) => void;
};

type CalcBoxPropsType = {
    left: boolean;
    top: boolean;
    xResize: boolean;
    yResize: boolean;
    cosFraction: number;
    sinFraction: number;
    initW: number;
    initH: number;
    boxProps: BoxEditorController;
    mEvent: MouseEvent;
};

function calcBoxPropsXSize(options: {
    left: boolean;
    cosFraction: number;
    sinFraction: number;
    initX: number;
    initY: number;
    initW: number;
    initH: number;
    minWidth: number;
    rotatedWDiff: number;
    centerAnchored: boolean;
}) {
    const { left, cosFraction, sinFraction, initH, minWidth, centerAnchored } =
        options;
    let { initX, initY, initW, rotatedWDiff } = options;

    if (centerAnchored) {
        // Both edges move symmetrically about the unchanged center.
        const doubledDiff = rotatedWDiff * 2;
        initW = left ? initW - doubledDiff : initW + doubledDiff;
        if (initW < minWidth) {
            initW = minWidth;
        }
        return { newW: initW, newH: initH, newX: initX, newY: initY };
    }

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
        newW: initW,
        newH: initH,
        newX: initX,
        newY: initY,
    };
}
function calcBoxPropsYSize(options: {
    top: boolean;
    cosFraction: number;
    sinFraction: number;
    initX: number;
    initY: number;
    initW: number;
    initH: number;
    minHeight: number;
    rotatedHDiff: number;
    centerAnchored: boolean;
}) {
    const { top, cosFraction, sinFraction, initW, minHeight, centerAnchored } =
        options;
    let { initX, initY, initH, rotatedHDiff } = options;

    if (centerAnchored) {
        // Both edges move symmetrically about the unchanged center.
        const doubledDiff = rotatedHDiff * 2;
        initH = top ? initH - doubledDiff : initH + doubledDiff;
        if (initH < minHeight) {
            initH = minHeight;
        }
        return { newX: initX, newY: initY, newW: initW, newH: initH };
    }

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
        newX: initX,
        newY: initY,
        newW: initW,
        newH: initH,
    };
}
function calcBoxProps(options: CalcBoxPropsType) {
    const {
        left,
        top,
        xResize,
        yResize,
        cosFraction,
        sinFraction,
        initW,
        initH,
        boxProps,
        mEvent,
    } = options;
    const { scaleFactor, mousePressX, mousePressY } = boxProps;
    const wDiff = (mEvent.clientX - mousePressX) / scaleFactor;
    const hDiff = (mEvent.clientY - mousePressY) / scaleFactor;
    const rotatedWDiff = cosFraction * wDiff + sinFraction * hDiff;
    const rotatedHDiff = cosFraction * hDiff - sinFraction * wDiff;
    const centerAnchored = mEvent.ctrlKey || mEvent.metaKey;

    let newW = initW,
        newH = initH,
        newX = boxProps.initX,
        newY = boxProps.initY;

    if (xResize) {
        const result = calcBoxPropsXSize({
            left,
            cosFraction,
            sinFraction,
            initW,
            initH,
            ...boxProps,
            rotatedWDiff,
            centerAnchored,
        });
        newX = result.newX;
        newY = result.newY;
        newW = result.newW;
        newH = result.newH;
    }

    if (yResize) {
        const result = calcBoxPropsYSize({
            top,
            cosFraction,
            sinFraction,
            rotatedHDiff,
            ...boxProps,
            initX: newX,
            initY: newY,
            initW: newW,
            initH: newH,
            centerAnchored,
        });
        newX = result.newX;
        newY = result.newY;
        newW = result.newW;
        newH = result.newH;
    }

    if (boxProps.lockAspectRatio && initH !== 0 && initW !== 0) {
        const ratio = initW / initH;
        if (xResize && yResize) {
            // Corner handle: scale both axes by whichever one changed
            // more, then place the center so the opposite corner stays
            // fixed. The shift is computed fresh from the original
            // (pre-drag) center using the final sizes: the dragged corner
            // sits at half the size change along each rotated axis, so
            // this stays exact for any rotation — patching the
            // incremental per-axis shifts instead would mix the
            // rotation's cross-axis terms and drift the box.
            const wScale = Math.abs(newW / initW - 1);
            const hScale = Math.abs(newH / initH - 1);
            if (wScale >= hScale) {
                newH = newW / ratio;
            } else {
                newW = newH * ratio;
            }
            if (newW < boxProps.minWidth) {
                newW = boxProps.minWidth;
                newH = newW / ratio;
            }
            if (newH < boxProps.minHeight) {
                newH = boxProps.minHeight;
                newW = newH * ratio;
            }
            if (centerAnchored) {
                newX = boxProps.initX;
                newY = boxProps.initY;
            } else {
                const dxLocal = ((left ? -1 : 1) * (newW - initW)) / 2;
                const dyLocal = ((top ? -1 : 1) * (newH - initH)) / 2;
                newX =
                    boxProps.initX +
                    dxLocal * cosFraction -
                    dyLocal * sinFraction;
                newY =
                    boxProps.initY +
                    dxLocal * sinFraction +
                    dyLocal * cosFraction;
            }
        } else if (xResize) {
            // Edge handle: grow/shrink the perpendicular axis symmetrically
            // about the unchanged center.
            newH = newW / ratio;
        } else if (yResize) {
            newW = newH * ratio;
        }
    }
    return {
        newW,
        newH,
        newX,
        newY,
    };
}

// The final resting place of a box that was dragged along with the one under
// the cursor, ready to be committed by the caller.
export type BoxMoveType = { id: number; left: number; top: number };

// A selected box captured at drag start. The one under the cursor is the
// leader: it drives snapping, and the rest keep their offset to it.
type MoveGroupMemberType = {
    id: number;
    editor: HTMLDivElement;
    isLeader: boolean;
    initX: number;
    initY: number;
    width: number;
    height: number;
};

export default class BoxEditorController {
    onDone: (groupMoves: BoxMoveType[]) => OptionalPromise<void> = () => {};
    onClick: (event: any) => OptionalPromise<void> = () => {};
    editor: HTMLDivElement | null = null;
    target: HTMLDivElement | null = null;
    minWidth = 40;
    minHeight = 40;
    snapThresholdScreenPx = 8;
    getSnapTargets: ((excludeIds: number[]) => SnapTargetsType) | null = null;
    // Ids of every selected box, in selection order. Dragging any one of them
    // moves the whole set.
    getMoveGroupIds: (() => number[]) | null = null;
    onSnapping: ((lines: SnapLinesType) => void) | null = null;
    private lastSnapLines: SnapLinesType = { vertical: [], horizontal: [] };
    lockAspectRatio = false;
    initX = 0;
    initY = 0;
    mousePressX = 0;
    mousePressY = 0;
    scaleFactor = 1;
    resizeActorList: {
        [key: string]: ResizeType;
    } = {
        'right-mid': {
            left: false,
            top: false,
            xResize: true,
            yResize: false,
        },
        'left-mid': {
            left: true,
            top: false,
            xResize: true,
            yResize: false,
        },
        'top-mid': {
            left: false,
            top: true,
            xResize: false,
            yResize: true,
        },
        'bottom-mid': {
            left: false,
            top: false,
            xResize: false,
            yResize: true,
        },
        'left-top': {
            left: true,
            top: true,
            xResize: true,
            yResize: true,
        },
        'right-top': {
            left: false,
            top: true,
            xResize: true,
            yResize: true,
        },
        'right-bottom': {
            left: false,
            top: false,
            xResize: true,
            yResize: true,
        },
        'left-bottom': {
            left: true,
            top: false,
            xResize: true,
            yResize: true,
        },
    };
    rotatorCN = 'rotate';
    listened: ListenedEvent[] = [];
    private dragInfoElement: HTMLDivElement | null = null;
    constructor(scaleFactor: number) {
        this.scaleFactor = scaleFactor;
    }
    addEvent(listenerEvent: ListenedEvent) {
        listenerEvent.target.addEventListener(
            listenerEvent.eventName,
            listenerEvent.listener,
        );
        this.listened.push(listenerEvent);
    }
    release() {
        this.onDone = () => {};
        while (this.listened.length) {
            const obj = this.listened.shift();
            obj?.target.removeEventListener(obj.eventName, obj.listener as any);
        }
        this.hideDragInfo();
        this.editor = null;
        this.target = null;
    }
    // A small badge following the cursor with the live value of the
    // ongoing drag (position, size or angle). Attached to `document.body`
    // with fixed positioning so it is unaffected by the canvas' CSS
    // scale/rotate transforms and shadow DOM.
    showDragInfo(event: MouseEvent, text: string) {
        if (this.dragInfoElement === null) {
            const element = document.createElement('div');
            element.style.position = 'fixed';
            element.style.zIndex = '99999';
            element.style.pointerEvents = 'none';
            element.style.background = 'rgba(0, 0, 0, 0.75)';
            element.style.color = '#fff';
            element.style.font = '11px sans-serif';
            element.style.padding = '2px 6px';
            element.style.borderRadius = '4px';
            // `pre` so a multi-selection drag can list one box per line.
            element.style.whiteSpace = 'pre';
            document.body.appendChild(element);
            this.dragInfoElement = element;
        }
        this.dragInfoElement.textContent = text;
        this.dragInfoElement.style.left = `${event.clientX + 14}px`;
        this.dragInfoElement.style.top = `${event.clientY + 18}px`;
    }
    hideDragInfo() {
        this.dragInfoElement?.remove();
        this.dragInfoElement = null;
    }
    initEvent(
        editor: HTMLDivElement,
        onDone: (groupMoves: BoxMoveType[]) => OptionalPromise<void>,
    ) {
        this.release();
        this.onDone = onDone;
        this.editor = editor;
        this.target = this.editor.firstChild as HTMLDivElement;
        // drag support. Pointer events (not mouse) so a finger drags the box
        // just like a cursor; a `PointerEvent` is a `MouseEvent`, so every
        // handler below reads the same `clientX/clientY/button/ctrlKey` fields.
        this.addEvent({
            eventName: 'pointerdown',
            target: this.target,
            listener: (event: PointerEvent) => {
                this.moveHandler(event);
            },
        });
        // handle resize
        for (const [key, value] of Object.entries(this.resizeActorList)) {
            const ele = this.target.querySelector(`.${key}`) as HTMLDivElement;
            this.addEvent({
                eventName: 'pointerdown',
                target: ele,
                listener: (event: PointerEvent) => {
                    return this.resizeHandler(event, value);
                },
            });
        }
        // handle rotation
        const rotator = this.target.querySelector(
            `.${this.rotatorCN}`,
        ) as HTMLDivElement;
        this.addEvent({
            eventName: 'pointerdown',
            target: rotator,
            listener: (event: PointerEvent) => {
                this.rotateHandler(event);
            },
        });
    }
    // Redirect all further moves of this pointer to the element the drag
    // started on, so a touch drag (or a mouse drag that wanders over one of the
    // box's iframes: youtube/website/video) keeps delivering `pointermove`
    // instead of being swallowed by whatever ends up under the finger/cursor.
    private capturePointer(event: PointerEvent) {
        const target = event.currentTarget as HTMLElement | null;
        try {
            target?.setPointerCapture(event.pointerId);
        } catch {
            // Pointer already released/invalid — nothing to capture.
        }
    }
    // Sizes come from the inline style (like the commit in `getInfo`) so a
    // drag in progress reads the same value that will be committed.
    private getBoxSize(editor: HTMLDivElement) {
        const target = editor.firstChild as HTMLDivElement | null;
        return {
            width:
                removePX(target?.style.width ?? '') ||
                (target?.offsetWidth ?? 0),
            height:
                removePX(target?.style.height ?? '') ||
                (target?.offsetHeight ?? 0),
        };
    }
    private createMoveGroupMember(
        id: number,
        editor: HTMLDivElement,
        isLeader: boolean,
    ): MoveGroupMemberType {
        return {
            id,
            editor,
            isLeader,
            initX: editor.offsetLeft,
            initY: editor.offsetTop,
            ...this.getBoxSize(editor),
        };
    }
    // Only a selected box is in controlling mode, so restricting to
    // `.editor-controller-box-wrapper` children keeps this from matching the
    // plain (unselected) rendering of a box, which carries the same id.
    private resolveEditorElement(id: number) {
        const box = this.editor?.parentElement?.querySelector(
            `.editor-controller-box-wrapper > [data-app-box-editor-id="${id}"]`,
        );
        const editor = box?.parentElement ?? null;
        return editor instanceof HTMLDivElement ? editor : null;
    }
    private collectMoveGroupMembers(): MoveGroupMemberType[] {
        if (this.editor === null) {
            return [];
        }
        const leaderId = Number.parseInt(
            this.target?.dataset.appBoxEditorId ?? '',
        );
        const leader = this.createMoveGroupMember(leaderId, this.editor, true);
        const members: MoveGroupMemberType[] = [];
        // Selection order, so the drag badge lists the boxes the same way the
        // props panel does.
        for (const id of this.getMoveGroupIds?.() ?? []) {
            if (id === leaderId) {
                members.push(leader);
                continue;
            }
            const editor = this.resolveEditorElement(id);
            if (editor !== null) {
                members.push(this.createMoveGroupMember(id, editor, false));
            }
        }
        if (!members.includes(leader)) {
            members.unshift(leader);
        }
        return members;
    }
    private getGroupMoves(members: MoveGroupMemberType[]): BoxMoveType[] {
        // The leader is committed by the caller from `getInfo`, which also
        // carries its size and rotation.
        return members
            .filter((member) => {
                return !member.isLeader;
            })
            .map((member) => {
                return {
                    id: member.id,
                    left: removePX(member.editor.style.left) - member.width / 2,
                    top: removePX(member.editor.style.top) - member.height / 2,
                };
            });
    }
    moveHandler(event: PointerEvent) {
        if (
            event.button === 2 ||
            this.editor === null ||
            this.target === null
        ) {
            return;
        }
        this.blockMouseEvent(event);
        this.capturePointer(event);
        let isMoving = false;
        const target = event.currentTarget as HTMLDivElement;
        if (target.className.includes('dot')) {
            return;
        }
        this.initX = this.editor.offsetLeft;
        this.initY = this.editor.offsetTop;
        this.mousePressX = event.clientX;
        this.mousePressY = event.clientY;
        // Snapshot where every selected box starts, so each can be offset by
        // the leader's (snapped) delta and the whole set moves as one.
        const members = this.collectMoveGroupMembers();
        const leader = members.find((member) => member.isLeader) ?? null;
        // Snap targets are invariant while the drag lasts (other boxes only
        // move on commit), so build them once instead of per mousemove.
        const snapTargets = this.snapshotSnapTargets();

        const eventMouseMoveHandler = (event: PointerEvent) => {
            this.blockMouseEvent(event);
            isMoving = true;
            const { scaleFactor, initX, initY, mousePressX, mousePressY } =
                this;
            const rawX = initX + (event.clientX - mousePressX) / scaleFactor;
            const rawY = initY + (event.clientY - mousePressY) / scaleFactor;
            const { x, y } = this.applyMoveSnapping(
                snapTargets,
                rawX,
                rawY,
                leader?.width ?? 0,
                leader?.height ?? 0,
            );
            this.repositionElement(x, y);
            const deltaX = x - initX;
            const deltaY = y - initY;
            const infoLines: string[] = [];
            for (const member of members) {
                const centerX = member.initX + deltaX;
                const centerY = member.initY + deltaY;
                if (!member.isLeader) {
                    member.editor.style.left = `${centerX}px`;
                    member.editor.style.top = `${centerY}px`;
                }
                // The stored position is the box center; show the top-left
                // corner to match the props panel's X/Y fields.
                infoLines.push(
                    `x: ${Math.round(centerX - member.width / 2)}, ` +
                        `y: ${Math.round(centerY - member.height / 2)}`,
                );
            }
            this.showDragInfo(event, infoLines.join('\n'));
        };
        const eventMouseUpHandler = (event: PointerEvent) => {
            if (this.editor === null || this.target === null) {
                return;
            }
            this.blockMouseEvent(event);
            globalThis.removeEventListener(
                'pointermove',
                eventMouseMoveHandler,
            );
            globalThis.removeEventListener('pointerup', eventMouseUpHandler);
            globalThis.removeEventListener(
                'pointercancel',
                eventMouseUpHandler,
            );
            this.emitSnapLines([], []);
            this.hideDragInfo();
            if (isMoving) {
                this.onDone(this.getGroupMoves(members));
            } else {
                this.onClick(event);
            }
        };
        globalThis.addEventListener('pointermove', eventMouseMoveHandler);
        globalThis.addEventListener('pointerup', eventMouseUpHandler);
        globalThis.addEventListener('pointercancel', eventMouseUpHandler);
    }
    rotationFromStyle(style: CSSStyleDeclaration) {
        const transform = style.getPropertyValue('transform');
        if (transform !== 'none') {
            const values = transform.split('(')[1].split(')')[0].split(',');
            // `parseInt` truncates at the decimal point, so any matrix
            // component smaller than 1 in magnitude (i.e. every sin/cos
            // value except at exact 90°-multiples) collapsed to 0 — making
            // this always report ~0° and silently breaking resize math for
            // any rotated box. Use `parseFloat` to actually read the value.
            const angle = Math.round(
                Math.atan2(
                    Number.parseFloat(values[1]),
                    Number.parseFloat(values[0]),
                ) *
                    (180 / Math.PI),
            );
            return angle < 0 ? angle + 360 : angle;
        }
        return 0;
    }
    getCurrentRotation(element: HTMLDivElement) {
        const style = globalThis.getComputedStyle(element, null);
        return this.rotationFromStyle(style);
    }
    repositionElement(x: number, y: number) {
        if (this.editor === null) {
            return;
        }
        this.editor.style.left = `${x}px`;
        this.editor.style.top = `${y}px`;
    }
    resizeBox(width: number, height: number) {
        if (this.target === null) {
            return;
        }
        this.target.style.width = `${width}px`;
        this.target.style.height = `${height}px`;
    }
    rotateBox(rotationDegrees: number) {
        if (this.editor === null) {
            return;
        }
        this.editor.style.transform = `rotate(${rotationDegrees}deg)`;
    }
    unRotateBox() {
        if (this.editor === null) {
            return;
        }
        this.editor.style.transform = 'rotate(0deg)';
    }
    blockMouseEvent(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
    }
    rotateHandler(event: PointerEvent) {
        if (this.target === null) {
            return;
        }
        this.blockMouseEvent(event);
        this.capturePointer(event);
        const arrowRects = this.target.getBoundingClientRect();
        const arrowX = arrowRects.left + arrowRects.width / 2;
        const arrowY = arrowRects.top + arrowRects.height / 2;

        const eventMoveHandler = (event: PointerEvent) => {
            this.blockMouseEvent(event);
            const angle =
                Math.atan2(event.clientY - arrowY, event.clientX - arrowX) +
                Math.PI / 2;
            const rotationDegrees = (angle * 180) / Math.PI;
            this.rotateBox(rotationDegrees);
            // Truncate like the commit does (`getRotationDeg` parses the
            // style with `parseInt`), so the badge shows exactly the value
            // that will land in the props panel — including negatives.
            this.showDragInfo(event, `${Math.trunc(rotationDegrees)}°`);
        };
        const eventEndHandler = (event: PointerEvent) => {
            this.blockMouseEvent(event);
            globalThis.removeEventListener('pointermove', eventMoveHandler);
            globalThis.removeEventListener('pointerup', eventEndHandler);
            globalThis.removeEventListener('pointercancel', eventEndHandler);
            this.hideDragInfo();
            this.onDone([]);
        };
        globalThis.addEventListener('pointermove', eventMoveHandler);
        globalThis.addEventListener('pointerup', eventEndHandler);
        globalThis.addEventListener('pointercancel', eventEndHandler);
    }
    resizeHandler(event: PointerEvent, options: ResizeType) {
        if (this.editor === null || this.target === null) {
            return;
        }
        this.blockMouseEvent(event);
        this.capturePointer(event);
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
        // Snap targets are invariant while the drag lasts (other boxes only
        // move on commit), so build them once instead of per mousemove.
        const snapTargets = this.snapshotSnapTargets();
        const mouseMoveHandler = (event: PointerEvent) => {
            this.blockMouseEvent(event);
            const { newW, newH, newX, newY } = calcBoxProps({
                left,
                top,
                xResize,
                yResize,
                cosFraction,
                sinFraction,
                initW,
                initH,
                boxProps: this,
                mEvent: event,
            });
            // Snapping assumes the opposite edge stays fixed, which doesn't
            // hold for a center-anchored (Ctrl/Cmd) resize or an
            // aspect-ratio-locked resize (both axes move together).
            const centerAnchored = event.ctrlKey || event.metaKey;
            const snapped =
                centerAnchored || this.lockAspectRatio
                    ? { newX, newY, newW, newH }
                    : this.applyResizeSnapping(
                          snapTargets,
                          newX,
                          newY,
                          newW,
                          newH,
                          {
                              left,
                              top,
                              xResize,
                              yResize,
                              rotate: initRotate,
                          },
                      );
            this.resizeBox(snapped.newW, snapped.newH);
            this.repositionElement(snapped.newX, snapped.newY);
            // Truncate like the commit does (`getInfo` parses the style
            // sizes with `parseInt`), so the badge matches the panel.
            this.showDragInfo(
                event,
                `w: ${Math.trunc(snapped.newW)}, h: ${Math.trunc(snapped.newH)}`,
            );
        };

        const eventMouseUpHandler = (event: PointerEvent) => {
            this.blockMouseEvent(event);
            globalThis.removeEventListener('pointermove', mouseMoveHandler);
            globalThis.removeEventListener('pointerup', eventMouseUpHandler);
            globalThis.removeEventListener(
                'pointercancel',
                eventMouseUpHandler,
            );
            this.emitSnapLines([], []);
            this.hideDragInfo();
            this.onDone([]);
        };
        globalThis.addEventListener('pointermove', mouseMoveHandler);
        globalThis.addEventListener('pointerup', eventMouseUpHandler);
        globalThis.addEventListener('pointercancel', eventMouseUpHandler);
    }
    private snapAxis(value: number, targets: number[], threshold: number) {
        let best: { line: number; diff: number } | null = null;
        for (const line of targets) {
            const diff = Math.abs(line - value);
            if (diff <= threshold && (best === null || diff < best.diff)) {
                best = { line, diff };
            }
        }
        return best;
    }
    // The whole selection travels with the drag, so no member of it (nor the
    // dragged box itself) is a valid snap target.
    private snapshotSnapTargets(): SnapTargetsType | null {
        if (this.getSnapTargets === null) {
            return null;
        }
        const excludeIds = [...(this.getMoveGroupIds?.() ?? [])];
        const leaderId = Number.parseInt(
            this.target?.dataset.appBoxEditorId ?? '',
        );
        if (!Number.isNaN(leaderId) && !excludeIds.includes(leaderId)) {
            excludeIds.push(leaderId);
        }
        return this.getSnapTargets(excludeIds);
    }
    // Skips unchanged emissions so the React canvas isn't re-rendered on
    // every mousemove (a fresh lines object per event would defeat React's
    // setState bailout).
    private emitSnapLines(vertical: number[], horizontal: number[]) {
        const checkIsSame = (a: number[], b: number[]) => {
            return (
                a.length === b.length &&
                a.every((value, index) => value === b[index])
            );
        };
        const last = this.lastSnapLines;
        if (
            checkIsSame(vertical, last.vertical) &&
            checkIsSame(horizontal, last.horizontal)
        ) {
            return;
        }
        this.lastSnapLines = { vertical, horizontal };
        this.onSnapping?.({ vertical, horizontal });
    }
    private pickBestSnapCandidate(
        candidates: { value: number; toCenter: (line: number) => number }[],
        targetLines: number[],
        threshold: number,
    ) {
        let best: {
            diff: number;
            line: number;
            toCenter: (line: number) => number;
        } | null = null;
        for (const candidate of candidates) {
            const match = this.snapAxis(
                candidate.value,
                targetLines,
                threshold,
            );
            if (match !== null && (best === null || match.diff < best.diff)) {
                best = { ...match, toCenter: candidate.toCenter };
            }
        }
        return best;
    }
    applyMoveSnapping(
        targets: SnapTargetsType | null,
        centerX: number,
        centerY: number,
        width: number,
        height: number,
    ) {
        if (targets === null) {
            return { x: centerX, y: centerY };
        }
        const threshold = this.snapThresholdScreenPx / this.scaleFactor;
        // Either edge or the center may snap, whichever line is closest.
        const bestV = this.pickBestSnapCandidate(
            [
                {
                    value: centerX - width / 2,
                    toCenter: (line) => line + width / 2,
                },
                { value: centerX, toCenter: (line) => line },
                {
                    value: centerX + width / 2,
                    toCenter: (line) => line - width / 2,
                },
            ],
            targets.vertical,
            threshold,
        );
        const bestH = this.pickBestSnapCandidate(
            [
                {
                    value: centerY - height / 2,
                    toCenter: (line) => line + height / 2,
                },
                { value: centerY, toCenter: (line) => line },
                {
                    value: centerY + height / 2,
                    toCenter: (line) => line - height / 2,
                },
            ],
            targets.horizontal,
            threshold,
        );
        this.emitSnapLines(
            bestV === null ? [] : [bestV.line],
            bestH === null ? [] : [bestH.line],
        );
        return {
            x: bestV === null ? centerX : bestV.toCenter(bestV.line),
            y: bestH === null ? centerY : bestH.toCenter(bestH.line),
        };
    }
    applyResizeSnapping(
        targets: SnapTargetsType | null,
        newX: number,
        newY: number,
        newW: number,
        newH: number,
        options: ResizeType & { rotate: number },
    ) {
        if (targets === null || Math.round(options.rotate) !== 0) {
            return { newX, newY, newW, newH };
        }
        const threshold = this.snapThresholdScreenPx / this.scaleFactor;
        const matchedV: number[] = [];
        const matchedH: number[] = [];
        if (options.xResize) {
            const edgeX = options.left ? newX - newW / 2 : newX + newW / 2;
            const match = this.snapAxis(edgeX, targets.vertical, threshold);
            if (match !== null) {
                const delta = match.line - edgeX;
                newW += options.left ? -delta : delta;
                newX += delta / 2;
                matchedV.push(match.line);
            }
        }
        if (options.yResize) {
            const edgeY = options.top ? newY - newH / 2 : newY + newH / 2;
            const match = this.snapAxis(edgeY, targets.horizontal, threshold);
            if (match !== null) {
                const delta = match.line - edgeY;
                newH += options.top ? -delta : delta;
                newY += delta / 2;
                matchedH.push(match.line);
            }
        }
        this.emitSnapLines(matchedV, matchedH);
        return { newX, newY, newW, newH };
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

export const BoxEditorControllerContext =
    createContext<BoxEditorController | null>(null);
export function useBoxEditorControllerContext() {
    const context = use(BoxEditorControllerContext);
    if (context === null) {
        throw new Error(
            'useBoxEditorControllerContext must be used inside a ' +
                'BoxEditorControllerContext',
        );
    }
    return context;
}
