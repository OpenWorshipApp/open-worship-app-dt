# owa-devtools-mcp

An MCP server for the **running** Open Worship App: chrome-devtools-mcp's
browser tools, permanently aimed at the app, plus app-level tools that know
what the app is and what its manual says.

Built for two callers:

- the **in-app chatbot** (Help → App Help), which answers a user's "how do
  I …?" from the app's own manual and from what the app is doing right now;
- an **outside agent** (Claude Code, the robot-test skill), driving the app.

## Two front doors

| Door  | How                                                                |
| ----- | ------------------------------------------------------------------ |
| HTTP  | The app publishes a URL and per-launch bearer token while running. |
| stdio | `node tools/owa-devtools-mcp/bin.mjs`                              |

The repo's `./.mcp.json` already registers the stdio door as `owa-devtools`
(its path is repo-relative, so start the client from the repo root). To register
it per-user instead:

```bash
claude mcp add owa-devtools -- node tools/owa-devtools-mcp/bin.mjs
```

The HTTP door is for clients that can read the app's published instance file.
Send its `mcpToken` on every request without putting it in the URL:

```bash
Authorization: Bearer <mcpToken>
```

The stdio forms hold no URL at all — they just spawn `bin.mjs`, which finds the
running app through the file it publishes (below). Prefer stdio for an outside
developer client; it needs no copied capability and keeps following app
restarts.

## Finding the app

The app takes no fixed debugging port. Chromium binds a free one and the main
process publishes both doors to `<temp>/open-worship-app-cdp/<pid>.json`:

```json
{
  "pid": 17752,
  "port": 56739,
  "url": "http://127.0.0.1:56739",
  "mcpUrl": "http://127.0.0.1:39223/mcp",
  "mcpToken": "<per-launch capability>",
  "isDev": true,
  "userDataPath": "…/open-worship-app-dev",
  "startedAt": "2026-08-31T16:19:37.477Z"
}
```

One file per live instance (dev beside the packaged app, or several dev
instances on different `OWA_USER_DATA_PATH`s). `discovery.mjs` reads them,
newest first, and skips instances whose process is gone. `browserUrl` is a live
getter, so one long-lived server follows the app across restarts. The directory
is mode 0700 and each file mode 0600 where the platform honours POSIX modes.
The token is 256 random bits, changes on every launch, and is required as an
`Authorization: Bearer` value before the host creates or resumes an MCP
session. Do not log it or place it in a query string.

Overrides, in order: `OWA_CDP_PORT` (client side) ·
`OWA_REMOTE_DEBUGGING_PORT` / `--owa-remote-debugging-port=` (app side) ·
`OWA_MCP_PORT` / `--owa-mcp-port=` (app side).

**`OWA_CDP_PORT` is a pin, not a preference** (`MC-30`, 2026-09-17). Naming a
port means that port or nothing: if it is not answering, every tool refuses
with a message naming what the app actually published, rather than falling
through to the newest instance. It used to head a list that went on to every
published instance, so a dev app that nodemon had restarted onto a new port
left a "pinned" script driving whatever was published last — the PACKAGED app,
with the user's real data, if one was up.

For a client that can only be pointed at one hardcoded URL:

```bash
node tools/owa-devtools-mcp/bin.mjs --bridge --listen=9223
```

forwards that port to whatever the app is on right now, resolved per
connection.

## Tools

Everything chrome-devtools-mcp registers (click, fill, snapshot, screenshot,
console, network, performance) **except what the firewall denies** — see below
— plus:

