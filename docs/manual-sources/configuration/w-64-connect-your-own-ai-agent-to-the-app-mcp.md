---
id: W-64
title: "Connect your own AI agent to the app (MCP)"
section: "Configuration"
verify: [ST-93, MD-05]
screenshots: 2
generatedFrom: user-workflows.md
workflowsVersion: "2026-11-14"
---
# W-64 — Connect your own AI agent to the app (MCP)

**Goal:** let an AI agent you run on this computer — Claude Code, Claude Desktop, Cursor
or another program that speaks MCP (the Model Context Protocol) — see Open Worship and
use it the way the app's own assistant does. The program the agent talks to comes with
the download tools, so the computer needs nothing else installed.

1. Open **[en:tran:Setting]** → **[en:tran:Others]** → **[en:tran:Extra Binaries]**. If it
   reads **[en:tran:Not installed]**, press **[en:tran:Download and Install]** (W-21); if it
   offers **[en:tran:Update to]**, press that — tools from before version 0.0.6 have no
   program for an agent. 📸
2. Once the tools are installed, the card has an **[en:tran:AI agents (MCP)]** picker.
   Choose your AI program in it: under **[en:tran:Terminal command]** the ones set up by
   typing a command (Claude Code, Codex — which the ChatGPT desktop app shares —, Gemini
   CLI, GitHub Copilot CLI …), under **[en:tran:Settings file]** the ones set up in a file
   (Claude Desktop, Cursor, Windsurf, VS Code, Zed, Cline, Continue …), and under
   **[en:tran:Others]** a plain JSON block for any other program, or
   **[en:tran:Program path]**, the program's own path. Under the picker is the text for
   the program chosen: a command, with **[en:tran:Run this in a terminal.]**, or what goes
   in its settings file, with **[en:tran:Paste into:]** and that file. Press
   **[en:tran:Copy]** — a note at the top right says the text has been copied — and paste
   it there. The picker keeps your choice for next time. 📸
3. Keep Open Worship open: the agent finds the open app by itself. It needs the app's AI
   features on (**[en:tran:AI Providers]** → **[en:tran:Enable AI features]**, which is on
   unless someone turned it off).
4. Ask the agent about the app, for example _what is on the screen?_ When it presses
   something, a note at the bottom of the window says the assistant did. Like the app's
   own assistant it may point at anything and press most things, but a button that
   cannot be undone — delete, remove, clear all … — stays yours to press.
5. With more than one Open Worship open on this computer — the installed app and a test
   copy, say — the agent lists them (each by its data profile, kind and version) and asks
   you which one to work with; it does nothing in any of them until you answer. It also
   checks that its program is the same version as the app, and tells you when it is not.

> Notes: the program sits in your data folder under `extra-bin`, in a folder called
> `mcp` with a `README.md` beside it. Keep that folder whole: the program reads the
> files beside it. The command puts the program's path in single quotes on a Mac or
> Linux and in double quotes on Windows, because a data folder's path can have spaces.
> Tools installed from a file (W-21) carry the program too when the file is from
> version 0.0.6 or later. ChatGPT in a web browser cannot start a program on this
> computer; the ChatGPT desktop app reaches it through Codex's settings.

Steps 1–4 were observed live 2026-11-13 on a scratch dev profile on a Mac, in English
and Khmer: **[en:tran:Download and Install]** put 0.0.6 in, the line showed the command,
**[en:tran:Copy]** put exactly that command on the clipboard with its note and the
line's JSON button (gone since) the JSON; the program, started on its own with no setting,
found the app, took a picture of the Presenter, pressed a Settings tab and refused
_Delete everything_; Claude Code took the copied command and reported it connected.
With the program's folder moved away the card still read **[en:tran:Installed]** and
the line was gone. The picker (step 2) was seen live the same day on the dev app and on
a scratch instance in Khmer: Claude Code, Cursor, the Codex config file, Continue and
**[en:tran:Program path]** each put exactly the text shown on the clipboard, Cursor and
Claude Desktop named their files, and the choice was still there after the tab was left
and opened again. Step 5 was seen through a fresh copy of the program with two and then
three apps open: it listed them, answered every press with the list until one was chosen,
then worked in that one alone, following a switch to another. Not seen live: Claude
Desktop or Cursor themselves, Windows or Linux, an update from 0.0.5.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`ST-93` · `MD-05`

Regenerated from `user-workflows.md` (workflowsVersion 2026-11-14).
:::
