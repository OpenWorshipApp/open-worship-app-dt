import SlideEditorToolTitleComp from './SlideEditorToolTitleComp';
import SlideEditorToolAlignComp from './SlideEditorToolAlignComp';
import { useCanvasControllerContext } from '../CanvasController';
import {
    useCanvasItemContext,
    useCanvasItemPropsSetterContext,
} from '../CanvasItem';
import SlideEditorToolsColorComp from './SlideEditorToolsColorComp';
import ShapePropertiesComp from './ShapePropertiesComp';

function SizingComp() {
    const canvasController = useCanvasControllerContext();
    const canvasItem = useCanvasItemContext();
    return (
        <SlideEditorToolTitleComp title="Size">
            <button
                className="btn btn-secondary"
                title="Fit to canvas"
                onClick={() => {
                    canvasController.applyCanvasItemFully(canvasItem);
                }}
            >
                Full
            </button>
            <button
                className="btn btn-secondary m-1"
                title="Set to original size"
                onClick={() => {
                    canvasController.applyCanvasItemOriginal(canvasItem);
                }}
            >
                Original Size
            </button>
            {['image', 'video'].includes(canvasItem.type) ? (
                <button
                    className="btn btn-secondary"
                    onClick={() => {
                        canvasController.applyCanvasItemMediaStrip(canvasItem);
                    }}
                >
                    Strip
                </button>
            ) : null}
        </SlideEditorToolTitleComp>
    );
}

function LayerComp() {
    const canvasController = useCanvasControllerContext();
    const canvasItem = useCanvasItemContext();
    const [_, setProps] = useCanvasItemPropsSetterContext();
    return (
        <div className="ps-2">
            <div className="d-flex">
                <SlideEditorToolTitleComp title="Box Layer">
                    <button
                        className="btn btn-outline-info"
                        onClick={() => {
                            canvasController.applyOrderingData(
                                canvasItem,
                                true,
                            );
                        }}
                    >
                        <i className="bi bi-layer-backward" />
                    </button>
                    <button
                        className="btn btn-outline-info"
                        onClick={() => {
                            canvasController.applyOrderingData(
                                canvasItem,
                                false,
                            );
                        }}
                    >
                        <i className="bi bi-layer-forward" />
                    </button>
                </SlideEditorToolTitleComp>
                <SlideEditorToolTitleComp title="Rotate">
                    <button
                        className="btn btn-outline-info"
                        onClick={() => {
                            setProps({
                                rotate: 0,
                            });
                        }}
                    >
                        `Reset Rotate
                    </button>
                </SlideEditorToolTitleComp>
            </div>
        </div>
    );
}

export default function SlideEditorToolsBoxComp() {
    const [props, setProps] = useCanvasItemPropsSetterContext();
    return (
        <div className="d-flex flex-wrap app-inner-shadow">
            <div className="p-1">
                <SlideEditorToolTitleComp title="Background Color">
                    <SlideEditorToolsColorComp
                        color={props.backgroundColor}
                        handleNoColoring={() => {
                            setProps({
                                backgroundColor: '#00000000',
                            });
                        }}
                        handleColorChanging={(newColor) => {
                            setProps({
                                backgroundColor: newColor,
                            });
                        }}
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
