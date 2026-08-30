---
name: screen-window-has-no-app-fonts
description: FIXED 2026-08-04 — screen.tsx skipped boot's init() and getAllLangsAsync never registered CSS, so the projector had zero @font-face and lyric text silently reflowed
metadata:
  type: project
---

Two independent gaps meant the `screen.html` window registered **no `@font-face`
at all**, so anything asking for `app-Battambang` (lyric slides do — open-lyric
freezes the family name into its inline style dump) fell back to a system font
that measures ~14–24% wider. Text reflowed, overflowed the heights open-lyric
freezes inline, and rendered clipped/one-word-per-line **with scrollbars** on the
live output, while the operator's preview looked perfect.

Both fixed 2026-08-04 (`b32e9e0c`), in the shape the code still has:

1. `src/screen.tsx` deliberately does NOT run `boot.ts`'s `init()` — it is the
   one entry point that loads no locale of its own. It calls
   `void initAllLangCss()` after `main()` instead (`src/screen.tsx:53`).
2. `initAllLangCss()` (`src/lang/langHelpers.ts:694`) loads every language
   module via `getAllLangsAsync()` and runs `initLangCss` on each, so EVERY
   language's `@font-face` is registered regardless of UI locale.
   `getAllLangsAsync()` itself only fetches — do not expect it to register CSS.

Because `init()` never runs there, `initFontFamily()`'s user `app-custom-style`
(`* { font-family/font-weight }` from Settings) is NOT applied in `screen.html`
— consistent with the design (the projector renders open-lyric's frozen inline
styles) — so "the screen ignores my app font setting" is expected behaviour,
not this bug.

**How to apply:** measure `document.fonts.size` on the real `screen.html` CDP
target, never by eye and never in the mini preview (same renderer as the
presenter, so it always has the fonts). Verified fix: screen and presenter now
return byte-identical layout metrics for all 12 lyric line boxes. See
[[lyric-subsystem-architecture]].

Corollary worth remembering: a fix attempt via stage CSS (`height: auto
!important` in `LyricAppDocumentStage0/1`) is **inert** — open-lyric applies the
stylesheet, measures, then serializes computed values back into inline styles, so
`auto` is resolved away before render. That also means frozen heights are always
correct *for the renderer that generated them*; a mismatch is always a
font/width difference between renderers, not a CSS bug.
