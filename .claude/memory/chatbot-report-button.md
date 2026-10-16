---
name: chatbot-report-button
description: "The chatbot's Report button investigates, collects evidence and prepares a bug report — never claims it was sent (no issue tracker), and since 2026-09-12 says WHO wants it — the address read off the live help page first, the package's as fallback — with Copy report / Copy email address / Email it"
metadata: 
  node_type: memory
  type: project
  originSessionId: b66d32ae-b5c6-4859-b86c-e66d51708a48
  modified: 2026-10-13T15:19:12.211Z
---

**Report**, under **Ask** in the chatbot's ask row (`src/chatbot/reportHelpers.ts`,
added 2026-09-01), is the one press in that window that is not a question. It runs
investigate → collect → prepare, in that order, and stops there: a second press
(**Send report**) is the only thing that writes anything.

**Since 2026-10-13 Send SENDS, when there is somewhere to send it** (the user's
asks that day, in order: _a shared server can be type accepting report … collect
information and prepare as a prompt (raw text) then post to the endpoint_;
_implement node.js + sqlite to accept the post_; _ask user to open chatbot for
reporting … the response card should have `Report` button_; Help's _third item
to let user open chatbot for reporting problem_; and the goal — _make the
reporting system working great to let user help fixing+improving the app_).
The `ISSUE_TRACKER_ENDPOINT` seam is gone: `postIssueReport` saves the two
files as before and hands `report.prompt` to main, which posts it to a registry
entry marked `isAcceptingReport` ([[llm-registry]]). `genReportPrompt` is that
text — what it is, which sections the app read and which a model wrote, then
the report fenced as DATA, without **How to send this**. `describePostedReport`
words the outcome: **Sent** only when a
server took it; with none shared, or one that refused, _nothing was sent_ (and
why) plus the email route below, which is unchanged.

**The same day the POST became JSON and took the report's files with it** (the
user: _the posting endpoint maybe have to accept json instead of raw text …
`{"prompt":"…", "attachments":["base64 data", …]}`_, then _and accept files
like markdown pdf_). `gatherReportFiles` runs at the Send press: the picture of
the app, then everything attached to the report across the whole thread
(`readReportThreadAttachments`). Pictures come from the window's memory; a
text file and a PDF are read off the disk at that moment, size first, and held
only for the sending — a PDF is a new attachment kind, `file`, that holds NO
bytes and that no model is shown ([[chatbot-attachments]]). Each file goes or
is noted with why; the text says which (`genReportPromptWithFiles`), the card
names them before the press, and the answer names what went. A server that
answers 413 gets the words alone. My own choice of shape, where the user's
sketch had bare strings: `{name, mimeType, data}` objects, because a PDF and a
markdown file cannot be told apart by a string — the kit's inbox takes a bare
string or a `data:` URL too. Pressed live on a scratch dev instance against the
kit's real inbox: a markdown note (Khmer in it) and a PDF came back out byte for
byte, beside a 122 KB picture of the app. The first of those two reports
went WITHOUT the picture, and the cause was real: `capturePage` rejects with
`UnknownVizError` on a window that has just reloaded (or has no frame yet),
which is what a window does after the error being reported —
`captureWindowImage` now asks up to four times and the next ask has it. The
three paths that had only been unit-tested were pressed live after: a typed
_no_ under the steps (the report card, no second model call), a server
answering 413 (two POSTs, the second with no files and its text saying they
stayed behind), and **Stop** while sending (the POST closed on the wire, _The
report was not sent_).

**A report its server was asleep for is KEPT and sent by itself** (2026-10-15,
after the admin's inbox -- a quick tunnel on a laptop -- slept for a day and a
half and every report in that time was _nothing was sent, email it_):
`electron/llmReportQueueHelpers.ts` keeps the very body for `unreachable` /
`timeout` only (a server that answered no is not waited for), and sends it a
minute after start, every half hour, and right after any Send that works.
Seen live: kept with the inbox down, delivered 62 s after the app restarted
with the inbox back, both files in it. A report is something a volunteer does
ONCE; an email route after a failure is, in practice, a lost report.

**The first report a PERSON sent showed that no report had ever carried a
console line** (2026-10-13, the user's own, through the error dialog, once
reporting was live): its Console section read _Nothing was logged_ under an
uncaught error. The window had asked the tool host's `list_console_messages`
with no page named; since `chrome-devtools-mcp` 1.8 that is refused
(_Required at pageId_), the refusal was caught and read as an empty console
— in every report, mine included, where I took it for a quiet app. The
console now comes from the main process (`electron/consoleLogHelpers.ts`,
`main:app:recent-console`), which hears a window from the moment it is made.
Lesson, mine: an evidence section that comes back empty in a test is a
result to doubt, not to accept — put something in it on purpose and look for
it. Related: [[coverage-number-is-loaded-files-only]].

