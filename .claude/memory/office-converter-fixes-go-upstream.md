---
name: office-converter-fixes-go-upstream
description: "A PPTX/DOCX preview problem that lives in the converted HTML is fixed in the user's converter repo (pptx-in-html-out, C# + JS port), not by rewriting that HTML in the app"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 856d4cd1-e9b6-4e4e-813d-848691398e74
  modified: 2026-11-20T13:46:07.863Z
---

2026-11-20, the user, after an app-side fix that rewrote each slide's inline
`font-family` in `HtmlSlideRenderComp`: _slide animation is broken, revert
this_, then _I prefer fix in …/pptx-in-html-out instead_ (a sibling
checkout, `../pptx-in-html-out`), then _make pptx-to-html-conv and docx-to-html-conv to accept a param
for default font-family_. The app change was reverted. The converters gained
`defaultFontFamily` instead (see [[app-default-font-google-sans]] and
[[pptx-converter-file-dependency]]).

**Why:** the converter is the user's own package, and the HTML it writes is
the contract. Post-processing it in the renderer sits on top of every slide,
step and animation, so when slides misbehave the app's rewrite is the first
suspect. It also leaves the iframe fallback and any other consumer unfixed.

**How to apply:**

- When converted HTML is wrong (a font list, a missing feature, layout), change
  `pptx-in-html-out`.
- Its `.claude/CLAUDE.md` rules apply: change C# and the JS port together with
  byte-identical output, and bump the version on both sides.
- In the app, change only what the app passes to `exportPptx` / `exportDocx`
  (`electron/msHelpers.ts`).
- Prove a new option changes nothing else. Export once with it and once
  without, remove the inserted text, and compare byte for byte.
- On Windows, C# writes CRLF and JS writes LF, so compare C# against JS
  ignoring `\r`.
