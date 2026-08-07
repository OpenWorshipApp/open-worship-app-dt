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

Both fixed 2026-08-04 (uncommitted on refactor23):

1. `src/screen.tsx` never called `init()` from `src/boot.ts` — the only entry
   point that didn't. That is what runs `initFontFamily()` and
   `getLangDataAsync(locale)` → `initLangCss()`. Now `await init()` before `main()`.
2. `getAllLangsAsync()` loaded every language module but bypassed
   `getLangDataAsync`, so it never called `initLangCss`. It now registers each
   language's CSS. This is the half that matters when the **UI locale differs
   from the content locale** (English UI + Khmer lyric) — the state the bug was
   found in.

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
