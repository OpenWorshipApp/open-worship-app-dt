import CanvasItemRendererComp from '../../CanvasItemRendererComp';
import { useCanvasControllerContext } from '../CanvasController';
import {
    CanvasItemContext,
    checkCanvasItemsIncludes,
    useCanvasItemsContext,
    useSelectedCanvasItemsAndSetterContext,
    useSetEditingCanvasItem,
    useSetSelectedCanvasItems,
} from '../CanvasItem';

export default function ToolCanvasItemsComp() {
    const canvasController = useCanvasControllerContext();
    const canvasItems = useCanvasItemsContext();
    const handleCanvasItemControlling = useSetSelectedCanvasItems();
    const handleCanvasItemEditing = useSetEditingCanvasItem();
    const { canvasItems: selectedCanvasItems } =
        useSelectedCanvasItemsAndSetterContext();
    return (
        <div
            className="w-100 h-100"
            style={{
                overflowX: 'hidden',
                overflowY: 'auto',
            }}
        >
            {canvasItems.map((canvasItem) => {
                const isSelected = checkCanvasItemsIncludes(
                    selectedCanvasItems,
                    canvasItem,
                );
                const { props } = canvasItem;
                return (
                    <div
                        key={canvasItem.id}
                        className={'card app-caught-hover-pointer m-2'}
                        style={{
                            width: '300px',
                            height: '200px',
                            border: isSelected ? '2px dashed green' : undefined,
                            margin: 'auto',
                        }}
                        onClick={(event) => {
                            event.stopPropagation();
                            handleCanvasItemControlling(canvasItem);
                        }}
                        onContextMenu={canvasController.genHandleContextMenuOpening(
                            canvasItem,
                            handleCanvasItemEditing.bind(null, canvasItem),
                        )}
                    >
                        <div className="card-header">
                            {canvasItem.id}:{props.width}x{props.height}
                        </div>
                        <div
                            className="card-body"
                            style={{
                                overflow: 'auto',
                            }}
                        >
                            <CanvasItemContext value={canvasItem}>
                                <CanvasItemRendererComp />
                            </CanvasItemContext>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
