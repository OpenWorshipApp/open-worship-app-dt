# Plan — `UT-xx` batches toward 99%

Ranked by **uncovered lines per hour of work**, which is not the same as by
file size: a folder whose files share one domain needs one mock surface, so
2 500 lines there cost less than 800 spread over five unrelated folders.

Status is `open` · `in progress` · `done (before → after)`. A batch is done
when `coverage-gap.mjs` says so, not when the tests are written.

## Achieved target — 95%, 2026-10-29

The user set the goal at **95% of the whole source surface**. Met:
**95.25% (79,188 / 83,141)**, 204 lines above the threshold, on the same
1,292-file denominator; exclusions and thresholds unchanged. See the baseline
for every number and the evidence files.

### UT-70 · parallel slices across the whole surface

`done` · predicted +11,305 needed; actual **+11,509 lines, +13.85 points**
(81.40% → 95.25%). 21 disjoint slices by folder in the coordinator's
scratchpad; 17 ran as subagents on one shared brief, the coordinator took the
renderer entries and several small folders. 3,626 new tests (renderer + MCP
8,233 → 11,587; Electron 942 → 1,214), all asserting; 11 of 404 files are
static-render only. One bug fixed (`toFileTypeName` on an extensionless
file), three reported. The run hit the account usage limit with every agent
mid-slice; the lessons are in memory `parallel-test-agent-coverage-run`.

### Remaining toward 99% (3,953 uncovered; 99% needs 3,122 more)

The four slices that never started hold most of the 0% files left:

| Slice | Scope | Notes |
| --- | --- | --- |
| S16 | `graph-view`, `location-name-lookup`, `bible-lookup` | `lookupIndexFileHelpers` 42 left |
| S17 | `presenting-flow`, `virtual-display`, `screen-mirror`, `lwShare`, `virtual-display-viewer.ts` | `ServerControllerComp` and `VirtualDisplaysComp` still 0%; viewer 85 left |
| S18 | `resize-actor`, `lang`, `server`, `virtual-list`, `toast`, `app-modal` | `langHelpers` 66, `fileHelpers` 57, `useRevealPin` 0% |
| S19 | `ms-office`, `aichat`, `plugins`, `resources`, `context-menu` … | mostly residual branches |

Then the long tail: 600+ files with a handful of uncovered lines each,
nearly all error paths — the branch work `UT-08` names. Run at most ~8
agents at once (CPU and usage limit), and re-slice from a fresh `worklist.json`.

## Achieved target — 80%, 2026-10-15

The user authorized continued testing to **80% of the whole source surface**.
The target is met: **80.01% (58,478 / 73,091)**, five lines above the 80%
threshold. Renderer + MCP is 79.15%, Electron 86.62%. The source denominator
is unchanged from UT-12; exclusions and thresholds are unchanged. The
historical 99% ladder remains a longer-term proposal.

### UT-69 · scrolling, keyboard controls and lyric stages

`done` · actual **+147 behavioral lines, +0.20 points**, crossing the 80%
whole-source goal. Three virtual-list tests cover shared scroll observers and
the timeout fallback. Four keyboard tests cover slide and canvas actions.
Five lyric-stage tests cover font options, slide creation and lookup. Full
instrumentation covers 89 / 103 virtual-scroll, 93 / 101 keyboard-handler and
80 / 103 lyric-stage lines, up from 46 / 103, 44 / 101 and 25 / 103. It passed
6,693 renderer/MCP and 849 Electron tests. The full lint gate passed with
7,542 ordinary tests; see the baseline for evidence.

### UT-68 · run-sheet state, navigation tabs and mirror camera transport

`done` · actual **+136 behavioral lines, +0.19 points**. Five run-sheet tests
cover cursor and next-step summaries, missing and available sheets. Three
router tests cover visible tabs and external windows. One mirror camera test
covers signaling, release, failure, timeout and unload. Full instrumentation
covers 92 / 98 run-sheet, 66 / 111 router and 57 / 60 camera transport lines,
up from 32 / 98, 42 / 111 and 5 / 60. It passed 6,681 renderer/MCP and 849
Electron tests. The full lint gate passed with 7,530 ordinary tests; see the
baseline for evidence.

### UT-67 · renderer startup and data-directory recovery

`done` · actual **+99 behavioral lines, +0.14 points**. Eight tests cover
initialization order, main-window controls, popup and locale behavior, error
prompts, and the data-directory recovery choices. Full instrumentation covers
99 / 107 `src/others/main.tsx` lines, up from zero. It passed 6,672
renderer/MCP and 849 Electron tests. The full lint gate passed with 7,521
ordinary tests; see the baseline for evidence.

### UT-66 · drag payload transport and foreground properties

`done` · actual **+39 behavioral lines, +0.05 points**. Three drag tests cover
app-document path payloads, secondary note payloads and invalid input. Three
foreground property tests cover alignment, rounding, opacity and blending.
Full instrumentation covers 50 / 84 drag-helper and 86 / 165 property-helper
lines, up from 21 / 84 and 76 / 165. It passed 6,664 renderer/MCP and 849
Electron tests. The full lint gate passed with 7,513 ordinary tests; see the
baseline for evidence.

### UT-65 · virtual-display viewer camera and display card

