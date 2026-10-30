---
paths:
  - 'src/chatbot/readerRouteHelpers.ts'
  - 'src/chatbot/bibleContentAskHelpers.ts'
  - 'src/chatbot/bibleReaderChatHelpers.ts'
  - 'src/chatbot/bibleInputSuggestHelpers.ts'
  - 'src/chatbot/verseFindChatHelpers.ts'
  - 'src/chatbot/verseAskLanguageHelpers.ts'
  - 'src/helper/ai/verseFindAskHelpers.ts'
  - 'src/bible-find/RenderFindingInfoHeaderComp.tsx'
---

# Chatbot window: the Bible Reader's asks and the verse finder

Part of the 🤖 help window's notes, split out of `chatbot-window.md` on
2026-10-29 (`AD-22`) so that reading these files loads this part alone. The
window as a whole — tabs, pickers, its language, the caution — is in
`chatbot-window.md`; providers and the model's tools in `chatbot-llm.md`.

- **A question about READING the Bible, asked off the Bible Reader, ends
  with the way back** (2026-10-13, the user, with a picture of _how can I
  open bible_ answered with the Presenter's lookup steps: _the elderly user
  might accidentally changed page to presenter … add extra follow up to let
  user know they also should change page to reader as well as extra option
  to open lookup panel_; `src/chatbot/readerRouteHelpers.ts`, pure, every
  rule a test). `checkIsBibleReadingAsk` reads the question — a Bible word
  and a reading word (read, open, find, look up, where…), and NOT a word of
  presenting (screen, projector, slide, congregation…), which is the
  Presenter's own work — and `genReaderRouteAdvice` adds one last paragraph
  to the answer and a **Go to the Bible Reader** button, the window's own
  `/goto reader` (`BUILTIN_TOOL_NAME`: the person's press, no model's),
  whichever assistant wrote the answer and when none did. **It goes by the
  page the main window is on NOW** (`toMainWindowFocus` over one
  `owa_app_state`, asked for such a question only), not by the tab's
  _asking about_: a tab keeps the page it was opened from, and the stray
  press comes after — seen live, a tab opened from the Reader still read
  _Bible Reader_ with the Presenter in front. Offered on the Presenter and
  the Document Editor; never on the Reader, never in a window of its own,
  never twice. The line goes at the END of the answer's text, not in its
  `note`, which is drawn above an answer.

- **A question about what the Bible SAYS is read as one, not searched as an
  app question** (2026-10-16, `EC-199`, `src/chatbot/bibleContentAskHelpers.ts`
  — pure, every rule a test; found in the user's own tabs with their server
  down). Any Bible question shares its nouns with this manual, so the guide
  handed _what bible verse talk about lover your enemy?_ the Resources page
  and _what are names of 7 churches …_ the Bible-import page, far above the
  score floor: 8 of 10 such questions measured. `readBibleContentAsk` tells
  two kinds: a verse asked for by what it says (→ `answerFromManual` answers
  with Bible Find's page, the words to try named, its walkthrough from
  **Find**, no way across to the Presenter) and knowledge about the Bible
  (→ how to ask an assistant, `/btw` written out, **Open AI settings**).
  Never a question with a reference, about the projector, naming a part of
  the app or what is open, nor _who/where was_ (the names lookup answers
  that); a test holds all 438 supported questions out of both. `askHelpBot`
  sends one there ahead of the where-is reader, and `/help` reaches it
  through `answerFromManual` — which is how it is checked live with no
  assistant to fail. (Since the evening of 2026-10-16 a typed VERSE ask goes
  to the verse finder instead -- below -- so the guide's page answers it only
  through `/help`, and the Bible Find line only when no Bible is installed.) Under an ASSISTANT's answer in the Bible Reader,
  `genBibleFindAdvice` adds one line and **Show me Bible Find** unless the
  answer names Bible Find already: a model answers such a question with
  `/btw` from memory and says nothing of the search on the page. And
  **`needsPage` from a state read counts only under a projector, selection
  or running-order question** (`needsPageBy`, `EC-280`): a model checks
  where it is with `owa_app_state`, which off the Presenter always says the
  Presenter is needed, and three Reader answers had lost their walkthrough
  to **Go to the Presenter** under a sentence about the projector.

