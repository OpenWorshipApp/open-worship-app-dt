import { useCallback } from 'react';

import {
    defaultRangeSize,
    useCanvasControllerContext,
} from '../CanvasController';
import { useSlideCanvasScale } from '../canvasEventHelpers';
import AppRangeComp from '../../../others/AppRangeComp';
import { useAppCurrentRef } from '../../../helper/appHooks';

export default function SlideEditorCanvasScalingComp() {
    const canvasController = useCanvasControllerContext();
    const scale = useSlideCanvasScale(canvasController);
    const actualScale = scale * 10;
    const canvasControllerRef = useAppCurrentRef(canvasController);
    const handleCenterView = useCallback(() => {
        canvasControllerRef.current.toCenterView();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleScaleChange = useCallback((newScale: number) => {
        canvasControllerRef.current.scale = newScale / 10;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div
            className={
                'flex-fill d-flex justify-content-end align-items-center'
            }
        >
            <div className="px-2">
                <i
                    className="bi bi-border-middle app-caught-hover-pointer"
                    onClick={handleCenterView}
                />
            </div>
            <div className="canvas-board-size-container d-flex">
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
