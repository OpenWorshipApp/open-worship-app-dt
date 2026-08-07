---
name: typescript-7-side-by-side
description: The `typescript` dep is deliberately an alias to the TS6 API package; TS7 lives under `@typescript/native` and owns `tsc`
metadata:
  type: project
---

Upgraded to TypeScript 7 on 2026-08-02 using the official side-by-side layout:

- `"@typescript/native": "npm:typescript@^7.0.2"` — provides the `tsc` binary (TS 7, native Go compiler). This is what `lint:all:error`, `electron:build` and `electron:build:watch` run.
- `"typescript": "npm:@typescript/typescript6@^6.0.2"` — NOT a downgrade. typescript-eslint hard-throws ("typescript-eslint does not support TS 7.0") on any TS >= 7, so the package that resolves as `require('typescript')` must stay the TS 6 API. Also gives a `tsc6` binary.

**Why:** `npm i -D typescript@7` alone type-checks fine but makes `npm run lint:es` die at module load. Support tracked in typescript-eslint#10940 (TS >= 7.1). When typescript-eslint ships TS7 support, collapse this back to a plain `"typescript": "^7.x"`.

**How to apply:** Don't "fix" the odd-looking `typescript` alias — it is load-bearing for eslint. Bump TS 7 via `@typescript/native`, not `typescript`.

TS 7 also removed options `electron.tsconfig.json` relied on (`moduleResolution: "node"`/node10, `baseUrl`, and the `ignoreDeprecations: "6.0"` that had been silencing them). Replaced with `moduleResolution: "bundler"` alongside `module: "commonjs"` — the drop-in that needs zero source changes. `node16` also works but forces a `resolution-mode` import attribute in `electron/lwShareHelpers.ts` (ESM-only `lw-share`). Emit diff vs the TS 6 build is cosmetic only (temp-var grouping/numbering, line wrapping). See [[build-kills-running-dev-app]].
