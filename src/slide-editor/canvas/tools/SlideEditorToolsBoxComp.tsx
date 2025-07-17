import SlideEditorToolTitleComp from './SlideEditorToolTitleComp';
import SlideEditorToolAlignComp from './SlideEditorToolAlignComp';
import { useCanvasControllerContext } from '../CanvasController';
import { ToolingBoxType } from '../canvasHelpers';
import { useCanvasItemContext } from '../CanvasItem';
import { AppColorType } from '../../../others/color/colorHelpers';
import SlideEditorToolsColorComp from './SlideEditorToolsColorComp';

function SizingComp() {
    const canvasController = useCanvasControllerContext();
    const canvasItem = useCanvasItemContext();
    return (
        <SlideEditorToolTitleComp title="Size">
            <button
                className="btn btn-secondary"
                onClick={() => {
                    canvasController.applyCanvasItemFully(canvasItem);
                }}
            >
                Full
            </button>
            {['image', 'video'].includes(canvasItem.type) ? (
                <button
                    className="btn btn-secondary ms-1"
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
    const parentDimension = {
        parentWidth: canvasController.canvas.width,
        parentHeight: canvasController.canvas.height,
    };
    const applyBoxData = (newData: ToolingBoxType) => {
        canvasItem.applyBoxData(parentDimension, newData);
        canvasController.applyEditItem(canvasItem);
    };
    return (
        <div className="ps-2">
            <div className="d-flex">
                <SlideEditorToolTitleComp title="Box Layer">
                    <button
                        className="btn btn-info"
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
                        className="btn btn-info"
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
                        className="btn btn-info"
                        onClick={() => {
                            applyBoxData({
                                rotate: 0,
                            });
                        }}
                    >
                        UnRotate
                    </button>
                </SlideEditorToolTitleComp>
            </div>
        </div>
    );
}

export default function SlideEditorToolsBoxComp() {
    const canvasController = useCanvasControllerContext();
    const canvasItem = useCanvasItemContext();
    const handleDataEvent = (newData: any) => {
        applyBoxData(newData);
    };
    const handleNoColoring = () => {
        applyBoxData({
            backgroundColor: null,
        });
    };
    const handleColorChanging = (newColor: AppColorType) => {
        applyBoxData({
            backgroundColor: newColor,
        });
    };
    const parentDimension = {
        parentWidth: canvasController.canvas.width,
        parentHeight: canvasController.canvas.height,
    };
    const applyBoxData = (newData: ToolingBoxType) => {
        canvasItem.applyBoxData(parentDimension, newData);
        canvasController.applyEditItem(canvasItem);
    };
    return (
        <div className="d-flex flex-wrap app-inner-shadow">
            <SlideEditorToolsColorComp
                color={canvasItem.props.backgroundColor}
                handleNoColoring={handleNoColoring}
                handleColorChanging={handleColorChanging}
            />
            <div
                className="ps-1"
                style={{
                    minWidth: '300px',
                }}
            >
                <SlideEditorToolTitleComp title="Box Alignment">
                    <SlideEditorToolAlignComp onData={handleDataEvent} />
                </SlideEditorToolTitleComp>
                <LayerComp />
                <SizingComp />
            </div>
        </div>
    );
}
