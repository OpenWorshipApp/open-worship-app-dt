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
- ~~**BN-19 — a note attached but not yet asked about is lost on a reload.**~~
  Done 2026-11-11 with `EC-498` (the chatbot's backlog): the files waiting
  in a tab's box, a note among them, are saved with the tab
  (`ChatSessionType.boxFiles`) and put back in the box when the help window
  loads again, after a reload or a close. A note waiting there is the
  tab's note (`findTabNoteTarget`): the tab works in its window and asks
  about Bible Note after a reload, and a launch press from the Reader
  leaves it so. It was: the attachment waited in the box (a row's Open in
  Chatbot's too); a reload of the help window -- or closing it -- dropped
  it, and the tab went back to the Reader. Seen live when a source edit
  reloaded the scratch window: the next line went to the Bible-reader ask.
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
- **BN-106 — Luke 15 and the priest in the word table** (2026-11-11, the
  BN-99..104 reads). Three misreadings came back read after read. The
  prodigal's father "ignores the request for servitude", which the son
  never made (three reads: 15:21 stops at "no more worthy to be called
  thy son"). The lost sheep's shepherd "goes into the scary wilderness",
  where Luke 15:4 LEAVES the ninety and nine in it. The priest and the
  Levite were "the highest religious leaders in Israel" (two reads). Three
  entries, each quoting the KJV as the app's own data has it. "make me as
  one of thy hired servants" is what the son PLANNED to say. "The ninety
  and nine in the wilderness" is the flock's pasture where they are left,
  as Eliab asked David "with whom hast thou left those few sheep in the
  wilderness?"; Matthew's shepherd goes "into the mountains", which this
  does not match. The priest entry opens on "ONE of the many sons of
  Aaron, who served in turn" (Luke 1:8) and names the high priest
  (Leviticus 21:10); it no longer matches "chief priests" or "high
  priest". And, from the run itself: "passed by on the other side" (only
  Luke 10:31-32 in the KJV) says Luke gives no reason why, so a lesson
  gives none. Seen live: the children's lost sheep read "the wilderness
  is the open land where the sheep eat grass" (before: "a wild place
  where it is easy to get lost"); the Good Samaritan, which had the priest
  and the Levite "choosing their ritual purity or safety over the life of
  a dying man", answered "The passage does not give their reason".
- **BN-107 — an example a listener can see, never a manager at an
  office** (2026-11-11, the BN-103/104 read). Opus scored illustration
  1.19 of 2 (25 lessons of 32 at 1, "stock workplace vignettes"); Sonnet
  had said the same since BN-95. The shape asked for "someone named by
  role and place, never by name", and the model filled both with a
  workplace: "a manager at a warehouse", "a clerk at a busy office". An
  example is now "three or four sentences a listener can see: the place,
  one thing there to see or hear, and what was said or done; a person
  these hearers would know, never by name, and never a manager, a clerk
  or an office".
- **BN-108 — seventy times seven, and the thorny ground's hearer**
  (2026-11-11, the BN-106/107 read, Sonnet). "Seventy times seven is not a
  mathematical limit of 497" (it is 490, the one definite error left in a
  baseline lesson), and a sower lesson answered "Can a choked hearer still
  be a believer?" with "Yes" (Opus had flagged the same in the BN-102
  read). Two entries, quoted from the app's KJV data. "Seventy times seven"
  (only Matthew 18:22) gives "four hundred and ninety" and Luke 17:4's
  "seven times in a day". "Choke the word" (Matthew 13:22, Mark 4:19) says
  the parable calls that hearer one "that heareth the word", never a
  believer, and says no more, "so a lesson neither asks nor answers that".
  Told first only that it "does not answer it", the model still asked "Can
  a person be a believer but still be unfruitful?" and answered "Yes".
  Asked again with the entry naming the word: "Can someone be distracted
  and still be fruitful? No", from the verse. Seventy times seven was read
  "not a number to be counted up to, but a way of saying that forgiveness
  must be without limit".
- **BN-109 — Isaiah 40: Jesus never "fainted"** (2026-11-11, three reads:
  "the ultimate faint one" in two Opus reads, "fainted under the weight of
  our sins on the cross" in Sonnet's BN-106/107 read). "Fainteth not"
  (only Isaiah 40:28) says it is said of the LORD, that the youths "shall
  faint and be weary" (40:30), and that the Gospels have Jesus "wearied
  with his journey" (John 4:6), calling "all ye that labour and are heavy
  laden" (Matthew 11:28), never fainting. Asked again live: no fainting,
  but Matthew 11:28 quoted from memory as "weary and heavy laden" -- which
  BN-110 then caught.
- **BN-110 — a quote given its chapter and verse is that verse's words**
  (2026-11-11). BN-76 held a quotation to what the ask had READ, so a verse
  quoted from memory and never read was let by, and that was most of what
  the blind readers still counted: John 5:30's words as John 6:38, "He hath
  spoken well, for he hath spoken truth" as 1 Samuel 17:52 (no such words),
  Matthew 11:28 as "weary and heavy laden". A quotation with a reference in
  its own sentence (`findCitedQuotes`: after it first, else before it, never
  one that belongs to another quotation) is now held to that verse. The
  window reads each cited reference itself (`readCitedVerseTexts`, eight at
  most, the installed Bible, no model) and, when the quoted words are not
  in it, sends the change back once with the verse as it reads
  (`findCitedMisquotes`, `genCitedMisquoteRefusal`). A reference that could
  not be read, a read cut short, a quote cut with an ellipsis (a piece at a
  time) and a quote in another script than its verse are let be. Asked
  again live: the Isaiah 40 lesson's Christ section quoted "Come unto me,
  all ye that labour and are heavy laden, and I will give you rest" and
  "wearied with his journey" word for word, each as its token.
- **BN-111 — Jonah's sign, to whom, and an hundred pence** (2026-11-11, the
  BN-106/107 read, Opus). A children's lesson had Jesus tell Jonah's sign
  to "His friends" (Matthew 12:38-40: to the scribes and Pharisees who
  asked a sign), and a forgiveness lesson had the fellowservant owe "a few
  pence". Two entries: the fish's belly as Jesus told it, "never told to
  his friends or disciples", and "owed him an hundred pence", a hundred
  days' pay, small only beside ten thousand talents. Asked again live: "an
  hundred pence was a hundred days' pay -- a significant sum, but one that
  could actually be paid", and "Jesus told some people" (with the entry
  first naming only the scribes and Pharisees, still "His friends").
- **BN-112 — a verse shows its words: the memory verse printed, the
  Christ verse quoted** (2026-11-11, the BN-106/107 read, both readers:
  "a bare reference with no words"). Written as a section, a lesson's
  memory verse on its own line is printed whole; written as a change of
  its own, one verse stayed a chip, and the children's Jonah lesson's
  memory verse was "[^(KJV) Jonah 2:9]" alone in both runs. In a new
  lesson, a line the change adds that is one verse token and nothing else
  is now that verse printed (`toLessonVerseLines`; a block it rewrites
  keeps its kind, and outside a new lesson one verse stays its chip). And
  the Christ section's New Testament verse, told to be "written as its
  token", stood in a sentence as a chip: "Jesus says, [^Matthew 11:28]."
  Its words are now "quoted as they read and then its token" -- BN-110
  holds such a quote to the verse. Asked again live (profile l, the last
  one latched): "Come unto me, all ye that labour and are heavy laden, and
  I will give you rest" [^(KJV) Matthew 11:28]; the children's memory line
  "[^(KJV) Jonah 2:9] (Salvation is of the LORD)".
- **BN-113 — a quote of the passage read is not held to a reference named
  beside it** (2026-11-11, BN-110's first live run). A Psalm 51 lesson
  wrote "'Purge me with hyssop' refers to the plant used to sprinkle blood
  or water for cleansing, as seen in [^(KJV) Exodus 12:22]": the quote is
  its own passage's 51:7, Exodus 12:22 named for what hyssop was, and
  BN-110 would have sent the lesson back as a misquote of Exodus. A quoted
  piece that what the ask read already holds (`watch.noteQuoteSources`,
  BN-76's own, `findCitedMisquotes`' `readTexts`) is that text's words and
  is let be. An audit of three 16-lesson runs by the same rule against the
  app's KJV data (every quotation with a chapter and verse in its
  sentence): the BN-105 baseline 1 of 22 not in its verse -- the invented
  1 Samuel 17:52 the readers had found -- BN-106/107 0 of 10, BN-108..112
  0 of 31.
