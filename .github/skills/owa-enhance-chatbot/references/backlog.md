# Enhancement backlog — `EC-xx`

Tracked improvements for the chatbot and its MCP tools. **Ids are stable.** When
you finish one, move it to *Done* with the date and what actually shipped; when
you find something new, add it here even if you do not do it — the next run
should start from the truth, not from a re-discovery.

Status: `open` (real, verified, not done) · `idea` (plausible, unverified) ·
`done`.

Priority order when nothing else is specified: **wrong answers → unsafe acting
tools → cost → capability → polish.**

---

## EC-103 · The card rang and pressed a control that was behind a popup — `done` 2026-09-08

**Reported with a screenshot.** The Bible Lookup popup open over the
Presenter, *How do I add a background?* → **Do it for me**, and the card's
ring drawn THROUGH the popup on a line of Genesis: the Images tab was under
it. A control is "on screen" by every measure the matcher had — laid out,
painted, enabled — and Do it clicked it and moved on to step 3 with nothing
visible having changed. *"does not work while modal present."* The runtime
now asks the window what it paints at the control's own centre
(`coverOf`, `elementsFromPoint`) and names the layer (`layerOf`): the app's
popup (the modal container, closed by its own red ✕), a right-click menu
(closed by a click on its backdrop), a floating panel (its toolbar ✕), or a
question the app is asking (confirm / alert / input — never answered for
anyone). Show mode rings the way OUT and says so; demo mode closes it on
the first press and does the step on the next, one press one action, the
same shape as the right-click menu. `owa_guide_status` reports it as
`behind`. Proven live on the reported case and by the full-recipe run (3
closes, 2 refusals of an open question).

---

## EC-104 · Do it pressed the wrong control on a loose match — `done` 2026-09-08

Measured by `demo-failure-rate.mjs`, pressing Do it through all 224 steps
the card offered it on. Of the 92 presses reported as done, a spot check of
what was actually clicked found a step about the drawing panel's **Clear**
pressing the projector's **Clear All [F6]**, **Follow** pressing *Break lines
following model formatting*, **Add** pressing *Add Bible Item*, **Back**
pressing *Background:*, **No** pressing *No Color*, and **ASSISTANT** opening
the help window — every one a tier-1 or looser match (a whole word inside a
longer label, or a word-start) taken as the thing itself. The tiers are right
for pointing and wrong for a click. `domMatch` now carries `isPressSafe`
(exact, or a label part equal to the words once a `[shortcut]` and a leading
glyph come off, or the very panel asked for), the demo refuses anything
else with the label it found (which is what the rescue needs), the ring
only ever lands on a press-safe match, and the status reports a loose fit
as not found with `nearest` beside it.

---

## EC-105 · A step that is something to notice was a failed press — `done` 2026-09-08

Of the 124 presses the card refused in the same run, 51 named nothing to
press at all, and 40 of those were steps that DESCRIBE — *The bar under the
search box says how many verses matched*, *When it finishes, the file
appears in the folder* — each costing an apology, or a model round on the
rescue, for a step whose whole content was "look". `toGuideSteps` marks
such a step `kind: "look"` (opens by describing, bolds no label-like phrase,
names no key), the card draws **Next** instead of **Do it** for it with a
line saying what it is, and a tool-driven `do` just moves on. 19 recipe
steps statically; the rest of the 51 are real actions with no label (*Click
the yellow dot*, *Drag a slide*), which stay with the rescue.

---

## EC-106 · Four recipes could not start a walkthrough at all — `done` 2026-09-08

W-01, W-09, W-10 and W-17 are tours written as bold-led bullets with no
numbered step, and every walkthrough button under their answers — the panic
question's among them, which lands on W-10 — answered *Nothing to guide*.
`toGuideSteps` now reads a top-level bullet that opens with a bold as a step
when a page numbers nothing, sub-bullets folded in. W-10 becomes a seven-step
tour of the screen card (Toggle showing screen / F5, the clears, Lock,
Display, Transitions, Background audio, Stage number).

---

## EC-107 · A bold over 40 characters, or of one character, misread the step — `done` 2026-09-08

`BOLD_PATTERN` capped a bold at 40 characters and floored it at 2: W-08's
*Colors / Images / Videos / Cameras / Webs* is 41, so it was not read and its
closing asterisks paired with the next bold's — "Colors" was eaten and the
tab step led with **Ok**, a button on a dialog that was not open. One-character
bolds (**✕**, **ⓘ**) did the same damage the other way: unread, their
asterisks paired with the next bold's and the words between became the label.
Now 1–120 characters, cut at the line; the `checkIsControlLabel` length rule
turns the ✕ away one step later. Measured over the manual: 88 bolds were over
40. `nameOf` also names the control the ring LANDED on rather than the step's
first candidate, and prefers a short candidate over a bolded sentence when
nothing landed.

---

## EC-108 · Steps whose control lives in another window cannot be demoed — `open`, medium

The same run, after the fixes above: W-35 steps 1–3 (Settings → Others →
SongSelect → Sign In), W-42 step 19 (Enable AI features), W-33 step 5
(Settings → Bible), W-25 (Import Data) name controls in the Settings window
while the card is in the Presenter, and W-42's steps 2–14 name controls in
the help window itself. The chatbot opens the right window when a recipe is
ABOUT it (`EC-69`), but a recipe that crosses windows mid-way strands the
card in the first one. A guide that follows the user across windows needs
the runtime in both and the state carried by the server; sized as a
structural change. Until then the rescue's `DO:` line is the honest answer.

---

## EC-109 · The rest of the refusals, by shape — `open`, low

What `demo-failure-rate.mjs` still refuses after `EC-103`–`EC-107`: actions
with no label (*Click the yellow dot*, *Drag a slide onto the canvas*, *Type
your search words*, *Double-click a verse*), controls that exist only after
the previous step's effect (the ⓘ card's fields), file and password dialogs
(Export / Import / Downloads / Password / Ok), and recipe bolds that are not
the app's words. Each is a recipe fix or a model rescue, not a card rule;
the harness lists them by recipe and step so the next run can pick.

---

## EC-110 · W-02 ends its own walkthrough on step 1 — `open`, low

*Switch between the main pages*: its first Do it navigates the main window,
which unloads the card with everything else. The harness skips it by
default. A walkthrough that survives navigation needs the guide state held
by the server and re-injected on load.

---

## EC-95 · The model's own pills under a drafted song repeated the buttons, brighter — `done` 2026-09-08

The four *Try asking* chips, asked on the user's own assistant (Kimi K2.6).
Both chips that end in a draft — the paste and the page — came back with
**Create "Amazing Grace"** / **Copy song text** AND, under them, the model's
`OPTIONS:` pills *Create the file* / *Copy the text* (*Copy to clipboard* on
the page). The pills are drawn as filled buttons and the real ones as
outlines, so the pill is what a volunteer presses. Pressed, *Create the file*
goes to the model as a question: it retyped the notation by hand (refused
twice — no `- ` on the Config lines, then `Structure: Verse 1, Verse 2,
Chorus`), hit the name already in use, and answered with **Overwrite the old
one** as a button — 4 rounds, 32 s, nothing created. The real button: 0
rounds, 1.5 s, saved as *Amazing Grace (2)*. Same class as `EC-89` bullet
one, same fix: `checkIsDraftEcho` in `quickReplyHelpers` drops a model option
that says create/save/copy in other words, only ever beside those two
buttons; and under a draft the corpus follow-ups are not offered at all (the
"question" was a hymn, and its nearest corpus question was *How do I change
where my documents are stored?*). Re-asked on Kimi: the two buttons and one
real reply (*I need to change something*).

---

## EC-96 · A rate-limited paste fell to a bot that searched the manual for the hymn — `done` 2026-09-08

The chip says *paste the words here*; the paste arrived ~25 s after the chip's
own two rounds and Moonshot answered **429 three times in 3.6 s**
(`msh-gid: free`, `retry-after: 1` — the window is a minute, not a second).
The offline bot then ran `owa_help_search` with sixteen lines of Amazing
Grace as the query and said *I could not find that in the app guide*, with
*Can I show you a picture of my screen?* underneath. The drafter needs no
model, so `askHelpBot` now recognises a lyric-shaped paste
(`checkIsLyricPaste`: four or more short lines, no question, no notation)
and drafts it through `owa_lyric_validate` itself — same two buttons, same
pseudo tools, same hardened create path — and the window's note says *I
wrote the song out myself instead* rather than *Here is what the app's own
guide says*. Only on the fallback: with a model the model still decides.
Proven live under a real 429: draft in 3.6 s, **Create** → *Amazing Grace
(3)* in 1.5 s.

---

## EC-97 · A hymnal text page handed over whole drafted sixteen verses of menus — `done` 2026-09-08

The prompt and the tool both say *hand a song page in WHOLE*. Done exactly
that with a hymnal site's text page, the length rule took a region from the
first mention of the first line to the *Text Information* table — ninety
lines, because *Printable scores: PDF, MusicXML* is four words — and drafted
**"Untitled" with 16 verses**, the six real ones being numbers 8 to 13 among
*Song available on My.Hymnary*. Both models had produced a good song on this
page only by IGNORING the instruction and copying the stanzas out themselves;
a model that obeyed would have handed a volunteer the menu. Fixed in the
reader: `pickNumberedStanzas` takes a run of stanzas numbered 1…n (plus a
labelled refrain among or after them) as the song on a no-chord page, and
`readPageFields` reads the `Title:` / `Author:` / `Copyright:` table such a
page prints far below the words (the page said *Copyright: Public Domain* in
plain sight and the draft said *Unknown*). Measured on the same page: title,
author, *Public Domain*, the address in `Attachments`, six verses of four
lines. Proven live on Kimi, which handed the page over whole on the after-run.

---

## EC-98 · What a model ACTUALLY hands the drafter is its own copy, and the drafter read it worst — `done` 2026-09-08

Neither provider hands a page over whole, whatever the prompt says. Claude
copies the stanzas out with the page's title line, *Author:* and *Tune: NEW
BRITAIN* on top and passes `from`/`to` around them; the markers were only
ever read on the PAGE path, so the three header lines became **Verse 1** and
Claude spent a round drafting again (5 rounds, 41 s). Three changes, all in
the drafter: `from`/`to` are believed on plain words too; a short unlabelled
block above a run of numbered stanzas is the heading, not a verse
(`dropHeadingAboveNumberedStanzas`, four-line minimum for a verse on every
hymnal), and its first line — cut at the ` | Site` a page title carries —
names the song when nothing else did; and a `copyright` slot on draft mode,
because the page's *Copyright: Public Domain* line rode along in the model's
copy one time in two. Also: with no `mode`, notation is checked and anything
else is drafted — Kimi called the tool twice on one page for want of the
word. Re-asked on Claude: 4 rounds, one draft, right first time, *Public
Domain* in the Config.

---

## EC-99 · A taken name was refused with "use update", and the model offered to overwrite — `done` 2026-09-08

`owa_lyric_file create` under a name already in use answered *Use action
"update" to change it, or pick another name* — and a model asked to create a
song off a page did exactly what it was told, offering **Update the existing
one** as a button under a song the user had never asked to change. The
window's own **Create** button never asks: it takes the next free name. The
refusal now leads with that name (*"Amazing Grace (4)" is free — create it
under that name, unless the user asked to change the existing one*), found
by `findFreeName` in the worker with the same `(n)` scheme. Claude still puts
the choice to the user (*Save as a new name* / *Update the existing one*),
which is defensible with the real Create button right above it — left as is.

---

## EC-100 · Kimi's free tier cannot afford this chatbot's rounds — `open`, high (evidence for `EC-02` / `EC-57`)

Measured on the user's own account: every request is **~45 KB** — 30 KB of
tool schema (29 tools, ~7 300 tokens), a 13.5 KB system prompt (~3 300
tokens), the history — so ~11k tokens a round, and Moonshot's free tier
(`msh-gid: free`) allows ~32k tokens a minute. A two-round question and any
follow-up inside the minute is a 429, three retries at `retry-after: 1`,
then the offline bot. `EC-96` covers the one shape (a paste) the offline bot
can now do in full; every other follow-up still dies. Two remedies, both
structural: **tool routing** (send a paste the lyric tools only, a how-do-I
the help tools only — the 29 schemas are the whole budget) and **prompt
caching** (`EC-57`; Moonshot bills cached prefixes at a discount too).
Neither is a description trim. Also seen: Kimi K2.6 spent 41 s on the first
chip (thinking, under the deliberate 6000 budget) and 63 s on the page chip.

---

## EC-101 · A long draft is cut at 12 000 characters, and Create would write the cut — `open`, medium

`formatOpenLyricDraft` caps the echoed markdown at `MAX_ECHOED_MARKDOWN` so
a hymn is not re-sent on every round; `readDraftedLyric` lifts the document
off that same text and strips the `[... cut here` marker, so a song longer
than the cap would be CREATED short, silently. A six-verse hymn is ~1 500
characters, so nothing has hit it yet; a whole hymnal page in another script
could. The document should ride the result whole and only the model's copy
be cut, or the cut should refuse the button.

---

## EC-102 · "Here are the lyrics" is a pill that sends those three words — `open`, low

The paste chip's answer on Kimi ended with *Here are the lyrics* / *It's a
link* / *Never mind* as pills. Pressing the first sends the sentence, not
the lyrics. A model-written option that describes what the USER will type
next should fill the box rather than be asked — the corpus already has the
`template` idea for exactly this.

---

## EC-92 · A recipe id reached a volunteer in prose, twice on the same question — `done` 2026-09-08

Claude Sonnet 5, *"Where is the button to change the background?"*, the
standing corpus's where-is shape, in the Presenter — verbatim:

> **W-08 has exactly what you need.** In the Presenter, look at the bottom of
> the middle column — there's a thin bar labeled Background. …

Two rounds, one `owa_help_search`, no page opened: the answer was written
from the search hit, and the hit is the one place an id cannot leave — its
`id` field is the handle `owa_help_page` and `owa_guide_start` take. The
prompt forbids "an id like W-06 -- not even in passing", the page tool has
scrubbed ids out of page bodies since `EC-21`, and this still happened; asked
again after the fix the model wrote *"W-08 is the exact match for the
Presenter"* — so it is systematic on this shape, not a one-off, and the
previous run's answer to the same question (no id) was luck. Leaks on the
ratchet: **0 → 1**, which outranks everything new (`EC-22` was the open
item: "prose answers are still on the honour system for ids").

Two more channels found on the way: the search **excerpt** was never scrubbed
(*"Open the Background panel (W-08 step 1)"*, *"see W-28"* — page bodies were,
excerpts were not, and a two-round answer is written from the excerpt), and
the guide card's own `stripInternalIds` did not know the lettered id
`W-01b` exists, so it left *"see b"* behind.

**Shipped 2026-09-08.** Three layers, none of them a sentence in the prompt:

- `scrubRecipeIds` in `help.mjs`, shared by `owa_help_page` (which had its
  own copy of the regexes) and now by every search excerpt; a dangling
  "— see" goes with the id it pointed at. `guide.mjs`'s `ID_PATTERN` takes
  the optional letter.
- `src/chatbot/recipeIdHelpers.ts`: `scrubAnswerRecipeIds` runs at the same
  seam the `OPTIONS:` / `NEEDS:` / `SHOWS:` frames are taken off, LAST, and
  replaces an id with the page's own title — `learnPageTitles` folds every
  search hit and opened page into the tool watch (`pageTitles`, per ask,
  never kept) — or with *the guide page* when no tool named it. Real-world
  tokens of the same shape (`UTF-8`, `USB-3`) are left alone.
- Proven live on the same question, against a model that wrote the id again:
  *"The guide page “Set the background (color / image / video / web)” is the
  exact match for the Presenter."* 9 + 3 new tests. `EC-22` closes with it.

What it does NOT do: stop the model writing the id. That is the cheaper
sentence the prompt already carries, measured to fail 2 of 2 here; the scrub
is the rule.

---

## EC-93 · Retrieval ranks the page that MENTIONS backgrounds over the one that SETS them — `open`, medium (evidence for `EC-50`)

`owa_help_search "change background" focus:presenter`: **W-15** (*Create and
edit slides / lyrics / web backgrounds*) scores 66, **W-08** (*Set the
background*) 46 — W-15 says the word more often. The model picked W-08
anyway from the excerpt, and the offline bot would not have: it takes the top
hit. Same class as `EC-50` / `EC-90`; filed as one more labelled case for
the held-out set, not fixed here.

---

## EC-94 · The reader's wrong-window question spends two rounds asking where the user is — `open`, low

Bible Reader focus, *"How do I edit a slide?"*, with the main window on the
Presenter: 5 rounds, 24 s, `owa_app_state page:"reader.html"` (no such window)
then `owa_app_state` with no page — the same fact twice. The answer was
right (W-15). The first result could say which page the main window IS on
when the asked-for one is not open, so the second call has nothing to add.

---

## EC-91 · A question picked off the app's own list got the wrong page two times in five — `done` 2026-09-03

**Measured, not reported.** The 258 corpus questions that name a recipe were
searched for as typed (`scratchpad/grade-retrieval.mjs` against the built
knowledge, focus passed): top-1 **147/258 (57%)**, top-3 192 (74%). Those are
the app's OWN words — a chip, a suggestion under the box, a row of the More…
list — and each is filed under the page that answers it, so 43% of the time a
person who did exactly what the window suggested was handed a page that
merely shared a word with what they pressed.

The obvious fix, "rank the corpus first", was measured too and is worse: the
two rankers agree on 71 of 258 (28%); when they agree the recipe is right
60/71 (85%), when they disagree the search is right 84 of 180 and the corpus
35. The corpus is not a better ranker. It is a set of LABELS, and a label is
read, not weighed.

**Shipped.** Three pieces, each proven live 2026-09-03:

- `findKnownQuestionRecipe` in `help.mjs`: `searchHelp` compares the query
  to every corpus question by normalised text and, on an exact row, puts its
  recipe first with `isKnownQuestion: true` (+100 over the top score). A
  paraphrase never fires it — the 45 held-out paraphrases score 22/45 before
  and after — so it cannot regress a typed question. Live: `/help Nothing is
  showing on the projector — what do I check?` → W-10 first, where it was
  the drawing page.
- `findKnownQuestion` + `genKnownQuestionHint` in `questionHelpers.ts`,
  applied in `handleAsking`: the model rewrites every query in its own words
  (measured: every Claude search in the last run), so the server-side lookup
  never fires for it. Told on the ASK — never the transcript — which page and
  which live tools a picked question is filed under, it opens the page
  without searching. Live: the panic chip went `owa_list_screens`,
  `owa_app_state`, `owa_help_page W-10` in **2 rounds**; the free-worded
  version took 5 in the previous run.
- `MIN_HELP_HIT_SCORE` (`EC-85`).

Corpus top-1 is 258/258 after this by construction and is NOT the number to
quote; the honest numbers are the held-out 22/45 (unchanged) and the rounds.


## EC-83 · The window could not DO anything without a model — `done` 2026-09-02

**Asked for from the app**, four messages in a row: *"looking for a way to do
pre-training the local assistant, for some task the chatbot should not ask the
llm api"*, *"add build action like `/presenter-screen-show`
`/presenter-screen-hide`"*, *"buildin actions"*, *"so user don't have to ask
llm"*.

**Measured first**, on the standing twelve-question corpus through the real
window (`test-results/chatbot-quality/score-2026-09-02-built-in-commands.json`):

- Claude Sonnet 5 answered *"Turn off the screen for me"* in 2 rounds and 9
  seconds — correctly, that nothing was showing. Nine seconds and a paid call
  to learn the state of a button.
- The same afternoon ChatGPT answered 429 on every call (out of credit), the
  free pool answered 429 after 62 seconds, and Kimi went 429 from the second
  question on. **33 of the 36 answers on the other three providers were the
  offline bot's**, and it scored **4 of 12**: the screen's state for a
  how-do-I, nothing at all a person could press on the two panic shapes, and
  the wrong page on four.

So the rung-4 promise — *degrades honestly when the key dies* — was the
window's normal condition that day, and the thing it degraded to could
describe the screen and not touch it.

