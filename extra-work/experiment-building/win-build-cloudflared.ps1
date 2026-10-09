#!/usr/bin/env pwsh
#
# Build cloudflared (https://github.com/cloudflare/cloudflared) from source on
# Windows -- the binary Screen Mirror's internet tunnel runs
# (electron/screenMirrorTunnel.ts: `cloudflared tunnel --url ...`, Cloudflare's
# free quick tunnel). It ships in the extra-bin pack as cloudflared/cloudflared
# (.exe): extra-work/build-extra-bin.mjs picks it up from the platform dir below
# by the 'cloudflared' name prefix, the same way it picks up yt-dlp/ffmpeg/qjs.
#
# cloudflared is pure Go, so unlike the sibling scripts this one CAN build every
# pack platform from one host: with CGO_ENABLED=0 Go cross-compiles natively,
# and that is how Cloudflare builds its own Linux and Windows-386 releases. The
# result is a static binary with no libc/glibc to match. There is no
# "feature-minimal" knob; what keeps it lean is -trimpath and -ldflags "-s -w"
# (no symbol table, no DWARF), which take roughly a third off the file.
#
# Go itself is NOT expected on this machine: a pinned toolchain is downloaded
# into the work dir, checked against go.dev's SHA-256, and used from there with
# its module/build caches kept beside it -- nothing is installed and nothing
# lands in the user profile. GOTOOLCHAIN=local stops `go` fetching another one.
#
# Usage (PowerShell 7):
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\win-build-cloudflared.ps1 [version] [targets]
#   .\win-build-cloudflared.ps1                    # 2026.9.3 for this host's pack
#   .\win-build-cloudflared.ps1 2026.9.3 all       # every pack platform
#   .\win-build-cloudflared.ps1 2026.9.3 win,mac   # a comma list of pack names
#
# Pack names (extra-work/buildPlatformHelpers.mjs): win, win-arm64, mac (Apple
# silicon), mac-int, linux, linux-arm64.
#
# Environment overrides:
#   $env:GO                     a go.exe to build with instead of the pinned one
#                               (it must satisfy cloudflared's go.mod).
#   $env:GIT                    git to clone with (default: first git on PATH
#                               that has the https remote helper).
#   $env:CLOUDFLARED_BUILD_DIR  override the work dir (default:
#                               .\tmp\cloudflared-build).
#   $env:CLOUDFLARED_SHIP       set to 1 to copy each result straight into its
#                               platform dir, replacing the cloudflared* file
#                               already there (build-extra-bin.mjs takes the
#                               FIRST file matching the prefix, so two would be
#                               ambiguous). Default: print the copy commands.
#
# Only the Windows results are smoke-tested here (an arm64 host runs the x64
# one through emulation); the macOS/Linux ones are checked for their file
# header. The results are unsigned, like the sibling scripts' -- macOS arm64
# binaries carry the Go linker's ad-hoc signature, which is what lets them run.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # Invoke-WebRequest's bar slows it badly
Set-StrictMode -Version Latest

# --- args --------------------------------------------------------------------
$Version = if ($args.Count -ge 1 -and $args[0]) { $args[0] } else { '2026.9.3' }
$Version = $Version -replace '^v', ''   # tolerate a stray leading "v"
$TargetArg = if ($args.Count -ge 2 -and $args[1]) { $args[1] } else { '' }

$hostArch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'amd64' }
$hostPack = if ($hostArch -eq 'arm64') { 'win-arm64' } else { 'win' }

