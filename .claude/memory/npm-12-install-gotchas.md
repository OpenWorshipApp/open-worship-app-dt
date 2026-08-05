---
name: npm-12-install-gotchas
description: npm 12 blocks this project's git deps and install scripts by default; plain `npm i` leaves electron with no binary
metadata:
  type: project
---

Local npm is v12 (node v22.22.3, win-arm64), which changed two defaults that
break a plain `npm i` here:

1. `allow-git = "none"` → `npm error code EALLOWGIT` on the five git deps
   (`bible-note`, `open-lyric`, `open-lyric-plugin-km-kh`, `docx-to-html`,
   `pptx-to-html`). Install with `npm i --allow-git=all` (there is no `.npmrc`
   in the repo as of 2026-08-03). See [[open-lyric-subtree-branch-dep]].
2. Install scripts are blocked unless covered by `allowScripts`. `npm
   install-scripts ls` shows `@swc/core`, `esbuild` (x2), `@parcel/watcher`,
   `electron-winstaller` blocked — all harmless, since the win32-arm64 native
   packages install as normal optional deps.

**The real casualty is electron:** its zip lands in
`~/AppData/Local/electron/Cache` but `node_modules/electron/dist/` is never
extracted, so `npm run dev` has no `electron.exe`. Fix with
`node node_modules/electron/install.js` after every fresh install.

**Why:** these are npm-version defaults, not repo breakage — the errors look
like a broken dependency list or a corrupt lockfile.

**How to apply:** run `npm i --allow-git=all`, then
`node node_modules/electron/install.js`, then verify
`node_modules/electron/dist/electron.exe` exists before trying
[[dev-data-dir-is-separate]] / `npm run dev`.
