---
name: static-render-must-not-parse-html
description: "Nothing inside renderToStaticMarkup may parse HTML (sanitizeHtml, DOMParser): React runs off Node's setImmediate here, so Chromium's parser runs waiting promise callbacks mid-call, and one that renders another slide wipes the first render's hook state — Cannot set properties of null (setting 'memoizedState')"
metadata:
  node_type: memory
  type: project
  originSessionId: fa306189-6064-44b2-9e6b-1cda1ea80f80
  modified: 2026-10-11T23:56:42.038Z
---

**A `renderToStaticMarkup` must finish without anything inside it parsing
HTML** (2026-10-11). Every window here has `nodeIntegration: true`, so React's
scheduler picks Node's `setImmediate`, and every render and effect runs on a
stack V8 counts as outside any microtask scope. On such a stack Chromium's HTML
parser runs every waiting promise callback BEFORE
`DOMParser.parseFromString` returns. Measured in an isolated Electron 44
(Chrome 152): from `setImmediate`, for nearly any markup beyond plain inline
text (`<style>`, `<img>`, `<svg>`, `<details>`, an unknown element); never from
`setTimeout` or a `MessageChannel` task, which is why no browser test and no
jsdom test ever sees it. DOMPurify parses with `DOMParser`, so `sanitizeHtml`
and `sanitizeSlideHtml` are such calls.

The crash it caused: EN-39 (`efedb3b0`, 2026-10-05) put
`useMemo(() => sanitizeHtml(props.html))` in `BoxEditorNormalHtmlRenderComp`
and `BoxEditorNormalBibleRenderComp`, which `genSlideHtml` renders statically. A
waiting callback that rendered ANOTHER slide ran inside the outer `useMemo`;
the inner render reset the server renderer's module-level hook cursor, and the
outer one then wrote to null — `TypeError: Cannot set properties of null
(setting 'memoizedState')`, and the app's "Reload is needed". It was
intermittent because it needs a second slide render waiting on a promise at
that instant; the mini screen and a slide list supply one.

The fix: `genSlideHtml` builds the canvas items and runs the raw policy on
each item's markup BEFORE the static render (`genSlideItems`), and hands the
result down through `CanvasItemSafeHtmlContext`
(`src/slide-editor/canvas/canvasItemSafeHtmlHelpers.ts`).
`useCanvasItemSafeHtml` sanitizes in a memo only when nothing was provided,
which is the editor's client render — safe, because React's client guards
itself (`scheduleImmediateRootScheduleTask` defers when its microtask lands
inside a render or a commit). The server renderer has no such guard.

**Why:** reported by the user with that TypeError on 2026-10-11. A stack cut
at ten frames had first pointed at a second copy of React; the full one showed
an app `setValue` running directly on top of DOMPurify's `_initDocument`.

**How to apply:** in a component any `renderToStaticMarkup` reaches (`grep
renderToStaticMarkup src`), never call a sanitizer or `DOMParser` in the body
or in a hook. Do it before the render — a JSX prop written at the call site is
before — or after it. A sanitizer call in a plain client component is fine.
`basicItems.coverage.test.tsx` holds it (_a slide rendered from inside the
sanitizer leaves the one in flight intact_): it throws the same TypeError on
the old shape. To see the parser's behaviour itself, call it from a
`setImmediate` callback in an offscreen `BrowserWindow` with `nodeIntegration`;
[[document-html-sanitization]] is the policy this render path serves.
