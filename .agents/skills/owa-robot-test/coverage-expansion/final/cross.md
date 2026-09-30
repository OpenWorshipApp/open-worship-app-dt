# GL / NAV — Cross-cutting & header nav (coverage-expansion final)

Source: `coverage-expansion/discover-cross-cutting.md` (lines read 2026-07-17).
Existing matrix rows GL-01..GL-13 and NAV-01..NAV-11 kept as-is (corrections in
REFINE below). New rows GL-14..GL-22 and NAV-20..NAV-22 fill the GAPs; control
families are consolidated to one row each. Pure ⌨️-shortcut paths defer to the KB
pass and context-menu *item* actions defer to CM / the peer PL pass.

## GL additions

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| GL-14 | `AlertPopupComp` (alert — distinct from confirm/input) | trigger an alert (e.g. NAV-03 "No slide selected"); 🖱️ header `.btn-close`; ⌨️ `Escape`; ⌨️ `Enter` | `#app-alert-popup` renders message only — **NO Ok/Cancel buttons exist**; header `.btn-close` and `Escape` both close via `onClose`; `Enter` does nothing (no handler) — so GL-08's Ok/Cancel wording must NOT be applied to alerts (src: src/popup-widget/AlertPopupComp.tsx:19) |
| GL-15 | `ToastComp` manual dismiss (click-close · hover-pause/leave-restart) — auto-dismiss stays GL-10 | fire a toast; 🖱️ header `button.btn-close`; on a second toast 🖐️ hover then mouse-out | clicking `.btn-close` runs `onClose` → toast disappears immediately (before the 4 s timer); hovering `.toast` clears the auto-dismiss timer so it persists while hovered, and mouse-out starts a fresh **2000 ms** timer after which it dismisses (src: src/toast/ToastComp.tsx:31) |
| GL-16 | `AppContextMenuComp` container mechanics not in GL-06 (letter typeahead · disabled-item) | open any context menu; ⌨️✎ type a letter; 🖱️ a `.app-context-menu-item.disabled` entry | typing a letter scrolls to the next item whose `textContent` starts with it (cycles on repeat); clicking a disabled item runs no `onSelect` and its `stopPropagation` keeps the menu open — nothing happens (src: src/context-menu/appContextMenuHelpers.ts:280) |
| GL-17 | `FlexResizeActorComp` splitter right-click menu (structural — not a data-item menu) | 🖱️R a `.flex-resize-actor` splitter; 🖱️ `Reset Size` | context menu opens with exactly `Reset Size` / `Close First Widget` / `Close Second Widget`; `Reset Size` → `resetSize()` clears the panes' `flex-grow` back to each `data-fs-default` (src: src/resize-actor/FlexResizeActorComp.tsx:330) |
| GL-18 | Splitter collapse arrow → hidden-widget bar → re-expand (generic mechanism behind PM-26) | 🖱️ a `.disabling-arrow` collapse img on a quick-resize splitter; then 🖱️ the collapsed bar | `close(direction)` collapses the adjacent pane → it gets `HIDDEN_WIDGET_CLASS` and renders as an `.app-hidden-widget` bar (`title`="Enable <name>"); clicking the bar runs `handleReopening` and restores the pane's flex size (src: src/resize-actor/FlexResizeActorComp.tsx:375) |
| GL-19 | `FloatingWidgetComp` lifecycle + header buttons (open via Presenter Foreground tab · chevron collapse · X close) | 🖱️ Presenter `Foreground` tab; 🖱️ chevron `.floating-widget__button`; 🖱️ `bi-x-lg` close button | Foreground tab opens a `.floating-widget` (rect top:64, right-anchored) hosting `PresenterForegroundComp` — **NOT a split pane** (PM-01 stale for Foreground); chevron toggles `.floating-widget--collapsed` (height→42px, icon flips `bi-chevron-down`↔`up`, aria Collapse↔Expand); `bi-x-lg` runs `onClose` → widget unmounts and the tab de-toggles (src: src/app-modal/FloatingWidgetComp.tsx:263) |
| GL-20 | `FloatingWidgetComp` pointer manipulation + persistence (drag-move · 8 resize handles) | ⇕ pointer-drag a blank (non-button) area of `.floating-widget`; ⇕ pointer-drag each `.floating-widget__resize-handle--*` (4 edges + 4 corners) | drag adds `.floating-widget--moving` and changes `left/top`; resize adds `.floating-widget--resizing` and changes `width/height`, clamped to min/max + viewport; on pointer-up the rect writes to the `persistKey` setting and is restored on next open (src: src/app-modal/FloatingWidgetComp.tsx:144) |
| GL-21 | External-file drag-over accept gate (`genOnDragOver`/`genOnDragLeave`) — synthetic per CLAUDE.md | ⇕ dispatch `dragover` carrying a `File` item over a list drop zone (folder open); then ⇕ dispatch `dragleave` | `dragover` → `event.target.style.opacity = '0.5'` (accepted look); `dragleave` → `event.target.style.opacity = '1'` (src: src/others/droppingFileHelpers.ts:17) |
| GL-22 | Drop onto a list with no folder open (`dirSource.dirPath === null`) | ⇕ dispatch `drop` on a list whose directory is unset | `genOnDrop` → `showSimpleToast('Open Folder','Please open a folder first')` (pair GL-10 / GL-15); no copy occurs (src: src/others/droppingFileHelpers.ts:105) |