**Shipped.** `src/chatbot/builtinActionHelpers.ts` (+15 tests): a line
starting with `/` is matched against a registry of 13 commands and run
through the app's own MCP tools from `handleAsking` before any provider is
looked at. `/screen`, `/screen-show`, `/screen-hide`, `/clear-all`,
`/clear-background`, `/clear-slide`, `/clear-bible`, `/clear-foreground`,
`/find <words>`, `/goto <page>`, `/here`, `/help <words>`, `/commands` —
with the user's own spellings (`/presenter-screen-show`) as aliases. Typing
`/` lists them in the suggestion list (`SuggestRowType` unifies the two
kinds of row; a command with no argument asks on the press). Three rules,
each written into the module header: it reports what CHANGED (screens read
back before and after), typing it IS the consent, and a tool's error never
reaches the user. The button under an answer carries `BUILTIN_TOOL_NAME`, a
pseudo tool the server never registers, so a model cannot fire one.

Verified live 2026-09-02: 13 commands, **0 model rounds, ~1.6 s each**, the
screen really on (`showingScreenIds: [0]`) and really off, the button path
writing `YOU /screen-show` into the transcript, the `/` list with all 13.
New `CB-48`, W-42 step 6, corpus question `common.quick-commands`.

**Not done, on purpose:** `/present <song>`, `/verse John 3:16`, `/next`.
Each is a real want and each needs a tool the server does not have (present
by name, look up by reference, step a running order). Filed under `EC-84`.

---

## EC-84 · The offline bot is what the window has on a bad afternoon, and it got 4 of 12 — `open`, high (half done 2026-09-02)

The measurement is in `EC-83`. The twelve offline answers, graded:

| # | Question | Offline answer | Verdict |
| --- | --- | --- | --- |
| 1 | How do I put a Bible verse on the screen? | "No presentation screen is showing" | wrong — a task read as a screen question. **Fixed**: `TASK_QUESTION_PATTERN` |
| 2 | Where is the button to change the background? | (where-is path; the button is a collapsed bar) | weak |
| 3 | Is anything showing? | state | pass |
| 4 | Turn off the screen for me | state, nothing to press | pass, barely. **Fixed**: a *Turn the screen on* command button |
| 5 | Build a running order | W-22 | pass |
| 6 | (reader) How do I edit a slide? | W-02, W-15 offered second | partial |
| 7 | Nothing is showing on the projector | state, nothing to press | **Fixed**: the button |
| 8 | the words no come out big screen | state | same |
| 9 | Can it stream to Facebook? | W-01 + walkthrough buttons | wrong — see `EC-85` |
| 10 | passage scroll itself | W-39 | pass |
| 11 | How do I add a song? | W-21 (the *link* page, on the word "song" in its title) | wrong |
| 12 | and how do I undo that? | W-01 | wrong — no follow-up handling offline |

Two of the wrong ones were one cause: `answerFromManual` appended the focus
NAME to the query, and "presenter" is in the title of the Presenter overview
page — `clear the bible presenter` scored W-01 83 and W-10 42; without the
word, W-10 69 and first. **Fixed** the same day.

**What is left is the ranker.** `How do I add a song?` → W-21 is
`owa_help_search` scoring the title word, the same class `EC-50` names.
The obvious next step — answer offline from the 262-question CORPUS first,
since every row is pinned to a recipe — was measured too and is not a free
win: `owa_list_questions "How do I put a Bible verse on the screen?"` ranks
*How do I put a song's lyrics on the screen?* FIRST (`verse` is one of its
keywords) and the Bible question below it. Two rankers, both imperfect,
disagreeing on the same question. Size: a combined score (corpus row → its
recipe, agreeing with the search's top hit → confident; disagreeing → offer
both as buttons rather than guess) is a day, and it is the day that lifts the
offline bot from 4/12 to something a service can lean on. See `EC-90`.

---

## EC-85 · An honest "the app cannot do that" still carries walkthrough buttons for an unrelated page — `done` 2026-09-03

Claude, *"Can it stream to Facebook?"*: the text was right — no streaming, use
OBS — and under it sat **Show me step by step** and **Do it for me**, because
`applyToolWatch` latched the search's top hit, which was **W-01 (Understand
the Presenter window)** at score 2. Pressing *Do it for me* would have
demoed the Presenter tour under a question about Facebook. The offline bot
did the same with the same page.

A score of 2 is not a hit. Fix: `toWatchedManualId` (and the offline
`answerFromManual`) should require a minimum score before a page counts as
"the recipe this answer is about", and the walkthrough buttons should not be
offered when the answer's own words say the thing cannot be done.

**Shipped 2026-09-03.** `MIN_HELP_HIT_SCORE = 6` in `helpBotHelpers`, chosen
from the grading in `EC-91`: no right top hit in 258 scored under 6, and the
three under it were all wrong. Read by the offline `answerFromManual` (a hit
under the floor is the could-not-find answer, no buttons) and by
`applyToolWatch` (a page under the floor is no recipe for the walkthrough
buttons). Verified live: the Facebook question on Claude carries no
walkthrough buttons; offline it answers "I could not find that" with none.
Above 6 the score distributions overlap everywhere (right: median 95, wrong:
median 40, both spanning 6–160), so the floor is garbage removal and nothing
more — the "say when you are not sure" half is still `EC-90`.

---

## EC-86 · A 429 costs three retries, and on the free pool a minute, before the fallback — `open`, medium

Measured: every ChatGPT question spent **3 calls × ~1 s** (the SDK's own
retries) on an `insufficient_quota` 429 that no retry can fix; the free pool
spent **62 seconds** before giving up on question 1; Kimi 8 rounds on
question 2 (4 tool calls, then 429s). A volunteer with a dead key waits three
seconds for the offline answer they could have had at once, and a free-tier
user waits a minute. Fix: `maxRetries: 0` for a quota 429 (the body says
which kind), and a shorter first-round timeout on the free service.

---

## EC-87 · What lives in a right-click menu is invisible to every tool — `open`, medium

Claude, *"and how do I undo that?"* after *"How do I add a song?"*: 5 rounds,
6 tool calls — `owa_help_search` twice, `owa_list_ui filter:"Delete"`,
`owa_find_ui "Delete" anyPage`, another search, then the page. The Delete
item is in the document row's ⋮ / right-click menu, which no tool lists and
no DOM query sees until the menu is open, so the model looked, found nothing,
and answered from the manual anyway (correctly, as it happens). `W-01b` is
the recipe about that menu. A tool — or a `menu` resource on more corpus
rows, which already exists for the native menu bar — that answers "what can
this row do" would have made it one round.

---

## EC-88 · Kimi started a walkthrough unasked on the plainest how-do-I — `done` 2026-09-08

Kimi k2.6, *"How do I put a Bible verse on the screen?"*: 4 rounds, 43 s,
and it called `owa_guide_start` itself — *"A guide card is now in the corner
of your Presenter window"* — for a question that asked for words. Harmless
here (a card, not a screen), but the prompt says offer, and a weaker model
read "offer this whenever the answer is more than one step" as "do this". One
sentence in the tool description, measured on Kimi. **Done 2026-09-08**: seen again on *How do I add a background?* (4 tool rounds, a card drawn over the Presenter, then a 429). The cause was the prompt’s own sentence, *offer to walk them through it and call `owa_guide_start`*, which Kimi read as written. It now says the buttons appear by themselves and the tool is called only when they ASK. Re-asked: 2 rounds, no card.

---

## EC-89 · Three small things the corpus run showed — `open`, low (first one done 2026-09-08)

- Every Claude answer that offered **Show me step by step** also carried a
  model-written *"Yes, walk me through it"* quick reply beside it — the same
  press twice, in two shapes, which is the wall-of-buttons `EC-12` was about.
  `genMessageReplies` drops exact duplicates only. **Done 2026-09-08**:
  measured 7 of 7 walkthrough answers carrying one (*Yes, walk me through
  it*, *Yes, show me how*, *Yes, show me*, *Show me the demo instead*);
  `checkIsWalkthroughEcho` in `quickReplyHelpers` drops a model option that
  accepts the walkthrough, only ever beside those two buttons — *Show me the
  button* under a state answer keeps its place. Proven live: the Bible-verse
  answer's buttons went from 4 to 3.
- `/find Clear Bible` (and the offline where-is) answers with the label the
  matcher joined: **BB Clear Bible [F9] Clear Bible** — the title and the aria
  label, twice. `labelPartsOf` already exists for chips; the answer text
  should use it.
- `owa_find_ui "the Background panel"` returns 0 while the panel is collapsed
  to its title bar, though the description promises the *"the X panel"* form;
  the bare word finds the bar at once.

---

## EC-90 · Two rankers, both imperfect, and no way to know which to trust — `idea`, medium

Measured this run on ONE question, *How do I put a Bible verse on the
screen?*: `owa_help_search` ranks W-06 (right); `owa_list_questions` ranks
the lyrics question first (wrong, on the keyword `verse`). On *How do I add a
song?* it is the reverse: search says W-21 (wrong), the corpus says W-15 by
its second row (right). Neither is the oracle. The 236 labelled questions are
the test set (`EC-50`); grading the CORPUS ranker against its own labels is
circular, so the held-out 45 paraphrases are the only fair judge of a merged
score. This is the structural item behind `EC-84`: until the two agree or
the window says when they do not, the offline bot cannot pass rung 2.

---


## EC-80 · The window would not say what it was doing — `done` 2026-09-04

**Reported from the app with a screenshot**, mid-answer: the question was
*"Create a lyric file from https://www.example.com/chords/523776"*, and
under it the single line

> Looking it up… press Stop to give up on it.

with a red scribble under it. That question is `owa_read_website` (a real page
fetch, whole-page screenshot included), `owa_lyric_validate mode: "draft"`, a
name check and a create — most of a minute — behind a sentence that does not
change once in it.

The fault is not that the wait is long. It is that the line answers *"is it
alive?"* while the person reading it is asking *"is it getting anywhere, and is
it doing what I meant?"* Nothing on screen could distinguish a window still
working from one that had hung, so the only strategy it teaches is to press Stop
and try again — and pressing Stop is exactly the wrong move on a question that
was 50 seconds into a 55-second job.

**Shipped.** `src/chatbot/progressHelpers.ts` — a module-level store the loop
pushes steps into and one small component subscribes to. `AskExtraType` gained
`onProgress`; `runMcpTool` opens a step before the call and closes it in a
`finally`, and both provider loops do the same around each model round. Four
things that were decided rather than fallen into:

- **The phrase is written for a volunteer, never derived from the tool name.**
  `describeToolStep` maps all 29 model-visible tools by hand, and the fallback
  for a tool added later is `Looking something up` — not its name. A test walks
  the map and fails on an underscore reaching the line, because the cheap
  implementation here (print the tool name, tidy it up a bit) breaks the one
  rule this window has.
- **It says what it is working ON**, which is the half the user actually asked
  for: `Searching the guide for "background"`, `Reading example.com` (the
  site, not the address and its query string), `Creating a new song: "Amazing
  Grace"`. Arguments are flattened and cut at 38 characters — a pasted song is a
  legitimate argument and would otherwise take the line down the window.
- **Finished steps stay above the running one**, dimmed, with only one dot ever
  breathing. A single replacing line was cheaper and answers the wrong question.
  The list keeps the last 5 and COUNTS the rest rather than dropping them
  silently.
- **Its own store, not the window's state.** The line sits under the
  conversation; a twenty-step question through `useState` in `ChatbotAppComp`
  would re-render the whole message list twenty times on the machines this app
  targets.

Ids come from a module-level counter, not a per-reporter one: a question makes
two reporters (the connect, then the provider loop), and a finishing step is
matched to its start by id — per-reporter counters both start at zero, so the
first round of thinking landed on top of the connecting line instead of
following it. Caught by a test, not by the eye.

Verified live 2026-09-04 on the presenter with Claude Sonnet 5: five steps in
order, exactly one running at a time, cleared on the answer. New `CB-47`.

---

## EC-81 · Four chips were the whole of what this window looked capable of — `done` 2026-09-04

**Asked for from the app with a screenshot** circling the line under the
starters: *"should `More...`, when I click it show all list so can know what I
can do"*.

`EC-17` built the corpus — 260 questions, every one pinned to a recipe or a
tool — and then showed four of them. The other 180 for that window were
reachable only by typing the right two words first, which is the thing somebody
who does not know what the window does cannot do. A help window whose scope has
to be guessed at gets used for the one thing its user once saw it do.

**Shipped.** `getAllQuestions(focus)` in `questionHelpers.ts` flattens the
corpus for the current window and groups it by SECTION label (a section is a
panel of the app, so the headings read as places the user recognises — merged
across pages, because two `Screens` headings is the corpus's own filing showing
through). `RenderAllQuestionsComp` draws it under a **More…** toggle and mounts
only once pressed, so a window nobody opens it in never reads the corpus for it.

The one thing worth not re-deriving: the press handler is now SHARED with the
starter chips (`handlePickingQuestion`), because the rule they share is easy to
lose on a second copy — a `template` row fills the box instead of asking, and
asked as it stands the `Create a lyric file from https://example.com/…` row
sends the assistant off to read the example address. A test asserts the flag
survives the flattening for that reason.

Verified live 2026-09-04: 4 chips → **More…** → `184 questions it is ready for
here`, grouped, **Fewer** folding it away. `CB-17` amended.

---

## EC-82 · The tip line could be re-rolled but not walked — `done` 2026-09-04

**Asked for from the app with a screenshot**: *"should `<-` and `->` for pre
next tip"*.

`EC-78`'s tip line answers *"show me another"* with a random pick, which is
right for that question and cannot answer either of the two the user actually
had: *show me all of them* (a random walk gives no way to know when you have
seen the lot) and *bring back the one I was half way through reading* (a random
walk has no back).

**Shipped.** `stepChatTip(currentId, delta)` walks `CHAT_TIP_LIST` in order and
wraps both ways; two chevrons at the end of the row call it. Pressing the
SENTENCE still picks at random — the two questions are different and both are
kept. All three paths remember what they showed, which meant lifting the
`setSetting` out of `takeChatTip` into a shared `rememberChatTip` (`genChatTip`
stays pure so the choosing is still testable without a setting store).

The arrows are drawn at half opacity rather than revealed on hover, deliberately:
this whole line exists because a feature nobody announces is a feature nobody
has, and hiding its own controls until you already know they are there is the
same mistake one level down.

`+ count` before the modulo is load-bearing — JavaScript's `%` keeps the sign,
so stepping back off the first tip indexes at `-1` and hands back nothing.
Covered by a test.

Verified live 2026-09-04: **›** from the last tip wrapped to the first, **‹**
took it back. `CB-46` amended.

---

## EC-76 · "Done — the screen is now showing", with nothing on the wall — `done` 2026-09-03

**Reported from the app with a screenshot.** The assistant was asked *"How do I
show a screen?"* and answered correctly — the show/hide button in the screen
preview header, or `F5`. It then offered to do it, was told *"Yes, turn it on"*,
and replied **"Done — the screen is now showing."** `owa_list_screens` said
`showingScreenIds: []`. The user's own words: *"it did wrong, it open setting
instead. the report is incorrect. the agent should double check"*.

Two faults stacked, and the second is the one that made it dangerous.

**The press landed on a decoration.** `handleAutoHide` injects an `<i>` titled
`tran('Show')` into every auto-hide footer — four of them in the presenter
(Background, Bible previewer, presenting-flow preview, mini screen). `matchTier`
ranks an EXACT label above every looser fit and tier is `checkIsBetter`'s primary
key, so `owa_click({find: 'Show'})` scored tier 0 on a decoration while the
screen's own control — `Toggle showing screen [F5]` — scored tier 2 on
`show`-inside-`showing` and could never win. Proven live before the fix:
`owa_find_ui "Show"` answered the decoration first, the real control second.

**Nothing told the model it had failed.** `genClickExpression` answered with
`clicked: describe(target)` and stopped there. A model that manages to click
something has, from the tool's answer alone, no way to tell a press that worked
from a press that hit the wrong thing — so it reports the goal achieved, which
is the worst failure this assistant has: a volunteer told the screen is on stops
looking for the reason it is off.

Shipped:

- The decorations are `tran('Reveal Hidden Controls')`. **Not** `Show Hidden
  Controls`, which was tried first and still won the bare word `Show` at tier 1
  on a whole-word match — the word had to leave the label, not move within it.
  Measured after: `find: "Show"` now ranks `ShowHideScreenComp` first.
- `owa_click` reads the control back ~250 ms after the press (this app
  re-renders on an event, so reading it straight away reports the state
  BEFORE) and answers `isOnNow` / `didChange` / `unverified`. Three kinds of
  evidence, weakest last: a control that is GONE did something, a toggle that
  flipped is the state itself, a label that turned Show into Hide is the same
  fact in words. `unverified` is a SENTENCE, not a flag — absent evidence must
  not read as success, and a missing key is something a model infers past.
- `ShowHideScreen`'s title went through `tran()`. It was a hardcoded English
  string, so the app's most important control answered to nothing in a Khmer
  window, and the manual had no label template that could name it. W-10 and the
  `show-hide-screen` question now carry the exact words.
- `genSystemPrompt` gained one rule: **never report an outcome you have not
  seen.** It costs no extra round in the normal case, because the evidence
  now rides the click answer.
- `owa_list_screens` stopped returning Electron's whole `Display` object twice
  (~2 800 characters to answer "no") and gained `isAnyShowing`. Verification
  has to be cheap to be habitual, and ~1 200 result tokens is exactly what
  makes a model skip the check and guess.

Cost: `owa_click` 278 → 411 tokens/round, `owa_list_screens` 58 → 109; **+184
tokens/round**, repaid by the first `owa_list_screens` call of any question.

**Related, still open: `EC-37`** — that one is about CONSENT (a "yes" to *would
you like help* being read as a "yes" to *do it now*). This one is about
TRUTHFULNESS, and they met in the same transcript: consent was taken loosely and
the outcome was then reported without being checked. Fixing the second does not
fix the first.

**The general lesson, which outlives this bug:** a tool that reports its own
ACTION rather than the action's EFFECT teaches a model to claim effects. Every
acting tool in this package should be read against that.

## EC-76 · A song page is not a song — `done` 2026-09-04

**Asked for by the user**, who gave a real chord site and said: learn from the
songs on it. `EC-74` shipped drafting from raw words and the user's first real
input was a LINK, which is the case it was worst at. Measured before writing
anything, on eight real song pages: every one produced a valid document and not
one produced the right song. The failures were all the same shape — the page's
menus, view counts, fretboard chart and footer were drafted as verses; the
song's own labels were swallowed, so a four-verse hymn came out as one
undivided `Verse`; and every sung line was broken into the fragments the chord
columns had cut it into.

**What was built:** `tools/owa-devtools-mcp/lyricPageText.mjs` (+ its test), a
reader that turns a page into the lines of a song. `checkIsPageText` gates the
whole thing so an ordinary paste is untouched. Details in `CLAUDE.md`
§*Agent access*; the four rules that matter are region-by-walls-of-wordless-
lines scored on CHORDS first, fragments rejoined with nothing between them, a
fragment after a fragment starting a new line, and a label never joining to
anything. A page with no chords — a hymn-text site — gets a second reader keyed
on line length, and `stripWebsiteWrapper` finding its own fence is what proves
the text came off a page at all.

**Measured after, on 14 real pages: 14/14 valid, with structures matching the
page's own printed play order** (`V1x2Cx2V2x2Cx4B1x6B2x4` for one that prints
exactly that). Before: 8/8 valid and 0/8 right.

Four things it now reads that nothing else could: the `Key · Time · Tempo`
strip (validated against open-lyric's closed sets, so a key it cannot name
defaults instead of taking the whole song down to tier 2), a verse number in
the script the hymnal is printed in, `(2x)` and `Repeat Chorus` as PLAY ORDER,
and a Latin line under a non-Latin one as a TRANSLATION — which open-lyric
already has a place for and nothing in this repo had ever emitted.

**Cost:** four optional params on `owa_lyric_validate` (`title`, `artist`,
`from`, `to`) and no new tool.

Also in this change, because they were in the way:
- `owa_read_website`'s screenshot is WHOLE-PAGE now (capped at 2400px). It was
  a 768px viewport, which on a song page is the site's toolbar and nothing
  else — useless for the one question a picture is worth asking.
- Its `executeJavaScript` gained a timeout. Without one a heavy page never
  settled, the `finally` never ran, and two hidden windows were left alive on
  the user's machine with every later read timing out against them.
