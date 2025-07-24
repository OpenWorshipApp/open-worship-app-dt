import SlideEditorToolsTextComp from './SlideEditorToolsTextComp';
import SlideEditorToolsBoxComp from './SlideEditorToolsBoxComp';
import CanvasItem, {
    CanvasItemContext,
    CanvasItemPropsSetterContext,
    useCanvasItemEditEvent,
} from '../CanvasItem';
import SlideEditorToolTitleComp from './SlideEditorToolTitleComp';
import { useCanvasControllerContext } from '../CanvasController';
import { useMemo, useState } from 'react';
import { cloneJson, genTimeoutAttempt } from '../../../helper/helpers';

function CanvasItemPropsEditorComp({
    canvasItem,
}: Readonly<{
    canvasItem: CanvasItem<any>;
}>) {
    const canvasController = useCanvasControllerContext();
    const [props, setProps] = useState(canvasItem.props);
    const attemptTimeout = useMemo(() => genTimeoutAttempt(500), []);
    const setProps1 = (anyProps: Partial<typeof props>) => {
        const newProps = { ...props, ...anyProps };
        setProps(newProps);
        attemptTimeout(() => {
            canvasItem.applyProps(newProps);
            const { canvas } = canvasController;
            canvasItem.applyBoxData(
                {
                    parentHeight: canvas.height,
                    parentWidth: canvas.width,
                },
                newProps,
            );
            canvasController.applyEditItem(canvasItem);
        });
    };
    useCanvasItemEditEvent(canvasItem, () => {
        setProps(cloneJson(canvasItem.props));
    });
    return (
        <CanvasItemPropsSetterContext
            value={{
                props,
                setProps: setProps1,
            }}
        >
            <div className="card">
                <div className="card-header">
                    <strong>Item ID: {canvasItem.id}</strong>
                </div>
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
            </div>
        </CanvasItemPropsSetterContext>
    );
}

export default function SlideEditorPropertiesComp({
    canvasItems,
}: Readonly<{
    canvasItems: CanvasItem<any>[];
}>) {
    return (
        <div
            className="d-flex flex-column w-100 h-100 p-1"
            style={{
                overflowX: 'hidden',
            }}
        >
            {canvasItems.length === 0 ? (
                <div className="d-flex justify-content-center align-items-center h-100">
                    <div>
                        <h2 className="text-muted">`No canvas item selected</h2>
                        <hr />
                        <h3 className="text-muted">
                            `Please select an item to edit
                        </h3>
                    </div>
                </div>
            ) : null}
            {canvasItems.map((canvasItem) => {
                return (
                    <CanvasItemPropsEditorComp
                        key={canvasItem.id}
                        canvasItem={canvasItem}
                    />
                );
            })}
        </div>
    );
}
