---
paths:
  - "tools/owa-devtools-mcp/**"
  - "src/helper/agent*.ts"
  - "src/helper/domHelpers.ts"
  - "src/toast/DailyTipComp.tsx"
  - "src/resize-actor/FlexResizeActorComp.tsx"
  - ".claude/skills/owa-enhance-chatbot/scripts/**"
---

# Agent tools: what the `owa_*` tools do

How each app-level MCP tool behaves and why — the walkthrough card, the demos,
the state and screens readers, the acting tools, the document and data tools.
The doors and the firewall: `agent-access.md`.

- **A press is reported as what it CHANGED, not as what it hit** (2026-09-03).
  `owa_click` used to answer `clicked: <the control>` and stop, which is a tool
  reporting its own ACTION where the caller needs the action's EFFECT — and a
  model that manages to click something then reports the goal achieved. Asked to
  turn a projector on, it pressed a toolbar-reveal decoration and said _"Done —
  the screen is now showing"_ to a room with nothing on the wall. The answer now
  carries `isOnNow` (a control with an on/off state), `didChange`, and
  `unverified` — a SENTENCE, not a flag, because a missing key is something a
  model infers past. The control is read back ~250 ms AFTER the press: this app
  re-renders on an event, so reading it straight away reports the state before.
  Three kinds of evidence, weakest last — a control that is GONE did something, a
  toggle that flipped is the state itself, a label that turned Show into Hide is
  the same fact in words. The other half was the AIM: `handleAutoHide` injected
  four `<i title="Show">` decorations into the presenter's auto-hide footers, and
  `matchTier` ranks an exact label above every looser fit, so the bare word beat
  the screen's own `Toggle showing screen` control every time. They are
  `Reveal Hidden Controls` now — renaming them to _Show Hidden Controls_ first
  still won `Show` on a whole-word match, so the word had to LEAVE the label
  rather than move within it. `ShowHideScreen`'s own title went through `tran()`
  in the same change (it was hardcoded English, so the app's most important
  control answered to nothing in a Khmer window), and `owa_list_screens` gained
  `isAnyShowing` and stopped returning Electron's whole `Display` object twice —
  ~2 800 characters to answer "no" is what makes a model skip the check.
- **A press lands where the control is, and says what it OPENED** (2026-10-06,
  `domMatch.mjs` `PRESS_AT_CENTRE_SOURCE` / `addOpenedWindow`, `cdp.mjs`
  `waitForNewAppPage`). `element.click()` carries clientX/clientY 0,0 and the
  app places a context menu at the event's coordinates (`setPositionMenu`), so
  `owa_click "Foreground"` opened the launcher in the window's top-left corner.
  Every `owa_click` and every **Do it** now sends a bubbling, composed `click` at
  the control's centre, as `pressElementLikeButton` does; a disabled control
  still gets `click()`, and the press is kept out of the memoised
  `__owaDomMatch` runtime. Presses that plainly worked used to answer
  `unverified` (the Foreground menu, the Bible Lookup popup, the Settings
  window): the result now carries `opened` -- `dialog` / `panel` / `menu` for
  a layer shown after the press that was not shown before it (identity +
  `checkVisibility`), and `window` + `page` for a new app page target. The
  window check polls up to 1 s only when nothing else changed; the capture and
  read-website windows never count. Any of them means `didChange: true` and no
  `unverified`. A projector change still needs `owa_list_screens`. +2 tokens a
  round.
- **The walkthrough card presses only what the step NAMES, and only what is
  REACHABLE** (2026-09-08, `guide.mjs` + `domMatch.mjs`, measured by
  `.claude/skills/owa-enhance-chatbot/scripts/demo-failure-rate.mjs`, which
  presses Do it through every step of every recipe, paced under the
  firewall's 25 acting calls a minute). Two things every measure the card had
  was blind to. A control can be on screen by every test — laid out, painted,
  enabled — and behind the Bible Lookup popup, which covers the window: the
  ring was drawn THROUGH the popup onto a line of Genesis and Do it clicked a
  tab nobody could see. `coverOf` asks `elementsFromPoint` what the window
  paints at the control's own centre, `layerOf` names the layer (the modal
  container with its own red ✕; a right-click menu, closed by a click on its
  backdrop; a `.floating-widget`, its toolbar ✕; a blocking confirm / alert /
  input, which is NEVER answered for anyone) — a layer the target sits INSIDE
  is not in its way, or the Foreground widgets' own panel got closed — and the
  first press closes it, the next does the step; `owa_guide_status` says
  `behind`. And the matcher's tiers 1–3 (a whole word inside a longer label,
  a word-start, every word somewhere) are right for a ring near a misspelt
  step and wrong for a click: of 92 presses the harness first counted as
  done, at least ten had pressed the WRONG control — the projector's _Clear
  All [F6]_ for the drawing panel's _Clear_, _Break lines following model
  formatting_ for _Follow_, the help window opened for a bolded _ASSISTANT_.
  `isPressSafe` (tier 0, or a label part equal to the words once a
  `[shortcut]` and a leading glyph come off, or the very panel asked for) is
  the bar; `findBest` keeps scanning a step's candidates for one that clears
  it (`preferPressSafe`) instead of returning the first candidate's loose
  match; a loose fit is refused with the label it found, reported as
  `nearest`, and never ringed. A step that only describes what to see (_The
  bar under the search box says how many matched_) is `kind: "look"` — Next
  instead of Do it, no failed press, no model round. A bold is read from 1 to
  120 characters (40 dropped W-08's tab row and misaligned the rest; a `**✕**`
  did the same the other way). Pages with no numbered step (W-01, W-09, W-10,
  W-17) walk their bold-led bullets and paragraphs. Do it across the manual:
  wrong presses ≥10 → 0, recipes that start 33 → 37, honest refusals go UP
  because a wrong press is now a refusal that names what it found.
