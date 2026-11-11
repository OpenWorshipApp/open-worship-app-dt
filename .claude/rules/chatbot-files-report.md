---
paths:
  - 'src/chatbot/attachmentHelpers.ts'
  - 'src/chatbot/fileAttachHelpers.ts'
  - 'src/chatbot/assetPreviewHelpers.ts'
  - 'src/chatbot/attachErrorHelpers.ts'
  - 'src/chatbot/noteFileTextHelpers.ts'
  - 'src/chatbot/resourcesChatHelpers.ts'
  - 'src/chatbot/foregroundChatHelpers.ts'
  - 'src/chatbot/reportHelpers.ts'
  - 'src/chatbot/reportMarks.ts'
  - 'src/helper/errorReportOfferHelpers.ts'
  - 'src/resources/ResourcesFileRowComp.tsx'
  - 'src/presenting-control/ControllerToolbarComp.tsx'
  - 'electron/consoleLogHelpers.ts'
  - 'public/js/pdf-to-chat-images.mjs'
---

# Chatbot window: files, PDFs and Report

Part of the 🤖 help window's notes, split out of `chatbot-window.md` on
2026-10-29 (`AD-22`) so that reading these files loads this part alone. The
window as a whole — tabs, pickers, its language, the caution — is in
`chatbot-window.md`; providers and the model's tools in `chatbot-llm.md`.

