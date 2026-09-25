import { DragTypeEnum } from '../../helper/DragInf';
import { handleDragStart } from '../../helper/dragHelpers';
import type { AppColorType } from './colorValueHelpers';

export * from './colorValueHelpers';

export function serializeForDragging(event: any, color: AppColorType) {
    handleDragStart(event, {
        dragSerialize: () => {
            return {
                type: DragTypeEnum.BACKGROUND_COLOR,
                data: color,
            };
        },
    });
}
