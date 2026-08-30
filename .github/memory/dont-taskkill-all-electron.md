---
name: dont-taskkill-all-electron
description: taskkill /IM electron.exe also kills the user's other Electron dev apps; filter by CommandLine instead
metadata:
  type: feedback
---

A blanket kill by Electron image name is **not** "restart the app" — the user
runs other Electron projects from source on this machine, notably `open-lyric`
at `/Users/raksa/Desktop/dev/open-lyric` (its own dev app, CDP on port **9224**
vs this repo's 9223). Its processes carry the same image names, so a blanket
kill takes it down too. Doing this on 2026-08-09 (on the old Windows box, with
`taskkill //IM electron.exe //F`) killed their open-lyric session mid-work.

**Why:** every dev-mode Electron app shares the same image names from
`node_modules/electron/dist/` — `Electron`/`Electron Helper` on macOS,
`electron.exe` on Windows. Only the command line distinguishes them, and a
packaged Open Worship build is a *different* name again, so image-name matching
is wrong in both directions.

**How to apply:** target this repo only —

```bash
pkill -f 'open-worship-app-dt.*[Ee]lectron'   # this repo only
pgrep -fl 'open-lyric.*[Ee]lectron' | wc -l   # verify open-lyric untouched
```

(Windows alternative: `Get-CimInstance Win32_Process -Filter "Name='electron.exe'"`
filtered on `CommandLine -like '*open-worship-app-dt*'`, then `Stop-Process`.)

Verify afterwards that the open-lyric process count is unchanged before moving
on. The main process is the one whose command line has no `--type=` flag.

Restart caveats seen the same day: kill leftovers and wait for BOTH port 3000
(Vite) and 9223 (CDP) to be free before relaunching, or Vite silently moves to
3001 while Electron still loads :3000 (see [[dev-electron-hardcodes-port-3000]]),
and the second app instance quits on the single-instance lock. Running
`npm run vite:dev` and `electron .` as two separate background commands avoids
`concurrently -k` tearing both down when one hiccups.

Related: [[build-kills-running-dev-app]], [[dev-data-dir-is-separate]].
