---
name: chatbot-answer-options
description: Every chatbot answer ends with buttons the user can press instead of typing — three layers under one `OPTIONS:` frame; only the LAST message shows them, and the marker is stripped wherever it lands
metadata:
  type: project
---

Every answer in the help window ends with two or three short things the user can
PRESS instead of typing their next message. Before this, an answer carried
buttons only when the model happened to read a manual page, so anything answered
from live app state ended in a blank box — and the reported case was the
assistant asking *"Would you like help turning one on for the congregation?"*
with no way to say yes but to type it.

Three layers, first one that yields anything wins
(`genMessageReplies`, `src/chatbot/quickReplyHelpers.ts`):

1. **The model wrote them** — `genSystemPrompt` asks for a final
   `OPTIONS: a | b | c` line, `parseAnswerOptions` takes it off in `askLlmBot`
   (one choke point, both providers).
2. **The answer's own trailing question** — `genQuickReplies` reads a yes/no
   lead-in or an either-or. No model, no key, no network.
3. **The question corpus** — `genFollowUpQuestions` in `questionHelpers.ts`,
   spread across sections AND recipes ([[question-corpus-maintenance]]).

Decisions that will look like bugs if you assume otherwise:

- **Only the LAST message shows its options**, and never while busy. A one-press
  **Yes** still sitting under an offer three turns back would resolve against
  the wrong antecedent — the same class of mistake [[agent-access-mcp-chatbot]]'s
  history work had to teach the offline bot not to make.
- **`Yes` and `No thanks` are those exact words on purpose.** They are what the
  offline bot's `FOLLOW_UP_YES_PATTERN` / `FOLLOW_UP_NO_PATTERN` understand, so a
  press works with no key and with the building's internet down. A test in
  `helpBotHelpers.test.ts` pins the two halves together; nothing in the type
  system does.
- **Pressing SENDS, unlike the type-ahead list, which fills the box.** A
  suggestion is a starting point someone still edits; an option is the answer.
- **The options are stored on the message** (`ChatMessageType.replies`,
  re-capped on read), because the best of them were written by the model that
  wrote the answer and reopening the window cannot re-derive those.
- **The guide-rescue turn gets none** — it is drawn on a card with no buttons,
  so `handleAsking` skips the layers whenever `shownText` is set
  ([[guide-stuck-step-rescue]]).

Two things live verification found that no test written from the design could
have, and that a future change here will re-break:

- **A frame the model FILLS is not a frame the model FORMATS.** GPT-5 wrote the
  marker at the end of its last sentence — *"Want me to keep stepping you through
  on screen? OPTIONS: Yes, walk me through it | …"* — and a line-anchored parser
  printed the whole thing at the volunteer. The line is CUT at the marker
  wherever it sits, and it is stripped whether or not it parsed into anything
  usable. This is EC-21's and [[guide-stuck-step-rescue]]'s lesson a layer
  further on: the model complies with the CONTENT of a frame long before it
  complies with its placement.
- **Rows of buttons add up.** An offline manual answer already carries four of
  its own, and two options under them made six under one paragraph.
  `MAX_BUTTON_COUNT` 5 caps both rows TOGETHER; per-row caps do not.

Cost: no new tool and **0 extra tool-schema tokens** — the system prompt grew
~66 tokens/round (+0.7%), paid for by compressing four clauses that were
justification or already said elsewhere. Anthropic's compliance with the frame
has never been measured (that key was out of credit); backlog `EC-44`.
