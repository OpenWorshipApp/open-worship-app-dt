import type { DragEvent } from 'react';

import { showCanvasContextMenu } from '../canvasContextMenuHelpers';
import type CanvasController from '../CanvasController';
import { showSimpleToast } from '../../../toast/toastHelpers';
import { readDroppedFiles } from '../../../others/droppingFileHelpers';
import { checkIsSupportCanvasMediaType } from '../canvasHelpers';
import { tran } from '../../../lang/langHelpers';
import { extractDropData } from '../../../helper/dragHelpers';
import {
    applyCanvasBackgroundDropPlan,
    checkIsCanvasBackgroundDropDataTransfer,
    planCanvasBackgroundDrop,
} from '../canvasBackgroundDropHelpers';

export function dragOverHandling(event: any) {
    event.preventDefault();
    const dataTransfer: DataTransfer = event.dataTransfer;
    // Checked first, and it is only a `Set` lookup over the two entries an
    // internal drag carries — this runs on every pointer move of a drag.
    if (checkIsCanvasBackgroundDropDataTransfer(dataTransfer)) {
        event.currentTarget.style.opacity = '0.5';
        return;
    }
    const itemList = Array.from(dataTransfer.items);
    // `length > 0` because `every` on an empty list is vacuously true — a drag
    // carrying nothing droppable must not claim to accept it.
    if (
        itemList.length > 0 &&
        itemList.every((item) => {
            return checkIsSupportCanvasMediaType(item.type);
        })
    ) {
        event.currentTarget.style.opacity = '0.5';
    }
}

// Which box the cursor was over, or null for bare canvas. `data-app-box-editor-id`
// is on the root of all three box modes, so this beats hit-testing the item
// rectangles: it respects rotation, z-order and `pointer-events` for free.
export function findDroppedCanvasItemId(event: DragEvent) {
    const element =
        event.target instanceof Element
            ? event.target.closest('[data-app-box-editor-id]')
            : null;
    if (element === null) {
        return null;
    }
    const id = parseInt(
        element.getAttribute('data-app-box-editor-id') ?? '',
        10,
    );
    return isNaN(id) ? null : id;
}

export async function handleDropping(
    canvasController: CanvasController,
    event: DragEvent,
) {
    // EVERYTHING is read off the event synchronously and up front: the
    // `DataTransfer` store goes back to protected mode the moment the dispatch
    // ends, and React nulls `currentTarget` after the handler returns. Nothing
    // below may reach for `event` after the first `await`.
    const droppedData = extractDropData(event);
    const targetCanvasItemId = findDroppedCanvasItemId(event);
    const canvasElement = event.currentTarget as HTMLElement | null;
    // Measured against the CANVAS, not `event.target` — a drop that lands on a
    // box would otherwise take that box's top-left as the origin and put the
    // new item somewhere else entirely.
    const positionEvent = {
        clientX: event.clientX,
        clientY: event.clientY,
        target: canvasElement,
    };
    // `dragleave` does not fire on a drop, so the canvas keeps the accept dim
    // forever unless it is cleared here — and it has to be cleared off
    // `currentTarget`, which is what `dragOverHandling` dimmed.
    if (canvasElement !== null) {
        canvasElement.style.opacity = '1';
    }
    if (droppedData !== null) {
        // An internal drag carries no `kind: 'file'` items, so the loop below
        // would be a no-op anyway. An unsupported one stays silent, as before.
        const plan = planCanvasBackgroundDrop(droppedData);
        if (plan !== null) {
            await applyCanvasBackgroundDropPlan(
                canvasController,
                plan,
                positionEvent,
                targetCanvasItemId,
            );
        }
        return;
    }
    for await (const file of readDroppedFiles(event)) {
        if (checkIsSupportCanvasMediaType(file.type)) {
            const newCanvasItem =
                await canvasController.genNewMediaItemFromFile(
                    file,
                    positionEvent,
                );
            if (newCanvasItem) {
                canvasController.addNewItems([newCanvasItem]);
            }
        } else {
            showSimpleToast(
                tran('Insert Image, Video or Audio'),
                tran('Unsupported file type!'),
            );
        }
    }
}

export async function openCanvasContextMenu(
    canvasController: CanvasController,
    event: any,
    stopAllModes: () => void,
) {
    (event.target as HTMLDivElement).focus();
    stopAllModes();
    showCanvasContextMenu(event, canvasController);
}

export function clampToCanvasPoint(
    clientX: number,
    clientY: number,
    bcr: { left: number; top: number },
    scale: number,
    width: number,
    height: number,
) {
    const x = Math.max(0, Math.min(width, (clientX - bcr.left) / scale));
    const y = Math.max(0, Math.min(height, (clientY - bcr.top) / scale));
    return { x, y };
}

export function scrollToCenter(
    parentElement: HTMLDivElement,
    actualWidth: number,
    actualHeight: number,
) {
    parentElement.scrollTop =
        (actualHeight * 5 - parentElement.clientHeight) / 2;
    parentElement.scrollLeft =
        (actualWidth * 5 - parentElement.clientWidth) / 2;
}
