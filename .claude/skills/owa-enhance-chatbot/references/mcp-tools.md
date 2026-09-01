# MCP tools — catalogue and authoring rules

Everything the assistant can DO. Read this before adding, changing or removing a
tool. Numbers here are a snapshot: re-measure with
`node .claude/skills/owa-enhance-chatbot/scripts/audit-mcp-tools.mjs`.

## Why the tool surface is a performance problem

`src/chatbot/llmBotHelpers.ts` calls `listTools()` and hands **every** tool to the
model, then re-sends them on **every round** of the loop (`MAX_TOOL_ROUNDS = 10`).

Measured 2026-08-31 against the running dev app:

| | tools | tokens/round |
| --- | ---: | ---: |
| `owa_*` (this app) | 13 | ~2 800 |
| chrome-devtools-mcp | 29 | ~5 750 |
| **total** | **42** | **~8 550** |

That is up to **~85 000 tokens of tool schema for one question** before a single
word of manual is read — paid by the user, on their own key, on a machine chosen
for being cheap. Every tool you add is charged to every question anybody ever
asks, including the ones it is irrelevant to.

So: **prune before you sharpen, sharpen before you add.**

## The `owa_*` catalogue

`*` marks a required parameter. "Acts" means it is in `ACTING_TOOLS` in
`notify.mjs` and puts a banner in the user's window.

| Tool | Parameters | Does | Acts |
| --- | --- | --- | :-: |
| `owa_help_search` | `query*`, `limit`, `kind`, `focus` | Searches the bundled knowledge. `kind` splits `manual` (user-facing, verified) from `internal` (developer notes, ranked below and never quoted to a user). `focus` biases to presenter/reader. | |
| `owa_help_page` | `id*` | Reads one page whole, by the id a search hit carries. | |
| `owa_app_state` | `page` | What is on screen right now: page, language, theme, tabs, mounted components. DOM read only. | |
| `owa_list_screens` | — | Showing screen ids + attached displays, via `main:app:get-screens` / `get-displays`. | |
| `owa_hide_screens` | `screenId` | Takes content OFF a projector. Destructive to a live service — always confirm first. | ✔ |
| `owa_goto_page` | `page*` | Switches the main window between `presenter.html` and `reader.html`. | ✔ |
| `owa_find_ui` | `text*`, `highlight`, `page`, `anyPage` | Locates a control by its visible text; `highlight` rings it in red in the real window. `anyPage` searches the other window too and says which one. | ✔ |
| `owa_list_ui` | `filter`, `page`, `limit` | Enumerates the visible controls of a window. The cure for guessing a label. | |
| `owa_click` | `find*`, `page` | Clicks a control by its label. Answers `nearMisses` when it cannot match. | ✔ |
| `owa_type` | `find*`, `value*`, `submit`, `page` | Types into a control by its label, optionally submitting. | ✔ |
| `owa_guide_start` | `title`, `manualId`, `steps`, `mode`, `labels`, `page` | Draws the numbered walkthrough card in the app window, each step's control ringed. `mode: "demo"` lets the card DO each step. `manualId` builds steps from a recipe; `canDemo: false` comes back when the recipe's bolding cannot be pressed. | ✔ |
| `owa_guide_step` | `action*`, `stepNumber`, `page` | Advances / goes back / performs the current step. | ✔ |
| `owa_guide_status` | `page` | Where the guide is, whether the target was found, and `nearMisses` when it was not. | |

The other 29 tools come from `chrome-devtools-mcp` via `createMcpServer` in
`server.mjs` and are not ours to edit — only to include or exclude.

## Adding a tool — the checklist

A tool is not "added" until every line is true.

1. **Justify it against the alternatives.** Can `owa_list_ui` + `owa_click`
   already do it? Would a better *description* on an existing tool fix the
   behaviour instead? A new tool is the most expensive answer.
2. **Register it** in `registerOwaTools` (`owaTools.mjs`), beside its family.
3. **Name it `owa_<verb>_<noun>`**, lower snake case. The `owa_` prefix is load
   bearing: the audit script, the chatbot and CLAUDE.md all key on it.
4. **Write the description for two readers** (see below).
5. **Keep the schema small.** Every property, description and enum is re-sent
   every round. Required only what is truly required; no free-form object bags.
