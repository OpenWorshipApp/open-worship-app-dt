---
name: resources-panel
description: "Resources = 4th Bible-Find tab listing the user's own <bookKey>.<chapter>.* files; budgeted breadth-first scan, 10s cache, NO watcher, click opens the OS app — never a drag or a present"
metadata: 
  node_type: memory
  type: project
  modified: 2026-09-17T16:11:07.330Z
  originSessionId: b55cf2db-64b3-4648-9ecd-ef0baee2d5a6
---

**What it is (added `90481140`, 2026-08-29).** The 4th entry of the Advanced
Bible Lookup previewer select (`src/bible-find/BibleFindPreviewerComp.tsx`,
`tabTypeList` — Find `s` / Cross Reference `c` / Location-Name `l` /
Resources `r`, persisted in setting `bible-search-tab`). It lists the user's
own on-disk files for the selected verse's chapter: any folder the user picks
becomes a collapsible box showing files named `<bookKey>.<chapter>.<anything>`
(`PSA.1.pdf`, `GEN.49.outline.docx`). A chapter number `< 1` (`PSA.0.*`,
`PSA.-1.*`) is a whole-book file, listed under EVERY chapter of the book and
tagged `Introduction`. Canonical spelling is enforced — `PSA.01.pdf` and
`PSA.1e2.pdf` match nothing (`toChapterNumber` string-slices, no regex, and
requires `String(chapter) === chapterText`). Free-text filename search appends
hits below the verse matches, capped at 200; verse matches are never capped.
The verse context menu's **Open in Resources** item (`CM-93`) was REMOVED
2026-09-11 at the user's request — the picker is the only way in.
There is no `ResourcesComp.tsx` — chain is `ResourcesPreviewerComp` →
`ResourcesRendererComp` → N × `ResourcesDirBoxComp` → `ResourcesFileRowComp`.

**It follows the OPEN PANES, not a selected verse** (2026-09-10; asked for by
the user — *I don't want the Resources based on one selected verse anymore, I
want all preview verses (book+chapter) in the searching criteria*). The
`setResourcesVerseKey` slot is GONE from `BibleItemsViewController`;
`ResourcesPreviewerComp` reads `viewController.resolveStraightBibleItems(
foundBibleItem)` on `useBibleItemViewControllerUpdateEvent` +
`EditingResultContext`, exactly as `BibleLocationNamePreviewerComp` does, and
keeps the result as ONE STRING (`toResourceTargetsKey`: `GEN.24,GEN.27`, pane
order, repeats dropped) so an update event that changed nothing about the
reading sets the same value and re-scans nothing; `fromResourceTargetsKey` is
memoised on it so the boxes get one array identity per reading. Debounced
500 ms per instance, immediate on mount. `scanResourceFiles(dirPath, targets,
searchText, isOthersShowing, stop)` matches EVERY target in ONE walk (cache key SORTS the
targets, so swapped panes hit the same entry; empty targets + empty search
reads no directory), and the box files the matches with `groupResourceFiles`
— a labelled run per pattern in `toResourceMatchPatterns` order (each chapter
solid, then ONE dashed `<BOOK>.0.*` per book), a book-level file listed once.
`SelectedBibleVerseHeaderComp` is no longer drawn there; the pattern chips are
the header.