`done` · actual **+82 behavioral lines, +0.11 points**. One viewer test covers
camera encoding while watched, key frames, backpressure, resize and stop. Four
card tests cover settings, wallpaper, confirmed deletion and blocked clients.
Full instrumentation covers 612 / 751 viewer and 115 / 145 card lines, up from
569 / 751 and 76 / 145 respectively. It passed 6,658 renderer/MCP and 849
Electron tests. The full lint gate passed with 7,507 ordinary tests; see the
baseline for evidence.

### UT-64 · floating widget behavior and persistence

`done` · actual **+94 behavioral lines, +0.13 points**. Six tests cover
persisted position and viewport clamping, collapse and body hiding, full view,
pointer move and resize persistence, same-pointer release, header double press
and close. The component now covers 121 / 128 lines, up from 63 / 128. Full
instrumentation passed 6,653 renderer/MCP and 849 Electron tests. The full
lint gate passed with 7,502 ordinary tests; see the baseline for evidence.

### UT-63 · editable text in PowerPoint slide export

`done` · actual **+63 behavioral lines, +0.09 points**. Three tests extend the
PowerPoint measurer suite for flex text runs, separately editable positioned
shapes, and centered/right alignment bands. Full instrumentation covers
544 / 613 measurer lines, up from 481 / 613. It passed 6,647 renderer/MCP and
849 Electron tests. The full lint gate passed with 7,496 ordinary tests; see
the baseline for evidence.

### UT-62 · local settings storage lifecycle

`done` · actual **+65 behavioral lines, +0.08 points**. Six tests extend the
file-local storage suite for cached misses, writes and forced reads, removal,
folder switching, listing, clearing and error handling. Full instrumentation
covers 123 / 129 lines in `appLocalStorage`. It passed 6,644 renderer/MCP and
849 Electron tests. The full lint gate passed with 7,493 ordinary tests; see
the baseline for evidence.

### UT-61 · Bible Find header, graph toolbar and Bible file row

`done` · actual **+158 behavioral lines, +0.22 points**. Ten tests in three
file-local suites exercise search debounce and keys, graph relation and export
controls, presets, fullscreen, and Bible row load, menu and drop behavior.
Full instrumentation covers 52 / 53 Bible Find header lines, 54 / 57 graph
toolbar lines and 53 / 53 Bible file row lines. It passed 6,638 renderer/MCP
and 849 Electron tests. The full lint gate passed with 7,487 ordinary tests;
see the baseline for evidence.

### UT-60 · Bible view, note row and directory settings

`done` · actual **+193 behavioral lines, +0.27 points**. Thirteen tests in
three file-local suites cover Bible view scroll, drag, context menu and lookup
behavior; note row opening, editing, export and drops; and directory setup and
link repair. Full instrumentation covers 81 / 84 Bible view lines, 51 / 61
note row lines and 61 / 66 directory settings lines. It passed 6,628
renderer/MCP and 849 Electron tests. The full lint gate passed with 7,477
ordinary tests; see the baseline for evidence.

### UT-59 · virtual screen lifecycle and divider drag behavior

`done` · actual **+150 behavioral lines, +0.20 points**. Three Electron tests
exercise guest and WebSocket delivery, camera labels, and controller shutdown;
six divider tests exercise drag, collapse, reset, context menu and media
protection. The drag tests found and fixed loss of a pane's saved flex size
when collapsed by pointer. The controller covers 59 / 59 lines and the
divider 233 / 263. Full instrumentation passed 6,615 renderer/MCP and 849
Electron tests. The full lint gate passed with 7,464 ordinary tests; see the
baseline for evidence.

### UT-57–58 · note and flow undo, SongSelect search, lookup detail panels

`done` · actual **+184 behavioral lines, +0.25 points**. Five backup tests
cover note and presenting flow history and delete cleanup. Four SongSelect
tests cover search debounce, stale responses, errors, paging and imports.
Three lookup detail tests cover loading, record and verse copies, locale
selection and opening a verse. The tested files cover 251 / 287, 62 / 65,
and 69 / 74 lines respectively. Full instrumentation passed 6,609
renderer/MCP and 846 Electron tests. The full lint gate passed with 7,455
ordinary tests; see the baseline for evidence.

### UT-56 · backup restore lifecycle

`done` · actual **+66 behavioral lines, +0.09 points**. Seven file-local
tests exercise text and binary restore, undoing creation and rename, retaining
the overwritten version for another undo, and backup failure paths. The
backup helper is now 200 / 287 lines covered. Full instrumentation passed
6,597 renderer/MCP and 846 Electron tests. The full lint gate passed with
7,443 ordinary tests; see the baseline for evidence.

### UT-11 · restore measurement and expand behavioral coverage

`done` · actual **+875 behavioral lines, +1.20 points**; a numeric forecast was
not recorded before this batch. The remaining batches below carry estimates.

| Test file / scope                                           | Tests added | Covered-line gain                                                              |
| ----------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------ |
| `src/setting/bible-setting/bibleXMLJsonDataHelpers.test.ts` | 20          | +337 in converter; +3 in real XML parser                                       |
| `src/slide-editor/BoxEditorController.test.ts`              | 29          | +323                                                                           |
| `src/presenter-foreground/textControls.coverage.test.tsx`   | 20          | +212 across marquee, quick text, saved text, timer controls and property chips |
| `src/test-setup/coverageGapRunner.test.ts`                  | 3           | Measurement safety; excluded infrastructure                                    |

