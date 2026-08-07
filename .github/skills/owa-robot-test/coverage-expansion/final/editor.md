# Editor coverage — finalized rows (ED-13 .. ED-39)

Part scope: **tool-panel controls · box move/resize/rotate via pointer · canvas
zoom/scale · undo/redo BUTTONS · entry-guard states.** Pure ⌨️ shortcut paths are
left to **KB**; context-menu ITEM paths are left to **CM**; slide-list
selection/reorder/drop, ruler/guide creation, notes editors, and file-drop-to-add
are other parts. Families consolidated to one row each per the brief (e.g. one
alignment row, one font row, one undo/redo row).

Legend: 🖱️ click · 🖱️🖱️ dblclick · 🖱️R right-click · ⇕ drag-drop · ⌨️ key ·
🎚️ slider · ⌨️✎ input · 🖐️ hover.

## ED additions

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| ED-13 | `SlideEditorGroundComp` entry/empty state (src: src/slide-editor/SlideEditorGroundComp.tsx:10) | observe: editor mounted but no slide selected for editing (`selectedSlideEditing` null) (src: src/slide-editor/SlideEditorGroundComp.tsx:10) | renders the "No slide selected" placeholder with NO canvas/tool panel mounted; picking a slide swaps it to the canvas (src: src/slide-editor/SlideEditorGroundComp.tsx:10-13) |
| ED-14 | `SlideEditorToolsComp` tab bar — Properties / Canvas Items (src: src/slide-editor/canvas/tools/SlideEditorToolsComp.tsx:47) | 🖱️ each tab (src: src/slide-editor/canvas/tools/SlideEditorToolsComp.tsx:48-57) | active tab highlights; body swaps `SlideEditorPropertiesComp` ↔ `ToolCanvasItemsComp`; choice persists across reload (`editor-tools-tab`) (src: src/slide-editor/canvas/tools/SlideEditorToolsComp.tsx:37-70) |
| ED-15 | Tool-panel collapsible section headers (slide header, item-props card, Box/Text Properties titles) (src: src/slide-editor/canvas/tools/SlideEditorToolTitleComp.tsx:30) | 🖱️ a section header / chevron (src: src/slide-editor/canvas/tools/useExpandToggle.tsx:36-45) | body shows/hides; chevron flips `bi-chevron-down`↔`bi-chevron-right`; expand state persists (`slide-property-editor`/`canvas-item-props-editor`) (src: src/slide-editor/canvas/tools/SlidePropertyEditorComp.tsx:250-267; src/slide-editor/canvas/tools/CanvasItemPropsEditorComp.tsx:96-110) |
| ED-16 | Slide name input + Apply (`SlidePropertyEditorComp`) (src: src/slide-editor/canvas/tools/SlidePropertyEditorComp.tsx:199) | ⌨️✎ type a new name → 🖱️ Apply (src: src/slide-editor/canvas/tools/SlidePropertyEditorComp.tsx:199-237) | Apply button appears only while the name differs; clicking it renames the slide (`updateSlide`) and the button clears (src: src/slide-editor/canvas/tools/SlidePropertyEditorComp.tsx:199-237) |
| ED-17 | Slide dimension controls — Width/Height + Apply / Reset / Apply All Slides (src: src/slide-editor/canvas/tools/SlidePropertyEditorComp.tsx:51) | ⌨️✎ Width/Height; 🖱️ Apply; 🖱️ Reset; 🖱️ Apply All Slides → confirm "Yes" (src: src/slide-editor/canvas/tools/SlidePropertyEditorComp.tsx:114-190) | Apply/Reset show only when dim differs; Apply → this slide re-sizes (`changeSlidesDimension`); Reset → default-display bounds; Apply All Slides → confirm popup, on Yes every slide takes the dim (src: src/slide-editor/canvas/tools/SlidePropertyEditorComp.tsx:114-190) |
| ED-18 | Canvas-item **Unlock** button (`CanvasItemPropsEditorComp`) (src: src/slide-editor/canvas/tools/CanvasItemPropsEditorComp.tsx:118) | 🖱️ Unlock on the 🔒 row of a locked selected box (src: src/slide-editor/canvas/tools/CanvasItemPropsEditorComp.tsx:118-127) | box unlocks; the box/text property editors re-appear for it (src: src/slide-editor/canvas/tools/CanvasItemPropsEditorComp.tsx:83-127) |
| ED-19 | Box Position/Size/Rotate numeric inputs + rotate Reset (`BoxPositionSizeComp`) (src: src/slide-editor/canvas/tools/BoxPositionSizeComp.tsx:44) | ⌨️✎ X(left)/Y(top); ⌨️✎ W/H (min 1); ⌨️✎ Rotate deg; 🖱️ rotate Reset (`bi-arrow-counterclockwise`) (src: src/slide-editor/canvas/tools/BoxPositionSizeComp.tsx:44-101) | box moves / resizes / rotates to the typed values (rotate normalized 0–360); Reset sets rotate back to 0° (src: src/slide-editor/canvas/tools/BoxPositionSizeComp.tsx:44-101) |
| ED-20 | Box **alignment** button group — vertical + horizontal (`SlideEditorToolAlignComp` via Box tools) (src: src/slide-editor/canvas/tools/SlideEditorToolsBoxComp.tsx:161) | 🖱️ each of top/mid/bottom + left/center/right (src: src/slide-editor/canvas/tools/SlideEditorToolAlignComp.tsx:84-142) | box repositions to that canvas edge/center; the active button is `disabled` and solid `btn-info` (others `btn-outline-info`) (src: src/slide-editor/canvas/tools/SlideEditorToolAlignComp.tsx:36-44) |
| ED-21 | Box **background color** picker (`SlideEditorToolsColorComp` in Box tools) (src: src/slide-editor/canvas/tools/SlideEditorToolsBoxComp.tsx:149) | 🖱️ pick a color / 🖱️ "no color" (src: src/slide-editor/canvas/tools/SlideEditorToolsBoxComp.tsx:131-157) | `backgroundColor` prop changes and the box repaints (debounced); control is hidden for media boxes (src: src/slide-editor/canvas/tools/SlideEditorToolsBoxComp.tsx:139-157) |
| ED-22 | Box **Shape Properties** — Glass Effect / Round % slider / Round px (`ShapePropertiesComp`) (src: src/slide-editor/canvas/tools/ShapePropertiesComp.tsx:40) | ⌨️✎ Glass Effect px; 🎚️ Round % (0–100); ⌨️✎ Round Size Pixel (src: src/slide-editor/canvas/tools/ShapePropertiesComp.tsx:40-93) | box gains backdrop blur; corners round by % or px; setting Round px > 0 disables/greys the Round % slider (src: src/slide-editor/canvas/tools/ShapePropertiesComp.tsx:51-93) |
| ED-23 | Box **Layer order** buttons (`LayerComp` in Box tools) (src: src/slide-editor/canvas/tools/SlideEditorToolsBoxComp.tsx:80) | 🖱️ Send backward (`bi-layer-backward`) / Bring forward (`bi-layer-forward`) (src: src/slide-editor/canvas/tools/SlideEditorToolsBoxComp.tsx:106-121) | box z-order reorders within `canvasItems` (`applyOrderingData`); a stacked box visibly moves under/over its neighbor (src: src/slide-editor/canvas/tools/SlideEditorToolsBoxComp.tsx:85-98) |
| ED-24 | Box **Size fit** buttons — Full / Original Size / Strip (`SizingComp`) (src: src/slide-editor/canvas/tools/SlideEditorToolsBoxComp.tsx:18) | 🖱️ Full; 🖱️ Original Size; 🖱️ Strip (media items only) (src: src/slide-editor/canvas/tools/SlideEditorToolsBoxComp.tsx:47-74) | box resizes to fit-canvas / natural size / media strip respectively; Strip button only present on media boxes (src: src/slide-editor/canvas/tools/SlideEditorToolsBoxComp.tsx:24-38) |
| ED-25 | **Text color** picker (`SlideEditorToolsTextComp`) (src: src/slide-editor/canvas/tools/SlideEditorToolsTextComp.tsx:33) | 🖱️ pick a text color (src: src/slide-editor/canvas/tools/SlideEditorToolsTextComp.tsx:33-42) | `color` prop changes and the glyphs recolor live (src: src/slide-editor/canvas/tools/SlideEditorToolsTextComp.tsx:33-42) |
| ED-26 | **Text alignment** button group — vertical + text-horizontal (src: src/slide-editor/canvas/tools/SlideEditorToolsTextComp.tsx:43) | 🖱️ top/mid/bottom + text-left/center/right (`bi-text-*`) (src: src/slide-editor/canvas/tools/SlideEditorToolAlignComp.tsx:101-124) | `textVerticalAlignment`/`textHorizontalAlignment` set; text realigns; active button `disabled`+solid `btn-info` (src: src/slide-editor/canvas/tools/SlideEditorToolAlignComp.tsx:36-44) |
| ED-27 | **Font controls** — size (input+select), family, weight/style (`ToolsTextFontControlComp`) (src: src/slide-editor/canvas/tools/ToolsTextFontControlComp.tsx:30) | ⌨️✎/🖱️ font size (15–300 select or typed); 🖱️ font family; 🖱️ weight/style (src: src/others/FontSizeControlComp.tsx:21-44; src/others/FontFamilyControlComp.tsx:56-127) | `fontSize`/`fontFamily`/`fontWeight` change and text restyles; a configured-but-absent font shows "X (Missing)" (informative); weight/style select appears only when the family exposes weights (src: src/others/FontFamilyControlComp.tsx:26-127) |
| ED-28 | **Text content** textarea (`SlideEditorToolsTextContentComp`) (src: src/slide-editor/canvas/tools/SlideEditorToolsTextContentComp.tsx:9) | ⌨️✎ type in the "Text" textarea (src: src/slide-editor/canvas/tools/SlideEditorToolsTextContentComp.tsx:9-35) | `text` prop updates and the box text changes WITHOUT entering canvas text-edit mode (src: src/slide-editor/canvas/tools/SlideEditorToolsTextContentComp.tsx:9-35) |
| ED-29 | Box **rotate handle** (pointer) (src: src/slide-editor/canvas/box/BoxEditorControllingModeComp.tsx:164) | ⇕ drag the `.rotate` rotator handle (src: src/slide-editor/BoxEditorController.ts:666-699) | box `transform: rotate(Ndeg)` updates live; drag badge shows `N°`; on release commits to `props.rotate` (src: src/slide-editor/BoxEditorController.ts:666-699) |
| ED-30 | Box **resize handles + modifiers** — 8 handles, Ctrl-center, aspect-lock (pointer) (src: src/slide-editor/canvas/box/BoxEditorControllingModeComp.tsx:167) | ⇕ drag each of 4 edge-mid + 4 corner handles; ⇕ with Ctrl held; ⇕ on an aspect-locked item (src: src/slide-editor/BoxEditorController.ts:291-342) | each handle resizes its edge(s), cursor rotates with the box angle; Ctrl → both edges move about a fixed center; aspect-locked item keeps ratio (src: src/slide-editor/BoxEditorController.ts:198-246,739-742) |
| ED-31 | **Multi-select group drag** (pointer) (src: src/slide-editor/canvas/box/BoxEditorControllingModeComp.tsx:104) | ⇕ drag one of ≥2 selected boxes (src: src/slide-editor/BoxEditorController.ts:484-611) | the whole selection moves together as ONE undo step; the live badge lists every dragged box (src: src/slide-editor/BoxEditorController.ts:484-611) |
| ED-32 | **Snap-to-edge/guide** while dragging (pointer) (src: src/slide-editor/canvas/CanvasGuideLineComp.tsx:45) | ⇕ drag a box near another box edge/center or a guide line (src: src/slide-editor/BoxEditorController.ts:850-937) | a cyan snap line (`#00c8ff`) appears and the box position snaps to it (≈8px/scale threshold) (src: src/slide-editor/BoxEditorController.ts:850-937) |
| ED-33 | **Locked box** — indicator + drag refused (pointer) (src: src/slide-editor/canvas/box/BoxEditorControllingModeComp.tsx:72) | 🖱️/⇕ try to move or 🖱️🖱️ a locked box (src: src/slide-editor/canvas/box/BoxEditorControllingModeComp.tsx:157-160) | box shows the `.locked-indicator` 🔒 (title "Locked"); no resize/rotate handles render; move-drag and dbl-click no-op (src: src/slide-editor/canvas/box/BoxEditorControllingModeComp.tsx:72-79) |
| ED-34 | Empty-canvas pointer — click clears / drag marquee-selects (src: src/slide-editor/canvas/canvas-container/BodyRendererComp.tsx:159) | 🖱️ quick click empty canvas (<500ms,<10px); ⇕ press+drag a rectangle on empty canvas (src: src/slide-editor/canvas/canvas-container/BodyRendererComp.tsx:266-305) | click → `stopAllModes` (selection cleared / edit exited); drag → blue marquee rect `rgba(74,163,255,.25)` draws and boxes inside get selected on release (Shift/Ctrl append) (src: src/slide-editor/canvas/canvas-container/BodyRendererComp.tsx:159-288) |
| ED-35 | **Canvas scale/zoom** — scale slider + center-view + Ctrl+scroll (src: src/slide-editor/canvas/tools/SlideEditorCanvasScalingComp.tsx:38) | 🎚️ scale range (1–20); 🖱️ center-view (`bi-border-middle`); ⌨️ Ctrl+scroll over the canvas (src: src/slide-editor/canvas/tools/SlideEditorCanvasScalingComp.tsx:31-45) | `NN.Nx` label updates and the canvas rescales (persists `canvas-editor-scale`); center-view scrolls the canvas to center; Ctrl+scroll changes scale over the same range (src: src/slide-editor/canvas/canvas-container/CanvasContainerComp.tsx:114-133; src/slide-editor/canvas/SlideEditorCanvasComp.tsx:110-116) |
| ED-36 | **Canvas Items** tab — card select (`ToolCanvasItemsComp`) (src: src/slide-editor/canvas/tools/ToolCanvasItemsComp.tsx:49) | 🖱️ click a preview card (Shift/Ctrl to append) (src: src/slide-editor/canvas/tools/ToolCanvasItemsComp.tsx:49-56) | that item is selected on the canvas → card gets a `2px dashed green` border; Shift/Ctrl adds to the selection set (src: src/slide-editor/canvas/tools/ToolCanvasItemsComp.tsx:49-56) |
| ED-37 | **Undo / Redo** toolbar buttons (`FileEditingMenuComp`) (src: src/editing-manager/editingHelpers.tsx:158) | 🖱️ Undo (`bi-arrow-90deg-left`); 🖱️ Redo (`bi-arrow-90deg-right`) (src: src/editing-manager/editingHelpers.tsx:158-179) | Undo reverts the last edit and the props panel re-syncs; Redo re-applies it; each button disables at its history end; the toolbar is present only when `canUndo||canRedo||canSave` (src: src/editing-manager/editingHelpers.tsx:158-179) |
| ED-38 | **Discard changed** toolbar button — Cancel only, EX-05 (src: src/editing-manager/editingHelpers.tsx:87) | 🖱️ Discard (`bi-x-octagon`, btn-danger) → confirm popup → 🖱️ **Cancel** (never "Yes" per CLAUDE.md) (src: src/editing-manager/editingHelpers.tsx:87-117) | the "Discard changed" confirm popup appears; Cancel closes it leaving the document unchanged and the undo/redo stack intact (src: src/editing-manager/editingHelpers.tsx:87-117) |
| ED-39 | **Fix-dimension** toolbar button (`SlidesMenuComp`) (src: src/app-document-presenter/items/SlidesMenuComp.tsx:36) | 🖱️ the warning button (`bi-hammer`+`bi-aspect-ratio`), shown only when a slide dim ≠ display (src: src/app-document-presenter/items/SlidesMenuComp.tsx:36-49) | `fixSlidesDimensionForDisplay` corrects the slide dimensions to the display and the warning button clears (src: src/app-document-presenter/items/SlidesMenuComp.tsx:36-49) |

