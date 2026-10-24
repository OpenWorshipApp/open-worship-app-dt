# Baseline — the honest starting point

## Achieved 80% target — 2026-10-15 (UT-69)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **79.81% (58,331 / 73,091) → 80.01% (58,478 / 73,091)**,
**+147 net covered lines, +0.20 points**. The 80% threshold is **58,473
covered lines**, so this result clears it by **5 lines**. No exclusions or
thresholds were changed. Renderer + MCP is **79.15% (51,244 / 64,740)**;
Electron is unchanged at **86.62% (7,234 / 8,351)**.

Twelve behavioral tests extend virtual-list scrolling, slide-editor keyboard
handling and lyric-stage rendering. They check shared scroll observers and the
timeout fallback; slide and canvas delete, paste, duplicate, navigation and
history keys; and lyric font options, single-key and whole-song slides,
attachments and slide lookup. Full instrumentation covers **89 / 103**
virtual-scroll lines, up from 46 / 103, **93 / 101** keyboard-handler lines,
up from 44 / 101, and **80 / 103** lyric-stage lines, up from 25 / 103. All
**6,693 renderer/MCP and 849 Electron tests** passed under instrumentation.
No application code changed. The full `npm run lint` gate passed both
TypeScript projects, **7,542 ordinary tests**, Prettier, ESLint, and the
production build check.

Evidence: `ut69-after.log`, `ut69-after-src-summary.json`,
`ut69-after-electron-summary.json`, `ut69-after-worklist.json` and
`ut69-lint.log` under `test-results/unit-coverage/`.

### Previous batch — UT-68

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **79.62% (58,195 / 73,091) → 79.81% (58,331 / 73,091)**,
**+136 net covered lines, +0.19 points**. Another **142 covered lines** are
needed for 80%. No exclusions or thresholds were changed. Renderer + MCP is
**78.93% (51,097 / 64,740)**; Electron is unchanged at **86.62% (7,234 /
8,351)**.

Nine behavioral tests extend the run-sheet, router and mirror camera transport
suites. They check an open run's cursor, parked lines and slides; the available
run-sheet fallback; tab visibility and external opening; and WebRTC offer and
candidate signaling, stream release, failure, timeout and unload cleanup.
Full instrumentation covers **92 / 98** run-sheet lines, up from 32 / 98,
**66 / 111** router lines, up from 42 / 111, and **57 / 60** camera transport
lines, up from 5 / 60. All **6,681 renderer/MCP and 849 Electron tests** passed
under instrumentation. No application code changed. The full `npm run lint`
gate passed both TypeScript projects, **7,530 ordinary tests**, Prettier,
ESLint, and the production build check.

Evidence: `ut68-after.log`, `ut68-after-src-summary.json`,
`ut68-after-electron-summary.json`, `ut68-after-worklist.json` and
`ut68-lint.log` under `test-results/unit-coverage/`.

### Previous batch — UT-67

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **79.48% (58,096 / 73,091) → 79.62% (58,195 / 73,091)**,
**+99 net covered lines, +0.14 points**. Another **278 covered lines** are
needed for 80%. No exclusions or thresholds were changed. Renderer + MCP is
**78.72% (50,961 / 64,740)**; Electron is unchanged at **86.62% (7,234 /
8,351)**.

Eight behavioral tests cover renderer startup: crypto, color-note and provider
initialization; window controls and widget menu registration; popup and locale
behavior; error reporting and reload prompts; and missing, found, declined or
already selected data folders. Full instrumentation covers **99 / 107** lines
in `src/others/main.tsx`, up from 0 / 107. All **6,672 renderer/MCP and 849
Electron tests** passed under instrumentation. No application code changed.
The full `npm run lint` gate passed both TypeScript projects, **7,521 ordinary
tests**, Prettier, ESLint, and the production build check.

Evidence: `ut67-after.log`, `ut67-after-src-summary.json`,
`ut67-after-electron-summary.json`, `ut67-after-worklist.json` and
`ut67-lint.log` under `test-results/unit-coverage/`.

### Previous batch — UT-66

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **79.43% (58,057 / 73,091) → 79.48% (58,096 / 73,091)**,
**+39 net covered lines, +0.05 points**. Another **377 covered lines** are
needed for 80%. No exclusions or thresholds were changed. Renderer + MCP is
**78.56% (50,862 / 64,740)**; Electron is unchanged at **86.62% (7,234 /
8,351)**.

Six behavioral tests extend drag transport and foreground property suites.
They check app-document path drags and MIME advertising, a secondary note
payload and malformed-data fallback, invalid plain-text drops, aligned widget
anchors, non-geometric rounding and opacity bounds, and backdrop handling
while blending. Full instrumentation covers **50 / 84** drag-helper lines, up
from 21 / 84, and **86 / 165** property-helper lines, up from 76 / 165. All
**6,664 renderer/MCP and 849 Electron tests** passed under instrumentation.
No application code changed. The full `npm run lint` gate passed both
TypeScript projects, **7,513 ordinary tests**, Prettier, ESLint, and the
production build check.

Evidence: `ut66-after.log`, `ut66-after-src-summary.json`,
`ut66-after-electron-summary.json`, `ut66-after-worklist.json` and
`ut66-lint.log` under `test-results/unit-coverage/`.

### Previous batch — UT-65

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **79.32% (57,975 / 73,091) → 79.43% (58,057 / 73,091)**,
**+82 net covered lines, +0.11 points**. Another **416 covered lines** are
needed for 80%. No exclusions or thresholds were changed. Renderer + MCP is
**78.50% (50,823 / 64,740)**; Electron is unchanged at **86.62% (7,234 /
8,351)**.

Five behavioral tests extend the virtual-display viewer and card suites. The
viewer test checks camera key frames, backpressure, resize and stop behavior
while a host watches. The card tests check rename and resolution settings,
wallpaper file and color, confirmed deletion, and allowing blocked browser and
player clients again. Full instrumentation covers **612 / 751** viewer lines,
up from 569 / 751, and **115 / 145** card lines, up from 76 / 145. All **6,658
renderer/MCP and 849 Electron tests** passed under instrumentation. No
application code changed. The full `npm run lint` gate passed both TypeScript
projects, **7,507 ordinary tests**, Prettier, ESLint, and the production build
check.

Evidence: `ut65-after.log`, `ut65-after-src-summary.json`,
`ut65-after-electron-summary.json`, `ut65-after-worklist.json` and
`ut65-lint.log` under `test-results/unit-coverage/`.

### Previous batch — UT-64

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **79.19% (57,881 / 73,091) → 79.32% (57,975 / 73,091)**,
**+94 net covered lines, +0.13 points**. Another **498 covered lines** are
needed for 80%. No exclusions or thresholds were changed. Renderer + MCP is
**78.38% (50,741 / 64,740)**; Electron is unchanged at **86.62% (7,234 /
8,351)**.

Six behavioral tests cover the floating widget's persisted position and
viewport resizing, collapse and temporary body hiding, full-view toggle,
pointer move and resize persistence, same-pointer release, header double
press and close action. They use the real widget geometry helpers. Full
instrumentation covers **121 / 128** lines in the component, up from
63 / 128, with adjacent geometry helper lines accounting for the rest of the
gain. All **6,653 renderer/MCP and 849 Electron tests** passed under
instrumentation. No application code changed. The full `npm run lint` gate
passed both TypeScript projects, **7,502 ordinary tests**, Prettier, ESLint,
and the production build check.

Evidence: `ut64-after.log`, `ut64-after-src-summary.json`,
`ut64-after-electron-summary.json`, `ut64-after-worklist.json` and
`ut64-lint.log` under `test-results/unit-coverage/`.

### Previous batch — UT-63

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **79.10% (57,818 / 73,091) → 79.19% (57,881 / 73,091)**,
**+63 net covered lines, +0.09 points**. Another **592 covered lines** are
needed for 80%. No exclusions or thresholds were changed. Renderer + MCP is
**78.23% (50,647 / 64,740)**; Electron is unchanged at **86.62% (7,234 /
8,351)**.

Three behavioral tests extend the PowerPoint slide measurement suite. They
check that loose text in a flex container, explicit child blocks, and `<br>`
lines remain separately editable; that two positioned blocks export as two
slide shapes; and that centered and right-aligned text keeps the correct
alignment band. Full instrumentation covers **544 / 613** lines in the
measurer, up from 481 / 613. All **6,647 renderer/MCP and 849 Electron tests**
passed under instrumentation. No application code changed. The full
`npm run lint` gate passed both TypeScript projects, **7,496 ordinary tests**,
Prettier, ESLint, and the production build check.

Evidence: `ut63-after.log`, `ut63-after-src-summary.json`,
`ut63-after-electron-summary.json`, `ut63-after-worklist.json` and
`ut63-lint.log` under `test-results/unit-coverage/`.

### Previous batch — UT-62

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **79.02% (57,753 / 73,091) → 79.10% (57,818 / 73,091)**,
**+65 net covered lines, +0.08 points**. Another **655 covered lines** are
needed for 80%. No exclusions or thresholds were changed. Renderer + MCP is
**78.13% (50,584 / 64,740)**; Electron is unchanged at **86.62% (7,234 /
8,351)**.

Six additional behavioral tests for `appLocalStorage` cover cached misses,
atomic writes and forced reads, removal, directory switching, selected-folder
checks, listing, clearing both settings stores, and error handling. Full
instrumentation covers **123 / 129** lines in that module. All **6,644
renderer/MCP and 849 Electron tests** passed under instrumentation. No
application code changed. The full `npm run lint` gate passed both TypeScript
projects, **7,493 ordinary tests**, Prettier, ESLint, and the production build
check.

Evidence: `ut62-after.log`, `ut62-after-src-summary.json`,
`ut62-after-electron-summary.json`, `ut62-after-worklist.json` and
`ut62-lint.log` under `test-results/unit-coverage/`.

