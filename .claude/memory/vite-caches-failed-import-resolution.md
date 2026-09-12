---
name: vite-caches-failed-import-resolution
description: "Adding an import before creating the file makes the dev server 500 on the importer forever; touch vite.config.ts, not the importer"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8c7dbfa0-0489-4c4c-899b-1ef4e06fc0df
  modified: 2026-08-30T04:25:40.287Z
---

If you edit a module to `import './NewComp'` **before** the file exists, the dev
server caches the failed resolution and keeps answering the *importer* with a 500
(`Failed to resolve import "./NewComp" ... Does the file exist?`) even after you
create it. The browser only shows `[vite] Failed to reload <importer>.tsx`, which
reads as a syntax error in code that is in fact fine — `tsc --noEmit` passes and
the new file itself serves correctly over HTTP.

`touch`ing the importer does **not** clear it. Touching `vite.config.ts` does
(restarts the module graph). Confirm with
`curl -sk https://localhost:3000/src/<path>.tsx | head -3` — an HTML `<!DOCTYPE>`
error page instead of JS means it is still stale.

**Sibling case (2026-08-24): rewriting a file in place while Vite watches.**
A whole-file rewrite (heredoc, `>` redirect, a script that truncates then writes)
lets the watcher read the file at zero bytes, and Vite caches that EMPTY
transform under a pinned `?t=<stamp>` URL. The page then throws
`SyntaxError: The requested module '...Comp.tsx?t=...' does not provide an
export named 'default'` — and a plain reload does NOT clear it, because the
importer keeps requesting the same stamped URL. `grep 'export default'` on disk
shows the export is right there. Confirm with
`curl -sk 'https://localhost:3000/@fs/<abs path>?t=<stamp>'` — an empty body
with only a sourcemap comment is the cached truncation. Same fix: touch
`vite.config.ts`.

**Sibling case (2026-08-30): a stale transform that serves an OLD, VALID version
— the dangerous one, because nothing errors.** During QA of `src/graph-view/`
the dev server (started 17:26) kept serving the **pre-feature** transform of
`LocationNameDetailPanelsComp.tsx`, a file written at 19:52 and never
hot-updated. The served module had **0 occurrences** of
`OpenGraphPreviewButtonComp` while disk had 2, so the detail panel's
`bi-diagram-3` button was genuinely absent from the DOM. No 500, no empty
module, no console error — just an earlier working version of the component.
It **survived a full page reload** (the transform cache is server-side), and it
nearly went into a report as a Critical "feature not implemented".

Unlike the two cases above, `touch`ing the *source file itself* DID clear this
one (0 → 3 occurrences immediately, no dev-server restart needed) — worth trying
before `vite.config.ts`, since it does not disturb a user who is mid-edit.

Confirm from inside the page rather than with curl (no cert hassle):
`await (await fetch('/src/<path>.tsx?t=' + Date.now())).text()` then grep the
symbol you expect. A cache-busting query busts the BROWSER cache only, so a hit
here really is what the server holds.

**Why:** it looks like a code bug and sends you auditing a correct file — or, in
the silent variant, like an unimplemented feature.

**How to apply:** create the new file first, then add the import — or, once
stuck, touch `vite.config.ts` and reload. **When a feature that exists on disk
appears missing in the running app, fetch the SERVED module and grep it before
concluding anything** — especially after HMR delivered a feature into a renderer
that was loaded at an older commit. Same family as
[[vite-dep-optimizer-504-restart]] (a 504 on a `.vite/deps` chunk), and the
reload it forces is the kind described in [[dev-hmr-stale-state-qa]].
