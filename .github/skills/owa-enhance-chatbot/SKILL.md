---
name: owa-enhance-chatbot
description: 'Raise the Open Worship App in-app help chatbot toward being genuinely great — it is NOT there yet, and this skill is the repeatable climb that keeps making it better, run after run, against a stated ladder (it answers → it answers correctly → it acts reliably → it is trustworthy under pressure → it is situational → it is the fastest way to use the app) and a scoreboard that carries the score across runs so a regression is visible. Covers everything belonging to that chatbot and the MCP tool surface it runs on — `src/chatbot/*` (the window, the LLM loop, the offline fallback, the session tabs, the MCP client), `tools/owa-devtools-mcp/*` (the `owa_*` tools, the guide cards, the knowledge search, the HTTP host, the "something is driving your app" banner), `electron/aiHelpers.ts` (the CDP + MCP doors, the master switch, endpoint discovery) and `extra-work/build-knowledge.mjs` (the manual + internal corpora the answers come from). Use when asked to enhance / improve / extend / fix / speed up / harden the chatbot, the assistant, the help bot, the 🤖 button, `chatbot.html`, the AI answers, the walkthrough guide cards, or the app help; and ESPECIALLY when asked to enhance the MCP tools — add a new `owa_*` tool, sharpen a tool description or schema, cut the tool-schema token cost the model pays on every round, fix a tool that misfires or returns unusable output, or make the tool set safer for a volunteer running a live service. Every `tools/list` schema is sent to the model on EVERY round of EVERY question (measure it with `scripts/audit-mcp-tools.mjs` — 42 tools, ~8.5k tokens per round today), so tool surface IS chatbot performance. Also use it for the open-ended ask — "make the chatbot smarter / easier to use / more impressive", "what could the assistant do better", "research how to improve the help bot" — because EVERY run RESEARCHES BEFORE IT BUILDS (references/research.md): it interrogates the live assistant with a standing corpus of real volunteer questions and grades each answer (correct? actionable? internals leaked? how many tool rounds? did the walkthrough ring land on the real control?), mines the app for capability gaps the assistant cannot see or do, looks outside via WebSearch/WebFetch and the claude-api skill when the problem is a known one, and files every evidenced opportunity as a stable EC-xx backlog id — then builds the top-ranked one. The workflow baselines the live tool surface, picks work off that research plus the tracked backlog (references/backlog.md, EC-xx ids), implements against the project rules that bind this subsystem (low-spec-first performance, `Comp` naming, no app-module imports from injected page scripts, English-only chatbot window), verifies LIVE against the running app through the app own owa-devtools MCP — a chatbot change that only typechecks is not done — then runs the `npm run lint` gate and updates the paper trail: the CB rows in docs/test-paths/coverage-matrix.md, the W-42 manual recipe, the MCP package README, CLAUDE.md and the `.github/` Copilot mirror.'
argument-hint: '[research (research only, ship nothing) | tools | prompt | knowledge | ui | perf | reliability | audit | full — or a plain description of the improvement]'
---

# OWA Enhance Chatbot — the assistant and its MCP tools

**The chatbot is not good enough yet.** It answers, it can point at a control, it
can walk someone through a task — and it still hands a volunteer the wrong
window's steps, burns rounds looking things up, ships 42 tool schemas per round,
and can pour 52 000 tokens of developer notes into one answer. This skill exists
to close that gap, run after run, until asking the app is genuinely the fastest
way to operate it.

So this is **a climb, not maintenance**. Every run must leave the assistant
measurably better than it found it, and say by how much. `/owa-robot-test` walks
the app and reports; this skill changes it and proves the change in the running
app.

> **Read before touching a tool:**
> [references/mcp-tools.md](./references/mcp-tools.md) — the tool catalogue and the
> authoring checklist. A new tool that skips it acts on the user's window silently,
> costs every question tokens forever, or works for the agent and not the chatbot.

Every run **researches first** (§1): it interrogates the live assistant, grades
what comes back, and files what it finds — then builds. No implementation opens a
run.

## What "greater" means — the ladder

Where the assistant is, and what the next rung is. Each run says which rung it is
on, from evidence, and what it did to move up. **Judge by the worst answer a
volunteer can get, not the best** — one confident wrong answer mid-service costs
more than ten good ones earn.

