---
name: owa-enhance-tips
description: 'Make the Open Worship App in-app TIPS genuinely useful, one window at a time — Help → Tips of the Day / All tips and the walkthrough card each tip starts (`tools/owa-devtools-mcp/readerDemos.mjs`, `readerExtraDemos.mjs`, `presenterDemos.mjs`, `pageDemos.mjs`, `appMenuDemos.mjs`, `src/toast/dailyTipHelpers.ts`, `DailyTipComp`). Use when asked to improve / add / upgrade / expand tips, tips of the day, All tips, lessons, demos or walkthrough tips, to make tips easier to find or more helpful, to fix a tip that fails, or to reach a tip-coverage percentage for a window, e.g. `/owa-enhance-tips reader.html 99%`. THE MEASUREMENT RULE: a percentage is of the window''s control INVENTORY (`references/inventory/<page>.json`) and comes only from scripts/tip-coverage.mjs. An item is COVERED when a tip presses or names it AND the All tips search finds that tip by the control''s own words; ACTED (a safe Do it reaches it) and the same search in Khmer and French are reported beside it; the figure is provisional while leads (labels the source or the live window draw that the inventory has not decided on) remain. THE TIP RULE: a tip counts once it is verified in the running dev app — found by search, Show it, every Do it pressed, once in Khmer — and no tip presents, deletes, picks a file or reloads for the person. Every new string needs Khmer and French, catalogs stay lean (all of them load in every window), and `npm run lint` is the gate.'
argument-hint: '<window> [N%] (e.g. reader.html 99%) | measure <window> | harvest <window> | quality <window> | --all | report — default: --all, then ask which window'
---

# OWA Enhance Tips — every control taught, found by its own words, and safe to try

A tip is the app teaching itself to a volunteer who will never open a manual:
**Help → Tips of the Day** draws one, **Help → All tips** lists every one for
the window in front with a search box, and **Show it** starts the walkthrough
card whose **Do it** presses the control for them. A tip is only useful when
three things are true at once: it **exists** for the thing the volunteer is
trying to do, the volunteer can **find** it by typing the words they see on
the button (in their language), and it **works** in the window as it is today.
This skill raises all three, per window, against a number that cannot be
gamed.

```text
MEASURE → INVENTORY (harvest + triage until no lead is left) → PLAN (cheapest
gain first) → WRITE → VERIFY LIVE (English, then Khmer) → GATE → PAPER TRAIL
```

`/owa-enhance-tips reader.html 99%` is a long climb, not one batch. The
inventory, the scoreboard and the backlog are files, so a cleared conversation
resumes from the last measured figure. Every run states the before → after
numbers it moved.

## The rules

1. **Every percentage comes from `scripts/tip-coverage.mjs`.** The
   denominator is the window's inventory, an item per thing a volunteer can do
   there. A figure is **provisional** while any lead is untriaged — an
   inventory that leaves controls out reaches 99% of nothing — and an
   exclusion moves the goalposts, so every one carries its reason and is
   listed in the run's report. Excluding an item to reach the target is the
   one forbidden move.
2. **A tip counts once it is verified live.** Found through the All tips
   search, started with **Show it**, every **Do it** pressed in the running dev
   window with the effect seen on a screenshot — and the window's new or
   changed tips run once in Khmer, where a missing string THROWS. A tip that
   passes the tests and was never run is not done (CLAUDE.md _Verifying code
   changes_).
3. **No tip acts for the person where it should not.** **Do it** never
   presents to a screen, never removes, deletes or overwrites (the firewall
   refuses those words anyway), never chooses a file, a translation or a
   record for them, and never reloads, relaunches, resets the layout or opens
   Developer Tools. Those stay self-guided words. A native menu is not in the
   page, so its tip explains and cannot press.
4. **Every string a tip shows goes through Khmer AND French.** The title,
   the detail and the category are `tran()` keys
   (`src/toast/dailyTipTranslations.test.ts`); a `translateFind` label must be
   a key too or `tran()` throws on it in a Khmer dev window. The Khmer detail
   carries the button's **Khmer** name, word for word as the dictionary has it,
   or a Khmer volunteer typing the button's words finds nothing.
