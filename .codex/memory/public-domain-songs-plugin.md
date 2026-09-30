---
name: public-domain-songs-plugin
description: src/plugins/public-domain-songs embeds a 36-hymn PD catalog (JSON) importable with no sign-in; SEPARATE plugin from song-select by user decree, Structure strings may repeat codes, and every record carries a source link that becomes an open-lyric attachment
metadata:
  type: project
---

The Public Domain Songs plugin (2026-08-24, branch enhance-after-release) is a
SECOND plugin beside [[song-select-plugin]] — the user explicitly wanted them
"2 different plugins", so they share NOTHING but the host wiring in
`VaryAppDocumentListComp` (one `importPopupHandlers` object) and the generic
`Lyric.createWithContent` pipeline. Do not fold their helpers together; the
small `sanitizeFileName` duplication is deliberate.

**What it is:** `publicDomainSongsData.json` holds 36 classic hymns (texts
fetched from hymnary.org / Cyber Hymnal / Timeless Truths by web agents,
2026-08-24) as `{id, title, authors, year, sources[], verses[], refrain}`; the
`.ts` of the same name is now only the type plus a re-export of that JSON, so
every importer and the lazy chunk are untouched by the move. The Documents
**Add Items** menu always shows **Import From Public Domain Songs** — no
sign-in, no network, production builds included. The catalog loads lazily
behind the popup's lazy panel; the search filter is deliberately UNdebounced
(local data, the debounce rule is for expensive work).

**Every record carries its source link** (`sources: [{title, url}]` - the
hymnary.org text page it was transcribed from, all 36 resolved and
content-checked against the live site 2026-08-24, since hymnary's slug is the
first line truncated at ~40 CHARS, not at a word boundary, and its search is
bot-walled to curl). `publicDomainSongToMarkdown` writes them into the Config
as `- Attachments: [Hymnary.org](https://…)` with any further link on a
TAB-INDENTED continuation line - open-lyric's only two accepted shapes are a
bare URL and a Markdown link whose target is protocol-based, and an unindented
second line reads as a new Config field. open-lyric then answers
`getAttachments()` with those records and
`LyricAppDocumentStageAbstract.genSlidesFromAttachments` appends ONE slide per
link after the last verse (`other` → a website item, see
[[canvas-audio-and-media-links]]). Adding a media link (an mp3, a YouTube URL)
to a record therefore lands a playable slide with no further code.

**Ground truth learned here:** open-lyric `Structure` strings MAY repeat a
code — `V1CV2CV3C` validates (probed live) — so a refrain hymn declares ONE
`Chorus` fence and repeats `C` after every verse, and the previewer then shows
true singing order (Verse 1, Chorus, Verse 2, Chorus…). This extends
[[open-lyric-fence-ground-truth]].

**How to apply:** to add songs, append to `publicDomainSongsData.json` (a
record with no usable `sources` entry fails the suite) —
`publicDomainSongsHelpers.test.ts` runs every entry through the REAL
open-lyric `checkMarkdown` and `new OpenLyric().getAttachments()` (jsdom + monaco patch + dynamic-import recipe from
[[monaco-css-test-failure-local-open-lyric]]) and fails on an empty/invalid
catalog, so a bad text cannot ship. Texts must avoid `[`/`]`, backticks and
leading `//` (the builder sanitizes anyway). Matrix row PL-105, workflow W-36.
