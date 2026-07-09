import {
    useCallback,
    useRef,
    useState,
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
    useSetSelectedCanvasItems,
} from '../CanvasItem';
import type { CanvasItemTextPropsType } from '../CanvasItemText';
import { useAppCurrentRef } from '../../../helper/appHooks';

export default function BoxEditorNormalTextEditModeComp({
    style,
}: Readonly<{
    style: CSSProperties;
}>) {
    const canvasController = useCanvasControllerContext();
    const canvasItem = useCanvasItemContext();
    const props = useCanvasItemPropsContext<CanvasItemTextPropsType>();
    const [draftText, setDraftText] = useState(props.text);
    const isCancellingRef = useRef(false);
    const handleCanvasItemEditing = useSetEditingCanvasItem();
    const handleSelectCanvasItem = useSetSelectedCanvasItems();

    const closeTextEditor = useCallback(
        (shouldCommit: boolean) => {
            if (!shouldCommit) {
                // Escape cancels the edit without changing the text and exits
                // edit mode entirely.
                handleCanvasItemEditing(canvasItem, false);
                return;
            }
            if (draftText !== props.text) {
                canvasController.editCanvasItemById(
                    canvasItem.id,
                    (latestCanvasItem) => {
                        latestCanvasItem.applyProps({ text: draftText });
                    },
                );
            }
            // Leaving text-edit by committing (blur / Ctrl+Enter) switches the
            // box to the selected state (not editing) so the properties panel
            // stays open for it.
            handleSelectCanvasItem(canvasItem);
        },
        [
            canvasController,
            canvasItem,
            draftText,
            handleCanvasItemEditing,
            handleSelectCanvasItem,
            props.text,
        ],
    );

    const handleClick = useCallback((event: MouseEvent) => {
        event.stopPropagation();
    }, []);
    const closeTextEditorRef = useAppCurrentRef(closeTextEditor);
    const handleContextMenu = useCallback((event: MouseEvent) => {
        event.stopPropagation();
        closeTextEditorRef.current(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleKeyUp = useCallback((event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            isCancellingRef.current = true;
            closeTextEditorRef.current(false);
            return;
        }
        if (event.key === 'Enter' && event.ctrlKey) {
            closeTextEditorRef.current(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleTextBlur = useCallback(() => {
        if (isCancellingRef.current) {
            isCancellingRef.current = false;
            return;
        }
        closeTextEditorRef.current(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div
            className="app-box-editor shadow-caught-hover-pointer editable"
            data-app-box-editor-id={canvasItem.id}
            style={style}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            onKeyUp={handleKeyUp}
        >
            <BoxEditorTextAreaComp
                props={props}
                text={draftText}
                onTextChange={setDraftText}
                onBlur={handleTextBlur}
            />
        </div>
    );
}
