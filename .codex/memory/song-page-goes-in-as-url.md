---
name: song-page-goes-in-as-url
description: "A model told to hand a song page over WHOLE hands over its own retyping instead, and a chord page then loses every chord; the drafter takes the page ADDRESS (owa_lyric_validate url) and reads it itself"
metadata: 
  node_type: memory
  type: project
  originSessionId: 99449447-1b05-41b3-b106-f4736966887e
  modified: 2026-09-09T14:52:00.650Z
---

**The model's copy of a chord sheet has no chords in it.** Reported 2026-09-09
with a screenshot: *Create a lyric file from* a Khmer hymnal's chord page came
out with the words perfectly rejoined and 0 of 36 chords. The `.owl` on disk
had no `Attachments:` line — the proof the model never passed the
`owa_read_website` wrapper: Sonnet 5 read the page, retyped the words (artist
transliterated, hymn number trimmed off the title) and drafted from that. The
prompt AND the tool description had said "hand the page over whole" since
`EC-76`; `EC-98` had already measured that no provider does. On a text page
that costs nothing; on a chord page it costs every chord, and no drafter can
put back what the model deleted.

**Why:** a rule the model can ignore is not a rule (same lesson as the recipe
id scrub). The fix is structural: `owa_lyric_validate` takes `url`, reads the
page itself (same expression, same locked-down window as `owa_read_website`)
and drafts from the whole text — the model points, the machine reads. Re-asked
twice on Sonnet 5: one tool call, 2 rounds, 36 chord marks on disk.

**How to apply:**
- A tool that must see something the model would paraphrase should take the
  SOURCE (an address, a file name) rather than the model's copy of it.
- A second tool reaching the internet is a network call on its ARGUMENTS
  (`checkIsNetworkCall` in `firewall.mjs`): address check, the ten-reads
  budget and the banner naming the site apply only when a `url` is present.
- The draft tool's result must START with the drafter's first line
  (`Drafted a song…`): `readDraftedLyric` in the window keys on it, and a
  `Read …` prefix silently cost the user the Create button on the first try.
  Read the BUTTONS under the answer, not only the draft.
- Handing a page over whole also exposed: a chord site's toolbar drafted as
  Verse 1 (the `Key: … · Time: …` strip is now the boundary; chordless rows
  above the first chord are swept and NAMED) and the site's own `©` footer
  filed as the song's copyright (a notice naming the site is skipped).
- Only Sonnet 5 is measured on the `url` route (`EC-122`).

Related: [[model-cannot-write-open-lyric]], [[mcp-read-website-tool]],
[[mcp-document-write-tools]], [[chatbot-recipe-id-scrub]].