Mock surfaces stay file-local. XML parsing/serialization, box geometry and
pointer events, foreground debounce timers and property chips run for real.
The foreground harness checks dynamic labels against both source dictionaries.
No application provider mock is shared. There is no smoke-only gain.
The measurement runner now rejects unsuccessful launches with stale reports;
only its full-instrumentation hook timeout changed. See baseline and recipes
for the generated-bundle and timer-leak repairs. No product behavior changed.
The full lint gate passes (6,782 tests); live Quick Text rendering was verified
in a scratch development profile.

### UT-12 · foreground timers, Messages and media

`done` · actual **+740 behavioral lines, +1.01 points**, versus the predicted
+700–1,000. Added 23 tests to `textControls.coverage.test.tsx` and 15 to
`mediaControls.coverage.test.tsx`. All 5,978 renderer/MCP and 842 Electron
tests pass under full instrumentation; each file's mocks stay local, and the
foreground text harness still validates its dynamic labels against the real
Khmer and French dictionaries. The product fix gives newly added Messages
editors unique ids; the failing regression and live scratch Presenter both
showed why. See baseline for exact deltas and evidence. The full `npm run lint`
gate passes with 6,820 tests.

### UT-13 · Bible XML and archive lifecycles

`done` · actual **+894 behavioral lines, +1.22 points**, against a +900–1,200
estimate. Eight file-local suites added 92 tests for the app and MCP halves of
Bible XML importing, XML editor state, Bible XML and whole-data archives, and
their three settings menus. Full instrumentation passes: 6,070 renderer/MCP
tests and 842 Electron tests. No product behavior changed. See baseline for
file deltas and evidence. The full `npm run lint` gate passes with 6,912 tests.

### UT-14 · MCP registry handlers

`done` · actual **+318 behavioral lines, +0.44 points**. One file-local suite
adds 22 tests that invoke registered handlers with an isolated app relay.
They cover public response shapes and safety decisions for help, questions,
translations, app state, screens, files, notes, UI actions and guides. Focused
instrumentation covers 316 of 468 registry lines; two adjacent lines also
became covered in the full run. All 6,092 renderer/MCP and 842 Electron tests
pass under instrumentation; the full `npm run lint` gate passes with 6,934
tests. No product behavior changed. See baseline for
the measured delta and evidence.

### UT-15 · PowerPoint slide measurement

`done` · actual **+471 behavioral lines, +0.64 points**. One file-local DOM
suite adds 19 tests for background carryover, editable shape and text layout,
image and video bytes, canvas and YouTube pictures, blurred backgrounds and
item-level failure recovery. Focused instrumentation covers 455 of 613
measurer lines, with 16 adjacent lines gained in the full run. All 6,111
renderer/MCP and 842 Electron tests pass under instrumentation; the full
`npm run lint` gate passes with 6,953 tests. No product behavior changed. See
baseline for the measured delta and evidence.

### UT-16 · Bible Find, graph lookup and Bible book matching

`done` · actual **+486 behavioral lines, +0.66 points**. Three file-local
suites add 22 tests for Bible Find database, cache and suggestions; graph
source lookup, neighbors and labels; and Bible book/chapter matching. Focused
instrumentation covers 203 / 247, 144 / 148 and 104 / 123 source lines,
respectively, with 35 adjacent lines gained in the full run. All 6,133
renderer/MCP and 842 Electron tests pass under instrumentation. No product
behavior changed. The full `npm run lint` gate passes with 6,975 tests. See
baseline for the measured delta and evidence.

### UT-17 · Archive helpers and Bible cross references

`done` · actual **+268 behavioral lines, +0.37 points**. Two file-local suites
add 14 tests for document media and sidecar collection, archive manifest and
staging behavior, Bible list merge and collision handling, imported canvas
rewriting, cross-reference caching and response validation, display markers
and preview trimming. Focused instrumentation covers 254 / 280 archive helper
lines and 89 / 110 cross-reference lines. All 6,147 renderer/MCP and 842
Electron tests pass under instrumentation. No product behavior changed. See
baseline for the measured delta and evidence. The full `npm run lint` gate
passes with 6,989 tests.

### UT-18 · AI Chat window interactions

`done` · actual **+328 behavioral lines, +0.45 points**. One file-local DOM
suite adds nine tests for site selection and guest attributes, navigation,
load errors, tab lifecycles, sign-out and microphone decisions. The real
session and provider rules run behind a mocked Electron boundary. Focused
instrumentation covers 301 / 337 AI Chat component lines, with 27 adjacent
helper lines gained in the full run. All 6,156 renderer/MCP and 842 Electron
tests pass under instrumentation. No product behavior changed. See baseline
for the measured delta and evidence. The full `npm run lint` gate passes with
6,998 tests.

### UT-19 · Graph surface and lookup detail UI

`done` · actual **+335 behavioral lines, +0.46 points**. Two file-local DOM
suites add 12 tests for graph navigation, expansion, menus, export, lookup
reference links, localization and deferred verse paging. Focused
instrumentation covers 380 / 467 graph surface and 125 / 136 lookup detail
lines; the full run also gains 16 graph engine, viewport and geometry lines.
All 6,168 renderer/MCP and 842 Electron tests pass under instrumentation. No
product behavior changed. The full `npm run lint` gate passes with 7,010
tests. See baseline for the measured delta and evidence.

