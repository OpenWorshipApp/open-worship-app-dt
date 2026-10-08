import { useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

function subscribe(onChange: () => void) {
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
}

function getFullscreenElement() {
    return document.fullscreenElement ?? null;
}

/** Keep an overlay inside the browser's fullscreen top layer. */
export default function FullscreenPortalComp({
    children,
}: Readonly<{ children: ReactNode }>) {
    const fullscreenElement = useSyncExternalStore(
        subscribe,
        getFullscreenElement,
        () => null,
    );
    // Keep the usual parent and its styles outside fullscreen. A z-index on
    // that parent cannot lift a menu or popup above a fullscreen sibling.
    return fullscreenElement === null
        ? children
        : createPortal(children, fullscreenElement);
}
