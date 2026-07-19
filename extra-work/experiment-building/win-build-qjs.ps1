#!/usr/bin/env pwsh
#
# Build a *minimal* QuickJS (Fabrice Bellard's small JS engine) from source on
# Windows — just the `qjs` interpreter, enough to run a script like
# `console.log('hello world')`. This is the Windows counterpart of build-qjs.sh:
# same minimal-build goal (build ONLY the `qjs` target, skip qjsc/run-test262/the
# example programs/the .so native modules, then strip), but QuickJS uses a plain
# POSIX Makefile with no native MSVC path (the same situation as FFmpeg, unlike
# Node's vcbuild.bat), so on Windows the build runs inside an MSYS2 MinGW
# environment. This script owns the Windows-side orchestration (arch detection,
# MSYS2 discovery, optional dep install, path conversion, ship hints) and hands the
# actual fetch/extract/make/strip/smoke-test to an embedded bash driver run under
# the right MinGW subsystem.
#
# MSYS2/pacman supplies everything the build needs: the MinGW compiler and make —
# QuickJS has no external library dependencies, so there is nothing else to install.
#
# Usage (PowerShell):
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\build-qjs.ps1 [version]
#   .\build-qjs.ps1              # defaults to 2026-06-04 (matches the .sh)
#   .\build-qjs.ps1 2026-06-04   # explicit (releases are date-stamped)
#
# Environment overrides:
#   $env:QJS_MAKE_TARGET   make target to build     (default: qjs.exe — the
#                          Makefile appends EXE=.exe under MSYS2/MSYSTEM)
#   $env:QJS_MAKE_FLAGS    extra make variables, space-sep (default: none)
#                          e.g. $env:QJS_MAKE_FLAGS="CONFIG_LTO=y" -> link-time
#                          optimization: smaller/faster binary, but slower build.
#   $env:QJS_BUILD_DIR     override the work dir (Windows path).
#   $env:MSYS2_ROOT        MSYS2 install root (default: C:\msys64).
#   $env:QJS_INSTALL_DEPS  set to 1 to `pacman -S` the toolchain (make + the MinGW
#                          compiler) before building instead of just checking.
#                          (Default: 1 — pacman --needed skips already-installed
#                          packages, so it is cheap to leave on. Set to 0 offline.)
#
# Prerequisites:
#   - MSYS2 (https://www.msys2.org) at C:\msys64 (or $env:MSYS2_ROOT).
#   - make + the MinGW compiler for the target subsystem — installed for you when
#     QJS_INSTALL_DEPS=1 (the default), or by hand:
#       arm64 (CLANGARM64):
#         pacman -S --needed make mingw-w64-clang-aarch64-clang
#       x64 (UCRT64):
#         pacman -S --needed make mingw-w64-ucrt-x86_64-gcc
#
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# --- args --------------------------------------------------------------------
$Version = if ($args.Count -ge 1 -and $args[0]) { $args[0] } else { '2026-06-04' }
$Version = $Version -replace '^v', ''   # tolerate a stray leading "v"

