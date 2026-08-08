---
name: review-unstagged-change
description: 'Exhaustively review ONLY what is NOT staged in git — the unstaged worktree delta (`git diff`) plus untracked non-ignored files — and report every room to improve. Use when asked to "review my unstaged changes", "review my work in progress", "review what I haven''t added yet", "review before I stage", or to sanity-check in-flight edits. The reviewed state is the file ON DISK; for a partially-staged file the INDEX version is the baseline (`git show :path`), so the unstaged hunk is judged against what is already staged rather than against HEAD. Anything already staged, committed, or gitignored is deliberately out of scope. Sweeps performance/memory (this app targets very low-spec machines, so it outranks elegance), correctness, reuse & duplication, simplification, project conventions (Comp naming, useAppCurrentRef, debounced event hooks, tran() keys that THROW on a missing Khmer string), tests, security/IPC, docs/memory drift, and — specific to in-flight work — WIP debris such as stray console.log, commented-out code, `.only`/`.skip` tests, debug scaffolding and TODOs that must not reach a commit. Each candidate finding is adversarially verified against the full file before it is reported; findings come back ranked by severity with file:line links, a concrete failure scenario, and a suggested fix. Pass "fix" to apply the accepted ones, or "no-untracked" to restrict the review to tracked files only. Never stages, commits, or stashes anything.'
argument-hint: '[optional: path/glob to narrow the review, "no-untracked" to skip untracked files, "perf"/"correctness"/"conventions" to weight a dimension, or "fix" to apply findings]'
---

# Review unstaged change

Review **only the unstaged work** and find every legitimate room to improve.

> Scope rule, non-negotiable: the deliverable is a review of `git diff` (worktree vs
> index) plus untracked non-ignored files. Staged hunks, previous commits, and ignored
> files are **out of scope** — context you may read, never things you report.
>
> Never run `git add`, `git commit`, `git stash`, `git checkout --`, or `git restore`.
> Unstaged work is the user's only copy; there is no reflog to recover it from.

## 0. Establish the scope

```sh
git status --porcelain            # col 1 = index, col 2 = worktree, ?? = untracked
git diff --stat                   # size of the tracked unstaged delta
git diff --name-status            # M/D per tracked file
git ls-files --others --exclude-standard   # untracked, gitignore respected
```

Read column 2 of `git status --porcelain`:

- ` M` — modified, nothing staged. HEAD is the baseline.
- `MM` / `AM` — **partially staged**. The unstaged hunk is a delta *on top of the
  index*, not on top of HEAD. Reviewing that hunk against HEAD produces nonsense.
  Baseline is `git show :<path>`; reviewed state is the file on disk.
- `??` — untracked. **In scope by default** — brand-new files are usually the bulk of
  in-flight work, and a review that skipped them would miss almost everything. Say
  explicitly in the report that they were included. Skip them if the argument contains
  `no-untracked`.
- ` D` — deleted in the worktree but not staged. Confirm nothing still imports it, and
  check whether the deletion is intentional or an accident.

If nothing is unstaged and nothing is untracked, say so and stop. Do **not** fall back
to reviewing the staged diff — `/review-stagged-change` covers that; point the user
there instead.

Then pull the diff, with function context and rename detection:

```sh
git diff -M -C --find-renames --function-context
```

Untracked files have no diff — read them whole.

For a large set (>40 files), do not dump everything into context at once. Group by
subsystem (`src/_screen`, `src/presenting-flow`, `electron/`, tests, docs) and work group by
group, keeping a running findings list. Report the grouping so coverage is auditable.

## 1. Read enough to be right

The reviewed state is the **file on disk**, so the ordinary Read tool sees exactly the
right content and `file:line` links resolve directly. But a hunk in isolation produces
confident, wrong findings:

1. Read the **whole file**, not just the hunk — the "missing" guard is often three lines
   above the diff window.
2. For a partially-staged file, diff the on-disk version against `git show :<path>` so
   you know which lines are actually unstaged. Do not report a staged line.
3. Grep for the changed symbol's other call sites. A signature change, a new optional
   arg, or a changed return shape is only reviewable against its callers.
4. Check whether an existing helper already does the new thing — this repo has many
   `*Helpers.ts` modules, and duplication is the most common real finding.

## 2. Dimensions

Sweep all of them. Weight by the argument if one was given, but never drop a dimension —
the ask is to find *all* rooms to improve.