- **Guide steps and hidden controls**: A guide can also use `action: "hover"`
  when an event-driven surface creates another control; it dispatches
  pointer/mouse hover events without moving the person's real pointer. A
  CSS-hidden target normally needs no hover step — name it directly. Guide
  `type` can set a range slider value as well as a text box; a signed value such
  as `+8` changes a range relative to its current value. The last actionable
  demo step is still **Do it** until it has run — it must never become **Done**
  and close without acting. When a broad manual is started with `topic`, only
  the task-matching step is shown; the chatbot's keyed **Do it for me** path
  uses that as a safe pointer while it rebuilds the demo from the live localized
  controls. A `manualId` is show-only: executable demos must pass explicit live
  steps, and preparing one never presses ahead — the person presses **Do it**
  once per visible action. Known repeatable Reader jobs do not need a model to
  rediscover those steps: small text uses the named Font Size range, and a
  localized Bible reference uses Clear input → the book's stable model-name
  title → Chapter N → Verse N while the buttons keep their localized visible
  words.
- **Tips belong to the operator page** (2026-09-28). In addition to Presenter
  and Reader, `pageDemos.mjs` supplies local lessons for Settings, Slide Editor,
  Bible Note, Web Editor, Lyric Editor and Local Web Share. `DailyTipComp`
  listens for the focused-window Help menu in every supported window; only the
  main window owns the shared menu registration. Its automatic shown marker is
  per page, with the existing five-minute delay and global opt-out. A hidden
  window waits for focus. `demoHelpers.mjs` routes built-in demos to their
  declared page and preserves an explicit same-page URL, so Show it stays in
  the originating popup; `pickTarget` prefers an exact URL before a substring.
  **The card takes itself off after a minute** (2026-09-29,
  `DAILY_TIP_AUTO_CLOSE_MS`), which is the other half of not covering the
  controls a volunteer is reaching for. It is TWO clocks held by one flag: a
  `setTimeout` that carries its remaining time across a pause, and a 3px bar
  along the card's bottom edge running a finite `transform: scaleX()` -- never
  a width, a repaint or a per-second tick, which would re-render the card
  sixty times over a busy panel. The pointer resting on the card pauses both
  (`animation-play-state` + the effect's teardown), so leaving carries on from
  where the bar stopped rather than granting a fresh minute; browsing All tips
  and starting a walkthrough hold it too. Focus is deliberately NOT a second
  hold -- a click leaves its own button focused and the card would sit there
  for good. The bar is exempted from the global `prefers-reduced-motion` clamp
  in `interaction.scss` for the reason the spinners are: clamped to 0.001ms it
  empties at once and then contradicts a card that is still there.
- **The Presenter and Reader have checked-in demos that need no model**
  (2026-09-22, expanded 2026-09-23 and 2026-09-26, `readerDemos.mjs` and
  `presenterDemos.mjs`). `owa_guide_start { demoId }` resolves 100
  Reader-only lessons through the same guarded card. Thirty are featured
  in the Reader assistant's zero-model practice shelf: the original font
  larger/smaller, localized John 3:16 and Bible Find demos; passage history,
  reference clearing, people/places, two versions, full view, copy/split/save,
  scrolling, line layout, advanced study views and book filtering; and direct
  practice for typing a complete reference, removing one reference part,
  automatic Bible audio, filtering and sorting notes, Settings and Help.
  Fifty of the 100 Reader tips begin with a safe deterministic action;
  Reader additions cover copying formats, saved list and note file management,
  Resources, names and graphs with practical searchable tips. Mixed steps use
  `look` after the safe action, and scoped labels translate each part.
  The coverage map is `tools/owa-devtools-mcp/reader-demo-coverage.md`.
  Stateful, file-dependent, native-menu, pane-visibility and audience-output
  lessons stay self-guided. The catalog is
  shared with the chatbot's empty state, so the words a senior presses and the
  steps the MCP runs cannot drift. A demo changes one visible thing per **Do
  it** press; the search lesson names the Bible Online Lookup picker, selects
  **Find** even when it remembered Resources, and leaves the search box for the
  person's own word. The Presenter catalog has 90 lessons across documents,
  audience screens, FOREGROUND OVERLAYS, backgrounds and media, service
  planning, app help and the View menu. Eighty lessons now begin with a
  safe deterministic **Do it**
  action, then turn any explanation-only follow-up into **Next**; ten native-menu
  or disruptive lessons remain fully self-guided.
  No lesson can present, reload, relaunch, reset layout, or open Developer Tools
  for the person. **A shortcut no button shows is taught by a tip that presses
  it** (2026-10-04): Ctrl+Shift+Arrow (⌘+Shift on a Mac) moves between split
  Bible passages and appears in no tooltip, so `reader-switch-split-pane` and
  `presenter-lookup-switch-split` split once and then press Left and Right
  through the step's `press` -- Left first, because a split opens its copy on
  the left and keeps the right one selected. A `press` is written as on Windows
  and sent as written on every platform, so the step text names the Mac keys. **The foreground had two vague lessons for ten components**
  (2026-09-24): one per component now — Marquee Top / Bottom, Quick Text,
  Countdown, Stopwatch, Time, Video / Image / Camera / Web Show — plus
  Properties, saved sessions and taking an overlay back off, filed under one
  **Foreground overlays** heading of their own rather than buried in
  "Background and media". Each is the same two safe presses — the
  **Foreground** tab opens the launcher, which is a CONTEXT MENU, and the row
  in it opens that component's floating panel — then a `look` step for
  whatever would reach a screen, because no lesson starts a countdown or puts a
  clip up. Two things that shape made necessary: the launcher row and the panel
  it opens carry the SAME words, so `checkIsControl` had to learn
  `role="menuitem"` or "choose Video Show" could ring the panel that name
  already opened; and a lesson is searched by the word ON THE BUTTON, so every
  one names its own component in its detail line (a friendly title alone left
  "countdown" matching no countdown lesson). Tips also send their current
  inline lesson when a hot-reloaded
  renderer finds an older long-running MCP catalog. `demoId` is a string
  validated against those catalogs at call time, not a growing schema enum
  sent to the model on every round. Fourteen additional Presenter-only lessons
  (2026-09-28) cover lookup
  references/history/study tools, media folders/filtering/sorting, flow
  filtering/sorting, Messages/rotation/spacing, overlay Effects and Image Show
  playback preparation. Library controls keep their panel scope in every
  language, and already-open panels are skipped. This
  adds no tool, spends no provider credit and keeps schema cost flat as lessons
  are added.
- **The screens tool says what is ON the projector, not only whether it is on**
  (2026-09-09, `tools/owa-devtools-mcp/agentScreens.mjs` +
  `src/helper/agentScreenHelpers.ts`). `owa_list_screens` used to answer
  `isAnyShowing`, the ids and the displays, and a model handed "showing: true"
  for a screen with a verse on it INFERRED the rest: measured on the standing
  corpus with the projector showing a Khmer verse, _the words no come out big
  screen_ took 9 rounds and 36 s to conclude "nothing has actually been sent to
  it yet: turning the screen on just gives you a blank canvas", and the "yes"
  under the panic answer took 8 rounds -- `owa_find_ui "show screen"` found
  nothing (`EC-115`), the model pressed the _0 Screen: 0_ badge, then pressed
  the toggle by a DOUBLED label (`labelOf` joined a title and an aria-label
  that carry the same words; `labelPartsOf` now keeps each name once). The
  answer now carries `screens[]` -- per screen, SHOWING OR NOT, because a
  hidden screen still holds its layers and "it is off but already has verse 2
  on it" is the whole answer to most panics: `isShowing`, `isLocked`, the
  background (kind + file name), the slide (document, slide name, its first
  160 characters with the chords taken OUT of the words -- open-lyric renders
  them mid-word, so the chord boxes are removed from the parsed markup before
  the text is read, never regexed out of it), the passage (reference +
  version), the foreground widgets by name, `isBlank` -- plus `controls`, the
  exact words on that screen's show/hide toggle and five Clear buttons as the
  app is DISPLAYING them (each Clear saying `hasSomething`), so a "yes" is one
  `owa_click` with no search round; and `previewCard`, where the Mini Screen
  panel sits, off its own bounding box (`EC-116`: the model had placed it "at
  the top" three times out of three). The content comes from the presenter's
  `ScreenManager` instances over the same DOM-event relay as `owa_lyric_file`
  (`owa-agent-screens` in `domHelpers.ts`, the module imported LAZILY -- the
  managers pull the whole presenting graph); the labels and the card's place
  are read off the DOM in the same expression. Only the Presenter page knows
  the content: the tool aims at `presenter.html` whenever it is open and
  degrades to the basics plus a `note` otherwise, never to a stale "blank".
  The prompt's symptom paragraph says to SAY what is on the screen, that a
  showing screen holding a slide is never blank, and to press
  `controls.showHide` by its words; the offline bot and `/screen` say the same
  content through `describeScreenContent` with no model. Re-asked: the state
  answers name the verse on the wall, the "yes" is 3 rounds, +124 tokens a
  round (all description). Rung 5 is measured now, and "what the user is in
  the middle of" is the half still open.
- **The state tool says what the user is in the MIDDLE of** (2026-09-09,
  `src/helper/agentPresenterHelpers.ts` + `tools/owa-devtools-mcp/agentPresenter.mjs`).
  `owa_list_screens` says what the projector holds; nothing said what the user
  had SELECTED, and a model infers past a missing field: with _Amazing Grace_
  highlighted and a Khmer hymn on the (off) screen, _which song is selected?_
  was answered with the hymn, and _show the next slide_ ran to the ten-round
  cap -- six `owa_list_ui` calls hunting the slide cards (a card had NO
  accessible name, so none was ever listed), a 200-row dump that wrote 34 574
  tokens into the cache, a press on a slide's `Index: 5` badge that changed the
  congregation's screen because it happened to bubble to the card, and then
  _"I could not find an answer for that"_. Now `owa_app_state` on the Presenter
  page carries `selectedDocument` -- name, kind, `slideCount`, `slides[]`
  (number, name, first words, `onScreens`, `isDisabled`) and `onScreen` /
  `next` / `previous` worked out the arrow keys' way (wrap, skip disabled; with
  none of the document up, `next` is its first slide) -- over the same
  DOM-event relay as the screens (`owa-agent-presenter`, lazily imported), a
  SONG read through its stage-0 instance because the base `LyricAppDocument`
  lists the structure with empty canvases and no attachment slide. **Every
  slide carries `find`, the card's own `aria-label`** (`Slide 5: 671826`,
  `toSlideAccessibleName`, through `tran`), and ONE function builds both the
  attribute and the field, so `owa_click` presses a slide by exact words --
  which PRESENTS it -- and `owa_list_screens` then says what went up. Re-asked:
  the selected song is right in 2 rounds, _show the next slide_ is 2 rounds and
  one confirmation, then `owa_click "Slide 5: 671826"` and a check (4 rounds,
  7.6 s, proven on the wall); `/selected`, `/next` and `/previous` do the same
  with no model (1.5--3 s), and the offline bot answers the same questions from
  the field (`answerSelection`, before the how-do-I gate; a run-sheet question
  is excluded because no tool reads the run sheet yet -- `EC-132`).
  `owa_app_state` also dropped the forty dev-only component names and the
  instance's `userDataPath` (a path with the account name in it, to the model
  on every call). **Off the Presenter the field is a `note`, never absent.**
  The same asks showed the second half: **every Claude Sonnet 5 round carries a
  `thinking` block** whether or not the request asks for one, and the loop's
  `MAX_TOKENS` was 2 000 -- the last round of that question stopped on
  `max_tokens` with 2 000 tokens of thinking and NO text, which the window
  reported as "could not find an answer". `ANTHROPIC_MAX_TOKENS` is 6 000 now
  (the same figure OpenAI's and Kimi's budgets were raised to for the same
  reason), `output_config.effort: "low"` goes to the models that take it
  (`ANTHROPIC_EFFORT_MODEL_PATTERN`; Haiku 4.5 rejects it), and a final round
  with no text says it ran out of room rather than that the app has no answer.
