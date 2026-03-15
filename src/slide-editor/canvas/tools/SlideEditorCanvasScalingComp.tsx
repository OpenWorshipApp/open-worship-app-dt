import { useCallback } from 'react';

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
    const handleCenterView = useCallback(() => {
        canvasController.toCenterView();
    }, [canvasController]);
    const handleScaleChange = useCallback(
        (newScale: number) => {
            canvasController.scale = newScale / 10;
        },
        [canvasController],
    );
    return (
        <div className={'align-self-end flex-fill d-flex justify-content-end'}>
            <div className="px-2">
                <i
                    className="bi bi-border-middle app-caught-hover-pointer"
                    onClick={handleCenterView}
                />
            </div>
            <div className="canvas-board-size-container d-flex ps-1">
                <span>{actualScale.toFixed(1)}x</span>
                <div style={{ maxWidth: '200px' }}>
                    <AppRangeComp
                        value={actualScale}
                        title="Canvas Scale"
                        setValue={handleScaleChange}
                        defaultSize={defaultRangeSize}
                    />
                </div>
            </div>
        </div>
    );
}
