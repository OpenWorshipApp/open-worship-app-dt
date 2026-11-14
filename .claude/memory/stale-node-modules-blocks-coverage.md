---
name: stale-node-modules-blocks-coverage
description: A node_modules behind the lockfile fails tests on unrelated files and leaves no coverage report; a Windows reinstall can leave EMPTY package folders that npm calls up to date
metadata:
  type: project
---

Measured 2026-11-09 (UT-100), five days after a pull that bumped ~20
dependencies: `node_modules` still held vitest 4 (the lockfile says 5),
bible-note 0.4.4-dev (0.6.0), electron 44 (45). The first sign was not a
version error but `questions.test.mjs` failing "points every recipe at a
manual page that IS on disk": the old bible-note has no
`knowledge/ui-rag.md`, so `resolveBibleNoteGuidePath` is null and every
corpus row naming a `bible-note:ui/...` page looks missing. A failing test
means `coverage-gap.mjs` writes NO report.

`npm ls --depth=0 | grep -i "invalid\|missing"` shows the drift in a second;
run it before any long measurement.

The reinstall on Windows then left five package folders EMPTY
(`vitest/node_modules/picomatch`, `vitest/node_modules/magic-string`,
`lw-share/node_modules/commander`, the `@napi-rs` and `@standard-schema`
scopes) — vitest died at startup with `Cannot find package
.../vitest/node_modules/picomatch/index.js` — and `npm install` answered
"up to date" because its hidden tree cache trusted them. A vitest from an
older `npm run lint` was still running at the time, which may be why the
folders could not be filled. What fixed it: `find node_modules -mindepth 1
-maxdepth 3 -type d -empty`, `rmdir` those, delete
`node_modules/.package-lock.json` (npm's cache of the tree, not the
lockfile), `npm install` — "added 3, changed 3", and `package-lock.json`
byte-identical before and after.

**Why:** both failures look like broken tests or a broken vitest, and each
costs a ten-minute coverage run that ends with no number.

**How to apply:** before `coverage-gap.mjs` or `npm run lint` after a pull,
check `npm ls --depth=0` for invalid entries and `find` for empty package
folders. Related: [[coverage-run-load-flakes]],
[[coverage-number-is-loaded-files-only]].
