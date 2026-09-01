# Enhancement backlog — `EC-xx`

Tracked improvements for the chatbot and its MCP tools. **Ids are stable.** When
you finish one, move it to *Done* with the date and what actually shipped; when
you find something new, add it here even if you do not do it — the next run
should start from the truth, not from a re-discovery.

Status: `open` (real, verified, not done) · `idea` (plausible, unverified) ·
`done`.

Priority order when nothing else is specified: **wrong answers → unsafe acting
tools → cost → capability → polish.**

---

## EC-01 · `owa_help_page` can put ~52 000 tokens into one answer — `done` 2026-08-31

**Measured live 2026-08-31** against the running dev app:

```
owa_help_search {query, kind:'internal'}  → 2 911 chars   (fine)
owa_help_page  {id:'internal:skills/owa-robot-test/references/user-workflows.md'}
                                          → 208 032 chars ≈ 52 000 tokens
```

`readHelpPage` in `help.mjs` slices at `MAX_PAGE_BYTES` = 256 KB, which is a
*file-read* guard, not a *conversation* guard. The whole body goes back as one
tool result and then sits in `messages` for every remaining round of the loop —
so one unlucky call can cost more than the entire rest of the question, on the
volunteer's own API key, and can push a small model past its context window
outright. The id above is not exotic: it is what `owa_help_search` hands the model
as a top internal hit.

**Fix shape.** Cap what the *model* receives independently of what the file is:
return the matched section plus a bounded window (a few KB), and let the model ask
for more by section id. Manual pages are small (largest ~40 KB); it is the
`internal` corpus that is huge, and internal pages are exactly the ones the model
is only supposed to *understand*, never quote.

**Shipped 2026-08-31.** `MAX_MODEL_BYTES` in `help.mjs`, split by kind, applied
in `readHelpPage`: a manual page is capped at 40 KB (above the largest one that
exists, so nothing a user needs is cut) and an internal note at 8 KB. Measured
through the app's own MCP host afterwards: the worst-case page went
**208 032 → 8 484 chars (~52 000 → ~2 121 tokens), 24.5x**; pages over 50 KB
3 → 0, over 20 KB 18 → 1 (W-22, a manual recipe, deliberately whole). The cut is
made on a line boundary and says it was cut, because a model handed a page that
stops mid-sentence reports that the steps end there. Covered by `help.test.mjs`.

---

## EC-02 · The chatbot pays for 42 tool schemas on every round — `open`, high

`llmBotHelpers.ts` sends everything `listTools()` returns, every round, up to
`MAX_TOOL_ROUNDS` (10):

| | tools | tokens/round |
| --- | ---: | ---: |
| `owa_*` | 13 | ~2 800 |
| chrome-devtools-mcp | 29 | ~5 750 |
| **total** | **42** | **~8 550** → ~85 500 per question, worst case |

A help bot for church volunteers does not need `lighthouse_audit`,
`take_heapsnapshot`, `performance_start_trace`/`_stop_trace`/`_analyze_insight`,
`emulate`, `resize_page`, `new_page` or `close_page`.

**Fix shape.** An **allowlist** in the chatbot's own client (`mcpClient.ts` /
`llmBotHelpers.ts` — `listTools()` is already the single choke point). NOT in
`server.mjs`: the outside agent and the robot-test skill drive the app through the
same server and must keep the full set. Allowlist, never denylist — a tool added
upstream must not reach a volunteer's window because nobody updated an exclusion.

**Verify by** `audit-mcp-tools.mjs` before/after plus the same question answered
correctly with the smaller set. Constraints and reasoning:
[mcp-tools.md](./mcp-tools.md) §*Pruning and scoping*.

---

## EC-03 · `evaluate_script` is offered to the chatbot's model — `open`, high

Included in EC-02's 29, but it is its own problem: the chatbot hands a language
model, steered by whatever a user types, a tool that runs arbitrary JavaScript in
a renderer **with node integration**. `navigate_page`, `new_page`, `close_page`,
`upload_file` and `handle_dialog` are the same shape, one step down.

