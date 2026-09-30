import { useCallback } from 'react';

import { tran } from '../../../lang/langHelpers';
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
                {/* A button, not a bare icon: it had no name and could not
                    be reached from the keyboard. */}
                <button
                    type="button"
                    className="btn btn-sm btn-link p-0 text-reset"
                    title={tran('Center view')}
                    aria-label={tran('Center view')}
                    onClick={handleCenterView}
                >
                    <i className="bi bi-border-middle" />
                </button>
            </div>
            <div className="canvas-board-size-container d-flex">
                {/* The zoom as a percentage. The slider works in tenths, and
                    printing that as "5.0x" read as five times the size while
                    the slide was drawn at half. */}
                <span title={tran('Canvas Scale')}>
                    {Math.round(scale * 100)}%
                </span>
                <div style={{ maxWidth: '200px' }}>
                    <AppRangeComp
                        value={actualScale}
                        title={tran('Canvas Scale')}
                        setValue={handleScaleChange}
                        defaultSize={defaultRangeSize}
                    />
                </div>
            </div>
        </div>
    );
}
