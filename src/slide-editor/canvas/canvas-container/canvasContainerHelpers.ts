import type { DragEvent } from 'react';

import { showCanvasContextMenu } from '../canvasContextMenuHelpers';
import type CanvasController from '../CanvasController';
import { showSimpleToast } from '../../../toast/toastHelpers';
import { changeDragEventStyle } from '../../../helper/helpers';
import { readDroppedFiles } from '../../../others/droppingFileHelpers';
import { checkIsSupportMediaType } from '../canvasHelpers';
import { tran } from '../../../lang/langHelpers';

export function dragOverHandling(event: any) {
    event.preventDefault();
    const items: DataTransferItemList = event.dataTransfer.items;
    if (
        Array.from(items).every((item) => {
            return checkIsSupportMediaType(item.type);
        })
    ) {
        event.currentTarget.style.opacity = '0.5';
    }
}

export async function handleDropping(
    canvasController: CanvasController,
    event: DragEvent,
) {
    changeDragEventStyle(event, 'opacity', '1');
    for await (const file of readDroppedFiles(event)) {
        if (checkIsSupportMediaType(file.type)) {
            const newCanvasItem =
                await canvasController.genNewMediaItemFromFile(file, event);
            if (newCanvasItem) {
                canvasController.addNewItems([newCanvasItem]);
            }
        } else {
            showSimpleToast(
                tran('Insert Image or Video'),
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
