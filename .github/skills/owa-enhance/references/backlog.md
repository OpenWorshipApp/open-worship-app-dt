# Enhancement backlog — `EN-xx`

App-wide findings from `/owa-enhance` runs, under stable ids, so a later run
starts from the truth instead of a re-discovery. The AI subsystems keep their
own — `EC-xx` (`owa-enhance-chatbot`), `MC-xx` (`owa-enhance-mcp`), `AC-xx`
(`owa-enhance-aichat`) — and a finding that belongs to one of them is filed
there, not here.

**Nothing is written here while researching.** Entries arrive only after the
user decides: an applied finding as `done`, with what shipped, the number
before → after and the proof; every other finding of that report as `open`;
and all of them on `file`. Filing is an edit under `.claude/`, so it brings the
`.github/` mirror copy and `node extra-work/build-knowledge.mjs` with it.

This file ships in plaintext inside the installer: a security finding that is
still open is filed by its class and its location, never as a working exploit.

Status: `open` (evidenced, not done) · `doing` · `done` · `wontfix` (with the
reason — usually a decision that deserves a memory note too).

Entry shape — the status stays the last status word on the heading line,
because `scripts/triage.mjs` reads it from there:

```markdown
## EN-01 · <the claim, in one line> — `open` · S2 · performance

**Evidence.** … **Failure scenario.** … **Proposed change.** …
**Proof on apply.** … Found in run `<runid>`.
```

---

## EN-09 · A noted verse number kept the Reader repainting the whole chapter at 60 fps — `done` · S2 · performance

**Evidence.** `.verse-number-text[data-bible-id]` ran `app-bible-note-verse-hint`
(a `text-decoration-color` keyframe) `infinite`; every idle `Paint` targeted the
whole `bible-view-text` column. **Shipped.** 3 cycles, then the steady dotted
underline (`src/bible-reader/BibleViewComp.scss`). **Before → after** (idle
Reader traces, dev app, same tool, `reload: false`): paints 235.2/s → 0; style
recalculations 63.7/s → 0; main-thread frames 58.7/s → 1.9/s; main-thread tasks
5.52 → 0.64 s/min. **Proof.** Live DOM on the dev app: the marks carry
`animation-iteration-count: 3` and `document.getAnimations()` has 0 running.
Found and applied in run `20260915-1203`.

## EN-10 · The on-screen slide card's border pulse held the Presenter at 60 fps — `done` · S3 · performance

**Evidence.** `.app-highlight-selected.animation` (slide cards on a screen,
backgrounds on a screen, the colour picker) ran a `border-color` keyframe
`infinite`. **Shipped.** 3 cycles, then the steady accent border
(`src/others/appInit.scss`). **Before → after** (idle Presenter traces, one
card on a screen): main-thread frames 58.6/s → 4.1/s; paints 22.5/s → 0; style
58.6/s → 4.1/s; main-thread tasks 1.65 → 1.40 s/min. A later pinned 30 s
`Performance.getMetrics` window read 0.30 s/min and no script. **Proof.** Live
DOM: the card carries `animation-iteration-count: 3`, 0 running animations.
Found and applied in run `20260915-1203`.

## EN-11 · The lookup box re-read and re-parsed the whole Bible every 10–15 s — `done` · S3 · performance

**Evidence.** `InputHandlerComp` asked `getBibleXMLDataFromKeyCaching` every
5 s against a 10 s cache whose expiry is absolute from the write, so every
second tick missed: a "Loading Bible Data" progress bar, a read of
`<key>.xml.cache/all` (KJV 4.7 MB, Khmer 14.8 MB) and `JSON.parse` on the main
thread, at idle. **Shipped.** The interval is gone, with a comment saying why
(`src/bible-lookup/InputHandlerComp.tsx`). **Trades away.** The first lookup
after 10 s of quiet pays one parse. **Before → after.** Idle Reader traces:
`getBackupBibleXMLData` samples and `app-progress-bar` animations in both
before traces (at 4×: a 108 ms task plus two 93–94 ms style recalculations over
~2 890 elements) → none in a 64 s after trace. Found and applied in run
`20260915-1203`.

## EN-12 · The Audios panel hashed every PPTX and mounted a loading player per sound — `done` · S3 · performance

