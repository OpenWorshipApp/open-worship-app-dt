# Plan — `UT-xx` batches toward 99%

Ranked by **uncovered lines per hour of work**, which is not the same as by
file size: a folder whose files share one domain needs one mock surface, so
2 500 lines there cost less than 800 spread over five unrelated folders.

Status is `open` · `in progress` · `done (before → after)`. A batch is done
when `coverage-gap.mjs` says so, not when the tests are written.

**From 48.17% to 99% is +26 793 covered lines.** The batches below account for
roughly the first 12 000. Re-plan after UT-06 — the shape of the remainder
changes once the dark folders are gone.

---

## Tier 0 — the surface that can actually reach 99% now

### `UT-00` · `electron/**` — 533 uncovered of 2 519 (78.84%)
`open` · **the whole electron surface to 99% in one batch** · 46 files, 16 at 0%

Measured on its own, the electron main process is already at **78.84%** and is
**508 covered lines from 99%** — an order of magnitude less work than any
other batch, on a surface that is small, has a real mock
(`createElectronModuleMock()`), and has 30 green test files to copy from.

| Uncovered | Lines | Now | File |
| --- | --- | --- | --- |
| 74 | 162 | 54% | `electron/aiChatGuestHelpers.ts` |
| 74 | 506 | 85% | `electron/electronHelpers.ts` |
| 57 | 66 | 14% | `electron/webPageHelpers.ts` |
| 36 | 104 | 65% | `electron/aiHelpers.ts` |
| 34 | 292 | 88% | `electron/electronEventListener.ts` |

Do this first. It is the only batch that ends with a **surface at the goal**,
which is worth more than the same hours spread thinly — it proves the target is
reachable, exercises the whole measure → write → prove → gate loop end to end,
and produces the first `coverage.thresholds` worth committing (§6 `gate`).

Watch the `resetModules` fork while working here: it is the electron suite's
signature failure and every assertion reads "0 calls" when it bites. See
[recipes.md](./recipes.md) §3.

---

## Tier 1 — the dark folders (no shared mock surface exists yet)

Both were emptied by the same event: the 2026-08-24 prune that deleted
`appProvider.mock.ts` took 65 test files with it. Rebuilding them **without**
re-adding a shared fake is the point.

### `UT-01` · `src/presenting-flow` — 2 516 uncovered of 2 527 (0.4%)
`open` · **est. +4.3 pt** · 29 files, 28 of them at exactly 0%

The whole 12-file suite was deleted. Biggest: `PresentingFlowItem.ts` (309),
`PresentingFlow.ts` (260), `presentingFlowPreviewFloatingHelpers.ts` (199),
`PresentingFlowItemPreviewComp.tsx` (192), `presentingFlowArchiveHelpers.ts`
(171), `presentingFlowAutoNextHelpers.ts` (129).

*Mock surface:* one `vi.hoisted` bundle for `appProvider`, `fileHelpers`,
`FileSource` and the settings store, shared by the folder. Start with the two
model classes — they are pure state machines and need the least of it.

*What to assert:* the recorded behaviour, from memory —
`presenting-flow-references-vs-presets` (rows are file references, not
copies), `presenting-flow-reads-editing-history-head` (an editable doc reads
its history head, not the saved file), `presenting-flow-auto-next` (a cursor
move restarts the timers), `presenting-flow-expansion-follows-position`
(rows keyed by uuid), and the per-instance debounce rule — mount two rows over
one `filePath`, fire one event, assert **both** refreshed.

### `UT-02` · `src/presenter-foreground` — 1 466 uncovered of 1 469 (0.2%)
`open` · **est. +2.5 pt** · 28 files, 27 at 0%

`ForegroundMessageComp.tsx` (212), `ForegroundMediaComp.tsx` (184),
`propertiesSettingHelpers.tsx` (164).

*Mock surface:* `ScreenForegroundManager` plus the floating-widget host. The
component half wants the batched smoke harness
(`components.smoke.test.tsx`); the helpers want real assertions.

*What to assert:* memory `foreground-effects-one-setting` (border / shadow /
padding / text in ONE JSON key; `em` for the type, `px` for the box),
`foreground-blend-mode-stacking` (a `z-index` or `isolation` on `#foreground`
makes every blend a silent no-op — a test that would have caught it), and
`foreground-sync-shared-refs`.

---

## Tier 2 — the big pure-logic helpers (cheapest real coverage in the repo)

No DOM, no screen, no provider in most cases. These are also where a test is
most likely to find an actual bug.

### `UT-03` · `src/helper/agent*` — 1 044 uncovered of 1 891
`open` · **est. +1.8 pt** · 12 files

`agentFileHelpers.ts` (236), `agentBibleListHelpers.ts` (228),
`agentNoteHelpers.ts` (223), `agentBackupHelpers.ts` (208).

These are the modules that **write the user's files** on an agent's behalf —
the backup-before-change rule, the trash-not-delete rule, the refused name,
the validator gate (CLAUDE.md, memory `agent-data-tools-backup-undo`). They
are 0% covered and the consequence of a bug is somebody's song file. Highest
value-per-line in the plan.