### Previous batch — UT-61

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **78.80% (57,595 / 73,091) → 79.02% (57,753 / 73,091)**,
**+158 net covered lines, +0.22 points**. Another **720 covered lines** are
needed for 80%. No exclusions or thresholds were changed. Renderer + MCP is
**78.03% (50,519 / 64,740)**; Electron is unchanged at **86.62% (7,234 /
8,351)**.

Three file-local suites add ten behavioral tests. Bible Find header tests
cover debounced search, Enter, Escape, refresh, suggestion-menu dismissal and
recent-search persistence. Graph toolbar tests cover relation controls, the
path finder, copy actions, presets and fullscreen. Bible file row tests cover
load and reload, menu actions and typed passage drops. Full instrumentation
covers **52 / 53**, **54 / 57**, and **53 / 53** lines in those previously
untested components. All **6,638 renderer/MCP and 849 Electron tests** passed
under instrumentation. No application code changed. The full `npm run lint`
gate passed both TypeScript projects, **7,487 ordinary tests**, Prettier,
ESLint, and the production build check.

Evidence: `ut61-after.log`, `ut61-after-src-summary.json`,
`ut61-after-electron-summary.json`, `ut61-after-worklist.json` and
`ut61-lint.log` under `test-results/unit-coverage/`.

### Previous batch — UT-60

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **78.53% (57,402 / 73,091) → 78.80% (57,595 / 73,091)**,
**+193 net covered lines, +0.27 points**. Another **878 covered lines** are
needed for 80%. No exclusions or thresholds were changed. Renderer + MCP is
**77.79% (50,361 / 64,740)**, with **71.61% branch** coverage. Electron is
unchanged at **86.62% (7,234 / 8,351)**, with **78.98% branch** coverage.

Three file-local suites add thirteen behavioral tests. Bible view tests cover
scroll synchronization, drag and drop, selected-text and no-passage context
menus, and following matching verses across panes. Note row tests cover
opening, live export, title-edit cancellation and typed drops. Directory
settings tests cover default path creation, existing and missing parent paths,
and link repair. Full instrumentation covers **81 / 84**, **51 / 61**, and
**61 / 66** lines in those previously untested components. All **6,628
renderer/MCP and 849 Electron tests** passed under instrumentation. No
application code changed. The full `npm run lint` gate passed both TypeScript
projects, **7,477 ordinary tests**, Prettier, ESLint, and the production build
check.

Evidence: `ut60-after.log`, `ut60-after-src-summary.json`,
`ut60-after-electron-summary.json`, `ut60-after-worklist.json` and
`ut60-lint.log` under
`test-results/unit-coverage/`.

### Previous batch — UT-59

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **78.33% (57,252 / 73,091) → 78.53% (57,402 / 73,091)**,
**+150 net covered lines, +0.20 points**. Another **1,071 covered lines** are
needed for 80%. No exclusions or thresholds were changed. Renderer + MCP is
**77.49% (50,168 / 64,740)**, with **71.36% branch** coverage. Electron is
**86.62% (7,234 / 8,351)**, with **78.98% branch** coverage.

Nine behavioral tests cover virtual screen output and camera lifecycle, and
pointer resizing, collapsing, reset and context menu actions on the flex
divider. The controller now covers **59 / 59** lines and the divider
**233 / 263**. A failing drag test found that collapse saved the pane's
already zero flex value; the production fix preserves its size from before
the drag so reopening restores the prior width. All **6,615 renderer/MCP and
849 Electron tests** passed under instrumentation. The full `npm run lint`
gate passed both TypeScript projects, **7,464 ordinary tests**, Prettier,
ESLint, and the production build check.

Evidence: `ut59-after.log`, `ut59-after-src-summary.json`,
`ut59-after-electron-summary.json`, `ut59-after-worklist.json` and
`ut59-lint.log` under
`test-results/unit-coverage/`.

### Previous batch — UT-57–58

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **78.08% (57,068 / 73,091) → 78.33% (57,252 / 73,091)**,
**+184 net covered lines, +0.25 points**. Another **1,221 covered lines** are
needed for 80%. No exclusions or thresholds were changed. Renderer + MCP is
**77.35% (50,076 / 64,740)**, with **71.24% branch** coverage. Electron is
unchanged at **85.92% (7,176 / 8,351)**, with **78.53% branch** coverage.

Twelve behavioral tests extend backup and undo coverage for Bible note and
presenting flow editing histories, and add file-local suites for SongSelect
search and location/name detail panels. The backup helper now covers
**251 / 287** lines; SongSelect search covers **62 / 65**; detail panels cover
**69 / 74**. The panel tests assert debounce, stale response handling,
download state, record summaries, verse copy and lookup actions. All
**6,609 renderer/MCP and 846 Electron tests** passed under instrumentation.
The full `npm run lint` gate passed both TypeScript projects, **7,455 ordinary
tests**, Prettier, ESLint, and the production build check. No application
code changed.

Evidence: `ut57-after.log`, `ut58-after.log`, `ut58-after-src-summary.json`,
`ut58-after-electron-summary.json`, `ut58-after-worklist.json` and
`ut58-lint.log` under
`test-results/unit-coverage/`.

### Previous batch — UT-56

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **77.99% (57,002 / 73,091) → 78.08% (57,068 / 73,091)**,
**+66 net covered lines, +0.09 points**. Another **1,405 covered lines** are
needed for 80%. No exclusions or thresholds were changed. Renderer + MCP is
**77.06% (49,892 / 64,740)**, with **70.90% branch** coverage. Electron is
unchanged at **85.92% (7,176 / 8,351)**, with **78.53% branch** coverage.

Seven behavioral tests in `agentBackupHelpers.coverage.test.ts` exercise
restoring overwritten text and binary files, undoing creation and rename,
preserving the replaced version in an undo backup, and rejecting missing or
unwritable backups and oversized binary copies. The helper now covers
**200 / 287** lines. All **6,597 renderer/MCP and 846 Electron tests** passed
under instrumentation. The full `npm run lint` gate passed both TypeScript
projects, **7,443 ordinary tests**, Prettier, ESLint, and the production build
check. No application code changed.

Evidence: `ut56-after.log`, `ut56-after-src-summary.json`,
`ut56-after-electron-summary.json`, `ut56-after-worklist.json` and
`ut56-lint.log` under
`test-results/unit-coverage/`.

### Previous batch — UT-55

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **77.74% (56,822 / 73,091) → 77.99% (57,002 / 73,091)**,
**+180 net covered lines, +0.25 points**. Another **1,471 covered lines** are
needed for 80%. No exclusions or thresholds were changed. Renderer + MCP is
**76.96% (49,826 / 64,740)**, with **70.83% branch** coverage. Electron is
unchanged at **85.92% (7,176 / 8,351)**, with **78.53% branch** coverage.

Three file-local suites add twelve behavioral tests. Note file tests cover
loading, menu actions, confirmation, keyboard opening and typed drops. Drawing
controls tests cover persisted brush parameters, focus-scoped shortcuts,
quality, reset and undo/redo/clear. Bible XML editor tests cover book selection,
identifier validation, chapter merge and failed saves. Full instrumentation
covers **57 / 66** Note file lines, **67 / 68** drawing-control lines and
**56 / 68** Bible XML editor lines, all previously at zero. All **6,590
renderer/MCP and 846 Electron tests** passed under instrumentation. No
application code changed. The full `npm run lint` gate passed both TypeScript
projects, **7,436 ordinary tests**, Prettier, ESLint, and the production build
check.

Evidence: `ut55-after.log`, `ut55-after-src-summary.json`,
`ut55-after-electron-summary.json`, `ut55-after-worklist.json` and
`ut55-lint.log` under `test-results/unit-coverage/`.

### Previous batch — UT-53–54

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **77.53% (56,671 / 73,091) → 77.74% (56,822 / 73,091)**,
**+151 net covered lines, +0.21 points**. Another **1,651 covered lines** are
needed for 80%. No exclusions or thresholds were changed. Renderer + MCP is
**76.68% (49,646 / 64,740)**, with **70.61% branch** coverage. Electron is
unchanged at **85.92% (7,176 / 8,351)**, with **78.53% branch** coverage.

The Note lifecycle suite adds eight behavioral tests for item mutation and
ordering, cross-file moves, default-file creation, and editing-head sync. The
Note editor suite adds three tests for title/content saves and file-event
refresh. Full instrumentation covers **199 / 216** Note lines and **44 / 54**
editor lines, up from 92 / 216 and 0 / 54. All **6,578 renderer/MCP and 846
Electron tests** passed under instrumentation. The full `npm run lint` gate
passed both TypeScript projects, **7,424 ordinary tests**, Prettier, ESLint,
and the production build check. No application code changed.

Evidence: `ut53-after.log`, `ut54-after.log`, `ut54-after-src-summary.json`,
`ut54-after-electron-summary.json`, `ut54-after-worklist.json` and
`ut54-lint.log` under `test-results/unit-coverage/`.

### Previous batch — UT-51–52

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **77.27% (56,481 / 73,091) → 77.53% (56,671 / 73,091)**,
**+190 net covered lines, +0.26 points**. Another **1,802 covered lines** are
needed for 80%. No exclusions or thresholds were changed. Renderer + MCP is
**76.45% (49,495 / 64,740)**, with **70.45% branch** coverage. Electron is
unchanged at **85.92% (7,176 / 8,351)**, with **78.53% branch** coverage.

Three file-local suites add eleven behavioral tests. The Bible text panel
tests check style patches, color/backdrop changes, effect controls, CSS shadow
validation and reset. Foreground decoration tests check folded state,
persistence of border/color/layout values, and media defaults. Transition
tests check inherited values, session overrides, and component dialog choices.
Full instrumentation covers **76 / 82** Bible panel lines, **71 / 71**
decoration lines and **40 / 40** transition lines, all previously at zero.
All **6,567 renderer/MCP and 846 Electron tests** passed under instrumentation.
The full `npm run lint` gate passed both TypeScript projects, **7,413 ordinary
tests**, Prettier, ESLint, and the production build check. No application code
changed.

