---
name: scratch-dev-instance-beside-user-app
description: "Verify a fix on a fresh profile without touching the user's running dev app: start a SECOND dev Electron on OWA_USER_DATA_PATH against the same Vite; never npm run dev or electron:build for it"
metadata:
  type: project
---

When the user's own dev app is up (their `-dev` profile, their real data) and a live check needs
a first-run state — no KJV installed, no child folders, a floating panel with no saved position —
start a SECOND dev Electron on a scratch profile against the same Vite server instead of driving
(or emptying) theirs:

```
env -u ELECTRON_RUN_AS_NODE OWA_USER_DATA_PATH="<repo>\release\<scratch>" NODE_ENV=development \
  ./node_modules/electron/dist/electron.exe .        # background
```

with `<scratch>\setting.json` seeded `{"clientSetting":{"selected-parent-dir":"<scratch>\\data"}}`
and `<scratch>\data` created.

- **Not `npm run dev` and not `electron:build`.** `strictPort` makes a second `npm run dev` stop on
  the busy :3000, and `electron:build` deletes the `electron-build/` the user's app runs from
  ([[build-kills-running-dev-app]]). `electron .` reuses the compiled `electron-build/`, so `grep`
  the `.js` for a main-process change before counting on it.
- The userData decides the single-instance lock, so the two run side by side and
  `prod-app.mjs status` lists both. Newest-first discovery aims `owa_*` (and a chrome-devtools
  half that reconnects) at the scratch one — prove it with a screenshot of a fresh-profile state
  before the first click.
- It shares the user's Vite: touching a file to clear a stale transform
  ([[vite-caches-failed-import-resolution]]) reloads THEIR windows too.
- Settings → General raises **Set according paths** the first time; **Yes** creates the child
  folders inside the scratch data folder. A state the UI cannot reach without a destructive
  press (a missing bible key) can be set in the scratch `data/local-storage/<setting>` file and
  read back after **Apply Settings**, which reloads only the scratch instance's windows.
- Stop it by its own pid (`taskkill //PID <pid>` from Git Bash exits it cleanly), then delete the
  scratch folder — after `cd`-ing out of it: a shell whose cwd is inside makes the delete EBUSY.

**Why:** 2026-10-01, verifying seven fixes from a release run: F1 needed a Reader on _"KJV" is not
available!_, which the user's dev data (KJV installed) could not show without trashing their bible.

**How to apply:** default to this whenever a live check needs a first-run or destructive-ish state
while a dev app of the user's is running; [[pack-release-from-snapshot]] is the packaged-build
counterpart.
