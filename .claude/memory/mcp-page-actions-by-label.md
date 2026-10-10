---
name: mcp-page-actions-by-label
description: "owa_click right/double, owa_press_key, owa_drag, owa_menu, owa_scroll and owa_presenting_flow (2026-10-10): the user's goal is that the MCP can automate everything a user does on the page, bar security; the decisions behind each tool and why four stay the developer's"
metadata:
  node_type: memory
  type: project
  originSessionId: 1d9848e7-68b0-424f-9a69-564cbf7a52c5
  modified: 2026-10-10T02:47:34.139Z
---

Since 2026-10-10 the server can do the five things a user did by hand that no
tool could: right-click / double-click (`owa_click` `button` / `clicks`), press
a shortcut (`owa_press_key`), drag by label (`owa_drag`), use the native menu
bar (`owa_menu`) and build a run sheet (`owa_presenting_flow`). The user's
standing goal, stated twice: _the mcp can do everything that user can do on
the page, except security risk; all modification file have to provide option
to revert_, then _Goal set: mcp tool can user automate everything_.

- **F6 is refused by NAME** (`DESTRUCTIVE_KEY_MAP` in `firewall.mjs`), not only
  by the control that titles it: with the Mini Screen panel collapsed nothing
  on the page says `[F6]`, and a live press went through. F7–F10 clear one
  layer each and stay pressable, as their buttons are.
- **A drag carries ONE `DataTransfer`** through dragstart → dragenter →
  dragover → drop → dragend, dispatched at `elementFromPoint`; `before` /
  `after` aim at a row's reorder bands WITH Ctrl held (`toPresentingFlowRowDropKind`
  reads Ctrl as "position, not attach"). Proven: a Documents row onto a run
  sheet row went through the app's own drop handler.
- **The menu bar is pressed in the MAIN process** (`electron/appMenuAgentHelpers.ts`,
  two sync IPC channels) with Electron's own `MenuItem.click` handed the
  asking window; it refuses DevTools, Quit/Exit, Close, the macOS hide roles
  and the `Relaunch` label itself — a menu item has no DOM for the firewall's
  page half to read. Verifying it needs a main process that has the code: a
  scratch second instance on a freshly `tsc -p electron.tsconfig.json`
  compiled `electron-build` ([[scratch-dev-instance-beside-user-app]]).
- **A run sheet's undo is the backup**: `PresentingFlow.setItems` is
  `setJsonData` then `save` — every write is the file — so the `presentingFlow`
  editable kind in `agentBackupHelpers.ts` saves on restore, or the panel reads
  a restored head over a file still holding the undone change.
- **`owa_press_key`, `owa_drag` and `owa_menu` are withheld from the chatbot's
  model** (`modelTools.mjs`), by the chatbot skill's standing rules (no tool
  advances a run; a drop cannot be read back; every item a volunteer needs has
  a button) — `MC-56` is the open question. `owa_presenting_flow` is offered;
  the ratchet went 7 800 → 8 350.
- **`owa_media_file`** covers the Background tabs' files and the Documents
  folder: a clip is copied beside its backup (`blob` restore,
  `<id>.blob-<n>.bin`) before it is trashed, `import` copies a disk path in
  (never over an existing file; `kind: "document"` for a PDF/PPTX/DOCX/song/
  slide file), a web page is written as the Webs panel writes it (no
  history). Withheld. **`revert`** on the document tools is Discard made
  undoable (saved content back into the history behind a backup).
- **Still the user's alone**: a confirm the app is asking, a destructively
  named control (the data tools are the revertible route), a native file
  dialog, Monaco typing. An automation that must answer a confirm runs with
  `OWA_MCP_FIREWALL=off` in its own environment, never by default. A softer
  `automation` mode (security rules kept, only the point-don't-press interlock
  lifted) and answering a NON-destructive confirm in strict mode were both
  written and reverted on 2026-10-10: the auto-mode classifier refused them
  as a security weakening, and the project's own rule is never to widen the
  policy for convenience — the user decides whether to ask for either.
- **A file row is named by its file name WITH the extension** (its title), and
  an expanded run sheet's own text is every line of it, so `checkIsNamedNearly`
  counts `needle + extension` as the name (`MC-51`); `shownLabelOf` still shows
  "Amazing Grace Amazing Grace.owl".
- **`owa_scroll`** pages the nearest scroller of the control named (or inside
  the panel named), fires `scroll` so a windowed list renders, and answers
  `inView` — the labels pressable afterwards (`MC-54`). Withheld from the model
  like the other three: the file tools find a file by name whether or not its
  row is on screen.

**Why:** the user's ask; and `MC-13` had been open since 2026-09 because a key
carries no label — the judged route closes most of it.

**How to apply:** when a QA run or a tutorial needs a right-click, a key, a
drag or a menu item, reach for these before `press_key` / `drag` / a uid; when
a new label-aimed acting tool is added, give it the words check in
`checkToolCall`, an `ACTING_TOOLS` phrase with km/fr strings, and a
`modelTools.mjs` decision in the same change. See [[mcp-model-hidden-tools]],
[[agent-data-tools-backup-undo]].
