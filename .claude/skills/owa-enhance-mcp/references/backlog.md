# MCP backlog — tracked `MC-xx` items

Stable ids so a later run starts ahead of this one. **File what you find even
when you do not do it** — that is what the ids are for. Every item carries the
evidence, so a future run can weigh it without re-deriving it.

Status: `open` · `doing` · `done` · `wontfix` (with a reason).

---

### `MC-50` — everything a user does on the page, by its words · done 2026-10-10

Asked for in so many words: _except security risk, I want the mcp can do
everything that user can do on the page. all modification file have to
provide option to revert_, then _Goal set: mcp tool can user automate
everything_. Inventoried against the live app: a user could right-click a
row, double-click one, press a key with the right panel focused, drag a thing
onto another, use the menu bar, and build a run sheet — and no tool could do
any of them. Shipped, each proven through a FRESH stdio server against the
running dev app (the menu against a scratch second instance, since it needed
the freshly compiled main process):

- `owa_click` `button: "right"` (a `contextmenu` at the control's centre;
  `opened: "menu"`) and `clicks: 2` (click, click, `dblclick`); every
  acting expression now also reports a layer it `closed`.
- `owa_press_key` — the card's keydown/keyup with `key` and `code`, judged:
  the control whose title names the key, every key while a question popup is
  up, Enter/Space on a destructively named focus, F6 BY NAME (measured: with
  the Mini Screen panel collapsed nothing titles F6 and it went through).
  `find` focuses a control first. Ctrl+B opened the Bible Lookup live
  (`opened: "dialog"`), Escape closed it, Delete and F6 refused.
- `owa_drag` — one `DataTransfer` through the five drag events; `place`
  `before`/`after` with Ctrl held. Live: a Documents row onto a run sheet's
  row added the line through the app's own drop handler.
- `owa_menu` — `electron/appMenuAgentHelpers.ts` lists and presses the native
  bar over IPC; refuses DevTools, Quit/Exit, Close, Relaunch, submenus and
  greyed-out items itself. Live: 40 items listed with refusals marked, Zoom
  In / Actual Size / Reload pressed, the refusals refused in sentences.
- `owa_presenting_flow` — list/info/create/rename/delete/add (document by
  Documents-list name, Bible reference, action id)/remove/move/duplicate/
  park/unpark, every change backed up first through a new `presentingFlow`
  editable kind whose restore saves at once (a sheet has no Save button).
  Live: 12 changes and an undo that put a removed line back; the firewall's
  25-a-minute acting budget tripped on the 26th call, as designed.

Cost: host 54 → 60 tools (~13 399 → ~15 243 a round, `owa_scroll` of `MC-54`
and `owa_media_file` of `MC-52` / `MC-53` / `MC-55` included), model 25 → 26 and
**7 789 → 8 316 tokens a round** (`owa_presenting_flow` ~419, the `owa_click`
fields ~62); the ratchet raised to 8 350 in the same change. `owa_press_key`,
`owa_drag` and `owa_menu` are withheld from the model (`MC-56` weighs
offering them). Policy: the same words-half reads every new tool's words; the
page half reads the control; the menu's refusals are the main process's.
Tradeoff stated: ~1 840 tokens a round more on the developer's door, +527 on
the volunteer's, for five things nobody could automate before. Gate: both
typechecks, the src suite (5 086/5 086), the electron suite (787/787),
prettier, eslint and the build check all pass.
`src/setting/bible-setting/BibleImportReviewComp.test.tsx` had failed under
the full run's load (it passed 4/4 alone, imports nothing this change
touched, last changed 2026-10-06): its three timing-sensitive cases now wait
for the book-name picker to fill instead of assuming 30 ms is enough. The policy
probe held 25/25 before and 25/25 after -- its uid check now puts its own
destructively worded button on the page for the snapshot to carry, so it no
longer depends on the user's layout having a Clear All on screen. **Cleaned
up the same day** after a three-way review of the staged work (app workers,
page actions, policy): a trashed clip's size is read with `fsGetFileStamp`
rather than a raw `stat`; the blob cap is enforced where the copy is made
(`keepBlobs`, so an undo's own snapshot of a file the user has since
replaced with a 2 GB one is refused too) and a backup refused or unwritable
after its copies were made deletes them instead of orphaning up to 200 MB
until the prune; `toAgentFilePath` took an optional extension so the media
tool stopped carrying its own copy of the containment check, and the
Documents-list mimetype set is one exported constant; finding a media file
is one `fsCheckFileExist` and the folder is listed only on a miss; a run
sheet's `remove` / `duplicate` answer their count by arithmetic instead of
re-instantiating every line a fourth time; `revert` reads the document
once; `DESTRUCTIVE_KEY_MAP` is a Map (a key spelt `constructor` had been
refused with `function Object() { [native code] }` as its label); both menu
IPC answers go through one try/catch (a `sendSync` with no `returnValue`
hangs the renderer) and are tested; the menu walk is one generator; `after`
on `owa_drag` lands on the NEXT row's top band, because this app's rows
read a Ctrl drop at either edge as the row's own position (proven against
`toPresentingFlowRowDropKind`); `owa_press_key` focuses the keyboard surface
INSIDE a named pane (never a button) and says when nothing there takes
focus; `owa_scroll` walks containers only with the runtime's size floor and
no longer fires a synthetic `scroll` on top of the browser's own; the
question-popup selector is one exported `QUESTION_SELECTOR`; a trailing
extension must start with a letter (`John 3.16` is a verse). Not done, on
record: the find-target → refusal preamble is still inlined in four
expression builders (~40 lines each) — worth one runtime function when the
next tool joins them. Tests: `domMatchActions.test.mjs`,
`agentMenu.test.mjs`, `electron/appMenuAgentHelpers.test.ts`,
`src/helper/agentPresentingFlowHelpers.test.ts`, plus the firewall, notify,
modelTools and agentData suites.

**Still the user's alone, on purpose**, and said so because the ask was
"everything": a confirm the app is asking (every tool refuses it — the data
tools are the revertible route to deleting, and an automation that genuinely
needs to answer one runs with `OWA_MCP_FIREWALL=off` in its own environment,
never by default), a control named for what cannot be undone (the same
route — and every destructive OUTCOME now has one: `delete` on every file
kind, and `revert` on `owa_lyric_file` / `owa_slide_file` for the editor's
Discard, which puts the saved content back into the history behind a backup
where the button wipes the history for good), a native file dialog
(`upload_file` is denied for handing a file off the disk to a page;
`owa_media_file` `import` is the app's own copy IN from a named path instead,
for pictures, clips, tracks, web pages and documents), typing into Monaco
(the editing model needs OS focus; `owa_lyric_file` / `owa_slide_file` /
`owa_media_file` write the content instead, and an open editor re-reads it).

