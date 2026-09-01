---
id: W-33
title: "Share your Bible translations (XML) with another machine"
section: "Keyboard shortcut reference (tutorial appendix)"
verify: [ST-34, ST-35, ST-36, ST-37, ST-38, ST-39, ST-40, LT-01]
screenshots: 4
generatedFrom: user-workflows.md
workflowsVersion: "2026-08-31"
---
# W-33 — Share your Bible translations (XML) with another machine

W-24 shares a **bible list** — the verses you lined up. This shares the **translations
themselves**: the XML bibles you added or edited under **Settings → Bible**, which
until now could only be moved by digging the files out by hand.

1. Open **Settings → Bible** (ព្រះគម្ពីរ). Under the **Import XML File**
   (នាំចូលឯកសារ XML) box on the left there is a card headed **Bible Data**
   (ទិន្នន័យព្រះគម្ពីរ). 📸
2. Click **Export Bible Data** (នាំចេញទិន្នន័យព្រះគម្ពីរ). A panel opens listing every
   translation you have, one row each, showing its short **key** (`KJV`, `GKHB`, `ពគប`…)
   and its full title. Everything starts ticked. Untick the ones you do not want, or use
   **Deselect All** (ដកការជ្រើសរើសទាំងអស់) and pick just a few. 📸
3. Below the list, the same **Password** (ពាក្យសម្ងាត់) / **Confirm Password**
   (បញ្ជាក់ពាក្យសម្ងាត់) pair as every other export: leave both empty for the ordinary
   bundle, or type the same password in both to lock it. Type them differently and the
   app tells you **Passwords do not match** in the panel itself and brings it straight
   back — still holding the bibles you ticked and the password you typed — so a mistyped
   password can never quietly produce an unprotected file, and you never have to pick your
   translations a second time.
4. Click **Ok**. You get one `Bible Data.owabdata.tar.gz` in your **Downloads** folder
   (or `Bible Data.owabdata.enc` if you set a password), and the folder opens on it.
   Bibles are big files — a couple of translations can run to tens of MB.
5. On the other machine, open **Settings → Bible** and **drag the file anywhere onto
   that page** — the whole Bible settings area accepts it, not just the small card. Or
   click **Import Bible Data** (នាំចូលទិន្នន័យព្រះគម្ពីរ) and pick it. A protected
   bundle asks for its password first, and says **Wrong password, try again** rather
   than failing outright. 📸
6. A panel lists what is inside. Anything that can come in is ticked. Anything that
   **cannot** is shown as a **red row** you are not allowed to tick, with the reason on
   the right:
   - **Bible key already exists** (លេខកូដព្រះគម្ពីរនេះមានរួចហើយ) — you already have a
     translation with that key. Upper and lower case count as the same key, so a `kjv`
     in the bundle is refused against a `KJV` you already have.
   - **Duplicate bible key in this archive** (លេខកូដព្រះគម្ពីរស្ទួនក្នុងឯកសារបណ្ណសារនេះ)
     — two entries in the same bundle claim the same key; the first one is offered.
   - **Unable to read this bible file** (មិនអាចអានឯកសារព្រះគម្ពីរនេះបានទេ) — the app
     could not read a bible key out of that file, so it cannot check it and will not
     touch it. 📸
7. Click **Ok**. The ticked translations are added and the list on the right refreshes
   to show them. A message tells you how many came in and how many were skipped.

> Notes: an import **never replaces** a translation you already have, and never leaves
> you with two copies of one. That is the whole point of the red rows — where documents
> and backgrounds add a second copy as `a (1).mp4`, a bible is identified by its key,
> and two bibles with the same key would be ambiguous everywhere else in the app. If you
> genuinely want the incoming version, delete yours first (the 🗑 next to it) and import
> again.
>
> Only the **XML** translations are in the bundle — the ones listed under **Bibles XML**.
> Bible versions you downloaded inside the app are not: they are hundreds of MB and can
> simply be downloaded again on the other machine.
>
> The check is done against the **file inside the bundle**, not against what the bundle
> claims — so a hand-edited bundle cannot talk the app into overwriting a bible.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`ST-34` · `ST-35` · `ST-36` · `ST-37` · `ST-38` · `ST-39` · `ST-40` · `LT-01`

Regenerated from `user-workflows.md` (workflowsVersion 2026-08-31).
:::
