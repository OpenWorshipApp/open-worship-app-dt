---
name: monaco-css-test-failure-local-open-lyric
description: FIXED 2026-08-07 — the `Unknown file extension ".css"` failure from the local file: open-lyric dep is gone; tests now mock open-lyric / bail before importing it
metadata:
  type: project
---

`package.json` points `open-lyric` at
`file:../open-lyric/packages/open-lyric-0.1.42.tar.gz` instead of the git dist.
A `file:` dependency is not externalized/prebundled the way the git dep is, so
its transitive monaco CSS import used to reach node's ESM loader raw and fail
`src/lyric-list/Lyric.test.ts` + `src/server/appProvider.mock.test.ts` with
`TypeError: Unknown file extension ".css" for …/inlineProgressWidget.css`.

**FIXED 2026-08-07** (uncommitted at time of writing) — two changes, no config
change:

- `Lyric.test.ts` now `vi.mock('open-lyric', () => ({ MARCH_OF_GRACE_EXAMPLE:
  … }))`, the same pattern `lyricHelpers.test.ts` already used.
- `initLyricMock` in `src/server/appProvider.mock.ts` moved its
  `location.pathname.includes('lyricEditor.html')` early return ABOVE its five
  dynamic imports, one of which is `../lyric-list/Lyric`. It was importing the
  whole lyric+monaco chain and then discarding it on every non-lyric page.

**How to apply:** do NOT "fix" this by inlining the dep
(`test.server.deps.inline: ['open-lyric']`). That was tried and is strictly
worse: Vite then executes open-lyric's browser code in the node environment, so
`Lyric.test.ts` dies on `document is not defined` and monaco's clipboard module
dies on `document.queryCommandSupported is not a function`. The dep must stay
externalized and simply not be loaded by tests. See
[[open-lyric-subtree-branch-dep]] for how the dep is normally consumed, and
[[vitest-env-leak-flakes]] for the unrelated whole-suite flakes.
