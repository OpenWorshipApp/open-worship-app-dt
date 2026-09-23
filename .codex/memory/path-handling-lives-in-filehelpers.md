---
name: path-handling-lives-in-filehelpers
description: "The user wants ALL file-path and file-name handling in src/server/fileHelpers.ts alone -- no new path helper modules, no ad-hoc splitting on separators at call sites"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 07ad4bd9-ad13-4028-aafd-b123bec37a80
  modified: 2026-09-19T16:30:38.476Z
---

File-path and file-name logic belongs in `src/server/fileHelpers.ts`: joining,
splitting, base names, "is this absolute on this OS", portable file-name rules
(`getPortableFileNameProblem`, `toPortableFileName`, `toBaseNameOfAnyOs`,
`checkIsNativeAbsolutePath`). A call site asks fileHelpers; it does not
`split('/')`, `lastIndexOf(pathSeparator)` or keep its own sanitizer.

**Why:** said by the user on 2026-09-19, mid-way through the portable-data
work (EN-22..35), when a separate `portablePathHelpers.ts` had just been
created: "if possible I want all file path to be handled in
src\server\fileHelpers.ts alone". Scattered path code is how the cross-OS
bugs of that report arose — each site knew only the running OS's separator.

**How to apply:** add a new path/name helper to fileHelpers.ts (pure ones are
tested in `src/server/fileHelpers.test.ts`, which mocks `appProvider` with
`path.win32`). When touching a site that parses paths itself, route it through
fileHelpers. A test file that stubs `./fileHelpers` wholesale needs the real
rule borrowed with `importOriginal` (and `pathUtils.sep` on its appProvider
stub, which fileHelpers reads at load). `dataDirAliasHelpers.ts` predates this
and is still separate. Related: [[portable-data-dir-alias]].
