---
name: bible-xml-import-from-url
description: "Bibles install IN the chat by buttons (link, GitHub page/repo, or a language from Beblia); owa_bible_xml downloads in the server, the app reads drafts from temp; a local model has no owa_bible_xml, so the no-model reader is the whole feature there"
metadata:
  node_type: memory
  type: project
  originSessionId: 53c6c8a1-b577-4c3d-99d2-d0efc98a350a
  modified: 2026-10-13T21:14:28.606Z
---

Updated 2026-10-06 (twice) and 2026-10-10; W-34, ST-60, CB-80..CB-82,
CB-107..CB-109. The user asked for the assistant to download → read → suggest
keys, locale, digits and book names for the person to PICK → install, and to
edit and delete, "for old and non-technical users". It now runs in the chat
with NO model: a link, a language (`Import bible for khmer` searches
github.com/Beblia/Holy-Bible-XML-Format, the catalog the user chose), or
Settings → Bible's [en:tran:Let the assistant import a Bible for me]. Live: the
Khmer sample is 66 books / 31,102 verses in ~4 s; Khmer2019Bible.xml is New
Testament only.

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

**2026-10-10 — the user: "importing bible data is the most important thing
right now … make this prompt and mcp tool and action working smoothly"**
(a picture of the suggestion list's three Bible rows circled, on a shared LM
Studio server). What that run found, each measured in the live window first:
- **A custom (local) server's model cannot import at all**: the lean tool
  list (`LOCAL_TOOL_NAME_LIST`) has no `owa_bible_xml`. Whatever wording the
  no-model reader misses is, for those users, a Bible that does not get
  installed. Widen the reader before touching the prompt.
- **People name a language by its country.** A country that happens to start
  like its language (`korea` → `Korean…`) worked by luck; `Cambodia`, `China`,
  `France`, `Laos`, `Germany`, `Myanmar` found nothing. The catalog has NO
  Vietnamese and NO Urdu, and spells `Tibetian`, `Galacian`, `Moldovian`.
- **`bible` + a loose verb is not an import.** `add bible verse John 3:16 to
  my bible list` searched the collection for "verse john 16 list" and offered
  the Chewa, Polish and Turkmen Bibles of 2016. `add/get/want/need` count only
  beside a language; a verse, list, note, screen or `3:16` never does.
- **Somebody who types, types what the answer says**: `2`, `yes`, `cancel`.
  `yes` at step 1 used to name the Bible "yes".
- **Every look at the catalog is 0.9 MB and one of sixty unsigned GitHub API
  reads an hour** per network; out of reads it answers 403, which read as
  "may need a sign-in". The listing is kept ten minutes now.
- **Titles are the only identity before a download**, so "you already have
  this one" matches on title: Khmer2019Bible.xml retitled itself 2019 → 2023
  upstream and is honestly NOT claimed against an installed 2019 copy.
- The dev app runs under `electron:dev`: every save in `tools/owa-devtools-mcp`
  relaunched it and closed the 🤖 window (its tabs come back); my interpretation
  — batch those saves, then reopen the window once.

**2026-10-13 — a missing Bible's own card is a fourth way in** (the user,
with a picture of the Reader on _Bible key "KJV" is not available!_: _should
have instruction for user to import in chatbot and should have button to open
chatbot to import the bible like kjv_; W-34's last section, RD-123, rule
`chatbot-window.md`). The card carries
[en:tran:Let the assistant import this Bible for me] and leaves the sentence
`Import the Bible called "KJV"`; the name rides the import as `wantedKey` and
is the first short name offered. Non-obvious, learned live:
- **The name is the point, not the Bible.** Installed as `EK` (the file's own
  first suggestion) the card would have stayed on _"KJV" is not available!_
  with the Bible on the disk.
- **A button whose text is more than its name is found and not pressed**:
  drawn `… for me (KJV)`, `owa_find_ui` matched it and `owa_click` would
  refuse (`isPressSafe` wants a label part equal to the words).
- **A Reader the chat window covers hands `owa_screenshot` its last frame**:
  the picture still showed the card after **Install it** while the DOM read
  `(KJV) Genesis 1:1`. Read the DOM ([[scratch-dev-instance-beside-user-app]]).
- The collection DOES file an English NIV (`Import the Bible called "NIV"`
  found one); a name it has nothing for needed something like `KHOV`.

Unchanged: the Settings form (`BibleXMLImportComp`) still downloads in the
renderer and reviews inline; the Info editor still edits locale/numbers/books;
`bibles-data` follows `appLocalStorage.defaultStorageDirPath`. Verify the file on disk,
not a toast. Removing a Bible clears its sibling XML cache, and an agent undo
of a Bible file does too (`bibleKey` on the restore).
