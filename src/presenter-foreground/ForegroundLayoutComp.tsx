import './foregroundWidgets.scss';

import type { CSSProperties, ReactNode } from 'react';

/**
 * The body of one foreground component.
 *
 * There is no card header and no collapse chevron any more: every component
 * now opens in its OWN floating panel, and that panel already carries the
 * name, the on-screen mark and a close button. A second header inside it said
 * the same word twice and hid the controls behind an extra press.
 *
 * It adds NO scroller either -- the panel's own `.floating-widget__content`
 * is the one scrollport, which is what lets a media widget's session bar
 * `position: sticky` to the top of it. A second scroller nested inside also
 * shrank the windowed file grid's visible band to a couple of rows.
 *
 * It carries the body stylesheet because every foreground component renders
 * through it -- including the two that keep a border of their own, since
 * they sit in a LIST and the border is what separates one item from the next
 * rather than a card around a card.
 */
export default function ForegroundLayoutComp({
    target,
    children,
    extraBodyClassName,
    extraBodyStyle,
}: Readonly<{
    target: string;
    children?: ReactNode;
    extraBodyClassName?: string;
    extraBodyStyle?: CSSProperties;
}>) {
    return (
        // The target is exposed so anything referencing this foreground (a
        // presenting flow row) can find and highlight the panel it came from.
        <div
            className={'w-100 ' + (extraBodyClassName ?? '')}
            style={extraBodyStyle}
            data-foreground-target={target}
        >
            {children}
        </div>
    );
}
