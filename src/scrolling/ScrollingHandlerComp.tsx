import type { CSSProperties, MouseEvent as ReactMouseEventType } from 'react';
import { useRef } from 'react';

import type { MoveCheckType } from './scrollingHandlerHelpers';
import {
    TO_THE_TOP_STYLE_STRING,
    TO_THE_TOP_CLASSNAME,
    applyToTheTop,
    applyPlayToBottom,
    PLAY_TO_BOTTOM_CLASSNAME,
    PLAY_TO_BOTTOM_MENU_CLASSNAME,
} from './scrollingHandlerHelpers';
import { showPlayToBottomContextMenu } from './playToBottomMenuHelpers';
import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import { HoverMotionHandler } from '../helper/domHelpers';
import { tran } from '../lang/langHelpers';

export default function ScrollingHandlerComp({
    style,
    playToBottomStyle,
    shouldShowPlayToBottom = false,
    movedCheck,
    scrollingContainerSelector,
}: Readonly<{
    // Positions the to-the-top button only. When both buttons show they are a
    // stack in the same corner, so a host that moves one must move the other
    // with `playToBottomStyle` or the two glyphs land on top of each other.
    style?: CSSProperties;
    playToBottomStyle?: CSSProperties;
    shouldShowPlayToBottom?: boolean;
    movedCheck?: MoveCheckType;
    // For hosts where the scroller is not this handler's own parent — see
    // `applyToTheTop`.
    scrollingContainerSelector?: string;
}>) {
    const playToBottomRef = useRef<HTMLElement | null>(null);
    const handleMenuOpening = (event: ReactMouseEventType) => {
        const playElement = playToBottomRef.current;
        if (playElement === null) {
            return;
        }
        showPlayToBottomContextMenu(event, playElement);
    };
    return (
        <>
            <style>{TO_THE_TOP_STYLE_STRING}</style>
            {shouldShowPlayToBottom ? (
                <i
                    className={
                        `${PLAY_TO_BOTTOM_CLASSNAME} bi bi-chevron-double-down` +
                        ' app-caught-hover-pointer' +
                        ` ${HoverMotionHandler.lowVisibleClassname}-1`
                    }
                    style={{
                        width: '45px',
                        height: '45px',
                        ...playToBottomStyle,
                    }}
                    ref={(element) => {
                        playToBottomRef.current = element;
                        if (element) {
                            applyPlayToBottom(element, movedCheck);
                        }
                    }}
                />
            ) : null}
            {/* The auto-scroll button's four mouse gestures, written down.
                Nothing on screen said a right-click slowed it down or that
                Alt + right-click stopped it, and on a touch screen neither
                existed at all. Shown only while auto-scroll is running, and
                only AFTER the button above it: the stylesheet reveals it with a
                sibling selector on that button's `data-speed`, so this element's
                position in the markup is load-bearing.

                `onOpening` is required here. Left out, the button dispatches a
                real `contextmenu` on its parent — which is the host's scroller,
                whose ancestor answers with the host's own menu (the bible text
                menu, in the reader). */}
            {shouldShowPlayToBottom ? (
                <ContextMenuDotsButtonComp
                    isHorizontal
                    className={PLAY_TO_BOTTOM_MENU_CLASSNAME}
                    label={tran('Auto Scroll Options')}
                    onOpening={handleMenuOpening}
                    style={{
                        // Rides the chevron's own placement, so the two stay
                        // level wherever the host pinned it...
                        ...playToBottomStyle,
                        // ...clear of its 45px box at right: 5px, and lifted
                        // half the difference in height so the 22px button is
                        // centred on the chevron's line rather than hanging off
                        // the bottom of it.
                        right: '46px',
                        marginBottom: '11px',
                    }}
                />
            ) : null}
            <i
                className={
                    `${TO_THE_TOP_CLASSNAME} bi bi-arrow-up-circle ` +
                    `${HoverMotionHandler.lowVisibleClassname}-1`
                }
                title={tran('Scroll to the top')}
                style={{
                    width: '45px',
                    height: '45px',
                    ...style,
                }}
                ref={(element) => {
                    if (element) {
                        applyToTheTop(element, scrollingContainerSelector);
                    }
                }}
            />
        </>
    );
}
