---
name: owa-enhance
description: 'Research-first improvement of the WHOLE Open Worship App — find what is most worth improving, prove it with evidence from the code and the RUNNING app, report a ranked plan, and change NOTHING until the user says which items to apply. Use when asked to enhance / improve / audit / harden / speed up / clean up the app as a whole, to "find what to improve" or "what should I fix next", or to work on an app-wide area with no dedicated skill: security (IPC handlers, node-integrated renderers, HTML sinks, archives, downloads, external content, dependencies), performance (memory, startup, bundle, per-event work on low-spec church machines), reliability (data loss, cross-window races, crashes, console errors, a projector that blanks), ui (volunteer-facing clarity, accessibility, Khmer, design tokens, empty and error states), dev-flow (install, dev loop, test and typecheck speed, the lint gate, packaging, CI, agent tooling), code-health (import cycles, oversized modules, duplication, dead mocks, test gaps, outdated dependencies) and docs (the manual against the live app, memory and CLAUDE.md drift, the .github mirror, knowledge freshness). With no argument, or `auto`, it TRIAGES every area with cheap read-only signals — scripts/triage.mjs for static leads, scripts/app-vitals.mjs for what the running app costs per process and per page — and researches the area holding the strongest evidenced problem; `full` researches all of them. THE RULE THAT BINDS EVERY RUN: research is read-only — no source edit, format, stage, commit, setting, user data, screen or API credit; its one write is a gitignored report under test-results/owa-enhance/ — and the run ENDS with that report (proposed EN-xx ids, severity, confidence, effort, failure scenario, proposed change, the proof each will be judged by) and a question. Only an explicit `apply` starts changes, which are then verified LIVE, gated by npm run lint last and landed with their paper trail. The AI subsystems keep their own skills (the 🤖 assistant is owa-enhance-chatbot, tools/owa-devtools-mcp is owa-enhance-mcp, the ✨ AI Chat window is owa-enhance-aichat) and /owa-robot-test runs are read as evidence.'
argument-hint: '[auto (default) | security | performance | reliability | ui | dev-flow | code-health | docs | full | area,area | apply EN-xx … | file | deeper EN-xx | a plain description of what feels wrong]'
---

# OWA Enhance — find the improvement worth the most, prove it, then ask

The app-wide sibling of the three `owa-enhance-*` skills. Each of those owns one
subsystem and changes it; this one looks across **the whole app**, finds where
an improvement is worth the most, and hands the decision back before a single
file moves. Asked for on 2026-09-14 in so many words: *research (planning
without file update), then report and wait to apply* — and find the best area
to improve by itself.

```text
RESEARCH (read-only)  →  REPORT  →  ⏸ the user decides  →  APPLY (exactly what was approved)
```

**The pause is the product.** A report is cheap to throw away and a change is
not: this app drives a projector in front of a congregation from somebody's
old laptop, so a confident guess applied to it costs more than the hour of
research that finds the real problem. A run earns the right to change something
by showing — with a number or a failure scenario — that it is worth changing.
Then the user says which.

## Non-negotiables

1. **Research writes nothing but its report.** No edit, format, stage, commit,
   setting, user data, screen or API credit until the user says `apply` — the
   exact line is *The research contract* below.
2. **The run stops at the report** and ends the turn with a question. Silence
   is not approval, and approving one finding approves nothing next to it.
3. **No evidence, no finding.** A finding carries a measurement or a traced
   failure scenario from THIS app. A pattern match is a lead, reported as one.
4. **The app's own rules outrank a finding's convenience** (CLAUDE.md):
   performance before elegance, nothing that changes a congregation's screen
   done unasked, a missing Khmer key throws, verify live first and gate last.
5. **The AI subsystems keep their skills.** Work in `src/chatbot/`,
   `tools/owa-devtools-mcp/` or the AI Chat window is researched and applied
   the way `owa-enhance-chatbot`, `owa-enhance-mcp` or `owa-enhance-aichat`
   says, and filed in that skill's backlog.
6. **Everything markdown under `.claude/skills/` ships** in plaintext in the
   installer's knowledge bundle: no secrets, nobody's own data (memory
   `no-user-specific-references-in-notes`), no working exploit for a hole that
   is still open.

## Invocation

