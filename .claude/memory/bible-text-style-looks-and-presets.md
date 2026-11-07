---
name: bible-text-style-looks-and-presets
description: "Bible/LongText Properties (renamed from Bible Properties 2026-11-06; a Long Text Show is drawn in it too): looks are in em and kept as effect + the textShadow it comes out as; the screen reads textShadow alone; the Dark/Light switch is read off the colour and also picks the selection band (one colour per side); a preset is the WHOLE style; Reset keeps the size"
metadata:
  node_type: memory
  type: project
  originSessionId: 33d4368d-2c69-4d2b-8951-f48932510f71
  modified: 2026-11-07T00:50:18.826Z
---

Bible/LongText Properties (`src/screen-setting/BibleCustomStyleComp.tsx`, redesigned
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

- **One panel for both layers' text** (2026-11-06, the user: _rename `Bible
  Properties` to `Bible/LongText Properties`_, _make … be properties setting of
  both bible and long text show_, _make sure all style that apply to bible have
  to apply to long text as well_). A Long Text Show goes up in the same
  `#bible-screen-view` and is drawn by the same `tr` rule; its panel has the
  same toggle beside **Add Language**. A long text's language may set only
  its own font family and its size (`LongTextColumnStyleType`), both unset
  until chosen on its card — _keep font-family_ _and font-size, because some
  font-family make different size_, _so those 2 unset by default then
  override_. Its colour, weight and alignment rows were removed; a column
  saved with them is read without them (`readLongTextColumnStyle`).
- **The selection band has a colour per side** (2026-11-06, _make the
  highlight background color be customizable … between dark/light_; the user
  chose one colour for each). `highlightColorDark` (default the old pink
  `#FF009D33`) and `highlightColorLight` (`#006EFF33`); the screen draws the
  one for the side the words are on, so Dark/Light swaps it. Only a CHOSEN
  band rides in the `tr` rule (`& .highlight.selected`); the default is
  `ScreenBibleComp`'s own sheet, picked by the words' colour — so an untouched
  style is still exactly its three declarations (a test holds that). Compared
  case-insensitively: the picker writes lowercase hex. In the panel it is a
  SECTION of its own under the text rows (_add a section … (default
  pink/blue)_): a row per side, an arrow back to that side's default.

**Why:** each of these looks like something to tidy, and each was chosen.

**How to apply:** when touching the panel or `bibleTextStyleHelpers.ts`, keep
the pair, the derived switch and the full-overwrite patch. Related:
[[screen-page-settings-are-page-local]], [[foreground-effects-one-setting]].
