# OWA User Workflows — the tutorial source of truth

Canonical, **user-facing** task recipes for Open Worship App. Each workflow is written
in tutorial voice ("Click **X**, you should see **Y**") so it can be converted 1:1 into
a help page, and each is **traceable** (`Verify:` line) to
[coverage-matrix.md](../../../../docs/test-paths/coverage-matrix.md) row IDs so a robot run can prove every step
still matches the live app.

**Contract for this file:**

1. **Truth follows the live app**, not memory. If a robot run observes different
   behavior, either it's an app bug (→ file a Finding) or this file has drifted
   (→ update the workflow in the same run and note it in the report).
2. Workflow IDs (`W-01`…) are **stable** — tutorials, help pages, and doc-verification
   reports reference them. Add new workflows at the end; never renumber.
3. Every step names the control by its **English label** with the **Khmer label** in
   parentheses on first use (full map: [knowledge-base.md](./knowledge-base.md) §1).
   The app renders whichever locale the user chose.
4. `📸` marks a **screenshot checkpoint** — when generating a tutorial page, capture a
   fresh screenshot of the live app at exactly that state.
5. `Verify:` lists the coverage-matrix rows that prove the workflow. Verifying a
   tutorial or learning doc = running those rows.

**workflowsVersion: 2026-10-18ah** (**W-42 Resources PDF reading.** A chapter PDF is described briefly, asks for a bounded verse range, and renders complete verses with cross-references and explanation while retaining a full-chapter choice and a 30-day AI caution. Verified live in the Khmer Resources chat.)
Previous: **workflowsVersion: 2026-10-18ag** (**W-34 supplied book-name source.** A pasted chapter link reads its edition in the selected language; prior choices survive a failed or mismatched source. Verified in the restarted original Khmer chat.)
Previous: **workflowsVersion: 2026-10-18af** (**Khmer regression completion steps.** W-15 selects a camera device after opening its menu; W-42 selects the added server/model and explicitly submits pasted lyrics. English, Khmer and French aligned; all nine isolated Khmer follow-ups right. Camera device selection also observed live on an isolated fixture.)
Previous: **workflowsVersion: 2026-10-18ae** (**Khmer regression follow-up.** W-16 names Yes as the Bible-removal confirmation button and distinguishes the dialog title. English, Khmer and French aligned; live recheck pending.)
Previous: **workflowsVersion: 2026-10-18ad** (**W-34 selected language.** A typed Khmer override controls the imported Bible’s book names and numbers even when the file was detected as Spanish; corrections reload the choices. Verified in the original Khmer chat.)
Previous: **workflowsVersion: 2026-10-18ac** (**Khmer pass 29 final ordinary follow-ups.** W-15 gives the video-link action and completion; W-42 isolates the OpenAI-specific audio prerequisite. English, Khmer and French match; isolated live rechecks pending.)
Previous: **workflowsVersion: 2026-10-18ab** (**Khmer pass 29 completion steps.** W-34 keeps the book-name choice in a complete import summary; W-38 finishes copying with paste and save. English, Khmer and French match; isolated live rechecks pending.)
Previous: **workflowsVersion: 2026-10-18aa** (**Khmer pass 29 folder-switch follow-up.** W-16 names both Switch presses and the automatic reload. The unsaved-edit question is an explanation request, so its corpus kind is what. English, Khmer and French match; isolated live rechecks pending.)
Previous: **workflowsVersion: 2026-10-18z** (**Khmer pass 29 MP4 follow-up.** W-51 keeps assigning, presenting and showing a screen together with copying its media-player address. English, Khmer and French match; isolated live recheck pending.)
Previous: **workflowsVersion: 2026-10-18y** (**Khmer pass 29 running-order follow-ups.** W-22 distinguishes opening a document preview from presenting a slide; W-22j puts destination-folder setup before Import. English, Khmer and French match; isolated live rechecks pending.)
Previous: **workflowsVersion: 2026-10-18x** (**Khmer pass 29 follow-ups.** W-15 completes entering and applying a text color beside the bulk font steps; W-04 starts stopping from the already open timer strip; W-49b keeps the focus exceptions beside the remote recovery steps. English, Khmer and French match; live rechecks follow the isolated corpus pass.)
Previous: **workflowsVersion: 2026-10-18w** (**W-42 — the composer now says Send.** English, Khmer and French button references, keyboard hints and report instructions match the live label.)
Previous: **workflowsVersion: 2026-10-18v** (**Khmer Gemma answers — complete the procedure where it is quoted.** W-06 includes saving or presenting the passage before its next operation; W-25 sets destination folders before import; W-22d creates and attaches a timeout before changing its per-line wait; W-22e names the preview press that makes a jump happen. W-10 has a separate way to hide every screen without turning already hidden screens back on. W-51 completes the TV chooser and HTTPS route, and keeps viewer controls on the viewer device. W-11 gives heading references their own paragraph and puts color, split, and synchronized scrolling in one sequence. W-37 names the folder for a links file, and W-42 gives the attachment/report sequence. English, Khmer and French carry the same steps; measured against the Ollama gemma4:cloud baseline in an isolated dev instance, with live verification tracked in the chatbot ledger.)
Previous: **workflowsVersion: 2026-10-18u** (**W-17 — the Find bar is in every window you work in.** The user, with a picture of **Edit → Find** doing nothing in a dev Presenter: _why find not working in dev_, then _make find work in ai chat and chatbot_ and _make sure find is available in all pages_. **Ctrl/⌘+F** now drops the bar into Screen Mirror, About, Local Web Share, the Web and Lyric editors, the help window and AI Chat as well as the four windows that had it, and in AI Chat it searches the website itself. A bar whose page failed to draw — what had made Find look dead — is replaced by the next press instead of being focused while invisible. Seen live 2026-10-18 on the dev app: a search in each of those windows with its count and highlights; in AI Chat, _mistakes_ found in Claude's own footer and a Khmer word twice in its answer; a real **Ctrl+F** from the keyboard in the help window and in AI Chat; a bar forced onto a page that never draws, replaced by the next press. Not seen live: **Ctrl+F** with the cursor inside the Web Editor's code (no tool can press a menu shortcut), and the Markdown Preview window.)
Previous: **workflowsVersion: 2026-10-18t** (**W-11 and W-46 — two parts of their own.** W-11: the group-scrolling and splitting paragraphs are step 4 now, not the tail of step 3, whose first sentence is **Add Extra Bible** — the answer about making other translations follow opened on it four passes running; steps 4–8 are 5–9. W-46: the **Resources** lessons have a sentence of their own, named by the app's label (the Khmer page had called them by another word), apart from the graph's. Khmer and French carry them; not pressed live.)

Previous: **workflowsVersion: 2026-10-18s** (**W-42, W-11, W-05, W-37 — pass 23's rows short twice or more.** W-42 step 1: the taskbar's lead says it asks no question first (answers kept adding the **Be careful with AI** question from the step's opening). W-11 step 3: **Add Extra Bible** reads two versions side by side **in one pane**. W-05 step 9: **Reset** is in that **Stage Style** window, the **⚙** on the stage's chip in the Presenter's Stage Previewer. W-37 (Khmer only): the inline link example carries a Khmer title. Khmer and French carry them; not pressed live.)

Previous: **workflowsVersion: 2026-10-18r** (**W-37 and W-11 — the two answers short pass after pass.** W-37: one link is written inline (`[{"title": …, "url": …}]`) in the sentence before the example, and the file is saved under its chapter's name (`JHN.3.json` for John 3, `1CH.0.json` for a whole book) — answers dropped the fenced example and copied `1CH.0.json` as the name to use. W-11: a pane gets its color from the dot at the start of its header, **Color Note** (`ItemColorNoteComp` in `RenderTitleMaterialComp`, read in the code); the page never said, and the group-scrolling answer was short three passes running. Khmer and French carry them; not pressed live.)

Previous: **workflowsVersion: 2026-10-18q** (**W-11, W-09, W-22g — pass 21's short answers.** W-11 step 3: **Panes that share a color scroll together.** and **A pane that has a color splits into ANOTHER version.** are bold leads of their own, so neither part opens on **Add Extra Bible**, the step's first sentence, which both answers did. W-09: setting a session up puts nothing on the screen; its show button does that. W-22g: to drop one line onto another, drag that line itself. Khmer and French carry them; not pressed live.)

Previous: **workflowsVersion: 2026-10-18p** (**Eight pages — pass 20's short answers.** W-10: a **Nothing on the projector?** bullet checks the card from the top — showing (**Toggle showing screen** or F5), the footer's **Display** naming the projector, a lit clear button. W-03 step 1: opening a document puts nothing on the screen until a slide is clicked. W-46: the three Messages lessons by their own titles. W-05: the Structure line's lead says what `V1CV2C` is. W-37: the link list is written exactly as the example under it. W-18: Set Line Sync is on the card of the screen showing the passage. W-42: **Settings** for a server of your own is the main window's gear, not the help window's. W-11: the group-scrolling arrows belong to panes split into another version, not to what **Add Extra Bible** puts in one pane. Read in the pages and the code; Khmer and French carry them; not pressed live.)

Previous: **workflowsVersion: 2026-10-18o** (**W-03 and W-12 — the slide keys written as keys, and the Presenter's search opened.** W-03 step 3: **→**, **↓**, **PageDown** or **Space** for the next slide, **←**, **↑**, **PageUp** or **Shift+Space** for the one before — the keys `nextSlideEventMappers` / `previousSlideEventMappers` take; _Arrow keys_ was copied into a Khmer answer as English words nobody there can read. W-12: a result goes on the screen from the Presenter's lookup once its search is opened with the binoculars and **Find**, as in step 1. Read in the code and the pages; Khmer and French carry them.)

Previous: **workflowsVersion: 2026-10-18n** (**W-34 — a Bible's language is fixed on the Info editor's right-click.** Pass 19 answered _My new Bible reads in English_ with the import review's book-name lists, which **Edit Books Map** does not show. The paragraph now says the three commands are on a right-click inside the **Info** editor, in their order, and that **Edit Books Map** opens the 66 names one to a line, with **Guessing Names** to fill them and **Ok** to keep them (`BibleXMLEditorComp`'s `addMonacoBibleInfoActions` and `BibleBooksMapXMLInputComp`, read in the code, driven live on 2026-08-10 per the W-34 notes). Khmer and French carry it.)

Previous: **workflowsVersion: 2026-10-18n** (**W-29 — things to do with a person, a place or a passage in the chat.** Asked for by the user with a picture of a chat about Genesis 4:1-26: _"add more options, like open another verse or open other bible key, and more option to let user able be to do a lot of things on bible"_. Step 13 says what the buttons under the chat's card and answers do — the Bible Lookup, the chapter or verse before and after, another passage, another Bible, who and where is in it, family and places, the verses, save and copy — none of them asking a model. Seen live 2026-10-18 on the dev Reader. Khmer and French carry it.)

Previous: **workflowsVersion: 2026-10-18m** (**W-29 — ask the assistant about a person, a place or a passage.** Asked for by the user with a picture of three record windows, the left of each title circled: _"add robot icon, click to open chatbot, make sure mcp tool provide all information to chatbot session then let user interact"_, and _"chatbot should know the location/name is from KJV"_. Step 13: the robot at the left of a record window's title opens a chat of its own that has read the whole record, offers three questions, and keeps every question in that chat about it; a Bible view's toolbar robot and its right-click (_"add robot icon to part of the icon and add contextmenu to verse preview content"_) do the same for the passage or the verse. Seen live 2026-10-18 on the dev Reader in Khmer: Adam's card and an answer from gemma4:cloud naming the KJV, Genesis 4:1-26 and 4:6 from the right-click. Khmer and French carry it.)

Previous: **workflowsVersion: 2026-10-18l** (**W-37 — a Resources folder opens every time.** Asked for by the user with a picture of the folder headers, chevrons marked: _"`Resources` make it expand by default"_. Folding a group no longer sticks: it opens again whenever Resources is shown (a new launch, another tab and back, **Reload**), and a group switched to its data-directory copy opens too. Seen live 2026-10-18 on the dev Reader. Khmer and French carry it.)

Previous: **workflowsVersion: 2026-10-18k** (**Six pages — pass 18's short answers.** W-44: the ✨ is said for what it is, a company's own AI chat website signed in with your own account, before what it is not. W-08: **Add URL** is on the tab's ⋮ or an empty part's right-click. W-34: a missing Bible's card wants the suggested short name kept, said before the steps; fixing a Bible's language needs nothing of the import again. W-35: what to check when SongSelect will not connect is one note, the three boxes named. W-51: **Let other devices watch** is at the top of the tab, above the cards. Read in the pages; Khmer and French carry them; not pressed live.)

Previous: **workflowsVersion: 2026-10-18j** (**Seven pages — pass 17's short answers.** W-10: turning the wallpaper off is one press, and **Refresh Preview** is for something else. W-12: the Presenter's Bible Lookup is opened with **Bible Lookup** or Ctrl+B. W-15: the Web Editor saves itself as you type (there is no Save). W-22b: the window icon is clicked once — a second click closes the panel. W-22g: **Add CC Elements** is on the line's right-click. W-31: the divider's menu holds the two closes and **Reset Size**, nothing else (the hover arrows are not in it). W-51: casting from the page needs **Let other devices watch**, and the MP4 address is folded under **More addresses**. Read in the pages and the code beside them; Khmer and French carry them; not pressed live.)

Previous: **workflowsVersion: 2026-10-18i** (**Eight pages — pass 16's short answers.** W-01b: a long menu scrolls only when it is taller than the whole window, as a lead of its own. W-05: a song's attachments may be files written `file:///`. W-11: the Reader keeps a verse for later with **Save bible item** at the top right of its Bible Lookup, or Ctrl+Enter — seen live 2026-10-18 on the dev Reader (`SaveButtonComp`, shown on hover), not pressed. W-18: a showing screen takes Line Sync's rows only once hidden and shown again, said in the same sentence. W-22c: `Screen id: 0` written as the app shows it, in English. W-34: the form section opens on the whole job (link or file, Import, the review, Import again); the Info editor is the pencil's, a translation's name opens nothing. W-46: the Resources lessons are found by **Search file name**. W-51: **Cast to a TV** is the cast icon in the card's header, and casting from the page needs no `https://`. Khmer and French carry them.)

Previous: **workflowsVersion: 2026-10-18h** (**Seven pages — the rows that keep coming back short, and one correction.** W-51: an `https://` address needs **Use HTTPS** as well as **Let other devices watch** (the 18g camera paragraph said the first alone — wrong); a TV is reached with **Cast to a TV**, not an address; the viewing page's buttons are a part of their own (on the device watching); **Allow interaction** is on the display's card. W-05: attaching links starts in the Lyric Editor; step 11's lead says a verse on the screen changes when clicked again. W-06: **Save bible item** (the floppy disk, `RenderActionButtonsComp`) keeps a passage in the Bibles list without putting it up, in the Reader's lookup too. W-09: **Always on Top** is under Properties. W-13: Refresh is on the cross references' title. W-22c: a Show/Hide line lands at the end. W-42: the folding page is named. Read in the code and the pages; Khmer and French carry them; not pressed live.)

Previous: **workflowsVersion: 2026-10-18g** (**Eight pages — parts with leads of their own where pass 14's answers left the step out.** W-42: _On a server of your own, type /lyric first_ is a part of its own, no longer the last sentence of a paragraph about the song tools that server is not sent. W-21: a failed download is a note of its own. W-22f step 2 opens on the preview panel having to be open, and that **Add CC Elements** is on the new line's right-click. W-05: the Structure lead carries an example. W-15: changing the words' colour, from step 8. W-35: **Sign In** grey means a box is empty. W-46: the graph lessons are found by searching _graph_ (the preset lesson's title in every language). W-51: casting from the phone's browser page is a part of its own, and sharing a phone's camera opens on turning on **Let other devices watch** and ends on picking it as a camera. Read in the code, the tip catalogs and the pages; Khmer and French carry them; not pressed live.)

Previous: **workflowsVersion: 2026-10-18f** (**Six pages — what an answer left short in pass 13.** W-05: the Structure paragraph opens on how to change the order and the codes to write it in; a verse already on the screen keeps its old words until clicked again. W-12: a search result goes on the screen from the Presenter's Bible Lookup, the Reader putting nothing on the audience screen (W-11). W-22d: the At Time box also says to drag the new line into place. W-34: the form's **Choose File** for an XML file on this computer. W-42: the per-answer cost is on the line under each answer, with **Copy**; a refused key is fixed with **Open AI settings** and a correct key; **Enable AI features** is at the top of **AI Providers** in Settings → Others, and ticking it turns the features back on (`SettingOthersAIComp`). W-46: the Reader's saved-list lessons are found under Help → All tips by **New File**. Read in the code and the pages; Khmer and French carry them; not pressed live.)

Previous: **workflowsVersion: 2026-10-18e** (**Eleven pages — the step a Khmer answer kept leaving out, said where its question lands, and long parts cut into short ones.** W-42's report paragraph is five parts with leads of their own (it looks, it helps first, Send report, kept for later, email it), so a question about one of them is not answered with all thirty sentences; W-05's song paragraph is three (how a song is written, its Structure line, what the editor marks red — now with "write a chord it knows in its place"). W-42 also says what works without internet, that a shared server is picked in the who-answers list, that the guided demos are buttons under a heading, that the Bible Reader tab is in the Presenter's header, and the tip line's ✕ in a lead that is no question. W-05: the Previewer is how the song will look, and nothing reaches the screen until a verse is clicked. W-09: an Audios track has no slider; a Video Show clip's is under Properties. W-12: All Books is in the Find view. W-16: changing the Parent Directory (the folder line, Set according paths, nothing moved; `selectPathForChildDir`). W-18: how to select a card. W-19: Hold is the Follow button itself. W-21: Download and Install. W-22e: a Jump to line lands at the end. W-34: Settings is the gear. W-46: search Messages. All read in the code or the pages beside them; Khmer and French carry them. Not pressed live this time.)

Previous: **workflowsVersion: 2026-10-18d** (**W-18, W-25 and W-34 — what to do, said where the question lands.** W-18 step 3 said a card can be selected, deselected or soloed and never which stops a screen: it is **Deselect**, and **Solo** does the opposite of what is wanted (every OTHER screen stops); an unselected screen keeps what it last showed, which is why two screens can differ. Step 2 now says to point the new card at its display with the footer's **Display** button, and step 5 that Set Line Sync needs one screen. W-25: a wrong password is asked again three times (`MAX_PASSWORD_ATTEMPTS`, _Wrong password, try again_ in `archivePasswordHelpers.ts`, shared by every archive import) and then the import stops; type it as set or ask whoever made the file. W-34: a Bible other than the KJV is not rebuilt; it is imported again. All read in the code, answered short in Khmer by gemma4:cloud; Khmer and French carry them. Not pressed live: no screen was deselected and no Bible deleted on the user's dev data.)

Previous: **workflowsVersion: 2026-10-18c** (**W-12 and W-46 — two steps the pages left implicit.** W-12 said what clearing a search SHOWS and never how: empty the words in the search box. W-46 said a lesson chosen from All tips returns to its card, and named **Show it** only under Settings: it is pressed on the card to start the walkthrough, then **Do it** for each safe step. Both were answered wrong or short in Khmer by gemma4:cloud; Khmer and French carry both now. Wording only.)

Previous: **workflowsVersion: 2026-10-18b** (**W-09 — two pictures at once are two sessions.** Image Show, Video Show and Web Show keep one file per session (`ForegroundMediaComp`: _an overlay and a logo are two sessions of Image Show, not two clicks_); the page said it of Countdown and the marquees and never of the media shows, and _Can I show two pictures over the slide at the same time?_ was answered with a second click, which replaces the first. Khmer and French carry it. Read in the code; not pressed live.)

Previous: **workflowsVersion: 2026-10-18a** (**W-42 step 18 and W-22d step 1 — two steps a model kept leaving out, because the pages did not say them.** W-42: on a server of your own, sent no song tools, pasted words are written out by typing **/lyric** before them (the command needs no model); asked _Can you make a song from words I paste in?_ there, gemma4:cloud said it could not and then told the person to paste them into the same box. W-22d: **Add Action** puts the new line at the END of the running order (`PresentingFlow.insertItemJson` with no index, read in the code), so it is dragged to just after the line it should follow. Khmer and French carry both. Not seen live this time: no running order of the user's was changed to watch the line land.)

Previous: **workflowsVersion: 2026-10-17g** (**W-09 — the slide show names its row.** _The slide show sits in that same row_ came several bullets after the row it meant, and a model quoted the bullet before it instead; it is _the row of session buttons at the top of the panel_ now, in Khmer and French too. Wording only.)

Previous: **workflowsVersion: 2026-10-17f** (**W-08 — how a Background session is pointed at a folder of your own.** The page said a new session "offers to use the default one" and that its ⋮ renames or removes it, and nothing more; asked _How do I point the app at my own pictures folder?_ in Khmer, gemma4:cloud sent the person to that ⋮ in three askings. The folder line above the list opens a box under it: a path typed and Enter, or **Choose a folder**. Seen live 2026-10-17 on the dev Presenter: **Show path editor** on the Background panel's folder line, **ជ្រើសរើសថត** (Choose a folder) found under it, not pressed -- it opens the system's folder dialog. The Khmer and French pages carry the same sentence.)

Previous: **workflowsVersion: 2026-10-17e** (**W-05 and W-51 — two sentences that read the wrong way.** Found by the whole supported list asked in Khmer of gemma4:cloud and graded: W-05's last step said a chord it does not know is `[Cm7]` "is one, `[Cm7b5]` is not", which reads backwards -- it knows `[Cm7]` and not `[Cm7b5]` (`openLyricOracle.test.mjs`), and the model answered with the example reversed; W-51 put **Let other devices watch** "at the top of the tab" inside the step about a display card's **Where to watch**, and three answers placed it and **Use HTTPS** in the card. Both now say where they are. No behaviour changed; the Khmer and French pages carry the same words.)

Previous: **workflowsVersion: 2026-10-17d** (**New W-54 — move your data folder off the Desktop; W-16 names the new default.** The user: _Microsoft Windows, one-drive backup always erase content of everything in data folder. I want to move default data folder (all platforms) to ~/.owa/open-worship-data_, asked at every launch until moved, with a button to hide it for 30 days and words about OneDrive a volunteer understands; the folder moved from is never deleted by the app — _put a flag there … let user move him/her self_ — and the new one is flagged with where it came from. Seen live 2026-10-17 on a scratch dev profile with a throwaway Desktop folder, in English and Khmer: all three answers, the rename and the copy (a file held open), the result, the reminder and its end.)

Previous: **workflowsVersion: 2026-10-17c** (**W-42 step 12 — Auto asks a cloud model first.** The user, with a picture of their Ollama list and `gemma4:31b-cloud` / `gemma4:cloud` circled: _in `Auto` mode it should highly prefer any models ends with `cloud` and high performance like gemma 4 31b over 12b over e4b_, then the order: _cloud/strongest -> cloud/stronger -> cloud/strong -> cloud -> non-cloud/strongest -> non-cloud/stronger -> ..._. Auto now asks a model whose name ends in `cloud` before every other assistant, the biggest first and one whose name gives no size last, then the rest by size as before; the step says such a question leaves the building, and that a server picked by name keeps it in only on a model not ending in `cloud`. Not seen live: the dev window could not be opened for it in this change (another session's instance kept being the one the tools reached); the ranking of the user's own list -- `gemma4:31b-cloud`, `deepseek-v4.1-flash:cloud`, `gemma4:cloud`, then `gemma4:12b`, `qwen3.5:9b`, Free, `gemma4:e4b` -- is unit tested.)

Previous: **workflowsVersion: 2026-10-17b** (**W-12 step 6 — the Bible can be changed under any answer.** The user, with a picture of an answer quoting John 14:6 in French in a Khmer window: _chatbot for finding forgot verses, should have option for user to have a chance change bible, e.g. I'm looking in khmer then I should be able to change to english_. Every answer of the verse search now ends with **Show in another Bible** (verses found) or **Search another Bible** (none found): it lists the other Bibles on the computer, the one searched left out, and the one picked shows the same verses or searches the same words, with nothing typed again; the search then goes on in it. Seen live 2026-10-17 on the dev help window in Khmer: Matthew 5:44 and four more found in KJV, **Show in another Bible** → ពគប, the five quoted in Khmer with their buttons; then words found nowhere in ពគប, **Search another Bible** → KJV, the same words searched in KJV. Not seen live: an assistant's own answer carrying the button with the spend guard paused (unit tests hold it).)

Previous: **workflowsVersion: 2026-10-17a** (**W-42 step 17 — answers, buttons and lettering in your language; step 6 — /tips brings the tip line back.** The user: _if app in Khmer then the chatbot have to be ready for khmer language_, _both chatbot and ai chat must have translation and have font-family apply_, _for khmer, behind the scene it should translate all khmer to english to work with llm or post directly to llm if it is gemma 4 family … for translation recommend using gemma 4 models_, and, with `/tips` typed in the box, _add `/tips` to open tips again_. Step 17 no longer says answers are in English: they are in the language you write in, else the app's; the help window and the AI Chat window are in Khmer with the app's Khmer lettering; and any assistant but a Gemma 4 model is asked in English, a Gemma 4 model on the computer or the network translating both ways. Step 6: typed, **/tips** brings the 💡 line back before its 30 days are up and gives one tip. Seen live 2026-10-17 on the dev app in Khmer: the help window and the AI Chat window in Khmer in Battambang; `/btw` asked in Khmer of a local nvidia/nemotron-3-nano-4b, the waiting line reading _Putting your question into English with LM Studio mac-super · google/gemma-4-12b_ and the answer arriving in Khmer, credited to the nemotron model; **/tips** bringing the line back with a tip in the answer. Not seen live: the same in French (unit tests hold the language as data).)

Previous: **workflowsVersion: 2026-10-16d** (**W-12 step 6 — a verse half remembered is found with the assistant.** The user, with the place circled in Bible Find: _add robot icon somewhere in `Find` when I click it open tab in chatbot by ask for bible key (list to choose) then follow up with what ever that user can remember about the verse_, then _when found verse then it should allow user to click to open in bible lookup_. Verified live 2026-10-16 on the dev Reader: the robot, the Bible list with KJV first, _jesus asked peter three times if he loved him_ answered with John 21:15 and 21:17 by the free assistant, and **Open John 21:17 in Bible Lookup** opening it.)

Previous: **workflowsVersion: 2026-10-16d** (**W-47 step 5, W-09 and W-10 — Show All takes the place of single messages, a new clock starts in a place of its own, and a stage above 0 says it changed the transition.** Fixes from the whole-Presenter robot run 20261016-1920. Seen live 2026-10-16 on a scratch profile: message 2 shown, then **[en:tran:Show All Messages]** leaving only the block, then message 1 leaving only itself; three clocks seeded at the middle, top centre and bottom centre; **Increment** on `St:` with a fade transition showing _A stage above 0 cuts between slides, so the Slide transition was set to None._ Not seen on the real `screen.html` window this time: the screen was kept hidden and read through `owa_list_screens`.)

Previous: **workflowsVersion: 2026-10-16c** (**W-47 steps 2, 4 and 5, and W-09 — messages stack by what the screen draws, and the clock and the camera say more.** Fixes from the Foreground robot run 20261016-1315. W-47: two messages shown one after the other no longer overlap when the first WRAPS on the screen — a long line counts as the lines it takes; a set too tall for the screen is made smaller together until it fits, and **[en:tran:Show All Messages]** is too; moving a message while it is up moves it on the screen. W-09: a duration over 24 hours reads every hour (`25:00:00`); **[en:tran:Choose City]** writes the city's name in words above the clock, **[en:tran:Use Current Timezone]** takes that name away again (a typed name stays), AM/PM is written in the app's language, a long name wraps instead of being cut off, and with several clocks each **[en:tran:Show Time]** is numbered for a screen reader; a camera another program holds says so in its tile. Seen live 2026-10-16 on the dev app's real `screen.html?screenId=0` window: a seven-line wrapped message with a second one directly under it; Show All of both, shrunk to fill the screen; **Move up 2** putting the two in the other order on the wall; a 25-hour countdown reading `25:00:07`; clock 2 set to **Phnom Penh** reading `04:34:17 AM` and back to this computer's time with its name gone; in Khmer, the clock reading `ល្ងាច` and the OBS camera's tile reading _មិនអាចបើកកាមេរ៉ានេះបានទេ…_. Not seen live: a stack pinned to the bottom of the screen (a unit test holds it).)

Previous: **workflowsVersion: 2026-10-16b** (**W-34 step 4 — a downloaded Bible says where it is from, and the assistant asks before it goes on.** The user, with a picture of the assistant's list of seven Khmer Bibles: _ask for user consent first, tell user it is randomly found on internet, show user where is from, tell user it's not provided by openworship, let user know that they hey to responsible for bible publisher. when user agree then keep going_. After the download, and before step 1, the answer says it was found on the internet — in the free collection on GitHub, with the collection's address and the file's own — that it is not from Open Worship, and that a Bible translation belongs to its publisher, so the person answers for how it is used; **I agree** goes on, **Cancel** stops with nothing installed, and **Open the website** shows the collection (or the page the file was listed on) in the web browser; both addresses in the notice are links that open there too (asked for the same day with a picture of the two addresses: _make links clickable, open in browser_ — only addresses the app wrote are links, a model's words stay words). Typed, `yes`, `ok` and `I agree` agree. A Bible an assistant downloads itself carries the same notice under its answer, and an assistant may no longer install one: that is the person's press. The "not available" section's step 3 says the same. Seen live 2026-10-16 on the dev app's help window: _Khmer Standard Version 1954 = Hammond Version_ pressed, the notice with both addresses, **I agree** to _Thank you. A few quick choices_ and step 1, `cancel` typed — the draft gone from the temp folder; then _Khmer 2005_, its two addresses drawn as links, the collection's pressed and opened in the browser with the help window left where it was. Not pressed live: **Open the website**, and the assistant's own download (unit tests hold both). Row `CB-145`.)

Previous: **workflowsVersion: 2026-10-16a** (**W-42 step 6 — a question about what the Bible says gets the app's own way to it, not a page about something else; W-33 and W-34 open on their own words.** Found by asking the Bible Reader's 77 supported questions of the window's default assistant, then the user's own two Bible questions: with no assistant answering, _what bible verse talk about lover your enemy?_ had been answered with the page about keeping files beside a verse, and _what are names of 7 churches mentioned in the book of revelation in holy bible_ with the one about adding a Bible from the internet — eight of ten such questions were handed a page that does not answer them. Now the guide answers a verse asked for by what it says with **Bible Find**, naming the words to try, and anything else about the Bible itself with how to ask an assistant, **/btw** in front; and in the Bible Reader an assistant's answer to such a verse question ends with the same search and a **Show me Bible Find** button. W-33 and W-34 each opened with the other recipe's number as the subject of its first sentence, which the help window takes out of what it shows, so the guide quoted _" moves translations you already have."_ — they now say it in words. Seen live 2026-10-16 on the dev app's help window (Bible Reader, **Auto**): **/help** with both questions answered in 0.8 s and 0.1 s by no assistant; the free model's answer with the line and the button; the button's card ringing **[en:tran:Advance Bible Lookup]** in the Reader.)

Previous: **workflowsVersion: 2026-10-16** (**Controls are named by what a person sees, and the taskbar way into the help is a passage of its own.** Found by asking the supported questions of the free assistant: _How do I read a cross reference in another Bible version?_ came back _click Advance Bible Lookup (bi‑binoculars, top right)_ — W-13 and W-37 named that control by its icon CLASS, and eight more lines did the same (`bi-cpu` and `bi-translate` were the only names of W-13's two caution buttons). They now say the binoculars, the magnifier, the left arrow, the highlighter icon, the markdown icon, and the two buttons go by their own tooltips. And W-42 step 1's **On Windows the taskbar has it too:** carries its colon inside the bold, so the paragraph is read as a passage of its own: _How do I open the help from the taskbar?_ had been answered _Click the 🤖 button on the taskbar_. No behaviour changed; asked again 2026-10-16 on Auto: _right-click the app's icon on the taskbar and choose App Help (Chatbot) under Tasks_.)

Previous: **workflowsVersion: 2026-10-15k** (**W-06 step 6 — a passage across chapters on the projector.** Asked for by the user: _for all bible rendering add support cross chapter rendering_, _if more than 3 chapters then show 3 chapter only and have `...` button to render more 1 by 1 chapter_. A passage like `John 1:50-6:3` goes up as one passage: the projector shows the first three chapters, each opened by its chapter number on a rule, and the mini screen card ends it with **...** (**[en:tran:Show the next chapter]**), which puts one more chapter on the projector per press. Seen live 2026-10-15 on the dev app (Khmer Bible គខប, the real `screen.html?screenId=0` window): **Ctrl+Shift+Enter** put `យ៉ូហាន ១:៥០-៦:៣` up with the `១` divider and no **...** on the projector; the card's **...** took the projector from 63 verse numbers to 117 (chapter 4 added); **Ctrl+→** on the projector window went to `៦:៤` and, re-presented, **Ctrl+←** to `១:៤៩`; a second version was added from the keyboard with **Shift+Enter** on the highlighted version.)

Previous: **workflowsVersion: 2026-10-15j** (**W-42 step 5 — the window list keeps up by itself, and a picture or a pointed-at control remembers its window.** The user, with a picture of Settings opened while the help was already up and no **WORKING IN** line under it: _I don't see the selection after I opened setting later, it should real-time tracking the new opening_; and then _make sure screenshot and element selection have uuid information to the window to let mcp know_. The list now follows the windows as they open, close or change page, with nothing pressed in the help window, and a 📷 picture or a ◎ control keeps the window it came from — its page and `uuid` — which its chip names on hover and the assistant is told. Seen live 2026-10-15 on a scratch dev instance: Settings opened from the main window and the line read _Reader (📖) · main window_ and _Setting (⚙️) · own window_ within 1.5 s, with no focus sent to the help window; the main window moved to the Presenter and its row became _Presenter (🖥️) · main window_; with Settings chosen, the 📷 chip read _my Settings window_ and pointing at **General** made a chip _General (Settings window)_; the picker set back to the main window, pressing that chip still rang **General** in the Settings window; Settings closed and the line went away.)

Previous: **workflowsVersion: 2026-10-15i** (**W-42 step 5 — the window to work in is chosen on the line above the box.** The user, with a picture of the help window and the line over the box circled: _if windows are open more than 1 (beside main) the chat bot should have option to select which window to work on. e.g. lyric editor, setting, app-document editor. add the selection where I highlighted_, and the story under it: _ask about some stuff on app-document editor page, I wish I could select the editor window and start interacting with it_. The **WINDOW** list left the head row: **WORKING IN**, on its own line just over the box, names each open window, and the window chosen is the one the help reads, outlines controls in and walks you through — and now the one the 📷 photographs and the ◎ points in (both had stayed on the main window). The main window is never Local Web Share. Seen live 2026-10-15 on a scratch dev instance: with the main window on the Presenter, a Slide Editor of its own on _Window Aim Test_ and Settings, the line listed _Presenter (🖥️) · main window_, _Setting (⚙️) · own window_ and _Document Editor (🖥️✏️) - Window Aim Test · own window_; choosing the editor set **ASKING ABOUT** to **Document Editor** and lit the line's bar, **/here** answered _This tab works with the Document Editor, a window of its own_, **/find Insert YouTube** ringed it in the editor window, the 📷 attached _my Document Editor window_ — a picture of the editor — and the ◎ read _Point at the control you mean in the Document Editor window…_; choosing the main window put **ASKING ABOUT** back on **Presenter**. Your own app shows the line once it is RESTARTED: the list comes from the main process, and one started before this change has no answer for it.)

Previous: **workflowsVersion: 2026-10-15h** (**W-34 — an imported Bible keeps a note of where it came from.** The user, with a picture of Settings → Bible's **[en:tran:Bibles XML]** list: _as a user I want to see bible data that import by download from online have url. add new field to bible info `note` and mention there about downloading from url by Chatbot for example. keep all possible information of importing_. A Bible's info has a `note` now, and every import writes one: when, by whom (the assistant, an AI agent connected to the app, or the Settings form — and when the assistant typed the link into that form), the link as given, the file link actually downloaded and where the redirects ended, the file's name and size, its books, chapters and verses, the title and key the file had when the person chose others, the key, language, numbers and book names chosen, and any note the file already carried. Its row in **[en:tran:Bibles XML]** shows **[en:tran:Source]:** with the link, and **[en:tran:Note]** opens the whole of it. Seen live 2026-10-15 on a scratch dev instance: _Khmer 2014_ installed through the assistant's tool from its GitHub PAGE link carried _Downloaded from:_ that page, _File link used:_ its raw file, _14.5 MB_, _66 books, 1189 chapters, 31102 verses_ and _digits ០ ១ ២ …, book names "Khmer names (គខប)"_; its row read **Source:** with the page link and a closed **Note**, which pressed opened to those six lines. Not seen live: the form's own import and the chat window's own words (unit tests hold both).)

Previous: **workflowsVersion: 2026-10-15g** (**W-42 steps 5 and 6 — the help works with the window you choose, and the tip line can be put away for 30 days.** The user, with a Bible Reader window open beside the main one and the help still asking about the Presenter: _chatbot work with main window only, imagine I have more child windows like slide editor lyric editor bible reader ... then want the chatbot to help troubleshooting or guide in child window, it's impossible now. Let add window selection (if more child window), after window change the chatbot should work with the selected window_; and, with the 💡 line circled: _add option to hide it for 30 day_. With more than one window of the app open, a **WINDOW** list comes first in the head row; the window chosen there is the one the help reads, outlines controls in and walks you through, and **ASKING ABOUT** follows it. The 💡 line ends in a ✕ that puts it away for 30 days. Seen live 2026-10-15 on a scratch dev instance: with the main window on the Presenter and a Bible Reader opened in a window of its own, the list read _Presenter (🖥️) · main window_ and _Reader (📖) · own window_; choosing the Reader set **ASKING ABOUT** to **Bible Reader**, **/here** answered _This tab works with the Bible Reader, a window of its own … The main window is on the Presenter_, **/find Bible Lookup** outlined it in the Reader window and not in the Presenter, and _Which Bible is open in this window?_ was answered off the Reader window by a free model; the ✕ took the line away and it stayed away after the window was reloaded. Not seen live: two Reader windows at once (a unit test holds that each is aimed at by its own id).)

Previous: **workflowsVersion: 2026-10-15f** (**W-42 step 1 — the taskbar's help opens with no question, and reaches YOUR app.** The user, after pressing the new **App Help (Chatbot)** on the taskbar: _it's there but clicked then open new window instead_, and then _open from taskbar no need confirmation_. The new window was another copy of the app: every development copy shared one taskbar identity, the last one started owns the taskbar's menu, and a copy on a test profile started after the user's had pointed the menu at itself. Each data folder now has a taskbar identity of its own — the usual one keeps the usual — and the taskbar's entry opens the help at once, with no **[en:tran:Be careful with AI]** question; every other way in still asks it. Seen live 2026-10-15 on the dev app: after the restart the menu Windows stored names the user's own data folder, and the entry's command line, run as Windows runs it, opened the help window within three seconds with nothing pressed. A unit test holds that this route asks no question while the others still do.)

Previous: **workflowsVersion: 2026-10-15e** (**W-53 step 7 — a song's card starts as text cards.** The user's ask, with **[en:tran:View as Text Cards]** circled on a card opened from a lyric's menu: _make it enabled by default_. Every NEW language card — from **[en:tran:Add Language]** or from a lyric's **[en:tran:Long Text Show]** — lists a song's parts as text cards from the start; the button turns them into the small buttons and back, and the choice is kept with the session. A card kept from before keeps the small buttons it had. Seen live 2026-10-15 on the dev app: a lyric's **[en:tran:Long Text Show]** on `Still` opened a new session with the toggle on and the nine parts as cards holding their words. Not seen live: **[en:tran:Add Language]** then **[en:tran:Lyric File]** on a new card (the same helper makes both; a unit test holds it).)

Previous: **workflowsVersion: 2026-10-15d** (**W-16 step 2 — the language stays when the data folder changes.** The user's ask, with the Language card of Settings circled: _setting language should be global (not store in data folder) so can once set then have apply to every data folder change_. The language chosen under **[en:tran:Language]** belongs to the computer: a data folder switched to — by **[en:tran:Recent Folders]** or a new **[en:tran:Parent Directory:]** — opens in it, whatever language that folder had before. Seen live 2026-10-15 on a scratch dev instance with two data folders: the first opened in the Khmer it already had; the second, which had held English, opened in Khmer too; **Français** chosen there and applied, the first folder opened in French.)

Previous: **workflowsVersion: 2026-10-15c** (**W-42 step 1 — the help from the taskbar.** The user's ask, with the taskbar icon's right-click menu in the picture and its **Tasks** circled: _I want a `App Help (Chatbot)` in taskbar icon menu as well so I can find help_. On Windows the app's taskbar icon, right-clicked, lists **App Help (Chatbot)** above **Reset Position and Size**, whenever AI features are on; it does what **Help → App Help (Chatbot)** does — the app comes forward and the help window opens (after the caution, unless it was put away). Seen live 2026-10-15 on the dev app: the task's own command line, run as Windows runs it, took the focus from the Presenter to the help window within three seconds. Not seen live: the entry drawn in the taskbar's menu (Windows draws it; a unit test holds the list), and the task pressed with the app closed, which starts the app and opens the help once its window has loaded (a unit test).)

Previous: **workflowsVersion: 2026-10-15b** (**W-53 — a song straight from the Documents list.** The user's ask, with a lyric's menu in the picture: _for a quick showing lyric on behalf of long text show, I want to add `Long Text Show` to lyric's contextmenu, when clicked it should create long text new session then create `EN` language and set the lyric to be ready to show_. A lyric's own menu in the **Documents** list has **[en:tran:Long Text Show]**: it opens the panel on a NEW session named after the song, holding it as an **EN** card from **[en:tran:Lyric File]**, and **[en:tran:Show Long Text]** is on once the card has read the file. Pressed live 2026-10-15 on the dev app: with the panel closed it opened on a `Still` session, `EN · Lyric File · Still — Still · Sections: 9`, the show button on and nine part buttons; with the panel open a second `Still` chip was added and chosen. Not driven live: the Khmer and French names (an existing key, held by the key gate), and the panel coming up from behind another floating panel (a unit test).)

Previous: **workflowsVersion: 2026-10-15a** (**W-42 step 9 — a report the server was asleep for is kept and sent by itself.** The report inbox the shared registry names runs on an ordinary computer, and on 2026-10-14 it was asleep for a day and a half: every report pressed then said _nothing was sent_ and offered an email nobody writes. Now a report whose server cannot be reached is kept by the app — the very words and files that were to go — and sent by itself when the server is back (a minute after the app starts, then every half hour while it is open, for up to a week), and the answer says so. A server that answers no is still said plainly. Seen live 2026-10-15 on a scratch dev instance: a report with a PDF sent with the inbox down was kept; the inbox brought back and the app restarted, it arrived by itself 62 seconds later with both files.)

Previous: **workflowsVersion: 2026-10-15** (**W-53 step 7, W-49b, W-49 and the shortcut appendix — a Long Text Show is stepped by the keys.** The user's ask, with the panel's text cards in the picture: _I want to be like slides preview for next keying, e.g. space, right arrow, when an element selected and focus then next keying should make next click. should not jump to the first element when in last element_. With the lit part's button focused, **Space** / **→** / **↓** / **Page Down** press the next part's button and **Shift+Space** / **←** / **↑** / **Page Up** the one before; focus moves with it, and it stops at either end. A Long Text Show with a lit part is the fourth and last place the remote's three presses hand the keys to (W-49b). Pressed live 2026-10-15 on the dev app with a hidden screen: 7 → 8 by → on the EN buttons, 8 → 9 by Space, Space and → at 9 doing nothing, ← and Shift+Space back to 7, ↓ from the KM text card 7 → 8, and three quick → from **[en:tran:Show Long Text]** focusing the lit part with no step and the next → stepping 3 → 4. Not seen live: the new rows in **Help → [en:tran:Keyboard Shortcuts]** (the menu acts on the window in front, and the app was not; a unit test holds them) and the Khmer and French names (the key gate).)

Previous: **workflowsVersion: 2026-10-15c** (**W-11 step 1 — a passage across chapters, and a heading's reference read whole.** Asked for by the user: _for all bible rendering add support cross chapter rendering, e.g. John 1:2-3:4 … in same book only_, _if more than 3 chapters then show 3 chapter only and have `...` button to render more 1 by 1 chapter_, _devide chapter by `-<chpater number>-----`_, and, with a picture of a Khmer heading citing `យ៉ូហាន ១៨.៣៣-១៩.១៦`, _embedding verse in here should open floating bible detail and should open the whole cross chapters directly in the panel_. A reference may now end in a later chapter of the same book (`John 1:2-3:4`, `John 1-3`, `John 1:-2:`, a dot for the colon); the passage is ONE passage, each chapter under a divider with its number, three chapters at first and one more per press of **...** (**[en:tran:Show the next chapter]**); a heading's reference opens the whole range in the floating verse panel. Verified live 2026-10-15 on the dev Reader with a Khmer Bible: `John 1:50-6:3` read as `យ៉ូហាន ១:៥០-៦:៣` with dividers ១ ២ ៣ and the **...**, three presses adding ៤, ៥ and ៦ one at a time and the button gone after the last; `John 1:-2:` read as `១:១-២:២៥`, `John 1-3` as `១:១-៣:៣៦`, `យ៉ូហាន ១៨.៣៩-១៩.១៦` typed with dots as `១៨:៣៩-១៩:១៦`; the heading reference of Mark 15 opened its panel with dividers ១៨ and ១៩. NOT seen live: the projector's chapters and its **...** (W-06), the copy headers and the heading reference's right-click menu — unit tested.)

Previous: **workflowsVersion: 2026-10-15b** (**W-11 step 4 — a history row is read in a floating panel too, and put back from its menu.** Asked for by the user: _click history element should open the floating bible detial, should have `Open beside the current verse` and `Set to current editing`_. A click on a recent reference row (or ↵/Space on it) now opens the same verse panel a cross reference opens, in the version the row names, and leaves the passage being edited alone; Shift no longer splits. Its **⋮** / right-click menu reads **[en:tran:Open]** (the panel), **[en:tran:Open beside the current verse]** (a new pane after the others) and **[en:tran:Set to current editing]** (what a click did before: the passage goes back into the editing pane), then the copy rows, **[en:tran:Save bible item]** and **[en:tran:Remove]**. Verified live 2026-10-15 on the dev Reader: Genesis 22:2-5 opened in its panel on one click with John 3:1-36 left in the editing pane; **[en:tran:Set to current editing]** put Genesis 22:2-5 into the editing pane, its linked Khmer pane following; **[en:tran:Open beside the current verse]** added a third column; John 3:1-36 was put back the same way.)

Previous: **workflowsVersion: 2026-10-15a** (**W-11 step 4, W-12 step 2 and its put-on-screen note, W-13 step 5 — one click, and a verse read where it was found.** Asked for by the user with pictures of the Reader: _change history element to open by click (not doubleclick). history element cross-reference's verse and find's found verse, when click then open floating-widget (bible verse detail)_, then _`Open` as well_, then, on the panel's **(KJV)**, _should allow choosing different bible key, when chosen then open new panel for the detail_. A reference row above the lookup now goes back on ONE click. A cross reference or a Find result opens in a small floating panel in the version it was listed in, and its menu's **[en:tran:Open]** does the same; the old press, opening it beside the verse you are on, is **[en:tran:Open beside the current verse]** in that menu. The panel's version is a button: pick another Bible and the verse opens in a second panel. Verified live 2026-10-15 on the dev Reader: Romans 11:33-34 and Ecclesiastes 11:5 from Cross Reference, John 19:39 from Find, NIV picked on a KJV panel, Genesis 22:2-5 put back from the history row by one click, Job 37:9-10 opened beside the passage from the menu.)

Previous: **workflowsVersion: 2026-10-14a** (W-46: Copy Debug Info and Copy Full Debug Info are under Help. Verified in the live dev menu.)

Previous: **workflowsVersion: 2026-10-14** (W-47: each new Messages editor keeps its own text. Verified with two notices in a scratch dev Presenter; editing the second left the first intact.)

Previous: **workflowsVersion: 2026-10-13l** (W-01b: context menus use the full window height and shift into view. Verified in the live dev Reader at top, middle and bottom cursor positions.)

Previous: **workflowsVersion: 2026-10-13k** (**W-42 steps 8 and 9 — the way back to the Bible Reader, and a report that really carries the error log.** The user, with a picture of _how can I open bible_ answered with the Presenter’s lookup steps: _the elderly user might accidentally changed page to presenter, if user ask question like bible reading open bible or find bible let add extra follow up to let user know they also should change page to reader as well as extra option to open lookup panel_. An answer to a question about reading, opening or finding the Bible, asked while the main window is on the Presenter or the Document Editor, now ends with one more line and a **Go to the Bible Reader** button; it goes by the page the main window is on at that moment, not the page the chat was opened from. Seen live 2026-10-13 on a scratch dev instance (main window moved to the Presenter, the question asked, the button pressed: the Bible Reader, projector untouched). And step 9: the first report a person sent — from the error dialog — said _Nothing was logged_ under Console, as every report had: the tool the window asked for the console refuses a call that names no page. The main process now keeps each window’s last errors and warnings itself and the report quotes those. Seen live the same hour (three test lines in the report: the account name out of a path, a pasted key redacted, an ordinary log left out).)

Previous: **workflowsVersion: 2026-10-13j** (**W-34 — the card for a Bible that is not available hands it to the assistant.** The user’s ask, with a picture of the Reader on _Bible key "KJV" is not available!_: _should have instruction for user to import in chatbot and should have button to open chatbot to import the bible like kjv_. The card now says how in three steps and carries **Let the assistant import this Bible for me**; the assistant opens already looking for that Bible, and step 1 offers the name the app is waiting for first — installed under any other name the card would stay. A new section of W-34, _When a window says a Bible is not available_. Pressed live 2026-10-13 on a scratch dev instance, twice (once by the user’s own hand): the card in English and in Khmer, the caution, _English KJV_ and _English NKJ 1982_ listed, **KJV (suggested)** first with _The app is looking for a Bible called KJV_, **Install it**, and the Reader on Genesis 1:1 with no reload; **Undo** put the card back. `Import the Bible called "KHOV"` typed: _None of them has “khov” in its name_, and `Khmer` typed under it listed the seven Khmer Bibles with the name still carried. Row `RD-123`.)

Previous: **workflowsVersion: 2026-10-13i** (**W-42 step 7 — every attachment carries a number you can call it by.** The user, with a picture of four chips all named _my screen_: _attachment should have id like `1` `2` `3` ... so user can mention in the text_. Each chip now shows a number, the assistant is told which picture, file or control each number is, the sent question keeps them, and a problem report’s file list says _(attachment 2)_ beside the file. A number is never reused while its chip is there and never changes: with 2 taken off, the row reads 1 · 3 and the next is 4. Seen live 2026-10-13 on a scratch dev instance (three pictures, the middle one removed, one more: 1 · 3 · 4; asked _in 3 the Bibles panel is empty, in 4 it is not_ and the model was sent three pictures with which number each is). Also pressed live the same hour, for step 9: a typed _no_ under **Try this first** puts up the written report with no second look; a report server that finds the files too large is sent the words alone and the answer says the picture stayed behind; and **Stop** while a report is being sent ends the sending and says it was not sent.)

Previous: **workflowsVersion: 2026-10-13h** (**W-42 step 9 — a report takes its files with it, and helping comes before reporting.** Two of the user’s asks the same day. _Some problem is not issue, it is user problem so before helping user to report let try to help user to resolve it first_: the assistant now says first whether you can put it right yourself, and then answers **Try this first** with the steps and two buttons, **That fixed it** (a typed _yes_ is the same press) and **Still a problem — report it**; the report is sent only after the second, and says what you were told to try. And _the posting endpoint maybe have to accept json instead of raw text … and accept files like markdown pdf_: **Send report** now sends the picture of the app and whatever was attached — pictures, a PDF, text files — beside the words, the card names the files before the press, and the answer names the ones that went and any that could not, with why. The paperclip takes a PDF. Words typed while the report is still being written go into it with **Add**. Pressed live 2026-10-13 on a scratch dev instance against a stand-in registry and the kit’s real SQLite inbox: a markdown note and a PDF attached, sent, and written back out of the inbox byte for byte beside the picture; **Add** during the write-up (one report, both sentences, the earlier PDF still with it); the steps answered with a typed _yes, thanks_ (closed, nothing sent, no second look).)

Previous: **workflowsVersion: 2026-10-13g** (**W-42 step 9 — a tab that is reporting keeps reporting, and says so.** The user, with a picture of their own report going wrong: _I’m trying to report but it’s hard_ — asked what went wrong, they typed it, attached a picture and pressed **Ask**, and it was answered as a question (_the guide covers this app only_) — then _chatbot should keep knowing that user try to share information_ and _I don’t see title start with `Report:`_. Now what is typed or attached in a reporting tab goes into the report whichever button sends it, more of it is added to the same report until **Send report**, what was attached is named in the report, and the tab is called **Report: …**. Pressed live 2026-10-13 on a scratch dev instance: typed and **Ask** twice, both messages in the saved report; the user’s own open tab read **Report: keep seeing the e…**.)

Previous: **workflowsVersion: 2026-10-13f** (**W-42 steps 6 and 18 — a where-is asked on a server of your own is answered by the window, and the box a song's words are pasted into is said to be the help window's.** Both found by asking every question of the list, the fill-ins included, of a local model at the settings that ship. _Where is the button for Clear All_ — the list's own fill-in, finished — took the model four rounds of reading the guide and came back _in the header section of the Presenter window_; the button is in the Mini Screen panel. On a server of your own the window now looks for a control called that and outlines it, with no model round (seen live on the dev app: _Clear All [F6] is on screen now — I have outlined it in red for a few seconds_, **Highlight again** under it, no cost on the answer); a name no control carries, and a question the list has a page for, go on to the assistant as before. And _Can you write the notation for words I paste in?_ asked from the Lyric Editor was answered _paste the verses into the box in the Lyric Editor_: step 18 said "the box" and no more, and it says whose box now. No other step changed.)

Previous: **workflowsVersion: 2026-10-13e** (**W-42 step 6 — the next slide, asked for in words on a server of your own, is offered by one button.** Found by asking every supported question of a local model at the settings that ship: asked _Show the next slide?_, the model pressed **Slide 1** itself, said nothing of it, and told the volunteer to click **Slide 2**. On a server of your own the help window now answers that sentence (and _show the previous slide_) by itself, as it already did a slide asked for by its words: it names the slide the arrow keys would go to and offers the one button that puts it up. Observed live 2026-10-13 on the dev app, a local-server tab: _Slide 2 "Info" of "Still" -- press the button and it goes on the screen … The screen is off, so it holds the slide until you turn it on_, with **Put "Info" on the screen** and **Turn the screen on**, and nothing pressed until a button is. Row `CB-140`.)

Previous: **workflowsVersion: 2026-10-13d** (**W-42 step 9 — Send report sends.** The user’s ask, with a registry entry marked `isAcceptingReport` in a picture: _a shared server can be type accepting report … when user report the chatbot should collect information and prepare as a prompt (raw text) then post to the endpoint_. The shared registry can now name a server that takes problem reports, and **Send report** posts the write-up to it as plain text: the answer starts **Sent** with the report’s reference, and says the picture was not sent. With no such server, or one that does not take it, the answer says nothing was sent and why, and goes on as before — the saved file, the address, the five buttons. Such a server is no assistant and is listed nowhere in the app. Pressed live 2026-10-13 on a scratch dev instance against a stand-in registry: one report taken by a stand-in inbox, a second refused by an address that had gone (500), the registry read again and the report taken by the kit’s own SQLite inbox at the new address.)

Previous: **workflowsVersion: 2026-10-13c** (**W-06, W-10, W-22c, W-42, W-53 — the `BB` clear button is `LT`, [en:tran:Clear Long Text]; W-53 step 7 — the part that is marked stays lit in the panel.** Two asks from the user, each with a picture. The first with the `BB` button of the Mini Screen card circled: _search across for any related to long text screen manager … change it to long-text (LT)_ — the layer that draws a Bible passage draws a Long Text Show's text too, so its clear button reads **LT**, its name is **[en:tran:Clear Long Text]** (still **F9**) on the button, in the keyboard shortcuts list and on the running order's clear line, whose badge is `LT`; a running order saved before keeps working. The second with the parts of a Long Text Show card circled: _I want to see those element got focus highlighted when clicked_ — the part marked on a screen is lit on its button, on every language's card, as a button and as a text card alike. Pressed live 2026-10-13 on the dev app: the button read `LT` with the tooltip _Clear Long Text [F9]_; `3 Verse 2` pressed on the KM text card lit that card and brought the row to the middle of the Mini Screen; `1 Verse 1` was lit on the KM card and on the EN button together. Not driven live: the Khmer and French names (held by the key test), the running order's menu, and a click on the text itself lighting its button (unit tests).)

Previous: **workflowsVersion: 2026-10-13b** (**W-42 step 13 — Auto is what a chat starts on.** The user's ask, with the last row of the who-answers list circled: _make `Auto` be selected by default_. A chat in which no assistant was ever picked by name starts on **Auto** — the help window the first time it opens, and every new chat after it; once a named assistant has been picked, new chats start on that one, and picking **Auto** again brings it back. An assistant picked by name before this existed is still that pick. The rule is unit tested; seen live 2026-10-13 on the dev app only as far as a new chat opening on **Auto** once **Auto** was the last pick — the first-run case needs a profile nobody has picked in. Row `CB-139`.)

Previous: **workflowsVersion: 2026-10-13a** (**W-22d steps 1 and 6 — where the right-click is made, and which row carries the stopwatch.** Asked twice of a local model with its temperature at 0, the 27 running-order questions were answered the same both times and two were wrong the same way both times: _right-click the line that should wait_ for the presenting flow's own row, and the stopwatch _at the right of that line's row_ for the attached row's. Step 1 now says the right-click is made in the **[en:tran:Presenting Flows]** list, not in the preview panel, on the row with the name on it, that the action comes in as a NEW line, and that **[en:tran:Change Timing]** is on that `Next: Timeout` line; step 6 says a timeout attached to a line shows as a CC line of its own, indented under the line it is attached to, and that the stopwatch is on that CC line, not on the line itself. Read in the code (a CC line is drawn one level in, under its line; the menu entry of a timeout line is **[en:tran:Change Timing]**), not pressed live: no step changed what it does. Asked again, both answers were right. **W-31 step 5** says in so many words not to open **Widgets** to reach **[en:tran:Reset Widgets Size]** — it is a row of the **View** menu itself, right under **Widgets** — because the same model sent people into that submenu at every asking (_click Widgets, then Reset Widgets Size_); asked again it reads _Click Reset Widgets Size. This option is in the View menu, right under Widgets_. And W-42 gains nothing in words for the two things that changed behind it — a complaint is now checked against the window before it is answered (row `CB-137`), and a local assistant gives the same answer to the same question (row `CB-138`).)

Previous: **workflowsVersion: 2026-10-12l** (**New W-49b: run the slides from a presenter remote; W-22b step 2 and W-49 step 2 point at it.** Asked for by the user, holding a remote and unable to click a panel back into focus: _try attempting next keying multiple time shortly then I should got focused on focusable area which having selected element by order_. Three presses of a next key inside a second and a half hand the keys to the presenting flow's preview panel whose run has started, else to the slides in the middle while one of them is on a screen, else to a floating Slides preview; the third press only focuses. With nothing holding the keys the first press goes to the same panel and moves it. Every step was driven in the live dev app against a hidden screen: the slides took the keys and the fourth press advanced them, the running order outranked a live song, a floating preview took them when it alone was live, nothing was taken with nothing going, from a slider, from behind an open Bible Lookup, or from a song being stepped quickly. Not driven: two preview panels open at once, and a video or audio player — neither is in the recipe.)

Previous: **workflowsVersion: 2026-10-12k** (**W-42 step 8 — two thumbs under every answer, what a thumb down brings, and a mark on what was clicked.** Three asks from the user, typed while every supported question was being asked of a small model: _each response card should have like and dislike icon, when user dislike should follow up_; _when user complain about wrong answer should recommend user to try smarter model_; and _make the card and buttons focusable so when I clicked I still see which one got clicked_. Step 8 says all three: 👍 and 👎 beside **Copy**, kept with the chat and sent nowhere; the first 👎 followed up by the window itself with what was wrong, three sentences to press and the advice to try a smarter model, with **Ask again with …** naming the next model up where the assistant lists its models best first (Claude, ChatGPT, Kimi); the same advice and button with the answer to a typed complaint; and a ring that stays on the card clicked and on the button pressed in it. Observed live 2026-10-12 on the dev app's help window, in a tab opened for it on ChatGPT: a question answered wrongly by GPT-5 nano, 👎 filled, the follow-up with **Ask again with GPT-5 mini** and the three sentences, the press moving the model list to GPT-5 mini and bringing the right answer under a note saying so, 👍 filled on that, a typed _That is wrong …_ answered with the advice naming GPT-5 and its button; then, on a card a command printed, the ring on a pressed thumb and the ring round a clicked card. Read from the code and its unit tests, not pressed live: the wording on the best model, on **Auto**, on a server of your own and with no assistant; a thumb down on an answer further up; a stale **Ask again with …** after the tab moved to another assistant. **And two running-order pages reworded after the last grading** (the user: _fix the two and re-ask_): W-22 step 2 ends on a worked example — drag the row out of the Documents or the Bible list and let go on the row that shows the presenting flow's name; W-22d step 3 says the box that asks for seconds has a chooser at its left, **Seconds** → **At Time**, and its step 1 names the menu entry a timeout line really has, **Change Timing** (it read **Change Seconds**, the interval's — read in the code, not pressed). Rows `CB-134`, `CB-135`, `CB-136`.)

Previous: **workflowsVersion: 2026-10-12j** (**New W-53: one text in several languages, side by side, to sing along to.** Asked for by the user: _I want to have foreground component call `Long Text Show`. Imagine I have lyric just want to show like what showing for bible in screen, with multiple language_. The **[en:tran:Foreground]** launcher has a thirteenth component, **[en:tran:Long Text Show]**: a card per language holding either typed sections or a lyric file of the Documents list, checked against each other before anything goes up (the same sections in the same order, or **[en:tran:Show Long Text]** stays off and the panel says which part differs), drawn row by row in the layer a Bible passage is drawn in, with a look per language and a button per part that brings it to the middle of the screen (a song's card can show each part's words under its button, **[en:tran:View as Text Cards]**). A selected verse or section is marked more faintly than before, at the user's word. Observed live on the dev app the same day: both sources, the two refusals in words, the columns on the Mini Screen and on the screen window, auto-scroll, the per-language size and alignment, a part brought to the middle, **[en:tran:Clear Long Text]** and **[en:tran:Clear Foreground]**, and the text coming back after a reload. Read from the code and its unit tests, not pressed live: moving and removing a language or a section, **[en:tran:Hide Long Text]**, the font and colour rows, a second tab. The text cards were seen live in the user's own use of the panel, not pressed by the run. Verify: PM-163..PM-166.)

Previous: **workflowsVersion: 2026-10-12i** (**W-42, the shared servers: no address is shown.** The user's ask, with the address circled in Settings: _hide endpoint and api key, to avoid easily copy and use_. **[en:tran:Shared servers]** lists each shared server's name and models and no longer its address; the paragraph says so, and that neither the address nor a key reaches either window. Seen live 2026-10-12 in the dev app's Settings: the card opened on _Models_ alone.)

Previous: **workflowsVersion: 2026-10-12h** (**W-09, W-15 step 2, W-19 step 1, W-22 step 9 — four places a local model read wrongly, said where and how.** The last of the answers still graded wrong after the whole question list was asked: _Behind Slide_ was sent to the Background panel (W-09 now says it is under _Properties_ in the component's own panel — seen there, right above _Always on Top_); _How do I add a slide?_ was answered with a new document (step 2 names the menu items: the list's empty area → **New Slide**, a slide → **Duplicate** / **Delete**, rows CM-27, CM-32, CM-33); the drawing panel was opened with the shortcut AND the menu, which closes it again (step 1: one or the other); and the running order's preview was said to step _without changing what is on the screen_ (step 9: opening it shows nothing, clicking a preview or stepping does). And four the page did not say at all, each from rows the test matrix already holds: **renaming a file** (W-01b: its menu → **Rename**, the name turns into a box; CM-04, PL-31), **a slide the wrong shape for the screen** (W-03 Tips: the amber **Fix slide dimension** button at the top of the slides, and the Slide Editor's Width and Height boxes; PM-54, ED-39, ED-17), **the ✨ is not the 🤖** in so many words (W-44's opening), and that **a Bible whose book names or numbers still read in English needs no second import** (W-34, before the sentence about the Info editor). W-06's paragraph about another version on the screen says outright that a plain click changes the column and only Shift adds one beside. Three more after the last grading: the run panel's keys _put the next element on the screen_ (W-22 step 9, where "walk the whole running order without going back to the mouse" had been read as walking it without showing it); a click that goes nowhere does NOT call a **Next: Timeout** off (W-22); and **Generate Slides** is in the Bibles list, the right column, and makes one document for every version ticked (W-06 step 8). And W-22 gained one paragraph that only gathers what the page already said in four places: a loop of slides before the service, from start to finish (the interval above the set, a **Jump to** under it pointing back, started from the preview panel). Its **Jump to** and **Keyboard Event** passages now say where each is added from (right-click the presenting flow itself → **Add Action**), which they had left to the passage before them. And the sentence that introduces **Add Action** says which right-click it is — the presenting flow's own row, not the empty part of the list (that menu is **New File** and **Import**) and not a line — after four different questions had been answered with the wrong one. **And then W-22 became ten recipes** — W-22 (build it), W-22b (run it from the preview panel), W-22c (clear the screen, show and hide it), W-22d (**Next: Timeout**), W-22e (**Next: Interval**, **Jump to**, a loop), W-22f (**Keyboard Event**), W-22g (CC elements), W-22h (**Media Control**), W-22i (a line pinned to a screen, a line parked), W-22j (sharing) — because every answer still wrong was on that one recipe of 39 000 characters, and the user chose the split. The text is the recipe's own; steps that named another step by number name its page; W-22 step 2 says what the NAME row is and W-22d ends on a step for a run that stopped by itself. Its _Verify_ rows stay under W-22 until they are dealt out among the ten. No behaviour changed.)

Previous: **workflowsVersion: 2026-10-12g** (**Nine questions the list offers had no answer on their page — W-01b, W-03, W-06, W-08, W-12, W-16, W-21.** Found by asking every supported question of a local model and reading each answer against its page: where the page said nothing, the model wrote something anyway. Added, each from the code and the controls already checked in the app: the blank first card of a PowerPoint, PDF or Word document (W-03); more than one verse, the next verses from the projector window, and another version on the screen (W-06); putting a search result on the screen (W-12); changing a web background's address (W-08); a name Windows reserves (W-01b); why the projector can show an edit that was never saved (W-03); that an installed Bible has no on/off switch (W-16); what a failed download leaves behind (W-21); the volume of a Video Show clip (W-09); and how a song's parts and their order are written (W-05) — whose step 11 no longer says the verses follow typing that has not been saved: the Lyric Editor writes the song only on Save.)

Previous: **workflowsVersion: 2026-10-12f** (**W-22 steps 2 and its actions, W-42 step 6 — three sentences said more plainly.** Asked of a local model, three answers went wrong on words the page left to be worked out. _How do I add a song … to a presenting flow?_ was answered with the audio track of the **Audios** split, because the list of what can go in said _a document_ and never _a song_ — it now says a slide document or a song. _How do I make the running order advance by itself?_ was answered with dragging an action in, because the paragraph began _Back on the first menu_ without saying which — it now names the menu, right-click the presenting flow → **[en:tran:Add Action]**. And the arrow that folds the top of the help window was put _at the left edge of the list of suggested questions_, because the step said _the left edge of the lists_ — it now says the top line, the one with the three lists. No step changed what it does.)

Previous: **workflowsVersion: 2026-10-12e** (**W-42's checks only.** Six test rows were added for what asking the whole question list of a local model found (CB-126 and CB-127 the same night: an answer names its question's key and menu item, and a song by its link is drafted by the window on a server of the user's own) — the right part of a long page rides (CB-122), **Read the whole thing** shows the page whole and clean (CB-123), a long page is read to its end (CB-124) — and W-11's list has CB-125, a Bible Reader question answered by the assistant and not by the book-button reply. No step of any recipe changed.)

Previous: **workflowsVersion: 2026-10-12d** (**W-01 and W-42 step 1 — the question mark asks which help; W-11 step 3 — a pane in a color group splits into another version.** Two asks from the user, each with a picture. _In `Help` menubar should have `Open Online Help` to open what the question mark icon button open, and for the question mark icon should open contextmenu for `Open Online Help` and `Open Chatbot`_: the **?** at the end of the top bar went straight to the website; it now opens a two-row menu under itself, and the menu bar has **Help** → **[en:tran:Open Online Help]** as its first row. _When a bible view is in group the splitting should call `Split Horizontal to` and `Split Vertical to`_: a pane with a color hands that color to the pane split off it, and the two then follow one passage, so the same version twice showed nothing new — its two split buttons now open the version list, as the menu rows of the same names do, and say so in their names. Observed live 2026-10-12 on the dev Presenter (English): the **?** menu with both rows hung under the button; **Help** → **[en:tran:Open Online Help]** first in the menu bar's own list; a colored Khmer pane whose buttons read **[en:tran:Split Horizontal to]** / **[en:tran:Split Vertical to]**, the press opening the version list under that title, **KJV** chosen, and a KJV pane of the same passage opening on the left in the same group. NOT pressed live: the two rows of the **?** menu and the menu-bar row (a web page in the system browser, and the AI caution, which is a person's to answer) — what each opens is unit tested; nor the same buttons on the lookup's editing pane and its book grid, and their **Ctrl+Shift+S** / **V** keys, which are unit tested too. Rows `NAV-10`, `NAV-25`, `RD-122`.)

Previous: **workflowsVersion: 2026-10-12c** (**W-42 opens on what it is, and step 2 says "new chat".** The page began with a paragraph about importing a Bible from the chat, set in front of the sentence that says what the help window is; and step 2 said only that **+** _starts another_. The opening of a long page rides on every question asked about it: asked through the help window of a local model (gemma-4-e4b), _Can I add something while you are still answering?_ was answered _This guide mainly covers starting a Bible import using an XML link_, and _How do I start a new chat?_ with how to open the help window the question was typed in. The Bible paragraph is now a paragraph of step 6, beside the **More…** list it names, with a lead of its own — **A Bible can be installed from the chat, with no model call.** — and step 2 reads **+** _starts a new chat (its tab reads **New chat** until a question is asked in it)_, which is what the strip shows. No behaviour changed. The other half is in code: which passage of a long page rides (`passageMatch.mjs`, EC-240).)

Previous: **workflowsVersion: 2026-10-12b** (**W-42 step 13 — the who-answers list ends in Auto, which chooses among the assistants that cost nothing.** Asked for by the user with a picture of the list and the space under **Free** circled: _add `Auto` option, the chatbot should choose best no cost for user … check which one not busy and smarter and no cost then use it in asking_, and then _keep `Auto` selected but do dynamic endpoint+model_. The tab stays on **Auto** and who is asked is settled in front of every question: each of the user's own servers that costs nothing is looked at, one that does not answer is left out, one busy in another tab or just failed goes to the back, and the bigger model is asked first — the **Free** service counting as 8B. Observed live 2026-10-12 on the dev app's help window, in a tab made for it: **Auto** as the last row, **AUTO PICK** reading _chosen at each question_, the notice above the chat, the waiting lines _Auto is checking which assistants can answer_ and _Auto picked Free · Nemotron Lightning_ (the one server answering had a 4B model loaded), the answer, **AUTO PICK** then naming who answered, and a named row bringing the model list back. The ordering, the hand-on to the next assistant and the line over the answer are unit tested. Row `CB-121`.)

Previous: **workflowsVersion: 2026-10-12a** (**W-31 step 5 says which menu Reset Widgets Size is on.** The step named the item and not its menu. Asked _How do I put the layout back the way it started?_ with the whole page in front of it, a local model wrote _Click View → Select Widgets → Click Reset Widgets Size_ — a hop through **Widgets** taken from step 1, and not there: the item is on **View** itself, the row under **Widgets**. Read off the app's own menu 2026-10-12 (the menu list a developer's tool returns: _View > Widgets > …_, then _View > Reset Widgets Size_). Row `CB-112`.)

Previous: **workflowsVersion: 2026-10-11g** (**W-18 step 5 — several Bible versions on a screen are columns that scroll together, and what Line Sync really does.** Asked for with a picture of a card whose Khmer column had ended at verse 25 while the NIV beside it was on verse 19: the versions were the cells of one table in one scroller, so a shorter translation ran out early. Each version is its own scroller now and they keep the same reading point the way grouped Bible views do. The step also said Line Sync kept verse highlighting in sync across screens; it lays the versions out verse by verse in rows. Observed live 2026-10-11 on the card and on a virtual display page. Row `SP-33`.)

Previous: **workflowsVersion: 2026-10-11f** (**The corrections of `2026-10-11d` checked by a second reader, and the statements left for a live look gone through again.** The 108 corrections were handed to independent readers with no reason attached and an order to refute them from the code: 107 held, and one did not — **Ctrl+Shift+P** does NOT close the Presenting Control while a drawing tool is armed (W-19 step 9; seen on a scratch dev instance: nothing with the pen armed, the panel closed after **Escape**, and the menu entry closed it either way). Of the 62 statements that pass had left for the running app, a second look at the stylesheets, the bundled libraries, the data and the arithmetic settled 34, and eleven of those were wrong: the countdown flashes red five times before it stays red (W-09); a list row's **⋮** is always there, faint, not brought up by the pointer (W-43); a further run-sheet preview opens a little below and left of the last, not beside it (W-22 step 9); the dictionary is let go ten seconds after its window closes (W-29); **Ctrl+S** saves in the Slide Editor, a Bible note and the Lyric Editor, and the Web Editor saves itself (shortcut appendix); the Khmer Bibles end on _Khmer BFBS_ (W-34); the Jesus example needs the graph opened on David — from Jacob the chain is forty steps and the search stops at thirty (W-38 step 8); two **[en:tran:Slow Down]** presses after two clicks stop the scroll by themselves (W-39 step 4); the help window's captions sit above their lists until it is dragged wider than 560 pixels (W-42 step 5); the notice reads _Assistant read a page on hymnary.org_ (W-42 step 6); and screens on a deleted virtual display go to the first real monitor other than the main one (W-51 step 10). 27 statements are still for a live look — what a second device, a TV, a real account, PowerPoint, a person's press or a model shows, and sixteen a single machine could show — each listed with exactly what to watch in the agent-docs skill's `live-checks.md`. Coverage matrix `2026-10-11f` in the same change.)

Previous: **workflowsVersion: 2026-10-11e** (**W-07 step 7 and step 10 — Bible Properties has a [en:tran:Font Family] row.** Asked for with a picture of the panel: _should have font-family_. The row is the first of the panel's rows, a list of the fonts installed on the computer with a first line, `--`, for none; the font chosen draws every verse, the passage's heading and its verse numbers on every screen, the sample verse and every tile in the panel, and it is saved with a preset and cleared by **[en:tran:Reset]** like the rest of the look. A Bible whose language brings its own font keeps that font behind the chosen one, for the letters the chosen one lacks. Seen live on the dev presenter 2026-10-11, English and dark, a Khmer passage on screen 0's Mini Screen with that screen not showing: _Moul_ picked — the verse, its heading, its version key and its verse number all drawn in Moul, the sample verse and the twelve tiles too; _Georgia_ picked — the sample in Georgia and the Khmer verse still in Battambang; `--` picked — everything back as it was. Not seen on a projector's own window (no screen was showing); the rule a screen draws is held by unit tests. New PM-162.)

Previous: **workflowsVersion: 2026-10-11d** (**Every recipe read against the code — 108 statements corrected, 431 control names made templates.** Asked for by the user after the help window answered from a stale page: _make all document up-to-date with code base_. All 53 recipes and the shortcut appendix were read step by step against the SOURCE, not against the running app, and every change carries the line of code that proves it. The largest: a slide, a song verse and a background tile go up on ONE click, and a second click on a tile takes it off — the recipes said double-click (W-03, W-05, W-08); the Bible Reader puts nothing on the audience screen (W-11 step 7); with no API key the **Free** assistant answers and the questions DO leave the computer, where W-42 said the opposite; a CC element of a presenting flow points at a line, so removing the line removes it (W-22); **Ctrl+Shift+P** closes the Presenting Control as well as opening it (W-19); there is no Notes tab — the panel is **[en:tran:Bible Notes]** (W-14); a link download needs the Extra Binaries pack first (W-21); a viewer of a virtual display from the internet waits for **[en:tran:Allow connection]** (W-51); the Web tab is **[en:tran:Webs]** and its editor is a code editor (W-15). 63 statements only the running app can settle — timing, a drag, what a picture shows — were left as written and are listed for the next `/owa-robot-test` run in `test-results/owa-enhance-agent-docs/report-20261011-2330.md`. Each recipe is now stamped in the agent-docs skill's `manual-reviewed.json`: it is listed for a read again the moment its words or the code its Verify rows cite change. Coverage matrix `2026-10-11d` in the same change.)

Previous: **workflowsVersion: 2026-10-11c** (**W-07 rewritten — Bible Properties is one floating panel: a sample verse, looks drawn as themselves, saved presets, and a row per value.** Two things were wrong. The recipe still sent people to a _settings split_ in the Bibles tab with **Appearance** and **Text Shadow** cards; the panel has been a floating one since August, and the help window answered _change text color_ with those cards and a verse-number colour the app does not have (the user's report, with a picture). And the panel itself was redesigned the same day, asked for with a picture of its `G3:Outline1` buttons: _add the customizable input for bible text style, and add more options, redesign the panel to make switchable between dark/light_, then _make any change can be saved to a new preset_. Now: a verse on a dark or a light background with **[en:tran:Dark]** / **[en:tran:Light]** to say which the words go over (the old Reset White / Reset Black, except that the look is carried across), twelve looks as tiles, **[en:tran:Save as Preset]** for a look of your own, and rows for **[en:tran:Font Size]**, **[en:tran:Text Color]**, **[en:tran:Text Style]**, **[en:tran:Text Align]**, **[en:tran:Line Height]**, **[en:tran:Letter Spacing]**, **[en:tran:Outline]**, the shadow, **[en:tran:Glow]** and a typed `text-shadow`. Seen live on the dev presenter 2026-10-11, English and dark: **[en:tran:Reveal Hidden Controls]** — the **⋯** under the Mini Screen — bringing its buttons up (the user's second picture, the dots circled: _it should tell user to click the 3 dots first_; the help window had ringed a button nobody could see), the panel opened from **[en:tran:Bible Properties]** there, **[en:tran:Dark]** turned the words white, **[en:tran:Lifted]** applied and was ringed, an outline typed to 0.06, navy picked for an outline that was off switching it on, a typed `text-shadow` taken, **[en:tran:Reset]** clearing the look and keeping the size. Seen on a second dev app with its own data folder, Khmer and the light theme: every label translated, bold, centred, line height and letter spacing set, two saved looks drawn as tiles, one pressed and the whole style replaced, its right-click menu opened and **[en:tran:Replace with Current Look]** saved, and **[en:tran:Save as Preset]** opening its name box on _Preset 1_. Not pressed live, because a name box and a confirm are the person's to answer: confirming a new name, renaming and removing — those three are held by the panel's own tests. How a screen draws the result was read off the app's own browser engine drawing the rule the panel writes (bold, centred over a right-to-left column too, a clean edge at 101 px), not off a projector. PM-13 and PM-14 rewritten, new PM-159, PM-160, PM-161.)

Previous: **workflowsVersion: 2026-10-11b** (W-10, W-03 step 5 and W-05 step 8 — **a screen moved to any stage above 0 has its Slide: transition set to none.** Asked for with a picture of a Mini Screen's footer, **Slide:** and **St: 5** circled: _"when change stage to any non-zero should change transition to non"_, then _"change to `none`"_. Only the **Slide:** transition and only on a change of stage: an effect picked afterwards stays until the stage moves again, and back on stage 0 nothing is written. Seen live on the dev presenter 2026-10-11, screen 0 not showing: **St: 0 → 1** turned **Slide:** from fade to none with the Background button untouched; fade picked again on stage 1, **St: 1 → 2** turned it to none again. Stage 0 leaving the transition alone is held by a unit test, not seen live. SP-07 expanded.)

Previous: **workflowsVersion: 2026-10-11** (**W-46 step 4 — the card's quiet link is [en:tran:Hide for 30 days], and the tips come back by themselves.** Asked for with a picture of the card's **Don't show again** circled — _change from `Don't show again` to `Hide for 30 days`, will show again after 30 days_. The press stores the day the hide ends (`daily-tips-hidden-until`) and no longer switches the tips off for good; **[en:tran:Show Tips of the Day automatically]** reads off meanwhile and turning it on ends the 30 days early, while turning it off is still the lasting off. A profile that pressed the old **Don't show again** stays off until that switch is turned on. Seen live on the dev presenter 2026-10-11: the press closed the card and stored a day 30 days out, the Settings switch read off, **Help → Tips of the Day** still opened a tip without ending the hide, and the switch cleared it. The return after 30 days is proven by unit tests on a moved clock, not by waiting. GL-25 expanded.)

Previous: **workflowsVersion: 2026-10-10g** (W-34, the easy way — **asking for a Bible in your own words works, and the list says which ones you have.** Asked for with a picture of the help window's three Bible rows circled — _importing bible data is the most important thing right now … make this prompt and mcp tool and action working smoothly_. Driven live first: `Import a Bible in Cambodia` found nothing (a country is how people name a language, and one works by luck only when it starts like the language's own name); `add bible verse John 3:16 to my bible list` was taken for an import and offered the Chewa, Polish and Turkmen Bibles of 2016; of the seven Khmer Bibles listed five were already installed and nothing said so; a typed `2` under the list drew the same list again; and _How do I import a Bible XML file?_ took a local model 31 s to list the Settings form's eight steps with no way to have it done. Now: a country or a people finds its language, `I want a Khmer bible` and `Do you have a Korean bible?` are requests, a sentence about a verse, a list, a note or the screen is left to the guide, a misspelt language is answered with **Did you mean**, an installed Bible is marked **you already have this one** in the list and said again before step 1, a typed `yes` / number / button word presses that choice, a link pasted alone under the language question is taken, and an answer about importing a Bible leads with **Import a Bible for me**. Seen live 2026-10-10 on the dev app: all of the above, a whole import answered by typing `yes` four times and `ok` (KM2023, New Testament only, John 3:16 read back, then **Undo**).)

Previous: **workflowsVersion: 2026-10-10f** (W-42 step 13 — **the servers the project's site shares are listed in Settings, read-only.** Under **[en:tran:Custom servers]** there is now **[en:tran:Shared servers]**: every server of `openworship.app/llm/info.json` with a lock beside its name and, opened, its address and its models, nothing to type in or delete, and a **↻** of its own with the time of the last read written under it. Asked for with a picture of the help window's list beside the Settings tab — _in setting should have those llm endpoints (read-only) and have refresh icon as well_. Seen live in a dev app the same day: one shared server, its two models, a fresh read on the press. New ST-78; CB-97 now proven live.)

Previous: **workflowsVersion: 2026-10-10e** (W-51 steps 1 and 8, W-50 step 1 — **the Mini Screen's ⋮ has a name of its own, and the cast icon is a step of its own.** Step 1 names **[en:tran:Mini Screen Options]**: as **[en:tran:More Options]** it was one of forty on the Presenter (every file row's dots, each screen card's), and the walkthrough's **Do it** pressed the first in the page — the Documents list's menu opened for a step about the Mini Screen's. The card now refuses a press whose words are on several shown controls and says which panels they are in. Step 8 is **[en:tran:Cast to a TV]** on the display card's header, split out of the browser-page paragraph so a walkthrough started on _cast to a TV_ opens on a short step; the browser page's own button, with **[en:tran:Cast from this browser]**, follows it; the old steps 8 and 9 are 9 and 10. W-50 step 1 names the same control the same way (it bolded the glyph, which no walkthrough could ring). Observed live 2026-10-10 through the app's own MCP door, panel closed: 1/8 → menu → panel → **[en:tran:Add Virtual Display]** → the cast icon.)

Previous: **workflowsVersion: 2026-10-10d** (W-42 steps 6 and 13 — **the help window is page-aware, a general question is cheap and sticks, the clears carry the screen's name, and a local model's tool call written as words still runs.** From the Bible Reader, _Is anything showing on the projector?_ now ends with the sentence that the main window needs to be on the Presenter page to see what the projector holds, under a **Go to the Presenter** button (the screens and state tools answer `needsPage` off the Presenter — asked for by the user: _"mcp tool should aware that some questions is picky the page … should recommend changing page first"_); the Presenter's own commands are offered only while **Asking about** is **Presenter** and refused with the same button elsewhere, **/commands** naming them on one line (_"commands also have to be picky the page … bible reader also part of presenter so it should available in presenter as well"_); the five clears are **/screen-clear-all** … **/screen-clear-foreground** with the old spellings as aliases, and **/clear** empties the chat in front of you (_"command should have prefix, e.g. `/clear-all` should be `/screen-clear-all`, add `/clear` to clear the chat session"_); a plain question under a **/btw** stays general (_"the follow up prompt should inherit command from previous"_, with a picture of _in khmer please_ answered as an app question at 10.2k tokens), an app-road answer to a general question says to put **/btw** in front and the 💡 line carries a tip for it (_"question like this should let user know they have to start with `/btw`, and should have in tip regularly"_), and on LM Studio and Ollama a general question goes out with the model's thinking off; and a tool call a local model writes as words is read as the call (the user's picture: _"got an error rendering"_ — a `<function=owa_help_search>` block printed as the answer). Observed live 2026-10-10 on the dev app against the user's LM Studio on another computer (gemma-4-e4b and qwen3.5-9b at 16k): the Reader-page projector answer with its sentence and button, the button switching the main window to the Presenter, `/clear-` under the Reader offering only **/clear**, **/clear** emptying the tab, **/btw what is holy bible** in under 15 s and _in khmer please_ under it answered in Khmer at 705 tokens. The words-as-tool-call reading, the Presenter-only refusal and the no-answer sentence are unit tested. Later the same day: **servers shared on the project's site** stand in the **who answers** list with a **↻** beside it (`https://www.openworship.app/llm/info.json`, the user's ask: _"as an admin I want to store any available llm endpoints so owa app should be able to use it freshly real-time"_); **Escape** in the box with no list open empties it (_"if no suggestion panel and focusing then ESC key should clear the input"_); the song-by-title chip is drafted with no model on a server of your own (_"assistant should follow up like just create a file or generate lyric file"_); a **/btw** chain yields to a question that names the app (_"it should guide through to the casting button … without `/btw` the chatbot should try best to provide app guiding"_); and either AI caution can be put away for 30 days (_"it's annoying for some users, let put any button to hide it for a while, e.g. hide for 30 days"_). Those five are unit tested and read in code; the registry's publish and the ↻ press are the user's. CB-91 to CB-100.)

Previous: **workflowsVersion: 2026-10-10c** (W-42 step 6 — **the list above the ask box is worked from the keyboard.** **Tab** takes a suggestion — the row the arrows walked to, or the first — and only ever FILLS the box, never sends: `/bt` then **Tab** reads `/btw ` with the cursor after it, and `/scr` then **Tab** reads `/screen` with nothing run. **↑** and **↓** bring their row into view: the list scrolls, and **↑** from the box lit the bottom row out of sight, so the arrows looked dead. The list closes once it has nothing left to offer — a command typed in full (`/screen` leaves **/screen-show** and **/screen-hide**), or the first word after one (`/btw what is`). And a bare `/` lists every command: it stopped at twenty of twenty-five, so **/credit**, **/limit**, **/lyric**, **/btw** and **/commands** were never offered. Asked for by the user with two pictures: _"tab key should auto select the suggestion"_, _"up/down arrow should move selection"_, _"should close suggestion when user type more extra, or already in input text"_. Observed live 2026-10-10 on the dev app's help window, each of the above, and **Tab** with no list open still moving on to **Ask**. CB-90.)

Previous: **workflowsVersion: 2026-10-10b** (W-42 steps 6 and 13 — **your own AI server works with Ollama and the rest, and `/btw` asks a general question.** In **[en:tran:Settings]** → **Others** → **[en:tran:Custom servers]**, **[en:tran:Test]** and **[en:tran:Load models from server]** now find the OpenAI door of a server whose address was typed one path off — Ollama's root `http://localhost:11434`, an address without its `/v1`, Ollama's own `/v1/systemone` — on the same computer and port only, save the right one and say _Address corrected to …_; the lines under each model speak in the server's own words — **Loaded in Ollama. Context length: …** with the Ollama app's **Settings → Context length** as the fix, beside LM Studio's reload — and Ollama's `vision` models get **[en:tran:Sees pictures]** ticked by Load; a wrong address or a model the server does not have is said as that in the chat, never as _not available to the account_. And **/btw what is the Bible?** puts a general question, not about the app, to the assistant in one go with nothing looked up. Asked for by the user: _"make the custom assistant work genericly … it's not working with ollama now … work with most popular llm server like lmstudio ollama"_ and _"add command `/btw` … e.g. `/btw "what is holy bible"`"_. Observed live 2026-10-10 on the dev app against Ollama 0.40 on this computer (`tev1:4b`, then `gemma4:e4b`): the row typed as `…/v1/systemone` answered `404 page not found` to every call and the chat read it as _not available to the account_; after the change, Test corrected the address to `http://localhost:11434/v1`, listed 2 chat models and Load ticked **[en:tran:Sees pictures]** on `gemma4:e4b` from Ollama's own `vision` capability. The chat's `/btw` answer was proven in unit tests only — the help window's caution is a person's to press. The same change takes in the rest of the family — llama.cpp's `llama-server` and llamafile (their `/props` says the context the server was started with), LocalAI, Jan, GPT4All, vLLM, SGLang and a LiteLLM proxy — with their usual addresses in step 13, a refusal written in vLLM's or a FastAPI shape read as one, and the flag that switches tool calling on named per server. The Settings half of those was observed live the same day on a scratch profile — against the REAL llama.cpp (`llama-server` b11541 for Windows ARM64, serving one of Ollama's GGUF files at `-c 4096`): typed as its bare `http://127.0.0.1:18090`, which it answers at, Test listed the model and wrote **Loaded in llama.cpp. Context length: 4k** with the `-c` fix (a bare address gets the root doors asked too, not only a `/v1` one — found by that run); and against stand-in servers answering each program's own shapes: a llama.cpp-shaped address typed without its `/v1` corrected, a LiteLLM proxy at its ROOT address refusing without its key and listing 2 models with it, vLLM's and GPT4All's lists loaded (the embedding model left out), and a wrong port answered _nothing answered at …_; the chat-side sentences (no such model, the tool-calling flags, the context fixes) are unit tested only — none of those programs is installed here. Respawn is a gateway that adds the OpenAI Responses API in front of Ollama and keeps a `/v1/chat/completions` compatibility wrapper, so its `/v1` address is asked like any other server's; it ships as a Docker stack, which this machine had no daemon for, so it is unverified. And **/btw** on a local model loaded at Ollama's default 4k now answers: a general question goes out with a short system prompt instead of the app's and is not refused by the 16k rule — the user's _/btw what is holy bible_ on qwen3.5:4b had been refused as not fitting the 4k context, with the question needing none of the app's instructions. And at the top of **[en:tran:Custom servers]**, under **[en:tran:Watch how to set up a free AI assistant on your own computer]**, the **[en:tran:LM Studio videos]** and **[en:tran:Ollama videos]** buttons each open a page of YouTube videos in the browser — asked for by the user: _"add link … in ai provider setting somewhere to let user know they can setup local ai assistant"_, then _"add … ollama as well"_. ST-75, ST-76, CB-89.)

Previous: **workflowsVersion: 2026-10-10** (W-42 step 12 and W-35 step 1 — every part of **[en:tran:Settings]** → **Others** folds to its title: the three sections (**[en:tran:AI Providers]**, **[en:tran:SongSelect Integration]**, **[en:tran:Extra Binaries]**), and inside AI Providers each provider's card, **[en:tran:Custom servers]** and each server in it. A folded section keeps its state and its buttons, a folded card a ✓ when its key is saved or its server is offered, and what is folded is remembered. Asked for by the user with two pictures of that tab: _"make sections in setting to be collapsible"_, then _"make the nested sections collapsible as well"_. Observed live 2026-10-10 on the dev app in English: the three sections, the five cards and a server each folded and opened again by its title, the folds held across a change of tab, and a ✓ stood only beside a card with a saved key or an offered server. Not observed: the help window opening a folded card to put the cursor in its key box — that needs the Settings window to take real focus, and is unit tested; and the Khmer window — no new words, **[en:tran:Collapse]** and **[en:tran:Expand]** were already translated. ST-71, ST-72, ST-73, ST-74.)

Previous: **workflowsVersion: 2026-10-09d** (W-01 and W-50 step 2 — **[en:tran:Stay Awake]**, the cup left of the **[en:tran:Settings]** gear in the Presenter's header and at the right of the Screen Mirror page's top bar: on unless switched off, it keeps this computer from sleeping for as long as the main window is on one of those two pages; the Bible Reader and the Slide Editor never hold the computer awake and have no cup. Asked for by the user with a picture of the header, the spot left of the gear circled: _"add an icon to toggle force os stay awake, stay awake for presenter.html and screen-mirror.html only. the toggle is enabled by default"_. Observed live 2026-10-09 on the dev app (Windows), reading the system's execution state after each press: with the cup on, the display was required on the Presenter and on the Screen Mirror page; switched off on either page it was released at once with no reload and `stay-awake` read `false` in `setting.json`; the Presenter reopened with the cup still off; switched back on, the display was required again; on the Bible Reader it was released with the cup still on, and no cup was there. Not observed: a computer actually going to sleep, the packaged build, macOS and Linux, and the Khmer hover — its three keys are held by `tranKeyCoverage.test.ts`.)

Previous: **workflowsVersion: 2026-10-09c** (W-42 step 5 — the lists at the top of the help window fold to one line: a small arrow at their left edge folds **ASKING ABOUT**, **ASSISTANT**, **MODEL**, **LIMIT PER HOUR** and **CREDIT USED** into a line reading what each is set to, with the hourly limit at its end, and a click on that line opens them again. Asked for by the user with a picture of that head circled: _"make the area collapsible"_. Observed live 2026-10-09 on the dev help window at its default width: folded, the line read _Presenter · LM Studio super-computer · qwen/qwen3.5-9b_ and _$1 an hour_ and the head went from 100px to 27px; the line opened it with the three lists on the first line as before; the fold was written to `chatbot-head-collapsed` by the press. A reopen of the window finding it folded was not driven — unit tested only.)

Previous: **workflowsVersion: 2026-10-09b** (W-42 step 13 — **your own AI server** in **[en:tran:Settings]** → **Others** → **[en:tran:Custom servers]**: name, address, **[en:tran:Test]**, **[en:tran:Load models from server]**, LM Studio saying under each model whether it is loaded, a **[en:tran:Sees pictures]** box per model, the 32k Context Length to load a model with, and a question that stops within a minute or two when the server's computer goes to sleep. Asked for by the user: _"test everything important (all pages) then find anything we can update the app to make it work smoothly with the local llm"_. Observed live 2026-10-09 against the user's LM Studio on another computer (`http://super-computer:1237/v1`, qwen3.5-9b): Presenter and Reader how-do-Is answered right in 3 rounds and 21–30 s, priced **free**; the panel, the box, **Not loaded in LM Studio right now** under the model, and with the machine off both the Test sentence and a question giving up after 81 s with _it went quiet in the middle of the question — check that the computer it runs on is on and awake_. The machine went down three times under load, so the loaded-model lines were proven in unit tests only.)

Previous: **workflowsVersion: 2026-10-09a** (new W-52 — **[en:tran:Export Settings]** / **[en:tran:Import Settings]** under **[en:tran:Apply Settings]** in the Settings sidebar: a nested tree of sections to carry, the export password, API keys only into a protected file, and an import that REPLACES each ticked section. Asked for by the user: _"in setting.html I want see option to export import setting … import can choose section to import and override the existing section"_ and _"export should allow choose section under nested sections"_. Observed live 2026-10-09 on a scratch dev profile, in English and Khmer: the two buttons, and the export dialog with eleven collapsed sections, their counts, the API keys row disabled and the password pair; the presses inside the dialog are a person's.)

Previous: **workflowsVersion: 2026-10-08g** (W-51 step 7 — **[en:tran:Share my cameras]** on the browser page opens a list of every camera of the device instead of sharing the browser's default one: **[en:tran:Front camera]** / **[en:tran:Back camera]** on a phone until a camera has been allowed, then each camera by name (Android's `camera2 0, facing back` read as **[en:tran:Back camera]**, numbered when a phone has several), **[en:tran:Share]** / **[en:tran:Stop]** per row, another one swapped in place on every screen showing it, and a picture of the one shared above the list. Asked for by the user: _"virtual display camera sharing, on mobile I need option to choose different. add all choices to choose different cameras"_. Verified live 2026-10-08 on the dev presenter's display 1 with a headless Chrome emulating a phone (coarse pointer, three fake cameras) on `http://127.0.0.1:39240/vd/1/`: the list read Front / Back camera before permission; **[en:tran:Back camera]** was refused with the camera toast (the fake cameras have no back side, as on a laptop); **[en:tran:Front camera]** shared `fake_device_0` with its picture shown and the list turned into the three cameras by name; **[en:tran:Share]** on `fake_device_1` swapped it with no unshare in between, and the presenter's Virtual Screens Manager read `Browser 127.0.0.1: fake_device_1`; **[en:tran:Stop]** ended it. A real phone's back lens was not driven.)

Previous: **workflowsVersion: 2026-10-08f** (W-51 step 6 — **[en:tran:Use HTTPS]** in the **[en:tran:Virtual Displays]** tab, off until turned on: a browser's addresses on other devices become `https://` on the same port, so a phone's page is a secure context (kept awake in full screen, its microphone and camera for the intercom). This computer signs its own certificate, so a browser warns once per address. Asked for by the user with a picture of **[en:tran:Where to watch]**: _"add https toggling option"_. Verified live 2026-10-08 on the dev presenter: on, every **[en:tran:This network]** and the **[en:tran:Public IP]** row read `https://` with the QR code still open, **[en:tran:This computer]** and the MP4 stayed `http://`; a headless Chrome on `https://192.168.1.3:39240/vd/1/` drew the display with `isSecureContext`, Wake Lock and `mediaDevices` all present (all absent on the `http://` address); the viewer socket answered `wss` from the https page and refused it from an http one; off again, TLS was refused and `http://` answered.)

Previous: **workflowsVersion: 2026-10-08e** (W-51 step 4 — a screen showing on a virtual display is showing again when the app starts next time (asked for with a picture of a screen's show button off after a reload: _"for virtual display, it should remember showing screen, so even reload it still have content showing"_); W-50 step 7 and W-51 — the internet warning, the tunnel note and the router note fold to one line (asked for with a picture of the Virtual Displays tab: _"make those verbose message collapsed, expandable"_); W-51 steps 7 and 8 — from the virtual display robot run vd-20261008b, "fix high medium and low": on the browser page a tap, a click or the mouse ON THE PICTURE brings the buttons back and a double-click on it goes full screen (the screens covered the whole page and took every touch, so the buttons came back only from the black bars, and a double-click selected a word on the screen instead); the pointer shows over the picture while the buttons do; and a device that leaves the page, or drops off the network without a word, leaves **[en:tran:Watching now]** by itself within about 40 seconds (a tab sent to another site stayed listed for minutes, kept alive by the browser's back/forward cache). Verified live 2026-10-08 on the dev presenter with a headless Chrome on the page: a mouse move and a tap over the picture showed the buttons, a double-click entered and left full screen with nothing selected, the page's row left the list 3 s after it navigated away and came back fresh on Back, and a socket that answered no ping was ended 22 s after it was first asked.)

Previous: **workflowsVersion: 2026-10-08d** (W-09 — a **[en:tran:Screen Show]** is see-through: where the screen it shows draws nothing, the screen beneath shows through, with none of the tinted, blurred backing the text overlays carry. Asked for by the user with a picture of the copy drawing a solid box where screen 1 had nothing: _"it should be transparency"_. Verified live 2026-10-08 on a scratch dev instance with screen 1 HIDDEN and holding only a stopwatch: screen 0's red background showed through the whole copy around that stopwatch on screen 0's projector; in the user's own app a copy placed before the fix turned see-through as well, its empty part showing screen 0's starry background on Mini Screen 0. PM-158.)

Previous: **workflowsVersion: 2026-10-08c** (W-09 — **[en:tran:Screen Show]**, a foreground component that shows what one screen holds on another, cloned from **[en:tran:Camera Show]** with one card per SCREEN carrying that screen's colour and number. Asked for by the user with a picture of the Foreground menu, **Camera Show** circled: _"clone `camera show` foreground to `Screen Show`, everything the same except instead of camera thumbnail but screen id thumbnail. story: as a user I want to show a screen in another screen"_ — a screen never shows itself, and two screens never show each other; then, with a picture of a Mini Screen holding a coloured place-holder: _"wrong design, screen should be rendered independently in screen 0, no need to wait until it got live"_ — the other screen is drawn from what it holds, shown or hidden, never captured from its window. Verified live 2026-10-08 on a scratch dev instance with screen 1 HIDDEN: its red background appeared on screen 0's projector and on Mini Screen 0, blue on screen 1 followed at once, screen 1's stopwatch was drawn inside it, and hiding and showing screen 0 again brought it straight back; screen 0's card onto screen 0 was refused (**[en:tran:A screen cannot show itself]**) and screen 1's onto screen 0 while 1 showed 0 (**[en:tran:These screens would show each other]**); **[en:tran:Width (%)]** resized it; **[en:tran:Hide Screen Show]** took it off. PM-158.)

Previous: **workflowsVersion: 2026-10-08b** (W-51 step 7 — the browser page's **[en:tran:Cast to a TV]** casts first to a TV on the BROWSER's network: **[en:tran:Cast from this browser]** opens the browser's own picker on a stream the app sends the page, and the TV it picks plays the display from the app with the browser's token — no Allow, no code. Asked for with a screenshot: _"host app should stream video to the web to cast from page to browser. this is for casting to a tv with same network of the browser not app"_. The app's own TV list stays below it for a browser on the app's network. Verified live 2026-10-08 on a scratch dev instance with a headless Chrome on the LAN address: the page was handed `…/vd/1/video?cast=<token>`, read the stream's start without playing it, enabled **[en:tran:Cast from this browser]** and said the browser knew no TV (headless has none); the app's list showed 58S470G; closing the list let the stream go. Also from that run: a second copy of the app could share the first one's port on Windows (loopback beside every network); a port something here already answers on is now taken.)

Previous: **workflowsVersion: 2026-10-08a** (W-51 steps 3, 4, 6, 7, 8 — from the virtual display robot run vd-20261008, "fix and enhance": **[en:tran:Where to watch]** leads with one recommended address, its QR code open, and folds the rest — every other network card and the MP4 — under **[en:tran:More addresses]** (a laptop with a VPN, WSL and Hyper-V had listed five look-alikes, each twice); **[en:tran:Preview]** sits at the top of the card; the card notes when several screens share a display; **[en:tran:Watching now]** names each viewer's browser and device; songs and new slides are laid out for the virtual display when there is no second monitor (they were sized for the laptop and boxed on the display); the address keeps its port across a quick restart; on the browser page **[en:tran:Turn on sound]** works on a phone of a development build (it blanked every screen), **[en:tran:Cast to a TV]** lists the TVs the app finds and casts through the app (asked for with a screenshot: _"screen casting on client web not working"_ — Chrome's own picker closed at once and the button did nothing), full screen turns a phone sideways, and with **[en:tran:Allow interaction]** on, the screen's **✕** hides that screen in the app (asked for with a screenshot: _"allowed interactive should be able to [close] a screen by the `x` button as well"_). Verified live 2026-10-08 on the dev presenter with a headless Chrome on the LAN address: sound on drew the screens, the cast list showed the real TV 58S470G, the ✕ hid screen 1 only after Allow interaction, a song filled 1920×1080, the blank PDF slide loaded instead of a broken picture, and a full-width page drew no scrollbar.)

Previous: **workflowsVersion: 2026-10-07f** (W-51: Disconnect immediately revokes screen, camera and interaction access. Verified with two live browsers and isolated held-open-connection regressions.)

Previous: **workflowsVersion: 2026-10-07e** (W-51 step 7 — a camera on the screen reaches the browser page, streamed from this computer, and the page stays silent until **[en:tran:Turn on sound]**. Reported by the user: _"camera not showing on web"_, and a console of "play() failed because the user didn't interact". Verified live 2026-10-07 on a scratch dev instance started with a fake camera: the page at the LAN address played the camera overlay with no console error.)

Previous: **workflowsVersion: 2026-10-07d** (W-51 step 8 — **[en:tran:Disconnect]** keeps out that browser, not its address, says so on its page, and lists it under **[en:tran:Disconnected]** with **[en:tran:Allow again]**. Reported by the user from a tab on the public address: after a Disconnect every tab on that address got _"Waiting for the display"_ and a console full of refused sockets, because the router made them all one address. Verified live 2026-10-07 on a scratch dev instance: of two viewers at 192.168.1.3, the disconnected browser showed the message and stopped retrying while the other stayed connected; **[en:tran:Allow again]** emptied the list.)

Previous: **workflowsVersion: 2026-10-07c** (W-51 step 8 — a browser viewer's row in **[en:tran:Watching now]** has **[en:tran:Allow interaction]**, off by default, per client: asked for by the user (_"interactive not propagate to the app"_, _"give toggle option to allow interactive on each connection, disable by default"_, _"allow per client"_). Verified live 2026-10-07 on a scratch dev instance: a viewer's verse taps did not reach the Presenter while the switch was off; after pressing it the viewer was told so and every tap arrived; the same client reconnecting came back already allowed. Only a verse picked and a page scrolled ever pass, checked field by field and capped at sixty a second (`virtualDisplayWebViewers.test.ts`).)

Previous: **workflowsVersion: 2026-10-07b** (W-50 steps 1 and 5 and new W-51 / SP-30, SP-31 — the floating panel is **[en:tran:Virtual Screens Manager]**, with **[en:tran:Screen Mirror Connection]** as one tab and **[en:tran:Virtual Displays]** as the other; a virtual display is a monitor that exists only in the app, listed in the display picker, streamed to a browser page and as an MP4. Asked for by the user: _"add a new tab `Virtual Displays` (old section to be `Screen Mirror Connection`, title of the panel to be `Virtual Screens Manager`"_, _"the self app will see the vitual display and treated as the real one"_, _"I can set wallspapter (image, vidoe or color), resolution (selection and manual input)"_, _"remember `Screen Mirror Connection` opening status"_, _"performance and low latency streaming are the goal"_, _"on client for web rendering, it should support toggle full-screen and keep os stay awake"_, _"make the area collapsible, should remember all collapse/expand state"_. Verified live 2026-10-07 on a scratch dev instance: the picker listed the display as `<name> (Virtual): W×H` and a screen shown on it opened no window; the browser page drew it about 0.17 s behind the presenter; the MP4 decoded as H.264 + AAC with the background video's sound in it while the Mini Screen's player stayed muted; image and video wallpapers and a resolution change reached the stream (a change ended the viewer then watching); **[en:tran:Disconnect]** ended a viewer and refused its address; deleting the display hid its screen; the folds and the panel's tab survived a remount; the browser page's full-screen button entered and left full screen and the page kept the device awake (wake lock, or a looping muted video when refused); the whole tab read in Khmer.)

Previous: **workflowsVersion: 2026-10-07** (W-50 steps 1–4 and new steps 7–8 / new SP-28, SP-29 — Screen Mirror opens to the internet, every address has **[en:tran:Copy address]** and **[en:tran:QR code]**, the guest page has **[en:tran:Paste address]** and **[en:tran:Read QR code]**, guests are marked **[en:tran:This network]** or **[en:tran:Internet]**, and a guest links to several hosts at once. Asked for by the user: _"I want an option to open to internet, have icon address and view qr code of address"_, _"the option is disable by default"_, _"the copy and qrcode should apply to all address"_, _"make assets access posible"_, _"the qrcode is to copy address, not open url"_, _"update screen-mirror.html to have option to read from qrcode image"_, _"make user on host aware which connection from local and which from internet"_, _"update screen-mirror.html to be able to connect to multiple host"_, _"the image should be copy-able"_, _"should have option to past url to auto-fill the input address and port"_. Verified live 2026-10-07: on the dev presenter the switch was off by default, a QR code decoded back to `192.168.1.3:39240`, copy put that text on the clipboard and **[en:tran:Copy image]** a PNG that decoded to the router address; with the option on, the real router (UPnP) forwarded the port, the panel listed the router's public address as **[en:tran:Router]**, `/discovery` answered through that public address, and turning it off removed the mapping (the router answered 714). On the guest page **[en:tran:Paste address]** filled host and port from a QR picture, from `http://[2001:db8::5]:39241/`, and refused `hello world`. Two scratch hosts and a scratch guest on one machine: the guest linked to both at once (each **[en:tran:Connected]**, each its own a1), a second link to one was refused, **[en:tran:Disconnect]** ended one and kept the other. Presenting to two hosts' screen 0 on one guest is covered by `screenMirrorService.test.ts`, not live — on one machine the guest output would cover the desktop.)

Previous: **workflowsVersion: 2026-10-07** (W-38: graph menus and the preset-name dialog work in fullscreen. W-11: Shift+Escape clears the whole reference; Escape removes only the last part. Verified in the dev Reader, 2026-10-07.)

Previous: **workflowsVersion: 2026-10-06j** (Merge of two branches worked on the same day, each numbering its entries 2026-10-06a–i on its own: the Presenter entries come first below, then the Bible Reader entries, from its own `i` down. No entry was changed.)

Previous: **workflowsVersion: 2026-10-06i** (W-03 step 3: the preview scrolls smoothly to the selected slide after repeated Next presses, including wrapping from the last slide to the first. Verified live on the dev Presenter, 2026-10-06.)

Previous: **workflowsVersion: 2026-10-06h** (from the presenter robot run 20261006-1717, "fix all": W-03 step 5 and W-05 step 6 — a stage chip's **×** is **[en:tran:Hide Stage] N** and in a narrow pane the header keeps every chip in view; W-09 — the Stopwatch history reads in the app's language (numbers only in Khmer); W-10 — the lock refusal's own **[en:tran:Unlock]** closes the message; W-31 — a divider answers the keyboard: Tab, the Menu key, the arrows. Verified live 2026-10-06 on the dev presenter.)

Previous: **workflowsVersion: 2026-10-06g** (W-47 — the edge **Mask** is REMOVED. Asked for with a screenshot circling its footer button: _"not sure what screen mask for, but I want to remove it"_. The Mini Screen footer no longer has the half-square button right of the drawing button, the four cover sliders and the colour are gone with it, and nothing covers the edges of the projected picture any more — a picture that runs past the screen is fixed on the projector itself (zoom, shift, keystone). A mask set on an earlier release is dropped, and its saved setting deleted, the next time the Presenter starts. W-47 is Messages only now; PM-136 retired.)

Previous: **workflowsVersion: 2026-10-06f** (W-03 step 5 and W-05 step 8 — no gap between the boxes of a look-ahead stage, songs and documents alike: the current slide and the coming ones touch, each still framed. Asked for with a screenshot: _"I still don't space there, remove it"_. Verified live 2026-10-06 on the dev presenter: screen 0 on **St: 3** with a PowerPoint document, the slide and the two coming ones touching, `1/7`, `2/7`, `3/7` in their corners.)

Previous: **workflowsVersion: 2026-10-06e** (W-03 step 5 — every coming slide on a document stage carries its OWN count in its corner, not only the current one, and the count is larger (8% of its box's height) on a 50%-opacity dark pill. Asked for by the user: _"all next slides should have index as well"_, then _"make the index bigger, background 0.5 opacity"_. A song's coming verses already carried theirs (each side box is the whole verse shrunk). Verified live 2026-10-06 on the dev presenter: screen 0 on **St: 3** with a PowerPoint document read `1/7` on the slide and `2/7`, `3/7` on the two coming ones.)

Previous: **workflowsVersion: 2026-10-06d** (W-05 step 8 and W-03 step 5 — a SONG's look-ahead stages (2 to 5) now match the documents': the coming verse is at full opacity, and the boxes are laid over the whole slide, flush with its top left corner and no margin, instead of inside the stage's Slide Padding. Asked for by the user: _"apply current request for lyric as well"_, _"save space + full opacity"_. Verified live 2026-10-06 on the dev presenter: screen 0 on **St: 2** showed _Still_ Verse 1 flush top left with `Verse 1 · 1/7` and the Chorus under it at full brightness, flush left down to the bottom edge.)

Previous: **workflowsVersion: 2026-10-06c** (W-03 step 5 — on a document's stages the coming slide is at FULL opacity (asked for: _"make the next coming slide to be full opacity, no need transparency"_), and the layout fills the SCREEN: the slide and the next one grow to the screen's full height from its top left corner with no margin (asked for: _"make align left, margin 0 for current and next slide"_), instead of being arranged inside the slide's own box fitted to the screen, which left a band above and one below on a screen of another shape (asked for with a screenshot: _"I need it bigger, cut those space"_). Also fixed: a PowerPoint slide with **Full Width** on drew plain on a stage screen; a stage screen now fits a PDF or Word page even under Full Width. Verified live 2026-10-06 on the dev presenter: screen 0 on **St: 2** with a PowerPoint slide drew it from the top edge with the next one full-bright down to the bottom edge, `1/7` in the corner.)

Previous: **workflowsVersion: 2026-10-06b** (W-03 step 5 — every document that is not a song gets the song's **Stage Previewer** header: **[en:tran:Add Stage]** adds a pane per stage, and a screen's **St:** number now draws a slide document, a PDF, a PowerPoint or a Word file at that stage too. Asked for by the user: _"add stage 1 to 5 for all kind of documents. no configuration like lyric. story: as a leading singer on the stage I want to see what coming"_, then _"stage 0 have to be no change at all, stage 1 same stage 0 but has indexing"_. Stage 0 is the slide as it is; 1 adds the count in the corner; 2 and 3 the next one or two slides, smaller and dimmer, underneath; 4 the next one without the count; 5 the previous and next on a diagonal. No ⚙ — nothing to set. Verified live 2026-10-06 on the dev presenter with a slide document (5 slides) and a PDF (3 pages): Stage 1/2/5 panes, and screen 1 on **St: 2** drew slide 2 with `2/5` and slide 3 under it on its Mini Screen, moving on to `3/5` with the arrow key.)

Previous: **workflowsVersion: 2026-10-06a** (W-10 and W-49 — **F5** acts on the SELECTED screens, every screen when none is selected, and brings them all to one state: shown only when every one of them is hidden, otherwise all hidden -- so it never puts a screen up while taking another down. Before, every mini screen's toggle took the key itself, so one press flipped each screen on its own — with one screen up it hid that one and showed the other. The card's own toggle still turns only its screen on or off. Verified live 2026-10-06 on the dev presenter: screen 1 solo-selected, F5 showed screen 1 alone and F5 again hid it; screen 0 stayed off.)

Previous: **workflowsVersion: 2026-10-06i** (W-37 step 2 / RD-84 — Resources file-group headings visibly give the full book name and chapter or Introduction beside the code. Verified live in the Reader for John 3 and its introduction.)

Previous: **workflowsVersion: 2026-10-06g** (W-11 step 3 / RD-29 — the color, sync-scroll and audio icons are dimmed at rest and regain full opacity when their group is hovered or a control has keyboard focus. Verified live in the Reader.)

Previous: **workflowsVersion: 2026-10-06f** (W-39 step 2 / RD-107 — auto-scroll keeps a steady pace on any frame rate, follows the text size (bigger text travels further each second, same lines a minute), and carries on from where the reader scrolls it by hand. Verified live on a Reader pane: one device pixel every 150–166ms for 44s at the measured 25px text.)

Previous: **workflowsVersion: 2026-10-06e** (W-11 step 3 / RD-29 — group sync scrolling follows continuously: the other translations move every frame with the pane being scrolled, at the same point of the same verse, and reach the top and the end of the passage together; a new leader or turning it back on glides them into line instead of jumping. Verified live with KJV, TK and Khmer panes: PageDown, End and Home on the KJV pane.)

Previous: **workflowsVersion: 2026-10-06d** (W-34 — _The easy way_: [en:tran:Let the assistant import a Bible for me] in Settings → Bible, or `Import bible for khmer` / `Import bible` / a link in the assistant, installs a Bible by buttons with no model: language, every Bible in it from the Beblia collection with its own title, then name, language, digits and book names, Install it and Undo. Verified live on an isolated dev profile. ST-60, CB-80..CB-82.)

Previous: **workflowsVersion: 2026-10-06c** (W-34 / CB-80: guided Bible XML import, filename locale hints, digit choices and sourced book-name lists. Verified with KhmerBible.xml.)

Previous: **workflowsVersion: 2026-10-06b** (W-12 / RD-47 — a completed Bible Find search with zero matches shows [en:tran:No verses found]. Verified live in English and Khmer, with empty-query and matching-result checks.)

Previous: **workflowsVersion: 2026-10-06a** (W-11 step 3 / RD-29 — grouped Bible previews have a small [en:tran:Sync group scrolling] toggle directly below the color dot, enabled by default. The other translations smoothly center the verse nearest the middle of the pane being scrolled. Verified live with English and Khmer panes, switching direction and source, disabling during animation, and ungrouping/regrouping; both icons fit inside the header.)

Previous: **workflowsVersion: 2026-10-06** (W-11 step 8 and W-42 step 12 — the Bible Audio auto-play switch moved from the Reader's Bible Reference toolbar to **[en:tran:Settings]** → **Others** → **AI Providers**, directly below the saved OpenAI key. Verified live in English and Khmer; the switch toggled and restored its saved value, and the Reader no longer showed the megaphone or an empty spacer. RD-21, RD-22, ST-59.)

Previous: **workflowsVersion: 2026-10-05i** (W-50 steps 3 and 4 — verified across two real computers on one LAN: host hpw11 (dev, hosting switched on) and guest DESKTOP-BUS45KP (dev, 0c025e47), the guest driven by its own Claude session over Remote Control. The guest found only the host, filled it in, waited for approval, read **[en:tran:Connected]** as a1, and kept the host's name after the Presenter and back; screen 0 shown on a1 opened full-screen on the guest's monitor IN FRONT of its own app window (window order checked on the guest), hiding it closed the output, and **[en:tran:Disconnect]** returned the guest page to its start and took a1 off the host's header. The output is raised above the guest's own window, not above other applications.)

Previous: **workflowsVersion: 2026-10-05h** (W-50 step 1 — hosting is OFF until **[en:tran:Let other computers connect]** is turned on at the top of the **[en:tran:Screen Mirror Connection]** panel. Asked for by the user: _"mirror-screen host should not be enabled by default, should have a toggle switch in the panel"_. Off, the app's mirror server listens on loopback only, answers no scan and refuses guests; on, it rebinds to every network on the same port and answers scans; the switch is remembered. Verified live 2026-10-05 on the dev presenter: off at launch with only `127.0.0.1:39240` open, the panel showing the switch and one line; on moved it to `0.0.0.0:39240` with discovery answering, and a scan from this computer listed it beside the other computer on the network, DESKTOP-BUS45KP at 192.168.1.14:39240.)

Previous: **workflowsVersion: 2026-10-05g** (W-50 steps 2 and 3 — the guest's **[en:tran:Screen Mirror]** page is a minimal console. Asked for by the user: _"it should be very minimal, give only button to turn back to presenter"_. The app header is gone; **[en:tran:Presenter]** is its one way out. The page looks for hosts as it opens and fills in the first one it reached, on its LAN address rather than a virtual adapter or loopback (asked for by the user: _"after scan it try each network with each port and auto fill for the one available"_); it shows the host, the link and this computer's monitors in one panel, and names the prefix the host gives this computer. Verified live 2026-10-05 on a scratch dev guest: three hosts listed on opening, all on 192.168.1.5 where the previous scan had shown 172.20.240.1 and 127.0.0.1, the first filled in as 192.168.1.5 / 39241, a picked host filled the address and port, a refused address read **[en:tran:Connection failed]**, **[en:tran:Presenter]** went back; an existing guest connection read **[en:tran:Connected]** with a1 beside its monitor.)

Previous: **workflowsVersion: 2026-10-05f** (New W-50 / SP-25..27: Screen Mirror Connection panel, connected guests above the Mini Screen previews, guest displays, host HTTP resources and shared guest cameras. Verified with isolated development host and guest instances on this computer.)

Previous: **workflowsVersion: 2026-10-05e** (W-48 / PM-154: enabled document and slide transitions have cyan effect icons with translated tooltips, distinct from attached backgrounds; all transition selectors show the same four effect icons with a highlighted choice. ED-54: canvas UUIDs are unique across the document file and persisted during edits; copied slides receive fresh identities. Verified live in an isolated dev instance.) (W-48 / ED-54: visible canvas item transitions, inherited slide/document/screen choices, independently projected enter/exit effects. Verified live with Save, Undo/Redo and Khmer labels.) (W-15: sanitized document HTML and literal Text, EN-39; W-29: name and location detail headers open or focus one panel per record and language; existing details keep their language. Verified live with Moses and Egypt in English and Khmer.)

Previous: **workflowsVersion: 2026-10-05** (**new W-49 — Help → Keyboard Shortcuts lists every key of the page in front, in a floating panel with a search box.** Asked for by the user with a picture of the All Reader tips card: _"like tips but I want for keyboard shortcut listing. for each page I want to open a floating panel see and search for keybaord shortcuts. in in `Help` menubar"_ — a draggable panel and the menu only, no key of its own, both decided with the user. The list is written once per page (`src/keyboard-shortcut/keyboardShortcutCatalog.ts`) and imports the very key objects the features bind (`appShortcutMappers.ts`), so it cannot drift the way the appendix table below had: that table said `Ctrl+Escape` for the key bound to `Shift+Escape`, called `Ctrl+Shift+P` open-only and `Space` a toggle — all three rows are corrected. Then, from the user: _"in presenter the shortcut panel shuld be over bible lookup, and in panel title should change to for the biible lookup … when the biible lookup open"_ — while the Bible Lookup popup is open the panel stacks over it, its title reads **Keyboard Shortcuts · Bible Lookup** and it lists only the keys that work inside the popup; closing the lookup puts the page's list back. KB-61..KB-65.)

Previous: **workflowsVersion: 2026-10-04f** (**W-32 — a view left on its book or chapter grid stays open.** Asked for by the user with a picture of an empty editing view beside Genesis 1: _"when a section is empty then I switch the editing it will close the empty one. I want to keep it and if book selected then selected-book + chapter 1 else genesis chapter 1"_. Moving the editing away used to close a view that had no passage yet; it now keeps it, on the picked book's chapter 1 (the whole chapter) or Genesis 1 — the passage a split from the grid opens. Verified live 2026-10-04 on the dev Reader: empty box → the other view's pencil → `Genesis 1:1-31`; `Exodus` → Ctrl+Shift+→ → `Exodus 1:1-22`. RD-26.)

Previous: **workflowsVersion: 2026-10-04e** (**W-16 — Path Settings remembers the data folders used before.** Asked for by the user with a picture of the Parent Directory card: _"in setting parent directory selection should keep history so I can like switching easily to directories I used to work with"_. A **[en:tran:Recent Folders]** list under the path names every folder this computer used, newest first, each with **[en:tran:Switch]** — which asks first, since every window reloads — and **✕**; a folder not there reads **[en:tran:Missing]**. Verified live 2026-10-04 on a scratch dev instance: typing folder B, then C, listed B over A; A renamed away read Missing with Switch disabled, and a Switch pressed on it before the list redrew answered with a toast instead of the confirm; Switch on B raised **Switch Data Folder**; the list read in Khmer and French. ST-58.)

Previous: **workflowsVersion: 2026-10-04d** (**W-32 — the book and chapter grids keep their split buttons.** Asked for by the user with a picture of a Khmer chapter grid, the empty space left of the **ⓘ** circled: _"in bible reader I want to be able to split view (vertical, horizontal) for non verse as well. should support both top header icons and contentmenu"_. Until a verse resolved, the view being typed in had no split at all — no icons, no Ctrl+Shift+S / V, and its ⋮ and right-click opened nothing. Now **[en:tran:Split horizontal]** / **[en:tran:Split vertical]** sit at rest left of the **ⓘ**, the keys work, and the ⋮ / right-click menu offers the four splits, **[en:tran:Toggle Widget Full View]** and **[en:tran:Close]**. A view can only hold a passage, so the new one opens the picked book's chapter 1 (the whole chapter), or Genesis 1 before a book is picked — decided with the user; the view being typed in keeps its grid and stays selected. Verified live 2026-10-04 on the dev Reader: `Exodus` → split horizontal → `Exodus 1:1-22` on the left; unknown text → Ctrl+Shift+V → `Genesis 1:1-31` below; ⋮ → **[en:tran:Split Horizontal to]** → NIV → an NIV Genesis 1; with a verse showing, Ctrl+Shift+S still adds exactly one copy. RD-77, KB-25, KB-26, CM-79.)

Previous: **workflowsVersion: 2026-10-04c** (**new W-48 — a slides preview, a slide, a Background tab, one background, a foreground component or one of its sessions can have its OWN transition.** Asked for by the user with a picture of the Mini Screen's **Slide:** button and the slides preview's ⋮ circled: _"I want to have transition per slides preview and per slide … let put an enabling checkbox … if disabled then it will depend on screen transition. when enabled then override. this should have for all (background, foreground components, foreground component's section, slides preview, slide)"_ — the "section" being the session tabs. Every level is the same **[en:tran:Own transition]** checkbox and picker; unticked it says what it follows. The Tr row gained **[en:tran:Foreground]:**. Each item now leaves the way it came in, and **[en:tran:No Transition]** is a cut both ways. Verified live 2026-10-04 on the dev presenter: a song set to **[en:tran:Zoom]** zoomed its chorus in, a slide of it set to **[en:tran:No Transition]** cut in while the zoomed one zoomed out; the **[en:tran:Images]** tab on Zoom zoomed a picture in and one picture set to No Transition cut in; a Quick Text session on Zoom came and went with it; unticking every level removed its setting and the song's sidecar. PM-154..PM-156.)

Previous: **workflowsVersion: 2026-10-04b** (**W-09 — the stopwatch keeps a history of the times it was reset from.** Asked for by the user with a picture of the Stopwatch panel, the space under **[en:tran:Resume]** / **[en:tran:Reset]** circled: _"stopwatch should have history, when reset then save the current timed"_. **[en:tran:Reset]** saves the reading into a **[en:tran:History]** list there — newest first, numbered, with the time of day — per session, the last 20, and **[en:tran:Clear]** empties it after a confirm. Verified live 2026-10-04 on the presenter: a paused `00:00:04` reset into entry 1, a running `00:00:05` reset into entry 2 on top, Session 2 showing no list and Default keeping both. PM-153.)

Previous: **workflowsVersion: 2026-10-04a** (**W-09 — the countdown and the stopwatch go up stopped and are started, paused, resumed and reset from their panels.** Asked for by the user straight after the overtime count-up: _"I want to be able to control like pause reset resume start... so when show it should not start yet, but should have option for auto-start"_, then _"then apply to stopwatch as well"_. A duration countdown's button reads **[en:tran:Show Countdown]** and puts it up on its full length, not counting; **[en:tran:Start]**, **[en:tran:Pause]** / **[en:tran:Resume]** and **[en:tran:Reset]** sit under it with the state in a word, and the **[en:tran:Auto-start]** switch (off by default, kept per session) brings back starting the moment it is shown. The stopwatch has the same row and switch. A countdown to a date & time still starts at once — it is tied to a clock time. The screen shows only the digits, and a press is applied to the clock already up, with no fade. Run-sheet rows saved before this start at once as they did; new rows remember the switch. The assistant's _start a 5 minute countdown_ still starts it, and it says when a clock is paused or not started. Verified live 2026-10-04 on the presenter: shown at `00:00:07` not started, started, paused at `+00:00:05` and held, reset to `00:00:07`; the stopwatch started, paused at `00:00:05`, reset to `00:00:00`; Auto-start on read **[en:tran:Start Countdown]** and ran at once. PM-152.)

Previous: **workflowsVersion: 2026-10-03b** (**W-09 — a countdown takes seconds, and counts the time over once it is up.** Asked for by the user with a picture of the Countdown panel, the space after the **m** box circled: _"I want second option, and when time out I want it start counting up so I can know how long it over"_. The _for a duration_ form has an **s** box after **h** and **m** (saved per session like the other two). At zero the countdown still flashes red five times, then rests red and counts UP behind a **+** — `+00:00:01`, `+00:00:02` … — until it is hidden; this is true of both forms and of a countdown started from a run sheet or by the assistant, and the help window describes it as counting the time over. A run-sheet row for a duration countdown is now titled with its seconds too (_Countdown: 1m 30s_). Verified live 2026-10-03 on the presenter: 0 h 0 m 7 s read `00:00:07` on the Mini Screen and `+00:00:03` in red a few seconds after zero. PM-151.)

Previous: **workflowsVersion: 2026-10-03a** (**W-42 steps 6 and 19 — a song by its NAME.** Asked for by the user with a picture of _Create a lyric file from "Amazing Grace"_ typed into the box: the fourth **Try asking** chip is now _Create a lyric file for song "Amazing Grace"_, and the help window looks a song up by its title — in your own songs first, then in the app's collection of public-domain hymns, the same texts **Import From Public Domain Songs** brings in — and never writes one out from memory; **/lyric Amazing Grace** does it with no assistant. The link chip moved into **More…**. Verified live on the dev window 2026-10-03: **/lyric Amazing Grace** → John Newton's four verses, the preview and **Create "Amazing Grace"** / **Copy song text** in about a second with no model; the chip's words on GPT-5 → the same hymn, created, with **Show it in the list**; _Way Maker_ → not in the collection, asked for the words or a page instead.)

Previous: **workflowsVersion: 2026-10-02d** (**W-10 — a card can stop drawing its screen.** Asked for by the user: _for performance sake, I want to be able to toggle to disable mini-screen rendering_ — a low-spec computer drawing only `screen.html`, with every control the same. The eye right after **FG** in each card's header (**[en:tran:Stop rendering preview]**) turns that card's body into a striped **[en:tran:No rendering]** face; the audience screen, the clear buttons, presenting and every other control carry on. A slide's video or audio keeps its sound — only its play button, which is part of the picture, needs rendering back on. Remembered per screen. Verified live on the dev presenter 2026-10-02: with the card off, Slide 3 went to screen 0 and `screen.html` drew the background, the slide and the foreground clip; turning it back on showed the same; the presenter renderer fell from 7.7% to 1.7% CPU with both cards off.)

Previous: **workflowsVersion: 2026-10-02c** (**W-22 — the Add Action menu counted right.** **Other Clear FG Items** holds ELEVEN per-widget clears (Messages, Video Show and Image Show joined the eight), and the run family under **Screen: Hide** is FIVE lines, **Next: Clear Interval** included. Read off the live menu in English and Khmer on the dev presenter, robot run 20261002-1644.)

Previous: **workflowsVersion: 2026-10-02b** (**W-09 — a session's Hide row is that session's own.** Reported with a picture of the **[en:tran:Marquee Bottom]** panel on Session 2 offering **[en:tran:Hide Marquee Bottom]** for screen 0 while the scroll on that screen was Default's: _"the Session 2 is not showing but it have screen status"_. The Hide row listed every overlay of that kind whoever put it up, so the session in front read as live. It now lists only that session's — on all five single-slot panels and on Messages — and the on-screen dot on the owning session's button is where the other one is taken down. An overlay whose session is gone (a no-session one after **Default** was removed) belongs to the first session button, so none is left reachable only by **Clear Foreground**. Verified live on the dev presenter 2026-10-02: with Default's Khmer scroll on screen 0, Default's panel showed **Hide Marquee Bottom 0** and Session 2's showed none.)

Previous: **workflowsVersion: 2026-10-02** (**W-09 — every foreground component gained _Behind Slide_.** Asked for by the user: _as a user I want to be able to render foreground behind bible/slide_. A checkbox in each component's **Properties**, right above **Always on Top**, puts that session's item behind the slide and the Bible text and over the background; ticking it on an item already up moves it at once, and **Always on Top** greys out while it is ticked. Verified live on the dev presenter 2026-10-02: a Marquee Bottom on screen 0 disappeared behind a full-screen slide in the Mini Screen when ticked, and was back over the slide's last line when unticked.)

Previous: **workflowsVersion: 2026-10-01b** (**W-06 step 3 — a verse goes up with its button, not a double-click — from the release robot run 20261001-1953.** Asked for by the user ("fix all findings"). The step said to double-click the verse in the lookup's preview to present it; there a double-click selects a word, opens the verse-mark toolbar and brings the verse into view, and presents nothing. It now names the control that does it — **Save bible item and show on screen**, in the passage's title row while the mouse is over it — and its shortcut **Ctrl+Shift+Enter**, and says the passage is saved to the **Bibles** list as it goes up. Verified live on the dev Presenter 2026-10-01: **Ctrl+Shift+Enter** in the lookup put Genesis 1:1 (KJV) on screen 0 and added it to the **Bibles** list, and **Clear Long Text** took it off.)

Previous: **workflowsVersion: 2026-10-01** (**W-29's translation note and W-38 step 8 — fixes from the reader-only robot run 20261001-1149.** Asked for by the user ("fix all findings"). A name's **Gender** and a place's **Type** are now said in the lookup language, like a person's kind (W-29 said they were not); and a path search that finds nothing says how far it looked — **No connection found within 30 steps** (W-38). W-38 step 3's counts follow the dataset, which grew: Jacob's badge reads **47**, his children **16**. Verified live on the dev Reader 2026-10-01: Jacob's detail panel reads **ប្រុស** in its chip and its Gender row, Siloam's reads **ស្រះ** for its Type, and Jacob → Jesus answers **No connection found within 30 steps**, inline and as a toast.)

Previous: **workflowsVersion: 2026-09-30** (**W-44 steps 4, 5 and 7 — more than one AI Chat window, tabs that move, and tabs that come back.** Asked for by the user: _I want the ai chat can be open multiple instances_, _drag the tab to new window_, _a tab's options to open in new window and a window option to open new window_, _a tab should be able to drag and move to reorder_, and _I want to see my previous tab_. Every press of the **✨** now opens another AI Chat window, up to three at once (each keeps its own tabs); a tab is dragged along the strip to reorder it, dragged out of the window or sent with **Open in new window** from its **⋮** to become a window of its own, and the new **New window** button beside **+** opens one more; a closed tab goes to **Recently closed** — on the card and behind the clock in the row above the page, **Ctrl+Shift+T** for the last — and comes back on its conversation. Sign out empties that list too. Verified live on the dev window 2026-09-30: the menu route moved a signed-in Claude conversation into a new window, a fourth window was refused, a closed tab came back from the card, and a drag reordered two tabs; the drop OUTSIDE the window is an OS drag CDP cannot make, so it is unit-tested only.)

Previous: **workflowsVersion: 2026-09-29** (**W-46 — the Tip of the Day card takes itself off after one minute, and says so while it is there.** A 3px bar along the card's bottom edge drains left to right over that minute; resting the mouse pointer on the card freezes the bar and the minute with it, and moving away carries on from where it stopped rather than granting a fresh minute. **Next tip** starts the minute again, **All tips** holds it while the list is open, and the card is still closed at once by **×**. Verified live on the dev Reader and Slide Editor 2026-09-29.)

Previous: **workflowsVersion: 2026-09-28f** (**W-46 — the Tip of the Day card is compact.** The card is 320x100 instead of 390x169: the title band is a quiet label row (no page name beside "Tip of the Day"), **Don't show again** moved into that row beside a red close mark, and **Show it / Next tip / All tips** are one small segmented group. In **All tips** the topic is a word leading each lesson's line rather than a bordered badge on a line of its own. Verified live on the dev presenter 2026-09-28.)

Previous: **workflowsVersion: 2026-09-28e** (**W-03 / W-31 — the previewer's Note panel now starts CLOSED.** A document or slide note is a thing few volunteers ever write, and the panel spent a seventh of the previewer on two empty boxes. It is reopened by the green **Note** strip under the slide previews, by View > Widgets > Note, or by Reset Widgets Size, and the Tips of the Day lesson _Write a note on a document or slide_ walks that. Documents that were already remembering it open are closed once on the next launch. Verified live on the dev presenter 2026-09-28.)

Previous: **workflowsVersion: 2026-09-28d** (**W-06 — Generate Slides offers Font Size and Dark/Light themes.** Optional size in canvas pixels, automatic fitting, theme-aware verse numbers and a muted upcoming verse at 85%. Existing translucent, inset backgrounds are retained. Verified live with English and Khmer in both themes.)

Previous: **workflowsVersion: 2026-09-28c** (**W-15 — Background Color and Text Color accept direct hex entry.** Enter or leaving the field applies; Escape cancels. Verified in the live Document Editor, including transparency and Undo/Redo.)

Previous: **workflowsVersion: 2026-09-28b** (**W-15 — Bulk Font applies font size or family to all slides, selected slides, or individual text-bearing canvas items.** Locked items are opt-in; each application is one undoable change. Verified in the live Document Editor. New ED-52.)

Previous: **workflowsVersion: 2026-09-28a** (**W-06 — generate a slide document from a saved Bible passage.** Choose additional Bible versions, create a title slide and one slide per verse, with each version's font, compact margins and a muted next verse at 85% of the current text size. Verified in Presenter with KJV and Khmer. New CM-101.)

Previous: **workflowsVersion: 2026-09-28** (**W-46 — fourteen additional Presenter-only lessons for Bible Lookup, media libraries, service flows, Messages, Effects and image slide shows.** Presenter 74 → 88 topics; Reader remains 61. Live guide actions open controls and leave audience output unchanged.)

Previous: **workflowsVersion: 2026-09-27a** (**W-10 — the mini screen draws each monitor's own desktop wallpaper behind what it renders, in place of the checkered pattern.** Asked for directly: the pattern stood for "the audience screen is transparent here" and said nothing about what that means on the wall. The backdrop is the WALLPAPER read from the operating system, never a capture of the display -- a capture drags in every other window that happens to be up, so a screen assigned to the machine's own monitor drew a picture of the app inside itself, and it would have to be retaken to stay honest. A wallpaper is a file: read once per display, shared by every card on it, released with the last one, and laid out the way the desktop lays it out (Fill / Fit / Stretch / Centre / Tile). **[en:tran:Show Monitor Wallpaper]** in the mini-screen menu puts the pattern back and **Refresh Preview** re-reads it. Verified live 2026-09-27 on the dev presenter across two displays. New matrix row SP-23.)
Previous: **workflowsVersion: 2026-09-28-lookup-sections** (W-12 and W-31: Advance Lookup is a normal horizontal section beside Bible and Notes and Bible Lookup; the toolbar mirrors its section state. RD-08. Verified on the dev Reader.)

Previous: **workflowsVersion: 2026-09-28-resources-offer** (**W-37 step 3 — the folders already in the data folder's `resources` are offered with one press.** Asked for with a picture of an empty Resources view beside Explorer showing `pdf` and `YouTube` in `<data folder>/resources`: that folder belongs to Resources, yet a folder in it was reachable only through the folder picker. Each one not already shown is listed under **In the data directory**, below the shelf (or under **Add Folder** when it is empty); a press adds it with no picker. Verified live 2026-09-28 on the dev Reader: a scratch `zz-probe-offer` was offered alone — a hidden `.copying-…` folder, a plain file and the listed `pdf`/`YouTube` were not — one press drew its box with its `LEV.19.*` file and the heading went away, and the list was saved as `$DATA_DIR_PATH\resources\zz-probe-offer`. RD-122.)

Previous: **workflowsVersion: 2026-09-28-page-tips** (**W-46: tips in each operator page, focused-window All tips, and demos in the originating window.**)

Previous: **workflowsVersion: 2026-09-28-reader** (**W-46: Reader catalog expanded to 99 lessons with practical usage tips; 49 start with safe actions.**)

Previous: **workflowsVersion: 2026-09-27** (**W-05 — Add Stage is the same picker the mini
screen's `St:` badge opens.** Asked for directly, with both menus circled in one
picture. The Stage Previewer could offer Stage 1 and then nothing — it went dead
— while a screen's stage number increments without a ceiling, so a screen set to
`St: 3` showed a render the previewer had no pane for. Both menus now list the
same five numbered stages (one already shown is listed and greyed, never
removed) and close on **Increment · Stage N**, one past the highest stage on
screen. Every stage number keeps its own style record, so a third and a fourth
stage are two more looks rather than two copies of stage 1 — proven live by
turning stage 4 dark and watching stage 3 stay light. New step 6, steps
renumbered, and the stage-style steps stop naming `Stage 1` as the only other
stage. PM-148.)

Previous: **workflowsVersion: 2026-09-26e** (**W-41 — an exported note carries what you
typed last, not what you saved last.** The note window keeps your typing in the
note's editing history until you press **[en:tran:Save]** (W-14), and the
bundle was written from the file on disk -- so a note edited this morning and
not yet saved went to the other machine as it was yesterday, with nothing about
the bundle saying so. Both exports read the note the way its own window does
now: the whole page from the file's `⋮`, and one note from its own `⋮`. Proven
live 2026-09-26 -- text typed into the window and never saved came back out of
the `.owanote.tar.gz` and the `.owabn.tar.gz`, while the file on disk still held
the old words. PR-30, PR-31.)

Previous: **workflowsVersion: 2026-09-26d** (**W-28 — a colour dropped on a LOCKED box is refused.** Found by the `appDocumentEditor.html` robot run (report-20260926-1950): the drop repainted a 🔒 box that every other tool leaves alone. It now keeps its colour, a _This item is locked_ toast says why, and nothing is added. Verified live 2026-09-26 on the dev editor; an unlocked box still repaints. ED-43.)

Previous: **workflowsVersion: 2026-09-26c** (**W-14 — the Bible Note window stops saving
itself and gains the editing control.** Reported as a note that would not open:
the `bible-note` editor autosaves continuously and saves whatever state it is
in, so a cleared editor reached the note file as a root with no children --
which Lexical then REFUSES to load back (`Minified Lexical error #38`), leaving
the window blank for good. Typing now lands in that note file's editing history
instead, and **[en:tran:Undo Saved Change]** / **[en:tran:Redo Saved Change]** /
**[en:tran:Discard changed]** / **[en:tran:Save]** sit at the bottom right of
the window, the same control the slide document and lyric editors carry. A note
closed with unsaved text comes back holding it. Proven live 2026-09-26: one word
of typing left the 304KB note file untouched and cost ONE 49KB history entry --
against 10 entries of 608KB before the writes were debounced and the file
indented. PU-03.)

Previous: **workflowsVersion: 2026-09-26b** (**W-16, W-34 and W-35 reconciled with the live Settings UI.** Clear All Settings is confirmed before it clears; Other General Options includes the Daily Tips switch; the Bible tab documents XML import/edit and Bible Data archives; deleting an XML also removes its cache; and SongSelect uses unique coverage ID ST-57 while Repair Links remains ST-52.)

Previous: **workflowsVersion: 2026-09-26a** (**W-42 and W-46 — the Reader gains seven more
working zero-model demos, and broader Tips.** The empty Reader assistant now
offers 30 deterministic practice choices: the added choices type a complete
reference, remove one reference part, toggle automatic Bible audio, filter or
sort notes, and open Settings or Help. All Tips now has 61 Reader lessons,
including whole-panel and separate saved-Bibles/Bible-Notes visibility
guidance; those three stay self-guided because live testing proved an open pane
is a labeled container, not a pressable toggle. The old no-op whole-panel shelf
entry was retired, so the shelf grows by six while gaining seven working
actions. Thirty lessons begin with a safe action.
CB-77 and GL-25 expanded.)

Previous: **workflowsVersion: 2026-09-26** (**W-46 — the automatic Tip of the Day waits five minutes.**
Reported with a picture of the card over the Presenter's top-right controls at launch:
_"Tip of the Day should be delay at least 5 minutes at app launch"_. The card now
appears five minutes after the app starts, counted from the launch, so a reload or a
Presenter/Reader switch does not restart the wait; **Help → Tips of the Day** is not
delayed, and a tip opened from Help stands in for that launch's automatic one. GL-25
expanded.)

Previous: **workflowsVersion: 2026-09-25h** (**W-09 — a session's _Properties_ act on that session's OWN overlay.** Reported straight after the strip landed: _"each session should have its own properties"_ / _"`Properties` should be controlled per session"_. The values were already filed per session, and the panel already showed the right ones — what leaked was the live restyle: the refresh walked every overlay of that kind, so nudging Session 2's size or colour re-dressed the countdown Default had on the wall. It now walks only the entries that session owns. The Hide row is deliberately left alone: it reaches whatever is live from whichever session is in front, because there must always be a way to take something off a projector. Proven live 2026-09-25 by reading the screen's own saved style — Default's overlay held `opacity: 0.91` through a change to Session 2's, and followed a change to Default's. PM-146.)

Previous: **workflowsVersion: 2026-09-25g** (**W-09 — EVERY foreground component keeps sessions now, not only the four that show a file.** Asked for directly, pointing at the **[en:tran:Video Show]** panel's own **Default / ＋** strip and circling the components in the launcher menu: _"I like the idea of multiple session, add this feature in the highlighted components"_. **[en:tran:Messages]**, **[en:tran:Marquee Top]**, **[en:tran:Marquee Bottom]**, **[en:tran:Quick Text]**, **[en:tran:Countdown]**, **[en:tran:Stopwatch]** and **[en:tran:Time]** now carry the same strip, each session holding that panel's own words or numbers AND its own _Properties_ — so the pre-service notice board and the mid-service alert sit side by side, already the right size in the right corner, instead of one being retyped over the other. **Default** still writes the very keys the widget always has, so nothing already set up moves. Verified live 2026-09-25 on the presenter: a second Messages session written to its own keys with Default's two editors untouched, both sessions' messages on one screen at once with each one's own Hide button, and the **[en:tran:Marquee Bottom]** slot handed from Session 2 back to Default with the on-screen dot moving with it. PM-146, PM-147.)

Previous: **workflowsVersion: 2026-09-25f** (**W-08 — every background media tab keeps FOLDER SESSIONS.** Asked for directly, from the foreground **[en:tran:Image Show]** widget that already had them: _"I want this feature for Background Image, Background Video and Background Web… let user feel convenience to handle medias in different folders without changing the default selection"_, then Background Audio too. **[en:tran:Images]**, **[en:tran:Videos]**, **[en:tran:Webs]** and **[en:tran:Audios]** now carry the same **Default / ＋** strip, each session holding its own folder, view mode, sort and slide show, with **Default** still the folder Path Settings names. The strip and the slide show share ONE short row — the rail is the height of the slide-show pill now, in the foreground widgets too, which gives a 200px panel back most of a row of pictures. Verified live 2026-09-25 on the presenter: a second Images session written to its own folder key with Default's untouched, the strip surviving an empty folder, and the foreground widgets unchanged. PM-144, PM-145.)

Previous: **workflowsVersion: 2026-09-25e** (**W-15 — a canvas box can cast a **[en:tran:Shadow]**, and there are two kinds.** Asked for directly. It sits under **[en:tran:Shape Properties]** with Glass Effect, Round and Blend Mode. **[en:tran:Box Shadow]** is the shadow of the box itself, rounded corners included — right for a text box with a backing colour; **[en:tran:Drop Shadow]** follows what is actually painted, so it hugs the letters of a box with no backing and the cut-out edge of a logo picture. How far it falls (**X:** / **Y:**), how soft it is (**[en:tran:Blur:]**) and its colour are shown only once a shadow is picked; **[en:tran:No Shadow]** takes it off again and leaves nothing behind. Verified live 2026-09-25 in the Document Editor on a text box: the box shadow a slab under the box, the drop shadow the ghosted words, both the same in the canvas and in the slide thumbnail. ED-48.)

Previous: **workflowsVersion: 2026-09-25d** (**W-09 and W-47 — an overlay is DRESSED under
[en:tran:Effects].** Reported with a picture of the Messages panel: the words in a
message sat hard against the edge of their own coloured box, and nothing in
_Properties_ could move them. Every foreground component now carries an
**[en:tran:Effects]** fold holding a **[en:tran:Border]**, a
**[en:tran:Shadow]** and **[en:tran:Padding]** — and, wherever the component
shows words, **[en:tran:Text Align]**, **[en:tran:Line Height]**,
**[en:tran:Letter Spacing]**, a **[en:tran:Text Shadow]** (Soft / Glow /
Outline, for a notice over a moving video) and **[en:tran:Text Style]**. Padding
and the text measures are in text sizes, so a box keeps its shape when the font
size changes; stacked messages now count the padding and the frame, so they still
sit one under another. Verified live 2026-09-25 on the dev Presenter and its real
output window, in English and in Khmer.)

Previous: **workflowsVersion: 2026-09-25c** (**W-47 — Messages is a session of message
editors.** It shipped as two widgets (Alert, Announcements), was merged on
sight, and the merged one was still one text box where a message could not span
lines. Each message now has its OWN editor with its own show / move / remove,
a message can be as many lines as it needs, several can be on a screen at once
and they stack instead of covering each other, and
**[en:tran:Show All Messages]** puts the whole session up — as one block, or
one at a time with **[en:tran:Rotate]**. The edge Mask (since removed) was unchanged.
Verified live 2026-09-25 on the dev Presenter and its real output window: two
multi-line messages up together, laid out one under the other; hide and
re-show; and the bars covering a full-screen video overlay. Not
keystroke-verified: the **F4** toggle, which is code only.)

Previous: **workflowsVersion: 2026-09-24d** (**W-46 — native-menu learning now covers every
menu from File through Help.** Presenter grows from 56 to 61 lessons and Reader
from 49 to 54. Five searchable, self-guided overviews name every command under
**File**, **Edit**, **Tools**, **Window**, and **Help**; the seven detailed
**View** lessons remain. Conditional and macOS-only commands are included. GL-25
expanded.)

Previous: **workflowsVersion: 2026-09-24c** (**W-15 — every canvas item kind carries a
[en:tran:Blend Mode].** It sits under **[en:tran:Shape Properties]** in the item's
**[en:tran:Properties]**, beside Glass Effect and Round, and offers the same modes the
foreground widgets do. It blends with the canvas items UNDER IT IN THE SAME SLIDE, not
with the background attached to the slide: a lone blended box shows no change at all,
so the recipe says to put a picture or video box behind it sized **[en:tran:Full]**.
Verified live 2026-09-24 on two overlapping boxes with **[en:tran:Difference]**.
ED-47.)

Previous: **workflowsVersion: 2026-09-24b** (**W-09 — the component panel is just the component,
and the menu is the status board.** No card header inside a panel any more: the floating
panel's own bar already carries the name, the on-screen mark and Close, and the panel is
now the ONE scroller, so the file grid fills it instead of stopping half way with the
slide-show bar floating over the last row. That bar moved INTO the sticky row beside the
sessions, _Properties_ and the screen buttons; **[en:tran:Start Slide Show]**,
**[en:tran:Stop Slide Show]** and **[en:tran:Hide Slide Show Controls]** are named
controls now rather than unnamed icons. Each session button carries its own on-screen dot
and a ▶ while its show runs; the chooser menu carries the **screen numbers** and the same
▶, and a row answers to its component's exact name. Removing a session takes its overlay
off the screens first. The slide show no longer scrolls the file list under you.
Verified live 2026-09-24. PM-128..PM-131.)

Previous: **workflowsVersion: 2026-09-24a** (**W-09 — the Foreground is a menu of components, each
in its own panel.** The Foreground tab now opens a context menu AT THE CURSOR; a picked
component opens in its own floating panel that remembers size and place, and several can
be open at once. `Background Images Slide Show` is gone -- **Image Show** does that job
on the foreground layer. Every component gained **Always on Top** with a z-index number.
Verified live 2026-09-24. PM-128..PM-131.)

Previous: **workflowsVersion: 2026-09-24** (**W-09 — Video Show and Image Show, sessions, and a
blend mode for every foreground overlay.** Two new Foreground widgets put a clip or a
picture OVER the slide, and Web Show joins them on the same shape: the Background tabs'
WINDOWED grid (a folder of 3 058 files mounts ~54 tiles), ONE Properties panel per
widget, and **sessions** — each its own folder, Properties and slide show, so one Image
Show can run a slide show over one folder while another holds a logo from another, both
on screen. A session's slide show runs OUTSIDE React, so it keeps going while another
session is being looked at and stops itself when its item is cleared. Video, Image,
Camera and Web Show gained a **Blend Mode** picker offering all 16 CSS blends, grouped:
a snow clip shot on black is shown with **Screen Blend** and only the snow lands over
the live slide. Verified live 2026-09-24 on the real `screen.html?screenId=1` output —
the clip's band let the slide text show through, lightened, instead of covering it.
PM-128..PM-131 new.)

Previous: **workflowsVersion: 2026-09-23e** (**W-46 — Presenter Show it is resilient and
actionable.** Fifty-one of 56 lessons begin with a safe **Do it**; mixed lessons
then switch to **Next**, and stale long-running MCP catalogs receive the current
lesson inline instead of failing. Five disruptive/native-menu-only lessons stay
self-guided. GL-25 expanded.)

Previous: **workflowsVersion: 2026-09-23d** (**W-46 — the Presenter learning library now
covers 56 topics.** Twenty-four deterministic walkthroughs point at safe app
controls; 32 self-guided lessons cover presenting, screens, backgrounds and
media, service planning, help, and every native View command without changing
congregation output or running disruptive menu actions. GL-25 expanded.)

Previous: **workflowsVersion: 2026-09-23c** (**W-46 — automatic Tips of the Day can be restored from Settings.**
After **Don't show again**, open **Settings → General → Other General Options** and turn
on **Show Tips of the Day automatically**. The shared Presenter/Reader setting takes
effect on the next app launch. GL-25 expanded.)

Previous: **workflowsVersion: 2026-09-23b** (**W-45 expanded — every visible lyric stage can
now be exported as its own PowerPoint file.** Select a lyric, open the Stage Previewer
header menu, and choose **Export to PPTX**; the app writes one deck per visible stage,
preserving that stage's layout and style. Verified live 2026-09-23 with Stage 0 and
Stage 1: both nine-slide packages opened without repair and retained their distinct
lyric/chord layouts. PL-106 expanded.)

Previous: **workflowsVersion: 2026-09-23a** (**W-46 — the Reader learning library now
covers 49 topics across the complete page and native View menu.** Search and
topic labels keep the expanded catalog navigable; the original 24 safe demos
remain featured in the Assistant, while the additional lessons cover reference
shortcuts and history, passage/version actions, study results, names, graphs,
resources, verse marks, Reader header tools and every View command. Reload,
Relaunch and Developer Tools remain available in All tips but are excluded from
the random daily suggestion. GL-25 expanded.)

Previous: **workflowsVersion: 2026-09-23** (**W-42 step 6 — the Reader's zero-model
practice shelf now covers 24 important jobs.** Twenty more checked-in demos add
passage history, reference clearing, names and places, side-by-side reading,
full view, copy/split/save, scrolling, line layout, advanced study views,
filtered search and the Bibles/Notes side panel. Each remains inside
`reader.html`, starts without a provider call, and performs at most one visible
action per **Do it** press. CB-77 expanded.)

Previous: **workflowsVersion: 2026-09-22a** (**W-11 — hidden Reader controls are opened by
clicking the visible **⋯** at the bottom-left before the user is sent to a slider or
button that is not yet on screen. Verified live with the Font Size control and the
chatbot's two-press Do path. New CB-76.)

Previous: **workflowsVersion: 2026-09-22** (**W-11 and W-42 — Reader help now starts with the
plain questions and mouse controls an older, non-technical reader is likely to use.**
The Reader's four opening questions ask where to type a reference, how to enlarge the
words, how to return to a lost passage and how to put two Bibles beside each other.
W-11 names the exact controls and their positions, so those everyday phrases reach a
short useful answer instead of the chatbot's own page or Settings. Verified live
2026-09-22 on the dev Reader: `John 3:16` opened from the **Bible Reference** box,
**Font Size** was at the bottom left, and **Add Extra Bible** opened the installed
versions. New CB-73.)

Previous: **workflowsVersion: 2026-09-21a** (**new W-45 — Save a slide document as a PowerPoint
file (Export to PPTX).** Asked for by the user with a picture of a slide document's
menu in the Documents list: _add `Export to PPTX` for the AppDocument slides_, then
_make sure the exported pptx slide look closely identical to the app slide_. The menu
of an Open Worship slide document gains **Export to PPTX** under **Export**. The slide
is drawn the way a screen draws it and read back, so the file keeps the words as
editable text broken where the screen breaks them, in the font the screen really used,
with the boxes, pictures, background, speaker notes and hidden slides. Verified live
2026-09-21 on five documents, each slide opened in PowerPoint 16 and compared with a
1:1 render of the screen: text within 0–3px, shapes and pictures exact. New PL-106.)

Previous: **workflowsVersion: 2026-09-21** (**W-37 step 6 — a PDF previews in the app.** Asked for by
the user, with a picture of the Documents list's menu: _add Preview PDF to pdf item's contextmenu
in Resources_, then _make the click (only for pdf) to preview the pdf_. A `.pdf` row in
Resources now opens the same PDF viewer window the Documents list's **Preview PDF** does, on a
click and from its menu; **Open** still hands it to the computer's own PDF reader. Verified live
2026-09-21 on `GEN.1.pdf` in the Reader: the menu lists **Preview PDF** first, and both it and
a plain click open `GEN.1.pdf?uuid=GEN.1.pdf` with its 4 pages drawn.)

Previous: **workflowsVersion: 2026-09-19a** (**W-16 step 2 — Repair Links.** From `/owa-enhance
reliability` (`EN-33`), the user's ask: _my data portable and supported on both Windows and
POSIX_. A data folder carried between computers still held links naming where it used to be —
files saved before `$DATA_DIR_PATH` existed, or while the folder lived elsewhere — and those
pictures and videos showed as missing. **Repair Links**, in the Child Directories header of
Path Settings, points every such link at the folder where it is now, and only a link whose
own path is gone and whose file exists here. Verified live 2026-09-19 on the dev data folder:
_Links repaired: 381. Files changed: 127._ for the lyric backgrounds and their editing history
written on a Mac, then 6 more in 4 files (folder links); no old path left, every file still
parses, the Documents folder kept in another folder untouched, and every window reloaded with
no errors. The rest of that change — a missing data folder named at start-up with Retry, one
on a new drive letter found by itself, a new computer offered one found on a drive, the
permanent-delete question on a USB stick, file names checked for every OS — is in
`coverage-matrix.md` as rows still to be seen live, not as steps here.)

Previous: **workflowsVersion: 2026-09-19** (**W-25 steps 2 and 5 — the backup carries the Resources
folder.** Asked for by the user: _add `$DATA_DIR_PATH/resources` part of export/import data as
well_. **Export Data** lists a **Resources** row, the app-managed `<data folder>/resources`
where the Resources panel's **Copy to Data Directory** puts a folder, and archives ALL of it,
sub-folders included. **Import Data** puts it back and adds each folder it restored to the
Resources panel's list — the list is a setting, not data, so on a new machine the files would
otherwise land and show nowhere. A folder only LISTED in the panel from elsewhere on the disk is
not carried. Verified live 2026-09-19 on the dev data folder: the row shown ticked with its path;
a Resources-only export held all 1 321 files and a manifest naming `app-dir-resources`;
importing it back reported `Imported 0 file(s); 1321 already up to date` with no `(1)` copies
and the list untouched; an archive holding a new sub-folder imported 1 file, added that folder
to the list, and the panel drew it as its own group after Reload.)

Previous: **workflowsVersion: 2026-09-18a** (**W-31 step 7 — the divider's arrows say what they do.** From
`/owa-enhance ui` (`EN-21`): the two small arrows on a hovered divider were titled _Disable left_ /
_Disable right_ — in English in every language, and wrong in English too, since they collapse a panel
and disable nothing. They read **Collapse left panel** / **Collapse right panel** (top / bottom on a
horizontal divider) now, in the window's language. They are deliberately NOT the menu's own words, so
the app's tools do not find a hover-only arrow where a walkthrough means the menu item. In the same
change the Reader's lookup history chips, verse numbers, Tab hint and split button and the Mini
Screen card's `Screen: N` title stopped being English in a Khmer window. Verified live 2026-09-18 in
English and in Khmer: all four arrow names on the Presenter's dividers in English and the left one in
Khmer, the Khmer tooltip on all 20 history chips and on the verse numbers, no console error, the
language restored after.)

Previous: **workflowsVersion: 2026-09-17g** (**W-38 step 11 — a Mermaid diagram opens in the Mermaid Live Editor.**
Asked for by the user with the three Mermaid rows circled in a picture: _as a user I want to be able to
open each copy mermaid diagram string in mermaid live editor directly_. Copying a diagram is only half of
what a diagram is for, and nothing on an ordinary machine draws one but this app's own markdown preview.
**Open in Mermaid Live** sits under a divider at the foot of the 📋 menu and opens a second menu with the
three Mermaid shapes named plainly; DOT and PlantUML are not there because that editor draws neither. The
whole diagram rides in the link's FRAGMENT, which a browser never sends to a server, so nothing about the
records leaves the machine. Verified live 2026-09-17 on David's graph: the row drew unclipped, Chrome
opened the editor, and the link read back showed it holding this app's own diagram, Khmer names intact.)

Previous: **workflowsVersion: 2026-09-17f** (**W-38 step 10 — FIVE diagram languages, not one.** Asked for by
the user: _add variety of diagrams, so this will let user to have more options to see many format of
diagrams they want_. The copy menu now offers the Markdown document plus Mermaid flowchart across,
Mermaid flowchart down, Mermaid mindmap, Graphviz DOT and PlantUML — which one is right depends on
what it is being pasted into, and that is not a question the app can answer for anyone. The rows are
named SHORT because a context menu here is 210px and clipped the first pair to two identical
`Copy as Mermaid Flowchar…` lines; the full name is on the hover and on the toast. Verified live
2026-09-17 on Jacob's graph: the six rows read distinctly, and all three Mermaid shapes render in the
app's own markdown preview (the mindmap as a branching tree around Jacob).)

Previous: **workflowsVersion: 2026-09-17e** (**W-38 step 10 — the Markdown copy CARRIES the diagram.** Asked
for by the user right after the first cut: _the markdown should include mermaid `mermaid ... ` for
the diagram_. The document now opens on a `## Diagram` section holding the drawing in a `mermaid`
fence, ahead of the tables, so pasting the Markdown anywhere that renders it brings the picture along;
**Copy as Mermaid Diagram** stays for handing the drawing alone to something that wants only that.
Verified live 2026-09-17: David's 38-box graph copied as ~12.5KB and rendered — heading, summary,
drawn diagram, then the tables — in the app's own markdown preview.)

Previous: **workflowsVersion: 2026-09-17d** (**W-38 step 10 — the connection graph copies as Markdown or as a
Mermaid diagram.** Asked for by the user with the spot circled in a picture: _in name/location-name lookup
graph preview, I want a copy icon, when click the icon it show contextmenu of `Copy as Markdown` and
`Copy as Mermaid Diagram`_. A clipboard button now sits left of the signpost icon and opens those two
items. The Markdown is the records as a table with the centre marked, the connections grouped by kind
with the gendered relation word, and the verses each record cites; the Mermaid is a `flowchart LR` whose
boxes carry the canvas's own per-kind colour. Record wording follows the lookup language, the document
furniture stays English, and both are built from the same visible boxes the saved picture uses. Verified
live 2026-09-17 on the dev reader: David's graph at 29 boxes copied as ~7.6KB of Markdown and as a
diagram that renders in the app's own markdown preview. New RD-121.)

Previous: **workflowsVersion: 2026-09-17c** (**W-37 step 8 — put files INTO a Resources folder with Add Files.**
Asked for by the user with a picture of a group's menu circled: _as a user I want to be able to copy one or
more files to the resources selected folder… add `Add Files` to select files to copy to the folder._ The
group menu now has **Add Files** under **Add Folder**: pick one or several files and they are copied into
that folder, the originals untouched. Nothing is overwritten — a name the folder already holds gets ` (1)`
— a file already sitting there is left alone rather than copied beside itself, and the group re-reads
itself and opens if it was folded. A copied file that the list cannot draw (named after no chapter, with
**Others** unticked) is SAID so in the note rather than landing in silence. Verified live 2026-09-17 on the
dev reader: the item sits between **Add Folder** and **Reveal in File Explorer**; a `GEN.1.claude-check.txt`
picked into the `Document` group appeared under `GEN.1.*` by itself, the same file picked again landed as
`GEN.1.claude-check (1).txt` beside it with the toast **Add Files — 1 file copied**, and both were removed
again. New RD-120; RD-87 amended.)

Previous: **workflowsVersion: 2026-09-17b** (**W-37 step 6 — a note file shows its highlights and comments, and a
markdown file its own HTML.** Asked for by the user the same day, twice: with a picture of the Bible Notes
panel, _it should have all like highlight and comments as well_, and with the README selected, _the
markdown preview should be rendered_. A `.own` row now lists everything the Bible Notes panel lists — its
notes, and each marked verse with its highlights in their colour and its comments underlined — and a mark
opens its verse beside the reading. The preview draws the HTML a README is written in (a centred picture, a
fold-away section, badges) with anything that could run taken out, and the step says why a file saved with
its markdown escaped shows the characters as written. Verified live 2026-09-17 on the dev reader:
`GEN.1.own` listed ccc2, Sunday May 31 2026, test, Unnamed, then _(KJV) Genesis 22:2_ (_and offer_
underlined, _testing comment_), _(KJV) Genesis 22:1_ (_pass after_ in pink) and _(KJV) Genesis 4:1_; two
verses folded to a count of 1; pressing _and she conceived_ opened Genesis 4:1 as another view with both
marks painted, and the file's MD5 and timestamp were unchanged; the app's own `README.md` rendered its
badges, centred screenshot, table of contents (a press scrolled to _Tech Stack_), contributors table and a
closed _Fedora Dependencies_ section; the user's `GEN.1.md`, saved with `\#` and `\*\*` escapes, showed
those characters as written.)

Previous: **workflowsVersion: 2026-09-17a** (**W-37 step 6 — a markdown file and a bible note file open inside the app.**
Asked for by the user with two pictures (a `GEN.1.md` and a `GEN.1.own` circled in Resources, and the
Bible Notes panel): _Resources should support in app preview for markdown file and Bible-note file… open
bible-note preview should be read-only, open markdown-file should popup like bible-note and render the
markdown. If possible add Mermaid diagram support._ A `.md` opens a **Markdown Preview** window (tables,
code, pictures beside the file, Mermaid diagrams; follows the file as it is saved; links to headings, to
other `.md` files with Back, and to the web); a `.own` row opens onto its notes, and a note opens in the
Bible Note window read-only. Verified live 2026-09-17 on the dev reader: `GEN.1.md` opened the preview; a
scratch document drew a flowchart and a sequence diagram, reported a broken one above its code, scrolled
to a heading, opened a linked `.md` with Back, and updated when the file was saved; `GEN.1.own` listed its
four notes and not its three verse marks, and **ccc2** opened with _(Read-only)_ in its title and a locked
editor, and pressing the editor's Undo left the file byte-identical on disk.)

Previous: **workflowsVersion: 2026-09-16a** (**W-37 step 8 — copy a Resources folder into the data folder.**
Asked for by the user with a picture of a Resources group's menu: _as a user I want to be able to move
selected folder in Resources to under selected-dir so I can manage it easily_, and then _after copied
then change the selection to the copied one_. A group's menu now has **Copy to Data Directory**
between **Reveal in File Explorer** and **Remove Folder**. It asks first, naming the folder and the
`resources` folder inside the data folder it goes to; then copies the whole folder there, sub-folders
and all, and the group switches to the copy in the same place, folded or open as it was. The original
stays on disk. A name already taken gets ` (1)`; a folder that is already a copy is not offered the
item; a folder holding the data folder itself is refused before anything is asked, since it would be copied
into itself. Verified live 2026-09-16 on the dev reader: the item and its confirm on a scratch folder, and the
refusal on a Desktop group holding the data folder. Not seen live: the copy after **Yes**, which an agent may
not press — unit-tested on a real folder tree.)

Previous: **workflowsVersion: 2026-09-15c** (**W-16 — a font's weights are listed beside it.**
Asked for by the user with a picture of the Slide Editor's font box: the font list came from a
package that could name a font but not its weights, so the weight list beside it never appeared.
The app now reads each installed font's real weights itself, and the list appears whenever the
chosen font ships more than one (`400 Regular`, `700 Bold`, `900 Black` for Arial), with
**Default** leaving the font's own weight. Settings, the Slide Editor and the Foreground widgets
share that one picker. Verified live 2026-09-15 on the dev Slide Editor: a text box in Arial
offered Default, 400 Regular, 700 Bold and 900 Black, 700 Bold thickened the text on the canvas and
its thumbnail, and Undo put it back. Not seen live in the Settings card itself.)

Previous: **workflowsVersion: 2026-09-15b** (**W-37 step 5 — tick Others to see every file that is not named after a chapter.**
Asked for by the user with a picture of the panel: _I want to be able to see others non related to
`<book>.<chapter>.*` files so I don't have to do search for those files_. A picture, a map or a handout
kept in the same folders as the chapter files could only be reached by typing part of its name. A box
marked **Others** now sits beside the magnifier; ticked, each folder also lists every file whose name is
not a book and chapter, under an **Others** heading after everything else, up to 200 a folder, and it
stays ticked next time. Verified live 2026-09-15 on the dev reader: ticking it listed a general folder's
files under **Others** while the two chapter-named folders beside it did not change, nothing appeared in
the console, and unticking it put the lists back.)

Previous: **workflowsVersion: 2026-09-15a** (**W-37 step 4 — Resources looks two folder levels down, not eight.**
Asked for by the user with a picture of the panel: a group for their whole home folder said **No
matching files** and **Too many folders to search**, and they asked for the search to stay near the
top. It had walked eight levels deep, and a home folder is mostly other programs' folders, so the walk
used up its whole allowance there and found nothing. Now each group reads its folder and the two levels
of folders under it and stops. Measured on that home folder: 64 folders read and the walk finishes, where
four levels or more ran out at 1 500. Verified live 2026-09-15 on the dev reader: the home-folder group
says **No matching files** with no warning, and the other groups still list their `GEN.4.pdf`,
`GEN.0.pdf` and `GEN.0.json` links. RD-84, RD-89 and RD-114 amended.)

Previous: **workflowsVersion: 2026-09-14c** (**W-44 step 6 — a link opens only when you pressed it, and the boxed site cannot reach this computer by any route.**
Security work, not a report. Measured from inside a live site: a page in the AI Chat window could
open your normal browser on its own, with nothing pressed, as often as it liked; and a WebSocket —
the kind of connection a live chat uses — could reach programs on this computer such as OBS or a
presentation remote, which ordinary web requests from the site already could not. Now your browser
is handed a page only right after you press something in the site, one page per press; a page that
tries anyway is not opened, and a line under the row above the page says so. And WebSockets are held
to the same wall as everything else, while the sites' own live connections still work. Verified live
2026-09-14 on the dev window: 43 checks held. CB-68 extended.)

Previous: **workflowsVersion: 2026-09-14b** (**W-44 step 6 — a site may ask for the microphone.**
Reported by the user with a picture of Claude's dictation button under _Microphone access is
blocked_ in the AI Chat window, whose advice points at a browser address bar the window does
not have. Pressing a site's microphone button now puts a line under the row above the page
asking to allow it, with **Don't allow** already selected; a yes is for that one site, lasts
until the app closes, and only counts while its tab is in front. Verified live 2026-09-14 on
the dev app with Claude's own **Dictate**: the line appeared, **Don't allow** and Escape kept
the microphone off, **Allow** let the site hear, and the same site behind another tab was
refused.)

Previous: **workflowsVersion: 2026-09-14a** (**W-42 step 13 — an assistant with no key can be chosen,
and choosing it opens its key box.** Asked for by the user with a picture of the help
window's assistant list open on **Kimi — needs an API key**, greyed out: the row said what
was missing and could not be pressed. It is in the list in a quieter colour now; choosing it
keeps the conversation on the assistant it had and opens **Settings** on **Others** with the
cursor in that assistant's key box, and a **Settings** window that is already open comes to
the front and turns to **Others** rather than a second one opening. Verified live 2026-09-14
on the dev app: with **Settings** closed the cursor was in **Kimi API Key** under a second
after the choice, and with **Settings** open on **General** the same window came forward on
**Others** with the cursor in the box.)

Previous: **workflowsVersion: 2026-09-12e** (**W-42 step 14 — on a Mac, the help window steps aside
ALONE.** Reported by the user with a picture from macOS: pressing **Do it for me**
minimised every window of the app, the presenter included, and closing the card brought
nothing back. The help window is a child of the app window, and a Mac cannot minimise a
child window on its own, so it took the app down with it. It now leaves the app window
first and rejoins it when it comes back. The step says the Dock as well as the taskbar,
and that the app itself stays on screen. Verified live 2026-09-12 on the dev app off the
OS window list: the help window alone went to the Dock and came back when the walkthrough
stopped, the presenter on screen throughout.)

Previous: **workflowsVersion: 2026-09-12d** (**W-30 step 1 — the view is picked by its NAME, and
there are four of them.** Found by a robot-test pass, not reported: the step said the
drop-down lists _three views_ and told the reader to _pick the third one_, and the live
list has had four since Resources joined it — so the third one is now the wrong view.
An ordinal is what drifted, so the step no longer uses one: it names all four and says
to pick **Location-Name (KJV)** by its name, which cannot go stale when a fifth view is
added. Verified live 2026-09-12 on the dev reader. RD-drift.)

Previous: **workflowsVersion: 2026-09-12c** (**W-37 step 3 — a folder can be dragged into Resources.**
Asked for by the user with a picture of the panel: _as a user I want to do drag/drop folder
to do folder adding_. Adding a shelf meant the button and the picker dialog, which is the
long way round when the folder is already open in front of you in Explorer. Dropping one
anywhere on the view now adds it — the view outlines itself and its top line says **Drop
folders here** while a folder is held over it — and several at once is one drop. A dropped
FILE is refused in words rather than being read as "add the folder it sits in": that parent
is as often the whole Downloads folder as it is a library, and Resources walks what it is
given eight levels deep. A folder already on the list says so instead of appearing to do
nothing. Verified live 2026-09-12 on the dev reader: the drop added the folder and listed
its `GEN.4.pdf` and book-level `GEN.0.notes.pdf` under Genesis 4, the second drop of the
same folder said **Folder is already added**, and a dropped `.pdf` said **Drop a folder, not
a file** and shelved nothing. New RD-114.)

Previous: **workflowsVersion: 2026-09-12b** (**W-37 step 7 — a `.json` beside the verse is a list of links you can click.** Asked for by the user with a picture of the Resources panel: a `GEN.0.json` in their own YouTube folder drawn with the "unknown file" diamond, and a whole library of `<BOOK>.0.json` files behind it holding a title and a YouTube address per video. Opening one in a text editor is not what anybody wants from it, so the panel now reads it: each entry's **title** is a row you press, and pressing it opens that address in the computer's own web browser. The shape is the one their files already had -- a list of `{ "title": ..., "url": ... }` -- with a bare address on its own allowed as a shorthand. **A `.json` that is not that is still just a file**: the panel tries the content, and anything it cannot read as links keeps the ordinary icon and opens in whatever application the machine uses for it, with no error and nothing to dismiss. Only `http` and `https` addresses are offered, because opening an address hands it to the desktop, which would launch whatever program has claimed some other scheme. Verified live 2026-09-12 on the dev reader: their own `GEN.0.json` listed three Khmer video titles, a probe file with a bad entry listed its two good rows and said **1 entry was not understood**, a probe holding ordinary data stayed an ordinary file row, and a press on a title opened the video in Chrome. New RD-115.)

Previous: **workflowsVersion: 2026-09-12a** (**W-44 steps 3 and 7 — Sign out of every site, and the boxed site can no longer reach this computer at all.** Security work, not a report. The window keeps you signed in on purpose — that is why it exists rather than a browser tab — and on a shared church computer that means the volunteer who opened ChatGPT before the service is still signed in for whoever sits down after it; closing every tab never touched it. There is now a **Sign out of every site** in the row above the page (**↤**) and in words on the card, it asks before it acts with _Keep me signed in_ already selected, and it takes the pages the tabs were on and the names the sites gave them — the previous person's conversation titles — while leaving any name you typed yourself. And the box got its fifth wall: measured from inside a live site, a page in this window could not READ anything on this computer, but it could still SEND a request to it, including to the app's own two doors — so the boxed site is now refused every address on this machine and its network (the router, a printer, a NAS, and loopback written any of the five ways that defeat a naive check) while the site's own pages are untouched. Verified live 2026-09-12 on the dev window: 33 checks held, the site still loaded and signed in. CB-68 extended.)

Previous: **workflowsVersion: 2026-09-11f** (**W-30 — the names in a Khmer verse are underlined too.** Reported with a picture of the reader showing Genesis 4 in two columns: the King James one underlined **Adam**, **Eve**, **Cain** and **Abel**, the Khmer one beside it underlined nothing, and the panel that lists who is in the passage had been answering for both all along. It is the dictionary that is English, not the feature — so a bible in a language the app ships records for now underlines that language's own spellings and a click opens the same record. A Khmer verse marks a name the dictionary records for that verse or somewhere in its chapter and nothing else, so it marks a little less than the King James column and never guesses; another English version still underlines nothing, because the dictionary was made from King James wording. Verified live 2026-09-11 on the dev reader: `អ័ដាម`, `អេវ៉ា`, `កាអ៊ីន` and `អេបិល` underlined in ពគប Genesis 4, and the Khmer `អេបិល` opened the record **អេបិល (Abel)**. W-29 step 3 and W-30's closing note say so; RD-80 covers it.)

Previous: **workflowsVersion: 2026-09-11e** (**W-06 and W-11 — you can type the whole reference now.** Both recipes told the reader to pick book → chapter → verse in steps because a full `John 3:16` "only filters the book list and the `3:16` is dropped when you pick the book". A robot run typed the reference char-by-char into both lookup surfaces — the header dialog and the Bible Reader page — and both went straight to the verse: `John 3:16` rendered with 16 selected in the chapter strip and Resources switched to `JHN.3`, and `Psalm 23:1`, a control whose words appear nowhere in the saved Bibles list, rendered "The LORD is my shepherd" on both against a clean baseline. The two notes now read as a tip that the step-by-step picking is optional, and the same correction went into the matrix RD-03, knowledge-base §5/§11, test-plan S11 and components-path. Verified live 2026-09-11 on the dev window.)

Previous: **workflowsVersion: 2026-09-11d** (**new W-44 — Chat with an AI website inside the app (AI Chat).** Asked for by the user with a picture of Firefox's AI sidebar: _like firefox, I want an ai chat panel … just open webpage from ai company directly_, with _another icon right next to the chatbot icon_, _deepseek kimi grok chatgpt claude gemini mistral …_ and _tabs for each session like what having in chatbot_. A **✨** button right of the **🤖** on the presenter, the slide editor and the reader (and **Help → AI Chat**, **Tools → AI Chat** everywhere) opens a window beside the app, the same size and place as the help window, on a card listing ten AI chat sites; a press loads that site itself — the user's own account, the site's own sign-in, kept across restarts — in a sandboxed box that can reach nothing on the machine. The tab strip is the help window's own; a tab is named after the page and comes back on its conversation; three tabs keep their site loaded at once and the rest reload on return, because every loaded site is a renderer process of its own. Not gated on **Enable AI features**: no key, no assistant. Verified live 2026-09-11 on the dev window: ChatGPT, Claude, Gemini and DeepSeek opened in four tabs, the fourth unloading the first. New CB-68; W-42 step 1 now places the **🤖** between the gear and the **✨**.)

Previous: **workflowsVersion: 2026-09-11c** (**W-09 and W-42 step 6 — a countdown, clock or scrolling message goes on the screen by its words, asked or by /countdown and /marquee.** Research, not a report: the standing questions held, so the next ask shape was followed through — _Start a 5 minute countdown on the screen_ — and the assistant's "yes" ran to its round cap hunting the Foreground tab's boxes (a toggle it had just closed) and started nothing. The Foreground panel is a form for a person, so the app now starts an extra by its words on the ticked screens and reads them back: one call with an assistant, **/countdown 5** and **/marquee <words>** with none, one offered button with no key. The five **/clear-** commands clear a layer the off screen HOLDS instead of saying there is nothing to clear. Verified live 2026-09-11 on the presenter with Claude Sonnet 5, the countdown read off the screen. New CB-67.)

Previous: **workflowsVersion: 2026-09-11b** (**W-42 step 8 — the auto-hide is gone.** The user, the morning after asking for it: _please remove all auto-hide feature from the chatbot_. The pickers, the credit lines and the ask box stay exactly where they always were; nothing in the help window tucks away on a scroll any more, there is no 📌, and the step's paragraph about it is removed. Verified live 2026-09-11 on the dev window: the head is a plain row again with no strip and no pin.)
Previous: **workflowsVersion: 2026-09-11a** (**W-37 step 1 — the verse context menu no longer offers Open in Resources.** Removed at the user's request; the Resources view is reached from the advanced lookup picker only. Test and matrix row CM-93 retired in the same change.)

Previous: **workflowsVersion: 2026-09-10i** (**W-42 step 6 — `/lyric https://…` writes a song
from a page with no assistant, and a song link is drafted offline.** Measured
2026-09-10: with the assistant paused, _Create a lyric file from https://…_ — the
app's own starter chip — was searched for in the guide and answered with how to make
an EMPTY file; on a live key the same ask drafted the song and created the file in
one breath, 3 rounds and 18 s, and still offered **Create** under _Done!_. Now
`/lyric <address>` reads the page and offers the song in ~3.5 s with no model round,
the built-in guide does the same for the chip's words with no key, and an answer
whose file the assistant already created carries **Show it in the list** and the
file instead of a second **Create**. Verified live 2026-09-10 on the dev window.)

Previous: **workflowsVersion: 2026-09-10h** (**W-37 steps 2 and 4 — Resources follows every
passage you have open, not one selected verse.** Asked for by the user with a
screenshot: three chapters open and the panel on `GEN.24.*` alone. The view no
longer shows a selected-verse block; its top line is one solid pattern chip per open
chapter, in pane order, then one dashed book-level chip per book, and each folder's
files are filed under the pattern they answered to, a book-level file once. The pane
being typed into follows its reference box. Verified live 2026-09-10 in the Bible
Reader on Genesis 24 beside Genesis 27.)

Previous: **2026-09-10g** (**W-42 step 8 — only the rows at the top tuck away; the ask box stays put.** The user, the same day: _I don't want auto-hide for the bottom one_. The pickers and the credit lines still tuck away to a thin strip while you scroll and come back at the top, under the mouse, or for good with the 📌; the ask box with its tip line no longer moves, so the next question can always be typed. Verified live 2026-09-10 on the dev window.)
Previous: **workflowsVersion: 2026-09-10f** (**W-42 step 8 — the rows at the top and the ask box tuck away while you scroll.** Asked for by the user, with a picture of the help window circled: _make those area auto-hide_, then _auto-hide while scrolling_. The three pickers, the CREDIT USED line and the ask box with its tip took 139px of a 630px window — a quarter of the answer out of sight for controls touched once a session. Now scrolling the conversation tucks both away to a thin strip with a grip on it; the mouse at either strip, a picker given the keyboard, anything left in the box, or scrolling back to the top (the pickers) or the bottom (the box) brings them back, and the 📌 at the end of the pickers keeps them in view for good. Verified live 2026-09-10 on the dev window by every rule, the pictures taken with the window in front. New CB-65.)
Previous: **workflowsVersion: 2026-09-10e** (**W-42 step 13 — a provider that cannot answer says what is wrong and carries the door to it.** Asked for by the user: _if there any unusual response from api then give buttons for user to go to the api dashboard_. Measured first on the ChatGPT key that has been out of credit for a week: the note hedged _out of credit or being rate-limited_ with the provider's own body saying `insufficient_quota`, and nothing under it to press. The failure is now read from what the provider said (its documented code or type and its words, not only the status — an empty Anthropic account is a 402 or a 400 saying "credit balance", which the stand-in had never once caught), the note says the one thing it knows, and the first button in the row opens the provider's own billing, keys, limits or status page in the browser — **Open ChatGPT billing**, **Open Claude API keys**, **Open Kimi usage limits** — or the app's AI settings for the Free assistant; the hover shows the address, the press says _Opening … in your browser._ Verified live 2026-09-10 on the presenter through the dead ChatGPT key with Claude standing in. New CB-64.)

Previous: **workflowsVersion: 2026-09-10d** (**W-30 steps 2 and 4 — every open passage is
listed, the pane being edited included.** Reported with a screenshot: two panes open,
**Genesis 29:1-35** in the reference box and **Genesis 27:1-46** under it, and the
**Names and locations in your reading** panel showing only Genesis 27. The pane being
edited was recognised by a marker that survived only a reload from settings; a split
or a retarget rebuilt the list without it, so that pane was listed by the passage it
had when it was LAST selected — here the same Genesis 27 it had been split from, which
then collapsed into one block. It is recognised by its selection now, so the block
follows the reference box, and every block is headed the way the Bibles list names a
reading — `(KJV) Genesis 29:1-35`, the full book name. Verified live 2026-09-10 in the
Bible Reader: both blocks, in pane order, the first following a retyped reference
within about a second and a half.)

Previous: **2026-09-10c** (**W-42 step 8 — a spending limit, and the assistant pauses at it.** Asked for by the user: _I don't want to mistakenly get stuck in an infinite loop of programmatic error that eats all my credit or floods the bill._ Until now the only things between a fault that keeps asking and the bill were the round cap on one question and a person pressing Stop, and a fault is not a person. Now a **LIMIT PER HOUR** picker sits beside CREDIT USED (a dollar an hour to begin with), the figure next to it says what the last hour has cost across every tab and turns amber past four fifths of the cap, and at the cap the assistant PAUSES: the question is answered from this guide instead, with a note saying why and an **Allow more** button that starts the hour again — a button, so a fault cannot press it, and remembered across a restart so a fault cannot reload past it. A fixed pace cap of 150 model calls an hour holds whatever the money cap is set to, which is what protects a free service. **/limit** reads or sets it with no assistant. Verified live 2026-09-10 on the presenter: the cap set to $0.25 with $0.21 already spent, one real question paid one round, was paused on its second and answered from the guide; Allow more re-asked it and Claude answered; 150 seeded calls with the money cap off refused the next question before any round was bought. New CB-63.)

Previous: **workflowsVersion: 2026-09-10b** (**W-42 step 8 — every answer says what it cost, and CREDIT USED totals the chat.** Asked for by the user: _as a user I want to see how many credit used per chat session_. Every model round reports the tokens it used and the window threw the number away, so a volunteer was spending the church's API credit with nothing on screen saying how much. Now the small grey figures at the end of an answer's Copy line say what that answer cost (*≈ $0.02 · 49k tokens*), a **CREDIT USED** line under the three pickers keeps the running total for the tab — counting a stopped or failed question's rounds too — and the hover on either has the sums; the dollars are an estimate from the list price, a free service reads *free*, an unpriced model *price not known*. Measured on the standing twelve questions the same morning: about $0.28 for all twelve on Claude Sonnet 5, every round after the first a cache read. Verified live 2026-09-10 on the presenter, the figures checked against the provider's own usage on the wire. New CB-62.)

Previous: **workflowsVersion: 2026-09-10a** (**W-06 step 7 and W-42 — a Bible passage goes up by its reference, asked in words or by /verse.** Research, not a report: the standing questions held, so the one shape left open was followed through — _Put John 3:16 on the screen_ — and the assistant could only describe the lookup's picker; the **Do it for me** under that answer opened the lookup and stopped where a person types the first letters of the book, the verse lost. The lookup is a picker for a person and no walkthrough can drive it, so the app now presents a passage by its reference through its own parser — the words the volunteer says, in the version the lookup is on — and reads the screen back: the assistant does it in one call and offers the screen's own show button, **/verse John 3:16** does it with no assistant, and with the network cut the guide checks the reference, quotes it and offers one button. Verified live 2026-09-10 on the presenter with Claude Sonnet 5, the passage read off the projector window. New CB-61.)

Previous: **workflowsVersion: 2026-09-09e** (**W-42 step 13 — a key that cannot answer hands the question to another of yours.** Research, not a report: the help window's own default assistant was a ChatGPT key a week out of credit, and every one of the standing twelve questions waited three to five seconds on three identical posts to it and then answered from this guide — with a working Claude key one option along in the row above. Now the next assistant whose key is set answers instead, once and at once, the note says which and why, and the tab moves to it; the dead key is asked once, not three times. The guide's own answers improved where they were measured wrong the same afternoon: _where is the button to change the background_ offered a line of Genesis as the nearest control (it shared the words _to_ and _the_) and now offers **Background**; _how do I edit a slide_ asked from the Bible Reader now opens with the way back to the Presenter before naming the Documents list. Verified live 2026-09-09 on the presenter and the reader, with the dead key and with the network cut. New CB-60.)

Previous: **workflowsVersion: 2026-09-09d** (**new W-43 — Remove a song, document or file (Move to Trash); W-42 step 6 — the assistant knows the RUN SHEET, and /run.** Research, not a report: the standing questions were asked again and the follow-up _and how do I undo that?_ under _How do I add a song?_ took the assistant six lookups and 17 seconds to end on **Delete** — a menu item this app does not have. The manual had no page for removing a file at all; this one names the real item, the confirm, and the Recycle Bin the file goes to, and the assistant's question list carries a question for it. Also: asked _How do I edit a slide?_ from the Bible Reader, the assistant had been starting its steps "in the Documents list", which the Reader has not got — it is now told which panels that page lacks and that the way back is the 🖥️ **Go Back to Presenter** button, and steps written from a search excerpt without opening the page are handed back to it once. And _What's next in my running order?_ — six lookups and an unverified guess about a green mark — is answered from the run sheet itself: which presenting flow is open in its run player, the line the run is on and the slide inside it, and what the next press puts up, in 2 rounds; **/run** says the same with no assistant. Verified live 2026-09-09 on the presenter and the reader with Claude Sonnet 5. New CB-58, CB-59.)

Previous: **workflowsVersion: 2026-09-09c** (**W-42 step 6 — the assistant knows what the user is in the MIDDLE of, and three more commands.** Research, not a report: the standing questions passed, so the other half of the situational rung was asked with the selection deliberately different from what the projector held — and the assistant named the song on the screen when asked which song was SELECTED, and ran to its round cap on _show the next slide_ (the slide cards had no name any tool could see; it pressed a slide's number badge and then said it could not find an answer). The app now tells it which song or document is selected, its slides with their first words, which one is up and which comes next, and every slide card answers to its own name (_Slide 5: …_), so the same asks are two rounds and one press, verified on the wall. **/selected**, **/next** and **/previous** do the same with no assistant. Verified live 2026-09-09 on the presenter with Claude Sonnet 5. New CB-56.)

Previous: **workflowsVersion: 2026-09-09b** (**W-31 steps 7–9 — the divider between two panels has the same menu, and the walkthrough can press it.** Reported with a screenshot: the walkthrough for this page on step 1 of 5 saying to open the View menu, beside a right-click the user had made themselves on a panel divider, open on _Reset Size / Close First Widget / Close Second Widget_ — _"the agent also use contextmenu of the resize"_. The page knew only the View menu, which lives in the menu bar where no walkthrough can press it (and which a popup window does not have), the divider had no name the assistant could find, and the View-menu step itself was being skipped in the Presenter because its example list says _presenter_. Now every divider is named after the two panels it sits between, the recipe says what a right-click, a double-click and a hover on it do, and the walkthrough opens the divider’s own menu, rings the item and chooses it on the next press. Verified live 2026-09-09 on the presenter. New CB-57. Also W-02 step 2 reworded to put the ORDER first — select the document, then click the tab — because the assistant was condensing it into "click the slide document, this opens the Slide Editor".)

Previous: **workflowsVersion: 2026-09-09a** (**W-42 step 6 — the assistant knows what is ON the projector.** Research, not a report: the standing questions passed, so the panic ones were followed through with the projector actually showing a verse — and the assistant said _“turning the screen on just gives you a blank canvas”_ to a screen showing Verse 2, said _“yes, the screen is on”_ with not a word about what, and took eight presses of its own to turn a screen on when asked. The app now tells it what each screen holds — the song and the verse with its first words, the passage, the background, the widgets, the lock — and the words on that screen’s own buttons, so the same questions name the verse on the wall, the _yes_ is one press, and **/screen** and the offline answer say the same with no assistant at all. Verified live 2026-09-09 on the presenter with Claude Sonnet 5. New CB-55.)

Previous: **workflowsVersion: 2026-09-08c** (**W-42 step 15 — Do it presses the button the step names, closes what is in the way first, and reads Next on a step that is only something to notice; W-12 step 1 names the toggle as the app does.** Reported with a screenshot: the Bible Lookup popup open over the Presenter and the walkthrough’s ring drawn through it onto a line of Genesis — _“does not work while modal present”_ — then _“many question fail during Do it”_. Do it was pressed through every step of every recipe (224 presses): 124 refused, and a check of the 92 counted as done found the wrong control pressed in at least ten of them — the projector’s Clear All for the drawing panel’s Clear, the help window opened for a bolded word. Now a control behind a popup, menu or floating panel is closed out of the way on the first press and never a question the app is asking; only a control called what the step says is pressed, a look-alike is named and handed to the assistant; a step that only describes what to see reads Next; and the four tour pages (W-01, W-09, W-10, W-17) that could not start a walkthrough at all now do. Verified live 2026-09-08 on the presenter and reader. New CB-52.)
Previous: **workflowsVersion: 2026-09-08b** (**W-42 steps 18 and 19 — the buttons under a drafted song are the only thing to press, a paste is written out even with no assistant, and a hymnal’s text page reads right.** Asked for from the app with the _Try asking_ chips circled: _“test all questions in the highlight then enhance until everything work smoothly”_. Graded on the assistant the window was set to — Kimi on a free account — the two how-do-I chips passed; under a drafted song the assistant’s own _Create the file_ / _Copy the text_ pills were drawn brighter than the real buttons and pressing one failed after half a minute, and the paste the third chip invites was refused a minute later and searched for in this guide. Now only the real buttons and genuine replies sit under a song; a refused or keyless paste is written out by the app itself in a second or two; and a hymnal’s text page comes out as its numbered stanzas with the title, author and _Public Domain_ off the page’s own table (it was sixteen verses of menus). Verified live 2026-09-08 on the presenter with Kimi K2.6 and Claude Sonnet 5. New CB-51.)
Previous: **workflowsVersion: 2026-09-08a** (**W-42 step 6 — a page is named by its title, never by a code.** Research, not a report: the standing questions asked on Claude, and the where-is one opened with _“W-08 has exactly what you need”_ — a code the assistant is told never to show, written from a search result, and written again when asked after the fix. The code now leaves the search excerpts and, if the assistant writes one anyway, the window replaces it with the page's title before you see it. The offline button has read **Read the whole thing** for some time; this step said **Read all of W-xx**, and now says what is on the screen. And the _“Yes, walk me through it”_ reply that sat beside **Show me step by step** on every multi-step answer — the same press twice — is dropped. Verified live 2026-09-08 on the presenter with Claude Sonnet 5. New CB-50.)

Previous: **workflowsVersion: 2026-09-05b** (**W-42 step 6 — a picked question is a label, not a search.** Measured on all 258 supported questions that name a page of this guide: searched for as typed, the search put that page first for 147 (57%) — so a question picked off the app's own list got the wrong page two times in five, with a paid assistant or without. A question that IS one of the corpus rows (a chip, a suggestion, the More… list) now goes straight to the page it is filed under, on the search itself and as a hint to the assistant, which then opens the page without searching (2 rounds where the free-worded version took 5). The 45 held-out paraphrases are untouched (22 of 45 before and after). And a search hit that merely shares a word — _Can it stream to Facebook?_ scored the Presenter overview 2 — no longer counts as an answer: no walkthrough buttons under an honest "it cannot", no page at all from the offline bot. Verified live 2026-09-03 on the presenter with Claude Sonnet 5 and with a dead key. New CB-49.)

Previous: **workflowsVersion: 2026-09-05a** (**W-42 step 6 — commands that need no assistant.** Asked for from the app: _"looking for a way to do pre-training the local assistant, for some task the chatbot should not ask the llm api"_, then _"add build action like `/presenter-screen-show` `/presenter-screen-hide`"_, _"buildin actions"_, _"so user don't have to ask llm"_. Measured the same afternoon before anything was built: three of the four assistants on the machine answered 429 within the hour (ChatGPT out of credit, Kimi rate-limited from the second question, the free pool after 62 seconds), so the standing question corpus fell through to the offline guide bot, which answered _"Turn off the screen for me"_ with the screen's state and no way to change it, and got 4 of 12 right. The ask box now takes `/` commands — `/screen`, `/screen-show`, `/screen-hide`, the five clears, `/find`, `/goto`, `/here`, `/help`, `/commands` — run through the app's own tools with no model, no key and no internet, each answering with what CHANGED, read back after the press. Typing `/` lists them. Two cheap offline-bot fixes rode along: a how-do-I that mentions the screen is no longer answered with the screen's state, and the window's name is no longer a search word (it made the Presenter overview page outrank the real answer). Verified live 2026-09-02 on the presenter: every command 0 model rounds, about 1.6 s, the screen really on and off. New CB-48.)

Previous: **workflowsVersion: 2026-09-04b** (**W-42 step 6 — the window says what it is doing while it works, the tip line walks, and the four suggestions are no longer all there is.** Asked for from the app with three screenshots: _"chatbot, should log progress and progress information (doing on what)"_, _"should `<-` and `->` for pre next tip"_, and _"should `More...`, when I click it show all list so can know what I can do"_. A question that reads a web page and drafts a song is most of a minute behind one unchanging line — _Looking it up…_ — which cannot tell a window that is working from one that has hung; the wait is now a short LOG of what it is actually doing, in the words a volunteer would use: _Connecting to the app_, _Searching the guide for "background"_, _Reading example.com_, _Creating a new song: "Amazing Grace"_. Finished steps stay above the running one, so it reads as progress rather than as a spinner, and no tool name, path or id can reach it. The 💡 line gained **‹** and **›**, which walk the tips in order and wrap, where pressing the sentence still gives a random one — the arrows are the only way to see them all and the only way back to one that changed while it was half-read. And the four **Try asking** chips gained **More…**, which opens every question the window is prepared for, grouped under the panel each belongs to — 184 of them in the Presenter. Verified live 2026-09-04 on the presenter with Claude Sonnet 5. New CB-47; CB-46 and CB-17 amended.)

Previous: **workflowsVersion: 2026-09-04a** (**W-42 step 6 — the ask box remembers what it has been asked, and a tip sits above it.** Asked for from the app with a screenshot of the chat window: _"chatbot, it should remember asking history, when editing the alt+arrow-up/down should get the text from history"_, then _"show this kind of tip somewhere to let user know any features"_ and _"showing tip randomly, maybe above the input text"_. **Alt+↑** / **Alt+↓** walk back through every question typed into this window — one list for the whole window, kept across tabs and across days, seeded from the conversations already saved — and a press past the newest hands back the half-written question the walk started from. The plain arrows are untouched: they belong to the cursor and to the suggestion list. Above the box, one line with a 💡 names a feature nothing on screen announces — the camera, the walkthrough cards, **Report**, **Alt+↑** itself — a different one each time the window opens, another on a click. Verified live 2026-09-04 on the presenter with Claude: two questions walked back, the empty box handed back, a real ask recorded and recalled, and the tip changing on each press. New CB-46.)

Previous: **workflowsVersion: 2026-09-03a** (**W-10 — the show/hide screen control is named, because "Show" is not its name.** Reported from the app with a screenshot: the assistant was asked _"How do I show a screen?"_, offered to do it, was told _"Yes, turn it on"_, and answered _"Done — the screen is now showing."_ while nothing was on the wall. Four toolbar-reveal decorations in the presenter carried the title **Show**, an exact match that outranked the screen's own control, so the press landed on one of them. Those are now **[en:tran:Reveal Hidden Controls]**, the screen control answers to **[en:tran:Toggle showing screen]** in whatever language the app is showing (it was hardcoded English), and a press now reports what it CHANGED rather than only what it hit. Verified live 2026-09-03. New CB-44.)

Previous: **workflowsVersion: 2026-09-01h** (**W-19 step 1 and W-42 steps 1 and 5 — the annotation overlay and the assistant now belong to EVERY window, and the help window can be asked about any of them.** Asked for from the app: _"add chatbot assistant and presenting-control to all pages except about.html, chatbot.html, finder.html, screen.html"_, then _"have to extend the list to support all question files"_ — the **ASKING ABOUT** list offered only Presenter and Bible Reader while the help was reachable from eight windows. Both features are now mounted on all nine pages by one component, reached by **Tools → Start Controlling** / **Ctrl+Shift+P** and **Tools → App Assistant** / **Ctrl+Shift+A**; the projector, the About box and the Find bar deliberately keep neither. The menu click now goes to the window in FRONT rather than to whichever one registered the entry last — opening Settings used to take _Start Controlling_ away from the Presenter. **ASKING ABOUT** names all eight windows, and the question corpus grew three files (Bible Note, Web Editor, Lyric Editor) with the Slide Editor's own split out of the Presenter's. Verified live 2026-09-01: the overlay and the shortcut on a Settings window and on the Experiment page — neither of which had ever had them — with the accent frame correctly themed on a page that loads none of the app's own stylesheets.)

Previous: **workflowsVersion: 2026-09-01g** (**W-42 steps 6 and 9 — the ask box holds several lines, and the window can report a bug for you.** Asked for from the app with a screenshot of the ask row: _"change input text to textarea to support multiple lines"_, then _"under `Ask` add `Report`"_ — investigate first, collect the evidence, prepare it for an issue tracker — then _"ctrl+enter to ask, for normal enter just make new line"_ and _"to prevent click REPORT by accident, should confirm before running report"_. The box now grows with what is typed in it, **Enter** starts a line and **Ctrl+Enter** asks. **Report**, under **Ask**, quotes back what it is about to report before it does anything; confirmed, it photographs the app, notes the build, the window, the screens and the error log, investigates the live app and writes the report in the volunteer's place. Nothing is sent by it — there is no issue tracker connected yet, so it saves the report and the picture into Downloads and says so rather than claiming it was filed. Verified live 2026-09-01 on the presenter with ChatGPT: two reports end to end, both files on disk. New CB-32.)

Previous: **workflowsVersion: 2026-09-01f** (**W-42 steps 6 and 7, and W-19 step 7 — the help window takes more than typed words, and stays listening while it answers.** Asked for from the app: attach files and images, paste an image from the clipboard, inspect a DOM element to attach, attach a screenshot — then widened mid-request to _"during waiting for api response user should able to add more input"_ and _"for something unclear the ai should ask for more input from user"_. The box is no longer disabled while an answer is on its way: **Add** folds what you type into the answer being written, and a **Stop** gives every added word back. Five ways to attach (paperclip, paste, drop, **📷** a picture of the app, **🎯** point at a control), capped at four per question, shown as chips with an **×**. Pointing does not press: the choosing click is swallowed, so asking what **Clear Long Text** does never clears the bible. Pictures live only as long as the window — the chip greys out afterwards and says so — and a model that cannot see one says so before spending anything and offers one that can. The assistant can now ask to be SHOWN, with the button beside the request. W-19 gains a **camera** in the Presenting Control that photographs the app WITH the drawing on it and offers ask / copy / save-into-images. Pressing a chip shows what it stands for — a control is ringed again by its stored selector, a picture opens big, a file opens its folder. New CB-26..CB-31.)

Previous: **workflowsVersion: 2026-09-01e** (**W-42 step 6 — an answer on its way can be stopped.** Reported from the app with a screenshot: a question was asked, "Looking it up…" appeared, and there was no way back — the box was disabled, the Ask button was disabled, and the only way out of a question asked by mistake was to wait it out or close the window. A question can take a minute (ten model rounds), and it is being paid for the whole time. The **Ask** button now becomes **Stop** while an answer is on its way, **Esc** does the same, and pressing either drops the request on the wire rather than merely ignoring what comes back. Verified live 2026-09-01 on the presenter with ChatGPT: both the button and the key ended the answer at once, the network log shows the model call `net::ERR_ABORTED` mid-round, no late answer landed, and an answer left alone still arrives as before.)

Previous: **workflowsVersion: 2026-09-01d** (**W-42 steps 10 and 11 — a third assistant, Kimi, and the settings panel now says what each key is FOR.** The AI Providers panel had two hover hints that were both wrong: they named Bible Cross Ref and Bible Audio and left out the chatbot, which both keys had been driving for a while. Each provider card now carries a **Used by** row of chips saying it plainly — OpenAI answers in the chatbot and powers Bible Cross Reference and Bible Audio, Anthropic answers and powers Bible Cross Reference, Kimi answers only — so a volunteer can tell which key is worth fetching before they go and get one. Verified live 2026-09-01 on a real Kimi key, in English and in Khmer.)

Previous: **workflowsVersion: 2026-09-01c** (**W-42 step 6 — every answer now ends with buttons you can press instead of typing.** Reported from the app with a screenshot: the assistant asked “Would you like help turning one on for the congregation?” and the only way to say yes was to type it. The assistant now finishes each answer with two or three short replies — “Yes, walk me through it”, “Which button shows it?”, “No thanks” — and pressing one sends it as your own words. When it does not offer any, the window reads the question it just asked (yes/no, or “A or B?”) and offers those; failing that, it offers the nearest questions it is ready to be asked. Verified live 2026-09-01 on the presenter with ChatGPT, and on the offline guide with no working key.)

Previous: **workflowsVersion: 2026-09-01c** (**W-42 steps 5 and 11 — the top line of the
help window is three drop-downs.** Two of the three choices were segmented
pairs of buttons while the third, the model, was already a list. Six uppercase
words spent most of a 460px window on two either/or choices, which is why the
model name arrived ellipsised — and a third assistant would not have fitted at
all. All three are drop-downs now; a provider with no key stays in the list,
greyed out and reading **needs an API key**, which is what the disabled button
used to say only on hover. Verified live 2026-09-01 on the presenter and the
reader, in both themes.)

Previous: **workflowsVersion: 2026-09-01b** (**W-42 step 14 — a walkthrough step that cannot be done for you now asks the assistant.** Reported from the app with a screenshot: the card read “I could not do that one for you (nothing on screen to act on) — do it yourself, then press Skip”, which is the end of the road for someone who pressed **Do it** precisely because they did not know what to do. 68 of the manual's 251 steps can reach that message. The card now sends the stuck step to the chat window, which looks at the live app and writes one line back onto the card. Verified live 2026-09-01 on the presenter over W-06 step 3: 6 runs in 6 came back with a usable instruction, median 13s; with the help window closed it falls back to the plain instruction at once.)

Previous: **workflowsVersion: 2026-09-01a** (**W-42 step 6 — the help window can be replied to.** Reported from the app with a screenshot: it asked “Would you like help to show a screen?”, the answer was **yes**, and it came back with “It sounds like you might need help or have a question.” Every question was being asked on its own. A tab is now one conversation — **yes**, “the second one”, “how do I turn **it** off?” all land against what was just said — while each tab keeps its own thread. Verified live 2026-09-01 on the presenter with both Claude and ChatGPT.)

Previous: **workflowsVersion: 2026-09-01** (**W-19 — on the arrow tool the Presenting Control panel is a title bar and nothing else.** The arrow is the one tool with no settings of its own, but the panel went on holding the brush panel's height: an empty box parked over the app the operator had just asked to have back. It now shows the title bar alone — and drops the collapse chevron with it, since there is nothing left to roll up — and the body comes back at the size last left the moment the brush, eraser or spotlight is picked. Steps 1-3 updated. Verified live 2026-09-01 on the reader: it opened header-only, the brush restored the saved body, and the arrow rolled it away again.)

Previous: **workflowsVersion: 2026-08-31i** (**W-42 step 12 — the help window steps aside while it is walking you through something.** Reported from the app with a screenshot: the chat window sat over the middle of the presenter while its own card told the user to press a control behind it. It now minimises itself when a walkthrough starts and comes back when the card is closed — unless it was never in the way, or the user had already minimised it. Verified live 2026-08-31 on the presenter, both directions.)

Previous: **workflowsVersion: 2026-08-31h** (**W-21 step 2 named a button that does not exist.** It told you to “use the **+** button in the folder-path bar”; there is no **+** there. Observed live on the Videos tab: the control is the **⋮ More Options** button at the right of that bar, beside the search, sort and filter icons. The step now describes it — deliberately without bolding it, because several buttons in the app carry that same title and the walkthrough would ring the wrong one. The right-click route it leads with is unchanged and is what the app's own walkthrough now performs.)

Previous: **workflowsVersion: 2026-08-31g** (**W-42: every chat tab has a menu, and a chat can be locked.** A **⋮** at the left of each tab — or a right-click on it — opens that tab’s menu: rename it, lock it, close it, **Close other chats…**, **Clear all chats…**. The last two take more than one conversation, so they ask first, on a line under the strip that says how many will go. **Lock this chat** takes the tab’s **×** away, puts a 🔒 in its place, and makes both sweeping actions step around it — so the strip can be cleared at the end of a service with the one answer worth keeping still in it. Verified live 2026-08-31 on the reader: the menu on a plain and on a locked tab, both confirmations, a solo and a clear that each left the locked tab standing, and the lock read back off disk.)

Previous: **workflowsVersion: 2026-08-31f** (**W-42: the help window holds several chats,
and each one carries its own settings.** A tab strip runs along the top — **+** for
another conversation, **×** to close one, double-click to rename one — and every tab,
its answers and its half-typed question survive closing the window and the app. The
half of the app being asked about, Claude-or-ChatGPT and the **model** all belong to the
tab rather than to the window, so one tab can be on Claude about the presenter while the
next is on a cheap model about the reader. The model is a picker now, not a caption:
three per provider with what each is good for, how quick it is and what it costs on the
hover, plus **More models…**, which asks the user's own account what else it can run.
Every answer has **Copy** and every question **Ask again**. With no key at all the
window says Claude and ChatGPT need one and offers **Open AI settings**. Verified live
2026-08-31 on the reader: two tabs kept apart, a rename, a reopen, the OpenAI catalogue
listed from the account.)

Previous: **2026-08-31e** (**W-42: the help window was redesigned.** It reads
as a cue sheet now — each turn hangs off a brass rail with its own marker, the newest
answer lit; steps in an answer are set as a numbered list with the number in the margin;
**Presenter/Bible Reader** and **Claude/ChatGPT** are compact segmented switches with the
model named beside them; and the window follows the app's dark/light theme instead of
opening white in front of a dark app. The two walkthrough buttons lost their emoji and
are now ranked — **Do it for me** filled, **Show me step by step** outlined. Verified
live 2026-08-31 in both themes.)

Previous: **2026-08-31d** (**W-42 step 9 — the help window can drive the app
for you.** Beside **Show me step by step** there is now **Do it for me**: the same
numbered card, but each press of **Do it** clicks the circled button (or types the
text) and moves on — one step per press, with **Skip** for a step you would rather do
yourself, and a plain "I could not do that one" when a step has nothing to click.
Nothing that changes what the congregation sees is done unasked. Verified live
2026-08-31 in the Bible Reader.)

Previous: **2026-08-31c** (**W-42 steps 8 and 9 — the help window can walk
you through it, and it knows which window you are in.** Every answer now offers
**Show me step by step**, which draws a numbered card inside the app itself and
circles the button each step is about — clicking that button advances the card on its
own, and steps you have already done (the tab you are already looking through) are
dropped before it starts. Answers are also scoped to the half of the app you asked
from, so the reader is never told to press the presenter's **Ctrl+B**, and the whole
window is English: the Khmer twin the manual writes beside each label is stripped out.
W-11's goal line now says it is where you look a verse up when you are not presenting.
Verified live 2026-08-31 in the Bible Reader.)

Previous: **2026-08-31b** (**W-42 steps 1 and 7 — the chatbot has a button of
its own, and you choose who answers.** It opened only from the **Help** menu; a **🤖**
button now sits in the top-right corner of both the presenter and the reader, immediately
left of the **?**, and it is absent when AI features are switched off. Inside the window,
**Claude** and **ChatGPT** are a pair of buttons under the header: whichever keys you have
set are selectable, the model that will answer is named beneath them, and the choice is
remembered. Verified live 2026-08-31 — gpt-5 answered from the manual and from the internal
notes, and a failing provider still fell back to the manual and said which one failed.)

Previous: **2026-08-31a** (**new W-41 — share a whole page of Bible Notes.** A note could only leave the app one item at a time; a whole note file — every note in it, the pictures, clips and sound files inside them, and the background attached to it — now exports as a single `.owanote.tar.gz` from the file's `⋮` and imports from the top of the **Bible Notes** panel, by dialog, by URL or by dropping the bundle on the panel. A name already in use is never overwritten: the arriving file lands beside yours as `name (1)`. W-41 step 6 also records that the single-note **Import** is no longer limited to the **Default** file — a note exported from anywhere can be imported into any note file. Verified live 2026-08-30 on the reader, plain and password-protected. **New W-42 — the built-in help chatbot**, added 2026-08-31: a Help menu window that answers from this manual and from what the app is doing right now, and can outline the control it is talking about in the real window.)

Previous: **2026-08-30i** (**W-40 steps 7-9: a mark takes you to its verse now, and a verse row can be filed somewhere else.** Clicking a mark opens the verse beside what you are reading instead of only flashing it, so you keep your place; editing a comment moved onto the mark's own `⋮`. A verse row can be dragged onto another **Bible Notes** file to move it there, marks and all — the same drag still adds the verse to **Bibles** if you drop it there instead. Everything about a marked verse is now lettered in that bible's own font, and the little panel that appears over commented words waits much longer before it goes. Verified live 2026-08-30.)

Previous: **2026-08-30h** (**W-40 step 4: the marks list wears its own marks.** A highlight under a verse row used to be a grey dot beside the words in quotes; the words themselves now carry the same wash they carry in the passage, and a commented phrase carries the same wavy underline, so the panel reads as a miniature of the page and needs no key. The verse row is led by a highlighter pen instead of a bookmark, and its count steps aside once the row is open, where the marks are already on screen. Verified live 2026-08-30, dark and light.)

Previous: **2026-08-30g** (**W-40 steps 7-10: a verse row can do more than hold marks.** It now has a `⋮` of its own, and so does every mark under it, so nothing needs a right-click to be found. Its menu adds the verse to the **Bibles** list or moves the whole row to another note file, and the row can simply be dragged onto a bible file instead. “Move To” had never worked anywhere in Bible Notes — it always said `No other notes found` — and does now. The marking toolbar also follows the app's dark/light setting; it used to come up white on the dark reader. Verified live 2026-08-30.)

Previous: **2026-08-30f** (**new W-40 — mark up a passage while you study it.** Selecting words in a passage now raises a small toolbar: six highlighter colours, a comment button and an eraser. What you mark is kept in your own **Bible Notes**, under a row for that verse, so it is there next time you open the app and travels with your notes when you back them up. Hovering commented words shows the note with buttons to edit or delete it. Verified live 2026-08-30 on the reader, Genesis 22:1.)

Previous: **2026-08-30e** (**new W-39 — the passage can scroll itself, and now says how.** The double chevron under a long passage has always taken four different mouse actions - click, double-click, right-click, Alt + right-click - and named them only in a tooltip that vanishes the moment it starts moving. A **⋯** now appears beside it while it is scrolling and lists all four with the action written next to each, so they can be found, and used on a touch screen. Verified live 2026-08-30.)

Previous: **2026-08-30d** (**W-01b step 1: the `⋮` rests much quieter.** It now sits at the same near-silent alpha as the colour note beside it and comes to full strength on hover, so a long list reads as its names rather than as a column of buttons. Verified live 2026-08-30.)

Previous: **2026-08-30c** (**W-01b step 1: the `⋮` buttons line up.** They now share one size and one column down a list, each level with its own row, and a folder's own `⋮` stays on its name rather than drifting down among the files it holds. Verified live 2026-08-30.)

Previous: **2026-08-30b** (**new W-01b — the `⋮` button, app-wide.** Every surface whose extra actions were reachable only by right-clicking it now carries a visible `⋮` that opens the same menu — file rows, bible items and notes, lookup records and history, bible views, slide previews, background cards and rows, presenting flow lines and preview frames, screen previews, graph boxes, Resources folders and files, cross-reference cards, the foreground buttons' choose-a-screen menu, the verse audio player and canvas item cards. Right-click is unchanged. W-29 step 6 and W-38 step 2 now point at it rather than describing a right-click as the only way in. Verified live 2026-08-30 on the reader.)

Previous: **2026-08-30a** (**W-38 step 2 and W-29 step 6: a lookup row's menu has a button now, and a record window shows its kind in the body.** **Open Graph Preview** was reachable only by right-clicking the row — invisible unless you knew to try it, and out of reach without a right mouse button; every row in the lookup list and in the **names and locations in your reading** panel now carries a **⋮** that opens the same menu. The person/place/book icon that used to sit in a record window's title bar, crowded against its buttons, now leads the description it describes. Verified live 2026-08-30, km.)

Previous: **2026-08-29t** (**W-38 steps 5 and 10: opening a record always starts
fresh, and a box can be made the centre or the new starting point.** The graph no longer
resumes an invisible "last session" — clicking `David` gave you back whatever that window
had drifted into, which after a path or a re-root was somebody else's family under David's
name. It now opens one box, that record, every time; **Save preset** is how you keep an
arrangement. A box's right-click menu gains **Use as root** (clear the rest away and carry
on from this box) beside **Set as centre**, which now re-fans the graph around the box and
brings it into view instead of throwing it into the top-left corner. Verified live
2026-08-29, km.)

Previous: **2026-08-29s** (**W-38 step 8: Find Connection asks for ONE name, not
two.** The path always starts at the graph's own centre box — shown as a chip you cannot
type over — so you only say where you want to get to; the _Path from_ field and the swap
button are gone. Every name the picker offers now carries its English name beside it
(_ដាវីឌ (David)_), the way the lookup list and the boxes already did — eight Khmer names
beginning alike were unpickable. Step 10: reopening a record whose window you ran a path in
now starts you back at that record instead of at somebody else's family line. Verified live
2026-08-29, km.)

Previous: **2026-08-29r** (**W-38 step 7: the Connection Graph now has Undo and
Redo, and Re-layout tidies a path properly.** Every move is reversible — a dragged box, a
zoom, an expansion, a filter — from the two dock buttons or **Ctrl+Z** / **Ctrl+Y**, with a
whole wheel gesture counting as one step. **Re-layout** (now a ✨ wand, which no longer
reads as "reload") rebuilds a found path as its chain instead of spiralling 32 generations
into rings, and always brings the result back into view; it used to leave the graph in the
top-left corner. The panel is also written in the record's own language throughout — title
bar, chips, boxes and the curved edge labels — the title follows the graph's centre when a
path or a re-root changes it, and you can now zoom to 500%. Verified live 2026-08-29, km.)

Previous: **2026-08-29q** (**W-38 step 5: a box in the Connection Graph now has
a right-click menu, and its verse list reads in your own Bible.** The menu carries what the
box's own small buttons carry — _Open detail_, _Verses_, _Open all Related_, _Collapse_,
_Set as centre_, _Remove_ — reachable from anywhere on the box, including a collapsed one,
which draws no buttons at all; rows that would do nothing are left out rather than greyed,
and the press starts neither a box drag nor a canvas pan. The 📖 count beside it used to
list raw keys like `GEN 24:29-30`; it now names each verse the way the Bible you are reading
names it, _លោកុប្បត្តិ ២៤:២៩-៣០_, ranges and all. Previous entry: **W-38: a new Connection Graph shows a person or place and
everything it is related to as boxes you can explore.** Verified live 2026-08-29, km.)

Previous: **2026-08-29p** (**W-38: a new Connection Graph shows a person or place and everything it is related to as boxes you can explore, and can find the line between two people.** Previous entry: **W-29 steps 2 and 3, and W-30 step 3: a
translated name now carries its English name beside it, and you can search in either
language.** A Khmer record reads _ម៉ូសេ (Moses)_ the way a Bible book reads _លោកុប្បត្តិ
(Genesis)_ — in the lookup list, in the "in your reading" panel, across the top of a record
window, and in what the copy button copies — so a name you only know in English is still
recognizable. Typing `Moses` finds him with Khmer records on screen, and typing `ម៉ូសេ` still
does; the same holds for places. With **English** chosen nothing is added, because the name
already is the English one. Verified live 2026-08-29, km and en, names and locations.)

Previous: **2026-08-29n** (**W-13 rewritten: the Cross Reference view is
restyled and now says what it holds.** The wall of bordered boxes is gone — references are
grouped under their theme, hanging off one vertical rail, in reflowing columns, with a
**7 Themes · 35 Verses** count above them; pointing at a verse lights its segment of the
rail. The heading's lightbulb split into `bi-cpu` (a model wrote this) on the section and
`bi-translate` (this heading was machine-translated) on the headings that really were —
it used to show on every heading in every language, English included. Verse previews cut at
a word with one `…` instead of always appending `...`. The empty view says **No verse
selected** and what to do, and the row tooltip says **Open beside the current verse**, which
is what a click has always actually done. Rows take the keyboard. Verified live
2026-08-29, dark and light, English and Khmer.)
Previous: **2026-08-29m** (**W-12 rewritten: Bible Find tells you how many
verses it found, and marks the word it found.** The matched word is now highlighted in the
app's accent with an underline, so you can see at a glance WHY each verse is listed; the
reference beside it steps back to a quiet marker. The footer leads with **N verses found** and
no longer prints a button for every page — a common word runs to 1500-odd pages, and all of
them were drawn at once. The book filter is plain while it says **All Books** and only lights
up, with a funnel, once you have narrowed the search. Verified live 2026-08-29, dark and
light. Revised the same day: the **…** in the block numbers is clickable and opens the
blocks it hides, and a result's reference is set at full contrast — it is the column the eye
runs down, so it has to be read, not glanced past.)
Previous: **2026-08-29k** (**W-37 steps 2, 4 and 7 restyled: the Resources
view is now a list, not a stack of boxes.** Each folder is a header line with the folder it
lives in shown beside its name — two shelves both called `pdf` can finally be told apart —
and its files hang off a single vertical rail instead of each sitting in its own outlined
box. The pattern line is now two readable chips: the chapter you are on, and the dashed
book-level one. A file that matched the book-level half carries a dashed **[en:tran:Introduction]** tag, so a `1CH.0.pdf` listed under chapter 1 explains itself. Nothing moved
and no control changed. Verified live 2026-08-29, dark and light.)
Previous: **2026-08-29j** (**W-29 step 8: a record that names a book, a chapter or a
verse in its description now names it the way YOUR Bible does.** Those mentions ship written in
English whatever language the record is in, so a Khmer sentence used to strand `Genesis 14` in the
middle of it; under any language but English they are now re-read from the Bible on screen —
_លោកុប្បត្តិ ១៤_ — with book and chapter mentions staying part of the sentence and a cited verse still
opening like any other reference. Verified live 2026-08-29 in Khmer and English.)
Previous: **2026-08-29i** (**W-29 steps 2 and 9, and W-30's note: with a non-English
lookup language the verse references now read in YOUR Bible.** A Khmer record citing
`Genesis 10:4` in English beside its own Khmer prose was unreadable to exactly the person who
chose Khmer; a record's citations, the verse window it opens, the passage heading in
"in your reading" and the reference the eye button loads now all name the passage the way the
Bible on screen does, and the **(KJV)** note on that heading is dropped when it would no longer
be true. English still means King James, which is the Bible these records were built from. What
the lists FIND is read from the King James text either way. Verified live 2026-08-29, Khmer and
English both ways round.)
Previous: **2026-08-29h** (**W-37 new step 5: search your folders by file name.**
The magnifier at the right of the pattern line opens a box; type any part of a name and every
matching file in your folders is listed under the verse's own files, marked `*what you typed*`.
Your verse files stay where they were. `abc*` and `abc` do the same thing, and at most 200
extra files per folder are listed. Verified live 2026-08-29. New matrix rows RD-89, RD-90.)
Previous: **2026-08-29g** (**W-37 steps 3 and 6: the Resources view gains
**Reload**, and its whole body is right-clickable.** Reload re-reads your folder list and
every folder's files in one go — the per-folder **Refresh** is still there for one folder.
The `⋮` button is now titled **More Options**, and a right-click in the empty space below
the folder boxes opens that menu too, where before it did nothing.
New matrix row RD-88; RD-82 updated.)
Previous: **2026-08-29f** (**W-37: chapter `0` means the whole BOOK.** `PSA.0.pdf` is
your introduction to the Psalms and is now listed for every chapter of the Psalms, above that
chapter's own files; `-1`, `-2` … count as book-level too, for a second or third such
document. The pattern the panel prints names both halves now (`PSA.1.* · PSA.0.*`) and says
why on hover. Re-verified live 2026-08-29 across Psalm 1, Psalm 119 and 1 Chronicles 1 —
each shows its book's intro and its own chapter, and nothing from another book. Matrix row
RD-84 rewritten, RD-81 hint updated.)
Previous: **2026-08-29e** (**W-37 corrected: Resources matches by BOOK AND CHAPTER,
`<book key>.<chapter>.*`, not by verse.** Material is filed one file per chapter
(`PSA.1.pdf`, `PSA.119.pdf`), so every verse of a chapter shows the same files and the verse
only decides the heading. The numbering note is rewritten around the collision that actually
bites — Psalm 1 must not also list `PSA.10.pdf` and `PSA.100…149.pdf`. Re-verified live
2026-08-29. Matrix row RD-84 rewritten, RD-81 hint updated.)
Previous: **2026-08-29d** (**new W-37 — keep your own files beside the verse.**
If you already file sermon material on disk named after the verse it belongs to
(`PSA.1.pdf`), the new **Resources** view in the advanced bible lookup shows exactly those
files for whatever verse you are on, from as many folders as you care to add, and opens one in
its own application with a click. Verified live 2026-08-29 against a real 1255-file library —
(the match rule that shipped is the corrected one in 29e above). New matrix rows
RD-81..RD-87 and CM-93; RD-41 updated.)
Previous: **2026-08-29c** (**W-29 step 2: the name across the top of a record window
follows the lookup font too.** That title sits in the window's frame rather than its body, so
it was the one place a Khmer record name still came out in a fallback face. Verified live
2026-08-29. Previous: **W-29 step 2 and step 4 say more: the lookup language
now decides the SCRIPT and FONT the records are set in, and names each record's kind in it.**
Khmer records were being rendered in whatever font the system fell back to rather than the
app's own Khmer face, and the kind of a record — People / Groups / Places — stayed English in
the filter and on the record even with Khmer records on screen, because the datasets keep that
field in English in every language. Both now follow the lookup language. A new closing note
says what is NOT translated and why: Gender, Age and a place's Type are free-form dataset text,
not a fixed set. Verified live 2026-08-29 with km under an English interface. Previous:
**W-29 gains step 2, and W-30 a note: the
names-and-locations lookup now has a LANGUAGE of its own.** The person-and-pin button grew a
second half showing the lookup dataset's language code (`en`); clicking it lists every
language the app ships records in and picking one switches the floating panel, every record
window already open, and the "in your reading" list at once, with nothing to reload. It is
remembered, and it is a SEPARATE choice from the app's own language (W-16) — an English
interface with Khmer names is normal. The underlined names inside the King James verses do
NOT follow it: those match King James wording, which is what makes them findable. Verified
live 2026-08-29 on the reader — en→km→en with a record window open the whole time, the
underlines unchanged throughout. W-29's old steps 2..11 are now 3..12; the IDs are stable.
New matrix row RD-80; RD-53 updated.)
Previous: **2026-08-24** (**new W-35 — bring a song in from CCLI SongSelect.**
Settings → Others gains a **SongSelect Integration** card (credentials saved on blur, OAuth
**Sign In** opening a real CCLI window, **Sign Out**), and while signed in the Documents
list menu carries **Import From SongSelect**: a floating search panel that
downloads a song's lyrics and lands them as a ready-to-present `.owl` lyric document.
Driven live 2026-08-24 against a stand-in SongSelect server (CCLI retired new partner
signups, so no real credentials): card + saves + Sign-In gating, the canceled-sign-in toast,
the gated menu entry following the signed-in state with no reload, debounced search with
pagination and disabled unauthorized rows, an import previewing slide-per-part, and
duplicate-import suffixing. The completed hand-off on CCLI's real consent page is
source-verified only, and W-35 says so.
**Same-day addendum: new W-36 — import a public domain song, no account needed.** The
Documents list menu now always carries **Import From Public Domain Songs**:
a floating panel over a 36-hymn catalog embedded in the app (texts fetched from
hymnary.org / The Cyber Hymnal and validated against open-lyric), browsable with no typing,
filtered as you type, one click to land a ready-to-present `.owl` whose slides follow the
real singing order (chorus repeated after every verse). Driven live 2026-08-24: menu entry
present with SongSelect signed out and in, all 36 rows with count badge, instant filter,
Blessed Assurance imported (`Structure: V1CV2CV3C`) and previewing Verse 1 → Chorus →
Verse 2 → Chorus → Verse 3 → Chorus.
New matrix rows ST-57, PL-103, PL-104, PL-105.
**Same-day addendum: the `Add Items` sub menu is gone.** Every way of filling a file list —
**Add Local Files**, **Import**, **Import From URL**, **Download From URL**,
**Import From Public Domain Songs**, **Import From SongSelect**, **Paste Image**,
**Add URL** — now sits directly in the list menu (**⋮ More Options**, or a right-click on
the empty list body) instead of one step down, so every one of them is a single click and an
empty folder advertises all of them as its own buttons. Nothing was added or removed, only
un-nested; the background tabs also stop listing their download entries twice. Every
`Add Items → X` step below is now just `X`. Driven live 2026-08-24 over the Documents list
and the Colors/Images/Videos/Webs/Audios background tabs.
**Same-day addendum: an imported public domain song keeps a link to where its words came
from — W-36 step 4 rewritten.** Every hymn in the catalog now stores the hymnary.org page
its text was transcribed from, and the import saves that link with the document, so the
song ends with one extra slide named **Hymnary.org** showing that page. Driven live
2026-08-24: an imported Amazing Grace previewed Info → Verse 1-4 → **Hymnary.org**, the
slide showing hymnary.org's "Amazing grace! (how sweet the sound)" page.)
Previous: **2026-08-22** (**W-34 gains the "Putting the KJV back" note — the
KJV row now has a Reset Bible XML button.** Only the row whose code is `KJV` shows it; it
replaces that translation with the copy embedded in the app, the same data the empty-state
**Create KJV Bible XML** writes, and it is destructive with no undo. Verified live
2026-08-22 in the Setting window: present on KJV and on none of the other 20 installed
bibles, confirm wording as quoted, file replaced, reader re-read from it. The same note
gained a "Deleted it by mistake?" half: **Create KJV Bible XML** is no longer only the
first-run empty-state offer — it is the FIRST ROW of the **Bibles XML** list whenever that
list has no KJV, so a trashed KJV is one click from coming back. Verified live 2026-08-22
with the KJV trashed: the list led with the row, the click rebuilt the translation, the row
then went away.
New matrix row ST-51; ST-28 rewritten.)
Previous: **2026-08-12** (**W-30 step 1: the advance-lookup panel's three tabs are
now ONE drop-down.** **Find** / **Cross Reference** / **Location-Name (KJV)** never fitted the
narrow panel — the third label sat permanently cut off as "Location-Name (K…" and the old step
had to tell the reader the tab strip scrolls sideways. The header now holds a single `select`
with the active view's icon beside it, so every name reads in full at any panel width. Nothing
else about the panel changed. Verified live 2026-08-12 on the reader.)
Previous: **2026-08-11b** (**W-16's language step: each language is now listed under
its OWN name (`English`, `ខ្មែរ`) instead of being translated into whatever locale is in
force.** The person who needs the picker most is the one who cannot read the current script —
a list translated into it offered them no way back. The button's `title` still carries the
English name. NOT yet re-verified live; the previous entry's claims were.)
Previous: **2026-08-11** (**W-05 gains the two steps an operator actually asks about
while a song is on screen: edits made elsewhere show up by themselves, and where the manual
**Reload** lives.** A song edited in the Lyric Editor — or in another window, or by anything
that writes the file — now refreshes the **Stage Previewer** verses on its own, every stage,
without re-picking the song; before, the rendered song at the top refreshed while the verses
under it kept the pre-edit text for minutes. The Stage Previewer header also grew a **⋮** with
**Reload** in it, which re-renders every stage at once. Verified live 2026-08-11 (XW-08,
PM-127).)
Previous: **2026-08-10d** (**new W-34 — "Add a Bible translation from the internet
(XML), and make it read in its own language"**. W-33 moves translations you already have;
this ADDS a new one from a link, entirely in the UI — the flow that produced `ពគប`. Driven
live end to end on `github.com/Beblia/Holy-Bible-XML-Format/…/KhmerBFBSBible.xml`. Two halves
are worth reading twice. (1) An XML from the internet usually carries no short code, so the
app asks with a row of **Guessing keys** buttons built from the words in the file's own
header — the Beblia files leave a bible.com address there ending in `…GEN.23.ពគប`, which is
literally where that badge came from — and since the code is also the file name it has to be
settled at import time. (2) A raw import lands on **English**: English book names, `1 2 3`,
and the translation filed under English in the bible menu. The three right-click commands in
the **Info** editor (**🌎 Choose Locale**, **#️⃣ Edit Numbers Map**, **📚 Edit Books Map**) fix
that, **in that order** — the numbers and the book-name suggestions are both derived from the
locale set first — and **📖 Guessing Names** fills all 66 Khmer book names from the sets the
app ships. Proof it worked is in the reader: the translation leaves the English group and its
references render `(ពគប) កិច្ចការ ២៨:១៥`.)
Previous: **2026-08-10c** (**the mistyped-password panel now comes BACK holding what
you typed and ticked.** W-33 step 3 and W-21 step 10a used to promise that a mismatch "can
never quietly produce an unprotected file" — on Export Data and Export Bible Data it could,
because the panel was re-opened through an alert that wiped both the password fields and the
selection. Fixed 2026-08-10; the wording now says what the operator actually sees.)
Previous: **2026-08-10b** (**new W-33 — "Share your Bible translations (XML) with
another machine"**. W-24 already shared a bible LIST (verse references); this shares the
translations themselves, which until now could only be moved by digging the files out of
the app-managed bibles folder by hand. Settings → Bible grows a **[en:tran:Bible Data]** card under **Import XML File**, with the same picker + optional
password every other export uses, and the whole Bible XML page accepts the bundle as a
drop. Observed live in **both locales** on 20 installed translations — including the four
Khmer-keyed ones (`គកស១៦`, `គខប`, `ពគប`, `អគត`), which is exactly the case a translated row
label would have blanked the popup on. The part worth reading twice is step 6: an import
never overwrites and never makes a second copy, so a bible it cannot take becomes a red,
un-tickable row naming the reason — key already exists (upper/lower case are the same key),
duplicate key inside the bundle, or a file whose key cannot be read.)
Previous: **2026-08-10** (**new W-32 — "See who published a Bible translation
(and its copyright)"**. The bible pane header now carries an **ⓘ Bible Information**
button while no verse has resolved — in the book grid AND the chapter grid — opening a
read-only card with the edition's title, key, version, locale, publisher, copyright,
legal note, description and book count. It replaces the Settings → Bible → pencil →
**Info** detour for reading (editing still lives there). Observed live on
`Khmer BFBS (ព្រះគម្ពីរបរិសុទ្ធ ១៩៥៤)` in **both locales**: the button appears with an
empty lookup box, survives picking a book, and disappears the moment a chapter resolves
and the verse buttons take its slot; Escape and ✕ both close it without disturbing the
grid. A web address inside any of those values (publishers put their site in the
copyright or legal note) renders as a link and opens in the system browser, leaving the
app where it is.)
Previous: **2026-08-09c** (**new W-31 — "Hide, show, and reset the app's panels
(View menu)"**. Every collapsible panel now registers itself into a native
**View → Widgets** submenu as a tick-box that opens/closes it by name, and
**Reset Widgets Size moved out of Settings onto the View menu**, where it applies
immediately instead of waiting for an **Apply Settings** reload — and it also reopens
every panel that was collapsed. Observed live on the reader (4 widgets: toggled
`Bible Notes` open and `Bibles` closed with no reload) and on the presenter (13 widgets,
15 with an `.ows` document selected); the reset restored all four reader panes to
`1/1/1/4` and reopened the collapsed one. **W-16**'s reset-button bullet is corrected in
the same pass. Driven live in both locales.)
Previous: **2026-08-09b** (**new W-30 — "See who and where is in the passage you
are reading"**, the `Location-Name (KJV)` tab added beside **Find** and **Cross Reference**
in the advanced bible-lookup panel. It lists every person and place the Bible names in the
verses currently open, one block per passage, and each row opens the same record window
W-29 teaches. Observed live on KJV Luke 13:1-35 + a Khmer Genesis 3:5-9 side by side:
Names (6) / Locations (2) for Luke, Names (1) for Genesis, and clicking **Pilate** opened
his record. The list also carries people the verse means without naming — Satan in
Luke 13:16, which reads "the devil".)
Previous: **2026-08-09** (**every floating window maximizes on a double-click of
its title bar**, and goes back to the size and place it had on a second one. Added to
**W-26** step 3 and **W-19** step 1 (the two places that teach the floating-window chrome)
and to **W-29** step 1. Observed live on the Names & locations lookup: a 377×560 window at
the right edge filled the whole app window, and the next double-click put it back exactly.
The maximized size is deliberately NOT remembered — a window closed while maximized
reopens at the size you last dragged it to — and resizing it by an edge ends the
maximized state.)
Previous: **2026-08-08i** (**new W-29 — the Names & locations lookup**: the
person-and-pin button at the end of the Bible reference box opens a searchable browser
over the biblical names and places, with per-record windows, reference chasing between
them, verse text, a map for places that have coordinates, and a copy button. Every step
was observed on the live app in BOTH locales; the Khmer labels quoted in the recipe are
the ones the app actually rendered.)
Previous: **2026-08-08h** (**W-24** gains step 5 and **W-28**'s table is
reworded: a **website box now shows a screenshot of the page, not the running page**,
everywhere you edit and preview. Hover it for ~1s to see it live; right-click →
**Refresh Preview** to re-take the picture (it never updates itself). The audience
screen still shows the real live page. Same rule for a **web background**: a picture on
the presenter's mini screen, the live page on the projected screen — with no
hover-to-live there, because the background layer never receives the pointer.
Previous: **2026-08-08g** (**W-17** rewritten: the Finder is no longer a separate
popup window. **Ctrl/⌘+F** now drops a **Find bar** into the top-right of the window
being searched — pinned inside that window rather than floating over it — with a
`current/total` match counter, **Shift+Enter** for the previous match and a grip that
drags it sideways. It is drawn as app chrome, so the query never matches itself.)
Previous: **2026-08-08f** (new **W-28**: anything in the bottom **Background** panel
can now be **dragged straight onto the Slide Editor canvas** to become a box — an image,
video, audio, web page, camera or colour. A colour dropped **on** an existing box recolours
that box instead of covering it. **Driven live** (all six kinds dropped, each landing centred
on the cursor; the YouTube URL came in as a real YouTube box, the camera kept its device
name, and Undo took every one of them back). **W-15** step 4 corrected with it: the tools
panel is a select list, never a drag source. Previous: **2026-08-08e**
(**W-22** step 5, **Media Control**: moving off the slide
now STOPS what it started — putting another slide on that screen, or clearing it, pauses the
slide's media and drops anything still waiting. A running order that plays a slide's audio
could not move on before: the swap was refused with **Media is Playing**, which is still what
a clip you started BY HAND gets. **Driven live** (slide 1's audio playing under a
**Media Control (Play)**, slide 2 presented on the same screen: it landed, the audio paused,
no toast). Previous: **2026-08-08d** (**W-22** step 8: a **Next: Timeout** attached to a line
as a CC element can now be given **its own wait**, from the stopwatch at the right of that
CC row or its **Change Timing** menu entry — the answer belongs to that attachment, so one
timeout can hold one line for 4 seconds and another for 30. Filled stopwatch = its own
wait, hollow = still following the element; **Use Element Timing** hands it back. **Driven
live** (4s override counted 4→3→2→1 while the element stayed at 10, then reset).
Previous: **2026-08-08c** (**W-22** step 9: the running-order preview panel is no
longer one-at-a-time — **several may be open together, one per running order**, each with
its own place on screen, its own folding, its own marker and its own countdown, and each
closed on its own. Opening a second used to close the first and lose where its run had got
to. The thumbnail zoom stays shared across them. **Driven live** (two panels open side by
side, independent markers, independent rects, one closed while the other stayed).
Previous: **2026-08-08b** (**W-22** step 5 gained **Media Control** — a
running order can now play, pause or stop the video or song _inside_ a slide by itself:
wait N seconds, start at a point of the clip, stop after a while or at a point of the clip,
at a volume and a speed. It is attached to the slide it controls (**Add Media Control**,
beside **Add CC Elements**) rather than added to the sheet, its settings belong to that one
attachment, and a screen pin on it narrows where the slide went rather than redirecting it.
**Driven live.** Previous: **2026-08-08a** (**W-22** step 2: a fifth run action,
**Next: Clear Interval** — the loop's off switch written as a line of the running order.
An interval could only be stopped by hand (the pill, closing the panel, the end of the
sheet); now a sheet can stop its own loop, wait, and be picked up again. It asks nothing
when you add it, ends a running or paused interval and only an interval, and does nothing
— silently — when there is no loop to end. **Driven live.** Previous:
**2026-08-08** (**W-22** step 2: **Add Action** now opens with one
**Clear Screen** row instead of six clearing rows — the five clears and the per-widget
**Other Clear FG Items** row moved inside it, so the menu opens on the choice between
clearing something, putting the screen up or down, and moving the run on. Nothing was
renamed or removed, and sheets already written are untouched. **Driven live.** Earlier:
**2026-08-07g** (**W-26** amended: **Ctrl** (**⌘**) **+ click** a
Documents row is now a shortcut for **Open Slides Preview** — it toggles that document's
floating window without selecting the document, and does nothing on the row that is
already in the middle panel. **Driven live.** Earlier:
**2026-08-07f** (new **W-27**: the middle **Documents** tab heading now
carries a **pin** whenever a document is being previewed. Pinned, the previewer cannot be
swapped by anything the operator clicks — another Documents/Lyrics row, a document inside a
presenting flow, or the file name in the previewer footer — each one is refused with a toast and a
flash of the pin instead. A rename still follows, trashing the document unpins it, and the
pin is remembered across a restart. **Driven live, in both locales.** Earlier:
**2026-08-07e** (**W-26**: a Documents row's right-click menu now
offers **Open Slides Preview**, which gives that document its own floating previewer —
the full one, editing strip and Note boxes included — so several documents can be looked
at at once. One window per document, each with its own zoom and its own remembered
position/size, and each answering the arrow keys only while it has focus. A document is
previewed in ONE place: the entry is greyed out on the selected document, and selecting a
document that has a window closes that window. **Driven live, in both locales.** Earlier:
**2026-08-07d** (**W-05** steps 6-9: every stage chip in the Stage
Previewer now carries a **⚙** that opens a draggable **Stage Style** window — Slide
Padding, Background Opacity, Extra Font Size, Light/Dark and a Custom CSS box, plus
Reset. The settings belong to the STAGE and apply to every song, so two stages can look
completely different; Custom CSS is added to the stage's built-in look rather than
replacing it. A screen already showing a slide keeps it until the slide is presented
again. **Driven live, in both locales.** Earlier: **2026-08-07c** (**every** export now opens a panel first, asking for an
optional **Password** + **Confirm Password** — **W-22** step 10/10a (presenting flow), **W-23**
step 2 (document/lyric), **W-24** step 1 (bible list) and **W-25** step 2a (whole data).
Leaving both empty writes exactly the bundle it always did; a password writes `.enc`
instead of `.tar.gz`/`.tar` and import asks for it, with three tries. There is no password
recovery. **Driven live, in both locales.** Earlier: **2026-08-07b** — **W-25** step 2: the Export Data panel now also lists
**Background Webs** and **Bibles XML** — two folders a "back up everything" run used to
leave out. Bibles XML carries only the bible XML files you added yourself, not the
downloaded Bible versions, which you re-download on the new machine. **Driven live.**
Earlier: **2026-08-07a** — **W-05** steps 4-5: a song's `- Attachments:` links
now each become a real slide at the end of the Stage Previewer — a YouTube video, an
image/video/audio, or the web page itself, full-bleed and presentable like a verse; a
`file:///…` link lets a chart or a backing track travel with the song, and a PDF or a
non-address line still gets its named but empty slide. **Driven live.**
Earlier: **2026-08-07** — **W-05** + the layout tour: songs are selected from
the Documents list like any other file — one highlighted row, no separate Lyrics tab —
and the Documents preview switches to the song view. Earlier: **W-22** step 2: a running order can now put the SCREEN
ITSELF up and down — **Screen: Show** / **Screen: Hide**, for a sheet that has to work with
nobody at the machine. They are the only actions that ask **which screen** when you add
them, and they go to those screens and only those: no falling back to whatever is selected
and no stopping to ask, because there is nobody there to answer. Firing one twice is
harmless. **Driven live.** Previous: **2026-08-06a** — **W-22** step 2: a fourth run action, **Keyboard Event**
— a **shortcut you set by pressing it** (Ctrl/Shift only, at least one, unique per presenting flow)
that sends the run to that line and puts **all** of its CC elements on the screens at once.
**W-22** step 8: the run no longer steps over a **folded-away** element — it **opens** what
it lands on, and **parked is now the only reason a line is passed by**; the preview panel
also takes the keyboard the moment it opens. **Add Action** folds its eight per-widget
foreground clears behind one **Other Clear FG Items** row. **Driven live**. Previous:
**W-22** step 2: a **Next: Timeout** can now wait until a
TIME ON THE CLOCK instead of counting seconds — its question has a **Seconds** / **At Time**
chooser, the line reads `⏱ Next: Timeout (7:05 AM)`, and a time already gone by is refused
out loud rather than waiting until tomorrow. Its menu entry is **Change Timing**.
**Driven live**. Previous: **W-22** step 2: a **Jump to** that lands on a
**Next: Interval** now STARTS it — it was being withheld, which broke the looping set (an
interval over a set of slides, a jump at the end of them pointing back at it). A jump is
the next key aimed at a line of your choosing, and does there whatever stepping onto that
line would have done. **Driven live**. Previous: **W-22** step 2: the two clocks now answer only to the
run MOVING — a **Next: Timeout** is called off by you going to another line (not by any
stray click, which used to kill it), and a **Next: Interval** starts its count again from
the line you step to. **Driven live**. Previous: **W-22** step 5: holding **Ctrl** while dropping
something from ANOTHER panel onto a line now inserts it as a new line THERE rather than
attaching it — previously the only way in was the end of the list. And the three `Next:` /
`Jump to` actions now wear three different colours (amber, teal, purple) instead of one.
Previous: **W-22** step 5: dragging a line onto another no longer
depends on hitting a 7px band — hold **Ctrl** (⌘) to force the MOVE or **Alt** to force the
ATTACH, anywhere on the line, with the mark following the key while you drag. Without
either, aiming works exactly as before. **Driven live** (all four combinations read off the
row's own mark, plus a real Ctrl-drop in the middle of a line that moved it instead of
attaching). Previous: **W-22** step 2: a third run action, **[en:tran:Jump to]** — the one way a running order goes anywhere but forward. You point it at another
line by attaching that line to it as its single CC element (a whole song included, which
nothing else can be a CC of), and when the run reaches it — or you click it — the run goes
there and shows it. Put one at the end of a set of announcement slides with an interval
above them and the set loops by itself. **Driven live** (aimed one at a song, jumped
backwards to it from the last line of the sheet and watched the song open at its first
slide; the attach list, the one-CC cap and the three "nothing to jump to" messages
checked too). Previous: **W-22** step 2/5: a **Next: Timeout** can now be
attached to a line as a **CC element**, which is how you say "show this slide, and go on
by yourself ten seconds later" without putting a waiting line in the running order. A
**Next: Interval** deliberately cannot be attached to anything — nothing you do stops an
interval, so one riding a slide would keep walking the sheet on its own. **Driven live**
(attached one to a slide, stepped onto that slide with the next key and watched the
countdown carry the run on; the interval is absent from the attach list). Previous:
**W-22** step 2 and step 8: a running order can now
**walk itself**. The **Add Action** menu gained **Next: Interval** (⟳) and **Next:
Timeout** (⏱) under the clears; each asks for a number of **seconds** when it is added
(shown in the line, changeable later from the line's own **Change Seconds**). A
**timeout** counts that many seconds down and then moves the run on once — and any click
or key you make cancels it, so taking over is simply taking over; an **interval** keeps
moving it on every so many seconds and is stopped only by the pill it puts at the top of
the preview panel. Both work only while that presenting flow's **preview panel** is open — it is
the panel that walks the run — and elsewhere they say so rather than pretend. **Driven
live end to end** (armed, cancelled, handed an interval over to a timeout, stopped by the
pill, and the toast with the panel closed; presenting flow restored afterwards) — see PL-95.
Previous: **W-22** step 9: the **preview panel's right-click menus
are now the same as the list's**. Right-clicking a line in the floating preview used to
offer only **Show on Screens** and **Disable** (and nothing at all on an audio line), so a
running order could not be reordered, recoloured, duplicated or tidied from the panel you
actually watch during a service — you had to go back to the list. It now carries the whole
menu, and a slide thumbnail in the panel gained **Reveal Original**. **Driven live
2026-08-05**: opened the preview for `pl1`, read the full menu off an element's title line
and off a **Clear All** action line, off a song's slide thumbnail and off a CC line, then
moved a line down and back up from the panel and watched the list behind it follow.
Previous: **W-22** gained **CC elements** (new step 5): anything in a
run sheet — a background, a verse, a foreground preset, a whole song or one of its slides —
can now be attached to another line, and that line then brings it onto the screen with it.
One click puts verse 1 and the welcome marquee up together; a CC on a song's line rides with
every slide of it. Attach by dropping onto the line, or from **Add CC Elements**; clicking a
CC never projects it, it takes you to the element it is a copy of. **Dropping onto a LINE no
longer adds an element to the presenting flow** — step 2 now says to drop onto the presenting flow's NAME
row. **Driven live 2026-08-05**: attached a marquee to slide 1 of a song from the menu,
clicked the slide and read BOTH the slide and the marquee off the real `screen.html?screenId=0`
output, confirmed the preview's run cursor ignores a CC click, then removed it again.
Previous: **W-22**: a line YOU parked and a slide the DOCUMENT hides
no longer look alike — yours is crossed out with an amber 🚫, the document's keeps a plain grey
👁‍🗨, and the tooltips say which; the preview panel's dimmed thumbnails carry the same two marks
bottom-left. It matters because only one of the two comes back from the run sheet's own menu.
**Driven live 2026-08-05**: parked a slide of a document beside two the document hides and read
all three in the tree and in the floating preview, then released it again. Previous: **W-22**
gained **Move to Top** / **Move to Bottom** and
**Duplicate** — a line can now jump straight to either end of the run sheet instead of being
clicked up one step at a time (the entry is simply absent on a line already at that end), and
a line can be copied directly below itself with its colour, its pinned screens and its parked
slides already on the copy; the two are independent from then on. **Driven live 2026-08-05**:
moved a middle element to the bottom and back to the top, compared the first/last row menus,
duplicated a document line with parked slides, released the copy and confirmed the original
stayed parked, then removed the copy. Previous: **W-22** gained **Disable** / **Enable** — any line of a
run sheet, or one slide of a document line, can be PARKED out of the running order without
being deleted: it dims, its click and its drag stop projecting anything, and the
arrow/Space keys step past it. Parking is stored per presenting flow, so the same song stays live
in another service. **Driven live 2026-08-05**: parked and released an element, a document
(its slides parked with it) and a single slide, in the tree and in the floating preview.
Previous: **W-22** gained **Set Specific Screen** — a presenting flow
line, a document line, or one slide of a document can be PINNED to particular screens, and
every present from the panel then ignores which mini screens are selected. Drag-onto-a-mini-screen
and **Show on Screens** still override a pin on purpose; a pinned screen that is gone
toasts rather than projecting elsewhere. **Driven live end to end** on 2026-08-05 across
three screens: pin persisted into the `.owpf`, beat the selected screen from the tree row,
the preview thumbnail and the Space key, and a per-slide pin overrode its document's while
its neighbours kept following it. Previous: new **W-24** — a **bible list** now exports/imports as
a `.owbible.tar.gz` bundle, and W-23 gained a note that a **lyric** rides the document
bundle unchanged (its attached slide backgrounds travel with it). **Driven live end to
end** on 2026-08-05: a Khmer-named lyric exported with both of its attached slide images
and re-imported with its `.bg.json` re-pointed at the reused local copies; a bible list
exported with its attached bg-colour sidecar and re-imported into the bibles folder.
Previous: new **W-23** — one document (slides, lyric, PDF, PPTX
or DOCX) can now be exported and imported on its own as a `.owadoc.tar.gz` bundle,
carrying its attached background and that background's media, any video inside its
slides, and its colour note. It behaves exactly like the presenting flow bundle in W-22 because
it runs the same code. **Driven live end to end** on 2026-08-05: exported an `.ows` and a
PDF (the PDF's attached background video and its green colour note both landed in the
manifest), then dropped a bundle back onto the Documents list — the document was written,
its `.bg.json` re-created pointing at the reused local video, and its colour note
restored. Previous: bump when any workflow changes) — **W-11** (Bible Reader)
and **W-09**'s lookup note corrected: typing a full reference like `John 3:16` does **not**
jump to the verse on the Reader page either — it book-filters and drops the `3:16` when the
book is picked, exactly like the lookup dialog. Verified live 2026-08-05. Previous: **W-22**'s sharing
notes now say what happens when the other machine already has a file of the same NAME
that is a DIFFERENT file: yours is kept and the bundled one arrives as `a (1).mp4`
(matching contents are still reused, so a repeat import adds nothing). They also say
that a video placed inside a slide now travels with the bundle and is re-pointed at the
local copy — it used to arrive as an empty box. **Driven live end to end** (round-tripped
a fixture bundle: differing `1.jpg` landed as `1 (1).jpg` with the original untouched,
the slide's video was bundled and re-pointed, and re-exporting carried it again) — see
PL-67 / PL-76. Previously: **W-22** gained
step 11: the Presenting Flows list menu now also offers **[en:tran:Import From URL]**, so a
bundle published on a web server — or shared off another laptop over the local network —
is imported by pasting its link instead of copying the file across. The download lands in
a temporary folder, is imported exactly like a picked or dropped bundle, and is deleted
afterwards; plain `http://host:port/…` works as well as `https://`. **Driven live end to
end** (real 80 MB bundle over a local `http://localhost:8000` server, both locales, plus
the 404 and Cancel paths) — see PL-75. Previously: **W-22** step 2 now
also lists the **per-widget foreground clears** the **Add Action** menu offers under the
five broad ones (`M↑` `M↓` `QT` `CD` `SW` `TM` `CM` `WB`), each doing what that widget's
own hide button in the Foreground panel does, and says why the panel's **Background Images
Slide Show** has no action of its own (it is a background — **Clear Background** stops it).
Driven live: the 13-item menu in both locales, and `Clear FG Marquee Top` then
`Clear FG Stopwatch` on a real `screen.html` output, each taking only its own widget while
the bible verse stayed up. Previously: **W-22** gained
**screen actions**: a presenting flow can now hold something to _do_ as well as things to show.
Its step 2 covers **[en:tran:Add Action]** and the five clears it offers, step 4
that an action is _run_ on a screen (click / drag onto one mini screen / **Apply on
Screens**) rather than shown on one — and so never lights up as live — and step 8 that the
floating preview's next-key stops on an action and fires it, so a **Clear All** dropped
between the last song and the sermon blanks the screen at exactly that point.
**Driven live end to end** (both locales, real `screen.html` output, presenting flow restored
afterwards) — see PL-71..73. Previously: **W-22 is no longer
a development-only workflow**: commit `203d35cc` removed the `isDev` gate, so the
**Presenting Flows** panel ships in packaged builds too (it took the slot the separate **Lyrics**
list used to hold — lyrics are rows of the **Documents** list now). The warning at the top
of W-22 is gone, its step 1 says where the panel actually sits, and steps 5/8 gained the
colour stripe, the per-element fold memory and the "no save button" note. **Source-verified
from `src/presenter/AppPresenterLeftComp.tsx`, not yet re-driven live** — the next robot
run must confirm the panel really is there on a packaged build before this claim is
treated as observed. Previously: **W-22** step 8
now says arriving at a document always shows its FIRST slide, and that folding is the
chevron rather than the whole title line (PL-46 / PL-48). Previously: **W-22** step 8
said the next-key walks a **document element's own slides** and only moves to the
next element once its last slide is on screen (PL-48). Previously: **W-22** step 8
named the floating preview's **Collapse All / Expand All** icons at its
bottom-right, which fold or unfold the whole running order in one click (PL-47). Previously: **W-22** step 8
covered running the service from the floating preview with the keyboard: click
anywhere on an element to mark where you are (its preview, or the title line of a
folded one), then **Space / ↓ / → / PageDown** moves to and shows the next element
(PL-46). Previously: the presenting flow
sharing workflow's import step now also accepts the `.owapf.tar.gz` **dropped straight
onto the Presenting Flows list** (PL-45), not only the list menu's **Import** entry.
Previously: **every file list
now has one button, a gray ⋮ (More Options)**, opening the same menu as right-clicking
the empty list body; the old **↻ Reload** and **+ Add items** icons next to the folder
path are gone (Reload is the menu's first entry). Lists with a title bar put the ⋮
there; the background / foreground-web tabs put it in the path row. **W-15** gains the
lyric/document _creation_ step — the Documents list offers **New App Document** and
**New Lyric** as two direct entries (all observed live, English and Khmer); W-08's Web
tab step now points at the ⋮ instead of the `+`. Previously: new **W-22** (build a
service presenting flow and export/import it as a `.owapf.tar.gz` bundle); its step 7 now says
**right-click → Reveal Original** (the 3-second hover-to-locate it described was replaced
by that context-menu item, PL-37 / PL-34) — source-verified, not yet driven live;
dev-builds only, and
its steps are **source-verified + partly driven live**, so the next full robot run must
confirm every step by hand and correct anything that drifted. Previously: **W-08** gains the
Background thumbnail/list view toggle (Images / Videos / Web), observed live end-to-end.
Previously: new **W-21** (download a background video / audio from a link), observed live
end-to-end; W-16 Language now states that `Apply Settings` is required to complete the
switch (observed live).

> ⚠️ **Pending live re-verification (2026-07-18).** A `src/` sweep for the coverage-matrix
> expansion indicates the presenter UI has drifted from some steps below: **Foreground**
> (W-09) and **Bible text styling** (W-07) are now **floating widgets** (a toggle button)
> rather than middle-column split-tabs; presenting a slide is a **single-click toggle**
> (W-03/W-05 say double-click); Background **Web `+`** (W-08) opens a menu first; Settings
> **Theme** (W-16) offers **System / Light / Dark**. These are source-verified but **not
> yet confirmed on the live app**, so the tutorial prose is left as-is per this file's
> "truth follows the live app" contract — the next robot run must confirm each and correct
> the affected workflow (then bump `workflowsVersion`). The coverage-matrix REFINEs
> (`PM-01`, `PM-06`, `PM-13/14`, `PM-33`, `PM-57`, `ST` theme rows) already encode the
> observed behavior as test expectations.

---

## Orientation

### W-01 — Understand the Presenter window

**Goal:** know where everything lives.
**Where:** the main window (`presenter.html`), which opens on launch.

The Presenter has a header and three resizable columns:

- **Header:** page tabs — **[en:tran:Slide Editor]** / **[en:tran:Bible Reader]** /
  **[en:tran:Screen Mirror]** (the page you are on has no tab of its own;
  **[en:tran:Presenter]** is the tab that brings you back from the Slide Editor) — the
  **[en:tran:Bible Lookup]** button
  (center, `Ctrl+B`), and the **[en:tran:Setting]** gear + Help buttons (right). 📸
  Left of the gear, the cup is **[en:tran:Stay Awake]**: while it is on — and
  it is, unless you switch it off — this computer does not go to sleep or
  turn its display off for as long as the Presenter is open. Click the cup to
  switch it off (it turns grey and empty) and again to switch it back on; the
  choice is kept for the next launch. The Bible Reader and the Slide Editor
  never hold the computer awake, so they have no cup. A screen that is
  showing keeps the display on by itself, whatever the cup says.
  The **?** at the far right (**[en:tran:Help]**) opens a small menu of two rows:
  **[en:tran:Open Online Help]** opens the app's help page on its website, in
  your web browser, and **[en:tran:Open Chatbot]** opens the help window that
  answers inside the app (W-42). The first is in the menu bar too, as **Help** →
  **[en:tran:Open Online Help]**.
- **Left column:** your content libraries — the **[en:tran:Documents]** list (songs live
  here too, marked with a music note) and **[en:tran:Presenting Flows]**.
- **Middle column:** the working area — **[en:tran:Documents] / [en:tran:Bibles]** preview tabs plus the
  **[en:tran:Foreground]** button on top, and the collapsible **[en:tran:Background]** panel at the bottom.
  The Documents tab shows whatever kind of file you picked: slides for a slide document,
  pages for a PDF, and the song view for a lyric.
- **Right column:** **[en:tran:Bibles] / [en:tran:Bible Notes]** lists and the **mini screen** — a live preview
  of exactly what the audience sees, with clear buttons in its header and a zoom slider under it.

Drag any divider between panels to resize them; the size is remembered. 📸

_Verify: GL-12, NAV-01..02, NAV-10, NAV-24, NAV-25, PL-01, PR-04._

### W-01b — The `⋮` button: everything a thing can do

**Goal:** find the actions that used to be hidden behind a right-click.

Almost everything in the app — a file in a list, a Bible verse in your reading list, a
note, a slide, a background, a line of a presenting flow, a screen preview, a folder in
**[en:tran:Resources]**, a box in a connection graph — has more it can do than the click on it
does. Those extras live in a small menu.

1. Look at the right-hand end of the row, or the top-right of the card. There is a
   very faint **`⋮`** there — as quiet as the colour-note dot beside it, and it comes up to full
   strength as soon as you point at it. In a list they
   line up in a straight column down the right edge, each one level with the row it
   belongs to; a folder keeps its own `⋮` up on its name, beside the ones belonging to
   the files inside it. 📸
2. **Click it.** The menu opens right at the button — the same menu you get by
   **right-clicking** the row itself, which still works exactly as before.
   The menu shifts into view and can use the full window height, regardless of
   where you clicked.
   **A long menu scrolls only when it is taller than the whole window.** Its entries
   scroll inside it only when they exceed the window's height, or when the menu has its
   own smaller height limit.
   > Clicking `⋮` does NOT also do what clicking the row does: a document you open the
   > menu on is not selected, and a slide is not sent to a screen.
3. Pick an entry, or click anywhere else to close the menu without choosing.

> **Why it is there.** A right-click cannot be done on a touch screen, and some
> machines and browsers keep that button for a menu of their own. The `⋮` is the same
> menu with a button you can see.

**To rename a file** — a document, a song, a picture, a clip — open its menu and pick
**[en:tran:Rename]**. The name turns into a box holding the name it has: change it and
press **Enter** (or click the ✓). The file is renamed where it lives, and it stays
selected.

**A name Windows keeps for itself is refused**, when a file is made or given a new name.
`CON`, `PRN`, `AUX`, `NUL`, `COM1`…, `LPT1`… — with or without something after a dot,
such as `NUL.old` — cannot name a file on Windows, so the app refuses them on every
computer (**[en:tran:Invalid file name]**: _This name is reserved by Windows. Please
choose another one._) and a file made here can always be moved to another machine.

_Verify: GL-24, GL-06, CM-04, PL-31._

### W-02 — Switch between the main pages

**Goal:** move between Presenter, Bible Reader, and Slide Editor.

1. Click a header tab — the window switches to that page in place. A page has no tab
   for itself, and the Bible Reader has no tabs at all: come back from it with its 🖥️
   **[en:tran:Go Back to Presenter]** button.
2. The **[en:tran:Slide Editor]** tab opens the editor only for a selected slide document:
   select one in the left list first (W-03), then click the tab; with nothing
   selected the app shows an alert ("[en:tran:No slide selected]") and stays put.

_Verify: NAV-01..04._

---

## Presenting content

### W-03 — Present a slide from a document

**Goal:** put a slide on the screen.
**Preconditions:** at least one document in the **[en:tran:Documents]** list.

1. In the left column, click a document in the **[en:tran:Documents]** list. It
   highlights, and its slides appear as thumbnails in the middle **[en:tran:Documents]** tab. That is the document
   open; nothing goes on the screen until you click a slide (step 2). 📸
2. **Click** a slide thumbnail. The slide goes live: it appears on the mini
   screen, and the live item is marked highlighted (on-screen indicator). 📸
3. To step through slides with the keyboard, click once in the thumbnail area, then press
   **→**, **↓**, **PageDown** or **Space** for the next slide, and **←**, **↑**, **PageUp**
   or **Shift+Space** for the one before. The preview scrolls smoothly to the selected slide, including after several quick
   Next presses or wrapping from the last slide to the first.
4. To remove the slide from the screen, press **F8** ([en:tran:Clear Slide]) or click
   the matching clear button (`SL`) in the mini screen's header.
   **The first card of a PowerPoint, PDF or Word document is blank, on purpose.** It is
   not a page of your document and takes no number: your own page 1 is the card after it,
   so a five-slide PowerPoint shows six cards. Presenting the blank card puts a blank
   slide on the screen.
   **What the projector shows is what the editor holds, saved or not.** A document you
   have changed and not saved carries a red `*` after its name, and the Presenter and the
   screen show it WITH those changes — the editor keeps your unsaved work on disk. To go
   back to the saved version press **[en:tran:Discard changed]** in the editor's row of
   buttons (it asks first, and it empties Undo as well), then present the slide again.
5. **Show the person on the stage what comes next.** A screen's **St:** number (the badge at
   the right of its mini screen's footer) decides how a slide is drawn on it, for every kind
   of document — a slide document, a PDF, a PowerPoint or a Word file — just as it does for a
   song (W-05):
   - **[en:tran:Stage] 0** — the slide exactly as it is.
   - **[en:tran:Stage] 1** — the slide, with its place in the document in the bottom-right corner
     (`3/12`, or `Welcome · 3/12` when the slide has a name).
   - **[en:tran:Stage] 2** — the slide at the top, the **next** slide smaller under it — at full
     brightness, not faded — and the count. The pair grows to fill the screen's height
     whatever shape the slides are, flush with its top left corner, no margin, and the
     slides touch — no gap between them, only each one's frame.
   - **[en:tran:Stage] 3** — the same with the next **two** slides.
   - **[en:tran:Stage] 4** — the next slide under it, without the count.
   - **[en:tran:Stage] 5** — the **previous** slide top left, the slide, and the **next** slide bottom
     right.

   As on a song's stages (W-05), the slides around the current one are never faded.
   On every stage that shows a count, **each** slide on the screen carries its own — the
   coming ones too (`2/7`, `3/7`) — in a large figure on a half-transparent dark pill.

   Set a stage monitor's **St:** to **2** and the singer always sees what is coming.
   Moving a screen to any stage above 0 also sets its **[en:tran:Slide]:** transition to **none**
   (W-10). To see
   it here first, click **[en:tran:Add Stage]** in the **[en:tran:Stage Previewer]** header
   above the slides and pick a stage: it arrives as its own chip and its own pane, side by
   side with **[en:tran:Stage] 0**, which always stays. The **×** on a chip
   (**[en:tran:Hide Stage] 2**) takes that pane away again, and **[en:tran:Add Stage]**
   brings it straight back. In a narrow pane — beside the Bibles tab, say — the header's
   title gives way first and **[en:tran:Add Stage]** folds to its **+**, so every chip stays
   in view. There is nothing to set on a document's stage — unlike a song's, its chips have no
   ⚙. Clicking a slide in any pane presents the same slide; each screen draws it at its own
   **St:**. 📸

Tips:

- The slider in the Documents-tab footer resizes the thumbnails.
- The stopwatch icon at the bottom left of the slide list — there once a slide is live —
  opens **auto-play**: set seconds, press play, and slides advance automatically; the
  red ✕ closes it (W-04).
- **Pin the document so you cannot lose it by a stray click** — see W-27.
- **Notes for yourself:** under the slide previews there is a thin green **[en:tran:Note]**
  strip. Click it and a **[en:tran:Document Note]** box (one for the whole document) and a
  **[en:tran:Slide Note]** box (one per slide) open below the slides. They are saved for you as
  you type and are **never sent to an audience screen**. The panel starts closed, so
  it costs nothing until you want it; to put it away again drag the divider above it
  down to the bottom edge, or untick **View → Widgets → Note** (W-31).
- **A slide that is the wrong shape for the screen.** A slide document keeps its own
  width and height, and one made for another display does not match yours. While a slide
  and the display differ, an amber button with a hammer — **[en:tran:Fix slide dimension]**,
  the sizes in its tooltip — shows in the row of buttons at the top of the slides, here
  and in the Slide Editor: press it and the slides that differ take the display's size,
  and the button goes away. One slide at a time is the Slide Editor's **Width** and
  **Height** boxes, with **[en:tran:Apply All Slides]** for the whole document.

_Verify: PL-01, PM-05..09, PM-54, PM-149, PM-157, ED-17, ED-39, KB-05, KB-08._

### W-04 — Auto-play slides on a timer

**Goal:** advance slides hands-free.

1. Open a document's slides and put one on the screen (W-03 steps 1–2) — the
   stopwatch is only there while a slide of that document is live.
2. Click the **stopwatch icon** at the bottom left of the slides previewer — a small
   strip opens: **✕**, play, the seconds box, the countdown, and a sliders button. 📸
3. Type the interval in seconds, then click **play**. Slides advance on the timer and
   the countdown says how long until the next one.
4. To change how it advances, click the **sliders** button. The rules open under the
   strip:
   - **[en:tran:Repeat All]** — keep going round. Unticked, the show stops at the last
     slide and leaves it on the screen.
   - **[en:tran:Step]** — how many slides each tick jumps.
   - **[en:tran:Random Up To]** — wait a random whole number of seconds up to this,
     drawn fresh for each slide. The draw is written into the seconds box before each
     wait, so you can see what it chose.
   - **[en:tran:Wait Until The Video Ends]** — clips only (Video Show, and a Videos
     background list): wait the length of the clip that is up. The seconds box shows
     that length.

   Close the rules with their **✕** or the sliders button again.

5. **Stop slides that are already advancing.** The timer strip is already open at
   the bottom left of the slides previewer, in place of the stopwatch. Click its
   **pause** button to stop, or its **✕** to stop and collapse it back to the stopwatch.

The same strip runs a show over a **[en:tran:Background]** list — **[en:tran:Images]**,
**[en:tran:Videos]** and **[en:tran:Webs]**, appearing once that list has something on a
screen — and over each **[en:tran:Image Show]** / **[en:tran:Video Show]** / **[en:tran:Web Show]** session, where it
rides the panel's top row. On the Webs list a saved **URL** is stepped just like a page
file.

_Verify: PM-10, PM-137, PM-138, PM-140._

### W-05 — Present song lyrics

**Goal:** put a song's lyrics on the screen.

1. In the left column, click a song in the **[en:tran:Documents]** list — songs carry a
   music-note icon. The middle **[en:tran:Documents]** tab switches to the song view: the lyric
   **[en:tran:Previewer]** on top and the **[en:tran:Stage Previewer]** verses under it. Only one file in the
   list is ever highlighted, so picking a song releases whatever was selected before.
   Those two show how the song will look on the screen; nothing reaches the screen
   until you click a verse. 📸
2. **Click** a verse to send it to the screen.
3. Press **F8** / the clear button to take it down.
4. To attach links to a song — web addresses, or files on this computer written
   `file:///C:/…` — open it in the **Lyric Editor** (right-click the song →
   **[en:tran:Edit]**) and add an **`- Attachments:`** field to its `ol:Config` block, one
   link per line. Each link also becomes its **own slide at the end** of the Stage Previewer,
   named after the link. A YouTube link becomes a playable video, an image / video /
   audio link becomes that media, and any other web address becomes the page itself;
   each fills the whole slide. Present one the same way you present a verse. A link to
   a file on this computer works too (written `file:///C:/…`), which is how a chart or
   a backing track travels with the song. 📸
5. Links the app cannot show — a PDF, or a line that is not a web address — still get
   their named slide, just an empty one.
6. **One song can be previewed at several stages at once.** **[en:tran:Add Stage]** in
    the Stage Previewer header opens the same menu the mini screen's **St:** badge does:
    **[en:tran:Stage] 0** to **[en:tran:Stage] 5** — a stage already on screen is listed but greyed out — and
    **[en:tran:Increment] · [en:tran:Stage] N** at the foot, which adds one past the highest stage you have.
    Increment is how you get past Stage 5, and it is what matches a screen whose **St:**
    number you have already pushed up there. Each stage arrives as its own chip and its
    own pane, in its own colour; the **×** on a chip (**[en:tran:Hide Stage] N**) hides
    that stage's pane again — its look under **⚙** is kept for when you add it back — and
    the padlocked **[en:tran:Stage] 0** stays. 📸
7. To change how a stage's slides **look**, click the **⚙** on that stage's chip
   (`Stage 0`, `Stage 3`, …) in the Stage Previewer header. A small **[en:tran:Stage Style]** window
   opens — drag it anywhere, it remembers where you left it. It sets **[en:tran:Slide Padding (%)]**,
   **[en:tran:Background Opacity (%)]**, **[en:tran:Extra Font Size]**, a **[en:tran:Light]/[en:tran:Dark]** theme, and a
   **[en:tran:Custom CSS]** box for anything else. 📸
8. These settings belong to the **stage**, not to the song — every song you open uses
   them, which is why the panel says _[en:tran:Applies to every song]_. **Every stage number keeps
   its own settings**, so you can leave the projected stage plain, make the chord stage
   larger, and give a third stage a dark theme for the person on the sound desk. Stage 0
   is the plain lyrics-only look; every stage from 1 up starts from the chord-and-notes
   look and differs only by what you set here. Custom CSS is **added to** the stage's
   built-in look rather than replacing it, so stage 0 keeps hiding its chords whatever
   you type.
   **Stages 2 to 5 show what comes next** around the verse being sung: 2 the next verse
   under it, 3 the next two, 4 like 2 in the plain look, 5 the previous one top left and
   the next one bottom right. The coming verse is at **full brightness**, not faded, and
   the verse sits flush in the screen's top left corner with the next one flush left
   under it, touching it — no margin around them and no gap between them, whatever **[en:tran:Slide Padding (%)]** says (the padding stays
   inside each verse's own box). A screen moved to any stage above 0 has its **[en:tran:Slide]:**
   transition set to **none** (W-10).
9. In that **[en:tran:Stage Style]** window — the **⚙** on the stage's chip in the Presenter's
   Stage Previewer — **[en:tran:Reset]** puts that stage back to the defaults.
10. A screen already showing a slide keeps it — present the slide again to push the new
    look out to it.
11. **Edit the words while the song is open and the verses follow by themselves; a verse
    already on the screen changes when you click it again.** Change the
    song in the **Lyric Editor** (right-click the song → **[en:tran:Edit]**) — or in any other window —
    and within a second or two the rendered song **and every Stage Previewer pane** show the
    new words, once the editor has saved them (**Ctrl+S**): the verses render what the
    song's file holds. You do not have to re-pick the song. A verse already on the
    screen keeps its old words until you click it again. 📸
12. If you ever need to force it — a song changed by something outside the app, say — the
    **⋮** at the right end of the Stage Previewer header holds **[en:tran:Reload]**, which re-renders
    every stage at once. The same **[en:tran:Reload]** sits in the right-click menu of a stage pane and
    of the rendered song above it.
    **How a song is written: its parts, and the order they are sung in.** In the Lyric
    Editor a song is plain text in blocks. Each part is a block of its own: a line of three
    backticks followed by `ol:` and the part's name — `ol:Verse 1`, `ol:Verse 2`,
    `ol:Chorus`, `ol:Bridge` — then its words, then a line of three backticks to close it.
    A chord goes in square brackets just before the syllable it falls on, like `[G]`.
    **The order it is sung in is its Structure line, in short codes such as V1CV2C, verse 1, chorus, verse 2, chorus.** The Structure line, in the first
    block (`ol:Config`, beside the song's **Title**), is the order the song is sung and
    shown in, so to change the order, change that line — the parts themselves stay where
    they are. Write it in short codes run together with NO spaces: `- Structure: V1CV2C`
    is verse 1, chorus, verse 2, chorus, and `x2` after a code repeats it (`Cx2`). The
    codes: Verse `V`, Chorus `C`, Pre-Chorus `P`, Bridge `B`, Intro `I`, Outro `O`, Tag
    `T`, Interlude `L`, Instrumental `IS`; a numbered part takes its number (`V2`), Intro
    and Outro take none.
    **The editor marks a mistake in red where it is.** It marks a Structure line that
    is empty, has spaces in it or names a part that has no block (`V3` with no
    `Verse 3`), two parts with the same name, and a chord it does not know — it knows
    `[Cm7]`, not `[Cm7b5]`, so write a chord it knows in its place. Put the marked
    line right and the red goes.

_Verify: PL-07..08, PM-11, PM-115, PM-116, PM-117, PM-127, PM-148, XW-08._

### W-06 — Look up and present a Bible verse

**Goal:** find a verse fast and put it on screen.

1. Press **Ctrl+B** (or click **[en:tran:Bible Lookup]** in the header). The
   lookup opens as a popup dialog. 📸
2. The input is a **step-by-step picker**. Click the empty box to see the book grid,
   then click the book, the chapter and the verse. These buttons use the names and
   numbers of the Bible version you chose, so this is the preferred route for a
   non-English Bible.
   > Tip: typing the first letters or a full reference such as `John 3:16` is a shortcut
   > when that Bible recognizes what you type. **Tab** completes the current part;
   > **Escape** clears it. The **[en:tran:Bible Reader]** page works the same way.
3. The verse renders in the preview panel. To present it, point at the passage's
   title (_John 3:16_) — its buttons appear over the end of the title — and click
   **[en:tran:Save bible item and show on screen]** (the cast icon), or just press
   **Ctrl+Shift+Enter**. The passage is saved to the **[en:tran:Bibles]** list as it goes up.
   To keep a passage without putting it on the screen, click **[en:tran:Save bible item]**
   (the floppy disk) beside it instead: it goes to the **[en:tran:Bibles]** list only. The
   Bible Reader's lookup has the same button.
   Double-clicking a verse only brings it into view; it does not present. 📸
4. The dialog closes by itself once the passage is saved, unless _[en:tran:Keep Open]_
   is ticked; to close it yourself use the red ✕ button or **Ctrl+Q**.
5. Press **F9** ([en:tran:Clear Long Text]) to take the verse off screen.
6. The presented verse also appears in the **[en:tran:Bibles]** tab (middle column) and the
   **[en:tran:Bibles]** list (right column) for re-presenting later.
   **More than one verse.** In the grid of verse numbers, click the first verse and then
   **Shift**-click the last one (or press on the first and drag to the last);
   **[en:tran:Show all verses]**, at the end of the grid, takes the whole chapter. Typed into
   the **[en:tran:Bible Reference]** box it is `John 3:16-18`.
   **A passage across chapters.** Type it the way you would say it —
   `John 1:50-6:3`, `John 1-3`, `John 3:16-4:2` — and present it as above. The
   projector shows the first three chapters, each starting with its chapter
   number on a thin rule. On the mini screen card the passage ends with **...**
   (**[en:tran:Show the next chapter]**): each press puts one more chapter on the
   projector. The projector itself never shows the **...**. From the projector
   window, **Ctrl+→** steps to the verse just after the passage (John 6:4) and
   **Ctrl+←** to the verse just before it (John 1:49).
   **The next verses, from the projector window.** Click the projector window itself and
   press **Ctrl+→** (or **Alt+→**): the screen moves on by as many verses as it is showing —
   John 3:16 becomes 3:17, John 3:16-18 becomes 3:19-21 — into the next chapter when the
   chapter ends, and **Ctrl+←** goes back. It only works while the main window is on the
   Presenter: from the Bible Reader, press **[en:tran:Go Back to Presenter]** first. Nothing
   on the mini screen card steps the verse; from the Presenter itself, present the next
   passage the same way you presented this one.
   **Another version on the screen.** If no passage is on the screen yet, press **Ctrl+B**,
   choose the book, chapter and verse, then press **Ctrl+Shift+Enter** to present it.
   On the mini screen card, each column of the passage
   begins with the short name of its version (`KJV`, say). Click that name and a list of
   versions opens. A plain click on one **changes** that column to it — it adds nothing.
   To put a second version **beside** the first, hold **Shift** while you click it
   (the list says **[en:tran:Shift Click to Add]** at its top). With two
   or more versions showing, the same list has a red row that takes that column away. From the keyboard, highlight a version in that
   list and press **Shift+Enter** to add it beside the others.
7. In a hurry, ask the app instead: open the assistant (**🤖**, W-42) and type
   _Put John 3:16 on the screen_ — or the command **/verse John 3:16**, which
   needs no assistant. The passage goes up in the version the lookup is on, and
   the answer says what is on the screen now; it is not saved to the **[en:tran:Bibles]**
   list. 📸

8. To make an editable slide document from a saved passage, first save one if needed:
   press **Ctrl+B**, choose the book, chapter and verse, then point at the passage's title
   to reveal its buttons and click **[en:tran:Save bible item]** (the floppy disk).
   Open that item's
   **⋮** menu in the Presenter's **[en:tran:Bibles]** list (the right column) and choose
   **[en:tran:Generate Slides]**. In the floating panel, tick every other Bible version
   you want on the same slides — one document holds them all, so this is done once, not
   once for each version. The original version stays selected. Enter an optional
   **[en:tran:Font Size]** in pixels, or leave it empty for **[en:tran:Auto]**.
   Choose **[en:tran:Dark]** or **[en:tran:Light]** under **[en:tran:Theme]** to set
   the generated slides' background and text colors. Both themes retain the
   translucent, inset background. 📸
9. Click **[en:tran:Generate Slides]** in the panel. The new document contains a
   title slide with the passage and Bible keys, then one slide per verse, with
   all selected versions together. Each version uses its own configured font.
   Compact margins leave room for the text; long verses resize to fit, with a
   consistent reading size throughout the passage, reducing your chosen size only
   when needed to fit. The upcoming verse appears
   at the bottom right in muted text at 85% of the current verse's font size.
   The last slide has no upcoming verse. 📸
10. Find the file in **[en:tran:Documents]**. Its name uses the English reference and all
    selected keys, for example `Genesis 1 3-5 KJV-ពគប.ows` (the colon becomes a
    space for the filename). Generating again adds a numbered suffix to preserve
    the earlier file. **[en:tran:Cancel]** closes the panel without creating a
    file. If a selected version lacks a verse, generation reports it without
    saving a partial passage.

_Verify: NAV-06..07, RD-02, PM-12, PR-02, KB-01..02, KB-06, KB-09, SC-03, SP-33, SP-34, CB-61, CB-131, CM-101._

### W-07 — Style the on-screen Bible text

**Goal:** change how verses look on the screen — their size, their colour, and
the edge or shadow that keeps them readable over a picture.

1. In the **[en:tran:Mini Screen]** panel, press **[en:tran:Reveal Hidden Controls]** —
   the three dots **⋯** at its bottom edge. The buttons under the Mini Screen
   are hidden until you do, and they stay up while the mouse is on them. The
   passage in the middle **[en:tran:Bibles]** tab has the same **⋯** under it,
   with the same button behind it.
2. In the row of buttons that came up, press **[en:tran:Bible Properties]** —
   the one with a book and a gear. A floating panel opens; there is no card to
   open inside it, and no separate colour for verse numbers. 📸
3. **Say what is behind the words.** The top of the panel shows a verse on a
   background. Press **[en:tran:Dark]** when the words go over a dark picture
   or video — they turn white — or **[en:tran:Light]** for a light background —
   they turn black. The look you had is kept and edged the other way round.
4. **Pick a look.** Each tile under the verse is two letters wearing it:
   **[en:tran:Normal]** is plain words; **[en:tran:Thin Outline]**,
   **[en:tran:Outline]** and **[en:tran:Heavy Outline]** edge the letters;
   **[en:tran:Soft Shadow]**, **[en:tran:Deep Shadow]** and
   **[en:tran:Hard Shadow]** drop a shadow behind them; **[en:tran:Lifted]**
   does both; **[en:tran:Glow]**, **[en:tran:Haze]**, **[en:tran:Halo]** and
   **[en:tran:Blue Edge]** put a soft light behind the words so they can be
   read over a busy picture. One press changes every screen at once, and the
   tile in use is ringed.
5. **Change the size.** Drag **[en:tran:Font Size]**, or type a number in the
   box beside it.
6. **Change the colour.** Press the small square at the end of the
   **[en:tran:Text Color]** row; a colour picker opens under it. Pick a colour
   and the words on the screen change at once. Press the square again to close
   the picker.
7. **Change how the words are set.** **[en:tran:Font Family]** is a list of
   the fonts on this computer: pick one and every verse is drawn in it; pick
   the first line of the list, `--`, to go back to each Bible's own font. Letters
   the font you picked does not have — Khmer under an English font — stay in
   the Bible's own. **[en:tran:Text Style]** has
   **[en:tran:Bold]** and **[en:tran:Italic]**; **[en:tran:Text Align]** puts
   the lines left, centre, right or justified; **[en:tran:Line Height]** and
   **[en:tran:Letter Spacing]** open the lines and the letters up.
8. **Make a look of your own.** **[en:tran:Outline]** is how thick the edge is;
   **[en:tran:Shadow Blur]**, **[en:tran:Shadow Offset X]** and
   **[en:tran:Shadow Offset Y]** soften the shadow and move it;
   **[en:tran:Glow]** is the size of the light behind the words. Each has a
   square for its own colour, and picking a colour switches that part on.
   Somebody who knows CSS can type a `text-shadow` in the
   **[en:tran:Text Shadow]** box instead.
9. **Keep it.** Press **[en:tran:Save as Preset]** — the last tile, with a plus
   — type a name and confirm. The look, its size and colour included, becomes a
   tile of its own, and pressing that tile later puts all of it back.
   Right-click a saved tile for **[en:tran:Rename Preset]**,
   **[en:tran:Replace with Current Look]** and **[en:tran:Remove Preset]**.
10. **[en:tran:Reset]**, at the bottom, goes back to plain words and keeps the
   size. The font goes back to each Bible's own.

_Verify: PM-13..14, PM-57, PM-159..162, SP-21._

### W-08 — Set the background (color / image / video / web)

**Goal:** put something behind your content.

1. Find the **[en:tran:Background]** panel at the bottom of the middle column,
   open with its tabs showing. If it has been folded to a thin bar, click the
   bar and the panel opens again. 📸
2. Pick a tab: **[en:tran:Colors] / [en:tran:Images] / [en:tran:Videos] / [en:tran:Cameras] / [en:tran:Webs]**.
   - **[en:tran:Colors]:** click a swatch. If the color could clash with the Bible text, the app
     changes the text color so it stays visible and says so in a message with its own
     **[en:tran:Undo]** — it asks nothing.
   - **[en:tran:Images] / [en:tran:Videos]:** **click** an item to make it the live background;
     click the same item again to take it off. 📸
   - **[en:tran:Cameras]:** pick a connected camera device.
   - **[en:tran:Webs]:** click a saved page, or use the **⋮** next to the folder path (or
     right-click the empty list) → **[en:tran:Add URL]** to add one (a small box asks for the
     web address; the Web Editor, W-15, is for a page file of your own).
     **A saved address cannot be edited.** To change it, right-click its tile →
     **[en:tran:Remove URL]** (it asks first, and is not offered while that page is on a
     screen), then **[en:tran:Add URL]** with the new address — on the tab's **⋮** at the
     right of the folder path, or a right-click on an empty part of the list.
3. The live background's tab carries the on-screen dot before its name (e.g. `● Videos`).
4. Press **F7** ([en:tran:Clear Background]) to remove it.

**Thumbnail view vs list view (Images / Videos / Web).** By default each tab shows
picture previews. If you have a lot of files — or the app feels slow on an older
machine — switch to a plain name list: click the small **⋯** button at the bottom-left of the Background panel
(**[en:tran:Reveal Hidden Controls]**) to bring up the footer bar, then
click the **list** icon (`☰`, **[en:tran:List View]**) at its far right; the **grid** icon
beside it (**[en:tran:Thumbnail View]**) switches back. 📸 The list shows each file's full name (with its extension), which screens it is
showing on, and its colour dot — clicking a row still puts it on screen exactly like a
thumbnail. Each tab remembers its own choice, and it survives restarting the app. The
thumbnail-size slider only appears in thumbnail view.

**Folder sessions (Images / Videos / Webs / Audios).** Above each of those lists is a
row of small buttons: **[en:tran:Default]**, then any you add with **＋**. Each one is a folder of
its own — with its own view mode, sort and slide show — so you can flick between this
Sunday's pictures on a memory stick and your standing set of backgrounds without ever
re-pointing the folder the app was set up with. **[en:tran:Default]** IS that folder: it is the
one Path Settings names, and adding sessions never touches it. A new session starts with
no folder and offers to use the default one. To point a session at a folder of your own,
press the folder line above the list (the path it is reading): a box opens under it — type
the folder's path and press Enter, or press **[en:tran:Choose a folder]** (the folder icon)
and pick it. The **⋮** on the session you are on (or a
right-click on any of them) renames or removes it. Removing forgets that session's
folder and slide show — never the files themselves. On the Images, Videos and Webs tabs
the slide show sits on the same row, and a blue ▶ on a button means that session's show
is still running while you look at another one.

_Verify: PM-26..33, PM-101, PM-114, PM-144, PM-145, KB-04._

### W-09 — Play audio, and foreground extras (countdown, clock, marquee bottom…)

**Goal:** run service extras.

**Audio:** in the Background panel, toggle the **[en:tran:Audios]** tab open, click a track
to open its player and press play — the tab is marked while playing; pause it to end. 📸

**Foreground widgets** — press the middle **[en:tran:Foreground]** tab and a menu
opens **at the cursor** listing every component. Pick one and it opens in **its own
floating panel**, which remembers its size and place across a restart; the menu closes
itself. Open as many as you like side by side — the panels are independent. The menu is
also the status board: a ticked box marks a panel that is already open, a component with
something on a screen is marked the way the tab is **and carries the number of each
screen it is on**, and a blue ▶ marks a component whose slide show is running — which is
how you find a show that is still advancing behind a panel nobody has open. The panel
itself has no second title bar to collapse: its own header carries the name, the
on-screen mark and the close button. Each panel has its own controls and a Show/Start
button:

- **[en:tran:Marquee Top]:** type the scrolling text, click
  **[en:tran:Show Marquee Top]** — it scrolls along the top edge.
- **[en:tran:Marquee Bottom]:** type the scrolling text, click
  **[en:tran:Show Marquee Bottom]** — it scrolls along the bottom edge. Top and bottom can be shown at the same time.
- Both marquees expose a **scroll speed** (%) under _Properties_: `100%` is the default
  pace, higher is faster, lower is slower. Changing it while a marquee is showing
  re-paces it without having to click Show again.
- **[en:tran:Quick Text]:** type a short message, click **[en:tran:Show Quick Text]**.
- **[en:tran:Countdown]:** two modes. _To a date/time_: set date + time and press
  **[en:tran:Start Countdown to DateTime]** — it starts at once and always counts to that
  clock time. _For a duration_: set the **h**, **m** and **s** boxes (more than 24
  hours is fine: 25 h reads `25:00:00`) and press
  **[en:tran:Show Countdown]** — it goes up STOPPED on its full length (`00:05:00`), so it
  can be put up early and started on the cue. While it is on a screen,
  **[en:tran:Start]**, **[en:tran:Pause]** / **[en:tran:Resume]** and **[en:tran:Reset]**
  (back to the full length, stopped) sit under the button, with a word saying whether it
  is _[en:tran:Not started]_, _[en:tran:Running]_ or _[en:tran:Paused]_. Turn on
  **[en:tran:Auto-start]** and the button reads **[en:tran:Start Countdown]** and it counts
  the moment it is shown. When it reaches zero the digits flash red five times (about ten
  seconds) and then stay red; they hold `00:00:00` for one
  second, then count the time OVER behind a **+** (`+00:01:23`) until you
  hide it. The audience sees only the digits — a paused countdown simply stops. Hide
  with its Hide button. 📸
- **[en:tran:Stopwatch]:** the same controls. **[en:tran:Show Stopwatch]** puts it up on
  `00:00:00`, stopped (running at once with **[en:tran:Auto-start]**), then
  **[en:tran:Start]** / **[en:tran:Pause]** / **[en:tran:Resume]** / **[en:tran:Reset]**
  (back to zero). **[en:tran:Reset]** first SAVES the time it read into a
  **[en:tran:History]** list under the buttons — newest on top, numbered, with the time
  of day it was reset (in the app's language; in Khmer as numbers, e.g. `04/10 07:57`) — so the 7:42 a testimony ran is not lost with the zero. Each
  session keeps its own list (the last 20; a reset under one second is not kept), and
  **[en:tran:Clear]** beside it empties it after a confirm.
- **[en:tran:Time]** (the clock): same pattern — configure, Show, Hide.
  **[en:tran:Choose City]** puts the city's name above the clock in words
  (`Phnom Penh`) with its time; **[en:tran:Use Current Timezone]** goes back to
  this computer's time and takes that name away with it (a name you typed
  yourself stays). AM/PM is written in the app's language. A long name wraps
  inside the box instead of being cut off. With more than one clock, each
  **[en:tran:Show Time]** button is numbered for a screen reader, like its
  remove button. A clock added with **[en:tran:Add Time]** starts in a place
  of its own — the first clock in the middle, the next at the top, then the
  bottom — so two clocks shown together never sit on top of each other; move
  one under **[en:tran:Properties]** if you want it elsewhere.
- **[en:tran:Camera Show]**: same pattern — configure, Show, Hide. A camera that
  another program is holding says so in its tile instead of loading for ever.
- **[en:tran:Screen Show]:** what one screen holds, shown on another —
  screen 1's slide in the corner of screen 0. The panel has one card per
  screen, in that screen's own colour with its number. Click a card to
  put that screen on the selected screen, or press its **⋮**
  (**[en:tran:Show on Screens]**) to choose. Place and size it under
  _Properties_ like any other overlay. It shows that screen's
  background, slide, Bible text and overlays as they change, **even
  while that screen is hidden** — a screen that is up nowhere else can
  be shown only inside another. Where that screen draws nothing,
  the one beneath shows through. A screen never shows itself, and two
  screens never show each other: the app refuses with
  **[en:tran:A screen cannot show itself]** or
  **[en:tran:These screens would show each other]** instead. It never
  carries sound: the screen it shows plays that. Take it off with
  **[en:tran:Hide Screen Show]**. 📸
- **[en:tran:Video Show]**, **[en:tran:Image Show]** and **[en:tran:Web Show]:** a clip,
  a picture or a web page shown _over_ the slide instead of behind it. Each lists a
  folder the same way the Background tabs do — only the rows on screen are built, so a
  folder of thousands opens as fast as a folder of ten. Click a tile to put it up,
  click it again to take it off, right-click to choose a display. A clip plays muted
  and loops.
  **The volume of what is playing.** A track from the [en:tran:Audios] tab has no
  volume slider of the app's own: it is as loud as the computer's volume, so turn
  that up or down. A [en:tran:Video Show] clip has one. Open it from the
  [en:tran:Foreground] tab, open _[en:tran:Properties]_ in its panel and tick
  **[en:tran:Play With Sound]**: a **[en:tran:Volume]** slider appears under it, and
  that slider is the clip's volume.
- **Sessions — every foreground component keeps them**, except [en:tran:Camera Show] and
  [en:tran:Screen Show], which lay out one card per camera and per screen instead. They are
  the row of buttons pinned at the top of the panel, with **＋** to add one, and a session is one saved
  set-up of that panel: its **own** words or numbers **and** its **own**
  _Properties_ (size, place, colours, effects). So **[en:tran:Messages]** holds the
  pre-service notice board in one session and the mid-service alerts in another;
  **[en:tran:Countdown]** holds the five-minute one that starts the service beside
  the one counting to a date; **[en:tran:Marquee Bottom]** holds the standing welcome
  beside this morning's car-park notice; **[en:tran:Time]** holds a wall of world
  clocks beside the single service clock. Nothing has to be retyped over the set-up
  that was working. On **[en:tran:Video Show]**, **[en:tran:Image Show]**
  and **[en:tran:Web Show]** a session also owns its **own
  folder** and its **own slide show**, so one can run a show over your backgrounds
  folder while another holds a logo from somewhere else, both on screen at once.
  Setting a session up puts nothing on the screen: its show button does that, when
  you want that one.
- Right-click a session (or press its **⋮**) to rename or remove it. Only one session
  is shown at a time, so each button carries its own marks: the on-screen dot when
  that session has something up, and a blue ▶ while its slide show is advancing —
  that dot is the only sign of something live belonging to a session you are not
  looking at. Removing a session **takes what it put up off the screens first**, so
  nothing is left behind with no button to hide it.
- A session's _Properties_ and its Hide row act on **that session's own overlay and
  nothing else**. Changing size, colour or place on one session never re-dresses
  what another session has on the wall, and a session with nothing up shows no
  Hide button at all. To take down what another session put up, press the session
  button carrying the on-screen dot and use the Hide button there. Something that
  went up with no session (a dragged run-sheet row, the assistant) belongs to the
  first session button, which is **[en:tran:Default]** unless Default was removed.
- **[en:tran:Messages]** and **[en:tran:Time]** hold several items per session
  (several message editors, several clocks), so two sessions can each have something
  up at once, each listed on its own session's Hide row. **[en:tran:Countdown]**,
  **[en:tran:Stopwatch]**, **[en:tran:Quick Text]** and the two marquees put **one**
  thing on a screen, so showing from another session replaces what was there and the
  on-screen dot moves to the session that now owns it. **[en:tran:Image Show]**,
  **[en:tran:Video Show]** and **[en:tran:Web Show]** hold one file per session: clicking
  another tile replaces it. Two pictures up at once — an overlay and a logo — are two
  sessions: add one with **＋** and show a picture from each.
- The **[en:tran:Properties]** panel sits once beside the session buttons and governs
  every item that session shows — position, width, scale, opacity, corner and blend.
  That whole row — sessions, _Properties_, the slide show and the screen buttons that
  take the item off — **stays put while the file list scrolls**.
- **[en:tran:Always on Top]** (every foreground component, not just these — under
  _[en:tran:Properties]_ in its own panel) keeps a
  widget over the others whatever order they went up in — a logo above the falling
  snow. The number beside it separates two that are both on top: the higher wins.
- **[en:tran:Behind Slide]** (every foreground component: under _Properties_ in its
  own panel, right above _Always on Top_) puts that session's item **behind** the slide and the Bible text — over the
  background, under the words — so a logo, a clock or a falling-snow clip never covers
  the lyrics. Tick it while the item is up and it moves at once; untick it and it comes
  back over the slide. A slide that fills the whole screen with its own picture hides
  it completely, which is the point. While it is ticked, _Always on Top_ is greyed out:
  an item behind the slide stays behind it, whatever its number.
- The slide show sits in the row of session buttons at the top of the panel once the
  session has something on a screen:
  **[en:tran:Start Slide Show]** and the seconds beside it. It keeps running while you
  are looking at another session, or with the whole Foreground panel closed, and stops
  by itself when that session's item is cleared. The file list is **not** scrolled to
  follow it — the tile that is up is marked when it happens to be in view, and the list
  stays where you left it so you can keep looking for the next picture while the show
  runs.
- **[en:tran:Blend Mode]** (under _Properties_ on Video Show, Image Show, Camera Show,
  Screen Show and Web Show) decides how the overlay mixes with whatever is under it. It is the
  answer to a clip that has a black background: pick **[en:tran:Screen Blend]** and the
  black drops out, leaving only the falling snow, sparks or light over the live slide.
  **[en:tran:Multiply]** does the opposite — white drops out. **[en:tran:Normal]** is
  the plain overlay that covers what is beneath it.
- **[en:tran:Effects]** is a fold under _Properties_, on **every** component, and it
  dresses the overlay: a **[en:tran:Border]** (style, thickness, colour), a
  **[en:tran:Shadow]** (Soft / Medium / Strong / Glow, with a colour of its own) and
  **[en:tran:Padding]** — the room between what is shown and the edge of its own box,
  measured in text sizes so it keeps its proportions when you change the font size.
  On the components that put WORDS on the screen there is more:
  **[en:tran:Text Align]**, **[en:tran:Line Height]**, **[en:tran:Letter Spacing]**,
  a **[en:tran:Text Shadow]** (Soft / Glow / Outline) — which is what makes a notice
  readable over a busy picture or a moving video — and **[en:tran:Text Style]**:
  italic, underline, UPPERCASE. The fold carries a dot while anything inside it is
  set, so a look you cannot find is never the reason a message looks wrong. 📸
- The shared properties row (font size / color / position) restyles the live widget.
- Power move: **drag** a widget's Show button and **drop it on the mini screen** to
  start it there; **right-click** the button to choose a specific display.

Press **F10** ([en:tran:Clear Foreground]) to clear all foreground widgets, or **F6** to clear
everything at once.

**Or ask for it.** In the help window (🤖), _Start a 5 minute countdown on the
screen_ or _Put the time on the screen_ starts the extra straight away and reads
the screen back — it is held even while the screen is off, and the screen's own
show button is offered, never pressed unasked. **/countdown 5**, **/countdown
10:30** and **/marquee Please silence your phones** do the same with no assistant,
and **/countdown stop** or **/clear-foreground** takes it off again (W-42 step 6).

_Verify: PM-15..25, PM-28, PM-34, PM-128..PM-133, PM-146, PM-147, PM-150, PM-151, PM-152, PM-153, PM-158, KB-03, KB-07, CB-67._

### W-53 — Show a song in several languages for everyone to sing (Long Text Show)

**Goal:** put one text — usually a song — on the screen in two or more
languages side by side, each part beside its translation, and let it scroll
while the room sings.

**Quickest for one song:** right-click it in the **Documents** list and choose
**[en:tran:Long Text Show]**. The panel opens on a new session named after the
song, holding it as an **EN** card read from its **[en:tran:Lyric File]**, and
**[en:tran:Show Long Text]** is on as soon as the card has read the song — go
on at step 5, or at step 2 to put a translation beside it. Each press makes
another session; the ones you no longer need are removed from their tab's
menu.

1. Open the **[en:tran:Foreground]** tab and choose **[en:tran:Long Text Show]**
   in the menu. Its panel opens.
2. **Add the languages.** Press **[en:tran:Add Language]** and pick one; press it
   again for the next. Each language gets a card of its own, named by its code
   (KM, EN), and a language can be in the list only once. The top card is the
   left column on the screen; the arrows on a card move it, and its ✕ takes
   that language out.
3. **Give each language its words**, one of two ways, chosen on its card:
   - **[en:tran:Raw Text]** — type a **[en:tran:Title]**, then one box per
     section (a verse, a chorus). **[en:tran:Add Section]** adds the next box;
     the ✕ beside a box removes it and the arrows move it. A line break in a
     box is a line break on the screen.
   - **[en:tran:Lyric File]** — press **[en:tran:Choose Lyric]** and pick one of
     the songs in your Documents list. The card then says the song's title and
     how many parts it sings. The words come from the song in the order it is
     SUNG, so a chorus sung three times is there three times. Chords are left
     out, and so is a part that has chords and no words (an intro, an
     instrumental).
4. **The languages have to line up.** Until they do,
   **[en:tran:Show Long Text]** stays off and the panel says the first thing
   that does not match: typed languages need the same number of sections, none
   of them empty, and two songs need the same parts in the same order. It
   reads like this: _The songs do not have the same structure: 1. KM Verse 1 ≠
   EN Intro_.
5. Tick the screen in the Mini Screen panel and press
   **[en:tran:Show Long Text]**. Each language is a column under its title and
   each section is a numbered row, so a verse sits beside its translation. 📸
   It takes the place of a Bible passage or a slide on that screen.
6. **Let it scroll.** On the Mini Screen card, press the double arrow at the
   bottom right of the picture: the text starts moving up by itself, on the
   screen too.
7. **Jump to a part.** Every card lists its parts as buttons — `1 Verse 1`,
   `2 Chorus` … on a song, the section's own number on typed text. While the
   text is on a screen, press one and that row is marked, faintly, and
   brought to the middle of the screen in every language. The button you
   pressed stays lit, on every language's card, so the panel shows where the
   song has got to. A chorus sung twice
   has two buttons, and each goes to its own row. On a song's card each
   part starts as a card holding that part's words, run on in one line with
   a slash between its lines, for following the song by its words — press
   anywhere on a card to bring it to the middle. The first button of that
   row, **[en:tran:View as Text Cards]**, turns them into small buttons
   with only the part's name, and back; the card remembers which.

   **Step with the keys.** Once you have pressed a part, its button has the
   keys, the way the slides do: **Space**, **→**, **↓** or **Page Down**
   presses the next part's button, and **Shift+Space**, **←**, **↑** or
   **Page Up** the one before. The light and the keys move along with it, on
   the card you pressed, so you can follow the song from the keyboard or a
   presenter remote. It stops at the last part, and at the first: it never
   goes round to the beginning. A part that is not lit keeps its own keys —
   **Space** presses that one.
8. **Give a language its own look.** Open **[en:tran:Properties]** on its card:
   **[en:tran:Font Family]**, **[en:tran:Text Color]**,
   **[en:tran:Text Size (%)]** (its size beside the other languages — 80 makes
   it a little smaller) and **[en:tran:Text Align]**. A change reaches a
   showing text about half a second after you stop. Whatever you leave alone
   follows the screen's own Bible text style.
9. **Change the words.** Edit a card and press **[en:tran:Show Long Text]**
   again: what is on the screen is the text as it was when you last pressed it.
10. **Take it down.** **[en:tran:Hide Long Text]** beside the show button, or
    **[en:tran:Clear Long Text]** (the **LT** button) or
    **[en:tran:Clear Foreground]** (**FG**) on the Mini Screen card.
11. The tabs at the top of the panel keep several texts — a song a tab — each
    with its own languages and looks.

_Verify: PM-163, PM-164, PM-165, PM-166._

### W-10 — Control what the audience sees (mini screen + clears)

**Goal:** manage the live output from the screen preview card.

- The **mini screen** (right column, bottom) mirrors the audience view; the
  zoom slider under it only rescales your preview, not the output. 📸
- Behind everything the card draws sits **that monitor's own desktop wallpaper**.
  The audience screen is a transparent window, so wherever you have put nothing
  up this is genuinely what the room would see. Right-click an empty part of the
  mini-screen panel (or press the **⋮** at its bottom-right) → **[en:tran:Show Monitor Wallpaper]**
  turns it off and puts the plain checkered pattern back — that is all it takes.
  **[en:tran:Refresh Preview]** in the same menu is for something else: it re-reads the
  wallpaper after you change your desktop background. A machine
  that will not say what its background is keeps the pattern.
- Each screen has its own preview card with a **header** and **footer** of controls:
- **Show / hide the screen** (header, leftmost — or press **F5**): turns the physical
  output display on or off. The toggle acts on its own screen; **F5** acts on the
  **selected** screens (every screen when none is selected) and turns them all the
  same way: on only when all of them are off, otherwise all off.
  An unselected screen stays as it is when another screen is selected. The icon fills in and brightens while showing. It is
  the control named **[en:tran:Toggle showing screen]** — say those words when
  telling someone which one to press, because several other things in this window
  are also called "Show". 📸
- **Hide every screen.** In the Presenter's mini-screen panel (bottom right), check
  every screen card, including unselected ones. On each card whose leftmost header
  button **[en:tran:Toggle showing screen]** is filled and bright, click it once to
  hide that screen; leave an unlit button alone. When every such button is unlit,
  all screens are hidden and their content is kept. **F5** is a toggle for the
  selected screens, so use these individual buttons to hide every screen safely.
- **Clear buttons** (header — each also has a function key):
  **Clear All `F6` / BG `F7` / SL `F8` / LT `F9` / FG `F10`**
  ([en:tran:Clear All] / [en:tran:Clear Background] / [en:tran:Clear Slide] / [en:tran:Clear Long Text] / [en:tran:Clear Foreground]).
  A button is only lit while its layer has something to clear. **LT** is the
  long text layer: a Bible passage, or the text of a
  **[en:tran:Long Text Show]**.
- **Stop drawing the preview** (header, the eye right after **FG** —
  **[en:tran:Stop rendering preview]**): for a slow computer. Click it and that card
  stops drawing: its body turns into a striped pattern that says
  **[en:tran:No rendering]**, while the audience screen goes on showing everything.
  Every other button on the card still works, the clear buttons still light up, and
  whatever you present from the lists still goes to the screen — only the picture
  of it here is gone, and with it the work of drawing it twice. A slide's video or
  audio still plays its sound as before, but its play button is part of the picture:
  click the slashed eye (**[en:tran:Resume rendering preview]**) to bring the
  picture back and start one by hand — the card picks up exactly what is on the
  screen, and a clip that was playing carries on. The card remembers the choice for
  that screen, even after a restart. 📸
- **[en:tran:Lock]** (header, the padlock): when locked (red), the screen refuses slide changes —
  handy during a live moment; click again (green) to unlock. A change it refuses says
  _[en:tran:Screen Manager is locked]_ in a message with its own **[en:tran:Unlock]**: pressing it
  unlocks the screens and closes the message.
- **Display** (footer, e.g. `(0):2678…`): click to pick **which physical display** this
  screen projects to — the menu lists every display with its resolution, and marks the
  current one with `*` and the primary one with `(primary)`.
- **Nothing on the projector?** Check its card from the top: it is showing
  (**[en:tran:Toggle showing screen]**, or **F5**); its footer's **Display** names the
  projector, not this computer's own screen — pick it there; and something is on it — a
  lit clear button says which layer holds something.
- **Transitions** (footer, `Tr:`): the **[en:tran:Slide]:**, **[en:tran:Background]:** and
  **[en:tran:Foreground]:** buttons choose the change animation for that screen —
  **none / fade / move / zoom**. They are the fallback: a document, a slide, a
  Background tab, one background, a foreground panel or one of its sessions can
  carry its own transition instead (W-48). 📸
- **Background audio** (footer, the soundwave icon — appears while a video background
  is live): opens a small player per video to play/pause its audio in sync; the
  repeat icon loops it. The app refuses to close the player while audio is playing.
- **Stage number** (footer, `St:`): click to assign this screen a stage number
  (0–5, or increment/decrement) for stage-view setups. Moving a screen to any stage
  above 0 also sets its **[en:tran:Slide]:** transition to **none**, and a note in the
  corner says so; you can pick another one
  afterwards, and going back to stage 0 leaves the transition as it is. A document's
  or a slide's own transition (W-48) still wins over it.

_Verify: PR-04..07, SP-01..09, SP-23, SP-24, KB-03..07, KB-13._

---

## Bible study

### W-11 — Read the Bible (references, text size, history, versions)

**Goal:** look up and read a verse in the Bible Reader — deeper reading than the
quick lookup, and where you look a verse up when you are not presenting.
**Where:** the **[en:tran:Bible Reader]** page. If you are on the Presenter,
click its **[en:tran:Bible Reader]** header tab to get here; the Reader itself
has no header tabs.

1. In **[en:tran:Bible Reader]**, click the **[en:tran:Bible Reference]** box at the top. If it already
   contains a reference, click **[en:tran:Clear input]**. Click the book, then the chapter, then
   the verse from the buttons that appear; the passage opens. This is the preferred
   route for a non-English Bible because the buttons use that Bible's own names and
   numbers. 📸
   > Typing a full reference such as `John 3:16` is an optional shortcut when the
   > selected Bible recognizes it. **Tab** completes a piece, **Escape** clears the
   > last piece and **Shift+Escape** clears the box.

   **A passage that runs on into later chapters of the same book.** Type its
   first verse and its last verse, each with its chapter: `John 1:50-6:3` is one
   passage, from John 1:50 to John 6:3. `John 1-3` takes chapters 1 to 3 whole,
   `John 1:-2:` runs from 1:1 to the end of chapter 2, and a dot does what a colon
   does (`យ៉ូហាន ១៨.៣៩-១៩.១៦`). Each chapter of it starts under a line with the
   chapter's number, `─ 2 ─────`. A passage over more than three chapters opens
   with the first three and a **...** button under them
   (**[en:tran:Show the next chapter]**): each click adds the next chapter, and
   the button goes once the last one is shown. 📸
   **Open a reference in a section heading.** Some Bibles print references in their section headings — `(… យ៉ូហាន
   ១៨.៣៩-១៩.១៦)` under a heading of Mark 15. Click one and the whole passage it
   names, every chapter of it, opens in a small floating panel; the passage you
   are reading stays as it is.
2. If the words are too small, click the small **⋯** at the bottom-left of the
   passage to open the hidden controls. Then press and hold the
   **[en:tran:Font Size]** slider, move it to the right, and let go when the words are
   large enough.
3. To read two Bible versions side by side in one pane, click **[en:tran:Add Extra Bible]**
   beside the version name, then click the version you want. 📸
4. **Panes that share a color scroll together.** In the Bible Reader, click the dot
   at the start of the passage pane's header (**[en:tran:Color Note]**) and pick a color.
   Point at that header to reveal its buttons, click **[en:tran:Split Horizontal to]**
   or **[en:tran:Split Vertical to]**, then choose another Bible version. The new pane
   joins the same color group. Scroll either pane: the other version follows the same
   verse. If it does not follow, turn on **[en:tran:Sync group scrolling]** with the
   small up/down arrows directly below the color dot.
   The color, sync-scroll and audio icons are dimmed until you hover over
   their group or reach one of them with the keyboard.
   It starts enabled: scroll any pane and the other translations move along
   with it, smoothly and continuously, keeping the same verse at the same
   height. When it reaches the top or the end of the passage, they reach theirs
   too. Scroll another member to make it lead; the others glide into line with
   it instead of jumping. Click the arrows in any member to turn following off
   for the group; the previous scrolling behavior remains. Click again to turn
   it on: the group immediately glides into line with the pane where you
   clicked, without needing another scroll.
   The choice is remembered for that color group, and the toggle appears only
   while the group has at least two panes.
   **A pane that has a color splits into ANOTHER version.** Its two split buttons,
   in the row that appears while the mouse is over its header, read
   **[en:tran:Split Horizontal to]** and **[en:tran:Split Vertical to]**: click
   one, then click a version in the list, and the same passage opens beside (or
   below) it in that version, in the same color group. A pane with no color
   splits at once, in the version it already has — its buttons read
   **[en:tran:Split horizontal]** and **[en:tran:Split vertical]**.
5. If you lose a passage, you do not need to remember and type it again: the recent
   reference rows near the top keep it. Click one to read it in a small floating
   panel, in the version it was read in; the passage you are on stays as it is. To
   go back to it, open that row's **⋮** (or right-click it) and choose
   **[en:tran:Set to current editing]**. **[en:tran:Open beside the current verse]**
   in the same menu opens it next to the passage you are on instead.
6. To change the main Bible version, click its short name in the header and choose a
   version from the list. 📸
7. To read without the side panels, click the small **⋯** at the bottom-left if the
   footer is hidden, then click **[en:tran:Full]** at the bottom-right. Click
   **[en:tran:Exit Full]** to bring the panels back.
8. The Bible Reader does not put a verse on the audience screen: double-clicking a verse
   here only selects it. (A double-click means pressing the left mouse button twice
   quickly in the same place.) To show a verse to the audience, go back to the Presenter
   and present it from there (W-06). To keep a verse for later, point at the top right of
   the Bible Lookup and click **[en:tran:Save bible item]** (the floppy disk), or press
   **Ctrl+Enter**: it goes to the **[en:tran:Bibles]** list, ready to present from the Presenter.
9. To let supported passages start their generated audio automatically, open
   **[en:tran:Setting]** → **[en:tran:Others]** → **[en:tran:AI Providers]**. After an **OpenAI API
   Key** is saved, turn on **[en:tran:Auto Play Audio AI when available]** under
   the OpenAI key. The switch lives with the provider setting, not in the Bible
   Reference toolbar.

_Verify: RD-01..07, RD-11, RD-19, RD-21, RD-29, RD-38, RD-122, RD-124..126, ST-59, CB-125._

### W-12 — Search the whole Bible (Bible Find)

**Goal:** find verses by words, not reference.

1. In the Bible Reader (or the lookup dialog), click **[en:tran:Advance Bible Lookup]** (the
   binoculars at the top right of the lookup) to open **[en:tran:Advance Lookup]**,
   the rightmost horizontal section beside **[en:tran:Bible and Notes]** and
   **[en:tran:Bible Lookup]**. Choose **[en:tran:Find]** in its dropdown; it remembers
   the last study view used. The binoculars mirror the section's open/closed state. 📸
   Close or resize it with its divider just like the other sections, and click its
   collapsed **[en:tran:Advance Lookup]** strip to reopen it. The toolbar stays available
   above the sections, even with **[en:tran:Bible Lookup]** collapsed.
2. Type your search words. Every verse containing them is listed, with **the word you
   searched for marked** in each one, so you can see at a glance why a verse is there.
   The reference — _Psalm 23:1_ — leads each result; clicking anywhere on the result
   opens that verse in a small floating panel, in the version you searched, and the passage
   you are reading stays as it is. Its **⋮** menu has **[en:tran:Open]**, which does the same,
   and **[en:tran:Open beside the current verse]**, which opens it as a passage beside the one
   you are reading. 📸
3. The bar under the results, at the bottom of the panel, says how many verses matched — **74 [en:tran:verses found]**.
   Use it to judge whether to narrow the search: a common word runs to tens of
   thousands. If a completed search has no matches, the panel says
   **[en:tran:No verses found]**. Try different words or widen the book filter.
   To clear the search and start again, empty the words in the search box: the panel
   then shows **[en:tran:No data available]**, ready for new words. 📸
4. Results arrive in blocks of twenty, each headed **[en:tran:Results] 1–20**, **[en:tran:Results] 21–40**
   and so on. The numbers at the bottom right move you through them: a **filled** number
   is a block already on screen, so clicking it scrolls straight there; a **plain**
   number has not been fetched yet, and clicking it loads that block in below. Only the
   numbers near where you are, plus the first, the last, and the blocks you have
   loaded, are listed — the rest sit behind **…**, which is a button: it names the
   blocks it is holding (_Show pages 4–139_) and clicking it lists them all. On a find
   big enough to run to thousands of blocks it opens in steps instead, and clicking a
   **…** between two steps opens that stretch — so any block is a click or two away
   without the app ever drawing a thousand numbers at once. 📸
5. To search part of the Bible only, in the **[en:tran:Find]** view of step 1, click the **[en:tran:All Books]** button
   and pick a book — **Shift**-click to pick several, or choose **[en:tran:Old Testament]** /
   **[en:tran:New Testament]** for a whole half. Once a filter is on, the button shows a funnel
   and the books you chose; while it says **[en:tran:All Books]** it stays plain, so a narrowed
   search never hides in plain sight. 📸
   The **⋮ [en:tran:More Options]** button beside it offers **[en:tran:Reset Selected Books]** to go back
   to the whole Bible, and **[en:tran:Reset Search Data]**, which rebuilds the search index —
   that one takes a moment and reloads the app.
   **To put a result on the screen.** Search in the Presenter's Bible Lookup — open it with
   **[en:tran:Bible Lookup]** at the top of the Presenter, or **Ctrl+B** — because the
   Bible Reader puts nothing on the audience screen (W-11). There, open its search with the
   binoculars and **[en:tran:Find]**, as in step 1, and type your words. A result has no show button of its own. Open its **⋮**
   menu and choose **[en:tran:Open beside the current verse]** — it opens as a passage in the
   lookup — then, in the Presenter, point at that passage's title and press the cast icon,
   **[en:tran:Save bible item and show on screen]**, as for any passage (W-06 step 3).
6. **Cannot remember the words exactly?** Press **[en:tran:Find a Verse with the Assistant]** —
   the robot at the right end of the **[en:tran:All Books]** row. The help window opens a chat of
   its own and asks **Which Bible should I search?**, the one Find is on first. Press one, then
   type what you remember: a few of its words in any order — _love enemies pray_ — or what the
   verse is about — _Jesus asked Peter three times if he loved him_. The assistant searches that
   Bible, and the internet when it cannot place the verse there, and quotes only verses it found
   in YOUR Bible; under its answer each one has **Open … in Bible Lookup**, which opens it in the
   lookup and puts nothing on a screen. Say more under the answer — _no, it was about sheep_ — and
   it searches again. Under every answer, **Show in another Bible** — **Search another Bible**
   when nothing was found — lists the other Bibles on this computer: press one (English, say,
   when you were searching a Khmer one) and the verses found are shown from it, or what you
   typed is searched in it, with nothing to type again; the search then goes on in that Bible.
   With no assistant set up, the window searches your words itself and lists
   the verses that hold the most of them, with **Search Google for it**. 📸
   You can also just ask in the help window, in any chat: _which verse says do not worry about
   tomorrow?_ — or in one line, `Help me find a Bible verse in "KJV": love your enemies`.

_Verify: RD-08, RD-09, RD-45, RD-46, RD-47, RD-124, CB-146._

### W-13 — Cross references

**Goal:** see what else in scripture speaks to the verse you are reading.

1. In the bible lookup, click **[en:tran:Advance Bible Lookup]** (the binoculars, top right) to open
   the side panel, then pick **[en:tran:Cross Reference]** from the panel's dropdown —
   the second entry, after **[en:tran:Find]**. 📸
   You can also get here from the verse itself: right-click any verse in the lookup body
   and choose **[en:tran:Open in Cross Reference]**. That opens the panel on this view AND on that
   verse.
   Until you have picked a verse the view says **[en:tran:No verse selected]** and tells you what to
   do about it.
2. The top of the view shows the verse it is working from — its version, its reference and
   its text, exactly as **[en:tran:Resources]** shows it. Click the reference to move to another
   verse, or the version chip to read the references in another translation. 📸
3. Under it, **AI [en:tran:Cross References]** with the version it is quoting on the right, and a
   line saying how much there is: **7 [en:tran:Themes] · 35 [en:tran:Verses]**. Click the title to collapse the
   whole section; right-click the title (not the references under it) for
   **[en:tran:Refresh]**, which re-fetches.
4. The references are grouped by **theme** — a sentence such as _Genealogy from Adam to
   Noah_ — set flush left, with that theme's verses hanging off a single vertical line
   beneath it. 📸 Each verse gives its reference on its own line and the opening of the
   verse under it, cut at a word with a single `…` when there is more.
   Themes set in columns and reflow to one column when the panel is narrow.
5. Point at any verse and the line beside it lights up, along with its reference: click to
   read it in a small floating panel, in the version the references are quoting — the
   verse you are on stays as it is. Drag it into a list, or right-click it (or press its
   **⋮**) for the usual verse menu: **[en:tran:Open]** does what a click does, and
   **[en:tran:Open beside the current verse]** opens it as a passage beside the verse you
   are on. The keyboard reaches the same rows — **Tab** to one and press **Enter**.
   The version at the start of the panel's title — **(KJV)** — is a button: click it and
   choose another Bible, and the same verse opens in a second panel of its own, so the two
   can be read side by side. Close a panel with its **×**.
6. The **chip** button on the section title (**[en:tran:Generated using AI technology.]**) says a model wrote these; click it for the
   page explaining what that costs you in accuracy. On a translation whose theme headings
   were machine-translated, each heading carries its own **translate** button
   (**[en:tran:Generated using Google Translate.]**) saying so — on an English bible nothing was translated and the mark is absent.
7. If you have put your own OpenAI or Anthropic key in Settings, **Custom OpenAI** and
   **Custom Anthropic** appear as their own sections below, each collapsing and refreshing
   the same way. The section above them needs no key.

_Verify: RD-10, RD-49, RD-50, RD-51, RD-52, RD-124._

### W-14 — Keep Bible notes

**Goal:** attach your own notes to study.

1. Find the **[en:tran:Bible Notes]** panel. It is a panel, not a tab: it sits beside
   **[en:tran:Bibles]** (under it when the column is narrow) inside the
   **[en:tran:Bible and Notes]** section — at the top of the right column in the Presenter,
   on the left in the Bible Reader.
2. Open a note for editing — the **Bible Note** editor opens in its own window. 📸
3. Type your note. Nothing is written to the note file yet — your typing is kept
   in an editing history, and the row of buttons that appears at the bottom
   right of the window is how you decide what happens to it.
4. Press **[en:tran:Save]** (**Ctrl+S**) to write it into the note file.
5. **[en:tran:Undo Saved Change]** and **[en:tran:Redo Saved Change]** walk that
   history — they step through what has been typed since the last save, and they
   still work after the window has been closed and opened again, so an edit made
   by mistake can always be taken back. **[en:tran:Discard changed]** throws the
   unsaved typing away and returns the note to what was last saved.

::: tip
The arrows at the TOP of the window are the text editor's own undo and redo;
the ones at the bottom are the note FILE's.
:::

_Verify: PR-03, PU-03, KB-11._

---

## Creating & editing content

### W-15 — Create and edit slides / lyrics / web backgrounds

**Making a new file:** in the **[en:tran:Documents]** list, click the **⋮** in the list header
(or right-click the empty area of the list) and pick **[en:tran:New App Document]** (a slide document) or **[en:tran:New Lyric]** (a song). Type
a name into the row that appears and press **Enter** (or click the ✓). Both kinds live
in the same documents folder. 📸

**Slides** ([en:tran:Slide Editor]):

1. Select a slide document, then click the **[en:tran:Slide Editor]** header tab. 📸
2. Left: the slide list — click to select, drag to reorder. Right-click its empty
   area → **[en:tran:New Slide]**; right-click a slide → **[en:tran:Duplicate]** / **[en:tran:Delete]**.
3. Canvas: click a box to select it; drag to move; drag the handles to resize;
   **double-click a text box** to type into it; **Ctrl+Enter** focuses the canvas. 📸
   (From the **[en:tran:Presenter]**, right-click a slide → **[en:tran:Edit] ↗** opens this editor in its
   own window, focused on that slide.)
4. Add new boxes with the toolbar above the canvas — **[en:tran:New]**, **[en:tran:Insert Medias]**,
   **[en:tran:Insert Media Link]**, **[en:tran:Insert YouTube]**, **[en:tran:Insert Website]**, **[en:tran:Insert Camera]** — or
   the same list from a right-click on the canvas. (The right-hand **[en:tran:Canvas Items]** tab
   is a preview/select list, not a place to drag boxes from.) You can also **drag items
   in from the Background panel** — see W-28.
   **Insert a video from a link.** In the **[en:tran:Slide Editor]**, select the slide, press **[en:tran:Insert Media Link]** above the canvas, paste the direct video address into **[en:tran:Media URL:]**, and press **[en:tran:Ok]**. For a YouTube address, use **[en:tran:Insert YouTube]** and its **[en:tran:YouTube URL:]** box instead, then press **[en:tran:Ok]**. Move or resize the new box on the slide and save with **Ctrl+S**.
   **Insert a camera on a slide.** Select the slide in **[en:tran:Slide Editor]**, press **[en:tran:Insert Camera]**, then select the camera's name from the device menu that opens. Selecting a device adds its camera box to the slide. Move or resize the box and save with **Ctrl+S**. If the app says **[en:tran:No camera found]**, connect a camera and try again.
5. **A website box shows a picture of the page, not the running page.** Open Worship
   takes a screenshot and shows that everywhere you edit, so a service order full of
   web slides stays fast even on an old machine. Two things follow:
   - **Hover the box for about a second** to see the page live; move away and the
     picture comes back. 📸
   - The picture does not update itself. If the page changes (a clock, a countdown, a
     scoreboard), right-click the box → **[en:tran:Refresh Preview]**.

   When you actually present the slide, the audience screen shows the **real, live
   page** — only your editing and preview views use the picture.

6. **Blend a box with the ones under it.** Select a box, and under
   **[en:tran:Shape Properties]** in the right-hand **[en:tran:Properties]** tab pick a
   **[en:tran:Blend Mode]** — **[en:tran:Multiply]** to darken, **[en:tran:Screen Blend]**
   to drop black out of a clip, **[en:tran:Overlay]** for a texture over a photo. It
   blends with the **canvas items underneath it in the same slide**, so it only shows
   where the box overlaps another one; put a picture or video box behind, sized
   **[en:tran:Full]**, and blend over that. It does **not** reach the background you
   attached to the slide. **[en:tran:Normal]** turns it off again.
7. **Give a box a shadow.** In the same **[en:tran:Shape Properties]** group, pick a
   **[en:tran:Shadow]**. There are two kinds and they are not the same thing:
   - **[en:tran:Box Shadow]** is the shadow of the box itself — its rectangle, with
     whatever corner rounding you gave it. This is the one for a text box with a
     coloured backing.
   - **[en:tran:Drop Shadow]** is the shadow of what is actually painted, so it hugs
     the **letters** of a box with no backing colour, and the cut-out edge of a logo
     picture. Giving a see-through logo a box shadow draws a rectangle in mid-air
     behind it — this is the setting that avoids that.

   Three boxes then appear: **X:** and **Y:** are how far the shadow falls (either
   way — a negative **Y:** throws it upwards), **[en:tran:Blur:]** is how soft it is,
   and the colour row under them sets its colour and how see-through it is. Keep the
   blur modest on an old machine: a big soft shadow is the one setting here that
   costs the computer real work. **[en:tran:No Shadow]** takes it off again.

8. **Apply a font setting to several items.** Under **[en:tran:Properties]**, expand
   **[en:tran:Bulk Font]**. Leave **[en:tran:Apply to]** on **[en:tran:All Slides]**
   for the whole document, or pick **[en:tran:Choose slides and items]**. Tick a
   slide to select its text items; expand its **[en:tran:Canvas Items]** list to
   tick individual items. You can combine items from several slides. A partially
   selected slide shows a dash in its checkbox. Text, Bible and HTML items are
   included; media items have no font setting. Locked items stay unchanged unless
   you tick **[en:tran:Include locked items]**. Enter a positive **[en:tran:Font Size]**
   in pixels and press **[en:tran:Apply Font Size]**, or choose a
   **[en:tran:Font Family]** and press **[en:tran:Apply Font Family]**. Each button
   applies only that property, leaving the other styles and positions intact.
   The result reports how many items changed. Each application is one
   **[en:tran:Undo]** step; **[en:tran:Redo]** reapplies it. To change the words'
   colour as well, select the box and click the hex value under
   **[en:tran:Text Properties] → [en:tran:Color]**. Type or paste the new hex color,
   then press **Enter** or click away to apply it (step 9). 📸
9. **Type an exact color.** Select a box, then click the hex value beside
   **[en:tran:Background Color]** or under **[en:tran:Text Properties] → [en:tran:Color]**.
   Type or paste a hex color, then press **Enter** or click away to apply it.
   Three-, four-, six- and eight-digit hex values work, with or without `#`;
   eight digits include opacity, for example `#2468AC80`. **Escape** cancels the
   unfinished edit. Invalid or incomplete values return to the current color
   without changing the slide. The arrow still opens the swatches and opacity
   slider. **[en:tran:Undo]** / **[en:tran:Redo]** restore and reapply changes. 📸
10. Save with **Ctrl+S**.

**HTML and plain text:** imported HTML keeps its formatting, but scripts, event
handlers and embedded pages are removed in the editor, previews, screen rendering
and print. Use **[en:tran:Insert Website]** or **[en:tran:Insert YouTube]** for a
page or video embed. A **Text** box displays markup literally and keeps line breaks;
use an HTML box for rich formatting. Existing files are kept as saved.

**Lyrics:** right-click a song in the Documents list → **[en:tran:Edit]** — the Lyric Editor opens
in its own window; edit the text/chords and save with **Ctrl+S**. 📸

**Web backgrounds:** **[en:tran:Background]** panel → **[en:tran:Webs]** tab, then the
**⋮ [en:tran:More Options]** button at the right of the folder-path bar (or right-click an
empty part of the list). **[en:tran:Add URL]** asks for a web address and saves it as a new
tile in the tab. **[en:tran:New File]** asks for a name and makes an `.html` page in the
folder; right-click that page → **[en:tran:Edit]** to open the Web Editor in its own window,
its code beside a preview. The Web Editor saves itself as you type, so there is no Save
to press.

_Verify: ED-01..11, ED-21, ED-25, ED-45, ED-46, ED-47, ED-48, ED-52, ED-53, PU-02, PU-04, PL-09, PL-11, PL-24, CM-23, CM-27, CM-32, CM-33, CM-43, PM-33, PM-124._

### W-43 — Remove a song, document or file (Move to Trash)

**Goal:** get rid of a file you no longer want — a song, a slide document, a PDF, a
background picture or video, a presenting flow, a Bible note — without losing it for good.

No file row has a **[en:tran:Delete]**. Every file row has **[en:tran:Move to Trash]**
instead, and it does what it says: the file goes to your computer's own Recycle Bin (Trash
on a Mac), where it can be brought back if you change your mind.

1. Find the row in its list — a song or slide document in **[en:tran:Documents]**, a picture or video
   in the **[en:tran:Background]** panel, a run sheet in **[en:tran:Presenting Flows]**. 📸
2. Right-click the row, or click the faint **⋮** at its right-hand
   end (W-01b). The row's menu opens.
3. Choose **[en:tran:Move to Trash]** — the last item, with a red trash icon. 📸
4. A small window asks **[en:tran:Moving File to Trash]** — _Are you sure you want to move
   "…" to trash?_ Click **[en:tran:Yes]**. (**[en:tran:No]** leaves everything as it was.)
5. The row disappears from the list. The file, and any pictures or media that belonged only
   to it, are in the Recycle Bin / Trash — open that from your desktop to restore them.

**Not there?** A background item that is **on a screen right now** has no **[en:tran:Move to Trash]**
in its menu — clear it from the screen first (**[en:tran:Clear Background]** on the
Mini Screen panel, W-10), then try again. A slide INSIDE a document is not a file: to
remove one, open the document in the **[en:tran:Slide Editor]** and right-click the slide in the
left-hand list (W-15).

_Verify: CM-06, EX-05, PL-03, PL-20, PM-35._

---

## Configuration

### W-16 — Settings: language, theme, fonts, folders

**Goal:** configure the app.

1. Click the **gear** ([en:tran:Setting]) in the header — Settings opens in its own window. 📸
2. **[en:tran:General]** tab:
   - **[en:tran:Language]:** click **English**, **ខ្មែរ** or **Français**. Each language is listed under its
     OWN name, whatever locale you are currently in — so if a mis-click leaves you in
     a script you cannot read, the way back is still legible. (Hover a button and its
     `title` gives the English name.) Some
     labels change straight away, but the switch is only complete once you click
     **[en:tran:Apply Settings]** at the bottom-left — that reloads every open
     window. Unsaved edits in the Slide Editor are kept. The language belongs to this
     computer, not to the data folder: switch to another data folder and the app stays
     in the language you chose.
   - **[en:tran:Theme]:** system / light / dark.
   - **[en:tran:Font Family]:** the font the app's own windows are drawn in — not the text on the audience screen. A font marked `(Missing)` is
     configured but not installed on this computer. When the chosen font comes in more
     than one weight, a second list beside it picks one (`400 Regular`, `700 Bold`…);
     **[en:tran:Default]** keeps the font's own weight.
   - **Directories:** where documents, lyrics, and bibles are stored on disk. With no
     data folder chosen, **[en:tran:Click here to use the default data folder]** makes
     `.owa\open-worship-data` in your user folder. One still on the Desktop is asked
     about at every start — see **W-54**.
   - **To keep everything somewhere else**, press the folder line
     under **[en:tran:Parent Directory:]** (the folder in use) and a box opens under it: type the
     folder's path and press Enter, or press **[en:tran:Choose a folder]** and pick it.
     The app asks **[en:tran:Set according paths]** first, and **[en:tran:Yes]** makes the
     standard folders (Documents, Videos, Images and the rest) inside it, uses them and
     reloads. What you already have is not moved. It stays in the old folder, where
     **[en:tran:Recent Folders]** below takes you back, or a backup brings it along (W-25).
   - **To switch back to a previous data folder.** In **[en:tran:General]**, under **[en:tran:Parent Directory:]** → **[en:tran:Recent Folders]**, press
     **[en:tran:Switch]** beside the folder, then confirm with **[en:tran:Switch]**
     in the **[en:tran:Switch Data Folder]** dialog. Every open window reloads onto
     that folder automatically. The list shows this computer's previously used
     folders, newest first, excluding the one in use. A folder that is not there
     (a stick that is not plugged in) reads **[en:tran:Missing]** and cannot be
     switched to. **✕** takes a folder off the list; the folder itself is not
     touched. The list keeps the last 10 and appears once a second folder has
     been used. 📸
   - **[en:tran:Repair Links]** (beside **[en:tran:Reset All Child Directories]**): after you
     bring the data folder from another computer — a USB stick, a copied folder — press
     it once. Pictures, videos and songs still pointing at where the folder USED to be
     are pointed at where it is now; a link to something that still exists is left as it
     is. A box says how many links it repaired, and the app reloads to show them. 📸
   - **Reset buttons** (`Reset All Child Directories` / `Clear All Settings`):
     **these erase configuration; use with care.** Both ask for confirmation first.
   - **[en:tran:Show Tips of the Day automatically]:** controls whether the Presenter and Bible
     Reader show an automatic tip after the next app launch.
   - Panel sizes are no longer reset from here — see **W-31**.
3. **[en:tran:Bible]** tab: import a Bible XML from a file or URL, edit installed XML Bibles,
   or export/import a **[en:tran:Bible Data]** archive. The old online version list is
   development-only and can be unavailable. 📸
   **An installed Bible has no on/off switch.** Every Bible in that list is offered
   wherever a version is chosen. To stop one being offered, take it off the computer: the
   trash icon on its row, **[en:tran:Move to Trash]**, opens a confirmation titled
   **[en:tran:Delete Bible XML]**. Press **[en:tran:Yes]** in that dialog to send
   its file to the Recycle Bin, from where it can be brought back or imported again.
4. Click **[en:tran:Apply Settings]** (bottom-left) to apply — the app windows reload.

_Verify: ST-01..ST-09, ST-22, ST-52, ST-58, LT-02..04._

### W-17 — Find text anywhere (Find bar) & About

- **Find bar:** press **Ctrl+F** (**⌘F** on macOS) or use **Edit → Find** in the app
  menu bar. A slim bar drops in at the **top-right of the window itself** and searches
  only that window. Each of these has its own: the Presenter, Slide Editor, Bible
  Reader, Screen Mirror and Settings, the About and Local Web Share windows, the Web
  Editor and Lyric Editor, the help window (🤖) and **AI Chat** (✨) — where it searches
  the website's own words too, Khmer included. The screens (nothing to search on a
  projector) and the bible note (it has its own search) have none. In the Web Editor
  the bar finds only the lines the editor is showing, so scroll to the rest. 📸
  - Type to search as you go; the counter shows **`<current>/<total>`**.
  - **Enter** jumps to the next match, **Shift+Enter** to the previous one; the **⌃**
    and **⌄** buttons do the same and wrap around.
  - The **Aa** button toggles case-sensitivity. There is **no whole-word and no regex
    option** — Chromium's find-in-page does not offer them.
  - Drag the **grip** on the left to slide the bar **sideways** when it covers
    something you need to read; it stays inside the window and never leaves the top.
  - **Esc** or the **✕** button closes it and clears every highlight. Pressing
    **Ctrl/⌘+F** again re-selects the previous query instead of opening a second bar.
  - The bar is app chrome, not part of the page: it is drawn in its own view, so the
    query you type is never found by your own search.
- **About:** shows the app version and project links.

_Verify: PU-01, PU-05, PU-07, PU-21, PU-22._

### W-18 — Use more than one screen (multi-screen)

**Goal:** project different (or the same) content to several displays.

1. **Right-click** an empty area of the mini-screen panel and choose
   **[en:tran:Add New Screen]** — a second preview card appears with its own number and color. 📸
2. Point the new card at the display it should fill with the **Display** button in its
   footer (W-10), then turn it on with its own show/hide button. Every card has its own
   clears, transitions and lock too.
3. Content goes to every **selected** screen. To stop one screen receiving content
   without deleting it, right-click its card and choose **[en:tran:Deselect]**, and
   **[en:tran:Select]** there takes it back. **[en:tran:Solo]** does something else. It makes that
   card the ONLY selected one, so every other screen stops receiving. A screen that is not
   selected keeps what it last showed, and that, or an item dropped on one card (step 4),
   is why two screens can show different things. Select every card — right-click one
   that is not and choose **[en:tran:Select]** — and present the item again to put the
   same thing on all of them.
4. You can also **drag** a slide, background item, or foreground Show button and
   **drop it on one specific card** to present it on that screen only. 📸
5. A Bible passage shown in more than one version is drawn as one column per version, and
   the columns keep together: scroll one of them on the card — the wheel, its scrollbar or
   the auto-scroll button — and the others move to the same verse, on the screen it shows
   as well. To line the versions up verse by verse, in rows, right-click the card of the screen showing it and
   choose **[en:tran:Set Line Sync]** — one screen is all it needs, and a screen already
   showing takes the rows only once it is hidden and shown again — and
   **[en:tran:Unset Line Sync]** goes back to columns. Its scrolling follows the card either way.
6. Right-click a card → **[en:tran:Delete]** removes a screen you no longer need (the first
   screen can't be deleted while it is the only one).

_Verify: SP-04..05, SP-10..12, SP-33._

### W-19 — Draw and spotlight on the app itself (Presenting Control)

**Goal:** annotate **the app window** — not the audience screen — while showing the app
to other people (a training session, a screen share, a projector mirroring your laptop).
The audience screen has its own Draw and Focus tools on the mini-screen card (W-10);
this is the same pair of tools pointed at the app.

1. Open the **Tools** menu → **[en:tran:Start Controlling]**, or press **Ctrl+Shift+P**
   instead (**⌘+Shift+P** on Mac) — one or the other. **Every window of the app answers it** — the Presenter, the Bible Reader, the
   Slide Editor, a Bible Note, Settings, the Web Editor, the Lyric Editor and Local Web
   Share — and the one you are looking at is the one that gets the panel. (The projector
   output, the About box and the Find bar deliberately do not: an overlay on what the
   congregation sees is the one place this must never appear.) The menu bar is hidden on
   the smaller windows, so the shortcut is the way in there.
   A floating **[en:tran:Presenting Control]** panel appears — drag it by its title bar,
   resize it from any edge or corner, double-click the title bar to fill the window (and
   again to put it back), and collapse it with the chevron once a tool with settings is
   showing; it reopens where and how you last left it. 📸
2. The **title bar** carries everything you reach for mid-presentation: the four tools on
   the left, then the **keyboard screencast** switch (W-20) and **[en:tran:Undo]** / **[en:tran:Redo]** /
   **[en:tran:Clear drawing]** on the right. Only the settings live in the body, so collapsing the panel
   with the chevron leaves every group one click away — roll it up to get the sliders out
   of the way and keep drawing.
3. The panel opens on the **arrow** tool — the app stays completely usable and
   anything already drawn stays visible on top of it. The arrow has no settings of its
   own, so on it the panel is **just its title bar**: no empty body sitting over the app
   you have just asked to have back, and no chevron either, because there is nothing to
   roll up. Pick the brush, eraser or spotlight and the body opens again at the size you
   last left it.
4. Click the **brush** to draw. A thin teal frame around the window shows the app is no
   longer taking clicks; drag anywhere to draw. Pick **[en:tran:Color]**, **[en:tran:Size]** (`[` / `]`) and
   **[en:tran:Opacity]** (`-` / `=`), and switch the stroke style with **[en:tran:Straight]** (`S`), **[en:tran:3D]**
   (`3`) or **[en:tran:Dots]** (`D`). **[en:tran:HQ]** (`Q`) trades smoothness for speed on weak machines. 📸
5. Click the **eraser** to rub parts of the drawing out, and use the title bar's
   **[en:tran:Undo]** / **[en:tran:Redo]** (`Ctrl+Z` / `Ctrl+Shift+Z`) to step back or the red **[en:tran:Clear drawing]** (`C`)
   to wipe it — one Undo brings a mis-hit Clear back. All three grey out when there is
   nothing to undo, redo or clear, and all three keys work from any **armed** tool (brush, eraser or
   spotlight) and with the panel **collapsed**. On the arrow tool those keys go to the app
   instead, and only the buttons act on the drawing.
6. Click the **spotlight** to dim the whole app except a circle. In **[en:tran:Follow]** (the
   default) the circle simply tracks your pointer; press the **[en:tran:Follow]** button itself (`H`) and it reads
   **[en:tran:Hold]**, which dims only while the mouse button is down. **[en:tran:Contrast]** (`X`) inverts it — the
   circle becomes the blocked area instead. Size, **[en:tran:Dim color]**, dim amount and **edge
   blur** (`,` / `.`) all have sliders. 📸
7. The **camera** at the end of the title bar takes a picture of the app **as it looks
   right now** — your drawing, your spotlight and all — and asks what to do with it:
   **[en:tran:Ask the assistant about this]** opens the help window with the picture already
   attached, so "what is this?" is one press and one sentence; **[en:tran:Copy]** puts it on the
   clipboard; **[en:tran:Save into your images]** puts it in the Background Images folder, where
   it can then be presented like any other picture. The help window itself never appears
   in the shot, even when it is sitting on top of the app. 📸
8. Press **Escape** (or click the arrow) to hand the app back while keeping the
   drawing on screen. Move the panel if it covers what you are pointing at.
9. Click **✕** in the panel header to finish. The drawing is discarded; it is not saved
   between sessions. **Ctrl+Shift+P** and **Tools → [en:tran:Start Controlling]** are a toggle:
   pressed again while the panel is open, they close it — and the drawing goes with it,
   exactly as **✕** does. While a drawing tool is armed the shortcut does nothing — the
   keyboard belongs to the drawing then: press **Escape** first, or use the menu entry,
   which closes the panel either way.

> Note: the panel owns the keyboard only while a tool is **armed** — the same moment it
> owns the pointer. On the **arrow** tool the app keeps every key it normally has (the
> Bible Lookup's Enter and Escape, `F5`–`F10`, `Ctrl+B`, `Ctrl+Z`, slide navigation)
> while `V` `B` `E` `F` `K` still reach in to pick a tool; whatever holds the keyboard
> still wins, as the tool letters defer while you are typing in a field and while a
> screen preview's own draw/spotlight overlay is focused. Arm a tool and the picture
> flips: the overlay covers the **whole** window and the app takes **nothing** — not a
> click, not a key. Every keystroke is swallowed before the app sees it, down to the
> plain ones nothing is bound to: typing goes nowhere, `Space` and the arrows stop
> scrolling, `Tab` stops walking the focus ring, and a dialog behind the overlay stays
> deaf. Only the panel's own keys stay live (`V` `B` `E` `F`, `Escape`, `Ctrl+Z` /
> `Ctrl+Shift+Z` / `C`, which now act on the **drawing**), along with anything typed into
> the panel's own sliders and color box. Escape or the arrow tool hands everything
> straight back. The Undo / Redo / Clear **buttons** work in every tool regardless.

_Verify: CB-30 (the snapshot). The rest is still pending — the matrix lives at
`docs/test-paths/coverage-matrix.md` but has no `PC-xx` (presenting-control) block yet;
add one for this workflow._

### W-20 — Show the keys you press (Keyboard Screencast)

**Goal:** let the room see **which keys you are pressing** while you demonstrate the app —
a training session, a screen share, a recorded tutorial. It is the keyboard counterpart to
the drawing in W-19, and it lives in the same panel.

1. Open the **[en:tran:Presenting Control]** panel (W-19 step 1: **Tools → [en:tran:Start Controlling]**,
   **Ctrl+Shift+P**).
2. In the panel's title bar, click the **keyboard** button (`K`) — it sits between the
   four tools and Undo / Redo / Clear, and lights up while it is on. Nothing appears on
   screen yet; the strip only shows up once you press something.
3. Press any key. A dark strip of key pills appears **across the bottom** of the window,
   above everything else — including your own drawing and the spotlight. 📸
4. The strip keeps the **last six** keys. Pressing the same key over and over collapses
   into one pill with a **×N** counter (`→ ×2`), so a run of arrow presses does not push
   the rest of the strip away. Holding a key down counts as one press.
5. Chords are shown the way the app names them: **Ctrl+Z**, **Esc**, **Space**,
   **↑ ↓ ← →**. Plain typing shows the character you actually typed; a shortcut is shown
   on the en-US key the app binds it to, whatever your layout produces.
6. The strip **clears itself** about a second and a half after your last key, so it is
   never in the way between one demonstration and the next.
7. Click the keyboard button again (or press `K`) to turn it off. **Closing the panel
   turns it off too** — the screencast belongs to the panel, and reopening starts with it
   off again.
8. Picking the **brush**, **eraser** or **spotlight** turns it off as well, and greys the
   keyboard button out until you go back to the **arrow** — an armed tool swallows the
   keyboard (W-19), so there would be nothing left to echo. Turn it back on with `K` or
   the button once the arrow tool is back.

> Notes: the screencast belongs to the **arrow** tool — it narrates the app being driven,
> not a drawing being made. It never takes clicks and never blocks a key: it only
> **echoes** what you pressed. What you type into a **password** field is masked as `•`.

_Verify: coverage rows pending — same `PC-xx` block as W-19 when the matrix lands._

### W-21 — Add a background video or song from a link

**Goal:** get a video (or its audio as an MP3) from an online link straight into your
Videos / Audios folder, without leaving the app. The download tools are not built into the
app: the first time, a **[en:tran:Media Tools Required]** box offers to open
**[en:tran:Setting]** → **[en:tran:Others]** → **[en:tran:Extra Binaries]**, where
**[en:tran:Download and Install]** installs them once.

1. Open the **[en:tran:Background]** panel (W-08 step 1) and choose the **[en:tran:Videos]** tab — or the **[en:tran:Audios]** split if you want the sound only.
2. **Right-click an empty part of the list** (or use the ⋮ [en:tran:More Options] button at
   the right of the folder-path bar) and choose **[en:tran:Download From URL]**. 📸
3. A small box asks for the link — **[en:tran:Video URL:]** on the Videos tab, **[en:tran:Audio URL:]** on
   Audios. If you copied the link first, it is **already filled in**; otherwise paste it.
   The box is only outlined red — with **[en:tran:Cannot be empty]** under it — once you
   have typed in it and emptied it again.
4. Click **[en:tran:Ok]**. The download runs in the background — a full song or video takes a
   couple of minutes, and you can keep using the app while it does.
5. When it finishes, the file **appears in the folder you were in**: the video shows up as
   a new thumbnail in the Videos tab, the audio as a new row under **[en:tran:Audios]**. 📸 From there
   it behaves like any other background (W-08) or track (W-09).

> Notes: audio is always converted to **MP3**, video keeps the site's best quality
> (`.webm`/`.mp4`). If a file with that name is already in the folder, the new one is
> saved as `name (1)`. Pasting something that is not a web link gets you an
> **[en:tran:Invalid URL]** message and nothing is downloaded. Downloads need an internet connection — and
> a busy site can cut a large download off partway, in which case just try again.

> **A download that fails leaves nothing in your folders.** The app downloads into the
> computer's own temporary folder and takes its unfinished pieces away when the download
> fails (you are told why under **[en:tran:Download From URL]**). Only when the app was
> closed in the middle of a download can a file named `temp-…` be left in that temporary
> folder: nothing in the app uses it, and it is safe to delete once no download is running.

_Verify: MD-01..03, CM-24, PM-102._

---

### W-22 — Build a service presenting flow (a running order)

**Goal:** collect everything one service needs — songs, slides, verses, backgrounds and
foreground presets — into one running order you can work down live.

1. Find the **[en:tran:Presenting Flows]** panel — it is the lower of the two lists on the
   left, under **[en:tran:Documents]**. If the list is empty, right-click its empty area (or
   use the **⋮ [en:tran:More Options]** button in its title bar) → **[en:tran:New File]** to create one. 📸
2. **Drag things onto the presenting flow's NAME row to add them.** The NAME row is the
   presenting flow's own row in the list — the one with its name on it; not the empty part of
   the list, and not a line inside an open presenting flow (dropping onto a _line_ does
   something else — it attaches: see W-22g). So, to add a song or a verse: take hold of
   its row — in the Documents list, or in the Bible list — drag it over to the Presenting
   Flows list and let go on the row that shows the presenting flow’s name. It is added
   at the end. Anything you can present can go in:
   - a **background** — a colour, image, video, camera or website;
   - a **document** — a slide document or a **song** (a song is a document too): drag its row out of the Documents list;
   - a **single slide** — from the previewer, or from a document already in the presenting flow;
   - a **Bible verse** — from the Bible list;
   - a **foreground preset** — drag the blue **[en:tran:Show Marquee Top]** / **[en:tran:Start Countdown]** /
     **[en:tran:Show Time]** button itself. Whatever you typed and styled travels with it, so the
     presenting flow remembers _that_ announcement, not just "a marquee". 📸
   - an **audio track** — drag it out of the **[en:tran:Audios]** split.
3. Click the presenting flow name to **open it**. Each element is one short line: an icon for
   what it is, its id, and its name. A **document** line has its own arrow at its left end —
   a song is a document too. Click the **arrow**, not the line, to see that document's
   slides underneath; clicking the line itself opens the document in the previewer. 📸
4. **A song or document line opens its previewer.** To present one of its slides,
   click that slide in the previewer, or expand the document with its arrow and
   click a slide underneath. An **audio track** opens the **[en:tran:Audios]** split
   and flashes the track there; use that panel's play button to play it.
   Click a **single slide**, Bible verse, background or foreground preset to put
   it on the screen. You can also **drag an element onto a mini screen**, or
   **right-click → [en:tran:Show on Screens]** to pick the screen.
5. Right-click an element for **[en:tran:Move up]** / **[en:tran:Move down]**, **[en:tran:Choose Color]**
   to group your running order by colour, or **[en:tran:Remove from Presenting Flow]**. To move a line a long
   way, use **[en:tran:Move to Top]** or **[en:tran:Move to Bottom]** instead of
   clicking **[en:tran:Move up]** over and over — the line jumps straight to that end and everything
   else keeps its order. (A line that is already at the top is not offered **[en:tran:Move up]** or
   **[en:tran:Move to Top]**, and one already at the bottom is not offered **[en:tran:Move down]** or
   **[en:tran:Move to Bottom]**.) **[en:tran:Duplicate]** puts a copy of the line **directly below** it,
   with its colour, its pinned screens and its parked slides already on the copy — the quick
   way to sing a song twice in one service, then change only the second one. The two copies
   are separate from then on: parking or recolouring one leaves the other alone. 📸
   You can also drag a
   line up or down **inside the same presenting flow** (dragging a line into a _different_
   presenting flow does nothing — add it there from its own list instead). A colour shows as a
   stripe down the left edge of the line and a dot at its right end; the lines stay in
   your running order — they are never re-sorted into colour groups, because the order
   _is_ the meaning here. The colour belongs to that presenting flow alone, so the same song can
   be marked differently in two services. Changes are saved as you make them — there is
   **no save button** anywhere in this panel.
6. Whatever is **live on the screen right now** is marked with a magenta `●` — on the
   element itself, on the document it belongs to, on the presenting flow, and on the
   **[en:tran:Presenting Flows]** heading — so you can see at a glance where you are in the running order.
7. Not sure which "5.jpg" a line means? Right-click it → **[en:tran:Reveal Original]** — the app scrolls to the real item elsewhere in the window and
   flashes it. This works on the slides inside an opened document too. A colour or a
   camera has no original to point at, and the panel holding the original has to be
   open already.

**What else a running order can do** — each has a page of its own:

- be run from one floating panel, with the keyboard (W-22b);
- hold a line that clears the screen, or shows or hides it (W-22c);
- wait on a line and then move on by itself (W-22d), loop a set of slides or jump back
  (W-22e), answer to a key of your own (W-22f);
- make one line bring others up with it (W-22g), or play the video inside a slide (W-22h);
- send a line to one particular screen every time, or park a line (W-22i);
- be handed to another machine as one file (W-22j).

_Verify: PL-10, PL-29, PL-32..PL-76, PL-81..PL-96, PL-101._

---

### W-22b — Run the service from the presenting flow's preview panel

**Goal:** see the whole running order at a glance, and walk the service with one key.

1. To see the whole service at a glance, click the **window** icon on the presenting flow row once (or
   right-click → **[en:tran:Open Preview]**) — a second click on it closes the panel again. A floating panel shows every element with its real
   preview — slides look exactly as they will project, and a document shows all of its
   slides. Opening it puts nothing on a screen, and neither does scrolling it: that is
   how you look ahead. An element goes up only when you click its preview or press one
   of the keys below — those keys run the service, they are not for looking.
   Collapse the ones you are not working on — or fold the whole running order
   away at once with the **[en:tran:Collapse All]** icon at the bottom-left of the
   panel, and open it all again with **[en:tran:Expand All]** beside it. Whichever
   of the two has nothing left to do fades out. Whatever you folded away is remembered for
   that presenting flow, so a running order trimmed down to the few things you are working on
   comes back that way next time — and it follows the element, not its position, so
   reordering the list does not shuffle what is folded. 📸
   To make the thumbnails bigger or smaller, use the zoom slider in the panel's footer
   (it tucks itself away into a **⋯** button at the bottom-left), **Ctrl + scroll**, or a
   two-finger **pinch**. This zoom is remembered separately from the one in the middle
   Documents tab — and it is shared by every one of these panels, so zooming one resizes
   them all.
   **You can have several of these panels open at once**, one per running order — the
   songs in one and the sermon in another, side by side once you drag them apart. Each opens a little below and to
   the left of the last, so it never lands exactly on top of it; each remembers its own
   size and place, and is closed on its own with its
   ✕ (or by clicking its window icon in the list again). Each is its own run, too: where
   you are, what you have folded away and any countdown belong to that panel alone, and
   the keys below always drive the one you last clicked into. 📸
2. **Run the service from this panel.** Click an element — the panel outlines it and
   remembers it as where you are. Clicking its preview also shows it, and clicking the
   title line of a folded element marks it just the same — folding is the chevron on its
   left, so pointing the run at an element never folds it away.
   Then **Space**, **↓**, **→** or **Page Down** puts the next element on the
   screen: every press shows the congregation the next thing, so one key runs the whole
   service. **A document is walked slide by slide:** arriving at it always shows its
   **first** slide, each further press shows the next one, and the keys only move on to
   the next element once its **last** slide is the one on screen — so a whole song or sermon deck plays from here without touching
   the mouse. A **folded-away** element is not passed over: the run **opens it** when it
   gets there, and a song folded away is unfolded and walked from its first slide like any
   other. Folding is how you _read_ a long running order; it never decides what is in the
   service. **The only line the keys step over is one you have parked** (W-22i) — an audio
   track and a damaged line still take the marker, so you can see where the run has got to,
   they simply have nothing to show. The last element is the end — it does not start over.
   The keys work while you are in this panel, and it takes them the moment you open it, so
   there is nothing to click first; click into the slides list and they drive that list
   again, as before. Clicked somewhere else and the keys stopped? Press the key **three
   times quickly** and this panel takes them back (W-49b). 📸
3. **A screen action is stopped on and fired** like anything else (W-22c) — so putting a
   **[en:tran:Clear All]** between the last song and the sermon means one more press of the same
   key blanks the screen at exactly that point in the running order.
   The `Next:` lines are fired the same way, and what they fire is this panel: a wait that
   moves the run on by itself (W-22d), or a loop that keeps moving it (W-22e).
4. **Everything you can right-click in the list, you can right-click here.** The menus in
   this panel are the very same menus — right-click an element's **title line** (or any
   empty part of its box) and you get its full menu: **[en:tran:Reveal Original]**, **[en:tran:Show on Screens]** / **[en:tran:Apply on Screens]**, **[en:tran:Set Specific Screen]**, **[en:tran:Add CC Elements]**, the four
   moves, **[en:tran:Duplicate]**, **[en:tran:Choose Color]**, **[en:tran:Disable]** / **[en:tran:Enable]** and **[en:tran:Remove from Presenting Flow]**, gated exactly as they are in the list. So you can tidy and re-order the
   running order from the panel you are actually watching during the service, without
   going back to the list — and the list behind it follows immediately. 📸
   Two things inside a box keep menus of their own, because they are not the element:
   a **slide thumbnail** gets the slide's menu (**[en:tran:Reveal Original]**, **[en:tran:Show on Screens]**,
   **[en:tran:Set Specific Screen]**, **[en:tran:Disable]**, **[en:tran:Add CC Elements]**, **[en:tran:Add Media Control]**), and a **CC line** gets its
   short one (**[en:tran:Reveal Original]**, **[en:tran:Set Specific Screen]**, **[en:tran:Remove CC Element]**).

---

### W-22c — Clear the screen, or show and hide it, from a running order

**Goal:** put something to _do_ in the running order — clear a screen, light it, darken
it — rather than something to show.

1. **Add a screen action.** A running order can also hold something to _do_ rather than
   something to show. Right-click **the presenting flow itself** — its own row in the
   list, not the empty part of the list and not one of its lines — and choose
   **[en:tran:Add Action]**: every action is added from that one menu. For a clear,
   pick **[en:tran:Clear Screen]** there — a row that adds nothing and opens the clears — and then
   one of **[en:tran:Clear All]**, **[en:tran:Clear Background]**, **Clear
   Slide** ([en:tran:Clear Slide]), **[en:tran:Clear Long Text]** or **[en:tran:Clear Foreground]** — the same five clears as the buttons on each mini screen, and the line
   carries the same `ALL` / `BG` / `SL` / `LT` / `FG` badge so you can tell them apart at a
   glance. It lands at the end of the list; drag it up to where it belongs — say between
   the last song and the sermon. 📸

   Under those five, **[en:tran:Other Clear FG Items]** offers a **finer clear
   for one foreground widget at a time**, so you can take the countdown down and leave the
   marquee running: **[en:tran:Clear FG Messages]** (`MS`), **[en:tran:Clear FG Marquee Top]** (`M↑`), **[en:tran:Clear FG Marquee Bottom]** (`M↓`), **[en:tran:Clear FG Quick Text]** (`QT`), **[en:tran:Clear FG Countdown]** (`CD`), **[en:tran:Clear FG Stopwatch]** (`SW`), **[en:tran:Clear FG Time]** (`TM`), **[en:tran:Clear FG Video Show]** (`VD`), **[en:tran:Clear FG Image Show]** (`IM`), **[en:tran:Clear FG Camera Show]** (`CM`), **[en:tran:Clear FG Screen Show]** (`SS`) and **[en:tran:Clear FG Web Show]** (`WB`). Each does exactly what that widget's own hide button in the **[en:tran:Foreground]** panel does; the `Messages`, `Time`, `Video Show`, `Image Show`, `Camera Show`, `Screen Show` and `Web Show` ones clear all of their items at once.
2. **A screen action is run, not shown.** Click it to clear, drag it onto one mini screen
   to clear only that one, or right-click → **[en:tran:Apply on Screens]** to choose. It never
   lights up as "live", because there is nothing of it on the screen to be live. In the
   preview panel (W-22b) it is stopped on and fired like any other line — so a
   **[en:tran:Clear All]** between the last song and the sermon means one more press of the same
   key blanks the screen at exactly that point in the running order.
3. **Put the screen itself up and down.** Two more actions are not about what is _on_ a
   screen but about whether there is one: **[en:tran:Screen: Show]** and
   **[en:tran:Screen: Hide]**, the same thing the slides button on each mini screen
   does by hand. Use them when the running order has to work with nobody at the machine —
   a **[en:tran:Screen: Show]** at the top of a pre-service loop, a **[en:tran:Screen: Hide]** at the end of
   it, and the screen goes dark on its own instead of holding the last announcement until
   someone notices.

   **These two ask which screen** when you add them, and that is the whole point: a
   checklist of the screens you have open appears (`Screen id: 0`, `Screen id: 1`, …,
   each in that screen's own colour), and the line remembers your answer as its pin — the
   line shows the pin badge, and **[en:tran:Set Specific Screen]** re-aims it later. Unlike every
   other line, it goes to those screens and _only_ those: it will not fall back to
   whichever screen you happened to have selected, and it will never stop to ask, because
   at 7:05 on an unattended sheet there is nobody there to answer. Tick nothing and the
   app says **[en:tran:Please choose at least one screen]** rather than adding a line that would do
   nothing. Like every action, the line lands at the end of the list: drag it up to where it
   should fire. Firing one twice is harmless — a **[en:tran:Screen: Show]** on a screen that is already
   up does nothing at all, so it is safe inside a loop. Nothing can be attached to them
   either, though they can themselves be attached to another line — "put this last slide
   up **and** light the screen" in one click. 📸
   Clicking one goes to the screens it names and nowhere else; **[en:tran:Apply on Screens]**
   still asks, since that entry is you saying "send this one somewhere else" — but it
   does not change what the line is pinned to.
4. **Where the actions live in the menu.** **[en:tran:Add Action]** opens with **[en:tran:Clear Screen]** —
   one row that adds nothing and opens the five clears, with **[en:tran:Other Clear FG Items]**
   under them for the twelve per-widget foreground clears — then **[en:tran:Screen: Show]** / **[en:tran:Screen: Hide]**, then the five that drive the run.

---

### W-22d — Make a running order wait, then move on by itself (Next: Timeout)

**Goal:** a slide that lingers and then goes on without you, or a notice board that
ends exactly when the service starts.

1. **Let the running order walk itself.** In the **[en:tran:Presenting Flows]** list (not
   in the preview panel), right-click **the presenting flow itself** — the
   row with its name on it, not the empty part of the list and not one of its lines — and
   choose **[en:tran:Add Action]** → **[en:tran:Next: Timeout]**. That adds a NEW line to
   the running order; it is never added by right-clicking a line that is already there.
   It goes at the END of the running order: drag it up to just after the line it should
   follow.
   It asks how many **[en:tran:Seconds]**, and the answer is part of the new
   line — `⏱ Next: Timeout (5)` — so a glance at the sheet tells you how long it waits. Got
   it wrong? Right-click that `Next: Timeout` line → **[en:tran:Change Timing]**; it opens
   on what it is holding now. 📸
2. **[en:tran:Next: Timeout]** waits once. When the run reaches it, it counts down and then moves
   the run on by itself — a slide that should linger ten seconds and then go on without
   you. **Going somewhere yourself calls it off**: click another line, or press the next
   key, and the wait is over and you are driving again. A click that goes nowhere does
   NOT call it off: clicking a background or a foreground button, or a stray click on
   the panel, leaves it counting, so a mis-aimed click cannot silently cost you the wait.
3. **Or wait until a time on the clock.** A timeout does not have to be counted in
   seconds. The small box that asks for the seconds — it opens when you add the line
   (step 1, then drag the new line up to just after the line it should follow), and again from right-click → **[en:tran:Change Timing]** on that line — has a
   chooser at its left: switch it from **[en:tran:Seconds]** to **[en:tran:At Time]** and type the
   time you want the run to move on — `7:05 AM`, `8:30 PM`. The line then reads `⏱ Next: Timeout (7:05 AM)`, and
   the pill counts down in minutes and hours (`4:58`, `1:12:30`) instead of a long number
   of seconds. Use it for the notice board before a service: put it on the last
   announcement and the run leaves it exactly when the service starts, whether you armed
   it an hour or five minutes before. Its menu entry is **[en:tran:Change Timing]** rather than **[en:tran:Change Seconds]**, and it opens on whichever half
   you armed it with — the two are alternatives, so choosing one clears the other. If the
   time you set has **already gone by**, the app says so (**[en:tran:The set time is already due]**)
   and starts nothing: it will not quietly wait until tomorrow. Set a new time, or arm it
   in seconds. 📸
4. **It counts only in the preview panel.** A `Next:` line means something only while that
   presenting flow's **preview panel** is open (W-22b) — that panel is what walks the
   running order: clicking the line there starts its countdown, and a small pill at the
   panel's top-right shows the seconds left, with ⊗ to stop it and ⏸ to hold it. Click the
   line with the panel closed and the app says so
   (**[en:tran:Open the presenting flow preview to use this action]**) rather than looking as
   though it did something. It never goes to a screen, so it has no **[en:tran:Apply on Screens]**
   and no **[en:tran:Set Specific Screen]**, and nothing can be attached to it.
5. **A timeout can also ride along with another line.** Attach it to a line — a
   slide, a song, a verse — as a **CC element** (W-22g), and that line means "show this,
   and go on by yourself N seconds later". Add the **[en:tran:Next: Timeout]** once, right-click the
   line you want it on → **[en:tran:Add CC Elements]** and pick it. Keep the
   `Next: Timeout` line itself in the list, though: a CC points at that line rather than copying it, so removing the line removes every follower of it as well (park it with **[en:tran:Disable]** if the run should not stop there — its followers still fire). Attached to
   a whole SONG it rides every slide of it, which is how a song advances by itself. 📸
6. **Each line may wait for its own length.** First create a timeout if there is none:
   right-click the presenting flow's own name → **[en:tran:Add Action]** →
   **[en:tran:Next: Timeout]** and enter its seconds. Right-click each line that needs
   a wait → **[en:tran:Add CC Elements]** and pick that timeout. It appears as an
   indented CC row under each line it is attached to. A CC line normally reads whatever the
   `Next: Timeout` line is set to, so re-arming that one line re-arms every follower of it
   at once. When one line needs a different wait, click the small **stopwatch** at the
   right of **that CC line — the indented row under the line, not the line itself** (or
   right-click that CC line → **[en:tran:Change Timing]**) and
   answer with seconds or a time of day, exactly as on a line of its own. That answer
   belongs to **that attachment only**: the same `Next: Timeout` can hold the welcome slide
   for 4 seconds and the notice slide for 30, with one timeout in the running order instead
   of one per length. A row holding its own wait shows the stopwatch **filled** and reads
   its own number; one still following the element shows it hollow. To hand a row back,
   right-click it → **[en:tran:Use Element Timing]** — it goes back to the
   element's number and moves with it again. 📸
7. **If the run stopped moving on by itself**, one of three things happened. You went
   somewhere yourself — clicked another line, or pressed the next key — and that calls a
   timeout off. Or the preview panel was closed: no `Next:` line counts without it. Or the
   run reached the end of the list. To set it going again, click the `Next:` line (or the
   line it rides on) in the preview panel.

---

### W-22e — Loop a set of slides, stop the loop, and jump back (Next: Interval, Jump to)

**Goal:** a loop of announcement slides that runs by itself before the service and stops
where you say, and a running order that can go back to an earlier line.

1. Right-click **the presenting flow itself** — its own row in the list, not the empty part of
   the list and not one of its lines — and choose **[en:tran:Add Action]** →
   **[en:tran:Next: Interval]**. It asks how many **[en:tran:Seconds]**, and the answer is part of the
   line; right-click the line → **[en:tran:Change Seconds]** to change it. Like every `Next:` line
   it works only while the preview panel is open (W-22b).
2. **[en:tran:Next: Interval]** keeps going. It moves the run on every so many seconds — a loop of
   announcement slides before the service. Going somewhere yourself does not stop it, it
   **starts the count again from there**, so a line you step to by hand gets the whole
   interval rather than the second that was left of the last one. To stop it, click the
   ⊗ (**[en:tran:Stop Auto Next]**) on the pill it puts at the top-right of the preview panel (it shows the seconds left, in
   the same colour as the line that started it); the ⏸ on the same pill (**[en:tran:Pause Auto Next]**) holds the count where it is until you press it again. Closing the panel stops it too, as does
   reaching the end of the sheet.
3. **[en:tran:Next: Clear Interval]** stops that loop, and it is the
   one way the SHEET can stop it: the pill, closing the panel and the end of the list are
   all you being at the machine. Add it — it asks nothing, there being only ever one clock
   running — and the line reads `⊘ Next: Clear Interval` in the interval's own colour,
   because it is that same thing undone. Put it after a looping set (an interval, a few
   slides, a **[en:tran:Jump to]** pointing back at the interval) and the loop runs until the run
   reaches this line, then stops and waits for you. Firing it when nothing is looping does
   nothing at all and says nothing, so it is safe to leave in a sheet you re-run. It stops
   an interval you have PAUSED as well; a **[en:tran:Next: Timeout]** it leaves alone, so a wait
   attached to a slide is never killed by a line that only meant to end a loop. 📸
   **A Next: Interval cannot be attached to anything** and is simply not in that list —
   an interval is not stopped by anything you do, so one riding a slide would keep moving
   the running order on with nothing to call it off but the panel's own pill. A
   **[en:tran:Next: Clear Interval]** CAN be attached, for the opposite reason: "put this last slide
   up **and** stop the loop" is one click, and something that stops a loop can never run
   away with the running order.
4. **Go back, not just forward.** **[en:tran:Jump to]** is how a running
   order reaches a line that is not the next one. Add it from the same menu as the interval — right-click
   the presenting flow itself, not one of its lines → **[en:tran:Add Action]** →
   **[en:tran:Jump to]** — then drag the new line from the end of the list, where it
   lands, to where the run should meet it, and right-click it →
   **[en:tran:Add CC Elements]** and pick the line it should go to — its list is everything in the
   presenting flow, **a whole song included**, because here the attached line is not something
   that rides along, it is the destination. It takes exactly one, so once you have picked
   the **[en:tran:Add CC Elements]** entry is gone; to re-aim it, remove the CC and pick another.
   To jump now, right-click the presenting flow → **[en:tran:Open Preview]**, then click
   the **[en:tran:Jump to]** line in the preview; reaching it with **Space** does the same. 📸

   **It is the next key aimed at a line of your choosing**: when the run reaches it — or
   you click it — the panel goes to that line and does there exactly what stepping onto it
   would have done. A song opens at its first slide; a **[en:tran:Next: Interval]** or **[en:tran:Next: Timeout]** it lands on is STARTED. That last one is how a set loops: put the slides
   under a **[en:tran:Next: Interval]**, and a **[en:tran:Jump to]** at the end of them pointing back at that
   interval — the set then plays round and round on its own until you stop it with the
   pill. (A jump that lands on another jump stops there rather than jumping again, so a
   pair of them cannot send the run back and forth for ever.) If it has nothing attached,
   or the line it named has since been deleted, it says so instead of quietly doing
   nothing.
5. **A loop of slides before the service, from start to finish.** The slides of the set
   are lines of the presenting flow already. (a) Right-click the presenting flow →
   **[en:tran:Add Action]** → **[en:tran:Next: Interval]**, type the seconds each slide
   stays, and drag that line above the first slide of the set. (b) Right-click the
   presenting flow → **[en:tran:Add Action]** → **[en:tran:Jump to]** and drag it under
   the last slide of the set; then right-click the **[en:tran:Jump to]** line →
   **[en:tran:Add CC Elements]** and pick the **[en:tran:Next: Interval]** line. (c) Open
   the preview panel (W-22b) and click the **[en:tran:Next: Interval]** line: the set
   plays round and round by itself. It stops when you click **⊗** on the pill at the
   top-right of the preview panel, or close the panel. Nothing is dragged ONTO the
   interval or the jump: they are lines of their own, in the list.

---

### W-22f — Reach a line with a key of your own (Keyboard Event)

**Goal:** one shortcut that sends the run to a line and puts it — and everything attached
to it — on the screens at once, wherever the run had got to.

1. **Reach a line with a key of your own.** A **[en:tran:Keyboard Event]** is a shortcut you set yourself. Add it from the menu of the presenting flow (right-click the presenting
   flow itself → **[en:tran:Add Action]** → **[en:tran:Keyboard Event]**): it asks for the
   shortcut, and you answer by **pressing it** — the box is not typed into. Hold **Ctrl**
   or **Shift** (those two only, and at least one of them, so the shortcut means the same
   thing on any machine and cannot take a key the running order already uses) and press
   the key. The line then reads `⌨ Keyboard Event (Shift+A)`. Re-set it later from
   **[en:tran:Change Shortcut]**. Two lines may not share a shortcut — the second one is refused
   out loud — and duplicating a line leaves the copy without one. 📸
2. **Attach what it should put up, and keep the preview panel open: the key works only
   while it is.** Right-click the new line → **[en:tran:Add CC Elements]** — as many as you like, which
   is what makes one key worth more than one click: a slide _and_ its marquee together,
   say. Then, with the preview panel open (W-22b), pressing **Shift+A** sends the run to
   that line and puts all of it on the screens at once, wherever the run had got to.
   Pin the line to a screen with **[en:tran:Set Specific Screen]** if it should always go to the
   same one. The shortcut only answers while the preview panel has the keyboard, exactly
   as its arrow keys do — the panel takes it the moment you open it, so there is nothing
   to click first. With nothing attached yet it says so rather than doing nothing. 📸

---

### W-22g — Make one line bring others with it (CC elements)

**Goal:** the moment verse 1 goes up, the welcome marquee is up too — one click, both.

1. **Make one line bring others with it — CC elements.** Some things belong _together_: the
   moment verse 1 goes up, the welcome marquee has to be up too. Attach the marquee to that
   line as a **CC element** and one click does both.

   Attach one in either of two ways:
   - **drop it onto the line** — drag the marquee button, a background, a verse or a slide
     out of its own panel and drop it _on the line it belongs to_ (the line outlines in
     dashed amber as you hover it). Dropping onto a **document's slide** attaches it to
     that one slide; dropping onto the document's own line attaches it to the whole song.
     You can also drag a line **already in the presenting flow** — a clear action included — onto
     another line. Something dragged in from another panel is also added as a line of its
     own at the end of the list — a CC points at a line of the running order — so leave that
     line in place: removing it removes the CC with it.

     **Aim at the middle of a line to attach, at its top or bottom edge to move.** To drop one line onto another, drag that line
     itself. A line
     of the running order does both jobs, and it tells you which one it is about to do:
     lines along the top and bottom edges mean "this line moves here", a dashed box round
     the whole line means "this goes _onto_ that line". Slides and CC lines have no order
     of their own, so anywhere on them attaches.

     **Or say which you mean and stop aiming**: hold **Ctrl** (⌘ on a Mac) while you drag
     and the drop takes that PLACE, hold **Alt** and it always ATTACHES, anywhere on the
     line. Press or release the key mid-drag and the mark under the pointer changes with
     it, so you can see what the drop will do before you let go. (Holding both, the place
     wins.) For a line of this running order "takes that place" means it MOVES there; for
     something dragged in from another panel it means it is INSERTED there — which is the
     only way to put it anywhere but the end of the list, since dropping on the presenting flow's
     name adds to the end.

   - right-click the line → **[en:tran:Add CC Elements]** and pick from the other
     lines already in this presenting flow. 📸

   A CC element shows as a `↳` line just under the one it rides with. From then on,
   **clicking that line — or reaching it with the arrow/Space keys in the preview — puts
   the line AND its CC elements on the screen together**, on the same screens the line
   itself went to. You are never asked "which screen?" twice for one click.

   - A CC on a **document line** rides with _every_ slide of that song (a document line has
     nothing of its own to show, so this is what "keep this marquee up for this song"
     means); a CC on **one slide** rides with that slide only.
   - A CC can have a screen of its own: right-click it → **[en:tran:Set Specific Screen]** to send it
     somewhere else while its line goes to the usual place. **[en:tran:No Specific Screen]** hands it
     back to following the line.
   - **Clicking a CC line never projects it.** It scrolls the element it points at into
     view and flashes it — in the presenting flow and in the preview window at once — so you can
     always find what a short label refers to.
   - Right-click a CC line for **[en:tran:Remove CC Element]**. There is no
     **[en:tran:Disable]** on a CC: parking takes a _line_ out of the running order, and a CC is not
     a line of the running order — one you do not want is simply removed. (So attaching a
     line you have parked gives you a CC that _does_ fire, while the parked line itself
     stays parked.) A whole document and an audio track cannot be CC elements — neither
     reaches a screen — and the app says so if you try.

   An element can hold as many CC elements as you like; a CC element cannot have CC
   elements of its own.

---

### W-22h — Play the video or song inside a slide by itself (Media Control)

**Goal:** the running order presses play on a slide's own video or audio for you — from
where you say, for as long as you say.

1. **Media Control — playing the video or song inside a slide by itself.** A slide can hold
   a video or an audio clip of its own, and normally you press play on it by hand on the
   mini screen. Right-click the slide (or the document line, or the line of a slide inside
   a document) → **[en:tran:Add Media Control]** and the running order does it
   for you. A settings panel opens first — nothing is added until you press **[en:tran:Ok]**:

   - **[en:tran:Action]** — **[en:tran:Play]**, **[en:tran:Pause]** or **[en:tran:Stop]**. Play starts the media; Pause leaves it
     where it is; Stop pauses it and winds it back to the start point, so the same line can
     be used again. Put a Pause or a Stop on a later line to cut a clip short.
   - **[en:tran:Delay Before]** — wait this many seconds after the slide goes up before doing
     anything. Leave it at 0 to act at once.
   - **[en:tran:Media Start At]** — where in the clip to begin, in seconds.
   - **[en:tran:Then Pause]** — **[en:tran:Never]**, **[en:tran:After]** so many seconds of playing, or **[en:tran:At Media Time]**
     to stop at a point of the clip itself (so "play 0:10 to 1:10" is two numbers, not a
     stopwatch).
   - **[en:tran:Volume]** and **[en:tran:Speed]** — each behind a tick box, because leaving one un-ticked means
     "don't touch it": the level you set by hand on the mini screen stays as it is.
   - **[en:tran:Set Specific Screen]** — leave every box clear and it works on whatever screens the
     slide went to. Tick one and it works **only** where the slide also landed. It is
     controlling the media the slide put on a screen, so a screen the slide never reached
     has nothing on it to control.
2. The new line appears as a CC element under the slide, reading what it will do —
   `Slide: Media Control (Play +3s 10s→70s 70% 2x)` — with a small **cyan gear** at its
   right. Click the gear (or right-click → **[en:tran:Media Control Settings]**) to change it later;
   it opens on what you set last time. A plain `Slide: Media Control` line is also added at
   the end of the list: the CC points at that line, so leave it there — removing it removes
   the control with it. 📸

   Every video and audio clip in that slide is driven together. The sound comes out of the
   presenter machine, exactly as it does when you press play by hand, so the **[en:tran:Volume]** is
   the level you hear at the desk; the projected screen stays silent and simply keeps in
   step, at the same speed.
3. **Moving off the slide stops it.** When you put another slide on that screen — or clear
   the screen — everything the Media Control started is stopped and anything still waiting
   (a "stop at 1:10", a delayed start) is dropped, so nothing carries over to whatever you
   put up next. This is what lets the running order carry on: a clip you started **by
   hand** on the mini screen blocks the next slide until you pause it (the app says
   **[en:tran:Media is Playing]**), because there the app cannot know you meant to leave it — but a
   clip the running order started is the running order's to stop. 📸

   This one is only ever attached to a slide: you will not find it under **[en:tran:Add Action]** on
   the running order itself, because "start this video ten seconds in" is a sentence about
   one particular slide.

---

### W-22i — Send a line to one particular screen, or park a line

**Goal:** a lyric that always goes to the stage screen without being dragged there, and a
line you cannot fire by accident.

1. **Send a line to one particular screen, every time.** If a lyric always belongs on the
   stage screen and the sermon slides on the main one, you do not have to drag them there
   over and over. Right-click the line → **[en:tran:Set Specific Screen]** and
   tick the screens it should go to — `Screen id: 0`, `Screen id: 1`, … The menu stays open
   so you can tick more than one, and the line then shows a small 📌 with those numbers —
   **each number in its own screen's colour**, the very colour that screen's mini-screen
   badge wears, so you can tell at a glance where a line goes without reading the digit.
   (The tick boxes in the menu are tinted the same way.) 📸
   From then on **clicking that line ignores which mini screens are selected**
   and goes straight to its own; so do the arrow/Space keys in the preview panel. Untick
   them, or choose **[en:tran:No Specific Screen]**, to hand it back to the
   normal behaviour.

   Two things deliberately still override a pin, so you are never stuck: **dragging** the
   line onto a mini screen puts it on _that_ screen just this once, and right-click →
   **[en:tran:Show on Screens]** still asks which screen you mean. If the pinned screen has been
   closed, nothing is projected anywhere and the app tells you so ("Please make sure the
   screen is open") rather than quietly using a different screen.
2. A **document** line can be pinned too — its slides then all follow it — and you can pin
   **one slide on its own**: open the document's arrow, right-click the slide and set its
   screen. That slide overrides the document; its neighbours keep following the document.
   A slide pinned in its own right shows the 📌 on its own line **and in the bottom-right
   corner of its thumbnail in the preview panel**, so a run sheet you are reading as
   pictures still tells you which slide breaks away from its document. Clearing it hands
   that slide back to the document rather than pinning it to nothing. The same right-click
   is on the slide thumbnails inside the preview panel.
3. **Park a line you do not want touched.** A line you might click by accident — an
   alternate verse, last week's notice, a song you may or may not reach — can be taken out
   of the running order without deleting it: right-click it → **[en:tran:Disable]**. The line dims, is written in italics, is **crossed out** and gains a small
   amber 🚫 at its right end, and from then on **clicking it does nothing at all** — nothing
   is projected, and a document line does not even open. Dragging it onto a mini screen puts nothing there,
   and the arrow/Space keys in the preview panel step straight past it. Right-click →
   **[en:tran:Enable]** puts it back. (While a line is parked its menu drops
   **[en:tran:Show on Screens]** — an entry that could no longer do anything — but everything else
   stays, so you can still recolour it, move it, or turn it back on.) 📸
   You can park **one slide of a document** the same way: open the document's arrow and
   right-click the slide. Park the **document itself** and every slide under it is parked
   with it. A parked line can still be dragged up and down to tidy your running order, and
   parking is remembered in that presenting flow only — the same song stays live in your other
   services.
4. **Two kinds of greyed-out line, and they now look different.** A line YOU parked here is
   crossed out and carries the amber 🚫 ("This item is disabled in this presenting flow"). A slide
   that is greyed out because the **document itself** hides it is _not_ crossed out and
   carries a plain grey 👁‍🗨 ("This item is disabled in its document") — right-clicking that
   one will not bring it back, because a running order cannot re-enable what the document
   turned off; open the document and enable the slide there. In the preview panel the same
   two marks sit in the **bottom-left corner** of each dimmed thumbnail. 📸

---

### W-22j — Share a presenting flow with another machine

**Goal:** hand the whole service — the running order and every file it needs — to another
machine as one file.

1. Right-click the presenting flow → **[en:tran:Export]**. A small panel asks for a
    **[en:tran:Password]** and a **[en:tran:Confirm Password]**.
    **Leave both empty and press Ok** for the ordinary bundle: one
    `<name>.owapf.tar.gz` file in your **Downloads** folder, and the folder opens. It
    contains the presenting flow _and every file it needs_ — the full documents behind your
    slides, the images and videos, and any background attached to those documents.
    (See step 1a to put a password on it instead.)
    1a. **To protect it with a password**, type the same password in both fields and press
    **[en:tran:Ok]**. **[en:tran:Show Password]** reveals what you typed if you want to
    check it. You get `<name>.owapf.enc` instead — the same bundle, locked. If the two
    fields do not match the panel says **[en:tran:Passwords do not match]** and asks again rather than exporting, keeping what you
    already typed so you only fix the half that is wrong. Clearing both fields is always
    allowed — that just means "no password".

    > **There is no way to recover a forgotten password.** Nobody — not you, not the app,
    > not the person you send it to — can open the bundle without it. Write it down
    > somewhere safe before you hand the file over, and send it by a different route than
    > the file itself.

2. **Import on the receiving machine.** First open **[en:tran:Settings]** →
    **[en:tran:Path Settings]** and choose the destination folders for the file
    types in the bundle. Then right-click an empty part of the **[en:tran:Presenting Flows]** list → **[en:tran:Import]** and pick that file — or just **drag the `.owapf.tar.gz` (or `.owapf.enc`)
    file from your file manager onto the Presenting Flows list**, which imports it the same way.
    A protected bundle asks for its password first, saying **This archive is password
    protected** ([en:tran:This archive is password protected]); get it wrong and it says
    **[en:tran:Wrong password, try again]** and lets
    you retype it, up to three tries. An ordinary bundle never asks. The songs, documents
    and media are re-created in that machine's own folders, Bible verses are added to the
    **Default** list, and every link inside the presenting flow is re-pointed at the local
    copies. 📸
3. If the bundle is on a web server or a machine sharing it over the local network,
    you can skip copying the file about: right-click the **[en:tran:Presenting Flows]** list →
    **[en:tran:Import From URL]**, paste the link and press **[en:tran:Ok]**. (If the link is
    already on your clipboard it is filled in for you.) The app downloads the bundle to a
    temporary folder, imports it exactly as above and then deletes the download — you end
    up with the presenting flow and nothing else left over. A plain `http://…` address with a
    port, such as one served off another laptop, works as well as `https://`. 📸

> Notes: a file that is already there **with the same contents** is reused rather than
> duplicated, so importing the same bundle twice is safe. If a file of the same NAME is
> already there but is actually a different file — your own `a.mp4` is not the `a.mp4`
> in the bundle — yours is left untouched and the bundled one is added beside it as
> `a (1).mp4`, with the presenting flow pointed at that copy. Slides and documents are
> stored as _references_, so editing a song later means the presenting flow projects the new
> words. Colours and cameras carry no file, so there is nothing to bundle for them.
>
> A video placed **inside a slide** travels too: the bundle carries the video file and
> the imported slide is re-pointed at the local copy, so it plays on the other machine.
> (Images placed in a slide are stored inside the slide itself, so they always travelled.)
>
> Importing needs the folders it will write into to be **chosen already** — if, say, no
> Videos folder has been picked yet and the bundle carries a video, the import stops
> before it copies anything and tells you which folder to choose first. Nothing is
> half-imported. And if a line in a presenting flow ever shows a warning triangle reading
> **[en:tran:Invalid item]**, that one entry is damaged (usually a hand-edited file) — the rest of
> the running order still works; remove that line and re-add it.

---
### W-23 — Share one document (song, sermon slides, PDF) with another machine

Sometimes you only want to hand over **one** item, not a whole service. A document
travels as its own bundle, with everything attached to it.

1. In the **[en:tran:Documents]** list, right-click the item you want — an Open Worship slide
   document, a lyric, a PDF, a PowerPoint or a Word file all work — and choose
   **[en:tran:Export]**. 📸
2. A small panel asks for a **[en:tran:Password]** and a **[en:tran:Confirm Password]**. Leave both empty and press **[en:tran:Ok]** for the ordinary bundle, or
   type the same password in both to lock it — see W-22 step 10a, it works identically
   here and there is no way to recover a forgotten one. 📸
3. You get one `<name>.owadoc.tar.gz` file in your **Downloads** folder (or
   `<name>.owadoc.enc` if you set a password), and the folder opens. It contains the
   document itself plus everything hanging off it: the background you attached to it
   (and that background's image or video file), any video placed inside its slides, and
   its colour note.
4. On the other machine, right-click an empty part of the **[en:tran:Documents]** list →
   **[en:tran:Import]** and pick that file — or just **drag the
   `.owadoc.tar.gz` (or `.owadoc.enc`) file from your file manager onto the Documents
   list**, which imports it the same way. A protected bundle asks for its password
   first; an ordinary one never does. 📸
5. The document appears in that machine's documents folder under its original name, with
   its background re-attached and its colour note restored, so it is ready to present
   straight away.
6. If the bundle is on a web server or a machine sharing it over the local network, use
   **[en:tran:Import From URL]** instead and paste the link. The
   download goes to a temporary folder, is imported exactly as above, and is then
   deleted.

> Notes: the same rules as a presenting flow bundle apply. A file already there **with the same
> contents** is reused rather than duplicated, so importing twice is safe; a file of the
> same NAME that is actually a different file is left untouched and the bundled one lands
> beside it as `a (1).pdf`. A document that already has a background attached keeps its
> own — an import never overwrites it, and it does not overwrite that document's colour
> note either. Importing needs the folders it writes into to be **chosen already** (for a
> document with a video background, the Videos folder too), and if one is missing the
> import stops before copying anything and tells you which to choose.
>
> If you export the same document twice, the second file is named
> `<name> (1).owadoc.tar.gz`. That name still ends in `.owadoc.tar.gz`, so dragging
> _that_ copy onto the list imports it like the first (a `<name>.owadoc.tar (1).gz`
> written by an older version of the app is taken the same way).

_Verify: PL-77..PL-80, CM-36, CM-37._

> This works for a **lyric** too — a lyric is a row in the same Documents list. Its
> bundle carries the lyric plus every background you attached to its slides, so the song
> arrives on the other machine already looking the way you set it up.

---

### W-45 — Save a slide document as a PowerPoint file (Export to PPTX)

For when a slide document has to be shown or edited where this app is not — a guest
speaker's laptop, a church that uses PowerPoint, Google Slides or Keynote. Unlike
**[en:tran:Export]** (W-23), which carries the document to another Open Worship app, this makes a
PowerPoint file anyone can open.

1. In the **[en:tran:Documents]** list, right-click an Open Worship slide document (or press the
   **⋮** at the end of its row) and choose **[en:tran:Export to PPTX]**. It sits just
   under **[en:tran:Export]**. 📸
2. For a lyric, select its row so the **[en:tran:Stage Previewer]** opens. Add or remove
   stages until the layouts you want are visible, then press the **⋮** in the Stage
   Previewer header and choose **[en:tran:Export to PPTX]**. The app writes one deck per
   visible stage: `<song> - Stage 0.pptx`, `<song> - Stage 1.pptx`, and so on. Each deck
   uses that stage's own lyric layout and style. 📸
3. A message **[en:tran:Export to PPTX]** appears saying **[en:tran:Exported to]** and
   where: a `<name>.pptx` in your **Downloads** folder, which opens with the file in it.
   A lyric batch opens the Downloads folder once; exporting again adds numbered copies
   beside the earlier decks. 📸
4. Open it in PowerPoint. Each slide looks the way the screen shows it:
   - the words stay words you can change, broken into lines exactly where the app breaks
     them, in the same font — and where that font has no letter for part of the text (the
     English inside a Khmer title), in the font the app used for it instead;
   - text boxes keep their colour, see-through fill and rounded corners, and a box that
     blurs what is behind it carries that blur as a picture underneath it;
   - pictures keep their place and size; a video becomes its first frame and a website
     box its picture of the page;
   - behind each slide is the background the screen would be showing: the slide's own,
     else the document's, else the one the slide before it left up — so the slides that
     follow a video background keep it, as they do when you present them in order. 📸
5. Anything you wrote in a slide's **[en:tran:Slide Note]** is in that slide's **Notes** in
   PowerPoint, and a slide you disabled comes out as a **hidden** slide, skipped when the
   show runs.

> Notes: a slide document exports from its row menu; a lyric exports from the Stage
> Previewer header because each visible stage is a separate rendered layout. A PDF,
> PowerPoint or Word file in the list already is its own file. The
> file is a copy: changing it changes nothing in the app. A YouTube box becomes the
> video's picture when the computer is online; a camera box, a camera background and a
> live web page as a background cannot be exported, the same as printing leaves them out.
> PowerPoint on another computer uses the fonts THAT computer has, so for the same look
> there install the same fonts (the lines break in the same places either way).

_Verify: PL-106._

---

### W-24 — Share a bible list with another machine

A bible list (the verses you lined up for a service) travels the same way.

1. In the **[en:tran:Bibles]** panel, right-click the list you want and choose **[en:tran:Export]**. A small panel asks for a **[en:tran:Password]** and a **Confirm
   Password** ([en:tran:Confirm Password]) — leave both empty for the ordinary bundle, or type
   the same password in both to lock it (W-22 step 10a). You get one
   `<name>.owbible.tar.gz` file in your **Downloads** folder, or `<name>.owbible.enc`
   if you set a password. 📸
2. The bundle is small: a bible list stores verse _references_, not the Bible text, so
   only the list and any background you attached to it (or to one of its verses) are
   inside.
3. On the other machine, right-click an empty part of the **[en:tran:Bibles]** panel → **[en:tran:Import]** and pick the file — or **drag the `.owbible.tar.gz` (or `.owbible.enc`) onto
   the Bibles panel**; a protected one asks for its password first. **[en:tran:Import From URL]** works here too. 📸
4. The list appears in that machine's bibles folder with its verses, their colours and
   its background, ready to present.

> Notes: the Bible **versions** the verses name are not part of the bundle — they are
> large, separately downloaded files. If the other machine does not have a version yet,
> download it there (Settings → Bible) and the verses show up. The **[en:tran:Bible Reader]** page
> keeps its own bibles folder, so importing there adds the list to the reader's folder,
> not the presenter's.
>
> A bundle can only be imported by the list it came from: picking a document bundle in
> the Bibles panel (or a bible bundle in the Documents list) is refused with a message
> naming what the file actually holds, and nothing is written.

_Verify: PR-27..PR-29, CM-38, CM-39._

---

### W-25 — Back up everything, or move to a new computer

W-22 to W-24 each carry one thing. To take **all** your material at once — for a backup,
or to set up a second machine — use the app's **File** menu.

1. Open the **File** menu at the top of the window and choose **[en:tran:Export Data]**. 📸
2. A panel lists every data folder you have set up — Documents, Presenting Flows, Background
   Images, Videos, Audios and Webs, Foreground Images and Videos, Bible Present, Bible Reader,
   Bible Notes, **[en:tran:Bibles XML]** and
   **[en:tran:Resources]** — with the folder each one points at. **They all start ticked.** Untick
   anything you do not want (the videos folder is usually the big one), or use
   **[en:tran:Select All]** / **[en:tran:Deselect All]**. 📸

   > **[en:tran:Bibles XML]** and **[en:tran:Resources]** are the two folders you never chose yourself — the
   > app keeps them.
   >
   > **[en:tran:Bibles XML]** carries the Bible XML files you added by hand (Settings → Bible →
   > Bibles XML), and **only those**: the Bible versions you downloaded in the app are
   > left out, because you simply download them again on the other machine. If you have
   > never added an XML Bible, the row is not offered at all.
   >
   > **[en:tran:Resources]** is the `resources` folder inside your data folder — where
   > **[en:tran:Copy to Data Directory]** in the Resources panel (W-37) puts a folder of
   > chapter PDFs, notes or links. All of it goes in, so it can be big; untick it like the videos if you do
   > not need it. A folder you left somewhere else on the computer and only listed in the
   > panel is **not** in the backup — copy it into the data folder first. If you have
   > never copied one there, the row is not offered.
   > 2a. Below the folder list, the same panel asks for a **[en:tran:Password]** and a
   > **[en:tran:Confirm Password]**. Leave both empty for an ordinary backup.
   > Type the same password in both to lock it — a backup carried on a USB stick holds your
   > whole document set, so this is the one worth protecting. 📸

   > **There is no way to recover a forgotten password**, and this file is everything you
   > have. Write it down somewhere that is not the same USB stick.

3. Press **[en:tran:Ok]**. You get one `open-worship-data.owadata.tar` file in your **Downloads**
   folder — or `open-worship-data.owadata.enc` if you set a password — and the folder
   opens. Copy it to a USB stick or the other machine.
4. On the other machine, open **[en:tran:Settings]** → **[en:tran:Path Settings]**
   and choose the destination folders first. Then choose **File** → **[en:tran:Import Data]** and pick that file. A protected backup asks for its password first. A password typed wrong is asked
   for again under _[en:tran:Wrong password, try again]_, three times at most, and then the
   import stops with nothing brought in. Type it exactly as it was set, capital letters and
   all, or ask whoever made the file for it. No one can open it without. The panel then lists only the
   folders the file actually contains — again all ticked — so you can restore just the
   songs, or just the backgrounds. 📸

   > A protected backup is unlocked in one pass before that list can be shown, so a big
   > one takes a moment longer to open than an ordinary one. An ordinary backup is read
   > as quickly as it always was.

5. Press **[en:tran:Ok]**. When it finishes you are told how many files were brought in and how
   many were already up to date. Every folder the **[en:tran:Resources]** row brought back is also
   added to the Resources panel's list, so it shows up there without being added by hand
   (press **[en:tran:Reload]** in the panel's ⋮ menu if the panel was already open).

> Notes: this is a **copy, not a replacement**. A file already on the machine with the
> same contents is left alone, so importing the same backup twice changes nothing and is
> safe to repeat. If a file has the same NAME but different contents — you edited the song
> on this machine — **your version is kept** and the one from the backup is added beside
> it as `song (1).ows`, for you to compare and delete whichever you do not want. Nothing
> is ever overwritten.
>
> Importing writes into the folders **this** machine has set up, so choose them first
> (Settings → Path Settings). If one of them has no folder yet, the import stops before
> copying anything and tells you which to set.
>
> The backup leaves out the working files the app can rebuild by itself — a document's
> undo history and the page images made for PDF/PowerPoint/Word previews — so it stays
> much smaller than the folders themselves, and those are regenerated on the other
> machine the first time you open the document.

_Verify: NAV-17..NAV-19._

### W-26 — Compare two documents side by side (floating slide previews)

**Goal:** look at the slides of more than one document at the same time, without losing
the one you already had open.

**Preconditions:** at least two documents in the **[en:tran:Documents]** list.

The middle panel previews the **one** document you have selected. To look at another one
as well, give it a window of its own.

1. In the left **[en:tran:Documents]** list, **right-click** a document you have NOT
   selected and choose **[en:tran:Open Slides Preview]**. A window titled
   **Slides: ‹name›** appears over the app. 📸
   Faster, once you know it: hold **Ctrl** (**⌘** on a Mac) and click the row. Same
   thing, no menu — and holding Ctrl again on that row closes the window. The menu
   entry's tooltip reminds you of the shortcut.
2. It is the full previewer, not a thumbnail strip: the undo / redo / discard / save
   strip at the top, the slides, the green **[en:tran:Note]** strip (the note boxes start closed — click it to open them), and a zoom slider with the document
   name at the bottom. Everything you can do in the middle panel you can do here —
   click a slide to put it on the screen, drag a slide to reorder it, drop an image or a
   video onto it, right-click a slide for its menu.
3. Drag the window by its title bar to move it, drag any edge or corner to resize it, and
   use the **chevron** to fold it away to just its title. The **✕** closes it.
   **Double-click the title bar** to blow the window up to the whole app window;
   double-click it again to drop it back to the exact size and place it had. Every
   floating window in the app works this way.
4. Repeat step 1 on a second document. You get a **second** window — one per document, as
   many as you need, each opening slightly offset from the last. 📸
5. Zoom one window with its slider (or hold **Ctrl** and scroll over it). Only that
   window changes: every window and the middle panel keep their own zoom.
6. Click inside a window's slide area, then use **Arrow keys / PageUp / PageDown /
   Space** — they step **that** window's document, not whichever one the middle panel is
   showing.

Tips:

- **A document is previewed in one place at a time.** On the document you currently have
  selected, **[en:tran:Open Slides Preview]** is greyed out ("[en:tran:Already showing in the main previewer]") — it is already in the middle panel;
  Ctrl-clicking that row does nothing at all, and in particular does not re-select it. And if
  you click a document that has a window open, the window closes and the document moves
  into the middle panel instead.
- Each window remembers **where you put it, how big you made it and how far you zoomed
  it**, per document — reopen it later and it comes back the same.
- Windows are **not** reopened when you restart the app; you start with a clean screen.
- Renaming or trashing a document closes its window.

_Verify: PM-118, PM-119, PM-120, PM-126, PL-01, CM-06._

### W-27 — Pin the document you are presenting from

**Goal:** stop a stray click in the Documents list from swapping the document you are
half-way through.

**Preconditions:** a document selected in the middle **[en:tran:Documents]** tab.

1. Look at the middle **[en:tran:Documents]** tab heading. With a document selected, a
   faint **pin** (drawn as an open padlock) sits just after the word — nothing selected, no pin. 📸
2. Click the pin. The padlock closes and turns solid amber: the document is now **pinned**. Hovering it
   reads **[en:tran:Unpin document]**. 📸
3. Click a different document in the left list. **Nothing changes** — the previewer keeps
   your document. A message says **Document is pinned** / _Unpin the document to preview
   another one_ ([en:tran:Document is pinned]), and the pin flashes so you can see what stopped
   it. 📸
4. The same protection covers every way of swapping the document: a song row, a document
   inside a **presenting flow**, and clicking the file name in the previewer's own footer (which
   normally opens a list of the other documents in the folder — while pinned it does not
   even open).
5. Click the pin again to unpin. The clicks from step 3 now work normally.

Tips:

- The pin stays on when you **restart the app** — it is remembered with the selection.
- **Renaming** the pinned document is not a swap: the previewer follows the new name and
  stays pinned.
- **Trashing** the pinned document unpins automatically and the pin disappears, since
  there is nothing left to hold on to.
- Clicking the pinned document's own row again is silent — that is not a swap either.

_Verify: PM-121, PM-122, PM-123, PL-01._

---

### W-28 — Build a slide by dragging from the Background panel

**Goal:** put a picture, video, song, web page, camera or colour onto a slide without
walking the Insert menu — just drag it out of the panel you are already browsing.

**Preconditions:** a slide document open in the **[en:tran:Slide Editor]**, and the bottom
**[en:tran:Background]** panel visible.

1. Pick a tab in the bottom **[en:tran:Background]** panel — **[en:tran:Colors]**, **[en:tran:Images]**,
   **[en:tran:Videos]**, **[en:tran:Cameras]** or **[en:tran:Webs]**. At the right end of the same row,
   **[en:tran:Audios]** opens the audio list beside them. 📸
2. Drag one item out of the panel and hold it over the canvas. The canvas **dims** to show
   it will take the drop. (It stays bright for things it cannot use — a Bible verse, for
   example.) 📸
3. Let go. A box appears **centred on where you dropped it**:

   | Dragged from        | You get                                                                               |
   | ------------------- | ------------------------------------------------------------------------------------- |
   | Images              | an image box                                                                          |
   | Videos              | a video box                                                                           |
   | Audios              | an audio player box                                                                   |
   | Webs — a local page | a website box showing a **screenshot** of that page (see W-24 step 4)                 |
   | Webs — a saved URL  | a website box showing a **screenshot**; a **YouTube** link becomes a real YouTube box |
   | Cameras             | a camera box, labelled with that camera                                               |
   | Colors              | a plain coloured box (see step 4)                                                     |

   📸

4. **Colours are the special one.** Drop a colour **on top of an existing box** and it
   **repaints that box** — no new box is added. Drop it on **empty canvas** and you get a
   new coloured rectangle instead. That rectangle is an ordinary text box underneath, so
   you can double-click it and type into it later. A **locked** box (🔒) keeps its colour:
   the app says _This item is locked_ and adds nothing — unlock it first. 📸
5. Anything you drop in is an ordinary box: move it, resize it, reorder it, and **[en:tran:Undo]**
   (Ctrl+Z) takes it straight back out. Save with **Ctrl+S**.

Tips:

- Dropping onto a box only matters for **colours**. Every other kind lands as a new box
  wherever the cursor was, on top of whatever is underneath.
- This is the same drag that sets a screen background — the panel item is unchanged, you
  are only making a copy of it on the slide.
- A camera box remembers **which** camera by name as well as by id, so it still finds the
  right device after a restart.

_Verify: ED-40, ED-41, ED-42, ED-43, ED-44, ED-21, ED-37, PM-06._

---

### W-29 — Look up a Bible name or place (people, tribes, cities, maps)

**Goal:** find out who someone in the Bible was, or where a place is, without leaving
your Bible reading.

1. Open the **[en:tran:Bible Reader]**, or the **[en:tran:Bible Lookup]** popup in the Presenter. At the
   right-hand end of the reference box, click the person-and-pin button
   **[en:tran:Names and locations lookup]**. A small floating
   window opens. The first open takes a few seconds while the dictionary loads. While the
   window stays open it is instant; once you close it the dictionary is let go
   after about ten seconds, and the next open waits for it again. It is a floating window like any other: drag it by its title bar,
   resize it from any edge, and **double-click the title bar** to make it fill the app
   window when you want to read a long list — double-click again to put it back where
   it was. 📸
2. The small **language code** beside that button (`en`) is the language the names and
   places themselves are written in. Click it and pick another — `km - Khmer
(ភាសាខ្មែរ)` — and the lookup list and the
   "in your reading" panel switch to it at once, with nothing to reload.
   Person and location windows already open keep their own language. The choice is
   remembered for next time, and it is **separate** from the app's own language
   (**W-16**): an English menu with Khmer names is a perfectly normal combination. The
   verse references a record cites are read back in **the Bible you are reading**, so
   they name the passage the way your own Bible does. Only the underlined names inside
   the verses themselves do not change — those follow the Bible each verse is IN (the
   King James one in English, a Khmer bible in Khmer), which is what makes them findable
   at all, and not this setting. The lists, the record
   windows and the "in your reading" panel are also **typed in that language's own
   script and font** — the name across the top of a record window included — and the
   kind of each record — **[en:tran:People]**, **[en:tran:Groups]**, **[en:tran:Places]** — is named in it too, in the filter and on each
   record. Every record also carries its **English name in brackets** beside its own —
   _ម៉ូសេ (Moses)_, _យេរូសាឡិម (Jerusalem)_ — the way a Bible book reads
   _លោកុប្បត្តិ (Genesis)_, so a name you only know in English is still recognizable.
   With `en` chosen nothing is added: the name already is the English one. 📸
3. Use the **[en:tran:Names]** and **[en:tran:Locations]** tabs to choose what you are
   looking for, and type in the search box. Each tab remembers what you typed, so you
   can switch back and forth. The list updates as you type. You may type in **either
   language** — with Khmer records on screen, `Moses` and `ម៉ូសេ` both find him.
4. On the **[en:tran:Names]** tab the dropdown beside the tabs narrows the list by kind —
   **[en:tran:All Types]**, **[en:tran:People]**, **[en:tran:Groups]**,
   **[en:tran:Places]** and so on. These follow the **lookup** language from step 2,
   not the app's, so they read the same way as the records they filter. It is greyed
   out on the **[en:tran:Locations]** tab, where there is nothing to filter.
5. Use the arrows at the bottom to page through results, or type a page number in the
   little box and press **Enter**. Starting a new search always takes you back to
   page 1. 📸
6. Click a result to open it in its own small window: a small icon for what kind of
   record it is — a person, a place, a book for a verse — then a short description, then
   a **[en:tran:Details]** section with things like **[en:tran:Also called]**, **[en:tran:Type]**,
   **[en:tran:Gender]**, **[en:tran:Parents]**, **[en:tran:Children]** and **[en:tran:Verses]**. 📸
   The language code in its header, **[en:tran:Names and locations language]**,
   opens the same language menu. Pick another language to open that same record
   in a second window while keeping the first one open. If that record is
   already open in the chosen language, its window comes to the front. This
   choice leaves the language beside the person-and-pin button unchanged.
   > Every row in the list — and in the **[en:tran:Names and locations in your reading]** panel —
   > also carries a **⋮** button at its right end. It opens the same short menu that
   > right-clicking the row gives you, so you never need a right mouse button
   > (see **W-38**).
7. **[en:tran:Verses]** starts closed and shows how many there are — some entries have hundreds
   (Jerusalem has 712). Click it to open, and the references turn into readable
   titles like _Joshua 10:1-43_.
8. Any underlined name or place — in the description or in a list — opens as another
   small window **beside** the one you are reading, so you can follow a family or a
   journey without losing your place. Person and place links use the language
   of the window you followed them from. Clicking the same entry twice in the
   same language just brings its window back to the front.
   Where a description names a book, a chapter or a single verse — _Acts_,
   _Genesis 14_, _Acts 28:15_ — it is written the way **your own Bible** writes it
   when the record window's language is other than English, so a Khmer sentence
   reads _លោកុប្បត្តិ ១៤_ instead of stranding one English name in the middle of it. A
   book or a chapter is simply part of the sentence; a single verse is underlined and
   opens like any other reference.
9. Click a verse reference to read it. With **English** chosen in step 2 you get the
   King James text, because that is the Bible these records were built from; with any
   other language you get the Bible you are currently reading, and the eye button
   below leaves you in it rather than switching you to the King James. The eye button in that
   window's title bar, **[en:tran:Open in bible lookup]**, loads
   that passage into the reference box behind it. 📸
10. For a place that has coordinates, a map appears at the bottom of its window under
    **[en:tran:Approximate location, the marker is an estimated point]**, with an **[en:tran:Open in Google Maps]** link. The map needs an internet connection; places without
    coordinates (Egypt, for example) simply show no map. 📸
11. The copy button in a record window's title bar copies the whole entry — its name
    with the English one in brackets, and all of its verse references whether or not you
    opened the **[en:tran:Verses]** section — ready to paste into a note or a document.
12. Closing the lookup window leaves the record windows you opened where they are.
    Each has its own **×**.
13. **Ask the assistant about it.** The robot at the left end of a record window's
    title bar — **[en:tran:Ask the Assistant About This Person]**, **[en:tran:Ask the Assistant About This Place]**,
    or on a verse window **[en:tran:Ask the Assistant About This Passage]** — opens the
    help window (**W-42**) in a chat of its own about what that window shows. It is
    there only while AI features are on, and it asks the same two questions the
    🤖 asks first. The chat reads the whole record from the app — the description,
    the family and the places, every verse reference and the first verses
    themselves — says it is ready and offers three questions to press, such as
    _Who was Adam?_. Everything you type in that chat is then about that person,
    place or passage, and the assistant looks up the people, places and verses it
    leads to by itself. The names and places come from the King James Version,
    and the assistant says so if you ask. The **[en:tran:Still asking about]** line above
    the box names it; press its **×** to ask about something else. 📸
    A passage you are reading opens the same way: the robot at the end of a Bible
    view's toolbar (the row that shows when the mouse is over its title), or
    right-click the text and choose **[en:tran:Ask the Assistant About This Verse]** for
    the verse under the mouse or **[en:tran:Ask the Assistant About This Passage]** for
    the whole passage.
    **Buttons do the rest, with no question needed.** Under a passage's card:
    **[en:tran:Open in bible lookup]**, **[en:tran:Previous chapter]** and **[en:tran:Next chapter]**
    (**[en:tran:Previous verse]** and **[en:tran:Next verse]** for a single verse),
    **[en:tran:Read it in another Bible]**, **[en:tran:Who and where is in it]**,
    **[en:tran:Open another passage]** (type the one you want, like _John 3:16_),
    **[en:tran:Save to my Bibles list]** and **[en:tran:Copy the passage]**. Under a person's or a
    place's card: **[en:tran:Its verses]**, **[en:tran:Family and places]** (a place:
    **[en:tran:Related places]**) and **[en:tran:Read it in another Bible]**. A name, a place, a
    verse or a Bible in the list that comes back opens its own card in the same chat, and
    every answer ends with **[en:tran:More things to do]**.

**Tip:** the lookup text grows and shrinks with your Bible text, so the bible font
slider (or **Ctrl+Scroll** on the verses) resizes these windows too.

**A note on what is translated:** a person's kind and **[en:tran:Gender]** and a place's **[en:tran:Type]**
come in the lookup language — Jacob is **ប្រុស**, the Pool of Siloam a **ស្រះ** — because each
is one word out of a short, fixed list. A person's **[en:tran:Age]** is shown exactly as the
dataset wrote it, and so is a place type a newer dataset adds before the app knows it.

_Verify: RD-53, RD-54, RD-55, RD-56, RD-57, RD-58, RD-59, RD-60, RD-61, RD-62, RD-63,
RD-64, RD-80, RD-91, PM-126, CB-149._

### W-30 — See who and where is in the passage you are reading

**Goal:** while you read, get the list of every person and place the Bible names in
those exact verses — without searching for them one by one.

1. Open the **[en:tran:Bible Reader]** (or the **[en:tran:Bible Lookup]** popup in the Presenter) and read
   a passage. At the top right, click **[en:tran:Advance Bible Lookup]** (the binoculars). A panel
   opens on the right, its header a **drop-down** listing four views: **[en:tran:Find]**, **[en:tran:Cross Reference]**, **[en:tran:Location-Name (KJV)]** and **[en:tran:Resources]**. Pick **[en:tran:Location-Name (KJV)]** — by its name, not by its place in the list, which moves as views are added. 📸
   _The icon to the left of the drop-down changes with your pick — a signpost for cross
   references, a map pin for names and locations — so you can tell at a glance which
   view the panel is showing._
2. Under the heading **[en:tran:Names and locations in your reading]** — it says **(KJV)** too
   while you are reading these records in English; see the note at the end — you get
   **one block
   per passage you have open**. Each block is titled with the passage it belongs to,
   e.g. `(KJV) Luke 13:1-35`, and lists **[en:tran:Names]** first, then **[en:tran:Locations]**, with a count beside each. 📸
   _One block per passage, not per pane: two panes reading the same verses in two
   versions share one block, and the pane you are typing in is listed by what its
   reference box says._
3. Every row shows the person or place, the verses of that passage where it comes up
   (`13:4, 13:22, 13:33, 13:34`), and a one-line description. A name that appears in
   several verses is listed **once**, with all of its verses on the row. Reading the
   records in a language other than English, each row carries its **English name in
   brackets** too — _យ៉ូហាន (John)_ — exactly as the lookup list does.
4. Open a second passage (split the reading area, or open another reference) and the
   panel grows a second block for it — so you can see the people of two passages at
   once. A passage with nobody in it says **[en:tran:No matches]**.
5. Type a different reference into the box at the top and the list follows along as
   soon as the reference is complete. 📸
6. Click any row to open that person or place in its own small window — the same record
   window as **W-29**, with the full description, family, verses and map. From there you
   can chase references, copy the entry, or send a verse back to your reading. 📸

**Good to know:** the list is built from the King James text, which is what the
names dictionary was made from — that is what the **(KJV)** in the view's name means. You
can be reading any version, or Khmer; the panel still tells you who is in those verses.
It also includes people the verse means without naming — Luke 13:16 lists **Satan**,
which the verse calls "the devil".

**The names in this list follow the lookup language** — the little language code beside
the person-and-pin button (**W-29** step 2), not the language of the app, and they are set
in that language's own font. The passage heading above each block is named the way **your
Bible** names it, and the **(KJV)** note beside the title only appears while that heading is
still a King James one. What the list FINDS is always read from the King James text.

**The underlined names inside the verses follow the BIBLE, not that setting.** A King
James verse underlines its English names; a Khmer bible underlines the Khmer ones, and
clicking either opens the same record. A Khmer verse only underlines a name the
dictionary records for that verse or somewhere in its chapter, so it marks a little less
than the King James column beside it — a name it is not sure of is left as plain words
rather than guessed at. Another English version (NIV, ESV) underlines nothing: the
dictionary was made from the King James wording, and that is the one English text it can
be trusted against.

_Verify: RD-72, RD-73, RD-74, RD-75, RD-76, RD-57, RD-80, RD-91, RD-113._

---

### W-44 — Chat with an AI website inside the app (AI Chat)

**Goal:** use ChatGPT, Claude, Gemini, DeepSeek, Kimi, Grok, Mistral, Perplexity, Qwen or
Copilot — the company's own website, with your own account — in a window beside the app,
the way a browser's AI sidebar does, without leaving the app.

**The ✨ is not the 🤖.** The **✨** opens a company's own AI chat website — ChatGPT,
Claude, Gemini and the like — in a box, signed in with your own account there. The **🤖**
is the app's own assistant: it answers from this
manual and can point at things in the app. This is not the app's own assistant (W-42): nothing here reads this manual or presses
anything in the app, and no API key is needed. It is the site itself, in a box.

1. Click the **✨** ([en:tran:AI Chat]) button in the top-right corner of the window, right
   of the **🤖** and left of the **?**, or open **Help** → **AI Chat** in the menu bar. From
   a window with no top bar, use **Tools** → **[en:tran:AI Chat]**. A narrow window opens beside the
   app, the same size and place as the help window. 📸 It works whether or not **AI
   features** is switched on in Settings → Others: this window holds no key and opens no
   door of the app's.
2. The window opens on a card, **Choose an AI chat to use in this window**, listing the
   sites. Click one. The site loads in the window, and its own sign-in appears if you are
   not signed in; sign in there exactly as you would in a browser. You stay signed in the
   next time the app starts. 📸
3. The row above the site says **CHAT WITH** and which site it is. Change it there to move
   the same tab to another site. Beside it: **←** goes back a page, **↻** reloads,
   **↗** (**Open in your browser**) opens the same page in your normal browser — for the one
   thing a boxed site cannot do, such as a sign-in that insists on opening a popup window —
   and **↤** (**Sign out of every site**), which is step 7.
4. The strip of **tabs** along the top works like the help window's (W-42 step 2): **+**
   starts another tab (it opens on the card again), **×** closes one, a **double-click on a
   tab's name** renames it, and the **⋮** on a tab (or a right-click) opens **Rename this chat**,
   **Lock this chat**, **Close this chat**, **Close other chats…** and **Clear all chats…**. Until you rename
   it, a tab is called after the page — the conversation's own name, on most of these
   sites. Tabs are kept when the window and the app close, up to eight of them, and each
   comes back on the conversation it was on. 📸 **Drag a tab** along the strip to put it
   somewhere else among the others.
   **Closed one by mistake?** A closed tab is not lost: it goes to **Recently closed**,
   listed on the card a new tab opens on and behind the **🕘** (**Recently closed tabs**) in
   the row above the page. Click it and it opens again on the conversation it was on;
   **Ctrl+Shift+T** brings back the last one. The list is shared by every AI Chat window,
   keeps the last twenty, and **Clear this list** under it empties it. 📸

5. Only three tabs keep their site loaded at once — the one in front and the two you used
   most recently. The others unload to save memory and load their last page again when
   you click them, which takes a second and loses nothing: the conversation lives on the
   site, under your account.
   **More than one window.** Each press of the **✨** opens another AI Chat window, and so
   does the **New window** button right of **+** in the strip — up to three at once; a
   fourth press brings the open ones forward instead, because every open site takes
   memory. Each window keeps its own tabs. To give a tab a window of its own, **drag it out**
   of the strip and let go anywhere outside the window, or choose **Open in new window**
   from its **⋮**: a new window opens holding that tab, on the conversation it was on, and
   the tab leaves the first window. You stay signed in, because every window shares the
   same sign-ins. 📸

6. A link the site opens in a new window (a citation, a "learn more") opens in your normal
   browser, never in the app — and only when you pressed something in the site just before.
   A page that tries to open one on its own is stopped, and a line under the row above the
   page says _This site tried to open … in your browser without a press, so it was not
   opened_; press the link again if you meant it. 📸 The site cannot use the camera or your
   location from inside this window, cannot open anything on this computer, and cannot
   reach anything on it or on the building's network — not the app itself, not the router,
   not a printer, not a program such as OBS that listens for connections. Only the
   internet, which is all a chat site wants.

   **Talking instead of typing.** The microphone is the one thing a site may ask for. Press
   its microphone button (Claude's **Dictate**, for one) and a line appears under the row
   above the page: _claude.ai wants to use your microphone. Allow it until the app
   closes?_ 📸 **Allow** lets that site hear you; **Don't allow** — already selected, so
   Enter or Escape picks it — keeps the microphone off, and the site shows its own
   "blocked" message until you press its button and answer again. A yes is for that one
   site, lasts until the app closes, and only counts while its tab is the one in front; a
   tab behind is never let in. **Sign out of every site** (step 7) takes it back. The
   camera stays off whatever you answer.

7. **Sharing this computer?** You stay signed in to these sites until you say otherwise,
   and closing the tabs does not sign you out — that is worth knowing in a church back
   room where several people use the same machine. Click **↤** (**Sign out of every
   site**) in the row above the page, or the same words on the card in step 2, and answer
   **Sign out**. 📸 It asks first, and **Keep me signed in** is the answer already
   selected, so a mis-click costs nothing. It signs out of every site in every AI Chat
   window, since they all share the one sign-in. Your tabs stay where they are; the pages
   they were on, the names the sites gave them and the **Recently closed** list are
   forgotten, a name you typed on a tab yourself is kept, and every site asks you to sign
   in again. It cannot be undone.

**Not loading?** The window says _… could not be loaded_ with a **Try again** button when
the site cannot be reached — check the building's internet first. A site that refuses to
sign you in inside the window can be opened in your browser with **↗** and used there.

_Verify: CB-68._

---

### W-46 — Learn the page with Tips of the Day

**Goal:** learn each operator page at your own pace and see the exact
control without having to search the manual.

1. Five minutes after the window starts, the operator page in
   front shows one **[en:tran:Tip of the Day]** in the top-right corner — never at launch,
   when it would cover the controls you reach for while opening the service.
   Reloading or switching between Presenter and Reader does not restart those
   five minutes. The card then takes itself off after one minute: a thin bar
   along its bottom edge drains over that minute, and resting the mouse
   pointer on the card freezes the bar and the minute with it, so nothing
   disappears while you are reading it. Moving away carries on from where the
   bar stopped. **[en:tran:Next tip]** starts the minute again, browsing **[en:tran:All tips]**
   holds it, and **×** closes the card at once. The tip
   belongs to that page only, and the first tip is chosen at random without
   repeating the last automatic tip shown for that page. **Help → [en:tran:Tips of the Day]**
   opens one at once, and a tip opened that way stands in for that
   page's automatic card. Settings, Slide Editor, Bible Note, Web Editor, Lyric
   Editor, and Local Web Share also have their own tips. Each page remembers
   whether its automatic tip has already appeared; visiting another page lets
   you learn that page too. Audience screens and help-only windows show no tips.
2. Click **[en:tran:Next tip]** to move through that page's tips in order. The list wraps to
   the first tip after the last. Click **[en:tran:All tips]** to open the numbered learning
   list for the current page. Search by a control or task, or scan the topic name
   that leads each lesson's line;
   the counter shows how many lessons match. Each lesson says what it teaches;
   choose one to return to its card and practise it at your own pace: press
   **[en:tran:Show it]** on the card to start it — the control is ringed in red — and then
   **Do it** for each safe step. The
   Presenter has **91 topics**: 81 start with a safe **Do it** for a visible
   control or shortcut, while ten disruptive or native-menu lessons stay self-guided. They
   cover documents and slides, audience screens, backgrounds and media, service
   planning, app help, and every native application menu from **File** through
   **Help**. _Write a note on a document or slide_ opens the previewer's **[en:tran:Note]**
   panel, which ships closed (W-03, W-31). Presenter lessons also cover lookup references and history, study
   tools inside Bible Lookup, media folder filtering and sorting, finding a service
   flow, and **[en:tran:Messages]** for separate notices, rotation and spacing
   (_[en:tran:Prepare several audience messages]_, _[en:tran:Rotate notices before the service]_ and _[en:tran:Give audience messages room to breathe]_) — search
   **[en:tran:Messages]** in **[en:tran:All tips]** to find them.
   Foreground lessons explain **[en:tran:Effects]** and preparing an Image Show
   slide show; output and style changes stay in your hands.
   The Reader has **100 topics**: 50 start with a safe **Do it** and
   50 stateful, file-dependent, native-menu, pane-visibility or audience-output lessons stay
   self-guided. They cover reference entry and
   history, reading panes and formatting, Find and cross references,
   people/places and connection graphs, Resources, verse marks and notes,
   presenting a verse, the Reader header, every native application menu, and
   detailed lessons for every command under **View**. The **×** closes the card
   for now; reloading a page does not show its automatic card again in the same
   window session. A page whose delay expires while it is behind another window
   waits until you focus it.
3. In Settings, **Help → [en:tran:All tips]** shows three lessons for **[en:tran:General]**,
   **[en:tran:Bible]**, and **[en:tran:Others]**. Choose **[en:tran:Explore General settings]**, then **[en:tran:Show it]**:
   the demo card and its red outline appear inside Settings.
   **[en:tran:Show it]** always starts in the originating window, even when a popup and
   the main window show the same kind of page. With an actionable lesson, the control
   is ringed in red. This uses a checked-in walkthrough and no model or provider
   credit. The deterministic walkthroughs open, copy, toggle, or
   adjust safe app controls. Press **Do it** once per actionable step; when the
   safe setup is complete, an explanation-only follow-up uses **Next**, never a
   disabled or failing **Do it**. If the renderer refreshed before the local
   walkthrough service, Show it sends the current lesson inline and still opens
   the card. Steps that would present, control an audience screen, export, or use
   a disruptive native-menu action remain self-guided numbered cards.
   In the Reader, search for **[en:tran:Copy Text]**, **[en:tran:New File]**,
   **[en:tran:Search file name]**, or **[en:tran:Find Connection]** to find a
   focused lesson. Each tip explains when to use that control. Saved Bibles
   lists and Bible Notes have separate folder, creation, organization and
   import/export tips — open **Help → [en:tran:All tips]** in the Reader and search
   **[en:tran:New File]** to find them. Graph and Resources tools have their own lessons
   too: the graph's, its presets among them, are found by searching the word **graph**.
   The **[en:tran:Resources]** lessons are found by searching **[en:tran:Search file name]**.
   Use **Back** to revisit a guide step. If a panel is hidden, reopen it through
   **View → [en:tran:Widgets]** before practising. An older walkthrough service can
   show the complete Reader lesson as a self-guided fallback.
   Reader lessons that depend on selected text, files, a graph, or the native
   menu are self-guided too. They explain the exact action but do not reload,
   relaunch, export, reset the layout, open Developer Tools, or change what the
   congregation sees. If **AI features** is off, the app
   offers to open Settings → Others because the local walkthrough server is
   switched off with it.
4. Click **[en:tran:Hide for 30 days]** to put automatic tips away on all operator
   pages for 30 days; after that they come back by themselves. This does not
   remove the lessons: use **Help → [en:tran:Tips of the Day]** to
   open one suggestion, or **Help → [en:tran:All tips]** to browse the whole learning list
   for the page in front. Opening either from Help does not end the 30 days.
   To bring the automatic card back sooner, open **Settings → [en:tran:General] → [en:tran:Other General Options]**, turn on **[en:tran:Show Tips of the Day automatically]**, and
   start the app again; that switch reads off while the tips are hidden. Turned
   off there instead, automatic tips stay off until the switch is turned on
   again. The switch covers every supported operator page.

The **File**, **Edit**, **Tools**, **Window**, and **Help** overviews name every
row users can encounter, including conditional and macOS-only rows, so searching
for a command finds the menu that owns it. They are self-guided because Electron
draws the operating-system menu outside the page and a walkthrough cannot safely
ring or press it. The detailed **View** lessons remain separate so each View
command can explain its effect and risk.

For support information, open **Help → Copy Debug Info** or
**Help → Copy Full Debug Info**. Both commands are in **Help**; the full
version also includes the complete build metadata.

The Presenter and Reader catalogs deliberately keep **Reload**, **Force Reload**,
**Relaunch** and **Toggle Developer Tools** under the **[en:tran:View menu]** topic for
completeness, but do not put those troubleshooting commands into the random
daily rotation.
**Actual Size / Zoom In / Zoom Out** are taught as whole-window zoom, separately
from the passage's **[en:tran:Font Size]**. **Toggle Full Screen** is taught as whole-window
full screen, separately from the passage's **[en:tran:Full]** button. **[en:tran:Widgets]** explains
the checked pane list; **[en:tran:Reset Widgets Size]** explains its confirmation and that
it both restores default sizes and reopens collapsed panes.

_Verify: GL-25._

---

### W-54 — Move your data folder off the Desktop (OneDrive)

**Goal:** keep your songs, slides, Bibles and settings where a backup program cannot
take them away.

The app used to make its data folder on the Desktop, `Desktop\open-worship-data`. On
Windows, Microsoft OneDrive often backs up the Desktop, and while it syncs it can
replace files with online-only copies or take them off the computer — songs, slides
and settings went missing. A new data folder now goes to `.owa\open-worship-data` in
your user folder (`~/.owa/open-worship-data` on a Mac or Linux), which nothing syncs.

1. Start the app. While your data folder is still `Desktop\open-worship-data`, every
   start asks **[en:tran:Move Your Data Folder Off the Desktop]**. It names your folder,
   says why it is at risk on this computer — OneDrive on Windows, iCloud Drive on a
   Mac — and where it will go. 📸
2. Press **[en:tran:Move Now]**. The app closes and opens again, and moves the folder
   before it opens anything in it. Outside OneDrive the folder is simply moved. Inside
   OneDrive, or when a file in it is in use, every file is copied and checked, and the
   old folder stays where it was.
3. **[en:tran:Data Folder Moved]** says where your data is now — and, after a copy,
   where the old copy is. Press **[en:tran:Ok]**. Pictures, videos and songs still
   show: links that named the old place follow the folder. 📸
4. After a copy, every start shows **[en:tran:Old Copy of Your Data Folder]** with the
   day it was moved. Check that your songs and slides are all there, then press
   **[en:tran:Show Folder]** and move the old folder to the Recycle Bin (Trash)
   yourself — the app never deletes it. Once it is gone, the reminder stops. 📸
5. Not now? **[en:tran:Not Now]** asks again at the next start.
   **[en:tran:Hide for 30 days]** keeps the question away for 30 days.

> Notes: `migration-moved-from.txt` in the new folder says where it came from and
> when; `migration-moved-to.txt` in an old copy says where it went. A move that fails
> changes nothing: **[en:tran:Data Folder Not Moved]** says why, the app keeps using
> the folder where it is, and it asks again at the next start. On a Mac, a file that is
> only in iCloud Drive stops the move until it is downloaded (Finder → **Download
> Now**). The new folder's name starts with a dot, so Finder and Linux file managers
> hide it; the folder picker in Settings shows it.

Steps 1–5 were observed live 2026-10-17 on a scratch dev profile with a throwaway
Desktop folder, in English and Khmer: the question with each of its three answers,
the move as the app started again (renamed; then copied, with a file held open), the
result, the reminder with its date in Khmer digits, and the reminder gone once the old
copy was. **[en:tran:Show Folder]** was not pressed — it opens the computer's file
window — and is unit-tested. Not seen live: OneDrive itself (the copy was forced by a
file held open) and a Mac.

_Verify: ST-20, ST-80, ST-81._

## Keyboard shortcut reference (tutorial appendix)

Every page lists its own keys, searchable, under **Help → [en:tran:Keyboard Shortcuts]** (W-49). This table is the short version.

| Keys                                 | Does                                                                    | Where                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `Ctrl+B`                             | Open Bible Lookup                                                       | Presenter / Editor                                                    |
| `Ctrl+Q`                             | Close the Bible Lookup popup                                            | Presenter / Editor, Bible Lookup open                                 |
| `F5`                                 | Show / hide the selected screens (all, when none is selected)           | Presenter                                                             |
| `F6` / `F7` / `F8` / `F9` / `F10`    | Clear All / Background / Slide / Bible / Foreground                     | Presenter                                                             |
| `Ctrl/Alt+ArrowLeft/Right`           | Previous / next Bible verse                                             | the output screen                                                     |
| Arrows, `PageUp`/`PageDown`, `Space` | Next / previous slide (`Shift+Space` goes back)                         | slide thumbnails focused                                              |
| Arrows, `PageUp`/`PageDown`, `Space` | Next / previous part, stopping at either end (`Shift+Space` goes back)  | Long Text Show, its lit part focused                                  |
| `Tab` / `Escape` / `Shift+Escape`    | Complete the reference / remove its last part / clear it                | lookup & reader                                                       |
| `Ctrl+Enter`                         | Focus the editing canvas                                                | Slide Editor                                                          |
| `Ctrl+S`                             | Save                                                                    | Slide Editor, Bible Note, Lyric Editor (Web Editor saves itself)      |
| `Enter` / `Escape`                   | Confirm / cancel                                                        | confirmation dialogs                                                  |
| `Ctrl+Shift+P`                       | Start or stop Presenting Control (draw & spotlight on the app)          | every window                                                          |
| `V` / `B` / `E` / `F`                | Arrow / brush / eraser / spotlight                                      | Presenting Control open (not while typing)                            |
| `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` | Undo / redo the drawing                                                 | Presenting Control **armed** (buttons work in any tool)               |
| `C`                                  | Clear the drawing (one Undo brings it back)                             | Presenting Control **armed** (button works in any tool)               |
| `Escape`                             | Back to the arrow tool                                                  | Presenting Control **armed** (the app keeps Escape otherwise)         |
| `K`                                  | Show / hide the Keyboard Screencast                                     | Presenting Control on the **arrow** tool (an armed tool turns it off) |
| _every other key_                    | Nothing — swallowed by the overlay                                      | Presenting Control **armed**                                          |

_Verify: KB-01..13, SC-03._

### W-31 — Hide, show, and reset the app's panels (View menu)

**Goal:** get a panel back after it collapsed, hide one you don't need, or put the
whole layout back the way it shipped.

Every resizable panel in the app is a **widget**. You can already collapse one by
dragging its divider all the way to the edge — it shrinks to a thin green strip with
its name on it, and clicking that strip brings it back. The **View** menu on the top
menu bar does the same thing by name, which is easier when the strip is hard to find.
And the divider itself has a right-click menu that does it in place (steps 7–9) —
the only way in a popup window, whose menu bar is hidden.

1. Open **View** on the top menu bar → **[en:tran:Widgets]**. 📸
   You get one tick-box per panel on the page you are looking at, e.g. on the
   presenter: `App Presenter Left` / `App Presenter Middle` / `App Presenter Right`,
   `Document List`, `Presenting Flow List`, `Presenter`, `Background`,
   `Bible and Notes`, `Mini Screen`, `Bibles`, `Bible Notes`, `Previewer`, `Slides`,
   `Note`.
   In the Reader, the three horizontal sections are **[en:tran:Bible and Notes]**,
   **[en:tran:Bible Lookup]**, and **[en:tran:Advance Lookup]**. The top-right
   **[en:tran:Advance Bible Lookup]** binoculars toggle that same Advance Lookup section.
   - **Ticked** = the panel is open. **Unticked** = it is collapsed to its strip.
   - `Note` — the document and slide notes under the slide previews (W-03) — is the
     one panel that **starts unticked**: it ships collapsed to its green strip,
     because most services never need it. Tick it, or click the strip, to open it.
2. Click a ticked one — that panel collapses to its green strip, and the space goes to
   its neighbour. 📸
3. Click it again — the panel comes straight back. Nothing reloads and nothing you
   were doing is interrupted.
4. Panels that the app does not let you collapse (the Background media/audio split,
   the bible previewer, the lyric Stage Previewer) are simply not listed.

**Put everything back:**

5. Open **View** on the top menu bar again and click
   **[en:tran:Reset Widgets Size]**. Do not open **Widgets** for this one:
   **[en:tran:Reset Widgets Size]** is a row of the **View** menu itself, the row
   right under **Widgets**. Answer **[en:tran:Yes]** to
   `Are you sure to reset every widget size and reopen the widgets?` 📸
6. Every panel returns to the width and height it had when the app was installed, and
   **any panel you had collapsed is reopened**. This happens immediately — no reload.
   Answer **[en:tran:No]** and nothing changes.

**Or use the divider between two panels** — no menu bar needed, so this also works
in a popup window:

7. Right-click the **divider between Document List and Presenting Flow List** — the
   thin line between the two panels on the left of the presenter (every divider in the
   app has this menu) — and choose **[en:tran:Close First Widget]**. 📸 The first of
   the two panels (the left one, or the upper one) collapses to its green strip and the
   other takes its space. `Close Second Widget` does the same to the other panel. The
   menu holds those two and **[en:tran:Reset Size]** (step 9), nothing else.
   Hovering the divider shows the same two choices as small arrows, each named for
   the side it closes — **[en:tran:Collapse left panel]** / **[en:tran:Collapse right panel]**,
   or **[en:tran:Collapse top panel]** / **[en:tran:Collapse bottom panel]** on a
   divider between an upper and a lower panel. A collapsed panel has no divider — if
   one of the two is already a strip, click the strip first.
8. Click the green **[en:tran:Document List]** strip — the panel comes straight back.
9. Right-click the **divider between Document List and Presenting Flow List** again and
   choose **[en:tran:Reset Size]** — just those two panels return to the sizes they
   shipped with. Double-clicking the divider does the same. The View menu's
   `Reset Widgets Size` (step 5) is the version for every panel at once.

**With the keyboard:** press **Tab** until a divider shows a blue outline. The **Menu**
key (or **Shift+F10**) opens the same menu as the right-click, and the arrow keys move
the divider — **←/→** for one between side-by-side panels, **↑/↓** for one between an
upper and a lower panel, **Shift** for bigger steps. The arrows never collapse a panel;
the menu does that.

> This used to be a button in Settings → General, where it did nothing until you also
> clicked **Apply Settings** and the app reloaded. It is on the View menu now and takes
> effect at once.

_Verify: NAV-20, NAV-21, ST-22, GL-17, GL-18._

### W-32 — See who published a Bible translation (and its copyright)

**Goal:** find out which edition of the Bible you are reading — its publisher,
version, language and copyright notice — without leaving the reader.

You do not need Settings for this. The information is one click away, but only while
you are still choosing what to read: once a verse is on screen the header gives that
space to the verse buttons instead.

1. Open **[en:tran:Bible Reader]** (see W-11) and make sure the lookup box at the top is
   **empty**, so the pane shows the grid of book names (**លោកុប្បត្តិ (Genesis)**,
   **និក្ខមនំ (Exodus)**, …). 📸
2. Look at the **top-right corner of that pane**, on the same line as the small
   version badge (e.g. `ពគប`). There is a round **ⓘ** button — hover it and the tip
   reads **[en:tran:Bible Information]**.
3. Click **ⓘ**. A card opens in the middle of the window. 📸 It lists:
   - **[en:tran:title]** — the edition's full name, e.g.
     `Khmer BFBS (ព្រះគម្ពីរបរិសុទ្ធ ១៩៥៤)`
   - **[en:tran:Key]** — the short code shown on the badge, e.g. `ពគប`
   - **[en:tran:Version]**, **[en:tran:Locale]** — e.g. `Khmer (ភាសាខ្មែរ) (km-KH)`
   - **[en:tran:Publisher]**, **[en:tran:Copy Rights]**,
     **[en:tran:Legal Note]** — e.g.
     `© BFBS/UBS 1954, 1962. All Rights Reserved.`
   - **[en:tran:Description]**, **[en:tran:Books]** — how many books this edition
     contains, e.g. `66`
   - Anything the edition does not record is simply left out of the list.
4. If any of those lines mentions a **web address** — publishers often put their site
   in the copyright or legal note — it is shown as a link. Click it and the page opens
   in your normal web browser; the app itself stays where it is. 📸
5. You can select and copy any of it — handy when a copyright line has to go on a
   printed order of service.
6. Close it with the **✕** in its corner, or press **Escape**. You come straight back
   to the book grid exactly as you left it.
7. Left of the **ⓘ** sit the two split buttons, **[en:tran:Split horizontal]** and
   **[en:tran:Split vertical]** (also **Ctrl+Shift+S** / **Ctrl+Shift+V**, and in the
   **⋮** or right-click menu). A view always holds a passage, so the new one opens the
   book you picked at chapter 1 — or Genesis 1 if no book is picked yet — while the
   view you are typing in keeps its grid. 📸
   Moving the editing to another view (its pencil, **Ctrl+Shift+arrow**, or
   **[en:tran:Edit]** in its menu) does the same to the view you leave: it stays
   open on the book you picked at chapter 1, or on Genesis 1. 📸
8. Pick a book, then a chapter. As soon as the verses appear, the **ⓘ** is gone and the
   verse buttons (copy, split, save, present…) take its place. Clear the box again and
   it returns.

> Want to change any of this rather than just read it? That is still
> **Settings → [en:tran:Bible]**, the pencil next to the translation, then the **[en:tran:Info]** tab.

_Verify: RD-77, RD-78, RD-11, RD-26, LT-01, KB-25, KB-26, CM-79._

---

### W-33 — Share your Bible translations (XML) with another machine

Sharing a **bible list** moves only the verses you lined up. This shares the **translations
themselves**: the XML bibles you added or edited under **Settings → [en:tran:Bible]**, which
until now could only be moved by digging the files out by hand.

1. Open **[en:tran:Bible]**. Under the **[en:tran:Import XML File]** box on the left there is a card headed **[en:tran:Bible Data]**. 📸
2. Click **[en:tran:Export Bible Data]**. A panel opens listing every
   translation you have, one row each, showing its short **key** (`KJV`, `GKHB`, `ពគប`…)
   and its full title. Everything starts ticked. Untick the ones you do not want, or use
   **[en:tran:Deselect All]** and pick just a few. 📸
3. Below the list, the same **[en:tran:Password]** / **[en:tran:Confirm Password]** pair as every other export: leave both empty for the ordinary
   bundle, or type the same password in both to lock it. Type them differently and the
   app tells you **[en:tran:Passwords do not match]** in the panel itself and brings it straight
   back — still holding the bibles you ticked and the password you typed — so a mistyped
   password can never quietly produce an unprotected file, and you never have to pick your
   translations a second time.
4. Click **[en:tran:Ok]**. You get one `Bible Data.owabdata.tar.gz` in your **Downloads** folder
   (or `Bible Data.owabdata.enc` if you set a password), and the folder opens on it.
   Bibles are big files — a couple of translations can run to tens of MB.
5. On the other machine, open **Settings → [en:tran:Bible]** and **drag the file anywhere onto
   that page** — the whole Bible settings area accepts it, not just the small card. Or
   click **[en:tran:Import Bible Data]** and pick it. A protected
   bundle asks for its password first, and says **[en:tran:Wrong password, try again]** rather
   than failing outright. 📸
6. A panel lists what is inside. Anything that can come in is ticked. Anything that
   **cannot** is shown as a **red row** you are not allowed to tick, with the reason on
   the right:
   - **[en:tran:Bible key already exists]** — you already have a
     translation with that key. Upper and lower case count as the same key, so a `kjv`
     in the bundle is refused against a `KJV` you already have.
   - **[en:tran:Duplicate bible key in this archive]**
     — two entries in the same bundle claim the same key; the first one is offered.
   - **[en:tran:Unable to read this bible file]** — the app
     could not read a bible key out of that file, so it cannot check it and will not
     touch it. 📸
7. Click **[en:tran:Ok]**. The ticked translations are added and the list on the right refreshes
   to show them. A message tells you how many came in and how many were skipped.

> Notes: an import **never replaces** a translation you already have, and never leaves
> you with two copies of one. That is the whole point of the red rows — where documents
> and backgrounds add a second copy as `a (1).mp4`, a bible is identified by its key,
> and two bibles with the same key would be ambiguous everywhere else in the app. If you
> genuinely want the incoming version, delete yours first (the 🗑 next to it) and import
> again.
>
> Only the **XML** translations are in the bundle — the ones listed under **[en:tran:Bibles XML]**.
> Bible versions you downloaded inside the app are not: they are hundreds of MB and can
> simply be downloaded again on the other machine.
>
> The check is done against the **file inside the bundle**, not against what the bundle
> claims — so a hand-edited bundle cannot talk the app into overwriting a bible.

_Verify: ST-34..ST-40, LT-01._

---

### W-34 — Add a Bible translation from the internet (XML), and make it read in its own language

Sharing your translations moves the ones you already have to another machine. This workflow
adds a translation from an XML link and lets you review its language and mappings before
saving it.

Example: `https://github.com/Beblia/Holy-Bible-XML-Format/raw/refs/heads/master/KhmerBible.xml`.
The GitHub redirect works as supplied. You can also use **[en:tran:Choose File]** for
an XML file already on your computer.

**The easy way: let the assistant do it**

**Import from the internet with the assistant.** Open **[en:tran:Settings]** → **[en:tran:Bible]** → **[en:tran:Let the assistant import a Bible for me]**, then accept the AI caution with **[en:tran:Open]**. Choose the language and the Bible edition, read where it comes from, and press **[en:tran:I agree]**. Choose an unused short name, confirm the language, choose the numbers when asked, then choose one of the book-name lists. After all four choices, review the summary and press **[en:tran:Install it]**. Choose the installed translation from the Bible version button. You do not need a link or an AI key: this runs on buttons.

1. Open **[en:tran:Settings]** (the gear at the top of the window) → **[en:tran:Bible]** and press the blue
   **[en:tran:Let the assistant import a Bible for me]** at the top of
   **[en:tran:Import XML File]**. (Or open the assistant 🤖 and type
   `Import bible for khmer`, `Import bible`, or `Import bible from` and a link. Say it
   your own way: `I want a Khmer bible`, `Do you have a Korean bible?` and a country —
   `Import a Bible in Cambodia` — are understood too. And when you ask **how** to
   import a Bible, the answer has an **Import a Bible for me** button that starts
   here.) Answer the _Be careful with AI_ question with **[en:tran:Open]**. 📸
2. The assistant opens in a new tab and asks **Which language do you want the Bible
   in?** Press **Khmer**, **English** or **French**, or type the language — in English
   or in its own words (`Thai`, `ខ្មែរ`, `Español`) — or paste a link to a Bible file.
   **A file on this computer** opens the form below instead. A word it cannot find
   (`kmer`) is answered with **Did you mean** and the nearest languages to press.
3. It lists **every** Bible in that language from a free collection of about a
   thousand (Beblia, on GitHub), each with the title its own file gives — for Khmer,
   seven, from _Khmer Standard Version 1954 = Hammond Version_ to _Khmer BFBS (ព្រះគម្ពីរបរិសុទ្ធ ១៩៥៤)_. One you have installed is marked **you already have this
   one**, with its short name. Press the one you want, or type its number. 📸
4. It downloads and reads it, then says what it is — for example _66 books, 1,189
   chapters, 31,102 verses_, or _It has the New Testament only_ — and, when it is one
   you have, **You already have this Bible** with the name it is installed under
   (press **Cancel**, or go on to keep a second copy under another name). Nothing is
   installed yet.
   Before it asks you anything, it says **where the Bible is from** and asks you to
   agree: it was found on the internet — in the free collection on GitHub, with that
   collection's address and the file's own — it is **not from Open Worship**, and you
   are **responsible to its publisher**: a Bible translation belongs to the publisher
   or Bible society that made it, and many are under copyright, so make sure the
   publisher allows how you will use it. Both addresses are links: press one to open
   it in your web browser, as **Open the website** does for the collection (or the
   page the file was listed on). Press **I agree** to go on, or **Cancel** and
   nothing is installed. 📸
5. **Step 1 — a short name**: press a suggestion (**KSV**, **KM1954** …) or type your
   own, letters and numbers with no spaces. A name you already have is refused and
   asked again.
6. **Step 2 — the language**: it says which it looks like and why (_the verses are
   written in Khmer script_). Press it, or type another, such as `ខ្មែរ`.
   Your choice controls the imported Bible's book names and numbers, even when
   the file was detected as another language. You can change it again while
   choosing numbers or book names; the choices reload for that language.
7. **Step 3 — numbers**: **០ ១ ២ ៣ …** or **0 1 2 3 …** (skipped for a language that
   writes 0–9).
8. **Step 4 — book names**: each list shows its first names, the names only it has,
   and how many of its names appear in this Bible's own verses; the suggested one
   uses the most. **Find more lists online** adds lists from Bible.com and
   Wordproject. You can also paste a Bible website link here, including a chapter
   link. The assistant reads that edition's book-name list in your selected
   language and shows a source link. If it cannot find a complete matching list,
   your previous choices remain. 📸
9. **Ready to install** sums it up. Press **Install it**. _Done — KSV is installed_:
   choose it from the Bible version button. **Undo** under that answer moves it to
   the trash again. **Cancel** at any step stops with nothing installed.

You can type instead of pressing at every step: `yes` (or `ok`) takes the suggested
choice — under the notice of where it is from, **I agree**; at the end, **Install it**
— a number takes that line of a list (`2`,
`list 2`), the words on a button press it, and `cancel` stops.

Pasting a link works the same way, and the link does not have to be the file: a
GitHub **page** of the file is turned into its download address, and a GitHub
**repository** lists its Bible files — type a word (`Khmer`, then `2019`) to narrow
the list. Under the language question, and under an answer that says a link did not
lead to a Bible, the link can be pasted on its own.

**When a window says a Bible is not available**

The Bible Reader or the Bible Lookup opens on _Bible key "KJV" is not available!_ when
it is set to a Bible this computer does not have — on a new computer, the KJV. The card
says how the assistant gets it, in three steps, and carries the button. Keep the short
name the assistant suggests for it, or the card stays:

1. Press **[en:tran:Let the assistant import this Bible for me]** on that card and
   answer the _Be careful with AI_ question with **[en:tran:Open]**. 📸
2. The assistant opens in a new tab already looking for that Bible in the free
   collection: for KJV it lists _English KJV_ and _English NKJ 1982_. Press the one you
   want. A name the collection has no file for is answered with _None of them has … in
   its name_: type the Bible's language (`Khmer`) and press one from that list.
3. It downloads the Bible and says where it is from; press **I agree**. It then says
   _The app is looking for a Bible called **KJV**_. At **Step 1 — a short name** that
   name comes first, **KJV (suggested)**: keep it. Installed under any other name,
   the card stays where it is.
4. Answer the language and the book names as above, then press **Install it**. _Done
   — KJV is installed_, and the card goes away by itself: the passage shows. 📸

Typing `Import the Bible called "KJV"` in the assistant does the same.

**Import a Bible XML file with the form.** Give it the link or choose the file, press
**[en:tran:Import]**, answer the review, and press **[en:tran:Import]** again to install it:

1. Open **[en:tran:Settings]** → **[en:tran:Bible]**. In
   **[en:tran:Import XML File]**, paste the link into **[en:tran:URL:]** — or, for an XML
   file already on this computer, press **[en:tran:Choose File]** and pick it.
2. Press **[en:tran:Import]**. The download is read and its temporary file removed.
   **[en:tran:Review Bible import]** appears with the translation title. Nothing has
   been installed yet. 📸
3. Choose an unused **[en:tran:Bible key]**. Buttons suggest a language code, a code
   with the year, and usable words from the file header; you can type your own key.
   This becomes the badge and file name. Empty, unsafe or already installed keys
   cannot be imported, and the key is checked again when saving.
4. Review **[en:tran:Locale]**. A locale stored in the XML is kept; otherwise the
   filename provides a hint. `KhmerBible.xml` suggests `km-KH`. You can correct it.
5. Choose **[en:tran:Number mapping]**. Khmer offers `០ ១ ២ ៣ ៤ ៥ ៦ ៧ ៨ ៩` first
   and `0 1 2 3 4 5 6 7 8 9` as an alternative.
6. Choose **[en:tran:Book name mapping]**. Built-in Khmer naming sets appear first;
   online lookup adds complete lists from Bible.com and Wordproject. Each option
   shows its edition/source, and **[en:tran:Preview book names]** expands all 66 names.
   **[en:tran:Keep existing book names]** preserves the names already in the XML.
   The recommended option is a suggestion: select the wording your church uses.
   **[en:tran:Find more editions]** checks another batch when available;
   **[en:tran:Search for more book name lists]** opens a wider web search.
   If online sources fail, you can still choose built-in names or keep the existing map.
7. Press **[en:tran:Import]** in the review. The new translation appears in
   **[en:tran:Bibles XML]**. **[en:tran:Cancel]** exits the review without saving. 📸

**Where an imported Bible came from**

Every Bible imported this way — by the assistant or with the form — keeps a note of
where it came from: when it was imported and by whom, the link it was downloaded from
(and the file link really used, when a GitHub page was turned into its file), the
file's name and size, how many books, chapters and verses it has, and the key,
language, numbers and book names chosen for it. In **[en:tran:Bibles XML]** its row
shows **[en:tran:Source]:** and that link — press it to open the page in your
browser — and **[en:tran:Note]** under it opens the whole note. 📸 The note is part of
the Bible's info (`"note"` in the pencil → **[en:tran:Info]** editor), so you can add
to it or clear it there, and a Bible you export (W-33) takes it along. A Bible
imported before this note existed has none.

A Bible already installed whose book names or numbers still read in English needs no
second import, and nothing of the import — its review, the assistant's steps — is
needed again. Later changes remain available through the pencil beside the translation in
**[en:tran:Settings]** → **[en:tran:Bible]** (its name opens nothing) → **[en:tran:Info]** editor.
Right-click inside that editor for its three commands, in this order: first
**🌎 [en:tran:Choose Locale]**, and pick the language; then **#️⃣ [en:tran:Edit Numbers Map]**,
and press **[en:tran:Ok]**; then **📚 [en:tran:Edit Books Map]**, which opens the 66 book
names one to a line — press **[en:tran:Guessing Names]** to fill them from the lists the app
has for that language, or type your own, and press **[en:tran:Ok]**. Those editor actions use
the locale currently in the editor buffer; save after editing.

**[en:tran:Key is already taken]**

If it says the Bible key is already taken, choose a different unused key in the review.
The installed translation is kept. Import does not replace it, even if another window
installed that key while you were choosing mappings. Cancel if you meant to edit the
existing Bible, then use its pencil instead.

> **Removing one.** The 🗑 next to a translation asks _Are you sure to delete bible XML
> "…"?_ — **[en:tran:Yes]** sends the file to the Recycle Bin. Its badge disappears from every bible
> menu. The sibling `…​.xml.cache` folder is removed too, so stale parsed data cannot
> reappear if the same key is imported later.

> **Putting the KJV back.** The **KJV** row — and only that row — carries an extra
> orange ↺ button, **[en:tran:Reset Bible XML]**, to the LEFT of the ✏️ pencil.
> It asks _Reset this bible XML with the app embedded KJV? All your changes will be
> lost._ — **[en:tran:Yes]** throws away the KJV file you have and writes the copy that ships inside
> the app (the same copy the **[en:tran:Create KJV Bible XML]** row below writes),
> then reloads the windows. Use it when your KJV has been edited into a state you no longer
> want, or looks broken; there is no undo, so export it first (W-33) if you want it back.
> If the KJV editor is open with unsaved changes the button refuses and warns
> **[en:tran:Unsaved Bible Data]** — save or discard first.
>
> **Deleted it by mistake?** The KJV is the one translation the app carries inside
> itself, so it can always be rebuilt. Whenever your list has no **KJV**, a green
> **[en:tran:Create KJV Bible XML]** row sits at the TOP
> of the **[en:tran:Bibles XML]** list, above the translations — not only on a brand-new install
> with nothing in the list. Click it and the KJV comes back; the button then disappears
> because there is nothing left to create. Any other translation is not carried inside the
> app. Its file went to the Recycle Bin when it was deleted, and the way back is to import
> it again the way it came in — **[en:tran:Let the assistant import a Bible for me]**, or
> **[en:tran:Import XML File]** with its link or file.

_Verify: ST-41..ST-50, ST-24..ST-26, ST-29, ST-31, ST-32, ST-51, ST-60, ST-79, RD-11, RD-123, CB-80..CB-82, CB-107..CB-109, CB-145, LT-01._

### W-35 — Bring a song in from CCLI SongSelect

If your church has CCLI **SongSelect Partner API** access, the app can search SongSelect
and turn a song straight into a lyric document — no retyping. You need the API
credentials CCLI issued to you (a **Client ID**, a **Subscription Key**, and the
**Redirect URI** you registered; some clients also have a **Client Secret**).

> CCLI has retired new partner signups, so this only works with credentials you already
> hold. Everything below was driven live against a stand-in SongSelect server; the final
> sign-in hand-off to CCLI's real consent page is source-verified but **not observed**
> end-to-end, for want of real credentials.

1. Open **[en:tran:Settings]** → **[en:tran:Others]**. Between the AI-key card and **[en:tran:Extra Binaries]**
   there is a card headed **[en:tran:SongSelect Integration]**, with a
   **SongSelect ↗** button that opens songselect.ccli.com in your browser. A card
   showing only its heading is folded — click the heading to open it. 📸
2. Fill **Client ID**, **Subscription Key** and **Redirect URI** (and **Client Secret**
   if you have one). Each field saves the moment you click away from it and gains a
   green ✓. Until all three are filled, **[en:tran:Sign In]** stays grey — hovering it
   tells you what is missing.
3. Click **[en:tran:Sign In]**. A CCLI window opens for you to log in and approve. If you close
   it instead, the app says **Sign in failed — Sign in was canceled** ([en:tran:Sign in was canceled]) and nothing changes. Once signed in, the card shows a
   green **[en:tran:Signed in]** with a **[en:tran:Sign Out]** button, and the
   app keeps the session refreshed by itself.
4. Back in the presenter, open the **[en:tran:Documents]** list's **⋮ [en:tran:More Options]**. A new entry,
   **[en:tran:Import From SongSelect]**, now sits under
   **[en:tran:Import From Public Domain Songs]** — it is only there while you are signed in. 📸
5. Click it. A floating **[en:tran:Import From SongSelect]** panel opens (drag it anywhere; the
   app remembers where you put it). Type in **[en:tran:Search songs]** — results
   appear as you pause, with the writers, the CCLI song number, a line of the lyrics,
   and a **[en:tran:Public Domain]** badge where it applies. Page through
   long result lists with the ‹ › arrows at the bottom. A song your account is not
   licensed to take has its download button greyed out. 📸
6. Click a song's ☁⬇ download button. A moment later the app confirms **Lyric document
   created successfully** ([en:tran:Lyric document created successfully]) and the song appears
   in your **[en:tran:Documents]** list as a lyric (♪), named after its title. The panel stays
   open, so you can keep downloading; pulling the same song twice keeps both —
   the second becomes `<Title> (1)`. 📸
7. Click the new row: it previews slide by slide — an **Info** slide with the title,
   writers and the `CCLI Song #` copyright line, then one slide per part (**Verse 1**,
   **Chorus**, …). Present it like any other lyric (W-04), or polish the wording in the
   lyric editor first. 📸

> **If SongSelect will not connect, check these.** A grey **[en:tran:Sign In]** means one
> of the three boxes — Client ID, Subscription Key, Redirect URI — is still empty: hover
> it and it says which. A search or download that fails says why, right in the panel or
> as a toast: too many requests in a row asks you to wait a moment; a lapsed session says
> **[en:tran:SongSelect sign-in expired, please sign in again in Settings]**, so sign in
> again; no internet says **[en:tran:Could not reach SongSelect]**.

_Verify: ST-57, ST-71, PL-103, PL-104._

### W-36 — Import a public domain song (no account needed)

The app ships with a small hymnal of classic English public-domain songs — Amazing Grace,
It Is Well with My Soul, Holy Holy Holy, and some three dozen more. They import as lyric
documents with **no sign-in, no credentials and no internet**, so this works on a fresh
install anywhere.

1. In the presenter, open the **[en:tran:Documents]** list's **⋮ [en:tran:More Options]** →
   **[en:tran:Import From Public Domain Songs]**. Unlike the SongSelect entry (W-35) it is
   _always_ there. 📸
2. A floating panel opens listing the whole catalog straight away — each row shows the
   title, the writers, the year, and the first line, with a count at the top right of the
   search box (36 at the time of writing). Scroll to browse, or type in **[en:tran:Search songs]** to filter instantly by title or writer — the count follows. 📸
3. Click a song's ☁⬇ download button. The app confirms **Lyric document created
   successfully** ([en:tran:Lyric document created successfully]) and the song appears in your
   **[en:tran:Documents]** list as a lyric (♪) named after its title. The panel stays open so you
   can keep importing.
4. Click the new row: it previews an **Info** slide (title, writer, `Public Domain` with
   the year) and then the song in **real singing order** — a hymn with a refrain repeats
   its **Chorus** slide after every verse (Blessed Assurance previews Verse 1, Chorus,
   Verse 2, Chorus, Verse 3, Chorus). Present it like any other lyric (W-04), or adjust
   the words in the lyric editor first — they are ordinary editable lyric documents. 📸
5. Scroll to the **end** of that preview: after the last verse sits one more slide named
   **Hymnary.org** — the page the song's words were taken from, kept with the document as
   an attachment so you can always check the wording against the source. It behaves like
   any other slide (you can present it, or simply leave it at the end). 📸

_Verify: PL-105._

### W-37 — Keep your own files beside the verse (Resources)

If you already keep study material on disk named after the chapter it belongs to —
`PSA.1.pdf`, `GEN.49.pptx` — **[en:tran:Resources]** puts those files
right beside whatever you are reading, from as many folders as you like — and it
follows **every passage you have open**, not one verse you clicked: three panes on
Genesis 24, 27 and 29 list the files of all three.

The name has to follow one pattern: **`<book key>.<chapter>.<anything>`**. The book key is
the three-character one the app uses (Psalm is `PSA`, Genesis `GEN`, 1 Chronicles `1CH`), so
anywhere in Psalm 1 looks for `PSA.1.*` — `PSA.1.pdf`, `PSA.1.outline.docx`. Any file type
at all. It is the **chapter** that decides, not the verse, so every verse of a chapter shows
you the same files.

**Files for the whole book** get chapter number **0**: `PSA.0.pdf` is your introduction to
the Psalms, and it is listed for _every_ chapter of the Psalms, above that chapter's own
files. If you have more than one such document, keep going downwards — `-1`, `-2` and so on
all count as book-level too.

1. In the bible lookup, click **[en:tran:Advance Bible Lookup]** (the binoculars, top right) to open
   the side panel, then pick **[en:tran:Resources]** from the panel's dropdown — the fourth entry
   after **[en:tran:Find]**, **[en:tran:Cross Reference]** and **[en:tran:Location-Name (KJV)]**. 📸
2. The top line of the view is the file-name patterns being looked for, one for **each
   passage you have open**, in the order of your panes, so you can always see what it is
   matching — reading Genesis 24 beside Genesis 27, a solid `GEN.24.*` and a solid
   `GEN.27.*` for the chapters' own files, then one dashed `GEN.0.*` for the book's.
   Above each group of files, the heading also spells out the book and chapter:
   `JHN.3.*, John chapter 3` or `JHN.0.*, John Introduction`. These full names
   follow the interface language and are visible without hovering.
   Two panes on the same chapter in two versions count once. The pane you are typing a
   reference into follows what its box says, as soon as the reference is complete;
   moving to another verse of the same chapter changes nothing here — it is the chapter
   that decides. 📸
3. The first time, the body holds a single **[en:tran:Add Folder]** button. Click it and
   pick the folder your files are in. You can add as many as you want — the
   **⋮ [en:tran:More Options]** button, or a right-click anywhere in the view including the empty space below
   the folders, offers **[en:tran:Add Folder]** again. Adding the same folder twice does nothing. 📸
   **Folders already in your data folder are one press away.** Everything
   **[en:tran:Copy to Data Directory]** (step 8) makes lands in a `resources` folder inside
   your data folder, and so does what **[en:tran:Import Data]** (W-25) brings back. Any
   folder in there that is not on the list yet is listed at the bottom of the view under
   **[en:tran:In the data directory]** — the first time, right under the **[en:tran:Add Folder]**
   button. Click one and it becomes a group straight away, with its matching files already
   listed and no folder picker; it leaves that list as it joins the shelf, and
   **[en:tran:Remove Folder]** puts it back. A folder you make in there while the view is
   open appears after **[en:tran:Reload]**. Nothing is offered that the view already shows —
   including every folder in there when the whole `resources` folder is itself on the list —
   and the heading is not drawn at all when there is nothing to offer. 📸
   **Or drag the folder straight in.** Take it from your file manager — Explorer, Finder —
   and drop it anywhere on the Resources view: while you hold it there the view outlines
   itself and its top line reads **[en:tran:Drop folders here]** in place of the patterns,
   and letting go shelves the folder exactly as the button does, with its matching files
   already listed under it. Several folders at once is one drop. 📸
   Nothing is copied or moved — the folder stays where it is, and Resources only
   remembers where to look. Drop a **file** by mistake and nothing is added: it says
   **[en:tran:Drop a folder, not a file]**, because the folder a stray file sits in is as
   often your whole Downloads as it is a library, and pointing Resources at that would
   set it walking everything you own. A folder that is already on the list says
   **[en:tran:Folder is already added]** rather than changing nothing in silence.
   That same menu has **[en:tran:Reload]**, which re-reads everything at once: your
   folder list, and the files inside every folder. Use it after adding files on disk while
   the app is open, or after changing the list from another window. 📸
4. Each folder becomes its own group, named after the folder, with the folder it lives in
   shown beside the name and the full path if you hover it. Under the name, hanging off a
   single vertical line, are the matching files — **from that folder and the folders
   inside it, two levels down** (`Library/Genesis/Sermons/GEN.24.pdf` is found, a file one
   folder deeper than that is not) — filed under the pattern each one answered to (`GEN.24.*`, then
   `GEN.27.*`, then the dashed `GEN.0.*`), sorted by file type within each, each with its
   own icon (PDF, Word, PowerPoint, video, image, bible note). The extension is set quieter
   than the rest of the name so the reference reads first. Hover a file to see where it
   actually lives. 📸
   A book-level file is listed **once**, under its dashed pattern, however many chapters
   of that book you have open, and carries a dashed **[en:tran:Introduction]** tag so a
   `PSA.0.pdf` says why it is there. A group with nothing for what you are reading says
   **[en:tran:No matching files]**.
5. Sometimes you want a file that is _not_ named after this verse. Click the **magnifier**
   at the right-hand end of the pattern line and a search box opens under it.
   Type any part of a file's name — `abc`, `baptism`, `PSA.11` — and every file in your
   folders whose name contains it is listed too, added below that folder's verse files under
   a `*abc*` heading so you can tell the two apart. Your verse files stay exactly where they
   were. 📸
   Upper and lower case do not matter, and it looks anywhere in the name, not just at the
   start — searching `abc` finds `abc.pdf` and `01-abc-notes.docx` alike. If you are used to
   writing `abc*`, that works too; the `*` is simply ignored.
   Click the magnifier again to close the box and put the lists back as they were. If a
   folder has hundreds of matches only the first 200 are shown, and the box says
   **[en:tran:Too many matching files]** — type a bit more to narrow it down.
   **To see everything else without typing, tick [en:tran:Others]**, the box just left of the
   magnifier. Each folder then also lists every file whose name is _not_ a book and a
   chapter — `family-tree.jpeg`, `church-map.pdf`, `README.txt` — under an
   **[en:tran:Others]** heading after its verse files and anything you searched for. 📸
   A file only counts as a book-and-chapter file when it starts with a real book key and a
   plainly written chapter, so `GEN.5.pdf` stays out of this list while `IMG.2.jpg` and a
   misnumbered `GEN.01.pdf` show up in it — handy for spotting a file you named wrongly. A
   file your search found is listed under the search heading instead, never twice. Up to 200
   are shown per folder; past that the group says **[en:tran:Too many other files]**, and pointing
   Resources at the folder your material is actually in keeps the list short. Untick
   **[en:tran:Others]** to hide them again — the box stays the way you left it next time.
6. Click a file to open it in whatever application your computer normally uses for it — a
   PowerPoint in PowerPoint, a picture in your picture viewer. Right-click one for **[en:tran:Open]**,
   **[en:tran:Copy Path to Clipboard]**, or **[en:tran:Reveal in Finder]** / **[en:tran:Reveal in File Explorer]**.
   Three kinds of file open **inside the app** instead:
   - **A PDF** (`.pdf`) opens in the app's own PDF viewer window — the same one
     **[en:tran:Preview PDF]** opens from a PDF in the Documents list — with its pages down
     the side, zoom and print. Right-click the row for **[en:tran:Preview PDF]**, or **[en:tran:Open]**
     to use your own PDF reader instead. Pressing a PDF whose preview is already open brings
     that window forward. 📸
   - **A markdown file** (`.md`, `.markdown`, drawn with the markdown icon) opens in its
     own **Markdown Preview** window, like a Bible Note does: headings, lists, tables, quotes,
     code, pictures kept beside the file, and **Mermaid diagrams** written in a ` ```mermaid `
     block are drawn as diagrams (a diagram with a mistake in it shows the error above its
     code). The window follows the file — save it in your editor and the preview changes.
     A link to a heading scrolls there; a link to another `.md` opens it in the same window,
     with **[en:tran:Back]** (the left arrow) to return; a web link opens in your browser; a
     link to any other file shows it in its folder rather than running it. HTML written
     inside the file is drawn the way GitHub shows a README — a centred picture, a table, a
     section that folds away — but nothing in it can run: scripts, buttons, forms and styles
     are taken out. If a file shows `#` and `**` instead of a heading and bold, the file itself
     was saved with them escaped (`\#`, `\*\*`), which some editors' formatted view does
     when text is pasted into it; the preview shows what is written. The head row also has
     **[en:tran:Reload]**, **[en:tran:Open in Default App]** (to edit it) and
     **[en:tran:Reveal in File Explorer]**. Right-click the row for **[en:tran:Preview]** or **[en:tran:Open]**. Pressing a
     file whose preview is already open brings that window forward. 📸
   - **A bible note file** (`.own`) gains a chevron: click it and everything in it is
     listed under it, as the **[en:tran:Bible Notes]** panel lists it — its notes, and each verse
     marked in it (the highlighter icon) with its highlights in their colour and its comments
     underlined, what was written beside them. Click a note to open it in the **Bible Note**
     window **read-only** — the title bar says **([en:tran:Read-only])**, the lock at the
     bottom shows it is locked, and nothing you do there is saved to the file. Click a
     highlight or comment to open that verse beside what you are reading; click a verse to
     fold it away to a count. Nothing in the file can be changed from here. A file that is
     not a bible note says **[en:tran:Not a bible note file]**. 📸
7. **A `.json` file can hold a list of links** — videos, articles, anything on the web for
   that chapter — and the panel shows them instead of opening the file. Save the file
   inside a folder listed in **[en:tran:Resources]**; to add its folder, click the panel's
   **⋮** → **[en:tran:Add Folder]** and choose that folder. Write it as a list
   of entries, each with a **title** to read and a **url** to open — one link is
   `[{"title": "Notes", "url": "https://www.example.com/notes"}]` — exactly as in this example:

   ```json
   [
     {
       "title": "Overview: 1-2 Chronicles",
       "url": "https://www.example.com/watch?v=overview-chronicles"
     },
     {
       "title": "Notes on the genealogies",
       "url": "https://www.example.com/notes"
     }
   ]
   ```

   Save it named after its chapter, as the files beside it are (`JHN.3.json` for John 3,
   `1CH.0.json` for the whole of 1 Chronicles), and the row for it gains a chevron
   and a 🔗 icon, with one row per entry hanging under it. **Click a
   title to open it in your own web browser** — Chrome, Edge, Safari, whatever you
   normally use — and the site it goes to is shown after the title when the panel is wide
   enough, with the title and the full address on the tooltip either way. Right-click a
   link (or use its **⋮**) for **[en:tran:Open Link in Browser]** and **[en:tran:Copy URL to Clipboard]**. 📸
   A few details worth knowing:
   - A bare address on its own line — `"https://www.example.com/talk"` — is a link that
     titles itself, so a quick list needs no titles at all. An entry with no title shows
     its address as the title.
   - Only **`http`** and **`https`** addresses are offered. Anything else is left out and
     the panel says how many entries it could not read (**1 [en:tran:entry was not understood]**),
     so a typo shows instead of a row quietly going missing.
   - **A `.json` that is not a list of links is just a file.** If it holds other data, or
     is not valid JSON at all, the row keeps the ordinary file icon with no chevron and a
     click opens it in your text editor like any other file — nothing to dismiss.
   - The file is read when its row appears, so editing it on disk and folding the group
     shut and open again shows your change. Files found by the **search** in step 5 are
     read on the first click instead, which is why a link list found that way needs one
     press to show its links.
   - Right-click the `.json` row itself (or its **⋮**) for **[en:tran:Open]** if you want to edit
     the file rather than follow a link.

8. Click a group's header to fold it away; it opens again the next time Resources is shown. Right-click a header
   for **[en:tran:Refresh]** (re-reads that one folder — **[en:tran:Reload]** in step 3 does all of them),
   **[en:tran:Add Folder]**, **[en:tran:Add Files]**, **[en:tran:Reveal in Finder]**/**[en:tran:Reveal in File Explorer]**,
   **[en:tran:Copy to Data Directory]** and **[en:tran:Remove Folder]**, which asks you to confirm and
   then only removes it from this list — nothing on disk is touched. 📸
   **[en:tran:Add Files]** is the other way round: it puts files you already have INTO that
   folder. Pick one or several in the picker and they are **copied** in — the originals stay
   exactly where they were — then the group re-reads itself, opening if it was folded, and a
   note says how many were copied. **Nothing is ever overwritten**: a name the folder already
   holds gets a number beside it, so a second `GEN.4.pdf` lands as `GEN.4 (1).pdf`. Pick a file
   that is already in that folder and it is left alone rather than copied beside itself. Copy in
   a file named after no chapter — `notes.docx` — and it is on the shelf but not in the list;
   the note says so and tells you to tick **[en:tran:Others]** (step 5) to see it. 📸
   **[en:tran:Copy to Data Directory]** brings a folder you keep somewhere else in with the rest
   of the app's data, so it lives and moves with it — **[en:tran:Export Data]** (W-25) carries
   it in a backup, which a folder only listed here does not. It asks first, naming the folder and where
   the copy goes — a `resources` folder inside your data folder (the one Settings calls the
   parent directory). Press **[en:tran:Yes]** and everything in the folder is copied there, sub-folders
   and all, while the progress bar runs; then the group switches to the copy, in the same place
   and open, and a note says where it went. **Your original folder is not
   touched** — it only leaves this list, so delete it yourself once you are happy with the copy.
   A second copy of a folder with the same name is called `YouTube (1)` rather than mixed into
   the first. The item is not offered on a folder that already is a copy, and a folder that
   holds your data folder — your whole Desktop, when the data lives on the Desktop — is refused
   straight away with **[en:tran:The data directory is inside this folder]**, because it would
   be copied into itself. 📸

> **Watch the numbering.** The chapter number has to stand on its own between two dots. For
> Psalm 1 that means `PSA.1.pdf` is found while `PSA.10.pdf`, `PSA.100.pdf` and `PSA.149.pdf`
> are left alone — which is exactly what you want, since a full set of the Psalms has all of
> them in one folder. Write the numbers plainly: no leading zeros (`PSA.01.pdf` is not
> found), and `-0` is not a number. Upper and lower case do not matter.

> **If a group shows a warning** instead of files: **[en:tran:Folder not found]** means the folder was
> moved, renamed or deleted since you added it (remove it and add it again);
> **[en:tran:Cannot read folder]** means the app is not allowed to read it. **[en:tran:Too many folders to search]**
> means even those two levels held more folders than it could read — point
> Resources at the folder your material is actually in rather than at a whole drive.
> A file you expected that is simply **not listed** is usually more than two folders down:
> add the folder it sits in (or the one above it) as a group of its own.

_Verify: RD-81, RD-82, RD-83, RD-84, RD-85, RD-86, RD-87, RD-88, RD-89, RD-90, RD-114, RD-115, RD-116, RD-117, RD-118, RD-119, RD-120, RD-122, CM-93._

---

### W-38 — See how people and places connect (Connection Graph)

The record window tells you _who_ someone is. The graph shows you _how they connect_ —
parents, spouses, children, cousins and places, all on one canvas you can explore.

1. Open the **[en:tran:Names and locations lookup]** (`👤📍`) from the Bible Lookup header and find
   a person — try **Jacob** (យ៉ាកុប). 📸
2. Click the **⋮** at the right end of the row — or **right-click** the row — and
   choose **[en:tran:Open Graph Preview]**. A floating window opens with
   that person in the middle.
   > You can right-click a name anywhere it is already clickable — in the list, in the
   > **[en:tran:Names and locations in your reading]** panel, underlined inside a verse, or in the
   > related-names list of a record window. The **⋮** is on the rows of the first two,
   > which is where you would go looking for it; a record window also has a small
   > diagram icon (`bi-diagram-3`) beside its title.
3. Each box shows a number next to a small diagram icon — that is how many related
   records it has. **Click the number.** A menu opens listing **[en:tran:All] (47)** first, then
   only the kinds this record actually has: _Parents (2)_, _Spouses (4)_, _Siblings (2)_,
   _Children (16)_, _Cousins (22)_, _Locations (1)_. 📸
4. Pick one kind — say **[en:tran:Children]** — and just those boxes appear, ringed around the
   person and joined by curved lines. Each line is labelled with the relationship as you
   would say it: _son_, _daughter_, _wife_, _father_, _located at_.
   > Choosing **[en:tran:All]** on a record with many relations asks you to confirm first, because
   > forty-odd boxes at once is a lot to read.
5. Explore: **drag** any box to move it (it stays where you put it), **drag the empty
   canvas** to pan, and **scroll** to zoom in and out around your pointer.
   **Double-click** a box to make it the new centre.
   > **Right-click a box** for a menu of everything that box can do: **[en:tran:Open detail]**,
   > **[en:tran:Verses] (8)**, **[en:tran:Open all Related] (23)**, **[en:tran:Collapse]**, **[en:tran:Set as centre]**,
   > **[en:tran:Use as root]** and **[en:tran:Remove]**. _Set as centre_ re-arranges the whole graph around
   > that box; _Use as root_ clears everything else away and leaves just it, so you can
   > start exploring again from a record already in front of you. It is the same set as the small buttons along the bottom of the box, but
   > it also works on a box you have collapsed, which shows no buttons at all. Rows you
   > could not use are simply absent — the centre box offers no _Remove_, and a record
   > with no relations offers no _Open all Related_.
   > The **[en:tran:Verses]** list names each verse the way YOUR Bible names it —
   > _លោកុប្បត្តិ ២៤:២៩-៣០_, not `GEN 24:29-30` — and picking one opens it.
6. Too busy? The coloured chips along the top switch each kind of connection on and off —
   turning **[en:tran:Cousins]** off is usually the difference between a tangle and a family tree.
   **Right-click a chip** to show _only_ that kind, and right-click it again to bring
   everything back. 📸
7. Bottom-right: **↺ [en:tran:Undo]** and **↻ [en:tran:Redo]** step through everything you have done to the
   graph — a box you dragged, a zoom, an expansion, a filter — and **Ctrl+Z** / **Ctrl+Y**
   do the same. One wheel gesture is one step, however many notches it took.
   **[en:tran:Fit to view]** (`⛶`) brings every box back on screen, **[en:tran:Re-layout]** (✨) tidies the
   whole arrangement — a family fan back into rings, a found path back into its chain —
   and the `^` button collapses every box to a single line so a big graph fits.
   > Nothing here is one-way: if a tidy-up is not what you wanted, Undo puts every box
   > back where it was.
8. **Find the line from this person to another.** Click the signpost icon at the top
   right. The graph's own centre is already the starting point — it sits there as a chip —
   so you only say where you want to get TO. For this example open the graph on **David**
   (step 2, from his row) rather than on Jacob — from Jacob the chain is longer than the
   search allows, as the note below says — then type **jesus**, pick **យេស៊ូវ (Jesus)** from
   the list (every name is offered with its English name beside it), and press
   **[en:tran:Find Connection]**. The canvas fills with the generations from David
   down to Jesus, the connecting line highlighted, and every box on it still expandable. 📸
   > The panel takes the name of the person the chain STARTS from, and that first box
   > becomes the graph's new centre.
   > Paths run through people only. A place like Jerusalem touches almost everyone, so
   > allowing places as stepping stones would "connect" any two people meaninglessly.
   > If there is no link within 30 steps you will see **No connection found within 30
   > steps** — that is an answer, not an error. The search stops there, so two people
   > further apart than that (Jacob and Jesus are about forty generations apart) are not
   > shown as connected even though they are.
9. Keep it: the `⋯` menu at the top right offers **[en:tran:Save as image]** (a PNG saved to your
   Downloads folder and revealed for you), **[en:tran:Print]** (which prints on white paper
   whatever theme the app is using), and **[en:tran:Save preset]** to name an arrangement and come
   back to it later.
   > **[en:tran:Fullscreen]** gives the graph the whole window. Its
   > **[en:tran:Presets]** and **[en:tran:Copy]** menus still work there,
   > and **[en:tran:Save preset]** opens the name dialog over the graph.
   > **[en:tran:Cancel]** returns to the graph without saving;
   > **[en:tran:Exit fullscreen]** returns to the floating window.
10. **Copy a graph into your notes.** On the graph, press the clipboard button (📋) left of the signpost and choose **[en:tran:Copy as Markdown]**. Open the destination note or document, click where the graph should go, and paste with **Ctrl+V** (on macOS, **⌘V**). Save the note or document in that application. The clipboard button opens six
    ways to copy the graph: **[en:tran:Copy as Markdown]** on its own, then five diagram
    languages — **[en:tran:Copy as Mermaid (across)]**, **[en:tran:Copy as Mermaid (down)]**,
    **[en:tran:Copy as Mermaid Mindmap]**, **[en:tran:Copy as Graphviz DOT]** and
    **[en:tran:Copy as PlantUML]**. Hover a row for its full name; the message that
    follows the copy says which one landed. 📸
    > **Markdown** is the graph written out for a note or a document — **the diagram
    > included**. It opens with the drawing itself in a `mermaid` block, so a wiki, a
    > repository, a notes app or this app's own markdown preview draws the same boxes
    > and lines; under it come every record with its kind and one-line description in a
    > table (the one in the middle marked _(centre)_), the connections grouped by kind
    > — _son_, _wife_, _located at_ — and the verses each record cites. Names, kinds
    > and relationship words come out in the same language the records are in.
    > **Which diagram language?** Whichever the thing you are pasting into reads.
    > **Mermaid** is drawn by most places that show markdown, and comes three ways: the
    > usual one runs **across** the page, **down** suits a line of generations, and the
    > **mindmap** turns the graph into a branching tree around the middle record —
    > easiest to read at a glance, but a tree cannot show a second link between two
    > people, and it carries no relationship words. **Graphviz DOT** and **PlantUML**
    > are for tools and wikis that draw those instead. Every one of them describes
    > exactly the boxes on the canvas, so switching a kind of connection off first is
    > how you copy only part of a graph.
11. **See it drawn, without leaving anything behind.** The last row on that same 📋 menu,
    under a divider, is **[en:tran:Open in Mermaid Live]**. It opens a second little menu
    — **[en:tran:Mermaid (across)]**, **[en:tran:Mermaid (down)]**,
    **[en:tran:Mermaid Mindmap]** — and picking one opens the Mermaid Live Editor in your
    web browser with this graph already in it, drawn. 📸
    > **Nothing is uploaded.** The diagram travels inside the address, after the `#`, and
    > a browser never sends that part to anybody's server — it is the same thing the
    > editor's own Share box does, which is why that site says the diagrams you make
    > never leave your browser. Your names, places and notes stay on this machine.
    > Only the three Mermaid rows are offered, because that editor draws Mermaid and not
    > Graphviz DOT or PlantUML.
    > It is the quickest way to get a **picture** of a graph out of the app for a slide or
    > a handout — the editor can zoom it, recolour it and save it as a PNG or an SVG.
    > A very large graph makes an address too long for the browser to be handed. If that
    > happens the app says so and puts the link on your clipboard instead: open your
    > browser and paste it into the address bar.
12. Opening a record always starts you at that record, with one box — every time, however
    you left the window last time. 📸
    > If an arrangement is worth coming back to, say so: `⋯` → **[en:tran:Save preset]**, name it,
    > and it is waiting in that same menu next time.

_Verify: RD-92, RD-93, RD-94, RD-95, RD-96, RD-97, RD-98, RD-99, RD-100, RD-101,
RD-102, RD-103, RD-104, RD-105, RD-106, RD-121._

### W-39 — Let the passage scroll itself while you read

When a chapter is longer than the panel, you do not have to keep reaching for the mouse
wheel — the app can scroll it for you, at whatever pace you set.

1. Open a passage long enough to scroll, in a Bible panel or on the screen preview.
   Down in the bottom-right corner of the text, two faint controls sit one above the
   other: an up-arrow (**[en:tran:Scroll to the top]**, shown only once the text has moved
   down) and a double chevron below it.
   The double chevron is the auto-scroll button. 📸
2. Click the double chevron once. The text starts creeping downward. Click it again and
   it goes faster; each click adds a little more speed.
   It glides at a steady pace on any computer, and the pace follows the text size: make
   the text bigger and it travels further each second, so you still read the same number
   of lines a minute. Scroll it yourself while it plays — back up to re-read, or ahead —
   and it carries on from where you left it.
3. As soon as it is moving, a **⋯** appears just to its left. Click it. 📸
   A small menu opens listing everything this button can do, with the mouse action for
   each one written beside it:
   - **[en:tran:Auto Scroll Speed]** — how fast it is going right now.
   - **[en:tran:Speed Up]** — the same as clicking the chevron.
   - **[en:tran:Speed Up Faster]** — a bigger jump, the same as double-clicking it.
   - **[en:tran:Slow Down]** — the same as right-clicking it.
   - **[en:tran:Stop Auto Scrolling]** — the same as Alt + right-click.
4. Pick **[en:tran:Slow Down]** once, reopen the menu and see that the speed number has
   fallen — after the two clicks of step 2 a second **[en:tran:Slow Down]** would bring it to
   zero, which stops the scroll by itself. Pick **[en:tran:Stop Auto Scrolling]** to end it — the text stops and the **⋯**
   disappears, because there is nothing left to control. 📸
   > The **⋯** is only ever there while the passage is actually scrolling. If you cannot
   > see it, the passage is not moving — click the double chevron first.
   > You never have to use the menu: the four mouse actions it lists work directly on the
   > double chevron itself, and always did. The menu is there so you can find them, and
   > so they work on a touch screen, where there is no right-click at all.

_Verify: RD-107._

---

### W-40 — Mark up a passage while you study it

**Goal:** highlight words in a passage in colour, and attach a note to a phrase, so both
are still there the next time you open the app.

1. Open the **Reader** (📖) and bring up a passage — say `Genesis 22:1-24`.
2. Drag across a few words inside a verse, the way you would to copy them. A small
   toolbar appears just above what you selected. 📸
   It has six coloured dots, then a **speech bubble** and an **eraser**.
3. Click the **yellow** dot. The words you selected — and only those — take on a soft
   yellow wash, and the toolbar goes away.
   > The colours are a fixed set of six. They are meant to read like a highlighter pen
   > over the text, so the verse still reads as scripture underneath.
4. Look at the left panel and open **[en:tran:Bible Notes]**. Under
   **Default** there is now a new row named after the verse — `(KJV) Genesis 22:1` — with a
   highlighter pen in front of it and a small number on the right saying how many marks it
   holds. Click it to fold it open. 📸
   Inside are the words you marked, wearing the very colour you gave them — the panel shows
   the mark rather than describing it, so the number on the right steps aside while the row
   is open.
   > This row lives in the same note file as your ordinary bible notes, so it is saved,
   > backed up and exported along with them. You never have to put it anywhere.
5. Back in the passage, select a different phrase and click the **speech bubble**. 📸
   The phrase gets a wavy underline instead of a wash, and a small window opens with the
   verse's name at the top and an empty box. Type your note into it.
   Close the window with the **✕**. Nothing else to press — it saves as you type.
6. Now move the mouse over those underlined words. 📸
   A little panel appears under them showing what you wrote, with three buttons: a **✕**
   to put the panel away, a **pencil** to open the note again, and a **bin** to delete it.
   > Move the pointer straight down onto the panel to use its buttons — it waits for you.
7. Each mark under the verse has a **⋮** at its right end (right-clicking the mark does
   the same). Its menu offers the five other colours, so you can recolour a highlight,
   **[en:tran:Edit Comment]** on a comment, and **[en:tran:Delete]**.
8. Click any mark in that list. 📸 The verse it belongs to opens as a new passage
   beside the one you are reading — the passage you were in stays where it is — and it
   flashes if it happens to be on screen already.
   > A mark is a place you kept inside something you were reading. Reaching it should not
   > cost you your place, which is why it opens beside rather than on top.
9. The verse row itself has a **⋮** too. 📸 It can do three things:
   - **[en:tran:Add to Bible List]** — puts that verse in your **[en:tran:Bibles]**
     list, ready to present, without going and looking it up again.
   - **[en:tran:Move To]** — moves the whole row, marks and all, into one of your other
     note files.
   - **[en:tran:Delete]** — removes the verse and everything marked on it, after asking.
   > You can also just **drag the verse row and let go**. Dropped on a file in the
   > **[en:tran:Bibles]** panel it arrives as an ordinary bible item, the same as if you had looked
   > it up; dropped on another file in **[en:tran:Bible Notes]** it moves there instead, marks and
   > all. One drag, and where you let go decides which it means.
10. Delete the last mark on a verse and the verse's row disappears from **[en:tran:Bible Notes]**
    too — an empty row would only be something else to tidy up later.

> Marks belong to the translation you made them in, because they remember which words
> they cover and every translation words a verse differently. A mark made on KJV is not
> painted over a Khmer column of the same verse. That is also why a verse row, its
> marks, your comments and the comment window are all lettered in the font that bible
> is read in rather than the app's own.
> They also stay in the app: what you highlight here is never shown on the screen your
> congregation sees.

_Verify: RD-108, RD-109, RD-110, RD-111, RD-112._

---

### W-41 — Share a whole page of Bible Notes with another machine

Until now a note could only leave the app **one item at a time**. A whole note file —
every note in it, the pictures and clips inside them, and the background you attached
to it — travels as one bundle.

1. In the **[en:tran:Bible Notes]** panel, click the `⋮` on the note file you want (or right-click
   its name) and choose **[en:tran:Export]**. It sits just under **[en:tran:Import]**. 📸
2. A small panel asks for a **[en:tran:Password]** and a **[en:tran:Confirm Password]**. Leave both empty for an ordinary bundle, or type the same
   password in both to lock it. Press **[en:tran:Ok]**.
3. You get one `<name>.owanote.tar.gz` file in your **Downloads** folder —
   `<name>.owanote.enc` if you set a password — and the app opens the folder on it. 📸

   > Everything a note points at rides inside: a picture you pasted, a clip you inserted,
   > the sound file you attached. That makes this bundle much larger than a bible list's,
   > so give a note full of video a moment to finish.

   > **It carries what you typed last, not what you saved last.** A note window
   > keeps your typing until you press **[en:tran:Save]** (W-14), and the bundle
   > is written from the note as that window has it — so nothing you have typed
   > is left behind, whether or not you remembered to save it first.

4. On the other machine, click the `⋮` at the top of the **[en:tran:Bible Notes]** panel → **[en:tran:Import]** and pick the file — or **drag the `.owanote.tar.gz` (or `.owanote.enc`) onto
   the Bible Notes panel**. A protected one asks for its password first.
   **[en:tran:Import From URL]** works here too if the bundle is on the web. 📸
5. The note file appears in that machine's notes folder with all its notes, your
   highlights and comments, and its pictures and clips playing from the local copies.

   > If a note file of that name is already there, yours is never overwritten: the
   > imported one arrives beside it as `name (1)`. Rename whichever you prefer.

6. To move a **single note** instead of the whole page, use the `⋮` on that note →
   **[en:tran:Export]**, and **[en:tran:Import]** on the note file you want it to land in — any note file,
   not only **Default**. That one carries your unsaved typing too.

_Verify: PR-30, PR-31, CM-69, CM-98, CM-99._

---

### W-42 — Ask the app for help (the chatbot)

The app can answer its own "how do I …?" questions. It reads the same manual you are
reading now, looks at what the app is doing at that moment, and can point at the button
it is describing.

1. Click the **🤖** button in the top-right corner of the window, between the gear
   and the **✨** (the AI Chat window, W-44 — a different thing: a company's chat site
   in a box), or open **Help** → **App Help (Chatbot)** in the menu bar, or click
   the **?** at the end of the same row and choose **[en:tran:Open Chatbot]**. Answer
   the **[en:tran:Be careful with AI]** question with **[en:tran:Open]** — ticking
   **[en:tran:Do not show this again for 30 days]** first puts the question away for that
   long — and a narrow window opens beside the app. 📸
   **The 🤖 button is only on the three windows with a top bar** — the Presenter, the
   Bible Reader and the Slide Editor. Everywhere else, and on those three as well, the
   way in is the **Tools** menu → **[en:tran:App Assistant]**, or **Ctrl+Shift+A**
   (**⌘+Shift+A** on Mac). That works from a Bible Note, Settings, the Web Editor, the
   Lyric Editor and Local Web Share — the windows a volunteer is most likely to be
   stuck in — and the menu bar is hidden on those, so the shortcut is the way in. If a
   help window is already open it comes to the front rather than a second one opening.
   **On Windows the taskbar has it too, and asks no question first:** right-click the app's icon on the taskbar and
   choose **App Help (Chatbot)** under **Tasks** — the app comes forward and the help
   opens straight away, without the **[en:tran:Be careful with AI]** question, which is the
   quickest way when the app is minimised or behind something else.
   With **[en:tran:Enable AI features]** switched off in Settings → Others, the menu entries,
   the taskbar entry and the shortcut go quiet together; the 🤖 button stays, and pressing it says that AI
   features are turned off and offers to open Settings, where the switch is (it takes
   effect after a restart).
2. A strip of **tabs** runs along the very top — several conversations at once, the way
   a browser holds several pages. **+** starts a new chat (its tab reads **New chat**
   until a question is asked in it), **×** closes one, and a
   **double-click on a tab's name** renames it (useful once three of them start "how do
   I"). Until you rename it, a tab is called after the first question you asked in it.
   Everything is kept: close the window — close the app — and the tabs, their answers
   and even a half-typed question are all there when you open it again. 📸
3. Every tab opens with a **⋮** on its left, and a right-click anywhere on the tab
   does the same thing: it is that chat's own menu — **Rename this chat**, **Lock this
   chat**, **Close this chat**, and, when there is more than one chat to take, **Close
   other chats…** and **Clear all chats…**. Those last two are never done on the first
   press: a line appears under the strip saying how many chats will go, with **Keep
   them** beside the button that does it. 📸
4. **Lock this chat** is how you keep one. A locked tab has no **×** any more — a 🔒
   sits there instead — and neither **Close other chats** nor **Clear all chats** takes
   it, so the strip can be cleared at the end of a service with the one answer worth
   keeping still in it. **Unlock this chat**, in the same menu, gives the **×** back.
   The lock is remembered with everything else, so it is still locked next Sunday. 📸
5. The rest of the top line belongs to the tab in front, and it is three **drop-down
   lists**, each with its own small grey caption saying what it is for —
   **ASKING ABOUT**, **ASSISTANT** and **MODEL**. (While the window is narrower than about 560 pixels — and it opens at 460 —
   each caption sits above its list; drag the window wider and the captions move
   beside their lists.) The first,
   **ASKING ABOUT**, says which window of the app you are asking about —
   **Presenter**, **Bible Reader**, **Document Editor**, **Bible Note**, **Settings**,
   **Web Editor**, **Lyric Editor** or **Local Web Share**. Every time you open the
   help — including bringing an already-open help window back to the front — the
   active tab starts on the window you opened it from. A choice you make afterwards
   stays with that tab until the next launch, and the other chat tabs keep their own
   choices. The suggested questions change with it: opened from
   the Lyric Editor it offers marking verses and choruses, opened from Settings it
   offers the language and the Bible downloads. Answers follow it too — a recipe
   belonging to another window names buttons that are not on your screen, so it is
   left out. Another tab can be asking about a different window at the same time.
   **More than one window of the app open? Choose it on the WORKING IN line above the box.**
   That line, just over the box you type in, names each open window — the main
   window, and for example a Slide Editor (by its document's name), Settings or a
   Bible Reader opened in a window of its own — and the help then works with the
   one you choose: it reads what that window shows, outlines buttons in it, walks you
   through steps there, the 📷 takes a picture of that window and the ◎ points in it.
   Choosing one sets **ASKING ABOUT** to match and marks the line with a coloured
   bar; choosing the main window goes back to the usual way. The choice belongs to
   that chat tab while the help window stays open; the line appears only while there
   is a second window to choose, and it keeps up by itself: a window you open or
   close, or the main window moving to another page, shows in the list within a
   second, with nothing to press in the help window. A picture from the 📷 and a
   control from the ◎ remember the window they came from — rest the mouse on the
   chip to see it — and the assistant is told which window each is of; pressing a
   pointed-at chip outlines that control in its own window, whichever window is
   chosen now. 📸 **ASSISTANT** is which service answers and **MODEL** is which of
   its models; with no API key at all **ASSISTANT** starts on **Free**, a shared public
   service that needs no key, and a notice pinned above the conversation says so and
   carries **Open AI settings**, which opens the settings panel that takes a key. 📸
   **Short of room? Fold those lists to one line.** A small arrow sits at the left
   edge of the window's top line — the line with the three lists, not the list of
   suggested questions under it. Click it and the lists — with the **LIMIT PER HOUR** list and
   the **CREDIT USED** line of step 8 — fold into a single line that still says
   what each one is set to, such as _Presenter · Claude · Sonnet 5_, with the hourly
   limit at its end (it turns amber when the assistant is close to that limit or
   paused). Click that line to bring the lists back, exactly as they were. It only
   ever folds when you press the arrow — never while you scroll or read — and it
   stays the way you left it in every chat tab. 📸
   When **ASKING ABOUT** is **Bible Reader**, answers lead with the easiest mouse or
   touch route, use no more than three steps at first, say where the control is, and
   explain actions such as double-clicking or dragging. A lost item starts with a
   history or recovery route, not a request to remember it, and a failed step gets a
   different safe route or one short question that identifies the next exact step.
   Any steps shown begin at 1, and the choices below the answer stay specific to that
   answer, including a recovery choice when the first route may fail. The wording is
   respectful and plain; it does not assume the reader knows computer terms or
   keyboard shortcuts.
6. Type a question and press **Ctrl+Enter**, click **[en:tran:Send]**, or click one of the
   suggestions. Answers arrive with follow-up buttons: **Read the whole thing** opens
   the full recipe, the other button is the next-best match. Pages of this guide are
   always named by their **title** — _the guide page “Set the background”_ — never
   by a code or a number, whatever the assistant was reading. 📸
   **The four suggestions are not all it can answer — press More… to see the
   rest.** Under the **Try asking** chips on an empty chat is a small
   **More… — everything it can answer** button. It opens the whole list for the
   window you are asking about, sorted under the panel each question belongs to
   — _Bible verses on screen_, _Backgrounds_, _The screen the audience sees_, _Nothing on the
   projector_, and so on. There are about 300 of them for the Presenter, and every one
   has a page of this guide or a look at the live app behind it, so nothing on
   that list can be pressed and come back with a shrug. It is worth a scroll
   once: most people use this window for the one thing they first saw it do.
   Press any of them to ask it, or type a few words in the box and the same list
   narrows itself as you type. **Fewer** folds it away again. 📸
   **A Bible can be installed from the chat, with no model call.** Ask
   `Import bible from xml url https://github.com/Beblia/Holy-Bible-XML-Format/raw/refs/heads/master/KhmerBible.xml`
   — the **Bible versions** section under **More** contains this editable sample. Asking it
   downloads the file and asks a few quick questions in the chat, each with buttons to
   press — a short name, the language, the digits and the book names — and installs
   nothing until you press **Install it**, with **Undo** under the answer afterwards (W-34).
   **The Bible Reader also has 30 guided demos that need no AI model, key or
   account.** Set **ASKING ABOUT** to **Bible Reader** and, in an empty chat,
   press one of the demo buttons listed under **Try a guided demo** — those words
   are a heading, and typing them does nothing. The original four practise text size, opening
   John 3:16 with buttons and finding Bible words. Nineteen more cover passage
   history, clearing the reference, people and places, two Bible versions,
   distraction-free reading, copy/split/save, automatic scrolling, line
   layout, cross references, names in the current passage, Resources and book
   filters. Seven more practise typing a
   complete reference, removing only its last part, automatic Bible audio,
   note filtering and sorting, Settings and Help. The full Tips list also
   explains how View > Widgets shows or hides the whole saved-passages panel,
   saved Bibles, or Bible Notes; those three are self-guided because an open
   pane is not itself a toggle.
   A card appears in the Reader. Press
   **Do it** for one visible action at a time, or **Skip** to do that step
   yourself. The reference demo uses the Bible's own book, chapter and verse
   buttons, so it also works when those buttons are not in English. Study-view
   demos choose the named view even when the panel remembered a different one.
   📸
   **The box takes as many lines as you need.** Plain **Enter** starts a new line
   rather than sending, so a question can be written out properly — what you did,
   what happened, what you expected — and the box grows as you type, up to about
   eight lines, then scrolls. **Ctrl+Enter** is what sends it.
   **A question you asked before comes back with Alt+↑.** The window remembers what
   you have typed into it — across every tab, and from one day to the next — and
   **Alt+↑** puts the question before back in the box, with the cursor at the end of
   it, ready to be changed. **Alt+↓** walks forward again, and one press past the
   newest gives you back whatever you were halfway through typing, untouched. It is
   for the question that was nearly right: bring it back, fix the verse reference or
   the screen number, and ask it again without writing the whole sentence out twice.
   (The plain arrow keys still move the cursor and still walk the list of
   suggestions, which is why this one wants **Alt** as well.) 📸
   **The list above the box is worked from the keyboard.** As you type, the
   questions it can already answer — or, after a `/`, the commands — open in a list
   above the box. **↑** and **↓** walk it, and the list scrolls with you, so the row
   you are on is always in view (**↑** from the box starts at the bottom row, the
   one nearest the box). **Tab** takes a row: the one you walked to, or the first one
   when you have not walked at all. Type `/bt`, press **Tab**, and the box reads
   `/btw ` with the cursor after it, ready for your question. **Tab only fills the
   box — it never sends.** Finishing `/screen-hide` with **Tab** turns nothing off
   until you press **Ctrl+Enter**. (**Enter** on a row you walked to, and a click,
   still run a command that needs no words after it.) The list closes by itself once
   it has nothing left to offer — a command typed in full, or the first word typed
   after one — and **Esc** closes it sooner. With no list open, **Tab** moves on to
   the **[en:tran:Send]** button as it always did. 📸
   **You can just carry on talking.** Each tab is one conversation, so the answer to
   "is any screen showing?" can be replied to with **yes**, or with "how do I turn it
   off?", and it knows what you mean — you do not have to say the whole thing again.
   Each tab keeps its own thread: a question asked here is never answered out of the
   chat next door.
   **And you rarely have to type the next thing.** Every answer ends with two or
   three short buttons in the assistant's own words — _“How do I style the verse
   text?”_, _“Which button shows it?”_, _“No thanks”_ — and pressing one says it for
   you, as if you had typed it. A reply that only repeats **Show me step by step**
   in other words is not offered beside it. They are the round-cornered buttons on the bottom row; the
   square ones above them, in capitals, are the ones that DO something in the app.
   Only the newest answer carries them, so a **Yes** is always a yes to the question
   you were just asked. 📸
   **It tells you what it is doing while you wait.** Under your question, a
   short list builds up as it works — _Connecting to the app_, _Thinking about
   it_, _Searching the guide for "background"_, _Checking the projector
   screens_, _Reading example.com_, _Creating a new song: "Amazing
   Grace"_. The one it is on now is the bright line at the bottom with the
   pulsing dot; the ones above it are done and go grey. A question that has to
   read a web page and write a song out of it takes the best part of a minute,
   and this is how you can tell it is getting somewhere rather than stuck — and
   whether it is doing what you meant. If it says _Reading_ a site you did not
   ask about, or _Pressing_ something you did not want pressed, that is the
   moment to press **Stop**. 📸
   **Changed your mind? Press Stop.** While an answer is on its way the **[en:tran:Send]**
   button becomes **Stop**, and the last line under the steps says so —
   _press Stop to give up on it._ Pressing it (or **Esc**, while the cursor is not in the box) calls
   the question off there and then: the chat says **Stopped**, nothing arrives
   afterwards, and your question is still sitting above it with **Ask again**
   under it. Use it for a question asked by mistake, one taking longer than you
   have before the service starts, or an assistant that is thinking its way
   round the houses. 📸
   **And you can keep talking while it works.** The box is not locked while an
   answer is coming: type the thing you forgot to say and press **Add** (or
   **Ctrl+Enter**) and it goes into the answer that is already being written, rather than
   starting a second question — the line joins the conversation marked _Added
   while it was working_. If it arrives too late to be worked in, it is answered
   on its own and the reply says so. Press **Stop** instead and every word you
   added comes straight back into the box: nothing you typed is thrown away. 📸
   **A question you picked from the list is answered from its own page.** The
   **Try asking** chips, the suggestions under the box and the **More…** list are
   the app's own supported questions, and each one is filed under the page of this
   guide that answers it — so picking one goes straight to that page rather than
   searching for it, with an assistant or without one. Type the question in your
   own words and it is searched for as before.
   **Some things need no assistant at all — type `/`.** A line that starts with
   `/` is a **command**: it runs on the spot, on this machine, with no assistant,
   no key and no internet, and the answer says what CHANGED. Type `/` on its own
   and the list of them appears above the box — every one of them, the list
   scrolls — walk it with the arrows, finish one with **Tab**, or click one.
   **/screen** says whether anything is on the projector AND what is on it
   — the song and the verse, the passage, the background — even while the screen
   is off, so _the screen is off but already holds Verse 2, turning it on shows
   that_ is the answer rather than a bare _nothing is showing_; **/screen-show**
   turns the screen on and **/screen-hide** turns every screen off, and both read
   the screens back afterwards, so _the screen is on now_ is never a guess;
   **/screen-clear-all**, **/screen-clear-background**, **/screen-clear-slide**,
   **/screen-clear-bible** and **/screen-clear-foreground** press the five clear
   buttons (**F6**–**F10**; the older **/clear-all** … **/clear-foreground**
   spellings still reach them, and **/clear** on its own empties the chat in
   front of you — a locked tab keeps its messages and says so);
   **/selected** says which song is selected, which of its slides is up and
   which comes next; **/next** and **/previous** put the next or the previous
   slide of the selected song on the screen — the arrow keys, from the ask box —
   and read the screens back afterwards, saying so when the screen itself is off;
   **/slide 3** or **/slide verse 1** puts one slide of the selected song on
   the screen by its number or by the words in its name, and reads the screens
   back the same way (with no slide named it lists them);
   **/run** says which run sheet (presenting flow) is open in its run player,
   the line the run is on — and the slide inside it — and what the next press
   puts up, or names the sheets there are to open when none is (it presses
   nothing: advancing a run is your own **Space** in the run player);
   **/verse John 3:16** puts that passage on the screen — read by the app's own
   reference parser, in the Bible version the Bible Lookup is on (or another
   installed one that reads it), and read back afterwards: _John 3:16 (KJV) is
   on the screen now — "For God so loved…"_, with _Turn the screen on_ offered
   when the screen is off and _Take it off again_ beside it (**F9**). Asking in
   words does the same: _Put John 3:16 on the screen_ puts it up straight away
   with an assistant, and offers one button that does it without one;
   **/countdown 5** starts a five-minute countdown on the screen (**/countdown
   10:30** counts down to a time, **/countdown stop** takes it off; **/timer** is
   the same command) and **/marquee Please silence your phones** scrolls the
   words along the bottom (**/marquee-top** along the top; **stop** takes either
   off) — each read back afterwards, _a 5 minute countdown, ending at 11:45 AM is
   on the screen now_, with _Turn the screen on_ offered while the screen is off
   and _Take it off again_ beside it. Asking in words does the same: _Start a 5
   minute countdown on the screen_ or _Put the time on the screen_ starts it
   straight away with an assistant and offers the screen's own show button, and
   without one the guide offers one button that starts it; the five
   **/screen-clear-** commands clear a layer the screen HOLDS even while it is
   off. **The commands that work on the Presenter alone** — the screen's show,
   hide and clears, **/selected**, **/next**, **/previous**, **/slide**, **/run**,
   **/verse**, **/countdown**, **/marquee** — are offered in the list only while
   **Asking about** is **Presenter**, and typed under another page they answer
   _works on the Presenter page_ with **Go to the Presenter** under it
   (**/commands** names them on one line there); the rest work everywhere,
   and anything the Reader has is on the Presenter too. Asked in words from
   the Bible Reader, _Is anything showing on the projector?_ says whether a
   screen is on and, under the answer, that the main window needs to be on the
   Presenter page to see what it holds — with the same **Go to the Presenter**
   button, which switches the main window and leaves the projector untouched;
   **/find Clear Long Text** outlines a control in red; **/goto reader** switches the
   main window (the projector is untouched); **/here** says which window is in
   front; **/help clear bible** searches this guide without an assistant;
   **/credit** says what this chat has cost so far (also **/cost**); **/limit**
   says or sets the hourly spending limit (**/limit 2**, **/limit off**, and
   **/limit more** to carry on after a pause); **/lyric https://…** reads a
   song page — a hymnal's text page, a chord sheet — and writes the song out
   for the Lyric Editor with its chords where the page puts them, and
   **/lyric** followed by pasted words writes those out (also **/lyrics**,
   **/hymn**, **/new-song**); either answers in a few seconds with what the
   song is and the two buttons — **Create "…"** and **Copy song text** — and
   the song text as it will be saved drawn above them, and NOTHING is saved
   until you press Create (an _Assistant read a page on hymnary.org_ notice appears in
   the app window while the page is read). **/lyric Amazing Grace** — a song's
   NAME on one line — looks it up instead: in your own songs, and in the
   app's collection of public-domain hymns (the ones
   **[en:tran:Import From Public Domain Songs]** brings in), and offers it under the same two buttons; a song
   that is in neither is said so, with a request for its words or a page,
   because the help window never writes a song out from memory. Asking in
   words does the same without an assistant — _Create a lyric file from
   https://…_ and _Create a lyric file for song "Amazing Grace"_ are answered
   by the built-in guide with the same buttons when no assistant can answer;
   **/btw what is the Bible?** is the one command that DOES ask the assistant
   — "by the way", a general question that is not about this app: it is
   answered from the assistant's own knowledge in one go, with nothing of the
   app looked up and no walkthrough offered (the quotes in `/btw "what is
holy bible"` are fine), and with no assistant to ask it says so and offers
   **Open AI settings**, because the built-in guide only knows this app. A
   plain question typed under it — _in Khmer please_ — stays general, so the
   conversation goes on without retyping **/btw** (any **/** command ends
   that, and a new tab starts fresh); ask the assistant something not about
   the app without it — or _how can I ask a general question_ — and it tells
   you to put **/btw** in front, which the 💡 tip line above the box says too;
   a question about what the Bible itself says is never answered with a page
   about something else — with no assistant answering, or typed after
   **/help**, _what bible verse talk about lover your enemy?_ is answered with
   how to search the Bible's own words in Bible Find, the words to try named,
   and _who wrote the book of Psalms?_ with how to ask an assistant, **/btw**
   in front; in the Bible Reader an assistant's answer to a verse asked for by
   its words ends with the same search and a **Show me Bible Find** button,
   whose card rings **[en:tran:Advance Bible Lookup]**;
   on LM Studio and Ollama a general question goes out with the model's
   thinking switched off, so it answers in seconds rather than in half a
   minute; a follow-up that names something of the app — a screen, a
   display, a slide, a verse — leaves the general chain and is answered as
   an app question, which is how _How do I cast the virtual display to a TV
   from my phone?_ under a **/btw** about casting still reaches the
   **[en:tran:Cast to a TV]** button; and **Escape** in the box, with no
   suggestion list open, empties it (with the list open it only closes the
   list). On a server of your own, _Create a lyric file for song "Amazing
   Grace"_ is looked up and written out by the app itself, with the same
   **Create** button, because a small local model is not handed the song
   tools; and on such a server _Turn off the screen for me_, _Turn the screen
   on_, _show verse 1 on screen for me_ or _put slide 3 on the projector_ are
   answered from the app's own state at once, with ONE button that does it —
   _Nothing to turn off_ when no screen is on (never a Clear), **Turn every
   screen off** when one is, **Put "(1)-Verse 1" on the screen** for a slide
   the selected song has — and _Show the next slide?_ or _show the previous
   slide_ the same way, naming the slide the arrow keys would go to and
   offering the one button that puts it up — and _Where is the button for
   Clear All_ is answered by the window itself, which looks for a control
   called that and outlines it in red where it is, with **Highlight again**
   under the answer (a name no control carries goes on to the assistant) —
   and a sentence that is not a
   slide of the song
   (_Put John 3:16 on the screen_) goes on to the assistant as before;
   **/commands**
   lists them all. The square buttons under a command's answer are
   commands too — _Turn the screen on_ under _nothing is showing_ — and pressing
   one writes the command into the chat as though you had typed it, so the word is
   there for next time. A command with a spelling mistake lists the real ones
   rather than guessing. 📸
   **One line above the box tells you something this window can do.** A 💡 and a
   short sentence — the picture button, the walkthrough cards, **Report**, **Alt+↑**,
   locking a tab. It is a different one each time the window opens, and clicking the
   line gives you another; the cursor goes straight back to the box, so reading one
   never costs you the question you were writing. 📸
   **The two small arrows at the end of that line walk them in order.** **›**
   goes to the next one and **‹** back to the one before, round and round, so
   you can read the lot in a quiet minute before a service instead of waiting
   for the right one to come up — and, more usefully, **‹** brings back the tip
   that changed while you were still reading it. (Clicking the sentence itself
   still picks one at random, which is the quick way to be shown something
   new.) 📸
   **The ✕ at the very end of the tip line puts it away for 30 days.** It comes
   back by itself after that. **Want the tips back sooner?
   Type /tips** in the box and ask: the line is back at once, and the answer
   gives you one tip straight away. 📸
7. **Show it, instead of describing it.** Beside the box are three buttons.
   **📎** attaches a picture or a file from your computer; **📷** takes a picture
   of the app as it looks right now; **🎯** lets you POINT — an outline follows
   your mouse over the app and the control you click is the one you meant.
   You can also paste a picture straight into the box (**Ctrl+V**) or drag a file
   onto the window. Whatever you attach shows as a small chip above the box, with
   an **×** to take it off again, and up to four can ride one question.
   **Each chip carries a number** — 1, 2, 3 — so you can say which one you mean
   in your own words: _in 2 the button is missing_, _compare 1 and 3_. The
   assistant is told which is which. A number stays with its chip: take a chip
   off and the others keep theirs, and the numbers carry on through the chat, so
   they still mean the same thing in the conversation above. Clicking a
   control to point at it does **not** press it — the app does not act on that
   click, so it is safe to point at **[en:tran:Clear Long Text]** and ask what it does. 📸
   **Press a chip to see what it stands for.** A control you pointed at is
   **circled in red** in the app window again, so you can find it after looking
   away; and **every file or picture opens** — big enough to read, right here
   over the conversation (press anywhere, or **Esc**, to close it).
   **Answers can carry them too.** When the assistant points you at a button or a
   file, it puts a chip under its answer as well: press it and the button is
   circled in the app, or the file opens.
   **Whatever opens, you can keep it.** Under every preview is **Download**,
   which saves the file into your **Downloads** folder and opens it there —
   a picture, a report, a song, anything. Beside it are **Copy**, which puts
   the picture or the words on your clipboard, and **Open folder**, which
   shows you where the file already lives. A file that is already in
   Downloads is opened rather than copied again, so pressing Download twice
   never leaves you with two of them. A kind this window cannot draw — a
   video, a PDF — opens as a card naming it, with the same buttons under it.
   Every picture chip also carries a small clipboard icon that copies the
   picture without opening it, so it can go straight into an email. 📸
   **Pictures are kept only while the window is open.** Close the help window and
   the conversation is all still there, but the picture itself is gone — the chip
   goes grey and says so. Ask again with a fresh one if you need to.
   **Some assistants cannot see pictures.** If the one you have chosen cannot, the
   window says so before spending anything and offers you one that can, in a
   single press.
   **And it can ask to be shown.** When the assistant cannot answer without
   seeing your screen it says so and puts the button right there — _Send a picture
   of my screen_, _Point at the control_, _Attach a file_ — so you never have to
   work out how to send it one. 📸
   **Read a study PDF one verse at a time.** In the Bible Reader's Resources panel,
   press the 🤖 beside a chapter PDF such as `JHN.3.pdf`. Its chat briefly
   describes the file. Press **[en:tran:Read]**; it asks which verse in that chapter to
   focus on, shows `1` as the typing example, and offers the first three verses plus
   **[en:tran:Full chapter]**. Each card puts one complete Bible verse with its
   printed cross-references and the matching explanation paragraph below it.
   Press a cross-reference to read that verse in its own card. Full chapter
   continues automatically, one verse card at a time, through the chapter's end;
   direct references to another Resources PDF may add that file's explanation
   and an **[en:tran:Ask about {name}]** button. The PDF's embedded text is
   not used because a legacy Khmer font can decode as unrelated Latin
   characters. If a visual reading repeats itself, the bad explanation is
   withheld and the exact installed-Bible verse remains. AI can misread a PDF page,
   so read the original Bible and PDF yourself too; **[en:tran:Hide for 30 days]** puts
   that caution away temporarily.
8. Under every answer is **Copy**, which puts that answer on the clipboard and says
   **✓ Copied**. Under every question of yours is **Ask again** — or just click the
   question itself — and the same words go back in the box, ready to be changed a
   little and asked again. 📸
   **Asked about reading the Bible from the wrong page?** A stray press is enough
   to leave the Bible Reader for the Presenter. Ask something like _how can I open
   bible_ or _where do I find the Bible to read_ while the main window is on the
   Presenter or the Document Editor, and the answer ends with one more line and
   one more button, **Go to the Bible Reader**: press it and the main window
   changes to the Bible Reader, and whatever is on the projector is left as it
   is. The **[en:tran:Bible Reader]** tab in the header at the top of the Presenter
   takes you there too. A question about showing a verse on the screen does not
   get it — that is what the Presenter is for.
   **And every answer has two thumbs beside Copy.** 👍 says the answer helped and
   👎 says it was wrong or did not help. The one you pressed stays filled, and
   pressing it again takes it off; the mark is kept with the chat on this
   computer and is sent nowhere. The first time you press 👎 under an answer the
   help window follows up by itself — no assistant is asked, so it costs nothing:
   it asks what was wrong, with three things to press (_A button it names is not
   there_, _The steps did not work_, _That is wrong for the window I am in_), and
   says what most often helps, a smarter model. When the assistant answering has
   one — **Claude**, **ChatGPT** and **Kimi** list theirs best first — a button
   **Ask again with …** names the next model up: it asks the same question of
   that model and leaves this chat on it, and the new answer says so, because the
   model above costs more. Pick another in the model list at the top to go back.
   On the best model already, on **Auto**, **Bedrock**, **Free** or a server of
   your own, it says in words what to try instead. **Typing that an answer is
   wrong** — _that is wrong_, _I cannot find that button_ — brings the same
   advice, and the same button, with the answer to it.
   **And what you clicked stays marked.** A card you click keeps a thin ring
   round it, and a button you press in it — a thumb, **Copy**, a walkthrough
   button — keeps a ring of its own, until you click somewhere else; **Tab**
   moves the same mark from the keyboard. A thumb pressed on an answer further
   up no longer makes the chat jump to its end.
   **And every answer says what it cost.** At the right-hand end of the line under each
   answer, the one with **Copy** and the thumbs, in small grey figures, is what the assistant spent answering — a few cents at
   most for an ordinary question, and the tokens it used — and a line under the
   three pickers at the top, **CREDIT USED**,
   keeps the running total for the whole chat: every question in this tab, including
   one you stopped part-way or one that failed, because the credit is spent whether
   or not an answer arrived. Each tab keeps its own total, and it is remembered with
   the rest of the tab. Hover either figure for the sums — how many times the model
   was called, how many tokens went in and came out, how much of that was served
   from the cache. The dollars are an **estimate from the model's list price**, so
   the bill from your provider is the figure that counts; a free service reads
   **free**, and a model this app has no list price for reads **price not known**
   with the tokens still counted. Nothing at all is shown until a question has been
   asked. The assistant itself cannot read these figures — it can only say where
   they are — so for the total in words type **/credit**, which answers from the tab
   itself with no assistant involved. 📸
   **And it cannot run up the bill on its own.** At the right-hand end of the
   pickers' own line, after MODEL, is **LIMIT PER HOUR**, a small list that starts on **$1** —
   the most the assistant may spend in any one hour, across every tab of this
   window. Beside it, once something has been spent, a figure says where the hour
   stands (*≈ $0.31 of $1 this hour*); it turns **amber** past four fifths of the
   cap, and the answer that crosses that line carries a *Heads-up* note. At the
   cap the assistant **pauses**: the next question is answered from this guide
   instead, under a note saying why, the figure reads *paused*, and an
   **Allow more** button appears in the note and in the top line. Pressing it
   starts the hour again with the whole limit available and asks your question
   once more; nothing else lifts a pause — not time passing, not a restart — because
   the point of it is that a fault which keeps asking cannot press a button.
   Pick a different amount from the list (**$0.25** to **$20**, or **No limit**)
   to change it; **No limit** keeps only the pace cap, which pauses after **150
   model calls in one hour** whatever they cost — more than a person asks for, and
   the one thing that protects a free service, which the money cap cannot see.
   **/limit** says all of this in words and **/limit 2**, **/limit off** or
   **/limit more** do the same as the list and the button. The figures are the same
   estimate the credit line is. 📸
9. **Something wrong with the app itself? Press Report.** Under **[en:tran:Send]** is a quieter
   **Report** button, for when the answer is not "how do I" but "this is broken".
   Say what went wrong in the box — one line is enough — and press it. It asks
   first, quoting back what it is about to report, with **Not now** beside
   **Report it**, so a mis-hit costs you nothing. (Press it with an empty box and it
   takes the last thing you asked, which after a wrong answer is usually what you
   mean.) 📸
   **Attach a picture or PDF to a problem report.** In this help window, type what
   went wrong into the question box, then use its paperclip to choose the picture,
   text file or PDF. Press **[en:tran:Report]** below **[en:tran:Send]**, then
   **[en:tran:Report it]** in the confirmation. Read the prepared report and its
   attachment list, then press **[en:tran:Send report]** when ready to send it.
   **Two more ways lead here, from the app window.** The **[en:tran:Help]** button's
   third row, **[en:tran:Report a Problem]** (the menu bar's Help menu has the
   same row), opens the help window on a card
   that asks what went wrong — or what you wish the app did better — with a
   **Report** button on it: type a line, attach a picture or a file if it
   helps (the paperclip takes pictures, text files and a PDF), and
   press **[en:tran:Send]** or **Report** — either starts it. From then on that tab IS
   the report: its name starts with **Report:**, and anything more you type
   or attach there is added to the report rather than answered as a
   question, until you press **Send report**. And when the app itself
   hits an error it asks first, **[en:tran:Something Went Wrong]**, with
   **[en:tran:Not Now]** beside **[en:tran:Report a Problem]**; say yes and the
   help window opens on a card naming the error, with the same **Report**
   button (type what you were doing first, if you remember — it goes into the
   report). Nothing is looked into before that press, and every one of these
   says first what a report carries: the app's version and build, this
   computer's system information, the window you are in and what is selected,
   what each screen holds, the app's console log, the end of the conversation,
   a picture of the app and any file you attach.
   **Say yes and it goes and looks.** It photographs the app as it stands, notes the
   version, the window you are in and what the screens are doing, reads the app's own
   error log (the errors and warnings the main window has logged, with the name of
   this computer's account taken out of any file path), and then investigates the
   problem in the running app. A few seconds
   later it comes back with what it found and a report written up in your place,
   with a **Send report** button under it — and, when you attached files, their
   names, so you see what would go. **Nothing is sent until you press that.**
   Thought of something more while it is still writing? Type it and press **Add**:
   it starts the write-up again with your new words in it, and what you attached
   earlier stays with it.
   **Not every problem is a fault in the app, so it helps first.** When what you
   describe looks like something you can put right yourself — a setting, a step
   that was missed — the answer is **Try this first** with the steps, and the
   question _Did that solve it?_ Press **That fixed it** (or just type _yes_) and
   the report is closed with nothing sent. Press **Still a problem — report it**
   and the report it wrote while you tried is put in front of you, saying what you
   were told to try.
   **Press Send report and it goes to the people who make the app.** The line under
   the conversation reads _Sending the report_ for a moment. When the app's
   maintainers have a report server open, the write-up goes straight to it together
   with its files — the picture of the app and whatever you attached: pictures, a
   PDF, text files, each up to 5 MB — and the answer starts **Sent**, with the
   report's reference and the names of the files that went. A file that could not
   go is named too, with why. Whatever happens to it, the whole report, with the
   picture, is also saved into your **Downloads** folder.
   **When the report server is not answering, the report is kept for later.** When the
   report server is there but not answering — the computer it runs on is asleep
   or restarting — the app KEEPS the report and sends it by itself as soon as that
   server is back. It tries a minute after the app starts and every half hour
   while it is open, for up to a week, and the answer says so, so there is nothing
   more you need to do.
   **When nothing was sent, email it.** When no report server is open at all, or it
   does not take the report, the answer says plainly that nothing was sent, and why,
   and tells you who wants it. It names the maintainers' email address and
   the subject line to use, and five buttons do the rest — **Copy report** puts the
   whole write-up on your clipboard, **Copy subject** the subject line,
   **Copy picture** the screenshot (paste it into the message and most mail apps
   attach it), **Copy email address** the address, and
   **Email it** opens your own mail app with the address and subject filled in (the
   report is on your clipboard, so paste it in and attach the picture from
   Downloads). The address is read from the app's help page at the time, and only
   when that cannot be reached does it fall back to the one built into the app —
   the answer says which. The saved file opens with the same "How to send this"
   section, so it still says where to go a week later. 📸
10. Ask **"where is …"** and name a button — the chatbot outlines it in **red** in the app
    window for a few seconds, and tells you where it is. Nothing is clicked for you. 📸
11. Ask about screens ("is any screen showing?") and the answer comes from the live app,
    not the manual — with a **Hide every screen** button offered, never pressed for you.
12. With an **AI key** set in **[en:tran:Settings]** → **[en:tran:Others]** → **[en:tran:AI Providers]**, the
    same window becomes a real conversation: the model answers, using the same app
    knowledge and the same tools. Without a key the **Free** assistant answers instead — a
    shared public service, weaker and sometimes busy — and when no assistant can answer
    (the internet is down, the service is busy) it still answers from the manual, and says
    so. A notice at the top of a **Free** conversation says that your questions leave this
    computer, and gives you an **Open AI settings** button that goes straight to the panel
    that takes a key. That panel has one card per provider, and
    each card says in plain words what its key is used for — **OpenAI** answers here and
    powers Bible Cross Reference and Bible Audio, **Anthropic** answers here and powers
    Bible Cross Reference, **Kimi** and **Amazon Bedrock** answer here only — so you can tell which key is
    worth getting before you go and fetch one. 
    **Play Bible audio automatically.** Open **[en:tran:Settings]** → **[en:tran:Others]** → **[en:tran:AI Providers]**, then open the **OpenAI** card and save an **OpenAI API key** there. Once that key is saved, this card shows **[en:tran:Auto Play Audio AI when available]**. Turn that switch on so supported Reader passages begin their generated audio automatically. A key for a different provider does not reveal or power this switch.
    **No internet?** The help window still answers from the manual by itself, and
    says so. The `/` commands still work, because they need no key and no
    internet. A server of your own on this computer (below) still answers in full,
    with a model that runs there — not one whose name ends in `cloud`.
    **Every part of the Others page of Settings folds.** Click a section's title —
    **[en:tran:AI Providers]**, **[en:tran:SongSelect Integration]**,
    **[en:tran:Extra Binaries]** — and it folds to one row, which still says whether it
    is set up (**[en:tran:Key set]**, **[en:tran:Installed]**) and keeps its buttons;
    click the title again to open it. Inside **[en:tran:AI Providers]**, each provider's card,
    **[en:tran:Custom servers]** and each server in it fold the same way: a folded
    card shows a green ✓ beside its name when its key is saved, a folded server when
    the chatbot is offering it. The app remembers what you folded. So when a key box
    or **[en:tran:Add server]** is not where this page says, the part holding it is
    folded — click its title. Choosing an assistant that needs a key (the next step)
    opens whatever is folded in front of its key box by itself.
13. The second list is **who answers** — **Claude**, **ChatGPT**, **Kimi**, **Bedrock**, and
    **Free**, which needs no key — and you
    can change your mind between two questions. The ones whose key you have set can be
    chosen; the others are still in the list, in a quieter colour and reading
    **needs an API key**, so you can see they are there and what they want. Choose one of
    those and the conversation stays on the assistant it had, while **[en:tran:Settings]**
    opens on **[en:tran:Others]** with the cursor already in that assistant's key box — for Kimi,
    **Kimi API Key** — ready for the key to be pasted in. If **[en:tran:Settings]** was
    already open on another page, that same window comes to the front and turns to
    **[en:tran:Others]**. Beside it is the third list, the
    **model** that will answer — **Opus 5**, **GPT-5**, **Kimi K3** — and it is a list
    you can change.
    Hold the mouse over a name to see what it is good for, how quick it is and what it
    costs, e.g. `gpt-5 · best answers · slower · $1.25/$10 per 1M tokens`; the smaller
    models answer a "how do I" just as well for a fraction of it. A model whose price the
    maker does not publish simply shows no price line rather than a guessed one. Choose **More models…**
    at the bottom of the list and the window asks your own account what else it can run
    and adds those too. Each tab keeps its own provider and model, and a new tab starts
    on the last pair you picked. 📸
    **Auto, the last row of that list, chooses for you — among the assistants that
    cost nothing.** Pick **Auto** and the tab stays on it: in front of every question
    the window looks at each of your own servers that costs nothing to ask (one on
    this computer or on the church's own network, or a shared one marked free) and
    asks the best assistant that can answer right now. A server that does not answer
    is left out. One that is already answering another chat tab, and one that has
    just failed or taken more than three minutes over an answer, go to the back of
    the line. Among the rest, a model whose name ends in `cloud` comes first
    (`gemma4:31b-cloud`, `gemma4:cloud`: Ollama runs it on its own computers, so it
    is quicker and stronger than one on a church machine, and your question leaves
    the building to reach it) — the biggest of them first, one whose name gives no
    size last. After those the bigger model is asked first, read off the size in
    its name (`9b`, `12b`); the **Free** service counts as 8B, so a server model of
    8B or more is asked before it and a smaller one after it — which keeps a small
    model of your own for the day the internet is down. On LM Studio only a model
    that is loaded is asked while one is, because asking for another would load it
    in place of yours. An assistant that needs a paid key is never asked by Auto.
    While it looks, the waiting line reads _Auto is checking which assistants can
    answer_ and then _Auto picked_ with the name; where the model list stood,
    **AUTO PICK** reads _chosen at each question_ until the first answer and names
    who answered after it. When the one it picked fails before saying anything, the
    next one is asked, and a small line over the answer says who could not answer
    and who did. Because the **Free** service may be the one that answers, an Auto
    chat carries a notice saying that your questions may leave this computer; pick
    one of your own servers by name, and a model of it whose name does not end in
    `cloud`, to keep every question in the building. Picking
    any named row ends Auto for that tab. **Auto is what a chat starts on** until
    you pick an assistant by name: the help window opens on it the first time, and
    so does every new chat after it. Once you have picked a named assistant, new
    chats start on that one instead, and picking **Auto** again brings it back. 📸
    **Your own AI server answers too** — LM Studio, Ollama, llama.cpp's `llama-server`
    or llamafile, LocalAI, Jan, GPT4All, vLLM, SGLang or a LiteLLM proxy on this
    computer or on another computer in the church, or any service that speaks the
    OpenAI API. In **[en:tran:Settings]** (the gear at the top of the app's main window, not this one) → **[en:tran:Others]** → **[en:tran:Custom servers]** —
    where, for anyone who has no server yet,
    **[en:tran:Watch how to set up a free AI assistant on your own computer]** is
    followed by **[en:tran:LM Studio videos]** and **[en:tran:Ollama videos]**, each
    opening a page of YouTube videos in your browser — press
    **[en:tran:Add server]**, give it a **[en:tran:Server name]** and its
    **[en:tran:Base URL]** — the address usually ends in `/v1`: LM Studio
    `http://localhost:1234/v1`, Ollama `http://localhost:11434/v1`, llama.cpp,
    llamafile and LocalAI `http://localhost:8080/v1`, Jan `http://localhost:1337/v1`,
    GPT4All `http://localhost:4891/v1`, vLLM `http://localhost:8000/v1`, SGLang
    `http://localhost:30000/v1`, LiteLLM `http://localhost:4000/v1`, or the other
    computer's name in place of `localhost`; a server that asks for a key (LiteLLM,
    vLLM started with one, Jan) takes it in **[en:tran:API key (optional)]** — then
    press **[en:tran:Test]** and **[en:tran:Load models from server]**. **To use it, return to the help window, select your server by its name in the second list (who answers), then select its model in the third list.** An address
    typed one path off is put right by **[en:tran:Test]**: Ollama's bare
    `http://localhost:11434`, an address without its `/v1`, or a door of the
    server's own such as Ollama's `/v1/systemone` is tried at the same computer and
    port's `/v1` and root, the one that answers is saved and the line reads
    _Address corrected to http://localhost:11434/v1_; when nothing there speaks the
    OpenAI API the line says so and names the usual addresses. The server then
    shows in the **who answers** list under its own name, with its models in the
    third list, and a question to it costs nothing when it is on this computer or
    on the church's own network. On LM Studio, Ollama and llama.cpp,
    **[en:tran:Test]** also writes under each model what that program says of it
    in its own words: **Not loaded in LM Studio right now** / **Not loaded in
    Ollama right now** / **Not loaded in llama.cpp right now** (a `llama-server`
    started on a folder of models loads one on the first question that names
    it), or **Loaded in Ollama. Context length: 4k** with the fix
    beside it — load the model again in LM Studio with a **Context Length** of
    32k, set **Settings → Context length** in the Ollama app (or start Ollama with
    `OLLAMA_CONTEXT_LENGTH=32768`), start `llama-server` again with `-c 32768` —
    because the assistant's instructions alone fill most of 16k, and a follow-up
    question runs out of room there. A server of your own is sent the essential
    tools only (14 of the 26 an online assistant gets, about half the words), so
    a cold round costs it half the reading; while it reads, the waiting line says
    _<server> is reading the instructions first — the first answer takes longer on
    a local model_, and a computer that takes more than ten minutes over it is
    told so — _this computer is too slow for that; a general question typed after
    /btw is small enough to answer here_ — rather than that the internet is down.
    A small local model sometimes writes its tool call as words — a
    `<tool_call>` or `<function=…>` block where the answer should be — and the
    window reads it as the call it is and carries on, instead of printing the
    block as the answer; one that does so on its last step is told as _it wrote
    no answer this time — a smaller question, or a larger model, usually
    helps_. Measured 2026-10-10 on the user's LM Studio box over the church's
    network (qwen/qwen3.5-9b at 16k through a proxy on another computer): the
    projector question answered correctly in about 30 s (two rounds, 6.3 s to
    the first token of a cold 10k-token round, under a second once cached,
    ~30 words a second), a follow-up in the same tab ran four rounds in about a
    minute, and **/btw what is holy bible** took 27.5 s with the model's
    thinking on (1 069 generated tokens for a 150-token answer) — which is why
    a general question's thinking is now switched off there.
    **A server shared by the project's own site needs no typing at all.** To use
    one, pick it in the **who answers** list at the top of the help window, as you
    would a server of your own; Settings only lists it. An
    admin who runs a capable computer can put its address in one file,
    `https://www.openworship.app/llm/info.json` (its shape is in the
    project's `docs/llm-registry` folder), and every copy of the app reads
    it when it starts: each server in it stands in the **who answers** list
    beside your own, its models in the third list, marked _shared by
    openworship.app_ and _free_ when the file says so, and never appears in
    **[en:tran:Custom servers]** — it is not yours to edit. It is listed
    right below that box instead, under **[en:tran:Shared servers]**
    (**[en:tran:Settings]** → **[en:tran:Others]**): each shared server with
    a lock beside its name and, opened, its models — to read, with nothing
    to type in and nothing to delete. Its address is not shown anywhere in
    the app: a shared server is for the app to ask, not an address to copy
    and use somewhere else. The small **↻**
    beside the **who answers** list reads the file again without a restart
    (hold the mouse over it to see when it was last read, or why a read
    failed — a failed read keeps the servers of the last good one), and the
    **↻** in **[en:tran:Shared servers]** does the same from Settings, with
    the time of the last read written under it. The address and a key the
    file carries stay on the computer's own side; neither window ever sees
    them. 📸
    How long a local answer takes is the computer's and the program's: one laptop's
    Ollama read 11 words a second on a 4-billion-parameter model, llama.cpp's own
    `llama-server` read the very same model file at 53 on the same laptop and
    answered an app question correctly in three and a half minutes, and a computer
    with a graphics card reads thousands. Each model has a **[en:tran:Sees pictures]** box
    — tick it for a model that can look at a picture;
    **[en:tran:Load models from server]** ticks it for you from LM Studio's and
    Ollama's own word (a `vision` model). A model the server does not have, an
    address that answers nothing, and
    a server whose API takes no tools at all (GPT4All's) is asked once more
    without them and the answer says it came from the guide text alone, with
    nothing checked in the window; a model that cannot use tools (Ollama says so; llama.cpp wants `--jinja`, vLLM
    and SGLang `--enable-auto-tool-choice --tool-call-parser`) are each said in the
    chat as that, never as _not available to the account_. If the server's computer
    is switched off or goes to sleep in the middle of a question, the answer stops
    within a minute or two and says to check that the computer is on and awake,
    instead of waiting on for ten. 📸
    **A key that cannot answer does not leave you with the guide while another of
    yours can.** When the assistant you chose is out of credit, refused, or its
    service is down, the question goes to the next assistant whose key you have set —
    once, at once — and the answer opens with a note saying so: _ChatGPT could not
    answer — the AI account is out of credit or being rate-limited. Claude answered
    instead and this chat now uses it; pick ChatGPT in the row above to switch back._
    The tab's own list moves to the one that answered, so the next question in it does
    not wait on the dead key again; a new tab still starts on the one you picked, and
    the moment that key works it answers as before. The **Free** assistant is never
    stood in for and never stands in — it is a choice you make yourself. With no
    other key, or when the internet itself is down, the answer comes from this guide,
    as before, under a note that says which. 📸
    **The note says what is wrong, and carries the door to it.** For a key that was
    refused, press **Open AI settings** under the note and paste a correct key into that
    assistant's box. The reason is read
    from what the provider actually said, not only from how loudly it said it: _the
    AI account is out of credit_ when the account is empty, _being rate-limited
    (asked too often)_ when it is a rate limit, _out of credit or being rate-limited_
    only when the provider said nothing more, _the API key was refused_ for a wrong
    or revoked key, _the AI service is overloaded_ or _having trouble_ when it is the
    service's own fault. And the first button in the row under the note takes you to
    the page that fixes it, in your browser — **Open ChatGPT billing** for an empty
    account, **Open AI settings** and **Open Claude API keys** for a refused key,
    **Open Kimi usage limits** for a rate limit, **Claude status page** when the
    service is down — named for the assistant that FAILED, so with two keys you top
    up the right one. Hold the mouse over the button to see the address it opens;
    pressing it opens the page and the window says _Opening … in your browser._ The
    **Free** assistant has no account to go to, so its button is **Open AI settings**,
    where a key of your own goes. 📸
14. Every answer offers **Show me step by step**. Press it and a numbered card
    appears in the corner of the app window itself, with the button for the current
    step **circled in red**: press **Next** on the card when you have done it, or
    just do it — clicking the circled button moves the card on by itself. **Back**
    returns a step, **✕** stops. Steps you have already done are not shown: asked
    from the Bible Reader, a recipe that starts "click the Bible Reader tab" starts
    at the step after it instead. 📸
    The help window **gets out of your way while the card is up**: it tucks itself
    down to the taskbar (the Dock on a Mac) the moment the walkthrough starts, so
    nothing it was sitting on top of is hidden from you, and it comes back on its own
    when you close the card. Only the help window goes: the app itself stays on
    screen. If you had already put it out of the way yourself, or it was not covering
    the app in the first place, it is left exactly where you had it. To fetch it back
    in the middle of a walkthrough, click it in the taskbar or the Dock, or press the **🤖**
    button again — that reopens the chat you were in, not a new one.
15. **Do it for me** runs the same walkthrough with the app driven for you: the
    card's button becomes **Do it**, and each press clicks the circled control (or
    types the text) and moves to the next step. One press per step — nothing runs
    ahead of you — and **Skip** does a step yourself. Anything that changes what
    the congregation sees is offered, never done for you unasked. 📸
    **It presses the button the step names, and nothing that merely resembles
    it.** A step about the drawing panel's _Clear_ does not press the projector's
    _Clear All_; when the only thing on screen is a look-alike, the card says
    what it can see — _the closest control on screen is "Clear All", which is not
    "Clear"_ — and asks the assistant instead. 📸
    **Something in the way is closed first.** With the Bible Lookup popup, a
    right-click menu or a floating panel over the control the step needs, the
    card rings the way out (the popup's red ✕) and says so; in **Do it for me**
    the first press closes it and the next does the step. A question the app is
    asking — _Ok_ / _Cancel_ — is never answered for you: answer it and the card
    carries on. 📸
    **A step that is something to notice reads Next, not Do it.** _The bar under
    the search box says how many verses matched_ has nothing to press; the card
    says so and the button moves you on. 📸
16. **When a step cannot be done for you, the card goes and asks.** Some steps are
    not a button — a double-click on a verse, something to watch happen, a control
    that is not on screen yet. The card used to say it could not do that one and
    leave you to it. It now asks the assistant, which looks at your window as it is
    right now and writes one line back onto the card telling you exactly what to do
    and where. It takes a few seconds, and the card says it is asking while it
    waits. With the help window closed there is nobody to ask, and you get the plain
    instruction instead. 📸
17. The window answers about the half of the app you are in — asked from the Bible
    Reader, you are told the reader's way, never the presenter's (they differ: the
    presenter looks a verse up in a **Ctrl+B** popup, the reader has no such popup).
    It follows you: switch the app to the other page and the next answer follows,
    unless you have chosen a half yourself in the first list. **Answers are in your
    language**: the one you write in, and the one the app is shown in whenever that
    cannot be told — a "yes", a number, a suggestion you pressed. With the app in
    Khmer the window's own buttons and labels are in Khmer too, drawn in the app's
    Khmer letters, and so is the AI Chat (✨) window. Behind the scenes, an assistant
    that is not a Gemma 4 model works in English: a Gemma 4 model running on this
    computer or your network puts your question into English and the answer back
    into your language, and the waiting line says so. A Gemma 4 model that answers
    is simply asked in your language. 📸

> With no key set, the **Free** assistant answers through a shared public service, so your
> questions and anything you attach leave this computer — the notice at the top of the
> conversation says so. The manual is bundled inside the app.

18. **It can turn words you already have into a song.** Paste the verses of a song
    into the box of this help window, where you type a question (not into the Lyric
    Editor) — from an email, from a hymn sheet, from a page you found — and ask
    for a song; or attach a `.txt` of the words with the paperclip; or give it the
    address of a page the words are on. One of the **Try asking** chips offers this
    outright: _Can you make a song from words I paste in?_ 📸
    The answer comes back in plain words — what the song came out as, its parts and
    the order they play in, and **what it had to guess**, which is usually the key,
    the tempo, the time signature and the author, because ordinary lyrics say none of
    those. Underneath it are two buttons: **Create "<the song's title>"** and
    **Copy song text**. 📸
    The song's own notation never appears in the chat, and you never have to type it.
    **Create** writes a real song into your documents list, ready to put on a screen,
    and answers with two things to press: **Show it in the list**, which draws a red
    ring round the new song's row in the app window behind, so you can see exactly
    where it landed; and the song's name, which opens it over the conversation, with
    **Open folder** under it for the folder it was written to.
    📸 It never replaces a song you already have: press it twice and the second is
    saved beside the first with `(1)` after the name. **Copy song text** puts the same thing on the clipboard, to paste
    straight into the Lyric Editor.
    Labels help it: write `Chorus`, `Verse 2`, `Bridge` or just `1.` and `2.` above
    the blocks and it uses them. Without labels each block becomes a verse, and a
    block repeated word for word is written once and sung each time it appears. Chord
    lines above the words are left out — Open Lyric puts chords inside the words —
    and a section it cannot make sense of is kept whole, with your own label above it,
    rather than dropped. If you paste something that is not a song, it says so instead
    of inventing one.
    **On a server of your own, type /lyric first.** A server of your own is sent no
    song tools, so pasting the words and asking does not write the song there: type
    **/lyric** first and paste the words after it in the same message. Press **[en:tran:Send]** or **Ctrl+Enter** to submit it; the app then writes them out itself, with the same two buttons.
    **Those two buttons are the only thing to press.** The assistant sometimes
    writes its own suggestions under an answer, but under a song it never repeats
    the buttons in other words — _Create the file_ or _Copy the text_ are not
    offered, because the real buttons are right there and do the job without
    asking anybody. 📸
    **Pasted words become a song even when the assistant cannot answer.** With the
    assistant out of credit, or refused for asking too often in a minute (a free
    Kimi account allows about three questions a minute), a paste of song words is
    written out by the app itself in a second or two, under a note that reads
    _I wrote the song out myself instead_ — with the same **Create** and **Copy
    song text** buttons, and nothing searched in this guide for the words. 📸
19. **Name a song, or give the address of a song page, and it is written out for
    you.** The fourth **Try asking** chip is not a question but the start of one:
    _Create a lyric file for song "Amazing Grace"_. Pressing it does not ask
    anything — it drops the sentence into the box with the cursor in it, so you can
    press **Ctrl+Enter** as it stands or swap the title for the song you want. 📸
    A song asked for by its NAME is looked up, never remembered: first in your own
    songs (if you already have it, the answer says so before making a second copy),
    then in the app's collection of public-domain hymns — the same texts, with the
    same link back to where they were transcribed from, that
    **[en:tran:Import From Public Domain Songs]** brings in. A song that is in neither — most songs written in the
    last seventy years — is said so plainly, with the nearest hymn titles when there
    are any, and a request for its words or for the address of a page with it on.
    The address is the other way in: _Create a lyric file from
    https://example.com/lyric/amazing_grace_ is in **More…**, and works the same
    way — swap the example address for the one you have. A banner appears in the
    app window naming the site while it reads.
    A song page is never just the song: there is a toolbar above it, a strumming
    diagram, a fretboard chart at the bottom, a row of related songs and the site's
    own footer — and the words themselves are laid out in columns, with the chords
    over them, which comes out as one broken fragment per line. It sorts all of that
    out on its own. It finds the part of the page the song is on, puts the fragments
    of each line back together, and reads the **key, tempo and time** off the page
    when the page prints them.
    **The chords come with the song.** Each one is written into the line at the
    syllable the page puts it over, the way Open Lyric writes chords, so what you get
    is something a musician can play from rather than the words on their own. Where
    the page prints a chord it cannot place — a whole row of them above a line, or
    the fretboard chart at the bottom — it leaves that one off rather than guess,
    because a chord over the wrong syllable is worse than a chord left out. Verse and
    chorus labels are used as written, a `(2x)` beside one is read as _sing it twice_,
    and a line like _Repeat Chorus_ is read as the play order rather than as another
    copy of the words.
    **A hymnal's text page works too.** Such a page has no chords at all: the
    stanzas are printed numbered, `1`, `2`, `3`, in the middle of the site's menus,
    and the song's own facts sit in a table far below them. The numbered stanzas
    are taken as the song and nothing else, and the **title**, **author** and
    **copyright** — _Public Domain_, for a hymn — are read off that table, with
    the page's address kept with the song as its source. 📸
    **A song printed in two languages stays in two languages.** Where a page prints
    the meaning underneath the line that is sung, the two are kept paired, so the
    slide can show both.
    **The copyright line on the page is kept with the song**, in its `Copyright`
    field, so whoever opens the file later can see whose song it is. Most pages
    print that at the very bottom, a long way from the words, and it is read from
    there. **The address of the page is kept too**, in the song's `Attachments`,
    so anyone who opens the file can go and look at where the words came from.
    **You can read the song before you make it.** The text of the file appears in
    a box above the two buttons, exactly as it will be saved, so nothing is
    created out of sight. (If you closed the help window since the song was
    drafted, the box is not there — ask again and it comes back.) Whether your
    church may sing it is your own licence and your own decision — the app copies
    nothing anywhere and sends nothing to anyone, and no file is written until you
    press **Create**.
    Because it is a guess about someone else's page, the answer always says **which
    part of the page it used**, quoting the first and last line it took and how many
    lines of menus and links it left out. Read that line. If it took in too much or
    stopped too early, say so in your own words — _the song starts at "…" and ends at
    "…"_ — and ask again. Everything else is the same as pasting the words yourself:
    the two buttons underneath, and nothing written to disk until you press
    **Create**.
20. **[en:tran:Enable AI features]** turns all of this on or off. It is in
    **[en:tran:Settings]** → **[en:tran:Others]**, at the top of the
    **[en:tran:AI Providers]** section (click the section's title if it is folded). To
    turn the whole feature off, untick it and restart the app: the chatbot, its tools
    and the debugging endpoint they use are then never started. Tick it and restart to
    turn it back on.

_Verify: CB-01, CB-02, CB-03, CB-04, CB-05, CB-06, CB-07, CB-08, CB-12, CB-13, CB-14, CB-15, CB-26, CB-27, CB-28, CB-29, CB-31, CB-32, CB-43, CB-46, CB-48, CB-62, CB-66, CB-71, CB-83, CB-84, CB-85, CB-86, CB-87, CB-90, CB-97, CB-121, CB-122, CB-123, CB-124, CB-126, CB-127, CB-128, CB-129, CB-130, CB-134, CB-135, CB-136, CB-137, CB-138, CB-139, CB-140, CB-143, CB-153, ST-67, ST-68, ST-69, ST-70, ST-71, ST-72, ST-73, ST-74, ST-78._

### W-47 — Put messages on the screen

**Goal:** put up the words everyone needs to read around a service that are not
slides — a parking notice, an offering notice, a call for the next speaker.

1. Open the **[en:tran:Foreground]** tab. The launcher that opens is a menu of
   components, and the first row in it is **[en:tran:Messages]** — it is first
   because it is the one you open in a hurry.
2. **Write your messages.** Press **[en:tran:Add Message]** for each one. Every
   message gets its own box and can be **as many lines as you like** — a line
   break in the box is a line break on the screen. After typing in the second
   box, the first message still has the words you gave it. The arrows beside a
   box move that message up or down the list — and on the screen too, if it is
   up there; the ✕ removes it.
3. **Put one up.** Press the screen button on a message's own row. It appears
   over whatever is already on the screen — the slide, the verse, the background
   — and it **stays there until you take it down**. There is no delay and no
   countdown: nothing removes it but you. Press the same button again to take it
   off; it now reads _hide_.
4. **Several at once.** Show a second message and it sits **underneath** the
   first rather than on top of it, however many lines each one has — a long line
   the screen wraps onto two counts as two. Hide the one above and the one below
   moves up to close the gap. If they would run off the bottom of the screen,
   they are made smaller together until they fit. This is how you put a parking
   notice and an offering notice up together.
5. **The whole set.** **[en:tran:Show All Messages]** puts every message up at
   once as one block — made smaller, too, if it would not fit on the screen. It
   takes the place of any of them you showed one by one, and showing one again
   takes the block down, so the same words are never on the wall twice. Tick **[en:tran:Rotate]** first and a seconds box appears:
   now the same button shows them **one at a time**, cycling until you hide it.
   That is the notice board before a service.
6. **Make it look like a notice.** Open **[en:tran:Properties]**, then the
   **[en:tran:Effects]** fold under it. **[en:tran:Padding]** is the room between
   your words and the edge of the coloured box behind them — it starts at a
   quarter of a text size, and because it is measured in text sizes the box keeps
   its shape when you change **[en:tran:Font Size]**. Add a
   **[en:tran:Border]** to frame it, a **[en:tran:Shadow]** to lift it off the
   picture, **[en:tran:Text Align]** to centre it, and a
   **[en:tran:Text Shadow]** of **[en:tran:Outline]** when the message has to be
   read over a busy photograph or a moving video. Changing any of them while
   messages are showing restyles them where they stand and keeps them stacked. 📸
7. **F4** is the shortcut while the **[en:tran:Messages]** panel is open: with a
   screen ticked it puts the session up, and
   pressing it again takes everything down. If no screen is ticked it tells you
   so rather than guessing.
8. The text is plain. Typing `<b>loud</b>` puts those angle brackets on the
   screen exactly as you typed them; a message is never treated as formatting.
   Use the save buttons at the top to keep a whole session — every message in it
   — and pick it back next week.

_Verify: PM-134, PM-135._

### W-48 — Give a slide, a song, a background or an overlay its own transition

**Goal:** have one song zoom in, one slide cut in, one canvas item fade, the
pictures fade and the countdown slide in — instead of everything changing the
same way.

How it works everywhere: the screen's **Tr:** row (W-10) is the fallback. Any
of the levels below can tick **[en:tran:Own transition]** and pick
**[en:tran:No Transition]**, **[en:tran:Fade]**, **[en:tran:Slide In]** or
**[en:tran:Zoom]**; the most specific ticked level wins. Every override selector
shows four icon buttons: a ban sign for **[en:tran:No Transition]**, shading
for **[en:tran:Fade]**, a slide against an edge for **[en:tran:Slide In]**, and
outward arrows for **[en:tran:Zoom]**. Hover an icon to
read its translated name; the selected one is highlighted. Unticked, the
buttons are disabled and show the inherited choice and what it **follows** —
the screen, the document, the tab or
the whole panel — so you can always see what will happen. A canvas item follows
its slide, then its document, then the screen when its own choice is unticked.

1. **A whole song or slide document.** In the slides preview, press the ⋮ at
   its top right (for a song, the ⋮ in the Stage Previewer header works too)
   and choose **[en:tran:Transition]**. The row says what it does now, e.g.
   _Transition: Fade (Screen setting)_. In the box that opens tick
   **[en:tran:Own transition]**, pick **[en:tran:Zoom]** and press
   **[en:tran:Ok]**. Every slide of that document now comes in zooming, on
   every screen. A cyan round button with the effect's icon appears beside
   the preview's top-right ⋮. Its tooltip names the effect. Press it to change
   or untick the document's choice. It disappears when the document follows
   the screen
   again. 📸
2. **One slide.** Press the ⋮ on that slide's card (or right-click it) and
   choose **[en:tran:Transition]** — it reads _Zoom (Slides preview)_, because
   it follows its document. Tick **[en:tran:Own transition]**, pick
   **[en:tran:No Transition]**, press **[en:tran:Ok]**. The same cyan effect
   icon appears in the card's header; press it to change or untick the
   slide's choice. Background attachments keep their separate grey icons.
   Tooltips show the full effect name, including on small cards. 📸
3. Present the slides. Each slide leaves the way it came in: going from a
   zoomed slide to the cut-in slide, the new one is there at once while the old
   one zooms away.
4. **A Background tab.** Right-click **[en:tran:Images]** (or
   **[en:tran:Colors]**, **[en:tran:Videos]**, **[en:tran:Cameras]**,
   **[en:tran:Webs]**) and choose **[en:tran:Transition]**. Ticked, every
   background from that tab comes in that way; the tab shows the effect's icon
   after its name.
5. **One background.** Press the ⋮ on a picture, video or web tile (right-click
   a colour swatch, a camera or a web link) and choose
   **[en:tran:Transition]**. It follows its tab until you tick it; a picture or
   video tile then shows the effect's icon in its corner.
6. **A foreground panel, all its sessions.** Each foreground panel
   (**[en:tran:Countdown]**, **[en:tran:Quick Text]**, **[en:tran:Marquee Top]**
   …) has a transition button in its title bar, next to the collapse arrow.
   Press it, tick **[en:tran:Own transition]** and pick one: every session of
   that panel uses it.
7. **One session.** Open the panel's **[en:tran:Properties]**: the
   **[en:tran:Transition]** row has the same checkbox, for the session you are
   on (Default, Session 2 …). It wins over the panel's button. A change applies
   the next time you show it — what is already up keeps the way it came in.
8. A marquee band that has no transition of its own keeps sliding in from its
   edge; **[en:tran:Slide In]** is that same slide.
9. To go back to the screen's transition, open the same box and untick
   **[en:tran:Own transition]**. Nothing is kept once every level is unticked.
10. The choices travel with the document: renaming it, moving it to the trash,
    and sharing it as an archive take its transitions along.
11. **One canvas item.** Open the document in the **[en:tran:Slide Editor]**,
    select an item on the canvas or in **[en:tran:Canvas Items]**, and open
    **[en:tran:Properties]**. **[en:tran:Canvas item transition]** is visible
    above **[en:tran:Box Properties]**, even when that group is collapsed.
    Tick **[en:tran:Own transition]** and pick **[en:tran:Fade]**,
    **[en:tran:Slide In]**, **[en:tran:Zoom]** or **[en:tran:No Transition]**.
    Untick it to follow the slide's choice again. **[en:tran:Undo]** and
    **[en:tran:Redo]** restore the choice; **[en:tran:Save]** keeps it in the
    document. 📸
12. Present that slide, then another. Each item enters and leaves with its
    own effect; items without a choice follow the slide, document or screen.
    **[en:tran:No Transition]** cuts immediately. Rotation and position stay
    as authored. These effects run when changing slides, including clearing
    the current slide. A slide with no item overrides keeps its whole-slide
    transition.

_Verify: PM-154, PM-155, PM-156, SP-06, ED-54._

---

### W-49 — See every keyboard shortcut for this page (Help → Keyboard Shortcuts)

**Goal:** find the key for something without hunting through tooltips, and
learn the keys of the page you are on.

1. On the menu bar, open **Help → [en:tran:Keyboard Shortcuts]**. It sits
   under **[en:tran:Tips of the Day]** and **[en:tran:All tips]**.
2. A floating panel opens titled **[en:tran:Keyboard Shortcuts] ·** and the
   page you are on — **[en:tran:Presenter]**, **[en:tran:Bible Reader]** or
   **[en:tran:Slide Editor]**. The cursor is already in
   **[en:tran:Search shortcuts]**. Each row says what a key does on the left
   and shows the key on the right; a key with two spellings shows both
   (**[en:tran:Redo]** is `Ctrl+Shift+Z` and `Ctrl+Y`). A grey line under a
   heading or a row says when the key works — for example
   **[en:tran:While the slides panel has focus]**: the slide arrows only move
   the slides after you click into the slides panel — or after three quick
   presses, the row
   **[en:tran:Take the keys back to what is being presented]** (W-49b).
3. Each page lists its own keys. The Presenter starts with
   **[en:tran:Screens]** (`F5` shows or hides the selected screens, `F6`–`F10` clear them,
   `F4` the messages), then **[en:tran:Slides]**, **[en:tran:Bible Lookup]**,
   **[en:tran:Presenting Flow]**, **[en:tran:Long Text Show]** and the mini
   screen's
   **[en:tran:Drawing]** and **[en:tran:Focusing]** keys. The Bible Reader
   lists the lookup and split keys, and the Slide Editor the canvas keys.
   Every page ends with **[en:tran:Every window]**,
   **[en:tran:Presenting Control]** and **[en:tran:Dialogs and menus]**. On a
   Mac the keys are shown the Mac way (`⌘⇧ S`).
4. Type a word or a key — `clear`, `split`, `f5` — and the list narrows to
   the rows that match; the counter beside the box shows how many of the
   page's keys matched. **[en:tran:No shortcuts found]** means nothing did.
5. **Esc** in the box empties it; a second **Esc** closes the panel, and so
   does its **✕**. Drag the title bar to move the panel, drag an edge to
   resize it, and use the chevron to roll it up to its title. It opens again
   where you left it.
6. The panel does not take the keyboard away from the app: with it open,
   every key it lists still works, so you can read a key and try it. Only
   typing in its own search box stays in the box — Enter, Tab and the arrows
   there do not reach the page behind it, while a function key such as `F5`
   or a `Ctrl` key still does.
7. **With the Bible Lookup open.** In the Presenter or the Slide Editor,
   open **[en:tran:Bible Lookup]** (`Ctrl+B`) and then **Help →
   [en:tran:Keyboard Shortcuts]** — or open the lookup while the panel is
   already up. The panel sits over the lookup popup, its title changes to
   **[en:tran:Keyboard Shortcuts] · [en:tran:Bible Lookup]**, and it lists
   only the keys that work inside the lookup: typing a reference, completing
   it, splitting, saving, **[en:tran:Close the Bible Lookup popup]**
   (`Ctrl+Q`) and the dialog keys. The page's own keys (`F5`–`F10`, the
   slide arrows) do nothing while the lookup is open, so they are left out.
   Close the lookup and the panel goes back to the page's list.

_Verify: KB-61, KB-62, KB-63, KB-64, KB-65._

---

### W-49b — Run the slides from a presenter remote (get the keys back without a click)

**Goal:** keep moving to the next slide from a remote, or from the keyboard,
when you cannot walk back to the computer to click a panel.

1. **Space**, **→**, **↓** and **Page Down** — the keys a presenter remote
   sends for _next_ — move a panel only while that panel has the keys: the
   presenting flow's preview panel (W-22b), the slides in the middle of the
   Presenter (W-03), a floating **[en:tran:Slides]** preview of another
   document, or the lit part of a **[en:tran:Long Text Show]** (W-53). One
   click anywhere else — a document in the list, a button under
   a screen — and the keys go to what you clicked, so the remote seems dead.
2. **Press the key three times quickly** — inside a second and a half. The
   keys go back to what is being presented. That third press only hands the
   keys over: nothing on the screen changes. The **next** press moves on.
   If nothing happens, check whether a slider has focus or the cursor is in the
   open **[en:tran:Bible Lookup]** box: three presses leave those controls alone.
   Also check that one of the four panels below has something being presented.
3. **Which panel takes them** — the first of these that has something going:
   - a presenting flow's preview panel whose run has started (one of its
     lines wears the outline);
   - the slides in the middle of the Presenter, while one of that document's
     slides is on a screen;
   - a floating **[en:tran:Slides]** preview, while one of its slides is on a
     screen;
   - a **[en:tran:Long Text Show]** whose text is on a screen with one of its
     parts lit: the keys go to that part's button, on the top card.

   So with a running order started and a song on the screen as well, it is
   the running order that takes the keys. When none of the four has anything
   going, three presses change nothing — there is nothing a key could move —
   so click what you want to present first.
4. **Nothing at all has the keys** — you closed the panel you were in, say:
   there is no need for three presses. The first press goes to the same
   panel, in the same order, and moves it on.
5. **What the three presses never take the keys from:** a slider, or an open
   **[en:tran:Bible Lookup]** with the cursor in its box — there the keys keep
   doing what they do. And a panel that is already moving is left alone
   however fast you press: stepping quickly through a song never jumps you
   over to the running order.
6. **Help → [en:tran:Keyboard Shortcuts]** lists this under
   **[en:tran:Slides]** as
   **[en:tran:Take the keys back to what is being presented]** (W-49).

_Verify: KB-66, KB-67, KB-68._

## Screen Mirror

### W-50 — Present on another computer with Screen Mirror

Use one app as the host and another as the guest. Both computers need the same
app version and a reachable network connection — the same network, or the
internet once the host opens to it (step 7).

1. On the host's Presenter, click **[en:tran:Mini Screen Options]** — the ⋮
   at the bottom right of the Mini Screen list — and in the menu it opens
   click **[en:tran:Virtual Screens Manager]**, then pick the floating
   panel's **[en:tran:Screen Mirror Connection]** tab. The panel remembers
   which tab was open and whether it was open at all. Hosting is off until you
   turn on **[en:tran:Let other computers connect]** at the top of the tab —
   until then no other computer can find or join this one.
   Once it is on, the panel shows **[en:tran:Host addresses]** and
   **[en:tran:Port]**: the app serves HTTP and WebSocket on an available port
   from 39240–39259, and the switch stays on for the next launch. Under
   **[en:tran:This network]** each address of this computer is written as
   `address:port` (for example `192.168.1.3:39240`) with two buttons:
   **[en:tran:Copy address]** puts that text on the clipboard, and
   **[en:tran:QR code]** shows it as a QR code under the row. The code holds
   the same plain text, not a link, so a phone that scans it offers the words
   to copy. **[en:tran:Copy image]** under the code copies it as a picture,
   with the address written beneath it, to send to whoever sets up the guest.
2. On the guest, open the **[en:tran:Screen Mirror]** page. It has no app
   header, only a top bar: **[en:tran:Presenter]** at its left goes back, and
   the cup at its right is **[en:tran:Stay Awake]** — on unless you switch it
   off, it keeps this computer from sleeping for as long as the page is
   open, which is what a computer standing in for a projector needs. The page
   looks for hosts as it opens, listing them under
   **[en:tran:Hosts on this network]**; **[en:tran:Rescan]** looks again.
   The scan asks on every network this computer is on, at every port from
   39240 to 39259; a host that answers on several networks is listed once,
   on its best address (a real LAN before a virtual adapter or loopback), and
   the first host is filled into **[en:tran:Host address]** and
   **[en:tran:Port]** under **[en:tran:Connect by address]** — never over
   an address you typed or a host you picked. Pick another host or type an
   address if needed, then click **[en:tran:Connect]**. An address someone
   sent you needs no retyping: **[en:tran:Paste address]** fills
   **[en:tran:Host address]** and **[en:tran:Port]** from whatever was
   copied — `address:port`, a whole `http://` link, an IPv6 address in
   brackets, or a picture of the host's QR code — and
   **[en:tran:Read QR code]** does the same from a picture file you choose.
   Pasting `address:port` straight into **[en:tran:Host address]** splits it
   too, and a picture pasted anywhere in the form is read as a QR code. A
   clipboard with no address in it reads
   **[en:tran:No host address found in the clipboard.]** and leaves the form
   as it was. In approval mode the guest reads
   **[en:tran:Waiting for host approval]** while the host clicks
   **[en:tran:Allow connection]** in the floating panel.
3. The guest reads **[en:tran:Connected]**, and under
   **[en:tran:This computer]** its monitors carry the prefix the host knows
   it by, such as a1 — the name to pick in the host's display picker. The
   host lists it under
   **[en:tran:Connected guests]** above the Mini Screen previews and at the
   top of their list menu. Each guest has a stable prefix such as a1 or a2;
   click its header button to open the floating panel, on the tab it was last
   on (the guest's row in the list menu opens it on
   **[en:tran:Screen Mirror Connection]**). In the panel every
   guest and every request carries where it came from:
   **[en:tran:This network]** for a computer on one of the host's own
   networks, or **[en:tran:Internet]** — a globe and an amber border — for
   one from outside. The header button of an internet guest is amber with a
   globe as well.
4. Choose the guest's prefixed monitor in the screen card's display picker.
   Present a slide and a background image, then use the card's show control
   (F5). The guest opens the presentation output on that monitor, in front
   of its own app window. Images and
   other host files load through the host's HTTP service; the guest does not
   need its own copy of them. They load from the address the guest dialled,
   so a guest that reached the host through a router gets them through that
   router too.
5. Close the floating panel with its **✕**, or toggle
   **[en:tran:Virtual Screens Manager]** again. The connection and its
   header entry stay active. To end the connection, use
   **[en:tran:Disconnect]**. The guest output closes and its entry leaves
   the host's connected-guest header.
6. In **[en:tran:Background]** → **[en:tran:Cameras]**, the host also lists
   connected guests' cameras with their prefixes. Selecting a camera streams
   it to the host preview and to the selected guest output. Selecting an
   image instead releases the camera stream. Camera access must be available
   on the computer providing it, and a guest offers its cameras only once
   **[en:tran:Share my cameras]** — the camera button in that host's panel on
   the guest's **[en:tran:Screen Mirror]** page, off for every new link — is
   turned on.
7. To let a guest connect from outside this network, turn on
   **[en:tran:Open to the internet]** under
   **[en:tran:Let other computers connect]**. It is off until you turn it
   on, and remembered. A warning says that anyone with the address can ask to
   connect and that the connection is not encrypted (folded to one line; its
   chevron, or a click on it, shows it all — the router and tunnel notes fold
   the same way, and each stays as you left it): choose
   **[en:tran:Require connection code]** under **[en:tran:Guest access]**,
   and turn the option off when you are done. The host asks the router to
   forward its port (UPnP); once **[en:tran:The router opened the port.]**,
   an **[en:tran:Internet]** list shows the router's public address marked
   **[en:tran:Router]**, and any global IPv6 address of this computer marked
   IPv6 — which works only if the router lets incoming connections through.
   When no router answers, or it refuses, the panel says so and shows the
   port and this computer's address to forward by hand on the router;
   **[en:tran:Ask the router again]** tries once more. A public address or a
   DDNS name typed into **[en:tran:Public address (optional)]** and saved
   with **[en:tran:Save address]** is listed too. Every internet address has
   the same copy and QR buttons. A router that sits behind another network
   (carrier NAT) cannot be reached from the internet at all; the panel says
   so and suggests a VPN such as Tailscale instead. Turning the option off
   removes the router's port forward and ends every guest that came from the
   internet — the ones on this network stay. While it is off, a computer
   outside this computer's own networks is refused. Five wrong connection
   codes from one sender lock it out for ten minutes.
8. A guest can be linked to several hosts at once. Once one is connected,
   **[en:tran:Hosts on this network]** and **[en:tran:Connect by address]**
   stay under its panel: pick or type another host and click
   **[en:tran:Connect]** again. Each host gets a panel of its own — its own
   status, the prefix that host gave this computer, and a
   **[en:tran:Disconnect]** that ends only that link. A host already linked
   reads **[en:tran:Connected]** in the list and cannot be picked again;
   connecting to it a second time by address is refused with
   **[en:tran:Incompatible or duplicate connection]**. A link that failed —
   a wrong code, say — keeps its panel with the reason, and its host can be
   picked again to retry. Two hosts can each show a screen on this computer
   at the same time.

_Verify: SP-25, SP-26, SP-27, SP-28, SP-29, SP-32._

### W-51 — Show screens on a virtual display and watch it from another device

A virtual display is a monitor that exists only inside the app. Screens are
shown on it exactly as on a real monitor, and any phone, TV or computer can
watch it — in a web browser, or as a video in a media player — without a
cable or a second copy of the app.
1. On the Presenter, click **[en:tran:Mini Screen Options]** — the ⋮ at the
   bottom right of the Mini Screen list — and in the menu it opens click
   **[en:tran:Virtual Screens Manager]**, then pick the floating panel's
   **[en:tran:Virtual Displays]** tab (it opens on the tab it was last on). The screen card's display picker gets
   there too: its last row, **[en:tran:Manage Virtual Displays]**, opens the
   same tab.
2. Click **[en:tran:Add Virtual Display]**. A display named
   **[en:tran:Virtual Display]** and its number is added at 1920 × 1080 with a
   black wallpaper, and its card opens. Up to eight can exist; a deleted
   display's number is never given to a new one, so an address someone saved
   never shows them a different display.
3. The card's header shows the name, the size and what it is doing:
   **[en:tran:Idle]** while nobody watches, **[en:tran:Live]** with the number
   of people watching. Its chevron folds the card. Inside,
   **[en:tran:Settings]** holds **[en:tran:Name]** (saved when you leave the
   box or press Enter), **[en:tran:Resolution]** — a size from the list, or
   **[en:tran:Custom]** with **[en:tran:Width]**, **[en:tran:Height]** and
   **[en:tran:Apply]** — and **[en:tran:Wallpaper]**:
   **[en:tran:None (black)]**, **[en:tran:Color]** (a colour box),
   **[en:tran:Image]** or **[en:tran:Video]** (each with
   **[en:tran:Choose File]**; a file that has gone reads
   **[en:tran:File not found]**). A video wallpaper plays on a loop, without
   sound. While someone watches, the card warns that changing the
   resolution restarts the stream for everyone watching — their player stops
   and has to be opened again. **[en:tran:Settings]** and
   **[en:tran:Where to watch]** each fold under their title; the card and both
   parts stay folded or open as you left them, also after a restart.
   **[en:tran:Preview]**, at the top of the card, shows the display inside it.
4. In a screen card's display picker, choose the display — it is listed as
   its name, **[en:tran:Virtual]** and its size, such as
   `Virtual Display 1 (Virtual): 1920x1080`. Present something and use the
   card's show control (F5): no window opens on any monitor; the screen shows
   on the virtual display instead, over its wallpaper. Several screens on one
   display are stacked in the order they were shown, the way they would be on
   a real monitor, and the card says so while they are.
   **[en:tran:Screens on this display]** under **[en:tran:Settings]** lists
   them. With no second monitor plugged in, songs and new slides are laid out
   for the virtual display's size, so they fill it. A screen showing on a
   virtual display is showing again, with what it held, when the app starts
   next time, so its viewers are not left on the wallpaper; hide it (F5) and
   it stays hidden. A screen on a real monitor never comes up by itself, and
   going to the Bible Reader, which hides every screen, keeps them all
   hidden.
5. Sound from a screen on a virtual display goes into what the display
   streams, not out of this computer's speakers: the Mini Screen's
   background audio player for that screen stays muted, but its play, pause,
   position and volume still drive the sound the viewers hear.
6. **[en:tran:Where to watch]** starts with the address to give someone,
   marked with a star and its QR code already open: this computer's best
   network (a router's 192.168 before a VPN or a virtual adapter), and any
   internet address you opened. Each address has **[en:tran:Copy address]**
   and **[en:tran:QR code]** (the code holds the whole link). The starred
   address sits under **[en:tran:Watch in a browser]**; every other address,
   and the MP4 ones, fold under **[en:tran:More addresses]**. A phone or a computer
   opens an address. A TV is reached with **[en:tran:Cast to a TV]** instead, the cast icon
   in the display card's header (step 8): choose the TV in its list and press **[en:tran:Cast]**. The two kinds:
   - **[en:tran:Watch in a browser]** — `http://<address>:<port>/vd/<number>/`.
     The browser draws the display itself from what the app sends it, so it is
     the fastest way to watch, and this computer encodes nothing for it.
   - **[en:tran:Video for media players (MP4)]** (folded under **[en:tran:More addresses]**) —
     `http://<address>:<port>/vd/<number>/video`, an H.264 + AAC MP4 for a
     player such as VLC or OBS. It is made only while someone plays it.

   **Use the display in VLC or OBS.** Choose the virtual display in a screen card's
   display picker, present the content and turn that screen on with the card's show
   control (F5). In the display card's **[en:tran:Where to watch]**, open
   **[en:tran:More addresses]** and copy the **[en:tran:Video for media players (MP4)]**
   address into VLC or OBS. If the player is on another device, first turn on
   **[en:tran:Let other devices watch]** above the display cards.

   The port stays the same from one launch to the next, so a saved address
   or a printed QR code keeps working after the app restarts.

   Until **[en:tran:Let other devices watch]** is on — a switch at the top of
   the **[en:tran:Virtual Displays]** tab, above the display cards, not inside one —
   only **[en:tran:This computer]** addresses are listed and nobody else can
   watch. Turned on, it lists **[en:tran:This network]** addresses; turning
   on **[en:tran:Open to the internet]** as well (the same option as Screen
   Mirror's, with the same warning) lists **[en:tran:Internet]** ones. On this
   computer's own networks no code is asked for: anyone who has the address
   can watch. A viewer from the internet is sent nothing until you click
   **[en:tran:Allow connection]** on its row under **[en:tran:Watching now]**
   — or, with **[en:tran:Guest access]** set to
   **[en:tran:Require connection code]**, until it gives the code.

   **Give a virtual display an HTTPS address.** At the top of the **[en:tran:Virtual Displays]**
   tab, turn on **[en:tran:Let other devices watch]**, then **[en:tran:Use HTTPS]**
   directly below it. Open the display card's **[en:tran:Where to watch]** section
   and copy its starred `https://` address under **[en:tran:Watch in a browser]**.
   Other devices use that address, on the same port. A phone's
   page on this network can then do what a browser allows only a secure
   page: keep the screen awake in full screen, and send its microphone and
   camera. This computer signs its own certificate, so each browser warns
   once the first time it opens an address — continue past the warning
   (in Chrome, **Advanced**, then **Proceed**). **[en:tran:This computer]**,
   the tunnel's address and the MP4 are unchanged, and the `http://`
   addresses keep working.

7. The browser page fits the display to its window. Its
   **[en:tran:Full screen]** button (or a double-click on the picture) fills
   the screen, and **[en:tran:Exit full screen]** (or another double-click)
   leaves it; on a phone, full screen also turns the picture sideways where
   the browser allows it.
   **On the device watching, the page's buttons come back with the mouse or a tap.**
   Stay on the browser page that is already showing the display: move the mouse
   over its picture or tap the picture once to reveal the buttons. They hide
   when the mouse leaves, or a few seconds after a tap. The pointer shows over the
   picture only while they do.
   **[en:tran:Turn on sound]** is
   needed once, because a browser plays sound only after the page has been
   touched; until then the page plays everything silently. A camera put on
   the screen (Camera Show, or a camera background) is streamed from this
   computer to the page, on this network.

   **To share a phone's camera, open the display on the phone at an `https://`
   address.** Turn on **[en:tran:Let other devices watch]** and **[en:tran:Use HTTPS]**
   first (step 6): only then are `https://` addresses listed under
   **[en:tran:Where to watch]**, this computer's on the network — or use the tunnel's. On such a page **[en:tran:Share my cameras]** opens a
   list of every camera of the device, each with **[en:tran:Share]**. A
   phone lists **[en:tran:Front camera]** and **[en:tran:Back camera]** until
   the browser has been allowed a camera, then every camera it has by name —
   a phone with several back lenses lists each one. The camera shared shows
   its picture above the list and reads **[en:tran:Stop]**; **[en:tran:Share]**
   on another one puts it in its place on every screen showing it, with
   nothing to add again. The app lists it among its cameras as
   `Browser <address>: <camera>`: pick it there, as a Camera Show or a camera
   background, to put it on a screen.

   The page keeps the device from sleeping while it is open. If the app goes
   away, the page reads **[en:tran:Waiting for the display]** and joins again
   by itself.

8. To put the display on a TV, click **[en:tran:Cast to a TV]** — the cast
   icon in the display card's header, beside its size. The list it opens
   shows the TVs the app found on this network (Google Cast, DLNA, Roku),
   looked for only when the list opens: **[en:tran:Cast]** puts the display
   on one and **[en:tran:Stop]** takes it off; **[en:tran:Search again]**
   looks once more. It needs **[en:tran:Let other devices watch]** (step 6)
   on, because the TV plays the display's MP4 address itself.
   **On the phone or tablet watching, the browser page has the same button.** It works
   from any address of **[en:tran:Where to watch]** the page was opened at, `http://` too,
   so **[en:tran:Let other devices watch]** has to be on — the switch at the top of the
   **[en:tran:Virtual Displays]** tab, above the cards (step 6). Its **[en:tran:Cast to a TV]**
   offers one more row:
   - **[en:tran:Cast from this browser]** — a TV on the same network as the
     device holding the page (at home, in another building), through the
     browser's own picker: Chrome and Edge list Google Cast TVs, Safari
     AirPlay ones. The app streams the display to the page for it, and the TV
     then plays it from the app itself, without the operator's
     **[en:tran:Allow connection]** or the connection code. When the browser
     knows no TV, the list says so. A browser that cannot cast (Firefox)
     says that too.
   - On the app's own network, the page's list also shows the TVs the app
     found there, with the same **[en:tran:Cast]**, **[en:tran:Stop]** and
     **[en:tran:Search again]**.
9. **[en:tran:Watching now]** lists everyone watching: **[en:tran:Browser]**
   or MP4, where they are (**[en:tran:This computer]**,
   **[en:tran:This network]** or **[en:tran:Internet]**), their address with
   their browser and device (such as `Chrome · Android` or `VLC`), and
   since when. A device that leaves the page, or drops off the network
   without a word (a phone gone to sleep), leaves the list by itself within
   about 40 seconds. **[en:tran:Disconnect]** ends one and keeps it out of this
   display for ten minutes: a browser by itself (other devices behind the
   same router are not touched), a media player by its address. The browser
   page then says the device was disconnected and stops trying. Its access to
   screen updates, camera streams and interaction ends immediately, even if
   its connection takes longer to close. Each one is
   listed under **[en:tran:Disconnected]**, where **[en:tran:Allow again]**
   lets it back in at once. **[en:tran:Preview]** shows the display
   inside the card, listed as **[en:tran:This app (preview)]**. A browser's
   row — on the display's card in the **[en:tran:Virtual Displays]** tab of step 1 —
   has **[en:tran:Allow interaction]**, off for every new viewer. Turned
   on, a hand on that browser's page reaches the app the way a hand on the
   projector's own window does: scrolling a passage or a tall slide, tapping
   a verse to pick it, and the screen's **✕** (top right, under the mouse)
   hiding that screen. Off, those stay on that device, and the **✕** is not
   shown. A browser keeps
   the permission when its page reloads, until the switch is turned off, the
   viewer is disconnected, or the app restarts. A media player has no switch.
10. **[en:tran:Delete Virtual Display]** asks first. The screens on it are
    hidden and go back to a real monitor — the first one other than the main monitor, or the main monitor when there is no other — as when a monitor is unplugged,
    and everyone watching is disconnected.

_Verify: SP-30, SP-31._

### W-52 — Move your settings to another computer (Export / Import Settings)

**File → [en:tran:Export Data]** moves your files — songs, slides, media. This moves how
the app is SET UP: the language and theme, how a Bible looks on the screen, the
marquee and the timers, the panel sizes, and the rest of what you have chosen
over time.

1. Open **[en:tran:Setting]**. At the bottom of the left sidebar, under
   **[en:tran:Apply Settings]**, are **[en:tran:Export Settings]** and
   **[en:tran:Import Settings]** — the same on every tab. 📸
2. Click **[en:tran:Export Settings]**. A panel lists the settings in sections:
   **[en:tran:General]**, **[en:tran:Bible]**, **[en:tran:Screens]**,
   **[en:tran:Foreground]**, **[en:tran:Background]**,
   **[en:tran:Documents & Lyrics]**, **[en:tran:Layout]**,
   **[en:tran:AI & Assistant]**, **[en:tran:Connections]**,
   **[en:tran:API Keys & Sign-ins]** and **[en:tran:Other Settings]**. Each says
   how many settings it holds, or **[en:tran:All default]** when nothing in it
   was ever changed. Everything starts ticked except the API keys. 📸
3. The arrow at the left of a section opens it, and each part can be ticked on
   its own — **[en:tran:General]** holds **[en:tran:Language]**,
   **[en:tran:Theme]**, **[en:tran:Font]**, **[en:tran:Tips of the Day]**,
   **[en:tran:Folders]** and **[en:tran:File Color Notes]**. A section with only
   some parts ticked shows a dash in its box; ticking the section ticks all of
   them. **[en:tran:Deselect All]** / **[en:tran:Select All]** does every
   section at once.
4. Below the list is the same **[en:tran:Password]** /
   **[en:tran:Confirm Password]** pair as every other export. **API keys and
   sign-ins only go into a file with a password**: their rows stay red with
   **[en:tran:Type a password below to include these]** until one is typed, and
   come back unticked if it is cleared. Typed differently, the two fields say
   **[en:tran:Passwords do not match]** and the panel comes back holding what was
   ticked.
5. Click **[en:tran:Ok]**. `Settings.owasetting.tar.gz` is written to the **Downloads**
   folder (`Settings.owasetting.enc` with a password), and the folder opens on
   it.
6. On the other computer, open **[en:tran:Setting]**, click
   **[en:tran:Import Settings]** and pick the file. A protected file asks for its
   password first.
7. A panel lists the sections the file holds, under the warning
   **[en:tran:Each ticked section replaces the same section on this computer; what the file leaves out goes back to its default]**.
   **[en:tran:Folders]**, **[en:tran:Screen Mirror & Virtual Displays]** and the
   API keys start unticked — they reach past how the app looks. 📸
8. Click **[en:tran:Ok]**. A message says how many settings were written and how many went
   back to their default. The app then offers to reload its windows
   (**[en:tran:Apply Settings]**), or to restart when a ticked section is read
   only at start-up (**[en:tran:Screens & Monitors]**,
   **[en:tran:Screen Mirror & Virtual Displays]**).

> Notes: an import REPLACES each ticked section rather than adding to it — a
> marquee setting changed here but not in the file goes back to its default, and
> a section left unticked is not touched at all. Never carried, whatever is
> ticked: which data folder the app uses, this computer's identity on the
> network and the devices it trusts, whether AI features are switched on,
> conversations with the assistant, and what is on the screens right now. A
> projector window that is open keeps its old look until it is opened again. A
> SongSelect sign-in copied this way can sign one of the two computers out the
> next time either refreshes it.

Steps 1–2 and the Khmer labels were observed live 2026-10-09; steps 3–8 press
inside the app's own dialog, which the MCP firewall leaves to a person, and are
unit-tested until a person's run ticks them.

_Verify: ST-61..ST-66._
