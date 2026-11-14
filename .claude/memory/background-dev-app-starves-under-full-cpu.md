---
name: background-dev-app-starves-under-full-cpu
description: "While the lint gate or another session pins every core, a dev app window in the background freezes for seconds to minutes with zero CPU and no CDP answer -- it is starved at Chromium's background priority, not hung; how to tell, and to drive it after the load"
metadata:
  type: project
---

Seen 2026-11-11 (`EC-488`): with `npm run lint`'s `test:all` and another
session's run holding all 12 cores at 100% (24 node processes), a scratch
dev app's Presenter -- not the window in front -- drew a blank page, took
no CPU, and answered NOTHING on its page target: an evaluate, enabling the
debugger and enabling the page domain all timed out, while a browser-side
call (the page's navigation history) answered and the main process served MCP.
It looked exactly like a deadlock -- two relaunches "hung at startup", one
right after an Undo press -- and it was not one: Chromium runs a hidden or
covered window's renderer at background priority, and with every core
busy it simply got no time. Under the same load the font-list PowerShell
in main timed out too (`fontListHelpers.ts`, killed by its timeout).

**Why:** two relaunches and a hunt for a deadlock went into it before
anyone looked at the load.

**How to tell starvation from a hang:** an in-page heartbeat written
to disk: over raw CDP, add a script to run on every new document (the page
domain's own call for it), then reload, with a script that `fs.appendFileSync`s a line every few seconds
and before each synchronous wait (`ipcRenderer.sendSync`, `Atomics.wait`,
sync child processes). A hang stops the log at the culprit; starvation
shows the beats spreading out (12 s, 23 s, 5 minutes apart) and startup
crawling on. `Get-Counter "\Process(*)\% Processor Time"` names who holds
the cores. Never `import()` an app module from that script
([[cdp-dynamic-import-hijack]]); node built-ins and `electron` only.

**How to apply:** do the live checks before the gate or after it, not
during it, and don't read a frozen background window as a code bug until
the load is gone; a 10 s test timeout failing under the same load is the
same thing ([[coverage-run-load-flakes]]). The window answered in under a
second once the gate finished. Related: [[scratch-dev-instance-beside-user-app]].