**Written and reverted the same day**, for the record: an
`OWA_MCP_FIREWALL=automation` mode (every security rule kept, only the
point-don't-press interlock lifted, for the operator's own scripted runs)
and, in `strict`, answering a confirm whose own words are NOT destructive
(reading the popup's text through the dictionary rule). Both worked in
tests; the auto-mode classifier refused the test run as a security weakening,
and this skill's own rule is never to widen the policy for convenience — so
the policy stands exactly as it was, and the two ideas are filed here for the
user to ask for by name if they want them.

### `MC-51` — an expanded run-sheet row is not pressable by its bare name · done 2026-10-10

Found by `MC-50`'s live run. Collapsed, the Presenting Flow List row for
`zz-mcp-…` matched `Presenting Flow List > zz-mcp-…` at tier 1 and the drag
landed on it; once the drop had OPENED the sheet, the same `li` read as every
line of the sheet run together, no label part equalled the name, and
`owa_click … button: "right"` refused it as not press-safe with the whole
sheet as `nearest`. The row's `title` is the file name WITH its extension
(`zz-mcp-….owpf`), which `isPressSafe` did not count as the bare name.

Closed in `checkIsNamedNearly` (`domMatch.mjs`): a part that is the needle
plus a file extension (`\.[a-z0-9]{1,5}$`, both sides stripped the same way)
counts as the name. Only the press-safe test reads it — `shownLabelOf` still
hands out "Amazing Grace Amazing Grace.owl", so nothing a caller is shown
changed. "Sunday" still does not press "Sunday Evening.owpf" (a test holds
both). Proven live on a scratch instance: a sheet opened by a click, then
right-clicked by its bare name, opened its menu.

### `MC-52` — media files have no revertible tool · done 2026-10-10

A user renames and trashes images, videos and audios in the Background tabs;
no tool did, because the backup store kept TEXT (25 MB an entry) and a
binary cannot be put back from it. Closed with a `blob` restore
(`agentBackupPlanHelpers.ts`): `saveAgentBackup` copies the file beside its
backup as `<id>.blob-<n>.bin` before the data file is written, an undo copies
it back (and keeps the one it overwrites), and the prune deletes the blobs
with their change. A clip over `AGENT_BACKUP_MAX_BLOB_BYTES` (200 MB) is
refused with the app's own Move to Trash and the Recycle Bin named.
`owa_media_file` (`src/helper/agentMediaFileHelpers.ts`, domain `media`)
lists, renames (extension kept) and trashes a kind's files, withheld from
the model (`MC-56`). `MC-27`'s byte cap is still open for the store as a whole.

### `MC-53` — the Webs panel's `.html` files have no tool · done 2026-10-10

**New File** writes an `.html` into `<data folder>/webs` and the web editor
edits it with `FileSource.writeFileData` -- no editing history -- so
`owa_media_file` `kind: "web"` writes the file the same way: `create` (a
default page when no `content` is given), `update`, `info` (the text),
`rename`, `delete`, each backed up as text.

### `MC-54` — a windowed list cannot be scrolled · done 2026-10-10

`owa_list_ui` and `owa_find_ui` see what the DOM holds, and a virtualised
list renders only the rows in view, so a row past the fold matches nothing. A
user scrolls. Shipped as `owa_scroll` (`genScrollExpression` in
`domMatch.mjs`): the nearest scroller of the control `find` names, or the
list inside the panel named, else `findListRegion`'s nearest list; `to`
`down` / `up` by nine tenths of a page, `top`, `bottom`; a `scroll` event so
the windowed rows render; the answer carries `now` / `max` / `isAtBottom` and
`inView`, the labels pressable afterwards. Acting (it moves the window under
the user), banner _scrolled a list_ (km/fr), withheld from the model — the
file tools find a file by name whether or not its row is on screen. Proven
live on the user's Document List: down, to the bottom, back to the top.

### `MC-55` — a file on disk cannot be imported · done 2026-10-10

A user drags a song file or a picture in from the OS, or picks one in a file
dialog. `upload_file` is denied (it hands a file OFF the disk to a page); the
inverse — the app copying a file at a path the caller names INTO one of its
own folders — is `owa_media_file` `import`: the extension must be one the
kind holds, the copy never lands over an existing file (the app's own next
free name, as a drop takes it), the original is untouched, and undoing it
trashes the copy. Withheld from the model: a path is nothing a volunteer
says to an assistant, and the developer's door is where a library is seeded.
A document (`.owl`, `.ows`, pdf/pptx/docx) is imported the same way with
`kind: "document"`; a song or slide document is then renamed and trashed by
its own tool, which takes the editing history with it.

### `MC-56` — should the model see `owa_press_key`, `owa_drag`, `owa_menu`? · open

Withheld by `modelTools.mjs` on the chatbot skill's standing rules: the prompt
says no tool advances a run (Space), every shortcut a volunteer needs has a
button `owa_click` can name, a drop cannot be read back where
`owa_presenting_flow add` can, and every menu item a volunteer needs has a
button. ~780 tokens a round if all three were offered. The chatbot skill's to
decide, with corpus evidence.

### `MC-46` — Presenter and Reader demos and tips · done 2026-09-28

Added fourteen lessons to the shared Presenter catalog (74 → 88; 78 have a
safe actionable start). They cover Bible Lookup references, Keep Open, history
and study tools; media filters, sorting and folders; flow filters and sorting;
Messages, notice rotation/spacing, foreground Effects and Image Show preparation.
Titles and descriptions are translated into Khmer and French, and tips stay
in their existing topic groups.

Library targets retain the named panel and use the exact localized label so a
Background filter cannot press the Documents or Bible Notes filter. The Khmer
live check caught English "Images" matching a folder-path button, and bare
"Messages" matching part of the translated "Documents" label. Translated scoped
targets and panel-scoped visibility checks avoid both collisions; regressions
cover those choices. Opening steps skip an already-visible panel. Output,
playback and style changes remain
explanation-only: opening Properties would be safe, changing a live overlay
would not. The existing path-editor tooltip is English even in localized UI;
its scoped target deliberately retains that literal label.

Measured through a fresh server: all fourteen lessons reached their explanatory
steps, and screen contents were identical before and after. English, French and
Khmer tip titles/descriptions were checked live. MCP before/after:
53 host tools / 24 model tools / ~7,397 model schema tokens per round; no schema
change. Policy probe: 25/25. No safety, schema cost or developer-interface
tradeoff; the small lesson catalog grows only with text.

#### Reader feature demos and practical tips

Reader-only inventory found saved Bible lists and note-file management absent
from the original 61 lessons; copy formats, Resources and graph tools were
buried in broad overviews. Added 38 focused lessons (99 total), each with a
searchable usage tip and Khmer/French title and detail. Nineteen additions
start with a safe named action, bringing that total to 49; the featured
assistant shelf remains 30. File choices, graph records, native menus,
destructive steps, exports and congregation output remain self-guided.

Reader mixed lessons now mark explanation steps as `look`, so the card says
Next after opening a menu instead of offering a Do it with nothing to press.
Scoped targets translate the panel and control independently. Older-host
inline fallback preserves the full Reader instructions in show mode.
`tools/owa-devtools-mcp/reader-demo-coverage.md` maps the Reader surface to
the lessons and explains how to use them. No tool, public argument or policy
change is needed: baseline 53 tools, 24 to the model, ~7,397 schema tokens per
round. The policy baseline passed 16 checks; its Presenter-only checks were
skipped to honor the Reader-only scope, not counted as passing.

Verification: 67 focused tests passed. All 19 new action-bearing lessons
completed through fresh stdio servers; retries resolved interruptions from
concurrent development reloads and a Bible Information popup left open by the
test driver. The Reader's All tips counter showed 99, searching Copy Text
found its focused tip, and Show it started the HTTP guide with the Copy
control ringed; the final instruction was a `look` step. The after-probe again
passed 16 policy checks and skipped Presenter checks. The host still lists 53
tools, 24 to the model; the measured ~7,394 tokens/round is within the 7,450
ratchet (a concurrent schema wording change accounts for the three-token
difference, not this catalog). File exports and destructive choices were not
executed.

Tradeoff: more static lesson text in the local catalog, no per-question schema
growth, provider calls or new retained state. Benefits both developer and
volunteer callers through the same guide; security policy stays intact.

### `MC-44` — the redaction net missed OpenAI's own key format · done 2026-09-26

Found while checking whether an OAuth-issued OpenRouter key would be scrubbed,
by calling `redactSecrets` on one key of each shape. The generic provider-key
rule was `\bsk-[A-Za-z0-9]{20,}` — letters and digits only — so it stopped at
the second hyphen of every current format: OpenAI's `sk-proj-` (what the
dashboard hands out today), `sk-svcacct-` and `sk-admin-`, and OpenRouter's
`sk-or-v1-`, all went through WHOLE unless a `Bearer` or a named field such as
`apiKey:` sat in front. Two garbled-marker bugs rode beside it: with no capture
group, the second argument `replace` passes its callback is the match's
OFFSET, not `undefined`, so every such marker read `11[redacted …]`; and the
named-credential rule re-redacted a value the key rule had already replaced
(`[redacted` is eight characters), leaving `… firewall] by the app firewall]`.
The old tests asked only `not.toContain`, which all three passed. Now one rule
`\bsk-[A-Za-z0-9_-]{20,}` covers every `sk-` family (the Anthropic-first
ordering it needed is gone), the callback asks `typeof keep === 'string'`,
the named rule skips a value that is already a marker, and
`firewall.test.mjs` checks EXACT output for six formats plus `sk-SK` (the
Slovak locale tag) left alone.

### `MC-43` — expand Reader demos and cover them in Tips · done 2026-09-26

The Reader assistant featured 24 zero-model practice choices while several
safe, universal controls were only mentioned in broad self-guided lessons.
Shipped seven more deterministic Reader choices: type a complete reference,
remove one reference part, toggle automatic Bible audio, filter and sort
notes, and open Reader Settings or Help. Added separate saved-Bibles and
Bible-Notes visibility Tips too, but kept them self-guided after live testing
proved an open pane is a labeled container rather than a pressable toggle. The
shared catalog now supplies 61 Reader tips, 30 with a safe actionable start,
while 30 are featured in the empty assistant. The previous whole-panel lesson
is self-guided for the same reason, so the shelf grows by six while gaining
seven working actions. No tool or schema enum was added, so the 53-tool surface
and model token bill remain flat.

### `MC-42` — resilient Presenter tip demos · done 2026-09-23

