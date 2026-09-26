---
name: owa-upgrade-unit-test
description: 'Raise the Open Worship App unit-test coverage toward 99% — measured HONESTLY against every source file, not against the ones the tests happen to load. Use when asked to improve / add / upgrade / expand unit tests, to raise or measure test coverage, to write tests for a file or a folder, to reach a coverage percentage, to find what is untested, to fix a flaky or failing vitest suite, or to make the test suite trustworthy. Covers both vitest projects — `vitest.config.ts` (src + tools/owa-devtools-mcp, node env with a per-file jsdom pragma) and `vitest.electron.config.ts` (electron main process) — and every testing idiom this repo actually uses: `vi.hoisted` mock bundles, the `// @vitest-environment jsdom` first line, `createRoot` + `act` or `renderToStaticMarkup` for components, and the batched `*.coverage.test.tsx` / `*.smoke.test.tsx` harnesses that carry many modules on one mock surface. THE MEASUREMENT RULE THAT BINDS EVERY RUN: `npm run test:coverage` reports coverage over LOADED files only and reads ~78%; the honest figure over the whole surface is ~45%, so every number this skill states comes from scripts/coverage-gap.mjs and the goal is defined against that denominator. THE TEST RULE: a test must be able to FAIL — it asserts behaviour, never merely imports a module for the line count, and coverage that came from an assertion-free render is reported as what it is. Hard constraints it must not break: there is NO shared appProvider mock and none may be re-added (the user deleted it and 65 tests with it), a missing Khmer `tran()` key throws in dev, and `npm run lint` is the gate.'
argument-hint: '[measure | plan | <path or folder> | next | continue | fix-flaky | gate | report] — default: measure then plan'
---

# OWA Upgrade Unit Test — toward 99%, measured honestly

The goal is **99% line coverage of the app's own source**, and the first thing
this skill does is refuse the comfortable number. `npm run test:coverage`
prints ~78% because v8 only measures files a test imported; over the whole
surface the figure is **~45%**, with **506 files at exactly 0%**. A run that
reports the 78% is not measuring the thing the goal is about.

```text
MEASURE (honest denominator) → PLAN (ranked, resumable) → WRITE TESTS → PROVE (before → after) → GATE
```

**99% is a long climb, not one run.** ~27 000 uncovered lines stand between
here and there. So this skill is built to be run many times and to resume: the
worklist is a file on disk, each run takes the next batch, and every run states
the before → after number it moved. A run that adds 40 tests and cannot say
what the coverage number did has not finished.

## The two rules

1. **Every number comes from `scripts/coverage-gap.mjs`.** It measures the
   whole surface — loaded or not — for both vitest projects. Quoting the
   `test:coverage` summary as progress is the one mistake that makes this
   entire effort meaningless, because that number can RISE while real coverage
   falls (delete a test that loads a big untested file and the denominator
   shrinks with it).
2. **A test must be able to fail.** Coverage is the measure, never the goal:
   the goal is that a broken change is caught. Importing a module, rendering it
   and asserting nothing lights up the same lines as a real test and catches
   nothing. Where a batched smoke render genuinely is the right tool — it is,
   for 417 components — it still asserts something true about the output, and
   the run REPORTS how much of its gain came from smoke rendering versus
   behavioural tests.

## Invocation

| Argument | What happens |
| --- | --- |
| *(none)* | §1 measure, §2 plan, show the plan, ask which batch to take |
| `measure` | §1 only — the honest number, the ranked gap, no code written |
| `plan` | §1 + §2 — the batch plan and its predicted gain, nothing written |
| `<path>` (`src/presenting-flow`, `src/helper/agentFileHelpers.ts`) | Test exactly that, to 99% of its own lines |
| `next` · `continue` | Take the next unclaimed batch off the saved worklist |
| `fix-flaky` | §5 — hunt order-dependence and environment leaks, write no new tests |
| `gate` | §6 — propose the coverage threshold that locks in what has been won |
| `report` | Print progress against the goal from the saved worklist, change nothing |

## Non-negotiables

