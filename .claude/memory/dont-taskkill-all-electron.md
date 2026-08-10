---
name: dont-taskkill-all-electron
description: taskkill /IM electron.exe also kills the user's other Electron dev apps; filter by CommandLine instead
metadata:
  type: feedback
---

`taskkill //IM electron.exe //F` is **not** "restart the app" — the user runs
other Electron projects from source on this machine, notably `open-lyric` at
`C:\Users\racky\Desktop\dev\open-lyric` (its own dev app, CDP on port **9224**,
userData `%APPDATA%\test-l…`). Its processes are also named `electron.exe`, so a
blanket kill takes it down too. Doing this on 2026-08-09 killed their
open-lyric session mid-work.

**Why:** every dev-mode Electron app shares the `electron.exe` image name from
`node_modules/electron/dist/`. Only the command line distinguishes them, and a
packaged Open Worship build is a *different* name again (`Open Worship app.exe`),
so image-name matching is wrong in both directions.

**How to apply:** target this repo only —

```powershell
Get-CimInstance Win32_Process -Filter "Name='electron.exe'" |
    Where-Object { $_.CommandLine -like '*open-worship-app-dt*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

Verify afterwards that the open-lyric count is still 5 before moving on. The same
filter identifies the **main** process (add `-and $_.CommandLine -notlike '*--type=*'`)
when a window handle is needed for Win32 calls.

Restart caveats seen the same day: kill leftovers and wait for BOTH port 3000
(Vite) and 9223 (CDP) to be free before relaunching, or Vite silently moves to
3001 while Electron still loads :3000 (see [[dev-electron-hardcodes-port-3000]]),
and the second app instance quits on the single-instance lock. Running
`npm run vite:dev` and `electron .` as two separate background commands avoids
`concurrently -k` tearing both down when one hiccups.

Related: [[build-kills-running-dev-app]], [[dev-data-dir-is-separate]].