- **A question can carry more than words**: a file or an image from the
  paperclip, a paste, a drop, a **📷** picture of the app window, or a
  control the user POINTED at (the paperclip, the 📷 and the ◎ are rows of
  the ⋮ left of the box since 2026-11-10 -- `chatbot-window.md`). `src/chatbot/attachmentHelpers.ts` is the one
  place that holds them, and its rule is that the bytes are NEVER persisted:
  `chatbot-sessions` is read whole and synchronously at startup, so a message
  keeps the DESCRIPTION (`ChatAttachmentType` — name, kind, size, an element's
  selector) and the picture lives in a bounded in-memory map that dies with the
  window; a reopened tab shows the chip greyed. `toValidAttachments` LISTS the
  fields it copies rather than spreading, so a hand-edited file cannot smuggle
  a `dataUrl` back in. **Every attachment carries a NUMBER** (2026-10-13,
  the user, with a picture of four chips all named _my screen_: _attachment
  should have id like `1` `2` `3` ... so user can mention in the text_):
  `numberAttachments` gives each the tab's next — one past the highest on any
  message of the tab or still in its box — when it is ATTACHED, and it is
  never changed after, because _in 2 the button is missing_ must still mean
  that picture once another chip is taken off (1 · 3, then 4; only the last
  chip's number is free again). It is drawn on the chip
  (`.chat-clip-number`, inked in `--chat-solid` — the panel colour is a 7%
  wash on a glassy window and drew a blank disc), persisted with the
  message, and TOLD to the model: `toAttachmentLegend`, last in
  `toAskedOfModel`, lists each number with what it is, a picture by its
  ORDER among the ones sent, since a model is handed pictures with no names
  on them. `toAttachmentNote` names them (_picture [2]_) in the history, and
  a report's file list says _(attachment 2)_. A chip an answer draws has
  none. Images are cut to a 1024px long edge — the provider
  charges by DIMENSIONS, so re-encoding without resizing saves bytes and not one
  token, and the first user message is re-sent on every one of up to ten rounds.
  PNG unless that comes back photo-sized: the subject is small text and thin
  borders, which is what JPEG rings around. They ride the FINAL user turn only
  (images before the text for Anthropic, `image_url` data URLs for
  OpenAI/Kimi — Moonshot refuses a public http image), and NEVER the history,
  which carries `(with a picture attached)` instead. `checkCanSeeImages` refuses
  a blind model BEFORE the call and offers one that is not, because a 400 there
  reads as an unreachable service. **A picture with an empty box is still a
  question**, and has to be sent as one: only a file or a pointed-at control
  contributes words, so an image-only ask composed to `''` and went out as an
  empty text block, which Anthropic refuses outright — read back, by the same
  `describeLlmError`, as the provider being down, under the offline bot's
  greeting. `toAskedOfModel` is the one place that decides what the model is
  asked; `askLlmBot` refuses to post an empty ask at all; and the TRANSCRIPT is
  never built from either, because words a user did not type must not be drawn
  as theirs. The assistant can ASK to be shown, with a
  `NEEDS: screenshot|element|file` frame that `parseAttachRequests` strips
  unconditionally, exactly like `OPTIONS:`.
- **A PDF is read as its pages, and a file can be asked about question
  after question** (2026-10-17, the user, with a picture of the assistant
  answering _I cannot open PDF files_ under `1CH.0.pdf`: _convert to images
  for pdf pages then send image as attachment_; then, with the Resources
  panel circled: _add robot icon to each file, click to open file in
  chatbot … let user interact to ask question around the content in the
  file_). **Pictures, not the text layer**: a Khmer PDF is as often as not
  set in a legacy font whose text is Latin letters drawn as Khmer, and a
  scan has none. `public/js/pdf-to-chat-images.mjs` (MuPDF, a child process
  per ask through `main:app:pdf-to-chat-pages` → `pdfToChatPages`) draws the
  first EIGHT pages at the 1024px long edge every picture here is cut to,
  PNG unless photo-sized, handed back as data URLs — nothing written to
  disk, nothing cached in main. `genPdfAttachment` (`fileAttachHelpers.ts`)
  holds them beside the PDF's id: the live store holds a LIST per
  attachment (`putAttachmentPages`), so its ceilings count files and a PDF
  is let go of whole. `toBotImages` sends them in order among the other
  pictures, `toAttachmentLegend` counts them with those (_its pages 1 to 3
  are the 2nd to 4th pictures_), and what the model is told of a PDF is
  worked out AT THE ASK (`toFileSummary`): its pages and which were NOT
  shown, or — no pages held, or a model they are not sent to
  (`toAttachmentText(…, isSeeing)`) — that it cannot be opened. `pageCount`
  is persisted; the pages are not. The 5 MB cap is the report's alone now.
  **A file stays open in its tab** (`findOpenFileAttachments`): the files
  of the LAST question that had one (a file from disk — never a 📷 picture
  or a pointed-at control, which were of the app as it WAS) go to the model
  with every later question until another file is attached or the ×
  of the **Still asking about** line above the box is pressed
  (`ChatSessionType.fileClosedAt`), read again from disk when the window
  has let them go (`reloadFileAttachment`). Only to the model: the
  transcript keeps the question as asked. An empty box with only files is
  `FILE_ONLY_QUESTION` (say what it is, ask what they want), not "help with
  whatever looks wrong". **The Resources panel's 🤖**
  (`ResourcesFileRowComp`, `.app-resources-file-ask`, beside the ⋮ and in
  its menu, only while AI is on and only on `checkCanAttachFileName` — a
  picture, PDF, `.own` or text kind, never a `.docx` or a video) leaves a
  `chatbot-handoff-file` request (`requestChatbotFile`, a whole path, 30 s)
  through `openChatbotWithFile` — the two questions first — and the window
  attaches it in a tab of its own under a card written with no model
  (`genResourceOpeningAnswer`). **The passage the Reader is on rides with the
  file** (2026-10-22, `EC-380`; the user, with `MAT.18.pdf`'s 🤖 circled under
  a Reader on Matthew 18:15-17: _make the chatbot smarter to interact with
  user for the selected resource file_): the previewer provides a GETTER of
  the open panes (`ResourcesReadingContext` — a value that changed with every
  verse click would re-render every row), the row reads it at the press
  (`toResourceReading`: the pane that listed the file, its verses only when
  the passage stays inside the file's chapter, the Reader's own title), and
  `requestChatbotFile(path, reading)` carries it, `toValidResourceReading`
  checking it both ways. The card says _You are reading ម៉ាថាយ ១៨:១៥-១៧ in
  the Bible Reader_ and its first button is that range (`15-17`, cut to five
  verses; none for a whole chapter), kept on the card
  (`ChatMessageType.resourceReading`) for the Read menu. **The card fits the
  file** (`toResourceFileKind`, `EC-381`): **Read** is a chapter PDF's alone
  — an introduction (`MAT.0.pdf`, any chapter below 1) and a list of links
  had been offered verses 1, 2, 3 of a "chapter 0" — an introduction says it
  belongs to the whole book, and any file of the book being read asks _What
  does it say about {passage}?_ first. **Read is the window's own menu, with
  no model** (`EC-382`): it had spent a round with every page as a picture to
  restate the card, and on Auto's free model that round sat at _Thinking_ for
  fifteen minutes; now the verses being read, then `1`, `2`, `3`, `1-3`,
  **Full chapter** (`genResourceReadMenuReplies`), at once. A button that
  names a reference and ends in a question mark is asked as a question, not
  pressed as a cross-reference. The passage is pre-read in the reading's own
  Bible (`bible` from the card's `resourceReading`): asked of the lookup the
  tab aims at, a Khmer reader's `18` came back in the Presenter's KJV. **A
  Resources ask never falls back to the guide** (`askOffline`, `EC-384`):
  searched for `15-17` it drew the Find bar page under a verse card; a passage
  answers with the verses already read and the "could not read the PDF"
  sentence, anything else with the needs-an-assistant sentence and **Open AI
  settings**. **A question that names no passage is about the one being
  read** (2026-10-22, the user: _Explain it in simple words_ under
  `MAT.18.pdf` answered _which verses do you want explained?_ twice, the card
  above saying Matthew 18:15-17): the card is only history, so
  `toResourceReadingAsk` puts the reading on the ASK — its title, `MAT
  18:15-17`, its Bible, and _do not ask which verse they mean_ — whenever no
  range was pressed, and `RESOURCES_SYSTEM_PROMPT` answers a question with no
  verse at once, about that passage or else the whole file, never with a
  question back. Seen live in Khmer on gemma4:cloud: the verses from ពគប and
  a three-step explanation. Each card renders one main passage -- a verse or
  a range such as `1-3` -- pre-read from the installed Bible through
  `owa_lookup_record`; every printed cross-reference on the answer's
  references line becomes a clickable button (up to thirty, across books and
  chapters; a card at any position keeps them, and an old card derives them
  from its own line), and the matching
  explanation paragraphs come from the commentary below the rule. A pressed
  cross-reference opens that verse and reads its own chapter's Resources PDF
  for the closest explanation (`MAT.20.pdf` for `Matthew 20:20-28`). Full
  first discovers the chapter's final verse, then automatically asks for each
  verse in order as an isolated request/card; the next three verse buttons
  move past the chosen range and stop at the real chapter end even when a
  small model writes no valid `OPTIONS:` line.
  `owa_resource_file` returns up to eight PDF pages as pictures by default,
  with explicit coverage fields and `nextPage` for a longer file; its
  embedded text layer is withheld because a legacy font can decode into
  convincing but unrelated characters. Dense pages are
  read at the tool's 2048px high detail, and the unchanged result is reused
  from a bounded OS-temp disk cache between verse cards; the picture
  is the only PDF wording supplied to the model. A repeated-word detector
  rejects a degenerate visual answer and falls back to the exact installed-
  Bible verse instead of displaying invented commentary; raw two/three-letter
  OCR guesses are not offered as cross-reference buttons. A Resources-PDF caution recommends
  reading the Bible and PDF personally; its **Hide for 30 days** uses the same
  timed AI-caution setting as the rest of this window.
  **A Bible note is its words** (`noteFileTextHelpers.ts`): the editor's
  JSON tree walked to headings, lines and list items, a pasted picture as
  `[picture]`, then each marked verse with its highlights and comments —
  sent as it was, the 16 KB cut was the start of a base64 photograph. In
  a narrow panel the row's _Introduction_ tag goes (a container query on
  the row) so the name keeps its room beside the 🤖. **And the rest of
  Resources is the model's to read** (the same day, the user: _let chatbot
  know it is from `Resources`, let chatbot access all in `Resources` …
  like followup other chapter (look into other pdf files)_): a question
  asked while a file inside a Resources folder is open in the tab --
  attached now or still open, however it was attached
  (`findResourceFileNames`, the folder list read fresh) -- is a
  `resources` ask (`resourcesChatHelpers.ts`), shaped like the Lookup
  panel's: the ask names the file as the tool does (`toResourcesAsk`,
  `pdf/LUK.6.pdf`, never a whole path -- a folder's path carries the
  account name), `RESOURCES_SYSTEM_PROMPT` (what Resources is, `LUK.6`
  is Luke 6 and `LUK.0` its introduction, answer from the pages and say
  which file and page), `owa_resource_file` as its on-ask tool plus shared
  `owa_lookup_record` for exact cited passages and `owa_read_website`, five rounds, no
  walkthrough or app hints (`isAppQuestion` is false), and Auto told it
  needs a model that sees. Verified live 2026-10-17 on gemma4:cloud, in
  Khmer: a tab opened on `GEN.4.links.json` asked _what does the file for
  Luke chapter 7 say?_ listed Luke 7, read `pdf/LUK.7.pdf` (the waiting
  lines say both) and answered with its themes by page.
