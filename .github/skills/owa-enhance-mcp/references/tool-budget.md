# The tool budget — what the surface costs, and how to cut it

Every schema `tools/list` returns is re-sent to the model on **every round of
every question**. `MAX_TOOL_ROUNDS` is 10. So the tool surface is not a
one-off cost paid at start-up; it is a tax on every single thing a volunteer
asks, on a machine and an API bill neither of which has room to spare.

## Measured

```bash
node .claude/skills/owa-enhance-chatbot/scripts/audit-mcp-tools.mjs
node .claude/skills/owa-enhance-chatbot/scripts/audit-mcp-tools.mjs --json
node .claude/skills/owa-enhance-chatbot/scripts/audit-mcp-tools.mjs --stdio
node .claude/skills/owa-enhance-chatbot/scripts/audit-mcp-tools.mjs --ratchet
```

`--stdio` lists a FRESH server spawned from the code on disk, so an edit is
measured without restarting the operator's app (the in-app host caches
`server.mjs` on its first session).

**`--ratchet` is the thing that makes this table binding** (`MC-14`, 2026-09-17).
It exits 1 when the MODEL's bill crosses `MODEL_TOKEN_CEILING`, recorded in the
script at **7 450** against a measured 7 253 (lowered from 8 200 on 2026-09-18,
when `MC-07`'s cut would otherwise have left ~950 tokens of room nobody chose
to spend) — one small tool of headroom, not a budget to spend down to. The
ceiling is on the model's bill and not the host's, because the developer's door
may grow and a tool added "for the developer" that quietly reaches the model is
exactly what this catches. A deliberate addition
raises the line IN THE SAME CHANGE and says why; the failure names the three
biggest model-visible tools, since that is usually where the cut is. It needs a
running app, so it belongs in a run sheet rather than in `npm run lint`.

**The host's bill and the model's bill are different numbers**, and the one
that matters for a question is the model's. The audit reports both.

| Date | At the host | To the model | Worst case, one question |
| --- | --- | --- | --- |
| 2026-08-31 | 42 (13 owa) / ~8 500 | 42 / ~8 500 | ~85 000 |
| 2026-09-01 | 47 (18 owa) / ~10 136 | 44 / ~9 492 | ~94 920 |
| 2026-09-01, after the firewall | 44 / ~9 468 | 41 / ~8 938 | ~89 380 |
| 2026-09-02, after `modelTools.mjs` | 44 / ~9 468 | **25 / ~5 721** | **~57 210** |
| 2026-09-02, `owa_read_website` added | 45 (19 owa) / ~9 835 | 26 / ~6 088 | ~60 880 |
| 2026-09-02, `owa_lyric_validate` added | 46 (20 owa) / ~10 056 | 27 / ~6 309 | ~63 090 |
| 2026-09-08, the model sees the `owa_*` tools only | 48 (22 owa) / ~11 113 | **19 / ~5 503** | ~55 030 |
| 2026-09-09, screens / selection / run sheet sentences | 48 (22 owa) / ~11 586 | 19 / ~5 976 | ~59 760 |
| 2026-09-10, `owa_present_bible` added | 49 (23 owa) / ~11 968 | 20 / ~6 358 | ~63 580 |
| 2026-09-11, `owa_foreground` added | 50 (24 owa) / ~12 459 | 21 / ~6 849 | ~68 490 |
| 2026-09-14, baseline before the data tools (other drift since 09-11) | 50 (24 owa) / ~12 511 | 21 / ~6 901 | ~69 010 |
| 2026-09-14, `owa_bible_item` / `owa_bible_note` / `owa_undo`, slide CRUD, delete | 53 (27 owa) / ~13 600 | 24 / ~7 990 | ~79 900 |
| 2026-09-18, `MC-07` — the descriptions cut, two contradictions out | 53 (27 owa) / ~12 863 | 24 / **~7 253** | ~72 530 |

Each of those last two rows is what one deliberate addition costs, paid by
every volunteer whether or not they ever ask about a web page or a song:
**+347 tokens on every round** for `owa_read_website`, **+221** for
`owa_lyric_validate` — ~3 500 and ~2 200 across a worst-case question. That is
the trade each tool has to be worth, and it is written down here so the next
person can re-judge it rather than inherit it.