- **The state tool knows the RUN SHEET, a list row is words only, and steps
  off an excerpt go back once** (2026-09-09, `src/helper/agentRunSheetHelpers.ts`,
  `domMatch.mjs` `describeRow`, `checkIsStepsWithoutPage` in
  `llmBotHelpers.ts`). Three things one corpus run found. **`owa_app_state`
  carries `runSheet`** -- every presenting flow open in its run player, its
  lines (number, title, kind, `isParked`), `cursor` (the line the run is on
  and the slide inside it) and `next` worked out the Space key's way (walk a
  document slide by slide, never wrap, step over PARKED only), or
  `availableSheets` and a `note` when none is open -- over the same
  `owa-agent-presenter` relay as `selectedDocument`, read whatever the
  selection is. _What's next in my running order?_ went from 6 rounds and an
  unverified guess to 2 rounds; `/run` and the offline bot say the same
  sentence (`describeRunSheet`) with no model. **No tool advances a run** (a
  key press is what does it, and `press_key` is withheld), and the prompt
  says so because the first re-ask offered to _press Space_. **A list row is
  the label, the panel, where it sits and only what is unusual**
  (`showsOnHover`, `isDisabled`): one `owa_list_ui limit: 200` answer had
  been 34 574 tokens at ~180 a row, and every row carried `component` and
  `sourceFile` -- the two names the prompt forbids the model to repeat --
  two hundred times over (`EC-130`). `describe` keeps the full shape for
  find / click / the picker, so the developer's route into the source is one
  `owa_find_ui` away, and `labelPartsOf` drops a part that is a file path (the
  previewer footer's title). **Steps written from a search excerpt without
  opening the page are handed back to the model ONCE, in code**: the rule had
  been in the prompt since the first run and on the top hit since the day
  before, and _How do I edit a slide?_ asked from the Bible Reader was still
  written off the excerpt 3 runs in 4, each time starting "in the Documents
  list" -- a panel the Reader does not have (it is `BibleReaderComp` and
  nothing else). Both loops push the answer back with a user turn naming the
  hit to open, bounded to one nudge per ask and never on the last round; and
  the Reader's and Editor's prompts now say which panels that page lacks and
  that the way back is the 🖥️ **Go Back to Presenter** button (the Reader has
  no Presenter tab -- two "passing" answers had sent the user to one). The
  same run found the manual had no page for REMOVING a file: _and how do I
  undo that?_ under _How do I add a song?_ took six lookups to end on
  **Delete**, an item no menu in this app has. W-43 names **Move to Trash**,
  the confirm and the Recycle Bin, and the corpus carries two questions for
  it.
