---
id: W-34
title: "Add a Bible translation from the internet (XML), and make it read in its own language"
section: "Keyboard shortcut reference (tutorial appendix)"
verify: [ST-41, ST-42, ST-43, ST-44, ST-45, ST-46, ST-47, ST-48, ST-49, ST-50, ST-24, ST-25, ST-26, ST-29, ST-31, ST-32, ST-51, RD-11, LT-01]
screenshots: 7
generatedFrom: user-workflows.md
workflowsVersion: "2026-08-31"
---
# W-34 — Add a Bible translation from the internet (XML), and make it read in its own language

W-33 moves translations you already have. This one **adds a new translation from a link** —
the way `ពគប` (Khmer BFBS 1954) was added — with no file to download by hand and no file
manager: every step is in the app.

The example throughout is the free Beblia XML collection, whose Khmer edition lives at
`https://github.com/Beblia/Holy-Bible-XML-Format/raw/refs/heads/master/KhmerBFBSBible.xml`.
Any XML in the app's format works the same way (**Import XML File → ?** shows the format).

**Part 1 — bring the file in**

1. Open **Settings** (Tools → Settings, or the ⚙ button) and pick the **Bible**
   (ព្រះគម្ពីរ) tab. Top-left is the **Import XML File** (នាំចូលឯកសារ XML) box. 📸
2. Leave **Choose File** alone and paste the link into the **URL:** box instead. As soon as
   the link is a valid address the file row dims out and **Import** (នាំចូល) lights up.
   (A malformed address turns the box red with the tip **Invalid URL**.)
3. Click **Import**. A progress line walks through **Downloading file… → Reading file… →
   Deleting file…** — the app fetches the file itself, reads it, and throws the download
   away. Bibles are big; the Khmer one is about 14 MB, so give it a moment.
   > A GitHub `…/raw/…` link is fine as-is — the app follows the redirect. So is any plain
   > `http://` address, e.g. a file served off another laptop on your own network.

**Part 2 — name it (the "Key is missing" question)**

4. Most XML bibles on the internet carry no short code, so the app asks: a **Key is
   missing** window with **Define a Bible key**, a **Key:** box, and a row of **Guessing
   keys:** buttons. 📸
   The buttons are every word the app could find in the file's own header, so one of them
   is usually the right answer — for the Khmer file the publisher left a bible.com address
   in the header ending in `…GEN.23.ពគប`, and **`ពគប` is offered as a button**. Click it and
   the box fills in. Otherwise type your own short code; anything works, including Khmer.
   > A code you already use is refused — the box turns red with **Key is already taken**.
   > This code is the badge you will see everywhere in the app, and it also becomes the
   > file name, so **choose it now**: changing it later in the editor renames the badge but
   > not the file.
5. Click **Ok**. The app asks once more — **Confirm Key for Bible**, _Do you want to
   continue with key="ពគប"?_ — click **Yes**. (**No** takes you back to the box; the way
   out entirely is **Cancel** then **No**.)
6. The new translation appears in the **Bibles XML** list on the right, badge on the left
   and full title beside it. 📸 It works already — but if it is not an English bible, read on.

**Part 3 — make it read in its own language**

A file downloaded from the internet almost never says what language it is in, so the app
assumes English: book names in English, `1 2 3` instead of `១ ២ ៣`, and the translation
filed under **English** in the bible menu. Three settings fix that, and **the order
matters** — the last two take their suggestions from the language you set first.

7. Click the ✏️ **pencil** next to your new translation. The **Info** tab opens a text
   editor holding the translation's settings. **Right-click inside it** — below the usual
   editing commands are three of the app's own:
   **🌎 Choose Locale**, **#️⃣ Edit Numbers Map**, **📚 Edit Books Map**. 📸
8. **🌎 Choose Locale** first. Pick the language from the list — for Khmer that is
   **km-KH (Khmer (ភាសាខ្មែរ))**. The `"locale"` line in the editor changes and the bar at
   the bottom starts warning **Unsaved changes**.
9. **#️⃣ Edit Numbers Map** next. The window is titled **Numbers map** and now says _Define
   numbers map for km_ — because of step 8. Click **Use ១ ២ ៣** to fill in that language's
   own digits and click **Ok**. (There is also a **Translate** link to Google Translate if
   your language is not one the app knows.) 📸
10. **📚 Edit Books Map** last. This opens the 66 book names, one per line, with the
    English name of each book shown down the left so you can never lose your place. Click
    **📖 Guessing Names** — the app lists the book-name sets it ships for that language,
    labelled by the translations that use them (for Khmer: `អគត`, `ពគប, គកស១៦, GKHB`,
    `គខប`), with the set matching your code shown first and in bold. Pick one and all 66
    lines fill in. Click **Ok**. 📸
    > No set to pick from? Use **Translate** to translate the whole list in one go, paste
    > it back, and — if what you paste comes back as web markup — **Parse Markup String**
    > cleans it up. **Reset** puts the English names back.
11. Click **Save**. The app reloads its windows, which is normal.
12. Check it: in the **Bible Reader**, open the bible chooser. Your translation has moved
    out of **English** and now sits under its own language heading, and its references read
    in its own script and numerals — `(ពគប) កិច្ចការ ២៨:១៥` rather than `(ពគប) Acts 28:15`. 📸

> **Removing one.** The 🗑 next to a translation asks _Are you sure to delete bible XML
> "…"?_ — **Yes** sends the file to the Recycle Bin. Its badge disappears from every bible
> menu. (A small hidden `…​.xml.cache` folder is left beside it in the app's bible folder;
> it is harmless, and reusing the same code later just refills it.)

> **Putting the KJV back.** The **KJV** row — and only that row — carries an extra
> orange ↺ button, **Reset Bible XML** (កំណត់ XML ព្រះគម្ពីរឡើងវិញ), to the LEFT of the ✏️ pencil.
> It asks _Reset this bible XML with the app embedded KJV? All your changes will be
> lost._ — **Yes** throws away the KJV file you have and writes the copy that ships inside
> the app (the same copy the **Create KJV Bible XML** row below writes),
> then reloads the windows. Use it when your KJV has been edited into a state you no longer
> want, or looks broken; there is no undo, so export it first (W-33) if you want it back.
> If the KJV editor is open with unsaved changes the button refuses and warns
> **Unsaved Bible Data** — save or discard first.
>
> **Deleted it by mistake?** The KJV is the one translation the app carries inside
> itself, so it can always be rebuilt. Whenever your list has no **KJV**, a green
> **+ Create KJV Bible XML** (បង្កើតឯកសារ XML ព្រះគម្ពីរ KJV) row sits at the TOP
> of the **Bibles XML** list, above the translations — not only on a brand-new install
> with nothing in the list. Click it and the KJV comes back; the button then disappears
> because there is nothing left to create.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`ST-41` · `ST-42` · `ST-43` · `ST-44` · `ST-45` · `ST-46` · `ST-47` · `ST-48` · `ST-49` · `ST-50` · `ST-24` · `ST-25` · `ST-26` · `ST-29` · `ST-31` · `ST-32` · `ST-51` · `RD-11` · `LT-01`

Regenerated from `user-workflows.md` (workflowsVersion 2026-08-31).
:::
