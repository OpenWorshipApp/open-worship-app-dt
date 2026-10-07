---
name: bible-xml-import-from-url
description: "Bibles install IN the chat by buttons (link, GitHub page/repo, or a language from Beblia); owa_bible_xml downloads in the server, the app reads drafts from temp; Settings form still exists"
metadata:
  node_type: memory
  type: project
---

Updated 2026-10-06 (twice); W-34, ST-60, CB-80..CB-82. The user asked for the
assistant to download → read → suggest keys, locale, digits and book names for
the person to PICK → install, and to edit and delete, "for old and
non-technical users". It now runs in the chat with NO model: a link, a
language (`Import bible for khmer` searches github.com/Beblia/Holy-Bible-XML-Format,
the catalog the user chose), or Settings → Bible's
[en:tran:Let the assistant import a Bible for me]. Live: the Khmer sample is
66 books / 31,102 verses in ~4 s; Khmer2019Bible.xml is New Testament only.

Non-obvious, learned live:
- Book-name editions differ; the list whose names the VERSES use is the
  match. The 1954 text scored 44 on the traditional list, 22 on the modern
  one (កំណើតពិភពលោក), so the modern list must not be the default.
- A file name is not a title: Khmer2019Bible.xml says "Khmer 2023
  (ព្រះគម្ពីរខ្មែរសាកល)". Titles come from a 2 KB ranged read.
- Two lists can open with the same four names; show the names only each has.
- Typing a KEY must not swallow a new request: a link/language ask is read
  before a typed reply.
- Driving the chat over CDP from Git Bash: heredoc and `node -e` strings lose
  backslashes; edit files with the Edit tool, not scripted replaces.

Unchanged: the Settings form (`BibleXMLImportComp`) still downloads in the
renderer and reviews inline; the Info editor still edits locale/numbers/books;
`bibles-data` follows `appLocalStorage.defaultStorage`. Verify the file on disk,
not a toast. Removing a Bible clears its sibling XML cache, and an agent undo
of a Bible file does too (`bibleKey` on the restore).
