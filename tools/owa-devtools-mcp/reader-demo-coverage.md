# Reader demo coverage

Scope: `html/reader.html` → `src/reader.tsx`, including its study sidebar,
floating record/graph panels, saved passages, notes, header and native menus.
The separate note editor, Settings, Presenter and AI Chat contents are outside
this catalog. Updated 2026-10-04: **100 lessons**, **50 with actions**, **50
self-guided**. The assistant's featured shelf remains 30 small starter lessons;
**Help → All tips** exposes all 100 without a model call.

## Using the lessons

Search **All tips** by the control's name or the task. Choose a tip, press
**Show it**, then **Do it** for each named action. **Next** explains a step
that requires your own selection. Use **Back** to revisit a step and close the
card when finished. If a panel is hidden, reopen it with **View → Widgets**.
Menus under a file heading affect that file; the menu in the panel header
affects the whole library. The tips name which one to use.

Titles and usage tips are translated into Khmer and French. Guide prose follows
the assistant's existing English convention; control targets resolve in the
displayed language, including scoped targets such as **Bible Notes → More
Options**. Explanation steps after an action use **Next**. When a development
renderer is ahead of an old tool host, an inline Reader fallback preserves the
complete instructions in show mode.

## Feature map

All ids below have the `reader-` prefix. Combined lessons cover related controls;
this table records the entry points rather than promising that a fixed script
can choose a person's files, translation, text selection or records.

| Reader surface                            | Demo ids / coverage                                                                                                                                                                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Reference picker                          | `open-john-3-16`, `type-reference`, `clear-reference`, `clear-reference-part`, `reference-shortcuts`, `verse-ranges`                                                                                                                                               |
| Passage history                           | `previous-passage`, `next-passage`, `history-chips` (reopen, split, drag, save, remove)                                                                                                                                                                            |
| Bible versions and metadata               | `version-info`, `bible-information`, `add-bible`, `remove-extra-version`, `split-translation`                                                                                                                                                                      |
| Reading layout                            | `font-larger`, `font-smaller`, `full-view`, `split-side-by-side`, `split-stacked`, `edit-arrange-passages`, `switch-split-pane` (Ctrl+Shift+Arrow between panes), `sync-panes`, `divider-menu`                                                                     |
| Formatting and scrolling                  | `bible-line-breaks`, `model-line-breaks`, `model-info`, `auto-scroll`, `scroll-top`, `scroll-speed`                                                                                                                                                                |
| Passage copying                           | `copy-passage`, `copy-title`, `copy-text`, `copy-all`, `copy-verse-key`, `copy-chapter-key`                                                                                                                                                                        |
| Passage export, dictionary, audio, output | `extra-passage-actions`, `ai-audio`, `save-passage`, `present-passage`; audience output and export remain personal actions                                                                                                                                         |
| Saved Bibles library                      | `bibles-folder`, `bibles-new-list`, `bibles-open-saved`, `bibles-organize`, `bibles-share`, `bibles-file-actions` (folder, create/open, colors/version, reorder/duplicate/move/delete, archives/URL/drop, Word/copy-all, rename/reload/reveal/trash)               |
| Notes and verse annotations               | `filter-notes`, `sort-notes`, `verse-marks`, `note-actions`, `notes-folder`, `notes-new-file`, `notes-new-item`, `notes-organize`, `notes-share`, `notes-file-actions` (file versus item import/export, marks/comments, move/reorder, editor doorway)              |
| Bible Find                                | `find-text`, `filter-books`, `find-results`, `search-selection` (version, search/suggestions, books, result pages, open/save, selected words)                                                                                                                      |
| Cross references                          | `cross-references`, `cross-reference-verse` (select source verse and follow related passages)                                                                                                                                                                      |
| Names and locations                       | `names-lookup`, `names-language`, `people-in-passage`, `name-details`, `names-filter`, `location-map` (list/type/search, language, relationships, verses, copy, map)                                                                                               |
| Connection graphs                         | `graph-explore`, `graph-manage`, `graph-filters`, `graph-path`, `graph-layout`, `graph-copy`, `graph-presets` (expand/collapse/remove, pan/zoom, relation solo, centre/root, paths, undo/redo, formats/images/print, presets)                                      |
| Resources                                 | `resources`, `resource-organize`, `resource-file-actions`, `resources-search`, `resources-others`, `resources-refresh`, `resources-portable` (chapter naming, folders/drop/add, search, reload/refresh, open/reveal, link/Markdown/note previews, portable copies) |
| Header and help                           | `header-tools`, `open-settings`, `open-help`, `practice-tips`; explains the return-to-Presenter, Settings and AI window doorways without teaching those other windows                                                                                              |
| Panel visibility                          | `bible-notes-panel`, `bibles-section`, `notes-section`, `view-widgets`, `view-reset-widgets`                                                                                                                                                                       |
| Native menus                              | `menu-file`, `menu-edit`, `menu-tools`, `menu-window`, `menu-help`, `view-reload`, `view-relaunch`, `view-devtools`, `view-zoom`, `view-fullscreen`; includes Reader printing, archives, focused editing, controller overlay, language/window/help commands        |

## Verification boundary

The catalog tests check stable ids, translated titles/tips and panel scopes,
mixed action/explanation steps, and person-only file/destructive choices. Live
checks exercise safe actions against the development Reader through a fresh
MCP server and inspect the rendered tips/guide. A self-guided instruction is
not a claim that its export, deletion, external link or audience action was
automatically performed. The policy probe's Presenter-only checks are outside
this Reader-only run; record them as skipped, not passed.
