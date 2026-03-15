import { useCallback, useMemo, useRef, type DragEvent } from 'react';

import { BoxEditorComp } from './box/BoxEditorComp';
import { showCanvasContextMenu } from './canvasContextMenuHelpers';
import type CanvasController from './CanvasController';
import { useCanvasControllerContext } from './CanvasController';
import { useSlideCanvasScale } from './canvasEventHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import { CanvasItemContext, useCanvasItemsContext } from './CanvasItem';
import { changeDragEventStyle } from '../../helper/helpers';
import { readDroppedFiles } from '../../others/droppingFileHelpers';
import { checkIsSupportMediaType } from './canvasHelpers';
import { tran } from '../../lang/langHelpers';
import { MultiContextRender } from '../../helper/MultiContextRender';
import { type useEditingCanvasContextValue } from '../canvasEditingHelpers';
import ShadowingFillParentWidthComp, {
    useShadowingParentWidth,
} from '../../others/ShadowingFillParentWidthComp';
import { getSlideItemShadowingStyle } from '../../app-document-presenter/items/slideItemRenderHelpers';
import { genBoxEditorStyle } from './box/boxEditorHelpers';
import { useThemeSource } from '../../others/initHelpers';
import { useAppEffect } from '../../helper/debuggerHelpers';
import { useKeyboardRegistering } from '../../event/KeyboardEventListener';

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
            const newCanvasItem =
                await canvasController.genNewImageItemFromFile(file, event);
            if (newCanvasItem) {
                canvasController.addNewItems([newCanvasItem]);
            }
        } else {
            showSimpleToast(
                tran('Insert Image or Video'),
                tran('Unsupported file type!'),
            );
        }
    }
}

async function openCanvasContextMenu(
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
        const scale = (parentWidth ?? 0) / canvas.width;
        return scale;
    }, [parentWidth, canvas.width]);
    const canvasItems = useCanvasItemsContext();
    const { theme } = useThemeSource();
    const handleDragLeave = useCallback((event: any) => {
        event.preventDefault();
        event.currentTarget.style.opacity = '1';
    }, []);
    const handleDrop = useCallback(
        (event: DragEvent) => {
            event.preventDefault();
            handleDropping(canvasController, event);
        },
        [canvasController],
    );
    const handleContextMenuOpening = useCallback(
        (event: any) => {
            event.preventDefault();
            openCanvasContextMenu(canvasController, event, stopAllModes);
        },
        [canvasController, stopAllModes],
    );
    const handleMouseDown = useCallback((event: any) => {
        event.stopPropagation();
        (event.target as HTMLDivElement).dataset.mouseDown = JSON.stringify({
            time: Date.now(),
            x: event.clientX,
            y: event.clientY,
        });
    }, []);
    const handleMouseUp = useCallback(
        (event: any) => {
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
        },
        [stopAllModes],
    );
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
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onContextMenu={handleContextMenuOpening}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
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

export default function CanvasContainerComp({
    contextData,
}: Readonly<{ contextData: ReturnType<typeof useEditingCanvasContextValue> }>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const {
        contextValue: allCanvasContextValue,
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

    useKeyboardRegistering(
        [
            {
                allControlKey: ['Ctrl'],
                key: 'Enter',
            },
        ],
        () => {
            const containerParent = containerRef.current?.parentElement ?? null;
            if (containerParent === null) {
                return;
            }
            if (document.activeElement === document.body) {
                containerParent.focus();
            }
        },
        [containerRef.current],
    );

    return (
        <div className="w-100 h-100" style={{ overflow: 'auto' }}>
            <div
                ref={containerRef}
                style={{
                    width: actualWidth,
                    height: actualHeight,
                    margin: `${actualHeight * 2}px ${actualWidth * 2}px`,
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
    );
}