Evidence: `ut51-after.log`, `ut52-after.log`, `ut52-after-src-summary.json`,
`ut52-after-electron-summary.json`, `ut52-after-worklist.json` and
`ut52-lint.log` under `test-results/unit-coverage/`.

### Previous batch — UT-50

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **77.05% (56,313 / 73,091) → 77.27% (56,481 / 73,091)**,
**+168 net covered lines, +0.22 points**. Another **1,992 covered lines** are
needed for 80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 75.89% (49,137 / 64,740) → 76.15% (49,305 / 64,740) | 70.03% → 70.23%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

Three file-local suites add eleven behavioral tests. Canvas drop tests cover
internal and file data, box targeting, synchronous event capture, unsupported
media, context menus, and viewport geometry. Ruler tests cover scaled ticks,
orientation, pointer guide creation, and unavailable drawing contexts.
Container tests cover centering, guide dragging and removal, sizing, and
keyboard focus. Full instrumentation covers **39 / 39** drop-helper lines,
**67 / 69** ruler lines, and **62 / 69** container lines, all previously at
zero. No application code changed. All **6,556 renderer/MCP and 846 Electron
tests** passed under instrumentation. The full `npm run lint` gate passed both
TypeScript projects, **7,402 ordinary tests**, Prettier, ESLint, and the
production build check.

Evidence: `ut50-after.log`, `ut50-after-src-summary.json`,
`ut50-after-electron-summary.json`, `ut50-after-worklist.json` and
`ut50-lint.log` under `test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-49)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **76.85% (56,170 / 73,091) → 77.05% (56,313 / 73,091)**,
**+143 net covered lines, +0.20 points**. Another **2,160 covered lines** are
needed for 80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 75.67% (48,994 / 64,740) → 75.89% (49,137 / 64,740) | 69.77% → 70.03%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

Four file-local suites add eleven behavioral tests. Background auto-play tests
runnable conditions, URL order, video duration, and scoped timers. The color
picker tests per-screen changes, empty selections, focus restoration, and
closed-screen feedback. Session tests cover setting suffixes, change refusal,
and stopping only the removed show's timer. The media card tests sort order,
virtual grid settings, visible auto-play controls, and empty folders. Full
instrumentation covers **37 / 37** auto-play lines, **42 / 46** color lines,
**35 / 35** session lines, and **29 / 30** media-card lines, all previously at
zero. No application code changed. All **6,545 renderer/MCP and 846 Electron
tests** passed under instrumentation.
The full `npm run lint` gate passed both TypeScript projects, all **7,391
ordinary tests**, Prettier, ESLint, and the production build check.

Evidence: `ut49-after.log`, `ut49-after-src-summary.json`,
`ut49-after-electron-summary.json`, `ut49-after-worklist.json` and
`ut49-lint.log` under `test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-48)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines, then repeated the Electron surface after a three-line variation:
**76.58% (55,976 / 73,091) → 76.85% (56,170 / 73,091)**, **+194 stable
covered lines, +0.27 points**. Another **2,303 covered lines** are needed for
80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 75.37% (48,800 / 64,740) → 75.67% (48,994 / 64,740) | 69.61% → 69.77%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged on repeat         | 78.53%, unchanged       |

Three file-local suites add eleven behavioral tests. The verse painter tests
valid ranges, stale text, mutation repainting, and cleanup. File-drop helpers
test accepted files, folder prompts, file selection, and context-menu actions.
The Finder bar tests debounced and immediate search, focus, results, keyboard
shortcuts, and drag cleanup. Full instrumentation covers **57 / 61** painter
lines, **64 / 65** file-drop lines, and **73 / 73** Finder lines, all previously
at zero. No application code changed. All **6,534 renderer/MCP and 846
Electron tests** passed under instrumentation. The first all-surface run
reported three extra Electron lines in `screenMirrorService.ts`; the isolated
Electron repeat returned to its prior 7,176-line result, which is used above.
The full `npm run lint` gate passed both TypeScript projects, all **7,380
ordinary tests**, Prettier, ESLint, and the production build check.

Evidence: `ut48-after.log`, `ut48-after-src-summary.json`,
`ut48-electron-repeat.log`, `ut48-stable-electron-summary.json`,
`ut48-stable.log`, `ut48-stable-worklist.json` and `ut48-lint.log` under
`test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-47)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **76.42% (55,854 / 73,091) → 76.58% (55,976 / 73,091)**,
**+122 net covered lines, +0.16 points**. Another **2,497 covered lines** are
needed for 80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 75.18% (48,678 / 64,740) → 75.37% (48,800 / 64,740) | 69.48% → 69.61%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

Two file-local suites add eight behavioral tests. Slide auto-play tests stable
countdowns, scoped reconciliation, async delay cancellation, rescheduling,
completion, and error handling. The mirror camera broker tests shared capture
and cleanup, WebRTC candidate ordering, cancellation while capture is pending,
unavailable devices, and intercom relay. Full instrumentation covers **50 /
52** auto-play runner lines and **72 / 73** camera broker lines, both previously
at zero. No application code changed. All **6,523 renderer/MCP and 846
Electron tests** passed under instrumentation.
The full `npm run lint` gate passed both TypeScript projects, all **7,369
ordinary tests**, Prettier, ESLint, and the production build check.

Evidence: `ut47-after.log`, `ut47-after-src-summary.json`,
`ut47-after-electron-summary.json`, `ut47-after-worklist.json` and
`ut47-lint.log` under `test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-46)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **76.21% (55,701 / 73,091) → 76.42% (55,854 / 73,091)**,
**+153 net covered lines, +0.21 points**. Another **2,619 covered lines** are
needed for 80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 74.95% (48,525 / 64,740) → 75.18% (48,678 / 64,740) | 69.27% → 69.48%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

Three file-local suites add ten behavioral tests. The location/name lookup
panel tests loading and error states, separate tab queries, debounce, name-type
filtering, visible results, pagination reset, and clearing. Verse links test
English and translated matches, selection and context-menu behavior, and
unavailable indexes. The virtual-row hook tests visible and pinned rows,
scrolling, all-row mode, row-count changes, and cleanup. Full instrumentation
covers **62 / 64** lookup panel lines, **33 / 33** verse-link lines, and **58 /
64** virtual-row lines, all previously at zero. No application code changed.
All **6,515 renderer/MCP and 846 Electron tests** passed under instrumentation.
The full `npm run lint` gate passed both TypeScript projects, all **7,361
ordinary tests**, Prettier, ESLint, and the production build check.

Evidence: `ut46-after.log`, `ut46-after-src-summary.json`,
`ut46-after-electron-summary.json`, `ut46-after-worklist.json` and
`ut46-lint.log` under `test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-45)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **76.05% (55,583 / 73,091) → 76.21% (55,701 / 73,091)**,
**+118 net covered lines, +0.16 points**. Another **2,772 covered lines** are
needed for 80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 74.77% (48,407 / 64,740) → 74.95% (48,525 / 64,740) | 69.12% → 69.27%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

Two file-local suites add eight behavioral tests. The presenting-flow rename
migration tests discovery, default versus user-chosen folders, file and history
renames, setting-key rewrites, collisions, and failed moves. The note menu tests
the directory setting used to find targets, moving an item, unavailable targets,
confirmation, discard, duplicate, reorder, and nonmutating default-first sort.
Full instrumentation covers **62 / 63** migration lines and **56 / 56** note
helper lines, both previously at zero. No application code changed. All **6,505
renderer/MCP and 846 Electron tests** passed under instrumentation.
The full `npm run lint` gate passed both TypeScript projects, all **7,351
ordinary tests**, Prettier, ESLint, and the production build check.

Evidence: `ut45-after.log`, `ut45-after-src-summary.json`,
`ut45-after-electron-summary.json`, `ut45-after-worklist.json` and
`ut45-lint.log` under `test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-44)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **75.89% (55,469 / 73,091) → 76.05% (55,583 / 73,091)**,
**+114 net covered lines, +0.16 points**. Another **2,890 covered lines** are
needed for 80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 74.59% (48,293 / 64,740) → 74.77% (48,407 / 64,740) | 68.92% → 69.12%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

One file-local suite adds six behavioral tests for presenting-flow floating
widgets: independent files and closure, file deletion, focus-gated stepping,
UUID jumps, loading and error states, collapse controls, and the auto-next
clock. Full instrumentation covers **115 / 141** floating preview lines,
previously at zero; the whole-surface net gain is 114 lines. No application
code changed. All **6,497 renderer/MCP and 846 Electron tests** passed under
instrumentation.
The full `npm run lint` gate passed both TypeScript projects, all **7,343
ordinary tests**, Prettier, ESLint, and the production build check.

Evidence: `ut44-after.log`, `ut44-after-src-summary.json`,
`ut44-after-electron-summary.json`, `ut44-after-worklist.json` and
`ut44-lint.log` under `test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-43)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **75.65% (55,290 / 73,091) → 75.89% (55,469 / 73,091)**,
**+179 covered lines, +0.24 points**. Another **3,004 covered lines** are
needed for 80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 74.31% (48,114 / 64,740) → 74.59% (48,293 / 64,740) | 68.64% → 68.92%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

One file-local suite adds eight behavioral tests for presenting-flow preview
selection, menus, folding, parked entries, screen actions, drag payloads, Bible
and background data, and document slide stepping. Full instrumentation covers
**178 / 198** preview entry lines, previously at zero. No application code
changed. All **6,491 renderer/MCP and 846 Electron tests** passed under
instrumentation.
The full `npm run lint` gate passes with **7,337 ordinary tests**, both
TypeScript projects, Prettier, ESLint and the production build check.

Evidence: `ut43-after.log`, `ut43-after-src-summary.json`,
`ut43-after-electron-summary.json`, `ut43-after-worklist.json` and
`ut43-lint.log` under `test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-42)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **75.46% (55,158 / 73,091) → 75.65% (55,290 / 73,091)**,
**+132 behavioral lines, +0.19 points**. Another **3,183 covered lines** are
needed for 80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 74.11% (47,982 / 64,740) → 74.31% (48,114 / 64,740) | 68.46% → 68.64%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

