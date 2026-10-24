---
name: claude-dir-edits-need-knowledge-rebuild
description: "Editing anything under .claude/ (CLAUDE.md, rules/, memory/, skills/) leaves the chatbot's bundled knowledge stale until the knowledge build is re-run — do it in the same change"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c95a672a-48b7-47e0-a94d-10946a3ee48d
  modified: 2026-10-24T21:24:14.903Z
---

Every change to `.claude/CLAUDE.md`, `.claude/rules/**`, `.claude/memory/**` or
`.claude/skills/**` must be followed, in the SAME change, by:

```
node extra-work/build-knowledge.mjs
```

That is the `internal` half of the corpus the in-app chatbot answers from
(`extra-work/build-knowledge.mjs`, allowlist `CLAUDE.md` + `rules/` +
`memory/` + `skills/`). Until it is re-run, `electron-build/knowledge/` still holds the
PREVIOUS text and the chatbot keeps answering from notes that no longer exist.

- Run the script **on its own**, not `npm run build` / `npm run electron:build`,
  when the dev app is up: the full build `rm -rf`s all of `electron-build/`,
  which is the running app's own main entry (see
  [[build-kills-running-dev-app]]). `build-knowledge.mjs` only clears
  `electron-build/knowledge/`, so the live app survives it — under
  `npm run dev`, and since 2026-10-11 under `npm run electron:dev` too:
  `electron:watch` (nodemon on `electron-build` AND `tools/owa-devtools-mcp`)
  now carries `--ignore electron-build/knowledge`. Before that the rebuild
  relaunched the app, and that relaunch could quit at once — a peer session
  reported exactly that on 2026-09-14, nodemon, `tsc -w` and Vite still up, no
  `electron.exe`. A save in the MCP package still relaunches it
  ([[mcp-tool-edit-two-processes]]), and an `electron:dev` started before the
  change keeps the old watch until it is restarted.
- **No app restart is needed** for a knowledge-only refresh:
  `listKnowledgeEntries()` in `tools/owa-devtools-mcp/help.mjs` re-reads
  `index.json` on every `owa_help_search` / `owa_help_page` call and caches
  nothing. (Editing the MCP `.mjs` modules themselves still needs a restart —
  see [[agent-access-mcp-chatbot]].)
- With no `electron-build/knowledge/index.json` at all, the tools silently fall
  back to `docs/manual-sources/**` only, so a missing rebuild looks like the
  internal notes simply not existing rather than like an error.

**Why:** the chatbot's `internal` corpus is a build artifact, not a live read of
the repo. A memory or skill edited without the rebuild is invisible to the
assistant that was supposed to learn from it, and a deleted/renamed note keeps
being quoted.

**How to apply:** treat `node extra-work/build-knowledge.mjs` as part of
finishing any `.claude/` edit. Run
it before `npm run lint`, and never reach for the full build just to refresh
knowledge while the app is running. A watcher started before
`electron:watch` was given `--ignore electron-build/knowledge` (2026-10-11)
still relaunches the app on every rebuild -- seen four times on
2026-10-13, the flag missing from the running process's own command line;
one started since does not ([[corpus-run-in-a-shared-dev-app]]).
