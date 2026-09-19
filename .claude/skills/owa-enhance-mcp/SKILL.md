---
name: owa-enhance-mcp
description: 'Make `tools/owa-devtools-mcp` — the MCP server the Open Worship App both SERVES and IS DRIVEN BY — safer, cheaper and better at its two jobs: driving the app for a developer/QA agent over stdio, and answering a volunteer through the in-app chatbot over HTTP. Use when asked to enhance / improve / harden / secure / speed up / slim down the MCP, the owa-devtools tools, the `owa_*` tools, the tool surface, the MCP host or its firewall; to add, sharpen, merge or prune a tool; to cut the tool-schema tokens the chatbot pays on EVERY round of EVERY question; to fix a tool that misfires, returns unusable output, or works for one caller and not the other; to review what an agent driving this app is allowed to do; or to answer "is this safe to ship to a church back room". Covers `tools/owa-devtools-mcp/*` end to end — `server.mjs` (assembly), `firewall.mjs` (the policy layer: denied tools, the destructive-action interlock, the URL allowlist, secret redaction, the rate limit), `owaTools.mjs` (the `owa_*` tools), `domMatch.mjs` (find/click/type), `guide.mjs` (walkthrough cards), `help.mjs` (knowledge search), `questions/*` (the supported-question corpus), `notify.mjs` (the "something is driving your app" banner), `host.mjs` (the in-app HTTP door), `bin.mjs`/`cdp.mjs`/`discovery.mjs` (the stdio door) — plus the app-side surface that door opens onto: `electron/aiHelpers.ts`, `electron/client/rendererLockdown.ts` and the chatbot window CSP. THE SECURITY RULE THAT BINDS EVERY CHANGE: this server drives renderers running with `nodeIntegration: true`, so a tool that can run code, load a foreign page, or read raw memory is arbitrary code execution on the operator machine, reachable by a prompt-injected model reading an attachment the user was handed — see references/threat-model.md, which carries the proven exploit and the harness that re-proves it. Every run MEASURES FIRST (scripts/probe-mcp.mjs for the policy, the chatbot skill audit-mcp-tools.mjs for the token bill), states the before/after numbers, verifies LIVE against the running app — a tool change that only typechecks is not done — and leaves the paper trail: the README tool table, CLAUDE.md Agent access, references/backlog.md MC-xx ids and the `.github/` mirror.'
argument-hint: '[security | perf | tools | dx | chatbot | audit | full — or a plain description of the change]'
---

# OWA Enhance MCP — the server both the developer and the chatbot drive

`tools/owa-devtools-mcp` is a small package with an unusually large blast
radius. It is chrome-devtools-mcp aimed permanently at this app, plus this
app's own `owa_*` tools, served through **two doors onto the same server**:

| Door | Who | How |
| --- | --- | --- |
| **stdio** (`bin.mjs`) | a developer's agent — Claude Code, `/owa-robot-test` | `./.mcp.json` spawns it |
| **HTTP** (`host.mjs`) | the app's own help chatbot, and any client that would rather connect | `startMcpHost()` in `electron/aiHelpers.ts` |

One server, two callers, four properties to hold at once:

1. **Safe** — it cannot be talked into harming the operator. This one is not
   negotiable and it comes first; §A and [references/threat-model.md](./references/threat-model.md).
2. **Cheap** — every schema is re-sent to the model on every round of every
   question. Tool surface IS chatbot latency and cost; §B.
3. **Good for a developer** — an agent must be able to drive, inspect and QA
   the real app without guessing; §C.
4. **Good for the chatbot** — a non-technical volunteer, mid-service, must get
   a correct answer or a control ringed on screen; §D.

Those pull against each other, and that tension is the whole subject of this
skill. Denying a tool makes it safer and cheaper and takes something away from
the developer. Adding one helps the chatbot and taxes every question. **Say
which of the four a change trades away, every time.**

## Relationship to `owa-enhance-chatbot`

They overlap on purpose and split cleanly:

- **`owa-enhance-chatbot`** owns the ASSISTANT — whether an answer is right,
  the system prompt, the knowledge corpus, the window, the ladder and the
  scoreboard. Tools are one of its areas.