Presenter tips could outpace the long-running MCP host during development and
fail with an unknown built-in demo; an older host could also recognize a newly
actionable lesson only as show-only. Tips now retry both stale outcomes with a
compact inline guide. The Presenter catalog exposes safe first actions for 51 of
56 lessons, and mixed lessons resolve explanation-only follow-ups as `look`
steps so **Do it** becomes **Next** after the action. The five disruptive or
native-menu-only lessons remain show-only. Tool count and model schema stay flat.

### `MC-41` — complete Presenter demo catalog · done 2026-09-23

Presenter Tips of the Day exposed only six checked-in demos, leaving documents,
audience screens, media, service planning, help and the native View menu outside
the zero-model guide path. Shipped 56 Presenter lessons through the existing
`owa_guide_start { demoId }` contract: 24 safe deterministic controls and 32
self-guided lessons for state-dependent, native-menu or live-output work. No new
tool or schema enum was added; unsafe effects remain explanation-only, so a demo
cannot change congregation output, reload or relaunch the app, reset the layout,
or open Developer Tools.

### `MC-40` — precompiled Reader demos · done 2026-09-22

The guide could run explicit steps, but every caller had to invent them and the
chatbot needed a model to do so. Shipped a shared `readerDemos.mjs` catalog and a
`demoId` option on `owa_guide_start`; the existing guarded, announced guide still
performs one step per human press. The guide can now choose a named `<select>`
option as well as type/set a slider. No new tool was added. Live: all four demos
completed against the Reader; the localized reference demo pressed Khmer John,
chapter 3 and verse 16, and the search demo explicitly changed a remembered
Resources picker to Find. Model surface: 7,355 → 7,404 tokens/round, under the
7,450 ratchet.

### `MC-39` — walkthroughs aimed at controls hidden behind ⋯ · done 2026-09-22

The Reader’s Font Size range exists inside an `.app-auto-hide` footer opened
by the visible three-dot control. The guide ringed the invisible slider at the
bottom edge, so a senior saw a target that could not be clicked. Separately,
some toolbar controls exist only under CSS `:hover`.

**Shipped.** The guide distinguishes the two prerequisites. A CSS-hover control
is held visible without moving the user’s pointer. A click-open auto-hide
footer rings its real three-dot sibling; the first **Do it** clicks that and
keeps the step in place, and the second acts on the now-visible control. Live,
the first press exposed Font Size without changing it, the second moved the
range by +8, and the test value was restored to 17. Focused guide tests pin the
two-press sequence.

## Security

### `MC-01` — the HTTP door has no credential · done 2026-09-23

Proven 2026-09-01: a plain Node script with no credential opened a session and
called tools. Closed with a fresh 256-bit token from `startOwaMcpHost`, written
beside the endpoint in `<temp>/open-worship-app-cdp/<pid>.json` (mode 0600),
required as `Authorization: Bearer` on every `/mcp` request, and passed to the
chatbot over the existing synchronous endpoint IPC. The token never enters the
URL, a log line, a tool result or the model context. The audit and live verify
scripts read the same published pair; URL overrides require `OWA_MCP_TOKEN`
too, so a capability is not sent to a different local service by accident.

Before: missing credentials initialized a session and called tools. After: a
missing or wrong token gets `401` before session routing; the published token
reaches the normal MCP response, and the real chatbot still lists and calls
tools. Origin checking remains as the browser-facing first layer.

Residual, stated rather than hidden: a process running as the same OS account
can read the discovery file. This closes the browser and cross-user cases; it
does not pretend to sandbox the operator's own processes. The stdio developer
door and the model's tool schema are unchanged.

### `MC-02` — the destructive interlock is label-based · done 2026-09-02

Closed on BOTH of the options it listed, because they close different halves.

Server-side, at the seam both doors share: `genUidLabelMemory` in
`firewall.mjs` reads the snapshot on its way OUT and remembers which uids are
destructively worded, so `click`/`fill`/`fill_form`/`drag` are refused with the
same `destructive-uid` message `owa_click` gets. What it remembers is almost
nothing — only rows that are BOTH an interactive role and destructively worded,
which is one entry for the presenter's entire 354-line tree — replaced per page
rather than merged, because chrome-devtools mints fresh uids on every snapshot
and a stale refusal is worse than a missed one. Fed from every tool result, not
just `take_snapshot`'s: every acting tool takes `includeSnapshot`.

It fails OPEN on a uid it never saw, which is the same call `redactSecrets`
makes — a uid the model was never shown is a uid it cannot aim with.

Client-side, `modelTools.mjs` withholds those four (and `hover`, `type_text`)
from the chatbot's model entirely, so the recovery above is defence in depth
for the door where it matters least. See `MC-06`.

Verified live through a fresh server: the probe takes a real snapshot, finds
`uid=1_112 button "Clear All"`, aims a real `click` at it and is refused;
a uid the snapshot never named is not.

### `MC-23` — the interlock read English words, not the control · done 2026-09-14

Found by reading the policy against the dictionary, not by a report. The
destructive interlock was twelve English regexes on a call's `find`, and three
things walked past it: **every Khmer label** (41 destructive keys translated,
none caught — and `owa_list_ui`, `owa_list_screens` and the manual all hand the
model the words as displayed); **folded spacing** (`Clear All` with a no-break
space matched no pattern and pressed Clear All [F6]); and **the walkthrough**,
whose `owa_guide_step` `do` pressed a step's `find` or `press` with no words
read at all (`press: "F6"` is Clear All).

Closed in two layers, the `webUrlPolicy.mjs` split. `destructiveLabel.mjs`
holds one rule — the English patterns plus every translation of a
destructively-worded dictionary key — which the firewall reads on the words
(cheap, logged) and the PAGE reads on the element about to be pressed
(`PRESS_GUARD_SOURCE`, the module's own functions as source text): a title or
aria-label that cannot be undone, a key whose titled control cannot be, a
picker being set to such an option, and anything inside the app's confirm /
alert / input popups, which is the user's to answer. A translation the
dictionary shares with an allowed control stays pressable (Khmer Clear Bible IS
Delete Bible); the app's confirm stands behind it.

Proof: dictionary-wide tests (every destructive translation refused, NO
ordinary one), and `probe-mcp.mjs` 15 → 25 checks live — a button TITLED Delete
refused with 0 clicks on it, a press inside a question refused, an ordinary
press still landing, and the walkthrough refusing too. Cost: nothing to the
model; ~1.5 KB of rule rides each press.

### `MC-03` — `window.open` is a way back to Node · open

A renderer locked down by `rendererLockdown.ts` can still call `window.open`,
which goes through `handlePopupWindowOpen` and gets
`genWebPreferences`'s `nodeIntegration: true`. Code already running in the
chatbot window could get a fresh window with Node in it.

It requires code execution in that window first — which is what the lockdown
and the CSP exist to prevent — so this is defence in depth, not the front line.
The fix is to carry the lockdown decision into the popup's `webPreferences`.

### `MC-04` — `appProvider.fileUtils` is full `fs` in the chatbot window · open

The lockdown takes `require` away; the provider bridge still hands that window
`readFileSync`, `writeFileSync`, `unlinkSync` and the rest. It genuinely needs
some of it — `reportHelpers.ts` saves a report and a picture into Downloads,
`downloadImageBase64Data` saves a copy — so this is a capability-narrowing
project, not a deletion: give the chatbot page a reduced provider carrying only
the calls it makes.

### `MC-05` — redaction is a net, not a proof · open

`SECRET_PATTERNS` catches provider keys, bearer tokens, JWTs and named
credentials. A secret in an unanticipated shape gets through. This is accepted
rather than solved: it is why the tools that dump memory wholesale are denied
outright instead of being trusted to the net. Revisit if a new provider or
credential shape lands — `MC-44` is what happens when nobody does: OpenAI's
own `sk-proj-` format, its default, was getting through whole.

---

## Performance

### `MC-06` — prune the chrome-devtools group from the model's list · done 2026-09-02

Done, and wider than filed. `CLIENT_ONLY_TOOL_MAP` moved out of
`llmBotHelpers.ts` into `tools/owa-devtools-mcp/modelTools.mjs` — plain ESM,
no `node:fs`, so the renderer bundles the module the audit script reads — and
grew from 3 names to 19 in four documented groups. Measured: **the model's list
went 41 tools / ~8 938 tokens per round to 25 / ~5 721**, ~32 000 tokens off a
worst-case ten-round question, with the host's 44 untouched.

Two things filed with it, both found while doing it:

- The map was never ENFORCED. `runMcpTool` called whatever name the model
  returned, and these tools are named in the app's own manual, which the model
  can read — so "the assistant does not get to reach for a camera on its own"
  was a comment, not a rule. It now refuses with a sentence saying what to use
  instead, the same shape the firewall answers with.
- `take_screenshot` was in the model's list the whole time, quietly undoing the
  decision that put `owa_screenshot` in the client-only map.

`audit-mcp-tools.mjs` now reports the host's bill and the model's bill
separately and prints a withheld tool as `(name)` — reporting only the total is
how a tool added "for the developer" ends up billed to every volunteer.

### `MC-07` — the two biggest owa descriptions have never been cut · done 2026-09-18

`owa_guide_start` is 1 211 chars of description (1 625 of schema);
`owa_help_search` is 579. Both earn some of it. Neither has been reviewed since
it was written, and both are paid for on every round of every question.

**Done, `/owa-enhance-mcp tools`, and wider than filed.** The model's bill went
**7 990 → 7 253 tokens a round (−737, −9.2%)**, the host's 13 600 → 12 863,
and the ratchet's ceiling came down with it (8 200 → 7 450) so the saving
cannot be spent back unnoticed. What was cut, and why it could be:

- `owa_guide_start` 725 → 430: prose the schema already carried, and **a rule
  the chatbot's prompt reverses** ("offer this whenever the answer is more
  than one step" — the prompt says start it only when ASKED; the window offers
  the buttons itself). Its `labels` argument went too: the card's button words
  in the user's language, passed by nothing in 358 recorded asks.
