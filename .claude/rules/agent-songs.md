---
paths:
  - "tools/owa-devtools-mcp/openLyric*.mjs"
  - "tools/owa-devtools-mcp/lyricPageText*.mjs"
  - "tools/owa-devtools-mcp/songLookup*.mjs"
  - "src/chatbot/lyricDraftHelpers.ts"
  - "tools/owa-devtools-mcp/agentLyricEdit*.mjs"
  - "src/chatbot/lyricChatHelpers.ts"
  - "src/lyric-list/lyricEditorChatbotSync.ts"
  - "src/chatbot/lyricDocumentChatHelpers.ts"
  - "src/helper/documentWords*.ts"
  - "src/helper/agentDocumentWordsHelpers.ts"
  - "src/lyric-list/lyricSongStageSettingHelpers.ts"
---

# Agent songs: reading, drafting and checking Open Lyric

`owa_lyric_validate` and the song-page reader. Creating the file itself is
`owa_lyric_file` (`agent-tools.md`).

- **A song PAGE is not a song** (2026-09-04,
  `tools/owa-devtools-mcp/lyricPageText.mjs`, gated by `checkIsPageText` so a
  plain paste is untouched). A chord site wraps the song in toolbars, diagrams,
  rails and a footer, and text extraction flattens its COLUMNS to one fragment
  per line. The rules, none about a particular site:
  - The song is the REGION between walls of wordless lines, scored on CHORDS
    first (a footer has a verse's word count and no chords). Fragments rejoin
    with NOTHING between them (a chord lands mid-word, and the page's trailing
    space is still on the fragment, so `toCleanLines` must not strip it
    first); a fragment after a fragment starts a NEW line; a label never joins
    anything.
  - A glued `|D` token is a chord: `readChordToken` splits off the bar,
    `splitLeadingChords` takes a leading run, and `writeInlineChords` walks the
    rest of a row (its script test runs on the row's WORDS minus the chord
    tokens). It is written as `|[D]` — **bar OUTSIDE the brackets**; `[|D]` is
    refused by open-lyric and our validator alike (the probe is kept as a
    test), and `toSafeLyricLine` keeps only brackets holding a chord. A leading
    token counts as a chord only with a BAR, or when the rest of the line is in
    another script, or when the page glues chords AND the token is longer than
    one character (`A` is also a word). A run of SEVERAL chords before one
    fragment is written nowhere (a fretboard chart).
  - `toRegions` carries the chord run at the end of a wall into the region it
    opens (the song's first chord) but does NOT count it toward the
    three-chord proof `pickLyricRegion` uses. Nothing printed UNDER a credit
    line is its translation.
  - Two page facts ride out: the address, from `owa_read_website`'s header and
    ONLY in front of the fence (a `Read https://…` planted in the body is not
    the source), as `- Attachments:`; and the copyright, read bottom-up from
    the footer, trimmed at its menu, and only a real notice (`©` or
    `(c) 2026`, never the bare word).
  - A chordless hymn-text page (proved a page by `stripWebsiteWrapper` finding
    its fence) is read by LINE LENGTH. Where stanzas are NUMBERED,
    `pickNumberedStanzas` takes 1…n plus a labelled refrain, and
    `readPageFields` reads the `Title:` / `Author:` / `Copyright:` table below
    (length alone drafted menus as verses). Models pass their own copies
    anyway, so a title line, `Tune:`, `from`/`to` markers, a heading block above
    numbered stanzas and a `copyright` slot are honoured; with no `mode`, plain
    words are drafted.
  - Also read: `Key: D · Time: 4/4 · Tempo: 73bpm` (checked against
    open-lyric's closed sets; an unknown key defaults rather than dropping to
    tier 2), verse numbers in the hymnal's script (`toAsciiDigits`), `(2x)` and
    `Repeat Chorus` as PLAY ORDER, and a Latin line under a non-Latin one as
    its TRANSLATION — an indented line, the only indent `toSafeLyricLine`
    keeps, safe because every tab is flattened first.
  - **A lone letter is junk only when it is LATIN** (2026-11-13, `EC-589`,
    `classifyLine`): a strumming hand and a fingering are Latin letters on
    every chart, while a lone letter of a script written without spaces is
    the syllable a chord split off its word -- a chord site prints a word's
    first consonant before the bar its chord stands on, and dropping it left
    a broken word at every such bar. **A translation one BLANK row down is
    still a translation** (`markTranslations` bridges the row,
    `checkIsTranslationGap`): a page that boxes each translation prints an
    empty row before it, and the English had been glued to the next sung
    line, the blank row splitting the verse into one part a line. Only a
    single Latin line, not a credit, under a non-Latin line that is no
    label, with no Latin line after it -- a run of Latin lines is a stanza.
  - **A hymnal's own marks** (`parseHymnalMark`, read first by
    `parseSectionLabel`): `I.` … `XX.` (capital Roman numerals, read back
    to check the canonical form) are numbered Verses and `R.` / `Ref:` the
    Refrain, a `(2x)` after them a repeat -- only with the full stop or
    colon and alone on the line, so a bare `I` stays a word. Unread, a song
    printed so came out as one Intro with its marks sung.
  - **It reports the area it chose** (first line to last); `from`/`to`
    override it. 14 of 14 real pages drafted valid. `owa_read_website`'s
    screenshot is WHOLE-PAGE (capped at 2400px), and its `executeJavaScript`
    has a timeout — without one a heavy page left hidden windows alive and
    every later read timed out.
- **Writing a song from whatever the user has**: `owa_lyric_validate` with
  `mode: "draft"` (2026-09-03, `tools/owa-devtools-mcp/openLyricDraft.mjs`)
  writes the notation from RAW words (a paste, a fetched page, a dropped file).
  A mode, not a tool: +61 tokens a round against ~450. **The model may not
  write Open Lyric, and the prompt says so** — even a careful attempt fails
  invisibly (`CC` where `Cx2` is required, free text inside `Instrumental`).
  - **A hymnal's slides, read out of the deck** (2026-11-13, `EC-589`; the
    user's eight PowerPoint hymns, read since `EC-590` through the app's own
    converter, `documentWordsHelpers.ts`): a stanza number
    may be written `1-` with a space after the dash (`STANZA_NUMBER_PATTERN`;
    `1-2-3` stays words); a closing run of lines starting `*` -- _*music,
    then sing verses 3 and 4 again_ -- is a `Note` part the play order
    leaves out (`splitPerformerNotes`), in the file and never on the
    projector; and two copies of a part that differ only in their closing
    punctuation or spacing are one part (`toBodyKey`), since the slides end
    the last chorus on the closing mark instead of the full stop. Measured
    on the eight: 8 of 8 tier 1, every number out of the words, every
    chorus played after each verse (2 had read its last copy as a verse).
  - **The heading left out above stanza 1 names the song when nothing else
    did** (2026-11-13, `EC-590`, `toHeadingTitle`). Read through the
    converter, a hymnal deck's title slide is three lines -- the hymn's
    number ending in a colon, its name, its name in English -- and the song
    had been called by its number alone. A first line ending in a colon
    only introduces the title, so the line under it is read with it, and
    the line under THAT too when one of the two is all Latin letters and
    the other all of another script: the same title translated. A second
    line ending in a colon is no name, a third line in the same script is
    not added, a page's title line is still cut at its ` | Site name`, and
    all of it fits `MAX_TITLE_LENGTH` (80; past it the translation goes
    first). Seen live on all eight decks, each title the number, the
    hymn's name and its English name -- the fifth once the zero-width
    space its number line ended in was trimmed with the spaces there
    (`toLineText`, `documentTextHelpers.ts`): it had hidden the colon.
  - **A song TYPED in a chat box is one line, labels and all** (2026-11-12,
    `EC-517`: _Create a song called Morning Praise with these words: Verse 1:
    …, Chorus: …_ was refused as "not a song", one line being under
    `MIN_SONG_LINES`). `splitInlineLabels` puts a label with a colon and
    words after it on a line of its own -- at a line's start, or after a
    comma, semicolon, sentence end or dash and capitalised -- and reads
    ` / ` in such a line as a line break. Its words are fewer than
    `LABEL_HEADER_MAP`'s on purpose (`Music:` and `Note:` are credits, a
    sung "the bridge:" stays sung), and a page that was read is never split.
    The model then sent the words with no `title`, so the window gives a
    draft the one the person NAMED (`readSongTitleNamed`: _called / named /
    titled X_ on the first line, after a song word and before any colon,
    ending at _with these words_ and the like -- never at a bare _with_,
    which ends _It Is Well with My Soul_).
  - **A song NAME goes in as `mode: "find"` + `title`** (2026-10-03,
    `songLookup.mjs`; the user's ask): the user's own songs, then the
    Public Domain Songs plugin's 36 hymns, asked of the app over the
    `owa-agent-file` relay (`action: "find"` → `publicDomainSongsLookupHelpers`,
    imported lazily) because the catalog is in the renderer bundle, not in
    this package. A find is formatted as a draft whose first line still
    starts "Drafted a song", so the window draws Create; nothing found is
    said so, and the model never writes a song from memory. `/lyric <title>`
    and the offline bot (`readSongTitleAsk`) do it with no model. A web
    title search was NOT built: lyric sites are mostly copyrighted texts and
    bot-walled, and the one public-domain library tried refused connections.
  - **A song PAGE goes in as `url`**, never as text the model copied (Sonnet 5
    retyped a Khmer chord page and lost all 36 chords). The tool reads the page
    itself through `owa_read_website`'s expression and locked-down window, and
    the firewall counts it as a network call on the ARGUMENTS
    (`checkIsNetworkCall`: address check, the ten-reads budget, the banner).
    The result must START with the drafter's own first line — the window keys
    on it to lift the song out and draw Create.
  - `cutAboveMetadataStrip` makes the `Key: · Time:` strip a boundary;
    `takeLeadingFurniture` sweeps and NAMES short chordless toolbar rows above
    the first chorded row; `checkIsSiteNotice` skips a `©` naming the site
    itself. Output is round-tripped through `validateOpenLyric`, so drift
    yields a report, never a broken song; if tier 1 is refused, tier 2 rebuilds
    every part as `Breakdown`. `[Instrumental]` IS a label (sent to
    `Breakdown`), or the word becomes a sung lyric. **An indented line is the
    TRANSLATION of the line above** — scraped whitespace stays valid, and no
    validator catches it.
  - In the chatbot the draft never reaches the answer text: `applyToolWatch`
    lifts it from the RESULT into **Create "<title>"** (a free name, through
    `owa_lyric_file`) and **Copy song text** (`lyricDraftHelpers.ts`,
    pseudo-tools the server never registers), with `RenderLyricPreviewComp`
    drawing it read-only above them from the same bounded in-memory map
    (nothing persisted; a reopened window draws no box). Those are the ONLY
    presses under a draft: `checkIsDraftEcho` drops model `OPTIONS:` echoing
    them, and no corpus follow-ups show. The offline bot drafts a paste itself
    (`checkIsLyricPaste` → `answerLyricPaste` in `helpBotHelpers.ts`). A create under a taken name is
    refused WITH the free name (`findFreeName`). A created song gets **Show it
    in the list** (a `Document List > <name>` control ref rung at press time)
    and the file chip; a song the MODEL already created gets those and no
    Create (`EC-161`, `createdLyric`). A site's bot check is refused, never
    drafted (`EC-162`, `checkIsBrowserCheckPage`: a page ≤1 500 characters with
    challenge words → `BROWSER_CHECK_TEXT`).
  Short wrapped documentation notices and missing-page responses are refused
  too (`checkIsPlaceholderPage`, EC-356): example.com's notice was drafted as
  seven verses of an "Untitled" song in the Khmer template pass. Plain pasted
  words are unaffected. `lyricDraftReportHelpers.ts` translates the built-in
  answer's summary and extraction notes using the window dictionary; titles,
  authors, section names and quoted page boundaries remain data. Tests use
  real drafter reports and the dictionary of every package with an
  `assistant.json`. The server's report
  stays English, with no extra tool or schema.
- **Checking a song**: `owa_lyric_validate`
  (`tools/owa-devtools-mcp/openLyric.mjs`) takes song text and answers with
  every mistake — line, section, and what to write instead — then what the song
  IS: title, key, tempo, its sections and their play order. With `text` it asks the
  app nothing, checking or drafting (its `find` mode and a `url` do ask it),
  so it works with no window open and while the user is still typing. It deliberately does NOT call open-lyric: that
  package's validator takes a Monaco model and pushes markers into an editor,
  its one headless entry (`api.document.checkMarkdown`) answers a **boolean** —
  which is the one thing this tool must not answer — and reaching either drags
  an 863 KB monaco-touching bundle into a plain-node server. So the grammar is
  written out, and **two tests are what stop it drifting**: `openLyric.test.mjs`
  re-reads `node_modules/open-lyric/schema.md` §8.1 (the machine-readable
  grammar the package ships) and fails when a table disagrees — fences,
  structure codes, Config fields, `Key`/`Time` enums, all 229 locale tags, the
  chord pattern character for character; and `openLyricOracle.test.mjs` runs
  the 123 documents of its `CASE_LIST` through open-lyric's own `checkMarkdown` AND through ours and
  fails on a disagreement. Both were written first, against the live oracle,
  which is what caught the `(2x)` repeat being refused. `problems` are what the
  editor rejects the song for; `warnings` are what it accepts and a musician
  still wants (a section `Structure` never plays, a `{p: #3}` pointing past the
  patterns `Config` lists) — both probed as accepted, so neither may be raised
  as an error. A `Structure` that broke mid-way reports its play order marked
  PARTIAL and accuses nothing of being unplayed: past the broken token, unread
  is not the same as unplayed.
- **A song is CHANGED part by part from words: `owa_lyric_edit`** (2026-11-06,
  the user, with a song row's menu open: _add lyric context menu `Open In
  Chatbot` … the chatbot should provide all operations related to lyric
  modification_ -- add a section, translate it, change its words, its key;
  then _should have options: replace or append the translation under the
  line_ and _it should translate title and sub-title as well_). The model
  writes WORDS; `tools/owa-devtools-mcp/openLyricEdit.mjs` (pure, no app)
  splices them into the document and rebuilds `Structure` with
  `toStructureText`, so the notation is never a model's
  (`model-cannot-write-open-lyric`). Actions: `read` (Config, play order,
  every part's lines, translations beside them), `set-lines` (replace a
  part's words -- a translation in place), `add-translation` (one
  tab-indented line under each sung line, replacing one already there),
  `set-chords` (refused when a word changes), `add-section` (`Verse` takes
  the next number; a `Note` is not played unless placed -- a played Note is
  a slide on the projector), `remove-section` (a removal, in the
  firewall's budget), `set-order` (`Chorus x2`), `set-config` and
  `transpose` (its own transposer: root and `/bass` by the key gap, flats
  for a flat key, the chord's own spelling in C and Am -- open-lyric's music
  theory is browser-only). `set-lines` and `add-translation` take `config`
  too, so a translation's Title and Subtitle go in the same call and undo.
  **SURGICAL**: the document is split into fences and the text between, an
  untouched split joins back byte for byte, and an edit replaces only its
  lines -- comments, `Attachments`, a strumming pattern stay as the person
  left them. Every result goes through `validateOpenLyric`; a change that
  ADDS a problem is refused with the validator's line (problems the song
  already had are said, not blocking), and the tests run every output
  through open-lyric's own `checkMarkdown` too. The tool is three steps
  (`agentLyricEdit.mjs`): the app reads the song's editing HEAD with a
  hash (`owa-agent-file` `read`, `agentFileHelpers.ts`, the path cache
  let go first), node makes the change, the app writes it back through
  `update` with that hash -- refused when the song changed in between (the
  Lyric Editor typing over it) -- backed up, unsaved. `file` is a Documents
  name or, from an outside agent, a whole `.owl` path (absolute, no `..`,
  a song's extension, there, readable as a song -- checked again at the
  disk). **In the chatbot the model never handles a path**: offered only to
  a `lyric` ask (`MODEL_ON_ASK_TOOL_MAP`; ~519 tokens to that ask alone,
  the ordinary list unchanged at ~8 348), and `runMcpToolCall` turns the
  NAME it gives into the attached file's path (`resolveLyricEditFile`),
  refusing a path it wrote -- words planted in a song could ask for any
  file. Translating has two ways and the PERSON picks: the card's buttons
  carry the way (`readLyricTranslateMode` → a line on the ask), and a
  typed request that does not say is asked first. The language they offer
  (`pickTranslateLanguage`, shared by the song, slide and note cards) is
  the one the name says; for a name WRITTEN in a language other than
  English, the other one of the two -- English in a window of its own
  language, else the window's (2026-11-08, BN-25: a Khmer note in a Khmer
  window had offered _Replace the words with Khmer_); else the window's.
  That choice, once the language is read, is `toTranslateTarget`, which a
  study's card shares, reading the study's own words instead of a name
  (2026-11-13, `EC-595`, `chatbot-files-report.md`).
  Seen live 2026-11-06:
  _Add another language under each line_ → _Spanish_ wrote a Spanish line
  under all 18 sung lines with `Locales: en-US, es-ES`, chords and play
  order untouched, and **Undo this change** put it back.
- **A word fixed keeps the rest of the song** (2026-11-12, `EC-511`; the
  user's goal _chatbot will be very smart to help user edit lyric_).
  `set-lines` wrote a part back as the lines it was given, so a model
  fixing one typo retyped the verse and the verse lost every chord it did
  not copy back and every translation line under it -- asked live on the
  free model, 3 of 12 standing asks (`references/lyric-edit-asks.json` in
  `owa-enhance-chatbot`, driven by `scripts/lyric-run.mjs` on a scratch
  profile) ended "done" over a verse missing 11 chords and 4 translation
  lines. Two rules now, both in `openLyricEdit.mjs`:
  - **A line given back keeps what went with it.** `set-lines` pairs each
    given line with the old line it still says half the words of
    (`pairGivenLines`, the same line first, then the most alike, the
    nearest on a tie -- so lines swapped keep their own), and a paired line
    keeps its lines under it and, when given with no chord, its chords
    (`carryChords`: by the words' longest common run, a chord on a changed
    word onto the word now in its place, never two on one letter, never
    out of order, never dropped -- past the last word it goes to the line's
    end). A translation line a model copies back AS a line stays a line
    under (`checkIsGivenBack`). Only a line rewritten whole loses its own,
    and the warning says how many.
  - **`replace` changes words where they stand** (`replacements:
    [{find, with, part?, in?}]`): whole words by the browser's word breaker
    (`Intl.Segmenter`), so `gras` is not found inside `grase`; in a run of
    letters the breaker cuts into SEVERAL words (a script written without
    spaces) any edge is the caller's, since its dictionary may not draw the
    singer's; an apostrophe ends a word (`God's`). Smart case: a find in
    small letters matches any case and keeps each one's capital or
    capitals, one with a capital matches only as written. Matched on the
    words with the chords taken out, so `re[D]lieved` is found by
    `relieved` (and a find copied with its chords is the same find), and
    each chord stays on its word -- one inside the replaced words on the
    same word of the new ones, as far in. `in` `translations` / `both`
    reaches the lines under; a Title or Subtitle saying the word is told,
    not changed. All or nothing: one find that is not there refuses the
    call, naming it and any longer word it was only inside.
  - **`remove-translations`** (`part`, else every part; `locales` for what
    is left) is a removal (`AGENT_REMOVING_ACTIONS`): those lines may be a
    person's own typing. `add-translation` with `""` keeps that line's.
  `LYRIC_SYSTEM_PROMPT` sends a spelling fix or a word changed to
  `replace`, never a part retyped, and tells the model to fix only real
  mistakes (_'Twas_ is the song's own) and to say the tool's warnings.
  The tool costs ~140 tokens a round more, on a song ask alone; the
  ordinary list did not move.
- **Chords taken out, a part renamed: one call each** (2026-11-12,
  `EC-527`). A second standing set (`lyric-edit-asks-2.json`, a public
  domain hymn) found the first rule above turned against an ask: _Take
  the chords out of the chorus._ went out as `set-lines` with the chorus's
  own words and no chords, the lines kept their chords, nothing was
  written, and the answer said they were gone. And _Rename the chorus to
  Refrain._ was right only by four calls (the part added again, the old
  removed, the order rewritten), four undo steps for one change. Now:
  - **`remove-chords`** (`part`, else the whole song) takes the chords out
    of SUNG lines, the words and the lines under kept, a chord standing
    between two words leaving one space. An Instrumental is its chords and
    an Intro's lines may be a progression: both keep theirs and the warning
    says so; a line of chords alone stays too. A removal like
    `remove-translations`.
  - **`set-lines` handed a part's words exactly as they stand, every chord
    dropped, and nothing else changed** is refused, naming `remove-chords`
    (`checkIsChordsDropped`, `state.chordsDroppedParts`) -- never an
    "already reads that way" a model can answer "done" over. Beside a part
    really changed it is no refusal.
  - **`rename-section`** `part` to `to`: the same fence, its lines, chords
    and lines under, where it stood, and every place it plays in the
    order, in one change. A bare kind takes its next free number
    (`Verse` → `Verse 3`); a name the song has, a kind that holds
    something else (sung words into an Instrumental) or no kind at all is
    refused.
  - **`set-chords` adds and moves, never takes away**
    (`mergeGivenChords`). Asked to move ONE chord, a model gave the verse
    with that chord alone and twelve went. A line given plain keeps its
    own (as in `set-lines`); in a line given with chords an old chord stays
    unless a given chord stands in its place or one of its name stands
    elsewhere in the line (it moved) -- each given chord accounts for one
    old one, so a repeat left out stays. The change says how many were
    kept. Taking chords out is `remove-chords`'.
  - **`replace` changes a chord given in brackets** (`{find: "[F]", with:
    "[Fmaj7]"}`, `toBracketChord`, `applyChordReplacement`): that exact
    chord wherever it is played, an Instrumental's bare chords too, never a
    longer one starting the same (`F#`, `F/A`). It was the model's first
    try at _Change every F chord to Fmaj7_, refused, and the parts were then
    retyped whole. And a `part` given beside `replacements` is each one's
    that names none: _in the chorus_ written so had changed every verse.
  `LYRIC_SYSTEM_PROMPT` names all of it, and says `set-lines` gives every
  line not asked about as it reads, its punctuation too (_add a line at
  the end_ had turned the last line's full stop into a comma). ~727 tokens
  a round to a song ask (was ~675); the ordinary list did not move.

- **A song from a DOCUMENT in the Documents list** (2026-11-10, `EC-488`,
  the user: _allow create lyric from non-lyric documents … chatbot should
  list available powerpoint files when user choose then chatbot should user
  all api to extract text and prepare for the lyric_; then _preserve
  font-family in stage setting for the lyric_, a PowerPoint _converted then
  extracted_, and pages with no words to read sent as pictures to a model).
  The window's own flow, with no model: `lyricDocumentChatHelpers.ts` reads
  the ask (`readLyricDocumentAsk`: English in code -- a making verb, a song
  word, a document word after _from_ or _into a song_ -- and any language's
  `lyricDocumentAsks` in its `assistant.json`; never a how-to, an export or a
  link, which stay the guide's and the song-from-link starter's), lists the
  Documents folder's `.pptx` / `.docx` / `.pdf` / `.ows` files of the kind
  asked through `owa_media_file list` (ten a page, **More files**, a typed
  number or name; a file the ask names is read at once), and reads ONE file
  through `owa_media_file info` on a `document`. The whole state rides the
  pseudo tool's `args` (`owa-lyric-document-step`), re-checked at the press
  (`toValidLyricDocumentState`: a name, never a path). The words come from
  `src/helper/agentDocumentWordsHelpers.ts` (imported lazily): a PowerPoint
  converted to HTML first (`getPptxData`, the `<name>.pptx-htmls/` the app
  already makes), a Word file the same way (`getDocxData`), a PDF's text layer
  (MuPDF, 8 pages), a slide document's text items from its editing head.
  `documentWordsParsers.ts` reads that HTML with DOMParser only, never the
  live page; `documentWordsRules.ts` (pure) puts the shapes in reading order
  (top, then left, 8 px a row), drops slide numbers and hidden slides, NAMES
  and leaves out a heading box repeated over the slides, takes the title (a
  one-line first page, else the first heading), counts the main font by
  characters and marks a page with no words to read (`checkLooksUnreadable`:
  no letter, broken characters, or words glued or case-flipped the way a
  legacy font's stand-in Latin is -- NEVER by length: _Amen_ in three letters
  is a word). The words go to the drafter (`mode: "draft"` with `title`) and
  the card the song-from-text flow draws (`genLyricDraftAnswer` with
  `fontFamily`, `notes`, `actions`); **Create** passes `fontFamily` on to
  `owa_lyric_file create`.
  - **The song's own font** is `stageSetting: {fontFamily}` in the `.owl`
    file beside `content` (`Lyric.getStageSetting` / `setStageSetting`,
    through the editing history: the `*`, and Undo takes it back). The
    stage needs it SYNCHRONOUSLY, per slide -- `basicOpenLyricOptions` is a
    getter, and the screen window draws with no previewer -- so
    `lyricSongStageSettingHelpers.ts`, a leaf with NO imports read through a
    reader `Lyric.ts` registers (the `lyricHelpers → Stage0 →
    StageAbstract → LyricAppDocument` cycle), is awaited once at each async
    entry (`getStageSlides`, `getSlides` before the warm-deck key,
    `getSlideById`, the look-ahead's) and only PEEKED by the getter; at most
    16 songs, read again after 10 s or once `clearCache` marks one stale.
    The face goes first and the app font stays behind it
    (`toLyricFontFamilyStack`: open-lyric's `fontFamily` replaces the whole
    stack), and a face is only letters, marks, digits, spaces and `._-`,
    64 at most (it is written into CSS). Never set it on the `OpenLyric`
    instance: that setter saves the APP-WIDE setting. Stage Style's **Song
    Font** box (W-05 step 14, PM-179) reads the song again on its file's
    `update`, one 500 ms timer per panel: seen live 2026-11-11, an Undo with
    the box open had put the face back on every card while the box still
    named the app font.
  - **Pages with no words to read** offer **Read the words off the
    pictures** (`{step: 'pictures', name}`), fetched only on that press:
    `owa_media_file info` with `pictures: true` answers image blocks -- a
    PowerPoint or Word page, or a slide, drawn by
    `electron/documentCaptureHelpers.ts` (`agent-access.md`), a PDF page by
    MuPDF -- and the window asks a model that can see (`chatbot-llm.md`,
    `isTranscription`), then joins the words by page (`readPictureWords`
    splits on `=== picture N ===`). The card says who read them and asks for
    a check before saving.
  Seen live through the MCP door on a scratch profile (CB-188): a two-song
  hymn PowerPoint read in 1.6 s warm and created with its font, a slide
  document of picture pages answered three whole-slide pictures. The
  help window itself the same day (the person said its AI caution's Open
  could be pressed on the scratch instance): the list with no model, a press,
  a named file, **Create** writing the font, `/lyric-from`, a typed number,
  the pictured pages' offer (W-62). A dev reload between card and Create
  answers _That song is not held any more_: the draft lives in memory.
