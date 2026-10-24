---
paths:
  - 'extra-work/build-knowledge.mjs'
  - 'docs/manual-sources/**'
  - 'tools/owa-devtools-mcp/questions/**'
  - 'tools/owa-devtools-mcp/help*.mjs'
  - 'tools/owa-devtools-mcp/tran*.mjs'
  - 'tools/owa-devtools-mcp/question*.mjs'
  - 'src/chatbot/questionHelpers.ts'
  - 'src/chatbot/recipeIdHelpers.ts'
  - '.claude/skills/owa-robot-test/references/user-workflows.md'
---

# Agent knowledge: the manual, labels and the question corpus

What the assistant answers FROM and how a question finds it. The rules that hold
everywhere (rebuild the knowledge after any `.claude/` edit; change the corpus
with the knowledge) are in `.claude/CLAUDE.md` §Agent access.

- **Knowledge**: `extra-work/build-knowledge.mjs` (part of `electron:build`)
  bundles `docs/manual-sources/**` (kind `manual`) and an ALLOWLIST of
  `.claude/` — `CLAUDE.md`, `rules/`, `memory/`, `skills/` — (kind
  `internal`) into
  `electron-build/knowledge/` with a search index, so answers
  are one file read, not 140. The main process passes the path in through
  `OWA_KNOWLEDGE_DIR`.
  It also lifts the app's own `tran()` dictionary out of
  `src/lang/data/<code>/index.ts` into `knowledge/tran.json`.
  **The manual is indexed WHOLE and the internal notes to their first
  3 000 characters** (2026-09-10): W-42 and W-22 run past 30 KB, and with
  every page cut at 3 000 the help window's own page was searchable to
  its step 1 — _spending limit_ found an internal banner and no manual
  page, and the assistant said the app had no such setting. The manual is
  what answers come from, so it costs the index its whole ~200 KB; the
  185 internal notes would cost megabytes read on every search. **Whole
  means under the page cap, which a test now holds** (2026-10-16,
  `EC-284`): the help window's own page passed the old 60 000 characters
  by itself and everything after that character left the search with
  nothing said — _Can you write the notation for words I paste in?_ lost
  its page the day eight lines went in above its answer. The cap is
  `MANUAL_SEARCH_TEXT_LIMIT` 120 000, the build prints a page it cuts, and
  `src/test-setup/knowledgeIndexLimit.test.ts` fails the gate on a page at
  or over it. **`npm run docs:gen` rebuilds the knowledge too** whenever a
  built app is there (`EC-279`): it had regenerated the pages only, and two
  manual fixes marked done one morning were still the old words in the
  running app that afternoon.
  **Every edit under `.claude/` — `CLAUDE.md`, `rules/`, `memory/`, `skills/`
  — must
  re-run `node extra-work/build-knowledge.mjs` in the SAME change**, or the
  chatbot keeps answering from the previous text. Run that script ALONE while
  the app is up (`npm run build` / `electron:build` `rm -rf`s all of
  `electron-build/`, the running app's own main entry; this one clears only
  `knowledge/`). No restart is needed — `listKnowledgeEntries()` re-reads
  `index.json` per call — unlike a change to the MCP `.mjs` modules. **Nor
  does it relaunch a dev app any more** (2026-10-11, `AD-16`):
  `electron:watch` is nodemon on `electron-build` AND `tools/owa-devtools-mcp`
  with `--ignore electron-build/knowledge`. Until then the rebuild's
  `index.json` restarted an app another session might be driving (2026-09-14,
  three sessions on one dev app; the rebuild ran in 23 of 40 sessions), for a
  bundle read per call. Any save in the MCP package still relaunches it, and
  that relaunch can quit at once; touch a watched file to get it back. An
  `electron:dev` started before the change keeps the old watch until it is
  restarted.
- **Labels are i18n templates**: the knowledge is English, the buttons are not.
  A document names a control as `[en:tran:Clear Long Text]`, never as an English
  label with a hand-written Khmer twin beside it, and `tran.mjs` fills it in
  with what that key reads as in the language the app is DISPLAYING — so
  `owa_help_search`, `owa_help_page` and a guide card built from a recipe all
  come back already in the user's own language, and a guide's `find` matches the
  DOM instead of missing every control in a Khmer window. `owa_tran` answers the
  same question for a label the model wrote itself, and `owa_find_ui` /
  `owa_click` / `owa_type` try the translation when the English label matches
  nothing. The key must be a real `tran()` key: an unknown one silently falls
  back to its own English text, so `tran.test.mjs` walks the whole corpus and
  fails on one that no language can translate — and on a twin coming back. The
  knowledge stays English; the chatbot's ANSWER is in the app's language since
  2026-10-16 (memory `chatbot-follows-app-language`): the model reads the
  English page and writes in theirs. **A question in Khmer is searched by the
  English words it names** (`queryLanguage.mjs`, through `searchHelp`): the
  app's own dictionary read backwards (a short label → its English key, which
  is how the manual writes it) plus the language's glossary in
  `assistant.json`, longest phrase first and ending only where a letter ends;
  a multi-word label counts as the phrase and as its words, so a Khmer
  question ranks the pages its English wording does. `toTerms` keeps `\p{M}`
  -- splitting on Khmer vowel signs had cut every word into pieces no page
  holds. Not `Intl.Segmenter`: Electron's ICU and Node's split Khmer
  differently, and the search runs in both.