- **BN-114 — a verse is in the Testament its book is in** (2026-11-11, the
  BN-108..112 read, Sonnet). A David and Goliath lesson's Christ section:
  "The New Testament tells us that 'But he was wounded for our
  transgressions' [^(KJV) Isaiah 53:5]" -- the quote right, so BN-110 let
  it be, the Testament wrong. A sentence naming one Testament and never
  the other, whose every reference is a book of the other (the KJV
  config's `bookKeysOld`), is sent back once with what is where
  (`findTestamentSlips`, `genTestamentSlipRefusal`); a book the table does
  not know, or a sentence naming both, is let be. Unit-tested; asked again
  live, the lesson's Christ section named no Testament ("Jesus, the true
  Champion"), so the check had nothing to send back. Still open from the
  same read: details no text gives (the stone striking "the only place his
  armour did not protect him") and a cross-reference told wrong ("those who
  were healed by Jonas", Matthew 12:41).
- **BN-115 — four more slips, one the word table made** (2026-11-11, the
  BN-108..112 read, Opus). Genesis 2:7 was cited for "create": the BN-92
  entry had set "created man" (Genesis 1:27) beside "of the dust of the
  ground" (Genesis 2:7), and a lesson merged them into "He created man
  from the dust in Genesis 2:7" -- which says formed. The entry now keeps
  them apart ("of the dust he 'formed man' (Genesis 2:7), a word of its
  own"). Three entries, quoted from the app's KJV data: "sunk into his
  forehead" (no gap in Goliath's armour -- "an helmet of brass upon his
  head", 17:5), "repented at the preaching of Jonas" (Matthew 12:41: no
  one was healed) and "came to Jesus by night" (John 3:2: Nicodemus owning
  the miracles, not asking about them). And BN-114 tightened: the first
  reference after a Testament is named is the one it introduces. The live
  run had "The New Testament tells us that ... [Isaiah 53:5], and that ...
  [Colossians 2:15]", let by because one reference was the New's. Asked
  again live: "the men of Nineveh who repented at the preaching of Jonas";
  "Nicodemus had come to Jesus by night, acknowledging that Jesus must be
  from God because of the miracles He performed"; 14 cited quotations,
  every one word for word.
- **BN-116 — the Pharisee entry gives the meaning, and Paul's words as
  his** (2026-11-11, the BN-113..115 read, Sonnet). The entry was Paul's
  phrase alone ("Pharisee: 'the most straitest sect of our religion' (Acts
  26:5)"), and a John 3:16 lesson made it John's: Nicodemus "a member of
  the most straitest sect of their religion" -- John 3:1 says "a man of the
  Pharisees". The entry now opens on the meaning in plain words ("of the
  strictest party of the Jews' religion") and gives the quotation as Paul's
  ("Paul, once one, called it ..."). Asked again live: "Nicodemus, a ruler
  of the Jews and a Pharisee -- one of the strictest parties of the Jews'
  religion". The same read, by the KJV audit: 1 cited quotation of 35 off
  in the run it read, "written in the book of life" given Revelation 20:12
  for 20:15's words -- let by because 20:15 was in the lesson's own read
  (BN-113); open: exempt a quote of what was read only when the reference
  beside it names another book.
- **BN-117 — a quote read in its reference's own book, given another
  verse, is a wrong reference** (2026-11-11, the BN-113..115 read, Opus:
  the one error left in its 16 newer lessons). "Written in the book of
  life" was credited to Revelation 20:12; the words are 20:15's, which the
  funeral lesson's own read of the chapter before held -- so BN-113 let it
  by as a quote of what was read. A read is now kept by its book (a
  verse's `key`, `REV 20:6-15`), and a quote found only in a passage of
  the cited verse's own book is sent back with that verse; read in another
  book ("Purge me with hyssop", Psalm 51:7, beside Exodus 12:22) it is let
  be as before. Words that are no read of verses -- the note, the ask --
  still let a quote be. Asked again live: "those not found in the book of
  life are cast into the lake of fire [^(KJV) Revelation 20:11-15]", 8
  cited quotations, every one word for word.
- **BN-118 — a background that changes how THIS passage is heard**
  (2026-11-11, the BN-116/117 read, Sonnet: six backgrounds of sixteen at
  1, "generic", "boilerplate"). Each opened on a sentence true of its whole
  book -- "This account is part of the historical books of the Old
  Testament", "Matthew wrote this account for a Jewish audience", "a song
  of confidence", "a song of trust" -- and the occasion the reader asked
  for was missing or came after it: the Philippians' gift (4:10) for
  Paul's contentment, Babylon for Isaiah 40. The shape's Background asks
  for sentences that change how THIS passage is heard and names those as
  what it never says: naming the wrong reading is what ended "Have you
  ever" (BN-90).
- **BN-119 — a devotion's movements are lines, each named by its verses**
  (2026-11-11, the same read: the Psalm 23 and Psalm 46 devotions both "one
  point holds all the verses", D and E at 1; the reader's one change
  "break the psalm into its movements (pasture, valley, table)", "divide
  the psalm by its refrains (vv.1-3, 4-7, 8-11)"). BN-98 had told the one
  point to walk its passage "movement by movement"; the model printed the
  whole psalm under it again and explained three phrases. Now: under its
  heading no passage printed again, and its What it means a line for each
  movement in order, each opening with that movement's verses as a token.
  BN-83 reads every token under a point, so the movements still cover the
  passage.
- **BN-120 — a verse token is never a sentence's words** (2026-11-11, the
  same read: a funeral message's "finds its fulfillment in Jesus, who
  [^(KJV) John 1:14]." -- and ab20's "Jesus says, [^(KJV) Matthew
  11:28]."). A token shows its reference alone, so the sentence was left
  with no words where the verse's were meant to be. A token right after
  "who", "which" or "whom", or after a saying word and its comma or colon,
  that ends its sentence is sent back once an ask (`findTokenAsWords`,
  `genTokenAsWordsRefusal`), the sentence quoted and the way to give the
  words shown in it; "as Jesus said [^John 3:16]." cites, and is let be.
  Run over the 128 lessons of ab20..ab23, it names exactly those two.
- **BN-121 — the father's gifts and the Spirit taken, in the word table**
  (2026-11-11, the same read: "give the robe, ring and shoes some
  explanation of what they meant"; a Psalm 51 lesson that never said why
  David fears being cast away). Luke 15:22's best robe, ring and shoes --
  the father's answer to "no more worthy", the ring and fine clothing
  Pharaoh put on Joseph when he set him over the land (Genesis 41:41-42),
  of the shoes nothing more (one place of Scripture: two side by side are
  merged) -- and Psalm 51:11's "take not thy holy spirit from me": the
  Spirit "came upon David" (1 Samuel 16:13) and "departed from Saul"
  (16:14).
- **BN-122 — a psalm's title is Scripture the app's KJV does not hold**
  (closed by BN-147, 2026-11-11). Psalm backgrounds are the thinnest the readers find
  ("David, a shepherd himself ... wrote this psalm" -- thin), and the
  shape tells a psalm's background from "its own words": the KJV prints a
  title over most psalms ("A Psalm of David", "when Nathan the prophet came
  unto him"), and neither `kjvBibleBooks.json` nor an installed KJV.xml
  carries one, so the model reads none. Titles from a sourced KJV text,
  read with the psalm, would give the background its own words; never
  written from memory.
- **BN-123 — the wrong reading named where it was made** (2026-11-11, the
  BN-116/117 read, Opus: four lessons held at accuracy 1, each "a meaning
  the text does not give"). Three were read with an entry beside them:
  "tormentors" (Matthew 18:34-35) as "the consequences of a heart", one's
  own bitterness; David "had not proved" Saul's armour as "it didn't fit";
  the ninety and nine left "because he knew they were safe". Each entry
  now says what it never means (the 1 Samuel 17:39 words their own entry,
  so the general "prove" carries no David into Romans 12:2), and Psalm
  23:3's "restoreth my soul" -- read as "a sheep that has cast itself on
  its back" -- has one: "a restorer of thy life" (Ruth 4:15), never the
  cast sheep, a preacher's picture.
- **BN-124 — a child's memory verse a child can say; no stock scene**
  (2026-11-11, the same read). Children's lessons took Luke 15:7 (28
  words) and Jonah 3:10 (37) as their memory verse, told "one short line";
  it is "ONE verse of twenty words at most, from the story or elsewhere in
  Scripture" now (a number is what the model follows, BN-73). And one
  hospital room had stood in seven lessons of 32, beside a canyon bridge
  and a stranger who pays the debt: named with the lifeboat, the garden
  and the rescue as stock pictures.
- **BN-125 — the line said last agrees with the shape; a stock scene is not
  named** (2026-11-11, the BN-118..124 run, 16 lessons read by hand before
  the blind read). What held: no background opened on a line true of its
  whole book (BN-118); both devotions walked their psalm a line a movement,
  each line opening with its verses (BN-119); the word table's new entries
  were used where they fit (the father's gifts "signs of honor and trust",
  Psalm 51:11 "the Spirit that came upon David"). What did not: the
  children's lessons still took Luke 15:7 (28 words) and Jonah 2:9 (24),
  and the devotions printed their psalm again under the one point -- the
  form line said with a written lesson (`genLessonFormWriteLine`, said
  LAST) still read "a memory verse of one short line" and said nothing of
  the passage, and it now says what the shape says. And the hospital room
  named as a stock picture came back in 6 lessons of 16 (4 of 16 before
  it was named): a scene named to avoid is a scene put in mind, so the
  list keeps its first three. One more slip: "He was delivered to the
  tormentors of the cross" -- the tormentors entry now says the one
  delivered is the servant who would not forgive, never a picture of
  Christ.
- **BN-126 — the order Luke tells, Jonah as his book tells him, and the
  setting Scripture gives** (2026-11-11, the BN-118..124 read, both
  readers). The father "ran ... while the son was still speaking his
  apology" (an error to both readers, on both sides by Sonnet): the
  "hired servants" entry's "the father spoke" (15:22) had been told as
  his RUN. It now states the order -- he "ran, and fell on his neck, and
  kissed him" (15:20) before the son said a word. The children's Jonah,
  Good or a bare Best in every read: Jonah's reason for running is the
  book's own, at its end (4:2), never fear; Nineveh is where the king of
  Assyria dwelt, Assyria that "carried Israel away", and the city God
  would spare (4:11) -- matched by Jonah's own "Nineveh, that great
  city", so Matthew 12:41, read before the sower, gets none of it. And
  the one fact of Scripture four backgrounds left out, each beside the
  words that need it: David already anointed (16:13) as Saul and Israel
  were "dismayed" (17:11); "my law" the father's teaching (Proverbs 4:1),
  never the LORD's; Isaiah 40's people comforted (40:1-2) after "shall
  be carried to Babylon" (39:6); the Philippians' gift (4:18) behind
  "content". Not taken up: a check that every "The passage answers:" line
  quotes the passage -- over 418 lines of five reads it would have
  refused 13 weak paraphrases and let John 3:16's "equal value" by (its
  line also carried a token).
- **BN-127 — a funeral message keeps a memory verse** (2026-11-11, the
  same read). Told "no questions for discussion", the funeral message
  ended at its prayer with no memory verse either, and both readers asked
  for one the mourners could carry home: "no questions for discussion,
  and still a memory verse to carry home". Seen in the next run: the
  funeral message closed on Revelation 21:4.
- **BN-128 — John 3:16 gives its own reason, and no other** (2026-11-11,
  the BN-118..124 read and the run after it). "The passage answers:
  Because the gift had to be of equal value to the life being saved" (an
  error to Opus), then "To satisfy justice ... to take the place of the
  sinner": reasons the verse never gives, under the one line that answers
  FROM it. A word-table entry gives the verse's own reason (love), its
  end (life) and its how ("lifted up", 3:14), and names the wrong reading.
- **BN-129 — a child's memory verse a child can say, held by the window**
  (2026-11-11, the BN-125..127 run). Told "ONE verse of twenty words at
  most" in the shape and in the form line said last, the lost sheep's
  children's lesson still took Luke 15:7 (28 words), three runs running
  (the Jonah one moved to Psalm 103:8, 13). A new lesson the window
  wrote its children's form line for (`isChildrenLesson`) has the verse
  its Memory verse part names read (`owa_find_verse`), and one over 20
  words sent back once with its count (`findMemoryVerseRef`,
  `countVerseWords`, `genChildMemoryVerseRefusal`); any other lesson's
  is not read. And BN-125's reading of the hospital room was wrong: with
  its name taken out of the stock pictures it stood in 7 lessons of 16
  -- it is the model's default scene, never put there by naming. Open:
  the first run after it let 1 John 4:16 (29 words) through in the lost
  sheep's lesson, and the same ask, built as the window builds it, is
  refused in the test (`llmBotHelpers.coverage.test.ts`); three live asks
  since chose short verses, so the miss is not seen again yet. The check
  lets a verse through when its read fails (it counts no words), which is
  the one place it could have.
- **BN-130 — the passage printed once, and the lawyer's own questions**
  (2026-11-11, the BN-125..127 read, Opus: the one lesson of sixteen under
  Best). The Good Samaritan's whole passage was printed again after its
  memory verse -- as Philippians 4:4-13 had been, "delete the duplicate
  passage block" to both readers -- and every devotion printed its psalm
  again under its one point though its movement lines carry their verses;
  the shape and the form line both say a passage is printed once. The
  window now takes out a line that is the top passage's token again,
  after the memory verse or under a point whose other lines carry their
  own verses (`dropRepeatedLessonPassages`), and nothing else: run over
  80 lessons of five runs it took out 11 lines, each such a repeat (the
  devotions' psalms, the two trailing passages, a children's Jonah 3:10
  under its own point). And the parable's gospel had been told as an
  allegory of Jesus the Samaritan: the word table gives the lawyer's own
  questions it answers (10:25, 10:28, 10:29, 10:37), told as the answer
  to him.
- **BN-131 — John 3:16's wrong question named** (2026-11-11, the
  BN-125..129 runs and the BN-128/129 read). BN-128's "never a reason
  these verses do not give" did not stop it: "A hearer asks: Why was it
  necessary for God to give his Son instead of just forgiving us?",
  answered "the only way to provide a rescue that satisfies justice", in
  three runs running, and Sonnet held both sides of the read at accuracy
  1 for it. The entry names what is not in the verses -- why it had to be
  the Son, an "only way", justice satisfied, a payment of equal value --
  and that a hearer asks there what they do answer. Seen in the next run:
  John 3:16's answers kept to the verse's own words.
- **BN-132 — the window's checks read what was written from memory, and
  hold a second choice too** (2026-11-11, the BN-128/129 read, Opus: three
  errors; two of them checks that had not fired). Found by reading the
  run's network log, where the window's own verse reads show and its
  refusals do not (a refused edit never reaches the tool): BN-129 HAD
  sent Luke 15:7 back -- the model then chose 1 John 4:16, 29 words, let
  in because the check ran once an ask (the next run: Jonah 2:9 sent back,
  Nehemiah 9:31's 23 let in). And BN-110 read a funeral lesson's first
  eight cited quotes in the lesson's order -- the Background's and the
  points', copied from the passage read -- while its Christ section's
  "became flesh and dwelt among us" (John 1:14), the ninth, was never
  read. Now every cited quote is found, and the verses read (eight at
  most) are those of quotes found in nothing the ask read first, then of
  quotes found only in a read of their own cited book (`pickCitedQuotesToRead`);
  a quote of another book's read is let be unread, as BN-113 lets it be;
  and a children's memory verse is sent back twice an ask at most.
- **BN-133 — a note put into another language reads that language's
  Bible** (2026-11-11, the user: _when user ask to do translation the
  content chatbot should follow-up for the language's bible, e.g. I asked
  to translate the whole content into Khmer then bible of translated should
  into khmer bible_). The translation kept every `[^…]` token as it was,
  so a lesson put into Khmer kept its KJV verses -- chips and the passage
  at its top in English. Now the window reads the ask: a typed _translate
  … into <language>_ naming no part (`readNoteTranslateLanguageName`; _the
  title_, _the prayer_, _point 2_, _the verses_ leave the verses alone), a
  pressed _Replace the words with <language>_, or **Replace the words**
  under the answer that asked which way (`checkIsNoteReplaceChoice`, the
  language read off the question before it) rides `AskExtraType.note.translate`
  (`resolveStudyTranslateLanguage`). The loop looks up an installed Bible
  in it once an ask (`findNoteTranslateBible`: the Lookup's when it is in
  it, else the first whole one, `pickTranslateBibleKey`), reads the note
  (`readNoteBlocks`), and the edit goes out with every verse token named
  that Bible, every passage block re-pointed to it -- a passage given words
  of the model's own re-read instead -- and the chips of the blocks it left
  alone named so too (`withNoteVersesInBible`, `bible` set): the verse
  words read by the app, never the model's. With none installed the words
  go in and the answer is told to say so (`genNoteTranslateNoBibleNote`).
  Seen live on scratch profile o (Auto, gemma4:cloud, the Khmer Bible ពគប
  copied in): _translate the whole content into Khmer_ asked which way,
  **Replace the words** pressed -- John 3:16-17's passage and both chips
  read from ពគប (`(ពគប) យ៉ូហាន ៣:១៦-១៧`) in one edit, 9 s; _Translate all
  of it into Khmer, replace the English words_ -- Psalm 23:1-3 the same, 6
  s. Open: an ask TYPED in another language (`BN-135`), and W-60's
  sentence, which waits for another session's uncommitted W-60 edits.
- **BN-134 — a translated note is held to its language** (2026-11-11,
  BN-133's live run). The Psalm 23 note came back with its "Big idea"
  heading in English and a Khmer line carrying three Thai letters, the
  royal "he" -- a Khmer reader can read neither. Now a translation's edit
  that leaves a block of words in English (four English letters at least
  and none of the language's script, tokens and links aside; given English
  or left alone) or writes letters of a third script (neither Latin, the
  language's own nor one the block had before -- a Greek word kept) is
  answered, once an ask, with the change made and a note under its result
  naming each block left, for ONE more edit (`findNoteTranslateLeft`,
  `genNoteTranslateLeftNote`, `ToolWatchType.noteTranslateLeftText`).
  Refused instead (the first build), gemma4:cloud sent the translation
  again in four parts, met a stale hash, ran out of rounds and answered
  "could not settle on an answer", 38.5k tokens; said under the change, it
  read the note and fixed the one heading in one edit. The language's
  script comes from its installed plugin (`resolveStudyTranslateLanguage`),
  else from the words the edit writes (`inferNoteTranslateScript`, the
  script most of their letters are in, never Latin): profile o has no
  Khmer installed. A language in Latin letters cannot be told from English
  by them, so only stray letters are looked for there. Seen live on
  profile o after: the Psalm 23 note and a John 3:16-17 note with a prayer
  (**Replace the words** pressed) -- the model skipped the "Big idea"
  heading both times, was told, and translated it in one more edit: the
  whole note in Khmer, the passage and chips from ពគប, 7 s and 11 s,
  16.7k-17.7k tokens, the ordinary answer. _translate only the title into
  Khmer_ changed the title and left the KJV verses (no Bible looked up).
  Its cases with Khmer and Thai letters are in the Khmer package's tests
  (the confinement gate).
- **BN-135 — a translation asked in the person's own words** (open). The
  reader of BN-133 is English: _translate … into …_ and **Replace the
  words** in English, or the window's own translate buttons in its
  language. A Khmer elder typing the ask in Khmer to a Gemma 4 model (asked
  untranslated) gets the translation with the verses left in the Bible they
  were. The words belong in each language's `assistant.json` (a
  `noteTranslateAsks` list, as `lessonAsks` are), every touched package's
  version raised and packed.
- **BN-136 — an edit answered with the hash it was given** (open, seen
  once in BN-134's first live run): a text-only `owa_note_edit` edit
  changed blocks 3 and 4 and answered `hash` 4d631469 -- the hash it was
  sent with -- while the next read gave 63c68f67; the model's next edit
  with the answered hash was refused as typed into, and cost a read. The
  answer's hash is `controller.readContent()` right after
  `writeContent` (`agentNoteEditHelpers.ts`), which reads the editor's
  `bibleNote.content`: a write the editor had handed back through
  `saveData` still read as before. Not seen on the edits after it.
- **BN-137 — a verse quoted in a modern wording is given the KJV's**
  (2026-11-11, the BN-130..132 read, both readers). A lesson on
  Philippians 4 said Jesus "emptied himself" -- Philippians 2:7 as a
  modern translation words it; the KJV reads "made himself of no
  reputation" -- and the read before it had John 1:14 as "became flesh".
  Verses outside the passage, quoted from memory: one naming no reference
  is read by no check (BN-110/132 read a CITED quote), and two words are
  under the passage misquote check's (BN-76). Now the window holds a table
  of the wordings of the verses quoted most -- 44 of them, John 3:16's
  "one and only Son", Proverbs 3:5's "with all your heart", Isaiah 40:31's
  "soar on wings like eagles" ... -- each with the KJV's words and its
  verse, held to the app's own KJV by a test (`lessonKjvWordingHelpers.ts`).
  In a note whose verses are the KJV's (`checkIsKjvNoteEdit`), a
  quotation holding one is given the KJV's words in place, and the model
  is told so under the change (`genKjvWordingNote`) -- only where the
  quotation's other words are mostly that verse's, so a hymn's "emptied
  Himself of all but love" stays.
- **BN-138 — the woe on the towns said OF them** (2026-11-11, the
  BN-130..132 read, Opus: an error; Sonnet unsure). The Good Samaritan's
  background, from the verses before it (Luke 10:1-24): "Jesus had just
  spoken to the people of Capernaum". "Thou, Capernaum" is said of the
  town to the seventy as he sends them out. A word-table entry, keyed on
  Chorazin (in the two woe passages alone): said of the towns to those
  with Jesus, never to their people.
- **BN-139 — Jesus is not what a phrase of the passage names**
  (2026-11-11, the same read, Sonnet: an error; Opus: a loose reading).
  Psalm 51's Christ section: "He is the 'right spirit' who dwells in us" --
  the spirit David asks God to renew in him. The shape's Pointing to Jesus
  now says never that he IS what a phrase of the passage names where no
  verse says so.
- **BN-140 — a new lesson has twelve rounds** (2026-11-11, shape28).
  The children's Jonah read the whole book, Jonah 4:2, searched twice for
  "a short verse on mercy" and John 3:16, and answered "I looked several
  things up but could not settle on an answer" after 73.3k tokens: no
  lesson in the note. The searches were for a memory verse the window had
  sent back (BN-129, a refusal no network log shows), and a note ask had
  eight rounds. A lesson written into the empty note now has twelve
  (`NOTE_LESSON_MAX_TOOL_ROUNDS`, `watch.isBlankLesson`, both loops):
  its passage, the verses before, a word or two looked up, a refusal or
  two, the write and the answer. Asked again: the lesson in 18 s, 779
  words, a memory verse of 17 (Psalm 136:1).
- **BN-141 — a verse's own entry is carried before the words**
  (2026-11-11, the BN-137..139 read, Sonnet: an error). David and Goliath:
  "the stone found the only gap in the giant's armour" -- the sermon's gap
  the word table had answered since BN-115 ("sunk into his forehead": the
  text gives no gap; he wore an helmet of brass). The entry never reached
  the model: 1 Samuel 17 holds eight of the words (shekel, sling, cubit,
  span, uncircumcised, prove ...) and the list was cut at eight in table
  order, where the verse entries stand last. An entry keyed on words of
  one verse -- what that verse does not say -- now outranks one keyed on a
  word, the eight still given in table order (`checkIsVerseEntry`): 1
  Samuel 17's read carries the forehead entry and "the armies of the
  living God".
- **BN-142 — a sermon's detail no verse gives is named under the
  change** (2026-11-11, the BN-137..139 read, both readers). The errors
  left were details told in many sermons and given by no verse: both Good
  Samaritan lessons had Jesus "just spoken to the people of Capernaum"
  (Opus) -- with BN-138's word-table entry in front of the model -- the
  stone "found the only gap in the giant's armour" (both), David hid his
  sin "for a year" (Sonnet), the father "upset" with the elder son (Opus,
  a loose reading), and in ab26 the sign of Jonah told to Jesus' "friends".
  A correction the model is shown is a suggestion; these are now read off
  the lesson's own words (`lessonLegendHelpers.ts`): the story in the
  lesson, who it is about and the claim in one sentence -- so Capernaum
  in a lesson on Mark 1, where he did teach, and "a gap in our armour" in
  one on Ephesians 6 stay -- and each found is named under the change with
  what the verses say, once an ask, for ONE more edit of that line
  (`findLessonLegends`, `genLessonLegendNote`, BN-134's way: refused,
  a whole lesson is written again or not at all).
- **BN-143 — a child's memory verse too long is named under the
  lesson** (2026-11-11, shape29). A children's Lost Sheep lesson read its
  passage, searched twice for "a short verse", read 1 John 4:10 and
  answered "could not settle on an answer" after 62.5k tokens -- nothing
  written, its twelve rounds (BN-140) spent: BN-129 sends the WHOLE lesson
  back for its memory verse, twice an ask, and each time the model searched
  for another. Now the lesson goes in and the line is named under it, with
  up to three verses of the passage read a child can say (6-20 words, each
  with its count: `listShortReadVerses`, `genChildMemoryVerseNote`) --
  one more edit of one line, no search needed. Once the lesson is in, the
  note is no longer empty and its next edit is not held to it again.
- **BN-144 — a passage left to the assistant is chosen** (2026-11-11,
  shape29). The card's lesson pressed, the model asked which passage with
  "Choose one of these" among its options; that pressed, it offered three
  passages again and nothing was written. A reply that leaves the choice
  ("choose one of these", "you pick", "any", "up to you":
  `checkIsLeftToYouAsk`) under a lesson still to write carries
  `NOTE_LESSON_YOU_CHOOSE_HINT`: choose one of the passages offered and
  write the whole lesson now, never ask again.
- **BN-145 — two children's tellings the verses do not give**
  (2026-11-11, the BN-141..144 read, Opus: an error and a loose reading).
  The children's Noah: "when it returned with an olive leaf, Noah knew the
  land was dry" -- the leaf showed the waters abated (Genesis 8:11), the
  ground was dry later (8:13-14), and Noah went out when God said "Go
  forth" (8:15-16). The children's Jonah: "He told the people they must
  stop doing bad things" -- Jonah's whole message was "Yet forty days, and
  Nineveh shall be overthrown" (3:4); the call to turn was the king's
  (3:8). Both join BN-142's table; the Jonah one may find Jonah in the
  sentence before ("This time, Jonah went. He told ..."), and leaves the
  king's decree alone. Over shape27..29's 48 lessons the table names
  every such line the readers flagged, and one more: "God told Jonah to
  ... tell the people to stop doing bad things".
- **BN-146 — a devotion's movements as its points: tried, reverted**
  (2026-11-11, the BN-141..144 read, Sonnet: both devotions Good, "one
  point holding three sub-sections"; every read since BN-98 had asked to
  divide the psalm by its movements). Written with two or three short
  points, one a movement, each its heading, one What it means line and one
  short example (L-11 and C-03 asked again, 551 and 422 words), and read
  blind against the one-point pair: Sonnet 21.50 -> 19.50, Opus 21.00 ->
  20.00. Both readers named the same trade -- the points now followed the
  text (D 1 -> 2), but each explained one phrase, met no hearer's question
  and had a one-line example (E, F, G 2 -> 1), where the one point
  explained, asked and told a full example. Reverted: a devotion keeps ONE
  point that walks its passage. Read twice, the same two one-point
  devotions were 19 and 21-22 to Sonnet: a pair's spread is a reader's.
- **BN-147 — a psalm's title, read with the psalm** (closes BN-122,
  2026-11-11). Every reader since BN-98 asked a psalm lesson's background
  for what its title gives ("add the sons of Korah"). The KJV prints a title
  over 116 psalms and no Bible the app reads carries one. The titles are
  read off eBible.org's public-domain KJV USFM (its \d lines) into
  `src/helper/bible-helpers/bible-data/kjvPsalmTitles.json` (~6 KB), loaded
  only when a new lesson's passage read is a psalm from the KJV
  (`lessonPsalmTitleHelpers.ts`: `readPsalmChapters`, `loadPsalmTitles`,
  `genPsalmTitleNote`), and said over that read beside the verses before
  and the word table: tell the Background from these words and the
  psalm's own, never from memory. Psalm 18's runs into its first verse
  ("And he said,") and Psalm 54's asks a question, as the KJV prints them.
  Read blind (ab30, shape29 -> shape30), Sonnet: both Psalm 46 errors of
  shape29 ("a river of peace", "written for a national crisis") gone, its
  Background now from the title ("upon Alamoth").
- **BN-148 — the cited verses read in one call** (2026-11-11, shape30's
  L-14). The window read every verse a quote names (BN-110, up to eight,
  BN-132) in a call of its own, all at once, and each `owa_find_verse` is
  one of the firewall's 25 acting calls a minute: shape30's L-14, asked
  two minutes after L-13, was refused by the firewall. The single verses
  go in ONE read now (`readCitedVerseTexts`, `MAX_FIND_REFS` a read),
  matched back by the key the read answers each with (`toCitedVerseKey`:
  `Matthew 11:28` -> `MAT 11:28`), whatever order it answers in. A range
  keeps a read of its own: a read shares its letters among its
  references, and a long range cut short is not checked.
- **BN-149 — Christ from the passage's own big-idea phrase** (2026-11-11,
  the ab30 read). Four of the five lessons short of Best to either reader
  lost it at Pointing to Jesus. Told to go FIRST to where the New
  Testament takes the passage to Christ (BN-104), the model found such a
  verse where there is none and quoted one that only shares a theme:
  Revelation 7:9's great multitude under David and Goliath (Sonnet, an
  error), 2 Corinthians 5:20's "God did beseech you by us" read as God
  beseeching through Christ under the unforgiving servant (Opus, an error),
  Psalm 46's river as the "living water" of John 7:38 (both, word
  association), Jesus as the sower's "perfect Seed" (Opus). Both readers
  asked for a link "grown from" the passage's own words -- "the battle is
  the LORD's", "the LORD of hosts is with us", the king's "I forgave thee
  all that debt". Pointing to Jesus now starts from the phrase of THIS
  passage that carries its big idea (in a Gospel, what Jesus himself says
  or does in it) and goes where its meaning leads; a verse from elsewhere
  only where the New Testament itself takes this passage up, never one
  that only shares a theme or a word.
- **BN-150 — a new lesson's hospital example named for one more edit**
  (2026-11-11, the same read). Not one of the 32 lessons' 84 examples named
  its person -- 80 opened "A …" ("A person" in 42) -- and seven were set in
  a hospital, "the hospital waiting room" in six lessons, both devotions'
  among them; both readers scored them as stock. Names were not asked
  back: before BN-95 they had been "Sarah, Mark, Elena" in example after
  example. And naming the hospital in the shape had changed nothing
  (BN-125, BN-129: it is the model's default scene). So the window reads a
  NEW lesson's **For example:** lines (`findHospitalExamples`,
  `lessonStockSceneHelpers.ts`) and names one set in a hospital under the
  change, once an ask, for ONE more edit: a scene of the hearers' own week
  where that point's verses happen again, set where no other example is.
  A funeral message keeps its scene (`checkIsFuneralAsk` on the typed
  words: a hospital can be where its grief is), and an edit the person
  asks for is never second-guessed.
- **BN-151 — a cubit measures height, never weight** (2026-11-11, the same
  read, Opus: an error). "Goliath's armor was measured in 'shekels' of
  brass and 'cubits' of length": the word table's shekel named Goliath's
  armour and its cubit only "a measure of length", and the model gave both
  to the armour. The cubit entry now opens "a measure of length and
  height, never of weight -- Goliath's HEIGHT 'was six cubits and a span'
  (1 Samuel 17:4), the ark's length 'three hundred cubits' (Genesis
  6:15)", each quote checked against the app's KJV.
