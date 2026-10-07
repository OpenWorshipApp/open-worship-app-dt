// The font stack `screen.scss` gives the screen window's `body`, written out
// again for whatever draws screen content OUTSIDE that window -- the
// presenter's mini preview, the slide thumbnails, the slide editor's canvas.
// Those live in a page whose app font (Settings -> General -> Font Family)
// is set on EVERY element (`boot.ts`), so anything left to inherit read in
// that font there and in this one on the projector. Keep the two the same.
export const SCREEN_FONT_FAMILY =
    "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue'," +
    " 'Noto Sans', 'Liberation Sans', Arial, sans-serif, 'Apple Color Emoji'," +
    " 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'";
