import './StickyAutoHideComp.scss';

import type { ReactNode } from 'react';
import { useCallback } from 'react';

import {
    applyStickyAutoHide,
    STICKY_AUTO_HIDE_CLASSNAME,
} from './stickyAutoHideHelpers';

/**
 * Pins its children to the top of the nearest scrolling ancestor, hides them
 * while the user scrolls down and brings them back on a quick scroll up or
 * whenever the content is back at the top.
 */
export default function StickyAutoHideComp({
    className = '',
    children,
}: Readonly<{
    className?: string;
    children: ReactNode;
}>) {
    const handleElementSetting = useCallback(
        (element: HTMLDivElement | null) => {
            if (element === null) {
                return () => {};
            }
            return applyStickyAutoHide(element);
        },
        [],
    );
    return (
        <div
            className={`${STICKY_AUTO_HIDE_CLASSNAME} ${className}`}
            ref={handleElementSetting}
        >
            {children}
        </div>
    );
}
