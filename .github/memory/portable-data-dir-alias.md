---
name: portable-data-dir-alias
description: "Files inside the data folder store its path as $DATA_DIR_PATH (every JSON escape level + file:/// URLs); only fileHelpers' four text primitives expand it, so any RAW reader sees the alias"
metadata: 
  node_type: memory
  type: project
  originSessionId: b60702cd-9c15-40fd-8f23-3d8e376f0710
  modified: 2026-09-19T17:28:00.237Z
---

Since 2026-09-17 (user request: a data folder on a flash drive, opened on any
computer and any OS), text written INSIDE the data folder stores the folder's
own path as `$DATA_DIR_PATH`, and every text read expands it to wherever the
folder is now. Pure logic in `src/server/dataDirAliasHelpers.ts`; wired into
`_fsReadFile` / `_fsWriteFile` / `fsReadSync` / `fsWriteFileSync` in
`src/server/fileHelpers.ts`. The switch is
`appProvider.sessionData.defaultStorageDirPath` (the one mutable field on
`appProvider`), preloaded first thing in `init()` (`src/boot.ts`) and in
`src/screen.tsx` `main()` (the screen never runs `init`), updated by
`appLocalStorage.setSelectedParentDirectory`; `null` turns it off.

What is not obvious from a quick read:

- The alias is stored in the escape level the path had: raw
  `$DATA_DIR_PATH\videos\a.mp4`, JSON `$DATA_DIR_PATH\\videos`, note content
  `\\\\`, up to 3 levels, and `file:///$DATA_DIR_PATH/…` for URLs. Restoring a
  raw `E:\data` inside JSON makes `JSON.parse` throw — never "simplify" it to a
  plain `replaceAll`. Replacements are FUNCTIONS: `$&` in a folder name is a
  replacement pattern.
- Anything reading data-folder bytes without those four functions sees the
  alias: `fsCloneFile`/`copyFile`, tar archives (`.owadata`, `.owadoc` …), a
  `fetch`/`<iframe src=file://>`, the main process, external tools, and the
  archive import's MD5 dedupe (an aliased copy differs from a pre-change one).
  A new raw reader or writer of data-folder TEXT must go through `fileHelpers`
  or apply the transform itself.
- Web files (`mimeWebList`: .html .htm .xml .xhtml .xht) are skipped on both
  sides — web backgrounds are loaded by an iframe straight from disk.
- Writes are rewritten only inside the data folder (`prefix` = dir + one
  separator, so `open-worship-data-dev` is not `open-worship-data`); reads
  resolve the alias anywhere, so a file copied off the drive still works.
- Lazy: a file becomes portable only when this version next writes it.
  Older app versions read `$DATA_DIR_PATH` literally.
- Cross-OS: the path tail is converted to native separators on read. Exact for
  JSON values, keys and settings; when Windows reads text written on
  macOS/Linux the escape level is taken from the nearest `"` on that line
  (line-local on purpose, so an editing-history patch line resolves like its
  file line).
- Verified live 2026-09-17 on the dev data folder: `screen-bg-manager`,
  `screen-vary-app-document-manager`, `itemSourcesMeta` and agent backups
  stored aliased and survived reloads (on-screen marks and colour notes are
  exact string matches, so a wrong restore would have shown).
- Driving the settings folder from a shell: some `local-storage` file names
  start with `-`, so `grep … *` silently reads them as options — use
  `grep -- pattern ./*`.

**What the alias could not reach, added 2026-09-19 (`/owa-enhance reliability`,
`EN-22..EN-35`, applied the same day):**

- **The folder is found again.** `.owa-data-folder.json` (`{id,…}`) is written
  into the chosen folder; the host keeps `selected-parent-dir-id` beside
  `selected-parent-dir`. A missing folder is KEPT as the choice (it used to be
  deleted from `setting.json`, so a stick plugged in late was forgotten for
  good), looked for under every other mount point and adopted when the id
  matches (`findMovedDataDirSync`), else named at start-up with Retry
  (`useCheckSetting` in `src/others/main.tsx`). A computer with nothing chosen
  is offered a marked folder on a drive. The scan runs ONLY in those two
  cases, synchronously, through `readdirSync` in the preload.
- **Names made from paths.** A setting FILE NAME cannot hold the alias, so
  `toFilePathSettingKey` writes a file inside the folder as `@data_…`
  (`toDataDirRelativePath`), capped at 150 bytes with a hash; old names were
  renamed once per data folder (`settingKeyPathMigration.ts`, marker setting
  `setting-key-path-migration`). `toAbsoluteFilePathSettingKey` is the old
  form, kept for the older run-sheet rename migration.
- **Stale absolute paths are repaired on request**: Settings → Path Settings →
  **Repair Links** (`repairDataDirLinks` / `repairDataDirLinksInText`) rewrites
  a link whose path is gone and whose file exists under this folder AS the
  alias, in the link's own form (raw `/`, JSON `\\`, `file:///`). The read side
  then does the rest. Never automatic: it reads every text file once.
- **Deleting on a stick**: Windows has no Recycle Bin on a flash drive and
  Electron's `trashItem` aborts there (`Operation was aborted`); the app asks
  **Delete Permanently** instead of failing, except for an agent's delete.
- The user wants every such path/name helper in `src/server/fileHelpers.ts`
  ([[path-handling-lives-in-filehelpers]]).

**Why:** the user runs the app and its data folder from a flash drive on
different computers and operating systems.

**How to apply:** when adding code that reads, writes, copies or packs text in
the data folder, or hands such a file to something other than the app's own
readers, decide whether it must see real paths or the alias. A NAME derived
from a path goes through `toDataDirRelativePath`, never the absolute path.

Related: [[history-read-cache-stale-paths]], [[agent-data-tools-backup-undo]], [[data-archive-owadata]], [[dev-data-dir-is-separate]], [[extra-bin-on-demand]].
