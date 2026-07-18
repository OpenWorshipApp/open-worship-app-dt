# Editor Area — Robot Unit-Test Path Inventory

Area: **SLIDE / DOC EDITOR** — `src/slide-editor/*` + `src/app-document-editor/*`
(plus the shared slide-list previewer `src/app-document-presenter/items/*` when
rendered in `appDocumentEditor.html`).

Legend: 🖱️ click · 🖱️🖱️ dbl-click · 🖱️R right-click/contextmenu · ⇕ drag+drop ·
⌨️ keyboard · 🎚️ slider · ⌨️✎ text/number input · 🖐️ hover.
Status: **COVERED** (matches an existing matrix row) · **REFINE** (row exists but
vague/wrong/incomplete) · **GAP** (no row — the valuable output).

DOM targeting note: dev stamps every `*Comp` root with
`data-react-comp-name` / `data-react-comp-fp` — use those for element location.
Selected box → `.editor-controller-box-wrapper` + `.app-box-editor.controllable`,
box id = `[data-app-box-editor-id="N"]`. The canvas body is `.slide-canvas-editor`
inside a `shadowing-parent-width-tag` shadow root (children unreadable from parent
document — pierce the shadow root or walk React fibers per CLAUDE.md).

---

## A. Entry, layout & tool tab bar

| Proposed ID | Target (component) | Interaction | Keys | Given | When | Then (observable) | Source (file:line) | Status |
|---|---|---|---|---|---|---|---|---|
| ED-01 | `AppDocumentEditorComp` entry guard | load | — | select OWA doc / non-OWA (pdf/pptx/docx) doc then open editor | page mounts | OWA → editor renders (`SlideEditorGroundComp`); non-OWA → confirm popup "Open Worship slide required" → "Return to Presenter" nav to presenter | AppDocumentEditorComp.tsx:39-50 | COVERED |
| ED-13 | `SlideEditorGroundComp` empty state | observe | — | editor open but no slide selected for editing | no `selectedSlideEditing` | shows `<div>No slide selected</div>` (no canvas) | SlideEditorGroundComp.tsx:10-13 | GAP |
| ED-77 | `SlideEditorComp` canvas/tools splitter | ⇕ | — | slide selected | drag `ResizeActorComp` divider between canvas (h1) and tools (h2) | panes resize; size persists (`resizeSettingNames.slideEditor`) | SlideEditorComp.tsx:17-56 | GAP (GL-12 generic; editor-specific splitter) |
| ED-78 | `SlideEditorToolsComp` tab bar | 🖱️ | — | tools panel visible | click `Properties` / `Canvas Items` tab | active tab switches; body swaps `SlideEditorPropertiesComp` ↔ `ToolCanvasItemsComp`; persists (`editor-tools-tab`) | SlideEditorToolsComp.tsx:48-70 | GAP |
| ED-12 | Bottom `BackgroundComp` (editor) | 🖱️ expand + tab switch | — | editor open | expand Background label, switch Colors/Images/Videos/Cameras/Webs | same as PM-26/27 but no Audios split off-presenter | AppDocumentEditorRightComp.tsx:26-31 | COVERED |

---

