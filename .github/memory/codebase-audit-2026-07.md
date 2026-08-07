---
name: codebase-audit-2026-07
description: Full-codebase audit (2026-07-21) — fixes applied 2026-07-22 (uncommitted that day); short list of deliberately deferred items
metadata: 
  node_type: memory
  type: project
  originSessionId: 918508de-c212-454e-ab27-f1c422e28641
  modified: 2026-07-22T13:37:39.084Z
---

Five-agent audit (2026-07-21) followed by a fix-everything pass (2026-07-22, left uncommitted — check git log). All high/medium items were fixed: theme sync-IPC per render (module cache + lazy useState), shadow-root/Monaco disposal (`disconnectedCallback` + editor dispose with StrictMode-safe deferred cleanup), `.bg.json` no longer created on read, `onAsync` always replies (renderer rejects on Error reply — `electronSendAsync` already handled it), FileSource read/write share the `rw-` lock with in-lock cache invalidation, ghost screen managers replaced by inert `ScreenManagerBaseGhost` (`ScreenManagerBase(screenId, isInert)`), pointercancel + listener release in ScreenDrawManager, IndexedDB opens version-less (never wipes; bumps only for missing store), `CacheManager.has()` expiry-aware + lazy cleanup interval, per-instance debounces (editingHelpers, Foreground Camera/Time/Web, bibleNoteHelpers, EditingHistoryManager cleanup), DirSource promise-cached init + resolved-path instance lookup, `useKeyboardRegistering` pins its layer at mount (optional explicit `layer` param — the context-menu host passes `'context-menu'`; it's the ONLY runtime layer-changer), full-view Escape listeners tracked per element in a WeakMap, `owa://access` gated on `owa://local` referrer + dist containment (URL parser normalizes `../` and `%2e%2e`; the live traversal vector is encoded backslashes on Windows), `sendScreenMessage` now async `sendData`, Clear All includes draw/focus (useScreenUpdateEvents also subscribes draw/focus), naming violations renamed to `*Comp`.

**Deliberately deferred (still open):**
- `nodeIntegration: true` / `contextIsolation: false` / `webSecurity: false` in `genWebPreferences` (pre-existing TODO; large migration).
- `main:app:trash-path` / `reveal-path` accept arbitrary paths (containment would break user-chosen dirs).
- Dir-refresh color notes still read/parse every app file (M3); only the `.histories`-missing fast path was added for editing status.
- Legacy fixed-IV CBC decrypt path in `electron/client/cryptoUtils.ts` (decrypt-only; don't reuse for encrypt).
- `_owa-crypto` is an identity-function stub with placeholder API key — confirm release build substitutes the real module.
- Minor `ref.current`-in-deps sites (ShadowingFillParentWidthComp, AppRangeComp, ScreenBackgroundComp, ScreenBibleComp) and `MiniScreenBodyComp` render-phase mutations.
- File renames skipped to limit churn: `ShowHideScreen.tsx`, `ShowingScreenIcon.tsx`, `ColorPicker.tsx` (functions renamed to `*Comp`, files kept).

Related: [[eventhandler-sync-dispatch]] (CLAUDE.md event section was corrected in the same pass), [[screen-draw-feature]].