These are this repo's, not this skill's, and they outrank any coverage gain.

1. **No shared `appProvider` mock, in any form.** `appProvider.mock.ts` was
   deleted by the user's explicit decision — *"remove all mock for app-provider,
   I don't need mocking anymore"* — and **65 test files went with it**. A test
   that reaches `appProvider` mocks it **in its own file**. Re-adding a shared
   fake, a `setupFiles` injection or a "just for tests" provider shim undoes a
   decision, whatever it does for the number. Memory `appprovider-mock-node-env`.
2. **`npm run lint` is the gate, and it runs `test:all`.** A new test that is
   slow, flaky or order-dependent does not merely fail this skill — it blocks
   every other change in the repo. Suite wall-clock is reported every run.
3. **A missing Khmer `tran()` key throws in dev.** A test that renders a
   component with a new label will throw unless the key exists in
   `src/lang/data/km/index.ts` AND `src/lang/data/fr/index.ts`. When a test
   surfaces a missing key, that is a REAL BUG found — file it, do not mock
   `tran` to step around it.
4. **Performance outranks elegance** (CLAUDE.md). That applies to the suite
   too: a mock surface shared across a batch beats 40 files that each boot the
   world.
5. **Never delete or `.skip` a failing test to raise a number.** A failing test
   is a finding. If it is wrong, fix it and say so; if it found a bug, report
   the bug.
6. **Everything under `.claude/skills/` ships** in the installer's knowledge
   bundle: no secrets, nobody's own data, no user-specific references
   (memory `no-user-specific-references-in-notes`).

## Procedure

### 1. Measure — the honest denominator

```bash
node .claude/skills/owa-upgrade-unit-test/scripts/coverage-gap.mjs
```

It runs both vitest projects with coverage over **every** file in the surface,
writes `test-results/unit-coverage/worklist.json` (gitignored — and the reason
a cleared conversation can still resume), and prints the honest percentage, the
count at 0%, the breakdown by kind and the biggest gaps.

Three facts about running it, each of which has already cost a run:

- **It takes ~4 minutes, not ~1.** Instrumenting all 967 files rather than the
  526 that load makes the suite ~2.5× slower. The script passes
  `--testTimeout=60000` for exactly this reason: at the committed 10s timeout,
  `src/_screen/components.smoke.test.tsx` times out under full instrumentation
  and it looks like a test you broke.
- **A failing test means NO report at all.** vitest writes no
  `coverage-summary.json` when the run fails, and the script says so rather
  than printing a stale number. Green the suite first.
- **`--no-run` reuses the last report** — use it for every slice and follow-up
  question rather than paying four minutes again.

Take the baseline and the interesting slices:

```bash
node .../coverage-gap.mjs --no-run --dir=src/presenting-flow --top=40
node .../coverage-gap.mjs --no-run --uncovered=src/server/fileHelpers.ts   # the line ranges
node .../coverage-gap.mjs --no-run --json                                  # for a resumed session
```

Compare against [references/baseline.md](./references/baseline.md), which
carries the measured starting point and its date. **If today's number differs
from that file by more than a point, the file is stale — update it in this
run**, because a target with a drifting baseline cannot show progress.

### 2. Plan — batches ranked by lines per hour, not by file

Never work the list top-down file by file. Group it, because this codebase's
gap has a shape and the shape decides the tool:

| Group | Size | Now | The tool that fits |
| --- | --- | --- | --- |
| **Components** (`*Comp.tsx`) | 417 files, ~14 000 lines | ~10% | One batched smoke harness per feature folder, on one mock surface — the `src/_screen/components.smoke.test.tsx` pattern |
| **Helpers** (`*Helpers.ts`) | ~353 files, ~23 600 lines | ~57% | Ordinary behavioural tests, one file each; these are the pure-logic wins and where real bugs are found |
| **Modules / controllers** | ~177 files, ~12 900 lines | ~63% | Behavioural tests around the class's state machine |
| **Entries** (`src/*.tsx`, `boot.ts`) | 20 files, ~286 lines | 0% | Mostly **exclude, with a reason** — §4 |

