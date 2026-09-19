---
name: vite-dep-optimizer-504-restart
description: A 504 on a /node_modules/.vite/deps/* chunk means a stale dep-optimizer cache; touch vite.config.ts to restart the dev server without killing the Electron app
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f04bc2fc-3469-4a09-8e3a-7de58f3cfc35
  modified: 2026-09-13T01:04:40.860Z
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

**Third shape (2026-09-12) — FIXED in `vite.config.ts` `optimizeDeps`:** a 504
on `.vite/deps/open-lyric-plugin-km-kh.js`, imported by
`src/lang/data/km/index.ts`, which is reached ONLY through `langHelpers.ts`'s
template `import(`./data/${langCode}/index.ts`)`. The dep scanner cannot follow
a template import, so that package was discovered at runtime on EVERY cold
server, and this time the server stayed stuck answering 504 for that `?v=` across
reloads (the committed `_metadata.json` never listed it). The fix is
`exclude: ['open-lyric-plugin-km-kh']` + `include: ['open-lyric/internal']`,
and deliberately NOT `include` of the plugin: it loads its fonts, dictionaries
and spellcheck worker with `new URL('assets/…', import.meta.url)`, which would
point into `.vite/deps/` once pre-bundled; excluded, Vite rewrites them to
`/@fs/…/open-lyric-plugin-km-kh/dist/assets/…` (all 200). Its one bare import,
`open-lyric/internal`, has to be included or it is discovered at runtime the
same way; bundled in the same run as `open-lyric`, both import one shared chunk,
so `registerPlugin` reaches the one registry. A new language file that imports a
package needs the same treatment. Vite 8 gives each optimized file its OWN `?v=`
— curling one file with another's hash 504s and proves nothing.
