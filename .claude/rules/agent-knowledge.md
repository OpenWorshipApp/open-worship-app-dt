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
  185 internal notes would cost megabytes read on every search.
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
  A document names a control as `[en:tran:Clear Bible]`, never as an English
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
  chatbot ANSWER stays English-only; only the button names inside it move.
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
  recipe with **no page on disk** under `docs/manual-sources/`, or a demoted
  starter. That page check is not the id check: `W-01b` passed the id PATTERN
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