- **BN-152 — a line named for one more edit is named by its block**
  (2026-11-11, shape31, BN-150's first run). The Psalm 46 devotion's
  hospital example was named under the lesson by its words, and the
  model's one more edit went to block 14 -- the "The passage answers:"
  line above it, written over with the new scene -- while the hospital
  stayed in block 15. A lesson written whole comes back with no block
  numbers, so the model counted its own lines and missed by one. The
  window now reads the note once the change is made (`readNoteBlocks`, a
  reading action the firewall does not count) and names the block each
  line is in (`findBlockNumbers`, by its opening words with labels and
  verse tokens set aside): "block 15: ... change ONLY block 15 -- its words
  alone". The legend note (BN-142) was open to the same miss and names
  its block the same way; a line the read does not find is named by its
  words as before. In the same run the note worked where the example was
  the only one: the Psalm 23 devotion's hospital room became a scene at
  home, one edit. Shape31 is not read blind -- its L-11 lost a line to this
  -- and the batch was asked again as shape32. There the note said "change
  ONLY block 15 -- its words alone", and the model sent the new scene as
  `words` -- the field a style picks words with -- and was refused, three
  lessons of three; it spells the change out now, `{block: 15, text:
  "**For example:** <...>"}`, as the memory verse's note does (BN-143), and
  the legend note the same. Asked again with it (L-04, L-11, C-03): L-11's
  one more edit went to block 15 and its hospital became a scene at home,
  L-04's to block 13; C-03's next reply came back empty.
- **BN-153 — a note changed, then out of rounds, says it was changed**
  (2026-11-11, shape31/32). When the one more edit a note asked for used
  the last rounds up, or the turn after it came back empty, the lesson was
  in the note and the answer read "I looked several things up but could
  not settle on an answer. Try asking about one step at a time." over its
  own Undo and Show buttons. `genOutOfRoundsAnswer` now says what a change
  with no answer says (BN-36): "“Lesson” was changed, but the assistant
  stopped before saying what it did. Undo this change puts it back." --
  a sentence every language already has. Unclean endings were 0-2 in each
  batch of 16 since shape28; in shape32 both were lessons whose hospital
  note's edit had been refused. The one more turn a note asks for is
  asked of a shared server that sends back an empty reply about one time
  in six (`isDroppedReplyRetried`): a top-up is worth a note only where it
  carries a fault the readers mark.
- **BN-154 — a verse told in Pointing to Jesus is given its own words**
  (2026-11-11, the ab31 read, Sonnet: shape30 -> shape32 21.44 -> 21.13,
  errors 0 -> 3). All three errors were in Christ sections that now opened
  on the passage's own phrase (BN-149) and then told a verse of another
  book in the model's words: "Jesus tells His followers that whoever abides
  in Him will find rest [^Matthew 11:28]" (the verse says "Come unto me"),
  the Pharisees "unclean" and "full of greed" [^Matthew 23:25] ("extortion
  and excess"), and Psalm 46:8's "desolations" as our sin. The shape says
  such a verse is quoted as it reads; BN-110 holds a QUOTATION to its
  verse, and a verse told without quotation marks was held to nothing. A
  NEW lesson's Pointing to Jesus is now read for a line naming a verse of
  another book than its passage's -- a token or a reference in brackets --
  that quotes nothing (`findUnquotedChristVerses`,
  `lessonChristVerseHelpers.ts`, two at most); the window reads those
  verses (one call, BN-148) and names each line under the change by its
  block (BN-152) with the verse's own words, for one more edit that quotes
  it word for word or says only what it says. A word-overlap test was
  weighed and left: an accurate paraphrase in other words ("rose from the
  dead" for "risen from the dead") fails it, and the shape asks for the
  quotation anyway. Seen in shape33: the Proverbs 3 sermon's "In the
  Gospels, Jesus says ..." line was named, and the one more edit quoted
  John 14:6 word for word; no Christ section carried an error to either
  reader of ab32.
- **BN-155 — a child's memory verse is offered from its own passage**
  (2026-11-11, the ab32 read, Sonnet: L 0 on the lost sheep). The children's
  lesson on Luke 15 took Luke 14:34 as its memory verse -- "Salt is good:
  but if the salt have lost his savour" -- from the shorter verses BN-143
  offers when a memory verse is too long: the offers came from every read
  of the ask, the verses the window reads just before the passage for its
  background (BN-89) among them, and "lost" was the big idea's word. With
  the lesson's passage known (`readLessonPassageRef`), only its own verses
  are offered now (`listShortReadVerses`' `passageRef`, a whole chapter,
  chapters and a span over chapters read alike); "Psalms" is a book name
  the window reads too.
- **BN-156 — David's own reason for the armour, and Jonah's errand**
  (2026-11-11, the ab31 read, Opus). An error in both runs it read: "Why
  did David refuse the sword and spear?" answered "He wanted the world to
  know that the battle is the LORD's" (shape32) and "so that the
  Philistines would know that the Lord saves not with sword and spear"
  (shape30) -- 1 Samuel 17:39 gives his own reason, "I cannot go with
  these; for I have not proved them", and 17:47 is what he says to
  Goliath. And both children's Jonahs had him "come out to save Nineveh"
  (loose to Opus): he was sent to "cry against" it. Both are in the legend
  table now (`lessonLegendHelpers.ts`): the armour's reason only where
  David or "he" gives one and the verse's "not proved" is not said, never
  a hearer's "take off your own armour so that others see".
- **BN-157 — a line fixed keeps the rest of its block** (2026-11-12, the
  ab32 read, Opus). The children's Jonah fell 23 -> 18 ("tells the story
  of Jonah in one sentence"): its story block, a dozen sentences, held the
  legend "tell them to stop doing bad things" (BN-145), and the one more
  edit the note asked for -- aimed at the block by its number since BN-152
  -- sent the block back as that one sentence corrected. The Proverbs
  sermon's Christ section became a bare quote of John 14:6 the same way
  (Opus: I 0). Where a named line sits in a block that holds more (eight
  other words or more, `toLineFixBlock`), the note now quotes the block
  and asks it back whole, "every word of block 9 as it reads now, only
  that one sentence changed" (`genWholeBlockNote`), and an edit that would
  leave the block less than half of its other words is refused once an
  ask with the block quoted (`checkKeepsBlockWords`,
  `genLineFixRefusal`). An example line is its own block, so the hospital
  note (BN-150) is untouched. Seen in shape34: the children's Jonah kept
  its three-paragraph story (Opus 19 -> 21, Sonnet 20 -> 23) and the
  Proverbs sermon's Christ block kept its words with John 14:6 quoted in
  them.
- **BN-158 — the Beatitudes' hearers, the tormentors, and "this do"**
  (2026-11-12, the ab33 read). Both readers' one error: a Psalm 51
  sermon's Christ section, "Jesus tells the Pharisees that 'blessed are the
  poor in spirit'" -- Matthew 5:1-2 has him teach them to his disciples on
  the mount; in the legend table now, only where the telling is TO the
  Pharisees. And two softenings Opus marked down: the tormentors read as
  "those who refuse to forgive lose the joy and peace" (the entry adds
  "never softened into a loss of joy or peace"), and the Good Samaritan's
  "this do, and thou shalt live" as "eternal life is earned ... by doing
  what the law commands" (24 -> 18; the lawyer's entry adds "the law's
  own answer to one who asked to inherit by doing, never told as eternal
  life earned by our doing").
- **BN-159 — the lawyer had no crowd** (2026-11-12, the ab34 read, Sonnet:
  an error; Opus had marked it down in ab32 and ab33). The Good
  Samaritan's background gave the lawyer an audience Luke never names:
  "speaking to a crowd that included both his peers and the disciples"
  (shape33), "speaking to Jesus in front of a crowd" (shape35). In the
  legend table now, only in a sentence about the lawyer: Luke 10:23-25 --
  Jesus "said privately" to his disciples, then "a certain lawyer stood
  up, and tempted him".
- **BN-160 — a quotation names the verse it comes from** (2026-11-12, the
  ab34 read, Opus: an error). A Revelation 21 funeral message's Christ
  section: "provides the water of life freely [John 4:14]" -- its own
  passage's words (21:6) given another verse's name. BN-113 lets a
  quotation of what the ask read be whatever it names beside it, so the
  window never read John 4:14. Now such a quotation -- its words in a read
  verse of ANOTHER book than the one it names, never in a read of its own
  (`pickMisattributionCandidates`, three at most) -- has its named verse
  read in the same one call (BN-148), and when that verse lacks the words
  the line is named under the change by its block with the verse they
  come from ("'the water of life freely' is Revelation 21:6's words, not
  John 4:14's", `findCitedMisattributions`, `genCitedMisattributionNote`),
  once an ask, for one more edit. A misquote is still refused first
  (BN-110).
- **BN-161 — the LORD's desolations, a stone's "only vulnerable spot", and
  Psalm 51:11's reason** (2026-11-12, the ab31..ab35 reads, both readers).
  A Psalm 46 lesson's Christ section had Jesus take "the desolations" of
  the cross, of our sin, of the earth upon Himself in three runs -- 46:8's
  desolations are "the works of the LORD" that make "wars to cease"; the
  legend table names that line now. Goliath's legend took "the only gap
  in his armour" but not "God directed it to the only vulnerable spot on
  Goliath's head" (no armour named, ab35 Opus: an error); its claim takes
  an only/one/single vulnerable, weak or exposed spot too. And the Psalm
  51:11 gloss's "departed from Saul ... what David begs God not to do to
  him" was told as the psalm's own reason (ab33, ab35): the gloss now
  says the Spirit came on David at his anointing and that the psalm gives
  no other reason and names no one else it was taken from.
- **BN-162 — five more lines no verse gives** (2026-11-12, the ab35 read,
  both readers). The legend table names: the LORD of hosts as "the
  protector of the God of Jacob" (Psalm 46:7, 11: he IS the God of
  Jacob, our refuge); Jonah 3:10 cited for God being "merciful" (the word
  is Jonah's in 4:2; a line naming 4:2 is left); "this miracle drew a
  multitude that followed Jesus into Jericho" (18:36: the multitude was
  passing before the healing); Zacchaeus's "little of stature" told as a
  picture of his low standing (19:3 is his height; 19:7 is what the
  people said); and the Sower's "scorched" seed told of Christ and his
  cross (13:6, 13:21: the rootless hearer). Each matches its own story's
  lessons only, the person and the claim in one sentence.
- **BN-163 — a word of the passage put on Christ, and David's own
  "because"** (2026-11-12, the ab35 and ab36 reads). Opus scored Pointing
  to Jesus 1 of 2 in 13 lessons of 32 for one habit: a word of the
  passage, quoted, made Christ's work -- "He took the "tormentors" of
  judgment upon himself" (Matthew 18:34, the king's), "He is the ultimate
  "river" of living water" (Psalm 46:4), "provides the "lovingkindness""
  (Psalm 51:1), "allowed himself to be "scorched"" (the rootless seed).
  Now a Pointing to Jesus line where a verb makes a quoted word his (took,
  bore, carried, became, provides, allowed himself to be, is the ultimate)
  and the passage as the ask read it holds that word
  (`findStretchedChristWords`, `readPassageVerseWords`) is named under the
  change like a legend, for one more edit; a word the passage lacks
  (John's "good shepherd") is BN-154's, and what the Scriptures say he
  bore -- sins, iniquity, griefs, the curse, guilt -- is left. And David's
  armour entry takes a "because" of the lesson's own ("because they are
  not the tools God used", ab36 Opus, A 1), verse 39's "not proved" left.
- **BN-164 — a new block given no place goes after the one added before
  it** (2026-11-12, shape38's L-07). A whole lesson written as new blocks
  in one `owa_note_edit` edit had one change with neither `block` nor
  `after`; the tool refused the call ("A change needs `block` … or
  `after`"), and the model ran out of rounds with nothing written. The
  refusal shows up in most batches (shape30-38) and usually costs a round.
  The tool's own rule is that several new blocks after one block go in
  the order given, so a change with words or a kind, no `block`, not a
  removal, right after an add now takes that add's `after`
  (`placeUnplacedAdds` in `agentNoteBlockHelpers.ts`); a bare style with
  no block, or one after a change to a block, is still refused.
- **BN-165, BN-166 — three references the readers caught twice**
  (2026-11-12, the ab35..ab37 reads). A Zacchaeus lesson's publican
  "often counted with sinners [^(KJV) Luke 3:12-13]" (ab35 Opus, ab37
  both: Luke 3:12-13 is the publicans asking John what to do; Luke 5:30
  and 15:1-2 name them with sinners), the Jericho healing as Luke
  18:34-43 (ab37 Opus: 18:34 is the twelve who "understood none of these
  things"), and Isaiah 40:23 made one phrase, God "makes the princes of
  the earth as vanity" (ab36 Opus an error, ab37 A 1: the princes are
  brought to nothing, the judges made as vanity). Each is a legend-table
  entry now, named under the change for one more edit; the verse cited
  for what it says, and 40:23 as it reads, are left.
- **BN-167 — who heard a saying, and when** (2026-11-12, the ab38 read,
  Opus). Both of shape39's errors were a saying of another book in
  Pointing to Jesus given the wrong hearers or hour: Jesus "made him live
  again, saying, "I am the resurrection"" (John 11:25 is said to Martha on
  the way, before the grave; at the grave he cried "Lazarus, come forth",
  11:43), and Jesus "eating with sinners and telling them that "They that
  be whole need not a physician"" (Matthew 9:11-12: said to the
  Pharisees). With BN-158's Beatitudes "told to the Pharisees" it is the
  third such slip. Legend entries for the two, and for Proverbs 3:3 made
  one phrase ("bind … upon the heart": bound about the neck, written upon
  the heart, A 1); a line naming Martha, the Pharisees or the neck is left.
  If the kind keeps coming in other verses, the window could read a cited
  saying with the verses before it and show who heard it.
- **BN-168 — the newest add places it, and a refusal names the one**
  (2026-11-12, shape40's L-05). With BN-164 in place, a lesson written
  whole was still refused twice ("A change needs `block` … or `after`")
  and the ask ran out of rounds; the change with no place lay past the
  1 500 characters the batch log kept of a call. Now a change with words
  or a kind and no place goes after the same block as the NEWEST add
  before it, whatever came between (`placeUnplacedAdds`); with no add
  before it, the refusal names it by its first words, so the next call can
  place that one (told only "a change needs", the model had sent the same
  call again); and `run-lesson-asks.mjs` keeps a refused call's arguments
  whole. The lesson rerun: 10/10.
- **BN-169 — the call's own fields written as a change are the call's**
  (2026-11-12, shape41's L-04, the reproduction batch). A whole lesson's
  edit ended its `changes` with `{hash, note}` -- the call's own fields as
  one more item -- and was refused for a change with no place; the model
  ran out of rounds with nothing written (seen whole now that the batch
  log keeps a refused call, BN-168). `takeMisplacedCallFields` takes an
  item holding only the call's fields (`action`, `bible`, `file`, `hash`,
  `id`, `note`, `page`, `title`) out of `changes`, a `title` in it becoming
  the call's when the call names none; an item with any field of a
  change's own stays a change. The lesson rerun: 10/10.
- **BN-170 — the reproduction's misses** (2026-11-12, the ab40 read: shape41,
  the same code as shape40, did not hold 16 / 16 for Opus). Legend entries
  for David as armourbearer "while the Philistines gathered" (17:13-15: he
  was home feeding the sheep until Jesse sent him) and for Matthew 18
  answered "when a brother repents" (Luke 17:3's condition; "God forgives
  us when we repent" is left); BN-162's Zacchaeus entry takes "mirrors his
  social standing". And the funeral message, the lesson both readers marked
  down most across ab36..ab40 (L 1: no questions; G 1: a This week only to
  hold): BN-90's "never a task" had been read as nothing to do, so its This
  week is now one gentle thing to do with the comfort -- a promise read
  aloud each evening, sitting with another who grieves -- never a duty or a
  fix, and in place of questions for discussion two or three quiet
  Questions for reflection on the passage's promises.
- **BN-171 — passages closed by a line asking for another are still its
  buttons** (2026-11-12, shape42's C-02, twice). The empty note card's
  children's lesson: the model offered three passages and closed them with
  "Or please let me know if you have another passage in mind!" -- no
  question mark, so BN-97's reader (a closing QUESTION that asks to choose)
  drew no button, the runner had no passage to press, and the lesson was
  never written. A short closing line (160 letters at most, ending a
  sentence) that asks for another passage, story, verse, subject or one
  "in mind" now closes the list as that question does
  (`ANOTHER_CHOICE_PATTERN` in `quickReplyHelpers.ts`). The lesson rerun:
  10/10.
- **BN-172 — the lawyer's crowd, named "a legal expert"** (2026-11-12, the
  ab41 read, Sonnet: an error in shape42). "In this setting, a lawyer
  stands up to tempt Jesus. He is a legal expert of the Jewish law,
  speaking to Jesus in front of a crowd." BN-159's entry wanted "lawyer"
  in the sentence with the crowd; it now also takes "a legal expert", "an
  expert in the law", and the lawyer named in the sentence before, with the
  claim narrowed to the speaking (to / in front of / before a crowd, his
  peers, an audience) so an example's crowd after a line on him is left.
- **BN-173 — no "if" on Jonah's message, no apology in the fish, and the
  reason Jesus gives Zacchaeus** (2026-11-12, the ab41 read, Opus). A
  children's Jonah had God destroy Nineveh "in forty days if they did not
  stop" (3:4 has no condition) and Jonah "said he was sorry" inside the fish
  (2:1-9 is a cry heard, a look toward the temple, thanks and a vow); a
  Zacchaeus lesson had salvation come "because the change in his heart led
  to a change in his actions" (19:9: "forsomuch as he also is a son of
  Abraham", A 1). The Jonah 3:4 entry takes a condition on the forty days;
  new entries for the apology and for a reason of works given for 19:9 (a
  line naming the son of Abraham is left).
- **BN-174 — "whenever", "asks for forgiveness", and the children's
  points** (2026-11-12, the ab42 read). Matthew 18 answered "when a brother
  sins and asks for forgiveness … whenever a brother repents, the count
  starts over" (Opus: an error) slipped past BN-170's entry, which wanted
  "when" and "repent": it takes "whenever", asking for forgiveness, saying
  sorry and apologising now. And the children's lesson (Sonnet Good at 17
  on a Jonah that printed only 3:10, a point with no verses under it, and
  memory verses from Psalm 103:8, Nehemiah 9:31 and 2 Chronicles 7:14 across
  the reads): its two points are each under the token of the story's own
  verses, and its memory verse is from the story itself when one of its
  verses says the big idea, else from elsewhere.
- **BN-175 — a child's memory verse named by its block** (2026-11-12, the
  ab43 read, Sonnet: shape44's children's Jonah Needs work at 15). The
  lesson went in with 1 John 4:16 as its memory verse; the window's note
  (BN-129/143: too long for a child, short verses of the passage offered)
  told the model to change "the memory verse's passage block" as
  `{block: <its number>, …}`, and the model counted its own blocks and
  changed two headings -- the Memory verse heading became the verse token,
  the Pointing to Jesus heading took its whole paragraph -- the lesson left
  with a wrong-headed memory verse and a paragraph twice. As BN-152 did for
  the legend notes, the note now names the block, read off the note once
  the change is made (`findMemoryVerseBlock`: the first block with words
  after the Memory verse heading; `withMemoryVerseBlock`).
- **BN-176 — a heading kept a heading never takes a paragraph's words, and
  the Levite's temple** (2026-11-12, the ab43 read). The children's Jonah
  that went Needs work in both reads had its second edit change block 26
  (the Pointing to Jesus heading) and block 36 (the Memory verse heading)
  with the words of the blocks under them -- a heading made a 60-word
  paragraph, another a verse token. `owa_note_edit` now refuses a change
  that keeps a heading a heading but gives it more than 20 words or a verse
  token alone, naming the block under it (`readHeadingWordsReason`); a
  heading's own words, or a `kind` given, go in as before. And the legend
  table names a Levite who "served in the tabernacle" in the Good
  Samaritan (Opus A 1 twice: in Jesus' day, the temple; a line naming
  Moses or the wilderness is left).
- **BN-177 — the battle is the LORD's, David's prayer, the cross, one
  plea each, and the eagles' strength** (2026-11-12, the ab44 read, Opus:
  three errors and three details in shape45, where Sonnet read all 16
  Best). The KJV wording table (BN-137) puts "the battle is of the LORD"
  back to 1 Samuel 17:47's "the battle is the LORD's"; legend entries for
  "the grave was the place where Jesus died" (Matthew 12:40: the heart of
  the earth; he died on the cross), Psalm 51:17 told as God's word to David
  (it is David's prayer), the servant who "asked for patience twice" (each
  asked once, 18:26 and 18:29), and the eagles' wings "to see things from
  his perspective" (40:31: strength renewed).
- **BN-178 — the press kept Zacchaeus back by his height** (2026-11-12,
  the ab45 read, Sonnet: A 1 in shape46's Zacchaeus lesson, its one
  lesson short of Best): "because of who he was, the people would not
  have made room for him". Luke 19:3 gives its own reason, "because he
  was little of stature"; a legend entry names a crowd that would not
  make room or way, for who he was or for his trade, and quotes the verse.
- **BN-179 — no saying of Jesus joins abiding and rest** (2026-11-12, the
  ab45 read, Opus: an error, shape46's Psalm 46 devotion Needs work at
  18): "In the Gospels, Jesus tells his followers that whoever abides in
  him will find rest" -- John 15:4-5's abiding (fruit) and Matthew 11:28's
  rest (for those who come) made one saying. A legend entry names a line
  that abides and finds, has or is given rest, and quotes both verses.
- **BN-180 — the call's own `title` reached the app as `{}`** (2026-11-12,
  shape47's first L-03: a whole Psalm 51 lesson refused twice, "A change
  needs `block` … or `after`", and the ask ended with nothing written).
  The model wrote `{"title": "Lesson on Psalm 51"}` as the last change;
  BN-169 gives such an item back to the call, but `owa_note_edit`'s change
  schema was a strict `z.object`, which drops every field it does not
  list, so the app got an empty object no rule could place or name. The
  schema is a `z.looseObject` now (the app reads only the fields it
  knows), and `takeMisplacedCallFields` drops an item with nothing in it.
  Run again on a fresh profile with the host relaunched: all 16 lessons
  10 / 10, L-03 in one edit.
- **BN-181 — Paul's letter is no Gospel, and the tormentors are the
  servant's** (2026-11-12, the ab46 read): the Philippians 4 lesson's
  Christ line "In the Gospels, Jesus showed the ultimate abasing when He
  emptied Himself, taking the form of a servant [Philippians 2:5-8]" --
  Needs work by both readers in shape47, by Opus in shape46 too, noted in
  ab45: the same line three batches running. And Matthew 18's "Christ was
  delivered to the tormentors of the cross for us" (Sonnet, A 1): 18:34's
  tormentors are the unforgiving servant's. Two legend entries: "in the
  Gospels" beside an epistle's name or Philippians 2's words, and the
  tormentors put on Christ or the cross (1 Peter 2:24 named for it).
- **BN-182 — "the sacrifices of God"** (2026-11-12, ab46, Opus: A 1):
  Psalm 51:17 quoted "the sacrifice of God"; the KJV wording table puts
  the plural back.
- **BN-183 — Revelation 21 names no one waiting** (2026-11-12, ab46,
  Sonnet: A 1 in shape46's funeral message; ab45's Sonnet asked for the
  same line out): "the one person you miss most is waiting there with a
  smile". A legend entry names a missed or loved one waiting and gives
  21:3-4, with 1 Thessalonians 4:17 for meeting again those who died in
  Christ; a home "waiting for them" (John 14:2's picture) is left alone.
- **BN-184 — a psalm with no occasion is set in its writer's own story**
  (2026-11-12, ab45..ab48, both readers): the Psalm 23 devotion's
  Background was "This is a Psalm of David" and one sentence in every
  batch, C 1 by each reader, and 19 (Good) in shape49's Sonnet read -- the
  prompt's "where the Bible tells its story" had nothing to point at under
  a title that names no occasion. Such a psalm now takes what the Bible
  tells of the writer it names that its own pictures come from, read and
  quoted (David "keepeth the sheep", 1 Samuel 16:11; the lion and the
  bear, 17:34-35).
- **BN-185 — a height that "hints at" nothing, and no anger in the lost
  sheep** (2026-11-12, ab48, Opus: A 1 twice, each lesson's one step short
  of Best): shape49's Zacchaeus "little of stature means he was physically
  short, but it also hints at how he was viewed by the community" (BN-162's
  words lacked "hints"), and shape48's children's lost sheep answering
  "Does God get angry when we are lost?" with "No" (told before as "he did
  not get angry", Sonnet noted it in ab46). The stature entry takes
  "hints", "suggests" and "how he was viewed"; a new entry, keyed to "ninety
  and nine" so a prodigal lesson naming "a lost sheep" is left alone, names
  anger told or denied and gives 15:5-7's joy.
- **BN-186 — the text as it reads: the lawyer, the rage, the son, the
  care, the cross** (2026-11-12, the ab49 read): what kept lessons from
  Best in shape49 and shape50 was each one claim the verses do not make.
  "On the cross, he was delivered to the tormentors" (Sonnet: an error;
  BN-181's entry wanted Christ named or the cross after), "The lawyer
  cannot even bring himself to say the word Samaritan" (Sonnet: an error,
  Opus: A 1), Psalm 46's "Jesus ... taking the rage of judgment upon
  Himself" (Opus: A 1; 46:6's raging is the nations'), the prodigal who
  "stopped blaming his circumstances" (Opus: A 1), and "Paul says his
  care of me hath flourished again" (Opus: A 1; 4:10's care is the
  Philippians'). The tormentors entry takes the cross first; four new
  entries name the rest. Run over the 128 lessons of ab46..ab49 they find
  only those lines and their twins in other batches.
- **BN-187 — man formed of dust, and Jonah's own reason** (2026-11-12,
  the ab50 read, Sonnet: two errors in shape51): Isaiah 40's "Creator of
  the ends of the earth ... meaning he made everything from the dust of
  the ground [Genesis 2:7]" (2:7 is man), and a children's Jonah's "Jonah
  did not want to go because the people there were mean" (4:2 gives his
  own reason: God is gracious and merciful). Two legend entries; over the
  192 lessons of ab45..ab50 each finds only its line. The same Jonah lesson
  had a heading "## S Memory verse" and a "**Big idea:**" label in its
  Response -- a model's slip, seen once, noted and left.
- **BN-188 — points begin where their passage begins** (2026-11-12, the
  ab50 read, Opus: shape51's Good Samaritan Good at 18, "vv25-29 have no
  point", and "both Good Samaritan lessons skip vv25-29"): every batch
  prints Luke 10:25-37 and its points begin at 10:30, so the lawyer's
  question the parable answers is in none of them. BN-83's check
  (`findLessonPointsProblem`) held the points to the passage's END and
  order, never its start; it now names points that begin three verses or
  more into their passage (`lead`), and the refusal asks for the first
  point to start where the passage starts. The sower's two setting verses
  (Matthew 13:1-2) and Matthew 18's Peter question (two verses) stay under
  that bar.
- **BN-189 — each saying to its own verse and its own book** (2026-11-12,
  the ab51 read, Sonnet: three errors in shape52 and an A 1 in shape51):
  "In the Gospels, Jesus ... though being rich, 'for him poor became'"
  (2 Corinthians 8:9, misquoted and called a Gospel -- BN-181's entry knew
  only Philippians 2's words), "the Holy One who created the stars and
  brings princes to nothing [Isaiah 40:25-26]" (the princes are 40:23), a
  Levite "appointed to serve the temple [Numbers 3:10]" (3:10 is Aaron and
  his sons), and "the Father requires that we 'from your hearts forgive
  not every one'" (18:35's warning quoted as what he asks). The Gospels
  entry takes 8:9's words and quotes it; three new entries quote 40:23,
  Numbers 3:9 with 1 Chronicles 23:28, and 18:35. Over the 224 lessons of
  ab45..ab51 they find only those lines and one twin.
- **BN-190 — the same promise is not the very words** (2026-11-12, the
  ab51 read, Opus: an error in shape52's Isaiah 40 lesson): "In the
  Gospels, Jesus uses these very words to invite us: 'Come unto me ...'
  [Matthew 11:28]" -- 11:28 makes Isaiah 40:29's promise in other words.
  A legend entry names "these very/exact words" or "the same words" said
  of Jesus or Christ outside a quoted verse (the first cut, any "these
  words", found ten settings like "Jesus spoke these words to the
  Pharisees", Revelation 21:5's own "these words are true" and 1 Samuel
  17:23's "the same words" in printed passages); over ab45..ab51 it finds
  that line alone. Both readers named where the errors now are: every one
  in side material -- a cross reference, the background, the Christ
  section -- never the printed passage.
- **BN-191 — a named line the next edit left is named again** (2026-11-12,
  the ab52 read, Sonnet: shape53 10 / 16, three errors). Zacchaeus's
  "little of stature ... describes both his physical height and his low
  standing" was in the finished lesson though BN-162's entry finds it: the
  legend note is said once an ask, and the model's one more edit fixed the
  two other lines it named (blocks 10 and 30) and left that one. The edit
  after a legend's note now has the note read again
  (`findLessonLegendsLeft`, the window's `readNoteBlocks`), and a line the
  window named and the edit left is named once more
  (`genLessonLegendNote(…, true)`, "it left a line the window named"),
  once an ask (`isLessonLegendLeftChecked`). The same read: "Jesus uses
  these SAME words" (BN-190's narrowing had dropped "same"), and 1 Samuel
  17:45 told as "with a sword, and a spear, and a javelin" -- a modern
  translation's list, not quoted, so a legend entry for the triad beside
  two KJV wording entries for when it is quoted.
- **BN-192 — the law's own fourfold, and men who rowed hard** (2026-11-12,
  the ab52 read, Opus: two more errors in shape53): Zacchaeus's "fourfold
  means to pay back far more than the law required [Exodus 22:1]" (22:1
  asks fourfold for a sheep; the law that asks less is Numbers 5:7's fifth
  part), and a children's Jonah's sailors who "helped him by throwing him
  into the sea" (1:13-14: they rowed hard not to). Two legend entries; over
  the 256 lessons of ab45..ab52 they find only those lines.
- **BN-193 — Zacchaeus climbed, and Jesus called him down** (2026-11-12,
  the ab53 read, Sonnet: shape54's one error): "Just as Jesus climbed the
  social ladder to find a lonely tax collector" (Sonnet noted the same in
  ab38). Luke 19:4-5: Zacchaeus climbed; Jesus "said unto him ... make
  haste, and come down". A legend entry names Jesus or Christ climbing
  in a Zacchaeus lesson; over the 288 lessons of ab45..ab53 it finds that
  line alone.
- **BN-194 — he gives of the fountain, and the verse as it reads**
  (2026-11-12, the ab53 read, Opus: A 1 twice): a funeral message's "He
  is the 'fountain of the water of life' [Revelation 21:6]" (three
  batches; 21:6 has him GIVE of the fountain) and "ninety and nine who
  think they need no repentance [Luke 15:7]" (two batches; the verse
  says "just persons, which need no repentance"). Two legend entries;
  over ab45..ab53 they find only those lines.
- **BN-195 — lost is the reason, and want is need** (2026-11-12, the ab54
  read, Sonnet: shape55 14 / 16, no counted error, two A 1s): a children's
  lost sheep's "He did it because the one lost sheep was in danger" (15:4
  gives that it is lost) and Philippians 4's "want not as a lack of money,
  but as a state of dependency" (4:12 names hunger and need). Two legend
  entries, the first held to a line about the sheep or the shepherd (a
  child who hides "because they are scared" in an example had matched);
  over ab45..ab54 each finds only its line. "Jesus said, I have found my
  sheep" was left: he does say it, in the parable, and eight lessons write
  it with no reader counting it.
- **BN-196 — judged by their works, the book of life apart** (2026-11-12,
  the ab54 read, Opus: an error in shape55's funeral message): its
  Background told "the dead were judged according to the book of life"
  -- Revelation 20:12 says "according to their works", and the book of
  life is who is not cast out (20:15). A legend entry; over ab45..ab54
  it finds that line alone.
- **BN-197 — a new lesson's parts left out are named under it**
  (2026-11-12, shape56's C-02: a children's lost sheep, 8 / 10 on the
  mechanical checks, written to its memory verse with no Pointing to
  Jesus, response, prayer or questions, 515 words). Nothing held a new
  lesson's first write to the shape's PARTS (BN-83 holds its points to the
  passage). `findMissingLessonParts` reads the parts a note that reads as
  a lesson (a point and three named parts) lacks and groups them by the
  block each goes after -- before the next part of its side that is
  there, a part before the points before the first point -- and
  `genMissingLessonPartsNote` names them under the write for ONE more
  edit, once an ask. The change itself is read first; the note is read
  for its block numbers only when a part is missing, so a whole lesson
  costs no extra read.
- **BN-198 — what the son said, and what the sailors did** (2026-11-12,
  the ab55 read, Sonnet: shape57 14 / 16, no counted error, two A 1s): the
  prodigal's "the father ignored the request to be a hired servant" (15:21:
  the son never makes it) and a children's Jonah's "the men feared the
  LORD exceedingly and obeyed [Jonah 1:16]" (they offered a sacrifice and
  made vows). Two legend entries; over ab45..ab55 each finds only its
  line.
