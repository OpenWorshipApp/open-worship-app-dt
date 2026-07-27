---
name: open-lyric-subtree-branch-dep
description: open-lyric is consumed via a git subtree-split branch, not a subdirectory URL; must be re-split and force-pushed on every update
metadata:
  type: project
---

The `open-lyric` devDependency points at `git+ssh://git@github.com/raksa/open-lyric.git#pkg-open-lyric`
— a `git subtree split --prefix=packages/open-lyric` branch of the private
`raksa/open-lyric` monorepo (local clone: `../open-lyric`). Set up 2026-07-26.

**Why:** npm has no syntax for installing a subdirectory of a git repo. The
previous spec `…/open-lyric.git/tree/main/packages/open-lyric` was a GitHub
*web-UI* path — npm silently stripped it and installed the 84 MB monorepo root
(`open-lyric@1.0.0`, main `scripts/electron-ol.mjs`, no `dist/`) instead of the
27 MB library (`open-lyric@0.1.0`, main `./dist/index.cjs`). It failed silently,
not loudly. The package's `dist/` is committed upstream, so the branch needs no
build step at install time.

**How to apply:**
- To ship an upstream change, re-split — the branch does NOT track `main`:
  ```
  cd ../open-lyric && git branch -D pkg-open-lyric
  git subtree split --prefix=packages/open-lyric -b pkg-open-lyric
  git push -f origin pkg-open-lyric
  ```
  The split reads committed history only; uncommitted `packages/open-lyric/dist`
  changes are excluded. Hashes are deterministic for identical history.
- **npm will not re-resolve on a plain `npm install`.** It rewrites the spec in
  the lockfile but keeps the old `resolved` commit and reports "up to date".
  Force it: `npm uninstall open-lyric --ignore-scripts` then
  `npm install --save-dev --ignore-scripts "git+ssh://…#pkg-open-lyric"`.
- **Keep the explicit `git+ssh://` spec.** npm normalizes it to the `github:`
  shorthand on save, which resolves via the codeload HTTPS tarball — that 404s
  because the repo is private, and only works via npm's SSH fallback. Re-edit
  `package.json` back to the `git+ssh://` form after any `--save` install.
- Cloning the repo on Windows needs `-c core.longpaths=true`; the
  `packages/*/dist/types-cjs/**` paths exceed MAX_PATH.
- Cleaner long-term alternative: the upstream repo already has a built-out
  `npm run pub` (`scripts/publish-packages.ts`) and the name `open-lyric` is
  unclaimed on npm — publishing would remove the git-clone cost from CI and
  `electron-builder` packaging.