- A fourth Presenter starter chip, and the first **template** chip in the
  corpus: pressing it fills the ask box instead of asking, because the address
  in it is the user's to supply.

## EC-77 · A page's toolbar and licence line still reach the last verse — `open`, low

**Seen in the 14-page measurement.** Two residues survive on some pages: a
two-word toolbar item (`Add to`) at the very top of the chosen region, and a
`© …` line at the very bottom. Both are one stray line in a draft the user
reviews, and both are named in the report, so this is polish rather than a
defect. The tail sweep stops at anything carrying a chord, and on those pages
the line inherits one.

**Half closed by `EC-79`.** The sweep also used to stop at a *translation*, and
`Guitar chords` was being paired with the songwriter's credit above it — so the
two of them rode into the last verse together. Nothing printed under a credit
line is a translation of it now. The toolbar residue at the top of a region is
untouched.

## EC-78 · A song page crosses the model's context twice — `open`, medium

`owa_read_website` returns the page text to the model, which hands it straight
back to `owa_lyric_validate`. For a Khmer song page that is several thousand
tokens paid twice, and then the drafted document rides every remaining round —
enough to matter on the **Free** provider's six-round cap.

**The design, if it is taken:** `owa_read_website` keeps the last few reads in
a bounded in-memory map keyed by a short reference, and the draft mode accepts
that reference instead of `text`. The page never re-crosses the model's
context. Cost is ~40 tokens a round for the parameter, against thousands saved
on exactly the question this feature exists for. Not done here because it
widens the tool surface for a token argument rather than a correctness one, and
the correctness work had to land first.

## EC-74 · The assistant could check a song but not write one — `done` 2026-09-03

**Asked for by the user**, and the gap was real: a volunteer arrives with lyrics
in an email, on a hymn page, or in a `.txt` on a memory stick, and the only ways
into this app were an account, a 36-hymn catalogue, or typing Open Lyric
notation by hand. Every piece needed already existed and none were joined up —
a pasted file's body already reached the model (16 KB, `genTextAttachment`),
`owa_read_website` already read a page, `owa_lyric_validate` already checked a
song, `owa_lyric_file` already wrote one safely. What was missing was the model
knowing any of that was its cue, and the one thing it genuinely cannot do.

**The measurement that decided the design**, probed live against the real
validator before a line was written:

| attempt | problems |
| --- | ---: |
| plain lyrics, as pasted | 1 (no `ol:Config` at all) |
| a plausible model attempt | **9** |
| a **careful** model attempt | **2** |
| a deterministic emitter | **0** |

The careful row is the finding. It still dies, and on traps invisible from the
outside: `CC` in `Structure` where `Cx2` is required, and the sentence "guitar
solo over the verse chords" inside `ol:Instrumental`, a fence that rejects every
word. A guess-then-fix loop would converge in 2–4 more rounds at ~7 000 tokens
of schema each — fatal on the Free provider, capped at 6.

**Shipped.** `mode: "draft"` on `owa_lyric_validate` (`openLyricDraft.mjs`),
+61 tokens/round against ~450 for a tool of its own. Raw words in, a valid song
out, round-tripped through `validateOpenLyric` so a drift cannot ship a broken
document — only a report saying it is broken — with a tier 2 that rebuilds every
part as `Breakdown`, the fence open-lyric does not look inside. The chat never
shows the notation: `applyToolWatch` lifts it out of the tool RESULT and mints
**Create "<title>"** and **Copy song text**, pseudo-tools the server does not
register, over a bounded in-memory map. Create goes through `owa_lyric_file` so
the whole hardened path applies — name refused not cleaned, second content check
at the disk boundary, never overwrites, banner in the operator's window.

**Verified live** through a freshly spawned server against the running app, and
by open-lyric's OWN validator: 6 new cases in `openLyricOracle.test.mjs` prove
the Lyric Editor accepts every drafted document, which is the only test here
that proves anything — "our emitter agrees with our validator" is circular.
30 more in `openLyricDraft.test.mjs`, 4 on the watch. **Every fixture song is
made up**: a test fixture ships in every clone and in the knowledge bundle, and
song lyrics belong to whoever wrote them.

**Three things found on the way**, all fixed here:

- **An indented line is the TRANSLATION of the line above it.** Neither existing
  importer strips leading whitespace because neither of their inputs has any;
  a hymn scrape and a chord sheet are full of it. It stays VALID, so no
  validator would ever catch it, and half a song silently becomes translations
  of the other half.
- **Leaving `instrumental` out of the label map does not keep it away from that
  fence.** It stops the line being read as a label at all, so `[Instrumental]`
  becomes a lyric somebody sings. It has to be recognised and *routed* to
  `Breakdown`.
- **`questions.test.mjs` could not see a tool registered from a loop.** Its
  regex read `registerTool('name'` only, so `owa_lyric_file` and
  `owa_slide_file` were invisible and a corpus entry citing them was called a
  typo. Both spellings are read now.

**Also:** `owa_lyric_file`'s description taught the model `Tempo (72bpm)` while
both app importers and this emitter use `120bpm`. Free to fix, so fixed.

**Left open:** `formatOpenLyricReport` lists every section by name, so a
pathological 400-section input still returns ~21 KB. Real songs have under 20
sections and the drafted markdown itself is capped at 12 KB, so this is a
sharp edge rather than a defect — `EC-75`.

## EC-75 · A song report grows with the song, unbounded — `open`, low

`formatOpenLyricReport` prints `Sections (N): ...` naming every one, and the
play order up to 40 entries. `openLyricDraft` caps the markdown it echoes at
12 KB because a tool RESULT rides every remaining round of the question, but the
section list underneath it has no cap at all: a 400-block input measured ~21 KB
of result. No real song is near that, and the input would have to be pathological
to get there — but the cap that exists proves the cost is understood, and this is
the half that was left uncapped. Cheap to fix: cap the section list the way the
play order already is.

---

## EC-69 · The window a walkthrough needs was reported as a fault, not opened — `done` 2026-09-02

**Reported from the window, with the screenshot.** Asking about **Settings**,
the user got a correct three-step answer about the theme, pressed **Do it for
me**, and was handed the tool's own words:

```
That did not work: The app has no open page matching "setting.html". The open
pages are: chatbot.html?uuid=chatbot, presenter.html.
```

Every part of that is wrong for the person reading it. It is a fault report
written for whoever drives the app; it names two files this window promises
never to show a volunteer; and the thing it is complaining about was **one
press away** — the ⚙️ button was on screen the whole time.

Three faults, one seam:

1. **The map of windows held two of the eight.** `PAGE_SWITCH_HINTS` in
   `helpBotHelpers.ts` was a hand-written copy of the presenter and the reader
   sitting beside `BOT_FOCUS_LIST`, which declares all eight and how each is
   opened. Settings was not in the copy, so `genPageSwitchAnswer` returned
   `null` and the error went straight through. The same copy is what
   `botFocus.mjs`'s own header warns about, in the same words, about a
   different duplicate.
2. **Even the two it knew, it only TOLD.** The user had just pressed a button
   that says *Do it for me*.
3. **`ChatbotAppComp` printed `error.message` at them.** Not only for this
   failure — for every failed button press this window will ever have.

**Shipped 2026-09-02.** The failure is not reported at all any more: the window
is OPENED and the walkthrough that was asked for starts in it.
`genPageOpenAnswer` reads `BOT_FOCUS_LIST` instead of copying it, and crosses
by the two means the two kinds of window allow — `owa_goto_page` for a page the
ONE main window navigates between (it waits for the arrival, which a click
cannot), and a press of the new `openFind` descriptor field for a window of its
own. One attempt, then the words: `runBotAction` takes `canOpenPage`, false on
the retry, so a window that refuses to appear cannot become a loop of opening
it. Where no single control opens a window (three need something SELECTED
first, one lives in the native menu bar) the user is still asked — now in that
window's own `howToOpen` words, with the fallback ring only where there is
something to ring. `describeActionError` is the one place a failed press is put
into words, and the reason goes to the log instead of to the user.

Two things fixed on the way, both on the same seam:

- `owa_goto_page`'s enum was `['presenter.html', 'reader.html']` while the
  system prompt told the model it could cross to any window marked
  `isMainWindow` — so every crossing to the **Document Editor** was refused by
  the tool the prompt had just named. The enum is now derived
  (`BOT_MAIN_WINDOW_PAGES`), and accepts all three.
- The model side was told *"Ask them to open it themselves"* for all five
  windows of their own. It now presses `openFind` for the one that has it,
  exactly as the button path does.

**Verified live** on the reported conversation itself, in the running app: the
same **Do it for me** press, on the same tab, with Settings shut — the Settings
window opens by itself and the answer under the old failure bubble reads
*"**Opening Settings for you.** Look at the app window. A card is showing step
1 of 4..."*. Covered by 5 tests (press-to-open, navigate-not-click, the
no-single-control fallback, the one-attempt cap, and the sanitised message).

**Found on the way:** `helpBotHelpers.test.ts` and `llmBotHelpers.test.ts` both
died on `document is not defined` the moment `helpBotHelpers` imported
`loggerHelpers` — `appProvider` at module scope in a node-env suite, the same
trap as `EC-61`. Both now mock it, in the pattern of `reportHelpers.test.ts`.

---

## EC-70 · A recipe walkthrough replayed the steps that got you there — `done` 2026-09-02

**Seen the moment `EC-69` landed, in the same window.** Settings is opened for
the user, the card comes up in it, and step 1 of 4 reads:

> **Click the gear (Settings) in the header — Settings opens in its own
> window.** *Do this step in the window behind me.*

They are looking at Settings. The step was just performed FOR them. The card
reports `find: null`, `isTargetFound: false` — it cannot point at anything,
because the control that step names is not in this window at all.

Not caused by `EC-69`, only made visible by it. `dropStepsAlreadyDone` in
`guide.mjs` exists for exactly this and opened with

```js
const isReader = /reader/i.test(pathname);
const isPresenter = /presenter/i.test(pathname);
...
if (!isReader && !isPresenter) { return kept; }
```

— the SAME two-window hard-coding as `EC-69`'s, in a different file, beside the
same `botFocus.mjs` that declares eight. Six of the eight windows got no
dropping at all, and it fires just as much when the user opened Settings
themselves and pressed **Show me step by step**. The model half was already
told the rule the recipe half was breaking: *"Never tell them to open the
window they are already in."*

**Shipped 2026-09-02.** `genHereNames` reads the descriptor instead: the
`label` a recipe writes in a sentence, the `openFind` written ON the control,
and the label's last word plus "tab" for the shorthand — which is what the
reader's hand-written pattern was carrying. Matched by lowercase substring
rather than a regex built from the label: these are whole control names, and
user-facing text has no business being spliced into a pattern.

**Verified** against the real recipe, not a fixture: `W-16` in Settings goes
from 4 steps starting *"Click the gear (Settings) in the header"* to **3
starting at the General tab**, while the same recipe asked from the presenter
keeps all four. Covered by 3 new tests (a window of its own, the Document
Editor by either of its two names, and a pathname nothing declares); the 39
that were already there still pass unchanged, which is the point — the
reader and presenter behaviour is the same behaviour, derived instead of typed.

---

## EC-73 · A second CDP client evicts a guide card, but only in a popup window — `open`, high

**Found while verifying `EC-72`, and it threatens this skill's own gate.** The
running app's MCP host caches its modules on its first session, so verifying an
edited `.mjs` means spawning a FRESH server over stdio against the same app
(the documented workaround, memory `mcp-tool-edit-two-processes`). Under that
harness a guide card started in **setting.html** reports itself running with
the right step and the right ring, and is **gone within 1.5 seconds** --
`owa_guide_status` answers `isRunning: false, stepCount: 0`, which means
`window.__owaGuide` itself is gone.

Measured, same script, same session, back to back:

```
presenter W-06: start 1/6 | +1500ms running=true | +3000ms running=true
settings  W-16: start 1/3 | +1500ms running=false | +3000ms running=false
```

It is NOT a reload: `list_pages` shows the same target and the same URL before
and after, and the preserved console holds exactly ONE `[vite] connecting...`,
so the document never navigated. And it is NOT the Settings window: the same
guide started through the app's OWN HTTP host persists there for minutes
(watched live, `isRunning: true` on a follow-up status).

So the eviction needs BOTH a popup window and a second CDP client. Unexplained.
The cost is that a `guide.mjs` change cannot be seen working in any window but
the main one without restarting the whole app first -- which is the one order
this skill tells you not to use, because the build that restarts it also kills
the app you were verifying against. Worth a session with `Target.*` /
`Runtime.executionContextDestroyed` traced, and if it turns out to be
puppeteer's isolated worlds, `cdp.mjs` should say so in a comment where the
next person will hit it.

---

## EC-72 · A Settings walkthrough ran in the Presenter and rang a Bible version — `done` 2026-09-02

**Reported from the app with a screenshot**, and it is two complaints in one:
*"this wrong highlight, and also wrong page. it should help user open setting
page and assist user in setting page."*

The card read **Settings: language, theme, fonts, folders — Step 2/4**, drawn
in the **Presenter**, with a red ring around the **KJV** button of a Bible row
and the line *"The ringed control is in the Bibles panel, at the top right of
this window."*

The chain, measured:

1. The model called `owa_guide_start` with `manualId: "W-16"` and **no page**,
   so the card ran in whatever the main window was showing. Nothing in the tool
   asked which window that recipe is about.
2. In the Presenter, step 1 ("click the gear") is NOT dropped -- correctly, you
   really would click it there -- so the user landed on step 2, which is the
   ~900-character bullet dump of `EC-71`. It harvests **nine** bold words as
   controls to ring.
3. `General`, `Language`, `Apply Settings`, `Theme`, `Font family`,
   `Directories` and `Reset buttons` match nothing in the Presenter. The
   candidate list has no floor, so it fell through to the fourth: **`English`**,
   out of *"Language: click **English**"*.
4. The Bible version button's accessible label is **"KJV English KJV"** -- the
   key, its language, the key again. `English` is a whole word of it, so it
   matched at tier 1, exactly, and `owa_find_ui` confirms **3 identical rows
   matched equally well**. The first was rung. In demo mode it would have been
   PRESSED.

**Shipped 2026-09-02.** `detectRecipeWindow` in `guide.mjs` reads the window
out of the recipe's own first step -- the same sentence
`dropStepsAlreadyDone` throws away once you are there, read the other way
round -- and `owa_guide_start` uses it over the page it was asked for, because
a caller naming a page is naming where the USER is, which is the question this
answers rather than obeys. A recipe about Settings cannot be walked in the
Presenter at all: every control it names is in the other window.

Deliberately silent unless sure. Measured over the 44 manual documents:
**5 recipes name exactly one window and all 5 are right** (W-11 and W-32 the
Bible Reader, W-15 the Document Editor, W-16 and W-34 Settings), **5 name more
than one** -- the annotation overlay and this very assistant open from all
eight, so they genuinely work anywhere -- and **29 name none**. The last 34
keep the caller's page exactly as before, so nothing that worked was moved.

It composes with `EC-69`: the tool now answers "no open page matching
setting.html", which is precisely the cue the chatbot catches to OPEN Settings
and start the walkthrough there. **Verified live** through a freshly spawned
server against the running app: the model's exact call (W-16, no page) now
reports `setting.html`; after the window opens it is step **1 of 3**,
`find: "General"`, `isTargetFound: true`, `canActOnStep: true`. And the
smoking gun both ways -- `owa_find_ui "English"` answers **3 matches in the
Presenter, 0 in Settings**. The wrong ring was a wrong-window symptom, and no
matcher could have saved it: `English` is a real, exact, whole word of a real
control there.

Also shipped, same seam: a recipe cites its siblings in bold, so **`W-31`,
`W-16` and `W-29` were being offered to the card as controls to look for** in 3
steps. `stripInternalIds` already cleaned the step TEXT; the find candidates
went untouched, where they cost the real candidates their turn and would be
shown to the user in the "closest labels" line. Filtered at the same choke
point. Covered by 6 new tests.

---

## EC-71 · A recipe bullet list becomes one unreadable guide step — `open`, medium

**Seen while verifying `EC-70`.** With the "how to get here" step correctly
dropped, the FIRST thing a volunteer now reads on the Settings walkthrough card
is step 1 of 3, in full:

> General tab: - Language: click English or. Each language is listed under its
> OWN name, whatever locale you are currently in — so if a mis-click leaves you
> in a script you cannot read, the way back is still legible. (Hover a button
> and its title gives the English name.) ... - Theme: system / light / dark. -
> Font family: ... - Directories: ... - Reset buttons (Reset All Child
> Directories / Clear All Settings): these erase configuration; use with care.
> ... - Panel sizes are no longer reset from here — see.

Around 900 characters, six sub-bullets flattened onto one line with their `-`
markers intact, on a card sized for one instruction. Two separate defects in
it:

1. **`toGuideSteps` folds a numbered item's nested bullet list into the item's
   own text.** A recipe step that documents a whole panel is one step; on a
   card it should be several, or the sub-bullets should be dropped. It is not
   new — it was step 2 before `EC-70` — but it is now the opening step of that
   walkthrough, which is where a walkthrough is most easily abandoned.
2. **Stripping the Khmer twin leaves the sentence broken.** "click English or"
   and "see." are what remain of "click **English** or **ខ្មែរ**" and "see
   **W-xx**": `toEnglishOnly` and `stripInternalIds` cut the second half and the
   conjunction is left dangling. The card reads as a typo, which costs trust in
   everything else on it.

Both are in `guide.mjs`'s recipe reader, not in the manual — the page itself
reads correctly. Worth measuring across all 44 recipes before fixing: the
question is how many steps are over a readable length, not this one.

---

## EC-61 · A picture with an empty box was refused by the provider — `done` 2026-09-02

**Reported from the window, with the transcript.** The assistant had just been
asked *"Can I show you a picture of my screen?"* and had answered *"Yes, please
send me a screenshot and I'll take a look."* The user pressed 📷, sent it with
nothing typed, and got:

```
Claude could not answer — messages: text content blocks must be non-empty.
Here is what the app's own guide says.
Ask me how to do something in the app.
```

Three separate faults in one bubble, and the assistant had itself invited the
press that triggered them.

1. **The 400.** Only an `element` or a `text` attachment carries WORDS
   (`summary`), so a picture composes to nothing, and `handleAsking` deliberately
   lets an empty box through when something is clipped to it. That empty string
   became `{type: 'text', text: ''}` in `toAnthropicUserContent`, which Anthropic
   rejects outright.
2. **The error was a lie.** `describeLlmError` reads a failed call as an
   unreachable service, so a malformed request told a volunteer their provider
   was down.
3. **The fallback answered nothing.** `askHelpBot('')` returns the generic
   greeting, so the recovery under the error was *"Ask me how to do something in
   the app."*

**Shipped 2026-09-02.** One decision point, `toAskedOfModel` in
`attachmentHelpers.ts`: their own words when they typed any, an attachment's
words folded in after them, and `ATTACHMENT_ONLY_QUESTION` when the picture IS
the question. The TRANSCRIPT is deliberately not built from it — the bubble stays
the chip they sent, because words a user never typed must never be drawn as
theirs. Underneath it, `askLlmBot` now refuses to post an empty ask at all
(throwing when there is nothing to look at either), and the Anthropic loop stops
echoing an empty text block back out of the model's own tool round — the same
refusal, arriving several rounds in after the rounds have been paid for. The
offline half says it cannot see pictures and asks for words, instead of
searching the manual for a stand-in question nobody typed.

