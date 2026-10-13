---
name: prettier-reindents-mjs-outside-src
description: "`npx prettier --write` on a .mjs under extra-work/ or tools/ reindents the whole file to 2 spaces — pass `--tab-width 4`; those files are outside the lint gate's prettier check"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 016fc761-2ab0-4533-a925-f0e7ca765188
  modified: 2026-10-13T20:05:00.714Z
---

`npx prettier --write extra-work/local-llm/*.mjs` turned three 4-space files
into 2-space ones — a 3 000-line whitespace diff over files the user had
already staged (2026-10-13, while changing the report inbox).

**Why:** `.prettierrc.json` holds only `singleQuote`, so the indent comes from
`.editorconfig`, and its `indent_size = 4` rule names
`*.{html,json,js,ts,tsx}` — not `.mjs`. `src/` and `electron/` are TypeScript,
so they never show it, and `lint:pre` checks only those two folders, so the
gate never says anything either way about a `.mjs`.

**How to apply:** for any `.mjs` (the admin kit in `extra-work/`, the MCP
server in `tools/owa-devtools-mcp/`, scripts) run
`npx prettier --tab-width 4 --write <file>` — and look at `git diff --stat`
straight after: a file you touched in three places should not show a thousand
lines. Some of those files are hand-wrapped and were never prettier-clean
(`llm-tunnel.mjs`); leave those as they are rather than formatting them whole.
Related: [[crlf-checkout-line-regex]].