**Evidence.** `getAudioDataList` went through `getSlides()` → `getPptxData`,
which MD5-hashes the whole file and reads every slide's html, for every `.pptx`
on mount and on every folder refresh (10 files, 53.9 MB, ~150 ms of JS-thread
CPU per pass here). Every `<audio>` in Document Audios used the default
preload, so Presenter load fetched 24.5 MB and 15.8 MB wavs of unselected
documents. **Shipped.** `getPptxSlideAudioDataListQuick` in
`src/server/pptxHelpers.ts` reads `info.json` alone (shared
`readPptxInfoDataQuick` with the missing-font banner);
`PptxAppDocument.getAudioFilePaths` uses it; `AudioBodyComp`'s `<audio>` is
`preload="none"`. **Trades away.** A PPTX without a generated preview lists no
audio until it is opened, and a PPTX replaced outside the app can show a stale
list until then. **Before → after.** Presenter load `-htmls/media` fetches 5 →
0; full-file hashes per folder refresh 10 → 0 (unit test asserts no hash, no
html read, no export). **Proof.** Two new tests in
`src/server/docxPptxHelpers.test.ts` failed first and pass. Live DOM on the dev
app: the same four files as before, each `preload="none"`, `readyState` 0,
`networkState` idle. Slide badges were checked against `info.json`
arithmetically; the live badge read was lost to another session's hot reload.
Found and applied in run `20260915-1203`.

## EN-13 · On macOS/Linux `lint:es` linted 573 of 952 files, skipping every top-level `electron/*.ts` — `done` · S3 · dev-flow

**Evidence.** `lint:es` passed `src/**/*.ts*` and `electron/**/*.ts` UNQUOTED.
npm runs scripts through `cmd.exe` on Windows (no expansion, so eslint globbed
itself: 952 files) and through `/bin/sh` on macOS/Linux, which has no globstar,
so `**` meant `*`. There eslint got `src/*/*.ts*` and `electron/*/*.ts`: 554 of
875 `src` files, 19 of 77 `electron` files, and none of the 58 top-level
`electron/*.ts`, including `index.ts`, `electronEventListener.ts` (every IPC
handler) and `aiHelpers.ts`. It was the same expansion when typed into a bash
shell by hand; on Windows that overflowed the 32 K command line instead.
**Shipped.** Both globs quoted in `package.json`. A new
`src/test-setup/lintGateScripts.test.ts` fails on any script with an unquoted
`**`. **Before → after.** Files linted through POSIX `sh`: 573 → **952**, 0
problems; `electron/index.ts`, `electron/electronEventListener.ts`,
`electron/aiHelpers.ts` and `src/presenter.tsx` SKIPPED → LINTED. **Proof.**
The guard test failed on the old script and passes. Found and applied in run
`20260918-1109`.

## EN-14 · The typecheck stage covered 0 of 49 electron files — `done` · S3 · dev-flow