| Tool                     | What it answers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `owa_help_search`        | The app's knowledge: the user manual first, the internal `.claude` notes next A query that is one of the corpus's own questions (`questions/*.json`, compared by normalised text) gets its filed recipe first, marked `isKnownQuestion: true`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `owa_list_questions`     | What this app is prepared to be asked, by page and panel, with the recipe/control/keystroke that answers each                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `owa_help_page`          | One document in full, by the id a hit carries — app labels already in the user's own language                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `owa_tran`               | What a button is CALLED on this user's screen: an English label in, the words actually printed on that control out                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `owa_app_state`          | Live instances, open windows, the main window's page/language/theme — and on the Presenter `selectedDocument`: what the user is in the MIDDLE of (the song or document picked, its slides with their first words, `onScreen`, `next`, `previous`), every slide carrying `find`, the exact words on its card, which `owa_click` presses to PRESENT it (changes the projector: only when asked) — and `runSheet`: the presenting flows open in their run player, each one's lines, `cursor` (the line the run is on, and the slide inside it) and `next` as the Space key works it out, or `availableSheets` when none is open; no tool advances a run                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `owa_list_screens`       | What is on the projector: whether any screen is showing (`isAnyShowing`), the displays available, and — read from the Presenter's own screen managers — what each screen HOLDS whether showing or not (`screens[]`: the slide with its document, name and first words, the Bible passage and version, the background, the foreground widgets, the lock), the exact words on that screen's show/hide toggle and Clear buttons (`controls`, in the user's language, each Clear saying whether it has anything to clear), and where the Mini Screen panel sits (`previewCard`). Off the Presenter page it degrades to the basics with a `note`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `owa_hide_screens`       | Hide one screen or all of them (confirm with the user first)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `owa_present_bible`      | Put a Bible passage on the projector by its reference (`John 3:16`, `Psalm 23:1-6`) through the app's own parser and the Bible Lookup's own present path, and read the screen back: `isPresented`, the passage as the app writes it, its first words, each ticked screen with `isShowing` / `isLocked`. `version` picks an installed Bible (default: the one the lookup is on, then any that reads the reference); `action: "check"` only resolves and quotes it. Nothing is saved to the Bibles list; a locked screen is refused by name. Acting: banner names the passage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `owa_foreground`         | Start or stop a foreground extra on the projector — a countdown (`minutes` or a clock time `at`), a stopwatch, a clock, a marquee along the top or bottom or a quick text (`text`) — through the widgets' own screen managers on the ticked screens, and read the screens back (`did`, `detail` in words, each screen's `foreground`). `stop` takes one off (`all` is F10), `check` only reads. Refusals (no length, a time gone by, no ticked screen, locked, off the Presenter) are sentences for a person: `/countdown`, `/marquee` and the offline bot print them                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `owa_screenshot`         | A picture of the app window, or of a projector screen by id — for when the words are not enough                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `owa_lyric_file`         | The user's songs: `list` / `info` / `create` / `update` / `rename` / `delete`. Content is an Open Lyric document, checked by Open Lyric before anything is written; `delete` moves the song to the trash; every change is backed up first and `owa_undo` puts it back                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `owa_slide_file`         | The same six actions over slide documents (content is the document JSON, checked by `AppDocument.validate`), plus one slide at a time: `slides` reads every slide with its text boxes and their style, `add-slide`, `update-slide` (an item with `id` changes that box -- text, font, size, colour, alignment, position -- or removes it; one without adds a text box), `delete-slide`, `duplicate-slide`, `move-slide`. A slide change is one editing-history entry: unsaved, Ctrl+Z-able, and backed up for `owa_undo`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `owa_bible_item`         | The user's saved Bible passages (the Presenter's Bibles list, or the Reader's): `list`, `add` a reference as the user says it ("John 3:16", read by the app's own parser in any installed version), `update` its reference or version, `delete`, and whole lists -- `create-list`, `rename-list`, `delete-list` (to the trash). A list file has no editing history, so every write is backed up first; nothing reaches a screen                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `owa_bible_note`         | The user's Bible notes: `list`, `read`, `add` (a title and plain text, written as the note editor's own content), `update`, `delete`, and whole files -- `create-file`, `rename-file`, `delete-file` (to the trash). Refused while that notes file is open in its own window, which would save its stale copy over the change. Backed up first                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `owa_undo`               | Put back a change the data tools made: `list` the recent ones, newest first, each with an id; `undo` one -- or, with no id, the newest not yet undone. An undo takes its own backup before it writes, so it can be undone too. Kept in `<data folder>/agent-backups/`, the last 100 for 30 days                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `owa_read_website`       | Read a page on the public web — its text, its links, and a picture of it. https only, public addresses only, and what comes back is fenced as a document that was read rather than as anything talking to the model. Not for a song page the user wants as a song: that address goes to `owa_lyric_validate` as `url`, which reads it with its chords                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `owa_lyric_validate`     | Check song text against the Open Lyric notation the Lyric Editor uses: every mistake with its line, its section and what to write instead, then what the song IS — title, key, tempo, sections, play order. With `mode: "draft"` it takes RAW words instead — a paste, a page that was read, a file somebody attached — and WRITES the notation, guaranteed valid because it is round-tripped through the same validator. Hand it a whole song PAGE and it finds the song among the menus, charts and footers, rejoins the lines a chord layout breaks up, and says which part of the page it used; `from`/`to` correct that (believed on plain words too), `title`/`artist`/`copyright` add what the caller was told outright. A hymnal text page's numbered stanzas are taken as the song and its `Title:`/`Author:`/`Copyright:` table read; a short heading block above numbered stanzas is left out. With no `mode`, notation is checked and anything else is drafted. **Given a `url` and no `text`, it reads the page itself** — the same locked-down window, address check, budget and banner as `owa_read_website` — and drafts from the whole page, chords and all; the model never gets a turn to retype the words in between, which is how a chord page came out with no chords (measured 2026-09-09: told twice to hand a page over whole, the model read it and passed its own copy). The one tool here that asks the app nothing when given text, so it works with no window open |
| `owa_pick_element`       | Ask the user to POINT at a control; answers with its words, its panel and a unique selector, and swallows their click                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `owa_highlight_selector` | Ring the exact element a selector names — no matching, no guessing, for a selector something already resolved                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `owa_find_ui`            | Where a control is on screen — `Panel > Control` narrows it, `highlight` rings it (and holds a hover-only control up)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `owa_list_ui`            | Every control actually on screen in a window right now, with the words written on it, the panel and the place — and only what is unusual (`showsOnHover`, `isDisabled`); no box, tag, component or source file on a list row (~40 tokens a row, was ~180), and a path-shaped tooltip is never part of a label                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `owa_click`              | Press a control by the words on it — a list of candidates tries each in turn; answers with what the press CHANGED (`didChange`, `isOnNow`, `unverified`). Presses only a control CALLED what was asked (the guide card's `isPressSafe` bar, since 2026-09-08): a loose fit is refused with the control it found as `nearest`, because "show screen" matched the Bible Lookup's save-and-present button and a click there would have put a verse on the projector. Never a control NAMED for what cannot be undone, in whatever language the window shows, nor one inside a question the app is asking -- judged in the page, on the control itself                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `owa_type`               | Put a value into a box, picker or range slider, found the same way; hidden hover controls are held visible first                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `owa_goto_page`          | Take the ONE main window to another of its pages (presenter / reader / document editor) — the way out of "no open page matching" for a page. A window of its own is opened by pressing the control that opens it, which `botFocus.mjs` names as `openFind`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `owa_guide_start`        | Walk the user through a task with a numbered card drawn in the app window. With `manualId`, `topic` starts at the one recipe step matching the user's task instead of replaying the whole page. `demoId` starts one of 135 checked-in, zero-model lessons: 61 for the Reader and 74 for the Presenter. The Reader features 30 safe deterministic walkthroughs in the assistant, and 30 of its 61 Tips lessons have a safe actionable start; the Presenter has 64 actionable lessons and ten disruptive or native-menu lessons that remain self-guided. A mixed lesson marks explanation-only follow-ups as `look`, so **Do it** becomes **Next** after the safe action. The id is validated against the shared catalogs at call time rather than enumerated in the model schema, so adding lessons does not tax every model round. Other demos supply explicit live steps, which can click, type/set a box, picker or slider, hover to reveal another control, right-click or press a shortcut. A control inside an app auto-hide footer is never ringed while invisible: the card rings and opens its visible three-dot prerequisite first                                                                                                                                                                                                                                                                                                                                                      |
| `owa_guide_step`         | Move a running walkthrough on — or `do` the current step for the user. A `do` presses only a control called what the step says (a loose fit is refused with the label it found); when the control is behind a popup, menu or floating panel the first `do` closes that and the next does the step; a question the app is asking is never answered; a look-step (something to notice) just moves on; a step whose control -- or whose key, judged by the control that names it (F6 is _Clear All [F6]_) -- cannot be undone is ringed and left for the user to press, by the card's own Do it as much as by a `do`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `owa_guide_status`       | Where the user has got to, whether this step can be done, what it is `behind` (a popup, a menu), the `nearest` label when only a loose fit is on screen, its `kind` (`act` / `look`), and any rescue in flight (`help`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

Every answer is **compact JSON** (`MC-33`, 2026-09-18) — never indented. A
result stays in front of the chatbot's model for every later round of the
question, and the two-space layout was ~31% of the characters; nothing reads a
result by its layout. A label handed out says a name once: a title carrying a
shortcut beside an aria-label without one is `Clear All [F6]`, not `Clear All
[F6] Clear All` (`MC-34`, `shownLabelOf` in `domMatch.mjs`).

## The firewall (`firewall.mjs`)

Every window of this app runs with `nodeIntegration: true`, so "run this in the
page" means "run this on the operator's computer". Measured against the live
app: `evaluate_script` reached `require('os').userInfo()` and
`require('fs').readFileSync(<userData>/setting.json)` from a script with no
credential — and that tool was in the list sent to the chatbot's model on every
round, where a prompt-injected answer could reach it.

So every `tools/call` passes a policy first, at the one seam both doors share.
The rule is **the assistant may point, the human presses.**

| Rule                                   | Effect                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `denied-tool`                          | `evaluate_script`, `take_heapsnapshot` and `upload_file` are refused **and** dropped from `tools/list`                                                                                                                                                                                                                                                                                                                                                                 |
| `foreign-url`                          | `navigate_page` / `new_page` may only land on a page the app itself serves (`file:`, loopback, `about:blank`). Reload / back / forward carry no address and are allowed. The rule INVERTS for `owa_read_website`, which may only go the other way: https, and never an address on this machine or its network — see below                                                                                                                                              |
| `destructive-label`                    | `owa_click` / `owa_type` refuse a label that cannot be undone — delete, trash, discard, erase, remove, uninstall, overwrite, _clear all_, _reset all_, factory, sign/log out — **and its translation in every language the app is shown in**, derived from the app's own `tran()` dictionary (`destructiveLabel.mjs`), read after folding what the matcher folds (a no-break space, a double space, full-width letters)                                                |
| `destructive-uid`                      | the same refusal for `click` / `fill` / `fill_form` / `drag`, which aim by a snapshot id and carry no label — the wording (translations included) is recovered from the snapshot that minted the uid, remembered per session and only for the destructive rows                                                                                                                                                                                                         |
| `destructive-press` / `question-press` | the same rule **in the page, on the control a press actually lands on** — `owa_click`, `owa_type` and a walkthrough's Do it (the card's own button and `owa_guide_step` `do` alike): a title or aria-label saying what cannot be undone, a key whose control is (`F6` names _Clear All [F6]_), and anything inside the confirm / alert / input the app is asking the user. The words half above is cheap and logged; this half does not care how the control was named |
| `rate-limit`                           | acting calls are capped at 25 in a rolling 60 s; reads off the internet at 10 in a rolling 5 min; removals (a delete of a file, list, note, slide or passage, and an undo) at 10 in a rolling 5 min. Separate counters, across all sessions — one protects the single app window, one the single network, one the user's files                                                                                                                                         |
| redaction                              | provider keys, bearer tokens, JWTs and named credentials are scrubbed from every tool result                                                                                                                                                                                                                                                                                                                                                                           |