**Helping comes before reporting** (the user, the same day: _some problem is
not issue, it is user problem so before helping user to report let try to help
user to resolve it first_). The investigation says first whether the person
can put it right themselves; a `TRY THIS:` marker becomes `report.fix` and the
answer is `genFixCard` — steps, **That fixed it**, **Still a problem — report
it** — with the report written and held back. A typed _yes_ / _no_ there is the
button (`readFixReply`).

**An independent review the same afternoon found ten things; what it changed**:
the inbox's `show` now marks a report as a stranger's words itself (the fence
inside is the SENDER's — see [[llm-registry]]); words added while a report is
being written restart it with them instead of going to the assistant as a
question; the inbox counts bytes, not only rows; home folders lose the
account's name in console lines (`toPathScrubbed`); _yes_ under the steps no
longer starts another report; a report written again keeps its earlier
attachments; Stop pressed as the post lands says it had already gone; a turn
is quoted cut at 2 000 characters and an unread registry is not called _no
server_; a POST with the tunnel's own user-agent is logged; and a 2xx whose
body says `error` is not _Sent_.

**Three ways in**, all ending in the same two presses (look into it, then
send): **Report** under Ask; Help's third row **[en:tran:Report a Problem]**;
and the question an uncaught error now asks BEFORE the reload one
(`offerErrorReporting` in `src/helper/errorReportOfferHelpers.ts`, with its
own test, once in ten minutes across
reloads, a yes leaving the broken window as it is — it is the evidence). The
last two cross windows as a 30-second setting (`requestChatbotReport` /
`takeChatbotReport`, beside the Bible import's) after the 🤖's own two
questions, and the chat window opens a tab on an OFFER card (`genReportOffer`)
with a **Report** button — `REPORT_START_TOOL_NAME`, a pseudo tool. With an
error named, the press looks into it (what is typed in the box goes in front);
with none, the card asks what went wrong _or what they wish were better_ and
the press quotes the box back first. Every place that asks says what a
report carries (`REPORT_COLLECTS_TEXT` — system and app information and the
console log among it, at the user's word), and the prepared card has **Copy
report** beside Send so the text can be read before it goes. Verified live 2026-10-13 on a scratch dev
instance against stand-ins, and once for real — a TEST report through the
public registry and a real Cloudflare tunnel into the kit's SQLite inbox,
the tunnel started by the session at the user's yes and taken down after
([[llm-registry]]); the error dialog's own **Report a Problem** press
is a blocking confirm and was left to a person.

When nothing takes it the
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

**A reporting tab keeps reporting** (2026-10-13, found by the user
reporting for real: _I'm trying to report but it's hard_ — the card asked what
went wrong, they typed it, attached a picture, pressed **Ask**, and it went to
the assistant as a question; then _chatbot should keep knowing that user try
to share information_, _I don't see title start with `Report:`_).
`readReportThread` reads it off the tab's own messages (the offer card, the
`REPORT_NOTE` on what the person said, the prepared card; closed by the answer
Send gives), `handleAsking` routes there before anything else, attachments
ride along and are sent with the report, and the tab's name starts
`Report: `. The lesson is mine: a card that says _then press Report_ is read
as _then press Enter_ — the natural press has to do the right thing.

**How to apply:** the window never names or learns a report server's address — a
new reader of it belongs in main. Do not "tidy" the two-press flow into one: the first press only asks,
because Report sits directly under Ask where a hurried hand lands. Keep the evidence
TRIMMED (`owa_app_state` carries the user's data directory, and the tab's transcript
is capped at 8 turns), keep the prepared report in the bounded in-memory map rather
than in `chatbot-sessions` (see [[chatbot-attachments]]), and keep the model's frame
parsed off the way `OPTIONS:` is (see [[chatbot-answer-options]]). The Send button
and the five under a saved report ride pseudo tool names caught in `handleActing`;
they are deliberately not registered on the MCP server, so nothing outside the window
can file a report or reach the clipboard in the user's name. Never put the address
on a button or in the session file — it is found at the press; never cache the
help-page read for longer than minutes; never put the report in the `mailto:` body.

The same change made the ask box a growing textarea: **Ctrl+Enter asks, plain Enter
is a new line**, and the arrow keys stop driving the suggestion list once the draft
holds a newline.
