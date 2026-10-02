---
name: pack-release-from-snapshot
description: "A release can be packed beside a running dev app by building a snapshot of the tree under release/ with node_modules junctioned; four traps: the junction must be unlinked before deleting, no .git means no app-update.yml/latest.yml, test:electron breaks on a C:\\C:\\ path there, and a run sheet reads its history HEAD"
metadata:
  node_type: memory
  type: project
  originSessionId: d8c1244b-88f3-4ec2-b698-6929ee4ef902
  modified: 2026-10-02T00:54:36.674Z
---

`npm run pack:*` starts with `electron:build`, which deletes `electron-build/` — the running
dev app's own main entry ([[build-kills-running-dev-app]]). The 2026-10-01 release golden-path
run needed a packaged build while the user's `npm run dev` + `electron:dev` watch chain was up,
and packed from a **snapshot** instead, which left the dev app untouched:

1. `robocopy <repo> release\rbsrc-<runid> /E /XJ /XD <repo>\node_modules <repo>\.git <repo>\release
   <repo>\dist <repo>\electron-build <repo>\coverage <repo>\coverage-electron <repo>\test-results
   <repo>\extra-work\tmp <repo>\extra-work\experiment-building` (~226 MB, 1 s), then
   `mklink /J release\rbsrc-<runid>\node_modules <repo>\node_modules`. Inside `release/` it is
   gitignored and outside Vite's `html/` root, tsc -w's `electron/**` and nodemon's watch paths.
2. In the snapshot: `npm run build`, then
   `electron-builder build --win "-c.directories.output=<repo>/release"` (Git Bash:
   `MSYS_NO_PATHCONV=1`). ~9 minutes on win-arm64; `prod-app.mjs locate` then finds the exe.

**Traps, all hit or nearly hit once:**

- **Unlink the junction before deleting the snapshot.** Check `fs.lstatSync(p).isSymbolicLink()`
  and `fs.unlinkSync(p)` (Node removes only the link), then verify `<repo>/node_modules` is
  intact, then `rm -rf`. A recursive delete that follows the junction empties the real
  `node_modules`. The PowerShell tool also refuses `cmd /c rmdir` (it reads `/c` as a path).
- **No `.git` in the snapshot → no `resources/app-update.yml` and no `latest.yml`**:
  package.json has no `repository`/`publish`, so electron-builder derives the GitHub publish
  config from the git remote. The artefacts are TEST builds — never upload them;
  `extra-work/release.sh` rebuilds from a clean install and fails without `latest.yml`.
  (`build-info.mjs`'s `git rev-parse HEAD` still works because `release/` is inside the repo.)
- **Run the gate in the repo, not the snapshot**, for `test:electron`: through the junction a
  `vi.mock` resolves `C:\C:\…\vitest\dist\index.js` and 3 tests fail. `lint:all:error`,
  `test` and `lint:es` run fine in the snapshot; `lint:pre`/`test:electron` are check-only and
  safe in the repo beside a dev app.
- Compare the live tree to the snapshot with `cmp` per changed file — a patch saved with
  PowerShell's `Out-File` differs on every line (encoding/CRLF) and reads as "tree changed".

Same run, packaged app on a scratch profile: a presenting flow cannot be filled by drag over CDP
on Windows (KB §5), and editing the `.owpf` on disk does nothing — the panel reads
`<file>.owpf.histories/<n>-head` ([[presenting-flow-reads-editing-history-head]]); writing rows
into the head (paths as `$DATA_DIR_PATH\documents\…`, [[portable-data-dir-alias]]) is picked up
live. Write that JSON from a script file, not an inline `node -e` ([[bash-heredoc-halves-backslashes]]).