**Evidence.** `lint:all:error` ran `tsc` on `tsconfig.json`, which includes
`src` alone, and nothing in `src/` imports `electron/`: `--listFilesOnly`
listed 1 227 `src` files and 0 `electron` files. The only electron typecheck
was `electron:build`, inside the `build` a session skips with the app up
(`MC-29`). Memory `build-kills-running-dev-app` wrongly said `lint:all:error`
covered it. **Shipped.** `lint:all:error` = `tsc --noEmit --skipLibCheck &&
tsc -p electron.tsconfig.json --noEmit`, pinned by the guard test. The memory
note was corrected, and the review skills now say `npm run lint:all:error`
where they said a bare `npx tsc --noEmit`. **Before → after.** Electron files
typechecked by the gate: 0 → **49**. The stage takes 4.3 s warm (the electron
half alone is 1.3 s). **Proof.** A scratch config over `electron/**/*.ts` plus
a planted `const n: number = 'x'` exits 1 on TS2322; the same config without
the plant exits 0. The plant was not made inside `electron/`, because
`electron:dev`'s `tsc -w` would have emitted it and restarted the app.
**Still open — the optional half.** The 29 `electron/**/*.test.ts` files are in
NO typecheck (`electron.tsconfig.json` excludes them). A scratch config found
10 errors, 9 of them at HEAD: 5 are `.at()` against the `es2015` lib, and 4 are
mocks that drifted (`isAlwaysOnTop` on `MockBrowserWindow`, an `app.getPath`
mock's arity, two `.find` callback shapes). Cure: an
`electron.test.tsconfig.json` with an `es2022` lib, added to
`lint:all:error` once those are fixed. Found and applied in run
`20260918-1109`.

## EN-15 · With :3000 taken, Vite slid to :3001 while dev Electron kept loading :3000 — `done` · S3 · dev-flow

**Evidence.** `vite.config.ts` set `server.port: 3000` without `strictPort`, and
`electron/protocolHelpers.ts` hard-codes `https://localhost:3000`. Recorded
2026-08-05 (memory `dev-electron-hardcodes-port-3000`). On the day of this run,
two dev stacks from 2026-09-15 were still alive on `:3001` and `:3002`: each
had started into a taken `:3000` and slid along unnoticed. The user OK'd
stopping them, and they were stopped by pid tree. **Shipped.**
`strictPort: true`, with a comment naming the Electron hard-code. **Before →
after.** A throwaway server built from the real config (own temp `cacheDir`, no
watcher, no HMR) while the live one held `:3000`: `LISTENING on
https://localhost:3001/` → `REFUSED: Port 3000 is already in use`. **Proof.**
The live Vite restarted on the config edit, re-bound `:3000` (same pid),
`presenter.html` answered 200, and the open Reader reloaded and rendered with no
console error. **Trades away.** A second dev stack cannot start at all. It never
worked anyway, since Electron always loads `:3000`. Found and applied in run
`20260918-1109`.

## EN-16 · The gate could not run beside a live dev app — `done` · S3 · dev-flow

**Evidence.** `lint` ended in `npm run build` → `rmdir.mjs electron-build`, the
running app's `main` and preloads. It either killed the app (2026-07-29) or
EPERMed on `fts5.dll` (2026-08-12). `lint:pre` was `prettier --write`, which
would rewrite a peer session's unfinished files (`MC-29`). So sessions ran the
stages in pieces and left the build out, and that is how `EN-14`'s gap stayed
invisible. **Shipped (option A, chosen by the user).** `lint` =
`lint:all:error` → `test:all` → `lint:pre` (now `prettier --check`) →
`lint:es` → `lint:build` (`extra-work/check-build.mjs`: the same production
vite build into a temp dir, deleted afterwards). New `npm run format` does the
`--write`. `build`, `test:e2e` and `pack:*` are unchanged. CLAUDE.md, memory
`build-kills-running-dev-app` and every skill that said "the gate ends in a
build" were updated. **Trades away.** The gate no longer formats for you (a
diff fails it and you run `format`). `copy-build`, `build-knowledge` and
`build-info` are exercised by `pack:*` only. The typecheck now runs first,
which is half of `EN-18`. **Before → after.** Gate beside a running dev app:
killed it or was skipped in part → ran end to end with the app still up
(`npm run lint` 217 s, every stage green, 262 + 29 test files; the app's pid
25192 the same before and after; no `owa-check-build-*` left in the temp dir). **Proof.** A misformatted file planted in `src/` fails
`lint:pre` (exit 1) and is left untouched. The guard test rejects any gate
stage with `--write`, `rmdir`, `electron:build` or a real build. Found and
applied in run `20260918-1109`; closes `MC-29`.

## EN-17 · No CI: the gate runs only when and where someone remembers to run it — `open` · S3 · dev-flow

**Evidence.** `.github/` holds only the Copilot mirror, with 0 workflows; the
remote is GitHub. CLAUDE.md records a `test:electron` failure it calls
long-standing (fixed in `0344644c`, 2026-07-25). While it lasted, every
`npm run lint` stopped at stage 1. CLAUDE.md now carries a standing rule for
stages "failing on something unrelated to your change". **Proposed change —
the user's choice.** (A) GitHub Actions on push/PR, `windows-latest` plus
`macos-latest` (possible since `EN-13`), installing with the git deps allowed,
then `npm run lint` (~3 min, free minutes for a public repo; visibility not
checked). (B) A tracked `.githooks/pre-push` via `core.hooksPath`, running the
gate locally. **Proof on apply.** A planted lint error shows a red check (A) or
refuses the push (B); the real tree passes. Found in run `20260918-1109`.

## EN-18 · The gate re-lints unchanged files on every run — `open` · S4 · dev-flow

**Evidence.** Repeat-run timings with the tools' own caches, stored in the OS
temp dir: eslint 15.5 s → 3.1 s, prettier 26–32 s → 10.9 s, about 30 s off
each ~3 min gate. The other half, typecheck before the 55–69 s of tests, landed
with `EN-16`. **Proposed change.** `--cache --cache-location
node_modules/.cache/eslint/` on `lint:es` and `--cache` on `lint:pre` (default
`node_modules/.cache/prettier`), both git-ignored. **Proof on apply.** The two
repeat-run timings re-taken. Found in run `20260918-1109`.