## B. Slide list (editor context) — selection, reorder, drop, per-item menu

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| ED-02 | `SlideRenderComp` item | 🖱️ select-to-edit | — | doc open | click a slide card | that slide becomes editing slide (loads into canvas); card gets active/highlight class (`.active`). NOTE: editor uses single-click-to-edit, not dbl-click | VarySlideRenderWrapperComp.tsx:34-53; SlideRenderComp.tsx:89-105 | REFINE (row says "🖱️🖱️ open" — editor has no separate dbl-click-open) |
| ED-79 | Slide item multi-hold | 🖱️ +Ctrl / +Shift | Ctrl/Shift | ≥2 slides | Ctrl-click or Shift-click additional slides | multiple slides enter holding set (`holdingSlides`); each gets holding class; a Ctrl+right-click selects instead of menu | VarySlideRenderWrapperComp.tsx:42-49; SlideRenderComp.tsx:55-62 | GAP |
| ED-04 | Slide list reorder | ⇕ | — | ≥2 slides | drag one slide card onto another | `moveSlideToIndex` reorders; order persists; opacity 0.5 while dragover | VarySlideRenderComp.tsx:234-255 | COVERED |
| ED-80 | Slide item attach-background drop | ⇕ | — | a bg image/video item draggable | drag a background item onto a slide card | non-SLIDE drop → `handleAttachBackgroundDrop`; attach-bg icon appears on the slide header | VarySlideRenderComp.tsx:251-253 | GAP |
| ED-73 | Slide list media drop → new slides | ⇕ | — | OWA doc open | drop image/video file(s) onto the slides container | `createNewSlidesFromDroppedData` adds slide(s); unsupported type → toast "Unsupported file type!" | VarySlidesPreviewerComp.tsx:32-45,95-103 | GAP (EX-01 for OS file picker; synthetic drop caveat per CLAUDE.md) |
| ED-03 | Slide item 🖱️R → Duplicate | 🖱️R | — | slide selected-editing | right-click → "Duplicate" | duplicate slide appears after original | appDocumentHelpers.tsx:147-155 | COVERED (but menu is larger — see ED-67..70,75) |
| ED-81 | Slide item 🖱️R → Delete | 🖱️R | — | scratch duplicate exists | right-click → "Delete" | that slide removed; list count −1 (self-clean the duplicate from ED-03) | appDocumentHelpers.tsx:201-207 | COVERED (part of ED-03) |
| ED-67 | Slide item 🖱️R → Copy | 🖱️R | — | slide present | right-click → "Copy" | toast "Copied / Slide is copied"; `AppDocument.setCopiedSlides` | appDocumentHelpers.tsx:137-146 | GAP |
| ED-68 | Slide item 🖱️R → Move forward | 🖱️R | — | ≥2 slides, not last | right-click → "Move forward" | slide index +1; order persists (alt reorder path) | appDocumentHelpers.tsx:156-161 | GAP |
| ED-69 | Slide item 🖱️R → Move backward | 🖱️R | — | ≥2 slides, not first | right-click → "Move backward" | slide index −1 | appDocumentHelpers.tsx:162-167 | GAP |
| ED-70 | Slide item 🖱️R → Enable/Disable | 🖱️R | — | a slide | toggle "Disable" then "Enable" | disabled slide gets opacity 0.5 + title "This slide is disabled"; re-enable restores | appDocumentHelpers.tsx:168-174; VarySlideRenderComp.tsx:300-317 | GAP |
| ED-82 | Slide item 🖱️R → Show on Screen(s) submenu | 🖱️R | — | ≥1 screen | right-click → show-on-screen entry | slide presents on that screen (`.app-on-screen`) — restore (pairs SP/SC) | appDocumentHelpers.tsx:193-200 | GAP |
| ED-75 | Slide item 🖱️R → Color note / Remove attached bg | 🖱️R | — | slide (with/without attached bg) | pick a color-note; or "remove attached background" when present | slide header border tints to color; attach-bg icon clears | VarySlideRenderComp.tsx:274-292 | GAP |
| ED-71 | Holding-slides 🖱️R (multi) → Copy/Duplicate/Delete | 🖱️R | — | ≥2 slides held (ED-79) | right-click a held slide | menu = Copy(→toast "Slides are copied") / Duplicate / Delete acting on the whole set | appDocumentHelpers.tsx:211-238; SlideRenderComp.tsx:68-72 | GAP |
| ED-72 | Slide list container 🖱️R (empty area) | 🖱️R | — | doc open | right-click empty list background | menu: "New Slide" (+"Paste" if copied slide, +"Paste Image" if clipboard image) | AppDocument.ts:433-467; VarySlidesPreviewerComp.tsx:83-86 | GAP |
| ED-83 | Slide list container "New Slide" | 🖱️ (menu) | — | ED-72 open | click "New Slide" | new blank slide appended; count +1 | AppDocument.ts:437-442 | GAP |
| ED-84 | Slide list container "Paste"/"Paste Image" | 🖱️ (menu) | — | copied slide or clipboard image present | click Paste / Paste Image | slide(s) added from clipboard | AppDocument.ts:444-465 | GAP |
| PM-09b | Editor slide-thumb size slider / Ctrl+scroll | 🎚️ / ⌨️ | Ctrl+scroll | doc open | drag footer size slider or Ctrl+scroll the list | thumbnails rescale (same control as PM-09, editor context) | VarySlidesPreviewerComp.tsx:105-110; AppDocumentPreviewerFooterComp | COVERED (PM-09) |

---

## C. Slide-list keyboard shortcuts (slides container focused)

Fires via `onSlideItemsKeyboardEvent` (container `onKeyDown`/`onBlur`).