| Argument | What happens |
| --- | --- |
| *(none)* or `auto` | Triage every area, research the one holding the strongest evidenced problem, report, stop |
| `<area>` | Research that area, report, stop |
| `<area>,<area>` | Research each; one report, ranked across them |
| `full` | Triage and research every area — the expensive run; fan out when subagents exist |
| a plain description (*"startup feels slow"*) | Map it to its area(s) and research those |
| `apply EN-12 EN-15` · `apply all` | §4, for exactly those findings |
| `file` · `file EN-13` | Record findings in [the backlog](./references/backlog.md), change no code |
| `deeper EN-14` | More research on one finding — still read-only |

| Area | Also answers to | What it protects |
| --- | --- | --- |
| `security` | `sec`, `harden` | the operator's machine, network, files and credentials from content that came from outside |
| `performance` | `perf`, `memory`, `speed`, `startup` | a volunteer on a low-spec machine — CLAUDE.md's top-priority requirement |
| `reliability` | `bugs`, `correctness`, `data`, `crash` | the service in progress and the user's files |
| `ui` | `ux`, `a11y`, `i18n`, `khmer`, `design` | a hurried, non-technical volunteer, often reading Khmer |
| `dev-flow` | `dx`, `tooling`, `ci`, `build`, `release` | the maintainer's hour and every agent session |
| `code-health` | `health`, `architecture`, `refactor`, `deps`, `tests` | the next change |
| `docs` | `manual`, `notes`, `mirror` | a volunteer reading the manual or asking the 🤖, and every later session |

Each area's scope, leads, probes, already-known list and proof on apply:
**[references/areas.md](./references/areas.md).**

**Routed, not researched here:** `chatbot` / `assistant` → `owa-enhance-chatbot`
with its `research` argument, which is this skill's pause for that subsystem;
`mcp` / `tools` → `owa-enhance-mcp`; `aichat` → `owa-enhance-aichat`. Those two
have no research-only mode, so take their baseline and their areas and keep
this skill's rule: report, then stop. A QA walk is `/owa-robot-test`; a diff
review is `review-stagged-change` / `review-unstagged-change`.

## The research contract

Research **reads**. Anything that changes something waits for the user.

| Allowed while researching | Waits for `apply` or an explicit OK |
| --- | --- |
| Read any file; `git log` / `diff` / `show` / `blame` / `status` | Edit, create, delete, `prettier --write`, `eslint --fix`, `git add` / `stash` / `checkout` / `commit` |
| `scripts/triage.mjs`, `scripts/app-vitals.mjs` | `npm run format` — `prettier --write` over `src` and `electron` |
| `npm run lint` and any of its stages (check-only since `EN-16`: its build goes to a temp dir), `npx prettier --check …`, one `npx vitest run <file>` | `npm run build` / `electron:build` / `test:e2e` — deletes `electron-build/`, which kills the running app |
| A bundle into the OS temp dir: `npx vite build --outDir <tmp> --emptyOutDir` | `npm run docs:gen`, `node extra-work/build-knowledge.mjs`, `npm run dc:err` — each writes tracked or bundled files |
| `npm audit`, `npm outdated`, `npm view`, web search for advisories | `npm i`, or `npx` of anything not already in `node_modules` |
| Read-only app tools: `owa_app_state`, `owa_list_ui`, `owa_find_ui`, `owa_list_screens`, `list_pages`, `take_snapshot`, `take_screenshot`, `list_console_messages`, `list_network_requests` | Presenting; showing, hiding or clearing a screen; any press that changes a document, a setting or a list; the data tools (`owa_*_file`, `owa_bible_*`, `owa_undo`) |
| `performance_start_trace` **with `reload: false`**; `lighthouse_audit` **with `mode: "snapshot"`** | Either tool's defaults — both RELOAD the window they are aimed at |
| `emulate` CPU throttling on a window that is not presenting, reset to 1 in the same step | Spending API credit — a chatbot corpus run, `verify-chatbot-e2e.mjs` |
| Opening a panel, hovering, switching a tab — and putting it back | Starting a second app while one is published, or stopping anyone's |
| The report in `test-results/owa-enhance/` (gitignored); scratch output in the OS temp dir | Any other write |

When proving a finding needs a write — a failing test that shows the bug, a
scratch document holding a harmless payload — the write is **proposed** as the
fix's first step, not done. When something cannot be measured inside the
contract, the report says what and why; the contract is not bent to fill the
gap.

