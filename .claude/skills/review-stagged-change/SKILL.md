---
name: review-stagged-change
description: 'Exhaustively review ONLY what is currently staged in git (the index — `git diff --cached`), and report every room to improve. Use when asked to "review my staged changes", "review the staged diff", "review what I''m about to commit", "check the index before commit", or to run a pre-commit quality gate. Reviews the INDEX version of each file (`git show :path`), never the working-tree version, so unstaged edits and untracked files are deliberately excluded and partially-staged files are called out. Sweeps eight dimensions in priority order — performance/memory (this app targets very low-spec machines, so it outranks elegance), correctness, reuse & duplication, simplification, project conventions (Comp naming, useAppCurrentRef, debounced event hooks, tran() keys that THROW on a missing Khmer string), tests, security/IPC, and docs/memory drift — then adversarially verifies each candidate finding against the full file before reporting it. Findings come back ranked by severity with file:line links, a concrete failure scenario, and a suggested fix; pass "fix" to apply the accepted ones to the working tree afterwards.'
argument-hint: '[optional: path/glob to narrow the review, "perf"/"correctness"/"conventions" to weight a dimension, or "fix" to apply findings after reporting]'
---

# Review staged change

Review **only the staged (indexed) change** and find every legitimate room to improve.

> Scope rule, non-negotiable: the deliverable is a review of `git diff --cached`.
> Unstaged edits, untracked files, and earlier commits are **out of scope** — they are
> context you may read, never things you report as findings.

## 0. Establish the scope

Run these first. Do not skip — the shape of the staged set decides how the rest of the
run is structured.

```sh
git diff --cached --stat                # size of the review
git diff --cached --name-status         # A/M/D/R per file
git status --porcelain                  # column 1 = index, column 2 = worktree
```

Read `git status --porcelain` carefully:

- `M ` (staged, clean worktree) → straightforward.
- `MM` / `AM` → **partially staged**. The worktree file on disk is NOT what is being
  committed. Every read of such a file must go through the index:
  `git show :<path>` (and `git show :1:<path>` etc. for conflict stages). Report the
  split explicitly in the summary — a reviewer who reads the on-disk file reviews code
  that is not being committed.
- Nothing staged → say so and stop. Do not silently fall back to reviewing the worktree
  or the last commit; ask whether that is what the user wanted.

Then pull the actual diff. Prefer function context and rename detection:

```sh
git diff --cached -M -C --find-renames --function-context
```

For a large set (>40 files), do **not** dump the whole diff into context at once. Group
the files by subsystem (`src/_screen`, `src/presenting-flow`, `electron/`, `.claude/`, tests,
docs) and work group by group, keeping a running findings list. Report the grouping you
used so coverage is auditable.

## 1. Read enough to be right

A hunk in isolation produces confident, wrong findings. For every non-trivial changed
file:

1. Read the **whole indexed file** (`git show :<path>`), not just the hunk, so you see
   the surrounding invariants, existing helpers, and whether the "missing" guard is
   three lines above the diff window.
2. Grep for the changed symbol's other call sites — a signature change, a new optional
   arg, or a changed return shape is only reviewable against its callers.
3. Check whether an existing helper already does the new thing (this repo has a lot of
   `*Helpers.ts` modules — duplication is the most common real finding here).

Deleted files: confirm nothing still imports them. Renames: confirm the diff is a pure
move before treating body changes as new code.

## 2. The eight dimensions

Sweep all of them. Weight by the argument if one was given, but never drop a dimension
entirely — the ask is to find *all* rooms to improve.

**Priority order matters: 1 and 2 outrank the rest.**

1. **Performance & memory — top priority in this repo.** The app must run on old,
   weak church/volunteer hardware. See
   [references/checklist.md](./references/checklist.md) §1 for the concrete traps:
   eager loading, unbounded caches, whole-file reads for a slice, per-row work inside
   frequently-firing screen/file events, missing `genTimeoutAttempt(500)` debounces
   (and the per-instance-vs-module-global timer bug), parsing inside hot getters.
2. **Correctness.** Wrong logic, off-by-one, unhandled rejection, `await` missing on a
   promise, state read after an `await` boundary, null/undefined paths, race between
   an event and a state set, error swallowed by a bare `catch {}`.
