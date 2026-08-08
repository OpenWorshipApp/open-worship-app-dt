---
name: presenting-flow-expansion-follows-position
description: "FIXED 2026-08-08 — index-based React keys used to make a run sheet's expand/collapse state stay with the row POSITION across a reorder (PL-53); rows are keyed by uuid now"
metadata: 
  node_type: memory
  type: project
  originSessionId: ad24e654-a898-4f16-b4af-46c19ebd979b
  modified: 2026-08-08T15:22:19.805Z
---

Found and **FIXED** on 2026-08-08 (run `20260808-1020`). PL-53 says the expansion state must
follow the DOCUMENT across a reorder. It did not.

The setting *name* is per-document and correct —
`presenting-flow-item-expanded-<presentingFlow>-<document>` via `useStateSettingBoolean`
([src/presenting-flow/PresentingFlowItemComp.tsx](../../src/presenting-flow/PresentingFlowItemComp.tsx):48).
But `PresentingFlowItemsComp` KEYED its children `` `${presentingFlowItem.type}-${i}` `` —
**index-based**
([src/presenting-flow/PresentingFlowFileComp.tsx](../../src/presenting-flow/PresentingFlowFileComp.tsx):77).
A reorder kept the same React instance in a slot while the document under it changed, and
`useStateSettingBoolean` only reads its setting on first mount, so the open/closed state stayed
with the slot.

Repro (both directions): `zz-robot-doc` collapsed at position 0, `a2` expanded at position 1 →
**Move to Top** on `a2` → `a2` renders collapsed at 0 and `zz-robot-doc` renders expanded at 1,
showing its own slides. Both settings on disk read `true` at that moment, so the render and the
persisted truth had diverged.

**Why:** it is not only cosmetic — the next manual toggle writes the flag under the *other*
document's key, so the wrong state persists into the following session.

**The fix:** the child is keyed by the entry's own `uuid`, with `type-index` kept only as the
fallback for a damaged entry whose file carried no valid id — and `fromJsonError` now carries a
valid uuid through, so even most error rows key stably. Verified live: expanding one document
and moving the OTHER to the bottom left both rows exactly as they were.

**How to apply:** never key these rows by position again — the same trap waits for any new
mount-time read added to the row. Note the documented, deliberate trade-off nearby: two entries
of the *same* document legitimately share one SETTING and expand together — do not "fix" that.
