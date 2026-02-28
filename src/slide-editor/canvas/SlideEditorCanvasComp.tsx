import { useMemo, useRef, type DragEvent } from 'react';

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
import ShadowingFillParentWidthComp, {
    useShadowingParentWidth,
} from '../../others/ShadowingFillParentWidthComp';
import { getSlideItemShadowingStyle } from '../../app-document-presenter/items/slideItemRenderHelpers';
import { genBoxEditorStyle } from './box/boxEditorHelpers';
import { useThemeSource } from '../../others/initHelpers';
import { useAppEffect } from '../../helper/debuggerHelpers';
import SlidesMenuComp from '../../app-document-presenter/items/SlidesMenuComp';
import { VaryAppDocumentContext } from '../../app-document-list/appDocumentHelpers';

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
    const parentWidth = useShadowingParentWidth();
    const canvasController = useCanvasControllerContext();
    const { canvas } = canvasController;
    const scale = useMemo(() => {
        return (parentWidth ?? 0) / canvas.width;
    }, [parentWidth, canvas.width]);
    const canvasItems = useCanvasItemsContext();
    const { theme } = useThemeSource();
    return (
        <div
            className="slide-canvas-editor shadow-blank-bg"
            data-shadow-theme={theme}
            style={{
                width: `${canvas.width}px`,
                height: `${canvas.height}px`,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
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
            // export onclick by mouse down/up
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

function scrollToCenter(
    parentElement: HTMLDivElement,
    actualWidth: number,
    actualHeight: number,
) {
    parentElement.scrollTop =
        (actualHeight * 5 - parentElement.clientHeight) / 2;
    parentElement.scrollLeft =
        (actualWidth * 5 - parentElement.clientWidth) / 2;
}

export default function SlideEditorCanvasComp({
    contextData,
}: Readonly<{ contextData: ReturnType<typeof useEditingCanvasContextValue> }>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const {
        contextValue: allCanvasContextValue,
        selectedCanvasItems,
        setSelectedCanvasItems,
        canvasController,
        stopAllModes,
    } = contextData;
    const scale = useSlideCanvasScale(canvasController);
    const { canvas } = canvasController;
    const { actualWidth, actualHeight } = useMemo(() => {
        const actualWidth = Math.round(canvas.width * scale);
        const actualHeight = Math.round(canvas.height * scale);
        return { actualWidth, actualHeight };
    }, [canvas.width, canvas.height, scale]);

    useAppEffect(() => {
        canvasController.toCenterView = () => {
            const container = containerRef.current;
            const parentElement = container?.parentElement ?? null;
            if (
                container === null ||
                parentElement instanceof HTMLDivElement === false
            ) {
                return;
            }
            scrollToCenter(
                parentElement,
                container.clientWidth,
                container.clientHeight,
            );
        };
        return () => {
            canvasController.toCenterView = () => {};
        };
    }, [canvasController]);
    useAppEffect(() => {
        canvasController.toCenterView();
    }, [containerRef.current, actualWidth, actualHeight]);

    const handleScrollEvent = (event: any) => {
        event.stopPropagation();
        handleCtrlWheel({
            event,
            value: canvasController.scale * 10,
            setValue: (scale) => {
                canvasController.scale = scale / 10;
            },
            defaultSize: defaultRangeSize,
        });
    };
    const handleKeyDownEvent = (event: any) => {
        if (document.activeElement !== event.currentTarget) {
            return;
        }
        onCanvasKeyboardEvent(
            {
                stopAllModes,
                canvasController,
                selectedCanvasItems,
                setSelectedCanvasItems,
            },
            event,
        );
    };
    return (
        <div className="card w-100 h-100 app-overflow-hidden">
            <div
                className={
                    'card-body w-100 m-0 p-0 editor-container app-focusable'
                }
                style={{ overflow: 'auto' }}
                tabIndex={0}
                onWheel={handleScrollEvent}
                onKeyDown={handleKeyDownEvent}
            >
                <div
                    ref={containerRef}
                    style={{
                        width: actualWidth,
                        height: actualHeight,
                        margin: `${actualHeight * 2}px ${actualWidth * 2}px`,
                        backgroundColor: '#fff',
                        position: 'relative',
                    }}
                >
                    <ShadowingFillParentWidthComp width={actualWidth}>
                        <MultiContextRender contexts={allCanvasContextValue}>
                            {genBoxEditorStyle()}
                            {getSlideItemShadowingStyle()}
                            <BodyRendererComp stopAllModes={stopAllModes} />
                        </MultiContextRender>
                    </ShadowingFillParentWidthComp>
                </div>
            </div>
            <div className="card-footer w-100 m-0 p-0">
                <div className="w-100 d-flex">
                    <VaryAppDocumentContext
                        value={canvasController.appDocument}
                    >
                        <SlidesMenuComp />
                    </VaryAppDocumentContext>
                    <MultiContextRender contexts={allCanvasContextValue}>
                        <SlideEditorCanvasScalingComp />
                    </MultiContextRender>
                </div>
            </div>
        </div>
    );
}
