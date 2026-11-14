---
name: module-scope-setting-read-before-init
description: "A setting read before init() names the data folder (at MODULE LOAD, or in the Lyric editor's same tick) gets `$DATA_DIR_PATH` unexpanded — releases 10.24..11.02 could not open any song in the Lyric editor on a new data folder; a user's build is identified by its stack trace's line numbers, not its version"
metadata:
  node_type: memory
  type: project
  originSessionId: 9f558bb0-faed-4253-b6e9-40ff55fd584f
  modified: 2026-11-12T17:41:18.540Z
---

Fixed 2026-10-03 (v2026.10.01 packaged, reported with a screenshot): the
Document Editor popup opened on "No App Document Selected" / "No slide
selected" with a document selected in the Presenter, and afterwards the
Presenter's own Slide Editor button said "No slide selected" too.

Chain: `appDocumentHelpers.tsx` resolved `?file=` at module load via
`DirSource.getDirPathBySettingName('select-dir-app-document')`. Entry modules
are evaluated before `init()` body (`boot.ts`) sets
`appProvider.sessionData.defaultStorageDirPath`, and until then
`fsReadSync` does NOT expand the alias — so the setting read back as the
literal `$DATA_DIR_PATH\documents` and `appLocalStorage.getItem` CACHED it.
The injected file looked missing (title lost its file name); then
`checkSelectedFilePathExist` saw a documents folder that "did not exist" and
blanked the SHARED `selected-vary-app-document` setting for every window.
Evidence was the setting files' mtimes: `-item` written, the selection
emptied 3 s later as the popup opened.

**Why dev never shows it:** the dev data folder (`open-worship-data-dev`)
holds `select-dir-app-document` as an ABSOLUTE path pointing outside it, so
there is no alias to expand. Packaged, the folders live inside the data folder
and are stored aliased.

**How to apply:** never read a setting, a data-folder file or a folder path at
module scope in anything a renderer entry imports statically — do it lazily,
on first use after `init()`. URL-only facts (query params, `isPage*`) are safe
at module load. When a bug reproduces only in the packaged app and involves a
path, check for a pre-`init` read first. Regression test:
`appDocumentHelpers.test.tsx` "resolves its injected file after boot".

**Second case, the Lyric editor (reported 2026-11-12 from a church machine).**
`lyricEditor.tsx` starts `init()` without awaiting it and calls `getLyric()` in
the same tick, so `init` must set the data folder BEFORE its first `await`.
`c8dcc3116` (2026-10-18, the Desktop move) put an `await` ahead of that line:
releases 2026.10.24, 10.25 and 11.02 answer `Lyric file not found` for every
song on a data folder whose Documents setting is `$DATA_DIR_PATH\documents` --
every brand-new folder, from its first save. Fixed 2026-11-06 (await only
while a move is waiting) and 2026-11-12 (and only in the main window, the one
`runPendingDataDirMove` runs in). Held by the same-tick tests in
`boot.test.ts` / `boot.ut99.test.ts`. Seen live on a scratch profile: the
fixed build opens the song; the 11.02 order, replayed on the same files, gives
the reported error.

**Telling which build a user runs:** `package.json` stayed `2026.11.02` for
builds days apart (the local `release/` pack of 2026-11-09 already had the
fix), and the public GitHub releases stop at 2026.01.11. Match the stack
trace's `file:line:col` against `git show <tag>:<file>` instead
(`lyricEditorBoot.ts:119` + `lyricEditor.tsx:36:48` = the 10.24..11.02 code).
A path pasted into a chat app that shows `user.owa` is the app's Markdown
eating `\.`, not the app: Copy Path writes the real path and reads it back.

Related: [[portable-data-dir-alias]], [[injected-app-document-file-param]],
[[dev-data-dir-is-separate]], [[scratch-dev-instance-beside-user-app]].
