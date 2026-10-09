---
name: owa-enhance-agent-docs
description: Audit and improve the Open Worship App agent documents (CLAUDE.md, rules, memory, skills, the Codex mirror) against the code, and propose ways agents could help more across the repo. Use for doc-vs-code drift, stale notes, mirror drift, context cost and agent tooling gaps. Fix confirmed drift in the docs; report leverage proposals and apply them only when the user requests.
---

## Codex usage

Invoke as `$owa-enhance-agent-docs` followed by the request or options.
Use the Codex tools available in this session for shell, search, browsing and delegation; Claude-specific tool names in the source are workflow examples.
Read the repository `AGENTS.md` for source-of-truth and mirror maintenance rules.

Arguments: [auto (default) | audit | drift | leverage | friction | <doc or code path> | apply AD-xx … | file]

### Full workflow scope (preserved from Claude)

Keep the Open Worship App agent documents true to the code, and make agents more useful across the whole repo. Use when asked to audit, fix, refresh or slim the agent docs: `.claude/CLAUDE.md`, `.claude/rules/`, `.claude/memory/` + MEMORY.md, `.claude/skills/`, the Codex mirror (`AGENTS.md`, `.codex/`, `.agents/skills/`), `.mcp.json`. Also use for stale notes, doc-vs-code mismatches, mirror drift, and questions like "what should the agent know" or "how can the agent help more". Two jobs. DRIFT: scripts/audit-agent-docs.mjs lists every claim the code contradicts; each lead is confirmed against code and git history, then the doc is fixed in place, with the mirror re-copied and the knowledge rebuilt. LEVERAGE: blind spots, context cost, prose rules a test or hook could enforce, and repeated session friction (scripts/session-friction.mjs) become AD-xx proposals, reported and applied only on `apply`. Code is the truth for facts; a doc is the truth for decisions; history stays history.

# OWA Enhance Agent Docs — the notes match the code, and the agent gets better at this repo

The agent documents are how every agent learns this project. That covers every
Claude Code session, every Codex session through the mirror, and the in-app 🤖.
The chatbot answers volunteers from `.claude/` as its internal corpus, which
ships in plaintext inside the installer. A wrong line here misleads all three,
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
3. **A drift fix edits documents only.** That means agent docs and their
   mirror. Code, tests, settings, hooks, user data and the app's screens wait
   for `apply`.
4. **Paper trail in the SAME change.** Copy the Codex mirror again from
   `.claude/`; never reconcile it by hand. Then run
   `node extra-work/build-knowledge.mjs`, with one condition: under
   `npm run electron:dev` the rebuild relaunches the dev app. When a dev app is
   up and another session may be driving it, defer the rebuild and say so in
   the report. Change `tools/owa-devtools-mcp/questions/*.json` only when
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
   it whole. If a file in mirror drift has someone else's uncommitted
   `.claude/` edit, report it and leave it: they copy it when they finish.

## Invocation

| Argument | What happens |
| --- | --- |
| *(none)* or `auto` | Scan → confirm → fix the safe drift → leverage report → stop and ask |
| `audit` | Read-only: scan and confirm, then report the drift fixes it WOULD make. No edits |
| `drift` | Job 1 only: confirmed safe drift fixed, the rest reported |
| `leverage` | Job 2 only: proposals reported, then stop |
| `friction` | Lens L4 alone: what the local session transcripts say agents trip on |
| a doc (`.claude/rules/agent-tools.md`) | Every claim in that doc, scripted and by hand |
| a code path (`src/_screen`) | Every doc that names it, plus the blind-spot lens for that area |
| `apply AD-xx AD-yy` · `apply all` | §6, for exactly those proposals |
| `file` | Record the report's findings in [the backlog](./references/backlog.md) |

**Routed, not done here.** A user-facing recipe against the live app goes to
`/owa-robot-test`. It owns `user-workflows.md` and never publishes an
unobserved step. Chatbot answer quality goes to `owa-enhance-chatbot`, an MCP
tool's behaviour or cost to `owa-enhance-mcp`, and tests to
`owa-upgrade-unit-test`. App code, and a regression found through a note, go
to `owa-enhance`. This skill files the lead and names where it went.

## The agent-document surface

