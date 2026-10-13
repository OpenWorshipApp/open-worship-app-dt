---
id: W-21
title: "Add a background video or song from a link"
section: "Configuration"
verify: [MD-01, MD-02, MD-03, CM-24, PM-102]
screenshots: 2
generatedFrom: user-workflows.md
workflowsVersion: "2026-10-13"
---
# W-21 — Add a background video or song from a link

**Goal:** get a video (or its audio as an MP3) from an online link straight into your
Videos / Audios folder, without leaving the app. The download tools are not built into the
app: the first time, a **[en:tran:Media Tools Required]** box offers to open
**[en:tran:Setting]** → **[en:tran:Others]** → **[en:tran:Extra Binaries]**, where they are
installed once.

1. Open the **[en:tran:Background]** panel (W-08 step 1) and choose the **[en:tran:Videos]** tab — or the **[en:tran:Audios]** split if you want the sound only.
2. **Right-click an empty part of the list** (or use the ⋮ [en:tran:More Options] button at
   the right of the folder-path bar) and choose **[en:tran:Download From URL]**. 📸
3. A small box asks for the link — **[en:tran:Video URL:]** on the Videos tab, **[en:tran:Audio URL:]** on
   Audios. If you copied the link first, it is **already filled in**; otherwise paste it.
   The box is only outlined red — with **[en:tran:Cannot be empty]** under it — once you
   have typed in it and emptied it again.
4. Click **[en:tran:Ok]**. The download runs in the background — a full song or video takes a
   couple of minutes, and you can keep using the app while it does.
5. When it finishes, the file **appears in the folder you were in**: the video shows up as
   a new thumbnail in the Videos tab, the audio as a new row under **[en:tran:Audios]**. 📸 From there
   it behaves like any other background (W-08) or track (W-09).

> Notes: audio is always converted to **MP3**, video keeps the site's best quality
> (`.webm`/`.mp4`). If a file with that name is already in the folder, the new one is
> saved as `name (1)`. Pasting something that is not a web link gets you an
> **[en:tran:Invalid URL]** message and nothing is downloaded. Downloads need an internet connection — and
> a busy site can cut a large download off partway, in which case just try again.
> **A download that fails leaves nothing in your folders.** The app downloads into the
> computer's own temporary folder and takes its unfinished pieces away when the download
> fails (you are told why under **[en:tran:Download From URL]**). Only when the app was
> closed in the middle of a download can a file named `temp-…` be left in that temporary
> folder: nothing in the app uses it, and it is safe to delete once no download is running.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`MD-01` · `MD-02` · `MD-03` · `CM-24` · `PM-102`

Regenerated from `user-workflows.md` (workflowsVersion 2026-10-13).
:::
