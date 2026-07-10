import BoxEditorNormalModeComp from './BoxEditorNormalModeComp';
import BoxEditorControllingModeComp from './BoxEditorControllingModeComp';
import { useSlideCanvasScale } from '../canvasEventHelpers';
import BoxEditorController, {
    BoxEditorControllerContext,
} from '../../BoxEditorController';
import {
    useCanvasItemContext,
    useIsCanvasItemSelected,
    useSelectedCanvasItemsAndSetterContext,
} from '../CanvasItem';
import { useCanvasControllerContext } from '../CanvasController';
import { useCanvasSnapContext } from '../canvasSnapGuideHelpers';

export function BoxEditorComp() {
    const canvasController = useCanvasControllerContext();
    const scale = useSlideCanvasScale(canvasController);
    const boxEditorController = new BoxEditorController(scale);
    const isSelected = useIsCanvasItemSelected();
    const canvasItem = useCanvasItemContext();
    const snapContext = useCanvasSnapContext();
    const { canvasItems: selectedCanvasItems } =
        useSelectedCanvasItemsAndSetterContext();
    // Locked items stay put even when dragged as part of a multi-selection.
    const selectedIds = selectedCanvasItems
        .filter((item) => {
            return !item.isLocked;
        })
        .map((item) => {
            return item.id;
        });
    boxEditorController.getMoveGroupIds = () => {
        return selectedIds;
    };
    boxEditorController.getSnapTargets = snapContext.getSnapTargets;
    boxEditorController.onSnapping = snapContext.setSnapLines;
    boxEditorController.lockAspectRatio = canvasItem.shouldLockAspectRatio;
    // TODO: switch box by tab, shift
    // TODO: key => ctl+d, delete, copy&paste, paste across slide

    if (isSelected) {
        return (
            <BoxEditorControllerContext value={boxEditorController}>
                <BoxEditorControllingModeComp />
            </BoxEditorControllerContext>
        );
    }
    return <BoxEditorNormalModeComp />;
}
