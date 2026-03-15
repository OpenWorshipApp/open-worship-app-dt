import {
    useMemo,
    useCallback,
    type CSSProperties,
    type MouseEvent,
    type KeyboardEvent,
} from 'react';

import { useCanvasControllerContext } from '../CanvasController';
import BoxEditorTextAreaComp from './BoxEditorTextAreaComp';
import {
    useCanvasItemContext,
    useCanvasItemPropsContext,
    useSetEditingCanvasItem,
} from '../CanvasItem';
import type { CanvasItemTextPropsType } from '../CanvasItemText';
import { genTimeoutAttempt } from '../../../helper/timeoutHelpers';

export default function BoxEditorNormalTextEditModeComp({
    style,
}: Readonly<{
    style: CSSProperties;
}>) {
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(2000);
    }, []);
    const canvasController = useCanvasControllerContext();
    const canvasItem = useCanvasItemContext();
    const handleTextSetting = useCallback(
        (text: string) => {
            attemptTimeout(() => {
                canvasItem.applyProps({ text });
                canvasController.applyEditItem(canvasItem);
            });
        },
        [attemptTimeout, canvasItem, canvasController],
    );
    const props = useCanvasItemPropsContext<CanvasItemTextPropsType>();
    const handleCanvasItemEditing = useSetEditingCanvasItem();
    const handleClick = useCallback((event: MouseEvent) => {
        event.stopPropagation();
    }, []);
    const handleContextMenu = useCallback(
        async (event: MouseEvent) => {
            event.stopPropagation();
            handleCanvasItemEditing(canvasItem, false);
        },
        [handleCanvasItemEditing, canvasItem],
    );
    const handleKeyUp = useCallback(
        (event: KeyboardEvent) => {
            if (
                event.key === 'Escape' ||
                (event.key === 'Enter' && event.ctrlKey)
            ) {
                handleCanvasItemEditing(canvasItem, false);
            }
        },
        [handleCanvasItemEditing, canvasItem],
    );
    return (
        <div
            className="app-box-editor shadow-caught-hover-pointer editable"
            data-app-box-editor-id={canvasItem.id}
            style={style}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            onKeyUp={handleKeyUp}
        >
            <BoxEditorTextAreaComp props={props} setText={handleTextSetting} />
        </div>
    );
}
