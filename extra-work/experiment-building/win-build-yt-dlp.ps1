#!/usr/bin/env pwsh
#
# Build yt-dlp (https://github.com/yt-dlp/yt-dlp) as a *self-contained standalone
# binary* (yt-dlp.exe) from source on Windows — the same artifact the app ships
# and runs. The app invokes yt-dlp through yt-dlp-wrap
# (electron/client/ytUtils.ts -> bin-helper/yt/yt-dlp) to download audio/video
# and hand it to ffmpeg. This is the Windows counterpart of mac-build-yt-dlp.sh:
# instead of DOWNLOADING the prebuilt yt-dlp.exe release, it builds that binary
# yourself from a pinned source tag — reproducible, and no trusting a prebuilt
# download.
#
# yt-dlp is pure Python, so unlike the sibling ffmpeg/node/qjs scripts there is
# no meaningful "feature-minimal" knob: PyInstaller bundles a whole Python
# interpreter + the runtime deps into one .exe. What this DOES do to keep it
# lean is run make_lazy_extractors first (defers importing the ~1800 site
# extractors until one is actually used — faster startup, less resident memory,
# which matters on the app's low-spec target machines).
#
# Usage (PowerShell):
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\win-build-yt-dlp.ps1 [version]
#   .\win-build-yt-dlp.ps1              # defaults to 2026.07.04 (the shipped tag)
#   .\win-build-yt-dlp.ps1 2026.07.04   # a pinned release tag (reproducible)
#   .\win-build-yt-dlp.ps1 master       # bleeding edge
#
# Environment overrides:
#   $env:PYTHON            interpreter to build with (default: first Python >=3.10
#                          found via the `py` launcher — py -3.14 .. -3.10 — then
#                          `python` / `python3` on PATH).
#   $env:GIT              git to clone with (default: first git on PATH that has
#                          the https remote helper — some bundled gits, e.g.
#                          editors', ship without it and can't clone over https).
#   $env:YTDLP_BUILD_DIR   override the work dir (default: .\tmp\yt-dlp-build).
#
# NOTE: PyInstaller builds for the SAME CPU arch as the Python used, so this
# produces a single-arch binary (this host's Python arch). The official
# yt-dlp.exe release is an x64 build; on an ARM64 host an x64 Python still yields
# an x64 exe (which runs anywhere via emulation), while an arm64 Python yields a
# native arm64 exe. The result here is also unsigned — fine to run locally; the
# app's own packaging step signs the shipped copy.
#
# Prerequisites (install yourself):
#   - Python >=3.10 on PATH (or via the `py` launcher). yt-dlp requires >=3.10.
#   - git with https support (Git for Windows).
#   Result binary + a size report are printed at the end.

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# --- args --------------------------------------------------------------------
$Version = if ($args.Count -ge 1 -and $args[0]) { $args[0] } else { '2026.07.04' }
$Version = $Version -replace '^v', ''   # tolerate a stray leading "v"

$arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
# tmp\ is gitignored in this folder, so build junk never lands in the repo.
$workDir = if ($env:YTDLP_BUILD_DIR) { $env:YTDLP_BUILD_DIR } else { Join-Path $scriptDir 'tmp\yt-dlp-build' }
$srcDir  = Join-Path $workDir "yt-dlp-src-$Version"
$venvDir = Join-Path $workDir 'venv'
$repoUrl = 'https://github.com/yt-dlp/yt-dlp.git'
$outBinary = Join-Path $workDir "yt-dlp-$Version-$arch.exe"

function Log([string]$msg) {
    Write-Host ''
    Write-Host "==> $msg" -ForegroundColor Cyan
}

