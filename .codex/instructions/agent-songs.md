---
paths:
  - "tools/owa-devtools-mcp/openLyric*.mjs"
  - "tools/owa-devtools-mcp/lyricPageText*.mjs"
  - "tools/owa-devtools-mcp/songLookup*.mjs"
  - "src/chatbot/lyricDraftHelpers.ts"
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
- **Checking a song**: `owa_lyric_validate`
  (`tools/owa-devtools-mcp/openLyric.mjs`) takes song text and answers with
  every mistake — line, section, and what to write instead — then what the song
  IS: title, key, tempo, its sections and their play order. It is the ONE tool
  here that asks the app nothing, so it works with no window open and while the
  user is still typing. It deliberately does NOT call open-lyric: that
  package's validator takes a Monaco model and pushes markers into an editor,
  its one headless entry (`api.document.checkMarkdown`) answers a **boolean** —
  which is the one thing this tool must not answer — and reaching either drags
  an 863 KB monaco-touching bundle into a plain-node server. So the grammar is
  written out, and **two tests are what stop it drifting**: `openLyric.test.mjs`
  re-reads `node_modules/open-lyric/schema.md` §8.1 (the machine-readable
  grammar the package ships) and fails when a table disagrees — fences,
  structure codes, Config fields, `Key`/`Time` enums, all 229 locale tags, the
  chord pattern character for character; and `openLyricOracle.test.mjs` runs
  122 documents through open-lyric's own `checkMarkdown` AND through ours and
  fails on a disagreement. Both were written first, against the live oracle,
  which is what caught the `(2x)` repeat being refused. `problems` are what the
  editor rejects the song for; `warnings` are what it accepts and a musician
  still wants (a section `Structure` never plays, a `{p: #3}` pointing past the
  patterns `Config` lists) — both probed as accepted, so neither may be raised
  as an error. A `Structure` that broke mid-way reports its play order marked
  PARTIAL and accuses nothing of being unplayed: past the broken token, unread
  is not the same as unplayed.
