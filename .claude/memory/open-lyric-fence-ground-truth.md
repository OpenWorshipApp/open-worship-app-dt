---
name: open-lyric-fence-ground-truth
description: probed open-lyric fence/structure rules — the 17 structure codes (P not PC, IS not S), which fences allow numbering, required Config fields, and that Instrumental/Interlude fences reject plain text
metadata:
  type: reference
---

Probed live (2026-08-24) from `new EditorOpenLyricPlugin().getOpenLyricApi()`
(`api.domain.structure.STRUCTURE_TOKEN_DEFINITIONS`,
`api.document.checkMarkdown`), open-lyric 0.1.55. Guessing these wrong
produces documents `checkMarkdown` rejects.

- Structure codes (⟂ = no `<Header> n` numbering): Intro I⟂, Verse V,
  Note N, Pre-Chorus **P** (not PC), Chorus C, Post-Chorus X,
  Final-Chorus F⟂, Bridge B, Instrumental **IS**, Interlude L, Breakdown D,
  Refrain R, Tag T, Turnaround TU, Vamp A⟂, **Solo S**, Outro O⟂.
- `ol:Config` REQUIRES Title, Artist, Copyright, Key (enum, `C` ok),
  Tempo (`/^[1-9]\d*bpm$/`), Time (enum, `4/4` ok), Structure.
- Invalid: empty Structure; Structure referencing an undeclared part; a
  numbered code on a ⟂ part (`O1`); duplicate part names; unmatched `[`/`]`
  in a LYRIC fence. Valid: declared-but-unreferenced parts; `# Title` heading
  and free text outside fences; `//` comment lines inside fences.
- **Instrumental and Interlude fences accept only chord-bar syntax** — plain
  text in them fails validation. Free-text goes in Breakdown/Vamp/Solo
  (Breakdown even swallows brackets and mid-line backticks).
- `parsePlainText` expects its own colon-labelled format; SongSelect-style
  `Verse 1⏎lyrics` blocks come back `matchesPlainTextFormat: false` with
  everything dumped into one `Breakdown 1` — useless as a fallback for
  structured data.

**Exemplar:** `src/plugins/song-select/songSelectLyricHelpers.ts` (mapping +
tier fallback), its `.test.ts` (checkMarkdown as oracle,
[[monaco-css-test-failure-local-open-lyric]] for the vitest recipe).