Two file-local suites add eight behavioral tests for media session persistence,
selection and confirmed removal, plus canvas item styles, identity, edits,
validation and selection contexts. Full instrumentation covers **72 / 73**
media session lines, previously at zero, and **107 / 124** canvas item lines,
up from 47 / 124. No application code changed. All **6,483 renderer/MCP and
846 Electron tests** passed under instrumentation.
The full `npm run lint` gate passes with **7,329 ordinary tests**, both
TypeScript projects, Prettier, ESLint and the production build check.

Evidence: `ut42-after.log`, `ut42-after-src-summary.json`,
`ut42-after-electron-summary.json`, `ut42-after-worklist.json` and
`ut42-lint.log` under `test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-41)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **75.35% (55,076 / 73,091) → 75.46% (55,158 / 73,091)**,
**+82 behavioral lines, +0.11 points**. Another **3,315 covered lines** are
needed for 80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 73.98% (47,900 / 64,740) → 74.11% (47,982 / 64,740) | 68.37% → 68.46%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

One file-local suite adds seven behavioral tests for intercom audio: secure
context gating, speaker volume and packet timestamps, jitter-buffered playback,
decoder failure, microphone encoding and cleanup, late permission, encoder
failure, and stale track-processor frames. Full instrumentation covers
**143 / 145** intercom audio lines, up from 61 / 145. No application code
changed. All **6,475 renderer/MCP and 846 Electron tests** passed under
instrumentation.
The full `npm run lint` gate passes with **7,321 ordinary tests**, both
TypeScript projects, Prettier, ESLint and the production build check.

Evidence: `ut41-after.log`, `ut41-after-src-summary.json`,
`ut41-after-electron-summary.json`, `ut41-after-worklist.json` and
`ut41-lint.log` under `test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-40)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **75.14% (54,920 / 73,091) → 75.35% (55,076 / 73,091)**,
**+156 behavioral lines, +0.21 points**. Another **3,397 covered lines** are
needed for 80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 73.74% (47,744 / 64,740) → 73.98% (47,900 / 64,740) | 68.23% → 68.37%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

One file-local suite adds seven behavioral tests for the virtual-display
compositor: wallpaper and screen-layer updates, guest webview registration,
screen audio, MP4 capture lifecycle and failure, encoder generations, and
microphone teardown. Full instrumentation covers **156 / 162** compositor
entry lines, previously at zero. No application code changed. All **6,468
renderer/MCP and 846 Electron tests** passed under instrumentation.
The full `npm run lint` gate passes with **7,314 ordinary tests**, both
TypeScript projects, Prettier, ESLint and the production build check.

Evidence: `ut40-after.log`, `ut40-after-src-summary.json`,
`ut40-after-electron-summary.json`, `ut40-after-worklist.json` and
`ut40-lint.log` under `test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-39)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **74.92% (54,761 / 73,091) → 75.14% (54,920 / 73,091)**,
**+159 behavioral lines, +0.22 points**. Another **3,553 covered lines** are
needed for 80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 73.50% (47,585 / 64,740) → 73.74% (47,744 / 64,740) | 67.97% → 68.23%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

Two file-local suites add 11 behavioral tests for Screen Mirror hosting,
guest approval and rejection, connection controls, address and QR copying,
router status and firewall guidance. Full instrumentation covers **62 / 65**
network component, **24 / 27** addresses, **39 / 41** firewall notice and
**34 / 34** host connection lines, all previously at zero. No application code
changed. All **6,461 renderer/MCP and 846 Electron tests** passed under
instrumentation.

The full `npm run lint` gate passed: both TypeScript projects, all **7,307**
ordinary tests, repository Prettier, ESLint and the production build check.

Evidence: `ut39-after.log`, `ut39-after-src-summary.json`,
`ut39-after-electron-summary.json`, `ut39-after-worklist.json` and
`ut39-lint.log` under `test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-38)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **74.67% (54,580 / 73,091) → 74.92% (54,761 / 73,091)**,
**+181 behavioral lines, +0.25 points**. Another **3,712 covered lines** are
needed for 80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 73.22% (47,404 / 64,740) → 73.50% (47,585 / 64,740) | 67.64% → 67.97%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

Two file-local suites add 14 behavioral tests for the Screen Mirror guest's
host discovery, address entry, link status, connect/disconnect, intercom and
camera actions, plus QR decoding, image selection and bitmap cleanup. Full
instrumentation covers **153 / 176** guest component and **28 / 28** QR helper
lines, both previously at zero. No application code changed. All **6,450
renderer/MCP and 846 Electron tests** passed under instrumentation.

The full `npm run lint` gate passed: both TypeScript projects, all **7,296**
ordinary tests, repository Prettier, ESLint and the production build check.

Evidence: `ut38-after.log`, `ut38-after-src-summary.json`,
`ut38-after-electron-summary.json`, `ut38-after-worklist.json` and
`ut38-lint.log` under `test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-37)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **74.50% (54,454 / 73,091) → 74.67% (54,580 / 73,091)**,
**+126 behavioral lines, +0.17 points**. Another **3,893 covered lines** are
needed for 80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 73.02% (47,278 / 64,740) → 73.22% (47,404 / 64,740) | 67.50% → 67.64%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

Two file-local suites add 13 behavioral tests for subscriber-counted lookup
index stores and Bible cross-reference cache lifecycles. Full instrumentation
covers **139 / 181** lookup-index helper lines (was 79) and **66 / 82**
cross-reference helper lines (was zero). A new regression exposed a stale-cache
bug: the app accepted cross-references from a different Bible model and omitted
the model stamp on new files. The cache now requires both a fresh timestamp and
a matching model, and writes the model stamp. The regression failed before and
passed after the fix. The development Bible Reader opened and rendered; the
cache-specific path was verified by the regression because no AI cross-reference
data was available in that live session. All **6,436 renderer/MCP and 846
Electron tests** passed under instrumentation.

The full `npm run lint` gate passed: both TypeScript projects, all **7,282**
ordinary tests, repository Prettier, ESLint and the production build check.

Evidence: `ut37-after.log`, `ut37-after-src-summary.json`,
`ut37-after-electron-summary.json`, `ut37-after-worklist.json` and
`ut37-lint.log` under `test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-36)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **74.30% (54,307 / 73,091) → 74.50% (54,454 / 73,091)**,
**+147 behavioral lines, +0.20 points**. Another **4,019 covered lines** are
needed for 80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 72.80% (47,131 / 64,740) → 73.02% (47,278 / 64,740) | 67.35% → 67.50%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

Two file-local suites add 12 behavioral tests for verse-mark creation,
serialization of rapid note-file writes, edits and deletion; and for canvas
controller reuse, item selection, arrow movement, Bible insertion and event
cleanup. Full instrumentation covers **72 / 74** verse-annotation and **75 / 75**
canvas-editing lines, both previously at zero. No application code changed.
All **6,423 renderer/MCP and 846 Electron tests** passed under instrumentation.

The full `npm run lint` gate passed: both TypeScript projects, all **7,269**
ordinary tests, repository Prettier, ESLint and the production build check.

Evidence: `ut36-after.log`, `ut36-after-src-summary.json`,
`ut36-after-electron-summary.json`, `ut36-after-worklist.json` and
`ut36-lint.log` under `test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-35)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **74.04% (54,116 / 73,091) → 74.30% (54,307 / 73,091)**,
**+191 behavioral lines, +0.26 points**. Another **4,166 covered lines** are
needed for 80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 72.50% (46,940 / 64,740) → 72.80% (47,131 / 64,740) | 67.14% → 67.35%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

Four file-local suites add 18 behavioral tests for slide naming and sizing,
ordered pending item-property edits and Save flushing, shadow/blend/rounding
controls, and box sizing and layers. Full instrumentation covers **73 / 78**
slide-property, **46 / 46** item-property, **38 / 38** shape-property and
**34 / 34** box-tool lines, all previously at zero. No application code
changed. All **6,411 renderer/MCP and 846 Electron tests** passed under
instrumentation.

The full `npm run lint` gate passed: both TypeScript projects, all **7,257**
ordinary tests, repository Prettier, ESLint and the production build check.

Evidence: `ut35-after.log`, `ut35-after-src-summary.json`,
`ut35-after-electron-summary.json`, `ut35-after-worklist.json` and
`ut35-lint.log` under `test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-34)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **73.73% (53,893 / 73,091) → 74.04% (54,116 / 73,091)**,
**+223 behavioral lines, +0.31 points**. Another **4,357 covered lines** are
needed for 80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 72.16% (46,717 / 64,740) → 72.50% (46,940 / 64,740) | 66.84% → 67.14%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

Two file-local suites add 17 behavioral tests for the slide editor canvas:
scaling, snap targets, marquee selection and pointer actions; and lazy item
previews, source labels, media cleanup and camera controls. Full
instrumentation covers **113 / 117** canvas-body and **109 / 121** item-preview
lines, both previously at zero. One adjacent line also becomes covered. No
application code changed. All **6,393 renderer/MCP and 846 Electron tests**
passed under instrumentation.

The full `npm run lint` gate passed: both TypeScript projects, all **7,239**
ordinary tests, repository Prettier, ESLint and the production build check.

