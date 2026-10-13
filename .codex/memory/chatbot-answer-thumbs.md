---
name: chatbot-answer-thumbs
description: Thumbs under every chatbot answer; a thumb down is followed up by the window with no model and offers the next model up — only where the model list is written best first
metadata:
  node_type: memory
  type: project
  originSessionId: 5b07f182-3f35-46de-a795-58cdc0a98502
  modified: 2026-10-13T03:33:45.567Z
---

Every answer in the 🤖 window has 👍 / 👎 beside **Copy**
(`src/chatbot/answerRatingHelpers.ts`, `EC-259`, 2026-10-12). The user asked
for it in three messages that night: a like and dislike icon on each response
card with a follow-up on dislike; a recommendation to try a smarter model when
somebody complains an answer is wrong; and the card and its buttons focusable
so the one clicked stays visible.

What is not obvious from the code:

- **"The next model up" exists only where the list is written best first**:
  `getRankedLlmModelList` answers for Claude, ChatGPT and Kimi. Bedrock's list
  is in the order to reach for them (its most capable model is fourth), the
  keyless three are three makers' models, a custom server lists what was
  loaded. Adding a provider means deciding `isModelListRanked` for it.
- **The window's own follow-up is not a turn of the conversation**
  (`isFollowUp`): it is left out of the history a model is shown, has no
  thumbs, and `findDisputedPage` looks past it — its three sentences are
  complaints about the answer ABOVE it.
- **Ask again with … goes through `handleAsking`'s `options.model`**: the
  press sets the tab's model and asks in the same tick, before React has
  rendered the new one, so the closure's own `model` is the old one.
- **The first live press was on the best model**, where "try a larger model in
  the MODEL list" pointed at nothing: the top of a ranked list has its own
  sentence.
- **Focus is the mark**: `.cue` styles `:focus`, not `:focus-visible` (a mouse
  press on a button never sets that). The message list scrolls to its end when
  a message arrives or the tab changes, not on every rewrite of `messages` —
  a thumb on an answer further up used to throw the card out of sight.

**Why:** with the guide page in front of it a small model still gets about one
answer in ten wrong on the dense subjects ([[question-corpus-maintenance]],
`EC-258`), and the window gave no way to say so and no advice.

**How to apply:** nothing is counted or sent by a thumb; a tally per model or
a thumb carried by Report is a decision about what leaves the computer — ask
first. See [[chatbot-answer-options]] for the other things under an answer and
[[chatbot-spend-guard]] for why a dearer model is said out loud.
