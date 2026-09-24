# Scoreboard — the climb, run by run

"Greater and greater" only means something if it is measured the same way every
time. One row per run of this skill. **Append, never rewrite history** — a row
that got worse is the most useful row in the file.

## How a run scores itself

1. Ask the standing corpus ([research.md](./research.md) Track A) — the same
   twelve shapes, in the same order, presenter and reader.
2. Grade each answer on the scorecard. An answer **passes** only if it is _all_ of:
   correct, actionable, leak-free, and offered a walkthrough when it needed one.
   Partly-right is a fail; that is the point.
3. Run `scripts/audit-mcp-tools.mjs` for the cost columns.
4. Write the raw per-question detail to
   `test-results/chatbot-quality/score-<runid>.json` (gitignored, like
   robot-test's coverage files) and the one-line summary here.

Keep the corpus stable so the rows compare. When you ADD a question, add it to
[research.md](./research.md), note it in the row's _Notes_, and never retire one
just because it keeps failing.

## The rows

| Run            | Date       | Pass                                                                                                                                                                                                                             | Leaks                                     | Median rounds                                 | Tools   | Tokens/round                               | Rung                                                                                                     | Shipped                                                                                                                               |
| -------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------- | ------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| baseline       | 2026-08-31 | not yet graded                                                                                                                                                                                                                   | —                                         | —                                             | 42      | ~8 555                                     | 2 (partly)                                                                                               | skill created; `EC-01..09` filed                                                                                                      |
| retrieval      | 2026-08-31 | 2/4 spot-check → 3/4 (+1 ratchet check held)                                                                                                                                                                                     | 0                                         | not instrumented                              | 42      | ~8 555                                     | 2 (partly), rung 5's own test question now passes                                                        | `EC-01` + `EC-04` closed; symptom-shape prompt rule; query-side vocabulary aliases                                                    |
| guide-acts     | 2026-08-31 | demoable manual steps 169/251 → **182/251**; W-06 2/6 → 5/6                                                                                                                                                                      | 0                                         | n/a (no LLM round — a card defect)            | 42      | ~8 555 (+0)                                | **3 up**: demo mode does the step on 13 more steps, incl. the reported one                               | `EC-15` closed; `owa_guide_start` takes `press`, status gains `canActOnStep`; `EC-16`/`EC-17` filed                                   |
| right-target   | 2026-08-31 | W-08 walkthrough: 1/4 steps rang the right control → **2/2 of the steps that name one**; 2 wrong rings → 0                                                                                                                       | **1 → 0** (a card showed “(W-08 step 1)”) | n/a (no LLM round — a card defect)            | 42      | ~8 633 (+0)                                | **3 up**: the ring, and so **Do it**, lands on the control the step means                                | `EC-18`–`EC-21` closed; `EC-22` filed                                                                                                 |
| menu-steps     | 2026-08-31 | W-21 demo: 0/5 steps completed → **all 4 actionable steps completed**; right-click steps 0 → 5                                                                                                                                   | 0                                         | n/a (no LLM round — a card defect)            | 42      | ~8 686 (+53, the rightClick description)   | **3 up**: demo mode reaches a control inside a menu                                                      | `EC-24`, `EC-25` closed; `action: "rightClick"`, region targets, two-press steps                                                      |
| parent-path    | 2026-08-31 | W-21 step 1 with the panel OPEN: wrong control → **right control**; `owa_find_ui "Background"` rank 1 wrong → right. **Regression caught: `EC-18` (run `right-target`) only ever held with the panel collapsed**                 | 0                                         | n/a (no LLM round — a matcher defect)         | 42      | ~8 783 (+97, the `Panel > Control` syntax) | **3 up**, and 2 shored up: a step's ring is now right in BOTH panel states, not one                      | `EC-26`–`EC-28` closed; panes carry `data-widget-name`, matcher reads the parent path, card dodges its own ring, ring animates colour |
| out-of-the-way | 2026-08-31 | walkthrough visibility: **12% of the presenter's named controls hidden by the help window → 0%**; the reported case (a card ringing a control behind the chat window) fixed                                                      | 0                                         | n/a (no LLM round — a window defect)          | 42      | ~8 783 (+0)                                | **3 up**: the control a step rings can actually be seen and pressed                                      | `EC-29` closed; walkthroughs minimise the help window and restore it; `EC-30` filed                                                   |
| hover-hidden   | 2026-08-31 | controls painted only under the mouse: `owa_find_ui "Copy"` rang blank space and called it visible → rings a **painted** icon and marks it `showsOnHover`; 24 such controls on the presenter, 0 → all of them reachable honestly | 0                                         | n/a (no LLM round — a matcher defect)         | 42      | ~8 857 (+74, what `showsOnHover` means)    | **3 up**: the ring, the press and the card now land on something the user can see                        | `EC-31` closed; `visibilityOf` / `revealHidden` / `releaseHidden`, forced `:hover` instead of a moved mouse                           |
| ask-anything   | 2026-09-01 | discoverable questions **8 → 208** (5 pages, 30 sections), every one pinned to a live-verified recipe or a live tool; the ask box suggests as you type where it suggested nothing                                                | 0                                         | n/a (no LLM round — a corpus + window change) | 43 (+1) | ~9 179 (+322, `owa_list_questions`)        | **2 up**: "what can I even ask?" is answered in the box, and a vague ask has a route that is not a guess | `EC-32` closed; `questions/*.json` + `questionMatch.mjs` + type-ahead; `EC-33` filed                                                  |

| label-i18n | 2026-09-01 | app labels shown in the user's own language **0% → 100%** (187 twins templated); labels the manual got WRONG for a Khmer user **6 → 0**; `owa_help_page` leaks (recipe id, duplicated title, `📸`) **3 → 0** | **2 → 0** (the id `W-06`, twice, and the cited `W-10`) | n/a (a corpus + tool-output change) | 44 (+1) | ~9 481 (+302, `owa_tran`) | **2 up**: an answer now names the button the user can actually see, and is written rather than pasted | `EC-34` closed; `en:tran:` label templates + `tran.mjs` + `knowledge/tran.json` + `owa_tran`; `EC-35` filed |
| follow-through | 2026-09-01 | multi-turn questions **0/2 → 2/2** (the reported "yes", and a pronoun follow-up on the other provider); single-turn ratchet held | 0 | 1 (unchanged — no extra lookup) | 44 (+0) | ~9 481 + up to ~600 of conversation, only when there IS one | **2 up**: the assistant can be replied to the way people reply | `EC-36` closed; the tab's recent turns go back with the question, bounded; offline bot stops searching a bare "yes"; `EC-37` filed |
| stuck-step-rescue | 2026-09-01 | a walkthrough step the card cannot do: **apology → usable instruction; measured failure rate 1/12 (8%)** on the reported W-06 step 3, median 12s, reached in six measured corrections and now tracked by `scripts/rescue-failure-rate.mjs` rather than eyeballed. **68 of 251 manual steps (27%)** could reach that apology. Narration **3 in 4 → 0**, projector drift **3 in 3 → 0**, pasted tool labels **4 in 6 → 1 in 12** — each found only by measuring, none by reading the code | 0 | 1 rescue round, only when a step is actually stuck (0 on every other question) | 44 (+0 — no new tool; the card talks over the app's own relay) | ~9 481 (+0) | **3 up**: a walkthrough now survives its own dead ends instead of ending on one | `EC-38` closed; `owa-guide-help` relay card → main → chat → card, `DO:` frame parsed in code, transcript shows the human half; `EC-39`, `EC-40` filed |
| answer-options | 2026-09-01 | answers ending with something to PRESS: **only the ones that happened to read a manual page → every one of them**. Live on GPT-5, 4 answers of 4 carried usable options (3, 3, 2, 2 buttons) and the offline fallback carried one from the corpus. Raw `OPTIONS:` visible to the user **1 → 0** — caught live on the first run and fixed, not by a test | **1 → 0** (the frame itself, inline in a sentence) | unchanged (no extra lookup — the options ride the answer) | 44 (+0) | ~9 481 (+0 tool schema); system prompt +263 chars, **~+66/round (+0.7%)**, paid for by compression | **2 up, toward 5**: the assistant now proposes the next step instead of waiting to be typed at | `EC-43` closed; `OPTIONS:` frame + `quickReplyHelpers.ts` (parse → read the answer → ask the corpus), 5-button ceiling; `EC-44` filed |
| kimi-provider | 2026-09-01 | Kimi answers end to end on a real key: `kimi-k3` and `kimi-k2.6` both gave numbered steps naming real controls; **More models...** returned `kimi-k2.7-code` from the account; a bad model id fell back to the manual reading _"Kimi could not answer"_. Settings rendered in Khmer without blanking. | 0 | 1 (both models answered on the first round after tool calls) | 44 | ~9 492 (+0 — a provider costs no tool schema) | 2 (partly) — **no rung moved; this is reach, not quality**: a third key to fall back on when one provider is rate-limited or out of credit mid-service, which is a rung-4 property once it is measured. | `EC-24`: Kimi (Moonshot) via `askOpenAiCompatible` + a per-provider descriptor; provider set declared once in `LLM_PROVIDER_MAP` (3 silent-misroute ternaries removed); **2 data-loss bugs fixed** (`setAISetting` dropped any key it did not hand-list — a Kimi-only key was deleted by the save that stored it; `getLlmModel[0].id` white-screened the window); AI settings rows now name their own consumers, replacing two hints that omitted the chatbot. New CB-22. |
| right-page | 2026-09-01 | **Retrieval graded on 236 labelled + 45 held-out questions, not on a handful.** Top-1 136/236 (58%) → **140 (59%)**, top-3 179 (76%) → **186 (79%)**; held-out volunteer paraphrases 47% → **51%**. Per-query: 26 top-1 answers changed, **9 fixed, 3 broken**. Questions pointing at a manual page that does not exist **4 → 0**. | 0 | unchanged (no extra lookup — both fixes are inside the one search) | 44 (+0) | ~9 492 (+0 — no tool schema changed) | **2 up, and honestly capped**: the reported class of catastrophically wrong pages is gone, and 41% of supported questions still miss their own recipe — filed as `EC-50`, the reason rung 2 is still not _reached_ | Verified live on GPT-5: the reported chip now offers NO walkthrough (it opened no page), while a real how-to still starts W-06 ringing **Bible Lookup**. `EC-47` (a word matched a different word: "screen"→"Screencast", "copy"→"copyright" — 45 pairs, 229 occurrences, cut by a 3-char tail cap; plus IDF-weighted coverage, unsquared), `EC-48` (the walkthrough followed the model's FIRST search forever; now the page it actually opened, and nothing when it started its own card), `EC-49` (`W-01b` was silently folded into W-01 by a digits-only heading regex). `EC-50` filed. New CB-24. |
| show-me | 2026-09-02 | **not graded on answers — this run changed what a question can BE, not how one is answered.** What was measured instead: `selectorOf` against the live presenter, **181 of 181 visible controls got a unique selector, 0 unresolvable**; the picker returned the right control with `probeHits: 0` and no popup opened, so a pointing click provably does not press. `owa_screenshot` returned a real picture of the presenter; the chip read **Setting** (not "Setting Setting") and pressing it put one ring at 1169.33px on a control at 1169px. 39 new tests | 0 | unchanged (attachments ride the question, they do not buy a round) | **47 at the host (+3), 44 to the model (+0)** | **~9 492 (+0)** — measured after: host ~10 022, model ~9 492, the three new tools being client-only; system prompt +3 lines, ~+60/round, paid for by compressing the `owa_find_ui` bullet | 2 (partly) — **no rung marked moved**: the capability is rung-5 shaped, and the window half is not live-verified yet (`EC-59`) | `EC-51` (five ways to attach; bytes never persisted; images out of the history; blind model refused before the call), `EC-52` (add to an answer in flight; drained only where the next round is guaranteed; a Stop gives every word back), `EC-53` (`CLIENT_ONLY_TOOL_MAP` — the choke point `EC-02` wants). New `owa_screenshot` + `owa_pick_element` + `picker.mjs` + `selectorOf`; Presenting Control gains a 📷 with ask/copy/save. Pressing a chip shows what it stands for (ring / preview / reveal), asked for mid-run. `EC-56`, `EC-57`, `EC-58`, `EC-59` filed; `EC-60` (a backtick in a comment inside a template-literal runtime took the whole MCP host to 500 — `picker.test.mjs` is the guard). New CB-26..CB-31. |
| picture-only | 2026-09-02 | **the reported interaction, end to end: a hard provider refusal → a real answer.** An image-only ask sent `{type:'text', text:''}` and was rejected outright; now it asks the question a picture plainly is. Re-run live from a NEW tab with **no history at all** (harder than the report, which had the assistant's own offer behind it): a correct description of the app plus 3 pressable options. Empty text blocks reaching a provider **2 paths → 0** (the user turn, and the model's own tool round echoed back). Offline recovery for a picture-only ask: the generic greeting → a line that says it cannot see pictures and asks for words | **1 → 0** — the raw API validation string `messages: text content blocks must be non-empty` was printed to the volunteer, dressed as their provider being down | unchanged (the fix is in the request, not the loop) | 47 host / 44 model (+0) | ~9 492 (+0 — no schema, no prompt change) | **2 up**: the window can no longer invite a press it then refuses | `EC-61` closed; `toAskedOfModel` as the one decision point, `askLlmBot` refuses an empty ask, the Anthropic loop stops echoing empty text blocks, the offline half degrades honestly. **Also unblocked `llmBotHelpers.test.ts`**, which had been failing to load — contributing 0 of its 47 tests — since the in-flight `free` provider pulled `appProvider` into a node-env suite. 8 new tests |
| no-key-assistant | 2026-09-01 | **the state the app ships in: a fresh install had NO assistant at all → a working one.** Graded the keyless default (LLM7 `gpt-oss`) on 8 corpus shapes through the real 44-tool loop: **7/8 answered, 0 leaks, median 4 rounds**. Live in the real window end to end on two questions. Not equal to a paid key and not sold as one — the warning says so. | **0** in the prose; **1 → 0** in the buttons (a weak model wrote an option in Chinese) | 4 (free models; paid providers unchanged at 1–2) | 44 (+0 — a provider costs no tool schema) | ~9 492 (+0) | **1 up for everyone with no key** — they had rung 0, the offline manual search. No rung moved for a user who already has a key. | `EC-62` closed: `free` provider (LLM7 + Kilo Code, keyless, OpenAI protocol), `keyField` now optional, `IMAGE_CAPABLE_MODEL_MAP.free`. Three free-tier defects found by measuring and fixed: `EC-63` harmony channel markers inside tool names (`toCleanToolName`), `EC-64` round exhaustion (`maxToolRounds`, 10 → 6 for free — the worst question cost 79k tokens for nothing), `EC-65` a mid-loop 429 discarding every tool result already gathered (one tools-less salvage round). `EC-66` non-English option buttons. Standing sticky warning + Settings disclosure. `EC-67`, `EC-68` filed. New CB-32. |
| open-the-page | 2026-09-02 | **the reported press, end to end: a fault report → the window opened and the walkthrough running.** The same **Do it for me**, on the same tab, with Settings shut: the Settings window opens by itself and the card comes up in it. Windows a stuck walkthrough can get the user into **2 of 8 → 8 of 8** (4 opened by the app, 4 explained in their own `howToOpen` words); pages `owa_goto_page` accepts **2 of 3 → 3 of 3**, so the Document Editor crossing the prompt has always promised is no longer refused by the tool. | **1 → 0** (two file names and the open-page list, printed verbatim — and that was the generic path for EVERY failed button press) | unchanged on the button path (no LLM round at all — the press runs the tool itself) | 47 (+0) | ~10 136 → ~10 156 (+20, one more page in the enum and its reworded description) | **2 up, 3 shored up**: a walkthrough that cannot start now ends in the window it needed, not in an apology | `EC-69` closed; `openFind` + `BOT_MAIN_WINDOW_PAGES` on the one declaration, `genPageOpenAnswer` + `canOpenPage`, `describeActionError`; `EC-70` closed too — the SAME two-window hard-coding, in `guide.mjs`: the card opened in Settings still said _"Click the gear (Settings)"_. Windows whose "you are already here" steps get dropped **2 of 8 → 8 of 8**; W-16 in Settings 4 steps → **3**, unchanged from the presenter; `EC-71` filed (a recipe bullet list folds into one ~900-char step, now the OPENING one) |
| right-window | 2026-09-02 | **the reported card, end to end: wrong window and a ring on the wrong control → the right window and the right control.** Reported with a screenshot — the Settings recipe drawn in the Presenter, red ring around a Bible version button. Measured cause, not guessed: `owa_find_ui "English"` answers **3 identical matches in the Presenter and 0 in Settings**, because the Bible key button reads "KJV English KJV" and `English` came out of _"Language: click **English**"_. Recipes that now reach their own window **0 of 44 → 5 of 5 that name one** (all 5 correct; 5 that name several are correctly left alone, 29 that name none are unchanged). Steps offering the card an internal recipe id as a control to ring **3 → 0**. | **1 → 0** (`W-31`/`W-16`/`W-29` were live find candidates, and would have been shown in the "closest labels" line) | unchanged (a card defect — no LLM round) | 47 (+0) | ~10 156 (+0) | **3 up**: a walkthrough now happens where the task happens, so the ring has the right controls to choose from | `EC-72` closed; `detectRecipeWindow` + recipe ids filtered out of `finds`; `EC-73` filed (a second CDP client evicts a card in a popup — it breaks this skill’s own live-verification story) |
| song-from-text | 2026-09-03 | drafting: 0/4 hand-written attempts valid → **4/4 emitted documents valid**, confirmed by open-lyric's own validator | 0 | 1 (was a 3–5 round guess-and-fix loop, or no answer at all) | 48 | 10 936 host / 7 189 model; **this change is +61** (`owa_lyric_validate` 221 → 282, measured on the tool itself — the rest of the delta from the earlier baseline is other in-flight work on `owa_click` and `owa_list_screens`) | **3 up**: the assistant now DOES the thing rather than describing it | `EC-74` closed — `mode: "draft"`, the two answer buttons, the Presenter starter chip; `EC-75` filed |
| press-says-what-it-did | 2026-09-03 | **the reported answer, end to end: "Done — the screen is now showing" with `showingScreenIds: []` → a press that cannot claim that.** Measured on the aim first: `owa_find_ui "Show"` ranked a toolbar-reveal decoration **1st of 4** and the screen's own control 2nd — after the rename the real control is **1st**, proven live. Then on the evidence: `owa_click` answered 0 fields about the EFFECT of a press → `isOnNow` + `didChange` + `unverified`, all three proven live on a real toggle (`Pin document`: `isOnNow` true→false, `didChange` true) and on the very decoration that caused the bug (`didChange: false`, `unverified` set). | **1 → 0** — the leak here was not an internal detail but a false OUTCOME, which is worse: a volunteer told the screen is on stops looking for why it is off | unchanged — the evidence rides the click answer, so the verify rule costs no extra round in the normal case | 48 (+0) | `owa_click` 278 → 411, `owa_list_screens` 58 → 109; **+184/round**, repaid by the first `owa_list_screens` call (~2 800 → 173 result characters). Absolute totals not comparable this run — concurrent in-flight work in the tree | **2 up, 3 shored up**: the assistant stopped being able to report a thing it had not seen | `EC-76` closed; `genClickExpression` reads the control back after the press, `handleAutoHide`'s four decorations renamed out of the word _show_, `ShowHideScreen`'s title through `tran()` (it was hardcoded English), `owa_list_screens` gains `isAnyShowing` and drops Electron's `Display` dump, one prompt rule. `EC-37` (consent, the other half of the same transcript) left open on purpose. New CB-44. |
| song-from-a-page | 2026-09-04 | **graded on 14 real song pages, not on fixtures: valid-AND-right 0/8 → 14/14.** Before, every page drafted a valid document and none of them was the song — menus, view counts, fretboard charts and footers became verses, section labels were swallowed (a four-verse hymn came out as one `Verse`), and every line was broken into the fragments the chord columns cut it into. After, structures match the page's own printed play order (`V1x2Cx2V2x2Cx4B1x6B2x4` on a page that prints exactly that), and key/tempo/time come off the page. Ratchet: the whole `EC-74` paste path re-run unchanged | 0 | 1 (one draft call per page, after one read) | 48 → 48 | ~10 936 → **~11 056** (+120 measured, four optional params on an existing tool; a new tool would have been ~450) | **3** — it acts on a real page and reports the part of it that it used | `EC-76`; `lyricPageText.mjs` + 24 tests, the drafter extended (other scripts' numerals, `(2x)`, `Repeat X`, translation lines, refused Config values), `owa_read_website` whole-page capture + read timeout (it was leaking hidden windows), a fourth Presenter chip and the corpus's first TEMPLATE chip. `EC-77`/`EC-78` filed |
| chords-glued-to-the-words | 2026-09-04 | **the user's own file, quoted back: a verse drafted as eleven lines, each carrying `|D` as text somebody sings.** `EC-76` had assumed a chord site prints `|` and `D` separately; most print `|D` glued, which matched neither pattern and read as a WORD, so the row never joined either. After: the same page drafts four verses of three lines, every chord written where it lands as `|[D]` -- bar OUTSIDE the brackets, because `[|D]` is refused by open-lyric and by our own validator, both probed before the form was chosen. Ratchet: all 14 pages' rules re-run unchanged, 529 tool tests pass | 0 | 1 (one draft call after one read) | 48 -> 48 | ~11 056 -> ~11 056 (**+0** -- no new tool, no new parameter; the whole change is inside the page reader) | **3** -- the draft is something a musician can play from now, not just the words | `EC-79`; `readChordToken` / `splitLeadingChords` / `checkIsGluedPage`, chord marks carried through `rejoinChordSheet`, `toSafeLyricLine` keeps a chord's brackets, `toRegions` carries a song's opening chords without counting them, a credit line no longer takes a translation. `EC-77` half closed. 7 new tests incl. two oracle cases |
| says-what-it-is-doing | 2026-09-04 | **not an answer-quality run — three reported gaps in what the window tells you about ITSELF, all three shipped and driven live.** (1) The wait: one unchanging line for a question that takes ~55s (read a page, draft a song, name-check, create) -> a 5-line log naming each step and what it is working on, finished steps kept and dimmed, exactly one dot breathing. Measured live: `Connecting to the app` / `Thinking about it` / `Checking the projector screens` / `Checking what the app is showing` / `Thinking it over (2)`, cleared on the answer. (2) The tips: random-only -> ordered walk both ways with wrap, random kept on the sentence. (3) The scope: 4 chips of a 184-question corpus reachable -> all 184, grouped by panel, one press. Ratchet: 766 chatbot+tool tests pass, `getStarterQuestions`/`FALLBACK_STARTERS` agreement unchanged | 0 — and this is the run's main risk, so it is TESTED rather than eyeballed: `describeToolStep` maps all 29 model-visible tools by hand and a test fails on an underscore reaching the line, including for a tool added to the server later (it falls back to `Looking something up`, never its own name) | unchanged — nothing here touches the loop's decisions, only what it reports while making them | 48 (+0) | ~11 056 (**+0** — no tool added, no schema touched; the whole change is in the window and the loop's reporting seam) | **2 up, 4 shored up**: a volunteer can now tell a window that is working from one that has hung, and can see what the thing is FOR without guessing — the two ways this window was most often abandoned mid-service | `EC-80`, `EC-81`, `EC-82` closed. `progressHelpers.ts` (+11 tests) with `AskExtraType.onProgress` through both provider loops and `runMcpTool`; `stepChatTip`/`pickChatTip` (+4 tests); `getAllQuestions` + `RenderAllQuestionsComp` (+4 tests); 3 loop-seam tests. New CB-47, CB-46 + CB-17 amended, W-42 step 6 rewritten, corpus gains `what-is-it-doing` and `see-more-tips` |
| built-in-commands | 2026-09-02 | **12/12 asked on Claude Sonnet 5: 10 pass, 2 fail** (q08 put the mini screen "usually top area" — it is bottom right; q09's honest _no streaming_ carried walkthrough buttons for the Presenter overview). The same corpus on ChatGPT, Kimi and Free: **every ChatGPT and Free call 429, Kimi 429 from question 2**, so 33 of 36 answers were the OFFLINE bot's — graded **4/12** (the screen's state for a how-do-I, W-21 for "add a song", W-01 for "undo that" and "Facebook", nothing to press on the panic shapes). After: offline q01 → W-06, panic → a _Turn the screen on_ button, `/help clear the bible` → W-10; and 13 `/` commands at **0 rounds, ~1.6 s**, the screen proven on and off | 0 (Claude), 0 (offline) | 3 (Claude, 2–5); **0 for a command** | 48 (+0) | ~11 056 (+0 — nothing added to the tool surface; a command is a call the window makes itself) | **4 up, 2 shored up**: with every key dead the window now DOES the thing instead of describing it, and the first evidence for rung 6 — `/screen-show` is faster than the mouse | `EC-83` done (13 commands, `builtinActionHelpers.ts` + 15 tests), `EC-84` half done (two offline-bot fixes + 3 tests); `EC-85`–`EC-90` filed. New CB-48 |
| id-scrub | 2026-09-08 | **11/11 asked on Claude Sonnet 5 correct** (the standing corpus minus the recent-feature shape; q6 from the Reader, q12 in q11's tab), median 2 rounds — and the one where-is answer opened with _"W-08 has exactly what you need"_. Re-asked after: the model wrote the id AGAIN and the window drew _"The guide page “Set the background (color / image / video / web)” is the exact match"_. Duplicate walkthrough replies **7 of 7 → 0** (the Bible-verse answer 4 buttons → 3). Ratchet: q8 _Where is the mini screen?_ now right (bottom right — was "usually top area"), the panic shape 2 rounds (was 5), Facebook honest with no walkthrough buttons | **1 → 0** — a manual id in prose, on a corpus question, from a model that had been told twice not to; and the search excerpts had been handing ids over the whole time (page bodies were scrubbed, excerpts were not) | 2 (range 2–6; q12's follow-up 6, `EC-87` still open) | 48 (+0) | ~11 056 (+0 — no schema change; the scrub is in the excerpt text and in the window) | **2 shored up**: an id can no longer reach the answer, whatever the model writes | `EC-92` (+ `EC-22` closed), `EC-89` first bullet; `EC-93`, `EC-94` filed. New CB-50 |
| known-question | 2026-09-03 | **Retrieval graded on all 258 supported questions with a page: top-1 147 (57%), top-3 192 (74%)** — the app's own chips and suggestions got the wrong page two times in five. After: a corpus question routes to its filed page **258/258 by construction**, held-out paraphrases **22/45 → 22/45** (no known-question hit fires on one). Ratchet on the live corpus: the panic chip **5 rounds → 2** (opens W-10 without a search), _Can it stream to Facebook?_ **walkthrough buttons for the Presenter overview → none**, on Claude and offline alike. Score floor from evidence: no right top hit in 258 under 6, three wrong ones | 0 | 2 on a picked question (was 2–5) | 48 (+0) | ~11 056 (+0 — one field on one tool result, no schema change); the hint costs ~40 tokens on a picked question only | **2 up**: what the window itself suggests asking is now answered from the right page, with a key or without | `EC-91` done (`findKnownQuestionRecipe`, `findKnownQuestion` / `genKnownQuestionHint`, +8 tests), `EC-85` done (`MIN_HELP_HIT_SCORE`). New CB-49 |
| starter-chips | 2026-09-08 | **The four _Try asking_ chips graded on the assistant the user's window was actually set to — Kimi K2.6 on Moonshot's FREE tier — and followed through to what each chip invites: 9 exchanges, 5 pass, 4 fail.** The two how-do-I chips pass clean. The paste chip invites a paste; the paste arrived inside the free tier's minute, was refused (429 ×3 in 3.6 s), and the offline bot searched the manual for sixteen lines of Amazing Grace. When it worked, both draft chips carried model pills (_Create the file_, _Copy the text_) drawn BRIGHTER than the real buttons; pressing one cost 4 rounds, 32 s, three refused creates and an offer to _Overwrite the old one_ — the real button took 1.5 s and 0 rounds. And the page chip's instruction to hand a page over WHOLE, obeyed on a hymnal text page, drafted _"Untitled"_ with **16 verses of menus** — both models had only produced a song by disobeying it. After: echo pills 4 of 4 draft answers → **0**; a rate-limited paste → the offline bot drafts it itself (3.6 s, same two buttons, Create → _Amazing Grace (3)_); the whole page → title, author, _Public Domain_, the address, six verses (proven live on Kimi, which handed it over whole on the re-run); Claude's own copy → right first time (5 rounds → 4). Kimi also drew a walkthrough card unasked on _How do I add a background?_ — the prompt's own _offer … and call `owa_guide_start`_ — fixed in the sentence: 2 rounds, no card | 0 in prose; **1 → 0** false offer (_Overwrite the old one_, a thing no tool will do) | 2 (Kimi; the page chip 3–4) | 48 (+0) | ~11 056 → **~11 113** (+57: a `copyright` slot and a mode note on `owa_lyric_validate`) | **3 shored up, 4 up for a paste**: the only path a volunteer would press under a draft now goes through the hardened create, and with the key refused the paste still becomes a song | `EC-95`–`EC-99` done, `EC-88` done, `EC-100`–`EC-102` filed. New CB-51. The drafter's numbered-stanza and page-table readers (+9 tests), `checkIsLyricPaste` / `answerLyricPaste` (+11), `checkIsDraftEcho` (+4), free-name refusal |
| do-it-for-me | 2026-09-08 | **Reported with a screenshot: the Bible Lookup popup open, the card's ring drawn THROUGH it onto a line of Genesis, Do it clicking a tab nobody could see — then "many question fail during Do it".** Measured for the first time by pressing Do it through every step of every recipe (new `demo-failure-rate.mjs`, card only): **224 presses, 92 counted done, 124 refused — and at least 10 of the 92 had pressed the WRONG control** (the projector's _Clear All_ for the drawing panel's _Clear_, the help window opened for a bolded _ASSISTANT_), which is worse than a refusal. After: a covered control is closed out of the way first (popup / menu / floating panel; a question the app asks is never answered), only a control called what the step says is pressed (**wrong presses ≥10 → 0**, 33 look-alikes now refused BY NAME), 27 steps that only describe what to see read Next instead of failing, four tour pages start (**recipes that start 33 → 36**), and a 41-character bold no longer eats the next label. Honest refusals go UP (124 → 142) because a wrong press is now a named refusal. The reported flow end to end on Kimi: ring on the popup's ✕, first Do it closes it, second opens the panel, step 2 rings Colors in view | 0 in prose; **≥10 → 0** false "done" presses | 2 on the ask; the button path spends no round | 48 (+0) | ~11 113 → ~11 113 (+0 — the runtime and the matcher are page strings, no schema touched) | **3 up, hard**: "it acts, reliably" was measured for the first time and was not true; what it presses is now what the step names, or nothing | `EC-103`–`EC-107` done, `EC-42` done, `EC-16` narrowed; `EC-108`–`EC-110` filed. New CB-52. guide.test.mjs +9, domMatch `isPressSafe`/`preferPressSafe`, W-12 step 1 renamed to the app's own label |
| own-tools | 2026-09-08 | **The standing corpus on Claude Sonnet 5, 12 questions, with every round's token usage read off the provider response for the first time: 10/12 pass → 12/12.** Two ratchet regressions, both on the panic shapes: _Nothing is showing on the projector_ rang the Bible Lookup's save button, then pressed **F5 through `press_key` on two windows** and the congregation's screen came on with nobody asking (8 rounds); _the words no come out big screen_ took three `take_snapshot`s (~8 400 tokens each), read the console, ran to the ten-round cap and answered _"I could not find an answer for that"_ after 72 s and 225 000 tokens. No graded answer had ever called a chrome-devtools tool and passed. After: the model sees the 19 `owa_*` tools and nothing else; the offered-never-done rule names showing a screen and a shortcut key; `owa_click` refuses a loose match ("show screen" → the save button, refused by name). Re-asked: both 2 rounds, 5–6 s, offered; the **Yes, turn it on** chip then found the real control by name, pressed it and verified it (4 rounds) — the consent path lost nothing. Cost, measured not estimated: **813 445 full-price input tokens → 62, plus 41 613 written and 401 601 read (89% off, $1.63 → $0.18)**, rounds 44 → 31 | **0 → 2 → 0**: the re-ask quoted `(isAnyShowing is false)` twice in two asks the moment the symptom rule asked it to say which fault it found; scrubbed at the prompt AND at the answer seam, third ask clean | 3 (range 2–10) → 3 (range 2–3) | 48 (+0) | ~11 113 host / **~7 366 → ~5 503** to the model; Anthropic's own count of the prefix 15 876 → 13 088, and now a cache READ on every round after the first and every question after the first | **3 shored up, 4 up**: an unasked change to the projector is no longer reachable by a key, a press lands only on a control called what was asked, and a question costs a tenth of what it did | `EC-111`–`EC-114` done, `EC-57`, `EC-02`, `EC-03` done, `EC-89` widened; `EC-115`–`EC-117` filed. New CB-53. modelTools.test +2, llmBotHelpers.test +2 (cache shape), recipeIdHelpers.test +2, domMatch.test +1, quickReply +2 |
| song-page-url | 2026-09-09 | **Reported by the user with a screenshot of a Khmer hymnal's chord page, its `\|G` markers circled: _no key note imported_ for _Create a lyric file from_ that page.** The saved transcript and the `.owl` on disk: Sonnet 5 read the page, then handed the drafter its OWN copy of the words — every fragment rejoined, the artist transliterated, and **0 of the page's 36 chords**, no `Attachments` line. The prompt and the tool description had both said _hand the page over whole_; `EC-98` had already recorded that no provider does, and on a chord page that costs every chord. The page handed over whole drafted every chord — and the site's toolbar as a nine-line **Verse 1** with the real verses renumbered, and the site's own `© 2026` footer as the hymn's copyright. After: the drafter takes the page ADDRESS and reads it itself; **re-asked twice on Sonnet 5: one tool call, 2 rounds, 18–20 s, Create pressed → 36 chord marks on disk, two verses, the preview drawing `\|G \|G \|Em` over the words as the site does**, the banner naming the site. The first re-ask had lost the window's Create button to a `Read …` prefix on the tool result — caught by reading the buttons, not the draft | 0 | **3 → 2** (two tool calls → one; the page text no longer rides the remaining rounds) | 48 (+0) | ~11 113 → **~11 208** host, ~5 503 → ~5 598 to the model (+95: a `url` parameter and two sentences) | **2 up, 3 up**: the words AND the chords now reach the file whatever the model does with the page, and the toolbar cannot become a verse | `EC-118`–`EC-120` done; `EC-121`–`EC-123` filed. New CB-54. firewall `checkIsNetworkCall` (+1 test), notify (+1), progressHelpers (+1), lyricPageText `cutAboveMetadataStrip` / `takeLeadingFurniture` / `checkIsSiteNotice` (+4), openLyricDraft (+1) |
| what-is-on-screen | 2026-09-09 | **The standing corpus on Claude Sonnet 5: 12/12 pass (4 with a defect), median 3 rounds, every round after the first a cache read — and then, for the first time, the panic shapes followed THROUGH.** With the projector SHOWING a Khmer verse, _the words no come out big screen_ took **9 rounds and 36 s** to conclude _"nothing has actually been sent to it yet: turning the screen on just gives you a blank canvas"_ — a confident wrong answer to somebody reading that verse off the wall — and _is anything showing?_ answered _"yes, the screen is on"_ and nothing about what. Pressing **Yes, turn it on** under the panic answer took **8 rounds**: `owa_find_ui "show screen"` found nothing (`EC-115`), `owa_click "0 Screen: 0"` pressed a near miss, and the toggle was finally pressed by a DOUBLED label. Cause, all three: `owa_list_screens` said whether a screen was on and nothing about what it held. After: the tool answers what each screen holds (slide with its first words, passage, background, foreground, lock), the exact words on its show/hide and Clear buttons, and where the Mini Screen panel sits. Re-asked: _is anything showing?_ → _"showing a song slide — Verse 2 of "…", with the text starting "…"; no Bible verse or background"_; _the words no come out_ → on, holds Verse 2, nothing cleared or locked, ONE display → check the projector connection, then the display button _"in the Mini Screen panel at the bottom right"_ (3 rounds, and the card placed right — `EC-116` closed); the panic answer names the slide already loaded and its **yes** is **3 rounds**, `owa_click "Toggle showing screen [F5]"` straight off the answer, _"please check the wall"_, verified on. The offline bot and `/screen` say the same content with no model (1.6 s). Ratchet: q08's "usually near the top" gone; q11 answered one way instead of asking which of three (weaker, still right); q12 still hedges _Delete (or the equivalent)_ for Move to Trash | 0 | 3 (corpus); the panic "yes" **8 → 3** | 48 (+0) | ~11 208 → **~11 332** host, ~5 598 → **~5 722** to the model (+124, all description) | **5 reached for the screens** — the assistant now knows what is on the projector and says it; the rest of rung 5 (what the user is in the middle of, the next step unasked) is open | `EC-124`, `EC-125` done; `EC-116` closed by it; `EC-126`, `EC-127` filed. New `agentScreenHelpers.ts` (+10 tests), `agentScreens.mjs` (+6), domMatch (+1), helpBotHelpers (+2) |
| in-the-middle-of | 2026-09-09 | **The standing corpus on Claude Sonnet 5: 12/12 pass (q12 still says _delete_ for Move to Trash), median 3 rounds — and then, for the first time, the OTHER half of rung 5: what the user is in the middle of, asked with the selection deliberately different from what the projector held.** _Which song is selected right now?_ (Amazing Grace highlighted, a Khmer hymn on the off screen) → _"The song loaded on your Mini Screen right now is នៅកាល់វ៉ារី …"_ — wrong, 2 rounds, the only document any tool had ever named. _Show the next slide_ → **10 rounds, 54 s, 13 tool calls**: six `owa_list_ui` hunts for slide cards that had NO accessible name, a 200-row dump (**34 574 tokens** into the cache), `owa_click "5 Index: 5"` (a badge that happened to bubble to the card — the projector changed), then _"I could not find an answer for that"_; asked again clean, 9 rounds, 80 s, nothing pressed, same non-answer. The driver captured each round's content for the first time: **every Sonnet 5 round carries a `thinking` block by default, and the last round stopped on `max_tokens` with 2 000 tokens of thinking and no text.** _Put John 3:16 on the screen_ offered W-06 honestly (3 rounds) but **Do it for me** stalls at step 2 with the user's verse lost (`EC-131`); _What's next in my running order?_ 6 rounds, unverified (`EC-132`). After: the selected song right in 2 rounds (4.6 s, one call); _what am I about to put on_ names the slide on the wall and the one after it; _show the next slide_ **2 rounds, one call, one confirmation → `owa_click "Slide 5: 671826"` → `owa_list_screens` → "Slide 5 is now showing" (4 rounds, 7.6 s, proven on the wall)**; `/selected` `/next` `/previous` the same with no model (1.5–3 s). Ratchet on the final re-run: **11/12** — q06 (_How do I edit a slide?_ from the Reader) wrote its steps off the search excerpt without opening the page, 5 of 7 asks today once the prompt had grown (_"click the slide document — this opens the Slide Editor"_, from W-02's _"only opens when a slide document is selected"_); `effort: low` and `medium` were tried and dropped (both skipped the page too), the top search hit now carries a note to open the page first (2 of 2, then 0 of 1 — a hit rate, not a fix), and the W-02 step the excerpt came from was reworded to put the order first (select, THEN click the tab; a sibling session editing that file made the change) -- re-asked after the knowledge rebuild: **2 of 2 opened the page and gave the right steps**. Carried in the row as 11/12 because that is what the full re-run scored; the ratchet check next run is q06 from the Reader | 0 in prose; **1 → 0 tool-field leak channel closed** (`owa_app_state` no longer sends the user's data directory or forty component names) | 3 (corpus, unchanged); the new shapes 2 (were 10) | 48 (+0) | ~11 332 → **~11 445** host, ~5 722 → **~5 835** to the model (+113: the `selectedDocument` sentence on `owa_app_state`) | **5 up** (what the user is in the middle of is known and pressable), **4 shored up** (an empty final round says it ran out of room instead of claiming the app has no answer), **2 down by one question** (q06, carried) | `EC-128`, `EC-129` done; `EC-130`–`EC-135` filed. New CB-56. agentPresenterHelpers (+18 tests), agentPresenter.mjs (+9), builtin commands (+5), offline bot (+5), presenter questions +3 |
| divider-menu | 2026-09-09 | **Reported with a screenshot: the walkthrough for _Hide, show, and reset the app's panels_ on Step 1/5 saying _"Open the View menu at the very top"_, beside the user's own right-click on a panel divider open on Reset Size / Close First Widget / Close Second Widget — _"the agent also use contextmenu of the resize"_.** Measured before through the app's own host: the recipe knew ONE route, the native View menu, which no card can press (5 steps, `find: ""`, every Do it a refusal and a rescue round); `owa_find_ui "Reset Size"` → 0 (the divider had no name at all); and the View-menu step itself was DROPPED as a go-to-this-window step because its example list says _presenter_ two sentences in, so the card opened on _"Click a ticked one"_. Shipped: every divider is named `Divider between A and B` off its neighbours' widget names; the guide right-clicks a named divider where it is (open menu → name the item → next press chooses it) and never falls back to a list for a divider step; a needle's kind noun no longer costs a pane NAMED with one its exact match (_"Presenting Flow List"_'s own strip was a loose fit `owa_click` refused); the drop rule reads only a step's first sentence; W-31 gained the divider route (steps 7–9) and the corpus a question for it. Re-driven: step 1 back (9 steps), steps 7→8→9 press through end to end, screenshots of the app's own menu with the ring on _Close First Widget_ and of the collapsed strip ringed. No corpus run this time (a sibling run held the window); ratchet checked by the 591 tool tests, all green | 0 | — (no model round in any of it) | 48 (+0) | ~11 332 host / ~5 722 model (+0) | **3 — one more recipe the card can DO**: W-31 went from 0 of 5 pressable steps to 3 of 9 that do the job; the 4 native-menu steps stay refused (`EC-138`) | `EC-136` done; `EC-137`, `EC-138` filed. Tests: guide +3, domMatch +2, drop rule +1 |
| run-sheet-and-trash | 2026-09-09 | **The standing corpus on Claude Sonnet 5: 11/12 → 12/12.** The ratchet regression carried from the last row held: _How do I edit a slide?_ from the Bible Reader wrote its steps off the search excerpt again (2 rounds, no page) and started _"In the **Documents** list"_ — the Reader page has no Documents list — and the two answers the previous row had counted as passing had sent the user to _"the Presenter tab at the top"_, which the Reader has not got either. And q12, _and how do I undo that?_ under _How do I add a song?_, took **6 rounds and 17 s** (three searches, a `owa_list_questions`, two pages) to end on **Delete** — an item no menu in this app has; the manual had no page for removing a file. Then the open half of rung 5 was measured again: _What's next in my running order?_ 6 rounds, unverified. After: the Reader's prompt says which panels that page lacks and that the way back is the 🖥️ **Go Back to Presenter** button, and steps written without opening the page are handed back to the model once, in code (**q06 re-asked 2 of 2 right, 3 rounds**); **W-43** names Move to Trash, the confirm and the Recycle Bin (**q12 6 → 3 rounds, the real item**); `owa_list_ui` rows are words, panel and place only (**~180 → ~40 tokens a row, 0 component names, 0 paths**); and `owa_app_state` carries `runSheet` — the open run players, cursor and next as the Space key works it out — so the running-order question is **2 rounds, right, proven with the run landed on a document's last slide**, and `/run` says the same in 1.5 s with no model. The first re-ask offered to _press Space_, which no tool can — closed in the same run | 0 in prose; **1 → 0 tool-row leak channel closed** (`component` / `sourceFile` on every `owa_list_ui` row) | 3 (corpus, unchanged; q12 6 → 3); the run-sheet shape 6 → 2 | 48 (+0) | ~11 445 → **~11 586** host, ~5 835 → **~5 976** to the model (+141: the `runSheet` sentences on `owa_app_state` and the trimmed-row note on `owa_list_ui`) | **2 shored up** (the wrong-window shape and the missing recipe were both confident wrong answers), **4 up** (the loop now recovers from one wrong turn of its own, in code), **5 up** (the run sheet — the one question the situational rung most wants — is known and said) | `EC-130`, `EC-132` done; `EC-139`–`EC-141` done; `EC-142`, `EC-143` filed. New W-43, CB-58, CB-59, `/run`. Tests: llmBotHelpers +5, domMatch +2, agentRunSheetHelpers +9 (new), agentPresenter.mjs +4, helpBot +2 |
| stand-in-key | 2026-09-09 | **The window opened on its OWN default — ChatGPT / gpt-5, a key a week out of credit — and the standing corpus was asked through it: 12 of 12 waited 3–5 s on three identical 41 KB posts (`insufficient_quota`), then answered from the offline guide (8/12: a verse row offered as _the button to change the background_, the Reader sent "in the Documents list", the link-download page for _add a song_, the drawing panel's Undo for _undo that_) — with a live Claude key one option along the whole time.** After: the next key of the user's own stands in on a provider fault, once, and the tab moves to it — **12/12 answered by Claude through the dead ChatGPT door**, every note present, q12 in the same tab straight to Claude; the dead key is posted once. Offline, re-measured with the network cut: **8/12 → 10/12** (_Background_ offered and rung; the Reader answer opens with the way back to the Presenter). Ratchet held: the Sonnet 5 answers behind the stand-in are 12/12, q06 with the Go Back to Presenter route, q12 on Move to Trash | 0 | 3 (2 model rounds + the one dead post; median 8 s) | 48 (+0) | ~11 586 host / ~5 976 to the model (+0 — no tool changed) | **4 up** (honest degradation measured for the first time on the window's own default, and it now degrades to the next KEY before the manual; the manual answers are better where they were wrong) | `EC-144`–`EC-146` done; `EC-86` half; `EC-84` re-measured; `EC-143` +1. New CB-60, W-42 step 13. Tests: llmBotHelpers +7, domMatch +2, helpBot +4 |
| verse-by-reference | 2026-09-10 | **The standing corpus on the window's own default (Claude Sonnet 5): 12/12 → 12/12** (q02 lost mid-answer to a Vite full reload another session's save caused — `EC-150` — and re-asked right). Then the one shape the previous row left open, followed THROUGH: _Put John 3:16 on the screen_ answered with W-06's steps, offered honestly (3 rounds), and **Do it for me** under it pressed **Bible Lookup** and died on step 2 — `find: ""`, `press: "Tab"`, the verse nowhere (`EC-131`, reproduced verbatim). The song equivalent worked end to end (select 4 rounds → yes → verse 1 up, 4 rounds); the app's commonest live ask and top starter chip had no door. After: **`owa_present_bible` → `owa_list_screens`, 3 rounds, 9.1 s** — _"John 3:16 (Amplified) is loaded and ready, but the screen itself is currently off"_, the toggle's own words as a chip, NO walkthrough buttons; the **yes** 3 rounds, 6 s, the passage read off the projector window (screenshot in the score folder). **`/verse Psalm 23:1-3` 0 rounds, 1.5 s**; with the network cut the guide checks the reference, quotes it and offers ONE button (3.1 s) that presents it (4.5 s). And `owa_click "Clear Bible [F9]"` — the very words `owa_list_screens` hands the model — was refused twice in an hour and now presses (`EC-135`). Ratchet after: 12/12, q01 now offering _Put John 3:16 up now_ as its next step | 0 | 3 (corpus, unchanged); the verse shape 3 + 3 for the yes (was 3 + a dead card) | 48 → **49** (+1: the first new tool since the file tools) | ~11 586 → **~11 968** host, ~5 976 → **~6 358** to the model (+382: one registration, all description, cached after the first round; measured at 420 first and trimmed) | **6 reached for the verse** (a volunteer would rather ask than click through the picker — one sentence, one call, verified on the wall), **5 up** (q01 suggests the next step unasked), **4 shored up** (the same ask works with no key and no network), **3 shored up** (a press by a title with its shortcut lands) | `EC-147` done, `EC-135` done, `EC-131` half; `EC-148`–`EC-150` filed. New CB-61, W-06 step 7, W-42 `/verse`, a presenter question. Tests: agentBibleHelpers +13 (new), agentBible.mjs +9 (new), notify +2, builtin +4, helpBot +4, progress +1, llmBotHelpers +1, domMatch +2 |
| credit-used | 2026-09-10 | **The standing corpus on the window's own default (Claude Sonnet 5): 12/12 → 12/12**, median 3 rounds, no leak, q12 on _Move to Trash_ and q01 offering _Put a verse up now_ — and, read off the wire for the cost columns as every row has been, *_about $0.28 for all twelve**, a cache-cold first ask ≈ $0.04, a warm one-round follow-up ≈ $0.004. Then the user's own ask, mid-run: *as a user I want to see how many credit used per chat session* — and the window could not: the provider's `usage` block on every round was thrown away, so those figures existed for the driver and for nobody in the room. After: every answer carries its own figure beside Copy (*≈ $0.04 · 31.3k tokens_), a **Credit used** row under the pickers keeps the tab's total (a stopped ask's round counted, proven by stopping one after round 1 and watching the tokens move with no answer landing), both survive a reload, the free tier reads _free · 25.2k tokens_, and **`/credit`** says the total with the sums in 1.5 s and no model. Found on the way: a free model answered _how much has this chat cost?_ with the manual's own sample figure (`EC-152`'s reason for `/credit`), and the same model's `OPTIONS:` frame glued to a full stop was printed at the user (`EC-153`, fixed with the leaked line as the test) | 0 | 3 (corpus, unchanged); `/credit` 0 | 49 (unchanged) | ~11 968 host, **~6 358 to the model (unchanged — nothing new is sent to it)** | **4 shored up** (the cost of using it freely is on screen now, per answer and per chat, honest about being an estimate and about a model it cannot price); rung 2 held | `EC-152` done (the user's ask), `EC-153` done, `EC-154` filed. New CB-62, W-42 step 8 + `/credit`, a `common` corpus row (`chat-cost`), a tip. Tests: usageHelpers +24 (new), chatSession +3, llmBotHelpers +3, builtin +3, quickReply +1 |
| spend-guard | 2026-09-10 | **The standing corpus on the window's own default (Claude Sonnet 5): 12/12 → 12/12**, median 3 rounds, no leak, about $0.29 in all (q01 offers *Put a verse up now*, q06 leads with Go Back to Presenter, q12 on Move to Trash) — and then the user's own ask, mid-run: *I don't want to mistakenly get stuck in an infinite loop of programmatic error that eats all my credit or floods the bill.* Measured against the code rather than the corpus: NOTHING bounded what a fault could spend — the ten-round cap bounds one question and Stop bounds one person, and a window re-asking on every render, a card rescuing for ever or a relaunch loop asks a bounded question again and again; `EC-152` had made the bill visible, not stoppable. After: a circuit breaker with a latch on the one seam every model call goes through — a rolling-hour ledger written through to disk, a **Limit per hour** the user sets (default $1, `/limit`) and a fixed 150-calls-an-hour pace cap for the models the money cap cannot price, checked BEFORE every round and recorded after it whoever the caller is; at the cap the assistant PAUSES, answers from the guide under a note saying why, and stays paused until a PERSON presses **Allow more** (a button — a loop cannot press one; a restart does not lift it). Proven live: $0.21 seeded and read back after a reload, cap $0.25, one real question paid one round and was paused before its second, Allow more re-asked it and Claude answered; 150 seeded free calls with the money cap off refused the next question with 0 provider requests on the wire; the amber heads-up landed on the answer that crossed 80%. Then the new step was searched for and the manual had NOTHING: every page had been indexed to its 3 000th character, W-42 runs to 33 KB, and _How do I set a spending limit for the assistant?_ was answered **"That's not something Open Worship App has a setting for"** in one round with no search. The manual is indexed whole now (+82 KB on the index; top-1 53% → 54%, top-3 72% → 78% over 267 corpus rows with the exact route defeated) and the prompt says this window is part of the app; re-asked: 3 rounds, search → page → the picker and the `/limit` forms | 0 | 3 (corpus, unchanged); a refused ask 0 | 49 (unchanged) | ~11 968 host, **~6 358 to the model (unchanged — nothing new is sent to it)** | **4 shored up** — "costs little enough to use freely" now has a ceiling a fault cannot pass, and "degrades honestly" covers the guard's own pause (a sentence for the room, the guide underneath, the button that lifts it); rung 2 held | `EC-155` done (the user's ask), `EC-157` done (the manual searchable whole), `EC-156` filed; `EC-84`, `EC-143` sightings. New CB-63, W-42 step 8 + `/limit`, a `common` corpus row (`chat-spend-limit`), a tip. Tests: spendGuardHelpers +25 (new), llmBotHelpers +4, builtin +5 |
| provider-door | 2026-09-10 | **The user's ask, a third time that day: _if there any unusual response from api then give buttons for user to go to the api dashboard_.** A short Track A pass on the one shape it touches, through the real window on the ChatGPT key out of credit since `EC-83`: _Is anything showing on the projector right now?_ → the Claude stand-in answered under _"ChatGPT could not answer — the AI account is out of credit or being rate-limited"_, the body saying `insufficient_quota` in plain sight, and the row under it _How do I turn it on?_ / _Never mind_ / _Copy_ — nothing to press about the account that was empty (3 rounds, 5 s, ≈ $0.04). Read against the three providers' own error pages the same hour, the status-only reading was hiding a second defect: an empty Anthropic account is a 402 or a 400 saying "credit balance is too low", and the stand-in check (`401/403/429/5xx, never a 400`) had never once handed one over. After: the body is read into a KIND, the sentence says the one thing it knows (*out of credit* / *being rate-limited (asked too often)* / *out of credit or being rate-limited* only when the 429 said nothing more), and the note carries the door — *Open ChatGPT billing*, *Open AI settings* + *Open Claude API keys*, the limits page, the status page, the settings panel for the keyless one — as page NAMES resolved at the press out of one table Settings reads too. Re-asked on the same dead key: *"the AI account is out of credit"*, **Open ChatGPT billing** first in the row, the press opening the page and saying so (3 rounds, 4 s, ≈ $0.04) | 0 | 3 (one ask, unchanged) | 49 (unchanged) | ~11 968 host, **~6 358 to the model (unchanged)** | **4 shored up** — "degrades honestly" now hands over the door to the thing that is wrong, and covers the empty Anthropic account it used to hand to the manual; rung 2 held | `EC-158` done (the user's ask), `EC-159` filed (Kimi's money doors, the picker). New CB-64, W-42 step 13. Tests: providerIssueHelpers +19 (new), llmBotHelpers +5 |

**known-question run, in one line.** No user report this time — the previous
run's own finding, that two rankers disagree on the corpus's own starter
question, taken to the whole labelled set. 258 questions searched for as
typed: 57% got their filed page. The corpus ranker was measured as the
alternative and is worse (right 19% of the disagreements, the search 47%), so
the fix is not a better ranker but reading the label the corpus already
carries: an exact corpus question routes to its page, on the server and as a
hint to the model. Detail:
`test-results/chatbot-quality/score-2026-09-03-known-question.json`.

Three things this run learned that the next one should not re-derive:

- **Grade the ranker on the corpus before proposing corpus-first.** It looks
  like the obvious upgrade for the offline bot and it would have lowered
  top-1. The agreement figure (28%) is the useful one: when both rankers say
  the same page it is right 85% of the time, which is the "say when you are
  not sure" signal `EC-90` still wants.
- **A score floor is not a confidence measure.** Right and wrong top hits
  overlap from 6 to 160. The floor at 6 removes three garbage hits and nothing
  else; anything higher throws away right answers faster than wrong ones
  (threshold 20 keeps 133/147 right, drops 21/111 wrong).
- **The model never asks the question it was given.** Every picked question
  reached `owa_help_search` reworded, so a server-side lookup on the exact
  text helps the offline bot and never the model. The model has to be TOLD,
  on the ask, and the transcript must not show it.

**built-in-commands run, in one line.** Asked for from the app in four
messages — _"for some task the chatbot should not ask the llm api"_, _"add
build action like `/presenter-screen-show`"_, _"so user don't have to ask
llm"_ — and measured before it was built: the standing corpus through the real
window on all four providers, driven over CDP with the window's own network
traffic counted for rounds and tool calls. Claude passed 10 of 12; the other
three providers answered 429 for 33 of 36 questions, which made this the first
run to grade the OFFLINE bot on the whole corpus — 4 of 12. Detail:
`test-results/chatbot-quality/score-2026-09-02-built-in-commands.json`.

Four things this run learned that the next one should not re-derive:

- **The fallback is the product on a bad afternoon.** Every earlier row graded
  a model. On 2026-09-02 a paid key, a second paid key and the free pool all
  died within the hour, and what the volunteer had was `helpBotHelpers` —
  which could report the screen and not touch it. A command layer that needs
  no model is not a convenience; it is what rung 4 ("degrades honestly")
  actually requires.
- **Two rankers disagree, and the corpus one is not the oracle.** The obvious
  fix for the offline bot — answer from the labelled corpus first — ranks the
  lyrics question above the Bible-verse one on the corpus's own starter
  question. Measure a merged score on the held-out set before building it.
- **The research driver has two traps.** The window caps tabs at 12 and
  **New chat** then silently does nothing, so every later question lands in
  the last tab WITH its history (the Claude q11/q12 and all of the ChatGPT
  answers were asked that way before it was caught — close the tabs first).
  And Git Bash rewrites a `/screen` argument to `C:/Program Files/Git/screen`
  unless `MSYS_NO_PATHCONV=1` is set: three paid calls answered "that looks
  like a file path" before that was noticed.
- **A press that types the command is a lesson, not just a button.** The
  square buttons under a command's answer write `YOU /screen-show` into the
  transcript. The next time, the volunteer types it — which is the whole way
  rung 6 will be reached.

**right-page run, in one line.** Driven by a user screenshot and by their own
words — _"get many wrong answers. the assistant help with unrelevant things"_.
The screenshot showed the presenter's own starter chip, **"Is any screen showing
right now?"**, answered correctly and then followed by an eight-step walkthrough
of **W-20 — Show the keys you press (Keyboard Screencast)**. Three independent
defects were behind it, and the run's real product is the measurement that found
them: the 236-question corpus each entry of which names the recipe that answers
it is a **labelled retrieval test set**, and nothing had ever been graded against
it. Detail:
`test-results/chatbot-quality/score-2026-09-01-right-page.json`.

Four things this run learned that the next one should not re-derive:

- **The corpus is a test set, and it was in the repo the whole time.** 236
  questions, each pinned to a `W-xx`, is a labelled evaluation set for
  `owa_help_search` — which has never seen it, so grading against it is not
  circular. It said 57% top-1 on the app's own supported questions before anyone
  had to argue about whether an answer "felt" wrong. Every future retrieval
  change should quote this number, and a **held-out** set (45 paraphrases written
  from recipe titles only) beside it, because the corpus cannot grade a change
  that indexes the corpus.
- **Aggregate top-1 is the wrong headline for "irrelevant answers".** The two
  ranking fixes moved it 57%→59%, which reads like nothing, while removing the
  class the user actually reported: a page from an unrelated subject winning on a
  word fragment. Measure the CLASS — 45 wrong-word pairs, 229 occurrences, 10 in
  a title — and report the per-query delta (9 fixed / 3 broken), not just the
  mean. A mean hides exactly the failure a volunteer remembers.
- **A prefix is not a stem.** `countTerm` matched a four-letter term against the
  start of any longer word, which is right for "verse"→"verses" and wrong for
  "screen"→"Screencast", "copy"→"copyright", "song"→"SongSelect",
  "back"→"background". Ten of those landed in a page TITLE, worth 14 — enough to
  win outright. Three characters is the whole fix and it should have been there
  from the first day the rule was written.
- **Shape is not existence.** `questions.test.mjs` asserted it "points every
  recipe at a real manual id" and only checked `/^W-\d{2}[a-z]?$/`. `W-01b`
  passed that for months while no such page existed — the manual generator's
  heading regex took digits only and silently folded the recipe into W-01,
  carrying off W-01's `verify` rows as it went. Any test whose name claims a
  thing exists must go and look.

A fifth, about this subsystem's verification rather than its content:

- **Neither MCP door shows a `.mjs` edit until its process restarts** — not the
  app's in-process host, and not an already-running stdio server, including the
  agent's own `mcp__owa-devtools__*` tools. Both answered the old ranking while
  a direct import of the same file answered the new one. Spawning a FRESH
  `bin.mjs` over stdio is the cheapest honest check (`scratchpad/stdio.mjs`
  pattern), and it is what proved `owa_help_search "show screen"` returns W-10
  and `owa_help_page {id: "W-01b"}` returns a page. Knowledge is the exception:
  `index.json` is re-read per call, so a rebuild is live at once.

**ask-anything run, in one line.** Driven by a user screenshot with the four
"Try asking" chips circled by hand, and by what they asked for next: a corpus
of supported questions, per page and section, to drive **type-ahead in the ask
box**. Measured before: **8 questions a user could discover** (4 hardcoded per
focus, `STARTER_QUESTIONS`), and a box that suggested nothing. After: **208
questions across 5 pages and 30 sections**, every one drawn from a live-verified
`W-xx` recipe or a live tool, each carrying the recipe / control / menu path /
keystroke / tools that answer it — so a picked question is a lookup, not a search
round. The chips are now the corpus's own `starterRank` (the same four, by
choice, with the panic question next in line), the box ranks and suggests as the
user types, and `owa_list_questions` gives the model the same list. Detail:
`test-results/chatbot-quality/score-2026-09-01-ask-anything.json`.

Three things this run learned that the next one should not re-derive:

- **A suggestion list is a promise, and an unanswerable suggestion is worse
  than none.** That is why every entry is pinned to a `W-xx` or a tool and the
  test asserts it against the REAL corpus rather than a fixture — the files ARE
  the deliverable, and a fixture would grade nothing.
- **Ranking a half-typed question is not the same problem as searching.** Three
  bugs in a row came from treating it as one: a mid-word `startsWith` gave
  "SongSelect will not connect" the full phrase-prefix bonus for `song`;
  scoring a word's aliases as separate words let a query's unmatched words
  slip past the coverage check; and taking the best score ACROSS dimensions
  instead of summing them collapsed "says it and lists it as a keyword" down to
  "says it". Word-boundary beats word-prefix beats substring, one group per
  word the user typed, dimensions summed.
- **A global `starterRank` is not per-page.** Ranking three `common.json`
  questions 1–3 silently pushed the presenter's own opening four down the list
  — the first thing a volunteer ever sees, changed by an edit to a different
  file. Ranks are set per page only, and a test now pins both windows' four.

**out-of-the-way run, in one line.** Driven by a user screenshot with the
minimise button circled by hand: the chat window sat over the middle of the
presenter while its own card told them to press a control behind it. Measured
live before the change — 515×540 over a 1243×837 client area, **25 of 208
named controls (12%) behind it**, and the guide had no way to know. Starting a
walkthrough now minimises that window and closing the card brings it back.
Detail: `test-results/chatbot-quality/score-2026-08-31-out-of-the-way.json`.

Three things this run learned that the next one should not re-derive:

- **The card's corner-dodging stops at the window edge.** `EC-27` taught the
  card to hop away from its own ring, which reads like the whole problem
  solved — and is only half of it. The other window in this feature is an OS
  window the user can drag anywhere, and nothing inside the page can see it.
  Any future "the ring is hidden" report has to ask which of the two is on top.
- **The guide runtime is the only thing that knows, and it can reach nothing.**
  It may not import an app module (that kills every keyboard shortcut), so it
  cannot talk to the main process, which is the only place a window can be
  moved. A `document.dispatchEvent` the app relays is the whole bridge — and
  it must fire on a CHANGE of `isRunning`, because the chatbot starts the same
  guide twice on one press (`EC-30`).
- **`document.visibilityState` cannot tell you a window is minimised.** It
  reads `hidden` for a window that is merely behind another one, which made the
  first three verification passes read as failures and then as successes for
  the wrong reason. The ground truth is the OS: `IsIconic` on the window
  handle. Verify a WINDOW claim against the window manager, never against the
  page inside it.
- **Deleting `window.__owaGuide` leaves the old CARD in the document.** The
  documented way to pick up an edited `guide.mjs` orphans a host element that
  keeps its own click handlers and sits FIRST in document order, so a
  verification script's `getElementById` drives the dead card while reading the
  live one as broken. That, not the product, was the "intermittent restore
  failure" this run chased for five reproductions. The runtime now removes a
  stale host when it installs, and a `2 host(s)` reading is the tell.

**retrieval run, in one line.** Spot-checked the four corpus shapes whose
retrieval was measurably wrong. Two were real failures live: the panic question
answered with _generic hardware advice_ ("make sure the projector is turned on…
check that the cable is securely connected") and the non-native one _guessed_ a
control ("may be labelled something like **Hide Screen**" — the opposite of what
they wanted). Both now diagnose from live state and name the real control. The
other two already passed and were left alone. Detail:
`test-results/chatbot-quality/score-2026-08-31-retrieval.json`.

Two things this run learned that the next one should not re-derive:

- **A symptom is a different question shape from a task**, and the prompt only
  routed the three task shapes ("how do I", "where is", "what does X do") to a
  tool. A volunteer reporting "nothing is showing" matched none of them, so the
  model answered from world knowledge — about hardware it cannot see — while
  `owa_list_screens` sat unused. That is the highest-stakes question in the
  corpus and it was the one with no route.
- **Retrieval could not have fixed it alone.** "the words no come out big screen"
  has no lexical path to the right page even with the filler stripped, because no
  manual page can say whether _this_ screen is showing right now. Symptom
  questions are answered by looking, not by searching — which is why the prompt
  rule, not the alias table, is the load-bearing half of this change.

**menu-steps run, in one line.** Driven by a second user screenshot, one step
further into the walkthrough the previous run fixed: _"Right-click an empty part
of the list … and choose **Download From URL**"_ answered _"I could not do that
one for you (nothing on screen to act on)"_. It was three gaps at once — the
guide could not right-click, the step's target is a REGION with no words on it,
and the step is two actions while the card does one per press. All three shipped;
verified live on the real recipe from a collapsed layout, four presses, ending
with the app's own context menu open and **Download From URL** ringed. Detail:
`test-results/chatbot-quality/score-2026-08-31-menu-steps.json`.

Three things this run learned that the next one should not re-derive:

- **A synthetic `contextmenu` opens the app's real menu**, and the menu is drawn
  from the event COORDINATES — one fired at 0,0 lands in the corner away from
  what it belongs to. Right-click the bottom right _inside_ a list: it fills
  from the top left, so that is its empty part, and right-clicking an item gets
  the item's menu instead, which is a different menu.
- **A second press must aim at what the first revealed**, not re-read the step.
  Re-reading lands on whatever still answers to the step's FIRST label: live,
  after "Background" opened the panel, the second press clicked the
  `Background:` transition button rather than the **Videos** tab it had just
  brought up. `state.pendingFind` is the whole fix and it is not optional.
- **Never auto-click what a press reveals.** It is tempting — the step names it,
  it just appeared — but "click **Delete**, then **Yes**" would confirm its own
  dialog. The card holds the step and says what the next press will do; every
  action stays a press the user made.

Two documentation defects surfaced from the same screenshot, both fixed: the
recipe told users to press a **+** button that does not exist (it is **⋮ More
Options**), and every card quoting a label with a Khmer twin ended in a husk
like _"Download From URL (URL)"_.

**right-target run, in one line.** Driven by a user screenshot: the card said
"Open the Background panel" and ringed the `Background:` **transition** button,
so **Do it** opened the transition menu. Both causes fixed (the collapsed panel
bar was a `div` pretending not to be a button; the matcher broke ties on label
length), and verifying the fix found a worse one a step later — "Ok" matched
inside "lo-**ok**-up", so step 2 rang **Bible Lookup** and demo mode would have
pressed it in front of a congregation. Detail:
`test-results/chatbot-quality/score-2026-08-31-right-target.json`.

Three things this run learned that the next one should not re-derive:

- **Length is not specificity.** The matcher's last tie-break was "shortest
  label wins", which is a proxy for "most specific" and a bad one:
  `Background:` beat `Background Enable Background`. Ranking by whether an
  element is actually NAMED the words is the real question, and it was
  unaskable because `labelOf` joined every name into one blob first — which
  also meant tier 0, "exact match", was unreachable for any element carrying
  both text and a `title`.
- **A wrong ring is worse in demo mode than a missing one.** Every ranking
  loosening has to be judged as "what would **Do it** press?", not "did it find
  something". Both defects here found something confidently.
- **The matcher memoises itself in the page** (`window.__owaDomMatch`), so a
  window that has been driven once keeps the OLD runtime forever. Nothing a
  user can hit; everything a verification run hits. Delete it (and
  `window.__owaGuide`) before believing a live result.

**hover-hidden run, in one line.** Driven by a user screenshot circling the
row of icons above a bible view — controls the app paints only while the
mouse is over them. The matcher had ONE test for being on screen (_does it
have a box?_), and these have one the whole time, so it rang blank space,
reported `isVisible: true` about a button nobody could see, and let
`owa_click` press it invisibly. Now three states, a `showsOnHover` mark on
every answer, and a forced `:hover` — the page's own hover rules re-aimed at
an attribute — held only while the control is being pointed at. Detail:
`test-results/chatbot-quality/score-2026-08-31-hover-hidden.json`.

Two things this run learned that the next one should not re-derive:

- **"Has it a box" is not "can they see it".** 24 controls on the presenter
  are laid out, sized, clickable and painted away; only 13 have no box at
  all. Any visibility judgement that reads a rect is answering the wrong
  question, and `Element.checkVisibility` answers the right one 28x faster
  than the ancestor walk anybody would otherwise write.
- **Force the state, do not move the mouse.** Forcing `:hover` gets the same
  result as a synthetic mouse move and none of its costs: it does not fight
  the user for their pointer, does not land wherever the window has since
  scrolled, and — the part that matters — it STAYS while they read the card,
  where a real hover would end the moment they reached for the button. The
  cascade makes it nearly free: `:hover` and `[attr]` weigh the same, so a
  rewritten rule wins on document order alone, with no `!important` to undo.

**label-i18n run, in one line.** Driven by a user screenshot of a real answer:
`Press F9 (Clear Bible — លុបព្រះគម្ពីរ)`, under a `# W-06 —` heading printed
twice. Three things were wrong at once and only one of them was the model's.
The manual carried every control's name in BOTH languages by hand, so the model
was handed both and passed both on; six of those hand-written Khmer labels had
gone stale against the app (**All Books** was still `គ្រប់កណ្ឌគម្ពីរ` long after
the app moved to `សៀវភៅទាំងអស់`), which nothing could catch because a
hand-written twin has no oracle; and `owa_help_page` prepended a title the page
already opened with. Now a document says `[en:tran:Clear Bible]` and the tool
fills it in with what that key reads as in the language the app is displaying —
one source text, every language, and the label comes from the app's own
dictionary instead of a copy of it. The English window is unchanged except that
it is cleaner; the Khmer window is the one that stops lying. `tran.test.mjs`
walks the whole corpus and fails on a key no language can translate, which is
otherwise invisible: an unknown key falls back to its own English text and looks
perfect right up until a Khmer volunteer reads it. Detail:
`test-results/chatbot-quality/score-2026-09-01-label-i18n.json`.

Columns:

- **Pass** — passed / 12 (or / corpus size), by the all-four rule above.
- **Leaks** — answers containing a path, id, setting key or component name. This
  column should be 0 forever; anything else is the top of the next run's ranking.
- **Median rounds** — tool rounds per answer, from the dev terminal. 1–2 is the
  target; 5+ means the tools are not answering.
- **Tools / Tokens per round** — from the audit script.
- **Rung** — from the ladder in SKILL.md, judged by the WORST answer.
- **Shipped** — what changed, and the `EC-xx` it closes.

## Ratchet rules

- A question that passed in an earlier run and fails now is a **regression**, and
  it outranks every new idea in the next run's plan.
- **Leaks** and **unsafe acting calls** are never traded away for cost or
  capability, whatever else a run is doing.
- A rung is only marked _reached_ when the whole corpus holds it — and it can be
  marked back down when the evidence says so. Moving a rung down honestly is worth
  more than holding one up falsely.

**follow-through run, in one line.** Driven by a user screenshot of four
messages: the assistant offered help, the user said "yes", and the assistant
asked what it could help with. `askLlmBot` took one question and built a fresh
conversation from it, so no answer had ever seen the answer before it — the
tabs and their 60-message history existed entirely for the user to scroll. The
tab's recent turns now go back with each question, bounded to 6 turns / 2400
characters and dropped oldest-first, because the history rides EVERY round of
the tool loop. Verified live on the reported conversation itself: gpt-4o
answered the standing offer, and on the Anthropic path Haiku 4.5 resolved "how
do I turn **it** off?" against the screen it had just reported. Detail:
`test-results/chatbot-quality/score-2026-09-01-follow-through.json`.

Three things this run learned that the next one should not re-derive:

- **A conversation costs per ROUND, not per question.** The tool loop re-sends
  `messages` up to ten times, so an unbounded history is multiplied by ten
  against the user's own key. Bounding it by turns alone is not enough; a single
  long answer is 4 KB.
- **Clip a long turn at BOTH ends.** The offer lives in an answer's last
  sentence, and the offer is exactly what the next message is replying to. A
  head-only clip keeps the part nobody is answering and drops the part they are.
- **The offline bot must not fake a memory it does not have.** Measured before
  building anything: the manual's best match for the word "yes" is the page on
  resetting the app's panels, and the assistant's own offer ("help to show a
  screen") retrieves the page on showing which KEYS you press — while the
  user's own last question retrieves the right page. So it re-asks their
  question, and says out loud that it did.

**stuck-step-rescue run, in one line.** Driven by a user screenshot of the
walkthrough card reading _"I could not do that one for you (nothing on screen to
act on) - do it yourself, then press Skip."_ Honest, and the end of the road for
someone who pressed **Do it** precisely because they did not know what to do —
and 68 of the manual's 251 steps can reach it. The card now asks the assistant
that wrote the walkthrough, which looks at the live window and writes one line
back onto the card. Measured, not eyeballed: `scripts/rescue-failure-rate.mjs` drives the
same step N times and grades each answer against failures that were actually
observed. **1 failure in 12 on GPT-5, median 12s.** One earlier run noticed the
popup had been closed since the guide started and said which button reopens it. Detail:
`test-results/chatbot-quality/score-2026-09-01-stuck-step-rescue.json`.

Three things this run learned that the next one should not re-derive:

- **A prohibition the model can ignore is not a rule — give it a frame the code
  can hold it to.** Told plainly not to report its own looking, Haiku 4.5 still
  opened three answers in four with "I can see the verse …", and one spent its
  whole answer on it. Asked instead for `DO: <instruction>`, with the code
  parsing the marker out and keeping the whole text when it is missing, the
  same model produced five clean imperatives in five. This is `EC-21`'s lesson
  again, one layer up: enforce, do not ask.
- **A rescue is a user turn, not a paragraph of the system prompt.** All of the
  steering — the three shapes a stuck step takes, the four worked examples, the
  character budget — costs nothing on the other 99% of questions because it
  rides the rescue question itself. Growing `genSystemPrompt` for it would have
  been paid for on every round of every question by every user.
- **What the model is TOLD and what the user is SHOWN must be separate.** The
  first live run put the entire machine prompt in the transcript as if the user
  had typed it, and the second leaked the raw `DO:` frame into the chat bubble.
  `shownText` and `formatAnswer` are the two seams that fix it; any future
  auto-asked turn needs both.

A fourth thing, which only the failure-rate harness could have found — and which
the user asked for by name:

- **A rescue must not fall back to the offline manual bot.** On the Anthropic
  tab the rescue failed **10 times out of 10, identically, in 2 seconds**. That
  looks exactly like a bad small model and is nothing of the kind: the account's
  key is out of credit, every call threw, and `handleAsking` did what it is
  supposed to do for a human question — it asked the offline bot instead. The
  offline bot searches the manual, so handed a machine-written rescue prompt it
  matched the words "nothing on screen" and answered _"No presentation screen is
  showing right now. This machine has 1 display(s) available to present on."_ —
  drawn on the card as though it were the answer. A rescue now reports
  `unavailable` when the model cannot answer, and the card's own plain
  instruction stands. Two lessons: an assistant that degrades has to degrade
  toward silence, not toward confidence; and a 100% failure rate is as likely to
  be billing as it is to be the model, so measure the provider before blaming
  the prompt.

**answer-options run, in one line.** Driven by a user screenshot of the assistant
asking _"Would you like help turning one on for the congregation?"_ with no way
to say yes but to type it — then widened by the user to the general rule: every
answer should offer something to press. Before, an answer carried buttons only
when the model happened to read a manual page, so everything answered from live
app state ended in a blank box. Now the model writes two or three replies on an
`OPTIONS:` line the code strips off, with the answer's own trailing question and
then the 208-question corpus underneath it — so an answer with no key, no
network and no model still offers something. Detail:
`test-results/chatbot-quality/score-2026-09-01-answer-options.json`.

Three things this run learned that the next one should not re-derive:

- **A frame the model fills is not a frame the model FORMATS.** `EC-38` proved a
  marker beats a prohibition, and this run found the other half: GPT-5 wrote the
  marker at the end of a SENTENCE, not on its own line, so a line-anchored parser
  printed the whole frame at the volunteer. Parse the marker wherever it lands
  and CUT the line at it. And strip it whether or not it parsed — the leak must
  be impossible, not unlikely.
- **Three sources of buttons is one source too many to be free.** The layers are
  cheap individually and add up on screen: an offline manual answer already
  carries four buttons, and two options under them made six under one paragraph.
  A ceiling on the TOTAL (5) is the rule that holds; per-row caps do not.
- **Live verification found what 30 tests could not, twice.** The inline marker
  and the two near-duplicate follow-ups were both invisible to unit tests written
  from the design, because both were facts about what a real model and a real
  corpus actually produce. Two of the three refinements in this run came from
  looking at the window, not from reading the code.

**no-key-assistant run, in one line.** Asked for by the user from
`awesome-free-llm-apis`: _"is there any api we can use ... when user have no api
keys set we should provide chatbot access as well"_, then _"show warning when
using free one, let user aware of risk"_. Of the 17 providers on that list only
three answer with no key at all, and only two of those can call a tool — which
is the only capability this bot cannot work without. Detail:
`test-results/chatbot-quality/score-2026-09-01-no-key-assistant.json`.

Four things this run learned that the next one should not re-derive:

- **A free model is not a cheap model; it is a differently-broken one.** All
  three defects fixed here are things no first-party API does: a gateway leaking
  `<|channel|>commentary` INTO the function name, a pool that 429s on round 3 of
  a question it was answering correctly, and an English-only rule honoured in
  the prose and dropped in the options line. None were findable by reading the
  code, and none would have appeared on a paid key.
- **Measure the candidate before wiring it, not after.** Grading the corpus
  first is what produced the round cap (6, not 10) and the salvage round; both
  are sized by numbers, not by taste. It also killed OVHcloud, which the list
  presents as a peer of the other two and which 429s while idle.
- **Tool schema is what the free tier actually spends.** ~9 800 tokens of
  schema per round against a ~500 000-token daily allowance means one bad
  question can cost a sixth of a volunteer's day. `EC-02` (pruning the 29
  chrome-devtools tools) stopped being a cost nicety the moment a free tier
  existed — it is now the difference between ~12 and ~35 questions a day.
- **The warning has to survive being scrolled.** It was first written as an
  ordinary paragraph at the top of the log, which meant it stopped warning
  anybody after the first exchange. Sticky, always, for as long as the
  condition holds.

**id-scrub run, in one line.** The standing corpus, re-asked on Claude Sonnet 5
with no user report behind it: every answer right, and the where-is one
opened with a recipe id — the class of leak the prompt has forbidden by name
since the first run. Re-asked after the fix the model wrote the id again, so
the rule that holds is the one in code. Detail:
`test-results/chatbot-quality/score-2026-09-08-id-scrub.json`.

Three things this run learned that the next one should not re-derive:

- **A leak the prompt forbids is a leak until code removes it.** Two answers
  in a row wrote "W-08" from a search hit with "not even in passing" in the
  prompt. The scrub was cheap; the sentence had cost every round for weeks and
  bought nothing on this shape. The pattern is the frames' pattern: strip at
  ONE seam, always, whether or not the model complied.
- **Scrub the SOURCE and the SINK, because the source cannot be scrubbed
  whole.** The excerpt could lose its cited ids; the hit's `id` field is the
  handle the next tool call needs and has to stay. So the window does the
  last read, and it does it with the page TITLE the same tool result carried —
  a replacement that says something is what makes the scrub safe to run on
  every answer.
- **A "small things" bullet is worth measuring before it is dismissed.**
  `EC-89`'s duplicate-reply note read as polish; measured, it was on 7 of 7
  walkthrough answers, one button in four under every multi-step answer this
  window gives.

**starter-chips run, in one line.** The user circled the window's four
_Try asking_ chips and asked for them to be tested and made to work smoothly.
Graded on the assistant that window was set to — Kimi K2.6 on Moonshot's free
tier, not the paid Claude the earlier rows used — and followed through to what
each chip invites, the two how-do-I chips passed and the two song chips failed
on the press a volunteer would actually make. Detail:
`test-results/chatbot-quality/score-2026-09-08-starter-chips.json`.

Four things this run learned that the next one should not re-derive:

- **Grade on the user's own assistant and follow the chip through.** Every
  previous row was Claude Sonnet 5 answering one question. The chips passed
  on that. On Kimi's free tier the SECOND message of the flow the chip starts
  is a 429, and the model-written pill under a draft is what gets pressed —
  neither is visible from a single graded answer on a paid key.
- **A pill that repeats a button is not a duplicate; it is a decoy.** The
  draft echo was the walkthrough echo (`EC-89`) one more time, and the cost
  was higher: the walkthrough pill pressed the same guide twice, the draft
  pill sent the words to a model that then retyped a notation the prompt says
  it may not write. Any new action button needs its echo rule the day it is
  born.
- **"Hand it over whole" is only safe once the reader can read the whole.**
  The instruction was right for the 14 chord pages it was measured on and
  wrong for a hymnal text page, and nobody noticed because both models
  disobey it. Measure the tool on what the models ACTUALLY pass, which is
  their own copy — with a header on top and `from`/`to` around the words.
- **The free tier is a budget of ~3 rounds a minute.** ~11k tokens a request
  against ~32k a minute. `EC-100` files the numbers; the remedies are
  structural (tool routing, prompt caching) and not another description trim.

**own-tools run, in one line.** No user report: the standing corpus, re-asked
on Claude Sonnet 5 with the token usage of every round captured off the wire,
found the two panic shapes regressed — one pressed F5 unasked through a
chrome-devtools tool, the other burned 225 000 tokens on snapshots and gave
no answer — and found that not one of the 813 000 input tokens the twelve
questions cost was cached. Detail:
`test-results/chatbot-quality/score-2026-09-08-own-tools.json`.

Five things this run learned that the next one should not re-derive:

- **Measure the bill on the wire, not with the audit's estimate.** The audit
  script counts ~7 400 tokens of tool schema a round; Anthropic's own
  tokenizer billed ~15 900 for the prefix — tools AND the system prompt, in
  the provider's count. The corpus driver now reads `usage` off every
  response body (`cache_read_input_tokens`, `cached_tokens`), and that is
  the number a cost claim has to quote. An 89% cut is what caching buys on
  a loop whose prefix is byte-identical; the same cut was available since
  the first row of this file.
- **A tool nobody's passing answer ever used is a wrong turn waiting for the
  worst question.** Every score file was grepped: no chrome-devtools tool on
  any passing answer, ever. They were kept "in case", and the case they
  served was a model pressing F5 to make a symptom go away and another
  reading page snapshots to find words that were never there. The developer
  keeps all 48 through stdio; the model gets the app's own 19.
- **"Hiding and clearing" did not say "showing", and the model noticed.**
  The prompt had forbidden unasked changes to the projector since the first
  run — for hiding a screen and clearing content. Turning one ON is the same
  class and was not named, and neither was a key. Name the whole class.
- **A loose match is fine to point at and never to press — on every tool
  that presses.** The card learned it on 2026-09-08 morning (`EC-104`);
  `owa_click` was still pressing `findBest`'s first answer that afternoon,
  and "show screen" found a button that would have put a verse on the wall.
  One bar (`isPressSafe`), every press.
- **A new prompt sentence can mint a new leak.** "Say which one it is"
  produced `(isAnyShowing is false)` twice in two asks. Grade the re-ask as
  hard as the first ask; the scrub for it sits at the same seam as the
  recipe ids, which is where the next shape of this should go too.

**do-it-for-me run, in one line.** The user sent a screenshot of the card
ringing a control through the Bible Lookup popup and asked for every Do it to
be tested. Pressing Do it through all 224 recipe steps found the card refusing
124 and, worse, pressing the wrong control in at least ten of the 92 it
called done. Detail:
`test-results/chatbot-quality/score-2026-09-08-do-it-for-me.json`.

Four things this run learned that the next one should not re-derive:

- **"On screen" is not "reachable".** Every test the matcher had — laid out,
  painted, enabled, `checkVisibility` — said yes about a tab under a popup
  that covers the window. Only hit-testing at the control's own centre says
  what the user can actually see, and a layer the control sits INSIDE is not
  in its way (the Foreground widgets are floating panels; the first version
  closed the panel holding the control).
- **Grade the presses that succeeded, not just the refusals.** The refusal
  count was the obvious number and the wrong one to optimise: the tiers that
  let a ring land near a misspelt step let a click land on the projector's
  Clear All. A press has one bar — the control is called what the step says —
  and a run that reports "done" without the label it clicked is measuring
  nothing.
- **A harness against the running app is rate-limited by the app's own
  firewall.** 25 acting calls a minute across every session; the first two
  runs were throttle errors from the second minute on and read as failures.
  Pace under it, and treat a tool error as a tool error, not a card verdict.
- **Rung 3 was assumed, not measured.** Every earlier row said "it acts,
  reliably" from the recipes a run remembered to try. Measured, the card was
  refusing 55% of presses and mis-pressing a tenth of the rest. The honest
  refusal rate went UP this run, and that is the number to carry forward.

**what-is-on-screen run, in one line.** No user report: the standing corpus
re-asked on Claude Sonnet 5 passed 12/12, so the run followed the panic
shapes THROUGH — pressed the "yes" under them and re-asked them with the
projector actually showing a verse — and found the assistant telling a
volunteer their projector was blank while it showed Verse 2. Detail:
`test-results/chatbot-quality/score-2026-09-09-what-is-on-screen.json`.

Three things this run learned that the next one should not re-derive:

- **A corpus that passes is a corpus that has stopped measuring.** Every state
  question had been graded with the screen OFF, where "nothing is showing"
  is the whole answer and a tool that says only that looks complete. The
  failure was one press away (the "yes") and one state away (the screen on).
  Grade the panic shapes in BOTH states, and follow the offer through, every
  run.
- **"Answered only by inference" is a missing tool, not a prompt rule.**
  The model was told to LOOK and looked at everything the tools offered —
  four `owa_list_ui`s, a help page — and still had to make up what was on
  the screen, because nothing said. The fix was a field, not a sentence; the
  sentence came after, to tell the model to repeat what the field says.
- **A tool answer that names the control is worth six rounds.** The "yes"
  under the panic answer went from eight rounds to three not because the
  matcher improved (`EC-115` is still open) but because the screens answer
  hands over the toggle's exact label, so there is nothing to search for.
  Where a flow always ends at the same control, put its name in the answer
  that precedes it.

**run-sheet-and-trash run, in one line.** No user report: the standing corpus
was re-asked and held its one regression (the wrong-window shape), the
follow-up under _How do I add a song?_ was found guessing a menu item the
app does not have, and the open half of rung 5 (the run sheet) was measured
and shipped. Detail:
`test-results/chatbot-quality/score-2026-09-09-run-sheet-and-trash.json`.

Three things this run learned that the next one should not re-derive:

- **A "passing" answer can be wrong in a place the grader was not looking.**
  Two earlier q06 answers were scored right because they said "go to the
  Presenter first"; they sent the user to a tab the Reader page does not
  have. The route out of a window is a fact about THAT window, and the
  model cannot read it off a manual written for the Presenter — it has to be
  told, per page, in the prompt. Grade the first step of a wrong-window
  answer against the real control, not against its intent.
- **A rule the model ignores twice is a rule for the code.** The
  open-the-page rule was in the prompt and on the tool result and was still
  ignored 3 runs in 4 for this shape. `checkIsStepsWithoutPage` hands the
  answer back once; the prompt fact then made the nudge unnecessary on both
  re-asks, but the net stays up because the next shape that ignores it will
  not announce itself.
- **The follow-up in the same tab is where the manual's gaps show.** Every
  first question in the corpus has a recipe; _and how do I undo that?_ had
  none, and the model filled the gap with six rounds and a guess. When a
  question costs twice the median, check whether the page it needs EXISTS
  before touching the prompt or the ranking.

**stand-in-key run, in one line.** No user report: the run began by asking the
corpus on whatever the help window was SET to rather than on the key an
engineer would pick, and found that the window's own default had been a dead
key for a week. Detail:
`test-results/chatbot-quality/score-2026-09-09-stand-in-key.json`.

Three things this run learned that the next one should not re-derive:

- **Grade on the window's own default first, every run.** Eleven rows of
  this table were graded on Claude Sonnet 5 picked by hand, and the degraded
  path they all said was "honest" was the path every question actually took
  on this machine. The first ask of a run costs nothing when the key is dead
  and tells you which half of the window a volunteer is living in.
- **Degrading honestly is not the same as degrading well.** The note was
  true, the offline answer was often right, and the volunteer still waited
  five seconds to be handed a manual page while a working key sat in the
  next option. A fallback is measured by what it falls back TO, in order:
  another key of the user's own, then the manual.
- **A fix to the offline bot must be re-asked through the window, not only
  through its test.** The Reader lead passed its unit test with plain words
  and missed live on `**Documents** list`, because the manual bolds its
  control names. The offline bot reads the manual as written; so must its
  tests.

**verse-by-reference run, in one line.** No user report: the standing corpus
held, so the run followed the one shape the previous row had left open and
found the app's commonest live ask — a verse by reference — answerable only
in prose, with a "do it" under it that died where a person types. Detail:
`test-results/chatbot-quality/score-2026-09-10-verse-by-reference.json`.

Four things this run learned that the next one should not re-derive:

- **A picker written for a person is not a thing to drive by steps; give
  the ask a door of its own.** Two runs tried to make the card smarter
  about the Bible Lookup and both stopped at the step where the user's
  words go in. The app's own parser and the lookup's own present path
  were one relay away, and the same door serves the model, the `/`
  command and the offline bot. When the recipe's step 2 is "type the
  first letters of the book", the recipe is the wrong tool for a demo.
- **Measure the control words the tools HAND OUT against the press they
  are meant for.** `owa_list_screens` had been answering `Clear Bible
[F9]` since 2026-09-09 and `owa_click` refusing exactly those words the
  whole time (`EC-135`); it only showed when this run pressed them by
  hand. Every label a tool returns for pressing is a test case for the
  matcher, and `checkIsNamedNearly` must strip the same decoration from
  both sides.
- **The `dev` script has no watcher on `tools/`.** Only `electron:dev`
  restarts the app on a tool edit, and an app that outlived its launcher
  holds the single-instance lock, so every relaunch quits at once and the
  host keeps serving the old module. `taskkill` is refused by the
  harness; closing the main window over CDP (`window.close()`) and then
  touching a file under `tools/owa-devtools-mcp/` brings a fresh app up
  through nodemon. `npm run electron:build` alone did NOT kill it.
- **A sibling session's save can take an answer with it.** Vite broadcasts
  a full reload to every window when a changed module has no HMR boundary,
  the chatbot window included, and an ask in flight is gone. A corpus
  question whose last status line stops dead at a file's mtime is not a
  chatbot defect; re-ask it and say so (`EC-150`).

**credit-used run, in one line.** The user's ask, mid-run: the standing
corpus held, and the window had no way to show what any of it cost. Detail:
`test-results/chatbot-quality/score-2026-09-10-credit-used.json`.

Three things this run learned that the next one should not re-derive:

- **A figure the driver reads off the wire is not a figure the user has.**
  Eleven rows of this table carry a cost column, every one read from the
  provider's response body by the research script, and none of it was ever
  on the window. When a measurement is worth a column here it is worth a
  line in the window; the `usage` block is on every round for free.
- **A question about the WINDOW's own state cannot be answered from the
  manual.** _How much has this chat cost?_ opened the recipe and a free model
  read the recipe's example figure back as the answer. Anything that lives
  only in the window — a tab's spend, its tab count, what is in the box —
  needs a `/` command or a field handed to the model on the ask, and the
  recipe must not carry a number a model can quote.
- **The driver's provider pick rewrites the window's default.** Choosing
  _Free_ in the head row to grade the free tier stored _Free_ as what every
  NEW tab starts on, and the next question of the run went to it unasked.
  Pick the default back (`--provider=Claude --model=claude-sonnet-5` on a
  throwaway `/commands`) before the run's last ask, and read the head row on
  every answer.

**spend-guard run, in one line.** The user's ask, mid-run: the standing
corpus held, and nothing in the window could stop a fault from spending the
whole key. Detail:
`test-results/chatbot-quality/score-2026-09-10-spend-guard.json`.

Three things this run learned that the next one should not re-derive:

- **A bound on one question is not a bound on the bill.** Every cap the loop
  had was per ask — rounds, tokens, Stop — and every runaway worth worrying
  about is a bounded ask repeated. The thing that bounds repetition is a
  budget over TIME with a latch that only a person can lift; put it on the
  seam every call goes through, not in the window that happens to call it.
- **A refusal must cost nothing and read as a decision.** The pause answers
  from the offline guide (free), names what happened and the one button that
  lifts it, and is its own error class so the fallback cannot describe it as
  the internet being down or hand the question to a second key. A note is
  plain text: the first draft carried `**Allow more**` and the asterisks
  showed.
- **The research driver is a runaway by the guard's own definition.** Five
  corpus runs in an hour is 150 model calls and the pace cap; `spend-state.mjs
allow` (or `/limit more` in the box) lifts it, and a driver that seeds
  `chatbot-spend-ledger` must reload the window first — the ledger is held in
  memory after the first read.
  | auto-hide | 2026-09-10 | **The user's ask, with a picture: _make those area auto-hide_, then _auto-hide while scrolling_.** A short Track A pass on the window as it opens rather than on the corpus (no answer changes): 630px tall, and the head row (three pickers, CREDIT USED, LIMIT PER HOUR — 67px) plus the ask form (tip, attach row, box, Ask / Report — 72px) took 139px of it, 22% of the window, for controls touched once a session or empty while an answer is read. Shipped: both are bands that tuck away to an 11px handle when the conversation is scrolled 20px in one direction, and come back at their own end of the log (top → pickers, bottom → ask box), under the pointer, with a control of theirs focused (the ask box exempt — it is the autofocus), when they hold something (draft, chips, a refusal, the Report question, suggestions, the spend guard's Allow button), for 1.8 s after anything happens in them, and for good with the 📌 at the end of the pickers; the window's own scroll-to-bottom on a new message does not count. **Reading room 459px → ~585px** with the bands tucked. Verified on the dev window by class and rect for every rule (its screenshots were stale, being covered by the packaged app — `chatbot-cdp-driver-gotchas`) | 0 (no answer changed) | — (no model round spent) | 48 (+0) | unchanged | **easier** — no rung moved; the same window with a quarter more of the answer in view | `EC-160` done. New CB-65, W-42 step 8, `common.json` question, a tip, `autoHideHelpers.test.ts` (+12). **Same day, the user: _I don't want auto-hide for the bottom one_ — the ask form is an ordinary form again and only the head tucks; the zone code stays written for any band.** **And the next morning, 2026-09-11: _please remove all auto-hide feature from the chatbot_ — everything came out, `EC-160` is `reverted`, CB-65 is marked removed; the row stays as the record of a change the user did not want.** |
  | lyric-command | 2026-09-10 | **The standing corpus on the window's own default (Claude Sonnet 5): 12/12 → 12/12**, median 3 rounds, no leak, ≈ $0.29 in all (q01 offers *Put a verse up now*, q06 leads with Go Back to Presenter, q12 on Move to Trash) — measured with the desktop LOCKED, so the time column is the throttled window's, not the chatbot's (q10 first read 95 s for three ordinary rounds), and with the driver's New chat silently no-oping past the 12th tab, so q06/q10 were re-asked clean after closing tabs. Then the shape the ranking put first once nothing regressed — rung 6's *one line, no model* — followed THROUGH on a song page: *Create a lyric file from https://hymnary.org/…* with the assistant PAUSED was searched for in the guide and answered with how to make an EMPTY file (`EC-123`, the idea filed 2026-09-09, now measured); on Claude the same ask took 3 rounds and 17.6 s, and the model drafted the song AND created the file in one breath while the window still drew **Create "…"** under *Done!* (`EC-161`; a second press is a second file); and a third read of the same site came back as its *checking your browser* page, which the drafter turned into a valid song called "Untitled" with a Create button (`EC-162`). Shipped: `/lyric <address>` (`/song` is `/selected`'s alias; the command-list test caught the clash) — the drafter reads the page, the answer is the same report, preview and two buttons, nothing written until Create; `/lyric` over words drafts those; the offline bot drafts a song LINK before the manual (`readSongLinkAsk` → `answerLyricLink`); a successful `owa_lyric_file create` is read off its result into `createdLyric` and the answer carries **Show it in the list** + the file instead of Create; `checkIsBrowserCheckPage` refuses a short page that prints what a bot check prints; the pause and failure notes say *I wrote the song out myself instead* over a draft. **Re-asked live** (after an app restart, the host having cached the old drafter): `/lyric https://hymnary.org/…` → 0 rounds, 3.5 s, six verses, the buttons and the *read a page on hymnary.org* notice; the chip's words under the pause → the same song; *Create a lyric file from these words…* on Claude → created, the chips, no Create; `/lyric` on the bot-check page → *hymnary.org answered with a "checking your browser" page*; `/lyric` over words → Create → *Saved as "Grace Command Run"* | 12/12 | 3 | 49 (+0; 20 to the model, ~6 358 tokens/round) | ≈ $0.29 corpus; song from a page $0 / 3.5 s (was $0.03 / 17.6 s / 3 rounds) | **easier + impressive** — rung 6 reached for a SECOND ask shape (a song page is one line and no model, where the app's own way is the Lyric Editor); rung 4 up a notch (a created file is not offered twice, a bot check is not a song) | `EC-123`, `EC-161`, `EC-162`, `EC-164` done; `EC-163`, `EC-165` filed. New CB-66, CB-48 extended, W-42 step 6, `questions` keywords, memory `chatbot-lyric-command`, 5 test files (+22 cases). Detail: `test-results/chatbot-quality/score-2026-09-10-lyric-command.json` |
  | trace-back | 2026-09-12 | **No corpus run — a reported defect, followed to its root and measured by a census instead.** Reported with a picture: a **Bible View** chip on the ask row of the Bible Reader answering _There is nothing left to show for that one_. Traced live over raw CDP: `selectorOf` returned `null`, and NOT for the depth budget — `selectorPartOf` prefers a naming attribute over a position (a name survives a re-render) and never asked whether the name named ONE thing. The Reader routinely shows two panes carrying `data-widget-name="Bible View"`, and they are **immediate siblings**, `nth-child(1)` and `nth-child(3)` of one parent: both chains came back byte-identical at all 8 steps, every candidate matching 2 elements, because every ancestor they share is literally the same node. The index that separates them was computed at step 0 and discarded. **The census is the finding**: one ambiguous ancestor makes every descendant untraceable too, so **156 of 949 elements in that window had no selector at all** — every control inside either Bible View, not two panes. The chip was the visible tip of it. Shipped: a sibling twin-count — a named part with a twin keeps the name AND adds `:nth-child(n)`, a lone one is left clean so ordinary selectors gain no brittle index; and an element chip whose selector still cannot be built falls back to `owa_find_ui` on its own words before saying it could not find them. **Measured on the shipped runtime in the same live window: 156 → 12 nulls, 144 fixed, 0 broken, 0 mis-targeted**, both panes ringing distinctly (`y: 41` KJV, `y: 440` Khmer) through the real `owa_highlight_selector`. Then the user’s second ask — _add a cautious warning message somewhere about AI bad impact and be carefull while using it_ — answered in the empty state: the window had ONE warning and it was about where the words GO (keyless provider only); nothing had ever said the answer might be WRONG, which is true of a paid key too and is the failure that costs something when a press reaches a projector. Then a third ask on the same picture — _when I click the icon I want to see the confirm message of the warning about AI cautious first, then confirm to open_, scope settled with them as BOTH icons and EVERY press — shipped as one `askAiCaution` confirm in front of every user-initiated route into either window (buttons, Tools, native Help), worded per window because the two risks differ, and **failing open** where no dialog can be drawn so Ctrl+Shift+A does not silently die in Local Web Share and the Lyric Editor. Proven live: both wordings off the real dialog, **Open** opening the chatbot window, **Cancel** on the ✨ leaving the AI Chat window unopened | 0 | n/a (no model asked — the defect is in the page, not the loop) | 50 (unchanged; 24 owa__, 21 to the model) | ~12 459 host, ~6 849 to the model (**unchanged — this run costs the model nothing**) | **3 up** (a control the user pointed at can be rung again, and the 16% of a window that was unreachable now is); **2 up** (a dead end that was true of the code and false of the window now says something true and does something useful) | `EC-172`–`EC-175` done. CB-31 amended, new CB-69 + CB-70, matrix 823 -> **825**. `CLAUDE.md` + copilot mirror, memories `selector-name-with-a-twin` and `confirm-needs-a-popup-host` (+ mirrors), knowledge rebuilt. Tests: domMatch.test.mjs +3 (62 pass) including a control INSIDE one of two same-named panes; new aiCautionHelpers.test.ts (5, incl. the fail-open), commonButtons +4, AppAssistantComp +2 |
  | free-kilo | 2026-09-12 | **No paid-key corpus run -- the keyless provider, measured because it was answering nobody.** Reported with a picture of Free answering *I could not answer that: The assistant service answered 500*. Before: Free's default (LLM7 `gpt-oss`) answered `400 model_unavailable`, so every keyless question fell to the offline guide (the live window: *Free could not answer — Model 'gpt-oss' is currently unavailable..*); LLM7's other model answered 429 after one call; and the 500 in the picture was the app's OWN tool host, printed as a status code. Candidates driven through the real loop (the 21 model-visible tools, read-only tools executed against the live app, six rounds) on seven volunteer shapes: Nemotron Lightning **7/7**, Nex Pro **7/7**, Step Flash 6/7 (one empty answer), `openrouter/free` 6/7 (one raw `<tool_call>` answer), `kilo-auto/free` 4/7 (two empty, one 429, one narrated plan). After, in the same window: **Free / Nemotron Lightning** answered *How do I present a Bible verse?* in 16 s, two rounds, six correct numbered steps, **free · 29k tokens**; a stubbed tool-host 500 answers *The app's own help service did not respond…* in 2.7 s. Raw: `test-results/chatbot-quality/score-2026-09-12-free-kilo.json`. | 0 | 3 (Nemotron Lightning, 7 shapes) | 21 to the model (no tool touched) | unchanged (28 205 chars of schema) | 4 (partly) -- honest degradation: a withdrawn free model no longer strands every saved tab, and the app's own server failing is no longer blamed on the provider | `EC-178`: LLM7 dropped, Kilo-only list of three, `toUsableLlmModel` resets a dropped keyless name, `api.llm7.io` out of the CSP; `EC-179`: `ToolHostError` + `describeAskFailure`; CB-36 amended |
  | foreground-door | 2026-09-11 | **The standing corpus on the window's own default (Claude Sonnet 5): 12/12 → 12/12**, median 3 rounds, no leak, ≈ $0.29 in all (q07/q08 answered with the main window on the Reader — someone at the machine, or something unexplained, switched it back mid-run — and both read that state correctly, q08 naming the 🖥️ Go Back to Presenter route). Then three NEW shapes followed through, each a live-service ask the app's own way makes multi-step. **The countdown was the worst answer of the day**: *Start a 5 minute countdown on the screen* took **8 rounds, 32.6 s, $0.08\** to write four steps (pressing **Foreground** open on the way, unasked), and *Yes, start it now* ran to the \**ten-round cap, 32.6 s, $0.10**, pressed the tab AGAIN — closing it, `owa_click` answering `didChange: false` — and ended on *"Now Foreground is active. Let me look for the countdown controls."*: $0.18, 65 s, nothing on the screen. *Put Blessed Assurance on the screen* selected the song in 4 rounds and asked; the *yes* pressed `Slide 1: First` and then the show toggle, putting a wordless slide on the user's only monitor (`EC-169`). *Set the background to a video* got W-08's steps; its demo's step 2 clicked **Colors** and nothing can double-click a video (`EC-170`). Shipped: **`owa_foreground`** — countdown by minutes or a clock time, stopwatch, clock, marquee top/bottom, quick text; `stop` (`all` = F10) and `check` — the widgets' own setters on the ticked screens, the screens read back, refusals in sentences; `/countdown` (`/timer`), `/marquee`, `/marquee-top`; the offline bot's one-button answer; `stateOf` reads a tab's `active` class; `/clear-*` clears a layer HELD on an off screen and proves it by the layer. **Re-asked: 2 rounds, 7.3 s, one call**, the countdown held and the show button offered; *Put the time on the screen* 3 rounds, 9.4 s; `/countdown 5` 3.3 s, `/countdown stop`, `/marquee` the same; `/clear-foreground` pressed and the check read empty | 0 | 3 (corpus, unchanged); the countdown shape 8+10 → 2 | 50 (+1; 24 owa__, 21 to the model) | ~11 968 → **~12 459** host, ~6 358 → **~6 849** to the model (+491, the six-widget schema and a description trimmed from 1 232 to 1 027 characters) | **6 reached for a THIRD ask shape** (a countdown, clock or message is one sentence, one call, verified on the screen; `/countdown 5` no model); **3 up** (a pressed tab reports its state); **4 up a notch** (a clear command is honest about a held layer) | `EC-166`–`EC-168` done; `EC-169`–`EC-171` filed. New CB-67, W-09 and W-42 step 6, `presenter.json` +1 row and `tools` on 6, memory `chatbot-foreground-door`. Tests: agentForeground.test.mjs (+11, new), agentForegroundHelpers.test.ts (+18, new), builtin +7, helpBot +4, notify +2, progress +1, llmBot +1, domMatch +1. Detail: `test-results/chatbot-quality/score-2026-09-11-foreground-door.json` |
  | mac-tuck-away | 2026-09-12 | **No corpus run -- a window defect reported from a Mac.** Reported with a picture: **Do it for me** minimised every window, the presenter included. Before (dev app, read off the OS window list): walkthrough start → presenter and Settings off screen, help window on; stop → presenter still down. After: start → the help window alone off at ~1 s, presenter on throughout; stop → help window back at ~0.6 s. The press-to-card path was NOT re-driven: with Terminal frontmost the app's renderers ran no timers, every `owa_*` call timed out, and the IPC was sent from the presenter directly | 0 | n/a (no model round) | 50 (+0; 21 to the model) | unchanged (~12 511 host, ~6 901 to the model) | 3 (holds) -- a walkthrough on a Mac no longer takes the whole app down with it | `EC-180`: `detachFromParentWhileMinimised` (macOS only, rejoins on the `restore` event) + 4 tests; CB-09 amended; W-42 step 14 names the Dock; memory `chatbot-cdp-driver-gotchas` +1 |
  | reader-simple-help | 2026-09-22 | **The user's ask for `reader.html`: assume a non-technical older reader.** Four plain questions were searched with `focus: reader`: _The words are too small. Help me._ → the chatbot page; _I lost the Bible verse I was reading._ → the Reader page; _Where do I type John 3:16?_ → Settings; _I want two Bibles next to each other._ → Bible export: **1/4 top-1**. After the Reader manual names the controls in the user's words, the starters ask those problems directly and the query aliases connect _small_, _lost_ and _Bibles_ to the app's terms: **4/4 → W-11**. The full labelled ranker did not buy the four at everyone else's expense: **164/290 → 166/290 top-1; 226/290 → 226/290 top-3**. Live Reader inspection found **Bible Reference** at the top, **Font Size** bottom-left, **Add Extra Bible** beside the version and **Full** bottom-right; `John 3:16` opened and the extra-Bible list opened. The Reader-only prompt now requires respectful, mouse-first help, at most three initial one-action steps, control locations and an explanation of double-click/right-click/drag; a Presenter request is the isolation control. Live provider verification asked _Where do I type John 3:16?_ through Claude / Haiku 4.5 (**$0.02, 28.6k tokens**), ChatGPT / GPT-5 nano (**under $0.001, 23k**) and Kimi / Kimi K2.6 (**price not known, 24.5k**); each stayed on the selected provider with no error or stand-in banner | 0 | n/a (three live calls; rounds not instrumented) | 53 unchanged (24 to the model) | 12 863 host / 7 253 model unchanged; live-call usage recorded at left | **2 up + easier** — the answer starts from the right page and its first small goal is written for the person actually using Reader | `EC-183`, `EC-184` done. New CB-73; W-11 + W-42; four natural Reader starters; help aliases; 163 focused tests pass. Raw: `test-results/chatbot-quality/score-2026-09-22-reader-simple-help.json` |

| reader-do-it | 2026-09-22 | **Followed the senior Reader buttons all the way through, not just the first answer.** The initial _words are too small_ answer became two mouse-first steps and dropped its unrelated Full-view suggestion. Its original Do path first replayed all of W-11, later acted ahead as far as Add Extra Bible, and after that guard was fixed the model produced a one-step hover card aimed at words that were not a control. The explicit safe path now needs no second model round: **Do it for me** raises one Font Size range step, its visible last-step button says **Do it** (it previously said Done and closed without acting), and an actual card click changed **17px → 25px**, completed, and was restored to 17px. A second live ask — _Khmer Bible; typing John 3:16 does not work; use the book and chapter buttons_ — exposed GPT-5 nano asking the senior to read back Khmer. That shape is now local/zero-round online and offline: `Book C:V` becomes Clear input → exact model-book title → Chapter C → Verse V while the visible labels stay localized; live it pressed `43យ៉ូហាន(John)`, localized Chapter 3 and localized Verse 16. Claude Haiku 4.5, ChatGPT GPT-5 nano and Kimi K2.6 keys were each verified live earlier in the same run; Kimi's later rate limit fell back to Claude rather than stranding the user. | 0 for both deterministic Do paths (the preceding ordinary answer remains provider-priced) | n/a | 53 unchanged (27 `owa_*`, 24 model-visible) | 7,355 model tokens/round, below 7,450 ratchet; no warnings | **6 reached for two Reader shapes** — repeatable jobs are exact local actions; **2 and 4 up** — no label-reading request, no dead final button, no acting ahead | `EC-185` / `MC-38` done; CB-74 + CB-75; 314 focused tests pass before final lint. |

| reader-hidden-controls | 2026-09-22 | **Three live senior Reader questions plus the actual two-press action.** _The words are too small_ now says click the visible **⋯**; its first guide press opened the footer without changing Font Size and its second changed the real range by +8. _How do I put two Bible versions side by side?_ named **Add Extra Bible**, with no invented Split view or dead chip. _Khmer Bible; open John 3:16 without typing English_ used the local book → chapter → verse route and now explicitly says the book button is in the Bible's own language. Reloading the earlier screenshots' conversations removed `none`, `Bible Version buttons`, conditional labels and raw `OPTIONS:`. CSS-hover **Split horizontal** was held visible without moving the pointer. The test font size was restored to 17. | 0 for the deterministic Khmer and Do routes; two ordinary GPT-5 nano answers were each under $0.001 | n/a | 53 unchanged (27 `owa_*`, 24 model-visible) | 7,355 model tokens/round remains below the ratchet; live answers used 23.2k and 36.1k total tokens across their tool rounds | **6 holds** — Do it reaches the real control through its prerequisite; **2 up** — every visible chip is actionable and private model frames stay private | `EC-186` / `MC-39` done; new CB-76; W-11 corrected; 349 focused tests pass. Raw: `test-results/chatbot-quality/score-2026-09-22-reader-hidden-controls.json` |

| reader-built-in-demos | 2026-09-22 | **The user's ask: let older Reader users practise common jobs without knowing what to ask or paying for a model.** Before, the empty window offered questions only. Live zero-model follow-through: Font Size 17 → 25 → 17; Khmer John → chapter 3 → verse 16; Bible Find from a panel that remembered Resources. The first search attempt got stuck because the wrong remembered view had no search box; the fixed run selected Find through the named picker, then focused Search verses and completed. | $0; 0 model rounds for all four demos | n/a | 53 unchanged (27 `owa_*`, 24 model-visible) | 7,355 → 7,404 model tokens/round (+49, still below the 7,450 ratchet); no warnings | **6 extended to four Reader practice shapes** — the quickest route is now a visible choice, not a sentence; **3 and 4 up** — deterministic one-step-at-a-time acting and recovery from remembered UI state | `EC-187` / `MC-40` done; new CB-77; W-42 extended; 133 focused tests pass. Raw: `test-results/chatbot-quality/score-2026-09-22-reader-built-in-demos.json` |

| reader-demo-library | 2026-09-23 | **The user's ask, narrowed explicitly to `reader.html`: add 20 important demos to the four-demo shelf.** Baseline: 4 choices and 4 Reader jobs. After: exactly **24 choices and 24 Reader jobs** spanning navigation, people/places, parallel reading, layout, scrolling, study views, filtered search and saved content. Live start sweep: **24/24 cards landed on a real Reader control** after three loose labels found by the first pass were made exact; no answer was asked and no internals could leak. | $0; 0 model rounds for all 24 demos | n/a | 53 unchanged (27 `owa_*`, 24 model-visible) | **7,413 → 7,397 model tokens/round (-16)**; `owa_guide_start` 590 → 574; no warnings | **6 broadened from 4 to 24 Reader practice shapes; 3 up** — important Reader work is one visible, deterministic choice and one guarded action at a time | `EC-188` done; CB-77 and W-42 expanded; focused catalog tests pass. Raw: `test-results/chatbot-quality/score-2026-09-23-reader-demo-library.json` |

| presenter-demo-library | 2026-09-23 | **The user's ask with All Presenter tips capped at 6/6: add the maximum useful Presenter lessons and update MCP support.** After: exactly **56 searchable lessons** — 24 deterministic safe-control walkthroughs and 32 self-guided lessons for documents, live output, backgrounds/media, service planning, help and every native View command. Fresh-process live sweep: **24/24 actionable cards landed on a real Presenter control**; present-slide and Relaunch samples were non-actionable, and no congregation output changed. | $0; 0 model rounds for all 56 lessons | n/a | 53 unchanged (27 `owa_*`, 24 model-visible) | **7,397 unchanged**; `demoId` remains a catalog-validated string; no warnings | **6 broadened from 6 to 56 Presenter practice shapes; 3 up** — safe controls are direct, while risky/stateful work is exact but self-guided | `EC-189` / `MC-41` done; GL-25 and W-46 expanded; 39 focused tests and the 25/25 firewall probe pass. Raw: `test-results/chatbot-quality/score-2026-09-23-presenter-demo-library.json` |

| page-aware-launch | 2026-09-23 | **A reported launch-state defect, not a model-answer run.** With the live main window on `presenter.html`, the restored active chat visibly said **Bible Reader**. After a full chatbot reload against the same saved tab, it said **Presenter** before any question was asked; the accessibility snapshot and screenshot agree. Fresh/restored launch and already-open relaunch are covered separately. | 0 — no answer was generated | 0 model rounds | 53 unchanged (27 `owa_*`, 24 model-visible) | **13,007 host / 7,397 model, unchanged**; no warnings | **2 up + easier** — the assistant starts in the right app context instead of preparing the wrong window's answer | `EC-190` done; new CB-78; W-42 clarified; 40 session tests + 20 Electron popup tests pass. Raw: `test-results/chatbot-quality/score-2026-09-23-page-aware-launch.json` |

| presenter-tip-do-it | 2026-09-23 | **The reported Build a service presenting flow tip failed before opening a walkthrough.** After: unknown and recognized-but-stale show-only host catalogs both retry inline; **51/56 Presenter lessons** start with a safe Do it and mixed lessons advance to an explicit Next step. Fresh-process live proof: build-flow started `isDemo: true`, found its control, performed the click, then reached step 2 as `kind: look`; all five intentionally disruptive/native-menu-only lessons started successfully as self-guided. | $0; 0 model rounds | n/a | 53 unchanged (27 `owa_*`, 24 model-visible) | **7,397 unchanged**; no tool/schema additions | **3 up + resilient** — the lesson starts across renderer/host hot-reload skew and never strands the volunteer on a dead action | `EC-191` / `MC-42` done; GL-25 and W-46 expanded; focused tests and TypeScript pass. Raw: `test-results/chatbot-quality/score-2026-09-23-presenter-tip-do-it.json` |

**lyric-command run, in one line.** The corpus held; the next rung-6 shape was a song page, and following it through found two defects the ONE-answer grading could not see (a file created twice, a bot check drafted as a song).

Three things this run learned that the next one should not re-derive:

- **A "done" from the model is not a done in the window.** The model created the file and said so, and the window still offered to create it, because the buttons are minted off the DRAFT the round before. Anything a tool CREATES has to be watched for in `applyToolWatch` the way a presented passage is (`isActedOn`), or the answer offers the thing again.
- **Read a page three times and the third read is a bot check.** A site that rations its readers answers with an interstitial that is short lines of words — a song, to every heuristic. Refuse the SHAPE before drafting; and a live measurement that reads one page repeatedly should expect the challenge and count it as a finding, not noise.
- **Measure the driver before trusting the row.** Three of this run's numbers were the driver's: a locked desktop throttles in-page timers to one a minute (95 s for three rounds), New chat past 12 tabs lands the ask in the last tab with its history, and a focus pick can fail to stick. Each shows in the record (`tabCount`, `focus`, `roundAtSecs`); read them before grading.

**foreground-door run, in one line.** The corpus held; the next shape a volunteer asks for in a service — a countdown — was one the assistant could only describe, and its "yes" spent ten rounds closing the panel it needed.

Four things this run learned that the next one should not re-derive:

- **Follow the "yes" through, every time.** The first answer to the countdown ask looked like a pass — four right steps, an offer — and graded alone it would have been one. The failure was entirely in the press under it. A shape is measured to the end of what a volunteer would press, or it is not measured.
- **A panel that is a form is a picker.** The Bible Lookup taught it for a verse; the Foreground tab taught it again for a countdown: boxes with a unit for a label, a Start button, a tab that toggles. When the recipe's steps are "open the tab, type in the box, press Start", the recipe is the wrong tool for a demo and the ask needs a door of its own — one door for the whole family, not one per widget.
- **A press-verification that reads "nothing" is worse than one that reads wrong.** `owa_click` had three kinds of evidence and a tab carried none of them, so the model was told nothing was proven and kept going. Every control this app uses as a toggle must answer `isOnNow`; the class is state too.
- **Read the app's pid and page on every answer, not once per run.** The app restarted three times in an hour (nodemon on `tools/`, a sibling session's rebuild) and the main window changed page once with no navigation the driver made. A row measured against an app that is not the one it started with is a row about the driver.
