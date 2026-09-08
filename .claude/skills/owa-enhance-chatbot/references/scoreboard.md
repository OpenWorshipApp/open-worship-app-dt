# Scoreboard — the climb, run by run

"Greater and greater" only means something if it is measured the same way every
time. One row per run of this skill. **Append, never rewrite history** — a row
that got worse is the most useful row in the file.

## How a run scores itself

1. Ask the standing corpus ([research.md](./research.md) Track A) — the same
   twelve shapes, in the same order, presenter and reader.
2. Grade each answer on the scorecard. An answer **passes** only if it is *all* of:
   correct, actionable, leak-free, and offered a walkthrough when it needed one.
   Partly-right is a fail; that is the point.
3. Run `scripts/audit-mcp-tools.mjs` for the cost columns.
4. Write the raw per-question detail to
   `test-results/chatbot-quality/score-<runid>.json` (gitignored, like
   robot-test's coverage files) and the one-line summary here.

Keep the corpus stable so the rows compare. When you ADD a question, add it to
[research.md](./research.md), note it in the row's *Notes*, and never retire one
just because it keeps failing.

## The rows

| Run | Date | Pass | Leaks | Median rounds | Tools | Tokens/round | Rung | Shipped |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| baseline | 2026-08-31 | not yet graded | — | — | 42 | ~8 555 | 2 (partly) | skill created; `EC-01..09` filed |
| retrieval | 2026-08-31 | 2/4 spot-check → 3/4 (+1 ratchet check held) | 0 | not instrumented | 42 | ~8 555 | 2 (partly), rung 5's own test question now passes | `EC-01` + `EC-04` closed; symptom-shape prompt rule; query-side vocabulary aliases |
| guide-acts | 2026-08-31 | demoable manual steps 169/251 → **182/251**; W-06 2/6 → 5/6 | 0 | n/a (no LLM round — a card defect) | 42 | ~8 555 (+0) | **3 up**: demo mode does the step on 13 more steps, incl. the reported one | `EC-15` closed; `owa_guide_start` takes `press`, status gains `canActOnStep`; `EC-16`/`EC-17` filed |
| right-target | 2026-08-31 | W-08 walkthrough: 1/4 steps rang the right control → **2/2 of the steps that name one**; 2 wrong rings → 0 | **1 → 0** (a card showed “(W-08 step 1)”) | n/a (no LLM round — a card defect) | 42 | ~8 633 (+0) | **3 up**: the ring, and so **Do it**, lands on the control the step means | `EC-18`–`EC-21` closed; `EC-22` filed |
| menu-steps | 2026-08-31 | W-21 demo: 0/5 steps completed → **all 4 actionable steps completed**; right-click steps 0 → 5 | 0 | n/a (no LLM round — a card defect) | 42 | ~8 686 (+53, the rightClick description) | **3 up**: demo mode reaches a control inside a menu | `EC-24`, `EC-25` closed; `action: "rightClick"`, region targets, two-press steps |
| parent-path | 2026-08-31 | W-21 step 1 with the panel OPEN: wrong control → **right control**; `owa_find_ui "Background"` rank 1 wrong → right. **Regression caught: `EC-18` (run `right-target`) only ever held with the panel collapsed** | 0 | n/a (no LLM round — a matcher defect) | 42 | ~8 783 (+97, the `Panel > Control` syntax) | **3 up**, and 2 shored up: a step's ring is now right in BOTH panel states, not one | `EC-26`–`EC-28` closed; panes carry `data-widget-name`, matcher reads the parent path, card dodges its own ring, ring animates colour |
| out-of-the-way | 2026-08-31 | walkthrough visibility: **12% of the presenter's named controls hidden by the help window → 0%**; the reported case (a card ringing a control behind the chat window) fixed | 0 | n/a (no LLM round — a window defect) | 42 | ~8 783 (+0) | **3 up**: the control a step rings can actually be seen and pressed | `EC-29` closed; walkthroughs minimise the help window and restore it; `EC-30` filed |
| hover-hidden | 2026-08-31 | controls painted only under the mouse: `owa_find_ui "Copy"` rang blank space and called it visible → rings a **painted** icon and marks it `showsOnHover`; 24 such controls on the presenter, 0 → all of them reachable honestly | 0 | n/a (no LLM round — a matcher defect) | 42 | ~8 857 (+74, what `showsOnHover` means) | **3 up**: the ring, the press and the card now land on something the user can see | `EC-31` closed; `visibilityOf` / `revealHidden` / `releaseHidden`, forced `:hover` instead of a moved mouse |
| ask-anything | 2026-09-01 | discoverable questions **8 → 208** (5 pages, 30 sections), every one pinned to a live-verified recipe or a live tool; the ask box suggests as you type where it suggested nothing | 0 | n/a (no LLM round — a corpus + window change) | 43 (+1) | ~9 179 (+322, `owa_list_questions`) | **2 up**: "what can I even ask?" is answered in the box, and a vague ask has a route that is not a guess | `EC-32` closed; `questions/*.json` + `questionMatch.mjs` + type-ahead; `EC-33` filed |

| label-i18n | 2026-09-01 | app labels shown in the user's own language **0% → 100%** (187 twins templated); labels the manual got WRONG for a Khmer user **6 → 0**; `owa_help_page` leaks (recipe id, duplicated title, `📸`) **3 → 0** | **2 → 0** (the id `W-06`, twice, and the cited `W-10`) | n/a (a corpus + tool-output change) | 44 (+1) | ~9 481 (+302, `owa_tran`) | **2 up**: an answer now names the button the user can actually see, and is written rather than pasted | `EC-34` closed; `en:tran:` label templates + `tran.mjs` + `knowledge/tran.json` + `owa_tran`; `EC-35` filed |
| follow-through | 2026-09-01 | multi-turn questions **0/2 → 2/2** (the reported "yes", and a pronoun follow-up on the other provider); single-turn ratchet held | 0 | 1 (unchanged — no extra lookup) | 44 (+0) | ~9 481 + up to ~600 of conversation, only when there IS one | **2 up**: the assistant can be replied to the way people reply | `EC-36` closed; the tab's recent turns go back with the question, bounded; offline bot stops searching a bare "yes"; `EC-37` filed |
| stuck-step-rescue | 2026-09-01 | a walkthrough step the card cannot do: **apology → usable instruction; measured failure rate 1/12 (8%)** on the reported W-06 step 3, median 12s, reached in six measured corrections and now tracked by `scripts/rescue-failure-rate.mjs` rather than eyeballed. **68 of 251 manual steps (27%)** could reach that apology. Narration **3 in 4 → 0**, projector drift **3 in 3 → 0**, pasted tool labels **4 in 6 → 1 in 12** — each found only by measuring, none by reading the code | 0 | 1 rescue round, only when a step is actually stuck (0 on every other question) | 44 (+0 — no new tool; the card talks over the app's own relay) | ~9 481 (+0) | **3 up**: a walkthrough now survives its own dead ends instead of ending on one | `EC-38` closed; `owa-guide-help` relay card → main → chat → card, `DO:` frame parsed in code, transcript shows the human half; `EC-39`, `EC-40` filed |
| answer-options | 2026-09-01 | answers ending with something to PRESS: **only the ones that happened to read a manual page → every one of them**. Live on GPT-5, 4 answers of 4 carried usable options (3, 3, 2, 2 buttons) and the offline fallback carried one from the corpus. Raw `OPTIONS:` visible to the user **1 → 0** — caught live on the first run and fixed, not by a test | **1 → 0** (the frame itself, inline in a sentence) | unchanged (no extra lookup — the options ride the answer) | 44 (+0) | ~9 481 (+0 tool schema); system prompt +263 chars, **~+66/round (+0.7%)**, paid for by compression | **2 up, toward 5**: the assistant now proposes the next step instead of waiting to be typed at | `EC-43` closed; `OPTIONS:` frame + `quickReplyHelpers.ts` (parse → read the answer → ask the corpus), 5-button ceiling; `EC-44` filed |
| kimi-provider | 2026-09-01 | Kimi answers end to end on a real key: `kimi-k3` and `kimi-k2.6` both gave numbered steps naming real controls; **More models...** returned `kimi-k2.7-code` from the account; a bad model id fell back to the manual reading *"Kimi could not answer"*. Settings rendered in Khmer without blanking. | 0 | 1 (both models answered on the first round after tool calls) | 44 | ~9 492 (+0 — a provider costs no tool schema) | 2 (partly) — **no rung moved; this is reach, not quality**: a third key to fall back on when one provider is rate-limited or out of credit mid-service, which is a rung-4 property once it is measured. | `EC-24`: Kimi (Moonshot) via `askOpenAiCompatible` + a per-provider descriptor; provider set declared once in `LLM_PROVIDER_MAP` (3 silent-misroute ternaries removed); **2 data-loss bugs fixed** (`setAISetting` dropped any key it did not hand-list — a Kimi-only key was deleted by the save that stored it; `getLlmModel[0].id` white-screened the window); AI settings rows now name their own consumers, replacing two hints that omitted the chatbot. New CB-22. |
| right-page | 2026-09-01 | **Retrieval graded on 236 labelled + 45 held-out questions, not on a handful.** Top-1 136/236 (58%) → **140 (59%)**, top-3 179 (76%) → **186 (79%)**; held-out volunteer paraphrases 47% → **51%**. Per-query: 26 top-1 answers changed, **9 fixed, 3 broken**. Questions pointing at a manual page that does not exist **4 → 0**. | 0 | unchanged (no extra lookup — both fixes are inside the one search) | 44 (+0) | ~9 492 (+0 — no tool schema changed) | **2 up, and honestly capped**: the reported class of catastrophically wrong pages is gone, and 41% of supported questions still miss their own recipe — filed as `EC-50`, the reason rung 2 is still not *reached* | Verified live on GPT-5: the reported chip now offers NO walkthrough (it opened no page), while a real how-to still starts W-06 ringing **Bible Lookup**. `EC-47` (a word matched a different word: "screen"→"Screencast", "copy"→"copyright" — 45 pairs, 229 occurrences, cut by a 3-char tail cap; plus IDF-weighted coverage, unsquared), `EC-48` (the walkthrough followed the model's FIRST search forever; now the page it actually opened, and nothing when it started its own card), `EC-49` (`W-01b` was silently folded into W-01 by a digits-only heading regex). `EC-50` filed. New CB-24. |
| show-me | 2026-09-02 | **not graded on answers — this run changed what a question can BE, not how one is answered.** What was measured instead: `selectorOf` against the live presenter, **181 of 181 visible controls got a unique selector, 0 unresolvable**; the picker returned the right control with `probeHits: 0` and no popup opened, so a pointing click provably does not press. `owa_screenshot` returned a real picture of the presenter; the chip read **Setting** (not "Setting Setting") and pressing it put one ring at 1169.33px on a control at 1169px. 39 new tests | 0 | unchanged (attachments ride the question, they do not buy a round) | **47 at the host (+3), 44 to the model (+0)** | **~9 492 (+0)** — measured after: host ~10 022, model ~9 492, the three new tools being client-only; system prompt +3 lines, ~+60/round, paid for by compressing the `owa_find_ui` bullet | 2 (partly) — **no rung marked moved**: the capability is rung-5 shaped, and the window half is not live-verified yet (`EC-59`) | `EC-51` (five ways to attach; bytes never persisted; images out of the history; blind model refused before the call), `EC-52` (add to an answer in flight; drained only where the next round is guaranteed; a Stop gives every word back), `EC-53` (`CLIENT_ONLY_TOOL_MAP` — the choke point `EC-02` wants). New `owa_screenshot` + `owa_pick_element` + `picker.mjs` + `selectorOf`; Presenting Control gains a 📷 with ask/copy/save. Pressing a chip shows what it stands for (ring / preview / reveal), asked for mid-run. `EC-56`, `EC-57`, `EC-58`, `EC-59` filed; `EC-60` (a backtick in a comment inside a template-literal runtime took the whole MCP host to 500 — `picker.test.mjs` is the guard). New CB-26..CB-31. |
| picture-only | 2026-09-02 | **the reported interaction, end to end: a hard provider refusal → a real answer.** An image-only ask sent `{type:'text', text:''}` and was rejected outright; now it asks the question a picture plainly is. Re-run live from a NEW tab with **no history at all** (harder than the report, which had the assistant's own offer behind it): a correct description of the app plus 3 pressable options. Empty text blocks reaching a provider **2 paths → 0** (the user turn, and the model's own tool round echoed back). Offline recovery for a picture-only ask: the generic greeting → a line that says it cannot see pictures and asks for words | **1 → 0** — the raw API validation string `messages: text content blocks must be non-empty` was printed to the volunteer, dressed as their provider being down | unchanged (the fix is in the request, not the loop) | 47 host / 44 model (+0) | ~9 492 (+0 — no schema, no prompt change) | **2 up**: the window can no longer invite a press it then refuses | `EC-61` closed; `toAskedOfModel` as the one decision point, `askLlmBot` refuses an empty ask, the Anthropic loop stops echoing empty text blocks, the offline half degrades honestly. **Also unblocked `llmBotHelpers.test.ts`**, which had been failing to load — contributing 0 of its 47 tests — since the in-flight `free` provider pulled `appProvider` into a node-env suite. 8 new tests |
| no-key-assistant | 2026-09-01 | **the state the app ships in: a fresh install had NO assistant at all → a working one.** Graded the keyless default (LLM7 `gpt-oss`) on 8 corpus shapes through the real 44-tool loop: **7/8 answered, 0 leaks, median 4 rounds**. Live in the real window end to end on two questions. Not equal to a paid key and not sold as one — the warning says so. | **0** in the prose; **1 → 0** in the buttons (a weak model wrote an option in Chinese) | 4 (free models; paid providers unchanged at 1–2) | 44 (+0 — a provider costs no tool schema) | ~9 492 (+0) | **1 up for everyone with no key** — they had rung 0, the offline manual search. No rung moved for a user who already has a key. | `EC-62` closed: `free` provider (LLM7 + Kilo Code, keyless, OpenAI protocol), `keyField` now optional, `IMAGE_CAPABLE_MODEL_MAP.free`. Three free-tier defects found by measuring and fixed: `EC-63` harmony channel markers inside tool names (`toCleanToolName`), `EC-64` round exhaustion (`maxToolRounds`, 10 → 6 for free — the worst question cost 79k tokens for nothing), `EC-65` a mid-loop 429 discarding every tool result already gathered (one tools-less salvage round). `EC-66` non-English option buttons. Standing sticky warning + Settings disclosure. `EC-67`, `EC-68` filed. New CB-32. |
| open-the-page | 2026-09-02 | **the reported press, end to end: a fault report → the window opened and the walkthrough running.** The same **Do it for me**, on the same tab, with Settings shut: the Settings window opens by itself and the card comes up in it. Windows a stuck walkthrough can get the user into **2 of 8 → 8 of 8** (4 opened by the app, 4 explained in their own `howToOpen` words); pages `owa_goto_page` accepts **2 of 3 → 3 of 3**, so the Document Editor crossing the prompt has always promised is no longer refused by the tool. | **1 → 0** (two file names and the open-page list, printed verbatim — and that was the generic path for EVERY failed button press) | unchanged on the button path (no LLM round at all — the press runs the tool itself) | 47 (+0) | ~10 136 → ~10 156 (+20, one more page in the enum and its reworded description) | **2 up, 3 shored up**: a walkthrough that cannot start now ends in the window it needed, not in an apology | `EC-69` closed; `openFind` + `BOT_MAIN_WINDOW_PAGES` on the one declaration, `genPageOpenAnswer` + `canOpenPage`, `describeActionError`; `EC-70` closed too — the SAME two-window hard-coding, in `guide.mjs`: the card opened in Settings still said *"Click the gear (Settings)"*. Windows whose "you are already here" steps get dropped **2 of 8 → 8 of 8**; W-16 in Settings 4 steps → **3**, unchanged from the presenter; `EC-71` filed (a recipe bullet list folds into one ~900-char step, now the OPENING one) |
| right-window | 2026-09-02 | **the reported card, end to end: wrong window and a ring on the wrong control → the right window and the right control.** Reported with a screenshot — the Settings recipe drawn in the Presenter, red ring around a Bible version button. Measured cause, not guessed: `owa_find_ui "English"` answers **3 identical matches in the Presenter and 0 in Settings**, because the Bible key button reads "KJV English KJV" and `English` came out of *"Language: click **English**"*. Recipes that now reach their own window **0 of 44 → 5 of 5 that name one** (all 5 correct; 5 that name several are correctly left alone, 29 that name none are unchanged). Steps offering the card an internal recipe id as a control to ring **3 → 0**. | **1 → 0** (`W-31`/`W-16`/`W-29` were live find candidates, and would have been shown in the "closest labels" line) | unchanged (a card defect — no LLM round) | 47 (+0) | ~10 156 (+0) | **3 up**: a walkthrough now happens where the task happens, so the ring has the right controls to choose from | `EC-72` closed; `detectRecipeWindow` + recipe ids filtered out of `finds`; `EC-73` filed (a second CDP client evicts a card in a popup — it breaks this skill’s own live-verification story) |
| song-from-text | 2026-09-03 | drafting: 0/4 hand-written attempts valid → **4/4 emitted documents valid**, confirmed by open-lyric's own validator | 0 | 1 (was a 3–5 round guess-and-fix loop, or no answer at all) | 48 | 10 936 host / 7 189 model; **this change is +61** (`owa_lyric_validate` 221 → 282, measured on the tool itself — the rest of the delta from the earlier baseline is other in-flight work on `owa_click` and `owa_list_screens`) | **3 up**: the assistant now DOES the thing rather than describing it | `EC-74` closed — `mode: "draft"`, the two answer buttons, the Presenter starter chip; `EC-75` filed |
| press-says-what-it-did | 2026-09-03 | **the reported answer, end to end: "Done — the screen is now showing" with `showingScreenIds: []` → a press that cannot claim that.** Measured on the aim first: `owa_find_ui "Show"` ranked a toolbar-reveal decoration **1st of 4** and the screen's own control 2nd — after the rename the real control is **1st**, proven live. Then on the evidence: `owa_click` answered 0 fields about the EFFECT of a press → `isOnNow` + `didChange` + `unverified`, all three proven live on a real toggle (`Pin document`: `isOnNow` true→false, `didChange` true) and on the very decoration that caused the bug (`didChange: false`, `unverified` set). | **1 → 0** — the leak here was not an internal detail but a false OUTCOME, which is worse: a volunteer told the screen is on stops looking for why it is off | unchanged — the evidence rides the click answer, so the verify rule costs no extra round in the normal case | 48 (+0) | `owa_click` 278 → 411, `owa_list_screens` 58 → 109; **+184/round**, repaid by the first `owa_list_screens` call (~2 800 → 173 result characters). Absolute totals not comparable this run — concurrent in-flight work in the tree | **2 up, 3 shored up**: the assistant stopped being able to report a thing it had not seen | `EC-76` closed; `genClickExpression` reads the control back after the press, `handleAutoHide`'s four decorations renamed out of the word *show*, `ShowHideScreen`'s title through `tran()` (it was hardcoded English), `owa_list_screens` gains `isAnyShowing` and drops Electron's `Display` dump, one prompt rule. `EC-37` (consent, the other half of the same transcript) left open on purpose. New CB-44. |
| song-from-a-page | 2026-09-04 | **graded on 14 real song pages, not on fixtures: valid-AND-right 0/8 → 14/14.** Before, every page drafted a valid document and none of them was the song — menus, view counts, fretboard charts and footers became verses, section labels were swallowed (a four-verse hymn came out as one `Verse`), and every line was broken into the fragments the chord columns cut it into. After, structures match the page's own printed play order (`V1x2Cx2V2x2Cx4B1x6B2x4` on a page that prints exactly that), and key/tempo/time come off the page. Ratchet: the whole `EC-74` paste path re-run unchanged | 0 | 1 (one draft call per page, after one read) | 48 → 48 | ~10 936 → **~11 056** (+120 measured, four optional params on an existing tool; a new tool would have been ~450) | **3** — it acts on a real page and reports the part of it that it used | `EC-76`; `lyricPageText.mjs` + 24 tests, the drafter extended (other scripts' numerals, `(2x)`, `Repeat X`, translation lines, refused Config values), `owa_read_website` whole-page capture + read timeout (it was leaking hidden windows), a fourth Presenter chip and the corpus's first TEMPLATE chip. `EC-77`/`EC-78` filed |
| chords-glued-to-the-words | 2026-09-04 | **the user's own file, quoted back: a verse drafted as eleven lines, each carrying `|D` as text somebody sings.** `EC-76` had assumed a chord site prints `|` and `D` separately; most print `|D` glued, which matched neither pattern and read as a WORD, so the row never joined either. After: the same page drafts four verses of three lines, every chord written where it lands as `|[D]` -- bar OUTSIDE the brackets, because `[|D]` is refused by open-lyric and by our own validator, both probed before the form was chosen. Ratchet: all 14 pages' rules re-run unchanged, 529 tool tests pass | 0 | 1 (one draft call after one read) | 48 -> 48 | ~11 056 -> ~11 056 (**+0** -- no new tool, no new parameter; the whole change is inside the page reader) | **3** -- the draft is something a musician can play from now, not just the words | `EC-79`; `readChordToken` / `splitLeadingChords` / `checkIsGluedPage`, chord marks carried through `rejoinChordSheet`, `toSafeLyricLine` keeps a chord's brackets, `toRegions` carries a song's opening chords without counting them, a credit line no longer takes a translation. `EC-77` half closed. 7 new tests incl. two oracle cases |
| says-what-it-is-doing | 2026-09-04 | **not an answer-quality run — three reported gaps in what the window tells you about ITSELF, all three shipped and driven live.** (1) The wait: one unchanging line for a question that takes ~55s (read a page, draft a song, name-check, create) -> a 5-line log naming each step and what it is working on, finished steps kept and dimmed, exactly one dot breathing. Measured live: `Connecting to the app` / `Thinking about it` / `Checking the projector screens` / `Checking what the app is showing` / `Thinking it over (2)`, cleared on the answer. (2) The tips: random-only -> ordered walk both ways with wrap, random kept on the sentence. (3) The scope: 4 chips of a 184-question corpus reachable -> all 184, grouped by panel, one press. Ratchet: 766 chatbot+tool tests pass, `getStarterQuestions`/`FALLBACK_STARTERS` agreement unchanged | 0 — and this is the run's main risk, so it is TESTED rather than eyeballed: `describeToolStep` maps all 29 model-visible tools by hand and a test fails on an underscore reaching the line, including for a tool added to the server later (it falls back to `Looking something up`, never its own name) | unchanged — nothing here touches the loop's decisions, only what it reports while making them | 48 (+0) | ~11 056 (**+0** — no tool added, no schema touched; the whole change is in the window and the loop's reporting seam) | **2 up, 4 shored up**: a volunteer can now tell a window that is working from one that has hung, and can see what the thing is FOR without guessing — the two ways this window was most often abandoned mid-service | `EC-80`, `EC-81`, `EC-82` closed. `progressHelpers.ts` (+11 tests) with `AskExtraType.onProgress` through both provider loops and `runMcpTool`; `stepChatTip`/`pickChatTip` (+4 tests); `getAllQuestions` + `RenderAllQuestionsComp` (+4 tests); 3 loop-seam tests. New CB-47, CB-46 + CB-17 amended, W-42 step 6 rewritten, corpus gains `what-is-it-doing` and `see-more-tips` |
| built-in-commands | 2026-09-02 | **12/12 asked on Claude Sonnet 5: 10 pass, 2 fail** (q08 put the mini screen "usually top area" — it is bottom right; q09's honest *no streaming* carried walkthrough buttons for the Presenter overview). The same corpus on ChatGPT, Kimi and Free: **every ChatGPT and Free call 429, Kimi 429 from question 2**, so 33 of 36 answers were the OFFLINE bot's — graded **4/12** (the screen's state for a how-do-I, W-21 for "add a song", W-01 for "undo that" and "Facebook", nothing to press on the panic shapes). After: offline q01 → W-06, panic → a *Turn the screen on* button, `/help clear the bible` → W-10; and 13 `/` commands at **0 rounds, ~1.6 s**, the screen proven on and off | 0 (Claude), 0 (offline) | 3 (Claude, 2–5); **0 for a command** | 48 (+0) | ~11 056 (+0 — nothing added to the tool surface; a command is a call the window makes itself) | **4 up, 2 shored up**: with every key dead the window now DOES the thing instead of describing it, and the first evidence for rung 6 — `/screen-show` is faster than the mouse | `EC-83` done (13 commands, `builtinActionHelpers.ts` + 15 tests), `EC-84` half done (two offline-bot fixes + 3 tests); `EC-85`–`EC-90` filed. New CB-48 |
| id-scrub | 2026-09-08 | **11/11 asked on Claude Sonnet 5 correct** (the standing corpus minus the recent-feature shape; q6 from the Reader, q12 in q11's tab), median 2 rounds — and the one where-is answer opened with *"W-08 has exactly what you need"*. Re-asked after: the model wrote the id AGAIN and the window drew *"The guide page “Set the background (color / image / video / web)” is the exact match"*. Duplicate walkthrough replies **7 of 7 → 0** (the Bible-verse answer 4 buttons → 3). Ratchet: q8 *Where is the mini screen?* now right (bottom right — was "usually top area"), the panic shape 2 rounds (was 5), Facebook honest with no walkthrough buttons | **1 → 0** — a manual id in prose, on a corpus question, from a model that had been told twice not to; and the search excerpts had been handing ids over the whole time (page bodies were scrubbed, excerpts were not) | 2 (range 2–6; q12's follow-up 6, `EC-87` still open) | 48 (+0) | ~11 056 (+0 — no schema change; the scrub is in the excerpt text and in the window) | **2 shored up**: an id can no longer reach the answer, whatever the model writes | `EC-92` (+ `EC-22` closed), `EC-89` first bullet; `EC-93`, `EC-94` filed. New CB-50 |
| known-question | 2026-09-03 | **Retrieval graded on all 258 supported questions with a page: top-1 147 (57%), top-3 192 (74%)** — the app's own chips and suggestions got the wrong page two times in five. After: a corpus question routes to its filed page **258/258 by construction**, held-out paraphrases **22/45 → 22/45** (no known-question hit fires on one). Ratchet on the live corpus: the panic chip **5 rounds → 2** (opens W-10 without a search), *Can it stream to Facebook?* **walkthrough buttons for the Presenter overview → none**, on Claude and offline alike. Score floor from evidence: no right top hit in 258 under 6, three wrong ones | 0 | 2 on a picked question (was 2–5) | 48 (+0) | ~11 056 (+0 — one field on one tool result, no schema change); the hint costs ~40 tokens on a picked question only | **2 up**: what the window itself suggests asking is now answered from the right page, with a key or without | `EC-91` done (`findKnownQuestionRecipe`, `findKnownQuestion` / `genKnownQuestionHint`, +8 tests), `EC-85` done (`MIN_HELP_HIT_SCORE`). New CB-49 |
| starter-chips | 2026-09-08 | **The four *Try asking* chips graded on the assistant the user's window was actually set to — Kimi K2.6 on Moonshot's FREE tier — and followed through to what each chip invites: 9 exchanges, 5 pass, 4 fail.** The two how-do-I chips pass clean. The paste chip invites a paste; the paste arrived inside the free tier's minute, was refused (429 ×3 in 3.6 s), and the offline bot searched the manual for sixteen lines of Amazing Grace. When it worked, both draft chips carried model pills (*Create the file*, *Copy the text*) drawn BRIGHTER than the real buttons; pressing one cost 4 rounds, 32 s, three refused creates and an offer to *Overwrite the old one* — the real button took 1.5 s and 0 rounds. And the page chip's instruction to hand a page over WHOLE, obeyed on a hymnal text page, drafted *"Untitled"* with **16 verses of menus** — both models had only produced a song by disobeying it. After: echo pills 4 of 4 draft answers → **0**; a rate-limited paste → the offline bot drafts it itself (3.6 s, same two buttons, Create → *Amazing Grace (3)*); the whole page → title, author, *Public Domain*, the address, six verses (proven live on Kimi, which handed it over whole on the re-run); Claude's own copy → right first time (5 rounds → 4). Kimi also drew a walkthrough card unasked on *How do I add a background?* — the prompt's own *offer … and call `owa_guide_start`* — fixed in the sentence: 2 rounds, no card | 0 in prose; **1 → 0** false offer (*Overwrite the old one*, a thing no tool will do) | 2 (Kimi; the page chip 3–4) | 48 (+0) | ~11 056 → **~11 113** (+57: a `copyright` slot and a mode note on `owa_lyric_validate`) | **3 shored up, 4 up for a paste**: the only path a volunteer would press under a draft now goes through the hardened create, and with the key refused the paste still becomes a song | `EC-95`–`EC-99` done, `EC-88` done, `EC-100`–`EC-102` filed. New CB-51. The drafter's numbered-stanza and page-table readers (+9 tests), `checkIsLyricPaste` / `answerLyricPaste` (+11), `checkIsDraftEcho` (+4), free-name refusal |
| do-it-for-me | 2026-09-08 | **Reported with a screenshot: the Bible Lookup popup open, the card's ring drawn THROUGH it onto a line of Genesis, Do it clicking a tab nobody could see — then "many question fail during Do it".** Measured for the first time by pressing Do it through every step of every recipe (new `demo-failure-rate.mjs`, card only): **224 presses, 92 counted done, 124 refused — and at least 10 of the 92 had pressed the WRONG control** (the projector's *Clear All* for the drawing panel's *Clear*, the help window opened for a bolded *ASSISTANT*), which is worse than a refusal. After: a covered control is closed out of the way first (popup / menu / floating panel; a question the app asks is never answered), only a control called what the step says is pressed (**wrong presses ≥10 → 0**, 33 look-alikes now refused BY NAME), 27 steps that only describe what to see read Next instead of failing, four tour pages start (**recipes that start 33 → 36**), and a 41-character bold no longer eats the next label. Honest refusals go UP (124 → 142) because a wrong press is now a named refusal. The reported flow end to end on Kimi: ring on the popup's ✕, first Do it closes it, second opens the panel, step 2 rings Colors in view | 0 in prose; **≥10 → 0** false "done" presses | 2 on the ask; the button path spends no round | 48 (+0) | ~11 113 → ~11 113 (+0 — the runtime and the matcher are page strings, no schema touched) | **3 up, hard**: "it acts, reliably" was measured for the first time and was not true; what it presses is now what the step names, or nothing | `EC-103`–`EC-107` done, `EC-42` done, `EC-16` narrowed; `EC-108`–`EC-110` filed. New CB-52. guide.test.mjs +9, domMatch `isPressSafe`/`preferPressSafe`, W-12 step 1 renamed to the app's own label |

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
messages — *"for some task the chatbot should not ask the llm api"*, *"add
build action like `/presenter-screen-show`"*, *"so user don't have to ask
llm"* — and measured before it was built: the standing corpus through the real
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
words — *"get many wrong answers. the assistant help with unrelevant things"*.
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
answered with *generic hardware advice* ("make sure the projector is turned on…
check that the cable is securely connected") and the non-native one *guessed* a
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
  manual page can say whether *this* screen is showing right now. Symptom
  questions are answered by looking, not by searching — which is why the prompt
  rule, not the alias table, is the load-bearing half of this change.

**menu-steps run, in one line.** Driven by a second user screenshot, one step
further into the walkthrough the previous run fixed: *"Right-click an empty part
of the list … and choose **Download From URL**"* answered *"I could not do that
one for you (nothing on screen to act on)"*. It was three gaps at once — the
guide could not right-click, the step's target is a REGION with no words on it,
and the step is two actions while the card does one per press. All three shipped;
verified live on the real recipe from a collapsed layout, four presses, ending
with the app's own context menu open and **Download From URL** ringed. Detail:
`test-results/chatbot-quality/score-2026-08-31-menu-steps.json`.

Three things this run learned that the next one should not re-derive:

- **A synthetic `contextmenu` opens the app's real menu**, and the menu is drawn
  from the event COORDINATES — one fired at 0,0 lands in the corner away from
  what it belongs to. Right-click the bottom right *inside* a list: it fills
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
like *"Download From URL (URL)"*.

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
mouse is over them. The matcher had ONE test for being on screen (*does it
have a box?*), and these have one the whole time, so it rang blank space,
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
- A rung is only marked *reached* when the whole corpus holds it — and it can be
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
walkthrough card reading *"I could not do that one for you (nothing on screen to
act on) - do it yourself, then press Skip."* Honest, and the end of the road for
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
  matched the words "nothing on screen" and answered *"No presentation screen is
  showing right now. This machine has 1 display(s) available to present on."* —
  drawn on the card as though it were the answer. A rescue now reports
  `unavailable` when the model cannot answer, and the card's own plain
  instruction stands. Two lessons: an assistant that degrades has to degrade
  toward silence, not toward confidence; and a 100% failure rate is as likely to
  be billing as it is to be the model, so measure the provider before blaming
  the prompt.

**answer-options run, in one line.** Driven by a user screenshot of the assistant
asking *"Would you like help turning one on for the congregation?"* with no way
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
`awesome-free-llm-apis`: *"is there any api we can use ... when user have no api
keys set we should provide chatbot access as well"*, then *"show warning when
using free one, let user aware of risk"*. Of the 17 providers on that list only
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
*Try asking* chips and asked for them to be tested and made to work smoothly.
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
