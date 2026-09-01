---
id: W-27
title: "Pin the document you are presenting from"
section: "Configuration"
verify: [PM-121, PM-122, PM-123, PL-01]
screenshots: 3
generatedFrom: user-workflows.md
workflowsVersion: "2026-08-31"
---
# W-27 — Pin the document you are presenting from

**Goal:** stop a stray click in the Documents list from swapping the document you are
half-way through.

**Preconditions:** a document selected in the middle **Documents** tab.

1. Look at the middle **Documents** (ឯកសារ) tab heading. With a document selected, a
   faint **pin** sits just after the word — nothing selected, no pin. 📸
2. Click the pin. It fills in and turns amber: the document is now **pinned**. Hovering it
   reads **Unpin document** (ដោះខ្ទាស់ឯកសារ). 📸
3. Click a different document in the left list. **Nothing changes** — the previewer keeps
   your document. A message says **Document is pinned** / _Unpin the document to preview
   another one_ (ឯកសារត្រូវបានខ្ទាស់), and the pin flashes so you can see what stopped
   it. 📸
4. The same protection covers every way of swapping the document: a song row, a document
   inside a **presenting flow**, and clicking the file name in the previewer's own footer (which
   normally opens a list of the other documents in the folder — while pinned it does not
   even open).
5. Click the pin again to unpin. The clicks from step 3 now work normally.

Tips:

- The pin stays on when you **restart the app** — it is remembered with the selection.
- **Renaming** the pinned document is not a swap: the previewer follows the new name and
  stays pinned.
- **Trashing** the pinned document unpins automatically and the pin disappears, since
  there is nothing left to hold on to.
- Clicking the pinned document's own row again is silent — that is not a swap either.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`PM-121` · `PM-122` · `PM-123` · `PL-01`

Regenerated from `user-workflows.md` (workflowsVersion 2026-08-31).
:::