| Rung | It is true when | Status |
| --- | --- | --- |
| **1 · It answers** | A question gets a relevant manual answer, offline and online, and never a stack trace. | reached |
| **2 · It answers *correctly and usably*** | Right for the window they are in, numbered steps, no path/id/component name ever, English, honest when the app cannot do the thing. | **partly — the current front line** |
| **3 · It acts, reliably** | The ring lands on the real control, the walkthrough survives a wrong guess, demo mode does the step, and every acting call is announced and safe near a live service. | partly |
| **4 · It is trustworthy under pressure** | Recovers from its own wrong turns without the user noticing, answers in 1–2 rounds, costs little enough to use freely, and degrades honestly when the network or the key dies. | not yet |
| **5 · It is situational** | Knows what is on screen and what the user is in the middle of; handles "nothing is showing on the projector" end to end; suggests the next step before being asked. | not yet |
| **6 · It is the fastest way to use the app** | A volunteer would rather ask than click. | the point of the climb |

Update the Status column when the evidence changes — up **or** down. A rung is
"reached" only when the whole question corpus holds it, not when one answer does.

## When to use

- "Improve / enhance / extend the chatbot", "make the assistant better", "the help
  bot gives bad answers", "add a tool to the MCP", "the AI answers are slow".
- "Make it **smarter / easier / more impressive**" — the three axes the research
  phase grades against ([references/research.md](./references/research.md)).
- **"enhance the MCP tools"** → §A, grounded in
  [references/mcp-tools.md](./references/mcp-tools.md).
- A new app feature landed and the assistant cannot answer about it yet
  (knowledge work, §C).
- The tool loop burns rounds, tokens, or money → §D.
- Something in the chatbot window itself: tabs, model picker, copy, layout → §E.

Not this skill: pure QA of the chatbot (that is `/owa-robot-test`, rows `CB-01..CB-14`),
and app features that merely happen to be *described* by the manual.

## The subsystem, in one list

| Piece                             | Where                                                                                                 |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| The window                        | `html/chatbot.html` → `src/chatbot/ChatbotAppComp.tsx` (+ `.scss`)                                       |
| Conversation tabs                 | `src/chatbot/chatSessionHelpers.ts` — `local-storage/chatbot-sessions`, 12 tabs × 60 messages             |
| Offline bot (no key / fallback)   | `src/chatbot/helpBotHelpers.ts` — manual search only, plus `genGuideActions` / `runBotAction`             |
| LLM loop, providers, models       | `src/chatbot/llmBotHelpers.ts` — the system prompt, `MAX_TOOL_ROUNDS`, Anthropic + OpenAI                 |
| MCP client                        | `src/chatbot/mcpClient.ts` — one session, re-opened on a 404 sweep                                       |
| App-level tools                   | `tools/owa-devtools-mcp/owaTools.mjs` — the 13 `owa_*` tools                                             |
| DOM matching for `find/click/type`| `tools/owa-devtools-mcp/domMatch.mjs` (+ test)                                                          |
| Walkthrough cards                 | `tools/owa-devtools-mcp/guide.mjs` (+ test) — shadow-root card, `demo` mode                              |
| Knowledge search                  | `tools/owa-devtools-mcp/help.mjs` — reads `electron-build/knowledge/index.json`                          |
| "Something is driving your app"   | `tools/owa-devtools-mcp/notify.mjs` (+ test) — `ACTING_TOOLS`                                            |
| Server assembly                   | `tools/owa-devtools-mcp/server.mjs` — chrome-devtools-mcp + `registerOwaTools`, telemetry forced off      |
| In-app HTTP door                  | `tools/owa-devtools-mcp/host.mjs` — 8 sessions max, 15-minute idle sweep                                 |
| Outside-agent stdio door          | `tools/owa-devtools-mcp/bin.mjs`, `cdp.mjs`, `discovery.mjs`                                            |
| Doors + master switch             | `electron/aiHelpers.ts` — `enableRemoteDebugging`, `startMcpHost`, `publishAiEndpoints`, `checkIsAiEnabled` |
| Knowledge bundle                  | `extra-work/build-knowledge.mjs` → `electron-build/knowledge/` (part of `electron:build`)                 |
| Live verification scripts         | `extra-work/verify-chatbot-tools.mjs`, `extra-work/verify-chatbot-e2e.mjs`                               |
| QA rows / user recipe             | `docs/test-paths/coverage-matrix.md` §CB · `docs/manual-sources/.../w-42-*.md`                           |

Full data flow and the invariants that hold it together:
[references/architecture.md](./references/architecture.md).

## Non-negotiables