| Proposed ID | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|
| KB-14 | `Escape` | slides held | press Escape | holding set cleared (holding classes drop) | slideEditingKeyboardEventHelpers.ts:112-116 | GAP |
| KB-15 | `Delete` / Meta+`Backspace` | ≥1 slide held | press Delete | held slides deleted (`deleteSlides`) — use a scratch dup | slideEditingKeyboardEventHelpers.ts:117-133 | GAP |
| KB-16 | `Ctrl+A` | list focused | press Ctrl+A | all slides become held (`setHoldingSlides(all)`) | slideEditingKeyboardEventHelpers.ts:134-149 | GAP |
| KB-17 | `Ctrl+C` | slide(s) held | press Ctrl+C | toast "Copied / Slides are copied"; copied-slides set | slideEditingKeyboardEventHelpers.ts:150-167 | GAP |
| KB-18 | `Ctrl+V` | slide copied | press Ctrl+V | copied slides appended | slideEditingKeyboardEventHelpers.ts:168-183 | GAP |
| KB-19 | `Ctrl+Shift+D` | slide(s) held | press Ctrl+Shift+D | held slides duplicated | slideEditingKeyboardEventHelpers.ts:184-200 | GAP |

---

## D. Canvas — direct box manipulation

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| ED-05 | Box select + move + resize | 🖱️ / ⇕ | — | slide w/ box | click box → drag body to move; drag edge/corner handle to resize | box selected (`.editor-controller-box-wrapper`), moves/resizes; live drag badge shows x/y or w/h | BoxEditorControllingModeComp.tsx:82-186; BoxEditorController.ts:525-611,700-782 | COVERED |
| ED-46 | Box **rotate** handle | ⇕ | — | box selected | drag the `.rotate` rotator handle | box `transform: rotate(Ndeg)` updates; badge shows `N°`; commits to `props.rotate` | BoxEditorController.ts:666-699; BoxEditorControllingModeComp.tsx:164-166 | GAP |
| ED-47 | Box resize modifiers | ⇕ | Ctrl / (aspect) | box selected | resize with Ctrl held (center-anchored) or on aspect-locked item | Ctrl → both edges move about fixed center; aspect-lock keeps ratio | BoxEditorController.ts:155,198-246,739-742 | GAP |
| ED-85 | 8 resize handles enumerated | ⇕ | — | box selected | drag each of right/left/top/bottom-mid + 4 corners | each handle resizes its edge(s); cursor rotates with box angle | BoxEditorController.ts:291-342; BoxEditorControllingModeComp.tsx:167-182; boxEditorHelpers `getRotatedResizeCursor` | GAP |
| ED-86 | Snap-to-guide/edge while dragging | ⇕ | — | ≥2 boxes or a guide | drag a box near another box edge/center or a guide | cyan snap line appears (`#00c8ff`), box position snaps (8px/scale threshold) | BoxEditorController.ts:850-937; CanvasGuideLineComp.tsx:45-62 | GAP |
| ED-49 | Multi-select group drag | ⇕ | — | ≥2 boxes selected | drag one selected box | whole selection moves together as one undo step; badge lists each box | BoxEditorController.ts:484-611; BoxEditorControllingModeComp.tsx:104-118 | GAP |
| ED-06 | Multi-select via Shift/Ctrl click | 🖱️ | Shift/Ctrl | slide w/ ≥2 boxes | Shift/Ctrl-click boxes | multiple boxes selected (each controllable) | BoxEditorControllingModeComp.tsx:57-68; canvasSelectionHelpers | COVERED |
| ED-50 | Shift/Ctrl-click a selected box removes it | 🖱️ | Shift/Ctrl | box already selected | Shift/Ctrl-click it again | box removed from selection (append toggles off) | BoxEditorControllingModeComp.tsx:57-65 | GAP |
| ED-48 | Marquee rubber-band select | ⇕ | (Shift/Ctrl append) | empty canvas area | press on empty canvas + drag a rectangle | blue marquee rect (`rgba(74,163,255,.25)`) draws; boxes inside get selected on release (Shift/Ctrl appends) | BodyRendererComp.tsx:159-305 | GAP |
| ED-87 | Click empty canvas clears modes | 🖱️ | — | box selected/editing | click empty canvas background (quick, <500ms, <10px) | `stopAllModes` → selection cleared, edit exited | BodyRendererComp.tsx:266-288 | GAP |
| ED-88 | Locked box indicator + no-drag | 🖱️/⇕ | — | box locked (via menu) | try to move/dbl-click a locked box | shows `.locked-indicator` 🔒 (title "Locked"); no drag handles; dbl-click no-ops | BoxEditorControllingModeComp.tsx:72-79,157-160 | GAP |

---

