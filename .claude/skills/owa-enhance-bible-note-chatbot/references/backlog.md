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
- **BN-64 — an empty note's card offers nothing to start a lesson.** The
  card a note opens with offers translating, a spelling check, a summary
  and formatting -- none of which an EMPTY note can use. A button such as
  _Help me prepare a preaching lesson_ (the empty-note hint asks which
  passage when none is named) would be one new key in every dictionary,
  each version raised and packed.
- **BN-65 — the lesson readers are English** (part done 2026-11-10). `checkIsLessonWriteAsk` and
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
  line (a model's, not caught: a note's words are never cleaned). Open:
  the other 85 languages' words.
