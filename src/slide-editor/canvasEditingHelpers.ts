import { useState } from 'react';
import { useSelectedEditingSlideContext } from '../app-document-list/appDocumentHelpers';
import { useAppEffect } from '../helper/debuggerHelpers';
import CanvasController, {
    CanvasControllerContext,
} from './canvas/CanvasController';
import CanvasItem, {
    checkCanvasItemsIncludes,
    CanvasItemsContext,
    SelectedCanvasItemsAndSetterContext,
    EditingCanvasItemAndSetterContext,
} from './canvas/CanvasItem';
import AppDocument from '../app-document-list/AppDocument';
import Canvas from './canvas/Canvas';
import Slide from '../app-document-list/Slide';

function useCanvasItemsData(canvasController: CanvasController) {
    const [canvasItems, setCanvasItems] = useState<CanvasItem<any>[]>([]);
    const [selectedCanvasItems, setSelectedCanvasItems] = useState<
        CanvasItem<any>[]
    >([]);
    const [editingCanvasItem, setEditingCanvasItem] =
        useState<CanvasItem<any> | null>(null);

    const refreshData = (data?: { canvasItems: CanvasItem<any>[] }) => {
        const canvasItems =
            data?.canvasItems ?? canvasController.canvas.canvasItems;
        setCanvasItems(canvasItems);
        setSelectedCanvasItems((prevSelectedCanvasItems) => {
            const selectedCanvasItems = canvasItems.filter((item) => {
                return checkCanvasItemsIncludes(prevSelectedCanvasItems, item);
            });
            return selectedCanvasItems;
        });
        setEditingCanvasItem((prevEditingCanvasItem) => {
            if (prevEditingCanvasItem === null) {
                return null;
            }
            const editingCanvasItem =
                canvasItems.find((item) => {
                    return item.checkIsSame(prevEditingCanvasItem);
                }) ?? null;
            return editingCanvasItem;
        });
    };

    useAppEffect(() => {
        refreshData();
        const regEvents1 = canvasController.itemRegisterEventListener(
            ['update'],
            refreshData,
        );
        const regEvents2 = canvasController.itemRegisterEventListener(
            ['reload'],
            () => {
                setSelectedCanvasItems([]);
            },
        );
        return () => {
            canvasController.unregisterEventListener(regEvents2);
            canvasController.unregisterEventListener(regEvents1);
        };
    }, [canvasController]);

    useAppEffect(() => {
        canvasController.onArrowing = (event) => {
            for (const selectedCanvasItem of selectedCanvasItems) {
                canvasController.moveCanvasItem(
                    selectedCanvasItem,
                    canvasController.MOVING_OFFSET,
                    canvasController.MOVING_OFFSET,
                    {
                        arrowing: event.key as any,
                        isCtrlKey: event.ctrlKey,
                        isShiftKey: event.shiftKey,
                    },
                );
                canvasController.applyEditItem(selectedCanvasItem);
            }
        };
        return () => {
            canvasController.onArrowing = () => {};
        };
    }, [canvasController, selectedCanvasItems]);

    return {
        canvasItems,
        selectedCanvasItems,
        setSelectedCanvasItems: (newSelectedCanvasItems: CanvasItem<any>[]) => {
            setSelectedCanvasItems(newSelectedCanvasItems);
            if (newSelectedCanvasItems.length > 0) {
                setEditingCanvasItem(null);
            }
        },
        editingCanvasItem,
        setEditingCanvasItem: (canvasItem: CanvasItem<any> | null) => {
            setEditingCanvasItem(canvasItem);
            if (canvasItem !== null) {
                setSelectedCanvasItems([]);
            }
        },
    };
}

function genNewCanvasController(
    slide: Slide,
    oldCanvasController?: CanvasController,
) {
    const appDocument = AppDocument.getInstance(slide.filePath);
    if (oldCanvasController?.appDocument === appDocument) {
        const oldSlide = oldCanvasController.canvas.slide;
        if (oldSlide !== slide) {
            oldCanvasController.canvas.slide = slide;
            oldCanvasController.fireUpdateEvent();
            if (oldSlide.id !== slide.id) {
                oldCanvasController.fireReloadEvent();
            }
        }
        return oldCanvasController;
    }
    const canvasController = new CanvasController(
        appDocument,
        new Canvas(slide),
    );
    return canvasController;
}

export function useEditingCanvasContextValue() {
    const slide = useSelectedEditingSlideContext();
    const [canvasController, setCanvasController] = useState(
        genNewCanvasController(slide),
    );
    useAppEffect(() => {
        const newCanvasController = genNewCanvasController(
            slide,
            canvasController,
        );
        setCanvasController(newCanvasController);
    }, [slide]);
    const {
        canvasItems,
        selectedCanvasItems,
        setSelectedCanvasItems,
        editingCanvasItem,
        setEditingCanvasItem,
    } = useCanvasItemsData(canvasController);
    const contextValue = [
        {
            context: CanvasControllerContext,
            value: canvasController,
        },
        {
            context: CanvasItemsContext,
            value: canvasItems,
        },
        {
            context: SelectedCanvasItemsAndSetterContext,
            value: {
                canvasItems: selectedCanvasItems,
                setCanvasItems: setSelectedCanvasItems,
            },
        },
        {
            context: EditingCanvasItemAndSetterContext,
            value: {
                canvasItem: editingCanvasItem,
                setCanvasItem: setEditingCanvasItem,
            },
        },
    ];
    const stopAllModes = () => {
        setEditingCanvasItem(null);
        setSelectedCanvasItems([]);
    };
    return {
        canvasItems,
        selectedCanvasItems,
        setSelectedCanvasItems,
        editingCanvasItem,
        setEditingCanvasItem,
        contextValue,
        canvasController,
        stopAllModes,
    };
}
