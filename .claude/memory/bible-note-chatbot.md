---
name: bible-note-chatbot
description: "Open in Chatbot on ONE Bible note: the note id rides the handoff, owa_note_edit runs ONLY in the note's own window (opened if closed), reads the live editor and writes through it, refusing another note by its whole path; verse tokens name their Bible [^(KJV) John 3:16]; edits Lexical blocks keeping the rest byte for byte; the assistant also MAKES a note (owa_bible_note add, opened and attached), never deletes one; words selected in the note window are quoted in the chat box with their line and range, in the tab ATTACHED to that note or window; a preaching lesson is made and prepared by asking (its shape on lesson asks only, a long write sent FLAT -- the shared server drops a lesson nested in changes)"
metadata:
  node_type: memory
  type: project
  originSessionId: 8967596b-2584-4afe-ba62-f2d3bcebd2f7
  modified: 2026-11-11T20:43:59.885Z
---

A Bible note conversation (2026-11-07, W-60, PL-110 / CB-169) is about ONE note
of a `.own` file, never the file: the row menu and the note window's robot hand
over `noteId` beside the path (`requestChatbotFile(path, null, noteId)`), the
attachment carries it (`ChatAttachmentType.noteId`), and `owa_note_edit` takes
`file` + `id` that the WINDOW fills in from the note's name.

What is not obvious from the code:

