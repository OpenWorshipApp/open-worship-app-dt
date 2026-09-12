---
name: experiments-html-in-canvas
description: "src/experiments/ (html-in-canvas, ~6.4k LOC) is a dev-only scratch harness excluded from the production build by vite's exclude-experiments plugin — don't 'fix' it, don't count it as product"
metadata:
  node_type: memory
  type: project
  modified: 2026-08-30T00:00:00.000Z
---

`src/experiments/html-in-canvas/` (24 files, ~6.4k LOC) is a scratch/demo
harness — `benchmarkDemo`, `snapshotDemo`, `youtubeMirrorDemo`,
`transitionEffects`, with its own `README.md`. Entry page is
`html/experiment.html`.

**It is dev-only and build-excluded by construction:** `vite.config.ts:45-52`
has a custom `exclude-experiments` plugin — `excludedHtmlFileNames =
['experiment.html']` and `excludedSrcDirPattern = /[\\/]src[\\/]experiments[\\/]/`
— that throws if product code imports from `src/experiments/` ("move it out of
src/experiments instead"). The dev server still serves the page as usual.
`electron/fsServe.ts:16` maps `experiment: 'experiment.html'`, but the file is
absent from a packaged build.

**Why it matters for reviews/QA:**
- Do not report its rough edges as product findings, and do not spend
  perf-review effort there; equally, product code importing anything from
  `src/experiments/` fails the build — that IS a finding.
- It is the second runner of the extra-bin binaries: `youtubeDemo.tsx` calls
  `resolveMediaStreamUrl` (`src/server/appHelpers.ts:336`), which runs yt-dlp
  with the shipped ffmpeg/qjs — the reason CLAUDE.md says
  `downloadVideoOrAudio` is the only *product* flow, not the only flow.
- The `ELECTRON_RUN_AS_NODE` note in `src/experiments/html-in-canvas/README.md`
  duplicates CLAUDE.md's dev-launch trap; the README is experiments-local
  documentation, not the source of truth.
