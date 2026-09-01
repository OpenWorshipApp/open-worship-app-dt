# Scoreboard — the climb, run by run

"Greater and greater" only means something if it is measured the same way every
time. One row per run of this skill. **Append, never rewrite history** — a row
that got worse is the most useful row in the file.

## How a run scores itself

1. Ask the standing corpus ([research.md](./research.md) Track A) — the same
   twelve shapes, in the same order, presenter and reader.
2. Grade each answer on the scorecard. An answer **passes** only if it is *all* of:
   correct, actionable, leak-free, and offered a walkthrough when it needed one.
   Partly-right is a fail; that is the point.
3. Run `scripts/audit-mcp-tools.mjs` for the cost columns.
4. Write the raw per-question detail to
   `test-results/chatbot-quality/score-<runid>.json` (gitignored, like
   robot-test's coverage files) and the one-line summary here.

Keep the corpus stable so the rows compare. When you ADD a question, add it to
[research.md](./research.md), note it in the row's *Notes*, and never retire one
just because it keeps failing.

## The rows

| Run | Date | Pass | Leaks | Median rounds | Tools | Tokens/round | Rung | Shipped |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| baseline | 2026-08-31 | not yet graded | — | — | 42 | ~8 555 | 2 (partly) | skill created; `EC-01..09` filed |
| retrieval | 2026-08-31 | 2/4 spot-check → 3/4 (+1 ratchet check held) | 0 | not instrumented | 42 | ~8 555 | 2 (partly), rung 5's own test question now passes | `EC-01` + `EC-04` closed; symptom-shape prompt rule; query-side vocabulary aliases |
| guide-acts | 2026-08-31 | demoable manual steps 169/251 → **182/251**; W-06 2/6 → 5/6 | 0 | n/a (no LLM round — a card defect) | 42 | ~8 555 (+0) | **3 up**: demo mode does the step on 13 more steps, incl. the reported one | `EC-15` closed; `owa_guide_start` takes `press`, status gains `canActOnStep`; `EC-16`/`EC-17` filed |
| right-target | 2026-08-31 | W-08 walkthrough: 1/4 steps rang the right control → **2/2 of the steps that name one**; 2 wrong rings → 0 | **1 → 0** (a card showed “(W-08 step 1)”) | n/a (no LLM round — a card defect) | 42 | ~8 633 (+0) | **3 up**: the ring, and so **Do it**, lands on the control the step means | `EC-18`–`EC-21` closed; `EC-22` filed |
| menu-steps | 2026-08-31 | W-21 demo: 0/5 steps completed → **all 4 actionable steps completed**; right-click steps 0 → 5 | 0 | n/a (no LLM round — a card defect) | 42 | ~8 686 (+53, the rightClick description) | **3 up**: demo mode reaches a control inside a menu | `EC-24`, `EC-25` closed; `action: "rightClick"`, region targets, two-press steps |
| parent-path | 2026-08-31 | W-21 step 1 with the panel OPEN: wrong control → **right control**; `owa_find_ui "Background"` rank 1 wrong → right. **Regression caught: `EC-18` (run `right-target`) only ever held with the panel collapsed** | 0 | n/a (no LLM round — a matcher defect) | 42 | ~8 783 (+97, the `Panel > Control` syntax) | **3 up**, and 2 shored up: a step's ring is now right in BOTH panel states, not one | `EC-26`–`EC-28` closed; panes carry `data-widget-name`, matcher reads the parent path, card dodges its own ring, ring animates colour |

**retrieval run, in one line.** Spot-checked the four corpus shapes whose
retrieval was measurably wrong. Two were real failures live: the panic question
answered with *generic hardware advice* ("make sure the projector is turned on…
check that the cable is securely connected") and the non-native one *guessed* a
control ("may be labelled something like **Hide Screen**" — the opposite of what
they wanted). Both now diagnose from live state and name the real control. The
other two already passed and were left alone. Detail:
`test-results/chatbot-quality/score-2026-08-31-retrieval.json`.

Two things this run learned that the next one should not re-derive:

- **A symptom is a different question shape from a task**, and the prompt only
  routed the three task shapes ("how do I", "where is", "what does X do") to a
  tool. A volunteer reporting "nothing is showing" matched none of them, so the
  model answered from world knowledge — about hardware it cannot see — while
  `owa_list_screens` sat unused. That is the highest-stakes question in the
  corpus and it was the one with no route.
- **Retrieval could not have fixed it alone.** "the words no come out big screen"
  has no lexical path to the right page even with the filler stripped, because no
  manual page can say whether *this* screen is showing right now. Symptom
  questions are answered by looking, not by searching — which is why the prompt
  rule, not the alias table, is the load-bearing half of this change.

**menu-steps run, in one line.** Driven by a second user screenshot, one step
further into the walkthrough the previous run fixed: *"Right-click an empty part
of the list … and choose **Download From URL**"* answered *"I could not do that
one for you (nothing on screen to act on)"*. It was three gaps at once — the
guide could not right-click, the step's target is a REGION with no words on it,
and the step is two actions while the card does one per press. All three shipped;
verified live on the real recipe from a collapsed layout, four presses, ending
with the app's own context menu open and **Download From URL** ringed. Detail:
`test-results/chatbot-quality/score-2026-08-31-menu-steps.json`.

Three things this run learned that the next one should not re-derive:

- **A synthetic `contextmenu` opens the app's real menu**, and the menu is drawn
  from the event COORDINATES — one fired at 0,0 lands in the corner away from
  what it belongs to. Right-click the bottom right *inside* a list: it fills
  from the top left, so that is its empty part, and right-clicking an item gets
  the item's menu instead, which is a different menu.
- **A second press must aim at what the first revealed**, not re-read the step.
  Re-reading lands on whatever still answers to the step's FIRST label: live,
  after "Background" opened the panel, the second press clicked the
  `Background:` transition button rather than the **Videos** tab it had just
  brought up. `state.pendingFind` is the whole fix and it is not optional.
- **Never auto-click what a press reveals.** It is tempting — the step names it,
  it just appeared — but "click **Delete**, then **Yes**" would confirm its own
  dialog. The card holds the step and says what the next press will do; every
  action stays a press the user made.

Two documentation defects surfaced from the same screenshot, both fixed: the
recipe told users to press a **+** button that does not exist (it is **⋮ More
Options**), and every card quoting a label with a Khmer twin ended in a husk
like *"Download From URL (URL)"*.

**right-target run, in one line.** Driven by a user screenshot: the card said
"Open the Background panel" and ringed the `Background:` **transition** button,
so **Do it** opened the transition menu. Both causes fixed (the collapsed panel
bar was a `div` pretending not to be a button; the matcher broke ties on label
length), and verifying the fix found a worse one a step later — "Ok" matched
inside "lo-**ok**-up", so step 2 rang **Bible Lookup** and demo mode would have
pressed it in front of a congregation. Detail:
`test-results/chatbot-quality/score-2026-08-31-right-target.json`.

Three things this run learned that the next one should not re-derive:

- **Length is not specificity.** The matcher's last tie-break was "shortest
  label wins", which is a proxy for "most specific" and a bad one:
  `Background:` beat `Background Enable Background`. Ranking by whether an
  element is actually NAMED the words is the real question, and it was
  unaskable because `labelOf` joined every name into one blob first — which
  also meant tier 0, "exact match", was unreachable for any element carrying
  both text and a `title`.
- **A wrong ring is worse in demo mode than a missing one.** Every ranking
  loosening has to be judged as "what would **Do it** press?", not "did it find
  something". Both defects here found something confidently.
- **The matcher memoises itself in the page** (`window.__owaDomMatch`), so a
  window that has been driven once keeps the OLD runtime forever. Nothing a
  user can hit; everything a verification run hits. Delete it (and
  `window.__owaGuide`) before believing a live result.

Columns:

- **Pass** — passed / 12 (or / corpus size), by the all-four rule above.
- **Leaks** — answers containing a path, id, setting key or component name. This
  column should be 0 forever; anything else is the top of the next run's ranking.
- **Median rounds** — tool rounds per answer, from the dev terminal. 1–2 is the
  target; 5+ means the tools are not answering.
- **Tools / Tokens per round** — from the audit script.
- **Rung** — from the ladder in SKILL.md, judged by the WORST answer.
- **Shipped** — what changed, and the `EC-xx` it closes.

## Ratchet rules

- A question that passed in an earlier run and fails now is a **regression**, and
  it outranks every new idea in the next run's plan.
- **Leaks** and **unsafe acting calls** are never traded away for cost or
  capability, whatever else a run is doing.
- A rung is only marked *reached* when the whole corpus holds it — and it can be
  marked back down when the evidence says so. Moving a rung down honestly is worth
  more than holding one up falsely.
