---
name: resources-panel
description: "Resources = 4th Bible-Find tab listing the user's own <bookKey>.<chapter>.* files; budgeted breadth-first scan, 10s cache, NO watcher, click opens the OS app — never a drag or a present"
metadata:
  node_type: memory
  type: project
  modified: 2026-08-30T00:00:00.000Z
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
Second entry point: verse context menu → **Open in Resources** (`CM-93`).
There is no `ResourcesComp.tsx` — chain is `ResourcesPreviewerComp` →
`ResourcesRendererComp` → N × `ResourcesDirBoxComp` → `ResourcesFileRowComp`.

**Verse plumbing is a single mutable slot.** `BibleItemsViewController`
exposes `setResourcesVerseKey` (default no-op); `set selectedVerseKey` writes
ONE setting and fans out to it. `ResourcesPreviewerComp` installs itself on
mount and restores the no-op on cleanup — two mounted previewers would clobber
each other. Incoming verse changes debounce 500 ms (per-instance `useMemo`'d
`genTimeoutAttempt`); mount applies the current verse immediately, bypassing
the debounce. `verseEnd` is forced to `verseStart` (`// TODO: support multiple
verses`). Only `bookKey` + `chapter` drive the scan, passed as primitives —
arrowing between verses of one chapter does NOT re-scan.

**Scanning is lazy twice over and budgeted** (`resourcesScanHelpers.ts`):
the tab is `lazy()` + only-active-tab-mounted, and a collapsed folder never
mounts its body so it never touches the disk (tested: "a collapsed folder
never touches the disk"). `walkForMatches` is breadth-first with an explicit
queue (a budget that runs out mid-walk still keeps shallow finds) and budgets
`MAX_SCAN_DEPTH 8`, `MAX_SCAN_DIRECTORIES 1500` (the real budget — cost is
readdir calls), `MAX_SCAN_ENTRIES 20000`, yield every 16 dirs. It uses
`fsListDirents` (`readdir withFileTypes`, one syscall, no per-entry stat) —
symlinks are neither file nor directory so they are silently skipped (no
symlink cycles by construction). Unreadable ROOT re-throws; unreadable
subfolder is skipped. Hidden (dot) names are skipped and not descended into.
Truncation is surfaced in the UI, never silent.

**Cache + invalidation: NO watcher, by design.** A module-level
`CacheManager(10)` (10 s TTL) stores MATCHES only, never listings, keyed
`` `${dirPath} ${bookKey} ${chapter} ${searchText}` `` (search text last so a
`${dirPath} ` prefix drops a whole folder). The walk runs inside
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