- `owa_lyric_validate` 520 → 411, dropping another contradiction: "check
  notation you wrote yourself BEFORE you offer it" stood two sentences before
  "never write the notation yourself".
- `owa_tran` 302 → 224 (called 0 times in 358 asks), `owa_help_search` 439 →
  331 (the internal-note lecture is repeated on the page itself), and small
  cuts to `owa_present_bible`, `owa_foreground`, `owa_list_questions`'
  `focus`, the slide tool's second "unsaved" sentence, and one shared
  `PAGE_TEXT` for the six `page` arguments that described themselves.

**One cut was too deep, and only the live window showed it.** With the
contradiction gone, _Walk me through changing the background to a colour_ got
steps and an OFFER — the model read "never demo a step that changes what the
congregation sees" as covering the walkthrough itself. One sentence back —
_the default `show` presses NOTHING, so start it when they ask to be walked
through_ — and the re-ask started the card with the model's own three steps,
the ring on **Background** (`isTargetFound: true`). +25 tokens, kept.

Tool-call counts behind the choices, off every recorded ask in
`test-results/chatbot-quality/` (358): `owa_help_search` 168, `owa_help_page`
132, `owa_list_screens` 104, `owa_app_state` 66, … `owa_guide_start` 2 (the
window starts most walkthroughs itself), and 0 for `owa_tran`,
`owa_guide_step`, `owa_guide_status`, `owa_goto_page` and `owa_type`.

---

## Correctness / usability

### `MC-08` — `verify-chatbot-*.mjs` hardcode port 39223 · done 2026-09-23

Inherited from the chatbot skill's `EC-05`. The MCP port is a preference, not a
promise: `host.mjs` falls through to a free port when 39223 is taken. Both
verify scripts now read the newest published `mcpUrl` and `mcpToken`; the E2E
driver takes the pair from the same live instance whose CDP port it probes.

### `MC-11` — the audit's soft imports never ran on Windows · done 2026-09-02

`loadDescribeToolCall` did `import(path.join(...))` — a bare `C:\...` path,
which throws `ERR_UNSUPPORTED_ESM_URL_SCHEME`, into a bare `catch {}` that
returned null. So the "acts on the window but is NOT in `notify.mjs`
`ACTING_TOOLS`" check, the one thing in that script that is about safety rather
than cost, had been silently skipping for its whole life. Fixed with
`pathToFileURL`, one loader for both modules, and a catch that SAYS it failed.

It also probed with `describeToolCall(name, {})`, which reports `owa_find_ui`
as unannounced — that tool announces itself only when asked to draw. Now
probed with `{ highlight: true }`.

### `MC-12` — a firewall rule that refused reloading the page in front of it · done 2026-09-02

Found by using the tool, not by reading it. `navigate_page` with
`type: "reload"` carries no `url`, so the allowlist had nothing to look at and
refused it — along with `back` and `forward`. Reloading the window an agent is
already looking at cannot go anywhere by definition, and history is safe for
the same reason the allowlist works: nothing outside the app can be navigated
TO, so there is nothing outside the app to go BACK to. A `url` that IS present
is still checked whatever the `type` claims.

Worth generalising from: the policy's false-refusal surface is only visible
from the driving seat. `probe-mcp.mjs` now covers it.

### `MC-15` — a locked-down window threw a raw `ReferenceError` · done 2026-09-02

`owa_screenshot` against `chatbot.html` answered
`ReferenceError: require is not defined`. Correct in substance — that is
`rendererLockdown.ts` doing its job, and it is the one window that must not
have Node — but a stack trace is not an answer. `SCREENS_EXPRESSION` right
above it already guarded with `typeof require === 'function'`; the capture and
hide-screens expressions did not.