- **A Bible passage is put up by its REFERENCE** (2026-09-10,
  `owa_present_bible`: `tools/owa-devtools-mcp/agentBible.mjs` +
  `src/helper/agentBibleHelpers.ts`, over the `owa-agent-bible` relay in
  `domHelpers.ts`, lazily imported). The lookup is a picker for a person whose
  labels nothing can aim at, so walkthroughs stalled on it (`EC-131`). The tool
  resolves the reference with the app's OWN parser (`BibleItem.fromTitleText`,
  every locale; the version's FULL book name, never `Ps`/`Jn` — `EC-151`; a
  whole chapter widened to all its verses) in the lookup's version first, then
  any installed one that reads it; presents it exactly as **Show bible item**
  does (`ScreenBibleManager.handleBibleItemSelecting` to the ticked screens;
  NOTHING saved to the Bibles list, so **Clear Bible** undoes it); and reads
  the screens BACK — `isPresented`, the passage, its first words, each ticked
  screen's `isShowing` / `isLocked`, and a `note` to OFFER the show button when
  the screen is off. `action: "check"` resolves and quotes without touching a
  screen. A locked screen, no ticked screen, an unknown version (installed
  ones named), an unreadable reference and a main window off the Presenter are
  refused in sentences for a PERSON (`/verse` and the offline bot print them).
  It is in `ACTING_TOOLS` (banner; `check` is quiet) and the firewall budget.
  The prompt routes every verse ask to it — done when asked to go UP, offered
  when asked how — and `applyToolWatch` marks a presented result `isActedOn`
  so no W-06 walkthrough is offered. `/verse John 3:16` needs no model; the
  offline bot offers ONE button (a typed sentence is not the consent a press
  is). **Whatever version the lookup is on is what goes up** (`EC-149`).
  `EC-135`: `checkIsNamedNearly` strips a `[shortcut]` off both the label part
  and the needle, so `owa_click "Clear Bible [F9]"` works. Open `EC-148`:
  `canDemo` is true when ANY step is pressable, so a recipe whose second step
  needs the user's words still stalls.
