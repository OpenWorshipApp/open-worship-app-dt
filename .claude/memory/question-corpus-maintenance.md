---
name: question-corpus-maintenance
description: tools/owa-devtools-mcp/questions/*.json is the chatbot's supported-question corpus and must be updated in the SAME change as any knowledge, recipe or UI change it describes
metadata:
  type: project
---

`tools/owa-devtools-mcp/questions/*.json` is the curated list of questions the
in-app assistant is prepared to be asked — one file per page, split into
sections that match the panel the user is looking at. Nothing enumerates the
files: the loader, the renderer's `import.meta.glob` and `owa_list_questions`'
`page` enum all read the directory, so adding a page IS adding a file. It powers the ask box's **type-ahead suggestions**
and its "Try asking" chips (via `starterRank`), and the `owa_list_questions` MCP
tool. Each entry carries the resources that answer it: `recipe` (`W-xx`),
`related`, `find` (an `owa_find_ui` target), `menu`, `shortcut`, `tools`,
`guide`.

**Whenever the knowledge changes, update this folder in the same change.** That
means a new or reworded `W-xx` recipe in
`.claude/skills/owa-robot-test/references/user-workflows.md`, a regenerated page
under `docs/manual-sources/`, a renamed control or panel, a new feature, or a
removed one. Add, reword or delete the affected questions and bump the file's
`updated` date. This is a separate step from `node extra-work/build-knowledge.mjs`
(see [[claude-dir-edits-need-knowledge-rebuild]]) — the knowledge rebuild makes
the manual *searchable*, the corpus makes it *offered*.

**Why:** a suggested question the assistant cannot answer is worse than no
suggestion — the user picks it, the lookup misses, and the bot guesses. The
corpus is a promise about what the app can do, so it goes stale the moment the
app moves without it.

**How to apply:**

- The two consumers share one ranking, `questionMatch.mjs`, which is deliberately
  free of `node:fs` so the renderer can bundle it. `questions.mjs` is the
  disk-reading wrapper the MCP server uses. Never write a second matcher in
  `src/chatbot/` — the suggestion list and the tool must agree about what the app
  supports.
- `questions/schema.json` documents every field and its rules; the loader skips
  that file. Adding a page is adding a file — nothing enumerates them.
- `tools/owa-devtools-mcp/questions.test.mjs` runs against the REAL corpus (not a
  fixture) and fails on a question with no `recipe` and no `tools`, a duplicate
  id, a malformed recipe id, a recipe with no page under `docs/manual-sources/`,
  missing keywords, a demoted starter, a `focus` naming a window `botFocus.mjs`
  does not declare, or two starters sharing a rank within one window. Run it
  after any edit here.
- Question `id`s are stable: reword `text` freely, leave the id alone — a test
  and a scoreboard row may name it.
- A file's `focus` names the window(s) it belongs to, by the keys
  `tools/owa-devtools-mcp/botFocus.mjs` declares — those keys are spliced into
  `page: "<key>.html"` by the tools, so they are html base names, not labels. It
  may be a LIST for a page belonging to several windows, and `null` means every
  window.
- Set `starterRank` only in a page file. A rank in `common.json` outranks every
  page's own curated four, which is how the presenter's opening chips got
  silently replaced once already — and ranks are compared across every file a
  focus can see, so two files sharing a focus and a rank leave the order to sort
  stability. `troubleshooting`'s rank 5 tied with the reader's fifth chip for
  months; the rule was prose only until the test below started enforcing it.
  Ranks 10+ are free in every window, which is how a `focus: null` file can lead
  one window without displacing another's curated four.
- `FALLBACK_STARTERS` in `src/chatbot/questionHelpers.ts` is a hand-written copy
  of each window's opening four, shown only when the corpus fails to load —
  which is why it drifted unnoticed. `questionHelpers.test.ts` holds it to
  `matchQuestions('', { focus })`.
- Keep `keywords` to what a volunteer would type *instead* ("projector",
  "words", "blank"), not a restatement of the question text, which is already
  matched. Shared synonyms live in `QUERY_ALIASES` in `questionMatch.mjs`.