## NAV additions

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| NAV-20 | Experiment page **Back** button (`button.back`) | on `experiment.html`, 🖱️ `button.back` | native `onclick="history.back()"` navigates to the previous page (`location` changes back) (src: html/experiment.html:48) |
| NAV-21 | Slide-Editor tab **external-open icon** (`bi-box-arrow-up-right` inside the tab) — distinct from ED-10 slide-menu Edit | presenter page + OWA doc selected; 🖱️ the `bi-box-arrow-up-right` span inside the Slide-Editor tab | `stopPropagation` (no in-window nav) → `openAppDocumentEditorExternal` opens a NEW `appDocumentEditor.html?file=…` popup window (new `app_document_editor_*` target in `list_pages`) (src: src/router/layoutHelpers.tsx:64) |
| NAV-22 | `QuitCurrentPageComp` (`bi-escape`, "Return to Presenter") — rendered by the editor non-OWA entry guard (ED-01) | on the editor guard, 🖱️ `button.btn-outline-warning` | `goToPath(pathname)` navigates the window back to `presenter.html` (src: src/others/commonButtons.tsx:15) |

### REFINE

Corrections to existing matrix rows (source verified the code paths):

- **NAV-01** — drop "`.active` set". `LayoutTabRenderComp` renders a **static** `button.btn-link.nav-link` with no `.active` logic anywhere, and `genTabs` omits the current page's own tab; the only observable is navigation → `presenter.html` (src: src/router/LayoutTabRenderComp.tsx:24).
- **NAV-02** — drop "`.active`"; observable is navigation → `reader.html` (reader has no `#app-header`) only (src: src/router/layoutHelpers.tsx:40).
- **NAV-03** — name the exact alert: the tab's `preCheck` (`checkIsAppDocumentSelected`) fails → `showAppAlert('No slide selected', …)` → `#app-alert-popup` appears and `location` is unchanged (not just "alert shown") (src: src/router/LayoutTabRenderComp.tsx:10).
- **NAV-05** — give the concrete observable: `#root` renders the literal text "No content" + a `button.back`; no `img.loading` remains (src: archived/experiment.tsx:5).
- **NAV-10** — the Help button a11y name is now `tran('Help')` via `aria-label`+`title`, **NOT a raw URL**; the KB §9 "Help=raw URL" caveat is STALE (src: src/others/commonButtons.tsx:67).
- **GL-04** — drop the "known: Help=raw URL" caveat — the Help button now exposes accessible name "Help" (the fullscreen-unnamed caveat still stands) (src: src/others/commonButtons.tsx:67).
- **GL-06** — add a **third** close path: outer `onContextMenu` (right-click-away) also closes the menu, alongside Escape and click-away; note the menu edge-flips near the right/bottom and is capped 210px wide (src: src/context-menu/appContextMenuHelpers.ts:59).
- **GL-08** — split confirm from alert (see GL-14) and enumerate the **5** dismissals of `#app-confirm-popup`: Cancel / Ok / header X / `Enter`→Ok / `Escape`→cancel, with `onConfirm(true)` on Ok+Enter and `onConfirm(false)` on Cancel+X+Escape (src: src/popup-widget/ConfirmPopupComp.tsx:24).
- **GL-09** — target `#app-input-popup`; add the header-X, `Enter`→Ok and `Escape`→Cancel dismissals: input applies on Ok/Enter, discards on Cancel/X/Escape (src: src/popup-widget/InputPopupComp.tsx:23).
- **GL-10** — state the **4000 ms** default (`toast.timeout ?? 4e3`) and that manual dismiss modes now exist → GL-15 (click-close + hover-pause/2 s leave-restart) (src: src/toast/ToastComp.tsx:46).
- **GL-12** — the 🖱️🖱️ path is a **reset-to-default**, not "quick-resize where enabled": `resetSize()` clears `flex-grow` and restores each pane's `data-fs-default` flex; it is always enabled (src: src/resize-actor/FlexResizeActorComp.tsx:320).

Cross-prefix flags (not emitted here — for the maintainer / other passes):
- **PM-01** stale — the Foreground tab opens the `FloatingWidgetComp` (GL-19), not a split-view pane; reword PM-01 for the Foreground case.
- **KB-14** (context-menu `ArrowUp`/`ArrowDown`/`Enter`/`Tab` keyboard nav) — a genuine GAP but a keyboard-navigation path owned by the KB pass; not emitted as a GL row.
- **GL-30 source proposal** (empty-list drop right-click menu — Add Items / Create New File) — a context-menu *item* listing (CM owns); already emitted by the peer PL pass as **PL-24**, so not duplicated here.

### COUNTS

- **GL** — 9 new rows (GL-14..GL-22) · last id used: **GL-22**
- **NAV** — 3 new rows (NAV-20..NAV-22) · last id used: **NAV-22**
- **Total new rows: 12** · REFINE: 11 (NAV-01, NAV-02, NAV-03, NAV-05, NAV-10, GL-04, GL-06, GL-08, GL-09, GL-10, GL-12)

Reconciliation of the 21 source GAPs: 19 consolidated into the 12 emitted rows —
NAV-12/13/14 → NAV-20/21/22; GL-16 → GL-14; GL-17+GL-18 → GL-15; GL-14+GL-15 →
GL-16; GL-19 → GL-17; GL-20+GL-21 → GL-18; GL-22+GL-25+GL-26 → GL-19;
GL-23+GL-24 → GL-20; GL-27+GL-29 → GL-21; GL-28 → GL-22 — plus 2 deferred
(KB-14 → KB pass; GL-30 → already PL-24). 19 + 2 = 21.
