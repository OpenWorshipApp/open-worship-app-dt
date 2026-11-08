---
name: file-list-folder-sessions
description: "Documents / Presenting Flows / Bibles / Bible Notes carry the Background's folder-session strip under their title; the target IS the base folder setting, Default is never removable, outside writers follow the active session, verse marks stay in Default"
metadata:
  node_type: memory
  type: project
  originSessionId: dcf403cb-48da-44e7-a1cd-6b416b8a31cb
  modified: 2026-11-08T01:26:19.769Z
---

Since 2026-11-07 (the user: _I want the extra sessions for extra folder for all
other components_, then _I want it here_ — under the list's title, above the
folder row) the four `FileListHandlerComp` lists carry `Default · Session N · +`
through `FileListHandlerComp`'s `sessionsElement`, drawn between `.card-header`
and `.card-body` so an empty session still shows it. W-58, PM-170/171.

- **The session target is the base folder setting itself**
  (`select-dir-app-document`), so the keys are `<base>-sessions`,
  `<base>-active-session`, `<base>-s<id>` — all under the prefix the settings
  archive already files with that list. Default (id `''`) keeps `<base>`, the key
  Path Settings names. Bibles keep two lists (presenter / read).
- **Default is never offered for removal** (`MediaSessionsComp`). It used to be
  whenever 2+ sessions existed, and removing it deleted the panel's own base key
  (Background tabs included).
- **Stored half split out for the leaf rule**: `mediaSessionData.ts` (settings
  only) and `folderSessionHelpers.ts` (`getActiveDirSourceSettingName`, a
  setting read) are what `Bible.ts`, `Note.ts`, `lyricEditorBoot.ts` import;
  `folderSessionPathHelpers.ts` (DirSource + path compare) only the editor
  OPENERS. `MediaSessionsComp` re-exports the old names.
- **Anything made from OUTSIDE the list lands in the active session** (user's
  choice): `Bible.getDirSourceSettingName()` now returns the active key
  (`getBaseDirSourceSettingName()` is the page's base), Create Lyric / Generate
  Slides, Long Text menu, archive import (`getKindDirPath`), the agent file / run
  sheet / note / media workers. Selection helpers and Path Settings stay on the
  base on purpose.
- **Verse marks stay in Default** (user's choice): `verseAnnotationHelpers` calls
  `Note.getDefault({ isBaseSession: true })`; the Reader's note index scans
  Default ∪ active and refreshes on a session switch.
- **Editor popups get `&session=<id>`** (`SESSION_URL_PARAM_NAME`): settings are
  cached per window for 10 s, so the popup must not read the active setting.
- **Tests**: anything importing these modules without a mocked `settingHelpers`
  dies on `appProvider` at import — mock `folderSessionHelpers` per file (no
  shared mock). `useGenDirSourceReload` now follows a changed setting name, so a
  fake DirSource needs `settingName`.

**Why:** the user wants extra folders on every list, the same as the Background
tabs, without touching the folder the app was set up with.
**How to apply:** a new list or a new "save into the documents folder" path goes
through `getActiveDirSourceSettingName`; never let Default be removed. Related:
[[settings-global-vs-data-dir]], [[renderer-entry-static-closure]].
