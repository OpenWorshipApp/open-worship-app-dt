// The font stack `screen.scss` gives the screen window's `body`, written out
// again for whatever draws screen content OUTSIDE that window -- the
// presenter's mini preview, the slide thumbnails, the slide editor's canvas.
// Those live in a page whose app font (Settings -> General -> Font Family)
// is set on EVERY element (`boot.ts`), so anything left to inherit read in
// that font there and in this one on the projector. Keep the two the same.
// `app-Google-Sans` heads both: English's face, the app's default on every
// page (2026-11-06, `data/en/fonts.json`).
export const SCREEN_FONT_FAMILY =
    'app-Google-Sans,' +
    " system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue'," +
    " 'Noto Sans', 'Liberation Sans', Arial, sans-serif, 'Apple Color Emoji'," +
    " 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'";
