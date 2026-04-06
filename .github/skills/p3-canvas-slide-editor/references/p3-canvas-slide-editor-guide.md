# P3 Canvas Slide Editor Guide

## Scope

This guide covers the visual slide editor centered on `src/slide-editor/`. It is the right reference for tasks that change canvas-item behavior, direct manipulation, selection/editing modes, slide-editor tool panels, quick-edit popup behavior, or note editing tied to slides and app documents.

## Main Entry Points

### Main editor panel

- `src/app-document-editor/AppDocumentEditorRightComp.tsx` mounts `SlideEditorGroundComp` in the document editor right pane.
- `src/slide-editor/SlideEditorGroundComp.tsx` guards against empty selection and renders `SlideEditorComp` only when a slide is selected.

### Quick-edit popup

- `src/app-document-presenter/SlideEditHandlerComp.tsx` opens and closes popup editing for a specific slide.
- `src/slide-editor/SlideEditorPopupComp.tsx` wraps `SlideEditorComp` in a modal and provides its own `SelectedEditingSlideContext`.

### Core editor shell

- `src/slide-editor/SlideEditorComp.tsx` is the top-level editor shell.
- It splits the UI into canvas on the left and tools on the right through `ResizeActorComp`.
- `src/slide-editor/canvas/SlideEditorCanvasComp.tsx` adds the canvas footer, zoom control, slide menu, and note area.

## Core Model and State Flow

### Selected slide to canvas controller

- `src/slide-editor/canvasEditingHelpers.ts` turns the selected slide into a `CanvasController` plus React contexts.
- The same module keeps selection and editing state aligned when canvas items are recreated from JSON.

### Data ownership

- `src/slide-editor/canvas/Canvas.ts` is the bridge between the `Slide` model and runtime canvas items.
- `Canvas.canvasItems` reads from and writes to `slide.canvasItemsJson`.
- `Canvas.canvasItemFromJson()` is the central type-dispatch point for all canvas item kinds.

### Canvas controller responsibilities

- `src/slide-editor/canvas/CanvasController.ts` owns canvas CRUD, ordering, movement, scale persistence, clipboard offsetting, media insertion, and update/reload events.
- It also exposes editor-wide helpers such as `toCenterView`, `onArrowing`, and `applyCanvasItemFully()`.

## Canvas Item Types

### Base model

- `src/slide-editor/canvas/CanvasItem.ts` defines shared geometry and styling props such as `id`, `top`, `left`, `rotate`, `width`, `height`, and box/background settings.
- Selection identity relies on `id` through `checkIsSame()`.

### Concrete item types

- `src/slide-editor/canvas/CanvasItemText.ts`: text and HTML-like text item behavior.
- `src/slide-editor/canvas/CanvasItemImage.ts`: image item creation from file paths or blobs.
- `src/slide-editor/canvas/CanvasItemVideo.ts`: video-backed item model.
- `src/slide-editor/canvas/CanvasItemBibleItem.ts`: Bible-rendered item model.
- Unknown or invalid data falls back to `CanvasItemError`.

### If you add a new item type

1. Add the new type to `canvas/canvasHelpers.ts`.
2. Create a `CanvasItem*` implementation.
3. Register deserialization in `Canvas.canvasItemFromJson()`.
4. Update item rendering in editor and preview paths.
5. Check tool-panel and context-menu behavior if the new type is editable.

## Direct Manipulation and Canvas Events

### Box geometry and handles

- `src/slide-editor/BoxEditorController.ts` contains the resize, move, and rotate math.
- This file is the main target for tasks involving rotated resize behavior, min-size rules, drag offsets, and coordinate math.

### Canvas container event wiring

- `src/slide-editor/canvas/CanvasContainerComp.tsx` handles empty-canvas mouse clearing, drag-and-drop, right-click on the canvas, scale-aware layout, and center-view behavior.
- It renders every item through `BoxEditorComp` under shared contexts.

### Context menus

- `src/slide-editor/canvas/canvasContextMenuHelpers.ts` owns the empty-canvas menu and canvas-item menu.
- Empty-canvas menu includes new text item, paste, insert medias, and clipboard image paste.
- Item menu includes copy, duplicate, edit when supported, and delete.

### Keyboard behavior

- `src/slide-editor/slideEditingKeyboardEventHelpers.ts` owns canvas shortcuts and slide-list shortcuts.
- Canvas shortcuts include escape, tab cycling, delete, copy, paste, duplicate, undo, redo, and save.
- Slide-list shortcuts for higher-level slide management live in the same file, so avoid changing those when the task is item-only.

## Tool Panel and Properties

### Tool panel shell

- `src/slide-editor/canvas/tools/SlideEditorToolsComp.tsx` switches between Properties and Canvas Items tabs.