- **This skill** owns the SERVER — what the tools are, what they cost, what
  they are allowed to do, and that both callers get the same thing.

If the complaint is "the answer was wrong", that is the chatbot skill. If it is
"the tool did the wrong thing / cost too much / should not exist / should
exist", it is this one. Its tool catalogue and authoring checklist —
[`../owa-enhance-chatbot/references/mcp-tools.md`](../owa-enhance-chatbot/references/mcp-tools.md)
— is not duplicated here; read it before writing a tool.

## Non-negotiables

Breaking one of these is a regression even when the feature works.

1. **One server, two callers.** Anything added for one is shipped to the other.
   Behaviour may differ by *policy* (the firewall's `OWA_MCP_FIREWALL=off` is
   set by the person who launched the process, not by the caller), never by
   sniffing who is asking.
2. **The firewall is not optional and cannot be reached from the wire.** No
   tool relaxes it, no argument bypasses it, and its off switch is an
   environment variable only. If a change needs the firewall relaxed to work,
   the change is wrong.
3. **A tool that acts must announce itself** — `ACTING_TOOLS` in `notify.mjs`,
   or it changes the operator's window with no banner. `audit-mcp-tools.mjs`
   fails you on this.
4. **A tool that acts must be in `firewall.mjs`'s `ACTING_TOOL_SET`** too, or
   it is outside the rate limit and a loop can hammer a live service with it.
   The two lists are deliberately separate — one decides what to SAY, one what
   to COUNT — so adding a tool means considering both.
5. **Never `import()` an app module from an injected page expression.** It
   re-runs module top-level code and kills every keyboard shortcut in the app
   (memory: `cdp-dynamic-import-hijack`). Page expressions stay dependency-free
   strings.
6. **Performance outranks elegance** (CLAUDE.md). No long-lived cache, no
   preloaded corpus, no unbounded map. `cdp.mjs` opens and closes a socket per
   call on purpose; the knowledge is read one file at a time.
7. **`.mjs` under `tools/` is plain ESM, no TypeScript**, and
   `tools/**/*.test.mjs` DOES run in `npm test`.
8. **Everything under `.claude/skills/` ships** — the knowledge allowlist takes
   `skills/` whole, into the installer, in plaintext, on every operator's disk.
   No secrets, no keys, no customer names, and keep it lean.
9. **Anything that changes what a congregation sees is offered, never done.**

## Procedure

### 0. Get a live app and a baseline

The app must be RUNNING — the point is verifying against it.

```bash
# what the policy actually does, end to end, through a FRESH server
node .claude/skills/owa-enhance-mcp/scripts/probe-mcp.mjs

# what the surface costs the chatbot on every round
node .claude/skills/owa-enhance-chatbot/scripts/audit-mcp-tools.mjs
```

Write both numbers down before you change anything. "It feels better" is not a
result, and the token bill is the one number a reviewer can check.

> **Two processes go out of step.** Editing a `.mjs` here does NOT change the
> server already running: the app's HTTP host cached `server.mjs` on its first
> session, and your own `mcp__owa-devtools__*` tools are a separate long-lived
> process (memory: `mcp-tool-edit-two-processes`). `probe-mcp.mjs` spawns a
> fresh stdio server for exactly this reason — it is the only way to see your
> edit without restarting the app. Restart the app before trusting the audit
> script or the chatbot.

> **Build order.** `npm run build` / `electron:build` deletes
> `electron-build/`, which is the running app's own main entry, so it kills the
> app (memory: `build-kills-running-dev-app`). **Verify live FIRST, run the
> gate LAST.** The exception is knowledge work, which needs the build before it
> exists at all.

### 1. Decide what kind of change this is

Take it in this order of preference, because the cheapest safe surface is the
best one:

**Remove → deny → merge → sharpen → add.**

A tool the model never calls is worse than no tool: it costs tokens on every
round of every question and adds a wrong turn to take. A tool that can hurt the
operator is worse than a missing feature.

### 2. Do the work — §A–D below

### 3. Verify LIVE — mandatory

