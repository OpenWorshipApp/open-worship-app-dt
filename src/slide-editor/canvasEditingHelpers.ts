import { use, useCallback, useMemo, useState } from 'react';
import { useSelectedEditingSlideContext } from '../app-document-list/appDocumentHelpers';
import { useAppEffect } from '../helper/appHooks';
import CanvasController, {
    CanvasControllerContext,
} from './canvas/CanvasController';
import type CanvasItem from './canvas/CanvasItem';
import {
    checkCanvasItemsIncludes,
    CanvasItemsContext,
    SelectedCanvasItemsAndSetterContext,
    EditingCanvasItemAndSetterContext,
} from './canvas/CanvasItem';
import AppDocument from '../app-document-list/AppDocument';
import Canvas from './canvas/Canvas';
import type Slide from '../app-document-list/Slide';
import { BibleLookupTogglePopupContext } from '../others/commonButtons';
import { CanvasBibleItemEventListener } from './canvas/canvasBibleItemHelpers';
import type BibleItem from '../bible-list/BibleItem';
import { showSimpleToast } from '../toast/toastHelpers';
import { tran } from '../lang/langHelpers';

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
            if (selectedCanvasItems.length === 0) {
                return;
            }

            canvasController.editCanvasItemsByIds(
                selectedCanvasItems
                    .filter((item) => !item.isLocked)
                    .map((item) => item.id),
                (selectedCanvasItem) => {
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
                },
                {
                    showNotFoundToast: false,
                },
            );
        };
        return () => {
            canvasController.onArrowing = () => {};
        };
    }, [canvasController, selectedCanvasItems]);

    // Stable identities so the context values memoized below only change
    // when their data changes.
    const setSelectedCanvasItemsStable = useCallback(
        (newSelectedCanvasItems: CanvasItem<any>[]) => {
            setSelectedCanvasItems(newSelectedCanvasItems);
            if (newSelectedCanvasItems.length > 0) {
                setEditingCanvasItem(null);
            }
        },
        [],
    );
    const setEditingCanvasItemStable = useCallback(
        (canvasItem: CanvasItem<any> | null) => {
            setEditingCanvasItem(canvasItem);
            if (canvasItem !== null) {
                setSelectedCanvasItems([]);
            }
        },
        [],
    );
    return {
        canvasItems,
        selectedCanvasItems,
        setSelectedCanvasItems: setSelectedCanvasItemsStable,
        editingCanvasItem,
        setEditingCanvasItem: setEditingCanvasItemStable,
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
    // Lazy initializer: constructing a CanvasController on every render
    // just to throw it away is expensive.
    const [canvasController, setCanvasController] = useState(() => {
        return genNewCanvasController(slide);
    });
    useAppEffect(() => {
        const newCanvasController = genNewCanvasController(
            slide,
            canvasController,
        );
        setCanvasController(newCanvasController);
    }, [slide]);
    useAppEffect(() => {
        const registeredEvents =
            CanvasBibleItemEventListener.registerEventListener(
                ['insert-bible-item'],
                async (bibleItem: BibleItem) => {
                    await canvasController.addNewBibleItem(bibleItem);
                    showSimpleToast(
                        tran('Insert Bible Item'),
                        tran('Bible item is inserted into the editing slide'),
                    );
                },
            );
        return () => {
            CanvasBibleItemEventListener.unregisterEventListener(
                registeredEvents,
            );
        };
    }, [canvasController]);
    const {
        canvasItems,
        selectedCanvasItems,
        setSelectedCanvasItems,
        editingCanvasItem,
        setEditingCanvasItem,
    } = useCanvasItemsData(canvasController);
    // The canvas renders into its own React root inside a shadow root, so any
    // app-level context a canvas item needs has to be handed across explicitly.
    const bibleLookupTogglePopup = use(BibleLookupTogglePopupContext);
    // Memoized so MultiContextRenderComp consumers don't re-render on every
    // render of this hook's owner.
    const contextValue = useMemo(() => {
        return [
            {
                context: BibleLookupTogglePopupContext,
                value: bibleLookupTogglePopup,
            },
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
    }, [
        bibleLookupTogglePopup,
        canvasController,
        canvasItems,
        selectedCanvasItems,
        setSelectedCanvasItems,
        editingCanvasItem,
        setEditingCanvasItem,
    ]);
    const stopAllModes = useCallback(() => {
        setEditingCanvasItem(null);
        setSelectedCanvasItems([]);
    }, [setEditingCanvasItem, setSelectedCanvasItems]);
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