### Item property editing

- `src/slide-editor/canvas/tools/CanvasItemPropsEditorComp.tsx` batches property edits and commits them back through `canvasController.applyEditItem()`.
- Box-related tooling and text-related tooling live under `src/slide-editor/canvas/tools/`.

### Common files for property changes

- Box or shared item props: `src/slide-editor/canvas/CanvasItem.ts`, `src/slide-editor/canvas/canvasHelpers.ts`, `src/slide-editor/canvas/tools/SlideEditorToolsBoxComp.tsx`
- Text props: `src/slide-editor/canvas/CanvasItemText.ts`, `src/slide-editor/canvas/tools/SlideEditorToolsTextComp.tsx`, `src/slide-editor/canvas/tools/ToolsTextFontControlComp.tsx`
- Canvas-level settings: `src/slide-editor/canvas/tools/SlideEditorCanvasScalingComp.tsx`

## Notes and Secondary Editors

- `src/slide-editor/note/CanvasNoteContainerHandlerComp.tsx` splits note editing into app-document note plus slide note.
- `src/slide-editor/note/AppDocumentNoteEditorComp.tsx` loads, updates, and saves document-level notes.
- Popup editing uses the same `SlideEditorComp`, so layout changes often affect both the full editor and quick-edit modal.

## Rendering Consistency Outside the Editor

- `src/app-document-presenter/items/SlideRendererComp.tsx` renders `canvasItemsJson` using the same canvas item model logic as the editor.
- `src/slide-editor/CanvasItemRendererComp.tsx` is part of the shared rendering path.
- If a change only updates editor UI but not preview rendering, you likely missed one of these shared render files.

## Change Routing Guide

### Change drag, resize, rotate, or move behavior

- Start with `src/slide-editor/BoxEditorController.ts`.
- Then verify any related handle or mode component under `src/slide-editor/canvas/box/`.

### Add or change a keyboard shortcut

- Edit `src/slide-editor/slideEditingKeyboardEventHelpers.ts`.
- Check whether the shortcut belongs to canvas-item behavior or slide-list behavior.

### Add or change a context-menu command

- Edit `src/slide-editor/canvas/canvasContextMenuHelpers.ts`.
- If the command changes item state, route the final mutation through `CanvasController`.

### Add a new property control

- Update the relevant item model.
- Update the tool component under `src/slide-editor/canvas/tools/`.
- Make sure the property is serialized by `toJson()` and accepted by `fromJson()`.

### Add a new item type

- Update `CanvasItem` model files, `Canvas.ts`, renderers, tools, and any insertion flow.
- Check both editor rendering and presenter preview rendering.

### Change note or popup behavior

- For modal/popup behavior, edit `src/slide-editor/SlideEditorPopupComp.tsx` and `src/app-document-presenter/SlideEditHandlerComp.tsx`.
- For note layout or persistence, edit the `src/slide-editor/note/` files.

## Important Invariants

- Item identity is ID-based. Selection recovery depends on stable `props.id` values.
- `Canvas.canvasItems` recreates runtime objects from JSON, so object identity is not stable across refreshes.
- Property changes are expected to flow through `canvasItem.applyProps()` and then `canvasController.applyEditItem()`.
- Preview rendering depends on the same item JSON, so data shape changes must stay backward-compatible or be migrated carefully.

## Known Gotchas

- There are no slide-editor-specific tests currently in `src/slide-editor/**/*.test.ts*`, so manual regression checking matters.
- Drag-and-drop support is narrower than file-picker insertion: `checkIsSupportMediaType()` currently allows only image mime types, even though the file picker flow in `CanvasController.genNewMediaItemFromFilePath()` supports both image and video.
- Canvas scale is persisted under the shared setting name `canvas-editor-scale`, so full editor and popup editor can affect the same saved zoom value.
- `CanvasController.duplicateItems()` mutates incoming item IDs and offsets before re-adding them. Be careful when reusing objects versus cloning them.
- The popup editor gets its own `SelectedEditingSlideContext`; verify popup and full-editor behavior separately after layout or state changes.

## Validation Checklist

After changing this area, manually verify at least these flows:

1. Open the main document editor and edit a selected slide.
2. Select an item, drag it, resize it, and rotate it.
3. Use context-menu actions on both empty canvas and selected items.
4. Copy, paste, duplicate, delete, undo, redo, and save.
5. Check the properties panel still updates the selected item correctly.
6. Open quick edit from the presenter flow and verify the same change path there.
7. Confirm the presenter preview still renders the edited slide correctly.
8. If media insertion changed, test file-picker insertion, clipboard image paste, and drag-drop separately.

Use `npm run test` for renderer regressions and `npm run build` when the change affects rendering, editor integration, or shared item serialization.
