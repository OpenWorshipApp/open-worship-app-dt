// How a window reads when its UI language is written right to left.
//
// The window is NOT mirrored. Putting `dir="rtl"` on `<html>` (2026-11-04,
// the first Hebrew pass) flipped everything that is not the UI's own words
// along with it: an English Bible's verse bar ran 25..1, its search results
// sat ragged on the right with the full stop walked to the front
// (`.the trees of the garden`), the Reader's tabs and titles reversed, and
// every English label a partial dictionary falls back to did the same. And
// `direction` is inherited into the shadow roots the slide previews draw in,
// so a preview stopped matching what the screen shows.
//
// So the layout stays left to right and every TEXT takes the direction of its
// own words instead: `unicode-bidi: plaintext` gives each paragraph (and each
// inline element) the direction of its first strong letter -- the `dir="auto"`
// of HTML, for every element at once. A Hebrew label reads right to left with
// its punctuation where Hebrew puts it; an English verse, a file name or an
// untranslated label stays exactly as it is in English.
//
// Both rules are `:where()`, specificity zero, so any stylesheet of the app
// that sets `unicode-bidi` itself wins without a fight (a cascade `@layer`
// would say the same, but jsdom's CSS parser cannot read one). They leave
// alone:
// - an element that says its direction (`[dir]`, `bdo`, `bdi`) and everything
//   inside it: a Bible view declares its Bible's direction and keeps it;
// - `.app-ellipsis-left`, whose `direction: rtl` exists only to put the
//   ellipsis on the left -- plaintext would move it back (`appInit.scss`);
// - Monaco, which maps the caret on the line direction it set itself;
// - SVG text.
// A Hebrew label puts the icon written before it on its RIGHT, so the gap a
// Bootstrap `me-*` / `ms-*` gives that icon on one physical side lands on the
// outside and the icon touches the word: an icon with one gets HALF of it on
// each side instead, whichever side its word is on. Never more in all: the
// 132px settings column has no pixel to spare (three quarters a side already
// wrapped "Import Settings").
// Nothing here is injected for a left-to-right language.
export const UI_TEXT_DIRECTION_STYLE_ID = 'app-ui-text-direction';
export const UI_TEXT_DIRECTION_ATTRIBUTE = 'data-ui-direction';

export const UI_TEXT_DIRECTION_CSS = `
:where(body *:not([dir], bdo, bdi, .app-ellipsis-left)) {
    unicode-bidi: plaintext;
}
:where([dir] *, .monaco-editor *, svg *) {
    unicode-bidi: revert;
}
.bi.me-1, .bi.ms-1 { margin-inline: 0.125rem !important; }
.bi.me-2, .bi.ms-2 { margin-inline: 0.25rem !important; }
`;

export function applyUiTextDirection(isRtl: boolean) {
    const root = document.documentElement;
    // Never a `dir` on the root: the layout is the same in every language.
    root.removeAttribute('dir');
    let style = document.getElementById(
        UI_TEXT_DIRECTION_STYLE_ID,
    ) as HTMLStyleElement | null;
    if (!isRtl) {
        root.removeAttribute(UI_TEXT_DIRECTION_ATTRIBUTE);
        style?.remove();
        return;
    }
    root.setAttribute(UI_TEXT_DIRECTION_ATTRIBUTE, 'rtl');
    if (style === null) {
        style = document.createElement('style');
        style.id = UI_TEXT_DIRECTION_STYLE_ID;
        document.head.appendChild(style);
    }
    style.textContent = UI_TEXT_DIRECTION_CSS;
}