6. **Page-scope it.** Anything that touches the window takes `page` and behaves
   sanely when the window is showing the other half — say so in the answer
   (`no open page matching "presenter.html"`), never silently act on the wrong one.
7. **Return JSON the model can act on**, through `toTextResult`. On a miss, return
   `nearMisses` — that one field is why the model recovers instead of guessing
   twice.
8. **Fail with `toErrorResult`/`attempt`**, never a thrown stack. The chatbot hands
   tool errors back to the model as text so it can route around them.
9. **If it acts, add it to `ACTING_TOOLS`** in `notify.mjs`, with the phrase a
   volunteer would use ("clicked something", not "dispatched a click"). Run the
   audit script — it warns on an acting-looking tool that is missing.
10. **Page expressions stay dependency-free strings.** No `import()` of app
    modules (it re-runs `document.onkeydown` and kills every shortcut), no app
    state mutation, and anything drawn goes in its own shadow root.
11. **Test what can be tested without the app** — put pure logic in a sibling
    module with a `*.test.mjs` (they run in `npm test` via the
    `tools/**/*.test.mjs` include). `domMatch.mjs`, `guide.mjs` and `notify.mjs`
    are the precedent; `owaTools.mjs` itself is mostly CDP glue and is verified
    live.
12. **Verify live**: audit shows it → call it through the MCP → the app reacts →
    the banner appears if it acts → the chatbot can be asked a question that makes
    a model choose it.
13. **Document it**: `tools/owa-devtools-mcp/README.md` tool table, the `owa_*`
    list in `.claude/CLAUDE.md` §*Agent access*, a `CB-xx` row if a user can
    notice it, and the `.github/` mirror of all of the above.

## Description voice — two readers, one string

A tool description is read by a model deciding whether to call it, and its
consequences are felt by a volunteer minutes before a service. Write for both:

- **Say when to use it and when NOT to.** Most wrong tool calls are the model
  picking a plausible neighbour. `owa_help_search`'s description earns its length
  by explaining that `internal` hits must never be repeated to the user.
- **Name the failure mode.** "Answers `nearMisses` when nothing matches — retry
  with one of those, do not guess again" prevents a whole class of loop.
- **Say what the user will SEE.** A tool that rings a control in red or takes a
  screen down has to say so, or the model will use it casually.
- **Do not restate the schema in prose.** The parameters are already sent.
- **Length is a budget.** `owa_guide_start` costs ~594 tokens, more than any other
  tool in the server, because it teaches a whole interaction. That is defensible.
  A 400-token description on a tool that reads one value is not.

## Pruning and scoping

The biggest available win is not sending 29 browser-debugging tools to a help bot
for church volunteers. `lighthouse_audit`, `take_heapsnapshot`,
`performance_start_trace`, `close_page`, `new_page`, `emulate` and
`resize_page` are meaningful to an agent debugging the app and meaningless — or
harmful — to a user asking where a button is.

If you take that work on (`EC-02` in [backlog.md](./backlog.md)), the constraints
are:

- **The outside agent must keep the full set.** The robot-test skill and Claude
  Code drive the app through the same server. Filter on the CALLER (the chatbot's
  own client), not in `server.mjs`, unless you are deliberately narrowing both.
- The natural place is `mcpClient.ts`/`llmBotHelpers.ts`: `listTools()` already
  exists as the single choke point, and an allowlist there is one small,
  reviewable function.
- **Allowlist, never denylist** — same reasoning as the knowledge corpus. A tool
  added upstream must not reach a volunteer's window because nobody updated an
  exclusion list.
- Keep the read/act split visible: a chatbot allowlist that quietly includes
  `evaluate_script` has handed a language model arbitrary code execution in a
  renderer with node integration.

## When a tool exists but the model never calls it

Before writing a new one, check which of these it is:

1. **It is not in the round** — the loop ran out of rounds first, or the model
   answered from the manual. Look at the terminal log.
2. **The description does not match the question's words.** Fix the description.
3. **The system prompt tells it not to.** `genSystemPrompt` explicitly budgets
   tool calls ("spend them on doing it") — that is deliberate and stops a run of
   `owa_find_ui` checks eating the whole loop.
4. **It returned something unusable once** and the model routed around it. Call it
   by hand and read the raw text it produces.

Only after all four is "the tool is missing" the right conclusion.
