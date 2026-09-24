# Enhancement backlog — `EC-xx`

Tracked improvements for the chatbot and its MCP tools. **Ids are stable.** When
you finish one, move it to _Done_ with the date and what actually shipped; when
you find something new, add it here even if you do not do it — the next run
should start from the truth, not from a re-discovery.

Status: `open` (real, verified, not done) · `idea` (plausible, unverified) ·
`done`.

Priority order when nothing else is specified: **wrong answers → unsafe acting
tools → cost → capability → polish.**

---

## EC-191 · Presenter Show it could fail or leave a dead Do it — `done` 2026-09-23

The reported **Build a service presenting flow** tip displayed “Could not start
this walkthrough.” A hot-reloaded renderer could know a lesson before Electron's
long-running MCP host did; after the host learned the lesson, its older show-only
copy still offered no **Do it** action. Mixed action/explanation lessons could
also advance to an explanation with a non-working **Do it** button.

**Shipped.** Tips retry an unknown or stale show-only built-in with the current
inline lesson, so no app restart is required. Fifty-one of 56 Presenter lessons
now begin with a safe actionable step. Explanation-only follow-ups are explicit
**Next** steps. Reload, Relaunch, Developer Tools, Widgets, and Reset Widgets
remain deliberately self-guided because automating them would be disruptive or
cannot be addressed through the page. Fresh-process live verification reproduced
the reported lesson as `isDemo: true`, completed its first action, and advanced
to step 2 as `kind: look` with no dead action.

## EC-190 · Launching from the Presenter left ASKING ABOUT on Bible Reader — `done` 2026-09-23

**Reported by the user with the live Presenter and chatbot in one screenshot.**
The main window was `presenter.html`, while the restored active chat still showed
**Bible Reader**. The opener was already readable, but only a brand-new empty
session used it at mount; a restored tab did not visibly follow it until a question
was submitted, and raising an already-open chatbot did not remount React at all.

**Shipped.** Each explicit chatbot launch applies the launching window to the active
tab immediately. A fresh/restored window reads its opener during initialization; an
already-open popup receives the launcher's current pathname from Electron before it
is raised. The launch resets that tab to automatic page following, a manual choice
made afterwards remains tab-scoped until the next launch, and every other tab is
unchanged. Live on the reported state, the same active tab changed **Bible Reader →
Presenter** while the main page remained `presenter.html`. No model call or tool
schema changed. Focused coverage: 40 session tests and 20 popup tests pass.

## EC-189 · Six Presenter tips left most of the Presenter undiscoverable — `done` 2026-09-23

Requested with **All Presenter tips** visibly capped at 6/6. That catalog named
only Bible Lookup and five layout panels; it did not teach documents and slides,
audience screens, backgrounds and media, service planning, app help, or the
native View menu.

**Shipped.** Presenter All tips now has exactly 56 searchable, topic-labelled
lessons. The first 24 are deterministic walkthroughs for safe visible controls;
the other 32 explain state-dependent, native-menu, and live-output work without
presenting, reloading, relaunching, exporting, resetting layout, opening
Developer Tools, or changing congregation output. The shared catalog backs both
Tips of the Day and `owa_guide_start`, while `demoId` remains a runtime-validated
string, so the 50 additions add no tool and no schema enum to every model round.

## EC-188 · Four Reader demos left most important Reader work undiscoverable — `done` 2026-09-23

Requested with the four-demo shelf visible: add 20 more important demonstrations,
for `reader.html` only. The original shelf covered text size, one reference and
one search route; it did not expose passage history, people and places, parallel
reading, layout, scrolling, advanced study views or the saved-content panels.

**Shipped.** The same zero-model shelf now has exactly 24 Reader-only lessons.
The 20 additions cover Previous/Next, clearing a reference, the names/places
lookup and its language, a second Bible, full view, copy, two split directions,
save, auto-scroll/top, both line-layout toggles, Cross Reference,
Location-Name, Resources, the Find book filter and the Bibles/Notes panel.
Every start was checked against the live Reader and lands on a real control;
three initially-loose labels (auto-scroll, scroll-to-top and Should New Lines)
were replaced with the exact accessible words before shipping. No provider is
called. Changing `demoId` from a 24-value enum to a catalog-validated string
reduced the model-visible tool bill by 16 tokens per round instead of growing it.

## EC-187 · Common Reader lessons required a question and a model — `done` 2026-09-22

Requested for older, non-technical Reader users: let somebody learn by following
a demonstration instead of knowing what to ask. Before, the empty Reader chat
offered questions only; even a repeatable demo was special-cased in answer code
or rebuilt by a model.

**Shipped.** The empty Reader assistant now has four large **Try a guided demo**
choices: make words larger, make them smaller, open John 3:16 through book →
chapter → verse buttons, and find Bible text. They call checked-in
`owa_guide_start { demoId }` recipes directly, with no key, network, model round
or provider cost. Live, font size went 17 → 25 → 17; a Khmer Bible opened John
3:16 through its localized visible buttons; and the search lesson recovered from
the panel remembering Resources by choosing Find before focusing Search verses.
The first search run exposed that remembered-tab dead end; the second completed.


## EC-186 · Model metadata became dead buttons and leaked into senior-facing answers — `done` 2026-09-22

Measured in the live Reader: GPT-5 nano emitted pressable `none`,
`Bible Version buttons`, `Split view button (if shown)` and `NIV button on
screen` chips. Pressing them ended at “I could not find … on screen.” A second
answer printed its private `OPTIONS:` line because the model wrote OPTIONS,
NEEDS and SHOWS in an order the two-line parser did not revisit.

**Shipped.** Placeholder, described and conditional control names are never
drawn. A model-authored control chip is kept only when that exact label was
returned by a successful `owa_find_ui` or `owa_list_ui` call during the same
ask; selectors and files keep their existing rules. Stored conversations are
sanitized on load, so the fix removes old dead chips and old private frames
too. The three closing frames are now stripped iteratively in any order without
widening the prose lookback. Live re-asks gave the senior the real **Add Extra
Bible** route, no invented Split view, no dead chip and no visible frame.

## EC-185 · “Do it for me” replayed the wrong Reader task and exposed dead presses — `done` 2026-09-22

Measured live on the Reader after asking _The words are too small_: **Do it for
me** opened W-11 at step 1/7, circled **Bible Reference** and offered to press
it. The user's font-size task was step 2; even there, a recipe demo would click
the visible **Font Size** words rather than move the slider. On a Khmer Bible,
the typed English-reference route was also the wrong default: clearing the box
showed the Bible's own localized book buttons, and book → chapter worked when
the exact button label (`៣(3)`, not its parent tooltip `Chapter 3`) was pressed.

**Shipped.** Walkthrough actions carry the original question as `topic`, and a
broad manual opens on its one matching task instead of replaying the page. A
keyed **Do it for me** first shows that relevant step as a pointer without an
ineffective Do it button, then asks the model to rebuild the demo from the live
localized controls. The guide can set a range value, can explicitly `hover` an
event-driven surface, and already holds CSS-hover-hidden targets visible. The
Reader prompt and W-06/W-11 prefer localized book → chapter → verse for a
non-English Bible, with typed references only as a shortcut. Focused tests pin
topic selection, demo preparation, hover (card and user), and range changes.
The live button found a second path: the model restarted the guide with the
whole manual and interpreted “press each step” by acting immediately; it reached
**Add Extra Bible** before the run was stopped. Recipes are now show-only,
model-built demos must pass explicit live steps, and the preparation ask says
not to press anything yet. Offline help omits the non-working demo button.

The final live follow-through found two more dead ends in that path. First, a
one-step demo labelled its only action **Done** and closed without acting; the
last actionable step now stays **Do it**, with a card-click regression test.
Second, GPT-5 nano answered the non-English reference ask by asking the senior
to read and type back the exact Khmer label. That route is now deterministic
and works offline: an English `Book C:V` is parsed locally and becomes explicit
**Clear input → Book → Chapter C → Verse V** guide steps. Localized book and
chapter buttons carry stable English titles for exact safe matching while their
visible words remain localized. Small-text **Do it** is deterministic too: one
named range step changes the current value by `+8`, so it cannot accidentally
make already-large text smaller. Live, the visible card changed 17px → 25px and
completed; the test setting was restored to 17px.

Fresh live verification then drove the localized sequence against the Khmer
Bible: **Clear input** → `43យ៉ូហាន(John)` → `៣(3)` via the exact **Chapter 3**
title → localized **Verse 16**. A fast driver exposed one final timing race in
the guide's pre-action wait; it is fixed and the Do button is disabled during
the short result pause so an older user's second press cannot repeat the step.

## EC-184 · Reader answers assumed too much computer knowledge — `done` 2026-09-22

Requested by the user for `reader.html`: treat the Reader as a place used by
non-technical older people and make the chatbot smart enough to help them. The
shared prompt already said “not a technical person”, but it did not change the
shape of a Reader answer: it could lead with a shortcut, hand over a long recipe,
name a control without saying where it is, or say “double-click” / “drag” as if
those were self-explanatory.

**Shipped.** The Reader prompt alone now leads with mouse or touch, starts with at
most three one-action steps, uses familiar words, says where a control is, and
explains double-click, right-click and drag the first time. It explicitly requires
respectful language, never childish language. The Presenter prompt is unchanged.
The four opening Reader questions now use the likely problem statements rather
than feature names: where to type `John 3:16`, words that are too small, a lost
passage and two Bibles side by side. Prompt isolation and the four corpus starters
are pinned by tests. Live verification then asked the same plain Reader question
through all three keyed providers: Claude / Haiku 4.5, ChatGPT / GPT-5 nano and
Kimi / Kimi K2.6 each answered through the selected provider with no error or
stand-in banner.

## EC-183 · Plain Reader questions opened the wrong help page — `done` 2026-09-22

Measured live through `owa_help_search`, with `focus: reader`, before changing the
corpus: _The words are too small. Help me._ → W-42 (the chatbot page), _Where do I
type John 3:16?_ → W-16 (Settings), _I want two Bibles next to each other._ → W-33
(Bible export), and only _I lost the Bible verse I was reading._ → W-11. Top-1 was
**1/4** for the most ordinary Reader phrases. W-11 promised these features to the
question corpus but did not name **Font Size** or **Add Extra Bible**, so the
ranker had little true text to find; the generic word “help” made the chatbot page
look unusually relevant.

**Shipped.** W-11 now names and locates **Bible Reference**, **Font Size**, **Add
Extra Bible** and recent references in mouse-first language. Query aliases connect
_small / tiny_ to font size, _lost_ to recent history and _Bibles_ to versions;
generic _help_, _too_, _each_ and _other_ no longer decide a result. A fixed-corpus
test pins all four phrases to W-11. After the rebuilt knowledge index, the live
search result is **4/4 top-1** with no model call and no added model-visible tool.

## EC-182 · A screen answer hands the volunteer a background's FILE name — `open`

Seen 2026-09-18 while verifying `MC-07` / `MC-33` (`owa-enhance-mcp`), asked
_Is anything showing on the projector right now?_ on Claude Sonnet 5 with the
screen off: _"it does still hold content ready to go: a background video
(7_cv.mp4) and a slide from the Peaching document"_. The prompt forbids a file
name in front of a volunteer, and `owa_list_screens` hands the model exactly
that — `background: { kind: "video", name: "7_cv.mp4" }` — with nothing to say
it is a file name rather than a title. The answer was otherwise right (off,
what it holds, the show button offered). Two cheap routes: have the tool say
`name` is the file's name ("the video file 7_cv.mp4" is fine; a bare token in
brackets reads as a code), or add a background clause to the prompt's
state paragraph. Not graded as a failure; filed so the next corpus run looks.

## EC-181 · A provider with no key was a greyed row with nothing to press — `done` 2026-09-14

Reported by the user with a picture of the head row's assistant list open on
**Kimi — needs an API key**, greyed out: _if no api key for the api then still
allow clickable but when click should bring to setting to the input text_. The
row said what was missing and was the one place in the window with no way to
fix it: a disabled `<option>` cannot be pressed, and the way to a key was a
link in the empty state or under a failure note.

**Shipped.** The row is a plain `<option>` marked `data-needs-key` and drawn in
the muted colour. Picking it does not switch the tab (the list is controlled
and snaps back; `chatbot-llm-provider` is untouched): `handleProviderChanging`
re-reads the keys at the press — a key saved in Settings since counts — and
calls `openAiKeySetting(getLlmProviderKeyField(provider))`. The request crosses
windows as a 30-second setting (`src/helper/ai/aiKeyFocusHelpers.ts`), not a
URL parameter: Settings is ONE window found again by its URL
(`getPopupWindowData`), so a parameter opens a second window while the open one
is only raised. `SettingOthersAIComp` takes the request on mount and on window
focus and hands a token to that key's `SettingOthersFieldComp`, which focuses
and centres the input; `SettingComp` turns an open window to Others on the
raise's focus, and drops the request when unsaved Bible edits refuse the
switch. Two things fell out. An ARROW on the closed list, which changes the
value on every press, steps over a keyless row the way it stepped over a
disabled one (`findSteppedProvider`, 4 tests) — without it Settings popped up
under anyone arrowing through the list, and the rows past it were out of the
keyboard's reach. And **Open AI settings** under a refused key carries its
provider, so it lands on that key's box too (a missing workspace id, a busy
service and the keyless pool still open the panel only). The list re-reads the
keys when the window is focused, so coming back from Settings finds the row
plain.

**Verified live** 2026-09-14 on the dev app over raw CDP (the owa-devtools tools
were driving a packaged app started beside it): Settings not open → a new
window with the cursor in **Kimi API Key** 0.9 s after the pick; Settings open
on **General** with the help window in front → the same window came forward,
switched to Others and focused the box in 0.2 s, one Settings window
throughout; the tab and the stored default stayed on Claude. The e2e harness
skips `data-needs-key` rows, since picking one no longer switches.

**Not verified live:** the arrow step-over (unit-tested; a real arrow press
switches providers and rewrites the stored default), the refused-key door (no
provider failure to hand), and a key typed in Settings turning the row plain
(that would have written a key into the dev profile).

## EC-180 · On a Mac, a walkthrough minimised the whole app — `done` 2026-09-12

Reported by the user with a picture from macOS — the help window over the
presenter, **Do it for me** circled — and _when make assistant control then it
minimize the chatbot window, but on Mac it will minimize all windows including
main_.

Cause, read off Electron's own source and two open issues
(electron/electron#26031, #39578): the help window is opened with
`parent: win` (`appTopToMain`), which on macOS makes it an AppKit child
window, and `minimize()` is a bare `[NSWindow miniaturize:]`. A child is not
miniaturised by itself; the parent's group went instead. `EC-29` was built and
verified on Windows, where an owned window minimises on its own.

Measured live on the dev app before the fix, off `CGWindowListCopyWindowInfo`
(page `visibilityState` stayed `visible` throughout and proves nothing): after
the start signal the presenter and the Settings popup were off screen and the
help window on; after the stop the presenter was still down, because the
`restore()` went to a window that had never counted as minimised.

**Shipped.** `detachFromParentWhileMinimised` in `electron/electronHelpers.ts`:
on macOS only, `setParentWindow(null)` before `minimize()`, and the parent set
back on the window's own `restore` event — whoever restores it: the card
closing, the Dock, the 🤖 button — never straight after our `restore()` call,
because Electron attaches a window to its parent only while it is VISIBLE
(`InternalSetParentWindow(parent, IsVisible())`), so a parent set while still
miniaturised is remembered and never attached. A parent closed meanwhile is not
rejoined. The platform is read at call time so a test can pick one; 4 tests.

Verified live 2026-09-12 on the dev app, `all:app:guide-running` sent from the
presenter and the OS window list read every 100 ms: start → help window off at
~1 s, presenter on throughout; stop → help window back at ~0.6 s, presenter on
throughout.

**Not verified: the press-to-card path on the Mac.** With Terminal frontmost
the app's renderers ran no timers — a 50 ms `setTimeout` and a
`requestAnimationFrame` were unsettled after 20 s in the presenter AND the help
window — so every `owa_*` call timed out and a dispatched `owa-guide-running`
never reached the main process; the IPC was sent directly instead. That relay
is unchanged, and it is what moved the windows in the pre-fix measurement.
Re-check with the app in front: **How do I present a Bible verse?** → **Do it
for me** → only the help window goes to the Dock; **✕** on the card → it comes
back above the presenter, and moves with the presenter when that is dragged.

## EC-178 · Free answered nobody: its default service had gone paid — `done` 2026-09-12

Reported by the user with a picture of the Free provider answering _"I could
not answer that: The assistant service answered 500"_, and the ask _fix the
free, if it still [un]usable then remove the free service_. Measured before
anything changed:

- **LLM7's anonymous catalogue now prices every model.** `gpt-oss` — the
  default, "Open GPT" — answers `400 model_unavailable`; `minimax-m2.7`
  called the tool once and then answered 429 on every call; `DeepSeek-V4-Flash`
  wants a key; `mistral-Nemo` refuses tools; `codestral-latest` answered
  without calling one. Asked in the live window on the tab's saved `gpt-oss`:
  _"Free could not answer — Model 'gpt-oss' is currently unavailable.."_ over
  the offline guide. That was every keyless install.
- **Kilo Code's `:free` models, through the real loop** — the 21 tools the
  model sees (~28 KB of schema a round), read-only tools executed against the
  live app, up to six rounds — on seven volunteer questions: Nemotron
  Lightning 7/7 (8–20 s), Nex Pro 7/7 (12–24 s), Step Flash 6/7 (one empty
  answer), `openrouter/free` 6/7 with one raw `<tool_call>` for an answer and
  one 42 s wait, `kilo-auto/free` 4/7 (two empty answers, one
  `TOKEN_LIMIT_EXCEEDED` 429, one plan narrated instead of answered), Nemotron
  Super 3/3 but 33–52 s.

**Shipped.** Free is usable, so it stays and LLM7 goes: `FREE_SERVICE_MAP` is
Kilo alone, the per-model `service` and `getFreeService` are gone,
`api.llm7.io` is out of the chatbot CSP, and the list is Nemotron Lightning
(first choice), Nex Pro, Step Flash — no routers. A test holds every id to
`:free` (an unsuffixed Kilo id is a paid model and refuses an anonymous
request). **As important as the list**: every saved tab and the
`chatbot-llm-model-free` setting still named `gpt-oss`, and taking a name out
of the list does not stop a saved tab posting it. `toUsableLlmModel` puts a
keyless name the list no longer carries back on the first choice — at
`getLlmModel`, at window load (`genInitialSessionState`) and in `askLlmBot`
for every caller — and leaves a keyed provider's off-list name alone (that
one was picked under _More models…_).

Re-asked in the same window after a reload: the head row read **Free /
Nemotron Lightning**, the notice named Kilo Code alone, and _How do I present
a Bible verse?_ answered in 16 s — six numbered steps off the manual, two Kilo
rounds, **free · 29k tokens**, walkthrough buttons under it.

Left open: the list will rot again — both services this provider has used
churned their catalogues inside two weeks. A fall-through to the next listed
free model on `model_unavailable`, or a launch-time probe, would catch the
next one before a volunteer does. Not built: a probe per launch spends the
shared allowance, and a fall-through doubles every failed wait.

---

## EC-179 · The app's own tool host failing printed a status code — `done` 2026-09-12

The 500 in the same picture was NOT the free service. _"The assistant service
answered 500"_ is `mcpClient.ts` reporting the app's OWN MCP host. The
window's console held two 500s from `127.0.0.1:39223/mcp` — the model loop's
`tools/list`, then the offline guide's search, which goes through the same
host — so both answers failed and the outer catch printed the status. On the
path where the guide does answer, the note over it read _"Free could not
answer — …"_: the provider blamed for the app's own server, on the day Free
really was broken for a reason of its own, so the two could not be told
apart. The host answered normally minutes later (a fresh session with the
chatbot's Origin, and the window's own), and the cause was not recoverable:
`host.mjs` logs a failed request to main-process stdout only.

**Shipped.** `ToolHostError` (`mcpClient.ts`) carries a sentence written for a
volunteer — _The app's own help service did not respond. Try again in a
moment; if it keeps happening, restart the app with View → Relaunch in the
main window._ — and its status in `hostStatus`, deliberately NOT `status`,
which `readLlmIssue` would read as a provider 5xx and hand to another key.
`describeAskFailure` in the window says that sentence instead of "<provider>
could not answer", and takes the provider's own trailing full stop off first
(the live note had read _"unavailable.. Here is"_). Proven by stubbing only
the chatbot window's `fetch` to the host with a 500 and asking _Where is the
mini screen?_: the answer was the sentence, in 2.7 s; the stub was removed.
`mcpClient.test.ts` holds the words, the missing `status`, and that a host
that is not running at all stays its own error.

