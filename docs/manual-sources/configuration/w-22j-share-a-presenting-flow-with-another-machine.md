---
id: W-22j
title: "Share a presenting flow with another machine"
section: "Configuration"
verify: []
screenshots: 2
generatedFrom: user-workflows.md
workflowsVersion: "2026-10-24"
---
# W-22j — Share a presenting flow with another machine

**Goal:** hand the whole service — the running order and every file it needs — to another
machine as one file.

1. Right-click the presenting flow → **[en:tran:Export]**. A small panel asks for a
    **[en:tran:Password]** and a **[en:tran:Confirm Password]**.
    **Leave both empty and press Ok** for the ordinary bundle: one
    `<name>.owapf.tar.gz` file in your **Downloads** folder, and the folder opens. It
    contains the presenting flow _and every file it needs_ — the full documents behind your
    slides, the images and videos, and any background attached to those documents.
    (See step 1a to put a password on it instead.)
    1a. **To protect it with a password**, type the same password in both fields and press
    **[en:tran:Ok]**. **[en:tran:Show Password]** reveals what you typed if you want to
    check it. You get `<name>.owapf.enc` instead — the same bundle, locked. If the two
    fields do not match the panel says **[en:tran:Passwords do not match]** and asks again rather than exporting, keeping what you
    already typed so you only fix the half that is wrong. Clearing both fields is always
    allowed — that just means "no password".

    > **There is no way to recover a forgotten password.** Nobody — not you, not the app,
    > not the person you send it to — can open the bundle without it. Write it down
    > somewhere safe before you hand the file over, and send it by a different route than
    > the file itself.

2. **Import on the receiving machine.** First open **[en:tran:Settings]** →
    **[en:tran:Path Settings]** and choose the destination folders for the file
    types in the bundle. Then right-click an empty part of the **[en:tran:Presenting Flows]** list → **[en:tran:Import]** and pick that file — or just **drag the `.owapf.tar.gz` (or `.owapf.enc`)
    file from your file manager onto the Presenting Flows list**, which imports it the same way.
    A protected bundle asks for its password first, saying **This archive is password
    protected** ([en:tran:This archive is password protected]); get it wrong and it says
    **[en:tran:Wrong password, try again]** and lets
    you retype it, up to three tries. An ordinary bundle never asks. The songs, documents
    and media are re-created in that machine's own folders, Bible verses are added to the
    **Default** list, and every link inside the presenting flow is re-pointed at the local
    copies. 📸
3. If the bundle is on a web server or a machine sharing it over the local network,
    you can skip copying the file about: right-click the **[en:tran:Presenting Flows]** list →
    **[en:tran:Import From URL]**, paste the link and press **[en:tran:Ok]**. (If the link is
    already on your clipboard it is filled in for you.) The app downloads the bundle to a
    temporary folder, imports it exactly as above and then deletes the download — you end
    up with the presenting flow and nothing else left over. A plain `http://…` address with a
    port, such as one served off another laptop, works as well as `https://`. 📸

> Notes: a file that is already there **with the same contents** is reused rather than
> duplicated, so importing the same bundle twice is safe. If a file of the same NAME is
> already there but is actually a different file — your own `a.mp4` is not the `a.mp4`
> in the bundle — yours is left untouched and the bundled one is added beside it as
> `a (1).mp4`, with the presenting flow pointed at that copy. Slides and documents are
> stored as _references_, so editing a song later means the presenting flow projects the new
> words. Colours and cameras carry no file, so there is nothing to bundle for them.
>
> A video placed **inside a slide** travels too: the bundle carries the video file and
> the imported slide is re-pointed at the local copy, so it plays on the other machine.
> (Images placed in a slide are stored inside the slide itself, so they always travelled.)
>
> Importing needs the folders it will write into to be **chosen already** — if, say, no
> Videos folder has been picked yet and the bundle carries a video, the import stops
> before it copies anything and tells you which folder to choose first. Nothing is
> half-imported. And if a line in a presenting flow ever shows a warning triangle reading
> **[en:tran:Invalid item]**, that one entry is damaged (usually a hand-edited file) — the rest of
> the running order still works; remove that line and re-add it.
