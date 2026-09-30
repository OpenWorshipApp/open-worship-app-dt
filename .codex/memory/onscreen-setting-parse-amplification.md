---
name: onscreen-setting-parse-amplification
description: On-screen settings readers are memoized on their raw setting strings; the getters MUST keep returning a copy or the persist paths corrupt the cache
metadata:
  type: project
---

Measured live 2026-08-04 (branch refactor23). The four "what is on screen"
readers each did `getSetting` + `JSON.parse` + validate of the WHOLE map, plus a
second hidden parse via `getValidOnScreen` → `getScreenManagersInstanceSetting`.
`toClassNameHighlight` reached them ~4× per slide preview per render pass, and a
presented lyric slide makes the blob 185 KB (open-lyric writes a full
computed-style dump: 8 `style=` attributes of ~698 declarations, 99.3% of the
slide HTML). One click = 5,103 parses over **264 MB**, 271 ms.

**FIXED** by `genDerivedSettingReader` (`src/helper/derivedSettingHelpers.ts`):
memoized on the RAW SETTING STRINGS, so invalidation is exact and can never be
staler than `getSetting`. Result: 97.6 MB → 0.41 MB per click.

Load-bearing invariants — breaking any of these is silent data loss:

- **Every getter MUST return a copy** (`{ ...read…() }`, `.slice()`). All four
  persist paths read the map, add/delete their OWN screen key and write the
  whole thing back; handing out the memoized object makes one present wipe the
  other screen's entry.
- **`settingNames` must list EVERY setting the derivation reads.** The maps are
  filtered against `MANAGERS`, so adding/deleting a screen must invalidate them
  even though their own string never changed.
- **Nothing may write through a nested value.** Three sites did and were fixed:
  `parseAllForegroundData` (rewrote `dateTime` in place), `applyVarySlideData`
  (rewrote `itemJson` on its argument), and `ScreenBibleManager._setMetadata`
  (wrote `scroll` into `_screenViewData`, which is seeded from the getter — on
  every scroll frame). The last one also now debounces its persist with a
  per-instance `genTimeoutAttempt(500)`.
- **No TTL-only cache is acceptable.** The test that pinned this
  (`preview.runtime.test.tsx`, four synchronous reads with four different
  payloads in one test body) was deleted 2026-08-24 — the invariant now rests
  on `src/helper/derivedSettingHelpers.test.ts` and the global `beforeEach` in
  `src/test-setup/localStoragePolyfill.ts` alone. Re-add a payload-switching
  test before touching the memoization.

`releaseAllDerivedSettings()` (`derivedSettingRegistry.ts`, import-free on
purpose) runs in the global test `beforeEach`, so a test reusing a setting
string while expecting a different parse is not served a stale entry.

## Phase 2 (2026-08-04): the RE-RENDER amplification, also fixed

Cheap reads were not enough — the previews still re-rendered wholesale. One
click cost **97 React commits and 184 shadow-root `root.render()` calls** with
an 89-slide document open, identical for a presenting flow click and for the
previewer's own card. Two causes, both now fixed by
`src/_screen/managers/varySlideOnScreenHelpers.ts`:

- **Five of the six `useScreenVaryAppDocumentManagerEvents(['update'])` calls
  read nothing** that a screen change can alter (`SlideRenderComp`,
  `Pdf/Pptx/DocxSlideRenderComp`, and `VaryAppDocumentScaleContainerComp` —
  which is instantiated TWICE per preview). Deleted.
- **`useScreenEvents` always calls `setN(Date.now())`**, so ANY component using
  it re-renders on every screen event whatever its callback decides. On
  `VarySlidesComp` (via `useAnyItemSelected`) that re-rendered the whole slide
  list, handing every preview a fresh `children` element —
  `ShadowingFillParentWidthComp`'s `useAppEffect(..., [myRef, children])` then
  re-rendered all 89 inner roots. Use `useVarySlideOnScreenChangeEffect` for
  callback-only subscriptions.

`useVarySlideOnScreenList` MUST return the previous array instance when the
screen-id set is unchanged — `useSyncExternalStore` compares by identity, and a
fresh-but-equal array re-renders everything again. Compare screen IDS ONLY: the
payload is rewritten on every present. Result: **9 commits, presenting flow click and
preview click identical.**

See [[lyric-subsystem-architecture]], [[screen-window-has-no-app-fonts]],
[[onscreen-check-must-not-parse]].
