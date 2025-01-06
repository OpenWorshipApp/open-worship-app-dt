import { BoxEditorComp } from './box/BoxEditorComp';
import {
    useKeyboardRegistering,
} from '../../event/KeyboardEventListener';
import {
    showCanvasContextMenu,
} from './canvasContextMenuHelpers';
import { isSupportedMimetype } from '../../server/fileHelpers';
import { useCanvasControllerContext } from './CanvasController';
import {
    useSlideItemCanvasScale,
} from './canvasEventHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import {
    CanvasItemContext, useCanvasItemsContext, useStopAllModes,
} from './CanvasItem';

export default function SlideItemEditorCanvasComp() {
    const canvasController = useCanvasControllerContext();
    const stopAllModes = useStopAllModes();
    const { canvas } = canvasController;
    const scale = useSlideItemCanvasScale();
    useKeyboardRegistering([{ key: 'Escape' }], stopAllModes);
    return (
        <div className='editor-container w-100 h-100'>
            <div className='overflow-hidden' style={{
                width: `${canvas.width * scale + 20}px`,
                height: `${canvas.height * scale + 20}px`,
            }}>
                <div className='w-100 h-100' style={{
                    transform: `scale(${scale.toFixed(2)}) translate(50%, 50%)`,
                }}>
                    <BodyRendererComp />
                </div>
            </div>
        </div>
    );
}

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
    const handleDragging = (event: any) => {
        event.preventDefault();
        const items: DataTransferItemList = event.dataTransfer.items;
        if (Array.from(items).every((item) => {
            return isSupportType(item.type);
        })) {
            event.currentTarget.style.opacity = '0.5';
        }
    };
    const handleDropping = async (event: any) => {
        const dragEvent = event as DragEvent;
        dragEvent.preventDefault();
        const style = (dragEvent.currentTarget as any)?.style || {};
        style.opacity = '1';
        const files = dragEvent.dataTransfer?.files || [];
        Array.from(files).forEach((file) => {
            if (!isSupportType(file.type)) {
                showSimpleToast('Insert Image or Video',
                    'Unsupported file type!');
            } else {
                canvasController.genNewMediaItemFromFilePath(
                    (file as any).path, event,
                ).then((newCanvasItem) => {
                    if (newCanvasItem) {
                        canvasController.addNewItem(newCanvasItem);
                    }
                });
            }
        });
    };
    const handleContextMenuOpening = async (event: any) => {
        event.preventDefault();
        (event.target as HTMLDivElement).focus();
        stopAllModes();
        showCanvasContextMenu(event, canvasController);
    };
    return (
        <div className='editor blank-bg app-border-white-round'
            style={{
                width: `${canvas.width}px`,
                height: `${canvas.height}px`,
                transform: 'translate(-50%, -50%)',
            }}
            onDragOver={handleDragging}
            onDragLeave={(event) => {
                event.preventDefault();
                event.currentTarget.style.opacity = '1';
            }}
            onDrop={handleDropping}
            onContextMenu={handleContextMenuOpening}
            // import onclick by mouse down/up
            onMouseDown={(event) => {
                event.stopPropagation();
                (event.target as HTMLDivElement).dataset.mouseDown = (
                    JSON.stringify({
                        time: new Date().getTime(),
                        x: event.clientX,
                        y: event.clientY,
                    })
                );
            }}
            onMouseUp={(event) => {
                const dataset = (event.target as HTMLDivElement).dataset;
                if (dataset.mouseDown) {
                    const mouseDown = JSON.parse(dataset.mouseDown);
                    const timeDiff = new Date().getTime() - mouseDown.time;
                    const distance = Math.sqrt(
                        Math.pow(event.clientX - mouseDown.x, 2) +
                        Math.pow(event.clientY - mouseDown.y, 2)
                    );
                    if (timeDiff < 500 && distance < 10) {
                        stopAllModes();
                    }
                }
                dataset.mouseDown = '';
            }} >
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
