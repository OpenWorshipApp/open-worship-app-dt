---
name: foreground-preset-dark-light-and-saved
description: "Foreground Presets row: Dark/Light is a CALCULATION on the session's own colours (hue and alpha kept, lightness moved to 4.5:1), read off the words never stored; unset colours follow the app theme via #app's data-bs-theme; a preset goes on in the side shown; Save as Preset keeps the whole Properties per component and puts it back exactly; every text preset sets its font size"
metadata:
  node_type: memory
  type: project
  originSessionId: 4beaed3f-cc02-4824-90ed-28b6fb96ccef
  modified: 2026-11-10T02:11:50.581Z
---

The Presets row of every foreground component's Properties
(`ForegroundPresetsComp.tsx`), as the user shaped it on 2026-11-09 in a
string of asks. What is decided, and not obvious from the code:

- **Dark / Light is a calculation, not a palette per preset** (_dark/light
  just do calculation to make current text and background color contrast_,
  _do not change background color but make it darker/lighter_, _make text
  color lighter/darker_). `genForegroundContrastColors`
  (`foregroundContrastHelpers.ts`, pure) keeps each colour's hue,
  saturation and alpha, mirrors its lightness to the asked side, then moves
  the words and, once they can go no further, the box toward black/white
  until 4.5 : 1 over a slide of that side. A colour already on its side
  comes back as the same string, so pressing the lit side writes nothing.
  Hand-written light palettes were built first and thrown away on that ask.
- **The side is read off the words' colour, never stored**
  (`toForegroundColorMode`), like the Bible text's switch
  ([[bible-text-style-looks-and-presets]]). A preset's colours are its Dark
  side; pressed, it goes on in the side shown (_and apply to the preset_).
  The marquees' own Dark / Light presets became the switch; their presets
  are Announcement, Bible Verse (speed 70), Urgent Alert. Pictures (no
  Common Style) have no switch.
- **Unset colours follow the app theme** (_same with app theme (if not set
  by user)_): `getForegroundDefaultColors` (`foregroundThemeColorHelpers.ts`)
  reads `#app`'s `data-bs-theme`, NOT `themeHelpers` -- that module pulls
  `appProvider` into the pure preset code and broke a dozen test files. No
  `#app` (a screen page, a test) = dark, the old defaults. The pure helpers
  take the defaults as a parameter from callers that know the theme.
- **Save as Preset is exact** (_allow saving the setting to a new preset_):
  `foregroundSavedPresetHelpers.ts`, one setting per component
  (`foreground-<key>-saved-presets`, 30 max), the WHOLE Properties by field
  name (font, layer, transition included -- unlike the app's presets) and a
  marquee's own size and speed; applying writes every saved field and
  REMOVES every other look key, so nothing of the replaced look stays. Not
  turned by the switch. The popups/menu are imported on a press, not with
  the row (they broke node-env tests statically and are rarely used).
- **Every text preset says its font size, at scale 1** (the user's picture
  of a clock's digits past its 22% box: _make sure all preset define well
  styling_): the Time panel had a Font Size row all along (default 100px)
  while `CLOCK_FLAGS` said it had none -- fixed to `isFontSize: true`. And
  `TIMER_BOX_STYLE` (`min-width: max-content`) keeps a countdown's,
  stopwatch's or clock's box at least as wide as its `nowrap` digits; the
  clock's caption is `width: 0; min-width: 100%` so a long city name wraps
  instead of widening it.

**Why:** each looks like something to simplify (store the side, give each
preset a light palette, read the theme from `themeHelpers`, let a saved
preset follow the switch) and each was chosen or measured.

**How to apply:** keep the switch a calculation and derived; pass theme
defaults in rather than importing the theme into pure helpers; keep saved
presets exact. Related: [[foreground-effects-one-setting]],
[[foreground-session-owns-overlay]].
