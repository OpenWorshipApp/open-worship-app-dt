---
id: W-25
title: "Back up everything, or move to a new computer"
section: "Configuration"
verify: [NAV-17, NAV-18, NAV-19]
screenshots: 4
generatedFrom: user-workflows.md
workflowsVersion: "2026-08-31"
---
# W-25 — Back up everything, or move to a new computer

W-22 to W-24 each carry one thing. To take **all** your material at once — for a backup,
or to set up a second machine — use the app's **File** menu.

1. Open the **File** menu at the top of the window and choose **Export Data**
   (នាំចេញទិន្នន័យ). 📸
2. A panel lists every data folder you have set up — Documents, Presenting Flows, Background
   Images, Videos, Audios and Webs, Bible Present, Bible Reader, Notes, and **Bibles XML**
   — with the folder each one points at. **They all start ticked.** Untick anything you do
   not want (the videos folder is usually the big one), or use **Select All** /
   **Deselect All**. 📸

   > **Bibles XML** is the one folder you never chose yourself — the app keeps it. It
   > carries the Bible XML files you added by hand (Settings → Bible → Bibles XML), and
   > **only those**: the Bible versions you downloaded in the app are left out, because
   > you simply download them again on the other machine. If you have never added an XML
   > Bible, the row is not offered at all.
   > 2a. Below the folder list, the same panel asks for a **Password** (ពាក្យសម្ងាត់) and a
   > **Confirm Password** (បញ្ជាក់ពាក្យសម្ងាត់). Leave both empty for an ordinary backup.
   > Type the same password in both to lock it — a backup carried on a USB stick holds your
   > whole document set, so this is the one worth protecting. 📸

   > **There is no way to recover a forgotten password**, and this file is everything you
   > have. Write it down somewhere that is not the same USB stick.

3. Press **Ok**. You get one `open-worship-data.owadata.tar` file in your **Downloads**
   folder — or `open-worship-data.owadata.enc` if you set a password — and the folder
   opens. Copy it to a USB stick or the other machine.
4. On the other machine, choose **File → Import Data** (នាំចូលទិន្នន័យ) and pick that
   file. A protected backup asks for its password first. The panel then lists only the
   folders the file actually contains — again all ticked — so you can restore just the
   songs, or just the backgrounds. 📸

   > A protected backup is unlocked in one pass before that list can be shown, so a big
   > one takes a moment longer to open than an ordinary one. An ordinary backup is read
   > as quickly as it always was.

5. Press **Ok**. When it finishes you are told how many files were brought in and how
   many were already up to date.

> Notes: this is a **copy, not a replacement**. A file already on the machine with the
> same contents is left alone, so importing the same backup twice changes nothing and is
> safe to repeat. If a file has the same NAME but different contents — you edited the song
> on this machine — **your version is kept** and the one from the backup is added beside
> it as `song (1).ows`, for you to compare and delete whichever you do not want. Nothing
> is ever overwritten.
>
> Importing writes into the folders **this** machine has set up, so choose them first
> (Settings → Path Settings). If one of them has no folder yet, the import stops before
> copying anything and tells you which to set.
>
> The backup leaves out the working files the app can rebuild by itself — a document's
> undo history and the page images made for PDF/PowerPoint/Word previews — so it stays
> much smaller than the folders themselves, and those are regenerated on the other
> machine the first time you open the document.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`NAV-17` · `NAV-18` · `NAV-19`

Regenerated from `user-workflows.md` (workflowsVersion 2026-08-31).
:::
