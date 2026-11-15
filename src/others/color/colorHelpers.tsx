import { DragTypeEnum } from '../../helper/DragInf';
import { handleDragStart } from '../../helper/dragHelpers';
import type { AppColorType } from './colorValueHelpers';

export * from './colorValueHelpers';

/** A colour -- or any fill (`fillValueHelpers`) -- dragged as a background. */
export function serializeForDragging(
    event: any,
    fillSrc: AppColorType | string,
) {
    handleDragStart(event, {
        dragSerialize: () => {
            return {
                type: DragTypeEnum.BACKGROUND_FILL,
                data: fillSrc,
            };
        },
    });
}
