import type { DragEvent } from 'react';

import { BoxEditorComp } from './box/BoxEditorComp';
import { showCanvasContextMenu } from './canvasContextMenuHelpers';
import type CanvasController from './CanvasController';
import {
    defaultRangeSize,
    useCanvasControllerContext,
} from './CanvasController';
import { useSlideCanvasScale } from './canvasEventHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import {
    CanvasItemContext,
    useCanvasItemsContext,
    useSelectedCanvasItemsAndSetterContext,
    useStopAllModes,
} from './CanvasItem';
import SlideEditorCanvasScalingComp from './tools/SlideEditorCanvasScalingComp';
import { handleCtrlWheel } from '../../others/AppRangeComp';
import { changeDragEventStyle } from '../../helper/helpers';
import { readDroppedFiles } from '../../others/droppingFileHelpers';
import { checkIsSupportMediaType } from './canvasHelpers';
import { onCanvasKeyboardEvent } from '../slideEditingBeyboardEventHelpers';
import { tran } from '../../lang/langHelpers';

function dragOverHandling(event: any) {
    event.preventDefault();
    const items: DataTransferItemList = event.dataTransfer.items;
    if (
        Array.from(items).every((item) => {
            return checkIsSupportMediaType(item.type);
        })
    ) {
        event.currentTarget.style.opacity = '0.5';
    }
}

async function handleDropping(
    canvasController: CanvasController,
    event: DragEvent,
) {
    changeDragEventStyle(event, 'opacity', '1');
    for await (const file of readDroppedFiles(event)) {
        if (checkIsSupportMediaType(file.type)) {
            canvasController
                .genNewImageItemFromFile(file, event)
                .then((newCanvasItem) => {
                    if (!newCanvasItem) {
                        return;
                    }
                    canvasController.addNewItems([newCanvasItem]);
                });
        } else {
            showSimpleToast(
                tran('Insert Image or Video'),
                tran('Unsupported file type!'),
            );
        }
    }
}

async function handleContextMenuOpening(
    canvasController: CanvasController,
    event: any,
    stopAllModes: () => void,
) {
    (event.target as HTMLDivElement).focus();
    stopAllModes();
    showCanvasContextMenu(event, canvasController);
}

function BodyRendererComp() {
    const canvasController = useCanvasControllerContext();
    const { canvas } = canvasController;
    const canvasItems = useCanvasItemsContext();
    const stopAllModes = useStopAllModes();
    return (
        <div
            className="editor app-blank-bg app-border-white-round"
            style={{
                width: `${canvas.width}px`,
                height: `${canvas.height}px`,
                transform: 'translate(-50%, -50%)',
            }}
            onDragOver={dragOverHandling}
            onDragLeave={(event) => {
                event.preventDefault();
                event.currentTarget.style.opacity = '1';
            }}
            onDrop={(event) => {
                event.preventDefault();
                handleDropping(canvasController, event);
            }}
            onContextMenu={(event) => {
                event.preventDefault();
                handleContextMenuOpening(canvasController, event, stopAllModes);
            }}
            // import onclick by mouse down/up
            onMouseDown={(event) => {
                event.stopPropagation();
                (event.target as HTMLDivElement).dataset.mouseDown =
                    JSON.stringify({
                        time: Date.now(),
                        x: event.clientX,
                        y: event.clientY,
                    });
            }}
            onMouseUp={(event) => {
                if (event.target instanceof HTMLTextAreaElement) {
                    return;
                }
                const dataset = (event.target as HTMLDivElement).dataset;
                if (dataset.mouseDown) {
                    const mouseDown = JSON.parse(dataset.mouseDown);
                    const timeDiff = Date.now() - mouseDown.time;
                    const distance = Math.sqrt(
                        Math.pow(event.clientX - mouseDown.x, 2) +
                            Math.pow(event.clientY - mouseDown.y, 2),
                    );
                    if (timeDiff < 500 && distance < 10) {
                        stopAllModes();
                    }
                }
                dataset.mouseDown = '';
            }}
        >
            {canvasItems.map((canvasItem) => {
                return (
                    <CanvasItemContext key={canvasItem.id} value={canvasItem}>
                        <BoxEditorComp />
                    </CanvasItemContext>
                );
            })}
        </div>
    );
}

export default function SlideEditorCanvasComp() {
    const canvasController = useCanvasControllerContext();
    const { canvasItems: selectedCanvasItems } =
        useSelectedCanvasItemsAndSetterContext();
    const stopAllModes = useStopAllModes();
    const { canvas } = canvasController;
    const scale = useSlideCanvasScale();
    return (
        <div className="card w-100 h-100">
            <div
                className="card-body editor-container app-focusable"
                tabIndex={0}
                onWheel={(event) => {
                    event.stopPropagation();
                    handleCtrlWheel({
                        event,
                        value: canvasController.scale * 10,
                        setValue: (scale) => {
                            canvasController.scale = scale / 10;
                        },
                        defaultSize: defaultRangeSize,
                    });
                }}
                onKeyDown={(event) => {
                    if (document.activeElement !== event.currentTarget) {
                        return;
                    }
                    onCanvasKeyboardEvent(
                        {
                            stopAllModes,
                            canvasController,
                            selectedCanvasItems,
                        },
                        event,
                    );
                }}
            >
                <div
                    className="app-overflow-hidden"
                    style={{
                        width: `${Math.round(canvas.width * scale + 20)}px`,
                        height: `${Math.round(canvas.height * scale + 20)}px`,
                    }}
                >
                    <div
                        className="w-100 h-100"
                        style={{
                            transform:
                                `scale(${scale.toFixed(2)}) ` +
                                'translate(50%, 50%)',
                        }}
                    >
                        <BodyRendererComp />
                    </div>
                </div>
            </div>
            <div className="card-footer">
                <SlideEditorCanvasScalingComp />
            </div>
        </div>
    );
}