## EN-19 · The Mini Screen's "showing" icon pulsed its colour forever, so the Presenter redrew at 60 fps while a screen was up — `done` · S3 · ui

**Evidence.** `.show-hide.showing .app-showing-indicator` ran
`app-live-blinking-amin` (a `color` keyframe) `infinite` on every shown screen's
toggle icon, the last `infinite` paint animation left in the Presenter at rest
after `EN-09` / `EN-10`. Those two runs traced the Presenter with its screen
HIDDEN, so this one never ran in any trace. **Shipped (the user's choice: 3
opacity pulses, then steady).** The keyframe animates `opacity` (compositor
only); the icon pulses 3 times and holds a steady on-air colour
(`src/others/appInit.scss`, `src/_screen/preview/MiniScreen.scss`). The pulse
restarts whenever a screen is shown again. **Before → after.** Idle Presenter
of the dev app with screen 0 SHOWING, `performance_start_trace` with
`reload: false`, ~23 whole seconds each, median per second for the
Presenter's pid: main-thread frames 60 → 8, paints 120 → 17, style
recalculations 60 → 12. Hidden, the same window idles at 6 / 2 / 6. In a
10-second quiet window, `I.app-showing-indicator` paints went 583 → 0, and a
full `#document` paint went with each one. What remains after is someone's
Bible Lookup in the same window (a `bible-view-text` repaint that started with
their key presses) and 29 video frames. A scratch Electron 44.3.0 harness
agreed beforehand: infinite `color` 60.1 frames/s and 120.2 paints/s; capped,
or on `opacity`, 0. **Proof.** The three raw traces were counted per second,
with inputs noted. Screen 0 was shown only for the traces (with the user's
OK), then hidden again with its content unchanged. Found and applied in run
`20260918-1758`.

## EN-20 · Five `tran()` keys had no Khmer string, and nothing in the gate could notice one — `done` · S3 · ui

**Evidence.** A static scan of `src/` found 1 600 statically resolvable keys
(1 558 literal, merging `+` chains; 42 string constants). 5 of them were
missing from `km` across 12 call sites, all on failure paths:
*Failed to apply to screen…* (8 sites), *Failed to sync slide…*, two
clipboard-image errors, and the Bible-list alert. They showed English in a
packaged Khmer app. In dev they threw inside `ScreenBibleManager`'s loop,
which skipped the screens after the failed one. No test compared `src` with
the dictionary. **Shipped.** `src/lang/tranKeyCoverage.test.ts` reads the
dictionary as source (never importing the module) and walks `src/` (tests and
`lang/data` excepted), and fails naming each missing key and its sites. It
carries self-checks (>1 000 calls found, unquoted keys read, the sanitiser
still `trim().toLowerCase()`) and an extraction test. The 5 Khmer strings were
added (machine-authored, marked for review). The `'error'` body of the 9
already-translated screen-failure toasts is `tran('Error')` now, and 2
assertions moved to `'Error'`. The 4 English twins in the static
`receiveSyncScreen` receivers were left English ON PURPOSE, with a comment:
they also run in the screen window, where a `tran()` before its language data
loads throws in dev. **Before → after.** Missing static keys 5 → 0. Tests
guarding coverage 0 → 1. **Proof.** The test failed at HEAD naming exactly
the 5 keys, and a planted `tran('zz no such key')` failed it. It then caught
EN-21's 12 new keys before they had strings. **Still open.** 159 dynamic
`tran(expr)` calls (a `tran(prop)` fed by a JSX literal) are beyond a static
read. LT-02's live Khmer pass is still their only catch. Found and applied
in run `20260918-1758`.

## EN-21 · English tooltips on controls a Khmer volunteer uses — `done` · S4 · ui

**Evidence.** 13 volunteer-facing sites built a `title` / `aria-label` / `alt`
from English with no `tran()`:
- the Reader's lookup history chip — the only explanation of double click /
  shift double click;
- `Tab to complete`, `Split vertical`;
- the verse numbers' *Double click to select verses*;
- *Click to remove extra Bible*;
- three Bible Note footer buttons;
- the cross-reference badges titled `isS` / `isFN` / …;
- the background icons' `Color:` / `Camera:`;
- the Mini Screen card's `Screen: N`;
- the divider arrows' `Disable left`, which collapse a panel and disable
  nothing.

