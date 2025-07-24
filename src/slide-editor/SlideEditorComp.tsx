import { lazy, useState } from 'react';

import { resizeSettingNames } from '../resize-actor/flexSizeHelpers';
import ResizeActorComp from '../resize-actor/ResizeActorComp';
import CanvasController, {
    CanvasControllerContext,
} from './canvas/CanvasController';
import { MultiContextRender } from '../helper/MultiContextRender';
import CanvasItem, {
    CanvasItemsContext,
    checkCanvasItemsIncludes,
    EditingCanvasItemAndSetterContext,
    SelectedCanvasItemsAndSetterContext,
} from './canvas/CanvasItem';
import { useAppEffect } from '../helper/debuggerHelpers';
import { useSelectedEditingSlideContext } from '../app-document-list/appDocumentHelpers';

const LazySlideEditorCanvasComp = lazy(() => {
    return import('./canvas/SlideEditorCanvasComp');
});
const LazySlideEditorToolsComp = lazy(() => {
    return import('./canvas/tools/SlideEditorToolsComp');
});

function useCanvasController() {
    const slide = useSelectedEditingSlideContext();
    const [canvasController, setCanvasController] = useState(
        CanvasController.initInstance(slide),
    );
    useAppEffect(() => {
        if (canvasController.canvas.slide === slide) {
            return;
        }
        setCanvasController(CanvasController.initInstance(slide));
    }, [slide]);
    return canvasController;
}

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
        const regEvents = canvasController.itemRegisterEventListener(
            ['update'],
            refreshData,
        );
        return () => {
            canvasController.unregisterEventListener(regEvents);
        };
    }, [canvasController]);

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

export default function SlideEditorComp() {
    const canvasController = useCanvasController();
    const {
        canvasItems,
        selectedCanvasItems,
        setSelectedCanvasItems,
        editingCanvasItem,
        setEditingCanvasItem,
    } = useCanvasItemsData(canvasController);
    return (
        <MultiContextRender
            contexts={[
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
            ]}
        >
            <div className="slide-editor w-100 h-100 overflow-hidden">
                <ResizeActorComp
                    flexSizeName={resizeSettingNames.slideEditor}
                    isHorizontal
                    flexSizeDefault={{
                        h1: ['5'],
                        h2: ['1'],
                    }}
                    dataInput={[
                        {
                            children: LazySlideEditorCanvasComp,
                            key: 'h1',
                            widgetName: 'Slide Editor Canvas',
                            className: 'flex-item',
                        },
                        {
                            children: LazySlideEditorToolsComp,
                            key: 'h2',
                            widgetName: 'Tools',
                            className: 'flex-item',
                        },
                    ]}
                />
            </div>
        </MultiContextRender>
    );
}
