#!/usr/bin/env pwsh
#
# Build a *minimal* FFmpeg from source on Windows — just the `ffmpeg.exe` program
# with MP3 encoding (libmp3lame), which is all this app actually needs. This is
# the Windows counterpart of build-ffmpeg.sh: same minimal-build goal and the
# same configure flags, but FFmpeg's `configure` is a POSIX shell script + `make`
# build (there is NO native MSVC path the way Node has vcbuild.bat), so on Windows
# it runs inside an MSYS2 MinGW environment. This script owns the Windows-side
# orchestration (arch detection, MSYS2 discovery, optional dep install, path
# conversion, ship hints) and hands the actual configure/make/strip/smoke-test to
# an embedded bash driver run under the right MinGW subsystem.
#
# MSYS2/pacman supplies everything the build needs: the MinGW compiler, make, and
# a prebuilt libmp3lame (mingw-w64-*-lame) — no from-source dependency juggling.
#
# FFmpeg is only ever invoked by yt-dlp (see electron/client/ytUtils.ts
# `ffmpegBinPath` + src/server/appHelpers.ts `--ffmpeg-location`) to post-process
# downloads: extract audio to mp3 (`-x --audio-format mp3`) and merge video+audio
# streams. yt-dlp does all the downloading itself and only hands ffmpeg LOCAL
# files, so the binary needs no network stack, no ffplay, and no ffprobe.
#
# We keep the full decoder/demuxer set on purpose — YouTube et al. serve audio as
# AAC (m4a), Opus/Vorbis (webm/ogg), etc., and dropping those would silently break
# extraction for some sources — but drop the fat: docs, the player, the probe
# binary, the network/TLS layer, capture devices, postproc, and debug info, plus
# --enable-small to optimize libav* for size.
#
# Usage (PowerShell):
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\build-ffmpeg.ps1 [version]
#   .\build-ffmpeg.ps1              # defaults to "snapshot" (matches the .sh / README)
#   .\build-ffmpeg.ps1 7.1.1        # a pinned release (reproducible)
#
# Environment overrides:
#   $env:FFMPEG_CONFIGURE_FLAGS  replace the default configure flags entirely
#                                (space-separated), e.g. to go component-minimal
#                                with --disable-everything + --enable-decoder=...
#   $env:LAME_PREFIX             libmp3lame install prefix inside MSYS2, in either
#                                Windows (C:\msys64\clangarm64) or MSYS
#                                (/clangarm64) form. Default: the MinGW prefix of
#                                the selected subsystem ($MINGW_PREFIX).
#   $env:FFMPEG_BUILD_DIR        override the work dir (Windows path).
#   $env:MSYS2_ROOT              MSYS2 install root (default: C:\msys64).
#   $env:FFMPEG_INSTALL_DEPS     set to 1 to `pacman -S` the toolchain + lame
#                                (make, the MinGW compiler, pkgconf, nasm on x64,
#                                lame) before building instead of just checking.
#                                (Default: 1 the first time; harmless to leave on
#                                — pacman --needed skips already-installed pkgs.)
#
# Prerequisites:
#   - MSYS2 (https://www.msys2.org) at C:\msys64 (or $env:MSYS2_ROOT).
#   - The toolchain + libmp3lame for the target subsystem — installed for you when
#     FFMPEG_INSTALL_DEPS=1 (the default), or by hand:
#       arm64 (CLANGARM64):
#         pacman -S --needed make mingw-w64-clang-aarch64-clang \
#                   mingw-w64-clang-aarch64-pkgconf mingw-w64-clang-aarch64-lame
#       x64 (UCRT64):
#         pacman -S --needed make nasm mingw-w64-ucrt-x86_64-gcc \
#                   mingw-w64-ucrt-x86_64-pkgconf mingw-w64-ucrt-x86_64-lame
#     (NASM is an x86 assembler — it is NOT needed for the arm64 build.)
#
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# --- args --------------------------------------------------------------------
$Version = if ($args.Count -ge 1 -and $args[0]) { $args[0] } else { 'snapshot' }
$Version = $Version -replace '^v', ''   # tolerate a leading "v" on a release (e.g. v7.1.1)

