---
name: owa-enhance-bible-note-chatbot
description: 'Improve what the in-app chatbot can do with a Bible NOTE -- the conversation a note row''s or the note window''s Open in Chatbot opens (W-60), the owa_note_edit tool it changes the note with, and the Bible Note editor''s own guide it answers from. Use when asked to improve / extend / fix / harden the chatbot on bible notes, the note conversation, owa_note_edit, Open in Chatbot on a note, the note window''s robot, or to make the chatbot able to do something the note editor''s toolbar or Insert menu does (font, size, colours, styles, alignment, indent, tables, sticky notes, polls, dates, equations, media, undo/redo); also when a note chat answered with the editor''s steps instead of doing it, did the wrong thing, or claimed a change it did not make. THE MEASUREMENT RULE: toolbar parity is a figure from scripts/toolbar-coverage.mjs -- the inventory of every toolbar control (references/toolbar-inventory.json), a control COVERED only when its parity test `toolbar: <id>` passes, PROVISIONAL while a toolbar label of the installed bible-note package is untriaged; an exclusion carries its reason. THE CHANGE RULE: a note is changed byte for byte only where asked (scripts/note-roundtrip.mjs on real notes), every change verified LIVE through the help window on a SCRATCH development profile (never the person''s own app), a new string in every language, `npm run lint` the gate. Ledger BN-xx.'
argument-hint: 'measure | research | <BN-xx> | toolbar | report -- default: measure, then the cheapest open BN item'
---

# OWA Enhance Bible Note Chatbot — everything a note can be, by asking

A volunteer preparing Sunday's sermon notes should be able to say what they
want — _make the verse references red_, _put a table of the three readings
under the heading_, _indent the second point_, _add a sticky note to call Tom_
— and have it done in the note, exactly there and nowhere else. This skill is
the climb toward that: the chatbot doing EVERYTHING the Bible Note editor can
do, reliably on a small free model, and saying truthfully what it did.

```text
MEASURE (parity + round trip) → RESEARCH (ask the note corpus live) →
PLAN (BN-xx, cheapest gain first) → BUILD → VERIFY LIVE (scratch profile) →
GATE (npm run lint) → PAPER TRAIL (W-60, CB-169, rules, memory, knowledge)
```

**Before changing anything, read whole**: `.claude/rules/agent-tools.md`
(the `owa_note_edit` bullet), `.claude/rules/chatbot-llm.md` (the note ask),
`.claude/rules/chatbot-files-report.md` (attachments), and the memory
`bible-note-chatbot`. They record why each piece is the way it is.

## Where it lives

| File | Owns |
| --- | --- |
| `src/helper/agentNoteBlockHelpers.ts` | A note as numbered BLOCKS, the light mark-up, `applyNoteEdit` (pure): every change in one step, all or nothing, the rest byte for byte |
| `src/helper/agentNoteStyleHelpers.ts` | The toolbar (pure): font, size, colours, the style bits, Clear Formatting, alignment, indent / list nesting, `words` as a selection, a model's HTML read |
| `src/helper/agentNoteInsertHelpers.ts` | The Insert menu (pure): table, columns, collapsible, page break, equation, sticky, date, poll, video, website, media, a drawing (`agentNoteDrawingHelpers.ts`) and the editor's Default Example (`agentNoteDefaultExample.json`, captured from the editor) |
| `src/helper/agentNoteBlockLinkHelpers.ts` | Link block text: the editor's own link entry (node paths), kept in its storage, not in the note |
| `src/helper/agentNoteNormalizeHelpers.ts` | A changed block written as Lexical writes it, so an open note window never writes it back as a step of its own |
| `src/helper/agentNoteEditHelpers.ts` | The app side: reads the editing HEAD, resolves new verses (installed Bible) and names (names lookup, on demand), the font list, undo/redo of the kept history (stepping over an echo), the ¶ (`view`) and block links -- the editor's own keys, backed up as `home-setting` restores -- writes, tells an open note window |
| `tools/owa-devtools-mcp/agentNoteEdit.mjs` | `owa_note_edit`: schema, description (~878 tokens, a note ask only) |
| `src/chatbot/noteChatHelpers.ts` | `NOTE_SYSTEM_PROMPT`, the card, the note read into the ask, the window-side size answer, the lesson hints (`genNoteLessonHint`), an empty note filled (`toBlankNoteFillArgs`), the verse check's read (`toNoteVerseReadText`) |
| `src/chatbot/noteCreatePromptHelpers.ts` | What a preaching lesson holds (`PREACHING_LESSON_SHAPE`, sent on a lesson ask only) and the English lesson readers; a language's own are `lessonAsks` / `verseCheckAsks` in its `assistant.json` |
| `src/chatbot/ChatbotAppComp.tsx`, `windowAimHelpers.ts` | The note conversation in the window; the tab works IN the note's own window (`toNoteWindowAim`) |
| `src/helper/ai/noteChatbotMenuHelpers.ts`, `noteWindowMatchHelpers.ts` | Open in Chatbot: opens the note's window first, the handoff |
| `extra-work/bibleNoteGuideHelpers.mjs`, `tools/owa-devtools-mcp/help.mjs` | The editor's own guide as a corpus apart (`agent-knowledge.md`) |

