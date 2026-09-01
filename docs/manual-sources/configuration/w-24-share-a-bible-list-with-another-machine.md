---
id: W-24
title: "Share a bible list with another machine"
section: "Configuration"
verify: [PR-27, PR-28, PR-29, CM-38, CM-39]
screenshots: 2
generatedFrom: user-workflows.md
workflowsVersion: "2026-08-31"
---
# W-24 — Share a bible list with another machine

A bible list (the verses you lined up for a service) travels the same way.

1. In the **Bibles** panel, right-click the list you want and choose **Export**
   (នាំចេញ). A small panel asks for a **Password** (ពាក្យសម្ងាត់) and a **Confirm
   Password** (បញ្ជាក់ពាក្យសម្ងាត់) — leave both empty for the ordinary bundle, or type
   the same password in both to lock it (W-22 step 10a). You get one
   `<name>.owbible.tar.gz` file in your **Downloads** folder, or `<name>.owbible.enc`
   if you set a password. 📸
2. The bundle is small: a bible list stores verse _references_, not the Bible text, so
   only the list and any background you attached to it (or to one of its verses) are
   inside.
3. On the other machine, right-click an empty part of the **Bibles** panel → **Import**
   (នាំចូល) and pick the file — or **drag the `.owbible.tar.gz` (or `.owbible.enc`) onto
   the Bibles panel**; a protected one asks for its password first. **Import From URL**
   (នាំចូលពី URL) works here too. 📸
4. The list appears in that machine's bibles folder with its verses, their colours and
   its background, ready to present.

> Notes: the Bible **versions** the verses name are not part of the bundle — they are
> large, separately downloaded files. If the other machine does not have a version yet,
> download it there (Settings → Bible) and the verses show up. The **Bible Reader** page
> keeps its own bibles folder, so importing there adds the list to the reader's folder,
> not the presenter's.
>
> A bundle can only be imported by the list it came from: picking a document bundle in
> the Bibles panel (or a bible bundle in the Documents list) is refused with a message
> naming what the file actually holds, and nothing is written.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`PR-27` · `PR-28` · `PR-29` · `CM-38` · `CM-39`

Regenerated from `user-workflows.md` (workflowsVersion 2026-08-31).
:::
