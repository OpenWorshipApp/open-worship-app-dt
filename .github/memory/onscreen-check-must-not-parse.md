---
name: onscreen-check-must-not-parse
description: "checkIsVaryAppDocumentOnScreen runs per list row per screen event — it must match on filePath only, never call getSlides()"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: da5728a5-2e42-4a20-8512-65b8dc76a945
  modified: 2026-08-03T13:28:26.802Z
---

`checkIsVaryAppDocumentOnScreen` (`src/app-document-list/appDocumentHelpers.tsx`)
feeds the on-screen dot of **every row of every document/lyric list**, via
`FileItemHandlerComp` → `useFileSourceIsOnScreen`, which re-runs on **every
screen update** (debounced 500 ms per instance).

It used to call `varyAppDocument.getSlides()` and compare each slide id. That
made one screen change cost a **full document parse per visible row**: for a
lyric, re-reading the file plus every language module; for a PDF/PPTX, re-reading
the rendered slides. Now it matches on `filePath` alone —
`ScreenVaryAppDocumentManager.getDataList(filePath)` — because the persisted
on-screen entries already carry `filePath`.

**Why:** the app targets very low-spec church machines, where per-row document
parsing on every present/clear is exactly the kind of cost that is invisible on a
dev machine. Behaviour is unchanged in practice — slide ids are contiguous and an
on-screen entry for a file means that file is on a screen.

**How to apply:** keep any "is X on screen" predicate O(1) over the persisted
settings map. If you need slide-level granularity use
`checkIsVarySlideOnScreen(slide)`, which is already synchronous and id-based.
Note `getDataList(filePath, id?)` treats an omitted `id` as "no id filter" — test
mocks must model that or they silently fail the document-level check.

Related: [[lyric-subsystem-architecture]].