Left open (idea): why the host 500'd. A dev run with no terminal attached
loses the logged error; the last host failure could ride `owa_app_state` or
the discovery file so a Report carries it.

---

## EC-166 · "Start a 5 minute countdown" cost 18 rounds and started nothing — `done` 2026-09-11

Measured 2026-09-11 on Claude Sonnet 5, the standing corpus having held at
12/12. The first answer took **8 rounds, 32.6 s and $0.08** (140k tokens) to
write four steps — `owa_help_search`, `owa_help_page W-09`, two `owa_find_ui`,
`owa_click Foreground` (opening the user's panel unasked), three `owa_list_ui`
— and offered *Yes, start it now*. That press ran to the **ten-round cap in
32.6 s for $0.10** (234k tokens; one `owa_list_ui limit: 200` wrote 9 877
tokens into the cache), pressed **Foreground** again — which CLOSED the panel
it had opened, `owa_click` answering `didChange: false` because a tab keeps
its state in a class (`EC-167`) — hunted the widget's boxes it had just
hidden, and ended on the fragment _"Now Foreground is active. Let me look for
the countdown controls."_ with the corpus fallback _It says the password is
wrong on a file I was sent — what now?_ under it. $0.18, 65 s, nothing on the
screen: the worst answer of the day, for a pre-service ask in nearly every
church and a corpus question since 2026-09-01.

Shipped: **`owa_foreground`** (`agentForeground.mjs` +
`src/helper/agentForegroundHelpers.ts`, the `owa-agent-foreground` relay) —
countdown by `minutes` or a clock time `at`, stopwatch, clock, marquee top /
bottom and quick text by `text`, `stop` (with `all` as F10) and `check` — doing
what the widget's own Start button does on the ticked screens and reading them
back; `/countdown` (`/timer`), `/marquee`, `/marquee-top`; the offline bot's
one-button answer (`readCountdownAsk`); a prompt bullet; the banner, the
firewall's acting set, the wait line, `applyToolWatch`; six corpus rows carry
the tool and one imperative row was added. Re-asked: **2 rounds, 7.3 s, one
call**, the countdown held on the (off) screen and its show button offered;
_Put the time on the screen_ 3 rounds, 9.4 s; `/countdown 5` 3.3 s and no
model. +491 tokens a round (21 model tools, ~6 849).

---

## EC-167 · A pressed panel tab read as "nothing changed" — `done` 2026-09-11

Behind `EC-166`'s second half. `owa_click "Foreground"` on the open Foreground
tab closed the panel and answered `didChange: false` with the _nothing is
proven_ sentence: `stateOf` read `aria-pressed` / `aria-checked` /
`aria-expanded` and `.checked`, and this app's panel tabs (`RendTabComp`,
Bootstrap `nav-link`s) keep their state in the `active` class. It reads
`aria-selected` and a `.nav-link` / `[role="tab"]`'s `active` class now, so a
tab press answers `isOnNow` and `didChange: true`; `domMatch.test.mjs` holds
it. What is NOT done: nothing tells the model beforehand that a tab toggles
(`owa_app_state.tabs[].isActive` says which are open, and the new prompt
bullet says the Foreground tab closes on a second press).

---

## EC-168 · `/clear-foreground` said "nothing to clear" with a countdown held on the off screen — `done` 2026-09-11

Measured the same afternoon: with a countdown and a marquee on the hidden
screen 0, `/clear-foreground` read the screens and answered _The screen is
off, so there is nothing to clear — the projector shows nothing from the app_,
pressing nothing. An off screen HOLDS its layers and shows them the moment it
is turned on; the command judged by `isAnyShowing` alone, written before
`owa_list_screens` carried content. `readScreens` in `builtinActionHelpers.ts`
now carries `clearable` — the Clear labels whose `hasSomething` is true on any
screen — a held layer is pressed whether or not the screen shows (_The screen
is off, so this only emptied what it was holding_), and because a Clear button
is a plain press the click cannot verify, the layer is read back and _Cleared_
is said only when it holds nothing now. Re-asked live: pressed, and the check
afterwards read _No foreground extra is on any screen_.

---

## EC-169 · "Put Blessed Assurance on the screen" turns the screen ON to the song's wordless first slide — `open`, medium

