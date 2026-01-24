import type { CSSProperties, ReactNode } from 'react';

import { useCanvasControllerContext } from '../CanvasController';
import {
    useCanvasItemContext,
    useSetEditingCanvasItem,
    useSetSelectedCanvasItems,
} from '../CanvasItem';

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
    return (
        <div
            className="app-box-editor app-caught-hover-pointer"
            style={style}
            onContextMenu={
                onContextMenu ??
                canvasController.genHandleContextMenuOpening(
                    canvasItem,
                    handleCanvasItemEditing.bind(null, canvasItem),
                )
            }
            onClick={(event) => {
                event.stopPropagation();
                handleCanvasItemControlling(canvasItem);
            }}
            onDoubleClick={onDoubleClick}
        >
            {children}
        </div>
    );
}
