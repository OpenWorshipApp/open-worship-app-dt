---
name: model-cannot-write-open-lyric
description: A language model measurably cannot write valid Open Lyric; the two traps a careful attempt still fails are invisible from the outside
metadata:
  type: project
---

Measured against the real validator on 2026-09-02, on one ordinary hymn, before
`mode: "draft"` was built:

| attempt | problems |
| --- | ---: |
| plain lyrics, as pasted | 1 — no `ol:Config` at all |
| a plausible model attempt | **9** — no `- ` prefix on the Config lines, `72 bpm` with a space, spaces in `Structure`, `[...]` read as a chord |
| a **careful** model attempt | **2** |
| the deterministic emitter | **0** |

The careful row is the whole finding. The two it still fails on are:

- `Structure: V1CCV2C` — the same part may not sit twice in a row; it must be
  `Cx2`.
- `guitar solo over the verse chords` inside an `ol:Instrumental` fence — that
  fence and `Interlude` reject **every word**.

Neither is visible from outside the grammar, so **a longer prompt does not fix
this**. Don't reach for one. The format is written by
`tools/owa-devtools-mcp/openLyricDraft.mjs` and round-tripped through
`validateOpenLyric`; the model writes the WORDS.

Two more traps that bit while building it, both silent:

- **An indented line is the TRANSLATION of the line above it.** A hymn scrape
  and a chord sheet are full of leading whitespace. It stays VALID, so no
  validator catches it, and half a song becomes translations of the other half.
- **Leaving `instrumental` out of a label map does not keep it away from that
  fence** — it stops the line being read as a label at all, so `[Instrumental]`
  becomes a lyric somebody sings. Recognise it and route it to `Breakdown`.

Related: [[open-lyric-validator-in-mcp]], [[open-lyric-fence-ground-truth]],
[[agent-access-mcp-chatbot]].
