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
import { useAppCurrentRef } from '../../../helper/appHooks';

function SizingComp() {
    const canvasController = useCanvasControllerContext();
    const canvasItem = useCanvasItemContext();

    const canvasControllerRef = useAppCurrentRef(canvasController);
    const canvasItemRef = useAppCurrentRef(canvasItem);
    const handleSizing = useCallback((kind: 'full' | 'original' | 'strip') => {
        canvasControllerRef.current.editCanvasItemById(
            canvasItemRef.current.id,
            (item) => {
                if (kind === 'full') {
                    canvasControllerRef.current.applyCanvasItemFully(item);
                } else if (kind === 'original') {
                    canvasControllerRef.current.applyCanvasItemOriginal(item);
                } else {
                    canvasControllerRef.current.applyCanvasItemMediaStrip(item);
                }
            },
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
    const canvasControllerRef = useAppCurrentRef(canvasController);
    const canvasItemRef = useAppCurrentRef(canvasItem);
    const handleLayerBackward = useCallback(() => {
        canvasControllerRef.current.applyOrderingData(
            canvasItemRef.current,
            true,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleLayerForward = useCallback(() => {
        canvasControllerRef.current.applyOrderingData(
            canvasItemRef.current,
            false,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const setPropsRef = useAppCurrentRef(setProps);
    const handleResetRotate = useCallback(() => {
        setPropsRef.current({ rotate: 0 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
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
    const setPropsRef = useAppCurrentRef(setProps);
    const handleNoColoring = useCallback(() => {
        setPropsRef.current({ backgroundColor: `${HEX_COLOR_BLACK}00` });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleColorChanging = useCallback((newColor: string) => {
        setPropsRef.current({ backgroundColor: newColor });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
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
