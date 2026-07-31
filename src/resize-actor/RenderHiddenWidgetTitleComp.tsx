import {
    ACTIVE_HIDDEN_WIDGET_CLASS,
    HIDDEN_WIDGET_CLASS,
} from './FlexResizeActorComp';
import { tran } from '../lang/langHelpers';

export default function RenderHiddenWidgetTitleComp({
    widgetName,
    type,
    onClick,
    isOnScreen,
}: Readonly<{
    widgetName: string;
    type: string;
    onClick?: (event: { currentTarget: HTMLDivElement }) => void;
    isOnScreen: boolean;
}>) {
    // `widgetName` arrives already translated where it is a known label; the
    // dynamic ones (file/slide names) must not go through `tran`, which throws
    // in dev on a key that is not in the dictionary.
    return (
        <div
            title={`${tran('Enable')} ${widgetName}`}
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
