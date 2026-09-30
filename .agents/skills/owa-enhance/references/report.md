# The report — what research hands the user

The report is the whole deliverable of a research run. The user decides from
it, the apply phase is judged against it, and a cleared conversation resumes
from it. Save it as `test-results/owa-enhance/report-<YYYYMMDD-HHMM>.md` (the
run id is that timestamp) and show it in the conversation.

Write numbers, not adjectives. Quote a console line verbatim. Link code as
`[file.ts:120](src/path/file.ts#L120)`. Leave out anything that is neither
evidence nor a decision the user has to make.

## Layout

```markdown
# OWA Enhance — <auto → performance | security | full | …> — <YYYY-MM-DD HH:MM> (run `<runid>`)

- Code under test: HEAD `<sha>` "<subject>" — clean tree | <n> changed paths (research read the working tree)
- App measured: dev | packaged `<version>`, pid `<pid>` | no app running
- Areas: triaged <all | …> · researched <…>
- Result: **<n> findings** — S1 <n> · S2 <n> · S3 <n> · S4 <n> · leads <n> · already known <n>

## 1. Triage (auto and full only)

| Area | Strongest surviving signal | Best finding | |
| --- | --- | --- | --- |
| <area> | <the measure, with its number> | <EN-xx and severity, or "none survived"> | researched / not |

## 2. Baseline — what the fixes will be judged against

| Measure | How it was taken | Value |
| --- | --- | --- |

## 3. Findings, ranked

<one block per finding, in rank order — the template below>

## 4. Leads not verified

<one line each: the signal, why it was not confirmed, what would confirm it>

## 5. Already known

<backlog ids and memory notes the research ran into — named, not re-filed>

## 6. Not examined

<what the contract, the time box or a missing app kept out, said plainly>

## 7. Decision

<the prompt below>
```

## A finding

```markdown
### EN-12 · <the claim, in one line> — S2 · Measured · M

- **Area:** <area> · **Owner:** this skill | `owa-enhance-mcp` | …
- **Evidence:** the numbers, `file:line` links, the console line, the screenshot path.
- **Failure scenario:** who, doing what, on what machine → what goes wrong.
- **Proposed change:** the smallest change that removes the cause — which files, what approach.
- **Trades away:** what gets worse — code, a convenience, a feature's speed — or "nothing measurable".
- **Proof on apply:** the measurement re-taken / the test that fails first / the live check.
- **Bears on it:** backlog ids or memory notes, or "none found".
```

A finding whose cure is a design choice says so under *Proposed change* and
lays out the options with what each costs. Choosing between them is the user's
call, not the run's.

## The rubric

### Severity — what happens to the person at the machine

| | Means | The shape of it in this app |
| --- | --- | --- |
| **S1 Critical** | Data lost; a live screen blanked or taken over; code from outside running on the operator's machine; the app unusable on the hardware it targets | a write race that deletes every screen's on-screen state; outside text reaching an HTML sink in a node-integrated window; a window that pushes an old laptop into swap |
| **S2 High** | A core flow — song, verse, slide, background, screen control — broken or measurably slow on target hardware; a security weakness with a plausible path; a crash off the main path | memory that grows with every document opened; an IPC handler that follows a path out of the data folder |
| **S3 Medium** | Friction or confusion for a volunteer; waste not yet user-visible; a cost paid on every change | an error that says nothing useful; a gate that takes ten minutes; risky, moving code with no test |
| **S4 Low** | Polish, consistency, tidiness | a hard-coded colour beside the tokens; a stale note |

*Unusable on a low-spec machine* is S1, not S2: to the volunteer at that
machine it is a crash.

### Confidence — how it is known

- **Measured** — a number or a reproduction, taken this run.
- **Traced** — the code path read end to end, the failure scenario written.
- **Suspected** — a pattern match. It goes under *Leads*, never *Findings*.

### Effort

- **S** — one file, under ~50 lines, no new test infrastructure.
- **M** — a few files, or a new test harness.
- **L** — across processes or modules, or a design decision to make first.

### Order

Severity, then confidence, then the smaller effort.

## Ids

A finding is proposed as the next free `EN-xx`: one above the highest id in
[backlog.md](./backlog.md) AND in any report saved under
`test-results/owa-enhance/`, so two reports awaiting a decision cannot mint the
same id. A finding a sub-skill owns is proposed under that skill's prefix
instead — `EC-` the chatbot, `MC-` the MCP server, `AC-` the AI Chat window —
counted from that skill's backlog. An id may go unused when a report is
dropped; a filed id never changes meaning.

## The decision

End the report with this, then end the turn:

```text
Nothing has been changed. Reply with:
  apply EN-12 EN-15   implement those (or: apply all)
  file                record every finding in the backlog, change no code
  deeper EN-14        research that one further first (still read-only)
  drop                discard the report
```

A plain reply is an answer too — *"do the first two"*, *"just the memory
one"*. Map it to ids and say which you took it to mean before starting; ask
only when it could mean two different things.