Then pick batches by **uncovered lines per hour of work**, which usually means:

1. **A whole feature folder with one shared mock surface.** `src/presenting-flow`
   has ~1 500 uncovered lines across files that share one domain and were all
   orphaned by the same prune — one mock surface serves the folder.
2. **The single biggest untested helpers.** `agentFileHelpers`,
   `agentBibleListHelpers`, `agentNoteHelpers`, `agentBackupHelpers` are ~900
   lines of pure logic at 0%, and they are the tools that write the user's files.
3. **The half-covered heavyweights**, where the uncovered half is the error
   paths: `fileHelpers` (41%), `bibleXMLJsonDataHelpers` (1%),
   `BoxEditorController` (11%), `langHelpers` (14%).
4. **Component smoke harnesses**, folder by folder — the biggest raw number and
   the weakest assertions, so it is reported separately.

Write the plan as [references/plan.md](./references/plan.md) lays it out:
each batch gets a `UT-xx` id, its files, its predicted uncovered-line gain, and
the mock surface it needs. **Show the plan and let the user pick the batch**
unless they named a path or said `next`.

### 3. Write the tests

Work [references/recipes.md](./references/recipes.md) — this repo's actual
idioms, with the traps that have already bitten. The four that matter most:

- **`// @vitest-environment jsdom` as the literal first line** of any test whose
  imports reach `appProvider`, `FileSource` or React. Workers are reused, so a
  missing pragma passes or fails depending on file order — and a suite that
  dies at import is reported as `(0 test)`, which is a FAILURE, not a skip.
- **`vi.hoisted()` for the mock bundle**, `vi.mock` factories reading from it.
  A `vi.mock` factory result is cached past `vi.resetModules()`, so a resetting
  test and its module under test silently end up on different mocks and every
  assertion reads "0 calls".
- **Assert behaviour, not shape.** The test that is worth writing is the one
  that would have caught the bug in `.claude/memory/` — a sliding cache TTL, a
  module-level debounce shared by every instance, a getter handing out its own
  live array. `references/recipes.md` §5 lists this repo's recurring defect
  classes as ready-made test targets.
- **Components: `renderToStaticMarkup` for a smoke pass, `createRoot` + `act`
  when behaviour is under test.** There is no `@testing-library/react` here.

While writing, keep the suite honest:

```bash
npx vitest run --config vitest.config.ts src/presenting-flow    # just this batch
npx vitest related --config vitest.config.ts <changed file>     # what it touches
```

### 4. Exclusions — declared, justified, and counted

99% of a surface that quietly grows exclusions is not 99%. Every exclusion goes
in `EXCLUDE` in `scripts/coverage-gap.mjs` with a one-line reason in
[references/baseline.md](./references/baseline.md), and the report states how
many lines the exclusions hold. Defensible: `*.test.*`, `src/test-setup/**`,
`src/experiments/**` (build-excluded dev scratch, memory
`experiments-html-in-canvas`), `electron/testElectronModule.ts` and
`electron/testUtils.ts` (test infrastructure), `vite-env.d.ts`. Renderer entry
files (`src/about.tsx`, `src/aichat.tsx`, `boot.ts`) are the honest grey area —
they are ~286 lines of `createRoot(...).render(...)` that a test can only prove
by mocking the render away. **Propose them as exclusions to the user rather
than deciding alone**, and if they stay in, they stay in the denominator.

Never exclude a file because testing it is hard. That is the file most worth
testing.

### 5. `fix-flaky` — a suite nobody trusts is not coverage

Coverage from a suite that fails at random is worth nothing, so this mode
writes no new tests and hunts the two known classes:

```bash
# jsdom leaks into later node-env files through a reused worker; run the
# pragma-less files ALONE and any DOM dependency fails deterministically.
npx vitest run --config vitest.config.ts $(grep -rL "@vitest-environment" $(git ls-files 'src/**/*.test.ts*'))
npx vitest run --config vitest.config.ts --sequence.shuffle   # order dependence
npx vitest run --config vitest.config.ts --no-file-parallelism
```

