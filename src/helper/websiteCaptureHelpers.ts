/**
 * Sizing rules for a website item's screenshot, kept in a LEAF module (no
 * imports) on purpose: the consumers are the slide editor, the screen managers
 * and the print helper, and pulling these two pure functions out of
 * `slide-editor/canvas/canvasHelpers` keeps the screen from eagerly loading
 * that module's whole dependency chain.
 */

/**
 * A website item's screenshot is captured at the item's OWN box size, never at
 * the display bounds. Two reasons, both load-bearing:
 *
 * - ONE cache key. `captureWebScreenShot` keys on `url-width-height-delay`.
 *   Because every surface renders the same item, a box-derived size makes the
 *   editor canvas, the Canvas Items list, the slide thumbnails, the mini screen
 *   and print all hit the SAME key. A per-surface size would thrash the cache
 *   and spawn a hidden BrowserWindow per surface.
 * - Size. The result is a base64 PNG held in the cache, in React state and in
 *   the DOM at once; 1920x1080 is megabytes of string, 800x600 a fraction of
 *   it.
 *
 * It is also the more faithful preview: the projected iframe is laid out at
 * exactly `props.width x props.height`, and a responsive page reflows
 * completely between that and 1920px.
 */
export const WEBSITE_CAPTURE_MAX_SIDE = 960;

export function genWebsiteCaptureSize(width: number, height: number) {
    const scale = Math.min(
        1,
        WEBSITE_CAPTURE_MAX_SIDE / Math.max(width, height, 1),
    );
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
    };
}

// Reads back what the renderer stamped into `WEBSITE_CAPTURE_SIZE_ATTR`, for
// the consumers that only ever see the rendered markup.
export function parseWebsiteCaptureSize(value: string | null) {
    const matched = /^(\d+)x(\d+)$/.exec(value ?? '');
    if (matched === null) {
        return null;
    }
    const width = Number.parseInt(matched[1], 10);
    const height = Number.parseInt(matched[2], 10);
    if (width < 1 || height < 1) {
        return null;
    }
    return { width, height };
}
