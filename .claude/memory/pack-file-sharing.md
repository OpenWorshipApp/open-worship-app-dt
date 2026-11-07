---
name: pack-file-sharing
description: "A language or the Extra Binaries pack is passed on as a FILE (Download/Export to Downloads, Import from disk); a file no published pack vouches for is asked about first, and that question is a person's to answer"
metadata:
  node_type: memory
  type: project
  originSessionId: f2c7abb4-ab47-4c75-858e-15deea17c16d
  modified: 2026-11-04T20:41:36.091Z
---

Asked for 2026-11-04, the user: _as a user I want to able to store the
extra-bin and language downloaded file somewhere so I can share to my friend
easily_. The friend's computer often has no internet (a church back room).

- **Saving** follows the app's export convention: copied into Downloads,
  toast **Exported to**, folder revealed (`exportPackFile` in
  `src/helper/packFileHelpers.ts`). No save-as dialog exists in the app.
  Extra Binaries exports its KEPT archive as `bin-<v>-<platform>.tar.gz`
  (the platform in the name, because a friend may run another OS); a
  language catalog row's **Download** fetches and checksum-checks the pack
  into the temp folder first, then copies it out under its catalog name.
- **Importing** reads ONE json out of the pack first (`readPackFileJson`, tar
  `entries` filter into a throwaway temp dir) — `info.json` for Extra
  Binaries (its `platform` must equal `getExtraBinPlatformName()`, exactly),
  `meta.json` for a language (`toLangPluginMeta` + locale↔code + dotted
  version, since the version becomes a folder name). Nothing is extracted
  for a file that will be refused.
- **Trust**: both packs are code the app runs, in renderers with Node. A file
  whose sha512 matches ANY published version (the platform `info.json`'s
  whole `extraBin` map; the language catalog's every entry for that code) is
  installed without a question; otherwise — changed, or offline — the person
  is asked (`confirmUnverifiedPackFile`). In dev the local pack/catalog
  vouches. Do not drop the question to make offline smoother: offline is
  exactly when nothing else checks the file.
- An imported Extra Binaries archive goes in as `bin-<v>.tar.gz` through a
  `.import-…` temp name (the picked file may BE the target) and every other
  `bin-*.tar.gz` is deleted after extraction — Re-extract takes the first
  archive it lists. See [[extra-bin-on-demand]].
- A language import extracts straight from the picked file (no copy) through
  the same `runLangPackInstall` as a catalog install. See
  [[language-plugins-runtime]].

**Testing it live:** the native Open dialog is a `#32770` of the MAIN pid;
the file box is the `Edit` under the Win32 ComboBoxEx32 with control id `1148` —
`WM_SETTEXT` the path, then `WM_COMMAND` `IDOK` (same approach as the folder
picker in [[data-folder-live-test-recipe]]). The unverified-file confirm
cannot be answered by an agent: the MCP firewall refuses it, so leave it
for the person or test that path with a file the dev pack vouches for.