`owa_present_bible` (2026-09-10) is **+382** — description almost entirely,
for the app's commonest live ask, which no existing tool could do at all: the
Bible Lookup is a picker no step can drive. Measured at +420 and trimmed once
before the row was written; the two readers it serves (a model choosing, and
the rule that a verse goes up when ASKED and is offered when only asked how)
are what is left.

`owa_foreground` (2026-09-11) is **+491** — six optional arguments (the widget
list, `minutes`, `at`, `text`, `seconds`, `action`) are ~870 of its schema
characters, and the description was trimmed from 1 232 to 1 027 characters
before the row was written. Paid for by a measured failure rather than a
guess: *Start a 5 minute countdown on the screen* cost 18 rounds and $0.18 on
Sonnet 5 and started nothing; with the tool it is 2 rounds and one call. Six
widgets share the one schema on purpose — six tools would have been ~2 000
tokens a round for the same job.

The data tools (2026-09-14) are **+1 089** together, asked for by the user in
so many words -- CRUD over saved Bible passages, Bible notes, songs and slide
documents, slides with their text and style, and an undo behind every one of
them. Measured at +1 244 off a fresh server and trimmed once before the row was
written: `owa_slide_file` 329 → 622 (+293, the six slide actions and one shared
array of text-box fields), `owa_lyric_file` 358 → 370 (+12, `delete`),
`owa_bible_item` 301, `owa_bible_note` 297, `owa_undo` 186. The trade is every
volunteer paying ~1 100 tokens a round so that "add a slide that says
Welcome", "save John 3:16 to my list" and "put back what you deleted" are one
call each instead of a walkthrough nobody can demo -- and on Anthropic the
cached prefix makes that a tenth after the first round. The first thing to
withhold, if the bill has to come down, is `owa_bible_note` (the rarest ask of
the three) through `modelTools.mjs`, which takes nothing from the developer.
Measured with the audit's new `--stdio`, which lists the code on disk instead
of the app's cached host -- no restart of the operator's app to see an edit.

`owa_lyric_validate` is the cheaper of the two for a reason worth copying: its
whole input is one required `text` string, so almost all of its 221 tokens are
the description — the part that earns its keep by stopping the model reaching
for the wrong tool. A schema with five optional parameters costs more than the
sentence that explains it.

Read the trend, not the row: the surface **grew 19% in a day** because adding a
tool is easy and nobody is billed for it at the time. That is the failure mode
this file exists to make visible — and reporting only the host's total is how a
tool added "for the developer" ends up billed to every volunteer, which is why
the audit prints a withheld tool as `(name)` and counts the two separately.

Note the audit script reads the app's live HTTP host, so it reports the server
the app is RUNNING, not the one on disk. Restart the app before trusting it
after an edit (memory: `mcp-tool-edit-two-processes`).

## The levers, biggest first

### 1. Fewer tools

29 of the 47 are chrome-devtools', and the chatbot's model cannot usefully
drive most of them. Three are already gone: the firewall's denials remove
`evaluate_script`, `take_heapsnapshot` and `upload_file` from the list for both
callers, worth ~668 tokens/round.

The cut that does **not** take anything from the developer is
`tools/owa-devtools-mcp/modelTools.mjs`: it filters what the MODEL sees while
the server keeps serving everything. `MC-06` took it from 3 names to 19 —
−3 217 tokens/round, −32 170 on a worst-case question — and the four groups it
withholds are documented in that file next to the reason each gets told.

Two lessons from doing it, both worth more than the tokens:

- **A filter is not a rule until the call is refused too.** `runMcpTool` called
  whatever name the model returned, and these tools are named in the app's own
  manual, which the model can read.
- **Check for the sibling.** `owa_screenshot` was withheld for a stated reason
  and `take_screenshot` sat in the list beside it doing the same job.

### 2. Shorter descriptions

