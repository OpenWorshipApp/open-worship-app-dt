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

export default function CanvasItemPropsEditorComp({
    canvasItem,
}: Readonly<{
    canvasItem: CanvasItem<any>;
}>) {
    const canvasController = useCanvasControllerContext();
    const [props, setProps] = useState(canvasItem.props);
    const attemptTimeout = useMemo(() => genTimeoutAttempt(500), []);
    const setProps1 = (anyProps: Partial<typeof props>) => {
        const newProps = cloneJson({ ...props, ...anyProps });
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
                    className="card-header"
                    style={{
                        height: '30px',
                    }}
                >
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