## The rules

1. **Every parity figure comes from `scripts/toolbar-coverage.mjs`.** The
   denominator is `references/toolbar-inventory.json`, one item per control
   of the toolbar as the installed `bible-note` package draws it. A label the
   package has and the inventory does not is a LEAD, and the figure is
   provisional until it is triaged into an item, an alias or a reasoned
   exclusion. Excluding a control to reach a number is the one forbidden move;
   an exclusion says why the CHATBOT cannot do it (a drawing made by hand, a
   window's view switch, data the note does not keep).
2. **Byte for byte where not asked.** `scripts/note-roundtrip.mjs <bible-notes
   folder>` must print `failures: 0` on real notes: every editable block given
   its own words back changes nothing, and a style on one block changes that
   block's node and no other. A new kind or field gets a parity test that
   asserts the node the editor's OWN control writes — copied from the editor
   (`node_modules/bible-note/dist/…`) or from a note it saved, never guessed.
   **And the open window must not write it back**: with the note window open,
   write each kind and count the note's history steps -- one a change. A
   second step is an echo (the editor keeps that node another way), and an
   undo then takes back the echo, not the change (BN-12: six kinds did, until
   `agentNoteNormalizeHelpers.ts`).
3. **Live on a scratch profile, never the person's app.** Start a second
   development Electron on its own `OWA_USER_DATA_PATH` (memory
   `scratch-dev-instance-beside-user-app`; seed a notes file, `lookup-data`
   and a Bible), drive it with a fresh stdio MCP server pinned to its port,
   and stop it by its pid when done. The AI caution's **Open** is the
   person's press unless they allowed it in THIS conversation (CLAUDE.md,
   Agent access). An edited tool `.mjs` needs that instance RELAUNCHED: the
   in-app MCP host caches its modules (memory `mcp-tool-edit-two-processes`).
4. **Measure the model, not only the tool.** A tool that can do a thing is
   half of it; a small free model must CHOOSE it. Ask through the real window
   (`scripts/ask-note-chat.mjs`, which prints the model's tool calls) on Auto
   (the shared gemma4:cloud) and grade: done in ONE call, the right fields,
   the answer saying only what the tool's summary lists. Seen on the first
   run: the model wrote HTML into `words` and claimed a colour it never sent
   — fixed by an example in the prompt, by reading that HTML, and by the
   summary listing what was done.
5. **Performance first** (CLAUDE.md). The names dataset (~34 MB) is read only
   for a NEW `[@…]` / `[#…]` and given back at once; nothing is cached past a
   call; the tool's description is paid on every round of a note ask, so a
   field is checked by the app (and its reason teaches) rather than put in a
   schema enum. The ordinary tool list's ratchet must not move:
   `node .claude/skills/owa-enhance-chatbot/scripts/audit-mcp-tools.mjs
   --stdio --ratchet`.
6. **Words in every language.** A new `tran` key goes into every
   `src/lang/data/online/<code>/dictionary.json`, each touched language's
   `meta.json` version goes up, then `npm run lang:pack` (CLAUDE.md). What
   goes to the MODEL stays English; the person reads their language.
7. **Paper trail in the same change**: W-60 in
   `.claude/skills/owa-robot-test/references/user-workflows.md` and CB-169 in
   `docs/test-paths/coverage-matrix.md` (dates bumped), `npm run docs:gen`,
   the rules above, the memory note, `node extra-work/build-knowledge.mjs`,
   then `npm run lint` last.

## Procedure

### 1. Measure

```bash
node .claude/skills/owa-enhance-bible-note-chatbot/scripts/toolbar-coverage.mjs
node .claude/skills/owa-enhance-bible-note-chatbot/scripts/note-roundtrip.mjs "<data folder>/bible-notes"
node .claude/skills/owa-enhance-chatbot/scripts/audit-mcp-tools.mjs --stdio --ratchet
```

Read `references/scoreboard.md` (last row) and `references/backlog.md` (open
BN items). A lead or a failing parity test is the first job.

### 2. Research

On a scratch profile with the note conversation open, ask the standing note
BN items) with `scripts/ask-note-chat.mjs` (or all of them with
`scripts/run-note-asks.mjs`, which undoes each) and grade
each: tool calls (one is the bar), fields right, the note right on a
screenshot of the note window, the answer true. A new failure is a BN item
with what was asked, what the model sent and what the note became.

