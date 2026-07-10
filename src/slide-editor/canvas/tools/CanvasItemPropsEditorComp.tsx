import { useMemo, useState } from 'react';

import { ExpandChevron, useExpandToggle } from './useExpandToggle';

import SlideEditorToolsTextComp from './SlideEditorToolsTextComp';
import SlideEditorToolsBoxComp from './SlideEditorToolsBoxComp';
import type CanvasItem from '../CanvasItem';
import {
    CanvasItemContext,
    CanvasItemPropsSetterContext,
    useCanvasItemEditEvent,
} from '../CanvasItem';
import SlideEditorToolTitleComp from './SlideEditorToolTitleComp';
import { useCanvasControllerContext } from '../CanvasController';
import { cloneJson } from '../../../helper/helpers';
import { genTimeoutAttempt } from '../../../helper/timeoutHelpers';
import { useCanvasControllerEvents } from '../canvasEventHelpers';

export default function CanvasItemPropsEditorComp({
    canvasItem,
}: Readonly<{
    canvasItem: CanvasItem<any>;
}>) {
    const canvasController = useCanvasControllerContext();
    // A bible item lays its own title and verses out from the verse data, so it
    // exposes every text property except the alignment and the raw content.
    const hasTextProps = ['text', 'bible'].includes(canvasItem.type);
    const isPlainText = canvasItem.type === 'text';
    const [props, setProps] = useState(canvasItem.props);
    const { isExpanded, headerProps } = useExpandToggle(true);
    const attemptTimeout = useMemo(() => genTimeoutAttempt(500), []);
    const setProps1 = (anyProps: Partial<typeof props>) => {
        setProps((prevProps: any) => {
            return cloneJson({ ...prevProps, ...anyProps });
        });
        attemptTimeout(() => {
            const { canvas } = canvasController;
            // The editors are hidden while locked, but a pending debounced
            // commit could still fire after the item just got locked.
            const latestItem = canvas.canvasItems.find((item) => {
                return item.id === canvasItem.id;
            });
            if (latestItem === undefined || latestItem.isLocked) {
                return;
            }
            canvasController.editCanvasItemById(canvasItem.id, (item) => {
                // Apply only the changed fields onto the latest item state.
                // Committing a full local snapshot here would overwrite
                // properties changed elsewhere (e.g. a position set by a prior
                // drag), which made the box jump back to its old spot when
                // only the background color was changed.
                item.applyBoxData(
                    {
                        parentHeight: canvas.height,
                        parentWidth: canvas.width,
                    },
                    cloneJson(anyProps),
                );
            });
        });
    };
    useCanvasItemEditEvent(canvasItem, () => {
        const newProps = cloneJson(canvasItem.props);
        setProps(newProps);
    });
    // `edit` above only fires from this panel's own commits. Undo/redo (and
    // any other external change) instead replaces the whole canvas item
    // list and fires a controller-level event, so re-sync from the latest
    // matching item there too — otherwise the panel shows stale values
    // after an undo.
    useCanvasControllerEvents(['update', 'reload'], () => {
        const latestItem = canvasController.canvas.canvasItems.find(
            (item) => item.id === canvasItem.id,
        );
        if (latestItem) {
            setProps(cloneJson(latestItem.props));
        }
    });
    const isLocked = props.locked === true;
    const handleUnlocking = () => {
        canvasController.editCanvasItemById(canvasItem.id, (item) => {
            item.applyProps({ locked: false });
        });
    };
    return (
        <CanvasItemPropsSetterContext
            value={{
                props,
                setProps: setProps1,
            }}
        >
            <div className="card">
                <div
                    className="card-header d-flex align-items-center gap-2"
                    style={{
                        height: '30px',
                        cursor: 'pointer',
                        userSelect: 'none',
                    }}
                    {...headerProps}
                >
                    <ExpandChevron
                        isExpanded={isExpanded}
                        style={{ fontSize: '0.8rem', opacity: 0.7 }}
                    />
                    <strong>Item ID: {canvasItem.id}</strong>
                </div>
                {isExpanded ? (
                    <div
                        className="card-body w-100 d-flex flex-wrap"
                        style={{
                            overflow: 'auto',
                        }}
                    >
                        {isLocked ? (
                            <div className="d-flex align-items-center gap-2 p-2">
                                <span>🔒 This item is locked</span>
                                <button
                                    className="btn btn-sm btn-outline-warning"
                                    onClick={handleUnlocking}
                                >
                                    Unlock
                                </button>
                            </div>
                        ) : (
                            <CanvasItemContext value={canvasItem}>
                                <div>
                                    <SlideEditorToolTitleComp
                                        title="Box Properties"
                                        isCollapsible
                                        isInitiallyExpanded={false}
                                    >
                                        <SlideEditorToolsBoxComp />
                                    </SlideEditorToolTitleComp>
                                </div>
                                {hasTextProps ? (
                                    <div
                                        // Take the whole panel row so the text
                                        // content textarea gets the full width
                                        // and grows when the panel is resized.
                                        style={{
                                            flexBasis: '100%',
                                            minWidth: 0,
                                        }}
                                    >
                                        <SlideEditorToolTitleComp title="Text Properties">
                                            <SlideEditorToolsTextComp
                                                isAlignmentEnabled={isPlainText}
                                                isTextContentEnabled={
                                                    isPlainText
                                                }
                                            />
                                        </SlideEditorToolTitleComp>
                                    </div>
                                ) : null}
                                <div />
                            </CanvasItemContext>
                        )}
                    </div>
                ) : null}
            </div>
        </CanvasItemPropsSetterContext>
    );
}
