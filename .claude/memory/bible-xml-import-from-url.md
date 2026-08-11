---
name: bible-xml-import-from-url
description: "Importing a bible XML from a link: the key comes from a guessing dialog built out of the file's own attributes, and a raw import always lands on English until three Info-editor actions are run in order"
metadata:
  node_type: memory
  type: project
---

Added 2026-08-10. Driven live end to end on
`https://github.com/Beblia/Holy-Bible-XML-Format/raw/refs/heads/master/KhmerBFBSBible.xml`
— the file the user's `ពគប` came from. W-34; matrix ST-41..ST-50; knowledge-base §15.
Sibling of [[bible-xml-archive-owabdata]], which moves bibles you already have.

**Where the badge comes from.** Published XMLs rarely carry `key`/`abbr`, so
`guessingBibleKey` loops a "Key is missing" `showAppInput`. Its **Guessing keys** buttons
are `getGuessingBibleKeys`: every attribute value **on the root element**, split on
`[.,\s]`, deduped, **minus every installed key**. The Beblia files carry
`link="https://www.bible.com/bible/1270/GEN.23.ពគប"`, so that split hands the operator
`ពគប` as a one-click button — that is literally the origin of the key, not something typed.
The taken-key filter means re-importing the same file on a machine that already has `ពគប`
shows the other 15 guesses and not that one; the absence is correct.

**The key is also the file name** (`<key>.xml`). Renaming `key` later in the Info editor
does NOT rename the file — `updateBibleXMLInfo` saves through `oldBibleInfo.key` — so badge
and file name diverge silently. Settle it at import time.

**A raw import is never finished for a non-English bible.** Aliases resolve
(`translation`/`name` → `title`, `status` → `legalNote`), but every omitted field takes an
English default: `locale="en-US"`, ASCII `number-map`, English `book-map`. The bible loads,
just filed under **English** in the reader's locale-grouped key menu, rendering
`(ពគប) Acts 28:15`. Fixed by three right-click Monaco actions on the **Info** tab
(`addMonacoBibleInfoActions`), and **the order is load-bearing** — 🌎 Choose Locale, then
#️⃣ Edit Numbers Map (its "Use ១ ២ ៣" button), then 📚 Edit Books Map (its "📖 Guessing
Names" sets, from `src/lang/data/<lang>/bibleBooks.json`, keyed by bible key). The last two
read `info.locale` **out of the editor buffer**, so out of order they quietly offer English.
Save then fires `forceReloadAppWindows()`; the proof is the reader's key menu re-grouping.

Traps that cost time here:

- **`bibles-data` is NOT under the `-dev` folder.** It hangs off
  `appLocalStorage.defaultStorage`; on 2026-08-10 the dev app wrote to
  `Desktop\open-worship-data\bibles-data` while its Bible-Reader dir was `…-dev\bibles-read`.
  [[dev-data-dir-is-separate]] holds for path-settings folders, not for app-managed ones.
- **`saveJsonDataToXMLfile` returns `true` without checking the write** (it awaits
  `saveXMLText` and discards the boolean), so a success toast is not evidence of a file.
- **A synthetic `contextmenu` never opens Monaco's menu** (tried on every node from
  `.monaco-editor` down to `.view-line`). Drive the actions with `.native-edit-context`
  `.focus()` + `F1`, and **match the palette row by label** — it re-sorts the last-used
  command to the top, so a fixed arrow count runs the wrong one. Setting `.value` on the
  palette input empties the list instead of filtering it.
- **Move to Trash leaves `<key>.xml.cache`** (13 MB for this file) beside the deleted XML;
  scratch-bible runs must sweep it, like the media block's MD-04.
