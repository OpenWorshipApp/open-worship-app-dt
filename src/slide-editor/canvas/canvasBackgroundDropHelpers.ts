import type { DroppedDataType } from '../../helper/DragInf';
import { DragTypeEnum, genDragMimeType } from '../../helper/DragInf';
import type { AppColorType } from '../../others/color/colorHelpers';
import { checkIsYouTubeUrl } from './youtubeUrlHelpers';
import type CanvasController from './CanvasController';
import { getAllCameraDevices } from '../../helper/cameraHelpers';

/**
 * Dropping a Background-panel item onto the slide canvas.
 *
 * Every item in that panel is already draggable — that is how a background
 * reaches a screen or gets attached to a slide. This turns the same drag into
 * a CANVAS ITEM instead, so an operator can build a slide by dragging rather
 * than walking the Insert menu.
 *
 * Split into a pure `planCanvasBackgroundDrop` (payload -> what to insert) and
 * an impure applier, so the whole mapping table is testable without a DOM, a
 * controller or a single mock.
 */

// The drag kinds the canvas knows how to turn into an item. Everything else
// (bible items, slides, documents, foregrounds) keeps falling through as a
// silent no-op, exactly as before.
export const canvasBackgroundDropTypeList = [
    DragTypeEnum.BACKGROUND_IMAGE,
    DragTypeEnum.BACKGROUND_VIDEO,
    DragTypeEnum.BACKGROUND_AUDIO,
    DragTypeEnum.BACKGROUND_WEB,
    DragTypeEnum.BACKGROUND_CAMERA,
    DragTypeEnum.BACKGROUND_COLOR,
];

// Precomputed once: `dragOverHandling` runs on every pointer move over the
// canvas during a drag, so the hover check must cost a `Set` lookup, nothing
// more — no parsing, no allocation of the mapping itself.
export const canvasBackgroundDropMimeTypeSet = new Set(
    canvasBackgroundDropTypeList.map(genDragMimeType),
);

export function checkIsCanvasBackgroundDropDataTransfer(
    dataTransfer: DataTransfer | null,
) {
    if (dataTransfer === null) {
        return false;
    }
    for (const mimeType of dataTransfer.types) {
        if (canvasBackgroundDropMimeTypeSet.has(mimeType)) {
            return true;
        }
    }
    return false;
}

export type CanvasBackgroundDropPlanType =
    | { kind: 'media'; filePath: string }
    | { kind: 'youtube'; url: string }
    | { kind: 'website'; url: string }
    | { kind: 'camera'; deviceId: string }
    | { kind: 'color'; color: AppColorType };

export function planCanvasBackgroundDrop({
    type,
    item,
}: DroppedDataType): CanvasBackgroundDropPlanType | null {
    if (
        type === DragTypeEnum.BACKGROUND_IMAGE ||
        type === DragTypeEnum.BACKGROUND_VIDEO ||
        type === DragTypeEnum.BACKGROUND_AUDIO
    ) {
        // A `FileSource`; which of the three item kinds it becomes is decided
        // downstream from the file's own mimetype, not from the drag type.
        return { kind: 'media', filePath: item.filePath };
    }
    if (type === DragTypeEnum.BACKGROUND_WEB) {
        // Either a `FileSource` for a local html file — whose `src` is its
        // `file://` URL, the very thing the screen's web background feeds to an
        // iframe — or a `BackgroundWebUrlSource`, which is the only one of the
        // two that sets `isUrl`.
        const url: string = item.src;
        if (item.isUrl === true && checkIsYouTubeUrl(url)) {
            return { kind: 'youtube', url };
        }
        return { kind: 'website', url };
    }
    if (type === DragTypeEnum.BACKGROUND_CAMERA) {
        return { kind: 'camera', deviceId: item.src };
    }
    if (type === DragTypeEnum.BACKGROUND_COLOR) {
        // Unlike the others, the deserialized item IS the value.
        return { kind: 'color', color: item };
    }
    return null;
}

// `getInsertPosition` only ever reads these three, but it reads them off
// whatever it is handed — so a synthesized one lets the caller choose the
// element the cursor is measured against.
export type InsertPositionEventType = {
    clientX: number;
    clientY: number;
    target: EventTarget | null;
};

export async function applyCanvasBackgroundDropPlan(
    canvasController: CanvasController,
    plan: CanvasBackgroundDropPlanType,
    positionEvent: InsertPositionEventType,
    targetCanvasItemId: number | null,
) {
    if (plan.kind === 'color') {
        if (targetCanvasItemId !== null) {
            // Dropped ON a box: recolor it instead of covering it. Same call
            // the Box tools' color picker ends up making, so it commits as one
            // edit and repaints the box live.
            canvasController.editCanvasItemById(
                targetCanvasItemId,
                (canvasItem) => {
                    canvasItem.applyProps({ backgroundColor: plan.color });
                },
            );
            return;
        }
        const newCanvasItem = canvasController.genNewColorBoxItem(
            plan.color,
            positionEvent,
        );
        if (newCanvasItem) {
            canvasController.addNewItems([newCanvasItem]);
        }
        return;
    }
    let newCanvasItem;
    if (plan.kind === 'media') {
        // Toasts for an unsupported or unreadable file on its own.
        newCanvasItem = await canvasController.genNewMediaItemFromFilePath(
            plan.filePath,
            positionEvent,
        );
    } else if (plan.kind === 'youtube') {
        newCanvasItem = canvasController.genNewYouTubeItem(
            plan.url,
            positionEvent,
        );
    } else if (plan.kind === 'website') {
        newCanvasItem = canvasController.genNewWebsiteItem(
            plan.url,
            positionEvent,
        );
    } else {
        // The drag carries only the device id, but the item also stores a
        // label — that label is what `resolveCameraDeviceId` falls back to
        // after Chromium rotates device ids between sessions, so an item
        // created without one silently dies on reopen. Enumerating is a
        // one-off cost paid HERE, on drop, never during the hover.
        const cameraList = await getAllCameraDevices();
        const label =
            cameraList.find((camera) => {
                return camera.deviceId === plan.deviceId;
            })?.label ?? '';
        newCanvasItem = canvasController.genNewCameraItem(
            { deviceId: plan.deviceId, label },
            positionEvent,
        );
    }
    if (newCanvasItem) {
        canvasController.addNewItems([newCanvasItem]);
    }
}