## E. Canvas — rulers, guides, zoom, center

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| ED-44 | Ruler → create guide | ⇕ | — | canvas visible | pointer-down on H or V `CanvasRulerComp` and drag onto canvas | new pink guide line (`#ff2fa0`) appears at drop position (title "Drag onto the canvas to add a guide line") | CanvasRulerComp.tsx:118,135-139; CanvasContainerComp.tsx:97-104,175-192 | GAP |
| ED-45 | Guide move / remove | ⇕ / 🖱️🖱️ | — | a guide exists | drag guide to move; drag out of bounds OR double-click to remove | guide repositions; leaves bounds or dbl-click → guide removed (title "Drag to move, double-click to remove") | CanvasGuideLineComp.tsx:14-42; CanvasContainerComp.tsx:44-112 | GAP |
| ED-41 | Canvas scale slider | 🎚️ | — | canvas visible | drag `SlideEditorCanvasScalingComp` range (min 1 max 20) | `NN.Nx` label updates; canvas rescales; persists (`canvas-editor-scale`) | SlideEditorCanvasScalingComp.tsx:38-45; CanvasController.ts:67-71 | GAP |
| ED-42 | Center-view button | 🖱️ | — | canvas scrolled off-center | click `bi-border-middle` icon | canvas scrolls to center (`toCenterView`) | SlideEditorCanvasScalingComp.tsx:31-34; CanvasContainerComp.tsx:114-133 | GAP |
| ED-43 | Ctrl+scroll canvas zoom | ⌨️ | Ctrl+wheel | canvas focused | Ctrl+scroll over the canvas container | scale changes (same range as ED-41); label updates | SlideEditorCanvasComp.tsx:110-116 | GAP |

---

## F. Canvas — context menus

### F1. Empty-canvas menu (`showCanvasContextMenu`, via `openCanvasContextMenu`)

| Proposed ID | Menu item | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|
| ED-51 | **New** | canvas open | 🖱️R empty canvas → "New" | new default text box appears on canvas | canvasContextMenuHelpers.ts:41-46 | GAP |
| ED-52 | **Insert Medias** | — | menu → "Insert Medias" | OS file dialog opens (EX-01 to the edge); selected image/video becomes a canvas item at cursor | canvasContextMenuHelpers.ts:59-80 | GAP |
| ED-53 | **Insert YouTube** | — | menu → "Insert YouTube" | URL input popup (`askForURL`); confirm → youtube canvas item added | canvasContextMenuHelpers.ts:81-99 | GAP |
| ED-54 | **Insert Website** | — | menu → "Insert Website" | URL input popup; confirm → website canvas item added | canvasContextMenuHelpers.ts:100-118 | GAP |
| ED-55 | **Paste** | a canvas item copied (Ctrl+C) | menu → "Paste" | copied item(s) re-added to canvas | canvasContextMenuHelpers.ts:47-58 | GAP |
| ED-56 | **Paste Image** | clipboard has image | menu → "Paste Image" | image canvas item added from clipboard | canvasContextMenuHelpers.ts:119-138 | GAP |
| ED-57 | **Paste Bible Item** | clipboard has bible item | menu → "Paste Bible Item" | bible canvas item added, laid out fitted | canvasContextMenuHelpers.ts:139-151; CanvasController.ts:271-286 | GAP |
| ED-76 | Canvas media file drop | ⇕ drop file | canvas open | drop image/video onto `.slide-canvas-editor` (dragover → opacity 0.5 gate) | supported → new media canvas item; unsupported → toast "Unsupported file type!" | canvasContainerHelpers.ts:11-42; BodyRendererComp.tsx:143-147,322-324 | GAP |

### F2. Canvas-item menu (`showCanvasItemContextMenu`) — 🖱️R a box (or a Canvas-Items card)

| Proposed ID | Menu item | Applies to | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|
| ED-58 | **Lookup** | bible item | 🖱️R bible box → "Lookup" | Bible Lookup popup opens seeded with the verse | canvasContextMenuHelpers.ts:187-199 | GAP |
| ED-59 | **Lock / Unlock** | any | 🖱️R → toggle | locked box shows 🔒, drag handles gone; menu label flips; deleting a locked box → toast "Locked items cannot be deleted" | canvasContextMenuHelpers.ts:200-210; CanvasController.ts:151-160 | GAP |
| ED-60 | **Copy** | any | 🖱️R → "Copy" | toast "Copied / Canvas item copied" | canvasContextMenuHelpers.ts:211-225 | GAP |
| ED-61 | **Duplicate** | any | 🖱️R → "Duplicate" | duplicate at +20,+20 offset (`MOVING_OFFSET`) | canvasContextMenuHelpers.ts:226-239; CanvasController.ts:140-149 | GAP |
| ED-62 | **Reveal in file manager** | video only | 🖱️R video → reveal | OS file explorer opens (EX-01 edge) | canvasContextMenuHelpers.ts:240-249 | GAP |
| ED-63 | **Open URL / Copy URL** | youtube/website | 🖱️R → Open/Copy URL | Open → external browser; Copy → URL on clipboard | canvasContextMenuHelpers.ts:250-267 | GAP |
| ED-64 | **Download** | image only | 🖱️R image → "Download" | embedded base64 image downloaded | canvasContextMenuHelpers.ts:268-277 | GAP |
| ED-65 | **Edit** | text only (unlocked) | 🖱️R text → "Edit" | box enters text-edit mode (textarea) | canvasContextMenuHelpers.ts:278-287 | GAP |
| ED-66 | **Delete** | any (unlocked) | 🖱️R → "Delete" | box removed from canvas | canvasContextMenuHelpers.ts:288-302 | GAP |

