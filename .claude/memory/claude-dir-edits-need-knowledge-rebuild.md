---
name: claude-dir-edits-need-knowledge-rebuild
description: Editing anything under .claude/ (CLAUDE.md, memory/, skills/) leaves the chatbot's bundled knowledge stale until the knowledge build is re-run — do it in the same change
metadata:
    type: feedback
---

Every change to `.claude/CLAUDE.md`, `.claude/memory/**` or `.claude/skills/**`
must be followed, in the SAME change, by:

```
node extra-work/build-knowledge.mjs
```

That is the `internal` half of the corpus the in-app chatbot answers from
(`extra-work/build-knowledge.mjs`, allowlist `CLAUDE.md` + `memory/` +
`skills/`). Until it is re-run, `electron-build/knowledge/` still holds the
PREVIOUS text and the chatbot keeps answering from notes that no longer exist.

- Run the script **on its own**, not `npm run build` / `npm run electron:build`,
  when the dev app is up: the full build `rm -rf`s all of `electron-build/`,
  which is the running app's own main entry (see
  [[build-kills-running-dev-app]]). `build-knowledge.mjs` only clears
  `electron-build/knowledge/`, so the live app survives it.
- **No app restart is needed** for a knowledge-only refresh:
  `listKnowledgeEntries()` in `tools/owa-devtools-mcp/help.mjs` re-reads
  `index.json` on every `owa_help_search` / `owa_help_page` call and caches
  nothing. (Editing the MCP `.mjs` modules themselves still needs a restart —
  see [[agent-access-mcp-chatbot]].)
- The `.github/` mirrors (`.github/memory/`, `.github/skills/`,
  `copilot-instructions.md`) are NOT read by the bundler — only `.claude/` is —
  but they still have to be re-copied in the same change by the standing mirror
  rule.
- With no `electron-build/knowledge/index.json` at all, the tools silently fall
  back to `docs/manual-sources/**` only, so a missing rebuild looks like the
  internal notes simply not existing rather than like an error.

**Why:** the chatbot's `internal` corpus is a build artifact, not a live read of
the repo. A memory or skill edited without the rebuild is invisible to the
assistant that was supposed to learn from it, and a deleted/renamed note keeps
being quoted.

**How to apply:** treat `node extra-work/build-knowledge.mjs` as part of
finishing any `.claude/` edit — same step as copying the `.github/` mirror. Run
it before `npm run lint`, and never reach for the full build just to refresh
knowledge while the app is running.
