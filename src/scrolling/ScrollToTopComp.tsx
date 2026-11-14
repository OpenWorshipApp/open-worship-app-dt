import type { CSSProperties } from 'react';

import { pressElementLikeButton } from '../helper/helpers';
import { tran } from '../lang/langHelpers';
import {
    TO_THE_TOP_CLASSNAME,
    TO_THE_TOP_STYLE_STRING,
    applyToTheTop,
} from './scrollingHandlerHelpers';

/**
 * The arrow in the corner of a scrolled box that takes it back to the top,
 * shown once the box has left its top (`applyToTheTop`), with the sheet that
 * draws it. A module of its own so a window wanting only this -- the
 * Markdown Preview -- does not load `ScrollingHandlerComp`'s auto-scroll and
 * its menu with it; `ScrollingHandlerComp` draws its own arrow with this.
 *
 * The box it scrolls is its parent, or the ancestor
 * `scrollingContainerSelector` names. It is `position: absolute`, so the
 * corner it sits in is its nearest positioned ancestor's: one outside the
 * scrolling box keeps it still while the box scrolls.
 */
export default function ScrollToTopComp({
    className,
    style,
    scrollingContainerSelector,
}: Readonly<{
    className?: string;
    style?: CSSProperties;
    scrollingContainerSelector?: string;
}>) {
    return (
        <>
            <style>{TO_THE_TOP_STYLE_STRING}</style>
            <i
                className={
                    `${TO_THE_TOP_CLASSNAME} bi bi-arrow-up-circle` +
                    (className === undefined ? '' : ` ${className}`)
                }
                title={tran('Scroll to the top')}
                role="button"
                tabIndex={0}
                aria-label={tran('Scroll to the top')}
                onKeyDown={pressElementLikeButton}
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
