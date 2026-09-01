# Research playbook — find the improvement before building one

Every run of this skill starts here. The point is to arrive at work that is
**evidenced**, not guessed: a real question the assistant answered badly, a
measured cost, a capability a volunteer needs and cannot get.

Budget roughly a third of the run on this. A run that produces a ranked, evidenced
opportunity list and ships one small item beats a run that ships three guesses.

**Start by reading the last run's row** in [scoreboard.md](./scoreboard.md): what
passed then must still pass now, and a regression outranks everything new. Finish
by appending this run's row. The corpus is the same every time so the rows
compare — that is the whole mechanism by which the assistant gets greater and
greater rather than differently broken.

## The three axes

Grade every idea against the user's own words. An idea that scores on none of
these is not work.

| Axis | Means | Example moves |
| --- | --- | --- |
| **Smarter** | Right answer, from the right source, in fewer rounds. Knows what the app is doing right now. | Better tool descriptions; a tool that answers what the model currently infers; ranking fixes; killing a wrong-turn tool |
| **Easier** | Less for the volunteer to do or understand. Works when they are stressed and not technical. | Walkthrough instead of prose; do-it-for-me; the right suggested questions; a shorter path to the same result |
| **Impressive** | The moment someone says "it did *that*?" — usually the app acting on itself, visibly and safely. | Ringing the real control; demo mode; answering from live state; recovering from its own mistake without asking |

## Track A — Interrogate the live assistant (always)

The primary evidence source. You cannot improve answers you have not read.

1. **Ask the corpus below** through the real window (or `verify-chatbot-e2e.mjs`
   plumbing), presenter and reader, both providers if the change is
   provider-neutral.
2. **Grade each answer** on the scorecard.
3. **Keep the transcript.** Quote the bad ones in the backlog item you file — a
   verbatim bad answer is what makes an improvement provable later.

### The standing question corpus

Cover the shapes, not just the topics. Twelve questions is enough for a run.

| # | Shape | Example |
| --- | --- | --- |
| 1 | Basic how-do-I | "How do I put a Bible verse on the screen?" |
| 2 | Where-is | "Where is the button to change the background?" |
| 3 | Live state | "Is anything showing on the projector right now?" |
| 4 | Do-it-for-me | "Turn off the screen for me" |
| 5 | Multi-step | "How do I build a running order for Sunday?" |
| 6 | Wrong window | (from the reader) "How do I edit a slide?" |
| 7 | Panic / vague | "Nothing is showing on the projector" |
| 8 | Non-native phrasing | "the words no come out big screen" |
| 9 | Something the app cannot do | "Can it stream to Facebook?" |
| 10 | Feature that landed recently | anything from the newest `W-xx` recipe |
| 11 | Ambiguous noun | "How do I add a song?" (lyric? SongSelect? public domain?) |
| 12 | Follow-up in the same tab | "and how do I undo that?" |

### The scorecard

Per answer, record:

| Field | Why it matters |
| --- | --- |
| Correct? | Against the manual and the real app — not against plausibility |
| Actionable? | Numbered steps, each one a control they can press |
| Any internals leaked? | A path, id, setting key or component name = a defect, always |
| Rounds used | From the dev terminal. 1–2 good, 5+ means the tools are not answering |
| Tools called, in order | Wrong turns are the cheapest thing to fix |
| Offered a walkthrough? | Multi-step answers should end in a guide, not a paragraph |
| Guide landed? | Red ring on the right control, or `nearMisses` |
| Time to first token | The volunteer is in a hurry |

Three patterns to look for across the sheet: **the same wrong turn repeated**
(fix a description), **a question answered only by inference** (a tool is
missing), **an answer that is right but long** (a prompt or format issue).

## Track B — Mine the app for capability gaps (always)

What can a user DO that the assistant cannot help with, cannot see, or cannot do
for them?