3. **Reuse & duplication.** Newly written code that an existing helper already covers;
   the same block copy-pasted across two of the new files; a constant redefined.
4. **Simplification & altitude.** Dead branches, redundant state that can be derived,
   an abstraction introduced for one call site, a `useMemo`/`useCallback` that guards
   nothing, over-deep nesting, a flag parameter that should be two functions.
5. **Project conventions.** `Comp` suffix on every React function component,
   `useAppCurrentRef` usage (and the ~63 sites deliberately NOT converted — do not
   "finish" them), `tran()` keys — **a missing Khmer key throws and blanks the page**,
   so any new user-facing string is a finding unless its key exists in both locales,
   `ConfirmPopupComp` labels are auto-`tran()`'d so pass raw English keys.
   Full list: [references/checklist.md](./references/checklist.md) §3.
6. **Tests.** New behavior with no test; a changed behavior whose existing test still
   passes only because it asserts the old shape loosely; the known mock trap —
   `vi.mock('.../debuggerHelpers')` is a dead path (the module is now `appHooks`);
   node-env tests that import `appProvider` die on module-scope `document`.
7. **Security & IPC.** New `ipcMain` handlers without argument validation, path
   traversal in anything that joins a user-supplied name onto a data dir, `shell.
   openExternal` on unvalidated input, new `webPreferences`, secrets or absolute local
   paths committed into the diff.
8. **Docs & memory drift.** If the staged change alters observable app behavior, the
   run-sheet/user-facing docs must move with it —
   `.claude/skills/owa-robot-test/references/user-workflows.md` and
   `docs/test-paths/coverage-matrix.md` (bump their version dates). If it invalidates
   a note in `.claude/memory/`, say which file is now wrong. A stale memory is a real
   finding: it will mislead a future session.

## 3. Verify before reporting

Every candidate finding must survive this before it goes in the report:

- **Re-read the surrounding code** and try to refute it. Assume the author was right.
  Most first-pass findings die here.
- **Write the failure scenario**: concrete inputs or state → the wrong output, crash,
  or cost. If you cannot write one, it is not a finding — either drop it or demote it
  to a Nit.
- **Confirm it is in the staged diff.** Pre-existing problems in an untouched part of
  the file are out of scope; mention at most a short "adjacent, pre-existing" list at
  the end, clearly separated.
- **Prefer running the check over asserting it.** `npx tsc --noEmit` /
  `npx vitest run <file>` / `npm run lint:es` on the touched files turns a guess into a
  fact. Note in the report which findings were machine-verified.

Do not pad. A short report of real findings beats a long one with plausible noise, and
the user's stated goal — *all* rooms to improve — is served by breadth of **search**,
not by breadth of **claims**.

## 4. Report

Order strictly by severity, highest first.

- **High** — breaks correctness, loses data, blanks the page, or measurably hurts
  performance on low-spec hardware.
- **Medium** — real bug in an edge case, meaningful memory/IO waste, a missing test for
  new behavior, a convention violation with runtime consequences.
- **Low** — duplication, simplification, naming, readability.
- **Nit** — style/preference, explicitly optional.

Per finding:

```
[High] Short claim — src/path/File.ts:120
Why it's wrong: <one or two sentences>
Failure scenario: <inputs/state → outcome>
Fix: <the concrete change, with a code snippet when it is short>
```

Use clickable markdown links: `[File.ts:120](src/path/File.ts#L120)`.

Close with:

- **Coverage** — files/groups reviewed, and anything deliberately skipped and why
  (e.g. a 5k-line generated file, a pure move).
- **Partially-staged warning** — if any file had unstaged edits on top.
- **Verdict** — one line: safe to commit / fix the High items first.

If there are genuinely no findings, say so plainly and list what you checked. Do not
invent work.

## 5. `fix` argument

Only when the argument contains `fix`: after reporting, apply the **High and Medium**
findings to the working tree, leave Low/Nit for the user unless they were trivial and
you note them. Then:

- Re-run the relevant tests / `npx tsc --noEmit`.
- Say clearly that the fixes are **unstaged** — the user decides whether to
  `git add` them. Never stage or commit on your own.

Without the argument, do not edit any file.
