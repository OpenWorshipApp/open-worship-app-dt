#!/usr/bin/env pwsh
#
# Build a *very minimal* Node.js from source on Windows — just enough to run a
# script like `console.log('hello world')`. This is the Windows counterpart of
# build-node.sh: same minimal-feature goal, but Node on Windows is built with
# vcbuild.bat driving MSVC/MSBuild (not make + ./configure), so the flags are
# translated accordingly. Everything not needed for plain JS execution is
# compiled out to shrink node.exe (no npm/corepack, no ICU/Intl, no inspector,
# no snapshot, no OpenSSL/crypto, and V8 in "lite" mode = no JIT).
#
# Usage (PowerShell):
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\build-node.ps1 [version]
#   .\build-node.ps1 24.18.0     # explicit
#   .\build-node.ps1             # defaults to 24.18.0
#
# Environment overrides:
#   $env:NODE_CONFIGURE_FLAGS  — replace the passthrough configure flags entirely
#   $env:NODE_TARGET_ARCH      — x64 or arm64 (default: host arch). NOTE: 32-bit
#                                Windows (x86/ia32) is NOT buildable — Node/V8
#                                dropped it; the script rejects it early.
#   $env:NODE_BUILD_DIR        — build/output dir (default: .\tmp\node-build)
#
# Prerequisites (install yourself):
#   - Visual Studio 2022 with the "Desktop development with C++" workload
#     (vcbuild.bat locates it via vswhere automatically).
#   - Python 3.x on PATH.
#   - `tar` (built into Windows 10 1803+ / Windows 11).
#   NOTE: NASM is NOT required here because we build --without-ssl.
`
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# --- args --------------------------------------------------------------------
$Version = if ($args.Count -ge 1 -and $args[0]) { $args[0] } else { '24.18.0' }
$Version = $Version -replace '^v', ''   # tolerate a leading "v" (e.g. v24.18.0)

# Default to the host architecture (native build) unless overridden. On this
# ARM64 machine that means arm64; an x64 host would default to x64.
if ($env:NODE_TARGET_ARCH) {
    $arch = $env:NODE_TARGET_ARCH
} else {
    $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
}
# 32-bit Windows (x86 / ia32 / "win32") is intentionally rejected up front: Node
# and V8 DROPPED 32-bit Windows support, so vcbuild.bat itself aborts with
# "32-bit Windows builds are not supported anymore." (vcbuild.bat, the
# `if "%target_arch%"=="x86"` guard). There is no flag to bypass it — the build
# would just fail deeper in V8. Fail here with the real reason instead of dying
# minutes into vcbuild. (Discovered 2026-07-19 trying to add a win32 target.)
if ($arch -eq 'x86' -or $arch -eq 'ia32' -or $arch -eq 'win32') {
    Write-Error "32-bit Windows (x86/ia32/win32) is not buildable: Node/V8 dropped 32-bit Windows support and vcbuild.bat aborts on it. Use 'x64' or 'arm64'."
}
if ($arch -ne 'x64' -and $arch -ne 'arm64') {
    Write-Error "NODE_TARGET_ARCH must be 'x64' or 'arm64' (got '$arch')."
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
# tmp\ is gitignored in this folder, so build junk never lands in the repo.
$workDir  = if ($env:NODE_BUILD_DIR) { $env:NODE_BUILD_DIR } else { Join-Path $scriptDir 'tmp\node-build' }
$srcName  = "node-v$Version"
$tarball  = "$srcName.tar.gz"
$srcUrl   = "https://nodejs.org/dist/v$Version/$tarball"
$srcDir   = Join-Path $workDir $srcName
$outBinary = Join-Path $workDir "node-v$Version-$arch-minimal.exe"

# --- minimal build knobs -----------------------------------------------------
# `without-intl` and `no-cctest` are native vcbuild.bat tokens. The remaining
# feature flags have no vcbuild token, so they're forwarded verbatim to
# `python configure` via the $env:config_flags passthrough that vcbuild appends.
# Edit here (or set $env:NODE_CONFIGURE_FLAGS) to tune the tradeoff.
$vcbuildTokens = @(
    'release'          # optimized build (release config, LTCG)
    $arch              # target architecture
    'without-intl'     # drop bundled ICU (no Intl / full-icu) — big size win
    'no-cctest'        # skip building the C++ unit tests — faster build
)
# NOTE on NASM: vcbuild only requires NASM for non-arm64 targets (it's an x86_64
# assembler for OpenSSL asm — see vcbuild.bat line ~276, skipped when
# target_arch == arm64). We DON'T use vcbuild's `openssl-no-asm` token here
# because it appends `--openssl-no-asm` to configure, which conflicts with our
# `--without-ssl`. For an arm64 build NASM is never checked; for an x64 build
# with --without-ssl you must instead have a real nasm.exe on PATH to satisfy
# vcbuild's up-front check (the assembler isn't actually invoked once configure
# drops OpenSSL).
$defaultPassthroughFlags = @(
    '--without-npm'           # no npm
    '--without-corepack'      # no corepack shim
    '--without-inspector'     # no V8 inspector / --inspect debugging
    '--without-node-snapshot' # skip the startup snapshot builder
    '--without-ssl'           # no OpenSSL: no crypto/tls/https modules (also drops the NASM requirement)
    '--v8-lite-mode'          # V8 interpreter only, no JIT — smaller binary
)
if ($env:NODE_CONFIGURE_FLAGS) {
    $passthroughFlags = $env:NODE_CONFIGURE_FLAGS -split '\s+' | Where-Object { $_ }
} else {
    $passthroughFlags = $defaultPassthroughFlags
}

function Log([string]$msg) {
    Write-Host ''
    Write-Host "==> $msg" -ForegroundColor Cyan
}

# --- toolchain sanity check --------------------------------------------------
$missing = @()
foreach ($tool in 'python', 'tar', 'curl') {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { $missing += $tool }
}
# vcbuild.bat finds MSVC via vswhere; check it exists so we fail early with a
# helpful message instead of deep inside the batch file.
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
if (-not (Test-Path $vswhere)) {
    $missing += 'Visual Studio 2022 (C++ workload; vswhere.exe not found)'
}
if ($missing.Count) {
    Write-Host "Error: missing build prerequisites: $($missing -join ', ')" -ForegroundColor Red
    Write-Host "Install Visual Studio 2022 with 'Desktop development with C++', plus Python 3.x on PATH." -ForegroundColor Red
    exit 1
}

Log "Building minimal Node.js v$Version  (arch=$arch)"
Write-Host "    work dir : $workDir"
Write-Host "    vcbuild  : $($vcbuildTokens -join ' ')"
Write-Host "    configure: $($passthroughFlags -join ' ')"

New-Item -ItemType Directory -Force -Path $workDir | Out-Null

# --- fetch (cached) ----------------------------------------------------------
$tarballPath = Join-Path $workDir $tarball
if (-not (Test-Path $tarballPath)) {
    Log "Downloading $srcUrl"
    $partPath = "$tarballPath.part"
    curl.exe -fL --retry 3 -o $partPath $srcUrl
    if ($LASTEXITCODE -ne 0) { Write-Error "download failed (curl exit $LASTEXITCODE)" }
    Move-Item -Force $partPath $tarballPath
} else {
    Log "Using cached $tarball"
}

# --- extract -----------------------------------------------------------------
if (-not (Test-Path $srcDir)) {
    Log "Extracting $tarball"
    tar.exe -xzf $tarballPath -C $workDir
    if ($LASTEXITCODE -ne 0) { Write-Error "extract failed (tar exit $LASTEXITCODE)" }
} else {
    Log "Source already extracted at $srcDir"
}

# --- source patches (toolchain-compat) ---------------------------------------
# Clang 22 (shipped with VS 2026 / VS 18; vcbuild forces ClangCL for Node >= 24)
# promoted -Wincompatible-pointer-types from a warning to a DEFAULT ERROR. Node
# 24.18.0's bundled hdr_histogram passes a `uint32_t*` to the `_BitScanReverse64`
# intrinsic, which wants a `DWORD*` (== `unsigned long*`) — same size, different
# type. Older compilers let it slide; Clang 22 rejects it, so histogram.lib never
# builds and node.exe (which links it) fails the whole build with exit 1.
#
# Fix: widen the local to `unsigned long` (exactly DWORD) so the intrinsic's
# signature matches. Idempotent — re-running (or a clean re-extract) re-applies
# it, and the second Set-Content is skipped once the source already reads right.
# Discovered 2026-07-19 building v24.18.0 x64 on this ARM64/VS2026 host.
$histogramC = Join-Path $srcDir 'deps\histogram\src\hdr_histogram.c'
if (Test-Path $histogramC) {
    $orig = Get-Content -Raw -LiteralPath $histogramC
    $patched = $orig -replace '(?m)^(\s*)uint32_t leading_zero = 0;', '$1unsigned long leading_zero = 0;'
    if ($patched -ne $orig) {
        Log "Patching hdr_histogram.c for Clang >= 22 (-Wincompatible-pointer-types is now a default error)"
        Set-Content -LiteralPath $histogramC -Value $patched -NoNewline -Encoding utf8
    }
}

# --- configure + build (vcbuild.bat) -----------------------------------------
Push-Location $srcDir
try {
    Log "Compiling with vcbuild.bat (this takes a while)"
    # vcbuild.bat appends %config_flags% to its `python configure` invocation,
    # which is how we smuggle in the flags it has no native token for.
    $env:config_flags = ($passthroughFlags -join ' ')
    # cd /d inside cmd itself — a child process does not reliably inherit
    # PowerShell's Push-Location, and vcbuild.bat must run from the source root.
    # The `.\` prefix is required: this environment sets
    # NoDefaultCurrentDirectoryInExePath, so cmd won't run a bare `vcbuild.bat`
    # found only in the current directory.
    & cmd.exe /c "cd /d `"$srcDir`" && .\vcbuild.bat $($vcbuildTokens -join ' ')"
    $buildExit = $LASTEXITCODE
    Remove-Item Env:\config_flags -ErrorAction SilentlyContinue
    if ($buildExit -ne 0) { Write-Error "vcbuild.bat failed (exit $buildExit)" }

    $built = Join-Path $srcDir 'Release\node.exe'
    if (-not (Test-Path $built)) {
        Write-Error "expected binary not found at $built"
    }
} finally {
    Pop-Location
}

# --- collect -----------------------------------------------------------------
# No `strip` on Windows: an MSVC release build keeps debug info out of node.exe
# (it lives in the separate node.pdb), so the binary is already lean.
Copy-Item -Force $built $outBinary

# --- smoke test --------------------------------------------------------------
Log "Smoke test: console.log('hello world')"
& $outBinary -e "console.log('hello world')"
if ($LASTEXITCODE -ne 0) { Write-Error "smoke test failed (exit $LASTEXITCODE)" }

$sizeMB = [math]::Round((Get-Item $outBinary).Length / 1MB, 1)
Log 'Done.'
Write-Host "    binary : $outBinary"
Write-Host "    version: $(& $outBinary -v)"
Write-Host "    size   : ${sizeMB} MB"
