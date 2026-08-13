---
name: extra-bin-on-demand
description: "yt-dlp/ffmpeg/qjs left the app package on refactor27 — they install on demand into `<data parent>/extra-bin`, and the archive is kept on purpose"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7cc13309-067b-48ac-94f6-322589474419
  modified: 2026-08-13T01:39:20.814Z
---

As of refactor27 (2026-08-10) the three media binaries are **no longer bundled**.
`extra-work/copy-build.mjs` stopped copying them (it still handles `eot2ttf` and
`db-exts`); `extra-work/build-extra-bin.mjs` packs them into
`extra-work/experiment-building/release/bin-<ver>.tar.gz` instead, on the **`install`**
npm lifecycle (`package.json` → `extra-work/build.sh`), not on `build`.

**Why:** ~36 MB per platform in every installer for a flow most users never touch, on an
app whose whole point is running on weak church hardware.

**How to apply:**

- Runtime paths come from `src/helper/extra-bin/extraBinHelpers.ts`
  (`<appLocalStorage.defaultStorage>/extra-bin/{yt,ffmpeg/bin,qjs}`), and the renderer
  hands the yt-dlp path to `appProvider.ytUtils.getYTHelper(path)` —
  `electron/client/ytUtils.ts` resolves nothing any more and caches keyed on the path.
  Anything reaching for `bin-helper/yt|ffmpeg|qjs` is stale by definition.
- Every yt-dlp caller goes through `requireExtraBinPaths()` first (lazy `import()`, so
  `appHelpers` stays off the storage/popup graph). It returns `null` after offering the
  Settings jump; callers reject with `EXTRA_BIN_MISSING_ERROR_MESSAGE`
  (`extraBinErrors.ts`, a leaf module) and the Background comps stay quiet for it.
- **The downloaded `bin-*.tar.gz` is deliberately kept** inside `extra-bin` so Re-extract
  works offline. `extractDownloadedBible` is the tempting model and it deletes in its
  `finally` — do not copy that.
- `extra-bin` is intentionally absent from `dataDirectories.ts`, which is what keeps it
  out of the `.owadata` archive. See [[dev-data-dir-is-separate]].
- Publishing: `s3-push-release.js` READ-MODIFY-WRITES the platform `info.json` via
  `GetObjectCommand`, because the `extraBin` map is cumulative (one entry per app
  version, keyed by the **zero-padded** `2026.07.26` form). A blanket `catch → {}` there,
  or reading the public URL and getting the CDN's SPA-index HTML, silently orphans every
  older release.
- In dev the install is mocked from the locally built pack; `npm run dev` does NOT build
  it, only `npm i` does.
- **The pack does NOT follow a change of parent data directory.** The path is recomputed
  from `appLocalStorage.defaultStorage` on every call, so repointing the parent dir
  silently orphans the whole ~28 MB install and the panel just says *Not installed* — with
  a perfectly good copy sitting under the old parent. Seen live on 2026-08-12: a QA run
  found the pack missing at `open-worship-data-dev\extra-bin` while a complete 0.0.2 sat in
  `open-worship-data\extra-bin`. That is the guard working, **not** a bug; re-install and
  move on instead of hunting a regression.
- **yt-dlp is too short-lived to catch by polling after the fact** — even a 100 MB download
  can finish inside a 5 s interval, and the process never shows up. To capture its command
  line (`MD-03`), start the `Get-CimInstance Win32_Process -Filter "Name='yt-dlp.exe'"`
  poller **in the background first**, then trigger the download.
