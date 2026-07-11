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
import BoxPositionSizeComp from './BoxPositionSizeComp';
import { HEX_COLOR_BLACK } from '../../../others/color/colorHelpers';
import { useAppCurrentRef } from '../../../helper/appHooks';
import { checkIsMediaCanvasItemType } from '../canvasHelpers';

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
        <SlideEditorToolTitleComp title="Size" isInline>
            <div
                className="btn-group btn-group-sm"
                role="group"
                aria-label={tran('Size')}
            >
                <button
                    className="btn btn-sm btn-outline-secondary"
                    title="Fit to canvas"
                    onClick={() => {
                        return handleSizing('full');
                    }}
                >
                    {tran('Full')}
                </button>
                <button
                    className="btn btn-sm btn-outline-secondary"
                    title="Set to original size"
                    onClick={() => {
                        return handleSizing('original');
                    }}
                >
                    {tran('Original Size')}
                </button>
                {checkIsMediaCanvasItemType(canvasItem.type) ? (
                    <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => {
                            return handleSizing('strip');
                        }}
                    >
                        {tran('Strip')}
                    </button>
                ) : null}
            </div>
        </SlideEditorToolTitleComp>
    );
}

function LayerComp() {
    const canvasController = useCanvasControllerContext();
    const canvasItem = useCanvasItemContext();
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
    return (
        <SlideEditorToolTitleComp title="Box Layer" isInline>
            <div
                className="btn-group btn-group-sm"
                role="group"
                aria-label={tran('Box Layer')}
            >
                <button
                    className="btn btn-sm btn-outline-info"
                    title={tran('Send backward')}
                    aria-label={tran('Send backward')}
                    onClick={handleLayerBackward}
                >
                    <i className="bi bi-layer-backward" />
                </button>
                <button
                    className="btn btn-sm btn-outline-info"
                    title={tran('Bring forward')}
                    aria-label={tran('Bring forward')}
                    onClick={handleLayerForward}
                >
                    <i className="bi bi-layer-forward" />
                </button>
            </div>
        </SlideEditorToolTitleComp>
    );
}

export default function SlideEditorToolsBoxComp() {
    const [props, setProps] = useCanvasItemPropsSetterContext();
    const canvasItem = useCanvasItemContext();
    const setPropsRef = useAppCurrentRef(setProps);
    const handleNoColoring = useCallback(() => {
        setPropsRef.current({ backgroundColor: `${HEX_COLOR_BLACK}00` });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleColorChanging = useCallback((newColor: string) => {
        setPropsRef.current({ backgroundColor: newColor });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Media items always fill their box, so their background color is
    // never actually visible — the control would just be confusing.
    const canShowBackgroundColor = !checkIsMediaCanvasItemType(canvasItem.type);
    return (
        <div
            className="app-inner-shadow ps-1"
            style={{
                minWidth: '300px',
            }}
        >
            {canShowBackgroundColor ? (
                <SlideEditorToolTitleComp title="Background Color" isInline>
                    <SlideEditorToolsColorComp
                        color={props.backgroundColor}
                        handleNoColoring={handleNoColoring}
                        handleColorChanging={handleColorChanging}
                    />
                </SlideEditorToolTitleComp>
            ) : null}
            <SlideEditorToolTitleComp title="Position & Size">
                <BoxPositionSizeComp />
            </SlideEditorToolTitleComp>
            <SlideEditorToolTitleComp title="Box Alignment" isInline>
                <SlideEditorToolAlignComp onData={setProps} />
            </SlideEditorToolTitleComp>
            <SlideEditorToolTitleComp title="Shape Properties">
                <ShapePropertiesComp />
            </SlideEditorToolTitleComp>
            <div className="d-flex flex-wrap column-gap-3">
                <LayerComp />
                <SizingComp />
            </div>
        </div>
    );
}
