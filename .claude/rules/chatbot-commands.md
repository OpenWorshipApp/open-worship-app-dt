---
paths:
  - 'src/chatbot/builtinActionHelpers.ts'
---

# Chatbot window: the `/` commands

Part of the 🤖 help window's notes, split out of `chatbot-window.md` on
2026-10-29 (`AD-22`) so that reading these files loads this part alone. The
window as a whole — tabs, pickers, its language, the caution — is in
`chatbot-window.md`; providers and the model's tools in `chatbot-llm.md`.

- **A line starting with `/` is a COMMAND, and no model ever sees it**
  (2026-09-02, `src/chatbot/builtinActionHelpers.ts`). Measured on the standing
  corpus the afternoon three of the four providers answered 429 within an hour:
  a paid model spent two rounds and nine seconds saying nothing was showing, and
  the offline bot every failure fell through to said the same and offered no way
  to change it (4 of 12 right). `/screen`, `/screen-show`, `/screen-hide`,
  `/screen-clear-all` … `/screen-clear-foreground` (2026-10-10, the user's
  ask: the clears carry the screen's prefix, the old `/clear-all` spellings
  stay as aliases, and `/clear` alone empties the tab in front — the WINDOW's
  own, done before any message is written, a locked tab refused the way its ×
  is), `/find <words>`, `/goto <page>`,
  `/here`, `/help <words>` and `/commands` run through the app's own MCP
  tools from `handleAsking` BEFORE any provider is chosen — no key, no history,
  no attachment, ~1.6 s — and typing `/` lists them in the suggestion list
  (`SuggestRowType` is the one shape questions and commands share; a command
  with no argument asks on the press, one with an argument fills the box;
  Tab fills either — see _Tab finishes the word_ above).
  Three rules: a command reports what CHANGED (the screens are read back before
  AND after the press — `EC-76`'s lesson); typing it IS the consent, so the
  offered-never-done rule for the congregation's screen does not apply, but a
  MODEL cannot fire one because the button's `BUILTIN_TOOL_NAME` is a pseudo
  tool the server never registers, caught in `handleActing` like the report's
  Send; and a tool's own error text never reaches the user. `BUILTIN_TOOL_NAME`
  is declared in `helpBotHelpers` (the offline bot offers _Turn the screen on_
  under "nothing is showing", and the command module imports that one). The
  same research fixed two offline-bot defects: `TASK_QUESTION_PATTERN` keeps a
  how-do-I that mentions the screen away from the state answer, and the focus is
  a FILTER of `owa_help_search`, no longer a query word — "presenter" is in the
  overview page's TITLE and outranked the real answer 83 to 42. **Driving that
  window over CDP from Git Bash: `/screen` in an argument is rewritten to
  `C:/Program Files/Git/screen`** unless `MSYS_NO_PATHCONV=1` is set — three
  paid calls answered "that looks like a file path" before that was noticed.
  **`/lyric <address>` writes a song from a page with no model** (2026-09-10;
  also `/lyrics`, `/hymn`, `/new-song` — `/song` was already `/selected`'s
  alias, so the app's own noun for a song file won): the drafter reads the
  page itself (`owa_lyric_validate` with `url`, rationed and announced by the
  firewall) and the answer is the same report, preview box and **Create "…"
  / Copy song text** buttons the model's answer carries, nothing written
  until Create is pressed; `/lyric` over pasted words drafts those. The same
  words in prose — _Create a lyric file from https://…_, the starter chip —
  are drafted by the offline bot too (`readSongLinkAsk`: a song word beside
  exactly one https address in a short message → `answerLyricLink`, before
  the paste check), where measured with the assistant paused they were
  searched for in the manual and answered with how to make an EMPTY file.
  A page with no song, a refused read and a site's bot check each get a
  sentence of their own (`EC-123`).
  **`/btw <words>` is the ONE slash line that goes to a model** (2026-10-10,
  the user's ask: _add command `/btw` to let assistant know it about asking
  general question, e.g. `/btw "what is holy bible"`_; memory
  `chatbot-builtin-commands`). `readGeneralQuestion` reads the words (quotes
  off) and `handleAsking` takes the ordinary model road with
  `AskExtraType.isGeneral`: the words plus a frame in the USER turn
  (`toGeneralQuestionAsk`) under a short system prompt of its own
  (`GENERAL_SYSTEM_PROMPT`, ~60 tokens, its own cached prefix) instead of
  the app's ~5 000-token one, ONE round, NO tools (the MCP session is not
  opened: no _Connecting to the app_ step, no tool schemas), no
  known-question hint, no reader-button shortcut, not refused by a custom
  server's 16k context rule (a local model at Ollama's default 4k holds it
  — measured 2026-10-10 on the user's qwen3.5:4b), the transcript showing
  what was typed. With no assistant, or one that fails,
  the answer says a general question needs an assistant and offers **Open
  AI settings** — the guide never answers it. The bare `/btw` runs as a
  command and says how; `/commands` names it as the exception.
  **A plain follow-up under it stays general** (2026-10-10, the user's ask
  with a picture of _in khmer please_ answered as an app question at 10.2k
  tokens: _the follow up prompt should inherit command from previous_):
  `readInheritedGeneralQuestion` reads the tab's last question — typed with
  `/btw`, or carrying `isGeneral` on the message, so a chain holds and
  survives a reopen — and any `/` line ends it. The prompt tells the model
  to say _type `/btw` before it_ when asked something outside the app or how
  to ask one, and a 💡 tip says the same. **Commands are offered where they
  work** (`COMMAND_PAGE_MAP`, `checkIsCommandOnPage`): the Presenter's own —
  screen show / hide / clears, `/selected`, `/run`, `/next`, `/previous`,
  `/slide`, `/verse`, `/countdown`, `/marquee`, `/marquee-top` — are listed only while the tab asks
  about the Presenter and are refused elsewhere with **Go to the Presenter**;
  `/commands` names them on one line there; the rest work everywhere (a
  Reader command would be filed `['reader', 'presenter']`). **`/slide <n |
  words>`** presents one slide of the selected song by its card's own
  `find` (`presentSlideAndReport`, shared with `/next`); and **on a custom
  server two asks in words skip the model** (EC-206, EC-210 — a 4B model
  offered Clear All for "turn off the screen" with every screen off, and a
  9B ran six rounds on "show verse 1 on screen"): `readScreenToggleAsk` →
  `answerScreenToggleAsk` (the screens' state plus the ONE button that does
  it, never a Clear) and `readSlideShowAsk` → `answerSlideShowAsk` (the
  slide named, **Put "…" on the screen** running `/slide N`; a sentence
  naming no slide of the song — a passage — falls through to the model).
  **And a third, 2026-10-13** (`readSlideStepAsk` → `answerSlideStepAsk`,
  tried before the slide-by-words reader or _the next slide_ is looked up
  as a slide of that name): _Show the next slide?_ / _show the previous
  slide_ name the slide `selectedDocument.next` / `.previous` point at and
  offer the same one button — asked of the model at temperature 0, it
  pressed **Slide 1** itself, said nothing of it and told the volunteer
  to click **Slide 2**, every time.
  **And a fourth, the same day** (`readWhereIsAsk` → `answerWhereIsAsk`):
  _Where is the button for Clear All_ — the list's own fill-in, finished
  — is answered by the guide's own `answerWhereIs`, the control outlined,
  with no model round. Only when the window has a control CALLED that on
  show (a tier-0 match, or the ONE control the words fit: **Clear All
  [F6]**), and never for a question the list has a PAGE for:
  `findKnownQuestion` takes every where-is for the fill-in's own row by
  its phrase, so the test is the row's `recipe`, not the row. Asked of
  the model it was four rounds, 42 500 tokens and _in the header section
  of the Presenter window_; the button is in the Mini Screen panel.
