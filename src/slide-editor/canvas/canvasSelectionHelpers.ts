import type CanvasItem from './CanvasItem';
import { checkCanvasItemsIncludes } from './CanvasItem';

export function checkIsAppendSelectionModifier(
    event: Pick<MouseEvent, 'shiftKey' | 'ctrlKey' | 'metaKey'>,
) {
    return event.shiftKey || event.ctrlKey || event.metaKey;
}

export function mergeCanvasItemSelection(
    currentCanvasItems: CanvasItem<any>[],
    targetCanvasItems: CanvasItem<any>[],
) {
    const merged = [...currentCanvasItems];
    for (const targetCanvasItem of targetCanvasItems) {
        if (!checkCanvasItemsIncludes(merged, targetCanvasItem)) {
            merged.push(targetCanvasItem);
        }
    }
    return merged;
}

export function getCanvasItemsInRect(
    canvasItems: CanvasItem<any>[],
    rect: { minX: number; maxX: number; minY: number; maxY: number },
) {
    const { minX, maxX, minY, maxY } = rect;
    return canvasItems.filter((item) => {
        const { left, top, width, height } = item.props;
        return (
            left < maxX &&
            left + width > minX &&
            top < maxY &&
            top + height > minY
        );
    });
}
