---
name: chatbot-report-button
description: The chatbot's Report button investigates, collects evidence and prepares a bug report — and never claims it was sent, because there is no issue tracker yet
metadata:
  type: project
---

**Report**, under **Ask** in the chatbot's ask row (`src/chatbot/reportHelpers.ts`,
added 2026-09-01), is the one press in that window that is not a question. It runs
investigate → collect → prepare, in that order, and stops there: a second press
(**Send report**) is the only thing that writes anything.

There is **no issue tracker endpoint**. `ISSUE_TRACKER_ENDPOINT` in
`reportHelpers.ts` is `null` and is the ONE place that knows; while it is null the
window says plainly that nothing was sent and saves `OWA-<date>-<id>.md` and its
`.png` into the user's Downloads, with chips that open them.

**Why:** the volunteer who hits a bug mid-service can say what happened and has no
time to write it down, and the useful half of a report — build, window, screens,
console, a picture — is the half they cannot produce at all. But a window that told
them their problem had been filed with someone, when it had not, would be worse than
having no button.

**How to apply:** when an endpoint finally exists, set that constant and change the
one sentence in `handleSendingReport` — everything else is already written as though
it were there. Do not "tidy" the two-press flow into one: the first press only asks,
because Report sits directly under Ask where a hurried hand lands. Keep the evidence
TRIMMED (`owa_app_state` carries the user's data directory and forty dev-only
component names, and the tab's transcript is capped at 8 turns), keep the prepared
report in the bounded in-memory map rather than in `chatbot-sessions`
(see [[chatbot-attachments]]), and keep the model's frame parsed off the way
`OPTIONS:` is (see [[chatbot-answer-options]]). The Send button rides a pseudo tool
name caught in `handleActing`; it is deliberately not registered on the MCP server,
so nothing outside the window can file a report in the user's name.

The same change made the ask box a growing textarea: **Ctrl+Enter asks, plain Enter
is a new line**, and the arrow keys stop driving the suggestion list once the draft
holds a newline.
