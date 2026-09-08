---
name: mcp-document-write-tools
description: "owa_lyric_file / owa_slide_file are the first tools whose effect outlives the session; update writes the editing history (undoable, unsaved) and both the name and the content are checked in two layers"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4b47a03e-c20d-4e2c-9dcd-fe2857a8917c
  modified: 2026-09-02T00:27:27.718Z
---

`owa_lyric_file` and `owa_slide_file` (2026-09-02) give an agent `list` /
`info` / `create` / `update` / `rename` over the user's own songs (`.owl`,
Open Lyric content) and slide documents (`.ows`, document JSON). Two tools by
the operator's choice over one merged `kind` switch — ~800 tokens a round
rather than ~450 — but ONE implementation in `src/helper/agentFileHelpers.ts`,
with the differences in `AGENT_FILE_KIND_MAP`.

**Why they are shaped this way:** they are the first tools in this package
whose effect OUTLIVES the session. A click can be clicked again; a created file
stays created. See [[agent-access-mcp-chatbot]] and [[mcp-read-website-tool]]
for the rest of the tool surface.

**How to apply:**

- **`update` writes the EDITING HISTORY, never the saved file**
  (`setJsonData` → `addHistory`). That is the whole reason the destructive half
  is safe to offer: the change is undoable with Ctrl+Z, the document is left
  visibly dirty with its `*`, and a human presses Save. It is *point, don't
  press* applied to content. It also leaves a song already on a screen alone —
  a presented slide is a snapshot until re-presented. Do not "fix" this into a
  save. See [[presenting-flow-reads-editing-history-head]] for why the head
  file is what everything renders anyway.
- **There is no delete action**, and `create` never overwrites — `fsCreateFile`
  throws on an existing path unless told to override, and it never is.
- **Two things are checked in TWO layers**, the same split
  [[mcp-read-website-tool]] uses:
  - The NAME, in `owaTools.mjs` FIRST and again at the disk boundary, off one
    shared module (`tools/owa-devtools-mcp/agentFileName.mjs`, plain ESM so the
    renderer bundles what the server runs). First because the content
    validator used to answer before it and told a caller its song was
    malformed when the real complaint was the path in the name — a true
    sentence about the wrong thing. Twice because `createNewFileDetail` still
    carries a `// TODO: verify file name before create`, so nothing downstream
    is looking.
  - The CONTENT, by `validateOpenLyric` in the tool (line numbers and what to
    write instead, no round trip — see [[open-lyric-validator-in-mcp]]) and by
    the app's own `checkMarkdown` / `AppDocument.validate` at the disk
    boundary.
- **They reach the app through a DOM event**, `owa-agent-file`, relayed by
  `src/helper/domHelpers.ts` to the worker, which is imported LAZILY there —
  the same pattern the guide card's rescue uses. Necessary because the MCP
  package may never import an app module (it is also spawned standalone over
  stdio, where there is no app), open-lyric is browser-only, and a static
  import would close the [[app-document-helpers-lyric-cycle]] cycle.
- **Open Lyric Config fields need a leading `- `** — `- Title: ...`, not
  `Title: ...`. That is the mistake a model makes; I made it myself with the
  schema open. The refusal now names it. See
  [[open-lyric-fence-ground-truth]].
- **`renameTo` had no production caller before these tools**, and neither did
  `EditingHistoryManager.moveFilePath`, so the pair had never run together: a
  rename would have orphaned the unsaved edits under the old name. Fixed here
  — a rename now moves the history folder too. A presenting flow referencing
  the old name still stops finding it, and the tool says so.
- **Backslashes get halved writing these files through a shell heredoc.** `\s`
  in a template literal reaches the page as `s`; `\t` and `\n` become real
  characters and break a regex across a line. Write such content with the file
  tools and verify the emitted string, not the source.