Two enforcement points, because either alone is a hole: filtering `tools/list`
saves the tokens and stops a wrong turn, refusing `tools/call` is the safety —
a client can call a tool that was never listed.

A refusal comes back as an `isError` **result**, not a JSON-RPC error, and is
written for the model: what was refused, why, and what to do instead. Ordinary
work is untouched; `Clear Bible` and `Reset Widgets Size` still press — in Khmer
too, where Clear Bible's label is also Delete Bible's: a translation the
dictionary shares with an allowed control is judged allowed, and the app's own
confirm, which no tool answers, stands behind the other reading.

**Off switch:** `OWA_MCP_FIREWALL=off`, an environment variable and nothing
else — set by whoever starts the process, unreachable from the wire. For a QA
run that genuinely needs `evaluate_script`. Never the default.

```bash
node .claude/skills/owa-enhance-mcp/scripts/probe-mcp.mjs
```

spawns a fresh server and walks the whole policy against the running app.

### Writing the user's documents: `owa_lyric_file` / `owa_slide_file`

The only tools that change something which outlives the session — a click can
be clicked again, a created file stays created. Two tools rather than one by
the operator's call: a model choosing between them should not have to read
about the file type it is not touching. One implementation
(`src/helper/agentFileHelpers.ts`), differences in `AGENT_FILE_KIND_MAP`.

