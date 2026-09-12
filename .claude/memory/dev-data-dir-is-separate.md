---
name: dev-data-dir-is-separate
description: "The -dev split is Electron userData only; user content follows appLocalStorage.defaultStorage (user-picked parent dir) — checking the wrong dir makes working features look broken"
metadata: 
  node_type: memory
  type: project
  originSessionId: da5728a5-2e42-4a20-8512-65b8dc76a945
  modified: 2026-08-03T04:40:22.096Z
---

The `-dev` suffix applies only to Electron `userData` (`electron/index.ts:41` — the
redirect CLAUDE.md documents). **User content** (videos, audios, documents, lyrics,
bibles) hangs off `appLocalStorage.defaultStorage`
(`src/setting/directory-setting/appLocalStorage.ts:27-42`): the user-selected parent
dir, falling back to `userData`. There is no `-dev` string anywhere in `src/`;
`Desktop/open-worship-data` is only a seeded default in the folder pickers
(`src/setting/directory-setting/directoryHelpers.ts:23-27`). The old Windows box had
dev pointed at `Desktop\open-worship-data-dev` and packaged at
`Desktop\open-worship-data`; on this macOS machine (`/Users/raksa/…`) the parent is
whatever the picker was given.

**FIXED:** the yt-dlp staging quirk is gone — downloads now stage in the OS temp
dir. `src/background/BackgroundVideosComp.tsx:198-205` ("Stage in the OS temp dir,
not getDefaultDataDir(): that one is hardcoded to Desktop/open-worship-data, so it
ignored both the dev data-dir override and any relocated media dir") calls
`downloadVideoOrAudio(videoUrl, getTempPath(), true)`; same in
`BackgroundAudiosComp.tsx:43-47`. `getDefaultDataDir()` is now only a default
offered in folder pickers.

**Why:** during the 2026-08-03 robot-test run, two YouTube downloads and one mp3 all
succeeded, but polling `open-worship-data\videos` showed nothing and the run was nearly
filed as a broken-binary failure. The binaries were fine.

Since refactor27 the yt-dlp/ffmpeg/qjs **binaries** follow this directory too — they are
installed into `<this dir>\extra-bin`, not shipped inside the app. See
[[extra-bin-on-demand]].

**How to apply:** read the real directory off the UI (`PathSelectorComp` text in the
Background panel) or check the `defaultStorage` parent dir first when verifying
anything that writes user files in dev. Related: [[build-kills-running-dev-app]],
[[open-lyric-subtree-branch-dep]].