# Build for the HOST architecture ONLY — no cross-compiling. On an arm64 machine
# this produces an arm64 binary; on an x64 machine, an x64 binary. QuickJS ships a
# native qjs per platform, each built on its own platform, so cross-arch is
# deliberately unsupported here.
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
# Pick the MSYS2 MinGW subsystem + compiler for the target arch. CLANGARM64 is the
# only sane arm64 toolchain (GCC has no aarch64-windows target); UCRT64 is the
# modern x64 default (gcc + the UCRT runtime). QuickJS's Makefile defaults CC to
# `gcc`, so on CLANGARM64 (where only clang exists) we pass CC=clang as a make var.
if ($arch -eq 'arm64') {
    $mingwSys = 'CLANGARM64'; $cc = 'clang'
    $toolPkgs = @('make', 'mingw-w64-clang-aarch64-clang')
} else {
    $mingwSys = 'UCRT64';     $cc = 'gcc'
    $toolPkgs = @('make', 'mingw-w64-ucrt-x86_64-gcc')
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
# tmp\ is gitignored in this folder, so build junk never lands in the repo.
$workDir  = if ($env:QJS_BUILD_DIR) { $env:QJS_BUILD_DIR } else { Join-Path $scriptDir 'tmp\qjs-build' }
$srcName   = "quickjs-$Version"
$tarball   = "$srcName.tar.xz"
$srcUrl    = "https://bellard.org/quickjs/$tarball"
$outBinary = Join-Path $workDir "qjs-$Version-$arch-minimal.exe"

# --- minimal build knobs -----------------------------------------------------
# QuickJS uses a plain Makefile (no ./configure). We build only the `qjs`
# interpreter target for a minimal result and force CC to the subsystem's compiler
# (the Makefile only auto-selects clang on Darwin/FreeBSD, so on CLANGARM64 — where
# no gcc exists — we must pass it). The target is `qjs.exe`, NOT `qjs`: under MSYS2
# the Makefile sets EXE=.exe (the `else ifdef MSYSTEM` branch), so the linked
# program is `qjs.exe`. Asking make for bare `qjs` matches no explicit rule and
# falls through to the built-in `%: %.c` rule, which one-shot compiles qjs.c
# without creating the .obj/ depfile dir and dies with "error opening '.obj/qjs.d'".
$makeTarget = if ($env:QJS_MAKE_TARGET) { $env:QJS_MAKE_TARGET } else { 'qjs.exe' }
# CC=$cc first so a user QJS_MAKE_FLAGS can still override it if they really want.
# LDFLAGS=-static is essential, not cosmetic: the Makefile links `-lpthread`, which
# on MinGW is libwinpthread — a DLL that lives in the MSYS2 tree. Without -static
# the binary launches only when C:\msys64\<subsys>\bin is on PATH and dies with
# STATUS_DLL_NOT_FOUND (0xC0000135) anywhere else, so the shipped qjs.exe would be
# broken on every machine without MSYS2. -static folds libwinpthread + the compiler
# runtime into the exe, making it self-contained. (It overrides the Makefile's
# LDFLAGS `+=-s`, but we strip below anyway.) A user QJS_MAKE_FLAGS can re-set it.
$makeVars = @("CC=$cc", 'LDFLAGS=-static')
if ($env:QJS_MAKE_FLAGS) {
    $makeVars += ($env:QJS_MAKE_FLAGS -split '\s+' | Where-Object { $_ })
}

function Log([string]$msg) {
    Write-Host ''
    Write-Host "==> $msg" -ForegroundColor Cyan
}

# Convert a Windows path (C:\a\b) to an MSYS2 path (/c/a/b). MSYS2 mounts drive
# letters at /<letter> by default, so this matches cygpath -u without needing to
# bootstrap bash just to translate a path.
function ConvertTo-MsysPath([string]$p) {
    $p = $p -replace '\\', '/'
    if ($p -match '^([A-Za-z]):/(.*)$') { return '/' + $matches[1].ToLower() + '/' + $matches[2] }
    return $p
}

# --- locate MSYS2 ------------------------------------------------------------
# QuickJS's build system is a POSIX Makefile; there is no native MSVC build. So a
# working MSYS2 install with a MinGW toolchain is a hard requirement here — fail
# early and loudly (with the fix) instead of dying deep in make.
$msys2Root = if ($env:MSYS2_ROOT) { $env:MSYS2_ROOT } else { 'C:\msys64' }
$bash   = Join-Path $msys2Root 'usr\bin\bash.exe'
$pacman = Join-Path $msys2Root 'usr\bin\pacman.exe'
if (-not (Test-Path $bash)) {
    Write-Host "Error: MSYS2 bash not found at $bash." -ForegroundColor Red
    Write-Host "Install MSYS2 from https://www.msys2.org (or set `$env:MSYS2_ROOT), then re-run." -ForegroundColor Red
    Write-Host "Note: Git Bash / Git-for-Windows is NOT enough — it ships no compiler, make, or pacman." -ForegroundColor Red
    exit 1
}

Log "Building minimal QuickJS ($Version)  (arch=$arch, $mingwSys)"
Write-Host "    work dir : $workDir"
Write-Host "    msys2    : $msys2Root"
Write-Host "    compiler : $cc"
Write-Host "    target   : $makeTarget"
Write-Host "    make vars: $($makeVars -join ' ')"

New-Item -ItemType Directory -Force -Path $workDir | Out-Null

# --- install toolchain via pacman --------------------------------------------
# On by default (QJS_INSTALL_DEPS unset => install). pacman --needed is a no-op for
# packages already present, so this is cheap on repeat runs. Set the var to '0' to
# skip entirely (e.g. offline).
if ($env:QJS_INSTALL_DEPS -ne '0') {
    if (-not (Test-Path $pacman)) { Write-Error "pacman not found at $pacman (is this a full MSYS2 install?)" }
    Log "Ensuring build deps via pacman: $($toolPkgs -join ' ')"
    & $pacman -S --needed --noconfirm @toolPkgs
    if ($LASTEXITCODE -ne 0) { Write-Error "pacman install failed (exit $LASTEXITCODE). Update first with 'pacman -Syu'." }
}

# --- build (inside MSYS2, under the target MinGW subsystem) -------------------
# Everything POSIX — download, extract, make, strip, smoke test — runs in one bash
# invocation so the MinGW toolchain is on PATH. We hand values across via env vars
# (Windows paths converted to MSYS form) and select the subsystem with MSYSTEM so
# `bash -lc` sources the right /etc/profile.d paths (the compiler for $mingwSys).
$env:MSYSTEM = $mingwSys
$env:CHERE_INVOKING = '1'              # keep bash's login shell in our cwd, don't cd to $HOME
$env:QJB_WORK    = ConvertTo-MsysPath $workDir
$env:QJB_OUT     = ConvertTo-MsysPath $outBinary
$env:QJB_VERSION = $Version
$env:QJB_SRCNAME = $srcName
$env:QJB_TARBALL = $tarball
$env:QJB_SRCURL  = $srcUrl
$env:QJB_TARGET  = $makeTarget
$env:QJB_MAKEVARS = ($makeVars -join ' ')

# The driver mirrors build-qjs.sh's fetch -> extract -> make -> strip -> smoke
# stages; it reads the QJB_* env exported above.
$driver = @'
set -euo pipefail
log() { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }

work="$QJB_WORK"
src_dir="$work/$QJB_SRCNAME"
jobs="$(nproc 2>/dev/null || echo 4)"

# --- toolchain sanity check --------------------------------------------------
missing=()
for tool in curl tar make; do
    command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
done
if ! command -v cc >/dev/null 2>&1 \
    && ! command -v gcc >/dev/null 2>&1 \
    && ! command -v clang >/dev/null 2>&1; then
    missing+=("a C compiler (cc/gcc/clang)")
fi
if ((${#missing[@]})); then
    echo "Error: missing build prerequisites in $MSYSTEM: ${missing[*]}" >&2
    echo "Re-run with QJS_INSTALL_DEPS=1 (default) to pacman-install them." >&2
    exit 1
fi

log "Building minimal QuickJS ($QJB_VERSION)  (jobs=$jobs, $MSYSTEM)"
echo "    work dir : $work"
echo "    target   : $QJB_TARGET"
echo "    make vars: $QJB_MAKEVARS"

mkdir -p "$work"

# --- fetch (cached) ----------------------------------------------------------
if [[ ! -f "$work/$QJB_TARBALL" ]]; then
    log "Downloading $QJB_SRCURL"
    curl -fL --retry 3 -o "$work/$QJB_TARBALL.part" "$QJB_SRCURL"
    mv "$work/$QJB_TARBALL.part" "$work/$QJB_TARBALL"
else
    log "Using cached $QJB_TARBALL"
fi

# --- extract -----------------------------------------------------------------
# MSYS2's GNU tar shells out to `xz` for .tar.xz; fall back to piping xz by hand.
if [[ ! -d "$src_dir" ]]; then
    log "Extracting $QJB_TARBALL"
    if ! tar -xf "$work/$QJB_TARBALL" -C "$work" 2>/dev/null; then
        if command -v xz >/dev/null 2>&1; then
            xz -dc "$work/$QJB_TARBALL" | tar -xf - -C "$work"
        else
            echo "Error: could not extract $QJB_TARBALL; pacman -S xz." >&2
            exit 1
        fi
    fi
else
    log "Source already extracted at $src_dir"
fi

# --- make --------------------------------------------------------------------
cd "$src_dir"
log "Compiling"
# shellcheck disable=SC2086
make -j"$jobs" $QJB_MAKEVARS "$QJB_TARGET"

# Native MinGW may or may not append .exe depending on the Makefile's EXE suffix,
# so accept either name.
built="$src_dir/qjs.exe"
[[ -x "$built" ]] || built="$src_dir/qjs"
if [[ ! -x "$built" ]]; then
    echo "Error: expected binary not found at $src_dir/qjs(.exe)" >&2
    exit 1
fi

# --- strip + collect ---------------------------------------------------------
cp "$built" "$QJB_OUT"
if command -v strip >/dev/null 2>&1; then
    log "Stripping symbols"
    strip "$QJB_OUT" || echo "  (strip failed - keeping unstripped binary)"
fi

# --- smoke test --------------------------------------------------------------
# $QJB_OUT is a NATIVE Windows exe, but -e takes a literal script string (no device
# paths), so it runs cleanly under MSYS2.
log "Smoke test: console.log('hello world')"
"$QJB_OUT" -e "console.log('hello world')"

# qjs has no -v/--version flag; the version is printed in the --help header.
# --help exits non-zero, so tolerate that and take the first line without a pipe
# (a `| head -1` would SIGPIPE qjs and trip pipefail).
qjs_help="$("$QJB_OUT" --help 2>&1 || true)"
qjs_version="${qjs_help%%$'\n'*}"
size="$(du -h "$QJB_OUT" | cut -f1)"
log "Done."
echo "    binary : $QJB_OUT"
echo "    version: $qjs_version"
echo "    size   : $size"
'@

# Normalize to LF so MSYS2 bash doesn't choke on CRLF, write to the work dir, run
# it. bash -lc sources the login profile so $MSYSTEM's MinGW bin is on PATH.
$driverPath = Join-Path $workDir 'build-driver.sh'
[System.IO.File]::WriteAllText($driverPath, ($driver -replace "`r`n", "`n"))
$driverMsys = ConvertTo-MsysPath $driverPath

try {
    & $bash -lc "bash '$driverMsys'"
    $buildExit = $LASTEXITCODE
} finally {
    foreach ($v in 'MSYSTEM','CHERE_INVOKING','QJB_WORK','QJB_OUT','QJB_VERSION','QJB_SRCNAME','QJB_TARBALL','QJB_SRCURL','QJB_TARGET','QJB_MAKEVARS') {
        Remove-Item "Env:\$v" -ErrorAction SilentlyContinue
    }
}
if ($buildExit -ne 0) { Write-Error "QuickJS build failed (bash exit $buildExit)" }

$shipDir = if ($arch -eq 'arm64') { 'win-arm64' } else { 'win' }
Write-Host ''
Write-Host "Ship it by copying to the $arch platform dir the app loads:" -ForegroundColor Yellow
Write-Host "    Copy-Item '$outBinary' '$scriptDir\$shipDir\qjs.exe'"
