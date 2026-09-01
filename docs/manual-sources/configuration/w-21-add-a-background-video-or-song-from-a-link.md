---
id: W-21
title: "Add a background video or song from a link"
section: "Configuration"
verify: [MD-01, MD-02, MD-03, CM-24, PM-102]
screenshots: 2
generatedFrom: user-workflows.md
workflowsVersion: "2026-08-31"
---
# W-21 — Add a background video or song from a link

**Goal:** get a video (or its audio as an MP3) from an online link straight into your
Videos / Audios folder, without leaving the app or installing anything.

1. Open the **Background** (ផ្ទៃខាងក្រោយ) panel (W-08 step 1) and choose the **Videos**
   (វីដេអូ) tab — or the **♫Audios♫** (សំលេង) split if you want the sound only.
2. **Right-click an empty part of the list** (or use the ⋮ More Options button at
   the right of the folder-path bar) and choose **Download From URL**
   (ទាញយកពី URL). 📸
3. A small box asks for the link — **Video URL:** on the Videos tab, **Audio URL:** on
   Audios. If you copied the link first, it is **already filled in**; otherwise paste it.
   The box is outlined red while it is empty.
4. Click **Ok**. The download runs in the background — a full song or video takes a
   couple of minutes, and you can keep using the app while it does.
5. When it finishes, the file **appears in the folder you were in**: the video shows up as
   a new thumbnail in the Videos tab, the audio as a new row under ♫Audios♫. 📸 From there
   it behaves like any other background (W-08) or track (W-09).

> Notes: audio is always converted to **MP3**, video keeps the site's best quality
> (`.webm`/`.mp4`). If a file with that name is already in the folder, the new one is
> saved as `name (1)`. Pasting something that is not a web link gets you an **Invalid
> URL** message and nothing is downloaded. Downloads need an internet connection — and
> a busy site can cut a large download off partway, in which case just try again.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`MD-01` · `MD-02` · `MD-03` · `CM-24` · `PM-102`

Regenerated from `user-workflows.md` (workflowsVersion 2026-08-31).
:::
