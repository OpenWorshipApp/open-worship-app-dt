---
name: question-corpus-maintenance
description: "tools/owa-devtools-mcp/questions/*.json is the chatbot's supported-question corpus and must be updated in the SAME change as any knowledge, recipe or UI change it describes"
metadata:
  node_type: memory
  type: project
  originSessionId: f6db8419-15c0-43d6-9847-10ef8f56227d
  modified: 2026-10-12T15:37:13.935Z
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

- **Saving a file here relaunches an app run with `npm run electron:dev`**:
  nodemon watches the whole `tools/owa-devtools-mcp` package, `.json`
  included. On 2026-10-12 two questions added mid-session closed the user's
  Settings and help windows with an answer in flight. Check `owa_app_state`
  first; when an app is up and somebody is working in it, make the corpus edit
  the LAST write of the change and say so, or ask.
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
- A row filed under a page too long to be read whole (over 6 000 characters;
  the help window's own is 57 000) with no control to go by names its
  `passage`: a few words copied from the lead of the passage that answers.
  Without it the part that rides is chosen by the question's words, and for
  that page it was the wrong part for nine questions in twenty-three
  (2026-10-12). The test fails when the page stops carrying the words, so a
  lead reworded in the manual is reworded here in the same change.
- The other row that wants a `passage`: one whose `find` is written early
  in a long page and explained later -- a tab's name above all
  (`Foreground`, `Presenting Flows`). The first 6 000 characters ride
  because the control is named in them, and the step that answers may be
  past them (2026-10-12: _Who is watching my virtual display?_, answered
  with where to watch).
- **Look at a page's length before adding to it.** A page rides whole up
  to 6 000 characters (its foot note aside); a paragraph that takes it past
  that turns every row filed under it into a cut. The slide editor's page
  stands at 5 941 and the song page near 5 500 (2026-10-12): put new text
  on a page with room and file the row there, with its `passage`.
- A question's words must ask what its page answers. _How do I change the
  font used on screen?_ was filed under the font of the app's own windows,
  whose page says it is not the audience screen's; a model that read both
  went looking for the other font. Graded answers are how such a row is
  found: nothing else reads the question against the page.
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
- **A recipe over 6 000 characters is cut before a small model sees it.**
  On 2026-10-12 the running-order recipe (39 000 characters) held every
  wrong answer left in the list and was split into ten that ride whole
  (W-22 … W-22j): its 27 questions went from 11 right, 13 partly, 3 wrong
  to 14 right, 9 partly, 4 wrong. Worth doing -- write a recipe to fit, and
  file a question under the page that holds its answer whole -- but it did
  not end the wrong answers: on a subject of fine distinctions a 4B model
  is wrong about one answer in seven whatever it is handed.
- Keep `keywords` to what a volunteer would type *instead* ("projector",
  "words", "blank"), not a restatement of the question text, which is already
  matched. Shared synonyms live in `QUERY_ALIASES` in `questionMatch.mjs`.
