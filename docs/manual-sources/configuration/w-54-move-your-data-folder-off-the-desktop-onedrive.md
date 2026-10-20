---
id: W-54
title: "Move your data folder off the Desktop (OneDrive)"
section: "Configuration"
verify: [ST-20, ST-80, ST-81]
screenshots: 3
generatedFrom: user-workflows.md
workflowsVersion: "2026-10-19"
---
# W-54 — Move your data folder off the Desktop (OneDrive)

**Goal:** keep your songs, slides, Bibles and settings where a backup program cannot
take them away.

The app used to make its data folder on the Desktop, `Desktop\open-worship-data`. On
Windows, Microsoft OneDrive often backs up the Desktop, and while it syncs it can
replace files with online-only copies or take them off the computer — songs, slides
and settings went missing. A new data folder now goes to `.owa\open-worship-data` in
your user folder (`~/.owa/open-worship-data` on a Mac or Linux), which nothing syncs.

1. Start the app. While your data folder is still `Desktop\open-worship-data`, every
   start asks **[en:tran:Move Your Data Folder Off the Desktop]**. It names your folder,
   says why it is at risk on this computer — OneDrive on Windows, iCloud Drive on a
   Mac — and where it will go. 📸
2. Press **[en:tran:Move Now]**. The app closes and opens again, and moves the folder
   before it opens anything in it. Outside OneDrive the folder is simply moved. Inside
   OneDrive, or when a file in it is in use, every file is copied and checked, and the
   old folder stays where it was.
3. **[en:tran:Data Folder Moved]** says where your data is now — and, after a copy,
   where the old copy is. Press **[en:tran:Ok]**. Pictures, videos and songs still
   show: links that named the old place follow the folder. 📸
4. After a copy, every start shows **[en:tran:Old Copy of Your Data Folder]** with the
   day it was moved. Check that your songs and slides are all there, then press
   **[en:tran:Show Folder]** and move the old folder to the Recycle Bin (Trash)
   yourself — the app never deletes it. Once it is gone, the reminder stops. 📸
5. Not now? **[en:tran:Not Now]** asks again at the next start.
   **[en:tran:Hide for 30 days]** keeps the question away for 30 days.

> Notes: `migration-moved-from.txt` in the new folder says where it came from and
> when; `migration-moved-to.txt` in an old copy says where it went. A move that fails
> changes nothing: **[en:tran:Data Folder Not Moved]** says why, the app keeps using
> the folder where it is, and it asks again at the next start. On a Mac, a file that is
> only in iCloud Drive stops the move until it is downloaded (Finder → **Download
> Now**). The new folder's name starts with a dot, so Finder and Linux file managers
> hide it; the folder picker in Settings shows it.

Steps 1–5 were observed live 2026-10-17 on a scratch dev profile with a throwaway
Desktop folder, in English and Khmer: the question with each of its three answers,
the move as the app started again (renamed; then copied, with a file held open), the
result, the reminder with its date in Khmer digits, and the reminder gone once the old
copy was. **[en:tran:Show Folder]** was not pressed — it opens the computer's file
window — and is unit-tested. Not seen live: OneDrive itself (the copy was forced by a
file held open) and a Mac.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`ST-20` · `ST-80` · `ST-81`

Regenerated from `user-workflows.md` (workflowsVersion 2026-10-19).
:::