- **A foreground extra is started by its WORDS** (2026-09-11, `owa_foreground`:
  `tools/owa-devtools-mcp/agentForeground.mjs` +
  `src/helper/agentForegroundHelpers.ts`, over the `owa-agent-foreground`
  relay in `domHelpers.ts`, lazily imported). _Start a 5 minute countdown_ once
  cost $0.18 and started nothing: the Foreground tab is a TOGGLE the model shut,
  and the widget is a form written for a person. `EC-167`: `stateOf` in
  `genClickExpression` reads `aria-selected` and a `.nav-link`'s `active`
  class, so a press that shut a panel answers `isOnNow: false`. The tool takes
  `widget` (countdown, stopwatch, clock, marquee-top, marquee-bottom,
  quick-text; `all` for a stop) with `minutes` OR `at` (a clock time today; a
  past one is refused in a sentence) or `text` (≤300 characters; a quick text
  stays `seconds`, default 10). It does what the widget's own Start does
  (`ScreenForegroundManager.setCountdownData` and siblings on the TICKED
  screens, the widget's defaults, the panel's +1 s) and reads back `did`,
  `detail` in words, each screen's `foreground`, and the OFF note (offer the
  show button, never press it). `stop` takes one off (`all` is F10), `check`
  reads. `/countdown 5` (also `/timer`), `/countdown 10:30`, `/countdown stop`,
  `/marquee <words>` and `/marquee-top` need no model; the offline bot offers
  ONE button (`readCountdownAsk`). It is in `ACTING_TOOLS`, the firewall's
  acting set and `describeToolStep`, and `applyToolWatch` marks it
  `isActedOn`. Cost: +491 tokens a round. `EC-168`: `readScreens` in
  `builtinActionHelpers.ts` carries `clearable` from
  `controls.clear[].hasSomething` — a layer held on a HIDDEN screen is still
  cleared, and a Clear press is proven by the layer reading empty. Open:
  `EC-169` (_Put Blessed Assurance on the screen_ turns the screen on to the
  wordless **First** slide) and `EC-170` (the W-08 demo's step 2 clicks
  **Colors**; no card can double-click a video).