### UT-20 · Virtual Display and Screen Mirror service behavior

`done` · actual **+93 behavioral lines, +0.13 points**. Four tests extend two
existing Electron service suites for screen attachment, movement and capture;
display command state; IPC trust checks; and presenter connection settings with
invalid-port rejection. Focused instrumentation covers 639 / 891 Virtual
Display and 980 / 1,404 Screen Mirror lines. All 6,168 renderer/MCP and 846
Electron tests pass under instrumentation. No product behavior changed. See
baseline for the measured delta and evidence. The full `npm run lint` gate
passes with 7,014 tests.

### UT-21 · Bible Notes verse index, item archive and language helpers

`done` · actual **+375 behavioral lines, +0.51 points**. Three file-local
suites add 14 tests for verse-to-note and translation-scoped mark indexes,
path-scoped refresh and reveal; note-item archive export/import with embedded
files and protected naming; locale data, word/number conversion, menu routing
and reader reuse. Focused instrumentation covers 129 / 133 verse-index,
116 / 132 archive and 140 / 222 language-helper lines. A translation
interpolation regression was found and fixed. All 6,182 renderer/MCP and 846
Electron tests pass under instrumentation. See baseline for evidence and the
scratch-profile live check. The full `npm run lint` gate passes with 7,028
tests.

### UT-22 · Help-window controls, commands and answer feedback

`done` · actual **+487 covered lines, +0.66 points**. One file-local DOM suite
adds ten tests for the help-window header, questions, caution, tips, report
confirmation, command completion and execution, protected chat clearing, and
answer ratings. Focused instrumentation covers 459 / 1,602 component lines;
28 adjacent helper lines are gained in the full run. The first test asserts
visible output from a static render; nine tests drive user actions. All 6,192
renderer/MCP and 846 Electron tests pass under full instrumentation. No
product behavior changed. The full `npm run lint` gate passes with 7,038
ordinary tests. See baseline for the exact delta and evidence.

### UT-23 · Presenting Flow dialogs and document rows; virtual-grid geometry

`done` · actual **+381 behavioral lines, +0.53 points**. Four file-local suites
add 20 tests for timing, shortcut, screen and media dialogs; document slide
states and actions; keyed virtual-row measurements; and grid row layout.
Focused instrumentation covers 160 / 176 dialog, 61 / 78 slide-row, 91 / 93
measurement and 69 / 85 grid lines. The full run gains exactly those 381
lines. All 6,212 renderer/MCP and 846 Electron tests pass under
instrumentation. No product behavior changed. The full `npm run lint` gate
passes with 7,058 ordinary tests. See baseline for evidence.

### UT-24 · PowerPoint font fallback and export

`done` · actual **+215 behavioral lines, +0.29 points**. Two new file-local
suites and two added slide-measurer tests cover font fallback and metrics,
PowerPoint package creation, shared media, batch export, partial-file cleanup,
and WebP/SVG rasterization. Full instrumentation covers 129 / 135 font-helper,
93 / 99 export-helper and 481 / 613 slide-measurer lines. All 6,222
renderer/MCP and 846 Electron tests pass under instrumentation. No product
behavior changed. The full `npm run lint` gate passes with 7,068 ordinary
tests. See baseline for exact deltas and evidence.

### UT-25 · Single-item archives, filesystem operations and YouTube sync

`done` · actual **+323 behavioral lines, +0.44 points**. Three file-local
suites add 26 tests for archive export/import and cleanup, filesystem
operations on temporary files including cross-device failure recovery, and
YouTube player handshake, trust and playback commands. Full instrumentation
covers 100 / 115 archive, 316 / 423 file-helper and 93 / 97 YouTube-sync lines,
plus one storage-helper line. All 6,248 renderer/MCP and 846 Electron tests
pass under instrumentation. No product behavior changed. See baseline for
exact deltas and evidence. The full `npm run lint` gate passes with 7,094
ordinary tests.

### UT-26 · Background URLs, slide shows and poster cache

`done` · actual **+441 behavioral lines, +0.60 points**. Seven file-local
suites add 32 tests for saved web URLs, background grid stepping, video-poster
cache and worker bounds, the Background panel and transition menus, background
layer and slide-audio refresh, and the shared slide-show toolbar/timer. Full
instrumentation reaches 55 / 58, 23 / 23, 70 / 74, 80 / 90, 34 / 40, 46 / 48
and 124 / 137 lines in those files, plus 12 slide-show rule lines. All 6,280
renderer/MCP and 846 Electron tests pass under instrumentation. No product
behavior changed. The full `npm run lint` gate passes with 7,126 ordinary
tests. See baseline for exact deltas and evidence.

### UT-27 · Monaco editor and Markdown Preview

`done` · actual **+194 behavioral lines, +0.26 points**. Two file-local
suites add 10 tests for Monaco's editor and model lifecycle, clipboard,
wrapping and resize, plus Markdown Preview's safe link navigation, file
watching, reload and read errors. Full instrumentation covers **88 / 102**
Monaco lines and **106 / 110** Markdown Preview lines. All 6,290 renderer/MCP
and 846 Electron tests pass under instrumentation. No application code
changed. The full `npm run lint` gate passes with 7,136 ordinary tests.
See baseline for exact deltas and evidence.

