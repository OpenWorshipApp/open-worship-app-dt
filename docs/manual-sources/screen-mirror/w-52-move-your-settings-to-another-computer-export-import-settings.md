---
id: W-52
title: "Move your settings to another computer (Export / Import Settings)"
section: "Screen Mirror"
verify: [ST-61, ST-62, ST-63, ST-64, ST-65, ST-66]
screenshots: 3
generatedFrom: user-workflows.md
workflowsVersion: "2026-10-09"
---
# W-52 — Move your settings to another computer (Export / Import Settings)

**File → Export Data** moves your files — songs, slides, media. This moves how
the app is SET UP: the language and theme, how a Bible looks on the screen, the
marquee and the timers, the panel sizes, and the rest of what you have chosen
over time.

1. Open **[en:tran:Setting]**. At the bottom of the left sidebar, under
   **[en:tran:Apply Settings]**, are **[en:tran:Export Settings]** and
   **[en:tran:Import Settings]** — the same on every tab. 📸
2. Click **[en:tran:Export Settings]**. A panel lists the settings in sections:
   **[en:tran:General]**, **[en:tran:Bible]**, **[en:tran:Screens]**,
   **[en:tran:Foreground]**, **[en:tran:Background]**,
   **[en:tran:Documents & Lyrics]**, **[en:tran:Layout]**,
   **[en:tran:AI & Assistant]**, **[en:tran:Connections]**,
   **[en:tran:API Keys & Sign-ins]** and **[en:tran:Other Settings]**. Each says
   how many settings it holds, or **[en:tran:All default]** when nothing in it
   was ever changed. Everything starts ticked except the API keys. 📸
3. The arrow at the left of a section opens it, and each part can be ticked on
   its own — **[en:tran:General]** holds **[en:tran:Language]**,
   **[en:tran:Theme]**, **[en:tran:Font]**, **[en:tran:Tips of the Day]**,
   **[en:tran:Folders]** and **[en:tran:File Color Notes]**. A section with only
   some parts ticked shows a dash in its box; ticking the section ticks all of
   them. **[en:tran:Deselect All]** / **[en:tran:Select All]** does every
   section at once.
4. Below the list is the same **[en:tran:Password]** /
   **[en:tran:Confirm Password]** pair as every other export. **API keys and
   sign-ins only go into a file with a password**: their rows stay red with
   **[en:tran:Type a password below to include these]** until one is typed, and
   come back unticked if it is cleared. Typed differently, the two fields say
   **[en:tran:Passwords do not match]** and the panel comes back holding what was
   ticked.
5. Click **Ok**. `Settings.owasetting.tar.gz` is written to the **Downloads**
   folder (`Settings.owasetting.enc` with a password), and the folder opens on
   it.
6. On the other computer, open **[en:tran:Setting]**, click
   **[en:tran:Import Settings]** and pick the file. A protected file asks for its
   password first.
7. A panel lists the sections the file holds, under the warning
   **[en:tran:Each ticked section replaces the same section on this computer; what the file leaves out goes back to its default]**.
   **[en:tran:Folders]**, **[en:tran:Screen Mirror & Virtual Displays]** and the
   API keys start unticked — they reach past how the app looks. 📸
8. Click **Ok**. A message says how many settings were written and how many went
   back to their default. The app then offers to reload its windows
   (**[en:tran:Apply Settings]**), or to restart when a ticked section is read
   only at start-up (**[en:tran:Screens & Monitors]**,
   **[en:tran:Screen Mirror & Virtual Displays]**).

> Notes: an import REPLACES each ticked section rather than adding to it — a
> marquee setting changed here but not in the file goes back to its default, and
> a section left unticked is not touched at all. Never carried, whatever is
> ticked: which data folder the app uses, this computer's identity on the
> network and the devices it trusts, whether AI features are switched on,
> conversations with the assistant, and what is on the screens right now. A
> projector window that is open keeps its old look until it is opened again. A
> SongSelect sign-in copied this way can sign one of the two computers out the
> next time either refreshes it.

Steps 1–2 and the Khmer labels were observed live 2026-10-09; steps 3–8 press
inside the app's own dialog, which the MCP firewall leaves to a person, and are
unit-tested until a person's run ticks them.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`ST-61` · `ST-62` · `ST-63` · `ST-64` · `ST-65` · `ST-66`

Regenerated from `user-workflows.md` (workflowsVersion 2026-10-09).
:::
