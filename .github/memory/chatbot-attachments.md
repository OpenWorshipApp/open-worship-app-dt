---
name: chatbot-attachments
description: The chatbot ask box takes pictures, files and a pointed-at control; the bytes are never persisted and never enter the history, and two new MCP tools are hidden from the model on purpose
metadata:
  type: project
---

A chatbot question can carry a picture, a text file or a control the user
POINTED at — paperclip, paste, drop, **📷** (a picture of the app window) or
**🎯** (an outline follows the mouse and the next click chooses). Added
2026-09-02; `src/chatbot/attachmentHelpers.ts` is the one place that holds them.

**Why:** the box was a single-line `<input>` and nothing else, so everything the
assistant knew it had to fetch for itself. A volunteer who cannot NAME what they
are looking at can still photograph it, and every wrong-answer entry in the
backlog is a bill for guessing instead.

**How to apply:**

- **Never persist the bytes.** `chatbot-sessions` is read whole and
  synchronously at startup; a message keeps only the description
  (`ChatAttachmentType`) and the picture lives in a bounded in-memory map that
  dies with the window. `toValidAttachments` LISTS the fields it copies rather
  than spreading — that is the guard against a hand-edited file smuggling a
  `dataUrl` back in. A reopened tab shows the chip greyed, deliberately.
- **Never put a picture in `message.text`.** `toHistoryTurns` measures on
  `text.length` and rides every round, so a data URL there is clipped to 800
  characters of base64 and re-sent on every later question in the tab.
  `toHistoryTurn` writes `(with a picture attached)` instead.
- **Resize, do not merely re-encode.** A provider charges by DIMENSIONS
  (~w·h/750 tokens) and the first user message is re-sent on every one of up to
  ten rounds, so a 1920-wide screenshot is ~$0.14 on Opus 5 for one question.
  1024px long edge, PNG first — JPEG rings around small text and thin borders,
  and the smaller file buys nothing the model can see.
- **An attachment-only ask must still carry a QUESTION.** Only a file or a
  pointed-at control contributes words, so a picture on its own composed to `''`
  and went out as `{type: 'text', text: ''}` — which Anthropic rejects outright
  ("text content blocks must be non-empty"), which `describeLlmError` then read
  as an unreachable service, under which the offline bot printed its generic
  greeting. The window had ASKED for that screenshot. `toAskedOfModel` is now the
  one place that decides what the model is asked, and `askLlmBot` refuses to post
  an empty ask at all. The transcript is NOT built from it: the bubble stays the
  chip they sent, because words a user never typed must never be drawn as theirs.
  The same refusal can also arrive mid-loop — a model round that calls a tool can
  carry an empty text block beside it, and the loop used to echo that content
  straight back on the next round.
- **Refuse a blind model before the call.** An image to a text-only model is a
  400, and `describeLlmError` reads that as an unreachable service — it would
  tell a volunteer their internet is down. `checkCanSeeImages` is an allowlist
  per PROVIDER, because a model chosen through *More models…* has no entry to
  carry a per-model flag.
- **`owa_screenshot` and `owa_pick_element` are on the server and NOT in the
  model's list** (`modelTools.mjs`, see [[mcp-model-hidden-tools]]). The window
  calls them on a button press; an outside agent still gets the full set. That
  filter is also the choke point [[agent-access-mcp-chatbot]] wants for pruning
  the 29 chrome-devtools tools.
- **The picker swallows the choosing click in the CAPTURE phase**, mousedown as
  well as click — a Bootstrap dropdown opens on mousedown — so pointing at
  *Clear Bible* to ask what it does never clears the bible.

- **Every chip is pressable** and shows what it stands for: a control is rung
  by its STORED SELECTOR (`owa_highlight_selector`, the third client-only tool)
  rather than by its words, a picture opens full-window, and anything with a
  `filePath` opens its folder. The path is persisted where the bytes are not.
- **The chip's name comes from `labelPartsOf`, not `describe`'s `label`.** The
  matcher JOINS every way an element is named, which is right for matching and
  unreadable on a chip: the settings button comes back "Setting Setting".
- **A comment with a backtick inside `picker.mjs`/`domMatch.mjs`/`guide.mjs`
  breaks the whole MCP host.** Those runtimes are template literals; a backtick
  ends one, the module stops parsing, and the only symptom is every MCP request
  answering 500. `picker.test.mjs` exists to turn that into a red test.

Related: [[chatbot-answer-options]] (the `OPTIONS:` frame `NEEDS:` copies),
[[chatbot-mid-flight-additions]], [[chatbot-stop-answer]].
