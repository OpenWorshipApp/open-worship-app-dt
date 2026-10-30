---
paths:
  - 'src/chatbot/bibleImportChatHelpers.ts'
  - 'src/chatbot/waitingInputHelpers.ts'
  - 'src/chatbot/chatLinkHelpers.ts'
  - 'src/helper/ai/bibleImportAskHelpers.ts'
  - 'src/helper/ai/chatbotHandoffStoreHelpers.ts'
  - 'src/setting/bible-setting/bibleImportRequestHelpers.ts'
  - 'src/bible-lookup/RenderLookupSuggestionComp.tsx'
---

# Chatbot window: waiting questions and the Bible import

Part of the 🤖 help window's notes, split out of `chatbot-window.md` on
2026-10-29 (`AD-22`) so that reading these files loads this part alone. The
window as a whole — tabs, pickers, its language, the caution — is in
`chatbot-window.md`; providers and the model's tools in `chatbot-llm.md`.

- **Waiting questions accept ordinary words** (2026-10-18, EC-354).
  EC-355: the interpreter also receives the originating tab's recent visible
  conversation, current step, Bible title/summary, short name, selected
  language, digits and source. Current settings override historical answers
  and file detection; selected language means the imported Bible, never the
  interface. Ordinary chat gets the same current-task hint, while history
  retains message notes and choice labels. Context is bounded and contains no
  raw action arguments, draft paths or full Bible. Exact native language names
  resolve locally; a correction at numbers/names/review reloads that language
  and clears stale numbers/name selections. At book-name selection, a bare
  URL runs `names-url` against the supplied site; a sentence around one supplied
  URL uses the interpreter's `acceptsLink` context. Both retain the draft and
  selected locale. Multiple proposed URLs need clarification. Source results
  lead the choices and carry clickable links;
  failures retain the prior options. An older host that ignores `url` cannot
  pass off its catalog as the requested source (`requestedUrl` must match).
  Language correction is also allowed at choice steps, but that extra value
  kind must not make short unknown replies fall through to normal chat: without
  an `awaits` field, interpret every unmatched reply. Digit-format choices also
  accept their positions locally (`១` selects the first), observed after the
  restarted host exposed a fallthrough that invented a ready-to-install answer.
  Exact choices, including Khmer/Thai/fullwidth digits and punctuation, run
  locally first. Bible import, the verse finder's Bible chooser and lookup's
  **Open another passage** share `waitingInputHelpers.ts`: one bounded
  JSON interpretation, no tools. Only original choice IDs or validated values
  can continue the existing step; a help/ambiguous/invalid reply keeps the
  question and buttons. An unrelated task goes through the normal router
  with one user echo. Model output never supplies tool arguments or presses
  agreement, install, undo, settings or source buttons.
  Language values use the import tool's `normalizeBibleLocale`, accepting
  **Thai** as well as **th**; an explicit override beats detection. A restart
  after a language change reloads that language's digits and book names.
  Passage values require a whole valid book/chapter reference, and relative
  replies use the last displayed passage. `askWaitingInput` respects the
  tab's selected provider/model; Auto resolves a no-cost assistant without
  changing the tab's selection. Usage and progress are recorded. Stop retains
  the waiting question and actions, and late responses cannot advance it.
  Async work stays with the originating tab, including a resumed verse search.
  Tests: `waitingInputHelpers.test.ts`, import/verse helpers and the LLM
  boundary; live evidence: `test-results/bible-import-input/`.

