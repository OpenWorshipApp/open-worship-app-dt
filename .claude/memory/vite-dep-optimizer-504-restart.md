---
name: vite-dep-optimizer-504-restart
description: A 504 on a /node_modules/.vite/deps/* chunk means a stale dep-optimizer cache; touch vite.config.ts to restart the dev server without killing the Electron app
metadata:
  type: feedback
---

When a window fails with `Failed to fetch dynamically imported module:
.../node_modules/.vite/deps/<dep>-<hash>.js?v=<browserHash>` plus a bare 504,
the Vite dev server re-optimized deps and the page still holds the old
`?v=` hash. Reloading (even with `ignoreCache`) does NOT fix it — Vite's
server-side transform cache still emits the old hash.

**Why:** happens after any dependency change (`package.json` edits, a
re-installed local tarball dep like `open-lyric`), and it looks exactly like a
broken feature — e.g. the Lyric Editor stuck on "Failed to initialize editor".

**How to apply:** append a newline to `vite.config.ts`, wait ~5s (Vite
auto-restarts on config change), then restore the file — the restart clears the
transform cache and re-optimizes, and the Electron windows stay alive. Confirm
with `node_modules/.vite/deps/_metadata.json` (`browserHash` changes). Do NOT
restart `npm run dev`; that kills the user's running app. See
[[build-kills-running-dev-app]].