These bind every change in this skill. Breaking one is a regression even if the
feature works.

1. **One server, two callers.** The chatbot (HTTP) and an outside agent (stdio)
   get the SAME tool set from `server.mjs`. Anything added for one is shipped to
   the other. Never fork behaviour on the caller without saying so in the code.
2. **A tool that acts must announce itself.** Add it to `ACTING_TOOLS` in
   `notify.mjs` or it changes the operator's window with no banner. The audit
   script fails you on this.
3. **Never `import()` an app module from an injected page expression.** It re-runs
   module top-level code and kills every keyboard shortcut in the app (memory:
   `cdp-dynamic-import-hijack`). Page expressions stay dependency-free strings.
4. **The chatbot window is English-only, on purpose.** No `tran()` in
   `src/chatbot/*`. The 🤖 button and the Help menu item live OUTSIDE it and do
   go through `tran()` — a missing Khmer key there throws and blanks the page.
5. **Performance outranks elegance** (CLAUDE.md). Nothing is cached between
   questions; the knowledge corpus is read one file at a time. Do not introduce a
   long-lived map, a preloaded corpus, or a per-keystroke tool call.
6. **Never quote internal notes to a user.** `kind: 'internal'` hits exist so the
   model can *understand*; the answer says what to press. This includes anything
   you write in this skill.
7. **Everything markdown you add under `.claude/skills/` ships** — the knowledge
   allowlist in `build-knowledge.mjs` takes `skills/` and `memory/` whole, into the
   installer, in plaintext, on every operator's disk. Keep docs lean; no secrets,
   no keys, no customer names.
8. **Anything that changes what a congregation sees is offered, never done.**
   `owa_hide_screens`, presenting, clearing — confirm with the user first, in the
   skill and in the product.

## Procedure

### 0. Get a live app and the MCP tools

The app must be RUNNING: the whole point is verifying against it.

```bash
node .claude/skills/owa-enhance-chatbot/scripts/audit-mcp-tools.mjs
```

If it says nothing is publishing an endpoint, start the app (see CLAUDE.md — the
harness needs `env -u ELECTRON_RUN_AS_NODE npm run dev`) and re-run. Load the
`owa-devtools` MCP tools too (`mcp__owa-devtools__*`); `list_pages` should show
`presenter.html` or `reader.html`.

**Order matters:** `npm run build` / `electron:build` deletes `electron-build/`,
which is the running app's own main entry — it kills the app (memory:
`build-kills-running-dev-app`). So **verify live FIRST, build last**. The one
exception is knowledge work (§C), which needs a rebuild to take effect; there,
plan for the restart.

### 1. RESEARCH — mandatory, every run

**Never open with an implementation.** Every run first goes and finds out where
the assistant is actually weak, measured against three axes: is it **smarter**
(right answer, right source, fewer rounds), **easier** (less for a stressed
non-technical volunteer to do), **more impressive** (the app visibly and safely
acting on itself).

The full playbook — question corpus, scorecard, gap-mining commands, the filter an
idea has to survive — is [references/research.md](./references/research.md). The
short form, all four tracks, in a run:

- **A · Interrogate the live assistant.** Ask the standing question corpus in the
  real window and GRADE the answers: correct? actionable? internals leaked? how
  many rounds? which tools, in what order? did it offer a walkthrough, and did the
  ring land? Keep the transcripts — a verbatim bad answer is what makes an
  improvement provable.
- **B · Mine the app for capability gaps.** What can a user DO that the assistant
  cannot see, cannot explain, or cannot do for them? Cross the `W-xx` recipes and
  recent commits against the tool catalogue.
- **C · Look outside** when the problem is a known one — MCP/tool-design practice,
  provider behaviour, retrieval ranking — with `WebSearch`/`WebFetch` and the
  `claude-api` skill (never answer model/pricing questions from memory). Bring
  back a specific applicable change, not a summary.
- **D · Read the seams** when chasing a defect: the dev terminal's tool log, the
  comments in these files (they record why the obvious alternative was wrong), and
  the offline bot, which sometimes answers better than the model does.

Also record the hard baseline: the audit numbers (tool count, tokens/round,
warnings), the `CB-xx` rows the area touches, the current `W-42` steps. Without a
baseline you cannot show an improvement, and "it feels better" is not a result.

Even when the user names the exact change they want, do a **short** Track A pass
first on the area it touches. It routinely turns a one-line request into the right
one-line request.

### 2. Pick the work

