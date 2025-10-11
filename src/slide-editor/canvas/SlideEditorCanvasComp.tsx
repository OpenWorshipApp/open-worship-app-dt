import { DragEvent } from 'react';

import { BoxEditorComp } from './box/BoxEditorComp';
import { useKeyboardRegistering } from '../../event/KeyboardEventListener';
import { showCanvasContextMenu } from './canvasContextMenuHelpers';
import { isSupportedMimetype } from '../../server/fileHelpers';
import {
    defaultRangeSize,
    useCanvasControllerContext,
} from './CanvasController';
import { useSlideCanvasScale } from './canvasEventHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import {
    CanvasItemContext,
    useCanvasItemsContext,
    useStopAllModes,
} from './CanvasItem';
import SlideEditorCanvasScalingComp from './tools/SlideEditorCanvasScalingComp';
import { handleCtrlWheel } from '../../others/AppRangeComp';
import { changeDragEventStyle } from '../../helper/helpers';
import { readDroppedFiles } from '../../others/droppingFileHelpers';

function BodyRendererComp() {
    const canvasController = useCanvasControllerContext();
    const { canvas } = canvasController;
    const canvasItems = useCanvasItemsContext();
    const stopAllModes = useStopAllModes();
    const isSupportType = (fileType: string) => {
        return (
            isSupportedMimetype(fileType, 'image') ||
            isSupportedMimetype(fileType, 'video')
        );
    };
    const dragOverHandling = (event: any) => {
        event.preventDefault();
        const items: DataTransferItemList = event.dataTransfer.items;
        if (
            Array.from(items).every((item) => {
                return isSupportType(item.type);
            })
        ) {
            event.currentTarget.style.opacity = '0.5';
        }
    };
    const handleDropping = async (event: DragEvent) => {
        event.preventDefault();
        changeDragEventStyle(event, 'opacity', '1');
        for await (const file of readDroppedFiles(event)) {
            if (!isSupportType(file.type)) {
                showSimpleToast(
                    'Insert Image or Video',
                    'Unsupported file type!',
                );
            } else {
                canvasController
                    .genNewImageItemFromBlob(file, event)
                    .then((newCanvasItem) => {
                        if (!newCanvasItem) {
                            return;
                        }
                        canvasController.addNewItem(newCanvasItem);
                    });
            }
        }
    };
    const handleContextMenuOpening = async (event: any) => {
        event.preventDefault();
        (event.target as HTMLDivElement).focus();
        stopAllModes();
        showCanvasContextMenu(event, canvasController);
    };
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
            onDrop={handleDropping}
            onContextMenu={handleContextMenuOpening}
            // import onclick by mouse down/up
            onMouseDown={(event) => {
                event.stopPropagation();
                (event.target as HTMLDivElement).dataset.mouseDown =
                    JSON.stringify({
                        time: new Date().getTime(),
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
                    const timeDiff = new Date().getTime() - mouseDown.time;
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
    const stopAllModes = useStopAllModes();
    const { canvas } = canvasController;
    const scale = useSlideCanvasScale();
    useKeyboardRegistering([{ key: 'Escape' }], stopAllModes, []);
    return (
        <div className="card w-100 h-100">
            <div
                className="card-body editor-container"
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
