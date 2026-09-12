---
name: bible-xml-cache-key-scoped
description: "The bible-XML parse cache is named after the KEY, not the file — every writer must call clearBibleXMLCache (memory + folder), or a re-imported key serves the OLD bible for a week"
metadata:
  node_type: memory
  type: project
  modified: 2026-08-30T00:00:00.000Z
---

From `3a97acc4` ("enhanced cached clearing", 2026-08-22) and `76219b07`
("enhanced bible KJV").

**The cache folder is keyed by the bible KEY, not the file.** A bible stored
as `my-kjv.xml` caches under `KJV.xml.cache` (`getBibleXMLCachedBasePath` in
`src/setting/bible-setting/bibleXMLHelpers.ts`). Consequence before the fix:
delete a bible, import a DIFFERENT bible under the same key → the parsed data
of the old one kept being served.

**The rule: any writer of a bible XML must call `clearBibleXMLCache(key)`.**
It drops BOTH the in-memory `bibleJSONCacheManager` entry AND deletes the
whole `<KEY>.xml.cache` folder (leaving it deleted — the old
`invalidateBibleXMLCachedFolder` delete+recreate is gone). The in-memory drop
is NOT optional: leaving it would write the same stale JSON straight back into
a fresh `all` blob "that then stands for a week". Five call sites: delete
(`deleteBibleXML`, which also fixed Move-to-Trash leaving the cache behind),
import (`bibleXMLArchiveHelpers.ts`), first-run KJV creation
(`BibleDataReader.ts`), reset-to-embedded, and key RENAME —
`updateBibleXMLInfo` must clear the NEW key too, because
`saveJsonDataToXMLfile` only clears the old one. Reads use the non-creating
`getBibleXMLCachedBasePath` ("a read has no business creating the folder").

**Embedded KJV helpers** (`src/helper/bible-helpers/kjvBibleXMLTextHelpers.ts`):
`genEmbeddedKJVBibleXMLText()` is `import()`ed inside the function because the
embedded KJV is ~5 MB of JSON that must never sit in a load-time chunk.
`resetBibleXMLToEmbeddedKJV(filePath)` takes the row's **`filePath`, not the
key** — resolving the key would write to `<dir>/KJV.xml` and leave two files
claiming one key — and shares `initKJVBible`'s `unlocking('init-kjv-xml-file')`
lock. Regression pin: `bibleXMLHelpers.test.tsx` ("delete clears the cache",
~:447-454). Related: [[bible-xml-import-from-url]],
[[bible-xml-archive-owabdata]], [[filesource-cache-sliding-ttl]].