Robot run `20260912-2139` had filed two of them (L2, L3). **Shipped.** Each
goes through `tran()` in render, with 12 Khmer strings. The arrows read
*Collapse left / right / top / bottom panel* (`genCollapseTitle`, literal
keys), deliberately not the menu's *Close First Widget*, so a hover-only arrow
never matches where W-31 means the menu item. The cross-reference badges lost
their field-name titles, and their TODO says why no words went in yet: what
`S` and `*` mean in that data is not known. W-31 step 7, GL-18 and the LT
note were updated. **Before → after.** English attributes on these controls:
13 sites → 0. **Proof.** Live in English: the four arrow names on the
Presenter's dividers, `Disable left` gone, `Screen: 0` unchanged. Live in
Khmer, after Settings → Language → Apply: `បង្រួមផ្ទាំងខាងឆ្វេង` on the
dividers, `អេក្រង់: 0` on the card, the Khmer tooltip on all 20 history chips
and on the verse numbers, `Tab ដើម្បីបំពេញ`, `បំបែកបញ្ឈរ [Ctrl+Shift+V]`; 0
console errors in both windows; English restored. Not seen live: the Bible
Note window's buttons, and *Click to remove extra Bible* (no extra Bible was
open). Found and applied in run `20260918-1758`.

## EN-22 · Importing a Windows-made bundle on macOS/Linux named the file after the whole Windows path — `done` · S2 · reliability

**Evidence.** `importArchiveFiles` took `FileSource.getInstance(originalPath).fullName`, and `FileSource` split on the running OS's separator only: on POSIX `C:\Users\x\data\documents\Song.ows` became a file NAMED that (reproduced with Node's `path.posix`). **Shipped.** The name comes from `toBaseNameOfAnyOs` (either separator) and `toPortableFileFullName` (name and extension cleaned apart: a Linux `What?.owl` lands as `What.owl`), both in `fileHelpers`. `FileSource.getInstanceNoCache` now splits through `splitFilePath`, which on Windows takes either separator. **Proof.** `src/helper/appArchiveHelpers.test.ts` (the first test for the import) imports a Windows bundle under POSIX rules: `Song.ows` lands in the documents folder. Found and applied in run `20260919-1215`.

## EN-23 · Export Data handed tar a RELATIVE folder on macOS/Linux — `done` · S2 · reliability