# Build for the HOST architecture ONLY — no cross-compiling. On an arm64 machine
# this produces an arm64 binary; on an x64 machine, an x64 binary. The app ships a
# native ffmpeg per platform, each built on its own platform, so cross-arch is
# deliberately unsupported here.
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
# Pick the MSYS2 MinGW subsystem + compiler for the target arch. CLANGARM64 is the
# only sane arm64 toolchain (GCC has no aarch64-windows target); UCRT64 is the
# modern x64 default (gcc + the UCRT runtime).
if ($arch -eq 'arm64') {
    $mingwSys = 'CLANGARM64'; $cc = 'clang'; $lamePkg = 'mingw-w64-clang-aarch64-lame'
    $toolPkgs = @('make', 'mingw-w64-clang-aarch64-clang', 'mingw-w64-clang-aarch64-pkgconf', $lamePkg)
} else {
    $mingwSys = 'UCRT64';     $cc = 'gcc';   $lamePkg = 'mingw-w64-ucrt-x86_64-lame'
    $toolPkgs = @('make', 'nasm', 'mingw-w64-ucrt-x86_64-gcc', 'mingw-w64-ucrt-x86_64-pkgconf', $lamePkg)
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
# tmp\ is gitignored in this folder, so build junk never lands in the repo.
$workDir  = if ($env:FFMPEG_BUILD_DIR) { $env:FFMPEG_BUILD_DIR } else { Join-Path $scriptDir 'tmp\ffmpeg-build' }
if ($Version -eq 'snapshot') { $tarball = 'ffmpeg-snapshot.tar.bz2' }
else                         { $tarball = "ffmpeg-$Version.tar.bz2" }
$srcUrl    = "https://ffmpeg.org/releases/$tarball"
$outBinary = Join-Path $workDir "ffmpeg-$Version-$arch-minimal.exe"

# --- minimal build knobs -----------------------------------------------------
# Identical intent to build-ffmpeg.sh: each flag either enables the one thing we
# need (mp3) or drops a subsystem the yt-dlp mp3/merge flow never uses. The only
# Windows deltas are $cc (clang on arm64, gcc on x64) and --pkg-config-flags
# --static so libmp3lame's static .a is picked up under MinGW. --disable-autodetect
# makes the link set deterministic: only the libs named below link in.
$defaultFlags = @(
    "--cc=$cc"
    '--extra-version=owa-minimal' # marks provenance in `ffmpeg -buildconf`
    '--enable-gpl'                # license umbrella (matches README)
    '--enable-version3'           # ""
    '--disable-autodetect'        # deterministic: only libs enabled below link in
    '--enable-zlib'               # needed by matroska/mov demuxers (compressed data)
    '--enable-libmp3lame'         # the one encoder we want: mp3
    '--disable-shared'            # build FFmpeg's libav* as static, not DLLs
    '--enable-static'             # "" (external deps are forced static via
                                  #  --extra-ldflags=-static in the driver below)
    '--pkg-config-flags=--static' # make pkg-config emit static link flags for lame
    '--enable-small'              # optimize libav* for size, not speed
    '--disable-doc'               # no HTML/man/txt docs
    '--disable-ffplay'            # no player (would need SDL anyway)
    '--disable-ffprobe'           # yt-dlp works with just the ffmpeg binary
    '--disable-network'           # yt-dlp downloads; ffmpeg only sees local files
    '--disable-avdevice'          # drop libavdevice: no capture/playback devices
    '--disable-debug'             # no debug info in the binary
    # (libpostproc is already off by default — no --disable-postproc needed)
)
if ($env:FFMPEG_CONFIGURE_FLAGS) {
    $configureFlags = ($env:FFMPEG_CONFIGURE_FLAGS -split '\s+' | Where-Object { $_ })
} else {
    $configureFlags = $defaultFlags
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
# FFmpeg's build system is POSIX shell + make; there is no native MSVC build. So
# a working MSYS2 install with a MinGW toolchain is a hard requirement here — fail
# early and loudly (with the fix) instead of dying deep in ./configure.
$msys2Root = if ($env:MSYS2_ROOT) { $env:MSYS2_ROOT } else { 'C:\msys64' }
$bash   = Join-Path $msys2Root 'usr\bin\bash.exe'
$pacman = Join-Path $msys2Root 'usr\bin\pacman.exe'
if (-not (Test-Path $bash)) {
    Write-Host "Error: MSYS2 bash not found at $bash." -ForegroundColor Red
    Write-Host "Install MSYS2 from https://www.msys2.org (or set `$env:MSYS2_ROOT), then re-run." -ForegroundColor Red
    Write-Host "Note: Git Bash / Git-for-Windows is NOT enough — it ships no compiler, make, or pacman." -ForegroundColor Red
    exit 1
}

Log "Building minimal FFmpeg ($Version)  (arch=$arch, $mingwSys)"
Write-Host "    work dir : $workDir"
Write-Host "    msys2    : $msys2Root"
Write-Host "    compiler : $cc"
Write-Host "    flags    : $($configureFlags -join ' ')"

New-Item -ItemType Directory -Force -Path $workDir | Out-Null

# --- install toolchain + libmp3lame via pacman -------------------------------
# On by default (FFMPEG_INSTALL_DEPS unset => install). pacman --needed is a no-op
# for packages already present, so this is cheap on repeat runs. Set the var to
# '0' to skip entirely (e.g. offline).
if ($env:FFMPEG_INSTALL_DEPS -ne '0') {
    if (-not (Test-Path $pacman)) { Write-Error "pacman not found at $pacman (is this a full MSYS2 install?)" }
    Log "Ensuring build deps via pacman: $($toolPkgs -join ' ')"
    & $pacman -S --needed --noconfirm @toolPkgs
    if ($LASTEXITCODE -ne 0) { Write-Error "pacman install failed (exit $LASTEXITCODE). Update first with 'pacman -Syu'." }
}

# --- build (inside MSYS2, under the target MinGW subsystem) -------------------
# Everything POSIX — download, extract, configure, make, strip, smoke test — runs
# in one bash invocation so /dev/zero + /dev/null exist and the MinGW toolchain is
# on PATH. We hand values across via env vars (Windows paths converted to MSYS
# form) and select the subsystem with MSYSTEM so `bash -lc` sources the right
# /etc/profile.d paths (the compiler for $mingwSys, its $MINGW_PREFIX, etc.).
$env:MSYSTEM = $mingwSys
$env:CHERE_INVOKING = '1'              # keep bash's login shell in our cwd, don't cd to $HOME
$env:FFB_WORK    = ConvertTo-MsysPath $workDir
$env:FFB_OUT     = ConvertTo-MsysPath $outBinary
$env:FFB_VERSION = $Version
$env:FFB_TARBALL = $tarball
$env:FFB_SRCURL  = $srcUrl
$env:FFB_FLAGS   = ($configureFlags -join ' ')
$env:FFB_CC_TOOL = $cc
$env:FFB_LAME    = if ($env:LAME_PREFIX) { ConvertTo-MsysPath $env:LAME_PREFIX } else { '' }

# The driver mirrors build-ffmpeg.sh's fetch -> extract -> configure -> make ->
# strip -> smoke stages; it reads the FFB_* env exported above.
$driver = @'
set -euo pipefail
log() { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }

work="$FFB_WORK"
lame="${FFB_LAME:-$MINGW_PREFIX}"     # libmp3lame lives in the MinGW prefix by default
jobs="$(nproc 2>/dev/null || echo 4)"

# --- toolchain sanity check --------------------------------------------------
missing=()
for tool in curl tar make "$FFB_CC_TOOL" pkg-config; do
    command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
done
if ((${#missing[@]})); then
    echo "Error: missing build prerequisites in $MSYSTEM: ${missing[*]}" >&2
    echo "Re-run with FFMPEG_INSTALL_DEPS=1 (default) to pacman-install them." >&2
    exit 1
fi
if [[ ! -f "$lame/include/lame/lame.h" ]]; then
    echo "Error: libmp3lame headers not found under $lame." >&2
    echo "pacman -S the *-lame package for $MSYSTEM (or set LAME_PREFIX)." >&2
    exit 1
fi

log "Building minimal FFmpeg ($FFB_VERSION)  (jobs=$jobs, $MSYSTEM)"
echo "    work dir : $work"
echo "    lame     : $lame"
echo "    flags    : $FFB_FLAGS"

mkdir -p "$work"

# --- fetch (cached) ----------------------------------------------------------
if [[ ! -f "$work/$FFB_TARBALL" ]]; then
    log "Downloading $FFB_SRCURL"
    curl -fL --retry 3 -o "$work/$FFB_TARBALL.part" "$FFB_SRCURL"
    mv "$work/$FFB_TARBALL.part" "$work/$FFB_TARBALL"
else
    log "Using cached $FFB_TARBALL"
fi

# --- extract -----------------------------------------------------------------
# `|| true`: head closes the pipe after line 1, so tar gets SIGPIPE (141); under
# pipefail+set -e that would abort. MSYS2's GNU tar hits this where bsdtar didn't.
top_dir="$(tar -tf "$work/$FFB_TARBALL" 2>/dev/null | head -1 | cut -d/ -f1 || true)"
src_dir="$work/$top_dir"
if [[ ! -d "$src_dir" ]]; then
    log "Extracting $FFB_TARBALL"
    if ! tar -xf "$work/$FFB_TARBALL" -C "$work" 2>/dev/null; then
        bunzip2 -dc "$work/$FFB_TARBALL" | tar -xf - -C "$work"
    fi
else
    log "Source already extracted at $src_dir"
fi

# --- configure + make --------------------------------------------------------
cd "$src_dir"
log "Configuring"
# --extra-ldflags=-static makes ffmpeg.exe STANDALONE. --enable-static
# --disable-shared only governs FFmpeg's own libav* libs; without -static the
# MinGW linker still prefers the *import* libs (libFOO.dll.a) for external deps and
# links the DLLs — so the binary needs libmp3lame-0.dll, zlib1.dll and
# libwinpthread-1.dll from the MSYS2 tree at runtime and dies with
# STATUS_DLL_NOT_FOUND (0xC0000135) on any machine without MSYS2. -static forces
# the .a archives (libmp3lame.a, libz.a, libwinpthread.a) + the compiler runtime
# INTO the exe. (ucrtbase.dll stays external — it's a Windows OS component.)
# shellcheck disable=SC2086
./configure $FFB_FLAGS \
    --extra-cflags="-I$lame/include" \
    --extra-ldflags="-static -L$lame/lib" \
    --extra-libs="-lmp3lame"

log "Compiling (this takes a while)"
make -j"$jobs"

built="$src_dir/ffmpeg.exe"
[[ -x "$built" ]] || built="$src_dir/ffmpeg"
if [[ ! -x "$built" ]]; then
    echo "Error: expected binary not found at $src_dir/ffmpeg(.exe)" >&2
    exit 1
fi

# --- strip + collect ---------------------------------------------------------
cp "$built" "$FFB_OUT"
if command -v strip >/dev/null 2>&1; then
    log "Stripping symbols"
    strip "$FFB_OUT" || echo "  (strip failed - keeping unstripped binary)"
fi

# --- smoke test --------------------------------------------------------------
# Encode a real mp3 via libmp3lame from 1s of s16le silence: exercises
# demux -> pcm-decode -> resample -> libmp3lame -> mp3-mux without needing lavfi.
# NOTE: $FFB_OUT is a NATIVE Windows exe, so we must NOT hand it /dev/zero or
# /dev/null — MSYS2 rewrites those bogus device paths (/dev/null -> /Device/Null)
# and ffmpeg can't open them. Real filesystem paths convert cleanly, so we stage
# the silence in an actual temp file and write to an actual output file.
log "Smoke test: encode 1s of silence to mp3 via libmp3lame"
head -c "$((44100 * 2 * 2))" /dev/zero > "$work/silence.raw"   # 1s s16le stereo
if "$FFB_OUT" -hide_banner -loglevel error \
    -f s16le -ar 44100 -ac 2 -i "$work/silence.raw" -t 1 \
    -c:a libmp3lame -q:a 5 -f mp3 -y "$work/smoke.mp3" && [[ -s "$work/smoke.mp3" ]]; then
    echo "    mp3 encode: OK ($(stat -c%s "$work/smoke.mp3") bytes)"
else
    echo "    mp3 encode: FAILED - the binary cannot produce mp3 (check flags)" >&2
fi
rm -f "$work/silence.raw" "$work/smoke.mp3"

size="$(du -h "$FFB_OUT" | cut -f1)"
log "Done."
echo "    binary : $FFB_OUT"
echo "    version: $("$FFB_OUT" -hide_banner -version 2>/dev/null | head -1 || true)"
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
    foreach ($v in 'MSYSTEM','CHERE_INVOKING','FFB_WORK','FFB_OUT','FFB_VERSION','FFB_TARBALL','FFB_SRCURL','FFB_FLAGS','FFB_LAME','FFB_CC_TOOL') {
        Remove-Item "Env:\$v" -ErrorAction SilentlyContinue
    }
}
if ($buildExit -ne 0) { Write-Error "FFmpeg build failed (bash exit $buildExit)" }

$shipDir = if ($arch -eq 'arm64') { 'win-arm64' } else { 'win' }
Write-Host ''
Write-Host "Ship it by copying to the $arch platform dir the app loads:" -ForegroundColor Yellow
Write-Host "    Copy-Item '$outBinary' '$scriptDir\$shipDir\ffmpeg.exe'"
