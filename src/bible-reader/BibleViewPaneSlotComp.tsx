import { useLayoutEffect, useRef } from 'react';

import { useBibleViewPaneHostContext } from './bibleViewPaneHelpers';

/**
 * Where one bible view goes in the split layout. Cheap to rebuild: it is an
 * empty, boxless element the view's own element is moved into.
 */
export default function BibleViewPaneSlotComp({
    bibleItemId,
}: Readonly<{
    bibleItemId: number;
}>) {
    const host = useBibleViewPaneHostContext();
    const slotRef = useRef<HTMLDivElement>(null);
    // A LAYOUT effect: the view must be in place before the browser paints,
    // and its cleanup must run while the old slot is still in the document,
    // so the scroll offsets it reads are still there to read.
    useLayoutEffect(() => {
        const slot = slotRef.current;
        if (host === null || slot === null) {
            return;
        }
        return host.attach(bibleItemId, slot);
    }, [host, bibleItemId]);
    return (
        <div
            ref={slotRef}
            className="bible-view-pane-slot"
            style={{ display: 'contents' }}
        />
    );
}
