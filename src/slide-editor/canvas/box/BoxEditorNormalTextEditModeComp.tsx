import {
    useCallback,
    useRef,
    useState,
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

// The box shell around this (class names, position, selection handlers) is
// `BoxEditorComp`'s; this owns only the draft text and how an edit ends.
export default function BoxEditorNormalTextEditModeComp() {
    const canvasController = useCanvasControllerContext();
    const canvasItem = useCanvasItemContext();
    const props = useCanvasItemPropsContext<CanvasItemTextPropsType>();
    const [draftText, setDraftText] = useState(props.text);
    const isCancellingRef = useRef(false);
    const handleCanvasItemEditing = useSetEditingCanvasItem();
    const handleSelectCanvasItem = useSetSelectedCanvasItems();

    const canvasControllerRef = useAppCurrentRef(canvasController);
    const canvasItemRef = useAppCurrentRef(canvasItem);
    const propsRef = useAppCurrentRef(props);
    const draftTextRef = useAppCurrentRef(draftText);
    const handleCanvasItemEditingRef = useAppCurrentRef(
        handleCanvasItemEditing,
    );
    const handleSelectCanvasItemRef = useAppCurrentRef(handleSelectCanvasItem);
    const closeTextEditor = useCallback(
        (shouldCommit: boolean) => {
            if (!shouldCommit) {
                // Escape cancels the edit without changing the text and exits
                // edit mode entirely.
                handleCanvasItemEditingRef.current(
                    canvasItemRef.current,
                    false,
                );
                return;
            }
            if (draftTextRef.current !== propsRef.current.text) {
                canvasControllerRef.current.editCanvasItemById(
                    canvasItemRef.current.id,
                    (latestCanvasItem) => {
                        latestCanvasItem.applyProps({
                            text: draftTextRef.current,
                        });
                    },
                );
            }
            // Leaving text-edit by committing (blur / Ctrl+Enter) switches the
            // box to the selected state (not editing) so the properties panel
            // stays open for it.
            handleSelectCanvasItemRef.current(canvasItemRef.current);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

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
        // Both handlers catch what bubbles up from the textarea, so they sit
        // here rather than on the box shell — a right-click must commit the
        // draft instead of opening the box's context menu.
        <div
            style={{ width: '100%', height: '100%' }}
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