Rank what research found — **wrong answers → unsafe acting tools → cost → new
capability → polish** — and merge it with
[references/backlog.md](./references/backlog.md), the tracked `EC-xx` items with a
rationale, evidence and a status. A wrong answer to a volunteer mid-service
outranks everything else here.

Then:

- **File everything research surfaced** as `EC-xx` items with the evidence
  attached — including the ones you are not going to do. That is what the stable
  ids are for, and it is why the next run starts ahead of this one.
- **Do the user's ask** if they gave one; otherwise take the top of the ranking.
  Prefer one evidenced change, shipped and proven, over three speculative ones.
- Say out loud which axis the work scores on, **and which rung it moves**. An idea
  that scores on none of the three, or moves no rung, is not work.

**The ratchet.** A question that scored a pass in an earlier run must never come
back failing. Check the previous run's scorecard
([references/scoreboard.md](./references/scoreboard.md)) before you pick, and
treat a regression as the top of the ranking, above everything new.

**Swing bigger when the rung is capped by design.** Small safe fixes are the right
default for a defect, and the wrong default for a ceiling. When research shows the
current shape cannot reach the next rung — the tool set is wrong for the audience,
the loop cannot recover from its own mistakes, the knowledge is the wrong
granularity — propose the structural change, size it honestly, and put it to the
user rather than shaving another 200 tokens off a description. Rung 4 and above
will not be reached by tidying.

The argument `research` stops here: run §1 in full, file everything, report the
ranked list, ship nothing. Use it when the user wants to decide what to build
rather than have it built.

### 3. Implement

Area rules are in the **Areas** section below. Across all of them:

- Match the surrounding style. These files are commented in a distinctive voice
  (what it does *and why the obvious alternative is wrong*) — keep it.
- React components end in `Comp`. `useAppCurrentRef` conventions apply in
  `src/chatbot/*` like anywhere else.
- `.mjs` files under `tools/` are plain ESM, no TypeScript, and their tests
  (`tools/**/*.test.mjs`) DO run in `npm test`.
- Add or extend a test when the logic is testable without a live app —
  `domMatch.mjs`, `guide.mjs`, `notify.mjs`, `help.mjs` ranking, session
  trimming, error description. Tool handlers that need CDP are verified live
  instead (§4).

### 4. Verify LIVE — mandatory

A chatbot change is not done because it typechecks. Prove it in the running app.
Full recipes: [references/verification.md](./references/verification.md). The
minimum for any change:

| Change                       | Proof                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| A tool (added/changed)       | `audit-mcp-tools.mjs` shows it; call it through the MCP; the app reacts; the banner appears if it acts |
| A prompt / loop change       | Ask a real question in the real window, both providers if the change is provider-neutral      |
| Knowledge / manual           | Rebuild, then `owa_help_search` returns the new page and the answer uses it                   |
| Window UI                    | Screenshot the chatbot window before and after                                               |
| Anything touching the guide  | Start a guide and see the red ring land on the real control                                  |

`extra-work/verify-chatbot-tools.mjs` (read-only + two harmless actions) and
`extra-work/verify-chatbot-e2e.mjs` (drives the real window, spends real API
credit — ask the user first) are the ready-made harnesses.

> `mcp__owa-devtools__evaluate_script` currently fails with "DisposableStack is
> not defined" under Node 22 (memory: `evaluate-script-disposablestack`). Drive
> pages over raw CDP `Runtime.evaluate` instead — `cdp.mjs` and both verify
> scripts already do.

### 5. Run the gate

```bash
npm run lint
```

It is `&&`-chained: the first failing stage stops the rest, so a `test:all`
failure means the typecheck, prettier, eslint and build never ran. Read the log
body, not the exit code. Expect `lint:pre` to rewrite formatting.

Remember the gate ends in a `build`, which kills the running app — so this is the
last step, after live verification.

### 6. Land the paper trail

In the SAME change, whatever is true of the work:

- `docs/test-paths/coverage-matrix.md` — add or rewrite the `CB-xx` row, bump the
  version banner at the top of the file the way the existing entries do.
- `.claude/skills/owa-robot-test/references/user-workflows.md` and the generated
  `docs/manual-sources/.../w-42-*.md` — only for user-visible behaviour, and only
  steps you watched work.
- `tools/owa-devtools-mcp/README.md` — the tool table, for any tool change.
- `.claude/CLAUDE.md` §*Agent access* — for anything structural (a door, the
  master switch, the knowledge bundle, the tool list).