**The elder corpus** (`references/elder-asks.json`, 600 things an elderly,
non-technical church member types while preparing a lesson -- written by a
reader told only the person and the note, never what the tool can do --
each with a machine-checkable `expect`) is asked whole by
`scripts/run-elder-asks.mjs` against the lesson note it was written for
(The Good Shepherd: a title, the lesson line, a Psalm 23:1 chip, prayer,
three points, John 10:11, two questions, the hymn, a misspelt reminder),
which puts the note back after every ask and re-attaches it after a new
note; `scripts/elder-asks-report.mjs <results> --fails` reads what it
found. A pass is the change asked for in one call (two is `pass-multi`), an
honest answer, a new note, an undo that put it back; a claim of a change no
tool made fails whatever was expected. Its block expectations assume the
note as written -- grade a failure by reading it before calling it the
model's. Three things a run must hold, each learnt the hard way on its
first: the window's spend guard pauses a profile at 150 model calls an hour
and its **Allow more** is the person's press, so split the corpus over
profiles and pace each (`--every=3 --offset=k --pace=55`, about two calls an
ask); a new title is kept at once and is no part of the note's hash, so the
harness puts the title back by name; and an ask with no `owa_note_edit`
call was not about the note (`not-note-ask`, asked again).

**A preaching lesson is judged against a written standard, never by the
assistant that built the chatbot** (BN-66). `references/lesson-rubric.md`
is that standard -- twelve criteria from the homiletics textbooks (Robinson's
big idea, Chapell's fallen-condition focus and explanation / illustration /
application, Stott's two worlds), 0-2 each, banded Best / Good / Needs work,
a factual error about the Bible capping a lesson at Needs work.
`scripts/run-lesson-asks.mjs <profile part>` makes every row of
`references/lesson-asks.json` through the real window -- a new note (empty,
or a preacher's own partial lesson for a `finish` row), its **Open in
Chatbot**, the ask typed or the empty note's card pressed -- and
`scripts/lesson-rubric.mjs <results> --text=<dir>` checks the structure by
machine and writes each lesson as text with the ask and nothing of how it
was made. Two readers on different models, briefed with the standard and
the lessons alone, score them; a weakness most lessons share is a change to
the shape the model is given, never to the standard.

### 3. Build

Cheapest gain first, in this order of preference: the tool says why and how
in its refusal → the prompt shows an example → the app reads what a model
writes anyway → a new field or kind. A request a short English sentence can
say and no judgement is needed for (_make text bigger_) may be done by the
WINDOW with no model (`genNoteSizeChanges`), which works with no key and no
internet.

### 4. Verify, gate, record

Live first (rule 3), then `npm run lint`. One scoreboard row per run; every
BN item touched says what changed and what was seen.

## Invocation

| Argument | What happens |
| --- | --- |
| *(none)* · `measure` | §1, then the cheapest open BN item is proposed |
| `research` | §1 and §2 only — the asks graded, BN items written, nothing built |
| `elder` | §2 over the elder corpus (`run-elder-asks.mjs`), then §3–§4 on what failed |
| `lesson` | The lesson set made live (`run-lesson-asks.mjs`), checked by machine and by two blind readers against `lesson-rubric.md`, then §3–§4 on what most lessons miss |
| `toolbar` | Parity only: leads triaged, missing controls built and tested |
| `BN-xx` | That item through §3–§4 |
| `report` | The scoreboard and the open BN items; nothing run |
