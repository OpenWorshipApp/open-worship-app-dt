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

export default function CanvasItemPropsEditorComp({
    canvasItem,
}: Readonly<{
    canvasItem: CanvasItem<any>;
}>) {
    const canvasController = useCanvasControllerContext();
    const [props, setProps] = useState(canvasItem.props);
    const { isExpanded, headerProps } = useExpandToggle(true);
    const attemptTimeout = useMemo(() => genTimeoutAttempt(500), []);
    const setProps1 = (anyProps: Partial<typeof props>) => {
        setProps((prevProps: any) => {
            return cloneJson({ ...prevProps, ...anyProps });
        });
        attemptTimeout(() => {
            const { canvas } = canvasController;
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
                        <CanvasItemContext value={canvasItem}>
                            <div className="m-1 app-border-white-round">
                                <SlideEditorToolTitleComp title="Box Properties">
                                    <SlideEditorToolsBoxComp />
                                </SlideEditorToolTitleComp>
                            </div>
                            {canvasItem.type === 'text' ? (
                                <div className="m-1 app-border-white-round">
                                    <SlideEditorToolTitleComp title="Text Properties">
                                        <SlideEditorToolsTextComp />
                                    </SlideEditorToolTitleComp>
                                </div>
                            ) : null}
                            <div />
                        </CanvasItemContext>
                    </div>
                ) : null}
            </div>
        </CanvasItemPropsSetterContext>
    );
}