| Change | Proof |
| --- | --- |
| Firewall policy | `probe-mcp.mjs` shows the refusal, AND the thing it protects still fails to happen when tried for real |
| A tool added/changed | It is in `tools/list`; call it through a fresh server; the app reacts; the banner appears if it acts |
| A denial or a prune | Tool count and tokens/round move by the amount you predicted — **at the host AND to the model**, which are different numbers |
| Anything the chatbot touches | Ask a real question in the real window, after an app restart |
| Anything touching the guide | Start a guide and see the red ring land on the real control |
| Host / doors | A second session still opens; the idle sweep still closes one |

`mcp__owa-devtools__evaluate_script` fails with "DisposableStack is not
defined" under Node 22 (memory: `evaluate-script-disposablestack`) *and* is now
refused by the firewall. Drive pages over raw CDP `Runtime.evaluate` —
`cdp.mjs` and the verify scripts already do.

### 4. Run the gate, last

```bash
npm run lint
```

`&&`-chained: the first failing stage stops the rest, so a typecheck failure
means the tests, prettier, eslint and the build check never ran. Read the log
body, not the exit code. It only checks, so it is safe beside the running app
(`EN-16`).

### 5. Land the paper trail

In the SAME change, whatever is true of the work:

- `tools/owa-devtools-mcp/README.md` — the tool table, for any tool change.
- `.claude/CLAUDE.md` §*Agent access* — anything structural: a door, a policy,
  the master switch, the tool list.
- [references/backlog.md](./references/backlog.md) — `MC-xx` status, plus
  everything you found and did NOT do.
- `docs/test-paths/coverage-matrix.md` — the `CB-xx` rows, if user-visible.
- A memory file under `.claude/memory/` for anything not derivable from the
  code, plus its `MEMORY.md` line.
- **The `.github/` mirror.** `.github/skills/`, `.github/memory/` and
  `.github/copilot-instructions.md` mirror `.claude/`. `.claude/` is the source
  of truth: edit here, then COPY across in the same change. A mirror that
  disagrees is stale by definition — re-copy, do not reconcile by hand.
- **Any edit under `.claude/` needs `node extra-work/build-knowledge.mjs` in
  the same change**, or the chatbot keeps answering from the previous text.

## Areas

### A. Security — the one that comes first

Full model, the proven exploit, and what is still open:
**[references/threat-model.md](./references/threat-model.md).** The short form:

- Every renderer runs with `nodeIntegration: true` and
  `contextIsolation: false`. A tool that can run code in a page, load a foreign
  page into one, or read its raw memory is **arbitrary code execution on the
  operator's machine**, and it is reachable by a model that has just read an
  attachment somebody handed the user.
- `firewall.mjs` is the answer, at the one seam both doors share. It refuses
  the escape-the-app tools outright *and* drops them from `tools/list`; it
  allowlists navigation to the app's own pages; it holds the **point, don't
  press** interlock (a label that cannot be undone is refused with an
  instruction to ring it and let the user press it); it rate-limits acting
  calls; and it scrubs provider keys and tokens out of results on the way back.
- The window that talks to a language model is locked down separately:
  `electron/client/rendererLockdown.ts` takes `require` and friends away from
  `chatbot.html` in the preload, and that page carries its own tighter CSP with
  a `connect-src` allowlist.

When adding to the policy: a refusal is written **for the model** — what was
refused, why, and what to do instead — so a block becomes correct behaviour
rather than a dead end it apologises for. Test it in `firewall.test.mjs`, which
runs with no app.

**Never widen the policy to make a tool convenient.** If a tool needs
`evaluate_script` to work, it needs to become an `owa_*` tool with a narrow
schema instead — that is exactly why `owa_app_state`, `owa_list_ui` and
`owa_find_ui` exist.

### B. Performance — the bill the chatbot pays every round

`llmBotHelpers.ts` sends every tool `tools/list` returns to the model on EVERY
round of the loop (`MAX_TOOL_ROUNDS` 10). Read
[references/tool-budget.md](./references/tool-budget.md) for the measurements
and the levers. In order of size:

1. **Fewer tools.** 29 of them are chrome-devtools'. Each one removed is its
   whole schema off every round of every question.
2. **Shorter schemas.** Description length is the model's reading cost and
   yours; say what the tool is FOR and when to reach for it, not how it works.