---

## G. Text-edit mode

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| ED-07 | `BoxEditorNormalTextEditModeComp` | 🖱️🖱️ + ⌨️✎ + click-away | — | text box | dbl-click box, type, click away | textarea appears; typed text commits to slide on blur | BoxEditorNormalTextEditModeComp.tsx:93-100; BoxEditorControllingModeComp.tsx:72-79 | COVERED |
| ED-89 | Text-edit `Escape` cancel | ⌨️ | Escape | editing text, text changed | press Escape | edit discarded (text NOT changed), exits edit mode | BoxEditorNormalTextEditModeComp.tsx:81-85 | GAP |
| ED-90 | Text-edit `Ctrl+Enter` commit | ⌨️ | Ctrl+Enter | editing text | press Ctrl+Enter | text commits; box switches to selected (props panel stays open) | BoxEditorNormalTextEditModeComp.tsx:87-89 | GAP |
| ED-91 | Text-edit right-click commit | 🖱️R | — | editing text | right-click inside the editing box | commits the draft text (exits edit) | BoxEditorNormalTextEditModeComp.tsx:76-80 | GAP |

---

## H. Tool panel — **Properties** tab

### H1. Slide-level properties (`SlidePropertyEditorComp`)

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| ED-14 | Slide props header expand | 🖱️ | — | Properties tab | click "Slide" header (chevron) | body expands (name+dim); chevron `bi-chevron-down`; persists (`slide-property-editor`) | SlidePropertyEditorComp.tsx:250-267 | GAP |
| ED-15 | Slide name input + Apply | ⌨️✎ + 🖱️ | — | header expanded | type a new name → "Apply" appears → click | `updateSlide` renames; Apply button only shows while changed | SlidePropertyEditorComp.tsx:199-237 | GAP |
| ED-16 | Slide Width/Height inputs | ⌨️✎ | — | header expanded | change Width or Height number | value updates; "Apply" appears when differs from slide dim | SlidePropertyEditorComp.tsx:51-80,142-158 | GAP |
| ED-17 | Slide dim **Apply** | 🖱️ | — | dim changed | click "Apply" | `changeSlidesDimension` applies to THIS slide | SlidePropertyEditorComp.tsx:114-117,162-170 | GAP |
| ED-18 | Slide dim **Reset** | 🖱️ | — | dim ≠ default display | click "Reset" | dim set to default display bounds | SlidePropertyEditorComp.tsx:118-127,172-180 | GAP |
| ED-19 | Slide dim **Apply All Slides** | 🖱️ | — | dim differs from other slides | click "Apply All Slides" → confirm "Yes" | confirm popup; on Yes → all slides get this dim | SlidePropertyEditorComp.tsx:128-141,181-190 | GAP |

### H2. Canvas-item props card (`CanvasItemPropsEditorComp`)

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| ED-20 | Item props card expand | 🖱️ | — | box selected | click "Item ID: N" header | card body toggles; chevron flips; persists (`canvas-item-props-editor`) | CanvasItemPropsEditorComp.tsx:96-110 | GAP |
| ED-21 | Locked item **Unlock** | 🖱️ | — | selected box is locked | click "Unlock" (🔒 row) | box unlocks; editors re-appear | CanvasItemPropsEditorComp.tsx:118-127,83-87 | GAP |
| ED-22 | Collapsible tool sections | 🖱️ | — | props open | toggle "Box Properties" / "Text Properties" collapsible titles | section body shows/hides; chevron `bi-chevron-down`/`-right` | SlideEditorToolTitleComp.tsx:30-43; useExpandToggle.tsx:36-45 | GAP |

