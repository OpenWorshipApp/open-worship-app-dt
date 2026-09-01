---
id: W-05
title: "Present song lyrics"
section: "Presenting content"
verify: [PL-07, PL-08, PM-11, PM-115, PM-116, PM-117, PM-127, XW-08]
screenshots: 4
generatedFrom: user-workflows.md
workflowsVersion: "2026-08-31"
---
# W-05 — Present song lyrics

**Goal:** put a song's lyrics on the screen.

1. In the left column, click a song in the **Documents** (ឯកសារ) list — songs carry a
   music-note icon. The middle **Documents** tab switches to the song view: the lyric
   **Previewer** on top and the **Stage Previewer** verses under it. Only one file in the
   list is ever highlighted, so picking a song releases whatever was selected before. 📸
2. **Double-click** a verse to send it to the screen.
3. Press **F8** / the clear button to take it down.
4. If the song's `ol:Config` block lists an **`- Attachments:`** field — one link per
   line — each link also becomes its **own slide at the end** of the Stage Previewer,
   named after the link. A YouTube link becomes a playable video, an image / video /
   audio link becomes that media, and any other web address becomes the page itself;
   each fills the whole slide. Present one the same way you present a verse. A link to
   a file on this computer works too (written `file:///C:/…`), which is how a chart or
   a backing track travels with the song. 📸
5. Links the app cannot show — a PDF, or a line that is not a web address — still get
   their named slide, just an empty one.
6. To change how a stage's slides **look**, click the **⚙** on that stage's chip
   (`Stage 0`, `Stage 1`) in the Stage Previewer header. A small **Stage Style** window
   opens — drag it anywhere, it remembers where you left it. It sets **Slide Padding**,
   **Background Opacity**, **Extra Font Size**, a **Light/Dark** theme, and a
   **Custom CSS** box for anything else. 📸
7. These settings belong to the **stage**, not to the song — every song you open uses
   them, which is why the panel says _Applies to every song_. Stage 0 and Stage 1 keep
   separate settings, so you can leave the projected stage plain and make the chord
   stage larger. Custom CSS is **added to** the stage's built-in look rather than
   replacing it, so stage 0 keeps hiding its chords whatever you type.
8. **Reset** puts that stage back to the defaults.
9. A screen already showing a slide keeps it — present the slide again to push the new
   look out to it.
10. **Edit the words while the song is open and the verses follow by themselves.** Change the
    song in the **Lyric Editor** (right-click the song → **edit**) — or in any other window —
    and within a second or two the rendered song **and every Stage Previewer pane** show the
    new words. You do not have to re-pick the song, and you do not have to save first: the
    editor keeps your unsaved work on disk, and that is what the verses render. 📸
11. If you ever need to force it — a song changed by something outside the app, say — the
    **⋮** at the right end of the Stage Previewer header holds **Reload**, which re-renders
    every stage at once. The same **Reload** sits in the right-click menu of a stage pane and
    of the rendered song above it.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`PL-07` · `PL-08` · `PM-11` · `PM-115` · `PM-116` · `PM-117` · `PM-127` · `XW-08`

Regenerated from `user-workflows.md` (workflowsVersion 2026-08-31).
:::