Evidence: `ut34-after.log`, `ut34-after-src-summary.json`,
`ut34-after-electron-summary.json`, `ut34-after-worklist.json` and
`ut34-lint.log` under
`test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-33)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **73.43% (53,668 / 73,091) → 73.73% (53,893 / 73,091)**,
**+225 behavioral lines, +0.30 points**. Another **4,580 covered lines** are
needed for 80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 71.81% (46,492 / 64,740) → 72.16% (46,717 / 64,740) | 66.57% → 66.84%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

Three file-local suites add 16 behavioral tests for Presenter tabs and
foreground panels; slide loading, refresh, keyboard movement and autoplay; and
previewer focus, menus and media drops. Full instrumentation covers **85 / 88**
Presenter, **88 / 97** slide-list and **52 / 61** slide-previewer lines, all
previously at zero. No application code changed. All **6,376 renderer/MCP and
846 Electron tests** passed under instrumentation.

The full `npm run lint` gate passed: both TypeScript projects, all **7,222**
ordinary tests, repository Prettier, ESLint and the production build check.

Evidence: `ut33-after.log`, `ut33-after-src-summary.json`,
`ut33-after-electron-summary.json`, `ut33-after-worklist.json` and
`ut33-lint.log` under
`test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-32)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **73.27% (53,555 / 73,091) → 73.43% (53,668 / 73,091)**,
**+113 behavioral lines, +0.16 points**. Another **4,805 covered lines** are
needed for 80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 71.63% (46,379 / 64,740) → 71.81% (46,492 / 64,740) | 66.47% → 66.57%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

Two file-local suites add 10 behavioral tests for document printing and
floating-preview state. They check page sizes, escaping, backgrounds, shared
video frames, website screenshot caching and fallback, print failure, and
preview menu/shortcut state. Full instrumentation covers **76 / 79** print
helper and **37 / 37** floating-preview helper lines, both previously at zero.
No application code changed. All **6,360 renderer/MCP and 846 Electron tests**
passed under instrumentation.

The full `npm run lint` gate passed: both TypeScript projects, all **7,206**
ordinary tests, repository Prettier, ESLint and the production build check.

Evidence: `ut32-after.log`, `ut32-after-src-summary.json`,
`ut32-after-electron-summary.json`, `ut32-after-worklist.json` and
`ut32-lint.log` under
`test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-31)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **73.02% (53,372 / 73,091) → 73.27% (53,555 / 73,091)**,
**+183 behavioral lines, +0.25 points**. Another **4,918 covered lines** are
needed for 80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 71.35% (46,196 / 64,740) → 71.63% (46,379 / 64,740) | 66.27% → 66.47%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

Two file-local suites add 14 behavioral tests for the Documents list and file
rows: file type dispatch, imports, URL download cleanup, selection and pin
refusal, rename and reload, document previews, and export/refresh actions.
Full instrumentation covers **92 / 100** list and **91 / 93** file-row lines,
both previously at zero. No application code changed. All **6,350
renderer/MCP and 846 Electron tests** passed under instrumentation.

The full `npm run lint` gate passed: both TypeScript projects, all **7,196**
ordinary tests, repository Prettier, ESLint and the production build check.

Evidence: `ut31-after.log`, `ut31-after-src-summary.json`,
`ut31-after-electron-summary.json`, `ut31-after-worklist.json` and
`ut31-lint.log` under
`test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-30)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **72.86% (53,252 / 73,091) → 73.02% (53,372 / 73,091)**,
**+120 behavioral lines, +0.16 points**. Another **5,101 covered lines** are
needed for 80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 71.17% (46,076 / 64,740) → 71.35% (46,196 / 64,740) | 66.17% → 66.27%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

Three file-local suites add 13 behavioral tests for Bible key selection and
menus, reference input editing and navigation, and book-option availability
and selection. Full instrumentation covers **59 / 61** Bible-key selector,
**44 / 44** input handler and **34 / 35** book-option lines, versus 14 / 61,
0 / 44 and 3 / 35 before. No application code changed. All **6,336
renderer/MCP and 846 Electron tests** passed under instrumentation.

The full `npm run lint` gate passed: both TypeScript projects, all **7,182**
ordinary tests, repository Prettier, ESLint and the production build check.

Evidence: `ut30-after.log`, `ut30-after-src-summary.json`,
`ut30-after-electron-summary.json`, `ut30-after-worklist.json` and
`ut30-lint.log` under
`test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-29)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **72.38% (52,901 / 73,091) → 72.86% (53,252 / 73,091)**,
**+351 behavioral lines, +0.48 points**. Another **5,221 covered lines** are
needed for 80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 70.62% (45,725 / 64,740) → 71.17% (46,076 / 64,740) | 65.89% → 66.17%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

Four file-local suites add 19 behavioral tests for Bible lookup verse-grid
selection by mouse, keyboard and touch; input completion and clearing;
asynchronous result ordering and unavailable-Bible recovery; and history
creation, activation, context menus and removal. Full instrumentation covers
**80 / 89** verse-grid, **41 / 44** verse-tile, **70 / 78** input-action,
**81 / 82** lookup-container and **79 / 85** history lines. No application code
changed. All **6,323 renderer/MCP and 846 Electron tests** passed under
instrumentation.

The full `npm run lint` gate passed: both TypeScript projects, all **7,169**
ordinary tests, repository Prettier, ESLint and the production build check.

Evidence: `ut29-after.log`, `ut29-after-src-summary.json`,
`ut29-after-electron-summary.json`, `ut29-after-worklist.json` and
`ut29-lint.log` under
`test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-28)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **71.99% (52,619 / 73,091) → 72.38% (52,901 / 73,091)**,
**+282 behavioral lines, +0.39 points**. Another **5,572 covered lines** are
needed for 80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 70.19% (45,443 / 64,740) → 70.62% (45,725 / 64,740) | 65.52% → 65.89%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

Three file-local suites add 14 behavioral tests for the color picker, color
swatches and opacity, file-list sorting/filtering/grouping and the containing
list's creation and menu actions. They cover **63 / 81** picker, **60 / 62**
filter-control, **53 / 55** list-container and **41 / 49** list-renderer lines.
The five smaller color controls cover another 58 lines, file-list filter logic
adds six, and the swatch menu context adds one. No application code changed.
All **6,304 renderer/MCP and 846 Electron tests** passed under instrumentation.

The full `npm run lint` gate passed: both TypeScript projects, all **7,150**
ordinary tests, repository Prettier, ESLint and the production build check.

Evidence: `ut28-after.log`, `ut28-after-src-summary.json`,
`ut28-after-electron-summary.json`, `ut28-after-worklist.json` and
`ut28-lint-final.log` under
`test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-27)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **71.73% (52,425 / 73,091) → 71.99% (52,619 / 73,091)**,
**+194 behavioral lines, +0.26 points**. Another **5,854 covered lines** are
needed for 80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 69.89% (45,249 / 64,740) → 70.19% (45,443 / 64,740) | 65.37% → 65.52%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

Two file-local suites add 10 behavioral tests. Monaco editor hook tests cover
model reuse and bounded eviction, clipboard pasting and failure, wrap toggling,
resize debounce and disposal (**88 / 102** lines, up from zero). Markdown
Preview tests cover invalid paths, rendering and font setup, safe link routing,
back navigation, file save watching, reload and read errors (**106 / 110**
lines, up from zero). No application code changed. All **6,290 renderer/MCP
and 846 Electron tests** passed under instrumentation.

The full `npm run lint` gate passed: both TypeScript projects, all **7,136**
ordinary tests, repository Prettier, ESLint and the production build check.

Evidence: `ut27-after.log`, `ut27-after-src-summary.json`,
`ut27-after-electron-summary.json`, `ut27-after-worklist.json` and
`ut27-lint.log` under
`test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-26)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **71.12% (51,984 / 73,091) → 71.73% (52,425 / 73,091)**,
**+441 behavioral lines, +0.60 points**. Another **6,048 covered lines** are
needed for 80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 69.21% (44,808 / 64,740) → 69.89% (45,249 / 64,740) | 64.96% → 65.37%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

Seven file-local suites add 32 behavioral tests for Background web URLs,
slide-show stepping, bounded video-poster caching, the Background panel's tabs
and audio guard, transition menus, background media and slide-audio refresh,
and the shared slide-show control and timer. Full-suite coverage reaches
**55 / 58** URL-helper, **23 / 23** background auto-play, **70 / 74** poster,
**80 / 90** panel, **34 / 40** transition-menu, **46 / 48** background-helper,
and **124 / 137** slide-show-control lines. Twelve adjacent slide-show rule
lines also became covered. No application code changed. All **6,280
renderer/MCP and 846 Electron tests** passed under instrumentation.

The full `npm run lint` gate passed: both TypeScript projects, all **7,126**
ordinary tests, repository Prettier, ESLint and the production build check.

Evidence: `ut26-after.log`, `ut26-after-src-summary.json`,
`ut26-after-electron-summary.json`, `ut26-after-worklist.json` and focused
coverage reports and `ut26-lint.log` under `test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-25)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **70.68% (51,661 / 73,091) → 71.12% (51,984 / 73,091)**,
**+323 behavioral lines, +0.44 points**. Another **6,489 covered lines** are
needed for 80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 68.71% (44,485 / 64,740) → 69.21% (44,808 / 64,740) | 64.56% → 64.96%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

Three file-local suites add 26 behavioral tests. Single-item archive tests
check live content, protected staging, manifest compatibility, folder refusal,
reused-item preservation, picker/URL/drop entry points and cleanup (**100 / 115**
lines). File-operation tests use a temporary directory to check CRUD, MIME
filtering, cross-device moves and partial-copy cleanup, naming, stamps and
checksums (**316 / 423** lines, up from 184). YouTube slide-sync tests check
handshake retries, message trust, playback events, commands and teardown
(**93 / 97** lines, up from three). One adjacent storage helper line also became
covered. No application code changed. All **6,248 renderer/MCP and 846 Electron
tests** passed under instrumentation.

The full `npm run lint` gate passed: both TypeScript projects, all **7,094**
ordinary tests, repository Prettier, ESLint and the production build check.

Evidence: `ut25-after.log`, `ut25-after-src-summary.json`,
`ut25-after-electron-summary.json`, `ut25-after-worklist.json` and focused
coverage reports and `ut25-lint.log` under `test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-24)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **70.39% (51,446 / 73,091) → 70.68% (51,661 / 73,091)**,
**+215 behavioral lines, +0.29 points**. Another **6,812 covered lines** are
needed for 80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 68.38% (44,270 / 64,740) → 68.71% (44,485 / 64,740) | 64.34% → 64.56%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