5. **Performance outranks coverage** (CLAUDE.md). `dailyTipHelpers.ts`
   imports every catalog statically and `DailyTipComp` → `ToastComp` puts it
   in every window that shows toasts, so each tip is paid for in memory by
   windows that never show it. Prefer one lesson that teaches a panel's family
   of controls by name over ten one-liners; keep titles and details short (the
   script reports the catalog's weight); a structural fix (a lazy catalog per
   page) is a `TP-xx` proposal for the user, never a quiet refactor.
6. **Everything under `.claude/skills/` ships** in the installer's knowledge
   bundle (the `.md` files): no secrets, nobody's own data. The live harvest
   file holds the operator's passage and file names; it stays in
   `test-results/` and is never quoted into a note or an inventory.

## Invocation

| Argument | What happens |
| --- | --- |
| *(none)* · `--all` | One line per window (`--all`), then ask which window to climb and to what |
| `<window> [N%]` (`reader.html 99%`) | The whole loop on that window until N% covered (default 99) with no lead left, or until what remains is blocked on a decision |
| `measure <window>` | §1 only — the numbers, the leads, the quality findings; nothing written |
| `harvest <window>` | §2 only — walk the window's states, harvest, triage until no lead is left |
| `quality <window>` | §1 + fix the quality findings only (translations, searchability, refusals) |
| `report` | The scoreboard and the open `TP-xx` items; nothing written |

A window is named as its page file, its key or its label: `reader.html`,
`reader`, `presenter.html`, `setting`, `appDocumentEditor`, `bibleNote`,
`webEditor`, `lyricEditor`, `lwShare` (`BOT_FOCUS_LIST` in
`tools/owa-devtools-mcp/botFocus.mjs`).

## Where tips live

| File | Owns |
| --- | --- |
| `tools/owa-devtools-mcp/readerDemos.mjs` | The Reader's core lessons (the first 30 are the featured practice shelf) |
| `tools/owa-devtools-mcp/readerExtraDemos.mjs` | Further Reader lessons through `lesson(id, category, label, detail, steps)` — new Reader tips go here |
| `tools/owa-devtools-mcp/presenterDemos.mjs` | The Presenter's lessons; their All tips heading is the id sets in `getPresenterTips` (`src/toast/dailyTipHelpers.ts`) |
| `tools/owa-devtools-mcp/appMenuDemos.mjs` | File / Edit / Tools / Window / Help menu lessons, shared by both pages |
| `tools/owa-devtools-mcp/pageDemos.mjs` | ONE step per lesson for Settings, the editors, Bible Note, Local Web Share |
| `src/toast/dailyTipHelpers.ts` · `DailyTipComp.tsx` | The All tips list, its categories, its search (title + detail + category), Show it |
| `src/lang/data/km/index.ts` · `fr/index.ts` | Every tip string's translation |

The same catalogs feed `owa_guide_start { demoId }` and the chatbot's practice
shelf, so a tip is also an answer the 🤖 can run. **Before changing any of
them, read `.claude/rules/agent-tools.md` whole** — the tips and demo sections
record why a lesson is shaped the way it is (a press per **Do it**, `look`
steps after an action, scoped labels translated part by part, the shortcut a
tip must press). Method, inventory format and the tip-writing rules:
**[references/method.md](./references/method.md)**.

## Procedure

### 0. Preflight

- `owa_app_state`: a DEVELOPMENT instance is up with the window in question
  (`isDev: true`). If none, start one with
  `env -u ELECTRON_RUN_AS_NODE npm run dev` (CLAUDE.md). Two dev instances is
  normal; the script and the MCP take the newest unless given `--port`.
- `git status`: note what other sessions have in flight, and never revert it.
- Read `references/scoreboard.md` and `references/backlog.md` — the last
  figure and the open `TP-xx` items are this run's starting point.

### 1. Measure

```bash
node .claude/skills/owa-enhance-tips/scripts/tip-coverage.mjs reader.html 99%
node .../tip-coverage.mjs reader --uncovered   # every item not covered, and why
node .../tip-coverage.mjs reader --leads       # every untriaged label, by file and panel
node .../tip-coverage.mjs reader --quality     # every quality finding
node .../tip-coverage.mjs --all                # one line per window
```

It prints, for the window: the catalog (tips, how many have a **Do it**, the
featured count, its weight in KB), **COVERED** (the headline), _taught but not
findable_ and _uncovered_, the same search in Khmer and French, **ACTED** over
the items a tip may press, a table by surface, the leads, and the quality
findings (`untranslated`, `find-untranslated`, `destructive-find`,
`duplicate-title` are errors; `not-searchable`, `long-*`, `many-steps` are
warnings; `self-guided`, `unknown-control` are notes). No inventory yet:
`--init` writes the skeleton — fill in `scope` and `sourceDirs` first.
Record the baseline before writing anything.

