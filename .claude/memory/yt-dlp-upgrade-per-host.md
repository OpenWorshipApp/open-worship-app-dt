---
name: yt-dlp-upgrade-per-host
description: "Upgrading the extra-bin pack's yt-dlp: each platform's binary is built from the tag on a host of that arch; an x64 exe run on an ARM64 Windows host reports itself ARM64 -- read the PE header"
metadata:
  node_type: memory
  type: project
  originSessionId: cf470293-a8b7-41c8-9ccb-dd0c5c717dc3
  modified: 2026-11-07T16:02:59.576Z
---

yt-dlp in the extra-bin pack is rebuilt from a pinned tag, per platform, by
`extra-work/experiment-building/<os>-build-yt-dlp.*` (their default tag is the
shipped one); the old `yt-dlp-*` file leaves the platform dir (the pack takes
the FIRST file matching the prefix), `info.json` `version` goes up, and
`node extra-work/build-extra-bin.mjs` re-packs. Last done 2026-11-07:
2026.08.19 -> 2026.10.26, pack 0.0.4 -> 0.0.5, for `win`, `win-arm64` and
`linux-arm64` only -- `linux`, `mac` and `mac-int` still carry 2026.08.19
until rebuilt on their own hosts.

**Why:** PyInstaller builds for the arch of the Python running it, and a Linux
bundle links the host glibc, so no one host builds all six; upgrades land one
host at a time (one commit each in the 2026-09 history).

**How to apply:**

- A Windows-on-ARM64 dev machine builds three: `win-arm64` with a native ARM64
  Python; `win` (x64) with an x86_64 Python run under emulation --
  `uv python install cpython-3.13-windows-x86_64-none`, then `$env:PYTHON` =
  `uv python find cpython-3.13-windows-x86_64-none` and a `$env:YTDLP_BUILD_DIR`
  of its own (the work dir's venv is reused as it is); `linux-arm64` in WSL
  Ubuntu 24.04 with `YTDLP_BUILD_DIR` on the Linux filesystem (the committed
  builds match it: Python 3.12.3, glibc 2.39). WSL there has no x86_64
  emulation, so `linux` needs an x86_64 Linux host.
- **An x64 `yt-dlp.exe` run on an ARM64 host prints `CPython ARM64` and
  `(win_arm64_exe)` under `-v`**: Python 3.12+ asks WMI for the machine, which
  answers the native arch. It reads as the x64 pack shipping an ARM64 binary;
  it does not. Read the PE header instead (u32 at 0x3c, then u16 at +4:
  `0x8664` AMD64, `0xaa64` ARM64).
- Before 2026-11-07 `win-build-yt-dlp.ps1` ignored `$env:PYTHON` and a bare
  `python` (a `[1..0]` slice is out of bounds under StrictMode, so they read as
  "no Python found") and named its output by the HOST arch; both fixed.
- Prove each new binary with the app's own flags (`toYtDlpRuntimeArgs`,
  `src/server/appHelpers.ts`) and that pack's ffmpeg and qjs: `-g`, a video
  download (the `[Merger]` line) and `-x --audio-format mp3`, on the canonical
  link in `docs/test-paths/coverage-matrix.md`.
- `git add` on Windows (`core.fileMode` false) records a new Linux binary as
  100644 while the committed ones are 100755: `git update-index --chmod=+x`.

Related: [[extra-bin-on-demand]], [[pack-file-sharing]].