- **A typed chapter or verse in the Bible Reader is answered from the
  Bible's own material** (2026-10-18; the user's goal: _chatbot will help
  bible reader have more power_, with _show resource files of john chapter
  3_, _what names in Genesis chapter 4_, _open genesis 3:203_;
  `src/chatbot/bibleReaderChatHelpers.ts`). A typed line in a tab whose
  ASKING ABOUT is Bible Reader that names a verse (`3:16`, `៣:១៦`) or a
  chapter word + number (`chapter 4`, `ជំពូក 4`, `chapitre 4`) with a book
  before it -- or a bare `book + number` in any Bible's own language
  (`Matthew 18`, `ម៉ាថាយ ១៨`, confirmed by `owa_bible_suggest`), or a
  Resources file by name (`MAT.18.pdf`) -- and not a how-to or the app's own
  work, is a `bible-reader` ask: the names lookup, the Resources reader and the verse
  reader are offered together (`AskExtraType.bibleReader`), the installed
  Bibles are read once so a Khmer ask is quoted from the Khmer Bible, and
  the answer is marked `isBibleReaderAnswer` so the next plain line ("and
  chapter 5?") stays in the conversation. The cue words are DATA
  (`bibleReaderWords` in `assistant.json`); English reads in code. A
  **Presenter** tab is left alone -- it keeps `owa_present_bible` -- so
  "show John 3:16" on a projector still puts it up. Under a Resources
  answer, a file the assistant READ offers **Ask about …**
  (`genResourceAskActions`, `RESOURCE_ASK_TOOL_NAME`); the press attaches
  that file to the tab (`attachHandedFileRef`, after
  `resolveResourceFileName`). Seen live 2026-10-18 on the dev Reader in
  Khmer: the Resources list by `ref: "យ៉ូហាន 3"`, Genesis 4's people and
  places, and "Genesis 3 has 24 verses" for 3:203.

- **The ask box completes a passage or a name as it is typed** (2026-10-18,
  the user's picture of the lookup conversation whose box held `១` and
  offered nothing: _assistant should help the input ... book auto complete ->
  chapter -> verse_, then _if for location/name then should recommend the
  auto-complete_). `useBibleInputSuggestions` (`ChatbotAppComp.tsx`) calls
  the hidden `owa_bible_suggest` on a **350 ms debounce per window**, for a
  passage box (a Reader tab, or a `lookupAwaits` line) and a name
  (`Who was …`, every language's `nameAsk`, a bare non-Latin name); a bare
  Latin word is only searched against a dataset a lookup panel already holds,
  so nothing fetches the 34MB speculatively. The rows sit first in the one
  suggestion list and are DATA (`isData`: drawn untranslated); choosing one
  **keeps the list open**, because it is one step -- book, then chapter, then
  verse (a chapter's fill ends in a colon). A passage box's rows win over
  the corpus ones, and an awaited passage shows them too. Hidden from the
  model (`MODEL_HIDDEN_TOOL_MAP`), so the model's list and ratchet are
  unchanged. Seen live in Khmer: `យ៉ូ` -> the five books, John -> chapters,
  chapter 3 -> verses, `ម៉ូសេ` -> Moses/Moseroth.

- **A verse somebody half-remembers is found in a conversation of its own**
  (2026-10-16, `src/chatbot/verseFindChatHelpers.ts`; the user's ask with
  Bible Find circled, then four more the same evening). The way in is the
  robot at the right end of Bible Find's **[en:tran:All Books]** row,
  **[en:tran:Find a Verse with the Assistant]** (`RenderFindingInfoHeaderComp`):
  `openChatbotAsking` with `Help me find a Bible verse in "KJV"`, a sentence a
  person could type too, written and read by the leaf
  `src/helper/ai/verseFindAskHelpers.ts`; the chat starts it in a new tab
  (`takeHandoff`, on the window's focus AND on main's `chatbotLaunchFocus`
  -- with the window already open, Windows did not always focus it and the
  press did nothing, 2026-10-17; with the strip full, an empty tab), and
  the typed sentence or the corpus row _Can you help me
  find a Bible verse I forgot?_ starts it in the tab in front. **Two steps by
  buttons, no model** (`VERSE_FIND_STEP_TOOL_NAME`, the whole step in the
  args): **Which Bible should I search?**, every installed Bible, Find's
  first and marked _(the one in Find)_ (a typed short name, number or title
  word picks one too, `readVerseFindTypedPick`), then **What do you
  remember about the verse?** with **Search another Bible**. That answer
  carries `verseFind` (the Bible), persisted on the message, and **every
  plain line typed under such an answer is more of the same search**
  (`readVerseFindThread`) until a `/` line or the app's own work (_put it on
  the screen_, _how do I save it_) ends it; meanwhile the box offers no app
  questions. **The assistant is asked under a prompt of its own**
  (`AskExtraType.verseFind` → `VERSE_FIND_SYSTEM_PROMPT`, ~420 tokens, its
  own cached prefix) with `owa_find_verse` and `owa_read_website` as its only
  tools and five rounds at most -- 5k tokens for the answer seen live, where
  an ordinary question carries ~8 350 of schemas a round. It tries every
  way: the words, the words a described verse would use, other forms, the
  KJV with what it translated to English, references it thinks of read with
  `refs`, then a web search page; it names only verses a search or a read
  returned from THEIR Bible, and each one it names gets **Open … in Bible
  Lookup** (`genVerseOpenActions`, off the tool watch's `foundVerses`, in the
  order the answer names them). **The Bible can be changed under every
  answer** (2026-10-17, the user's picture of John 14:6 quoted in French in a
  Khmer window: _I'm looking in khmer then I should be able to change to
  english_; `genVerseChangeBibleAction`): **Show in another Bible** under
  verses found, **Search another Bible** under none -- a step button carrying
  `current` (left out of the list), the `words` and up to five `verses`
  (key + ref, read again at the press, `toVerseFindCarry`). A Bible picked
  with verses quotes them from itself by `refs`, no model
  (`genVersesInBibleAnswer`); with words alone the window asks the one line
  for them (`toVerseFindSearchAgainAsk`, echoed as the pick), so the head
  start, the assistant and the window's own search all run. Either way the
  tab searches the new Bible from then on; with no other Bible the answer
  offers the import. **Nothing found** -- no verse the answer
  names, or the guide's own search empty -- ends with a Google link written
  out and drawn as a link (`genVerseWebSearchLine`,
  `https://www.google.com/search?q=bible+verse+…`, an address the APP wrote)
  and **Search Google for it** (`VERSE_WEB_SEARCH_TOOL_NAME`, a pseudo tool:
  the address is built at the press from the words). **With no assistant**
  the window searches the words itself (`answerVerseFindOffline`): the
  verses holding the most of them, _(4 of 4 words)_, a button each, and words
  not in that Bible's language said so, never _make sure the main window is
  open_ (the user's own Khmer tab, the free service failing). **Every answer
  names its model** (the user's ask with _free_ circled under an answer):
  `answeredBy` on the message, from the last round's provider and model in
  the pickers' own words; the cost line reads _Nemotron Super VL · free · 5k
  tokens_ and its hover, and the **Assistant** label's, _Model: Free ·
  Nemotron Super VL_. **The window searches FIRST** (2026-10-16, the goal
  the user set: _chatbot be smart enough to help user find verses he/she
  forgot_; `genVerseHeadStart`): before any model round it searches the
  chosen Bible for their words, and -- for words in another script
  (`checkVerseFindNeedsTranslation`) -- asks a **Gemma 4** model that can
  answer at no cost for the English in KJV wording (`translateVerseWords`:
  one round, no tools; the user's word, _for any translation attempt please
  prefer Gemma 4 models_) and searches that too, the tool crossing to the
  KJV by itself and quoting back from the chosen Bible. Both lists ride the
  ask (`toVerseHeadStartAsk`, five verses each, cut at 160 characters) and
  seed the tool watch (`AskExtraType.verseFind.found`), so a verse the model
  names from them gets its button with no search of its own; with no
  assistant they ARE the answer (`genVerseHeadStartAnswer`). On **Auto** a
  verse in another script goes to a Gemma 4 model first
  (`AutoRankOptionsType.preferModelPattern`, after setbacks, busy servers and
  an unloaded LM Studio). Measured on the user's Khmer phrase: 41.4k tokens
  over five rounds on the free model before; 3.6k on the local gemma-4-e4b
  with the head start, John 21:17 found. **One line does it all**:
  `Help me find a Bible verse in "KJV": love your enemies` starts the
  search with no step in front (`readVerseFindAsk`'s `remembered`).
  **And a verse asked for by what it says in ANY chat** -- _which verse
  says do not worry about tomorrow_, `readBibleContentAsk`'s verse kind
  (EC-199) -- is that search too, in the Bible the lookup is on, from the
  words the question is about (`EC-285`): an assistant had answered it from
  memory in another translation's words, under **Show me Bible Find**.
  Measured on the standing set
  (`.claude/skills/owa-enhance-chatbot/references/verse-find-asks.json`,
  scored by `scripts/score-verse-find.mjs`): 20 of 20, the typed five from
  17.6-37.1k tokens with no verse to open down to 2.1-6.8k with every one.
  **A story is answered with where it is told, and a word with every verse
  that holds it** (2026-10-22, `EC-387`..`EC-391`; the user's ask: _make the
  chatbot super smart that can find everything in the bible_, with the
  verse finder and Find's 🤖 circled). The search names `passages` and
  `byBook` (`agent-tools.md`); the head start carries them to the model
  (_Where these words gather (a story is told there): Genesis 7-9 (title:
  លោកុប្បត្តិ ៧-៩)_, _74 verses hold them in all; by book: …_), and
  `VERSE_FIND_SYSTEM_PROMPT` says to answer a story with its chapters first and
  a word with how many and where. A passage is a FOUND verse too
  (`readFoundPassages`: its key opens the strongest chapter whole,
  **Open លោកុប្បត្តិ ៨ …**), named when the answer names any chapter of it in
  any digits or as a range (`6-9`, `៦ ដល់ ៩`), never by a verse of it.
  **Every verse with these words** (`EVERY_VERSE_LABEL`, a
  `VERSE_FIND_STEP_TOOL_NAME` step `more`, no model) lists eight at a time
  with where they gather and **More verses** while there are more -- under a
  head-start or offline answer, and under a model's answer when the window's
  own search found more than it showed (`verseFind.canBrowse`). **An answer
  that quotes a verse no search returned goes back once**
  (`findUnreadVerseNudge`, both loops, never on the last round): seen live,
  `shepherd` handed from Find was answered with John 10:11 in words of the
  model's own. **A story asked for by its name routes here**: _where in the
  bible is the story of the flood?_, _show me the story of Jonah_ (English,
  `bibleContentAskHelpers.ts`), _តើរឿងទឹកជំនន់នៅក្នុងគម្ពីរណា?_ (Khmer
  `verseAsks`) -- both had gone to the general assistant, the Khmer answer
  naming a book the Bible does not have. **French reads them too**
  (2026-10-29, `EC-441`: `verseAsks`, `verseFindAsks` and the exit's
  `verseAskExcludeWords` in `fr/assistant.json`; a verse pattern compiles
  case-blind). What makes a verse asked FOR the app's work instead is
  `checkIsAppWork` (`chatbot-lookup.md`, `EC-440`): _ខគម្ពីរណាដែលនិយាយថា
  ច្រៀងចម្រៀងថ្មី_ (sing a new song) is searched as its English is; the exit
  from a search keeps its own list, read as whole words, and no Bible word
  in it (`EC-443`: _he shall save his people_ had ended the search; save,
  copy, present end it only aimed at what was found, _save it_). English
  presenting is the presenter's words, so _present your bodies_ (Romans
  12:1) is searched (`EC-445`). **And knowledge about the Bible is read in
  every language** (`EC-444`, `readAnyBibleContentAsk` -- the guide's one
  reader -- with `bibleKnowledgeWords` per language): with no assistant,
  _Qui a écrit le livre des Psaumes ?_ is the way to one, as its English
  is, never a manual page. **Find's 🤖 carries the words typed
  in Find** (`genVerseFindAsk(bibleKey, findText)`): with words, the tab
  searches them at once in Find's Bible, no _Which Bible?_ first
  (`handedVerseAsk`, asked once its new tab is in front -- `handleAsking`
  asks in the tab it last rendered with); with none, the Bible list as
  before. Measured on `bible-find-asks.json` (22 rows, gemma4:cloud, Khmer
  window; `score-verse-find.mjs` reads a button in any language and scores a
  story twice -- FOUND, and PASSAGE: a chapter or 3+ verses opened inside
  where it is told): 20 → 22 of 22 found, 3 → 15 of 16 passages, 2 wrong
  answers → 0, median tokens 2.6k → 2.9k, the largest 10.9k → 6.7k.
