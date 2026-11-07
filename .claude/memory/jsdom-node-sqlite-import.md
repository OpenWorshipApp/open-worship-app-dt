---
name: jsdom-node-sqlite-import
description: A jsdom test file that statically imports `node:sqlite` fails to LOAD on Node 22 before 23.5 ("Cannot bundle Node.js built-in"); read it with `process.getBuiltinModule` instead
metadata:
  type: project
---

`node:sqlite` is a prefix-only built-in, and before Node 23.5 it is missing
from Node's list of built-in module names, though Node still loads it.
Vite's resolver for vitest's jsdom (client) environment checks that list, so
a jsdom file with `import { DatabaseSync } from 'node:sqlite'` dies before a
single test runs: _Cannot bundle Node.js built-in "node:sqlite" imported
from …_ — the whole file reads as `no tests`. Seen 2026-11-04 on Node 22.20
(the repo allows `>=22.12`): both `agentBibleFindHelpers` suites, `src/helper/`
and the Khmer package's copy, failed to load on that machine and passed on a
newer Node. A node-environment file is not affected.

**Why:** the failure looks like a broken test, not an environment gap, and it
only shows on the older Node.

**How to apply:** in a jsdom test, read it at run time —
`const { DatabaseSync } = process.getBuiltinModule('node:sqlite');` plus
`type DatabaseSync = InstanceType<typeof DatabaseSync>;` for the type — as
both suites now do. See [[coverage-run-load-flakes]] for the other ways a
whole-surface run loses its report.
