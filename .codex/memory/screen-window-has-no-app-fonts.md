---
name: screen-window-has-no-app-fonts
description: FIXED twice — lyric slides are measured in whatever @font-face rules are REGISTERED when open-lyric builds them; the screen window had none (2026-08-04) and the Presenter raced for them (2026-09-12)
metadata: 
  node_type: memory
  type: project
  originSessionId: c198aac0-2cd5-4ab8-9af1-ae954ae47a12
  modified: 2026-09-12T23:55:10.529Z
---

open-lyric freezes every line of a lyric slide into pixel boxes (inline
`width`/`height`) measured with the fonts the window has **registered** at that
moment. A song set in `app-Battambang`, built before the Khmer `@font-face`
rules exist, is measured in the browser's fallback and then drawn in
Battambang, so the frozen boxes no longer fit the text. Two windows hit it:

1. **`screen.html` — fixed 2026-08-04 (`b32e9e0c`).** It deliberately does NOT
   run `boot.ts`'s `init()` (the one entry point that loads no locale of its
   own), and `getAllLangsAsync()` only fetches, so the projector registered no
   `@font-face` at all: text clipped, one word per line, with scrollbars, while
   the operator's preview looked perfect. `src/screen.tsx` calls
   `void initAllLangCss()` after `main()`.
2. **`presenter.html` — fixed 2026-09-12.** An English UI registers only its own
   locale's CSS (en's `genCss` is empty); the Khmer faces arrived only when an
   unrelated panel (a Khmer bible item, a note) asked for them. The Stage
   Previewer, built first after a Reader → Presenter switch, was measured in
   Times New Roman, and Battambang's Latin letters run ~19% wider (measured off
   the two font files), so long lines wrapped inside their frozen boxes and
   printed over the next line — in the previewer AND on the projector, which
   shows that same snapshot. A reload looked like a fix only when the other
   panel happened to win the race. `initOpenLyric`
   (`src/lyric-list/lyricHelpers.ts`) now awaits `initAllLangCss()` instead of
   `getAllLangsAsync()`, and `initAllLangCss` is ONE shared promise per window,
   forgotten on failure — rewriting a `<style>` of `@font-face` rules re-creates
   the faces for the whole window, and open-lyric builds a song on every cache
   miss. `lyricHelpers.test.ts` holds the order.

Slides built before a fix stay wrong until rebuilt: a pane keeps its slides
until an `update` event (the previewer's ⋮ Reload), and the projector keeps its
snapshot until the slide is presented again.

Because `init()` never runs in `screen.html`, `initFontFamily()`'s user
`app-custom-style` (`* { font-family/font-weight }` from Settings) is NOT
applied there — the projector renders open-lyric's frozen inline styles — so
"the screen ignores my app font setting" is expected behaviour, not this bug.

**How to apply:** a lyric line that wraps or overprints in some sessions and not
others is a font REGISTRATION race, never a CSS bug: the boxes are right for the
font they were measured in. Waiting on `document.fonts.ready` does not help — an
unregistered family starts no load, and open-lyric already waits after mounting.
To tell which font a broken card was measured in, read `.ol-preview-line`'s
inline `width` by hand in DevTools (`evaluate_script` is refused), and check
whether `style#lang-km` exists at that moment. Measure the projector on the real
`screen.html` target, never in the mini preview. See
[[lyric-subsystem-architecture]].

A fix attempt via stage CSS (`height: auto !important` in
`LyricAppDocumentStage0/1`) is **inert** — open-lyric applies the stylesheet,
measures, then serializes computed values back into inline styles, so `auto` is
resolved away before render.