Ten behavioral tests cover font fallback and canvas metrics, PPTX package
writing and batch failure cleanup, and WebP/SVG rasterization. Full-suite
coverage reaches **129 / 135** font-helper lines, **93 / 99** export-helper
lines, and **481 / 613** slide-measurer lines. No application code changed.
All **6,222 renderer/MCP and 846 Electron tests** passed under instrumentation.
The full `npm run lint` gate passed: both TypeScript projects, all **7,068**
ordinary tests, repository Prettier, ESLint and the production build check.

Evidence: `ut24-after.log`, `ut24-after-src-summary.json`,
`ut24-after-electron-summary.json`, `ut24-after-worklist.json`, and
`ut24-lint.log` under
`test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-23)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **69.86% (51,065 / 73,091) → 70.39% (51,446 / 73,091)**,
**+381 behavioral lines, +0.53 points**. Another **7,027 covered lines** are
needed for 80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 67.79% (43,889 / 64,740) → 68.38% (44,270 / 64,740) | 63.79% → 64.34%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

Four file-local suites add 20 behavioral tests. Presenting Flow action dialogs
check seconds, time of day, shortcuts, screen selection, media playback fields,
and validation through the real inputs (**160 / 176** focused lines). Document
slide rows check loading/error/empty states, screen pins, presentation, parking,
dragging, menus and CC drops (**61 / 78**). Virtual row tests check keyed
measurement, the median estimate, pruning, resize tolerance, and disconnected
rows (**91 / 93**); grid tests check tallest-card geometry, partial rows and
individual measured heights (**69 / 85**). No application code changed. All
**6,212 renderer/MCP and 846 Electron tests** passed under instrumentation.
The full `npm run lint` gate passed: both TypeScript projects, all 7,058
ordinary tests, repository Prettier, ESLint and the production build check.

Evidence: `ut23-after.log`, `ut23-after-src-summary.json`,
`ut23-after-electron-summary.json`, `ut23-after-worklist.json`, and focused
coverage logs and `ut23-lint.log` under `test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-22)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **69.20% (50,578 / 73,091) → 69.86% (51,065 / 73,091)**,
**+487 covered lines, +0.66 points**. Another **7,408 covered lines** are
needed for 80%. No exclusions or thresholds were changed.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 67.04% (43,402 / 64,740) → 67.79% (43,889 / 64,740) | 63.05% → 63.79%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

One file-local help-window suite adds ten tests. It checks folding and
restoring the controls, the question-list disclosure, caution dismissal, tip
navigation and focus, report confirmation, slash-command completion,
`/commands`, locked and unlocked `/clear`, and the single follow-up after a
bad answer rating. Focused instrumentation covers **459 / 1,602** help-window
lines; the full run reaches 28 adjacent helper lines. The initial static
render has specific visible-output assertions; the other nine tests drive
behavior. No application code changed. All **6,192 renderer/MCP and 846
Electron tests** passed under full instrumentation.
The full `npm run lint` gate passed: both TypeScript projects, all 7,038
ordinary tests, repository Prettier, ESLint and the production build check.

Evidence: `ut22-after.log`, `ut22-after-src-summary.json`,
`ut22-after-electron-summary.json`, `ut22-after-worklist.json` and
`ut22-chatbot-cov.log` and `ut22-lint.log` under
`test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-21)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **68.69% (50,203 / 73,091) → 69.20% (50,578 / 73,091)**,
**+375 behavioral lines, +0.51 points**. Another **7,895 covered lines** are
needed for 80%. No smoke-only gain, exclusions or thresholds were added.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 66.46% (43,027 / 64,740) → 67.04% (43,402 / 64,740) | 62.66% → 63.05%         |
| Electron       | 85.92% (7,176 / 8,351), unchanged                   | 78.53%, unchanged       |

Three file-local suites add 14 behavioral tests. Bible Notes verse-index tests
check one scan for references and translation-specific marks, path-scoped save
refresh, and grouped reveal; focused instrumentation covers 129 / 133 lines.
Bible Note item archive tests check embedded-file round-trip, protected naming,
path traversal and missing files, and picker cancellation; focused coverage is
116 / 132. Language tests check locale validation, package caching, text and
number conversion, menu callbacks and reader reuse; focused coverage is
140 / 222, with more lines reached in the full suite. The full run also covers
12 embedded-file helper lines and seven English-package lines.

The language suite found a product bug: `tran(['There are ', ' people'], 3)`
returned `3There are  people`; it now returns `There are 3 people`. The
regression test fails on the old implementation. A scratch-profile Reader
window rendered live after the change; that window does not exercise this
previously unused array interpolation branch, which the unit test verifies.
All 6,182 renderer/MCP and 846 Electron tests passed under instrumentation.
The full `npm run lint` gate passed: both TypeScript projects, all 7,028
ordinary tests, repository Prettier, ESLint and the production build check.

Evidence: `ut21-after.log`, `ut21-after-src-summary.json`,
`ut21-after-electron-summary.json`, `ut21-after-worklist.json`, focused coverage
logs and `ut21-lint.log` under `test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-20)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **68.56% (50,110 / 73,091) → 68.69% (50,203 / 73,091)**,
**+93 behavioral lines, +0.13 points**. Another **8,270 covered lines** are
needed for 80%. No smoke-only gain, exclusions or thresholds were added.

| Surface        | Before → after lines                            | Before → after branches |
| -------------- | ----------------------------------------------- | ----------------------- |
| Renderer + MCP | 66.46% (43,027 / 64,740), unchanged             | 62.66%, unchanged       |
| Electron       | 84.81% (7,083 / 8,351) → 85.92% (7,176 / 8,351) | 77.31% → 78.53%         |

Four behavioral tests extend the existing Screen Mirror and Virtual Display
service suites. They verify screen attachment, ordering, movement and capture;
display commands and IPC trust boundaries; and Screen Mirror presenter settings
with invalid-port rejection. Focused instrumentation covers 639 / 891 Virtual
Display lines and 980 / 1,404 Screen Mirror lines. All 6,168 renderer/MCP and
846 Electron tests passed under full instrumentation. No product code changed.
The full `npm run lint` gate passed: both TypeScript projects, all 7,014 ordinary
tests, repository Prettier, ESLint and the production build check.

Evidence: `ut20-after.log`, `ut20-after-src-summary.json`,
`ut20-after-electron-summary.json`, `ut20-after-worklist.json`, focused coverage
logs and `ut20-lint.log` under `test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-19)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **68.10% (49,775 / 73,091) → 68.56% (50,110 / 73,091)**,
**+335 behavioral lines, +0.46 points**. Another **8,363 covered lines** are
needed for 80%. No smoke-only gain, exclusions or thresholds were added.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 65.94% (42,692 / 64,740) → 66.46% (43,027 / 64,740) | 62.22% → 62.66%         |
| Electron       | 84.81% (7,083 / 8,351), unchanged                   | 77.31%, unchanged       |

Two file-local DOM suites add 12 behavioral tests. Graph tests exercise dock
actions, neighbor expansion and menus, detail and verse links, export actions,
and real pan, node drag, wheel and pinch state changes; focused instrumentation
covers 380 / 467 graph surface lines. Lookup detail tests cover reference links,
localized Bible titles, disclosure rows, name and place lists, and deferred
verse paging; focused instrumentation covers 125 / 136 component lines. The
full run gains 16 more graph engine, viewport and geometry lines. All 6,168
renderer/MCP and 842 Electron tests passed under instrumentation. No product
code changed. The full `npm run lint` gate passed: both TypeScript projects,
all 7,010 ordinary tests, repository Prettier, ESLint and the production build
check.

Evidence: `ut19-after.log`, `ut19-after-src-summary.json`,
`ut19-after-electron-summary.json`, `ut19-after-worklist.json`, both focused
test and coverage logs, `ut19-typecheck.log`, and `ut19-lint.log` under
`test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-18)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **67.65% (49,447 / 73,091) → 68.10% (49,775 / 73,091)**,
**+328 behavioral lines, +0.45 points**. Another **8,698 covered lines** are
needed for 80%. No smoke-only gain, exclusions or thresholds were added.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 65.43% (42,364 / 64,740) → 65.94% (42,692 / 64,740) | 61.89% → 62.22%         |
| Electron       | 84.81% (7,083 / 8,351), unchanged                   | 77.31%, unchanged       |

`src/aichat/AiChatAppComp.test.tsx` adds nine behavioral DOM tests for site
choice and the sandboxed guest, navigation and load errors, browser controls,
tab close/reopen/reorder/lock/move, sign-out success and failure, and
microphone decisions. The real session and provider rules run behind a
file-local Electron boundary. Focused instrumentation covers 301 / 337
executable AI Chat window lines; the full run gains another 27 lines in its
window slot, closed-tabs and provider helpers. All 6,156 renderer/MCP and 842
Electron tests passed under instrumentation. No product code changed.
The full `npm run lint` gate passed: both TypeScript projects, all 6,998
ordinary tests, repository Prettier, ESLint and the production build check.

