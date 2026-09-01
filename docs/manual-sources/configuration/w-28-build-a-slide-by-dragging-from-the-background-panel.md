---
id: W-28
title: "Build a slide by dragging from the Background panel"
section: "Configuration"
verify: [ED-40, ED-41, ED-42, ED-43, ED-44, ED-21, ED-37, PM-06]
screenshots: 4
generatedFrom: user-workflows.md
workflowsVersion: "2026-08-31"
---
# W-28 — Build a slide by dragging from the Background panel

**Goal:** put a picture, video, song, web page, camera or colour onto a slide without
walking the Insert menu — just drag it out of the panel you are already browsing.

**Preconditions:** a slide document open in the **Slide Editor**, and the bottom
**Background** panel visible.

1. Pick a tab in the bottom **Background** panel — **Colors** (ពណ៌), **Images** (រូបភាព),
   **Videos** (វីដេអូ), **Cameras** (កាមេរ៉ា) or **Webs** (វេប). The presenter also has an
   **Audios** pane. 📸
2. Drag one item out of the panel and hold it over the canvas. The canvas **dims** to show
   it will take the drop. (It stays bright for things it cannot use — a Bible verse, for
   example.) 📸
3. Let go. A box appears **centred on where you dropped it**:

   | Dragged from        | You get                                                                               |
   | ------------------- | ------------------------------------------------------------------------------------- |
   | Images              | an image box                                                                          |
   | Videos              | a video box                                                                           |
   | Audios              | an audio player box                                                                   |
   | Webs — a local page | a website box showing a **screenshot** of that page (see W-24 step 4)                 |
   | Webs — a saved URL  | a website box showing a **screenshot**; a **YouTube** link becomes a real YouTube box |
   | Cameras             | a camera box, labelled with that camera                                               |
   | Colors              | a plain coloured box (see step 4)                                                     |

   📸

4. **Colours are the special one.** Drop a colour **on top of an existing box** and it
   **repaints that box** — no new box is added. Drop it on **empty canvas** and you get a
   new coloured rectangle instead. That rectangle is an ordinary text box underneath, so
   you can double-click it and type into it later. 📸
5. Anything you drop in is an ordinary box: move it, resize it, reorder it, and **Undo**
   (Ctrl+Z) takes it straight back out. Save with **Ctrl+S**.

Tips:

- Dropping onto a box only matters for **colours**. Every other kind lands as a new box
  wherever the cursor was, on top of whatever is underneath.
- This is the same drag that sets a screen background — the panel item is unchanged, you
  are only making a copy of it on the slide.
- A camera box remembers **which** camera by name as well as by id, so it still finds the
  right device after a restart.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`ED-40` · `ED-41` · `ED-42` · `ED-43` · `ED-44` · `ED-21` · `ED-37` · `PM-06`

Regenerated from `user-workflows.md` (workflowsVersion 2026-08-31).
:::