Fixing EC-02 fixes this — provided the allowlist is written deliberately and not
by copying the current list. Do not let this ride quietly on a token-cost change:
call it out in the commit.

---

## EC-04 · `help.mjs` ranking has no test — `done` 2026-08-31

`searchHelp` decides which page answers a volunteer's question, and
`KIND_WEIGHT` (`manual` 1.5 / `internal` 1.0) is the only thing keeping developer
notes below user documentation. It has no test at all, while its neighbours
(`domMatch`, `guide`, `notify`) do — and `tools/**/*.test.mjs` already runs in
`npm test`.

**Shipped 2026-08-31.** `tools/owa-devtools-mcp/help.test.mjs`, 10 tests over a
fixture corpus written into a temp dir and pointed at with `OWA_KNOWLEDGE_DIR` —
deliberately NOT the real corpus, which is rebuilt whenever the manual changes
and would make a ranking test grade nothing. Covers: the volunteer-vocabulary
case that this run fixed, that a literal question still wins literally, the
`KIND_WEIGHT` manual-over-internal line, both halves of the `focus` rule (drop
the other window's page / keep it when it is all there is), an empty result
rather than a guess, `readHelpPage` id round-trip, and both page caps.

Writing them found a real subtlety worth keeping: the manual-first filter runs
BEFORE `applyFocus`, so when the only manual hit is the other window's page it
is still returned. That is intended, and the test now pins it.

---

## EC-05 · The verify scripts hardcode the MCP port — `open`, medium

`extra-work/verify-chatbot-tools.mjs` and `extra-work/verify-chatbot-e2e.mjs`
both open with `const MCP_URL = 'http://127.0.0.1:39223/mcp'`, even though the
published instance file carries `mcpUrl`, and `verify-chatbot-e2e.mjs` already
discovers the *CDP* port that way. A second instance, or 39223 already taken,
makes both fail as if the app were down.

**Fix shape.** Read `mcpUrl` from `<temp>/open-worship-app-cdp/<pid>.json` — the
resolver in [`scripts/audit-mcp-tools.mjs`](../scripts/audit-mcp-tools.mjs) is
~30 lines and already does exactly this, including the newest-first sort and the
`OWA_MCP_URL` override.

---

## EC-06 · `mcpClient.ts` session recovery is untested — `open`, medium

The 404 → re-open → retry-once path (and the "never replay `initialize`" guard
that stops an endless loop) is the difference between the first question after a
service working and falling back to the offline bot. It is pure logic around
`fetch` and entirely mockable, and it has no test.

---

## EC-07 · The offline fallback bot has no test — `open`, medium

`src/chatbot/helpBotHelpers.ts` is what a volunteer gets when the wifi dies
mid-service, and it is the only path with no key at all. `genGuideActions`,
`detectOpenerFocus`, the "where is" / screen-question patterns and `runBotAction`
are all testable without an app. `chatSessionHelpers` and `llmBotHelpers` have
tests; this one does not.

---

## EC-08 · `owa_guide_start` is the most expensive tool in the server — `idea`, low

~594 tokens of schema + description, more than any other tool, because it teaches
a whole interaction (steps, `manualId`, demo mode, `canDemo: false`, `labels`).
That is largely defensible. Worth revisiting only *after* EC-02, when it will be a
much bigger share of a much smaller total — and only if the trimmed version still
produces guides that land on the right control.

---

## EC-09 · Nothing catches a tool that stops being announced — `idea`, low

[`scripts/audit-mcp-tools.mjs`](../scripts/audit-mcp-tools.mjs) warns when an
acting-looking tool is missing from `ACTING_TOOLS`, but it needs a running app and
is not in any gate. A static test could assert the same thing against
`owaTools.mjs`'s registered names without the app — worth it only if a tool ever
actually ships unannounced.

---

## EC-11 · A symptom question has no route to the tools that answer it — `done` 2026-08-31

**Found by asking the live assistant, 2026-08-31.** The system prompt routes
three question shapes to `owa_help_search`: "how do I", "where is", "what does X
do". A volunteer reporting a SYMPTOM matches none of them, so the model answered
from world knowledge. Verbatim, to "Nothing is showing on the projector":

> Make sure the projector is turned on and set to the correct input source.
> Check that the presentation cable is securely connected to both the computer
> and the projector.

`owa_list_screens` answers that question outright and was never called. The same
shape, phrased as a non-native speaker would ("the words no come out big
screen"), made it GUESS a control — "this may be labeled as something like
**Hide Screen**" — which is both a guess and the opposite of what they wanted,
while `owa_list_ui` lists what is really on their screen.

**Shipped.** Two rules in `genSystemPrompt`: a symptom shape that says LOOK
before answering (and names the app's four real causes — no screen showing, the
layer cleared, the screen locked, the wrong display picked), and a flat ban on
guessing a control name. Paid for by compressing the bullet they subsume, so the
prompt grew by less than the two rules cost. Both questions now open by
diagnosing from live state; a ratchet check on the ordinary how-do-I shape
confirmed it did not make normal questions detour.

**Left open:** the panic answer still opens with "Look at the main app window",
a non-step the prompt already forbids for guide cards but not for prose, and it
did not offer a walkthrough. That is `EC-12`.

---

## EC-12 · Prose answers still contain non-steps, and skip the walkthrough offer — `open`, medium

The prompt forbids "look at the app window" as a *guide card* step ("something
you say in the chat, never a step"). The same rule is not applied to the numbered
steps in a prose answer, and the fixed panic answer duly opens with:

> 1. Look at the main app window.  2. Find the "Screen Preview" area.

Neither is a control to press; both are throat-clearing before the one real step.
The same answer also did not offer a walkthrough, while the non-native phrasing of
the identical question did. Under the scoreboard's all-four rule that is still a
fail, and it is the gap between the two spot-checks that moved this run.

**Fix shape.** Generalise the existing non-step rule from guide steps to every
numbered list, and make the walkthrough offer unconditional for a multi-step
answer rather than something the model chooses. Verify by re-asking both panic
phrasings and requiring identical structure.

---

## EC-13 · `kind: 'auto'` serves builder notes when the manual has nothing — `open`, medium

`searchHelp` falls back to the internal corpus whenever the manual scores zero,
so "Can it stream to Facebook?" — a question about something the app cannot do —
comes back with developer memory files as the only hits. Measured this run, the
top hit for it is now this skill's own research playbook.

The model handled it correctly live (it said the app has no built-in support and
suggested OBS, leaking nothing), so this is a hazard rather than an active defect
— which is why it is medium and not high. But the corpus split exists precisely
so a user's question is never answered from builder notes, and "the manual has
nothing" is better answered as *nothing* than as a note the model is forbidden to
quote. Worth pairing with a prompt line that says an empty manual result is a
legitimate "the app does not do that".

---

## EC-14 · Retrieval cannot answer a symptom, and should say so — `idea`, low

Established this run: "the words no come out big screen" has no lexical path to
the page that answers it, even with the filler words stripped, because no manual
page can state whether *this* screen is showing right now. The alias table lifted
the panic phrasing onto the right page and could not lift this one, and no amount
of ranking work will.

If symptom questions keep costing a round on a search that cannot help, the
cheaper shape is for `owa_help_search` to recognise the symptom shape itself and
answer with a pointer to `owa_list_screens` instead of its best lexical guess.
Only worth doing if the round is actually being spent — instrument first.

## EC-18 · The ring landed on the wrong control — `done` 2026-08-31

**Reported from the app with a screenshot.** The walkthrough step "Open the
Background panel" ringed **`Background:`** — the background-*transition* button
in the screen preview footer — and pressing **Do it** opened the transition menu
instead of the panel. Measured live, five things on screen matched the word
"Background" and every one of them tied at tier 1:

| candidate | control? | label length |
| --- | --- | ---: |
| the collapsed **Background** panel bar | **no** (a `div`) | 28 |
| `Background:` transition button | yes | 33 |
| **Clear Background [F7]** button | yes | 41 |
| the screen-preview card, the transition group | no | 57 / 31 |

Two independent causes, both now fixed:

- **The app lied about what the control is.** `RenderHiddenWidgetTitleComp` —
  the thin bar that is the only way to reopen a panel you collapsed — was a
  clickable `div` with no `role`, so `checkIsControl` ranked it below any real
  button sharing its words. It is now `role="button"` with `tabIndex={0}` and
  Enter/Space activation, which also means a keyboard can reopen a collapsed
  panel for the first time.
- **The matcher broke ties on length.** `checkIsBetter` went tier → isControl →
  shortest label, and "Background:" is shorter than "Background Enable
  Background". Length is a proxy for specificity and a bad one. `labelOf` now
  keeps each way an element is named APART as well as joined
  (`labelPartsOf`), and an element one of whose names IS the needle
  (`checkIsNamedExactly`) beats one that merely contains it — ranked BELOW
  `isControl` on purpose, because a container is often named exactly what the
  control inside it is named. Note tier 0 was near-dead code before this: any
  element with both text and a `title` could never reach an exact match.

Verified live end to end on the real W-08 recipe from a collapsed layout:
step 1 rings the panel bar, **Do it** reports
`{done: true, did: "clicked", label: "Background"}`, and the panel expands to
its tabs. `owa_find_ui "Background"` also now heads its list with the panel bar.

## EC-19 · A two-letter candidate matched inside a longer word — `done` 2026-08-31

**Found while verifying EC-18, in the same recipe.** W-08 step 2 offers "Ok"
(from "choose **Ok** or **Cancel**") as a control to ring. Nothing on screen is
labelled "Ok" — but `matchTier`'s tier 2 was a plain substring test, and
"Bible Lookup Open bible lookup popup [Ctrl+B]" contains **lo-ok-up**. So the
step rang the **Bible Lookup** button, and in demo mode **Do it** would have
PRESSED it, opening a popup over a volunteer's presenter mid-service. Strictly
worse than the reported bug, and it was one step further into the same guide.

Tier 2 now requires the needle to at least BEGIN a word. That keeps the case
tier 2 exists for — the manual writes "**Web**" for a tab labelled "Webs" — and
drops the case it never wanted. Verified live: step 2 stopped ringing Bible
Lookup.

## EC-20 · A row of tabs written as one bold had nothing to ring — `done` 2026-08-31

With EC-19 fixed, W-08 step 2 rang *nothing*: the recipe names the whole tab row
in a single bold, "**Colors / Images / Videos / Cameras / Web**", and no control
carries that string. Honest, but useless. `toFindCandidates` now offers each
part of a slash-joined bold as its own candidate — the joined phrase FIRST, so a
control genuinely named "A / B" still wins it — and drops the punctuation the
sentence needed but the button does not ("**Colors:**" → `Colors`). Verified
live: step 2 rings the real **Colors** tab (tier 0).

This is a slice of `EC-16`'s 24 "step bolds nothing actionable" steps, taken from
the other end: not by guessing from typography, but by reading the shape the
manual actually writes.

## EC-21 · The card showed a volunteer a manual id — `done` 2026-08-31

Visible in the same reported screenshot: the card read *"Open the Background
panel **(W-08 step 1)** and choose the Videos tab."* The system prompt already
forbids this in as many words — *"NEVER show them ... an id like \"W-06\" — not
even in passing"* — and the model did it anyway. A rule the model can ignore is
not a rule.

`stripInternalIds` now cleans every step text and the title, at one choke point
covering both sources (the model's own steps and a recipe citing a sibling —
W-08 step 2 cites W-15 itself). The whole aside goes, not just the id: deleting
"W-08" out of "(W-08 step 1)" leaves "( step 1)", which is worse than what it
replaced. Verified live through the app's own MCP host with the reported step
verbatim. Words on real controls are untouched ("Ctrl+Q", "16:9", "F7").

**Left open:** the same ids can still reach the user in ORDINARY prose answers,
which do not pass through the guide. That is `EC-22`.

## EC-22 · Prose answers are still on the honour system for ids — `open`, medium

`EC-21` enforces the no-ids rule for anything drawn on a guide card, because
that is where it was caught. A plain chat answer still relies on the prompt
alone, and the same model ignored that prompt once already. The cheap version is
to run the assistant's final text through the same `stripInternalIds` before it
is rendered in `ChatbotAppComp`; the honest question first is whether it happens
in prose at all — instrument before building, the way `EC-14` asks.

## EC-23 · `genSessionId` collides, and flakes the whole gate — `open`, medium

Found by running the gate for `EC-18`: `npm run lint` failed at its FIRST stage
on `src/chatbot/chatSessionHelpers.test.ts` — *expected 499 to be 500* — with
nothing in this change anywhere near it. Reproduced 1 run in 3.

`genSessionId` is `Date.now().toString(36)` + **4** random base-36 characters,
so ids drawn inside one millisecond have 36⁴ ≈ 1.68 M values to land in. The
test draws 500 of them; the birthday probability of a collision is ≈7% per run.
The test is right and the generator is thin.

It matters twice: the gate is `&&`-chained, so a 7% flake at stage one silently
skips the typecheck, prettier, eslint AND build for whoever hit it; and a real
collision merges two of a user's chat tabs. `slice(2, 6)` → `slice(2, 10)` takes
the odds to ~1e-7 and changes nothing else (the ids are opaque keys). Left for
the user to take, because it is product code outside the reported defect.

## EC-24 · A step whose control is inside a menu could only apologise — `done` 2026-08-31

**Reported from the app with a screenshot**, one step further into the same
walkthrough as `EC-18`. W-21 step 2 — *"Right-click an empty part of the list
(or use the + button in the folder-path bar) and choose **Download From URL**"*
— answered:

> I could not do that one for you (nothing on screen to act on) - do it
> yourself, then press Skip.

Correct, and useless. **Download From URL** is genuinely not on screen; it is one
right-click away. Three separate things were wrong:

- **The guide could not right-click at all.** `action` was `click` or `type`.
- **The step's target is a REGION, not a control.** "an empty part of the list"
  has no words on it, and no label matcher will ever find one.
- **A step like this is two actions**, and the card does one per press.

Shipped, and it is the shape that matters more than the case:

- `action: "rightClick"` — `dm.openContextMenu` fires a real `contextmenu` at a
  point INSIDE the region (bottom right: a list fills from the top left, so
  that is its empty part, and right-clicking an item gets the *item's* menu,
  which is a different menu). Verified against the app before any of it was
  written.
- `dm.findListRegion(point)` answers "which list?" the way the user would: the
  scroller above the point the guide last acted at — a panel opens exactly
  where the bar that opened it was — then the NEAREST scroller to that point,
  and only then the biggest on screen. `state.lastPoint` carries it.
- **A step may take two presses.** After any demo action, a label the step
  itself names that was NOT on screen and now IS comes back as `more`, and the
  card holds the step: *Done - and it brought up "Download From URL". Press Do
  it again to finish this step.* It is never clicked for them — "click
  **Delete**, then **Yes**" would otherwise confirm its own dialog.
- `state.pendingFind` aims that second press at what the first revealed.
  Without it the press re-reads the step's candidates from the top and lands on
  whatever still answers to the FIRST of them — live, step 1's second press
  clicked the `Background:` transition button instead of the **Videos** tab it
  had just opened.
- `toGuideSteps` marks a step `rightClick` only when the sentence BEGINS with
  one. W-08 step 2 ("Pick a tab … (or right-click the empty list)") mentions one
  as an aside and its real action is a plain click on a tab already on screen;
  the first version of this broke it.

5 manual steps across W-18, W-21 and W-22 are right-click steps that used to
apologise every time. The two-press completion is wider than that: 105 of the
251 manual steps name more than one control.

Verified live end to end on the real W-21 recipe from a collapsed layout:
press 1 clicks **Background** and reveals **Videos**; press 2 clicks **Videos**;
press 3 right-clicks the list at (797, 822) and the app's own menu opens with
**Download From URL** ringed; press 4 clicks it and the link box appears.

**Also found and fixed:** the manual told the user to press a **+** button in the
folder-path bar. There is no such button — it is a **⋮ More Options** button
(`ListMenuButtonComp`). The recipe now describes it, deliberately WITHOUT
bolding it: "More Options" is the title of several buttons in the app, and
bolding it hands the ring an ambiguous label — the first attempt duly rang the
mini-screen's ⋮ instead.

## EC-25 · The Khmer twin left a husk in the card — `done` 2026-08-31

Visible in the same screenshot: the step ended *"…and choose Download From URL
**(URL)**."* `toEnglishOnly` dropped a bracket only when it held Khmer and
nothing else, so `(ទាញយកពី URL)` lost its Khmer and kept its Latin word. Any
bracket holding Khmer is a translation aside and now goes whole. Brackets that
are all English ("(or right-click the empty list)") are untouched. 0 husks left
across the 251 manual steps.

## EC-26 · The ring landed on the wrong control AGAIN, with the panel open — `done` 2026-08-31

**Reported from the app with a screenshot — the same symptom `EC-18` closed.**
The W-21 walkthrough step *"Open the **Background** panel and choose the
**Videos** tab"* ringed **`Background:`**, the background-*transition* button in
the screen preview footer.

`EC-18` was verified *"live on the real W-08 recipe from a collapsed layout"*.
That is the whole story: with the panel COLLAPSED its title bar is on screen and
says "Background", so the tie-breaks `EC-18` added had something right to pick.
With the panel **OPEN** the pane draws its name nowhere at all — measured live,
the only element on the whole window whose own text was "Background" was the
transition button. There was nothing to rank; the ranking was never reached.

A fix that can only be verified in one of a control's two states is not a fix.

Three changes, in order of how much they carry:

1. **A panel has a name in the DOM, open or collapsed** — every resizable pane
   carries `data-widget-name` (`RenderResizeActorItemComp`), and so does the
   collapsed title bar. It is the **English** key from `toWidgetLabel`, not the
   translated `widgetName`: a panel that only answers to its Khmer text is one
   the matcher loses the moment the app is switched over. Panes named after a
   file or a slide have no English twin and fall back to what they display.
   Production DOM too — `data-react-comp-name` is dev-only, so component names
   were never an option here.
2. **The matcher reads the parent path** (`domMatch.mjs`). `parseNeedle` splits
   `Background > Videos` into a scope and a target and treats the scope as a
   requirement; a trailing kind noun (`panel`, `tab`, `box`) is dropped rather
   than spent on a failed match, and a *region* noun additionally says the words
   in front of it name a place, not a press. `containerPathOf` walks at most 24
   ancestors for at most 4 names, and only for elements that already matched.
   `pathTier` lets the panel supply words the label lacks (`Background Videos`)
   as long as at least one word is on the control itself — otherwise every
   control in a panel answers to the panel's name. `describe` reports `inPanel`.
3. **A recipe that qualifies a bold scopes the rest of the step to it**
   (`guide.mjs`). "the **Background** (ផ្ទៃខាងក្រោយ) panel … the **Videos** tab"
   now yields `Background > Videos`, `Background panel`, `Background`,
   `Videos` — in that order, which is the adaptive part: the scoped candidate
   can only match once the panel is open, so a collapsed panel still rings the
   panel bar, which is the half of the step not done yet.

Verified live in both states: open → the **Videos** tab inside the Background
panel, hint *"The ringed control is in the Background panel, at the middle left
of this window"*; `owa_find_ui "Background"` now answers with the panel first
where it used to answer with the transition button. 9 tests added.

Cost: +97 tokens/round (~8686 → ~8783) for the `Panel > Control` syntax in three
tool descriptions. Tool count unchanged at 42.

## EC-27 · The guide card parked itself on top of its own ring — `done` 2026-08-31

**Reported from the app with a screenshot.** The card opens bottom right and the
ring lands wherever the control is, so a step pointing at anything in that corner
was a card reading *"the ringed control"* with the ring underneath it. The
frosted glass was not enough: a control read through an 18px blur is not a
control you can find.

`avoidRing(rect)` picks the first of the four corners that clears the ringed
rect by 12px, bottom right FIRST so a ring nowhere near the card never moves it,
and the least-bad corner when a ring is big enough to reach all four. Corners
only, never a slide — a card that shuffles every time the ring twitches is worse
than one briefly in the way. It stands down permanently once the user drags the
card: they know what is under it and the guide does not. The rect is passed in
rather than read back off the ring, whose 150ms transition means its own box is
still the last step's.

Verified live: a step aimed at the screen preview's `Background:` button moved
the card to the bottom left (overlap 0); a step aimed at the middle left left it
in place.

## EC-28 · The ring only animated its size — `done` 2026-08-31

Asked for directly. The app window is mostly bordered boxes, so a ring that only
grows and shrinks reads as one more of them at a glance. The colour now travels
with it, red through amber and back — `owa-ring-beat` (colour + size) while the
guide waits on the user, and a new `owa-ring-glow` (colour only, no geometry)
while demo mode is about to press it, so "I am about to do this" still reads as
alive rather than as a leftover outline. `prefers-reduced-motion` drops both.

`owa_find_ui`'s own `flash` marker got the same treatment. Its border is set
inline, which the keyframes override: an animation outranks a `style` attribute
in the cascade, so the colour can travel without restyling the marker per frame.

## EC-16 · 69 manual steps still cannot be demoed, and 34 are one rule — `open`, medium

Measured this run over all 39 manual recipes with steps (251 numbered steps).
After EC-15 pressed the keystroke steps, what is left breaks down as:

| Why the step can't be acted on | Steps |
| --- | --- |
| Bold phrase has no capital (`**step-by-step picker**`, `**version**`) | 34 |
| Step bolds nothing at all | 24 |
| Bold phrase is an action verb (`**Double-click**`) | 8 |
| Bold phrase is one character (`**✕**`) | 2 |

The 34 is a single rule: `checkIsControlLabel` requires a capital, because bold
prose ("**not**", "**version**") would otherwise match real controls and ring
the wrong thing — "not" once found the Notes button. That guard is load-bearing
and must NOT simply be dropped. The cheap, safe replacement is to stop guessing
from typography and ask the window: run the bold phrase past `domMatch` and keep
it only if a control with that label is actually on screen. That is a real DOM
query per candidate at start time, so measure it before shipping it.

The 8 action verbs are a different shape — `**Double-click**` says what to DO,
not what to do it to, and the guide has no way to express a double-click at all.
Worth a `action: "doubleClick"` only if a recipe actually needs it.

## EC-17 · A guide step can press a key that clears a live screen — `open`, medium

`F7`/`F8`/`F9` (Clear Slide / Clear Bible / clear) are now pressable by the card,
and W-06 step 5 is exactly that. Today the protection is that demo mode is one
press per step and the user reads the step before pressing **Do it** — the same
protection a step that clicks a Clear button has always had, so this is not a
regression. But the tool description tells the model "never demo a step that
changes what the congregation sees without asking first", and nothing enforces
it. A cheap enforcement: have the card itself refuse a known screen-clearing
keystroke while a screen is actually showing (`owa_list_screens` already knows),
and say why. Do not add a blanket confirm — it would land on every step.

---

## Done

- **2026-08-31 — EC-15 · "Do it" presses keyboard shortcuts.** Reported from
  the app with a screenshot: W-06 step 4, "Close the dialog with the red ✕
  button or **Ctrl+Q**", answered *"I could not do that one for you (nothing on
  screen to act on) - do it yourself, then press Skip."* Measured before
  building: **82 of the manual's 251 steps (33%)** could never be demoed, and
  the largest rescuable slice of those named a keystroke. Now 69 (27%);
  W-06 itself goes from 2 of 6 steps actionable to 5 of 6. Notes for the next
  change here:
  - The app hears keys through ONE `document.onkeydown`
    (`src/event/KeyboardEventListener.ts`) that feeds every registered
    shortcut, so a synthetic keydown at the document drives the real thing.
    Proved before writing any code, both directions: Ctrl+B opened the Bible
    Lookup popup, Ctrl+Q closed it. Both are renderer bindings
    (`commonButtons.tsx`, `ModalComp.tsx`) — an Electron MENU accelerator would
    NOT have been reachable this way, so check which kind a shortcut is before
    assuming a step can be pressed.
  - The event carries `code` as well as `key`: the app forces every key back
    through an en-US layout via the code (`toEnUsKey`), so a `key` alone
    matches nothing on a German or Khmer keyboard.
  - `toKeystroke` deliberately refuses a bare modifier ("hold **Ctrl** while
    clicking" names no key) and a bold single letter (emphasis far more often
    than a key; pressing a stray letter into whatever has focus is worse than
    declining). A single character counts only WITH a modifier.
  - What is written is what is sent, on every platform. The app registers some
    shortcuts Ctrl-everywhere (`allControlKey`) and others Ctrl-on-Windows /
    Cmd-on-Mac, so no rule rewrites "Ctrl" for a Mac correctly for both — and
    the card is showing the user those same words to read.
  - The guide's own press must not also count as the user doing the step. An
    explicit `isSelfPressing` flag does that, NOT `event.isTrusted`, which
    would also ignore a press driven through the MCP tools, where advancing is
    right. (`isTrusted` is also un-forgeable in jsdom, so that guard could not
    have been tested.)
  - `owa_guide_status` grew `canActOnStep` and `press` because a keystroke step
    reported `isTargetFound: false` with no label — indistinguishable from a
    broken guide, which invites the model to "fix" one that was working.
  Verified live end to end (the real W-06 recipe, demo mode, step 4, dialog
  open → `{done: true, did: "pressed", keys: "Ctrl+Q"}` → dialog closed).
  CB-11 rewritten, README tool table extended, 7 tests added.

- **2026-08-31 — EC-10 · the chat tab menu, the lock, and the two sweeps.**
  Asked for as "an option to clear all chats" and shaped, over the same session,
  into a `⋮` on the left of every tab (right-click does the same) opening
  *Rename this chat* / *Lock this chat* / *Close this chat* / *Close other
  chats…* / *Clear all chats…*. Notes worth keeping for the next change here:
  - The menu CANNOT live inside `.chat-tabs` — that box scrolls, so a menu in it
    is clipped at its edges. It is `position: fixed`, width pinned to a constant
    (there is nothing to measure before the first frame), clamped to the window,
    with a transparent sheet behind it doing the click-outside.
  - The window still loads bootstrap and its own sheet and nothing else, so the
    confirmation is a line under the strip, not `ConfirmPopupComp` — that popup
    would drag `tran()` and a module-scope listener in for one question.
  - Both sweeps `saveChatSessions` synchronously instead of on the 400ms
    debounce: someone who clears the history means it gone from disk now. They
    read `sessionStateRef` rather than using the `setSessionState` updater —
    a side effect in an updater runs twice under strict mode, with two
    different new session ids.
  - `isLocked` is the protection both sweeps step around, and
    `handleClosingSession` refuses it too: the `×` being absent is a UI fact,
    not a guarantee.
  Verified live (menu on a plain and a locked tab, both confirmations, a solo
  and a clear that each left the locked tab standing, `isLocked` read back off
  disk). CB-15 added, W-42 steps 3 and 4 added, `.claude/CLAUDE.md` updated.

- **2026-08-31 — this skill.** `owa-enhance-chatbot` created: SKILL.md, the
  architecture / MCP-tools / verification references, this backlog, and
  `scripts/audit-mcp-tools.mjs` (live tool-surface audit, discovery-based URL,
  `--json`, `--rounds=N`, `ACTING_TOOLS` warnings). Baseline recorded above.
