import type { RefObject } from 'react';

import {
    ACTIVE_HIDDEN_WIDGET_CLASS,
    HIDDEN_WIDGET_CLASS,
} from './FlexResizeActorComp';
import { tran } from '../lang/langHelpers';

export default function RenderHiddenWidgetTitleComp({
    widgetName,
    widgetIconName,
    type,
    onClick,
    isOnScreen,
    elementRef,
}: Readonly<{
    widgetName: string;
    widgetIconName?: string;
    type: string;
    onClick?: (event: { currentTarget: HTMLDivElement }) => void;
    isOnScreen: boolean;
    // Reopening is driven off this element's DOM siblings, so the View menu
    // needs a handle on it to run the very same path a click on it would.
    elementRef?: RefObject<HTMLDivElement | null>;
}>) {
    // `widgetName` arrives already translated where it is a known label; the
    // dynamic ones (file/slide names) must not go through `tran`, which throws
    // in dev on a key that is not in the dictionary.
    return (
        <div
            ref={elementRef}
            title={`${tran('Enable')} ${widgetName}`}
            className={
                `${ACTIVE_HIDDEN_WIDGET_CLASS} ${HIDDEN_WIDGET_CLASS}` +
                ` bar-type-${type}` +
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
                {widgetIconName ? (
                    <i className={`bi bi-${widgetIconName} px-1`} />
                ) : null}
                {widgetName}
            </div>
        </div>
    );
}
