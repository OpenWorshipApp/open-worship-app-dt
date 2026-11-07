---
name: chatbot-lyric-edit
description: "A song is changed in the 🤖 by WORDS through owa_lyric_edit; the Lyric Editor must take outside changes as EDITS (open-lyric's value setter resets the dirty baseline) and the install-a-language route must stay out of a song tab"
metadata:
  node_type: memory
  type: project
  originSessionId: c44cd2db-6924-4947-ad2d-fd40347ab3fb
  modified: 2026-11-07T02:07:58.953Z
---

Since 2026-11-06 a song is opened in the help window from its Documents row
(**Open in Chatbot**) or the Lyric Editor's robot, and changed there part by
part through `owa_lyric_edit` -- the model gives words, `openLyricEdit.mjs`
writes the notation (rule `agent-songs.md`; [[model-cannot-write-open-lyric]]).

Two traps the live run found, neither visible to a unit test:

- **open-lyric's `editor.value = …` is a LOAD, not an edit**: it replaces the
  text AND the dirty baseline, so the editor calls the song clean and greys
  Save out -- and the Lyric Editor is the only place a song is saved. An
  outside change goes in as Monaco's own edit (`applyLyricEditorText`), and
  the editor opens on the SAVED text with the unsaved head applied on top.
- **"Add Spanish under each line" read as a language to INSTALL**: the
  language-install route (`readLangInstallAsk`) catches "add … language"
  whenever the box is empty. It is skipped while a song is open in the tab.

**Why:** the chatbot's answer tells the person to press Save in the Lyric
Editor; with Save greyed out that step was a dead end.

**How to apply:** any code that writes into the open-lyric editor from
outside uses `applyLyricEditorText`, never `value`. A new pattern-routed
answer in the help window checks whether a song (or another file kind) is
open in the tab before it claims the question. An edit to the `.mjs` tool
reaches the chatbot only after the app relaunches -- its in-app MCP host
keeps the modules it loaded first ([[mcp-tool-edit-two-processes]]).
