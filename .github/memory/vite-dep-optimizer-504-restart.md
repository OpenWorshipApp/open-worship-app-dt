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

**Second shape (2026-09-08):** the SAME error on an `/@fs/.../node_modules/
<dep>/dist/*.mjs` URL, surfacing in the app as the "Reload is needed" dialog
(`errorHelpers` → `main.tsx:147`). That is a dep Vite had never pre-bundled
being DISCOVERED on first use — `bible-note` is imported lazily
(`import('bible-note')` in `bibleNoteShortVerseHelpers.ts`), so its first
resolution runs the optimizer, which invalidates the in-flight module graph
and fails the dynamic import. Once `_metadata.json` lists the dep the reload
works; the durable fix is `optimizeDeps.include` for lazily-imported deps.
