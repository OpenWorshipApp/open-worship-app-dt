---
name: owa-enhance-agent-docs
description: 'Keep the Open Worship App agent documents true to the code, and make agents more useful across the whole repo. Use when asked to audit, fix, refresh or slim the agent docs: `.claude/CLAUDE.md`, `.claude/rules/`, `.claude/memory/` + MEMORY.md, `.claude/skills/`, `.mcp.json` — and the user manual's recipes (`user-workflows.md` → `docs/manual-sources`), which the in-app 🤖 answers from: an outdated guide page, or the chatbot answering with steps that no longer exist. Also use for stale notes, doc-vs-code mismatches, and questions like "what should the agent know" or "how can the agent help more". Two jobs. DRIFT: scripts/audit-agent-docs.mjs lists every claim the code contradicts; each lead is confirmed against code and git history, then the doc is fixed in place, with the knowledge rebuilt. LEVERAGE: blind spots, context cost, prose rules a test or hook could enforce, and repeated session friction (scripts/session-friction.mjs) become AD-xx proposals, reported and applied only on `apply`. Code is the truth for facts; a doc is the truth for decisions; history stays history.'
argument-hint: '[auto (default) | audit | drift | leverage | friction | <doc or code path> | apply AD-xx … | file]'
---

# OWA Enhance Agent Docs — the notes match the code, and the agent gets better at this repo

The agent documents are how every agent learns this project. That covers every
Claude Code session and the in-app 🤖.
The chatbot answers volunteers from `.claude/` as its internal corpus, which
ships in plaintext inside the installer. A wrong line here misleads both,
at once and silently. A missing line makes each of them rediscover the same
trap at a cost. This skill does two jobs:

1. **Drift.** Find every claim in the agent docs that the code no longer bears
   out, confirm it, and fix the doc. Docs are this skill's to edit.
2. **Leverage.** Find where an agent could help more or waste less anywhere in
   the project: an area no note covers, a rule held only by prose, context paid
   for in every session, a wall sessions keep walking into. Each one becomes a
   proposal, and the user decides.

```text
SCAN (scripts, ~1 s + ~15 s)  →  CONFIRM (code · git · live)  →  FIX drift in the docs
                              →  PROPOSE leverage (AD-xx)    →  ⏸ the user decides  →  APPLY
```

## Non-negotiables

1. **Code is the truth for facts; a doc is the truth for decisions.** Facts are
   names, paths, numbers and which tools exist. Before rewriting a doc to match
   the code, find out which side moved and why (`git log -S`, `git blame`). A
   note may record a decision, such as *deliberately*, *do not "fix"*,
   *never* or *always*. If the code now breaks it, that is a possible
   **regression**. Report it and route it to `owa-enhance` or the owning
   skill. Never rewrite the note to bless the change.