## Procedure

### 0. Ground the run

1. **The code under test.** `git rev-parse --short HEAD`, `git status
   --porcelain`, `git log --oneline -15`. Research reads the working tree, so a
   dirty tree is recorded in the report. Changes you did not make mean another
   session may be mid-work — which matters at apply time (§4.6), not now.
2. **The app.** `node .claude/skills/owa-enhance/scripts/app-vitals.mjs` names
   the instance it measured — dev or packaged, version, pid. Discovery takes the
   NEWEST published instance (`MC-30`), so check it is the one you meant, or
   pass `--port=`. With no app up and an area that needs one, start it only when
   nothing is published: `env -u ELECTRON_RUN_AS_NODE npm run dev`.
3. **What is already known**, so it is not found twice: [the
   backlog](./references/backlog.md); the open items of the chatbot, MCP and AI
   Chat skills (`triage.mjs` lists them); `.claude/memory/MEMORY.md`, whose
   *FIXED* notes and recorded decisions end most findings before they start; the
   newest `/owa-robot-test` report under `test-results/robot-test/`; the newest
   report under `test-results/owa-enhance/`.

### 1. Triage — `auto` and `full`

```bash
node .claude/skills/owa-enhance/scripts/triage.mjs       # static leads per area; no app, no network
node .claude/skills/owa-enhance/scripts/app-vitals.mjs   # what the running app costs, per process and page
```

