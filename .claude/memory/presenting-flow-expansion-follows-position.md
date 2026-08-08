---
name: presenting-flow-expansion-follows-position
description: "OPEN — index-based React keys make a run sheet's expand/collapse state stay with the row POSITION across a reorder, not with the document (PL-53)"
metadata: 
  node_type: memory
  type: project
  originSessionId: ad24e654-a898-4f16-b4af-46c19ebd979b
  modified: 2026-08-08T15:22:19.805Z
---

Verified live 2026-08-08 (run `20260808-1020`). PL-53 says the expansion state must follow
the DOCUMENT across a reorder. It does not.

The setting *name* is per-document and correct —
`presenting-flow-item-expanded-<presentingFlow>-<document>` via `useStateSettingBoolean`
([src/presenting-flow/PresentingFlowItemComp.tsx](../../src/presenting-flow/PresentingFlowItemComp.tsx):48).
But `PresentingFlowItemsComp` keys its children `` `${presentingFlowItem.type}-${i}` `` —
**index-based**
([src/presenting-flow/PresentingFlowFileComp.tsx](../../src/presenting-flow/PresentingFlowFileComp.tsx):77).
A reorder keeps the same React instance in a slot while the document under it changes, and
`useStateSettingBoolean` only reads its setting on first mount, so the open/closed state stays
with the slot.

Repro (both directions): `zz-robot-doc` collapsed at position 0, `a2` expanded at position 1 →
**Move to Top** on `a2` → `a2` renders collapsed at 0 and `zz-robot-doc` renders expanded at 1,
showing its own slides. Both settings on disk read `true` at that moment, so the render and the
persisted truth had diverged.

**Why:** it is not only cosmetic — the next manual toggle writes the flag under the *other*
document's key, so the wrong state persists into the following session.

**How to apply:** key the child by the item's `uuid` (every entry already has one) instead of
`type-index`. That also stops unrelated per-row state being reused across a reorder. Note the
documented, deliberate trade-off nearby: two entries of the *same* document legitimately share
one key and expand together — do not "fix" that.