Dimensions 1–8 and their concrete repo traps live in the shared checklist:
**[../review-stagged-change/references/checklist.md](../review-stagged-change/references/checklist.md)**
(one copy, shared by both review skills — read it, don't re-derive it).

1. **Performance & memory — top priority here** (checklist §1): eager loading, unbounded
   or sliding-TTL caches, whole-file reads for a slice, per-row work inside
   frequently-firing screen/file events, missing `genTimeoutAttempt(500)` debounces and
   the per-instance-vs-module-global timer bug, parse amplification in hot getters.
2. **Correctness** (checklist §2): microtask-async event dispatch with no dedup, state
   read across an `await`, shared object identity, swallowed rejections, ID lookups that
   search the wrong collection.
3. **Reuse & duplication.**
4. **Simplification & altitude.**
5. **Project conventions** (checklist §3): `Comp` suffix, `useAppCurrentRef` (and the
   ~63 sites deliberately NOT converted — do not "finish" them), `tran()` keys that
   **throw and blank the page** when a Khmer string is missing.
6. **Tests** (checklist §4): including the dead `debuggerHelpers` mock path and
   `appProvider`'s module-scope `document`.
7. **Security & IPC** (checklist §5).
8. **Docs & memory drift** (checklist §6).

### 9. WIP debris — specific to unstaged work

Unstaged code is in-flight, so it carries scaffolding that must not survive into a
commit. This dimension does not apply to a staged review; it is the main reason this
skill exists separately.

- Stray `console.log` / `console.debug` / `debugger` statements.
- Commented-out code left "just in case", and orphaned imports it leaves behind.
- `it.only` / `describe.only` / `.skip` / `xit` — `.only` silently shrinks the suite to
  one test and everything still reports green.
- Hardcoded local paths, personal machine paths, temporary credentials, a port or URL
  swapped to a local one for testing.
- A guard or feature flag flipped for local testing and not flipped back; a timeout or
  interval shortened to make a manual test faster.
- Mock or fixture data wired into a real code path.
- `TODO` / `FIXME` / `XXX` added by this change — list them so the user decides
  consciously, rather than discovering them in review later.
- Half-finished work: a function added but never called, an added branch that is
  unreachable, a new file nothing imports yet. Ask whether it is intentionally pending
  rather than assuming it is dead code.

## 3. Verify before reporting

Every candidate must survive this:

- **Re-read the surrounding code and try to refute it.** Assume the author was right.
  Most first-pass findings die here.
- **Write the failure scenario:** concrete inputs or state → wrong output, crash, or
  cost. No scenario → not a finding; drop it or demote it to a Nit.
- **Confirm the line is actually unstaged.** For `MM` files this is the single easiest
  mistake to make.
- **Prefer running the check over asserting it** — `npx tsc --noEmit`,
  `npx vitest run <file>`, `npm run lint:es` on the touched files. Note which findings
  were machine-verified.
- **Allow for in-flight-ness.** Unstaged code is not claiming to be finished. An
  incomplete-but-obviously-in-progress path is a question, not a High finding. Reserve
  severity for things that would be wrong once committed as-is.

Do not pad. Breadth belongs in the **search**, not in the **claims**.

## 4. Report

Order strictly by severity, highest first.

- **High** — breaks correctness, loses data, blanks the page, or measurably hurts
  performance on low-spec hardware.
- **Medium** — real bug in an edge case, meaningful memory/IO waste, missing test for
  new behavior, a convention violation with runtime consequences.
- **Low** — duplication, simplification, naming, readability.
- **Nit** — style/preference, explicitly optional.

Per finding:

```
[High] Short claim — src/path/File.ts:120
Why it's wrong: <one or two sentences>
Failure scenario: <inputs/state → outcome>
Fix: <the concrete change, with a snippet when it is short>
```

Use clickable markdown links: `[File.ts:120](src/path/File.ts#L120)`.

Close with:

- **WIP debris list** — everything from §9, as a short checklist the user can clear
  before staging. Keep it separate from the severity-ranked findings; it is cleanup, not
  defects.
- **Coverage** — files/groups reviewed, untracked files included or skipped, anything
  deliberately skipped and why.
- **Partially-staged note** — which files had staged content underneath, and confirmation
  that only unstaged lines were judged.
- **Verdict** — one line: ready to stage / clear the High items first.

If there are genuinely no findings, say so plainly and list what you checked.

## 5. `fix` argument

Only when the argument contains `fix`: after reporting, apply the **High and Medium**
findings plus the clearly-safe WIP debris removals (stray `console.log`, `.only`).
Leave Low/Nit unless trivial, and note what you touched.

- Never remove a `TODO`, a commented-out block, or an unused new file without asking —
  those may be deliberate placeholders in in-flight work.
- Re-run the relevant tests / `npx tsc --noEmit` afterwards.
- The fixes land in the working tree and stay **unstaged**. The user decides what to
  `git add`. Never stage, commit, or stash.

Without the argument, do not edit any file.
