import { useCallback, type MouseEvent } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { useCanvasControllerContext } from '../CanvasController';
import {
    useCanvasItemContext,
    useSetEditingCanvasItem,
    useSetSelectedCanvasItems,
} from '../CanvasItem';
import { checkIsAppendSelectionModifier } from '../canvasSelectionHelpers';
import { useAppCurrentRef } from '../../../helper/appHooks';
import { useToggleBibleLookupPopupContext } from '../../../others/commonButtons';

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
    const showBibleLookupPopup = useToggleBibleLookupPopupContext();
    const handleCanvasItemControllingRef = useAppCurrentRef(
        handleCanvasItemControlling,
    );
    const canvasItemRef = useAppCurrentRef(canvasItem);
    const canvasControllerRef = useAppCurrentRef(canvasController);
    const handleClick = useCallback((event: MouseEvent) => {
        event.stopPropagation();
        const isAppend = checkIsAppendSelectionModifier(event);
        handleCanvasItemControllingRef.current(canvasItemRef.current, {
            isAppend,
        });
        canvasControllerRef.current.focusEditor();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
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
                    showBibleLookupPopup,
                )
            }
            onClick={handleClick}
            onDoubleClick={onDoubleClick}
        >
            {children}
        </div>
    );
}
