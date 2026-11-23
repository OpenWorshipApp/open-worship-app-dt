import { uiFamily } from '../lang/data/en/fonts.json';

// The font stack `screen.scss` gives the screen window's `body`, written out
// again for whatever draws screen content OUTSIDE that window -- the
// presenter's mini preview, the slide thumbnails, the slide editor's canvas.
// Those live in a page whose app font (Settings -> General -> Font Family)
// is set on EVERY element (`boot.ts`), so anything left to inherit read in
// that font there and in this one on the projector. Keep the two the same.
// English's face heads both: the app's default on every page (2026-11-06),
// read from its package (`data/en/fonts.json` `uiFamily`), the one place it
// is named -- a named import, so the bundle takes that string and not the
// file's list of faces.
export const SCREEN_FONT_FAMILY =
    uiFamily +
    ", system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue'," +
    " 'Noto Sans', 'Liberation Sans', Arial, sans-serif, 'Apple Color Emoji'," +
    " 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'";