### REFINE

Existing rows that this finalization touches (each cites the source proving the fix):

- **ED-02** — reword: the editor slide list selects-to-edit on a **single click**
  (single-click-to-edit); the current "🖱️🖱️ open" wording is wrong for the editor
  context (that is presenter behavior). (src: src/app-document-presenter/items/VarySlideRenderWrapperComp.tsx:34-53)
- **ED-05** — extend: covers select/move/edge-resize but omits the **rotate handle**;
  pointer rotate is now split out as ED-29 — cross-link so the editor pass exercises
  rotation. (src: src/slide-editor/BoxEditorController.ts:666-699)
- **ED-06** — extend: covers Shift/Ctrl-click to ADD to selection but not that
  Shift/Ctrl-clicking an **already-selected** box REMOVES it (toggle-off). (src: src/slide-editor/canvas/box/BoxEditorControllingModeComp.tsx:57-65)
- **ED-09** — correct: "add box; drag tool → canvas" **misdescribes** the Canvas Items
  tab. It is a per-item preview/**select** list (now ED-36), NOT an add-box/drag-tool
  source. There is **no tool-panel add-box/insert-image control** — add-box is the
  canvas context menu (CM) "New" and insert-image is Insert Medias (CM) or a file drop;
  so the brief's "add box/image" has no in-scope tool-panel row. (src: src/slide-editor/canvas/tools/ToolCanvasItemsComp.tsx:17-95)
- **GL-12** — name the editor's own persisted splitters (canvas↔tools
  `resizeSettingNames.slideEditor`, and canvas↔note) so the generic splitter row is
  actually driven in the editor; no separate ED row created. (src: src/slide-editor/SlideEditorComp.tsx:17-56)

### COUNTS

- **New rows added: 27** (ED-13 → ED-39, sequential, no gaps).
- **Last ID used: ED-39** (assigned range ED-13..ED-69; 30 IDs left unused).
- **REFINE items: 5** (ED-02, ED-05, ED-06, ED-09, GL-12).
- **Consolidations applied (families → 1 row):** box alignment group (ED-20),
  text alignment group (ED-26), font size/family/weight (ED-27), Shape Properties
  glass/round%/round-px (ED-22), slide-dimension Apply/Reset/Apply-All (ED-17),
  collapsible section headers ×3 locations (ED-15), 8 resize handles + Ctrl/aspect
  modifiers (ED-30), empty-canvas click-clear + marquee (ED-34), scale slider +
  center-view + Ctrl+scroll (ED-35), Undo+Redo (ED-37).
- **Deferred to other parts (not counted here):** pure ⌨️ shortcuts (slide-list
  KB-14..19, canvas KB-20..28) → **KB**; every context-menu ITEM (slide-item menu,
  empty-canvas menu New/Insert/Paste, canvas-item menu Lookup/Lock/Copy/… ) → **CM**;
  slide-list select/reorder/attach-bg/media-drop, ruler→guide create/move/remove,
  document/slide note editors, and text-edit-mode exits → their respective parts.
