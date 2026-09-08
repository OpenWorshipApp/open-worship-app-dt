# The tool budget — what the surface costs, and how to cut it

Every schema `tools/list` returns is re-sent to the model on **every round of
every question**. `MAX_TOOL_ROUNDS` is 10. So the tool surface is not a
one-off cost paid at start-up; it is a tax on every single thing a volunteer
asks, on a machine and an API bill neither of which has room to spare.

## Measured

```bash
node .claude/skills/owa-enhance-chatbot/scripts/audit-mcp-tools.mjs
node .claude/skills/owa-enhance-chatbot/scripts/audit-mcp-tools.mjs --json
```

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

Each of those last two rows is what one deliberate addition costs, paid by
every volunteer whether or not they ever ask about a web page or a song:
**+347 tokens on every round** for `owa_read_website`, **+221** for
`owa_lyric_validate` — ~3 500 and ~2 200 across a worst-case question. That is
the trade each tool has to be worth, and it is written down here so the next
person can re-judge it rather than inherit it.

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

The biggest owa descriptions today are `owa_guide_start` (1 211 chars of
description alone) and `owa_help_search` (579). Both earn some of it — they are
the two tools a wrong choice is most expensive on — but neither has been cut
since it was written.

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

Then follow the authoring checklist in
[`../../owa-enhance-chatbot/references/mcp-tools.md`](../../owa-enhance-chatbot/references/mcp-tools.md)
end to end, and put the before/after token numbers in your report.