```bash
# What the app can do, by user-facing recipe
grep -c '^### W-' .claude/skills/owa-robot-test/references/user-workflows.md
grep '^### W-' .claude/skills/owa-robot-test/references/user-workflows.md | tail -20

# What landed recently and may have no recipe at all
git log --oneline -30 -- src/ | head -30

# What the coverage matrix knows that the manual does not
grep -o '^| [A-Z]\{2,4\}-[0-9]\+' docs/test-paths/coverage-matrix.md | sort -u | wc -l
```

Then cross them against the tool surface:

- **Sees but cannot act**: the assistant can describe it, but a volunteer must do
  seven clicks. Candidate for a guide recipe or a `do it` tool.
- **Acts but cannot see**: a tool changes something with no way to confirm it
  worked. Candidate for a status field in the tool's own result.
- **Neither**: whole areas with no `owa_*` reach at all. Check whether the
  question is even common before adding a tool (§*The filter* below).
- **Knows nothing**: a shipped feature with no `W-xx` recipe — that is knowledge
  work (SKILL.md §6c), not a tool.

Always ask the cheaper question first: *would a better description of an existing
tool fix this?*

## Track C — Look outside (when the answer is not in the app)

Use when the problem is a known one with known solutions — agent loop design, tool
schema ergonomics, retrieval ranking, streaming UX, cost control.

- `WebSearch` / `WebFetch` for current MCP and tool-design practice, provider
  docs, and how comparable assistants handle the same interaction.
- The `claude-api` skill for anything about model ids, pricing, params, caching,
  tool-use mechanics — **do not answer those from memory**; prices and model names
  move.
- `chrome-devtools-mcp`'s own tool definitions in `node_modules` are a good style
  reference for terse, model-facing schemas.

Bring back a **specific applicable change**, not a summary. "Providers cache
prompt prefixes, so the system prompt and tool list should be stable and first" is
useful; "here is an article about agents" is not.

## Track D — Read the seams (when chasing a specific defect)

- The dev terminal: the MCP host logs every tool call; a bad answer usually has a
  `Tool error:` behind it that the model quietly routed around.
- `git log -S` on the chatbot files: the comments in this subsystem record *why*
  the obvious alternative was wrong. A "fix" that reverts one of them is a
  regression with a nice diff.
- The offline bot (`helpBotHelpers.ts`) sometimes answers a question BETTER than
  the model does. When it does, the model's prompt or tools are at fault, and the
  offline heuristic tells you what the right answer looked like.

## The filter — what survives research

An idea becomes an `EC-xx` item only if all of these hold:

1. **Evidenced.** A transcript, a measurement, or a named workflow gap.
2. **Scores on an axis, and names a rung.** Smarter, easier, or impressive — and
   which rung of the ladder in SKILL.md it moves.
3. **Worth its cost.** Every tool is charged to every question ever asked, so a
   tool for a rare question is a bad trade. But this is a budget question, not a
   veto: a change that moves a rung is allowed to cost, as long as you say what it
   costs and what you cut to pay for it.
4. **Safe for a live service.** Nothing that can change what a congregation sees
   without being offered first.
5. **Fits the constraints.** No long-lived cache, no eager loading, no app-module
   imports in page expressions, no `tran()` in the chatbot window, English-only
   answers, and it must work for the outside agent too.

Rank survivors by **regressions → wrong answers → unsafe acting tools → cost →
capability → polish**, and write them into [backlog.md](./backlog.md) with the
evidence attached. File the ones you are not going to do as well — that is the
point of a stable id.

**Do not filter out the big one.** The filter is there to stop unevidenced work,
not ambitious work. When the corpus keeps failing in the same way and no small fix
addresses it, the finding IS that the current design caps the rung — file that as
its own item, sized honestly, and put it to the user. Rungs 4–6 will not be
reached by trimming descriptions.

## Report the research, not just the change

Every run of this skill ends with:

- the scorecard summary (how many answers were correct / actionable / leaked);
- the audit numbers, before and after;
- the ranked opportunity list, with new `EC-xx` ids;
- what shipped, and the same question answered again to prove it.
