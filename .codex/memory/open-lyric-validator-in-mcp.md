---
name: open-lyric-validator-in-mcp
description: owa_lyric_validate writes the Open Lyric grammar out rather than calling open-lyric (its headless entry answers a boolean and drags monaco in) — two tests are what stop it drifting
metadata:
  type: project
---

`owa_lyric_validate` (`tools/owa-devtools-mcp/openLyric.mjs`, added 2026-09-02)
checks song text and answers with every mistake — line, section, what to write
instead — then what the song IS: title, key, tempo, sections, play order. It is
the one tool in that package that reaches nothing: no CDP, no window, no
network, so it works with the app shut.

**It deliberately does not call open-lyric**, and that is the decision to know
before "fixing" it:

- `validateMarkdownOlModel(model)` takes a **Monaco model** and pushes markers
  into an editor — unusable headlessly.
- `api.document.checkMarkdown(text)` (via
  `new EditorOpenLyricPlugin().getOpenLyricApi()`) is the only headless entry
  and answers a **boolean**. A line number and a sentence are the whole point
  of the tool, so the one thing it must not answer is yes/no.
- Either way in means importing an 863 KB bundle that pulls monaco and touches
  `document` at module scope, into a plain-node server on a machine CLAUDE.md
  holds to a church back room's memory.

So the grammar is written out, and **two tests are the guard**, not the comment
above it:

- `openLyric.test.mjs` re-reads `node_modules/open-lyric/schema.md` §8.1 — the
  machine-readable grammar the package SHIPS — and fails when a table
  disagrees: fences, structure codes, Config fields and their required and
  multiline sets, the `Key`/`Time` enums, all 229 locale tags, the chord
  pattern character for character, and every chord and repeat suffix the schema
  names valid or invalid. An `npm i` that bumps open-lyric fails here instead
  of in a volunteer's answer. Plain node.
- `openLyricOracle.test.mjs` runs 122 documents through open-lyric's OWN
  `checkMarkdown` and through ours, failing on a disagreement. jsdom, and the
  only test in the package that needs it — see
  [[monaco-css-test-failure-local-open-lyric]] for the recipe.

Rules that only the live oracle would have told you, all probed:

- `problems` vs `warnings` is not a style choice. open-lyric **accepts** a
  `{p: #9}` pointing past the patterns `Config` lists, and **accepts** a
  section `Structure` never plays. Raising either as an error would refuse a
  song the editor takes.
- An empty **single-line** Config field is an error (`- Subtitle:`); an empty
  **multiline** one is fine (`- Description:`).
- `{p: #N}` is for `Intro`/`Outro`/`Turnaround` only — an `Instrumental` takes
  `{c: …}` alone, and only as the FIRST thing in the whole body.
- A `Structure` that broke part way through reports its play order marked
  partial and accuses no section of being unplayed: past the broken token,
  unread is not unplayed.

Two defects that 160 passing tests did not show and one call through the app's
own MCP host did: the `{p: #N}` warning matched the whole trimmed LINE (so it
never fired for the normal `{p: #1} | G | D |`), and a partial play order
printed as though it were the whole song. See
[[mcp-tool-edit-two-processes]] for why the driving has to go through the app.

The app keeps a SECOND hand-copied structure-code table in
`src/plugins/song-select/songSelectLyricHelpers.ts` with no drift guard at all
— `MC-20` in the owa-enhance-mcp backlog. Related:
[[open-lyric-fence-ground-truth]], [[agent-access-mcp-chatbot]].