### UT-28 · Color picker and file-list controls

`done` · actual **+282 behavioral lines, +0.39 points**. Three file-local
suites add 14 tests for color entry, swatches, opacity, clipboard and
background selection; list filtering/sorting/grouping and retry; and list
creation and menu access. Full instrumentation adds 275 lines across nine
color and file-list components, six adjacent filter-helper lines and one
swatch-context line. All 6,304 renderer/MCP and 846 Electron tests pass under
instrumentation. No application code changed. The full `npm run lint` gate
passes with 7,150 ordinary tests. See baseline for exact deltas and evidence.

### UT-29 · Bible lookup interaction and async state

`done` · actual **+351 behavioral lines, +0.48 points**. Four file-local
suites add 19 tests for verse selection by mouse, keyboard and touch; input
completion and clearing; lookup result ordering and Bible availability; and
history storage, opening, invalid drag refusal and menus. Full
instrumentation covers 80 / 89 verse-grid, 41 / 44 verse-tile, 70 / 78
input-action, 81 / 82 lookup-container and 79 / 85 history lines. All 6,323
renderer/MCP and 846 Electron tests pass under instrumentation. No application
code changed. The full `npm run lint` gate passes with 7,169 ordinary tests.
See baseline for exact deltas and evidence.

### UT-30 · Bible lookup selection controls

`done` · actual **+120 behavioral lines, +0.16 points**. Three file-local
suites add 13 tests for Bible key menus, reference input editing and chapter
navigation, and available book selection. Full instrumentation covers 59 / 61
Bible-key selector, 44 / 44 input handler and 34 / 35 book-option lines. All
6,336 renderer/MCP and 846 Electron tests pass under instrumentation. No
application code changed. The full `npm run lint` gate passes with 7,182
ordinary tests. See baseline for exact deltas and evidence.

### UT-31 · Documents list and file rows

`done` · actual **+183 behavioral lines, +0.25 points**. Two file-local suites
add 14 tests for document/lyric file routing, import and download handling,
screen checks, selection and rename behavior, and document-specific menu
actions. Full instrumentation covers 92 / 100 list and 91 / 93 file-row lines,
both previously at zero. All 6,350 renderer/MCP and 846 Electron tests pass
under instrumentation. No application code changed. The full `npm run lint`
gate passes with 7,196 ordinary tests. See baseline for exact deltas and
evidence.

### UT-32 · Document printing and floating previews

`done` · actual **+113 behavioral lines, +0.16 points**. Two file-local suites
add 10 tests for print page sizing and media, website screenshot caching,
print failures, and floating-preview state and shortcuts. Full instrumentation
covers 76 / 79 print-helper and 37 / 37 preview-helper lines, both previously
at zero. All 6,360 renderer/MCP and 846 Electron tests pass under
instrumentation. No application code changed. The full `npm run lint` gate
passes with 7,206 ordinary tests. See baseline for exact deltas and evidence.

### UT-33 · Presenter tabs and slide previewers

`done` · actual **+225 behavioral lines, +0.30 points**. Three file-local
suites add 16 tests for Presenter tab and foreground state, slide-list loading
and refresh, and previewer keyboard focus, menus and media drops. Full
instrumentation covers 85 / 88 Presenter, 88 / 97 slide-list and 52 / 61
slide-previewer lines, all previously at zero. All 6,376 renderer/MCP and 846
Electron tests pass under instrumentation. No application code changed. The
full `npm run lint` gate passes with 7,222 ordinary tests. See baseline for
exact deltas and evidence.

### UT-34 · Slide editor canvas and item preview

`done` · actual **+223 behavioral lines, +0.31 points**. Two file-local suites
add 17 tests for canvas geometry, snapping and marquee selection, plus lazy
item previews, source labels, media cleanup and camera controls. Full
instrumentation covers 113 / 117 canvas-body and 109 / 121 item-preview lines,
both previously at zero, and one adjacent line. All 6,393 renderer/MCP and 846
Electron tests pass under instrumentation. No application code changed. The
full `npm run lint` gate passes with 7,239 ordinary tests. See baseline for
exact deltas and evidence.

### UT-35 · Slide and box property editors

`done` · actual **+191 behavioral lines, +0.26 points**. Four file-local
suites add 18 tests for slide names and dimensions, pending box-property
commits and Save flushing, shape styling, and box layer/sizing controls. Full
instrumentation covers 73 / 78 slide-property, 46 / 46 item-property, 38 / 38
shape-property and 34 / 34 box-tool lines, all previously at zero. All 6,411
renderer/MCP and 846 Electron tests pass under instrumentation. No application
code changed. The full `npm run lint` gate passes with 7,257 ordinary tests.
See baseline for exact deltas and evidence.

### UT-36 · Verse annotations and canvas editing context

`done` · actual **+147 behavioral lines, +0.20 points**. Two file-local suites
add 12 tests for serialized note-file writes and mark lifecycles, plus canvas
controller reuse, selection, keyboard movement and Bible insertion. Full
instrumentation covers 72 / 74 verse-annotation and 75 / 75 canvas-editing
lines, both previously at zero. All 6,423 renderer/MCP and 846 Electron tests
pass under instrumentation. No application code changed. The full
`npm run lint` gate passes with 7,269 ordinary tests. See baseline for exact
deltas and evidence.