| Document | Read by | Loaded | Notes |
| --- | --- | --- | --- |
| `.claude/CLAUDE.md` | every Claude session; Codex (`.codex/project-instructions.md`); 🤖 corpus | **always** | the costliest bytes in the repo |
| `.claude/memory/MEMORY.md` | every Claude session | **always** (first 200 lines) | one line per note, a hook not a summary |
| `.claude/memory/*.md` | on demand from the index | when relevant | front matter `name` · `description` · `metadata.type` |
| `.claude/rules/*.md` | Claude once a file matching `paths:` is read; Codex by `AGENTS.md`'s instruction | conditional | a glob that matches nothing means a rule that never loads |
| `.claude/skills/*/SKILL.md` | description: every session's skill listing; body: on invoke | listing always | the listing cuts a description at ~1 530 characters |
| skill `references/`, `scripts/` | when the skill says | on demand | ledgers are history |
| `AGENTS.md`, `.codex/**`, `.agents/skills/**` | Codex | — | exact copies, except each mirrored `SKILL.md`'s Codex preamble |
| `.mcp.json` · `.codex/config.toml` | both agents' MCP registration | — | must name the same servers |
| `tools/owa-devtools-mcp/README.md` | humans and agents choosing a tool | — | the tool table |
| `electron-build/knowledge/` | the in-app 🤖 | built | internal notes indexed to their first 3 000 characters |
| `.claude/settings.local.json` | this machine's Claude Code | — | personal and untracked: read it, never edit it unasked |

## Procedure

### 0. Ground the run

1. `git rev-parse --short HEAD`, `git status --porcelain`, `git log --oneline
   -10`. Record the dirty docs and whose they look like.
2. Is an app published? Check `<temp>/open-worship-app-cdp/*.json` and whether
   `electron:dev` / `nodemon` is running. You need an app only to confirm
   runtime claims live. Knowing whether one runs also tells you whether the
   knowledge rebuild is safe now.
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
`--with-ledgers` and `--json`. `session-friction.mjs` takes `--sessions=N`,
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
  `CLAUDE.md`, because a wrong line there costs every session. Also read the
  ten notes the `staleness` check ranks highest, and each rule whose `paths:`
  area changed most. For each, check its most concrete claims (a name, a
  number, a behaviour, a command) against the code.
- **Runtime claims** (what a tool returns, what a window shows) get
  `owa-enhance`'s research contract. Use read-only calls only: `owa_app_state`,
  `owa_find_ui`, `owa_list_ui`, `take_snapshot`, `owa_screenshot`. Nothing
  that presents, hides a screen or changes a document.

Then classify each survivor:

- **fix**: one of the safe classes below
- **ask**: a judgement call
- **regression**: the code broke a recorded decision, so route it
- **history**: leave it

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
- **Mirror drift**: copy again from `.claude/`. If the mirror side is newer,
  port that edit into `.claude/` first, then copy. Ask when the two sides
  disagree in substance.

Ask before:

- deleting or merging notes or sections, or moving text between `CLAUDE.md`
  and a rule
- changing a *never*, *always* or *deliberately* rule
- touching another skill's ledger, or `user-workflows.md`
- a **guard that is gone**: a note says *"pinned by `<name>.test.ts`"* and the
  test is deleted. Mark the guard as gone, then propose rebuilding it through
  `owa-upgrade-unit-test`.
- another skill's `description`, because it changes when that skill fires

Edit in the doc's own voice. Use minimal Edits and leave unchanged paragraphs
alone, since nothing formats `.claude/` and a small diff stays reviewable. Write
dates as absolute dates, and keep the *why*.

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
| L7 Codex parity | Does a Codex session get the same project? | `--check=mirror`, `AGENTS.md` |
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
- Knowledge rebuild: done | DEFERRED (<why>) · mirror: in sync | <n> left (<why>)

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
   changes. Copy the mirror and rebuild the knowledge (Non-negotiable 4).
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
  `env`, `ids`, `memory`, `rules`, `skills`, `mirror` and `knowledge`. The
  leverage signals are `budget`, `coverage`, `staleness` and `prose-rules`.
- [scripts/session-friction.mjs](./scripts/session-friction.mjs): repeated
  errors by masked signature and session count, rejected calls, interrupts,
  hot reads and hot commands, from the local Claude Code transcripts.
- [references/checks.md](./references/checks.md): per check, its false
  positives, how to confirm, how to fix, and the reading checks no script does.
- [references/leverage.md](./references/leverage.md): the eight lenses, with
  their signals, the shape of a proposal and the proof.
- [references/backlog.md](./references/backlog.md): `AD-xx`. Written only after
  the user decides.
- `owa-enhance` (`docs` area: the manual and knowledge freshness),
  `/owa-robot-test` (recipes, live), `owa-enhance-chatbot`, `owa-enhance-mcp`,
  `owa-upgrade-unit-test`.