Evidence: `ut18-after.log`, `ut18-after-src-summary.json`,
`ut18-after-electron-summary.json`, `ut18-after-worklist.json`,
`ut18-aichat-focused.log`, `ut18-aichat-cov.log`, `ut18-typecheck.log`, and
`ut18-lint.log`
under `test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-17)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **67.28% (49,179 / 73,091) → 67.65% (49,447 / 73,091)**,
**+268 behavioral lines, +0.37 points**. Another **9,026 covered lines** are
needed for 80%. No smoke-only gain, exclusions or thresholds were added.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 65.02% (42,096 / 64,740) → 65.43% (42,364 / 64,740) | 61.51% → 61.89%         |
| Electron       | 84.81% (7,083 / 8,351), unchanged                   | 77.31%, unchanged       |

Two file-local suites add 14 behavioral tests. The archive tests check
collection of document media and sidecars, staging, manifest validation,
collision policies, Bible reference merging, imported canvas rewriting and
sidecar restoration; focused instrumentation covers 254 / 280 archive helper
lines. The cross-reference tests check cache and refresh, malformed or
unavailable responses, AI validation, display markers and verse preview
trimming; focused instrumentation covers 89 / 110 lines. All 6,147
renderer/MCP and 842 Electron tests passed under instrumentation. No product
code changed. The full `npm run lint` gate passed: both TypeScript projects,
all 6,989 ordinary tests, repository Prettier, ESLint and the production build
check.

Evidence: `ut17-after.log`, `ut17-after-src-summary.json`,
`ut17-after-electron-summary.json`, `ut17-after-worklist.json`, focused test
and coverage logs, `ut17-typecheck.log`, and `ut17-lint.log` under
`test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-16)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **66.62% (48,693 / 73,091) → 67.28% (49,179 / 73,091)**,
**+486 behavioral lines, +0.66 points**. Another **9,294 covered lines** are
needed for 80%. No smoke-only gain, exclusions or thresholds were added.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 64.27% (41,610 / 64,740) → 65.02% (42,096 / 64,740) | 60.96% → 61.51%         |
| Electron       | 84.81% (7,083 / 8,351), unchanged                   | 77.31%, unchanged       |

Three file-local suites add 22 behavioral tests for Bible Find database,
cache and suggestions; graph source lookup, neighbors and labels; and Bible
book/chapter matching. Focused instrumentation covers 203 / 247 Bible Find
lines, 144 / 148 graph lookup lines and 104 / 123 Bible logic lines. The full
run gained 35 adjacent source lines too. All 6,133 renderer/MCP and 842
Electron tests passed under instrumentation. The full `npm run lint` gate
passed: both TypeScript projects, all 6,975 ordinary tests, repository
Prettier, ESLint and the production build check. No product code changed.

Evidence: `ut16-after.log`, `ut16-after-src-summary.json`,
`ut16-after-electron-summary.json`, `ut16-after-worklist.json`, focused test
and coverage logs, `ut16-typecheck.log`, and `ut16-lint.log` under
`test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-15)

Measured with `coverage-gap.mjs --goal=80` over the same 1,219 files and
73,091 lines: **65.98% (48,222 / 73,091) → 66.62% (48,693 / 73,091)**,
**+471 behavioral lines, +0.64 points**. Another **9,780 covered lines** are
needed for 80%. No smoke-only gain, exclusions or thresholds were added.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 63.54% (41,139 / 64,740) → 64.27% (41,610 / 64,740) | 60.29% → 60.96%         |
| Electron       | 84.81% (7,083 / 8,351), unchanged                   | 77.31%, unchanged       |

`src/ms-office/pptxSlideMeasureHelpers.test.ts` adds 19 behavioral tests for
PowerPoint slide export. A small DOM fixture checks background carryover and
disabled-slide handling; editable shape, text and picture output; wrapped
lines and panel decorations; local, data-URL and web image bytes; video,
canvas and YouTube stills; blurred backgrounds; and cleanup after one item
fails. Focused instrumentation covers 455 / 613 executable measurer lines.
The full run gained 16 adjacent source lines too. All 6,111 renderer/MCP and
842 Electron tests passed under instrumentation. The full `npm run lint` gate
passed: both TypeScript projects, all 6,953 ordinary tests, repository
Prettier, ESLint and the production build check. No product code changed.

Evidence: `ut15-after.log`, `ut15-after-src-summary.json`,
`ut15-after-electron-summary.json`, `ut15-after-worklist.json`,
`ut15-pptx-focused.log`, `ut15-pptx-cov.log`, `ut15-typecheck.log`, and
`ut15-lint.log`
under `test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-14)

Measured with `coverage-gap.mjs --goal=80` across the same 1,219 files and
73,091 lines: **65.54% (47,904 / 73,091) → 65.98% (48,222 / 73,091)**,
**+318 behavioral lines, +0.44 points**. Another **10,251 covered lines** are
needed for 80%. No smoke-only gain, exclusions or thresholds were added.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 63.05% (40,821 / 64,740) → 63.54% (41,139 / 64,740) | 59.74% → 60.29%         |
| Electron       | 84.81% (7,083 / 8,351), unchanged                   | 77.31%, unchanged       |

`tools/owa-devtools-mcp/owaTools.test.mjs` adds 22 tests through a captured
tool registry and file-local app relay mocks. They check help and question
responses, translation fallback, private-path removal in app state, Presenter
targeting, image blocks, source-text preservation, file and note refusal
paths, UI actions and guide state. Focused instrumentation covers 316 / 468
executable registry lines; the full run gained two adjacent source lines too.
The full instrumented suites passed: 6,092 renderer/MCP and 842 Electron
tests. The full `npm run lint` gate passed: both TypeScript projects, all
6,934 ordinary tests, repository Prettier, ESLint and the production build
check. No product code changed in this batch.

Evidence: `ut14-after.log`, `ut14-after-src-summary.json`,
`ut14-after-electron-summary.json`, `ut14-after-worklist.json`,
`ut14-owa-focused.log`, `ut14-owa-cov.log`, and `ut14-lint.log` under
`test-results/unit-coverage/`.

## Active 80% target — 2026-10-14 (UT-13)

Measured with `coverage-gap.mjs --goal=80` across the same 1,219 files and
73,091 lines: **64.32% (47,010 / 73,091) → 65.54% (47,904 / 73,091)**,
**+894 behavioral lines, +1.22 points**. Another **10,569 covered lines** are
needed for 80%. No smoke-render gain, exclusions or thresholds were added.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 61.67% (39,927 / 64,740) → 63.05% (40,821 / 64,740) | 58.53% → 59.74%         |
| Electron       | 84.81% (7,083 / 8,351), unchanged                   | 77.31%, unchanged       |

Eight new file-local test suites added 92 tests, covering the renderer Bible
XML agent (+254 lines), XML JSON editor (+131), MCP Bible XML tool (+130),
Bible XML archive (+91), whole-data archive (+86), Bible XML archive menu
(+73), whole-data archive menu (+67), and Settings archive menu (+61); one
more line in the shared Bible XML advice was reached. Tests assert draft path
restrictions, language and key choices, backup-first installation and removal,
archive manifest/path checks, collision handling, save/reset/debounce behavior,
menu selection, password retries and import cleanup. All 6,070 renderer/MCP
tests passed under instrumentation in 126.63 s; all 842 Electron tests passed
in 20.17 s. No product code changed in this batch.

Evidence: `ut13-before.json`, `ut13-after.json`, their source and Electron
summary snapshots, `ut13-after.log`, eight focused test logs and instrumented
file reports, `ut13-grouped.log`, and `ut13-typecheck.log` under
`test-results/unit-coverage/`. The full `npm run lint` gate passed: both
TypeScript projects, all 6,912 ordinary tests, repository Prettier, ESLint,
and the production build check. See `ut13-lint.log`.

## Active 80% target — 2026-10-14 (UT-12)

Measured with `coverage-gap.mjs --goal=80` over the full source surface:
**63.31% (46,270 / 73,086) → 64.32% (47,010 / 73,091)**. The 38 new
behavioral tests gained **740 covered lines** across the foreground timers,
Messages and media. Five product lines were added to give each new Messages
editor its own stable id; the measured denominator includes them. There are
**11,463 more covered lines** to reach 80%. No smoke-render gain, exclusions or
thresholds were added.

| Surface        | Before → after lines                                | Before → after branches |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 60.53% (39,187 / 64,735) → 61.67% (39,927 / 64,740) | 58.04% → 58.53%         |
| Electron       | 84.81% (7,083 / 8,351), unchanged                   | 77.31%, unchanged       |

The foreground gain is Messages +196 lines, media +187, countdown +146,
clock +121, stopwatch +86, and four lines in related helpers. The instrumented
renderer/MCP suite passed **508 files / 5,978 tests** in 133.39 s, and Electron
passed **65 files / 842 tests** in 20.34 s. The new tests check independent
Messages editors, session changes, removal and re-addition, timer progress,
clock zones, media ownership, dragging, preview delays and autoplay behavior.

**Bug found and fixed:** newly added Messages editors all used the empty id,
so editing the second overwrote the first. The regression failed before the
fix and passes after distinct ids are assigned. In a scratch development
Presenter, the first notice retained its text after a second notice was typed.
W-47, PM-134, the generated manual and the knowledge bundle were updated.
The scratch app was closed after verification. The full `npm run lint` gate
passed: both TypeScript projects, all 6,820 ordinary tests, repository
Prettier, ESLint, and the production build check. See `ut12-lint.log`.

Evidence: `ut12-before.json`, `ut12-after.json`, their source and Electron
summary snapshots, `ut12-after.log`, `ut12-messages-focused.log` (failing
proof), `ut12-messages-fixed.log`, `ut12-media-focused.log`, and the live
verification transcript in the task session, all under
`test-results/unit-coverage/` where applicable.

## Active 80% target — 2026-10-14 (UT-11)

