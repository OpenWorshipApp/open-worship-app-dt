---
id: W-55
title: "Find and install a language (Settings → Languages)"
section: "Configuration"
verify: [ST-87, ST-88, ST-89, ST-90]
screenshots: 1
generatedFrom: user-workflows.md
workflowsVersion: "2026-11-10"
---
# W-55 — Find and install a language (Settings → Languages)

**Goal:** show the app in your own language, or stop offering one you never use.

English is part of the app. Every other language is a
separate package, installed from the list Open Worship publishes online. An installed
language is kept in your data folder, under `lang`.

1. Open Settings (the **gear**, W-16) and choose the **[en:tran:Languages]** tab. Its
   first section, **[en:tran:Language]**, holds the buttons that choose the language the
   app is shown in (W-16 step 4a). 📸
2. **[en:tran:Installed Languages]** lists every language on this computer, each under
   its own name with its English name beside it, its version, and
   **[en:tran:Installed]** (you installed it). English is first, reads
   **[en:tran:Built in]**, and is always on. To see where a language is kept, press
   the folder icon (**[en:tran:Reveal Folder]**) on its row: your file manager opens
   on its folder, and nothing in the app changes.
3. **To stop offering a language**, turn its switch off. It is no longer offered under
   **[en:tran:Language]** at the top of this tab (or anywhere else a language is
   chosen) and its row reads
   **[en:tran:Turned off]**. If the app was shown in it, the app goes back to English.
   Turn the switch on to offer it again. Either way every open window reloads at once
   to follow; there is nothing more to press. Every change on this tab — turning a
   language on or off, installing, updating, deleting, importing, choosing one — is
   applied that way, without **[en:tran:Apply Settings]**.
4. **To install a language**, type its name into **[en:tran:Search languages]** under
   **[en:tran:Find a Language]** — in English (`hebrew`) or in its own words — and press
   **[en:tran:Install]** on its row. Once it is installed every open window reloads, and
   it is listed under **[en:tran:Installed Languages]**. The list needs the
   internet; with none it says it could not be reached, and **[en:tran:Refresh]** (the
   round arrow) tries again.
5. **To show the app in it**, press the language's button under **[en:tran:Language]**
   at the top of this tab: every window reloads in it (W-16 step 4a).
6. **When a newer version is out**, its row shows **[en:tran:Update to]** with the new
   number, and the section reads **[en:tran:Update Available]**. Press it: the new
   version replaces the old one, and every window reloads with it.
   You do not have to come looking: a few seconds after the app starts, it checks the
   languages you installed against the list once, and when one has a newer version a
   small amber dot appears on the **gear** at the top right of the window. Follow the
   dots — in Settings one stands after **[en:tran:Languages]**, another after
   **[en:tran:Installed Languages]**, and one on the language's own row. They go away
   once it is updated. With no internet nothing is checked and no dot appears.
7. **To delete a language you installed**, press the trash icon on its row and confirm
   with **[en:tran:Delete]** in **[en:tran:Delete Language]**. Every window reloads; if
   the app was shown in the deleted language, it is in English again. When some of the
   language's files are still in use, nothing reloads: a message says to close the app
   and press it again to finish, and **[en:tran:Apply Settings]** turns amber for what
   did change.
8. **To pass a language on to a computer with no internet**, press the download arrow
   (**[en:tran:Download]**) on its row under **[en:tran:Find a Language]**. The language
   is saved as a file into your Downloads folder, which opens on it — named like
   `es-0.0.1.tar.gz`. Copy it to the other computer (a USB stick, a shared folder).
   There, press **[en:tran:Import]** at the top right of **[en:tran:Installed Languages]**
   and choose the file: it installs as if from the list, every window reloads, and it
   is listed under **[en:tran:Installed Languages]**.
   The app first checks the file against the list Open Worship publishes. When it
   cannot — the file was changed, or there is no internet to check with — it asks
   before installing: a language carries code the app runs, so press
   **[en:tran:Import]** only for a file from someone you trust, otherwise
   **[en:tran:Cancel]**. A file that is not a language this app can install is refused
   with a message saying so.

Steps 1–7 were observed live on 2026-11-04 in the development app, with Hebrew from the
development list: found by `hebr` and by its own name, installed, shown right to left,
updated, deleted while in use (back to English), and French turned off and on. Step 8
was observed live the same day: Spanish saved to Downloads by its download arrow,
imported from that file (installed again, nothing left behind), and a changed copy of
it asked about first. The dots of step 6 were observed live on 2026-11-05 on a fresh
development profile holding an older Khmer: on the gear, after **[en:tran:Languages]**,
**[en:tran:Installed Languages]** and Khmer's row, all gone after its
**[en:tran:Update to]**. The reload at once was observed live on 2026-11-05 in the
development app for steps 3, 5 and 6: French to English and back reloaded the Presenter
and Settings in the new language, Settings back on this tab; Khmer turned off and on
again reloaded them too; and **[en:tran:Update to]** on Khmer, then on French (the
language in use), reloaded them once each update was in — **[en:tran:Apply Settings]**
never lit. Install, delete and import call the same reload once they succeed (unit
tested; not driven live, to keep the installed languages as they were). The folder
icon of step 2 was observed live on 2026-11-06 in the development app: on every one
of the forty installed rows, beside the trash icon; Khmer's opened the file manager
on the data folder's `lang` folder with Khmer's own folder chosen, and nothing
reloaded.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`ST-87` · `ST-88` · `ST-89` · `ST-90`

Regenerated from `user-workflows.md` (workflowsVersion 2026-11-10).
:::