2. **History stays history.** Some text describes a day and stays true about
   that day: ledgers (backlogs, scoreboards, plans, the frozen
   `coverage-expansion/`), notes marked FIXED, dated measurements (*"measured
   2026-08-31: 42 tools"*) and past tense. Leave it alone. Add a pointer
   (*"since renamed to `X`"*) only when a reader needs today's code.
3. **A drift fix edits documents only.** That means agent docs. Code, tests,
   settings, hooks, user data and the app's screens wait for `apply`.
4. **Paper trail in the SAME change.** Run
   `node extra-work/build-knowledge.mjs`. It clears only
   `electron-build/knowledge`, needs no restart, and relaunches nothing:
   `electron:watch` ignores that folder since 2026-10-11 (`AD-16`; an
   `electron:dev` started before that change still relaunches until it is
   restarted). Change `tools/owa-devtools-mcp/questions/*.json` only when
   user-facing knowledge moved (a recipe, a control, a feature). An agent-only
   note does not move it.
5. **Ships in plaintext.** Everything under `.claude/` lands on every operator's
   disk. No secrets, nobody's own data, no working exploit for an open hole.
   Write a transcript finding as a class of trouble and never quote it (memory
   `no-user-specific-references-in-notes`).
6. **Smaller is a feature.** Every session pays for every byte of
   `CLAUDE.md` and the head of `MEMORY.md`. A fix that adds text must earn it.
   For an overgrown always-loaded section, the best fix is to move it into a
   `paths:`-scoped rule. Don't write down what the code already says.
7. **Another session may be mid-work.** Run `git status` first. Edit a doc
   someone else has dirtied only with exact, minimal Edits, and never rewrite
   it whole. The same for CODE nobody has committed: the audit lists a note or a recipe
   that is due *only because of an uncommitted file* apart from the ones a
   commit moved (2026-10-11, `AD-18`). Your own file: read the note now and
   stamp it with `--allow-dirty`. Another session's: name the file in the
   report and leave the note — a stamp against it is refused, because it
   would not outlive their next save.

## Invocation

| Argument | What happens |
| --- | --- |
| *(none)* or `auto` | Scan → confirm → fix the safe drift, the manual included, until the audit is clean (§3b) → leverage report → stop and ask |
| `audit` | Read-only: scan and confirm, then report the drift fixes it WOULD make. No edits |
| `drift` | Job 1 only: confirmed safe drift fixed, the rest reported |
| `leverage` | Job 2 only: proposals reported, then stop |
| `friction` | Lens L4 alone: what the local session transcripts say agents trip on |
| a doc (`.claude/rules/agent-tools.md`) | Every claim in that doc, scripted and by hand |
| a code path (`src/_screen`) | Every doc that names it, plus the blind-spot lens for that area |
| `apply AD-xx AD-yy` · `apply all` | §6, for exactly those proposals |
| `file` | Record the report's findings in [the backlog](./references/backlog.md) |

**The manual is in scope** (2026-10-11). `user-workflows.md` from its first
`### W-` heading on is what `docs:gen` turns into the pages the 🤖 answers
from, and a recipe naming a control or a file that is GONE is drift like any
other. The `manual` check finds it; this skill fixes it (§3), from the code
and from what the read-only tools show in the running app. Until that date the
whole file was skipped as a ledger, and W-07 sent people to a card that had
been gone for six weeks, through several runs, until the assistant repeated it
to a user. Only its dated head is history.

**A recipe is read, and the read is recorded.** No pattern can tell whether a
step is still what the code does, so `references/manual-reviewed.json` keeps,
per recipe, a hash of its words and one of the files its `Verify:` rows cite.
The `manual` check lists a recipe as *due a read* when it has no entry or
either hash has moved, and `audit-agent-docs.mjs --stamp-manual=<ids>` writes
the entry once the recipe has been read against that code. Before the ledger
the signal was "commits since the recipe was last edited", which a recipe
found correct could never clear, so every run listed the same 29 and read the
top few.

**Routed, not done here.** A NEW recipe, or a step only a press can prove,
goes to `/owa-robot-test`, which never publishes an
unobserved step. Chatbot answer quality goes to `owa-enhance-chatbot`, an MCP
tool's behaviour or cost to `owa-enhance-mcp`, and tests to
`owa-upgrade-unit-test`. App code, and a regression found through a note, go
to `owa-enhance`. This skill files the lead and names where it went.

## The agent-document surface

| Document | Read by | Loaded | Notes |
| --- | --- | --- | --- |
| `.claude/CLAUDE.md` | every Claude session; 🤖 corpus | **always** | the costliest bytes in the repo |
| `.claude/memory/MEMORY.md` | every Claude session | **always** (first 200 lines) | one line per note, a hook not a summary |
| `.claude/memory/*.md` | on demand from the index | when relevant | front matter `name` · `description` · `metadata.type` |
| `.claude/rules/*.md` | Claude once a file matching `paths:` is read | conditional | a glob that matches nothing means a rule that never loads |
| `.claude/skills/*/SKILL.md` | description: every session's skill listing; body: on invoke | listing always | the listing cuts a description at ~1 530 characters |
| skill `references/`, `scripts/` | when the skill says | on demand | ledgers are history |
| `.mcp.json` | the agent's MCP registration | — | registers `owa-devtools` |
| `tools/owa-devtools-mcp/README.md` | humans and agents choosing a tool | — | the tool table |
| `electron-build/knowledge/` | the in-app 🤖 | built | internal notes indexed to their first 3 000 characters |
| `.claude/settings.local.json` | this machine's Claude Code | — | personal and untracked: read it, never edit it unasked |
| `README.md`, `RELEASE.md`, `docs/*.md`, every other tracked `.md` | people | — | read for the same claims since 2026-10-11 (the README named an `npm run` script removed weeks before); not in the knowledge; `TODO.md` / `note.md` are history |

## Procedure

### 0. Ground the run

1. `git rev-parse --short HEAD`, `git status --porcelain`, `git log --oneline
   -10`. Record the dirty docs and whose they look like.
2. Is an app published? Check `<temp>/open-worship-app-cdp/*.json` and whether
   `electron:dev` / `nodemon` is running. You need an app only to confirm
   runtime claims live.
3. What is already known: [the backlog](./references/backlog.md), the newest
   report under `test-results/owa-enhance-agent-docs/`, and the `docs` items
   in `owa-enhance`'s backlog.

### 1. Scan

```bash
node .claude/skills/owa-enhance-agent-docs/scripts/audit-agent-docs.mjs       # drift + leverage signals, ~1 s
node .claude/skills/owa-enhance-agent-docs/scripts/session-friction.mjs       # leverage: what sessions trip on, ~15 s
```

Both are read-only, need no app and no network, and write nothing.
`audit-agent-docs.mjs` takes `--check=<a,b>`, `--doc=<path prefix>`, `--all`,
`--with-ledgers` and `--json` (and `--allow-dirty` beside a stamp).
`session-friction.mjs` takes `--sessions=N`,
`--since=YYYY-MM-DD`, `--dir=`, `--all` and `--json`. Every line either prints
is a **lead**.

### 2. Confirm: kill every lead you can

[references/checks.md](./references/checks.md) gives each check's usual false
positives and its confirmation. The moves that settle most leads:

- `git log -S'<name>' --oneline` finds when a name left and in which commit.
  `git log --diff-filter=D --name-only -- <path>` finds a deleted file, and
  `git log --follow` follows a moved one.
- Read the code where the name lives now. The claim must survive the swap with
  its meaning intact, or it is not a rename.
- **The claims no script can see** come from reading. In `auto`, read all of
  `CLAUDE.md`, because a wrong line there costs every session, and **every
  note the `staleness` check lists as due a read** — not the first ten. For
  each, check its concrete present-tense claims (a name, a number, a
  behaviour, a command) against the code, fix what the code contradicts, and
  record the read: `--stamp-notes=<path,…>`. The ledger
  (`references/notes-reviewed.json`, the notes' twin of the manual's) is what
  lets the list reach 0: a note read against these words and this code is not
  listed again until one of them moves. More than about eight due: readers
  that only propose, one writer (`scripts/apply-manual-edits.mjs`), as for the
  manual in §3.
- **Runtime claims** (what a tool returns, what a window shows) get
  `owa-enhance`'s research contract. Use read-only calls only: `owa_app_state`,
  `owa_find_ui`, `owa_list_ui`, `take_snapshot`, `owa_screenshot`. Nothing
  that presents, hides a screen or changes a document.

Then classify each survivor:

- **fix**: one of the safe classes below
- **ask**: a judgement call
- **regression**: the code broke a recorded decision, so route it
- **history**: leave it. File each killed `paths` / `symbols` lead (history,
  or not a path) in `references/killed-leads.json` with its `why`, so the next
  scan sets it aside; the scan reports an entry whose doc no longer names it.
  A proven external name goes in the script's `EXTERNAL_NAME_SET` instead.

### 3. Fix drift (`auto`, `drift`)

Safe classes, fixed without asking:

- A path, symbol, script, tool or env var that was **renamed or moved**. The
  rename must be in the history and the sentence's meaning unchanged.
- A list that claims to be complete but **misses items**. Add them in the
  list's own style, for example CLAUDE.md's `owa_*` list against the tools
  `server.registerTool` registers.
- A **present-tense number** the code states, changed deliberately in a commit.
- **Broken links**: the index against the notes, memory references, `[[…]]`
  links, anchors past a file's end. Re-aim a line anchor at a symbol, because line
  numbers rot first.
- A memory note with **no front matter** or off-schema front matter. Write it
  from the note itself.
- A rule `paths:` glob that matches nothing **because the folder moved**.
- **The manual** (`manual` check), all three of its drift signals:
  - A recipe that **names a control or a file that is gone**. Rewrite the
    step to what the code draws now, and write only what the code or a
    read-only look at the running app shows (`owa_find_ui`, `owa_list_ui`,
    `owa_screenshot`).
  - A **coverage row citing a file that is gone**. Re-aim it where the
    history says the file went, without the line number; when the control is
    gone, rewrite the row to say what does the job now. Never delete a row.
  - **Every recipe listed as due a read** — all of them, not the first few.
    Read it step by step against the files its `Verify:` rows cite: each
    control (its exact label and where it is), what the press does, keys,
    numbers. Fix what the code contradicts. Name every app control drawn
    through `tran()` as `**[en:tran:Key]**` (`scripts/find-label.mjs` says
    whether a word is a key and where it is drawn); leave plain another
    program's label, the English-only help window's, and a word that is only
    leaned on. A step only a press can prove stays as written and is added
    to `references/live-checks.md` — a tracked ledger, because a report is
    gitignored and the statement would be lost with it — for
    `/owa-robot-test`; it does not hold the stamp back. What a read-only look
    or a scratch dev instance CAN settle is settled in the run (memory
    `scratch-dev-instance-beside-user-app`), never on the user's own app.
    Then `--stamp-manual=<ids>`.

  More than about eight recipes due: split them among readers that only
  PROPOSE (the JSON `scripts/apply-manual-edits.mjs` documents — old text,
  new text, the code line that proves it), and apply through that script,
  which refuses a proposal whose proof is not in the code. One writer.

  In the same change: a dated entry at the head of `user-workflows.md` saying
  what was read and what was not seen live, `npm run docs:gen`, the questions
  corpus when a control was renamed, and the knowledge rebuild.

Ask before:

- deleting or merging notes or sections, or moving text between `CLAUDE.md`
  and a rule
- changing a *never*, *always* or *deliberately* rule
- touching another skill's ledger, the dated head of `user-workflows.md`
  included
- a **guard that is gone**: a note says *"pinned by `<name>.test.ts`"* and the
  test is deleted. Mark the guard as gone, then propose rebuilding it through
  `owa-upgrade-unit-test`.
- another skill's `description`, because it changes when that skill fires

Edit in the doc's own voice. Use minimal Edits and leave unchanged paragraphs
alone, since nothing formats `.claude/` and a small diff stays reviewable. Write
dates as absolute dates, and keep the *why*.

### 3b. Done is what the audit prints

Run the audit again after the fixes. A drift run is done when every drift
check prints 0 — `paths`, `symbols`, `tools`, `scripts`, `env`, `ids`,
`memory`, `rules`, `skills` (wiring), `knowledge`, `manual`
(labels, coverage files, recipes due) and `staleness` (notes due a read) — or
when each lead still printed is
accounted for in one of three places: `references/killed-leads.json` with its
*why*, the report's *needs a decision* list, or a regression routed to its
skill. A note or a recipe listed as *due only because of an uncommitted file*
is accounted for by naming that file in the report, when the file is not this
session's own. A lead that was only *reported* is the next run's same lead. That is
how documents stayed out of date through several runs: each one fixed the
first few lines of every list and described the rest.

`src/test-setup/manualRecipes.test.ts` holds the first two manual signals in
the gate: `npm run lint` fails on a recipe naming a label no code draws and on
a coverage row citing a file that is gone.

### 3c. A second reader, and one real run

The audit sees what a script can see, and a proposal is checked by its own
evidence quote: the line it cites is in the code. Neither proves the claim.
So a run that applied more than about twenty corrections through readers
ends with a second read ([references/second-read.md](./references/second-read.md),
`scripts/second-read.mjs`):

- **Every correction goes to a reader that is told no reason.** It gets the
  passage before and the passage now, and is told to refute it from the code.
  A `wrong` is read by the session itself before a document changes, since a
  second reader can be wrong too. An edit that only wrapped a control's name
  in a template is checked by `second-read.mjs templates` instead: it must
  change nothing but the wrapper.
- **Every statement set aside for the running app gets a deeper look.** Most
  were set aside because the code was a stylesheet, a library under
  `node_modules`, a data file or arithmetic nobody followed to the end. What
  the files decide is settled; what a single running copy can show is tried
  on a scratch dev instance (memory `scratch-dev-instance-beside-user-app`,
  never the user's own app); only the rest stays in `live-checks.md`, each
  with exactly what to watch and what it needs.
- **What a note says WORKS is run once against the real thing.** A tool or a
  fallback proven by unit tests fed a made-up result is a claim nobody has
  checked. Run the real function against a scratch instance's own door and
  the real address before the note says so.

Measured on 2026-10-11: of 559 corrections 4 were wrong; of 80 statements set
aside 45 were settled from files, 18 of them wrong; and the read of a guide
page's newest copy, held by 33 unit tests, had failed on every real page and
would have handed an older page over as the newest.

### 4. Leverage: how the agent could help more

Eight lenses, detailed in [references/leverage.md](./references/leverage.md):

| Lens | The question | Main signal |
| --- | --- | --- |
| L1 Blind spots | Which busy code has no note, rule or skill? | `audit --check=coverage` |
| L2 Context cost | What does every session pay for that it rarely uses? | `--check=budget`, `--check=skills` |
| L3 Prose → machinery | Which *must / never / same change* could a test, script or hook hold? | `--check=prose-rules` |
| L4 Friction | Which walls do sessions keep walking into? | `session-friction.mjs` |
| L5 Verification reach | What do the docs say an agent *cannot* check, and what would let it? | reading; `cannot`, `ask the user` |
| L6 Skill routing | Does every kind of request reach exactly one skill, with its triggers in view? | `--check=skills`, the listing |
| L8 The 🤖's corpus | Can the in-app assistant find the fact in a note's first 3 000 characters? | `owa_help_search` on the fact |

Each surviving lead becomes an `AD-xx` proposal with five parts: the measured
signal, the change, its cost in always-loaded bytes, the proof on apply, and
where it routes. The preferred change runs **test > script > lint > hook >
note**. The repo already turns prose rules into tests: `tranKeyCoverage.test.ts`,
`lintGateScripts.test.ts`, `questions.test.mjs`, and
`audit-mcp-tools.mjs --ratchet`.

### 5. Report, then STOP

Save `test-results/owa-enhance-agent-docs/report-<YYYYMMDD-HHMM>.md`, which is
gitignored and is what lets `apply` survive a cleared conversation. Show it,
then ask.

```markdown
# OWA Agent Docs — <auto | audit | …> — <YYYY-MM-DD HH:MM> (run `<runid>`)

- Code: HEAD `<sha>` · <n> dirty paths (<whose>) · app: <dev pid | none>
- Scan: <n> docs · <n> leads → <n> confirmed (<fixed> fixed · <asked> to ask · <reg> regressions · <hist> history)
- Manual: <n> recipes read · <n> edited · <n> stamped · <n> steps need a live look (routed)
- Audit after the fixes: <every drift check 0 | what is left, and where each lead is filed>
- Knowledge rebuild: done | not run (<why>)

## 1. Drift fixed            — doc:line · was → now · the evidence (commit, file)
## 2. Drift needing a decision — the same, plus the choice
## 3. Regressions routed      — the note's decision · what the code does now · where filed
## 4. Leverage proposals      — AD-xx · lens · signal (number) · change · bytes added · proof · route
## 5. Leads killed            — one line each, so the next run does not redo them
```

```text
Docs fixed: <n>. Nothing else changed. Reply with:
  apply AD-03 AD-05   implement those (or: apply all)
  file                record every finding in the backlog
  revert <doc>        undo one of this run's doc fixes
  drop                discard the report
```

With a question tool, offer the top proposals as a multi-select (four at
most). **Then end the turn.**

### 6. Apply AD-xx

1. **Re-ground.** Run `git status` and re-check each proposal's signal as the
   tree is NOW.
2. **Route.** An MCP tool goes to `owa-enhance-mcp`, chatbot behaviour to
   `owa-enhance-chatbot`, a test to `owa-upgrade-unit-test`, app code to
   `owa-enhance`. Follow that skill's procedure and its proof.
3. **A hook needs its own yes.** A hook in the tracked project `settings.json`
   runs in every session of everyone on the repo. Propose its exact JSON, and
   prefer a test or a script that the gate runs.
4. **Prove it.** Show the signal gone: the audit line at 0, a test that fails
   on the old state and passes on the new one, the always-loaded byte count
   before → after. A friction signature cannot be re-measured in one session,
   so its proof is the mechanism that prevents it.
5. **Gate.** Run `npm run lint` when anything outside `.claude/` changed, and
   read the log body, not the exit code. Re-run the audit last in every case.
6. **Paper trail.** Mark the backlog item `done` with before → after. Keep
   CLAUDE.md's skill index and `rules/project-skills.md` in step when a skill
   changes. Rebuild the knowledge (Non-negotiable 4).
7. **No commit, push or stage** unless the user asks.

## Ranking

**S1**: a doc that leads an agent into damage. Examples: a command named safe
that deletes (`npm run build` beside a running app), a wrong safety claim about
the firewall or the interlock, or a step that touches a live screen or user
data. **S2**: wrong in always-loaded context (`CLAUDE.md`, the head of
`MEMORY.md`) or in a rule for a hot area, or a named guard that does not exist.
**S3**: wrong in an on-demand note or a skill reference, a missing pointer, or
context waste of ≥ 1 000 tokens a session. **S4**: wording, or a dead anchor in
near-history. Rank leverage by *sessions affected × minutes saved*, measured
from `session-friction.mjs` wherever it can be.

## What counts

- A doc line that was false and is now true, with the commit that proves it.
- A rule that a reader had to remember and the gate now enforces.
- Bytes every session stops paying for, with nothing lost.
- A wall several sessions hit that the next one will not.

What does not count: rewording a true note, "updating" history, a note that
restates the code, or a lead nobody confirmed.

## Resources

- [scripts/audit-agent-docs.mjs](./scripts/audit-agent-docs.mjs): 15 checks
  over the docs. The drift checks are `paths`, `symbols`, `tools`, `scripts`,
  `env`, `ids`, `memory`, `rules`, `skills`, `knowledge` and
  `manual` (the recipes and the coverage rows they are verified by). The
  leverage signals are `budget`, `coverage` and `prose-rules`; `staleness`
  is the notes due a read. `--stamp-manual=<ids | all>` and
  `--stamp-notes=<paths | @list>` are its only writes: the review ledgers;
  either is refused against uncommitted code unless `--allow-dirty` says the
  changes are the stamper's own.
- [scripts/apply-manual-edits.mjs](./scripts/apply-manual-edits.mjs): checks
  proposed manual or matrix edits (each `old` once, no overlap, every proof in
  the code), then writes them. [scripts/find-label.mjs](./scripts/find-label.mjs):
  is this word a `tran()` key, and where is it drawn.
- [references/live-checks.md](./references/live-checks.md): the statements
  only the running app can settle, by document; a line leaves when a run
  observes it.
- [references/second-read.md](./references/second-read.md) and
  [scripts/second-read.mjs](./scripts/second-read.mjs): §3c — what a second
  reader is handed and told, and the checker of what it answers.
- [references/manual-reviewed.json](./references/manual-reviewed.json) and
  [references/notes-reviewed.json](./references/notes-reviewed.json): which
  recipes and which notes were read against the code, and against what.
- [scripts/session-friction.mjs](./scripts/session-friction.mjs): repeated
  errors by masked signature and session count, rejected calls, interrupts,
  hot reads and hot commands, from the local Claude Code transcripts.
- [references/checks.md](./references/checks.md): per check, its false
  positives, how to confirm, how to fix, and the reading checks no script does.
- [references/leverage.md](./references/leverage.md): the seven lenses, with
  their signals, the shape of a proposal and the proof.
- [references/backlog.md](./references/backlog.md): `AD-xx`. Written only after
  the user decides.
- `owa-enhance` (`docs` area: the manual and knowledge freshness),
  `/owa-robot-test` (recipes, live), `owa-enhance-chatbot`, `owa-enhance-mcp`,
  `owa-upgrade-unit-test`.
