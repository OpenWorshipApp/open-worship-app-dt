---
name: typescript-7-side-by-side
description: "The `typescript` dep is deliberately an alias to the TS6 API package; TS7 lives under `@typescript/native` and owns `tsc`"
metadata:
  node_type: memory
  type: project
  originSessionId: b644b2dc-83e1-4c50-9994-5b141535da4e
  modified: 2026-11-07T16:02:36.528Z
---

Upgraded to TypeScript 7 on 2026-08-02 using the official side-by-side layout:

- `"@typescript/native": "npm:typescript@^7.0.2"` — provides the `tsc` binary (TS 7, native Go compiler). This is what `lint:all:error`, `electron:build` and `electron:build:watch` run.
- `"typescript": "npm:@typescript/typescript6@^6.0.2"` — NOT a downgrade. typescript-eslint hard-throws ("typescript-eslint does not support TS 7.0") on any TS >= 7, so the package that resolves as `require('typescript')` must stay the TS 6 API. Also gives a `tsc6` binary.

**Why:** `npm i -D typescript@7` alone type-checks fine but makes `npm run lint:es` die at module load. Support tracked in typescript-eslint#10940 (TS >= 7.1). When typescript-eslint ships TS7 support, collapse this back to a plain `"typescript": "^7.x"`.

**How to apply:** Don't "fix" the odd-looking `typescript` alias — it is load-bearing for eslint. Bump TS 7 via `@typescript/native`, not `typescript`.

**Scripts name the TS 7 compiler by path (2026-11-07):** `@typescript/typescript6` depends on plain `typescript@6` aliased as `@typescript/old`. npm hoists it and links its `tsc` bin, and that bin fights `@typescript/native`'s TS 7 `tsc` for `node_modules/.bin/tsc`, with the last package linked winning. After an install that swapped the `typescript` alias, `npx tsc -v` said 6.0.3, so a bare `tsc` script had silently type-checked with TS 6. `lint:all:error`, `electron:build` and `electron:build:watch` therefore run `node node_modules/@typescript/native/bin/tsc`. `src/test-setup/lintGateScripts.test.ts` fails on any script that starts a bare `tsc`. Never trust `npx tsc` here: run `node node_modules/@typescript/native/bin/tsc -v`.

**Ruled out (2026-11-07):** a plain `"typescript": "^7"` plus an npm `overrides` entry `{"typescript-eslint": {"typescript": "npm:@typescript/typescript6@^6.0.2"}}` fails with `ERESOLVE`. `typescript` is a PEER of typescript-eslint, and npm resolves a peer to the root's copy and won't nest a private one. The config is not type-aware (`tseslint.configs.recommended`), but typescript-estree still needs the classic TS API to parse. TS 7's `typescript` package exports only `lib/version.cjs` and `unstable/*`, so typescript-eslint throws at module load even with no typed rules. Status then: typescript-eslint 8.72.1 (latest) and the canary still peer `>=4.8.4 <6.1.0`; #10940 is open, and PR #12803 targets TS 7.1, then in beta. The only way to have no TS 6 before that ships is to replace typescript-eslint (e.g. oxlint). That is a lint-tool migration, and its risk is `react-hooks/exhaustive-deps`, whose semantics the `useAppCurrentRef` disables rely on.

TS 7 also removed options `electron.tsconfig.json` relied on (`moduleResolution: "node"`/node10, `baseUrl`, and the `ignoreDeprecations: "6.0"` that had been silencing them). Replaced with `moduleResolution: "bundler"` alongside `module: "commonjs"` — the drop-in that needs zero source changes. `node16` also works but forces a `resolution-mode` import attribute in `electron/lwShareHelpers.ts` (ESM-only `lw-share`). Emit diff vs the TS 6 build is cosmetic only (temp-var grouping/numbering, line wrapping). See [[build-kills-running-dev-app]].