**Verified live** on Claude Haiku, in a NEW tab with no history at all (harder
than the reported case, which had the assistant's own offer behind it): the
identical press now returns a description of the app and three options to press.
Covered by 8 tests — 5 on `toAskedOfModel`, 3 on the wire shape.

**Found on the way:** `llmBotHelpers.test.ts` could not load at all — the
in-flight `free` provider reaches `langHelpers`/`toastHelpers` and so
`appProvider`, which touches `document` at module scope in a node-env suite
(memory `appprovider-mock-node-env`). The suite was silently contributing 0
tests. Fixed with the missing fourth `vi.mock`, in the pattern of its three
siblings.

---

## EC-01 · `owa_help_page` can put ~52 000 tokens into one answer — `done` 2026-08-31

**Measured live 2026-08-31** against the running dev app:

```
owa_help_search {query, kind:'internal'}  → 2 911 chars   (fine)
owa_help_page  {id:'internal:skills/owa-robot-test/references/user-workflows.md'}
                                          → 208 032 chars ≈ 52 000 tokens
```

`readHelpPage` in `help.mjs` slices at `MAX_PAGE_BYTES` = 256 KB, which is a
*file-read* guard, not a *conversation* guard. The whole body goes back as one
tool result and then sits in `messages` for every remaining round of the loop —
so one unlucky call can cost more than the entire rest of the question, on the
volunteer's own API key, and can push a small model past its context window
outright. The id above is not exotic: it is what `owa_help_search` hands the model
as a top internal hit.

**Fix shape.** Cap what the *model* receives independently of what the file is:
return the matched section plus a bounded window (a few KB), and let the model ask
for more by section id. Manual pages are small (largest ~40 KB); it is the
`internal` corpus that is huge, and internal pages are exactly the ones the model
is only supposed to *understand*, never quote.

**Shipped 2026-08-31.** `MAX_MODEL_BYTES` in `help.mjs`, split by kind, applied
in `readHelpPage`: a manual page is capped at 40 KB (above the largest one that
exists, so nothing a user needs is cut) and an internal note at 8 KB. Measured
through the app's own MCP host afterwards: the worst-case page went
**208 032 → 8 484 chars (~52 000 → ~2 121 tokens), 24.5x**; pages over 50 KB
3 → 0, over 20 KB 18 → 1 (W-22, a manual recipe, deliberately whole). The cut is
made on a line boundary and says it was cut, because a model handed a page that
stops mid-sentence reports that the steps end there. Covered by `help.test.mjs`.

---

## EC-02 · The chatbot pays for 42 tool schemas on every round — `open`, high

`llmBotHelpers.ts` sends everything `listTools()` returns, every round, up to
`MAX_TOOL_ROUNDS` (10):

| | tools | tokens/round |
| --- | ---: | ---: |
| `owa_*` | 13 | ~2 800 |
| chrome-devtools-mcp | 29 | ~5 750 |
| **total** | **42** | **~8 550** → ~85 500 per question, worst case |

A help bot for church volunteers does not need `lighthouse_audit`,
`take_heapsnapshot`, `performance_start_trace`/`_stop_trace`/`_analyze_insight`,
`emulate`, `resize_page`, `new_page` or `close_page`.

**Fix shape.** An **allowlist** in the chatbot's own client (`mcpClient.ts` /
`llmBotHelpers.ts` — `listTools()` is already the single choke point). NOT in
`server.mjs`: the outside agent and the robot-test skill drive the app through the
same server and must keep the full set. Allowlist, never denylist — a tool added
upstream must not reach a volunteer's window because nobody updated an exclusion.

**Verify by** `audit-mcp-tools.mjs` before/after plus the same question answered
correctly with the smaller set. Constraints and reasoning:
[mcp-tools.md](./mcp-tools.md) §*Pruning and scoping*.

---

## EC-03 · `evaluate_script` is offered to the chatbot's model — `open`, high

Included in EC-02's 29, but it is its own problem: the chatbot hands a language
model, steered by whatever a user types, a tool that runs arbitrary JavaScript in
a renderer **with node integration**. `navigate_page`, `new_page`, `close_page`,
`upload_file` and `handle_dialog` are the same shape, one step down.

Fixing EC-02 fixes this — provided the allowlist is written deliberately and not
by copying the current list. Do not let this ride quietly on a token-cost change:
call it out in the commit.

---

## EC-04 · `help.mjs` ranking has no test — `done` 2026-08-31

`searchHelp` decides which page answers a volunteer's question, and
`KIND_WEIGHT` (`manual` 1.5 / `internal` 1.0) is the only thing keeping developer
notes below user documentation. It has no test at all, while its neighbours
(`domMatch`, `guide`, `notify`) do — and `tools/**/*.test.mjs` already runs in
`npm test`.