Measured 2026-09-11 with Amazing Grace selected and the screen off. The ask
selected the song (`owa_lyric_file list`, `owa_click "Blessed Assurance"`,
4 rounds, $0.03) and asked _Would you like me to present that first slide?_
with _Show the first verse instead_ beside it; _Yes, put it up_ pressed
`Slide 1: First` (a song's first slide holds no words — `text: null`) and
then **`Toggle showing screen [F5]`**, and answered _The screen is now on,
showing the first slide of Blessed Assurance to the congregation_ — a motion
background and no words, on the user's only display. Two things. The verse
path OFFERS the show button and this path pressed it: the prompt's
selectedDocument bullet says "when they ASKED for it, do it" and nothing about
the screen's power, so the same imperative gets two policies. And "put the
song up" means the first slide WITH WORDS to anyone in a church; the field
could carry `firstWithWords` (or the describer could say _slide 1 is the
title_), and the prompt could say so. Not done this run: the verse door was
the bigger ask, and this one needs a decision about the show button that
should be made once for every acting path.

---

## EC-170 · The background demo's step 2 presses Colors, and no card can double-click a video — `open`, low

_Set the background to a video_ answers with W-08's steps (3 rounds, right).
Its **Do it for me** starts the recipe demo: step 1 clicks the Background bar
(the card reports the tab row's joined label), step 2 — _Pick a tab: Colors /
Images / Videos / Cameras / Webs …_ — clicks **Colors**, the first name in the
sentence, and the recipe's _double-click an item to make it the live
background_ has no `dblclick` action in `guide.mjs` and no `owa_click`
equivalent. A background by ask would need either a double-click action on
the card (and a step that names WHICH tab) or a door like `owa_foreground`'s
(`ScreenBackgroundManager` on the ticked screens by file name). Common enough
to file; not measured against a volunteer's words yet.

---

## EC-171 · The dev app restarts under nodemon on every `tools/` edit, and a second session shares the repo — `open`, low (process)

Three things this run's driver hit. The app was running under
`npm run electron:dev` (nodemon on `electron-build` and
`tools/owa-devtools-mcp`), so every edit under `tools/` restarted it —
killing the help window and any ask in flight, but also loading the new
module without the stale-host workaround `mcp-tool-edit-two-processes`
describes. A sibling session was editing `src/bible-reader/*` throughout and
rebuilt `electron-build/` at 11:11, restarting the app between two of the
driver's asks. And the main window went from the Presenter (switched by the
driver at 10:38) back to the Reader between questions 1 and 7 with no
navigation the driver made — a person at the machine (the help window's
`visibilityState` flipped hidden→visible twice in that span) or something
unexplained; a 90 s watch afterwards saw no flip. Read `owa_app_state.pid`
and the main page on every answer, not once per run.

---

## EC-172 · A pointed-at control could not be traced back, and took its whole pane with it — `done` 2026-09-12

Reported with a screenshot: a **Bible View** chip on the ask row of the Bible
Reader, and pressing it answering **"There is nothing left to show for that
one."** The chip had no `selector`, so `handleShowingAttachment` fell past
every branch to its last line — a sentence that was true of the code and
false of the window, where the pane was sitting in plain sight.

`selectorOf` (`domMatch.mjs`) returned `null`, and the reason was not the
depth budget. `selectorPartOf` prefers a naming attribute over a position
because a name survives a re-render — but it never asked whether the name
named ONE thing. The reader routinely has two panes carrying
`data-widget-name="Bible View"`, and they are **immediate siblings**:
`nth-child(1)` and `nth-child(3)` of the same parent. Measured live, the two
chains were byte-identical at all 8 steps, every candidate matching 2
elements. Walking up can never rescue that — every ancestor they share is
literally the same node, so every longer candidate still matches both. The
index that would have separated them instantly was computed and discarded at
step 0.

The cost was never the pane. One ambiguous ancestor makes every descendant
under it untraceable too: **156 of 949 elements in that window had no
selector at all** — every control inside either Bible View.

Fixed by asking the one question the old code never asked: is this name
unique among its own siblings? A name with a twin keeps the name AND says
which one (`div[data-widget-name="Bible View"]:nth-child(3)`), so the part
stays re-render-proof and becomes unambiguous. A lone named panel is left
exactly as it was, so ordinary selectors do not start carrying a brittle
index they never needed.

**Measured live, same window, shipped code: 156 nulls → 12, 144 fixed, 0
broken, 0 mis-targeted.** Both panes ring distinctly (`y: 41` for the KJV
pane, `y: 440` for the Khmer one). Three tests hold it, including the one
that matters most — a control _inside_ one of two same-named panes.

The 12 that remain are the `MAX_SELECTOR_DEPTH` budget, which is a different
question and not this one.

---

## EC-173 · A chip with no selector dead-ends instead of asking for it by name — `done` 2026-09-12

The other half of `EC-172`, and the half that would have made it survivable.
`selectorOf` can still answer `null` (12 elements in that window, plus
anything inside a shadow-root preview), and the chip's answer for that was a
sentence with nothing to do next.

An element attachment with no selector now falls back to `owa_find_ui` on the
words on the chip — the same second chance an answer's own `SHOWS:` chip
already gets, and code that was already there. It is the last rung of a
ladder rather than a competitor to the selector above it: pointing was how
the user said WHICH one they meant, and a name can land on its twin. It is
offered anyway, because the alternative was nothing. Only when that finds
nothing does the window say so — and it now names what it looked for.

---

## EC-174 · Nothing in the window cautioned against trusting an AI answer — `done` 2026-09-12

Asked for by the user in the same exchange: _add a cautious warning message
somewhere about AI bad impact and be careful while using it_.

The window had one warning and it was about something else: the keyless
provider's notice says where the user's words GO. Nothing anywhere said the
answer might be WRONG — which is true of every provider, including a paid
one, and is the failure that actually costs something here. This app's
assistant can offer a press that reaches a live projector.

A standing caution now sits under the starter chips in the empty state. It
names what going wrong looks like HERE rather than warning about AI in the
abstract — misreading the app, describing a button that is not there, quoting
a verse inaccurately, and offering an action that reaches a projector — and
it closes on over-reliance: _it is here to help you use the app, not to
replace knowing it_. Generic boilerplate is read once and never believed; a
specific one is what makes somebody check.

Placed in the empty state on purpose, and **not** made sticky or foldable:
it is read before the first question, while the user is still deciding what
this window is for, and the first question takes it off screen by itself. It
costs a conversation nothing, so it needs no dismiss button to mislearn —
which keeps it clear of the auto-hide decision recorded in `CLAUDE.md`. It
is bordered on one side rather than boxed, so it outranks the two grey hint
lines it sits with without out-shouting the sticky provider notice above.

---

## EC-175 · Opening an AI window asked nothing first — `done` 2026-09-12

Asked for by the user with a picture of the toolbar, both AI icons circled:
_when I click the icon I want to see the confirm message of the warning about
AI cautious first, then confirm to open_. Scope confirmed with them: **both**
buttons, **every** press.

`EC-174` had put a standing caution inside the assistant window, and that is a
different moment. It is read once the window is up, by somebody who has
already decided to ask; this is the decision itself. The **✨ AI Chat** window
had no caution anywhere at all.

`askAiCaution` (`src/helper/ai/aiCautionHelpers.ts`) is one confirm used by
every user-initiated route into either window: the two toolbar buttons, the
two **Tools** entries (Ctrl+Shift+A included) and the two native **Help** menu
items, which land on the IPC receivers in `domHelpers`. A caution a menu item
walks around is a caution nobody is given. The Presenting Control's _hand this
snapshot to the help window_ is deliberately NOT gated: that press already
carries its own intent, and a Cancel there would strand the snapshot the main
process is holding for the window it was about to open.

**Two sentences of the three are shared and one is not**, because the risks
genuinely differ: the assistant reads THIS app and can offer a press that
reaches a live projector, while the AI Chat window is a stranger's website
where the words leave the machine and nothing knows about this app. One
warning vague enough to cover both would have warned about neither. The
buttons are **Cancel** / **Open**, not a bare Yes.

**The trap, and why this is not a one-liner:** `showAppConfirm` answers
`false` when the window has no popup host mounted, which is indistinguishable
from the user pressing Cancel — and `lwShare` and `lyricEditor` mount none
while still carrying the assistant on Ctrl+Shift+A (only `reader`,
`AppLayoutComp`, `PopupLayoutComp` and `setting` mount `HandleAlertComp`).
Gating on a dialog that cannot be drawn there would have made the shortcut
silently do nothing, which reads as a broken app rather than as a warning. So
it **fails open**: a window that cannot ask is a window that opens.

On the 🤖 the master switch is still asked FIRST — there is nothing to be
careful about in a window that is not going to open, and warning about an
assistant before saying it is switched off is two dialogs to reach one fact.

Verified live 2026-09-12 on the dev Reader: the assistant wording and the site
wording each read back off the real dialog, **Open** opened `chatbot.html`,
and **Cancel** on the ✨ left `aichat.html` unopened. Four new Khmer keys (a
missing one THROWS in dev). Tests: a new `aiCautionHelpers.test.ts` (5,
including the fail-open), `commonButtons` +4, `AppAssistantComp` +2.

---

## EC-177 · An asset could be made but not looked at or kept — `done` 2026-09-12

Asked for by the user, straight after `EC-176`: _as a user I want to always be
able to download assets in chat session. Make sure all assets: files/images
clickable to see preview and on preview has download icon to download the
asset._

A conversation accumulates assets — the user's own screenshot, a dropped file,
the report the window just wrote, the song the assistant just created — and
what a chip DID depended on which kind it was: a picture opened big, and
everything else opened a file-manager window BEHIND the app. So the only asset
a volunteer could look at was the one kind they had usually just made
themselves, and the only way to KEEP any of them was to go hunting in
Explorer. There was no download anywhere in the window except **Save a copy**,
on a picture, inside the one preview that existed.

`assetPreviewHelpers.ts` now owns opening and taking away, and every chip that
stands for an asset opens the same overlay: the picture, the file's words in a
scrollable box, or a card naming what this window cannot draw. Under it:
**Download** (the icon the ask named), **Copy**, and **Open folder** where
there is a file. Three rules, all of them the app's own:

- **Nothing is read until it is opened**, and nothing held after it closes —
  the preview is state on one component, not a map. A chip that quietly read a
  200 MB video to draw a card would be worse than the folder it replaced.
- **Size is asked before content** (`fsGetFileSize` first): a picture over
  8 MB and a text file over 512 KB are measured and named on a card instead,
  with both buttons still working.
- **Download is a copy in Downloads that says where** — `fsCopyFilePathToPath`,
  the app's own `downloadImageBase64Data` for a picture the window holds, or a
  free name for words with no file behind them. A file ALREADY in Downloads is
  revealed rather than copied, because pressing Download twice must not leave
  two reports.

**What a test caught:** the first cut decided "is this text?" partly by
`attachment.kind`, and every file an ANSWER offers arrives typed `text`
(`toShownAttachment`) — video and PDF included. A `.mp4` would have been read
as UTF-8. It is decided by NAME, or by words the window is already holding,
and never by `kind`.

Verified live 2026-09-12 on the dev Reader: the saved report's `.md` opened as
readable text over the conversation; its `.png`, whose bytes were never in the
window, opened as a full picture read off the disk; **Download** on a file
already in Downloads answered _"…" is already in your Downloads folder — I
opened it for you_ and left the folder with two files, not three. The preview
surfaces were repainted onto the window's opaque ground in the same pass — on
the glassy window the first cut let the conversation show through the text.

## EC-176 · A saved report said nowhere to send it — `done` 2026-09-12

Asked for by the user with a picture of the Report button under a box reading
_font-family is too small_: _find email address from `getHelpPageUrl` … then
provide copy-able content and copy-able email address, so user can copy email
address and copy content to send the issue_ — and, while it was being built,
_app auto email sometime out-of-date, use the found email from help page as
primary and from the app as secondary_.

The Send press ended on _saved into Downloads, pass it on however you like_: a
file, and no idea who wanted it. The address was in `package.json`'s `author`
field the whole time, and the live help page named a DIFFERENT one
(`info@openworship.app` against the package's `owf2025@gmail.com`) — which is
the staleness the second ask meant, measured the same afternoon.

Now `findContactEmail` (`src/server/appHelpers.ts`, beside `getHelpPageUrl`)
reads the help page through the same locked-down `main:app:read-web-page`
reader `owa_read_website` uses — the site is a React shell, so a plain fetch
of its HTML sees no address; the rendered words carry it, and the reader keeps
only http(s) links, so `readContactEmailFromPage` parses the text — and takes
the package's address only when the page cannot be read. The lookup starts when
Report is confirmed so it runs beside the investigation, and is remembered ten
minutes for the presses that follow. The Send answer names the address, says
which source it came from, names a `[Open Worship app] <title> (<reference>)`
subject, and offers **Copy report**, **Copy subject** and **Copy picture**
(added the same afternoon at the user's asks _generate email subject as well_
and _for images, give copy-able image to clipboard as well_ — the screenshot
as PNG through `copyImageToClipboard`, now shared with the preview's own
Copy, and read back from Downloads after a reopen), **Copy email address**
and **Email it** (a `mailto:` with address and subject; the report goes on
the clipboard first because mail clients cut a body at ~2 000 characters).
The third ask of the afternoon — _for all images preview in chatbot should
have icon to copy image to clipboard_ — put the same clipboard path on every
picture chip in the window (`RenderCopyPictureIconComp`, ask row and answers
alike, the press stopped so it does not also open the preview or ring a
control) and an icon on the preview's own Copy. All five report buttons are
pseudo tools caught in `handleActing` like Send and carry only
the reference —
**Copy report** falls back to the saved file in Downloads after a reopen and
refuses a reference that is not one. The document opens with **How to send
this** and now also carries the machine line, the selection and run sheet, each
screen's content, the displays, 20 console lines and who investigated.

Verified live 2026-09-12 on the dev Reader with Claude Sonnet 5: two reports
(≈ $0.10 each), _Copied …_ for all four Copy buttons (report, subject, picture,
address), the picture chip's icon flipping to a tick in the ask row and under
an answer without opening the preview, and — after a reload emptied the
in-memory report — **Copy email address** answering `info@openworship.app`
_(from the app's help page)_. **Email it** was not pressed live (it opens the
operator's mail client); its link is unit-tested. W-42 step 9, CB-32 and
`questions/troubleshooting.json` (`report-email-it`) updated with it.

## EC-161 · A song the model created itself was still offered for creation — `done` 2026-09-10

Measured 2026-09-10: asked _Create a lyric file from https://hymnary.org/…_,
Claude Sonnet 5 called `owa_lyric_validate {url}` and then `owa_lyric_file
{create}` itself, answered _"Done! The song … has been created and is already
sitting in your Documents list"_ — and the window still drew **Create
"Amazing grace! (how sweet the sound)"** under it, minted off the draft in
`applyToolWatch`; a press makes a second file beside the first. (The ask was
made in a tab carrying _How do I add a song?_ history; asked again in a clean
tab with pasted words it created the file the same way.) `ToolWatchType`
carries `createdLyric` now, read off a successful create's RESULT (`created`

- `filePath`; a refusal is prose and sets nothing), and the answer carries
  **Show it in the list** and the file — what the Create button's own answer
  offers — and no Create, no walkthrough. Re-asked: the chips, no button.

---

## EC-162 · A site's bot check was drafted as a song called "Untitled" — `done` 2026-09-10

The third read of hymnary.org in a row came back as its _Hold tight…
checking your browser…_ interstitial. Short lines of words are exactly what
a song looks like to the drafter, so it drafted the check as a VALID song
titled "Untitled", and the window minted **Create "Untitled"** and the preview
box under an answer whose text (rightly) said it would not create a file
from that. `checkIsBrowserCheckPage` in `openLyricDraft.mjs` — a page (the
wrapper is the proof), short (≤ 1 500 characters), matching the words a
challenge prints — is refused with `BROWSER_CHECK_TEXT` before anything is
drafted; the offline bot and `/lyric` say _hymnary.org answered with a
"checking your browser" page instead of the song_ (`checkIsBrowserCheckRefusal`,
a prefix pinned to the sentence by a test rather than an import of the
drafter into the renderer).

---

## EC-163 · A model pill offers to open the new song "in the Slide Editor" — `open`, low (pattern `EC-143`)

Under the created song (2026-09-10) Sonnet 5 offered **Open it in the Slide
Editor** and **Change the key or tempo** — presses no tool makes, and the
first names the wrong editor (a song opens in the Lyric Editor). Same class
as `EC-143`; a window-side check on `OPTIONS:` pills against the acting tools
the model has would drop both.

---

## EC-164 · The corpus driver measured three things wrong — `done` 2026-09-10 (process)

Filed so the next run does not re-derive them (also in memory,
`chatbot-cdp-driver-gotchas`): **the 12-tab cap bit again** — from the 12th
tab on, `--new-tab` silently no-ops and every later ask lands in the last tab
WITH its history (q06/q10's re-asks and the song-link asks of this run were
asked that way first; the driver now closes tabs from the END, keeping the
user's own first tab); **a locked desktop is an intensively-throttled page** —
Windows' LogonUI up, both windows `visibilityState: hidden`, in-page timers
firing about once a minute after five minutes, so q10 read 95 s and q11 56 s
for three ordinary rounds and any in-page `setTimeout` in a verification
expression hangs the evaluate; **a focus pick straight after New chat did
not stick** — the Reader-focus questions were asked as Presenter until the
pick was read back and retried.

---

## EC-165 · The first round of a paid ask can read a page before the guard pauses it — `open`, low

Seen while measuring `EC-123`: after `/limit more` restarted the hour, `/limit
0.01` and the chip's ask let round 1 through (ledger $0 < cap), which read the
page; the pause came before round 2 and the offline bot read the page again
— two network reads for one ask. By design (the round that would go over is
the one never posted); noted because a driver that trips the guard to reach
the offline bot must expect one paid round first.

---

## EC-160 · The head row and the ask form covered a quarter of the window while an answer was read — `reverted` 2026-09-11

**Removed whole the next morning at the user's ask** (_please remove all
auto-hide feature from the chatbot_): the head band, its strip, the 📌, the
`chatbot-auto-hide` setting, `autoHideHelpers.ts` and its test, the tip, the
corpus question and the W-42 paragraph. The lesson worth keeping is the
sequence — asked for with a picture, the box wanted back the same afternoon,
the rest the next day: a control that has to be found again is a control in
the way, and in a window used minutes before a service NOTHING should move
on its own. Do not bring it back without being asked in so many words. What
was shipped and measured is left below as the record.

Asked for by the user, with a picture of the window circled: _make those area
auto-hide_, then _auto-hide while scrolling_. Measured on the window as it
opens: 630px tall, the tab strip 33px, the head (three pickers, CREDIT USED,
LIMIT PER HOUR) 67px, the ask form (tip line, attach row, box, Ask / Report)
72px — 139px of furniture that is touched once a session or is empty while
an answer is being read, over a log of 459px. Shipped: both are `.chat-zone`
bands (`src/chatbot/autoHideHelpers.ts`, `ChatbotAppComp.tsx`, `.scss`). A
scroll of the log covering 20px in one direction tucks both to an 11px
handle with a grip (the log grows to ~585px); arriving at the top brings the
pickers back, at the bottom the ask box; the pointer over a band or its
handle, a control in it with the keyboard (the ask box exempt, since it is
the autofocus), anything the band holds (draft, chips, a refusal, the Report
question, suggestions, the spend guard's Allow button), and a 1.8 s grace
after the last thing that happened in it bring one back; the window's own
scroll-to-bottom on a new message does not count as reading. A 📌 at the
right end of the pickers keeps both in view (`chatbot-auto-hide`, unset =
on). Verified on the dev window by class and rect for every rule (the
window was covered, and its screenshots were stale — `chatbot-cdp-driver-
gotchas`). Tests: `autoHideHelpers.test.ts` (12). New CB-65, W-42 step 8, a
question in `common.json`, a tip.

**Then the user changed their mind about the bottom half the same day:**
_I don't want auto-hide for the bottom one._ The ask form is an ordinary
form again — the box the next question goes in has to be where it was, not
brought back first — and only the head is a band; the zone code stays
written for any band. Documented as such in W-42, CB-65 and the tip.

Left open in the same area: the head is tucked by ANY scroll of 20px,
including the arrow keys' — right by the rule, not measured with a person.

---

## EC-158 · An unusual answer from a provider came with no door to it, and an empty Anthropic account was never stood in for — `done` 2026-09-10

**Asked for by the user**, in their own words: _if there any unusual
response from api then give buttons for user to go to the api dashboard.
e.g. Claude ai dashboard if got message of no credit available_. Measured
first through the real window (`score-2026-09-10-provider-door.json`), on
the ChatGPT key that has been out of credit since `EC-83`: _Is anything
showing on the projector right now?_ asked on ChatGPT was answered by the
Claude stand-in (`EC-144`) under _"ChatGPT could not answer — the AI
account is out of credit or being rate-limited"_ — with the provider's body
saying `insufficient_quota` in plain sight — and the row under it held
_How do I turn it on?_ / _Never mind_ / _Copy_: nothing that took the user
to the account that was empty. Two defects behind one symptom:

- **The window read only the HTTP status**, and a status is not enough. An
  OpenAI 429 is an empty account (`insufficient_quota`, now also
  `credit_balance_exhausted`, and the three spend limits) as often as a
  rate limit; a Kimi 429 is `exceeded_current_quota_error` (empty),
  `rate_limit_reached_error` or `engine_overloaded_error` (the service's
  fault); an Anthropic 429 is a rate limit or the tier's monthly spend cap.
  So the sentence hedged, and no button could be chosen from it.
- **An empty Anthropic account is a 402 (`billing_error`), or a 400
  `invalid_request_error` whose only clue is "Your credit balance is too
  low"** — and `checkIsProviderFault` was 401/403/429/5xx, _never a 400_.
  A dead Claude key with a live ChatGPT key one option along fell straight
  to the manual; `EC-144` had measured the other direction only. Read off
  the providers' own error pages that day (Anthropic, OpenAI, Kimi), not
  remembered.

**Shipped:** `src/chatbot/providerIssueHelpers.ts`. `readLlmIssue` reads the
body as well as the status — every place a code or type can sit in the three
SDKs' error objects, plus a body left only in `error.message` parsed back
out — into a KIND (`noCredit`, `badKey`, `rateLimited`, `quotaOrRate` for a
429 that said nothing more, `overloaded`, `serverTrouble`, `modelMissing`,
`workspace`, `unreachable`, `other`); `checkIsProviderFault` and
`describeLlmError` are written over it (a code outranks the status it
arrives under, so a 400 saying "credit balance" is an empty account and
stood in for; a plain 400 stays the request's own; the provider's own short
sentence is lifted out of a raw body rather than replaced by "error 400").
`genProviderIssueActions` turns the kind into buttons named for the
provider that FAILED — _Open ChatGPT billing_; _Open AI settings_ + _Open
Claude API keys_; _Open Kimi usage limits_; both doors for a bare 429; the
status page for a busy service; the settings panel for the keyless provider
— as two pseudo tools caught in `handleActing` (registered nowhere, like the
report's Send), where **a button carries a provider and a page NAME and the
address is resolved at the press** out of `PAID_PROVIDER_PAGE_MAP`, the one
table of console pages, which Settings' _Get key_ buttons now read too
(they had drifted: `console.anthropic.com` redirects to
`platform.claude.com`, OpenAI's keys page moved under the organisation
settings). The press opens the page in the browser and says so in the
transcript. They ride the stand-in note, the offline-fallback note, a
rescue's one line and the report's _I could not look into it_.

**Verified live 2026-09-10** on the same dead ChatGPT key: _"ChatGPT could
not answer — the AI account is out of credit. Claude answered instead…"_
with **Open ChatGPT billing** first in the row (3 rounds, 4 s, the head
row moved to Claude as before); the press wrote _Opening
https://platform.openai.com/settings/organization/billing in your
browser._ and the page opened. Screenshot
`test-results/chatbot-quality/score-2026-09-10-provider-door-window.png`.
Tests: providerIssueHelpers +19 (new, every documented shape of all three
providers), llmBotHelpers +5 (a 402 and a credit-balance 400 stood in for,
the sentences), two rewritten (a fake that carried the dead-account body
under a 400 now carries a real bad request).

**Left open as `EC-159`:** Kimi documents no billing or limits page, so
both of its doors are the console home; and the model-picker's _More
models…_ failure (`listAllLlmModels`) still shows the sentence with no
button — it is drawn in the picker, not in a message.

---

## EC-159 · Kimi's money doors are the console home, and a failed More models… has no door — `open`, low

`PAID_PROVIDER_PAGE_MAP.kimi.billing` and `.limits` are
`https://platform.kimi.ai/console`: Kimi's account-and-payments guide names
a project budget page, an invoice page and a profile page and no
recharge or balance page, and a guessed deep link is worse than the front
door when it is wrong. Re-check the guide when a Kimi key is next measured
out of credit. Separately, `listAllLlmModels` throws `describeLlmError`'s
sentence into the model picker's hover with no button; the kinds that
carry one (a refused key, an empty account) would be worth a chip there
too.

---

## EC-155 · Nothing stopped a runaway from spending the whole key — `done` 2026-09-10

**Asked for by the user**, mid-run, in their own words: _as a user I don't
want to mistakenly stuck in an infinite loop of programmatically error that
eat all my credit or flooding bill. add a token-over-use prevention for me_.
Measured first, as every run must: the standing twelve on the window's own
default (Claude Sonnet 5) were 12/12, median 3 rounds, about $0.29 in all —
and NOTHING in the window bounded what a fault could spend. The two things
that did exist bound one question (`MAX_TOOL_ROUNDS`, ten rounds) and one
person (Stop); a window re-asking on every render, a card rescuing the same
step for ever, a crash-and-relaunch loop, or a script driving the window
asks a perfectly bounded question and then asks it again, and `EC-152` had
just made the bill VISIBLE without making it stoppable.

**Shipped:** `src/chatbot/spendGuardHelpers.ts` — a circuit breaker with a
latch. A rolling-hour ledger of every model round (tokens, list-price cost,
or null for an unpriced model), written through to `appLocalStorage` so a
reload or relaunch arrives already paused; a **money cap** the user sets
(`chatbot-spend-limit`, default $1 an hour, a **Limit per hour** picker
after MODEL in the picker row — beside CREDIT USED until 2026-09-11 —
`/limit 2` / `/limit off`) and a fixed **pace cap** of
150 model calls an hour that holds whatever the money cap says — the one
thing that protects a free or unpriced model, which the money cap cannot
see. Enforced on the ONE seam every model call goes through: `askLlmBot`
wraps `onUsage` so every round is recorded whoever the caller is (the
window, the report, a rescue), and both provider loops call
`throwIfSpendLimitReached()` beside `throwIfCancelled()` BEFORE a round is
bought — so the round that would go over is the round that is never posted.
At the cap the latch sets and stays set until a PERSON presses **Allow
more** (a pseudo tool the way the report's Send is, `SPEND_ALLOW_TOOL_NAME`;
in the pause note, in the head row, and as `/limit more`), which restarts
the hour and re-asks the question with no second echo; time passing never
lifts it, and neither does a restart. A pause is its own error class
(`SpendLimitError`) so `describeLlmError` cannot read it as the internet
being down and the stand-in cannot hand the runaway a second key; the
window answers the question from the offline guide under the pause note,
because saying no must cost nothing. Past four fifths of the cap the head
figure turns amber and the answer that crossed carries a one-time
_Heads-up_ (`takeNearLimitNotice`); `/credit` carries the hour line.

**Verified live 2026-09-10** through the real window: the ledger seeded with
$0.21 of prior spend and read back after a reload (*$0.21 over 5 model
calls*); the cap set to $0.25 through the picker (figure amber); ONE real
question paid its first round (a $0.04 cache write), was paused before its
second and answered from the guide under the pause note with **Allow more**,
the head row reading _paused · ≈ $0.25 this hour*; the press wrote *Carrying
on: the hour starts again from now, with $0.25 available…_ and Claude
answered the re-asked question (3 rounds); `/limit`, `/limit 0.05` (a value
the picker did not list — now always listed); the heads-up landed on the
answer that crossed 80%; 150 seeded free rounds with the money cap off
refused the next question BEFORE any provider request (0 rounds on the
wire) under the pace sentence. Screenshot in
`test-results/chatbot-quality/score-2026-09-10-spend-guard-paused.png`.
Tests: spendGuardHelpers +25 (new), llmBotHelpers +4, builtin +5, tips +0.

**Found on the way, fixed in the run:** the pause sentence carried
`**Allow more**` and a note is plain text, so the asterisks showed; a
`/limit 0.05` set a cap the picker could not display (a select whose value
matches no option shows its FIRST, $0.25 over a five-cent cap).

**Left open as `EC-156`:** an unpriced model's rounds count $0 towards the
money cap, so a Kimi K2 hour is bounded by the pace cap alone.

---

## EC-157 · The manual was searchable to its 3 000th character and no further — `done` 2026-09-10

Found while checking the new step was findable: `owa_help_search "spending
limit"` returned NO manual page at all and an internal note first (the
workflows file's own version banner, which happens to sit at the top of
that file), and asked _How do I set a spending limit for the assistant?_ the
live assistant searched nothing and answered **"That's not something Open
Worship App has a setting for"** — one round, $0.04, on the day the setting
shipped. `build-knowledge.mjs` indexed every page's `searchText` as its
first 3 000 characters; W-42 is 33 KB and W-22 38 KB, so everything past
step 1 of the help window's own page (Stop, Report, Credit used, every `/`
command, the limit) was invisible to search and reachable only through the
exact corpus-row route (`EC-89`). Shipped: the MANUAL is indexed whole (a
60 KB page cap; the internal corpus stays at 3 000 — 185 notes, some of them
hundreds of kilobytes), +82 KB on the index (680 → 763 KB). Measured on all
267 corpus rows that name a recipe, with the exact-label route defeated:
top-1 **53% → 54%**, top-3 **72% → 78%**, no regression (the text band is
capped at 3 per term, so a long page cannot win on length). The three
phrasings now put W-42 first (27 / 44 / 13). And the prompt's honest-no rule
gained the sentence that this window is part of the app — a question about
the assistant itself has a guide page like any other — because the model
had not searched at all. Re-asked: 3 rounds, `owa_help_search` →
`owa_help_page W-42`, the picker and the three `/limit` forms, right.
`scripts/rank-measure.mjs` is the measure — the ranking's ratchet from
now on.

---

## EC-156 · An unpriced model is bounded by the pace cap alone — `open`, low

`recordSpendRound` stores `null` for a round whose model has no row in
`MODEL_PRICE_MAP` (Kimi's K2 family, anything read off an account's own
catalogue), and `toSpendState` counts it as $0 — honestly, since a made-up
price is worse than none, and the head figure says _N calls_ rather than a
dollar figure when every round is unpriced. But it means the money cap
never trips for such a model and only the 150-calls-an-hour pace cap bounds
the hour. A token cap (say a million tokens an hour) would bound it in the
currency every model reports; measure what an hour of K2 costs first, so
the figure is not a guess.

---

## EC-152 · Nothing said what a chat had cost — `done` 2026-09-10

**Asked for by the user**, mid-run: _as a user I want to see how many credit
used per chat session_. Every model round comes back with the provider's own
`usage` block, and the window threw it away; the standing corpus's cost had
only ever been read off the wire by the research driver (`EC-57` measured the
caching that way), so a volunteer spending the church's API credit had
nothing on screen saying how much, and rung 4's "costs little enough to use
freely" was a fact nobody in the room could check. Measured first, as the
skill asks: the standing twelve on the window's own default (Claude Sonnet 5)
were 12/12, median 3 rounds, and cost **about $0.28 in all** — a cache-cold
first ask ≈ $0.04, a one-round cache-warm follow-up ≈ $0.004 — figures the
window could not show.

**Shipped:** `src/chatbot/usageHelpers.ts` (the price table, the two
normalisers, the tally, the words) and one field through the stack.
`AskExtraType.onUsage` is pushed once per round from both loops — pushed,
like `onProgress`, because a question stopped after three rounds or failed on
its fourth has still paid for three, and a total summed onto the answers that
arrived would read under the bill — normalised per provider shape (Anthropic
already splits cached from not; the OpenAI shape reports the whole prompt
with the cached part inside it) and priced on the model that ANSWERED (a
stand-in's rounds on the stand-in). The window folds each round into the
tab (`ChatSessionType.usage`, on the tab because the messages are capped at
sixty) and stamps the ask's tally on the answer (`ChatMessageType.usage`);
`toValidUsage` brings both back off disk and drops a hand-edited one whole.
Drawn as a quiet figure at the end of the answer's Copy line and a **Credit
used** row under the three pickers, only once there is a bill, both with
the sums and the caveat on the hover; the tip line teaches it. The dollars
are an estimate from list prices checked against the providers the same day
(`MODEL_PRICE_MAP`; `toPriceLabel` prints the same table on the model
picker's hover so the two cannot drift); a free service reads _free_, an
unpriced model _price not known_ with the tokens still counted, a mixed tab
both. **`/credit`** (`/cost`, `/usage`, `/spent`, `/tokens`) answers from the
tab's own total with no model, because no tool reads the window and a free
model asked _how much has this chat cost?_ quoted the manual's sample figure
back as the answer (Nemotron: _"the total so far is about $0.02"_ off the
recipe's own example line) — the recipe carries no quotable number now and
says the assistant cannot read the figure. W-42 step 8, CB-62, a corpus row
(`chat-cost`, W-42 + `find: Credit used`).

**Verified live** on the presenter: two asks in one tab (_≈ $0.04 · 31.3k
tokens* then *≈ $0.004 · 15.5k tokens_, the row _≈ $0.05 · 46.8k tokens*,
every figure matching the provider's usage read off the wire by the
driver); a third ask stopped after round one left *Stopped…* with no figure
and moved the row's tokens up by that round; a reload kept every figure; the
free tier read *free · 25.2k tokens*; `/credit` in the spent tab answered
*This chat so far: ≈ $0.05 · 62.4k tokens_ with the sums in 1.5 s and no
round paid; Claude asked the same in words answered from that line and
named `/credit` (2 rounds). Cost of the change to the model: none — nothing
new is sent to it. Tests: `usageHelpers.test.ts` (24), the tab store's
round trip (3), the loops' per-round reporting incl. the stand-in (3), the
command (3).

---

## EC-153 · A model's OPTIONS frame glued to the full stop printed at the user — `done` 2026-09-10

Found by the same run on the free tier (Nemotron, `nvidia/nemotron-3.5-
lightning:free`): _"No, the projector is not showing anything right
now.OPTIONS: Yes, start presenting How do I start? No thanks"_ — the marker
and all three buttons drawn as prose. `OPTIONS_MARKER` required the marker to
start a word after whitespace or a bullet, and a full stop was not on the
list. It and its two cousins (`SHOWS:`, `NEEDS:`) take `.`, `!` and `?`
before the word now — an uppercase word and a colon straight after a
sentence's end is nothing a person writes — with the leaked line as the
test. The options themselves, written with spaces instead of `|`, come back
as one 43-character string and are dropped under `MAX_REPLY_LENGTH`, which
is the right outcome: the frame is off the text whether or not it parsed,
and the corpus follow-ups stand in.

---

## EC-154 · A walkthrough of the help window is offered under a question about the help window — `open`, low

_How much has this chat cost so far?_ on Claude opened W-42 and answered
right, and the answer carried **Show me step by step / Do it for me** for
W-42 — a walkthrough of _Ask the app for help_, whose first step opens the
window the user is already typing in. `applyToolWatch` offers the guide for
any manual page the model settled on; a page whose recipe is about THIS
window (the focus's own `howToOpen` is the window the question came from)
has nothing to demonstrate. Cheap to gate in `genGuideActions` on
`W-42`'s id or, better, on a recipe whose detected window is the chatbot
itself; measure on the six `help`-section corpus rows first.

---

## EC-147 · "Put John 3:16 on the screen" could only be described, and the Do it under it lost the verse — `done` 2026-09-10

**Measured first**, not reported. The standing corpus held at 12/12 on the
window's own default (Claude Sonnet 5), so the run followed the one shape
the previous row had left open (`EC-131`): _Put John 3:16 on the screen_.
The answer was right and honest — W-06's steps, offered, 3 rounds — and
**Do it for me** started the recipe's demo, which pressed **Bible Lookup**
and stopped on step 2: `find: ""`, `press: "Tab"`, and the reference the
user had typed nowhere in it (`owa_guide_status`, verbatim). The Bible
Lookup is a picker written for a person — first letters of the book, the
book, the chapter, the verse, a double-click on the preview — with labels
along the way (the book's own name, bare numbers) that no card and no
`owa_click` can be aimed at from a sentence. The song equivalent, _Put the
song Amazing Grace on the screen_, already worked end to end through
`selectedDocument` (select 4 rounds → confirm → present 4 rounds, verified
on the Mini Screen); the verse — the app's commonest live ask and the top
starter chip — had no door at all.

**Shipped:** `owa_present_bible` (`tools/owa-devtools-mcp/agentBible.mjs` +
`src/helper/agentBibleHelpers.ts`, over a new `owa-agent-bible` relay in
`domHelpers.ts`, lazily imported like the others). It takes the reference
as the user said it and an optional installed `version`; resolves it with
the app's OWN parser (`BibleItem.fromTitleText`, the lookup box's — every
locale it knows, the version's full book name and never a short form,
`EC-151`; a whole chapter, "Psalm 23", is widened to all its verses), in
the version the Bible Lookup is on
first and then any installed one that reads it ("John 3:16" does not parse
under a Khmer version's book names); presents it exactly as the lookup's
**Show bible item** does (`ScreenBibleManager.handleBibleItemSelecting` to
the ticked screens, nothing saved to the Bibles list, so **Clear Bible**
undoes the whole effect); and reads the screens BACK — `isPresented`, the
passage as the app writes it, its first words, each ticked screen with
`isShowing` / `isLocked`, and a `note` when the screen is off telling
the model to OFFER the show button. `action: "check"` resolves and quotes
without touching a screen. A locked screen, no ticked screen, an unknown
version (with the installed ones named), a reference no version reads, and
the main window off the Presenter are all refused in a sentence written for
a person. Acting: banner _put John 3:16 on the screen_, firewall budget,
progress line _Putting a Bible passage on the screen: "John 3:16"_. The
prompt's one new bullet says a verse by reference is ONE call, never the
lookup popup or a guide, done when asked and offered when only asked how;
and `applyToolWatch` marks the ask `isActedOn` on a presented result so no
walkthrough of the lookup is offered under an answer that already did it.
**`/verse John 3:16`** does the same with no model (0 rounds, 1.5 s, _Turn
the screen on_ / _Take it off again_ offered), and the offline bot answers
_Put John 3:16 on the screen_ by checking the reference, quoting its first
words and offering ONE button that presents it (`VERSE_ASK_PATTERN` —
only a concrete reference with a chapter; a how-do-I and "slide 3" go
where they went). The corpus carries the question as a template (W-06 +
the tool), W-06 gained step 7 and W-42 the command.

**Re-asked on the window's own default:** _Put John 3:16 on the screen_ →
`owa_present_bible` → `owa_list_screens` → _"John 3:16 (Amplified) is
loaded and ready, but the screen itself is currently off … Would you like
me to turn the screen on?"_ with the toggle's own words as a chip — **3
rounds, 9.1 s**, no walkthrough buttons; **Yes, show the screen** → 3
rounds, 6 s, `owa_click "Toggle showing screen [F5]"` → _"The screen is
now on and showing John 3:16 (Amplified)"_ — proven on the
`screen.html?screenId=0` target (screenshot in the score file's folder).
Offline (network cut): the check, the quote and the button in 3.1 s; the
button 4.5 s. Cost: ~5 976 → ~6 358 tokens a round to the model (one
registration, all description; measured at +420 and trimmed to +382),
cached after the first round.

---

## EC-148 · The demo's "good enough" is judged on step 1 alone — `open`, medium (the general half of EC-131)

What `EC-147` did NOT fix. `runBotAction` starts the recipe's demo first
and asks the model only when `canDemo` is false — and `canDemo` is true
when ANY step has something to press (`guide.mjs`), so a recipe whose
first step is a real button and whose second needs the user's content
(W-06's _type the first letters of the book_) still gets the instant card
and stalls on step 2 with no model round. The verse is now routed around
it by the prompt (the model never searches for it, so no W-06 buttons
appear), but the mechanism is unchanged for every other recipe that types
(W-15's address, W-16's name). A demo needs a per-step verdict — the
runtime knows every step's `find`/`keys`/`action` at start — so the
card can say _steps 2 and 3 need words I do not have_ and hand THOSE to the
model with the user's ask attached (`EC-38`'s rescue already carries the
step; it needs the ask). Measure with `demo-failure-rate.mjs` on the
recipes with a typing step before building.

---

## EC-149 · The passage goes up in whatever version the lookup happens to be on — `open`, low

`owa_present_bible` with no `version` uses the version the Bible Lookup
is set to — what a double-click there would present — and on this machine
that was **Amplified** while every saved item in the Bibles list was KJV.
The answer names the version, so a volunteer can say "in KJV", and the
model can pass `version`; but a church that presents in one version and
looks things up in another gets the lookup's. A better default order may
be: the version on the screen's bible layer now, then the version of the
most recently presented item, then the lookup's. Measure which one users
actually mean before changing it.

---

## EC-151 · The app's reference parser reads no short form of a book — `open`, low

Probed through the tool after the gate: `BibleItem.fromTitleText` reads
"Psalm 23:1" and "1 John 1:1-4" and refuses "Ps 23:1", "Jn 3:16" and
"Psalms 23:1-6" — the version's FULL book name, spelled as it spells it, or
nothing. The lookup's own picker resolves those shapes through
`genBookMatches` (first letters, a prefix), which the parser does not use. A
model writes full names, so the assistant path is fine; a volunteer typing
`/verse Ps 23` offline is refused in a sentence that says why. A chapter
on its own ("Psalm 23") was the commoner miss and is read now as the whole
chapter (`parseReference` in `agentBibleHelpers.ts`, via
`getVersesCount`). The rest wants the picker's matcher in front of the
parser: guess the book key from the first letters, then write the reference
with that version's own book name.

---

## EC-150 · A Vite full-reload from a sibling session's save loses the answer in flight — `open`, low (dev only)

q02 of this run's corpus answered nothing: the third model round never
completed and the chatbot window came back idle with the question posted
and no answer, at the exact second another session saved
`src/others/commonButtons.tsx` and `src/lang/data/km/index.ts`. Vite
broadcasts a full reload to every connected window when a changed module
has no HMR boundary, the chatbot window included, and an ask in flight is
gone with it. Nothing a user hits (production has no dev server), but a
corpus run shares the machine with other sessions: re-ask a question whose
last status line stopped dead, and read the timestamp before calling it a
chatbot defect.

---

## EC-144 · The window's default assistant was a dead key, and every question paid for it — `done` 2026-09-09

**Measured first**, not reported: the run opened the help window on whatever
it was set to — **ChatGPT / gpt-5**, the stored default — and asked the
standing corpus through it (`score-2026-09-09-stand-in-key.json`,
`corpusDeadKeyBefore`). All twelve:

- three POSTs of the same 41 528-byte request to OpenAI (the SDK's own two
  retries on a 429 whose body said `insufficient_quota` / `credit_balance_exhausted`
  — an account out of credit, which no retry can fix);
- 3.1–4.6 s of waiting;
- then _"ChatGPT could not answer — the AI account is out of credit or being
  rate-limited. Here is what the app's own guide says."_ and the offline bot,
  which got **8 of 12** (q02 offered a verse row as the control, q06 opened
  "in the Documents list" from the Reader, q11 the link-download page, q12
  the drawing panel's Undo).

The ChatGPT key had been out of credit since at least 2026-09-02 (`EC-83`).
A live **Claude** key sat one option along in the head row the whole week,
and every earlier run had picked it by hand. A volunteer does not: they open
the window, ask, wait five seconds, and read a page of the manual under an
apology — rung 4's _degrades honestly_ delivered as _degrades every time_.

**Shipped.** `askLlmBot` takes a **stand-in**: on a failure that is the
provider's own (`checkIsProviderFault` — 401/403, 429, 5xx; never a 400,
never a no-status network error, which another key would share), it asks the
best OTHER provider whose key the user has typed (`getStandInLlmProvider`),
once, with a fresh tool watch, and returns `standIn {provider, model,
failedProvider, reason}` on the answer. **Free is on neither side of it**:
never the stand-in for a paid key (a public service getting a paid
question's words and attachments because a card declined), never stood in
for (a paid key spending money on the free tier's behalf). The window writes
the note — _ChatGPT could not answer — …. Claude answered instead and this
chat now uses it; pick ChatGPT in the row above to switch back._ — and moves
the TAB to the stand-in, so the head row says who is being asked and the
next question does not pay the dead post again; the stored new-tab default is
left as the user set it, so a key topped up tomorrow is back without anybody
knowing a setting changed. The wait line says _ChatGPT could not answer —
asking Claude instead_. And the OpenAI-shaped loop posts with
`maxRetries: 0` (`EC-86`, half): a dead key is asked once. The Anthropic loop
keeps the SDK default — a 429 on a live Claude key is nearly always a rate
limit that honours `retry-after`.

**Re-measured** through the same dead door: **12/12 answered by Claude**,
median 8 s (one dead post ≈ 0.5 s, then the usual 2–3 rounds), every note
present, and q12 in q11's tab went straight to Claude with no note — the
tab switch working. Unit: 7 tests in `llmBotHelpers.test.ts` (the fault
classes, both Free lines, one post, the step text, a 400 not stood in for).

**Not done, on purpose:** remembering a dead key for the window's life so a
NEW tab skips it too. A short-lived record is allowed here; it was left out
because a new tab is rare, the cost is now one ~0.5 s post, and a key topped
up in the meantime would be silently skipped for as long as the record
lived. Reopen if a measurement shows new tabs being opened per question.

---

## EC-145 · The near-miss ranking counted "to" and "the", and offered a line of Genesis as the control — `done` 2026-09-09

Offline where-is, measured under `EC-144`: _Where is the button to change the
background?_ → `owa_find_ui` found nothing (correct — no control is called
that) and the offline bot offered its first near miss: _"there is **pass
after Click to open the verse** on screen — is that the one?"_, with a
**Highlight** button for it. `nearMisses` in `domMatch.mjs` scored a label
one point per shared token, and _to_ and _the_ were tokens: every verse row
(text + its `Click to open the verse` title) scored 2, the **Background**
panel — on screen, tier 0 for the word itself — scored 1, and ties broke on
length. **Shipped:** a `FILLER_WORD_SET` the near-miss ranking drops from
the WANTED tokens (exact matching is untouched — "the" in a label still
matches "the"); a question made only of filler has no near miss at all. The
same ask now offers **Background** and rings the panel. Two tests, both
failing before the change.

---

## EC-146 · The offline bot answered a Reader question with a Presenter panel and no way across — `done` 2026-09-09

`EC-139` taught the MODEL that the Reader page has none of the Presenter's
panels and that the way back is the 🖥️ **Go Back to Presenter** button. The
offline bot — what the window has on the afternoon `EC-144` was measured on
— had no such fact: _How do I edit a slide?_ from the Bible Reader opened
_"in the Documents list"_. **Shipped:** `genBackToPresenterRoute(focus)` is
now the ONE source of the route for the prompt and the offline bot
(`helpBotHelpers.ts`), and `genBackToPresenterLead` puts _This is done in the
Presenter — the Bible Reader page has none of these panels. First click the
🖥️ Go Back to Presenter button at the top right, then:_ in front of a manual
answer that names a Presenter panel (`PRESENTER_PANEL_PATTERN`, tested with
the manual's emphasis marks stripped first — the first live re-ask still
missed because the excerpt reads `**Documents** list`). Verified live with
the chatbot window's `fetch` failing for every host off the machine, which
is the route the code takes when the building's internet dies. Four tests.

---

## EC-139 · The wrong-window shape wrote its steps off the excerpt, for a panel the window does not have — `done` 2026-09-09

The ratchet regression carried from the previous row. _How do I edit a
slide?_ asked from the Bible Reader, Claude Sonnet 5: **2 rounds, one
`owa_help_search`, no page opened**, and step 1 _"In the **Documents** list,
select (or double-click) the slide document"_ — the Reader page is
`BibleReaderComp` and nothing else; it has no Documents list. Measured over
the day's four corpus runs the shape opened the page 1 time in 4, and the two
"passing" answers had sent the user to _"the Presenter tab at the top"_,
which the Reader has not got either (its route back is the 🖥️ **Go Back to
Presenter** button at the top right). The prompt rule ("`owa_help_page` on
the hit BEFORE you write any step") and the top hit's own note were both
ignored; a rule the model can ignore is not a rule.

Shipped, two halves. **In code**: `checkIsStepsWithoutPage` — a numbered
list (two lines or more) after a manual search scoring over the floor with
no `owa_help_page` — makes both provider loops push the answer back as an
assistant turn and a user turn naming the hit to open
(`genOpenPageNudge`), once per ask (`watch.isPageNudged`), never on the last
round (the call is forbidden there) and never while salvaging a rate limit.
An honest "cannot do that", a state answer and a one-line where-is are
untouched. **In the prompt**, for the two main-window pages that are not the
Presenter: the page has NONE of the Presenter's panels (named), and step 1
for steps that use one is the real control — the 🖥️ button in the Reader,
the Presenter tab in the Editor. Re-asked in fresh tabs: **2 of 2 open the
page and start with _Click the 🖥️ Go Back to Presenter button at the top
right_**, 3 rounds, 9 s; the nudge did not need to fire on either (the
prompt fact was enough) and stays as the net. Tests: llmBotHelpers +5.

---

## EC-140 · The manual had no page for removing a file, and the assistant guessed "Delete" — `done` 2026-09-09

q12 of the standing corpus, _and how do I undo that?_ after _How do I add a
song?_: **6 rounds, 16.7 s** — three `owa_help_search`es, an
`owa_list_questions`, two pages (W-15, W-01b) — ending on _"Choose
**Delete** from the menu"_. The row's menu ends in **Move to Trash**
(observed live, red trash icon, last item), a confirm asks _Moving File to
Trash_ → **Yes**, and the file goes to the OS Recycle Bin (`shell.trashItem`).
No `W-xx` described any of it; CM-06 was the only mention, in the matrix.
Shipped: **W-43 — Remove a song, document or file (Move to Trash)** in
_Creating & editing content_, with the confirm, the Recycle Bin, the
on-screen background exception and the slide-inside-a-document case; two
corpus questions (`trash-document`, `restore-trashed-document`) in
`presenter.json`; manual and knowledge rebuilt. Re-asked: **3 rounds, 7.6 s,
Move to Trash, Yes, Recycle Bin**. `owa_help_search "delete or remove a song
document"` → W-43 first at 192 (W-23 at 70).

---

## EC-141 · The assistant offered to press Space in a run it cannot advance — `done` 2026-09-09

The first re-ask of _What's next in my running order?_ with `runSheet`
landed answered right and closed with _"Want me to press Space to move to
it?"_ — the shape of `EC-117`: a pill offering a thing no tool will do
(`press_key` is withheld, and a key has nothing the interlock can read). A
pressed "yes" would have cost a round and an apology. Shipped in the same
run: the tool description and the prompt's run-sheet sentence both say no
tool advances a run and the operator presses **Space** or **→** in the run
player. Re-asked: _"To move to it, press Space (or the → key) in the run
player."_, no offer. Measured on one provider only (Sonnet 5).

---

## EC-136 · The panels recipe could only name the View menu, and the card could press none of it — `done` 2026-09-09

Reported with a screenshot: the guide card for _Hide, show, and reset the
app's panels (View menu)_ on **Step 1/5**, its hint reading _"Open the View
menu at the very top of the app window first"_, and beside it the user's OWN
right-click on the divider between two panels, open on **Reset Size / Close
First Widget / Close Second Widget** — circled, with _"the agent also use
contextmenu of the resize"_. Three things were wrong at once, measured
through the app's own host before anything was changed:

- **The recipe named one route, the one no card can press.** All of W-31 was
  the native View menu, which lives outside the DOM: 5 steps, `find: ""` on
  the first, `canActOnStep: false`, and the model round the rescue spends on
  every one of them. The divider's right-click menu does the same thing in
  place — and is the ONLY route in a popup window, whose menu bar is hidden —
  and the manual did not mention it, nor the double-click that resets the
  pair, nor the hover arrows.
- **The divider had no name.** `owa_find_ui "Reset Size"` → 0 matches; the
  `.flex-resize-actor` carried no `title`, `aria-label` or
  `data-widget-name`, so the matcher could not see it and a step about it had
  nothing to ring. And the guide's right-click path aimed at a LIST region
  (`findListRegion`), which is right for _"right-click an empty part of the
  list"_ and wrong for a divider; `openContextMenu` aimed 20 px in from the
  bottom-right edge, which on a 6 px divider is a point in the pane beside it.
- **The View-menu step itself was being dropped.** The card opened on _"Click
  a ticked one"_ with nothing said about what to tick, because
  `dropStepsAlreadyDone` read the whole step and step 1 says _"e.g. on the
  presenter: App Presenter Left …"_ two sentences after _"Open View"_ — the
  window's name in an example list made the step a "go to this window" step.

**Shipped.**

- `FlexResizeActorComp` stamps every divider `role="separator"`,
  `aria-orientation` and `aria-label="Divider between <A> and <B>"` off its
  neighbours' `data-widget-name` (the collapsed strip carries the same name, so
  it is walked to rather than over). `owa_find_ui "divider"` now lists them
  with the panel each is in.
- `domMatch.mjs`: `openContextMenu` aims at the centre of anything thinner
  than its inset; and `parseNeedle` keeps the words as ASKED beside the
  kind-noun-trimmed ones, with `tierOf` trying the whole for the exact tier
  first — **"Document List" and "Presenting Flow List" are panes NAMED with a
  kind noun**, so "Presenting Flow List" was being trimmed to "presenting flow",
  a tier-1 loose fit on its own strip that `owa_click` REFUSED to press
  (measured live: _"the closest control on screen is not called that"_ for the
  strip named exactly that). A bug older than this report, hit by the recipe's
  step 8.
- `guide.mjs`: a right-click step whose named control is a `[role="separator"]`
  right-clicks it where it is (same one-press-one-action shape as the list:
  the press opens the menu, `withMore` names the item, the next press chooses
  it), the hint says _right-click it_ rather than _click it_, a step that names
  a _divider_ gets NO list fallback when the divider is missing (a collapsed
  panel has no divider; the fallback right-clicked the Presenting Flow list's
  own menu for a step about the divider above it), and `dropStepsAlreadyDone`
  reads only a step's FIRST sentence for where it is going.
- W-31 gained steps 7–9 (right-click → Close First Widget; click the strip;
  right-click → Reset Size, double-click, hover arrows), `docs:gen`, knowledge
  rebuilt; `questions/common.json` gained _What does right-clicking the line
  between two panels do?_ plus divider keywords and a `find` on both existing
  panel questions.

**Measured after, through the app's own host on the Presenter:** the card
starts on step 1 (_Open View …_, 9 steps); `goto 7` → `find: "divider between
Document List and Presenting Flow List"`, `isTargetFound: true`; **Do it** →
`right-clicked`, `more: "Close First Widget"` (screenshot: the app's own menu
open, ring on the item); **Do it** → `clicked "Close First Widget"`, Document
List collapsed to its strip (screenshot: card on step 8 ringing the strip);
step 8 **Do it** → strip clicked, pane back; step 9 → `right-clicked`, `more:
"Reset Size"` → `clicked "Reset Size"` → guide finished. With the Document
List collapsed, step 7 answers _nothing on screen to act on_ and opens no
menu. 8 new tests (guide 3, domMatch 2 + the strip, drop rule 1). Tool count
and tokens/round unchanged (48 / 19 to the model, ~11 332 / ~5 722).

## EC-137 · A second Do it on a step already done advances twice — `open`, low

Seen while driving W-31: `act()` arms a 700 ms `next` after a done press,
and a press landing inside that window (a driver, or a user double-pressing)
does the step again and arms a second timer, so the card skipped a step and
`stop`ped on the last one with its menu still open. `act()` should ignore a
press while an advance is pending, or cancel the pending one.

## EC-138 · Four of W-31's steps are native-menu only and always refused — `open`, low

Steps 1, 2, 3 and 5 of W-31 are the OS View menu, which no card can press,
and each refusal spends a rescue round. `EC-136` gave the recipe a DOM route
beside them, but the demo still opens on a step it cannot do. Either mark
menu-bar steps `kind: "look"`-like (_do this yourself, then Next_, no rescue
ask), or teach the card that the divider steps ARE the demo of the same thing.

## EC-128 · "Which song is selected?" was answered with the song on the projector, and "show the next slide" ran to the cap — `done` 2026-09-09

The other half of rung 5, measured for the first time by asking what the
user is in the MIDDLE of, on Claude Sonnet 5, with "Amazing Grace"
highlighted in the Documents list and the projector still holding a Khmer
hymn (screen off, slide held):

| Ask                                                                                      | Before                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | After                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _Which song is selected right now?_ (Amazing Grace selected, the hymn on the off screen) | _"The song loaded on your Mini Screen right now is នៅកាល់វ៉ារី (ខ ៥៥) … currently sitting on the verse slide"_ — 2 rounds, `owa_app_state` + `owa_list_screens`, and WRONG: the only document any tool had ever named was the one on the screen                                                                                                                                                                                                                                                                                                                                                                                                | _"The song currently selected is Amazing Grace (7 slides). Nothing from it is on screen right now."_ — 2 rounds, 4.6 s, `owa_app_state` alone                                                                                                                                                       |
| _What am I about to put on the screen?_ (the hymn selected, its verse showing)           | the verse on the wall, and nothing about what comes after it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | _"verse 1 of "…" is on the screen. The next slide, if you move forward, would be slide 5 (which appears empty/blank text)"_ — right: slide 5 is a picture. 2 rounds                                                                                                                                 |
| _Show the next slide_ (same state)                                                       | **10 rounds, 54 s, 13 tool calls**: `owa_help_search`, `owa_list_screens`, `owa_app_state`, `owa_list_ui` ×6 (_Verse_, _Slide_, _Verse:_, _(2)_, _កាល់_, then `limit: 200` — **34 574 tokens written to the cache** and read on every later round), `owa_help_page`, `owa_click "5 Index: 5"` (a slide's index badge, the only part of a card any tool listed, pressed because it happened to bubble to the card — the congregation's screen changed), `owa_list_screens` — and then _"I could not find an answer for that."_ Asked again clean: 9 rounds, 80 s, `owa_lyric_file info` on the whole song, nothing pressed, the same non-answer | _"The next slide is slide 5 ("671826"). Do you want me to put it on the screen now?"_ — 2 rounds, 6 s, ONE call. **Yes, show it** → `owa_app_state`, `owa_click "Slide 5: 671826"`, `owa_list_screens` → _"Slide 5 ("671826") is now showing on the screen."_ 4 rounds, 7.6 s, verified on the wall |

Two things were missing, and both are fields, not prompt rules. Nothing said
what was SELECTED: `owa_list_screens` says what the projector holds and
`owa_app_state` said the page, the language and the tabs. And a slide card
had no accessible name at all — its number sat in a badge titled `Index: 5`
and its name in a bare span — so `owa_list_ui` never listed one and
`owa_find_ui "next slide"` found nothing.

What shipped. Every slide card in the previewer carries `aria-label`
(`toSlideAccessibleName`, `Slide 5: 671826`, through `tran` so a Khmer
window answers to `ស្លាយ 5: …`); `owa_app_state` on the Presenter page
answers `selectedDocument` — name, kind, `slideCount`, `slides[]` (number,
name, first 60 characters, `onScreens`, `isDisabled`, and `find`, the card's
own label — ONE function builds both), `onScreen`, and `next` / `previous`
worked out the arrow keys' way (wrap, step over a disabled slide; with none
of the document up, `next` is its first slide) — read from the app's own
document and screen managers over the same DOM-event relay as
`owa_list_screens` (`src/helper/agentPresenterHelpers.ts`, lazily imported
in `domHelpers.ts`; a song is read through its stage-0 instance, the one the
cards come from, because the base `LyricAppDocument` lists the structure
with empty canvases and no attachment slide). A 200-page PDF lists 24 and
counts the rest. Off the Presenter the field is a `note`, never a silent
absence. The prompt's "what they are in the MIDDLE of" rule names the field
and the one press; the offline bot answers the same questions from it
(`answerSelection`, checked before the how-do-I gate — _which song is
selected_ starts like a how-do-I and is not one; a run-sheet question is
excluded) and offers `/next`; and three commands run with no model:
`/selected`, `/next`, `/previous` (1.5–3 s, what CHANGED read back, honest
when the screen is off). `owa_app_state` also stopped carrying the forty
dev-only component names (~200 tokens a call, internal, read by nobody) and
the user's data directory (a path with their account name, on every call).
Cost: +~150 tokens of description; the field itself is ~800 characters for
a five-slide song and rides only the rounds after the call.

---

## EC-129 · A round that spent its whole budget thinking answered "I could not find an answer for that" — `done` 2026-09-09

Seen on the same asks, by capturing every round's content blocks off the
wire for the first time: **every Claude Sonnet 5 round carries a `thinking`
block** — the model runs adaptive thinking whether or not the request asks
for it — and the last round of _show the next slide_ ended `max_tokens` with
2 000 output tokens of thinking and NO text. The loop's `MAX_TOKENS` was
2 000, set when Claude did not think by default; OpenAI's and Kimi's budgets
had been raised to 6 000 for exactly this failure ("the answer itself can
come back empty") and Anthropic's had not. The window turned the empty text
into _"I could not find an answer for that"_ — a claim about the app, made
to a user whose projector the same question had just changed. With the
effort left at its default (high), a round over a 35 000-token tool result
took 20 s.

What shipped: `ANTHROPIC_MAX_TOKENS` 6 000, and a final round with no text
says _"I ran out of room working that out before I could answer"_ when it
stopped on `max_tokens`. **The effort setting was tried and NOT shipped**:
at `output_config.effort: "low"` the rounds were 2–4 s faster and _show the
next slide_ cost 47–71 output tokens a round, but _How do I edit a slide?_
from the Reader was answered off the search excerpt without opening the
page — _"click the slide document — this opens it in the Slide Editor"_,
which is not how the app works — and `medium` did the same twice. The
default effort skipped the page too once the prompt had grown, so the fix
went where the model decides: the top manual hit of `owa_help_search` now
carries `note: "An excerpt, not the steps: open this page with
owa_help_page before writing any step."` — 2 of 2 asks opened the page
after that, where the prompt rule alone (sharpened the same day) was
ignored 4 of 4 -- and then 0 of 1 on the final re-run, so it is a hit rate, not a fix. The fix that held was at the SOURCE: W-02 step 2 read _"Slide Editor only opens when a slide document is selected"_, which every skipped answer condensed into _"select the document -- this opens the Slide Editor"_; reworded to put the order first (select in the left list, then click the tab), regenerated and rebuilt, the same ask opened the page and gave the right steps 2 of 2. The comment above the budget records why effort stays at
the provider's default: change it only with the corpus re-graded. The
driver now records `content` per round (`ask-corpus.mjs`), which is how the
thinking blocks were seen at all.

---

## EC-130 · `owa_list_ui` costs ~180 tokens a row and hands the model internals and paths — `done` 2026-09-09

Seen in `EC-128`'s dump: one `owa_list_ui limit: 200` result was **34 574
tokens**, written to the cache and read on every round after it. Each row
carries `position {x, y, width, height}`, `tag`, `component`
(`FileItemHandlerComp`) and `sourceFile` (`src/others/FileItemHandlerComp.tsx`)
— the last two dev-only internals the prompt forbids the model to repeat,
sent to it on every row — and a label built from `[title]`, which for a
document row is the file name WITH its extension (`Amazing Grace Amazing
Grace.owl`) and for the previewer footer is the FULL PATH
(`Amazing Grace C:\Users\…\documents\Amazing Gra`). A row for the model
needs the label, the panel, where it is and whether it is enabled.

**2026-09-09, shipped**: `describeRow` in `domMatch.mjs` — a LIST row is
`label`, `inPanel`, `where`, plus `showsOnHover` / `isDisabled` only when
true; `describe` keeps the full shape for the one-control answers (find,
click, the picker), so the developer's route into the source is one
`owa_find_ui` away. Same shape for both callers. `labelPartsOf` drops a part
that is a file path (Windows drive, UNC, or a Unix home root), so neither a
list nor a match carries the previewer footer's path. Measured live on the
Presenter, `limit: 200`: **27 514 characters (~7 600 tokens by chars/3.6,
against 34 574 counted by the provider before), 0 paths, 0 component
names**. The description says a row with neither key is an ordinary enabled
control. Tests: domMatch +2 (and one rewritten).

---

## EC-131 · A do-it with CONTENT loses the content between the ask and the demo — `half done` 2026-09-10 (the verse: `EC-147`; the mechanism: `EC-148`)

_Put John 3:16 on the screen_: the answer is right (W-06's steps, offered,
not done — 3 rounds) and **Do it for me** under it starts W-06 as a demo.
Step 1 presses **Bible Lookup**; step 2 has `find: ""`, `isTargetFound:
false`, and would type the recipe's own example (`Joh`), not the user's
verse — the reference the user typed never reaches the card. The prompt
already says a demo needs the model's OWN steps with a `value` to type, but
the window's button starts the `manualId` demo directly (`runBotAction`),
before the model is asked anything. Either the button should ask the model
for steps when the recipe has a typing step, or the rescue (`EC-38`) should
carry the user's ask so the model can fill the value in. Not measured beyond
step 2.

**2026-09-10:** measured to the same step 2 again (`find: ""`, `press:
"Tab"`, the verse lost) and closed for the VERSE by a door of its own —
`owa_present_bible`, `EC-147` — which the prompt routes every verse ask
to, so the lookup recipe is no longer offered under it. The general half —
a recipe demo judged "good enough" on its first step while a later step
needs the user's words — is `EC-148`.

---

## EC-132 · The running order is invisible to every tool — `done` 2026-09-09

_What's next in my running order?_: 6 rounds, 22.7 s (`owa_app_state`,
`owa_help_search`, `owa_help_page`, `owa_list_ui` ×2 / `owa_find_ui`), a
plausible answer about the collapsed Presenting Flow List panel and an
unverified claim that _"whatever is live right now shows a small green
mark"_. The run sheet's cursor lives in the floating preview's own store
(`presenting-flow-preview-run-player` in memory) and no tool reads it, so
the assistant cannot say what is next in a service — the one question rung
5 most wants answered. `selectedDocument` covers the slide list; the run
sheet (which flow is open, the cursor, the line after it, and a press that
steps it) is the next field of the same shape. The offline bot deliberately
does NOT answer this from `selectedDocument` (`RUN_SHEET_PATTERN`).

**2026-09-09, shipped** (`src/helper/agentRunSheetHelpers.ts`, folded by
`agentPresenter.mjs`): `owa_app_state.mainWindow.runSheet` — `openSheets[]`
(name, `lineCount`, `lines` with n / title / kind / `isParked`, `cursor`
with the slide inside a document and `isLast`, `next` as the Space key works
it out — next un-parked slide of the same document, else the next un-parked
line, never wrapping — and `isAtEnd`), or `availableSheets` + `note` when no
player is open. Lazily imported over the existing `owa-agent-presenter`
relay; read whatever the selection is. `describeRunSheet` serves `/run` and
the offline bot (`RUN_SHEET_PATTERN` now routes TO it instead of away).
Re-asked live with the run landed on a document's last slide: **2 rounds,
6.1 s, one call** — _"Your run sheet pl1 (1) is currently on line 14, a1
(Copy). The next press will run line 15: Clear Slide. To move to it, press
Space"_; `/run` 1.5 s. Left open: a PRESS that steps the run (`EC-142`).
Tests: agentRunSheetHelpers +9, agentPresenter.mjs +4, helpBot +2.

---

## EC-142 · The run sheet can be READ but not STEPPED — `open`, medium

`EC-132` reads the run; nothing advances it. The player's step is a
focus-gated key (Space / → with the widget holding focus), and `press_key`
is withheld from the model for good reason (`EC-111`). A safe shape would
be a `find` on the NEXT line — the run player's element header and slide
cards carry no `aria-label` yet (`PresentingFlowItemPreviewComp` has a
`title` on the label only) — so `owa_click` could land the run by exact
words the way `selectedDocument.next.find` presents a slide, and `/run-next`
could do it with no model, reading the run sheet back afterwards. Offered,
never done: a step changes the congregation's screen. Also the line's
`slide.name` is `""` for an unnamed slide where `owa_list_screens` says
`slide 0` — the two describers should share one fallback.

---

## EC-143 · A model-written option can offer a press no tool can make — `open`, low (pattern)

Third sighting of the shape (`EC-117` the screen, `EC-141` the run sheet):
the model invents a "yes" for an action it has no tool for. Each was fixed
by a sentence in the description or the prompt. A general answer would be a
window-side check on the `OPTIONS:` pills against the ACTING tools the
model actually has — a pill promising to press a key when no key tool is
offered is dropped — the way `checkIsDraftEcho` drops the draft echoes.
Measure how often it fires before building it.

**2026-09-10, another:** under _How do I set a spending limit for the
assistant?_ Sonnet 5 offered **Set it to $2** and **Turn the limit off** —
presses no tool makes, and deliberately so: the limit is the PERSON's, and a
model that could raise its own budget would defeat the guard (`EC-155`).
Pressed, the pill sends those words and the model explains the picker
instead; not wrong, but a button that does not do what it says.

**2026-09-09, another:** under _and how do I undo that?_ (Move to Trash)
Claude Sonnet 5 offered **Yes, remove it now** — a press `owa_click` refuses
by its destructive interlock, so the "yes" can only end in an apology.

---

## EC-133 · The model calls screen 0 "screen 1" — `open`, low

With the projector showing, _Is anything showing?_ answered _"screen 1 is
on and showing a song slide"_ and the panic answer _"screen 1 is turned
on"_ — the app's badge reads `Screen: 0`, and a volunteer looking for
"screen 1" will not find it. `owa_list_screens` carries `screenId: 0`; the
model counts from 1 for people. Carry the badge's own words (`label:
"Screen: 0"`) beside the id, the way `controls` carries the button labels,
and say in the description that screens are numbered from 0.

---

## EC-134 · A press that selects a document reads as "nothing proven" — `open`, low

`owa_click "Amazing Grace"` on a Documents row answered `didChange: false`
with the `unverified` sentence, and the row WAS selected — the app reads the
file off disk before it re-renders, past the 250 ms settle. The next-slide
press reads `didChange: true` because the card gains its on-screen badge in
time. A second read a little later, or an `isSelected` read off the row's
`active` class, would make the answer true; until then a model told
"nothing proven" after a press that worked will press again.

---

## EC-135 · `owa_click` refused a label that IS the control's title once the shortcut is in it — `done` 2026-09-10

`owa_click "Close [Ctrl+Q]"` on the Bible Lookup popup was refused as _"the
closest control on screen is not called that"_; `owa_click "Close"` pressed
it. The control's parts are `Close [Ctrl+Q]` (title) and `Close`
(aria-label), and `Toggle showing screen [F5]` — the same shape — presses
fine off `controls.showHide`. Not chased: `domMatch.mjs` was another
session's file on 2026-09-09. Measure `isPressSafe` with a bracketed needle
against a part that carries the bracket, and against one that does not.

**2026-09-10, measured and fixed:** it bit twice in one hour of this run —
`owa_click "Close [Ctrl+Q]"` refused on the Bible Lookup, and
`owa_click "Clear Bible [F9]"` refused on the Mini Screen, the very words
`owa_list_screens` hands the model under `controls.clear` (the joined
label is `BB Clear Bible [F9] Clear Bible`, so only a part could match).
`checkIsNamedNearly` in `domMatch.mjs` stripped the `[shortcut]` off the
label PART and compared it with the needle as given, bracket and all.
Now the needle loses the same decoration, and a needle that is nothing
but decoration matches nothing. Re-driven through the app's own host:
`owa_click "Clear Bible [F9]"` presses. Tests: domMatch +2.

---

## EC-124 · "Showing: true" was read as "blank": the screens tool said nothing about what was ON the screen — `done` 2026-09-09

The rung 5 finding, measured by following the standing corpus's panic
shapes THROUGH with the projector showing a Khmer verse (screen 0, a song's
Verse 2). `owa_list_screens` answered `isAnyShowing`, the ids and the
displays, and nothing about content, so every state answer was written by
inference:

| Ask                                                                        | Before                                                                                                                                                                                                                                                                                                                                  | After                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _Is anything showing on the projector right now?_ (screen on, verse on it) | _"Yes — the presentation screen is currently on and showing on your display."_ 2 rounds. Nothing a volunteer could check against the wall.                                                                                                                                                                                              | _"Yes — the projector is on and showing a song slide. It's on "Verse 2" of "យើងនឹងចូលក្នុងទីក្រុងបរិសុទ្ធ ( ខ ២៥៧ )", with the text starting "ចូរមានសង្ឃឹម …". There's no Bible verse or background image on it right now."_ 2 rounds                                                                                                                                                                                     |
| _the words no come out big screen_ (same state)                            | **9 rounds, 36 s, 142k cached input**, `owa_list_ui` ×4, `owa_help_page`, and then: _"It looks like nothing has actually been sent to it yet: turning the screen on just gives you a blank canvas"_ — a confident wrong answer to somebody reading that verse off the wall                                                              | _"The screen itself is on and it already holds the words — the current slide is "Verse 2" of your song … nothing has been cleared or locked. The likely reason: the app can currently only see one display — the same one your computer itself is using … check the cable, then the display button in the Mini Screen panel at the bottom right."_ 3 rounds — the right diagnosis for this machine, which has one display |
| _Nothing is showing on the projector_ (screen off, verse held)             | _"no screen is currently showing at all … press the show/eye button"_ — right, but blind to the slide already loaded                                                                                                                                                                                                                    | _"Your screen is simply switched off — it's not showing anything, but it does still have a slide loaded (Verse 2 of "…") ready to go. Would you like me to turn the screen on? That will make the projector show that slide."_ plus a SHOWS chip that rings the toggle                                                                                                                                                    |
| → **Yes, turn it on**                                                      | **8 rounds, 16.6 s**: `owa_find_ui "show screen"` → nothing (`EC-115`) → `owa_click "0 Screen: 0"` (a near miss: the screen-id badge) → `owa_list_screens` → `owa_list_ui filter Screen` → `owa_click "Toggle showing screen [F5] Toggle showing screen [F5]"` (the label DOUBLED) → `owa_list_screens` → _"The screen is now showing"_ | **3 rounds, 9.1 s**: `owa_list_screens` → `owa_click "Toggle showing screen [F5]"` → _"The screen is on now. The projector should be showing Verse 2 of "…" — please check the wall to confirm."_ Confirmed on: `isAnyShowing: true`                                                                                                                                                                                      |

What shipped: `owa_list_screens` now answers `screens[]` — per screen,
showing or not: `isShowing`, `isLocked`, `isSelected`, `stage`, `display`,
`background` (kind + file name), `slide` (document name, slide name, first
160 characters of its words with the chords stripped out of them), `bible`
(reference + version, every version when several), `foreground` (widgets by
name with what each shows), `isBlank`; `controls` (the exact words on that
screen's show/hide toggle and its five Clear buttons, each Clear saying
`hasSomething`); and `previewCard` (where the Mini Screen panel sits in the
window — the DOM's answer to `EC-116`, not a guess). The content comes from
the presenter's own `ScreenManager` instances through the `owa_lyric_file`
relay pattern (`src/helper/agentScreenHelpers.ts`, lazily imported in
`domHelpers.ts`); the labels and the card's place are read off the DOM in the
same expression (`tools/owa-devtools-mcp/agentScreens.mjs`). Off the
Presenter page the tool degrades to the basics with a `note`, so the state
answers never go dark. The prompt's symptom paragraph now says to SAY what is
on the screen, that a showing screen holding a slide is never "blank", to
place the card where `previewCard` says, and — on a yes — to press
`controls.showHide` by its exact words with no search round first. The
offline bot's state answer and the `/screen` command say the same content
(`describeScreenContent`, plain ESM the renderer bundles): _"Screen 0 is off
but already holds the song "…" (Verse 2) -- "…", so turning it on shows
that."_, 1.6 s, no model. Cost: +124 tokens a round to the model (5 598 →
5 722), all in the description; the answer itself is ~1 050 characters for
one screen with a song on it, and it rides only the rounds after the call.

---

## EC-125 · A control named twice over: `owa_list_ui` doubled every label whose title and aria-label agree — `done` 2026-09-09

`labelOf` joined the text, the title, the aria-label and the placeholder, and
a control built the accessible way — the show/hide toggle, every button in
`MiniScreenClearControlComp` — carries the same words in title AND
aria-label, so it listed as _"Toggle showing screen [F5] Toggle showing
screen [F5]"_ and the model passed the doubled thing on as an `owa_click`
label (it happened to match, on the joined string). Same class as the
_"Setting Setting"_ chip name fixed on 2026-09-02, one layer down.
`labelPartsOf` now keeps each distinct name once. Test added.

---

## EC-126 · A screen card's container lists as a garbage row — `open`, low

`owa_list_ui filter: "screen"` answers a row labelled
`BGSLBBFG0(0):157552906Tr:Slide:Background:St:0 Screen: 0` — the
`ScreenPreviewerItemComp` card, which carries `title="Screen: 0"` and so
matches the `[title]` selector, with its whole subtree's text as the label
(under the 120-character cut by four characters). It is what the model read
when it pressed _"0 Screen: 0"_ (`EC-124`'s wrong press — that one is the
`ShowingScreenIconComp` badge, a real control, but the container row sat
beside it). A `[title]`-only element whose own text is longer than its
title is a container, not a control: list it by its title alone or not at
all. Measure on the recipe corpus before changing the matcher.

---

## EC-127 · Switching the main window to the Bible Reader hides the screen — `open`, low (app, not chatbot)

Seen while verifying `EC-124`: with screen 0 showing, `owa_goto_page
reader.html` came back with `isAnyShowing: false`, and it was still off after
switching back. If that is the app's design (the presenter page owns the
screen windows), the tool description and W-10 should say so, because an
assistant that switches pages for a walkthrough would take the congregation's
screen down; if it is not, it is an app bug to file. Not measured further.

---

## EC-123 · With no key, a song link still gets a manual search — `done` 2026-09-10

`checkIsLyricPaste` lets the offline bot draft a PASTE itself (`EC-96`), but
_Create a lyric file from https://…_ with no key, no credit or a 429 fell
through to `answerFromManual` and searched the guide for the address.

**Measured 2026-09-10** through the real window with the assistant paused by
the spend guard (the one no-model path a live key allows): the app's own
starter chip, _Create a lyric file from https://hymnary.org/text/…_, was
searched for in the manual as typed and answered with W-15's _Making a new
file: in the Documents list, click the ⋮…_ — how to make an EMPTY file — under
**Show me step by step / Do it for me**. On Claude Sonnet 5 the same ask took
3 rounds and 17.6 s, and the model drafted the song AND created the file in
one breath (`EC-161`).

**Shipped:** `/lyric <address>` in `builtinActionHelpers.ts` (also `/lyrics`,
`/hymn`, `/new-song`; `/song` was already `/selected`'s alias, so the app's own
noun for a song file won) — the drafter reads the page itself
(`owa_lyric_validate` with `url`; the firewall rations it and the app window
says _Assistant read a page on hymnary.org_) and the answer is the same
report, preview box and **Create "…" / Copy song text** buttons the model's
answer carries, with NOTHING written until Create is pressed; `/lyric` over
pasted words drafts those. And the offline bot reads the ask itself:
`readSongLinkAsk` (a song word beside exactly one https address, in a short
message — a bare address is as likely a YouTube link) → `answerLyricLink`,
before the paste check, never a manual search for an address; a page with no
song on it, a bot check (`EC-162`) and a refused read each get a sentence of
their own and never the tool's words. The spend-pause and provider-failure
notes both say _I wrote the song out myself instead_ over a drafted song
(`describeOfflineStandIn`). **Re-asked live:** `/lyric https://hymnary.org/…`
→ 0 rounds, 3.5 s, six verses, the buttons and the preview; the chip's words
with the assistant paused → the same song under the pause note.

---

## EC-118 · A song page's chords never reached the file, because the model retyped the page — `done` 2026-09-09

**Reported by the user with a screenshot** of a Khmer hymnal's chord page,
the `|G` markers circled: _check why no key note imported_ for _Create a
lyric file from_ the page's address. The saved
transcript and the `.owl` on disk say what happened: Claude Sonnet 5 read
the page with `owa_read_website`, then passed `owa_lyric_validate` its OWN
copy of the words — every fragment rejoined correctly, the title's hymn
number trimmed, the artist's name transliterated into Latin script — with not one of
the page's 36 chords in it, and no `Attachments` line, which is the proof it
never handed the wrapper over. The prompt and the tool description had both
said _hand the page over whole_ since `EC-76`; `EC-98` had already recorded
that neither provider does. On a hymnal text page that costs nothing; on a
chord page it costs every chord, and no drafter can put back what the model
deleted. The same page handed to the drafter WHOLE came out with every chord
where the page prints it — the reader was never the problem.

**Done**: `owa_lyric_validate` takes a `url` (draft mode; `text` is optional
now and one of the two is required). Given an address it reads the page
ITSELF — `genReadWebPageExpression`, the same locked-down window — and drafts
from the whole text with the model never getting a turn in between. The
firewall judges a draft carrying a `url` as a network call on its ARGUMENTS
(`checkIsNetworkCall`: address policy, the ten-reads-in-five-minutes budget,
nothing charged to a draft from a paste); `notify.mjs` announces it as
_read a page on <site>_ exactly like a read; `progressHelpers` says
_Reading <site> and writing the song out_; the prompt's song bullet and both
tool descriptions say to give the address and no text, and
`owa_read_website`'s says a song page is not its job. The result must START
with the drafter's own first line — the window keys on it to lift the song
out (`readDraftedLyric`), and a `Read …` prefix on the first try cost the
user the Create button. **Re-asked on Sonnet 5, twice: one tool call
(`owa_lyric_validate {mode: draft, url}`), 2 rounds, 18–20 s, Create pressed
through the window's own button → `.owl` with 36 chord marks; the preview
draws `|G |G |Em` over the first line as the site does.** Cost: +95 tokens a
round at the host and to the model (the parameter and two sentences), against
one tool round fewer and ~2 500 characters of Khmer page text no longer
riding every remaining round. Tests: firewall +1, notify +1, progress +1.

Not done: whether ChatGPT, Kimi and Free reach for `url` (`EC-122`).

---

## EC-119 · A chord site's toolbar was drafted as Verse 1 — `done` 2026-09-09

Found the moment the page above was handed over whole: _Add to / edit / Edit
/ print / Print / navigation / ScrollTranspose / settings / Settings_ as a
nine-line **Verse 1**, the real verses renumbered 2 and 3. Every button is a
line of WORDS by every test in `lyricPageText.mjs`, and this page draws no
strumming diagram between its toolbar and its first chord, so there was no
wall of wordless lines to end the furniture on — the region ran from the
title to the last chord. Fixed with two rules, both about the SHAPE of a
chord sheet: the `Key: G · Time: 4/4` strip a page prints immediately over
its chord sheet is the boundary, and everything above it in the region goes
(`cutAboveMetadataStrip`, only for a strip that comes BEFORE the first chord
— one under the song is a facts table); and on a page with no strip, short
chordless rows above the first chorded row are furniture, swept and NAMED in
the report (`takeLeadingFurniture`, the mirror of `takeTrailingCredits`,
stopping at a chord, a label or a line long enough to sing, bounded at 12).
The report's _first line_ now skips a verse number, which said nothing about
which part of the page was taken. Tests +3; the real page: two verses of six
lines, `firstLine` the first sung words.

---

## EC-120 · The site's own footer notice became the song's copyright — `done` 2026-09-09

The same page, whole: `- Copyright: © 2026 <the site's own name>` in a hymn
credited on the page to its songwriter decades earlier. `readPageCopyright` reads the
footer's notice on purpose (`EC-79`-era: most pages print the notice there)
and the footer's notice on a chord SITE is the site naming itself. A church
opening that file would read that the site owns the hymn. Now a notice that
names the host the page came from (`toSiteLabel`: `madeupchords` out of
`www.madeupchords.com`, off the header line this package wrote and never the
body) is skipped on BOTH paths — the footer read and the tail sweep — and the
field says _Unknown_, which is honest. Tests +2.

---

## EC-121 · A Khmer credit line is neither read as the author nor kept as the year — `open`, low

A Khmer _music and lyrics:_ label with the songwriter's name after it, and
the year in Khmer digits under it, is exactly the credit the Copyright field
wants, and the model's own copy had it, as an English _Music and lyrics:_
line with the name and the year. The reader identifies the line
as a credit (`checkIsCreditLine`'s short-label-and-colon shape) and drops it,
but `readCreditArtist` knows English openers only, `readCreditCopyright`
wants a © sign, and the year line is wordless junk that separates without
flushing — so the credit rode into one row with the chart heading under it
(`<name>Guitar chords`) and the song says _Unknown_ where the page said whose
it is. Worth a Khmer/any-script label map for the credit openers, a
year-under-a-credit rule, and a flush on a credit line so it never joins the
row after it.

---

## EC-122 · Only Sonnet 5 is measured on the `url` route — `open`, medium

`EC-118` was proven on the provider the user's window was set to. ChatGPT,
Kimi and the two free services were not asked, and a model that still reads
the page first and retypes the words is back to a song with no chords. Two
follow-ups: ask the same question on each provider (one paid call each), and
if any retypes, a safety net in the tool — a draft handed `text` with no
chord in it, within minutes of this session reading a chord page whose
words contain that text, drafts from the page and says so. A single
per-session entry, dropped after ten minutes; bounded, short-lived, and only
ever a fallback for a model that ignored the description.

---

## EC-111 · The model pressed F5 unasked and reported the screen on — `done` 2026-09-08

The standing corpus, re-asked on Claude Sonnet 5 with no user report behind
it. _Nothing is showing on the projector_: `owa_list_screens`,
`owa_app_state`, `owa_find_ui "show screen"` with `highlight: true` (which
rang the Bible Lookup's _Save bible item and show on screen_ button — the
wrong control), `owa_find_ui "display"`, then **`press_key F5` on page 0,
`list_pages`, `press_key F5` on page 1**, `owa_list_screens` — 8 rounds,
18.8 s, and the answer: _"The screen is now showing on the projector —
pressing F5 turned it on."_ `showingScreenIds: [0]` afterwards. The screen
came on with nobody having asked, which is the one thing the whole design
says never happens, and the prompt had forbidden it since the first run —
for "hiding a screen, clearing content", not in so many words for SHOWING
one, and not for a key at all. `press_key` carries no label, so the
destructive interlock had nothing to read, and F5/F6 ARE the projector.
The id-scrub run had passed this question two rounds earlier in the day; a
regression by the ratchet.

**Shipped.** `press_key` and `handle_dialog` withheld from the model in
`modelTools.mjs` (the two acting tools that carry no label — a message box
is the user's to answer, as the guide card already holds); the prompt's
offered-never-done rule now names showing a screen and a shortcut key by
name; the symptom rule ends _"a symptom is not a request, so press nothing
until they say yes"_. Re-asked three times: 2 rounds, 5–6 s, _"Would you like
me to turn the screen on for you?"_ with **Yes, turn it on** under it — and
that chip, pressed, went `owa_find_ui "Show"` → `owa_click "Toggle showing
screen [F5]"` → `owa_list_screens` → _"The screen is on now"_ (4 rounds, 7.9
s), so the consent path lost nothing. `EC-17` (a guide step pressing a key)
is the card's half and stays open.

---

## EC-112 · A panic question ran to the round cap through three snapshots — `done` 2026-09-08

Same run, next question: _the words no come out big screen_ (asked with the
screen on and empty, the state `EC-111` had just left). `owa_list_screens`,
`owa_app_state`, **`take_snapshot` ×3** (two windows and the chatbot's own,
~8 400 tokens each), `list_pages`, `owa_help_search "warning icon on bible
item in list"`, `list_console_messages`, `owa_find_ui "⚠️"`, `owa_list_ui
"Clear"` — **10 rounds, 72 s, 225 000 input tokens ($0.45), and the answer
"I could not find an answer for that."** The worst answer a volunteer can
get, at the worst moment, at the highest price. Every graded run before this
one was checked: no chrome-devtools tool had ever been called on a question
that PASSED (`hover` appears twice, in a description). What each does is done
by an `owa_*` tool that answers in the words on the user's screen.

**Shipped.** The eight page readers withheld (`take_snapshot`, `list_pages`,
`select_page`, `wait_for`, the two console and two network readers); the
Report button's investigation prompt no longer tells the model to call
`list_console_messages` (the log lines are already in the evidence it reads
for itself, through `callTool`, which the filter never sees). The model now
sees the 19 `owa_*` tools and nothing else: 29 → 19 tools, ~7 366 → ~5 503
audit tokens/round, and on Anthropic's own count the prefix a round pays for
went 15 876 → 13 088. Re-asked: 2 rounds, 6.5 s, the right diagnosis and an
offer.

---

## EC-113 · A tool's field name quoted back as evidence — `done` 2026-09-08

Found on the re-ask of `EC-111`: _"...isn't turned on at all in the app
right now (isAnyShowing is false)"_, and on the next question _"no screen is
showing at all right now (isAnyShowing is false), which is why..."_ — 2 of 2
the moment the symptom rule asked the model to _say which fault it found_.
A field name is the setting-key class of leak the prompt forbids, and it
arrived in brackets as proof. **Shipped** at both ends, the way `EC-92` was:
the NEVER bullet names _a field out of a tool's answer like "isAnyShowing"_,
and `scrubAnswerToolFields` (`recipeIdHelpers.ts`) drops a bracketed aside
whose content is a camel-cased name followed by _is / was / : / =_ — the
shape a real aside ("(iPad)", "(or F5)", "(e.g. Joh)") never has — at the
same seam the recipe ids leave by. Third ask clean.

---

## EC-114 · `owa_click` pressed a loose match — `done` 2026-09-08

The aim under `EC-111`: `owa_find_ui "show screen"` answered ONE match, the
Bible Lookup's _Save bible item and show on screen_ button at tier 3 (every
word somewhere, out of order), and `owa_click` pressed whatever `findBest`
returned — so the same two words, handed to `owa_click`, would have PRESENTED
a verse to the congregation. The guide card had held the `isPressSafe` bar
since `EC-104`; the tool the model presses with had not. **Shipped:**
`genClickExpression` asks for `preferPressSafe` and refuses a match that is
not called what was asked, with the control it found as `nearest` and the
`nearMisses` — proven through the app's own host: `"show screen"` → refused,
`nearest` the save button, `nearMisses` carrying _Toggle showing screen
[F5]_; `"Images"` / `"Colors"` / _Toggle showing screen_ (shortcut and all)
still press. The window's own callers (`/screen-show`'s _Toggle showing
screen_, the five Clear labels, every `openFind`) all pass the bar.

---

## EC-115 · `owa_find_ui` cannot find "Toggle showing screen" from "show screen" — `open`, medium

Behind `EC-111`'s wrong ring: a two-word query where one word matches by
word-start (_show_ → _showing_) and the other whole (_screen_) matches
nothing, because tier 2 wants the WHOLE needle as a word-start and tier 3
wants every token as a whole word. `"show"` alone finds the toggle at tier 2;
`"show screen"` finds only a button that happens to carry both words. And
`highlight: true` rings a tier-3 match as readily as a tier-0 one, so the
wrong control was ringed in the user's window before the wrong key was
pressed. Two candidate fixes, both to measure against the full recipe corpus
before shipping: let a tier-3 token of four letters or more match a label
token it begins; and report `isPressSafe` (or the tier) on every
`owa_find_ui` match so the model — and the ring — can tell an exact fit from
a loose one. `EC-114` closed the PRESS; this is the POINT.

**2026-09-09**: reproduced on the "yes" under the panic answer — `owa_find_ui
"show screen"` answered 0 matches with _0 Screen: 0_ among the near misses,
and the model pressed that. `EC-124` takes the flow off this tool (the
screens answer names the toggle by its exact words), so the panic path no
longer depends on it; the matcher defect itself is still open.

---

## EC-116 · The screen preview card is placed "at the top of the Presenter" — `done` 2026-09-09

The `EC-111` re-ask, third answer: _"turn the screen on in the screen preview
area at the top of the Presenter"_ — it is at the bottom right (the Mini
Screen panel). Same class as the id-scrub run's _"usually top area"_ for the
mini screen, which that run fixed for the where-is question. The model is
guessing layout it has never been told; the prompt's symptom paragraph names
the card and its controls but not where the card is. One clause there, or a
line in W-10, closes it — measure on the panic shapes.

**Closed 2026-09-09 by `EC-124`**: `owa_list_screens` answers `previewCard.where`
off the panel's own bounding box (_"at the bottom right of the window"_ on this
layout, _"collapsed"_ when its bar is folded), and the prompt says to place the
card where that says and never to guess. Re-asked _the words no come out big
screen_: _"the display button in the Mini Screen panel at the bottom right"_.

---

## EC-117 · A model-written option that shows the screen — `open`, low

The OPTIONS rule says _never one that would change what the congregation
sees; showing, clearing or hiding stays something they ask for themselves_,
and the state answers write one anyway: **Show the screen now** (q03,
before and after, and on Kimi), **Yes, show the screen** (q07), **Yes, turn
it on** (q08) — 5 of 5 state answers this run. Pressing one IS the user
asking, the answer offered it in words, and every earlier row graded such a
chip as a pass — so either the rule is wrong and should say _offer it as an
option, never do it unasked_, or it is right and the window should drop the
option in code (`quickReplyHelpers`, the shape `checkIsDraftEcho` already
has). Decide, then make the prompt and the code agree.

---

## EC-103 · The card rang and pressed a control that was behind a popup — `done` 2026-09-08

**Reported with a screenshot.** The Bible Lookup popup open over the
Presenter, _How do I add a background?_ → **Do it for me**, and the card's
ring drawn THROUGH the popup on a line of Genesis: the Images tab was under
it. A control is "on screen" by every measure the matcher had — laid out,
painted, enabled — and Do it clicked it and moved on to step 3 with nothing
visible having changed. _"does not work while modal present."_ The runtime
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
pressing the projector's **Clear All [F6]**, **Follow** pressing _Break lines
following model formatting_, **Add** pressing _Add Bible Item_, **Back**
pressing _Background:_, **No** pressing _No Color_, and **ASSISTANT** opening
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
press at all, and 40 of those were steps that DESCRIBE — _The bar under the
search box says how many verses matched_, _When it finishes, the file
appears in the folder_ — each costing an apology, or a model round on the
rescue, for a step whose whole content was "look". `toGuideSteps` marks
such a step `kind: "look"` (opens by describing, bolds no label-like phrase,
names no key), the card draws **Next** instead of **Do it** for it with a
line saying what it is, and a tool-driven `do` just moves on. 19 recipe
steps statically; the rest of the 51 are real actions with no label (_Click
the yellow dot_, _Drag a slide_), which stay with the rescue.

---

## EC-106 · Four recipes could not start a walkthrough at all — `done` 2026-09-08

W-01, W-09, W-10 and W-17 are tours written as bold-led bullets with no
numbered step, and every walkthrough button under their answers — the panic
question's among them, which lands on W-10 — answered _Nothing to guide_.
`toGuideSteps` now reads a top-level bullet that opens with a bold as a step
when a page numbers nothing, sub-bullets folded in. W-10 becomes a seven-step
tour of the screen card (Toggle showing screen / F5, the clears, Lock,
Display, Transitions, Background audio, Stage number).

---

## EC-107 · A bold over 40 characters, or of one character, misread the step — `done` 2026-09-08

`BOLD_PATTERN` capped a bold at 40 characters and floored it at 2: W-08's
_Colors / Images / Videos / Cameras / Webs_ is 41, so it was not read and its
closing asterisks paired with the next bold's — "Colors" was eaten and the
tab step led with **Ok**, a button on a dialog that was not open. One-character
bolds (**✕**, **ⓘ**) did the same damage the other way: unread, their
asterisks paired with the next bold's and the words between became the label.
Now 1–120 characters, cut at the line; the `checkIsControlLabel` length rule
turns the ✕ away one step later. Measured over the manual: 88 bolds were over 40. `nameOf` also names the control the ring LANDED on rather than the step's
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
with no label (_Click the yellow dot_, _Drag a slide onto the canvas_, _Type
your search words_, _Double-click a verse_), controls that exist only after
the previous step's effect (the ⓘ card's fields), file and password dialogs
(Export / Import / Downloads / Password / Ok), and recipe bolds that are not
the app's words. Each is a recipe fix or a model rescue, not a card rule;
the harness lists them by recipe and step so the next run can pick.

---

## EC-110 · W-02 ends its own walkthrough on step 1 — `open`, low

_Switch between the main pages_: its first Do it navigates the main window,
which unloads the card with everything else. The harness skips it by
default. A walkthrough that survives navigation needs the guide state held
by the server and re-injected on load.

---

## EC-95 · The model's own pills under a drafted song repeated the buttons, brighter — `done` 2026-09-08

The four _Try asking_ chips, asked on the user's own assistant (Kimi K2.6).
Both chips that end in a draft — the paste and the page — came back with
**Create "Amazing Grace"** / **Copy song text** AND, under them, the model's
`OPTIONS:` pills _Create the file_ / _Copy the text_ (_Copy to clipboard_ on
the page). The pills are drawn as filled buttons and the real ones as
outlines, so the pill is what a volunteer presses. Pressed, _Create the file_
goes to the model as a question: it retyped the notation by hand (refused
twice — no `- ` on the Config lines, then `Structure: Verse 1, Verse 2,
Chorus`), hit the name already in use, and answered with **Overwrite the old
one** as a button — 4 rounds, 32 s, nothing created. The real button: 0
rounds, 1.5 s, saved as _Amazing Grace (2)_. Same class as `EC-89` bullet
one, same fix: `checkIsDraftEcho` in `quickReplyHelpers` drops a model option
that says create/save/copy in other words, only ever beside those two
buttons; and under a draft the corpus follow-ups are not offered at all (the
"question" was a hymn, and its nearest corpus question was _How do I change
where my documents are stored?_). Re-asked on Kimi: the two buttons and one
real reply (_I need to change something_).

---

## EC-96 · A rate-limited paste fell to a bot that searched the manual for the hymn — `done` 2026-09-08

The chip says _paste the words here_; the paste arrived ~25 s after the chip's
own two rounds and Moonshot answered **429 three times in 3.6 s**
(`msh-gid: free`, `retry-after: 1` — the window is a minute, not a second).
The offline bot then ran `owa_help_search` with sixteen lines of Amazing
Grace as the query and said _I could not find that in the app guide_, with
_Can I show you a picture of my screen?_ underneath. The drafter needs no
model, so `askHelpBot` now recognises a lyric-shaped paste
(`checkIsLyricPaste`: four or more short lines, no question, no notation)
and drafts it through `owa_lyric_validate` itself — same two buttons, same
pseudo tools, same hardened create path — and the window's note says _I
wrote the song out myself instead_ rather than _Here is what the app's own
guide says_. Only on the fallback: with a model the model still decides.
Proven live under a real 429: draft in 3.6 s, **Create** → _Amazing Grace
(3)_ in 1.5 s.

---

## EC-97 · A hymnal text page handed over whole drafted sixteen verses of menus — `done` 2026-09-08

The prompt and the tool both say _hand a song page in WHOLE_. Done exactly
that with a hymnal site's text page, the length rule took a region from the
first mention of the first line to the _Text Information_ table — ninety
lines, because _Printable scores: PDF, MusicXML_ is four words — and drafted
**"Untitled" with 16 verses**, the six real ones being numbers 8 to 13 among
_Song available on My.Hymnary_. Both models had produced a good song on this
page only by IGNORING the instruction and copying the stanzas out themselves;
a model that obeyed would have handed a volunteer the menu. Fixed in the
reader: `pickNumberedStanzas` takes a run of stanzas numbered 1…n (plus a
labelled refrain among or after them) as the song on a no-chord page, and
`readPageFields` reads the `Title:` / `Author:` / `Copyright:` table such a
page prints far below the words (the page said _Copyright: Public Domain_ in
plain sight and the draft said _Unknown_). Measured on the same page: title,
author, _Public Domain_, the address in `Attachments`, six verses of four
lines. Proven live on Kimi, which handed the page over whole on the after-run.

---

## EC-98 · What a model ACTUALLY hands the drafter is its own copy, and the drafter read it worst — `done` 2026-09-08

Neither provider hands a page over whole, whatever the prompt says. Claude
copies the stanzas out with the page's title line, _Author:_ and _Tune: NEW
BRITAIN_ on top and passes `from`/`to` around them; the markers were only
ever read on the PAGE path, so the three header lines became **Verse 1** and
Claude spent a round drafting again (5 rounds, 41 s). Three changes, all in
the drafter: `from`/`to` are believed on plain words too; a short unlabelled
block above a run of numbered stanzas is the heading, not a verse
(`dropHeadingAboveNumberedStanzas`, four-line minimum for a verse on every
hymnal), and its first line — cut at the ` | Site` a page title carries —
names the song when nothing else did; and a `copyright` slot on draft mode,
because the page's _Copyright: Public Domain_ line rode along in the model's
copy one time in two. Also: with no `mode`, notation is checked and anything
else is drafted — Kimi called the tool twice on one page for want of the
word. Re-asked on Claude: 4 rounds, one draft, right first time, _Public
Domain_ in the Config.

---

## EC-99 · A taken name was refused with "use update", and the model offered to overwrite — `done` 2026-09-08

`owa_lyric_file create` under a name already in use answered _Use action
"update" to change it, or pick another name_ — and a model asked to create a
song off a page did exactly what it was told, offering **Update the existing
one** as a button under a song the user had never asked to change. The
window's own **Create** button never asks: it takes the next free name. The
refusal now leads with that name (_"Amazing Grace (4)" is free — create it
under that name, unless the user asked to change the existing one_), found
by `findFreeName` in the worker with the same `(n)` scheme. Claude still puts
the choice to the user (_Save as a new name_ / _Update the existing one_),
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

**2026-09-08 update.** Two things moved it without touching it. The model's
tool list is now the 19 `owa_*` tools (`EC-112`): a Kimi request is ~39 KB /
9 262 prompt tokens (was ~45 KB / ~11 000). And Moonshot caches the prefix
on its own — the second round of the one Kimi ask this run reported
`prompt_tokens_details.cached_tokens: 8192` — so the discount half of the
remedy is already in effect; whether cached tokens count against the free
tier's per-minute budget is the number still to measure. Tool routing
remains the structural remedy.

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

The paste chip's answer on Kimi ended with _Here are the lyrics_ / _It's a
link_ / _Never mind_ as pills. Pressing the first sends the sentence, not
the lyrics. A model-written option that describes what the USER will type
next should fill the box rather than be asked — the corpus already has the
`template` idea for exactly this.

---

## EC-92 · A recipe id reached a volunteer in prose, twice on the same question — `done` 2026-09-08

Claude Sonnet 5, _"Where is the button to change the background?"_, the
standing corpus's where-is shape, in the Presenter — verbatim:

> **W-08 has exactly what you need.** In the Presenter, look at the bottom of
> the middle column — there's a thin bar labeled Background. …

Two rounds, one `owa_help_search`, no page opened: the answer was written
from the search hit, and the hit is the one place an id cannot leave — its
`id` field is the handle `owa_help_page` and `owa_guide_start` take. The
prompt forbids "an id like W-06 -- not even in passing", the page tool has
scrubbed ids out of page bodies since `EC-21`, and this still happened; asked
again after the fix the model wrote _"W-08 is the exact match for the
Presenter"_ — so it is systematic on this shape, not a one-off, and the
previous run's answer to the same question (no id) was luck. Leaks on the
ratchet: **0 → 1**, which outranks everything new (`EC-22` was the open
item: "prose answers are still on the honour system for ids").

Two more channels found on the way: the search **excerpt** was never scrubbed
(_"Open the Background panel (W-08 step 1)"_, _"see W-28"_ — page bodies were,
excerpts were not, and a two-round answer is written from the excerpt), and
the guide card's own `stripInternalIds` did not know the lettered id
`W-01b` exists, so it left _"see b"_ behind.

**Shipped 2026-09-08.** Three layers, none of them a sentence in the prompt:

- `scrubRecipeIds` in `help.mjs`, shared by `owa_help_page` (which had its
  own copy of the regexes) and now by every search excerpt; a dangling
  "— see" goes with the id it pointed at. `guide.mjs`'s `ID_PATTERN` takes
  the optional letter.
- `src/chatbot/recipeIdHelpers.ts`: `scrubAnswerRecipeIds` runs at the same
  seam the `OPTIONS:` / `NEEDS:` / `SHOWS:` frames are taken off, LAST, and
  replaces an id with the page's own title — `learnPageTitles` folds every
  search hit and opened page into the tool watch (`pageTitles`, per ask,
  never kept) — or with _the guide page_ when no tool named it. Real-world
  tokens of the same shape (`UTF-8`, `USB-3`) are left alone.
- Proven live on the same question, against a model that wrote the id again:
  _"The guide page “Set the background (color / image / video / web)” is the
  exact match for the Presenter."_ 9 + 3 new tests. `EC-22` closes with it.

What it does NOT do: stop the model writing the id. That is the cheaper
sentence the prompt already carries, measured to fail 2 of 2 here; the scrub
is the rule.

---

## EC-93 · Retrieval ranks the page that MENTIONS backgrounds over the one that SETS them — `open`, medium (evidence for `EC-50`)

`owa_help_search "change background" focus:presenter`: **W-15** (_Create and
edit slides / lyrics / web backgrounds_) scores 66, **W-08** (_Set the
background_) 46 — W-15 says the word more often. The model picked W-08
anyway from the excerpt, and the offline bot would not have: it takes the top
hit. Same class as `EC-50` / `EC-90`; filed as one more labelled case for
the held-out set, not fixed here.

---

## EC-94 · The reader's wrong-window question spends two rounds asking where the user is — `open`, low

Bible Reader focus, _"How do I edit a slide?"_, with the main window on the
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
60/71 (85%), when they disagree the search is right 84 of 180 and the corpus 35. The corpus is not a better ranker. It is a set of LABELS, and a label is
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

**Asked for from the app**, four messages in a row: _"looking for a way to do
pre-training the local assistant, for some task the chatbot should not ask the
llm api"_, _"add build action like `/presenter-screen-show`
`/presenter-screen-hide`"_, _"buildin actions"_, _"so user don't have to ask
llm"_.

**Measured first**, on the standing twelve-question corpus through the real
window (`test-results/chatbot-quality/score-2026-09-02-built-in-commands.json`):

- Claude Sonnet 5 answered _"Turn off the screen for me"_ in 2 rounds and 9
  seconds — correctly, that nothing was showing. Nine seconds and a paid call
  to learn the state of a button.
- The same afternoon ChatGPT answered 429 on every call (out of credit), the
  free pool answered 429 after 62 seconds, and Kimi went 429 from the second
  question on. **33 of the 36 answers on the other three providers were the
  offline bot's**, and it scored **4 of 12**: the screen's state for a
  how-do-I, nothing at all a person could press on the two panic shapes, and
  the wrong page on four.

So the rung-4 promise — _degrades honestly when the key dies_ — was the
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

## EC-84 · The offline bot is what the window has on a bad afternoon, and it got 4 of 12 — `open`, medium (8/12 measured 2026-09-09, then 10/12)

The measurement is in `EC-83`. The twelve offline answers, graded:

| #   | Question                                      | Offline answer                                          | Verdict                                                                      |
| --- | --------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | How do I put a Bible verse on the screen?     | "No presentation screen is showing"                     | wrong — a task read as a screen question. **Fixed**: `TASK_QUESTION_PATTERN` |
| 2   | Where is the button to change the background? | (where-is path; the button is a collapsed bar)          | weak                                                                         |
| 3   | Is anything showing?                          | state                                                   | pass                                                                         |
| 4   | Turn off the screen for me                    | state, nothing to press                                 | pass, barely. **Fixed**: a _Turn the screen on_ command button               |
| 5   | Build a running order                         | W-22                                                    | pass                                                                         |
| 6   | (reader) How do I edit a slide?               | W-02, W-15 offered second                               | partial                                                                      |
| 7   | Nothing is showing on the projector           | state, nothing to press                                 | **Fixed**: the button                                                        |
| 8   | the words no come out big screen              | state                                                   | same                                                                         |
| 9   | Can it stream to Facebook?                    | W-01 + walkthrough buttons                              | wrong — see `EC-85`                                                          |
| 10  | passage scroll itself                         | W-39                                                    | pass                                                                         |
| 11  | How do I add a song?                          | W-21 (the _link_ page, on the word "song" in its title) | wrong                                                                        |
| 12  | and how do I undo that?                       | W-01                                                    | wrong — no follow-up handling offline                                        |

**2026-09-10, seen again** under the spend-guard pause: the guide's own answer to _How do I add a song?_ was still W-21's link-download page. Unchanged, still open.

Two of the wrong ones were one cause: `answerFromManual` appended the focus
NAME to the query, and "presenter" is in the title of the Presenter overview
page — `clear the bible presenter` scored W-01 83 and W-10 42; without the
word, W-10 69 and first. **Fixed** the same day.

**Re-measured 2026-09-09** through the real window on a dead key
(`EC-144`): **8 of 12**, then **10 of 12** after `EC-145` (q02) and `EC-146`
(q06). The two left are the ranker (q11 → W-21, the link-download page, for
_How do I add a song?_ — the corpus row is _How do I make a new song?_, and
the exact-label path needs the exact words) and the follow-up (q12, _and how
do I undo that?_ → the drawing panel's Undo; the offline bot has no
follow-up handling beyond a bare yes/no).

**What is left is the ranker.** `How do I add a song?` → W-21 is
`owa_help_search` scoring the title word, the same class `EC-50` names.
The obvious next step — answer offline from the 262-question CORPUS first,
since every row is pinned to a recipe — was measured too and is not a free
win: `owa_list_questions "How do I put a Bible verse on the screen?"` ranks
_How do I put a song's lyrics on the screen?_ FIRST (`verse` is one of its
keywords) and the Bible question below it. Two rankers, both imperfect,
disagreeing on the same question. Size: a combined score (corpus row → its
recipe, agreeing with the search's top hit → confident; disagreeing → offer
both as buttons rather than guess) is a day, and it is the day that lifts the
offline bot from 4/12 to something a service can lean on. See `EC-90`.

---

## EC-85 · An honest "the app cannot do that" still carries walkthrough buttons for an unrelated page — `done` 2026-09-03

Claude, _"Can it stream to Facebook?"_: the text was right — no streaming, use
OBS — and under it sat **Show me step by step** and **Do it for me**, because
`applyToolWatch` latched the search's top hit, which was **W-01 (Understand
the Presenter window)** at score 2. Pressing _Do it for me_ would have
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

## EC-86 · A 429 costs three retries, and on the free pool a minute, before the fallback — `open`, low (half done 2026-09-09)

Measured: every ChatGPT question spent **3 calls × ~1 s** (the SDK's own
retries) on an `insufficient_quota` 429 that no retry can fix; the free pool
spent **62 seconds** before giving up on question 1; Kimi 8 rounds on
question 2 (4 tool calls, then 429s). A volunteer with a dead key waits three
seconds for the offline answer they could have had at once, and a free-tier
user waits a minute. Fix: `maxRetries: 0` for a quota 429 (the body says
which kind), and a shorter first-round timeout on the free service.

**2026-09-09, half done under `EC-144`:** the OpenAI-shaped loop (ChatGPT,
Kimi, Free) now posts with `maxRetries: 0` for every request — measured, the
three posts were the whole wait, and a busy-service 429 is handled by the
loop's own salvage pass past round one and by the stand-in key or the
offline bot on round one. Still open: the free service's first-round
timeout (the 62 s), and whether the Anthropic loop's default retries are
ever worth their wait on a dead Claude key (unmeasured: no dead Claude key
on this machine).

---

## EC-87 · What lives in a right-click menu is invisible to every tool — `open`, medium

Claude, _"and how do I undo that?"_ after _"How do I add a song?"_: 5 rounds,
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

Kimi k2.6, _"How do I put a Bible verse on the screen?"_: 4 rounds, 43 s,
and it called `owa_guide_start` itself — _"A guide card is now in the corner
of your Presenter window"_ — for a question that asked for words. Harmless
here (a card, not a screen), but the prompt says offer, and a weaker model
read "offer this whenever the answer is more than one step" as "do this". One
sentence in the tool description, measured on Kimi. **Done 2026-09-08**: seen again on _How do I add a background?_ (4 tool rounds, a card drawn over the Presenter, then a 429). The cause was the prompt’s own sentence, _offer to walk them through it and call `owa_guide_start`_, which Kimi read as written. It now says the buttons appear by themselves and the tool is called only when they ASK. Re-asked: 2 rounds, no card.

---

## EC-89 · Three small things the corpus run showed — `open`, low (first one done 2026-09-08; its pattern widened the same day)

2026-09-08, later: **Yes, show me step by step** got past the echo check
beside the button of the same name (the `show me` alternative was anchored to
the end of the reply and `step by step` to its start); the pattern now takes
the button's own words behind a yes. Two cases added to the test.

- Every Claude answer that offered **Show me step by step** also carried a
  model-written _"Yes, walk me through it"_ quick reply beside it — the same
  press twice, in two shapes, which is the wall-of-buttons `EC-12` was about.
  `genMessageReplies` drops exact duplicates only. **Done 2026-09-08**:
  measured 7 of 7 walkthrough answers carrying one (_Yes, walk me through
  it_, _Yes, show me how_, _Yes, show me_, _Show me the demo instead_);
  `checkIsWalkthroughEcho` in `quickReplyHelpers` drops a model option that
  accepts the walkthrough, only ever beside those two buttons — _Show me the
  button_ under a state answer keeps its place. Proven live: the Bible-verse
  answer's buttons went from 4 to 3.
- `/find Clear Bible` (and the offline where-is) answers with the label the
  matcher joined: **BB Clear Bible [F9] Clear Bible** — the title and the aria
  label, twice. `labelPartsOf` already exists for chips; the answer text
  should use it.
- `owa_find_ui "the Background panel"` returns 0 while the panel is collapsed
  to its title bar, though the description promises the _"the X panel"_ form;
  the bare word finds the bar at once.

---

## EC-90 · Two rankers, both imperfect, and no way to know which to trust — `idea`, medium

Measured this run on ONE question, _How do I put a Bible verse on the
screen?_: `owa_help_search` ranks W-06 (right); `owa_list_questions` ranks
the lyrics question first (wrong, on the keyword `verse`). On _How do I add a
song?_ it is the reverse: search says W-21 (wrong), the corpus says W-15 by
its second row (right). Neither is the oracle. The 236 labelled questions are
the test set (`EC-50`); grading the CORPUS ranker against its own labels is
circular, so the held-out 45 paraphrases are the only fair judge of a merged
score. This is the structural item behind `EC-84`: until the two agree or
the window says when they do not, the offline bot cannot pass rung 2.

---

## EC-80 · The window would not say what it was doing — `done` 2026-09-04

**Reported from the app with a screenshot**, mid-answer: the question was
_"Create a lyric file from https://www.example.com/chords/523776"_, and
under it the single line

> Looking it up… press Stop to give up on it.

with a red scribble under it. That question is `owa_read_website` (a real page
fetch, whole-page screenshot included), `owa_lyric_validate mode: "draft"`, a
name check and a create — most of a minute — behind a sentence that does not
change once in it.

The fault is not that the wait is long. It is that the line answers _"is it
alive?"_ while the person reading it is asking _"is it getting anywhere, and is
it doing what I meant?"_ Nothing on screen could distinguish a window still
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
starters: _"should `More...`, when I click it show all list so can know what I
can do"_.

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

**Asked for from the app with a screenshot**: _"should `<-` and `->` for pre
next tip"_.

`EC-78`'s tip line answers _"show me another"_ with a random pick, which is
right for that question and cannot answer either of the two the user actually
had: _show me all of them_ (a random walk gives no way to know when you have
seen the lot) and _bring back the one I was half way through reading_ (a random
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

**Reported from the app with a screenshot.** The assistant was asked _"How do I
show a screen?"_ and answered correctly — the show/hide button in the screen
preview header, or `F5`. It then offered to do it, was told _"Yes, turn it on"_,
and replied **"Done — the screen is now showing."** `owa_list_screens` said
`showingScreenIds: []`. The user's own words: _"it did wrong, it open setting
instead. the report is incorrect. the agent should double check"_.

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

**Related, still open: `EC-37`** — that one is about CONSENT (a "yes" to _would
you like help_ being read as a "yes" to _do it now_). This one is about
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
§_Agent access_; the four rules that matter are region-by-walls-of-wordless-
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

**Half closed by `EC-79`.** The sweep also used to stop at a _translation_, and
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

| attempt                     |                  problems |
| --------------------------- | ------------------------: |
| plain lyrics, as pasted     | 1 (no `ol:Config` at all) |
| a plausible model attempt   |                     **9** |
| a **careful** model attempt |                     **2** |
| a deterministic emitter     |                     **0** |

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
  becomes a lyric somebody sings. It has to be recognised and _routed_ to
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
   that says _Do it for me_.
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
- The model side was told _"Ask them to open it themselves"_ for all five
  windows of their own. It now presses `openFind` for the one that has it,
  exactly as the button path does.

**Verified live** on the reported conversation itself, in the running app: the
same **Do it for me** press, on the same tab, with Settings shut — the Settings
window opens by itself and the answer under the old failure bubble reads
_"**Opening Settings for you.** Look at the app window. A card is showing step
1 of 4..."_. Covered by 5 tests (press-to-open, navigate-not-click, the
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
> window.** _Do this step in the window behind me._

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
told the rule the recipe half was breaking: _"Never tell them to open the
window they are already in."_

**Shipped 2026-09-02.** `genHereNames` reads the descriptor instead: the
`label` a recipe writes in a sentence, the `openFind` written ON the control,
and the label's last word plus "tab" for the shorthand — which is what the
reader's hand-written pattern was carrying. Matched by lowercase substring
rather than a regex built from the label: these are whole control names, and
user-facing text has no business being spliced into a pattern.

**Verified** against the real recipe, not a fixture: `W-16` in Settings goes
from 4 steps starting _"Click the gear (Settings) in the header"_ to **3
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
_"this wrong highlight, and also wrong page. it should help user open setting
page and assist user in setting page."_

The card read **Settings: language, theme, fonts, folders — Step 2/4**, drawn
in the **Presenter**, with a red ring around the **KJV** button of a Bible row
and the line _"The ringed control is in the Bibles panel, at the top right of
this window."_

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
   out of _"Language: click **English**"_.
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
asked _"Can I show you a picture of my screen?"_ and had answered _"Yes, please
send me a screenshot and I'll take a look."_ The user pressed 📷, sent it with
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
   greeting, so the recovery under the error was _"Ask me how to do something in
   the app."_

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
_file-read_ guard, not a _conversation_ guard. The whole body goes back as one
tool result and then sits in `messages` for every remaining round of the loop —
so one unlucky call can cost more than the entire rest of the question, on the
volunteer's own API key, and can push a small model past its context window
outright. The id above is not exotic: it is what `owa_help_search` hands the model
as a top internal hit.

**Fix shape.** Cap what the _model_ receives independently of what the file is:
return the matched section plus a bounded window (a few KB), and let the model ask
for more by section id. Manual pages are small (largest ~40 KB); it is the
`internal` corpus that is huge, and internal pages are exactly the ones the model
is only supposed to _understand_, never quote.

**Shipped 2026-08-31.** `MAX_MODEL_BYTES` in `help.mjs`, split by kind, applied
in `readHelpPage`: a manual page is capped at 40 KB (above the largest one that
exists, so nothing a user needs is cut) and an internal note at 8 KB. Measured
through the app's own MCP host afterwards: the worst-case page went
**208 032 → 8 484 chars (~52 000 → ~2 121 tokens), 24.5x**; pages over 50 KB
3 → 0, over 20 KB 18 → 1 (W-22, a manual recipe, deliberately whole). The cut is
made on a line boundary and says it was cut, because a model handed a page that
stops mid-sentence reports that the steps end there. Covered by `help.test.mjs`.

---

## EC-02 · The chatbot pays for 42 tool schemas on every round — `done` 2026-09-08

Closed by `modelTools.mjs` in two steps: 19 withheld on 2026-09-02 (the
window's own three, the uid-aimed acting tools, the window openers, the
developer instruments) and the last ten chrome-devtools tools on 2026-09-08
(`EC-111`, `EC-112`). The model is offered the 19 `owa_*` tools and nothing
else; the developer's door keeps all 48. The allowlist shape this item asked
for became a denylist declared once, with the audit script and
`modelTools.test.mjs` holding it — a tool added upstream reaches the model
until it is named there, which is the one thing to watch on a
chrome-devtools-mcp upgrade.

Original note:

`llmBotHelpers.ts` sends everything `listTools()` returns, every round, up to
`MAX_TOOL_ROUNDS` (10):

|                     |  tools |                                  tokens/round |
| ------------------- | -----: | --------------------------------------------: |
| `owa_*`             |     13 |                                        ~2 800 |
| chrome-devtools-mcp |     29 |                                        ~5 750 |
| **total**           | **42** | **~8 550** → ~85 500 per question, worst case |

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
[mcp-tools.md](./mcp-tools.md) §_Pruning and scoping_.

---

## EC-03 · `evaluate_script` is offered to the chatbot's model — `done` 2026-09-02

Refused by the firewall and dropped from `tools/list` for every caller
(`MC-02`'s neighbour; see CLAUDE.md §Agent access), and since 2026-09-08 no
chrome-devtools tool of any kind reaches the model (`EC-02`).

Original note:

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
discovers the _CDP_ port that way. A second instance, or 39223 already taken,
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
That is largely defensible. Worth revisiting only _after_ EC-02, when it will be a
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

The prompt forbids "look at the app window" as a _guide card_ step ("something
you say in the chat, never a step"). The same rule is not applied to the numbered
steps in a prose answer, and the fixed panic answer duly opens with:

> 1. Look at the main app window. 2. Find the "Screen Preview" area.

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
nothing" is better answered as _nothing_ than as a note the model is forbidden to
quote. Worth pairing with a prompt line that says an empty manual result is a
legitimate "the app does not do that".

---

## EC-14 · Retrieval cannot answer a symptom, and should say so — `idea`, low

Established this run: "the words no come out big screen" has no lexical path to
the page that answers it, even with the filler words stripped, because no manual
page can state whether _this_ screen is showing right now. The alias table lifted
the panic phrasing onto the right page and could not lift this one, and no amount
of ranking work will.

If symptom questions keep costing a round on a search that cannot help, the
cheaper shape is for `owa_help_search` to recognise the symptom shape itself and
answer with a pointer to `owa_list_screens` instead of its best lexical guess.
Only worth doing if the round is actually being spent — instrument first.

## EC-18 · The ring landed on the wrong control — `done` 2026-08-31

**Reported from the app with a screenshot.** The walkthrough step "Open the
Background panel" ringed **`Background:`** — the background-_transition_ button
in the screen preview footer — and pressing **Do it** opened the transition menu
instead of the panel. Measured live, five things on screen matched the word
"Background" and every one of them tied at tier 1:

| candidate                                     | control?         | label length |
| --------------------------------------------- | ---------------- | -----------: |
| the collapsed **Background** panel bar        | **no** (a `div`) |           28 |
| `Background:` transition button               | yes              |           33 |
| **Clear Background [F7]** button              | yes              |           41 |
| the screen-preview card, the transition group | no               |      57 / 31 |

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

With EC-19 fixed, W-08 step 2 rang _nothing_: the recipe names the whole tab row
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

Visible in the same reported screenshot: the card read _"Open the Background
panel **(W-08 step 1)** and choose the Videos tab."_ The system prompt already
forbids this in as many words — _"NEVER show them ... an id like \"W-06\" — not
even in passing"_ — and the model did it anyway. A rule the model can ignore is
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
on `src/chatbot/chatSessionHelpers.test.ts` — _expected 499 to be 500_ — with
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
walkthrough as `EC-18`. W-21 step 2 — _"Right-click an empty part of the list
(or use the + button in the folder-path bar) and choose **Download From URL**"_
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
  that is its empty part, and right-clicking an item gets the _item's_ menu,
  which is a different menu). Verified against the app before any of it was
  written.
- `dm.findListRegion(point)` answers "which list?" the way the user would: the
  scroller above the point the guide last acted at — a panel opens exactly
  where the bar that opened it was — then the NEAREST scroller to that point,
  and only then the biggest on screen. `state.lastPoint` carries it.
- **A step may take two presses.** After any demo action, a label the step
  itself names that was NOT on screen and now IS comes back as `more`, and the
  card holds the step: _Done - and it brought up "Download From URL". Press Do
  it again to finish this step._ It is never clicked for them — "click
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

Visible in the same screenshot: the step ended _"…and choose Download From URL
**(URL)**."_ `toEnglishOnly` dropped a bracket only when it held Khmer and
nothing else, so `(ទាញយកពី URL)` lost its Khmer and kept its Latin word. Any
bracket holding Khmer is a translation aside and now goes whole. Brackets that
are all English ("(or right-click the empty list)") are untouched. 0 husks left
across the 251 manual steps.

## EC-26 · The ring landed on the wrong control AGAIN, with the panel open — `done` 2026-08-31

**Reported from the app with a screenshot — the same symptom `EC-18` closed.**
The W-21 walkthrough step _"Open the **Background** panel and choose the
**Videos** tab"_ ringed **`Background:`**, the background-_transition_ button in
the screen preview footer.

`EC-18` was verified _"live on the real W-08 recipe from a collapsed layout"_.
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
   than spent on a failed match, and a _region_ noun additionally says the words
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
panel, hint _"The ringed control is in the Background panel, at the middle left
of this window"_; `owa_find_ui "Background"` now answers with the panel first
where it used to answer with the transition button. 9 tests added.

Cost: +97 tokens/round (~8686 → ~8783) for the `Panel > Control` syntax in three
tool descriptions. Tool count unchanged at 42.

## EC-27 · The guide card parked itself on top of its own ring — `done` 2026-08-31

**Reported from the app with a screenshot.** The card opens bottom right and the
ring lands wherever the control is, so a step pointing at anything in that corner
was a card reading _"the ringed control"_ with the ring underneath it. The
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
reading _Look up and present a Bible verse — step 1 of 6_ ringing **Bible
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
**W-20 — Show the keys you press (Keyboard Screencast)**, step 2 of 8: _"In the
panel's title bar, click the keyboard button (`K`)…"_.

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

So "How do I **copy** an answer?" ranked _See who published a Bible translation
(and its **copyright**)_ first, and W-20 was hijacking three separate questions
about screens.

**Shipped.** The tail is capped at three characters — every inflection this
corpus needs ("verses" +1, "screens" +1, "lookup" +2, "presenting" +3) survives
and all 45 pairs are cut, the shortest of which adds four. A real form that
doubles its consonant ("dragging") is lost with them; the base word still
matches, and a wrong page is the more expensive of the two mistakes.

**Also shipped, from the same measurement.** Coverage is now weighted by how
much each word SETTLES rather than by how many words matched. Counting words
read "How do I move to the next slide?" as a three-word question, and the page
that answers it — W-03, whose step 3 is _"step through slides … Arrow keys /
PageUp / PageDown"_ — carries only "slide": one of three, squared, is a 0.11
multiplier, so it scored 7 while a presenting-flow page saying "move", "next"
and "slide" in passing scored 27. The inverse frequencies the score already
computes build the ratio for free, and the square comes off — the weighting is
the discrimination it was standing in for.

Measured on two sets, before → after. Both columns are run against the SAME
knowledge bundle — the one with EC-49's restored page in it — so the ranking
change is not credited with the page restoration (on the older bundle the
baseline is 135):

| Set                                                                 | top-1                     | top-3                     | not in top-5            |
| ------------------------------------------------------------------- | ------------------------- | ------------------------- | ----------------------- |
| The 236 corpus questions, each labelled with its own recipe         | 136 (58%) → **140 (59%)** | 179 (76%) → **186 (79%)** | 38 (16%) → **37 (16%)** |
| 45 held-out volunteer paraphrases (written from recipe titles only) | 21 (47%) → **23 (51%)**   | 31 (69%) → **32 (71%)**   | 11 → 11                 |

Per-query: **26 top-1 answers changed, 9 now right that were wrong, 3 now wrong
that were right** (two of those three are defensible — "What do the reset
buttons in Settings do?" moved from W-16 to W-31, which is where the reset
buttons are). The aggregate is deliberately not the headline: this fix is about
a class of _catastrophic_ misses, where the winning page is from another subject
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
guide with those args _before_ the model is asked anything.

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

**Verified live 2026-09-01 on GPT-5, in the real window, on the reported question itself.** The presenter's starter chip "Is any screen showing right now?" now answers _"No. No presentation screens are showing right now."_ with the replies **Help me show it / Which screen should I use? / No thanks** and **no walkthrough buttons at all** -- the model answered from live state and opened no manual page, so there is no recipe to walk. Pressing **Help me show it** reproduces the reported answer word for word (_"Click **Toggle showing screen [F5]** in the Mini Screen header. Or press **F5**"_) and still carries no walkthrough of anything else. The useful case is untouched: "How do I put a Bible verse on the screen?" answers in five steps and DOES offer **Show me step by step** / **Do it for me**, and pressing it starts `title: "Look up and present a Bible verse"`, step 1 of 6, `find: "Bible Lookup"`, `isTargetFound: true` -- the right recipe, ringing the right control. Note the app's own MCP host caches its ESM graph for the life of the process, so the retrieval half of this was verified through a freshly spawned `bin.mjs` over stdio (`owa_help_search "show screen"` -> `W-10, W-31, W-18`, W-20 gone from the top three) and reaches the running app only on its next restart.

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
"points every recipe at a real manual id" while only checking the _shape_
`/^W-\d{2}[a-z]?$/` — which `W-01b` passed for months. A second test now reads
the ids off `docs/manual-sources/**` and fails on a recipe with no page. Shape
is not existence.

---

## EC-51 · A question could only ever be a sentence of English — `done` 2026-09-02

**Asked for from the app**, with a screenshot of the ask box circled: _"I want to
be able to attach files (especially image), paste image from clipboard, inspect
dom element to attach, attach screenshot ..."_ — then widened twice mid-request:
_"for something unclear the ai should ask for more input from user"_ and _"during
waiting for api response user should able to add more input"_.

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
  is an allowlist per provider (not a flag per model — one chosen through _More
  models…_ has no entry to carry a flag) and the window offers one that can see,
  in a press.

**Asked for while it was being built, and shipped with it**: _"as a user I want
to see where the element is. click the attached selector should highligh the
elelement"_ and _"click on attached file/image should see preview for image or
reveal in file location"_. Every chip is pressable, and what it shows depends on
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

## EC-57 · Prompt caching would pay for the pictures, and for everything else — `done` 2026-09-08

**Shipped, and measured on the wire first.** The standing corpus on Sonnet 5
with no caching at all: 12 questions, 44 rounds, **813 445 input tokens, every
one at full price** ($1.63 at list) — 15 876 of the ~16 000 a round costs
being the tool schemas plus the system prompt, byte-identical across every
round and every question about the same window. After: an explicit
`cache_control` on the system block (tools render before system, so that one
marker caches both, and makes them a READ for the next question inside five
minutes, not only the next round) plus the request-level automatic marker
the API moves along the growing conversation; the last round keeps its tools
with `tool_choice: none` instead of dropping them (dropping them changes the
prefix at byte zero). Same corpus after: 31 rounds, **62 full-price tokens,
41 613 written at 1.25×, 401 601 read at 0.1× — $0.18, an 89% cut**, with the
healthy-loop signature on every question (round 1 reads ~13 000, writes ~85;
round n reads everything so far and writes only the last round's delta). The
Reader focus wrote its own prefix once (13 094) and the next Reader question
read it. Two rules now hold the saving, both written into `askAnthropic`:
nothing that changes per question may enter the system prompt, and
`usage.cache_read_input_tokens` is the only proof — the corpus driver reads
it off the response body. Moonshot, measured on one Kimi K2.6 ask the same
day: `cached_tokens: 8192` on round 2 with no code change, so Kimi's prefix
caches on its own (`EC-100`).

Original note:

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

| Change                                                                | top-1 on the 45 held-out paraphrases |
| --------------------------------------------------------------------- | ------------------------------------ |
| baseline                                                              | 47%                                  |
| IDF-weighted coverage + the prefix cap (shipped)                      | 51%                                  |
| routing through the 236-question corpus with `matchQuestions` instead | 51%                                  |
| reciprocal-rank fusion of both                                        | 56%, and top-3 _worse_               |

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
  answer _"Want me to keep stepping you through on screen? OPTIONS: Yes, walk me
  through it | …"_ — one sentence, marker and all — and a line-anchored parser
  printed the whole frame at the user. The line is CUT at the marker now, and the
  prompt says "on a line of its OWN". The strip is unconditional: a malformed
  frame still disappears.
- **Two follow-ups from one topic are one option.** The corpus offered _"How do
  I add a web page to the Background panel?"_ and _"How do I show a web page as
  the background?"_ side by side. Spread on `resources.recipe` as well as
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

Written down in `.claude/CLAUDE.md` §_Agent access_, in the memory
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

The matcher asked one question about being on screen — _does it have a box?_
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
_"This one only shows while the mouse is over it, so I am holding it up for
you."_ `owa_click {find: "Copy"}` presses it with it on screen.

Cost: **+74 tokens/round** (~8783 → ~8857) for the two sentences telling the
model what `showsOnHover` means. Tool count unchanged at 42. 10 tests added.

**Found while verifying, and worth keeping:** a caller must not test "is it
hidden?" before asking for a reveal. The guide card redraws its step, and on
the second draw the control was visible _because the card was holding it_ —
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
inside its intent: the user agreed to **help to show**, not to _show it now_,
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

| Why the step can't be acted on                                        | Steps |
| --------------------------------------------------------------------- | ----- |
| Bold phrase has no capital (`**step-by-step picker**`, `**version**`) | 34    |
| Step bolds nothing at all                                             | 24    |
| Bold phrase is an action verb (`**Double-click**`)                    | 8     |
| Bold phrase is one character (`**✕**`)                                | 2     |

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

**Reported from the app with a screenshot.** W-06 step 3 — _"The verse renders
in the preview panel. **Double-click** it to present."_ — answered:

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
answered _"Click Bible Lookup at the top to open it again, then find your
verse."_ — it read the window, not the recipe. With the chat window closed it
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
  answered _"No presentation screen is showing right now. This machine has 1
  display(s) available to present on."_ — identically, 10 times out of 10, in
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

## EC-41 · "press" arrived as "pre " twice, and nothing explains it — `idea`, low

Two answers in one 12-run batch came back with the word _press_ broken —
"pre Enter", "Nothing to pre on this step" — and it did not recur in the 18
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
_owa_find_ui_ with the underscores eaten, because `renderRichText` treats `_`
as emphasis the way markdown does. It only showed because the run was printing
a prompt it should not have been (fixed in `EC-38`), so nothing user-facing
depends on it today — but a setting name, a file name or a tool name in an
answer would be mangled the same way, silently. Underscore emphasis is not
worth having in a window whose subject matter is full of identifiers; asterisks
alone would do. **Done 2026-09-08**: it reached the user after all — the starter chip’s own address, `amazing_grace_how_sweet_the_sound`, was drawn as _amazing_ grace _how_ sweet _the_ sound in the YOU message. Underscore emphasis now needs a word edge on both sides (`renderRichText`), so a name with underscores inside it is left alone and `_this_` still slants.

---

## EC-40 · The rescue only covers the DEMO half of a walkthrough — `open`, medium

`EC-38` fires from `act()`, which is the **Do it** press. A user in the ordinary
**Show me step by step** mode gets no press at all: when the step's control is
not on screen the card says _"Do this step in the window behind me"_ and simply
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
  button or **Ctrl+Q**", answered _"I could not do that one for you (nothing on
  screen to act on) - do it yourself, then press Skip."_ Measured before
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
  _Rename this chat_ / _Lock this chat_ / _Close this chat_ / _Close other
  chats…_ / _Clear all chats…_. Notes worth keeping for the next change here:
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
  OpenAI-shaped models alike.** Verbatim, Kimi K3: _"there is one optional API
  key ... **YouTube Data API key** — makes the YouTube panel in the Background
  bar work ... Add it in **Settings → API**."_ GPT-5 on the same question
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
    reading _"Kimi could not answer"_, and Settings rendered in Khmer without
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
apart), asked for by the user: _"add link of those free api website, so user can
aware of providers"_. These are the only providers in the window the user has no
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
sixth of the day. Measured: _"How do I add a song?"_ ran all ten rounds, spent
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
app are translated, so _"Show me លុបព្រះគម្ពីរ"_ is correct and must survive.
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
