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
- **BN-23 — a note question put into English lost the note's own words**
  (2026-11-08, the user's goal _work great for all languages_). An assistant
  that is not a Gemma 4 is asked the English of what was typed; a word of a
  Khmer note named in Khmer came to it as "grace" over a note holding no
  "grace", and the words of a line to add came back English. The note ask
  now carries the typed words beside their English
  (`toNoteOwnWordsHint`): a word or line of the note, and words given to be
  written in, are taken from them; words the model writes are in the typed
  language unless another is named; a translate button pressed in the
  window's words is read off them too. Live on Free's Nemotron, asked in
  English behind the scenes: _make the word ស្រឡាញ់ in line two bold_ (typed
  in Khmer) sent `words: "ស្រឡាញ់"`, one edit, 20 s with the two
  translation rounds.
- **BN-24 — words of a script written with no spaces** (2026-11-08). Khmer,
  Thai, Chinese, Burmese have no space between words, so the whole-word
  rule never held and `words` matched ANYWHERE: _ព្រះ_ coloured the start of
  _ព្រះជាម្ចាស់_ too, and a word given without its last mark cut the mark
  off its letter (a run of its own -- a dotted circle once the halves differ
  in face or weight). `findWordRanges` now takes a word as whole where the
  browser's word segmenter puts its edges (Electron's ICU cuts all four
  scripts into words, measured), falls back to anywhere widened to whole
  letter clusters (a mark, and a letter set under an invisible stacker,
  stay with their letter), and lowers case at the same offsets (a dotted
  capital I is two letters lowered: _Sevgidir_ had coloured _evgidir_ and
  the letter after). `checkLosesWords` counts the segmenter's words: a
  Khmer or Chinese paragraph had been one or two "words", so the guard
  never held a heading off it. Live: ព្រះ alone red, ព្រះជាម្ចាស់ as it was
  (Khmer); พระ alone, not พระเจ้า (Thai). Cases in each package's
  `tests/helper/agentNoteBlockHelpers.test.ts` (km, zh, th, tr), every one
  failing on the old code; round trip 276 / 306, 0 failures.
- **BN-25 — a Khmer note's card offered to put it into Khmer** (2026-11-08,
  seen live). `pickTranslateLanguage` offered the name's language, else the
  window's -- right for an English song in a Khmer window, wrong for a note
  (or song) named in the window's own language. A name WRITTEN in a
  language other than English (`detectTypedLanguage`; one Latin word tells
  nothing and keeps the old rule) now gets the other of the two: English
  for one in the window's language, the window's for one in another. Live:
  _Replace the words with English_ on the Khmer note in a Khmer window and
  on the Arabic one in an Arabic window. The song and slide cards share it.
- **BN-26 — a verse put in came from the Lookup's Bible in any language**
  (2026-11-08, seen live): asked in Khmer under a Khmer note, John 1:1 came
  from the KJV the Lookup was on, Khmer Bibles installed. A note ask typed
  in another language than English now reads a NEW verse with no Bible
  named from an installed Bible of that language when the Lookup's is not
  one -- the rule a Lookup record's verses follow (`pickBibleInLanguage`) --
  looked up once an ask, only when an edit adds a verse
  (`checkAddsNoteVerse`, `findNoteVerseBible` in `llmBotHelpers.ts`). Live,
  each one call: ពគប (Khmer, in Khmer digits), CCB (Chinese), SVD (Arabic,
  in Arabic digits), LSG (French typed in an Arabic window).
- **BN-27 — options listed under a bare `OPTIONS:` were drawn as words**
  (2026-11-08, seen live in a Chinese note answer). The parser looks two
  lines back and reads the marker's own line; a model that listed three
  options under it left four lines of machinery in the answer and no
  button (one listed option would have stayed as text). `parseAnswerOptions`
  now takes a bare marker followed by up to five short lines to the end as
  the options. The shared window's parser: every answer gets it. Seen live
  on a stand-in model (a local server the scratch copy's registry named,
  answering with three options listed under a bare `OPTIONS:`): three
  buttons, no frame left in the words.
- **BN-16 — the window's no-model shortcuts in other languages**
  (2026-11-08). The size and whole-note style shortcuts read short English
  lines only, and a card stores its buttons as the window shows them, so the
  slide card's **Make the words larger** pressed in a Khmer window reached
  the assistant, though `agent-tools.md` said a press "asks its own
  English". Now: a card button the window does by itself is asked in its
  English when pressed in ANY language (`findWindowDoneCardAsk`, the press
  echoed as shown), and a language says its own size and style asks in its
  `assistant.json` (`textSizeAsks`, `noteStyleAsks`, `colorWords`, read by
  `languageEditAskHelpers.ts` for slides and notes alike) -- Khmer and
  French, the two with an assistant (km 0.0.41, fr 0.0.33, packed). In
  Khmer, "big letters" is also the editor's Uppercase, so a bare _make the
  letters big_ stays the model's; the patterns want "than before",
  "enlarge" or "increase the size". Live, a Khmer note's chat on a stand-in
  model (any request to it would have shown): _ពង្រីកអក្សរ_ -- every block
  15 → 19 px by the window, its own Khmer sentence, 2 s, no model asked;
  _ធ្វើឱ្យអក្សរទាំងអស់ដិត_ -- every block bold, likewise.
- **BN-28 — an ask right after Undo this change read the note before its
  window followed** (2026-11-08). The window hears a head another window
  wrote and reloads it after a 1 s debounce -- and, while it has the focus,
  3 s more to let typing settle: in that time the help window's next read
  got the undone state's hash and its edit was refused as stale (two edit
  calls, ~18k tokens where one is ~8k). A head change heard is now marked,
  and the window's `flush` -- which the worker calls before every read and
  change -- applies it at once (asked from the help window, nobody is typing
  in the note). Live: **Undo this change**, then at once _make all the
  letters bold_ -- the read carried the restored hash, one edit.
