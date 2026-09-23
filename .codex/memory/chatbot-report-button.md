---
name: chatbot-report-button
description: "The chatbot's Report button investigates, collects evidence and prepares a bug report — never claims it was sent (no issue tracker), and since 2026-09-12 says WHO wants it — the address read off the live help page first, the package's as fallback — with Copy report / Copy email address / Email it"
metadata: 
  node_type: memory
  type: project
  originSessionId: b66d32ae-b5c6-4859-b86c-e66d51708a48
  modified: 2026-09-12T17:02:25.531Z
---

**Report**, under **Ask** in the chatbot's ask row (`src/chatbot/reportHelpers.ts`,
added 2026-09-01), is the one press in that window that is not a question. It runs
investigate → collect → prepare, in that order, and stops there: a second press
(**Send report**) is the only thing that writes anything.

There is **no issue tracker endpoint**. `ISSUE_TRACKER_ENDPOINT` in
`reportHelpers.ts` is `null` and is the ONE place that knows; while it is null the
window says plainly that nothing was sent and saves `OWA-<date>-<id>.md` and its
`.png` into the user's Downloads, with chips that open them.

**Since 2026-09-12 the Send answer says WHO wants it** (the user's ask: *provide
copy-able content and copy-able email address*). The address comes from
`findContactEmail` in `src/server/appHelpers.ts`, beside `getHelpPageUrl`: the
app's **help page first**, read live through the same locked-down
`main:app:read-web-page` reader `owa_read_website` uses — the site is a React
shell, so a plain fetch of its HTML sees no address; the RENDERED words carry
it, and the reader keeps only http(s) links, so `readContactEmailFromPage`
parses the text — and only when that cannot be read, the package's `author`
field (`parseContactEmail`). The user asked for that order in so many words
(*app auto email sometime out-of-date*) and it was true the same day: the page
said `info@openworship.app` while `package.json` said `owf2025@gmail.com`. The
lookup starts when Report is confirmed so it runs BESIDE the investigation, is
remembered for ten minutes (short-lived, for the presses that follow), and the
answer and the document's opening **How to send this** section both say which
source it was. Five pseudo-tool buttons (`REPORT_COPY_TOOL_NAME`,
`REPORT_COPY_SUBJECT_TOOL_NAME`, `REPORT_COPY_IMAGE_TOOL_NAME`,
`REPORT_COPY_EMAIL_TOOL_NAME`, `REPORT_EMAIL_TOOL_NAME`, caught in
`handleActing` like Send) carry ONLY the reference: **Copy subject** copies
the `[Open Worship app] <title> (<reference>)` line, rebuilt from the saved
document's own heading after a reopen (`toSavedReportSubject`); **Copy
picture** puts the screenshot on the clipboard as PNG (`copyImageToClipboard`
in `attachmentHelpers.ts`, shared with the preview's Copy — Chromium's async
clipboard takes PNG only, so anything else is redrawn first), read back from
`Downloads/<reference>.png` after a reopen; **Copy report** reads the
kept report or, after a reopen, the saved file in Downloads by its own name
(`readReportMarkdown` refuses a reference that is not one — the args live in
the hand-editable sessions file); **Email it** opens a `mailto:` with the
address and subject only and puts the report on the clipboard first, because
mail clients cut a `mailto:` body at about 2 000 characters. The document also
carries a machine line (OS, Electron, Chromium, locale, display scale, off
`navigator.userAgent` — the chatbot's `process` is a decoy with no `versions`),
the selection and run sheet, each screen's content, the displays, 20 console
lines and `Investigated by <provider> (<model>)`.

**Why:** the volunteer who hits a bug mid-service can say what happened and has no
time to write it down, and the useful half of a report — build, window, screens,
console, a picture — is the half they cannot produce at all. But a window that told
them their problem had been filed with someone, when it had not, would be worse than
having no button; and "saved to Downloads, pass it on however you like" left them
holding a file with no idea who wanted it.

**How to apply:** when an endpoint finally exists, set that constant and change the
one sentence in `handleSendingReport` — everything else is already written as though
it were there. Do not "tidy" the two-press flow into one: the first press only asks,
because Report sits directly under Ask where a hurried hand lands. Keep the evidence
TRIMMED (`owa_app_state` carries the user's data directory, and the tab's transcript
is capped at 8 turns), keep the prepared report in the bounded in-memory map rather
than in `chatbot-sessions` (see [[chatbot-attachments]]), and keep the model's frame
parsed off the way `OPTIONS:` is (see [[chatbot-answer-options]]). The Send button
and the three under a saved report ride pseudo tool names caught in `handleActing`;
they are deliberately not registered on the MCP server, so nothing outside the window
can file a report or reach the clipboard in the user's name. Never put the address
on a button or in the session file — it is found at the press; never cache the
help-page read for longer than minutes; never put the report in the `mailto:` body.

The same change made the ask box a growing textarea: **Ctrl+Enter asks, plain Enter
is a new line**, and the arrow keys stop driving the suggestion list once the draft
holds a newline.