- **A study file is a CARD the person presses** (2026-11-09, `EC-464`; the
  user: _should ask user to confirm file name and confirst create_). A
  drafted study (`owa_resource_file draft`, `chatbot-llm.md`) is held by the
  window -- `keepDraftedStudy`, three at most, never saved with the tab; the
  message keeps only a `reference`, and a press after the window was opened
  again says the draft is not held any more -- and drawn under the answer
  by `RenderStudyDraftComp` (`.cue-lyric.cue-study`, plain text in a
  readonly box, never HTML): the heading, the passage, its Bible and the
  diagram count, a line when the name was taken (_"…" is already in
  Resources, so this one will be "… (1).md"_), the study. Three pseudo
  tools, caught in `handleActing` and registered nowhere: **Create "…"**
  (`owa-study-create`) calls `save`, attaches the new file to the tab
  quietly (`attachHandedFileRef`'s `isQuiet`: no Resources opening card)
  and answers _Saved as "…" in Resources → Default. It is attached to this
  chat_ with **Open it** (`preview` of the real file), **Undo this change**
  and the file chip; **Preview** (`owa-study-preview`) opens the held copy
  in the Markdown Preview window; **Change the name**
  (`owa-study-rename`) asks for a new name, and the tab's next short single
  line (80 characters at most, not a question or a `/` command) is drafted
  again with the held words and that title -- no model -- into a fresh
  card; any other line or press ends the wait. Once attached, the tab is a `resources` ask, so a change
  goes through `draft` with `file` and its card reads **Save changes to
  "…"**, written only against the hash it was drafted from. While a press
  works the tab is busy (`busyHoldListRef`). Every sentence is the
  chatbot's `tran`, in every language's dictionary. Seen live through the
  tools (`agent-tools.md`); the card in the 🤖 window not yet, the AI
  caution being the person's press.
- **Report** (`src/chatbot/reportHelpers.ts`) is for when the app itself is
  wrong. Two presses: the first only ASKS, quoting what will be reported (with
  an empty box, the LAST question asked), cleared by a keystroke. Confirmed, it
  takes a picture BEFORE investigating, reads the build, window, screens and
  console itself — trimmed, since `owa_app_state` carried the data directory
  and dev component names until 2026-09-09 — **the console from the MAIN
  process** (`main:app:recent-console`, `electron/consoleLogHelpers.ts`: the
  last forty errors and warnings of each of the app's own windows, heard
  since the window was made, a repeated line counted once, Electron's
  dev-mode security banner left out — and the `bible-note` package's
  _profiling the playground app … debug view_ advice, which sent the model
  of the user's second inbox report (2026-10-15) after a setting this app
  does not have — through the firewall's `redactSecrets`
  before it leaves main and `toPathScrubbed` in the window). Until
  2026-10-13 it asked the tool host's `list_console_messages` with no page
  named, which that tool has refused since `chrome-devtools-mcp` 1.8 — the
  error was swallowed and EVERY report said _Nothing was logged_; it was
  found in the first report a person sent, about an uncaught error. That
  tool could not have had the line anyway when the error is what opens the
  help window: it hears a page from when its own session starts — then asks the model through `askLlmBot` DIRECTLY,
  not `handleAsking` (which would add "show me step by step" under a bug). The
  answer is a `REPORT:`/`TITLE:`/`STEPS:` frame parsed like `OPTIONS:`; no
  frame is not an error. **Nothing is sent by that**: the report waits on
  **Send report**, held in a bounded in-memory map (the message stores only
  the reference). **Send posts it when the shared registry names a server
  that takes reports** (2026-10-13, the user's ask: _a shared server can be
  type accepting report … collect information and prepare as a prompt (raw
  text) then post to the endpoint_; `chatbot-llm.md`): the report's text
  (`genReportPrompt` — a few lines saying what it is and which parts to
  trust, then the report fenced as DATA, without **How to send this**) goes
  to main over `LLM_REPORT_POST_CHANNEL` and from there to that server. The
  window names no address and is told none; the wait is a stoppable pending
  ask with a _Sending the report_ line. **Its FILES go with it** (the same
  day: _accept json … and accept files like markdown pdf_):
  `gatherReportFiles` runs at the press — the picture of the app, then
  everything attached to the report (`readReportThreadAttachments`: every
  `REPORT_NOTE` message of the thread, so a report written again keeps the
  picture that came with the first words). A picture comes from the
  window's own memory; a text file and a PDF are READ OFF THE DISK there and
  then, size asked first, and held no longer than the sending. Each file
  either goes or is NOTED with why (too large, not a kind a report carries,
  no longer there), and `genReportPromptWithFiles` writes the copy that
  says so — `report.prompt` is the words-only copy, which is also what goes
  again, by itself, when a server answers _too large_. The prepared card
  names the files before the press. `describePostedReport` is the one place
  the outcome is worded: **Sent** only when a server took it — with the
  names of the files that went and of any that did not — otherwise that
  nothing was sent — and why, when a server refused — with the email route.
  A report main KEPT because its server was away (`queued`, see
  `chatbot-llm.md`) is said as such — _I kept it, and the app will send it
  by itself as soon as that server is back … nothing more you need to do_ —
  never as _nothing was sent_ (`PostedReportType.isQueued`).
  **Stop while it is sending** says nothing at the press: `sendReportPrompt`
  gives main two seconds to say what became of the post, and the tab then
  reads _Stopped. The report was not sent_ or _It had already gone when you
  pressed Stop_ — never _stopped_ over a report that was filed.
  Either way it saves
  `OWA-<date>-<id>.md` + `.png` into Downloads with chips that open them.
  **Three ways in** (same day): **Report** under Ask; the Help button's
  third row and the native Help menu's **[en:tran:Report a Problem]**; and
  the question an uncaught error asks before the reload one
  (`offerErrorReporting` in `src/helper/errorReportOfferHelpers.ts`, a
  module of its own so a test holds what the press does -- no automation
  may answer that confirm -- once in ten minutes,
  titled **[en:tran:Something Went Wrong]**). The last two leave a 30-second
  request (`requestChatbotReport`) after the 🤖's own two questions, and the
  window opens a tab on an OFFER card (`genReportOffer`) whose **Report**
  button (`REPORT_START_TOOL_NAME`, a pseudo tool) is the press that lets
  it look. **Every place that asks says what a report carries**
  (`REPORT_COLLECTS_TEXT`: app version and build, system information, window
  and selection, screens, the console log, the end of the conversation, a
  picture) — the user's asks: _let user aware console log also collected_,
  _system and app information also collected_. **A tab that is reporting
  KEEPS reporting** (`readReportThread`, the user's words with a picture of
  their own report gone wrong: _I'm trying to report but it's hard_, _chatbot
  should keep knowing that user try to share information_ — they had typed
  under the card and pressed **Ask**, and it was answered as a question):
  from the offer card or a first press of Report until Send report is
  pressed, `handleAsking` hands whatever is typed or attached to the report
  (a line starting with a slash is still a command), more of it is ADDED —
  the complaint is everything said for it (`genReportComplaint`), the
  transcript shows only what was just typed — the box's attachments go with
  it (pictures shown to a model that sees, a text file's words and a
  pointed-at control's lines folded in after the complaint, every one of
  them SENT with the report), and the
  tab is called **Report: …** (`genChatSessionTitle`, the three marks in the
  leaf `reportMarks.ts`). A report still being WRITTEN counts too (a
  `REPORT_NOTE` message with no card yet), and words typed then are not a
  question either: **Add** stops the write-up and starts it again with them
  (`handleAdding`, the pending ask's `kind: 'report'`) — handed on as an
  ordinary addition they were answered by the assistant and left out of the
  report. **Helping comes before reporting** (the user, the same day: _some
  problem is not issue, it is user problem so before helping user to report
  let try to help user to resolve it first_): the investigation is asked to
  say first whether it is something the person can put right themselves, a
  fault or a wish, and a `TRY THIS:` marker in front of `REPORT:` becomes
  `report.fix` — the answer is then `genFixCard` (_Try this first_, the
  steps, **That fixed it** / **Still a problem — report it**) with the
  report written and held back. **STEPS are only what somebody saw**
  (2026-10-15): the first report a person sent — an uncaught error,
  nothing said of what led to it — came back with three made-up steps
  (open the Presenter, the Documents tab, select a song), so the frame
  asks for what the person said they did or the model saw happen, and
  `unknown` with what was on screen otherwise. **The frame is read in the
  markdown a model dresses it in** (the same day, the user's own inbox
  report: a free model wrote `**REPORT**` alone on a line and
  `**TRY THIS:**`, neither was seen, and the whole answer went out as one
  block under the person's words for a title): a bold or heading marker
  needs no colon when nothing follows it, a field may be bold or bulleted,
  a closing `---` and line-end spaces come off; a sentence that merely
  starts with _Report_ is not a frame, and the words a bold marker carried
  inside it (`**TRY THIS: steps you can try yourself**`) are its heading,
  not a step. Fixed closes the thread
  (`REPORT_RESOLVED_NOTE`, nothing sent); Still puts up the prepared card,
  whose report says what they were told to try. A typed _yes, thanks_ or
  _no_ under that card is its own button (`readFixReply`, short answers
  only — anything that says more IS more for the report). **A PDF can be
  attached** (`kind: 'file'`, `genFileAttachment`): the model is shown its
  pages as pictures (see _A PDF is read as its pages_ below) and it rides
  along for the report to send from its path. **A home folder
  loses the account's name** in the console lines and in the error an offer
  card names (`toPathScrubbed`, a leaf `fileHelpers` re-exports), and a
  turn of the conversation is quoted cut at 2 000 characters. The prepared card carries
  **Copy report** beside Send, so the whole text can be read BEFORE it
  goes. Send
  is caught in `handleActing` by `REPORT_SEND_TOOL_NAME`, which the server never
  registers, so nothing outside the window can file in the user's name. **It
  says WHO wants it** (`EC-176`): the address is read off the LIVE help page
  through `main:app:read-web-page` (`findContactEmail` in
  `src/server/appHelpers.ts`, parsed from the rendered text), the package
  `author` only as fallback. It offers a `[Open Worship app] <title> (<reference>)` subject and **Copy report** / **Copy subject** / **Copy
  picture** (PNG via `copyImageToClipboard`) / **Copy email address** /
  **Email it** (a `mailto:` with address and subject only; the report goes to
  the clipboard first, since mail clients cut a body at ~2 000 characters) —
  pseudo tools carrying ONLY the reference. The address is found at the press,
  and **Copy report** falls back to the saved file after a reopen. The saved
  document opens with **How to send this** and carries the address source,
  machine, selection, run sheet, screen contents, displays and who
  investigated.
- **The Presenting Control takes a snapshot** (`ControllerToolbarComp`, in the
  history group that survives collapsing) of the app WITH the drawing on it, and
  offers three things to do with it: hand it to the help window, copy it, or
  save it into the Background Images folder so it can be presented. It is one
  IPC — `main:app:capture-window` → `captureWindowImage` → `capturePage` on the
  window's own web contents, which is why the chatbot popup sitting on top of
  the app never appears in a picture of the app. **It is asked up to four
  times** (2026-10-13, `CAPTURE_WAIT_LIST_MILLISECONDS`): a window that has
  just loaded or RELOADED — what a window does after the error somebody is
  about to report — or sits behind another has no frame to hand over, and
  `capturePage` rejects with `UnknownVizError` (or answers an empty
  image). Measured on a main window reloaded while covered: the first ask
  failed and the one 100 ms later had the picture, and a live report had
  gone out without its picture for that. `invalidate()` between asks; after
  the fourth it throws a sentence, never the engine's word. The same IPC serves the
  chatbot's own 📷 and `owa_screenshot` — which, given a `page`, sends
  `isOwnWindow` and gets THAT page's window, never the main one. A snapshot bound for the chat window is
  HELD in the main process (`sendChatAttachment` / `takeChatAttachment`, exactly
  one) because the same press also opens that window, and a renderer still
  loading has nobody listening.

- **A song is attached as its words and changed in its tab** (2026-11-06).
  A `.owl` attachment is its Open Lyric text, not the JSON wrapper
  (`toLyricFileText` in `genAttachmentFromPath`). A Documents row's
  **[en:tran:Open in Chatbot]** and the Lyric Editor's robot hand it over
  through `openChatbotWithFile` (`src/helper/ai/lyricChatbotMenuHelpers.ts`),
  and the window opens it under a card written with no model
  (`genLyricOpeningAnswer`): what can be changed in a sentence, then five
  buttons -- replace the words with / add under each line (the language the
  song's NAME says, else the app's, else _another language_), add a section,
  add chords, change the key. A question while the song is open is a
  `lyric` ask (`chatbot-llm.md`): the song is read AGAIN before every
  question (`owa_lyric_edit read`), because the attachment's words are from
  when it was attached, and its notation never reaches the model. After a
  change the answer carries **[en:tran:Undo this change]**
  (`LYRIC_UNDO_TOOL_NAME`: the window calls `owa_undo` and says it in a
  sentence) and **[en:tran:Show it in the list]**. The install-a-language
  route stays out of a tab with a song open: _Add another language under
  each line_ had been read as a language to install (seen live). The Lyric
  Editor follows a change made from outside it (`lyricEditorChatbotSync.ts`):
  it opens on the SAVED text with the unsaved edits applied as an edit, so
  Save is there to press, and writes an outside change through Monaco's own
  edit -- never open-lyric's `value` setter, which resets the dirty baseline
  and greyed Save out (seen live).

- **A slide document is attached as its words and changed in its tab**
  (2026-11-07). A `.ows` attachment is a line a slide of its text boxes
  (`toSlideFileText`), never the JSON whose pictures are base64. A
  slide document row's **[en:tran:Open in Chatbot]** in the Documents list
  (not a PDF, PPTX or DOCX row) and the Slide Editor footer's robot
  (`SlideEditorChatbotButtonComp`) hand it over through
  `openDocumentInChatbot` (`lyricChatbotMenuHelpers.ts`, the song's names
  kept as aliases), and the window opens it under a card written with no
  model (`genSlideOpeningAnswer`): the song card's two translate buttons,
  **[en:tran:Check the spelling]**, **[en:tran:Make the words larger]** and
  **[en:tran:Make slides like a picture]**. A question while it is open is a
  `slide` ask (`chatbot-llm.md`), the document read again before every
  question. **It stays open past a picture attached after it**
  (`findOpenSlideAttachments`): `findOpenFileAttachments` keeps only the
  last question's files, and the picture of the slides wanted, attached from
  a folder, would have closed the document it was attached to change. After
  a change the answer carries **[en:tran:Undo this change]** and
  **[en:tran:Show it in the list]**, the song's own two. **In a tab with a
  song or slides open, only a supported question asked AS IT STANDS goes to
  the guide** (`findKnownQuestion(…, true)`): _list me more options_ carried
  a row's keyword phrase and was answered with how to open a slide card's
  menu. And _list me more options_, _what can you do?_, _help_ (English,
  a few words and nothing more, `checkIsDocumentOptionsAsk`) show the
  document's card again with no model.

- **A presenting flow is attached as its lines and changed in its tab**
  (2026-11-07). A `.owpf` attachment is a line a line, title and kind
  (`toFlowFileText` in `src/chatbot/flowChatHelpers.ts`), never the JSON. A
  presenting flow's row menu carries **[en:tran:Open in Chatbot]** right
  under **[en:tran:Open Preview]** (`PresentingFlowFileComp`, spliced in
  outside the menu's memo so the AI switch is read when the row draws) and
  hands it over through `openDocumentInChatbot`; the window opens it under
  a card written with no model (`genFlowOpeningAnswer`) with four buttons
  the user chose: **Check the running order**, **Build it from my order of
  service**, **Clear the screen between items**, **Move on by itself** --
  each a question pressed, carrying its own hint (`readFlowButtonHint`).
  A question while it is open is a `flow` ask (`chatbot-llm.md`), the sheet
  read again (`owa_presenting_flow_edit lines`) before every question and
  shown as plain lines (`toFlowSheetText`); a picture of the bulletin
  attached after it keeps it open (`findOpenFlowAttachments`, the slide
  finder with a name test), and a flow attached now, or after slides, wins
  over a slide document still open in the tab (`pickOpenDocumentKind`). A
  send with no words builds the running order from what was attached
  (`FLOW_WORDLESS_HINT`). After a change the answer carries
  **[en:tran:Undo this change]** and **[en:tran:Show it in the list]**, which rings the row
  in `Presenting Flow List` (`EditedLyricType.listName`,
  `toEditedDocumentListValue`); there is no Save to press, the change being
  the file.

- **A Bible note is attached ONE NOTE at a time and changed in its tab**
  (2026-11-07). A `.own` file holds many notes, so a note row's
  **[en:tran:Open in Chatbot]** (right under **[en:tran:Open]**, not on a
  verse's marks nor an unreadable row; `noteChatbotMenuHelpers.ts`) and the
  Bible Note window's footer robot (`bibleNoteHelpers1.tsx`, after flushing
  the window's pending history write) hand over the path AND the note's id
  (`requestChatbotFile(path, null, noteId)`, checked both ways). The window
  attaches that note alone (`genAttachmentFromPath(path, noteId)`, its title
  on the chip, `noteId` persisted) under a card written with no model
  (`genNoteOpeningAnswer`): the two translate buttons,
  **[en:tran:Check the spelling]**, **[en:tran:Summarize this note]**,
  **[en:tran:Format it so it is neat and easy to read]** (since 2026-11-09,
  BN-58: formatting a messy note is the job asked for most; it had been
  **Tidy it into headings and lists**). A question while it is open
  is a `note` ask (`chatbot-llm.md`), the note read again from its editing
  head before every question. A note attached now, or opened after a slide
  document or a running order, is the one asked about
  (`checkIsNoteOpenedLast`). After a change the answer carries
  **[en:tran:Undo this change]** and **[en:tran:Show it in the list]**
  (`Bible Notes > <title>`). **A saved conversation keeps five buttons on a
  message now**, not three: a reopened window had dropped the last two of
  every document card's five. **A note the assistant MADE is attached the
  same way** (2026-11-08, `openCreatedNoteRef`): its window opened, then
  `attachHandedFileRef` with its path and id -- the chip, Bible Note, its
  window, its card -- in the tab it was asked in (`chatbot-llm.md`, a NEW
  note). Like a row's, the chip waits in the box until a question carries
  it, and a reload of the help window drops it (BN-19).

- **A foreground SESSION is attached by its ids and read afresh**
  (2026-11-09, the user, the strip `Default · Session 2 · +` circled:
  _sessions of opening foreground component should be able to attached to
  the chatbot for the chat context_; W-61). Kind `'foreground'`, field
  `foreground` (`ForegroundAskType` in `src/helper/ai/foregroundAskHelpers.ts`:
  `widget`, `sessionId`, `sessionName`, optional `itemId` / `itemLabel`),
  copied field by field by `toValidAttachments` through
  `toValidForegroundAsk` -- a widget of the thirteen keys, an id `''` or
  `s<base36>` -- and NOTHING else stored: its words, look and screens are
  read again before every question (`owa_foreground_edit read`, the way a
  flow's lines are) and ride the ask, never the transcript. The chip is
  `<component> › <session>` (`toForegroundChipName`, `bi-layers`), numbered
  like every chip; pressing it rings the session button in the Presenter
  (`owa_find_ui "Quick Text > Session 2"`). **Three ways in**, each only
  while AI is on: the session button's menu -- `MediaSessionsComp`'s
  optional `genExtraMenuItems`, which only the FOREGROUND strips pass (the
  Background tabs and the file lists are untouched) -- and the panel
  header's robot (`ForegroundChatbotButtonComp`, the session in front; a
  sessionless panel sends `sessionId ''`) both leave a 30-second
  `chatbot-handoff-foreground` request (`requestChatbotForeground`,
  `openChatbotWithForeground`), which the window takes in a tab of its own
  (`attachHandedForegroundRef`: the chip in the box, the tab asking about
  the Presenter, `genForegroundOpeningAnswer`'s card with four pressed
  questions, no model); and the attach row's fourth button, **Attach a
  foreground session**, reads `owa_foreground_edit read {open: true}` at the
  press and lists the open panels' sessions (`RenderForegroundPickComp`), a
  pick adding the chip to the box; no panel open, or the Presenter not
  readable, is a line saying where to go. **It stays open in the tab**
  (`findOpenForegroundAttachments`, `ChatSessionType.foregroundClosedAt`)
  past later questions and pictures until the **Still asking about** ×;
  several sessions may be open at once, each named by its number. **Ask
  again** keeps it (`toReusableAttachments`). A question with one open is a
  `foreground` ask (`chatbot-llm.md`).