- **BN-29 — a translated answer half-translated its own frame**
  (2026-11-08). Captured off the wire on Free's Nemotron: it ended its reply
  _Choices: Undo this change_, and wrote the answer itself in broken Khmer
  (copying the window's own Khmer sentences from the tab's history, and
  told by BN-23's first hint that "words you write for them" were Khmer),
  so the answer skipped the translation and its frame stayed as words, half
  put into Khmer. `Choices:` is read as the options frame now, and the hint
  says the words put INTO THE NOTE are theirs while the answer stays
  English for the window to translate: asked again, an English reply with
  `OPTIONS:`, put into Khmer with its three buttons.
- **BN-30 — a note named with a look-alike letter was refused for good**
  (2026-11-08, seen live): Nemotron wrote the Khmer note's name with one of
  two subscript letters that look alike in place of the other -- a swap
  keyboards and models make -- and `resolveNoteEditTarget` refused it; it
  gave up after 75k tokens. A name a letter out (one edit a ten letters,
  any script) is the ONE note attached; with two attached it is still
  refused, never guessed. And BN-23's line to add, measured on Nemotron:
  with no hint the English _God is love_ went into the Khmer note 2 of 2;
  with the hint Khmer 4 of 4, but its OWN Khmer 3 of them (a word dropped),
  because it worked from the translated line -- so the translator now keeps
  words they want written somewhere as written: the typed line exactly, 2
  of 2.
- **BN-31 — the window's own shortcuts understood English, Khmer and French
  only** (2026-11-08, the goal _work great for all languages_). _Make the
  text bigger_ and a style for the whole note, typed in any of the other 85
  languages, went to a model. Each `typed.json` now says them
  (`textSizeAsks` larger and smaller, `noteStyleAsks` bold), read by
  `languageEditAskHelpers.ts` after the English and the assistant
  languages' own; 85 versions raised and every language packed. One sample
  of each language, as a person types it, is held by
  `src/lang/data/tests/chatbot/typedEditAsks.json` (86 entries: Chinese
  twice); the test also holds that _make the first line bold_ is never done
  by the window as the whole note. Live on two scratch copies, 84 languages
  installed between them (42 each), an English window, Auto on the shared
  gemma4:cloud, a note of two lines in the language: _make the text bigger_
  84 of 84 done by the window, no model, 2 s each; _make the first line
  bold_ (the model's) 74 of 84 right, 83 in one edit, no other line ever
  touched, no error; the answer in the language typed 73 of 84 by its little
  words. The misses: my own wording for bold read as "black" or "dark" in
  Zulu, Xhosa, Chichewa, Kinyarwanda, Kirundi and Yoruba (the model made the
  line black, fairly), Tibetan made bigger, Tongan answered "no bold"; and
  five answered in ANOTHER language -- Hausa in Romanian, Kinyarwanda and
  Shona in Hausa, Fijian in Kirundi, Oromo in English: BN-33.
- **BN-33 — a short line named ANOTHER language, and answered in it**
  (2026-11-08, from BN-31's sweep). With every language installed at once,
  the detector named 48 of 351 lines -- the 86 languages' four edit asks and
  the sweep's -- as another language. Three causes. The half-evidence
  belief went to every language with an `assistant.json`, French in every
  app, so a Dutch, Italian, Haitian or Samoan line in an English app was
  French on one word they share ("de", "il", "la", "le"): it goes to
  English and the language the app is SHOWN in now
  (`SHOWN_LANGUAGE_PRIOR`, `detectTypedLanguage(text, appLangCode)`, passed
  by `pickReplyLanguage`, the card's `pickTranslateLanguage` and the chip
  filter). A tie between languages of one script went to the first listed:
  Ukrainian, Bulgarian and Macedonian lines with no letter of their own were
  Russian, Nepali and Marathi Hindi, Mongolian Kazakh -- now the app's
  language, then one family, else `other`, answered in the language it was
  written in. And thin lists: Hausa lacked "mai", Kinyarwanda and Kirundi
  "wa", "mu" and their elided `z'`, `y'`…, Shona "ita", Fijian "i", "ni",
  "me", Irish "an", "i", Haitian "la", "pi", Samoan "uma" and "fa'",
  Serbian "из", Russian "их", "слишком", French "moi", "tout", "fait",
  "depuis" (French no longer has the half in an English app) -- fourteen
  packages, versions raised, packed. The okina (U+02BB) reads as the
  apostrophe, in a line and in a list (Tongan's is written with it). A
  first cut -- name a Latin language only on two pieces of evidence --
  broke five right lines (Indonesian, Zulu, Xhosa, Shona and Chichewa
  questions say one little word each) and was dropped. After: 0 of 351
  named another language with all installed and the app in English (193
  right, 158 left to the app's language or `other`); with the app in the
  line's own language, 351 of 351 its own or the app's -- held by
  `typedEditAsks.test.ts` both ways; `anyLanguage.test.ts`'s third column
  takes `other`. Live on the sweep's two scratch copies, the new packs
  installed through **Update to**, the five answered in another language
  and four the probe named wrong, asked again: Hausa, Kinyarwanda, Shona,
  Fijian, Kirundi, Ukrainian, Bulgarian, Macedonian and Nepali each
  answered in its own language.
- **BN-34 — the window would have made bold what was asked to be black**
  (2026-11-08, from BN-31's sweep). Eight languages' whole-note bold
  shortcut had been written with their word for BLACK or dark -- Zulu and
  Xhosa _mnyama_, Chichewa _zakuda_, Kinyarwanda _umukara_, Kirundi
  _birabura_, Yoruba _dúdú_, Igbo _ọchịchịrị_, Fijian _loaloa_ -- and asked
  the same words for one line, the model made it black: so the window, with
  no model, would have made the whole note bold for somebody asking it to be
  black. Tibetan's word for thick is its word for big (the model made the
  line bigger). Those eight say the loanword now (`… ube bold`, `cakava me
  bold …`), which nobody types meaning a colour; Tibetan has no bold
  shortcut -- the model is asked -- and the test holds that the old black
  phrases never reach the window. Live on the scratch copies, the first line
  asked with the loanword in all nine: bold in one change, no other line
  touched, the answer in the language typed, 9 of 9 (it had been 0 of 9:
  six made black, two asked what was meant, Tibetan made bigger). Tongan's
  says "thick" (_matolu_), neither a colour nor a size, and was kept: the
  model answered in Tongan without making the line bold -- BN-32's to read.
- **BN-35 — a block given its own words back was rebuilt** (2026-11-08,
  the round trip on the dev data folder: three failures, in a note new
  since the last run, and the same with the last commit's helpers). The
  light mark-up says no space inside a bold run, no comment's mark, no code
  block's colouring, so rebuilding from it moved `Theme: `'s space out of
  the bold, dropped the comment on _Let there be light_ and flattened a
  Markdown code block -- and a model sends a block's words back with a style
  or a kind all the time. A change whose `text` IS the block's own, as
  read, now keeps the block's nodes (`ownWordsChangeSet` in
  `applyNoteEdit`), and its summary says no "new words". Round trip 254 /
  292, 0 failures; three tests in `agentNoteBlockHelpers.test.ts` (each
  failing with the rule taken out), one of them a colour on the commented
  block, its mark kept.
- **BN-36 — a change made, then a failure, and no word of it** (2026-11-08,
  Free's Nemotron in six languages, twice each, adding a typed line): three
  of twelve put the line in -- once with a stray _Test line_ of the
  model's own at the top -- and then wrote nothing or met a service error,
  and the window said only _Free could not answer_: no word of the change
  and no button to take it back. `askLlmBot` now answers such a failure
  with the change (`genChangedWithoutAnswer`): _"Sweep" was changed, but
  the assistant stopped before saying what it did. Undo this change puts
  it back._ with **Undo this change** and **Show it in the list**, as a
  finished change has. Auto hands no such ask on (a round came back), so a
  second assistant never makes the change again. One new sentence in all
  87 languages (versions raised, every language packed). The rest of that
  run: Arabic, Thai, Chinese, Russian and Spanish wrote the typed words
  exactly every time they wrote; Chinese once ran out its four minutes
  with nothing changed. Seen live with a stand-in model that changes the
  note and then answers nothing: the sentence, both buttons, and **Undo
  this change** answering _"Sweep" is back as it was before that change._
  with the note's two lines back.
- **BN-37 — a look-alike letter in the words a model writes** (2026-11-08,
  Free's Nemotron): the typed Khmer line went into the note with TA's
  subscript where the person had typed DA's -- the same on screen, not to a
  search, 1 of 2. A language now names its look-alike pairs as data
  (`lookAlikes` in `assistant.json` or `typed.json`: two sequences of one
  length; Khmer's is the two subscripts, raised to 0.0.43), the window hands
  the typed words with a note ask (`AskExtraType.note.typed`), and every
  `owa_note_edit` change's `text` and a new `title` are put back to the
  typed ones where only such a pair differs (`restoreTypedWords`,
  `restoreNoteTypedWords` in `noteChatHelpers.ts`, `listLookAlikePairs`):
  each piece of the words, cut at white space and the mark-up's signs,
  folded with the typed line by the pairs; words the person did not type
  are left alone, and the person's own letter wins whichever of the two
  they typed. Tests with a made-up pair and with Khmer's own. Live, Free's
  Nemotron, the Khmer line twice: both exact.
- **BN-38 — an undo of a note change that never reached the note's window**
  (2026-11-09, found by BN-37's free-tier re-run): Chinese, Russian and
  Spanish each put the line in, **Undo this change** answered _back as it
  was_, and the next ask found the line still there. Reproduced with no
  model -- `owa_note_edit` adding a line, `owa_undo` at once or 5 s
  later, the note read at +0 / 1.5 / 4 / 8 s: still three blocks every
  time when the note's file was named `C:/…/Default.own`, two at once
  with `C:\…\Default.own`. The note window drops a head change for
  another file by `toPathCompareKey`, which lowered a path's case and
  never its separators; Windows reads a forward slash as the backslash, so
  the undo's "this note changed" named another file to it and its editor
  kept the line -- and wrote it back on the next change. The key now makes
  both slashes one on Windows (`storageFileHelpers.ts`; a backslash stays
  a letter of a name on a Mac, Linux keeps the path as written) -- every
  caller of it gains (12 files). Three of them ADDED the separator to a
  key raw -- whether a file is inside a Resources folder
  (`toResourceFileName`, the worker's `checkIsInside`) and whether a
  folder is inside another (`checkIsPathInside`, the data folder move) --
  so the separator goes through the key too; the suite caught it, seven
  help-window tests of a Resources file. Tests per platform; live, the same
  forward-slash undo two blocks at once and after 8 s, and the three
  languages asked again, twice each: 6 of 6 one change, the words exact,
  the answer in the language, every Undo kept. With Khmer, Arabic and Thai
  before it: Free 12 of 12. And six more -- Hindi, Korean, Japanese,
  Vietnamese, Indonesian, Swahili -- twice each: 11 of 11 right, the
  twelfth stopped by the scratch profile's own 150-calls-an-hour pace, as
  designed.
- **BN-39 — the okina in a typed shortcut, and Tongan's bold** (2026-11-09).
  Tongan and Samoan keyboards type the glottal stop as the okina (U+02BB);
  the shortcut patterns write it `['’]`, so _fakalahiʻi ʻa e tohi_ went to
  a model. `toPlainAsk` reads the okina as the apostrophe, and the test
  asks every sample again typed with it. Tongan on Auto: _Fakamatolu'i 'a e
  laine 'uluaki_ (make the first line thick) was answered in Tongan with
  the line CENTRED and said to be thickened; with the word _bold_ it was
  made bold in one edit -- Tongan's whole-note bold takes the loanword
  beside _fakamatolu'i_. Live, with no model: _ngaohi ke bold 'a e tohi
  kotoa_ and _fakalahiʻi ʻa e tohi_ done by the window.
- **BN-40 — an independent read of every language's shortcut words**
  (2026-11-09, BN-32's harm looked for in all 87). A second reader,
  told no reason, back-translated all 1 461 items -- every larger, smaller
  and bold pattern, the colour words, every first-line sample and the 183
  little words BN-33 added -- and flagged what could ask for something
  else: bold said with a word for dark in six more languages (Georgian
  _გაამუქე_, Arabic _غامقا_, Persian _پررنگ_, Sinhala _තද_, Vietnamese
  _làm đậm_, Galician _negra_), and sizes that also ask for more or fewer
  WORDS (Swahili _ongeza herufi_ "add letters", Kinyarwanda _gabanya
  inyandiko_, Khmer _បង្កើនពាក្យ_, French _réduis le texte_), a summary or
  an expansion (Thai _ย่อข้อความ_, Catalan _amplia el text_, Galician,
  Amharic, Yoruba), or CAPITALS (Turkish _büyük yap_, Azerbaijani,
  Indonesian, Malay _besarkan huruf_, Chichewa, Shona, Somali), and
  Portuguese _texto maior_ (also "longer text"). Those leave the window's
  shortcuts or now name the size (`ukubwa`, `ขนาด`, `daha`, `saiz`,
  `tamanho`, Khmer `ទំហំ`); Galician's bold says _negriña_, Sinhala's
  the loanword, Georgian's is the model's; 24 packages, versions raised,
  packed. All 183 little words read as real and rightly spelt; Russian
  gained _все_ as most people type it. `typedEditAsks.test.ts` holds the
  dark words never bold and the other-meaning phrases never a size.
  Live on the scratch profile with the new packs, no model: Swahili
  _ongeza ukubwa wa herufi_ done by the window, _ongeza herufi_ left to
  the assistant; Khmer _ពង្រីកអក្សរ_ by the window, _បង្កើនពាក្យ_ to the
  assistant. The reader marked its read of Tibetan, Shona, Somali,
  Kirundi, Igbo, Yoruba, Tongan, Oromo and Malagasy unsure: BN-32.
- **BN-41 — the nine languages no reader could confirm** (2026-11-09).
  BN-40's reader was unsure of Tibetan, Shona, Somali, Kirundi, Igbo,
  Yoruba, Tongan, Oromo and Malagasy. A second reader was handed only the
  phrases and no reason: every one it gave back as something else --
  glorify, herd, shorten, capitals, "the big text" -- left the window's
  shortcuts (Shona _kudza mavara_, Somali _weyn qoraalka_, Kirundi _kuza
  inyuguti_, Igbo _mee ka ederede buo ibu_, Yoruba _je ki oro tobi_,
  Tongan _fakalahi'i 'a e tohi_, Oromo _barreeffama guddisi_, Malagasy
  _ahenao ny soratra_ ...), and so did a bold read as thick-or-big. What is
  left names the SIZE in so many words (Shona _wedzera saizi yemavara_,
  Somali _weynee cabbirka qoraalka_, Kirundi _ongera ubunini bw'inyuguti_)
  or is gone: Oromo keeps no shortcut, Tongan's bold is the loanword.
  `typedEditAsks.test.ts` holds every trimmed phrase to never being a
  size or a bold; a sample left out means the assistant does it.
- **BN-42 — a typed ask named its language** (2026-11-09). Asked on the
  free tier to add a line at the end in 75 more languages, 24 asks were
  named no language or a neighbour -- Malagasy and Chichewa were answered
  in English -- because their lists lacked what such an ask is made of:
  add, at the end, make. 22 languages got those words (Swahili _ongeza_,
  Finnish _lisää loppuun tee_, Turkish _ekle sona yap_ ...), and a word two
  neighbours share went into both: Finnish's _tee_ named Estonian's lines
  Finnish until Estonian had it, Bulgarian's _направи_ named Macedonian's
  Bulgarian (`typedEditAsks.test.ts`, _a typed request to add a line is
  named its language_, 87 asks in `addLineAsks.json`). Live with the new
  packs: Burmese, Nepali and Chichewa -- wrong before -- one exact change
  each, answered in their language.
- **BN-43 — the manual in Khmer and French, all of it and only what is so**
  (2026-11-09). Nine pages of each had gone stale and W-56..W-59 had none:
  all 71 of each are current now (`manual-i18n-status.mjs`). Read through
  the window's own readers, three pages said too much: French W-60 offered
  _réduis le texte_ and _texte plus grand_, which BN-40 had taken out of the
  shortcuts (now _rends les mots plus grands_ / _plus petits_); Khmer
  W-60's _ដាក់អ្វីៗទាំងអស់នៅកណ្ដាល_ and _ប្រើ Georgia
  សម្រាប់កំណត់ត្រាទាំងមូល_ matched no pattern -- Khmer's whole-note styles
  take _អ្វីៗ_ (everything) and a font named with no word for font now, as
  English reads _use Georgia for the whole note_, done by the window live;
  and _show me more options_ in either language promised the card back,
  which only the English line does (`checkIsDocumentOptionsAsk`): W-57,
  W-59 and W-60 say so, and asked in French the assistant answered with
  three options of its own (live).
- **BN-44 — a line the note has already, asked for again** (2026-11-09,
  found by the 87-language run). A Malagasy line left in the note by a
  refused undo (BN-46) made the next _add a line at the end: Fitiavana
  Andriamanitra_ a twin of block 4, and `applyNoteEdit` refuses an add
  that repeats an untouched block (meant as a change to it). The model sent
  the same add twice, was refused twice, and told the person, in Malagasy,
  that the line was added. An add takes `again: true` now -- the words
  again, on purpose -- and the refusal that names the twin says so; +6
  tokens a note round (1 117), the ordinary ratchet unmoved. Live on the
  relaunched scratch profile: refused once, sent again with `again`,
  added, answered in Malagasy with **Undo this change** under it.
- **BN-45 — a language installed while the help window is open**
  (2026-11-09). The window reads every installed language's small files
  ONCE, at load (`chatLangHelpers.ts`'s lists, and five modules' classes
  built on the marks), and only Settings > Languages reloaded it -- not its
  own offer to install one. Seen live: Khmer installed with the window
  open, _ដាក់អ្វីៗទាំងអស់នៅកណ្ដាល_ went to Free's Nemotron, which repeated
  the previous request and added the Malagasy line again. The window
  listens now (`onLangPluginsChanged`) and loads again when its turned-on
  languages or their versions change, once nothing is on its way, the tabs
  saved first (`chatLangReloadHelpers.ts`). Live: Thai installed from
  outside with the window open and idle -- it reloaded by itself (a marker
  gone, a new `timeOrigin`), its 13 messages kept, and _ขยายตัวอักษร_ was
  then done by the window with no model.
- **BN-46 — the person's own Undo was rationed like a model's removals**
  (2026-11-09). **Undo this change** is an `owa_undo` through the door the
  model's tools use, and the firewall rations removals at 10 per 5 minutes:
  pressed every 15-20 s by the 87-language run, 27 of 75 undos were refused
  (the change left in place, _I could not do that just now_, and the run --
  counting any reply as done -- reported them undone). After a model had
  removed ten things, the person could not put them back for five minutes.
  The firewall now remembers, per session, the `undoId` of every change the
  session made with a tool that takes nothing away (`genOwnChangeMemory`,
  half an hour, 200 at most): an `owa_undo` naming one of them is an acting
  call and no removal -- putting back the session's own change takes nothing
  of the user's away. An undo of a removal, one naming no id and a redo stay
  counted. Live, the 87-language bold run pressed Undo 176 times, faster
  than before: all 176 put the note back, read back off the note.
- **BN-47 — options under a marker word of the person's language** (2026-11-09).
  A Polish answer ended _Opcje: cofnij tę zmianę | pogrub drugi wiersz_ and
  was drawn as words with no buttons: the marker had been put into Polish,
  and only English's and the help window's own languages' markers are known.
  The answer's LAST line is now read by the options' shape too -- one to
  three words and a colon, then two to five short items between `|` -- never
  a `SHOWS:` / `NEEDS:` / `DO:` / `REPORT:` line and never a list one a
  line (a heading word over a list is how an answer writes steps).
- **BN-48 — an answer left in English** (2026-11-09). Two ways, both seen in
  the run: a translation that came back as the English with a word changed
  was taken for a Latin-script language (Catalan, shown in English with no
  note) -- it is a failed translation now (`checkIsEnglishEcho`: most of its
  words are the English it was given), so the answer says it could not be
  put into the language; and a Gemma 4, asked in the person's language
  (never translated for), answered a Xhosa ask in English -- such an answer
  is put into the language after the fact by the translator
  (`planForEnglishAnswer`, `checkIsEnglishAnswer`). Re-asked live: Catalan,
  Polish, Serbian and Xhosa all answered in their language, the first line
  bold and every undo kept (the late translation was not needed that time:
  held by tests).
- **BN-50 — "Psalms 23:1" was no verse to a note** (2026-11-09, found
  making the elder run's test note). `owa_bible_note add` with
  `[^Psalms 23:1]` kept it as words, and `owa_note_edit` refused it as "no
  installed Bible could read" it, while `owa_find_verse` read it: the note's
  resolver was the Lookup's parser alone, which wants the Bible's own book
  name (the KJV says "Psalm"). `resolveBibleItem` (`agentBibleHelpers.ts`,
  shared with `owa_present_bible` and the Bibles list) now falls back to
  the verse finder's reading (`parseLooseReference`: `resolveBookKey`,
  Psalm/Psalms, a start only one book has, the English names under any
  Bible, a bare chapter widened to its verses), loaded only when the parser
  said no. Live: `[^Psalms 23:1]`, `[^1 Cor 13:4]` and `[^Psalms 23]` read
  from the KJV in one edit, undone.
- **BN-51 — the chatbot draws, and says only what it drew** (2026-11-09,
  the user, with the Insert menu's **Excalidraw** circled: _make sure
  chatbot can help drawing_). Asked for a drawing of the three points, the
  window made one in one call (3 s); its own option **Make the drawing
  larger** then sent `size` on the drawing's block -- a paragraph holding
  the board's node, so the size reached no words and nothing changed --
  and the answer said "I've made the drawing larger". It also offered
  **Add a picture of a sheep**, which no tool can. Now a drawing takes what
  changes IT (`agentNoteDrawingHelpers.ts`, `applyDrawingChange` in
  `agentNoteBlockHelpers.ts`): `size` larger / smaller scales how large the
  board draws it (the node's width and height), `background` fills its
  boxes and `color` its lines (white words on a dark fill), new lines in
  `text` draw it again keeping its colours, layout and scale, a first line
  `layout: across` / `circle` / `center` lays it out left to right, round a
  ring or round its first box (BN-15), and a drawing reads back as the
  lines that draw it so a model can change one box. A drawing with
  anything drawn by hand is coloured or sized, never drawn again (its pen
  strokes would go), and font, styles, a px size or `words` on a drawing are
  refused with what it takes. The summary says it the drawing's way
  (`boxes green, drawing made larger`). The prompt says the board draws
  boxes, words and arrows, never a picture of a thing -- say so and offer
  one of words -- and options are only changes the tool can make.
- **BN-53 — a change claimed that nothing made** (2026-11-09, the elder
  run's drawing set). Four ways, one cause: the answer says what the person
  hoped, not what the tool did. (1) _Draw a big star next to the important
  bits_: Free's Nemotron called no tool and answered that it had added a
  gold star, centred and larger -- an answer in a note ask that claims a
  change while no edit changed the note, no note was made and no undo
  stepped now goes back once (`checkClaimsUnmadeNoteChange`,
  `NOTE_CLAIM_NUDGE`, beside the answer-shape nudges). (2) _Draw it going
  across not down_: the drawing already was across (the model had laid
  every drawing across), the edit changed nothing and answered "Nothing
  was different", and the model said "I've updated the drawing" -- the
  no-change answer now says _Tell them so -- never that you changed it_,
  and the prompt draws top to bottom unless a timeline, a cycle or a
  shape is asked for. (3) Options under a note answer repeated **Undo this
  change** beside its own button: a note answer's options skipped the
  de-duplication (`dropActionEchoReplies`). (4) _Put the 23rd psalm in
  boxes_ removed the "Read Psalm 23:1 together" line nobody asked about,
  and the boxes read `[Psalm 23:1]`: the prompt says never to remove a
  block they did not ask to remove, and a verse token in a drawing's box
  is its reference in words.
- **BN-54 — a long conversation lost its note** (2026-11-09, the elder run).
  A tab keeps its last 60 messages when it is saved and loaded; the
  question that attached the note is how the tab knows it is about the
  note, and after thirty-odd questions it was the one cut. Any reload
  (here a source edit through the shared Vite; for a person, closing the
  help window or the app) brought the tab back asking about the Bible
  Reader: _can you see what i wrote in my lesson_ was answered "I cannot
  see the text you have written". `trimSessionMessages`
  (`chatSessionHelpers.ts`, on save and on load) keeps that question in
  place of the oldest message while its files are still open -- the same
  test as `findOpenFileAttachments`, a `fileClosedAt` after it letting it
  go -- so a song's, a slide document's or a Resources file's long
  conversation keeps its file too.
- **BN-55 — a new lesson written over theirs** (2026-11-09, the elder run).
  In the conversation about their Good Shepherd lesson, _Can you make me a
  whole lesson about forgiveness_, _Write a Easter lesson for the adults_,
  _write me a lesson about prayer for the youth group_ had the lesson's
  fifteen blocks given the new lesson's words; _a short devotion about
  Psalm 121_ and _I would like a lesson for Mothers Day_ were put at its
  end -- 14 asks of the first 90 of category 2 -- and a greeting had a
  misspelt line corrected unasked. The prompt now says to change the note
  only when the words ask for something in it (a mistake noticed is an
  option), that words written FOR this lesson go into it, and that a
  lesson on another subject or for another group is a NEW note; asked
  after that, six still went into the note, so a typed ask for a lesson
  of its own also carries `NOTE_NEW_LESSON_HINT` (`checkIsNewLessonAsk`, a
  writing word before "a" / "new" lesson, devotion or outline: 23 of the
  corpus's 29 new-lesson asks, none of its other 571 lines). And the
  greetings that changed the note: a line that greets or asks, with no word
  asking for anything done to the note, carries `NOTE_QUESTION_HINT` --
  answer and change nothing, offer a change as an option
  (`checkIsNoteQuestionOnly`: on 64 of the corpus's 189 answers, none of its
  248 changes).
- **BN-56 — a tick on an item that has none** (2026-11-09, the elder run).
  _Tick the first question I already asked it last week_ on the lesson's
  numbered questions sent `{block: 12, checked: true}` twice; only a check
  item has a tick, so nothing changed, the tool said so, and the answer told
  the person it was already ticked. A `checked` on a numbered or bulleted
  item or a line now makes it a check item, ticked (`made check, ticked`).
- **BN-57 — a worry answered with another change** (2026-11-09, the elder
  run, category 6). Right after a change, _the letters went all big
  suddenly i dont know what i did_ and _everything is blue now how do i
  make it normal again_ were answered with Clear Formatting on all fifteen
  blocks -- the headings made plain lines; _help the whole page is in the
  middle now_ with every block aligned left; _I had a line about bringing
  pictures and now it's not there_ and _Why my title is disappear?_ with an
  explanation and an offer; and _it change by itself, I not touch
  anything_, with nothing changed, with lines "put back" that had never
  been there. 7 of the first 37. The prompt now says: when they say a
  change was wrong, something is gone, looks strange or changed by itself,
  put it back with `undo`, one step a change, never a new change that only
  looks like it, and say it is back; with no change made in the
  conversation, change nothing and ask what looks different.
- **BN-58 — a messy note formatted** (2026-11-09, the user: _formatting
  document is the most needed, imagine user made a messy content then ask
  chatbot to do reformating … when bible-note attached to the chatbot it
  should provide the option to format content_). Three messy lessons on a
  scratch profile -- labels as lines, references in words, three
  questions on one line, all capitals, one run-on paragraph. Before:
  **Tidy it into headings and lists** took five calls on gemma4:cloud and
  left the questions line whole as one bullet with two of its questions
  added again beside it; the run-on paragraph took seven, every one
  refused, and no answer. Two things the tool could not take that a model
  writes: one block made several (a block cannot take fewer of its own
  words with another kind), and a rewrite -- the old block removed, the new
  ones added `after: 0, 1, 2 …` as they will stand (a new block cannot go
  after a removed one, nor after a number past the end). Now
  (`agentNoteMarkupHelpers.ts`, `applyNoteEdit`): a block given a list
  kind or `section` and its words as lines becomes a block a line
  (`expandBlockSplits`); new blocks after a removed block take its place
  (removes run last); a run numbered as it will stand follows the new
  block before it (`chainRewriteAdds`, `chain` an app mark a model cannot
  set); a block made a heading with its parts after it is judged keeping
  its words across them; and a new block whose words are part of a block
  the call keeps is refused with the split shown. The prompt's FORMATTING
  recipe (title h1, parts h2 in normal case, items split, a reference in
  words a verse token, capitals to normal case, a reminder bold, every
  word kept) and `NOTE_FORMAT_HINT` on a format ask; the card's fifth
  button is **Format it so it is neat and easy to read** (every language,
  87 dictionaries, versions raised, packed). After, each of the three in
  ONE call, 3-5 s, on gemma4:cloud: the lessons headed and listed, the
  questions split, Luke 15:4-7 and Matthew 6:6 verse chips, only
  connecting words ("first", "then") and a reference's "verse" dropped.
- **BN-60 — a lesson worth preaching** (2026-11-10, the user's goal:
  _chatbot completely smart enough to help prepare a best preaching
  lesson_). A model was told a lesson is "given whole in its own words"
  and nothing of what one holds. `PREACHING_LESSON_SHAPE`
  (`noteCreatePromptHelpers.ts`) says it in the order it is preached --
  the passage read first, a big idea, background, an introduction, three
  points each with its verses, what it means, an example from life and
  how to live it this week, Pointing to Jesus, a response, a written
  prayer, questions for discussion, a memory verse -- and rides ONLY on a
  lesson ask, never in a prompt (~190 tokens, paid on that ask alone):
  `NOTE_NEW_LESSON_HINT`, `NOTE_BLANK_LESSON_HINT` (an empty note is
  where the lesson goes), `NOTE_LESSON_FINISH_HINT` (_finish my sermon_:
  the parts it lacks, their words kept), `NOTE_LESSON_REVIEW_HINT` (_is
  this a good sermon?_: judged against the shape, nothing changed),
  `NOTE_LESSON_SHORTEN_HINT` (_make it fit 15 minutes_: words tightened,
  extras out first, every point keeping its verse, an example and how to
  live it -- the first cut took out every example and application), and
  `LESSON_MAKE_HINT` where no note is attached (`askLlmBot`, an ask whose
  tools hold `owa_bible_note`). A verse token alone on its line -- in a
  new note, a `section`, or a paragraph add naming a range or a chapter --
  is the passage printed whole (`readPassageLineRef`, `checkIsPassageRef`;
  one verse alone in a paragraph stays its chip). Seen live on a scratch
  profile, Auto -> gemma4:cloud: _help me prepare a sermon on John
  10:11-18 for Sunday_ in an empty note, ONE call, 15 s, 31 blocks (the
  passage first, Big idea … Memory verse); Psalm 23 in 9 s; _I'm preaching
  on Luke 15:11-32 this Sunday, help me prepare_ one call, 15 s; _make a
  sermon on Romans 8:28-39_ beside a lesson, a new note, 14 s, opened and
  attached. Follow-ups, one call or an answer each, 3-6 s: an
  illustration under point 2, two cross references under point 1, two
  more questions, a stronger conclusion with an invitation, an object
  lesson for the children after the introduction, the point headings bold
  dark blue, a fitting hymn, what "lay down his life" means, how long it
  takes to preach (15-25 min, by part), an honest review (it caught that
  verse 16's "other sheep" was never preached), a children's version (a
  new note), and the 15-minute fit (one edit, the shape kept, 852 words
  with the passage). _help me prepare a sermon_ with nothing named asks
  which passage, three as buttons (3 s); the passage pressed under it was
  first written as a fifteen-line outline -- its words are no lesson ask
  -- so in an empty note the question after a lesson ask carries the
  lesson hint too (`genNoteLessonHint`'s `isLessonContinued`, from the
  tab's `priorMessages`): pressed again, 26 blocks, the whole shape.
  _finish my sermon_ on the elder lesson (a title, three one-line points,
  two questions, a hymn): one call, 6 s, every line of theirs kept and the
  rest of the shape added round them -- its three one-line points left
  below their expanded sections, since nothing of theirs is removed.
  Elder corpus, the 25 asks these rules touch: 25 of 25 supported.
- **BN-61 — the shared server drops a long call nested in `changes`**
  (2026-11-10). The first sermon asks went gemma4:cloud -> Gemma 4 31b ->
  Free's Nemotron, 70-134 s, and once a "Test paragraph" in the note. A
  dev-only tap of every round showed `finish: stop`, ~820-890 tokens
  generated and no text, no call: the server's own parser dropped the
  call. The captured request replayed straight to the registry server
  (`/v1/chat/completions`, the registry's key never printed; Ollama's
  native `/api/chat` too) dropped the lesson nested in `owa_note_edit`'s
  `changes[].text` 7 times of 8, and returned it as one flat
  `owa_bible_note add` `text` 5 of 5 (3 256-3 605 characters). So an add
  in a conversation about ONE note that holds nothing is written INTO that
  note by the window (`toBlankNoteFillArgs` in `runMcpToolCall`: its empty
  blocks out, the title set, one `section`), and the empty-note hint asks
  for that add. The empty note's own blank line gives way to whatever is
  put in it (`withBlankNoteFilled`, the edit path). The custom servers'
  lean list had no `owa_bible_note` at all -- a new lesson on Auto reached
  it only when the model guessed the name -- and wrote with 2 000 tokens,
  short of a sermon: a note ask or a lesson ask keeps `owa_bible_note` and
  writes with `LONG_WRITE_MAX_TOKENS` 6 000 (`AskExtraType.isLongWrite`).
  And a reply that comes back empty in a conversation about an empty note
  is asked again with `NOTE_BLANK_DROPPED_NUDGE` -- the flat add -- where
  it had been asked again unchanged.
- **BN-62 — what a model writes anyway** (2026-11-10). `changes` sent as
  the JSON TEXT of the list (gemma4:cloud's first sermon; refused, sent
  the same again) is read as the list (`toListArgsRead`, `changes` and
  `items` only). `changes` with no `action` is an edit -- and the WATCH
  counts the filled action (`watchedArgs`): counted by the model's own
  args, a done edit read as no change, the claim nudge sent the answer
  back, the model sent the edit again, the note had changed since its
  read, and the answer apologised for a change it had made. The same
  DOCUMENT edit twice in one reply runs once (`DOCUMENT_EDIT_TOOL_NAME_SET`;
  a press twice still runs twice -- Zoom In twice is meant). List items
  added in a row, `after: N`,
  `N+1` …, onto a block that is not an item of that list are one list
  (`chainListAdds`): two cross references stood apart round point 1's
  example, and two more questions would have put the second under the
  next heading.
- **BN-63 — a verse check that reads the verses** (2026-11-10). _Check
  that my verses are right_ was answered "I have checked your verses
  against the KJV text. All correct" with no verse read, over a point
  that gave Isaiah 53:6 the words of 53:5. The window reads every verse
  the note cites (one `owa_find_verse refs` a Bible, ~100 ms, no model
  round; `checkIsNoteVerseCheckAsk`, `collectNoteVerseRefs`) and the ask
  sets each beside the note's own line about it (`toNoteVerseReadText`):
  told only "the Bible reads", the model still called the line right;
  side by side, it named it -- _that text is actually from Isaiah 53:5.
  Verse 6 says, "All we like sheep have gone astray"_ -- and offered both
  fixes; _Fix the reference to Isaiah 53:5_ was one edit. The prompt says
  never to say a verse was checked that was not read, and to name a part
  of the note by its heading or words, never a block number (_as noted in
  your study (blocks 19 and 21)_).

## Open

- ~~**BN-15 — a drawing in another layout.**~~ Done 2026-11-09 with BN-51:
  a first line `layout: across`, `circle` or `center` in the drawing's
  text, kept in its scene so it holds when drawn again.
- **BN-32 — a native speaker's read of the shortcut words and little
  words.** BN-31's phrases and BN-33's additions were written without native
  speakers, like the dictionaries. The harm to look for -- a word that is
  ALSO a colour or a size, or a phrase that also asks for something else --
  has been looked for twice (BN-34, BN-40's independent read of all 87),
  and the nine languages that read was unsure of were trimmed to what a
  blind read gave back as their job (BN-41); what is left is a native
  ear: each language's own word for bold where the loanword stands in, and
  phrasings people use that never match (those only cost a model call).
- **BN-49 — words a model reads another way, and languages the shared
  model cannot follow** (2026-11-09, the 87-language bold run). Asked to
  make the first line bold, the models read Somali _qaro weyn_ and Sinhala
  _තද_ as a size, Galician _en negra_ as black and Lithuanian _paryškink_ as
  a highlight -- each a word that does mean that too -- and the shared
  gemma4:cloud did not follow Oromo (it said it did not understand the
  language) or Fijian (it bolded a word in two lines). The window cannot
  know which meaning was meant; a native ear on these languages' samples
  (BN-32) and a model that knows them are what is left.
- **BN-59 — what the elder corpus still fails** (2026-11-09, 6 of 599 after
  the re-ask). The projector from a note conversation: _I want the verse to
  come up on the projector when we read it together_ and _show the
  questions one by one on the screen_ put a passage and collapsible blocks
  into the note -- a note conversation has no tool that presents, and the
  answer should say how (the Bible Reader's or the Presenter's own way);
  _can you print the children version separate_ made a new note (printing
  is the note window's Print); _write a short paragraf to explain the Lords
  Prayer … to teach it to the new believers_ went into this note where a
  new note was expected (no lesson word for `checkIsNewLessonAsk` to read);
  and two bare follow-ups -- _yes please_ under an offer to write a closing
  prayer, _yes_ under another -- did not do what the answer above offered.
  Not yet: a note ask that names the projector or the screen carrying a
  hint, and a bare yes under an offer asked as that offer.
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
- ~~**BN-64 — an empty note's card offers nothing to start a lesson.**~~
  Done 2026-11-10: an EMPTY note's card says it is still empty and offers
  **Help me prepare a preaching lesson**, **… a children's lesson** and
  **… a short devotion** (`genNoteOpeningAnswer`'s `isEmpty`, three keys in
  all 87 dictionaries, each version raised, packed;
  `lessonCardAsks.test.ts` holds every language's buttons to
  `checkIsLessonCardAsk`), a press read as a lesson asked for in any
  language (`isLessonContinued`). The first live run showed the ordinary
  card on an empty note: the file's reader writes an empty body as
  `(empty)` (`EMPTY_NOTE_BODY`) and the check had looked for the title line
  alone -- a unit test built on that assumption had passed; the test is
  now built through `toNoteItemFromFileText` and `genTextAttachment`, as the
  window builds it. Seen live after: the card, the press, three passages
  as buttons, the first pressed, the whole lesson in the note (C-01..C-03,
  10/10 each by `lesson-rubric.mjs`); in Spanish the card in Spanish, the
  passage typed (_Salmo 23_), a whole Spanish lesson in the note in 13 s.
- ~~**BN-65 — the lesson readers are English**~~ Done 2026-11-10 for every
  language, without lesson words for each: `LESSON_OUTLINE` (~70 tokens)
  rides `NOTE_SYSTEM_PROMPT` and `NOTE_CREATE_PROMPT` in every language,
  with the rule that an EMPTY note's lesson goes into it by one
  `owa_bible_note add`; the card's buttons are read in every language. Seen
  live with Spanish installed (no `assistant.json`, no `lessonAsks`):
  _Ayúdame a preparar un sermón sobre el Salmo 23 para el domingo_ in an
  empty note, the whole lesson in Spanish, 10/10, 548 words, one change.
  The note on French and Khmer below is the part done first:
  `checkIsLessonWriteAsk` and
  its siblings read the English of an ask; a question asked of a Gemma 4
  model in the person's own language goes to it untranslated, so on Auto
  in a non-English app (which prefers a Gemma 4) a lesson asked for in
  that language carries no `PREACHING_LESSON_SHAPE`, no blank-note fill
  hint and no verse check. Each language's words for a sermon, a lesson
  and checking verses would be language data (`assistant.json`), as
  `studyFileAsks` is. **Done for French and Khmer** (`lessonAsks`,
  `verseCheckAsks`, read by `checkIsLanguageLessonAsk` and
  `checkIsNoteVerseCheckAsk`; acted on only in an empty note or a chat
  with no note, never as a new lesson beside one; package tests in each
  `tests/chatbot/noteLessonAsks.test.ts`; km 0.0.62, fr 0.0.54, packed).
  Seen live with the Khmer pack installed: _ជួយខ្ញុំរៀបចំសេចក្ដីអធិប្បាយលើ
  យ៉ូហាន ១០:១១-១៨_ in an empty note, the whole lesson written in Khmer in
  one call, the note titled in Khmer -- one Thai word slipped into a Khmer
  line (a model's, not caught: a note's words are never cleaned).
- **BN-66 — "best" is a written standard and a blind reader's, not ours**
  (2026-11-10, the goal's own word). `references/lesson-rubric.md` is the
  standard: twelve criteria from Robinson's _Biblical Preaching_, Chapell's
  _Christ-Centered Preaching_ and Stott's _Between Two Worlds_, 0-2 each,
  Best / Good / Needs work, a factual error about the Bible capping a lesson
  at Needs work. `scripts/run-lesson-asks.mjs` makes every row of
  `references/lesson-asks.json` (14 asks across the genres, 4 partial
  sermons to finish, the empty note's 3 buttons) through the real window on
  a scratch profile and `scripts/lesson-rubric.mjs` checks the structure by
  machine and writes each lesson as text for two readers on different
  models told only the standard. Machine check, 2026-11-10: 19 of 22 every
  check (the Easter sermon's points one paragraph each; a near-whole sermon
  finished at 440 words of the 450 a sermon is held to; loose lines written
  twice before BN-67's last rule). **The two readers of the 22**: Opus 8
  Best, 10 Good, 4 Needs work; Sonnet 7 Best, 14 Good, 1 Needs work (mean
  18.9 of 24); both found the same two errors (Psalm 51's "pure heart" cited
  at verse 7, the KJV's "clean heart" being verse 10; the sower's parables
  said to help the crowd understand, Matthew 13:11-13 saying the reverse),
  and the same weakest criteria -- illustration (1.09 of 2), background
  (1.18), explanation (1.18) -- plus one template for every ask (20 of 21
  introductions "Have you ever…?", 460-720 words whatever was asked: a
  15-minute sermon ran five minutes, a funeral had discussion questions, a
  children's lesson printed a whole KJV chapter). **Three shapes compared
  blind** (eight of the weakest asks made again, shuffled with the first
  eight under neutral ids, two fresh readers each): asked for "the one fact
  of that time" and "a concrete story (who, where, what happened)", the
  lessons grew richer and LESS true -- background 1.13 -> 1.88, illustration
  1.00 -> 1.63, accuracy 1.88 -> 1.38 (Sonnet) and 1.38 -> 0.75 (Opus), the
  model inventing history and anecdotes told as true ("In 1944…", "I
  remember a friend…"); told "TRUE above all" in words, still 2 errors
  against 11, from Hebrew word studies and quotes made from memory -- the
  model writes before the app prints the passage. The shape now READS the
  passage first (`owa_find_verse`) and builds every point, quote and verse
  number on its words, explains a word plainly (an old word of the printed
  Bible in today's words, no word study), tells a story as an example,
  covers the whole passage, keeps a length asked (about 120 spoken words a
  minute), leaves discussion questions out of a funeral and gives a
  children's lesson its key verses retold; and a question for the person is
  never written into their empty note (`findBlankFillProblem`: seen once,
  the children's button pressed, the model's own "which passage?" with its
  OPTIONS went in). **The last blind read**, the first eight against the
  read-first eight (shuffled, a fresh reader): mean 16.9 -> 19.0 of 24,
  0 Best / 6 Good / 2 Needs work -> 2 / 5 / 1, and accuracy UP, 1.75 ->
  1.88 -- background 1.00 -> 1.50, illustration 0.88 -> 1.25, the human
  need 1.00 -> 1.38, Christ grown from the text 1.25 -> 1.63, fit 1.25 ->
  1.50; the one fall a devotion's single point on Psalm 46 that left
  "be still" out (19 -> 15). The second reader (Opus) the same way:
  factual errors 2 -> 0, accuracy 1.38 -> 1.75, Needs work 2 -> 0, mean
  18.6 -> 19.1. Each lesson one call after the read, 7-11 s.
  Still weakest: explanation (1.13) and the points covering the whole
  passage (1.38) -- a model that reads the passage still preaches its
  first half; and a 15-minute sermon on one verse runs short.
- **BN-72 — the review is the way from good to best** (2026-11-10). A
  draft is a draft; the chatbot helps PREPARE, so _is this a good
  sermon?_ is now judged as the blind readers judged
  (`NOTE_LESSON_REVIEW_HINT`: read the passage first; truth, one big idea,
  points over the WHOLE passage, verses explained, an example each,
  something to do, Christ grown from the text, a response that gathers --
  in that order of weight), the two or three fixes that matter most each a
  button that SAYS the change (Add / Write / Move / Make: "Explain the
  hardened heart" had been read as a question and answered in the chat).
  Live on the sower sermon both readers had marked down: the review named,
  by heading, the good soil with no point of its own and a point printing
  verses 5-21; **Narrow the passage in Point 2** pressed -- refused once
  ("A passage is ONE reference", the model having written "Matthew
  13:5-6, 20-21", which the resolver had read as the very span already
  there and answered "nothing was changed"), then two exact passages in its
  place, 14 s; **Add a point on the Good Soil** pressed -- "4. The
  fruitfulness of a receptive heart" with Matthew 13:8 printed, its
  meaning, an example and something to do this week, before Pointing to
  Jesus, one edit, 6 s. A passage block given another `ref` is that
  passage in its place (`expandPassageRepoints`), and a passage `ref`
  holding two ranges is refused with how to write it.
- **BN-73 — a length they give is a number of words** (2026-11-10, the
  readers of BN-66: _a 15-minute sermon ran five minutes_). Told "about 120
  spoken words a minute", gemma4:cloud still wrote its one template,
  460-720 words, whatever was asked. A lesson asked for in minutes now
  carries one line with the number itself (`genLessonLengthLine`: 3-60
  minutes, `minutes × 120` rounded to the hundred, the passages printed not
  counted, "fill it with explanation and examples, never with more
  points"), on a lesson written, made new or finished -- never a review,
  and never a cut, which has its own hint. Seen live: _a 15 minute sermon
  on John 3:16_ came to 1 220 words (about ten minutes) where it had been
  460-720 -- still short of the 1 800 asked.
- **BN-74 — the review's fixes can always be pressed, in the lesson's own
  form** (2026-11-10). The way BN-72 opened -- a draft, _is this a good
  sermon?_, its first fix pressed, twice -- run on BN-66's eight weakest
  asks stopped short five ways. (1) A review ended with its fixes as a
  bare `|` line, the marker dropped (Psalm 51), drawn as words:
  `cutBareOptionsLine` reads a line whose every item opens on Add, Write,
  Move or Make under a statement too, as it read any line under a
  question. (2) A review named two fixes and offered none (the second on
  Zacchaeus): a review ask (`ToolWatchType.isLessonReview`, its hint in
  the ask) whose answer has no options goes back once
  (`NOTE_REVIEW_OPTIONS_NUDGE`). (3) The empty note card's children's
  lesson: the model offered its three passages one a line under "here are
  a few options that work well for children:", no marker -- nothing to
  press, and the note stayed empty; passages one a line closing an answer
  that asks are its options now (`cutPassageListFrame`), and a passage
  option may run to 64 letters ("The Parable of the Lost Sheep (Luke
  15:1-7)", 43, had been dropped by the 40 every button keeps to). (4) Both
  devotions were reviewed into three points (_Add a point on God's
  victory_, _Make 3 points following the Psalm_), the form asked for
  undone; the review hint now says a devotion keeps its ONE point and a
  children's lesson its story, a fix adding to them. (5) The children's
  lesson on Jonah printed the whole book (Jonah 1:1-4:11) and had no
  introduction, points, Christ, response or prayer -- 5 of 10 by machine,
  draft and reviewed alike: a children's lesson keeps every part now, only
  the verse or two its story turns on printed, the story told to where the
  passage ends, two points a child can hold.
- ~~**BN-75 — a note's new name went back with the next change.**~~ Fixed
  2026-11-10. A title is the list's: the assistant's rename (as the row's
  Edit Title) saves the file at once and rebases the editing head. But the
  note WINDOW writes its typing into that head with its own copy of the
  item (`addItemEditingHistory`), and a window opened before the rename
  held the old title -- so the next change, the assistant's or the
  person's, put the old name back in the head, every read named the note
  by it (the lesson review never saw "Devotion on Psalm 46", only
  "Lesson L11 r3", and reviewed it as a sermon into three points), and the
  window's Save would have put it back in the file. The same happened to
  the list's own Edit Title with the note's window open. The window's
  write now keeps the title the head holds, as the rebase already kept
  each side's own (`takeItemContentsFrom`: the list owns titles, the
  window the text). Seen live after: the devotion named once and read by
  that name through two reviews and their changes; its fixes kept to its
  one point (_Add verse 10 to the main point_).
- **BN-76 — a quote of the passage is its words** (2026-11-10, the blind
  readers of BN-74). The commonest factual error left in the lessons was a
  phrase in quotation marks the passage, read a moment before, does not
  say -- "sinners shall return unto thee" for Psalm 51:13's "be converted",
  in the draft and the reviewed lesson alike -- and a quote is read out as
  the Bible's own; under the standard, any such error keeps a lesson out of
  Best. In a note ask the window now keeps what was read (the ask, every
  `owa_find_verse` result, every read of the note), and a change whose
  quote takes most of its words from that and is not word for word is
  refused once an ask, naming the quote (`findNoteMisquotes`,
  `genNoteMisquoteRefusal`; a hearer's question in quotation marks shares
  little with the passage and goes through). A fill of the empty note that
  is refused is said as it came back, no longer wrapped in "the lesson was
  written INTO it -- say so". Seen live after, on Psalm 51: its quotes of
  verses 3 and 4 word for word, its three hearer's questions untouched; the
  refusal itself held by a loop test (the model wrote no misquote that
  run). Not caught: a detail added without quotation marks ("left the
  others in a safe place", Luke 15:4 saying "in the wilderness").
- **BN-77 — a review's other fixes stay pressable** (2026-11-10, the blind
  readers of BN-74: a children's lesson's first fix added Pointing to
  Jesus, 0 -> 2, and its missing Response stayed missing -- one fix a
  round, the review's other buttons gone with the first press). A change
  pressed among several leaves the others as the first buttons under its
  answer (`handleReplying`'s `carryReplies`, `checkIsChangeReply`); a
  change opens on any of the common edit verbs, not only the four the
  review is asked for (seen: "Grow Jesus from the river in v. 4", "Rewrite
  Response to gather Big idea"), never "Explain …", which is answered as a
  question. A review that names its fixes and offers none even once asked
  for them has the ones it named as its buttons
  (`readReviewFixHeadings`: "2. **Strengthen the "Pointing to Jesus"
  section:**" -- a Zacchaeus review ended twice with none). Seen live: on
  Jonah and on Psalm 23 the second fix pressed straight off the buttons
  the first fix's answer carried.
- **BN-78 — the review knows the form it judges** (2026-11-10). A short
  devotion asked for by the empty note card's button was reviewed as a
  sermon -- _is this a good sermon?_ names no form, the note neither --
  and its first fix was _Add points for verses 4-6_, the one point a
  devotion keeps undone. The window reads the form off the tab's own
  earlier ask (`readLessonFormAsked`: the card's button, or "devotion" /
  "children's" in a typed ask) and a review or a finish carries one line
  saying it (`genLessonFormLine`).
- **BN-79 — a fix to a lesson carries the lesson's rules** (2026-11-10,
  the blind read of the whole loop: drafts 19.25 -> after every fix 19.63
  of 24 on one reader, the Psalm 23 devotion up to Best, and errors 3 -> 5
  -- the fixes' own words added what the passage does not say, the lost
  sheep "scared and stuck" in prickly bushes, the crowd "a symbol of social
  walls", Jesus "the river" of Psalm 46 -- and a Psalm 51 sermon fell from
  Best to 17, its added point a second "3." after the last, out of the
  passage's order). A pressed fix -- _Add details to the story_ -- had
  gone out with none of `PREACHING_LESSON_SHAPE`'s truth rules. A change
  to a lesson that is no lesson ask of its own now carries
  `NOTE_LESSON_CHANGE_HINT` (`toNoteAsk`, a change verb on a lesson note):
  write it from the passage as read, no feeling, motive, place, detail or
  symbol it does not give, every quote word for word, a point added where
  its verses fall and the points after it numbered on. The shape's own
  truth sentence says the same of a retelling.
- **BN-80 — a fix adds and rewords; it does no surgery** (2026-11-10, the
  blind read of BN-79's round: drafts 19.50 -> after every fix 19.25, the
  sower sermon 19 -> 16 and a Zacchaeus sermon 20 -> 19). Traced on the
  sower: _Add a point on why Jesus uses parables_ came back as fifteen
  blocks MOVED and three reworded -- the path's verses ended under the new
  point 1 -- and _Fix point numbering and headings_ took the Pointing to
  Jesus heading out; a Zacchaeus fix wrote "h2: …" into two headings, the
  kind label the note is read with. A small model keeps no count of
  blocks it moves in a long note. Now a lesson fix (`isLessonChange`, the
  ask carrying `NOTE_LESSON_CHANGE_HINT`) that moves or takes out a block
  their words did not ask to move or take out is refused, naming the
  blocks and saying to put each new block where it goes with `after` and
  renumber by rewording (`findLessonChangeSurgery`; _Move …_, _Remove …_,
  _Shorten …_ and the like let it through); and a heading's words lose a
  leading `h1:`-`h6:` label and the quotes round it (`stripHeadingKindLabel`,
  in `readHeadingMarks` and the mark-up reader; round trip still 342 / 376,
  0 failures).
- **BN-81 — the draft is the lesson, so the shape aims at what readers
  mark down** (2026-11-10). Two blind readers agreed the review loop does
  not lift a lesson on the free model (Opus 19.25 -> 18.75, Sonnet 18.13 ->
  18.38), and both marked explanation and illustration 1 of 2 in 14 of 16
  lessons -- a verse said again, one-line stock pictures (a lifeboat, a
  rescue worker) -- and the Jonah children's lessons gave Jonah a reason and
  a message the book does not (4:2, 3:4). The shape now asks, in each
  point, for the word, image or custom a hearer would miss explained from
  the Bible's own pages (read with `owa_find_verse`), an example as a short
  scene from the hearers' own week, and a person's reason or message only
  as the passage states it, the whole story read first. Two failures of the
  draft itself, found running the set: a token naming two references,
  `[^Jonah 1:17, 2:10]`, had a whole children's lesson refused and the model
  gave up -- such a token is read as several now (`splitVerseTokenRefs`,
  `withVerseTokensSplit`, in the collector and in `applyNoteEdit`; one alone
  on a section's line is a line each, a passage each); and the children's
  card pressed, the model wrote its "which passage?" INTO the empty note
  with `owa_note_edit` -- the question guard had been on the add's redirect
  alone (`isBlankLesson`: while the note is empty, an edit that is a
  question is refused; an edit that changed the note clears the empty
  mark). And `owa_find_verse`'s `refs` carry the book over: asked for
  "Jonah 1:1-4, 1:17, 2:1, 3:1-5, 4:10-11", it had read the first and left
  the rest unread, and the model spent four rounds asking again one at a
  time, its last round gone before it could answer (`splitRefList`, a
  bare chapter and verse is the book before it's, a two-digit chapter
  split too; "John 3:16, 17" stays one).
- **BN-82 — a point is a template, not a sentence** (2026-11-11). BN-81's
  thirteen pairs, read blind, missed the same things in both runs. Each
  point was ONE paragraph: its verse said again, then an example and a
  "this week" run on after it. The KJV words a preacher reads aloud
  ("moderation", "no more sea", "son of Abraham") went unexplained, and no
  hearer's question was met (Opus: 11 lessons of 26). The background had
  nothing of what happens just before the passage (8). Jesus was pointed to
  with a picture the passage does not have (6). Both funeral sermons were
  skeletal. `PREACHING_LESSON_SHAPE` now writes each point as labelled
  lines: **What it means:** (the words a hearer would stumble on, made plain
  from where else Scripture uses them), **A hearer asks:**, **The passage
  answers:**, **For example:** (a scene showing what THIS point says God
  does or asks, not courage or effort) and **This week:** (a deed, never
  only "trust" or "remember"). The passage is read with the verses before
  it, for the background; Pointing to Jesus starts from a phrase of the
  passage and goes to his death and rising, never his example alone; the
  response invites to believe where the passage does; a funeral comforts
  from the passage's promises, with no discussion questions; and a passage
  is about twenty verses at most, a longer story preaching its part. The
  first run of the template showed two things, both fixed before it was
  measured. Told "the question, answered", the model wrote the question at
  every point of four lessons and no answer, so the answer has its own
  line. Asked for "the verses whose words say it", the points printed
  their parts end to end, and David's 58 verses were printed twice. On
  the fixed shape the whole set ran again (17 asks): 15 lessons were
  written. L-05 waited past 240 s on the shared server and was written
  when asked again; L-08 asked which passage, as the shape says when
  none is named. Every point of every lesson answered its hearer's
  question. The model read the verses before the passage for the
  background (Luke 18:31-43 for Zacchaeus, Matthew 18:15-20 and Luke
  23:34 for forgiveness). The points covered their passages whole and in
  order in 14 of 15; David's armour came after his speech (BN-83 now). The
  shape is ~968 tokens, on lesson asks only.
- **BN-83 — a new lesson's points reach its passage's end** (2026-11-11).
  Read by their verses, five lessons of thirteen in each of BN-81's runs
  stopped before their passage did. The sower stopped at the thorns
  (13:22), though the good ground of 13:23 was its memory verse. The Psalm
  46 and Psalm 23 devotions stopped at verse 3, while their big ideas
  rested on "be still" (46:10) and the valley (23:4). Psalm 51 stopped at
  17 of 19, and David at 17:47 of 58. The shape had asked for "the last
  ending where the passage ends" since BN-66. Now, while the note is still
  empty, a lesson written into it whose numbered points' verses stop
  before the passage at its top ends is refused once an ask, naming both.
  The first run of BN-82's template put David's points at 17:45-47, then
  17:38-40, then 17:48-50, the armour after the speech. So a point whose
  verses ALL come before the point above it is refused in the same
  sentence (`findLessonPointsProblem`, `genLessonPointsRefusal`,
  `ToolWatchType.isLessonPointsChecked`). Comparing each point's first
  verse would have refused a sower sermon pairing the parable's good
  ground (13:8) with its meaning (13:23) after a point on 13:20-22. Only a
  passage the app reads as one book, one chapter and three verses or more
  is held, and only the points' verses inside it count. A children's
  lesson's verse or two, a whole chapter unnumbered, a list of places and
  a range over chapters are let be. Asked again on the final code, David's
  points came in order (17:34-37, 38-40, 45-50) without a refusal. A later
  run found the check blind to half the lessons: the passage given as a
  `passage` change with its `ref` (David's `1 Samuel 17:1-58`, Psalm 51)
  and headings as `h2` changes, where it read only the changes' words. So
  the changes are read as the mark-up they write (`toLessonChangeText`);
  that David sermon's points stopped at 17:50 of 58 and went through.
- **BN-84 — a passage offered with a long story is shortened, never
  dropped** (2026-11-11). _write an Easter sermon_ names no passage, so the
  model asks which. It wrote "I have a few suggestions" over ONE button:
  a passage option whose story in brackets ran past 50 letters, or whose
  whole label passed 64, was dropped. Now it keeps its reference and as
  much of its story as fits, cut at a word with "…"
  (`toFittedPassageReply`, in the options line and in a list of passage
  lines). Asked again live: "Luke 24:1-12 (The empty tomb and the
  announcement of the…)", "John 20:1-18 (Mary Magdalene's encounter with
  the risen Christ)", "Matthew 28:1-10 (The earthquake and the command to
  tell the…)", three buttons.
- **BN-85 — a preaching message is a lesson ask** (2026-11-11). The
  funeral sermon (_a message of hope for a funeral, from Revelation
  21:1-7_) was the thinnest lesson in every blind read since BN-66. It had
  never been given the lesson shape: "message" was no lesson word, so the
  empty note carried no lesson hint, and the model wrote from the short
  outline (`*Example:*`, `*How to live it:*`, a marathon runner, two
  sentences a point, 452 words). `checkIsLessonWriteAsk` now reads a
  "message of hope / comfort / grace … / on / about / from" after a
  writing word or as the ask's own start, and a funeral's message, talk,
  homily or eulogy. "A message" alone is not a lesson: _paste the message
  from my pastor_ and _write a message to my wife_ are not read as one.
  Asked again live: 944 words, a big idea with its complement, the
  background of Patmos, the seven churches and the judgment just before,
  every image explained, the free gift offered, and no discussion
  questions. Open: the French and Khmer packages' `lessonAsks` have no
  "message" either.
- **BN-86 — a passage read by its reference is given whole** (2026-11-11).
  BN-82's lessons, read blind, carried 3 (Opus) and 7 (Sonnet) factual
  errors where BN-81's had 0 and 4. Every error was in verses the model
  had never read. `owa_find_verse refs` cut each reference's text at a found
  verse's 300 letters ("a verse is quoted, not printed whole"), so a
  lesson's passage was read as its first two or three verses. The shape's
  "build every point on the words it returns" held no further than that,
  and the misquote check (BN-76) had nothing to hold the rest to. The
  priest and Levite of Luke 10:31-32, the prison of Matthew 18:30-35, the
  Samaritan's question quoted in words Luke never wrote, and "the tree of
  life" in Revelation 21:7 were all from memory. A passage (a range or a
  chapter) read by its reference is now given whole, within 6000 letters
  its call's references share (`READ_PASSAGE_TEXT_BUDGET`,
  `toReadPassageTextLimit` in `bibleVerseFindHelpers.ts`, `readRefs` in
  `agentBibleFindHelpers.ts`): one passage up to 6000 (the bound
  `owa_lookup_record` already reads a passage to), eight references 750
  each. A single verse is still cut as a found one is. No schema changed.
- **BN-87 — an empty note whose window is slow to open is still empty**
  (2026-11-11). With the computer at 100% CPU (another session's full
  gate run), a fresh scratch app's note windows took over the tool's 20 s
  to open. The window's read of the note before the ask failed ("The
  note's window is still opening"), so the empty note was treated as
  unknown: the lesson hint was left off, and the model's `owa_bible_note
  add` made a NEW note beside the empty one. Seven of twelve lessons were
  lost that way, and a slow church computer would do the same. When that
  read fails, the window now works out an EMPTY note's read from its file
  (`readBlankNoteFromFile` in `fileAttachHelpers.ts`,
  `toBlankNoteReadFromFileText` in `noteFileTextHelpers.ts`). The fallback
  gives the empty blocks the editor would show, counted off its saved tree
  and with no hash, so a later edit is never refused as stale. It counts
  only when every block is an empty paragraph: a note holding a picture
  alone is not empty. Anything else goes on with no read, as before.
- **BN-88 — each line of a point says what it may not add** (2026-11-11).
  Read blind with whole passages (BN-86), the errors left were the
  model's own priors, not words it had not read:
  - **What it means:** a custom from commentaries (_asking for his
    portion was wishing his father dead_, _the father ran to spare him the
    village's shame_);
  - **The passage answers:** a motive the text does not give (why the
    priest passed by);
  - **For example:** a promise the passage does not make (a widow meets
    her husband again);
  - **Pointing to Jesus:** the Samaritan turned into an allegory of him.

  Each of those lines now says what it may not add: a custom only as the
  Bible itself tells it; a reason, motive or promise only where the
  passage states one; an example promising nothing the passage does not;
  never the story turned into an allegory of him. The shape is ~1021
  tokens.
- **BN-89 — a new lesson reads the verses before its passage** (2026-11-11).
  Told to read them, the model did in about half the lessons (Luke
  18:31-43 before Zacchaeus, Revelation 20 before the funeral). The
  backgrounds of the rest were made up: Jesus praising "the simple faith
  of women" just before the Good Samaritan, and Psalm 46 following "a
  series of psalms contrasting the pride of man". Now, in an empty note's
  lesson ask (`isBlankLesson`), the first `owa_find_verse refs` naming ONE
  passage also reads the verses just before it (`findVersesBeforeRef` in
  `bibleVerseFindHelpers.ts`): up to ten verses in its chapter, or the
  chapter before when it starts one (1 Samuel 16 before 17:1-58, Matthew 12
  before 13). A note over the result says the window read them for the
  Background, to be told from those words (`genVersesBeforeNote`). Once an
  ask (`ToolWatchType.isLessonBeforeRead`). A list of places and a range
  over chapters are left as asked. Seen on the first run: David's
  background told of Samuel anointing David (1 Samuel 16 read with 17),
  the Good Samaritan's of the seventy's return (Luke 10:15-24), Psalm 46's
  of Psalm 45's royal wedding. Each had been made up the run before.
- **BN-90 — no "Have you ever", no echo, no homework at a funeral**
  (2026-11-11, the same blind read). 24 lessons of 26 opened _Have you
  ever…?_, the response said the big idea again word for word, and a
  funeral sent the mourners home with a weekday task. The Introduction is
  an everyday scene or a question of the passage's own, never _Have you
  ever_; the Response says the big idea in new words; a funeral's This
  week is a comfort to hold, never a task. ~1050 tokens. Seen on its run:
  David's introduction "Imagine standing before a problem…", the funeral's
  This week lines comforts ("When the house feels too quiet, sit for a
  moment in the knowledge that God is with you"). Read blind (Sonnet
  only, the Opus reader stalled twice): 20.54 -> 19.77, Best 8 -> 7. The
  errors were the same kind as before (the hundred pence in two lessons,
  "create" as making from nothing, Jesus called contrite), none in the
  lines BN-90 changed. Within the reader's noise.
- **BN-91 — the KJV words a preacher stumbles on, explained by Scripture**
  (2026-11-11). After BN-86, the errors left were the model's memory of
  words. The hundred pence of Matthew 18:28 was "a small amount a day's
  wage might cover" in three runs of four, when a penny WAS a day's wage
  (Matthew 20:2). The sling was "a shepherd's tool rather than a soldier's"
  (Judges 20:16), and the priest and the Levite "the highest officials".
  A table of 20 such words (`lessonWordGlossHelpers.ts`: penny and pence,
  talent, mite and farthing, shekel, publican, Levite, priest, Samaritan,
  Pharisee, scribe, hyssop, tabernacle, sling, cubit, leper, sackcloth,
  uncircumcised, centurion, sabbath, bowels of mercies) gives each the verse
  that says what it is. A new lesson's first passage read (BN-89's) carries
  the entries whose words its text holds, eight at most, under a note
  saying a What it means line says only this of them
  (`findLessonWordGlosses`, `genLessonWordGlossNote`). Only words whose
  meaning holds wherever they stand: "anoint" (a host's oil in Psalm 23:5)
  and "firstborn" (Christ's place in Colossians 1) are left out. English
  KJV words: another language's Bible matches none. The app's cross
  references were looked at first: they are thematic (Matthew 18:28 leads
  to Luke 7:41-43, the two debtors) and about 9 000 letters a passage, and
  name no "penny a day".

  The first run's David lesson copied an entry and got it wrong: "a shekel
  is a weight of silver paid as money", said of Goliath's coat of brass. An
  entry now gives every sense the Bible gives the word (the shekel: silver
  weighed out as money, and the weight of Goliath's brass and iron), or
  says where its sense holds (a priest "in Israel", a scribe "in the
  Gospels"). Two words now match only in the sense their entry gives:
  "tabernacle" in the singular (Peter's "three tabernacles" are booths),
  and "bowels" only as "bowels of mercies" or "of compassion" (not Judas'
  in Acts 1:18). That run was stopped and asked again.

  The second run used the pence entry as a SUM: "a hundred pence was
  roughly a labourer's pay for one day" (Matthew 18), and "pence is a
  labourer's pay for one day" of the Samaritan's two pence. The old error
  was gone and a worse one had taken its place. The entry now says how
  pence count ("ONE penny was a labourer's pay for one day … so pence are
  days' pay: two pence, two days' pay; a hundred pence, a hundred days'
  pay"). Only those two lessons' passages hold the word, so only they were
  asked again: "a hundred pence was only a hundred days' pay for a
  labourer", "Two pence represents two days' pay". Seen elsewhere in the
  run: "Hyssop is a plant dipped to sprinkle blood or water for cleansing
  (Exodus 12:22; Numbers 19:18)", and the priest as "a son of Aaron who
  offered sacrifices in Israel". The publican's line added "because they
  were seen as traitors and extortionists", the model's own words beside
  the entry's.

  Read blind against BN-90 on all 16 asks (scoreboard 2026-11-11 (5th)):
  errors 8 -> 4 by Sonnet and 3 -> 2 by Opus, accuracy up by both, no
  error left in a listed word. Explanation fell as much where the passage
  held no listed word (the same prompt both times) as where it did.
- **BN-92 — the errors read again and again get Scripture beside them**
  (2026-11-11). Every blind read since BN-82 was tallied for the errors in
  its new lessons. Three came back read after read:
  - Psalm 51:10's "create" as making "out of nothing" (four reads);
  - the tormentors of Matthew 18:34 as "the spiritual agony of a life
    lived without grace" (three);
  - Saul's armour "too heavy" (two), where 17:39 says "I have not proved
    them".

  Eleven entries join the table, each with the Bible's own words:
  - create: "created the heaven and the earth", "created man", formed "of
    the dust of the ground";
  - span: "meted out heaven with the span";
  - prove: to test, "prove me now herewith";
  - tormentors: 18:34-35 quoted, "So likewise shall my heavenly Father do
    also unto you";
  - contrite: over sin, or crushed by trouble (Psalm 34:18) -- Jesus had
    been called "the truly broken and contrite one";
  - sacrifices of righteousness: Psalm 4:5, and named in Psalm 51:19 with
    the burnt offerings;
  - blot out: "I have blotted out, as a thick cloud, thy transgressions";
  - a head anointed with oil: a host's honour to a guest, "My head with oil
    thou didst not anoint" (Luke 7:46), against the shepherd's salve the
    model remembered;
  - "no more sea": the restless sea of Isaiah 57:20 and Revelation 13:1,
    against John's island;
  - and, from the BN-91 read, fourfold (the law's payment for a stolen
    sheep, Exodus 22:1, against "the biblical standard for restitution" for
    fraud, which was the whole and a fifth more, Leviticus 6:5) and a coat
    of mail (scales, not "interlocking metal rings").

  Each was checked against the app's KJV wherever the word appears.

  Asked first on the eight asks whose passages hold one of the words:
  - the shekel was right ("used for silver or metals like the brass and
    iron in Goliath's armor");
  - the tormentors were right ("Jesus warns that the heavenly Father will
    do the same to those who do not forgive from their hearts");
  - Psalm 51:19's sacrifices included "the burnt offerings mentioned in
    verse 19".

  Two things went wrong, and both were fixed:
  - "create" still came out as "God's unique work of making something
    where there was nothing before". The entry had opened on Genesis 1:1;
    it now opens on the correction: "God's own work, and not only out of
    nothing", man "of the dust of the ground", "I create Jerusalem a
    rejoicing" (Isaiah 65:18).
  - The Isaiah 40 lesson's last two points read "What it means: No
    specific words in these verses require further explanation from
    Scripture". The note over the list had said "a What it means line says
    of them only this", and a point holding none of the words took that as
    nothing to explain (0 such lines of 44 in BN-91's lessons, 2 of 12
    here). The note now says that every point still explains the words and
    pictures of its own verses. That changes every glossed passage read,
    so the whole set is asked again.
- **BN-93 — a point explains its hard phrase and asks what the verses
  answer** (2026-11-11, the BN-91 blind read). Sonnet put explanation at
  1.25 of 2. Its evidence:
  - What it means defined one word and left the verse's hard phrase ("'A
    cubit is a measure of length' -- Goliath's height and the Elah setting
    not explained", "'born of water and of the Spirit' never explained").
  - The hearer's question was one the passage leaves open, answered with
    a retelling or a made-up motive ("'against thee, thee only' asked but
    never answered", "why they passed by not explored").
  - The need was shown in a scene and never named ("Need implied by 'lost',
    not named"). Opus said the same of the introduction: it stops at the
    need and never turns the hearer to the passage.
  - Pointing to Jesus went by a word the passage shares with a name of his:
    "He is the Word made flesh" from the sower's word, "Jesus became the
    Way" from Proverbs 3:6's paths, "the ultimate faint one" from Isaiah
    40:31.

  Five lines of the shape now say what the readers look for:
  - What it means explains first the phrase a hearer would find hardest,
    what it means HERE;
  - A hearer asks is a question the verses themselves answer, never one
    they leave open;
  - The passage answers gives that answer with the words of the verse;
  - the Introduction names the need in ONE plain sentence, and a last one
    turns them to the passage;
  - Pointing to Jesus goes where a phrase's MEANING leads, never by a word
    it only shares with a name of his.

  ~1141 tokens (was ~1050), lesson asks only. Measured with BN-92 against
  BN-91 on the whole set.

  Seen in the run: the introductions named the need and turned to the
  passage ("Our sin is a stain that no amount of good works or regret can
  erase. We need a cleansing that only God can provide. Let us look at how
  David asks for this mercy"). What it means took the hard phrases
  ("Against thee, thee only", "waxed gross", "understandeth it"), and the
  questions were ones the passage answers. One miss: the sower's Pointing
  to Jesus still opened on "the Word made flesh".

  Read blind against BN-91 on all 16 (Sonnet): 20.50 -> 20.81, Best 11 ->
  12, explanation 1.56 -> 1.81, the need 1.44 -> 1.75. Christ and grace
  1.63 -> 1.50. All three errors in the new lessons were backgrounds (BN-96).
- **BN-94 — a lesson is written in the form the tab asked for**
  (2026-11-11, both BN-91 reads: "both 'short devotions' are three-point
  sermons"). The empty note card's **Help me prepare a short devotion**,
  then a passage pressed, was written as three points and 1100 words in
  two runs of two. The passage pressed names no form, and BN-78's form line
  went to a review or a finish alone. A lesson WRITTEN now carries the
  form its own words name, else the tab's (`genLessonFormWriteLine`,
  `readLessonFormAsked(asked) ?? lessonForm`): a devotion is every part in
  a sentence or two, ONE point and about 300 words, never three points; a
  children's lesson is the story told, two points, something to show and a
  one-line memory verse. A typed devotion had kept its one point but run to
  960-1010 words; the shape says each part is a sentence or two now.
- **BN-95 — an example names no one, and a lesson asks one step**
  (2026-11-11, the same reads). Opus, in two reads: "all 26 attach a
  weekday task to every point and add another in the Response, so a lesson
  asks 3 or 4 things -- most are duties rather than a response to grace".
  Sonnet: "Sarah, Mark, Elena" in example after example. An example now
  names a role and a place ("a nurse after a night shift"), never a name.
  A deed answers what God gives in its point, at the moment of the week it
  belongs to ("at the meal table"), never a weekday or hour picked for no
  reason. The Response takes its ONE step from the points' deeds instead
  of adding another. ~1209 tokens.

  The first run used examples of each in the shape, and the model copied
  them. One lesson opened two examples on "A man in the pew behind" and "A
  nurse after a night shift", and three lessons in four opened their deeds
  on "At the meal table" or "On the bus home". Across sixteen lessons that
  makes a new stock picture. That run was stopped after four lessons. The
  lines now describe what is wanted with no phrase to copy: someone "named
  by role and place, never by name, a person these hearers would know"; a
  deed "at the moment of their week where this point meets them".
- **BN-96 — no psalm's background from the psalm before it** (2026-11-11,
  the BN-92/93 read). All three errors in its new lessons were
  backgrounds. Two were psalms told from the psalm read before them
  (BN-89): "Psalm 22, a song of praise" before Psalm 23 (it opens "My God,
  my God, why hast thou forsaken me"), and "Psalm 50, general praise"
  before Psalm 51 (God judging his people). The third was "The prophet
  Samuel wrote these accounts" for 1 Samuel, a book that names no author
  and records Samuel's death in 25:1. A psalm is a song of its own, so a
  psalm starting at its first verse gets no verses-before read
  (`PSALMS_BOOK_PATTERN` in `findVersesBeforeRef`); verses before inside the
  same psalm still are. Background now says who wrote a book and to whom
  only where the Bible names them, and for a psalm "its own words and where
  the Bible tells its story, never the psalm before it". The app's KJV
  carries no psalm titles, so "when Nathan the prophet came unto him" is
  not there to read.

  Seen in the run: Psalm 51 was read alone, and its background came from
  the right story: "David wrote this psalm after the prophet Nathan
  confronted him about his sin with Bathsheba and the murder of her
  husband, Uriah."
- **BN-97 — passages closed by a question that chooses are still buttons**
  (2026-11-11, the BN-94..96 run). The empty note card's **Help me prepare
  a preaching lesson** was answered with three passages one a line --
  "The Prodigal Son (Luke 15:11-32)", "The Vine and the Branches (John
  15:1-11)", "The Armor of God (Ephesians 6:10-18)" -- then "Which passage
  shall we use, or do you have another one in mind?", and NOTHING could be
  pressed. BN-74's reader takes passages one a line only when they CLOSE
  the answer, and it stopped at the question. It now steps over one closing
  question that asks to choose ("which", "choose", "pick", "prefer") and
  keeps that question in the answer, above the buttons
  (`CHOOSING_QUESTION_PATTERN` in `cutPassageListFrame`). A yes/no question
  under verses an answer cites ("Would you like me to add them to the
  note?") keeps its Yes and No. Asked again, the card's press and the first
  passage made a 993-word lesson.
- **BN-98 — a devotion walks its passage, and a Response calls**
  (2026-11-11, the BN-94..96 read, Sonnet 21.06 -> 20.00). Two of BN-94
  and BN-95's lines went too far:
  - The devotions BN-94 shortened (362 and 401 words) were read "Short,
    fits a prayer-meeting devotion" for form and thin in every other part,
    21 -> 16 and 19 -> 15, the reader's one change "divide the psalm into
    its movements". Opus, two reads before, had marked three-point
    devotions down, so the form keeps ONE point. That point now walks the
    passage movement by movement, its What it means making each
    movement's words plain: about 450 words, every part short.
  - Told to take its step "from the points' deeds, never a new one", the
    Response shrank to "one line: 'Go and show mercy'", "two sentences with
    no call" (conclusion 2.00 -> 1.69). It is a clear call again (what, with
    whom, when) to the one deed that carries the big idea, never one more
    task.

  ~1256 tokens.
- **BN-99 — a passage over chapters is read whole** (2026-11-11, the
  BN-94..98 read). The funeral lesson quoted Revelation 21 wrong three
  times ("the former heaven and former earth", "they shall be my sons",
  "God himself shall dwell with them"). Asked for "Revelation 20:11-21:7",
  `owa_find_verse` had answered ONE entry, "Revelation 20:11", cut at 300
  letters: the app's title parser reads a span over chapters as one item
  whose end verse (7) is below its start (11), so the reader took it for a
  single verse and read chapter 20 only. Every word of Revelation 21 in
  that lesson came from memory -- the same fault BN-86 ended for passages
  inside one chapter. A span over chapters is now read a chapter at a time,
  each as a passage within the call's shared 6000 letters
  (`splitChapterSpan` in `bibleVerseFindHelpers.ts`, `toChapterRefList` in
  `agentBibleFindHelpers.ts`, four chapters at most): live, the same call
  answers Revelation 20:11-15 (749 letters) and 21:1-7 (1072), "the first
  heaven" and "he shall be my son" in it. The BN-76 misquote check flags
  all three quotes when given the lesson and its passage, whole or cut, but
  it refused none of them in the live ask; that is not explained yet.
- **BN-100 — "just before" is the end of the chapter before** (2026-11-11,
  both readers of the BN-94..96 read). Two lessons on Luke 15 told the
  Pharisee's dinner of Luke 14:1 as what came "just before" the lost sheep,
  where 14:25-35 does, and 15:1-2 sets the scene. BN-89 had read the WHOLE
  chapter before a passage that starts one, in the same call as the
  passage. The call's shared letters cut that chapter from its END, so the
  model saw the dinner and never the verses that lead in. The verses
  before are now a read of their own, so the passage keeps its whole
  budget. Of a chapter before, the last ten verses are kept (`toLastVersesRead`;
  when a long chapter comes back cut, those ten are read on their own), in
  `readVersesBefore` in `llmBotHelpers.ts`. Asked again live: Zacchaeus'
  background "as Jesus approached Jericho, he stopped to heal a blind man"
  (Luke 18:35-43), the lost sheep's "Just before this, Jesus told people
  that following him costs everything" (14:25-35), both right.
- **BN-101 — fourfold opens on "MORE than the law asked"** (2026-11-11).
  Even beside its entry (BN-92), Zacchaeus' fourfold was "the strict
  penalty for stolen goods under the law" in two more reads. The entry
  had opened on "what the law asked for a stolen sheep". It opens on the
  correction now, as BN-92 found an entry must: "fourfold: MORE than the
  law asked -- for goods taken falsely it asked them back "in the
  principal" and "the fifth part more" (Leviticus 6:5); four times over it
  asked only for a sheep stolen and killed or sold" (Exodus 22:1). Seen in
  the run: "restore him fourfold means giving back far more than the law
  required for stolen goods".
- **BN-102 — a background gives the occasion; a retelling puts no words in
  a mouth** (2026-11-11, both readers of the BN-98 read). Backgrounds said
  what came earlier in the book and missed the OCCASION the passage
  answers -- Luke 15:1-2's murmuring, the Philippians' gift, Isaiah 40:27's
  complaint, the Jews' and Samaritans' quarrel (12 lessons by Opus, 14 by
  Sonnet). Jonah "said he was sorry" in the fish (three reads), and a
  hearer asked "Why is the father upset with the son who stayed?" of a
  father who "intreated him". Background now asks for the occasion it
  answers (who was speaking to whom and why, what had just happened or been
  said, in its first verses or just before them) and who its people were to
  its first hearers; a retelling adds no "word anyone said" the passage does
  not; a hearer's question never takes for granted what the verses do not
  say. ~1305 tokens.
- **BN-103 — Jonah's prayer and God's turning, as Scripture says them**
  (2026-11-11, the BN-99..101 read). Jonah was read wrong in four blind
  reads running: he "said he was sorry" in the fish, and Jonah 3:10's "God
  repented of the evil" meant "the people truly changed their hearts". Two
  phrase entries join the table: "repented of the evil", said of God in all
  eleven KJV places ("the LORD repented of the evil which he thought to do
  unto his people", Exodus 32:14), and Jonah's prayer from "the fish's
  belly", a cry and a thanksgiving ("Salvation is of the LORD", 2:9) that
  "says no word of sorrow for running away". Asked again: "Jonah prayed to
  God from the fish's belly", and "God turned away from the harm He said
  He would bring because the people changed their ways".
- **BN-104 — Christ by the New Testament's own link, an example by the
  point's own verses** (2026-11-11, the BN-99..102 reads, both readers).
  Pointing to Jesus was "tacked on or allegorised" (Sonnet 1.31 of 2), and
  a verse it quoted from memory carried the wrong reference: "I seek not
  mine own will…" as John 6:38, where it is 5:30. Examples were stock
  office types, "a manager at a warehouse" in nine lessons, that "don't
  mirror the point". Pointing to Jesus now goes first where the New
  Testament itself takes the passage to Christ (a verse that quotes it, or
  Jesus' own words about it), read with `owa_find_verse` and written as its
  token, never quoted from memory. An example is the point's own verses
  happening again in the hearers' week, told as a preacher would tell it,
  never ending on "This shows". ~1386 tokens. Seen in the run: Psalm 23
  through "I am the good shepherd: the good shepherd giveth his life for
  the sheep" (John 10:11) and Jonah through Matthew 12:40, each read and
  written as its token. Proverbs 3 still reached "the way" of John 14:6, a
  shared word.
- **BN-105 — the verses before the passage they NAMED** (2026-11-11, the
  BN-103/104 run and a blind reader's accuracy 0). Asked for Proverbs
  3:5-6, the model read Proverbs 3:1-6 for its setting, so the window read
  the verses before THAT read -- Proverbs 2's last ten -- and the lesson
  told the strange woman and the paths of darkness (2:13-22) as "the
  verses just before this passage". The window now reads the verses before
  the one passage the ask names with its chapter and verse
  (`findNamedPassageRef`, off `askedText`), when the model's first read is
  in its book (`pickVersesBeforePassage`; a time like "Sunday 10:30" is
  in no book read), else before the read as it did; and the note over the
  read names the passage they come before ("the verses just before
  Proverbs 3:5-6"). Asked again live: read 3:1-6, the window read 3:1-4,
  and the Background "the father urges his son not to forget the law and
  to keep mercy and truth close to his heart to find favor with God and
  man".
- **BN-70 — the note editor turns the KJV's `:)` into a smiley.** The
  `bible-note` package's EmojisPlugin replaces `:)`, `:D`, `:(` and `<3`
  in every text node, a passage's verse words included: Matthew 6:32's
  "(For after all these things do the Gentiles seek:)" reads "seek🙂" in
  the note (a blind reader of BN-66 caught it). The KJV closes many
  asides so. Not the chatbot's code: the editor could leave a passage's
  words alone, or the app turn the plugin off.
- **BN-71 — a typo in the app's own KJV.** Jonah 1:15 read "So they look
  up Jonah" in `src/helper/bible-helpers/bible-data/kjvBibleBooks.json`
  (the KJV: "took up"), printed into every lesson on Jonah (a blind
  reader caught it). Fixed 2026-11-10; a KJV already installed keeps its
  copy until it is installed again.
- **BN-67 — _finish my sermon_ grows the lesson where it stands**
  (2026-11-10, the Stop hook: _checked live once, on a single partial
  lesson_). Four partial sermons asked live, four ways wrong: the model
  numbered each new block after the one it had just added
  (`after: 3, 4, 5, 6` for a heading, its words, the next heading …) where
  the tool reads every number as the note was read, wrote "## " into a
  heading's words, left a point's one line as all it had, put the
  introduction after the points and each point's own line under its new
  words, and asked again in parts named blocks its first part had moved.
  Now: the window names what the lesson lacks and the block each part goes
  after (`genLessonGapsText` -- the end of the part before it in the
  shape's order, a point's own last line for its words; a lesson headed in
  another language is told only its passage and points); _finish it_
  beside a lesson is read (`checkIsBareFinishAsk`, `checkIsLessonNoteText`);
  the hint asks ONE add a place, numbers as read; the tool reads a
  heading's marks as the heading (`readHeadingMarks`), a heading added with
  its words numbered as they will stand as one section (`chainSectionAdds`,
  one block a place only -- sections one a place were numbered right),
  a line changed into a range token as the passage (`expandPassageChanges`),
  reads a section's lone verse token even where the note has its chip
  (the passage it becomes needs the verse; "no installed Bible could read
  Luke 15:4"), and a chained block no longer claims the number it was given
  (a point's words had gone under the background). A dropped long edit is
  asked for in parts FROM THE END UP (`NOTE_DROPPED_NUDGE`: an add moves
  only what is after it). Loose lines (every block a paragraph, read
  whole, 20 at most) are a lesson written in their place by ONE flat add
  (`readNoteRewrite`, `NOTE_LESSON_REWRITE_HINT`, the window's
  `toBlankNoteFillArgs`) only when every line of theirs is in it
  (`findLostNoteLines`), and an edit that weaves them into a lesson takes
  out each raw line its new words hold (`withRewrittenLinesRemoved`). A
  refused fill of an EMPTY note no longer spends the redirect (seen live in
  Spanish: "Salmos 23" refused, the corrected add made a second note). Seen
  live after: the outline, the listed points and the near-whole sermon each
  every part in order, their words kept, one call (6-12 s).
- **BN-68 — a bold OPTIONS marker over a list.** `**OPTIONS:**` on its own
  line with the options under it -- how gemma4:cloud closed most finished
  sermons -- was drawn as words: the closing `**` read as words after the
  marker. `cutListedFrame` takes them off (`quickReplyHelpers.ts`); seen
  live after, the buttons under every finished sermon. A model in a
  language with no frame words of its own (Spanish) writes `OPCIONES:` over
  a list, which BN-47 leaves as words on purpose (a list one a line under an
  unknown word is how steps are written).
- **BN-69 — a note named like a guide page loses its name in the answer.**
  `scrubAnswerRecipeIds` takes any `L-01`-shaped word out of an answer: a
  note titled "Lesson L-01 a" was answered as "Lesson the guide page a".
  The run names its notes without the hyphen; a person's own title of that
  shape (`Series A-1`) would be read so too. The attached note's name could
  be spared.
