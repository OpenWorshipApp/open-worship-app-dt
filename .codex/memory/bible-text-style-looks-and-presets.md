---
name: bible-text-style-looks-and-presets
description: "Bible Properties: looks are in em and kept as effect + the textShadow it comes out as; the screen reads textShadow alone; the Dark/Light switch is read off the colour; a preset is the WHOLE style; Reset keeps the size"
metadata:
  node_type: memory
  type: project
  originSessionId: 33d4368d-2c69-4d2b-8951-f48932510f71
  modified: 2026-10-12T01:26:35.148Z
---

Bible Properties (`src/screen-setting/BibleCustomStyleComp.tsx`, redesigned
2026-10-11 on the user's ask) edits ONE setting object,
`screen-bible--style-text`. What is decided, and not obvious from the code:

- **A look is in `em`, never `px`.** The outline, shadow and glow sliders
  write `effect` (the numbers) AND `textShadow` (the CSS they come out as,
  `genBibleTextShadow`). A screen reads `textShadow` alone, so an older
  release, an imported `.owasetting` and a Screen Mirror peer still draw it.
  `effect` is trusted only while it still generates exactly that
  `textShadow`; otherwise the sliders open on nothing and the typed
  **Text Shadow** row is lit. Do not "simplify" the pair into one field.
- **Dark / Light is not stored.** It is read off the colour of the words
  (`toBibleBackdrop`), so the contrast fix a colour background makes moves the
  switch too. Pressing it carries the look across (edge colours flipped), it
  does not reset it.
- **A preset is the whole style, size and colour included**
  (`screen-bible--style-presets`, 30 at most, presenter-only, never synced to
  a screen). Pressing one REPLACES the style: `genBibleTextStylePatch` names
  every key, the defaults as `undefined`, so nothing of the old style is left
  behind. **Reset keeps the size** on purpose.
- **A chosen font has to beat a verse's own** (`fontFamily`, added
  2026-10-11 on the user's ask, _should have font-family_). A Bible whose
  language brings a font (Khmer's `app-Battambang`) says it INLINE on every
  verse and heading, so the `tr` rule also publishes `--bible-font-family` and
  that inline style reads it first, its own font behind it
  (`genLangFontFamily`). Not `!important` on the cell: a Latin font picked for
  the English column would leave the Khmer column beside it in a system
  fallback instead of Battambang. No weight picker beside the list on purpose —
  **Bold** is the weight here — and **Reset** clears the font (only the size
  stays). Neither place a verse is drawn has the app-font `*` rule: the screen
  page never runs `boot.ts`, and the Mini Screen is a shadow root.
- **Changes go out at most every 80 ms** (`useBibleTextStyleEditing`,
  `genThrottleAttempt`): each one is a synchronous setting write, a message to
  every screen and a repaint of a screen of outlined text. The controls draw
  from a local copy, or a dragged thumb jumps back to its last commit.
- The cell rules (`line-height`, `text-align`) ride in the `tr` rule as a
  nested `& td` block so `ScreenBibleComp` and its test mocks did not change;
  `text-align` is `!important` because a right-to-left column sets its side
  inline.

**Why:** each of these looks like something to tidy, and each was chosen.

**How to apply:** when touching the panel or `bibleTextStyleHelpers.ts`, keep
the pair, the derived switch and the full-overwrite patch. Related:
[[screen-page-settings-are-page-local]], [[foreground-effects-one-setting]].
