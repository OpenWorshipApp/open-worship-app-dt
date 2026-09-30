---
name: chatbot-foreground-door
description: "A countdown, clock, stopwatch, marquee or quick text goes up by its WORDS through owa_foreground — the Foreground tab is a toggle whose boxes no press can drive; /countdown and /marquee do it with no model; a pressed panel tab now reports its state; the clear commands clear a layer held on an OFF screen"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1afd4bb0-f8a1-4bac-af61-080071aa1c08
  modified: 2026-09-11T15:51:38.317Z
---

`owa_foreground` (2026-09-11) is the foreground widgets' door, the third
rung-6 ask shape after the verse (`owa_present_bible`) and the song page
(`/lyric`). Measured first: *Start a 5 minute countdown on the screen* on
Sonnet 5 was 8 rounds / $0.08 for four steps, then the *Yes, start it now*
under them ran to the ten-round cap ($0.10) and started nothing — the model
pressed **Foreground** (a TOGGLE) and closed the panel it had opened, and
`owa_click` said `didChange: false` because a tab keeps its state in the
`active` class. Now: one call, 2 rounds, 7 s; `/countdown 5` 3 s, no model.

**Why:** the Foreground panel is a form written for a person (`m Minutes`,
**Start Countdown**, a date and time picker), exactly the shape the Bible
Lookup had. A picker no step can drive gets a door: the app's own setters
(`ScreenForegroundManager.setCountdownData` and siblings) on the TICKED
screens, the widget's own defaults, the screens read back. Six widgets share
one schema (+491 tokens a round) rather than six tools.

**How to apply:**

- Files: `tools/owa-devtools-mcp/agentForeground.mjs` (+ `.d.mts`, the
  describer the renderer shares), `src/helper/agentForegroundHelpers.ts`
  (the worker), the `owa-agent-foreground` relay in `domHelpers.ts` (lazy
  import). `widget` countdown | stopwatch | clock | marquee-top |
  marquee-bottom | quick-text | all (stop only); `minutes` OR `at` (a clock
  time today; one gone by is refused); `text` (≤ 300); `seconds` for a quick
  text (default 10 — the widget's own default of 3 is too short for an
  announcement). A stop of a widget not on is `did: stopped` with a note.
- `stateOf` in `genClickExpression` (`domMatch.mjs`) reads `aria-selected`
  and `.nav-link.active`, so a tab press answers `isOnNow`. Nothing yet tells
  the model BEFORE the press that a tab toggles — `owa_app_state.tabs` says
  which are open; read it before pressing one.
- `/clear-*` commands read `controls.clear[].hasSomething` into
  `clearable`: a layer held on an off screen is cleared, and a Clear press
  (a plain button the press-verification cannot read) is proven by the
  layer reading empty afterwards — never by the click.
- Left open: [[chatbot-in-the-middle-of]]'s song-by-name path presents the
  wordless **First** slide and turns the screen ON where the verse path
  offers the button (`EC-169`); the background demo cannot double-click a
  video (`EC-170`). Related: [[chatbot-verse-by-reference]],
  [[click-reports-effect-not-action]], [[chatbot-builtin-commands]].