- **BN-199 — two true lines the window had named** (2026-11-12, shape58
  read against the legend list): "David refuses Saul's armor because he
  had not tried it out [1 Samuel 17:39]" (verse 39's own reason; BN-156's
  entry let only "not proved" by) and "He was afraid that if he told the
  people to be sorry, God would actually forgive them" (4:2's fear, read
  by BN-145's entry as what Jonah preached). Each entry's exception takes
  them now, so a model is no longer told to make a true line over.
- **BN-200 — the battle quoted as "of the LORD"** (2026-11-12, ab56,
  Sonnet: shape58's Goliath, Good for one error): "declaring that the
  battle is "of the LORD" [1 Samuel 17:47]" -- only the end in quotes, so
  BN-177's KJV wording, which reads inside a quotation, never saw "the
  battle is of the LORD". A legend entry names the line under the change
  with the verse's own words ("for the battle is the LORD's"); scanned
  over ab45..ab56, it finds that line alone, and leaves Jonah 2:9's
  "Salvation is of the LORD" be.
- **BN-201 — the kiss far off, and three gifts given to three kinds of people**
  (2026-11-12, ab56, Opus: two A 1s in shape58): the children's prodigal,
  "the father "ran, and fell on his neck, and kissed him" while the son
  was still "a great way off"" (15:20: SEEN a great way off, then run
  to -- the same line in nine batches since ab30), and Isaiah 40:31 as
  "some "mount up," some "run," and some "walk"" (all three are promised
  to "they that wait upon the LORD"). Two legend entries name them;
  scanned over ab30..ab56 they find those lines alone, and leave "some
  days we mount up; on others we walk" be.
- **BN-202 — Isaiah's hearers put in Babylon, the sheep sought because it
  was special, Jonah's message of salvation** (2026-11-12, ab57, Opus: the
  one miss in shape59 and two in shape58). "Isaiah wrote these words to
  the people of Israel who were in exile in Babylon, having been told that
  the king's house would be carried away" (39:6 is days to come; 40:2
  speaks to Jerusalem) -- the stock background line of every Isaiah 40
  lesson since ab32, gets an entry of its own, "facing exile" let by;
  BN-195's lost sheep takes "because the one that was lost was
  special / precious / important", and BN-156's Jonah "to bring a
  message of salvation / mercy to Nineveh" (3:4: "Yet forty days").
  Scanned over ab30..ab57, each finds those lines alone.
- **BN-203 — two named lines shape60 left, and why** (2026-11-12, the
  finished lessons read against the legend list before the blind read).
  A funeral's "In the Gospels, Jesus showed he had power over the
  "former things" [^(KJV) Revelation 21:4] by raising Lazarus" was
  named by BN-181's entry for the book in its own verse token -- true,
  and rightly kept; a book named inside a `[^…]` token no longer counts,
  and the entry's three targets still hit by their words. A Goliath's
  fix came as `{edit: [...]}` with no action, refused by the tool's
  schema, and the ask ended with the line left: the window now reads the
  changes under the action's own name as an edit, as it read `changes`
  alone (2026-11-10).