### H3. Box Properties (`SlideEditorToolsBoxComp`)

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| ED-23 | Box background color | 🖱️ (ColorPicker) | — | non-media box selected | pick a color / "no color" | box `backgroundColor` prop changes; debounced commit re-renders box | SlideEditorToolsBoxComp.tsx:131-157; SlideEditorToolsColorComp.tsx | GAP |
| ED-24 | Position X / Y inputs | ⌨️✎ | — | box selected | edit X (left) / Y (top) number | box moves to typed position | BoxPositionSizeComp.tsx:44-61 | GAP |
| ED-25 | Size W / H inputs | ⌨️✎ | — | box selected | edit W / H (min 1) | box resizes | BoxPositionSizeComp.tsx:62-79 | GAP |
| ED-26 | Rotate input + Reset | ⌨️✎ + 🖱️ | — | box selected | type rotate deg; click Reset (`bi-arrow-counterclockwise`) | box rotates (normalized 0–360); Reset → 0° | BoxPositionSizeComp.tsx:81-101 | GAP |
| ED-27 | Box alignment buttons | 🖱️ | — | box selected | click vertical (top/mid/bottom) + horizontal (left/center/right) align | box repositions to canvas edge/center; active btn `disabled`+solid `btn-info` | SlideEditorToolsBoxComp.tsx:161-163; SlideEditorToolAlignComp.tsx:90-142 | GAP |
| ED-28 | Shape: Glass Effect | ⌨️✎ | — | box selected | set Glass Effect (backdropFilter) px | box gets backdrop blur | ShapePropertiesComp.tsx:40-50 | GAP |
| ED-29 | Shape: Round % slider | 🎚️ | — | round-pixel = 0 | drag Round % range (0–100) | box corners round by %; disabled/greyed when round-px > 0 | ShapePropertiesComp.tsx:51-80 | GAP |
| ED-30 | Shape: Round px input | ⌨️✎ | — | box selected | set Round Size Pixel | corners round by px; disables the % slider | ShapePropertiesComp.tsx:86-93 | GAP |
| ED-31 | Box Layer order buttons | 🖱️ | — | ≥2 boxes | click Send backward (`bi-layer-backward`) / Bring forward (`bi-layer-forward`) | box z-order reorders in `canvasItems` array | SlideEditorToolsBoxComp.tsx:80-125 | GAP |
| ED-32 | Size fit buttons | 🖱️ | — | box selected | click Full / Original Size / (Strip = media only) | box resizes: fit-canvas / natural size / media strip | SlideEditorToolsBoxComp.tsx:18-77 | GAP |

### H4. Text Properties (`SlideEditorToolsTextComp`) — text/bible items

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| ED-33 | Text color | 🖱️ (ColorPicker) | — | text/bible box | pick text color | `color` prop changes; glyphs recolor | SlideEditorToolsTextComp.tsx:33-42 | GAP |
| ED-34 | Text alignment | 🖱️ | — | plain-text box (alignment enabled) | click vertical + text-horizontal (left/center/right `bi-text-*`) align | `textHorizontalAlignment`/`textVerticalAlignment` set; text realigns | SlideEditorToolsTextComp.tsx:43-62; SlideEditorToolAlignComp.tsx:101-124 | GAP |
| ED-35 | Font size (input + select) | ⌨️✎ / 🖱️ | — | text/bible box | type size or pick from 15–300px select | `fontSize` changes; text resizes | ToolsTextFontControlComp.tsx:33-36; FontSizeControlComp.tsx:21-44 | GAP |
| ED-36 | Font family select | 🖱️ | — | text/bible box | choose a font family | `fontFamily` set; a configured-but-missing font shows "X (Missing)" (informative) | ToolsTextFontControlComp.tsx:38-44; FontFamilyControlComp.tsx:56-69,26-29 | GAP |
| ED-37 | Font weight/style select | 🖱️ | — | family with weights chosen | choose a weight/style | `fontWeight` set; text reweights (only shown when family has weights) | FontFamilyControlComp.tsx:84-127 | GAP |
| ED-38 | Text content textarea | ⌨️✎ | — | plain-text box (content enabled) | type in the "Text" textarea | `text` prop updates; box text changes without entering canvas edit mode | SlideEditorToolsTextContentComp.tsx:9-35 | GAP |

---

## I. Tool panel — **Canvas Items** tab (`ToolCanvasItemsComp`)

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| ED-09 | `ToolCanvasItemsComp` | click card / drag tool | — | (matrix row says "add box; drag tool → canvas") | — | **Row misdescribes this panel**: it is a per-item preview list (select/right-click), NOT an add-box/drag-tool source. Add-box is the canvas "New" menu (ED-51). | ToolCanvasItemsComp.tsx:17-95 | REFINE |
| ED-39 | Canvas-Items card select | 🖱️ (Shift/Ctrl append) | — | ≥1 canvas item | click a card (`card app-caught-hover-pointer`) | item selected → `2px dashed green` border; Shift/Ctrl appends | ToolCanvasItemsComp.tsx:49-56 | GAP |
| ED-40 | Canvas-Items card 🖱️R | 🖱️R | — | a card | right-click a card | opens the canvas-item context menu (ED-58..66) | ToolCanvasItemsComp.tsx:57-62 | GAP |

