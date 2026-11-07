---
name: open-lyric-subtree-branch-dep
description: "open-lyric is consumed as a pre-built dist repo pinned to a version tag (open-lyric-dist#0.1.71 in the app's package.json); Khmer's song plugin is pinned in the Khmer folder's own package.json; the old git subtree-split branch is history"
metadata:
  node_type: memory
  type: project
  originSessionId: b18a1624-47ea-4c01-bf80-37d943e60701
  modified: 2026-11-05T14:35:29.039Z
---

The `open-lyric` dep once pointed at `git+ssh://git@github.com/raksa/open-lyric.git#pkg-open-lyric`
— a `git subtree split --prefix=packages/open-lyric` branch of the private
`raksa/open-lyric` monorepo (local clone: `../open-lyric`). Set up 2026-07-26.

**Why:** npm has no syntax for installing a subdirectory of a git repo. The
previous spec `…/open-lyric.git/tree/main/packages/open-lyric` was a GitHub
*web-UI* path — npm silently stripped it and installed the 84 MB monorepo root
(`open-lyric@1.0.0`, main `scripts/electron-ol.mjs`, no `dist/`) instead of the
27 MB library (`open-lyric@0.1.0`, main `./dist/index.cjs`). It failed silently,
not loudly. That constraint is the reason the dist repos below exist.

**How to apply:** Superseded 2026-08. The dep is a pre-built dist repo pinned to
a tag: `"open-lyric": "https://github.com/raksa/open-lyric-dist#0.1.71"` in the
app's `package.json` (2026-11-05; it was `#0.1.55` when this was written). To
ship an upstream change, publish a new dist tag and bump the `#<tag>` in
package.json, then `npm i` — npm re-resolves on a changed ref. Same shape for
`bible-note-dist` and `open-lyric-plugin-player-dist`. **The Khmer song
plugin, `open-lyric-plugin-km-kh-dist#0.1.10`, is no longer the app's**
(2026-11-05): it is pinned in `src/lang/data/online/km/package.json` and
installed into that folder's own `node_modules` (`extra-work/install-lang-deps.mjs`);
bump it there, `npm install --allow-git=all` in that folder, and raise
Khmer's version (rule `language-packages.md`). The old git+ssh subtree-split
branch (#pkg-open-lyric) is history only — its gotchas (npm normalizing
`git+ssh://` to the `github:` shorthand that 404s on a private repo, Windows
clones needing `-c core.longpaths=true`) no longer apply to the dist model.
