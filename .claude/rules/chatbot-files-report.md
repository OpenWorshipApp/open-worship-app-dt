---
paths:
  - 'src/chatbot/attachmentHelpers.ts'
  - 'src/chatbot/fileAttachHelpers.ts'
  - 'src/chatbot/assetPreviewHelpers.ts'
  - 'src/chatbot/attachErrorHelpers.ts'
  - 'src/chatbot/documentTextHelpers.ts'
  - 'src/chatbot/documentWordsHelpers.ts'
  - 'src/chatbot/deckSongAskHelpers.ts'
  - 'src/chatbot/deckSongAnswerHelpers.ts'
  - 'src/chatbot/noteFileTextHelpers.ts'
  - 'src/chatbot/resourcesChatHelpers.ts'
  - 'src/chatbot/studyVerseCheckHelpers.ts'
  - 'src/chatbot/studyNameCheckHelpers.ts'
  - 'src/chatbot/foregroundChatHelpers.ts'
  - 'src/chatbot/reportHelpers.ts'
  - 'src/chatbot/reportMarks.ts'
  - 'src/helper/errorReportOfferHelpers.ts'
  - 'src/resources/ResourcesFileRowComp.tsx'
  - 'src/markdown-preview/MarkdownPreviewChatbotButtonComp.tsx'
  - 'src/markdown-preview/markdownPreviewChatbotHelpers.ts'
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
  a `dataUrl` back in. **What waits in the BOX from a file is kept with its
  tab** (2026-11-11, `EC-498`; BN-19 for a note): a file a Resources 🤖, a
  document's Open in Chatbot or the Markdown Preview's 🤖 handed over waits
  in the box under a card saying it is attached below, and the window held
  its box in memory alone -- a reload (a language installed, a code edit in
  dev) or the window closed and opened again dropped the chip, and the next
  question went out about nothing. `ChatSessionType.boxFiles` keeps the
  DESCRIPTION, as a message does, of what a reload can bring back
  (`checkIsKeptBoxAttachment`: a file from disk and a foreground session --
  never a picture of the app or a pointed-at control, four at most). Every
  save writes it from the window's box (`saveChatSessions(state, boxMap)`; a
  chip put in or taken off is a save of its own, on the same 400 ms
  debounce), and the box is started from it once, at mount
  (`splitSavedBoxes`, which takes it off the tabs so the box is its one
  place). A PDF's pages and a picture from a folder are read again at the ask
  (`reloadFileAttachment`), so such a chip in the box or still open above it
  is not drawn greyed for want of its bytes; a text file in the box is read
  again at the ask too (`refreshTextAttachment`, as an open one is -- it may
  have been changed in its own window since); and a note waiting in the box
  keeps its tab on Bible Note and in the note's own window
  (`findTabNoteTarget`; the launch focus reads the box too). Unit-tested on
  a reload of the window (`ChatbotAppComp.ut100a.test.tsx`).
  **Every attachment carries a NUMBER** (2026-10-13,
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
- **A document is its WORDS, read the way the app reads its kind**
  (2026-11-13, `EC-589`, then `EC-590`; the user dropped eight hymnal
  slide decks into their Documents to test _a lyric file from a document
  file_, and the window had refused both kinds). The window first read a
  deck's zip itself; at the user's word -- _it should use the tool
  pptx-to-html-conv like what the app using, then extract text from the
  html_, then _after powerpoint to lyric then appdocument to lyric_ and
  _also add other support like docx pdf ..._ -- `documentWordsHelpers.ts`
  reads each kind through what the app already has. A deck or a Word file
  goes through the app's OWN converter (`main:app:pptx-to-htmls` /
  `main:app:docx-to-htmls`, the ones the Documents list shows them with):
  the app's preview of it (`<file>-htmls`, `<file>-docx-htmls`) when one is
  there and its `info.json` md5 is this copy's -- the Documents list's own
  check -- else a conversion into
  `<temp>/open-worship-app-song-words/<uuid>`, read a page at a time, and
  that folder deleted in a `finally`: nothing is written beside the
  person's file, nothing is kept. `documentTextHelpers.ts` (pure) reads the
  HTML: a paragraph a line, an empty one an empty line, `<br>` a new line;
  the head, a style sheet, a script and a chart's SVG `text` are no words;
  the converter's bullet (a span and `&nbsp;` opening a paragraph) is
  dropped, a zero-width space between two words kept (a script written
  without spaces breaks its words with it) and one at a line's edge
  trimmed with the spaces there (`toLineText`: a title slide's number line
  had ended in its colon, a zero-width space and a space, which hid the
  colon the title is read by); a Word page's header and footer
  are left out, a deck's hidden slides skipped, and a header every slide
  repeats but for its numbers dropped (`dropRunningLines`). A slide
  document (`.ows`) is its text boxes, a slide a block, a slide turned off
  left out. A PDF is its TEXT LAYER through the help window's own MuPDF
  page reader (`main:app:pdf-to-chat-pages`: the first eight pages, its
  pictures drawn at 64px and let go of), each page's own number and a
  running header left out: a scan gives nothing, and a legacy-font PDF
  letters that are not its words -- which the person sees in the draft
  before **Create**. 16 MB a file at most; `.doc` and `.ppt` are not read.
  A deck or a Word file ATTACHED (the box, a drop, a path, a Resources or
  Documents row's 🤖) is an ordinary TEXT attachment (`genTextAttachment`),
  so any model reads it; one that cannot be read is named in the refusal
  and the other files of the drop still come in.
  **A song made of documents needs no model, on any assistant and in any
  tab** (`EC-590`). An ask to make a song OF them
  (`checkIsDocumentSongAsk`: _Make a song from it_, the card's own button;
  _turn this into a lyric_; _Can you …?_ -- never _add the song title to
  slide 1_, a slide document's own change, nor _write a summary of the
  song_, a question about a PDF) over attachments that are ALL slide
  documents, decks, Word files or PDFs from the disk
  (`toSongDocumentFiles`) -- or, the box empty, over the files of the tab's
  last question (`findOpenFileAttachments`), unless the ask names a kind or
  a name they are not (`pickOpenSongDocuments`) -- is drafted by the
  window, a file at a time (`draftDeckSongs`), before the slide, Resources
  or song conversation is asked. A deck's words are reused when the attach
  kept them whole; a cut copy, a slide document (its attachment describes
  it for a model) and a PDF (its pages) are read at the draft.
  **[en:tran:Make a song from it]** is on a slide document's card (its
  sixth button), first on a deck's or Word file's card and last on any
  other PDF's -- never a chapter's study or an introduction -- and a
  Documents row's **[en:tran:Open in Chatbot]** is on PowerPoint, Word and
  PDF rows too. Asked with nothing attached or open -- _new lyric from
  powerpoint_, _make a song from my PDF_ -- the Documents list answers
  (`deckSongAskHelpers.ts`, `planDeckSongAsk`): its documents of the kind
  named as buttons, or the one the ask named drafted at once; in a
  document's or a Resources file's own tab too, for a file other than the
  one open there. Plain word files (`.txt`, `.md`) keep `EC-589`'s route:
  _Create lyric files from these_ and the like (`checkIsSongFileAsk`: a
  song word and a making verb, sixteen words at most, no question mark, no
  title named) over attachments that are ALL plain word files or decks
  (`toSongFileSources`, `checkIsSongSourceFileName`) is drafted by the
  window, a file at a time, under **Create all N songs**
  (`chatbot-commands.md` has the buttons); a picture beside them makes it
  a model's question. Seen live on a scratch instance with the zip reader
  (EC-589): four decks, 2 s, no model round, four songs saved. The box's
  own picker (its ⋮ → **[en:tran:Attach a file]**) lists slide documents,
  decks and Word files beside pictures, text and PDFs (the `accept` of
  `.chat-file-input`). **Seen live through the converter** (2026-11-13,
  `EC-590`, a scratch instance with a copy of the user's eight decks, a
  slide document, a Word file and a PDF; no model round in any):
  _new lyric from powerpoint_ listed six of the eight decks as buttons and
  said how to reach the rest; a deck's button drafted its hymn in about
  0.4 s, the conversion included (383-406 ms, timed on four), the
  conversion's temporary folder made and deleted and nothing written beside
  the deck; all eight came out titled whole -- the six by their buttons,
  the other two named in the ask (_make a song from # 7 new.pptx_), the
  fifth once its number line's zero-width space was trimmed; a slide document's button
  then **Create** saved its song; a PDF's button drafted from its text
  layer; a Word file named in the ask was drafted at once, and attached in
  the box its words were reused, not converted twice; with the box empty
  the file the tab last carried was drafted again; the slide card's
  **[en:tran:Make a song from it]**, the card re-drawn by _List me more
  options_, drafted within 1.2 s; and two decks attached under _Create lyric
  files from these_ came out as two songs under **Create all 2 songs**. In
  a Khmer window the list, a deck's button and the card's translated button
  did the same. Not seen live: the Resources card's button (unit-tested),
  and a Documents row's **[en:tran:Open in Chatbot]**, which asks the AI
  caution, the person's to answer.
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
  has let them go (`reloadFileAttachment`). A plain TEXT file's words are
  read again for every question (`refreshTextAttachment`, 2026-11-10,
  `EC-485`). They had been the words read when it was attached, so a study
  saved by this window's own **Save changes** went out as it WAS, and the
  model's next whole-file change put the saved section back. The app's own
  documents (`.owl`, `.ows`, `.owpf`, `.own`) are not read twice: their
  conversations read them as they are now with their own tools. Only to the
  model: the transcript keeps the question as asked. An empty box with only files is
  `FILE_ONLY_QUESTION` (say what it is, ask what they want), not "help with
  whatever looks wrong". **The Resources panel's 🤖**
  (`ResourcesFileRowComp`, `.app-resources-file-ask`, beside the ⋮ and in
  its menu, only while AI is on and only on `checkCanAttachFileName` — a
  picture, PDF, `.own`, text, `.docx` or `.pptx` kind, never a `.doc` or a
  video) leaves a
  `chatbot-handoff-file` request (`requestChatbotFile`, a whole path, 30 s)
  through `openChatbotWithFile` — the two questions first — and the window
  attaches it in a tab of its own under a card written with no model
  (`genResourceOpeningAnswer`; a study the assistant can change gets
  `genStudyOpeningAnswer`'s, below, `EC-595`). **A PDF or Markdown file's own window opens
  with it and stays above the main window while it is attached**
  (2026-11-10, the user: _like bible note I want behavior of during attached
  to chatbot the window have to be on top of main window_): the row passes
  its own Preview PDF / Markdown Preview open as `beforeOpening`, and the
  tab's newest such file is held over the main window, under the help
  window (`chatbot-window.md`, the held window). **That open REUSES**
  (2026-11-10, `EC-484`): a window already open on the file, whichever
  press opened it, is brought forward and none is added (`isAnother: false`
  → `appReuseOpen`), while the row's own press opens one more window every
  time -- the user: _as a user I want to open 2 windows of one resource file
  so I can read different parts at the same time_. With two open the tab
  works in the first, and **Working in** lists the other as `… · own window
  2`. **The passage the Reader is on rides with the
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
- **The Markdown Preview has a 🤖 of its own, and its editor offers the
  words selected** (2026-11-11, the user, the preview of
  `JHN.3.The New Birth and God's Love.md` with line 7 selected in its
  editor: _selected text in editor should have option to mention in chatbot
  input text, on the markdown file preview should have chatbot icon to
  attach and forcus on chatbot_). The head row ends in a 🤖 after
  **[en:tran:Reveal in File Explorer]** (`MarkdownPreviewChatbotButtonComp`,
  **[en:tran:Ask the Assistant About This File]**, the Resources row's
  words), and the editor's right-click menu (Shift+F10 from the keyboard)
  offers **[en:tran:Ask the assistant about this]**, the Bible selection
  bar's words, greyed out while nothing is selected
  (`precondition: 'editorHasSelection'`). Both appear only while AI is on,
  and the switch is read ONCE: the button's `useState`, the action's
  `onInit`. It is a synchronous ask of main, and the toolbar draws again at
  every keystroke. Both presses go through `openMarkdownInChatbot`
  (`markdownPreviewChatbotHelpers.ts`), which runs the caution, then
  `requestChatbotFile(path, null, null, mention)` and `openChatbotPage()`.
  Everything it needs is imported at the PRESS, `openChatbotPage` from its
  own leaf `src/helper/chatbotPageHelpers.ts` (re-exported by `domHelpers`,
  whose module-level IPC listeners a locked-down reader must not load).
  The preview mounts no popup host, so the caution FAILS OPEN there, like
  `lwShare`'s Ctrl+Shift+A (`chatbot-window.md`). The path is read at the
  press (the toolbar's `filePath`, the editor's `preview-file`). A window
  keeps one file for its life since 2026-11-11 (a link opens its file in a
  window of its own, RD-131), so that is the file handed over. The words (`toEditorSelectionMention`) are a
  `SelectionMentionType` with `lines` (1-based `first`/`last`; a selection
  ending at column 1 of the next line ends on the line before) and the
  text around them on their lines; the quote reads
  `Selected text (JHN.3.study.md:7):` (`toSourceWhere`), the words between
  `**` in their line. **The tab** is the one already holding that file,
  in its box or still open in it (`findSessionHoldingFile`: the tab in
  front first, then the newest; slashes and case alike through
  `toPreviewPathKey`; a note's file is not this file). That tab is brought
  forward and the quote goes in its box, with nothing attached twice. With
  no such tab, a new one gets the file and its opening card (a study the
  assistant can change, the study card, `EC-595`), then
  the quote (`mentionHandedFileRef`). The 🤖 alone opens a tab of its own
  every time, as the row's does: at the 12-tab cap that is an empty tab,
  else the tab in front. Seen live 2026-11-11 on the dev app with the
  user's John 3 study. The 🤖, with twelve tabs open, attached the file to
  the tab in front as chip 2 under the opening card, and **Working in**
  named `… · own window 2`. Line 82 selected and asked about from the
  editor's menu was quoted as
  `Selected text (JHN.3.The New Birth and God's Love.md:82):` in the tab
  holding the file. No console error.
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
  quietly (`attachHandedFileRef`'s `isQuiet`: no opening card)
  and answers _Saved as "…" in Resources → Default. It is attached to this
  chat_ with **Open it** (`preview` of the real file), **Undo this change**
  and the file chip; **Preview** (`owa-study-preview`) opens the held copy
  in the Markdown Preview window; **Change the name**
  (`owa-study-rename`) asks for a new name, and the tab's next short single
  line (80 characters at most, not a question or a `/` command) is drafted
  again with the held words and that title -- no model -- into a fresh
  card; any other line or press ends the wait. **A NEW study asks where
  it is kept** (2026-11-12, `EC-509`, the user: _when create markdown file
  for user make sure ask user into resource or bible-note area_): the card
  offers two Creates, **Create "…" in Resources** and **Create "…" in Bible
  Notes** (`genStudyDraftActions`; the press carries `to`, read back by
  `readStudyCreatePlace` -- a card saved before the choice, with a plain
  **Create "…"** and no `to`, still creates in Resources). Bible Notes is
  the Bible Notes folder of the session in front
  (`getActiveBibleNotesDirPath`, `src/bible-list/note/bibleNotesDirHelpers.ts`,
  setting reads over the leaf `src/helper/dirSourcePathHelpers.ts` --
  `DirSource` itself is never loaded in the help window); its list watches
  that folder and draws the `.md` as a Markdown row, so nothing is
  announced and no Resources folder is listed. That press asks for the name
  the study was DRAFTED under (`toBibleNotesDraftName`: the `(1)` a taken
  Resources name gave it is Resources' own) and answers _Saved as "…" in
  Bible Notes._ The file is attached as `Bible Notes/<name>`
  (`findResourceFileNames`, which reads that folder only for a `.md`, and
  `toBibleNotesStudyName` in `agentResourceNameHelpers.ts`), the name
  `read`, `draft` with `file`, `save`, `preview` and the translator all take
  (`resolveStudyFile`, `findBibleNotesFolder`; a Resources folder of that
  name is asked first), so a study kept there stays the chat's to read,
  change and translate (`findOpenStudyFiles` takes both prefixes). No
  folder set, or a `to` it does not know, is refused in a sentence.
  **A model naming it without its folder reaches it** (2026-11-14,
  `EC-706`, the user: _check why chatbot still arguing with me_): the
  card and the chip name a study by its file name, the model copies that,
  and with a namesake in Resources → Default the worker had changed the
  namesake -- twice saved, then every ask told the study was translated
  already. `pinOpenStudyFile` (`studyFileChatHelpers.ts`, in
  `runMcpToolCall` before `draft`, `translate` and `read`) gives a `file`
  that is the name alone, or the other study folder's prefix, the tab's
  ONE open study of that name; a whole path, a name two open studies
  share and the new study a card holds keep theirs. And a change card
  says where it writes, `Resources › Default › …` or `Bible Notes › …`
  (`toShownStudyPlace` in `RenderStudyDraftComp.tsx`, the existing
  **[en:tran:Resources]** and **[en:tran:Bible Notes]** keys). Seen live
  on a scratch dev instance, a stand-in model making GPT-5's call.
  **Its row in that list opens it in the chat** (2026-11-13, the user, a
  Bible Notes Markdown row's menu open: _markdown file in bible-note
  should have open in chatbot context menu as well_):
  **[en:tran:Open in Chatbot]**, right after **[en:tran:Preview]** and
  only while AI is on (`MarkdownNoteFileComp`, through
  `genDocumentOpenInChatbotContextMenu` with the row's own preview open),
  does what the Resources 🤖 does for a Markdown file: the two questions,
  its preview window opened -- the one open on it brought forward -- then
  a tab of its own with the file attached under the study card
  (`EC-595`, below). Unit-tested; not seen in the window. Once attached, the tab is a `resources` ask, so a change
  goes through `draft` with `file` and its card reads **Save changes to
  "…"**, written only against the hash it was drafted from -- a
  translation too (2026-11-10, `EC-478`): the window translates the file a
  part at a time, each part a counted line on the wait, and the card holds
  the whole file with the translation added. Seen in the 🤖 window the same
  night: _translate all to khmer and then append the translated content to
  new pages_, on a study handed over by its Resources 🤖, kept the English
  unchanged and appended the Khmer pages. Asked again for a language the
  file already holds, the card holds the new translation in the old one's
  place, never a second (2026-11-13, `EC-547`, `chatbot-llm.md`). While a press
  works the tab is busy (`busyHoldListRef`). Every sentence is the
  chatbot's `tran`, in every language's dictionary. Seen live through the
  tools (`agent-tools.md`), and in the 🤖 window on 2026-11-10 on Auto
  (`EC-485`): a John 3:16-17 study drafted with three diagrams, previewed,
  created, a section changed and a prayer appended, each written only by
  its press. A drafted CHANGE is shown to the model with
  `STUDY_CHANGE_HELD_NOTE` -- press **Save changes**, and say every part
  `change` names -- after its answer had sent the person to a **Create**
  the card does not have, and named only the part asked for.
- **A study the assistant can change opens on a card of its own**
  (2026-11-13, `EC-595`). Handed over by the Resources 🤖, a Bible Notes
  Markdown row's **[en:tran:Open in Chatbot]** or the Markdown Preview's
  🤖, a study had opened on the Resources card -- _What is this file
  about?_, _Sum up the main points_, _Explain it in simple words_, all
  questions to read it by -- while a study is opened in the chat to be
  changed, and nothing on the card said it could be. `attachHandedFileRef`
  now gives a Markdown file the study tools can change
  (`checkIsChangeableStudyName` in `agentStudyFileRules.ts`, over the name
  `findResourceFileNames` gives: a `.md` straight in `Default/` or
  `Bible Notes/`, either case, a name `checkAgentFileName` takes)
  `genStudyOpeningAnswer`'s card (`resourcesChatHelpers.ts`, no model):
  what it can change in a sentence, then **Replace the words with …** and
  **Add … after it** -- `translate`'s two places, `replace` and `append`
  (`genStudyTranslateReplies`) -- **[en:tran:Check the Bible verses]**,
  **[en:tran:Add a diagram]** and **[en:tran:Sum up the main points]**,
  the passage the Reader is on asked about first, as on the Resources
  card. The language offered is read off the study's OWN words
  (`toStudyLanguageSample`: its first 1 500 characters, fences and `>`
  lines left out -- a diagram or a quoted passage says nothing of the
  study's language) by the song card's rule, shared (`toTranslateTarget`
  in `lyricChatHelpers.ts`): an English study offers the window's
  language, named in its own words in a window shown in it, or _another
  language_ in a window shown in English, and the assistant asks which; a
  study in another language offers English in an English window or one
  shown in its own language, else the window's. **Check the Bible verses** is asked in its
  English in every language (`WINDOW_DONE_CARD_KEY_LIST`): the verse
  check below is read off English and two languages' own words, and a
  press shown in any other would have gone to a model unread. Any other
  Markdown file -- another Resources folder, a folder inside one -- a PDF
  and a text file keep the Resources card: they can only be read.
  Measured on the user's two studies, read only: the John 3 study
  (English, its Khmer after it) offers _another language_ in an English
  window and Khmer in a Khmer one, the Genesis 4 study (Khmer) English in
  both; ~1 ms a card. Unit-tested; not seen in the window.
- **The references a study file cites are read before a verse check**
  (2026-11-11, `EC-497`; the user's John 3 study asked _Are the cross
  references in this study file right?_). gemma4:cloud had read the
  Amplified Bible's own bracketed notes inside the quoted passage
  (`[Ezek. 36:25-27.]`) as the study's references and called them right:
  the Cross References were never read, and the study's Khmer part named
  Titus as the French Bibles do, Ezekiel as no installed Bible does and
  Numbers by the everyday word for a number. Now a verse-check ask
  (`checkIsNoteVerseCheckAsk`, which reads _cross references_ since) with a
  Markdown or text file open in the tab (`checkIsStudyCheckFile`: `.md`,
  `.markdown`, `.txt`, never one note of a notes file) and no conversation
  of its own (a note, song, slides, flow, foreground, verse find, Reader,
  lookup or general ask) has the WINDOW read first, no model round
  (`studyVerseCheckHelpers.ts`, pure; `readStudyVerseCheckText` in
  `ChatbotAppComp`): the WHOLE file (`readWholeTextFile`, 64 K letters,
  its size asked first -- an attachment's words are cut at 16 KB, and the
  study was 44 KB), every installed Bible's book names (`owa_bible_suggest
  books`), the references in the study's OWN words -- never in a quoted
  passage, a diagram or a code block; a name of a script written with
  spaces starting a word, not in lower case; a time, a ratio, `Part 2: 4`
  no reference -- and each verse from the Bible the part around it quotes
  (`owa_find_verse refs`: one Bible a call, eight a call, 24 a check).
  The ask carries each line with its references and their words, a book
  named as no installed Bible names it (listed, never guessed), a name only
  another language's Bibles give (read, and said so, with the name the
  part's own Bible gives it -- and that Bible's names beside the English
  when most differ), and how many references to a verse of a quoted
  passage were left to check against it. A study with no reference in its
  own words says that, and nothing else changes. A book named as no Bible
  names it is listed on every line it is on, eight in all (`EC-499`: listed
  once, a discussion question kept the slip its Cross References lost).
  **A book written the usual short way is read too** (2026-11-13,
  `EC-576`): `Jn 3:16`, `Phil 4:13`, `1 Kgs 19:12` and `Jas 1:5` had been
  listed as books no Bible names. The table holds each book's key and the
  short forms the resolver reads (`EC-151`'s `SHORT_BOOK_NAME_MAP`) apart
  from the names (`shortMap`, `genShortNameMap`), read only as written,
  after every name and with a capital, and a book's number in Roman
  numerals as its digit (`I Cor`, `II Tim`; `I John 4:8` had been read as
  John). A key another book's name starts with (`Jud`) is still listed,
  never guessed; `Is`, `Am`, `Ex` and `Re` are read only before a colon;
  a short form right after a number that made no book is none (`I AM
  3:14`); and a Markdown list's number at a line's start is no book's
  (`1. John 3:16` is John, as the Preview shows it). The Markdown
  Preview's verse links and the translation's book names (`EC-534`) read
  the same table. Measured offline, 150 short forms in a study's line: 74
  read before, 148 after, 0 wrong (`Hb` is two books'). Unit-tested; not
  seen in the window.
- **A change asked of the study a tab has open is drafted by its parts**
  (2026-11-11, `EC-499`; _Fix them in the study file._ after that verse
  check: gemma4:cloud drafted the WHOLE study four times with no `file` and
  no `ref`, written from the 16 KB the ask shows of a 44 KB file, each
  refused as a new study with no passage -- 128k tokens and a claim of a fix
  with no card). `runStudyDraft`, the model's drafts only: with no `file`
  and no `ref` and a `Default/*.md` study open in the tab
  (`findOpenStudyFiles` off `resources.openFiles`), a part (`section`,
  `append`) goes to the one open, and the whole study is refused with the
  call to make and the file's headings, off a `read` the window makes
  (`routeOpenStudyDraft`, `genOpenStudyDraftRefusal`, `toStudyReadShape`
  -- `STUDY_HEADINGS_LEAD` is the read note's own words). `draft` reads the
  file off the disk each call, so a second part of the same file in one ask
  is applied to the change already held and the whole drafted
  (`chainStudyPartEdit`): the parts of one ask are one card. Seen live the
  same day, in that tab: the English and Khmer Cross References drafted by
  `section` in one round, one **Save changes** card, 47.2k tokens; the
  **Preview** copy differed from the file in the fixed lines, a blank line
  under each heading and two labels the model wrote anew without reading
  the part (`EC-500`). Nothing saved.
- **A study's whole text written again, or a report of a change, is not
  drafted as it came** (2026-11-11, `EC-502`, `EC-505`; asked to fix ONE
  Khmer line past the 16 KB the ask shows, gemma4:cloud read that part and
  sent it back as `content` with `file` and no `section` -- a **Save
  changes** card removing 29 of the study's 30 parts -- and, asked again,
  drafted the English part with its own earlier answer, _I have fixed the
  cross-references in the study file …_, as the new words). `runStudyDraft`,
  the model's drafts of a change only: words whose first line claims a
  change and points at the file itself are refused with the file's
  headings (`findStudyChangeReport` -- English's words, and since
  2026-11-12 those of the language the answer is in, `EC-508` --,
  `genStudyReportRefusal`); a whole text
  that is ONE part of the file written out gets that part's `section`, and
  one losing any part of a file the ask shows in part -- or most of one
  shown whole -- is refused naming them (`routeWholeStudyRewrite`, off
  `readStudyFileShape`). Seen live once both were in: a read of the Khmer
  part, one `section` draft, the one line changed and every other line of
  the file as it was. Neither guard fired that time (the model named the
  part, and read first); both are unit-tested on the words it had sent.
- **A part of a study is changed on its own words, never from memory**
  (2026-11-11, `EC-500`; the Khmer Cross References above, past the 16 KB
  the ask shows, drafted by `section` with no read: two labels came out
  written anew). The window keeps what of each study file the model was
  shown in the ask (`ToolWatchType.shownStudyBlocks`): the attached words
  as the ask carries them (`toAskedStudyBlocks` off `readAskedTextFiles`)
  and every `read` since (`toReadStudyBlock`). A model's `draft` of a part
  none of them shows whole (`checkIsStudyPartShown`) has the window read
  that part, with no model round, and is refused with the part's words
  and the call to make again (`findUnreadStudyPartRefusal`,
  `genUnreadStudyPartRefusal`). The read is kept, so the next draft goes
  through. Not for a draft the window made, a kept answer, an `append`, a
  part too long to hand over, or a read that fails. Asked live, the model
  read first, so the window had no read to make: only the asked words of
  the part changed, its labels as written. The refusal is unit-tested.
- **A SAVED study's translation is read against the Bible it quotes
  before any question about the file** (2026-11-12, `EC-536`; the user's
  John 3 study, its Khmer half translated before `EC-535`, writes Aenon,
  Salim and the Pharisees each with another vowel sign than the Khmer
  Bible its passages quote -- a difference a model reading the file
  cannot see). The verse check's gate without its verse-check ask: a
  question with a study file open in the tab (`checkIsStudyCheckFile`)
  and no conversation of its own has the window read the file whole ONCE
  (`readWholeTextFile`), and the verse check (`readStudyVerseCheckText`)
  reads that same text. `listSavedStudyNameSlips`
  (`studyNameCheckHelpers.ts`, pure) pairs each translation under the
  study (`splitStudyTranslations`, six at most) with the English half by
  its quoted passages -- in order when both quote as many, else by their
  verses, never one from the same Bible -- and lists the words of those
  verses its own words and diagrams write with the vowel signs of one
  letter otherwise (`toStudyNameGuide` with no church words, then
  `listStudyNameSlips`), each counted (`countStudyWordPlaces`).
  `toStudyNameCheckText` rides the ask (`withResources`, after the verse
  check's text): each word, how often, how its verse writes it, and to
  say them when asked to check or correct, offer the Bible's spelling as
  an OPTION, and draft only when asked. No call, nothing kept, nothing
  said of a file with none. Measured on that study, read only: 3 of 3
  words in all 5 places, nothing else, 1 293 characters, 21-25 ms the
  first time. Unit-tested; not seen in the window.
- **And those words are written as the Bible does by an exact replace**
  (2026-11-12, `EC-537`, the tool's side in `agent-tools.md`). The check's
  rules now offer `owa_resource_file` `draft` with `file` and `replace`,
  each word as the file writes it `from` and as its verse writes it `to`
  (1 400 characters on that study), and so do `STUDY_FILE_PROMPT`, the
  open-study and whole-rewrite refusals, the claim nudge and the report
  refusal: to fix words where they stand, never the whole part written
  again. The card is the ordinary **Save changes**; nothing else of the
  file moves. Measured on the same study, read only, nothing written: the
  three words as three pairs, ONE call of 171 characters writes all 5
  places and nothing else (4 of its 365 lines changed, each given its
  `from` back the line it was, its sixth diagram changed and still
  passing the structural check), where `section` had the model write 4
  parts, 1 572 characters,
  again; 12 ms the first time, under 1 ms after. Unit-tested; not seen in
  the window, and what a model drafts with it was not measured.
- **And a pair a model could not tell apart from its verse is written as
  the right one** (2026-11-12, `EC-541`, the tool's side in
  `agent-tools.md`). Told the three words, a model still cannot see the
  vowel sign apart, so its pair came out with the verse's spelling as
  `from` (nowhere a replace writes: the passage quotes it), turned round,
  or the word given its own spelling back -- each refused, and a second
  try as blind as the first. Such a pair is now put right where the check
  names its words, in the worker and in the window's chain onto a change
  already held (whose sentence leads the `change` the model is shown,
  `toModelDraftText`'s `noteText`). Measured on the same study, read
  only, nothing written: 14 slipped calls -- each word as the verse writes
  it, turned round, as the file writes it twice, with the word before it,
  and all three words at once two ways -- 14 refused before, and after
  all 14 written exactly as the right call writes them, nothing else;
  6-13 ms each, only on a refusal; a right call 0.3 ms with nothing put
  right; a pair naming no such word refused as before. Unit-tested; not
  seen in the window.
- **And a part is taken out with `remove`** (2026-11-13, `EC-543`, the
  tool's side in `agent-tools.md`). Asked to take the prayer out of a
  long study, or to drop an old translation for a new one, a model had
  no call: a part with no words is refused, and the whole text without
  it is refused for a file the ask shows in part (`EC-502`). Now
  `section` with `remove: true` drafts the file without that part, its
  subparts with it, and `STUDY_FILE_PROMPT`, the open-study and the
  whole-rewrite refusals say so. In the window it is a part edit like the
  others (`checkIsStudyPartEdit`): it goes to the study open in the tab
  when it names no file, is never read as a whole rewrite, needs no read
  of the part first (it writes no words), is taken out of a change
  already held (`chainStudyPartEdit`, the held text drafted whole), and
  is dropped beside a kept answer, which goes in whole
  (`toKeptAnswerDraftArgs`). The card is the ordinary **Save changes**.
  Measured on the same study, read only, nothing written: 29 of its 30
  parts taken out one by one, every other part word for word (775
  compared), the title refused. Unit-tested; not seen in the window, and
  what a model drafts with it was not measured.
- **And a part's new words keep the parts it holds** (2026-11-13,
  `EC-544`, the tool's side in `agent-tools.md`). New words for what
  stands right under a heading had replaced its whole range: under the
  study's `#` title, every part of the study; a heading alone, sent to
  rename a part, its words. Words that write no heading of a part under
  their first line are now the part's own words, the parts under it kept;
  a heading alone renames; words appended to a part holding parts go at
  the end of its own words. The window's chain onto a change already
  held does the same and says which parts it kept in what the model is
  shown (`noteText`, the field EC-541's repair note rides too). Measured
  on the same study, read only: 0 parts lost
  after where 40 were lost before, for each of three edits. Unit-tested;
  not seen in the window. **Nor the passage the app quoted under a
  title** (2026-11-13, `EC-548`): the title's own words ARE that passage,
  so an introduction sent for them had taken out its 73 lines. Words that
  place no passage keep it where it stood, the chain onto a held change
  too, and `noteText` says so with the two ways to change it -- a
  reference alone on a line to quote another, `remove` with the
  passage's reference to take it out. Unit-tested; not seen in the
  window. **And a passage copied back with words changed is put back as
  quoted** (2026-11-13, `EC-549`): a quoted passage is the Bible's
  words, and the window's chain hands its whole text to the tool's
  `draft`, which puts it back against the file as saved and says so.
  Unit-tested; not seen in the window. **And a passage new to the file
  is quoted from the Bible it names, bold asked for inside a quote
  kept** (2026-11-13, `EC-565`): the chain's whole text goes through the
  same `draft`, so a model's own quote of a verse under an installed
  Bible's name is that Bible's words by the time the person saves, and
  a verse put in bold at their word stays bold. Unit-tested; not seen in
  the window. **And a verse added to a half comes from that half's
  Bible** (2026-11-13, `EC-570`): the window asks a change for no
  `bible` (only a new study gets the language asked in, through
  `findStudyVerseBible`), so a `[^ref]` in a change was read from the
  Lookup's Bible -- in the Khmer half of the user's study a KJV verse,
  in its English half a Khmer one; `draft` now reads each from the Bible
  its own half quotes. Unit-tested and measured offline; not seen in the
  window. **And words for the study's last part stay above its
  translation's rule** (2026-11-13, `EC-571`): the chain's part edit is
  the tool's own `applyStudyEdit`, which now holds a part to its half,
  so a question appended to _Questions for Discussion_ no longer lands
  between the rule and the translation's title. Unit-tested and
  measured offline; not seen in the window. **And a verse the model
  quoted its own way is the Bible's words when saved** (2026-11-13,
  `EC-575`): the chain's whole text goes through the same `draft`, so a
  `> "…" (John 3:16)` written from memory -- another translation's
  words, as a model remembers them -- comes back as the Bible of its
  half reads it, in the app's form, and words that do not read as that
  verse are left as sent and named in the `change` the model is handed
  (the window draws no `change` itself). Unit-tested and measured
  offline; not seen in the window.
- **And what else a saved translation left is read the way a new one is
  held to it** (2026-11-13, `EC-559`; the same study's Khmer half, written
  before `EC-490` and `EC-533`, still writes a letter of another script
  glued into a word, a word of a third script between two of its own,
  _and_ twice and _between_ in its sentences, and seven labels of two
  diagrams in English -- and the check handed a model its three vowel
  slips alone). `listSavedStudyTranslationChecks`
  (`studyTranslationCheckHelpers.ts`, pure; apart from
  `studyNameCheckHelpers.ts`, so the study tool's worker, which imports
  that file, never loads the language reading this one needs) reads each
  translation by the new translation's own rules: the letters of a script
  neither its own nor one the English half uses (`findStudyStrayLetterSet`,
  its own script read off its PROSE -- a diagram's syntax and labels left
  in English are Latin letters, and where they outnumbered its own, its
  own words had been called another script), the English words between
  its script's letters (`listStudyStrayWords`) and each diagram's labels
  left (`listStudyDiagramLeftLabels`, against the English half's diagram
  at its place). Each is named as the words a `replace` writes over -- a
  letter of another unspaced script glued alone is such a word now
  (`agent-tools.md`) -- with how often, the heading of the part it first
  stands in and, for another script, the letters round it, cut where a
  cluster ends. `toStudyNameCheckText` gives each kind under a lead of
  its own beside the vowel slips, and its rules name the fix: `replace`
  with `section` the translation's title, which keeps the English half as
  it is, and with five or more, `translate` with `place` `append` again.
  Measured on that study, read only: 3 of its 14 known slips (the
  Jordan's other letters aside) reached the model before, 14 of 14 after,
  in 2 672 characters; one replace of 14 pairs with that `section`
  changed its translation's lines alone; ~12 ms warm. Unit-tested; not
  seen in the window.
- **And a name it writes with other letters than its verse is named**
  (2026-11-13, `EC-560`; the same study writes the Jordan with a letter
  fewer and other signs than verse 26, which `EC-535` only ever showed).
  A verse's words are not all names, so the name is read off the words
  standing for it: each bold span of the English half naming a name the
  passages give (`listStudyPassageNames`), and the translation's bold
  span in its place -- the parts of words paired in their order, their
  spans too when both bold as many, else line by line (`pairBoldSpans`).
  The words that may write the name are those of three letters or more in
  its verses and in few others (`listStudyNameWords`); where the span
  writes none of them, as it is, without its points or with another vowel
  sign (`EC-536`'s), the place of its letters coming closest to one is
  named -- 0.75 alike at least, letters in order, signs aside, no word of
  the verses quoted, one a `replace` takes (`listStudyNameOtherLetters`).
  A whole line in place of a span was tried and matched the land of Judea
  to a word for _after_: spans only. Its own lead in
  `toStudyNameCheckText`, the English name first, with the verse's word,
  and a model told that a verse's word that is not the name means the
  name is left. Measured on that study, read only: the Jordan named and
  nothing else; its replace with the translation's title changed one line;
  every reordering of its four bold lists (12) named nothing wrong; ~12 ms
  warm for the whole check. Unit-tested; not seen in the window. **The
  place is whole words** (`EC-561`, which names such a name in a new
  translation's retry): reordering the spans across the lists put a
  piece of _share_ and of _born_ against a word of "Light"'s verses, so a
  place no word break starts and ends is never named, and one that is
  only part of its span's words must come 0.8 close; the Jordan, all of
  its span, is still named, ~12 ms warm.
- **And a heading or a church word it writes otherwise than its
  language's Bible is named** (2026-11-13, `EC-596`; the same study's
  Khmer half heads its Cross References "ខសសាលយោង", where the Khmer
  package writes "ខគម្ពីរយោង", and writes _Son of Man_ and _bronze
  serpent_ otherwise than its Bible -- the check had named letters and
  labels, never a church word). The window's check is
  `readSavedStudyTranslationChecks` now (`studyTranslationCheckHelpers.ts`;
  `listSavedStudyTranslationChecks`, which reads no language, is kept):
  each translation's language is read off its own words
  (`readStudyPartsLanguage`, the typed-language reader over its first
  2 000 characters), and each language so read is loaded once a question
  (`loadStudyCheckLanguage` in `ChatbotAppComp`: its `churchWords.json`,
  3.5 KB at most, never cached, and `EC-488`'s four labels from the
  window's own `tranLabel` when it is the window's language, else only
  what is in memory already -- a 726 KB `tran.json` is never read for a
  question; a load that fails leaves the other lists as they were). A
  translation is judged only when it writes at least half of the church
  words the English half uses, two at least (`checkIsStudyTermLanguage`):
  a language not installed, read as a near one, would have had every word
  called missing. Two lists more, each under a lead of its own in
  `toStudyNameCheckText`: a heading of the English half that IS a church
  word, whose place in the translation heads it otherwise
  (`listStudyHeadingTermSlips`: the headings paired in order when both
  hold as many, bold, a colon and _The_ aside), with the word its
  language writes; and a church word of more than one word the English
  half uses that the translation never writes (`listMissingStudyTerms`,
  eight at most, none a heading already named), with up to three of the
  translation's lines where the English half uses it -- parts and lines
  paired in order when as many, each cut to 160 letters round the place
  at a cluster's edge (`findTermLines`) -- since a church word said
  another way may be right: the model is told to say how its lines say
  it and offer its Bible's word. A church word written with a space, a
  hyphen or a line's break between its words counts as written
  (`TERM_JOIN_PATTERN`), in the translate job's check too: _John the
  Baptist_, hyphenated in the Khmer list and spaced in the study, had
  been called missing. Measured on that study, read only: the heading and
  the two words named, nothing else; one `replace` with the translation's
  title wrote the heading in its one line, and the check then named none;
  14-20 ms warm against 13 without the languages, 67 ms the first time;
  the Genesis 4 study (no English half) nothing, in 0.1 ms. Unit-tested;
  not seen in the window.
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
  (a PowerPoint, Word or PDF row's opens it under the Resources card
  instead: its words to ask about or make a song of) and the Slide Editor
  footer's robot
  (`SlideEditorChatbotButtonComp`) hand it over through
  `openDocumentInChatbot` (`lyricChatbotMenuHelpers.ts`, the song's names
  kept as aliases), and the window opens it under a card written with no
  model (`genSlideOpeningAnswer`): the song card's two translate buttons,
  **[en:tran:Check the spelling]**, **[en:tran:Make the words larger]**,
  **[en:tran:Make slides like a picture]** and, since `EC-590`,
  **[en:tran:Make a song from it]** (drafted by the window, above). A
  question while it is open is a
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

- **A NEW running order or slide document asked for in an ordinary tab is
  MADE by the window, and the question becomes its conversation**
  (2026-11-12, `EC-514`, closing `EC-468` by its way (c); the user's goal:
  _chatbot will be very smart to help user create presenter documents,
  background resoures, presenting flow, bible item_). Auto's shared server
  has no tool that makes a file, and every such ask had been answered with
  how to make one by hand. `readDocumentCreateAsk`
  (`documentCreateHelpers.ts`, pure, English words; every other language's
  through its own, `EC-516` below) reads a
  request verb, a running-order or slide-document noun, a name or a day, and
  whether anything is to go in it; a how-to, a change to what exists, a
  supported question asked as it stands, a `/` command, a retry, a tab on a
  study, a lookup or `/btw`, and an ask already carrying a document of
  either kind are left alone, and with a document of that kind OPEN only a
  NEW one is made. `handleAsking` lists the folder, picks a free name
  (`pickFreeDocumentName`: _Sunday (2)_; the default _Presenting Flow
  2026-11-12_ / _Slides 2026-11-12_) and calls `owa_presenting_flow create`
  or `owa_slide_file create` (empty: `{"items":[]}`). **Nothing to put in
  it**: the window answers alone -- _I made "…" for you. It is in {list}
  now._, **[en:tran:Undo this change]** -- then `attachHandedFileRef` opens
  the file's own card with the file in the box, as a row's **Open in
  Chatbot** does. **Something to put in it**: the file is attached to the
  question (`genAttachmentFromPath`), so it IS that file's `flow` / `slide`
  ask, with `genDocumentCreateHint` said to the model on the ask alone (made
  already, build it in ONE call, never make another; a verse through
  `owa_find_verse`), the made line as the answer's `note`. The making's undo
  id is folded FIRST into the answer's Undo (`withCreatedUndoAction`:
  `madeId`, `madePath`), so one press takes what was put in and the file
  away, and the handler drops the file's chip from the box and closes the
  tab's open files when it was the only one (`fileClosedAt`), saying _"…" is
  taken away again: the change that made it is undone._
- **Passages saved to a Bibles list, or a new list, are done with no model**
  (2026-11-12, `EC-515`). `readBibleListAsk` (`bibleListAskHelpers.ts`,
  pure): every part a reference (a book, a chapter, a verse or range, split
  on commas, _and_, `;`) or the line is the assistant's; _my Bible list_ /
  _my Bibles_ is Default, _the Wedding list_ / _the list called "…"_ a named
  one, _a new Bible list called …_ / _a verse list for Easter_ a new one
  (default _Verses 2026-11-12_). `owa_bible_item` reads each reference with
  every installed Bible's book names (`page: reader.html` asked from the
  Reader, which keeps its own list); a named list that is not there is made,
  a NEW list never takes an old one's name. The answer names what was saved
  as the Bible writes it, a reference no installed Bible reads, and one
  **[en:tran:Undo this change]** for all of it (`genMadeUndoAction` in
  `documentCreateHelpers.ts`, the list made going back last). A passage the
  list holds ALREADY is taken back at once (`owa_undo` on its own add) and
  said -- _… is in your Bibles list already, so it is not saved twice._ --
  because the Bibles panel flags a repeat _Duplicated with item number 2_
  (`readBibleListTitles`, `checkIsSavedAlready`: the titles compared with
  case and spacing let go). The corpus's fill-in row _Save John 3:16 to my
  Bibles list_ is let through (`checkIsBibleListRowFree`: its own tool is
  `owa_bible_item`); every other supported question stays the guide's.
  **A list typed or pasted MESSILY, or passages inside a paragraph, are
  read too, and what is unclear is ASKED** (2026-11-14, `EC-626`, the
  user's story: _sometime I carry a list of bible verses … parse a messy
  bible verse … extract from a given paragraph, if ambigous bible verse
  then have to follow up to ask for user input_). Before the old reader,
  `readBibleListPaste` (`bibleListPasteHelpers.ts`, pure; asked only when
  `checkMayBeBibleListPaste` says the line may hold one, the books table
  read once through `owa_bible_suggest books`) takes a request and the
  passages around it line by line: a version written before or after a
  passage (`(kjv)`, a Bible's own key in brackets) rides with it, any
  installed Bible's book names and digits are read, a continuation
  (_John 3:16, 17_), a numbered or bulleted list, a verse's words after its
  reference, and a paragraph whose times, counts and prices are no
  passage. A weak request (_add …_ naming no list, `isListNamed` false) is
  taken only on the Presenter or the Reader with no document, note or file
  open or attached; a how-to never. Saving is `bibleListSaveHelpers.ts`:
  each passage added with its version, a duplicate taken back as before,
  and what it cannot settle becomes a PICK -- an open range (_GEN 1:2-_:
  the chapter is checked for its last verse, since `owa_present_bible
  check` reads no open range, then offered as **Genesis 1:2-31** /
  **Genesis 1:2**), a short name two books share (_Ph_), and a version not
  installed, read off `owa_bible_item`'s refusal (`readVersionRefusal`:
  the refusal has a sentence between the two it is read by), one button an
  installed Bible. A pick is its own message after the answer's lines, one
  `isData` button a choice and **[en:tran:Skip]**, the pseudo tool
  `owa-bible-list-pick` (`BIBLE_LIST_PICK_TOOL_NAME`, caught in
  `handleActing`, registered nowhere; its args validated by
  `toValidBibleListPickArgs` and carrying the picks still to ask, at most
  20). A press saves that passage with its own
  **[en:tran:Undo this change]** and asks the next. Past
  `MAX_PASTE_PASSAGE_COUNT` (20) the first are saved and the rest named.
  Seen live in English and with the app in Khmer.
  **The Bibles panel's [en:tran:Add Bible Item] opens a chat ready for
  such a text** (2026-11-14, `EC-760`, the user with the button circled:
  _`Open in Chatbot` should open the chatbot and put pretext prompt to let
  user continue editing by pasting more bible paragraph_). With AI on, the
  button opens a menu under itself, **[en:tran:Bible Lookup]** /
  **[en:tran:Open in Chatbot]** (`genAddBibleItemContextMenu`, a leaf that
  imports the opener only at the press). With AI off, it opens the lookup
  as before. The second row is the sixth handoff kind
  (`chatbotHandoffStoreHelpers.ts`, `chatbot-handoff-bible-list`, 30 s,
  after the switch and the caution, `openChatbotForBibleListPaste`).
  `takeHandoff` opens a new tab with `BIBLE_LIST_PASTE_LEAD` in the box,
  translated, the caret under it. The route swaps the translated line
  back to the English one (`toEnglishBibleListPasteLead`) before any
  Bibles-list reader runs, so the line reads as a save to Default
  (`isListNamed`) in every language. Any words already in the box are
  kept under the line. The line with no passage under it is answered by
  the window, and the line is put back in the box. A text under it is
  never a document to make (`documentCreateAsk`). The same day a chapter
  with no verse is read before words (`WORDS_AFTER_CHAPTER_PATTERN`:
  _read Psalm 23 together_ had been skipped). This needs a capitalised
  book name, and never a book named by an everyday word
  (`EVERYDAY_NAME_BOOK_KEY_SET`).
- **A background WEB PAGE asked for in words is written by the model and
  saved by the window** (2026-11-12, `EC-518`; `webBackgroundAskHelpers.ts`).
  `readWebBackgroundAsk` takes a request verb with a web-page background
  noun right after it (_make a background web page with …_, _a web
  background called Calm Sea showing slow waves_), a name and what it is to
  show; a how-to, a picture, a video and a change to a page are not it.
  Before the ask the Webs folder is listed for a free name (`owa_media_file
  list`, default _Background 2026-11-12_), and `genWebBackgroundHint` rides
  the ask alone: ONE complete HTML document in an `html` block, HTML and CSS
  only, nothing loaded, filling the screen, motion ONLY by `transform` or
  `opacity` (the first page a model wrote animated `background-position`
  for ever, a repaint every frame on a projector computer -- CLAUDE.md's
  rule), call no tool. The model is given NO media tool -- `owa_media_file`
  stays withheld (`modelTools.mjs`, MC-56). When the answer comes,
  `readHtmlBlock` takes the block out (60 000 characters at most, a page
  tag in it) and `toSafeWebPage` rebuilds it through DOMPurify: no script,
  frame, form, picture or media tag, no `on…` handler, no `src` / `href` /
  `srcset` / `action` and the like, every CSS `url()` but a `data:` one and
  every `@import` made `none`, a `<title>` that cannot break out, and a base
  style that fills the window. The window writes it (`owa_media_file create`,
  kind `web`), answers with the model's own sentence and _I made "…" for
  you. It is in Webs now._, and puts **[en:tran:Undo this change]** first.
  Seen live 2026-11-12 on a scratch profile: two pages made, both thumbnails
  in **[en:tran:Background]** → **[en:tran:Webs]**.
- **A background video or a track from a LINK is the person's press, with
  the link copied for it** (2026-11-12, `EC-518`;
  `backgroundLinkAskHelpers.ts`). `readBackgroundLinkAsk` takes ONE http(s)
  link and a request (_add this video as a background: …_, _get the MP3 of
  …_); a how-to, a page to read, a song's WORDS from a page (the song
  drafter's) and two links are not it. The download fetches into the
  person's folders and, the first time, installs the download tools behind
  a box of its own (W-21), so the window presses nothing: it copies the link
  (`navigator.clipboard.writeText` -- the **[en:tran:Download From URL]**
  box fills itself from the clipboard, `askForURL`), says in one sentence
  where to press in **[en:tran:Background]** → **[en:tran:Videos]** or
  **[en:tran:Audios]**, and offers W-21's **Show me step by step**
  (`find: Download From URL`). A clipboard that refuses is said, the link
  written out to copy by hand. No model.
- **The same four asks in ANY language a person types** (2026-11-12,
  `EC-516`; the user: _do EC-516_). The readers above know English words,
  so a Spanish or Khmer request had gone on to a model and been answered
  with how to do it by hand. Each language now says such a request in its
  own words, as DATA: `createAsks` in its `typed.json` (`assistant.json`
  for a language that has one), twenty word lists
  (`CREATE_ASK_WORD_GROUP_LIST`) -- the request forms of make, save and
  fetch with the language's _I want_, _give me_ and _get me_; _new_; the
  nouns (running order, slide document, list, Bibles list, web page,
  background, video, track, a song's words); the name markers before and
  after a name and `nameStop`, where an unquoted name ends; `days` and
  `filler`, which put nothing in the file; and `howTo` / `done`, which make
  the line no ask (_how do I …_, _yesterday I made …_). An entry is a word,
  a stem (`word*`), a compound's end (`*word`), a word inside a compound
  (`*word*`), or parts joined by an ellipsis, up to three words between
  (eight letters in a script without spaces), where an adjective splits a
  noun. `readCreateAskInOwnLanguage` (`typedCreateAskHelpers.ts`, pure)
  runs only after the English reader found nothing and never on a line
  read as English; it tries the typed language, the app's, then every
  installed one and keeps the reading whose words cover the most of the
  line -- a neighbour's `howTo` or `done` blocks it only beside that
  neighbour's own request word (one language's _how_ is another's
  ordinary syllable). The reading goes down the SAME routes as the English
  one (`toTypedDocumentCreateAsk`, `toTypedBibleListAsk`,
  `toTypedWebBackgroundAsk`, `toTypedBackgroundLinkAsk`), so the file, the
  list, the page and the copied link are what an English ask makes. A name
  is cut from the line as typed -- apostrophes, the okina and a mark
  between two letters kept -- and ends at a request word, so a verb that
  closes the sentence is not part of it. A line's references, in the
  language's own book names and digits, are read by `owa_bible_item` as
  before. Held by `src/lang/data/tests/chatbot/typedCreateAsks.test.ts`
  over 88 languages' samples written BLIND (by readers never shown the
  words): each ask in an English app and in its own, four lines that ask
  for nothing read as none, no English corpus question read as an ask in
  any language's app, and no question of a language's own corpus in its
  own; a check no word list can mend is a `knownMiss` with its reason (one:
  a Zulu line in an English app is named English on a word the two share).
  **A HELD-OUT set says what that is worth**
  (`typedCreateAsksHeldOut.json`, same test): 88 languages written blind
  by other readers after the words were made, scored as they came -- 837
  of 1 056 checks in an English app; of 704 asks, 488 wholly right and
  574 down the right route (the 86 between made with a detail off -- an
  EMPTY running order for an occasion read as one to fill, a name cut
  short), the other 130 left to a model as before; and 698 of 704 lines
  that ask for nothing read as none. Those three lines were mended -- the language a
  line is typed in now stops it by its own question or past words beside
  any word of its own for a thing to make (a Nepali _I made a Bible list
  last week_ had been read by a neighbour of the same script), never by
  the question words alone (a Maori line is named Shona, whose _why_ is
  the Maori _this_) -- and nothing else was tuned on it; each language
  keeps at least what it scored (`floor`), and a word added for one of
  its lines spends the set. Seen live on a scratch profile: a Spanish running order, a Khmer save
  with Khmer digits, a new named Khmer list, a Spanish named slide
  document and a Spanish web page, none but the page needing a model.
  **Under such an answer no corpus question is offered unless the corpus
  is in that language** (`checkIsCorpusLanguage` in `questionHelpers.ts`:
  English, or the app's own language with its questions installed) -- a
  Spanish line ranked against English rows had drawn the Reader's demo
  questions under the page it made.

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
  it -- through a reload of the help window too since 2026-11-11 (BN-19,
  `EC-498`: the box's files are kept with the tab, above).

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
  again** keeps it (`toReusableAttachments`). **An answer that put a
  session up or changed it HOLDS it** (2026-11-12, `EC-520`):
  `readHeldForeground` reads the tool's result (`started`, `shown`,
  `changed`, `created`, `timer`) into `LlmBotAnswerType.heldForeground`,
  drawn as that session's chip on the ANSWER (never one already attached),
  and `findOpenForegroundAttachments` reads answers' chips too, newest
  first, back to the last question that carried its own. So _Make it bigger
  and red_ typed under _Start a 5 minute countdown_ is that countdown's
  foreground ask; before, a follow-up naming no component went to the guide
  (steps to open the panel) or started another one. A question with one open is a
  `foreground` ask (`chatbot-llm.md`).
