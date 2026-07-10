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
import { checkIsAppendSelectionModifier } from '../canvasSelectionHelpers';
import { useToggleBibleLookupPopupContext } from '../../../others/commonButtons';

const PREVIEW_WIDTH = 280;
const PREVIEW_HEIGHT = 150;

export default function ToolCanvasItemsComp() {
    const canvasController = useCanvasControllerContext();
    const canvasItems = useCanvasItemsContext();
    const handleCanvasItemControlling = useSetSelectedCanvasItems();
    const handleCanvasItemEditing = useSetEditingCanvasItem();
    const showBibleLookupPopup = useToggleBibleLookupPopupContext();
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
                            const isAppend =
                                checkIsAppendSelectionModifier(event);
                            handleCanvasItemControlling(canvasItem, {
                                isAppend,
                            });
                        }}
                        onContextMenu={canvasController.genHandleContextMenuOpening(
                            canvasItem,
                            handleCanvasItemEditing.bind(null, canvasItem),
                            false,
                            showBibleLookupPopup,
                        )}
                    >
                        <div className="card-header">
                            {canvasItem.id}:{props.width}x{props.height}
                        </div>
                        <div
                            className="card-body"
                            style={{
                                overflow: 'hidden',
                                position: 'relative',
                            }}
                        >
                            <div
                                style={{
                                    width: `${props.width}px`,
                                    height: `${props.height}px`,
                                    transform: `scale(${Math.min(
                                        PREVIEW_WIDTH / props.width,
                                        PREVIEW_HEIGHT / props.height,
                                    )})`,
                                    transformOrigin: 'top left',
                                }}
                            >
                                <CanvasItemContext value={canvasItem}>
                                    <CanvasItemRendererComp />
                                </CanvasItemContext>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
