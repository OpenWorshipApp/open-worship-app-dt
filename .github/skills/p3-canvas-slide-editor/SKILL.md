---
name: p3-canvas-slide-editor
description: 'Open Worship P3 canvas slide editor workflow. Use when working on BoxEditorController, CanvasController, canvas items, drag or resize or rotate behavior, selection, clipboard, context menus, property tools, quick-edit popup, note panes, or slide-editor rendering.'
argument-hint: 'Optional focus area, for example: geometry, selection, item-type, tools, popup, notes, or rendering.'
user-invocable: true
---

# P3 Canvas Slide Editor

Use this skill for tasks centered on the visual slide editor in `src/slide-editor/` and its presenter/app-document integration.

## When to Use

- You are changing drag, resize, move, rotate, or selection behavior.
- You are adding or modifying text, image, video, or Bible canvas item behavior.
- You are changing the property tool panel, canvas-item list, context menus, or keyboard shortcuts.
- You are working on the quick-edit popup, note panes, or slide-editor layout.
- You need editor behavior to stay consistent with presenter or preview rendering.

## Procedure

1. Read [p3-canvas-slide-editor-guide.md](./references/p3-canvas-slide-editor-guide.md).
2. Classify the change before editing:
   - Geometry or direct-manipulation logic: `BoxEditorController.ts` and `canvas/box/`
   - Canvas state, clipboard, ordering, or item CRUD: `canvas/CanvasController.ts`, `canvas/Canvas.ts`, `canvas/CanvasItem.ts`
   - Item models or rendering: `canvas/CanvasItem*.ts`, `CanvasItemRendererComp.tsx`, preview renderers
   - Tool panel or properties UI: `canvas/tools/`
   - Shell, popup, note, or presenter integration: `SlideEditorComp.tsx`, `SlideEditorPopupComp.tsx`, `SlideEditorGroundComp.tsx`, `note/`, `app-document-presenter/`
3. Preserve core invariants:
   - Selection follows canvas item IDs, not object identity.
   - `canvas.canvasItems` serializes back to `slide.canvasItemsJson`.
   - Property changes should flow through `canvasController.applyEditItem()`.
   - New item types must be supported in both editor and preview rendering paths.
4. For tool-panel and renderer styling work, check Bootstrap utility classes and existing Bootstrap-style patterns before adding new SCSS. Add custom styles only when Bootstrap cannot express the requirement cleanly.
5. Validate with manual editor flows first. Use targeted checks while iterating, but after code changes finish with `npm run lint` as the default validation source unless the task is documentation-only or the user explicitly asks for a narrower check.

## References

- [p3-canvas-slide-editor-guide.md](./references/p3-canvas-slide-editor-guide.md)