---

## J. Editing toolbar (undo / redo / save / discard / fix-dim)

`FileEditingMenuComp` (rendered by `SlidesMenuComp` in the slides list + canvas footer).
Buttons appear only when `canUndo || canRedo || canSave`.

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| ED-92 | **Undo** button | 🖱️ | — | an edit made | click Undo (`bi-arrow-90deg-left`) | last edit reverts; props panel re-syncs; button disabled at history start | editingHelpers.tsx:158-168 | GAP |
| ED-93 | **Redo** button | 🖱️ | — | after an undo | click Redo (`bi-arrow-90deg-right`) | edit re-applies | editingHelpers.tsx:169-179 | GAP |
| ED-11 | **Save** (button + `Ctrl+S`) | 🖱️/⌨️ | Ctrl+S | dirty doc (`canSave`) | click Save (`bi-floppy`, btn-success) or press Ctrl+S | doc saves; dirty `*` clears; Save disables | editingHelpers.tsx:101-128,63-66 | COVERED |
| ED-94 | **Discard changed** button | 🖱️ | — | tools showing | click Discard (`bi-x-octagon`, btn-danger) → confirm | confirm popup "Discard changed" — **click Cancel only** (destructive per CLAUDE.md; never "Yes" in QA) | editingHelpers.tsx:87-117 | GAP (EX-05 to the edge; Cancel only) |
| ED-95 | Fix-dimension button | 🖱️ | — | slide dim ≠ display | click warning `bi-hammer`+`bi-aspect-ratio` | `fixSlidesDimensionForDisplay` corrects dims | SlidesMenuComp.tsx:36-49 | GAP |

---

## K. Canvas keyboard shortcuts (editor-container focused)

Fires via `onCanvasKeyboardEvent`; container = `.editor-container.app-focusable`
(needs OS foreground focus; `Ctrl+Enter` focuses it — ED-08/KB-10).

| Proposed ID | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|
| ED-08 / KB-10 | `Ctrl+Enter` | body focused | press Ctrl+Enter | editor container focused | CanvasContainerComp.tsx:138-155 | COVERED |
| KB-20 | `Escape` (canvas) | box selected/editing | press Escape | `stopAllModes` — selection cleared / edit exited | slideEditingKeyboardEventHelpers.ts:231-233 | GAP |
| KB-21 | `Tab` / `Shift+Tab` | canvas focused | press Tab / Shift+Tab | selection cycles to next/prev canvas item (by id order) | slideEditingKeyboardEventHelpers.ts:234-257 | GAP |
| KB-22 | `Delete` / Meta+`Backspace` | box selected | press Delete | selected canvas items deleted | slideEditingKeyboardEventHelpers.ts:258-272 | GAP |
| KB-23 | `Ctrl+C` (canvas) | box selected | press Ctrl+C | toast "Copied / Items are copied" | slideEditingKeyboardEventHelpers.ts:273-288 | GAP |
| KB-24 | `Ctrl+V` (canvas) | item copied OR bible in clipboard | press Ctrl+V | copied items duplicated, else bible clipboard → new bible box | slideEditingKeyboardEventHelpers.ts:289-311 | GAP |
| KB-25 | `Ctrl+Shift+D` (canvas) | box selected | press Ctrl+Shift+D | selected items duplicated | slideEditingKeyboardEventHelpers.ts:312-326 | GAP |
| KB-26 | Arrow keys move box | box selected | press ↑/↓/←/→ (Ctrl = 2px fine, Shift = 200px coarse, plain = 20px) | selected box(es) move by offset×factor | canvasEditingHelpers.ts:70-100; CanvasController.ts:351-389,498-504 | GAP |
| KB-27 | `Ctrl+Z` undo (editor) | an edit made | press Ctrl+Z | last edit reverts (`historyUndo`) — works from canvas AND slide-list | slideEditingKeyboardEventHelpers.ts:16-32 | GAP |
| KB-28 | `Ctrl+Y` / `Ctrl+Shift+Z` redo | after undo | press redo combo | edit re-applies (`historyRedo`) | slideEditingKeyboardEventHelpers.ts:33-58 | GAP |
| KB-11 | `Ctrl+S` save (editor) | dirty | press Ctrl+S | `historySave` saves (also lyric/web/note editors) | slideEditingKeyboardEventHelpers.ts:59-74 | COVERED |

---

## L. Notes editors (editor bottom-of-canvas & document note)

