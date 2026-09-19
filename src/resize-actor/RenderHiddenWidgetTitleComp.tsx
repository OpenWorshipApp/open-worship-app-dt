import type { RefObject } from 'react';

import {
    ACTIVE_HIDDEN_WIDGET_CLASS,
    HIDDEN_WIDGET_CLASS,
} from './FlexResizeActorComp';
import { tran } from '../lang/langHelpers';

export default function RenderHiddenWidgetTitleComp({
    widgetName,
    widgetKey,
    widgetIconName,
    type,
    onClick,
    isOnScreen,
    elementRef,
}: Readonly<{
    widgetName: string;
    widgetKey?: string;
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
            // It has always BEEN a button -- the only way to reopen a
            // panel you collapsed by dragging -- while telling the page it
            // was a plain div. That cost twice: no keyboard could reach it,
            // and anything reading the window (the help chatbot's control
            // matcher, a screen reader) ranked it below any real button
            // sharing its words -- so "open the Background panel" landed on
            // the background-transition button instead.
            role="button"
            tabIndex={0}
            // The same name the OPEN pane carries, so "the Background panel"
            // means one thing to a reader of this window whichever state it
            // is in -- and still means it once the app is in Khmer, where
            // the text below is the only other name and is translated.
            data-widget-name={widgetKey ?? widgetName}
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
            onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') {
                    return;
                }
                // Space scrolls the pane behind it otherwise, which is
                // the opposite of the panel the press was meant to open.
                event.preventDefault();
                onClick?.({ currentTarget: event.currentTarget });
            }}
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