A signal is a **lead**, never a finding: a count of HTML sinks says where to
read, not that one is exploitable. For every area take its strongest one or
two leads (the area's playbook says which signals matter there) plus its
known-open items, and spend about ten minutes confirming or killing each —
read the code path, make one live check. Grade what survives with the rubric in
[references/report.md](./references/report.md).

**Research the area whose best surviving finding ranks highest.** Ties go to
`performance` (CLAUDE.md's top-priority requirement), then to the area with
the most churn in the last 30 days, which is where regressions land. A
Critical found in ANY area goes in the report whatever area wins — it is never
left behind for not being the area of the day.

### 2. Research the chosen area(s)

Work the area's playbook in [references/areas.md](./references/areas.md).
Four tracks, the first two always:

- **A · Measure.** A number from the running app or the toolchain — megabytes,
  milliseconds, a count, a duration. It is the one kind of claim a reviewer can
  check, and the apply phase is judged against it.
- **B · Trace.** Read the code path end to end and write the failure scenario:
  *who, doing what, on what machine → what goes wrong*. No scenario, no finding.
- **C · Reproduce** live when the path is live: the console line verbatim, a
  screenshot, a heap that grew and stayed grown.
- **D · Look outside** when the problem is a known class — an Electron
  advisory, a library's known leak — and bring back the specific fix.

**Then try to kill every candidate.** Re-read the surrounding code (the guard
three lines up); `git log -S` and `git blame` for a deliberate decision; the
memory notes and CLAUDE.md for a *do not "fix" this* — the ~63 `useCallback`
sites deliberately left unconverted, the English-only chatbot window, the
auto-hide the chatbot deliberately lost. Most first-pass findings die here, and
the ones that survive have earned the user's attention.

**Fan out** for `full`, or for several areas, when subagents are available: one
read-only researcher per area, handed this contract verbatim and that area's
playbook, returning findings in the report's shape. A subagent's finding is a
lead until this run has re-verified it.

**Timebox:** ~10 minutes of triage per area, ~30–45 minutes of research per
area. Stop early once a Critical is proven — report it rather than bury it
under a longer sweep.

### 3. Report — then STOP

Write the report as [references/report.md](./references/report.md) lays it
out, save it as `test-results/owa-enhance/report-<YYYYMMDD-HHMM>.md` —
gitignored, and the reason `apply` still works after the conversation is
cleared — show it, and ask:

```text
Nothing has been changed. Reply with:
  apply EN-12 EN-15   implement those (or: apply all)
  file                record every finding in the backlog, change no code
  deeper EN-14        research that one further first (still read-only)
  drop                discard the report
```

With a question tool, offer the top findings as a multi-select (four at most)
and let free text carry the rest. **Then end the turn** — not "while you
decide, I will start on the obvious one".

### 4. Apply — exactly what was approved

1. **Re-ground.** `git status`, then re-check each approved finding against
   the tree as it is NOW: the `file:line`, the number, the reproduction. One
   that no longer holds is reported back, not fixed. After a cleared
   conversation, read the newest saved report first.
2. **Route.** A finding owned by a sub-skill follows that skill's procedure —
   its probes, its proof, its paper trail.
3. **Test first** where the logic can be tested without the app: a test that
   fails before the change and passes after it.
4. **Implement** under CLAUDE.md: performance first; `Comp` names; a
   per-instance `genTimeoutAttempt(500)` on a multi-instance event hook; every
   new label a `tran()` key with its Khmer string; no app-module `import()` from
   an injected page expression.
5. **Prove it live** with the finding's *Proof on apply*: the report's baseline
   measurement re-taken the same way, a screenshot, the reproduced failure no
   longer happening. A number that did not move means the change did not help,
   however right the code looks.
6. **Gate last.** `npm run lint`, reading the log body rather than the exit
   code — it is `&&`-chained, so the first failure hides every stage after it.
   It only checks (`EN-16`): nothing is reformatted and nothing is built into
   `electron-build/`, so it is safe beside a running app and another session's
   uncommitted work. A `lint:pre` failure means `npm run format` — over your
   own files only when the tree holds someone else's (`MC-29`).
7. **Paper trail, in the same change:** the backlog (`done` with before → after
   and the proof; every finding of the report NOT applied filed `open`); for
   behaviour a user sees, `user-workflows.md` and `coverage-matrix.md` with
   their dates bumped; `tools/owa-devtools-mcp/questions/*.json` when the
   knowledge moved; a memory note for anything the code cannot tell the next
   session; CLAUDE.md for anything structural; the `.github/` mirror; and
   `node extra-work/build-knowledge.mjs` after any `.claude/` edit (under
   `electron:dev` that restarts the dev app).
8. **No commit, push or stage** unless the user asks.

Close with, per finding: what shipped, the number before → after, the proof,
the gate's result — and what was not done, and where it was filed.

## Ranking, in one paragraph

Severity is what happens to the person at the machine. **S1 Critical** — data
lost, a live screen blanked or taken over, code from outside running on the
operator's machine, or the app unusable on the hardware it targets. **S2
High** — a core flow (a song, a verse, a slide, a background, screen control)
broken or measurably slow there, or a security weakness with a plausible path.
**S3 Medium** — friction, waste that is not yet visible, a cost paid on every
change. **S4 Low** — polish. Confidence is **Measured** (a number or a
reproduction, this run) over **Traced** (the path read end to end, the scenario
written); **Suspected** is a lead, never a finding. Effort is S / M / L. Rank
by severity, then confidence, then the smaller effort. *Unusable on a low-spec
machine* ranks with a crash, because to the volunteer at that machine it is
one. The full rubric: [references/report.md](./references/report.md).

## What counts

- A problem proven with a number or a reproduction, in this app, on its target
  hardware.
- A change that moves the number research measured.
- A failure that was silent and now says something true.
- A class of defect made impossible — a guard, a test, a check — rather than
  one instance patched.

Not: a preference presented as a finding; "best practice" with no failure
scenario here; a refactor that moves no behaviour and no cost; something a
memory note records as fixed or decided; a subagent's claim nobody re-checked.

## Resources

- [references/areas.md](./references/areas.md) — the seven playbooks: scope,
  leads, research, already known, proof on apply.
- [references/report.md](./references/report.md) — the report's layout, the
  rubric, the finding template, the decision prompt, how ids are minted.
- [references/backlog.md](./references/backlog.md) — `EN-xx`; written only
  after the user decides.
- [scripts/triage.mjs](./scripts/triage.mjs) — static leads for every area, the
  sub-skills' open items, the newest robot run. No app, no network, no writes.
  `--area=<name>` lists every hit; `--json`.
- [scripts/app-vitals.mjs](./scripts/app-vitals.mjs) — the running app's memory
  per process (the operating system's figures) and per page (JS heap, DOM
  nodes, listeners) over raw CDP. `--gc`, `--port=`, `--json`.
- `owa-enhance-chatbot` · `owa-enhance-mcp` · `owa-enhance-aichat` — the AI
  subsystems. `/owa-robot-test` — QA evidence, and the source of the manual.
  `.claude/skills/review-stagged-change/references/checklist.md` — this repo's concrete
  performance and correctness traps, a ready sweep list for code research.