- **A note is read and changed ONLY in its own window, through its editor**
  (2026-11-08, the user: _it's dangerous to read and modify wrong file …
  bible-note chatbot should depend on bible-note UI controller_; goal _chatbot
  modifying files should work on the fresh latest user seen content_; _only
  bible-note is an edge case_ -- songs, slides and flows stay as they were).
  `owa_note_edit` finds the window by address, opens it from the main window
  when none is open, and the window's worker refuses any other note by its
  WHOLE path (a window's address names only the file NAME and id, so another
  Bible Notes folder's `Default.own` looks the same). The read is the
  editor's live state after a flush -- the history head trails typing by the
  1 s debounce -- and a change is put INTO the editor, whose `saveData`
  writes the history: one writer, one step of the editor's own Undo. Verify
  with a FRESH stdio server pinned to a scratch instance (the session's own
  MCP server cached the old tool code, [[mcp-tool-edit-two-processes]]); a
  scratch note window with an unsaved change does not exit on `taskkill`
  without `/F` (its close asks).
- **A verse token names its Bible**, `[^(KJV) John 3:16]`; before, the model
  could not see a chip's Bible, a kept token matched by words only, and an
  unnamed new one was read from the lookup's Bible -- so _make the English
  lines KJV_ added a second Khmer chip to each English line and the answer
  said KJV. The summary now names each new verse's Bible.
- **Other windows of the note follow the editing HEAD** through
  `all:app:note-head-changed`, relayed by main to every window (an undo of a
  note head sends it too). That relay is a MAIN-process change, so test it in
  a relaunched (or scratch) instance whose `electron-build/` was compiled with
  `tsc -p electron.tsconfig.json`, never with `electron:build`, which deletes
  the folder a running app uses ([[build-kills-running-dev-app]]).
- **A note with no history has no editing snapshot.** It is backed up as the
  file's state taken as the head, or "Undo this change" undoes nothing.
- **Byte-identical round trip is the bar**: every editable block of the dev
  data folder's real notes was given its own words back and must leave the
  note unchanged (it caught two adjacent same-format text nodes read as one
  run, and edge spaces moved outside the `**` marks).
- **gemma4:cloud tidying a note replaced a paragraph's words with a heading.**
  `checkLosesWords` now refuses another kind with fewer than half the words.
  The prompt says a heading is a NEW block.
- **A saved conversation had kept only three buttons per message**; every
  document card has five. `MAX_REPLY_COUNT` in `chatSessionHelpers.ts` is 5.
- The editor's own guide (`bible-note:ui/…`) answers only a search aimed at
  `focus: 'bibleNote'`; a note ask forces that focus. **A guide page offers
  no walkthrough at all**: `owa_guide_start` refuses demo mode for a page,
  and under _make text bigger_ both buttons answered "I could not do that
  just now" (2026-11-08).
- **Text size is the tool's job, not the guide's**: a change takes `size`,
  and _make text bigger_ / _make the words smaller_ / _make the words 20 px_
  are done by the window with no model. A run with no size of its own starts
  from its block's CSS size (15, h1 24, h3 12, code 13), not from 15.

- **The conversation works IN the note's own window** (2026-11-08, the
  user, the head of a note chat reading _Bible Reader · Auto_: _chatbot
  should demand select a bible-note window (open one if not opened)_). The
  row's menu, after the AI caution, asks main for the app's windows
  (`main:app:list-app-windows`, the help window's picker list) and opens the
  note's window when it is not among them -- not when the list cannot be
  read, since a second editor on one note writes its stale copy back. The
  help window then sets the tab to `bibleNote` and keeps the note's
  `{fileFullName, noteId}` per tab (`noteWindowBySession`), which
  `toNoteWindowAim` matches against the windows' addresses
  (`noteWindowMatchHelpers.ts`, `bibleNote.html?file=…&id=…`) BEFORE a
  window id or the opener's -- the help may have been opened from the
  Reader, whose opener aim would win otherwise -- and two note windows open
  are no reason for no aim. A window or kind picked by hand drops it.
  **It holds across a reload and a relaunch**: the target is read off the
  note the tab KEEPS (`findSessionNoteTarget`), `applyChatLaunchFocus`
  leaves a note tab alone (its keep predicate), and a note tab saved
  asking about another kind is put back on Bible Note -- a relaunch from
  the Reader had made it _Bible Reader_ again.

- **The toolbar is fields, and a small model must be SHOWN one**
  (2026-11-08, the user: _make chatbot able to use all toolbar operations_).
  Every control maps to a field or an Insert kind (inventory and parity in
  the `owa-enhance-bible-note-chatbot` skill). What the live run taught:
  gemma4:cloud never sent `color` from a field list -- it wrote HTML into
  `words` and claimed the colour -- until the prompt carried one example
  change; the tool now also reads that HTML, matches `words` as whole words
  first, and says in its summary what each change did. Link block text is
  kept in the note window's browser storage by block POSITION, not in the
  note: no change can make it -- so the change writes the editor's own
  entry there (node paths), as it does the ¶'s setting, both backed up
  as `home-setting` restores (2026-11-08, the four once excluded made the
  chatbot's too).
- **An open note window writes back what the editor would write another
  way, as a history step of its own** (2026-11-08, BN-12). A drawing left
  at the top (the editor keeps one in a paragraph) and five other kinds
  did, and _undo that_ undid the echo, not the drawing. Count the note's
  history steps with the window open: one a change. Changed blocks go
  through `normalizeNoteNode`; a code block's highlighting still
  echoes, and undo/redo step over it by `toNoteCanonicalText`.

- **The assistant MAKES a note too, never deletes one** (2026-11-08, the
  user: _chatbot should be able to create new bible note (not allow
  delete), after create should open the note and attach to the chatbot
  session_, then the goal _chatbot can put a lesson to a new bible note for
  user_). A line under a Reader answer is a `bible-reader` ask with its own
  short tool list -- that is why it said "I cannot write into your app" --
  so `owa_bible_note` is SHARED to the teaching asks (bible-reader, lookup,
  resources) and to a note ask (a NEW note only), with one prompt sentence
  (`noteCreatePromptHelpers.ts`). Told merely that it could, gemma4:cloud
  asked what to write; "never ask what to write" fixed it. The window
  attaches the note an `add` made off the result's `filePath`, through the
  same path a row's Open in Chatbot takes. A model's delete of a note or a
  notes file is refused everywhere.
- **A note window echoes what the editor would number or style another
  way** (BN-18): new list items must be numbered from `start`, and a list
  writes its FIRST item's first-text style (`textFormat: 1` under a bold
  first item) -- "last wins", read off the bundled reconciler, was wrong;
  five lists opened live settled it. Count history steps with the new
  note's window open: the add is one, the window none.
- **An answer goes INTO the attached note as a `section`** (BN-22): a
  short line right after a lesson (_new page_, _add it_) appends it, a
  page break first for "page" -- it had been read as a translation. A new
  `owa_note_edit` kind or field needs the scratch instance RELAUNCHED: its
  in-app host kept the old schema and refused `kind: "section"`
  ([[mcp-tool-edit-two-processes]]). And a developer-door edit must name
  the file with backslashes on Windows, or the open note window never hears
  the head change (it matches its own path).
- **A source edit reloads the scratch help window through the shared
  Vite**, dropping an attachment still waiting in the box (BN-19) -- a
  line asked next is not the note's. Ask again after the reload settles.

- **Words selected in the note ride to the chat as a quote** (2026-11-08,
  the user: _select bible note text then click the agent button then
  writing a qustion about the selected text_; `bible-note` 0.6.0's
  `appendFloatingActionButton`). The bar over a selection ends with **Ask the
  assistant about this**; `toNoteSelectionMention` reads the LINE around the
  words off the editor's DOM range (`p, h1..h6, li, blockquote, code, td,
  th`) and their 1-based range when one line, and the file hand-off carries
  it beside `noteId`. The box gets `Selected text (<note>, 43-47):` and the
  line with the words between `**` (the prompt says they are a selection
  mark, NOT bold -- the note read itself uses `**bold**`), plus a card of
  seven jobs under it (`genSelectionOffer`, a pseudo tool the model cannot
  press; Google and Copy need no model). Which tab: the one holding the note
  (box or open in what it asked), else one ATTACHED to the note's window --
  never a tab merely FOLLOWING the opener: a press in the note window turns
  every unchosen tab to Bible Note, and `toFocusWindowAim` then made an
  older unrelated chat "work in" the note window and take the words (seen
  live; `toTabWindowAim` takes `null` for a tab that chose no kind).
  **Testing it live**: a source edit hot-reloads the help window and drops
  what waits in the box and `noteWindowBySession` ([[dev-hmr-stale-state-qa]]),
  so test reuse with no edit between the presses; and the editor redraws its
  text on a double-click, so a `take_snapshot` uid is good for ONE select.

- **Every language** (2026-11-08, the user's goal _work great for all
  languages_; BN-23..BN-27). What English never showed: a word of a script
  with no spaces matched ANYWHERE (Khmer ព្រះ inside ព្រះជាម្ចាស់) until the
  browser's word segmenter gave the edges -- Electron's ICU and Node's
  agree on Khmer, Thai, Chinese and Burmese for these cases but not
  always (Node keeps ព្រះគម្ពីរ whole, Electron splits it), so a test must
  pick words both cut alike; a new verse came from the Lookup's Bible in
  any language, now from a Bible of the language asked in; a note named in
  the window's language was offered a translation into that language. A
  multi-language live run needs each language PACKED and installed on the
  scratch profile and a Bible of each (copy the person's
  `bibles-data/<key>.xml`, or the Bible import's `check` / `import` from the
  catalog -- Chinese and Arabic book names from a Wordproject index page
  with `names`, none found for Thai). And keep source edits out of the run:
  the first two Khmer asks went to the guide only because an edit had
  reloaded the scratch help window and dropped the waiting note (BN-19).
  Later the same night (BN-16, BN-28..BN-30): to PROVE a window shortcut
  ran with no model, point the tab at a stand-in model (a local server
  the scratch copy's `OWA_LLM_REGISTRY_URL` names, serving the real
  registry plus itself) and count its requests -- 0. A note window driven
  over CDP keeps the focus, so it waits 1 s + 3 s before showing a head
  another window wrote: an undo then an ask raced it (fixed: `flush`
  applies it). Free's Nemotron writes `Choices:` for `OPTIONS:`, answers
  in broken Khmer when told Khmer words are "for them", swaps one Khmer
  subscript for its look-alike in a note's name, and copies a typed line
  only when the translated question still carries it as typed.
  **Every installed language at once** (BN-31..BN-36): two scratch copies,
  42 languages each, ran the window's shortcuts and a model's bold in all
  84. What it found is the lesson for any multi-language run: (1) the
  DETECTOR named short lines another language -- French's half-evidence in
  every app, a script tie to the first listed, lists missing their
  commonest words -- so judge the answer's language by the language, not
  its script (a Bulgarian line answered in Russian passed a script check);
  (2) the ASK WORDING is half the result: my word for bold was the word for
  black in eight languages, the model made the line black, and the window's
  own bold shortcut had the same words -- a shortcut must never be a colour
  or a size; (3) on Free, a quarter of the asks CHANGED the note and then
  failed to answer, which hid the change until the failure answer learned
  to carry it with Undo. A model that changes then goes quiet is shown live
  with a stand-in that answers its first round with an `owa_note_edit`
  call and every later round with nothing. And the round trip on the dev
  data folder went red on a note the editor wrote (a space inside bold, a
  comment mark, a highlighted code block): a block given its own words
  keeps its nodes now. The next day (BN-37..BN-40): a free-tier re-run found
  the undo of a change named with forward slashes never reached the note's
  open window (one path key for both slashes now -- run a harness with the
  app's own path form, or it tests something else); and a second reader,
  told no reason, back-translated every language's shortcut words and
  found 31 more that could ask for something else -- worth doing whenever
  shortcut words are written without native speakers.

2026-11-09, the 87-language run (BN-44, BN-46): an add repeating a block's
words is refused (meant as a change to it) unless it says `again: true` --
refused twice with no way out, a model told the person the line was added.
And **Undo this change** had been inside the firewall's removal ration (10 per 5 minutes): a harness pressing it every 15-20 s had 27 of 75 refused while counting them done. Fixed the same day (BN-46): an undo of the session's own non-removing change is no removal (`genOwnChangeMemory`), and 176 undos of the next run all held. Grade an undo by the note or the backups' `Undid` entries, never by a new line in the chat.

2026-11-09, the elder corpus (the user's story: _as an elderly church
member, I don't know technical work much but I need chatbot help me prepare
lesson_, goal ~500 questions; BN-50..BN-54). Six hundred things such a person
types, written by a reader told only the person and the note
(`references/elder-asks.json`, `run-elder-asks.mjs`). What a long run of it
taught: (1) **a tab cut to 60 messages lost its note** on the next reload --
the question that attached it went first -- so every later ask was a Reader
ask ("I cannot see what you wrote"); the harness now marks an ask with no
`owa_note_edit` call `not-note-ask` and re-attaches, and `trimSessionMessages`
keeps that question (BN-54). (2) **The spend guard paces a run**: 150 model
calls an hour per profile, and its **Allow more** is the person's press,
never a script's (not even with the caution allowed) -- split the corpus over
profiles (`--every=3 --offset=k`) and pace each (`--pace=55` asks an hour).
(3) **The drawing** (the user, with Insert → Excalidraw circled: _make sure
chatbot can help drawing_): a `size` on a drawing's block had changed
nothing while the answer said larger -- a drawing now takes size, colours,
new lines and a layout of its own (BN-51); and a model told about `layout:
across` laid every drawing across until the prompt said top to bottom unless
asked. (4) The elder answers that fail are mostly CLAIMS -- a picture said to
be drawn, an unchanged drawing said to be updated -- held back by
`NOTE_CLAIM_NUDGE` (BN-53). (5) `[^Psalms 23:1]` was no verse to a note while
`owa_find_verse` read it (BN-50). (6) **Formatting a messy note** (the user:
_formatting document is the most needed_, BN-58): a model reformats the way
a person rewrites -- the old block removed and the new ones added `after: 0,
1, 2 …` numbered as they WILL stand, or a paragraph made the title with its
parts added after it. The tool had refused both (an add after a removed
block, a number past the end, a block losing words to a heading) and the
model went round seven times to no answer; it now reads them
(`chainRewriteAdds`, removes last, the words judged across the blocks after
it) and splits a block given lines with a list kind or `section`. Read what
a model WRITES before teaching it a new field -- each of three messy notes
then went in one call.

2026-11-10, the goal _chatbot completely smart enough to help prepare a
best preaching lesson_ (BN-60..BN-65). What it taught, beyond the code:
(1) **a small model writes the lesson it is SHOWN**: told only "a lesson
given whole", it wrote a title, bullets and a verse; given what one holds
(`PREACHING_LESSON_SHAPE`, on lesson asks only), a preachable sermon in one
call. (2) **"wrote no answer" on the shared server can be the SERVER
dropping a call it could not parse**: tap every round in dev (finish
`stop`, ~850 tokens generated, no text, no call), capture the request and
replay it straight to the registry server with small changes -- a whole
lesson nested in `owa_note_edit`'s `changes[].text` dropped 7 of 8, the same
lesson as one flat `owa_bible_note add` `text` came back 5 of 5. Shape the
long writes FLAT. (3) **Read a fix's bookkeeping, not only its call**: the
window filled a missing `action: "edit"` for the tool, but the watch read the
model's own args, counted no change, and the claim nudge made the model
repeat a done edit onto a note that had moved. (4) **"Check my verses" must
be read by the window** and set side by side with the note's own words --
told to check, the model claimed it had; told what the Bible says, it still
missed a wrong verse; beside the note's line, it named it. (5) The custom
servers' lean tool list had never held `owa_bible_note`; check the list a
provider is actually SENT before trusting a hint that names a tool.

Later the same day (BN-64, BN-66..BN-68), the Stop hook's _the "best"
standard is never shown_: (6) **"best" is a written standard and a blind
reader's** -- `lesson-rubric.md` (Robinson, Chapell, Stott; twelve
criteria, a factual error caps a lesson) and two readers on different models
given the standard and the lessons alone; `run-lesson-asks.mjs` makes the
lessons through the real window, `lesson-rubric.mjs` checks the structure.
(7) **A unit test built on an assumption passes while the window fails**:
the empty-note card read an attachment summary the test had made up; the
file's reader writes `(empty)`. Build the fixture the way the window does.
(8) **A model numbers new blocks as they will stand, and the tool reads
them as read**: finishing an outline, `after: 3, 4, 5, 6` for a heading,
its words, the next heading … scrambled the note. The window naming each
missing part with the block it goes after, and the tool reading a heading
with its words as one section, put four partial sermons right; asked to
send a dropped change in parts, it must go FROM THE END UP (an add moves
only what follows it). (9) **Loose lines want the flat add the empty note
has**, placed by the window only when every line of theirs is in it.
(10) **Asking a model for richer content buys invented content** -- "the
fact that changes how it is heard" and "a concrete story" brought invented
history and anecdotes told as true, and "be TRUE" in words did not stop
it: the model writes before the app prints the passage, so it quotes and
numbers from memory. Having it READ the passage first (`owa_find_verse`)
made the lessons richer and truer at once, by two blind readers. Measure a
prompt change blind, before against after, shuffled -- not by reading the
new output. (11) **The review is the way to best**: a draft is good, the
review's fixes as buttons that SAY the change make it better in place.
(12) **A loop is only as good as its weakest press** (BN-74): run
draft → review → first fix, twice, on eight asks, it stopped five ways --
fixes written with the marker dropped, a review with no fix to press,
passages offered as plain lines, a devotion reviewed into three points, a
children's lesson printing a whole book. Each review answer is read by
the window for its buttons whatever its frame, a review with none asked
once more (then its named fixes are the buttons), a fix pressed leaves the
review's others pressable, and the review is told the form the tab asked
for. Test the JOB (help prepare: draft, review, every fix pressed), not
the first draft alone. (14) **A model keeps to the words of a list it is
given only loosely**: told to open its buttons on Add, Write, Move or
Make, it wrote Grow, Rewrite and Clarify too -- read the shape, not the
four words. (15) **A source edit hot-reloads into every scratch app on the
same Vite**: a lesson run in flight lost a review to one. Edit `src/` only
between runs, and know that a peer session's edits land the same way.
(16) **A fix is safe when it only adds and rewords**: the blind reads of
the whole loop moved the mean little (+0.4, then -0.25) because the few
fixes done as block SURGERY -- a point added by moving fifteen blocks, a
renumbering that took a heading out -- broke a sermon's shape and cost
3 points each, more than the other fixes won. A lesson fix that moves or
removes a block nobody asked to move or remove is refused (BN-80); measure
the loop by its worst fix, not its average one. And a fix asked with none
of the lesson's truth rules invents detail (BN-79): every ask that writes
into a lesson carries them. (17) **On a free model the draft IS the
lesson**: two blind readers found the review loop moves the mean by under
a point either way, while one change to the shape (each point's hard word
explained from Scripture, an example as a scene from the hearers' week,
a person's reason only as the passage gives it) moved one reader 19.00 ->
20.08, Best 4 -> 6 of 13 (BN-81). Spend effort on the first draft; and
running the whole set, not only the weakest asks, is what found the
draft's own failures (a two-reference token refusing a whole lesson, a
question written into an empty note, a reference list read one item).
(18) **A small model follows a labelled line it skips in a sentence**:
told in one long sentence what a point holds, gemma4:cloud wrote one
paragraph a point. Given each point as labelled lines (**What it means:**,
**A hearer asks:**, **The passage answers:** …), it wrote every line of
every point. A placeholder that bundles two jobs ("the question,
answered") gets the first job only, so each job gets its own line (BN-82).
(19) **Before tuning a hint, check the ask gets it**: the funeral sermon was
"thin" in every blind read for a day, and it had never been given the
lesson shape at all. "A message of hope for a funeral" holds no lesson
word, so it carried no lesson hint and was written from the short outline
(BN-85). Read which hint each measured ask carries before blaming the
hint's words. (20) **Check what the model was GIVEN, not only what it was
told**: the shape said "build every point on the words it returns", and
`owa_find_verse refs` returned a passage cut at 300 letters -- its first
two or three verses. Every factual error two blind readers found in a
day of richer lessons sat in the verses never read (BN-86). The tool's
result in a run's own record ends in "…" inside the JSON: that is the
tool cutting, not the record. (21) **A busy computer is a test case**:
another session's full test gate pegged the CPU, note windows took over
20 s to open, and the window's read of an empty note failed. Seven
lessons of twelve went into a NEW note (BN-87). The church machines this
app is for are that slow on a normal day. (22) **What the window gives as
fact is copied word for word, wherever it fits**: the KJV word table's
"penny, pence: a labourer's pay for one day" came back as "a hundred pence
was roughly a labourer's pay for one day", and "a shekel is a weight of
silver paid as money" was said of Goliath's coat of brass (BN-91). Each
entry has to hold everywhere it can be copied to: give the unit AND how it
counts ("ONE penny … two pence, two days' pay"), give every sense the Bible
gives the word, or match only the sense the entry gives. Read a run's
lessons for the table's own words before a blind read: both slips showed
in the first lessons that used the entry. Two more from BN-92. An entry's
FIRST words steer: "create: God's own work -- he created the heaven and
the earth" still came out as "making something where there was nothing
before", so the entry now opens on the correction ("not only out of
nothing"). And a rule that limits a line to the list empties that line
wherever the list has nothing: told "a What it means line says of them
only this", a point with none of the words wrote "No specific words in
these verses require further explanation". The same goes for an example
phrase in a prompt (BN-95): shown "a nurse after a night shift" and "at
the meal table" as samples, the first four lessons opened their examples
and deeds on those very words. Describe what is wanted with no phrase to
copy, or the sample becomes the next stock picture.
(23) **Name the wrong reading to stop it**: a word-table entry that only
states the truth is read past; one that names the wrong reading is
followed. Told "the parable says no more of that hearer", a sower lesson
still answered "Can a person be a believer but still be unfruitful? Yes";
told he is "never a believer", it asked another question (BN-108). Told
Jonah's sign was given "to the scribes and Pharisees", a children's
lesson still had "His friends"; told "never told to his friends or
disciples", it had "his listeners" (BN-111). And two facts set side by
side get merged: "created man" (Genesis 1:27) beside "of the dust of the
ground" (2:7) came back as "He created man from the dust (Genesis 2:7)"
-- which says formed (BN-115). Say a different word is different, in so
many words.
(24) **More citing is more to get wrong**: asked to quote the New
Testament's own words for Christ (BN-112), the lessons cited three times
as many verses (10 -> 31 quotations a run). Every quotation was word for
word -- BN-110 reads each verse a quote names, and an audit of the run
against the app's KJV data found none off -- but the new errors were in
what the sentences said ABOUT those verses: Isaiah 53:5 called the New
Testament (BN-114 now catches that one), Ephesians 1:22's subject turned
round. A check that holds the words holds nothing said around them.
(25) **A blind read compares within itself only**: the reader brief went
with a retired scratch folder and was written anew, and the same kind of
baseline lessons scored Opus illustration 1.19 under the old brief and
1.94 under the new. Compare the two sides of ONE read, never a figure
across reads. A lost key can be rebuilt: `lesson-ab.mjs`'s shuffle is
fixed by the before-run's row order and the seed (how ab18 and ab19 were
unblinded after their key file was gone) -- check it against what the
reader says each lesson is about.
(26) **A run costs about seventy rounds of the hour's 150**: a 16-ask run
spends 60-80 model calls, a single re-ask four or five, and three runs in
an hour latched two scratch profiles' pace cap, which only a person's
**Allow more** lifts. Read the profile's own
`data/local-storage/chatbot-spend-ledger` (`rounds`, `[time, …]`) before a
run and start when the past hour holds under about 60; a row recorded as
`paused` is asked again by the next run of the same file.
(27) **Read what the readers were given before believing a score**: four
reads (ab20..ab23) scored L-01's lesson down for a passage "cut off at
verse 51" and a children's lesson for labels that "run together" -- both
the harness's doing. `owa_note_edit read` hands a block over 8000 letters
back cut with "…" (the note holds 1 Samuel 17:1-58 whole), and a block's
line breaks were written as Markdown lines, which join. `lesson-rubric.mjs`
now rebuilds a cut KJV passage and keeps the lines. When a reader names
a defect, open the lesson file they read AND the note it came from.
(13) **A fresh scratch data folder needs its child folders too**: a
`setting.json` naming the data folder is not enough -- that folder's own
`local-storage/select-dir-bible-notes` (and `-app-document`,
`-bible-presenter`, each `$DATA_DIR_PATH\<name>`) or every note call
answers "No Bible notes folder is set up yet". And a scratch app that is
the ONLY published instance is what any other session's tools find: seen
2026-11-10, questions not ours in its help window minutes after launch.

Verified live on a scratch dev profile ([[scratch-dev-instance-beside-user-app]]),
the AI caution's Open pressed over the scratch instance's own CDP after the
user allowed it in the conversation. Related: [[language-data-change-bumps-version]].
