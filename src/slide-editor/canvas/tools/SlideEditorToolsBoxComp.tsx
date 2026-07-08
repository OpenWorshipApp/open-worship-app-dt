import { useCallback } from 'react';

import { tran } from '../../../lang/langHelpers';
import SlideEditorToolTitleComp from './SlideEditorToolTitleComp';
import SlideEditorToolAlignComp from './SlideEditorToolAlignComp';
import { useCanvasControllerContext } from '../CanvasController';
import {
    useCanvasItemContext,
    useCanvasItemPropsSetterContext,
} from '../CanvasItem';
import SlideEditorToolsColorComp from './SlideEditorToolsColorComp';
import ShapePropertiesComp from './ShapePropertiesComp';
import { HEX_COLOR_BLACK } from '../../../others/color/colorHelpers';

function SizingComp() {
    const canvasController = useCanvasControllerContext();
    const canvasItem = useCanvasItemContext();

    const handleSizing = useCallback(
        (kind: 'full' | 'original' | 'strip') => {
            canvasController.editCanvasItemById(canvasItem.id, (item) => {
                if (kind === 'full') {
                    canvasController.applyCanvasItemFully(item);
                } else if (kind === 'original') {
                    canvasController.applyCanvasItemOriginal(item);
                } else {
                    canvasController.applyCanvasItemMediaStrip(item);
                }
            });
        },
        [canvasController, canvasItem.id],
    );

    return (
        <SlideEditorToolTitleComp title="Size">
            <button
                className="btn btn-sm btn-secondary"
                title="Fit to canvas"
                onClick={() => {
                    return handleSizing('full');
                }}
            >
                {tran('Full')}
            </button>
            <button
                className="btn btn-sm btn-secondary m-1"
                title="Set to original size"
                onClick={() => {
                    return handleSizing('original');
                }}
            >
                {tran('Original Size')}
            </button>
            {['image', 'video'].includes(canvasItem.type) ? (
                <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                        return handleSizing('strip');
                    }}
                >
                    {tran('Strip')}
                </button>
            ) : null}
        </SlideEditorToolTitleComp>
    );
}

function LayerComp() {
    const canvasController = useCanvasControllerContext();
    const canvasItem = useCanvasItemContext();
    const [_, setProps] = useCanvasItemPropsSetterContext();
    const handleLayerBackward = useCallback(() => {
        canvasController.applyOrderingData(canvasItem, true);
    }, [canvasController, canvasItem]);
    const handleLayerForward = useCallback(() => {
        canvasController.applyOrderingData(canvasItem, false);
    }, [canvasController, canvasItem]);
    const handleResetRotate = useCallback(() => {
        setProps({ rotate: 0 });
    }, [setProps]);
    return (
        <div className="ps-2">
            <div className="d-flex gap-3">
                <SlideEditorToolTitleComp title="Box Layer">
                    <button
                        className="btn btn-sm btn-outline-info"
                        onClick={handleLayerBackward}
                    >
                        <i className="bi bi-layer-backward" />
                    </button>
                    <button
                        className="btn btn-sm btn-outline-info"
                        onClick={handleLayerForward}
                    >
                        <i className="bi bi-layer-forward" />
                    </button>
                </SlideEditorToolTitleComp>
                <SlideEditorToolTitleComp title="Rotate">
                    <button
                        className="btn btn-sm btn-outline-info"
                        onClick={handleResetRotate}
                    >
                        {tran('Reset Rotate')}
                    </button>
                </SlideEditorToolTitleComp>
            </div>
        </div>
    );
}

export default function SlideEditorToolsBoxComp() {
    const [props, setProps] = useCanvasItemPropsSetterContext();
    const handleNoColoring = useCallback(() => {
        setProps({ backgroundColor: `${HEX_COLOR_BLACK}00` });
    }, [setProps]);
    const handleColorChanging = useCallback(
        (newColor: string) => {
            setProps({ backgroundColor: newColor });
        },
        [setProps],
    );
    return (
        <div className="d-flex flex-wrap app-inner-shadow">
            <div className="p-1">
                <SlideEditorToolTitleComp title="Background Color">
                    <SlideEditorToolsColorComp
                        color={props.backgroundColor}
                        handleNoColoring={handleNoColoring}
                        handleColorChanging={handleColorChanging}
                    />
                </SlideEditorToolTitleComp>
            </div>
            <div
                className="ps-1"
                style={{
                    minWidth: '300px',
                }}
            >
                <SlideEditorToolTitleComp title="Box Alignment">
                    <SlideEditorToolAlignComp onData={setProps} />
                </SlideEditorToolTitleComp>
                <SlideEditorToolTitleComp title="Shape Properties">
                    <ShapePropertiesComp />
                </SlideEditorToolTitleComp>
                <LayerComp />
                <SizingComp />
            </div>
        </div>
    );
}
