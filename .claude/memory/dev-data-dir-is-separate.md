---
name: dev-data-dir-is-separate
description: "Dev writes user content to Desktop\\open-worship-data-dev, not open-worship-data — checking the wrong dir makes working features look broken"
metadata: 
  node_type: memory
  type: project
  originSessionId: da5728a5-2e42-4a20-8512-65b8dc76a945
  modified: 2026-08-03T04:40:22.096Z
---

`npm run dev` stores **user content** (videos, audios, documents, lyrics, bibles) in
`C:\Users\racky\Desktop\open-worship-data-dev`, while the packaged build uses
`C:\Users\racky\Desktop\open-worship-data`. This is separate from the `userData`
redirect that CLAUDE.md already documents (`%APPDATA%\open-worship-app-dev`).

Confusingly, `getDefaultDataDir()` — used for the yt-dlp **temp** output path — still
resolves to the non-dev `open-worship-data`, so a download in progress writes its
`temp-<ts>.<ext>` there and only the finished file is moved into the dev dir.

**Why:** during the 2026-08-03 robot-test run, two YouTube downloads and one mp3 all
succeeded, but polling `open-worship-data\videos` showed nothing and the run was nearly
filed as a broken-binary failure. The binaries were fine.

Since refactor27 the yt-dlp/ffmpeg/qjs **binaries** follow this directory too — they are
installed into `<this dir>\extra-bin`, not shipped inside the app. See
[[extra-bin-on-demand]].

**How to apply:** read the real directory off the UI (`PathSelectorComp` text in the
Background panel) or check `open-worship-data-dev` first when verifying anything that
writes user files in dev. Related: [[build-kills-running-dev-app]],
[[open-lyric-subtree-branch-dep]].