# --- pick a Python >=3.10 (yt-dlp's requires-python) -------------------------
# Honor $env:PYTHON; else probe the `py` launcher for a versioned interpreter;
# else fall back to a plain `python`/`python3` on PATH that passes the gate.
# py_ok returns $true if the given command (a string array = exe + args) runs and
# reports >=3.10.
function Test-PyOk([string[]]$cmd) {
    try {
        & $cmd[0] @($cmd[1..($cmd.Count - 1)]) `
            -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' `
            *> $null
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

$python = $null   # a string array: the interpreter invocation (exe [+ args])
if ($env:PYTHON) {
    if (Test-PyOk @($env:PYTHON)) { $python = @($env:PYTHON) }
} else {
    $candidates = @()
    if (Get-Command 'py' -ErrorAction SilentlyContinue) {
        foreach ($v in '3.14', '3.13', '3.12', '3.11', '3.10') {
            $candidates += , @('py', "-$v")
        }
    }
    $candidates += , @('python')
    $candidates += , @('python3')
    foreach ($cand in $candidates) {
        if ((Get-Command $cand[0] -ErrorAction SilentlyContinue) -and (Test-PyOk $cand)) {
            $python = $cand
            break
        }
    }
}

# --- pick a git that can clone over https ------------------------------------
# Some bundled gits (e.g. the one shipped inside code editors) come WITHOUT the
# git-remote-https helper and fail the clone with "'remote-https' is not a git
# command". Probe for one that has it (checked via --exec-path, no network).
function Test-GitHttps([string]$gitBin) {
    try {
        $ep = & $gitBin --exec-path 2>$null
        if ($LASTEXITCODE -ne 0 -or -not $ep) { return $false }
    } catch { return $false }
    return (Test-Path (Join-Path $ep 'git-remote-https.exe')) `
        -or (Test-Path (Join-Path $ep 'git-remote-https')) `
        -or (Test-Path (Join-Path $ep 'git-remote-http.exe')) `
        -or (Test-Path (Join-Path $ep 'git-remote-http'))
}
$gitBin = $null
foreach ($cand in $env:GIT, 'git', 'C:\Program Files\Git\cmd\git.exe') {
    if (-not $cand) { continue }
    $resolved = (Get-Command $cand -ErrorAction SilentlyContinue)
    if ($resolved -and (Test-GitHttps $resolved.Source)) {
        $gitBin = $resolved.Source
        break
    }
}

# --- toolchain sanity check --------------------------------------------------
if (-not $gitBin) {
    Write-Host "Error: no git with https support found." -ForegroundColor Red
    Write-Host "Install Git for Windows (https://git-scm.com/download/win)," -ForegroundColor Red
    Write-Host "or point at one with `$env:GIT='C:\path\to\git.exe'." -ForegroundColor Red
    exit 1
}
if (-not $python) {
    Write-Host "Error: no Python >=3.10 found (yt-dlp requires it)." -ForegroundColor Red
    Write-Host "Install one (https://www.python.org/downloads/windows/) and retry," -ForegroundColor Red
    Write-Host "or point at it with `$env:PYTHON='C:\path\to\python.exe'." -ForegroundColor Red
    exit 1
}

$pythonDisplay = ($python -join ' ')
Log "Building yt-dlp $Version  (arch=$arch)"
Write-Host "    work dir : $workDir"
Write-Host "    python   : $pythonDisplay  ($(& $python[0] @($python[1..($python.Count - 1)]) --version 2>&1))"
Write-Host "    git      : $gitBin"
Write-Host "    source   : $repoUrl @ $Version"

New-Item -ItemType Directory -Force -Path $workDir | Out-Null

# --- fetch source (cached shallow checkout) ----------------------------------
# A shallow clone of the exact tag/branch gives yt-dlp correct version stamping.
if (-not (Test-Path (Join-Path $srcDir '.git'))) {
    Log "Cloning $repoUrl @ $Version"
    if (Test-Path $srcDir) { Remove-Item -Recurse -Force $srcDir }
    & $gitBin clone --depth 1 --branch $Version $repoUrl $srcDir
    if ($LASTEXITCODE -ne 0) { Write-Error "git clone failed (exit $LASTEXITCODE)" }
} else {
    Log "Using cached source at $srcDir"
}

Push-Location $srcDir
try {
    # --- isolated venv -------------------------------------------------------
    # Never touch system/site packages; build deps live only under work_dir.
    $vpy = Join-Path $venvDir 'Scripts\python.exe'
    if (-not (Test-Path $vpy)) {
        Log "Creating virtualenv at $venvDir"
        & $python[0] @($python[1..($python.Count - 1)]) -m venv $venvDir
        if ($LASTEXITCODE -ne 0) { Write-Error "venv creation failed (exit $LASTEXITCODE)" }
    }
    Log 'Upgrading pip tooling'
    & $vpy -m pip install -U pip wheel setuptools
    if ($LASTEXITCODE -ne 0) { Write-Error "pip tooling upgrade failed (exit $LASTEXITCODE)" }

    # --- install build deps --------------------------------------------------
    # The documented build path: install runtime deps + the `pyinstaller`
    # dependency group in one shot. Fall back to a plain editable install for
    # older checkouts whose install_deps.py predates --include-group.
    Log 'Installing dependencies (runtime + pyinstaller)'
    $depsOk = $false
    if (Test-Path 'devscripts\install_deps.py') {
        & $vpy devscripts\install_deps.py --include-group pyinstaller
        $depsOk = ($LASTEXITCODE -eq 0)
    }
    if (-not $depsOk) {
        Write-Host '  (install_deps.py path unavailable — falling back to pip)'
        & $vpy -m pip install -e '.[default]'
        if ($LASTEXITCODE -ne 0) { Write-Error "pip install of runtime deps failed (exit $LASTEXITCODE)" }
        & $vpy -m pip install pyinstaller
        if ($LASTEXITCODE -ne 0) { Write-Error "pip install of pyinstaller failed (exit $LASTEXITCODE)" }
    }

    # --- lazy extractors (startup + memory win) ------------------------------
    if (Test-Path 'devscripts\make_lazy_extractors.py') {
        Log 'Generating lazy extractors'
        & $vpy devscripts\make_lazy_extractors.py
        if ($LASTEXITCODE -ne 0) { Write-Error "make_lazy_extractors failed (exit $LASTEXITCODE)" }
    }

    # --- bundle with PyInstaller (onefile by default) ------------------------
    Log 'Bundling standalone binary (this takes a few minutes)'
    & $vpy -m bundle.pyinstaller
    if ($LASTEXITCODE -ne 0) { Write-Error "PyInstaller bundling failed (exit $LASTEXITCODE)" }
} finally {
    Pop-Location
}

# --- locate + collect --------------------------------------------------------
# The dist name on Windows is yt-dlp.exe; glob for the produced .exe instead of
# hardcoding it in case a future bundle spec renames it.
$built = $null
foreach ($f in Get-ChildItem -Path (Join-Path $srcDir 'dist') -Filter 'yt-dlp*.exe' -File -ErrorAction SilentlyContinue) {
    $built = $f.FullName
    break
}
if (-not $built -or -not (Test-Path $built)) {
    Write-Error "no .exe produced under $srcDir\dist"
}
# No `strip` on Windows: a PyInstaller onefile is a self-extracting archive, and
# stripping it externally corrupts the bundle (PyInstaller's own --strip is the
# safe route). MSVC keeps debug info out of the exe anyway.
Copy-Item -Force $built $outBinary

# --- smoke test --------------------------------------------------------------
Log 'Smoke test: yt-dlp --version'
& $outBinary --version
if ($LASTEXITCODE -ne 0) { Write-Error "smoke test failed (exit $LASTEXITCODE)" }

$sizeMB = [math]::Round((Get-Item $outBinary).Length / 1MB, 1)
Log 'Done.'
Write-Host "    binary : $outBinary"
Write-Host "    arch   : $arch (single-arch; see the arch note in the header)"
Write-Host "    size   : ${sizeMB} MB"
Write-Host ''
Write-Host 'Ship it by copying to where the app loads yt-dlp, e.g.:'
Write-Host "    Copy-Item '$outBinary' '$scriptDir\..\bin-helper\yt-dlp_win_$Version.exe'"
Write-Host '    # or into a running dist tree: bin-helper\dist\yt\yt-dlp.exe'
