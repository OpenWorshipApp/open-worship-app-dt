# Plan — `UT-xx` batches toward 99%

Ranked by **uncovered lines per hour of work**, which is not the same as by
file size: a folder whose files share one domain needs one mock surface, so
2 500 lines there cost less than 800 spread over five unrelated folders.

Status is `open` · `in progress` · `done (before → after)`. A batch is done
when `coverage-gap.mjs` says so, not when the tests are written.

## Current status — 2026-09-29

Both suites pass. The whole surface measures **54.91% (29 672 / 54 038 lines)**;
Electron measures **99.03% (2 654 / 2 680)**, with **93.08% branches**.
The continuing UT-03b run added 11 behavioural tests and 314 covered lines.
See [baseline.md](./baseline.md) for the before/after, concurrent changes,
failures repaired and timings.

UT-10 and UT-00 are complete; UT-03 has a completed document-lifecycle sub-batch.
Recommended next: UT-02's foreground component harness, then UT-01's remaining
preview components and UT-04's persistence helpers. No threshold was changed.

### `UT-10` · restore the renderer measurement

`done` · two failing suites repaired · the full measurement is green again

Files: `src/lyric-list/lyricHelpers.test.ts` and
`src/bible-list/bibleSlidesHelpers.test.ts`; inspect their implementation twins
before updating expectations.

The player-plugin import reached Open Lyric's DOM-dependent internals. Added
the jsdom pragma, a file-local plugin mock and `addPlugin` to the local Open
Lyric stub. The existing test asserts registration and retains its font check.

The Bible test's obsolete right-alignment expectation now matches LTR text;
size, muted color, placement and the separate mixed RTL/LTR test all pass.

Verification: focused tests and both full-surface measurements passed. The full
gate result is recorded in the baseline. No application bug was confirmed and
no production code was changed by this batch.

### Fresh renderer priorities

| Batch | Current gap | Next scope and predicted gain |
| --- | --- | --- |
| UT-03 | `agentNoteHelpers.ts`: 194; `agentBibleListHelpers.ts`: 191; `agentBackupHelpers.ts`: 159 uncovered lines | File-local backup/storage/domain mocks; refusal and successful CRUD/restore cases. Estimate +250–400 behavioural lines across several runs. |
| UT-01 | Presenting-flow: 702 uncovered of 2 527; **72.2%** | 20 existing test files. Extend file-local screen/provider harnesses for preview components and outstanding timer/event paths; estimate +300–500 lines, reporting smoke separately. |
| UT-04 | `bibleXMLJsonDataHelpers.ts`: 339; `fileHelpers.ts`: 230 uncovered | Filesystem/cache error paths with per-file mocks; estimate +200–350 behavioural lines. |
| UT-02 | Foreground: 1 486 uncovered of 1 489 | Remains nearly untested; larger component work after lifecycle coverage. |

### `UT-03a` · document lifecycle — completed part of UT-03

`done` · `src/helper/agentFileHelpers.ts`: **22.63% → 74.07%**, **+125 lines**

43 new cases in `agentFileHelpers.coverage.test.ts`, sharing one file-local mock
surface for storage, document classes, validators and the backup boundary.
They exercise both songs and slide documents: delayed backup before create,
no backup/no mutation, collision and name refusal, preserved metadata on update,
unsaved/undo reporting, rename/trash dispatch, failed snapshots/writes, timestamp
insensitivity, and the 60-name library cap. Actual backup persistence and
individual slide-edit algorithms remain separate follow-up scopes.

### `UT-03b` · backup, Bible Notes and Bibles-list lifecycles — completed

`done` · whole surface **54.33% → 54.91%**, **+314 behavioural lines**

Eleven file-local tests extended `agentBackupHelpers.coverage.test.ts` and
`agentDataDispatch.coverage.test.ts`. They verify the safety order that matters:
a backup writes data before visible metadata; a failed snapshot prevents the
mutation; a failed mutation is recorded for recovery; and trash/rename clean up
or retain the associated material correctly. Bible Notes and Bibles lists now
exercise their add/update/delete and whole-file create/rename/delete routes,
including read-only verse marks and detached item backgrounds. No shared
`appProvider` mock was added.

The detailed UT-01–UT-09 proposals and running-total table below retain the **2026-09-26 historical
proposal**, not a current ranking or forecast. No batch is marked done without
a successful measurement of its own surface.

---

## Tier 0 — the surface that can actually reach 99% now

### `UT-00` · `electron/**` — 26 uncovered of 2 680 (99.03%)
`done` · **98.28% → 99.03%, +20 covered lines** · 48 files, none at 0%

Final full measurement: 40 files / 463 tests passed in 16.27 s.
Predicted +20–30 lines; actual **+20**. The table records the gaps before this
batch; the current worklist contains the remaining 26 lines.

| Uncovered | Lines | Now | File |
| --- | --- | --- | --- |
| 14 | 530 | 97.35% | `electron/electronHelpers.ts` |
| 10 | 108 | 90.74% | `electron/displayWallpaperHelpers.ts` |
| 4 | 104 | 96.15% | `electron/aiHelpers.ts` |
| 4 | 300 | 98.66% | `electron/electronEventListener.ts` |
| 3 | 38 | 92.10% | `electron/client/fileUtils.ts` |

Added behaviour checks for retargeting the same document's editor, leaving
unrelated/destroyed editors alone, popup cascading with remembered size,
wallpaper fit/fallback/cache expiry, and connected file-input events. Clipboard
debug output remains a gap. Wallpaper coverage is now 100% lines.

Mock surface: the existing `createElectronModuleMock()` plus per-file
`vi.hoisted` filesystem/process/native-image stubs and fake timers. Changes are in
`electronHelpers.coverage.test.ts`, `displayWallpaperHelpers.test.ts`, and
`client/clientUtilities.test.ts`. Platform branches remain deterministic.

Reaching 99% lines does not close the 93.08% branch gap. Any threshold remains
a separate user decision; a threshold over loaded files would not lock in this
whole-surface measurement.

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

*Mock surface:* one file-local `vi.hoisted` bundle for `appProvider`, `fileHelpers`,
`FileSource` and the settings store per batched harness, never exported to other
test files. Start with the two
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

## Historical running-total forecast — requires remeasurement

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
