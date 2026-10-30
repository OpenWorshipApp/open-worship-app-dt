---
paths:
  - 'src/chatbot/lookupChatHelpers.ts'
  - 'src/chatbot/lookupStepHelpers.ts'
  - 'src/chatbot/wordStudyHelpers.ts'
  - 'src/helper/ai/lookupAskHelpers.ts'
  - 'src/helper/ai/bibleItemAskHelpers.ts'
  - 'src/location-name-lookup/LocationNameDetailPanelsComp.tsx'
---

# Chatbot window: a person, a place or a passage

Part of the 🤖 help window's notes, split out of `chatbot-window.md` on
2026-10-29 (`AD-22`) so that reading these files loads this part alone. The
window as a whole — tabs, pickers, its language, the caution — is in
`chatbot-window.md`; providers and the model's tools in `chatbot-llm.md`.

- **A person, a place or a passage is asked about from its Lookup Detail
  panel** (2026-10-18, the user's picture of three panels — a verse, Adam,
  the Garden of Eden — the left of each title circled: _add robot icon,
  click to open chatbot, make sure mcp tool provide all information to
  chatbot session then let user interact_; the story _as a user I want to
  ask the chatbot about location/name/bible by opening from the detail
  panel_; and _chatbot should know the location/name is from KJV, in case
  want to know_). The 🤖 at the LEFT of every detail panel's title
  (`RenderAskAssistantButtonComp` in `LocationNameDetailPanelsComp.tsx`,
  **[en:tran:Ask the Assistant About This Person]** / **Place** /
  **Passage**, drawn only while AI is on, like the Resources panel's)
  hands over WHICH record, never its words: `openChatbotWithLookup` → the
  🤖's two questions → `chatbot-handoff-lookup` (`requestChatbotLookup`, 30
  s), the request written and read by ONE leaf with no imports
  (`src/helper/ai/lookupAskHelpers.ts`: kind, the panel's own target — a
  record id or a short verse —, the title it shows, the passage's Bible or
  the record's lookup language, and the address of the window the panel is
  in). The window takes it in a tab of its own (`takeHandoff`) and reads
  the record ITSELF, with no model, through `owa_lookup_record` in the
  panel's window — where the ~34 MB names dataset is already held — and
  anywhere when that window has gone (`openHandedLookupRef`); what came
  back is kept on the card (`ChatMessageType.lookup`, bounded at 16 000
  characters, checked field by field on load) and the card says it was
  read — _drawn from the King James Version_ for a person or a place — with
  three questions to press. **Every plain line under it is about that
  record** (`readLookupThread`, `lookupChatHelpers.ts`, pure, every rule a
  test): it is asked with the record fenced as DATA in the conversation,
  never the prompt -- as its FIRST turn when it was read
  (`toLookupRecordTurn`, `EC-418`), else under the question with how to
  read it (`toLookupAsk`) --, under a short prompt of
  its own (`AskExtraType.lookup` → `LOOKUP_SYSTEM_PROMPT`, its own cached
  prefix) with `owa_lookup_record` and `owa_read_website` as its only tools
  for five rounds — the record tool aimed at the panel's window by the
  loop (`ToolWatchType.lookupPage`) —, no known-question hint, no Bible
  Find advice, no verse search and no walkthrough; translated both ways like
  any other ask. Its answers carry `isLookupAnswer` (a failed one too), and
  a `/` line, another kind of answer, or the × of the
  **[en:tran:Still asking about]** line above the box (`lookupClosedAt`,
  like a file's) ends it; meanwhile the box offers no app questions. The tab is named by
  the record (`genChatSessionTitle`). With no assistant the window shows
  what the app holds on it (`genLookupOfflineText`) and **Open AI
  settings**. **A passage being read opens the same conversation** (the
  same day, the user's picture of a Bible view's toolbar circled: _add robot
  icon to part of the icon and add contextmenu to verse preview content. to
  open the verse in chatbot like open from floating verse detail panel_):
  the robot at the end of every Bible view's toolbar
  (`RenderAskAssistantBibleItemButtonComp`, in both the plain and the
  editing view's group) and, on its right-click,
  **[en:tran:Ask the Assistant About This Verse]** — the verse under the pointer, read off its
  `data-verse-key` (`readBibleVersesKey`), left out when the passage is
  that verse — and **[en:tran:Ask the Assistant About This Passage]**
  (`genAskAssistantContextMenu` in `BibleViewComp.tsx`), each a verse
  request through `bibleItemAskHelpers.ts`, imported at the press.
  **A record's inline references are written as the lookup's Bible writes
  them** (`toLocalizedReferences` in `agentLookupHelpers.ts`, as the panel
  draws them): seen live, the Khmer dataset's `[Genesis](book-key://GEN)`
  came back in a Khmer answer as _Genesis_.
  **And there is a lot to DO with it, by buttons, with no model**
  (2026-10-18, the user's picture of a chat about Genesis 4:1-26: _add more
  options, like open another verse or open other bible key, and more
  option to let user able be to do a lot of things on bible_;
  `lookupStepHelpers.ts`, pure, every rule a test). Every button is
  `LOOKUP_STEP_TOOL_NAME`, a pseudo tool no model can press, carrying the
  record it acts on (its listed fields only, never the words read of it), so
  an old button acts on its own record. A passage's card carries **Open in
  Bible Lookup** (`owa_find_verse` `open`), **Previous** / **Next chapter**
  (**verse** for a single verse; `owa_lookup_record` `near`, across books),
  **Read it in another Bible** (every other installed Bible a button),
  **Who and where is in it** (`names`: the people and places a button
  each), **Open another passage** (`lookupAwaits` on the answer: the line
  typed under it is read as a passage in that Bible, asked again when it
  cannot be), **Save to my Bibles list** (`owa_bible_item` `add`) and **Copy
  the passage**; a person's or a place's card **Its verses** (the quoted
  ones), **Family and places** / **Related places** and **Read it in another
  Bible**. A name, a place, a verse or a Bible pressed off a list opens its
  own card in the same tab, which the conversation is then about. Every
  answer under it ends with **Previous** / **Next** for a passage and **More
  things to do** (`genLookupAnswerActions`). Labels are stored in English and
  drawn with `tranLabel` (`LOOKUP_ACTION_LABEL_LIST`, held by
  `chatTranLabels.test.ts`), or are the name or reference itself.

- **A line under a passage card is answered by the card, or by the app's own
  help, when it asks for that** (2026-10-19; the user's goal: _make chatbot
  very smart to handle user interaction (asking) on given holy bible verse_).
  Measured on gemma4:cloud, Khmer, a KJV passage card: _show this passage in
  Khmer_ came back as an invented Khmer translation of the KJV (one round, no
  tool call) while the installed Khmer Bible's words sat in the record, and
  _how do I save this?_ was refused with **Save to my Bibles list** on the
  card. `readLookupVerseAsk` (`lookupChatHelpers.ts`) answers these with NO
  model: a language named beside a showing verb repeats the record when it is
  already that language, and otherwise lists only the Bibles in it
  (`genBiblesAnswer`'s `preferLanguage`; the record's language is its script,
  or its own function words for English against French); save, copy, the
  Bible Lookup and the neighbouring chapter name the card's button and carry
  it under the line, never pressing it. A how-to or the app's own work that
  is none of those (`checkIsLookupAppAsk`, the same `checkIsHowTo` /
  `checkIsAppWork` the Bible-Reader ask uses) goes to the ORDINARY assistant,
  with the passage and the card's buttons in the user turn
  (`toLookupAppAsk`) and no `lookup` tool map — so _put this passage on the
  screen_ is answered by the guide with the Presenter's route. The answer
  still marks `isLookupAnswer`, so the next plain line is about the passage.
  `lookupWords` is per language in `assistant.json`; the ordinary tool list
  and its 8 350-token ratchet did not move.

- **The same line goes the same way in every language** (2026-10-29,
  `EC-440`; the user's three pictures of Noah's card, _what is the size of
  noah ark_ answered from the record in English and Khmer and _Quelle est
  la taille de l'arche de Noé_ sent to the guide, which said to type
  `/btw`). The app's-work check under a card is `checkIsAppWork`, and each
  language's words were its own: French `taille`, Khmer `ទំហំ`, English
  `save` / `Mark` / `help` each took a Bible question to the guide in one
  language. **An app word the language's Bibles use** (five verses or more
  in the old or the modern Bible, counted per word) **counts in a how-do-I
  only** — `ENGLISH_SHARED_APP_WORK_PATTERN`,
  `bibleReaderWords.excludeInHowTo` — and the rest anywhere (`exclude`); a
  how-do-I is what the PERSON does (`bibleReaderWords.howToAsks`: French
  `comment` before a lower-case infinitive, Khmer `ខ្ញុំ` with a how-word),
  never any "how". `src/chatbot/chatLanguageParity.test.ts` asks 63
  questions alike in English, Khmer and French and holds every one to one
  route, and every translated supported question out of the Bible readers;
  a word added to one language that moves a row fails there. **A
  person's or a place's verses come from a Bible in the answer's language**
  (`EC-442`): the record is read in the Bible being read, so with the
  Reader on the KJV a French answer quoted English. The window lists the
  Bibles (`owa_find_verse` with no arguments, `books` on one of fewer than
  66 — a New Testament had been picked for Genesis and ran out of rounds),
  picks a whole one in the language (`pickBibleInLanguage`, shared with the
  verse finder) and passes it as `AskExtraType.lookup.quoteBible` with a
  line under the question, never in the record turn. A passage card keeps
  the Bible it was opened in.

- **A person's family line is read from the Bible, never from the record**
  (2026-10-19, `EC-369`). Asked under David's card _ឈ្មោះតាមលំដាប់ពីដាវីឌដល់
  ព្រះយ៉េស៊ូវ_ (names in order from David to Jesus), gemma4:cloud answered
  in ONE round with no tool call, off the record's `children`, ending "this
  record does not show every person in order" and sending the user to
  **Family and places** — the record holds a person's own sons and parents
  and nothing further, and the Bible gives the whole line in Matthew 1. The
  card now carries **Family line to Jesus** (a `lineage` step,
  `lookupStepHelpers.ts`), and a typed question that names Jesus (or a
  family-line word beside the person, `checkIsLookupLineageAsk`) runs the
  same step with no model. The window reads `MAT 1:1-17` first and
  `LUK 3:23-38` when Matthew does not name the person (Luke runs back
  through Nathan to Adam), **by verse KEY** — a worded reference comes back
  cut to ~300 characters (`EC-366`) — in the record's own Bible, and answers
  with the passage's words and **Open in bible lookup** / **Open another
  passage**. The words are DATA (`lookupWords.lineage` / `.jesus` in
  `assistant.json`); the ordinary tool list and its ratchet did not move.
  Seen live 2026-10-19 in Khmer on gemma4:cloud: David's card and the typed
  question both answered with Matthew 1:1-17 from `ពគប`, and Adam's answered
  with Luke 3:23-38. **A "how many" question is counted by the window**
  (`readLookupCountAsk` / `genLookupCountAnswer`, `EC-371`): asked _តើលោកមាន
  កូនប៉ុន្មាន?_ the model said "20" over a list of nineteen names, so the
  record's own `children` / `spouses` / `siblings` / `parents` list is
  counted and every name named, no model round. The words are
  `lookupWords.count` and one list a field. **And the lookup ask offers
  `owa_find_verse`** (`MODEL_ASK_SHARED_TOOL_MAP`, `EC-372`): the record's
  own verse list is a curated few, so a theme or a half-remembered verse is
  the Bible searched by words — the assistant is told to name only what
  that search returned. It costs ~356 tokens a round (2026-10-29; ~280 when
  added) in a lookup ask alone;
  the ordinary list did not move.

- **A person or a place is answered from the record, the reader's own Bible
  and its map** (2026-10-22, `EC-397`..`EC-403`; the user with the Names
  and Places row menu circled: _make the chatbot to be super smart that can
  answer everything about location/name_; measured on
  `.claude/skills/owa-enhance-chatbot/references/lookup-khmer-asks.json`,
  25 questions in Khmer: 11 right / 5 partly / 9 wrong → 22 / 3 / 0). The
  record says a person's other names, its namesakes, a place's distance
  from Jerusalem, its neighbours and its people (`agent-tools.md`). **As a
  person's or place's card opens the window searches the Bible being read
  for the name** (`toLookupBibleSearch`, `withLookupBibleSearch`,
  `withCardBibleSearch` — one `owa_find_verse`, ~0.5 s) and keeps
  `bibleSearch` on the card: total, books, the first keys, their words when
  six or fewer — the record's list is the KJV's curated few, and the KJV
  says "Armenia" where the Khmer Bible says អារ៉ារ៉ាត. A place with a point
  carries **[en:tran:Show it on a map]** (`toLookupMapUrl`, the detail
  panel's own Google Maps search, built by the window from the record), and
  a typed map ask (`lookupWords.map`) is answered with that button, offered
  and not pressed. **Only the app's WORK leaves the record's conversation**
  (`checkIsLookupAppAsk` is `checkIsAppWork` now): _what does the name Noah
  mean?_ holds Khmer's how-word and had gone to the guide. **Jesus and the
  person are not a family line** without an in-order word
  (`lookupWords.lineageOrder`): _did Jesus speak about Noah?_ had answered
  "neither genealogy names Noah"; a genealogy finds the person under any of
  their names (Noe in Luke 3:36). The prompt reads the new fields, lets the
  model say where a place is TODAY and a rough distance as an estimate, and
  says to read a prophecy or saying by ref. **Scripture quoted in words
  nothing gave goes back once** (`findMisquoteNudge`, both loops, never the
  last round): a quoted span of 24+ letters that neither the question with
  its record nor any record or verse read of the ask holds, compared on
  letters alone. Driver: `scripts/lookup-run.mjs` (it opens the conversation
  through the row's own handoff, so run it on a scratch profile).

- **A passage's chat finds everything related to it** (2026-10-23,
  `EC-408`..`EC-413`; the user with a Bible view's 🤖 conversation on
  Genesis 8:1-22 circled: _make the chatbot to be super smart that can
  answer everything about selected verses_, then the goal _help user find
  everything related to the selected verses_; measured on
  `.claude/skills/owa-enhance-chatbot/references/passage-khmer-asks.json`,
  15 questions in Khmer on gemma4:cloud: 4 / 4 / 7 → 15 / 0 / 0 right /
  partly / wrong in two runs, English shown 3 → 0). Before, a question about related
  verses had nothing to answer from: the record held the passage alone, so
  _which other verses relate to this?_ was sent to **Previous chapter** and
  _other altars like verse 20?_ answered from memory (Genesis 22:5). Now a
  passage's CARD reads its record with `related: true` (`toLookupCardArgs`):
  the app's own cross references (`agent-tools.md`), in the Bible's
  language where the app has that bundle, ride every question of the
  conversation as `crossRefs`, and the chapter's Resources files are listed
  once as the card opens (`withCardStudyFiles`, `owa_resource_file list`)
  and kept as `studyFiles`; the person's own notes that name its verses and
  the words they highlighted or commented on there ride it as `yourNotes`
  (`EC-423`, `readBibleNoteIndexes`). The card says how many of each, offers
  **[en:tran:Related verses]** and **[en:tran:Study files for this chapter]**
  first (`crossrefs` / `files` steps, no model; each answer ends with the
  conversation's **Previous** / **Next** / **More things to do**, since
  buttons are drawn under the newest answer only) and _Which other verses
  are related to this passage?_ as its first question (second, after _What
  did I note on these verses?_, when the person has notes on it). A reference pressed
  opens its own card, with its own related verses. `LOOKUP_SYSTEM_PROMPT`
  answers related verses, parallels and the other Testament from
  `crossRefs` first, then any the model knows read by ref, and never sends
  a Bible question to a button. In such a chat a verse read or search the
  model sends without a Bible goes to the record's (`checkReadsInRecordBible`:
  `MAT 18:18-35` had been quoted from the KJV, in English, under a ពគប
  card). A record past the card's 16 000 characters sheds what a read can
  bring back -- the cross references by verse, then the rest, a name's
  search, the people and places -- rather than being cut into JSON nothing
  can parse (`fitLookupFacts`). The other Testament is read off the
  chapters AROUND the passage too (`otherTestamentAround`, `EC-416`): the
  bundle ties Jesus on the days of Noah to Genesis 6-7, never to 8, and
  **Related verses** shows them under their own heading. An answer that
  says the Bible does not say it, with no tool called, goes back once to
  read the chapter around it and write the answer afresh
  (`findNotStatedNudge`, words `lookupWords.notStated` per language,
  `EC-415`; never when the window read for the question,
  `lookup.isReadForAsk`, `EC-427` -- _people whose names are not stated_
  had sent a right answer back): _how long was Noah in the ark?_ is Genesis 7:11 to 8:14, one
  year and ten days. And an abort nobody pressed Stop for is said as a
  failure (`checkIsCancelError` with a signal is that signal aborted and
  nothing else, `EC-414`): a question had ended with its echo and not a
  word under it. **What a line asks of the passage's surroundings is
  read by the window first** (`readLookupAskContext`, `EC-419`/`EC-421`):
  a verse named by number (`lookupWords.verseNumber`) has its own cross
  references read, every theme; before, after or a length of time
  (`beforeAsk` / `afterAsk` / `timeAsk`, both sides for a length) has the
  verses the record's `around` names read -- the rest of its chapter, or
  the chapter before or after; never `near`, which skips to the next
  chapter -- and who or which places are in it (`namesAsk`, `EC-426`) has
  the passage read with `names`, the 34 MB dataset for that question only;
  all of it goes under the record (`toLookupContextText`), so a
  model answering in one round answers from them. The record costs ~3 500
  more input tokens a question in a passage chat (~4.6k → ~8k on
  gemma4:cloud), ~9-12k when a verse or a side was read for it -- read
  ONCE a conversation by a server that keeps its start, since the record
  heads the conversation (`withRecordTurn`, `EC-418`: a local Ollama's
  second question 112 s of prompt → 4.4 s).

- **A passage's words are studied verse by verse, word by word**
  (2026-10-23, `EC-428`; the user, studying Genesis 8 in the Greek Bible
  in a Khmer window: _give option like study vocabulary then choose verse
  (if more than one verses) then list word to choose or choose all then
  explain the word_, _also have option to open the word in google search_;
  `wordStudyHelpers.ts`, pure, every rule a test). The card carries
  **[en:tran:Study the words]** (a `words` step); a passage of several
  verses lists them, a button each with its first words in its Bible's
  digits (24 a page, **[en:tran:More verses]**), and a verse lists its
  words in order, each once (split at spaces and at the zero-width spaces
  a Khmer Bible puts between words, `Intl.Segmenter` for a long unspaced
  run; 30 a page, **[en:tran:More words]**), **[en:tran:All words]** first,
  the verse above them -- all read off the card's own record with no model,
  a verse the record cut short (its 6 000 characters end in `…`) read
  again by its key (`readStudyPlace`). A word or **All words** pressed is
  ONE ask in the passage's conversation (`handleWordStudyRef` →
  `handleAsking`'s `lookupStudy`): a short ENGLISH question (what the
  translation is planned on, so a Khmer or Greek word is never put through
  the question's translator), the verse as its Bible writes it and how to
  teach it under the record (`toWordStudyContext`: dictionary form, how to
  say it in the answer language's letters, kind and form, meaning, meaning
  here; a whole verse one line a word), `isReadForAsk` so no not-stated
  nudge, none of the passage's typed-line readers, nothing in the box
  cleared or sent with it, and the answer keeps the verse's script
  (`toPassageAnswerKeep`). Under the lesson: the next word,
  **[en:tran:Choose a word]**, a Google search (`wordWeb`: `toWordSearchUrl`,
  built at the press from the word ALONE, never a model's words nor the
  verse -- with its reference the search came back about the verse, the
  user's _I'd like to learn the word not the verse_, `EC-434`: the word
  quoted, a Greek grave written as its acute, and the language its letters
  say, `"Θεός" biblical Greek word meaning`, which brings a lexicon up
  first) and **[en:tran:More things to do]**; under a verse's every word,
  **[en:tran:Next verse]** and **[en:tran:Another verse]**. Typed under the
  card, `lookupWords.vocabulary` (data per language) is the button, or with
  a verse of the passage named, that verse's every word
  (`readLookupWordStudyAsk`). **A verse's or a word's button is DATA**
  (`BotActionType.isData`, `.cue-act-data`, `EC-430`): drawn as written,
  never through the dictionary and never in the action row's capitals,
  which had turned _τῇ_ into _ΤΗΙ_. Seen live in Khmer on gemma4:cloud: a
  Greek word in 1 round, 2.5 s, a verse's 22 words in 3.7 s with every
  Greek word kept. Bible Find cannot search a Bible in a language the app
  holds no data for (`EC-431`), so there is no "other verses with this
  word" button yet (`EC-432`).
  **Hebrew and the lesson's own words** (2026-10-23, measured on
  `.claude/skills/owa-enhance-chatbot/references/word-study-asks.json`,
  Hebrew, Greek, Khmer and KJV lessons pressed through the card, gemma4:cloud
  in Khmer: 4 / 10 / 2 → 12 / 4 / 0 right / partly / wrong on the same 16).
  A verse's words also part at the Hebrew maqaf, and are one word whatever
  their chant's accents or a Greek grave (`toStudyWordKey`: Genesis 1:7 had
  17 buttons for 14 words); an elided Greek word keeps its mark (`ἀλλ’`).
  A lesson is ONE round with no tool (`AskExtraType.lookup.isStudy`): three
  in fifteen had read their verse again, ~16k tokens and the English
  reference in a Khmer answer. `toWordStudyContext` takes the answer's
  language: what "its form" is in Greek or Hebrew (`GRAMMAR_HINT_LIST`, the
  Hebrew stems in Hebrew letters -- named Qal, they came back in Latin), every
  label and grammar word in the reader's language, **All words** lines
  parted by " — " with no label words (it had written _(dictionary: …)_ in
  English seven times), and no way to say a word written in the reader's own
  script (both Khmer lessons had romanised it). A verse word copied with
  another script's letter in it (`הָאָֽរֶץ`) is put back as the verse writes
  it (`repairStudiedWords`), and the cleaner drops a third script's sign on
  the language's own letter. The Google search spells a Hebrew word as a
  lexicon does, without its accents.
