---
id: W-34
title: "Add a Bible translation from the internet (XML), and make it read in its own language"
section: "Keyboard shortcut reference (tutorial appendix)"
verify: [ST-41, ST-42, ST-43, ST-44, ST-45, ST-46, ST-47, ST-48, ST-49, ST-50, ST-24, ST-25, ST-26, ST-29, ST-31, ST-32, ST-51, ST-60, RD-11, RD-123, CB-80, CB-81, CB-82, CB-107, CB-108, CB-109, LT-01]
screenshots: 7
generatedFrom: user-workflows.md
workflowsVersion: "2026-10-13"
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
   `Import bible for khmer`, `Import bible`, or `Import bible from` and a link. Say it
   your own way: `I want a Khmer bible`, `Do you have a Korean bible?` and a country —
   `Import a Bible in Cambodia` — are understood too. And when you ask **how** to
   import a Bible, the answer has an **Import a Bible for me** button that starts
   here.) Answer the _Be careful with AI_ question with **[en:tran:Open]**. 📸
2. The assistant opens in a new tab and asks **Which language do you want the Bible
   in?** Press **Khmer**, **English** or **French**, or type the language — in English
   or in its own words (`Thai`, `ខ្មែរ`, `Español`) — or paste a link to a Bible file.
   **A file on this computer** opens the form below instead. A word it cannot find
   (`kmer`) is answered with **Did you mean** and the nearest languages to press.
3. It lists **every** Bible in that language from a free collection of about a
   thousand (Beblia, on GitHub), each with the title its own file gives — for Khmer,
   seven, from _Khmer Standard Version 1954 = Hammond Version_ to _Khmer BFBS (ព្រះគម្ពីរបរិសុទ្ធ ១៩៥៤)_. One you have installed is marked **you already have this
   one**, with its short name. Press the one you want, or type its number. 📸
4. It downloads and reads it, then says what it is — for example _66 books, 1,189
   chapters, 31,102 verses_, or _It has the New Testament only_ — and, when it is one
   you have, **You already have this Bible** with the name it is installed under
   (press **Cancel**, or go on to keep a second copy under another name). Nothing is
   installed yet.
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

You can type instead of pressing at every step: `yes` (or `ok`) takes the suggested
choice — and at the end, **Install it** — a number takes that line of a list (`2`,
`list 2`), the words on a button press it, and `cancel` stops.

Pasting a link works the same way, and the link does not have to be the file: a
GitHub **page** of the file is turned into its download address, and a GitHub
**repository** lists its Bible files — type a word (`Khmer`, then `2019`) to narrow
the list. Under the language question, and under an answer that says a link did not
lead to a Bible, the link can be pasted on its own.

**When a window says a Bible is not available**

The Bible Reader or the Bible Lookup opens on _Bible key "KJV" is not available!_ when
it is set to a Bible this computer does not have — on a new computer, the KJV. The card
says how the assistant gets it, in three steps, and carries the button:

1. Press **[en:tran:Let the assistant import this Bible for me]** on that card and
   answer the _Be careful with AI_ question with **[en:tran:Open]**. 📸
2. The assistant opens in a new tab already looking for that Bible in the free
   collection: for KJV it lists _English KJV_ and _English NKJ 1982_. Press the one you
   want. A name the collection has no file for is answered with _None of them has … in
   its name_: type the Bible's language (`Khmer`) and press one from that list.
3. It downloads the Bible and says _The app is looking for a Bible called **KJV**_. At
   **Step 1 — a short name** that name comes first, **KJV (suggested)**: keep it.
   Installed under any other name, the card stays where it is.
4. Answer the language and the book names as above, then press **Install it**. _Done
   — KJV is installed_, and the card goes away by itself: the passage shows. 📸

Typing `Import the Bible called "KJV"` in the assistant does the same.

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

A Bible already installed whose book names or numbers still read in English needs no
second import. Later changes remain available through the translation's pencil → **[en:tran:Info]** editor:
**🌎 [en:tran:Choose Locale]**, then **#️⃣ [en:tran:Edit Numbers Map]**, then **📚 [en:tran:Edit Books Map]**.
Those editor actions use the locale currently in the editor buffer; save after editing.

**[en:tran:Key is already taken]**

If it says the Bible key is already taken, choose a different unused key in the review.
The installed translation is kept. Import does not replace it, even if another window
installed that key while you were choosing mappings. Cancel if you meant to edit the
existing Bible, then use its pencil instead.

> **Removing one.** The 🗑 next to a translation asks _Are you sure to delete bible XML
> "…"?_ — **[en:tran:Yes]** sends the file to the Recycle Bin. Its badge disappears from every bible
> menu. The sibling `…​.xml.cache` folder is removed too, so stale parsed data cannot
> reappear if the same key is imported later.

> **Putting the KJV back.** The **KJV** row — and only that row — carries an extra
> orange ↺ button, **[en:tran:Reset Bible XML]**, to the LEFT of the ✏️ pencil.
> It asks _Reset this bible XML with the app embedded KJV? All your changes will be
> lost._ — **[en:tran:Yes]** throws away the KJV file you have and writes the copy that ships inside
> the app (the same copy the **[en:tran:Create KJV Bible XML]** row below writes),
> then reloads the windows. Use it when your KJV has been edited into a state you no longer
> want, or looks broken; there is no undo, so export it first (W-33) if you want it back.
> If the KJV editor is open with unsaved changes the button refuses and warns
> **[en:tran:Unsaved Bible Data]** — save or discard first.
>
> **Deleted it by mistake?** The KJV is the one translation the app carries inside
> itself, so it can always be rebuilt. Whenever your list has no **KJV**, a green
> **[en:tran:Create KJV Bible XML]** row sits at the TOP
> of the **[en:tran:Bibles XML]** list, above the translations — not only on a brand-new install
> with nothing in the list. Click it and the KJV comes back; the button then disappears
> because there is nothing left to create.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`ST-41` · `ST-42` · `ST-43` · `ST-44` · `ST-45` · `ST-46` · `ST-47` · `ST-48` · `ST-49` · `ST-50` · `ST-24` · `ST-25` · `ST-26` · `ST-29` · `ST-31` · `ST-32` · `ST-51` · `ST-60` · `RD-11` · `RD-123` · `CB-80` · `CB-81` · `CB-82` · `CB-107` · `CB-108` · `CB-109` · `LT-01`

Regenerated from `user-workflows.md` (workflowsVersion 2026-10-13).
:::