- **BN-204 — a parable explained, a point to each part; two stock
  background slips** (2026-11-12, ab58: shape60 16 / 16 by Opus, 15 / 16 by
  Sonnet, its one Good the Sower at 19 -- four grounds in three points, the
  third printing Matthew 13:10-23 to reach the passage's end). The lesson
  shape now gives a parable told and then explained a point to each part
  it names, each with the verse that tells it and the verse that explains
  it, the verses between that do neither in the Background. Opus noted
  two lines that run through batches since ab30: Zacchaeus's fourfold
  as "far more than the law required for stolen goods" (Exodus 22:1 asks
  fourfold for a sheep -- BN-192's entry now takes the words without its
  citation), and Philippians 4's "He now turns to the whole church to
  encourage them to stand fast in the Lord" after Euodias and Syntyche
  (4:1 comes first) -- an entry of its own, "we can now stand fast in
  Him" let be. Scanned over ab30..ab58, each finds those lines alone.
- **BN-205 — the shape's own words in a lesson; three readings the text
  does not give** (2026-11-12, ab59, Sonnet: shape61 14 / 16, no counted
  error). A Response read "take the one deed of the final point" and an
  earlier one "commit to the deed of the divided heart": the shape's
  "the deed of the point that carries the big idea", copied. It now
  says what that point's This week line asks, never naming a point or a
  deed. Legend entries: Isaiah 40:31 told as stages ("a gradual
  restoration: first mounting up ... finally walking"), the good
  ground's yields given a reason ("varies according to the grace and
  circumstances of the person"), and Zacchaeus "not too small in height
  to be noticed" (19:3, an error, in three batches since ab30). The
  Sower's four points (BN-204) were read as following "the parable and
  its explanation". Scanned over ab30..ab59, each finds those lines alone.
- **BN-206 — four lines Opus noted in ab59** (2026-11-12: shape61 15 / 16,
  shape60 16 / 16, no counted error). A Psalm 51 lesson's "sacrifices of
  righteousness" (51:19, with burnt offering) given 51:17's broken
  spirit -- its one A 1; the unforgiving servant's Christ section, "so
  that the Father could be moved with compassion" (18:27: the compassion
  comes first; stock since ab33); a Sower's crowd with "some standing on
  the shore" (13:2: the whole multitude); and BN-145's Jonah entry takes
  "tell them to stop their bad ways / their wickedness" beside "stop
  doing". Scanned over ab30..ab59, each finds its lines alone.
- **BN-207 — a short passage's three points; a true publican line let be**
  (2026-11-12, shape62 read against the checks before the blind read). A
  sermon on Proverbs 3:5-6 came in TWO points, one a verse (9 / 10, the
  rubric's three points), where earlier batches printed 3:6 for two of
  three points and both readers marked it: the shape now asks a passage
  of one or two verses for three points from its clauses, never a verse
  printed for two. And BN-165's publican entry named "counted with
  sinners [Luke 5:30], [Luke 15:1-2] and told to exact no more [Luke
  3:12-13]" -- true, kept by the model through both namings; a sentence
  that gives the sinners a verse that says it is let be. shape62 was
  read as it came (L-13 left at 9 / 10, not asked again).
- **BN-208 — a child's memory verse swapped for a longer one went in
  unread** (2026-11-12, ab60, Sonnet: shape62 15 / 16, its one Good the
  children's Jonah at 19 -- Jonah 4:2, sixty words, as the memory verse,
  as in six of the last twelve readings). The window had named the first
  memory verse (BN-129); the model's fix came as `{block: 39, ref:
  "Jonah 4:2"}` -- the note no longer empty, no Memory verse heading in
  the change -- and nothing read it. Now, once named in an ask, the one
  verse an edit swaps in (`findSwappedVerseRef`) is read and counted, and
  named again when over twenty words; and a note with no short verse of
  the passage to offer says the shape's own way, a short verse from
  elsewhere, read first. shape61 read again: Sonnet 12 / 16, the lines
  BN-205 names and three more noted for the next read (a lawyer of
  "high status", the father's "anger", Christ fulfilling the
  hundredfold).
- **BN-209 — five more lines the readers marked in ab60** (2026-11-12:
  shape62 15 / 16 by Sonnet and 14 / 16 by Opus, no counted error by
  either; shape61 read again 12 / 16 and 10 / 16). Christ as "the only
  one who perfectly fulfilled the hundredfold" (13:23: the good
  ground's yield), the lawyer as "a man of high status" (10:25), the
  prodigal's father whose "love was greater than his anger" (15:20:
  none; the elder son is angry, 15:28), Revelation 21:4's "former
  things" of our sin (death, sorrow, crying, pain -- "of sin and death"
  let be: no reader marked it), and Philippians 4:9's "seen in me"
  moved to "seen in the faith" (in shape63 too). A first claim of the
  father's anger read verse 28 printed -- "And he was angry" -- and was
  narrowed to the father. Scanned over ab30..ab61, each finds its lines
  alone.
- **BN-210 — a children's lesson's points carry its big idea; two lines**
  (2026-11-12, ab61: shape63 16 / 16 by Sonnet -- shape62 16 / 16 too, the
  first sweep of two batches by one reader in one read -- and 13 / 16 by
  Opus, one error). Both children's Jonahs at 19 by Opus: points on 1:3,
  2:1-9 and 3:1-3 while the big idea, God's mercy even to Nineveh, is
  told in chapter 4. The shape now asks the two points to carry the big
  idea, the second resting on the story's end where its lesson is told
  there (Jonah's gourd, 4:10-11). Legend entries: Philippians 4:12
  quoted with "plenty" (the error), and the lawyer's 10:37 answer put in
  Jesus' mouth. Scanned over ab30..ab61, each finds its line alone.
- **BN-211 — the exile line named, and back in other words** (2026-11-12,
  ab62, Sonnet: shape64 15 / 16, no error, its one Good Isaiah 40 at A 1
  for "the people of Israel, who had been carried away to Babylon" --
  shape63 the same). Named by BN-202 as "who were in exile", the model
  wrote the same past exile as "had been carried (away) to Babylon",
  over twenty lessons since. BN-202's claim takes that and "already in
  Babylon"; 39:6's "would be carried away" is let be. And Psalm 23:6's
  goodness and mercy "like guards following us home" (shape63's C-03).
- **BN-212 — three errors Opus counted in shape64** (2026-11-12, ab62:
  shape64 12 / 16 by Opus with 3 errors, 15 / 16 by Sonnet with none;
  shape63 read again 15 / 16 by Opus, its miss the lines BN-209, BN-210
  name). A funeral's holy city that "brings everyone home to God"
  (21:3, 7: his people, he that overcometh), a children's Jonah who
  "came out to tell people about God's mercy" (3:4: overthrow; 4:1:
  displeased -- "to save" and "a message of" left to BN-156), and the
  king's compassion "not a feeling of pity" (18:33: "I had pity on
  thee" -- 18:34's wrath "not a feeling of sadness" let be). Each a
  line new to the readers; scanned over ab30..ab62, each finds its own.
- **BN-213 — a point that prints a point above it's verses is sent back**
  (2026-11-12, ab63, Sonnet: shape65 15 / 16, no error, its one Good
  Proverbs 3:5-6 at 19 -- 3:5 printed under points 1 and 2; shape64 16 /
  16 read again). BN-207's words in the shape did not hold it: in every
  batch since ab55 the Proverbs sermon or John 3:16 printed one verse for
  two points, and both readers marked the points. `findLessonPointRepeat`
  reads the verses each point prints on a line of its own -- a chip in a
  sentence is no printing -- and the new lesson's points check refuses a
  repeat once, a short passage too (the cover and order checks skip one
  under three verses): the second point gives its clause in quotes with
  the verse as a chip. Scanned over ab55..ab63, it finds those two
  lessons alone.
- **BN-214 — the Levites as Numbers gives them** (2026-11-12, shape66's
  finished lessons read against the legend list). BN-176's entry named
  "a Levite was from the tribe of Levi, given to the priests to serve the
  tabernacle [Numbers 3:6-10]" -- true, and Opus had marked the other
  way round ("the temple" with Numbers 3) the read before; a line citing
  Numbers 1, 3, 4, 8 or 18 is let be. BN-213 held in shape66: the
  Proverbs sermon's second point quotes "lean not unto thine own
  understanding" with a chip, John 3:16's points 2 and 3 each their own
  clause.
- **BN-215 — Christ made the Sower's good ground, or its Seed** (2026-11-12,
  ab64, Sonnet: shape66 15 / 16, its one error the Sower's Christ section
  "Jesus is the only truly "good ground""; shape65 read again 16 / 16 --
  shape65 now 16 / 16 by Opus and by Sonnet's second read). BN-209 took
  the hundredfold; the same move came as the ground (ab61, ab64) and the
  Seed (ab63). The ground is a hearer (13:23), the seed the word (13:19),
  the sower the Son of man (13:37); "Jesus is the Sower" is let be.
- **BN-216 — the hyssop gloss gave the Passover door for cleansing; the
  second death** (2026-11-12, ab64, Opus: shape66 15 / 16, no error, its
  one Good a funeral's Christ "defeating the second death [Revelation
  20:14]"; shape65 read again 14 / 16, one of them a Psalm 51 lesson's
  hyssop "for cleansing, as seen in Exodus 12:22"). That line was the
  gloss table's own words, copied as glosses are: "to sprinkle blood or
  water for cleansing (Exodus 12:22; Numbers 19:18)". It now gives each
  use its verse -- the Passover doorposts (Exodus 12:22), cleansing
  (Leviticus 14:4-7; Numbers 19:18). A legend entry names Christ said to
  defeat the second death that 20:14 only names; 2:11's "shall not be
  hurt of the second death" is let be.
- **BN-217 — BN-213's repeat went in as two halves; the Proverbs big idea
  borrowed from Isaiah** (2026-11-12, ab65, Sonnet: shape66 and shape67
  15 / 16 each, no error, both misses the Proverbs 3:5-6 sermon). shape67
  printed 3:5 for points 1 and 2 as `[^Proverbs 3:5a]` and
  `[^Proverbs 3:5b]` -- two tokens to the check, one whole verse twice on
  the page; a half-verse letter is now read as its verse. A loop test
  holds the refusal end to end. And "God knows / sees the end from the
  beginning", the sermon's big idea in fifteen lessons, is Isaiah 46:10
  carried as Proverbs 3:5-6's (Sonnet: A 1, B 1): named, with the
  passage's own words.
- **BN-218 — two errors Opus counted in shape67** (2026-11-12, ab65: shape67
  14 / 16 by Opus with 2 errors, 15 / 16 by Sonnet with none; shape66 read
  again 14 / 16 by Opus, the lines BN-215, BN-216 name). David's victory
  that "brought peace to all Israel" (17:52-53 a rout, the wars went on,
  18:30) and a children's Jonah's "the presence of the LORD means that
  God is everywhere" (1:3: what he fled; God everywhere is Psalm
  139:7-10). Each a line new to the readers; scanned over ab30..ab66,
  each finds its own.
- **BN-219 — Nineveh cruel to Israel; the rout cited at 17:54** (2026-11-12,
  ab66, Sonnet: shape68 15 / 16, one error -- a children's Jonah's Nineveh
  that "had been cruel to God's people"; shape67 read again 15 / 16, its
  error the defeat of the Philistines cited at 17:54). The Nineveh line is
  stock as "very mean to God's people" in a dozen children's lessons; the
  book names their wickedness (1:2) and violence (3:8), no deed to Israel.
  "Enemies of God's people" is let be (2 Kings 17:6). The rout is 17:51-53;
  17:54 is the head brought to Jerusalem. Scanned over ab30..ab66.
- **BN-220 — a point prints six verses at most** (2026-11-12, ab66, Opus:
  shape68 13 / 16 with no error, its three Goods totals of 18-19 -- a
  funeral's weekly tasks, Goliath with 1 Samuel 17:1-58 printed whole and
  then again across the points, the Sower reprinting 13:8-23 under point
  4; both readers have marked the double printing in most reads since
  ab55). The shape's point line now asks for the verses a point turns on,
  six at most, the passage at the top already printing them all, and
  the point's other verses named in its lines as chips. The cover and
  order checks read chips, so a point that prints its key verses and
  names the rest still covers its passage.
  The words did not hold it: shape69 still printed 1 Samuel 17:1-26,
  27-37 and 38-54 under the points (4 420 words) and 13:8-23 under the
  Sower's fourth. So the window does it (`withLongPointPassagesNamed`): in
  a new lesson, a point's own printing of more than ten verses that the
  passage at the top already prints becomes `**Verses:** [^ref]` -- the
  chip kept, the words printed once; a shorter printing, or verses the top
  does not print, stay as written.
- **BN-221 — the princes and the stars each with its verse, let be**
  (2026-11-12, shape70's finished lessons). BN-189's entry named "the Holy
  One who brings princes to nothing [Isaiah 40:23] and calls the stars by
  name [Isaiah 40:26]" -- each its own verse, as the entry asks -- for the
  40:26 within reach of "princes"; a citation of 40:23 between them now
  lets it be. And BN-220's window held in shape70: Goliath's points name
  17:1-26, 27-37 and 38-58 (2 972 words, from 4 420), the Sower's fourth
  13:8-23; shape69 was read 16 / 16 by Sonnet (ab67).
- **The bar met** (2026-11-12, ab67 and ab68): shape69 and shape70, two
  batches running, read Best on all sixteen lessons by Sonnet and by Opus
  in every read (shape69 twice by each), no counted error in 64 lesson
  reads. Open, above the Best line: illustrations that are stock scenes
  ("a person sits in a quiet room"), backgrounds that name the verses
  before but not the occasion, Christ sections that reach for a verse
  rather than grow from the passage, and funeral lessons given weekly
  tasks -- each marked 1 of 2 in some lessons, none keeping a lesson out
  of Best.
- **BN-222 — held out: sixteen asks the checks were never tuned on**
  (2026-11-13, the Stop hook: _the goal's words are broader than the
  evidence_). `references/lesson-asks-held-out.json`, H-01..H-16 -- Daniel
  in the lions' den, the storm in Mark 4, Psalm 121, Romans 8:31-39, Micah
  6:6-8, the talents, prayer with no passage, a Christmas sermon, ten
  minutes on Ephesians 2:8-10, an elder's _pls help me make preach for
  sunday about ruth and naomi_, a women's-meeting devotion on Psalm
  139:1-12, Noah for children, Ecclesiastes 3:1-8, a funeral on John
  14:1-6, the Beatitudes and Genesis 22 -- run twice on scratch profiles
  (`scratch-shape-ha`, `-hb`, the code of shape70) and read blind as ab69.
  An ask that names no passage carries `then: first-option`, as the tuned
  set's do. One gap it found at once: _I need to preach about prayer this
  Sunday_ was answered "Please choose one:" over three passages a blank
  line apart, closed by "Once you pick one, I will write the full lesson
  directly into your note." -- no question anywhere, so no button was
  drawn and no lesson written. `cutPassageListFrame` now takes a closing
  line saying what happens once one is chosen (`CHOSEN_THEN_PATTERN`) and
  a lead-in asking to choose over them (`CHOOSING_LEAD_PATTERN`); seen
  live after, the same ask's three passages drawn as buttons, the first
  pressed, 976 words written. (A rerun under the same note title wrote
  into the first note of that title: the runner opens the first row of a
  name, so a rerun takes a tag of its own.)
- **BN-223 -- a finish keeps their own words** (2026-11-13, the four finish
  asks F-01..F-04 run live for the first time: every lesson whole, two
  of the preacher's lines gone). F-03, finished in place: their
  introduction, "Have you ever been told to stop asking for help?", was
  written over with the model's own scene -- the shape says an
  introduction never opens so (BN-90), a rule for the model's words, not
  theirs. A finish now reads their blocks off the ask
  (`readFinishOwnBlocks`, the note's last line closing the ask's bracket
  read too), and an edit writing over or taking out one whose words its
  new text does not hold is sent back once an ask
  (`findFinishOwnWordsLoss`; a heading given its number keeps its words
  and passes). F-04, loose lines: "my story: the night at the hospital"
  gone, a stock waiting-room scene in its place -- `findLostNoteLines`
  counted it kept on "my", "story", "the", "night" and "at". A line
  that marks their own story (`my story:`, `testimony:`, `illustration:`)
  now keeps EVERY word of four letters after its mark, and the refusal
  says their story is the point's example; every other line keeps the
  four-in-five rule (made stricter for all, "jesus asleep in the boat"
  told as the KJV's "ship" was refused round after round and two runs
  of three ran out of rounds). And an edit making loose lines a lesson
  that itself takes out or writes over a line its new words do not hold
  is sent back once (`findRewriteLineLoss`; the window had looked only at
  the lines IT takes out). Seen live after: F-03 twice and F-04 three
  times, every line of theirs in the lesson.
- **BN-224 -- a short phrase named for its verse is held to it**
  (2026-11-13, the held-out read: "under the sun" [^Ecclesiastes 3:1],
  where 3:1 reads "under the heaven"). The window had read 3:1 for the
  quote and never compared it: eleven letters, under the twelve a quote
  needs (`MIN_NOTE_QUOTE_LETTERS`), and ranked out before the read. A
  quote whose reference comes RIGHT after it (`CITED_REF_AT_ONCE_PATTERN`)
  is held to it from eight letters (`MIN_CITED_QUOTE_LETTERS`); a short
  one whose sentence names another thing's verse later -- paid "two
  pence"--two days' wages [^Matthew 20:2] -- is not that verse's quote.
  Measured on the 96 lessons of ab67..ab69: 21 short cited quotes
  compared, the one slip named and nothing else (before the adjacency
  rule, nine good lessons would have been sent back).
- **BN-225 -- a funeral says no more than its promises; a day asked for is
  named** (2026-11-13, the held-out read). A John 14 funeral answered its
  own hearer's question "where is the one I love now?" with "They are in
  the Father's house" -- the promise to Jesus' hearers said of the dead
  (Sonnet an error, Opus out of Best) -- and a Christmas sermon on Luke 1
  never named Christmas. The shape's funeral sentence says each promise
  is said of those the passage gives it to, never where the one who died
  now is, and a lesson asked for a day (Christmas, Easter, a wedding)
  names it in its Introduction and its Response (~40 tokens, lesson asks
  only). Not built: a check of numbers against the verses a sentence
  cites -- measured on the 96 lessons of ab67..ab69, 26 hits, one an
  error (Noah's "seven of some" at Genesis 7:8-9), the rest counts a
  lesson fairly draws from its story ("two women, Euodias and Syntyche").
- **BN-226 -- a new lesson's second look against the verses it read**
  (2026-11-13, ab69 and ab70: on the held-out asks about one lesson in
  five slipped on a fact, and every check written for one slip moved the
  next -- "a crowd" at the Olivet discourse, "Jehovahjireh refers to the
  ram", the merciful "to those who deserve it"). After a new lesson's
  first write the window asks the model once more, in an ask of its own
  (`AskExtraType.isFactCheck`: one round, no tools, no history,
  `FACT_CHECK_SYSTEM_PROMPT`, `lessonFactCheckHelpers.ts`): the verses the
  ask read and the passage printed, then the lesson's own lines, and which
  sentences say of the passage's OWN events what those verses contradict.
  What comes back is named the way a legend is, for one more edit, once an
  ask, and only when the ask read the lesson's own passage
  (`checkHasPassageRead`). A finding is kept only when its sentence is the
  lesson's and it sets the verses' words against it: measured live, a
  first prompt named "Paul wrote this letter … from a prison" (Ephesians
  3:1, outside the verses read) and a Christmas introduction's stable;
  tightened, it named "God shut the door" (Genesis 7:16) -- every "the
  verses do not mention" finding was true or a pictured scene, and they
  are let be (`ABSENCE_FINDING_PATTERN`). With the final rules, on six
  held-out lessons: the talents' "false view of God's character" named
  (Matthew 25:26 has the master accept the charge), a Romans 8 line named
  that agreed with its verse (the fix re-quotes it), nothing else. Costs
  one free round a new lesson (it made the hourly pace cap reachable in a
  measuring run: 150 model calls). The note's read after a change is now
  shared by every note said under it (`readChangedBlocks`). NOT YET READ
  BLIND: the run stopped at six of sixteen when a peer's commit (db4a8c1d3)
  left `ChatbotAppComp.tsx` importing `./typedCreateAskHelpers`, a file
  never committed, and the help window stopped loading on this branch;
  the user's call, 2026-11-13: wait for its owner. Resume: batch E's
  H-07..H-16 on a fresh profile, then read heldC against heldE blind.
  RESUMED the same day, once the peer's file was committed: read blind as
  ab71 (scoreboard row 62) -- Best 25 against 24 of 32, errors 4 against 6,
  one fewer with each reader. What E kept were details the passage does not
  give -- Luke 2's stable, the Olivet discourse's crowd -- which both
  readers count as errors and the absence filter had let be; so the filter
  is taken out and a pictured scene is no excuse when it puts into the
  passage's own events what the verses do not give. Measured again as
  batch F (ab72).
- **BN-227 -- a lesson ask that writes nothing and asks nothing goes back
  once** (2026-11-13, held-out H-07 on gemma4:cloud: "FileNotFound:
  owa_bible_note "add" is not a valid action for owa_note_edit. I will use
  owa_note_edit "edit" to replace the block 1." -- the tool's words to the
  person, the note still empty). `checkIsBlankLessonUnwritten` in
  `findAnswerShapeNudge`: in an empty note's lesson ask, a reply with no
  change, no question and no options is handed back with
  `NOTE_BLANK_UNWRITTEN_NUDGE`; a "which passage?" stands. The rerun of
  the same ask wrote 1 038 words.
- **BN-228 -- the LORD in small capitals, opening Psalms 38, 88 and 139**
  (2026-11-13, the held-out read ab72, Opus: a women's devotion on Psalm
  139 printed "O lord, thou hast searched me" -- counted an error). The
  app's own KJV (`kjvBibleBooks.json`) had "O lord" opening 38:1, 88:1 and
  139:1 where the KJV has "O LORD": fixed, and `kjvBibleText.test.ts`
  holds them with BN-71's Jonah 1:15 and fails on any verse opening "O
  lord". A KJV already installed keeps its copy until it is installed
  again, as with BN-71.
- **BN-229 -- the second look goes through every WHO** (2026-11-13, ab73:
  held-out batch G read Sonnet 12 / 16, Opus 11 / 16 after F's 15 and 14,
  and every error in it was who did a thing of the passage -- Jesus
  "quickened" us (Ephesians 2:5: God), Jesus "dismissed the crowd" (Mark
  4:36: the disciples), John's task given to the dayspring (Luke 1:77), a
  crowd at the Olivet discourse -- which the look's prompt named among the
  faults and never found). `FACT_CHECK_SYSTEM_PROMPT` now has the model go
  through, one by one, every sentence that says of the passage's own
  events who did, said or heard a thing, who was there, what a name or
  verse refers to, with a verdict each (`same`, `other`, `not given`),
  twelve at most; `readLessonFactFindings` keeps `other` and `not given`,
  `other` first, three at most. And the Olivet discourse's crowd, in five
  held-out batches and never in the verses a lesson reads before 25:14, is
  a legend entry: across the 1 728 lessons read so far it names exactly
  those five sentences. Measured as batch H (ab74): the crowd gone, the
  per-claim pass moving nothing else (scoreboard row 65). The user's call
  the same day, put to them with the held-out rate at about three lessons
  in four: _stay free, keep fixing_.
- **BN-230 -- a point quoting a verse that is not its own; John's task
  given to the dayspring** (2026-11-13, ab69..ab74). A children's Noah
  set Genesis 7:5's words under a point printing 6:22, twice, and both
  readers counted it; no check held a quotation that names no verse.
  `findPointQuoteMisplacements` (`noteChatHelpers.ts`) walks each
  numbered point with its own printed verses (its lone `[^ref]` lines) and
  names, the way a legend is named, a quotation of 20 letters or more,
  with no reference right after it, that is word for word a verse the ask
  read outside both the point's verses and the passage the lesson prints
  at its top -- every verse holding the words counted ("whosoever
  believeth in him" is John 3:15 and 3:16 alike). Measured on the 1 760
  lessons read so far, every chapter they print taken as read: 9 hits,
  the two Noah lessons the readers marked and six that quote Jonah 4:2 or
  John 3:14 under another point without naming it, where the fix is to
  name it. And three Christmas lessons gave Luke 1:77 -- John's task, "to
  give knowledge of salvation ... by the remission of their sins" -- to
  the dayspring of 1:78: a legend entry, naming exactly those three.
- **BN-231 -- an occasion's message is a lesson ask** (2026-11-13, the
  second held-out set, `lesson-asks-held-out-2.json`, J-01..J-16: sixteen
  asks in neither the tuned set nor the first held-out one, since the
  first had shaped BN-222..BN-230). _a short message for a wedding, from
  Ruth 1:16-17_ was written once as a whole lesson (467 words, nothing
  read first) and once as three bullets quoting 1:16 as "Your God shall
  be my God": no lesson hint either time, a funeral's message being the
  one occasion BN-85 read as a lesson. `OCCASION_SOURCE` reads a message,
  talk, homily, eulogy or sermon for a funeral, memorial service,
  wedding, marriage, baptism, dedication, anniversary, graduation or
  ordination as one; asked again with it live, the passage read and 1 036
  words, every check passed.
- **BN-232 -- a question is looked at, another book's telling is named, and
  three verses keep their KJV words** (2026-11-13, ab75, the second
  held-out set at 44 of 64 reads Best). Three of its four kinds of error
  sat in a question -- "how did the boy feel when he gave his lunch?" in
  a children's Matthew 14, "why did Elijah pray seven times?", "why did
  Jesus wait four days?" -- and the second look's prompt left questions
  out; it goes through one that takes a fact of the passage as given
  now. The boy is John 6:9's and the crowd making him king John 6:15's,
  put into Matthew 14 in both batches: the lesson shape says an event
  told in another book too is told as THIS book tells it, another's
  detail named with its own verse or left out. And the KJV wording table
  (BN-137) takes Ruth 1:16 ("where you go I will go", "your people
  will be my people", "your God my God"), Matthew 28:20 ("always, to
  the very end of the age") and Isaiah 53:7 ("led as a lamb to the
  slaughter"); 1 Kings 18:39's "The LORD, he is God" is left out, being
  Deuteronomy 4:35's own KJV words.
- **BN-233 -- four sermon tellings no verse gives** (2026-11-13, ab75 and
  ab76, the second held-out set, each counted an error by a reader): the
  Red Sea's "go forward" told as a step taken before the water moved
  (Exodus 14:21-22 has the sea divided first; feet in the water before it
  parted is the Jordan, Joshua 3:15-16), Elijah "praying seven times"
  (1 Kings 18:43: the servant went up seven times), Jesus "waiting four
  days" for Lazarus (John 11:6: two; four was the grave, 11:17), and Acts
  2:33 quoted as "poured out" ("shed forth"; "pour out" is God's word in
  2:17-18). Legend entries, each with a true telling held unflagged;
  across the 1 792 lessons read so far they name exactly the six
  sentences the readers marked.
- **BN-234 -- John's lad in Matthew 14's feeding** (2026-11-13, ab77,
  batch JD, J-12): "How do you think the boy felt when Jesus used his
  small lunch to feed everyone?" in a children's lesson on Matthew
  14:13-21, written with BN-232's line on another book's detail in the
  shape. A legend entry: a boy or lad beside the loaves, fish or lunch in
  a lesson on Matthew 14, Mark 6 or Luke 9 that names John 6 nowhere is
  named with Matthew 14:17 and John 6:9. Across every lesson read so far
  (ab-sets to ab77) it names four sentences, every one a J-12 discussion
  question (ab75 twice, ab76, ab77), and nothing else.
- **BN-235 -- the woman at the well shunned, and 1 Corinthians 13:5's
  phrases mixed** (2026-11-13, ab75..ab77). J-06's lessons told her as
  "avoiding the eyes of her neighbors", drawing water at noon "instead of
  the usual time" and "avoided by her own people", each marked by a reader
  (Opus took the last to Good): John 4:6-7 gives the hour and no reason,
  and the city heard her at once (4:28-29, 4:39). J-11's "is not easily
  provoked" was read as keeping "a score of wrongs", the modern rendering
  of "thinketh no evil". Two legend entries, a telling given as a
  possibility (_perhaps_, _may have_) and one that quotes "thinketh no
  evil" let be; across every lesson read so far they name seven
  sentences, all J-06 and J-11 tellings of that kind, and nothing else.
- **BN-236 -- James 1:7 quoted without its "let not"** (2026-11-13,
  ab75..ab77, J-09): "'shall receive any thing of the Lord' not" and
  "should 'not that man think …'" -- the verse's words with its
  "let not … think" left out or moved, so the quote says the opposite;
  marked in five reads of eight, twice at A = 1. A legend entry naming
  the verse whole. A general check (a quote starting after a "not" in
  its verse's own clause) was measured first and dropped: two such
  quotes in 4 482, both a rhetorical question and neither an error.
  The entry names the four garbled sentences read so far and nothing
  else.
- **BN-237 -- a change the note window was given a second after the one
  before it was answered "changed" and never written** (2026-11-13,
  held-out batch JE, J-06; also batch A, H-07). The window's own
  correction of a legend was lost twice in 170 follow-up changes: edit 8
  answered "block 36: new words", and the history kept edit 6's words
  under a new date (version 27 changed `updatedAt` alone). The head-change
  event of the change before schedules the window's reload a second
  later; that read came back with the older head while the new change
  was being kept, was put into the shared note item, and the new
  change's history write then wrote the old words. `initBibleNote` now
  writes what it holds and waits for a write on its way before reading
  the head, and lets go of a read during which it kept a newer change
  (`localWriteCount`). Two tests replay both orders and fail without it.
  Seen live in batch JF (2026-11-13): J-06's correction again came a
  second after the change before (1 036 ms), and this time it was kept;
  no follow-up change of JF's 19 was lost.
- **BN-238 -- a list item's new words lose the list mark they open on**
  (2026-11-13, held-out batches G, JE and JF): a discussion question
  rewritten as "- What does …?" drew the dash as words, the item a bullet
  already (3 lessons of 217; Opus marked one "a stray '- -' bullet").
  `withoutListMark` in `agentNoteBlockHelpers.ts` takes the mark of the
  item's own kind (`- * •`, a number's `1.`) off the first line of words
  changed or added in a list item; a paragraph's words keep their
  mark-up reading.
- **BN-239 -- the Red Sea told parting as Israel moved; the order of
  events checked; a furlong measured** (2026-11-13, ab79, batch JF).
  "acting on God's word even while the sea is still a wall of water" and
  "As they obey and move, the LORD causes the sea to go back" -- BN-233's
  entry now reads both (four sentences in every lesson read, all of
  that telling; "the waters were a wall unto them" let be). The second
  look (`FACT_CHECK_SYSTEM_PROMPT`) goes through what happened first, an
  "other" verdict naming another order of events. And "A furlong is a
  distance of about 1,200 feet" (both readers): a gloss entry gives the
  stadion, about 600 feet, beside John 11:18.
- **BN-240 -- the KJV's ":)" kept out of the editor's smiley (closes BN-70
  for Bible text the app writes)** (2026-11-13, ab80, both readers: "lineage
  of David🙂" in Luke 2:4, a Christmas lesson in batches H and I). The
  package's EmojisPlugin replaces `:)`, `:D`, `:(` and `<3` in any plain
  text node, and the KJV ends forty asides with `:)`. `toEmoticonSafeText`
  (`src/helper/noteEmoticonHelpers.ts`, a leaf) puts a word joiner
  (U+2060, unseen, no line break) between the two characters, in the
  chatbot's passage blocks (`genPassageNode`) and in the verse text the
  app hands the editor for a passage a person inserts (`shortToVerseData`).
  Seen live on a scratch profile: a Christmas sermon's two Luke 2:4
  passages read "David:⁠)", no smiley in the note. What a person TYPES
  is still the package's.
- **BN-241 -- four KJV words in the sense Scripture uses them**
  (2026-11-13, ab78..ab80, a reader each at A = 1): "charity" left as
  giving, "under the heaven" made God's jurisdiction (Ecclesiastes 3:1:
  this world, as "under the sun"), faith's "evidence" as proof God's word
  supplies (Hebrews 11:1: faith itself is the evidence; Jeremiah 32:10 a
  deed), a soul "humbled in me" as pride put away (Lamentations 3:20:
  bowed down in grief). Gloss entries, each quote held to the KJV. These
  four came from held-out asks, which those asks now partly carry. Also
  measured and not built: Pointing to Jesus sentences with no verse --
  about half of them in lessons the readers marked there and half in
  those they did not (192 lessons, ab75-ab80), so asking for one would
  not reach the slips.
- **BN-242 -- Gideon's lappers and "the pricks"** (2026-11-13, ab81, the
  third held-out set, measured first untuned at 45 of 64 Best): M-01 told
  the three hundred as the vigilant and the kneelers as the careless in
  both batches (Opus: an error) -- a legend entry (Judges 7:5-7, God's
  reason in 7:2; a telling given as a possibility let be); M-16 explained
  "kick against the pricks" as spikes of a yoke (both readers) -- a gloss
  entry (the goad, Acts 9:5, Judges 3:31). Set 3 is partly tuned from
  here. Left: the thief's words of Jesus given to the thief (M-08) and
  Samuel given Eli's "Speak, LORD" (M-12), one lesson each.
- **BN-243 -- the second look holds a quotation to who says it, and of
  whom, and reaches further down a lesson** (2026-11-13, ab81). Watched
  live (a probe on the help window's console, taken out after): the look
  runs on every new lesson and goes through it in order -- 5, 12 and 7
  sentences on three set-3 lessons, the second stopped at its cap of
  twelve before the later points. Its prompt left out "a verse quoted as
  it reads", which Eli's "Speak, LORD" given to Samuel is, and the
  thief's words of Jesus given to the thief too. Now every quotation
  given to a person is gone through for who says those words in the
  verses and of whom, a verse quoted with no one said to say it is still
  left out, and the look takes sixteen sentences. The errors it is for
  come and go from run to run (a re-run of M-08, M-12 and M-16 wrote all
  three right), so its effect is for a batch to show.
- **BN-244 -- a gloss gives one verse for its sense, not a second the model
  will cite for something else** (2026-11-13, ab82, batch MC, M-16, both
  readers): BN-242's "pricks" gloss added Shamgar's "ox goad" (Judges
  3:31) for the sense of goad, and the lesson wrote that the ox kicks
  "only to injure itself further [^Judges 3:31]" -- the only counted error
  of the batch, made by the fix. The gloss now names Acts 9:5 alone and
  says the goad is never part of the yoke. Ten other glosses cite more
  than one book, each verse part of the sense itself (a penny a day's
  wage): left as they are.
- **BN-245 -- Samuel's answer, and "that Rock was Christ"** (2026-11-13,
  ab82: batch MC with BN-242/243 read 27 of 32 Best against MA's 25, three
  counted errors against five). M-12 told Samuel as answering "exactly as
  Eli told him" or with Eli's "Speak, LORD" in three lessons of four
  (1 Samuel 3:10 has him leave out "LORD") -- a legend entry; a sentence
  that gives Eli his own words is let be. M-06 quoted 1 Corinthians 10:4
  as "the rock was Christ" -- a KJV wording entry ("that Rock was
  Christ").
- **BN-246 -- "Will we recognize our loved ones?" answered "Yes"**
  (2026-11-13, ab81..ab83, M-14, a reader each time at A = 1): a funeral
  lesson on 1 Thessalonians 4:13-18 answered its hearer's question with
  "Yes, we shall be caught up together with them" -- the verse promises
  being together with them and with the Lord, not knowing one another.
  A legend entry reading the answer beside the question above it; a
  question about being with them, not knowing them, is let be. It names
  the four such answers read so far and nothing else.
- **BN-247 -- "The passage answers" opens on the verse, never a bare Yes or
  No it does not settle** (2026-11-13, ab78..ab83). The hearer's question
  answered past the verses was a recurring A = 1: "Will we recognize our
  loved ones? Yes", "To what extent ...? Yes,", a believer who "still
  struggles with anger" answered "No". Of the 192 lessons read in
  ab78-ab83, 121 open an answer on Yes or No, and 36% of those were
  marked down on faithfulness by a reader against 23% of the other 71.
  The shape's answer line now opens on what the verse says. A sentence
  in the lesson shape, so its effect is for a batch to show.
  Shown by batch MF (set 3, the line live): 10 of 16 lessons still open
  an answer on Yes or No, against 11 of ME's -- the model barely follows
  it. Left in (a dozen words, on a lesson ask alone); a deterministic
  check was not built, since most such answers are right (64% of them
  were not marked down).
- **BN-248 -- Gideon's order, "nothing amiss", Luke's veil** (2026-11-13,
  ab81..ab84, set 3, counted by both readers across batches): "after ...
  tested God with a fleece ..., he gathered an army" (three times; Judges
  6:34-35 calls the tribes before the fleece of 6:36-40); "this man hath
  done nothing amiss" said of the thief, or a man who "realizes he has done
  nothing amiss" (the thief says it of Jesus, Luke 23:41; a sentence that
  says it OF Jesus is let be -- not merely one naming "the holiness of
  Christ"); and Luke's veil "torn from top to bottom" (Luke 23:45 has
  "rent in the midst"; top to bottom is Matthew 27:51, Mark 15:38). Three
  legend entries naming the seven such sentences read so far and none of
  the right tellings beside them.
- **BN-249 -- the same two Gideon slips in other words** (2026-11-13,
  batch MG, set 3, BN-248 live). MG's Gideon lesson told the fleece
  "before gathering an army" -- BN-248 knew only "after ... fleece ...
  gathered" and "fleece ... then" -- and kept a point's heading, "God
  removes the fearful and the careless", after BN-242 had its water
  sentence rewritten: the heading names no water, so BN-242's topic never
  held. The fleece claim takes "fleece ... before gathering" and
  "summoned ... after the fleece"; the water test's topic takes the
  sifting words (fearful, removes, sifts, sends home). Over the 2 096
  lessons read so far it names six sentences -- three such headings
  ("careless", "complacent"), three fleece orders -- and none told right.
- **BN-250 -- a lesson's title sent last "at the top" closed the lesson**
  (2026-11-13, blind read ab85, Sonnet: "the title '# The Wise and
  Foolish Builders' sits at the very end of the note"). Writing a whole
  lesson into an empty note, the model now and then left the call's
  `title` out and sent the name as a heading 1 AFTER everything else,
  `after: 0` or `after: 1` -- the top, by its numbering. Adds at one place
  go in the order given, so the heading was the lesson's last block: 5 of
  the 381 lessons the held-out runs made, in five batches (D, G, I, JC,
  MG), each with the note's own name left as it was. Reproduced offline
  through `applyNoteEdit`: that shape alone puts it last, whether the call
  or the window takes the empty line out. `withBlankNoteFilled` now puts
  such a heading first (`withTrailingTitleFirst`): in a note that holds
  nothing, the call's LAST change, its only heading 1, at the top with two
  other adds or more there and none further down. A heading asked for
  alone, one put further down, a second heading 1 stay as given. Seen live
  on a scratch profile through `owa_note_edit` with MG's shape: `h1
  passage h2 paragraph ...`.
- **BN-251 -- love "the only true evidence"; Eli "each time"** (2026-11-13,
  ab85, Opus counting both as errors). The 1 John 4 big idea "love one
  another as the only true evidence that we know Him" -- measured and not
  built after ab84 while only one read marked it down -- came back in both
  batches of ab85 and was counted both times: eight lessons of five
  batches (1 John 4:13 and 4:15 give the Spirit and the confession too).
  And "each time Eli said, I called not" in two children's lessons of two
  batches (1 Samuel 3:5-6 twice; the third time Eli perceived the LORD had
  called, 3:8-9). Two legend entries; over the 2 112 lessons read they
  name those ten sentences and nothing else.
- **BN-252 -- a legend told in several sentences is named in each**
  (2026-11-13, batch MH, BN-251 live). MH's 1 John 4 lesson came back
  with its big idea put right ("a primary evidence") -- the note had
  named it -- and the same claim two sentences on, in other words: "the
  only way to prove we know Him", and a discussion question asking why
  John says loving others is "the only way to 'know' God". The note had
  named the big idea alone: `findLessonLegends` took the FIRST sentence an
  entry fits, so a legend told twice was named once, put right once, and
  kept. Every sentence an entry fits is named now, each entry's first
  before any second, under the same cap of four. BN-251's claim also
  takes "the only way ... prove ... know" and "the only way to (truly)
  know God", in five lessons read; "the only way to prove love for the
  unseen God" is 4:20's own argument and is let be.
- **BN-253 -- Job's ten children cited to Job 1:3** (2026-11-13, ab86,
  Sonnet counting it). "Vast livestock and ten children [^(KJV) Job 1:3]"
  -- the children are 1:2, the substance 1:3 -- in six Job 1 lessons of
  five reads (ab81..ab86); a reader had only noted it in ab84, and the
  neighbour-verse check measured after ab83 was dropped for its false
  hits. One legend entry, a citation of 1:2 or 1:2-3 let be; over the
  2 144 lessons read it names that sentence and nothing else.
- **BN-254 -- Gideon's plan, the men sent home, Jeremiah 29:14**
  (2026-11-13, ab85 and ab86, Opus). Three tellings each in two batches:
  the three hundred breaking the pitchers as "the Lord's command" (MG,
  MH -- the plan is Gideon's in 7:16-18; the LORD's word was "get thee
  down", 7:9); a point's heading naming the men sent home "the
  overconfident" or "the proud" beside "the fearful" (ten headings in
  five batches -- BN-242's words could not take a bare "proud", God's own
  reason in 7:2 being Israel's pride, so the heading's shape is read); and
  "will be found" cited to Jeremiah 29:12-13 (MF, MH -- it is 29:14).
  Over the 2 144 lessons read the three entries name those sentences and
  nothing else. Left: "following God's specific, unusual instructions"
  with the trumpets in the NEXT sentence -- God did give Gideon
  instructions (7:4-11), so the words alone are no slip. Batch MI added
  "tools of a divine strategy" beside the trumpets, the same claim.
- **BN-255 -- the one more edit the window names under a lesson is made**
  (2026-11-13, ab87: MI's children's Samuel kept "Samuel answered exactly
  as Eli told him", which BN-245 names). 64 of the 413 held-out lessons
  had ended "changed, but the assistant stopped before saying what it
  did" -- M-12 in nearly every batch, 22 of the 64 with only the first
  write made, so every fix named under it was lost. Asked three times with
  a log on both ends of that sentence: once the shared server's empty
  reply (the ask's one retry already spent on the lesson's long write,
  the call it drops most), twice the twelve rounds run out (after the
  write the memory verse was named too long and the model searched three
  to five rounds for a shorter one elsewhere; its one fixing edit was
  refused -- a block off by one, then the firewall's rate in a test fired
  too fast -- with no round left). Now the blank lesson has sixteen rounds
  (`NOTE_LESSON_MAX_TOOL_ROUNDS`) and an empty reply is asked again once
  before the ask changes anything and once more after (`askOpenAiCompatible`).
  Measured on M-12, three asks a stage: the fixing edit made 0 of 3 before
  (the 22-word 1 Samuel 3:10 kept every time, the Eli slip in 2), 1 of 3
  with the rounds alone, 3 of 3 with both (memory verse swapped, no Eli
  slip, 2 answered and 1 "stopped" after the fix). Left: the 20-word rule
  sends a story whose key verse runs 22 words (3:10) to Colossians 3:20 or
  Ephesians 6:1, a weaker fit than the story's own 3:4. Read blind in
  ab88 and ab89 (batches MJ and MK, BN-255 live): no lesson stopped with
  only its first write made, and neither reader counted one factual
  error in six reads of the two batches (MJ 62 of 64 Best, MK 27 of 32).
  The two A = 1 stretches of MK that BN-251 and BN-254 meant to name and
  did not were their words in another form -- `the only way to "know"
  God` (the word in quotes, three lessons) and "God removes those who are
  fearful and those who would boast" -- and are named now.
- **BN-256 -- a paragraph of list lines parted by a written-out break**
  (2026-11-13, batches MJ and NA, the mechanical check's "questions"
  failing on two children's lessons). The questions came as ONE paragraph
  add, `"- Why …?\n- How …?\n- When …?"` with each `\n` the two
  characters a model copies from the JSON it was shown, and went in as one
  bullet holding the second question inside the first ("… \n- How did the
  king's mind change"): a section add read such breaks as the line breaks
  they mean, a paragraph add of mark-up lines did not. It does now
  (`expandSectionAdds`); words that are no mark-up keep a written-out break
  as words. 2 of the 461 lessons made, both children's. Seen live on a
  scratch profile through `owa_note_edit`: three bullets.
- **BN-257 -- 100 typos in the app's own KJV set right** (2026-11-13, the
  fourth held-out read ab90: both Psalm 32 lessons printed "I acknowledge
  my sin unto thee", and a reader counted the app's own text as a
  misquote). The embedded KJV (`kjvBibleBooks.json`) read against
  eBible.org's public-domain KJV (the 1769 text, the USFM BN-147 already
  took the psalm titles from), all 31 102 verses word for word: 1 640
  differ, 1 264 of them this edition's own spellings (honor, show, savor,
  Bethel, entreat, basin, woolen ...), kept as they are. Of the rest, 100
  are typos and were put right with the KJV's words, every other character
  of the verse as it was: a word changed ("Three items in the year",
  Exodus 23:17; "had make", Genesis 13:4; "neverthless", Galatians 2:20;
  "said of them of old time", Matthew 5:21; "O how I love thy law", Psalm
  119:97; "more then sixscore", Jonah 4:11), a word dropped or added, and
  a possessive written with an apostrophe ("your's", 1 Corinthians 3:21).
  Left: name spellings, the epistles' closing notes and Psalm 119's letter
  headings, which that USFM prints as verse text, and edition choices
  (Hebrews 4:8 "Joshua", vats/fats, farther/further). `kjvBibleText.test.ts`
  holds twelve of the verses and every possessive. Seen live: a KJV made
  on a scratch profile reads the five most-preached of them right. A KJV
  already installed keeps its copy until it is made again (BN-71's note).
- **BN-258 -- a short message is written short; Colossians 3:14's bond
  is charity's** (2026-11-13, ab90). "A short message for a baptism
  service" was written as a full three-point sermon of ~1 000 words in
  both batches (a reader marked its length and its points down): a short
  message (short / brief / quick + message / sermon / talk / word /
  homily, no minutes given) is now a lesson form of its own
  (`readLessonFormAsked` -> `short`), written with TWO points at most and
  about 600 words, and reviewed as one; the rubric script takes the form
  (two points, 250-1 600 words) and set 4's N-14 is tagged with it. And
  both batches' Colossians 3 lessons called Christ "the bond of
  perfectness", which 3:14 says of charity (a reader's A = 1 twice): a
  legend entry names it. Seen live, N-14 and N-09 asked twice each: the
  baptism message two points and 643 / 669 words, neither Colossians
  lesson calling Christ the bond.
- **BN-259 -- a hearer's question is changed with its answer** (2026-11-13,
  ab91). The craft slip both readers name most, 15 of the 116 non-Best
  reads in ab84..ab91, is a "The passage answers" line that does not
  answer its question: "What does Abraham say when Isaac asks where the
  lamb is?" over "Yes, because he trusted the character of God", "Who came
  to Jesus in the temple?" over "He did this to show...". Traced through
  the batches' tool calls, the first draft's pairs had matched ("Why did
  Jesus use a colt instead of a horse?" over "that it might be
  fulfilled"); the model's OWN edit after it, with no word from the window
  asking, rewrote the questions and none of their answers -- 32 of 208
  held-out lessons (MA..NC) had a question or an answer rewritten alone,
  and 4 edits of 63 sent both. An edit giving a `**A hearer asks:**` block
  new words while the block under it is left is now refused once an ask
  (`findHearerAnswerLeft`, `isHearerAnswerRefused`): send each answer with
  its question -- its own words where they still answer -- or leave the
  question. An answer rewritten alone (to fit its question, or a fix a
  legend named) goes through.
- **BN-260 -- five tellings of the fourth held-out set** (2026-11-13,
  ab90..ab92). Legend entries for what a reader counted or marked down
  there: "Daughter" as a word Jesus uses of no one else (two of the set's
  four Mark 5 lessons, in two wordings), Daniel 3:25's fourth man seen by
  "the three friends" (the king says it; both readers, two reads), "God
  could raise him" told as Genesis 22's (Hebrews 11:19's), a voice telling
  Peter "not to call any man common" cited to Acts 10:15 (Peter's own
  words, 10:28; "God hath shewed" him so is left), and John 12:43 given to
  Jesus (John's own word; both readers, two reads). Run over the 2 336
  lessons read so far, they name those six sentences and nothing else.
  Not built: Genesis 21:12 cited as the promise to multiply and a heading
  "The City recognizes the Prophet" (one each).
- **BN-261 -- a verse given to the Memory verse heading goes to the verse
  under it** (2026-11-13, batch NE). A children's memory verse named too
  long to say (BN-129) was given its new verse as `{block: 26, ref:
  "Psalm 56:4"}` -- 26 the Memory verse heading, 27 the verse: refused as
  saying nothing to change, then as a verse token on a heading, and the
  ask stopped with the 27-word verse still in. 3 of the 33 children's
  lessons in the held-out batches aimed the swap so, and none put it right.
  A heading takes no verse, so `expandPassageRepoints` reads a `ref` aimed
  at a heading with a passage right under it as that passage (BN-72's own
  repoint); a token as a heading's words keeps BN-176's refusal. Seen live
  on a scratch note: the heading kept, Daniel 3:17 under it made Psalm 56:4.
- **BN-290 -- Luke 12:15's reason is not covetousness's creed**
  (2026-11-14, ab109, ab110). Opus counted batch PJ's and PK's rich fool an
  error alike: covetousness defined as "an intense longing … leading to a
  belief that 'a man's life consisteth not in the abundance'" -- the reason
  Jesus gives AGAINST covetousness, made the creed of the vice it warns
  against. A legend entry names "the belief that a man's life consisteth
  not" in a Luke 12 lesson; the verse quoted as Jesus' warning is left.
- **BN-289 -- the second look goes through reasons, causes and states too**
  (2026-11-14, ab106..ab110). Over the last batches of the fifth held-out
  set the readers' marks (A = 1, some counted errors) were a long tail of
  one-lesson slips, each a legend entry after the fact -- and most of one
  kind: a reason, cause, motive or state the passage does not give. The
  praise "triggered" the earthquake (BN-285), "God put compassion in her
  heart" (BN-286), Esther "knew the king's heart was in God's hands"
  (BN-287), the seraphim cover their faces "showing that even they must
  shield themselves", the inner prison "where the most dangerous prisoners
  were kept", Lamentations "does not say God caused the ruin". The second
  look (BN-226) went through who, what, when, to whom, names, numbers and
  quotations, never a reason or what a place was like. It now goes through
  the reason, cause or motive given for what someone did, felt or knew or
  for what happened, and what a place or thing in the passage was like --
  "not given" where the verses give none, named for one more edit as
  before. A prompt change to a model's look: measured by the next batch.
  **Paused 2026-11-14 at the user's word** (_prepare to stop, I'll continue
  this later_): batch PL (BN-289 and BN-290 live) was stopped at 12 of its
  16 asks and never read blind, so BN-289 and BN-290 are unmeasured. To
  resume: seed a fresh profile from `release/scratch-shape-mp` (the one
  scratch profile kept -- its `KJV.xml` carries BN-275's case fixes), run
  the fifth held-out set (`lesson-asks-held-out-5.json`), read it blind
  against batch PK, and stop at the user's line -- 31 of 32 Best (memory
  `lesson-goal-stops-at-95-percent`). The newest batch had read 29, 28,
  29, 24, 25, 30, 27, 26, 25 of 32.
- **BN-288 -- a line the fix writes in a named one's place is named too**
  (2026-11-14, ab109). Batch PJ's baby Moses was counted an error by Opus
  for "the princess's maid went and called the child's mother" -- a line
  BN-283's entry names -- written by the one more edit, not the first:
  the edit that rewrote the story block for a line already named wrote
  this one in its place. After the first write's legends are named, the
  edit after them was read again only for the lines named (BN-191); a new
  one went in unread. That read now names any legend the note holds that
  was not named before (`findLessonLegendsNew`), beside the lines left.
- **BN-287 -- Esther's fast is told without a theology she is never given**
  (2026-11-14, ab108, ab109). Batch PI's Esther said she asked for the fast
  "because she knew her life was in the king's hands, but the king's heart
  was in God's hands" and "recognized that the battle was spiritual"
  (Sonnet: A = 1, then an error in the next read; Opus A = 1), PJ's that
  she "needed … God's intervention to move the king's heart" (Sonnet A =
  1) -- the book never names God, and Esther 4:16 gives no reason for the
  fast. A legend entry names the king's heart put in God's hand, God's
  intervention on it, and a spiritual battle, in an Esther 4 lesson;
  Proverbs 21:1's own "the king's heart is in the hand of the LORD" in its
  own lesson is left. Over the 2 880 lessons read it names those lessons'
  sentences.
- **BN-286 -- the princess's compassion is hers, not put by God**
  (2026-11-14, ab106..ab108). Sonnet marked a baby Moses lesson down
  (A = 1) in three batches running for "God changed the heart of the
  princess", "God put compassion in her heart" -- Exodus 2:6 has "she had
  compassion on him", and says nothing of God putting it there. A legend
  entry names God changing, touching, softening or filling her heart; "the
  God who changed their father's heart" in an example is left. Over the
  2 848 lessons read it names the claim in the children's lessons of every
  batch of the fifth held-out set but one.
- **BN-285 -- Acts 16's earthquake is not said to be caused by the praise**
  (2026-11-14, ab107). Batch PH read 30 of 32 Best, its one miss for both
  readers the same sentence (A = 1): "This act of worship triggered a
  great earthquake" -- Acts 16:25-26 has them pray and sing, "and
  suddenly there was a great earthquake", and says neither caused the
  other. A legend entry names the praise, singing or prayer said to cause,
  trigger or bring the earthquake, or the earthquake in response to it;
  "as they sang, suddenly there was a great earthquake" is left. Over the
  2 816 lessons read it names that one sentence. Measured and not built:
  a one-word swap inside a short quotation ("basket of bulrushes" for the
  KJV's "ark of bulrushes", Opus: an error in PG) -- the misquote check
  passes a quote of fewer than three words of three letters over, and a
  prototype flagging a 3-to-6-word quote one word off a run of the
  passage named 279 quotes in 2 784 lessons, mostly verb forms the readers
  let pass ("pass by" for "passed by") and other verses' words ("joy in
  heaven").
- **BN-284 -- a hearer's question is a doubt, not a quiz** (2026-11-14,
  ab104..ab106). Both readers marked points down for hearer's questions
  that only asked what happened -- "What did Paul and Silas do when the
  earthquake opened the doors?", "What is Isaiah's response to the voice
  of the Lord?", "What does Esther do to prepare herself?" -- 39 of the
  291 in the fifth held-out set's seven batches (13%), each answered by
  the verse said again; the shape's "an honest question … these verses
  themselves answer" read most safely as a quiz. The line now asks for a
  doubt or difficulty a listener feels about the verses (why does God …?
  does this mean …? what if …?), never a quiz on what happened, the verses
  still the answer. To measure: the share in the next batch against 13%.
- **BN-283 -- a brother's share, a double negative and Moses' sister**
  (2026-11-14, ab101..ab105, Opus: each an error). Three slips of the fifth
  held-out set, each a legend entry: the rich fool's asker wanting "his
  brother's share" (PD's and PF's; Luke 12:13: "that he divide the
  inheritance with me"); a KJV phrase that holds its own "not" quoted
  after a "does not" -- a man's life does not "consisteth not in the
  abundance …" (PB's and PF's), which says the opposite of the verse -- an
  entry for any story; and baby Moses' "helper went and found the baby's
  own mother" (PF), the helper of that story the princess's servant (2:5)
  where the maid who called her is his sister (2:7-8), the KJV's own "the
  maid went and called" left. Over the 2 752 lessons read they name those
  sentences and no others.
- **BN-282 -- a short quote no longer hides the quotation after it**
  (2026-11-14, ab105). Batch PF's Lord's Prayer quoted 1 Peter 2:24 under a
  KJV label as "For he himself bore our sins in his body on the tree"
  (Sonnet: an error) -- right after its own `[^(KJV) 1 Peter 2:24]`, which
  the cited-quote check (BN-110) reads. It was never read: the quote
  patterns asked six letters between the marks, so the short quote before
  it ("debt") went unmatched, its closing mark was paired with the next
  quote's opening, and the prose between was read as the quotation. Over
  the 2 752 lessons read the slip hid 333 quotations and read 439 runs of
  prose as quotes, in 276 lessons. The misquote checks, the KJV wording
  table and the Christ-verse check now match every pair of marks and pass
  a short quote over in code, short quotes behaving as before; and the
  table has 1 Peter 2:24's modern wordings ("he himself bore our sins in
  his body", "by his wounds you have been healed"), which over the lessons
  read change that one quotation. Not changed: the general answer's
  `QUOTED_SPAN_PATTERN` in `llmBotHelpers.ts` has the same slip (eight
  letters asked), outside the lesson path.
- **BN-281 -- a big idea from the passage's own verses; Matthew 6:12 not
  turned round** (2026-11-14, ab104). Once BN-274 had the communion message
  read the verses before 1 Corinthians 11:23-26 -- the divisions of
  11:17-22 -- its big idea turned to unity in three batches running
  ("calls us to live in unity as one body", PD; "calling us to unity and
  gratitude", PE), which the four verses do not state, and Sonnet marked
  each down to Good; PA's and PB's had been "remembrance and
  proclamation". The shape's Big idea line now says it comes from the
  passage's own verses, never the verses before it, which are its
  Background. And PE's Lord's Prayer quoted Matthew 6:12 in a discussion
  question as "as we are forgiven" (Opus: an error) -- the prayer asks to
  be forgiven AS we forgive; the misquote check let it by (two of its four
  words the verse's). A legend entry names the quoted reversal in a
  Matthew 6 or Luke 11 lesson; a prayer's own unquoted "forgive as we have
  been forgiven" (twelve in the lessons read, Ephesians 4:32's thought) is
  left.
- **BN-280 -- a hearer's question stays a question** (2026-11-14, ab104).
  Batch PE's Esther lost all three of its "A hearer asks" lines in ONE later
  edit -- "Why was Esther so afraid to go to the king?" became "The verses
  say that Esther had not been called … for thirty days" -- each "The
  passage answers" line left answering nothing; Sonnet read it Good for
  the filler lines. Over the 2 720 lessons read, 88 answers have no hearer's
  question above them: 59 a question that lost its label (BN-265 keeps a
  label only when the MODEL read the note, and after a write it seldom
  does), 29 a statement in its place, three lessons of the recent batches
  losing every question so (PB's Mark 2, PE's Esther, NG's Palm Sunday).
  Two parts: the window's own read of the note (BN-152's, after a change)
  is kept as the note last read, so a label a later change drops is kept
  too; and a change writing a statement -- no question mark -- over a
  hearer's question is sent back once an ask, naming the question and
  saying to ask it another way where it took for granted what the verses
  do not say (`findHearerQuestionTurned`), before the label is kept.
- **BN-279 -- a psalm opened at its first verse has no verses before it**
  (2026-11-14, ab101..ab103). Every Psalm 40 lesson of the fifth held-out
  set (six) read Psalm 39:13 and told it as the setting -- "his plea for
  strength before the end of his life in Psalm 39:13", "David looking back
  on God's answer to his prayer in Psalm 39" -- and eight Psalm 23 lessons
  of earlier sets told Psalm 22:28-31 so ("It follows a declaration that
  the kingdom belongs to the LORD"). Sonnet marked the Background down in
  five reads, Opus once as a loose claim (A = 1, PD). The window had read
  no psalm before (BN-89 never does for Psalms); the MODEL read it, the
  shape's "the verses just before it, for its setting" winning over its
  own "never the psalm before it". Now a new lesson's first read of a psalm
  from its first verse is told the psalm before is another psalm, never its
  setting (`genPsalmOwnSettingNote`), and a later read of that psalm alone
  is told it again (`genPreviousPsalmReadNote`) -- a verse of it may still
  serve elsewhere. Measured and not built, from ab103: the seraphims'
  "six wings serve to cover their own faces and feet" (Sonnet, PD; "with
  twain he did fly"), the rich fool wanting "his brother's share" (Opus,
  PD; Luke 12:13, "divide the inheritance with me"), 2 Corinthians 4:11
  given as God's glory in Christ under Isaiah 6 (Opus, PC) -- one lesson
  each.
- **BN-278 -- baby Moses was brought to the princess** (2026-11-14, ab101,
  ab102). Both batches' children's lessons on Exodus 2 (PB and PC) said
  "When he grew up, he went back to the princess" -- Exodus 2:10: "the
  child grew, and she brought him unto Pharaoh's daughter". Opus noted it
  in every read without counting it. A legend entry names the child going
  back by himself; "his mother brought him back" is left. Over the 2 656
  lessons read it names those two lessons. Measured and not built, from
  ab102: PC's children's lesson answering "Was the baby's mother scared?"
  with "Yes" (Opus: an error) -- Exodus 2 does not say, and Hebrews 11:23
  says the parents "were not afraid of the king's commandment"; one lesson.
- **BN-277 -- John 3:13 says no man ascended, not that no one came down**
  (2026-11-14, ab101, ab102). Opus counted batch PB's Nicodemus an error in
  both reads, and PC's in ab102: "no one has come down from heaven except
  the Son of man", "the only one who 'came down from heaven'" -- the verse
  says "no man hath ascended up to heaven, but he that came down from
  heaven". A legend entry names the turned reading in a John 3 lesson; a
  sentence with "ascended" is left. Over the 2 656 lessons read it names
  those two lessons' sentences.
- **BN-276 -- the man let down through the roof is given no years of
  illness** (2026-11-14, ab101). Both readers counted batch PA's Mark 2
  an error for "the very mat he had been confined to for years": Mark 2:3
  has only "one sick of the palsy, which was borne of four", and Matthew 9
  and Luke 5 give no length either. A legend entry names a paralysed man of
  those chapters given years, decades or a lifetime of it; the man at
  Bethesda's "thirty and eight years" (John 5:5) is left. Over the 2 624
  lessons read it names that one sentence. Measured and not built, from
  the same read: a Nicodemus who "feels a void that his titles cannot
  fill", a jailer who "saw the character of Christ in them", a lion that
  "looks for those who are isolated or distracted" (Sonnet, one lesson
  each, all in batch PA), and John 3:13 told as "no one has come down from
  heaven except the Son of man" with no quotation marks (Opus, PB) --
  outside the misquote check, which reads quotations only.
- **BN-275 -- the app's KJV writes LORD where the KJV does** (2026-11-14,
  ab101). Opus marked both batches' Isaiah 6 lessons down for "I saw also
  the LORD" -- printed by the app from its own KJV, where the KJV has "the
  Lord" (Adonai; LORD in small capitals is the Name). BN-257's read of the
  app's KJV against eBible.org's public-domain KJV (1769) compared words
  without their case, so the divine names were never looked at. Read again
  for them: 127 differences in 116 verses -- "LORD" for "Lord" 99 times
  (Genesis 18:27, Exodus 4:10, Isaiah 6:1 …), "God" for "GOD" 11 ("Lord
  GOD", Genesis 15:2), "Lord" for "LORD" 13 (Psalm 3:1, Acts 2:34's "The
  LORD said unto my Lord"), a "Lord" for a man's "lord" (Joshua 5:14), and
  "God" for Nebuchadnezzar's "god" (Daniel 4:8). 115 verses set right, the
  one word at its place; Psalm 70:1, which this edition prints in capitals,
  is left. `kjvBibleText.test.ts` holds nine of them. A KJV already
  installed keeps its copy until it is made again (BN-71's note).
- **BN-274 -- a communion message is a lesson, and its passage is read**
  (2026-11-14, ab101, the fifth held-out set). P-14, _a short message for a
  communion service, from 1 Corinthians 11:23-26_, was written in both
  batches (PA, PB) with no verse read, quoting 11:23 as "received from the
  Lord" and 11:26 as "proclaim the Lord's death until he comes" -- a modern
  translation's words; Sonnet counted both as errors in both lessons, the
  only errors left in PB. The cause was before the model: the ask matched
  no lesson reader (BN-231's occasions had no Lord's Supper), so it carried
  no lesson hint and no shape -- the shape is what says to read the
  passage first -- and the misquote check (BN-76) had nothing but the ask
  to hold the quotes to. Three parts: communion, the Lord's Supper or
  Table and the breaking of bread are occasions, and "meditation" a message
  word (`checkIsLessonWriteAsk`); a new lesson whose passage was never read
  has it read by the window before the quote checks
  (`readUnreadLessonPassage`, once an ask), so the KJV wording and the
  misquote check meet its words, and a misquote refusal then gives the
  passage (`genNoteMisquoteRefusal`'s `windowRead`) -- "as it was read"
  had pointed at words never read; and the KJV wording table has eight
  wordings of 1 Corinthians 11:23-26 (each held to the app's KJV), a
  shorter one inside a longer one said once. Over the 2 624 lessons read
  they change those two lessons alone; every ask of the five held-out
  sets is now a lesson ask. Not built: "the new covenant" alone (Hebrews
  8:8's KJV says it).
- **BN-273 -- Nehemiah 3's builders: some by their homes, others from
  away** (2026-11-14, ab96, ab100). Opus counted batch NG's and NL's
  Nehemiah an error for "In chapter 3, the people worked together by
  sections, each repairing the part of the wall near their own home" --
  some built "over against his house" (3:10, 23) and the priests "every one
  over against his house" (3:28), but others came from elsewhere: "the men
  of Jericho" (3:2), "the Tekoites" (3:5), "the men of Gibeon, and of
  Mizpah" (3:7). A legend entry names "each / every one / all … near their
  own home"; a sentence naming the priests, or saying "some" or "many", is
  left. Over every lesson read it names that one sentence.
- **BN-272 -- "blot out" kept apart from the noun's stain** (2026-11-14,
  ab99). Both readers counted batch NK's Nehemiah an error: "'Blotted
  out' … as if a stain were removed from a garment [Isaiah 44:22]" --
  Isaiah 44:22's picture is a thick cloud. The word table's entry had read
  "blot out: to wipe away … (Isaiah 44:22); a blot, a stain (Job 31:7)",
  the two senses side by side. It now gives the verb with its own
  pictures -- sins "as a thick cloud" (Isaiah 44:22), a name "out of my
  book" (Exodus 32:33) -- and the noun apart, "if any blot hath cleaved to
  mine hands" (Job 31:7), never Isaiah 44:22's picture; each quote held to
  the app's KJV by its test. Psalm 51:1, 9's "blot out" reads it too. Not
  built: Hebrews 11:3 quoted in a discussion question as "things which do
  not appear" (five words; a swap would turn the verse's sense round).
- **BN-271 -- the entry into Jerusalem came before the Passover**
  (2026-11-14, ab93, ab98). Two Palm Sunday lessons said "He enters the
  city during the Passover feast" (Opus set it down as a loose claim, A =
  1 once): Jesus came to Bethany "six days before the passover" and "on
  the next day" into Jerusalem (John 12:1, 12), "after two days is the
  feast of the passover" said later (Matthew 26:2). A legend entry names
  an entry put during the feast; "the Passover season" and "as the
  Passover drew near" are left. Over every lesson read it names those two.
- **BN-270 -- "restoreth my soul" is a clause of its own** (2026-11-14,
  ab97, ab98). Opus counted batch NI's Psalm 23 devotion an error in both
  reads for "'Restoreth my soul' means he leadeth in the paths of
  righteousness for his name's sake" -- one clause glossed with the next.
  The word table's entry for it (BN-123: "a restorer of thy life", Ruth
  4:15, never a cast sheep) now also says it is a clause of its own, never
  explained by the clause after it.
- **BN-269 -- Habakkuk 3:3-15 is God's coming, not the Chaldeans'**
  (2026-11-14, ab97). Opus counted batch NH's and NI's Habakkuk 3 an error
  alike: "He looked upon the coming invasion of the Chaldeans … and saw the
  tents of Cushan and Midian tremble" -- 3:3-15 is a vision of God coming
  "for the salvation of thy people" (3:13) in his deeds of old; the
  Chaldeans' coming is told in 1:5-11, and only 3:16 looks to the
  invader. A legend entry names a sentence putting the Chaldeans or an
  invasion beside a verse of 3:3-15, Cushan or Midian: 3 lessons of the 16
  Habakkuk 3 lessons read, none of the many that rightly tie 3:16 to it.
  Not built: Psalm 23:3's "restoreth my soul" glossed with the clause after
  it, one lesson.
- **BN-268 -- a new lesson's adds numbered as they will stand go in as
  given** (2026-11-14, batch NI). The children's Daniel 3 lesson came as
  adds into the empty note with `after` 0 … 9, then 11 … 34 -- one number
  skipped: the chain of adds (one up at a time) broke at the gap, every
  `after` past it named a block an empty note does not have, and the whole
  lesson was refused; the retries then met the firewall's 25 acting calls
  a minute (that lesson's reads on top of the one before it, the batch's
  pace), and the note stayed empty with "please refresh the app" as the
  answer -- 3 lessons in every held-out batch have met that limit. In an
  empty note, adds whose `after` never goes down and reaches past the note
  are the lesson in order (`withBlankFillInOrder`): each takes the first
  one's `after`. N-12 asked again with it in went in at 10 / 10 (written as
  one section that time, so the gap was not met live; held by its tests).
- **BN-267 -- Jehovahjireh's meaning, and Matthew's branches** (2026-11-14,
  ab96). Opus counted batch NH's Genesis 22 an error for Jehovahjireh "is
  translated as" "In the mount of the LORD it shall be seen" -- 22:14's
  saying, not what the name means (NE's had it too; most lessons say "the
  LORD will provide"): the word table gives the name its meaning, "the
  LORD will provide", with "God will provide himself a lamb" (22:8). Its
  first wording set the saying beside the name, and batch NI's Genesis 22
  copied "the name Abraham gave the place" and gave the saying as its
  meaning again: the entry now gives the meaning alone, and a legend entry
  names a sentence that still gives 22:14's saying as the name's meaning
  (3 lessons of all read: ab80's, ab96's and NI's). And
  Sonnet held NG's Palm Sunday at A = 1 for its crowd "waving palm
  branches": Matthew 21:8 has "branches from the trees", Mark 11:8 "off
  the trees", the palms are John 12:13's -- a legend entry names it (2 of
  the 14 Matthew 21 lessons read, and nothing else); "Palm Sunday" is
  left.
- **BN-266 -- Nehemiah's builders said to have fought** (2026-11-13,
  ab95). Opus counted "While Nehemiah's people fought with swords to
  rebuild a physical wall" an error: no fight came in Nehemiah 4 -- "God
  had brought their counsel to nought, that we returned all of us to the
  wall" (4:15), "our God shall fight for us" (4:20). A legend entry names
  the builders as the ones who fought; "fighting for your brethren" (the
  chapter's own word, 4:14) and "ready to fight" are left. Over every
  lesson read it names that one sentence. Not built: "by his rising" he
  broke down the middle wall (Ephesians 2:13-16 gives the cross), one
  lesson.
- **BN-265 -- a point's label a change drops is kept** (2026-11-13, batch
  NG). The model's own edit after the first draft rewrote Palm Sunday's
  third question as a bare line -- block 25, "**A hearer asks:** …" before,
  "Why did Jesus cast out those selling and buying …?" after -- its label
  gone and its answer left: BN-259's case, unseen with no label at all
  (and 7 of 265 held-out lessons ended with a question unlabelled above its
  answer). The window keeps the note as its last read answered (cleared by
  any write since), and in a lesson ask a change giving a labelled block's
  line new words with no label keeps the label the block had -- so BN-259
  sees the question and asks for its answer.
- **BN-264 -- "high places" explained in both its senses** (2026-11-13,
  ab94). Opus held the Habakkuk 3 lesson at Good in three batches (NB, NE,
  NF) for reading "he will make me to walk upon mine high places" (3:19)
  as the trials themselves, the steep places God walks us through. The
  word table (BN-91) now gives both senses the Bible uses: the hilltop
  altars of idols a good king "removed" (2 Kings 18:4), and in a song of
  trust the heights God sets his own on, safe above their enemies
  (Habakkuk 3:19, Psalm 18:33, Deuteronomy 33:29) -- never the trial
  itself; every quote held to the app's KJV by its test.
- **BN-263 -- a lesson's labels written plain** (2026-11-13, ab94).
  Sonnet held batch NF's Palm Sunday at Good for questions its answers do
  not answer -- "What did Jesus do when he went into the temple?" over
  "Because they had turned the place … into a business". Its own edit
  after the first draft had rewritten the three questions and none of
  the answers, BN-259's very case, but with the label written plain, "A
  hearer asks: …", which BN-259 read past (3 questions in NF; NA..NC's
  22 were all in bold). BN-259 reads the label with or without bold now,
  and in a lesson ask (a new lesson, a change, a review, a finish) a line
  that starts with a point's label written plain -- What it means, A
  hearer asks, The passage answers, For example, This week -- gets its
  bold back, the form the readers mark down when it is missing.
- **BN-262 -- a passage word put on Christ after "whose" or a mocking
  verb** (2026-11-13, ab93). Sonnet counted two errors in batch NE's
  Pointing to Jesus: "He was the one whose "bones" were crushed on the
  cross" (David's distress, Psalm 32:3 -- not a bone of him was broken,
  John 19:36) and "He was mocked as "feeble" by the rulers of His day"
  (Sanballat's word for the Jews, Nehemiah 4:2). BN-163's check looked
  for the word after a verb that makes it his (took, bore, became …), and
  neither sentence had one: "whose" and a passive mocking verb (mocked,
  scorned, derided … as) now lead in too. Over every lesson read, they add
  those two sentences and no other.
- **Measured and not built (ab93): Abraham's trust grounded in Genesis
  22:17.** A hearer's answer cited the oath to multiply his seed, spoken
  after the test (Sonnet an error, Opus A = 1); 1 of the 22 Genesis 22
  lessons read cites 22:15-18 so. And "a colt and a foal of an ass" for
  Matthew 21's ass and her colt (Opus), one lesson.
- **Measured and not built (ab91): Isaiah 53 as "crushed".** One reader
  counted Isaiah 53:5 quoted as "crushed" (the KJV's "bruised") in a Mark 5
  lesson's Pointing to Jesus; "crushed for our transgressions" is in 5 of
  the ~2 300 lessons read, four of them unquoted. The KJV wording table
  reads a quoted phrase, and one quoted word is too little to hold to a
  verse; not built at that rate.
- **Measured and not built (ab83): a detail cited to the verse next door.**
  Readers left most at A = 2 (Job 1:3 for the ten children of 1:2). A
  check for a sentence whose words, outside its quote, are a neighbouring
  verse's flagged 32 of 1 217 sentences, nearly all a quote rightly
  referenced with the verses round it summed up -- a nudge on correct
  lessons.
- **Measured and not built (ab84): three one-off stretches.** Mark 10:45's
  ransom handed to the disciples as the way to greatness (one sentence in
  the 42 Mark 10 / Matthew 20 lessons read), "Jesus never denies us" under
  Peter's denial (one), and a 1 John 4 believer who "struggles with anger"
  answered "No" (one lesson, read twice). Love as "the only true evidence"
  that we know God recurs -- six 1 John 4 lessons in four batches -- but
  only two reads of twelve marked it down (Opus, ab84; 4:13 and 4:15 give
  the Spirit and the confession too); not named while readers let it be.
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
