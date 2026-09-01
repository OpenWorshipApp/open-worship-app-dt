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