**Evidence.** `toCommonAncestor` split on the separator and dropped empty parts, so `/Volumes/USB/data/lyrics` gave the ancestor `Volumes/USB/data` — right only when the app was started from `/`; a Windows share lost its `\\`. Folder names were compared case-insensitively on Linux too. **Shipped.** `splitPathRoot` in `fileHelpers` keeps the root (`/`, `C:\`, `\\server\share\`); names compare by `toPathCompareKey` (exact on Linux). **Proof.** `src/setting/data-archive/dataArchiveHelpers.test.ts` (new): `/media/me/USB/data` stays absolute; `Data` and `data` are two folders on Linux. Not driven live: the dev machine is Windows. Found and applied in run `20260919-1215`.

## EN-24 · A data folder missing at startup was FORGOTTEN, and the app opened on an empty one — `done` · S2 · reliability

**Evidence.** `appLocalStorage.defaultStorageDirPath` deleted `selected-parent-dir` from the host `setting.json` whenever the folder was not there (a stick plugged in late, a new drive letter) and fell back to `userData` in silence. **Shipped.** The choice is kept; the session runs on the app's own folder; `useCheckSetting` (`src/others/main.tsx`) names the missing folder with **Retry** / **Choose Another Folder**. Picking a folder also clears the 10-second `local-storage` cache, which had sent the child-folder settings written right after a pick into the OLD folder. **Not done:** the list of recent data folders the report proposed — EN-30's search covers the drive-letter case and the dialog the unplugged one. **Proof.** `appLocalStorage.test.ts` (new): a missing folder stays the choice and is reported; a moved one is adopted. The dialog was not seen live (nothing was unplugged). Found and applied in run `20260919-1215`.

## EN-25 · Colour notes were deleted at every start for files whose drive was not connected — `done` · S2 · reliability

**Evidence.** `checkAllColorNotes` deleted any note whose file answered ENOENT, and an unplugged drive or another OS's path answers exactly that. **Shipped.** A note is pruned only when its file's folder is here and the file is not (`checkIsNativeAbsolutePath`, `fsCheckDirExist(pathDirname(…))`). **Proof.** `FileSourceMetaManager.test.ts` — failed first on the old code, passes after. Found and applied in run `20260919-1215`.

## EN-26 · Downloaded videos were named after the raw page `<title>` — `done` · S2 · reliability

**Evidence.** `getPageTitle` kept HTML entities and illegal characters; `Way Maker | Official Music Video` failed the final move on Windows and exFAT after the whole download. **Shipped.** `decodeHtmlEntities` (`sanitizeHelpers`) then `toPortableFileName` (`fileHelpers`). **Proof.** `appHelpers.test.tsx`: `<title>Way Maker | Live &amp; Loud: 10/10</title>` → `Way Maker Live & Loud 10 10.mp4` — failed first. Found and applied in run `20260919-1215`.

## EN-27 · Delete failed for every file on a USB flash drive under Windows — `done` · S2 · reliability

**Evidence.** Electron's `trashItem` aborts (`Operation was aborted`; `platform_util_win.cc` `PreDeleteItem`) for an item that cannot be recycled, and Windows keeps no Recycle Bin on a flash drive; the app retried 5 × 1 s, then said "try again". **Shipped (option a, chosen at apply).** The main process stops retrying on that error; `FileSource.trash('ask')` asks **Delete Permanently** (Move to Trash in the file menu, the file-read error card, Delete Bible XML), and the side files follow the answer. An agent's delete (`trashAgentFile`) still refuses, with a sentence saying why. **Proof.** `FileSource.test.ts` (asked → kept / deleted; agent refused), `FileItemHandlerComp.test.tsx`, `electronEventListener.coverage.test.ts` (one attempt, no retries). Not seen on a real USB stick. Found and applied in run `20260919-1215`.

## EN-28 · Since `$DATA_DIR_PATH`, importing a bundle elsewhere no longer re-pointed a slide's media — `done` · S2 · reliability

**Evidence.** The manifest keyed files by the exporter's real paths; the imported document read back as `$DATA_DIR_PATH` expanded to the IMPORTER's folder, so nothing matched and a renamed `intro (1).mp4` left the slide on the importer's other `intro.mp4`. **Shipped.** `writeArchiveManifest` records `dataDirPath`; `importArchiveFiles` keys each file a second time by `rebaseDataDirPath` onto this machine's folder. **Proof.** `appArchiveHelpers.test.ts`: a Windows export imported on POSIX finds `intro (1).mp4`; a bundle without `dataDirPath` keys as before. Found and applied in run `20260919-1215`.

## EN-29 · The media-tool pack on a stick was for one OS but named and checked as if for all — `done` · S2 · reliability

**Evidence.** One `extra-bin/` for every OS: a Mac re-extracted the kept Windows `bin-<ver>.tar.gz` and failed each time; a Mac pack on Linux read as installed. **Shipped.** `extra-bin/<platform>/`, named as `buildPlatformHelpers.mjs` names packs (`win`, `mac`, `mac-int`, `linux-arm64` …); an older single-folder pack whose `info.json` names this OS is moved in (`moveLegacyExtraBinPack`), another OS's is left for that OS. **Proof.** `extraBinHelpers.test.ts`: per-platform paths and names; a Windows pack moved on Windows and left alone on a Mac. `MD-05` not re-run. Found and applied in run `20260919-1215`.

## EN-30 · Nothing found the data folder again on another drive letter or computer — `done` · S2 · reliability

**Shipped (option c + a).** A marker `.owa-data-folder.json` with an id is written into the chosen folder, and the host keeps `selected-parent-dir-id`. A missing folder is looked for under every other mount point (drive letters, `/Volumes`, `/media/<user>`, `/run/media/<user>`, `/mnt`) and adopted when the id matches (`findMovedDataDirSync`). A computer with nothing chosen is offered a marked folder found on a drive (`findDataDirsOnVolumesSync`). Picking a folder that already has `local-storage` no longer asks to reset its child folders; the question for a new one is worded and translated. Needs `readdirSync` in the preload (`electron/client/fileUtils.ts`). **Proof.** `fileHelpers.test.ts` (a stick back as F: found by its id, another church's on G: not, a new computer finding one). Live: the dev folder got its marker and the host its id on the first start. Found and applied in run `20260919-1215`.

## EN-31 · The Resources list rewrote another OS's folders into broken paths — `done` · S3 · reliability

**Shipped.** `checkIsForeignAbsolutePath` (`fileHelpers`): a folder written on the other OS family is kept as written instead of `pathResolve`d (`D:\Songs` had become `/D:\Songs`, then `C:\D:\Songs`). **Proof.** `resourcesFolderHelpers.test.ts`. Found and applied in run `20260919-1215`.

## EN-32 · Per-file settings were named after the file's absolute path — `done` · S3 · reliability

**Shipped.** `toFilePathSettingKey` writes a file inside the data folder relative to it (`@data_documents_song_ows`, via `toDataDirRelativePath`) and cuts a key over 150 bytes with an FNV hash. A one-off per data folder (`settingKeyPathMigration.ts`, marker `setting-key-path-migration`) renames old names: this folder's path exactly, another computer's where it meets one of the folder's own top-level folders — never inside a folder the data folder is set to use OUTSIDE itself. **Before → after** (live dev data): 52 path-named setting files → 0. The two for a document kept in another folder were moved by a first version without that exception and were put back by hand. **Not done:** pruning names no file matches — a sanitized key cannot be turned back into a path. **Proof.** `settingKeyPathMigration.test.ts`, `settingHelpers.test.tsx`. Found and applied in run `20260919-1215`.

## EN-33 · Paths from before the alias, or an older folder location, were never re-based — `done` · S3 · reliability

**Shipped.** **Repair Links** in Settings → Path Settings (`repairDataDirLinks` in `directoryHelpers`, `repairDataDirLinksInText` in `fileHelpers`): a link whose own path is gone and whose file (or folder) exists under this data folder is rewritten as `$DATA_DIR_PATH`, in its own form and escape level; a link that still points at something is never touched. Only on the press. **Before → after** (live dev data): stale Mac paths in lyric side files 4 → 0 and in their editing history 123 → 0 (381 + 6 links in 127 + 4 files); every repaired JSON parses; the Documents folder kept elsewhere untouched. **Proof.** `fileHelpers.test.ts` (Mac paths, JSON escape level, URLs, folder links, whole names only, a round trip through the reader). Found and applied in run `20260919-1215`.

## EN-34 · macOS `._` files broke a document's undo history and PDF preview reuse — `done` · S3 · reliability

**Shipped.** `fsListFiles` leaves hidden names out (the one-line fix memory `data-archive-owadata` had kept in reserve); the Resources scan also skips `Thumbs.db` / `desktop.ini` / the macOS `Icon` file (`checkIsSystemFileName`). **Proof.** `fileHelpers.test.ts` (`._3-head` left out). Not seen on a Mac. Found and applied in run `20260919-1215`.

## EN-35 · File names were not checked against what every OS accepts — `done` · S3 · reliability

**Shipped.** `getPortableFileNameProblem` / `describePortableFileNameProblem` / `toPortableFileName` in `fileHelpers`, used by the name box (Enter AND the button — Enter had applied names unchecked), `createNewFileDetail` (the old TODO; its toast no longer says "Creating Presenting Flow" for every type), `FileSource.renameTo`, Download From URL (`toFileFullNameFromUrl`: `song.ows?dl=1` → `song.ows`) and both song imports. The agent's reserved-name gap (`nul.old`) is filed in `owa-enhance-mcp`. **Proof.** `AskingNewNameComp.test.tsx` (new): `Service 10:30` + Enter is refused. Found and applied in run `20260919-1215`.

## EN-36 · A run sheet naming a deleted document "reset" it on every load — `done` · S3 · reliability

**Evidence.** Reported by the user as an error in the console: `File …\documents\a.ows does not exist`, 2× per Presenter load, from a run-sheet row whose `a.ows` is gone. The stack showed the real fault one level up: `AppDocument.getJsonData` read the missing file as CORRUPTED, toasted "Corrupted Document", and "reset" it through `setJsonData`, where `EditingHistoryManager.ensureHistoriesDir` made `<doc>.histories` before checking the file and then threw. The reset could not be saved, so the row listed a made-up default slide (`#0 Slide`) that a click would present, and an empty `a.ows.histories` came back on every load. The run sheet was the one reader that did not check first: the Presenter's own selection does (`getSelectedFilePathWithEnsure`). **Shipped.** `AppDocument.getJsonData`: a file that is not on disk is missing, not corrupted, and answers an empty document with no toast and no write (a document on disk that cannot be parsed is still reset). `ensureHistoriesDir` checks the document before making anything. `loadVaryAppDocument` answers null for a missing file, so the tree row, the run player and the assistant's run-sheet view show `Fail to read file data`, as `PL-50` already specified. **Before → after** (live, Presenter reload): console errors 2 → 0; the row `#0 Slide` → `⚠ Fail to read file data`; `a.ows.histories` re-created → not. **Proof.** `AppDocument.test.ts` (new), `presentingFlowDocumentHelpers.test.ts` (new), `EditingHistoryManager.test.ts` — all failed first. Found in run `20260919-1215`, applied 2026-09-19.

## EN-37 · Auxiliary renderers eagerly parsed the document and screen graph — `done` · S3 · performance

**Evidence.** Production static closures were 1,056 KB for About, 1,058 KB for Finder and 1,096 KB for AI Chat; every entry reached a 463 KB shared chunk containing both React DOM server builds, app-document rendering, canvas and screen managers. The paths ran through broad helpers used for one startup primitive (`appLocalStorage -> fileHelpers`, theme color math -> drag helpers, font IPC -> `appHelpers`). **Shipped.** Startup imports dependency-light leaves (`storageFileHelpers`, `colorValueHelpers`, `electronSendHelpers`, `appFontSettingHelpers`); the broad helpers re-export those APIs, rare storage enumeration stays dynamic, and About loads DOCX/PPTX version helpers on demand. `appLocalStorage.test.ts` locks the broad-file-helper boundary. **Before → after** (minified recursive static JS): About 1,056 → 236 KB (-78%); Finder 1,058 → 237 KB (-78%); AI Chat 1,096 → 323 KB (-71%); Settings 1,139 → 605 KB (-47%); Chatbot 1,697 → 956 KB (-44%). Presenter stayed effectively flat (1,288 → 1,300 KB); Screen remains near 1.06 MB because it actually renders that graph. **Proof.** Temporary production build (5,379 modules), 85 focused tests and TypeScript passed; live Presenter smoke check kept the selected PDF and the screen hidden. Found in run `20260923-2111`, applied 2026-09-23.

## EN-38 · Every projector window rewrote the screens' on-screen maps, so one present could erase the other screens — `done` · S1 · reliability

**Evidence.** The memory note `settings-write-race-corrupts-onscreen-map` (OPEN since 2026-08-07, when three screens came back blank after a reload) still held: `receiveSyncScreen` in `screen.html` ran the same setter as the Presenter, each doing read map → set own key → write the whole map, under a lock that is per process (`unlockingHelpers.ts`), with an in-place write (`flag: 'w'`). A read that failed turned into `{}` plus one key, so every other screen was deleted. A scratch simulation of two processes writing the same file in place: 797–840 of 875–928 concurrent reads unparseable (≈90%); with a temp file + rename: 0, but ~1 050 rename EPERMs per writer on Windows. **Shipped.** (1) `persistOnScreenEntry` (`src/_screen/managers/onScreenSettingPersistHelpers.ts`) is the one save for the slide, background, Bible (its setter and its scroll metadata) and foreground maps, and it never writes from a projector window; `saveScreenManagersSetting` skips there too. (2) A map that reads back empty while the file holds more than `{}` is rebuilt in the Presenter from its live managers (they are what the file was loaded into) and is left untouched in any other window. It is never saved as one key. (3) `appLocalStorage.setItem` writes through `fsWriteFileAtomicSync` (a hidden `.<key>.<random>.tmp` beside the file, renamed over it, 5 tries, then the old in-place write), and `renameSync` is exposed to renderers. **Before → after** (live, dev app, 2 screens showing, 6 presents): before, every present was ALSO written by each projector window that received it (traced; not counted live); after, the slide map was written 9 times in all, only by the Presenter and each through a rename; watcher reading the file every 5 ms: 0 of 5 707 reads unparseable; after a `Page.reload` both screens kept their own slide (page 2 / page 4) with no console error; no temp file left behind. **Proof.** `onScreenSettingPersistHelpers.test.ts` (6) and `storageFileHelpers.atomic.test.ts` (3), new; 398 tests over `_screen`, `server` and `directory-setting`; screenshot `test-results/owa-enhance/en-38-after-reload.png`. Found in run `20260924-1109`, applied 2026-09-24.
