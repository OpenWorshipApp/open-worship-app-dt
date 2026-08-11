---
name: extra-bin-on-demand
description: yt-dlp/ffmpeg/qjs left the app package on refactor27 — they install on demand into `<data parent>/extra-bin`, and the archive is kept on purpose
metadata:
  type: project
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
