# Backlog — the chatbot on a Bible note (`BN-xx`)

Ids are stable; an item is never renumbered. Each says what was asked, what
was seen and what was done.

## Done

- **BN-01 — a word's colour was never sent** (2026-11-08). Asked _Center the
  line that starts with tasdfasd, and make the word fas red and bold_,
  gemma4:cloud sent `styles: ["bold"]` and `align` for the whole block and
  no `color`; asked again, it put `<span style="color:red">fas</span>` into
  `words`. Fixed: the prompt shows one change as an example (`{block: 5,
  words: "grace", color: "red", styles: ["bold"]}`), and HTML round the
  words is read as the words and their style (`readWordsMarkup`). Re-asked:
  `{block: 5, color: "red", words: "fas"}`, one call, 5 s.
- **BN-02 — "fas" matched inside "tasdfasd"** (2026-11-08). `words` matched
  as a bare substring. Fixed: whole words first, a substring only when no
  whole word fits (a script with no spaces).
- **BN-03 — the answer claimed a change the tool never made** (2026-11-08).
  _I have made only the word "fas" red_ with no colour sent. Fixed: the
  tool's summary lists what each change DID (`block 5 "fas": color red, bold
  off`) and the prompt says to report only that.
- **BN-04 — a second new block numbered as if the first were there**
  (2026-11-08). A table and a sticky in one call: the sticky went `after: 7`
  in a note of six blocks, refused twice before the model gave both
  `after: 6`. Fixed: the refusal says a block this call adds has no number
  and several new blocks after one block keep their order -- re-asked, right
  on the 2nd call -- and then the number a new block would have is READ as
  "after that new block". Re-asked: one call, 3 s, 8.7k tokens (was three
  calls, 17.4k).
- **BN-11 — a note tab forgot its note on a reload** (2026-11-08). The
  help window reloaded from the Reader put the tab back on _Bible Reader_
  (the launch focus) and lost the note window (kept in memory only).
  Fixed: the note window is read off the note the tab keeps, the launch
  focus leaves a note tab alone, and a note tab saved on another kind comes
  back to Bible Note -- until a window or a kind is picked by hand. Seen
  live: reloaded, _Bible Note_ / the note window; Presenter picked by hand
  stayed Presenter.
- **BN-05 — a standing set of note asks and a runner** (2026-11-08).
  `scripts/run-note-asks.mjs` asks `references/note-asks.md` one by one
  through the window and presses each answer's own Undo (its one `cue-act`
  button, any language). First run: _Centre the title_ and _Put today's
  date at the top_, one call each, both undone.
- **BN-06 — a new sticky note landed over the title** (2026-11-08). It goes
  to the page's right now (`xOffset` 560), each next one a little below and
  left.
- **BN-07 — a code block's language and theme** (2026-11-08). `language`
  and `theme` on a code block, the picker's own lists; in the inventory as
  `code-language` / `code-theme`. Seen live: _Add a python code block at the
  end with print('grace')_, one call, drawn highlighted as Python.
- **BN-08 — whole-note styles with no model** (2026-11-08). _Make all the
  text bold_, _centre everything_, _use Georgia for the whole note_, _clear
  the formatting_ are done by the window (`readNoteStyleAsk`,
  `genNoteStyleChanges`), one new sentence in all 87 languages. Seen live:
  2 s, no assistant asked, 55 blocks, Undo this change put them back.
- **BN-09 — the person's own controls** (2026-11-08). None is left: a
  drawing is `kind: "drawing"` (boxes and arrows from lines), Link block
  text is `linkTo`, the ¶ is `view`, the Default Example is `kind:
  "example"` -- the inventory has no exclusion (60 of 60).
- **BN-10 — a Khmer pass** (2026-11-08). In a Khmer window, _make the word
  fas red_ typed in Khmer: one call with English fields
  (`{block: 5, color: "red", words: "fas"}`), the answer and its Undo in
  Khmer.
- **BN-12 — an open note window echoed some changes** (2026-11-08). With
  the note window open, a change the editor would have written another way
  came back as a history step of its own, and _undo that_ took back the
  echo instead of the change (a drawing left at the top: the editor keeps
  one in a paragraph). Measured by writing every kind with the window open
  and counting history steps: six of 18 echoed. Fixed: changed blocks are
  written as Lexical writes them (`agentNoteNormalizeHelpers.ts`: key
  order, a paragraph's `textFormat`/`textStyle` from its first text,
  empty ones dropped elsewhere), a drawing goes in a paragraph, and the
  one echo nothing can avoid -- a code block's highlighting -- is stepped
  over by undo/redo (`toNoteCanonicalText`). Re-measured: 17 of 18 one
  step; the code block two, and one undo takes it away.
- **BN-13 — a link to an empty line was never drawn** (2026-11-08). _Link
  the first heading to the last line_ linked to an empty paragraph; the
  editor stored it and drew nothing. A link end with no words is refused
  now; a link between two blocks with words is drawn.
- **BN-14 — the ¶ answer had no Undo** (2026-11-08). `view` is backed up
  like an edit (a `home-setting` restore of the editor's own key), so its
  answer carries **Undo this change** too; pressed live, the ¶ came back.
- **BN-17 — a NEW note, and a lesson put into one** (2026-11-08, the user, with a
  Bible Reader chat that answered _make a bible note for me_ with words to copy
  and paste: _chatbot should be able to create new bible note (not allow
  delete), after create should open the note and attach to the chatbot
  session_, then the goal _chatbot can put a lesson to a new bible note for
  user_). The line under a Reader answer was a `bible-reader` ask, offered four
  reading tools and no note tool. Now `owa_bible_note` is shared to the
  bible-reader, lookup, resources and note asks (~304 tokens a round there;
  the ordinary list unmoved), their prompts carry `NOTE_CREATE_PROMPT` (a lesson
  given whole; never ask what to write -- asked first, gemma4:cloud answered
  "what would you like the title and the text to be?"), `add` reads the
  model's mark-up as the editor's blocks (`agentNoteMarkupHelpers.ts`, built by
  `applyNoteEdit`, a `[^ref]` read from the installed Bible) and answers with
  the path, `add` is no longer refused under an open note window of its file
  (it is the panel's own +), and the window opens the new note and attaches it
  (`readCreatedNote` → `openCreatedNoteRef`). A model's `delete` /
  `delete-file` is refused everywhere, and in a note ask anything but `add`,
  `list` and `read`. Live: four asks, each one call, each note opened and
  attached (Reader summary, a second note from the note chat, a Reader word
  lesson, a passage chat's explanation).
- **BN-18 — a new list echoed when its window opened** (2026-11-08, found by
  BN-17). Every new list item was `value: 1` (Lexical numbers them from the
  list's `start`), and a list writes the next-words style of its FIRST item's
  first text (`textFormat: 1` under a bold first item) -- measured on five
  lists; "the last item wins", read off the reconciler, was wrong on [0,1].
  Both are `agentNoteNormalizeHelpers.ts` rules now; re-measured, a note of
  heading, paragraph, bullets, numbers, ticks, quote and a verse opened with
  no step of its own. They hold for `owa_note_edit`'s adds of list items too.
  (Applied first to every element, the rule put a passage's title font on the
  passage and the window took it off as a step of its own: lists only.)
- **BN-22 — _new page_ under a lesson was read as a translation** (2026-11-08,
  the user's picture: _chatbot should understand and can append the lesson
  content to new section_). The note prompt's translate rule had no rival, and
  a lesson could go in only block by block. Now a `section` add is many blocks
  from mark-up lines (`expandSectionAdds`; a paragraph add written as such
  lines too), and the prompt says a short line right after an answer puts that
  answer at the end (a page break first for "page"); only words asking to
  translate are a translation. First live try: the example's `