- **A Bible is installed IN the chat, one question at a time, by buttons and
  with no model** (2026-10-06, `src/chatbot/bibleImportChatHelpers.ts`; asked
  for _for old and non-technical users_ — it used to open Settings with the
  link typed in, leaving four fields nobody had heard of). Four ways in (the
  fourth, a missing Bible's own card, at the end of this note), the typed two
  caught in `handleAsking` ahead of any provider, like a `/` command: a
  message with a Bible word and ONE link (`readBibleImportLinkAsk` — a file, a
  GitHub file page, a repository); a Bible word with NO link
  (`readBibleImportLanguageAsk`: _Import bible for khmer_ searches the Beblia
  collection, _Import bible_ / _Can you install a Bible for me?_ asks the
  language, _…from my computer_ opens the Settings form; a how/what/where
  question is left to the guide); and Settings → Bible's
  **[en:tran:Let the assistant import a Bible for me]**, which leaves the request
  through `chatbotHandoffStoreHelpers.ts` (one setting, taken once, 30 s) after
  the 🤖's own two questions, and the window starts it in a NEW tab when it opens
  or comes to the front. Every answer is one step — the language, every file in
  it with the title its own file gives, then a short name, the language, the
  digits, the book names (ranked by how many of their names the verses use,
  each with the names only it has), **Install it**, **Undo** — and every button
  is `BIBLE_IMPORT_STEP_TOOL_NAME`, a pseudo tool no model can press, carrying
  the WHOLE state in its args, so the window keeps nothing and an old button
  restarts its own step. A typed word answers the step in front of the person
  (`readBibleImportTypedReply`: their own short name, a language by name, a word
  that narrows a list — added to the earlier search, "2019" after "Khmer"), read
  off the LAST answer only, and a NEW request beats it. A tool's words never
  reach the person: a `problem` code is worded here with how to find the right
  link. A model that downloads a Bible itself gets the same buttons under its
  answer (`watch.bibleImportCheck` in `llmBotHelpers.ts`). The Settings-form
  prefill (`bibleImportRequestHelpers.ts`) is what **Do it in Settings instead**
  and **A file on this computer** use.
  **The KJV Open Worship provides comes first** (2026-10-19, the user's asks:
  _during chatbot bible importing, the chatbot has to check for KJV first …_
  and _if user try to import English KJV then … tell user should allow create
  from the provided one_). `owa_bible_xml` gained `create-kjv`, and `check`
  now carries `hasKjv` — read by the server from the same installed list it
  already reads for `installedAs`, so it costs no extra call. Before any
  import, `runBibleImportStep` checks: a request that NAMES the KJV is
  answered before anything is downloaded, and a `check`/`language`/
  `local-file` entry with no KJV shows the offer. **Create the provided
  KJV** calls the app's own `bibleDataReader.initKJVBible()` (the Settings
  button's function, the 4.8 MB JSON loaded only at that press); a tool host
  that cannot answer fails OPEN, never blocking an import. Declining still
  allows the import — the original buttons remain, re-marked
  `kjvChecked: true` so a page cannot loop — and an external English KJV is
  steered to the provided one with **Use the internet copy anyway** left as
  the explicit override (NKJV is a different Bible and is not steered).
  After creation the original import starts over from its first step; a
  request that was ITSELF the KJV finishes, cancelling no draft, and says the
  Reader's card goes away. A model's own `check` gets the same offer under
  its answer (`genBibleImportUnderAnswer`), and the model may not call
  `create-kjv` (`runMcpToolCall`).
  **A finished import offers another one, in the same conversation**
  (2026-10-19, the user with a picture of the answer after installing `JC`
  and the space under its button circled: _after complete bible importing
  then it should have an option to add another bible. So user still can more
  bible in the same session_). The _Done — {key} is installed_ answer carries
  **Add another Bible** beside **Undo**, and so does the answer that
  finishes the provided KJV (`toAddAnotherBibleAction`); the press starts a
  fresh import at the language question, carrying nothing of the one just
  installed (no draft, no short name, no wanted key), and goes through the
  KJV-first check like any other import. The label is stored in English and
  drawn with `tranBibleImportLabel`; `chatTranLabels.test.ts` holds its
  Khmer and French. Seen live 2026-10-19 on the dev chatbot in Khmer: an
  English ASV import answered with the two buttons, the new one reading
  **បន្ថែមព្រះគម្ពីរមួយទៀត**, pressed to the language question, then
  **ត្រឡប់ក្រោយ** returning the test Bible to the trash.
  **The short-name step's options are the BIBLE's language's own keys, named
  on hover, with the installed ones left out** (2026-10-19, the user with the
  key row circled: _during choosing bible key, use `getBibleKeyNameMap()` then
  show the keys are options. mouse hover to name of bible key in dom title_,
  _exclude if the key already exist_, with
  `src/lang/data/km/bibleKeyMap.json` open: _for khmer it should show from
  this json file_, then _the list of bible keys show for the selected language
  only_, _if no language data … then show normal guessing_, _e.g. for Thai
  should show the guessing language_, and with a French import circled _it
  should show list from fr lang data_). `genKeyCandidates` takes its options
  from `getChatBibleKeyList(locale)` -- the `bibleKeyMap` of the language the
  downloaded Bible is IN (`state.locale`, else the first DETECTED locale):
  `km-KH` gives `ពគប`, `គខប`, `គកស១៦`, `អគត`, `GKHB`, `KCB`, `en-US` the
  English seven, `fr-FR` `LSG` -- never the invented names a downloaded file
  carries (`KM2023`, `KHMER2019` …). The three JSON maps are read directly in
  `chatTranHelpers` rather than through a language pack: the import's language
  is often not the window's, and loading a whole pack (dictionary, fonts,
  lookup data) for one small map would cost a low-spec machine its memory. **A
  language the app holds no names for -- Thai today -- keeps the file's own
  suggestions**, and so does a language whose every name is installed: normal
  guessing is better than a list that cannot be pressed. The one the file's
  TITLE names comes first (`findChatBibleKeyByName`, matched in that same
  language: a whole phrase, longest name first, never under five characters,
  so `New King James Version` is not read as the KJV and a title that is just
  `Khmer` claims nothing), then the rest as the language lists them. **A key
  this computer already has is left out** (`checkIsTakenKey`, the same test a
  typed name gets), because its press could only answer "you already have a
  Bible called …". Each button carries its full name as the DOM `title`
  (`getChatBibleKeyName`, drawn by `ChatbotAppComp` from
  `BotActionType.title`), so hovering explains `GKHB` without widening the
  button. Seen live 2026-10-19 on the dev chatbot in Khmer, `ពគប` installed:
  the Khmer 2023 file's step 1 offered **GKHB (ណែនាំ)** / **គខប** /
  **គកស១៦** / **អគត** -- `ពគប` absent -- the accessibility `description`
  (the hover name) reading **ព្រះគម្ពីរខ្មែរសាកល**, **ព្រះគម្ពីរភាសាខ្មែរ
  បច្ចុប្បន្ន ២០០៥**, **ព្រះគម្ពីរបរិសុទ្ធកែសម្រួល ២០១៦** and
  **អាល់គីតាប**.
  **What counts as asking for one was re-read against the live window**
  (2026-10-10, the user's ask with the three Bible rows of the suggestion list
  circled: _importing bible data is the most important thing right now … make
  this prompt and mcp tool and action working smoothly_). A custom server's
  model is sent the lean tool list, which has no `owa_bible_xml`, so for a
  local model THIS reader is the whole feature. Measured first: _Import a
  Bible in Cambodia_ found nothing; _add bible verse John 3:16 to my bible
  list_ was taken for an import and offered the Chewa, Polish and Turkmen
  Bibles of 2016; five of the seven Khmer Bibles listed were installed and
  nothing said so; a typed `2` drew the same list again; and _How do I import
  a Bible XML file?_ took a local model 31 s to list the Settings form with no
  way to have it done. Now `readBibleImportLanguageAsk` has two strengths of
  verb — `import|install|download` ask by themselves; `add|get|load|want|need|
  give` and _do you have / is there / are there_ only beside a language the
  collection has (`checkIsBibleLanguageWord`) or with nothing else said —
  and `OTHER_TOPIC_PATTERN` (a verse, a list, a note, the screen, the reader,
  a `3:16`) hands the sentence to the guide whatever its verb; `put` and `use`
  count only beside a link. A typed reply is the PRESS (`findTypedPress`: the
  words on a button, the number of a choice, `yes` for the suggested one or
  **Install it**, `cancel`) — before it `yes` at step 1 named the Bible
  "yes" — and a link pasted alone answers the two answers that ask for one
  (`awaits: 'find'` / `'link'`; the dead-link answer's Cancel carries the
  second). An installed Bible is marked in the list and said before step 1
  (`installedAs`, by TITLE; a retitled edition is not claimed), a word no file
  has is answered with **Did you mean** buttons (`suggestions`), and
  `genGuideActions` puts **Import a Bible for me** first on any answer whose
  page is `BIBLE_IMPORT_MANUAL_ID` (W-34) — the how-to is still TOLD from the
  guide, and the button is the guide's own "easy way".
  **A Bible that is MISSING offers a Bible in the WINDOW'S language** (the
  user's ask of 2026-10-13 with a picture of the Reader on _Bible key "KJV"
  is not available!_: _should have instruction for user to import in
  chatbot and should have button to open chatbot to import the bible like
  kjv_; changed 2026-10-19: _click the button should call to import bible
  for current language_). `BibleNotAvailableComp`
  (`src/bible-lookup/RenderLookupSuggestionComp.tsx`) says how in three
  steps and carries **[en:tran:Let the assistant import a Bible for me]**
  — the fourth way in, through the same handoff and the 🤖's own two
  questions. What it leaves is a sentence a person could type,
  `Import bible for Khmer`, written and read by ONE leaf
  (`src/helper/ai/bibleImportAskHelpers.ts`, no imports: the card must not
  pull the import conversation into the Reader), so the two cannot drift.
  The language is the app's own locale, named in English for the
  collection; the missing KEY is no longer asked for, because a person who
  reads Khmer needs a Khmer Bible, not the English key that happened to be
  selected. The import's own KJV-first offer comes before it (below), so a
  new computer still gets the provided KJV in the same conversation.
  **A Bible asked for BY NAME still works**: `readBibleImportLanguageAsk`
  decides whether it is a request off the sentence WITHOUT the name (a Bible
  called LIST is no list), searches the collection for the name (`kjv` alone
  is the English one; a name with nothing to search by asks the language)
  and keeps it as `wantedKey` on the state. `carry` takes it through every
  step by itself; the buttons that write a state afresh hand it on
  (`keepWanted`: the language question's, a dead link's two, a link pasted
  alone). At the download it is the FIRST short name offered
  (`genKeyChoices`), with one sentence saying why — a Bible installed under
  any other name leaves that card exactly where it was — unless it is
  taken, cannot be a short name, or the Bible is already installed under
  another name (that one is found by choosing ITS name on the card, and the
  two sentences would say opposite things). Installed, the card goes away by itself: the import ends in
  `clearBibleXMLCache`, which tells every window, and `useSelectedBibleKey`
  asks again. **The button's text is its name and nothing more** — drawn as
  `… for me (KJV)` it could be found and not pressed, because a press by
  label wants a label part EQUAL to the words (`isPressSafe`); the heading
  above it says which Bible. Seen live on a scratch dev instance, twice
  (once by the user's own hand): _English KJV_ and _English NKJ 1982_
  listed, **KJV (suggested)** ahead of the file's own EK / ENGLISHKJ /
  ENGLISH, the Reader on Genesis 1:1 with no reload; `…called "KHOV"` typed
  — _None of them has “khov” in its name_ — and `Khmer` under it listing
  seven Bibles with the name still on every button.
  **A downloaded Bible is AGREED TO before it is asked about** (2026-10-16,
  the user's ask over the list of seven Khmer Bibles: _ask for user consent
  first, tell user it is randomly found on internet, show user where is from,
  tell user it's not provided by openworship, let user know that they hey to
  responsible for bible publisher. when user agree then keep going_; CB-145).
  `genBibleImportCheckAnswer` answers a download with `genSourceNoticeStep`,
  not step 1: what it is, then **Where it is from** (the collection's page for
  any Beblia file however it is linked — `checkIsCatalogLink` — else the page
  the file was picked from, carried as `sourcePage` on every file button, else
  _the internet, at the address below_), **The file** (the tool's `source`),
  **It is not from Open Worship** and **You are responsible to its
  publisher**, with **I agree** (step `agree` → `genAgreedStep`, which says
  what step 1 needs beside it: a second copy, the wanted name), **Open the
  website** (step `source`, the page in the system browser — only an http(s)
  `sourcePage`, `appProvider` imported at the press) and **Cancel**, which
  deletes the draft. Typed `yes`, `ok`, `agree`, `I agree` press **I agree**.
  The download happens BEFORE the notice, on purpose: one place every way in
  passes (a link, the collection, a model's own `check`), and it is the
  file's own title and address the person agrees to; a decline deletes it.
  A model's download carries the same buttons and, from
  `genBibleImportUnderAnswer`, the notice appended to its words, and a
  model's `owa_bible_xml` **`import` is refused in `runMcpToolCall`**
  (`BIBLE_IMPORT_MODEL_REFUSAL`): the person's press is the agreement, so no
  model may stand in for it. The stdio door is the developer's and unchanged.
  **Its two addresses are LINKS** (same day, the user with a picture of them:
  _make links clickable, open in browser_). An answer carries `links`
  (`BotAnswerType` → `ChatMessageType`, persisted): the addresses the APP
  wrote into it, and a `code` span whose words are one of them is drawn by
  `RenderChatLinkComp` — a button, not an `<a href>`, which followed would
  replace this window — pressed open in the browser through
  `openExternalURL`. Only the app's own: a model's words can carry what a
  page it read told it to say, so its addresses stay words, the provider
  pages' rule above. `chatLinkHelpers.ts` (no imports) is the one check —
  http(s), no user name or password, 600 characters, four a message — read
  by the Bible import, by `toValidLinksField` on load (a hand-edited file
  cannot make anything else a link, and a question carries none) and again
  at the press. The model's answer gets the notice's links with the notice.