Measured with `coverage-gap.mjs --goal=80`, over the same 1,219 files and
73,086 lines before and after. **62.11% (45,395 / 73,086) → 63.31%
(46,270 / 73,086): +875 behavioural lines, +1.20 points.** No smoke-render
gain, exclusions or thresholds were added. **12,199 more covered lines** are
needed for the user's 80% target; it is still active.

| Surface        | Lines before → after                                | Branches before → after |
| -------------- | --------------------------------------------------- | ----------------------- |
| Renderer + MCP | 59.18% (38,312 / 64,735) → 60.53% (39,187 / 64,735) | 57.02% → 58.04%         |
| Electron       | 84.81% (7,083 / 8,351), unchanged                   | 77.31%, unchanged       |

| Instrumented suite | Before                             | After                              |
| ------------------ | ---------------------------------- | ---------------------------------- |
| Renderer + MCP     | 503 files / 5,868 tests / 172.35 s | 507 files / 5,940 tests / 234.72 s |
| Electron           | 65 files / 842 tests / 26.94 s     | 65 files / 842 tests / 38.85 s     |

72 new tests cover XML conversion/metadata/key selection, box pointer and
resize lifecycles, foreground text/session/timer controls, and the measurement
runner. Main gains: Bible XML conversion +337 lines (98.27%), box controller
+323 (93.38%), foreground text controls +212 (including property chips).
The real XML parser gained another 3 lines. Timings are observed wall clocks;
this machine also ran development verification during the intermediate failed
measurement, so that failed run is not a suite-performance comparison.

The initial measurement failed: an old generated translation bundle broke four
existing tests, and full instrumentation exceeded a screen-manager import's
10-second hook timeout. Rebuilding the knowledge and raising only measurement
hook timeouts restored the baseline. An intermediate run exposed a timer leak
in the new harness; every test now uses fake timers with teardown. All 72 cases
pass shuffled, and the foreground harness passes instrumented.

**Bug found and fixed:** the measurement script ignored unsuccessful child
exit status and could accept a stale report. Three regression tests prove it
now refuses unsuccessful launches even with an existing summary. No product
bug was confirmed. A scratch development Presenter screenshot confirmed Quick
Text and its Delay, Live, Save and Saved controls rendered; that instance was
closed after verification. Both TypeScript projects and changed-file Prettier
checks pass. **The full `npm run lint` gate passes:** both typechecks, all
6,782 tests, repository Prettier, ESLint and the production build check.
Uninstrumented suite wall clock was 141.51 s + 18.76 s = 160.27 s.

Evidence lives under `test-results/unit-coverage/`: the paired baseline summary
files, `baseline-80-2026-10-14.json`, `after-batch-80-verified.log`,
`batch-shuffled.log`, `fg-instrumented.log`, `lint-80-batch.log` and the full
`worklist.json`.

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

| Surface           | Before                       | After                        | Branches before → after       |
| ----------------- | ---------------------------- | ---------------------------- | ----------------------------- |
| **Whole surface** | **54.04% (29 195 / 54 021)** | **54.33% (29 359 / 54 036)** | See per-project figures below |
| `src/**` + MCP    | 51.73% (26 561 / 51 341)     | 52.00% (26 705 / 51 356)     | 49.83% → 50.11%               |
| `electron/**`     | 98.28% (2 634 / 2 680)       | **99.03% (2 654 / 2 680)**   | 91.33% → 93.08%               |

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

| Instrumented suite         | Before                             | After                              |
| -------------------------- | ---------------------------------- | ---------------------------------- |
| Renderer + MCP             | 334 files / 3 980 tests / 113.05 s | 335 files / 4 025 tests / 109.20 s |
| Electron                   | 40 files / 445 tests / 14.11 s     | 40 files / 463 tests / 16.27 s     |
| Combined Vitest wall clock | 127.16 s                           | 125.47 s                           |

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

| Surface        | Lines                                      | Branches                   | Test result                                                                               | Wall clock                        |
| -------------- | ------------------------------------------ | -------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------- |
| `src/**` + MCP | **Unavailable: failed run**                | Unavailable                | 332 files passed, 2 failed; 3 973 tests passed, 1 failed, plus one suite failed at import | 69.72 s Vitest / 71 s measurement |
| `electron/**`  | **98.28% (2 634 / 2 680)** across 48 files | **91.33% (1 202 / 1 316)** | 40 files, 445 tests passed                                                                | 8.66 s Vitest / 10 s measurement  |

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

|                                                      | Lines                        | Statements | Branches | Functions |
| ---------------------------------------------------- | ---------------------------- | ---------- | -------- | --------- |
| **Honest — whole surface, 986 files**                | **48.17%** (25 395 / 52 715) | —          | —        | —         |
| `npm run test:coverage` (src only, 526 loaded files) | 78.28%                       | 78.31%     | 71.50%   | 78.97%    |
| `npm run test:electron:coverage` (35 loaded files)   | 84.29%                       | 84.35%     | 72.26%   | 81.71%    |

The 78% and the 84% are **coverage of the files the tests happened to import**.
Vitest's v8 provider measures only loaded files unless `coverage.include` is
given, and neither committed config gives one. 460 source files never enter
that denominator at all, so deleting a test that loads a big untested file
_raises_ the reported figure.

Everything in this skill is stated against the honest denominator.

```text
986 files · 52 715 lines · 25 395 covered
502 files at 0%          173 files at 100%
to 99%: 26 793 more covered lines
```

## Where the gap is

| Kind                                           | Files | Lines  | Covered   | The shape of the work                                              |
| ---------------------------------------------- | ----- | ------ | --------- | ------------------------------------------------------------------ |
| `module` (classes, controllers, `tools/*.mjs`) | 200   | 15 025 | **70.0%** | Best-covered; the remainder is error paths and rare branches       |
| `helper` (`*Helpers.ts`)                       | 352   | 23 503 | **57.3%** | The biggest absolute gap, and pure logic — the real wins live here |
| `component` (`*Comp.tsx`)                      | 415   | 13 901 | **10.1%** | The biggest structural hole; needs batched smoke harnesses         |
| `entry` (`src/*.tsx`, `boot.ts`)               | 19    | 286    | **0%**    | See _Exclusions_ — decide with the user                            |

### The ten biggest single files

| Uncovered | Lines | Now | File                                                   |
| --------- | ----- | --- | ------------------------------------------------------ |
| 1 142     | 1 142 | 0%  | `src/chatbot/ChatbotAppComp.tsx`                       |
| 613       | 613   | 0%  | `src/ms-office/pptxSlideMeasureHelpers.ts`             |
| 408       | 408   | 0%  | `src/graph-view/GraphSurfaceComp.tsx`                  |
| 372       | 372   | 0%  | `tools/owa-devtools-mcp/owaTools.mjs`                  |
| 349       | 393   | 11% | `src/slide-editor/BoxEditorController.ts`              |
| 338       | 342   | 1%  | `src/setting/bible-setting/bibleXMLJsonDataHelpers.ts` |
| 309       | 309   | 0%  | `src/presenting-flow/PresentingFlowItem.ts`            |
| 260       | 260   | 0%  | `src/presenting-flow/PresentingFlow.ts`                |
| 248       | 248   | 0%  | `src/bible-find/BibleFindController.tsx`               |
| 241       | 410   | 41% | `src/server/fileHelpers.ts`                            |

### The folder-sized holes

`src/presenting-flow` — **29 files, 2 527 lines, 0.44% covered, 28 files at
exactly 0%**. This is not neglect: the _entire_ presenting-flow suite (12 test
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

| Excluded                                                  | Why                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------------ |
| `**/*.test.*`, `**/*.spec.*`                              | The tests themselves                                                     |
| `src/test-setup/**`                                       | Test infrastructure                                                      |
| `src/vite-env.d.ts`                                       | Type declarations, no runtime                                            |
| `src/experiments/**`                                      | Build-excluded dev scratch harness (memory `experiments-html-in-canvas`) |
| `electron/testElectronModule.ts`, `electron/testUtils.ts` | Test infrastructure                                                      |

**Undecided, worth ~286 lines:** the 19 renderer entry files (`src/about.tsx`,
`src/aichat.tsx`, `src/chatbot.tsx`, `src/boot.ts`, `src/others/main.tsx` …).
They are `createRoot(...).render(...)` and little else; a test can only prove
them by mocking the render away, which proves nothing. Put the choice to the
user rather than quietly excluding them — and while they are in, they are in
the denominator and count against 99%.

Adding an exclusion is a decision, not a cleanup: it moves the goalposts.

## What it costs to measure

| Run                         | Wall clock | Note                               |
| --------------------------- | ---------- | ---------------------------------- |
| `npm test` (no coverage)    | ~55 s      | 293 files, 3 683 tests             |
| `npm run test:electron`     | ~9 s       | 30 files, 339 tests                |
| `coverage-gap.mjs` src      | **~124 s** | full instrumentation, ~2.5× slower |
| `coverage-gap.mjs` electron | **~33 s**  |                                    |

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

| Rung                    | State                                                                            |
| ----------------------- | -------------------------------------------------------------------------------- |
| **1 — measured**        | The honest number is known and reproducible. **← here**                          |
| **2 — no dark folders** | No folder sits under 20%; `presenting-flow`'s 0.44% is gone                      |
| **3 — logic covered**   | Every `*Helpers.ts` and controller ≥ 90%; components may still be smoke-only     |
| **4 — components real** | Components ≥ 90%, and the behavioural half is behavioural                        |
| **5 — branches too**    | Branch coverage within 5 points of line coverage — error paths are actually run  |
| **6 — locked**          | ≥ 99% lines with a committed `coverage.thresholds` that fails the gate on a fall |

Rung 6 without rung 5 is a number, not a test suite: line coverage rises with
smoke renders while every `catch` in the app stays unrun. Branch coverage is
what says the error paths were entered, so it is reported beside lines in every
run.