Both now say what happened and what to do instead ("ask the app window instead
by leaving the page argument unset"), which is the §C honest-failure rule: a
tool that cannot do a thing should leave the caller able to make the next call
a correction rather than a guess.

Watch the `EC-60` trap when editing these: they are template literals, and a
backtick in the message takes the whole file out.

### `MC-13` — `press_key` is the model's last unguarded input · open

Update 2026-09-14: `press_key` has been withheld from the model since
2026-09-08 (`modelTools.mjs`), and its one twin the model could still reach —
a walkthrough step's `press`, done by `owa_guide_step` — is refused when the
control whose title names that key cannot be undone (`MC-23`). What is left
open is the developer's door, where `press_key` is still unguarded.

With the uid-aimed acting tools withheld (`MC-06`), the model keeps
`owa_click`, `owa_type` — both label-guarded — and `press_key`, which is
guarded by nothing. Enter on a focused _Move to Trash_ is a destructive press
the interlock cannot see, because no label is named at any point.

Not closed here because the cure looks worse than the disease: `press_key` is
how a dialog gets dismissed and how a list gets walked, the attack needs the
focus to already be on a destructive control, and refusing keys by guessing at
focus would refuse ordinary work. Options if it is ever worth doing: read the
focused element's label the way `genUidLabelMemory` reads a snapshot, and
refuse Enter/Space when it is destructive; or withhold `press_key` too and see
whether anything the chatbot does actually needs it.

### `MC-16` — `captureWebScreenShot` loads foreign pages loosely · done 2026-09-17

Found while building `owa_read_website`, which deliberately did NOT reuse it.

`captureWebScreenShot` in `electron/electronHelpers.ts` is what renders a
website canvas item and a web background. It opened a hidden `BrowserWindow`
with `webSecurity: false`, on the app's DEFAULT session, with no
`setWindowOpenHandler`, no permission handler and no `will-download` handler —
and it loaded whatever address was in the slide.

**Measured against the running app before anything was changed**, by serving a
page on this machine's own LAN address and capturing it the way a website item
does. The page reached `127.0.0.1` and `localhost` — where this app's CDP and
MCP doors live, the same pair the AI Chat guest was walled off from on
2026-09-12 — and `file:///…/package.json` captured 58 622 characters of the
operator's disk. Neither needs a model or an agent: opening a shared
presenting flow is the whole delivery.

Closed by `electron/webCaptureHelpers.ts`, on the rule **a capture may talk to
the site it was asked for and to the public internet; never to this machine,
and never to anything else on the local network**:

- Its **own memory-only session**, so the page cannot read a cookie or a
  cached response belonging to anything the user is signed in to.
- **Permissions, downloads and `window.open` refused**, plus `sandbox: true`
  and no preload.
- **`resolveCaptureTarget`** — a web address, or one of the app's OWN local
  pages, at the first load and at every redirect, which is what closes the
  `file://` disk read.
- **The network wall**, `onBeforeRequest` over four patterns (`*://*/*`,
  `ws://*/*`, `wss://*/*`, `file:///*`) and the same `webUrlPolicy.mjs` dialect
  the guest's uses. The **same-host exemption** is what keeps a church's own
  intranet notice board working: a private page may load its own assets and
  nothing else private. Loopback gets no exemption at all.

`webSecurity` is deliberately still OFF. It is the one setting here that might
be load-bearing for a real user's slide, nothing measured says whether it is,
and the wall closes what it would otherwise open — so flipping it would risk
somebody's slides for no measured gain. That is the residual.

Re-measured after, same harness: the notice board captures **byte for byte the
same 7 106 characters** and still loads its own image and fetch, reaches this
machine not at all, and `file://` is refused in a sentence.
`https://example.com` and `https://en.wikipedia.org/wiki/Hymn` still capture
(28 462 and 167 822 characters), so cross-origin assets on a public page are
untouched. Unit rules in `electron/webCaptureHelpers.test.ts`, against the
REAL dialect — a hand-written twin is what gets `127.1` and `0x7f.1` wrong.

**Amended 2026-09-24 — the app makes local pages of its own, and "http(s)
only" switched them all off.** Reported with a screenshot of the console: six
`Only a web address can be captured, not: file:///…/webs/test1.html` errors,
the Background **Webs** tab and the Foreground **Web Show** panel showing the
globe-and-url placeholder for every file, and the one remote URL item beside
them still carrying its picture. Those pages are the app's own: **New File** in
that panel writes an `.html` into `<data folder>/webs` and the app's own editor
edits it. The bullet above was scheme-shaped, and what separates those pages
from `file:///C:/Users/.../setting.json` is the FOLDER. `resolveCaptureTarget`
now takes a `file:` URL when it is an `.html`/`.htm` inside a folder the Webs
panel was pointed at — the `select-dir-web-bg*` directory settings plus the
default `<data folder>/webs`, read by `listWebCaptureDirPaths` in
`electronHelpers.ts` (5 s cache, asked only for a URL that is not http(s)) —
with `..` resolved away and case folded on Windows and macOS only. `file:///*`
joined the wall's patterns, which is a TIGHTENING as well as a loosening: no
`file:` request had ever been judged, so a SITE's page could read the disk
through `webSecurity: false`, and now it cannot while a local page reaches its
own folder and no further. A shared document fails the same test by naming the
other church's folders; where the two really are the same item,
`$DATA_DIR_PATH` has already rewritten it into this user's own webs folder.
Proven live both ways with a page dropped in that folder that fetches a
sibling and a file one level up: sibling READ, level up BLOCKED, and the six
tiles came back with a clean console.

### `MC-17` — the outbound budget has no per-site memory · open

`owa_read_website` is capped at 10 reads per rolling 5 minutes, which bounds
the exfiltration channel to roughly a postcard per read. What it does not do is
notice SHAPE: ten reads of ten different unknown hosts inside one question is a
very different event from ten reads of Wikipedia, and only the first looks like
data leaving. The counter is deliberately dumb because a wrong refusal
mid-service is worse than a missed signal, but a cheap improvement exists —
count DISTINCT hosts in the window and refuse past a handful, which no honest
question would reach. Filed rather than done because it wants a real corpus of
question traces to pick the threshold from, and there is none yet.

### `MC-14` — the tool budget has no ratchet · open

The surface grew 19% in a day because adding a tool is easy and nobody is
billed at the time, and the only thing standing against that is this file
asking people to run a script. `audit-mcp-tools.mjs` now knows the model's
bill exactly; a test that fails when it crosses a recorded ceiling would make
the next regression impossible to land quietly. Cheap to write, and it needs a
running app, which is why it is not a unit test — likely a `--max-tokens=`
flag on the audit script plus a line in the run sheet.

2026-09-14: half of it. The audit gained `--stdio`, which lists a FRESH server
spawned from the code on disk — so an edit is measured without restarting the
operator's app (the in-app host caches `server.mjs`). It was used to trim the
data tools from +1 244 to +1 089 before the row was written. The ceiling that
fails a run is still not written.

2026-09-17: **done.** `--ratchet` (with `--ratchet=<n>` to try another
ceiling) fails the run when the MODEL's bill crosses `MODEL_TOKEN_CEILING`,
recorded in the script at **8 200** against a measured 7 990. Three decisions
worth keeping:

- The ceiling is on the **model's** bill, not the host's. The developer's door
  may grow; a tool added "for the developer" that quietly reaches the model is
  exactly the regression this catches, and reporting one total is how that
  lands unnoticed.
- The headroom is **one small tool**. It is not a budget to spend down to — a
  deliberate addition raises the line in the same change and says why, which
  is the whole mechanism.
- The failure **names the three biggest model-visible tools**, because the
  person reading it is deciding what to cut and the biggest row is usually the
  answer.

Proven both ways against the live app: `--ratchet` exits 0 at 7 990/8 200,
`--ratchet=7000` exits 1 and names `owa_guide_start` (~725), `owa_slide_file`
(~622), `owa_lyric_validate` (~520). Still not wired into `npm run lint` —
it needs a running app, so it belongs in a run sheet rather than the gate.

### `MC-26` — verse marks cannot be made by a tool · open

`owa_bible_note` lists and reads a verse's highlights and comments, and removes
a verse-marks item whole, but cannot ADD a highlight or a comment: a mark is a
character range in one translation's rendered verse text
(`verseAnnotationHelpers.ts` `addVerseHighlight(anchor, offsets, color)`), so a
tool would need the verse text, the words to mark and the anchor the Reader
builds. Filed rather than done because nobody has asked the assistant for it.

### `MC-27` — the backup store is bounded by count and age, not bytes · open

`agent-backups/` keeps the last 100 changes for 30 days and refuses one entry
over 25 MB. A slide document with pictures inline can approach that, so 100 of
them is a lot of disk on a small machine. A total-size cap is a directory
listing with sizes at prune time; not written because no such document has
been measured yet.

### `MC-28` — paths of the data tools not yet driven live · open

The 2026-09-14 live run drove 36 checks across songs, slides, Bible items and
notes (all held after `MC-25`). Not driven live: `owa_bible_item` `update` by
`version` alone (`BibleItem.fromVerseKey`), `rename-list` and `rename-file`,
`owa_bible_note` `update` of a title only, `add` into a Default that does not
exist yet, and the refusal while a note window is open. Unit-level logic is
covered; the app glue is not.

### `MC-29` — the full gate collides with a concurrent session · done 2026-09-18

`npm run lint` ends in `prettier --write "src/**"` and a `build` that deletes
`electron-build/`. On 2026-09-14 another session was editing chatbot and
settings files and had the dev app up: prettier would have rewritten its
unfinished files and the build would have killed its app. The stages were run
individually instead (tests, typecheck, eslint over `src` and `electron`,
prettier on this change's files only) and the build was left to the operator.

**Closed by `EN-16`** (`/owa-enhance dev-flow`, run `20260918-1109`): the gate
only checks now — `prettier --check` (`npm run format` writes) and a build
into a temp dir (`extra-work/check-build.mjs`) — so it runs beside a live app
and a peer's unfinished files. The piecemeal route had a hole of its own: the
build it left out was the only electron typecheck (`EN-14`).

### `MC-30` — `OWA_CDP_PORT` is a preference for the `owa_*` tools, not a pin · done 2026-09-17

Seen 2026-09-14 while verifying `MC-24`, with three sessions sharing one dev
app. `listCandidatePorts` puts `OWA_CDP_PORT` first and then EVERY published
instance, and `requireLivePort` takes the first that answers. So when the
pinned port is dead, every `owa_*` call goes to the newest instance instead,
while chrome-devtools' own tools (`resolveAppBrowserUrl`, no liveness check)
keep failing on the dead port. A dev app restarted by nodemon comes back on a
NEW port, so a script pinned to dev a minute earlier is then driving whatever
was published last — the packaged app, with the user's real data, if it is up.
That day's render proof ran "pinned" to 53801 three minutes after a peer's
restart had, by its report, moved dev to 61610, and it still succeeded; only
the path it printed (`open-worship-data-dev`) showed it had been dev. Nothing
wrong was driven: no packaged app was running.

Two ways to close it, not taken because both change the developer's door:
make the env port exclusive (fail with "port X is not answering; the app
published Y"), or pin by KIND off the discovery file's `isDev`
(`OWA_CDP_TARGET=dev`), which survives a restart and is what a verification
script actually means. Until then, a script that writes checks
`owa_app_state` `isDev` first.

**Closed 2026-09-17 on the first of the two.** A port named on purpose — by
`pinCdpPort` or by `OWA_CDP_PORT` — is now the WHOLE candidate list, which is
what `resolveAppBrowserUrl` had always done, so the two halves of one server
can no longer drive two different apps. `describeDeadPin` in `discovery.mjs`
writes the refusal `requireLivePort` throws: _"Port 9999 was named by
OWA_CDP_PORT and is not answering. The app published 62807 (dev). Point
OWA_CDP_PORT at one of those, or unset it to take the newest."_ The old
message said "start the app" with the app right there on another port, which
is the half of this that made it hard to notice.

Proven both ways against the live app: the shipped HEAD version answers
`9999, 62807, 9223` for a dead pin — it would have driven 62807 — and the new
one answers `[9999]` and refuses by name, while an unpinned call still
resolves 62807.

The second way, `OWA_CDP_TARGET=dev`, survives a nodemon restart, which a port
does not. Shipped as `MC-31` below.

### `MC-31` — pin by KIND, not by port (`OWA_CDP_TARGET=dev`) · done 2026-10-07

Split out of `MC-30` when its first half closed. A pinned PORT is exact and
dies with the instance: `npm run electron:dev` restarts the app on a new port
whenever `electron-build/` or `tools/owa-devtools-mcp` is touched, so a script
that pinned dev correctly a minute ago now refuses (which is the fix) but
still cannot get itself back to dev without re-reading the discovery file.
Before: setting `OWA_CDP_TARGET=prod` still resolved the running dev app and
included legacy port 9223. Now both discovery paths and the bridge filter on
the exact published `isDev` boolean. Missing kinds and invalid nonempty values
fail explicitly; neither unknown instances nor legacy ports satisfy a kind
pin. Explicit port pins retain priority. Discovery is re-read per call, with
no cache. Multiple instances of the same kind still use newest-first order.

Live: one long-lived stdio server followed an isolated dev app across a real
restart and port change, through both `owa_app_state` and `list_pages`.
`prod` refused while only dev was available. The bridge connection reached
the dev CDP endpoint and refused absent prod too. A fresh HTTP host with two
sessions stayed on its pinned dev app despite a contrary `prod` environment;
both sessions were removed by the idle sweep under a controlled clock.
Screenshot captured and inspected. Focused discovery/HTTP checks: 23 passed.
Policy baseline: 16 checks passed on the original Reader, Presenter checks
unavailable; scratch Presenter then passed 24/25, missing a visible destructive
uid target during startup. After the restart the full probe passed 25/25.
These availability differences are not claimed as policy improvements.

Before/after: **54 host tools / 25 model tools / ~7,789 model schema tokens per
round**, unchanged and within the 7,800 ratchet. No new tool, cache or policy
exception. Tradeoff: selecting a kind deliberately gives up automatic fallback
to other kinds in exchange for safer developer targeting; the in-app host
retains its own explicit port pin.

Gate: both typechecks passed. Source suite: 4,813 passed, two unrelated screen
tests timed out at 10 seconds; their two files passed all 13 tests on a focused
rerun with two workers. The skipped stages were run separately: 618 Electron
tests, Prettier, ESLint and the production build check all passed. No test
timeouts or repository-wide formatting settings were changed.

### `MC-49` — a host pin not known yet still falls through · open

`pinCdpPort(() => null)` still falls through to environment/discovery while
Chromium is starting; `discovery.test.mjs` explicitly preserves this older
behavior. Once the port is known, the host is exclusive. A future change should
decide whether an installed but unresolved host pin must fail closed during
startup and verify early HTTP sessions. Kept separate from `MC-31`, whose kind
filter does not change the existing explicit-pin startup contract.

### `MC-20` — the app's own `PART_DEFINITIONS` has no drift guard · open

`src/plugins/song-select/songSelectLyricHelpers.ts` carries its own hand-copied
copy of open-lyric's structure-code table (probed live in 2026-08 and correct
today). `MC-19` gave `tools/owa-devtools-mcp/openLyric.mjs` a test that reads
`node_modules/open-lyric/schema.md` §8.1 and fails when a table disagrees; the
SongSelect copy has nothing of the sort, so an open-lyric upgrade that renames
a code breaks song import silently. The guard is ~15 lines and the mechanism
already exists — it just has to be pointed at the second copy. (Better still:
one exported table, but `tools/` is plain ESM and `src/` is TypeScript, and
neither may import the other.)

### `MC-35` — `owa_guide_status` could ride `owa_guide_step` for the model · open

Found by `MC-07`'s call counts: 0 model calls in 358 asks, and the one moment
the prompt sends the model to it — "check your aim once, after you start it" —
is already answered, because `owa_guide_start` RETURNS `status()`
(`isTargetFound`, `nearMisses`, `canDemo`). Adding `status` to
`owa_guide_step`'s action enum and withholding `owa_guide_status` in
`modelTools.mjs` would be ~−120 tokens a round with nothing taken from the
developer. Not done: the prompt names the tool twice (chatbot skill's to
edit), and the one real use — reading where the user got to on the card
before answering "it didn't work" — has never been measured either way.

### `MC-36` — the walkthrough card's own buttons are English in every window · open

`owa_guide_start` took a `labels` argument for the card's Next / Back / Done /
Step words "in the language of the user". Nothing ever passed it — the
chatbot answers in English by rule — so it left the schema with `MC-07`, and
the card still reads Next / Back / Done / Do it / Skip in a Khmer window. The
right fix is the server's, not the model's: fill them from `tranText` at
start, the way help pages are. It needs dictionary keys first — `km` has
`Next` and `Back`, not `Done`, `Step`, `Do it` or `Skip` — and a missing key
THROWS in dev, so it is a change to `src/lang` as much as to this package.

### `MC-37` — `checkAgentFileName` passes a Windows device name with an extension · done 2026-10-05

The old pattern matched the whole name, so `nul.old`, `CON.backup`,
`COM¹.old` and `LPT³.backup` passed. Live baseline calls through a fresh
server returned missing-file or malformed-content errors, hiding the actual
name problem. The shared validator now matches the device stem before the
first dot, including superscript digits, and preserves the app's conservative
COM0/LPT0 refusal. Tests check exact refusal text for bare names and single
and multiple extensions, plus nearby valid names that must remain usable.

Both document tools now refuse invalid source names and rename destinations
before content validation or disk access, using the same rule at the renderer
boundary. No tool, schema, retained state or firewall relaxation is added.
The tradeoff is intentionally refusing these nonportable names on every OS;
both developer and volunteer callers get the reason directly.

Live verification: sixteen filename checks and two ordinary file lists passed
through each of fresh stdio and restarted HTTP servers, including Bible-list
and note-file names. The renderer boundary also refused `nul.old` for both
document kinds. Baseline policy probe: 25/25; before and after, 53 host tools /
24 model tools and ~13,043 host / ~7,433 model schema tokens per round, within
the 7,450 ratchet. Full lint gate passed, including 4,905 tests. Transcripts
are in `test-results/mcp-filename-*-before.json` and `*-after.json`.
Chatbot-window verification is pending the user's explicit authorization to
accept the development AI caution; the server checks do not stand in for it.

### `MC-47` — corpus tests do not enforce the question-kind enum · open

While adding the MC-37 question, `questions.test.mjs` passed with
`kind: "troubleshoot"`, although `questions/schema.json` permits only
`howto`, `where`, `what`, `state` and `fix`. The new entry was corrected to
`fix`; adding enum validation to the corpus regression checks is deferred.

### `MC-38` — a broad recipe's demo started at the wrong task and could not hover or move a slider · done 2026-09-22

Measured from the chatbot's **Do it for me** under _The words are too small_:
`owa_guide_start` replayed W-11 from Bible Reference, step 1/7. The server knew
only the manual id, not the question that selected it. A later Font Size step
could reveal the CSS-hidden row, but its default click landed on a label and did
not change the range. Event-driven controls had no way to express “hover here to
show the next button.”

`owa_guide_start` now accepts `topic` and conservatively selects the matching
manual step. Step actions add `hover`; the runtime both holds CSS-only hover
targets and dispatches pointer/mouse hover events for event-driven surfaces,
without moving the user's real pointer. `type` recognizes range inputs and sets
them through the native value setter plus `input`/`change`. The chatbot does not
expose a recipe-built demo button while a keyed model is preparing exact live
steps. A live keyed run caught the model starting the whole manual itself and
then calling its actions through **Add Extra Bible**; `manualId` is therefore
show-only at the server boundary, and executable demos require explicit steps.
The last/only action no longer changes its button to **Done** before it has run.
Range steps also accept signed relative values (`+8`) and keep the type-only
matcher while waiting, so they never fall onto a nearby label. Stable range,
book and chapter titles give exact safe targets even while the visible Reader
controls use localized text. Tool count remains unchanged; fresh audit: 53
host tools, 27 `owa_*`, 24 model-visible, 7,355 model tokens/round against the
7,450 ceiling, no warnings.

The live four-step localized lookup exposed a render race too: a book button
that appeared during the action's wait was misclassified as something the click
had revealed, so the guide kept the vanished book step. A target found during
the pre-action wait is now removed from that after-action list. While the card
shows a successful result, **Do it** is disabled until the advance, preventing a
quick second press (or a throttled background-window timer) from repeating the
same action.

---

## Done

### `MC-45` — a scope named one panel and pressed a control in its sibling · done 2026-09-27

Found while testing bible notes, not by a report. `owa_click "Bible Notes >
More Options"` pressed the **Bibles** panel's button, and `owa_find_ui`
listed that panel's controls first. The scope is the one thing a caller
writes to say WHICH of two look-alikes is meant, so getting it wrong is the
single outcome it exists to prevent — and in the Reader those two panels are
a `⋮` apart.

`checkIsInScope` accepted ANY tier off `matchTier`, including tier 3 ("every
word of the needle somewhere in the label, in any order"). Both note panes
sit inside a pane called **Bible and Notes**, which holds "bible" and
"notes" — so every control under it, the Bibles pane's included, passed the
scope. Tier 3 is a bag of words; a panel NAME is not. Scopes are held to
tiers 0–2 now (`SCOPE_MAX_TIER`), which leaves every real one untouched:
`Background > Videos` and `Web Show > clock` are tier 0 on their own pane.

Proven both ways: the new `domMatch.test.mjs` case fails on the old
comparison and passes on the new one, and a FRESH server driven against the
live Reader answers `Bible Notes > More Options` with 15 matches all in
**Bible Notes**, `Bibles > More Options` with 15 all in **Bibles**. (The
running server and the page both cache the matcher, so a live re-check needs
a new server and a page reload — `dom-match-memoised-in-page`.)

### `MC-32` — a string evaluated at load killed every strict-CSP window's preload · done 2026-09-18

Found by this skill's own live check, not by a report: the chatbot window
opened on its **Standing by** placeholder and stayed there. Its console:
`EvalError ... 'unsafe-eval' is not an allowed source of script` at
`electron-build/electron/aiHelpers.js:55`, then `Unable to load preload
script`, then `Cannot read properties of undefined (reading 'isPageReader')`
— no preload, no `appProvider`, nothing mounted. A reload happened to
survive, which is what made it look intermittent.

The cause was a chain, not a line. The staged `MC-16` work made
`electronHelpers.ts` import `webCaptureHelpers`, which imports `aiHelpers`,
whose top level built `importEsm` with `new Function` — and every preload
requires `electronHelpers`. `chatbot.html` carries a CSP with no
'unsafe-eval' in dev; **in a packaged build every page does** (the
`<!-- prod ... prod -->` blocks), so that release would have opened no
window at all.

Fixed at the module that evaluated: `importEsm` builds its `Function` on the
first call — only the main process ever makes one. Reproduced before (close,
reopen: Standing by, no provider), proven after (a fresh open renders, 0
console errors in the chatbot and the presenter, the lockdown still revokes
`require` and empties `process.env`). `aiHelpers.test.ts` loads the module
under a `Function` that refuses to evaluate, with a positive control so the
empty list cannot pass by the trap missing. Memory
`preload-must-not-eval-at-load`.

### `MC-33` — every tool result was indented JSON · done 2026-09-18

The results lever, which the budget file lists fourth and nobody had pulled:
`toTextResult` and the four worker formatters wrote `JSON.stringify(value,
null, 2)`, and a result is not read once — it stays in front of the model for
every later round of the question. Compact now. Measured on fourteen
read-only calls against the running app: **35 411 → 24 499 characters
(−31%), 1 355 lines → 49**; on the Presenter `owa_list_screens` −40%,
`owa_app_state` −37%, a 200-row `owa_list_ui` −26%. On the wire, the round
after `owa_help_search` wrote 960 and 932 tokens where the same questions
wrote 1 080 and 1 056 on 2026-09-11. Nothing read a result by its layout:
the window parses them, and every pattern that peeks (`applyToolWatch`, the
firewall's redaction) takes `:\s*`.

Two trims rode with it: `owa_list_questions` rows lost the ranker's own
inputs (`keywords`, `starter`, `starterRank`, the page and focus the caller
named) — −71% on a query; and `owa_app_state`'s `instances` lost `url` (the
port again) and `mcpUrl` (a door no caller of that tool opens).

### `MC-34` — "Clear All [F6] Clear All" · done 2026-09-18

`owa_find_ui` and `owa_list_ui` named the Mini Screen's Clear All button
"Clear All [F6] Clear All" and the editor's Save "Save [Ctrl+S] Save", while
`owa_list_screens` said "Clear All [F6]" — a title WITH its shortcut beside an
aria-label without, which the exact-repeat rule in `labelPartsOf` (`EC-115`)
cannot see. `shownLabelOf` drops the shorter twin from the words handed OUT
(`describe`, a list row, a near miss); `labelPartsOf` keeps both, because the
exact-name tie-breaker reads the bare one. The press's did-it-change check
reads the label before and after through the same `describe`, or a label
merely re-joined would read as a change. `domMatch.test.mjs` +1 (73).

### `MC-24` — CRUD over the user's data, every change undoable · done 2026-09-14

Asked for directly, in three messages: _add all possible tools: bible-item
crud, bible-note crud, document (app-document, lyric) crud_; _add tools for
app-document slides: crud, update slide with style with text_; and _make sure
all actions have backup action, e.g. delete it should move to trash and can
undo_.

Shipped: `delete` on `owa_lyric_file` / `owa_slide_file`; six slide actions on
`owa_slide_file` (`slides`, `add-slide`, `update-slide` with text, font, size,
colour, alignment and position per box, `delete-slide`, `move-slide`,
`duplicate-slide`); `owa_bible_item` (list / add by reference / update /
delete, and whole lists); `owa_bible_note` (list / read / add / update /
delete, and whole files); and `owa_undo`.

**No backup, no change** (`src/helper/agentBackupHelpers.ts`): every write
snapshots what it is about to change and refuses when the snapshot cannot be
saved; a delete is the app's own Move to Trash; an undo takes its own backup
first. This matters most where the app has no undo of its own at all — a
Bibles list and a notes file write straight to disk. The firewall rations
removals separately (10 per 5 min) and `owa_bible_note` refuses a write while
that file is open in its own window, which would save its stale copy over it.

Cost: **+1 089 tokens a round** to the model (21 → 24 tools, ~6 901 → ~7 990),
measured with `audit --stdio` and cross-checked on the live host. Verified live
on the dev app through fresh servers: 36 checks across the four domains plus a
picture of the created document in the Documents list; scratch files trashed.
One check failed first and found `MC-25`.

### `MC-25` — the editing history read its own files from a stale cache · done 2026-09-14

Found by `MC-24`'s live run: undoing the delete of a slide document with
unsaved edits brought back a state two edits old. The backup was right; the
READ was wrong. `FileSource.readFileData` caches by path for 2 s, and the
editing history renames `N` onto `N-head` and reuses its paths after a clear —
so a history rebuilt inside the window read back the old head, and
`changeCurrent` wrote its diff patch from that stale text, which would have
broken the document's Ctrl+Z. Plain editing can reach it: undo, then edit,
within two seconds.

Fixed at the root: `FileSource.forgetCachedData` / `forgetCachedDataUnder`,
called after every history move, clone, delete and clear; and
`AppEditableDocumentSourceAbs.preDelete` now awaits its discard. Regression
tests in `EditingHistoryManager.test.ts` and `FileSource.test.ts`; the live
re-run held 14/14 on slides and 5/5 on songs.

### `MC-21` — the assistant could not write a song or a slide document · done 2026-09-02

Asked for directly: tools to create / update / rename / read the user's own
lyric and slide documents, with Open Lyric content required for a write.

Shipped as `owa_lyric_file` and `owa_slide_file` — two tools by the operator's
call over one merged `kind` switch, at ~800 tokens a round rather than ~450 —
over one implementation (`src/helper/agentFileHelpers.ts`, differences in
`AGENT_FILE_KIND_MAP`). They reach the app through a DOM event relayed by
`domHelpers.ts`, the pattern the guide card's rescue already uses, because this
package may never import an app module and open-lyric is browser-only.

**These are the first tools whose effect outlives the session.** A click can be
clicked again; a created file stays created. What holds:

- **No delete action at all**, and `create` never overwrites (`fsCreateFile`
  throws on an existing path unless told to override, and never is).
- **`update` writes the editing history, not the file.** Undoable with Ctrl+Z,
  left visibly dirty with its `*`, and the human presses Save. This is the
  whole reason the destructive half is safe to offer: _point, don't press_
  applied to content. It also leaves a song already on a screen alone.
- **The name is refused, never cleaned**, in BOTH layers off one shared module
  (`agentFileName.mjs`) — and checked FIRST, because the content validator
  used to answer before it and told a caller its song was malformed when the
  real complaint was the path in the name.
- **Content is validated twice, differently.** `validateOpenLyric` in the tool
  gives a line number and what to write instead with no round trip; the app's
  own `checkMarkdown` / `AppDocument.validate` gates the disk. The tool layer
  reuses `MC-19`'s validator rather than shipping a third opinion.

Verified live through a fresh server against the running app: a song created
on disk and in the Documents list, `info` reading its title/key/sections back,
a duplicate name refused, a traversal name refused AS A NAME, invalid content
refused with line numbers, `update` answering `isSaved: false` and a following
`info` showing `hasUnsavedChanges: true` (the proof the write went to the
history and not the file), a rename, and a slide document created from real
validated slides. Scratch files swept afterwards.

Found and fixed while doing it: `MC-22`.

### `MC-22` — a rename left the editing history behind · done 2026-09-02

`FileSource.renameTo` moves the file and nothing else.
`EditingHistoryManager.moveFilePath` exists for the other half and, before
these tools, **had no production caller at all** — and neither did `renameTo`.
So the pair had never been exercised together: renaming a document with
unsaved edits would have left them behind under the old name, still on disk,
no longer following the document, and the `*` would have vanished.

Found by grepping for the caller before filing it as a known defect, which is
the only reason it was fixed rather than documented. `handleRename` now moves
the history folder with the file.

Still true and NOT fixed: a presenting flow that referenced the old name stops
finding it. The tool says so in its answer, which is a note rather than a fix
— run-sheet entries are file references (memory:
`presenting-flow-references-vs-presets`) and nothing rewrites them.

### `MC-19` — nothing could tell a volunteer WHY a song was refused · done 2026-09-02

Asked for directly: a tool that knows the Open Lyric schema, takes song text
and answers with how correct it is.

The Lyric Editor marks a bad song with a red squiggle and no words. Nothing in
this package could read song text at all, so "why won't my song save?" had no
answer better than a manual page about saving.

Shipped as `owa_lyric_validate` + `tools/owa-devtools-mcp/openLyric.mjs`: every
problem with its line, its section and what to write instead; separately the
warnings open-lyric accepts (a section `Structure` never plays, a `{p: #N}`
pointing past the patterns `Config` lists); then the song itself — title,
artist, key, tempo, sections, play order.

Cost, measured: **+221 tokens per round** (host 45 → 46 tools, the model's list
26 → 27). It is the only tool here that reaches nothing — no CDP, no window, no
network — so it also works with the app shut.

**It does not call open-lyric, and that is the interesting part.** The one
headless entry point, `api.document.checkMarkdown`, answers a BOOLEAN, which is
precisely the answer this tool must not give; the validator that has the
messages takes a Monaco model and pushes markers into an editor. Reaching
either means importing an 863 KB bundle that pulls monaco in and touches
`document` at module scope, inside a plain-node server. So the grammar is
written out and two tests hold it:

- `openLyric.test.mjs` re-reads `node_modules/open-lyric/schema.md` §8.1 — the
  machine-readable grammar the package SHIPS — and fails when a table
  disagrees. An `npm i` that bumps open-lyric surfaces here instead of in a
  volunteer's answer.
- `openLyricOracle.test.mjs` runs 122 documents through open-lyric's own
  `checkMarkdown` AND through ours, failing on any disagreement.

Three things it taught:

- **Write the oracle first.** All 122 verdicts were probed against the real
  validator before a line of the module was written, and the oracle then caught
  four cases where the valid `(2x)` repeat was refused — a rule that reads
  correctly in the source and was simply never wired up.
- **Driving it live caught what 160 passing tests did not.** The `{p: #N}`
  warning was matched against the whole trimmed LINE, so it only ever fired for
  a directive sitting alone — never for the normal `{p: #1} | G | D |`. And a
  `Structure` that broke mid-way printed its partial play order as if it were
  the whole song, saying the song ends at the mistake. Both were obvious in one
  call through the app's own door and invisible from reading.
- **Shape is not existence, again.** `questions.test.mjs` checked that a
  question's `tools` list was non-empty and never that it named a registered
  tool — the same hole that `W-01b` fell through. Now checked, by reading the
  registered names out of `owaTools.mjs`.

### `MC-18` — the assistant could not read a web page at all · done 2026-09-02

Asked for directly: the chatbot needed to be able to extract text from a page
(the example given was the Wikipedia article on the King James Version), and
to take a picture of one.

Shipped as `owa_read_website` — text, optional links, optional screenshot —
with the address policy in `webUrlPolicy.mjs` enforced at two layers, a
locked-down offscreen window in `electron/webPageHelpers.ts`, its own network
budget, a banner that NAMES the site, and the result fenced as a document
rather than as a message. See [threat-model.md](./threat-model.md) _Reaching
out_ for what it closes and the three things it knowingly does not.

Cost, measured: **+347 tokens per round**, host 44 → 45 tools, the model's list
25 → 26. Verified live against the running app through a fresh server: a real
article read, the app's own MCP door refused, `file:` refused, `localtest.me`
(a public name resolving to 127.0.0.1) refused by the DNS layer, and a
screenshot returned beside the text. `probe-mcp.mjs` went 12 checks to 15.

Two things it taught, both worth keeping:

- **A page expression is a template literal inside a template literal.** `\s`
  written with one backslash in the TypeScript source is swallowed by the
  template literal and reaches the page as `s`, so `replace(/\s+/g, ' ')`
  silently became "replace runs of the letter s". It parsed, it ran, and it
  quietly corrupted every link's text. Typecheck and unit tests saw nothing;
  one live call saw it immediately.
- **Prefer the app's own extraction to a tag-stripper.** `innerText` after
  layout skips hidden elements and `<script>` for free. Hiding `nav`/`aside`
  and the navigation roles before reading is what drops a site's chrome
  without a single site-specific rule, and cutting the text IN the page keeps
  ~80 KB of a long article off the IPC and off CDP.

### `MC-09` — no policy layer at all · done 2026-09-01

`evaluate_script` through the MCP host reached `require('os')` and
`require('fs')` on the operator's machine, from a script with no credential,
and was in the tool list sent to the chatbot's model on every round. Closed by
`tools/owa-devtools-mcp/firewall.mjs` — denied tools removed from `tools/list`
and refused at `tools/call`, a navigation allowlist, the destructive-label
interlock, an acting-call rate limit and secret redaction on results. 24 unit
tests; verified live through a fresh stdio server (47 → 44 tools, exploit
refused, ordinary click untouched). See
[threat-model.md](./threat-model.md).

### `MC-10` — the chatbot window had Node and a loose CSP · done 2026-09-01

The one renderer whose content comes from outside the machine had `require`,
`process.env` and the app-wide `script-src`-only CSP. Closed by
`electron/client/rendererLockdown.ts` (called from the preload, after
`fullProvider` has finished requiring) and a `chatbot.html`-only CSP whose
`connect-src` names the assistants it may speak to and nothing else.

### `MC-48` — sourced Bible book-name lists by locale · done 2026-10-06

Requested capability: raw XML imports had only bundled book-name suggestions in
an editor action. Added `owa_bible_book_names` with complete 66-name arrays,
provenance, deduplication and edition pagination. It uses the existing sandbox
and charges each page to its network quota. Live Khmer lookup returned four
sets; bad/incomplete sources remained warnings. No files are changed by lookup.
Baseline 53 host / 24 model, ~7,433 tokens per round; after 54 / 25, ~7,578.
The explicit new tool costs ~145 tokens; ratchet ceiling deliberately raised to
7,600 with 22 tokens headroom, not a general tool-budget expansion.

### `MC-57` — what the default policy still leaves to the person · open

Measured 2026-10-10 against every destructively worded `tran()` label in
`src` (grep over `delete | trash | discard | erase | remove | uninstall |
overwrite | clear all | reset all | factory | sign out`, 52 distinct labels)
after `MC-50`..`MC-55`. Every outcome a service needs has a backed-up tool
route the strict firewall allows: a file to the trash (`owa_lyric_file`,
`owa_slide_file`, `owa_media_file`, `owa_presenting_flow`, `owa_bible_item`,
`owa_bible_note`, `owa_bible_xml` `delete`), unsaved edits dropped (`revert`),
a slide, a box, a note item or a verse's marks removed (`delete-slide`,
`update-slide`, `owa_bible_note remove`), a run-sheet line removed
(`owa_presenting_flow remove`), a layer or everything off the projector (the
F7--F10 Clear buttons, `owa_foreground stop`, `owa_hide_screens`). What has
NO tool route and whose button the firewall refuses by its words: **Clear All
Settings**, **Reset All Child Directories**, **Remove Folder / Remove from
Recent Folders / Remove URL** (directory and link settings), **Delete this
server / Remove this model** (LLM settings), **Sign Out** (SongSelect),
**Remove Session / Delete this saved session** (foreground sessions),
**Delete Virtual Display**, **Delete Comment**, **Remove Time / Remove
Message**, **Delete preset**, **Remove CC Element**, and the confirm each
asks. None is part of running a service; each is housekeeping a person does
once. Two labels are refused on their WORDS and destroy nothing on disk --
**Manual eraser** / **Erase parts of the drawing** are a drawing mode
(`erase` matches) -- a false positive worth an allow-list entry read on the
control's role. The route to automating the rest is either a backed-up tool
per setting (the pattern the data tools set) or the person's own
`OWA_MCP_FIREWALL=off` run; relaxing the default policy to press them was
written and reverted three times under the auto-mode safety check and is
the user's call, not a session's.
