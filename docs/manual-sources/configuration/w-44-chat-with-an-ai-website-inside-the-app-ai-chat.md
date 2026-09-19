---
id: W-44
title: "Chat with an AI website inside the app (AI Chat)"
section: "Configuration"
verify: [CB-68]
screenshots: 6
generatedFrom: user-workflows.md
workflowsVersion: "2026-09-18"
---
# W-44 — Chat with an AI website inside the app (AI Chat)

**Goal:** use ChatGPT, Claude, Gemini, DeepSeek, Kimi, Grok, Mistral, Perplexity, Qwen or
Copilot — the company's own website, with your own account — in a window beside the app,
the way a browser's AI sidebar does, without leaving the app.

This is not the app's own assistant (W-42): nothing here reads this manual or presses
anything in the app, and no API key is needed. It is the site itself, in a box.

1. Click the **✨** ([en:tran:AI Chat]) button in the top-right corner of the window, right
   of the **🤖** and left of the **?**, or open **Help** → **AI Chat** in the menu bar. From
   a window with no top bar, use **Tools** → **AI Chat**. A narrow window opens beside the
   app, the same size and place as the help window. 📸 It works whether or not **AI
   features** is switched on in Settings → Others: this window holds no key and opens no
   door of the app's.
2. The window opens on a card, **Choose an AI chat to use in this window**, listing the
   sites. Click one. The site loads in the window, and its own sign-in appears if you are
   not signed in; sign in there exactly as you would in a browser. You stay signed in the
   next time the app starts. 📸
3. The row above the site says **CHAT WITH** and which site it is. Change it there to move
   the same tab to another site. Beside it: **←** goes back a page, **↻** reloads,
   **↗** (**Open in your browser**) opens the same page in your normal browser — for the one
   thing a boxed site cannot do, such as a sign-in that insists on opening a popup window —
   and **↤** (**Sign out of every site**), which is step 7.
4. The strip of **tabs** along the top works like the help window's (W-42 step 2): **+**
   starts another tab (it opens on the card again), **×** closes one, a **double-click on a
   tab's name** renames it, and the **⋮** on a tab (or a right-click) opens **Rename**,
   **Lock**, **Close**, **Close other chats…** and **Clear all chats…**. Until you rename
   it, a tab is called after the page — the conversation's own name, on most of these
   sites. Tabs are kept when the window and the app close, up to eight of them, and each
   comes back on the conversation it was on. 📸
5. Only three tabs keep their site loaded at once — the one in front and the two you used
   most recently. The others unload to save memory and load their last page again when
   you click them, which takes a second and loses nothing: the conversation lives on the
   site, under your account.
6. A link the site opens in a new window (a citation, a "learn more") opens in your normal
   browser, never in the app — and only when you pressed something in the site just before.
   A page that tries to open one on its own is stopped, and a line under the row above the
   page says *This site tried to open … in your browser without a press, so it was not
   opened*; press the link again if you meant it. 📸 The site cannot use the camera or your
   location from inside this window, cannot open anything on this computer, and cannot
   reach anything on it or on the building's network — not the app itself, not the router,
   not a printer, not a program such as OBS that listens for connections. Only the
   internet, which is all a chat site wants.

   **Talking instead of typing.** The microphone is the one thing a site may ask for. Press
   its microphone button (Claude's **Dictate**, for one) and a line appears under the row
   above the page: *claude.ai wants to use your microphone. Allow it until the app
   closes?* 📸 **Allow** lets that site hear you; **Don't allow** — already selected, so
   Enter or Escape picks it — keeps the microphone off, and the site shows its own
   "blocked" message until you press its button and answer again. A yes is for that one
   site, lasts until the app closes, and only counts while its tab is the one in front; a
   tab behind is never let in. **Sign out of every site** (step 7) takes it back. The
   camera stays off whatever you answer.
7. **Sharing this computer?** You stay signed in to these sites until you say otherwise,
   and closing the tabs does not sign you out — that is worth knowing in a church back
   room where several people use the same machine. Click **↤** (**Sign out of every
   site**) in the row above the page, or the same words on the card in step 2, and answer
   **Sign out**. 📸 It asks first, and **Keep me signed in** is the answer already
   selected, so a mis-click costs nothing. Your tabs stay where they are; the pages they
   were on and the names the sites gave them are forgotten, a name you typed on a tab
   yourself is kept, and every site asks you to sign in again. It cannot be undone.

**Not loading?** The window says *… could not be loaded* with a **Try again** button when
the site cannot be reached — check the building's internet first. A site that refuses to
sign you in inside the window can be opened in your browser with **↗** and used there.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`CB-68`

Regenerated from `user-workflows.md` (workflowsVersion 2026-09-18).
:::