### 2. Inventory — harvest, then triage until no lead is left

**Harvest the live window in every state a volunteer can reach.** Each
`--harvest` reads the window over raw CDP exactly as `owa_list_ui` does
(nothing pressed) and merges its labels and the source files it saw rendered
into `test-results/owa-enhance-tips/<page>-harvest.json`. Between passes, open
the next state with SAFE presses only — `owa_click` on panel toggles, tabs,
pickers and "More Options" (`button: 'right'` for a context menu) — and close
a menu with `owa_press_key` Escape. A control painted only under the mouse is
read without a hover (it is listed `showsOnHover`); one the app CREATES on
hover comes in from source as a lead. Never press
anything that presents, removes, imports, exports or picks a file to get
there. The state walk for each window is in method.md §3; a window is
harvested when a pass over every state adds no new label.

**Triage every lead.** A lead is a label the window can draw that the
inventory has not decided on — from source (`tran()` in a control position in
`sourceDirs`/`sourceFiles` and in every file a harvest saw rendered) or from
the live window. Each becomes ONE of:

- an **item** — something a volunteer can do: `id`, `surface`, `labels` (the
  exact English words on the control; scoped as `Bible Notes > More Options`
  when the same words sit in several panels), and as needed `press` (a
  shortcut), `search` (words a volunteer would type instead: `version` for the
  `KJV` button), `strict` (a generic word like `Next` — prose takes no credit),
  `personOnly` (why only the person may press it: a file choice, the
  projector, a native menu), `aliases` (other words the same control shows);
- an **ignore** — not a control: the person's own data by `pattern`, a status
  or error sentence by `label`, a folder of non-Reader code by `file` — each
  with its `reason`;
- an **exclusion** — a real control deliberately not taught (`exclude`, with
  its reason): developer-only rows, a control that is about to be removed.

Group what is one thing to a volunteer (forty saved rows' "More Options" is
one item, scoped to its panel). Re-run until `leads: 0 … 0`; only then is the
COVERED figure a claim.

### 3. Plan — the cheapest real gain first

1. **Errors** from `--quality` — they are tips that fail today.
2. **Taught but not findable** — a tip already teaches it; put the control's
   words (English, and the Khmer control name in the Khmer string) into the
   tip's detail. Usually one detail rewrite covers several items.
3. **Uncovered**, grouped by surface — first extend an existing lesson that
   already names that panel; write a new lesson only for a task no lesson is
   about.
4. **Acted** — where an item is actable and only taught in words, give its
   lesson a safe **Do it** step (method.md §5 says which are safe).
5. **Not searchable / long** warnings on the tips touched anyway.

State the batch and its predicted COVERED gain before writing. When the
target cannot be reached without a decision — a window whose catalog allows
one step per tip (`pageDemos.mjs`), the catalog weight, a control whose label
is not translated in the app itself — file it as `TP-xx` and say so.

### 4. Write

method.md §4–§6 hold the rules: one task per tip; a title in the volunteer's
words naming the outcome; a detail that names the controls by their exact
words (that is what search reads); one visible action per step; the opener
first, with `skipIfVisible`, when the control sits inside a closed panel;
`translateFind` on every label; scoped labels for repeated controls; Mac keys
named in a `press` step's text. New and changed `label`, `detail` and
`category` strings get Khmer and French entries (reusing the dictionary's own
words for the controls); a reworded string's OLD entry is removed from both
dictionaries, because every entry is loaded into memory. Update the count
tests in the same change: `readerDemos.test.mjs` / `presenterDemos.test.mjs`
(total and the featured 30 / 25), `src/toast/dailyTipHelpers.test.ts`
(`getDailyTips` lengths, the foreground set).

### 5. Verify live — the product path, then Khmer

For every new or changed tip, in the running dev window:

1. Open **Help → All tips** (`owa_menu`), type the control's words into
   **Search tips** (`owa_type`) — the tip must be in the list. That is the
   findability claim, tested.
2. Press it, then **Show it** (`owa_click`). The renderer hot-reloads the
   catalog, and when Electron's long-lived MCP host still has the older one it
   sends the lesson inline — so this path needs no restart.