| Proposed ID | Target | Interaction | Keys | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|---|
| ED-96 | `AppDocumentNoteEditorComp` (document note) | ⌨️✎ | — | canvas open | type in "Document Note" editor | text edits; auto-saves on unmount / `setNote` | AppDocumentNoteEditorComp.tsx:27-63 | GAP |
| ED-97 | `VarySlideNoteEditorComp` (per-slide note) | ⌨️✎ | — | slide selected | type in slide-note editor | per-slide note edits/saves | CanvasNoteContainerHandlerComp.tsx:36-49 | GAP |
| ED-98 | Note title dbl-click jump-to-top | 🖱️🖱️ | — | note panel | dbl-click the note title bar | panel scrolls into view (title "Double click to jump to top") | NoteEditorRenderComp.tsx:16-47 | GAP |
| ED-99 | Note/canvas splitters | ⇕ | — | canvas open | drag canvas↔note and doc-note↔slide-note dividers | panes resize; persist | SlideEditorCanvasComp.tsx:29-67; CanvasNoteContainerHandlerComp.tsx:12-52 | GAP (GL-12 generic) |

---

## M. Presenter → editor external open (already covered)

| Proposed ID | Target | Interaction | Given | When | Then (observable) | Source | Status |
|---|---|---|---|---|---|---|---|
| ED-10 | Presenter slide **Edit ↗** | 🖱️R → Edit | presenter page | slide menu → "Edit" (`bi-box-arrow-up-right`) | `openAppDocumentEditorExternal` opens editor window focused on that slide (`?file=…&id=…`) | appDocumentHelpers.tsx:176-192 | COVERED |

---

### Summary

Counts (editor area): **COVERED 13 · REFINE 2 · GAP 100**

(COVERED = existing matrix rows confirmed in editor scope: ED-01,03,04,05,06,07,08,
10,11,12 + KB-10, KB-11, PM-09. REFINE = 2. GAP = 100 new rows.)

- **REFINE**
  - ED-02 — editor selects on single click, not dbl-click-open
  - ED-09 — Canvas-Items tab misdescribed as add-box/drag-tool source
- **GAP — slide list & container**
  - ED-13 — no-slide-selected empty canvas state
  - ED-77/ED-78 — canvas/tools splitter; Properties/Canvas-Items tab bar
  - ED-79 — Ctrl/Shift multi-hold slide selection
  - ED-80 — attach background by dropping onto slide
  - ED-73 — drop media files → new slides
  - ED-67/68/69/70/82/75 — slide menu Copy/Move-fwd/Move-back/Enable-Disable/Show-on-screen/Color-note
  - ED-71 — multi-slide holding context menu
  - ED-72/83/84 — empty-list menu New Slide / Paste / Paste Image
- **GAP — canvas direct manipulation**
  - ED-46/47/85/86/49/50/48/87/88 — rotate handle, Ctrl/aspect resize, 8 handles, snapping, group drag, deselect-click, marquee, click-clear, locked box
- **GAP — rulers/zoom**
  - ED-44/45 — create/move/remove guide lines
  - ED-41/42/43 — scale slider, center-view, Ctrl+scroll zoom
- **GAP — canvas menus**
  - ED-51..57 — New / Insert Medias / Insert YouTube / Insert Website / Paste / Paste Image / Paste Bible
  - ED-76 — canvas media file drop
  - ED-58..66 — item menu Lookup/Lock/Copy/Duplicate/Reveal/Open-Copy URL/Download/Edit/Delete
- **GAP — text edit mode**
  - ED-89/90/91 — Escape cancel / Ctrl+Enter commit / right-click commit
- **GAP — Properties tab**
  - ED-14..19 — slide header, name+Apply, W/H, Apply/Reset/Apply-All dim
  - ED-20/21/22 — item card expand, Unlock, collapsible sections
  - ED-23..32 — bg color, X/Y, W/H, rotate+reset, alignment, glass, round %, round px, layer order, size-fit
  - ED-33..38 — text color, text align, font size, font family, font weight, text content
- **GAP — Canvas Items tab**
  - ED-39/40 — card select (green dashed) / card right-click menu
- **GAP — editing toolbar**
  - ED-92/93 — Undo / Redo buttons
  - ED-94 — Discard changed (Cancel only, EX-05)
  - ED-95 — Fix-dimension button
- **GAP — notes**
  - ED-96/97/98/99 — document note, per-slide note, title dbl-click, note splitters
- **GAP — keyboard**
  - KB-14..19 — slide-list Escape/Delete/Ctrl+A/Ctrl+C/Ctrl+V/Ctrl+Shift+D
  - KB-20..26 — canvas Escape/Tab-cycle/Delete/Ctrl+C/Ctrl+V/Ctrl+Shift+D/Arrow-move
  - KB-27/28 — Ctrl+Z undo / Ctrl+Y·Ctrl+Shift+Z redo
