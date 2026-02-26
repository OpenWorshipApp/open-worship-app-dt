import BoxEditorNormalModeComp from './BoxEditorNormalModeComp';
import BoxEditorControllingModeComp from './BoxEditorControllingModeComp';
import { useSlideCanvasScale } from '../canvasEventHelpers';
import BoxEditorController, {
    BoxEditorControllerContext,
} from '../../BoxEditorController';
import { useIsCanvasItemSelected } from '../CanvasItem';
import { useCanvasControllerContext } from '../CanvasController';

export function BoxEditorComp() {
    const canvasController = useCanvasControllerContext();
    const scale = useSlideCanvasScale(canvasController);
    const boxEditorController = new BoxEditorController(scale);
    const isSelected = useIsCanvasItemSelected();
    // TODO: switch box by tab, shift
    // TODO: key => ctl+d, delete, copy&paste, paste across slide
    // TODO: ruler, snap
    // TODO: ctrl|alt resize => anchor center base

    if (isSelected) {
        return (
            <BoxEditorControllerContext value={boxEditorController}>
                <BoxEditorControllingModeComp />
            </BoxEditorControllerContext>
        );
    }
    return <BoxEditorNormalModeComp />;
}
