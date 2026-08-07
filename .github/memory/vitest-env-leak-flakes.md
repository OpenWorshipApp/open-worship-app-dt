---
name: vitest-env-leak-flakes
description: Node-env vitest files that import appProvider only pass when a jsdom file shares the worker; also a whole-suite "reading 'config'" flake
metadata:
  type: project
---

`vitest.config.ts` sets `environment: 'node'` globally; jsdom is opted into
per-file with a `// @vitest-environment jsdom` first line. Workers are reused
across files, so jsdom globals **leak** into later node-env files in the same
worker. A test that transitively imports `src/server/appProvider.ts` (which does
`document.addEventListener(...)` at module scope, and whose `appProvider.mock.ts`
reads `globalThis.document.title` at module scope) therefore passes or fails
depending on file scheduling. Seen 2026-07-26: `src/toast/toastHelpers.test.ts`
passed for several runs, then failed with `ReferenceError: document is not
defined` — fix is the jsdom pragma on the test file, not a guard in
`appProvider.mock.ts` (appProvider itself needs a DOM regardless).

**Why:** looks like a random/unrelated break in an untouched file; the real cause
is missing-pragma + worker reuse.

A missing pragma also **masks stale assertions**: the suite dies at import, so
vitest reports it as `(0 test)` / "Failed Suites" and none of its `expect`s ever
run — the file rots against the code silently. Seen 2026-07-29:
`src/app-document-list/documentVariants.test.ts` had been asserting
`appLog` twice from `showContextMenu`, long after `PptxAppDocument` was changed
to build a real Reload context menu (`44c15c3e`). Adding the pragma surfaced two
further breaks in one go: an unmocked `showAppContextMenu`, and the real `tran()`
reaching `appLocalStorage` → `getUserWritablePath`, which the file's
`fileHelpers` mock does not provide. Expect to fix the test's *content*, not just
its environment. A "(0 test)" line in the vitest output is a failure, not a skip.

**How to apply:** any new/failing test whose imports reach `appProvider`,
`FileSource`, or React components needs the `// @vitest-environment jsdom`
pragma. To find latent cases, run all pragma-less files together — they then get
a pure node worker and any DOM dependency fails deterministically:
`npx vitest run --config vitest.config.ts $(grep -rL "@vitest-environment" $(git ls-files 'src/**/*.test.ts*'))`

Separately, `npm run lint` occasionally aborts with **all 159 test files** failing
`TypeError: Cannot read properties of undefined (reading 'config')` /
"Vitest failed to find the runner" and `Tests no tests`. That is a transient
worker-startup flake, not a code break — re-run before investigating. See
[[lint-known-failure-stale]].