- **A panel divider is a named control, and the card right-clicks it where it
  is** (2026-09-09, `FlexResizeActorComp.stampAccessibleName`, `domMatch.mjs`
  `tierOf` / `openContextMenu`, `guide.mjs`). Reported with a screenshot: the
  W-31 card on step 1/5 telling the user to open the View menu — the native
  menu bar, which no card can press and a popup window does not have — beside
  the user's own right-click on the divider between two panels, open on
  **Reset Size / Close First Widget / Close Second Widget**. The divider had
  no `title`, `aria-label` or `data-widget-name`, so `owa_find_ui` could not
  see it; every one now carries `role="separator"` and
  `aria-label="Divider between <A> and <B>"` off its neighbours' widget names
  (walked TO a collapsed strip, which carries the pane's name, not over it as
  the drag getters do). A right-click step whose target is a separator
  right-clicks it in place — one press opens the app's own menu, `withMore`
  names the item, the next press chooses it — and a step naming a _divider_
  gets NO list-region fallback: a collapsed panel has no divider, and the
  fallback opened the nearest list's own menu. `openContextMenu` aims at the
  centre of anything thinner than its 20 px inset. Two older defects fell
  out: **`parseNeedle` trims a trailing kind noun off every needle, so a pane
  NAMED with one — `Document List`, `Presenting Flow List` — was never an
  exact match and `owa_click` REFUSED its own collapsed strip** (`tierOf` now
  tries the words as asked, against the joined label and each part, before
  the trimmed ones); and `dropStepsAlreadyDone` read a whole step for the
  window it goes to, so W-31's _Open View…_ step, whose example list says
  _presenter_ two sentences on, was dropped and the card opened on _Click a
  ticked one_ — it reads the first sentence only now. **And a step that names
  a control other than the window is not the trip there** (2026-10-04):
  _Open Bible Lookup at the top of the Presenter._ presses Bible Lookup IN
  the Presenter, and dropping it had started three Presenter tips a step too
  far on — two inside a popup nobody had opened, one degraded to show-only. A
  step is dropped only when every control it names IS this window (or it
  names none); `demoHelpers.test.mjs` holds every built-in lesson to keeping
  all its steps on its own page. W-31 carries the
  divider route as steps 7–9 and `questions/common.json` a question for it.
