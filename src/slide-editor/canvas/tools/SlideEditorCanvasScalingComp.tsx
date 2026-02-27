import {
    defaultRangeSize,
    useCanvasControllerContext,
} from '../CanvasController';
import { useSlideCanvasScale } from '../canvasEventHelpers';
import AppRangeComp from '../../../others/AppRangeComp';

export default function SlideEditorCanvasScalingComp() {
    const canvasController = useCanvasControllerContext();
    const scale = useSlideCanvasScale(canvasController);
    const actualScale = scale * 10;
    return (
        <div className={'align-self-end flex-fill d-flex justify-content-end'}>
            <div className="px-2">
                <i
                    className="bi bi-border-middle app-caught-hover-pointer"
                    onClick={() => {
                        canvasController.toCenterView();
                    }}
                />
            </div>
            <div className="canvas-board-size-container d-flex ps-1">
                <span>{actualScale.toFixed(1)}x</span>
                <div style={{ maxWidth: '200px' }}>
                    <AppRangeComp
                        value={actualScale}
                        title="Canvas Scale"
                        setValue={(scale) => {
                            canvasController.scale = scale / 10;
                        }}
                        defaultSize={defaultRangeSize}
                    />
                </div>
            </div>
        </div>
    );
}