- `references/backlog.md` here — status of what you did, plus anything you found
  and did not do.
- **The `.github/` mirror.** `.github/skills/owa-enhance-chatbot/`,
  `.github/memory/` and `.github/copilot-instructions.md` mirror `.claude/`.
  `.claude/` is the source of truth: edit here, then COPY across in the same
  change. A mirror that disagrees is stale by definition — re-copy, do not
  reconcile by hand.
- A memory file under `.claude/memory/` when you learned something that is not
  derivable from the code (plus its `MEMORY.md` line, plus the mirror).

### 7. Report

Close every run with the research AND the change — the research is half the
deliverable, and it is what makes the next run start ahead of this one:

1. **Scorecard summary** — how many of the graded answers were correct,
   actionable, leaked internals; the worst one, quoted.
2. **Audit numbers, before and after** — tool count, tokens/round.
3. **Ranked opportunity list**, with the new `EC-xx` ids you filed.
4. **What shipped**, which axis it scores on (smarter / easier / more impressive),
   which rung it moved, and **the same question asked again** to prove it.
5. **What you did not do**, and why — left in the backlog, not in your head.
6. **A row appended to [references/scoreboard.md](./references/scoreboard.md)**,
   with the raw per-question detail in
   `test-results/chatbot-quality/score-<runid>.json`. This is what makes the next
   run a step in a climb instead of a fresh opinion — and it is where a regression
   becomes visible.

## Areas

### A. Tools — the main event

Everything about adding, sharpening, pruning and testing `owa_*` tools lives in
[references/mcp-tools.md](./references/mcp-tools.md): the catalogue, the authoring
checklist, the description voice (two readers: an LLM choosing, and a volunteer
about to be acted upon), schema rules, the `notify.mjs` requirement, and how to
tell a genuinely-missing tool from one the model just never picks.

Work it in this order:

1. Run the audit. Note the token cost and any warning.
2. Decide **prune / sharpen / add**, in that preference order. A tool the model
   never calls is worse than no tool: it costs tokens on every round of every
   question and adds a wrong turn to take.
3. For a new tool, follow the checklist end to end — a tool is not "added" until
   it is registered, described, announced (if it acts), tested, verified live and
   documented in the README.
4. Re-run the audit and put the before/after numbers in your report.

### B. Answer quality — the system prompt and the tool loop

`genSystemPrompt` in `llmBotHelpers.ts` is the whole behavioural contract. It is
long because every paragraph in it was earned by a bad answer. Rules:

- Change it against a **reproducible bad answer**, and re-ask the same question
  afterwards. Both providers: Claude and ChatGPT read instructions differently,
  and the same prompt has to work for both.
- Keep the voice it establishes: no ids, no paths, no component names, numbered
  steps, English only, never tell the user to open the window they are in.
- The prompt is built ONCE per question, not per round — keep it that way.
- Do not grow it without cutting: it is sent on every round, and it competes for
  the same budget as the tool schemas.
- `MAX_TOOL_ROUNDS` (10) with tools dropped on the last round is what stops a
  runaway loop. If a change makes the model need more rounds, the change is
  wrong — make the tools answer better instead.

### C. Knowledge — what the assistant is allowed to know

Answers come from `electron-build/knowledge/`, built by
`extra-work/build-knowledge.mjs` from two corpora: `manual`
(`docs/manual-sources/**`, weight 1.5) and `internal` (`.claude/CLAUDE.md`,
`memory/`, `skills/`, weight 1.0).

- The manual is generated from `user-workflows.md`. Fix the workflow recipe, run
  `npm run docs:gen`, then rebuild the knowledge bundle — do not hand-edit the
  generated page.
- A knowledge change needs `npm run electron:build` (or the `dev` script's build
  step) before the app can see it, and that restarts the app.
- The `internal` allowlist is an allowlist for a reason: it lands in plaintext in
  the installer. Adding a directory to it is a distribution decision, not a
  convenience — raise it with the user.
- Ranking lives in `help.mjs` (`KIND_WEIGHT`). If a good page loses to a bad one,
  fix the ranking or the page's title/keywords — not the prompt.

### D. Cost and speed

The chatbot runs on the same low-spec machines as everything else, and on the
user's own API credit.

- Tool schema is the biggest line item: measure with the audit script, and treat
  tokens/round as a budget, not a curiosity.