- **The focus vocabulary is declared ONCE**, in
  `tools/owa-devtools-mcp/botFocus.mjs` (no `node:fs`, so the renderer bundles
  the module the server runs). Eight windows, each `{key, label, window,
isMainWindow, howToOpen, openFind}`, and the `key` is NOT a label: it is
  spliced into `page: "<key>.html"` by `owa_find_ui`/`owa_app_state`, so it
  must stay the
  html base name. It used to be a two-value union written out by hand in the
  type, the picker list, the opener sniff, the session validator, the fallback
  starters, two zod enums and a `focus !== 'presenter' && focus !== 'reader'`
  guard. `isMainWindow` is what tells `genSystemPrompt` whether `owa_goto_page`
  can take the user there at all — three of the eight are pages the ONE main
  window navigates between, and that tool's enum is DERIVED from them
  (`BOT_MAIN_WINDOW_PAGES`), having refused the Document Editor for as long as
  the prompt had been promising it. The rest have to be OPENED, and `openFind`
  names the one control that opens each where one does — only Settings, of the
  five; three need something selected first and one lives in the native menu
  bar. Those names are read the other way round too: `detectRecipeWindow` takes
  the window a RECIPE is about out of its own first step (the one the drop
  rule throws away), and `owa_guide_start` uses it OVER the page it was asked
  for — a recipe about Settings walked in the Presenter rings whatever word
  happens to match there, reported as a card about Settings ringing a Bible
  version off “Language: click **English**”, that button reading `KJV English
KJV`. 5 of the 44 recipes name one window; the rest keep the caller's page.
  Between them those fields are why a walkthrough of a window nobody
  opened now opens it instead of reporting that it is not there: the chatbot's
  `genPageOpenAnswer` navigates or presses, starts the walkthrough it was asked
  for, and falls back to that window's own `howToOpen` words — once, never in a
  loop (`runBotAction`'s `canOpenPage`). **A tool's own error text may never
  reach the user**: `describeActionError` is the one place a failed button press
  is put into words, and the reason goes to the log. It used to be printed at
  them, naming page files and the list of open windows.
- **The picker**: `owa_pick_element` draws an outline that follows the mouse
  (`tools/owa-devtools-mcp/picker.mjs`) and swallows the choosing click in the
  CAPTURE phase — pointer-down as well as click, because a dropdown opens on
  mousedown — so pointing at **Clear Bible** to ask what it does does not clear
  the bible. It answers with `describe()` plus `selectorOf()`, a selector built
  shortest-first and TESTED against the document before it is returned (null
  rather than one that matches two things), preferring `data-widget-name` /
  `aria-label` / a hand-written id over `:nth-child`. **A name with a TWIN
  among its own siblings keeps the name and adds the index** (2026-09-12,
  `EC-172`): the Reader routinely has two panes called `Bible View` side by
  side, and a part standing for both can never be rescued by walking up —
  every ancestor they share is the same node, so every longer candidate still
  matches two. It returned null, which is what made the chip the user had
  POINTED AT answer _there is nothing left to show for that one_, and it took
  every control INSIDE the pane with it: 156 of 949 elements in a two-Bible
  Reader had no selector at all (→ 12 after, 0 mis-targeted). A lone named
  panel is left unqualified, so an ordinary selector does not start carrying a
  brittle index it never needed. Beside it, an element chip with no selector
  now falls back to `owa_find_ui` on its own words (`EC-173`) — the last rung
  of a ladder, not a competitor to the selector: pointing was how the user
  said WHICH one, and a name can land on its twin, but the alternative was a
  dead end.
- **Writing the user's own documents is `owa_lyric_file` / `owa_slide_file`**
  (2026-09-02) — `list` / `info` / `create` / `update` / `rename` over songs
  (`.owl`, Open Lyric content) and slide documents (`.ows`, document JSON).
  They are the only tools whose effect OUTLIVES the session — a click can be
  clicked again, a created file stays created — so four rules hold, and the
  safety ones live in the worker (`src/helper/agentFileHelpers.ts`) rather
  than the tool, because the worker is what touches the disk: **nothing is
  lost** — since 2026-09-14 a `delete` is the app's own Move to Trash and every
  change is backed up first (the data tools, next) — and `create` never
  overwrites;
  **`update` writes the EDITING HISTORY, never the file** — undoable with
  Ctrl+Z, left visibly dirty with its `*`, the human presses Save, which is
  _point, don't press_ applied to content and is also why a song already on a
  screen is untouched (a presented slide is a snapshot until re-presented); **a
  name is REFUSED, never quietly cleaned**; and **content must pass the app's
  OWN validator**. Two things are checked in TWO places on purpose, the same
  split `webUrlPolicy.mjs` uses. The NAME is checked first in `owaTools.mjs`
  and again at the disk boundary, sharing one module
  (`tools/owa-devtools-mcp/agentFileName.mjs`, plain ESM so the renderer
  bundles what the server runs) — checked first because it used to reach the
  content validator first and answer "your song is malformed" when the real
  complaint was the path in the name. Windows device names are refused before
  the first dot too (`NUL.old`, `CON.backup`, `COM¹.old`), including multiple
  extensions and superscript digits; this holds for source names and rename
  destinations, on every OS. The app separately checks names a person creates.
  Bible-list and note-file tools share this validator and the same refusal.
  The CONTENT is checked by `validateOpenLyric` in the tool (line
  numbers and what to write instead, no round trip — `owa_lyric_validate`
  already owns that grammar) and by the app's own `checkMarkdown` /
  `AppDocument.validate` at the disk boundary. They reach the app the way the
  guide card's rescue does — a page expression fires `owa-agent-file`,
  `domHelpers.ts` relays it, and the worker is imported LAZILY there to dodge
  the app-document/lyric import cycle — because this package may never import
  an app module and open-lyric is browser-only. Two tools rather than one
  merged one is the operator's call, paid for at ~800 tokens a round rather
  than ~450; the lifecycle is written once and the differences live in
  `AGENT_FILE_KIND_MAP`. Both are in `ACTING_TOOL_SET` (a loop must not fill
  somebody's Documents folder) and both name the file in their banner, while
  `list` and `info` stay silent like every other read. **Open Lyric Config
  fields need a leading `- `** (`- Title: ...`) — the mistake a model makes,
  now named in the refusal.
- **The data tools change what the user KEEPS, so every change is backed up
  first and a delete is a move to the trash** (2026-09-14, `MC-24`; asked for
  by the user — _add all possible tools: bible-item crud, bible-note crud,
  document (app-document, lyric) crud_, _update slide with style with text_,
  _make sure all actions have backup action, e.g. delete it should move to
  trash and can undo_). `owa_lyric_file` / `owa_slide_file` gained `delete`,
  and the slide tool six slide actions — `slides`, `add-slide`,
  `update-slide` (per box: text, font, size, colour, alignment, position, a
  box removed or added; a locked box refused), `delete-slide`, `move-slide`,
  `duplicate-slide` — each one editing-history entry, the pure rules in
  `src/helper/agentSlideHelpers.ts`. `owa_bible_item` lists, adds by
  reference (through `owa_present_bible`'s own resolvers), re-points and
  deletes the saved passages of the Presenter's or the Reader's Bibles list,
  and whole lists; `owa_bible_note` does the same for notes, writing plain
  text as the note editor's own Lexical content (a verse-marks item is removed
  or renamed whole, never re-texted); `owa_undo` lists and undoes. The three
  share one relay, `owa-agent-data`, keyed by `domain`, the workers imported
  lazily. **No backup, no change**: a Bibles list and a notes file have NO
  editing history — every save is the file — so
  `src/helper/agentBackupHelpers.ts` snapshots what a write is about to change
  (the file, its editing head, its sidecars) into
  `<data folder>/agent-backups/` (`<id>.meta.json` beside `<id>.data.json`;
  the last 100 for 30 days, 25 MB an entry; not in the whole-data archive),
  and `runWithAgentBackup` refuses the change when that cannot be saved. A
  delete is `trashAgentFile` — the OS trash, then the material sidecars, the
  editing history discarded only once the file is really gone — and the
  answer carries an `undoId`, because a program cannot empty the OS trash back
  into a folder. `owa_undo` applies a rename, then files, then editing heads
  (unsaved state can only go into a document that exists), takes its OWN
  backup first (undoing the wrong thing is one more undo; an undo's id redoes)
  and names any later change to the same file that went back with it; with no
  id it takes the newest change that is neither undone nor an undo. **The
  store is shared by every agent on the machine**, so a script checking undo
  passes each change's own `undoId`. The firewall rations removals — every
  `delete*` and `owa_undo` — at 10 per 5 minutes, a counter apart from the 25
  presses a minute, because what it protects is the user's files; and
  `owa_bible_note` refuses a write while that file is open in a
  `bibleNote.html` window, which saves its stale copy back over it. Cost:
  +1 089 tokens a round to the model (24 tools, ~7 990); `owa_bible_note` is
  the first to withhold if that matters. Verified live through fresh servers:
  36 checks across the four kinds. **That run found a bug in the app, not the
  tools** (`MC-25`): undoing the delete of a slide document with unsaved edits
  brought back a state two edits old, because `FileSource.readFileData`
  caches by PATH for 2 s while the editing history renames `N` onto `N-head`
  and reuses its paths after a clear — a history rebuilt inside the window
  read back the old head, and `changeCurrent` wrote its diff patch from that
  stale text (plain editing reaches it too: undo, then edit, inside two
  seconds). `FileSource.forgetCachedData` / `forgetCachedDataUnder` now follow
  every history move, clone, delete and clear, and `preDelete` awaits the
  discard; anything new that renames, copies or deletes onto a path read
  through `readFileData` must forget it too.

- **Whole Bibles are `owa_bible_xml`** (2026-10-06, asked for by the user:
  _download → extract → analyze → guess keys → recommend a locale → digits →
  book names for the user to pick → import_, and _help import, edit and delete_,
  for elderly non-technical users). One tool, eight actions; it took over
  `owa_bible_book_names` as `names`, so the model pays one schema. **The
  download is the SERVER's** (`bibleXmlDraft.mjs`): every redirect hop is put
  through `webUrlPolicy.mjs` WITH DNS before a socket opens (a hop into
  127.0.0.1 is refused), 80 MB cap, three minutes, back-pressure to disk; a
  GitHub/GitLab/Dropbox/Drive share page is turned into its file
  (`toBibleXmlDownloadUrl`), a GitHub repository or folder is read through
  the API listing, an HTML page through its `.xml` links, and each listed
  file's own TITLE is read off a 2 KB ranged request. A link that leads nowhere
  is an ANSWER, `{problem, message}` (`not-found`, `blocked`, `not-xml`,
  `page-without-files`, `not-bible`, `key`, `draft-gone` …), not an error.
  **The file waits on disk, not in a window**: `<temp>/open-worship-app-bible-
  import/<12-char id>.xml` plus a small `.json`, three drafts for two hours
  at most, swept on every new download, removed by `import` and `cancel` —
  a 15 MB Bible is read twice (to describe, to install) rather than held
  parsed between questions. **The app's half** (`src/helper/agentBibleXMLHelpers.ts`
  over the `owa-agent-data` relay, domain `bible-xml`, lazily) reads ONLY a
  path matching that folder and id, with the app's own `xmlTextToJson`, and
  answers counts, missing books, `locales` with WHY (the verses' script and
  little words — `guessBibleLocalesFromText` — then the file's attribute only
  when the words agree, then the file name), unused `keys`, and book-name
  lists ranked by how many of their names the verses USE
  (`scoreNameLists` — a 1954 Khmer text matched the traditional list 44 to
  the modern list's 22); list ids are a hash of the names, remembered in
  `book-names.json` so an import passes an id, never 66 retyped names.
  `import` re-checks the key under the Settings import's lock and writes
  `<key>.xml`; `update` (title, locale, digits, a list id or
  `{"GEN": name}` changes) writes the file the key LIVES in; `delete` is
  the trash. All three back up first, and a file restore carries `bibleKey` so
  an undo also drops the Bible's parsed caches (`agentBackupHelpers.ts`).
  Firewall: acting set, removal budget for `delete`, network screening and
  budget for `check` (it carries a `url`); `names` charges each page it
  reads. Banner names the Bible and the site. Long work runs with a 180 s
  evaluate timeout (`evaluateInApp` takes `timeout` now). **No link, a
  language**: `check` the catalog `BIBLE_XML_CATALOG_URL`
  (github.com/Beblia/Holy-Bible-XML-Format, the user's choice) with the
  language in `find`; a word in its own script or a code alone is mapped to
  the English name the files use (`toCatalogLanguageWord`), and when some
  file has every word only those are listed. Verified live through the
  isolated profile: the sample installed (1.5 s), info, update, delete, undo.
