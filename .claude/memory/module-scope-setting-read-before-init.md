---
name: module-scope-setting-read-before-init
description: "A setting read at MODULE LOAD in a renderer runs before init() names the data folder, so `$DATA_DIR_PATH` comes back unexpanded and is cached — packaged-only, because only there are the folder settings aliased"
metadata:
  node_type: memory
  type: project
  originSessionId: 9f558bb0-faed-4253-b6e9-40ff55fd584f
  modified: 2026-10-03T12:18:33.990Z
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

Related: [[portable-data-dir-alias]], [[injected-app-document-file-param]],
[[dev-data-dir-is-separate]].
