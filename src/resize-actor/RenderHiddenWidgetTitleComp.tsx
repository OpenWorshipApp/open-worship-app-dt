import {
    ACTIVE_HIDDEN_WIDGET_CLASS,
    HIDDEN_WIDGET_CLASS,
} from './FlexResizeActorComp';

export default function RenderHiddenWidgetTitleComp({
    widgetName,
    type,
    onClick,
    isOnScreen,
}: Readonly<{
    widgetName: string;
    type: string;
    onClick?: (event: any) => void;
    isOnScreen: boolean;
}>) {
    return (
        <div
            title={`Enable ${widgetName}`}
            className={
                `${ACTIVE_HIDDEN_WIDGET_CLASS} ${HIDDEN_WIDGET_CLASS}` +
                ` app-caught-hover-pointer bar-type-${type}` +
                (isOnScreen ? ` app-hidden-widget-on-screen` : '')
            }
            style={{
                color: 'green',
            }}
            onClick={onClick}
        >
            <div
                className={
                    'hidden-context' + (isOnScreen ? ` app-on-screen` : '')
                }
            >
                {widgetName}
            </div>
        </div>
    );
}