# Pack name -> Go target. Mirrors getPlatformDirName() in buildPlatformHelpers.mjs.
$allTargets = [ordered]@{
    'win'         = @{ goos = 'windows'; goarch = 'amd64' }
    'win-arm64'   = @{ goos = 'windows'; goarch = 'arm64' }
    'mac'         = @{ goos = 'darwin';  goarch = 'arm64' }
    'mac-int'     = @{ goos = 'darwin';  goarch = 'amd64' }
    'linux'       = @{ goos = 'linux';   goarch = 'amd64' }
    'linux-arm64' = @{ goos = 'linux';   goarch = 'arm64' }
}
$packs = if (-not $TargetArg) {
    @($hostPack)
} elseif ($TargetArg -eq 'all') {
    @($allTargets.Keys)
} else {
    @($TargetArg -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}
foreach ($pack in $packs) {
    if (-not $allTargets.Contains($pack)) {
        Write-Host "Error: unknown pack '$pack' (one of: $($allTargets.Keys -join ', '), or all)." -ForegroundColor Red
        exit 1
    }
}

# --- pinned Go toolchain -----------------------------------------------------
# The version cloudflared's own Dockerfile builds this tag with. Hashes are
# go.dev's (https://go.dev/dl/?mode=json&include=all).
$goVersion = '1.26.8'
$goArchives = @{
    'amd64' = @{ name = "go$goVersion.windows-amd64.zip"; sha256 = 'b92c3b2adae85a11ba71fe7216daf0d84e82af4c8ab6c5625807f28622043a59' }
    'arm64' = @{ name = "go$goVersion.windows-arm64.zip"; sha256 = '4bc560ed3ccb64eec0be6180b8c29185c07f5215276820adb4303d7bf3365435' }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
# tmp\ is gitignored (extra-work/.gitignore), so build junk never lands in the repo.
$workDir = if ($env:CLOUDFLARED_BUILD_DIR) { $env:CLOUDFLARED_BUILD_DIR } else { Join-Path $scriptDir 'tmp\cloudflared-build' }
$srcDir  = Join-Path $workDir "cloudflared-src-$Version"
$outDir  = Join-Path $workDir "out-$Version"
$repoUrl = 'https://github.com/cloudflare/cloudflared.git'

function Log([string]$msg) {
    Write-Host ''
    Write-Host "==> $msg" -ForegroundColor Cyan
}

# --- pick a git that can clone over https ------------------------------------
# Some bundled gits (e.g. the one inside code editors) come WITHOUT the
# git-remote-https helper and fail the clone. Probe for one that has it.
function Test-GitHttps([string]$gitBin) {
    try {
        $ep = & $gitBin --exec-path 2>$null
        if ($LASTEXITCODE -ne 0 -or -not $ep) { return $false }
    } catch { return $false }
    return (Test-Path (Join-Path $ep 'git-remote-https.exe')) `
        -or (Test-Path (Join-Path $ep 'git-remote-https'))
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
if (-not $gitBin) {
    Write-Host "Error: no git with https support found." -ForegroundColor Red
    Write-Host "Install Git for Windows (https://git-scm.com/download/win)," -ForegroundColor Red
    Write-Host "or point at one with `$env:GIT='C:\path\to\git.exe'." -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Force -Path $workDir | Out-Null

# --- Go: $env:GO, else the pinned toolchain (downloaded once, hash-checked) ---
if ($env:GO) {
    $goBin = (Get-Command $env:GO -ErrorAction Stop).Source
} else {
    $goRoot = Join-Path $workDir "go-$goVersion-$hostArch"
    $goBin = Join-Path $goRoot 'go\bin\go.exe'
    if (-not (Test-Path $goBin)) {
        $archive = $goArchives[$hostArch]
        $zipPath = Join-Path $workDir $archive.name
        if (-not (Test-Path $zipPath)) {
            Log "Downloading Go $goVersion ($($archive.name))"
            $partPath = "$zipPath.part"
            Invoke-WebRequest -Uri "https://go.dev/dl/$($archive.name)" -OutFile $partPath
            Move-Item -Force $partPath $zipPath
        }
        $hash = (Get-FileHash -Algorithm SHA256 $zipPath).Hash.ToLower()
        if ($hash -ne $archive.sha256) {
            Remove-Item -Force $zipPath
            Write-Error "Go archive SHA-256 mismatch ($hash); deleted it -- run again."
        }
        Log "Extracting Go $goVersion"
        if (Test-Path $goRoot) { Remove-Item -Recurse -Force $goRoot }
        New-Item -ItemType Directory -Force -Path $goRoot | Out-Null
        # Windows' own bsdtar reads zip and is far faster than Expand-Archive.
        $sysTar = Join-Path $env:SystemRoot 'System32\tar.exe'
        if (Test-Path $sysTar) {
            & $sysTar -xf $zipPath -C $goRoot
            if ($LASTEXITCODE -ne 0) { Write-Error "extracting Go failed (exit $LASTEXITCODE)" }
        } else {
            Expand-Archive -Path $zipPath -DestinationPath $goRoot
        }
    }
}

Log "Building cloudflared $Version  (packs: $($packs -join ', '))"
Write-Host "    work dir : $workDir"
Write-Host "    go       : $goBin  ($(& $goBin version))"
Write-Host "    git      : $gitBin"
Write-Host "    source   : $repoUrl @ $Version"

# --- fetch source (cached shallow checkout of the exact tag) ------------------
if (-not (Test-Path (Join-Path $srcDir '.git'))) {
    Log "Cloning $repoUrl @ $Version"
    if (Test-Path $srcDir) { Remove-Item -Recurse -Force $srcDir }
    & $gitBin -c advice.detachedHead=false clone --depth 1 --branch $Version $repoUrl $srcDir
    if ($LASTEXITCODE -ne 0) { Write-Error "git clone failed (exit $LASTEXITCODE)" }
} else {
    Log "Using cached source at $srcDir"
}

# What `cloudflared --version` reports: the RELEASE_NOTES commit time, as
# cloudflared's Makefile stamps it, but in real UTC rather than this host's
# zone. With it and an empty build ID (the one part that differs between Go's
# Windows, macOS and Linux toolchains) every host builds the same bytes, so a
# committed binary can be checked by rebuilding it anywhere.
$commitTime = (& $gitBin -C $srcDir log -1 '--format=%ct' '--' 'RELEASE_NOTES')
$buildTime = if ($LASTEXITCODE -eq 0 -and $commitTime) {
    [DateTimeOffset]::FromUnixTimeSeconds([long]$commitTime).UtcDateTime.ToString('yyyy-MM-ddTHH:mm') + ' UTC'
} else { 'unknown' }
$ldflags = "-s -w -buildid= -X main.Version=$Version -X 'main.BuildTime=$buildTime'"

# Everything Go writes stays in the work dir; only the targets below change.
$savedEnv = @{}
$goEnv = @{
    CGO_ENABLED = '0'
    GOTOOLCHAIN = 'local'
    GOFLAGS     = '-mod=readonly'
    GOPATH      = (Join-Path $workDir 'gopath')
    GOMODCACHE  = (Join-Path $workDir 'gopath\pkg\mod')
    GOCACHE     = (Join-Path $workDir 'gocache')
    GOOS        = ''
    GOARCH      = ''
}
foreach ($name in $goEnv.Keys) { $savedEnv[$name] = [Environment]::GetEnvironmentVariable($name) }

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$results = @()
Push-Location $srcDir
try {
    foreach ($name in $goEnv.Keys) { [Environment]::SetEnvironmentVariable($name, $goEnv[$name]) }
    Log 'Downloading Go modules'
    & $goBin mod download
    if ($LASTEXITCODE -ne 0) { Write-Error "go mod download failed (exit $LASTEXITCODE)" }

    foreach ($pack in $packs) {
        $target = $allTargets[$pack]
        $ext = if ($target.goos -eq 'windows') { '.exe' } else { '' }
        $outBinary = Join-Path $outDir "$pack\cloudflared-$Version-$($target.goarch)$ext"
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $outBinary) | Out-Null
        Log "Compiling $pack ($($target.goos)/$($target.goarch))"
        $env:GOOS = $target.goos
        $env:GOARCH = $target.goarch
        & $goBin build -trimpath -ldflags $ldflags -o $outBinary ./cmd/cloudflared
        if ($LASTEXITCODE -ne 0) { Write-Error "go build for $pack failed (exit $LASTEXITCODE)" }
        $results += [pscustomobject]@{ Pack = $pack; Goos = $target.goos; Goarch = $target.goarch; Path = $outBinary }
    }
} finally {
    Pop-Location
    foreach ($name in $savedEnv.Keys) { [Environment]::SetEnvironmentVariable($name, $savedEnv[$name]) }
}

# --- smoke test ----------------------------------------------------------------
# A Windows build runs here when it is this host's arch, or x64 on an arm64 host
# (emulated). For the others, the first bytes say whether the right kind of
# executable came out: Mach-O 64 (cf fa ed fe) or ELF (7f 45 4c 46).
foreach ($result in $results) {
    $canRun = $result.Goos -eq 'windows' -and ($result.Goarch -eq $hostArch -or $hostArch -eq 'arm64')
    if ($canRun) {
        Log "Smoke test ($($result.Pack)): cloudflared --version"
        & $result.Path --version
        if ($LASTEXITCODE -ne 0) { Write-Error "smoke test for $($result.Pack) failed (exit $LASTEXITCODE)" }
        continue
    }
    $bytes = [System.IO.File]::ReadAllBytes($result.Path)[0..3]
    $magic = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ' '
    $expected = switch ($result.Goos) {
        'darwin'  { 'cf fa ed fe' }
        'linux'   { '7f 45 4c 46' }
        'windows' { '4d 5a' }
    }
    if (-not $magic.StartsWith($expected)) {
        Write-Error "$($result.Pack): unexpected file header '$magic' (expected '$expected')"
    }
    Write-Host "    $($result.Pack): header $magic ok (not run on this host)"
}

# --- report + ship ---------------------------------------------------------------
Log 'Done.'
foreach ($result in $results) {
    $item = Get-Item $result.Path
    $sizeMB = [math]::Round($item.Length / 1MB, 1)
    $sha = (Get-FileHash -Algorithm SHA256 $result.Path).Hash.ToLower()
    Write-Host "    $($result.Pack.PadRight(12)) $($item.Name)  ${sizeMB} MB  sha256 $sha"
}
Write-Host ''
if ($env:CLOUDFLARED_SHIP -eq '1') {
    foreach ($result in $results) {
        $shipDir = Join-Path $scriptDir $result.Pack
        New-Item -ItemType Directory -Force -Path $shipDir | Out-Null
        Get-ChildItem -Path $shipDir -Filter 'cloudflared*' -File | Remove-Item -Force
        Copy-Item -Force $result.Path $shipDir
        Write-Host "Shipped $($result.Pack): $(Join-Path $shipDir (Split-Path -Leaf $result.Path))" -ForegroundColor Yellow
    }
    Write-Host 'Bump extra-work/experiment-building/info.json and run `node extra-work/build-extra-bin.mjs`.' -ForegroundColor Yellow
} else {
    Write-Host 'Ship it by copying each into its platform dir (build-extra-bin.mjs picks it up by' -ForegroundColor Yellow
    Write-Host "the 'cloudflared' name prefix and packs it as cloudflared\cloudflared[.exe]);" -ForegroundColor Yellow
    Write-Host 'remove the older cloudflared* file there first, or set $env:CLOUDFLARED_SHIP=1:' -ForegroundColor Yellow
    foreach ($result in $results) {
        Write-Host "    Copy-Item '$($result.Path)' '$scriptDir\$($result.Pack)\'"
    }
}