### UT-37 · Lookup file stores and Bible cross-reference cache

`done` · actual **+126 behavioral lines, +0.17 points**. Two file-local suites
add 13 tests for subscriber-counted lookup file stores and cross-reference
validation, caching, refresh and verse conversion. Full instrumentation covers
139 / 181 lookup-index helper lines (was 79) and 66 / 82 cross-reference helper
lines (was zero). A failing regression found and fixed a cache bug: a file from
another Bible model was reused, while new files omitted the model stamp. All
6,436 renderer/MCP and 846 Electron tests pass under instrumentation. The
development Reader rendered after the code change; the cache-specific path was
verified by the regression. The full `npm run lint` gate passes with 7,282
ordinary tests. See baseline for exact deltas and evidence.

### UT-38 · Screen Mirror guest and QR reading

`done` · actual **+181 behavioral lines, +0.25 points**. Two file-local suites
add 14 tests for host discovery, manual and QR addresses, link states and
actions, decoder retries and cleanup. Full instrumentation covers 153 / 176
Screen Mirror guest and 28 / 28 QR helper lines, both previously at zero. All
6,450 renderer/MCP and 846 Electron tests pass under instrumentation. No
application code changed. The full `npm run lint` gate passes with 7,296
ordinary tests. See baseline for exact deltas and evidence.

### UT-39 · Screen Mirror host, addresses and firewall

`done` · actual **+159 behavioral lines, +0.22 points**. Two file-local suites
add 11 tests for hosting switches, guests and approval decisions, QR image
copying, router status and firewall guidance. Full instrumentation covers
62 / 65 network component, 24 / 27 addresses, 39 / 41 firewall notice and
34 / 34 host connection lines, all previously at zero. All 6,461 renderer/MCP
and 846 Electron tests pass under instrumentation. No application code changed.
The full `npm run lint` gate passes with 7,307 ordinary tests. See baseline for
exact deltas and evidence.

### UT-40 · Virtual display compositor

`done` · actual **+156 behavioral lines, +0.21 points**. One file-local suite
adds seven tests for wallpaper and webview layers, screen audio, MP4 capture,
encoder generation safety and microphone teardown. Full instrumentation covers
156 / 162 compositor entry lines, previously at zero. All 6,468 renderer/MCP
and 846 Electron tests pass under instrumentation. No application code changed.
The full `npm run lint` gate passes with 7,314 ordinary tests. See baseline for
exact deltas and evidence.

### UT-41 · Intercom audio

`done` · actual **+82 behavioral lines, +0.11 points**. One file-local suite
adds seven tests for support gating, speaker volume and packet playback,
decoder failure, microphone encoding and cleanup, late permission, encoder
failure, and stale processor frames. Full instrumentation covers 143 / 145
intercom lines, up from 61 / 145. All 6,475 renderer/MCP and 846 Electron
tests pass under instrumentation. No application code changed. The full
`npm run lint` gate passes with 7,321 ordinary tests. See baseline for exact
deltas and evidence.

### UT-42 · Media sessions and canvas item core

`done` · actual **+132 behavioral lines, +0.19 points**. Two file-local suites
add eight tests for session persistence, selection and confirmed deletion,
plus canvas styles, identity, edits, validation and selection contexts. Full
instrumentation covers 72 / 73 media session lines, previously at zero, and
107 / 124 canvas item lines, up from 47 / 124. All 6,483 renderer/MCP and
846 Electron tests pass under instrumentation. No application code changed.
The full `npm run lint` gate passes with 7,329 ordinary tests. See baseline
for exact deltas and evidence.

### UT-43 · Presenting flow item preview

`done` · actual **+179 covered lines, +0.24 points**. One file-local suite
adds eight behavioral tests for preview selection, menus, folding, parking,
screen actions, drag payloads, Bible and background data, and document slide
stepping. Full instrumentation covers 178 / 198 preview lines, previously at
zero. All 6,491 renderer/MCP and 846 Electron tests pass under instrumentation.
No application code changed. The full `npm run lint` gate passes with 7,337
ordinary tests. See baseline for exact deltas and evidence.

### UT-44 · Presenting flow floating preview

`done` · actual **+114 net covered lines, +0.16 points**. One file-local suite
adds six tests for independent floating widgets, file deletion, focus-gated
stepping, UUID jumps, loading and error states, collapse controls, and auto-next.
Full instrumentation covers 115 / 141 floating preview lines, previously at
zero. All 6,497 renderer/MCP and 846 Electron tests pass under instrumentation.
No application code changed. The full `npm run lint` gate passes with 7,343
ordinary tests. See baseline for exact deltas and evidence.

### UT-45 · Presenting-flow rename and note actions

`done` · actual **+118 net covered lines, +0.16 points**. Eight file-local
behavioral tests cover the one-off rename migration and Bible note context
actions. The migration reaches 62 / 63 lines and the note helper 56 / 56,
previously both at zero. All 6,505 renderer/MCP and 846 Electron tests pass
under instrumentation. No application code changed. See baseline for the exact
deltas and evidence. The full `npm run lint` gate passes with 7,351 ordinary
tests.

### UT-46 · Lookup UI and virtual rows