**Shipped 2026-08-31.** `tools/owa-devtools-mcp/help.test.mjs`, 10 tests over a
fixture corpus written into a temp dir and pointed at with `OWA_KNOWLEDGE_DIR` —
deliberately NOT the real corpus, which is rebuilt whenever the manual changes
and would make a ranking test grade nothing. Covers: the volunteer-vocabulary
case that this run fixed, that a literal question still wins literally, the
`KIND_WEIGHT` manual-over-internal line, both halves of the `focus` rule (drop
the other window's page / keep it when it is all there is), an empty result
rather than a guess, `readHelpPage` id round-trip, and both page caps.

Writing them found a real subtlety worth keeping: the manual-first filter runs
BEFORE `applyFocus`, so when the only manual hit is the other window's page it
is still returned. That is intended, and the test now pins it.

---

## EC-05 · The verify scripts hardcode the MCP port — `open`, medium

`extra-work/verify-chatbot-tools.mjs` and `extra-work/verify-chatbot-e2e.mjs`
both open with `const MCP_URL = 'http://127.0.0.1:39223/mcp'`, even though the
published instance file carries `mcpUrl`, and `verify-chatbot-e2e.mjs` already
discovers the *CDP* port that way. A second instance, or 39223 already taken,
makes both fail as if the app were down.

**Fix shape.** Read `mcpUrl` from `<temp>/open-worship-app-cdp/<pid>.json` — the
resolver in [`scripts/audit-mcp-tools.mjs`](../scripts/audit-mcp-tools.mjs) is
~30 lines and already does exactly this, including the newest-first sort and the
`OWA_MCP_URL` override.

---

## EC-06 · `mcpClient.ts` session recovery is untested — `open`, medium

The 404 → re-open → retry-once path (and the "never replay `initialize`" guard
that stops an endless loop) is the difference between the first question after a
service working and falling back to the offline bot. It is pure logic around
`fetch` and entirely mockable, and it has no test.

---

## EC-07 · The offline fallback bot has no test — `open`, medium

`src/chatbot/helpBotHelpers.ts` is what a volunteer gets when the wifi dies
mid-service, and it is the only path with no key at all. `genGuideActions`,
`detectOpenerFocus`, the "where is" / screen-question patterns and `runBotAction`
are all testable without an app. `chatSessionHelpers` and `llmBotHelpers` have
tests; this one does not.

---

## EC-08 · `owa_guide_start` is the most expensive tool in the server — `idea`, low

~594 tokens of schema + description, more than any other tool, because it teaches
a whole interaction (steps, `manualId`, demo mode, `canDemo: false`, `labels`).
That is largely defensible. Worth revisiting only *after* EC-02, when it will be a
much bigger share of a much smaller total — and only if the trimmed version still
produces guides that land on the right control.

---

## EC-09 · Nothing catches a tool that stops being announced — `idea`, low

[`scripts/audit-mcp-tools.mjs`](../scripts/audit-mcp-tools.mjs) warns when an
acting-looking tool is missing from `ACTING_TOOLS`, but it needs a running app and
is not in any gate. A static test could assert the same thing against
`owaTools.mjs`'s registered names without the app — worth it only if a tool ever
actually ships unannounced.

---

## EC-11 · A symptom question has no route to the tools that answer it — `done` 2026-08-31

**Found by asking the live assistant, 2026-08-31.** The system prompt routes
three question shapes to `owa_help_search`: "how do I", "where is", "what does X
do". A volunteer reporting a SYMPTOM matches none of them, so the model answered
from world knowledge. Verbatim, to "Nothing is showing on the projector":

> Make sure the projector is turned on and set to the correct input source.
> Check that the presentation cable is securely connected to both the computer
> and the projector.

`owa_list_screens` answers that question outright and was never called. The same
shape, phrased as a non-native speaker would ("the words no come out big
screen"), made it GUESS a control — "this may be labeled as something like
**Hide Screen**" — which is both a guess and the opposite of what they wanted,
while `owa_list_ui` lists what is really on their screen.

**Shipped.** Two rules in `genSystemPrompt`: a symptom shape that says LOOK
before answering (and names the app's four real causes — no screen showing, the
layer cleared, the screen locked, the wrong display picked), and a flat ban on
guessing a control name. Paid for by compressing the bullet they subsume, so the
prompt grew by less than the two rules cost. Both questions now open by
diagnosing from live state; a ratchet check on the ordinary how-do-I shape
confirmed it did not make normal questions detour.

**Left open:** the panic answer still opens with "Look at the main app window",
a non-step the prompt already forbids for guide cards but not for prose, and it
did not offer a walkthrough. That is `EC-12`.

---

## EC-12 · Prose answers still contain non-steps, and skip the walkthrough offer — `open`, medium

The prompt forbids "look at the app window" as a *guide card* step ("something
you say in the chat, never a step"). The same rule is not applied to the numbered
steps in a prose answer, and the fixed panic answer duly opens with:

> 1. Look at the main app window.  2. Find the "Screen Preview" area.

Neither is a control to press; both are throat-clearing before the one real step.
The same answer also did not offer a walkthrough, while the non-native phrasing of
the identical question did. Under the scoreboard's all-four rule that is still a
fail, and it is the gap between the two spot-checks that moved this run.

**Fix shape.** Generalise the existing non-step rule from guide steps to every
numbered list, and make the walkthrough offer unconditional for a multi-step
answer rather than something the model chooses. Verify by re-asking both panic
phrasings and requiring identical structure.

---

## EC-13 · `kind: 'auto'` serves builder notes when the manual has nothing — `open`, medium

`searchHelp` falls back to the internal corpus whenever the manual scores zero,
so "Can it stream to Facebook?" — a question about something the app cannot do —
comes back with developer memory files as the only hits. Measured this run, the
top hit for it is now this skill's own research playbook.

The model handled it correctly live (it said the app has no built-in support and
suggested OBS, leaking nothing), so this is a hazard rather than an active defect
— which is why it is medium and not high. But the corpus split exists precisely
so a user's question is never answered from builder notes, and "the manual has
nothing" is better answered as *nothing* than as a note the model is forbidden to
quote. Worth pairing with a prompt line that says an empty manual result is a
legitimate "the app does not do that".

---

## EC-14 · Retrieval cannot answer a symptom, and should say so — `idea`, low

Established this run: "the words no come out big screen" has no lexical path to
the page that answers it, even with the filler words stripped, because no manual
page can state whether *this* screen is showing right now. The alias table lifted
the panic phrasing onto the right page and could not lift this one, and no amount
of ranking work will.

If symptom questions keep costing a round on a search that cannot help, the
cheaper shape is for `owa_help_search` to recognise the symptom shape itself and
answer with a pointer to `owa_list_screens` instead of its best lexical guess.
Only worth doing if the round is actually being spent — instrument first.

## EC-18 · The ring landed on the wrong control — `done` 2026-08-31

**Reported from the app with a screenshot.** The walkthrough step "Open the
Background panel" ringed **`Background:`** — the background-*transition* button
in the screen preview footer — and pressing **Do it** opened the transition menu
instead of the panel. Measured live, five things on screen matched the word
"Background" and every one of them tied at tier 1:

| candidate | control? | label length |
| --- | --- | ---: |
| the collapsed **Background** panel bar | **no** (a `div`) | 28 |
| `Background:` transition button | yes | 33 |
| **Clear Background [F7]** button | yes | 41 |
| the screen-preview card, the transition group | no | 57 / 31 |

Two independent causes, both now fixed:

- **The app lied about what the control is.** `RenderHiddenWidgetTitleComp` —
  the thin bar that is the only way to reopen a panel you collapsed — was a
  clickable `div` with no `role`, so `checkIsControl` ranked it below any real
  button sharing its words. It is now `role="button"` with `tabIndex={0}` and
  Enter/Space activation, which also means a keyboard can reopen a collapsed
  panel for the first time.
- **The matcher broke ties on length.** `checkIsBetter` went tier → isControl →
  shortest label, and "Background:" is shorter than "Background Enable
  Background". Length is a proxy for specificity and a bad one. `labelOf` now
  keeps each way an element is named APART as well as joined
  (`labelPartsOf`), and an element one of whose names IS the needle
  (`checkIsNamedExactly`) beats one that merely contains it — ranked BELOW
  `isControl` on purpose, because a container is often named exactly what the
  control inside it is named. Note tier 0 was near-dead code before this: any
  element with both text and a `title` could never reach an exact match.

Verified live end to end on the real W-08 recipe from a collapsed layout:
step 1 rings the panel bar, **Do it** reports
`{done: true, did: "clicked", label: "Background"}`, and the panel expands to
its tabs. `owa_find_ui "Background"` also now heads its list with the panel bar.

## EC-19 · A two-letter candidate matched inside a longer word — `done` 2026-08-31

**Found while verifying EC-18, in the same recipe.** W-08 step 2 offers "Ok"
(from "choose **Ok** or **Cancel**") as a control to ring. Nothing on screen is
labelled "Ok" — but `matchTier`'s tier 2 was a plain substring test, and
"Bible Lookup Open bible lookup popup [Ctrl+B]" contains **lo-ok-up**. So the
step rang the **Bible Lookup** button, and in demo mode **Do it** would have
PRESSED it, opening a popup over a volunteer's presenter mid-service. Strictly
worse than the reported bug, and it was one step further into the same guide.

Tier 2 now requires the needle to at least BEGIN a word. That keeps the case
tier 2 exists for — the manual writes "**Web**" for a tab labelled "Webs" — and
drops the case it never wanted. Verified live: step 2 stopped ringing Bible
Lookup.

## EC-20 · A row of tabs written as one bold had nothing to ring — `done` 2026-08-31

With EC-19 fixed, W-08 step 2 rang *nothing*: the recipe names the whole tab row
in a single bold, "**Colors / Images / Videos / Cameras / Web**", and no control
carries that string. Honest, but useless. `toFindCandidates` now offers each
part of a slash-joined bold as its own candidate — the joined phrase FIRST, so a
control genuinely named "A / B" still wins it — and drops the punctuation the
sentence needed but the button does not ("**Colors:**" → `Colors`). Verified
live: step 2 rings the real **Colors** tab (tier 0).

This is a slice of `EC-16`'s 24 "step bolds nothing actionable" steps, taken from
the other end: not by guessing from typography, but by reading the shape the
manual actually writes.

## EC-21 · The card showed a volunteer a manual id — `done` 2026-08-31

Visible in the same reported screenshot: the card read *"Open the Background
panel **(W-08 step 1)** and choose the Videos tab."* The system prompt already
forbids this in as many words — *"NEVER show them ... an id like \"W-06\" — not
even in passing"* — and the model did it anyway. A rule the model can ignore is
not a rule.

`stripInternalIds` now cleans every step text and the title, at one choke point
covering both sources (the model's own steps and a recipe citing a sibling —
W-08 step 2 cites W-15 itself). The whole aside goes, not just the id: deleting
"W-08" out of "(W-08 step 1)" leaves "( step 1)", which is worse than what it
replaced. Verified live through the app's own MCP host with the reported step
verbatim. Words on real controls are untouched ("Ctrl+Q", "16:9", "F7").

**Left open:** the same ids can still reach the user in ORDINARY prose answers,
which do not pass through the guide. That is `EC-22`.

## EC-22 · Prose answers are still on the honour system for ids — `done` 2026-09-08 (see `EC-92`)

`EC-21` enforces the no-ids rule for anything drawn on a guide card, because
that is where it was caught. A plain chat answer still relies on the prompt
alone, and the same model ignored that prompt once already. The cheap version is
to run the assistant's final text through the same `stripInternalIds` before it
is rendered in `ChatbotAppComp`; the honest question first is whether it happens
in prose at all — instrument before building, the way `EC-14` asks.

## EC-23 · `genSessionId` collides, and flakes the whole gate — `open`, medium

Found by running the gate for `EC-18`: `npm run lint` failed at its FIRST stage
on `src/chatbot/chatSessionHelpers.test.ts` — *expected 499 to be 500* — with
nothing in this change anywhere near it. Reproduced 1 run in 3.

`genSessionId` is `Date.now().toString(36)` + **4** random base-36 characters,
so ids drawn inside one millisecond have 36⁴ ≈ 1.68 M values to land in. The
test draws 500 of them; the birthday probability of a collision is ≈7% per run.
The test is right and the generator is thin.

It matters twice: the gate is `&&`-chained, so a 7% flake at stage one silently
skips the typecheck, prettier, eslint AND build for whoever hit it; and a real
collision merges two of a user's chat tabs. `slice(2, 6)` → `slice(2, 10)` takes
the odds to ~1e-7 and changes nothing else (the ids are opaque keys). Left for
the user to take, because it is product code outside the reported defect.

## EC-24 · A step whose control is inside a menu could only apologise — `done` 2026-08-31

**Reported from the app with a screenshot**, one step further into the same
walkthrough as `EC-18`. W-21 step 2 — *"Right-click an empty part of the list
(or use the + button in the folder-path bar) and choose **Download From URL**"*
— answered:

> I could not do that one for you (nothing on screen to act on) - do it
> yourself, then press Skip.

Correct, and useless. **Download From URL** is genuinely not on screen; it is one
right-click away. Three separate things were wrong:

- **The guide could not right-click at all.** `action` was `click` or `type`.
- **The step's target is a REGION, not a control.** "an empty part of the list"
  has no words on it, and no label matcher will ever find one.
- **A step like this is two actions**, and the card does one per press.

Shipped, and it is the shape that matters more than the case:

- `action: "rightClick"` — `dm.openContextMenu` fires a real `contextmenu` at a
  point INSIDE the region (bottom right: a list fills from the top left, so
  that is its empty part, and right-clicking an item gets the *item's* menu,
  which is a different menu). Verified against the app before any of it was
  written.
- `dm.findListRegion(point)` answers "which list?" the way the user would: the
  scroller above the point the guide last acted at — a panel opens exactly
  where the bar that opened it was — then the NEAREST scroller to that point,
  and only then the biggest on screen. `state.lastPoint` carries it.
- **A step may take two presses.** After any demo action, a label the step
  itself names that was NOT on screen and now IS comes back as `more`, and the
  card holds the step: *Done - and it brought up "Download From URL". Press Do
  it again to finish this step.* It is never clicked for them — "click
  **Delete**, then **Yes**" would otherwise confirm its own dialog.
- `state.pendingFind` aims that second press at what the first revealed.
  Without it the press re-reads the step's candidates from the top and lands on
  whatever still answers to the FIRST of them — live, step 1's second press
  clicked the `Background:` transition button instead of the **Videos** tab it
  had just opened.
- `toGuideSteps` marks a step `rightClick` only when the sentence BEGINS with
  one. W-08 step 2 ("Pick a tab … (or right-click the empty list)") mentions one
  as an aside and its real action is a plain click on a tab already on screen;
  the first version of this broke it.

5 manual steps across W-18, W-21 and W-22 are right-click steps that used to
apologise every time. The two-press completion is wider than that: 105 of the
251 manual steps name more than one control.

Verified live end to end on the real W-21 recipe from a collapsed layout:
press 1 clicks **Background** and reveals **Videos**; press 2 clicks **Videos**;
press 3 right-clicks the list at (797, 822) and the app's own menu opens with
**Download From URL** ringed; press 4 clicks it and the link box appears.

**Also found and fixed:** the manual told the user to press a **+** button in the
folder-path bar. There is no such button — it is a **⋮ More Options** button
(`ListMenuButtonComp`). The recipe now describes it, deliberately WITHOUT
bolding it: "More Options" is the title of several buttons in the app, and
bolding it hands the ring an ambiguous label — the first attempt duly rang the
mini-screen's ⋮ instead.

## EC-25 · The Khmer twin left a husk in the card — `done` 2026-08-31

Visible in the same screenshot: the step ended *"…and choose Download From URL
**(URL)**."* `toEnglishOnly` dropped a bracket only when it held Khmer and
nothing else, so `(ទាញយកពី URL)` lost its Khmer and kept its Latin word. Any
bracket holding Khmer is a translation aside and now goes whole. Brackets that
are all English ("(or right-click the empty list)") are untouched. 0 husks left
across the 251 manual steps.

## EC-26 · The ring landed on the wrong control AGAIN, with the panel open — `done` 2026-08-31

**Reported from the app with a screenshot — the same symptom `EC-18` closed.**
The W-21 walkthrough step *"Open the **Background** panel and choose the
**Videos** tab"* ringed **`Background:`**, the background-*transition* button in
the screen preview footer.

`EC-18` was verified *"live on the real W-08 recipe from a collapsed layout"*.
That is the whole story: with the panel COLLAPSED its title bar is on screen and
says "Background", so the tie-breaks `EC-18` added had something right to pick.
With the panel **OPEN** the pane draws its name nowhere at all — measured live,
the only element on the whole window whose own text was "Background" was the
transition button. There was nothing to rank; the ranking was never reached.

A fix that can only be verified in one of a control's two states is not a fix.

Three changes, in order of how much they carry:

1. **A panel has a name in the DOM, open or collapsed** — every resizable pane
   carries `data-widget-name` (`RenderResizeActorItemComp`), and so does the
   collapsed title bar. It is the **English** key from `toWidgetLabel`, not the
   translated `widgetName`: a panel that only answers to its Khmer text is one
   the matcher loses the moment the app is switched over. Panes named after a
   file or a slide have no English twin and fall back to what they display.
   Production DOM too — `data-react-comp-name` is dev-only, so component names
   were never an option here.
2. **The matcher reads the parent path** (`domMatch.mjs`). `parseNeedle` splits
   `Background > Videos` into a scope and a target and treats the scope as a
   requirement; a trailing kind noun (`panel`, `tab`, `box`) is dropped rather
   than spent on a failed match, and a *region* noun additionally says the words
   in front of it name a place, not a press. `containerPathOf` walks at most 24
   ancestors for at most 4 names, and only for elements that already matched.
   `pathTier` lets the panel supply words the label lacks (`Background Videos`)
   as long as at least one word is on the control itself — otherwise every
   control in a panel answers to the panel's name. `describe` reports `inPanel`.
3. **A recipe that qualifies a bold scopes the rest of the step to it**
   (`guide.mjs`). "the **[en:tran:Background]** panel … the **Videos** tab"
   now yields `Background > Videos`, `Background panel`, `Background`,
   `Videos` — in that order, which is the adaptive part: the scoped candidate
   can only match once the panel is open, so a collapsed panel still rings the
   panel bar, which is the half of the step not done yet.

Verified live in both states: open → the **Videos** tab inside the Background
panel, hint *"The ringed control is in the Background panel, at the middle left
of this window"*; `owa_find_ui "Background"` now answers with the panel first
where it used to answer with the transition button. 9 tests added.

Cost: +97 tokens/round (~8686 → ~8783) for the `Panel > Control` syntax in three
tool descriptions. Tool count unchanged at 42.

## EC-27 · The guide card parked itself on top of its own ring — `done` 2026-08-31

**Reported from the app with a screenshot.** The card opens bottom right and the
ring lands wherever the control is, so a step pointing at anything in that corner
was a card reading *"the ringed control"* with the ring underneath it. The
frosted glass was not enough: a control read through an 18px blur is not a
control you can find.

`avoidRing(rect)` picks the first of the four corners that clears the ringed
rect by 12px, bottom right FIRST so a ring nowhere near the card never moves it,
and the least-bad corner when a ring is big enough to reach all four. Corners
only, never a slide — a card that shuffles every time the ring twitches is worse
than one briefly in the way. It stands down permanently once the user drags the
card: they know what is under it and the guide does not. The rect is passed in
rather than read back off the ring, whose 150ms transition means its own box is
still the last step's.

Verified live: a step aimed at the screen preview's `Background:` button moved
the card to the bottom left (overlap 0); a step aimed at the middle left left it
in place.

## EC-28 · The ring only animated its size — `done` 2026-08-31

Asked for directly. The app window is mostly bordered boxes, so a ring that only
grows and shrinks reads as one more of them at a glance. The colour now travels
with it, red through amber and back — `owa-ring-beat` (colour + size) while the
guide waits on the user, and a new `owa-ring-glow` (colour only, no geometry)
while demo mode is about to press it, so "I am about to do this" still reads as
alive rather than as a leftover outline. `prefers-reduced-motion` drops both.

`owa_find_ui`'s own `flash` marker got the same treatment. Its border is set
inline, which the keyframes override: an animation outranks a `style` attribute
in the cascade, so the colour can travel without restyling the marker per frame.

## EC-29 · The help window covered the control its own card was ringing — `done` 2026-08-31

Reported from the app with a screenshot: the chatbot popup sitting over the
middle of the presenter while its card said to press a control behind it, the
minimise button circled by hand.

Measured live before the fix, on the real window at the position the user had
left it:

```
chat window   515x540 at 99,175
app client    1243x837
25 of 208 named controls (12%) sit under the chatbot window
```

The card already dodges its own ring (`EC-27`) — but only inside the app
window. An OS window on top of that one is invisible to it, movable by the
user, and hides a quarter of the app wherever they park it. Nothing in the
guide could see it, and nothing in the guide could move it.

**Shipped.** A walkthrough says out loud when it starts and stops, and the app
takes the window off the screen for the length of it:

- `guide.mjs` — `signal()`, fired from `start()` and `stop()` on a CHANGE of
  `state.isRunning` (a restarted guide, which the chatbot does routinely, must
  not re-fire). A `document.dispatchEvent`, because the runtime is an injected
  expression that may not import an app module.
- `src/helper/domHelpers.ts` — hears `owa-guide-running`, relays
  `all:app:guide-running`. The sender IS the guided window, which is what the
  main process needs.
- `electron/electronHelpers.ts` — `setGuideRunning`: minimise the chatbot
  window, and focus the guided one (a demo `type` step needs real OS focus).
  Restore on stop.

Three refusals, all tested: a window not overlapping the guided one is left
alone (and therefore not "restored" afterwards either — a second monitor must
not have a window pop up at the end of every walkthrough it took no part in);
a window the user minimised themselves is neither minimised nor restored; one
they bring back mid-walkthrough stays theirs. `tuckedAwayWin` is the whole
mechanism and it is deliberately a single reference, not a set: there is one
chatbot window.

Verified live, both by the tool and through the real window: **Show me step by
step** pressed in the chat → window minimised, presenter foreground, card
reading *Look up and present a Bible verse — step 1 of 6* ringing **Bible
Lookup**; the card's **✕** → window back on top. Plus 4 unit tests on
`setGuideRunning`. CB-09 extended, W-42 step 12 extended, README and
`.claude/CLAUDE.md` updated.

Recovering the window by hand was already handled and still is: the taskbar,
or the robot button, which `handlePopupWindowOpen` answers by restoring the
window that is open rather than making a second one.

Two things verification itself forced, both shipped with it:

- **The restore does not re-read `isMinimized()`.** It used to, as the "has the
  user taken it back?" test, and a stale answer leaves the window down with no
  way back but the taskbar. Whether the user reclaimed it is a thing to be TOLD
  — `chatbotWin.once('restore')` (and `'closed'`) drops the reference — not a
  state to re-read a beat later. `releaseTuckedAwayWin` runs before this code's
  own `restore()`, so our own call cannot re-enter through the same event.
- **The runtime removes a stale `#owa-guide-host` when it installs.** Deleting
  `window.__owaGuide` to pick up an edited `guide.mjs` is the documented move
  (memory `dom-match-memoised-in-page`) and it used to leave the old card in
  the document, complete with its own click handlers, FIRST in document order.
  A verification script's `getElementById` then drove the dead card and read
  the live one as broken — which is what "an intermittent restore failure"
  turned out to be, after five reproductions that were all the harness.

---

## EC-30 · Pressing a walkthrough button starts the guide TWICE — `open`, medium

Found while verifying `EC-29`. `handleActing` runs `runBotAction` (which starts
the guide from the recipe) and then, when `isNeedingModel`, asks the model the
action's `ask` — which starts the guide AGAIN with the model's own steps. That
is deliberate and documented (the recipe card is the fast half, the model's is
the accurate half), but it is worth measuring: it is a whole model round plus a
second `owa_guide_start`, and the user watches the card change under them.

Observed live 2026-08-31: pressing **Show me step by step** put up the W-06
recipe card, then a model round replaced it — `owa_guide_status` afterwards
read `lastAction: "started"` on a guide the user had already closed once.

Worth answering before changing anything: how often is the recipe card actually
not good enough? `runBotAction` already knows (`isGoodEnough`), so the second
half could be gated on THAT alone rather than on `action.ask !== undefined`.
Cheap to measure, and it would cut a round off the most-pressed button in the
window.

---

## EC-32 · The window offered eight questions and hid the other two hundred — `done` 2026-09-01

**Reported from the app with a screenshot** circling the four "Try asking" chips.
They were a hardcoded `STARTER_QUESTIONS` array in `ChatbotAppComp.tsx`: four
strings per focus, chosen once, with nothing behind them. A volunteer who did not
want one of those four had an empty box and no idea what this thing could be
asked — and no way to find out short of guessing, which is exactly when the model
invents a feature.

**Shipped 2026-09-01.** `tools/owa-devtools-mcp/questions/*.json` — **208
questions across 5 pages and 30 sections**, one file per page of the app
(presenter, reader, editor, settings, and `common` for what is true in every
window), sectioned by the panel the user is looking at. Each entry carries the
resources that answer it — `recipe` (`W-xx`), `related`, `find` (an
`owa_find_ui` target), `menu` (for native menu paths, which cannot be ringed),
`shortcut`, `tools`, `guide` — so an answer is a lookup, not a search round.
Every question is drawn from a live-verified `W-xx` recipe or a live tool;
nothing was invented.

Three consumers, one ranking:

- the ask box now **suggests as the user types** (`questionHelpers.ts` +
  `RenderSuggestionsComp`), ranked locally with the section name beside each
  suggestion, arrow keys and Enter to take one — it fills the box rather than
  asking, so a suggestion never spends a call on the user's key;
- the "Try asking" chips come from the same corpus via `starterRank`. The
  hardcoded array survives only as `FALLBACK_STARTERS`, for a failed import;
- `owa_list_questions` gives the model the outline, or the ranked nearest
  questions, so a vague ask is answered with what the app CAN do.

`questionMatch.mjs` holds the one ranking (no `node:fs`, so the renderer bundles
the same module the server runs); `questions.mjs` is the disk wrapper.
`questions.test.mjs`, 21 tests, runs against the REAL corpus.

**Cost:** tool schema went **~8 857 → ~9 179 tokens/round (+322, +3.6%)**. Paid
knowingly: it buys the one route out of "the manual has nothing" that does not
end in a guess. It also makes `EC-02` (prune the 29 chrome-devtools tools, worth
~5 750) more valuable, not less.

---

## EC-34 · A Khmer volunteer was told to press English words — `done` 2026-09-01

**The evidence**, straight out of the window (user's own screenshot, run
`label-i18n`): an answer to "How do I present a Bible verse" that read

```
# W-06 — Look up and present a Bible verse
# W-06 — Look up and present a Bible verse
1. Press Ctrl+B (or click Bible Lookup ស្វែងរកព្រះគម្ពីរ in the header). 📷
5. Press F9 (Clear Bible — លុបព្រះគម្ពីរ) to take the verse off screen.
```

Three defects in one answer, all structural:

1. **The manual carried both languages by hand** — a bold English label with its
   Khmer twin in brackets after it, 187 of them. `toEnglishOnly` stripped them from
   search EXCERPTS and was never applied to `readHelpPage`, so the whole-page
   read — the one the model actually answers from — handed over both halves and
   the model pasted them.
2. **The copies had gone stale.** Six were simply wrong: the manual said
   `គ្រប់កណ្ឌគម្ពីរ` for **All Books** where the app says `សៀវភៅទាំងអស់`,
   `វេប` for **Webs** where it says `វេបសាយ`, `កំណត់` for **Settings** where it
   says `ការកំណត់`, plus a typo (`កណ្ណត់ត្រាព្រះគម្ពៀរ`), a wrong **Notes** and a
   wrong **Others**. Nothing could catch it: a hand-written twin has no oracle.
3. **`owa_help_page` printed the page's own title again.** It prepended
   `# ${page.id} — ${page.title}` to a body that already opens with exactly that
   line, so the model saw it twice, pasted it twice, and leaked the recipe id
   the prompt forbids in the process.

And underneath all three: an English label is not what a Khmer user's screen
says, so a guide card's `find` matched no control at all in a Khmer window.

**Shipped 2026-09-01.** Documents name a control with a template —
`Press **F9** ([en:tran:Clear Bible])` — and `tran.mjs` fills it in with what
that key reads as in the language the app is DISPLAYING, on the way out of
`owa_help_search`, `owa_help_page` and any guide built from a recipe. 187 twins
converted across the corpus; the six stale ones are now simply right, because
the label comes from the app's own dictionary rather than a copy of it. New
`owa_tran` tool answers the same question for a label the model wrote itself,
and `owa_find_ui` / `owa_click` / `owa_type` retry with the translation when the
English label matches nothing. `owa_help_page` stops repeating the title, drops
the recipe ids the page cites in passing, and drops the manual's `📸` marks;
the system prompt gained a WRITE THE ANSWER YOURSELF block, because the root
cause of that screenshot was a model pasting a document at a volunteer.

Guarded by `tran.test.mjs`, which walks the whole corpus and fails on a key no
language can translate — invisible otherwise, since an unknown key falls back to
its own English text — and on a hand-written twin coming back.

---

## EC-47 · A word matched a different word that starts the same — `done` 2026-09-01

**Reported from the app with a screenshot**, and the mechanism found by measuring
retrieval rather than by reading the answer. The user asked the presenter's own
starter chip **"Is any screen showing right now?"**, got a correct answer about
the mini screen and `F5`, pressed **Do it for me**, and was walked through
**W-20 — Show the keys you press (Keyboard Screencast)**, step 2 of 8: *"In the
panel's title bar, click the keyboard button (`K`)…"*.

The search behind it:

```
owa_help_search {query: "show screen", focus: "presenter"}
  W-20  Show the keys you press (Keyboard Screencast)   84   <- the guess
  W-10  Control what the audience sees (mini screen)    59
```

`countTerm` matched any term of four letters or more against the START of a word
with no bound on the rest, so **"screen" matched "Screencast"** — in a page
TITLE, where a hit is worth 14. Deliberate for "look"→"lookup" and
"verse"→"verses"; unbounded, it also produced 45 wrong-word pairs live in this
corpus, 229 occurrences, 10 of them in a title:

```
back -> background x51   every -> everything x29   down -> download x14
song -> songselect x12   some -> something x11     copy -> copyright x7
screen -> screencast x6  drop -> dropdown x5       stop -> stopwatch x4
```

So "How do I **copy** an answer?" ranked *See who published a Bible translation
(and its **copyright**)* first, and W-20 was hijacking three separate questions
about screens.

**Shipped.** The tail is capped at three characters — every inflection this
corpus needs ("verses" +1, "screens" +1, "lookup" +2, "presenting" +3) survives
and all 45 pairs are cut, the shortest of which adds four. A real form that
doubles its consonant ("dragging") is lost with them; the base word still
matches, and a wrong page is the more expensive of the two mistakes.

**Also shipped, from the same measurement.** Coverage is now weighted by how
much each word SETTLES rather than by how many words matched. Counting words
read "How do I move to the next slide?" as a three-word question, and the page
that answers it — W-03, whose step 3 is *"step through slides … Arrow keys /
PageUp / PageDown"* — carries only "slide": one of three, squared, is a 0.11
multiplier, so it scored 7 while a presenting-flow page saying "move", "next"
and "slide" in passing scored 27. The inverse frequencies the score already
computes build the ratio for free, and the square comes off — the weighting is
the discrimination it was standing in for.

Measured on two sets, before → after. Both columns are run against the SAME
knowledge bundle — the one with EC-49's restored page in it — so the ranking
change is not credited with the page restoration (on the older bundle the
baseline is 135):

| Set | top-1 | top-3 | not in top-5 |
| --- | --- | --- | --- |
| The 236 corpus questions, each labelled with its own recipe | 136 (58%) → **140 (59%)** | 179 (76%) → **186 (79%)** | 38 (16%) → **37 (16%)** |
| 45 held-out volunteer paraphrases (written from recipe titles only) | 21 (47%) → **23 (51%)** | 31 (69%) → **32 (71%)** | 11 → 11 |

Per-query: **26 top-1 answers changed, 9 now right that were wrong, 3 now wrong
that were right** (two of those three are defensible — "What do the reset
buttons in Settings do?" moved from W-16 to W-31, which is where the reset
buttons are). The aggregate is deliberately not the headline: this fix is about
a class of *catastrophic* misses, where the winning page is from another subject
entirely, and three of the nine fixed are the reported one —
`show screen`, `how do i turn off the screen` and `How do I clear everything off
the screen at once?` all left W-20 for W-10.

---

## EC-48 · The walkthrough buttons walked a page the model never used — `done` 2026-09-01

The other half of the same screenshot, and the more serious half: even with
perfect retrieval this would still fire.

`ToolWatchType` was `{ manualId: string | null }`, set from the first manual hit
of the **first** `owa_help_search` and guarded with `watch.manualId === null` so
nothing could ever revise it. Everything the model did afterwards — refining the
query, opening the page it actually answered from with `owa_help_page`, reading
the live screen state — changed nothing. The two buttons under the answer, and
so `owa_guide_start`'s `manualId`, carried the model's first guess.

That is why an answer written from W-10 and `owa_list_screens` offered an
eight-step walkthrough of the keyboard screencast: `runBotAction` starts the
guide with those args *before* the model is asked anything.

**Shipped.** Two signals, kept apart because they are not worth the same:

- `owa_help_page` is the model SAYING this page answers the question. Last one
  wins, and it beats every search.
- The top hit of a search is a guess. Overwritten by each later search rather
  than latched — a second search is the model saying its first query was the
  wrong question to ask.
- A model that started its own card with `owa_guide_start` is offered nothing: a
  button that starts a second walkthrough is a wrong turn by construction.

The watching is split out of `runMcpTool` into `applyToolWatch` /
`toWatchedManualId`, pure and exported, so the rule can be read and tested
without a live MCP host — seven tests in `llmBotHelpers.test.ts`.

---

**Verified live 2026-09-01 on GPT-5, in the real window, on the reported question itself.** The presenter's starter chip "Is any screen showing right now?" now answers *"No. No presentation screens are showing right now."* with the replies **Help me show it / Which screen should I use? / No thanks** and **no walkthrough buttons at all** -- the model answered from live state and opened no manual page, so there is no recipe to walk. Pressing **Help me show it** reproduces the reported answer word for word (*"Click **Toggle showing screen [F5]** in the Mini Screen header. Or press **F5**"*) and still carries no walkthrough of anything else. The useful case is untouched: "How do I put a Bible verse on the screen?" answers in five steps and DOES offer **Show me step by step** / **Do it for me**, and pressing it starts `title: "Look up and present a Bible verse"`, step 1 of 6, `find: "Bible Lookup"`, `isTargetFound: true` -- the right recipe, ringing the right control. Note the app's own MCP host caches its ESM graph for the life of the process, so the retrieval half of this was verified through a freshly spawned `bin.mjs` over stdio (`owa_help_search "show screen"` -> `W-10, W-31, W-18`, W-20 gone from the top three) and reaches the running app only on its next restart.

---

## EC-49 · Four supported questions pointed at a page that was never written — `done` 2026-09-01

Found while measuring EC-47: of the 235 corpus questions carrying a recipe, four
named **`W-01b`**, and `listKnowledgeEntries()` had no such entry.

`docs/scripts/build-manual.mjs` matched `/^###\s+(W-\d+)\s+[—-]\s+(.+?)\s*$/` —
digits only. `### W-01b — The ⋮ button: everything a thing can do` did not match,
and rather than failing it fell through as an ordinary body line, so the whole
recipe was **folded into W-01's page** and took W-01's `verify` row list with it
(W-01 was carrying `GL-24, GL-06`, which are W-01b's). No page with `id: W-01b`
was ever written, so `owa_help_page {id: "W-01b"}` returned nothing and a
walkthrough started on it could not run.

`⋮` is how the app does rename, delete, duplicate and export, so this is not an
obscure corner.

**Shipped.** The heading pattern takes an optional letter, and a `### W-` line
the pattern cannot read now **throws** instead of being silently absorbed. The
manual regenerates to 43 workflows (was 42), W-01 gets its own `verify` rows
back, and the knowledge bundle carries 44 manual documents.

The guard is the real deliverable: `questions.test.mjs` already asserted it
"points every recipe at a real manual id" while only checking the *shape*
`/^W-\d{2}[a-z]?$/` — which `W-01b` passed for months. A second test now reads
the ids off `docs/manual-sources/**` and fails on a recipe with no page. Shape
is not existence.

---

## EC-51 · A question could only ever be a sentence of English — `done` 2026-09-02

**Asked for from the app**, with a screenshot of the ask box circled: *"I want to
be able to attach files (especially image), paste image from clipboard, inspect
dom element to attach, attach screenshot ..."* — then widened twice mid-request:
*"for something unclear the ai should ask for more input from user"* and *"during
waiting for api response user should able to add more input"*.

The box was an `<input type="text">` with no paste, drop or attach handler
anywhere, so everything the assistant knew it had to go and fetch for itself. For
a volunteer who cannot NAME what they are looking at, that is the whole problem:
"it's not working" plus a picture is one question, and the same thing in words is
five rounds of the model guessing — which is what `EC-11`, `EC-18`, `EC-26`,
`EC-47` and `EC-50` are each a bill for.

**Shipped.** Five ways in, one capped list of chips: the paperclip, a paste, a
drop, **📷** a picture of the app window, and **🎯** pointing at a control. Plus
`NEEDS: screenshot|element|file`, a second frame the model can end an answer with
so it ASKS to be shown instead of guessing, stripped unconditionally the way
`OPTIONS:` is.

Four decisions worth not re-deriving:

- **The bytes are never persisted.** `chatbot-sessions` is read whole and
  synchronously at startup; a message keeps the DESCRIPTION and the picture lives
  in a bounded in-memory map that dies with the window. `toValidAttachments`
  LISTS the fields it copies rather than spreading, so a hand-edited file cannot
  put a `dataUrl` back in. A reopened tab shows the chip greyed, which is the
  truth rather than a broken thumbnail.
- **1024px long edge, and PNG first.** The provider charges by DIMENSIONS
  (~w·h/750 tokens), so re-encoding without resizing saves bytes and not one
  token — and the first user message is re-sent on every one of up to ten rounds,
  so one 1920-wide screenshot is ≈2 765 × 10 ≈ **$0.14 on Opus 5** for a question
  that otherwise costs a fraction of that. JPEG is the fallback only when the PNG
  comes back photo-sized: the subject is small text and thin borders, which is
  exactly what JPEG rings around, and the smaller file buys nothing the model can
  see.
- **Images never enter the history.** `toHistoryTurns` measures on `text.length`
  and rides every round, so a data URL in `message.text` would be clipped to 800
  characters of base64 and re-sent forever. `toHistoryTurn` puts
  `(with a picture attached)` there instead — ~30 characters against ~1.4 MB.
- **A blind model is refused before the call, not after.** Sending an image to a
  text-only model is a 400, which `describeLlmError` reads as an unreachable
  service and would tell a volunteer their internet is down. `checkCanSeeImages`
  is an allowlist per provider (not a flag per model — one chosen through *More
  models…* has no entry to carry a flag) and the window offers one that can see,
  in a press.

**Asked for while it was being built, and shipped with it**: *"as a user I want
to see where the element is. click the attached selector should highligh the
elelement"* and *"click on attached file/image should see preview for image or
reveal in file location"*. Every chip is pressable, and what it shows depends on
what it is -- a pointed-at control is RUNG where it lives by its stored selector
(`owa_highlight_selector`, a third client-only tool: by the words would be a
guess, and half the labels in this app sit on more than one control), a picture
opens full-window, and anything that came from disk opens its folder. The
`filePath` is persisted where the bytes are not, so a chip can still open a
folder after the picture behind it has gone.

Covered by 39 new tests across `attachmentHelpers`, `chatSessionHelpers`,
`quickReplyHelpers`, `llmBotHelpers`, `domMatch` and a new `picker.test.mjs`.
New CB-26..CB-31.

---

## EC-52 · An answer on its way could not be added to — `done` 2026-09-02

The box was `disabled={isBusy}` for the whole time an answer was coming, so a
question asked with a detail missing had to be STOPPED and asked again — paying
twice, and throwing away every round already bought on the user's own key.

**Shipped.** `askLlmBot` takes a `takeAdditions` pull callback. The rule that
makes it safe is WHERE it is drained: only after the tool results are pushed,
which is reachable only when the model called a tool, and it can only do that
while tools are still being sent — so another model call is guaranteed. Drained
anywhere near the early return, what the user typed would simply be swallowed.
That also means the return shape does not change: an item handed over IS the
proof it was folded, and whatever is left when the promise settles is the
leftover, asked on its own with a note saying so.

Three things this cost that a first draft would not have:

- **Anthropic's ordering is part of the shape.** In a user message carrying tool
  results the `tool_result` blocks come FIRST and any text AFTER them; the
  addition is a trailing text block inside that same message, and the local at
  the push site widens from `ToolResultBlockParam[]` to `ContentBlockParam[]`. A
  second consecutive `user` message would be MERGED rather than refused, which is
  worse — it would look right. (The comment claiming Anthropic "rejects"
  consecutive user turns is stale; `toHistoryTurns` still joins them, for token
  economy and the first-message-must-be-user rule.)
- **Nothing typed may be lost.** The queue lives on the pending ask, not inside
  the loop, so a call that dies mid-round hands it back: `handleCancelling` puts
  everything — taken and untaken alike — into the draft.
- **Routing reads the pending LIST, not `isBusy`**, which in that closure is the
  stale value `isForced` exists for; and never a walkthrough rescue, whose answer
  is one line drawn on a card where the user would never see their aside.

---

## EC-53 · Two tools on the server, neither offered to the chatbot's model — `done` 2026-09-02

`owa_screenshot` and `owa_pick_element` are registered like every other tool, so
an outside agent and the robot-test skill get them, and `modelTools.mjs` filters
them out of the list handed to the model. The window calls them itself when the
user presses a button. (It lived in `llmBotHelpers.ts` as
`CLIENT_ONLY_TOOL_MAP` until `MC-06` moved it into the package and grew it from
3 names to 19.)

That is the whole reason the server can grow two tools while a volunteer's
question costs the same tokens per round as before — and it is the choke point
`EC-02` wants for pruning the 29 chrome-devtools tools, `evaluate_script`
included, now written and reviewable in one small function.

**The decision behind it was the user's**, asked explicitly and answered twice:
the assistant does not get to reach for a camera on its own. Revisiting it is
`EC-56`.

---

## EC-56 · The assistant still cannot look at the app on its own — `idea`, medium

Deliberate (see `EC-53`), and worth re-measuring rather than re-deciding. A
model-callable `owa_screenshot` is the strongest "it is situational" behaviour
available — rung 5's own description — and costs ~250 tokens of schema on every
round of every question, plus a large image in the conversation for the rest of
the loop whenever it fires. The pieces are all in place: removing one line from
`modelTools.mjs` is the whole change (`CLIENT_ONLY_TOOL_MAP` until 2026-09-02).

Worth doing only with a measurement attached: how many of the standing corpus
questions would actually be answered BETTER if the model could look, against the
per-question cost of offering it to all of them.

---

## EC-57 · Prompt caching would pay for the pictures, and for everything else — `open`, high

Found while costing `EC-51`'s images, and worth more than they cost. This loop's
prefix is already cache-shaped: the system prompt is built once (not per round),
the tool list is built once, and `messages` is only ever appended to. One
`cache_control: {type: 'ephemeral'}` breakpoint on the last block of the first
user message would make rounds 2..N read at ~0.1× — for **every** question, image
or not, on a bot whose whole design is up to ten rounds over the same growing
prefix.

Anthropic-only, its own change, and the strongest cost lever this loop has. It is
also what would make an attached screenshot cheap rather than merely affordable.

---

## EC-58 · The MCP cannot drive the Presenting Control's drawing — `idea`, low

"Update the MCP server to closely use it" could have gone further than a shared
capture path: arm the brush, draw an arrow round the control being described,
clear it again. It was deliberately not done, and the reason is the rule rather
than the effort — that is the assistant marking up the operator's live window,
which is the "offered, never done" line. If it is ever wanted, it belongs behind
the same confirmation `owa_hide_screens` gets, not behind a tool description.

---

## EC-60 · A backtick in a comment took the whole MCP host down — `done` 2026-09-02

Written down because the SYMPTOM is a long way from the cause, and it will
happen again. `picker.mjs`'s runtime is a template literal, and a comment added
inside it read ``describe`'s `label` joins them`` -- three backticks, the first
of which ended the literal. The module then failed to parse, `owaTools.mjs`
failed to import, and the only thing anyone saw was **every MCP request
answering 500**, including ones that had nothing to do with the picker.

`domMatch.mjs` and `guide.mjs` carry the same hazard and say so in their
headers; the comment that broke it was written in a file whose own header says
"keep them free of backticks".

**The guard shipped with the fix**: `picker.test.mjs`. Its first job is simply
IMPORTING the module -- a syntax error there is a red test rather than a live
app answering 500 to everything. It also pins the safety property that matters
(the choosing click is swallowed: `appHits` 0) and that `read`/`stop` answer
before anything was ever started, since the tool polls and a reload wipes the
runtime under it.

---

## EC-59 · This run's window work is verified by tests, not by the window — `open`, high

The honest note on `EC-51`/`EC-52`. Everything measurable without the app was
measured — 30 new tests, a full typecheck, and `selectorOf` and the picker driven
against the LIVE app (181 of 181 visible controls got a unique selector, 0
unresolvable; the picker returned **Bible Lookup** with `probeHits: 0` and no
popup opened, so the swallowed click is proven). What was NOT driven live is the
window itself: the chips, the **Add** button, the blind-model notice, the
Presenting Control's camera and its three destinations.

**Closed after the gate.** The app was rebuilt and restarted and all of it was
then driven live: `owa_screenshot` came back as a real picture of the presenter;
`owa_pick_element` returned the right control with `probeHits: 0` and no popup;
the chip read **Setting** (not "Setting Setting") and pressing it put one ring at
1169.33px on a control at 1169px; pressing a picture chip opened the preview with
the image loaded; and the audit showed 47 tools at the host against an unchanged
~9 492 tokens/round for the model. What is still NOT driven live is the
Presenting Control's camera and its three destinations, and the mid-flight
**Add** path -- both are covered by tests and by CB rows, neither has been
watched working.

The reason it was ever in doubt is worth recording rather than hiding: partway
through, the running dev app's presenter renderer stopped answering CDP entirely — `Runtime.evaluate`,
`Debugger.enable` and `owa_app_state` through the app's own MCP host all timed
out, so the main thread was blocked rather than merely paused. The app had to be
rebuilt and restarted before the window half could be seen, and this file is
where that is written down instead of being rounded up to "verified".

**Next run starts here**: CB-26..CB-30 are written to be walked in order, and
`extra-work/verify-chatbot-e2e.mjs` is the harness for the ask-box half.

---

## EC-50 · Lexical retrieval tops out near 60%, and that caps rung 2 — `open`, high

The measurement EC-47 was found inside is the more important result, and it is
not fixed. With both fixes in, **41% of the app's own supported questions still
do not retrieve their own recipe as the top hit**, and 16% do not retrieve it in
the top five at all. On held-out volunteer phrasing it is 49% and 24%.

These are not exotic questions — they are the 236 the corpus was built to
support, each written from a live-verified recipe. The failures are vocabulary,
not ranking: the user says "next slide", the manual says "step through slides";
"turn it off" vs "clear"; "put a picture on a slide" vs "drag from the Background
panel". Three things were tried and measured this run, and none of them closes it:

| Change | top-1 on the 45 held-out paraphrases |
| --- | --- |
| baseline | 47% |
| IDF-weighted coverage + the prefix cap (shipped) | 51% |
| routing through the 236-question corpus with `matchQuestions` instead | 51% |
| reciprocal-rank fusion of both | 56%, and top-3 *worse* |

Fusion is the only one that moved it much, and it costs a second ranking pass on
every search to buy 5 points while making top-3 worse — not worth shipping on
this evidence.

**What this means.** The model is handed the right page a little over half the
time and writes a confident answer from whatever it gets; the ladder says to
judge by the worst answer a volunteer can get. Two structural options, both
bigger than a ranking tweak:

1. **Index the questions, not just the pages.** The corpus already pins 236 real
   questions to their recipe, controls, menu path and keystrokes. Fold those
   questions INTO the searchable text of the recipe they answer, so the manual is
   searchable in the volunteer's words as well as its own. Cheap, no new tool, no
   new round — and it makes the curated keywords earn their keep on the model's
   path, where today only the ask box's type-ahead uses them.
2. **Embeddings.** Correct, and the wrong shape for this app: it needs a model
   call per query or a vector index shipped in the installer, against a
   performance rule that forbids long-lived caches and eager loading.

(1) is the recommendation, and it needs a held-out set to be graded honestly —
the corpus questions cannot grade a change that indexes the corpus questions.
The 45 paraphrases written this run are a start and are too few; the real
evaluation set is a log of what volunteers actually type.

**Not filed as a defect against any one page.** It is the shape of the retrieval,
and it is what stops rung 2 being marked reached.

---

## EC-43 · Every answer dead-ended in a blank box — `done` 2026-09-01

**Reported from the app with a screenshot**, the offer circled by hand:

> **assistant** No — no screen is showing right now.
> Would you like help turning one on for the congregation? I can walk you through it.
> **you** yes

The assistant asked a question and the only way to answer it was to type one. For
the person this window is written for — a volunteer minutes before a service,
often not a native English speaker, on a machine they do not own — that is where
the conversation stops. And it was not only confirming questions: an answer
carried buttons ONLY when the model happened to read a manual page
(`genGuideActions` fires off `watch.manualId`), so everything answered from live
app state, from the corpus or as a follow-up carried nothing but **Copy**. The
user widened the ask to the general rule: **every answer offers something to
press.**

**Shipped 2026-09-01.** Three layers, first one that yields anything wins
(`src/chatbot/quickReplyHelpers.ts`, `genMessageReplies`):

1. **The model writes them.** `genSystemPrompt` asks for a final
   `OPTIONS: a | b | c` line and `parseAnswerOptions` takes it off again. A
   FRAME the code holds it to, not a request — `EC-21` and `EC-38` each paid for
   that lesson once.
2. **Read the answer** (`genQuickReplies`) — the trailing question's own yes/no
   (`Yes` / `No thanks`, the exact two the offline bot's `FOLLOW_UP_*` patterns
   understand) or an either-or, named. No model, no key, no network.
3. **Ask the corpus** (`genFollowUpQuestions`) — the two nearest questions the
   assistant is PREPARED to be asked, spread across sections AND recipes.

Worked once when the answer lands and stored on the message
(`ChatMessageType.replies`, re-capped on read); only the LAST message shows them,
because a one-press **Yes** under an offer three turns back would be answering
the wrong question. They never duplicate an action label, and both rows together
are capped at 5.

**Cost: 0 new tools, 0 tool-schema tokens** (44 / ~9 481 before and after). The
system prompt grew 9 317 → 9 580 chars, **+66 tokens/round (+0.7%)**, paid for by
compressing four clauses that were justification or already said elsewhere.

Three things live verification forced, none of which unit tests could have found:

- **The marker does not arrive on its own line.** First live run, GPT-5 ended an
  answer *"Want me to keep stepping you through on screen? OPTIONS: Yes, walk me
  through it | …"* — one sentence, marker and all — and a line-anchored parser
  printed the whole frame at the user. The line is CUT at the marker now, and the
  prompt says "on a line of its OWN". The strip is unconditional: a malformed
  frame still disappears.
- **Two follow-ups from one topic are one option.** The corpus offered *"How do
  I add a web page to the Background panel?"* and *"How do I show a web page as
  the background?"* side by side. Spread on `resources.recipe` as well as
  `section`.
- **The two rows add up.** An offline manual answer carries four buttons of its
  own; two more under them made six under one paragraph. `MAX_BUTTON_COUNT` 5 is
  the ceiling on both rows together, so a four-button answer gets one option and
  a bare answer gets three. `answerFromManual`'s sibling hits went 3 → 1 for the
  same reason.

Verified live 2026-09-01 on the presenter with GPT-5 (the reported question, a
follow-up press, a manual answer with walkthrough buttons), on the offline bot
(Anthropic key out of credit → fallback answer + corpus option), and on the guide
rescue (no `OPTIONS:` on the card, and no options row on the auto-asked turn).
CB-21 added, W-42 step 6 extended, `questions/common.json` gained
`quick-answers`. 30 new tests.

**Left open:** `EC-44`, and `EC-37` is now one press cheaper to trip.

---

## EC-44 · Only one provider's compliance with the OPTIONS frame is measured — `open`, medium

`EC-43`'s first layer depends on the model ending its answer with the frame, and
it was verified on **GPT-5 only** — the Anthropic key on this machine is out of
credit, so Claude could not be asked once. The two providers read instructions
differently, and that is exactly why the switch exists.

It is not a defect today: layers 2 and 3 catch a model that writes no frame, and
the strip is unconditional so a half-written one cannot leak. But "the model
writes the best options" is an unmeasured claim on half the window's users.

**Fix shape.** With a working Anthropic key, ask the standing corpus on Claude
and count: frames written / frames usable / raw `OPTIONS:` visible (must be 0).
If compliance is materially worse, the answer is a shorter frame, not a longer
paragraph asking for it.

---

## EC-35 · `toEnglishOnly` still eats Khmer that is CONTENT — `open`, low

With the twins gone, the only Khmer left in the corpus is data a user is meant
to see: `_ម៉ូសេ (Moses)_`, `លោកុប្បត្តិ ២៤:២៩-៣០`, a translation key like `ពគប`.
`toEnglishOnly` still runs over search excerpts and strips all of it, so W-29's
excerpt — a page whose whole subject is that a Khmer record reads
`ម៉ូសេ (Moses)` — comes back as ` (Moses)`. Harmless today (the page body, which
is what the answer is written from, is untouched), and wrong in principle: the
regex bank exists for a problem that no longer exists. It should either go, or
narrow to "a bracket whose Khmer is a dictionary VALUE", which is exactly the
test `tran.test.mjs` already implements.

---

## EC-33 · The corpus has no owner in the release process — `open`, medium

`questions/*.json` is a promise about what the app can do, and nothing enforces
that it still matches the app. A renamed control, a reworded `W-xx`, a removed
feature — each silently leaves a suggestion the assistant will offer and then
fail to answer.

Written down in `.claude/CLAUDE.md` §*Agent access*, in the memory
`question-corpus-maintenance`, and in the package README; `questions.test.mjs`
catches the structural half (no recipe and no tool, duplicate id, malformed
recipe id, a demoted starter). What it cannot catch is a `find`/`menu`/`shortcut`
that no longer names anything real.

**Fix shape.** A check that resolves every `resources.recipe` against the built
knowledge index, and every `resources.find` against `owa_find_ui` on a running
app — the second one belongs in a robot-test row, not in `npm test`, since it
needs the app up. Until then this is documentation and a habit.

---

## EC-31 · Controls the app paints only under the mouse were rung, listed and pressed as if visible — `done` 2026-08-31

**Reported from the app with a screenshot** circling the row of icons above
a bible view (Copy, Split horizontal, Split vertical, Save bible item, Save
and show, Export to MS Word). The app paints them only while the mouse is
over the bible view.

The matcher asked one question about being on screen — *does it have a box?*
— and these have one the whole time: they are hidden with `visibility` (plus
an `opacity` fade) on an ancestor, never with `display`. So:

- `owa_find_ui "Copy"` rang **blank space** and reported `isVisible: true`
  about a button nobody could see;
- a guide step pointing at one drew a red ring around nothing;
- `owa_click` pressed it invisibly — it worked, and looked like nothing had
  happened;
- `owa_list_ui` offered it as an ordinary visible control, so an answer could
  send a volunteer looking for a button that was not on their screen.

Measured live before building, on the presenter: **24 controls laid out but
painted away**, and 13 more with no box at all. 162 of the page's 5639 CSS
rules carry `:hover`, and finding them costs ~7ms.

**Shipped.** Three parts, all in `domMatch.mjs`:

1. **Three states, not two.** `visibilityOf` → `shown` / `hidden` (laid out,
   painted away, revealable) / `gone` (no box at all: `display:none`, a
   closed panel). It asks `Element.checkVisibility`, which answers for all
   659 controls on the presenter in **0.4ms against 11ms** for the ancestor
   walk it replaces — and, asked with no options, tells `gone` from `hidden`
   without forcing the layout that reading a rect would.
2. **Ranked, not dropped.** A `hidden` control stays a full candidate
   carrying `isShown: false`, and a visible twin outranks it — ranked BELOW
   `isControl`, so a hidden BUTTON still beats a visible container (`EC-18`'s
   rule, which is older and bigger). `describe` reports the truth:
   `isVisible: false` plus `showsOnHover: true`, said only when true so an
   ordinary control costs the reader nothing.
3. **Forced, not moused.** `revealHidden` stamps `data-owa-hover` on the
   control and every ancestor, then injects the page's OWN `:hover` rules
   with `:hover` rewritten to `[data-owa-hover]`. `:hover` and `[attr]` weigh
   the same in the cascade, so a rewritten rule wins on document order alone
   and needs no `!important` that would have to be undone. Only rules
   matching that chain are injected (five, not 162), ONE reveal is held at a
   time, and the hold always lapses on a timer, so a click that navigates
   away cannot leak one. `owa_find_ui --highlight` holds it for the life of
   the ring, `owa_click` 1.5s past the press so the user sees what was
   pressed, the guide card for as long as its step is up (re-armed by the
   700ms reposition, released outright by **✕**).

The mouse is never moved. It belongs to the user: a synthetic move fights
them for it, lands wherever the window has scrolled to since, and a real
hover would end the moment they reached for the button anyway.

**Verified live** through the app's own MCP host — the chatbot's door, and
the only one serving fresh tool code (`mcp-tool-edit-two-processes`).
`owa_find_ui "Copy"` answers one match with `showsOnHover: true` and
`revealedForHover: true`, and the screenshot shows the whole icon row painted
with the ring on Copy; six seconds later `visibilityOf` is `hidden` again
with zero stamps, zero injected styles and zero ring markers left behind. A
one-step guide for "Save bible item" rings a painted icon under the hint
*"This one only shows while the mouse is over it, so I am holding it up for
you."* `owa_click {find: "Copy"}` presses it with it on screen.

Cost: **+74 tokens/round** (~8783 → ~8857) for the two sentences telling the
model what `showsOnHover` means. Tool count unchanged at 42. 10 tests added.

**Found while verifying, and worth keeping:** a caller must not test "is it
hidden?" before asking for a reveal. The guide card redraws its step, and on
the second draw the control was visible *because the card was holding it* —
so the card dropped the one sentence explaining why. `revealHidden` now
answers "is this being held", true for a hold it just made and true for one
already up. Pinned by a test.

---

## EC-36 · The assistant had no memory of its own last answer — `done` 2026-09-01

**Reported from the app with a screenshot**, and the plainest failure in the
file:

> **you** Is any screen showing right now?
> **assistant** No screen is currently showing. Would you like help to show a screen?
> **you** yes
> **assistant** It sounds like you might need help or have a question. What can I assist you with?

`askLlmBot(question, focus, provider, model)` took ONE question and built a
fresh `messages` array from it. Every question in a tab was a separate
conversation with a model that had never seen the tab. So the assistant could
ask a question and not understand the answer, and a volunteer who replies the
way people reply — "yes", "the second one", "how do I turn it off" — got a
shrug. The tabs, the 60-message cap, the whole session store existed for the
USER to scroll; none of it ever reached the model.

**Shipped.** The tab's recent turns now go with the question, on both providers
and in the offline bot.

- `toHistoryTurns` in `llmBotHelpers.ts` — 6 turns, 800 characters each, 2400
  total, oldest dropped in PAIRS. Bounded hard because the history is re-sent
  on every round of the tool loop, not once per question: the worst case is
  ~600 tokens a round against the ~9 500 the tool schemas already cost.
- **A long turn keeps its END as well as its opening.** The end of an answer is
  where the offer lives, and the offer is what a "yes" is answering — a
  head-only clip throws away the one part needed.
- **The oldest turn sent is always the user's**, and two same-author messages in
  a row are joined. Anthropic refuses an assistant-first conversation outright,
  and a tab reloaded after the window was closed mid-answer really can hold two
  of a kind.
- The window reads the prior turns through `sessionStateRef`, BEFORE the new
  question is appended: `handleAsking` is not rebuilt when a message lands, so
  the session it closed over is whatever the tab held when it was made.
- **The offline bot cannot remember an offer**, so it no longer pretends to. A
  bare "yes" is answered against the last thing the user NAMED themselves, and
  the answer says which question it took them to mean. Measured before writing
  it: searching the manual for the word "yes" returns the page on resetting the
  app's panels, and searching the assistant's own offer ("help to show a
  screen") returns the page on showing which KEYS you press — while the user's
  own question finds the page on controlling what the audience sees. A bare
  "no" is taken as a no.

Verified live on the reported conversation, both providers: gpt-4o answered the
standing offer instead of shrugging, and Haiku 4.5 resolved "how do I turn
**it** off?" to the screen that was showing. 12 tests, including the offline
bot's first ever.

**Left open:** `EC-37`, and the offline bot still cannot follow up on an offer
the MODEL made rather than one the user asked for.

## EC-37 · A "yes" can be acted on without a second thought — `open`, medium

**Found while verifying `EC-36`.** With the conversation carried, "Would you
like help to show a screen?" → "yes" made the model SHOW the screen — verified
live, `showingScreenIds` went `[]` → `[0]`. The prompt's rule is that anything
changing what the audience sees is "offered, never done unasked", and this was
offered and accepted, so it is inside the letter of the rule. It is not clearly
inside its intent: the user agreed to **help to show**, not to *show it now*,
and on a Sunday morning the difference is a congregation seeing something
before the service starts.

Two halves worth separating. The model should not write an offer whose
acceptance is ambiguous ("would you like help to..." when it means "shall I do
it?"), and an acting tool that changes the output should confirm the ACTION,
not inherit consent from an offer of help. Carrying the conversation makes this
reachable for the first time, which is why it is filed now and was not before.

**Made cheaper to trip by `EC-43`.** A "yes" is now one press rather than one
typed word. The options frame forbids offering one that changes what the
congregation sees, which is a mitigation and not the fix — the fix is still on
the model's side: confirm the ACTION, not the offer of help.

## EC-16 · 69 manual steps still cannot be demoed, and 34 are one rule — `open`, medium (narrowed 2026-09-08)

Measured this run over all 39 manual recipes with steps (251 numbered steps).
After EC-15 pressed the keystroke steps, what is left breaks down as:

| Why the step can't be acted on | Steps |
| --- | --- |
| Bold phrase has no capital (`**step-by-step picker**`, `**version**`) | 34 |
| Step bolds nothing at all | 24 |
| Bold phrase is an action verb (`**Double-click**`) | 8 |
| Bold phrase is one character (`**✕**`) | 2 |

The 34 is a single rule: `checkIsControlLabel` requires a capital, because bold
prose ("**not**", "**version**") would otherwise match real controls and ring
the wrong thing — "not" once found the Notes button. That guard is load-bearing
and must NOT simply be dropped. The cheap, safe replacement is to stop guessing
from typography and ask the window: run the bold phrase past `domMatch` and keep
it only if a control with that label is actually on screen. That is a real DOM
query per candidate at start time, so measure it before shipping it.

The 8 action verbs are a different shape — `**Double-click**` says what to DO,
not what to do it to, and the guide has no way to express a double-click at all.
Worth a `action: "doubleClick"` only if a recipe actually needs it.


**Narrowed 2026-09-08**: the four bullet-written recipes now start (`EC-106`), a bold up to 120 characters is read (`EC-107`), and a step that only describes what to notice is a look-step with a Next button rather than a failed press (`EC-105`). What is left is `EC-109`.

## EC-17 · A guide step can press a key that clears a live screen — `open`, medium

`F7`/`F8`/`F9` (Clear Slide / Clear Bible / clear) are now pressable by the card,
and W-06 step 5 is exactly that. Today the protection is that demo mode is one
press per step and the user reads the step before pressing **Do it** — the same
protection a step that clicks a Clear button has always had, so this is not a
regression. But the tool description tells the model "never demo a step that
changes what the congregation sees without asking first", and nothing enforces
it. A cheap enforcement: have the card itself refuse a known screen-clearing
keystroke while a screen is actually showing (`owa_list_screens` already knows),
and say why. Do not add a blanket confirm — it would land on every step.


## EC-38 · A stuck walkthrough step could only apologise — `done` 2026-09-01

**Reported from the app with a screenshot.** W-06 step 3 — *"The verse renders
in the preview panel. **Double-click** it to present."* — answered:

> I could not do that one for you (nothing on screen to act on) - do it
> yourself, then press Skip.

Honest, and the end of the road for someone who pressed **Do it** precisely
because they did not know what to do. Measured over the whole corpus with the
real `toGuideSteps`: **68 of the manual's 251 steps (27.1%)** name no control,
no keystroke and no right-click, so every press of **Do it** on them lands
there. They are not all one thing — a double-click, a drag, something only to be
watched, a control not on screen yet — which is exactly why no single matcher
change fixes them, and why the right answer is to ask something that can look.

**Shipped.** The card asks the assistant that wrote the walkthrough, and the
answer is drawn on the card:

- `guide.mjs` — `askForHelp(result)` fires an `owa-guide-help` DOM event with
  the step, the failure, the labels it aimed at and the near misses it found
  instead; `state.help` carries `asking` / `answered` / `unavailable` and
  `owa_guide_status` reports it. A `owa-guide-help-answer` listener draws the
  reply, through the SAME `stripInternalIds` patterns a step goes through —
  they are interpolated into the runtime rather than copied, which is why they
  moved above `GUIDE_RUNTIME`.
- `domHelpers.ts` / `electronHelpers.ts` (`askGuideHelp`, `answerGuideHelp`) /
  `electronEventListener.ts` — the relay, both ways. The guided window is
  REMEMBERED rather than looked up: several model rounds pass before the answer
  comes back, and by then the focused window may be another one.
- `ChatbotAppComp.tsx` — `main:app:guide-help` asks on the user's behalf,
  forced past `isBusy`.
- `llmBotHelpers.ts` — `genGuideRescueQuestion` (a USER turn, so it costs
  nothing on any other question), `genGuideRescueSummary`, `toGuideRescueAnswer`.

Four things verification itself forced, all shipped with it:

- **The chat window is NOT restored to deliver the answer.** It is minimised
  for the length of a walkthrough (`EC-29`) and the user is looking at the app;
  pulling it back over the control the answer points at would undo the fix while
  delivering it. Hence the answer landing on the card.
- **A prohibition the model can ignore is not a rule** (`EC-21`, one layer up).
  Told plainly not to report its own looking, Haiku 4.5 opened **3 answers in 4**
  with "I can see the verse …", and one spent its entire answer on it. Given a
  `DO: <instruction>` frame with the code parsing the marker out — and keeping
  the whole text when it is missing, because half an answer is worse — the same
  model produced **5 clean imperatives in 5**, median 3s.
- **What the model is TOLD is not what the user is SHOWN.** The first live run
  printed the whole machine prompt in the transcript as the user's own question;
  the second leaked the raw `DO:` frame into the chat bubble. `shownText` and
  `formatAnswer` on `handleAsking` are the two seams, and any future auto-asked
  turn needs both.
- **A hint that grows pushes the card off the bottom of the window.** Once
  `avoidRing` has pinned a top, the card no longer hangs off the bottom edge by
  itself, and the first screenshot of the fix had the Back/Skip/Do it row below
  the fold. `render` now clamps after every draw.

Verified live end to end on the reported step: 6 runs of 6 usable, zero leaks, median 13s — reached in four measured corrections, not one (see the run detail json). One of them
noticed the Bible Lookup popup had been closed since the guide started and
answered *"Click Bible Lookup at the top to open it again, then find your
verse."* — it read the window, not the recipe. With the chat window closed it
answers `unavailable` at once and the plain instruction comes back; a 30s
ceiling covers an outside agent with nothing listening. Once per step per run.
Cost: **no new tool, 0 extra tokens/round** — the card talks over the app's own
relay, not over the model's tool surface. 14 tests added across
`guide.test.mjs`, `llmBotHelpers.test.ts` and `electronHelpers.test.ts`.
CB-20 added, CB-11 corrected, W-42 step 14 added.

Two more, found only by measuring and shipped with it:

- **A rescue asks with NOTHING behind it** (`withoutHistory`). The tab it lands
  in fills up with earlier rescues, so the model is handed its own previous
  answer to a nearly identical question. A rescue is a fresh diagnosis of the
  window as it is right now; one bad answer would otherwise prime every later
  rescue in that tab.
- **A rescue never falls back to the offline manual bot**
  (`withoutOfflineFallback`). With the account's Anthropic key out of credit,
  every rescue threw and `handleAsking` did what it does for a human question —
  asked the offline bot. That bot searches the manual, so handed a
  machine-written rescue prompt it matched the words "nothing on screen" and
  answered *"No presentation screen is showing right now. This machine has 1
  display(s) available to present on."* — identically, 10 times out of 10, in
  2 seconds, drawn on the card as the answer. It now reports `unavailable`
  instead, and the card's own plain instruction stands. An assistant that
  degrades must degrade toward silence, not toward confidence.

**Failure rate is now tracked, not eyeballed**, at the user's request:
[`scripts/rescue-failure-rate.mjs`](../scripts/rescue-failure-rate.mjs) drives
the same step N times and grades each answer with a deterministic grader whose
every rule is a failure that was actually observed — no answer, narration, wrong
subject, a tool label pasted whole, internals, no instruction, too long for the
card, mangled text. **1 failure in 12 on GPT-5, median 12s.** The Anthropic side
could not be scored: the key is out of credit.

---

## EC-41 · "press" arrived as "pre  " twice, and nothing explains it — `idea`, low

Two answers in one 12-run batch came back with the word *press* broken —
"pre  Enter", "Nothing to pre  on this step" — and it did not recur in the 18
runs after. It is provably not any transform in the pipeline:
`toGuideRescueAnswer` leaves "press" alone (tested), and the card collapses runs
of whitespace, so a double space reaching the card at all is anomalous by
construction. Most likely the model emitted it. Not chased further — it costs
API credit to reproduce and nothing depends on it — but
`rescue-failure-rate.mjs` now has a `mangled-text` rule that will say so if it
comes back, which is worth more than an explanation.

---

## EC-42 · The failure-rate harness only covers the rescue — `done` 2026-09-08

`rescue-failure-rate.mjs` grades one thing: the answer a stuck walkthrough step
gets. The ordinary ask box — where almost every question is actually asked — is
still graded by a person reading `references/research.md`'s corpus once per run,
which is exactly the eyeballing this harness exists to replace, and it is where
the user's own question ("might it be a knowledge problem?") would be answered.
The graders here are reusable as they are; what is missing is the corpus runner
and a per-question expected-source check (did the answer come from the manual
page that should have answered it?). That last part is what would actually
measure whether the knowledge corpus is causing failures, rather than assuming
either way.


**Done 2026-09-08**: `scripts/demo-failure-rate.mjs` presses Do it through every step of every recipe in the window it is filed under, paced under the firewall's 25-a-minute budget, closes the popup, menu or panel one recipe leaves in front of the next, skips a destructive label, and grades each press by what the card reported (done / done-more / closed / could-not with the reason and near misses / skipped). First measurement, card only: 224 presses, 92 done, 124 refused (55%) — and a spot check of the 92 found the wrong control pressed in at least ten of them (`EC-104`).
---

## EC-39 · The chat window italicises `snake_case` — `done` 2026-09-08

Found while reading the first live transcript: `owa_find_ui` rendered as
*owa_find_ui* with the underscores eaten, because `renderRichText` treats `_`
as emphasis the way markdown does. It only showed because the run was printing
a prompt it should not have been (fixed in `EC-38`), so nothing user-facing
depends on it today — but a setting name, a file name or a tool name in an
answer would be mangled the same way, silently. Underscore emphasis is not
worth having in a window whose subject matter is full of identifiers; asterisks
alone would do. **Done 2026-09-08**: it reached the user after all — the starter chip’s own address, `amazing_grace_how_sweet_the_sound`, was drawn as *amazing* grace *how* sweet *the* sound in the YOU message. Underscore emphasis now needs a word edge on both sides (`renderRichText`), so a name with underscores inside it is left alone and `_this_` still slants.

---

## EC-40 · The rescue only covers the DEMO half of a walkthrough — `open`, medium

`EC-38` fires from `act()`, which is the **Do it** press. A user in the ordinary
**Show me step by step** mode gets no press at all: when the step's control is
not on screen the card says *"Do this step in the window behind me"* and simply
waits, with nobody asked and nothing to wait for. That is the same dead end
without the button, and it is the mode a volunteer who declined the demo is in.

The fire point is the hard part, not the machinery — there is no user action to
hang it on. The honest candidates are the moment a step is DRAWN with no target
found (cheap to detect in `renderStep`, but it would fire on every step of a
guide that legitimately points at nothing), or a **Next** press on a step whose
control was never found. Worth measuring first: how often does a `show`-mode
step actually fail to ring anything?

---

## EC-46 · `genSessionId` collides, and the suite is flaky because of it — `open`, medium

`src/chatbot/chatSessionHelpers.test.ts > genSessionId > does not collide
inside one burst` draws 500 ids and expects 500 distinct. Measured 2026-09-01
while verifying an unrelated change: **it fails roughly one run in three**
(three consecutive runs gave pass, fail, pass; the failing one produced 499).

```ts
const stamp = Date.now().toString(36);
const salt = Math.random().toString(36).slice(2, 6);
return `s${stamp}${salt}`;
```

Inside one millisecond the stamp is constant, so the whole id is four base-36
characters of `Math.random()`. That is ~1.68M values, which the birthday bound
already puts near 7% over 500 draws — and worse than that in practice, because
`Math.random().toString(36)` does not always yield enough digits to slice four
from, so some ids carry a SHORTER salt than intended.

Two separate costs. The suite is the loud one: `npm run lint` is `&&`-chained
and `test:all` is its first stage, so a one-in-three flake here blocks the whole
gate on something no change caused. The quiet one is that two chat tabs really
can share an id — `updateSession` addresses tabs by id, so a collision edits the
wrong conversation. Nobody opens 500 tabs in a millisecond, but the guard is
thinner than it reads.

`crypto.randomUUID()` is available in this renderer and ends it; a longer,
zero-padded salt would too. Worth checking whether any stored session id is
parsed for its timestamp before changing the shape.

---

## EC-45 · The Share window can hold no questions at all — `open`, medium

Found while splitting the corpus into page files. `html/lwShare.html` — the
**Share (📤)** window, `src/lwShare/` — is a real window a volunteer can be
looking at, and there is no `W-xx` recipe for it anywhere in
`user-workflows.md`. `questions.test.mjs` requires every question to carry a
recipe or a live tool, so the corpus structurally cannot describe it: a
`lw-share.json` would fail the suite on its first row.

The fix is a manual recipe first, questions second — not a question with an
invented recipe id (the format check would pass and `owa_help_page` would then
answer nothing). Worth checking at the same time whether the window is reachable
in a packaged build or is effectively dev-only, because that decides whether it
is a documentation gap or a dead entry point.

**Raised from low to medium on 2026-09-01**: the window now carries the
assistant (`Tools → App Assistant` / `Ctrl+Shift+A`, from `AppWindowToolsComp`)
and has a `lwShare` focus of its own in `botFocus.mjs`. A user in front of it can
now ask — and every answer they get is drawn from `common` and `troubleshooting`,
because those are the only files a focus with no page of its own can see. It is
no longer a window the assistant merely fails to describe; it is a window the
assistant is offered from and cannot describe.

---

## Done

- **2026-09-01 — the head row is three drop-downs, and the corpus is eight
  files.** Two changes in one pass, both structural rather than promptcraft.
  - The Presenter/Reader and Claude/ChatGPT switches were segmented button
    pairs beside a model picker that was already a `<select>`. Six uppercase
    words spent most of a 460px window on two either/or choices and pushed the
    model name into an ellipsis — and the tree already had a THIRD provider
    (`kimi`) half-added, which the segmented row had no room for. All three are
    `<select>`s now on one `.chat-pick` skin; `.seg` / `.seg-item` are gone.
    Notes for the next change here:
    - A provider with no key stays in the list, disabled, reading
      `<name> — needs an API key` **in the option text**. The old `title` said
      it on hover; Windows draws no tooltip over an OS-drawn list row, so a
      `title` on an `<option>` would have silently lost that sentence.
    - The provider and model pickers shared the `aria-label`
      `Which model answers`, which only worked while one of them was a `<div>`.
      The provider's is now `Which assistant answers`.
      `extra-work/verify-chatbot-e2e.mjs` addresses all three by label, and
      chooses an option through the native value setter + a bubbling `change`
      rather than clicking.
    - The glassy-window rule travels with the skin: a select in this window
      paints from `--chat-solid-soft` / `--chat-solid`, never the translucent
      pair, or the OS draws the list grey-on-white.
  - `questions/` went from 5 page files to 8. `presenting-flow` and `screen`
    were sections of `presenter.json` that had outgrown it (W-22 alone is 495
    manual lines), and `troubleshooting` gathers the symptom-shaped rows that
    were scattered across all five — `kind: "fix"` went 11 → 20. 209 → 236
    questions, nothing lost or duplicated.
    - Adding a page file used to mean four coordinated edits (the JSON, the
      renderer's hardcoded imports, the tool's `page` enum, and the test's
      hardcoded page list), which is why the folder had stood at five. Now the
      file NAME is the page id and everything reads the directory:
      `import.meta.glob` in `questionHelpers.ts`, `listQuestionPageIds()`
      (names only, no parse) for the enum, and the test holds the invariant in
      both directions instead of restating the list.
    - `starterRank` turned out to be global within a focus, not per file — the
      empty window sorts every starter a focus can see. Two of the presenter's
      four starters were in the section that moved, so the ranks moved with
      them; the ratchet in `questions.test.mjs` is what proved it. Written down
      in `schema.json` and the README, because the old wording said the
      opposite.

- **2026-08-31 — EC-15 · "Do it" presses keyboard shortcuts.** Reported from
  the app with a screenshot: W-06 step 4, "Close the dialog with the red ✕
  button or **Ctrl+Q**", answered *"I could not do that one for you (nothing on
  screen to act on) - do it yourself, then press Skip."* Measured before
  building: **82 of the manual's 251 steps (33%)** could never be demoed, and
  the largest rescuable slice of those named a keystroke. Now 69 (27%);
  W-06 itself goes from 2 of 6 steps actionable to 5 of 6. Notes for the next
  change here:
  - The app hears keys through ONE `document.onkeydown`
    (`src/event/KeyboardEventListener.ts`) that feeds every registered
    shortcut, so a synthetic keydown at the document drives the real thing.
    Proved before writing any code, both directions: Ctrl+B opened the Bible
    Lookup popup, Ctrl+Q closed it. Both are renderer bindings
    (`commonButtons.tsx`, `ModalComp.tsx`) — an Electron MENU accelerator would
    NOT have been reachable this way, so check which kind a shortcut is before
    assuming a step can be pressed.
  - The event carries `code` as well as `key`: the app forces every key back
    through an en-US layout via the code (`toEnUsKey`), so a `key` alone
    matches nothing on a German or Khmer keyboard.
  - `toKeystroke` deliberately refuses a bare modifier ("hold **Ctrl** while
    clicking" names no key) and a bold single letter (emphasis far more often
    than a key; pressing a stray letter into whatever has focus is worse than
    declining). A single character counts only WITH a modifier.
  - What is written is what is sent, on every platform. The app registers some
    shortcuts Ctrl-everywhere (`allControlKey`) and others Ctrl-on-Windows /
    Cmd-on-Mac, so no rule rewrites "Ctrl" for a Mac correctly for both — and
    the card is showing the user those same words to read.
  - The guide's own press must not also count as the user doing the step. An
    explicit `isSelfPressing` flag does that, NOT `event.isTrusted`, which
    would also ignore a press driven through the MCP tools, where advancing is
    right. (`isTrusted` is also un-forgeable in jsdom, so that guard could not
    have been tested.)
  - `owa_guide_status` grew `canActOnStep` and `press` because a keystroke step
    reported `isTargetFound: false` with no label — indistinguishable from a
    broken guide, which invites the model to "fix" one that was working.
  Verified live end to end (the real W-06 recipe, demo mode, step 4, dialog
  open → `{done: true, did: "pressed", keys: "Ctrl+Q"}` → dialog closed).
  CB-11 rewritten, README tool table extended, 7 tests added.

- **2026-08-31 — EC-10 · the chat tab menu, the lock, and the two sweeps.**
  Asked for as "an option to clear all chats" and shaped, over the same session,
  into a `⋮` on the left of every tab (right-click does the same) opening
  *Rename this chat* / *Lock this chat* / *Close this chat* / *Close other
  chats…* / *Clear all chats…*. Notes worth keeping for the next change here:
  - The menu CANNOT live inside `.chat-tabs` — that box scrolls, so a menu in it
    is clipped at its edges. It is `position: fixed`, width pinned to a constant
    (there is nothing to measure before the first frame), clamped to the window,
    with a transparent sheet behind it doing the click-outside.
  - The window still loads bootstrap and its own sheet and nothing else, so the
    confirmation is a line under the strip, not `ConfirmPopupComp` — that popup
    would drag `tran()` and a module-scope listener in for one question.
  - Both sweeps `saveChatSessions` synchronously instead of on the 400ms
    debounce: someone who clears the history means it gone from disk now. They
    read `sessionStateRef` rather than using the `setSessionState` updater —
    a side effect in an updater runs twice under strict mode, with two
    different new session ids.
  - `isLocked` is the protection both sweeps step around, and
    `handleClosingSession` refuses it too: the `×` being absent is a UI fact,
    not a guarantee.
  Verified live (menu on a plain and a locked tab, both confirmations, a solo
  and a clear that each left the locked tab standing, `isLocked` read back off
  disk). CB-15 added, W-42 steps 3 and 4 added, `.claude/CLAUDE.md` updated.

- **EC-25 (OPEN, found 2026-09-01, both providers) — "Which API key is used for
  what?" is answered by INVENTION, confidently, on Claude-shaped and
  OpenAI-shaped models alike.** Verbatim, Kimi K3: *"there is one optional API
  key ... **YouTube Data API key** — makes the YouTube panel in the Background
  bar work ... Add it in **Settings → API**."* GPT-5 on the same question
  invents the same YouTube key plus a SongSelect one. **There is no
  Settings → API panel and no YouTube Data API key anywhere in this app.** The
  real answer is now painted on the screen the question is about — the
  `Used by` chips added in the same run — and the model still made one up.
  - Not caused by the Kimi work and not specific to it: it reproduces on
    ChatGPT, so it is a retrieval/grounding failure, not a provider one.
  - The likely mechanic is that the model answered WITHOUT searching: the
    question does not look like a "how do I", and nothing in the system prompt
    forces a lookup before a factual claim about what the app HAS.
    `owa_help_search "which API key is used for what, Kimi"` also ranks W-42
    fourth-best at score 10 behind W-01, so even a search may not have saved it.
  - Worth fixing at the prompt level (never assert a feature exists without a
    manual hit) rather than by adding another page — the page exists, and a
    volunteer being sent to a Settings panel that is not there is exactly the
    "one confident wrong answer" the ladder says to judge by. Ranks above new
    capability on the skill's own ordering.
  - Cheap partial already landed: the `ai-key` corpus question gained
    `kimi` / `moonshot` / `what is the key for` keywords, so the ask box
    suggests a phrasing that DOES retrieve.

- **2026-09-01 — EC-24: Kimi (Moonshot) added as a third provider, and the AI
  settings rows now say what each key is FOR.** Asked for directly. Kimi speaks
  OpenAI's protocol, so the choice was clone `askOpenAI` (~90 lines for a
  different client and two labels) or parameterise it; parameterised, into
  `askOpenAiCompatible` + an `OpenAiCompatProviderType` descriptor carrying the
  client, the label and a `genRequestExtra(model)`. The budget split the skill
  warns not to flatten is preserved ON PURPOSE rather than by accident — both
  rules now sit next to each other and can be read against one another.
  - **Kimi's reasoning rule is NOT OpenAI's.** Every Kimi model offered thinks
    before answering (k3 always, k2.7-code always, k2.6 by default) and the
    thinking comes out of the same budget, so ALL of them take
    `OPENAI_MAX_TOKENS`; at 2000 the answer comes back empty, which on this
    path THROWS and drops the user to the offline manual having paid for the
    whole run. `reasoning_effort: 'low'` goes only to `/^kimi-k3/` — the K2
    family rejects the parameter and takes a `thinking` object instead.
  - **The provider set is declared once now.** `LLM_PROVIDER_MAP` plus
    `Record<LlmProviderType, ...>` lookups for ask and list-models replaced
    three two-way ternaries, each of which sent an unrecognised provider to
    OpenAI in silence. A fourth provider is a compile error in four places.
    `chatSessionHelpers` gets its own `Record<LlmProviderType, true>` so it can
    keep a type-only import and stay out of the SDKs' module graph.
  - **Two real bugs found on the way, both data loss, neither caught by types.**
    `setAISetting` rebuilt the encrypted blob from a hand-listed pair of fields,
    so a third key was dropped by any save — and for a Kimi-only user the
    "nothing to protect" branch fired on the very save that stored it, deleting
    the blob it was about to write. Now built as one object and asked whether it
    holds anything, with two regression tests. `getLlmModel`'s unguarded
    `[0].id` is reached from a `useState` initialiser, so an empty model list
    white-screened the window rather than failing one question; now `?? ''`.
  - **Do NOT reuse `OPENAI_CHAT_MODEL_PATTERN` for Kimi.** It rejects every
    `kimi-*` id, so "More models..." would appear to succeed and show nothing.
    `checkIsChatModel` is optional on the descriptor and unset for Kimi.
  - **The settings rows now name their own consumers** (`Used by` chips):
    OpenAI → Chatbot / Bible Cross Reference / Bible Audio, Anthropic →
    Chatbot / Bible Cross Reference, Kimi → Chatbot. The two hints this
    replaced were both WRONG — they omitted the chatbot, which both keys had
    been driving for a while.
  Verified live on a real key: `kimi-k3` and `kimi-k2.6` each answered in
  numbered steps with no internals leaked, **More models...** pulled
  `kimi-k2.7-code` off the account, a bad model id fell back to the manual
  reading *"Kimi could not answer"*, and Settings rendered in Khmer without
  blanking. CB-06/08/12 rewritten, new CB-22, W-42 steps 10-11, `tran()` keys
  added, question corpus given `kimi`/`moonshot` keywords.
  **Not done:** Kimi is chatbot-only — Bible Cross Ref keeps its two custom
  sources and Bible Audio stays OpenAI-only (the chips say so). The list price
  for `kimi-k2.6` and `kimi-k2.7-code-highspeed` is left BLANK rather than
  guessed: Moonshot publishes one only for K3, and third-party aggregators
  disagree with each other. Fill them in if the console ever states them.

- **2026-08-31 — this skill.** `owa-enhance-chatbot` created: SKILL.md, the
  architecture / MCP-tools / verification references, this backlog, and
  `scripts/audit-mcp-tools.mjs` (live tool-surface audit, discovery-based URL,
  `--json`, `--rounds=N`, `ACTING_TOOLS` warnings). Baseline recorded above.

## EC-62 · A fresh install had no assistant at all — `done` 2026-09-01

Every provider was somebody's paid account, so the answer to "what does a user
with no API key get?" was: the offline manual search. It cannot converse, cannot
look at the app, and cannot walk anyone through anything. That is the state the
app SHIPS in, and the state most churches stay in.

**Shipped.** A fourth provider, `free`, keyless, over the OpenAI protocol the
ChatGPT and Kimi loops already speak — so it cost one descriptor, not a second
loop. Two services behind it (`src/helper/ai/freeHelpers.ts`), because the
useful capability is split across them: **LLM7** (anonymous, fastest, the
default) and **Kilo Code** (bigger models, and the only free ones that can look
at a picture). `keyField` is now optional on `LlmProviderInfoType`, and unset is
what makes a provider always-available and last in the list — so any real key
still outranks it. `IMAGE_CAPABLE_MODEL_MAP.free` names the one free model that
takes an image rather than matching a family.

Of the 17 providers on `awesome-free-llm-apis`, only three answer with no key at
all, and only two of those can call a tool: **OVHcloud is unusable** (2 RPM per
IP, and it returned 429 to an idle request during evaluation).

Graded before it was wired, against the standing corpus through the real 44-tool
loop: **7/8 answered, 0 internals leaked, median 4 rounds**. Not as good as a
paid key, and the window says so rather than pretending.

The warning **names the services and links to them** (`warningLinks`, built off
`FREE_SERVICE_MAP` so the chatbot's disclosure and Settings' cannot drift
apart), asked for by the user: *"add link of those free api website, so user can
aware of providers"*. These are the only providers in the window the user has no
account with and agreed nothing to, which makes them the ones whose terms they
most need to be able to go and read. In Settings the links deliberately do NOT
reuse `RenderOpenPageButtonComp` — it `tran()`s its label and title, and `tran()`
throws on a missing key in dev, so a brand name and a URL passed through it would
blank the Settings page in Khmer.

---

## EC-63 · A gateway leaked its own channel marker into the tool name — `done` 2026-09-01

Open-weight models trained on the "harmony" format emit `<|channel|>commentary`,
and a gateway that does not parse it passes it through INSIDE
`function.name`. Measured live: `owa_list_ui<|channel|>commentary` and
`owa_help_page<|channel|>commentary`, **4 calls across 8 questions**. Every one
is a tool that does not exist, so the round is spent on an error — and the one
question that never answered spent most of its budget doing exactly this.

**Shipped.** `toCleanToolName` cuts at the marker before dispatch. Safe for
every provider: no real tool name contains `<`.

---

## EC-64 · One free question could cost a sixth of the daily allowance — `done` 2026-09-01

`MAX_TOOL_ROUNDS` is 10, and the tool schemas are ~9 800 tokens per round. On a
paid key that is money; on the free tier's ~500 000 tokens per 24h it is a
sixth of the day. Measured: *"How do I add a song?"* ran all ten rounds, spent
**78 941 prompt tokens over 104 seconds and produced no answer at all**.

**Shipped.** `maxToolRounds` on the provider descriptor, **6** for the free one.
The corpus says a free model that is going to answer has answered by round six,
so it costs the good questions nothing and turns the bad one into an answer
written from what it had already found.

---

## EC-65 · A mid-loop rate limit threw away work already done — `done` 2026-09-01

Free pools 429 constantly — it is what makes them free — and they do it
MID-QUESTION. Measured: Kilo returned 429 on round 3 of 3, with the right manual
page already read and sitting in `messages`. The throw discarded all of it and
fell back to the offline bot, so the volunteer waited twice and learned less.

**Shipped.** A 429 after round 0 sets a salvage pass: one more call with **no
tools at all**, which is both the request a throttled service is likeliest to
accept and the only one that can still produce an answer. A 429 on the first
round is still just a busy service and still falls back.

---

## EC-66 · A weak model wrote its buttons in another language — `done` 2026-09-01

Found in the live window on the very first free answer: a correct English answer
about **Bible Lookup** carried a button underneath reading `请确认显示这个按钮`.
The system prompt's "ALWAYS answer in English" held for the prose and not for
the `OPTIONS:` line.

**Shipped.** `checkIsReadableReply` drops an option with **no Latin letter in it
at all**. Deliberately not "contains non-Latin characters": button names in this
app are translated, so *"Show me លុបព្រះគម្ពីរ"* is correct and must survive.
This window's standing lesson again — enforce, do not ask.

---

## EC-67 · A stored message keeps the buttons it was born with — `open`, low

`EC-66` filters at parse time, so a conversation saved before the fix still
draws its old options — the Chinese button is still on screen in a reloaded tab.
Self-healing (the next answer is clean) and cosmetic, but it means any future
option-filter change is retroactive to nothing. If it ever matters, filter on
render as well as on parse; the function is already pure and exported.

---

## EC-68 · Free models write markdown the renderer does not draw — `open`, low

Measured live in the same answers: the free model emits `*To choose a color*:`
as a line prefix, which this renderer shows verbatim with the asterisks. Paid
models do not do it. Cosmetic, and worth a look only if the free tier becomes
the common path — the fix is either a renderer that handles single-asterisk
emphasis or a normalisation pass beside `stripInternalIds`.

## EC-79 · A chord glued to the words read as a word — `done` 2026-09-04

**Reported by the user, with the file the assistant had just made.** A verse of
a real song came out as eleven lines, each one a fragment of a sung line with
`|D` sitting in front of it as text somebody sings.

`EC-76` assumed a chord site prints `|` and `D` as separate things, because the
one page it was first measured against happened to flatten that way. Most of
them print `|D` — one token, glued to the syllable it lands on — and that
matched neither the bar pattern nor open-lyric's chord pattern, so every chord
read as an ordinary WORD. The row then never joined, because a bare word line
following a bare word line is what starts a new line.

**Shipped:**

- `readChordToken` pulls the bar off the chord; `splitLeadingChords` takes the
  run off the front of the words; `classifyLine` counts both, so a row of
  `|D |A |Bm` is a chord row rather than a sentence.
- The chord is now **written where it lands** rather than dropped: `|[D]`, bar
  OUTSIDE the brackets. `[|D]` is what the page looks like and what anybody
  reaches for first, and it is refused by open-lyric and by our own validator
  alike — the brackets hold a chord symbol and a root is `A`-`G`. Both forms
  were probed against `checkMarkdown` before the form was chosen, and the probe
  is kept as a test.
- `toSafeLyricLine` keeps exactly the brackets holding a chord. It was rubbing
  every one of them out a line later.
- Two bounds, because `A` is a chord and also a word in half the languages
  written in Latin script: a leading chord is taken as a chord only with a bar
  on it, or in front of another script, or on a page already shown to glue its
  chords AND longer than one character. And a run of SEVERAL chords before one
  fragment writes nothing — it says which chords are played, not where any of
  them lands.
- A region carries the chords that OPEN it (a wall is broken only by words, so
  the song's first chord sat inside it) and does not COUNT them — three chords
  is what `pickLyricRegion` takes as proof, and three carried ones handed that
  proof to the view-count line under a fretboard chart.
- Nothing printed under a credit line is a translation of it (`EC-77`, half).

**Also asked for in the same exchange, and shipped with it:**

- **`- Attachments: <url>`** -- the page's own address, off
  `owa_read_website`'s header line and ONLY from in front of the fence. The
  header is written by this package and the body by a stranger, so a
  `Read https://…` planted in a page cannot be filed as the song's source.
- **`- Copyright:` from the page.** Most pages print the notice in the FOOTER,
  nowhere near the song and outside the region this reader works to isolate, so
  a page that says whose the song is in plain sight was producing `Unknown`.
  Read from the bottom up, trimmed at the footer's own menu, and only a real
  notice -- the sign or `(c) 2026`, never the bare word, which is a menu item
  (`Copyright Policy`) whose name would land in the song's field.
- **The song is SHOWN before it is made.** `RenderLyricPreviewComp` draws the
  document in a read-only box above the two buttons, off the same in-memory
  reference they use. Keeping the notation out of the ANSWER (which is right --
  it is not an answer, and it costs the song in tokens twice) had also kept it
  out of sight, so the one thing the user is asked to approve was the one thing
  they could not look at.

**Refused, and why:** `[|D]` -- the bar INSIDE the brackets, asked for twice
and confirmed after the cost was stated. It cannot be done. open-lyric's
chord-annotation grammar is `^\[<chordSymbol>\]$` and a chord symbol's root is
`A`-`G`, so on the user's own song `[|D]` gives **12 validation errors** where
`|[D]` gives none. That is not cosmetic: `draftOpenLyric` gates tier 1 on
`validateOpenLyric`, so every song would fall to unstructured `Breakdown`
sections -- and worse, `owa_lyric_file` `create` runs open-lyric's own
`checkMarkdown` at the disk boundary (`checkLyricContent`,
`src/helper/agentFileHelpers.ts`), so the file could never be written at all
and the **Create** button would fail every time. There is no escape for a
literal `[` in a lyric line. `|[D]` is the schema's own form and is what
ships.

**Measured on the page the user named:** four verses, three lines each, every
chord where the page puts it, the two furniture lines named in the report
instead of sung. 532 tool tests pass, tool surface and token cost unchanged.

**Housekeeping, not done:** `EC-76` is used twice in this file — once for the
2026-09-03 press-reports-its-effect work and once for 2026-09-04's song page.
`scoreboard.md` cites it for both. Renumbering would break those citations, so
it is recorded here rather than quietly fixed.
