---
id: W-16
title: "Settings: language, theme, fonts, folders"
section: "Configuration"
verify: [ST-01, ST-02, ST-03, ST-04, ST-05, ST-06, ST-07, ST-08, ST-09, ST-22, ST-52, ST-58, LT-02, LT-03, LT-04]
screenshots: 4
generatedFrom: user-workflows.md
workflowsVersion: "2026-10-19"
---
# W-16 — Settings: language, theme, fonts, folders

**Goal:** configure the app.

1. Click the **gear** ([en:tran:Setting]) in the header — Settings opens in its own window. 📸
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
   - **Directories:** where documents, lyrics, and bibles are stored on disk. With no
     data folder chosen, **[en:tran:Click here to use the default data folder]** makes
     `.owa\open-worship-data` in your user folder. One still on the Desktop is asked
     about at every start — see **W-54**.
   - **To keep everything somewhere else**, press the folder line
     under **[en:tran:Parent Directory:]** (the folder in use) and a box opens under it: type the
     folder's path and press Enter, or press **[en:tran:Choose a folder]** and pick it.
     The app asks **[en:tran:Set according paths]** first, and **[en:tran:Yes]** makes the
     standard folders (Documents, Videos, Images and the rest) inside it, uses them and
     reloads. What you already have is not moved. It stays in the old folder, where
     **[en:tran:Recent Folders]** below takes you back, or a backup brings it along (W-25).
   - **To switch back to a previous data folder.** In **[en:tran:General]**, under **[en:tran:Parent Directory:]** → **[en:tran:Recent Folders]**, press
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
   - **Reset buttons** (`Reset All Child Directories` / `Clear All Settings`):
     **these erase configuration; use with care.** Both ask for confirmation first.
   - **[en:tran:Show Tips of the Day automatically]:** controls whether the Presenter and Bible
     Reader show an automatic tip after the next app launch.
   - Panel sizes are no longer reset from here — see **W-31**.
3. **[en:tran:Bible]** tab: import a Bible XML from a file or URL, edit installed XML Bibles,
   or export/import a **[en:tran:Bible Data]** archive. The old online version list is
   development-only and can be unavailable. 📸
   **An installed Bible has no on/off switch.** Every Bible in that list is offered
   wherever a version is chosen. To stop one being offered, take it off the computer: the
   trash icon on its row, **[en:tran:Move to Trash]**, opens a confirmation titled
   **[en:tran:Delete Bible XML]**. Press **[en:tran:Yes]** in that dialog to send
   its file to the Recycle Bin, from where it can be brought back or imported again.
4. Click **[en:tran:Apply Settings]** (bottom-left) to apply — the app windows reload.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`ST-01` · `ST-02` · `ST-03` · `ST-04` · `ST-05` · `ST-06` · `ST-07` · `ST-08` · `ST-09` · `ST-22` · `ST-52` · `ST-58` · `LT-02` · `LT-03` · `LT-04`

Regenerated from `user-workflows.md` (workflowsVersion 2026-10-19).
:::