**Scanning is lazy twice over and budgeted** (`resourcesScanHelpers.ts`):
the tab is `lazy()` + only-active-tab-mounted, and a collapsed folder never
mounts its body so it never touches the disk (tested: "a collapsed folder
never touches the disk"). `walkForMatches` is breadth-first with an explicit
queue (a budget that runs out mid-walk still keeps shallow finds) and budgets
`MAX_SCAN_DEPTH 2` — the folder plus two levels under it, never a third
(2026-09-15, the user's ask: *make sure do 2 to 3 top level searching*; it was
8, and a home folder spent the whole directory budget and showed "Too many
folders to search" with nothing found — measured 64 dirs at depth 2, 335 at 3,
1500 truncated at 4+) — `MAX_SCAN_DIRECTORIES 1500` (the real budget — cost is
readdir calls), `MAX_SCAN_ENTRIES 20000`, yield every 16 dirs. It uses
`fsListDirents` (`readdir withFileTypes`, one syscall, no per-entry stat) —
symlinks are neither file nor directory so they are silently skipped (no
symlink cycles by construction). Unreadable ROOT re-throws; unreadable
subfolder is skipped. Hidden (dot) names are skipped and not descended into.
Truncation is surfaced in the UI, never silent.

**Cache + invalidation: NO watcher, by design.** A module-level
`CacheManager(10)` (10 s TTL) stores MATCHES only, never listings, keyed
`` `${dirPath} ${sortedTargets} ${others|-} ${searchText}` `` (search text last
so a `${dirPath} ` prefix drops a whole folder). The walk runs inside
`scanCacheManager.unlocking(...)` with a re-read inside the lock, so two boxes
over one folder (or a StrictMode double-mount) cost one walk. These folders
live OUTSIDE the app data dir and its fs.watch — a file added while the app is
open appears when the TTL lapses or on Refresh/Reload. Do not "fix" this with
a watcher. Box **Refresh** invalidates one folder + bumps a primitive
`refreshCount`; panel **Reload** invalidates all, re-reads the folder list
(picks up another window's change) and bumps `reloadCount`, which is part of
each box's `key` — without that, a Reload with an unchanged folder list would
remount nothing. An abandoned walk (unmount mid-scan via `checkShouldStop`)
returns null and is never cached.

**Folders & settings** (`resourcesFolderHelpers.ts`): list in
`resources-folder-list` (JSON array, `isErrorToDefault`), per-folder expansion
in `resources-folder-expanded-<sanitized path>` (prefix registered in
`RESOURCES_FOLDER_SETTING_PREFIXES` so `removeResourcesFolderSettings` can't
miss one — settings are one file per key), `resources-search-showing` is
panel-wide and deliberately NOT removed with a folder. Dedupe is by resolved
path, case-folded except on Linux. The list is persisted from the handlers,
not an effect on `dirPathList` (an effect would re-write the same JSON every
unrelated re-render). NESTED folders are NOT deduped — `/Docs` +
`/Docs/Psalms` gives two boxes both listing the same files.

**Others lists what is named after no chapter** (2026-09-15; asked for by the
user — *I want to be able to see others non related to `<book>.<chapter>.*`
files so I don't have to do search for those files*). A toolbar checkbox
(`resources-others-showing`, panel-wide like `resources-search-showing`)
passes `isOthersShowing` into `scanResourceFiles(dirPath, targets, searchText,
isOthersShowing, stop)`, which collects `otherFilePaths` in the SAME walk — no
extra readdir — capped at `MAX_OTHER_MATCHES` 200 (`isOthersTruncated` → **Too
many other files**). "Other" is `!checkIsBookChapterName(name)`: the part
before the first dot must be in `BOOK_KEY_SET` (the union of `bookKeysOrder`
from the KJV, KJVD and Douay-Rheims JSON, imported directly and NOT via
`bibleModelHelpers`, whose `SettingManager` would load into a node test) AND
`toChapterNumber` must parse. So `IMG.2.jpg` and a misnamed `GEN.01.pdf` ARE
others, while another chapter's `GEN.5.pdf` is not. Precedence per file:
verse match → search hit → other, so a file just typed for is never pushed
down into Others. The flag sits in the cache key between the targets and the
search text (the `${dirPath} ` prefix drop still works), and with it on an
empty reading still walks. Rows are drawn last under an `Others` found-label
WITHOUT `canAutoExpandLinks`, because 200 rows must not mean 200 `.json` reads.
`owa_click` on it answers `unverified` (it reads no checked state through the
wrapping `<label>`), so prove a toggle with a screenshot. Matrix `RD-116`,
W-37 step 5.

**Copy to Data Directory copies, then swaps the group IN PLACE** (2026-09-16;
asked for by the user — *move selected folder in Resources to under
selected-dir*, then *after copied then change the selection to the copied
one*). Group menu item between Reveal and Remove, left out when the folder is
already under `<parent dir>/resources` (`appManagedDataDirNames.RESOURCES`,
`checkIsInResourcesDataDir` — asked when the menu opens, not on render).
`copyResourcesFolderToDataDir` (`resourcesCopyHelpers.ts`) copies one entry at
a time through `fsListDirents` + `fsCloneFile` (links/junctions skipped, so a
loop cannot recurse) into a hidden `.copying-<ms>-<name>` staging folder,
picks the free name (`YouTube (1)`) only at the end and renames into place,
deleting the staging folder on any failure. The source is never touched.
Refusals are `ResourcesCopyError` with a `tran` key, so a disk error is not
dressed as one: gone → *Folder not found*; already a copy; and **a folder
that holds the parent dir** — a `Desktop` group shelved above a data dir
that lives on that Desktop, which would copy into itself. The two path
refusals (`getResourcesFolderCopyRefusalKey`, no disk) are asked BEFORE the
confirm too, so a Yes that could only be refused is never asked for; the copy
asks them again in case the parent dir changed while the confirm was open. The
renderer then `replaceResourcesFolder`s the list (same index, re-sanitized),
`carryResourcesFolderSettings` hands the expanded value to the copy BEFORE the
new box mounts (it reads the setting once), and the original's settings and
cache are dropped. Not in `dataDirectories.ts`, so the whole-data archive does
NOT carry `resources/` — an open size question, not an oversight.
The confirm body is HTML and `sanitizeHelpers.sanitizeHtml` is a no-op: paths
go through `escapeHtmlText` (Remove Folder's confirm too). `owa_click` cannot
press the confirm's Yes (firewall `question-press`), so a live check needs a
person at the window. Matrix `RD-117`, W-37 step 8.

**Add Files copies files INTO a folder, and never overwrites** (2026-09-17;
asked for by the user — *I want to be able to copy one or more files to the
resources selected folder*). Group menu item under **Add Folder**, offered on
EVERY group (unlike Copy to Data Directory). `selectFiles([{All Files, ['*']}])`
→ `copyFilesIntoResourcesFolder` (`resourcesCopyHelpers.ts`), sequential
`fsCloneFile` into `genFreeFilePath(dir, name)` — the index goes BEFORE the
extension (`GEN.4 (1).pdf`), and a name that is all extension (`.notes`) keeps
it on the end. A picked path that resolves to the file ALREADY at that name
here is skipped (case-folded off Linux) rather than copied beside itself; so is
one that is gone or is a folder. **A disk failure is RETURNED, not thrown**
(`{copiedFilePaths, skippedCount, error}`): the files that landed before it are
real, and a throw would leave the panel unable to say four of seven made it. It
sweeps up the part file (`fsCloneFile` can leave a truncated one) and stops
rather than carrying on to make more. Then the box drops its own cached walk,
re-scans and `setIsShowing(true)` — a folder that was folded would otherwise
answer the copy with nothing. **The toast says when a copy will not be DRAWN**:
`checkIsResourceFileListed` (in `resourcesScanHelpers.ts`, the same three
questions `walkForMatches` asks, no disk) run over what landed, and if none of
it is listed the message adds *Tick Others to see them* — a shelf that does not
visibly change is indistinguishable from a copy that failed.
`toResourcesFilesCopiedMessage` is where the wording lives, which is why that
module now imports `tran` and its node-env test has to mock `appProvider`
([[appprovider-mock-node-env]]). **The picker is a NATIVE dialog no CDP tool can
answer** — a live check needs a person, or the Win32 route used on 2026-09-17
(find the `#32770` window of the app's pid, `WM_SETTEXT` the path into the
`Edit` with id 1148, `BM_CLICK` the button with id 1). Matrix `RD-120`,
W-37 step 8.

**Two exceptions open INSIDE the app (2026-09-17):** a `.md`/`.markdown` row
opens the Markdown Preview window, and a `.own` row expands onto its notes (each
opening the Bible Note window read-only) and its marked verses with their
highlights and comments — see [[markdown-preview-window]].
Everything else still follows the rule below.

**Using a row: single click → `appProvider.systemUtils.openFile(filePath)`**
(OS default app). No drag payload, no double-click-present, no screen
integration, and PDFs deliberately bypass the app's pdf-to-images pipeline.
Row menu (Open / Copy Path / Reveal) deliberately does NOT import
`genCommonMenu` — that would pull `FileSource` + dir watchers + screen helpers
into the lookup panel. Same anti-import stance as `ResourcesDirBoxComp`
refusing `BibleCrossRefWrapperComp` (it copies only the collapsed-no-body
idea). `ENOTDIR` renders as "Folder not found". `toParentPathLabel` strips a
leading `/` because `app-ellipsis-left`'s `direction: rtl` would walk it to
the far end ([[app-ellipsis-left-reverses-names]]).

**Tests to copy from** (`ResourcesDirBoxComp.test.tsx`): jsdom pragma, partial
`vi.mock` of `appHooks` via `importOriginal`, stubbed `resourcesScanHelpers`
disk walk with real name helpers, hand-written `appProvider` mock — textbook
post-prune style per [[appprovider-mock-node-env]]. Docs: matrix rows
`RD-81..90` + `CM-93`, workflow `W-37`. Related: [[console-design-system-tokens]]
(its SCSS consumes the `--app-*` tokens; 23 lines moved up into
`src/others/appInit.scss`).
