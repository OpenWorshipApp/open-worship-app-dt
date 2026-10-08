---
id: W-34
title: "Add a Bible translation from the internet (XML), and make it read in its own language"
section: "Keyboard shortcut reference (tutorial appendix)"
verify: [ST-41, ST-42, ST-43, ST-44, ST-45, ST-46, ST-47, ST-48, ST-49, ST-50, ST-24, ST-25, ST-26, ST-29, ST-31, ST-32, ST-51, ST-60, RD-11, CB-80, CB-81, CB-82, LT-01]
screenshots: 5
generatedFrom: user-workflows.md
workflowsVersion: "2026-10-07"
---
# W-34 — Add a Bible translation from the internet (XML), and make it read in its own language

W-33 moves translations you already have. This workflow adds a translation from an XML
link and lets you review its language and mappings before saving it.

Example: `https://github.com/Beblia/Holy-Bible-XML-Format/raw/refs/heads/master/KhmerBible.xml`.
The GitHub redirect works as supplied. You can also use **[en:tran:Choose File]** for
an XML file already on your computer.

**The easy way: let the assistant do it**

You do not need a link, and you do not need an AI key: this runs on buttons.

1. Open **[en:tran:Settings]** → **[en:tran:Bible]** and press the blue
   **[en:tran:Let the assistant import a Bible for me]** at the top of
   **[en:tran:Import XML File]**. (Or open the assistant 🤖 and type
   `Import bible for khmer`, `Import bible`, or `Import bible from` and a link.)
   Answer the _Be careful with AI_ question with **Open**. 📸
2. The assistant opens in a new tab and asks **Which language do you want the Bible
   in?** Press **Khmer**, **English** or **French**, or type the language — in English
   or in its own words (`Thai`, `ខ្មែរ`, `Español`). **A file on this computer** opens
   the form below instead.
3. It lists **every** Bible in that language from a free collection of about a
   thousand (Beblia, on GitHub), each with the title its own file gives — for Khmer,
   seven, from _Khmer Standard Version 1954 = Hammond Version_ to _Khmer 2023
   (ព្រះគម្ពីរខ្មែរសាកល)_. Press the one you want. 📸
4. It downloads and reads it, then says what it is — for example _66 books, 1,189
   chapters, 31,102 verses_, or _It has the New Testament only_. Nothing is installed
   yet.
5. **Step 1 — a short name**: press a suggestion (**KSV**, **KM1954** …) or type your
   own, letters and numbers with no spaces. A name you already have is refused and
   asked again.
6. **Step 2 — the language**: it says which it looks like and why (_the verses are
   written in Khmer script_). Press it, or type another.
7. **Step 3 — numbers**: **០ ១ ២ ៣ …** or **0 1 2 3 …** (skipped for a language that
   writes 0–9).
8. **Step 4 — book names**: each list shows its first names, the names only it has,
   and how many of its names appear in this Bible's own verses; the suggested one
   uses the most. **Find more lists online** adds lists from Bible.com and
   Wordproject. 📸
9. **Ready to install** sums it up. Press **Install it**. _Done — KSV is installed_:
   choose it from the Bible version button. **Undo** under that answer moves it to
   the trash again. **Cancel** at any step stops with nothing installed.

Pasting a link works the same way, and the link does not have to be the file: a
GitHub **page** of the file is turned into its download address, and a GitHub
**repository** lists its Bible files — type a word (`Khmer`, then `2019`) to narrow
the list.

**Import a Bible XML file with the form**

1. Open **[en:tran:Settings]** → **[en:tran:Bible]**. In
   **[en:tran:Import XML File]**, paste the link into **[en:tran:URL:]**.
2. Press **[en:tran:Import]**. The download is read and its temporary file removed.
   **[en:tran:Review Bible import]** appears with the translation title. Nothing has
   been installed yet. 📸
3. Choose an unused **[en:tran:Bible key]**. Buttons suggest a language code, a code
   with the year, and usable words from the file header; you can type your own key.
   This becomes the badge and file name. Empty, unsafe or already installed keys
   cannot be imported, and the key is checked again when saving.
4. Review **[en:tran:Locale]**. A locale stored in the XML is kept; otherwise the
   filename provides a hint. `KhmerBible.xml` suggests `km-KH`. You can correct it.
5. Choose **[en:tran:Number mapping]**. Khmer offers `០ ១ ២ ៣ ៤ ៥ ៦ ៧ ៨ ៩` first
   and `0 1 2 3 4 5 6 7 8 9` as an alternative.
6. Choose **[en:tran:Book name mapping]**. Built-in Khmer naming sets appear first;
   online lookup adds complete lists from Bible.com and Wordproject. Each option
   shows its edition/source, and **[en:tran:Preview book names]** expands all 66 names.
   **[en:tran:Keep existing book names]** preserves the names already in the XML.
   The recommended option is a suggestion: select the wording your church uses.
   **[en:tran:Find more editions]** checks another batch when available;
   **[en:tran:Search for more book name lists]** opens a wider web search.
   If online sources fail, you can still choose built-in names or keep the existing map.
7. Press **[en:tran:Import]** in the review. The new translation appears in
   **[en:tran:Bibles XML]**. **[en:tran:Cancel]** exits the review without saving. 📸

Later changes remain available through the translation's pencil → **Info** editor:
**🌎 Choose Locale**, then **#️⃣ Edit Numbers Map**, then **📚 Edit Books Map**.
Those editor actions use the locale currently in the editor buffer; save after editing.

**Key is already taken**

If it says the Bible key is already taken, choose a different unused key in the review.
The installed translation is kept. Import does not replace it, even if another window
installed that key while you were choosing mappings. Cancel if you meant to edit the
existing Bible, then use its pencil instead.

> **Removing one.** The 🗑 next to a translation asks _Are you sure to delete bible XML
> "…"?_ — **Yes** sends the file to the Recycle Bin. Its badge disappears from every bible
> menu. The sibling `…​.xml.cache` folder is removed too, so stale parsed data cannot
> reappear if the same key is imported later.

> **Putting the KJV back.** The **KJV** row — and only that row — carries an extra
> orange ↺ button, **[en:tran:Reset Bible XML]**, to the LEFT of the ✏️ pencil.
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
> **[en:tran:Create KJV Bible XML]** row sits at the TOP
> of the **Bibles XML** list, above the translations — not only on a brand-new install
> with nothing in the list. Click it and the KJV comes back; the button then disappears
> because there is nothing left to create.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`ST-41` · `ST-42` · `ST-43` · `ST-44` · `ST-45` · `ST-46` · `ST-47` · `ST-48` · `ST-49` · `ST-50` · `ST-24` · `ST-25` · `ST-26` · `ST-29` · `ST-31` · `ST-32` · `ST-51` · `ST-60` · `RD-11` · `CB-80` · `CB-81` · `CB-82` · `LT-01`

Regenerated from `user-workflows.md` (workflowsVersion 2026-10-07).
:::