3. `owa_guide_step { action: 'do' }` once per **Do it**, `owa_screenshot`
   after each: the effect happened, and the next step's control is ringed.
   A refusal or "no control named …" is a broken tip, not a flaky one.
4. `owa_guide_step { action: 'stop' }`, then put back what the tip changed
   (font size, an opened panel) — with the app's own controls or Undo only.
5. **Khmer pass** — record the language, switch to Khmer the way
   `/owa-robot-test` §6d does (Settings → Language → Khmer → **Apply
   Settings**, which reloads every window), open All tips, search the
   control's KHMER words, Show it, one **Do it**. A missing key throws here and
   blanks the card; a find that resolves in English and not in Khmer is a
   `translateFind` gap. Restore the recorded language the same way.

`--steps=<demoId>` prints a tip as an `owa_guide_start` payload for a quick
check without the menu; it is not the product path and does not replace 1–3.
Never "Discard changed", never present, never hide a screen that is up
(CLAUDE.md).

### 6. Gate

Targeted first, then the whole gate:

```bash
npx vitest run tools/owa-devtools-mcp/readerDemos.test.mjs tools/owa-devtools-mcp/presenterDemos.test.mjs tools/owa-devtools-mcp/demoHelpers.test.mjs src/toast/dailyTipHelpers.test.ts src/toast/dailyTipTranslations.test.ts src/toast/DailyTipComp.test.tsx src/lang/tranKeyCoverage.test.ts
npm run lint
```

`npm run lint` stops at the first failing stage; read the log body, not the
exit code of a pipe (CLAUDE.md).

### 7. Paper trail

In the same change:

- the inventory's `updated` date; `tools/owa-devtools-mcp/reader-demo-coverage.md`
  (counts and feature map) when Reader tips changed;
- the lesson counts in `.claude/rules/agent-tools.md` (Reader / Presenter
  totals and how many begin with an action) when they moved;
- one row in `references/scoreboard.md` per window measured, and `TP-xx`
  entries for what was found and not fixed;
- any edit under `.claude/` → `node extra-work/build-knowledge.mjs`.

## The report

```text
Tips — Bible Reader (reader.html) · run <date>
COVERED   61.0% → 74.5%  (provisional → final: leads 0 / 0)   target 99%
ACTED     48.2% → 55.0%   search in km 40% → 66% · fr 52% → 71%
catalog   100 → 109 tips · 74 → 79 KB lessons · 24 → 27 KB km/fr strings
changed   9 new tips, 14 details reworded, 3 Do it steps added
verified  live: 26 tips (English) · 6 (Khmer) — screenshots …
excluded  4 items, each with its reason …
not done  TP-04 … (needs a decision: …)
```

Then the uncovered items that remain, grouped by surface, and the quality
findings still open.

## Gotchas

- **The MCP host caches the catalog.** Electron's in-app host and the
  session's `owa-devtools` stdio server both loaded `readerDemos.mjs` once;
  `owa_guide_start { demoId }` names a NEW id as unknown until that server is
  fresh (memory `mcp-tool-edit-two-processes`). Verify through All tips (§5),
  or reconnect the MCP server.
- **A control painted only under the mouse is still a control** —
  `owa_list_ui` marks it `showsOnHover`, and a tip names it directly; the
  guide forces the hover before it rings or presses.
- **`tran()` throws on a missing key in a Khmer or French dev window**, so a
  tip with a gap blanks its card only there — the reason for the Khmer pass.
- **The firewall refuses a destructive word** in a `find` in every language
  (`destructiveLabel.mjs`); such a step can never run, and the script reports
  it as `destructive-find`.
- **The featured shelf is a count the tests hold** (30 Reader, 25 Presenter):
  a new lesson is `isFeatured: false` unless it replaces a featured one.
- **Help → All tips opens in EVERY open window with tips at once**
  (2026-10-23): the click goes to every window and `DailyTipComp` no longer
  checks for focus, so a Settings window open beside the window under test
  gets its own list too. Search inside the card of the window being
  measured (`owa_find_ui` with that `page`), and close the others' cards
  with their **×**. It presses nothing.
- **The firewall allows 25 presses a minute**, and a run that searches,
  opens, shows and presses four times a tip reaches it in six tips. Pace the
  presses; a `find_ui` on the tip's title after each search is not a press.
- **The live harvest cuts a label at 80 characters**, so an ignore pattern
  for data that repeats itself (a names record) must match the cut form.
