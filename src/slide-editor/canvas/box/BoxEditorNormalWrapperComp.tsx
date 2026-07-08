import { useCallback, type MouseEvent } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { useCanvasControllerContext } from '../CanvasController';
import {
    useCanvasItemContext,
    useSetEditingCanvasItem,
    useSetSelectedCanvasItems,
} from '../CanvasItem';
import { checkIsAppendSelectionModifier } from '../canvasSelectionHelpers';

export default function BoxEditorNormalWrapperComp({
    style,
    children,
    onContextMenu,
    onDoubleClick,
}: Readonly<{
    style: CSSProperties;
    children: ReactNode;
    onContextMenu?: (event: any) => void;
    onDoubleClick?: (event: any) => void;
}>) {
    const canvasItem = useCanvasItemContext();
    const canvasController = useCanvasControllerContext();
    const handleCanvasItemControlling = useSetSelectedCanvasItems();
    const handleCanvasItemEditing = useSetEditingCanvasItem();
    const handleClick = useCallback(
        (event: MouseEvent) => {
            event.stopPropagation();
            const isAppend = checkIsAppendSelectionModifier(event);
            handleCanvasItemControlling(canvasItem, { isAppend });
            canvasController.focusEditor();
        },
        [handleCanvasItemControlling, canvasItem, canvasController],
    );
    return (
        <div
            className="app-box-editor shadow-caught-hover-pointer"
            data-app-box-editor-id={canvasItem.id}
            style={style}
            onContextMenu={
                onContextMenu ??
                canvasController.genHandleContextMenuOpening(
                    canvasItem,
                    handleCanvasItemEditing.bind(null, canvasItem),
                    false,
                )
            }
            onClick={handleClick}
            onDoubleClick={onDoubleClick}
        >
            {children}
        </div>
    );
}
