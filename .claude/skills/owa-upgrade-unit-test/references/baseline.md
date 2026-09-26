# Baseline — the honest starting point

**Measured 2026-09-26** on `enhance-after-2026-09-12` @ `22217577`, by
`node .claude/skills/owa-upgrade-unit-test/scripts/coverage-gap.mjs`.
Re-measure and update this file whenever a run moves the number; a target with
a drifting baseline cannot show progress.

## The number, and the number that is wrong

| | Lines | Statements | Branches | Functions |
| --- | --- | --- | --- | --- |
| **Honest — whole surface, 986 files** | **48.17%** (25 395 / 52 715) | — | — | — |
| `npm run test:coverage` (src only, 526 loaded files) | 78.28% | 78.31% | 71.50% | 78.97% |
| `npm run test:electron:coverage` (35 loaded files) | 84.29% | 84.35% | 72.26% | 81.71% |

The 78% and the 84% are **coverage of the files the tests happened to import**.
Vitest's v8 provider measures only loaded files unless `coverage.include` is
given, and neither committed config gives one. 460 source files never enter
that denominator at all, so deleting a test that loads a big untested file
*raises* the reported figure.

Everything in this skill is stated against the honest denominator.

```text
986 files · 52 715 lines · 25 395 covered
502 files at 0%          173 files at 100%
to 99%: 26 793 more covered lines
```

## Where the gap is

| Kind | Files | Lines | Covered | The shape of the work |
| --- | --- | --- | --- | --- |
| `module` (classes, controllers, `tools/*.mjs`) | 200 | 15 025 | **70.0%** | Best-covered; the remainder is error paths and rare branches |
| `helper` (`*Helpers.ts`) | 352 | 23 503 | **57.3%** | The biggest absolute gap, and pure logic — the real wins live here |
| `component` (`*Comp.tsx`) | 415 | 13 901 | **10.1%** | The biggest structural hole; needs batched smoke harnesses |
| `entry` (`src/*.tsx`, `boot.ts`) | 19 | 286 | **0%** | See *Exclusions* — decide with the user |

### The ten biggest single files

| Uncovered | Lines | Now | File |
| --- | --- | --- | --- |
| 1 142 | 1 142 | 0% | `src/chatbot/ChatbotAppComp.tsx` |
| 613 | 613 | 0% | `src/ms-office/pptxSlideMeasureHelpers.ts` |
| 408 | 408 | 0% | `src/graph-view/GraphSurfaceComp.tsx` |
| 372 | 372 | 0% | `tools/owa-devtools-mcp/owaTools.mjs` |
| 349 | 393 | 11% | `src/slide-editor/BoxEditorController.ts` |
| 338 | 342 | 1% | `src/setting/bible-setting/bibleXMLJsonDataHelpers.ts` |
| 309 | 309 | 0% | `src/presenting-flow/PresentingFlowItem.ts` |
| 260 | 260 | 0% | `src/presenting-flow/PresentingFlow.ts` |
| 248 | 248 | 0% | `src/bible-find/BibleFindController.tsx` |
| 241 | 410 | 41% | `src/server/fileHelpers.ts` |

### The folder-sized holes

`src/presenting-flow` — **29 files, 2 527 lines, 0.44% covered, 28 files at
exactly 0%**. This is not neglect: the *entire* presenting-flow suite (12 test
files) was deleted in the 2026-08-24 prune that removed `appProvider.mock.ts`,
because every one of those tests only passed because that fake existed. Memory
`appprovider-mock-node-env` lists the rest of the damage — server 4,
bible-list/note 4, app-document-list 4, slide-editor/canvas 4,
setting/bible-setting 3, app-modal 3, helper 3, and both `lang` translation
suites. **The km-translation completeness tests are gone**, which matters
because `tran()` throws on a missing key.

Those 65 deleted tests are the single largest cause of today's number, and
rewriting them **without** a shared provider mock is the main job this skill
exists to do.

## The surface, and what is excluded

Measured: `src/**/*.ts(x)`, `electron/**/*.ts`, `tools/owa-devtools-mcp/*.mjs`.

| Excluded | Why |
| --- | --- |
| `**/*.test.*`, `**/*.spec.*` | The tests themselves |
| `src/test-setup/**` | Test infrastructure |
| `src/vite-env.d.ts` | Type declarations, no runtime |
| `src/experiments/**` | Build-excluded dev scratch harness (memory `experiments-html-in-canvas`) |
| `electron/testElectronModule.ts`, `electron/testUtils.ts` | Test infrastructure |

**Undecided, worth ~286 lines:** the 19 renderer entry files (`src/about.tsx`,
`src/aichat.tsx`, `src/chatbot.tsx`, `src/boot.ts`, `src/others/main.tsx` …).
They are `createRoot(...).render(...)` and little else; a test can only prove
them by mocking the render away, which proves nothing. Put the choice to the
user rather than quietly excluding them — and while they are in, they are in
the denominator and count against 99%.

Adding an exclusion is a decision, not a cleanup: it moves the goalposts.

## What it costs to measure

| Run | Wall clock | Note |
| --- | --- | --- |
| `npm test` (no coverage) | ~55 s | 293 files, 3 683 tests |
| `npm run test:electron` | ~9 s | 30 files, 339 tests |
| `coverage-gap.mjs` src | **~124 s** | full instrumentation, ~2.5× slower |
| `coverage-gap.mjs` electron | **~33 s** | |

Full instrumentation pushes `src/_screen/components.smoke.test.tsx` past the
committed 10 s `testTimeout`; the script passes `--testTimeout=60000` so the
run does not report a timeout as a broken test.

**A failing test means no coverage report is written at all.** The script
raises that rather than printing a stale number.

## Two environmental facts about the gate

- **`lint:pre` is red on this Windows checkout for line endings.**
  `core.autocrlf` is `true` and `.prettierrc` sets no `endOfLine`, so
  `prettier --check` flags ~1 270 files nobody touched. Do **not** run
  `npm run format`. Check only your own new files.
- **`lint:es` does not lint test files** —
  `--ignore-pattern "src/**/*.test.ts*"`. New tests are not eslint-gated;
  they ARE prettier-gated.

## The ladder to 99%

Each rung is a measurable state, not a quantity of work. Report which one the
suite is on.

| Rung | State |
| --- | --- |
| **1 — measured** | The honest number is known and reproducible. **← here** |
| **2 — no dark folders** | No folder sits under 20%; `presenting-flow`'s 0.44% is gone |
| **3 — logic covered** | Every `*Helpers.ts` and controller ≥ 90%; components may still be smoke-only |
| **4 — components real** | Components ≥ 90%, and the behavioural half is behavioural |
| **5 — branches too** | Branch coverage within 5 points of line coverage — error paths are actually run |
| **6 — locked** | ≥ 99% lines with a committed `coverage.thresholds` that fails the gate on a fall |

Rung 6 without rung 5 is a number, not a test suite: line coverage rises with
smoke renders while every `catch` in the app stays unrun. Branch coverage is
what says the error paths were entered, so it is reported beside lines in every
run.