- **The corpus and the manual in the app's other languages** (2026-10-16,
  memory `chatbot-follows-app-language`). `questions/i18n/<code>.json` holds
  each row's words (`{ en, text }`, by `<page>.<section>.<id>`) and each
  section's -- fill-in rows too since 2026-10-17, each keeping an example of
  the same kind as the English (`...`, an address, a quoted name, a
  reference; a name may be the reader's own -- `"French"` in the French row,
  the user's ask), held by the test: finished in the language, one is
  asked as the row's English with the person's part in it
  (`toEnglishTemplateAsk`, `findTemplateAsk` in the window; shown as typed,
  answered in the language typed, that part never translated), so every
  reader that knows only English still reads it.
  `applyQuestionOverlay` (`questionMatch.mjs`) puts a row's translation in
  `text` and keeps its English in `textEn` -- applied in the WINDOW only, so
  chips, suggestions and More… read in the language while the model and the
  server keep the English. A translation counts only while its `en` is still
  the row's words; a reworded row shows English until it is redone, and
  `questions.test.mjs` fails until it is (a ratchet at nothing missing). A
  question typed in a script without spaces is ranked by the whole of it, its
  start, inside, then letter-pair overlap; one in Latin letters against both
  `text` and `textEn`. The known-question lookups take either words
  (`findKnownQuestion`, and the search's `findKnownQuestionRow` reads the
  overlays for a non-Latin query). **The manual** in another language is
  `docs/manual-i18n/<code>/<same path>.md` -- its own tree, because
  `build-manual.mjs` rewrites `docs/manual-sources/` -- each page carrying
  `translatedFrom`, the hash of the English body it was made from
  (`manualI18n.mjs`); `build-knowledge.mjs` writes `index.<code>.json` with
  `isStale`, read only for that language. It is ranked by the ENGLISH page and
  shown in the language: a manual search in a non-English window adds
  `titleInLanguage` / `excerptInLanguage`, the passage at the same place in
  the translation (`genTranslatedExcerpt` -- a translation must keep its
  page's passages, which `manual-i18n-status.mjs --check` holds), and
  `owa_help_page` takes `W-06@km` for the page itself (the window's **Read the
  whole thing**; no schema field). A stale or missing page is the English one.
  The model is handed the English page: it reads it and writes in theirs.
- **Questions**: `tools/owa-devtools-mcp/questions/*.json` is the curated list of
  questions the assistant is prepared to be asked — one file per page
  (`presenter`, `reader`, `editor`, `settings`, `screen`, `presenting-flow`,
  `bible-note`, `lyric-editor`, `web-editor`, `troubleshooting`, and `common`
  for what is true everywhere), split into
  sections
  matching the panel the user is looking at, each entry carrying the resources
  that answer it (`recipe` `W-xx`, `related`, `find`, `menu`, `shortcut`,
  `tools`, `guide`) so a lookup replaces a search round. It feeds the ask box's
  **type-ahead suggestions**, its "Try asking" chips (via `starterRank` — there
  is no hardcoded list any more, only a `FALLBACK_STARTERS` for a failed import)
  and the `owa_list_questions` tool. **Whenever the knowledge changes, this
  folder changes in the SAME commit** — a new or reworded `W-xx`, a renamed
  control, a new or removed feature — and the file's `updated` date is bumped; a
  suggestion the assistant cannot answer is worse than no suggestion.
  `questionMatch.mjs` holds the one ranking both consumers run (deliberately no
  `node:fs`, so the renderer bundles the same module the server runs);
  `questions.mjs` is the disk-reading wrapper; `questions/schema.json` documents
  every field; `questions.test.mjs` runs against the REAL corpus and fails on a
  question with no recipe and no tool, a duplicate id, a malformed recipe id, a
  recipe with **no page on disk** under `docs/manual-sources/`, a demoted
  starter, or a resource that is not the shape its readers take it in
  (2026-10-12: `find`, `menu` and `shortcut` are read as TEXT; four rows
  carried `find` as a list, and on the help window's 41 000-character page
  picking one answered _trim is not a function_; three had a `kind` the
  schema does not name). That page check is not the id check: `W-01b` passed the id PATTERN
  for months while `build-manual.mjs` matched `W-\d+` only, so its `### W-01b`
  heading was never read as a heading, the recipe was silently folded into
  W-01's page, and four supported questions named a document that did not exist.
  That generator now takes an optional letter and THROWS on a `### W-` heading
  it cannot parse — a recipe must never be absorbed in silence.
  **Adding a page file is adding a file**: the file NAME is
  the page id and everything else reads the directory — the loader, the ask
  box's `import.meta.glob`, and `owa_list_questions`' `page` enum through
  `listQuestionPageIds()` (names only, no parse). `starterRank` is the one
  field that is not local to its file: the empty window sorts every starter a
  focus can see, so ranks must be unique ACROSS the files sharing a focus, and
  a rank in a `focus: null` file (`common`, `settings`, `troubleshooting`) competes in
  EVERY window. A new question is safest with no rank at all. A page file's
  `focus` may also be a LIST, for one that belongs to several windows.
  `questions.test.mjs` now enforces the uniqueness rule (it was prose only, and
  already broken) and checks every declared focus against `botFocus.mjs`.
  `FALLBACK_STARTERS` in `questionHelpers.ts` is a hand-written copy of each
  window's opening four for when the corpus fails to load; a test holds the two
  together, because nothing in normal use would ever show it had gone stale.
- **A supported question is a LABEL, not a search** (2026-09-03,
  `findKnownQuestionRecipe` in `help.mjs`). Measured on all 258 corpus
  questions that name a recipe: `owa_help_search` put that recipe first for
  57% of them, and the two rankers (`help.mjs` and `questionMatch.mjs`)
  agree on only 28% — when they agree the recipe is right 85% of the time,
  when they disagree the search is right 47% and the corpus 19%. So the
  corpus is NOT a better ranker, and corpus-first offline answering would be a
  regression; what the corpus IS is a set of labels. `searchHelp` now looks
  the query up in the corpus by normalised text and, on an exact row, puts its
  recipe first with `isKnownQuestion: true` — a paraphrase never fires it
  (held-out 22/45 before and after), so it cannot regress a typed question.
  The window does the same on the model's side: `findKnownQuestion` /
  `genKnownQuestionHint` (`questionHelpers.ts`) append the recipe and the
  live tools to the ASK (never the transcript) when the typed text is a corpus
  row — a chip, a suggestion, the More… list — because the model rewrites
  every query in its own words and would search anyway; **and, since
  2026-10-10 (EC-215), when the typed words carry one row's keyword PHRASE
  whole** (`findRowByKeywordPhrase`: two words or more, and only when every
  row that fits answers from one page) — _make computer stay awake_ on the
  Free model had been answered with Windows power settings, because the
  ranking put _make a song_ first on the word _make_ and nothing told the
  model the app has a Stay Awake cup; told the page, it
  opens it (5 rounds → 2 on the panic chip). **Since 2026-10-10 the page
  itself rides with the hint and a row filed under another window still
  counts**: the Reader's own chip _Where do I type John 3:16?_ typed under
  the Presenter matched nothing (the lookup was per focus), so a local model
  (gemma-4-e4b) searched, opened the Bible-XML import page, said it had no
  instructions and invented a "Reference box" and a "Go" button, over 63k
  tokens. `findKnownQuestion` now falls back to every page, the hint says
  _filed under the Bible Reader window — answer for the Presenter where it
  has its own control_, and `readKnownQuestionPage` (the window reading
  `owa_help_page` before the ask) puts the page's text under the hint,
  clipped at 6 000 characters — **the opening and the step that names the
  row's `find`** when the page is longer (`clipKnownPage`, EC-216: W-51's
  cast step is its last, and a 0.6B model shown the first 6 000 characters
  answered with steps 1-2), with a sentence saying which control the
  question is about — so the first round can answer from it and
  open nothing. The row's recipe id rides on the ask as `knownRecipeId`
  too, and `genSeededWatch` starts the tool watch on it, so an answer
  written from the pre-read page — no search, no page opened — still ends
  with **Show me step by step** and its demo button (the watch had learnt
  recipes only from the pages the model opened, and the better the hint
  worked the fewer buttons there were). And `MIN_HELP_HIT_SCORE` (6,
  `helpBotHelpers`) is the floor under which a hit is not a hit — no right
  top hit in 258 scored under it, three wrong ones did — read by the offline
  `answerFromManual` and by `applyToolWatch`, so _Can it stream to
  Facebook?_ no longer offers to walk the user through the Presenter overview
  (score 2). The score distributions overlap everywhere above 6, so this floor
  is garbage removal, not a confidence measure.
- **A page is read as PASSAGES, by the search and by the window alike**
  (2026-10-12, `tools/owa-devtools-mcp/passageMatch.mjs`, no `node:fs`;
  found by asking the whole corpus through the window, the guide alone and
  then a local model). A passage is a step, a bullet or a paragraph with the
  lines it was wrapped over joined — and a paragraph INSIDE a step opens on a
  bold lead sentence, because the manual sets those under one another with no
  blank line: the help window's own page is 536 lines with six blank ones,
  and read by blank lines alone one "passage" of it ran to 14 000
  characters. `rankPassages` scores them: what a supported question is
  ABOUT (its `find`, menu item and keys, `genQuestionAnchors`) outranks every
  word and does not add up — the panels page names its divider in the step
  that hides a panel and again in the one that resets, which also says
  _Widgets_; words match at a word's START, three letters or more (_am_ was
  found in _same_), rarer ones weigh more, and the earlier passage wins a
  tie. **Two readers.** `searchHelp`'s excerpt is the best passage, whole,
  cut at a sentence and saying so with `…` (`genPassageExcerpt`): it was the
  first line carrying ANY query word and the four after it, which over the
  398 questions that name a page quoted the question's control for 37 of
  166 (now 160), its key for 11 of 35 (28) and its menu item for 4 of 14
  (13), with 252 excerpts stopping mid-sentence unsaid — and that excerpt is
  the whole body of an answer when no assistant can be reached. And
  `clipKnownPageParts` (`src/chatbot/questionHelpers.ts`) cuts a page too
  long to ride on a known question to its opening and the passages that
  match the QUESTION — its own words and its row's keywords — when no control
  settles it. 199 of the 398 rows are filed under 13 pages longer than the
  6 000 characters that ride; _What commands can I type instead of asking?_
  rode the first 6 000 of 41 000, which say nothing of the commands, and a
  local model answered _the guide covers this app only; type /btw_. The
  modes: `whole`, `step` (the control's own step, deep in the page),
  `matching`, `head` (the first 6 000 already carry it) and `opening`
  (nothing matched: a start, not an answer).
- **Which passage rides was wrong on the help window's own page, and four
  things changed it** (2026-10-12 afternoon, `EC-240`; found by grading the
  model's answers and not its bill). With the cut handed over and the answer
  written from it in one round, the same forty-seven questions cost a local
  model half the tokens and came back no better -- 26 right of 47 before, 22
  after -- and the twenty-three about the help window itself were 7 right
  and 8 wrong: _Can I add something while you are still answering?_ was
  handed the step that lists every assistant and server, 5 300 characters,
  in place of the 540 that say **Add**. (1) A bold lead the manual's wrap
  carried over a line break opens a passage too (`BOLD_LEAD_OPEN_PATTERN`):
  five of that page's leads were wrapped and stayed inside the step above.
  (2) A word counts ONCE, however often the question and its keywords say
  it. (3) The words of a passage over 2 500 characters weigh less
  (`LONG_PASSAGE_LENGTH`, by the square root; an anchor is not weighed
  down). (4) A match longer than ALL the room the matches share WAITS: the
  ones after it that fit ride first, while they score at least half of what
  it does, and it has what is left -- half the room when it is the best
  match of all. A passage merely too long for what is left is cut on the
  spot, as before. The page's own opening was the fifth thing: W-42 began
  with a paragraph about importing a Bible, and the opening rides on every
  question (_This guide mainly covers starting a Bible import using an XML
  link_). Measured: the passage marked by hand as the answer rode for 14 of
  23 questions and for 22 after; the excerpt ratchet did not move (160/166,
  28/35, 13/14); asked again of the model, 7 right and 8 wrong became 14
  right and 1 wrong.
- **A row can NAME its passage** (`resources.passage`, same day, `EC-243`):
  words the passage that answers it carries, copied from the page -- the
  lead it opens on. For a page too long to ride whole when no control
  settles which part answers, which is every question about the help
  window. It is the FIRST anchor (`genQuestionAnchors`), so it outranks the
  control as the control outranks the words; `clipKnownPageParts` cuts
  around it rather than around the first place the row's `find` is written
  (_Open AI settings_ is in three passages of that page); the hint tells
  the model which part that is (_The part that answers THIS question is the
  one with the words "…"_), because the parts ride in the page's own order
  and a small model answers from the first that seems to fit -- _Can you
  walk me through it step by step?_ rode with the step that answers it and
  was answered with the Reader's guided demos, earlier in the page; and
  `questions.test.mjs` fails when the page stops carrying the words.
  Thirty-one rows carry one. `find` stays what it was: the control to ring,
  and where a walkthrough starts.
- **A question about the help window rides without how to open the help
  window** (`dropFirstStep`, `HELP_WINDOW_MANUAL_ID`, `EC-244`). Step 1 of
  that page is the 🤖 button, a page's opening rides on every question filed
  under it, and a local model wrote it out as step 1 of three answers in
  twenty-four -- to somebody typing in the window. A sentence in the hint,
  _never tell them how to open it_, was tried first and measured: one answer
  in twenty-four still did. What a model is not handed it cannot recite.
  With all of this the twenty-four graded 16 right, 7 partly, 1 wrong.
  **Unless the row names a passage IN that step** (2026-10-16, `EC-268`):
  _How do I open the help from the taskbar?_ is about the way in, its
  answer is step 1's taskbar paragraph, and with the step dropped it was
  answered _Click the 🤖 button on the taskbar_. `dropFirstStep` keeps the
  step when the row's `passage` is in it.
- **A page too long for one read comes in PARTS** (`toPageParts`,
  `owa_help_page`'s `part`, same day, `EC-241`). The model's cap on a
  manual page is 40 KB, set above the largest when the largest was 37; the
  help window's page reached 57, and the cut took its last seven steps from
  every reader at once -- the model, the walkthrough card (`owa_guide_start`
  with a `manualId`) and the window's own pre-read, which chooses what rides
  out of the page it is handed. Raising the cap would put 15 000 tokens of
  one page into a local model's 32k window. So a manual page is divided at a
  numbered step, each part within the cap, each but the last ending with a
  note that says how to read the next (`genPagePartNote` in
  `manualPage.mjs`, read back by the window with `readPagePartNote`); the
  window reads every part before it cuts (`readWholePage`), and the
  walkthrough builder reads the page `'whole'`. The tool's DESCRIPTION was
  not lengthened -- the page says it -- and the model's token ceiling is met
  exactly (8 350 of 8 350): the next thing added to the model's list has to
  take something out.
- **A control the page names EARLY needs its passage named too**
  (2026-10-12 evening, `EC-249`; the whole corpus asked of a local model
  through the window and every answer graded). A `find` written in the
  first 6 000 characters of its page makes those characters ride
  (`head`), and the step that DEFINES the control may be past them:
  _Who is watching my virtual display?_ carries `find: Watching now`,
  which the page first says under step 6 and explains in step 9, and was
  answered with where to watch. A tab's name (`Foreground`, `Presenting
  Flows`) is the worst `find` there is -- written in the opening of its
  page and in half its passages -- and the cut is NOT made cleverer for
  it, because where the name is that common the ranking has nothing to go
  by either: the row is labelled. Twenty-two more rows carry a `passage`
  (53 in all) -- on the Presenting Flow's page (37 000 characters), the
  virtual displays', a second Screen Mirror host, the slide show, the
  tips' lessons, the bug report -- chosen where an answer was graded wrong
  or partly and the part that answers had not ridden, or had ridden with
  nothing to say which it was. Those twenty-two graded 0 right, 5 partly, 17 wrong
  before and 4 right, 11 partly, 7 wrong asked again.
- **Nothing in the window may read the ASK as the person's words** (same
  evening, `EC-250`). The ask is what was typed, then the hint, then the
  page. `askLlmBot` tried the Reader's book-button answer
  (`genReaderButtonReferenceAnswer`: a reference beside _book buttons_,
  _Khmer_ or _non-English_ is answered with how to open it by its
  buttons, by no model) on the whole ask, and three of the Reader's pages
  say _non-English_ or _Khmer_ beside a reference of their own. So every
  supported question filed under them and asked from the Bible Reader --
  seventeen of its seventy-one: _The words are too small. Can you help
  me?_, _What are verse marks?_, _How do I put two Bible versions side by
  side?_ -- came back in 0.7 s with _Press the book button for John …
  press Verse 16_, whichever assistant the tab was on. It reads
  `extra.askedText` now, the words typed. Anything in the loop that
  decides by what the person SAID -- a shortcut, a pattern, a language
  check -- reads that; the composed ask is for the model alone. Found by
  the clock before any grader: seventeen answers under a second in a pass
  whose median was fourteen. Those seventeen graded 0 right, 3 partly, 14 wrong
  before and 11 right, 6 partly, 0 wrong asked again.
- **The hint says the key and the menu item the row is filed with**
  (2026-10-12 night, `EC-248`, `genKnownQuestionHint`). A row carries its
  `shortcut` and its `menu` beside its page, and the hint passed on only the
  page: of the fifteen such answers a grader marked down, nine never named
  theirs. _How can I learn to prepare several notices in Messages?_ was
  answered twice without **Help → All tips**, the second time with the
  passage that says it named and in front of the model; _How do I step to
  the next verse while presenting?_ with the slide keys -- its key is
  written in its row and on no page (`EC-251`). One sentence after the
  hint's head, in front of the page: _For this, the app has the menu item …
  and the key …: name them in the steps, as written here._ The forty-eight
  rows that carry one, asked again of the local model: 33 right, 9 partly,
  6 wrong before, 37 right, 10 partly, 1 wrong after; 27 of 48 named theirs
  before and 42 after. **It is worded as a fact about the APP** (2026-10-16,
  `EC-270`): as _the app's own list files this question with …_ it came back
  to the person as _Press Ctrl+B (the app files this under that key)_ — two
  of the two such answers on the free model. A model may repeat what the
  hint says, so the hint says only what may be repeated: ten rows asked
  again, ten named theirs and none spoke of a list.
- **The foot note is no part of the page that is cut** (2026-10-12 night,
  `EC-252`, `clipKnownPageParts`). Every manual page ends with a note for
  the model -- where its newest copy is -- and the window measured and cut
  the page WITH it. Two pages that fit (the slide editor's, 5 941
  characters of 6 000; the one about drawing on the app) were 400 too long
  for it, so their 35 questions rode "the first 6 000", the note cut off
  mid-address, under _the page goes on: open it for the rest_ when nothing
  was missing; and because its address spells the page's own name it was
  ranked as a passage for 173 of the 203 questions on long pages and rode
  in 20 cuts in place of one. The page is measured and ranked without it; a
  page that fits rides whole — and, since 2026-10-13, without the note (the
  bullet on what may ride, above). **And a page near the limit is
  a page to leave alone**: two paragraphs added to the slide editor's page
  the same night took it to 7 148 and every one of its 31 rows to a cut --
  they went to pages with room.
- **Asked from the window it is about, the hint says so** (same night,
  `EC-253`): _They are asking from INSIDE the Document Editor, which is
  open in front of them: start at what to do there, and never tell them how
  to open it or get to it._ For a row filed under the window the tab asks
  about, when that is not the Presenter or the Bible Reader -- nine of
  thirty-nine answers given from the Slide Editor, the Lyric Editor, the
  Bible Note window and the web editor opened on the way into the window
  they were typed in. On the help window's own page the same sentence took
  three such answers in twenty-four to one, and that page's first step is
  not handed over at all (`dropFirstStep`); these pages keep theirs,
  because the same rows are asked from other windows too. **Not for a row
  answered from the help window's own page**: what that page tells is done
  in the help window, whichever window the row is filed under -- _Can you
  write the notation for words I paste in?_, filed under the Lyric Editor
  and told they were INSIDE it, came back _paste your song lyrics into the
  box in the Lyric Editor_.
- **A row with no page and no tool left is told to make up no way by hand**
  (same night, with `EC-239`). The hint for a tool the assistant was not
  sent ends _give the way to do it by hand when the guide has one_; under a
  row that has no page a local model gave one anyway -- an automatic undo
  for background colours, a Web Editor button and a link box. Now: _the
  guide has no page for doing this by hand, so describe no steps, buttons
  or menus for it: say only that this assistant cannot, and that another
  assistant in the list at the top of this window (Free, or one with a key)
  can_ -- every assistant but a server of the user's own is sent the whole
  set. Asked again: _I cannot undo actions … You will need to ask another
  assistant in the list at the top of this window._
- **A fill-in row that ends on a gap is still that row once the sentence
  is finished** (same night, `findFilledTemplateRow`). _Add a slide to my
  document that says ..._ fills the box and is asked only when completed,
  and the completed sentence matched no row: no hint, no tool named, no
  _you were not sent it_ -- a local model searched and answered from the
  page about presenting a slide, twice. `findKnownQuestion` now takes a
  sentence that opens with the words of a row ending on three dots, and
  goes on, for that row; two rows that open alike are nobody's. A row
  whose sample sits mid-sentence is still matched only as it stands.
- **A recipe too long to ride whole was split, and that helped without
  ending it** (same night, `EC-258`, the user's choice of three). With
  every other cause fixed, every wrong answer left was on the running-order
  recipe, 39 000 characters: 27 questions, graded 126 times on that page --
  48 right, 52 partly, 26 wrong -- and not the same questions twice. It is
  ten recipes now (W-22, W-22b … W-22j), each under the 6 000 characters
  that ride whole, the text its own and its steps naming a page where they
  named a step number. Asked again: 11 right, 13 partly, 3 wrong before,
  14 right, 9 partly, 4 wrong after, and 19 right, 15 partly, 6 wrong over the
  forty askings since. More right; the wrong ones moved to other questions.
  A whole page is not a right answer: the model still wrote _a line_ for
  _the NAME row, not a line_. Write a recipe to ride whole -- and do not
  expect that alone to carry a small model through a subject of fine
  distinctions. **Nor is it the size of the model, one step up**: the same
  26 questions asked once of ChatGPT's smallest (GPT-5 nano, at the
  user's word) came out 15 right, 9 partly, 2 wrong, against
  14 right, 10 partly, 2 wrong -- two wrong either way, and not the same two.
- **The part a row names is answered in ITS OWN WORDS** (2026-10-13,
  `genKnownQuestionHint`, with the temperature in `chatbot-llm.md`). The
  sentence that tells the model which part answers the question now ends
  _answer from that part in ITS OWN WORDS — copy the sentences you use as
  they stand, change no name in them and add no step it does not have_. With
  the temperature at 0 the 27 running-order answers were the same on both
  askings and two were still wrong, each by a noun of its own in place of
  the page's (_right-click the line_ for _the presenting flow itself … not
  one of its lines_; the stopwatch _at the right of that line's row_ for the
  CC line's). A copied sentence cannot change its noun: asked again, the
  first came back as the page's own step. It is a sentence in a hint, and a
  hint is not a wall — a row with no `passage` gets none of it, and a model
  can still stop one step short of what the question needs. **And it did,
  because the hint said so** (2026-10-17, `EC-310`): "take from the others
  only what it leaves out" read as "that part only" — gemma4:cloud, the
  whole corpus in Khmer, 27 of 84 marked-down answers stopped where their
  part did (_turn the AI features on or off_ answered with the turning-off
  part "in the same settings section", never naming which). The sentence
  now keeps the copying and the no-new-steps rule and asks for the WHOLE
  job from the rest of the page — where the part is, a step before it that
  it takes for granted, the steps after it that finish the job — and a
  control's step ends the same way.
  **The named part is quoted FIRST, by itself, on short and long pages**
  (`namedFirst`, 1 500 characters at most,
  under _The part that answers this question, quoted first and by itself_).
  The parts of a long page ride in the page's order, its opening first, and
  a small model answers from the first that seems to fit: told which part it
  was in so many words, gemma-4-e4b still answered _Can you walk me through
  it step by step?_ with the Reader's guided demos, which the help window's
  page opens on — at temperature 0, so every time. With the part first it
  answered _Every answer offers Show me step by step. Press this button …_.
  Short pages get the same priority since 2026-10-18 (`EC-353`): W-11's
  earlier Add Extra Bible step kept appearing before group scrolling,
  although splitting supplies the other version itself. Quoting the named
  step first removed that extra action in the live Khmer check. The whole
  page remains available for necessary prerequisites and finishing steps.
- **Nothing that changes with a release may ride on a known question**
  (2026-10-13, `clipKnownPageParts`). A page that fits used to ride _whole,
  note and all_ — the foot note the page tool writes for a model, which says
  the DAY of the copy. At temperature 0 the same words get the same answer,
  and the day is words: with the manual regenerated under the next day's
  date and no page edited, not one of 27 running-order answers came back as
  it had been an hour before. The note no longer rides (the window reads
  the newest copy by itself under a complaint, and a model that opens the
  page with the tool still gets it). The rule is the prompt cache's rule,
  for a different reason: there a byte that changes per question loses the
  cached prefix, here a byte that changes per release re-rolls every answer
  — so a version, a date or a count is never written into what a known
  question is asked with.
- **A question about what the app has or is doing right now is told to call
  its tool** (2026-10-13, `genKnownQuestionHint`, rows of `kind: 'state'`).
  The hint named _the live tool for it_ and left the calling to the model:
  of the eight such rows a local model called the tool for seven and
  answered the eighth — _Which displays does this computer have?_ — with
  _the guide does not provide information about your computer's physical
  hardware … type /btw_, at temperature 0 and so every time. The hint now
  opens that part with _it asks what the app has or is doing RIGHT NOW,
  which only the app can say — call <tool> first and answer from what it
  returns_. Asked again, it read the screens and listed the displays; the
  other seven were asked again with it and none got worse.
- **What rides is READ, as far as the loop is concerned**
  (`genKnownAskExtra` → `AskExtraType.isKnownPageQuoted`, same day). The
  tool watch is seeded with `readId` as well as `searchedId` unless the mode
  is `opening`. Seeded as a search hit with no page opened, it made
  `checkIsStepsWithoutPage` hand the model's steps — written from the page in
  front of it — back as "written from a search excerpt", and the model opened
  the same page again and wrote the answer a second time: on the same 23
  questions asked of gemma-4-e4b, 61 model rounds became 37, input tokens
  fell 41% and the median answer went from 23.5 s to 12.1 s. Every provider
  paid it, the paid ones in money. A `kind: 'state'` row seeds nothing: its
  page is background reading, and _Which page am I on right now?_ had been
  answered correctly with **Show me step by step** through the Presenter
  overview under it. And a row's tool that the assistant was not SENT
  (`checkIsToolLeftOut` in `llmBotHelpers.ts`: a custom server's fourteen of
  twenty-six) is named in the hint as missing — _say plainly that you cannot
  do that from this assistant_ — where "the live tool for it: owa_undo", with
  no such tool in its list, had been answered with the Bible note's Undo.
- **A recipe id is scrubbed in code, at both ends** (2026-09-08,
  `scrubRecipeIds` in `help.mjs`, `src/chatbot/recipeIdHelpers.ts`). The
  prompt has forbidden "an id like W-06 -- not even in passing" since the
  first run, and a where-is answer still opened with _"W-08 has exactly what
  you need"_ -- twice on the same question, written from a search hit without
  opening the page. A rule the model can ignore is not a rule. Page bodies had
  been scrubbed since `EC-21`; search EXCERPTS never were ("(W-08 step 1)",
  "see W-28"), and a two-round answer is written from the excerpt. Now one
  `scrubRecipeIds` serves the page tool and every excerpt (the hit's `id`
  FIELD stays: it is the handle `owa_help_page` / `owa_guide_start` take),
  and the window reads the answer once more at the seam the `OPTIONS:` frame
  leaves by -- LAST, so a title lands in clean text -- replacing an id with
  the page's own title, which `learnPageTitles` folded into the tool watch
  off that ask's search hits and opened pages (`pageTitles`, per ask, never
  kept), or with _the guide page_. Real-world tokens of the same shape
  (`UTF-8`, `USB-3`) are left alone. The guide card's `stripInternalIds` got
  the lettered id (`W-01b`) in the same change -- it was leaving "see b".
  Beside it, `checkIsWalkthroughEcho` drops a model option that says **Show
  me step by step** in other words (_Yes, walk me through it_ sat beside it on
  7 of 7 walkthrough answers), only ever when those buttons are present.

- **A manual page carries the address of its newest copy** (2026-10-11,
  `genFreshPageUrl` in `help.mjs`, asked for by the user: _if user still
  claiming that the answers are incorrect then try to read from repo … to get
  a fresh knowledge_). The pages on a computer are as old as its release;
  `owa_help_page` ends a manual page with one line naming its file under
  `docs/manual-sources/` on the project's public repository
  (`raw.githubusercontent.com/OpenWorshipApp/open-worship-app-dt/main/…`),
  built from the index, never from words a model wrote, and absent on a
  developer note. The prompt's rule for an answer the person says is wrong is
  a ladder: find the control (`revealBy` says what to press first), ask for a
  picture of the window -- theirs to send, the window has the button --, then
  read that address with `owa_read_website`, the ONE web read about this app
  the prompt allows, and -- when that copy's day is later than the page's own
  -- say the built-in guide was behind. A raw page still
  has its `[en:tran:Name]` templates; the prompt says to read them as Name.
  The page must be pushed to `main` to be read there, so a fix to
  `user-workflows.md` reaches an installed app only after `docs:gen` is
  committed and pushed.
  **The window does that read itself, since later the same day**
  (`src/chatbot/disputeHelpers.ts`; the user's ask: _make the repo fallback
  automatic on a complaint rather than the model's choice_). A message that
  disputes the last answer (`checkIsDisputingAnswer`: short, and in the
  shapes of _that is wrong_, _there is no …_, _I can't find it_, _it does not
  work_, with their Khmer and French twins) under an answer whose walkthrough
  button names a guide page (`findDisputedPage`) has that page's newest copy
  read BEFORE the model is asked: `owa_help_page` for the address — taken
  only in the repository's own shape — then `owa_read_website`, so the
  address check, the budget and the banner are the firewall's existing ones
  and no tool or schema was added. It is clipped by `clipKnownPage` and put
  under the ASK, never the transcript, with a hint to compare it with what
  was said: differs → answer from it and say the built-in guide was behind;
  the same → do not repeat, find the control or ask for a picture. A read
  that fails says so and tells the model not to try again. The waiting line
  reads _Reading the newest copy of that guide page_. Not for a known
  question, a general one, a rescue, or with no assistant; the model's own
  read stays as the rule for a dispute the pattern misses.
  **Run against the real address for the first time, it had never once
  worked** (2026-10-11, `EC-222`; the real `readDisputeHint` driven through a
  scratch instance's own MCP door). Three things, none of which a unit test
  fed a made-up result could see. Every `raw.githubusercontent.com` file is
  served with a `Content-Security-Policy` of `sandbox`, which forbids ALL
  script in the page, the reader's included, so every read came back
  _Script failed to execute_ and the hint said "could not reach it just now"
  -- the loader now reads from an isolated world (`agent-access.md`). The
  tool waited 15 s for a read the loader gives 20 s (same note). And the copy
  on `main` was ten days OLDER than the built-in one -- a tree ahead of
  `main` -- which the hint called the NEWEST: handed over, it would have
  taken a corrected answer back to the wrong one. Both copies say their day
  now: a page's front matter carries `workflowsVersion`, `owa_help_page`
  prints the built-in copy's beside the address (`readManualPageDate` in
  `tools/owa-devtools-mcp/manualPage.mjs`, shared with the window), and a
  copy dated EARLIER is not quoted -- the hint says the built-in guide is the
  newest there is, and the ladder goes on. An equal or unknown day keeps the
  repository's copy as the newer. The page that rides is cleaned as the
  built-in one is (`toManualPageBody`: no front matter, no robot block, no
  heading with the recipe's id). Still not asked in the window with an
  assistant: the caution is a person's press.
  **The window walks the rest of the ladder too** (2026-10-13, `EC-260`,
  `locateDisputedControl`). The hint handed the model a paragraph of
  conditions — find the control; when the tool names another to press first,
  say THAT; otherwise ask for a picture — and a small local model recited it
  as advice: under _The steps did not work_, pressed beneath a thumb down,
  gemma-4-e4b wrote _Please look for a control labeled ? in your window. If
  you find one, press it first_. So the look is made BEFORE the ask, beside
  the page read (`Promise.all`), with the find tool on the window the tab
  asks about, and the model is handed the FACT in one sentence: it IS there
  and where; it is shut away and which control has to be pressed first
  (`revealBy`); it is drawn under the mouse only; or there is NO control
  called that on their window, with the closest name there is — only a
  control CALLED that counts (`tier` 0), since a looser fit is some other
  control. **Which control**: the one the complaint NAMES, when the answer
  bolded it too (`findComplainedControl`, the longest such name — _There is
  no Bible Properties button_ under an answer that said **Bible
  Properties**), before the one the walkthrough button starts at. An answer
  written from the help window's own page gets a sentence of its own — no
  tool looks into the window they are typing in, so name no control and ask
  which step did not do what it said — and a look that cannot be made (that
  window is not open) leaves the old ladder. Seen live on the local model:
  the same press now answers _Which step did not work as expected? What
  happened when you tried the steps?_, and _There is no Bible Properties
  button_ is answered with the three dots that have to be pressed first.
- **A page rides in the language the model ANSWERS in** (2026-10-17,
  `EC-303`; the user's goal: _gemma4:cloud 100% work for Khmer language_,
  then the Gemma 4 models on their LM Studio). The whole corpus asked in
  Khmer (`corpus-run.mjs --lang=km`) showed English to a reader of none in
  143 of 435 answers, and the cause was the page, not the model: the window
  read the known question's page as `{id}` -- English, its buttons alone
  put into Khmer -- and the hint told the model to copy the row's passage
  _as it stands_, so it wrote _បើក View on the top menu bar again and
  click_. Now, for an ask answered in the person's language as it stands
  (a Gemma 4 model, or nothing to translate -- `findPageLanguage` in
  `chatTranslateHelpers.ts`), `ChatbotAppComp` also reads `{id}@km` and
  `genKnownQuestionHint` takes it as `localPageText`: the cut is still
  CHOSEN off the English page (the row's control, passage and keywords are
  English) and READ from the translation, block for block
  (`toLocalizedCut` -- a numbered step with what hangs under it, or a
  paragraph, `splitPageBlocks`), the passage pointed at by the translated
  block's own first words (`findLocalizedPassageLead`) -- or, for a passage
  that starts INSIDE its block, by the translated sentence it starts in,
  when both blocks have as many sentences (`EC-317`: the phone's cast
  button is step 8's fourth sentence, and the step's first is the app's) --
  a named part that opens by pointing back (_the end of THAT line_) quoted
  with the part before it (`withPointedBackPart`), the control named
  only as that app shows it or not at all, and a menu path as the menu bar
  shows it (its own names English, the items under them translated). A
  page the model opens itself comes `@km` too (`ToolWatchType.pageLang`,
  `runMcpToolCall`), and the prompt's guide bullet says pages come in the
  language. It rests on the translations being written block for block --
  as many blocks, each of the same kind (its step number, a heading, a
  quote, a bullet, a bold lead; a block starts at a step, a blank line and,
  through `checkIsBoldLeadLine` shared with `toPassages`, a bold-lead line,
  or the help window's commands were a sub-paragraph of step 6 and never
  rode). Every current page of both languages does
  (`questionHelpers.test.ts` holds it); one that drifts rides as the English
  cut, never as the wrong part of the translation. A block is in the cut
  when any of its lines is, read the way a passage writes it (lines joined
  by spaces, quotes' `>` off), and the cut has its own ceiling, half again
  the English one, because whole blocks ride. Seen live on gemma-4-12b:
  _បើក View នៅលើរបារម៉ឺនុយខាងលើម្ដងទៀត ហើយចុច កំណត់ទំហំ Widgets
  ឡើងវិញ_, the page's own sentence. **The page has to be in the language
  too** (`EC-312`): the Khmer W-42 and W-44 had written the help window's
  and AI Chat's buttons as English bold, and the model half-translated them
  (_បង្ហាញ me step by step_); they are `[en:tran:…]` templates now, so a
  label reads as the window draws it.
