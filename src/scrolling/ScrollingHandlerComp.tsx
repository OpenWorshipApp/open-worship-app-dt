import { CSSProperties } from 'react';

import {
    TO_THE_TOP_STYLE_STRING,
    TO_THE_TOP_CLASSNAME,
    applyToTheTop,
    applyPlayToBottom,
    MoveCheckType,
    PLAY_TO_BOTTOM_CLASSNAME,
} from './scrollingHandlerHelpers';

export default function ScrollingHandlerComp({
    style,
    shouldShowPlayToBottom = false,
    movedCheck,
}: Readonly<{
    style?: CSSProperties;
    shouldShowPlayToBottom?: boolean;
    movedCheck?: MoveCheckType;
}>) {
    return (
        <>
            <style>{TO_THE_TOP_STYLE_STRING}</style>
            {shouldShowPlayToBottom ? (
                <i
                    className={
                        `${PLAY_TO_BOTTOM_CLASSNAME} bi bi-chevron-double-down` +
                        ' app-caught-hover-pointer' +
                        ' app-low-hover-visible-1'
                    }
                    style={{
                        width: '45px',
                        height: '45px',
                    }}
                    ref={(element) => {
                        if (element) {
                            applyPlayToBottom(element, movedCheck);
                        }
                    }}
                />
            ) : null}
            <i
                className={
                    `${TO_THE_TOP_CLASSNAME} bi bi-arrow-up-circle ` +
                    'app-low-hover-visible-1'
                }
                title="Scroll to the top"
                style={{
                    width: '45px',
                    height: '45px',
                    ...(style ?? {}),
                }}
                ref={(element) => {
                    if (element) {
                        applyToTheTop(element);
                    }
                }}
            />
        </>
    );
}