- `MAX_TOKENS` 2000 (Anthropic) / `OPENAI_MAX_TOKENS` 6000 with
  `reasoning_effort: 'low'`, and no `reasoning_effort` at all for a non-reasoning
  OpenAI model — those splits exist; do not flatten them.
- Nothing is cached between questions on purpose. If you add a cache, it must be
  short-lived and bounded, and you must say why in a comment.
- The session tab store is capped (12 × 60) with a debounced save and a
  `beforeunload` flush. Raising a cap grows a file the app reads at startup.

### E. The window

`ChatbotAppComp.tsx` is one file with the tab strip, head row (Presenter/Reader,
provider, model picker), message list and ask form.

- The ENTIRE head row belongs to the tab in front, not to the window. The stored
  provider/model settings are only what a NEW tab starts on. Do not "fix" this
  into a window-level setting.
- Every answer has **Copy**, every question **Ask again**. Keep both when
  reshaping a message row.
- With no key at all the window says so and offers a button into
  Settings → Others. That empty state is the first thing a new user sees — test it
  by clearing the keys, not by imagining it.
- Screenshot before and after. A layout change with no screenshot is not verified.

### F. Reliability and safety

- The MCP session is swept after 15 idle minutes; `mcpClient.ts` re-opens on a 404
  and retries once, never for `initialize` (that loop was a real bug — keep the
  guard).
- The host caps sessions at 8 and evicts the oldest. A leak shows up as an app
  that answers the first few questions and then stops.
- A failed LLM call falls back to the offline manual bot with a note naming the
  provider. Keep that path working — it is what a volunteer gets when the wifi
  dies mid-service.
- The master switch (`Enable AI features`) must keep agreeing on both sides:
  `checkIsAiEnabled()` in `electron/aiHelpers.ts` and `getIsAIEnabled()` in
  `src/helper/ai/aiHelpers.ts`. Unset = OFF packaged, ON in dev. If they diverge,
  the button and the door disagree and the window talks to nothing.

## What counts as an improvement

- A question that used to be answered wrong, vaguely, or with an internal detail
  is now answered in steps a volunteer can follow.
- Fewer tokens or fewer rounds for the same answer.
- A tool that acts is impossible to invoke without the operator seeing it.
- A failure that used to be silent now says something true.
- The assistant can answer about an app area it previously could not.

Not an improvement: a new tool nothing calls, a longer system prompt with no
bad-answer behind it, a cache, or a feature only reachable by someone who already
knows the app's internals.

## Traps specific to this subsystem

- **Building kills the app.** Verify first, build last (except knowledge work).
- **The knowledge bundle is stale until a build.** A manual edit that "did
  nothing" usually just is not built yet.
- **`evaluate_script` is dead under Node 22** — use raw CDP `Runtime.evaluate`.
- **The MCP port is a default, not a promise.** 39223 is where it usually lands;
  read `mcpUrl` from the published instance file. (Both `extra-work/verify-*`
  scripts still hardcode it — see `EC-05`.)
- **Two `list_pages` targets can look alike.** The chatbot window is
  `chatbot.html?uuid=chatbot`; a showing projector screen appears as
  `screen.html?screenId=N` and vanishes when hidden.
- **Monaco/EditContext typing needs real OS focus** — irrelevant to the chatbot's
  own plain inputs, but it bites when a guide step types into an editor.
- **Dev HMR leaves stale state.** Before calling something a regression, reload
  the window fully (memory: `dev-hmr-stale-state-qa`).

## Resources

- [references/research.md](./references/research.md) — the research playbook:
  three axes, question corpus, scorecard, gap mining, the filter an idea has to
  survive. **Every run starts here.**
- [references/scoreboard.md](./references/scoreboard.md) — one row per run: pass
  rate, leaks, rounds, cost, rung. **Every run ends here**, and the ratchet rules
  live in it.
- [references/architecture.md](./references/architecture.md) — data flow, doors,
  discovery, invariants.
- [references/mcp-tools.md](./references/mcp-tools.md) — tool catalogue +
  authoring checklist. **Read before any tool change.**
- [references/backlog.md](./references/backlog.md) — tracked `EC-xx` work items.
- [references/verification.md](./references/verification.md) — how to prove a
  change in the live app.
- [scripts/audit-mcp-tools.mjs](./scripts/audit-mcp-tools.mjs) — live tool-surface
  audit (`--json`, `--rounds=N`).
- `/owa-robot-test` — QA the result; chatbot rows are `CB-01..CB-14`.
