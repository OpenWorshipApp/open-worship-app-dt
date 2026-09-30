---
name: open-lyric-subtree-branch-dep
description: open-lyric is consumed as a pre-built dist repo pinned to a version tag (open-lyric-dist#0.1.55); the old git subtree-split branch is history
metadata:
  type: project
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
a tag: `"open-lyric": "https://github.com/raksa/open-lyric-dist#0.1.55"`
(`package.json:169`). To ship an upstream change, publish a new dist tag and
bump the `#<tag>` in package.json, then `npm i` — npm re-resolves on a changed
ref. Same shape for `bible-note-dist#0.4.0-dev` (:150) and
`open-lyric-plugin-km-kh-dist#0.1.10` (:170). The old git+ssh subtree-split
branch (#pkg-open-lyric) is history only — its gotchas (npm normalizing
`git+ssh://` to the `github:` shorthand that 404s on a private repo, Windows
clones needing `-c core.longpaths=true`) no longer apply to the dist model.
