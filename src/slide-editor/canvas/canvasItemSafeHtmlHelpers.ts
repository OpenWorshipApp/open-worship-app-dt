import { createContext, use, useMemo } from 'react';

import { sanitizeHtml } from '../../helper/sanitizeHelpers';

// An item's markup, already through the raw policy. `genSlideHtml` provides
// it so that nothing parses HTML INSIDE its static render. React runs off
// Node's `setImmediate` in this app's windows, and there Chromium's parser
// runs every waiting promise callback before it returns. One of those
// rendering another slide wiped the hook state the first render was still
// writing to: "Cannot set properties of null (setting 'memoizedState')".
export const CanvasItemSafeHtmlContext = createContext<string | null>(null);

export function genCanvasItemSafeHtml(html: unknown) {
    return typeof html === 'string' ? sanitizeHtml(html) : '';
}

export function useCanvasItemSafeHtml(html: unknown) {
    const safeHtml = use(CanvasItemSafeHtmlContext);
    // Nothing is provided in the editor, where the memo keeps a moved or
    // resized box from being parsed again.
    return useMemo(() => {
        return safeHtml ?? genCanvasItemSafeHtml(html);
    }, [safeHtml, html]);
}