`done` · actual **+153 net covered lines, +0.21 points**. Ten file-local
behavioral tests cover the location/name lookup panel, verse lookup links, and
the virtual-row hook. Full instrumentation covers 62 / 64, 33 / 33, and 58 /
64 lines respectively, all previously at zero. All 6,515 renderer/MCP and 846
Electron tests pass under instrumentation. No application code changed. See
baseline for exact deltas and evidence. The full `npm run lint` gate passes with
7,361 ordinary tests.

### UT-47 · Auto-play runners and mirror camera broker

`done` · actual **+122 net covered lines, +0.16 points**. Eight file-local
behavioral tests cover timer survival and cancellation, scoped reconciliation,
shared camera capture, candidate ordering, and intercom relay. Full
instrumentation covers 50 / 52 runner lines and 72 / 73 camera broker lines,
both previously at zero. All 6,523 renderer/MCP and 846 Electron tests pass
under instrumentation. No application code changed. See baseline for the exact
deltas and evidence. The full `npm run lint` gate passes with 7,369 ordinary
tests.

### UT-48 · Verse marks, file drops, and Finder

`done` · actual **+194 stable covered lines, +0.27 points**. Eleven file-local
behavioral tests cover verse highlight integrity and repainting, file drops and
context menus, and Finder search and drag controls. Full instrumentation covers
57 / 61, 64 / 65, and 73 / 73 lines respectively, all previously at zero. The
isolated Electron repeat removed a three-line measurement variation; all 6,534
renderer/MCP and 846 Electron tests pass under instrumentation. No application
code changed. The full `npm run lint` gate passes with 7,380 ordinary tests.
See baseline for exact deltas and evidence.

### UT-49 · Background controls and sessions

`done` · actual **+143 net covered lines, +0.20 points**. Eleven file-local
behavioral tests cover background auto-play, per-screen colors, folder-session
gating and cleanup, and media-card ordering and virtualization. Full
instrumentation covers 37 / 37, 42 / 46, 35 / 35, and 29 / 30 lines,
respectively, all previously at zero. All 6,545 renderer/MCP and 846 Electron
tests pass under instrumentation. No application code changed. See baseline for
exact deltas and evidence. The full `npm run lint` gate passes with 7,391
ordinary tests.

### UT-50 · Canvas ruler, container, and drop paths

`done` · actual **+168 net covered lines, +0.22 points**. Eleven file-local
behavioral tests cover canvas guide drawing and dragging, drop routing,
scroll geometry, and container focus. Full instrumentation covers 39 / 39
drop-helper lines, 67 / 69 ruler lines, and 62 / 69 container lines, all
previously at zero. All 6,556 renderer/MCP and 846 Electron tests pass under
instrumentation. The full `npm run lint` gate passed both TypeScript projects,
7,402 ordinary tests, Prettier, ESLint, and the production build check. No
application code changed. See baseline for exact deltas and evidence.

### UT-51–52 · Bible text and foreground controls

`done` · actual **+190 net covered lines, +0.26 points**. Eleven behavioral
tests cover Bible text style and effects, foreground decoration persistence,
and inherited/overridden transition controls. Full instrumentation covers
76 / 82 Bible text panel lines, 71 / 71 decoration lines and 40 / 40 transition
lines, all previously at zero. All 6,567 renderer/MCP and 846 Electron tests
pass under instrumentation. The full `npm run lint` gate passed both TypeScript
projects, 7,413 ordinary tests, Prettier, ESLint, and the production build
check. No application code changed. See baseline for exact deltas and evidence.

### UT-53–54 · Note lifecycle and editor

`done` · actual **+151 net covered lines, +0.21 points**. Eight Note lifecycle
tests cover item mutation, cross-file moves, default-file creation and
editing-head synchronization. Three editor tests cover title/content saves and
file-event refresh. Full instrumentation covers 199 / 216 Note lines and
44 / 54 editor lines, up from 92 / 216 and zero. All 6,578 renderer/MCP and
846 Electron tests pass under instrumentation. The full `npm run lint` gate
passed both TypeScript projects, 7,424 ordinary tests, Prettier, ESLint and the
production build check. No application code changed. See baseline for exact
deltas and evidence.

### UT-55 · Note file, drawing controls, and Bible XML editor

`done` · actual **+180 net covered lines, +0.25 points**. Twelve behavioral
tests cover note-file loading/actions/drops, drawing controls and shortcuts,
and Bible XML chapter validation/merge. Full instrumentation covers 57 / 66
Note file lines, 67 / 68 drawing-control lines and 56 / 68 Bible XML editor
lines, all previously at zero. All 6,590 renderer/MCP and 846 Electron tests
pass under instrumentation. The full `npm run lint` gate passed both TypeScript
projects, 7,436 ordinary tests, Prettier, ESLint and the production build
check. No application code changed. See baseline for exact deltas and evidence.

### Remaining batches toward 80%

These are estimates, to be replaced with each batch's measured gain. The
component batches need output assertions and behavioral checks for their
actions; report any smoke-render gain separately.

