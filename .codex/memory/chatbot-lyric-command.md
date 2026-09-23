---
name: chatbot-lyric-command
description: "/lyric <address> writes a song from a page with no model, the offline bot drafts a song LINK (not only a paste), a file the model created itself is not offered for creation again, and a site's bot check is refused rather than drafted as Untitled"
metadata: 
  node_type: memory
  type: project
  originSessionId: 08d58212-e6f2-4a7a-8410-ed6ce4ff4ed2
  modified: 2026-09-11T01:04:48.031Z
---

Four things that landed together on 2026-09-10 (`EC-123`, `EC-161`,
`EC-162`), all measured through the real window first:

- **`/lyric https://…`** (`builtinActionHelpers.ts`; also `/lyrics`, `/hymn`,
  `/new-song`) has the drafter read the page itself (`owa_lyric_validate`
  with `url`) and offers the song under **Create "…" / Copy song text** with
  the preview box — 0 rounds, ~3.5 s, nothing written until Create.
  `/song` could NOT be the name: it is `/selected`'s alias ("which song is
  up"), and the command-list test fails on a duplicate. `/lyric` over pasted
  words drafts those.
- **The offline bot drafts a song link** (`readSongLinkAsk` in
  `lyricDraftHelpers.ts` → `answerLyricLink` in `helpBotHelpers.ts`, before
  the paste check): a song word beside exactly ONE https address in a short
  message. A bare address is not enough (a YouTube link, a Bible XML file).
  With the assistant paused, the starter chip *Create a lyric file from
  https://…* had been searched for in the manual and answered with how to
  make an empty file.
- **A file the model created itself** (`owa_lyric_file create` after its own
  draft — it does this on a *Create a lyric file…* ask) is read off the
  RESULT into `watch.createdLyric`, and the answer carries **Show it in the
  list** + the file chips and NO Create; before, a second press made a
  second file.
- **A bot check is refused** (`checkIsBrowserCheckPage` / `BROWSER_CHECK_TEXT`
  in `openLyricDraft.mjs`): hymnary.org's third read in a row was *Hold
  tight… checking your browser…*, which the drafter turned into a valid song
  called "Untitled". The renderer tests a PREFIX of that sentence
  (`checkIsBrowserCheckRefusal`) rather than importing the drafter, pinned by
  a test; `openLyricDraft.d.mts` exists only for that test.

**Why:** the fastest way to use the app (rung 6) is one line, and a song page
is the second commonest thing a volunteer brings; the offline route is what
a dead key, a 429 or the spend guard hands them.

**How to apply:** a new `/` command's name must not be another command's
alias (run `builtinActionHelpers.test.ts`); anything the drafter is handed
that came off a page can be an interstitial, so refuse the shape before
drafting; a tool that CREATES must be watched for in `applyToolWatch` or the
answer offers to do it again. Related: [[chatbot-builtin-commands]],
[[mcp-document-write-tools]], [[model-cannot-write-open-lyric]],
[[song-page-goes-in-as-url]].