3. **Fewer rounds.** A tool that answers the question completely saves a whole
   round — prompt, history, every schema, again. This is why `owa_list_ui`
   returns labels *and* positions *and* enabled state in one call.
4. **Smaller results.** `owa_app_state` used to carry the user's data directory
   and forty dev-only component names into the context of every question.

And on the app side: nothing is cached between questions on purpose, `cdp.mjs`
holds no socket, `host.mjs` caps sessions at 8 and sweeps after 15 idle
minutes. If you add a cache it must be short-lived, bounded, and carry a
comment saying why.

### C. The developer's door — driving the real app

`/owa-robot-test` and any agent working on this repo drive the app through this
server. What makes it good for them:

- **`owa_list_ui` before acting.** Half the labels in this app are on more than
  one control and much of the UI is painted only under the mouse (memory:
  `hover-hidden-controls`). `domMatch.mjs` classifies `shown`/`hidden`/`gone`
  and forces the hover itself.
- **Honest failure.** A tool that matches nothing answers with the near misses,
  so the next call is a correction rather than a guess.
- **`data-widget-name`** is the one component name in production DOM; the
  `data-react-comp-*` attributes are dev-only.
- When the firewall is genuinely in the way of a QA run, the developer sets
  `OWA_MCP_FIREWALL=off` in their own `.mcp.json`. Document that in the run,
  and never make it the default.

### D. The chatbot's door — a volunteer, mid-service

- **A tool description has two readers**: a model choosing between 44 of them,
  and — through what the model then says — a volunteer about to be acted upon.
- **Labels are i18n templates.** The knowledge is English, the buttons are not:
  `[en:tran:Clear Bible]` is filled in with what that key reads as in the
  language the app is DISPLAYING, so a `find` matches the DOM in a Khmer
  window. `owa_tran` answers the same question for a label the model wrote.
- **`questions/*.json` changes in the SAME commit as any recipe or UI it
  describes** (memory: `question-corpus-maintenance`).
- **Drive what you changed.** Two of this skill's own findings — a policy that
  refused reloading the page in front of it, and an audit check that had never
  run on Windows — were invisible from reading and obvious from one call. A
  false refusal only shows from the driving seat.
- **29 tools are registered and withheld from the chatbot's model** (of 53,
  2026-09-14) by
  `tools/owa-devtools-mcp/modelTools.mjs` — the window's own three plus
  `take_screenshot`, the uid-aimed acting group, the window openers and the
  developer instruments. That module is the choke point for pruning what the
  model sees without taking anything from the developer, and it has the same
  two enforcement points the firewall has: the list is filtered AND the call is
  refused, because these tools are named in the app's own manual and a filtered
  list alone is a suggestion.

## What counts as an improvement

- A way to harm the operator that is now impossible, with the attempt shown
  refused.
- Fewer tokens or fewer rounds for the same answer, measured.
- A tool that acts and could not be invoked without the operator seeing it.
- A failure that used to be silent now says something true.
- An agent or a volunteer can now do something they could not.

Not an improvement: a new tool nothing calls, a longer description with no bad
behaviour behind it, a cache, a policy hole opened for convenience, or a
capability only reachable by someone who already knows the internals.

## Resources

- [references/threat-model.md](./references/threat-model.md) — what an agent
  driving this app can reach, the proven exploit, the policy, what is still
  open. **Read before any security change.**
- [references/tool-budget.md](./references/tool-budget.md) — what the surface
  costs and how to cut it.
- [references/backlog.md](./references/backlog.md) — tracked `MC-xx` items.
- [scripts/probe-mcp.mjs](./scripts/probe-mcp.mjs) — spawns a FRESH server and
  exercises the policy against the live app. Read-only apart from refusals it
  expects to be refused.
- [`../owa-enhance-chatbot/references/mcp-tools.md`](../owa-enhance-chatbot/references/mcp-tools.md)
  — tool catalogue and authoring checklist.
- [`../owa-enhance-chatbot/scripts/audit-mcp-tools.mjs`](../owa-enhance-chatbot/scripts/audit-mcp-tools.mjs)
  — the token bill.
- `/owa-robot-test` — QA the result; chatbot rows are `CB-01..CB-14`.