| Batch  | Files / current gap                                                                                      | Predicted gain                       | File-local mock surface                                                                |
| ------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| UT-14b | Remaining slide editor/canvas components; ~1,290 lines                                                   | +800–1,000                           | Existing canvas controller and editor harnesses, pointer interactions                  |
| UT-15b | Helper persistence/controller gaps, including file helpers (239) and backup helpers (151)                | +1,200–1,800 across several slices   | File-local filesystem, backup and domain fixtures; real parsers where possible         |
| UT-16b | Background (881), remaining Bible lookup, common components (1,054)                                      | +1,800–2,300                         | Batched feature harnesses for grids, lookup state and common controls                  |
| UT-17b | Bible list (1,138), Reader (724), remaining graph and location lookup, lyrics (528), flow previews (716) | +2,800–3,600                         | Reuse each feature's existing local test surface; actions and output assertions        |
| UT-18b | Remaining chatbot UI (1,143), Office layout/export (~405), MCP tools (1,125)                              | +1,900–2,500 across separate batches | Local session/provider/webview or measured DOM geometry fixtures; keep network offline |

Re-measure after each batch and re-rank from `worklist.json`. Stop only after a
green whole-surface run proves at least 80% and the lint gate has been checked.
No threshold or renderer-entry exclusion is authorized by this plan.

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

| Batch | Current gap                                                                                               | Next scope and predicted gain                                                                                                                                                      |
| ----- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UT-03 | `agentNoteHelpers.ts`: 194; `agentBibleListHelpers.ts`: 191; `agentBackupHelpers.ts`: 159 uncovered lines | File-local backup/storage/domain mocks; refusal and successful CRUD/restore cases. Estimate +250–400 behavioural lines across several runs.                                        |
| UT-01 | Presenting-flow: 702 uncovered of 2 527; **72.2%**                                                        | 20 existing test files. Extend file-local screen/provider harnesses for preview components and outstanding timer/event paths; estimate +300–500 lines, reporting smoke separately. |
| UT-04 | `bibleXMLJsonDataHelpers.ts`: 339; `fileHelpers.ts`: 230 uncovered                                        | Filesystem/cache error paths with per-file mocks; estimate +200–350 behavioural lines.                                                                                             |
| UT-02 | Foreground: 1 486 uncovered of 1 489                                                                      | Remains nearly untested; larger component work after lifecycle coverage.                                                                                                           |

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

| Uncovered | Lines | Now    | File                                  |
| --------- | ----- | ------ | ------------------------------------- |
| 14        | 530   | 97.35% | `electron/electronHelpers.ts`         |
| 10        | 108   | 90.74% | `electron/displayWallpaperHelpers.ts` |
| 4         | 104   | 96.15% | `electron/aiHelpers.ts`               |
| 4         | 300   | 98.66% | `electron/electronEventListener.ts`   |
| 3         | 38    | 92.10% | `electron/client/fileUtils.ts`        |

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

_Mock surface:_ one file-local `vi.hoisted` bundle for `appProvider`, `fileHelpers`,
`FileSource` and the settings store per batched harness, never exported to other
test files. Start with the two
model classes — they are pure state machines and need the least of it.

_What to assert:_ the recorded behaviour, from memory —
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

_Mock surface:_ `ScreenForegroundManager` plus the floating-widget host. The
component half wants the batched smoke harness
(`components.smoke.test.tsx`); the helpers want real assertions.

_What to assert:_ memory `foreground-effects-one-setting` (border / shadow /
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

_What to assert:_ no backup → no change; a delete goes to the trash and
returns an `undoId`; `update` writes the editing history, never the file; a
bad name is refused rather than cleaned; `owa_undo` applies rename → files →
editing heads in that order.

### `UT-04` · the half-covered heavyweights — ~1 300 uncovered

`open` · **est. +2.4 pt** · 5 files

| File                                                   | Now | Uncovered | The uncovered part is                                               |
| ------------------------------------------------------ | --- | --------- | ------------------------------------------------------------------- |
| `src/setting/bible-setting/bibleXMLJsonDataHelpers.ts` | 1%  | 338       | nearly all of it                                                    |
| `src/slide-editor/BoxEditorController.ts`              | 11% | 349       | the editing commands                                                |
| `src/server/fileHelpers.ts`                            | 41% | 241       | error paths (it already has a sibling test to extend)               |
| `src/helper/appArchiveHelpers.ts`                      | 18% | 191       | the archive round trip                                              |
| `src/lang/langHelpers.ts`                              | 14% | 182       | locale loading — and the km-completeness tests deleted in the prune |

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
the user.** See _Exclusions_ in [baseline.md](./baseline.md).

---

## Historical running-total forecast — requires remeasurement

| After               | Est. lines | Est. honest coverage                    |
| ------------------- | ---------- | --------------------------------------- |
| baseline            | 25 395     | **48.17%**                              |
| UT-00               | ~25 900    | ~49.1% — and `electron/**` alone at 99% |
| UT-01               | ~28 170    | ~53.4%                                  |
| UT-02               | ~29 490    | ~55.9%                                  |
| UT-03               | ~30 430    | ~57.7%                                  |
| UT-04               | ~31 600    | ~59.9%                                  |
| UT-05               | ~32 320    | ~61.3%                                  |
| UT-06 (all folders) | ~43 520    | ~82.6%                                  |
| UT-07               | ~45 310    | ~85.9%                                  |

The last ~14 points are the long tail: the remainder of every folder, the
branches, and whatever UT-09 decides. **Re-plan after UT-06** — these
estimates assume ~90% of each batch's uncovered lines get covered, which is
optimistic for components and pessimistic for pure helpers.
