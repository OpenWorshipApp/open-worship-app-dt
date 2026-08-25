---
name: vite-caches-failed-import-resolution
description: "Adding an import before creating the file makes the dev server 500 on the importer forever; touch vite.config.ts, not the importer"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8c7dbfa0-0489-4c4c-899b-1ef4e06fc0df
  modified: 2026-08-24T20:12:00.000Z
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

**Why:** it looks like a code bug and sends you auditing a correct file.

**How to apply:** create the new file first, then add the import — or, once
stuck, touch `vite.config.ts` and reload. Same family as
[[vite-dep-optimizer-504-restart]] (a 504 on a `.vite/deps` chunk), and the
reload it forces is the kind described in [[dev-hmr-stale-state-qa]].