They reach the app the way the guide card's rescue does — a dependency-free
page expression fires a DOM event, `domHelpers.ts` relays it to the worker —
because this package may never import an app module, and everything these
files need (`Lyric.create`, `AppDocument.validate`, the editing history,
open-lyric's browser-only validator) lives in a renderer.

Four rules, enforced in the worker rather than in the tool, because the worker
is what touches the disk and a check further out is one a later caller forgets:

- **Nothing is lost, and `create` never overwrites.** `delete` moves the file
  to the OS trash -- its sidecars with it, and its editing history only once
  the file is really gone -- and every change (create, update, rename, delete,
  a slide) is backed up BEFORE it is made (`src/helper/agentBackupHelpers.ts`).
  A change whose backup cannot be written is refused, and `owa_undo` puts any
  of them back. `fsCreateFile` throws on an existing path unless told to
  override, which it never is.
- **`update` writes the EDITING HISTORY, not the file.** This is the whole
  safety story for the destructive half: the change is undoable with Ctrl+Z,
  the document is left visibly dirty with its `*`, and a human presses Save. It
  is _point, don't press_ applied to content. It also leaves anything already
  on a screen alone — a presented slide is a snapshot until re-presented.
- **A name is REFUSED, never quietly cleaned** (`agentFileName.mjs`, a leaf
  module the tool and the worker both read, so the rule is unit-testable
  without `appProvider`). Separators,
  `..`, control characters, Windows reserved names and over-long names are all
  refused, and the joined path is re-checked for containment. It matters
  because `createNewFileDetail` still carries a `// TODO: verify file name
before create`.
- **Content must pass the app's OWN validator** before any write — open-lyric's
  `checkMarkdown` for a song, `AppDocument.validate` for a slide document — so
  what is accepted is exactly what the app can open, never a second opinion
  that could drift.

Both are in `ACTING_TOOL_SET` (inside the rate limit, so a loop cannot fill
somebody's Documents folder), their deletes are inside the removal budget (so a
loop cannot empty it either), and both raise a banner naming the action and the
file — `changed the song "Amazing Grace"`, `moved the song "Amazing Grace" to
the trash`, `removed slide 3 from "Sunday"`. `list`, `info` and `slides` only
read, so they say nothing, like every other reading tool.

### Saved passages, notes, and putting a change back: `owa_bible_item` / `owa_bible_note` / `owa_undo`

The same road into the app -- one DOM event, `owa-agent-data`, keyed by
`domain` and relayed by `domHelpers.ts` to a lazily imported worker
(`agentBibleListHelpers.ts`, `agentNoteHelpers.ts`, `agentBackupHelpers.ts`) --
and the same rules, with one difference that decides the design: **a Bibles
list and a notes file have no editing history.** Every save writes the file,
so there is no Ctrl+Z behind a change and no `*` to show it. That is why the
backup is not a nicety here but the whole undo: the file's text is kept before
every write, and `owa_undo` writes it back.

`owa_undo` is its own tool rather than an action on four others: "put back what
you just did" is one ask whatever was done, and one list of changes answers
"what did you change?" across all of them. A backup is two files a change -- a
small `.meta.json` a list reads and the `.data.json` only an undo reads -- so
listing the last twenty changes never reads a document twenty times. An undo
applies what it puts back in a fixed order (a rename first, then files, then a
document's unsaved state, which can only go into a document that exists), takes
its own backup before writing anything, and says when a LATER change to the
same file went back with it.

A note open in its own window saves its whole file from the copy it loaded, so
`owa_bible_note` refuses every write while one is open (read off the debugging
endpoint's page list): the change would be undone seconds later, and the answer
that said "done" would be a lie.

### Reaching out: `owa_read_website`

Every other tool here drives a window the operator is already looking at.
This one opens a socket to somewhere a language model chose, so it has its own
half of the policy, in `webUrlPolicy.mjs` — shared, deliberately, between the
firewall and the main-process loader that actually connects, so the two cannot
drift apart.

- **https only, public addresses only.** `127.0.0.1` is where the app serves
  its own CDP and MCP doors; the MCP door is authenticated, but neither may be
  reached by a model-selected page, so a
  fetch tool that could name it would be a way to drive the app from inside an
  answer. `file:` is the disk, `192.168.x` is the church's router,
  `169.254.169.254` is a cloud metadata service. The rule is an allowlist of
  what the public internet looks like, not a blocklist of what it is not.
- **Node's URL parser does the hard part.** `0177.0.0.1`, `2130706433`,
  `0x7f.1` and `127.1` are all canonicalised to `127.0.0.1` before the policy
  reads them. Do not "improve" the checks by matching the raw string.
- **DNS is checked too**, in the main process, because a name on the public
  internet is free to resolve to loopback and several domains exist to do
  exactly that. Every address a name answers with must be public, not just the
  first. The residual is DNS rebinding, named in the module and accepted.
- **The address itself is bounded** (600 characters) and reads are rationed,
  because a URL is a channel out: whatever is in the model's context can be
  spelled into a query string. That is not closed, it is narrowed — and every
  read raises a banner in the operator's own window **naming the site**, so an
  attempt is conspicuous rather than silent.
- **The page loads in a locked-down offscreen window** — no Node, no preload,
  sandboxed, its own memory-only session, popups denied, downloads denied,
  permissions denied, audio muted, and every redirect re-checked
  (`electron/webPageHelpers.ts`). It is not `captureWebScreenShot`, which runs
  with `webSecurity: false` for website canvas items and is a different trust
  level on purpose.
- **What comes back is fenced** as a document that was read, not as anything
  talking to the model. That is the second line of defence against a page that
  says "ignore your instructions"; the first is that none of the refusals above
  care what a page says.
- **There is a second door out, and it is the same door.** `owa_lyric_validate`
  given a `url` opens the very same window through the very same expression,
  and the firewall counts it as a network call on the ARGUMENTS
  (`checkIsNetworkCall`): the address check, the ten-reads-in-five-minutes
  budget and the banner naming the site all apply, while a draft from a paste
  spends nothing and announces nothing. It exists because a model told to hand
  a song page over whole hands over its own copy instead, and its own copy of
  a chord sheet has no chords in it.

## What the chatbot's model is offered (`modelTools.mjs`)

The firewall decides what the SERVER will do. This decides what the chatbot's
**model** is even shown — a separate question, because the developer's door
should keep tools a volunteer's assistant has no business with.

**The model is offered the app's own `owa_*` tools and nothing of
chrome-devtools' at all** (since 2026-09-09): 29 of the 48 are withheld. The
three the window presses itself (`owa_screenshot`, `owa_pick_element`,
`owa_highlight_selector`) plus `take_screenshot`, which quietly undid the same
decision; the acting tools that aim by a snapshot id (`click`, `fill`,
`fill_form`, `drag`, `hover`, `type_text`) — `owa_click` and `owa_type` say
what they are pressing, in the user's own language, and are what the interlock
reads; the two acting tools that carry **no label at all** (`press_key`,
`handle_dialog`) — a key press has nothing the destructive interlock can read,
and in this app F5 shows the congregation's screen and F6 clears it; the window
openers (`new_page`, `close_page`, `navigate_page`, against `owa_goto_page`);
the page readers (`take_snapshot`, `list_pages`, `select_page`, `wait_for`,
`list_console_messages`, `get_console_message`, `list_network_requests`,
`get_network_request`), which answer in uids, page numbers and log lines and
are covered by `owa_list_ui` / `owa_app_state` / `owa_list_screens`; and the
developer instruments (`emulate`, `resize_page`, `lighthouse_audit`, the three
`performance_*`).

The last ten went on the evidence of the standing corpus, 2026-09-08: asked
_Nothing is showing on the projector_, the model rang the wrong control and
then pressed F5 through `press_key` — twice, on two windows — and the screen
came on with nobody having asked; asked _the words no come out big screen_, it
took three `take_snapshot`s (~8 000 tokens each), read the console, ran to the
ten-round cap and answered "I could not find an answer for that" after 72 s
and 225 000 tokens. No graded answer had ever called a chrome-devtools tool
and passed. The Report button still reads the console for itself, through
`callTool`, which this filter never sees.

Same two enforcement points as the firewall, for the same reason: the list is
filtered in `askLlmBot`, and `runMcpTool` refuses the call — these tools are
named in the app's own manual, which the model can read, so a filtered list
alone is a suggestion. Each refusal says what to use instead.

Measured 2026-09-08: **48 tools / ~11 113 tokens per round at the host, 19 /
~5 503 to the model** (was 29 / ~7 366) — on Anthropic's own count the prefix
a round pays for went from ~15 900 to ~13 100 tokens. And on Anthropic that
prefix is now **cached** (`askAnthropic` in `src/chatbot/llmBotHelpers.ts`):
a marker on the system block makes tools + system a cache read for every
round and every question inside five minutes, and the request-level marker
caches the growing conversation, so a round reads ~13 000 tokens at a tenth of
the price and pays full price for the ~100–1 200 it adds. Measured on the
corpus: 813 000 full-price input tokens for 12 questions (44 rounds) → 62
full-price, 41 600 written and 401 600 read (31 rounds) — the input bill for
the same twelve questions went from $1.63 to $0.18 at Sonnet 5 list prices.

```bash
node .claude/skills/owa-enhance-chatbot/scripts/audit-mcp-tools.mjs
```

reports both bills; a withheld tool prints as `(name)`.

## Label templates (`tran.mjs`)

The knowledge is written in English; the buttons it names are not. A volunteer
running the app in Khmer is told to press **Bible Lookup** and has
`ស្វែងរកព្រះគម្ពៀរ` on screen, so the manual used to carry both halves by hand
and the help window stripped one back out with a stack of regexes. The copies
went stale anyway.

So a document names a control with a template instead:

```
Press **F9** ([en:tran:Clear Bible]) to take the verse off screen.
```

`help.mjs` fills it in with what that key reads as in the language the app is
displaying right now, on the way out — English for an English window, Khmer for
a Khmer one — so the model never sees the other language and never has to
choose. The dictionary is the app's own `tran()` dictionary, lifted out of
`src/lang/data/<code>/index.ts` at build time into `knowledge/tran.json`.

Rules for anyone writing a document: the key is the label exactly as the app
spells it, and it must exist — `tran.test.mjs` runs over the whole corpus and
fails on a key no language can translate, which is otherwise invisible because
an unknown key falls back to its own English text.

## Checking a song (`openLyric.mjs`)

`owa_lyric_validate` is the only tool here that asks the app nothing. A song is
text, the rules it has to follow are fixed, and the answer to "why won't the
Lyric Editor take my song?" is a line number — so it needs no window, no CDP
and no running app, and it answers while the user is still typing.

It does **not** call open-lyric. That package's validator is
`validateMarkdownOlModel(model)`, which takes a Monaco model and pushes markers
into an editor; the one headless entry point, `api.document.checkMarkdown`,
answers a **boolean**, which is the one thing this tool must not answer. And
reaching either means importing an 863 KB bundle that pulls monaco in and
touches `document` at module scope, inside a plain-node server that CLAUDE.md
holds to a church back-room machine's memory.

So the grammar is written out here, and two tests stop it drifting — which is
the whole risk, because a validator that quietly lags the editor tells a
volunteer their song is fine while the editor refuses it:

- **`openLyric.test.mjs`** re-reads `node_modules/open-lyric/schema.md` §8.1 —
  the machine-readable grammar the package ships — and fails when a table here
  disagrees: the fences, the structure codes, the Config fields and their
  required/multiline sets, the `Key`/`Time` enums, all 229 locale tags, the
  chord pattern character for character, and every chord and repeat suffix the
  schema names as valid or invalid. An `npm i` that bumps open-lyric shows up
  here. It also covers the messages, which the other test cannot.
- **`openLyricOracle.test.mjs`** runs 122 documents through open-lyric's OWN
  `checkMarkdown` and through this module, and fails when the two verdicts
  disagree. It is the only test in this package that needs jsdom, which is why
  it is a file of its own.

Both were written before the module was, against the live oracle — the four
`(2x)` cases and the `{p: #N}` warning were caught that way rather than
shipped.

`problems` and `warnings` are different things on purpose: a problem is what
the editor refuses the song for, a warning is what it accepts and a musician
would still want to know (a section `Structure` never plays, a `{p: #3}` that
points past the patterns `Config` lists — both probed as accepted).

## The question corpus (`questions/`)

`questions/*.json` — one file per PAGE of the app, each split into sections that
match the panel a volunteer is looking at. `schema.json` beside them documents
the shape and the rules; the loader skips it.

A "page" is a subject the user could be asking about, which is usually a window
(`presenter`, `reader`, `editor`, `settings`, `bible-note`, `web-editor`,
`lyric-editor`) but does not have to be: `presenting-flow` and `screen` earned
their own files by outgrowing a section of `presenter.json`, `troubleshooting`
gathers the symptom-shaped questions that belong to no one window, and `common`
holds what is true everywhere. The last two are `focus: null`, so they answer
from every window.

A file's `focus` names the window(s) it belongs to, using the keys
`botFocus.mjs` declares — html base names, because a key is spliced into
`page: "<key>.html"` by `owa_find_ui` and `owa_app_state`. Each descriptor also
carries how the user GETS to that window: `isMainWindow` (so `owa_goto_page`
can navigate there — its enum is derived from exactly those), `howToOpen` in
the words on the controls, and `openFind`, the one control that opens a window
of its own, which the chatbot presses rather than reporting that the window is
not up. The `label` and `openFind` are also what a recipe's own sentences are
read against, in both directions: `dropStepsAlreadyDone` throws away the step
that gets you somewhere you already are, and `detectRecipeWindow` reads the
same step to say where a walkthrough belongs. It may be a LIST:
`editor.json` is the Slide Editor, so its questions answer from the document
editor; the Documents-panel and Background-panel questions that used to sit in
it moved to `presenter.json`, where the panels actually are.

**Adding a page file is adding a file.** The file name IS the page id, and
everything else reads the directory: the loader, the ask box's
`import.meta.glob`, and `owa_list_questions`' `page` enum (via
`listQuestionPageIds()`, which lists names without parsing a byte).
`questions.test.mjs` holds the invariant both directions — every file on disk
loaded, and every file named after the page inside it — which is also what
catches a file whose JSON is malformed, since the loader drops one of those
silently rather than taking the whole ask box down.

Every entry carries the **resources that answer it** — the manual recipe id, the
control to ring (in `owa_find_ui` syntax), a native menu path, the keystroke, the
`owa_*` tools that can see the live answer, and whether a walkthrough exists — so
a question taken from this list is answered in one lookup rather than a search
round.

Two consumers share one ranking (`questionMatch.mjs`, deliberately free of
`node:fs` so both can run it):

- **the chatbot's ask box**, which suggests as the user types. It bundles the
  same JSON and ranks in the window — a tool call per keystroke is exactly what
  this app cannot afford — and its "Try asking" chips are the corpus's
  `starterRank` order, not a second hardcoded list;
- **`owa_list_questions`**, so the model and an outside agent can offer the
  nearest supported question instead of inventing a feature.

**Keep it current.** The corpus is a promise about what the app can do, so a
change to a `W-xx` recipe or to the UI it describes lands in the same change
here: add, reword or delete the affected questions and bump the file's `updated`
date. `questions.test.mjs` runs against the real files and fails on a question
with no recipe and no tool, a duplicate id, a malformed recipe id, a recipe with
no page under `docs/manual-sources/`, a demoted starter, a `focus` naming a
window `botFocus.mjs` does not declare, or two starters sharing a rank within
one window.

`starterRank` is the one field that is not local to its file: the empty window
sorts every starter a focus can see by rank, so ranks must be unique across the
files sharing a focus, and a rank set in a `focus: null` file competes in EVERY
window. A new question is safest with no rank at all — it still shows, after
the ranked ones. Ranks 10+ are free in every window, which is how `settings.json`
leads the Settings window without displacing the presenter's curated four.

Which control a step means is answered by the shared matcher
(`domMatch.mjs`), and it ranks by how the element is NAMED, not by how short
its text is: an element one of whose names IS the words asked for beats one
that merely contains them. That is the difference between "open the
**Background** panel" ringing the collapsed Background panel and ringing the
`Background:` transition button beside the screen preview.

It reads the **parent path** as well as the label. Every resizable pane
carries its English name as `data-widget-name` — open or collapsed, whatever
language the app is in — so a panel is a place a step can be sent to, and not
only while it is collapsed and drawing its own title. On top of that:

- `Background > Videos` is the Videos tab **inside** the Background panel, and
  nothing else: a scope the caller wrote down is a requirement, not a hint.
- `Background panel` means the panel itself, where a bare `Background` would
  rank any button sharing the word above it.
- A trailing kind noun (`reference box`, `Videos tab`) is dropped rather than
  spent on a failed match and a second round — it is never part of a label.
- The panel supplies words the control's own label lacks, so `Background
Videos` finds that tab. At least one word must be on the control itself,
  or every control in the panel would answer to the panel's name.
- Every match reports the panel it is in (`inPanel`), which is what lets an
  answer tell two same-named controls apart. A match must also
  begin a word — "Ok", from a recipe's "choose **Ok** or **Cancel**", was
  otherwise found inside "lo-ok-up" and rang the Bible Lookup button. A recipe
  that names a whole row of tabs in one bold ("**Colors / Images / Videos /
  Cameras / Web**") offers each of them separately, the joined phrase first.

Much of this window is only **painted while the mouse is over it** —
the six icons above every bible view (Copy, Split, Save, Export…) are
laid out and clickable the whole time and hidden with `visibility`, not
`display`. Asking "has it a box?" answered yes, so a ring landed on
blank space and an answer named a button that was not on screen. The
matcher now asks whether a control is _painted_:

- `owa_list_ui` keeps such a control on the list and marks it
  `showsOnHover`, with `isVisible: false`. Leaving them off the list is
  what stopped the assistant ever mentioning that row of icons.
- A control that is on show outranks a hover-hidden twin — ranked below
  "is it a control at all", so a hidden BUTTON still beats a visible
  container, which is the older and bigger wrong-ring rule.
- `owa_find_ui --highlight`, `owa_click`, `owa_type` and the guide card
  **force the `:hover` state** on the control and its ancestors first,
  then let go. The page’s own `:hover` rules are re-aimed at an
  attribute (`:hover` and `[attr]` weigh the same in the cascade, so no
  `!important` is needed), only the rules matching that chain are
  injected, and one reveal is held at a time on a timer that always
  lapses. The mouse is never moved: it belongs to the user, and a real
  hover would end the moment they reached for the button anyway.
- Anything with no box at all — `display: none`, a closed panel — is still "not
  on screen" unless it is inside the app's standard `.app-auto-hide` footer.
  That footer has a real click prerequisite: the guide rings its visible
  three-dot sibling, the first **Do it** opens it, and the next performs the
  requested action. This is deliberately separate from forced CSS hover.

When the app reacts to a mouse event rather than CSS alone, a guide step may use
`action: "hover"`. **Do it** dispatches the pointer/mouse hover sequence without
moving the user's real pointer; a person moving over the ringed area advances the
step too. A CSS-hidden target normally needs no separate hover step: naming that
target directly makes the matcher hold it visible. A `type` step may set a range
slider value and dispatches the same `input` and `change` events as a drag. A
relative value such as `+8` makes the range larger from where it is now. The
last (or only) actionable demo step still says **Do it** and performs the action
before the card finishes; **Done** is reserved for a show/look step. While the
result is shown, that button is disabled so a quick second press cannot repeat
the same action.

A `manualId` may cover several independent jobs. Passing `topic` selects the one
recipe step whose useful words match the user's ask; if the match is weak, the
whole recipe is kept rather than guessed. The chatbot uses that one relevant
step only as an immediate pointer while a keyed assistant builds a demo from the
live localized controls, so a broad Reader recipe never exposes a Do it button
that merely clicks a label.
The preparation ask explicitly forbids pressing a step: the person presses the
card's **Do it** once per visible action. With no model, the chatbot offers the
working walkthrough only; it does not promise a recipe-built demo.

A step whose control lives in a **right-click menu** is `action: "rightClick"`
(a recipe gets it when its sentence BEGINS with a right-click). Such a step is
two actions, so it is two presses: the first opens the app's own menu where the
step points — a region, "an empty part of the list", found from where the guide
last acted rather than from a label — and the card holds the step, saying what
it brought up. The next press chooses it. What a press reveals is never clicked
for the user: "click **Delete**, then **Yes**" would confirm its own dialog.

Anything the card SHOWS is stripped of ids like `W-08` first, whether the
model wrote them into its own steps or a recipe cited a sibling recipe. The
user reading the card is a volunteer; those ids mean nothing to them.

Starting a walkthrough gets the chatbot window out of the way. The card can
dodge the ring inside the app window, but the help window is a separate OS
window sitting on top of it, and it hides whatever it covers -- so `start()`
and `stop()` fire an `owa-guide-running` DOM event, the app relays it to the
main process (`src/helper/domHelpers.ts` -> `all:app:guide-running` ->
`setGuideRunning`), and that window is minimised for the length of the
walkthrough and restored when the card closes. Only when it is actually over
the guided window, and only ever undoing its own doing: a window the user
minimised, or brought back mid-walkthrough, is theirs. On macOS the window is
first taken out of its parent's group and put back when it is restored: it is
opened as a child of the app window, and minimising an AppKit child minimises
the parent with it -- the whole app went to the Dock while the chat window
stayed up (`EC-180`). A DOM event rather than
anything richer because the runtime is an injected expression that may not
import an app module (see _Notes_), and nothing else in the app can see an OS
window.

A guide step acts on the control it names. When it names none but names a
keyboard shortcut instead — `press: "Ctrl+Q"`, or a **Ctrl+Q** written into a
manual recipe — the card presses that instead, so a step like "close the dialog
with the red ✕ or Ctrl+Q" is done rather than apologised for. Nothing on screen
is labelled "Ctrl+Q", so such a step still rings nothing; `canActOnStep` in
`owa_guide_status`, not `isTargetFound`, is what says whether it can be done.

A step that still cannot be done — 68 of the manual's 251 name no control to
press — no longer ends the walkthrough with an apology. The card fires an
`owa-guide-help` DOM event carrying the step, the labels it aimed at and the
ones it found instead; the app relays it to the chat window, which asks the
model with the live app in front of it and relays one line back. It lands on
the card, not in the chat window, because the chat window is minimised for the
length of a walkthrough and the user is looking at the app. `owa_guide_status`
reports it as `help: {status, text}` — `asking`, `answered`, or `unavailable`
when nothing is listening (an outside agent, or the chat window closed), which
is when the plain instruction comes back. Once per step per run: a second press
of a step already asked about does not spend another round.

The knowledge comes from `electron-build/knowledge/`, bundled by
`extra-work/build-knowledge.mjs` during `npm run electron:build` and shipped
with the app. `owa_help_search` labels every hit `manual` (user-facing,
live-verified) or `internal` (notes for whoever builds the app) — an answer
quoting the second kind should say so.

## Notes

- App-level tools never `import()` an app module in the page: a dynamic import
  re-runs module top-level code, and the app installs `document.onkeydown`
  there, which kills every keyboard shortcut in the window. They read the DOM,
  or talk to the main process over `require('electron').ipcRenderer`.
- `usageStatistics` is forced off. chrome-devtools-mcp's telemetry is a
  process-wide singleton that throws on a second `createMcpServer` (the app
  serves one per session), and it would report from the operator's machine.
- Switching **Settings → Others → Enable AI features** off means the next
  launch opens neither door.
- Editing a `.mjs` here does NOT change a server that is already running: the
  app's HTTP host cached `server.mjs` on its first session, and a long-lived
  stdio client is its own process. Spawn a fresh server (`probe-mcp.mjs` does)
  or restart the app.
