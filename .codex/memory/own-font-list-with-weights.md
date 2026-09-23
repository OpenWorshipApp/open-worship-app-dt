---
name: own-font-list-with-weights
description: "npm `font-list` is gone; `electron/fontListHelpers.ts` lists families WITH real weights; its macOS/Linux branches never ran on a real machine"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7aef229c-9105-44c8-b431-cc7116487d34
  modified: 2026-09-15T23:21:59.369Z
---

The npm `font-list` package was removed 2026-09-15. It could name a family but
never its weights, so `main:app:get-font-list` answered every family with `[]`
and the weight select in `FontFamilyControlComp` (Slide Editor, Settings,
Foreground) never rendered. `electron/fontListHelpers.ts` replaces it and
answers `{ family: ['400', '700'] }` in CSS weights.

- **Windows** is WPF in one PowerShell (`-EncodedCommand`, full path to
  `powershell.exe`), plus the per-user font folder. Measured on the dev
  machine: ~2.3 s with PowerShell start-up, 245 lines. The user's research
  script `extra-work/font/find-font-files.ps1` took ~11 s and guessed the style
  from the FILE NAME (`segoeuib.ttf` and `Battambang-Bold.ttf` both came out
  Regular), so it was kept as research, not shipped.
- **It must be `GetTypefaces()` with `IsBoldSimulated` faces dropped, NEVER
  `FamilyTypefaces`** (robot test 2026-09-15). `FamilyTypefaces` lists the
  faces WPF would SIMULATE as well as the ones on disk, so every single-weight
  family answered `400,700`: measured across all 240 installed families, 113
  lists differed, including the Khmer `Moul` and `Khmer OS Battambang` and one-
  file fonts like Jokerman and Algerian. Two consequences it caused: the weight
  picker offered a **Bold that only Chromium's synthetic bold could draw**, and
  `isShowingFontWeight` (`options.length > 1`) never hid the picker for a
  one-weight family (9 such families by that list against 122 real ones).
  `electron/fontListHelpers.test.ts` asserts the script contains
  `GetTypefaces()` and `IsBoldSimulated` and NOT `FamilyTypefaces` — the parser
  tests cannot see this, because it is what WPF returns, not how it is parsed.
- **macOS** (JXA `NSFontManager`, then `system_profiler -json`) and **Linux**
  (`fc-list`) were written and unit-tested on synthetic output only. Nothing
  here has run them.
- Weight NAMES (`700 Bold`) are not `tran()`'d: the Khmer key `Light` already
  means the light theme, and keys are case-insensitive, so a weight key would
  collide.

**Why:** the Mac/Linux branches look finished and are not proven; a
blank or wrong weight list on those machines is most likely a parser meeting
real output for the first time.

**How to apply:** on a Mac or Linux robot run, open a text box's Font section
and check the weight select lists more than `Default` for a multi-weight
family before trusting it; fix the parser against the real output. See
[[tran-missing-key-throws-in-dev]].
