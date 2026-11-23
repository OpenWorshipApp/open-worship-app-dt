---
name: pptx-converter-file-dependency
description: "pptx-to-html-conv is `file:../pptx-to-html-conv-dist`; .npmrc install-links=true is what makes the main process find its fflate/@xmldom; how a converter change reaches the app"
metadata:
  node_type: memory
  type: project
  originSessionId: 856d4cd1-e9b6-4e4e-813d-848691398e74
  modified: 2026-11-20T13:46:16.322Z
---

Since 2026-11-20 the user installs the PPTX converter from the sibling dist
folder: `"pptx-to-html-conv": "file:../pptx-to-html-conv-dist"`
(`docx-to-html-conv` was still `^1.0.4` from npm that day).

**Linked, it breaks conversion.** npm's default makes `node_modules/pptx-to-html-conv`
a symlink. Node resolves the package by its real path, and the dist folder has
no `node_modules`, so loading it fails with `Cannot find module 'fflate'`.
The electron main process is plain `tsc` output, not bundled, so every PPTX
conversion would fail. The repo's `.npmrc` sets `install-links=true`: npm then
installs the folder as a copy, and its dependencies sit in the app's
`node_modules`. Without it, a plain `npm install` turns the copy back into a
symlink. Check with `node -e "require('pptx-to-html-conv').getVersion()"`.

**How a converter change reaches the app:**

1. Edit `pptx-in-html-out` (C# and `PptxToHtml-JS`) and bump the version on
   both sides.
2. `./pack.sh --only pptx` builds `packages/pptx-to-html-conv`.
3. Sync that into `../pptx-to-html-conv-dist`. `./copy-packages.sh` syncs DOCX
   too; on 2026-11-20 the DOCX dist held an uncommitted older pack, so only
   PPTX was synced by hand, with the same keep-`.git` rule.
4. `npm install` in the app refreshes the copy.
5. Relaunch, because the main process holds the converter module. Under
   `electron:dev`, a save in `electron/` relaunches by itself.
6. A new `toolVersion` makes every deck rebuild its preview on next open
   (`info.json`).

**Why:** the user iterates on the converter and the app together without
publishing each step ([[office-converter-fixes-go-upstream]]).

**How to apply:** after any converter edit, repack and reinstall before a live
check. When conversion fails in the main process, look for the symlink first.
See [[stale-node-modules-blocks-coverage]] for the older version of this trap,
a registry install behind the lockfile.