` came back
  written out (read as a break now, the example reworded), and the running
  host refused `section` until the instance was relaunched with the new
  schema. Then: _new page_ -- one edit, page break + heading + three points +
  the verse, no echo.

## Open

- **BN-15 — a drawing in another layout.** Boxes are laid out in rows from
  the arrows; a person may want a left-to-right flow or a cycle drawn round.
  A `layout` word in the drawing's text could say so.
- **BN-16 — whole-note styles in other languages with no model.** The
  window's shortcut reads short English lines only; a Khmer or French line
  goes to the assistant (which does it, BN-10). Their words could live in
  each language's `assistant.json`.
- **BN-19 — a note attached but not yet asked about is lost on a reload.**
  The attachment waits in the box (a row's Open in Chatbot's too); a reload
  of the help window -- or closing it -- drops it, and the tab goes back to
  the Reader. Seen live when a source edit reloaded the scratch window: the
  next line went to the Bible-reader ask. The note the tab was opened on
  could be kept with the tab until a question carries it.
- **BN-20 — nested points flattened in a new note.** `add` reads `- a` and
  `    - b` as two items of one list; an indent could nest the second
  (`indent: "more"`, as a change does).
- **BN-21 — a Resources chat's note not seen live.** The scratch profile held no
  Resources files; that ask has the tool and the sentence, held by tests only.