A description has two readers: a model choosing between 44 of them, and a
volunteer who will be acted upon by whatever it chooses. Say what the tool is
FOR and when to reach for it. Do not explain how it works, do not restate the
schema in prose, and do not apologise for its limits in three sentences where
one will do.

`MC-07` (2026-09-18) cut the biggest of them: `owa_guide_start` 725 → 430,
`owa_lyric_validate` 520 → 411, `owa_help_search` 439 → 331, `owa_tran` 302 →
224 — −737 a round in all. Two things it found are worth more than the tokens:

- **A long description drifts into disagreeing with the prompt.** Both of the
  two biggest carried a rule the chatbot's prompt reverses ("offer this
  whenever the answer is more than one step"; "check notation you wrote
  yourself" beside "never write notation yourself"). Read a description
  against the prompt before trimming it — the contradiction is the first cut.
- **A cut can go one sentence too deep, and only the window shows it.** With
  the walkthrough's "offer this" gone, *walk me through …* got an offer instead
  of a card; one sentence back (*the default `show` presses NOTHING*) and the
  card went up. Ask the real window the shape a cut touched.

The biggest now are `owa_slide_file` (~619, mostly its `items` schema — the
cost of editing a text box's style), `owa_foreground` (~445) and
`owa_guide_start` (~430).

### 3. Fewer rounds

A round is the whole prompt, the whole history and every schema, again. So a
tool that answers completely is worth more than two tools that each answer
half. This is why `owa_list_ui` returns labels *and* positions *and* enabled
state *and* `showsOnHover` in one call, and why the question corpus carries the
recipe, control and keystroke on each entry — a lookup replaces a search round.

When a change makes the model need MORE rounds, the change is wrong. Make the
tools answer better instead.

### 4. Smaller results

Results are context too, and unlike schemas they are unbounded. `owa_app_state`
used to carry the user's data directory and forty dev-only component names into
every question that touched it. Trim at the source, not in the prompt.

**Results are compact JSON** (`MC-33`, 2026-09-18). Every one was indented,
and a result stays in front of the model for every later round of the
question: fourteen ordinary read-only calls went **35 411 → 24 499 characters
(−31%), 1 355 lines → 49**, and the round after `owa_help_search` writes ~12%
fewer tokens on the wire. Never indent a result again — nothing reads one by
its layout.

## App-side cost, which is not tokens

The MCP host runs inside an app targeting very low-spec machines. The rules
that keep it cheap, all deliberate, none to be "cleaned up":

- **Nothing is cached between questions.** The knowledge corpus is read one
  file at a time; `listKnowledgeEntries()` re-reads `index.json` per call,
  which is also why a knowledge rebuild needs no restart.
- **`cdp.mjs` opens and closes a socket per call.** It holds no connection and
  no memory between questions.
- **chrome-devtools-mcp and puppeteer are imported on the first MCP session**,
  not at startup. An app nobody asks for help stays exactly as light as it was.
- **`host.mjs` caps sessions at 8** and evicts the least recently used, and
  sweeps anything idle for 15 minutes — a session holds a browser connection.
- **`firewall.mjs`'s log is a bounded ring of 100** and its pending-request map
  is capped at 64. A log nobody reads must never grow.

If you add a cache it must be short-lived, bounded, and carry a comment saying
why it earns its memory.

## Before you add a tool

Ask, in this order:

1. Can an existing tool answer it with a better description? (free)
2. Can an existing tool answer it with one more field? (nearly free)
3. Can two existing tools be merged into the one that answers completely?
4. Does the model actually reach for it, or is it a tool for a case you
   imagined? A tool nothing calls is worse than no tool.
5. Does it have to reach the MODEL, or only the developer? `modelTools.mjs`
   withholds 29 of the 53 and costs the developer nothing.

Then run `--ratchet`. If it fails, either the tool is worth raising
`MODEL_TOKEN_CEILING` for — say so in the same change — or it is not.

Then follow the authoring checklist in
[`../../owa-enhance-chatbot/references/mcp-tools.md`](../../owa-enhance-chatbot/references/mcp-tools.md)
end to end, and put the before/after token numbers in your report.
