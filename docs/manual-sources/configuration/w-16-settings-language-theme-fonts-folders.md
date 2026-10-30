---
id: W-16
title: "Settings: language, theme, fonts, folders"
section: "Configuration"
verify: [ST-01, ST-02, ST-03, ST-04, ST-05, ST-06, ST-07, ST-08, ST-09, ST-20, ST-22, ST-52, ST-54, ST-55, ST-58, ST-83, ST-84, ST-85, ST-86, CB-163, LT-02, LT-03, LT-04]
screenshots: 4
generatedFrom: user-workflows.md
workflowsVersion: "2026-10-29"
---
# W-16 — Settings: language, theme, fonts, folders

**Goal:** configure the app.

1. Click the **gear** ([en:tran:Setting]) in the header — Settings opens in its own window,
   on **[en:tran:Path Settings]** the first time, and on the tab you last used after that.
   **[en:tran:App Assistant]** above
   **[en:tran:Apply Settings]** at the bottom-left opens the help window, to ask about
   any setting. 📸
2. **[en:tran:General]** tab:
   - **[en:tran:Language]:** click **English**, **ខ្មែរ** or **Français**. Each language is listed under its
     OWN name, whatever locale you are currently in — so if a mis-click leaves you in
     a script you cannot read, the way back is still legible. (Hover a button and its
     `title` gives the English name.) Some
     labels change straight away, but the switch is only complete once you click
     **[en:tran:Apply Settings]** at the bottom-left — that reloads every open
     window. Unsaved edits in the Slide Editor are kept. The language belongs to this
     computer, not to the data folder: switch to another data folder and the app stays
     in the language you chose.
   - **[en:tran:Theme]:** system / light / dark.
   - **[en:tran:Font Family]:** the font the app's own windows are drawn in — not the text on the audience screen. A font marked `(Missing)` is
     configured but not installed on this computer. When the chosen font comes in more
     than one weight, a second list beside it picks one (`400 Regular`, `700 Bold`…);
     **[en:tran:Default]** keeps the font's own weight.
   - **Reset button** (`Clear All Settings`):
     **this erases configuration; use with care.** It asks for confirmation first.
   - **[en:tran:Show Tips of the Day automatically]:** controls whether each app window shows
     its own automatic tip after the next app launch.
   - Panel sizes are no longer reset from here — see **W-31**.
2a. **[en:tran:Path Settings]** tab (next to **[en:tran:General]**): where everything
    lives on disk.
   - **Directories:** where documents, lyrics, and bibles are stored on disk. A data
     folder is required: everything you make and set up — songs, slides, Bibles, notes
     and most settings — is kept in it, so it can be backed up, carried on a stick and
     found again. Until one is chosen, every window but Settings shows only
     **[en:tran:No Parent Directory Selected]**, **[en:tran:Go to Settings]** and
     **[en:tran:App Assistant]**, and Settings opens on this tab by itself, with only
     **[en:tran:General]** (language and theme) and **[en:tran:AI Providers]** beside it.
     Under **[en:tran:Parent Directory:]**, **[en:tran:Suggested]** offers
     `.owa\open-worship-data` in your user folder: **[en:tran:Use This Folder]** makes
     it if it is not there and uses it. **[en:tran:Found Data Folders]** lists the data
     folders at the top of this computer's drives — one on a stick — each with
     **[en:tran:Switch]**. Nothing is chosen for you. A chosen folder that is not there
     — a stick not plugged in — counts as none; plug it in and press
     **[en:tran:Apply Settings]**. A data folder on the Desktop is never suggested; while
     one is in use, every window shows the card
     **[en:tran:Move Your Data Folder Off the Desktop]**, which says the Desktop is not a
     safe place for it, with **[en:tran:Move Now]** and **[en:tran:Hide for 30 days]** —
     see **W-54**.
   - **[en:tran:Copy Data Folder]** (under **[en:tran:Parent Directory:]**, while a
     folder is in use): choose a USB stick, another drive or any folder, and a whole
     copy is made there as `open-worship-data`, every file counted and checked. Links
     inside it point at the copy itself, so the copy never reads or changes the
     original's songs and pictures. The folder in use is not changed; the app then
     offers to **[en:tran:Switch]** to the copy.
   - **To keep everything somewhere else**, press the folder line
     under **[en:tran:Parent Directory:]** (the folder in use) and a box opens under it: type the
     folder's whole path (starting with the drive, like `D:\`, or with `/`) and press
     Enter, or press **[en:tran:Choose a folder]** and pick it. A typed folder that is
     not there yet is asked about first (**[en:tran:Create Data Folder]**) and made only
     with **[en:tran:Create]**; emptying the box changes nothing.
     The app asks **[en:tran:Set according paths]** once, and **[en:tran:Yes]** makes the
     standard folders (Documents, Videos, Images and the rest) inside it, uses them and
     reloads. What you already have is not moved. It stays in the old folder, where
     **[en:tran:Recent Folders]** below takes you back, or a backup brings it along (W-25).
   - **To switch back to a previous data folder.** In **[en:tran:Path Settings]**, under **[en:tran:Parent Directory:]** → **[en:tran:Recent Folders]**, press
     **[en:tran:Switch]** beside the folder, then confirm with **[en:tran:Switch]**
     in the **[en:tran:Switch Data Folder]** dialog. Every open window reloads onto
     that folder automatically. The list shows this computer's previously used
     folders, newest first, excluding the one in use. A folder that is not there
     (a stick that is not plugged in) reads **[en:tran:Missing]** and cannot be
     switched to. **✕** takes a folder off the list; the folder itself is not
     touched. The list keeps the last 10 and appears once a second folder has
     been used. 📸
   - **[en:tran:Repair Links]** (beside **[en:tran:Reset All Child Directories]**): after you
     bring the data folder from another computer — a USB stick, a copied folder — press
     it once. Pictures, videos and songs still pointing at where the folder USED to be
     are pointed at where it is now; a link to something that still exists is left as it
     is. A box says how many links it repaired, and the app reloads to show them. 📸
   - **Reset button** (`Reset All Child Directories`):
     **this erases configuration; use with care.** It asks for confirmation first.
3. **[en:tran:Bible]** tab: import a Bible XML from a file or URL, edit installed XML Bibles,
   or export/import a **[en:tran:Bible Data]** archive. The old online version list is
   development-only and can be unavailable. 📸
   **An installed Bible has no on/off switch.** Every Bible in that list is offered
   wherever a version is chosen. To stop one being offered, take it off the computer: the
   trash icon on its row, **[en:tran:Move to Trash]**, opens a confirmation titled
   **[en:tran:Delete Bible XML]**. Press **[en:tran:Yes]** in that dialog to send
   its file to the Recycle Bin, from where it can be brought back or imported again. (A data
   folder on a USB flash drive under Windows has no Recycle Bin; there a
   **[en:tran:Delete Permanently]** box follows, and that cannot be undone.)
4. **[en:tran:AI Providers]** tab: the AI master switch, the provider keys and the
   custom servers — see **W-42**.
5. Click **[en:tran:Apply Settings]** (bottom-left) to apply — the app windows reload.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`ST-01` · `ST-02` · `ST-03` · `ST-04` · `ST-05` · `ST-06` · `ST-07` · `ST-08` · `ST-09` · `ST-20` · `ST-22` · `ST-52` · `ST-54` · `ST-55` · `ST-58` · `ST-83` · `ST-84` · `ST-85` · `ST-86` · `CB-163` · `LT-02` · `LT-03` · `LT-04`

Regenerated from `user-workflows.md` (workflowsVersion 2026-10-29).
:::