*What to assert:* no backup → no change; a delete goes to the trash and
returns an `undoId`; `update` writes the editing history, never the file; a
bad name is refused rather than cleaned; `owa_undo` applies rename → files →
editing heads in that order.

### `UT-04` · the half-covered heavyweights — ~1 300 uncovered
`open` · **est. +2.4 pt** · 5 files

| File | Now | Uncovered | The uncovered part is |
| --- | --- | --- | --- |
| `src/setting/bible-setting/bibleXMLJsonDataHelpers.ts` | 1% | 338 | nearly all of it |
| `src/slide-editor/BoxEditorController.ts` | 11% | 349 | the editing commands |
| `src/server/fileHelpers.ts` | 41% | 241 | error paths (it already has a sibling test to extend) |
| `src/helper/appArchiveHelpers.ts` | 18% | 191 | the archive round trip |
| `src/lang/langHelpers.ts` | 14% | 182 | locale loading — and the km-completeness tests deleted in the prune |

`langHelpers` carries a bonus: restoring the translation-completeness check
that died with `src/lang/data/{en,km}/index.test.ts` closes a real hole, since
a missing Khmer key **throws in dev and blanks the page**.
`src/lang/tranKeyCoverage.test.ts` catches static keys only.

### `UT-05` · `tools/owa-devtools-mcp` — 803 uncovered of 3 424 (76.5%)
`open` · **est. +1.4 pt** · 33 files, `owaTools.mjs` alone 372

Already the best-covered corner, and the easiest to finish: plain ESM, no app
imports, no DOM, no mocks. Good work for a short run. Coordinate with
`owa-enhance-mcp`, which owns that package's design.

---

## Tier 3 — the structural hole: 415 components at 10.1%

13 901 lines, ~12 500 uncovered — **half the remaining gap in one kind of
file**. It cannot be closed file-by-file; it needs harnesses.

### `UT-06` · component smoke harnesses, folder by folder
`open` · **est. +8 to +12 pt across several runs**

One `components.smoke.test.tsx` per feature folder, on one mock surface,
copying `src/_screen/components.smoke.test.tsx` (664 lines — and note
`src/_screen` is the best-covered feature folder at 78.9%, which is what that
harness bought).

Order by uncovered lines: `src/setting` (1 809), `src/slide-editor` (1 614),
`src/bible-list` (1 104), `src/graph-view` (1 047), `src/others` (976),
`src/bible-reader` (829), `src/background` (807), `src/bible-lookup` (749),
`src/bible-find` (557), `src/lyric-list` (527), `src/resize-actor` (497).

**Three rules, or this batch becomes the thing the skill exists to prevent:**

1. Every component gets at least one assertion about its output, not a bare
   `expect(html).toBeTruthy()`.
2. Report the smoke-render share of the run's gain separately from the
   behavioural share.
3. Any component with real logic — a controller, a reducer, an event handler —
   gets a behavioural test as well, and is listed as such.

A missing `tran()` key will throw during these renders. **That is a bug
found**, not a test to work around.

### `UT-07` · the three giant single components
`open` · **est. +3.4 pt** · 3 files, 1 790 lines, all at 0%

`src/chatbot/ChatbotAppComp.tsx` (1 142), `src/graph-view/GraphSurfaceComp.tsx`
(408), `src/aichat/AiChatAppComp.tsx` (240).

Each is big enough to be its own batch, and each should probably be **split**
before it is tested — a 1 142-line component is a finding in itself. Raise
that with the user rather than writing a 1 000-line test for it. The chatbot
and AI Chat files belong to `owa-enhance-chatbot` and `owa-enhance-aichat`;
route the design question there.

---

## Tier 4 — the long tail, after re-planning

### `UT-08` · branches, not lines
`open` · no line gain — this is rung 5

Branch coverage trails line coverage by ~8 points (40.03% vs 43.19% on the src
surface at baseline). The gap is `catch` blocks, early returns and error
paths — precisely the code that runs on the volunteer's bad night. Sweep with
`--json` for files whose branch % trails their line % by more than 20 points.

### `UT-09` · the entry files — a decision, not a batch
`open` · 19 files, 286 lines, 0%

Either excluded with a reason or tested by mocking `createRoot`. **Put it to
the user.** See *Exclusions* in [baseline.md](./baseline.md).

---

## Running total

| After | Est. lines | Est. honest coverage |
| --- | --- | --- |
| baseline | 25 395 | **48.17%** |
| UT-00 | ~25 900 | ~49.1% — and `electron/**` alone at 99% |
| UT-01 | ~28 170 | ~53.4% |
| UT-02 | ~29 490 | ~55.9% |
| UT-03 | ~30 430 | ~57.7% |
| UT-04 | ~31 600 | ~59.9% |
| UT-05 | ~32 320 | ~61.3% |
| UT-06 (all folders) | ~43 520 | ~82.6% |
| UT-07 | ~45 310 | ~85.9% |

The last ~14 points are the long tail: the remainder of every folder, the
branches, and whatever UT-09 decides. **Re-plan after UT-06** — these
estimates assume ~90% of each batch's uncovered lines get covered, which is
optimistic for components and pessimistic for pure helpers.
