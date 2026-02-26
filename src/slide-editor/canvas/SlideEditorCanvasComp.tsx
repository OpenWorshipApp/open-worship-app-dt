import { useMemo, type DragEvent } from 'react';

import { BoxEditorComp } from './box/BoxEditorComp';
import { showCanvasContextMenu } from './canvasContextMenuHelpers';
import type CanvasController from './CanvasController';
import {
    defaultRangeSize,
    useCanvasControllerContext,
} from './CanvasController';
import { useSlideCanvasScale } from './canvasEventHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import { CanvasItemContext, useCanvasItemsContext } from './CanvasItem';
import SlideEditorCanvasScalingComp from './tools/SlideEditorCanvasScalingComp';
import { handleCtrlWheel } from '../../others/AppRangeComp';
import { changeDragEventStyle } from '../../helper/helpers';
import { readDroppedFiles } from '../../others/droppingFileHelpers';
import { checkIsSupportMediaType } from './canvasHelpers';
import { onCanvasKeyboardEvent } from '../slideEditingBeyboardEventHelpers';
import { tran } from '../../lang/langHelpers';
import { MultiContextRender } from '../../helper/MultiContextRender';
import { useEditingCanvasContextValue } from '../canvasEditingHelpers';
import ShadowingFillParentWidthComp from '../../others/ShadowingFillParentWidthComp';
import { getSlideItemShadowingStyle } from '../../app-document-presenter/items/slideItemRenderHelpers';
import { genBoxEditorStyle } from './box/boxEditorHelpers';

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

function BodyRendererComp({
    stopAllModes,
}: Readonly<{ stopAllModes: () => void }>) {
    const canvasController = useCanvasControllerContext();
    const { canvas } = canvasController;
    const canvasItems = useCanvasItemsContext();
    return (
        <div
            className="slide-canvas-editor shadow-blank-bg app-border-white-round"
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

export default function SlideEditorCanvasComp({
    contextData,
}: Readonly<{ contextData: ReturnType<typeof useEditingCanvasContextValue> }>) {
    const {
        contextValue: allCanvasContextValue,
        selectedCanvasItems,
        canvasController,
        stopAllModes,
    } = contextData;
    const scale = useSlideCanvasScale(canvasController);
    const { canvas } = canvasController;
    const { actualWidth, actualHeight, scaleStr } = useMemo(() => {
        const actualWidth = Math.round(canvas.width * scale + 20);
        const actualHeight = Math.round(canvas.height * scale + 20);
        const scaleStr = scale.toFixed(2);
        return { actualWidth, actualHeight, scaleStr };
    }, [canvas.width, canvas.height, scale]);
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
                    style={{
                        width: `${actualWidth}px`,
                        height: `${actualHeight}px`,
                    }}
                >
                    <div
                        style={{
                            width: `${actualWidth}px`,
                            height: `${actualHeight}px`,
                            transform:
                                `scale(${scaleStr}) ` + 'translate(50%, 50%)',
                        }}
                    >
                        <ShadowingFillParentWidthComp>
                            <MultiContextRender
                                contexts={allCanvasContextValue}
                            >
                                {genBoxEditorStyle()}
                                {getSlideItemShadowingStyle()}
                                <BodyRendererComp stopAllModes={stopAllModes} />
                            </MultiContextRender>
                        </ShadowingFillParentWidthComp>
                    </div>
                </div>
            </div>
            <div className="card-footer">
                <MultiContextRender contexts={allCanvasContextValue}>
                    <SlideEditorCanvasScalingComp />
                </MultiContextRender>
            </div>
        </div>
    );
}