Also sweep the dead mocks CLAUDE.md names: four test files still
`vi.mock('.../debuggerHelpers')`, a module that became `appHooks` — inert, and
it silently fails to stub `useAppEffect`.

### 6. Prove it, then gate

**Re-measure and state before → after.** A run's result is two numbers and the
delta, per surface:

```text
src+electron lines: 45.28% (22962/50708) → 48.9% (24798/50708)   +1836 lines, +3.6pt
suite: 3683 → 3921 tests, 54.8s → 61.2s wall clock
of the gain: 1290 lines behavioural, 546 lines smoke render
```

Then `npm run lint` — the whole gate, reading the log body rather than the exit
code, since it is `&&`-chained and the first failure hides every stage after.
Two things that will look like your fault and are not:

- **`lint:pre` is red on a Windows checkout for line endings.** `core.autocrlf`
  is `true` and `.prettierrc` sets no `endOfLine`, so `prettier --check` flags
  ~1270 files that nobody touched. **Do not run `npm run format`** — it would
  rewrite the repo. Check only your own new files:
  `npx prettier --check <your files>`, and `--write` those.
- **`lint:es` does not lint test files** (`--ignore-pattern "src/**/*.test.ts*"`),
  so a new test's eslint cleanliness is not gated — but prettier's is.

Once a level is won, `gate` proposes locking it in with
`coverage.thresholds` so it cannot silently fall back. Propose it; the user
decides — a threshold that fails other people's builds is their call.

### 7. Paper trail

In the same change: [references/baseline.md](./references/baseline.md) with the
new number and date; [references/plan.md](./references/plan.md) with the batch
closed and what it actually gained versus predicted; a memory note for any
testing trap the next session would otherwise re-learn; **and any BUG the tests
found reported to the user** — that is the real return on this work, and it is
worth more than the percentage. Mirror `.claude/skills/owa-upgrade-unit-test/`
to `.agents/skills/` and `.github/skills/`, then
`node extra-work/build-knowledge.mjs` (CLAUDE.md: every `.claude/` edit, same
change).

## What counts

- A test that fails when the behaviour breaks, on a file that had none.
- A bug found by writing the test — file it, name it in the run's report.
- A batch that moved the honest number, stated before → after.
- A flake killed, or a dead mock removed.
- An exclusion declared with its reason and counted in the denominator.

Not: an import-and-render with no assertion, reported as coverage; a number
from `npm run test:coverage`; a percentage that rose because a test was
deleted; a shared `appProvider` mock in any disguise; a `.skip` on something
that went red.

## Resources

- [references/baseline.md](./references/baseline.md) — the measured starting
  point, the surface, every exclusion and its reason, the ladder to 99%.
- [references/recipes.md](./references/recipes.md) — this repo's test idioms
  and their traps: the jsdom pragma, `vi.hoisted` bundles, component rendering
  with no testing-library, the electron config, the batched harness pattern,
  and the defect classes worth testing for.
- [references/plan.md](./references/plan.md) — `UT-xx` batches: files,
  predicted gain, mock surface, status.
- [scripts/coverage-gap.mjs](./scripts/coverage-gap.mjs) — the honest
  measurement. `--no-run`, `--surface=`, `--dir=`, `--uncovered=<file>`,
  `--top=`, `--json`, `--goal=`. Writes only under `test-results/`.
- Memory: `appprovider-mock-node-env` (no shared provider mock — and the 65
  deleted tests), `vitest-env-leak-flakes` (the jsdom pragma),
  `vitest-mock-factory-survives-resetmodules` (the electron mock fork),
  `monaco-css-test-failure-local-open-lyric` (importing the real open-lyric),
  `tran-missing-key-throws-in-dev`.
- Sibling skills: `/owa-enhance` for app-wide research (unit tests are one of
  its `code-health` leads), `/owa-robot-test` for live UI QA — **that skill's
  `coverage-expansion/` is UI-PATH coverage, a different thing from the line
  coverage this skill moves**; `review-stagged-change` for reviewing a diff.
