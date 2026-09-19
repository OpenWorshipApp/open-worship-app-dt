---
name: history-read-cache-stale-paths
description: "FileSource's 2 s read cache is keyed by path and was not cleared when the editing history renamed files onto reused paths; forgetCachedData fixes it"
metadata: 
  node_type: memory
  type: project
  originSessionId: c95a672a-48b7-47e0-a94d-10946a3ee48d
  modified: 2026-09-14T17:32:20.989Z
---

`FileSource.readFileData` caches a file's text for 2 seconds by PATH. The
editing history (`EditingHistoryManager`'s `FileLineHandler`) changes paths
without `writeFileData`: `N` becomes `N-head` by a rename, `0-head` is a copy,
and a cleared history reuses `0-head` / `1-head` on the next edit.

Found 2026-09-14 when `owa_undo` put back a deleted slide document: the history
was rebuilt in under a second, `1-head` held the right 3-slide state on disk,
and the read returned the 2-slide state cached from moments before. Worse,
`changeCurrent` built its diff patch FROM that stale read, which would have
broken the document's Ctrl+Z chain. Ordinary editing can hit it too: undo then
edit within two seconds reuses an index.

**Why:** a path-keyed cache is only safe if every way a path's bytes change
invalidates it.

**How to apply:**

- `FileSource.forgetCachedData(path)` and `forgetCachedDataUnder(dir)` exist
  for this. The history calls them after every move, clone, file delete and
  folder clear; new code that renames, copies or deletes onto a path someone
  reads through `FileSource.readFileData` must do the same.
- `AppEditableDocumentSourceAbs.preDelete` now AWAITS the history discard; it
  used to fire and forget it.
- Guarded by `EditingHistoryManager.test.ts` (forgets every path it moves) and
  `FileSource.test.ts` (stale until forgotten; a same-prefix sibling folder
  untouched).

Related: [[filesource-cache-sliding-ttl]], [[presenting-flow-reads-editing-history-head]], [[agent-data-tools-backup-undo]].
