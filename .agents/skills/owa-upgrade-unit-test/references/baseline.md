# Baseline — the honest starting point

## UT-03b agent-data lifecycles — 2026-09-29

The whole surface advanced from **54.33% (29,358 / 54,038)** to **54.91%
(29,672 / 54,038)**: **+314 behavioural lines, +0.58 points**. Both fully
instrumented projects are green: 335 renderer/MCP files with 4,036 tests in
40.24 s, and 40 Electron files with 463 tests in 7.92 s. The denominator,
exclusions and thresholds are unchanged.

The 11 new tests are all behavioural and file-local. They cover backup data
before metadata, no-backup/no-change refusal, failed-change marking, trash and
rename lifecycle operations; and the safe CRUD lifecycle for Bible Notes and
Bibles lists (including backup-first mutations, fresh saves, editing-history
sync, immutable verse marks, attached-background cleanup, and recoverable
whole-file rename/delete). No production bug was found.

Focused checks passed for both changed files and Prettier. The full lint gate
remains to be run after the continuing coverage batch; Windows-wide Prettier
debt is a known independent gate concern.

## Completed repair and coverage run — 2026-09-29

Measured with `coverage-gap.mjs` over both complete source surfaces, on the
working checkout of `enhance-after-2026-09-12` @ `7828d2ad`. The starting point
below is the first green measurement after repairing the two failing suites.

| Surface | Before | After | Branches before → after |
| --- | --- | --- | --- |
| **Whole surface** | **54.04% (29 195 / 54 021)** | **54.33% (29 359 / 54 036)** | See per-project figures below |
| `src/**` + MCP | 51.73% (26 561 / 51 341) | 52.00% (26 705 / 51 356) | 49.83% → 50.11% |
| `electron/**` | 98.28% (2 634 / 2 680) | **99.03% (2 654 / 2 680)** | 91.33% → 93.08% |

The final denominator contains 1 005 files: 451 at zero and 216 at 100%.
Reaching 99% across the whole app still requires 24 137 more covered lines.
Renderer entries remain included: 19 files / 297 lines. Exclusions and
thresholds are unchanged. Line percentages use the script's rounding; branch
counts come from the coverage summaries written by those same script runs.

**Attributable gain: 145 lines, all behavioural; zero smoke-render lines.**
`agentFileHelpers.ts` gained 125 (55/243 → 180/243, 22.63% → 74.07%);
`electronHelpers.ts` gained 8; `displayWallpaperHelpers.ts` gained 10
(98/108 → 108/108); `client/fileUtils.ts` gained 2. This run added 61 tests:
43 document-lifecycle cases and 18 Electron cases, with two existing file-input
tests repaired so their events actually reach the document listener.

The observed whole-tree change is +164 covered / +15 total lines. Concurrent
daily-tip changes account for +20 covered / +15 total lines and two tests;
`dirWatchingHelpers.ts` varied by -1 covered line between runs. Those are not
claimed as gains from this testing batch.

| Instrumented suite | Before | After |
| --- | --- | --- |
| Renderer + MCP | 334 files / 3 980 tests / 113.05 s | 335 files / 4 025 tests / 109.20 s |
| Electron | 40 files / 445 tests / 14.11 s | 40 files / 463 tests / 16.27 s |
| Combined Vitest wall clock | 127.16 s | 125.47 s |

The initial lyric import failure was repaired with a file-local player-plugin
mock and jsdom; the existing test now asserts player registration. The Bible
preview expectation now follows the implementation's language-aware alignment,
while preserving size, color, placement and RTL/LTR assertions. No production
code was changed by this batch and no new application defect was confirmed.
The live development Presenter was inspected through `owa-devtools` and a
screenshot confirmed that the song preview and stage preview rendered.

Validation: both TypeScript projects passed, and `npm run test:all` passed
4 025 renderer/MCP tests plus 463 Electron tests (73.93 s + 14.39 s = 88.32 s).
`npm run lint` then stopped at `lint:pre`: 1 308 files have existing repository
formatting issues. This checkout uses `core.autocrlf=true`, but a sampled
untouched file also fails after in-memory LF normalization, so the formatting
debt is not claimed to be line endings alone. All six test files changed by
this batch pass their explicit Prettier check. The remaining stages were run
directly: **ESLint and the production build check both passed**. No broad
formatting rewrite was performed.

Evidence: `baseline-repaired-2026-09-29.json`, the paired baseline summary
files, `after-2026-09-29.log`, and the refreshed full `worklist.json` under
`test-results/unit-coverage/`. Gate logs are `lint-2026-09-29.log`,
`lint-es-2026-09-29.log`, and `lint-build-2026-09-29.log` in that directory.

## Initial failed measurement — 2026-09-29 (historical)

Measured the working checkout of `enhance-after-2026-09-12` @ `7828d2ad`,
including its existing staged changes. No tests or application code were changed
by this measure-and-plan run.

| Surface | Lines | Branches | Test result | Wall clock |
| --- | --- | --- | --- | --- |
| `src/**` + MCP | **Unavailable: failed run** | Unavailable | 332 files passed, 2 failed; 3 973 tests passed, 1 failed, plus one suite failed at import | 69.72 s Vitest / 71 s measurement |
| `electron/**` | **98.28% (2 634 / 2 680)** across 48 files | **91.33% (1 202 / 1 316)** | 40 files, 445 tests passed | 8.66 s Vitest / 10 s measurement |

The ordinary full-surface command stopped after the renderer failure, so Electron
was measured separately with `coverage-gap.mjs --surface=electron`. Electron has
46 uncovered lines, zero files at 0%, and needs **20 additional covered lines**
for 99%. Its earlier 78.84% baseline is stale. This is progress already in the
checkout, not coverage gained by this run. Branches come from that same script
run's `cov-electron/coverage-summary.json`.

Both renderer failures reproduce in a focused run without coverage (0.964 s):

- `src/lyric-list/lyricHelpers.test.ts` fails before collecting tests:
  `ReferenceError: document is not defined`. The newly staged player-plugin
  import reaches `open-lyric/dist/internal.js`, outside the test's existing
  `open-lyric` mock.
- `src/bible-list/bibleSlidesHelpers.test.ts:235` expects right alignment, but
  the implementation returns left alignment for left-to-right text. Review the
  remaining layout assertions together with the current direction-aware layout.

At this initial attempt no combined percentage or before/after gain was
available; the worklist then covered Electron only. The completed run above
supersedes that state. Logs are `measure-2026-09-29.log`, `measure-electron-2026-09-29.log`, and
`verify-failures-2026-09-29.log` in the same gitignored directory. No exclusions
or thresholds changed. The full lint gate was not run: this invocation changed
measurement/plan documentation only.

## Historical whole-surface baseline — 2026-09-26

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

- **Line endings.** `core.autocrlf` is `true` and `.prettierrc` sets no
  `endOfLine`, so ~1 350 files sit on disk as CRLF. `lint:pre` was red on
  them until 2026-09-30 (`408ecbc3` added `--end-of-line auto`); `npm run
  format` has no such flag, so do **not** run it. Check only your own new
  files.
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
