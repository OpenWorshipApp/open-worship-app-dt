---
name: open-worship-project
description: 'Repository context for the Open Worship desktop app. Use when working in this repo on React renderer pages, Electron main-process code, IPC event wiring, Bible data/search, presentation screens, Office or PDF conversion, lw-share networking, agent debugging, or build/test/release tasks.'
argument-hint: 'Optional focus area, for example: renderer, electron, ipc, bible, screens, document conversion, agent-debugging, or build/release.'
user-invocable: true
---

# Open Worship Project Context

Use this skill when a task needs repository-specific knowledge instead of generic React or Electron advice.

## When to Use

- You need to know where a feature lives before editing.
- You are changing Electron IPC, settings persistence, or multi-screen behavior.
- You are working on Bible data, search, or renderer storage.
- You are changing PPTX, DOCX, PDF, or Word export behavior.
- You need to inspect or extend the agent debug surface for screenshots, DOM snapshots, or structured renderer state.
- You need the right validation commands for this repo.

## Procedure

1. Read the detailed repo reference in [repo-guide.md](./references/repo-guide.md).
2. If the task involves live app inspection or agent tooling, read [agent-debugging.md](./references/agent-debugging.md) before changing the debug surface.
3. Identify the edit surface before changing code: renderer page, shared renderer module, Electron main process, worker script in `public/js/`, or bundled helper in `extra-work/bin-helper/`.
4. Preserve the renderer/main-process boundary. Renderer code goes through `appProvider` and helper wrappers; Electron code owns filesystem, OS integration, process spawning, and window management.
5. If you touch async IPC, update both sender and handler paths together and keep `replyEventName` handling intact.
6. For renderer UI work, check Bootstrap utility classes and existing Bootstrap-style patterns before adding new SCSS or bespoke style helpers. Add custom styles only when Bootstrap cannot cover the requirement cleanly.
7. During iteration, run the narrowest relevant validation for the changed area. After code changes, use `npm run lint` as the default final validation source unless the task is documentation-only or the user explicitly asks for a narrower check.

## References

- [repo-guide.md](./references/repo-guide.md)
- [agent-debugging.md](./references/agent-debugging.md)
- [functionality-inventory.md](./references/functionality-inventory.md)
- [b3-bible-search-guide.md](./references/b3-bible-search-guide.md)
